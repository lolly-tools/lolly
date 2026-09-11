// SPDX-License-Identifier: MPL-2.0
/**
 * Minimal JSON-RPC 2.0 + MCP protocol types.
 *
 * We hand-roll the wire protocol (no SDK dependency) to keep this service
 * zero-new-deps, mirroring services/ca. The MCP methods we implement are a
 * subset - initialize, tools/*, resources/*, prompts/*, ping - dispatched in
 * server.ts. Adopting @modelcontextprotocol/sdk later (for SSE streaming /
 * session management) is a drop-in: the handlers are already pure functions of a
 * request. See plans/77-mcp-server.md.
 */

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  /** Absent for notifications (no response expected). May be 0 or '' for requests. */
  id?: string | number | null;
  method: string;
  params?: unknown;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: unknown;
  error?: JsonRpcError;
}

/** Standard JSON-RPC error codes. */
export const ERR = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
} as const;

export function ok(id: JsonRpcResponse['id'], result: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, result };
}

export function fail(id: JsonRpcResponse['id'], code: number, message: string, data?: unknown): JsonRpcResponse {
  return { jsonrpc: '2.0', id, error: { code, message, ...(data !== undefined ? { data } : {}) } };
}

/** An MCP content block (tool-call result / prompt message). */
export type ContentBlock =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; resource: { uri: string; mimeType?: string; text?: string; blob?: string } };

export interface ToolCallResult {
  content: ContentBlock[];
  isError?: boolean;
}
