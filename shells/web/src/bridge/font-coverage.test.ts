// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createNodeTextAPI } from '../../../../packages/node-shell/src/text.ts';
import { fontCoversText, renderedFontRuns } from './font-coverage.ts';
import { fontCoversText as lazyFontCoversText } from './font-coverage-load.ts';

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

test('a reused checker still resolves current font files, variations and fallback faces', async () => {
  let resolved = 0;
  const requests: unknown[] = [];
  const probe = { toPath: async (request: unknown) => {
    requests.push(request);
    return { d: '', advanceWidth: 1, bbox: null, notdef: requests.length === 2 ? 1 : 0 };
  } };
  let font: Awaited<ReturnType<typeof suse>> & { fallbacks?: { fontUrl: string }[] } = await suse();
  const resolve = async () => { resolved++; return font; };
  assert.equal(await lazyFontCoversText(style, 'Hello', probe, resolve), true);
  assert.equal(await lazyFontCoversText(style, 'Hello', probe, resolve), true);
  font = { url: '/fonts/replacement.ttf', variations: ['wght=400'] };
  assert.equal(await lazyFontCoversText(style, 'Hello', probe, resolve), false);
  font = { ...font, fallbacks: [{ fontUrl: '/fonts/fallback.ttf' }] };
  assert.equal(await lazyFontCoversText(style, 'Hello', probe, resolve), true);
  font = { ...font, variations: ['wght=700'] };
  assert.equal(await lazyFontCoversText(style, 'Hello', probe, resolve), true);
  assert.equal(resolved, 5, 'module reuse does not retain a font resolution');
  assert.equal(requests.length, 4, 'only identical shaping evidence is reused');
});

test('a large warm audit reuses glyph evidence while resolving every text run again', async () => {
  let shaped = 0, resolved = 0;
  const probe = { toPath: async () => {
    shaped++;
    return { d: '', advanceWidth: 1, bbox: null, notdef: 0 };
  } };
  const resolve = async () => { resolved++; return suse(); };
  for (let audit = 0; audit < 2; audit++) {
    for (let run = 0; run < 3000; run++) {
      assert.equal(await fontCoversText(style, `Label ${run}`, probe, resolve), true);
    }
  }
  assert.equal(shaped, 3000);
  assert.equal(resolved, 6000);
  const secondHost = { toPath: probe.toPath };
  assert.equal(await fontCoversText(style, 'Label 0', secondHost, resolve), true);
  assert.equal(shaped, 3001, 'a different host must supply its own evidence');
});

test('glyph evidence evicts old entries and long keys, while oversized runs are not retained', async () => {
  let shaped = 0;
  const probe = { toPath: async () => {
    shaped++;
    return { d: '', advanceWidth: 1, bbox: null, notdef: 0 };
  } };
  for (let run = 0; run < 4100; run++) await fontCoversText(style, `Label ${run}`, probe, suse);
  await fontCoversText(style, 'Label 4099', probe, suse);
  assert.equal(shaped, 4100, 'a recent entry remains');
  await fontCoversText(style, 'Label 0', probe, suse);
  assert.equal(shaped, 4101, 'the entry limit evicts the oldest evidence');
  const longRun = 'Long text '.repeat(400);
  for (let run = 0; run < 600; run++) await fontCoversText(style, `${longRun}${run}`, probe, suse);
  const afterLongRuns = shaped;
  await fontCoversText(style, `${longRun}599`, probe, suse);
  assert.equal(shaped, afterLongRuns);
  await fontCoversText(style, `${longRun}0`, probe, suse);
  assert.equal(shaped, afterLongRuns + 1, 'key bytes bound the cache before the entry limit');
  const oversized = 'x'.repeat(1024 * 1024 + 1);
  await fontCoversText(style, oversized, probe, suse);
  await fontCoversText(style, oversized, probe, suse);
  assert.equal(shaped, afterLongRuns + 3, 'oversized evidence is checked each time');
});

test('a failed evicted proof cannot discard newer evidence for the same run', async () => {
  let calls = 0;
  let fail!: (error: Error) => void;
  const probe = { toPath: () => {
    calls++;
    if (calls === 1) return new Promise<{ d: string; advanceWidth: number; bbox: null; notdef: number }>((_resolve, reject) => { fail = reject; });
    return Promise.resolve({ d: '', advanceWidth: 1, bbox: null, notdef: 0 });
  } };
  const pending = fontCoversText(style, 'Original', probe, suse);
  await Promise.resolve();
  for (let run = 0; run < 4100; run++) await fontCoversText(style, `Label ${run}`, probe, suse);
  assert.equal(await fontCoversText(style, 'Original', probe, suse), true);
  const afterReplacement = calls;
  fail(new Error('Late failure'));
  assert.equal(await pending, false);
  assert.equal(await fontCoversText(style, 'Original', probe, suse), true);
  assert.equal(calls, afterReplacement);
});

test('mounted coverage uses inline font changes and whole runs without image labels or script text', () => {
  const dom = new JSDOM('<div id="text">Hello <b>مرحبا</b><svg><title>Artwork</title><path d="M0 0"/></svg><script>ignored()</script><span data-export-hide>Editor</span></div>');
  const root = dom.window.document.querySelector('#text')!;
  const runs = renderedFontRuns(root, element => ({ fontFamily: element.tagName === 'B' ? 'Arabic face' : 'Latin face', fontWeight: '400', fontStyle: 'normal' }) as CSSStyleDeclaration);
  assert.deepEqual(runs.map(run => [run.text, run.style.fontFamily]), [['Hello ', 'Latin face'], ['مرحبا', 'Arabic face']]);
  dom.window.close();
});

test('a line break is layout, not a missing glyph', async () => {
  assert.equal(await fontCoversText(style, 'Must we explain the output?\nCould we show a tested exit?', api, suse), true);
  assert.equal(await fontCoversText(style, 'Tabbed\tand\r\nwrapped', api, suse), true);
  assert.equal(await fontCoversText(style, 'Still checked\nПривет', api, suse), false, 'real script gaps still fail');
});
