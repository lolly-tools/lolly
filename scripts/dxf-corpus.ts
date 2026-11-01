// SPDX-License-Identifier: MPL-2.0
/**
 * Openly licensed public floor plans for the DXF importer. Ordinary tests need no download.
 *
 *   node scripts/dxf-corpus.ts fetch    download and verify the files into plans/corpora/dxf-floor-plans
 *   node scripts/dxf-corpus.ts run      import each file and write plans/corpora/dxf-floor-plans/report.json
 *   node scripts/dxf-corpus.ts licences print each file's licence, source and attribution
 *
 * scripts/data/dxf-corpus-manifest.json pins every file to a commit and a SHA-256 and records the
 * licence read from the repository's own licence file. A file is checked against its size and
 * SHA-256 before it is written, and only MIT, CC0, CC-BY, CC-BY-SA and Apache licences are admitted.
 * The files stay under plans/ (never committed). `run` fails when a file is absent.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { importDxf, dxfReportLines } from '../engine/src/dxf-import.ts';
import { dxfToDesign } from '../engine/src/dxf-design.ts';
import { loadDxfKernel } from '../packages/node-shell/src/dxf-node.ts';

interface Entry { path: string; url: string; size: number; sha256: string; licence: string; licenceSource: string; attribution: string; source: string; notes?: string }
const root = resolve(import.meta.dirname, '..');
const dir = join(root, 'plans/corpora/dxf-floor-plans');
const digest = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const ADMITTED = /^(?:MIT|CC0-1\.0|CC-BY-[34]\.0|CC-BY-SA-[34]\.0|Apache-2\.0)$/;
const PER_FILE_CAP = 8 * 1024 * 1024;

const [command = 'run'] = process.argv.slice(2);
const manifest = JSON.parse(await readFile(join(root, 'scripts/data/dxf-corpus-manifest.json'), 'utf8')) as { files: Entry[] };

function safePath(path: string): string {
  if (!path || path.startsWith('/') || path.split('/').some(p => !p || p === '..' || p.startsWith('.'))) throw new Error(`Unsafe corpus path: ${path}`);
  return path;
}
for (const e of manifest.files) {
  if (!ADMITTED.test(e.licence)) throw new Error(`${e.path}: licence ${e.licence} is not admitted.`);
  if (!e.url.startsWith('https://') || e.size > PER_FILE_CAP || !e.licenceSource || !e.attribution) throw new Error(`${e.path}: incomplete manifest entry.`);
}
async function verified(e: Entry): Promise<Uint8Array | undefined> {
  try {
    const bytes = new Uint8Array(await readFile(join(dir, safePath(e.path))));
    return bytes.length === e.size && digest(bytes) === e.sha256 ? bytes : undefined;
  } catch { return undefined; }
}

if (command === 'licences') {
  for (const e of manifest.files) console.log(`${e.path}\n  licence: ${e.licence} (${e.licenceSource})\n  attribution: ${e.attribution}\n  source: ${e.source}`);
} else if (command === 'fetch') {
  let failed = 0;
  for (const e of manifest.files) {
    if (await verified(e)) { console.log(`ok       ${e.path}`); continue; }
    try {
      const response = await fetch(e.url, { signal: AbortSignal.timeout(120_000), headers: { 'user-agent': 'lolly-dxf-corpus/1' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length !== e.size || digest(bytes) !== e.sha256) throw new Error('Checksum mismatch');
      const dest = join(dir, safePath(e.path));
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, bytes);
      console.log(`fetched  ${e.path}`);
    } catch (error) { failed++; console.error(`FAILED   ${e.path}: ${(error as Error).message}`); }
  }
  if (failed) process.exitCode = 1;
} else if (command === 'run') {
  const kernel = await loadDxfKernel();
  const rows: unknown[] = [];
  let missing = 0;
  for (const e of manifest.files) {
    const bytes = await verified(e);
    if (!bytes) { missing++; console.error(`MISSING  ${e.path} (run: node scripts/dxf-corpus.ts fetch)`); continue; }
    const t0 = performance.now();
    const imported = importDxf(bytes, { read: kernel.read });
    const design = dxfToDesign(imported);
    const ms = Math.round(performance.now() - t0);
    rows.push({ path: e.path, licence: e.licence, ms, version: imported.report.version, units: imported.report.units.name, layers: imported.report.layersImported.length, entitiesDrawn: imported.report.entitiesDrawn, textItems: imported.report.textItems, designBoxes: design.boxes.length, report: dxfReportLines(imported.report) });
    console.log(`${e.path}: ${imported.report.entitiesDrawn} entities, ${imported.report.textItems} text items, ${design.boxes.length} Design boxes, ${ms} ms`);
  }
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'report.json'), `${JSON.stringify(rows, null, 2)}\n`);
  if (missing) process.exitCode = 1;
} else {
  console.error('Usage: node scripts/dxf-corpus.ts fetch|run|licences');
  process.exitCode = 2;
}
