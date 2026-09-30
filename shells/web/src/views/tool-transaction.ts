// SPDX-License-Identifier: MPL-2.0
/** Grouped input changes use the same history and collab fences as ordinary edits. */
import type { InputValue, InputWriteOptions } from '../../../../engine/src/inputs.ts';
import type { HistoryEntry, HistoryModel } from './tool-history.ts';
import { cloneValue, sameValue, historyTokenLinks } from './tool-history.ts';
import { collabHistoryStamp, collabHistoryValue } from '../lib/collab-undo.ts';
interface TransactionRuntime {
  getModel(): Array<{ id: string; value: InputValue; restoreTokenRef?: string }>;
  applyPatch(values: Record<string, unknown>, options?: InputWriteOptions): Promise<void>;
}
export async function commitToolTransaction(runtime: TransactionRuntime, history: HistoryModel,
  values: Record<string, unknown>, label: string, typingGroup?: string): Promise<void> {
  const model = new Map(runtime.getModel().map(item => [item.id, item.value]));
  const fields = Object.keys(values).sort();
  if (fields.some(id => !model.has(id))) throw new Error('A command names an unknown input.');
  const before = Object.fromEntries(fields.map(id => [id, cloneValue(model.get(id)!)]));
  const beforeLinks = historyTokenLinks(runtime.getModel(), fields);
  if (!typingGroup) history.endGesture();
  const pending = runtime.applyPatch(values);
  // The engine admits all input values before awaiting hooks. Refused/read-only
  // writes therefore cannot enter history as if they had succeeded.
  const next = new Map(runtime.getModel().map(item => [item.id, item.value]));
  const after = Object.fromEntries(fields.map(id => [id, cloneValue(next.get(id)!)]));
  history.record({ id: `@command:${typingGroup ?? label}`, label, before, after, fields, tokenLinks: { before: beforeLinks, after: historyTokenLinks(runtime.getModel(), fields) }, collabStamp: collabHistoryStamp(runtime) }, Date.now());
  if (!typingGroup) history.endGesture();
  await pending;
}
/** A cross-input invariant must never be half-undone after a remote edit. */
export function transactionHistoryValues(runtime: TransactionRuntime, entry: HistoryEntry, redo: boolean): Record<string, unknown> | null {
  if (!entry.fields) return null;
  const expected = (redo ? entry.before : entry.after) as Record<string, InputValue>;
  const desired = (redo ? entry.after : entry.before) as Record<string, InputValue>;
  const model = new Map(runtime.getModel().map(item => [item.id, item.value]));
  const result: Record<string, InputValue> = {};
  for (const id of entry.fields) {
    const value = collabHistoryValue(runtime, id, model.get(id), expected[id], desired[id], entry.collabStamp);
    if (!sameValue(value as InputValue, desired[id]!)) return null;
    result[id] = cloneValue(value as InputValue);
  }
  return result;
}
