#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * App-icon pipeline - ONE source of truth: `icon.svg` at the repo root.
 *
 * The Lolly mark lives in exactly one place: `icon.svg` (a hand-drawn, C2PA- + RDF-signed
 * vector, viewBox 541.87², transparent - the green + white glossy swirl). Every other icon
 * in the repo is DERIVED from it by this script, so they can never drift. Re-run whenever
 * icon.svg changes:
 *
 *   npm run icons
 *
 * The source is a vector, so we first rasterise it to a transparent master through our OWN
 * render path (Playwright/Chromium - the SAME engine the OG cards, previews and exports use),
 * NOT sharp's librsvg or resvg: the mark leans on `mix-blend-mode` and blur filters that the
 * standalone SVG interpreters drop (a fill collapses to solid black). sharp then does the
 * pure raster resizes from that master.
 *
 * What it regenerates (all committed - commit the diff like any other asset):
 *   • shells/web/public/icon.svg - a byte copy of the signed source, so the web
 *                                              shell (favicon, PWA, /info) can serve the SVG
 *                                              itself with its C2PA + RDF provenance intact
 *   • shells/web/public/icons/* - PWA icon-192/512, 512-maskable, apple-touch
 *   • shells/web/public/favicon.ico - 16/32/48 multi-size
 *   • shells/tauri-desktop/src-tauri/icons/* - via `tauri icon` (icns/ico/png/android/ios)
 *   • shells/tauri-mobile/src-tauri/icons/* - same, when the shell is mounted + installed
 *
 * og.png (the landing / default share card) is ALSO derived from icon.svg, but it carries
 * the wordmark + tagline in the brand font, so it is rendered through the Chromium card
 * path in scripts/build-og-base.ts - not here, where everything after the master is a pure
 * sharp resize.
 *
 * Degrades like the OG scripts: if Playwright / a render browser is unavailable, it keeps the
 * committed icons rather than failing a plain clone. sharp (native libvips) is a build-time
 * dep, same as the preview/OG pipeline.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp, { type Color } from 'sharp';
import { createSvgRasterizer } from './lib/rasterize-svg-browser.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'icon.svg');

/**
 * The signed source carries a `<style>` block that spins the shutter blades (3/6/9s)
 * and drifts the hue. Derived rasters are STATIC by decision (2026-08-10): a Chromium
 * screenshot would otherwise capture whatever animation frame the page happened to be
 * on (the 0% keyframe alone applies a 15° hue shift), making every derivative
 * nondeterministic and tinted. Strip the style block (and any SMIL animation elements)
 * from the STRING we rasterise - the signed file itself is never modified, and the
 * verbatim `shells/web/public/icon.svg` copy below stays byte-identical so its C2PA +
 * RDF provenance survives.
 */
export function staticIconSvg(svg: string): string {
  let out = svg;
  // Repeat until no opening tag remains - the signed source nests an empty <style>
  // inside the animation block, so one non-greedy pass leaves an orphan close tag.
  while (/<style\b/.test(out)) out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/, '');
  return out
    .replace(/<\/style>/g, '') // orphan close tags left by nested blocks
    .replace(/<(animate|animateTransform|animateMotion|set)\b[^>]*\/>/g, '')
    .replace(/<(animate|animateTransform|animateMotion|set)\b[\s\S]*?<\/\1>/g, '');
}
// The transparent raster master every sharp resize below derives from. 1024² is the
// largest output (the Tauri master), so nothing upscales.
const MASTER = 1024;

// Backgrounds for the icons that must be OPAQUE (a masked/rounded platform icon shows
// its own corner fill, and iOS composites a transparent icon onto black). Pine is the
// brand field - the green swirl reads well on it, and it matches the app chrome.
const PINE = { r: 12, g: 50, b: 44, alpha: 1 };        // #0c322c
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** iOS home-screen icon: pine field, the mark OVERSIZED past the canvas (`bleed` > 1,
 *  owner call 2026-08-22: the swirl reads stronger filling the squircle edge to edge),
 *  cropped back to the square, alpha stripped (iOS icons allow none). */
