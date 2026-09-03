// SPDX-License-Identifier: MPL-2.0
/**
 * Unit tests for the `.penpot` binfile-v3 WRITER (engine/src/penpot-file.ts).
 *
 * Penpot validates every entry of an imported archive against its malli schemas
 * and then re-checks the assembled file, so a missing key, a stray NaN or a fill
 * carrying two paints is a REFUSED import, not a warning. There is no Penpot in
 * this test process, so the first thing this suite carries is its own port of
 * those required-key checks: `validatePenpotEntries()` below walks the manifest,
 * the file record, every page, every shape, every fill / stroke / shadow / blur,
 * and the media + storage-object pairs, and throws naming the exact JSON path
 * that broke. Every producer in the module is run through it, so a regression
 * points at a field instead of at "Penpot said no".
 *
 * On top of that it proves the three producers and the small pure helpers:
 *
 *   - `buildPenpotEntries` on a hand-built doc covering every shape type,
 *     including the rotation matrix and the rotated corner points;
 *   - `boxesToPenpotDoc` (the Design tool's raw box rows) and a ROUND TRIP back
 *     through the repo's Penpot READ side (`penpotShapeToNode` + `finalizeBoxes`,
 *     `penpotGradientToSpec`, `penpotBackgroundBlurPx`) - geometry within 0.5 px,
 *     colours, text, rotation, gradient, stroke, shadow, blur and backdrop blur;
 *   - `svgToPenpotDoc`, both what it lowers and what it refuses (the refusals are
 *     the contract: the caller keeps the SVG whole as one picture, so a `null`
 *     here is fidelity kept, not fidelity lost);
 *   - `penpotTokensJson` against the shipped brand token doc, then back out
 *     through `extractPenpotProject` + `createTokenSet`;
 *   - `imageDimensions`, `decodeDataUrl` / `decodeBase64`, `parsePenpotColor`,
 *     `gradSpecToPenpot`, `designTextRuns`, `parsePenpotImportStream`,
 *     `penpotWorkspaceUrl`.
 *
 * Builds are made deterministic with `seededPenpotUuid()` and a fixed clock, so
 * a diff in the output is a real change and never a fresh uuid.
 *
 * Run with: node --test tests/penpot-file.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { unzipSync } from 'fflate';

import {
  PENPOT_MIME, PENPOT_ROOT_ID, PENPOT_FILE_VERSION, PENPOT_FEATURES, PENPOT_MIGRATIONS,
  buildPenpotEntries, boxesToPenpotDoc, svgToPenpotDoc, imageToPenpotDoc,
  penpotTokensJson, gradSpecToPenpot, designTextRuns, imageDimensions,
  decodeDataUrl, decodeBase64, parsePenpotColor, parsePenpotImportStream,
  penpotWorkspaceUrl, seededPenpotUuid,
  type PenpotDoc, type PenpotIrShape, type PenpotMedia,
} from '../engine/src/penpot-file.ts';
import {
  penpotShapeToNode, finalizeBoxes, penpotGradientToSpec, penpotBackgroundBlurPx,
} from '../engine/src/design-map.ts';
import { extractPenpotProject } from '../engine/src/brand-import.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { makeGeomApi } from '../engine/src/geom-api.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ── the validator: a TypeScript port of what Penpot's importer requires ──────
// Sources: plans/178 section 2's anchor table (v3.clj, shape.cljc, text.cljc, fills.cljc,
// color.cljc, file.cljc) and penpot-file.ts's own header. Every failure throws
// with the JSON path that broke, so a regression names the field.

type Entries = Record<string, Uint8Array | string>;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEX6 = /^#[0-9a-f]{6}$/;
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
const SHAPE_TYPES = new Set(['frame', 'group', 'rect', 'circle', 'path', 'text', 'image', 'bool', 'svg-raw']);
const STROKE_ALIGNMENTS = new Set(['center', 'inner', 'outer']);
const STROKE_STYLES = new Set(['solid', 'dashed', 'dotted']);
const SHAPE_ENTRY = /^files\/([^/]+)\/pages\/([^/]+)\/([^/]+)\.json$/;
const PAGE_ENTRY = /^files\/([^/]+)\/pages\/([^/]+)\.json$/;

interface PenpotSummary {
  fileId: string;
  pageIds: string[];
  /** Every page shape json, keyed by its `name` (the writer's names are unique in these fixtures). */
  byName: Map<string, Record<string, unknown>>;
  shapes: Array<Record<string, unknown>>;
}

/**
 * Throw unless `entries` is an archive Penpot's `import-binfile` would accept.
 * Returns a small index of what it found so a caller can go on asserting.
 */
