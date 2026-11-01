// SPDX-License-Identifier: MPL-2.0
import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const source = fileURLToPath(new URL('../packages/node-shell/wasm/xlsx-numfmt/', import.meta.url));
const target = fileURLToPath(new URL('../.cache/xlsx-numfmt-target/', import.meta.url));
mkdirSync(target, { recursive: true });
execFileSync('cargo', ['build', '--release', '--locked', '--target', 'wasm32-unknown-unknown', '--target-dir', target], {
  cwd: source, stdio: 'inherit',
  env: { ...process.env, RUSTFLAGS: '-C link-arg=--max-memory=536870912 -C link-arg=-zstack-size=1048576' },
});
copyFileSync(join(target, 'wasm32-unknown-unknown/release/lolly_xlsx_numfmt.wasm'), join(source, 'xlsx-numfmt.wasm'));
const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--format-version', '1', '--locked'], { cwd: source, encoding: 'utf8' })) as { packages: { name: string; version: string; manifest_path: string; license: string | null }[] };
const notices = ['Lolly Excel number-format byte adapter: MPL-2.0\n', readFileSync(new URL('../LICENSE', import.meta.url), 'utf8')];
for (const pkg of metadata.packages.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
  if (pkg.name === 'lolly-xlsx-numfmt') continue;
  const dir = dirname(pkg.manifest_path), files = readdirSync(dir).filter(name => /^(?:licen[cs]e|copying|notice)(?:[._-]|$)/i.test(name) && statSync(join(dir, name)).isFile()).sort();
  if (!files.length) throw new Error(`No licence text found for ${pkg.name}@${pkg.version}.`);
  notices.push(`\n${pkg.name}@${pkg.version} (${pkg.license ?? 'see licence text'})\n`);
  for (const file of files) notices.push(`\n${file}\n${readFileSync(join(dir, file), 'utf8')}`);
}
writeFileSync(join(source, 'LICENSES.txt'), notices.join('\n'));
