// SPDX-License-Identifier: MPL-2.0
/** Optional Poppler readback, bounded and isolated from the renderer. */
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { PRODUCTION_MAX_PIXELS, type ProductionContract, type ProductionFacts } from '@lolly/engine';
import { productionRaster } from './production.ts';
const exec = promisify(execFile);
export async function collectProductionPdf(bytes: Uint8Array, contract: ProductionContract, signal?: AbortSignal): Promise<ProductionFacts> {
  const facts: ProductionFacts = { format: 'pdf', limitations: ['pdf-print-colour-and-overprint-unchecked', 'pdf-font-identity-unchecked'] };
  const dir = await mkdtemp(join(tmpdir(), 'lolly-production-'));
  try {
    const file = join(dir, 'input.pdf'); await writeFile(file, bytes);
    const opts = { encoding: 'utf8' as const, timeout: 10_000, maxBuffer: 2 * 1024 * 1024, signal, env: { ...process.env, LC_ALL: 'C' } };
    const { stdout } = await exec('pdfinfo', ['-box', '-f', '1', '-l', '100', file], opts);
    const pages = Number(/^Pages:\s+(\d+)/m.exec(stdout)?.[1]);
    if (!Number.isInteger(pages) || pages < 1 || pages > 100 || /^Encrypted:\s+yes/m.test(stdout)) return { ...facts, limitations: [...facts.limitations, 'pdf-page-budget-or-encrypted'] };
    const sizes = [...stdout.matchAll(/^Page\s+\d+ size:\s+([\d.]+) x ([\d.]+) pts/gm)];
    const single = /^Page size:\s+([\d.]+) x ([\d.]+) pts/m.exec(stdout);
    const dimensions = sizes.length ? sizes.map(m => [Number(m[1]) * 4 / 3, Number(m[2]) * 4 / 3]) : single ? [[Number(single[1]) * 4 / 3, Number(single[2]) * 4 / 3]] : [];
    const rotations = [...stdout.matchAll(/^Page\s+\d+ rot:\s+(-?\d+)/gm)].map(m => Number(m[1]));
    if (rotations.length === pages) for (let i = 0; i < dimensions.length; i++) {
      const rotation = ((rotations[i]! % 360) + 360) % 360;
      if (rotation === 90 || rotation === 270) dimensions[i] = [dimensions[i]![1]!, dimensions[i]![0]!];
      else if (rotation !== 0 && rotation !== 180) dimensions[i] = [NaN, NaN];
    }
    facts.limitations.push('pdfinfo-page-dimensions-have-decimal-rounding');
    facts.pages = pages;
    if (dimensions.length === pages && dimensions.every(d => d[0] === dimensions[0]![0] && d[1] === dimensions[0]![1])) {
      facts.width = dimensions[0]![0]; facts.height = dimensions[0]![1];
    } else facts.limitations.push('pdf-mixed-or-unread-page-sizes');
    facts.records = { pdfBoxes: stdout.trim() };
    const text = await exec('pdftotext', ['-layout', '-enc', 'UTF-8', file, '-'], opts);
    const extracted = text.stdout.split('\f'); facts.text = {};
    for (let page = 1; page <= pages; page++) facts.text[`page:${page}`] = (extracted[page - 1] ?? '').trim();
    facts.readable = true;
    facts.limitations.push('pdf-text-extraction-does-not-prove-visibility');
    if (contract.comparison || contract.alpha !== 'any') {
      if (pages !== 1 || !facts.width || !facts.height || Math.ceil(facts.width) * Math.ceil(facts.height) > PRODUCTION_MAX_PIXELS) facts.limitations.push('pdf-pixel-budget-or-multiple-pages');
      else {
        await exec('pdftoppm', ['-f', '1', '-singlefile', '-cropbox', '-scale-dimension-before-rotation', '-r', '96', '-png', file, join(dir, 'page')], opts);
        const raster = await productionRaster(new Uint8Array(await readFile(join(dir, 'page.png'))), signal);
        facts.pixels = raster.pixels; facts.opaque = raster.opaque;
      }
    }
    return facts;
  } catch { signal?.throwIfAborted(); facts.limitations.push('poppler-unavailable-or-readback-failed'); return facts; }
  finally { await rm(dir, { recursive: true, force: true }); }
}
