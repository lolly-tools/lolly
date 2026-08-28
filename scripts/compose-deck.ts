// SPDX-License-Identifier: MPL-2.0
/**
 * compose-deck - a spec-driven deck composer.
 *
 * A friendly JSON deck spec in, a rendered deck (PPTX/PDF/video) out. The spec is
 * mapped onto the `deck-builder` tool's `deck` blocks input and rendered THROUGH
 * deck-builder, so this adds no second renderer: each slide's media slot may be a
 * Lolly tool link (chart, org-chart, filter, ...) that composes in via
 * host.compose, text is rendered as vector paths, and brand theming is inherited.
 *
 * This is the native equivalent of a hand-rolled pptxgenjs+resvg harness: the
 * "data + tools -> a deck" path an agent reached for, but built on the tool that
 * already owns slide layout, so it's reproducible from a spec and higher fidelity.
 *
 * Usage:
 *   node scripts/compose-deck.ts deck.json --output=deck.pptx
 *   node scripts/compose-deck.ts deck.json --export=pdf > deck.pdf
 *   node scripts/compose-deck.ts deck.json --lint-only      # warnings only, no render
 *
 * deck-builder ships in the SUSE profile - switch to a profile that has it first
 * (`npm run profile:suse`). Rendering PPTX/PDF/video is deck-builder's own
 * browser-tier export, so it needs `lolly install-browser` + a built web shell,
 * exactly as `lolly deck-builder --export=pptx` does; --lint-only needs neither.
 *
 * The spec -> blocks mapping and the linter are pure and unit-tested
 * (tests/compose-deck.test.ts); only the final render shells out.
 */
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, resolve, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ── the spec ──────────────────────────────────────────────────────────────────

/** One slide. `content` is raw deck-builder markdown; the convenience fields
 *  (title/subtitle/body/bullets/number/label) assemble into it when it's absent. */
export interface SlideSpec {
  layout?: string;
  title?: string;
  subtitle?: string;
  body?: string;
  bullets?: string[];
  number?: string;        // bignum headline
  label?: string;         // bignum / statement caption
  content?: string;       // raw markdown - wins over the fields above
  /** Tool links (chart://...), catalog asset ids, or a single such string. */
  media?: string[] | string;
  notes?: string;
  theme?: string;         // auto | light | dark | primary | accent
  bg?: string;            // hex - overrides the theme background for this slide
  logo?: string;          // auto | mono | off
}

export interface DeckSpec {
  title?: string;
  size?: string;          // deck-builder `size` select (wide | classic | square | ...)
  theme?: string;         // deck theme
  footer?: string;        // footer line
  pageNumbers?: boolean;
  brandLogo?: boolean;
  transition?: string;    // slide transition (video only)
  slides: SlideSpec[];
}

// deck-builder's layouts and how many media/text slots each carries (mirrors the
// tool manifest's showFor lists). A statement layout (0 slots) has no media.
export const LAYOUT_SLOTS: Record<string, number> = {
  title: 0, mainpoint: 0, bignum: 0,
  full: 1, hero: 1,
  split: 2, stack: 2, golden: 2,
  cols3: 3, grid4: 4,
};
/** Layouts that make a statement rather than carry body content - exempt from the
 *  bullets/notes/visual lint that applies to working content slides. */
const STATEMENT_LAYOUTS = new Set(['title', 'mainpoint', 'bignum']);

// ── spec -> deck-builder inputs (pure) ──────────────────────────────────────────

/** The slide's markdown body: an explicit `content` wins; otherwise assemble one
 *  from the convenience fields. `number` is the bignum headline, so it takes the
 *  H1 when there's no `title`. */
export function assembleContent(s: SlideSpec): string {
  if (typeof s.content === 'string' && s.content.trim()) return s.content;
  const lines: string[] = [];
  const headline = s.title ?? s.number;
  if (headline) lines.push('# ' + headline);
  if (s.subtitle) lines.push(s.subtitle);
  if (s.label) lines.push(s.label);
  if (s.body) lines.push('', s.body);
  if (Array.isArray(s.bullets) && s.bullets.length) {
    lines.push('');
    for (const b of s.bullets) lines.push('- ' + String(b));
  }
  return lines.join('\n');
}