async function iosIconPng(master: Buffer, size: number, bleed: number): Promise<Buffer> {
  const inner = Math.round(size * bleed);
  const mark = await sharp(master)
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();
  const off = Math.floor((inner - size) / 2);
  const cropped = await sharp(mark).extract({ left: off, top: off, width: size, height: size }).png().toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: PINE } })
    .composite([{ input: cropped, gravity: 'center' }])
    .removeAlpha()
    .png()
    .toBuffer();
}

/** Square PNG buffer of the master at `size`, `contain`-fit on `bg`, inset by `pad` (0..0.5). */
async function iconPng(master: Buffer, size: number, bg: Color, pad = 0): Promise<Buffer> {
  const inner = Math.round(size * (1 - 2 * pad));
  const mark = await sharp(master)
    .resize(inner, inner, { fit: 'contain', background: TRANSPARENT })
    .png()
    .toBuffer();
  return sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: mark, gravity: 'center' }])
    .png()
    .toBuffer();
}

/**
 * Minimal ICO container over PNG frames (every browser since IE11 reads PNG-in-ICO).
 * ICONDIR (6B) + one ICONDIRENTRY (16B) per frame + the PNG payloads.
 */
function encodeIco(frames: Array<{ size: number; png: Buffer }>): Buffer {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);            // reserved
  header.writeUInt16LE(1, 2);            // type: icon
  header.writeUInt16LE(frames.length, 4);

  const dir = Buffer.alloc(16 * frames.length);
  let offset = 6 + dir.length;
  frames.forEach((f, i) => {
    const e = i * 16;
    dir.writeUInt8(f.size >= 256 ? 0 : f.size, e + 0);   // width  (0 ⇒ 256)
    dir.writeUInt8(f.size >= 256 ? 0 : f.size, e + 1);   // height
    dir.writeUInt8(0, e + 2);            // palette
    dir.writeUInt8(0, e + 3);            // reserved
    dir.writeUInt16LE(1, e + 4);         // colour planes
    dir.writeUInt16LE(32, e + 6);        // bits per pixel
    dir.writeUInt32LE(f.png.length, e + 8);
    dir.writeUInt32LE(offset, e + 12);
    offset += f.png.length;
  });

  return Buffer.concat([header, dir, ...frames.map((f) => f.png)]);
}

