# 洛谷题目 MCP 服务

洛谷题目 MCP (Model Context Protocol) 服务是一个用于抓取和转换洛谷编程题目信息的服务，可用于与各种编程学习工具和AI助手集成，提供结构化的题目数据。

[Try it.](https://workers-playground-steep-brook-cdfb.alphazhang689.workers.dev/)

## API接口

### MCP接口

MCP接口通过POST请求提交到`/mcp`端点：

```json
// 初始化请求
{
  "type": "initialization",
  "client_info": {
    "name": "Your Client Name",
    "version": "1.0.0"
  }
}

// 获取题目请求
{
  "type": "request",
  "command": "get_problem",
  "params": {
    "problem_id": "P1001"
  }
}
```

### HTTP REST接口

还提供了常规的HTTP API接口：

- `GET /api/fetch?url=https://www.luogu.com.cn/problem/P1001` - 通过URL获取题目
- `GET /api/problem/P1001` - 通过题号获取题目

## 返回数据格式

```json
{
  "id": "P1001",
  "source": "luogu",
  "url": "https://www.luogu.com.cn/problem/P1001",
  "title": "A+B Problem",
  "difficultyNum": 1,
  "difficulty": "入门",
  "tags": ["模拟", "数学"],
  "description": "输入两个整数a,b，输出它们的和",
  "inputFormat": "两个用空格分开的整数",
  "outputFormat": "一个整数",
  "samples": [
    {
      "input": "1 2",
      "output": "3"
    }
  ],
  "limit": "时间限制：1.0s 内存限制：128MB"
}
```

## 快速开始

### 部署服务

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 部署到Cloudflare Workers
npm run deploy
```

## 本地测试

访问`http://localhost:8787`可以使用简单的Web界面测试API功能。

## 许可证

本项目基于MIT许可证开源。