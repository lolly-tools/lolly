// SPDX-License-Identifier: MPL-2.0
/**
 * MCP request dispatch - transport-agnostic. Both the stdio (bin/lolly-mcp.ts)
 * and Streamable-HTTP (http.ts) transports funnel JSON-RPC messages through
 * dispatch(). Returns null for notifications (no response expected).
 */

import { ok, fail, ERR } from './protocol.ts';
import type { JsonRpcRequest, JsonRpcResponse } from './protocol.ts';
import { TOOL_DEFS, callTool, serverInstructions, listPrompts, getPrompt } from './tools.ts';
import { RESOURCES, RESOURCE_TEMPLATES, readResource } from './resources.ts';
import { PRIVATE_FILE_TOOLS, privateFiles } from './file-resources.ts';

export const PROTOCOL_VERSION = '2025-06-18';
export const SERVER_INFO = { name: 'lolly-mcp', version: '0.1.0' } as const;

export async function dispatch(req: JsonRpcRequest, context: { fileScope?: string } = {}): Promise<JsonRpcResponse | null> {
  const isNotification = req.id === undefined;
  const id = req.id ?? null;
  try {
    switch (req.method) {
      case 'initialize': {
        const params = (req.params ?? {}) as { protocolVersion?: string };
        return ok(id, {
          protocolVersion: params.protocolVersion || PROTOCOL_VERSION,
          capabilities: { tools: {}, resources: {}, prompts: {} },
          serverInfo: SERVER_INFO,
          instructions: await serverInstructions(),
        });
      }
      case 'notifications/initialized':
      case 'notifications/cancelled':
        return null;
      case 'ping':
        return ok(id, {});
      case 'tools/list':
        return ok(id, { tools: [...TOOL_DEFS, ...(context.fileScope ? PRIVATE_FILE_TOOLS : [])] });
      case 'tools/call': {
        const params = (req.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
        if (!params.name) return fail(id, ERR.INVALID_PARAMS, 'tools/call requires a name');
        if (params.name.startsWith('files_')) {
          if (!context.fileScope) return fail(id, ERR.INVALID_PARAMS, 'Private files are not enabled for this authenticated scope.');
          const result = await privateFiles.call(context.fileScope, params.name, params.arguments ?? {});
          return ok(id, { content: [{ type: 'text', text: JSON.stringify(result) }] });
        }
        return ok(id, await callTool(params.name, params.arguments ?? {}));
      }
      case 'resources/list':
        return ok(id, { resources: RESOURCES });
      case 'resources/templates/list':
        return ok(id, { resourceTemplates: RESOURCE_TEMPLATES });
      case 'resources/read': {
        const params = (req.params ?? {}) as { uri?: string };
        if (!params.uri) return fail(id, ERR.INVALID_PARAMS, 'resources/read requires a uri');
        if (params.uri.startsWith('lolly://files/')) {
          if (!context.fileScope) return fail(id, ERR.INVALID_PARAMS, 'Private files are not enabled for this authenticated scope.');
          return ok(id, { contents: [await privateFiles.read(context.fileScope, params.uri)] });
        }
        return ok(id, { contents: [await readResource(params.uri)] });
      }
      case 'prompts/list':
        return ok(id, { prompts: await listPrompts() });
      case 'prompts/get': {
        const params = (req.params ?? {}) as { name?: string; arguments?: Record<string, string> };
        if (!params.name) return fail(id, ERR.INVALID_PARAMS, 'prompts/get requires a name');
        const prompt = await getPrompt(params.name, params.arguments ?? {});
        if (!prompt) return fail(id, ERR.INVALID_PARAMS, `Unknown prompt: ${params.name}`);
        return ok(id, prompt);
      }
      default:
        if (isNotification) return null;
        return fail(id, ERR.METHOD_NOT_FOUND, `Method not found: ${req.method}`);
    }
  } catch (e) {
    if (isNotification) return null;
    return fail(id, ERR.INTERNAL, (e as Error).message);
  }
}
