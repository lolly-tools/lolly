#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * doc-quality-bench.ts - the MANUAL half of plan 139's quality harness (WP6):
 * the side-by-side report a human reviews before believing a fidelity claim.
 *
 * Run as: node scripts/doc-quality-bench.ts [corpusDir] [--out dir] [--no-render]
 *         node scripts/doc-quality-bench.ts --help
 *
 * ── THE METHOD (adopted from anydoc's bench/) ────────────────────────────────
 * LibreOffice is the ground truth renderer: `soffice --headless --convert-to pdf`
 * turns both the ORIGINAL document and the ROUND-TRIPPED one into PDFs, and the
 * report puts them beside each other. No image diff and no score is computed
 * from the pixels; a person looks. Alongside each pair sit two deterministic
 * numbers that a person cannot eyeball: the structure counts of the extracted
 * markdown, and word-trigram containment.
 *
 * ── WHAT THE NUMBERS DO AND DO NOT MEAN ──────────────────────────────────────
 * Containment here is measured against THE READER'S OWN EXTRACTION: the source
 * side is the text units the read model recovered, the emitted side is the
 * markdown serialised from that same model. So it measures SERIALISER loss, not
 * reader recall. If the reader never saw a text box, both sides are equally
 * blind and the score stays 1.0. Nothing in this script can measure what the
 * reader missed, because that would need an independent extraction of the same
 * file, which is what the soffice render is for: the human comparison is the
 * recall check.
 *
 * An LLM pairwise judge (anydoc's judge.py) is deliberately OUT of v1. It needs
 * a network call per document, it is not reproducible run to run, and the two
 * deterministic metrics plus a human look already catch the failures this stage
 * of the work has. Add it when a quality argument is genuinely too subtle for
 * the side-by-side, not before.
 *
 * ── SCOPE AND SAFETY ─────────────────────────────────────────────────────────
 * The corpus is real customer and personal work, so it lives OUTSIDE the repo
 * and is never committed: the script refuses a corpus path or an output path
 * inside the working tree. Only `.xml` and `.rels` parts are inflated, which
 * bounds memory and leaves embedded media on disk untouched.
 *
 * NOT wired into package.json on purpose: it needs a binary and a private
 * directory, so it cannot be a CI step. The CI half is tests/doc-quality.test.ts.
 * The suggested manual alias, if one is ever wanted:
 *   "bench:doc-quality": "node scripts/doc-quality-bench.ts"
 */

import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { JSDOM } from 'jsdom'; // typed by scripts/jsdom.d.ts (no @types/jsdom exists)
import { unzipSync } from 'fflate';

import { deckToMarkdown } from '../engine/src/deck-md.ts';
import { isPptx, readPptx } from '../engine/src/pptx-read.ts';
import type { PptxDeckRead, PptxParts, PptxTableNode, PptxTextNode } from '../engine/src/pptx-read.ts';
import { isDocx, readDocx } from '../engine/src/docx-read.ts';
import type { DocxParts } from '../engine/src/docx-read.ts';
import { writeDocx } from '../engine/src/docx.ts';
import { mdFromBlocks } from '../engine/src/doc-md.ts';
import type { DocBlock, DocInline } from '../engine/src/doc-model.ts';
import { buildPptxParts } from '../engine/src/pptx.ts';
import type { PptxLayout, PptxShape, PptxSlide } from '../engine/src/pptx.ts';
import { storeZip } from '../engine/src/zip.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import type { HostV1 } from '../packages/core/src/host-v1.ts';
import {
  asStr, deckFill, deckPlaceholder, deckSyncShape, deckTheme, emuOf, parseDeckModel,
} from '../shells/web/src/bridge/pptx-deck.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Read cap on one corpus file, before a byte is inflated. */
const MAX_FILE_BYTES = 512 * 1024 * 1024;
/** Per-part inflate cap. A corpus file is trusted-ish but not audited. */
const MAX_PART_BYTES = 32 * 1024 * 1024;
/** Whole-archive inflate cap across the parts kept. */
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;
/** A soffice conversion that has not finished by here is a hang, not slow work. */
const RENDER_TIMEOUT_MS = 180_000;
const MAX_DECK_SLIDES = 500;
const MAX_DECK_ELEMENTS = 2000;

// ─── metrics (tests/doc-quality.test.ts owns the canonical definitions) ───────
// Duplicated rather than imported: importing a *.test.ts module would register
// and run its assertions. Any change to the metric belongs in that file first.

interface Structure {
  headings: number;
  listItems: number;
  tableCells: number;
  links: number;
  images: number;
  footnotes: number;
}

const isDelimiterRow = (line: string): boolean => /^\|[\s:|-]*\|$/.test(line);
const cellsIn = (line: string): number => line.trim().slice(1, -1).split(/(?<!\\)\|/).length;

function countStructure(md: string): Structure {
  const out: Structure = { headings: 0, listItems: 0, tableCells: 0, links: 0, images: 0, footnotes: 0 };
  for (const line of md.split('\n')) {
    const t = line.trim();
    if (/^#{1,6}\s/.test(t)) out.headings++;
    else if (/^(?:[-*+]|\d+[.)])\s/.test(t)) out.listItems++;
    else if (t.startsWith('|') && t.endsWith('|') && !isDelimiterRow(t)) out.tableCells += cellsIn(t);
  }
  out.links = (md.match(/(?<![!\\])\[(?!\^)[^\]]*\]\([^)]*\)/g) ?? []).length;
  out.images = (md.match(/!\[[^\]]*\]\([^)]*\)/g) ?? []).length;
  out.footnotes = (md.match(/\[\^[^\]\s]+\]/g) ?? []).length;
  return out;
}

