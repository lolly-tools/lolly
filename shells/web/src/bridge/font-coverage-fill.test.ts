// SPDX-License-Identifier: MPL-2.0
/**
 * The design audit's font check counts the bundled fallback fonts the way an export does
 * (font-coverage.ts over font-fill.ts `fillDrawsAll`). The packs come from the real
 * community/fallback-fonts index, so the check reads the same coverage tables the export
 * chooses from, and the design system's face is the real platform SUSE file.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { createNodeTextAPI } from '../../../../packages/node-shell/src/text.ts';
import { provideFallbackFontSource } from './fallback-font-source.ts';
import { fontCoversText } from './font-coverage.ts';

const root = fileURLToPath(new URL('../../../../', import.meta.url));
const api = createNodeTextAPI({ repoRoot: root });
const index = JSON.parse(readFileSync(new URL('../../../../community/fallback-fonts/index.json', import.meta.url), 'utf8')) as { assets: unknown[] };
const style = { fontFamily: 'SUSE', fontWeight: '400', fontStyle: 'normal' };
const suse = async () => ({ url: '/fonts/SUSE[wght].ttf', variations: ['wght=400'] });

let downloads = 0;
provideFallbackFontSource({
  entries: async () => index.assets,
  bytes: async () => { downloads++; return null; },
  hold: async () => {},
  characters: (url) => api.characters!(url),
});

test('a script a bundled fallback font draws is covered', async () => {
  for (const text of ['Привет мир', 'Καλημέρα', 'مرحبا بالعالم', 'שלום עולם', 'नमस्ते दुनिया', 'নমস্কার', 'สวัสดีชาวโลก', 'Xin chào thế giới']) {
    assert.equal(await fontCoversText(style, text, api, suse), true, text);
  }
  assert.equal(await fontCoversText(style, 'Hello مرحبا and Привет', api, suse), true, 'a mixed line takes each script from its own font');
});

test('Chinese, Japanese and Korean inside the national sets are covered', async () => {
  for (const text of ['你好世界', 'こんにちは世界', '안녕하세요', '這是說明']) {
    assert.equal(await fontCoversText(style, text, api, suse), true, text);
  }
});

test('a script with no fallback font still warns', async () => {
  for (const text of ['வணக்கம்', 'ሰላም ለዓለም', 'ܫܠܡܐ']) {
    assert.equal(await fontCoversText(style, text, api, suse), false, text);
  }
  assert.equal(await fontCoversText(style, 'Hello مرحبا வணக்கம்', api, suse), false, 'one uncovered script is enough');
});

test('Chinese, Japanese and Korean outside the national sets still warn', async () => {
  // U+20BB7 is in Extension B; U+4E02 is in no national set the packs are cut to.
  for (const text of ['𠮷野家', '丂字', '你好丂']) {
    assert.equal(await fontCoversText(style, text, api, suse), false, text);
  }
});

test('the run language chooses the Chinese, Japanese or Korean font as an export does', async () => {
  const dom = new JSDOM('<div id="doc"><p id="ja" lang="ja">說明</p><p id="tw" lang="zh-Hant">說明</p></div>');
  const doc = dom.window.document;
  const rootEl = doc.getElementById('doc')!;
  // 說 is in Big5 but not in JIS X 0208, so the Japanese font an export picks for a
  // Japanese run lacks it, and an export never takes it from the Chinese font instead.
  assert.equal(await fontCoversText(style, '說明', api, suse, { at: doc.getElementById('ja'), root: rootEl }), false);
  assert.equal(await fontCoversText(style, '說明', api, suse, { at: doc.getElementById('tw'), root: rootEl }), true);
  // Kana elsewhere in the document makes a kanji-only run Japanese.
  const kana = new JSDOM('<div id="doc"><p id="name">說明</p><p>ひらがな</p></div>').window.document;
  assert.equal(await fontCoversText(style, '說明', api, suse, { at: kana.getElementById('name'), root: kana.getElementById('doc') }), false);
  dom.window.close();
});

test('ASCII a face cannot draw still warns, because an export never fills ASCII', async () => {
  const probe = { toPath: async () => ({ d: '', advanceWidth: 1, bbox: null, notdef: 1 }) };
  assert.equal(await fontCoversText(style, 'Hello', probe, suse), false);
});

test('the audit reads catalog coverage and downloads no font', async () => {
  await fontCoversText(style, 'مرحبا', api, suse);
  await fontCoversText(style, '안녕하세요', api, suse);
  assert.equal(downloads, 0);
});
