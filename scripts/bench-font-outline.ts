// SPDX-License-Identifier: MPL-2.0
/**
 * Baseline benchmark of the CURRENT text→outline method, plus an optional
 * skera comparison stage (plan 88 - Font Outliner).
 *
 * "Current method" = HarfBuzz WASM shaping + glyph→SVG-path extraction behind
 * host.text.toPath. This runs packages/node-shell/src/text.ts, the faithful
 * Node port of shells/web/src/bridge/text.ts - same WASM, same math - so the
 * numbers stand for both the web and terminal shells.
 *
 * What it measures per (font × corpus):
 *   cold ms     first toPath in-process (WASM compile + face parse amortised
 *               into the very first row; per-font face parse into each font's
 *               first row)
 *   warm median/p95/min over N iterations, and chars/sec from the median
 *   path bytes  size of the emitted SVG `d` string
 *   notdef      glyphs no face covered (coverage signal)
 *   determinism two warm runs must emit identical bytes (asserted, not timed)
 *
 * skera stage (runs only when a binary is found - cargo install skera
 * --features cli, or SKERA_BIN=…): subsets each font to each corpus's
 * codepoints, reports subset time + size vs original, then shapes the SAME
 * text through the ORIGINAL and the SUBSET font via the same pipeline and
 * diffs the results. Identical paths = skera's output is drop-in drawable
 * for our pipeline. Variable fonts are additionally checked at wght=700
 * through the subset (did gvar survive?).
 *
 * Usage:
 *   node scripts/bench-font-outline.ts [--iters=30] [--json=<path>]
 *
 * Re-run when skera matures (v1.0.0 expected EoY 2026) and diff the JSON
 * against the baseline recorded in plan 88.
 */
import { existsSync, readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { createNodeTextAPI } from '../packages/node-shell/src/text.ts';
import { findSkera, skeraVersion, skeraSubset } from '../tests/helpers/skera.ts';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

// ── CLI args ─────────────────────────────────────────────────────────────────
const args = new Map<string, string>();
for (const a of process.argv.slice(2)) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) args.set(m[1]!, m[2] ?? '1');
}
const ITERS = Math.max(3, Number(args.get('iters') ?? 30));
const JSON_OUT = args.get('json') ?? null;

// ── fixtures ─────────────────────────────────────────────────────────────────
interface FontCase {
  label: string;
  /** host.text fontUrl form (rooted → resolved under the repo root). */
  url: string;
  /** Disk path for existence checks and for handing to skera. */
  disk: string;
  variations?: string[];
  variable: boolean;
}

const FONT_CASES: FontCase[] = [
  {
    label: 'Outfit VF (default)',
    url: '/fonts/Outfit[wght].ttf',
    disk: join(REPO_ROOT, 'shells/web/public/fonts/Outfit[wght].ttf'),
    variable: true,
  },
  {
    label: 'Outfit VF (wght=700)',
    url: '/fonts/Outfit[wght].ttf',
    disk: join(REPO_ROOT, 'shells/web/public/fonts/Outfit[wght].ttf'),
    variations: ['wght=700'],
    variable: true,
  },
  {
    label: 'SUSE-SemiBold (static)',
    url: '/catalog/fonts/ttf/SUSE-SemiBold.ttf',
    disk: join(REPO_ROOT, 'catalog/fonts/ttf/SUSE-SemiBold.ttf'),
    variable: false,
  },
  {
    label: 'SUSE VF (default)',
    url: '/catalog/fonts/variable/SUSE[wght].ttf',
    disk: join(REPO_ROOT, 'catalog/fonts/variable/SUSE[wght].ttf'),
    variable: true,
  },
];

const PARAGRAPH =
  'Lolly generates on-brand creative assets from simple inputs: one engine, many shells, ' +
  'tools as data. Constraint-first means the template carries the design and the person ' +
  'carries the message - QR codes, quote cards, signage, charts, badges and decks that ' +
  'ship correct the first time, in the brand, without a designer in the loop. 0123456789.';

const CORPORA: Array<{ id: string; label: string; text: string }> = [
  { id: 'label', label: 'short label (13 ch)', text: 'Hello, Lolly!' },
  {
    id: 'pangram',
    label: 'pangram + figures (68 ch)',
    text: 'The quick brown fox jumps over the lazy dog - fi ffl AVATAR 0123456789.',
  },
  { id: 'paragraph', label: `paragraph (${PARAGRAPH.length} ch)`, text: PARAGRAPH },
  { id: 'long', label: `long run (${PARAGRAPH.length * 20} ch)`, text: PARAGRAPH.repeat(20) },
  { id: 'notdef', label: 'coverage miss (CJK)', text: 'Lolly 日本語のテスト 中文测试' },
];

// ── helpers ──────────────────────────────────────────────────────────────────
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}
function p95(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(s.length * 0.95) - 1)]!;
}
const ms = (n: number) => n.toFixed(2);
const kb = (n: number) => `${(n / 1024).toFixed(1)} KB`;

// ── run ──────────────────────────────────────────────────────────────────────
const api = createNodeTextAPI({ repoRoot: REPO_ROOT });
const report: Record<string, unknown> = {
  generated: new Date().toISOString(),
  node: process.version,
  method: 'harfbuzzjs (HarfBuzz WASM) via packages/node-shell/src/text.ts',
  iters: ITERS,
  fonts: {},
  skera: null,
};

