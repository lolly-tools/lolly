// SPDX-License-Identifier: MPL-2.0
/**
 * Lolly's marks travel as twins: the authored file at the repo root, the copy the
 * web shell serves from shells/web/public (primary and reverse only) and the
 * lolly/logo/* file in each public pack. lolly/demo/lolly-spin, the spinning mark,
 * is shared by both packs the same way. Signing is a manual run: the catalog signer
 * rewrites one pack's files and bumps that pack's index, and the maintainer copies
 * the signed bytes to every other twin and the new versions to the other index
 * (the steps are in PR #305). These tests catch a copy that was missed.
 *
 * Run with: node --test tests/lolly-mark-twins.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PACKS = ['lolly-start', 'lolly-demo'];
const SPIN = 'lolly/demo/lolly-spin';

interface Mark {
  /** The catalog id is lolly/logo/<name>. */
  name: string;
  /** The authored source at the repo root. */
  root: string;
  /** The copy the web shell serves, where there is one. */
  served?: string;
}

const MARKS: Mark[] = [
  { name: 'primary', root: 'icon-primary.svg', served: 'shells/web/public/icon-primary.svg' },
  { name: 'reverse', root: 'icon-reverse.svg', served: 'shells/web/public/icon-reverse.svg' },
  { name: 'mono', root: 'icon-mono-primary.svg' },
  { name: 'mono-reverse', root: 'icon-mono-reverse.svg' },
];

interface AssetFormat {
  url: string;
  checksum?: string;
  size?: number;
}

interface AssetRow {
  id: string;
  version: string;
  formats: AssetFormat[];
}

const packFile = (pack: string, rel: string): string => `brands/${pack}/catalog/assets/${rel}`;

function assertSameBytes(paths: string[]): void {
  const [first, ...rest] = paths;
  if (first === undefined) return;
  const want = readFileSync(join(ROOT, first));
  for (const rel of rest) {
    assert.ok(readFileSync(join(ROOT, rel)).equals(want), `${rel} differs from ${first}: copy the same bytes to every twin`);
  }
}

function sharedRows(pack: string): Map<string, AssetRow> {
  const index = JSON.parse(readFileSync(join(ROOT, packFile(pack, 'index.json')), 'utf8')) as { assets: AssetRow[] };
  const rows = index.assets.filter((row) => row.id.startsWith('lolly/logo/') || row.id === SPIN);
  return new Map(rows.map((row) => [row.id, row]));
}

const formatKey = (row: AssetRow): string[] =>
  row.formats.map((format) => `${format.url} ${format.checksum ?? '(no checksum)'} ${format.size ?? '(no size)'}`);

test('every Lolly mark is byte-identical across its twins', () => {
  for (const mark of MARKS) {
    const served = mark.served === undefined ? [] : [mark.served];
    const packs = PACKS.map((pack) => packFile(pack, `lolly/logo/${mark.name}.svg`));
    assertSameBytes([mark.root, ...served, ...packs]);
  }
  assertSameBytes(PACKS.map((pack) => packFile(pack, 'lolly/demo/lolly-spin.svg')));
});

test('both packs list each Lolly mark with the same version, checksum and size', () => {
  const [start, demo] = PACKS.map(sharedRows);
  assert.ok(start && demo, 'both pack indexes load');
  assert.deepEqual([...demo.keys()].sort(), [...start.keys()].sort(), 'the two packs list different mark rows');
  for (const mark of MARKS) {
    assert.ok(start.has(`lolly/logo/${mark.name}`), `lolly-start lists no lolly/logo/${mark.name} row`);
  }
  for (const [id, row] of start) {
    const twin = demo.get(id);
    assert.ok(twin, `lolly-demo lists no ${id} row`);
    assert.equal(twin.version, row.version, `${id}: lolly-demo has version ${twin.version}, lolly-start ${row.version}`);
    assert.deepEqual(formatKey(twin), formatKey(row), `${id}: the checksum or size differs between the packs`);
  }
});
