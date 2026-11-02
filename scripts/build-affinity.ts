// SPDX-License-Identifier: MPL-2.0
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const source = fileURLToPath(new URL('../packages/node-shell/wasm/affinity/', import.meta.url));
const target = fileURLToPath(new URL('../plans/artifacts/342/affinity-target/', import.meta.url));
mkdirSync(target, { recursive: true });
// 1 GiB memory ceiling and a 1 MiB stack, linked in so a hostile file cannot grow past them.
execFileSync('cargo', ['build', '--release', '--locked', '--target', 'wasm32-unknown-unknown', '--target-dir', target], {
  cwd: source, stdio: 'inherit',
  env: { ...process.env, RUSTFLAGS: '-C link-arg=--max-memory=1073741824 -C link-arg=-zstack-size=1048576' },
});
copyFileSync(join(target, 'wasm32-unknown-unknown/release/lolly_affinity.wasm'), join(source, 'affinity.wasm'));
const wasm = readFileSync(join(source, 'affinity.wasm'));
console.log(`affinity.wasm: ${wasm.length} bytes raw, ${gzipSync(wasm, { level: 9 }).length} bytes gzip`);
const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--format-version', '1', '--locked'], { cwd: source, encoding: 'utf8' })) as { packages: { name: string; version: string; manifest_path: string; license: string | null }[] };
const notices = ['Lolly Affinity byte adapter: MPL-2.0\n', readFileSync(new URL('../LICENSE', import.meta.url), 'utf8')];
for (const pkg of metadata.packages.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
  if (pkg.name === 'lolly-affinity') continue;
  const dir = dirname(pkg.manifest_path), files = readdirSync(dir).filter(name => /^(?:licen[cs]e|copying|notice)(?:[._-]|$)/i.test(name) && statSync(join(dir, name)).isFile()).sort();
  if (!files.length) throw new Error(`No licence text found for ${pkg.name}@${pkg.version}.`);
  notices.push(`\n${pkg.name}@${pkg.version} (${pkg.license ?? 'see licence text'})\n`);
  for (const file of files) notices.push(`\n${file}\n${readFileSync(join(dir, file), 'utf8')}`);
}
writeFileSync(join(source, 'LICENSES.txt'), notices.join('\n'));
