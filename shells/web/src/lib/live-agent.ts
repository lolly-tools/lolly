// SPDX-License-Identifier: MPL-2.0
/**
 * The editor end of `live-v1` (plans/289 D1): one connected agent working in the open
 * Design document. The transport (a paired WebSocket in a browser tab, the desktop
 * app's loopback listener) hands each frame to `handle` and sends back what it
 * returns; everything an agent can do is decided here, so both surfaces answer the
 * same way.
 *
 * Every edit is an ordinary history entry with the agent's note in its label, and
 * `history.undo` takes back only an entry this session made: the agent can never
 * undo the person's own work.
 */

import {
  LIVE_ERRORS, LIVE_LIMITS, LIVE_PROTOCOL, liveError, liveResult, parseLiveRequest,
  type LiveDocumentV1, type LiveReplyV1,
} from '@lolly-tools/core';
import { applyLayerOperations, applyLayerPatches } from '../../../../engine/src/design-layer-ops.ts';
import { applyAuthoredLayerOperations, applyAuthoredLayerPatches, hasDesignAuthoring } from '../../../../engine/src/design-authoring.ts';
import { liveAgentChange } from './live-agent-changes.ts';
import type { AgentChange } from '@lolly-tools/core/agent-presence-v1';
import { livePayloadDigest, queryLiveRows, scheduleLive } from './live-agent-query.ts';

/** What the session needs from the open editor. */
export interface LiveEditor {
  documentId?: string;
  /** All connections to this runtime use the same request queue. */
  owner?: object;
  context?(): Promise<{ brief?: unknown; [key: string]: unknown }>;
  tool: string;
  engine: string;
  surface: 'desktop' | 'web';
  rows(): unknown[];
  size(): { width: number; height: number };
  selection(): string[];
  /** A new layer's field default, from the manifest. */
  fieldDefault(id: string, fallback: unknown): unknown;
  /** Resolve new asset references before recording the edit. */
  prepareRows?(rows: unknown[], before: unknown[]): Promise<unknown[]>;
  /** Write the rows as one history entry carrying the note; resolves to that entry, or null when nothing changed. */
  commit(rows: unknown[], note: string, client?: string): Promise<object | null>;
  /** The newest undo entry, compared by identity. */
  topEntry(): object | null;
  undo(): void;
  /** The current render as SVG. */
  look(): Promise<{ svg: string; width: number; height: number }>;
  /** True when the document cannot take edits (a read-only collab view). */
  readOnly?(): boolean;
  /** Problems with these rows (the ones an apply added or changed), each naming its layer. */
  validate?(rows: unknown[]): string[];
}

const rowId = (row: unknown): unknown => (row && typeof row === 'object' ? (row as { id?: unknown }).id : undefined);

/** The rows an edit added or changed, compared with the rows before it by id. */
export function changedRows(before: unknown[], after: unknown[]): unknown[] {
  const was = new Map<unknown, string>();
  for (const row of before) { const id = rowId(row); if (id !== undefined) was.set(id, JSON.stringify(row)); }
  return after.filter((row) => { const id = rowId(row); return id === undefined || was.get(id) !== JSON.stringify(row); });
}

export interface LiveSessionOpts {
  now?: () => number;
  /** Fired after each request that succeeded, for the connected pill. */
  onActivity?(event: { method: string; note?: string; client: string; change?: AgentChange }): void;
}

export interface LiveSession {
  /** One frame in, one reply out (already JSON). */
  handle(text: string): Promise<string>;
  /** The client name `hello` gave, or '' before any hello. */
  client(): string;
  /** Milliseconds since the last frame, for the transport's idle timeout. */
  idleFor(): number;
  /** True once `hello` has succeeded and the session is not closed. */
  connected(): boolean;
  pause(paused: boolean): void;
  paused(): boolean;
  close(): void;
}

const APPLY_WINDOW_MS = 3000;
const NOTE_MAX = 80;

