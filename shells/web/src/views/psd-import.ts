// SPDX-License-Identifier: MPL-2.0
/**
 * Layered-bitmap import (Photoshop PSD/PSB + GIMP XCF) - the shell half over
 * the engine's readPsd/readXcf. Three routes out of one parse:
 *
 *   1. importLayeredFileAsSeed - the "Open as layers" journey: every layer is
 *      PNG-encoded (engine packPng, deterministic, no canvas) and stored as
 *      its OWN library asset via storeUserUpload (the chunk-don't-monolith
 *      rule: peak memory is one layer, the renderer lazy-loads each image,
 *      and the darkroom tool's layer block rows carry only refs + geometry so
 *      URLs stay small). Returns the initial-values seed the drop router
 *      stashes for views/tool.ts.
 *   2. parseLayeredAsDesign - the Design branch design-import.ts
 *      delegates to: same parse, layers → image DesignNodes → finalizeBoxes.
 *   3. ingestLayeredFileFlattened - the library route: the file's merged
 *      composite (PSD ships one; XCF is flattened here src-over) stored as an
 *      ordinary raster asset.
 *
 * Group handling: when the file actually has groups a choiceDialog asks
 * flat-vs-grouped (the pickPdfPages pattern's little sibling - a binary
 * choice needs no page grid). "Keep groups" fills each row's `g` field with
 * the group path; flat leaves it ''. Either way the layer LIST stays flat - 
 * blocks `nesting` would double the wire fields per row against the tool's
 * governing URL-compactness constraint.
 *
 * Sanitisation: compact blocks URLs bail to JSON if ANY value contains ','
 * or '~', so layer names/groups are scrubbed of both here, once, at import.
 */

import { unzlibSync } from 'fflate';
import { t, tRaw } from '../i18n.ts';
import { choiceDialog } from '../components/confirm-dialog.ts';
import type {
  InflateFn,
  LayeredRasterDoc,
  RasterLayer,
} from '../../../../engine/src/raster-layers.ts';
import { packPng } from '../../../../engine/src/png.ts';
import { sniffLayeredRaster } from '../../../../engine/src/media-sniff.ts';
import type { PickerHost } from './picker.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';
import type { UnpackHandle } from './unpack-open.ts';
import type { PdfPageSvg, EmbeddedImage, EmbeddedImageScan } from './pdf-import.ts';

const MAX_IMPORT_BYTES = 512 * 1024 * 1024; // the engine's decode budget is the real guard

/** fflate-backed zlib inflate with the engine's double-bounded maxOut contract. */
const inflate: InflateFn = (bytes, maxOut) => {
  const out = unzlibSync(bytes, { out: new Uint8Array(maxOut) });
  return out;
};

/** Parse PSD/PSB or XCF bytes into the shared layered doc. Throws on refusal. */
export async function parseLayeredBytes(
  bytes: Uint8Array,
  warn: (msg: string) => void,
): Promise<LayeredRasterDoc> {
  const kind = sniffLayeredRaster(bytes);
  const onWarn = (code: string, detail?: string): void => {
    warn(tRaw('Import note: {detail}', { detail: detail ? `${code} (${detail})` : code }));
  };
  if (kind === 'psd') {
    const { readPsd } = await import('../../../../engine/src/psd.ts');
    return readPsd(bytes, { inflate, onWarn });
  }
  if (kind === 'xcf') {
    const { readXcf } = await import('../../../../engine/src/xcf.ts');
    return readXcf(bytes, { inflate, onWarn });
  }
  throw new Error(t('This file isn’t a Photoshop or GIMP document.'));
}

/** Compact-URL-safe text: the tilde/comma wire delimiters can never appear. */
const scrub = (s: string): string => s.replace(/[,~]/g, ' ').trim();

// ── Unpack reader (PSD/XCF → PdfHandle) ─────────────────────────────────────────

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Base64 in chunks - String.fromCharCode(...bigArray) overflows the call stack. */
function bytesToBase64(u8: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < u8.length; i += CHUNK) bin += String.fromCharCode(...u8.subarray(i, i + CHUNK));
  return btoa(bin);
}

/**
 * Open a layered bitmap for Unpack - each layer comes out as its own named PNG, and
 * the flattened composite (PSD ships one; XCF is flattened here) is the page picture.
 *
 * There is deliberately NO text pass: our reader rasterises PSD/XCF text layers to
 * PIXELS (see memory psd-text-layer-editable-gap), so the honest answer is that this
 * reader has no words to give - NOT that the file has none. The view's generic
 * no-text line says exactly that.
 */
