// SPDX-License-Identifier: MPL-2.0
import { ReferenceCanvasDoc, type CanvasOp } from '@lolly-tools/core/canvas-op-v1';
import type { InputModelItem } from '../../../../engine/src/inputs.ts';
import { rowIdField } from './row-id.ts';

export interface CanvasRecoveryDraft { id: string; values: Record<string, unknown>; label: string }
const drafts = new WeakMap<object, { records: CanvasRecoveryDraft[]; listeners: Set<(draft: CanvasRecoveryDraft) => void> }>();
function state(runtime: object) {
  let value = drafts.get(runtime);
  if (!value) { value = { records: [], listeners: new Set() }; drafts.set(runtime, value); }
  return value;
}
/** Retain a separate device copy. Recovery never applies a patch to the shared runtime. */
export function retainCanvasRecovery(runtime: object, values: Record<string, unknown>, label: string, id: string = crypto.randomUUID()): void {
  const encoded = JSON.stringify(values);
  if (encoded.length > 16_000_000) throw new Error('Recovery copy is too large to save.');
  const value = state(runtime);
  if (value.records.some(record => record.id === id)) return;
  const draft = { id, values: JSON.parse(encoded) as Record<string, unknown>, label };
  value.records.push(draft); if (value.records.length > 8) value.records.shift();
  for (const listener of value.listeners) listener(draft);
}
export function subscribeCanvasRecovery(runtime: object, listener: (draft: CanvasRecoveryDraft) => void): () => void {
  const value = state(runtime); value.listeners.add(listener);
  for (const draft of value.records) listener(draft);
  return () => { value.listeners.delete(listener); };
}
/** Rebuild the archived projection using this tool's declared row identifiers. */
export function canvasRecoveryValues(model: readonly InputModelItem[], ops: readonly CanvasOp[]): Record<string, unknown> {
  const doc = new ReferenceCanvasDoc('recovery'); doc.applyRemotePatch(ops);
  const snapshot = doc.state(), values: Record<string, unknown> = {};
  for (const item of model) {
    if (snapshot.params.has(item.id)) values[item.id] = snapshot.params.get(item.id);
    if (item.type !== 'blocks') continue;
    const collection = snapshot.collections?.get(item.id); if (!collection) continue;
    const idField = rowIdField(item);
    const prior = new Map((Array.isArray(item.value) ? item.value : []).filter(row => row && typeof row === 'object')
      .map(row => [String((row as Record<string, unknown>)[idField]), row as Record<string, unknown>]));
    values[item.id] = collection.order.map(id => ({
      ...Object.fromEntries(Object.entries(prior.get(id) ?? {}).filter(([, value]) => value !== null && typeof value === 'object')),
      ...collection.boxes.get(id), [idField]: id,
    }));
  }
  return values;
}
