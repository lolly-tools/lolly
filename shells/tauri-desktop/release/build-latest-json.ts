#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Write the updater manifests tauri-plugin-updater fetches (plans/202 WP4.1).
 *
 *   node shells/tauri-desktop/release/build-latest-json.ts            # print, write nothing
 *   node shells/tauri-desktop/release/build-latest-json.ts --out out/updates
 *   node shells/tauri-desktop/release/build-latest-json.ts --sig-dir ~/.cache/lolly-release/artifacts
 *
 * DRY RUN BY DEFAULT. With no --out it prints each manifest and the lolli.py
 * command that would publish it, and touches nothing.
 *
 * The endpoint in src-tauri/tauri.conf.json is
 *
 *   https://lolli.li/updates/{{target}}/{{arch}}/latest.json
 *
 * so there is one small file per target and arch, not one big one. This script
 * writes exactly the entries it has an artifact name for and says out loud which
 * platforms have none.
 *
 * WHAT THE UPDATER CAN AND CANNOT INSTALL
 *
 * It replaces the application in place, so it needs an artifact it can unpack
 * over the installed app: a `.app.tar.gz` on macOS, an `.AppImage.tar.gz` on
 * Linux, a `.msi.zip` or `.nsis.zip` on Windows. `createUpdaterArtifacts: true`
 * in tauri.conf.json is what makes `tauri build` emit them, each beside a
 * `.sig` file signed with the private key.
 *
 * The .dmg, .deb, .rpm, .flatpak and Arch package Lolly publishes today are NOT
 * updater artifacts. A .deb is owned by dpkg and a Flatpak by flatpak; replacing
 * either from inside the app would leave the package manager describing files
 * that are no longer there. Those users update the way they installed, and this
 * script never writes a manifest that pretends otherwise. Publishing a Linux
 * manifest means adding an AppImage bundle to the release first.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const CONF = resolve(HERE, '../src-tauri/tauri.conf.json');

/** The value tauri.conf.json ships with. A release signed against this cannot be
 *  verified by anything, so publishing a manifest under it is refused below. */
const PUBKEY_PLACEHOLDER = 'PLACEHOLDER-RUN-TAURI-SIGNER-GENERATE';

interface Conf {
  version: string;
  bundle?: { createUpdaterArtifacts?: boolean };
  plugins?: { updater?: { endpoints?: string[]; pubkey?: string } };
}

interface Target {
  /** The `{{target}}/{{arch}}` pair the endpoint template resolves to. */
  target: string;
  arch: string;
  /** The key inside the manifest's `platforms` map. */
  key: string;
  /** Artifact file name, given a version. Null when Lolly builds none yet. */
  artifact: ((version: string) => string) | null;
  note: string;
}

const TARGETS: Target[] = [
  {
    target: 'darwin',
    arch: 'aarch64',
    key: 'darwin-aarch64',
    // `tauri build` writes this beside the .app in
    // target/aarch64-apple-darwin/release/bundle/macos/. The name carries no
    // version - the manifest's own `version` field is what the plugin compares.
    artifact: () => 'Lolly.app.tar.gz',
    note: 'Apple silicon. The build the signed, notarised .dmg comes from.',
  },
  {
    target: 'darwin',
    arch: 'x86_64',
    key: 'darwin-x86_64',
    artifact: null,
    note: 'No Intel Mac build is produced today. Add one, or leave Intel users on manual downloads.',
  },
  {
    target: 'linux',
    arch: 'x86_64',
    key: 'linux-x86_64',
    artifact: null,
    note: 'Needs an AppImage bundle. The published .deb / .rpm / .flatpak / Arch package all update through their package manager, never through this.',
  },
  {
    target: 'linux',
    arch: 'aarch64',
    key: 'linux-aarch64',
    artifact: null,
    note: 'Same as linux-x86_64: the arm64 release is a .deb.',
  },
  {
    target: 'windows',
    arch: 'x86_64',
    key: 'windows-x86_64',
    artifact: (v) => `Lolly_${v}_x64-setup.nsis.zip`,
    note: 'No Windows release has been cut yet. The name is what tauri build would emit.',
  },
];

