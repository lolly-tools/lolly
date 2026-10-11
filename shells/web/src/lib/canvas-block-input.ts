// SPDX-License-Identifier: MPL-2.0
import type { InputModelItem, InputValue } from '../../../../engine/src/inputs.ts';

/** A canvas checkbox can update one declared boolean field on an identified row. */
export function canvasBlockBooleanValue(input: InputModelItem | undefined, rowId: string, field: string, checked: boolean): InputValue | undefined {
  if (input?.type !== 'blocks' || !input.fields?.some(f => f.id === 'id' && f.type === 'text') || !input.fields.some(f => f.id === field && f.type === 'boolean') || !Array.isArray(input.value)) return undefined;
  const rows = input.value as Record<string, unknown>[];
  if (rows.filter(row => row && row.id === rowId).length !== 1) return undefined;
  return rows.map(row => row.id === rowId ? { ...row, [field]: checked } : row) as InputValue;
}
