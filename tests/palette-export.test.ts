// SPDX-License-Identifier: MPL-2.0
/**
 * palette-export.ts - the engine's palette-exchange serializers (ENGINE 1.108),
 * lifted out of the web shell's swatch-export.ts so host.color.paletteExport /
 * paletteExportBytes reach every shell. Two parts:
 *
 *   1. the pure serializers, byte-for-byte (the same assertions the web adapter's
 *      swatch-export.test.ts pins, plus the new SCSS writer) - the proof the move
 *      changed no output;
 *   2. the runtime seam - css/scss/gpl are model-derived data formats now, and
 *      `json` became a per-tool opt-in sibling template (model-dump default kept).
 *
 * Run with: node --test tests/palette-export.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  paletteTokensJson, paletteCssVariables, paletteCssClasses,
  paletteScssVariables, paletteGpl, paletteAse,
  type PaletteSwatch,
} from '../engine/src/palette-export.ts';
import { makeColorApi } from '../engine/src/color-tools.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

// The same fixtures swatch-export.test.ts uses, retyped to the engine's minimal
// PaletteSwatch (BrandSwatch's extra fields are irrelevant to the serializers).
const PRIMARY: PaletteSwatch = { key: 'color.ramp.primary.5', name: 'Primary 5', group: 'Primary', hex: '#3355ff' };
const BLUE: PaletteSwatch = { key: 'color.spectrum.blue', name: 'Blue', group: 'Spectrum', hex: '#00aa66' };
const UNRESOLVED: PaletteSwatch = { key: 'color.semantic.primary', name: 'Primary', group: 'Roles · Light', hex: '' };
const FIXTURE: PaletteSwatch[] = [PRIMARY, BLUE, UNRESOLVED];

// ── pure serializers (byte-for-byte parity with the web adapter's suite) ──────

test('paletteTokensJson nests colour leaves by dotted key, and skips unresolved aliases', () => {
  const doc = JSON.parse(paletteTokensJson(FIXTURE));
  assert.deepEqual(doc.color.ramp.primary['5'], { $value: '#3355ff', $type: 'color', $description: 'Primary 5' });
  assert.deepEqual(doc.color.spectrum.blue, { $value: '#00aa66', $type: 'color', $description: 'Blue' });
  assert.equal(doc.color.semantic, undefined); // the unresolved alias must not appear
});

test('paletteCssVariables emits a :root block, one line per resolved swatch', () => {
  const css = paletteCssVariables(FIXTURE);
  assert.match(css, /^:root \{\n/);
  assert.match(css, /\n\}\n$/);
  assert.match(css, /--color-ramp-primary-5: #3355ff;/);
  assert.match(css, /--color-spectrum-blue: #00aa66;/);
  assert.ok(!css.includes('color-semantic-primary'));
  assert.equal(css.split('\n').filter(l => l.trim().startsWith('--')).length, 2);
});

test('paletteCssClasses emits matching bg/text/border rules per resolved swatch', () => {
  const css = paletteCssClasses(FIXTURE);
  assert.match(css, /\.bg-color-ramp-primary-5 \{ background-color: #3355ff; \}/);
  assert.match(css, /\.text-color-ramp-primary-5 \{ color: #3355ff; \}/);
  assert.match(css, /\.border-color-ramp-primary-5 \{ border-color: #3355ff; \}/);
  assert.match(css, /\.bg-color-spectrum-blue \{ background-color: #00aa66; \}/);
  assert.ok(!css.includes('color-semantic-primary'));
});

test('paletteScssVariables emits one $var per resolved swatch, no wrapper block', () => {
  const scss = paletteScssVariables(FIXTURE);
  assert.match(scss, /\$color-ramp-primary-5: #3355ff;/);
  assert.match(scss, /\$color-spectrum-blue: #00aa66;/);
  assert.ok(!scss.includes('color-semantic-primary'));
  assert.ok(!scss.includes(':root'), 'SCSS is a flat variable list, not a :root block');
  assert.equal(scss.endsWith('\n'), true);
  assert.equal(scss.split('\n').filter(l => l.trim().startsWith('$')).length, 2);
});

test('paletteGpl: header lines, then space-padded RGB rows for resolved swatches only', () => {
  const gpl = paletteGpl(FIXTURE, 'My Brand');
  const lines = gpl.split('\n');
  assert.equal(lines[0], 'GIMP Palette');
  assert.equal(lines[1], 'Name: My Brand');
  assert.equal(lines[2], 'Columns: 0');
  assert.equal(lines[3], '#');
  assert.equal(lines[4], ' 51  85 255\tPrimary Primary 5'); // rgb(51,85,255), each padded to width 3
  assert.equal(lines[5], '  0 170 102\tSpectrum Blue');
  assert.equal(lines.filter(l => l && !['GIMP Palette', 'Name: My Brand', 'Columns: 0', '#'].includes(l)).length, 2);
});

test('paletteGpl defaults the palette name when none is given', () => {
  assert.match(paletteGpl(FIXTURE), /^GIMP Palette\nName: Lolly brand\n/);
});

test('paletteAse: header + one colour-entry block per resolved swatch, byte-exact', () => {
  const bytes = paletteAse(FIXTURE);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  const sig = String.fromCharCode(bytes[0]!, bytes[1]!, bytes[2]!, bytes[3]!);
  assert.equal(sig, 'ASEF');
  assert.equal(dv.getUint16(4, false), 1, 'version major');
  assert.equal(dv.getUint16(6, false), 0, 'version minor');
  assert.equal(dv.getUint32(8, false), 2, 'block count == resolved swatch count (unresolved excluded)');

  const headerLen = 12;
  let blockStart = headerLen;

  const readBlock = (expectName: string, expectRgb: [number, number, number]): number => {
    const type = dv.getUint16(blockStart, false);
    assert.equal(type, 0x0001, 'colour-entry block type');
    const dataLen = dv.getUint32(blockStart + 2, false);
    const dataStart = blockStart + 2 + 4;

    const nameUnits = dv.getUint16(dataStart, false);
    let cursor = dataStart + 2;
    let name = '';
    for (let i = 0; i < nameUnits; i++) {
      name += String.fromCharCode(dv.getUint16(cursor, false));
      cursor += 2;
    }
    // UTF-16BE, null-terminated; nameUnits includes that terminator.
    assert.equal(name, `${expectName}\u0000`);
    assert.equal(nameUnits, expectName.length + 1);

    const model = String.fromCharCode(bytes[cursor]!, bytes[cursor + 1]!, bytes[cursor + 2]!, bytes[cursor + 3]!);
    assert.equal(model, 'RGB ');
    cursor += 4;

    const r = dv.getFloat32(cursor, false); cursor += 4;
    const g = dv.getFloat32(cursor, false); cursor += 4;
    const b = dv.getFloat32(cursor, false); cursor += 4;
    assert.ok(Math.abs(r - expectRgb[0] / 255) < 1e-5);
    assert.ok(Math.abs(g - expectRgb[1] / 255) < 1e-5);
    assert.ok(Math.abs(b - expectRgb[2] / 255) < 1e-5);

    const colourType = dv.getUint16(cursor, false); cursor += 2;
    assert.equal(colourType, 2, 'colour type: Normal');
    assert.equal(cursor - dataStart, dataLen, 'data length field is not off by the 6-byte block header');
    return blockStart + 2 + 4 + dataLen;
  };

  blockStart = readBlock('Primary Primary 5', [51, 85, 255]);
  blockStart = readBlock('Spectrum Blue', [0, 170, 102]);
  assert.equal(blockStart, bytes.length, 'second block is the last - consumes exactly to EOF');
});

test('makeColorApi wires the serializers verbatim (text) and paletteExportBytes (ase)', () => {
  const api: any = makeColorApi();
  assert.equal(api.paletteExport(FIXTURE, 'tokens-json'), paletteTokensJson(FIXTURE));
  assert.equal(api.paletteExport(FIXTURE, 'css-vars'), paletteCssVariables(FIXTURE));
  assert.equal(api.paletteExport(FIXTURE, 'css-classes'), paletteCssClasses(FIXTURE));
  assert.equal(api.paletteExport(FIXTURE, 'scss'), paletteScssVariables(FIXTURE));
  assert.equal(api.paletteExport(FIXTURE, 'gpl', { paletteName: 'ACME' }), paletteGpl(FIXTURE, 'ACME'));
  assert.deepEqual(api.paletteExportBytes(FIXTURE, 'ase'), paletteAse(FIXTURE));
});

// ── runtime seam: css/scss/gpl data formats + json opt-in sibling template ────

const DATA_TOOL: Record<string, string> = {
  'datax/tool.json': JSON.stringify({
    id: 'datax', name: 'D', version: '1.0.0', engineVersion: '^1.0.0',
    status: 'community', category: 'utility',
    render: { width: 10, height: 10, formats: ['json', 'css', 'scss', 'gpl'] },
    hooks: { onInit: true },
    inputs: [{ id: 'label', type: 'text', default: 'Hi' }],
  }),
  'datax/template.html': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
  'datax/template.json': '{"custom":"{{label}}"}',
  'datax/template.css': ':root{ --x: {{label}}; }',
  'datax/template.scss': '$x: {{label}};',
  'datax/template.gpl': 'GIMP Palette\nName: {{label}}\n',
  'datax/hooks.js': 'function onInit(){ return {}; }',
};
const fetchData = async (p: string): Promise<string> => {
  const t = DATA_TOOL[p]; if (t === undefined) throw new Error(`404: ${p}`); return t;
};

// Wrapping host: host.export.render just wraps the engine-hydrated dataText, like
// the CLI bridge - so the test pins the ENGINE payload, not any shell rendering.
function dataHost(): any {
  const host: any = baseHost({ color: makeColorApi() });
  host.export = {
    render: async (_n: unknown, _f: string, opts: any) =>
      new Blob([opts.dataText ?? '<no-data>'], { type: opts.dataMime ?? 'text/plain' }),
  };
  return host;
}

async function exportText(tool: any, format: string): Promise<{ text: string; mime: string }> {
  const rt = await createRuntime(tool, dataHost(), {});
  const blob = await rt.export({}, format, { embedMeta: false });
  return { text: await blob.text(), mime: blob.type };
}

test('runtime: css/scss/gpl are model-derived data formats (dataText + right MIME)', async () => {
  const tool: any = await loadTool('datax', fetchData);
  const css = await exportText(tool, 'css');
  assert.equal(css.text, ':root{ --x: Hi; }');
  assert.equal(css.mime, 'text/css');

  const scss = await exportText(tool, 'scss');
  assert.equal(scss.text, '$x: Hi;');
  assert.equal(scss.mime, 'text/x-scss');

  const gpl = await exportText(tool, 'gpl');
  assert.equal(gpl.text, 'GIMP Palette\nName: Hi\n');
  assert.equal(gpl.mime, 'text/plain');
});

test('runtime: json uses a sibling template.json when the tool ships one', async () => {
  const tool: any = await loadTool('datax', fetchData);
  const json = await exportText(tool, 'json');
  assert.equal(json.mime, 'application/json');
  assert.deepEqual(JSON.parse(json.text), { custom: 'Hi' }); // template.json, NOT the model dump
});

test('runtime: json falls back to the {tool,version,inputs} model dump with no template.json', async () => {
  // Same manifest, but this fetch 404s template.json - the default must return.
  const noJsonFetch = async (p: string): Promise<string> => {
    if (p === 'datax/template.json') throw new Error('404');
    return fetchData(p);
  };
  const tool: any = await loadTool('datax', noJsonFetch);
  const json = await exportText(tool, 'json');
  const doc = JSON.parse(json.text);
  assert.equal(doc.tool, 'datax');
  assert.equal(doc.version, '1.0.0');
  assert.deepEqual(doc.inputs, { label: 'Hi' });
  assert.equal(doc.custom, undefined, 'the model dump must not carry the template.json shape');
});

// ── fonts ride along (plans/173 slice 1) ─────────────────────────────────────

test('paletteTokensJson: opts.fonts emit fontFamilies tokens under font.<role>', () => {
  const swatches = [{ key: 'color.brand.primary', name: 'Primary', group: 'Brand', hex: '#30ba78' }];
  const doc = JSON.parse(paletteTokensJson(swatches, {
    fonts: [
      { role: 'brand', families: ['Inter', 'sans-serif'] },
      { role: 'mono', families: ['JetBrains Mono'] },
      { role: 'display', families: [] },              // empty role: no token
    ],
  }));
  assert.deepEqual(doc.font, {
    brand: { $value: ['Inter', 'sans-serif'], $type: 'fontFamilies' },
    mono: { $value: ['JetBrains Mono'], $type: 'fontFamilies' },
  });
  // the colour leaves are untouched beside them
  assert.equal(doc.color.brand.primary.$value, '#30ba78');
});

test('paletteTokensJson: no opts stays byte-identical to the one-argument call', () => {
  const swatches = [{ key: 'color.brand.primary', name: 'Primary', group: 'Brand', hex: '#30ba78' }];
  assert.equal(paletteTokensJson(swatches), paletteTokensJson(swatches, {}));
  assert.equal(paletteTokensJson(swatches), paletteTokensJson(swatches, { fonts: [] }));
});

// ── v1.281: what each format carries beyond the sRGB hex ─────────────────────

/** Read an .ase back: each colour entry's name, model, values and type. */
function readAse(bytes: Uint8Array): { name: string; model: string; values: number[]; type: number }[] {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'ASEF');
  const count = dv.getUint32(8, false);
  const out: { name: string; model: string; values: number[]; type: number }[] = [];
  let o = 12;
  for (let i = 0; i < count; i++) {
    assert.equal(dv.getUint16(o, false), 1, 'colour entry block'); o += 2;
    const len = dv.getUint32(o, false); o += 4;
    const end = o + len;
    const units = dv.getUint16(o, false); o += 2;
    let name = '';
    for (let u = 0; u < units - 1; u++) name += String.fromCharCode(dv.getUint16(o + u * 2, false));
    o += units * 2;
    const model = String.fromCharCode(...bytes.slice(o, o + 4)); o += 4;
    const n = model === 'CMYK' ? 4 : model === 'Gray' ? 1 : 3;
    const values: number[] = [];
    for (let k = 0; k < n; k++) { values.push(dv.getFloat32(o, false)); o += 4; }
    const type = dv.getUint16(o, false); o += 2;
    assert.equal(o, end, `${name}: block length matches its contents`);
    out.push({ name, model, values, type });
  }
  return out;
}

