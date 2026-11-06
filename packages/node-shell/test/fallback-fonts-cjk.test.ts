// SPDX-License-Identifier: MPL-2.0
/**
 * The Chinese, Japanese and Korean fallback fonts (fallback-fonts.ts `hanForms`,
 * `choosePacks`): which of the four draws a run's Han characters, that a run never takes
 * them from two, that their coverage records match the shipped files, and that a
 * Japanese run's kanji really are the Japanese font's. Shaping runs through real
 * HarfBuzz with the shipped WOFF2 files, so this needs no browser.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  choosePacks, fallbackPacksFrom, hanEvidence, hanFormOfLang, hanForms, hasCjk, packCovers, runLang, uncoveredClusters,
  type FallbackFontPack, type HanForm, type LangElement,
} from '../src/fallback-fonts.ts';
import { nodeFillChain } from '../src/fallback-fonts-node.ts';
import { createNodeTextAPI } from '../src/text.ts';

const REPO = fileURLToPath(new URL('../../../', import.meta.url));
const ROOT = `${REPO}community/fallback-fonts/`;
const SUSE = 'shells/web/public/fonts/SUSE[wght].ttf';
const index = JSON.parse(readFileSync(`${ROOT}index.json`, 'utf8')) as { assets: Array<Record<string, any>> };
const packs = fallbackPacksFrom(index.assets);
const byForm = (form: HanForm): FallbackFontPack => packs.find((p) => p.han === form)!;
const set = (s: string): Set<number> => new Set([...s].map((c) => c.codePointAt(0)!));
const cps = (s: string): number[] => [...s].map((c) => c.codePointAt(0)!);
const ids = (list: readonly FallbackFontPack[]): string[] => list.map((p) => p.id.replace('community/fallback-font/', ''));
/** A brand face with Latin, digits and ASCII punctuation, as Lolly Demo's are. */
const BRAND = set(' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~');

test('four CJK fonts, one per Han form, each OFL and cut to its national set', () => {
  const cjk = packs.filter((p) => p.han);
  assert.deepEqual(cjk.map((p) => [p.family, p.han, p.label]), [
    ['Noto Sans SC', 'zh-Hans', 'Simplified Chinese'],
    ['Noto Sans TC', 'zh-Hant', 'Traditional Chinese'],
    ['Noto Sans JP', 'ja', 'Japanese'],
    ['Noto Sans KR', 'ko', 'Korean'],
  ]);
  for (const entry of index.assets.filter((a) => a.meta.fallbackFont.han)) {
    assert.equal(entry.license, 'OFL-1.1');
    assert.equal(entry.tier, 'on-demand');
    assert.equal(entry.rights.works[0].creators[0].name, 'Adobe', 'the Noto CJK copyright holder');
    assert.equal(entry.meta.fallbackFont.licenceFile, '/catalog/packs/fallback-fonts/OFL-noto-cjk.txt');
    assert.equal(entry.meta.fallbackFont.weight, '100 900', 'the weight axis is whole');
    assert.match(entry.meta.fallbackFont.covers, /U\+4E00-9FFF/);
  }
  // Every Han character of the set, and none of the Latin, Greek or Cyrillic letters the
  // brand and the other packs draw.
  assert.ok(packCovers(byForm('zh-Hans'), cps('们说这个国')), 'GB 2312 hanzi');
  assert.ok(!packCovers(byForm('zh-Hans'), cps('們')), 'a Traditional form is not in GB 2312');
  assert.ok(packCovers(byForm('zh-Hant'), cps('們說這個國體')), 'Big5 hanzi');
  assert.ok(!packCovers(byForm('zh-Hant'), cps('们')), 'a Simplified form is not in Big5');
  assert.ok(packCovers(byForm('ja'), cps('直角ひらがなカタカナ々〆髙﨑ｱｲｳ')), 'JIS X 0208, the Windows kanji and halfwidth kana');
  assert.ok(packCovers(byForm('ko'), cps('한국어똠뷁大韓民國')), 'every Hangul syllable and the KS X 1001 hanja');
  for (const p of packs.filter((q) => q.han)) {
    for (const ch of 'AzΩЖé') assert.ok(!packCovers(p, cps(ch)), `${p.family} leaves ${ch} to the brand and the other packs`);
    assert.ok(packCovers(p, cps('、。「」！（）')), `${p.family} has the punctuation running text uses`);
  }
});

test('the ideograph bitmap records exactly what each shipped file maps', async () => {
  const api = createNodeTextAPI({ repoRoot: REPO });
  for (const p of packs.filter((q) => q.han)) {
    const file = new Set(await api.characters!(p.url));
    let mapped = 0;
    for (let cp = 0x4E00; cp <= 0x9FFF; cp++) {
      const said = packCovers(p, [cp]);
      if (said !== file.has(cp)) assert.fail(`${p.family} U+${cp.toString(16)}: index says ${said}, file says ${file.has(cp)}`);
      if (said) mapped++;
    }
    assert.ok(mapped > 4000, `${p.family} maps ${mapped} unified ideographs`);
    for (const cp of file) if (cp < 0x4E00 || cp > 0x9FFF) assert.ok(packCovers(p, [cp]), `${p.family} U+${cp.toString(16)} is in covers`);
  }
});

