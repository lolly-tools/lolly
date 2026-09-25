#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Build the synthetic rebrand fixtures of plan 274 section 9 and the three plan 275
 * adds (formatting.pptx for section 7, structures.pptx for section 3, vector.pptx
 * for decision 32), plus the labels sidecar that states, per authored object, what
 * a correct reading of it is.
 *
 * Determinism is the whole point: `tests/rebrand-fixtures.test.ts` rebuilds
 * every fixture into a scratch directory and compares the bytes with the
 * committed ones, so nothing here may read the clock, the locale or the machine.
 * The zip entries are written in sorted part order at a fixed stored level with
 * one fixed modification time, the pptx writer is given a fixed `now`, and every
 * picture comes out of a seeded generator.
 *
 * Where the engine writer (engine/src/pptx.ts) can express a feature it writes
 * it, so the fixtures stay close to what Lolly itself emits. The four things it
 * has no model for are hand-authored OOXML appended to the parts it produced:
 * a text box on the slide master, a `p:grpSp` with child-offset scaling, native
 * charts, and an `mc:AlternateContent` pair whose fallback is a real picture.
 *
 * Fidelity says what can be SHOWN, not what data survives. A native chart with no
 * fallback picture is `unavailable` because nothing in this path draws one and a
 * placeholder is never described as a picture of the source (plan 274 section 9),
 * while its cached categories, series names and values still travel on the source
 * object's own `chartData` field, which the contract keeps apart from fidelity.
 * `unavailable` therefore never means "discard the numbers", and the fixture test
 * pins that the reader hands those numbers back.
 *
 * Usage: node scripts/build-rebrand-fixtures.ts [--out=<dir>]
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { zipSync } from 'fflate';

import { zlibCompress } from '../engine/src/deflate.ts';
import { emitEmf } from '../engine/src/emf.ts';
import { buildPptxParts, EMU_PER_PX, type PptxPara, type PptxSlide, type PptxLayout, type PptxTheme } from '../engine/src/pptx.ts';
import { packPng } from '../engine/src/png.ts';
import {
  FIDELITY_STATES,
  LAYOUT_MATCH_BANDS,
  OBJECT_CLASSES,
  REBRAND_CONTRACT_VERSION,
  SOURCE_OBJECT_KINDS,
  SOURCE_ORIGINS,
  STRUCTURE_ID_PATTERN,
  type ArchetypeRoleV1,
  type LayoutMatchBandV1,
  type SourceParaV1,
  type SourceRunV1,
  type StructureIdV1,
} from '../packages/core/src/rebrand-v1.ts';
import type {
  FixtureColorLabelV1,
  FixtureObjectLabelV1,
  FixtureSlideLabelV1,
  RebrandFixtureLabelsV1,
} from '../tests/helpers/rebrand-fixtures.ts';

// ─── fixed inputs ────────────────────────────────────────────────────────────

/** The one modification time every zip entry carries. Local-time text on purpose:
 *  the zip clock field is written from local getters, so a string with no zone
 *  gives the same bytes in every zone. */
const ZIP_MTIME = '2026-01-01T00:00:00';
/** Stored, not deflated: the bytes then depend on the content alone, not on the
 *  compressor version a future install pulls in. The one compressed payload in the
 *  set, the pdf's page images, goes through the in-repo `zlibCompress` for the same
 *  reason, so no fixture byte comes from a versioned dependency. */
const ZIP_LEVEL = 0;
/** The timestamp the pptx writer stamps into docProps. */
const NOW = '2026-01-01T00:00:00Z';
/** Deck geometry in reference px at 96 dpi (16:9). */
const DECK_W = 1280;
const DECK_H = 720;
/** The one hex plan 274 asks to see in three roles. */
const PALETTE_HEX = '#1F4E79';

const px = (v: number): number => Math.round(v * EMU_PER_PX);

type Parts = Record<string, string | Uint8Array>;
type AuthoredSpec = Omit<FixtureObjectLabelV1, 'id' | 'name'>;

// ─── seeded pictures ─────────────────────────────────────────────────────────

/** A seeded 32-bit generator, so every picture is the same on every machine. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rgba(w: number, h: number, paint: (x: number, y: number) => [number, number, number, number]): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = paint(x, y);
      const i = (y * w + x) * 4;
      out[i] = r; out[i + 1] = g; out[i + 2] = b; out[i + 3] = a;
    }
  }
  return out;
}

/** A small flat mark: two bars and a dot, the kind of pasted logo a deck carries. */
function logoPng(): Uint8Array {
  const w = 96, h = 24;
  return packPng(rgba(w, h, (x, y) => {
    const inBar = y >= 6 && y < 18 && ((x >= 4 && x < 28) || (x >= 34 && x < 52));
    const inDot = (x - 70) * (x - 70) + (y - 12) * (y - 12) < 49;
    if (inBar) return [31, 78, 121, 255];
    if (inDot) return [214, 90, 40, 255];
    return [0, 0, 0, 0];
  }), { width: w, height: h });
}

/** A second mark, so a deck can carry a partner's alongside its own. */
function partnerMarkPng(): Uint8Array {
  const w = 64, h = 64;
  return packPng(rgba(w, h, (x, y) => {
    const ring = Math.abs(Math.hypot(x - 32, y - 32) - 22) < 5;
    const bar = y >= 29 && y < 35 && x >= 14 && x < 50;
    return ring || bar ? [16, 110, 96, 255] : [0, 0, 0, 0];
  }), { width: w, height: h });
}

/** A photo-like picture: a smooth gradient with grain, so it reads as a photograph
 *  to an edge or colour-discreteness signal rather than as flat graphics. */
function photoPng(): Uint8Array {
  const w = 240, h = 135;
  const noise = rng(20260923);
  return packPng(rgba(w, h, (x, y) => {
    const u = x / (w - 1);
    const v = y / (h - 1);
    const grain = (noise() - 0.5) * 26;
    const r = 40 + 150 * u + 30 * v + grain;
    const g = 90 + 60 * v + 40 * (1 - u) + grain;
    const b = 150 - 70 * u + 60 * v + grain;
    const clamp = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
    return [clamp(r), clamp(g), clamp(b), 255];
  }), { width: w, height: h, channels: 4 });
}

/** The picture a file carries as the fallback for an object a reader cannot model:
 *  five bars, which is what the chart beside it plots. */
function chartFallbackPng(): Uint8Array {
  const w = 240, h = 150;
  const bars = [0.4, 0.7, 0.55, 0.9, 0.65];
  return packPng(rgba(w, h, (x, y) => {
    const slot = Math.floor(x / 48);
    const bar = bars[slot] ?? 0;
    const top = Math.round(h - bar * (h - 20));
    if (x % 48 >= 8 && x % 48 < 40 && y >= top && y < h - 10) return [31, 78, 121, 255];
    if (y >= h - 10) return [120, 120, 120, 255];
    return [248, 248, 250, 255];
  }), { width: w, height: h });
}

// ─── a tiny bitmap face, for the flattened pdf ───────────────────────────────

/** Five by seven glyphs, enough for the three page titles below. A page of the
 *  flattened fixture has to LOOK like a rendered slide, and a real font file
 *  would make the bytes depend on a shaper this script must not need. */
const GLYPHS: Record<string, string[]> = {
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
};

/** Paint one uppercase line into an RGB buffer at a whole-pixel scale. */
function drawText(buf: Uint8Array, w: number, h: number, text: string, x0: number, y0: number, scale: number, ink: [number, number, number]): void {
  let cursor = x0;
  for (const ch of text) {
    const glyph = GLYPHS[ch];
    if (!glyph) throw new Error(`build-rebrand-fixtures: no glyph for ${JSON.stringify(ch)}; add one or change the title`);
    for (let gy = 0; gy < glyph.length; gy++) {
      const row = glyph[gy] ?? '';
      for (let gx = 0; gx < row.length; gx++) {
        if (row[gx] !== '#') continue;
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px0 = cursor + gx * scale + sx;
            const py0 = y0 + gy * scale + sy;
            // Past the right edge a row would wrap into the next scanline, and past
            // the buffer end the write is a silent no-op. Both are worth a failure.
            if (px0 < 0 || px0 >= w || py0 < 0 || py0 >= h) {
              throw new Error(`build-rebrand-fixtures: ${JSON.stringify(text)} runs past the ${w} by ${h} page; shorten it or move it left`);
            }
            const i = (py0 * w + px0) * 3;
            buf[i] = ink[0]; buf[i + 1] = ink[1]; buf[i + 2] = ink[2];
          }
        }
      }
    }
    cursor += 6 * scale;
  }
}

/** One page of the flattened fixture as raw RGB: a band, a title, two text blocks. */
function flattenedPageRgb(title: string, w: number, h: number): Uint8Array {
  const buf = new Uint8Array(w * h * 3).fill(252);
  const put = (x: number, y: number, c: [number, number, number]): void => {
    const i = (y * w + x) * 3;
    buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
  };
  for (let y = 0; y < 96; y++) for (let x = 0; x < w; x++) put(x, y, [31, 78, 121]);
  drawText(buf, w, h, title, 60, 26, 6, [255, 255, 255]);
  for (let block = 0; block < 2; block++) {
    const top = 180 + block * 150;
    for (let y = top; y < top + 96; y++) for (let x = 60; x < w - 60; x++) put(x, y, [232, 234, 238]);
  }
  return buf;
}

// ─── a minimal pdf writer ────────────────────────────────────────────────────

/**
 * Three pages, each one full-page image and nothing else, which is what a deck
 * printed to pdf by a tool that flattens looks like. Written here rather than
 * with a pdf library because the fixture's bytes have to be reproducible: a
 * library that stamps a creation date or an id would defeat the rebuild check.
 */