async function main(): Promise<void> {
  if (!existsSync(SOURCE)) {
    console.error(`✗ ${SOURCE} not found - the icon pipeline needs icon.svg at the repo root.`);
    process.exit(1);
  }

  // Rasterise the signed source to a transparent master through our own Chromium path.
  // A missing browser degrades to the committed icons (a plain clone isn't punished).
  let rasterizer: Awaited<ReturnType<typeof createSvgRasterizer>>;
  try {
    rasterizer = await createSvgRasterizer(ROOT);
  } catch (e) {
    console.log(`icons - skipped (${(e as Error).message}); kept the committed app icons.`);
    return;
  }
  let master: Buffer;
  try {
    master = await rasterizer.rasterize(staticIconSvg(readFileSync(SOURCE, 'utf8')), { width: MASTER, height: MASTER, background: 'transparent' });
  } finally {
    await rasterizer.close();
  }
  const meta = await sharp(master).metadata();
  console.log(`source: icon.svg → ${meta.width}×${meta.height} transparent master (alpha=${meta.hasAlpha})`);

  // ── Serve the signed SVG itself - a byte copy, so its C2PA + RDF provenance travels. ──
  copyFileSync(SOURCE, resolve(ROOT, 'shells/web/public/icon.svg'));
  console.log('✓ shells/web/public/icon.svg (signed source, verbatim copy)');

  // ── Web PWA icons + apple-touch. ──
  const webIcons = resolve(ROOT, 'shells/web/public/icons');
  mkdirSync(webIcons, { recursive: true });
  // "any"-purpose icons keep the round mark transparent (the launcher frames it);
  // maskable + apple-touch are opaque pine with the mark inset into the safe zone.
  writeFileSync(join(webIcons, 'icon-192.png'), await iconPng(master, 192, TRANSPARENT));
  writeFileSync(join(webIcons, 'icon-512.png'), await iconPng(master, 512, TRANSPARENT));
  writeFileSync(join(webIcons, 'icon-512-maskable.png'), await iconPng(master, 512, PINE, 0.14));
  writeFileSync(join(webIcons, 'apple-touch-icon.png'), await iconPng(master, 180, PINE, 0.06));
  console.log('✓ web icons (192, 512, 512-maskable, apple-touch)');

  // ── favicon.ico - 16/32/48, transparent. ──
  const favSizes = [16, 32, 48];
  const frames = await Promise.all(
    favSizes.map(async (size) => ({ size, png: await iconPng(master, size, TRANSPARENT) })),
  );
  writeFileSync(resolve(ROOT, 'shells/web/public/favicon.ico'), encodeIco(frames));
  console.log('✓ favicon.ico (16/32/48)');

  // ── Tauri shells - `tauri icon` regenerates icns/ico/png/android/ios from one master. ──
  const masterFile = join(tmpdir(), `lolly-icon-master-${MASTER}.png`);
  await sharp(master).resize(MASTER, MASTER, { fit: 'contain', background: TRANSPARENT }).png().toFile(masterFile);
  for (const shell of ['shells/tauri-desktop', 'shells/tauri-mobile']) {
    const dir = resolve(ROOT, shell);
    const bin = join(dir, 'node_modules/.bin/tauri');
    if (!existsSync(bin)) {
      console.log(`ℹ ${shell}: tauri CLI not installed - skipped (run \`npm --prefix ${shell} ci\` to include it)`);
      continue;
    }
    try {
      execFileSync(bin, ['icon', masterFile], { cwd: dir, stdio: 'pipe' });
      console.log(`✓ ${shell} icons (via tauri icon)`);
    } catch (e) {
      console.log(`⚠ ${shell}: tauri icon failed (${(e as Error).message.split('\n')[0]})`);
    }
  }
  rmSync(masterFile, { force: true });

  // ── iOS appiconset - what the Xcode build actually ships (gen/apple/Assets.xcassets,
  // not icons/ios). Pine-backed, no alpha, and the swirl bleeds past the canvas. ──
  const IOS_BLEED = 1.16;
  const setDir = resolve(ROOT, 'shells/tauri-mobile/src-tauri/gen/apple/Assets.xcassets/AppIcon.appiconset');
  if (existsSync(join(setDir, 'Contents.json'))) {
    const contents = JSON.parse(readFileSync(join(setDir, 'Contents.json'), 'utf8')) as {
      images: Array<{ filename?: string; size?: string; scale?: string }>;
    };
    const done = new Set<string>();
    for (const im of contents.images) {
      if (!im.filename || !im.size || done.has(im.filename)) continue;
      const pts = Number(im.size.split('x')[0]);
      const scale = Number((im.scale ?? '1x').replace('x', ''));
      if (!Number.isFinite(pts) || !Number.isFinite(scale)) continue;
      const px = Math.round(pts * scale);
      writeFileSync(join(setDir, im.filename), await iosIconPng(master, px, IOS_BLEED));
      done.add(im.filename);
    }
    console.log(`✓ iOS appiconset (${done.size} icons, pine, swirl +${Math.round((IOS_BLEED - 1) * 100)}% bleed)`);
  }

  console.log('\n✓ app icons regenerated from icon.svg');
}

main().catch((e) => { console.error(e); process.exit(1); });