export async function openPsdFile(file: File | Blob): Promise<UnpackHandle> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await parseLayeredBytes(bytes, () => {});
  const layers = doc.layers.filter(importable);

  const composite = doc.composite ?? (() => {
    const out = new Uint8Array(doc.width * doc.height * 4);
    for (const l of doc.layers) { if (l.isGroup || !l.pixels.length) continue; blitOver(out, doc.width, doc.height, l); }
    return { width: doc.width, height: doc.height, pixels: out };
  })();

  let pageCache: PdfPageSvg | null = null;

  return {
    pageCount: 1,
    async pageToSvg(index: number): Promise<PdfPageSvg> {
      if (index !== 0) throw new Error(`No page ${index + 1} in a layered bitmap.`);
      if (pageCache) return pageCache;
      const png = packPng(composite.pixels, { width: composite.width, height: composite.height, channels: 4 });
      const href = `data:image/png;base64,${bytesToBase64(png)}`;
      const svg = `<svg xmlns="${SVG_NS}" viewBox="0 0 ${composite.width} ${composite.height}" width="${composite.width}" height="${composite.height}">`
        + `<image width="${composite.width}" height="${composite.height}" href="${href}"/></svg>`;
      pageCache = { svg, width: composite.width, height: composite.height, elementCount: 1 };
      return pageCache;
    },
    listImages(): Promise<EmbeddedImageScan> {
      const images: EmbeddedImage[] = layers.map((l, i) => ({
        bytes: packPng(l.pixels, { width: l.width, height: l.height, channels: 4 }),
        mime: 'image/png',
        width: l.width,
        height: l.height,
        colorSpace: null,
        page: 0,
        name: scrub(l.name) || `Layer ${i + 1}`,
      }));
      return Promise.resolve({ images, skipped: 0, skippedFilters: [] });
    },
  };
}

/** A layer the import journeys keep: visible pixels or an honest hidden layer. */
const importable = (l: RasterLayer): boolean => !l.isGroup && l.pixels.length > 0;

/** Group path string for a layer ('Outer/Inner'), from the doc's group rows. */
function groupPathOf(l: RasterLayer, doc: LayeredRasterDoc): string {
  return l.groupPath
    .map((i) => scrub(doc.layers[i]?.name ?? ''))
    .filter(Boolean)
    .join('/');
}

/**
 * The "Open as layers" journey. Parses, asks flat-vs-grouped when the file has
 * groups, stores one PNG asset per layer, and returns the darkroom layers seed - 
 * or null when the user cancelled the dialog.
 */
export async function importLayeredFileAsSeed(
  host: PickerHost,
  file: File,
  { warn }: { warn: (msg: string) => void },
): Promise<Record<string, unknown> | null> {
  if (file.size > MAX_IMPORT_BYTES) throw new Error(t('This file is too large to import.'));
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await parseLayeredBytes(bytes, warn);
  const layers = doc.layers.filter(importable);
  if (!layers.length) {
    throw new Error(t('No layers with pixels could be read from this file.'));
  }

  let keepGroups = false;
  if (doc.layers.some((l) => l.isGroup)) {
    const chosen = await choiceDialog({
      title: t('How should the layer folders come in?'),
      message: tRaw('“{name}” has grouped layers. Lolly keeps the list flat either way - groups can ride along as a label on each layer.', { name: file.name }),
      choices: [
        { id: 'grouped', label: t('Keep group labels'), primary: true },
        { id: 'flat', label: t('Flatten - layers only') },
      ],
      tag: 'psd-import',
    });
    if (!chosen) return null;
    keepGroups = chosen === 'grouped';
  }

  // Store each layer as its own PNG asset - sequential on purpose (one layer's
  // buffer in flight at a time), terse names so the minted user/ ids stay short.
  const { storeUserUpload } = await import('./picker.ts');
  const rows: Array<Record<string, unknown>> = [];
  for (let i = 0; i < layers.length; i++) {
    const l = layers[i]!;
    const png = packPng(l.pixels, { width: l.width, height: l.height, channels: 4 });
    const ref = await storeUserUpload(host, new File([png as BlobPart], `l${i}.png`, { type: 'image/png' }));
    if (l.blendLossy) {
      warn(tRaw('Layer “{name}” uses a blend mode Lolly approximates as {mode}.', { name: l.name || `#${i}`, mode: l.blend }));
    }
    rows.push({
      img: ref,
      x: l.x,
      y: l.y,
      o: Math.round(l.opacity * 100),
      v: l.visible,
      b: l.blend === 'normal' ? '' : l.blend,
      n: scrub(l.name),
      g: keepGroups ? groupPathOf(l, doc) : '',
    });
  }

  return { layers: rows, width: doc.width, height: doc.height };
}

