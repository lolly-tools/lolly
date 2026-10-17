// SPDX-License-Identifier: MPL-2.0
/**
 * font-inspect + font-subset-policy: what a real font's tables say, the fsType
 * and outline refusals, and a subset through the shipped Skera WASM whose output
 * bytes are checked. The fixture is the shipped Outfit variable TTF; refusals use
 * copies of it with one OS/2 field or directory tag patched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { inspectFont, glyphsForText, subsetFontForText, coverageByBlock, createFontsAPI, type FontSubsetRunner } from '../engine/src/font-inspect.ts';
import { fontSubsetRefusal, readSfntDirectory, FONT_SUBSET_REFUSALS } from '../engine/src/font-subset-policy.ts';
import { sfntToWoff, sfntKind } from '../engine/src/font-convert.ts';
import { createNodeFontsAPI } from '../packages/node-shell/src/fonts.ts';
import { subsetWithSkera, type SkeraWasm } from '../packages/node-shell/src/font-subset-wasm.ts';

const OUTFIT = new Uint8Array(readFileSync(new URL('../shells/web/public/fonts/Outfit[wght].ttf', import.meta.url)));
const SKERA = readFileSync(new URL('../packages/node-shell/wasm/skera/skera.wasm', import.meta.url));

function tableOffset(bytes: Uint8Array, tag: string): { entry: number; off: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < view.getUint16(4); i++) {
    const entry = 12 + i * 16;
    if (String.fromCharCode(...bytes.subarray(entry, entry + 4)) === tag) return { entry, off: view.getUint32(entry + 8) };
  }
  throw new Error(`no ${tag}`);
}

function withFsType(fsType: number): Uint8Array {
  const copy = OUTFIT.slice();
  new DataView(copy.buffer).setUint16(tableOffset(copy, 'OS/2').off + 8, fsType);
  return copy;
}

function withoutOs2(): Uint8Array {
  const copy = OUTFIT.slice();
  copy.set([0x4f, 0x53, 0x2f, 0x58], tableOffset(copy, 'OS/2').entry); // 'OS/X': the reader no longer finds it
  return copy;
}

/** A minimal CFF-flavoured sfnt with real table records: OTTO with head, maxp, OS/2 and a CFF table. */
function cffFont(): Uint8Array {
  const tables: Array<[string, number]> = [['CFF ', 8], ['OS/2', 96], ['head', 54], ['maxp', 6]];
  const out = new Uint8Array(12 + tables.length * 16 + tables.reduce((n, [, len]) => n + len, 0));
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x4f54544f);
  view.setUint16(4, tables.length);
  let off = 12 + tables.length * 16;
  tables.forEach(([tag, len], i) => {
    out.set([...tag].map((c) => c.charCodeAt(0)), 12 + i * 16);
    view.setUint32(12 + i * 16 + 8, off);
    view.setUint32(12 + i * 16 + 12, len);
    if (tag === 'head') view.setUint16(off + 18, 1000);
    if (tag === 'maxp') view.setUint16(off + 4, 3);
    if (tag === 'OS/2') view.setUint16(off + 4, 700);
    off += len;
  });
  return out;
}

const skeraRunner = (calls: { count: number } = { count: 0 }): FontSubsetRunner => ({
  policy: 'test-skera',
  async run(sfnt, glyphs) {
    calls.count++;
    const { instance } = await WebAssembly.instantiate(SKERA);
    return subsetWithSkera(instance.exports as unknown as SkeraWasm, sfnt, glyphs);
  },
});

test('inspection reads names, weights, axes, instances, coverage and fsType off a real variable face', () => {
  const info = inspectFont(OUTFIT);
  assert.equal(info.container, 'ttf');
  assert.equal(info.outlines, 'truetype');
  assert.equal(info.family, 'Outfit');
  assert.equal(info.glyphs, 416);
  assert.equal(info.unitsPerEm, 1000);
  assert.deepEqual(info.weight, { value: 100, min: 100, max: 900 });
  assert.deepEqual(info.axes.map((axis) => [axis.tag, axis.min, axis.default, axis.max, axis.hidden]), [['wght', 100, 100, 900, false]]);
  assert.deepEqual(info.instances.map((instance) => instance.name), ['Thin', 'ExtraLight', 'Light', 'Regular', 'Medium', 'SemiBold', 'Bold', 'ExtraBold', 'Black']);
  assert.deepEqual(info.instances.find((instance) => instance.name === 'Bold')?.axes, { wght: 700 });
  assert.equal(info.coverage.characters, info.coverage.ranges.reduce((n, [a, b]) => n + b - a + 1, 0));
  assert.equal(info.coverage.blocks.reduce((n, block) => n + block.characters, 0), info.coverage.characters);
  const latin = info.coverage.blocks.find((block) => block.name === 'Basic Latin')!;
  assert.ok(latin.characters >= 95, 'every printable ASCII character is mapped');
  assert.deepEqual(info.embedding, { permission: 'installable', noSubsetting: false, bitmapOnly: false, fsType: 0 });
  assert.equal(info.subsetRefusal, null);
});

