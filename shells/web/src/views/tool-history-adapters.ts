// SPDX-License-Identifier: MPL-2.0
/**
 * Which tools keep automatic recovery and version history, read from the manifest
 * alone (plan 277 P4, section 2). There is no list of tool ids: a tool joins by what
 * it declares, and a new, sideloaded or user-made tool joins the same way. The one
 * way out by name is the reasoned exceptions map beside this file, which the
 * round-trip gate (scripts/tool-history-audit.ts) keeps honest and which only shrinks.
 *
 * The classes use the discriminators the code already acts on:
 *   A  document    no `file` input at any depth and no live device capability
 *   B  side-file   a `file` input at any depth, and the default action bar
 *   C  settings    a `file` input at any depth, and `render.actions: []`
 *   D  recording   a `camera`, `microphone` or `screen` capability
 * Classes A and B keep history. B's file inputs are recorded as not kept (historyRedact):
 * history and Save keep each file's name, type and size, never its bytes, and a reopened
 * document asks for the file again. C waits until its settings can be kept by the file's
 * fingerprint (it must never file a creation in Projects), and D until a capture can
 * pause checkpoints.
 */
import type { ToolManifest } from '../../../../engine/src/loader.ts';
import exceptionsFile from './tool-history-exceptions.json' with { type: 'json' };

export type HistoryClass = 'document' | 'side-file' | 'settings' | 'recording';
/** What this mount does with history. `settings` is reserved for class C and is not
 *  returned until that class can keep its settings without filing anything. */
export type HistoryMode = 'document' | 'settings' | 'none';

export interface HistoryParticipation {
  mode: HistoryMode;
  /** Recovery drafts and checkpoints are written for this document. */
  localHistory: boolean;
  /** Device activity (History's Recent list) is recorded; never for a shared mount. */
  recordDeviceActivity: boolean;
  /** Inputs whose values history never keeps: every `file` input, as its id, or
   *  `<blocks id>.<field id>` for one inside a blocks row. */
  notKept: string[];
}

/** The part of an input declaration the rule reads. Vector fields carry no type. */
interface InputLike { id: string; type?: string; fields?: readonly InputLike[] }
/** The part of a manifest the rule reads, so a script's parsed tool.json fits too. */
export type HistoryManifest = Pick<ToolManifest, 'id'> & {
  inputs?: readonly InputLike[];
  capabilities?: readonly string[];
  render?: { actions?: readonly unknown[] };
};

/** Live device input a capture reads. `compose`, `capture` (a page render) and
 *  `wasm` are not live input, so they do not select class D. */
const LIVE_DEVICE_CAPS: ReadonlySet<string> = new Set(['camera', 'microphone', 'screen']);
/** The input types history keeps. A `file` input is kept as a record that it was not
 *  kept (historyRedact), so it is in the list. */
const DURABLE_TYPES: ReadonlySet<string> = new Set(['text', 'longtext', 'number', 'boolean', 'color', 'select', 'asset', 'date', 'time', 'datetime-local', 'url', 'vector', 'table', 'blocks', 'file']);
/** The longest file name a not-kept record keeps. */
const MAX_NAME = 255;
const MAX_DEPTH = 32;

/** Tools kept out by name, each with the reason the gate found. */
const EXCEPTIONS: Readonly<Record<string, string>> = exceptionsFile.exceptions;

/** Why a tool is kept out of automatic history by name, or null when it is not. */
export function historyException(toolId: string): string | null {
  return Object.hasOwn(EXCEPTIONS, toolId) ? EXCEPTIONS[toolId] ?? null : null;
}

/** Every `file` input at any depth, as `id` or `<blocks id>.<field id>`. */
export function fileInputPaths(inputs: readonly InputLike[] | undefined, prefix = '', depth = 0): string[] {
  if (!inputs || depth >= MAX_DEPTH) return [];
  return inputs.flatMap(input => {
    const path = prefix ? `${prefix}.${input.id}` : input.id;
    if (input.type === 'file') return [path];
    return input.type === 'blocks' ? fileInputPaths(input.fields, path, depth + 1) : [];
  });
}

/** The class a manifest falls in (see the header). */
export function historyClass(manifest: HistoryManifest): HistoryClass {
  if ((manifest.capabilities ?? []).some(cap => LIVE_DEVICE_CAPS.has(cap))) return 'recording';
  if (fileInputPaths(manifest.inputs).length) {
    const actions = manifest.render?.actions;
    return Array.isArray(actions) && actions.length === 0 ? 'settings' : 'side-file';
  }
  return 'document';
}

/** Every input has a type history knows how to keep. A blocks field with no type is
 *  text, as the schema and the engine read such a field. An unknown future type is refused
 *  until someone decides how history keeps that type. */
function durable(inputs: readonly InputLike[], depth = 0): boolean {
  return depth < MAX_DEPTH && inputs.every(input => !!input.type && DURABLE_TYPES.has(input.type)
    && (input.type !== 'blocks' || !input.fields || durable(input.fields.map(field => ({ ...field, type: field.type ?? 'text' })), depth + 1)));
}

/** Whether and how a mount of this manifest keeps history. A shared mount (a live
 *  collaboration, an ephemeral session) keeps nothing on this device. */