/** Normalise a slide's media to an array, dropping empties. */
function mediaList(s: SlideSpec): string[] {
  const raw = Array.isArray(s.media) ? s.media : s.media ? [s.media] : [];
  return raw.map(m => String(m).trim()).filter(Boolean);
}

/** One deck-builder block. A media entry becomes `{ id }` - the shape the runtime's
 *  asset resolver reads, so a tool link composes and a catalog id resolves, exactly
 *  as the web picker stores it. */
export function slideToBlock(s: SlideSpec): Record<string, unknown> {
  const layout = s.layout ?? 'title';
  const block: Record<string, unknown> = { layout, content: assembleContent(s) };
  if (s.theme) block.theme = s.theme;
  if (s.bg) block.bg = s.bg;
  if (s.logo) block.logo = s.logo;
  if (s.notes) block.notes = s.notes;
  const slots = LAYOUT_SLOTS[layout] ?? 0;
  mediaList(s).slice(0, slots).forEach((m, i) => { block[`media${i + 1}`] = { id: m }; });
  return block;
}

/** The deck blocks plus the deck-level flags (only those the spec sets). */
export function specToDeck(spec: DeckSpec): { deck: Record<string, unknown>[]; flags: Record<string, string> } {
  const deck = (spec.slides ?? []).map(slideToBlock);
  const flags: Record<string, string> = {};
  if (spec.size) flags.size = spec.size;
  if (spec.theme) flags.theme = spec.theme;
  if (spec.footer) flags.footerText = spec.footer;
  if (spec.pageNumbers !== undefined) flags.pageNumbers = String(spec.pageNumbers);
  if (spec.brandLogo !== undefined) flags.brandLogo = String(spec.brandLogo);
  if (spec.transition) flags.transition = spec.transition;
  return { deck, flags };
}

// ── deck lint (pure, advisory) ──────────────────────────────────────────────────

export interface DeckWarning { level: 'warn' | 'info'; where: string; msg: string; }

const words = (s: string): number => (s.trim() ? s.trim().split(/\s+/).length : 0);

/** Advisory checks - never fatal. Ordered deck-wide first, then per slide. */
export function lintDeck(spec: DeckSpec): DeckWarning[] {
  const out: DeckWarning[] = [];
  const slides = spec.slides ?? [];

  if (slides.length < 5) out.push({ level: 'info', where: 'deck', msg: `only ${slides.length} slides - a deck usually runs 10-20` });
  else if (slides.length > 30) out.push({ level: 'info', where: 'deck', msg: `${slides.length} slides - long for one sitting (10-20 is typical)` });

  const totalMedia = slides.reduce((n, s) => n + mediaList(s).length, 0);
  if (totalMedia === 0) out.push({ level: 'warn', where: 'deck', msg: 'no visuals anywhere - every slide is text' });

  let textRun = 0;
  slides.forEach((s, i) => {
    const at = `slide ${i + 1}`;
    const layout = s.layout ?? 'title';
    if (!(layout in LAYOUT_SLOTS)) out.push({ level: 'warn', where: at, msg: `unknown layout "${layout}"` });

    const media = mediaList(s);
    const slots = LAYOUT_SLOTS[layout] ?? 0;
    if (media.length > slots) out.push({ level: 'warn', where: at, msg: `${media.length} media for a ${slots}-slot "${layout}" layout - ${media.length - slots} dropped` });

    const headline = s.title ?? s.number ?? '';
    if (words(headline) > 14) out.push({ level: 'info', where: at, msg: `title runs ${words(headline)} words - aim for <=14` });

    if (Array.isArray(s.bullets)) {
      if (s.bullets.length > 5) out.push({ level: 'info', where: at, msg: `${s.bullets.length} bullets - aim for <=5` });
      const wordy = s.bullets.find(b => words(String(b)) > 16);
      if (wordy) out.push({ level: 'info', where: at, msg: 'a bullet runs long (>16 words) - tighten it' });
    }

    const isContent = !STATEMENT_LAYOUTS.has(layout);
    if (isContent && !(s.notes && s.notes.trim())) out.push({ level: 'info', where: at, msg: 'no speaker notes' });

    // A run of working content slides with no visual is where a deck goes flat.
    if (isContent && media.length === 0) {
      textRun++;
      if (textRun === 4) out.push({ level: 'info', where: at, msg: '4+ text-only slides in a row - consider a visual or a divider' });
    } else {
      textRun = 0;
    }
  });

  return out;
}