function flattenedPdf(pages: Array<{ title: string; width: number; height: number }>): Uint8Array {
  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (bytes: Uint8Array): void => { chunks.push(bytes); length += bytes.length; };
  const text = (s: string): void => push(enc.encode(s));
  const beginObject = (n: number): void => { offsets[n] = length; text(`${n} 0 obj\n`); };
  const endObject = (): void => text('endobj\n');

  // 1 catalog, 2 pages, then per page: page, content, image.
  const pageObjectNumbers = pages.map((_, i) => 3 + i * 3);
  // `%PDF-1.4` then the four high bytes that mark the file as binary. Written as raw
  // bytes: a TextEncoder would turn each one into its two-byte UTF-8 form instead.
  push(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  beginObject(1);
  text('<< /Type /Catalog /Pages 2 0 R >>\n');
  endObject();

  beginObject(2);
  text(`<< /Type /Pages /Count ${pages.length} /Kids [${pageObjectNumbers.map((n) => `${n} 0 R`).join(' ')}] >>\n`);
  endObject();

  pages.forEach((page, i) => {
    const pageNo = pageObjectNumbers[i] ?? 0;
    const contentNo = pageNo + 1;
    const imageNo = pageNo + 2;
    const wPt = Math.round((page.width / 96) * 72);
    const hPt = Math.round((page.height / 96) * 72);

    beginObject(pageNo);
    text(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt} ${hPt}] ` +
      `/Resources << /XObject << /Im0 ${imageNo} 0 R >> >> /Contents ${contentNo} 0 R >>\n`,
    );
    endObject();

    const stream = `q ${wPt} 0 0 ${hPt} 0 0 cm /Im0 Do Q\n`;
    beginObject(contentNo);
    text(`<< /Length ${stream.length} >>\nstream\n${stream}endstream\n`);
    endObject();

    const raw = flattenedPageRgb(page.title, page.width, page.height);
    // The in-repo compressor, so the committed bytes never move under a dependency bump.
    const deflated = zlibCompress(raw);
    beginObject(imageNo);
    text(
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${deflated.length} >>\nstream\n`,
    );
    push(deflated);
    text('\nendstream\n');
    endObject();
  });

  const total = 2 + pages.length * 3;
  const xref = length;
  text(`xref\n0 ${total + 1}\n0000000000 65535 f \n`);
  for (let n = 1; n <= total; n++) text(`${String(offsets[n] ?? 0).padStart(10, '0')} 00000 n \n`);
  text(`trailer\n<< /Size ${total + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);

  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) { out.set(chunk, at); at += chunk.length; }
  return out;
}

// ─── part surgery ────────────────────────────────────────────────────────────

function partText(parts: Parts, name: string): string {
  const value = parts[name];
  if (typeof value !== 'string') throw new Error(`build-rebrand-fixtures: ${name} is not a text part`);
  return value;
}

/** Append hand-authored shapes to a part's shape tree, after what is already there. */
function appendToSpTree(parts: Parts, name: string, xml: string): void {
  const before = partText(parts, name);
  if (!before.includes('</p:spTree>')) throw new Error(`build-rebrand-fixtures: ${name} has no shape tree`);
  parts[name] = before.replace('</p:spTree>', `${xml}</p:spTree>`);
}

/** Give a slide its own ground. The writer models a layout background, not a slide one. */
function setSlideBackground(parts: Parts, name: string, hex: string): void {
  const before = partText(parts, name);
  const bg = `<p:bg><p:bgPr><a:solidFill><a:srgbClr val="${hex.replace('#', '').toUpperCase()}"/></a:solidFill><a:effectLst/></p:bgPr></p:bg>`;
  parts[name] = before.replace('<p:cSld>', `<p:cSld>${bg}`);
}

const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

/** Add relationships to a part's rels, past every id already in it. */
function addRels(parts: Parts, name: string, rels: Array<{ type: string; target: string; external?: boolean }>): string[] {
  const before = partText(parts, name);
  let next = 1;
  for (const match of before.matchAll(/Id="rId(\d+)"/g)) next = Math.max(next, Number(match[1]) + 1);
  const ids: string[] = [];
  let added = '';
  for (const rel of rels) {
    const id = `rId${next++}`;
    ids.push(id);
    added += `<Relationship Id="${id}" Type="${REL_NS}/${rel.type}" Target="${rel.target}"${rel.external ? ' TargetMode="External"' : ''}/>`;
  }
  parts[name] = before.replace('</Relationships>', `${added}</Relationships>`);
  return ids;
}

function addContentTypeOverride(parts: Parts, partName: string, contentType: string): void {
  const before = partText(parts, '[Content_Types].xml');
  parts['[Content_Types].xml'] = before.replace('</Types>', `<Override PartName="${partName}" ContentType="${contentType}"/></Types>`);
}

const CHART_CT = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';
const CHART_NS = 'http://schemas.openxmlformats.org/drawingml/2006/chart';

/** A small native chart part: a bar chart with cached categories and values, each
 *  series in a literal colour, and no embedded workbook. */
function chartXml(categories: string[], series: Array<{ name: string; hex: string; values: number[] }>): string {
  const cats = (values: string[]): string =>
    `<c:cat><c:strRef><c:f>Sheet1!$A$2:$A$${values.length + 1}</c:f><c:strCache><c:ptCount val="${values.length}"/>` +
    values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('') +
    '</c:strCache></c:strRef></c:cat>';
  const vals = (values: number[], col: number): string =>
    `<c:val><c:numRef><c:f>Sheet1!$${String.fromCharCode(66 + col)}$2:$${String.fromCharCode(66 + col)}$${values.length + 1}</c:f><c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${values.length}"/>` +
    values.map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`).join('') +
    '</c:numCache></c:numRef></c:val>';
  const ser = series.map((s, i) =>
    `<c:ser><c:idx val="${i}"/><c:order val="${i}"/>` +
    `<c:tx><c:strRef><c:f>Sheet1!$${String.fromCharCode(66 + i)}$1</c:f><c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${s.name}</c:v></c:pt></c:strCache></c:strRef></c:tx>` +
    `<c:spPr><a:solidFill><a:srgbClr val="${s.hex.replace('#', '').toUpperCase()}"/></a:solidFill></c:spPr>` +
    cats(categories) + vals(s.values, i) + '</c:ser>').join('');
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    `<c:chartSpace xmlns:c="${CHART_NS}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL_NS}">` +
    '<c:chart><c:plotArea><c:layout/><c:barChart><c:barDir val="col"/><c:grouping val="clustered"/>' +
    ser +
    '<c:axId val="111111111"/><c:axId val="222222222"/></c:barChart>' +
    '<c:catAx><c:axId val="111111111"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:crossAx val="222222222"/></c:catAx>' +
    '<c:valAx><c:axId val="222222222"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:crossAx val="111111111"/></c:valAx>' +
    '</c:plotArea><c:legend><c:legendPos val="b"/></c:legend><c:plotVisOnly val="1"/></c:chart></c:chartSpace>';
}

interface BoxPx { x: number; y: number; w: number; h: number }

const xfrm = (box: BoxPx): string =>
  `<a:xfrm><a:off x="${px(box.x)}" y="${px(box.y)}"/><a:ext cx="${px(box.w)}" cy="${px(box.h)}"/></a:xfrm>`;

/** A `p:graphicFrame` holding a chart reference. */
function chartFrameXml(id: number, name: string, box: BoxPx, rId: string): string {
  return `<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="${id}" name="${name}"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>` +
    `<p:xfrm><a:off x="${px(box.x)}" y="${px(box.y)}"/><a:ext cx="${px(box.w)}" cy="${px(box.h)}"/></p:xfrm>` +
    `<a:graphic><a:graphicData uri="${CHART_NS}"><c:chart xmlns:c="${CHART_NS}" xmlns:r="${REL_NS}" r:id="${rId}"/></a:graphicData></a:graphic></p:graphicFrame>`;
}

/** A `p:pic` pointing at an image relationship the writer already emitted. */
function picXml(id: number, name: string, box: BoxPx, rId: string): string {
  return `<p:pic><p:nvPicPr><p:cNvPr id="${id}" name="${name}"/><p:cNvPicPr/><p:nvPr/></p:nvPicPr>` +
    `<p:blipFill><a:blip xmlns:r="${REL_NS}" r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>` +
    `<p:spPr>${xfrm(box)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
}

/** A plain text box. `paraXml` is one or more `a:p` elements. */
function textBoxXml(id: number, name: string, box: BoxPx, paraXml: string): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr txBox="1"/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr>${xfrm(box)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square"/><a:lstStyle/>${paraXml}</p:txBody></p:sp>`;
}

/** A filled rectangle whose colour is a theme slot reference, not a literal. */
function schemeRectXml(id: number, name: string, box: BoxPx, slot: string): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="${name}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr>${xfrm(box)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:schemeClr val="${slot}"/></a:solidFill></p:spPr>` +
    '<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>';
}

const escapeXml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** One paragraph of one run. */
function paraXml(textValue: string, sizePt: number, opts: { rtl?: boolean; align?: string; hlinkRid?: string; hex?: string } = {}): string {
  const pPr = `<a:pPr${opts.rtl ? ' rtl="1"' : ''}${opts.align ? ` algn="${opts.align}"` : ''}/>`;
  const link = opts.hlinkRid ? `<a:hlinkClick xmlns:r="${REL_NS}" r:id="${opts.hlinkRid}"/>` : '';
  const fill = opts.hex ? `<a:solidFill><a:srgbClr val="${opts.hex.replace('#', '').toUpperCase()}"/></a:solidFill>` : '';
  return `<a:p>${pPr}<a:r><a:rPr lang="en-US" sz="${Math.round(sizePt * 100)}" dirty="0">${fill}${link}</a:rPr><a:t>${escapeXml(textValue)}</a:t></a:r></a:p>`;
}

// ─── labels ──────────────────────────────────────────────────────────────────

/** True for a layout or master placeholder name the writer minted (`ph2`, `ph3`). */
const isPlaceholderName = (name: string): boolean => /^ph\d+$/.test(name);

/** Every `p:cNvPr` that names a drawable object, in document order. Group
 *  containers are left out: a group is ancestry, not an object of its own. */
function scanObjects(xml: string): Array<{ cNvPrId: number; name: string }> {
  const out: Array<{ cNvPrId: number; name: string }> = [];
  const pattern = /<p:(?:nvSpPr|nvPicPr|nvGraphicFramePr|nvCxnSpPr)><p:cNvPr id="(\d+)" name="([^"]*)"/g;
  for (const match of xml.matchAll(pattern)) out.push({ cNvPrId: Number(match[1]), name: match[2] ?? '' });
  return out;
}

/**
 * Pair a part's drawable objects with the specs authored for it, in order. `skip`
 * leaves a name out of the pairing: a layout's own placeholders are slots a slide
 * fills, not content, so they carry no label.
 */
function labelObjects<T extends AuthoredSpec>(partId: string, xml: string, specs: T[], skip?: (name: string) => boolean): Array<T & { id: string; name: string }> {
  const found = scanObjects(xml).filter((object) => !skip?.(object.name));
  if (found.length !== specs.length) {
    throw new Error(`build-rebrand-fixtures: ${partId} holds ${found.length} objects but ${specs.length} were labelled`);
  }
  return found.map((object, i) => {
    const spec = specs[i];
    if (!spec) throw new Error(`build-rebrand-fixtures: ${partId} object ${i} has no label`);
    return { id: `${partId}.${object.cNvPrId}`, name: object.name, ...spec };
  });
}

function checkLabel(label: FixtureObjectLabelV1): void {
  const classes: readonly string[] = OBJECT_CLASSES;
  const states: readonly string[] = FIDELITY_STATES;
  const origins: readonly string[] = SOURCE_ORIGINS;
  const kinds: readonly string[] = SOURCE_OBJECT_KINDS;
  if (!classes.includes(label.class)) throw new Error(`build-rebrand-fixtures: ${label.id} has an unknown class`);
  if (!states.includes(label.fidelity.state)) throw new Error(`build-rebrand-fixtures: ${label.id} has an unknown fidelity state`);
  if (!origins.includes(label.origin)) throw new Error(`build-rebrand-fixtures: ${label.id} has an unknown origin`);
  if (!kinds.includes(label.kind)) throw new Error(`build-rebrand-fixtures: ${label.id} has an unknown kind`);
}

/** How this fixture's object ids read. The pptx form and the pdf form differ. */
const PPTX_ID_FORM = '<slide part base name>.<p:cNvPr id>';
const PDF_ID_FORM = '<page id>.<object name>';

function finishLabels<S extends FixtureSlideLabelV1>(
  fixture: string,
  objectIdForm: string,
  slides: S[],
  inherited: FixtureObjectLabelV1[],
  colors?: FixtureColorLabelV1[],
): RebrandFixtureLabelsV1 & { slides: S[] } {
  const all = [...slides.flatMap((s) => s.objects), ...inherited];
  const labels: RebrandFixtureLabelsV1 & { slides: S[] } = {
    fixture,
    version: REBRAND_CONTRACT_VERSION,
    builder: 'scripts/build-rebrand-fixtures.ts',
    objectIdForm,
    slides,
    inherited,
    mustKeep: all.filter((o) => o.mustKeep).map((o) => o.id),
  };
  if (colors) labels.colors = colors;
  for (const object of all) checkLabel(object);
  const seen = new Set<string>();
  for (const object of all) {
    if (seen.has(object.id)) throw new Error(`build-rebrand-fixtures: ${fixture} reuses object id ${object.id}`);
    seen.add(object.id);
  }
  for (const object of all) {
    if (object.pairedWith && !seen.has(object.pairedWith)) {
      throw new Error(`build-rebrand-fixtures: ${object.id} is paired with ${object.pairedWith}, which no label names`);
    }
  }
  for (const use of colors ?? []) {
    for (const id of use.objectIds) {
      if (!seen.has(id)) throw new Error(`build-rebrand-fixtures: colour use ${use.hex} names object ${id}, which no label names`);
    }
    if (use.distinctionSet && !seen.has(use.distinctionSet)) {
      throw new Error(`build-rebrand-fixtures: colour use ${use.hex} names distinction set ${use.distinctionSet}, which no label names`);
    }
  }
  return labels;
}

// ─── zipping ─────────────────────────────────────────────────────────────────

function zipParts(parts: Parts): Uint8Array {
  const enc = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const name of Object.keys(parts).sort()) {
    const value = parts[name];
    if (value === undefined) continue;
    files[name] = typeof value === 'string' ? enc.encode(value) : value;
  }
  return zipSync(files, { level: ZIP_LEVEL, mtime: ZIP_MTIME });
}

// ─── fixture: simple.pptx ────────────────────────────────────────────────────

const CONTENT_LAYOUT: PptxLayout = {
  name: 'Content',
  placeholders: [
    { type: 'title', x: px(80), y: px(120), cx: px(1120), cy: px(110) },
    { type: 'body', idx: 1, x: px(80), y: px(260), cx: px(1120), cy: px(340), style: { bullet: true } },
    { type: 'sldNum', idx: 12, x: px(1150), y: px(660), cx: px(60), cy: px(30) },
  ],
};

const BAND: BoxPx = { x: 0, y: 40, w: DECK_W, h: 56 };
const LOGO: BoxPx = { x: 48, y: 640, w: 96, h: 24 };

/**
 * The layout simple.pptx uses: the content placeholders plus the deck owner's mark
 * as furniture. The mark sits HERE rather than on each slide on purpose. It and
 * adversarial.pptx's partner mark are otherwise the same evidence - small, bottom
 * corner, the same bytes on every slide, class `logo-candidate` - so the fact that
 * separates them has to be structural, and it is: a template places the owner's
 * mark, and a person pastes a partner's onto the slides. Without that, the two
 * fixtures' opposite `mustKeep` answers would be unlearnable.
 */
const simpleLayout = (logo: Uint8Array): PptxLayout => ({
  ...CONTENT_LAYOUT,
  media: [{ bytes: logo, ext: 'png' }],
  shapes: [{ kind: 'pic', x: px(LOGO.x), y: px(LOGO.y), cx: px(LOGO.w), cy: px(LOGO.h), media: 0, name: 'logo' }],
});

