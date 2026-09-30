// SPDX-License-Identifier: MPL-2.0
/** Deterministic JSON with sorted object keys and preserved array order. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    // Primitives: defer to JSON.stringify (number/string/boolean formatting is
    // already deterministic). undefined/function have no JSON form → null.
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return '[' + value.map(v => canonicalJson(v)).join(',') + ']';
  }
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of Object.keys(record).sort()) {
    if (record[key] === undefined) continue;
    parts.push(JSON.stringify(key) + ':' + canonicalJson(record[key]));
  }
  return '{' + parts.join(',') + '}';
}