const words = (s: string): string[] =>
  s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').split(' ').filter(Boolean);

function trigrams(s: string): string[] {
  const w = words(s);
  const out: string[] = [];
  for (let i = 0; i + 2 < w.length; i++) out.push(`${w[i]} ${w[i + 1]} ${w[i + 2]}`);
  return out;
}

/** A markdown destination is markup, not prose: `[label](url)` compares as `label`. */
const stripDestinations = (md: string): string => md.replace(/\]\([^)]*\)/g, ']');

/** Fraction of the sources' trigrams present in the emitted text. Sources are
 *  scored separately, so adjacency never crosses two of them. Under three words
 *  yields no trigram and is exempt. */
function containment(sources: string[], emitted: string): { score: number; total: number } {
  const have = new Set(trigrams(stripDestinations(emitted)));
  let total = 0;
  let hit = 0;
  for (const src of sources) {
    for (const t of trigrams(src)) {
      total++;
      if (have.has(t)) hit++;
    }
  }
  return { score: total ? hit / total : 1, total };
}

// ─── source text units, straight off each read model ─────────────────────────

/** One unit per pptx paragraph, table cell and speaker note. Footer, slide-number
 *  and date placeholders are furniture the serialiser drops on purpose. */
function deckSources(deck: PptxDeckRead): string[] {
  const out: string[] = [];
  const furniture = new Set(['ftr', 'sldNum', 'dt']);
  for (const slide of deck.slides ?? []) {
    for (const node of slide?.nodes ?? []) {
      if (node.type === 'text') {
        if (furniture.has((node as PptxTextNode).ph?.type ?? '')) continue;
        for (const para of (node as PptxTextNode).paras ?? []) {
          out.push((para.runs ?? []).map((r) => r.text ?? '').join(''));
        }
      } else if (node.type === 'table') {
        for (const row of (node as PptxTableNode).rows ?? []) out.push(...row);
      }
    }
    if (slide?.notes) out.push(slide.notes);
  }
  return out;
}

function plainInlines(nodes: DocInline[]): string {
  let out = '';
  for (const n of nodes ?? []) {
    if (n.type === 'text' || n.type === 'code') out += n.text;
    else if ('inlines' in n) out += plainInlines(n.inlines);
  }
  return out;
}

/** One unit per block, list item and table cell. */
function blockSources(blocks: DocBlock[]): string[] {
  const out: string[] = [];
  for (const b of blocks ?? []) {
    switch (b.type) {
      case 'heading':
      case 'para':
      case 'quote':
      case 'footnote':
        out.push(plainInlines(b.inlines));
        break;
      case 'list':
        for (const item of b.items ?? []) out.push(plainInlines(item.inlines));
        break;
      case 'table':
        for (const c of b.header ?? []) out.push(plainInlines(c.inlines));
        for (const row of b.rows ?? []) for (const c of row) out.push(plainInlines(c.inlines));
        break;
      case 'code':
        out.push(b.text);
        break;
      case 'image':
        out.push(b.alt);
        break;
    }
  }
  return out;
}

