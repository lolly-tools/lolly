#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Build the synthetic picture deck of plan 275 WP10: a pptx whose every slide
 * is one picture of a whole slide, the kind a slide generator exports, plus a
 * labels file saying what each picture shows.
 *
 * Four slides, each drawn in code and each with the same small mark in the
 * bottom right corner (a square and the words MADE WITH GEN):
 *
 *   1. text over a gradient, with a photograph on the right;
 *   2. three cards on a gradient, each an icon over a label;
 *   3. three rows of an icon and two lines, split by rules, beside a callout
 *      drawn as an outlined box;
 *   4. a photograph across the whole slide with its title and one line over it.
 *
 * The labels file lists every line of text drawn, with where each glyph cell
 * starts, so a test can stand in for a recogniser and read back exactly what a
 * crop shows (whole characters inside it), and it states the structure, the
 * pictures and the mark by box, as fractions of the slide.
 *
 * Deterministic: no clock, no locale, a seeded generator for the photographs,
 * zip entries in sorted order, stored, at one fixed time. The test rebuilds into
 * a scratch directory and compares the bytes.
 *
 * Usage: node scripts/build-rebrand-picture-fixtures.ts [--out=<dir>]
 * (default tests/fixtures/rebrand-pictures/)
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { zipSync } from 'fflate';

import { buildPptxParts, EMU_PER_PX, type PptxSlide } from '../engine/src/pptx.ts';
import { packPng } from '../engine/src/png.ts';

// ─── fixed inputs ────────────────────────────────────────────────────────────

const ZIP_MTIME = '2026-01-01T00:00:00';
const ZIP_LEVEL = 0;
const NOW = '2026-01-01T00:00:00Z';
const W = 1280;
const H = 720;
const px = (v: number): number => Math.round(v * EMU_PER_PX);

type Rgb = [number, number, number];

/** Mulberry32: a small seeded generator, so a photograph is the same on every run. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── the bitmap face ─────────────────────────────────────────────────────────

/** Five by seven glyphs for the capitals, the figures used and the full stop. */
const GLYPHS: Record<string, string[]> = {
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#...#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
};

/** One line of text as drawn: what the labels hand a stand-in recogniser. */
export interface DrawnLineV1 {
  text: string;
  /** Top left of the first glyph cell, in slide px. */
  x: number;
  y: number;
  /** Pixels per glyph dot: a glyph is 5 by 7 dots on a 6 dot advance. */
  scale: number;
  /** The ink box of the whole line. */
  box: { x: number; y: number; w: number; h: number };
}

class Canvas {
  readonly data = new Uint8Array(W * H * 4);
  readonly lines: DrawnLineV1[] = [];

  fill(paint: (x: number, y: number) => Rgb): void {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) this.set(x, y, paint(x, y));
  }

  set(x: number, y: number, c: Rgb): void {
    if (x < 0 || y < 0 || x >= W || y >= H) throw new Error(`build-rebrand-picture-fixtures: (${x}, ${y}) is off the ${W} by ${H} slide`);
    const i = (y * W + x) * 4;
    this.data[i] = c[0];
    this.data[i + 1] = c[1];
    this.data[i + 2] = c[2];
    this.data[i + 3] = 255;
  }

  rect(x: number, y: number, w: number, h: number, c: Rgb): void {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }

  /** An outline `t` px thick around the box, inside it. */
  frame(x: number, y: number, w: number, h: number, t: number, c: Rgb): void {
    this.rect(x, y, w, t, c);
    this.rect(x, y + h - t, w, t, c);
    this.rect(x, y, t, h, c);
    this.rect(x + w - t, y, t, h, c);
  }

  ring(cx: number, cy: number, r: number, t: number, c: Rgb): void {
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        const d = Math.hypot(x - cx, y - cy);
        if (d <= r && d >= r - t) this.set(x, y, c);
      }
    }
  }

  text(text: string, x: number, y: number, scale: number, ink: Rgb): void {
    let cursor = x;
    let right = x;
    for (const ch of text) {
      const glyph = GLYPHS[ch];
      if (!glyph) throw new Error(`build-rebrand-picture-fixtures: no glyph for ${JSON.stringify(ch)}`);
      glyph.forEach((row, gy) => {
        for (let gx = 0; gx < row.length; gx++) {
          if (row[gx] !== '#') continue;
          this.rect(cursor + gx * scale, y + gy * scale, scale, scale, ink);
          right = Math.max(right, cursor + (gx + 1) * scale);
        }
      });
      cursor += 6 * scale;
    }
    this.lines.push({ text, x, y, scale, box: { x, y, w: right - x, h: 7 * scale } });
  }

  png(): Uint8Array {
    return packPng(this.data, { width: W, height: H, channels: 4 });
  }
}

