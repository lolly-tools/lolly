#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Cut the YunoHost release artifact: the web tarball deploy/yunohost/manifest.toml
 * points at, and the manifest fields that pin it.
 *
 *   node scripts/yunohost-release.ts                 # pack shells/web/dist, pin the manifest
 *   node scripts/yunohost-release.ts --build         # run the release web build first
 *   node scripts/yunohost-release.ts --publish       # also upload to lolli.li (needs the S3 keys)
 *   node scripts/yunohost-release.ts --version 1.0.8 # override the version read from the desktop shell
 *   node scripts/yunohost-release.ts --ynh-rev 2     # a repackaging of the same upstream version
 *   node scripts/yunohost-release.ts --out <dir>     # default ~/.cache/lolly-release/artifacts
 *
 * What ships is the SAME shape as the desktop app's frontend, for the same reasons
 * (shells/tauri-desktop/package.json, build:frontend): the on-device ML models are
 * fetched from lolli.li instead of bundled (VITE_MODELS_BASE), and only the English
 * documentation rides along. The full web dist is 2.2 GB, most of it models and 27
 * translated copies of /info; a YunoHost host downloads this file at install time,
 * often onto a small disk, so the cut is the point. The offline manager rewrites
 * /models/ URLs under MODELS_BASE (shells/web/src/lib/offline-manager.ts), so the
 * "Available offline" list keeps working against lolli.li.
 *
 * The build step refuses the private `suse` profile the way the desktop release
 * scripts do: the tarball is public.
 *
 * The manifest edit is the only place the version, URL and checksum live, so a
 * release cannot pin one and forget the other; tests/yunohost-package.test.ts holds
 * them consistent afterwards.
 */

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
export const MANIFEST = join(ROOT, 'deploy', 'yunohost', 'manifest.toml');
export const DIST = join(ROOT, 'shells', 'web', 'dist');
export const RELEASE_HOST = 'https://lolli.li';
export const MODELS_BASE = 'https://lolli.li';

export interface Pin { version: string; ynhRev: number; url: string; sha256: string }

/** The artifact name for a version: what lolli.li serves and the manifest fetches. */
export function tarballName(version: string): string {
  return `lolly-web-${version}.tar.gz`;
}

/** The app version the desktop shell carries - the one canonical copy every package reads. */
export function upstreamVersion(): string {
  const conf = JSON.parse(readFileSync(join(ROOT, 'shells/tauri-desktop/src-tauri/tauri.conf.json'), 'utf8')) as { version: string };
  if (!/^\d+\.\d+\.\d+$/.test(conf.version)) throw new Error(`tauri.conf.json version is not x.y.z: ${conf.version}`);
  return conf.version;
}

/** Locale directories the build emits under dist/info/, minus English. Mirrors the
 *  desktop's post-build trim exactly: one entry per shells/web/src/locales/<code>.json. */
export function translatedLocales(localesDir = join(ROOT, 'shells/web/src/locales')): string[] {
  return readdirSync(localesDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => f.slice(0, -5))
    .filter((code) => code !== 'en')
    .sort();
}

/** tar --exclude patterns for the cut described in the header. Paths are relative
 *  to the dist root, as `tar -C dist .` sees them. */
export function tarExcludes(locales: string[]): string[] {
  return ['./models', ...locales.map((code) => `./info/${code}`)];
}

/**
 * Rewrite the three release-pinned fields of manifest.toml. Everything else in the
 * file (comments, the other tables) is left byte-for-byte: this is a targeted edit
 * so the file stays readable as the source of truth it is.
 */
export function pinManifest(source: string, pin: Pin): string {
  const versionLine = `version = "${pin.version}~ynh${pin.ynhRev}"`;
  let out = source;
  let hits = 0;
  out = out.replace(/^version = "[^"]*"$/m, () => { hits++; return versionLine; });
  out = out.replace(/^(\s*)url = "[^"]*"$/m, (_m, ws: string) => { hits++; return `${ws}url = "${pin.url}"`; });
  out = out.replace(/^(\s*)sha256 = "[^"]*"$/m, (_m, ws: string) => { hits++; return `${ws}sha256 = "${pin.sha256}"`; });
  if (hits !== 3) throw new Error(`manifest.toml: expected one version, one url and one sha256 line to pin, rewrote ${hits}`);
  return out;
}

/** Read the pin back out of a manifest - what the test compares against. */
export function readPin(source: string): Pin {
  const version = /^version = "([^~"]+)~ynh(\d+)"$/m.exec(source);
  const url = /^\s*url = "([^"]+)"$/m.exec(source);
  const sha256 = /^\s*sha256 = "([0-9a-f]{64})"$/m.exec(source);
  if (!version || !url || !sha256) throw new Error('manifest.toml is missing a pinned version, url or sha256');
  return { version: version[1]!, ynhRev: Number(version[2]), url: url[1]!, sha256: sha256[1]! };
}

