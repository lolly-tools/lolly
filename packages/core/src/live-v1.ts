// SPDX-License-Identifier: MPL-2.0
/**
 * `live-v1`: an agent working in a running Design editor (plans/289 D1, section
 * 6.2.1). The same verbs whether the editor is the desktop app or a browser tab;
 * only the transport differs (the app's loopback listener, or a paired WebSocket).
 *
 * Messages are JSON-RPC 2.0 shaped: a request `{ jsonrpc, id, method, params }`, a
 * reply `{ jsonrpc, id, result }` or `{ jsonrpc, id, error: { code, message } }`.
 * Nothing but `hello` is answered until `hello` has succeeded.
 *
 * What an agent can do is exactly the verbs below: read the open document, apply
 * layer operations and patches (one labelled, undoable history entry each), look
 * at the current render, and undo its own newest edit. No files, no export to a
 * path, no navigation, no settings, no network, and no tool or hook ever sees the
 * channel.
 */

export const LIVE_PROTOCOL = 'live-v1' as const;

export const LIVE_METHODS = ['hello', 'document.get', 'document.find', 'document.context', 'document.apply', 'look', 'history.undo'] as const;
export type LiveMethodV1 = (typeof LIVE_METHODS)[number];

/** Limits both ends hold to. */
export const LIVE_LIMITS = {
  /** Largest request frame, in bytes. */
  maxRequestBytes: 4 * 1024 * 1024,
  /** Largest reply frame, in bytes (a `look` SVG with embedded pictures). */
  maxReplyBytes: 16 * 1024 * 1024,
  /** Operations plus patches in one `document.apply`. */
  maxEditsPerApply: 500,
  /** `document.apply` calls a second, averaged over a few seconds. */
  maxAppliesPerSecond: 10,
  /** A connection with no request for this long is closed. */
  idleMs: 30 * 60 * 1000,
  /** Wrong pairing codes before a web bridge stops listening. */
  maxCodeAttempts: 3,
} as const;

export const LIVE_ERRORS = {
  /** Not JSON, not an object, or a field of the wrong type. */
  badRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  /** A request before `hello`, or after the person disconnected. */
  notReady: -32001,
  /** The editor refused the edit (an unknown layer id, a broken rule); the message says why. */
  refused: -32002,
  /** Too many edits, too large a frame, or too fast. */
  limit: -32003,
  /** `history.undo` when the newest change is not the agent's. */
  notYours: -32004,
} as const;

export interface LiveRequestV1 {
  jsonrpc: '2.0';
  id: number | string;
  method: LiveMethodV1;
  params?: Record<string, unknown>;
}

export interface LiveReplyV1 {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

export interface LiveHelloResultV1 {
  protocol: typeof LIVE_PROTOCOL;
  /** The tool open in the editor; `design` is the one that takes edits today. */
  tool: string;
  /** The engine version of the editor. */
  engine: string;
  /** Which surface answered. */
  surface: 'desktop' | 'web';
  documentId?: string;
}

export interface LiveDocumentV1 {
  documentId?: string;
  /** The Design rows, as `layerOperations` and `layerPatches` address them. */
  rows: unknown[];
  width: number;
  height: number;
  /** Selected layer ids, in the editor's order. */
  selection: string[];
  /** Changes whenever the document changes, so an agent can tell a stale read. */
  revision: string;
}

export interface LiveApplyParamsV1 {
  documentId?: string;
  /** Repeating this transaction returns its first receipt without another edit. */
  transactionId?: string;
  layerOperations?: unknown[];
  layerPatches?: unknown[];
  /** A short note for the history entry, after "AI agent: ". */
  label?: string;
  /** Refuse the edit unless the document is still at this revision. */
  ifRevision?: string;
}

export interface LiveLookResultV1 {
  /** The current render as SVG, in document units. */
  svg: string;
  width: number;
  height: number;
}

/** A request read from untrusted bytes, or the reply that refuses the bytes. */
export function parseLiveRequest(text: string): { ok: true; request: LiveRequestV1 } | { ok: false; reply: LiveReplyV1 } {
  const refuse = (code: number, message: string, id: LiveReplyV1['id'] = null) =>
    ({ ok: false as const, reply: { jsonrpc: '2.0' as const, id, error: { code, message } } });
  if (text.length > LIVE_LIMITS.maxRequestBytes) return refuse(LIVE_ERRORS.limit, 'The request is too large.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { return refuse(LIVE_ERRORS.badRequest, 'The request is not JSON.'); }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return refuse(LIVE_ERRORS.badRequest, 'The request must be an object.');
  const r = value as Record<string, unknown>;
  const id = typeof r.id === 'number' || typeof r.id === 'string' ? r.id : null;
  if (r.jsonrpc !== '2.0' || id === null) return refuse(LIVE_ERRORS.badRequest, 'The request needs jsonrpc "2.0" and an id.', id);
  if (typeof r.method !== 'string' || !(LIVE_METHODS as readonly string[]).includes(r.method)) {
    return refuse(LIVE_ERRORS.methodNotFound, `Unknown method. The methods are ${LIVE_METHODS.join(', ')}.`, id);
  }
  if (r.params !== undefined && (!r.params || typeof r.params !== 'object' || Array.isArray(r.params))) {
    return refuse(LIVE_ERRORS.invalidParams, 'params must be an object.', id);
  }
  return { ok: true, request: { jsonrpc: '2.0', id, method: r.method as LiveMethodV1, ...(r.params ? { params: r.params as Record<string, unknown> } : {}) } };
}

/** A success reply. */
export const liveResult = (id: LiveRequestV1['id'], result: unknown): LiveReplyV1 => ({ jsonrpc: '2.0', id, result });

/** An error reply. */
export const liveError = (id: LiveReplyV1['id'], code: number, message: string): LiveReplyV1 => ({ jsonrpc: '2.0', id, error: { code, message } });