/** A photograph stand-in: soft colour fields with grain, which reads as continuous tone. */
function photo(c: Canvas, x0: number, y0: number, w: number, h: number, seed: number): void {
  const next = rng(seed);
  const blobs = Array.from({ length: 5 }, () => ({ x: next() * w, y: next() * h, r: 80 + next() * 200, c: [next() * 255, next() * 255, next() * 255] as Rgb }));
  const gw = Math.ceil(w / 8);
  const grains = Array.from({ length: gw * Math.ceil(h / 8) }, () => (next() - 0.5) * 16);
  const grainAt = (gx: number, gy: number): number => grains[gy * gw + gx] ?? 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 90;
      let g = 70;
      let b = 50;
      for (const blob of blobs) {
        const k = Math.exp(-((x - blob.x) ** 2 + (y - blob.y) ** 2) / (2 * blob.r * blob.r));
        r += k * (blob.c[0] - 90);
        g += k * (blob.c[1] - 70);
        b += k * (blob.c[2] - 50);
      }
      // Grain in 8 px blocks and colours in steps of 8: enough for the picture
      // to read as a photograph, coarse enough that the committed file stays small.
      const grain = grainAt(x >> 3, y >> 3);
      c.set(x0 + x, y0 + y, [step(r + grain), step(g + grain), step(b + grain)]);
    }
  }
}

function step(n: number): number {
  return clamp(Math.round(n / 8) * 8);
}

