// SPDX-License-Identifier: MPL-2.0
/**
 * Undo and redo for the music generator (#/music): every change a person makes in the
 * studio (the genre, the seed, a shuffle, an instrument, mute and solo, a level, the
 * tempo, the key, the length, the ear candy switches and Reset) is one step back and
 * forward, from the buttons beside Render or with Cmd or Ctrl+Z, Shift+Cmd or Ctrl+Z and
 * Ctrl+Y.
 *
 * The steps come from the tool view's history model (views/tool-history.ts createHistory),
 * so the studio follows the same rules as a tool's sidebar: a slider dragged while the
 * pointer is down is one step however long the drag, quick key presses on one control
 * merge into one step, and a new change after an undo clears the redo. The rest of the
 * app's history (the History panel's saved revisions, tool transactions and the fences
 * that keep a collaborator's edits safe: components/history-panel.ts,
 * views/tool-transaction.ts, lib/collab-undo.ts) belongs to a tool's saved session and
 * its inputs, which the studio does not have, so only the model is shared.
 *
 * A step holds the whole studio before and after a change as one string (stableJson), a
 * few hundred bytes, so a kept step never shares an object with the live state. The view
 * says what the studio is now (read) and puts it back (write); this module keeps the steps
 * and answers which way a key press goes.
 */
import { t, tRaw } from '../../i18n.ts';
import { escape as escapeHtml } from '../../utils.ts';
import { icon } from '../../lib/icons.ts';
import { createHistory } from '../tool-history.ts';

export interface StudioHistoryDeps {
  /** The studio as it is now, as one string (stableJson of everything a step puts back). */
  read(): string;
  /** Put the studio back to a state read earlier. */
  write(snapshot: string): void;
  /** The time in milliseconds, for merging quick key presses (a test passes its own). */
  now?(): number;
}

export interface StudioHistory {
  /**
   * The studio changed: keep a step from the state before to the state now. A `group`
   * (a slider's id) merges the steps of one drag, or of key presses close together, into
   * one; without one, each change is a step of its own. False when nothing changed.
   */
  commit(label: string, group?: string): boolean;
  /** Take the studio as it is now without a step: a project or the person's profile loaded, or the generator swapped a blocked instrument. */
  rebase(): void;
  /** Step back; answers what the step was, or null when there is none. */
  undo(): string | null;
  /** Step forward again; answers what the step was, or null when there is none. */
  redo(): string | null;
  /** What the next undo and redo would take back or put back, or '' when there is nothing. */
  undoLabel(): string;
  redoLabel(): string;
  /** A pointer went down on a control and came up again: everything between is one step. */
  beginHold(): void;
  endHold(): void;
  /** Steps on each side, for the tests. */
  sizes(): { undo: number; redo: number };
}

/** JSON with every object's keys in order and undefined left out, so the same studio is always the same string. */
export function stableJson(value: unknown): string {
  const order = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(order);
    if (!v || typeof v !== 'object') return v;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v).sort()) {
      const child = (v as Record<string, unknown>)[k];
      if (child !== undefined) out[k] = order(child);
    }
    return out;
  };
  return JSON.stringify(order(value));
}

export function createStudioHistory(deps: StudioHistoryDeps): StudioHistory {
  const model = createHistory();
  const now = (): number => deps.now?.() ?? Date.now();
  /** The studio as the last step left it: the "before" of the next step. */
  let current = deps.read();
  let seq = 0;
  const step = (redo: boolean): string | null => {
    const entry = redo ? model.redo() : model.undo();
    if (!entry) return null;
    model.endGesture();
    const to = String(redo ? entry.after : entry.before);
    current = to;
    deps.write(to);
    // Writing can settle the studio a little (a control rounding a value): keep what it is now.
    current = deps.read();
    return entry.label;
  };
  return {
    commit(label, group) {
      const after = deps.read();
      if (!group) model.endGesture();
      const outcome = model.record({ id: group ?? `step-${++seq}`, label, before: current, after }, now());
      if (!group) model.endGesture();
      current = after;
      return outcome !== 'ignored';
    },
    rebase() { current = deps.read(); model.endGesture(); },
    undo: () => step(false),
    redo: () => step(true),
    undoLabel: () => model.peekUndo()?.label ?? '',
    redoLabel: () => {
      // The model shows only the top of the undo side; take the redo side's top by stepping over and back.
      if (!model.canRedo()) return '';
      const entry = model.redo();
      if (!entry) return '';
      model.undo();
      return entry.label;
    },
    beginHold: () => model.beginHold(),
    endHold: () => model.endHold(),
    sizes: () => model.sizes(),
  };
}

/** Which way a key press steps the history: Cmd or Ctrl+Z undoes, with Shift redoes, and Ctrl+Y redoes. */
export function historyKey(e: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey'>): 'undo' | 'redo' | null {
  if (e.altKey || !(e.metaKey || e.ctrlKey)) return null;
  const key = e.key.toLowerCase();
  if (key === 'z') return e.shiftKey ? 'redo' : 'undo';
  if (key === 'y' && e.ctrlKey && !e.metaKey && !e.shiftKey) return 'redo';
  return null;
}

/** What a step says when it is taken back or put back, for the status line a screen reader speaks. */
export const undoneLine = (label: string): string => tRaw('Undone: {change}', { change: label });
export const redoneLine = (label: string): string => tRaw('Redone: {change}', { change: label });

/** The undo and redo buttons: one soft pill of two. */
export function historyButtonsHtml(): string {
  const button = (attr: string, name: 'undo' | 'redo', label: string): string =>
    `<button type="button" class="ms-history-btn" ${attr} aria-label="${escapeHtml(label)}" title="${escapeHtml(label)}" aria-disabled="true">${icon(name, { size: 18 })}</button>`;
  return `<span class="ms-history" role="group" aria-label="${escapeHtml(t('History'))}">${button('data-undo', 'undo', t('Undo'))}${button('data-redo', 'redo', t('Redo'))}</span>`;
}

/**
 * Set the buttons to the history: each one's tip says what it would do, and a button with
 * nothing to do is marked off (aria-disabled, so it keeps focus after the last undo and the
 * view ignores a press on a marked button).
 */
export function paintHistoryButtons(root: ParentNode, h: StudioHistory): void {
  const undo = root.querySelector<HTMLButtonElement>('[data-undo]');
  const redo = root.querySelector<HTMLButtonElement>('[data-redo]');
  const back = h.undoLabel(), forward = h.redoLabel();
  if (undo) {
    undo.setAttribute('aria-disabled', String(!back));
    const tip = back ? tRaw('Undo: {change} (Cmd or Ctrl+Z)', { change: back }) : t('Nothing to undo');
    undo.title = tip;
    undo.setAttribute('aria-label', back ? tRaw('Undo: {change}', { change: back }) : t('Undo'));
  }
  if (redo) {
    redo.setAttribute('aria-disabled', String(!forward));
    const tip = forward ? tRaw('Redo: {change} (Shift+Cmd or Ctrl+Z)', { change: forward }) : t('Nothing to redo');
    redo.title = tip;
    redo.setAttribute('aria-label', forward ? tRaw('Redo: {change}', { change: forward }) : t('Redo'));
  }
}
