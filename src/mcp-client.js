/**
 * MCP服务器实现 - 符合Model Context Protocol标准 (2024-11-05)
 * 提供洛谷题目信息的无状态MCP服务
 */

import { fetchProblemPage } from './fetcher.js';
import { parseProblemHtml } from './parser.js';

const MCP_PROTOCOL_VERSION = '2024-11-05';
const SERVER_NAME = 'Luogu MCP Server';
const SERVER_VERSION = '1.0.0';

/** 洛谷题目ID格式：字母开头，后跟字母/数字/下划线，如 P1001, CF1234A, AT_abc123_a */
const PROBLEM_ID_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * 处理 MCP HTTP 请求（无状态 JSON-RPC 2.0）
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function handleMcpRequest(request) {
  const contentType = request.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) {
    return jsonRpcError(null, -32700, 'Content-Type must be application/json');
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonRpcError(null, -32700, 'Parse error: invalid JSON');
  }

  if (!isValidJsonRpc(body)) {
    return jsonRpcError(null, -32600, 'Invalid Request: not a valid JSON-RPC 2.0 request');
  }

  const { id = null, method, params } = body;

  switch (method) {
    case 'initialize':
      return handleInitialize(id, params);

    case 'initialized':
      // Notification — no response body required
      return new Response(null, { status: 204 });

    case 'ping':
      return jsonRpcResult(id, {});

    case 'tools/list':
      return handleToolsList(id);

    case 'tools/call':
      return handleToolsCall(id, params);

    default:
      return jsonRpcError(id, -32601, `Method not found: ${method}`);
  }
}

// ---------------------------------------------------------------------------
// Method handlers
// ---------------------------------------------------------------------------

function handleInitialize(id, _params) {
  // Accept any client protocol version; always respond with the server's own version.

  return jsonRpcResult(id, {
    protocolVersion: MCP_PROTOCOL_VERSION,
    serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
    capabilities: {
      tools: { listChanged: false },
    },
  });
}

function handleToolsList(id) {
  return jsonRpcResult(id, {
    tools: [
      {
        name: 'get_problem',
        description: '根据题目编号获取洛谷题目详细信息，包括题面、输入输出格式、样例、数据范围等。',
        inputSchema: {
          type: 'object',
          properties: {
            problem_id: {
              type: 'string',
              description: '洛谷题目编号，如 P1001、B2002、CF1234A、AT_abc123_a',
            },
          },
          required: ['problem_id'],
        },
        annotations: {
          title: '获取洛谷题目',
          readOnlyHint: true,
          openWorldHint: true,
        },
      },
    ],
  });
}

async function handleToolsCall(id, params) {
  const { name, arguments: args } = params ?? {};

  if (!name) {
    return jsonRpcError(id, -32602, 'Invalid params: missing tool name');
  }

  try {
    if (name === 'get_problem') {
      return jsonRpcResult(id, await toolGetProblem(args));
    }
    return jsonRpcError(id, -32601, `Tool not found: ${name}`);
  } catch (err) {
    return jsonRpcResult(id, {
      isError: true,
      content: [{ type: 'text', text: `Error executing tool ${name}: ${err.message}` }],
    });
  }
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------

async function toolGetProblem(args) {
  const problemId = args?.problem_id;

  if (!problemId) {
    return errorContent('缺少必要参数: problem_id');
  }

  if (!PROBLEM_ID_RE.test(problemId)) {
    return errorContent(
      `题目编号格式无效: ${problemId}。` +
        '请使用合法的洛谷题目编号，如 P1001、B2002、CF1234A、AT_abc123_a。',
    );
  }

  const url = `https://www.luogu.com.cn/problem/${problemId}`;
  const html = await fetchProblemPage(url);
  const info = parseProblemHtml(html);

  const text = formatProblemText({ id: problemId, url, ...info });

  return {
    content: [{ type: 'text', text }],
  };
}

/**
 * 将题目信息格式化为可读 Markdown 文本
 */
function formatProblemText({ id, url, title, difficulty, tags, description, inputFormat, outputFormat, samples, limit }) {
  const lines = [];
  lines.push(`# ${id} ${title}`);
  lines.push('');
  lines.push(`**难度**: ${difficulty}  **标签**: ${tags?.length ? tags.join('、') : '无'}`);
  lines.push(`**题目链接**: ${url}`);
  lines.push('');
  lines.push('## 题目描述');
  lines.push(description || '无');
  lines.push('');
  lines.push('## 输入格式');
  lines.push(inputFormat || '无');
  lines.push('');
  lines.push('## 输出格式');
  lines.push(outputFormat || '无');
  lines.push('');

  if (samples?.length) {
    samples.forEach((s, i) => {
      lines.push(`## 样例 ${i + 1}`);
      lines.push('**输入**');
      lines.push('```');
      lines.push(s.input);
      lines.push('```');
      lines.push('**输出**');
      lines.push('```');
      lines.push(s.output);
      lines.push('```');
      lines.push('');
    });
  }

  if (limit) {
    lines.push('## 说明/提示');
    lines.push(limit);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function errorContent(text) {
  return { isError: true, content: [{ type: 'text', text }] };
}

function isValidJsonRpc(obj) {
  return (
    obj !== null &&
    typeof obj === 'object' &&
    obj.jsonrpc === '2.0' &&
    typeof obj.method === 'string' &&
    (obj.id === undefined || obj.id === null || typeof obj.id === 'string' || typeof obj.id === 'number')
  );
}

function jsonRpcResult(id, result) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, result }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonRpcError(id, code, message) {
  return new Response(JSON.stringify({ jsonrpc: '2.0', id, error: { code, message } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Direct API helper (used by /api/problem/:id route)
// ---------------------------------------------------------------------------

export async function getProblemById(problemId) {
  if (!problemId || !PROBLEM_ID_RE.test(problemId)) {
    throw new Error('无效的洛谷题目编号格式');
  }

  const url = `https://www.luogu.com.cn/problem/${problemId}`;
  const html = await fetchProblemPage(url);
  const info = parseProblemHtml(html);

  return { id: problemId, url, ...info };
}