test('a language tag names its Han forms', () => {
  const cases: Array<[string | null, HanForm | null]> = [
    ['ja', 'ja'], ['ja-JP', 'ja'], ['ko', 'ko'], ['ko-KR', 'ko'],
    ['zh', 'zh-Hans'], ['zh-CN', 'zh-Hans'], ['zh-Hans', 'zh-Hans'], ['zh-SG', 'zh-Hans'], ['zh-Hans-HK', 'zh-Hans'],
    ['zh-TW', 'zh-Hant'], ['zh-Hant', 'zh-Hant'], ['zh-HK', 'zh-Hant'], ['zh_mo', 'zh-Hant'], ['yue', 'zh-Hant'], ['cmn-Hant', 'zh-Hant'],
    ['en', null], ['en-JP', null], ['', null], [null, null],
  ];
  for (const [tag, form] of cases) assert.equal(hanFormOfLang(tag), form, String(tag));
});

test('the Han rule: language, then kana or Hangul, then Traditional-only characters, then Simplified', () => {
  const doc = (text: string) => hanEvidence(text, packs);
  // 1. The run's language wins over everything its text says.
  assert.deepEqual(hanForms({ lang: 'ja', text: '这是中文' }, packs), ['ja']);
  assert.deepEqual(hanForms({ lang: 'zh-TW', text: '直角', document: doc('ひらがな') }, packs), ['zh-Hant']);
  // A language that is not Chinese, Japanese or Korean says nothing about Han forms.
  assert.deepEqual(hanForms({ lang: 'en', text: '直角です' }, packs), ['ja']);
  // 2. Kana means Japanese and Hangul means Korean, in the run first.
  assert.deepEqual(hanForms({ text: '直角です' }, packs), ['ja']);
  assert.deepEqual(hanForms({ text: '大韓民國 정부' }, packs), ['ko']);
  // ...then in the document, when it holds only one of the two.
  assert.deepEqual(hanForms({ text: '直角', document: doc('これは直角です') }, packs), ['ja'], 'a kanji-only heading in a Japanese document');
  assert.deepEqual(hanForms({ text: '大韓民國', document: doc('대한민국 정부') }, packs), ['ko']);
  assert.deepEqual(hanForms({ text: '直角', document: doc('ひらがな 한글') }, packs), ['zh-Hans'], 'a document with both says neither');
  // 3. A character only Traditional Chinese writes.
  assert.deepEqual(hanForms({ text: '這個體育館' }, packs), ['zh-Hant']);
  assert.deepEqual(hanForms({ text: '天地', document: doc('這個體育館') }, packs), ['zh-Hant']);
  assert.deepEqual(hanForms({ text: '这个體', document: doc('') }, packs), ['zh-Hans'], 'a run holding both forms stays Simplified');
  // 4. The stated default.
  assert.deepEqual(hanForms({ text: '天地人' }, packs), ['zh-Hans']);
  assert.deepEqual(hanForms(undefined, packs), ['zh-Hans']);
  // Kana or Hangul the first font lacks may follow it, for those letters only.
  assert.deepEqual(hanForms({ lang: 'ja', text: '日本 한국' }, packs), ['ja', 'ko']);
  assert.deepEqual(hanForms({ text: '한국 日本 かな' }, packs), ['ko', 'ja']);
});

test('a run takes its Han characters from one font only', () => {
  const run = (text: string, han: HanForm[]) => choosePacks(uncoveredClusters(text, [BRAND]), packs, false, han);
  // The Japanese run's kanji come from the Japanese font, never the Chinese one.
  assert.deepEqual(ids(run('最高の道具は姿を消し、仕事が語る。', ['ja']).packs), ['noto-sans-jp']);
  assert.deepEqual(ids(run('最高の道具は姿を消し、仕事が語る。', ['zh-Hans']).packs), ['noto-sans-sc'], 'GB 2312 has kana, so a Chinese-tagged run stays in one font');
  // A Han character the chosen font lacks stays unfilled, never borrowed from another.
  const jp = run('私们', ['ja']);
  assert.deepEqual(ids(jp.packs), ['noto-sans-jp']);
  assert.deepEqual(jp.unfilled.map((c) => c.text), ['们'], 'Simplified 们 is not in Shift_JIS');
  // Hangul in a Japanese run takes the Korean font, and the Japanese one comes first in the chain.
  assert.deepEqual(ids(run('한국と日本', ['ja', 'ko']).packs), ['noto-sans-jp', 'noto-sans-kr']);
  // ...but not when the Korean font would also draw a Han character the Japanese one lacks.
  const guarded = run('韓国 한국 佈', ['ja', 'ko']);
  assert.ok(!ids(guarded.packs).includes('noto-sans-kr'));
  assert.deepEqual(guarded.unfilled.map((c) => c.text).sort(), ['佈', '한', '국'].sort(), '佈 is a KS X 1001 hanja Shift_JIS lacks');
  // Characters outside every set stay pictures, as before.
  assert.deepEqual(run('𠮷野家', ['ja']).unfilled.map((c) => c.text), ['𠮷']);
});