function arg(name: string): string | null {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1]! : null;
}

function main(): void {
  const conf = JSON.parse(readFileSync(CONF, 'utf8')) as Conf;
  const updater = conf.plugins?.updater;
  if (!updater?.endpoints?.length) {
    console.error('tauri.conf.json has no plugins.updater.endpoints - nothing to publish against.');
    process.exit(1);
  }
  if (!conf.bundle?.createUpdaterArtifacts) {
    console.error('tauri.conf.json has bundle.createUpdaterArtifacts off, so `tauri build` emits no update artifact and no .sig.');
    process.exit(1);
  }

  const version = arg('version') ?? conf.version;
  const notes = arg('notes') ?? `Lolly ${version}`;
  const pubDate = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const base = (arg('base') ?? 'https://lolli.li').replace(/\/+$/, '');
  const outDir = arg('out');
  const sigDir = arg('sig-dir');

  const placeholderKey = !updater.pubkey || updater.pubkey === PUBKEY_PLACEHOLDER;
  if (placeholderKey && outDir) {
    console.error(
      'Refusing to write manifests: plugins.updater.pubkey in tauri.conf.json is still the placeholder.\n'
      + '\n'
      + '  1. npm --prefix shells/tauri-desktop exec tauri signer generate -- -w ~/.lolly-updater.key\n'
      + '  2. paste the PUBLIC key into src-tauri/tauri.conf.json plugins.updater.pubkey\n'
      + '  3. keep the private key and its password as CI secrets\n'
      + '     TAURI_SIGNING_PRIVATE_KEY and TAURI_SIGNING_PRIVATE_KEY_PASSWORD\n'
      + '\n'
      + 'Until then every build is unsigned and the updater would refuse the artifact anyway.',
    );
    process.exit(1);
  }
  if (placeholderKey) {
    console.log('# NOTE: plugins.updater.pubkey is still the placeholder, so this is a preview only.');
    console.log('#       --out is refused until a real key is in tauri.conf.json.\n');
  }

  let wrote = 0;
  let skipped = 0;
  for (const spec of TARGETS) {
    if (!spec.artifact) {
      console.log(`# ${spec.key}: no artifact. ${spec.note}`);
      skipped++;
      continue;
    }
    const file = spec.artifact(version);
    const url = `${base}/updates/${spec.target}/${spec.arch}/${file}`;
    let signature = '';
    if (sigDir) {
      const sigPath = join(resolve(sigDir), `${file}.sig`);
      if (existsSync(sigPath)) signature = readFileSync(sigPath, 'utf8').trim();
      else console.log(`# ${spec.key}: no signature at ${sigPath}`);
    }
    const manifest = {
      version,
      notes,
      pub_date: pubDate,
      platforms: { [spec.key]: { signature, url } },
    };
    const json = JSON.stringify(manifest, null, 2);
    console.log(`\n# ${spec.key}  ->  updates/${spec.target}/${spec.arch}/latest.json`);
    console.log(`# ${spec.note}`);
    console.log(json);
    console.log(`# release/lolli.py put <file> updates/${spec.target}/${spec.arch}/latest.json`);
    console.log(`# release/lolli.py put ${file} updates/${spec.target}/${spec.arch}/${file}`);
    if (!signature) console.log('# WARNING: signature is empty. The plugin will refuse this update.');
    if (outDir) {
      const dir = join(resolve(outDir), spec.target, spec.arch);
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, 'latest.json'), `${json}\n`);
      console.log(`# wrote ${join(dir, 'latest.json')}`);
    }
    wrote++;
  }

  console.log(`\n# ${wrote} manifest(s), ${skipped} platform(s) with no updater artifact.`);
  if (!outDir) console.log('# Dry run. Pass --out <dir> to write, --sig-dir <dir> to fill in signatures.');
}

main();
