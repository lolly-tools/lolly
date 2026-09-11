// SPDX-License-Identifier: MPL-2.0
/**
 * swatch-export.ts - the pure palette-download formatters behind the brand
 * editor's Palette panel "Download all as" control.
 *
 * Run with: node --test "shells/web/src/**\/*.test.ts"
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { BrandSwatch } from './brand-doc.ts';
import {
  swatchesToTokensJson, swatchesToCssVariables, swatchesToCssClasses,
  swatchesToScssVariables, swatchesToGpl, swatchesToAse, exportSwatches,
  type SwatchExportFormat,
} from './swatch-export.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

/** A structurally-valid BrandSwatch fixture; only the fields the formatters
 *  actually read need to be semantically meaningful. */
function sw(overrides: Partial<BrandSwatch> & Pick<BrandSwatch, 'key' | 'name' | 'group' | 'hex'>): BrandSwatch {
  return {
    path: overrides.key.split('.'),
    raw: overrides.hex || '{alias}',
    isAlias: !overrides.hex,
    kind: 'ramp',
    set: null,
    deletable: true,
    lock: null,
    ...overrides,
  };
}

const PRIMARY = sw({ key: 'color.ramp.primary.5', name: 'Primary 5', group: 'Primary', hex: '#3355ff' });
const BLUE = sw({ key: 'color.spectrum.blue', name: 'Blue', group: 'Spectrum', hex: '#00aa66', kind: 'spectrum' });
const UNRESOLVED = sw({ key: 'color.semantic.primary', name: 'Primary', group: 'Roles · Light', hex: '', kind: 'semantic', deletable: false });

const FIXTURE: BrandSwatch[] = [PRIMARY, BLUE, UNRESOLVED];

test('swatchesToTokensJson nests colour leaves by dotted key, and skips unresolved aliases', () => {
  const doc = JSON.parse(swatchesToTokensJson(FIXTURE));
  assert.deepEqual(doc.color.ramp.primary['5'], { $value: '#3355ff', $type: 'color', $description: 'Primary 5' });
  assert.deepEqual(doc.color.spectrum.blue, { $value: '#00aa66', $type: 'color', $description: 'Blue' });
  // The unresolved alias ('color.semantic.primary') has no hex - it must not appear at all.
  assert.equal(doc.color.semantic, undefined);
});

