// SPDX-License-Identifier: MPL-2.0
/** Focus identifies the collection, object ID and input field. */
export interface FieldFocus { inputId: string; rowId: string; field: string }
const prefix = '@field:';
export function fieldFocusToken(inputId: string, rowId: string, field: string): string {
  return prefix + JSON.stringify([inputId, rowId, field]);
}
export function parseFieldFocus(value: unknown): FieldFocus | null {
  if (typeof value !== 'string' || value.length > 512 || !value.startsWith(prefix)) return null;
  try {
    const parts: unknown = JSON.parse(value.slice(prefix.length));
    if (!Array.isArray(parts) || parts.length !== 3 || !parts.every(p => typeof p === 'string' && p.length > 0 && p.length <= 200)) return null;
    return { inputId: parts[0], rowId: parts[1], field: parts[2] };
  } catch { return null; }
}
