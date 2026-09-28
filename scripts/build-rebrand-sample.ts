#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Build the sample deck Rebrand offers a first-time user and the docs screenshots
 * open: `shells/web/public/samples/rebrand/harbourside-night-market.pptx`.
 *
 * It stands in for "a deck someone else made": a fictional night market's season
 * review in its own old brand (plum and marigold, Georgia and Verdana), with the
 * things a real deck carries and Rebrand has to sort out. A mark and a footer sit on
 * the layouts, so every slide shows them and no slide declares them. There is a
 * title slide, a bulleted slide, three cards, a chart drawn as plain shapes, a photo
 * with a caption, a native table, a section divider, two columns and a closing slide.
 * Every name, figure and address is invented; the contact uses the reserved
 * `.example` domain.
 *
 * The build is reproducible in the way scripts/build-rebrand-fixtures.ts is: one
 * fixed zip time, sorted parts stored rather than deflated, a fixed `now` for the
 * pptx writer and pictures painted by code, with no font file, canvas, clock or
 * random number anywhere. `tests/rebrand-sample.test.ts` rebuilds the deck into a scratch directory
 * and compares the bytes with the committed file.
 *
 * Usage: node scripts/build-rebrand-sample.ts [--out=<file>]
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { zipSync } from 'fflate';

import { buildPptxParts, EMU_PER_PX, type PptxLayout, type PptxPara, type PptxShape, type PptxSlide, type PptxTheme } from '../engine/src/pptx.ts';
import { packPng } from '../engine/src/png.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/** Where the web shell serves the sample from, relative to the repository root. */
export const SAMPLE_DECK_PATH = 'shells/web/public/samples/rebrand/harbourside-night-market.pptx';

const ZIP_MTIME = '2026-01-01T00:00:00';
const NOW = '2026-01-01T00:00:00Z';
const W = 1280;
const H = 720;

const PLUM = '#4A1D5C';
const MARIGOLD = '#F5A623';
const TEAL = '#1B8A8C';
const CREAM = '#FFF8EC';
const INK = '#2B2233';
const HEAD_FONT = 'Georgia';
const BODY_FONT = 'Verdana';

const px = (n: number): number => Math.round(n * EMU_PER_PX);

// ─── pictures ────────────────────────────────────────────────────────────────

type Rgba = [number, number, number, number];
const clamp = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

function paint(w: number, h: number, fn: (x: number, y: number) => Rgba): Uint8Array {
  const out = new Uint8Array(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = fn(x, y);
      const i = (y * w + x) * 4;
      out[i] = clamp(r); out[i + 1] = clamp(g); out[i + 2] = clamp(b); out[i + 3] = clamp(a);
    }
  }
  return out;
}

/** Anti-aliased coverage of a disc, 0..1, for a pixel centre. */
function disc(x: number, y: number, cx: number, cy: number, r: number): number {
  return Math.max(0, Math.min(1, r - Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + 0.5));
}

/**
 * The market's mark: a lantern, a rounded body with a cap and a ring, in marigold on
 * a transparent ground. Small and the same on every slide, as a pasted logo is.
 */
function lanternMarkPng(): Uint8Array {
  const s = 96;
  return packPng(paint(s, s, (x, y) => {
    const cx = s / 2;
    const ring = Math.max(0, Math.min(1, 3.2 - Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - 14) - 8)));
    const cap = y >= 22 && y < 30 && Math.abs(x + 0.5 - cx) < 16 ? 1 : 0;
    const bodyDx = Math.abs(x + 0.5 - cx) / 26;
    const bodyDy = Math.abs(y + 0.5 - 58) / 28;
    const body = Math.max(0, Math.min(1, (1 - Math.hypot(bodyDx, bodyDy * 1.05)) * 26));
    const foot = y >= 86 && y < 92 && Math.abs(x + 0.5 - cx) < 12 ? 1 : 0;
    const flame = disc(x, y, cx, 60, 8);
    const a = Math.max(ring, cap, body, foot);
    if (flame > 0 && body > 0) return [mix(245, 255, flame), mix(166, 244, flame), mix(35, 214, flame), 255];
    return [245, 166, 35, 255 * a];
  }), { width: s, height: s });
}

/**
 * The photo on slide five: the harbour at dusk with a string of lanterns over the
 * pier. Painted, not photographed, so the deck carries no one's picture and no
 * licence, and smooth enough to compress to a few kilobytes.
 */
