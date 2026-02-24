/**
 * Stub: replaces 'ajv' in Cloudflare Workers builds.
 * AjvJsonSchemaValidator in the SDK is never actually instantiated because
 * we always pass CfWorkerJsonSchemaValidator via McpServer options —
 * but the static import of ajv-provider.js would still load ajv at startup,
 * which crashes in Workers due to `require('./refs/data.json')`.
 * This stub satisfies the import without loading any JSON files.
 */
export default class Ajv {
  constructor() {}
  compile() {
    return () => true;
  }
  errorsText() {
    return 'validation error';
  }
}
