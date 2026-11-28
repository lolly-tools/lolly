// SPDX-License-Identifier: MPL-2.0
/**
 * On a phone the controls sheet covers the top of the stage. A single canvas is padded
 * below the sheet by fitCanvas; a paged or web-page surface (QR Code's Scan, Jump) fills
 * the stage, so fitPagedDoc must start the scroll surface at the sheet's edge too. This
 * pins that both fits measure the sheet the same way, from the source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('./stage-layout.ts', import.meta.url), 'utf8');
const body = (name: string): string => {
  const at = src.indexOf(`export function ${name}(`);
  assert.ok(at >= 0, `${name} exists`);
  return src.slice(at, src.indexOf('\nexport function ', at + 1));
};

test('the single-canvas fit and the paged fit both clear the phone sheet', () => {
  assert.match(body('fitCanvas'), /sheetOverlap\(tview, stageRect\)/);
  const paged = body('fitPagedDoc');
  assert.match(paged, /sheetOverlap\(tview, /);
  assert.match(paged, /outerEl\.style\.top = /);
  assert.ok(paged.indexOf('sheetOverlap') < paged.indexOf('if (webDoc)'), 'a web-page preview clears the sheet before its early return');
});

test('a paged surface follows every sheet snap, not only the collapse to peek', () => {
  assert.match(src, /snap === 'peek' \|\| tview\.pagedDoc/);
});