test('an English line never takes a CJK font, whatever symbols it holds', () => {
  for (const text of ['Rated ★★★ ※ see → ①', 'Price ￥100 ！', '“Quoted” – fine… ‰']) {
    const chosen = choosePacks(uncoveredClusters(text, [BRAND]), packs, false, ['zh-Hans']).packs;
    assert.ok(!chosen.some((p) => p.han), `${text}: ${ids(chosen).join()}`);
  }
  assert.equal(hasCjk('Rated ★★★ ※ see → ①'), false);
  assert.equal(hasCjk('「直」'), true);
});

test("a run's language is its own or an ancestor's, never the page's", () => {
  const html: LangElement & { lang: string } = { lang: 'ja', getAttribute: (n) => (n === 'lang' ? 'ja' : null), parentElement: null, ownerDocument: null };
  const doc = { documentElement: html };
  Object.assign(html, { ownerDocument: doc });
  const el = (lang: string | null, parent: LangElement | null): LangElement => ({ getAttribute: (n) => (n === 'lang' ? lang : null), parentElement: parent, ownerDocument: doc });
  const tool = el(null, html);
  const card = el('zh-Hant', tool);
  assert.equal(runLang(el(null, card)), 'zh-Hant', 'inherited from the tool');
  assert.equal(runLang(el('ko', card)), 'ko', 'its own first');
  assert.equal(runLang(el(null, tool)), null, "the app's language on <html> is the person's, not the document's");
  assert.equal(runLang(null), null);
});

test('real shaping: a Japanese document draws its kanji with Noto Sans JP', async () => {
  const api = createNodeTextAPI({ repoRoot: REPO });
  const characters = (url: string) => api.characters!(url);
  const document = { textContent: '最高の道具は直角に置く。' };
  // A heading of kanji only, in a document whose body has kana: no lang anywhere.
  const fill = await nodeFillChain(characters, [{ fontUrl: SUSE }], [], '直角', { weight: 700, italic: false, place: { document } });
  assert.deepEqual(fill?.fallbacks, [{ fontUrl: byForm('ja').url, variations: ['wght=700'], fill: true }]);
  assert.deepEqual(fill?.uses, [{ label: 'Japanese', family: 'Noto Sans JP' }]);
  const shaped = await api.toPath({ text: '直角', fontUrl: SUSE, fontSize: 64, fallbackFonts: fill!.fallbacks });
  assert.equal(shaped.notdef ?? 0, 0);
  const jp = await api.toPath({ text: '直角', fontUrl: byForm('ja').url, fontSize: 64, variations: ['wght=700'] });
  const sc = await api.toPath({ text: '直角', fontUrl: byForm('zh-Hans').url, fontSize: 64, variations: ['wght=700'] });
  assert.notEqual(jp.d, sc.d, 'the two fonts draw 直 and 角 differently, so the choice shows');
  assert.equal(shaped.d, jp.d, 'the outlines are the Japanese font\'s');
  // The same heading with no Japanese around it takes the stated default.
  const plain = await nodeFillChain(characters, [{ fontUrl: SUSE }], [], '直角', { weight: 700, italic: false });
  assert.deepEqual(plain?.fallbacks.map((f) => f.fontUrl), [byForm('zh-Hans').url]);
  // Bold is bold: the weight axis reaches the CJK font.
  const light = await api.toPath({ text: '直', fontUrl: byForm('ja').url, fontSize: 64, variations: ['wght=300'] });
  const bold = await api.toPath({ text: '直', fontUrl: byForm('ja').url, fontSize: 64, variations: ['wght=900'] });
  assert.notEqual(light.d, bold.d);
});

test('real shaping: brand fonts keep every character they have in a mixed CJK and Latin line', async () => {
  const api = createNodeTextAPI({ repoRoot: REPO });
  const characters = (url: string) => api.characters!(url);
  const text = 'Lolly 2026 で最高の道具';
  const fill = await nodeFillChain(characters, [{ fontUrl: SUSE }], [], text, { weight: 400, italic: false });
  assert.deepEqual(fill?.fallbacks.map((f) => f.fontUrl), [byForm('ja').url]);
  const latin = await api.toPath({ text: 'Lolly 2026 ', fontUrl: SUSE, fontSize: 40, clusters: true });
  const mixed = await api.toPath({ text, fontUrl: SUSE, fontSize: 40, fallbackFonts: fill!.fallbacks, clusters: true });
  assert.equal(mixed.notdef ?? 0, 0);
  // The Latin, the digits and the space are SUSE's outlines, in the same place.
  assert.deepEqual(mixed.clusters!.slice(0, latin.clusters!.length).map((c) => c.d), latin.clusters!.map((c) => c.d));
});