export async function sha256File(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

function run(cmd: string, args: string[], opts: { env?: NodeJS.ProcessEnv; cwd?: string } = {}): void {
  const r = spawnSync(cmd, args, { cwd: opts.cwd ?? ROOT, env: { ...process.env, ...opts.env }, stdio: 'inherit' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} exited ${r.status}`);
}

function activeProfile(): string {
  try { return readFileSync(join(ROOT, '.lolly-profile'), 'utf8').trim(); } catch { return 'unknown'; }
}

function isGnuTar(): boolean {
  const r = spawnSync('tar', ['--version'], { encoding: 'utf8' });
  return /GNU tar/.test(r.stdout ?? '');
}

/** Pack dist into the tarball. System tar, streaming: the dist is hundreds of MB. */
export function packDist(dist: string, outFile: string, excludes: string[]): void {
  if (!existsSync(join(dist, 'index.html'))) throw new Error(`${dist} has no index.html - build the web shell first (--build)`);
  if (!existsSync(join(dist, 'precache.json'))) throw new Error(`${dist} has no precache.json - the "Available offline" list would read empty`);
  if (!existsSync(join(dist, 'info', 'index.html'))) throw new Error(`${dist} has no info/index.html - in-app docs would 404`);
  const gnu = isGnuTar();
  // Dereference symlinks: the tools/ and catalog/ views the build copies into dist
  // are symlink farms on a developer checkout (scripts/use-profile.ts), and a
  // tarball of links points at nothing on the host that unpacks it.
  const args = ['-czhf', outFile];
  for (const e of excludes) args.push('--exclude', e);
  // Owner-free entries either way; macOS bsdtar also stores provenance xattrs as
  // pax headers unless told not to, which tar on the YunoHost side then warns about.
  if (gnu) args.push('--owner=0', '--group=0', '--numeric-owner', '--sort=name');
  else args.push('--uid', '0', '--gid', '0', '--no-xattrs', '--no-mac-metadata');
  args.push('-C', dist, '.');
  run('tar', args);
}

interface Args { build: boolean; publish: boolean; version?: string; ynhRev: number; out: string }

export function parseArgs(argv: string[]): Args {
  const a: Args = { build: false, publish: false, ynhRev: 1, out: process.env.LOLLY_RELEASE_OUT ?? join(homedir(), '.cache/lolly-release/artifacts') };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i]!;
    if (v === '--build') a.build = true;
    else if (v === '--publish') a.publish = true;
    else if (v === '--version') a.version = argv[++i];
    else if (v === '--ynh-rev') a.ynhRev = Number(argv[++i]);
    else if (v === '--out') a.out = argv[++i]!;
    else throw new Error(`unknown argument ${v}`);
  }
  if (a.version && !/^\d+\.\d+\.\d+$/.test(a.version)) throw new Error(`--version must be x.y.z, got ${a.version}`);
  if (!Number.isInteger(a.ynhRev) || a.ynhRev < 1) throw new Error('--ynh-rev must be a positive integer');
  return a;
}

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const args = parseArgs(argv);
  const version = args.version ?? upstreamVersion();
  const profile = activeProfile();
  if (profile === 'suse') throw new Error("active profile is 'suse' (private pack) - run 'npm run profile:start' first; the YunoHost tarball is public");

  if (args.build) {
    console.log(`[yunohost-release] release web build (profile ${profile}, models from ${MODELS_BASE})`);
    run('npm', ['run', 'build:web:release'], { env: { VITE_MODELS_BASE: MODELS_BASE } });
  }

  mkdirSync(args.out, { recursive: true });
  const name = tarballName(version);
  const outFile = join(args.out, name);
  const locales = translatedLocales();
  console.log(`[yunohost-release] packing ${DIST} -> ${outFile} (dropping ./models and ${locales.length} translated /info copies)`);
  packDist(DIST, outFile, tarExcludes(locales));
  const sha256 = await sha256File(outFile);
  const mb = (statSync(outFile).size / 1e6).toFixed(0);
  console.log(`[yunohost-release] ${name}  ${mb} MB  sha256 ${sha256}`);

  const pin: Pin = { version, ynhRev: args.ynhRev, url: `${RELEASE_HOST}/${name}`, sha256 };
  writeFileSync(MANIFEST, pinManifest(readFileSync(MANIFEST, 'utf8'), pin));
  console.log(`[yunohost-release] pinned deploy/yunohost/manifest.toml -> ${pin.version}~ynh${pin.ynhRev}`);

  if (args.publish) {
    run('python3', [join(ROOT, 'shells/tauri-desktop/release/lolli.py'), 'put', outFile, name]);
  } else {
    console.log(`[yunohost-release] next: shells/tauri-desktop/release/lolli.py put ${outFile} ${name}`);
  }
  console.log('[yunohost-release] then mirror deploy/yunohost/ to github.com/lolly-tools/lolly_ynh (see deploy/yunohost/README.md)');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err: unknown) => { console.error(`[yunohost-release] ${(err as Error).message}`); process.exit(1); });
}