function validatePenpotEntries(entries: Entries): PenpotSummary {
  const bad = (where: string, why: string): never => { throw new Error(`${where}: ${why}`); };
  const isRec = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

  const bytesOf = (p: string): Uint8Array => {
    const v = entries[p];
    if (v == null) return bad(p, 'entry missing') as never;
    return typeof v === 'string' ? new TextEncoder().encode(v) : v;
  };
  const textOf = (p: string): string => {
    const v = entries[p];
    if (v == null) return bad(p, 'entry missing') as never;
    return typeof v === 'string' ? v : new TextDecoder().decode(v);
  };
  const json = (p: string): Record<string, unknown> => {
    const raw = textOf(p);
    let parsed: unknown;
    try { parsed = JSON.parse(raw); } catch { return bad(p, 'not parseable JSON') as never; }
    if (!isRec(parsed)) return bad(p, 'top level is not an object') as never;
    // JSON.stringify writes `null` for NaN/Infinity, so the deep numeric walk below
    // is the real guard; this catches a hand-assembled entry that wrote them raw.
    if (/\b(NaN|-?Infinity)\b/.test(raw)) bad(p, 'the text carries NaN/Infinity');
    walkFinite(parsed, p);
    return parsed;
  };
  const walkFinite = (v: unknown, where: string): void => {
    if (typeof v === 'number') { if (!Number.isFinite(v)) bad(where, `non-finite number ${String(v)}`); return; }
    if (Array.isArray(v)) { v.forEach((e, i) => walkFinite(e, `${where}[${i}]`)); return; }
    if (isRec(v)) for (const [k, e] of Object.entries(v)) walkFinite(e, `${where}.${k}`);
  };
  const num = (o: Record<string, unknown>, k: string, where: string): number => {
    const v = o[k];
    if (typeof v !== 'number' || !Number.isFinite(v)) return bad(`${where}.${k}`, `expected a finite number, got ${JSON.stringify(v)}`) as never;
    return v;
  };
  const uuid = (o: Record<string, unknown>, k: string, where: string): string => {
    const v = o[k];
    if (typeof v !== 'string' || !UUID_RE.test(v)) return bad(`${where}.${k}`, `expected a uuid, got ${JSON.stringify(v)}`) as never;
    return v;
  };
  const matrix = (v: unknown, where: string): void => {
    if (!isRec(v)) bad(where, 'expected a matrix object');
    for (const k of ['a', 'b', 'c', 'd', 'e', 'f']) num(v as Record<string, unknown>, k, where);
  };

  // ── manifest ──────────────────────────────────────────────────────────────
  const manifest = json('manifest.json');
  if (manifest.type !== 'penpot/export-files') bad('manifest.json.type', `expected penpot/export-files, got ${JSON.stringify(manifest.type)}`);
  if (manifest.version !== 1) bad('manifest.json.version', `expected 1, got ${JSON.stringify(manifest.version)}`);
  if (!Array.isArray(manifest.files) || !manifest.files.length) bad('manifest.json.files', 'expected a non-empty array');
  const mFiles = manifest.files as unknown[];
  for (let i = 0; i < mFiles.length; i++) {
    const f = mFiles[i];
    const w = `manifest.json.files[${i}]`;
    if (!isRec(f)) { bad(w, 'expected an object'); continue; }
    uuid(f, 'id', w);
    if (typeof f.name !== 'string' || !f.name) bad(`${w}.name`, 'expected a non-empty string');
    if (!Array.isArray(f.features)) bad(`${w}.features`, 'expected an array');
  }
  const fileId = String((mFiles[0] as Record<string, unknown>).id);

  // ── the file record ───────────────────────────────────────────────────────
  const filePath = `files/${fileId}.json`;
  const file = json(filePath);
  uuid(file, 'id', filePath);
  if (file.id !== fileId) bad(`${filePath}.id`, 'does not match the manifest id');
  if (typeof file.name !== 'string' || !file.name) bad(`${filePath}.name`, 'expected a non-empty string');
  for (const k of ['revn', 'vern', 'version']) {
    const v = num(file, k, filePath);
    if (!Number.isInteger(v)) bad(`${filePath}.${k}`, `expected an integer, got ${v}`);
  }
  if (!Array.isArray(file.features)) bad(`${filePath}.features`, 'expected an array');
  if (!Array.isArray(file.migrations)) bad(`${filePath}.migrations`, 'expected an array');
  for (const k of ['createdAt', 'modifiedAt']) {
    const v = file[k];
    if (typeof v !== 'string' || !ISO_RE.test(v)) bad(`${filePath}.${k}`, `expected an ISO-8601 string, got ${JSON.stringify(v)}`);
  }
  if (!isRec(file.options)) bad(`${filePath}.options`, 'expected an object');

  // ── media + storage objects ───────────────────────────────────────────────
  const mediaIds = new Set<string>();
  const mediaPrefix = `files/${fileId}/media/`;
  for (const path of Object.keys(entries)) {
    if (!path.startsWith(mediaPrefix) || !path.endsWith('.json')) continue;
    const mid = path.slice(mediaPrefix.length, -'.json'.length);
    const rec = json(path);
    uuid(rec, 'id', path);
    if (rec.id !== mid) bad(`${path}.id`, 'does not match the entry name');
    if (typeof rec.name !== 'string' || !rec.name) bad(`${path}.name`, 'expected a non-empty string');
    num(rec, 'width', path); num(rec, 'height', path);
    if (typeof rec.mtype !== 'string' || !rec.mtype) bad(`${path}.mtype`, 'expected a media type');
    const objectId = uuid(rec, 'mediaId', path);
    const objPath = `objects/${objectId}.json`;
    const obj = json(objPath);
    if (obj.id !== objectId) bad(`${objPath}.id`, 'does not match the entry name');
    if (obj.contentType !== rec.mtype) bad(`${objPath}.contentType`, `expected ${String(rec.mtype)}, got ${JSON.stringify(obj.contentType)}`);
    if (obj.bucket !== 'file-media-object') bad(`${objPath}.bucket`, `expected file-media-object, got ${JSON.stringify(obj.bucket)}`);
    const size = num(obj, 'size', objPath);
    const blobs = Object.keys(entries).filter(p => p.startsWith(`objects/${objectId}.`) && !p.endsWith('.json'));
    if (blobs.length !== 1) bad(`objects/${objectId}.*`, `expected exactly one blob beside the storage object, found ${blobs.length}`);
    const blob = bytesOf(blobs[0]!);
    if (blob.length !== size) bad(blobs[0]!, `size ${size} does not match the ${blob.length} bytes stored`);
    mediaIds.add(mid);
  }

  // ── pages ─────────────────────────────────────────────────────────────────
  const pageIds: string[] = [];
  for (const path of Object.keys(entries)) {
    const m = PAGE_ENTRY.exec(path);
    if (!m || m[1] !== fileId) continue;
    const rec = json(path);
    const pid = uuid(rec, 'id', path);
    if (pid !== m[2]) bad(`${path}.id`, 'does not match the entry name');
    if (typeof rec.name !== 'string' || !rec.name) bad(`${path}.name`, 'expected a non-empty string');
    const index = num(rec, 'index', path);
    if (!Number.isInteger(index) || index < 0) bad(`${path}.index`, `expected a non-negative integer, got ${index}`);
    pageIds.push(pid);
  }
  if (!pageIds.length) bad(`files/${fileId}/pages`, 'no page json in the archive');

  // ── shapes ────────────────────────────────────────────────────────────────
  const byPage = new Map<string, Map<string, Record<string, unknown>>>();
  for (const pid of pageIds) byPage.set(pid, new Map());
  const all: Array<Record<string, unknown>> = [];
  for (const path of Object.keys(entries)) {
    const m = SHAPE_ENTRY.exec(path);
    if (!m || m[1] !== fileId) continue;
    const [, , pid, sid] = m as unknown as [string, string, string, string];
    if (!byPage.has(pid)) bad(path, `shape sits under an unknown page ${pid}`);
    const rec = json(path);
    if (rec.id !== sid) bad(`${path}.id`, 'does not match the entry name');
    byPage.get(pid)!.set(sid, rec);
    all.push(rec);
  }

  const fillsOf = (rec: Record<string, unknown>, where: string): void => {
    const list = rec.fills;
    if (list === undefined) return;
    if (!Array.isArray(list)) return void bad(`${where}.fills`, 'expected an array');
    list.forEach((f, i) => {
      const w = `${where}.fills[${i}]`;
      if (!isRec(f)) return void bad(w, 'expected an object');
      const paints = ['fillColor', 'fillColorGradient', 'fillImage'].filter(k => f[k] != null);
      if (paints.length !== 1) bad(w, `a fill carries exactly one paint, found [${paints.join(', ')}]`);
      const op = f.fillOpacity;
      if (op != null) {
        const v = num(f, 'fillOpacity', w);
        if (v < 0 || v > 1) bad(`${w}.fillOpacity`, `expected 0..1, got ${v}`);
      }
      if (f.fillColor != null) {
        if (typeof f.fillColor !== 'string' || !HEX6.test(f.fillColor)) bad(`${w}.fillColor`, `expected #rrggbb lowercase, got ${JSON.stringify(f.fillColor)}`);
      }
      if (f.fillColorGradient != null) {
        const g = f.fillColorGradient;
        if (!isRec(g)) return void bad(`${w}.fillColorGradient`, 'expected an object');
        if (g.type !== 'linear' && g.type !== 'radial') bad(`${w}.fillColorGradient.type`, `expected linear|radial, got ${JSON.stringify(g.type)}`);
        for (const k of ['startX', 'startY', 'endX', 'endY']) num(g, k, `${w}.fillColorGradient`);
        if (!Array.isArray(g.stops) || !g.stops.length) return void bad(`${w}.fillColorGradient.stops`, 'expected a non-empty array');
        g.stops.forEach((s, j) => {
          const sw = `${w}.fillColorGradient.stops[${j}]`;
          if (!isRec(s)) return void bad(sw, 'expected an object');
          if (typeof s.color !== 'string' || !HEX6.test(s.color)) bad(`${sw}.color`, `expected #rrggbb, got ${JSON.stringify(s.color)}`);
          const off = num(s, 'offset', sw);
          if (off < 0 || off > 1) bad(`${sw}.offset`, `expected 0..1, got ${off}`);
        });
      }
      if (f.fillImage != null) {
        const img = f.fillImage;
        if (!isRec(img)) return void bad(`${w}.fillImage`, 'expected an object');
        const id = uuid(img, 'id', `${w}.fillImage`);
        if (!mediaIds.has(id)) bad(`${w}.fillImage.id`, `names ${id}, which has no files/${fileId}/media/${id}.json`);
        num(img, 'width', `${w}.fillImage`); num(img, 'height', `${w}.fillImage`);
        if (typeof img.mtype !== 'string' || !img.mtype) bad(`${w}.fillImage.mtype`, 'expected a media type');
      }
    });
  };

  for (const [pid, page] of byPage) {
    for (const [sid, rec] of page) {
      const where = `files/${fileId}/pages/${pid}/${sid}.json`;
      uuid(rec, 'id', where);
      if (typeof rec.name !== 'string' || !rec.name.length) bad(`${where}.name`, `expected a non-empty string, got ${JSON.stringify(rec.name)}`);
      const type = rec.type;
      if (typeof type !== 'string' || !SHAPE_TYPES.has(type)) bad(`${where}.type`, `unknown shape type ${JSON.stringify(type)}`);
      // geometry
      const sel = rec.selrect;
      if (!isRec(sel)) { bad(`${where}.selrect`, 'expected an object'); continue; }
      for (const k of ['x', 'y', 'width', 'height', 'x1', 'y1', 'x2', 'y2']) num(sel, k, `${where}.selrect`);
      if (!Array.isArray(rec.points) || rec.points.length !== 4) bad(`${where}.points`, `expected 4 points, got ${Array.isArray(rec.points) ? rec.points.length : typeof rec.points}`);
      (rec.points as unknown[]).forEach((p, i) => {
        const w = `${where}.points[${i}]`;
        if (!isRec(p)) return void bad(w, 'expected an object');
        num(p, 'x', w); num(p, 'y', w);
      });
      matrix(rec.transform, `${where}.transform`);
      matrix(rec.transformInverse, `${where}.transformInverse`);
      for (const k of ['x', 'y', 'width', 'height']) num(rec, k, where);
      // ownership
      const parentId = uuid(rec, 'parentId', where);
      uuid(rec, 'frameId', where);
      const shapePage = uuid(rec, 'pageId', where);
      if (shapePage !== pid) bad(`${where}.pageId`, `expected ${pid}, got ${shapePage}`);
      if (sid !== PENPOT_ROOT_ID && parentId !== PENPOT_ROOT_ID && !page.has(parentId)) {
        bad(`${where}.parentId`, `names ${parentId}, which is not a shape on this page`);
      }
      // containers
      if (type === 'frame' || type === 'group') {
        if (!Array.isArray(rec.shapes)) { bad(`${where}.shapes`, 'a frame/group must carry its child ids'); continue; }
        (rec.shapes as unknown[]).forEach((cid, i) => {
          const w = `${where}.shapes[${i}]`;
          if (typeof cid !== 'string' || !UUID_RE.test(cid)) return void bad(w, `expected a uuid, got ${JSON.stringify(cid)}`);
          const child = page.get(cid);
          if (!child) return void bad(w, `names ${cid}, which is not a shape on this page`);
          if (child.parentId !== sid) bad(w, `child ${cid} has parentId ${String(child.parentId)}, not ${sid}`);
        });
      }
      if (type === 'rect' || type === 'frame') {
        for (const k of ['r1', 'r2', 'r3', 'r4']) num(rec, k, where);
      }
      if (type === 'path') {
        const d = rec.content;
        if (typeof d !== 'string' || !d.trim()) bad(`${where}.content`, 'expected non-empty path data');
        else if (!/^M/.test(d.trim())) bad(`${where}.content`, `path data must start with an absolute move, got ${JSON.stringify(d.slice(0, 12))}`);
      }
      if (type === 'text') {
        const root = rec.content;
        if (!isRec(root)) { bad(`${where}.content`, 'expected the content root object'); continue; }
        if (root.type !== 'root') bad(`${where}.content.type`, `expected root, got ${JSON.stringify(root.type)}`);
        const rootKids = root.children;
        if (!Array.isArray(rootKids) || !rootKids.length) { bad(`${where}.content.children`, 'expected a paragraph-set'); continue; }
        const set = rootKids[0];
        if (!isRec(set) || set.type !== 'paragraph-set') { bad(`${where}.content.children[0].type`, `expected paragraph-set, got ${isRec(set) ? String(set.type) : typeof set}`); continue; }
        const paras = set.children;
        if (!Array.isArray(paras) || !paras.length) { bad(`${where}.content.children[0].children`, 'expected at least one paragraph'); continue; }
        paras.forEach((p, i) => {
          const w = `${where}.content…paragraphs[${i}]`;
          if (!isRec(p)) return void bad(w, 'expected an object');
          if (p.type !== 'paragraph') bad(`${w}.type`, `expected paragraph, got ${JSON.stringify(p.type)}`);
          const spans = p.children;
          if (!Array.isArray(spans) || !spans.length) return void bad(`${w}.children`, 'a paragraph needs at least one span');
          spans.forEach((s, j) => {
            const sw = `${w}.children[${j}]`;
            if (!isRec(s)) return void bad(sw, 'expected an object');
            if (typeof s.text !== 'string') bad(`${sw}.text`, `expected a string, got ${typeof s.text}`);
            for (const k of ['fontSize', 'fontWeight', 'lineHeight']) {
              if (typeof s[k] !== 'string' || !s[k]) bad(`${sw}.${k}`, `expected a non-empty STRING (Penpot stores text metrics as strings), got ${JSON.stringify(s[k])}`);
            }
            fillsOf(s, sw);
          });
        });
      }
      // paint
      fillsOf(rec, where);
      if (rec.strokes !== undefined) {
        if (!Array.isArray(rec.strokes)) bad(`${where}.strokes`, 'expected an array');
        else (rec.strokes as unknown[]).forEach((s, i) => {
          const w = `${where}.strokes[${i}]`;
          if (!isRec(s)) return void bad(w, 'expected an object');
          if (typeof s.strokeColor !== 'string' || !HEX6.test(s.strokeColor)) bad(`${w}.strokeColor`, `expected #rrggbb, got ${JSON.stringify(s.strokeColor)}`);
          num(s, 'strokeWidth', w);
          if (typeof s.strokeAlignment !== 'string' || !STROKE_ALIGNMENTS.has(s.strokeAlignment)) bad(`${w}.strokeAlignment`, `expected center|inner|outer, got ${JSON.stringify(s.strokeAlignment)}`);
          if (typeof s.strokeStyle !== 'string' || !STROKE_STYLES.has(s.strokeStyle)) bad(`${w}.strokeStyle`, `expected solid|dashed|dotted, got ${JSON.stringify(s.strokeStyle)}`);
        });
      }
      if (rec.shadow !== undefined) {
        if (!Array.isArray(rec.shadow)) bad(`${where}.shadow`, 'expected an array');
        else (rec.shadow as unknown[]).forEach((s, i) => {
          const w = `${where}.shadow[${i}]`;
          if (!isRec(s)) return void bad(w, 'expected an object');
          uuid(s, 'id', w);
          if (s.style !== 'drop-shadow' && s.style !== 'inner-shadow') bad(`${w}.style`, `expected drop-shadow|inner-shadow, got ${JSON.stringify(s.style)}`);
          for (const k of ['offsetX', 'offsetY', 'blur', 'spread']) num(s, k, w);
          if (typeof s.hidden !== 'boolean') bad(`${w}.hidden`, `expected a boolean, got ${JSON.stringify(s.hidden)}`);
          const c = s.color;
          if (!isRec(c)) return void bad(`${w}.color`, 'expected an object');
          if (typeof c.color !== 'string' || !HEX6.test(c.color)) bad(`${w}.color.color`, `expected #rrggbb, got ${JSON.stringify(c.color)}`);
          const op = num(c, 'opacity', `${w}.color`);
          if (op < 0 || op > 1) bad(`${w}.color.opacity`, `expected 0..1, got ${op}`);
        });
      }
      for (const [key, expect] of [['blur', 'layer-blur'], ['backgroundBlur', 'background-blur']] as const) {
        const b = rec[key];
        if (b === undefined) continue;
        const w = `${where}.${key}`;
        if (!isRec(b)) { bad(w, 'expected an object'); continue; }
        uuid(b, 'id', w);
        if (b.type !== expect) bad(`${w}.type`, `expected ${expect}, got ${JSON.stringify(b.type)}`);
        num(b, 'value', w);
        if (typeof b.hidden !== 'boolean') bad(`${w}.hidden`, `expected a boolean, got ${JSON.stringify(b.hidden)}`);
      }
    }

    // the root frame, and its census of the page's top-level shapes
    const root = page.get(PENPOT_ROOT_ID);
    if (!root) { bad(`files/${fileId}/pages/${pid}/${PENPOT_ROOT_ID}.json`, 'every page needs the root frame'); continue; }
    if (root.type !== 'frame') bad(`files/${fileId}/pages/${pid}/${PENPOT_ROOT_ID}.json.type`, 'the root shape must be a frame');
    const listed = new Set((Array.isArray(root.shapes) ? root.shapes : []) as string[]);
    const expected = [...page.keys()].filter(id => id !== PENPOT_ROOT_ID && page.get(id)!.parentId === PENPOT_ROOT_ID);
    for (const id of expected) {
      if (!listed.has(id)) bad(`files/${fileId}/pages/${pid}/${PENPOT_ROOT_ID}.json.shapes`, `top-level shape ${id} (${String(page.get(id)!.name)}) is not listed`);
    }
    if (listed.size !== expected.length) bad(`files/${fileId}/pages/${pid}/${PENPOT_ROOT_ID}.json.shapes`, `lists ${listed.size} ids but the page has ${expected.length} top-level shapes`);
  }

  // every non-shape/-page/-media json is walked for finiteness too
  for (const path of Object.keys(entries)) {
    if (!path.endsWith('.json')) continue;
    if (SHAPE_ENTRY.test(path) || PAGE_ENTRY.test(path)) continue;
    json(path);
  }

  const byName = new Map<string, Record<string, unknown>>();
  for (const rec of all) byName.set(String(rec.name), rec);
  return { fileId, pageIds, byName, shapes: all };
}

// ── fixtures ─────────────────────────────────────────────────────────────────

/** A real 1x1 PNG (70 bytes), so `imageDimensions` reads a genuine IHDR. */
const PNG_1x1 = new Uint8Array(Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
));
const PNG_DATA_URL = `data:image/png;base64,${Buffer.from(PNG_1x1).toString('base64')}`;
const MEDIA_ID = '11111111-2222-4333-8444-555555555555';
const PNG_MEDIA: PenpotMedia = { id: MEDIA_ID, name: 'dot.png', mtype: 'image/png', width: 1, height: 1, bytes: PNG_1x1 };