function buildSimple(): { bytes: Uint8Array; labels: RebrandFixtureLabelsV1 } {
  const logo = logoPng();
  const photo = photoPng();
  const titles = ['Quarterly review', 'Where the growth came from', 'What we do next'];
  const slides: PptxSlide[] = titles.map((title, i) => {
    const media = i === 1 ? [{ bytes: photo, ext: 'png' as const }] : [];
    const shapes: PptxSlide['shapes'] = [
      { kind: 'rect', x: px(BAND.x), y: px(BAND.y), cx: px(BAND.w), cy: px(BAND.h), fill: { solid: PALETTE_HEX } },
      { kind: 'text', x: px(80), y: px(120), cx: px(1120), cy: px(110), ph: { type: 'title' }, paras: [{ runs: [{ text: title, sizePt: 36 }] }] },
      {
        kind: 'text', x: px(80), y: px(260), cx: px(1120), cy: px(340), ph: { type: 'body', idx: 1 },
        paras: [
          { runs: [{ text: 'Revenue held in every region.', sizePt: 20 }], bullet: true },
          { runs: [{ text: 'Services grew faster than licences.', sizePt: 20 }], bullet: true },
        ],
      },
    ];
    if (i === 1) shapes.push({ kind: 'pic', x: px(700), y: px(300), cx: px(480), cy: px(270), media: 0, name: 'photo' });
    shapes.push({ kind: 'text', x: px(1150), y: px(660), cx: px(60), cy: px(30), ph: { type: 'sldNum', idx: 12 }, paras: [{ runs: [{ text: String(i + 1), sizePt: 12 }] }] });
    return { shapes, media, layout: 0 };
  });

  const parts = buildPptxParts(slides, {
    emuW: px(DECK_W), emuH: px(DECK_H), now: NOW, layouts: [simpleLayout(logo)],
    meta: { title: 'Rebrand fixture: simple' },
  });

  const slideLabels: FixtureSlideLabelV1[] = titles.map((_, i) => {
    const specs: AuthoredSpec[] = [
      { authored: 'band', origin: 'slide', kind: 'shape', class: 'decoration', fidelity: { state: 'editable' }, boxPx: BAND, note: 'the same full-width band near the top of every slide' },
      { authored: 'title', origin: 'slide', kind: 'text', class: 'title', fidelity: { state: 'editable' }, boxPx: { x: 80, y: 120, w: 1120, h: 110 }, mustKeep: true },
      { authored: 'body', origin: 'slide', kind: 'text', class: 'body', fidelity: { state: 'editable' }, boxPx: { x: 80, y: 260, w: 1120, h: 340 }, mustKeep: true },
    ];
    if (i === 1) specs.push({ authored: 'photo', origin: 'slide', kind: 'pic', class: 'photo', fidelity: { state: 'raster-preserved' }, boxPx: { x: 700, y: 300, w: 480, h: 270 }, mustKeep: true, note: 'a gradient with grain, so edge and colour signals read it as a photograph' });
    specs.push({ authored: 'page-number', origin: 'slide', kind: 'text', class: 'page-number', fidelity: { state: 'editable' }, boxPx: { x: 1150, y: 660, w: 60, h: 30 } });
    return {
      id: `slide${i + 1}`, index: i, widthPx: DECK_W, heightPx: DECK_H, flattened: false,
      objects: labelObjects(`slide${i + 1}`, partText(parts, `ppt/slides/slide${i + 1}.xml`), specs),
    };
  });

  const inherited = labelObjects('slideLayout1', partText(parts, 'ppt/slideLayouts/slideLayout1.xml'), [{
    authored: 'logo', origin: 'layout', kind: 'pic', class: 'logo-candidate',
    fidelity: { state: 'raster-preserved' }, boxPx: LOGO,
    note: 'the deck owner\'s mark, placed once by the layout, so every slide shows it and no slide part declares it',
  }], isPlaceholderName);

  return { bytes: zipParts(parts), labels: finishLabels('simple.pptx', PPTX_ID_FORM, slideLabels, inherited) };
}

// ─── fixture: adversarial.pptx ───────────────────────────────────────────────

const CONFIDENTIAL_BOX: BoxPx = { x: 980, y: 20, w: 260, h: 24 };
const MARK: BoxPx = { x: 1120, y: 620, w: 64, h: 64 };
const GROUP: BoxPx = { x: 120, y: 470, w: 400, h: 120 };
/** The group's own `p:cNvPr` id, which is what the reader reports as a child's ancestry. */
const GROUP_ID = '70';
/** The part the writer emitted for slide 3's second picture, which the fallback half reuses. */
const FALLBACK_MEDIA = 'ppt/media/image3_2.png';

