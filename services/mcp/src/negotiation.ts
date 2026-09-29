// SPDX-License-Identifier: MPL-2.0
/** Per-request negotiation and HTTP mirrors for MCP 2026-07-28. */
import { ERR, fail, type JsonRpcRequest, type JsonRpcResponse } from './protocol.ts';

export const PROTOCOL_VERSION = '2026-07-28';
export const LEGACY_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26'];
export const SUPPORTED_VERSIONS = [PROTOCOL_VERSION, ...LEGACY_VERSIONS];
export const VERSION_META = 'io.modelcontextprotocol/protocolVersion';
export const CAPABILITIES_META = 'io.modelcontextprotocol/clientCapabilities';
export const SERVER_INFO = { name: 'lolly-mcp', version: '0.2.0' } as const;
export const CAPABILITIES = { tools: {}, resources: {}, prompts: {} };
export const object = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

export function validRequest(value: unknown): value is JsonRpcRequest {
  return object(value) && value.jsonrpc === '2.0' && typeof value.method === 'string' && !!value.method
    && (value.id === undefined || typeof value.id === 'string' || (typeof value.id === 'number' && Number.isFinite(value.id)));
}
export function requestVersion(req: JsonRpcRequest): unknown {
  return object(req.params) && object(req.params._meta) ? req.params._meta[VERSION_META] : undefined;
}
export function modernRequest(req: JsonRpcRequest, header?: string): boolean {
  return req.method === 'server/discover' || requestVersion(req) === PROTOCOL_VERSION || header === PROTOCOL_VERSION;
}
export function unsupportedVersion(req: JsonRpcRequest, version: string): JsonRpcResponse {
  return fail(req.id ?? null, ERR.UNSUPPORTED_VERSION, 'Unsupported MCP protocol version', { supported: SUPPORTED_VERSIONS, requested: version });
}
export function validateNegotiation(req: JsonRpcRequest, header?: string): JsonRpcResponse | null {
  const id = req.id ?? null;
  if (req.params !== undefined && !object(req.params)) return fail(id, ERR.INVALID_PARAMS, 'params must be an object');
  if (object(req.params) && req.params._meta !== undefined && !object(req.params._meta)) return fail(id, ERR.INVALID_PARAMS, '_meta must be an object');
  const version = requestVersion(req);
  if (version !== undefined && typeof version !== 'string') return fail(id, ERR.INVALID_PARAMS, 'Protocol version metadata must be a string');
  if (typeof version === 'string' && !SUPPORTED_VERSIONS.includes(version)) return unsupportedVersion(req, version);
  if (header && !SUPPORTED_VERSIONS.includes(header)) return unsupportedVersion(req, header);
  if (modernRequest(req, header)) {
    if (version !== PROTOCOL_VERSION) return fail(id, ERR.INVALID_PARAMS, `Request _meta must include ${VERSION_META}`);
    const meta = object(req.params) && object(req.params._meta) ? req.params._meta : {};
    if (!object(meta[CAPABILITIES_META])) return fail(id, ERR.INVALID_PARAMS, `Request _meta must include an object ${CAPABILITIES_META}`);
  }
  return null;
}

function decodedHeader(value: string | string[] | undefined): string | undefined {
  if (typeof value !== 'string' || !/^[\x20-\x7e\t]*$/.test(value) || value.trim() !== value) return undefined;
  if (!value.startsWith('=?base64?') || !value.endsWith('?=')) return value;
  const raw = value.slice(9, -2);
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(raw)) return undefined;
  try { return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(raw, 'base64')); } catch { return undefined; }
}
/** Legacy headers remain optional; modern mirrors are checked before dispatch. */
export function validateHttpHeaders(req: JsonRpcRequest, headers: Record<string, string | string[] | undefined>): JsonRpcResponse | null {
  const header = headers['mcp-protocol-version'];
  const version = requestVersion(req), modern = modernRequest(req, typeof header === 'string' ? header : undefined);
  const mismatch = (name: string) => fail(req.id ?? null, ERR.HEADER_MISMATCH, `Missing or mismatched ${name} header`);
  if (Array.isArray(header)) return mismatch('MCP-Protocol-Version');
  if ((modern || version !== undefined) && (header === undefined || header !== version)) return mismatch('MCP-Protocol-Version');
  if (header && !SUPPORTED_VERSIONS.includes(header)) return unsupportedVersion(req, header);
  if (!modern) return null;
  if (headers['mcp-method'] !== req.method) return mismatch('Mcp-Method');
  const params = object(req.params) ? req.params : {};
  const expected = req.method === 'resources/read' ? params.uri : ['tools/call', 'prompts/get'].includes(req.method) ? params.name : undefined;
  if (['resources/read', 'tools/call', 'prompts/get'].includes(req.method) && (typeof expected !== 'string' || decodedHeader(headers['mcp-name']) !== expected)) return mismatch('Mcp-Name');
  return null;
}

export function allowedOrigin(origin: string | string[] | undefined, canonical: string | null, extra = ''): boolean {
  if (origin === undefined) return true;
  if (typeof origin !== 'string') return false;
  try {
    const url = new URL(origin);
    return ['https:', 'http:'].includes(url.protocol) && url.origin === origin
      && [canonical, ...extra.split(',').map(value => value.trim()).filter(Boolean)].includes(origin);
  } catch { return false; }
}
