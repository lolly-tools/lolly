#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Landing / default share card generator - shells/web/public/og.png.
 *
 * og.png is the site's default social-share image (the web shell's index.html and the
 * /info landing page point at it) and the fallback whenever a per-tool / per-view /
 * per-page card is missing. It used to be a hand-made PNG that carried an OLD lollipop
 * long after the app icon and the OG cards had moved to the current pine swirl.
 *
 * This regenerates it from the SINGLE source of truth, icon.svg (via chrome.mark, which
 * embeds the signed source SVG), through the same Chromium card path as every other card -
 * so the default card can never drift from the app icon again.
 *
 *   pnpm run og:base
 *
 * A pack whose tokens select Opal's own designs (docs/og-opal.ts) gets Opal's house card
 * instead, written into that pack's own catalog at og/og.png rather than over the
 * og.png every other profile shares. A build of that profile serves it as /og.png
 * (shells/web/vite.config.js), so `LOLLY_PROFILE=lolly-demo pnpm run og:base` leaves the
 * shared card alone.
 *
 * Best-effort, exactly like the other OG scripts: on Vercel (no render browser) or when
 * Playwright/fonts are unavailable, it keeps the committed og.png rather than failing the
 * build. Locally, build:web refreshes it; commit the bytes like the other cards.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogFile } from '@lolly-tools/node-shell/content-roots';
import { createLandingCardRenderer, loadBrandChrome } from '../docs/og-image.ts';
import { applyProfileArg } from './lib/profile-arg.ts';
import { createSvgRasterizer } from './lib/rasterize-svg-browser.ts';
import { stampBitmap } from './lib/stamp-media.ts';

// `--profile=<name>` pins the content profile for this process, like the card scripts.
applyProfileArg();

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SHARED = resolve(ROOT, 'shells/web/public/og.png');

async function main(): Promise<void> {
  if (process.env.VERCEL) {
    console.log('og:base - on Vercel, keeping the committed og.png (no render browser).');
    return;
  }
  const chrome = loadBrandChrome(ROOT);
  const out = chrome.cards ? catalogFile('og/og.png') : SHARED;
  let rasterizer: Awaited<ReturnType<typeof createSvgRasterizer>>;
  try {
    rasterizer = await createSvgRasterizer(ROOT);
  } catch (e) {
    console.log(`og:base - skipped (${(e as Error).message}); kept the committed og.png.`);
    return;
  }
  try {
    const renderer = createLandingCardRenderer(rasterizer.rasterize, chrome);
    const png = await renderer.render();
    // Walk the talk: stamp the default card with the Lolly Imprint + a "made with Lolly"
    // C2PA credential before committing it (see scripts/lib/stamp-media.ts).
    const stamped = await stampBitmap(new Uint8Array(png), 'png', { id: 'og', name: 'Lolly' });
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, Buffer.from(stamped));
    console.log(`✓ og:base - ${out.slice(ROOT.length + 1)} regenerated from icon.svg`);
  } finally {
    await rasterizer.close();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
