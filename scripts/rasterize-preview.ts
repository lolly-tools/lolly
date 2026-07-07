#!/usr/bin/env node
/**
 * Rasterise ONE preview SVG to a PNG file via @resvg/resvg-js — in its OWN process.
 *
 * Why a separate process: resvg is a native (Rust) library and can *panic* on a preview
 * SVG whose geometry it can't handle (e.g. multi-page-pdf.svg → an `Option::unwrap()` on
 * None in geom.rs). A Rust panic aborts the process (`Abort trap: 6`) and is NOT catchable
 * by JS try/catch, so calling resvg in-process would take the whole `build:web` down.
 * build-tool-og.ts spawns this script instead: a panic kills only this child (non-zero
 * exit / SIGABRT), and the parent treats that as "no preview" — the tool gets an
 * icon-only share card rather than the build failing.
 *
 * Args: <svgPath> <outPngPath> [widthPx]   (widthPx defaults to 820)
 * Exit: 0 + PNG written on success; non-zero (or SIGABRT) on any failure/panic.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const [svgPath, outPath, widthArg] = process.argv.slice(2);
if (!svgPath || !outPath) {
  console.error('usage: rasterize-preview.ts <svgPath> <outPngPath> [widthPx]');
  process.exit(2);
}

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { Resvg } = await import('@resvg/resvg-js');
// SUSE fonts so any live text in the preview outlines correctly (mirrors build-tool-og).
const fontBuffers = ['Medium', 'Regular'].map((w) => readFileSync(resolve(ROOT, `catalog/fonts/ttf/SUSE-${w}.ttf`)));

const r = new Resvg(readFileSync(svgPath, 'utf8'), {
  // @resvg/resvg-js supports fontBuffers at runtime; its bundled types omit it.
  // @ts-expect-error - fontBuffers is a valid runtime option missing from the type
  font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: 'SUSE' },
  fitTo: { mode: 'width', value: Number(widthArg) || 820 },
  background: 'white',
});
writeFileSync(outPath, r.render().asPng());