// ─── zip + xml ───────────────────────────────────────────────────────────────

const win = new JSDOM('').window;
const domParser = new win.DOMParser();
const parseXml = (xml: string): Document =>
  domParser.parseFromString(xml, 'application/xml') as unknown as Document;

/**
 * Inflate only the parts a reader needs. Media bytes stay on disk: the readers
 * report media as part PATHS, so inflating a 400 MB video would buy nothing and
 * cost the whole heap.
 */
function inflateParts(bytes: Uint8Array): Record<string, Uint8Array> {
  let total = 0;
  return unzipSync(bytes, {
    filter: (f) => {
      const keep = f.name.endsWith('.xml') || f.name.endsWith('.rels');
      if (!keep || f.originalSize > MAX_PART_BYTES) return false;
      total += f.originalSize;
      return total <= MAX_TOTAL_BYTES;
    },
  });
}

// ─── the deck-studio round trip (the tests/deck-roundtrip.test.ts pattern) ───

const PACK_DIR = join(ROOT, 'community');
const fetchFile = async (path: string): Promise<string> =>
  readFileSync(join(PACK_DIR, path), 'utf8');

/** Only what deck-studio's hook reads; the same floor tests/helpers/host.ts sets. */
const benchHost = (): HostV1 => ({
  version: '1',
  profile: { get: async () => ({}) },
  assets: { get: async (id: string) => ({ id, url: `asset:${id}` }) },
  log: () => {},
} as unknown as HostV1);

let deckStudio: Awaited<ReturnType<typeof loadTool>> | null = null;

/** Markdown in, deck-studio's own `[data-pptx-deck]` model out. Real tool, real
 *  hook, real runtime, so the bench exercises the same path the shell exports. */
async function markdownToDeckModel(markdown: string): Promise<Record<string, unknown> | null> {
  deckStudio ??= await loadTool('deck-studio', fetchFile);
  const rt = await createRuntime(deckStudio, benchHost(), { spec: markdown });
  const doc = new JSDOM(String(rt.getHydrated())).window.document;
  return parseDeckModel(doc.querySelector('[data-pptx-deck]')?.textContent);
}

/**
 * Lower deck-studio's model to the engine's slide model. This is the SYNCHRONOUS
 * half of shells/web/src/bridge/export-pptx.ts: image elements are dropped
 * because embedding them needs the shell's async fetch, which has no meaning
 * without a browser. A round-tripped deck therefore shows text, tables and the
 * branded layout furniture, and the report says so.
 */
function deckModelToPptx(model: Record<string, unknown>): Uint8Array {
  const size = model.size as { w?: unknown; h?: unknown } | undefined;
  const emuW = Math.max(1, emuOf(size?.w, 1280));
  const emuH = Math.max(1, emuOf(size?.h, 720));

  const shapesOf = (els: unknown): PptxShape[] => {
    const out: PptxShape[] = [];
    for (const el of (Array.isArray(els) ? els : []).slice(0, MAX_DECK_ELEMENTS)) {
      const shape = deckSyncShape(el as Record<string, unknown>);
      if (shape) out.push(shape);
    }
    return out;
  };

  const rawLayouts = Array.isArray(model.layouts) ? model.layouts : [];
  const layouts: PptxLayout[] = rawLayouts.map((raw) => {
    const L = (raw ?? {}) as Record<string, unknown>;
    const placeholders = (Array.isArray(L.placeholders) ? L.placeholders : [])
      // Arrow, not a bare reference: deckPlaceholder's 2nd arg is now the optional
      // colour resolver (plan 179 A12), which Array#map would fill with the index.
      .map((p: unknown) => deckPlaceholder(p))
      .filter((p): p is NonNullable<ReturnType<typeof deckPlaceholder>> => p != null);
    return { name: asStr(L.name) ?? 'Layout', bg: deckFill(L.bg), shapes: shapesOf(L.elements), media: [], placeholders };
  });

  const slides: PptxSlide[] = [];
  const rawSlides = Array.isArray(model.slides) ? model.slides : [];
  for (const raw of rawSlides.slice(0, MAX_DECK_SLIDES)) {
    const s = (raw ?? {}) as Record<string, unknown>;
    const shapes: PptxShape[] = [];
    const bg = deckFill(s.bg);
    if (bg) shapes.push({ kind: 'rect', x: 0, y: 0, cx: emuW, cy: emuH, fill: bg });
    shapes.push(...shapesOf(s.elements));
    const slide: PptxSlide = { shapes, media: [] };
    const notes = asStr(s.notes)?.trim();
    if (notes) slide.notes = notes;
    if (layouts.length && typeof s.layout === 'number' && Number.isFinite(s.layout)) slide.layout = s.layout;
    slides.push(slide);
  }

  const parts = buildPptxParts(slides, {
    emuW, emuH,
    theme: deckTheme(model.theme),
    layouts: layouts.length ? layouts : undefined,
    now: new Date().toISOString(),
  });
  const enc = new TextEncoder();
  return storeZip(
    Object.entries(parts).map(([name, v]) => ({ name, bytes: typeof v === 'string' ? enc.encode(v) : v })),
  );
}

