// SPDX-License-Identifier: MPL-2.0
/**
 * Pinned InDesign samples for the INDD to IDML converter. Ordinary tests need no download.
 *
 *   node scripts/indd-corpus.ts fetch-fixtures        six open fixtures into plans/corpora/indd-fixtures
 *   node scripts/indd-corpus.ts fetch [--limit=150] [--max-bytes=1000000000]
 *   node scripts/indd-corpus.ts run                   convert what is fetched and write the report
 *
 * The corpus manifest is upstream indd-utils' tools/corpus-manifest.json. Only entries with
 * MIT, CC0, CC-BY or Apache licences and a direct URL are kept. Each file is checked against its
 * size and SHA-256 before it is written.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { loadInddKernel } from '../packages/node-shell/src/indd-node.ts';
import { InddError, isInddSignature } from '../packages/node-shell/src/indd.ts';
import { readZip } from '../engine/src/zip.ts';

interface Entry { path: string; size: number; sha256: string; licence: string; url?: string; source: string; archive?: string }
const root = resolve(import.meta.dirname, '..');
const [command = 'run', ...flags] = process.argv.slice(2);
const flag = (name: string, fallback: string) => flags.find(f => f.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const digest = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const PER_FILE_CAP = 64 * 1024 * 1024;

/** MIT, CC0, CC-BY (not ShareAlike) and Apache licence expressions. */
export function admitsLicence(licence: string): boolean {
  return /^(?:MIT|CC0-1\.0|CC-BY-[34]\.0|Apache-2\.0)$/.test(licence) || /^(?:MIT|CPL-1\.0) OR Apache-2\.0$/.test(licence);
}
function safePath(path: string): string {
  if (!path || path.startsWith('/') || [...path].some(c => c === '\\' || c.charCodeAt(0) < 32) || path.split('/').some(p => !p || p === '..' || p.startsWith('.'))) throw new Error(`Unsafe corpus path: ${path}`);
  return path;
}
async function verified(dir: string, entry: Entry): Promise<Uint8Array | undefined> {
  try {
    const bytes = new Uint8Array(await readFile(join(dir, safePath(entry.path))));
    return bytes.length === entry.size && digest(bytes) === entry.sha256 ? bytes : undefined;
  } catch { return undefined; }
}
async function download(dir: string, entry: Entry): Promise<void> {
  if (!entry.url?.startsWith('https://') || entry.size > PER_FILE_CAP) throw new Error(`Not fetchable: ${entry.path}`);
  const response = await fetch(entry.url, { signal: AbortSignal.timeout(120_000), headers: { 'user-agent': 'lolly-indd-corpus/1' } });
  if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
  const bytes = new Uint8Array(entry.size); let offset = 0;
  const reader = response.body.getReader();
  try {
    for (;;) {
      const part = await reader.read(); if (part.done) break;
      if (part.value.length > bytes.length - offset) throw new Error('Oversized download');
      bytes.set(part.value, offset); offset += part.value.length;
    }
  } finally { await reader.cancel().catch(() => undefined); }
  if (offset !== entry.size || digest(bytes) !== entry.sha256) throw new Error('Checksum mismatch');
  const dest = join(dir, safePath(entry.path)); await mkdir(dirname(dest), { recursive: true }); await writeFile(dest, bytes);
}
async function fetchAll(dir: string, entries: Entry[]): Promise<{ ok: number; failed: string[] }> {
  let next = 0, ok = 0; const failed: string[] = [];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < entries.length) {
      const entry = entries[next++]!;
      try { if (!await verified(dir, entry)) await download(dir, entry); ok++; }
      catch (error) { failed.push(`${entry.path}: ${(error as Error).message}`); }
    }
  }));
  return { ok, failed };
}

