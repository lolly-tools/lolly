// SPDX-License-Identifier: MPL-2.0
/**
 * Guard for the patent decision of 2026-11-01: Lolly ships no codec implementation
 * from a patent pool (ProRes, DNx/VC-3, H.264, HEVC, AAC, AC-3). It identifies such
 * content (engine/src/video-container-probe.ts) and uses the licensed decoders the
 * platform already has.
 *
 * Four checks: the npm dependency manifests, the npm licence list, every Cargo.lock,
 * and the vendored WASM module directories. A fifth scans the built web chunks when
 * a build output exists; it never builds (a missing build passes, it does not skip).
 *
 * The one standing exception is `heic-to` (libheif with the libde265 HEVC decoder,
 * for iPhone photos). Andy kept it on 2026-11-03 and the removal package (P1) is
 * deferred. It is listed here so it cannot be joined by a second one unnoticed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');

/** npm packages that carry or wrap a patent-pool codec implementation. */
const BANNED_NPM = [
  /^@ffmpeg\//, /^ffmpeg/, /^fluent-ffmpeg$/, /^@?libav/, /^openh264/, /^x26[45]$/, /^libx26[45]/, /^h26[45]/, /^hevc/,
  /^broadway/, /^tinyh264/, /^libde265/, /^de265/, /^libheif/, /^heic-decode$/, /^prores/, /^dnx/, /^vc-?3/,
  /^fdk-aac/, /^faac/, /^faad/, /^aac(-|$)/, /^ac-?3(-|$)/, /^@?mediabunny\/.*(h264|hevc|aac)/,
];
/** Crates that carry or wrap one. Matched on the whole crate name. */
const BANNED_CRATES = [
  /^openh264/, /^x26[45]/, /^h26[45]/, /^hevc/, /^prores/, /^dnx/, /^vc-?3$/, /^fdk-aac/, /^faac/, /^faad/,
  /^ffmpeg/, /^libav/, /^aac$/, /^aac-/, /^ac-?3$/, /^ac-?3-/, /^libde265/, /^de265/, /^mpeg2/, /^minimp4$/,
];
/** The named, deferred exception. */
const ALLOWED_NPM = new Set(['heic-to']);

const bare = (id: string): string => id.replace(/@[^@/]+$/, '');

function walkManifests(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.git' || name === '.worktrees' || name === 'dist' || name === 'target') continue;
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) walkManifests(p, out);
    else if (name === 'package.json') out.push(p);
  }
  return out;
}

test('no npm manifest depends on a patent-pool codec package', () => {
  const found: string[] = [];
  for (const file of walkManifests(ROOT)) {
    const pkg = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Record<string, string> | undefined>;
    for (const field of ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies']) {
      for (const name of Object.keys(pkg[field] ?? {})) {
        if (ALLOWED_NPM.has(name)) continue;
        if (BANNED_NPM.some((re) => re.test(name))) found.push(`${file.slice(ROOT.length + 1)}: ${name}`);
      }
    }
  }
  assert.deepEqual(found, []);
});

test('the npm licence list holds no patent-pool codec package', () => {
  const list = JSON.parse(readFileSync(join(ROOT, 'security/npm-licenses.json'), 'utf8')) as Record<string, string>;
  const found = Object.keys(list).map(bare).filter((n) => !ALLOWED_NPM.has(n) && BANNED_NPM.some((re) => re.test(n)));
  assert.deepEqual(found, []);
});

test('the exception list holds exactly the deferred heic-to', () => {
  // If heic-to goes (package P1), delete ALLOWED_NPM and drop this test too.
  assert.deepEqual([...ALLOWED_NPM], ['heic-to']);
});

function trackedFiles(pattern: string): string[] {
  return execFileSync('git', ['ls-files', '-z', pattern], { cwd: ROOT, encoding: 'utf8' }).split('\0').filter(Boolean);
}

test('no Cargo.lock locks a patent-pool codec crate', () => {
  const found: string[] = [];
  for (const file of trackedFiles('*Cargo.lock')) {
    for (const m of readFileSync(join(ROOT, file), 'utf8').matchAll(/^name = "([^"]+)"/gm)) {
      if (BANNED_CRATES.some((re) => re.test(m[1]!))) found.push(`${file}: ${m[1]}`);
    }
  }
  assert.deepEqual(found, []);
});

test('no vendored WASM module is a patent-pool codec', () => {
  const dir = join(ROOT, 'packages/node-shell/wasm');
  const names = existsSync(dir) ? readdirSync(dir) : [];
  assert.ok(names.length > 0);
  assert.deepEqual(names.filter((n) => BANNED_CRATES.some((re) => re.test(n))), []);
});

test('the probe stays a probe: it exports no decode or encode function', () => {
  const src = readFileSync(join(ROOT, 'engine/src/video-container-probe.ts'), 'utf8');
  const exported = [...src.matchAll(/^export (?:async )?(?:function|const|class) (\w+)/gm)].map((m) => m[1]!);
  assert.deepEqual(exported.filter((n) => /decode|encode|inflate|dequant|idct/i.test(n)), []);
});

test('built web chunks, when a build exists, hold no patent-pool codec implementation', () => {
  const dist = join(ROOT, 'shells/web/dist');
  if (!existsSync(dist)) return; // never build here: a missing build proves nothing and fails nothing
  const markers = /openh264|x264_|libavcodec|prores_(?:decode|encode)|dnxhd_(?:decode|encode)|fdk_aac|libfaad|ff_h264/;
  const found: string[] = [];
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      const s = statSync(p);
      if (s.isDirectory()) { walk(p); continue; }
      if (!/\.(js|mjs|wasm)$/.test(name) || s.size > 64 * 1024 * 1024) continue;
      const text = readFileSync(p, 'latin1');
      if (markers.test(text)) found.push(p.slice(ROOT.length + 1));
      // libde265 is allowed only inside the heic-to bundle, which also mentions libheif.
      if (/libde265/.test(text) && !/libheif/.test(text)) found.push(`${p.slice(ROOT.length + 1)} (libde265 outside libheif)`);
    }
  };
  walk(dist);
  assert.deepEqual(found, []);
});