// ─── soffice ─────────────────────────────────────────────────────────────────

/** The binary name when it both resolves and runs, else null. Running `--version`
 *  rather than testing PATH catches an install that is present but broken. */
function sofficeOnPath(): string | null {
  const probe = spawnSync('soffice', ['--version'], { timeout: 60_000, encoding: 'utf8' });
  return !probe.error && probe.status === 0 ? 'soffice' : null;
}

/**
 * Convert one file to PDF and return the produced path, or null. A private
 * UserInstallation profile is mandatory, not tidiness: soffice silently refuses
 * a headless conversion while another LibreOffice owns the default profile.
 */
function toPdf(soffice: string, file: string, outDir: string, profileDir: string): string | null {
  const run = spawnSync(
    soffice,
    [
      `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
      '--headless', '--norestore', '--convert-to', 'pdf', '--outdir', outDir, file,
    ],
    { timeout: RENDER_TIMEOUT_MS, encoding: 'utf8' },
  );
  if (run.error || run.status !== 0) return null;
  const produced = join(outDir, `${basename(file, extname(file))}.pdf`);
  return existsSync(produced) ? produced : null;
}

// ─── the report ──────────────────────────────────────────────────────────────

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface Row {
  file: string;
  kind: 'pptx' | 'docx';
  slug: string;
  markdown: string;
  structure: Structure;
  containment: { score: number; total: number };
  originalPdf: string | null;
  roundtripPdf: string | null;
  note: string;
}

const pdfCell = (label: string, pdf: string | null, note: string): string =>
  pdf
    ? `<figure><figcaption>${esc(label)}</figcaption><embed src="${esc(basename(pdf))}" type="application/pdf"></figure>`
    : `<figure><figcaption>${esc(label)}</figcaption><p class="none">${esc(note)}</p></figure>`;

function reportHtml(rows: Row[], corpus: string, rendered: boolean): string {
  const body = rows.map((r) => {
    const s = r.structure;
    return `<section>
<h2>${esc(r.file)} <small>${esc(r.kind)}</small></h2>
<div class="pair">${pdfCell('Original', r.originalPdf, rendered ? 'render failed' : 'rendering skipped')}
${pdfCell('Round trip', r.roundtripPdf, r.note)}</div>
<table class="metrics"><tbody>
<tr><th>headings</th><td>${s.headings}</td><th>list items</th><td>${s.listItems}</td><th>table cells</th><td>${s.tableCells}</td></tr>
<tr><th>links</th><td>${s.links}</td><th>images</th><td>${s.images}</td><th>footnote markers</th><td>${s.footnotes}</td></tr>
<tr><th>trigram containment</th><td colspan="5">${r.containment.score.toFixed(4)} over ${r.containment.total} trigrams</td></tr>
</tbody></table>
<details><summary>Extracted markdown (${r.markdown.length} chars)</summary><pre>${esc(r.markdown)}</pre></details>
</section>`;
  }).join('\n');

  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<title>Lolly document quality bench</title>
<style>
:root { color-scheme: light dark; }
body { font: 15px/1.5 system-ui, sans-serif; margin: 2rem auto; max-width: 78rem; padding: 0 1rem; }
section { border-top: 1px solid #8884; padding-top: 1.5rem; margin-top: 1.5rem; }
h2 small { font-weight: 400; opacity: .6; }
.pair { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
figure { margin: 0; }
figcaption { font-weight: 600; margin-bottom: .25rem; }
embed { width: 100%; height: 30rem; border: 1px solid #8884; }
.none { border: 1px dashed #8886; padding: 2rem; text-align: center; opacity: .7; }
table.metrics { border-collapse: collapse; margin: 1rem 0; font-size: .9em; }
table.metrics th, table.metrics td { border: 1px solid #8884; padding: .25rem .6rem; text-align: left; }
pre { overflow-x: auto; background: #8881; padding: .75rem; }
.caveat { background: #8881; padding: 1rem; border-left: 3px solid #8888; }
</style></head><body>
<h1>Document quality bench</h1>
<p>Corpus: <code>${esc(corpus)}</code> &middot; ${rows.length} document(s) &middot; generated ${esc(new Date().toISOString())}</p>
<div class="caveat">
<p><strong>What the containment number measures.</strong> Its source side is the reader's OWN extraction (the text units the read model recovered) and its emitted side is the markdown serialised from that same model. It therefore measures <strong>round-trip loss through the serialiser</strong>, not reader recall. Text the reader never saw is missing from both sides and costs nothing.</p>
<p><strong>Reader recall is the human check.</strong> That is what the two PDFs are for: LibreOffice renders the original and the round-tripped file, and a person compares them. No pixel score is computed, and no LLM judge runs.</p>
<p><strong>The round-tripped deck carries no images.</strong> Embedding them needs the web shell's asynchronous asset fetch, which has no meaning in this script, so image elements are dropped before the .pptx is written.</p>
</div>
${body}
</body></html>`;
}

// ─── main ────────────────────────────────────────────────────────────────────

interface Args {
  corpus: string;
  out: string;
  render: boolean;
}

function parseArgs(argv: string[]): Args | null {
  let corpus = '';
  let out = '';
  let render = true;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--help' || a === '-h') return null;
    else if (a === '--no-render') render = false;
    else if (a === '--out') out = argv[++i] ?? '';
    else if (a.startsWith('--out=')) out = a.slice(6);
    else if (!a.startsWith('-')) corpus ||= a;
  }
  return {
    corpus: resolve(corpus || join(homedir(), 'lolly-bench-corpus')),
    out: resolve(out || join(tmpdir(), 'doc-quality-bench')),
    render,
  };
}

const USAGE = `Usage: node scripts/doc-quality-bench.ts [corpusDir] [--out dir] [--no-render]

  corpusDir    directory of .pptx/.docx files, OUTSIDE this repo
               (default: ~/lolly-bench-corpus)
  --out dir    where the report and its PDFs are written
               (default: <tmpdir>/doc-quality-bench)
  --no-render  skip the LibreOffice step and report the extraction metrics only.
               The mode to use where soffice is unavailable.`;

/** A path inside the working tree would put a private corpus or a generated
 *  report into a commit. Both directories are refused. */
const insideRepo = (p: string): boolean => {
  const rel = relative(ROOT, p);
  return rel === '' || (!isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`));
};

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (!args) {
    console.log(USAGE);
    return 0;
  }

  let soffice: string | null = null;
  if (args.render) {
    soffice = sofficeOnPath();
    if (!soffice) {
      console.log('- SKIPPED: soffice is not on PATH, so there is no ground-truth render.' +
        ' Install LibreOffice, or re-run with --no-render for the extraction metrics only.');
      return 0;
    }
  }

  if (!existsSync(args.corpus)) {
    console.error(`✗ corpus directory not found: ${args.corpus}\n\n${USAGE}`);
    return 1;
  }
  for (const [label, dir] of [['corpus', args.corpus], ['output', args.out]] as const) {
    if (insideRepo(dir)) {
      console.error(`✗ the ${label} directory is inside the repo working tree (${dir}).` +
        ' A private corpus and its report must never land in a commit.');
      return 1;
    }
  }

  const files = readdirSync(args.corpus)
    .filter((f) => /\.(pptx|docx)$/i.test(f))
    .sort();
  if (!files.length) {
    console.error(`✗ no .pptx or .docx files in ${args.corpus}`);
    return 1;
  }

  mkdirSync(args.out, { recursive: true });
  const profileDir = join(args.out, '.soffice-profile');
  const rows: Row[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i]!;
    const slug = `${i + 1}-${basename(file, extname(file)).replace(/[^A-Za-z0-9._-]+/g, '_')}`;
    const abs = join(args.corpus, file);
    process.stdout.write(`· ${file} `);

    let markdown = '';
    let sources: string[] = [];
    let kind: Row['kind'] = extname(file).toLowerCase() === '.docx' ? 'docx' : 'pptx';
    let roundtripFile: string | null = null;
    let note = 'no round trip';

    try {
      const size = statSync(abs).size;
      if (size > MAX_FILE_BYTES) {
        console.log(`- skipped: ${(size / 1024 / 1024).toFixed(0)} MB is over the read cap`);
        continue;
      }
      const parts = inflateParts(new Uint8Array(readFileSync(abs)));
      if (isPptx(parts as PptxParts)) {
        kind = 'pptx';
        const deck = readPptx(parts as PptxParts, parseXml);
        sources = deckSources(deck);
        markdown = deckToMarkdown(deck).markdown;
        try {
          const model = await markdownToDeckModel(markdown);
          if (model) {
            roundtripFile = join(args.out, `${slug}.roundtrip.pptx`);
            writeFileSync(roundtripFile, deckModelToPptx(model));
            note = '';
          } else {
            note = 'deck-studio produced no deck model';
          }
        } catch (e) {
          note = `round trip failed: ${e instanceof Error ? e.message : String(e)}`;
        }
      } else if (isDocx(parts as DocxParts)) {
        kind = 'docx';
        const read = readDocx(parts as DocxParts, parseXml);
        sources = blockSources(read.blocks);
        markdown = mdFromBlocks(read.blocks);
        try {
          // Media bytes are not inflated (only .xml/.rels parts are), so image
          // blocks are skipped by writeDocx's names-no-entry rule - the same
          // images-drop limitation the pptx leg has, and the report says so.
          roundtripFile = join(args.out, `${slug}.roundtrip.docx`);
          writeFileSync(roundtripFile, writeDocx({ title: slug, blocks: read.blocks }));
          if (read.media.length) note = `${read.media.length} image(s) not carried into the round trip`;
        } catch (e) {
          roundtripFile = null;
          note = `round trip failed: ${e instanceof Error ? e.message : String(e)}`;
        }
      } else {
        console.log('- skipped: not a Word or PowerPoint package');
        continue;
      }
    } catch (e) {
      console.log(`- FAILED: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }

    writeFileSync(join(args.out, `${slug}.md`), markdown);

    let originalPdf: string | null = null;
    let roundtripPdf: string | null = null;
    if (soffice) {
      const produced = toPdf(soffice, abs, args.out, profileDir);
      if (produced) {
        originalPdf = join(args.out, `${slug}.original.pdf`);
        renameSync(produced, originalPdf);
      }
      if (roundtripFile) roundtripPdf = toPdf(soffice, roundtripFile, args.out, profileDir);
    }
    if (!roundtripPdf && !note) note = soffice ? 'the round-tripped file did not render' : 'rendering skipped';

    rows.push({
      file, kind, slug, markdown,
      structure: countStructure(markdown),
      containment: containment(sources, markdown),
      originalPdf, roundtripPdf, note,
    });
    console.log('ok');
  }

  rmSync(profileDir, { recursive: true, force: true });

  const reportPath = join(args.out, 'report.html');
  writeFileSync(reportPath, reportHtml(rows, args.corpus, soffice != null));

  // ── console summary ──
  const cols = ['document', 'kind', 'head', 'list', 'cells', 'link', 'img', 'fnote', 'contain', 'pdfs'];
  const table = rows.map((r) => [
    r.file.length > 34 ? `${r.file.slice(0, 31)}...` : r.file,
    r.kind,
    String(r.structure.headings),
    String(r.structure.listItems),
    String(r.structure.tableCells),
    String(r.structure.links),
    String(r.structure.images),
    String(r.structure.footnotes),
    r.containment.total ? r.containment.score.toFixed(3) : 'n/a',
    `${r.originalPdf ? 1 : 0}/${r.roundtripPdf ? 1 : 0}`,
  ]);
  const width = cols.map((c, i) => Math.max(c.length, ...table.map((row) => row[i]!.length)));
  const line = (cells: string[]): string => cells.map((c, i) => c.padEnd(width[i]!)).join('  ');
  console.log(`\n${line(cols)}`);
  console.log(width.map((w) => '-'.repeat(w)).join('  '));
  for (const row of table) console.log(line(row));
  console.log(`\nReport: ${reportPath}`);
  if (!soffice) console.log('No PDFs: --no-render was passed, so nothing was rendered for comparison.');
  return 0;
}

process.exitCode = await main();
