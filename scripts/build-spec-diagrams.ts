// SPDX-License-Identifier: MPL-2.0
/**
 * build-spec-diagrams - render the figures of the document model specification
 * (plans/276) from checked-in Mermaid, DOT and Pikchr sources.
 *
 *   node scripts/build-spec-diagrams.ts                    # render every figure
 *   node scripts/build-spec-diagrams.ts --only=four-records
 *   node scripts/build-spec-diagrams.ts --check            # exit 1 if a rerun would change a byte
 *
 *   sources  docs/spec/document-model/diagrams/<name>.<mmd|dot|pikchr>
 *   output   docs/diagrams/document-model/<name>.svg
 *
 * Every figure goes through the real `diagram-builder` tool on the CLI shell, so
 * the pictures in the specification are made the way the specification says a
 * tool makes things. Three properties come with that path: the tool is data, so
 * no diagram code enters this repository; the tool outlines each label into
 * paths, so the SVG carries no font and needs none on the reader's machine; and
 * `--no-provenance` writes no timestamp, so two runs of the same source produce
 * the same bytes and `--check` can stand as a gate.
 *
 * The content profile is pinned to `lolly-start`. Brand tokens colour the cards,
 * so rendering under the SUSE profile would put SUSE colours into a public docs
 * page and the same command would produce different bytes on a public clone.
 *
 * SHARED_FLAGS is smaller than the tool's own defaults on purpose. The docs
 * column caps an image at 40em, about 640 CSS pixels, and an SVG wider than that
 * is scaled down with its labels. So each figure is kept near or under 640 units
 * wide, labels stay at two or three words, and the detail belongs in the chapter
 * prose rather than in the picture.
 */
import { execFileSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, mkdtempSync, openSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'docs/spec/document-model/diagrams');
const OUT_DIR = join(ROOT, 'docs/diagrams/document-model');
const CLI = join(ROOT, 'shells/cli/bin/lolly.ts');

/** The three diagram languages the tool reads, and the extension each source uses. */
const EXT = { mermaid: 'mmd', dot: 'dot', pikchr: 'pikchr' } as const;
type Lang = keyof typeof EXT;

/**
 * Style flags shared by every figure, so the ten read as one set: no dot grid
 * behind the cards, labels centred, and cards narrow enough that a four column
 * picture still fits the docs column at its own size.
 */
const SHARED_FLAGS = [
  '--gridBg=none',
  '--cardLayout=stacked',
  '--labelSize=14',
  '--cardWidth=150',
  '--canvasPadding=18',
  '--rowGap=40',
  '--siblingGap=20',
  '--cornerRadius=10',
  '--cardBorderWidth=1.6',
  '--connectorWidth=1.6',
  '--arrowWidth=1.6',
  '--arrowHeadSize=9',
];

interface Figure {
  /** File stem of both the source and the rendered SVG. */
  name: string;
  lang: Lang;
  /** Drawn as the figure's heading, and passed as `--title`. */
  title: string;
  /** Per figure overrides, appended after SHARED_FLAGS so they win. */
  flags?: string[];
}

/** The ten figures, in the order the chapters use them. */
const FIGURES: Figure[] = [
  { name: 'four-records', lang: 'mermaid', title: 'Four records', flags: ['--cardWidth=120', '--siblingGap=22'] },
  { name: 'record-map', lang: 'dot', title: 'Records and their contracts', flags: ['--cardWidth=176', '--siblingGap=26'] },
  { name: 'source-rows-and-payloads', lang: 'dot', title: 'Source rows and payload records', flags: ['--cardWidth=132', '--rowGap=50'] },
  { name: 'patch-envelope', lang: 'pikchr', title: 'One patch envelope' },
  { name: 'operation-shapes', lang: 'mermaid', title: 'Operation shapes and one outcome', flags: ['--cardWidth=120', '--labelSize=16', '--siblingGap=12'] },
  { name: 'evaluation-pipeline', lang: 'pikchr', title: 'Nine evaluation steps' },
  { name: 'execution-classes', lang: 'mermaid', title: 'Five execution classes', flags: ['--cardWidth=176', '--siblingGap=26'] },
  { name: 'policy-layers', lang: 'dot', title: 'Effective policy, layer by layer', flags: ['--cardWidth=158'] },
  { name: 'conformance-vs-acceptance', lang: 'mermaid', title: 'Conformance and acceptance', flags: ['--cardWidth=162'] },
  { name: 'comparator-three-checks', lang: 'pikchr', title: 'Three checks, one verdict' },
];

