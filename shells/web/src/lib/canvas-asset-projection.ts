// SPDX-License-Identifier: MPL-2.0
import { encodeCanvasAsset } from '@lolly-tools/core/canvas-asset-v1';
import type { InputModelItem, InputValue } from '../../../../engine/src/inputs.ts';
import type { CanvasAssetsCapability } from './canvas-assets.ts';
import { rowIdField } from './row-id.ts';

export const canvasAssetFields = (item: InputModelItem): ReadonlySet<string> => new Set(
  (item.fields ?? []).filter(field => field.type === 'asset').map(field => field.id));
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {};
const identity = (value: unknown): string => {
  const ref = record(value);
  return encodeCanvasAsset(value) ?? JSON.stringify([ref.id, ref.pin, ref.version, ref.checksum]);
};

export function needsCanvasAssetTransfer(item: InputModelItem, value: InputValue): boolean {
  if (item.type !== 'blocks' || !Array.isArray(value)) return false;
  const id = rowIdField(item), old = new Map((Array.isArray(item.value) ? item.value : []).map(raw => [record(raw)[id], record(raw)]));
  return value.some(raw => [...canvasAssetFields(item)].some(field => {
    const row = record(raw), ref = row[field];
    return ref && typeof ref === 'object' && identity(ref) !== identity(old.get(row[id])?.[field]);
  }));
}

export function hasCanvasAssetChange(item: InputModelItem, value: InputValue): boolean {
  if (item.type !== 'blocks' || !Array.isArray(value)) return false;
  const id = rowIdField(item), old = new Map((Array.isArray(item.value) ? item.value : []).map(raw => [record(raw)[id], record(raw)]));
  const next = new Map(value.map(raw => [record(raw)[id], record(raw)]));
  return [...new Set([...old.keys(), ...next.keys()])].some(key => [...canvasAssetFields(item)]
    .some(field => identity(old.get(key)?.[field]) !== identity(next.get(key)?.[field])));
}

/** File transfer waits must not roll back a peer's geometry or unrelated local fields. */
export async function prepareCanvasValue(item: InputModelItem, value: InputValue, assets: CanvasAssetsCapability,
  current: () => InputModelItem | undefined): Promise<InputValue> {
  const id = rowIdField(item), fields = canvasAssetFields(item);
  const before = new Map((Array.isArray(item.value) ? item.value : []).map(raw => [record(raw)[id], record(raw)]));
  const desired = await Promise.all((Array.isArray(value) ? value : []).map(async raw => {
    const row = { ...record(raw) }, old = before.get(row[id]) ?? {};
    for (const field of fields) if (row[field] && typeof row[field] === 'object' && identity(row[field]) !== identity(old[field])) row[field] = await assets.prepare(row[field]);
    return row;
  }));
  const byId = new Map(desired.map(row => [row[id], row]));
  const latest = current()?.value;
  const rows = (Array.isArray(latest) ? latest : []).flatMap(raw => {
    const row = record(raw), next = byId.get(row[id]), old = before.get(row[id]);
    if (!old) return [row]; // another editor inserted this row while the file travelled
    if (!next) return []; // this local edit removed it
    byId.delete(row[id]);
    const changed = Object.fromEntries(Object.entries(next).filter(([key, v]) => fields.has(key)
      ? identity(v) !== identity(old[key]) : !Object.is(v, old[key])));
    return [{ ...row, ...changed }];
  });
  // A peer's deletion wins over an in-flight file replacement.
  for (const [key, row] of byId) if (!before.has(key)) rows.push(row);
  return rows as InputValue;
}