export function historyParticipation(manifest: HistoryManifest, shared: boolean): HistoryParticipation {
  const notKept = fileInputPaths(manifest.inputs);
  if (shared) return { mode: 'none', localHistory: false, recordDeviceActivity: false, notKept };
  const cls = historyClass(manifest);
  const enrolled = (cls === 'document' || cls === 'side-file') && historyException(manifest.id) === null && durable(manifest.inputs ?? []);
  return { mode: enrolled ? 'document' : 'none', localHistory: enrolled, recordDeviceActivity: true, notKept };
}

/** What history keeps in place of a file it does not keep: the file's name, type and
 *  size, never its bytes. The engine reads it as an empty file input (it carries no
 *  bytes), so a reopened document asks for the file again rather than claiming to have the file. */
export interface NotKeptFile { notKept: true; name: string; mime: string; size: number }

export function isNotKeptFile(value: unknown): value is NotKeptFile {
  return !!value && typeof value === 'object' && !Array.isArray(value) && (value as { notKept?: unknown }).notKept === true
    && typeof (value as { name?: unknown }).name === 'string';
}

/** The not-kept record for one value in a file slot: a loaded file becomes its record,
 *  a record stays, an empty slot stays empty, and anything else is dropped as empty. */
function notKeptRecord(value: unknown): unknown {
  if (value === null || value === undefined || isNotKeptFile(value)) return value;
  if (typeof value === 'object' && !Array.isArray(value) && (value as { __file?: unknown }).__file) {
    const file = value as { name?: unknown; mime?: unknown; size?: unknown };
    return { notKept: true, name: typeof file.name === 'string' ? file.name.slice(0, MAX_NAME) : '',
      mime: typeof file.mime === 'string' ? file.mime.slice(0, MAX_NAME) : '',
      size: typeof file.size === 'number' && Number.isFinite(file.size) ? file.size : 0 } satisfies NotKeptFile;
  }
  return null;
}

/** `fn` applied to the value at one path (see fileInputPaths): a top-level input, or the
 *  field of every row of a blocks input, rows inside rows included. The record comes
 *  back unchanged, the same object, when `fn` changes nothing. */
function mapPath(record: Record<string, unknown>, path: readonly string[], fn: (value: unknown) => unknown): Record<string, unknown> {
  const [key, ...rest] = path;
  if (key === undefined || !Object.hasOwn(record, key)) return record;
  const value = record[key];
  let next: unknown = value;
  if (!rest.length) next = Array.isArray(value) ? mapList(value, fn) : fn(value);
  else if (Array.isArray(value)) {
    const rows = value.map(row => (row && typeof row === 'object' && !Array.isArray(row) ? mapPath(row as Record<string, unknown>, rest, fn) : row));
    if (rows.some((row, i) => row !== value[i])) next = rows;
  }
  return next === value ? record : { ...record, [key]: next };
}
/** A `multiple` file input's list, each entry mapped and the empty ones left out. */
function mapList(list: readonly unknown[], fn: (value: unknown) => unknown): unknown[] {
  const out = list.map(fn).filter(item => item !== null && item !== undefined);
  return out.length === list.length && out.every((item, i) => item === list[i]) ? list as unknown[] : out;
}
function mapPaths<T extends Record<string, unknown>>(data: T, notKept: readonly string[], fn: (value: unknown) => unknown): T {
  let out: Record<string, unknown> = data;
  for (const path of notKept) out = mapPath(out, path.split('.'), fn);
  return out as T;
}

/**
 * The document as history and Save keep it where the document has history (plan 277
 * P4, class B): every file at a `notKept` path is recorded as not kept (NotKeptFile),
 * so no copy history keeps holds a file's bytes. Everything else is untouched, and a
 * document with nothing to leave out comes back as the same object.
 */
export function historyRedact<T extends Record<string, unknown>>(data: T, notKept: readonly string[]): T {
  return notKept.length ? mapPaths(data, notKept, notKeptRecord) : data;
}

/** The names of the files a kept document records as not kept, in path and row order. */
export function notKeptFiles(data: Readonly<Record<string, unknown>>, notKept: readonly string[]): string[] {
  const names: string[] = [];
  mapPaths(data as Record<string, unknown>, notKept, value => { if (isNotKeptFile(value)) names.push(value.name); return value; });
  return names;
}

/** A kept document as the engine reads it back: each not-kept record is an empty file
 *  slot, null for one file and an empty list for a `multiple` input. */
export function withoutNotKept<T extends Record<string, unknown>>(data: T, notKept: readonly string[]): T {
  return mapPaths(data, notKept, value => (isNotKeptFile(value) ? null : value));
}

/**
 * `load` reading a saved record in the form history keeps. A record can still hold
 * a file's bytes: a save made before history kept the tool, a Make variants copy, a
 * .lolly or multi-edit save. The controller adopts what this returns, so the adopted
 * revision records each file as not kept; the stored record stays as it was saved
 * until the next draft replaces it with the kept snapshot.
 */
export function loadKept<T extends Record<string, unknown>>(load: (slot: string) => Promise<T | null>, notKept: readonly string[]): (slot: string) => Promise<T | null> {
  return async slot => { const data = await load(slot); return data && historyRedact(data, notKept); };
}

/** Protect the immediate edit, then the final inputs after its async hook.
 * Merely rendering/playing an animation does not count as another edit. */
export function trackRevisionInput<T>(result: Promise<T>, changed: () => void): Promise<T> {
  changed(); void result.then(changed, () => {}); return result;
}