function harbourPhotoPng(): Uint8Array {
  // Painted in a 640 by 360 design space and sampled at 480 by 270, about the size a
  // slide shows it at, so the deck and every screenshot of it stay light.
  const DESIGN_H = 360;
  const S = 640 / 480;
  const w = 480, h = 270;
  const horizon = 214;
  const lanterns: Array<{ x: number; y: number }> = [];
  for (let i = 0; i <= 14; i++) {
    const t = i / 14;
    const x = 36 + t * 568;
    const sag = 34 * Math.sin(Math.PI * t);
    lanterns.push({ x, y: 64 + sag });
  }
  const boats = [
    { x: 118, y: horizon + 26, w: 70 },
    { x: 468, y: horizon + 40, w: 92 },
  ];
  const pixels = paint(w, h, (outX, outY) => {
    const x = outX * S, y = outY * S;
    let r: number, g: number, b: number;
    if (y < horizon) {
      const t = y / horizon;
      r = mix(38, 232, t * t); g = mix(30, 128, t * t); b = mix(84, 96, t);
      const sun = disc(x, y, 420, horizon - 8, 26);
      r = mix(r, 255, sun * 0.9); g = mix(g, 196, sun * 0.9); b = mix(b, 120, sun * 0.9);
    } else {
      const t = (y - horizon) / (DESIGN_H - horizon);
      r = mix(96, 24, t); g = mix(60, 34, t); b = mix(96, 70, t);
      const streak = Math.max(0, 1 - Math.abs(x - 420) / (18 + 60 * t)) * (0.6 - 0.4 * t);
      r = mix(r, 250, streak); g = mix(g, 170, streak); b = mix(b, 90, streak);
    }
    for (const boat of boats) {
      const inHull = y >= boat.y && y < boat.y + 10 && x >= boat.x + (y - boat.y) && x < boat.x + boat.w - (y - boat.y);
      const inMast = x >= boat.x + boat.w / 2 - 1 && x < boat.x + boat.w / 2 + 1 && y >= boat.y - 46 && y < boat.y;
      const sailSpan = (boat.y - y) / 44;
      const inSail = y < boat.y - 2 && y >= boat.y - 44 && x >= boat.x + boat.w / 2 + 2 && x < boat.x + boat.w / 2 + 2 + 30 * (1 - sailSpan);
      if (inHull || inMast || inSail) { r = 26; g = 20; b = 40; }
    }
    const pier = y >= horizon + 58 && y < horizon + 66 ? 1 : 0;
    const post = y >= horizon + 58 && y < horizon + 110 && (Math.floor(x) % 80) < 5 ? 1 : 0;
    if (pier || post) { r = 30; g = 22; b = 36; }
    let wire = 0;
    for (let i = 0; i < lanterns.length - 1; i++) {
      const a = lanterns[i]!, c = lanterns[i + 1]!;
      if (x >= a.x && x < c.x) {
        const t = (x - a.x) / (c.x - a.x);
        const wy = mix(a.y, c.y, t) - 6;
        wire = Math.max(wire, Math.max(0, 1 - Math.abs(y - wy)));
      }
    }
    r = mix(r, 20, wire * 0.8); g = mix(g, 16, wire * 0.8); b = mix(b, 28, wire * 0.8);
    for (const lamp of lanterns) {
      const glow = Math.max(0, 1 - Math.hypot(x - lamp.x, y - lamp.y) / 22) ** 2;
      const core = disc(x, y, lamp.x, lamp.y, 5);
      r = mix(r, 255, Math.max(glow * 0.55, core)); g = mix(g, 214, Math.max(glow * 0.5, core)); b = mix(b, 140, Math.max(glow * 0.3, core * 0.8));
    }
    return [r, g, b, 255];
  });
  return packPng(opaqueRgb(pixels), { width: w, height: h, channels: 3 });
}

/** Drop the alpha channel of an opaque RGBA picture, a quarter of its bytes. */
function opaqueRgb(rgbaPixels: Uint8Array): Uint8Array {
  const out = new Uint8Array((rgbaPixels.length / 4) * 3);
  for (let i = 0, o = 0; i < rgbaPixels.length; i += 4, o += 3) {
    out[o] = rgbaPixels[i]!; out[o + 1] = rgbaPixels[i + 1]!; out[o + 2] = rgbaPixels[i + 2]!;
  }
  return out;
}

// ─── text helpers ────────────────────────────────────────────────────────────

