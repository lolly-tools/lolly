#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Canvas determinism probe: does the scoped Chromium give the same PNG bytes for the same
 * render? Run as `node scripts/probe-canvas-determinism.ts` (needs the scoped Chromium:
 * `pnpm run install:browser` in shells/cli). Re-run it after a Chromium upgrade.
 *
 * It answers the two questions apart, because they have different owners:
 *
 *  1. The ENCODER. The same RGBA pixels, put into a canvas and encoded with toBlob and
 *     toDataURL, in two launches, two contexts each, on a GPU canvas and a CPU canvas.
 *     Every encode must give the same bytes. When this fails, the noise is in the PNG
 *     encoder and the pixels are not to blame.
 *  2. The DRAW. The same HTML drawn the way an export draws it (dom-to-image: an SVG
 *     foreignObject picture drawn into a canvas), four times in each of three launches,
 *     once with the export launch flags (chromiumLaunchArgs('software'), which carry
 *     CPU_CANVAS_ARGS) and once without the CPU canvas flag. With the flag every draw
 *     must give the same pixels.
 *
 * What it found on 2026-11-06 (the Chromium that playwright-core 1.63 installs, macOS):
 * the encoder was identical in all 8 encodes. Without the flag the k-th draw in a
 * browser had pixels of its own, and every launch repeated the same sequence, so the
 * result depended on how many pictures the page had drawn before; a CLI export follows
 * a varying number of preview paints. With the flag all 12 draws were identical, and three CLI renders each
 * of certificate and synth gave identical PNG bytes (without the flag, three hashes).
 * Exits 1 when either question fails with the flag on.
 */
import { createHash } from 'node:crypto';
import { CPU_CANVAS_ARGS, chromiumLaunchOptions, resolveBrowsersDir } from '../packages/node-shell/src/browsers.ts';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolveBrowsersDir();
const { chromium } = await import('playwright-core');
type Browser = import('playwright-core').Browser;

const exportArgs = chromiumLaunchOptions('software');
const withoutFlag = { ...exportArgs, args: exportArgs.args.filter((a) => !CPU_CANVAS_ARGS.includes(a)) };

/** The same pixels every time: smooth ramps plus seeded noise, opaque like a render. */
async function encodeOnce(browser: Browser, cpu: boolean): Promise<string> {
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    const out = await page.evaluate(async (useCpu: boolean) => {
      const w = 1200, h = 800;
      let s = 12345;
      const rnd = (): number => { s = (Math.imul(s, 1103515245) + 12345) >>> 0; return s / 4294967296; };
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const g = c.getContext('2d', useCpu ? { willReadFrequently: true } : undefined)!;
      const img = g.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) {
        const p = i / 4;
        img.data[i] = ((p % w) * 255 / w) | 0;
        img.data[i + 1] = (Math.floor(p / w) * 255 / h) | 0;
        img.data[i + 2] = (rnd() * 255) | 0;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      const blob: Blob = await new Promise((r) => c.toBlob((b) => r(b!), 'image/png'));
      const bytes = new Uint8Array(await blob.arrayBuffer());
      let bin = '';
      for (const b of bytes) bin += String.fromCharCode(b);
      return { blob: btoa(bin), url: c.toDataURL('image/png').split(',')[1]! };
    }, cpu);
    const a = Buffer.from(out.blob, 'base64'), b = Buffer.from(out.url, 'base64');
    if (!a.equals(b)) return 'toBlob and toDataURL disagree';
    return createHash('sha256').update(a).digest('hex').slice(0, 16);
  } finally {
    await ctx.close();
  }
}

const HTML = `<div xmlns="http://www.w3.org/1999/xhtml" style="width:1169px;height:827px;background:#f4f7f6;font-family:Georgia,serif;color:#0c3b3a;padding:60px;box-sizing:border-box">
 <h1 style="font-size:64px;margin:0 0 24px">Certificate of achievement</h1>
 <p style="font-size:28px;line-height:1.4">This certifies that <b>Alexandra Example</b> has completed the course in brand systems, colour roles and tokens.</p>
 <p style="font-size:22px;letter-spacing:.04em;text-transform:uppercase;color:#1f6f6b">Lolly Demo, Spearmint</p>
 <svg width="300" height="120"><path d="M10 100 C 60 10, 120 10, 170 100 S 280 190, 290 40" stroke="#1f6f6b" stroke-width="3" fill="none"/></svg>
</div>`;

/** Draw the page the way dom-to-image does and hash the pixels the canvas holds. */
async function drawOnce(browser: Browser): Promise<string> {
  const ctx = await browser.newContext();
  try {
    const page = await ctx.newPage();
    return await page.evaluate(async (html: string) => {
      const scale = 3, w = 1169, h = 827;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w * scale}" height="${h * scale}"><foreignObject x="0" y="0" width="100%" height="100%" transform="scale(${scale})">${html}</foreignObject></svg>`;
      const img = new Image();
      img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = w * scale; c.height = h * scale;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height).data;
      let hash = 2166136261;
      for (let i = 0; i < d.length; i++) hash = Math.imul(hash ^ d[i]!, 16777619) >>> 0;
      return hash.toString(16);
    }, HTML);
  } finally {
    await ctx.close();
  }
}

async function launches<T>(opts: typeof exportArgs, n: number, each: (b: Browser) => Promise<T[]>): Promise<T[][]> {
  const out: T[][] = [];
  for (let i = 0; i < n; i++) {
    const browser = await chromium.launch(opts);
    try { out.push(await each(browser)); } finally { await browser.close(); }
  }
  return out;
}

const encodes = (await launches(exportArgs, 2, async (b) => [
  await encodeOnce(b, false), await encodeOnce(b, false), await encodeOnce(b, true), await encodeOnce(b, true),
])).flat();
const encoderSame = new Set(encodes).size === 1;
console.log(`1. encoder: ${encodes.length} encodes of the same pixels gave ${new Set(encodes).size} distinct byte string(s)`);

let failed = !encoderSame;
for (const [label, opts] of [['export flags (CPU canvas)', exportArgs], ['without the CPU canvas flag', withoutFlag]] as const) {
  const runs = await launches(opts, 3, async (b) => [await drawOnce(b), await drawOnce(b), await drawOnce(b), await drawOnce(b)]);
  const distinct = new Set(runs.flat()).size;
  console.log(`2. draw, ${label}: ${distinct} distinct pixel hash(es) over ${runs.flat().length} draws`);
  for (const [i, run] of runs.entries()) console.log(`     launch ${i + 1}: ${run.join(' ')}`);
  if (opts === exportArgs && distinct !== 1) failed = true;
}
process.exit(failed ? 1 : 0);
