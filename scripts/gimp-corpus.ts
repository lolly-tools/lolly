// SPDX-License-Identifier: MPL-2.0
/**
 * Pinned GIMP oracle corpus: photocraft-corpus `gimp/` holds 14 GIMP 3.2.6 XCF files and the merged PNG GIMP
 * exported for each. `--fetch` downloads them at the recipe's commit into plans/corpora/photocraft-gimp (gitignored)
 * and checks each SHA-256; without a flag the script only verifies what is on disk. The comparison itself is
 * tests/xcf-oracle.test.ts, run on request with LOLLY_XCF_ORACLE=1.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

interface Entry { path: string; bytes: number; sha256: string }
interface Recipe { repository: string; commit: string; files: Entry[] }
const root = resolve(import.meta.dirname, '..');
const recipe = JSON.parse(await readFile(join(root, 'scripts/data/gimp-corpus.json'), 'utf8')) as Recipe;
const cache = resolve(root, process.argv.find(s => s.startsWith('--dir='))?.slice(6) ?? 'plans/corpora/photocraft-gimp');
const digest = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
for (const f of recipe.files) {
  if (!/^gimp\/[\w-]+\.(xcf|png)$/.test(f.path) || !Number.isSafeInteger(f.bytes) || f.bytes < 1 || f.bytes > 4 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(f.sha256)) throw new Error('Invalid corpus recipe.');
}
if (recipe.repository !== 'storytold/photocraft-corpus' || !/^[a-f0-9]{40}$/.test(recipe.commit) || recipe.files.length !== 28) throw new Error('Invalid corpus identity.');
const local = (f: Entry) => join(cache, f.path.slice('gimp/'.length));
async function verified(f: Entry): Promise<Uint8Array> {
  const bytes = new Uint8Array(await readFile(local(f)));
  if (bytes.length !== f.bytes || digest(bytes) !== f.sha256) throw new Error(`Corpus checksum mismatch: ${f.path}`);
  return bytes;
}
if (process.argv.includes('--fetch')) {
  for (const f of recipe.files) {
    try { await verified(f); continue; } catch { /* Fetch missing or changed fixtures. */ }
    const response = await fetch(`https://raw.githubusercontent.com/${recipe.repository}/${recipe.commit}/${f.path}`, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Corpus download failed: ${f.path}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== f.bytes || digest(bytes) !== f.sha256) throw new Error(`Corpus download checksum mismatch: ${f.path}`);
    await mkdir(dirname(local(f)), { recursive: true }); await writeFile(local(f), bytes);
  }
}
for (const f of recipe.files) await verified(f);
console.log(`Verified ${recipe.files.length} pinned GIMP fixtures in ${cache}.`);
