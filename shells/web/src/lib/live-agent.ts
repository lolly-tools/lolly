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
  type LiveDocumentV1, type LiveReplyV1, type LiveAdapterV1, type LiveCapabilitiesV1, type LiveInputStateV1,
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
  toolVersion?: string;
  adapter?: LiveAdapterV1;
  engine: string;
  surface: 'desktop' | 'web';
  rows(): unknown[];
  inputs?(): LiveInputStateV1;
  /** Private revision material can fingerprint omitted binary values. */
  revisionInputs?(): unknown;
  validateInputs?(values: Record<string, unknown>): string[] | Promise<string[]>;
  commitInputs?(values: Record<string, unknown>, note: string, client?: string): Promise<{ entry: object | null; admittedInputs: unknown }>;
  /** Canonical page definitions, including empty pages. */
  pages?(): readonly unknown[] | undefined;
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
  canLook?(): boolean;
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
export function documentRevision(rows: unknown[], width: number, height: number, inputValues?: unknown): string {
  const text = `${width}x${height}:${JSON.stringify(rows)}${inputValues === undefined ? '' : `:${JSON.stringify(inputValues)}`}`;
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
  const inputRevision = () => editor.revisionInputs?.() ?? editor.inputs?.().inputValues;
  const capabilities = (): LiveCapabilitiesV1 => {
    const edit = !paused && !editor.readOnly?.();
    const layers = editor.adapter !== 'inputs';
    return { read: true, edit, inputValues: edit && !!editor.commitInputs && !!editor.inputs?.().editableInputIds.length, layerOperations: edit && layers, layerPatches: edit && layers, find: layers, look: editor.canLook?.() ?? true, undo: edit, artboardAlternatives: layers, authoring: layers ? ['$in', '$style', '$stack', '$grid', '$table'] : [] };
  };
  const metadata = () => editor.adapter ? { tool: editor.tool, ...(editor.toolVersion ? { toolVersion: editor.toolVersion } : {}), adapter: editor.adapter, mode: capabilities().edit ? 'edit' as const : 'read' as const, capabilities: capabilities() } : {};
  const revision = (): string => {
    const { width, height } = editor.size();
    return documentRevision(editor.rows(), width, height, inputRevision());
  };
  const documentNow = (): LiveDocumentV1 => {
    const { width, height } = editor.size();
    const rows = editor.rows();
    return { documentId, rows, width, height, selection: editor.selection(), ...metadata(), ...editor.inputs?.(), revision: documentRevision(rows, width, height, inputRevision()) };
  };

  async function apply(id: number | string, params: Record<string, unknown>): Promise<LiveReplyV1> {
    const extra = Object.keys(params).find((k) => !['layerOperations', 'layerPatches', 'inputValues', 'label', 'ifRevision', 'documentId', 'transactionId'].includes(k));
    if (extra) return liveError(id, LIVE_ERRORS.invalidParams, `Unknown field "${extra}".`);
    const ops = params.layerOperations, patches = params.layerPatches;
    const values = params.inputValues;
    if (values !== undefined && (!values || typeof values !== 'object' || Array.isArray(values))) return liveError(id, LIVE_ERRORS.invalidParams, 'inputValues must be an object.');
    if (values !== undefined && (ops !== undefined || patches !== undefined)) return liveError(id, LIVE_ERRORS.invalidParams, 'Use inputValues or layer edits in one apply, not both.');
    if (values !== undefined && (!editor.commitInputs || !editor.validateInputs || !editor.inputs)) return liveError(id, LIVE_ERRORS.refused, 'This editor does not support inputValues.');
    if (editor.adapter === 'inputs' && (ops !== undefined || patches !== undefined)) return liveError(id, LIVE_ERRORS.refused, 'This tool uses inputValues rather than layer edits.');
    if (ops !== undefined && !Array.isArray(ops)) return liveError(id, LIVE_ERRORS.invalidParams, 'layerOperations must be an array.');
    if (patches !== undefined && !Array.isArray(patches)) return liveError(id, LIVE_ERRORS.invalidParams, 'layerPatches must be an array.');
    const count = values === undefined ? (ops?.length ?? 0) + (patches?.length ?? 0) : Object.keys(values).length;
    if (!count) return liveError(id, LIVE_ERRORS.invalidParams, 'Give inputValues, layerOperations or layerPatches.');
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
    if (values !== undefined) {
      const beforeRevision = revision();
      const before = editor.rows(), size = editor.size();
      let problems: string[];
      try { problems = await editor.validateInputs!(values as Record<string, unknown>); }
      catch (error) { return liveError(id, LIVE_ERRORS.refused, error instanceof Error ? error.message : String(error)); }
      if (closed || paused || editor.readOnly?.()) return liveError(id, LIVE_ERRORS.refused, 'This agent can no longer change the document.');
      if (revision() !== beforeRevision) return liveError(id, LIVE_ERRORS.refused, 'The document changed while checking inputs. Read it again with document.get.');
      if (problems.length) return liveError(id, LIVE_ERRORS.refused, `${problems.slice(0, 5).join('; ')}. Nothing was changed.`);
      const editable = new Set(editor.inputs!().editableInputIds);
      const unavailable = Object.keys(values).find(key => !editable.has(key));
      if (unavailable) return liveError(id, LIVE_ERRORS.refused, `/${unavailable}: this input is not available for live editing.`);
      applies.push(t);
      const note = cleanNote(params.label) || `${count} input change${count === 1 ? '' : 's'}`;
      let outcome: Awaited<ReturnType<NonNullable<LiveEditor['commitInputs']>>>;
      try { outcome = await editor.commitInputs!(values as Record<string, unknown>, note, clientName); }
      catch (error) { return liveError(id, LIVE_ERRORS.refused, error instanceof Error ? error.message : String(error)); }
      if (outcome.entry) { mine.add(outcome.entry); activity({ method: 'document.apply', note, client: clientName }); }
      const result = { documentId, changed: !!outcome.entry, revision: documentRevision(before, size.width, size.height, outcome.admittedInputs), currentRevision: revision(), layers: editor.rows().length, changedIds: [], changedInputIds: Object.keys(values), label: note, ...(transactionId ? { transactionId } : {}) };
      if (transactionId) { transactions.add(transactionId); receipts.set(transactionId, { key, result }); if (receipts.size > 128) receipts.delete(receipts.keys().next().value!); }
      return liveResult(id, result);
    }
    let rows: unknown[];
    const before = editor.rows();
    const size = editor.size();
    const beforeInputs = inputRevision();
    const pages = editor.pages?.();
    try {
      rows = before;
      // Authoring keys use the design system currently rendering this editor.
      const authored = hasDesignAuthoring(ops) || hasDesignAuthoring(patches);
      if (ops) {
        rows = authored
          ? applyAuthoredLayerOperations(rows as Record<string, unknown>[], ops, (field, fallback) => editor.fieldDefault(field, fallback), { brief: context?.brief ?? null, pages }).rows
          : applyLayerOperations(rows, ops, (field, fallback) => editor.fieldDefault(field, fallback), { pages });
      }
      if (patches) rows = authored ? applyAuthoredLayerPatches(rows as Record<string, unknown>[], patches, { brief: context?.brief ?? null, pages }).rows : applyLayerPatches(rows, patches, { pages });
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
      if (revision() !== documentRevision(before, size.width, size.height, beforeInputs)) return liveError(id, LIVE_ERRORS.refused, 'The document changed while preparing assets. Read it again with document.get.');
    }
    applies.push(t);
    const note = cleanNote(params.label) || `${count} change${count === 1 ? '' : 's'}`;
    let entry: object | null;
    let admittedInputs: unknown;
    try {
      const pending = editor.commit(rows, note, clientName);
      admittedInputs = inputRevision();
      entry = await pending;
    } catch (error) {
      return liveError(id, LIVE_ERRORS.refused, error instanceof Error ? error.message : String(error));
    }
    if (entry) mine.add(entry);
    const change = liveAgentChange(before, rows, size, globalThis.crypto.randomUUID(), note);
    if (entry) activity({ method: 'document.apply', note, client: clientName, change });
    const nextIds = new Set(rows.map(rowId));
    const changedIds = [...changedRows(before, rows).map(rowId), ...before.filter(row => !nextIds.has(rowId(row))).map(rowId)].filter(id => typeof id === 'string');
    const result = { documentId, changed: !!entry, revision: documentRevision(rows, size.width, size.height, admittedInputs), currentRevision: revision(), layers: rows.length, changedIds, label: note, ...(transactionId ? { transactionId } : {}) };
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
      return liveResult(id, { protocol: LIVE_PROTOCOL, tool: editor.tool, engine: editor.engine, surface: editor.surface, documentId, ...metadata() });
    }
    if (!ready) return liveError(id, LIVE_ERRORS.notReady, 'Send hello first.');
    if (params.documentId !== undefined && params.documentId !== documentId) return liveError(id, LIVE_ERRORS.refused, 'This connection belongs to a different document. Connect again using its invitation.');
    switch (method) {
      case 'document.get':
      case 'document.find': {
        if (editor.adapter === 'inputs') {
          if (method === 'document.find') return liveError(id, LIVE_ERRORS.refused, 'This tool has inputs rather than layers. Read inputSchema and inputValues with document.get.');
          const extra = Object.keys(params).find(key => key !== 'documentId');
          if (extra) return liveError(id, LIVE_ERRORS.invalidParams, `Unknown field "${extra}" for an input document.`);
          return liveResult(id, documentNow());
        }
        try { const doc = documentNow(); return liveResult(id, { ...doc, ...queryLiveRows(doc.rows, params, doc.selection, method === 'document.find') }); }
        catch (error) { return liveError(id, LIVE_ERRORS.invalidParams, error instanceof Error ? error.message : String(error)); }
      }
      case 'document.context': {
        const extra = Object.keys(params).find(key => key !== 'documentId');
        if (extra) return liveError(id, LIVE_ERRORS.invalidParams, `Unknown field "${extra}".`);
        const context = await editor.context?.();
        if (closed) return liveError(id, LIVE_ERRORS.notReady, 'The person disconnected this agent.');
        return liveResult(id, { ...context, ...metadata(), ...editor.inputs?.(), documentId, tool: editor.tool, revision: revision(), selection: editor.selection(), size: editor.size(), capabilities: capabilities() });
      }
      case 'document.apply':
        return apply(id, params);
      case 'look': {
        if (editor.canLook?.() === false) return liveError(id, LIVE_ERRORS.refused, 'This tool does not support a live SVG preview.');
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
        activity({ method, client: clientName, ...(editor.adapter === 'inputs' ? {} : { change: liveAgentChange(before, editor.rows(), editor.size(), globalThis.crypto.randomUUID(), 'Undo last change') }) });
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
