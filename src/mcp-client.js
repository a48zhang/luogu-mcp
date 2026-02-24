/**
 * MCP 服务器实现
 * 使用官方 @modelcontextprotocol/sdk，符合 MCP 2025-11-25 标准。
 * 每次请求创建独立的 McpServer + WebStandardStreamableHTTPServerTransport（无状态模式），
 * 适合 Cloudflare Workers 无持久内存的运行环境。
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { CfWorkerJsonSchemaValidator } from '@modelcontextprotocol/sdk/validation/cfworker';
import { z } from 'zod';
import { fetchProblemPage } from './fetcher.js';
import { parseProblemHtml } from './parser.js';

const SERVER_NAME = 'Luogu MCP Server';
const SERVER_VERSION = '1.0.0';

/** 洛谷题目ID格式：字母开头，后跟字母/数字/下划线，如 P1001, CF1234A, AT_abc123_a */
const PROBLEM_ID_RE = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * 创建并配置 McpServer 实例（注册所有工具）。
 * 每次请求调用一次，保证无状态。
 */
function createMcpServer() {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { jsonSchemaValidator: new CfWorkerJsonSchemaValidator() },
  );

  server.tool(
    'get_problem',
    '根据题目编号获取洛谷题目详细信息，包括题面、输入输出格式、样例、数据范围等。',
    { problem_id: z.string().describe('洛谷题目编号，如 P1001、B2002、CF1234A、AT_abc123_a') },
    { title: '获取洛谷题目', readOnlyHint: true, openWorldHint: true },
    async ({ problem_id }) => {
      if (!PROBLEM_ID_RE.test(problem_id)) {
        return {
          isError: true,
          content: [{
            type: 'text',
            text: `题目编号格式无效: ${problem_id}。请使用合法的洛谷题目编号，如 P1001、B2002、CF1234A、AT_abc123_a。`,
          }],
        };
      }

      const url = `https://www.luogu.com.cn/problem/${problem_id}`;
      const html = await fetchProblemPage(url);
      const info = parseProblemHtml(html);

      return {
        content: [{ type: 'text', text: formatProblemText({ id: problem_id, url, ...info }) }],
      };
    },
  );

  return server;
}

/**
 * 处理 MCP HTTP 请求（无状态，每次请求独立）。
 * @param {Request} request
 * @returns {Promise<Response>}
 */
export async function handleMcpRequest(request) {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // 禁用 session 管理 = 无状态模式
  });

  const server = createMcpServer();
  await server.connect(transport);
  return transport.handleRequest(request);
}

// ---------------------------------------------------------------------------
// Markdown 格式化
// ---------------------------------------------------------------------------

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
// Direct API helper（供 /api/problem/:id 路由使用）
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