const FIXED_NOW = '2026-09-02T09:00:00.000Z';
const buildOpts = (seed = 1) => ({ uuid: seededPenpotUuid(seed), now: () => FIXED_NOW });

const near = (a: number, b: number, eps: number, what: string): void => {
  assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} is not within ${eps} of ${b}`);
};
const sameColor = (a: unknown, b: string, what: string): void => {
  assert.equal(String(a).toLowerCase(), b.toLowerCase(), what);
};
/** `lin.srgb_<angle>_<stop>_<stop>` → its parts, so an angle can be compared loosely. */
const specParts = (spec: string): { kind: string; angle: number; stops: string[] } => {
  const m = /^(lin|rad)\.srgb_(-?[\d.]+)_(.+)$/.exec(spec);
  assert.ok(m, `not a gradient spec: ${spec}`);
  return { kind: m![1]!, angle: parseFloat(m![2]!), stops: m![3]!.split('_') };
};

// ── 1. buildPenpotEntries over every shape type ──────────────────────────────

function kitchenSinkDoc(): PenpotDoc {
  const shapes: PenpotIrShape[] = [
    { type: 'rect', name: 'Rounded', x: 10, y: 10, w: 100, h: 50, radius: [4, 8, 12, 16], fills: [{ color: '#ff0000', opacity: 0.5 }] },
    {
      type: 'rect', name: 'Dashed', x: 10, y: 70, w: 100, h: 40, fills: [{ color: '#0c322c' }],
      strokes: [{ color: '#30ba78', width: 3, style: 'dashed', dash: 8, gap: 4, capStart: 'round', capEnd: 'triangle-arrow', alignment: 'inner' }],
    },
    {
      type: 'circle', name: 'Radial', x: 130, y: 10, w: 60, h: 60,
      fills: [{ gradient: { type: 'radial', startX: 0.5, startY: 0.5, endX: 0.5, endY: 1, width: 1, stops: [{ color: '#ff0000', offset: 0 }, { color: '#0000ff', offset: 1 }] } }],
    },
    { type: 'path', name: 'Chevron', x: 200, y: 10, w: 100, h: 50, d: 'M200,10L250,60L300,10Z', fills: [{ color: '#123456' }] },
    {
      type: 'text', name: 'Copy', x: 10, y: 130, w: 220, h: 60, valign: 'center', growType: 'auto-height',
      paragraphs: [
        { align: 'left', runs: [{ text: 'Hello ', fontFamily: 'SUSE', fontWeight: 400, fontSize: 18, lineHeight: 1.2 }, { text: 'world', fontFamily: 'SUSE', fontWeight: 700, italic: true, fontSize: 18, color: '#30ba78', decoration: 'underline', transform: 'uppercase' }] },
        { align: 'center', runs: [{ text: 'second line', fontFamily: 'Outfit', fontWeight: 300, fontSize: 12, letterSpacing: 1.5 }] },
      ],
    },
    { type: 'image', name: 'Picture', x: 250, y: 130, w: 64, h: 64, media: MEDIA_ID, radius: 6 },
    { type: 'image', name: 'Ghost', x: 0, y: 0, w: 10, h: 10, media: 'not-a-media-id' },
    {
      type: 'group', name: 'Pair', x: 10, y: 210, w: 120, h: 40, children: [
        { type: 'rect', name: 'Pair L', x: 10, y: 210, w: 50, h: 40, fills: [{ color: '#000000' }] },
        { type: 'rect', name: 'Pair R', x: 80, y: 210, w: 50, h: 40, fills: [{ color: '#ffffff' }] },
      ],
    },
    {
      type: 'group', name: 'Masked', x: 150, y: 210, w: 100, h: 40, masked: true, children: [
        { type: 'circle', name: 'Mask', x: 150, y: 210, w: 40, h: 40, fills: [{ color: '#000000' }] },
        { type: 'rect', name: 'Under mask', x: 150, y: 210, w: 100, h: 40, fills: [{ color: '#ff00ff' }] },
      ],
    },
    {
      type: 'rect', name: 'Rotated', x: 300, y: 210, w: 80, h: 40, rotation: 30, opacity: 0.5, blend: 'multiply',
      blur: 6, backgroundBlur: 20,
      fills: [{ gradient: { type: 'linear', startX: 0, startY: 0.5, endX: 1, endY: 0.5, stops: [{ color: '#ff0000', offset: 0, opacity: 0.5 }, { color: '#0000ff', offset: 1 }] } }],
      shadows: [{ style: 'drop-shadow', x: 2, y: 4, blur: 10, spread: 1, color: '#000000', opacity: 0.33 }],
    },
  ];
  return {
    name: 'Kitchen sink',
    media: [PNG_MEDIA, { id: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', name: 'clip.wav', mtype: 'audio/wav', width: 10, height: 10, bytes: new Uint8Array([1, 2, 3]) }],
    pages: [{
      name: 'Page 1', background: '#ffffff',
      shapes: [{ type: 'board', name: 'Board A', x: 0, y: 0, w: 400, h: 300, showContent: true, fills: [{ color: '#ffffff' }], children: shapes }],
    }],
    palette: [{ name: 'Jungle', path: 'base', color: '#30ba78' }],
    typographies: [{ name: 'Heading', fontFamily: 'SUSE', fontWeight: 700, fontSize: 32, lineHeight: 1.1 }],
    googleFamilies: ['Outfit'],
  };
}

test('buildPenpotEntries: an archive covering every shape type passes the importer checks', () => {
  const build = buildPenpotEntries(kitchenSinkDoc(), buildOpts());
  const v = validatePenpotEntries(build.entries);

  assert.equal(v.pageIds.length, 1);
  assert.equal(build.pageIds.length, 1);
  assert.equal(build.mediaCount, 1, 'the audio media is not a Penpot image type');
  assert.equal(PENPOT_MIME, 'application/x-penpot');

  const file = JSON.parse(String(build.entries[`files/${build.fileId}.json`]));
  assert.equal(file.version, PENPOT_FILE_VERSION);
  assert.equal(file.name, 'Kitchen sink');
  assert.equal(file.createdAt, FIXED_NOW);

  // Every authored shape reached the archive, under its authored name.
  for (const name of ['Board A', 'Rounded', 'Dashed', 'Radial', 'Chevron', 'Copy', 'Picture', 'Pair', 'Pair L', 'Pair R', 'Masked', 'Mask', 'Under mask', 'Rotated']) {
    assert.ok(v.byName.has(name), `shape ${name} is in the archive`);
  }
  assert.equal(v.byName.get('Board A')!.type, 'frame');
  assert.equal(v.byName.get('Board A')!.showContent, true);
  assert.equal(v.byName.get('Masked')!.maskedGroup, true);
  assert.equal(v.byName.get('Picture')!.type, 'rect', 'a picture is a rect with an image fill, as Penpot writes one');
  const rounded = v.byName.get('Rounded')!;
  assert.deepEqual([rounded.r1, rounded.r2, rounded.r3, rounded.r4], [4, 8, 12, 16], 'per-corner radii, clockwise from top-left');

  // Library colours + typographies are filed under their Assets tab folders.
  assert.equal(Object.keys(build.entries).filter(p => /\/colors\/[^/]+\.json$/.test(p)).length, 1);
  assert.equal(Object.keys(build.entries).filter(p => /\/typographies\/[^/]+\.json$/.test(p)).length, 1);
});

test('buildPenpotEntries: the version + migrations pin matches a real Penpot export', () => {
  // `tests/fixtures/penpot-kitchen-sink.penpot` is a genuine Penpot 2.17.1-RC4
  // export (media-trimmed, so it is a READER fixture and cannot itself be
  // imported - see tests/penpot-kitchen-sink.test.ts). Its file record is still
  // the real thing, and it is the only committed evidence of what a current
  // Penpot writes, so the writer's pin is compared against it here.
  const fixture = join(ROOT, 'tests/fixtures/penpot-kitchen-sink.penpot');
  const entries = unzipSync(new Uint8Array(readFileSync(fixture))) as Record<string, Uint8Array>;
  const filePath = Object.keys(entries).find(p => /^files\/[^/]+\.json$/.test(p))!;
  const real = JSON.parse(new TextDecoder().decode(entries[filePath]!));

  assert.equal(PENPOT_FILE_VERSION, real.version, 'the file data version is pinned to the real export');
  assert.deepEqual([...PENPOT_FEATURES], real.features, 'the declared features match, in order');
  // The pin was taken from a 2.17.0-RC2 export; RC4 added exactly one migration.
  // Leaving it out is the SAFE direction - an unlisted migration is one Penpot
  // runs on import, while claiming one that never ran would skip a repair.
  const RC4_ONLY = ['0021-repair-bad-tokens'];
  assert.deepEqual(
    [...PENPOT_MIGRATIONS],
    (real.migrations as string[]).filter(m => !RC4_ONLY.includes(m)),
    'the migration pin is the real export\'s list, in order, minus the ids a later Penpot added',
  );
});

test('validatePenpotEntries: the checker is not vacuous - it names the field that broke', () => {
  const build = buildPenpotEntries(kitchenSinkDoc(), buildOpts());
  const clone = (): Entries => ({ ...build.entries });
  const shapePath = Object.keys(build.entries).find(p => SHAPE_ENTRY.test(p) && JSON.parse(String(build.entries[p])).name === 'Rounded')!;
  const edit = (path: string, mutate: (rec: any) => void): Entries => {
    const next = clone();
    const rec = JSON.parse(String(next[path]));
    mutate(rec);
    next[path] = JSON.stringify(rec);
    return next;
  };

  const cases: Array<[string, Entries, RegExp]> = [
    ['a fill with two paints', edit(shapePath, r => { r.fills[0].fillColorGradient = { type: 'linear', startX: 0, startY: 0, endX: 1, endY: 0, stops: [{ color: '#000000', offset: 0 }] }; }), /a fill carries exactly one paint/],
    ['a NaN in the geometry', edit(shapePath, r => { r.selrect.x = null; }), /selrect\.x/],
    ['a nameless shape', edit(shapePath, r => { r.name = ''; }), /\.name/],
    ['an unknown shape type', edit(shapePath, r => { r.type = 'widget'; }), /unknown shape type/],
    ['a stroke with no alignment', edit(shapePath, r => { r.strokes = [{ strokeColor: '#000000', strokeWidth: 1, strokeStyle: 'solid' }]; }), /strokeAlignment/],
    ['a dangling parent', edit(shapePath, r => { r.parentId = '99999999-9999-4999-8999-999999999999'; }), /parentId/],
    ['a top-level shape the root frame does not list', (() => {
      const next = clone();
      const rootPath = Object.keys(next).find(p => p.endsWith(`/${PENPOT_ROOT_ID}.json`))!;
      const root = JSON.parse(String(next[rootPath]));
      root.shapes = [];
      next[rootPath] = JSON.stringify(root);
      return next;
    })(), /is not listed|lists 0 ids/],
    ['a storage object whose size lies', (() => {
      const next = clone();
      const objPath = Object.keys(next).find(p => /^objects\/.+\.json$/.test(p))!;
      const obj = JSON.parse(String(next[objPath]));
      obj.size = obj.size + 1;
      next[objPath] = JSON.stringify(obj);
      return next;
    })(), /does not match the .* bytes stored/],
    ['a text metric written as a number', (() => {
      const path = Object.keys(build.entries).find(p => SHAPE_ENTRY.test(p) && JSON.parse(String(build.entries[p])).type === 'text')!;
      return edit(path, r => { r.content.children[0].children[0].children[0].fontSize = 18; });
    })(), /expected a non-empty STRING/],
    ['a missing manifest', (() => { const next = clone(); delete next['manifest.json']; return next; })(), /manifest\.json: entry missing/],
  ];
  for (const [label, entries, re] of cases) {
    assert.throws(() => validatePenpotEntries(entries), re, `${label} must be rejected`);
  }
  // and the untouched archive still passes, so none of the above leaked
  validatePenpotEntries(build.entries);
});

test('buildPenpotEntries: every page gets its own indexed record and its own root frame', () => {
  const build = buildPenpotEntries({
    name: 'Two pages',
    pages: [
      { name: 'Cover', shapes: [{ type: 'rect', name: 'A', x: 0, y: 0, w: 10, h: 10, fills: [{ color: '#000000' }] }] },
      { name: 'Inside', background: '#eeeeee', shapes: [{ type: 'rect', name: 'B', x: 0, y: 0, w: 10, h: 10, fills: [{ color: '#ffffff' }] }] },
    ],
  }, buildOpts(41));
  const v = validatePenpotEntries(build.entries);
  assert.equal(v.pageIds.length, 2);
  const pages = build.pageIds.map(pid => JSON.parse(String(build.entries[`files/${build.fileId}/pages/${pid}.json`])));
  assert.deepEqual(pages.map(p => [p.name, p.index]), [['Cover', 0], ['Inside', 1]]);
  assert.equal(pages[1].background, '#eeeeee');
  for (const pid of build.pageIds) {
    assert.ok(`files/${build.fileId}/pages/${pid}/${PENPOT_ROOT_ID}.json` in build.entries, `page ${pid} has a root frame`);
  }
  // A doc with no pages still gets one, so the file opens.
  const empty = buildPenpotEntries({ name: 'Empty', pages: [] }, buildOpts(43));
  assert.equal(validatePenpotEntries(empty.entries).pageIds.length, 1);
  assert.equal(empty.shapeCount, 0);
});

test('buildPenpotEntries: a rotation is the matrix about the centre, and the points are the rotated corners', () => {
  const build = buildPenpotEntries(kitchenSinkDoc(), buildOpts());
  const v = validatePenpotEntries(build.entries);
  const rot = v.byName.get('Rotated')!;

  const rad = 30 * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
  assert.equal(rot.rotation, 30);
  assert.deepEqual(rot.transform, { a: Math.round(cos * 1e4) / 1e4, b: 0.5, c: -0.5, d: Math.round(cos * 1e4) / 1e4, e: 0, f: 0 });
  assert.deepEqual(rot.transformInverse, { a: Math.round(cos * 1e4) / 1e4, b: -0.5, c: 0.5, d: Math.round(cos * 1e4) / 1e4, e: 0, f: 0 });

  // selrect stays UNROTATED (Penpot's model); the points carry the rotation.
  assert.deepEqual(rot.selrect, { x: 300, y: 210, width: 80, height: 40, x1: 300, y1: 210, x2: 380, y2: 250 });
  const cx = 340, cy = 230;
  const corner = (px: number, py: number) => {
    const dx = px - cx, dy = py - cy;
    return { x: Math.round((cx + dx * cos - dy * sin) * 1e4) / 1e4, y: Math.round((cy + dx * sin + dy * cos) * 1e4) / 1e4 };
  };
  assert.deepEqual(rot.points, [corner(300, 210), corner(380, 210), corner(380, 250), corner(300, 250)]);

  // and the effects rode along
  assert.equal(rot.opacity, 0.5);
  assert.equal(rot.blendMode, 'multiply');
  assert.equal((rot.blur as { value: number }).value, 6);
  assert.equal((rot.backgroundBlur as { type: string }).type, 'background-blur');
  assert.equal((rot.shadow as Array<{ offsetX: number }>)[0]!.offsetX, 2);
});

test('buildPenpotEntries: unknown media on an image shape is dropped, unsupported media is skipped, both with a warning', () => {
  const build = buildPenpotEntries(kitchenSinkDoc(), buildOpts());
  const v = validatePenpotEntries(build.entries);

  assert.ok(!v.byName.has('Ghost'), 'the image shape naming no media never reached the archive');
  assert.ok(build.warnings.some(w => /image shape names unknown media not-a-media-id/.test(w)), `warnings: ${build.warnings.join(' | ')}`);
  assert.ok(build.warnings.some(w => /clip\.wav has unsupported type audio\/wav/.test(w)), `warnings: ${build.warnings.join(' | ')}`);
  assert.equal(Object.keys(build.entries).filter(p => /^objects\/.+\.wav$/.test(p)).length, 0);
});

test('buildPenpotEntries: the text tree is root → paragraph-set → paragraphs, with string metrics and a gfont id', () => {
  const build = buildPenpotEntries(kitchenSinkDoc(), buildOpts());
  const v = validatePenpotEntries(build.entries);
  const text = v.byName.get('Copy')! as { content: any; growType: string };
  assert.equal(text.growType, 'auto-height');
  assert.equal(text.content.verticalAlign, 'center');
  const paras = text.content.children[0].children;
  assert.equal(paras.length, 2);
  assert.equal(paras[0].children.length, 2, 'two runs in the first paragraph');
  assert.equal(paras[0].children[0].text, 'Hello ');
  assert.equal(paras[0].children[1].fontWeight, '700');
  assert.equal(paras[0].children[1].fontStyle, 'italic');
  assert.equal(paras[0].children[1].textDecoration, 'underline');
  assert.equal(paras[0].children[1].textTransform, 'uppercase');
  assert.equal(paras[0].children[1].fontVariantId, '700italic');
  assert.equal(paras[0].children[0].fontId, 'suse', 'a non-Google family is the bare slug');
  assert.equal(paras[1].children[0].fontId, 'gfont-outfit', 'a declared Google family gets Penpot\'s gfont- id');
  assert.equal(paras[1].textAlign, 'center');
});

// ── 2. boxesToPenpotDoc ──────────────────────────────────────────────────────

const GRAD_SPEC = 'lin.srgb_90_ff0000-0_0000ff-100';

/** An encoded authored pen path (the `path` box's field), or null on this engine. */
function authoredTriangle(): string | null {
  const geom = makeGeomApi();
  const r = geom.encodeAuthored([{ kind: 'line', nodes: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 1 }], closed: true }] as never) as { ok: boolean; value?: string };
  return r?.ok && typeof r.value === 'string' ? r.value : null;
}

function designBoxes(): Array<Record<string, unknown>> {
  const path = authoredTriangle();
  const boxes: Array<Record<string, unknown>> = [
    // Two frames: `order` decides, not x - f0 sits to the RIGHT and still comes first.
    { id: 'f0', kind: 'frame', name: 'First', order: 1, x: 500, y: 0, w: 400, h: 300, bg: '#ffffff', clipChildren: false },
    { id: 'f1', kind: 'frame', name: 'Second', order: 2, x: 0, y: 0, w: 400, h: 300, bg: '#eeeeee' },

    { id: 'r1', kind: 'box', name: 'Plain', frame: 'f0', shape: 'rect', x: 510, y: 10, w: 100, h: 60, bg: '#30ba78' },
    { id: 'r2', kind: 'box', name: 'Rounded', frame: 'f0', shape: 'rounded', radius: 12, x: 510, y: 90, w: 100, h: 60, bg: '#0c322c' },
    { id: 'r3', kind: 'box', name: 'Pill', frame: 'f0', shape: 'pill', x: 510, y: 170, w: 120, h: 40, bg: '#008657' },
    { id: 'e1', kind: 'box', name: 'Ellipse', frame: 'f0', shape: 'ellipse', x: 660, y: 10, w: 80, h: 80, bg: '#90ebcd' },
    {
      id: 't1', kind: 'text', name: 'Copy', frame: 'f0', x: 660, y: 110, w: 200, h: 80,
      text: 'Hello {#ff0000 w700|red}\n- bullet', fg: '#0c322c', fontSize: 24, weight: 400,
      font: 'sans', align: 'left', valign: 'top', lineHeight: 1.2,
    },
    { id: 'a1', kind: 'audio', name: 'Soundtrack', frame: 'f0', x: 0, y: 0, w: 10, h: 10 },

    { id: 'i1', kind: 'image', name: 'Picture', frame: 'f1', x: 10, y: 10, w: 64, h: 64, fit: 'cover', shape: 'rounded', radius: 8 },
    { id: 'g1', kind: 'box', name: 'Gradient', frame: 'f1', shape: 'rect', x: 10, y: 90, w: 200, h: 100, grad: GRAD_SPEC },
    {
      id: 's1', kind: 'box', name: 'Stroked', frame: 'f1', shape: 'rect', x: 250, y: 10, w: 100, h: 60, bg: '#ffffff',
      stroke: '#0c322c', strokeW: 3, strokeDash: 'dashed', strokeDashLen: 8, strokeGapLen: 4,
      shadow: 'box', shadowColor: '#00000055', shadowX: 2, shadowY: 4, shadowBlur: 10,
    },
    {
      id: 'd1', kind: 'box', name: 'Effects', frame: 'f1', shape: 'rect', x: 250, y: 100, w: 100, h: 60,
      shadow: 'depth', z: 100, blur: 5, bgBlur: 20, blend: 'multiply', rot: 45, opacity: 50,
    },
    { id: 'm1', kind: 'box', name: 'Mask', frame: 'f1', shape: 'ellipse', x: 20, y: 200, w: 80, h: 80, bg: '#000000' },
    { id: 'c1', kind: 'box', name: 'Clipped', frame: 'f1', shape: 'rect', x: 20, y: 200, w: 120, h: 80, bg: '#42d29f', clip: 'm1' },

    // No `frame` at all - the pasteboard, beside the boards.
    { id: 'x1', kind: 'box', name: 'Scratch', shape: 'rect', x: 950, y: 0, w: 50, h: 50, bg: '#ff00ff' },
  ];
  if (path) boxes.push({ id: 'p1', kind: 'path', name: 'Triangle', frame: 'f1', path, x: 250, y: 200, w: 80, h: 60, bg: '#123456' });
  return boxes;
}

const boxesOpts = () => ({
  name: 'Design doc',
  canvas: { w: 1000, h: 600 },
  fonts: { sans: 'SUSE', mono: 'SUSE Mono' },
  mediaFor: (b: Record<string, unknown>) => (b.id === 'i1' ? PNG_MEDIA : null),
});

test('boxesToPenpotDoc: frames become boards in order-then-x order, members attach, scratch sits at the page root, audio is dropped', (t) => {
  const boxes = designBoxes();
  if (!boxes.some(b => b.kind === 'path')) t.diagnostic('geom.encodeAuthored unavailable - the path box case is not covered');
  const doc = boxesToPenpotDoc(boxes, boxesOpts());

  assert.equal(doc.pages.length, 1);
  const top = doc.pages[0]!.shapes;
  assert.equal(top[0]!.type, 'board');
  assert.equal(top[1]!.type, 'board');
  assert.deepEqual([top[0]!.name, top[1]!.name], ['First', 'Second'], 'order 1 wins over the smaller x of the second frame');

  const first = top[0] as { children: PenpotIrShape[]; showContent?: boolean };
  const second = top[1] as { children: PenpotIrShape[] };
  assert.equal(first.showContent, true, 'clipChildren:false means the board shows overflow');
  assert.deepEqual(first.children.map(c => c.name), ['Plain', 'Rounded', 'Pill', 'Ellipse', 'Copy']);
  assert.deepEqual(second.children.map(c => c.name).sort(), ['Clipped (clipped)', 'Effects', 'Gradient', 'Mask', 'Picture', 'Stroked', ...(boxes.some(b => b.kind === 'path') ? ['Triangle'] : [])].sort());

  // The scratch box is a page-root sibling of the boards, not a board member.
  assert.equal(top.length, 3);
  assert.equal(top[2]!.name, 'Scratch');
  assert.equal(top[2]!.type, 'rect');

  // The audio box is skipped everywhere.
  const names = new Set<string>();
  const walk = (s: PenpotIrShape): void => { names.add(String(s.name)); if ('children' in s) s.children.forEach(walk); };
  top.forEach(walk);
  assert.ok(!names.has('Soundtrack'), 'an audio box has no Penpot shape');

  // Shape mapping: pill/rounded radii, ellipse, image media, clip → masked group.
  const byName = new Map(second.children.concat(first.children).map(s => [String(s.name), s]));
  assert.equal((byName.get('Rounded') as { radius?: unknown }).radius, 12);
  assert.equal((byName.get('Pill') as { radius?: unknown }).radius, 20);
  assert.equal(byName.get('Ellipse')!.type, 'circle');
  assert.equal(byName.get('Picture')!.type, 'image');
  assert.equal((byName.get('Picture') as { media: string }).media, MEDIA_ID);
  const clipped = byName.get('Clipped (clipped)') as { type: string; masked?: boolean; children: PenpotIrShape[] };
  assert.equal(clipped.type, 'group');
  assert.equal(clipped.masked, true);
  assert.deepEqual(clipped.children.map(c => c.name), ['Mask', 'Clipped']);
  assert.equal(doc.media!.length, 1, 'the one image box contributed its bytes once');

  // The pen path is re-based from the box's 0..1 node frame to page coordinates.
  const tri = byName.get('Triangle') as { type: string; d: string; x: number; y: number; w: number; h: number } | undefined;
  if (!tri) { t.diagnostic('no path box in the fixture - skipping the pen-path assertions'); return; }
  assert.equal(tri.type, 'path');
  assert.ok(/^M/.test(tri.d), `path content starts with an absolute move, got ${tri.d.slice(0, 12)}`);
  assert.deepEqual([tri.x, tri.y, tri.w, tri.h], [250, 200, 80, 60], 'the path bbox is the box, in page coordinates');
  for (const n of tri.d.match(/-?\d+(?:\.\d+)?/g) ?? []) assert.ok(Number.isFinite(parseFloat(n)));
});

test('boxesToPenpotDoc: the archive it produces passes the importer checks', () => {
  const doc = boxesToPenpotDoc(designBoxes(), boxesOpts());
  const build = buildPenpotEntries(doc, buildOpts(7));
  const v = validatePenpotEntries(build.entries);
  assert.equal(v.pageIds.length, 1);
  assert.ok(v.byName.has('First') && v.byName.has('Second') && v.byName.has('Scratch'));
  assert.equal(build.mediaCount, 1);
});

// ── 3. round trip: writer → Penpot READ side ─────────────────────────────────

/** Every page shape json of a build, keyed by name, with the boxes the READ side recovers. */
function readBack(entries: Entries): Map<string, { shape: Record<string, any>; box: Record<string, any> | null }> {
  const out = new Map<string, { shape: Record<string, any>; box: Record<string, any> | null }>();
  for (const [path, value] of Object.entries(entries)) {
    if (!SHAPE_ENTRY.test(path)) continue;
    const shape = JSON.parse(typeof value === 'string' ? value : new TextDecoder().decode(value));
    if (shape.id === PENPOT_ROOT_ID) continue;
    const node = penpotShapeToNode(shape);
    const rows = node ? finalizeBoxes([node]) : [];
    out.set(String(shape.name), { shape, box: (rows[0] as Record<string, any>) ?? null });
  }
  return out;
}

test('round trip: a rect, an ellipse, a text and an image come back through penpotShapeToNode + finalizeBoxes', () => {
  const build = buildPenpotEntries(boxesToPenpotDoc(designBoxes(), boxesOpts()), buildOpts(3));
  validatePenpotEntries(build.entries);
  const back = readBack(build.entries);

  const plain = back.get('Plain')!;
  assert.equal(plain.box!.kind, 'box');
  near(plain.box!.x, 510, 0.5, 'Plain.x'); near(plain.box!.y, 10, 0.5, 'Plain.y');
  near(plain.box!.w, 100, 0.5, 'Plain.w'); near(plain.box!.h, 60, 0.5, 'Plain.h');
  sameColor(plain.box!.bg, '#30ba78', 'Plain.bg');

  const rounded = back.get('Rounded')!;
  assert.equal(rounded.box!.shape, 'rounded');
  assert.equal(rounded.box!.radius, 12);

  const ell = back.get('Ellipse')!;
  assert.equal(ell.box!.shape, 'ellipse');
  near(ell.box!.x, 660, 0.5, 'Ellipse.x'); near(ell.box!.w, 80, 0.5, 'Ellipse.w');
  sameColor(ell.box!.bg, '#90ebcd', 'Ellipse.bg');

  const text = back.get('Copy')!;
  assert.equal(text.box!.kind, 'text');
  // Paragraphs join with \n, and a run whose colour differs from the box `fg` comes
  // back as the Design tool's own `{#hex|text}` marker (the read side's
  // colorRunsToText) - so the red run survives the trip, minus its weight, which
  // the reader has no encoding for. The bullet was rendered to its glyph on the way
  // out and stays that way.
  assert.equal(text.box!.text, 'Hello {#ff0000|red}\n•  bullet');
  assert.equal(text.box!.fontSize, 24);
  sameColor(text.box!.fg, '#0c322c', 'Copy.fg');
  assert.equal(text.box!.align, 'left');
  near(text.box!.x, 660, 0.5, 'Copy.x'); near(text.box!.w, 200, 0.5, 'Copy.w');

  const pic = back.get('Picture')!;
  assert.equal(pic.box!.kind, 'image');
  near(pic.box!.x, 10, 0.5, 'Picture.x'); near(pic.box!.y, 10, 0.5, 'Picture.y');
  near(pic.box!.w, 64, 0.5, 'Picture.w'); near(pic.box!.h, 64, 0.5, 'Picture.h');
  assert.equal(pic.box!.fit, 'cover');
  const node = penpotShapeToNode(pic.shape) as { _fillImageId?: string };
  assert.equal(node._fillImageId, MEDIA_ID, 'the image fill still names the media the box supplied');
});

