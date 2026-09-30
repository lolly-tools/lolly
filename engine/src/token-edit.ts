// SPDX-License-Identifier: MPL-2.0
/** Source-preserving typed token value edits. */
import { colorToHex } from './tokens.ts';
import { TOKEN_COMPOSITE_FIELDS } from './token-composite.ts';
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

function supportedValue(type: string, value: unknown): boolean {
  if (typeof value === 'string' && /^\{[^{}]+\}$/.test(value)) return true;
  const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
  if (type === 'number') return finite(value);
  if (type === 'string') return typeof value === 'string';
  if (type === 'color') return !!colorToHex(value);
  if (type === 'fontFamily') return typeof value === 'string' && !!value.trim() || Array.isArray(value) && !!value.length && value.every(v => typeof v === 'string' && !!v.trim());
  if (type === 'fontWeight') return finite(value) && value >= 1 && value <= 1000 || typeof value === 'string' && /^(?:[1-9]\d{0,2}|1000|thin|hairline|extra-light|ultra-light|light|normal|regular|book|medium|semi-bold|demi-bold|bold|extra-bold|ultra-bold|black|heavy|extra-black|ultra-black)$/.test(value);
  if (type === 'dimension' || type === 'duration') {
    const units = type === 'duration' ? ['ms', 's'] : ['px', 'rem', 'em', '%', 'vh', 'vw', 'mm', 'cm', 'in', 'pt', 'pc'];
    const match = typeof value === 'string' ? /^([+-]?(?:\d+(?:\.\d*)?|\.\d+))([a-z%]+)$/.exec(value.trim()) : null;
    const number = match ? Number(match[1]) : record(value) ? value.value : null;
    const unit = match ? match[2] : record(value) ? value.unit : null;
    return finite(number) && typeof unit === 'string' && units.includes(unit) && (type !== 'duration' || number >= 0);
  }
  if (type === 'cubicBezier') return Array.isArray(value) && value.length === 4 && value.every(finite) && value[0]! >= 0 && value[0]! <= 1 && value[2]! >= 0 && value[2]! <= 1;
  if (type === 'gradient') return Array.isArray(value) && value.length >= 2 && value.length <= 32 && value.every(v => supportedValue('gradientStop', v));
  if (type === 'shadow' && Array.isArray(value)) return !!value.length && value.length <= 32 && value.every(v => supportedValue('shadow', v));
  if (type === 'strokeStyle') return typeof value === 'string' && ['solid', 'dashed', 'dotted', 'double', 'groove', 'ridge', 'outset', 'inset'].includes(value) || record(value) && Array.isArray(value.dashArray) && value.dashArray.every(v => supportedValue('dimension', v)) && ['butt', 'round', 'square'].includes(String(value.lineCap));
  const fields = TOKEN_COMPOSITE_FIELDS[type];
  if (!fields || !record(value) || !Object.entries(fields).every(([key, expected]) => supportedValue(expected, value[key]))) return false;
  if (type === 'gradientStop' && typeof value.position === 'number') return value.position >= 0 && value.position <= 1;
  if (type === 'shadow' && 'inset' in value) return typeof value.inset === 'boolean';
  return true;
}

/** Source editing is separate from a linked field's local override. */
export function withTokenSourceValue(doc: unknown, location: string, value: unknown): Record<string, unknown> {
  if (!record(doc)) throw new Error('A token document is required.');
  const keys = location.split('/').slice(1).map(k => k.replaceAll('~1', '/').replaceAll('~0', '~'));
  if (!location.startsWith('/') || !keys.length || keys.length > 48 || keys.some(k => ['__proto__', 'prototype', 'constructor'].includes(k))) throw new Error('The token source location is invalid.');
  const copy = structuredClone(doc);
  let node: Record<string, unknown> = copy, type: unknown = copy.$type;
  for (const key of keys) {
    if (!record(node[key])) throw new Error('The token source was removed. Inspect the current document again.');
    node = node[key]; type = node.$type ?? type;
  }
  if (!('$value' in node)) throw new Error('This source location is not a token.');
  let scanned = 0;
  const pending = [{ value, depth: 0 }];
  while (pending.length) {
    const item = pending.pop()!;
    if (++scanned > 4096 || item.depth > 32) throw new Error('The source value exceeds the edit limit.');
    if (item.value && typeof item.value === 'object') for (const child of Object.values(item.value)) pending.push({ value: child, depth: item.depth + 1 });
  }
  const valid = supportedValue(String(type), value);
  if (!valid) throw new Error('This value does not match a supported token type. Keep unsupported imported values in their source file.');
  node.$value = structuredClone(value);
  return copy;
}
