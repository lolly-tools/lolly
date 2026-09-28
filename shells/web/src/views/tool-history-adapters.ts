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
 * Class A keeps history now. B waits until a file's bytes can be left out of the
 * snapshot, C until its settings can be kept by the file's fingerprint (it must never
 * file a creation in Projects), and D until a capture can pause checkpoints.
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
const DURABLE_TYPES: ReadonlySet<string> = new Set(['text', 'longtext', 'number', 'boolean', 'color', 'select', 'asset', 'date', 'time', 'datetime-local', 'url', 'vector', 'table', 'blocks']);
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
  const enrolled = historyClass(manifest) === 'document' && historyException(manifest.id) === null && durable(manifest.inputs ?? []);
  return { mode: enrolled ? 'document' : 'none', localHistory: enrolled, recordDeviceActivity: true, notKept };
}

/** Protect the immediate edit, then the final inputs after its async hook.
 * Merely rendering/playing an animation does not count as another edit. */
export function trackRevisionInput<T>(result: Promise<T>, changed: () => void): Promise<T> {
  changed(); void result.then(changed, () => {}); return result;
}