test('round trip: gradient, stroke, shadow, rotation, blur and backdrop blur survive the writer', () => {
  const build = buildPenpotEntries(boxesToPenpotDoc(designBoxes(), boxesOpts()), buildOpts(5));
  validatePenpotEntries(build.entries);
  const back = readBack(build.entries);

  // Gradient: through the READ side's own decoder, angle within a degree.
  const grad = back.get('Gradient')!;
  const fill = grad.shape.fills[0];
  const spec = penpotGradientToSpec(fill.fillColorGradient, grad.shape.width, grad.shape.height, fill.fillOpacity);
  const got = specParts(spec), want = specParts(GRAD_SPEC);
  assert.equal(got.kind, want.kind);
  assert.deepEqual(got.stops, want.stops);
  near(got.angle, want.angle, 1, 'gradient angle');
  assert.equal(grad.box!.grad, spec, 'the box row carries the same spec the decoder produced');

  // Stroke: colour, width and the dash style come back on the box row.
  const stroked = back.get('Stroked')!;
  sameColor(stroked.box!.stroke, '#0c322c', 'Stroked.stroke');
  assert.equal(stroked.box!.strokeW, 3);
  assert.equal(stroked.box!.strokeDash, 'dashed');
  assert.equal(stroked.box!.strokeDashLen, 8);
  assert.equal(stroked.box!.strokeGapLen, 4);
  // Shadow offsets and blur, and the alpha folded back into an 8-digit hex.
  assert.equal(stroked.box!.shadow, 'box');
  assert.equal(stroked.box!.shadowX, 2);
  assert.equal(stroked.box!.shadowY, 4);
  assert.equal(stroked.box!.shadowBlur, 10);
  sameColor(stroked.box!.shadowColor, '#00000055', 'Stroked.shadowColor');

  // Rotation, blend, opacity, layer blur and backdrop blur.
  const fx = back.get('Effects')!;
  assert.equal(fx.box!.rot, 45);
  // The blend mode is on the written shape; the READ side has no blendMode mapping
  // (design-map never reads it), so the recovered box row is 'normal' - a gap in the
  // importer, not in the writer, and pinned here so it is noticed if either moves.
  assert.equal(fx.shape.blendMode, 'multiply');
  assert.equal(fx.box!.blend, 'normal');
  assert.equal(fx.box!.opacity, 50);
  assert.equal(fx.box!.blur, 5);
  near(fx.box!.bgBlur, 20, 0.1, 'Effects.bgBlur');
  near(penpotBackgroundBlurPx(fx.shape), 20, 0.1, 'penpotBackgroundBlurPx(Effects)');
  // The `depth` shadow lowers to a drop shadow whose blur grows with z.
  assert.equal(fx.box!.shadow, 'box');
  assert.equal(fx.box!.shadowY, 15);
  assert.equal(fx.box!.shadowBlur, 30);
});

