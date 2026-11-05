// SPDX-License-Identifier: MPL-2.0
/**
 * PDF export oracle policy (plan 342 O5). Output of the web shell's PDF writer is checked by independent programs
 * run as external processes:
 *   qpdf --check     structural validity (xref, streams, object graph)
 *   pdftotext        the text layer reads back
 *   pdftoppm         the page rasterises, at the expected size, and is not blank
 *
 * Policy, after pdfcraft crates/oracle: a missing oracle is a declared skip locally, named by tool, and a failure when
 * LOLLY_ORACLES_REQUIRED=1. It is never a silent pass.
 *
 * Off hosted CI: this file lives in scripts/, which is not one of TEST_ROOTS in scripts/run-test-suite.ts,
 * so `pnpm test` and every CI shard never discover this file. It runs on request:
 *   pnpm run test:oracles
 *   LOLLY_ORACLES_REQUIRED=1 pnpm run test:oracles    (fails if qpdf, pdftotext or pdftoppm is absent)
 * As a second guard, when GITHUB_ACTIONS is set it is a declared skip unless LOLLY_ORACLES_REQUIRED=1.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createPdfDoc } from '../shells/web/src/bridge/export-pdf-doc.ts';
import { decodePng } from '../tests/helpers/raster-oracle.ts';

const required = process.env.LOLLY_ORACLES_REQUIRED === '1';
const hostedCi = process.env.GITHUB_ACTIONS === 'true' && !required;
type Tool = 'qpdf' | 'pdftotext' | 'pdftoppm';
const versionFlag: Record<Tool, string> = { qpdf: '--version', pdftotext: '-v', pdftoppm: '-v' };

/** The first line a tool prints for its version, or null when it cannot be run. */
function probe(tool: Tool): string | null {
  const r = spawnSync(tool, [versionFlag[tool]], { encoding: 'utf8' });
  if (r.error) return null;
  return `${r.stdout}${r.stderr}`.split('\n').find(Boolean)?.trim() ?? tool;
}
const found = { qpdf: probe('qpdf'), pdftotext: probe('pdftotext'), pdftoppm: probe('pdftoppm') };

/** Returns a skip reason for a missing oracle, or throws when the run requires the oracle. */
function missing(tool: Tool): string | false {
  if (found[tool]) return false;
  if (required) throw new Error(`oracle ${tool} is not installed and LOLLY_ORACLES_REQUIRED=1`);
  return `declared skip: oracle ${tool} is not installed (install it, or set LOLLY_ORACLES_REQUIRED=1 to make this a failure)`;
}
const skipFor = (tool: Tool): string | false => {
  if (hostedCi) return 'declared skip: hosted CI does not run PDF oracles (set LOLLY_ORACLES_REQUIRED=1 to force)';
  try { return missing(tool); } catch { return false; } // the required case fails inside the test body instead
};

const OUTFIT = fileURLToPath(new URL('../shells/web/public/fonts/Outfit[wght].ttf', import.meta.url));
const work = mkdtempSync(join(tmpdir(), 'lolly-pdf-oracle-'));
test.after(() => rmSync(work, { recursive: true, force: true }));

interface Sample { name: string; width: number; height: number; text: string[]; build: () => Promise<Uint8Array> }
const samples: Sample[] = [
  {
    name: 'shapes and alpha', width: 300, height: 200, text: [],
    async build() {
      const doc = await createPdfDoc({ format: [300, 200] });
      doc.setFillColor(220, 30, 30); doc.rect(20, 20, 120, 80, 'F');
      doc.setDrawColor(0, 0, 160); doc.setLineWidth(4); doc.circle(200, 120, 40, 'S');
      return new Uint8Array(await doc.output('arraybuffer') as ArrayBuffer);
    },
  },
  {
    name: 'base-14 text', width: 400, height: 120, text: ['Lolly oracle', 'second line'],
    async build() {
      const doc = await createPdfDoc({ format: [400, 120] });
      doc.setFont('helvetica', 'normal'); doc.setFontSize(24); doc.setTextColor(0, 0, 0);
      doc.text('Lolly oracle', 20, 40); doc.text('second line', 20, 80);
      return new Uint8Array(await doc.output('arraybuffer') as ArrayBuffer);
    },
  },
  {
    name: 'embedded TrueType subset on two pages', width: 200, height: 100, text: ['Page one', 'Page two'],
    async build() {
      const doc = await createPdfDoc({ format: [200, 100] });
      doc.addFileToVFS('Outfit.ttf', readFileSync(OUTFIT).toString('base64')); doc.addFont('Outfit.ttf', 'Outfit', 'w400');
      doc.setFont('Outfit', 'w400'); doc.setFontSize(18); doc.setTextColor(0, 0, 0);
      doc.text('Page one', 10, 50); doc.addPage([200, 100]); doc.setFont('Outfit', 'w400'); doc.setFontSize(18); doc.text('Page two', 10, 50);
      return new Uint8Array(await doc.output('arraybuffer') as ArrayBuffer);
    },
  },
];

const run = (tool: Tool, args: string[]) => spawnSync(tool, args, { encoding: 'utf8' });

for (const s of samples) {
  const fontMissing = s.name.includes('TrueType') && !existsSync(OUTFIT) ? 'declared skip: no platform font fixture on disk' : false;
  test(`${s.name}: qpdf --check`, { skip: fontMissing || skipFor('qpdf') }, async () => {
    missing('qpdf');
    const file = join(work, `${s.name.replace(/\W+/g, '-')}.pdf`); writeFileSync(file, await s.build());
    const r = run('qpdf', ['--check', file]);
    assert.equal(r.status, 0, `qpdf --check exit ${r.status}\n${r.stdout}${r.stderr}`);
    assert.match(r.stdout + r.stderr, /No syntax or stream encoding errors found/);
  });
  test(`${s.name}: pdftotext reads the text layer`, { skip: fontMissing || skipFor('pdftotext') }, async () => {
    missing('pdftotext');
    const file = join(work, `${s.name.replace(/\W+/g, '-')}-t.pdf`); writeFileSync(file, await s.build());
    const r = run('pdftotext', ['-layout', file, '-']);
    assert.equal(r.status, 0, r.stderr);
    for (const line of s.text) assert.ok(r.stdout.includes(line), `pdftotext did not find "${line}" in ${JSON.stringify(r.stdout)}`);
    if (!s.text.length) assert.equal(r.stdout.trim(), '', 'a page with only shapes has no text');
  });
  test(`${s.name}: pdftoppm rasterises a page of the right size that is not blank`, { skip: fontMissing || skipFor('pdftoppm') }, async () => {
    missing('pdftoppm');
    const base = join(work, `${s.name.replace(/\W+/g, '-')}-r`), file = `${base}.pdf`; writeFileSync(file, await s.build());
    const r = run('pdftoppm', ['-png', '-r', '72', '-f', '1', '-l', '1', '-singlefile', file, base]);
    assert.equal(r.status, 0, r.stderr);
    const png = decodePng(new Uint8Array(readFileSync(`${base}.png`)));
    assert.ok(Math.abs(png.width - s.width) <= 1 && Math.abs(png.height - s.height) <= 1, `${png.width}x${png.height} for a ${s.width}x${s.height} pt page at 72 dpi`);
    let ink = 0;
    for (let i = 0; i < png.pixels.length; i += 4) if (png.pixels[i]! < 240 || png.pixels[i + 1]! < 240 || png.pixels[i + 2]! < 240) ink++;
    assert.ok(ink > 20, `the page rendered blank (${ink} inked pixels)`);
  });
}
