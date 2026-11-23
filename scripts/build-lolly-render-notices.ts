// SPDX-License-Identifier: MPL-2.0
/**
 * Third-party notices for the lolly-render Node binding (plan 371, M3b):
 * crates/lolly-render-node/LICENSES.txt, the licence text of every crate linked into the
 * binding, read from the crates cargo has on disk for the pinned Cargo.lock.
 *
 * Only the crates the binding links are listed: the dependency graph is walked from the
 * binding along normal dependencies, so build scripts' crates (napi-build) and procedural
 * macros (napi-derive, serde_derive and what they use) are left out, since none of their
 * code is in the binary. Each platform package carries the file beside its binary, and
 * THIRD-PARTY-NOTICES.md includes it (scripts/build-licenses.ts).
 *
 * napi and napi-sys publish no licence file in their crates, only `license = "MIT"`; for
 * those the MIT text is written out with the crate's own authors and repository as the
 * copyright holders, and the entry says so. Any other crate without a licence file stops
 * the script.
 *
 *   node scripts/build-lolly-render-notices.ts           write the file
 *   node scripts/build-lolly-render-notices.ts --check   fail when the file is not current
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CRATE = join(ROOT, 'crates', 'lolly-render-node');
const OUT = join(CRATE, 'LICENSES.txt');

interface Package { id: string; name: string; version: string; license: string | null; authors: string[]; repository: string | null; manifest_path: string; targets: { kind: string[] }[] }
interface Node { id: string; deps: { pkg: string; dep_kinds: { kind: string | null }[] }[] }

const metadata = JSON.parse(execFileSync('cargo', ['metadata', '--format-version', '1', '--locked'], { cwd: CRATE, encoding: 'utf8', maxBuffer: 64 << 20 })) as {
  packages: Package[]; resolve: { root: string; nodes: Node[] };
};
const packages = new Map(metadata.packages.map((p) => [p.id, p]));
const nodes = new Map(metadata.resolve.nodes.map((n) => [n.id, n]));
const isMacro = (p: Package): boolean => p.targets.some((t) => t.kind.includes('proc-macro'));

// The crates linked into the binary: normal dependencies only, never through a macro.
const linked = new Set<string>();
const walk = [metadata.resolve.root];
while (walk.length) {
  const id = walk.pop()!;
  if (linked.has(id)) continue;
  linked.add(id);
  for (const dep of nodes.get(id)?.deps ?? []) {
    const pkg = packages.get(dep.pkg);
    if (!pkg || isMacro(pkg) || !dep.dep_kinds.some((k) => k.kind === null)) continue;
    walk.push(dep.pkg);
  }
}

const own = new Set(['lolly-render-node', 'lolly-render']);

/** The MIT licence as SPDX publishes it, for a crate that declares MIT and ships no text. */
const MIT = (holders: string): string => [
  'MIT License', '', `Copyright (c) ${holders}`, '',
  'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:',
  '',
  'The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.',
  '',
  'THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.',
].join('\n');
const NO_FILE_MIT = new Set(['napi', 'napi-sys']);
const text = [
  'Third-party notices for the lolly-render Node binding.',
  'lolly-render and its Node binding are MPL-2.0 (the LICENSE file of the Lolly repository).',
  'The crates below are linked into the binding unmodified, at the versions crates/lolly-render-node/Cargo.lock pins.',
  'Written by scripts/build-lolly-render-notices.ts.',
  '',
];
const listed = [...linked].map((id) => packages.get(id)!).filter((p) => !own.has(p.name))
  .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
for (const pkg of listed) {
  const dir = dirname(pkg.manifest_path);
  const files = readdirSync(dir).filter((name) => /^(?:licen[cs]e|copying|notice)(?:[._-]|$)/i.test(name) && statSync(join(dir, name)).isFile()).sort();
  text.push('', `${pkg.name} ${pkg.version}`, `License: ${pkg.license ?? 'see the licence text'}`, `Source: https://crates.io/crates/${pkg.name}/${pkg.version}`, '');
  if (!files.length && NO_FILE_MIT.has(pkg.name) && pkg.license === 'MIT') {
    const holders = `${pkg.authors.map((a) => a.replace(/\s*<[^>]*>/, '')).join(', ') || `the ${pkg.name} authors`}${pkg.repository ? ` (${pkg.repository})` : ''}`;
    text.push('The crate publishes no licence file; the MIT text follows, with the crate\'s authors as the holders.', '', MIT(holders), '');
    continue;
  }
  if (!files.length) throw new Error(`No licence text found for ${pkg.name}@${pkg.version} in ${dir}.`);
  for (const file of files) text.push(file, readFileSync(join(dir, file), 'utf8').trimEnd(), '');
}
const body = `${text.join('\n')}\n`;

if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== body) {
    console.error('crates/lolly-render-node/LICENSES.txt is not current: run node scripts/build-lolly-render-notices.ts');
    process.exitCode = 1;
  } else {
    console.log(`crates/lolly-render-node/LICENSES.txt is current (${listed.length} crates)`);
  }
} else {
  writeFileSync(OUT, body);
  console.log(`Wrote crates/lolly-render-node/LICENSES.txt (${listed.length} crates: ${listed.map((p) => p.name).join(', ')})`);
}