// ── 4. gradient specs ────────────────────────────────────────────────────────

test('gradSpecToPenpot ↔ penpotGradientToSpec: linear angles and a radial spec round-trip', () => {
  for (const angle of [0, 45, 90, 180, 270]) {
    for (const [w, h] of [[200, 100], [100, 100], [60, 240]] as Array<[number, number]>) {
      const spec = `lin.srgb_${angle}_ff0000-0_00ff00-50_0000ff-100`;
      const g = gradSpecToPenpot(spec, w, h);
      assert.ok(g, `${spec} at ${w}x${h} parsed`);
      assert.equal(g!.type, 'linear');
      const back = specParts(penpotGradientToSpec(g, w, h, 1));
      const want = specParts(spec);
      assert.equal(back.kind, 'lin');
      assert.deepEqual(back.stops, want.stops, `${spec} at ${w}x${h}: stops`);
      // Signed circular difference in (-180, 180].
      const delta = ((back.angle - angle + 540) % 360) - 180;
      assert.ok(Math.abs(delta) <= 1, `${spec} at ${w}x${h}: angle came back ${back.angle}`);
    }
  }

  const radSpec = 'rad.srgb_0_ff0000-0_0000ff-100';
  const rad = gradSpecToPenpot(radSpec, 200, 100);
  assert.ok(rad);
  assert.equal(rad!.type, 'radial');
  assert.equal(rad!.width, 1, 'a box-filling ellipse is width 1 in Penpot\'s normalized space');
  assert.equal(penpotGradientToSpec(rad, 200, 100, 1), radSpec);

  // Stop alpha survives as the 8-digit form.
  const alpha = gradSpecToPenpot('lin.srgb_90_ff000080-0_0000ff-100', 100, 100);
  assert.ok(alpha);
  near(alpha!.stops[0]!.opacity!, 128 / 255, 1e-9, 'stop alpha');

  // Not a spec.
  assert.equal(gradSpecToPenpot('', 10, 10), null);
  assert.equal(gradSpecToPenpot('lin.srgb_90_zzz-0', 10, 10), null);
  assert.equal(gradSpecToPenpot('lin.srgb_90_ff0000-0', 10, 10), null, 'one stop is not a gradient');
});

// ── 5. the Design tool's inline markdown ─────────────────────────────────────

test('designTextRuns: the inline grammar', () => {
  assert.deepEqual(designTextRuns('plain text'), [{ text: 'plain text' }]);
  assert.deepEqual(designTextRuns('**bold**'), [{ text: 'bold', weight: 700 }]);
  assert.deepEqual(designTextRuns('*italic*'), [{ text: 'italic', italic: true }]);
  assert.deepEqual(designTextRuns('_italic_'), [{ text: 'italic', italic: true }]);
  assert.deepEqual(designTextRuns('`code`'), [{ text: 'code', family: 'mono' }]);
  assert.deepEqual(designTextRuns('{#00ff00 w300 mono|x}'), [{ text: 'x', color: '#00ff00', weight: 300, family: 'mono' }]);
  assert.deepEqual(designTextRuns('a \\*b\\* c'), [{ text: 'a *b* c' }], 'an escaped star is a literal star, not emphasis');
  assert.deepEqual(
    designTextRuns('lead **b** tail'),
    [{ text: 'lead ' }, { text: 'b', weight: 700 }, { text: ' tail' }],
  );
  assert.deepEqual(designTextRuns(''), []);
});

// ── 6. svgToPenpotDoc ────────────────────────────────────────────────────────

const svgOpts = { name: 'Render' };

test('svgToPenpotDoc: primitives land in page coordinates through the viewBox scale', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100">
    <rect id="r" x="10" y="10" width="20" height="10" fill="#ff0000"/>
    <circle id="c" cx="50" cy="50" r="10" fill="#00ff00"/>
    <path id="p" d="M0 0 L10 10" stroke="#000000" stroke-width="1" fill="none"/>
    <polygon id="poly" points="60,60 80,60 70,80" fill="#0000ff"/>
    <line id="l" x1="0" y1="90" x2="100" y2="90" stroke="#333333" stroke-width="2"/>
    <g id="g" transform="translate(5,5) rotate(30)" opacity="0.5">
      <rect x="0" y="0" width="10" height="10" fill="#111111"/>
      <rect x="20" y="0" width="10" height="10" fill="#222222"/>
    </g>
  </svg>`;
  const res = svgToPenpotDoc(svg, svgOpts);
  assert.ok(res, `expected a lowering, notes: ${res === null ? '(null)' : ''}`);
  assert.equal(res!.width, 200);
  assert.equal(res!.height, 200);
  const board = res!.doc.pages[0]!.shapes[0] as { type: string; w: number; children: PenpotIrShape[] };
  assert.equal(board.type, 'board');
  assert.equal(board.w, 200);
  const kids = new Map(board.children.map(k => [String(k.name), k]));

  const r = kids.get('r')!;
  assert.equal(r.type, 'rect');
  assert.deepEqual([r.x, r.y, r.w, r.h], [20, 20, 40, 20], 'the viewBox doubles every coordinate');
  const c = kids.get('c')!;
  assert.equal(c.type, 'circle');
  assert.deepEqual([c.x, c.y, c.w, c.h], [80, 80, 40, 40]);
  assert.equal(kids.get('p')!.type, 'path');
  const poly = kids.get('poly')!;
  assert.equal(poly.type, 'path');
  assert.deepEqual([poly.x, poly.y, poly.w, poly.h], [120, 120, 40, 40]);
  const line = kids.get('l')!;
  assert.equal(line.type, 'path');
  assert.deepEqual([line.x, line.y, line.w], [0, 180, 200]);
  assert.deepEqual(line.fills, [], 'a <line> has no fill');

  const g = kids.get('g') as { type: string; opacity?: number; children: PenpotIrShape[] };
  assert.equal(g.type, 'group');
  assert.equal(g.children.length, 2);
  assert.equal(g.opacity, 0.5, 'the group carries its own opacity rather than multiplying it into the children');
  assert.equal(g.children[0]!.type, 'path', 'a rotated rect cannot be an axis-aligned rect - it becomes a path');

  // and it builds into a valid archive
  validatePenpotEntries(buildPenpotEntries(res!.doc, buildOpts(11)).entries);
});

test('svgToPenpotDoc: linear (both unit systems) and radial gradients become Penpot gradient fills', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <defs>
      <linearGradient id="g1"><stop offset="0" stop-color="#ff0000"/><stop offset="1" stop-color="#0000ff"/></linearGradient>
      <linearGradient id="g2" gradientUnits="userSpaceOnUse" x1="0" y1="50" x2="50" y2="50">
        <stop offset="0" stop-color="#00ff00" stop-opacity="0.5"/><stop offset="1" stop-color="#000000"/>
      </linearGradient>
      <radialGradient id="g3"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#000000"/></radialGradient>
    </defs>
    <rect id="a" x="0" y="0" width="50" height="50" fill="url(#g1)"/>
    <rect id="b" x="0" y="50" width="50" height="50" fill="url(#g2)"/>
    <rect id="c" x="50" y="0" width="50" height="50" fill="url(#g3)"/>
  </svg>`;
  const res = svgToPenpotDoc(svg, svgOpts);
  assert.ok(res);
  const kids = new Map((res!.doc.pages[0]!.shapes[0] as { children: PenpotIrShape[] }).children.map(k => [String(k.name), k]));

  const a = kids.get('a')!.fills![0]!.gradient!;
  assert.equal(a.type, 'linear');
  assert.deepEqual([a.startX, a.startY, a.endX, a.endY], [0, 0, 1, 0]);
  assert.deepEqual(a.stops.map(s => s.color), ['#ff0000', '#0000ff']);

  const b = kids.get('b')!.fills![0]!.gradient!;
  assert.equal(b.type, 'linear');
  // userSpaceOnUse endpoints are re-expressed in the shape's own unit box.
  assert.deepEqual([b.startX, b.endX], [0, 1]);
  near(b.stops[0]!.opacity!, 0.5, 1e-9, 'stop-opacity');

  const c = kids.get('c')!.fills![0]!.gradient!;
  assert.equal(c.type, 'radial');
  assert.equal(c.startX, 0.5);
  assert.equal(c.startY, 0.5);
  assert.equal(c.endY, 1);

  validatePenpotEntries(buildPenpotEntries(res!.doc, buildOpts(13)).entries);
});

