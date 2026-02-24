# 洛谷题目 MCP 服务

洛谷题目 MCP（Model Context Protocol）服务，用于抓取和结构化洛谷编程题目信息，可与 Claude Desktop、Cursor、VS Code 等 AI 工具无缝集成。

[在线演示](https://workers-playground-steep-brook-cdfb.alphazhang689.workers.dev/)

## MCP 安装指南

本服务基于 **Streamable HTTP 传输**（JSON-RPC 2.0 over HTTP POST）运行，无需本地进程，直接配置远端 URL 即可使用。

**MCP 端点地址：**
```
https://workers-playground-steep-brook-cdfb.alphazhang689.workers.dev/mcp
```

---

### Claude Desktop

编辑配置文件，加入以下内容：

- **macOS**：`~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**：`%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "luogu": {
      "url": "https://workers-playground-steep-brook-cdfb.alphazhang689.workers.dev/mcp"
    }
  }
}
```

保存后重启 Claude Desktop，在对话中即可直接让 Claude 查询洛谷题目。

---

### Cursor

1. 打开 **Settings**（`Ctrl+,` / `Cmd+,`）→ 搜索 **MCP**
2. 点击 **Add new MCP server**
3. 填写：
   - **Name**：`luogu`
   - **Type**：`http`
   - **URL**：`https://workers-playground-steep-brook-cdfb.alphazhang689.workers.dev/mcp`

---

### VS Code（GitHub Copilot Chat）

在 `.vscode/mcp.json` 中添加：

```json
{
  "servers": {
    "luogu": {
      "url": "https://workers-playground-steep-brook-cdfb.alphazhang689.workers.dev/mcp"
    }
  }
}
```

---

### 其他 MCP 客户端（Cline、Continue 等）

所有支持 **Streamable HTTP** 或 **HTTP transport** 的 MCP 客户端均可直接配置上方 URL。

---

## 可用工具

| 工具名 | 说明 | 参数 |
|---|---|---|
| `get_problem` | 获取洛谷题目完整信息（题面、格式、样例、难度、标签） | `problem_id`：题目编号，如 `P1001`、`CF1234A`、`AT_abc123_a` |

支持的题目编号格式：`P`（普通）、`B`（入门）、`CF`（Codeforces）、`AT`（AtCoder）、`SP`（SPOJ）、`UVA` 等。

---

## REST API

除 MCP 外，还提供 REST API 接口：

| 方法 | 路径 | 说明 |
|---|---|---|
| `GET` | `/api/problem/:id` | 通过题号获取题目，如 `/api/problem/P1001` |
| `GET` | `/api/fetch?url=<题目URL>` | 通过完整 URL 获取题目 |

### 返回数据格式

```json
{
  "id": "P1001",
  "url": "https://www.luogu.com.cn/problem/P1001",
  "title": "A+B Problem",
  "difficultyNum": 1,
  "difficulty": "入门",
  "tags": ["模拟", "数学"],
  "description": "输入两个整数 a, b，输出它们的和",
  "inputFormat": "两个用空格分开的整数",
  "outputFormat": "一个整数",
  "samples": [
    { "input": "1 2", "output": "3" }
  ],
  "limit": "时间限制：1.0s  内存限制：128MB"
}
```

---

## MCP 协议参考

本服务遵循 [MCP 规范 2025-11-25](https://spec.modelcontextprotocol.io/)，使用 **JSON-RPC 2.0** 格式：

```jsonc
// 初始化
{ "jsonrpc": "2.0", "id": 1, "method": "initialize",
  "params": { "protocolVersion": "2025-11-25", "capabilities": {} } }

// 列出工具
{ "jsonrpc": "2.0", "id": 2, "method": "tools/list" }

// 调用工具
{ "jsonrpc": "2.0", "id": 3, "method": "tools/call",
  "params": { "name": "get_problem", "arguments": { "problem_id": "P1001" } } }
```

---

## 本地开发 & 部署

```bash
# 安装依赖
npm install

# 本地开发（访问 http://localhost:8787）
npm run dev

# 运行测试
npm test

# 部署到 Cloudflare Workers
npm run deploy
```

## 许可证

本项目基于 MIT 许可证开源。