function run(text: string, sizePt: number, opts: { color?: string; bold?: boolean; italic?: boolean; font?: string } = {}) {
  return { text, sizePt, font: opts.font ?? BODY_FONT, ...(opts.color ? { color: opts.color } : {}), ...(opts.bold ? { bold: true } : {}), ...(opts.italic ? { italic: true } : {}) };
}

/** 2400 as "2,400", written out so the bytes never depend on the machine's locale data. */
function thousands(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function heading(text: string, sizePt: number, color: string, align: PptxPara['align'] = 'l'): PptxPara {
  return { runs: [run(text, sizePt, { color, font: HEAD_FONT, bold: true })], align };
}

function bullets(lines: string[], sizePt = 20, color = INK): PptxPara[] {
  return lines.map((line) => ({ runs: [run(line, sizePt, { color })], bullet: true, bulletColor: MARIGOLD, spaceAfterPt: 10 }));
}

function text(x: number, y: number, w: number, h: number, paras: PptxPara[], extra: Partial<Extract<PptxShape, { kind: 'text' }>> = {}): PptxShape {
  return { kind: 'text', x: px(x), y: px(y), cx: px(w), cy: px(h), paras, ...extra };
}

function rect(x: number, y: number, w: number, h: number, color: string, radius?: number): PptxShape {
  return { kind: 'rect', x: px(x), y: px(y), cx: px(w), cy: px(h), fill: { solid: color }, ...(radius ? { radius: px(radius) } : {}) };
}

function pageNumber(n: number): PptxShape {
  return text(1170, 668, 70, 28, [{ runs: [run(String(n), 11, { color: PLUM })], align: 'r' }], { ph: { type: 'sldNum', idx: 12 } });
}

// ─── layouts ─────────────────────────────────────────────────────────────────

const FOOTER = 'Harbourside Night Market  |  Season review 2025';

/** Title and closing slides: a plum ground, a marigold rule and the mark. */
const titleLayout: PptxLayout = {
  name: 'Title',
  bg: { solid: PLUM },
  media: [],
  shapes: [
    rect(0, 640, W, 16, MARIGOLD),
    { kind: 'pic', x: px(96), y: px(96), cx: px(96), cy: px(96), media: 0, name: 'Lantern mark' },
  ],
  placeholders: [
    { type: 'ctrTitle', x: px(96), y: px(250), cx: px(1000), cy: px(140), style: { font: HEAD_FONT, sizePt: 54, color: '#FFFFFF' } },
    { type: 'subTitle', idx: 1, x: px(96), y: px(400), cx: px(1000), cy: px(80), style: { font: BODY_FONT, sizePt: 24, color: MARIGOLD } },
  ],
};

/** Content slides: a cream ground, a plum header band, the footer and the mark. */
const contentLayout: PptxLayout = {
  name: 'Content',
  bg: { solid: CREAM },
  media: [],
  shapes: [
    rect(0, 0, W, 12, PLUM),
    rect(80, 150, 120, 6, MARIGOLD),
    { kind: 'pic', x: px(80), y: px(656), cx: px(40), cy: px(40), media: 0, name: 'Lantern mark' },
    text(132, 664, 700, 28, [{ runs: [run(FOOTER, 11, { color: PLUM })] }]),
  ],
  placeholders: [
    { type: 'title', x: px(80), y: px(56), cx: px(1120), cy: px(84), style: { font: HEAD_FONT, sizePt: 36, color: PLUM } },
    { type: 'body', idx: 1, x: px(80), y: px(190), cx: px(1120), cy: px(430), style: { font: BODY_FONT, sizePt: 20, color: INK, bullet: true } },
    { type: 'sldNum', idx: 12, x: px(1170), y: px(668), cx: px(70), cy: px(28), style: { sizePt: 11, color: PLUM, align: 'r' } },
  ],
};

/** Section dividers: a teal ground and a large heading. */
const sectionLayout: PptxLayout = {
  name: 'Section',
  bg: { solid: TEAL },
  shapes: [rect(96, 420, 160, 8, MARIGOLD)],
  placeholders: [
    { type: 'title', x: px(96), y: px(280), cx: px(1000), cy: px(130), style: { font: HEAD_FONT, sizePt: 48, color: '#FFFFFF' } },
  ],
};

const theme: PptxTheme = {
  name: 'Harbourside',
  colors: { dk1: INK, lt1: '#FFFFFF', dk2: PLUM, lt2: CREAM, accent1: PLUM, accent2: MARIGOLD, accent3: TEAL, accent4: '#C2436B', accent5: '#6C9A3B', accent6: '#8C6D4F' },
  fonts: { major: HEAD_FONT, minor: BODY_FONT },
};

// ─── slides ──────────────────────────────────────────────────────────────────

const TITLE = 0, CONTENT = 1, SECTION = 2;

function titleSlide(title: string, subtitle: string): PptxSlide {
  return {
    layout: TITLE, media: [],
    shapes: [
      text(96, 250, 1000, 140, [heading(title, 54, '#FFFFFF')], { ph: { type: 'ctrTitle' } }),
      text(96, 400, 1000, 80, [{ runs: [run(subtitle, 24, { color: MARIGOLD })] }], { ph: { type: 'subTitle', idx: 1 } }),
    ],
  };
}

function contentTitle(title: string): PptxShape {
  return text(80, 56, 1120, 84, [heading(title, 36, PLUM)], { ph: { type: 'title' } });
}

function glanceSlide(n: number): PptxSlide {
  return {
    layout: CONTENT, media: [],
    shapes: [
      contentTitle('The season at a glance'),
      text(80, 190, 1120, 430, bullets([
        '32 market nights, from the first Friday in May to the last Saturday in September',
        '118 stallholders, 41 of them trading with us for the first time',
        'An average of 2,400 visitors a night, up from 1,900 last season',
        'Two nights moved under the fish hall roof when storms came in',
      ]), { ph: { type: 'body', idx: 1 } }),
      pageNumber(n),
    ],
  };
}

function cardsSlide(n: number): PptxSlide {
  const cards = [
    { head: 'Later closing', body: 'Stalls stayed open until eleven, and the last hour was the busiest of the night.' },
    { head: 'Local music', body: 'Eighteen local acts played, every one booked through the community board.' },
    { head: 'Cashless tills', body: 'Queues moved faster, and stallholders were paid the next morning.' },
  ];
  const shapes: PptxShape[] = [contentTitle('Three things that worked')];
  cards.forEach((card, i) => {
    const x = 80 + i * 380;
    shapes.push(rect(x, 200, 350, 380, '#FFFFFF', 18));
    shapes.push(rect(x, 200, 350, 12, i === 1 ? TEAL : MARIGOLD));
    shapes.push(text(x + 28, 236, 294, 60, [heading(card.head, 24, PLUM)]));
    shapes.push(text(x + 28, 304, 294, 250, [{ runs: [run(card.body, 18, { color: INK })], lineSpacingPct: 120 }]));
  });
  shapes.push(pageNumber(n));
  return { layout: CONTENT, media: [], shapes };
}

/** A column chart drawn as shapes, the way a chart pasted as a picture of shapes arrives. */
function chartSlide(n: number): PptxSlide {
  const months = ['May', 'June', 'July', 'August', 'September'];
  const visitors = [1600, 2100, 2900, 3100, 2300];
  const base = 590, top = 230, left = 180, colW = 150, barW = 86;
  const scale = (v: number): number => ((base - top) * v) / 3200;
  const shapes: PptxShape[] = [contentTitle('Visitors per night, by month')];
  shapes.push(rect(left - 20, base, colW * months.length + 20, 3, INK));
  months.forEach((month, i) => {
    const h = scale(visitors[i]!);
    const x = left + i * colW + (colW - barW) / 2;
    shapes.push(rect(x, base - h, barW, h, i === 3 ? MARIGOLD : PLUM));
    shapes.push(text(x - 20, base - h - 40, barW + 40, 32, [{ runs: [run(thousands(visitors[i]!), 16, { color: INK, bold: true })], align: 'ctr' }]));
    shapes.push(text(x - 30, base + 12, barW + 60, 30, [{ runs: [run(month, 15, { color: INK })], align: 'ctr' }]));
  });
  shapes.push(text(960, 250, 260, 200, [
    { runs: [run('August was our best month yet, with the harbour festival on the first weekend.', 16, { color: INK, italic: true })], lineSpacingPct: 120 },
  ]));
  shapes.push(pageNumber(n));
  return { layout: CONTENT, media: [], shapes };
}

function photoSlide(n: number, photo: Uint8Array): PptxSlide {
  return {
    layout: CONTENT,
    media: [{ bytes: photo, ext: 'png' }],
    shapes: [
      contentTitle('Lanterns on the pier'),
      { kind: 'pic', x: px(80), y: px(190), cx: px(760), cy: px(428), media: 0, name: 'Harbour at dusk' },
      text(880, 200, 320, 400, [
        { runs: [run('The lanterns went up along the pier for the first time this year.', 20, { color: INK })], lineSpacingPct: 125, spaceAfterPt: 14 },
        { runs: [run('Volunteers from the rowing club strung all 300 of them in one afternoon.', 16, { color: TEAL })], lineSpacingPct: 125 },
      ]),
      pageNumber(n),
    ],
  };
}

function tableSlide(n: number): PptxSlide {
  const rows: Array<[string, string, string]> = [
    ['Category', 'Stalls', 'New this season'],
    ['Street food', '64', '19'],
    ['Crafts and makers', '27', '12'],
    ['Drinks', '15', '4'],
    ['Music and games', '12', '6'],
  ];
  const cell = (value: string, header: boolean, align: 'l' | 'r') => ({
    text: value, align, anchor: 'ctr' as const, sizePt: 18, font: BODY_FONT,
    ...(header ? { bold: true, color: '#FFFFFF', fill: PLUM } : { color: INK, fill: '#FFFFFF' }),
  });
  return {
    layout: CONTENT, media: [],
    shapes: [
      contentTitle('Stallholders by category'),
      {
        kind: 'table', x: px(80), y: px(200), cx: px(900), cy: px(360),
        cols: [px(460), px(220), px(220)],
        rows: rows.map((row, r) => ({ h: px(72), cells: row.map((value, c) => cell(value, r === 0, c === 0 ? 'l' : 'r')) })),
        firstRow: true,
      },
      pageNumber(n),
    ],
  };
}

function sectionSlide(title: string): PptxSlide {
  return { layout: SECTION, media: [], shapes: [text(96, 280, 1000, 130, [heading(title, 48, '#FFFFFF')], { ph: { type: 'title' } })] };
}

function columnsSlide(n: number): PptxSlide {
  const column = (x: number, head: string, lines: string[]): PptxShape[] => [
    text(x, 196, 540, 50, [heading(head, 24, TEAL)]),
    text(x, 256, 540, 360, bullets(lines, 18)),
  ];
  return {
    layout: CONTENT, media: [],
    shapes: [
      contentTitle('Plans for next season'),
      ...column(80, 'Keep', ['Friday and Saturday nights', 'Lanterns on the pier', 'Local acts on the bandstand']),
      ...column(660, 'Change', ['A covered area for rainy nights', 'Fewer plastic cups, more returnable ones', 'A quiet hour for families at six']),
      pageNumber(n),
    ],
  };
}

function closingSlide(): PptxSlide {
  return {
    layout: TITLE, media: [],
    shapes: [
      text(96, 250, 1000, 140, [heading('Thank you', 54, '#FFFFFF')], { ph: { type: 'ctrTitle' } }),
      text(96, 400, 1000, 80, [{ runs: [run('hello@harbourside-market.example', 24, { color: MARIGOLD })] }], { ph: { type: 'subTitle', idx: 1 } }),
    ],
  };
}

// ─── the deck ────────────────────────────────────────────────────────────────

/** The deck's bytes. Pure: the same bytes on every machine and in every time zone. */
export function buildRebrandSample(): Uint8Array {
  const mark = lanternMarkPng();
  const photo = harbourPhotoPng();
  const layouts: PptxLayout[] = [
    { ...titleLayout, media: [{ bytes: mark, ext: 'png' }] },
    { ...contentLayout, media: [{ bytes: mark, ext: 'png' }] },
    sectionLayout,
  ];
  const slides: PptxSlide[] = [
    titleSlide('Harbourside Night Market', 'Season review 2025'),
    glanceSlide(2),
    cardsSlide(3),
    chartSlide(4),
    photoSlide(5, photo),
    tableSlide(6),
    sectionSlide('Next season'),
    columnsSlide(8),
    closingSlide(),
  ];
  const parts = buildPptxParts(slides, {
    emuW: px(W), emuH: px(H), now: NOW, theme, layouts,
    meta: { title: 'Harbourside Night Market: season review 2025', author: 'Harbourside Night Market' },
  });
  const enc = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const name of Object.keys(parts).sort()) {
    const value = parts[name];
    if (value === undefined) continue;
    files[name] = typeof value === 'string' ? enc.encode(value) : value;
  }
  return zipSync(files, { level: 0, mtime: ZIP_MTIME });
}

async function main(): Promise<void> {
  const outArg = process.argv.find((a) => a.startsWith('--out='));
  const out = path.resolve(ROOT, outArg ? outArg.slice('--out='.length) : SAMPLE_DECK_PATH);
  const bytes = buildRebrandSample();
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, bytes);
  console.log(`wrote ${path.relative(ROOT, out)} (${bytes.length} bytes)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
