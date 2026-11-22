// SPDX-License-Identifier: MPL-2.0
/**
 * Every write of a saved session goes through state-rows.ts (plan 373), so a
 * record, its lean row and its picture row always commit together. A raw
 * `objectStore('state').put` anywhere else would let the lean list or the picture
 * index drift from the record; this pins the rule in the source.
 *
 * Run directly:  node --test shells/web/src/bridge/state-writers-contract.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = join(import.meta.dirname, '..');
function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return walk(path);
    return /\.ts$/.test(name) && !/\.test\.ts$|test-utils\.ts$/.test(name) ? [path] : [];
  });
}
const files = walk(SRC).map(path => ({ path: relative(SRC, path), text: readFileSync(path, 'utf8') }));

test('no module writes the state store except the shared row writer (and the pre-373 database paths)', () => {
  const raw = /objectStore\('state'\)\s*\.(put|delete|add|clear)\(|\.(put|delete)\('state',/g;
  const allowed = new Set(['bridge/state-rows.ts', 'bridge/db.ts']);
  const offenders: string[] = [];
  for (const { path, text } of files) {
    if (allowed.has(path)) continue;
    for (const match of text.matchAll(raw)) {
      // state.ts writes `db.put('state', ...)` only on a database without the preview
      // store (or a narrow stub), where there is no lean row to keep.
      if (path === 'bridge/state.ts' && /if \(!full\)|\} else await db\.delete\('state'/.test(text.slice(Math.max(0, match.index! - 120), match.index! + 30))) continue;
      offenders.push(`${path}: ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, []);
});

test('every read-write transaction that names the state store is opened with scopeFor', () => {
  const offenders: string[] = [];
  for (const { path, text } of files) {
    if (!path.startsWith('bridge/') && !path.startsWith('lib/')) continue;
    for (const match of text.matchAll(/\.transaction\(([^;]*?),\s*'readwrite'\)/g)) {
      const scope = match[1]!;
      if (scope.includes('scopeFor(')) continue;
      // The lean list's own repair writes only lean rows; it reads `state`, writes none.
      if ((path === 'bridge/state-list.ts' || path === 'bridge/state-rows.ts') && scope.includes('STATE_LIST')) continue;
      const constant = /\b(STORES|REVISION_STORES|RELIEF_STORES|MOVE_STORES)\b/.exec(scope)?.[1];
      const constantNamesState = !!constant && (constant !== 'STORES' || /const STORES = [^;]*'state'/.test(text) || /REVISION_STORES as STORES/.test(text));
      const namesState = /'state'/.test(scope) || constantNamesState;
      if (namesState) offenders.push(`${path}: ${match[0].slice(0, 90)}`);
    }
  }
  assert.deepEqual(offenders, []);
});