const vivid: PaletteSwatch = { key: 'color.brand.vivid', name: 'Vivid', group: 'Brand', hex: '#00ff00', css: 'color(display-p3 0 1 0)' };
const deep: PaletteSwatch = { key: 'color.brand.deep', name: 'Deep', group: 'Brand', hex: '#00ff8a', css: 'oklch(85% 0.33 150)' };
const pine: PaletteSwatch = { key: 'color.brand.pine', name: 'Pine', group: 'Brand', hex: '#0c322c', cmyk: [65, 0, 35, 85] };
const gold: PaletteSwatch = { key: 'color.brand.gold', name: 'Gold', group: 'Brand', hex: '#c9a227', spot: { name: 'PANTONE 871 C', book: 'PANTONE+ Metallics' } };
const signal: PaletteSwatch = { key: 'color.brand.signal', name: 'Signal', group: 'Brand', hex: '#c8102e', cmyk: [0, 100, 85, 6], spot: { name: 'PANTONE 186 C' } };
const plain: PaletteSwatch = { key: 'color.brand.plain', name: 'Plain', group: 'Brand', hex: '#336699' };

test('1.281 css-vars: a colour wider than sRGB is set again under @supports for its own notation', () => {
  const css = paletteCssVariables([plain, vivid, deep]);
  assert.match(css, /^:root \{\n {2}--color-brand-plain: #336699;\n {2}--color-brand-vivid: #00ff00;\n {2}--color-brand-deep: #00ff8a;\n\}\n/);
  assert.match(css, /@supports \(color: color\(display-p3 0 1 0\)\) \{\n {2}:root \{\n {4}--color-brand-vivid: color\(display-p3 0 1 0\);\n {2}\}\n\}\n/);
  assert.match(css, /@supports \(color: oklch\(85% 0\.33 150\)\) \{\n {2}:root \{\n {4}--color-brand-deep: oklch\(85% 0\.33 150\);/);
  assert.equal((css.match(/@supports/g) ?? []).length, 2, 'one block per notation');
});

test('1.281 css-classes: the wider colour is declared after the hex, which a browser keeps when it cannot parse the wider one', () => {
  assert.match(paletteCssClasses([vivid]), /\.bg-color-brand-vivid \{ background-color: #00ff00; background-color: color\(display-p3 0 1 0\); \}/);
});

test('1.281 tokens JSON: $value stays the hex; the face, CMYK build and spot ink sit under com.suse.lolly', () => {
  const doc = JSON.parse(paletteTokensJson([vivid, pine, gold, plain]));
  assert.equal(doc.color.brand.vivid.$value, '#00ff00');
  assert.deepEqual(doc.color.brand.vivid.$extensions, { 'com.suse.lolly': { faces: { 'display-p3': { value: 'color(display-p3 0 1 0)' } } } });
  assert.deepEqual(doc.color.brand.pine.$extensions, { 'com.suse.lolly': { cmyk: [65, 0, 35, 85] } });
  assert.deepEqual(doc.color.brand.gold.$extensions, { 'com.suse.lolly': { spot: { name: 'PANTONE 871 C', book: 'PANTONE+ Metallics' } } });
  assert.equal(doc.color.brand.plain.$extensions, undefined, 'nothing to add, nothing added');
  // A colour past Display-P3 is a Rec.2020 face.
  const wider = JSON.parse(paletteTokensJson([deep]));
  assert.ok(wider.color.brand.deep.$extensions['com.suse.lolly'].faces.rec2020);
});

test('1.281 .ase: CMYK lock → CMYK swatch, spot → Spot swatch under the ink name, wider colour → Lab, the rest RGB', () => {
  const entries = readAse(paletteAse([plain, pine, gold, signal, vivid]));
  const by = Object.fromEntries(entries.map(e => [e.name, e]));
  assert.deepEqual(by['Brand Plain']!.model, 'RGB ');
  assert.equal(by['Brand Plain']!.type, 2);

  assert.equal(by['Brand Pine']!.model, 'CMYK');
  assert.deepEqual(by['Brand Pine']!.values.map(v => Math.round(v * 100)), [65, 0, 35, 85]);
  assert.equal(by['Brand Pine']!.type, 2);

  assert.equal(by['PANTONE 186 C']!.model, 'CMYK', 'a spot with a CMYK build uses the build');
  assert.equal(by['PANTONE 186 C']!.type, 1, 'Spot');
  assert.equal(by['PANTONE 871 C']!.model, 'LAB ', 'a spot with no build is defined by its Lab');
  assert.equal(by['PANTONE 871 C']!.type, 1);

  const lab = by['Brand Vivid']!;
  assert.equal(lab.model, 'LAB ');
  // L in 0..1, a and b as they are: Display-P3 green is roughly L 86.6, a -106.5, b 102.9 (D50).
  assert.ok(Math.abs(lab.values[0]! - 0.866) < 0.002, `L ${lab.values[0]}`);
  assert.ok(Math.abs(lab.values[1]! + 106.5) < 0.2 && Math.abs(lab.values[2]! - 102.9) < 0.2, `a/b ${lab.values}`);
});

test('1.281: a value that is not a colour never reaches a stylesheet, and an sRGB value adds nothing', () => {
  const hostile: PaletteSwatch = { ...plain, css: 'red; } body { display: none' };
  const srgb: PaletteSwatch = { ...plain, css: 'color(srgb 0.2 0.4 0.6)' };
  for (const s of [hostile, srgb]) {
    assert.equal(paletteCssVariables([s]), paletteCssVariables([plain]));
    assert.equal(paletteCssClasses([s]), paletteCssClasses([plain]));
    assert.equal(paletteTokensJson([s]), paletteTokensJson([plain]));
    assert.deepEqual(paletteAse([s]), paletteAse([plain]));
  }
});

test('1.281: SCSS and .gpl stay sRGB whatever the swatch carries', () => {
  assert.equal(paletteScssVariables([{ ...vivid, cmyk: [1, 2, 3, 4] }]), paletteScssVariables([{ ...vivid, css: undefined }]));
  assert.equal(paletteGpl([gold, vivid]), paletteGpl([{ ...gold, spot: undefined }, { ...vivid, css: undefined }]));
});

test('1.281 tokens JSON reads back through Lolly\'s own token reader with its face, CMYK build and spot ink', () => {
  const doc = JSON.parse(paletteTokensJson([vivid, gold, signal]));
  const back = Object.fromEntries(createTokenSet(doc).colors().map(c => [c.name, c]));
  assert.equal(back.Vivid!.value, '#00ff00');
  assert.deepEqual(back.Vivid!.faces, { 'display-p3': 'color(display-p3 0 1 0)' });
  assert.deepEqual(back.Gold!.spot, { name: 'PANTONE 871 C', book: 'PANTONE+ Metallics' });
  assert.deepEqual(back.Signal!.cmyk, [0, 100, 85, 6]);
  assert.equal(back.Signal!.spot?.name, 'PANTONE 186 C');
});
