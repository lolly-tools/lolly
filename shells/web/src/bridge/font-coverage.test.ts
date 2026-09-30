// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createNodeTextAPI } from '../../../../packages/node-shell/src/text.ts';
import { fontCoversText, renderedFontRuns } from './font-coverage.ts';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const api = createNodeTextAPI({ repoRoot: root });
const style = { fontFamily: 'SUSE', fontWeight: '700', fontStyle: 'normal' };
const suse = async () => ({ url: '/fonts/SUSE[wght].ttf', variations: ['wght=700'] });

test('coverage reads glyphs from real fonts rather than accepting a resolvable family', async () => {
  assert.equal(await fontCoversText(style, 'Editable café', api, suse), true);
  for (const text of ['Привет мир', 'مرحبا بالعالم', 'Hello 世界', 'A'.repeat(500) + 'مرحبا']) {
    assert.equal(await fontCoversText(style, text, api, suse), false, text);
  }
  const arabic = new URL('../../../../tests/fixtures/text-composition/fonts/notosansarabic/NotoSansArabic[wdth,wght].ttf', import.meta.url).href;
  assert.equal(await fontCoversText(style, 'Hello مرحبا', api, async () => ({
    ...await suse(), fallbacks: [{ fontUrl: arabic, variations: ['wght=700'] }],
  })), true, 'a packaged fallback face supplies the missing script');
});

test('repeated geometry checks reuse glyph evidence, while failed reads can retry', async () => {
  let calls = 0;
  const probe = { toPath: async () => {
    calls++;
    if (calls === 1) throw new Error('Temporary font fetch failure');
    return { d: '', advanceWidth: 1, bbox: null, notdef: 0 };
  } };
  assert.equal(await fontCoversText(style, 'Hello', probe, suse), false);
  assert.equal(await fontCoversText(style, 'Hello', probe, suse), true);
  assert.equal(await fontCoversText(style, 'Hello', probe, suse), true);
  assert.equal(calls, 2);
});

test('an absent shaper, unreadable font or old result cannot claim verified coverage', async () => {
  assert.equal(await fontCoversText(style, 'Hello', undefined, suse), false);
  assert.equal(await fontCoversText(style, 'Hello', api, async () => null), false);
  assert.equal(await fontCoversText(style, 'Hello', api, async () => ({ url: 'file:///missing-font.ttf' })), false);
  assert.equal(await fontCoversText(style, 'Hello', { toPath: async () => ({ d: '', advanceWidth: 1, bbox: null }) }, suse), false);
});

test('mounted coverage uses inline font changes and whole runs without image labels or script text', () => {
  const dom = new JSDOM('<div id="text">Hello <b>مرحبا</b><svg><title>Artwork</title><path d="M0 0"/></svg><script>ignored()</script><span data-export-hide>Editor</span></div>');
  const root = dom.window.document.querySelector('#text')!;
  const runs = renderedFontRuns(root, element => ({ fontFamily: element.tagName === 'B' ? 'Arabic face' : 'Latin face', fontWeight: '400', fontStyle: 'normal' }) as CSSStyleDeclaration);
  assert.deepEqual(runs.map(run => [run.text, run.style.fontFamily]), [['Hello ', 'Latin face'], ['مرحبا', 'Arabic face']]);
  dom.window.close();
});