test('a WOFF wrapper reports the same facts with its own container', () => {
  const woff = inspectFont(sfntToWoff(OUTFIT));
  const ttf = inspectFont(OUTFIT);
  assert.equal(woff.container, 'woff');
  assert.deepEqual({ ...woff, container: 'ttf' }, ttf);
});

test('unreadable inputs are refused by name, never guessed at', () => {
  const woff2 = OUTFIT.slice(); woff2.set([0x77, 0x4f, 0x46, 0x32]);
  assert.throws(() => inspectFont(woff2), /WOFF2/);
  const collection = OUTFIT.slice(); collection.set([0x74, 0x74, 0x63, 0x66]);
  assert.throws(() => inspectFont(collection), /collections/);
  assert.throws(() => inspectFont(new Uint8Array([1, 2, 3, 4, 5])), /does not look like a font/);
  assert.throws(() => inspectFont(OUTFIT.subarray(0, 40)), /directory could not be read/);
});

test('fsType restrictions and missing statements refuse a subset; permissive values do not', () => {
  const cases: Array<[Uint8Array, string, string | null]> = [
    [withFsType(0x0002), 'restricted', 'restricted'],
    [withFsType(0x0100), 'installable', 'no-subsetting'],
    [withFsType(0x0200), 'installable', 'bitmap-only'],
    [withFsType(0x0004), 'preview-print', null],
    [withFsType(0x0008), 'editable', null],
    [withFsType(0x000e), 'restricted', 'restricted'],
    [withFsType(0x0001), 'restricted', 'restricted'],
    [withoutOs2(), 'unstated', 'unstated'],
  ];
  for (const [bytes, permission, refusal] of cases) {
    const info = inspectFont(bytes);
    assert.equal(info.embedding.permission, permission);
    assert.equal(info.subsetRefusal, refusal);
    assert.equal(fontSubsetRefusal(bytes), refusal);
  }
});

test('CFF outlines are reported and refused for subsetting, which would drop them', () => {
  const bytes = cffFont();
  const info = inspectFont(bytes);
  assert.equal(info.container, 'otf');
  assert.equal(info.outlines, 'cff');
  assert.equal(info.weight.value, 700);
  assert.equal(info.subsetRefusal, 'outlines');
  assert.equal(fontSubsetRefusal(bytes), 'outlines');
  assert.equal(fontSubsetRefusal(new Uint8Array([1, 2, 3])), 'unreadable');
  assert.ok(readSfntDirectory(bytes)?.tables.has('CFF '));
});

test('text maps to glyph ids through the cmap; control characters and line breaks are ignored', () => {
  const { glyphs, kept, missing } = glyphsForText(OUTFIT, 'Hello\nHello\t漢');
  assert.deepEqual(kept, [...'Helo'].map((c) => c.codePointAt(0)!).sort((a, b) => a - b));
  assert.deepEqual(missing, [0x6f22]);
  assert.equal(glyphs.length, 4);
  assert.ok(glyphs.every((id) => id > 0 && id < 416));
});

test('a Skera subset keeps the chosen characters on their original glyphs and is verified', async () => {
  const result = await subsetFontForText(OUTFIT, { text: 'Hello, Wörld! 漢' }, skeraRunner());
  assert.equal(sfntKind(result.bytes), 'ttf');
  assert.ok(result.bytes.length < OUTFIT.length / 2, `${result.bytes.length} < ${OUTFIT.length / 2}`);
  assert.equal(result.report.policy, 'test-skera');
  assert.equal(result.report.characters, 12);
  assert.equal(result.report.kept, 11);
  assert.deepEqual(result.report.missing, ['漢']);
  assert.equal(result.report.inputBytes, OUTFIT.length);
  assert.equal(result.report.outputBytes, result.bytes.length);
  assert.equal(result.report.fsType, 0);
  const before = glyphsForText(OUTFIT, 'Hello, Wörld!');
  const after = glyphsForText(result.bytes, 'Hello, Wörld!');
  assert.deepEqual(after, before);
  assert.equal(inspectFont(result.bytes).axes.length, 1, 'variation data survives');
});