const sourcePath = (fig: Figure): string => join(SRC_DIR, `${fig.name}.${EXT[fig.lang]}`);
const outputPath = (fig: Figure): string => join(OUT_DIR, `${fig.name}.svg`);

/**
 * Run one figure through the CLI into `dest`. The source text travels as one
 * argument, never through a shell, so its newlines and quotes reach the tool
 * intact. The tool writes its own notes to stderr, including the count of source
 * lines its parser skipped, which is the one failure that would otherwise be
 * silent: a skipped line just goes missing from the picture. So stderr is
 * captured to a file and returned for the caller to report.
 */
function render(fig: Figure, dest: string): string {
  const src = readFileSync(sourcePath(fig), 'utf8');
  const logPath = `${dest}.log`;
  const logFd = openSync(logPath, 'w');
  try {
    execFileSync(
      process.execPath,
      [
        CLI,
        'diagram-builder',
        `--source=${fig.lang}`,
        `--title=${fig.title}`,
        `--${fig.lang}=${src}`,
        ...SHARED_FLAGS,
        ...(fig.flags ?? []),
        '--export=svg',
        '--no-provenance',
        `--output=${dest}`,
      ],
      { cwd: ROOT, env: { ...process.env, LOLLY_PROFILE: 'lolly-start' }, stdio: ['ignore', 'ignore', logFd] },
    );
  } catch (err) {
    closeSync(logFd);
    const log = existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
    throw new Error(`${fig.name}: the CLI render failed\n${log}\n${(err as Error).message}`);
  }
  closeSync(logFd);
  return existsSync(logPath) ? readFileSync(logPath, 'utf8') : '';
}

/** The lines of a render's stderr a reader needs to see: skipped source lines. */
function warningsIn(log: string): string[] {
  return log
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.includes('skipped'));
}

/** Every source file on disk, so a stray or missing one is reported rather than ignored. */
function sourcesOnDisk(): string[] {
  if (!existsSync(SRC_DIR)) return [];
  return readdirSync(SRC_DIR)
    .filter(f => (Object.values(EXT) as string[]).some(ext => f.endsWith(`.${ext}`)))
    .sort();
}

function main(): void {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const only = args.find(a => a.startsWith('--only='))?.slice('--only='.length);
  const unknown = args.filter(a => a !== '--check' && !a.startsWith('--only='));
  if (unknown.length) {
    console.error(`build-spec-diagrams: unknown argument ${unknown[0]}`);
    process.exit(2);
  }

  const figures = only ? FIGURES.filter(f => f.name === only) : FIGURES;
  if (only && !figures.length) {
    console.error(`build-spec-diagrams: no figure called "${only}". Known: ${FIGURES.map(f => f.name).join(', ')}`);
    process.exit(2);
  }

  const problems: string[] = [];
  if (!only) {
    const expected = new Set(FIGURES.map(f => basename(sourcePath(f))));
    for (const f of sourcesOnDisk()) if (!expected.has(f)) problems.push(`stray source with no entry in FIGURES: ${f}`);
  }
  for (const fig of figures) {
    if (!existsSync(sourcePath(fig))) problems.push(`missing source: ${sourcePath(fig).slice(ROOT.length + 1)}`);
  }
  if (problems.length) {
    for (const p of problems) console.error(`build-spec-diagrams: ${p}`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'lolly-spec-diagrams-'));
  const changed: string[] = [];
  try {
    for (const fig of figures) {
      const tmpSvg = join(work, `${fig.name}.svg`);
      const warnings = warningsIn(render(fig, tmpSvg));
      const next = readFileSync(tmpSvg);
      const dest = outputPath(fig);
      const prev = existsSync(dest) ? readFileSync(dest) : null;
      const same = prev?.equals(next) === true;
      if (!same) changed.push(fig.name);
      if (!same && !check) writeFileSync(dest, next);
      const state = same ? 'unchanged' : check ? 'WOULD CHANGE' : prev === null ? 'new' : 'updated';
      console.log(`${state.padEnd(12)} ${fig.name}.svg  ${next.length} bytes  (${fig.lang})`);
      for (const w of warnings) console.log(`             ${w}`);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  if (check && changed.length) {
    console.error('');
    console.error('build-spec-diagrams --check: these rendered figures do not match their sources:');
    for (const name of changed) console.error(`  docs/diagrams/document-model/${name}.svg`);
    console.error('Run `node scripts/build-spec-diagrams.ts` and commit the result.');
    process.exit(1);
  }
}

main();