test('svgToPenpotDoc: stroke-dasharray becomes a dashed stroke with dash and gap scaled by the viewBox', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 100 100">
    <path id="d" d="M0 0 L100 0" stroke="#ff0000" stroke-width="2" stroke-dasharray="6 3" fill="none"/>
  </svg>`;
  const res = svgToPenpotDoc(svg, svgOpts);
  assert.ok(res);
  const shape = (res!.doc.pages[0]!.shapes[0] as { children: PenpotIrShape[] }).children[0]!;
  const stroke = shape.strokes![0]!;
  assert.equal(stroke.style, 'dashed');
  assert.equal(stroke.width, 4, 'stroke width rides the 2x viewBox scale');
  assert.equal(stroke.dash, 12);
  assert.equal(stroke.gap, 6);
  sameColor(stroke.color, '#ff0000', 'dash stroke colour');
});

test('svgToPenpotDoc: <text> anchors, baselines and font attrs become one auto-width run', () => {
  const make = (attrs: string) => svgToPenpotDoc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><text x="10" y="20" font-family="SUSE" font-size="12" font-weight="700" fill="#123456" ${attrs}>Hello</text></svg>`,
    svgOpts,
  );
  const textOf = (r: ReturnType<typeof svgToPenpotDoc>) => (r!.doc.pages[0]!.shapes[0] as { children: PenpotIrShape[] }).children[0] as any;

  const start = textOf(make('text-anchor="start"'));
  assert.equal(start.type, 'text');
  assert.equal(start.growType, 'auto-width');
  assert.equal(start.paragraphs.length, 1);
  assert.equal(start.paragraphs[0].runs.length, 1, 'a plain <text> is one run');
  assert.equal(start.paragraphs[0].runs[0].text, 'Hello');
  assert.equal(start.paragraphs[0].runs[0].fontFamily, 'SUSE');
  assert.equal(start.paragraphs[0].runs[0].fontWeight, 700);
  assert.equal(start.paragraphs[0].runs[0].fontSize, 12);
  sameColor(start.paragraphs[0].runs[0].color, '#123456', 'text colour');
  assert.equal(start.paragraphs[0].align, 'left');
  near(start.x, 10, 1e-9, 'start-anchored x');

  const middle = textOf(make('text-anchor="middle"'));
  assert.equal(middle.paragraphs[0].align, 'center');
  near(middle.x, 10 - middle.w / 2, 1e-9, 'middle-anchored x');

  const end = textOf(make('text-anchor="end"'));
  assert.equal(end.paragraphs[0].align, 'right');
  near(end.x, 10 - end.w, 1e-9, 'end-anchored x');

  // dominant-baseline moves the box top relative to the baseline.
  const base = textOf(make(''));
  const mid = textOf(make('dominant-baseline="middle"'));
  assert.ok(mid.y > base.y, `dominant-baseline:middle sits lower than the alphabetic default (${mid.y} vs ${base.y})`);

  // A positioned tspan is not expressible - the caller keeps the SVG whole.
  assert.equal(
    svgToPenpotDoc('<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><text x="0" y="10"><tspan x="5">a</tspan></text></svg>', svgOpts),
    null,
  );
});

test('svgToPenpotDoc: an embedded <image> becomes media, a remote one becomes a pending entry', () => {
  const embedded = svgToPenpotDoc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><image x="0" y="0" width="50" height="50" href="${PNG_DATA_URL}"/></svg>`,
    svgOpts,
  );
  assert.ok(embedded);
  assert.equal(embedded!.pending.length, 0);
  assert.equal(embedded!.doc.media!.length, 1);
  assert.equal(embedded!.doc.media![0]!.mtype, 'image/png');
  assert.deepEqual([embedded!.doc.media![0]!.width, embedded!.doc.media![0]!.height], [1, 1], 'dimensions sniffed from the PNG header, not the placement box');
  const shape = (embedded!.doc.pages[0]!.shapes[0] as { children: PenpotIrShape[] }).children[0]!;
  assert.equal(shape.type, 'image');
  assert.equal((shape as { media: string }).media, embedded!.doc.media![0]!.id);
  validatePenpotEntries(buildPenpotEntries(embedded!.doc, buildOpts(17)).entries);

  const remote = svgToPenpotDoc(
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><image x="0" y="0" width="50" height="50" href="https://example.invalid/a.png"/></svg>',
    svgOpts,
  );
  assert.ok(remote);
  assert.equal(remote!.doc.media!.length, 0);
  assert.equal(remote!.pending.length, 1);
  assert.equal(remote!.pending[0]!.href, 'https://example.invalid/a.png');
  assert.deepEqual([remote!.pending[0]!.width, remote!.pending[0]!.height], [50, 50]);
  // Unresolved, the shape drops out - the archive never names media it lacks.
  const built = buildPenpotEntries(remote!.doc, buildOpts(19));
  validatePenpotEntries(built.entries);
  assert.ok(built.warnings.some(w => /image shape names unknown media/.test(w)), `warnings: ${built.warnings.join(' | ')}`);
});

test('svgToPenpotDoc: returns null for everything it cannot carry faithfully', () => {
  const wrap = (body: string, extra = '') =>
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"${extra}>${body}</svg>`;
  const cases: Array<[string, string]> = [
    ['filter', wrap('<defs><filter id="f"><feGaussianBlur stdDeviation="2"/></filter></defs><rect x="0" y="0" width="10" height="10" fill="#000000"/>')],
    ['mask', wrap('<defs><mask id="m"><rect x="0" y="0" width="10" height="10" fill="#ffffff"/></mask></defs><rect x="0" y="0" width="10" height="10" fill="#000000"/>')],
    ['clipPath', wrap('<defs><clipPath id="cp"><rect x="0" y="0" width="5" height="5"/></clipPath></defs><rect x="0" y="0" width="10" height="10" fill="#000000"/>')],
    ['style', wrap('<style>rect{fill:red}</style><rect x="0" y="0" width="10" height="10"/>')],
    ['foreignObject', wrap('<foreignObject x="0" y="0" width="10" height="10"></foreignObject>')],
    ['use', wrap('<defs><rect id="s" x="0" y="0" width="4" height="4"/></defs><use href="#s"/>')],
    ['missing paint', wrap('<rect x="0" y="0" width="10" height="10" fill="url(#nope)"/>')],
    ['unreadable transform', wrap('<g transform="translate(abc)"><rect x="0" y="0" width="10" height="10" fill="#000000"/></g>')],
  ];
  for (const [label, svg] of cases) {
    assert.equal(svgToPenpotDoc(svg, svgOpts), null, `${label} must decline so the caller keeps the SVG whole`);
  }
  // Not an SVG at all, and an empty string.
  assert.equal(svgToPenpotDoc('', svgOpts), null);
  assert.equal(svgToPenpotDoc('<div>hi</div>', svgOpts), null);
});

test('svgToPenpotDoc: a hidden element is skipped, not lowered', () => {
  const res = svgToPenpotDoc(
    `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <rect id="seen" x="0" y="0" width="10" height="10" fill="#000000"/>
      <rect id="gone" style="visibility:hidden" x="20" y="0" width="10" height="10" fill="#ff0000"/>
      <rect id="alsogone" display="none" x="40" y="0" width="10" height="10" fill="#00ff00"/>
    </svg>`,
    svgOpts,
  );
  assert.ok(res);
  const kids = (res!.doc.pages[0]!.shapes[0] as { children: PenpotIrShape[] }).children;
  assert.deepEqual(kids.map(k => k.name), ['seen']);
});

// ── 7. tokens.json ───────────────────────────────────────────────────────────

const BRAND_TOKENS = join(ROOT, 'catalog/assets/lolly/tokens/brand.json');
const PENPOT_TOKEN_TYPES = new Set([
  'boolean', 'borderRadius', 'color', 'dimension', 'fontFamilies', 'fontSizes', 'fontWeights', 'letterSpacing',
  'number', 'opacity', 'other', 'rotation', 'shadow', 'sizing', 'spacing', 'string', 'borderWidth', 'textCase',
  'textDecoration', 'typography',
]);

/** Every `{$value,$type}` leaf under a converted set, keyed by its dotted path. */
function tokenLeaves(node: unknown, prefix = ''): Array<[string, Record<string, unknown>]> {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return [];
  const rec = node as Record<string, unknown>;
  if ('$value' in rec) return [[prefix, rec]];
  const out: Array<[string, Record<string, unknown>]> = [];
  for (const [k, v] of Object.entries(rec)) {
    if (k.startsWith('$')) continue;
    out.push(...tokenLeaves(v, prefix ? `${prefix}.${k}` : k));
  }
  return out;
}

test('penpotTokensJson: the shipped brand doc is filtered to what Penpot reads', (t) => {
  if (!existsSync(BRAND_TOKENS)) {
    t.skip(`no ${BRAND_TOKENS} on disk (the catalog view is per profile - run npm run profile:start)`);
    return;
  }
  const brand = JSON.parse(readFileSync(BRAND_TOKENS, 'utf8'));
  const out = penpotTokensJson(brand);
  assert.ok(out, 'the brand doc carries tokens Penpot can read');

  const meta = out!.$metadata as { tokenSetOrder: string[]; activeSets: string[] };
  assert.ok(Array.isArray(meta.tokenSetOrder) && meta.tokenSetOrder.length, '$metadata.tokenSetOrder names the sets');
  for (const name of meta.tokenSetOrder) assert.ok(name in out!, `set ${name} is present`);
  const topSets = Object.keys(out!).filter(k => !k.startsWith('$'));
  assert.deepEqual(topSets.slice().sort(), meta.tokenSetOrder.slice().sort(), 'every top-level key is a named set');
  assert.ok(!('$description' in out!), 'the doc-level $description is not a Penpot key');
  assert.ok(Array.isArray(meta.activeSets) && meta.activeSets.length, '$metadata.activeSets is non-empty so tokens resolve on open');

  const base = out!.base as Record<string, unknown>;
  assert.ok(base, 'the base set survived');
  assert.ok(!('asset' in base), 'base.asset has no Penpot $type and is dropped');
  assert.equal((base.font as any).brand.$type, 'fontFamilies', 'the group-level $type: fontFamily is pushed down and renamed');
  assert.equal((base.font as any).brand.$value, 'SUSE');

  for (const [setName, set] of Object.entries(out!)) {
    if (setName.startsWith('$')) continue;
    for (const [path, leaf] of tokenLeaves(set)) {
      assert.ok(typeof leaf.$type === 'string' && PENPOT_TOKEN_TYPES.has(leaf.$type as string),
        `${setName}.${path} carries a $type Penpot accepts, got ${JSON.stringify(leaf.$type)}`);
      assert.ok('$value' in leaf, `${setName}.${path} carries a $value`);
    }
  }

  // Aliases are kept verbatim - Penpot resolves them itself. The pin is the
  // pass-through, so it reads the alias off the SOURCE doc: which ramp step the
  // starter brand's primary points at is a palette decision that moves (the blank
  // brand's ink-and-paper cut moved it off the green ramp), and pinning that here
  // makes a palette edit look like a filter bug.
  const srcPrimary = (brand as any).light?.color?.semantic?.primary?.$value as string;
  assert.match(srcPrimary, /^\{[\w.-]+\}$/, 'the source light primary is an alias, not a literal colour');
  const light = out!.light as any;
  assert.equal(light.color.semantic.primary.$value, srcPrimary);

  for (const theme of (out!.$themes as Array<Record<string, unknown>>)) {
    assert.equal(typeof theme.description, 'string', `theme ${String(theme.name)} carries the required description`);
    assert.equal(typeof theme.isSource, 'boolean', `theme ${String(theme.name)} carries isSource`);
    for (const [set, state] of Object.entries(theme.selectedTokenSets as Record<string, string>)) {
      assert.ok(state === 'enabled' || state === 'disabled', `theme ${String(theme.name)} set ${set} is ${state}`);
      assert.ok(set in out!, `theme ${String(theme.name)} names the existing set ${set}`);
    }
  }
});