test('swatchesToCssVariables emits a :root block, one line per resolved swatch', () => {
  const css = swatchesToCssVariables(FIXTURE);
  assert.match(css, /^:root \{\n/);
  assert.match(css, /\n\}\n$/);
  assert.match(css, /--color-ramp-primary-5: #3355ff;/);
  assert.match(css, /--color-spectrum-blue: #00aa66;/);
  // Unresolved swatches are omitted, not emitted with a blank value.
  assert.ok(!css.includes('color-semantic-primary'));
  assert.equal(css.split('\n').filter(l => l.trim().startsWith('--')).length, 2);
});

test('swatchesToCssClasses emits matching bg/text/border rules per resolved swatch', () => {
  const css = swatchesToCssClasses(FIXTURE);
  assert.match(css, /\.bg-color-ramp-primary-5 \{ background-color: #3355ff; \}/);
  assert.match(css, /\.text-color-ramp-primary-5 \{ color: #3355ff; \}/);
  assert.match(css, /\.border-color-ramp-primary-5 \{ border-color: #3355ff; \}/);
  assert.match(css, /\.bg-color-spectrum-blue \{ background-color: #00aa66; \}/);
  assert.ok(!css.includes('color-semantic-primary'));
});

test('swatchesToScssVariables emits one $var line per resolved swatch, no wrapper block', () => {
  const scss = swatchesToScssVariables(FIXTURE);
  assert.match(scss, /^\$color-ramp-primary-5: #3355ff;$/m);
  assert.match(scss, /^\$color-spectrum-blue: #00aa66;$/m);
  // Unresolved swatches are omitted, and SCSS has no :root to wrap them in.
  assert.ok(!scss.includes('color-semantic-primary'));
  assert.ok(!scss.includes(':root'));
  assert.equal(scss.split('\n').filter(l => l.startsWith('$')).length, 2);
});

test('swatchesToGpl: header lines, then space-padded RGB rows for resolved swatches only', () => {
  const gpl = swatchesToGpl(FIXTURE, 'My Brand');
  const lines = gpl.split('\n');
  assert.equal(lines[0], 'GIMP Palette');
  assert.equal(lines[1], 'Name: My Brand');
  assert.equal(lines[2], 'Columns: 0');
  assert.equal(lines[3], '#');
  // rgb(51,85,255) → ' 51  85 255' (each channel space-padded to width 3).
  assert.equal(lines[4], ' 51  85 255\tPrimary Primary 5');
  assert.equal(lines[5], '  0 170 102\tSpectrum Blue');
  // Only 2 resolved rows - the unresolved alias contributes nothing.
  assert.equal(lines.filter(l => l && !['GIMP Palette', 'Name: My Brand', 'Columns: 0', '#'].includes(l)).length, 2);
});

test('swatchesToAse: header + one colour-entry block per resolved swatch, byte-exact', () => {
  const bytes = swatchesToAse(FIXTURE);
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // Signature + version + block count.
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
    // Data starts right after the u16 type + u32 length fields - NOT at blockStart.
    const dataStart = blockStart + 2 + 4;

    const nameUnits = dv.getUint16(dataStart, false);
    let cursor = dataStart + 2;
    let name = '';
    for (let i = 0; i < nameUnits; i++) {
      name += String.fromCharCode(dv.getUint16(cursor, false));
      cursor += 2;
    }
    // UTF-16BE, null-terminated; nameUnits includes that terminator.
    assert.equal(name, `${expectName}\0`);
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

    // The bytes consumed after the data-length field must equal dataLen exactly
    // (measured from dataStart, not from blockStart).
    assert.equal(cursor - dataStart, dataLen, 'data length field is not off by the 6-byte block header');

    return blockStart + 2 + 4 + dataLen; // next block's start
  };

  blockStart = readBlock('Primary Primary 5', [51, 85, 255]);
  blockStart = readBlock('Spectrum Blue', [0, 170, 102]);
  assert.equal(blockStart, bytes.length, 'second block is the last - consumes exactly to EOF');
});

test('exportSwatches: filename slugs the palette name, and picks the right MIME per format', () => {
  const tokens = exportSwatches(FIXTURE, 'tokens-json', 'My  Brand!! 2026');
  assert.equal(tokens.filename, 'my-brand-2026-tokens.json');
  assert.equal(tokens.blob.type, 'application/json');

  const vars = exportSwatches(FIXTURE, 'css-vars', 'My  Brand!! 2026');
  assert.equal(vars.filename, 'my-brand-2026-variables.css');
  assert.equal(vars.blob.type, 'text/css');

  const classes = exportSwatches(FIXTURE, 'css-classes');
  assert.equal(classes.filename, 'lolly-brand-classes.css');

  const gpl = exportSwatches(FIXTURE, 'gpl', 'ACME Corp');
  assert.equal(gpl.filename, 'acme-corp.gpl');
  assert.equal(gpl.blob.type, 'text/plain');

  const scss = exportSwatches(FIXTURE, 'scss', 'My  Brand!! 2026');
  assert.equal(scss.filename, 'my-brand-2026-variables.scss');
  assert.equal(scss.blob.type, 'text/x-scss');

  const ase = exportSwatches(FIXTURE, 'ase', 'ACME Corp');
  assert.equal(ase.filename, 'acme-corp.ase');
  assert.equal(ase.blob.type, 'application/octet-stream');
});

// Every format the union carries, in the order both UIs list them. A format the
// user cannot reach is a format that does not exist, so this list is the bridge
// between the type and the two places that enumerate it.
const FORMATS: SwatchExportFormat[] = ['tokens-json', 'css-vars', 'css-classes', 'scss', 'gpl', 'ase'];

test('exportSwatches handles every format in the union', () => {
  for (const fmt of FORMATS) {
    const out = exportSwatches(FIXTURE, fmt);
    assert.ok(out.blob.size > 0, `${fmt} produced bytes`);
    assert.ok(out.filename.length > 0, `${fmt} produced a filename`);
  }
});

test('both enumerating UIs offer every format - none is reachable in only one', () => {
  const editor = [readFileSync(join(HERE, 'brand-editor.ts'), 'utf8'), ...readdirSync(join(HERE, 'brand-editor')).filter((n) => n.endsWith('.ts')).sort().map((n) => readFileSync(join(HERE, 'brand-editor', n), 'utf8'))].join('\n');
  const catDir = join(HERE, '../views/catalog');
  const catalog = [readFileSync(join(HERE, '../views/catalog.ts'), 'utf8'), ...readdirSync(catDir).filter((n) => n.endsWith('.ts')).sort().map((n) => readFileSync(join(catDir, n), 'utf8'))].join('\n');

  // The option body is t('label') optionally followed by an untranslated
  // annotation (tokens-json carries "· Penpot / Tokens Studio" - product names
  // don't translate, and appending keeps the 26 existing locale strings valid).
  const editorOpts = [...editor.matchAll(/<option value="([a-z-]+)">\$\{t\('(?:[^']*)'\)\}[^<]*<\/option>/g)]
    .map(m => m[1]!)
    .filter(v => (FORMATS as string[]).includes(v));
  const catalogOpts = [...catalog.matchAll(/\{ fmt: '([a-z-]+)', label: '[^']*' \}/g)].map(m => m[1]!);

  assert.deepEqual(editorOpts, FORMATS, 'brand editor palette dock <select>');
  assert.deepEqual(
    [...catalogOpts].sort(), [...FORMATS].sort(),
    'catalog SWATCH_DOWNLOADS (its own order puts .ase/.gpl last)',
  );
});