/**
 * The Design branch - called from design-import.ts's parseDesignFile
 * when the magic bytes say layered bitmap. Same parse; layers become image
 * DesignNodes (unscaled at their natural bounds) through the exact
 * finalizeBoxes path every other importer uses.
 */
export async function parseLayeredAsDesign(
  file: File | Blob,
  { host, warn }: { host: PickerHost; warn: (msg: string) => void },
): Promise<{ boxes: unknown[]; width: number; height: number; background: string }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await parseLayeredBytes(bytes, warn);
  const layers = doc.layers.filter(importable);
  const { finalizeBoxes } = await import('../../../../engine/src/design-map.ts');
  const { storeUserUpload } = await import('./picker.ts');

  const nodes: unknown[] = [];
  for (let i = 0; i < layers.length; i++) {
    const l = layers[i]!;
    if (!l.visible) continue; // an editor import keeps what the artwork shows
    const png = packPng(l.pixels, { width: l.width, height: l.height, channels: 4 });
    const ref = await storeUserUpload(host, new File([png as BlobPart], `l${i}.png`, { type: 'image/png' }));
    nodes.push({
      kind: 'image',
      x: l.x,
      y: l.y,
      w: l.width,
      h: l.height,
      rot: 0,
      opacity: l.opacity,
      image: ref,
      fit: 'fill',
      blend: l.blend === 'normal' ? undefined : l.blend,
      group: groupPathOf(l, doc) || undefined,
    });
  }
  if (!nodes.length) throw new Error(t('No layers with pixels could be read from this file.'));
  return {
    boxes: finalizeBoxes(nodes as Parameters<typeof finalizeBoxes>[0], { prefix: 'psd' }),
    width: doc.width,
    height: doc.height,
    background: '#ffffff',
  };
}

/**
 * The library route: one flattened raster asset. PSD ships a merged composite
 * (decoded even when layers fail); XCF stores none, so visible layers flatten
 * here src-over - approximate for exotic blend modes, honest for a thumbnail.
 */
export async function ingestLayeredFileFlattened(host: PickerHost, file: File): Promise<AssetRef> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await parseLayeredBytes(bytes, () => {});
  let flat = doc.composite;
  if (!flat) {
    const out = new Uint8Array(doc.width * doc.height * 4);
    for (const l of doc.layers) {
      if (!importable(l) || !l.visible) continue;
      blitOver(out, doc.width, doc.height, l);
    }
    flat = { width: doc.width, height: doc.height, pixels: out };
  }
  const png = packPng(flat.pixels, { width: flat.width, height: flat.height, channels: 4 });
  const { storeUserUpload } = await import('./picker.ts');
  const base = file.name.replace(/\.(psd|psb|xcf)$/i, '');
  return storeUserUpload(host, new File([png as BlobPart], `${base}.png`, { type: 'image/png' }));
}

/** Plain src-over blit of one layer into a document-sized RGBA buffer. */
function blitOver(out: Uint8Array, width: number, height: number, l: RasterLayer): void {
  for (let y = 0; y < l.height; y++) {
    const dy = l.y + y;
    if (dy < 0 || dy >= height) continue;
    for (let x = 0; x < l.width; x++) {
      const dx = l.x + x;
      if (dx < 0 || dx >= width) continue;
      const s = (y * l.width + x) * 4;
      const a = (l.pixels[s + 3]! / 255) * l.opacity;
      if (a <= 0) continue;
      const d = (dy * width + dx) * 4;
      const da = out[d + 3]! / 255;
      const oa = a + da * (1 - a);
      if (oa <= 0) continue;
      out[d] = Math.round((l.pixels[s]! * a + out[d]! * da * (1 - a)) / oa);
      out[d + 1] = Math.round((l.pixels[s + 1]! * a + out[d + 1]! * da * (1 - a)) / oa);
      out[d + 2] = Math.round((l.pixels[s + 2]! * a + out[d + 2]! * da * (1 - a)) / oa);
      out[d + 3] = Math.round(oa * 255);
    }
  }
}
