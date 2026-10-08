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
import { bytesToBase64 } from '../lib/util/bytes.ts';
import { t, tRaw } from '../i18n.ts';
import { choiceDialog } from '../components/confirm-dialog.ts';
import type {
  InflateFn,
  LayeredRasterDoc,
  RasterLayer,
} from '../../../../engine/src/raster-layers.ts';
import { packPng } from '../../../../engine/src/png.ts';
import { sniffLayeredRaster } from '../../../../engine/src/media-sniff.ts';
import { encodeAuthoredPaths } from '../../../../engine/src/geom/authored-url.ts';
import { sameWinding, unionOutline } from '../../../../engine/src/psd-outline.ts';
import type { DesignMapOptions } from '../../../../engine/src/design-map.ts';
import type { PsdStroke, PsdSubpath, PsdTextRun } from '../../../../engine/src/psd-layer-semantics.ts';
import { markdownFromChars } from './rich-text.ts';
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
    const { readPsdPortable } = await import('../bridge/adobe-psd.ts');
    return readPsdPortable(bytes, { inflate, onWarn });
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
 * One layer as a Design image node, placed at its natural bounds. The layer's
 * opacity is a 0..1 fraction (psd.ts divides the record's byte by 255) and a
 * DesignNode's is a percentage (design-map.ts rounds and clamps to 0..100), so
 * it is scaled here. Passing the fraction through unscaled made every opaque
 * layer arrive at 1%.
 */
export function designNodeFromLayer(l: RasterLayer, image: unknown, group: string): Record<string, unknown> {
  return {
    kind: 'image',
    x: l.x,
    y: l.y,
    w: l.width,
    h: l.height,
    rot: 0,
    opacity: Math.round(l.opacity * 100),
    image,
    fit: 'fill',
    blend: l.blend === 'normal' ? undefined : l.blend,
    group: group || undefined,
  };
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

  // Adjustment layers at the top of the stack become Darkroom's grade (plans/289
  // M3); the person sees what was kept and what was not before anything is stored.
  const { darkroomGradeFromLayers } = await import('./psd-grade.ts');
  const grade = darkroomGradeFromLayers(doc.layers);
  if (grade.kept.length || grade.notes.length) {
    const ok = await choiceDialog({
      title: t('Open with these changes?'),
      message: tRaw('Adjustment layers in “{name}” become Darkroom’s grade where Darkroom has the same control:', { name: file.name }),
      items: [...grade.kept, ...grade.notes],
      choices: [{ id: 'open', label: t('Open'), primary: true }],
      tag: 'psd-import',
    });
    if (!ok) return null;
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

  return { ...grade.inputs, layers: rows, width: doc.width, height: doc.height };
}

/**
 * The Design branch - called from design-import.ts's parseDesignFile
 * when the magic bytes say layered bitmap. Same parse; layers become image
 * DesignNodes (unscaled at their natural bounds) through the exact
 * finalizeBoxes path every other importer uses.
 */
export async function parseLayeredAsDesign(
  file: File | Blob,
  { host, warn, map, interactive }: { host: PickerHost; warn: (msg: string) => void; map?: DesignMapOptions; interactive?: boolean },
): Promise<{ boxes: unknown[]; width: number; height: number; background: string; fontSubstitutions?: string[] }> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await parseLayeredBytes(bytes, warn);
  const { finalizeBoxes } = await import('../../../../engine/src/design-map.ts');

  // Plan every visible layer first: live text, shapes, paths and fills come in
  // editable; everything else as its pixels. Nothing is stored until the
  // person has seen what will change.
  type Planned = { layer: RasterLayer; live: LiveDesignNode | null };
  const planned: Planned[] = [];
  const notes: string[] = [];
  for (const l of doc.layers) {
    if (l.isGroup || !l.visible) continue; // an editor import keeps what the artwork shows
    const live = liveDesignNode(l, { w: doc.width, h: doc.height }, groupPathOf(l, doc));
    const name = l.name || t('Untitled layer');
    for (const note of [...(l.psd?.notes ?? []), ...(live?.notes ?? [])]) notes.push(`${name}: ${note}`);
    if (live || l.pixels.length > 0) planned.push({ layer: l, live });
  }
  if (!planned.length) throw new Error(t('No layers with pixels could be read from this file.'));

  // Clipping: a clipped layer clips to the nearest unclipped layer below that layer.
  // Design follows an ellipse exactly and any other box by its rectangle.
  const clipTo: Array<number | null> = planned.map(() => null);
  for (let i = 0; i < planned.length; i++) {
    if (!planned[i]!.layer.clipped) continue;
    let base = i - 1;
    while (base >= 0 && planned[base]!.layer.clipped) base--;
    if (base < 0) continue;
    clipTo[i] = base;
    const b = planned[base]!.live;
    const exact = b?.kind === 'shape' && (b.node.shape === 'ellipse' || b.node.shape === 'rect');
    if (!exact) notes.push(`${planned[i]!.layer.name || t('Untitled layer')}: ${tRaw('Clipped to the rectangle around “{base}”, not its exact outline.', { base: planned[base]!.layer.name || t('Untitled layer') })}`);
  }

  if (notes.length) {
    if (interactive) {
      const ok = await choiceDialog({
        title: t('Open with these changes?'),
        message: tRaw('Text, shapes and paths come in editable. Some parts of “{name}” cannot be kept as they are:', { name: (file as File).name || t('this file') }),
        items: notes,
        choices: [{ id: 'open', label: t('Open'), primary: true }],
        tag: 'psd-import',
      });
      if (!ok) throw new Error(t('Import cancelled.'));
    } else {
      for (const note of notes) warn(note);
    }
  }

  // The picker (asset storage) loads only when a layer needs its pixels stored.
  let storeUserUpload: typeof import('./picker.ts').storeUserUpload | null = null;
  const nodes: Record<string, unknown>[] = [];
  const paths: Array<string | null> = [];
  const markups = new Map<Record<string, unknown>, string>();
  const fieldsFor = new Map<number, Record<string, unknown>>();
  for (let i = 0; i < planned.length; i++) {
    const { layer: l, live } = planned[i]!;
    if (live) {
      nodes.push(live.node);
      paths.push(live.path ?? null);
      if (live.markup != null) markups.set(live.node, live.markup);
      if (live.fields) fieldsFor.set(i, live.fields);
      continue;
    }
    storeUserUpload ??= (await import('./picker.ts')).storeUserUpload;
    const png = packPng(l.pixels, { width: l.width, height: l.height, channels: 4 });
    const ref = await storeUserUpload(host, new File([png as BlobPart], `l${i}.png`, { type: 'image/png' }));
    nodes.push(designNodeFromLayer(l, ref, groupPathOf(l, doc)));
    paths.push(null);
  }

  // Measure live text in the font it will be drawn with, so a substituted face
  // that sets wider does not wrap or clip; keep the edge the alignment reads from.
  const textNodes = nodes.filter(n => n.kind === 'text');
  let fontSubstitutions: string[] = [];
  if (textNodes.length) {
    const before = textNodes.map(n => Number(n.w));
    const { prepareSvgText } = await import('./design-import-text.ts');
    fontSubstitutions = await prepareSvgText(textNodes as Parameters<typeof prepareSvgText>[0], map);
    textNodes.forEach((n, k) => {
      const grew = Number(n.w) - before[k]!;
      if (grew > 0 && n.textAlign === 'center') n.x = Number(n.x) - grew / 2;
      else if (grew > 0 && n.textAlign === 'right') n.x = Number(n.x) - grew;
    });
  }
  // Measured as plain text; the styles go on now, in the editor's own markup.
  for (const [node, markup] of markups) node.text = markup;

  const boxes: Record<string, unknown>[] = finalizeBoxes(nodes as Parameters<typeof finalizeBoxes>[0], { prefix: 'psd', ...map }).map((b) => ({ ...b }));
  if (boxes.length === nodes.length) {
    boxes.forEach((b, i) => {
      // The layer's own name labels its row in the layer list, as it did in Photoshop.
      const name = scrub(planned[i]!.layer.name).slice(0, 80);
      if (name) b.name = name;
      const wire = paths[i];
      if (wire) Object.assign(b, { kind: 'path', shape: 'rect', path: wire, fillRule: 'nonzero' });
      const fields = fieldsFor.get(i);
      if (fields) Object.assign(b, fields);
      const base = clipTo[i];
      if (base != null) b.clip = boxes[base]!.id;
    });
  }
  return { boxes, width: doc.width, height: doc.height, background: '#ffffff', ...(fontSubstitutions.length ? { fontSubstitutions } : {}) };
}

/**
 * Photoshop style runs as Design's inline markup, written by the same function the
 * text editor saves with: italic, and the colour, weight, underline and
 * strikethrough that differ from the box's own. So an imported word in italic stays
 * italic, edits like typed text and reaches the vector export.
 */
export function psdRunsToMarkup(runs: ReadonlyArray<Pick<PsdTextRun, 'text' | 'weight' | 'italic' | 'color' | 'underline' | 'strike'>>, base: { weight: number; color: string | null }): string {
  const baseColor = (base.color ?? '').toLowerCase();
  const chars: Parameters<typeof markdownFromChars>[0] = [];
  for (const run of runs) {
    const color = run.color && run.color.toLowerCase() !== baseColor ? run.color.toLowerCase() : null;
    const weight = run.weight !== base.weight ? Math.min(900, Math.max(100, Math.round(run.weight / 100) * 100)) : null;
    for (const ch of run.text) {
      chars.push({ ch, b: false, i: run.italic && ch !== '\n', c: color, w: weight, u: run.underline, s: run.strike, f: null });
    }
  }
  return markdownFromChars(chars);
}

/**
 * A Photoshop stroke's cap, join and dashes as Design box fields. A path box draws
 * the exact dash array; a rectangle or ellipse box draws its stroke as a border, which
 * knows only dashed and dotted, so the keyword goes on too (dots are dashes of length 0).
 */
export function strokeFields(stroke: PsdStroke): Record<string, unknown> {
  return {
    strokeCap: stroke.cap, strokeJoin: stroke.join,
    ...(stroke.dash ? { strokeDash: stroke.dash[0] === 0 ? 'dotted' : 'dashed', strokeDashArray: stroke.dash.join(' ') } : {}),
  };
}

/**
 * A rectangle or ellipse box draws its stroke inside its edge. Photoshop centres the
 * line on the outline unless told otherwise, so the box grows by half the width
 * (all of the width for an outside stroke). Then Design paints the stroke in the same place as Photoshop.
 */
function strokedBox(box: { x: number; y: number; w: number; h: number }, radius: number, stroke: PsdStroke | null): { x: number; y: number; w: number; h: number; radius: number } {
  const grow = !stroke ? 0 : stroke.align === 'outside' ? stroke.width : stroke.align === 'center' ? stroke.width / 2 : 0;
  const r = (v: number) => Math.round(v * 100) / 100;
  return { x: r(box.x - grow), y: r(box.y - grow), w: r(box.w + 2 * grow), h: r(box.h + 2 * grow), radius: radius > 0 ? r(radius + grow) : radius };
}

/** A layer that comes into Design as something editable, not as its pixels. */
export interface LiveDesignNode {
  kind: 'text' | 'shape' | 'path' | 'fill';
  /** A DesignNode for `finalizeBoxes`. */
  node: Record<string, unknown>;
  /** For a path: the Design `path` field (an authored cubic path, nodes as fractions of the box). */
  path?: string;
  /** For text: the text with its per-run styles as Design inline markup. `node.text`
   *  stays plain until the import has measured the text. */
  markup?: string;
  /** Box fields set after `finalizeBoxes`, which does not map them (stroke cap, join, dashes). */
  fields?: Record<string, unknown>;
  /** What this mapping cannot keep, beyond the layer's own notes. */
  notes: string[];
}

/**
 * The editable Design node for a Photoshop layer, or null when the layer comes
 * in as pixels. Reads the layer's `psd` semantics (engine psd-layer-semantics.ts).
 */
export function liveDesignNode(l: RasterLayer, canvas: { w: number; h: number }, group: string): LiveDesignNode | null {
  const s = l.psd;
  if (!s) return null;
  const opacity = Math.round(l.opacity * (s.fillOpacity ?? 1) * 100);
  const common = { opacity, blend: l.blend === 'normal' ? undefined : l.blend, group: group || undefined };
  const notes: string[] = [];
  if (s.fillOpacity != null) notes.push(t('Fill opacity was combined with the layer opacity.'));
  if (s.text) {
    const x = s.text;
    return {
      kind: 'text',
      notes,
      markup: psdRunsToMarkup(x.runs, { weight: x.weight, color: x.color }),
      node: {
        kind: 'text', ...common,
        x: x.box.x, y: x.box.y, w: x.box.w, h: x.box.h, rot: x.rotation,
        text: x.text, fg: x.color ?? '#000000', fontSize: x.size, fontFamily: x.family ?? '', fontWeight: x.weight,
        textAlign: x.align, lineHeight: x.lineHeight, tracking: x.tracking, pad: 0, fill: '',
      },
    };
  }
  if (s.shape) {
    const x = s.shape;
    const at = strokedBox(x.box, x.radius, x.stroke);
    return {
      kind: 'shape',
      notes,
      node: {
        kind: 'box', ...common, x: at.x, y: at.y, w: at.w, h: at.h,
        shape: x.kind === 'ellipse' ? 'ellipse' : x.kind === 'rounded' ? 'rounded' : 'rect', radius: at.radius,
        fill: x.fill ?? '', ...(x.stroke ? { stroke: x.stroke.color, strokeW: x.stroke.width } : {}),
      },
      ...(x.stroke ? { fields: strokeFields(x.stroke) } : {}),
    };
  }
  if (s.path) {
    let outline = sameWinding(s.path.subpaths);
    if (outline.length > 1 && s.path.stroke) {
      const merged = unionOutline(outline);
      if (merged) outline = merged;
      else notes.push(t('The stroke is drawn around each part of the shape, including where the parts overlap.'));
    }
    const built = designPathFromSubpaths(outline);
    if (!built) return null;
    if (s.path.stroke && s.path.stroke.align !== 'center') notes.push(t('The stroke is drawn centred on the outline; Photoshop drew it inside or outside.'));
    return {
      kind: 'path',
      notes,
      path: built.wire,
      node: {
        kind: 'box', ...common, ...built.box, fill: s.path.fill ?? '',
        ...(s.path.stroke ? { stroke: s.path.stroke.color, strokeW: s.path.stroke.width } : {}),
      },
      ...(s.path.stroke ? { fields: strokeFields(s.path.stroke) } : {}),
    };
  }
  if (s.fill) {
    const has = l.width > 0 && l.height > 0;
    return {
      kind: 'fill',
      notes,
      node: { kind: 'box', ...common, shape: 'rect', fill: s.fill, x: has ? l.x : 0, y: has ? l.y : 0, w: has ? l.width : canvas.w, h: has ? l.height : canvas.h },
    };
  }
  return null;
}

/**
 * Photoshop path knots (document pixels, with their incoming and outgoing
 * control points) as a Design path: the box is the bounds of every point and
 * handle, and each node and handle is a fraction of that box, as Design stores
 * a path so it stays editable when the box is resized.
 */
export function designPathFromSubpaths(subpaths: PsdSubpath[]): { wire: string; box: { x: number; y: number; w: number; h: number } } | null {
  const pts: number[][] = [];
  for (const sp of subpaths) for (const k of sp.knots) pts.push([k.x, k.y], [k.inX, k.inY], [k.outX, k.outY]);
  if (!pts.length) return null;
  const xs = pts.map(p => p[0]!), ys = pts.map(p => p[1]!);
  const x = Math.floor(Math.min(...xs)), y = Math.floor(Math.min(...ys));
  const w = Math.max(1, Math.ceil(Math.max(...xs)) - x), h = Math.max(1, Math.ceil(Math.max(...ys)) - y);
  const fx = (v: number) => (v - x) / w, fy = (v: number) => (v - y) / h;
  const authored = subpaths.map(sp => ({
    kind: 'cubic' as const,
    closed: sp.closed,
    nodes: sp.knots.map(k => ({
      x: fx(k.x), y: fy(k.y),
      hInX: fx(k.inX) - fx(k.x), hInY: fy(k.inY) - fy(k.y),
      hOutX: fx(k.outX) - fx(k.x), hOutY: fy(k.outY) - fy(k.y),
      continuity: 'corner' as const,
    })),
  }));
  try {
    return { wire: encodeAuthoredPaths(authored), box: { x, y, w, h } };
  } catch {
    return null;
  }
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
