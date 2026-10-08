// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://lolly.ing/' });
const win = dom.window as unknown as Window & typeof globalThis;
globalThis.window = win; globalThis.document = win.document; globalThis.location = win.location;
const { interactiveCheckRows } = await import('./present-web-check.ts');

test('interactive preflight states clicks and stop counts, with conditional cross-origin warnings', () => {
  const source = document.createElement('div');
  source.innerHTML = `<div class="lolly-frame-page" data-frame-stack="top"><div class="lolly-box-web" data-lolly-web="https://www.example.com/" data-interact="2" data-interact-opts="keys=key;stops=0,400,800;mode=pan;len=0;hand=1" data-web-title="Product demo"></div></div>`;
  const rows = interactiveCheckRows(source); assert.equal(rows.length, 1);
  assert.equal(rows[0]!.slide, 1); assert.equal(rows[0]!.step, 2); assert.equal(rows[0]!.title, 'Product demo');
  assert.ok(rows[0]!.warnings.some((warning) => warning.includes('needs a page that listens')));
  assert.ok(rows[0]!.warnings.some((warning) => warning.includes('page length')));
  assert.ok(rows[0]!.warnings.some((warning) => warning.includes('slide stack')));
  assert.ok(rows[0]!.warnings.some((warning) => warning.includes('Back to slides')));
});
test('zero focus is included and invalid options are explicit; malformed focus steps are ignored', () => {
  const source = document.createElement('div');
  source.innerHTML = `<div class="lolly-frame-page"><div class="lolly-box-web" data-lolly-web="https://lolly.ing/#/tool/qr-code" data-interact="0" data-interact-opts="stops=0,400,800"></div><div class="lolly-box-web" data-lolly-web="https://www.example.com/" data-interact="3" data-interact-opts="keys=__proto__"></div><div class="lolly-box-web" data-lolly-web="https://www.example.com/" data-interact="junk"></div></div>`;
  const rows = interactiveCheckRows(source); assert.equal(rows.length, 2); assert.equal(rows[0]!.step, 0);
  assert.match(rows[0]!.summary, /3 stops/); assert.equal(rows[1]!.warnings.length, 1); assert.match(rows[1]!.warnings[0]!, /could not be read/);
});
