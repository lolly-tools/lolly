// SPDX-License-Identifier: MPL-2.0
/** Bounded three-way token source merges with explicit conflict decisions. */
export interface TokenMergeConflict { location: string; base: unknown; local: unknown; incoming: unknown }
export interface TokenMergeResult { document: Record<string, unknown>; conflicts: TokenMergeConflict[] }
type Rec = Record<string, unknown>;
const record = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);

/** Apply one explicit conflict decision to a candidate without editing the sources. */
export function decideTokenMergeConflict(document: Rec, conflict: TokenMergeConflict, choice: 'local' | 'incoming'): Rec {
  const value = choice === 'local' ? conflict.local : conflict.incoming;
  if (conflict.location === '') {
    if (!record(value)) throw new Error('The merged document must remain an object.');
    return structuredClone(value);
  }
  const keys = conflict.location.split('/').slice(1).map(k => k.replaceAll('~1', '/').replaceAll('~0', '~'));
  if (!conflict.location.startsWith('/') || keys.length > 48 || keys.some(k => ['__proto__', 'constructor', 'prototype'].includes(k))) throw new Error('The conflict location is invalid.');
  const copy = structuredClone(document);
  let parent = copy;
  for (const key of keys.slice(0, -1)) {
    if (!record(parent[key])) parent[key] = {};
    parent = parent[key] as Rec;
  }
  const key = keys.at(-1)!;
  if (value === undefined) delete parent[key]; else parent[key] = structuredClone(value);
  return copy;
}
const equal = (a: unknown, b: unknown): boolean => {
  if (record(a) && record(b)) return Object.keys(a).length === Object.keys(b).length && Object.keys(a).every(k => Object.hasOwn(b, k) && equal(a[k], b[k]));
  return JSON.stringify(a) === JSON.stringify(b);
};

/** Three-way source merge. Conflicts keep the approved local value until reviewed. */
export function mergeTokenDocuments(base: unknown, local: unknown, incoming: unknown): TokenMergeResult {
  if (![base, local, incoming].every(record)) throw new Error('Base, local and incoming token documents must be objects.');
  for (const source of [base, local, incoming]) {
    let inspected = 0;
    const stack = [{ value: source, depth: 0 }];
    while (stack.length) {
      const item = stack.pop()!;
      if (++inspected > 20000 || item.depth > 48) throw new Error('The source merge exceeded its scan limit.');
      if (item.value && typeof item.value === 'object') for (const value of Object.values(item.value)) stack.push({ value, depth: item.depth + 1 });
    }
  }
  let nodes = 0;
  const conflicts: TokenMergeConflict[] = [];
  function merge(b: unknown, l: unknown, n: unknown, location: string, depth: number): unknown {
    if (++nodes > 20000 || depth > 48) throw new Error('The source merge exceeded its scan limit.');
    if (equal(l, n) || equal(b, n)) return structuredClone(l);
    if (equal(b, l)) return structuredClone(n);
    // A token is atomic so its type and value cannot come from competing edits.
    if (record(l) && record(n) && (!b || record(b)) && !('$value' in l) && !('$value' in n)) {
      return Object.fromEntries([...new Set([...Object.keys(record(b) ? b : {}), ...Object.keys(l), ...Object.keys(n)])].flatMap(k => {
        const value = merge(record(b) ? b[k] : undefined, l[k], n[k], `${location}/${k.replaceAll('~', '~0').replaceAll('/', '~1')}`, depth + 1);
        return value === undefined ? [] : [[k, value]];
      }));
    }
    conflicts.push({ location, base: structuredClone(b), local: structuredClone(l), incoming: structuredClone(n) });
    return structuredClone(l);
  }
  return { document: merge(base, local, incoming, '', 0) as Rec, conflicts };
}
