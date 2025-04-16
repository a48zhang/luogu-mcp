/**
 * MCP服务器实现 - 符合Model Context Protocol标准
 * 提供洛谷题目信息的MCP服务
 */

import { extractProblemId } from './utils.js';
import { fetchProblemPage } from './fetcher.js';
import { parseProblemHtml } from './parser.js';

// 当前MCP规范版本
const MCP_PROTOCOL_VERSION = '2024-11-05';

// 已连接的会话ID
let sessionId = null;

/**
 * 处理JSON-RPC请求
 * @param {Object} request - HTTP请求对象
 * @returns {Promise<Response>} JSON-RPC响应
 */
export async function handleMcpRequest(request) {
  // 验证Content-Type
  const contentType = request.headers.get('Content-Type');
  if (contentType !== 'application/json') {
    return createErrorResponse(-32700, 'Content-Type must be application/json');
  }
  
  // 解析请求JSON
  let requestData;
  try {
    requestData = await request.json();
  } catch (error) {
    return createErrorResponse(-32700, 'Parse error: Invalid JSON');
  }
  
  // 验证JSON-RPC请求格式
  if (!isValidJsonRpcRequest(requestData)) {
    return createErrorResponse(-32600, 'Invalid Request: Not a valid JSON-RPC 2.0 request');
  }
  
  // 处理请求
  const { id, method, params } = requestData;
  
  // 初始化请求 - 必须首先处理
  if (method === 'initialize') {
    return handleInitialize(id, params);
  }
  
  // 其他所有请求都需要先初始化
  if (!sessionId) {
    return createErrorResponse(-32600, 'Server not initialized', id);
  }
  
  // 处理initialized通知
  if (method === 'initialized') {
    // 这是通知，不需要响应
    return new Response(null, { status: 204 });
  }
  
  // 处理工具列表请求
  if (method === 'tools/list') {
    return handleToolsList(id, params);
  }
  
  // 处理工具调用
  if (method === 'tools/call') {
    return handleToolsCall(id, params);
  }
  
  // 处理ping请求
  if (method === 'ping') {
    return createJsonRpcResponse(id, {});
  }
  
  // 不支持的方法
  return createErrorResponse(-32601, `Method not found: ${method}`, id);
}

/**
 * 处理initialize请求
 * @param {string|number} id - 请求ID
 * @param {Object} params - 请求参数
 * @returns {Response} JSON-RPC响应
 */
function handleInitialize(id, params) {
  // 验证协议版本兼容性
  const clientVersion = params?.protocolVersion || '1.0';
  
  // 简单版本校验 - 实际实现可能需要更复杂的版本比较
  if (clientVersion !== MCP_PROTOCOL_VERSION && clientVersion !== '1.0') {
    return createErrorResponse(
      -32600, 
      `Protocol version mismatch: Server supports ${MCP_PROTOCOL_VERSION}, client requested ${clientVersion}`,
      id
    );
  }
  
  // 创建新会话
  sessionId = generateSessionId();
  
  // 返回服务器能力和版本信息
  return createJsonRpcResponse(id, {
    protocolVersion: MCP_PROTOCOL_VERSION,
    serverInfo: {
      name: 'Luogu MCP Server',
      version: '1.0.0'
    },
    capabilities: {
      tools: {
        listChanged: false
      }
    }
  });
}

/**
 * 处理tools/list请求
 * @param {string|number} id - 请求ID
 * @returns {Response} JSON-RPC响应
 */
function handleToolsList(id) {
  return createJsonRpcResponse(id, {
    tools: [
      {
        name: 'get_problem',
        description: '获取洛谷题目信息',
        inputSchema: {
          type: 'object',
          properties: {
            problem_id: {
              type: 'string',
              description: '洛谷题目ID，如P1001'
            }
          },
          required: ['problem_id']
        },
        annotations: {
          title: '获取洛谷题目',
          readOnlyHint: true,
          openWorldHint: true
        }
      },
      {
        name: 'search_problems',
        description: '根据关键词搜索洛谷题目',
        inputSchema: {
          type: 'object',
          properties: {
            keyword: {
              type: 'string',
              description: '搜索关键词'
            },
            max_results: {
              type: 'integer',
              description: '最大返回结果数量',
              default: 5
            }
          },
          required: ['keyword']
        },
        annotations: {
          title: '搜索洛谷题目',
          readOnlyHint: true,
          openWorldHint: true
        }
      }
    ]
  });
}

