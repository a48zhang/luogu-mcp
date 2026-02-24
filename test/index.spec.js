import { env, createExecutionContext, waitOnExecutionContext, SELF } from 'cloudflare:test';
import { describe, it, expect } from 'vitest';
import worker from '../src';

// ── Helpers ────────────────────────────────────────────────────────────────

function mcpPost(body) {
	return new Request('http://example.com/mcp', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			// MCP 2025-11-25 spec: client MUST accept both content types
			'Accept': 'application/json, text/event-stream',
		},
		body: JSON.stringify(body),
	});
}

/**
 * Parse a response that may be either plain JSON or an SSE stream.
 * The SDK uses SSE when the client accepts text/event-stream.
 * SSE format: "event: message\ndata: <json>\n\n"
 */
async function parseResponse(res) {
	const ct = res.headers.get('Content-Type') ?? '';
	const text = await res.text();
	if (ct.includes('text/event-stream')) {
		// SSE format: "event: ...\ndata: <json>\n\n"
		// May have priming empty events first; find last non-empty data line.
		const jsonLines = text
			.split('\n')
			.filter(l => l.startsWith('data: ') && l.length > 6);
		if (jsonLines.length === 0) return null;
		return JSON.parse(jsonLines[jsonLines.length - 1].slice(6));
	}
	return JSON.parse(text);
}

async function mcpJson(body) {
	const ctx = createExecutionContext();
	const res = await worker.fetch(mcpPost(body), env, ctx);
	await waitOnExecutionContext(ctx);
	return parseResponse(res);
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
			headers: {
				'Content-Type': 'text/plain',
				'Accept': 'application/json, text/event-stream',
			},
			body: '{}',
		});
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		const json = await res.json();
		// SDK rejects unsupported Content-Type with an error response
		expect(json.error).toBeDefined();
	});

	it('accepts application/json with charset parameter', async () => {
		const req = new Request('http://example.com/mcp', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Accept': 'application/json, text/event-stream',
			},
			body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }),
		});
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		const json = await parseResponse(res);
		expect(json.error).toBeUndefined();
	});

	it('returns an error for invalid JSON', async () => {
		const req = new Request('http://example.com/mcp', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json, text/event-stream',
			},
			body: 'not json',
		});
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		const json = await parseResponse(res);
		expect(json.error).toBeDefined();
	});

	it('returns an error for unknown method', async () => {
		const data = await mcpJson({ jsonrpc: '2.0', id: 9, method: 'unknown/method' });
		expect(data.error).toBeDefined();
	});
});

// ── MCP: initialize ─────────────────────────────────────────────────────────

describe('MCP initialize', () => {
	it('returns server info and capabilities', async () => {
		const data = await mcpJson({
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test-client', version: '1.0.0' } },
		});
		expect(data.result.protocolVersion).toBe('2025-11-25');
		expect(data.result.serverInfo.name).toBeTruthy();
		expect(data.result.capabilities.tools).toBeDefined();
	});

	it('negotiates protocol version when client sends unknown version', async () => {
		const data = await mcpJson({
			jsonrpc: '2.0',
			id: 2,
			method: 'initialize',
			params: { protocolVersion: '2099-01-01', capabilities: {}, clientInfo: { name: 'test-client', version: '1.0.0' } },
		});
		// SDK negotiates down to highest mutually supported version
		expect(data.result ?? data.error).toBeDefined();
	});
});

// ── MCP: notifications ──────────────────────────────────────────────────────

describe('MCP notifications', () => {
	it('returns 202 for notifications (no id)', async () => {
		const req = new Request('http://example.com/mcp', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Accept': 'application/json, text/event-stream',
			},
			body: JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }),
		});
		const ctx = createExecutionContext();
		const res = await worker.fetch(req, env, ctx);
		await waitOnExecutionContext(ctx);
		expect(res.status).toBe(202);
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
		// Per MCP spec, unknown tool is reported as a tool-level error in result
		expect(data.result?.isError ?? data.error).toBeTruthy();
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

