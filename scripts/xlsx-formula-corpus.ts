// SPDX-License-Identifier: MPL-2.0
/**
 * Recalculates a pinned set of Excel-saved workbooks and compares every cell with the
 * result the workbook saved. A requested run, not part of `pnpm test`: it needs the
 * files, which are fetched into ignored storage.
 *
 *   node scripts/xlsx-formula-corpus.ts --fetch      # download what is missing, verify checksums
 *   node scripts/xlsx-formula-corpus.ts              # compare; fails when a file is absent
 *   node scripts/xlsx-formula-corpus.ts --dir=PATH   # use another cache directory
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { createCalcEngine, xlsxRecalculator } from '../engine/src/calc.ts';
import { openXlsx } from '../engine/src/xlsx-import.ts';
import { compileGridcraftCalc, createGridcraftCalcRunner } from '../packages/node-shell/src/gridcraft-calc.ts';

interface Entry { path: string; bytes: number; sha256: string }
interface Recipe {
  repository: string; commit: string; directory: string; files: Entry[];
  knownDifferences: Record<string, Record<string, Record<string, string>>>;
}
const root = resolve(import.meta.dirname, '..');
const recipe = JSON.parse(await readFile(join(root, 'scripts/data/xlsx-formula-corpus.json'), 'utf8')) as Recipe;
const cache = resolve(root, process.argv.find(s => s.startsWith('--dir='))?.slice(6) ?? 'plans/corpora/poi-xlsx-formulas');
const digest = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

if (recipe.repository !== 'apache/poi' || !/^[a-f0-9]{40}$/.test(recipe.commit) || recipe.files.length > 64
  || recipe.files.some(f => !/^[\w.-]+\.xlsx$/.test(f.path) || !Number.isSafeInteger(f.bytes) || f.bytes < 1 || f.bytes > 1024 * 1024 || !/^[a-f0-9]{64}$/.test(f.sha256))) {
  throw new Error('Invalid corpus recipe.');
}

async function verified(file: Entry): Promise<Uint8Array> {
  const bytes = new Uint8Array(await readFile(join(cache, file.path)));
  if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error(`Corpus checksum mismatch: ${file.path}`);
  return bytes;
}

if (process.argv.includes('--fetch')) {
  await mkdir(cache, { recursive: true });
  for (const file of recipe.files) {
    try { await verified(file); continue; } catch { /* fetch the missing or changed file */ }
    const response = await fetch(`https://raw.githubusercontent.com/${recipe.repository}/${recipe.commit}/${recipe.directory}/${file.path}`, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error(`Corpus download failed: ${file.path}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length !== file.bytes || digest(bytes) !== file.sha256) throw new Error(`Corpus checksum mismatch after download: ${file.path}`);
    await writeFile(join(cache, file.path), bytes);
  }
}

const wasm = await readFile(join(root, 'packages/node-shell/wasm/gridcraft-calc/gridcraft-calc.wasm'));
const engine = createCalcEngine(createGridcraftCalcRunner(await compileGridcraftCalc(new Uint8Array(wasm))), () => ({ now: Date.UTC(2026, 10, 3, 12), seed: 1 }));
const recalc = xlsxRecalculator(engine);
const close = (a: string, b: string): boolean => {
  const x = Number(a), y = Number(b);
  return a !== '' && b !== '' && Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= 1e-12 * Math.max(Math.abs(x), Math.abs(y), 1);
};
const colName = (c: number): string => (c >= 26 ? colName(Math.floor(c / 26) - 1) : '') + String.fromCharCode(65 + (c % 26));

let formulas = 0, compared = 0, known = 0;
const failures: string[] = [];
for (const file of recipe.files) {
  let bytes: Uint8Array;
  try { bytes = await verified(file); } catch (error) { failures.push(`${file.path}: ${(error as Error).message} (run with --fetch)`); continue; }
  const book = openXlsx(bytes);
  for (const sheet of book.sheets()) {
    let saved: ReturnType<typeof book.read>, fresh: ReturnType<typeof book.read>;
    try {
      saved = book.read({ sheet: sheet.index, limit: 100_000 });
      fresh = book.read({ sheet: sheet.index, limit: 100_000, recalc });
    } catch { continue; } // a sheet with no cells
    if (fresh.recalc?.failed) { failures.push(`${file.path} [${sheet.name}]: recalculation failed: ${fresh.recalc.failed}`); continue; }
    formulas += fresh.recalc?.recomputed ?? 0;
    const allowed = recipe.knownDifferences[file.path]?.[sheet.name] ?? {};
    for (let r = 0; r < Math.max(saved.rows.length, fresh.rows.length); r++) {
      for (let c = 0; c < Math.max(saved.rows[r]?.length ?? 0, fresh.rows[r]?.length ?? 0); c++) {
        const a = saved.rows[r]?.[c] ?? '', b = fresh.rows[r]?.[c] ?? '';
        compared++;
        if (a === b || close(a, b)) continue;
        const ref = `${colName(c)}${r + 1}`;
        if (ref in allowed) { known++; continue; }
        failures.push(`${file.path} [${sheet.name}] ${ref}: saved ${JSON.stringify(a)}, recalculated ${JSON.stringify(b)}`);
      }
    }
  }
}
console.log(`${recipe.files.length} workbooks, ${compared} cells compared, ${formulas} formulas recalculated, ${known} known differences`);
if (failures.length) {
  console.error(failures.slice(0, 40).join('\n') + (failures.length > 40 ? `\n... and ${failures.length - 40} more` : ''));
  process.exit(1);
}
