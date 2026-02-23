import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

// ── Helpers ────────────────────────────────────────────────────────────────

function mcpPost(body) {
	return new Request('http://example.com/mcp', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	});
}

async function mcpJson(body) {
	const ctx = createExecutionContext();
	const res = await worker.fetch(mcpPost(body), env, ctx);
	await waitOnExecutionContext(ctx);
	return res.json();
}

// ── Frontend ────────────────────────────────────────────────────────────────

describe('Frontend', () => {
	it('serves HTML at the root', async () => {
		const req = new Request('http://example.com/');
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(res.headers.get('Content-Type')).toContain('text/html');
		const text = await res.text();
		expect(text).toContain('洛谷 MCP 服务');
	});
});

// ── MCP: transport ──────────────────────────────────────────────────────────

describe('MCP transport', () => {
	it('rejects non-POST with 405', async () => {
		const req = new Request('http://example.com/mcp', { method: 'GET' });
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(res.status).toBe(405);
	});

	it('rejects wrong Content-Type', async () => {
		const req = new Request('http://example.com/mcp', {
			method: 'POST',
			headers: { 'Content-Type': 'text/plain' },
			body: '{}',
		});
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		const json = await res.json();
		expect(json.error).toBeDefined();
		expect(json.error.code).toBe(-32700);
	});

	it('accepts application/json with charset parameter', async () => {
		const req = new Request('http://example.com/mcp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json; charset=utf-8' },
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
		});
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		const json = await res.json();
		expect(json.error).toBeUndefined();
	});

	it('returns -32700 for invalid JSON', async () => {
		const req = new Request('http://example.com/mcp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: 'not json',
		});
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		const json = await res.json();
		expect(json.error.code).toBe(-32700);
	});

	it('returns -32601 for unknown method', async () => {
		const data = await mcpJson({ jsonrpc: '2.0', id: 9, method: 'unknown/method' });
		expect(data.error.code).toBe(-32601);
	});
});

// ── MCP: initialize ─────────────────────────────────────────────────────────

describe('MCP initialize', () => {
	it('returns server info and capabilities', async () => {
		const data = await mcpJson({
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: { protocolVersion: '2024-11-05', capabilities: {} },
		});
		expect(data.result.protocolVersion).toBe('2024-11-05');
		expect(data.result.serverInfo.name).toBeTruthy();
		expect(data.result.capabilities.tools).toBeDefined();
	});

	it('accepts any client protocol version', async () => {
		const data = await mcpJson({
			jsonrpc: '2.0',
			id: 2,
			method: 'initialize',
			params: { protocolVersion: '2099-01-01', capabilities: {} },
		});
		expect(data.error).toBeUndefined();
		expect(data.result.protocolVersion).toBe('2024-11-05');
	});
});

// ── MCP: initialized notification ──────────────────────────────────────────

describe('MCP initialized notification', () => {
	it('returns 204 No Content', async () => {
		const req = new Request('http://example.com/mcp', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			// Notifications have no id
			body: JSON.stringify({ jsonrpc: '2.0', method: 'initialized' }),
		});
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(res.status).toBe(204);
	});
});

// ── MCP: ping ───────────────────────────────────────────────────────────────

describe('MCP ping', () => {
	it('responds with empty result', async () => {
		const data = await mcpJson({ jsonrpc: '2.0', id: 99, method: 'ping' });
		expect(data.error).toBeUndefined();
		expect(data.result).toEqual({});
	});
});

// ── MCP: tools/list ─────────────────────────────────────────────────────────

describe('MCP tools/list', () => {
	it('returns at least the get_problem tool', async () => {
		const data = await mcpJson({ jsonrpc: '2.0', id: 3, method: 'tools/list' });
		expect(data.result.tools).toBeInstanceOf(Array);
		const names = data.result.tools.map(t => t.name);
		expect(names).toContain('get_problem');
	});

	it('does NOT require prior initialization', async () => {
		// Stateless: tools/list must work without an initialize call
		const data = await mcpJson({ jsonrpc: '2.0', id: 4, method: 'tools/list' });
		expect(data.error).toBeUndefined();
	});
});

// ── MCP: tools/call – validation ────────────────────────────────────────────

describe('MCP tools/call validation', () => {
	it('returns error for unknown tool', async () => {
		const data = await mcpJson({
			jsonrpc: '2.0',
			id: 5,
			method: 'tools/call',
			params: { name: 'does_not_exist', arguments: {} },
		});
		expect(data.error).toBeDefined();
		expect(data.error.code).toBe(-32601);
	});

	it('returns isError for missing problem_id', async () => {
		const data = await mcpJson({
			jsonrpc: '2.0',
			id: 6,
			method: 'tools/call',
			params: { name: 'get_problem', arguments: {} },
		});
		expect(data.result.isError).toBe(true);
	});

	it('returns isError for invalid problem ID format', async () => {
		const data = await mcpJson({
			jsonrpc: '2.0',
			id: 7,
			method: 'tools/call',
			params: { name: 'get_problem', arguments: { problem_id: '!!!bad' } },
		});
		expect(data.result.isError).toBe(true);
	});

	it('accepts extended problem ID formats (CF, AT, B, etc.)', async () => {
		// These IDs should pass the format check.  In the test environment
		// the network is unavailable, so the fetch will fail; but the error
		// must NOT be a format-validation error — it must be a network error.
		for (const id of ['CF1234A', 'AT_abc123_a', 'B2002', 'SP100', 'UVA100']) {
			const data = await mcpJson({
				jsonrpc: '2.0',
				id: 8,
				method: 'tools/call',
				params: { name: 'get_problem', arguments: { problem_id: id } },
			});
			// If isError is true, it must NOT be a format-validation error
			if (data.result?.isError) {
				const text = data.result.content[0]?.text ?? '';
				expect(text).not.toContain('格式无效');
			}
		}
	});
});