test('a WOFF source subsets to a plain TrueType sfnt', async () => {
  const result = await subsetFontForText(sfntToWoff(OUTFIT), { text: 'abc' }, skeraRunner());
  assert.equal(sfntKind(result.bytes), 'ttf');
  assert.equal(result.report.kept, 3);
});

test('a refused font never reaches the subsetter', async () => {
  const calls = { count: 0 };
  for (const [bytes, code] of [[withFsType(0x0002), 'restricted'], [withFsType(0x0100), 'no-subsetting'], [cffFont(), 'outlines'], [withoutOs2(), 'unstated']] as const) {
    await assert.rejects(subsetFontForText(bytes, { text: 'abc' }, skeraRunner(calls)), (error: Error & { code?: string }) => {
      assert.equal(error.code, code);
      assert.equal(error.message, FONT_SUBSET_REFUSALS[code]);
      return true;
    });
  }
  assert.equal(calls.count, 0);
  await assert.rejects(subsetFontForText(OUTFIT, { text: '漢字' }, skeraRunner(calls)), { code: 'no-characters' });
  await assert.rejects(subsetFontForText(OUTFIT, { text: '\n\t' }, skeraRunner(calls)), /Type the characters/);
  assert.equal(calls.count, 0);
});

test('the runtime itself refuses a restricted font, whoever calls it', async () => {
  const { instance } = await WebAssembly.instantiate(SKERA);
  const wasm = instance.exports as unknown as SkeraWasm;
  assert.throws(() => subsetWithSkera(wasm, withFsType(0x0002), [1, 2]), { code: 'restricted' });
  assert.throws(() => subsetWithSkera(wasm, withFsType(0x0100), [1, 2]), { code: 'no-subsetting' });
  assert.throws(() => subsetWithSkera(wasm, cffFont(), [1]), { code: 'outlines' });
  assert.ok(subsetWithSkera(wasm, withFsType(0x0008), [1, 2]).length > 0, 'editable embedding permits a subset');
});

test('output that fails the check is refused rather than returned', async () => {
  const garbage: FontSubsetRunner = { policy: 'x', run: async () => new Uint8Array([1, 2, 3, 4]) };
  await assert.rejects(subsetFontForText(OUTFIT, { text: 'a' }, garbage), { code: 'verification', message: /not a readable font/ });
  const changedFlags: FontSubsetRunner = { policy: 'x', run: async () => withFsType(0x0008) };
  await assert.rejects(subsetFontForText(OUTFIT, { text: 'a' }, changedFlags), /embedding flags changed/);
  const emptied: FontSubsetRunner = {
    policy: 'x',
    async run(sfnt, glyphs) {
      const out = await skeraRunner().run(sfnt, glyphs);
      // Hide the output's cmap from the reader, so 'a' no longer maps to its glyph.
      out.set([0x63, 0x6d, 0x61, 0x58], tableOffset(out, 'cmap').entry);
      return out;
    },
  };
  await assert.rejects(subsetFontForText(OUTFIT, { text: 'a' }, emptied), /no longer maps to its glyph/);
});

test('block counts split ranges across blocks and keep the remainder as Other', () => {
  assert.deepEqual(coverageByBlock([[0x41, 0x5a], [0x7e, 0x81], [0x10fffd, 0x10fffd]]), [
    { name: 'Basic Latin', first: 0, last: 0x7f, characters: 28 },
    { name: 'Latin-1 Supplement', first: 0x80, last: 0xff, characters: 2 },
    { name: 'Other', first: 0x10fffd, last: 0x10fffd, characters: 1 },
  ]);
});

test('the Node host.fonts surface inspects and subsets with the committed WASM', async () => {
  const fonts = createNodeFontsAPI();
  assert.equal((await fonts.inspect(OUTFIT)).family, 'Outfit');
  const { bytes, report } = await fonts.subset(OUTFIT, { text: 'Lolly' });
  assert.equal(report.kept, 4);
  assert.match(report.policy, /^skera-/);
  assert.ok(inspectFont(bytes).coverage.characters >= 4);
  await assert.rejects(fonts.subset(withFsType(0x0002), { text: 'Lolly' }), { code: 'restricted' });
  const shared = createFontsAPI(skeraRunner());
  assert.deepEqual((await shared.subset(OUTFIT, { text: 'Lolly' })).bytes, bytes);
});