test('penpotTokensJson: the brand doc survives a write → extractPenpotProject → createTokenSet round trip', (t) => {
  if (!existsSync(BRAND_TOKENS)) {
    t.skip(`no ${BRAND_TOKENS} on disk (the catalog view is per profile - run npm run profile:start)`);
    return;
  }
  const brand = JSON.parse(readFileSync(BRAND_TOKENS, 'utf8'));
  const build = buildPenpotEntries({ name: 'Tokens only', pages: [], tokens: brand }, buildOpts(23));
  validatePenpotEntries(build.entries);
  assert.ok(`files/${build.fileId}/tokens.json` in build.entries, 'the tokens landed where Penpot reads them');

  const extracted = extractPenpotProject(build.entries);
  assert.equal(extracted.source, 'penpot-project');
  assert.ok(extracted.doc, `expected a token doc back, warnings: ${extracted.warnings.join(' | ')}`);

  const set = createTokenSet(extracted.doc, { theme: 'light' });
  const primary = set.resolve('color.semantic.primary');
  assert.ok(typeof primary === 'string' && /^#[0-9a-f]{6}$/i.test(primary),
    `color.semantic.primary resolves to a hex, got ${JSON.stringify(primary)}`);
});

test('penpotTokensJson: a single-set DTCG doc is wrapped as `global`, and an unreadable one is null', () => {
  const single = penpotTokensJson({
    color: { $type: 'color', brand: { $value: '#30ba78', $description: 'Jungle' } },
    space: { sm: { $value: '4px', $type: 'dimension' } },
  });
  assert.ok(single);
  assert.deepEqual(Object.keys(single!).filter(k => !k.startsWith('$')), ['global']);
  const g = single!.global as any;
  assert.equal(g.color.brand.$type, 'color');
  assert.equal(g.color.brand.$description, 'Jungle');
  assert.equal(g.space.sm.$type, 'dimension');
  assert.deepEqual((single!.$metadata as any).tokenSetOrder, ['global']);
  assert.ok(!('$themes' in single!), 'no themes were authored, so none are invented');

  // Nothing Penpot can read.
  assert.equal(penpotTokensJson({ base: { logo: { primary: { $value: 'lolly/logo/primary', $type: 'asset' } } } }), null);
  assert.equal(penpotTokensJson({}), null);
  assert.equal(penpotTokensJson(null), null);
  assert.equal(penpotTokensJson('nope'), null);

  // A doc whose tokens are all unreadable is a warning on the build, not a broken archive.
  const build = buildPenpotEntries({ name: 'No tokens', pages: [], tokens: { a: { b: { $value: 1, $type: 'asset' } } } }, buildOpts(29));
  validatePenpotEntries(build.entries);
  assert.ok(!Object.keys(build.entries).some(p => p.endsWith('/tokens.json')));
  assert.ok(build.warnings.some(w => /tokens\.json omitted/.test(w)), `warnings: ${build.warnings.join(' | ')}`);
});

test('penpotTokensJson: a synthetic multi-set doc round-trips through the archive', () => {
  const doc = {
    $metadata: { tokenSetOrder: ['base', 'light'] },
    $themes: [{ name: 'light', selectedTokenSets: { base: 'enabled', light: 'enabled' } }],
    base: { color: { $type: 'color', ink: { $value: '#0c322c' } } },
    light: { color: { $type: 'color', semantic: { primary: { $value: '{color.ink}' } } } },
  };
  const build = buildPenpotEntries({ name: 'Synthetic', pages: [], tokens: doc }, buildOpts(31));
  validatePenpotEntries(build.entries);
  const extracted = extractPenpotProject(build.entries);
  assert.equal(extracted.source, 'penpot-project');
  const set = createTokenSet(extracted.doc, { theme: 'light' });
  assert.equal(set.resolve('color.semantic.primary'), '#0c322c');
});

// ── 8. image sniffing, base64 and data URLs ──────────────────────────────────

test('imageDimensions: reads PNG, GIF, JPEG, the three WebP flavours and SVG', () => {
  assert.deepEqual(imageDimensions(PNG_1x1), { w: 1, h: 1 });

  const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x20, 0x00, 0x10, 0x00, 0, 0]);
  assert.deepEqual(imageDimensions(gif), { w: 32, h: 16 });

  // SOI, an APP0/JFIF segment, then SOF0 - the reader must walk past the segment.
  const jpeg = new Uint8Array([
    0xff, 0xd8,
    0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
    0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0x28, 0x00, 0x3c, 0x03, 0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
  ]);
  assert.deepEqual(imageDimensions(jpeg), { w: 60, h: 40 });

  const riff = (tag: string, tail: number[]): Uint8Array => {
    const head = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
    return new Uint8Array([...head, ...[...tag].map(c => c.charCodeAt(0)), ...tail]);
  };
  // VP8X: chunk size, flags + reserved, then (w-1) and (h-1) as 24-bit LE.
  assert.deepEqual(imageDimensions(riff('VP8X', [10, 0, 0, 0, 0, 0, 0, 0, 63, 0, 0, 31, 0, 0])), { w: 64, h: 32 });
  // VP8L: signature byte then the packed 14-bit dimensions.
  assert.deepEqual(imageDimensions(riff('VP8L', [10, 0, 0, 0, 0x2f, 63, 0xc0, 7, 0, 0, 0, 0, 0, 0])), { w: 64, h: 32 });
  // VP8 (lossy): the frame header's 14-bit width/height.
  assert.deepEqual(imageDimensions(riff('VP8 ', [10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 100, 0, 50, 0])), { w: 100, h: 50 });

  const enc = (s: string) => new TextEncoder().encode(s);
  assert.deepEqual(imageDimensions(enc('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="60"></svg>')), { w: 120, h: 60 });
  assert.deepEqual(imageDimensions(enc('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150"></svg>')), { w: 300, h: 150 });
  assert.deepEqual(imageDimensions(enc('<svg width="10mm" height="5mm"></svg>'), 'image/svg+xml'), { w: 38, h: 19 });

  assert.equal(imageDimensions(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])), null, 'unreadable bytes yield null, so the caller measures');
  assert.equal(imageDimensions(new Uint8Array(0)), null);
  assert.equal(imageDimensions(enc('not markup'), 'image/svg+xml'), null);
});

