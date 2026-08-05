#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * App-icon pipeline — ONE source of truth: `icon.avif` at the repo root.
 *
 * The Lolly mark lives in exactly one place, `icon.avif` (2048², transparent). Every
 * other icon in the repo is DERIVED from it by this script, so they can never drift the
 * way they had (the app icons + og.png shipped an old lime-in-a-wrapper lollipop while
 * the OG cards already used the current pine swirl). Re-run whenever icon.avif changes:
 *
 *   npm run icons
 *
 * What it regenerates (all committed — commit the diff like any other asset):
 *   • icon.webp                              — root, the web-friendly derived copy the OG
 *                                              cards' mark + the /info og:logo read
 *   • shells/web/public/icons/*              — PWA icon-192/512, 512-maskable, apple-touch
 *   • shells/web/public/favicon.ico          — 16/32/48 multi-size
 *   • shells/tauri-desktop/src-tauri/icons/* — via `tauri icon` (icns/ico/png/android/ios)
 *   • shells/tauri-mobile/src-tauri/icons/*  — same, when the shell is mounted + installed
 *
 * og.png (the landing / default share card) is ALSO derived from icon.avif, but it carries
 * the wordmark + tagline in the brand font, so it is rendered through the Chromium card
 * path in scripts/build-og-base.ts — not here, where everything is a pure sharp resize.
 *
 * sharp (native libvips) is a build-time-only dep, same as the preview/OG pipeline.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp, { type Color } from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = resolve(ROOT, 'icon.avif');

// Backgrounds for the icons that must be OPAQUE (a masked/rounded platform icon shows
// its own corner fill, and iOS composites a transparent icon onto black). Pine is the
// brand field — the current pine swirl reads well on it, and it matches the app chrome.
const PINE = { r: 12, g: 50, b: 44, alpha: 1 };        // #0c322c
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/** Square PNG buffer of the source at `size`, `contain`-fit on `bg`, inset by `pad` (0..0.5). */
async function iconPng(size: number, bg: Color, pad = 0): Promise<Buffer> {
  const inner = Math.round(size * (1 - 2 * pad));
  const mark = await sharp(SOURCE)
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
    console.error(`✗ ${SOURCE} not found — the icon pipeline needs icon.avif at the repo root.`);
    process.exit(1);
  }
  const meta = await sharp(SOURCE).metadata();
  console.log(`source: icon.avif ${meta.width}×${meta.height} (${meta.format}, alpha=${meta.hasAlpha})`);

  // ── Root icon.webp — the web-friendly derived copy (OG mark, /info og:logo). ──
  await sharp(SOURCE).resize(1024, 1024, { fit: 'contain', background: TRANSPARENT })
    .webp({ quality: 90, effort: 6 })
    .toFile(resolve(ROOT, 'icon.webp'));
  console.log('✓ icon.webp');

  // ── Web PWA icons + apple-touch. ──
  const webIcons = resolve(ROOT, 'shells/web/public/icons');
  mkdirSync(webIcons, { recursive: true });
  // "any"-purpose icons keep the round mark transparent (the launcher frames it);
  // maskable + apple-touch are opaque pine with the mark inset into the safe zone.
  writeFileSync(join(webIcons, 'icon-192.png'), await iconPng(192, TRANSPARENT));
  writeFileSync(join(webIcons, 'icon-512.png'), await iconPng(512, TRANSPARENT));
  writeFileSync(join(webIcons, 'icon-512-maskable.png'), await iconPng(512, PINE, 0.14));
  writeFileSync(join(webIcons, 'apple-touch-icon.png'), await iconPng(180, PINE, 0.06));
  console.log('✓ web icons (192, 512, 512-maskable, apple-touch)');

  // ── favicon.ico — 16/32/48, transparent. ──
  const favSizes = [16, 32, 48];
  const frames = await Promise.all(
    favSizes.map(async (size) => ({ size, png: await iconPng(size, TRANSPARENT) })),
  );
  writeFileSync(resolve(ROOT, 'shells/web/public/favicon.ico'), encodeIco(frames));
  console.log('✓ favicon.ico (16/32/48)');

  // ── Tauri shells — `tauri icon` regenerates icns/ico/png/android/ios from one master. ──
  const master = join(tmpdir(), `lolly-icon-master-${meta.width}.png`);
  await sharp(SOURCE).resize(1024, 1024, { fit: 'contain', background: TRANSPARENT }).png().toFile(master);
  for (const shell of ['shells/tauri-desktop', 'shells/tauri-mobile']) {
    const dir = resolve(ROOT, shell);
    const bin = join(dir, 'node_modules/.bin/tauri');
    if (!existsSync(bin)) {
      console.log(`ℹ ${shell}: tauri CLI not installed — skipped (run \`npm --prefix ${shell} ci\` to include it)`);
      continue;
    }
    try {
      execFileSync(bin, ['icon', master], { cwd: dir, stdio: 'pipe' });
      console.log(`✓ ${shell} icons (via tauri icon)`);
    } catch (e) {
      console.log(`⚠ ${shell}: tauri icon failed (${(e as Error).message.split('\n')[0]})`);
    }
  }
  rmSync(master, { force: true });

  console.log('\n✓ app icons regenerated from icon.avif');
}

main().catch((e) => { console.error(e); process.exit(1); });
