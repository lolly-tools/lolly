// SPDX-License-Identifier: MPL-2.0
/**
 * MCP request dispatch - transport-agnostic. Both the stdio (bin/lolly-mcp.ts)
 * and Streamable-HTTP (http.ts) transports funnel JSON-RPC messages through
 * dispatch(). Returns null for notifications (no response expected).
 */

import { LEGACY_VERSIONS, SUPPORTED_VERSIONS, SERVER_INFO, CAPABILITIES, modernRequest, validRequest, validateNegotiation, object } from './negotiation.ts';
import { ok, fail, ERR } from './protocol.ts';
import type { JsonRpcRequest, JsonRpcResponse } from './protocol.ts';
import { TOOL_DEFS, callTool, serverInstructions, listPrompts, getPrompt } from './tools.ts';
import { RESOURCES, RESOURCE_TEMPLATES, readResource } from './resources.ts';
import { PRIVATE_FILE_TOOLS, privateFiles } from './file-resources.ts';
import { LIVE_TOOLS, callLiveTool } from './live.ts';
import type { LiveBridge } from './live-bridge.ts';

export { PROTOCOL_VERSION, SERVER_INFO } from './negotiation.ts';

/** What a transport lends the dispatcher. `live` exists only in the local stdio server (plans/289 D1). */
export interface DispatchContext { fileScope?: string; protocolVersion?: string; live?: LiveBridge }

const toolsFor = (context: DispatchContext) => [...TOOL_DEFS, ...(context.fileScope ? PRIVATE_FILE_TOOLS : []), ...(context.live ? LIVE_TOOLS : [])];

export async function dispatch(req: JsonRpcRequest, context: DispatchContext = {}): Promise<JsonRpcResponse | null> {
  if (!validRequest(req)) return fail(null, ERR.INVALID_REQUEST, 'Invalid JSON-RPC request');
  const isNotification = req.id === undefined;
  const id = req.id ?? null;
  if (isNotification) return null;
  const error = validateNegotiation(req, context.protocolVersion);
  if (error) return error;
  const modern = modernRequest(req, context.protocolVersion);
  const done = (result: unknown): JsonRpcResponse => {
    if (!modern) return ok(id, result);
    const cacheable = ['server/discover', 'tools/list', 'resources/list', 'resources/templates/list', 'resources/read', 'prompts/list'].includes(req.method);
    return ok(id, { ...(object(result) ? result : {}), resultType: 'complete',
      ...(cacheable ? { ttlMs: req.method === 'resources/read' ? 0 : 60_000, cacheScope: 'private' } : {}),
      _meta: { ...(object(result) && object(result._meta) ? result._meta : {}), 'io.modelcontextprotocol/serverInfo': SERVER_INFO } });
  };
  try {
    switch (req.method) {
      case 'server/discover':
        return done({ supportedVersions: SUPPORTED_VERSIONS, capabilities: CAPABILITIES, instructions: await serverInstructions() });
      case 'initialize': {
        if (modern) return fail(id, ERR.METHOD_NOT_FOUND, 'Use server/discover with stateless MCP');
        const params = (req.params ?? {}) as { protocolVersion?: string };
        return done({
          protocolVersion: LEGACY_VERSIONS.includes(params.protocolVersion ?? '') ? params.protocolVersion : LEGACY_VERSIONS[0],
          capabilities: CAPABILITIES,
          serverInfo: SERVER_INFO,
          instructions: await serverInstructions(),
        });
      }
      case 'ping':
        return modern ? fail(id, ERR.METHOD_NOT_FOUND, 'ping is not part of this MCP version') : done({});
      case 'tools/list':
        return done({ tools: toolsFor(context) });
      case 'tools/call': {
        const params = (req.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
        if (typeof params.name !== 'string' || !params.name) return fail(id, ERR.INVALID_PARAMS, 'tools/call requires a name');
        if (params.arguments !== undefined && !object(params.arguments)) return fail(id, ERR.INVALID_PARAMS, 'arguments must be an object');
        if (!toolsFor(context).some(tool => tool.name === params.name)) return fail(id, ERR.INVALID_PARAMS, `Unknown tool: ${params.name}`);
        if (context.live && params.name.startsWith('lolly_live_')) return done(await callLiveTool(context.live, params.name, params.arguments ?? {}));
        if (params.name.startsWith('files_')) {
          if (!context.fileScope) return fail(id, ERR.INVALID_PARAMS, 'Private files are not enabled for this authenticated scope.');
          const result = await privateFiles.call(context.fileScope, params.name, params.arguments ?? {});
          return done({ content: [{ type: 'text', text: JSON.stringify(result) }] });
        }
        return done(await callTool(params.name, params.arguments ?? {}));
      }
      case 'resources/list':
        return done({ resources: RESOURCES });
      case 'resources/templates/list':
        return done({ resourceTemplates: RESOURCE_TEMPLATES });
      case 'resources/read': {
        const params = (req.params ?? {}) as { uri?: string };
        if (typeof params.uri !== 'string' || !params.uri) return fail(id, ERR.INVALID_PARAMS, 'resources/read requires a uri');
        if (params.uri.startsWith('lolly://files/')) {
          if (!context.fileScope) return fail(id, ERR.INVALID_PARAMS, 'Private files are not enabled for this authenticated scope.');
          return done({ contents: [await privateFiles.read(context.fileScope, params.uri)] });
        }
        return done({ contents: [await readResource(params.uri)] });
      }
      case 'prompts/list':
        return done({ prompts: await listPrompts() });
      case 'prompts/get': {
        const params = (req.params ?? {}) as { name?: string; arguments?: Record<string, string> };
        if (typeof params.name !== 'string' || !params.name) return fail(id, ERR.INVALID_PARAMS, 'prompts/get requires a name');
        if (params.arguments !== undefined && (!object(params.arguments) || Object.values(params.arguments).some(value => typeof value !== 'string'))) return fail(id, ERR.INVALID_PARAMS, 'Prompt arguments must be strings');
        const prompt = await getPrompt(params.name, params.arguments ?? {});
        if (!prompt) return fail(id, ERR.INVALID_PARAMS, `Unknown prompt: ${params.name}`);
        return done(prompt);
      }
      default:
        return fail(id, ERR.METHOD_NOT_FOUND, `Method not found: ${req.method}`);
    }
  } catch (e) {
    const message = (e as Error).message;
    const missingResource = req.method === 'resources/read' && (e instanceof URIError || /^(Unknown (resource|asset)|Tool not found|Resource not found|File handle not found|Invalid file resource URI)/.test(message));
    return fail(id, missingResource ? ERR.INVALID_PARAMS : ERR.INTERNAL, message);
  }
}