/** Control characters out, whitespace folded, length capped: a note is shown in the history list as plain text. */
export function cleanNote(value: unknown, max = NOTE_MAX): string {
  if (typeof value !== 'string') return '';
  let spaced = '';
  for (const ch of value) {
    const c = ch.codePointAt(0) ?? 0;
    spaced += c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x2028 || c === 0x2029 ? ' ' : ch;
  }
  const flat = spaced.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** A short fingerprint of the document, so an agent can tell its read is stale. */
export function documentRevision(rows: unknown[], width: number, height: number): string {
  const text = `${width}x${height}:${JSON.stringify(rows)}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `r${(h >>> 0).toString(16).padStart(8, '0')}${text.length.toString(36)}`;
}

export function createLiveSession(editor: LiveEditor, opts: LiveSessionOpts = {}): LiveSession {
  const now = opts.now ?? (() => Date.now());
  const mine = new WeakSet<object>();
  const applies: number[] = [];
  let clientName = '';
  let ready = false;
  let closed = false;
  let paused = false;
  let last = now();
  const documentId = editor.documentId ?? `doc:${globalThis.crypto.randomUUID()}`;
  const receipts = new Map<string, { key: string; result: unknown }>();
  const transactions = new Set<string>();
  const activity = (event: Parameters<NonNullable<LiveSessionOpts['onActivity']>>[0]): void => {
    try { opts.onActivity?.(event); } catch (error) { console.warn('[lolly:agent] presence update', error); }
  };

  const encode = (reply: LiveReplyV1): string => {
    const text = JSON.stringify(reply);
    if (text.length <= LIVE_LIMITS.maxReplyBytes) return text;
    return JSON.stringify(liveError(reply.id, LIVE_ERRORS.limit, 'The reply is larger than the 16 MB limit.'));
  };
  const revision = (): string => {
    const { width, height } = editor.size();
    return documentRevision(editor.rows(), width, height);
  };
  const documentNow = (): LiveDocumentV1 => {
    const { width, height } = editor.size();
    const rows = editor.rows();
    return { documentId, rows, width, height, selection: editor.selection(), revision: documentRevision(rows, width, height) };
  };

  async function apply(id: number | string, params: Record<string, unknown>): Promise<LiveReplyV1> {
    const extra = Object.keys(params).find((k) => !['layerOperations', 'layerPatches', 'label', 'ifRevision', 'documentId', 'transactionId'].includes(k));
    if (extra) return liveError(id, LIVE_ERRORS.invalidParams, `Unknown field "${extra}".`);
    const ops = params.layerOperations, patches = params.layerPatches;
    if (ops !== undefined && !Array.isArray(ops)) return liveError(id, LIVE_ERRORS.invalidParams, 'layerOperations must be an array.');
    if (patches !== undefined && !Array.isArray(patches)) return liveError(id, LIVE_ERRORS.invalidParams, 'layerPatches must be an array.');
    const count = (ops?.length ?? 0) + (patches?.length ?? 0);
    if (!count) return liveError(id, LIVE_ERRORS.invalidParams, 'Give layerOperations, layerPatches or both.');
    if (count > LIVE_LIMITS.maxEditsPerApply) return liveError(id, LIVE_ERRORS.limit, `At most ${LIVE_LIMITS.maxEditsPerApply} operations and patches in one apply.`);
    if (params.ifRevision !== undefined && typeof params.ifRevision !== 'string') return liveError(id, LIVE_ERRORS.invalidParams, 'ifRevision must be a string.');
    if (params.transactionId !== undefined && (typeof params.transactionId !== 'string' || !params.transactionId || params.transactionId.length > 128)) return liveError(id, LIVE_ERRORS.invalidParams, 'transactionId must be a nonempty string of at most 128 characters.');
    const transactionId = params.transactionId as string | undefined;
    const key = transactionId ? await livePayloadDigest(params) : '';
    const receipt = transactionId ? receipts.get(transactionId) : undefined;
    if (receipt) return receipt.key === key ? liveResult(id, { ...receipt.result as object, replayed: true }) : liveError(id, LIVE_ERRORS.refused, 'That transactionId already identifies a different edit.');
    if (transactionId && transactions.has(transactionId)) return liveError(id, LIVE_ERRORS.refused, 'That transaction receipt has expired. Read the document before starting another transaction.');
    if (transactionId && transactions.size >= 4096) return liveError(id, LIVE_ERRORS.limit, 'This connection has recorded 4096 transactions. Start a new connection to make more edits.');
    if (editor.readOnly?.()) return liveError(id, LIVE_ERRORS.refused, 'This document is read-only.');
    if (paused) return liveError(id, LIVE_ERRORS.refused, 'The person paused this agent. It can read, but cannot change the document.');
    const t = now();
    while (applies.length && t - applies[0]! > APPLY_WINDOW_MS) applies.shift();
    if (applies.length >= LIVE_LIMITS.maxAppliesPerSecond * (APPLY_WINDOW_MS / 1000)) {
      return liveError(id, LIVE_ERRORS.limit, `At most ${LIVE_LIMITS.maxAppliesPerSecond} applies a second.`);
    }
    // Context can read storage. Check the revision and authority after that await.
    const context = await editor.context?.();
    if (closed || paused || editor.readOnly?.()) return liveError(id, LIVE_ERRORS.refused, 'This agent can no longer change the document.');
    if (params.ifRevision !== undefined && params.ifRevision !== revision()) {
      return liveError(id, LIVE_ERRORS.refused, 'The document changed since that revision. Read it again with document.get.');
    }
    let rows: unknown[];
    const before = editor.rows();
    const size = editor.size();
    try {
      rows = before;
      // Authoring keys use the design system currently rendering this editor.
      const authored = hasDesignAuthoring(ops) || hasDesignAuthoring(patches);
      if (ops) {
        rows = authored
          ? applyAuthoredLayerOperations(rows as Record<string, unknown>[], ops, (field, fallback) => editor.fieldDefault(field, fallback), { brief: context?.brief ?? null }).rows
          : applyLayerOperations(rows, ops, (field, fallback) => editor.fieldDefault(field, fallback));
      }
      if (patches) rows = authored ? applyAuthoredLayerPatches(rows as Record<string, unknown>[], patches, { brief: context?.brief ?? null }).rows : applyLayerPatches(rows, patches);
    } catch (error) {
      return liveError(id, LIVE_ERRORS.refused, error instanceof Error ? error.message : String(error));
    }
    // Only what this edit touched is checked, so a document that already held an odd
    // row can still be edited; nothing is written when a touched row is wrong.
    const problems = editor.validate?.(changedRows(before, rows)) ?? [];
    if (problems.length) {
      const more = problems.length > 5 ? ` (and ${problems.length - 5} more)` : '';
      return liveError(id, LIVE_ERRORS.refused, `${problems.slice(0, 5).join('; ')}${more}. Nothing was changed.`);
    }
    if (editor.prepareRows) {
      try { rows = await editor.prepareRows(rows, before); }
      catch (error) { return liveError(id, LIVE_ERRORS.refused, error instanceof Error ? error.message : String(error)); }
      if (closed || paused || editor.readOnly?.()) return liveError(id, LIVE_ERRORS.refused, 'This agent can no longer change the document.');
      if (revision() !== documentRevision(before, size.width, size.height)) return liveError(id, LIVE_ERRORS.refused, 'The document changed while preparing assets. Read it again with document.get.');
    }
    applies.push(t);
    const note = cleanNote(params.label) || `${count} change${count === 1 ? '' : 's'}`;
    let entry: object | null;
    try {
      entry = await editor.commit(rows, note, clientName);
    } catch (error) {
      return liveError(id, LIVE_ERRORS.refused, error instanceof Error ? error.message : String(error));
    }
    if (entry) mine.add(entry);
    const change = liveAgentChange(before, rows, size, globalThis.crypto.randomUUID(), note);
    if (entry) activity({ method: 'document.apply', note, client: clientName, change });
    const nextIds = new Set(rows.map(rowId));
    const changedIds = [...changedRows(before, rows).map(rowId), ...before.filter(row => !nextIds.has(rowId(row))).map(rowId)].filter(id => typeof id === 'string');
    const result = { documentId, changed: !!entry, revision: documentRevision(rows, size.width, size.height), currentRevision: revision(), layers: rows.length, changedIds, label: note, ...(transactionId ? { transactionId } : {}) };
    if (transactionId) { transactions.add(transactionId); receipts.set(transactionId, { key, result }); if (receipts.size > 128) receipts.delete(receipts.keys().next().value!); }
    return liveResult(id, result);
  }

  async function dispatch(text: string): Promise<LiveReplyV1> {
    const parsed = parseLiveRequest(text);
    if (!parsed.ok) return parsed.reply;
    const { id, method, params = {} } = parsed.request;
    if (closed) return liveError(id, LIVE_ERRORS.notReady, 'The person disconnected this agent.');
    if (method === 'hello') {
      if (params.protocol !== LIVE_PROTOCOL) return liveError(id, LIVE_ERRORS.invalidParams, `This editor speaks ${LIVE_PROTOCOL}.`);
      clientName = cleanNote(params.client, 60) || 'AI agent';
      ready = true;
      activity({ method, client: clientName });
      return liveResult(id, { protocol: LIVE_PROTOCOL, tool: editor.tool, engine: editor.engine, surface: editor.surface, documentId });
    }
    if (!ready) return liveError(id, LIVE_ERRORS.notReady, 'Send hello first.');
    if (params.documentId !== undefined && params.documentId !== documentId) return liveError(id, LIVE_ERRORS.refused, 'This connection belongs to a different document. Connect again using its invitation.');
    switch (method) {
      case 'document.get':
      case 'document.find': {
        try { const doc = documentNow(); return liveResult(id, { ...doc, ...queryLiveRows(doc.rows, params, doc.selection, method === 'document.find') }); }
        catch (error) { return liveError(id, LIVE_ERRORS.invalidParams, error instanceof Error ? error.message : String(error)); }
      }
      case 'document.context':
        return liveResult(id, { ...await editor.context?.(), documentId, tool: editor.tool, revision: revision(), selection: editor.selection(), size: editor.size(), capabilities: { read: true, edit: !paused && !editor.readOnly?.(), find: true, artboardAlternatives: true, authoring: ['$in', '$style', '$stack', '$grid', '$table'] } });
      case 'document.apply':
        return apply(id, params);
      case 'look': {
        let view: Awaited<ReturnType<LiveEditor['look']>>;
        try { view = await editor.look(); } catch (error) {
          return liveError(id, LIVE_ERRORS.refused, error instanceof Error ? error.message : String(error));
        }
        activity({ method, client: clientName });
        return liveResult(id, view);
      }
      case 'history.undo': {
        if (paused) return liveError(id, LIVE_ERRORS.refused, 'The person paused this agent. It can read, but cannot change the document.');
        const top = editor.topEntry();
        if (!top) return liveError(id, LIVE_ERRORS.notYours, 'There is nothing to undo.');
        if (!mine.has(top)) return liveError(id, LIVE_ERRORS.notYours, 'The newest change is not this agent\'s, so it stays.');
        if (editor.readOnly?.()) return liveError(id, LIVE_ERRORS.refused, 'This document is read-only.');
        const before = editor.rows();
        editor.undo();
        activity({ method, client: clientName, change: liveAgentChange(before, editor.rows(), editor.size(), globalThis.crypto.randomUUID(), 'Undo last change') });
        return liveResult(id, { undone: true, revision: revision() });
      }
      default:
        return liveError(id, LIVE_ERRORS.methodNotFound, 'Unknown method.');
    }
  }

  return {
    async handle(text) {
      last = now();
      try {
        if (text.length > LIVE_LIMITS.maxRequestBytes) return encode(liveError(null, LIVE_ERRORS.limit, 'The request is too large.'));
        return await scheduleLive(editor.owner ?? editor, async () => encode(await dispatch(text)));
      } catch (error) {
        return encode(liveError(null, LIVE_ERRORS.refused, error instanceof Error ? error.message : String(error)));
      }
    },
    client: () => clientName,
    idleFor: () => now() - last,
    connected: () => ready && !closed,
    pause(value) { paused = value; },
    paused: () => paused,
    close() { closed = true; },
  };
}
