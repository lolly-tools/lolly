// SPDX-License-Identifier: MPL-2.0
/** Pinned source admission and preservation checks; ordinary tests need no download. */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, join } from 'node:path';
import { inflateSync } from 'node:zlib';
import { loadPsdKernel } from '../packages/node-shell/src/adobe-psd-node.ts';
import { readPsd } from '../engine/src/psd.ts';

interface Entry { path: string; bytes: number; sha256: string }
interface Recipe { repository: string; commit: string; files: Entry[]; baseline: { parsed: number; total: number } }
const root = resolve(import.meta.dirname, '..');
const recipe = JSON.parse(await readFile(join(root, 'scripts/data/adobe-corpus.json'), 'utf8')) as Recipe;
const cache = resolve(root, process.argv.find(s => s.startsWith('--dir='))?.slice(6) ?? 'plans/corpora/photocraft');
const digest = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
let totalBytes = 0;
for (const file of recipe.files) {
  if (!/^[\w./-]+\.(psd|psb)$/.test(file.path) || file.path.split('/').some(p => p === '..' || !p) || !Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > 64 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(file.sha256)) throw new Error('Invalid corpus recipe.');
  totalBytes += file.bytes;
}
if (totalBytes > 512 * 1024 * 1024 || recipe.files.length !== recipe.baseline.total || !/^[a-f0-9]{40}$/.test(recipe.commit) || recipe.repository !== 'storytold/photocraft-corpus') throw new Error('Invalid corpus bounds or identity.');

async function verified(file: Entry): Promise<Uint8Array> {
  const bytes = new Uint8Array(await readFile(join(cache, file.path)));
  if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error(`Corpus checksum mismatch: ${file.path}`);
  return bytes;
}
if (process.argv.includes('--fetch')) {
  let next = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (next < recipe.files.length) {
      const file = recipe.files[next++]!;
      try { await verified(file); continue; } catch { /* Fetch missing or changed fixtures. */ }
      const url = `https://raw.githubusercontent.com/${recipe.repository}/${recipe.commit}/${file.path}`;
      const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
      if (!response.ok || !response.body) throw new Error(`Corpus download failed: ${file.path}`);
      const reader = response.body.getReader(), bytes = new Uint8Array(file.bytes); let offset = 0;
      try {
        for (;;) {
          const part = await reader.read(); if (part.done) break;
          if (part.value.length > bytes.length - offset) throw new Error(`Oversized corpus download: ${file.path}`);
          bytes.set(part.value, offset); offset += part.value.length;
        }
      } finally { await reader.cancel(); }
      if (offset !== file.bytes || digest(bytes) !== file.sha256) throw new Error(`Corpus download checksum mismatch: ${file.path}`);
      const dest = join(cache, file.path); await mkdir(dirname(dest), { recursive: true }); await writeFile(dest, bytes);
    }
  }));
  console.log(`Fetched and verified ${recipe.files.length} pinned Photoshop fixtures into ${cache}.`);
} else {
  const kernel = await loadPsdKernel();
  let baseline = 0, admitted = 0, preserved = 0;
  const failures: { path: string; error: string }[] = [];
  for (const file of recipe.files) {
    const bytes = await verified(file);
    try { readPsd(bytes, { inflate: (b, maxOut) => new Uint8Array(inflateSync(b, { maxOutputLength: maxOut })), maxDecodedBytes: 64 * 1024 * 1024 }); baseline++; } catch { /* Count admission separately. */ }
    try {
      kernel.read(bytes, { maxDecodedBytes: 64 * 1024 * 1024 }); admitted++;
      if (digest(kernel.roundTrip(bytes)) === file.sha256) preserved++;
      else failures.push({ path: file.path, error: 'Source bytes changed.' });
    } catch (error) { failures.push({ path: file.path, error: String(error) }); }
  }
  const report = { repository: recipe.repository, commit: recipe.commit, adapter: 'photocraft-psd/0.2.0 + lolly-adobe-psd/0.1.0', wasmSha256: digest(await readFile(join(root, 'packages/node-shell/wasm/adobe-psd/adobe-psd.wasm'))), decodeBudget: 64 * 1024 * 1024, total: recipe.files.length, baseline, admitted, preserved, visualFidelity: 'Not measured by this admission check.', failures };
  await mkdir(join(root, 'plans/artifacts/297'), { recursive: true });
  await writeFile(join(root, 'plans/artifacts/297/psd-corpus.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
  if (baseline < recipe.baseline.parsed || admitted !== recipe.files.length || preserved !== recipe.files.length || failures.length) process.exitCode = 1;
}
