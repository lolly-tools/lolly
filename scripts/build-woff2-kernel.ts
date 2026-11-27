// SPDX-License-Identifier: MPL-2.0
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

const source = fileURLToPath(new URL('../packages/node-shell/wasm/woff2-kernel/', import.meta.url));
const target = fileURLToPath(new URL('../.cache/woff2-kernel-target/', import.meta.url));
mkdirSync(target, { recursive: true });
// Panic messages name source files. Writing them under fixed prefixes keeps the checkout and the
// Cargo home out of the module, so the same source builds the same bytes wherever it is checked out.
const repo = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const cargoHome = process.env.CARGO_HOME ?? join(homedir(), '.cargo');
// 256 MiB memory ceiling and a 1 MiB stack, linked in: a 32 MiB file, 30 MiB of tables, the
// 16 MiB Brotli window and the rebuilt font fit with room to spare, and nothing grows past the ceiling.
const rustflags = [
  '-C', 'link-arg=--max-memory=268435456', '-C', 'link-arg=-zstack-size=1048576',
  `--remap-path-prefix=${repo}=/lolly`, `--remap-path-prefix=${cargoHome}=/cargo`,
];
execFileSync('cargo', ['build', '--release', '--locked', '--target', 'wasm32-unknown-unknown', '--target-dir', target], {
  cwd: source, stdio: 'inherit',
  env: { ...process.env, RUSTFLAGS: undefined, CARGO_ENCODED_RUSTFLAGS: rustflags.join('\x1f') },
});
copyFileSync(join(target, 'wasm32-unknown-unknown/release/lolly_woff2_kernel.wasm'), join(source, 'woff2-kernel.wasm'));
const wasm = readFileSync(join(source, 'woff2-kernel.wasm'));
console.log(`woff2-kernel.wasm: ${wasm.length} bytes raw, ${gzipSync(wasm, { level: 9 }).length} bytes gzip`);
const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--format-version', '1', '--locked', '--filter-platform', 'wasm32-unknown-unknown'], { cwd: source, encoding: 'utf8' })) as { packages: { name: string; version: string; manifest_path: string; license: string | null }[] };
// wuff's crate publishes no licence file. LICENSE.wuff is the LICENSE of its repository at the
// commit the crate was published from (wuff/.cargo_vcs_info.json in the crate).
const PUBLISHED_ELSEWHERE: Record<string, string> = { 'wuff@0.2.10': 'LICENSE.wuff' };
const notices = ['Lolly WOFF2 byte adapter: MPL-2.0\n', readFileSync(new URL('../LICENSE', import.meta.url), 'utf8')];
for (const pkg of metadata.packages.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
  if (pkg.name === 'lolly-woff2-kernel') continue;
  const dir = dirname(pkg.manifest_path), files = readdirSync(dir).filter(name => /^(?:licen[cs]e|copying|notice)(?:[._-]|$)/i.test(name) && statSync(join(dir, name)).isFile()).sort();
  const elsewhere = PUBLISHED_ELSEWHERE[`${pkg.name}@${pkg.version}`];
  if (!files.length && !elsewhere) throw new Error(`No licence text found for ${pkg.name}@${pkg.version}.`);
  notices.push(`\n${pkg.name}@${pkg.version} (${pkg.license ?? 'see licence text'})\n`);
  for (const file of files) notices.push(`\n${file}\n${readFileSync(join(dir, file), 'utf8')}`);
  if (!files.length && elsewhere) notices.push(`\nLICENSE (from the crate's repository)\n${readFileSync(join(source, elsewhere), 'utf8')}`);
}
writeFileSync(join(source, 'LICENSES.txt'), notices.join('\n'));
