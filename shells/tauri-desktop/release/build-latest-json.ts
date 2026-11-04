#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertWebGpuReleaseAllowed } from '../../../scripts/webgpu-release-gate.ts';
import { assertNoMarkedBuild, assertNotQualificationBuild } from '../../../scripts/webgpu-qualification.ts';
import { assertUpdaterSource, updaterPublicKey, verifyUpdaterArtifact } from './update-artifacts.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const TARGETS = new Set(['darwin-aarch64', ...['x86_64', 'aarch64'].flatMap(arch =>
  ['appimage', 'deb', 'rpm'].map(kind => `linux-${arch}-${kind}`))]);
export interface UpdateReceipt {
  version: string;
  source: string;
  artifacts: { target: string; file: string; sha256: string }[];
}
interface Configuration { version: string; bundle: { createUpdaterArtifacts: boolean }; plugins: { updater: { pubkey: string } } }
export interface FeedOptions {
  config: Configuration;
  receipt: UpdateReceipt;
  artifacts: string;
  targets: string[];
  notes: string;
  date: string;
  root?: string;
  env?: NodeJS.ProcessEnv;
}

/** Validate every input before returning any publishable manifest. */
export function prepareUpdates(opts: FeedOptions) {
  const { config, receipt } = opts;
  const root = opts.root ?? ROOT;
  assertNotQualificationBuild(opts.env ?? process.env, 'writing updater manifests');
  assertNoMarkedBuild(resolve(opts.artifacts), 'writing updater manifests');
  updaterPublicKey(config.plugins.updater.pubkey);
  if (!config.bundle.createUpdaterArtifacts) throw new Error('Updater artifacts are disabled');
  if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(receipt.version) || receipt.version !== config.version) {
    throw new Error('Invalid or inconsistent native version');
  }
  if (!/^[a-f0-9]{40}$/.test(receipt.source)) throw new Error('Missing exact source revision');
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(opts.date) || !Number.isFinite(Date.parse(opts.date))) throw new Error('Invalid publication date');
  if (!opts.targets.length || new Set(opts.targets).size !== opts.targets.length) throw new Error('Select distinct update targets');
  const artifacts = opts.targets.map(target => {
    if (!TARGETS.has(target)) throw new Error(`Unsupported updater target: ${target}`);
    assertWebGpuReleaseAllowed(root, target.startsWith('linux-') ? 'linux' : 'macos');
    const matches = receipt.artifacts.filter(row => row.target === target);
    const row = matches[0];
    if (matches.length !== 1 || !row || !/^[A-Za-z0-9_.-]+$/.test(row.file) || row.file.startsWith('.') || !/^[a-f0-9]{64}$/.test(row.sha256)) {
      throw new Error(`Missing or invalid artifact receipt: ${target}`);
    }
    const extension = target.startsWith('darwin-') ? '.app.tar.gz' : target.endsWith('-appimage') ? '.AppImage' : target.endsWith('-deb') ? '.deb' : '.rpm';
    if (!row.file.endsWith(extension)) throw new Error(`Wrong artifact format for ${target}`);
    const path = join(resolve(opts.artifacts), row.file);
    const bytes = readFileSync(path);
    if (createHash('sha256').update(bytes).digest('hex') !== row.sha256) throw new Error(`Artifact checksum mismatch: ${target}`);
    const signature = readFileSync(`${path}.sig`, 'utf8').trim();
    verifyUpdaterArtifact(bytes, signature, config.plugins.updater.pubkey, receipt.version);
    const [os, arch] = target.split('-');
    const key = `releases/${receipt.version}/${os}/${arch}/${row.file}`;
    return { ...row, path, signature, key, url: `https://lolli.li/${key}`, endpoint: `updates/${os}/${arch}/latest.json` };
  });
  const manifests: Record<string, { version: string; notes: string; pub_date: string; platforms: Record<string, { url: string; signature: string }> }> = {};
  for (const artifact of artifacts) {
    manifests[artifact.endpoint] ??= { version: receipt.version, notes: opts.notes, pub_date: opts.date, platforms: {} };
    const manifest = manifests[artifact.endpoint]!;
    manifest.platforms[artifact.target] = { url: artifact.url, signature: artifact.signature };
  }
  return { version: receipt.version, source: receipt.source, publicKey: config.plugins.updater.pubkey, artifacts, manifests };
}

export function main(argv: string[]): number {
  const arg = (name: string): string | undefined => { const at = argv.indexOf(`--${name}`); return at < 0 ? undefined : argv[at + 1]; };
  try {
    const config = JSON.parse(readFileSync(join(ROOT, 'shells/tauri-desktop/src-tauri/tauri.conf.json'), 'utf8')) as Configuration;
    // Release configuration always comes from the checkout. Local test feeds are separate.
    const receiptPath = arg('receipt');
    if (!receiptPath || !arg('sig-dir')) throw new Error('Required: --receipt <release-receipt.json> --sig-dir <artifacts>. No manifest was produced.');
    const result = prepareUpdates({ config, receipt: JSON.parse(readFileSync(receiptPath, 'utf8')) as UpdateReceipt,
      artifacts: arg('sig-dir')!, targets: (arg('targets') ?? 'darwin-aarch64').split(','), notes: arg('notes') ?? `Lolly ${config.version}`,
      date: arg('date') ?? new Date().toISOString().replace(/\.\d{3}Z$/, 'Z') });
    assertUpdaterSource(result.source, ROOT);
    const out = arg('out');
    if (!out) { console.log(JSON.stringify({ version: result.version, targets: result.artifacts.map(row => row.target), status: 'validated; dry run' })); return 0; }
    for (const [key, manifest] of Object.entries(result.manifests)) {
      const path = join(resolve(out), key); mkdirSync(dirname(path), { recursive: true }); writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
    }
    writeFileSync(join(resolve(out), 'promotion.json'), `${JSON.stringify(result, null, 2)}\n`);
    return 0;
  } catch (error) { console.error(error instanceof Error ? error.message : String(error)); return 1; }
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = main(process.argv.slice(2));