const fonts = FONT_CASES.filter((f) => existsSync(f.disk));
const skipped = FONT_CASES.filter((f) => !existsSync(f.disk));
for (const f of skipped) console.log(`skip: ${f.label} - ${f.disk} not mounted`);
if (!fonts.length) {
  console.error('No benchmark fonts found - is this a full checkout?');
  process.exit(1);
}

console.log(`\n## Current method - HarfBuzz WASM toPath (${ITERS} warm iters, Node ${process.version})\n`);
console.log('| font | corpus | cold ms | warm med | warm p95 | kchars/s | path bytes | notdef |');
console.log('|---|---|---|---|---|---|---|---|');

for (const font of fonts) {
  const fontRows: Record<string, unknown>[] = [];
  for (const corpus of CORPORA) {
    const opts = {
      text: corpus.text,
      fontUrl: font.url,
      fontSize: 64,
      ...(font.variations ? { variations: font.variations } : {}),
    };
    const t0 = performance.now();
    const first = await api.toPath(opts);
    const cold = performance.now() - t0;

    const times: number[] = [];
    let out = first;
    for (let i = 0; i < ITERS; i++) {
      const s = performance.now();
      out = await api.toPath(opts);
      times.push(performance.now() - s);
    }
    if (out.d !== first.d) throw new Error(`non-deterministic output: ${font.label} / ${corpus.id}`);

    const med = median(times);
    const row = {
      corpus: corpus.id,
      chars: corpus.text.length,
      coldMs: +cold.toFixed(3),
      warmMedianMs: +med.toFixed(3),
      warmP95Ms: +p95(times).toFixed(3),
      warmMinMs: +Math.min(...times).toFixed(3),
      kcharsPerSec: +(corpus.text.length / med).toFixed(1),
      pathBytes: out.d.length,
      advanceWidth: +out.advanceWidth.toFixed(2),
      notdef: out.notdef,
    };
    fontRows.push(row);
    console.log(
      `| ${font.label} | ${corpus.label} | ${ms(cold)} | ${ms(med)} | ${ms(p95(times))} | ` +
        `${row.kcharsPerSec} | ${row.pathBytes} | ${row.notdef} |`,
    );
  }
  (report.fonts as Record<string, unknown>)[font.label] = fontRows;
}

// ── skera stage ──────────────────────────────────────────────────────────────
const skeraBin = findSkera();
if (!skeraBin) {
  console.log(
    '\nskera stage skipped - no binary found. Install with `cargo install skera --features cli` ' +
      'or set SKERA_BIN, then re-run for the subset quality/perf comparison.',
  );
} else {
  const version = skeraVersion(skeraBin);
  console.log(`\n## skera stage - ${version} (${skeraBin})\n`);
  console.log('| font | corpus | subset ms | original | subset | parity (default) | parity (wght=700) |');
  console.log('|---|---|---|---|---|---|---|');
  const skeraRows: Record<string, unknown>[] = [];
  const workDir = mkdtempSync(join(tmpdir(), 'lolly-skera-bench-'));

  // One font entry per distinct file (variation cases share the file).
  const uniqueFonts = fonts.filter((f) => !f.variations);
  for (const font of uniqueFonts) {
    for (const corpus of CORPORA) {
      const outPath = join(workDir, `${font.label.replace(/\W+/g, '_')}-${corpus.id}.ttf`);
      let subsetMs: number;
      try {
        subsetMs = skeraSubset(skeraBin, font.disk, corpus.text, outPath);
      } catch (e) {
        console.log(`| ${font.label} | ${corpus.label} | FAILED: ${(e as Error).message} | | | | |`);
        skeraRows.push({ font: font.label, corpus: corpus.id, error: (e as Error).message });
        continue;
      }
      const origBytes = readFileSync(font.disk).length;
      const subBytes = readFileSync(outPath).length;
      const subUrl = pathToFileURL(outPath).href;

      const base = { text: corpus.text, fontSize: 64 };
      const orig = await api.toPath({ ...base, fontUrl: font.url });
      const sub = await api.toPath({ ...base, fontUrl: subUrl });
      const parity =
        orig.d === sub.d && Math.abs(orig.advanceWidth - sub.advanceWidth) < 1e-6 && orig.notdef === sub.notdef;

      let varParity: boolean | null = null;
      if (font.variable) {
        const origV = await api.toPath({ ...base, fontUrl: font.url, variations: ['wght=700'] });
        const subV = await api.toPath({ ...base, fontUrl: subUrl, variations: ['wght=700'] });
        varParity = origV.d === subV.d && Math.abs(origV.advanceWidth - subV.advanceWidth) < 1e-6;
      }

      skeraRows.push({
        font: font.label,
        corpus: corpus.id,
        subsetMs: +subsetMs.toFixed(2),
        originalBytes: origBytes,
        subsetBytes: subBytes,
        parityDefault: parity,
        parityWght700: varParity,
      });
      console.log(
        `| ${font.label} | ${corpus.label} | ${ms(subsetMs)} | ${kb(origBytes)} | ${kb(subBytes)} | ` +
          `${parity ? 'IDENTICAL' : 'DIVERGED'} | ${varParity === null ? 'n/a' : varParity ? 'IDENTICAL' : 'DIVERGED'} |`,
      );
    }
  }
  report.skera = { version, bin: skeraBin, rows: skeraRows };
}

if (JSON_OUT) {
  writeFileSync(JSON_OUT, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`\nJSON report written to ${JSON_OUT}`);
}