/**
 * 处理tools/call请求
 * @param {string|number} id - 请求ID
 * @param {Object} params - 请求参数
 * @returns {Promise<Response>} JSON-RPC响应
 */
async function handleToolsCall(id, params) {
  const { name, arguments: args } = params;
  
  if (!name) {
    return createErrorResponse(-32602, 'Invalid params: missing tool name', id);
  }
  
  // 处理不同的工具
  try {
    if (name === 'get_problem') {
      const result = await handleGetProblemTool(args);
      return createJsonRpcResponse(id, result);
    } else if (name === 'search_problems') {
      const result = await handleSearchProblemsTool(args);
      return createJsonRpcResponse(id, result);
    } else {
      return createErrorResponse(-32601, `Tool not found: ${name}`, id);
    }
  } catch (error) {
    // 工具执行错误 - 返回为工具错误而非协议错误
    return createJsonRpcResponse(id, {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Error executing tool ${name}: ${error.message}`
        }
      ]
    });
  }
}

/**
 * 处理get_problem工具
 * @param {Object} args - 工具参数
 * @returns {Promise<Object>} 工具结果
 */
async function handleGetProblemTool(args) {
  if (!args?.problem_id) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Missing required parameter: problem_id'
        }
      ]
    };
  }
  
  const problemId = args.problem_id;
  
  // 验证题目ID格式
  if (!problemId.match(/^[A-Z][0-9]+$/)) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Invalid problem ID format: ${problemId}. Expected format like P1001.`
        }
      ]
    };
  }
  
  try {
    // 获取题目信息
    const url = `https://www.luogu.com.cn/problem/${problemId}`;
    const html = await fetchProblemPage(url);
    const problemInfo = parseProblemHtml(html);
    
    // 返回结果
    return {
      isError: false,
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            id: problemId,
            source: 'luogu',
            url,
            ...problemInfo
          }, null, 2)
        }
      ]
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Failed to fetch problem ${problemId}: ${error.message}`
        }
      ]
    };
  }
}

/**
 * 处理search_problems工具
 * @param {Object} args - 工具参数
 * @returns {Promise<Object>} 工具结果
 */
async function handleSearchProblemsTool(args) {
  if (!args?.keyword) {
    return {
      isError: true,
      content: [
        {
          type: 'text',
          text: 'Missing required parameter: keyword'
        }
      ]
    };
  }
  
  // 实际应用中，这里应该对接洛谷搜索API
  // 这里仅作为示例，返回一个模拟结果
  return {
    isError: false,
    content: [
      {
        type: 'text',
        text: `搜索关键词 "${args.keyword}" 的结果（模拟数据）:\n\n` +
              `1. P1001 - A+B Problem\n` +
              `2. P1002 - 过河卒\n` +
              `3. P1003 - 铺地毯\n` +
              `注意：这是模拟数据，实际实现需要对接洛谷搜索API`
      }
    ]
  };
}

// 辅助函数

/**
 * 创建JSON-RPC错误响应
 * @param {number} code - 错误代码
 * @param {string} message - 错误消息
 * @param {string|number|null} id - 请求ID
 * @returns {Response} 错误响应
 */
function createErrorResponse(code, message, id = null) {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message
      }
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

/**
 * 创建JSON-RPC成功响应
 * @param {string|number} id - 请求ID
 * @param {Object} result - 响应结果
 * @returns {Response} 成功响应
 */
function createJsonRpcResponse(id, result) {
  return new Response(
    JSON.stringify({
      jsonrpc: '2.0',
      id,
      result
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }
  );
}

/**
 * 验证是否为有效的JSON-RPC请求
 * @param {Object} request - 请求对象
 * @returns {boolean} 是否有效
 */
function isValidJsonRpcRequest(request) {
  return (
    request &&
    request.jsonrpc === '2.0' &&
    typeof request.method === 'string' &&
    (request.id === undefined || request.id === null || 
     typeof request.id === 'string' || typeof request.id === 'number')
  );
}

/**
 * 生成唯一会话ID
 * @returns {string} 会话ID
 */
function generateSessionId() {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// 辅助函数 - 用于测试
export async function getProblemById(problemId) {
  if (!problemId || !problemId.match(/^[A-Z][0-9]+$/)) {
    throw new Error('Invalid Luogu problem ID format');
  }
  
  const url = `https://www.luogu.com.cn/problem/${problemId}`;
  const html = await fetchProblemPage(url);
  const problemInfo = parseProblemHtml(html);
  
  return {
    id: problemId,
    source: 'luogu',
    url,
    ...problemInfo
  };
}