function buildAdversarial(): { bytes: Uint8Array; labels: RebrandFixtureLabelsV1 } {
  const mark = partnerMarkPng();
  const fallback = chartFallbackPng();
  const cite = (year: number): string => `Source: report ${year}`;
  const legend = 'Key: EU, US, APAC';
  // Seven point, meaningful, and at the same box on every slide. The decoration
  // rule fires on repetition AND small text together, so a line that is only small
  // never reaches it; this one satisfies every clause and must still survive.
  const unitNote = 'Figures in EUR millions';
  const UNIT_NOTE_BOX: BoxPx = { x: 80, y: 620, w: 500, h: 22 };
  const unitNoteShape = (): PptxSlide['shapes'][number] => ({
    kind: 'text', x: px(UNIT_NOTE_BOX.x), y: px(UNIT_NOTE_BOX.y), cx: px(UNIT_NOTE_BOX.w), cy: px(UNIT_NOTE_BOX.h),
    paras: [{ runs: [{ text: unitNote, sizePt: 7 }] }],
  });

  const slides: PptxSlide[] = [
    {
      layout: 0,
      media: [{ bytes: mark, ext: 'png' }],
      shapes: [
        { kind: 'text', x: px(80), y: px(120), cx: px(1120), cy: px(110), ph: { type: 'title' }, paras: [{ runs: [{ text: 'Quarterly review', sizePt: 36 }] }] },
        { kind: 'pic', x: px(MARK.x), y: px(MARK.y), cx: px(MARK.w), cy: px(MARK.h), media: 0, name: 'partner-mark' },
        { kind: 'text', x: px(80), y: px(672), cx: px(500), cy: px(24), paras: [{ runs: [{ text: cite(2021), sizePt: 9 }] }] },
        unitNoteShape(),
      ],
    },
    {
      layout: 0,
      media: [{ bytes: mark, ext: 'png' }],
      shapes: [
        { kind: 'text', x: px(80), y: px(120), cx: px(1120), cy: px(110), ph: { type: 'title' }, paras: [{ runs: [{ text: 'Market data', sizePt: 36 }] }] },
        { kind: 'pic', x: px(MARK.x), y: px(MARK.y), cx: px(MARK.w), cy: px(MARK.h), media: 0, name: 'partner-mark' },
        { kind: 'text', x: px(80), y: px(596), cx: px(400), cy: px(24), paras: [{ runs: [{ text: legend, sizePt: 10 }] }] },
        { kind: 'text', x: px(80), y: px(672), cx: px(500), cy: px(24), paras: [{ runs: [{ text: cite(2022), sizePt: 9 }] }] },
        unitNoteShape(),
      ],
    },
    {
      layout: 0,
      media: [{ bytes: mark, ext: 'png' }, { bytes: fallback, ext: 'png' }],
      shapes: [
        { kind: 'text', x: px(80), y: px(120), cx: px(1120), cy: px(110), ph: { type: 'title' }, paras: [{ runs: [{ text: 'Regional detail', sizePt: 36 }] }] },
        {
          kind: 'text', x: px(80), y: px(240), cx: px(420), cy: px(90), ph: { type: 'body', idx: 1 },
          paras: [{ runs: [{ text: 'Growth in the region held through the second half, and the pipeline for the first quarter of next year is larger than it was at the same point last year, which is why the outlook has not been reduced.', sizePt: 18 }] }],
        },
        {
          kind: 'table', x: px(80), y: px(360), cx: px(420), cy: px(120), cols: [px(210), px(210)], firstRow: true,
          rows: [
            { cells: [{ text: 'Region', bold: true }, { text: 'Change', bold: true }] },
            { cells: [{ text: 'EU' }, { text: '+4%' }] },
            { cells: [{ text: 'APAC' }, { text: '+9%' }] },
          ],
        },
        { kind: 'pic', x: px(MARK.x), y: px(MARK.y), cx: px(MARK.w), cy: px(MARK.h), media: 0, name: 'partner-mark' },
        { kind: 'text', x: px(80), y: px(596), cx: px(400), cy: px(24), paras: [{ runs: [{ text: legend, sizePt: 10 }] }] },
        { kind: 'text', x: px(80), y: px(672), cx: px(500), cy: px(24), paras: [{ runs: [{ text: cite(2023), sizePt: 9 }] }] },
        unitNoteShape(),
      ],
    },
  ];

  const parts = buildPptxParts(slides, {
    emuW: px(DECK_W), emuH: px(DECK_H), now: NOW, layouts: [CONTENT_LAYOUT],
    meta: { title: 'Rebrand fixture: adversarial' },
  });

  // The master carries a line every slide inherits and nobody may quietly drop.
  appendToSpTree(parts, 'ppt/slideMasters/slideMaster1.xml',
    textBoxXml(80, 'confidential', CONFIDENTIAL_BOX, paraXml('Confidential - internal use only', 9, { align: 'r' })));

  // Slide 1: a group whose children are scaled by its child extent, and a long link.
  const linkRid = addRels(parts, 'ppt/slides/_rels/slide1.xml.rels', [
    { type: 'hyperlink', target: 'https://example.invalid/reports/2021/regional-performance-and-outlook/full-text', external: true },
  ])[0] ?? 'rId99';
  const groupChildA: BoxPx = { x: 0, y: 0, w: 400, h: 60 };
  const groupChildB: BoxPx = { x: 0, y: 80, w: 560, h: 60 };
  appendToSpTree(parts, 'ppt/slides/slide1.xml',
    '<p:grpSp><p:nvGrpSpPr><p:cNvPr id="70" name="group-phase"/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>' +
    `<p:grpSpPr><a:xfrm><a:off x="${px(GROUP.x)}" y="${px(GROUP.y)}"/><a:ext cx="${px(GROUP.w)}" cy="${px(GROUP.h)}"/>` +
    `<a:chOff x="0" y="0"/><a:chExt cx="${px(800)}" cy="${px(240)}"/></a:xfrm></p:grpSpPr>` +
    `<p:sp><p:nvSpPr><p:cNvPr id="71" name="group-bar"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    `<p:spPr>${xfrm(groupChildA)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:solidFill><a:srgbClr val="D65A28"/></a:solidFill></p:spPr>` +
    '<p:txBody><a:bodyPr/><a:lstStyle/><a:p/></p:txBody></p:sp>' +
    textBoxXml(72, 'group-caption', groupChildB, paraXml('Phase one', 14)) +
    '</p:grpSp>' +
    textBoxXml(73, 'long-url', { x: 80, y: 640, w: 900, h: 24 },
      paraXml('https://example.invalid/reports/2021/regional-performance-and-outlook/full-text', 11, { hlinkRid: linkRid })));

  // Slide 2: a native chart with nothing to fall back to.
  parts['ppt/charts/chart1.xml'] = chartXml(['Q1', 'Q2', 'Q3', 'Q4'], [
    { name: 'EU', hex: '#1F4E79', values: [12, 14, 15, 18] },
    { name: 'US', hex: '#D65A28', values: [9, 11, 10, 13] },
  ]);
  addContentTypeOverride(parts, '/ppt/charts/chart1.xml', CHART_CT);
  const chart1Rid = addRels(parts, 'ppt/slides/_rels/slide2.xml.rels', [{ type: 'chart', target: '../charts/chart1.xml' }])[0] ?? 'rId99';
  const chart1Box: BoxPx = { x: 200, y: 260, w: 560, h: 300 };
  appendToSpTree(parts, 'ppt/slides/slide2.xml', chartFrameXml(74, 'chart-no-fallback', chart1Box, chart1Rid));

  // Slide 3: a chart a consumer may not understand, beside the real picture the
  // file carries for it. The fallback picture rides the writer's own media
  // relationship (rId3, the slide's second picture), so its bytes are in the
  // package exactly once.
  parts['ppt/charts/chart2.xml'] = chartXml(['EU', 'US', 'APAC', 'LATAM', 'MEA'], [
    { name: 'Share', hex: '#1F4E79', values: [40, 70, 55, 90, 65] },
  ]);
  addContentTypeOverride(parts, '/ppt/charts/chart2.xml', CHART_CT);
  const chart2Rid = addRels(parts, 'ppt/slides/_rels/slide3.xml.rels', [{ type: 'chart', target: '../charts/chart2.xml' }])[0] ?? 'rId99';
  const chart2Box: BoxPx = { x: 620, y: 300, w: 480, h: 300 };
  appendToSpTree(parts, 'ppt/slides/slide3.xml',
    '<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006">' +
    '<mc:Choice xmlns:c14="http://schemas.microsoft.com/office/drawing/2007/8/2/chart" Requires="c14">' +
    chartFrameXml(75, 'chart-with-fallback', chart2Box, chart2Rid) +
    '</mc:Choice><mc:Fallback>' +
    picXml(76, 'chart-fallback-picture', chart2Box, 'rId3') +
    '</mc:Fallback></mc:AlternateContent>' +
    textBoxXml(77, 'arabic-line', { x: 620, y: 200, w: 480, h: 40 }, paraXml('المبيعات حسب المنطقة', 16, { rtl: true, align: 'r' })) +
    textBoxXml(78, 'japanese-line', { x: 80, y: 500, w: 420, h: 40 }, paraXml('地域別の売上高', 16)));

  const citationSpec = (year: number): AuthoredSpec => ({
    authored: `citation-${year}`, origin: 'slide', kind: 'text', class: 'footer',
    fidelity: { state: 'editable' }, boxPx: { x: 80, y: 672, w: 500, h: 24 }, mustKeep: true,
    note: 'repeats on every slide with the year changed, so a digit-normalised repeat must not read it as furniture to drop',
  });
  const unitNoteSpec: AuthoredSpec = {
    authored: 'small-meaningful-text', origin: 'slide', kind: 'text', class: 'body',
    fidelity: { state: 'editable' }, boxPx: UNIT_NOTE_BOX, mustKeep: true, text: unitNote,
    note: 'seven point and meaningful, at the same box on all three slides, so it meets every clause of the decoration rule and must still survive',
  };
  const legendSpec: AuthoredSpec = {
    authored: 'chart-legend-key', origin: 'slide', kind: 'text', class: 'recurring-text',
    fidelity: { state: 'editable' }, boxPx: { x: 80, y: 596, w: 400, h: 24 }, mustKeep: true,
    note: 'the same key on two slides; a repeat rule must not remove it',
  };
  const markSpec: AuthoredSpec = {
    authored: 'partner-mark', origin: 'slide', kind: 'pic', class: 'logo-candidate',
    fidelity: { state: 'raster-preserved' }, boxPx: MARK, mustKeep: true,
    note: 'the same bytes on three slides, and a partner mark rather than the mark of the deck owner',
  };
  const titleSpec: AuthoredSpec = {
    authored: 'title', origin: 'slide', kind: 'text', class: 'title', fidelity: { state: 'editable' },
    boxPx: { x: 80, y: 120, w: 1120, h: 110 }, mustKeep: true,
  };

  const slide1Specs: AuthoredSpec[] = [
    titleSpec,
    markSpec,
    citationSpec(2021),
    unitNoteSpec,
    { authored: 'group-bar', origin: 'slide', kind: 'shape', class: 'decoration', fidelity: { state: 'editable' }, boxPx: { x: 120, y: 470, w: 200, h: 30 }, groupPath: [GROUP_ID], groupNames: ['group-phase'], note: 'authored 400 by 60 in a group whose child extent is twice its extent, so the composed box is half size' },
    { authored: 'group-caption', origin: 'slide', kind: 'text', class: 'body', fidelity: { state: 'editable' }, boxPx: { x: 120, y: 510, w: 280, h: 30 }, groupPath: [GROUP_ID], groupNames: ['group-phase'], mustKeep: true, note: 'same group scaling as the bar beside it' },
    { authored: 'long-url', origin: 'slide', kind: 'text', class: 'body', fidelity: { state: 'editable' }, boxPx: { x: 80, y: 640, w: 900, h: 24 }, mustKeep: true, note: 'one run carrying a:hlinkClick to an external target' },
  ];
  const slide2Specs: AuthoredSpec[] = [
    titleSpec,
    markSpec,
    legendSpec,
    citationSpec(2022),
    unitNoteSpec,
    {
      authored: 'chart-no-fallback', origin: 'slide', kind: 'chart', class: 'chart',
      fidelity: { state: 'unavailable', reason: 'native-chart-no-fallback' }, boxPx: chart1Box, mustKeep: true,
      note: 'a native chart part with no picture anywhere in the file, so nothing can be SHOWN for it and it reaches Design as a labelled placeholder, never as a picture of the source. Its caches are complete, and those categories, series names, values and literal series colours travel on the source object\'s chartData whatever the fidelity state says: `unavailable` is never licence to discard them',
    },
  ];
  const slide3Specs: AuthoredSpec[] = [
    titleSpec,
    { authored: 'overflowing-body', origin: 'slide', kind: 'text', class: 'body', fidelity: { state: 'editable' }, boxPx: { x: 80, y: 240, w: 420, h: 90 }, mustKeep: true, note: 'more text than the box holds at eighteen point' },
    { authored: 'table', origin: 'slide', kind: 'table', class: 'table', fidelity: { state: 'editable' }, boxPx: { x: 80, y: 360, w: 420, h: 120 }, mustKeep: true },
    markSpec,
    legendSpec,
    citationSpec(2023),
    unitNoteSpec,
    {
      authored: 'chart-with-fallback', origin: 'slide', kind: 'chart', class: 'chart',
      fidelity: { state: 'raster-preserved', fallbackSource: 'embedded', fallbackAssetRef: FALLBACK_MEDIA },
      boxPx: chart2Box, mustKeep: true, alternateContent: 'choice', pairedWith: 'slide3.76',
      note: 'the choice half of an mc:AlternateContent pair; the file carries real bytes for it, and no fidelity reason applies because nothing about it is missing',
    },
    {
      authored: 'chart-fallback-picture', origin: 'slide', kind: 'pic', class: 'chart',
      fidelity: { state: 'raster-preserved' }, boxPx: chart2Box, alternateContent: 'fallback', pairedWith: 'slide3.75',
      note: 'the fallback half. A correct reading surfaces ONE object for the pair, carrying these bytes as its fallback, so this half is not its own object and carries no mustKeep of its own; the pair is kept through slide3.75',
    },
    { authored: 'arabic-line', origin: 'slide', kind: 'text', class: 'body', fidelity: { state: 'editable' }, boxPx: { x: 620, y: 200, w: 480, h: 40 }, mustKeep: true, note: 'right to left paragraph' },
    { authored: 'japanese-line', origin: 'slide', kind: 'text', class: 'body', fidelity: { state: 'editable' }, boxPx: { x: 80, y: 500, w: 420, h: 40 }, mustKeep: true },
  ];

  const specsBySlide = [slide1Specs, slide2Specs, slide3Specs];
  const slideLabels: FixtureSlideLabelV1[] = specsBySlide.map((specs, i) => ({
    id: `slide${i + 1}`, index: i, widthPx: DECK_W, heightPx: DECK_H, flattened: false,
    objects: labelObjects(`slide${i + 1}`, partText(parts, `ppt/slides/slide${i + 1}.xml`), specs),
  }));

  const inherited = labelObjects('slideMaster1', partText(parts, 'ppt/slideMasters/slideMaster1.xml'), [{
    authored: 'confidential', origin: 'master', kind: 'text', class: 'recurring-text',
    fidelity: { state: 'editable' }, boxPx: CONFIDENTIAL_BOX, mustKeep: true,
    note: 'declared on the master, so it is on every slide and appears in no slide part',
  }]);

  return { bytes: zipParts(parts), labels: finishLabels('adversarial.pptx', PPTX_ID_FORM, slideLabels, inherited) };
}

// ─── fixture: palette.pptx ───────────────────────────────────────────────────

const PALETTE_THEME: PptxTheme = {
  name: 'Fixture',
  colors: {
    dk1: '#101318', lt1: '#FFFFFF', dk2: '#1F4E79', lt2: '#E8EAEE',
    accent1: '#1F4E79', accent2: '#D65A28', accent3: '#106E60', accent4: '#7A4FBF', accent5: '#B8860B', accent6: '#2E7D32',
  },
  fonts: { major: 'Source Sans Pro', minor: 'Source Sans Pro' },
};

const SERIES_HEXES = ['#1F4E79', '#D65A28', '#106E60', '#7A4FBF', '#B8860B', '#2E7D32', '#8E244A', '#3F51B5'];

function buildPalette(): { bytes: Uint8Array; labels: RebrandFixtureLabelsV1 } {
  const slides: PptxSlide[] = [
    {
      layout: 0, media: [],
      shapes: [
        { kind: 'text', x: px(80), y: px(120), cx: px(1120), cy: px(110), ph: { type: 'title' }, paras: [{ runs: [{ text: 'One hex, three roles', sizePt: 36, color: '#FFFFFF' }] }] },
        {
          kind: 'text', x: px(80), y: px(260), cx: px(1120), cy: px(200), ph: { type: 'body', idx: 1 },
          paras: [{ runs: [{ text: 'This paragraph is set in the same hex the background uses and the chart uses for its first series.', sizePt: 20, color: PALETTE_HEX }] }],
        },
      ],
    },
    {
      layout: 0, media: [],
      shapes: [
        { kind: 'text', x: px(80), y: px(120), cx: px(1120), cy: px(110), ph: { type: 'title' }, paras: [{ runs: [{ text: 'Eight series', sizePt: 36 }] }] },
      ],
    },
  ];

  const parts = buildPptxParts(slides, {
    emuW: px(DECK_W), emuH: px(DECK_H), now: NOW, layouts: [CONTENT_LAYOUT], theme: PALETTE_THEME,
    meta: { title: 'Rebrand fixture: palette' },
  });

  setSlideBackground(parts, 'ppt/slides/slide1.xml', PALETTE_HEX);

  // Six swatches that name a theme slot rather than a literal, so a plan can map
  // slot to slot before it ever reaches a hex.
  const slots = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
  const swatchBoxes = slots.map((_, i) => ({ x: 80 + i * 180, y: 520, w: 150, h: 90 }));
  appendToSpTree(parts, 'ppt/slides/slide1.xml',
    slots.map((slot, i) => schemeRectXml(60 + i, `swatch-${slot}`, swatchBoxes[i] ?? { x: 0, y: 0, w: 1, h: 1 }, slot)).join(''));

  parts['ppt/charts/chart1.xml'] = chartXml(['H1', 'H2'], SERIES_HEXES.map((hex, i) => ({
    name: `Series ${i + 1}`, hex, values: [10 + i, 14 + i],
  })));
  addContentTypeOverride(parts, '/ppt/charts/chart1.xml', CHART_CT);
  const chartRid = addRels(parts, 'ppt/slides/_rels/slide2.xml.rels', [{ type: 'chart', target: '../charts/chart1.xml' }])[0] ?? 'rId99';
  const chartBox: BoxPx = { x: 120, y: 260, w: 1040, h: 380 };
  appendToSpTree(parts, 'ppt/slides/slide2.xml', chartFrameXml(66, 'eight-series-chart', chartBox, chartRid));

  const slide1Specs: AuthoredSpec[] = [
    { authored: 'title', origin: 'slide', kind: 'text', class: 'title', fidelity: { state: 'editable' }, boxPx: { x: 80, y: 120, w: 1120, h: 110 }, mustKeep: true },
    { authored: 'body-ink', origin: 'slide', kind: 'text', class: 'body', fidelity: { state: 'editable' }, boxPx: { x: 80, y: 260, w: 1120, h: 200 }, mustKeep: true, note: `ink at ${PALETTE_HEX}, the same hex as the slide ground` },
    ...slots.map((slot, i): AuthoredSpec => ({
      authored: `swatch-${slot}`, origin: 'slide', kind: 'shape', class: 'decoration',
      fidelity: { state: 'editable' }, boxPx: swatchBoxes[i] ?? { x: 0, y: 0, w: 1, h: 1 },
      note: `filled by the theme slot ${slot}, not by a literal`,
    })),
  ];
  const slide2Specs: AuthoredSpec[] = [
    { authored: 'title', origin: 'slide', kind: 'text', class: 'title', fidelity: { state: 'editable' }, boxPx: { x: 80, y: 120, w: 1120, h: 110 }, mustKeep: true },
    {
      authored: 'eight-series-chart', origin: 'slide', kind: 'chart', class: 'chart',
      fidelity: { state: 'unavailable', reason: 'native-chart-no-fallback' }, boxPx: chartBox, mustKeep: true,
      note: 'eight series in eight literal colours, more than a neutral master has usable swatches. Nothing draws it, so its fidelity is unavailable, but the caches are complete and the reader returns every series name, value and colour: this is the object the "more series than usable swatches" bar is measured on, and none of it may be thrown away',
    },
  ];

  const slideLabels: FixtureSlideLabelV1[] = [slide1Specs, slide2Specs].map((specs, i) => ({
    id: `slide${i + 1}`, index: i, widthPx: DECK_W, heightPx: DECK_H, flattened: false,
    objects: labelObjects(`slide${i + 1}`, partText(parts, `ppt/slides/slide${i + 1}.xml`), specs),
  }));

  const swatchIds = slideLabels[0]?.objects.filter((o) => o.authored.startsWith('swatch-')) ?? [];
  const inkId = slideLabels[0]?.objects[1]?.id ?? '';
  // The chart is the distinction set: its eight series have to stay apart from each
  // other, which is a different requirement from each one landing well on its own.
  const chartId = slideLabels[1]?.objects[1]?.id ?? '';
  const colors: FixtureColorLabelV1[] = [
    { hex: PALETTE_HEX, role: 'ink', objectIds: [inkId], slideId: 'slide1', note: 'body ink' },
    { hex: PALETTE_HEX, role: 'bg', objectIds: [], slideId: 'slide1', note: 'the ground of slide 1, which is a use with no object of its own' },
    { hex: PALETTE_HEX, role: 'series', objectIds: [chartId], slideId: 'slide2', distinctionSet: chartId, note: 'series 1 of the chart' },
    ...swatchIds.map((swatch, i): FixtureColorLabelV1 => ({
      hex: PALETTE_THEME.colors?.[`accent${i + 1}` as 'accent1'] ?? '#000000',
      role: 'accent', objectIds: [swatch.id], scheme: `accent${i + 1}`, slideId: 'slide1',
      note: `named by the theme slot accent${i + 1} rather than by a literal, so a plan can map slot to slot before it reaches a hex`,
    })),
    ...SERIES_HEXES.slice(1).map((hex, i): FixtureColorLabelV1 => ({
      hex, role: 'series', objectIds: [chartId], slideId: 'slide2', distinctionSet: chartId,
      note: `series ${i + 2} of the chart`,
    })),
  ];

  return { bytes: zipParts(parts), labels: finishLabels('palette.pptx', PPTX_ID_FORM, slideLabels, [], colors) };
}

// ─── fixture: flattened.pdf ──────────────────────────────────────────────────

function buildFlattened(): { bytes: Uint8Array; labels: RebrandFixtureLabelsV1 } {
  const titles = ['REVENUE GROWTH', 'MARKET SHARE', 'NEXT STEPS'];
  const width = 960;
  const height = 540;
  const bytes = flattenedPdf(titles.map((title) => ({ title, width, height })));
  const slides: FixtureSlideLabelV1[] = titles.map((title, i) => ({
    id: `page${i + 1}`, index: i, widthPx: width, heightPx: height, flattened: true,
    objects: [{
      id: `page${i + 1}.Im0`, authored: `page-image-${i + 1}`, origin: 'pdf-artifact', kind: 'pic',
      class: 'screenshot', fidelity: { state: 'raster-preserved' },
      boxPx: { x: 0, y: 0, w: width, h: height }, mustKeep: true, text: title,
      note: 'one image covering the whole page; `text` is the title painted into it, which is what a recovery pass has to read back',
    }],
  }));
  return { bytes, labels: finishLabels('flattened.pdf', PDF_ID_FORM, slides, []) };
}

// ─── plan 275: the additive label fields ─────────────────────────────────────

/**
 * A paragraph as a correct reading of it looks, in the contract's own shape
 * (`SourceParaV1` with its runs as `SourceRunV1`), so a reader test compares the
 * label with what `parasOf` returns field by field. Two fields are the label's
 * own: `bulletSource` says which part supplied the marker, and `number` is the
 * ordinal a numbered paragraph draws.
 */
export interface ParaLabel275 extends SourceParaV1 {
  runs: SourceRunV1[];
  /** The part the marker (or the explicit absence of one) comes from after the cascade. */
  bulletSource?: 'slide' | 'layout' | 'master';
  /** The number a `number` paragraph draws, counted within its list. */
  number?: number;
}

/** The role an object plays inside a structure: an archetype role, or the card panel that holds a unit. */
export type UnitRole275 = ArchetypeRoleV1 | 'container';

/**
 * What a correct reading and compile make of one drawing (plan 275 decision 32): the
 * items the reader keeps, what it leaves out and why, the series the parts name, and
 * the rows the faithful compile writes, or the reason it keeps the picture.
 */
export interface VectorLabel275 {
  /** Items `vectorItems` holds. */
  items: number;
  /** Items left out, by reason. Absent when nothing is. */
  omitted?: Array<{ reason: string; count: number }>;
  /** Distinct series names the parts state, sorted. */
  series?: string[];
  /** The drawing's own `<title>`. */
  title?: string;
  /** Rows the faithful compile writes for it, by kind. Absent when it stays a picture. */
  rows?: { box: number; path: number; text: number };
  /** Why the compile keeps the picture (`vector.kept-as-picture` reason). */
  keptAsPicture?: string;
  /** The source warning the reading raises for it. */
  warning?: string;
}

/** An object label with the plan 275 fields. All are optional, so every older label still reads. */
export interface ObjectLabel275 extends FixtureObjectLabelV1 {
  /** Every paragraph the object holds, for the objects whose formatting a test reads. */
  paras?: ParaLabel275[];
  /** Its role in the slide's structure, when the slide states one. */
  role?: UnitRole275;
  /** What the drawing becomes, for a picture that carries an SVG or a freeform. */
  vector?: VectorLabel275;
}

/** The structure a slide is drawn in, as a person labelling it would name it. */
export interface StructureLabel275 {
  /** The layout library id (plan 275 section 2.3). */
  id: StructureIdV1;
  /** The matcher rule that names it (plan 275 section 3.2), such as `stack-4` or `image-row-3`. */
  read: string;
  /** The band a correct matcher reaches (`LayoutMatchV1.band`). */
  band: LayoutMatchBandV1;
  /** The units the structure is made of, in reading order, each as its member object ids. */
  units: string[][];
  /** Why, in plain words. */
  evidence: string;
}

export interface SlideLabel275 extends FixtureSlideLabelV1 {
  objects: ObjectLabel275[];
  structure?: StructureLabel275;
}

export interface FixtureLabels275 extends RebrandFixtureLabelsV1 {
  slides: SlideLabel275[];
}

/** The three fixtures plan 275 adds, beside the four of plan 274. */
export const PLAN_275_FIXTURES = ['formatting.pptx', 'structures.pptx', 'vector.pptx'] as const;

/**
 * The first-slice library ids (plan 275 section 2.6) a structure label may name.
 * Checked here so a typo in a label fails the build rather than a later matcher test.
 */
const FIRST_SLICE_STRUCTURES: ReadonlySet<string> = new Set([
  'cover-title', 'cover-title-image', 'title-only', 'section', 'statement', 'title-body', 'title-subtitle-body',
  'text-two-column', 'comparison', 'columns-2', 'columns-3', 'columns-4', 'icon-columns-3', 'grid-2x2', 'grid-3x2',
  'cards-3', 'full-image', 'full-image-caption', 'visual', 'image-caption', 'image-and-text', 'text-and-image',
  'images-2', 'images-3', 'image-grid-2x2', 'chart', 'chart-and-callout', 'big-number', 'stats-3', 'stats-4',
  'table', 'steps-3', 'steps-4', 'timeline', 'quote', 'agenda', 'agenda-numbered', 'numbered-rows', 'closing-thanks',
]);

function checkStructure(slide: SlideLabel275): void {
  const s = slide.structure;
  if (!s) return;
  const where = `build-rebrand-fixtures: ${slide.id}`;
  if (!STRUCTURE_ID_PATTERN.test(s.id) || !FIRST_SLICE_STRUCTURES.has(s.id)) throw new Error(`${where} names ${s.id}, which is not a first-slice library id`);
  if (!(LAYOUT_MATCH_BANDS as readonly string[]).includes(s.band)) throw new Error(`${where} has an unknown band ${s.band}`);
  const ids = new Set(slide.objects.map((o) => o.id));
  const seen = new Set<string>();
  for (const unit of s.units) {
    if (unit.length === 0) throw new Error(`${where} has an empty unit`);
    for (const id of unit) {
      if (!ids.has(id)) throw new Error(`${where}: unit member ${id} is not an object on this slide`);
      if (seen.has(id)) throw new Error(`${where}: ${id} belongs to two units`);
      seen.add(id);
    }
  }
  for (const object of slide.objects) {
    if (object.role && !seen.has(object.id)) throw new Error(`${where}: ${object.id} has a role but no unit`);
    if (seen.has(object.id) && !object.role) throw new Error(`${where}: ${object.id} belongs to a unit but has no role`);
  }
}

// ─── plan 275: hand-authored text ────────────────────────────────────────────

/** One run as OOXML, with the attributes the engine writer has no model for. */
interface RunSpec {
  text: string;
  sizePt: number;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strike?: boolean;
  /** `a:rPr@baseline` in thousandths of a percent: 30000 raises, -25000 lowers. */
  baseline?: number;
  cap?: 'all' | 'small';
  hex?: string;
  font?: string;
  hlinkRid?: string;
}

/** Attributes then children in `CT_TextCharacterProperties` order, so the part reads as PowerPoint writes it. */
function richRunXml(run: RunSpec): string {
  const attrs = [`lang="en-US"`, `sz="${Math.round(run.sizePt * 100)}"`];
  if (run.bold) attrs.push('b="1"');
  if (run.italic) attrs.push('i="1"');
  if (run.underline) attrs.push('u="sng"');
  if (run.strike) attrs.push('strike="sngStrike"');
  if (run.cap) attrs.push(`cap="${run.cap}"`);
  if (run.baseline) attrs.push(`baseline="${run.baseline}"`);
  const fill = run.hex ? `<a:solidFill><a:srgbClr val="${run.hex.replace('#', '').toUpperCase()}"/></a:solidFill>` : '';
  const font = run.font ? `<a:latin typeface="${escapeXml(run.font)}"/>` : '';
  const link = run.hlinkRid ? `<a:hlinkClick xmlns:r="${REL_NS}" r:id="${run.hlinkRid}"/>` : '';
  return `<a:r><a:rPr ${attrs.join(' ')}>${fill}${font}${link}</a:rPr><a:t>${escapeXml(run.text)}</a:t></a:r>`;
}

/** One paragraph. `pPr` is the literal paragraph properties element, or '' for none at all. */
function richParaXml(pPr: string, runs: RunSpec[]): string {
  return `<a:p>${pPr}${runs.map(richRunXml).join('')}</a:p>`;
}

/**
 * A placeholder-bound text shape in the writer's own form (the same `bodyPr` and
 * locks `textXml` emits), for text whose runs the writer cannot express.
 */
function phTextXml(id: number, ph: string, box: BoxPx, parasXml: string): string {
  return `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="text${id}"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr>${ph}</p:nvPr></p:nvSpPr>` +
    `<p:spPr>${xfrm(box)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/></p:spPr>` +
    `<p:txBody><a:bodyPr wrap="square" anchor="t" lIns="0" tIns="0" rIns="0" bIns="0"><a:noAutofit/></a:bodyPr><a:lstStyle/>${parasXml}</p:txBody></p:sp>`;
}

const PH_TITLE = '<p:ph type="title"/>';
const PH_BODY = '<p:ph type="body" idx="1"/>';
const PH_SLDNUM = '<p:ph type="sldNum" idx="12"/>';

/** Bullet glyphs, written as escapes so the source stays plain ASCII. */
const BULLET_DOT = '\u2022';
const BULLET_DASH = '\u2013';
const BULLET_ANGLE = '\u203a';
/** The glyph the master body style gives each of its first three levels. */
const LEVEL_GLYPHS = [BULLET_DOT, BULLET_DASH, BULLET_ANGLE] as const;

/** Hanging indents in EMU per level, as PowerPoint's own body style writes them. */
const LEVEL_INDENT = [
  { marL: 342900, indent: -342900 },
  { marL: 742950, indent: -285750 },
  { marL: 1143000, indent: -228600 },
] as const;

const emuToPx = (emu: number): number => emu / EMU_PER_PX;

/**
 * The master body style formatting.pptx carries: a bullet glyph and a hanging
 * indent on each of the first three levels, which is how a real template supplies
 * bullets. A slide paragraph with no `a:pPr` of its own gets its marker from here
 * and from nowhere else, which is the case the reader has to resolve through the
 * cascade rather than off the slide.
 */
function masterBodyStyleXml(): string {
  const sizes = [1800, 1600, 1400] as const;
  const levels = LEVEL_INDENT.map((step, i) =>
    `<a:lvl${i + 1}pPr marL="${step.marL}" indent="${step.indent}"><a:buFont typeface="Arial"/><a:buChar char="${LEVEL_GLYPHS[i] ?? BULLET_DOT}"/>` +
    `<a:defRPr sz="${sizes[i] ?? 1800}"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl${i + 1}pPr>`).join('');
  return `<p:bodyStyle>${levels}</p:bodyStyle>`;
}

function setMasterBodyStyle(parts: Parts): void {
  const name = 'ppt/slideMasters/slideMaster1.xml';
  const before = partText(parts, name);
  const after = before.replace(/<p:bodyStyle>[\s\S]*?<\/p:bodyStyle>/, masterBodyStyleXml());
  if (after === before) throw new Error('build-rebrand-fixtures: the master has no body style to replace');
  parts[name] = after;
}

// ─── fixture: formatting.pptx ────────────────────────────────────────────────

/**
 * The run and paragraph formatting plan 275 section 7 carries through to Design,
 * built from the specification in `plans/275-rebrand-ux-evidence/formatting-fixture.pptx`
 * (that file is `simple.pptx` with two text bodies rewritten; this one is written
 * here, so its bytes are reproducible). Three slides on the content layout:
 *
 * 1. a body with no paragraph properties at all, whose bullets come only from the
 *    master body style;
 * 2. the specification's slide 2: a title of seven runs (plain, bold, italic,
 *    underline, strike, red, a smaller size) and a body holding a bullet with a
 *    bold run inside, a nested level-1 bullet, two auto-numbered items, a
 *    right-aligned line with no bullet carrying superscript, subscript and an
 *    all-caps run, and a justified line with an external link and a literal
 *    Georgia face;
 * 3. what plan 275 WP3 asserts beyond that: bold lead-ins, three levels whose
 *    glyphs all come from the master, an explicit `a:buNone` that stops an
 *    inherited bullet, an italic citation and a numbered list.
 *
 * The writer has no model for `baseline`, `cap` or an external link, so the title
 * and body shapes are authored here in the writer's own shape form.
 */
function buildFormatting(): { bytes: Uint8Array; labels: FixtureLabels275 } {
  const bandShape = (): PptxSlide['shapes'][number] =>
    ({ kind: 'rect', x: px(BAND.x), y: px(BAND.y), cx: px(BAND.w), cy: px(BAND.h), fill: { solid: PALETTE_HEX } });
  const slides: PptxSlide[] = [0, 1, 2].map(() => ({ shapes: [bandShape()], media: [], layout: 0 }));
  const parts = buildPptxParts(slides, {
    emuW: px(DECK_W), emuH: px(DECK_H), now: NOW, layouts: [CONTENT_LAYOUT],
    meta: { title: 'Rebrand fixture: formatting' },
  });
  setMasterBodyStyle(parts);

  const TITLE_BOX: BoxPx = { x: 80, y: 120, w: 1120, h: 110 };
  const BODY_BOX: BoxPx = { x: 80, y: 260, w: 1120, h: 340 };
  const NUM_BOX: BoxPx = { x: 1150, y: 660, w: 60, h: 30 };
  const plainTitle = (text: string): string => richParaXml('', [{ text, sizePt: 36 }]);
  const pageNumber = (n: number): string => phTextXml(5, PH_SLDNUM, NUM_BOX, richParaXml('', [{ text: String(n), sizePt: 12 }]));
  const hang = (level: 0 | 1 | 2): string => `marL="${LEVEL_INDENT[level].marL}"${level > 0 ? ` lvl="${level}"` : ''} indent="${LEVEL_INDENT[level].indent}"`;

  // Slide 1: nothing on the slide says "bullet".
  appendToSpTree(parts, 'ppt/slides/slide1.xml',
    phTextXml(3, PH_TITLE, TITLE_BOX, plainTitle('Quarterly review')) +
    phTextXml(4, PH_BODY, BODY_BOX,
      richParaXml('', [{ text: 'Inherits its bullet from the master', sizePt: 20 }]) +
      richParaXml('', [{ text: 'So does this line', sizePt: 20 }])) +
    pageNumber(1));

  // Slide 2: the specification's title and body.
  const linkRid = addRels(parts, 'ppt/slides/_rels/slide2.xml.rels', [
    { type: 'hyperlink', target: 'https://lolly.tools/', external: true },
  ])[0] ?? 'rId99';
  appendToSpTree(parts, 'ppt/slides/slide2.xml',
    phTextXml(3, PH_TITLE, TITLE_BOX, richParaXml('<a:pPr algn="ctr"/>', [
      { text: 'Plain ', sizePt: 36 },
      { text: 'Bold', sizePt: 36, bold: true },
      { text: ' Italic', sizePt: 36, italic: true },
      { text: ' Under', sizePt: 36, underline: true },
      { text: ' Strike', sizePt: 36, strike: true },
      { text: ' Red', sizePt: 36, hex: '#C00000' },
      { text: ' Small', sizePt: 20 },
    ])) +
    phTextXml(4, PH_BODY, BODY_BOX,
      richParaXml(`<a:pPr ${hang(0)}><a:lnSpc><a:spcPct val="150000"/></a:lnSpc><a:spcBef><a:spcPts val="1200"/></a:spcBef><a:buChar char="${BULLET_DOT}"/></a:pPr>`, [
        { text: 'First bullet with ', sizePt: 20 },
        { text: 'bold', sizePt: 20, bold: true },
        { text: ' inside', sizePt: 20 },
      ]) +
      richParaXml(`<a:pPr ${hang(1)}><a:buChar char="${BULLET_DASH}"/></a:pPr>`, [{ text: 'Nested second level', sizePt: 18 }]) +
      richParaXml(`<a:pPr ${hang(0)}><a:buAutoNum type="arabicPeriod"/></a:pPr>`, [{ text: 'Numbered one', sizePt: 20 }]) +
      richParaXml(`<a:pPr ${hang(0)}><a:buAutoNum type="arabicPeriod"/></a:pPr>`, [{ text: 'Numbered two', sizePt: 20 }]) +
      richParaXml('<a:pPr algn="r"><a:buNone/></a:pPr>', [
        { text: 'Right aligned no bullet ', sizePt: 20 },
        { text: 'E=mc', sizePt: 20 },
        { text: '2', sizePt: 20, baseline: 30000 },
        { text: ' H', sizePt: 20 },
        { text: '2', sizePt: 20, baseline: -25000 },
        { text: 'O ', sizePt: 20 },
        { text: 'caps', sizePt: 20, cap: 'all' },
      ]) +
      richParaXml('<a:pPr algn="just"><a:buNone/></a:pPr>', [
        { text: 'Visit ', sizePt: 20 },
        { text: 'lolly.tools', sizePt: 20, underline: true, hlinkRid: linkRid },
        { text: ' for more, in ', sizePt: 20 },
        { text: 'Georgia', sizePt: 20, font: 'Georgia' },
      ])) +
    pageNumber(2));

  // Slide 3: lists whose markers come through the cascade, and one that stops it.
  appendToSpTree(parts, 'ppt/slides/slide3.xml',
    phTextXml(3, PH_TITLE, TITLE_BOX, plainTitle('Lists through the cascade')) +
    phTextXml(4, PH_BODY, BODY_BOX,
      richParaXml('', [{ text: 'Scope:', sizePt: 20, bold: true }, { text: ' what the renovation changes', sizePt: 20 }]) +
      richParaXml('', [{ text: 'Owner:', sizePt: 20, bold: true }, { text: ' the team that holds the design system', sizePt: 20 }]) +
      richParaXml('<a:pPr lvl="1"/>', [{ text: 'Second level from the master', sizePt: 18 }]) +
      richParaXml('<a:pPr lvl="2"/>', [{ text: 'Third level from the master', sizePt: 16 }]) +
      richParaXml('<a:pPr><a:buNone/></a:pPr>', [{ text: 'Source: annual survey, page 12', sizePt: 14, italic: true }]) +
      richParaXml(`<a:pPr ${hang(0)}><a:buAutoNum type="arabicPeriod"/></a:pPr>`, [{ text: 'Agree the scope', sizePt: 20 }]) +
      richParaXml(`<a:pPr ${hang(0)}><a:buAutoNum type="arabicPeriod"/></a:pPr>`, [{ text: 'Review every slide', sizePt: 20 }])) +
    pageNumber(3));

  // ─── what a correct reading returns ───
  const indent = (level: 0 | 1 | 2): Pick<ParaLabel275, 'indentPx' | 'firstIndentPx'> =>
    ({ indentPx: emuToPx(LEVEL_INDENT[level].marL), firstIndentPx: emuToPx(LEVEL_INDENT[level].indent) });
  const masterBullet = (level: 0 | 1 | 2, runs: SourceRunV1[]): ParaLabel275 => ({
    runs, ...(level > 0 ? { lvl: level } : {}), bullet: 'bullet', bulletChar: LEVEL_GLYPHS[level], bulletSource: 'master', ...indent(level),
  });
  const numbered = (n: number, text: string): ParaLabel275 => ({
    runs: [{ text, sizePt: 20 }], bullet: 'number', numberStyle: 'arabicPeriod', number: n, bulletSource: 'slide', ...indent(0),
  });
  // The master title style states `algn="l"`, so a title with no alignment of its own reads as left.
  const titleParas = (text: string): ParaLabel275[] => [{ runs: [{ text, sizePt: 36 }], align: 'left', bullet: 'none', bulletSource: 'layout' }];

  const bandSpec: AuthoredSpec = { authored: 'band', origin: 'slide', kind: 'shape', class: 'decoration', fidelity: { state: 'editable' }, boxPx: BAND, note: 'the same full-width band near the top of every slide' };
  const numberSpec: AuthoredSpec = { authored: 'page-number', origin: 'slide', kind: 'text', class: 'page-number', fidelity: { state: 'editable' }, boxPx: NUM_BOX };
  const titleSpec = (paras: ParaLabel275[], note?: string): AuthoredSpec & { paras: ParaLabel275[] } => ({
    authored: 'title', origin: 'slide', kind: 'text', class: 'title', fidelity: { state: 'editable' }, boxPx: TITLE_BOX, mustKeep: true, paras, ...(note ? { note } : {}),
  });
  const bodySpec = (paras: ParaLabel275[], note: string): AuthoredSpec & { paras: ParaLabel275[] } => ({
    authored: 'body', origin: 'slide', kind: 'text', class: 'body', fidelity: { state: 'editable' }, boxPx: BODY_BOX, mustKeep: true, paras, note,
  });

  const specs: Array<Array<AuthoredSpec & { paras?: ParaLabel275[] }>> = [
    [
      bandSpec,
      titleSpec(titleParas('Quarterly review')),
      bodySpec([
        masterBullet(0, [{ text: 'Inherits its bullet from the master', sizePt: 20 }]),
        masterBullet(0, [{ text: 'So does this line', sizePt: 20 }]),
      ], 'no a:pPr on either paragraph: the bullet glyph and the hanging indent come from the master body style alone'),
      numberSpec,
    ],
    [
      bandSpec,
      titleSpec([{
        runs: [
          { text: 'Plain ', sizePt: 36 },
          { text: 'Bold', sizePt: 36, bold: true },
          { text: ' Italic', sizePt: 36, italic: true },
          { text: ' Under', sizePt: 36, underline: true },
          { text: ' Strike', sizePt: 36, strike: true },
          { text: ' Red', sizePt: 36, color: { hex: '#C00000' } },
          { text: ' Small', sizePt: 20 },
        ],
        align: 'center', bullet: 'none', bulletSource: 'layout',
      }], 'seven runs, one property each; the last is smaller than the line around it'),
      bodySpec([
        { runs: [{ text: 'First bullet with ', sizePt: 20 }, { text: 'bold', sizePt: 20, bold: true }, { text: ' inside', sizePt: 20 }], bullet: 'bullet', bulletChar: BULLET_DOT, bulletSource: 'slide', lineSpacingPct: 150, spaceBeforePt: 12, ...indent(0) },
        { runs: [{ text: 'Nested second level', sizePt: 18 }], lvl: 1, bullet: 'bullet', bulletChar: BULLET_DASH, bulletSource: 'slide', ...indent(1) },
        numbered(1, 'Numbered one'),
        numbered(2, 'Numbered two'),
        {
          runs: [
            { text: 'Right aligned no bullet ', sizePt: 20 },
            { text: 'E=mc', sizePt: 20 },
            { text: '2', sizePt: 20, baseline: 'super' },
            { text: ' H', sizePt: 20 },
            { text: '2', sizePt: 20, baseline: 'sub' },
            { text: 'O ', sizePt: 20 },
            { text: 'caps', sizePt: 20, case: 'upper' },
          ],
          align: 'right', bullet: 'none', bulletSource: 'slide', ...indent(0),
        },
        {
          runs: [
            { text: 'Visit ', sizePt: 20 },
            { text: 'lolly.tools', sizePt: 20, underline: true, href: 'https://lolly.tools/' },
            { text: ' for more, in ', sizePt: 20 },
            { text: 'Georgia', sizePt: 20, font: 'Georgia', fontProvenance: 'literal' },
          ],
          align: 'justify', bullet: 'none', bulletSource: 'slide', ...indent(0),
        },
      ], 'every paragraph property the slide states itself; the two buNone lines stop the bullet the master would otherwise give them and keep its level-one indent, which they do not override'),
      numberSpec,
    ],
    [
      bandSpec,
      titleSpec(titleParas('Lists through the cascade')),
      bodySpec([
        masterBullet(0, [{ text: 'Scope:', sizePt: 20, bold: true }, { text: ' what the renovation changes', sizePt: 20 }]),
        masterBullet(0, [{ text: 'Owner:', sizePt: 20, bold: true }, { text: ' the team that holds the design system', sizePt: 20 }]),
        masterBullet(1, [{ text: 'Second level from the master', sizePt: 18 }]),
        masterBullet(2, [{ text: 'Third level from the master', sizePt: 16 }]),
        { runs: [{ text: 'Source: annual survey, page 12', sizePt: 14, italic: true }], bullet: 'none', bulletSource: 'slide', ...indent(0) },
        numbered(1, 'Agree the scope'),
        numbered(2, 'Review every slide'),
      ], 'bold lead-ins, three levels whose glyphs and indents all come from the master, an italic citation whose explicit buNone keeps the indent but stops the bullet, and a numbered list'),
      numberSpec,
    ],
  ];

  const slideLabels: SlideLabel275[] = specs.map((slideSpecs, i) => ({
    id: `slide${i + 1}`, index: i, widthPx: DECK_W, heightPx: DECK_H, flattened: false,
    objects: labelObjects(`slide${i + 1}`, partText(parts, `ppt/slides/slide${i + 1}.xml`), slideSpecs),
  }));

  return { bytes: zipParts(parts), labels: finishLabels('formatting.pptx', PPTX_ID_FORM, slideLabels, []) };
}

// ─── fixture: structures.pptx ────────────────────────────────────────────────

/**
 * A photo-like picture of its own: every picture on a slide has to differ in its
 * bytes, or the census reads the same bytes on several objects as a repeated mark.
 */
function tintedPhotoPng(seed: number, tint: [number, number, number]): Uint8Array {
  const w = 128, h = 72;
  const noise = rng(seed);
  return packPng(rgba(w, h, (x, y) => {
    const u = x / (w - 1);
    const v = y / (h - 1);
    const grain = (noise() - 0.5) * 26;
    const clamp = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
    return [clamp(tint[0] + 90 * u + 30 * v + grain), clamp(tint[1] + 50 * v + 30 * (1 - u) + grain), clamp(tint[2] - 50 * u + 50 * v + grain), 255];
  }), { width: w, height: h, channels: 4 });
}

/**
 * A layout with a title and a page number only: the "Headline" a real template
 * hangs every structure off, which is why the matcher reads geometry and treats a
 * layout name as a prior and nothing more (plan 275 section 3.2).
 */
const HEADLINE_LAYOUT: PptxLayout = {
  name: 'Headline',
  placeholders: [
    { type: 'title', x: px(64), y: px(40), cx: px(1152), cy: px(90) },
    { type: 'sldNum', idx: 12, x: px(1150), y: px(660), cx: px(60), cy: px(30) },
  ],
};

const HEADLINE_TITLE: BoxPx = { x: 64, y: 40, w: 1152, h: 90 };
const HEADLINE_NUMBER: BoxPx = { x: 1150, y: 660, w: 60, h: 30 };

/** One authored object on a structures slide: the shape the writer emits beside its label. */
interface Placed {
  shape: PptxSlide['shapes'][number];
  spec: AuthoredSpec & { role?: UnitRole275 };
  /** The unit it belongs to, counted from 0 in reading order. */
  unit?: number;
}

interface StructureSlideSpec {
  title: string;
  media: PptxSlide['media'];
  placed: Placed[];
  structure: Omit<StructureLabel275, 'units'>;
}

const textShape = (box: BoxPx, paras: PptxPara[]): PptxSlide['shapes'][number] =>
  ({ kind: 'text', x: px(box.x), y: px(box.y), cx: px(box.w), cy: px(box.h), paras });

const oneRun = (text: string, sizePt: number, bold = false): PptxPara => ({ runs: [{ text, sizePt, ...(bold ? { bold: true } : {}) }] });

/** A text object that is content inside a structure. */
const unitText = (authored: string, box: BoxPx, role: UnitRole275, unit: number, paras: PptxPara[], note?: string): Placed => ({
  shape: textShape(box, paras),
  spec: { authored, origin: 'slide', kind: 'text', class: 'body', fidelity: { state: 'editable' }, boxPx: box, mustKeep: true, role, ...(note ? { note } : {}) },
  unit,
});

function structureSlides(photos: Uint8Array[]): StructureSlideSpec[] {
  const out: StructureSlideSpec[] = [];

  // 1. Three columns: a heading over a paragraph in each, drawn as separate boxes
  //    that do not quite line up, the way hand-placed columns are.
  {
    const cols = [
      { x: 64, w: 356, y: 188, head: 'Speed', body: 'Teams want the first draft in minutes, not days, and they want it to look finished enough to share with a customer on the same call.' },
      { x: 466, w: 364, y: 194, head: 'Clarity', body: 'People read a slide in a few seconds, so each one should carry one idea, set in type that is large enough to read from the back of a room.' },
      { x: 874, w: 342, y: 184, head: 'Trust', body: 'Every mark, colour and face comes from the design system, so nobody has to check a deck by hand before it goes out to a partner.' },
    ];
    out.push({
      title: 'Three things we heard',
      media: [],
      placed: cols.flatMap((c, i) => [
        unitText(`column-${i + 1}-heading`, { x: c.x, y: c.y, w: c.w, h: 40 }, 'label', i, [oneRun(c.head, 24, true)]),
        unitText(`column-${i + 1}-body`, { x: c.x, y: c.y + 54, w: c.w, h: 200 }, 'body', i, [oneRun(c.body, 16)]),
      ]),
      structure: {
        id: 'columns-3', read: 'columns-3', band: 'clear',
        evidence: 'Three text columns side by side, about the same width and lined up; each is a heading over a paragraph in two boxes, which read as one block.',
      },
    });
  }

  // 2. Four cards: a filled panel holding one text box of a label and a line.
  {
    const cards = [
      { x: 64, w: 268, y: 184, h: 400, head: 'Import', body: 'Drop in a deck or a pdf and every slide is read, kept and listed.' },
      { x: 356, w: 272, y: 188, h: 392, head: 'Review', body: 'Keep, replace or remove each object, with the reason stated.' },
      { x: 652, w: 268, y: 184, h: 400, head: 'Restyle', body: 'The design system supplies the type, colour and marks.' },
      { x: 944, w: 272, y: 186, h: 396, head: 'Export', body: 'Open the result in Design or save it as a new deck.' },
    ];
    out.push({
      title: 'Four ways in',
      media: [],
      placed: cards.flatMap((c, i): Placed[] => {
        const card: BoxPx = { x: c.x, y: c.y, w: c.w, h: c.h };
        const inner: BoxPx = { x: c.x + 20, y: c.y + 24, w: c.w - 40, h: c.h - 48 };
        return [
          {
            shape: { kind: 'rect', x: px(card.x), y: px(card.y), cx: px(card.w), cy: px(card.h), fill: { solid: '#E8EAEE' }, radius: px(12) },
            spec: { authored: `card-${i + 1}`, origin: 'slide', kind: 'shape', class: 'decoration', fidelity: { state: 'editable' }, boxPx: card, role: 'container', note: 'a card panel: a container for the layout read even when the plan removes it as decoration (plan 275 decision 7)' },
            unit: i,
          },
          unitText(`card-${i + 1}-text`, inner, 'body', i, [oneRun(c.head, 22, true), oneRun(c.body, 15)], 'a label paragraph and a body paragraph in one box, wholly inside its card'),
        ];
      }),
      structure: {
        id: 'columns-4', read: 'columns-4', band: 'clear',
        evidence: 'Four cards side by side, about the same width and lined up, each holding a label and a line of text.',
      },
    });
  }

  // 3. A two by two grid of text boxes, a bold heading over a paragraph in each.
  {
    const cells = [
      { x: 64, y: 176, w: 560, h: 190, head: 'Meetings', body: 'Most of the week goes to meetings that could have been a short written update shared before lunch.' },
      { x: 656, y: 180, w: 560, h: 186, head: 'Searching', body: 'Finding the latest version of a file takes longer than it should, because copies live in four places.' },
      { x: 64, y: 416, w: 556, h: 194, head: 'Rework', body: 'Slides are rebuilt by hand when the design system changes, one deck at a time, by whoever made them.' },
      { x: 656, y: 420, w: 560, h: 190, head: 'Review', body: 'Approvals wait on one person who checks colours and marks by eye before anything goes out.' },
    ];
    out.push({
      title: 'Where the time goes',
      media: [],
      placed: cells.map((c, i) => unitText(`cell-${i + 1}`, { x: c.x, y: c.y, w: c.w, h: c.h }, 'body', i, [oneRun(c.head, 22, true), oneRun(c.body, 16)])),
      structure: {
        id: 'grid-2x2', read: 'grid-2x2', band: 'clear',
        evidence: 'Four text boxes in two rows of two, about the same size, their left edges lined up.',
      },
    });
  }

  // 4. A stats row: three figures in large type, a caption under each.
  {
    const stats = [
      { x: 64, y: 214, figure: '42%', caption: 'of orders ship on the day they are placed' },
      { x: 478, y: 220, figure: '3.1M', caption: 'people reached by the spring campaign' },
      { x: 884, y: 210, figure: '18', caption: 'countries with a local partner' },
    ];
    out.push({
      title: 'The year in numbers',
      media: [],
      placed: stats.flatMap((s, i) => [
        unitText(`figure-${i + 1}`, { x: s.x, y: s.y, w: 332, h: 90 }, 'number', i, [oneRun(s.figure, 54, true)]),
        unitText(`caption-${i + 1}`, { x: s.x, y: s.y + 100, w: 332, h: 56 }, 'caption', i, [oneRun(s.caption, 16)]),
      ]),
      structure: {
        id: 'stats-3', read: 'stats-3', band: 'clear',
        evidence: 'Three figures in large type side by side, each with a short caption under it.',
      },
    });
  }

  // 5. An image row: three different pictures side by side, no captions.
  {
    const pics = [
      { x: 64, y: 220, w: 336, h: 210, name: 'site-north' },
      { x: 470, y: 226, w: 340, h: 204, name: 'site-harbour' },
      { x: 880, y: 216, w: 336, h: 212, name: 'site-hill' },
    ];
    out.push({
      title: 'Three sites',
      media: photos.slice(0, 3).map((bytes) => ({ bytes, ext: 'png' as const })),
      placed: pics.map((p, i): Placed => ({
        shape: { kind: 'pic', x: px(p.x), y: px(p.y), cx: px(p.w), cy: px(p.h), media: i, name: p.name },
        spec: { authored: p.name, origin: 'slide', kind: 'pic', class: 'photo', fidelity: { state: 'raster-preserved' }, boxPx: { x: p.x, y: p.y, w: p.w, h: p.h }, mustKeep: true, role: 'visual', note: 'its own seeded bytes, so no two pictures on the slide read as one repeated mark' },
        unit: i,
      })),
      structure: {
        id: 'images-3', read: 'image-row-3', band: 'clear',
        evidence: 'Three pictures side by side, about the same size and lined up, and nothing else on the slide but the title.',
      },
    });
  }

  // 6. A table drawn with text boxes. The columns differ in width, as a table's do,
  //    so the cells do not also read as a grid of equal boxes.
  {
    const colX = [64, 432, 672, 912];
    const colW = [352, 224, 224, 304];
    const rows = [
      ['Region', 'First quarter', 'Second quarter', 'Owner'],
      ['North', 'Launch', 'Grow', 'Ana'],
      ['South', 'Pilot', 'Launch', 'Ben'],
      ['East', 'Plan', 'Pilot', 'Chen'],
      ['West', 'Launch', 'Review', 'Dara'],
    ];
    out.push({
      title: 'Plan by region',
      media: [],
      placed: rows.flatMap((cells, r) => cells.map((text, c) => unitText(
        `cell-r${r + 1}c${c + 1}`,
        { x: colX[c] ?? 0, y: 184 + r * 64, w: colW[c] ?? 0, h: 36 },
        'data', r, [oneRun(text, 16, r === 0)],
      ))),
      structure: {
        id: 'table', read: 'table', band: 'clear',
        evidence: 'Twenty text boxes whose left edges line up in four columns over five rows, one type size throughout: a table drawn with text boxes.',
      },
    });
  }

  // 7. A picture laid over the right half of a full-width body, the lazy way many
  //    decks draw "text left, picture right".
  {
    const body: BoxPx = { x: 64, y: 176, w: 1152, h: 420 };
    const pic: BoxPx = { x: 700, y: 200, w: 480, h: 300 };
    out.push({
      title: 'A picture over half the body',
      media: [{ bytes: photos[3] ?? new Uint8Array(), ext: 'png' }],
      placed: [
        unitText('wide-body', body, 'body', 0, [
          oneRun('The text box runs the full width of the slide.', 20),
          oneRun('Its lines are short, so they stay on the left.', 20),
          oneRun('The picture was dropped on top of the right half.', 20),
        ], 'full width, with the picture laid over its right half'),
        {
          shape: { kind: 'pic', x: px(pic.x), y: px(pic.y), cx: px(pic.w), cy: px(pic.h), media: 0, name: 'laid-over-photo' },
          spec: { authored: 'laid-over-photo', origin: 'slide', kind: 'pic', class: 'photo', fidelity: { state: 'raster-preserved' }, boxPx: pic, mustKeep: true, role: 'visual' },
          unit: 1,
        },
      ],
      structure: {
        id: 'text-and-image', read: 'text-and-image', band: 'likely',
        evidence: 'One picture on the right with text beside it, but the text box runs under the picture, so the read carries the overlap penalty and is proposed rather than applied.',
      },
    });
  }

  // 8. Lettered rows, the MEDDPICC slide 3 case: a one-letter label box in a narrow
  //    column and a longer line to its right, stacked. The rows sit far enough
  //    apart that the letters do not merge into one block.
  {
    const rows = [
      { letter: 'P', text: 'Purpose, the one outcome the work serves and who it serves.' },
      { letter: 'L', text: 'Limits, the time, money and people the work may use.' },
      { letter: 'A', text: 'Actions, the steps in order, each with a name against it.' },
      { letter: 'N', text: 'Next, the date the plan is looked at again and by whom.' },
    ];
    out.push({
      title: 'What PLAN stands for',
      media: [],
      placed: rows.flatMap((row, i) => {
        const y = 176 + i * 112;
        return [
          unitText(`letter-${row.letter}`, { x: 80, y, w: 64, h: 70 }, 'number', i, [oneRun(row.letter, 40, true)], 'a one-letter label in its own box; a correct plan keeps it with its row rather than proposing it for removal'),
          unitText(`row-${i + 1}`, { x: 168, y: y + 4, w: 1000, h: 62 }, 'body', i, [oneRun(row.text, 18)]),
        ];
      }),
      structure: {
        id: 'numbered-rows', read: 'stack-4', band: 'clear',
        evidence: 'Four rows stacked in one column, left edges lined up, each starting with a single letter and a longer line just to its right.',
      },
    });
  }

  return out;
}

/**
 * One slide per structure plan 275 section 3 names, each labelled with the
 * library id, the matcher rule that reads it, the band a correct matcher reaches
 * and its units in reading order. The geometry is hand-placed and a little
 * uneven on purpose where the rule has a tolerance to test ("similar, not
 * exact"), and the numbers each rule reads are stated in the comments above.
 */
function buildStructures(): { bytes: Uint8Array; labels: FixtureLabels275 } {
  const photos = [
    tintedPhotoPng(275001, [40, 90, 150]),
    tintedPhotoPng(275002, [120, 80, 60]),
    tintedPhotoPng(275003, [60, 120, 70]),
    tintedPhotoPng(275004, [110, 70, 130]),
  ];
  const specs = structureSlides(photos);

  const titleShape = (text: string): PptxSlide['shapes'][number] => ({
    kind: 'text', x: px(HEADLINE_TITLE.x), y: px(HEADLINE_TITLE.y), cx: px(HEADLINE_TITLE.w), cy: px(HEADLINE_TITLE.h),
    ph: { type: 'title' }, paras: [oneRun(text, 32)],
  });
  const numberShape = (n: number): PptxSlide['shapes'][number] => ({
    kind: 'text', x: px(HEADLINE_NUMBER.x), y: px(HEADLINE_NUMBER.y), cx: px(HEADLINE_NUMBER.w), cy: px(HEADLINE_NUMBER.h),
    ph: { type: 'sldNum', idx: 12 }, paras: [oneRun(String(n), 12)],
  });

  const slides: PptxSlide[] = specs.map((spec, i) => ({
    layout: 0,
    media: spec.media,
    shapes: [titleShape(spec.title), ...spec.placed.map((p) => p.shape), numberShape(i + 1)],
  }));

  const parts = buildPptxParts(slides, {
    emuW: px(DECK_W), emuH: px(DECK_H), now: NOW, layouts: [HEADLINE_LAYOUT],
    meta: { title: 'Rebrand fixture: structures' },
  });

  const slideLabels: SlideLabel275[] = specs.map((spec, i) => {
    const partId = `slide${i + 1}`;
    const authored: Array<AuthoredSpec & { role?: UnitRole275 }> = [
      { authored: 'title', origin: 'slide', kind: 'text', class: 'title', fidelity: { state: 'editable' }, boxPx: HEADLINE_TITLE, mustKeep: true, text: spec.title },
      ...spec.placed.map((p) => p.spec),
      { authored: 'page-number', origin: 'slide', kind: 'text', class: 'page-number', fidelity: { state: 'editable' }, boxPx: HEADLINE_NUMBER },
    ];
    const objects: ObjectLabel275[] = labelObjects(partId, partText(parts, `ppt/slides/${partId}.xml`), authored);
    const unitCount = Math.max(...spec.placed.map((p) => p.unit ?? -1)) + 1;
    const units: string[][] = Array.from({ length: unitCount }, () => []);
    spec.placed.forEach((p, k) => {
      const object = objects[k + 1];
      if (p.unit !== undefined && object) units[p.unit]?.push(object.id);
    });
    const slide: SlideLabel275 = {
      id: partId, index: i, widthPx: DECK_W, heightPx: DECK_H, flattened: false, objects,
      structure: { ...spec.structure, units },
    };
    checkStructure(slide);
    return slide;
  });

  return { bytes: zipParts(parts), labels: finishLabels('structures.pptx', PPTX_ID_FORM, slideLabels, []) };
}

// ─── fixture: vector.pptx (plan 275 decision 32) ─────────────────────────────

/** The chart's box on the slide, and its picture's own size. */
const VECTOR_CHART: BoxPx = { x: 140, y: 200, w: 800, h: 400 };
/** The two freeform parts of a mark drawn as custom geometry, at one box, like an exported lockup. */
const VECTOR_LOCKUP: BoxPx = { x: 48, y: 650, w: 180, h: 40 };
/** The layout's own mark: an SVG picture on the furniture. */
const VECTOR_MARK: BoxPx = { x: 1100, y: 40, w: 120, h: 40 };
const VECTOR_TITLE: BoxPx = { x: 80, y: 80, w: 1120, h: 80 };
const VECTOR_BIG: BoxPx = { x: 140, y: 200, w: 480, h: 360 };
const VECTOR_EMF: BoxPx = { x: 700, y: 200, w: 300, h: 200 };

/**
 * A 400 by 200 chart the way Lolly's own chart tool writes one: a title and a credit
 * line, a style sheet that only names a font, an empty background rectangle, five
 * gridlines at 0.3 opacity, four labels outlined as paths placed by `translate`,
 * three bars named by `data-recolor` in two colours, one plain `<text>`, and a
 * marker inside a turned group. `gradient` adds one bar painted by a gradient,
 * which the reading leaves out with its reason.
 */
function vectorChartSvg(gradient: boolean): string {
  const lines = [100, 170, 240, 310, 380].map((x) => `<line x1="${x}" y1="20" x2="${x}" y2="170" stroke="#999999" stroke-width="1" opacity="0.3"/>`).join('');
  const labels = [52, 102, 152, 185].map((y, i) => `<path transform="translate(${i === 3 ? 300 : 20},${y})" d="M0 0h40v10h-40z M44 0h8v10h-8z" fill="rgb(20, 20, 20)" opacity="0.8"/>`).join('');
  const bars = [
    { y: 40, w: 220, fill: '#1f4e79', name: 'A' },
    { y: 90, w: 150, fill: '#1f4e79', name: 'B' },
    { y: 140, w: 90, fill: '#d65a28', name: 'C' },
  ].map((b) => `<rect x="100" y="${b.y}" width="${b.w}" height="30" rx="4" fill="${b.fill}" data-recolor="${b.name}"/>`).join('');
  return '<svg xmlns="http://www.w3.org/2000/svg" id="c" viewBox="0 0 400 200" width="400" height="200" data-lolly-anno="fixture">' +
    '<title>bar chart</title><desc>Source: rebrand fixture data (CC0-1.0).</desc>' +
    `<defs><style>#c text { font-family: 'Fixture Sans', sans-serif; }</style>${gradient ? '<linearGradient id="g"><stop offset="0" stop-color="#1f4e79"/><stop offset="1" stop-color="#d65a28"/></linearGradient>' : ''}</defs>` +
    '<rect id="bg" width="400" height="200" fill="none" pointer-events="all"/>' +
    `<g id="plot"><g class="value-axis">${lines}</g><g class="cat-axis">${labels}</g><g>${bars}</g>` +
    '<text x="200" y="195" font-size="12" text-anchor="middle" fill="#333333">Revenue</text>' +
    '<g transform="rotate(45 360 40)"><path d="M350 30h20v20h-20z" fill="#106e60"/></g></g>' +
    (gradient ? '<rect x="330" y="140" width="40" height="30" fill="url(#g)"/>' : '') +
    '</svg>';
}

/** A mark the layout places, with a provenance manifest in its metadata that the reading ignores. */
function vectorMarkSvg(): string {
  return '<svg xmlns="http://www.w3.org/2000/svg" xmlns:c2pa="https://c2pa.org/manifest" viewBox="0 0 120 40" width="120" height="40">' +
    '<metadata><c2pa:manifest>fixture</c2pa:manifest></metadata>' +
    '<path d="M0 0h40v40h-40z" fill="#0c322c"/><path d="M50 10h70v20h-70z" fill="#30ba78"/></svg>';
}

/** More parts than `VECTOR_ITEMS_MAX` allows, so the reading refuses and the picture stays. */
function vectorCrowdSvg(): string {
  let paths = '';
  for (let i = 0; i < 2100; i++) paths += `<path d="M${(i % 60) * 8} ${Math.floor(i / 60) * 8}h6v6h-6z" fill="#1f4e79"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 360" width="480" height="360">${paths}</svg>`;
}

/** A small Windows metafile: two filled rectangles. */
function vectorEmf(): Uint8Array {
  const rect = (x: number, y: number, w: number, h: number) => [{ segments: [{ op: 'M' as const, x, y }, { op: 'L' as const, x: x + w, y }, { op: 'L' as const, x: x + w, y: y + h }, { op: 'L' as const, x, y: y + h }], closed: true }];
  return emitEmf({
    width: 300,
    height: 200,
    prims: [
      { type: 'path', subpaths: rect(20, 20, 120, 160), fill: { r: 31, g: 78, b: 121 }, stroke: null, fillRule: 'nonzero' },
      { type: 'path', subpaths: rect(160, 60, 120, 120), fill: { r: 214, g: 90, b: 40 }, stroke: null, fillRule: 'nonzero' },
    ],
  }, { attribution: false });
}

/**
 * A deck whose drawings stay drawings (plan 275 decision 32). Slide 1: the chart as a
 * picture with an SVG beside its PNG, and a two-part lockup drawn as custom geometry.
 * Slide 2: the same chart with one bar painted by a gradient. Slide 3: a drawing of
 * 2,100 parts, past the item cap, and a Windows metafile. The layout carries a mark
 * as an SVG picture, so the furniture path is read too.
 */
function buildVector(): { bytes: Uint8Array; labels: FixtureLabels275 } {
  const enc = new TextEncoder();
  const png = chartFallbackPng();
  const chart = enc.encode(vectorChartSvg(false));
  const graded = enc.encode(vectorChartSvg(true));
  const crowd = enc.encode(vectorCrowdSvg());
  const mark = enc.encode(vectorMarkSvg());
  const layout: PptxLayout = {
    name: 'Title only',
    placeholders: [{ type: 'title', x: px(VECTOR_TITLE.x), y: px(VECTOR_TITLE.y), cx: px(VECTOR_TITLE.w), cy: px(VECTOR_TITLE.h) }],
    media: [{ bytes: logoPng(), ext: 'png' }, { bytes: mark, ext: 'svg' }],
    shapes: [{ kind: 'pic', x: px(VECTOR_MARK.x), y: px(VECTOR_MARK.y), cx: px(VECTOR_MARK.w), cy: px(VECTOR_MARK.h), media: 0, svg: 1, name: 'mark' }],
  };
  const title = (text: string): PptxSlide['shapes'][number] => ({
    kind: 'text', x: px(VECTOR_TITLE.x), y: px(VECTOR_TITLE.y), cx: px(VECTOR_TITLE.w), cy: px(VECTOR_TITLE.h),
    ph: { type: 'title' }, paras: [oneRun(text, 32)],
  });
  const at = (box: BoxPx): { x: number; y: number; cx: number; cy: number } => ({ x: px(box.x), y: px(box.y), cx: px(box.w), cy: px(box.h) });
  const lockW = px(VECTOR_LOCKUP.w);
  const lockH = px(VECTOR_LOCKUP.h);
  const slides: PptxSlide[] = [
    {
      layout: 0,
      media: [{ bytes: png, ext: 'png' }, { bytes: chart, ext: 'svg' }],
      shapes: [
        title('Revenue by region'),
        { kind: 'pic', ...at(VECTOR_CHART), media: 0, svg: 1, name: 'vector' },
        { kind: 'path', ...at(VECTOR_LOCKUP), fill: { solid: '0C322C' }, paths: [{ d: `M0 0L${Math.round(lockH)} 0L${Math.round(lockH)} ${lockH}L0 ${lockH}Z` }] },
        { kind: 'path', ...at(VECTOR_LOCKUP), fill: { solid: '30BA78' }, paths: [{ d: `M${Math.round(lockW * 0.3)} ${Math.round(lockH * 0.25)}L${lockW} ${Math.round(lockH * 0.25)}L${lockW} ${Math.round(lockH * 0.75)}L${Math.round(lockW * 0.3)} ${Math.round(lockH * 0.75)}Z` }] },
      ],
    },
    {
      layout: 0,
      media: [{ bytes: png, ext: 'png' }, { bytes: graded, ext: 'svg' }],
      shapes: [title('The same chart, one bar graded'), { kind: 'pic', ...at(VECTOR_CHART), media: 0, svg: 1, name: 'vector' }],
    },
    {
      layout: 0,
      media: [{ bytes: png, ext: 'png' }, { bytes: crowd, ext: 'svg' }, { bytes: vectorEmf(), ext: 'emf' }],
      shapes: [
        title('Too many parts, and a metafile'),
        { kind: 'pic', ...at(VECTOR_BIG), media: 0, svg: 1, name: 'vector' },
        { kind: 'pic', ...at(VECTOR_EMF), media: 2, name: 'metafile' },
      ],
    },
  ];
  const parts = buildPptxParts(slides, {
    emuW: px(DECK_W), emuH: px(DECK_H), now: NOW, layouts: [layout],
    meta: { title: 'Rebrand fixture: vector' },
  });

  const titleSpec = (text: string): AuthoredSpec => ({ authored: 'title', origin: 'slide', kind: 'text', class: 'title', fidelity: { state: 'editable' }, boxPx: VECTOR_TITLE, mustKeep: true, text });
  const chartSpec = (gradient: boolean): AuthoredSpec & { vector: VectorLabel275 } => ({
    authored: gradient ? 'chart-graded' : 'chart', origin: 'slide', kind: 'vector', class: 'chart',
    fidelity: gradient ? { state: 'approximate', reason: 'reader-approximation' } : { state: 'editable' },
    boxPx: VECTOR_CHART, mustKeep: true,
    note: gradient
      ? 'the chart with one bar painted by a gradient: that part is left out with its reason and the rest stay shapes'
      : 'an SVG chart beside its PNG: fourteen parts, the empty background dropped without a record',
    vector: {
      items: 14,
      ...(gradient ? { omitted: [{ reason: 'unsupported-paint', count: 1 }] } : {}),
      series: ['A', 'B', 'C'],
      title: 'bar chart',
      rows: { box: 3, path: 10, text: 1 },
    },
  });
  const lockSpec = (part: string): AuthoredSpec & { vector: VectorLabel275 } => ({
    authored: part, origin: 'slide', kind: 'shape', class: 'logo-candidate', fidelity: { state: 'editable' }, boxPx: VECTOR_LOCKUP,
    note: 'one part of a mark drawn as custom geometry: it keeps its kind and carries its outline as one item',
    vector: { items: 1, rows: { box: 0, path: 1, text: 0 } },
  });
  const slideSpecs: Array<Array<AuthoredSpec & { vector?: VectorLabel275 }>> = [
    [titleSpec('Revenue by region'), chartSpec(false), lockSpec('lockup-square'), lockSpec('lockup-bar')],
    [titleSpec('The same chart, one bar graded'), chartSpec(true)],
    [
      titleSpec('Too many parts, and a metafile'),
      {
        authored: 'crowd', origin: 'slide', kind: 'vector', class: 'diagram', fidelity: { state: 'raster-preserved', fallbackSource: 'embedded' },
        boxPx: VECTOR_BIG, mustKeep: true,
        note: 'more parts than the item cap: the reading refuses, the picture stays, and the report says why',
        vector: { items: 0, omitted: [{ reason: 'cap-reached', count: 2001 }], keptAsPicture: 'cap-reached' },
      },
      {
        authored: 'metafile', origin: 'slide', kind: 'pic', class: 'diagram', fidelity: { state: 'raster-preserved' },
        boxPx: VECTOR_EMF, mustKeep: true,
        note: 'a Windows metafile: kept as a picture, and the reading says it was not converted',
        vector: { items: 0, warning: 'metafile-not-converted' },
      },
    ],
  ];
  const slideLabels: SlideLabel275[] = slideSpecs.map((specs, i) => ({
    id: `slide${i + 1}`, index: i, widthPx: DECK_W, heightPx: DECK_H, flattened: false,
    objects: labelObjects(`slide${i + 1}`, partText(parts, `ppt/slides/slide${i + 1}.xml`), specs),
  }));
  const inherited = labelObjects('slideLayout1', partText(parts, 'ppt/slideLayouts/slideLayout1.xml'), [{
    authored: 'mark', origin: 'layout', kind: 'vector', class: 'logo-candidate', fidelity: { state: 'editable' }, boxPx: VECTOR_MARK,
    note: 'the layout\'s own mark as an SVG picture, with a provenance manifest in its metadata that the reading leaves aside',
    vector: { items: 2, rows: { box: 0, path: 2, text: 0 } },
  }], isPlaceholderName);

  return { bytes: zipParts(parts), labels: finishLabels('vector.pptx', PPTX_ID_FORM, slideLabels, inherited) };
}

// ─── entry point ─────────────────────────────────────────────────────────────

const MAX_FIXTURE_BYTES = 400 * 1024;

export async function buildRebrandFixtures(outDir: string): Promise<Array<{ name: string; bytes: number }>> {
  await mkdir(outDir, { recursive: true });
  const built = [
    { name: 'simple.pptx', ...buildSimple() },
    { name: 'adversarial.pptx', ...buildAdversarial() },
    { name: 'palette.pptx', ...buildPalette() },
    { name: 'flattened.pdf', ...buildFlattened() },
    { name: 'formatting.pptx', ...buildFormatting() },
    { name: 'structures.pptx', ...buildStructures() },
    { name: 'vector.pptx', ...buildVector() },
  ];
  const written: Array<{ name: string; bytes: number }> = [];
  for (const fixture of built) {
    if (fixture.bytes.length > MAX_FIXTURE_BYTES) {
      throw new Error(`build-rebrand-fixtures: ${fixture.name} is ${fixture.bytes.length} bytes, over the ${MAX_FIXTURE_BYTES} byte limit`);
    }
    await writeFile(path.join(outDir, fixture.name), fixture.bytes);
    const labelsName = `${fixture.name.replace(/\.(pptx|pdf)$/, '')}.labels.json`;
    await writeFile(path.join(outDir, labelsName), `${JSON.stringify(fixture.labels, null, 2)}\n`);
    written.push({ name: fixture.name, bytes: fixture.bytes.length });
  }
  return written;
}

const DEFAULT_OUT = fileURLToPath(new URL('../tests/fixtures/rebrand/', import.meta.url));

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => !arg.startsWith('--out='));
  if (unknown.length > 0) {
    console.error(`build-rebrand-fixtures: ${unknown.join(' ')} is not an option. Usage: node scripts/build-rebrand-fixtures.ts [--out=<dir>]`);
    process.exit(2);
  }
  const outArg = args.find((arg) => arg.startsWith('--out='));
  const outDir = outArg ? path.resolve(outArg.slice('--out='.length)) : DEFAULT_OUT;
  const written = await buildRebrandFixtures(outDir);
  for (const fixture of written) console.log(`${fixture.name}: ${fixture.bytes} bytes`);
  console.log(`wrote ${written.length} fixtures to ${outDir}`);
}