// ── render (shells out to deck-builder) ─────────────────────────────────────────

function parseFlags(argv: string[]): { specPath?: string; opts: Record<string, string>; lintOnly: boolean } {
  const opts: Record<string, string> = {};
  let specPath: string | undefined;
  let lintOnly = false;
  for (const a of argv) {
    if (a === '--lint-only') { lintOnly = true; continue; }
    const m = /^--([^=]+)=(.*)$/.exec(a);
    if (m) opts[m[1]!] = m[2]!;
    else if (!a.startsWith('--') && !specPath) specPath = a;
  }
  return { specPath, opts, lintOnly };
}

function printWarnings(warnings: DeckWarning[]): void {
  for (const w of warnings) {
    const tag = w.level === 'warn' ? 'warn' : 'note';
    process.stderr.write(`  [${tag}] ${w.where}: ${w.msg}\n`);
  }
}

async function main(): Promise<void> {
  const { specPath, opts, lintOnly } = parseFlags(process.argv.slice(2));
  if (!specPath) {
    process.stderr.write('usage: node scripts/compose-deck.ts <spec.json> [--output=deck.pptx] [--export=pptx] [--lint-only]\n');
    process.exitCode = 2;
    return;
  }

  let spec: DeckSpec;
  try {
    spec = JSON.parse(readFileSync(resolve(specPath), 'utf8')) as DeckSpec;
  } catch (e) {
    process.stderr.write(`Could not read/parse ${specPath}: ${(e as Error).message}\n`);
    process.exitCode = 1;
    return;
  }
  if (!Array.isArray(spec.slides) || spec.slides.length === 0) {
    process.stderr.write('spec has no slides[]\n');
    process.exitCode = 1;
    return;
  }

  const warnings = lintDeck(spec);
  if (warnings.length) {
    process.stderr.write(`Deck lint (${spec.slides.length} slides):\n`);
    printWarnings(warnings);
  }
  if (lintOnly) return;

  const { deck, flags } = specToDeck(spec);
  const out = opts.output ?? (opts.export ? undefined : specPath.replace(extname(specPath), '') + '.pptx');

  const args = [
    resolve(ROOT, 'shells/cli/bin/lolly.ts'),
    'deck-builder',
    `--deck=${JSON.stringify(deck)}`,
    ...Object.entries(flags).map(([k, v]) => `--${k}=${v}`),
    ...(opts.export ? [`--export=${opts.export}`] : []),
    ...(out ? [`--output=${out}`] : []),
  ];

  const code: number = await new Promise((res) => {
    // No shell: each arg (the deck JSON included, with its newlines and quotes) is
    // passed verbatim, so nothing needs escaping. stdio inherited so bytes for a
    // `--export` (stdout) and progress/errors (stderr) reach the caller unchanged.
    const child = spawn('node', args, { stdio: 'inherit', cwd: ROOT });
    child.on('error', (err) => { process.stderr.write(`could not launch lolly CLI: ${err.message}\n`); res(1); });
    child.on('close', (c) => res(c ?? 0));
  });
  if (out && code === 0) process.stderr.write(`Wrote ${out}\n`);
  process.exitCode = code;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