const fixtureDir = join(root, 'plans/corpora/indd-fixtures');
const corpusDir = join(root, 'plans/corpora/indd');
if (command === 'fetch-fixtures') {
  const manifest = JSON.parse(await readFile(join(root, 'packages/node-shell/wasm/indd/vendor/indd-utils/tests/fixtures/manifest.json'), 'utf8')) as { files: Entry[] };
  const result = await fetchAll(fixtureDir, manifest.files);
  console.log(`Fetched and verified ${result.ok} of ${manifest.files.length} fixtures into ${fixtureDir}.`);
  if (result.failed.length) { console.error(result.failed.join('\n')); process.exitCode = 1; }
} else if (command === 'fetch') {
  const manifest = JSON.parse(await readFile(join(root, 'scripts/data/indd-corpus-manifest.json'), 'utf8')) as { files: Entry[] };
  const limit = Number(flag('limit', '150')), maxBytes = Number(flag('max-bytes', String(1_000_000_000)));
  const pool = manifest.files.filter(f => f.url && !f.archive && admitsLicence(f.licence) && /\.(?:indd|indt)$/i.test(f.path) && f.size >= 4096 && f.size <= PER_FILE_CAP);
  // Round-robin across sources in checksum order, so the subset is stable and varied.
  const bySource = new Map<string, Entry[]>();
  for (const entry of [...pool].sort((a, b) => a.sha256 < b.sha256 ? -1 : 1)) bySource.set(entry.source, [...bySource.get(entry.source) ?? [], entry]);
  const chosen: Entry[] = []; let bytes = 0;
  for (let round = 0; chosen.length < limit; round++) {
    let any = false;
    for (const list of [...bySource.entries()].sort(([a], [b]) => a < b ? -1 : 1).map(([, v]) => v)) {
      const entry = list[round]; if (!entry) continue; any = true;
      if (chosen.length < limit && bytes + entry.size <= maxBytes) { chosen.push(entry); bytes += entry.size; }
    }
    if (!any) break;
  }
  console.log(`${pool.length} direct-URL entries pass the licence filter; fetching ${chosen.length} (${(bytes / 1e6).toFixed(1)} MB) from ${new Set(chosen.map(c => c.source)).size} sources.`);
  await mkdir(corpusDir, { recursive: true });
  await writeFile(join(corpusDir, 'selection.json'), `${JSON.stringify(chosen, null, 1)}\n`);
  const result = await fetchAll(corpusDir, chosen);
  console.log(`Fetched and verified ${result.ok} of ${chosen.length}.`);
  if (result.failed.length) { console.error(result.failed.join('\n')); process.exitCode = 1; }
} else if (command === 'run') {
  const selection = JSON.parse(await readFile(join(corpusDir, 'selection.json'), 'utf8')) as Entry[];
  const fixtures = (JSON.parse(await readFile(join(root, 'packages/node-shell/wasm/indd/vendor/indd-utils/tests/fixtures/manifest.json'), 'utf8')) as { files: Entry[] }).files.filter(f => /\.(?:indd|indt)$/.test(f.path));
  const jobs = [...selection.map(entry => ({ dir: corpusDir, entry })), ...fixtures.map(entry => ({ dir: fixtureDir, entry }))];
  const outcomes: Record<string, number> = {}, failures: { path: string; code: string; error: string }[] = [];
  let converted = 0, missing = 0, withWarnings = 0, totalWarnings = 0, slowest = { path: '', ms: 0 }, inputBytes = 0;
  const bump = (key: string) => { outcomes[key] = (outcomes[key] ?? 0) + 1; };
  for (const { dir, entry } of jobs) {
    const bytes = await verified(dir, entry);
    if (!bytes) { missing++; continue; }
    inputBytes += bytes.length;
    const started = performance.now();
    try {
      const result = (await loadInddKernel()).convert(bytes, entry.path.split('/').pop());
      const parts = readZip(result.idml, { maxInputBytes: 256 * 1024 * 1024, maxTotalBytes: 512 * 1024 * 1024, maxEntryBytes: 64 * 1024 * 1024, maxEntries: 4096 });
      if (!parts.some(p => p.name === 'designmap.xml')) throw new InddError('failed', 'Package has no designmap.xml');
      converted++; bump('converted');
      if (result.warnings.length) { withWarnings++; totalWarnings += result.warnings.length; }
    } catch (error) {
      const code = error instanceof InddError ? error.code : 'error', message = (error as Error).message;
      // Files that are not readable by design: pre-2.0 layout, no signature, stripped or short files.
      bump(isInddSignature(bytes) ? `${code}: ${message.replace(/\d+/g, 'N').slice(0, 60)}` : 'not-indd-signature');
      failures.push({ path: entry.path, code, error: message });
    }
    const ms = performance.now() - started; if (ms > slowest.ms) slowest = { path: entry.path, ms: Math.round(ms) };
  }
  const report = { files: jobs.length, missing, converted, failed: failures.length, withWarnings, totalWarnings, inputBytes, slowest, outcomes, failures };
  await mkdir(join(root, 'plans/artifacts/342'), { recursive: true });
  await writeFile(join(root, 'plans/artifacts/342/indd-corpus.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, failures: failures.length > 12 ? `${failures.length} (see plans/artifacts/342/indd-corpus.json)` : failures }, null, 2));
  if ((await readdir(corpusDir).catch(() => [])).length === 0 || missing === jobs.length) process.exitCode = 1;
} else throw new Error(`Unknown command: ${command}`);
