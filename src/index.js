/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

import { extractProblemId } from './utils.js';
import { fetchProblemPage } from './fetcher.js';
import { parseProblemHtml } from './parser.js';
import { handleMcpRequest, getProblemById } from './mcp-client.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 处理MCP请求 - 使用标准MCP协议
    if (path === '/mcp' || path === '/mcp/') {
      if (request.method === 'POST') {
        return handleMcpRequest(request);
      }
      
      // MCP只支持POST请求
      return new Response(JSON.stringify({
        status: 'error',
        error: 'MCP endpoint only supports POST requests'
      }), {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Allow': 'POST'
        }
      });
    }
    
    // 处理API请求，提取题目
    if (path.startsWith('/api/fetch')) {
      const problemUrl = url.searchParams.get('url');
      
      if (!problemUrl || !problemUrl.includes('luogu.com.cn/problem/')) {
        return new Response(JSON.stringify({ error: 'Invalid or missing problem URL' }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      try {
        const problemId = extractProblemId(problemUrl);
        if (!problemId) {
          throw new Error('Invalid Luogu problem URL');
        }
        
        const html = await fetchProblemPage(problemUrl);
        const problemInfo = parseProblemHtml(html);
        
        return new Response(JSON.stringify({
          id: problemId,
          source: 'luogu',
          url: problemUrl,
          ...problemInfo
        }), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { 'Content-Type': 'application/json', 'Status': '500' }
        });
      }
    }
    
    // 添加根据题号直接获取题目的API端点
    if (path.startsWith('/api/problem/')) {
      const problemId = path.replace('/api/problem/', '');
      
      try {
        const problemInfo = await getProblemById(problemId);
        return new Response(JSON.stringify(problemInfo), {
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          headers: { 'Content-Type': 'application/json', 'Status': '500' }
        });
      }
    }
    
    // 返回简单的HTML页面，用于测试
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>洛谷题目MCP服务器</title>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
            input { width: 100%; padding: 8px; margin: 10px 0; }
            button { padding: 8px 16px; background: #1a73e8; color: white; border: none; cursor: pointer; }
            pre { background: #f5f5f5; padding: 10px; overflow: auto; }
            .tab { display: none; }
            .tab-active { display: block; }
            .tabs { display: flex; margin-bottom: 20px; }
            .tab-button { padding: 8px 16px; cursor: pointer; background: #f1f1f1; margin-right: 5px; }
            .tab-button-active { background: #1a73e8; color: white; }
          </style>
        </head>
        <body>
          <h1>洛谷题目MCP服务器</h1>
          <p>该服务支持Model Context Protocol (MCP) 2024-11-05版本，提供查询洛谷题目功能</p>
          
          <div class="tabs">
            <div class="tab-button tab-button-active" onclick="switchTab('url-tab', this)">通过URL获取</div>
            <div class="tab-button" onclick="switchTab('id-tab', this)">通过题号获取</div>
            <div class="tab-button" onclick="switchTab('mcp-tab', this)">MCP接口测试</div>
          </div>
          
          <div id="url-tab" class="tab tab-active">
            <p>输入洛谷题目URL，例如: https://www.luogu.com.cn/problem/P1006</p>
            <input id="problemUrl" placeholder="https://www.luogu.com.cn/problem/P1006" />
            <button onclick="fetchProblemByUrl()">获取题目</button>
          </div>
          
          <div id="id-tab" class="tab">
            <p>输入洛谷题号，例如: P1006</p>
            <input id="problemId" placeholder="P1006" />
            <button onclick="fetchProblemById()">获取题目</button>
          </div>
          
          <div id="mcp-tab" class="tab">
            <p>MCP接口测试 (POST /mcp)</p>
            <p>请求JSON:</p>
            <textarea id="mcpRequest" style="width: 100%; height: 150px;">{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_problem",
    "arguments": {
      "problem_id": "P1001"
    }
  }
}</textarea>
            <button onclick="testMcpApi()">发送MCP请求</button>
            <p>其他可用请求:</p>
            <button onclick="setInitializeRequest()">initialize 请求</button>
            <button onclick="setToolsListRequest()">tools/list 请求</button>
          </div>
          
          <div id="result">
            <h2>结果：</h2>
            <pre id="json"></pre>
          </div>
          
          <script>
            function switchTab(tabId, button) {
              // 隐藏所有tab
              document.querySelectorAll('.tab').forEach(tab => {
                tab.classList.remove('tab-active');
              });
              
              // 取消所有按钮的active状态
              document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('tab-button-active');
              });
              
              // 显示选中的tab
              document.getElementById(tabId).classList.add('tab-active');
              
              // 设置按钮为active
              button.classList.add('tab-button-active');
            }
            
            async function fetchProblemByUrl() {
              const url = document.getElementById('problemUrl').value;
              const resultElement = document.getElementById('json');
              
              try {
                resultElement.textContent = '加载中...';
                const response = await fetch(\`/api/fetch?url=\${encodeURIComponent(url)}\`);
                const data = await response.json();
                resultElement.textContent = JSON.stringify(data, null, 2);
              } catch (error) {
                resultElement.textContent = JSON.stringify({ error: error.message }, null, 2);
              }
            }
            
            async function fetchProblemById() {
              const id = document.getElementById('problemId').value;
              const resultElement = document.getElementById('json');
              
              try {
                resultElement.textContent = '加载中...';
                const response = await fetch(\`/api/problem/\${id}\`);
                const data = await response.json();
                resultElement.textContent = JSON.stringify(data, null, 2);
              } catch (error) {
                resultElement.textContent = JSON.stringify({ error: error.message }, null, 2);
              }
            }
            
            async function testMcpApi() {
              const requestJson = document.getElementById('mcpRequest').value;
              const resultElement = document.getElementById('json');
              
              try {
                resultElement.textContent = '加载中...';
                const response = await fetch('/mcp', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json'
                  },
                  body: requestJson
                });
                
                const data = await response.json();
                resultElement.textContent = JSON.stringify(data, null, 2);
              } catch (error) {
                resultElement.textContent = JSON.stringify({ error: error.message }, null, 2);
              }
            }
            
            function setInitializeRequest() {
              document.getElementById('mcpRequest').value = JSON.stringify({
                jsonrpc: "2.0",
                id: 1,
                method: "initialize",
                params: {
                  protocolVersion: "2024-11-05",
                  clientInfo: {
                    name: "MCP Test Client",
                    version: "1.0.0"
                  },
                  capabilities: {}
                }
              }, null, 2);
            }
            
            function setToolsListRequest() {
              document.getElementById('mcpRequest').value = JSON.stringify({
                jsonrpc: "2.0",
                id: 2,
                method: "tools/list"
              }, null, 2);
            }
          </script>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  },
};
