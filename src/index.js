import { fetchProblemPage } from './fetcher.js';
import { parseProblemHtml } from './parser.js';
import { extractProblemId } from './utils.js';
import { handleMcpRequest } from './mcp-client.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // MCP endpoint — JSON-RPC 2.0 over HTTP POST
    if (path === '/mcp' || path === '/mcp/') {
      if (request.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'MCP endpoint only accepts POST' }), {
          status: 405,
          headers: { 'Content-Type': 'application/json', Allow: 'POST' },
        });
      }
      return handleMcpRequest(request);
    }

    // REST API: get problem by ID
    const idMatch = path.match(/^\/api\/problem\/([^/]+)$/);
    if (idMatch) {
      const problemId = idMatch[1];
      try {
        const problemUrl = `https://www.luogu.com.cn/problem/${problemId}`;
        const html = await fetchProblemPage(problemUrl);
        const info = parseProblemHtml(html);
        return jsonResponse({ id: problemId, url: problemUrl, ...info });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // REST API: get problem by URL query param
    if (path === '/api/fetch') {
      const problemUrl = url.searchParams.get('url');
      if (!problemUrl) {
        return jsonResponse({ error: 'Missing url query parameter' }, 400);
      }
      const problemId = extractProblemId(problemUrl);
      if (!problemId) {
        return jsonResponse({ error: 'Cannot extract problem ID from the provided URL' }, 400);
      }
      try {
        const html = await fetchProblemPage(problemUrl);
        const info = parseProblemHtml(html);
        return jsonResponse({ id: problemId, url: problemUrl, ...info });
      } catch (err) {
        return jsonResponse({ error: err.message }, 500);
      }
    }

    // Frontend page
    return new Response(FRONTEND_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  },
};

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Frontend HTML
// ---------------------------------------------------------------------------

const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>洛谷 MCP 服务</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --primary: #0e9de5;
      --primary-dark: #0a7cb8;
      --accent: #fe4365;
      --bg: #f0f4f8;
      --card-bg: #ffffff;
      --text: #1a2533;
      --text-muted: #6b7a8d;
      --border: #dde3ec;
      --code-bg: #1e2a3a;
      --code-text: #e2eaf5;
      --radius: 12px;
      --shadow: 0 2px 16px rgba(0,0,0,.08);
    }

    body {
      font-family: "Segoe UI", system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
    }

    /* ── Header ── */
    header {
      background: linear-gradient(135deg, #0e9de5 0%, #005fa3 100%);
      color: #fff;
      padding: 32px 24px 28px;
      text-align: center;
    }
    header h1 { font-size: 2rem; font-weight: 700; letter-spacing: -.5px; }
    header p  { margin-top: 8px; font-size: .95rem; opacity: .85; }

    /* ── Layout ── */
    main {
      max-width: 900px;
      margin: 0 auto;
      padding: 32px 16px 64px;
      display: grid;
      gap: 24px;
    }

    /* ── Card ── */
    .card {
      background: var(--card-bg);
      border-radius: var(--radius);
      box-shadow: var(--shadow);
      overflow: hidden;
    }
    .card-header {
      padding: 16px 20px;
      border-bottom: 1px solid var(--border);
      font-weight: 600;
      font-size: .95rem;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card-header .icon {
      width: 22px; height: 22px;
      background: var(--primary);
      border-radius: 6px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #fff;
      font-size: .75rem;
    }
    .card-body { padding: 20px; }

    /* ── Tabs ── */
    .tabs { display: flex; gap: 4px; border-bottom: 2px solid var(--border); padding: 0 20px; }
    .tab-btn {
      padding: 12px 18px;
      border: none;
      background: none;
      cursor: pointer;
      font-size: .9rem;
      color: var(--text-muted);
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: color .15s, border-color .15s;
    }
    .tab-btn:hover  { color: var(--primary); }
    .tab-btn.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }

    .tab-panel { display: none; padding: 20px; }
    .tab-panel.active { display: block; }

    /* ── Form controls ── */
    .field { margin-bottom: 14px; }
    label  { display: block; font-size: .85rem; font-weight: 500; color: var(--text-muted); margin-bottom: 6px; }
    input[type="text"], textarea {
      width: 100%;
      padding: 10px 14px;
      border: 1.5px solid var(--border);
      border-radius: 8px;
      font-size: .9rem;
      font-family: inherit;
      color: var(--text);
      background: var(--bg);
      transition: border-color .15s;
      outline: none;
    }
    input[type="text"]:focus, textarea:focus { border-color: var(--primary); }
    textarea { resize: vertical; min-height: 160px; font-family: "Cascadia Code", "Fira Code", monospace; font-size: .82rem; }

    /* ── Button ── */
    .btn {
      padding: 10px 22px;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: .9rem;
      font-weight: 600;
      transition: background .15s, transform .1s;
    }
    .btn:active { transform: scale(.97); }
    .btn-primary { background: var(--primary); color: #fff; }
    .btn-primary:hover { background: var(--primary-dark); }
    .btn-ghost  { background: var(--border); color: var(--text); margin-right: 6px; }
    .btn-ghost:hover { background: #c5cdd8; }

    .btn-row { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 4px; }

    /* ── Result ── */
    .result-box {
      border-radius: 10px;
      overflow: hidden;
      border: 1px solid var(--border);
    }
    .result-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      background: var(--code-bg);
      color: #8899b0;
      font-size: .8rem;
    }
    .result-header span { font-weight: 600; color: #a8c0d8; }
    pre {
      background: var(--code-bg);
      color: var(--code-text);
      padding: 16px;
      font-family: "Cascadia Code", "Fira Code", Consolas, monospace;
      font-size: .82rem;
      line-height: 1.6;
      overflow-x: auto;
      max-height: 480px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* ── Docs grid ── */
    .doc-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; }
    .doc-item {
      background: var(--bg);
      border-radius: 8px;
      padding: 14px 16px;
      border: 1px solid var(--border);
    }
    .doc-item code {
      display: block;
      font-family: monospace;
      font-size: .8rem;
      color: var(--primary);
      margin-bottom: 6px;
      word-break: break-all;
    }
    .doc-item p { font-size: .83rem; color: var(--text-muted); }

    /* ── Loading spinner ── */
    .spinner {
      display: inline-block;
      width: 16px; height: 16px;
      border: 2px solid rgba(255,255,255,.4);
      border-top-color: #fff;
      border-radius: 50%;
      animation: spin .6s linear infinite;
      vertical-align: middle;
      margin-right: 6px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* ── Status badge ── */
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 100px;
      font-size: .75rem;
      font-weight: 600;
    }
    .badge-ok  { background: #d1fae5; color: #065f46; }
    .badge-err { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <header>
    <h1>🟡 洛谷 MCP 服务</h1>
    <p>基于 Model Context Protocol (2024-11-05) 的洛谷题目查询服务，运行于 Cloudflare Workers</p>
  </header>

  <main>
    <!-- ── Interactive Tester ── -->
    <div class="card">
      <div class="card-header"><span class="icon">▶</span> 在线测试</div>
      <div class="tabs" role="tablist">
        <button class="tab-btn active" onclick="switchTab('tab-id',this)" role="tab">按题号查询</button>
        <button class="tab-btn"        onclick="switchTab('tab-mcp',this)" role="tab">MCP 接口</button>
      </div>

      <!-- Tab: by ID -->
      <div id="tab-id" class="tab-panel active">
        <div class="field">
          <label for="inputId">题目编号（如 P1001、B2002、CF1234A）</label>
          <input id="inputId" type="text" placeholder="P1001" autocomplete="off" />
        </div>
        <button class="btn btn-primary" onclick="fetchById()">查询题目</button>
      </div>

      <!-- Tab: MCP -->
      <div id="tab-mcp" class="tab-panel">
        <div class="field">
          <label for="mcpBody">请求 JSON (POST /mcp)</label>
          <textarea id="mcpBody">{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "get_problem",
    "arguments": { "problem_id": "P1001" }
  }
}</textarea>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" onclick="sendMcp()">发送请求</button>
          <button class="btn btn-ghost"   onclick="setPreset('initialize')">initialize</button>
          <button class="btn btn-ghost"   onclick="setPreset('tools/list')">tools/list</button>
          <button class="btn btn-ghost"   onclick="setPreset('get_problem')">get_problem</button>
        </div>
      </div>
    </div>

    <!-- ── Result ── -->
    <div class="card" id="resultCard" style="display:none">
      <div class="result-box">
        <div class="result-header">
          <span>响应结果</span>
          <span id="statusBadge"></span>
        </div>
        <pre id="resultPre">// 结果将显示在这里</pre>
      </div>
    </div>

    <!-- ── API Docs ── -->
    <div class="card">
      <div class="card-header"><span class="icon">📄</span> API 端点</div>
      <div class="card-body">
        <div class="doc-grid">
          <div class="doc-item">
            <code>POST /mcp</code>
            <p>MCP JSON-RPC 2.0 入口，支持 initialize / tools/list / tools/call / ping</p>
          </div>
          <div class="doc-item">
            <code>GET /api/problem/:id</code>
            <p>直接获取题目 JSON，如 /api/problem/P1001</p>
          </div>
          <div class="doc-item">
            <code>GET /api/fetch?url=</code>
            <p>通过完整 URL 获取题目，如 ?url=https://www.luogu.com.cn/problem/P1001</p>
          </div>
        </div>
      </div>
    </div>
  </main>

  <script>
    // ── Tab switching ──
    function switchTab(id, btn) {
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.getElementById(id).classList.add('active');
      btn.classList.add('active');
    }

    // ── Result display ──
    function showResult(data, ok) {
      const card = document.getElementById('resultCard');
      const pre  = document.getElementById('resultPre');
      const badge = document.getElementById('statusBadge');
      card.style.display = 'block';
      pre.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
      badge.innerHTML = ok
        ? '<span class="badge badge-ok">200 OK</span>'
        : '<span class="badge badge-err">Error</span>';
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    function setLoading(btn) {
      btn.disabled = true;
      btn._orig = btn.innerHTML;
      btn.innerHTML = '<span class="spinner"></span>请求中…';
    }
    function clearLoading(btn) {
      btn.disabled = false;
      btn.innerHTML = btn._orig;
    }

    // ── Fetch by ID ──
    async function fetchById() {
      const id  = document.getElementById('inputId').value.trim();
      const btn = event.currentTarget;
      if (!id) { alert('请输入题目编号'); return; }
      setLoading(btn);
      try {
        const res  = await fetch('/api/problem/' + encodeURIComponent(id));
        const data = await res.json();
        showResult(data, res.ok);
      } catch (e) {
        showResult({ error: e.message }, false);
      } finally {
        clearLoading(btn);
      }
    }

    // ── MCP request ──
    async function sendMcp() {
      const body = document.getElementById('mcpBody').value;
      const btn  = event.currentTarget;
      setLoading(btn);
      try {
        const res  = await fetch('/mcp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        const data = await res.json();
        showResult(data, res.ok);
      } catch (e) {
        showResult({ error: e.message }, false);
      } finally {
        clearLoading(btn);
      }
    }

    // ── Presets ──
    const PRESETS = {
      initialize: { jsonrpc:'2.0', id:1, method:'initialize', params:{ protocolVersion:'2024-11-05', clientInfo:{ name:'Test Client', version:'1.0.0' }, capabilities:{} } },
      'tools/list': { jsonrpc:'2.0', id:2, method:'tools/list' },
      get_problem:  { jsonrpc:'2.0', id:3, method:'tools/call', params:{ name:'get_problem', arguments:{ problem_id:'P1001' } } },
    };
    function setPreset(key) {
      document.getElementById('mcpBody').value = JSON.stringify(PRESETS[key], null, 2);
    }
  </script>
</body>
</html>`;

