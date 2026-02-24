import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config';
import path from 'path';

export default defineWorkersConfig({
	resolve: {
		alias: {
			// ajv uses `require('./refs/data.json')` which crashes in Workers.
			// Stub it out — the SDK never actually uses AjvJsonSchemaValidator
			// at runtime because we pass CfWorkerJsonSchemaValidator instead.
			'ajv': path.resolve('./src/stubs/ajv.js'),
			'ajv-formats': path.resolve('./src/stubs/ajv-formats.js'),
		},
	},
	ssr: {
		// Force Vite to bundle the SDK so the resolve.alias above applies
		// to its internal imports (ajv-provider.js → ajv → data.json).
		noExternal: ['@modelcontextprotocol/sdk', 'zod', '@cfworker/json-schema'],
	},
	test: {
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
			},
		},
	},
});