function clamp(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function mix(a: Rgb, b: Rgb, t: number): Rgb {
  return [clamp(a[0] + (b[0] - a[0]) * t), clamp(a[1] + (b[1] - a[1]) * t), clamp(a[2] + (b[2] - a[2]) * t)];
}

/** The generator's stamp every slide carries, bottom right. */
const MARK = { square: { x: 1080, y: 686, w: 12, h: 12 }, text: 'MADE WITH GEN', x: 1100, y: 685, scale: 2 };

function mark(c: Canvas, ink: Rgb): void {
  c.rect(MARK.square.x, MARK.square.y, MARK.square.w, MARK.square.h, ink);
  c.text(MARK.text, MARK.x, MARK.y, MARK.scale, ink);
}

// ─── the labels ──────────────────────────────────────────────────────────────

type Frac = [number, number, number, number];

export interface PictureSlideLabelV1 {
  slide: number;
  structure: 'title-and-image' | 'cards-3' | 'rows-and-callout' | 'full-image-with-text';
  title: string;
  body: string[];
  /** Card labels, or row texts, in reading order. */
  items: string[];
  callouts: string[];
  /** Pictures a rebuild should crop, as fractions of the slide. */
  pictures: Array<{ what: string; box: Frac }>;
  /** Every line drawn, the mark's included. */
  drawn: DrawnLineV1[];
}

export interface PictureDeckLabelsV1 {
  fixture: 'pictures.pptx';
  version: 1;
  width: number;
  height: number;
  /** The corner mark every slide carries, as fractions of the slide. */
  mark: { text: string; box: Frac };
  slides: PictureSlideLabelV1[];
}

const frac = (x: number, y: number, w: number, h: number): Frac => [x / W, y / H, w / W, h / H].map((n) => Math.round(n * 10000) / 10000) as Frac;

// ─── the four slides ─────────────────────────────────────────────────────────

function slideOne(): { png: Uint8Array; label: PictureSlideLabelV1 } {
  const c = new Canvas();
  c.fill((_x, y) => mix([24, 72, 52], [40, 104, 76], y / H));
  photo(c, 760, 120, 456, 480, 11);
  c.text('OWN YOUR FILES', 64, 150, 7, [255, 255, 255]);
  c.text('KEEP EVERY FILE ON YOUR DEVICE.', 64, 300, 3, [170, 240, 210]);
  c.text('NOTHING LEAVES THE MACHINE.', 64, 336, 3, [170, 240, 210]);
  mark(c, [220, 230, 225]);
  return {
    png: c.png(),
    label: {
      slide: 1,
      structure: 'title-and-image',
      title: 'OWN YOUR FILES',
      body: ['KEEP EVERY FILE ON YOUR DEVICE. NOTHING LEAVES THE MACHINE.'],
      items: [],
      callouts: [],
      pictures: [{ what: 'photograph on the right', box: frac(760, 120, 456, 480) }],
      drawn: c.lines,
    },
  };
}

const CARD_W = 342;
const CARD_XS = [64, 469, 874];

function slideTwo(): { png: Uint8Array; label: PictureSlideLabelV1 } {
  const c = new Canvas();
  c.fill((x, y) => mix([232, 243, 238], [196, 228, 212], (x / W + y / H) / 2));
  c.text('CHOOSE YOUR JOB', 64, 64, 6, [20, 70, 50]);
  const labels = ['EVERYDAY', 'STORIES', 'EXPERTS'];
  const subs = ['FOR FAMILIES', 'FOR WRITERS', 'FOR BRANDS'];
  const pictures: PictureSlideLabelV1['pictures'] = [];
  CARD_XS.forEach((x, k) => {
    c.rect(x, 200, CARD_W, 400, [255, 255, 255]);
    const cx = x + CARD_W / 2;
    c.ring(cx, 300, 44, 6, [20, 90, 60]);
    pictures.push({ what: `ring icon on card ${k + 1}`, box: frac(cx - 44, 256, 89, 89) });
    const label = labels[k] ?? '';
    const sub = subs[k] ?? '';
    c.text(label, Math.round(cx - (label.length * 24 - 4) / 2), 420, 4, [20, 70, 50]);
    c.text(sub, Math.round(cx - (sub.length * 18 - 3) / 2), 470, 3, [70, 110, 90]);
  });
  mark(c, [60, 90, 75]);
  return {
    png: c.png(),
    label: {
      slide: 2,
      structure: 'cards-3',
      title: 'CHOOSE YOUR JOB',
      body: [],
      items: labels.map((l, k) => `${l} ${subs[k] ?? ''}`),
      callouts: [],
      pictures,
      drawn: c.lines,
    },
  };
}

function slideThree(): { png: Uint8Array; label: PictureSlideLabelV1 } {
  const c = new Canvas();
  c.fill(() => [251, 251, 251]);
  c.text('THE HIDDEN COST', 64, 56, 6, [120, 30, 30]);
  for (const y of [180, 330, 480, 630]) c.rect(48, y, 552, 2, [150, 150, 150]);
  const rows = [
    ['UPLOAD A CONTRACT', 'TO A STRANGER.'],
    ['HAND OVER SCREENSHOTS', 'FOR TRAINING.'],
    ['MERGE TWO PRIVATE', 'DOCUMENTS ONLINE.'],
  ];
  const pictures: PictureSlideLabelV1['pictures'] = [];
  rows.forEach((lines, k) => {
    const top = 180 + k * 150;
    // A filled circle for the icon, in the row's middle.
    const cy = top + 75;
    for (let y = cy - 18; y <= cy + 18; y++) for (let x = 72; x <= 108; x++) if (Math.hypot(x - 90, y - cy) <= 18) c.set(x, y, [170, 80, 80]);
    pictures.push({ what: `round icon on row ${k + 1}`, box: frac(72, cy - 18, 37, 37) });
    c.text(lines[0] ?? '', 150, top + 44, 3, [40, 40, 40]);
    c.text(lines[1] ?? '', 150, top + 80, 3, [40, 40, 40]);
  });
  c.frame(680, 200, 540, 360, 3, [112, 112, 112]);
  c.text('WE DID THIS', 720, 280, 5, [30, 30, 30]);
  c.text('EASILY.', 720, 340, 5, [30, 30, 30]);
  mark(c, [90, 90, 90]);
  return {
    png: c.png(),
    label: {
      slide: 3,
      structure: 'rows-and-callout',
      title: 'THE HIDDEN COST',
      body: [],
      items: rows.map((r) => r.join(' ')),
      callouts: ['WE DID THIS EASILY.'],
      pictures,
      drawn: c.lines,
    },
  };
}

function slideFour(): { png: Uint8Array; label: PictureSlideLabelV1 } {
  const c = new Canvas();
  photo(c, 0, 0, W, H, 29);
  c.text('FREEDOM IS SWEET', 64, 200, 7, [255, 255, 255]);
  c.text('IT RUNS ON YOUR DEVICE.', 64, 320, 3, [255, 255, 255]);
  mark(c, [255, 255, 255]);
  return {
    png: c.png(),
    label: {
      slide: 4,
      structure: 'full-image-with-text',
      title: 'FREEDOM IS SWEET',
      body: ['IT RUNS ON YOUR DEVICE.'],
      items: [],
      callouts: [],
      pictures: [{ what: 'photograph across the slide', box: frac(0, 0, W, H) }],
      drawn: c.lines,
    },
  };
}

// ─── the deck ────────────────────────────────────────────────────────────────

export function buildPictureDeck(): { pptx: Uint8Array; labels: PictureDeckLabelsV1 } {
  const made = [slideOne(), slideTwo(), slideThree(), slideFour()];
  const slides: PptxSlide[] = made.map(({ png }) => ({
    shapes: [{ kind: 'pic', x: 0, y: 0, cx: px(W), cy: px(H), media: 0, name: 'slide picture' }],
    media: [{ bytes: png, ext: 'png' }],
  }));
  const parts = buildPptxParts(slides, { emuW: px(W), emuH: px(H), now: NOW, meta: { title: 'Rebrand fixture: pictures' } });
  const enc = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const name of Object.keys(parts).sort()) {
    const value = parts[name];
    if (value === undefined) continue;
    files[name] = typeof value === 'string' ? enc.encode(value) : value;
  }
  const markBox = {
    x: MARK.square.x,
    y: Math.min(MARK.square.y, MARK.y),
    w: MARK.x + MARK.text.length * 6 * MARK.scale - MARK.square.x,
    h: Math.max(MARK.square.y + MARK.square.h, MARK.y + 7 * MARK.scale) - Math.min(MARK.square.y, MARK.y),
  };
  return {
    pptx: zipSync(files, { level: ZIP_LEVEL, mtime: ZIP_MTIME }),
    labels: {
      fixture: 'pictures.pptx',
      version: 1,
      width: W,
      height: H,
      mark: { text: MARK.text, box: frac(markBox.x, markBox.y, markBox.w, markBox.h) },
      slides: made.map((m) => m.label),
    },
  };
}

async function main(): Promise<void> {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const outArg = process.argv.find((a) => a.startsWith('--out='))?.slice('--out='.length);
  const out = path.resolve(outArg ?? path.join(root, 'tests/fixtures/rebrand-pictures'));
  await mkdir(out, { recursive: true });
  const { pptx, labels } = buildPictureDeck();
  await writeFile(path.join(out, 'pictures.pptx'), pptx);
  await writeFile(path.join(out, 'pictures.labels.json'), `${JSON.stringify(labels, null, 2)}\n`);
  process.stdout.write(`wrote pictures.pptx and pictures.labels.json to ${path.relative(root, out) || '.'}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
