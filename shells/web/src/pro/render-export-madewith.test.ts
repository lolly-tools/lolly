// SPDX-License-Identifier: MPL-2.0
/**
 * Batch, folder and collection renders leave the design-system record out
 * (plans/319). The record is approved on the condition that it is visible at the
 * moment of export. Only the tool's own export panel shows it (its Design system
 * card), so renderRowToBlob, which every Pro batch, Projects folder export and 3D
 * collection export goes through, turns the record on only for a caller that asks.
 *
 * Run directly: node --import ./tests/css-stub.mjs --test shells/web/src/pro/render-export-madewith.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, '..');
const RENDER_EXPORT = readFileSync(join(HERE, 'render-export.ts'), 'utf8');

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...sources(path));
    else if (name.endsWith('.ts') && !name.endsWith('.test.ts')) out.push(path);
  }
  return out;
}

test('renderRowToBlob sends the record switch to every export, off unless the caller asks', () => {
  assert.match(RENDER_EXPORT, /madeWith\?: boolean;/, 'RenderRowOpts names the switch');
  assert.match(RENDER_EXPORT, /\{ width: outW, height: outH, dpi, signal, madeWith: madeWith === true \}/,
    'an explicit false, never an absent value the runtime would read as on');
  // The one runtime.export in the single-row path takes those opts.
  assert.match(RENDER_EXPORT, /runtime\.export\(target, fmt, exportOpts\)/);
});

test('no batch caller turns the record on, because none of them shows the record', () => {
  const callers = sources(SRC)
    .filter((path) => !path.endsWith(join('pro', 'render-export.ts')))
    .filter((path) => readFileSync(path, 'utf8').includes('renderRowToBlob('));
  assert.ok(callers.length > 3, 'the batch, folder, compose and preview paths all call renderRowToBlob');
  for (const path of callers) {
    assert.doesNotMatch(readFileSync(path, 'utf8'), /renderRowToBlob\([^;]*madeWith:\s*true/s,
      `${relative(SRC, path)} turns the record on without a Design system card in view`);
  }
});

test('a Design document export follows the source runtime\'s switch, so an unticked card records nothing', () => {
  // mountDocumentExport builds a second runtime for the export; without this copy it
  // would start with the record on whatever the card said.
  const body = RENDER_EXPORT.slice(RENDER_EXPORT.indexOf('export async function mountDocumentExport'));
  assert.match(body.slice(0, body.indexOf('mountToolCanvas(')), /runtime\.setMadeWith\(source\.madeWith\(\)\);/);
});