test('decodeBase64 / decodeDataUrl: byte-identical to Buffer', () => {
  for (const s of ['', 'a', 'ab', 'abc', 'hello world', 'Lolly → Penpot', ' ÿ binary-ish']) {
    const b64 = Buffer.from(s, 'utf8').toString('base64');
    assert.deepEqual(Array.from(decodeBase64(b64)), Array.from(Buffer.from(b64, 'base64')), `round trip of ${JSON.stringify(s)}`);
  }
  assert.deepEqual(Array.from(decodeBase64(Buffer.from(PNG_1x1).toString('base64'))), Array.from(PNG_1x1));
  // base64url, and whitespace inside the payload.
  const url = Buffer.from([0xfb, 0xef, 0xbe]).toString('base64').replace(/\+/g, '-').replace(/\//g, '_');
  assert.deepEqual(Array.from(decodeBase64(url)), [0xfb, 0xef, 0xbe]);
  assert.deepEqual(Array.from(decodeBase64('aGVs\nbG8=')), Array.from(Buffer.from('hello')));

  const png = decodeDataUrl(PNG_DATA_URL);
  assert.ok(png);
  assert.equal(png!.mtype, 'image/png');
  assert.deepEqual(Array.from(png!.bytes), Array.from(PNG_1x1));

  const plain = decodeDataUrl('data:text/plain,hello%20world');
  assert.ok(plain);
  assert.equal(plain!.mtype, 'text/plain');
  assert.equal(new TextDecoder().decode(plain!.bytes), 'hello world');

  assert.equal(decodeDataUrl('https://example.invalid/a.png'), null);
  assert.equal(decodeDataUrl('not a url'), null);
});

// ── 9. the import stream, the one-picture doc, colours and the URL ───────────

test('parsePenpotImportStream: the observed progress/end transcript yields the new file ids', () => {
  const body = [
    'event: progress',
    'data: {"~:section":"~:manifest"}',
    '',
    'event: progress',
    'data: {"~:section":"~:file"}',
    '',
    'event: progress',
    'data: {"~:section":"~:media"}',
    '',
    'event: end',
    'data: ["~uc828d3cf-7d4e-8145-8008-93ed3cdff02d"]',
    '',
  ].join('\n');
  const res = parsePenpotImportStream(body);
  assert.deepEqual(res.fileIds, ['c828d3cf-7d4e-8145-8008-93ed3cdff02d']);
  assert.deepEqual(res.sections, ['manifest', 'file', 'media']);
  assert.equal(res.error, null);
});

test('parsePenpotImportStream: an error event surfaces Penpot\'s own hint, and an empty body is an error', () => {
  const body = [
    'event: progress',
    'data: {"~:section":"~:manifest"}',
    '',
    'event: error',
    'data: {"~:type":"~:validation","~:code":"~:inconsistent-penpot-file","~:hint":"the penpot file seems corrupt, missing underlying zip entry","~:path":"objects/x.png"}',
    '',
  ].join('\n');
  const res = parsePenpotImportStream(body);
  assert.equal(res.error, 'the penpot file seems corrupt, missing underlying zip entry');
  assert.deepEqual(res.fileIds, []);

  const empty = parsePenpotImportStream('');
  assert.deepEqual(empty.fileIds, []);
  assert.equal(empty.error, 'Penpot did not confirm the import');
  assert.deepEqual(empty.sections, []);
});

test('imageToPenpotDoc: one board, one picture, and an archive that validates', () => {
  const doc = imageToPenpotDoc({ ...PNG_MEDIA, width: 320, height: 200 }, { name: 'A picture' });
  assert.equal(doc.pages.length, 1);
  const board = doc.pages[0]!.shapes[0] as { type: string; w: number; h: number; children: PenpotIrShape[] };
  assert.equal(doc.pages[0]!.shapes.length, 1);
  assert.equal(board.type, 'board');
  assert.deepEqual([board.w, board.h], [320, 200]);
  assert.equal(board.children.length, 1);
  assert.equal(board.children[0]!.type, 'image');

  const build = buildPenpotEntries(doc, buildOpts(37));
  const v = validatePenpotEntries(build.entries);
  assert.equal(build.mediaCount, 1);
  assert.equal(build.shapeCount, 2);
  const picture = v.shapes.find(s => s.type === 'rect')!;
  assert.equal((picture.fills as Array<Record<string, any>>)[0]!.fillImage.id, MEDIA_ID);
});

test('penpotWorkspaceUrl: the workspace deep link', () => {
  assert.equal(
    penpotWorkspaceUrl('t-1', 'f-2'),
    'https://design.penpot.app/#/workspace?team-id=t-1&file-id=f-2',
  );
  assert.equal(
    penpotWorkspaceUrl('t-1', 'f-2', 'p-3'),
    'https://design.penpot.app/#/workspace?team-id=t-1&file-id=f-2&page-id=p-3',
  );
  assert.equal(
    penpotWorkspaceUrl('t 1', 'f/2', undefined, 'https://penpot.example.org'),
    'https://penpot.example.org/#/workspace?team-id=t+1&file-id=f%2F2',
  );
});

test('parsePenpotColor: the CSS forms a brand or an SVG can hand it', () => {
  assert.deepEqual(parsePenpotColor('#abc'), { hex: '#aabbcc', alpha: 1 });
  assert.deepEqual(parsePenpotColor('#AABBCC'), { hex: '#aabbcc', alpha: 1 });
  assert.deepEqual(parsePenpotColor('#aabbccff'), { hex: '#aabbcc', alpha: 1 });
  near(parsePenpotColor('#abcd')!.alpha, 0xdd / 255, 1e-9, '#rgba alpha');
  assert.equal(parsePenpotColor('#abcd')!.hex, '#aabbcc');
  near(parsePenpotColor('#aabbcc80')!.alpha, 0x80 / 255, 1e-9, '#rrggbbaa alpha');
  assert.deepEqual(parsePenpotColor('rgb(255, 0, 0)'), { hex: '#ff0000', alpha: 1 });
  near(parsePenpotColor('rgba(0, 255, 0, 0.5)')!.alpha, 0x80 / 255, 0.01, 'rgba alpha');
  assert.equal(parsePenpotColor('rgba(0, 255, 0, 0.5)')!.hex, '#00ff00');
  assert.deepEqual(parsePenpotColor('hsl(120, 100%, 50%)'), { hex: '#00ff00', alpha: 1 });
  assert.deepEqual(parsePenpotColor('red'), { hex: '#ff0000', alpha: 1 });
  assert.deepEqual(parsePenpotColor('  REBECCAPURPLE '), { hex: '#663399', alpha: 1 });
  assert.deepEqual(parsePenpotColor('var(--brand, #fff)'), { hex: '#ffffff', alpha: 1 });

  assert.equal(parsePenpotColor('transparent'), null);
  assert.equal(parsePenpotColor('none'), null);
  assert.equal(parsePenpotColor('currentColor'), null);
  assert.equal(parsePenpotColor('{color.semantic.primary}'), null, 'an unresolved alias is not a colour');
  assert.equal(parsePenpotColor('var(--brand-primary)'), null, 'a var with no fallback is for the caller to resolve');
  assert.equal(parsePenpotColor(''), null);
  assert.equal(parsePenpotColor(null), null);
  assert.equal(parsePenpotColor(undefined), null);
});


// ── review fixes (plans/178 review workflow, 2026-09-02) ───────────────────────
import {
  penpotUuid as _pUuid, seededPenpotUuid as _seeded, buildPenpotEntries as _build, svgToPenpotDoc as _svgDoc,
  boxesToPenpotDoc as _boxesDoc, designTextRuns as _runs, parsePenpotColor as _color,
} from '../engine/src/penpot-file.ts';

const _shapesOf = (entries: Record<string, Uint8Array | string>) =>
  Object.entries(entries).filter(([k]) => /pages\/[^/]+\/[^/]+\.json$/.test(k)).map(([, v]) => JSON.parse(String(v)) as Record<string, any>);
const _grad = (doc: ReturnType<typeof _svgDoc>, name: string) => {
  const board = doc!.doc.pages[0]!.shapes[0]! as any;
  const sh = board.children.find((c: any) => c.name === name);
  return sh?.fills?.[0]?.gradient;
};

test('review #1: a radial gradient width follows Penpot\'s normalized model - obb r=0.5 is 1, a user-space circle is h/w', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200"><defs>
    <radialGradient id="a" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
    <radialGradient id="b" gradientUnits="userSpaceOnUse" cx="400" cy="100" r="100"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></radialGradient>
  </defs><rect id="obb" width="800" height="200" fill="url(#a)"/><rect id="usr" width="800" height="200" fill="url(#b)"/></svg>`;
  const r = _svgDoc(svg, { name: 't' });
  assert.ok(r);
  const a = _grad(r, 'obb'), b = _grad(r, 'usr');
  assert.equal(a.width, 1, 'obb r maps 1:1 onto Penpot\'s unit radius');
  assert.ok(Math.abs(a.endY - a.startY - 0.5) < 1e-6);
  assert.ok(Math.abs(b.width - 200 / 800) < 1e-6, 'a true circle on a 4:1 box is h/w');
  assert.ok(Math.abs(b.endY - b.startY - 0.5) < 1e-6, 'r=100 on a 200 tall box is 0.5 of the height');
});

test('review #5: gradientTransform is applied to a linear gradient and to a scaled radial one; rotation on a radial bails', () => {
  const lin = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0" gradientTransform="rotate(90 0.5 0.5)"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient>
  </defs><rect id="r" width="100" height="100" fill="url(#g)"/></svg>`;
  const rl = _svgDoc(lin, { name: 't' });
  assert.ok(rl, 'a rotated linear gradient is exact');
  const g = _grad(rl, 'r');
  // rotate(90 .5 .5) turns the horizontal line into a vertical one at x=1: (0,0)→(1,0), (1,0)→(1,1).
  assert.ok(Math.abs(g.startX - g.endX) < 1e-6 && Math.abs(g.startY - 0) < 1e-6 && Math.abs(g.endY - 1) < 1e-6, JSON.stringify(g));
  const radScale = lin.replace(/<linearGradient[^>]*>/, '<radialGradient id="g" cx=".5" cy=".5" r=".5" gradientTransform="matrix(1 0 0 0.5 0 0.25)">').replace('</linearGradient>', '</radialGradient>');
  const rr = _svgDoc(radScale, { name: 't' });
  assert.ok(rr, 'an axis scale on a radial gradient is expressible');
  const gr = _grad(rr, 'r');
  assert.ok(Math.abs(gr.endY - gr.startY - 0.25) < 1e-6, 'the vertical radius is scaled');
  assert.ok(Math.abs(gr.width - 2) < 1e-6, 'the horizontal radius kept its size, so the ratio doubles');
  const radRot = lin.replace(/<linearGradient[^>]*>/, '<radialGradient id="g" gradientTransform="rotate(30)">').replace('</linearGradient>', '</radialGradient>');
  assert.equal(_svgDoc(radRot, { name: 't' }), null, 'a rotated radial gradient keeps the SVG whole');
  const bad = lin.replace('rotate(90 0.5 0.5)', 'rotate(nope)');
  assert.equal(_svgDoc(bad, { name: 't' }), null, 'an unreadable gradientTransform is a bail, not identity');
});

test('review #4: percentages on a userSpaceOnUse gradient are fractions of the viewBox', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 100" width="400" height="100"><defs>
    <linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0%" y1="0" x2="100%" y2="0"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#00f"/></linearGradient>
  </defs><rect id="r" x="0" y="0" width="200" height="100" fill="url(#g)"/></svg>`;
  const g = _grad(_svgDoc(svg, { name: 't' }), 'r');
  assert.ok(Math.abs(g.startX - 0) < 1e-6 && Math.abs(g.endX - 2) < 1e-6, `x2=100% spans the 400 wide viewport, twice this 200 wide rect: ${JSON.stringify(g)}`);
});

test('review #2: a document nested past the walk ceiling keeps the SVG whole instead of blowing the stack', () => {
  const depth = 20000;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10">${'<g>'.repeat(depth)}<rect width="1" height="1"/>${'</g>'.repeat(depth)}</svg>`;
  const notes: string[] = [];
  assert.equal(_svgDoc(svg, { name: 't', notes }), null);
  assert.ok(notes.some((n) => /nesting ceiling/.test(n)), notes.join('; '));
});

test('review #3: a colour named like an Object prototype member is not a colour', () => {
  for (const v of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) assert.equal(_color(v), null, v);
  const doc = _boxesDoc([{ id: 'b', kind: 'box', x: 0, y: 0, w: 10, h: 10, bg: 'constructor' }], { name: 't', canvas: { w: 10, h: 10 } });
  const rect = (doc.pages[0]!.shapes[0] as any).children[0];
  assert.deepEqual(rect.fills, [], 'no fill rather than a poisoned one');
});

test('review #10: a resolver wins over the literal fallback of var(--x, #fallback) and resolves token aliases', () => {
  const boxes = [
    { id: 'a', kind: 'box', x: 0, y: 0, w: 10, h: 10, bg: 'var(--brand-surface, #ffffff)' },
    { id: 'b', kind: 'box', x: 0, y: 0, w: 10, h: 10, bg: '{color.semantic.primary}' },
  ];
  const doc = _boxesDoc(boxes, { name: 't', canvas: { w: 10, h: 10 }, resolveColor: (css) => (/^var\(/.test(css) ? 'rgb(48, 186, 120)' : css.startsWith('{') ? '#123456' : null) });
  const [a, b] = (doc.pages[0]!.shapes[0] as any).children;
  assert.equal(a.fills[0].color, '#30ba78', 'the live brand colour, not the stale literal');
  assert.equal(b.fills[0].color, '#123456');
  const plain = _boxesDoc(boxes.slice(0, 1), { name: 't', canvas: { w: 10, h: 10 } });
  assert.equal((plain.pages[0]!.shapes[0] as any).children[0].fills[0].color, '#ffffff', 'without a resolver the literal fallback still paints');
});

test('review #13: the u / s decoration tokens reach the run, and an invalid colour token leaves the literal', () => {
  const runs = _runs('{u|under} {s|struck} {#zz|bad}');
  assert.deepEqual(runs.slice(0, 4).map((r) => [r.text, r.decoration ?? null]), [['under', 'underline'], [' ', null], ['struck', 'line-through'], [' ', null]]);
  // An invalid colour token keeps the literal - the artboard's inlineMd leaves `{#zz|bad}` in the text.
  assert.equal(runs.slice(4).map((r) => r.text).join(''), '{#zz|bad}');
  assert.ok(runs.slice(4).every((r) => !r.color && !r.decoration));
  const doc = _boxesDoc([{ id: 't', kind: 'text', x: 0, y: 0, w: 100, h: 20, text: '{u|hi}', fg: '#000000', fontSize: 10 }], { name: 't', canvas: { w: 100, h: 20 } });
  const text = (doc.pages[0]!.shapes[0] as any).children[0];
  assert.equal(text.paragraphs[0].runs[0].decoration, 'underline');
  const entries = _build(doc, { uuid: _seeded(3), now: () => 'X' }).entries;
  const span = _shapesOf(entries).find((s) => s.type === 'text')!.content.children[0].children[0].children[0];
  assert.equal(span.textDecoration, 'underline');
});

test('review #6: a build is a pure function of (doc, uuid, now)', () => {
  const doc = _boxesDoc([{ id: 't', kind: 'text', x: 0, y: 0, w: 100, h: 40, text: 'one\ntwo', fg: '#000000', fontSize: 10 }], { name: 't', canvas: { w: 100, h: 40 } });
  const a = _build(doc, { uuid: _seeded(9), now: () => 'X' }).entries;
  const b = _build(doc, { uuid: _seeded(9), now: () => 'X' }).entries;
  assert.deepEqual(Object.keys(a).sort(), Object.keys(b).sort());
  for (const k of Object.keys(a)) assert.equal(String(a[k]), String(b[k]), k);
});

test('review #7: a frame\'s authored border becomes an inner stroke on the board', () => {
  const doc = _boxesDoc([{ id: 'f', kind: 'frame', x: 0, y: 0, w: 100, h: 100, bg: '#ffffff', stroke: '#ff0000', strokeW: 3 }], { name: 't', canvas: { w: 100, h: 100 } });
  const board = doc.pages[0]!.shapes[0] as any;
  assert.equal(board.type, 'board');
  assert.deepEqual(board.strokes.map((s: any) => [s.color, s.width, s.alignment]), [['#ff0000', 3, 'inner']]);
});

test('review #8: a curved path\'s box is the curve\'s own bounds, not its control hull', () => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><path id="p" d="M0,0 C0,200 100,200 100,0" fill="#000"/></svg>`;
  const board = _svgDoc(svg, { name: 't' })!.doc.pages[0]!.shapes[0] as any;
  const p = board.children.find((c: any) => c.name === 'p');
  assert.ok(p.h > 149 && p.h < 151, `the cubic tops out at 150, not the 200 of its control points: ${p.h}`);
});

test('review #9: tokenSetOrder and set names cannot reach the prototype chain', () => {
  const out = penpotTokensJson({
    $metadata: { tokenSetOrder: ['toString', 'base'] },
    $themes: [{ name: 't', selectedTokenSets: { base: 'enabled', hasOwnProperty: 'enabled' } }],
    base: { color: { $type: 'color', a: { $value: '#000000' } } },
    __proto__: { color: { $type: 'color', b: { $value: '#ffffff' } } },
  } as any)!;
  assert.deepEqual((out.$metadata as any).tokenSetOrder, ['base']);
  assert.deepEqual(Object.keys(out).filter((k) => !k.startsWith('$')), ['base']);
  assert.deepEqual((out.$themes as any)[0].selectedTokenSets, { base: 'enabled' });
});
