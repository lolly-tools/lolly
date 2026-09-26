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
 * the artwork is rendered without timestamps, then signed with Content Credentials.
 * Unchanged artwork keeps its existing valid signature so `--check` stays stable.
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
import { fileURLToPath, pathToFileURL } from 'node:url';
import { embedC2pa } from '../engine/src/c2pa-containers.ts';
import { buildExportC2paOpts } from '../packages/node-shell/src/c2pa-opts.ts';
import { artBindingState, stripArtManifest } from './sign-docs-art.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = join(ROOT, 'docs/spec/document-model/diagrams');
const OUT_DIR = join(ROOT, 'docs/diagrams/document-model');
const CLI = join(ROOT, 'shells/cli/bin/lolly.ts');

/** The three diagram languages the tool reads, and the extension each source uses. */
const EXT = { mermaid: 'mmd', dot: 'dot', pikchr: 'pikchr' } as const;
type Lang = keyof typeof EXT;

/**
 * Shared type and line treatment keep the figures consistent. Narrow layouts
 * and wrapped groups keep labels legible at the docs column's reading width.
 */
export const SHARED_FLAGS = [
  '--look=editorial',
  '--focalEmphasis=none',
  '--background=#ffffff',
  '--gridBg=none',
  '--cardLayout=stacked',
  '--labelSize=16',
  '--cardWidth=164',
  '--canvasPadding=18',
  '--rowGap=56',
  '--siblingGap=20',
  '--cornerRadius=10',
  '--cardBorderWidth=0.8',
  '--connectorWidth=1.5',
  '--arrowWidth=1.5',
  '--arrowHead=open',
  '--arrowHeadSizing=auto',
  '--bendRadius=14',
  '--radiusMode=custom',
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
export const FIGURES: Figure[] = [
  { name: 'four-records', lang: 'mermaid', title: 'Four records', flags: ['--look=minimal', '--cardWidth=172', '--siblingGap=20'] },
  { name: 'record-map', lang: 'dot', title: 'Records and their contracts', flags: ['--cardWidth=176', '--siblingGap=26'] },
  { name: 'source-rows-and-payloads', lang: 'dot', title: 'Source rows and payload records', flags: ['--look=minimal', '--cardWidth=164', '--rowGap=56'] },
  { name: 'patch-envelope', lang: 'pikchr', title: 'One patch envelope', flags: ['--look=soft', '--cardDepth=0.6'] },
  { name: 'operation-shapes', lang: 'mermaid', title: 'Operation shapes and one outcome', flags: ['--cardWidth=136', '--layerColumns=3', '--siblingGap=20'] },
  { name: 'evaluation-pipeline', lang: 'pikchr', title: 'Nine evaluation steps', flags: ['--look=flow', '--cardDepth=0.35'] },
  { name: 'execution-classes', lang: 'mermaid', title: 'Five execution classes', flags: ['--cardWidth=176', '--siblingGap=26'] },
  { name: 'policy-layers', lang: 'dot', title: 'Effective policy, layer by layer', flags: ['--cardWidth=158'] },
  { name: 'conformance-vs-acceptance', lang: 'mermaid', title: 'Conformance and acceptance', flags: ['--cardWidth=162'] },
  { name: 'comparator-three-checks', lang: 'pikchr', title: 'Three checks, one verdict', flags: ['--look=soft', '--cardDepth=0.6'] },
];

const sourcePath = (fig: Figure): string => join(SRC_DIR, `${fig.name}.${EXT[fig.lang]}`);
const outputPath = (fig: Figure): string => join(OUT_DIR, `${fig.name}.svg`);

/** The same explicit inputs drive the CLI and the editable docs link. */
export function figureInputs(fig: Figure): Record<string, string> {
  const inputs: Record<string, string> = {
    source: fig.lang, title: fig.title, [fig.lang]: readFileSync(sourcePath(fig), 'utf8'),
  };
  for (const flag of [...SHARED_FLAGS, ...(fig.flags ?? [])]) {
    const split = flag.indexOf('=');
    inputs[flag.slice(2, split)] = flag.slice(split + 1);
  }
  return inputs;
}

export function figureRoute(fig: Figure): string {
  return `/#/tool/diagram-builder?${new URLSearchParams(figureInputs(fig))}`;
}

/** Bind the editable recipe to the picture along with its visible artwork. */
export function withRecipe(svg: string, route: string): string {
  const escaped = route.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return svg.replace('<metadata>', `<metadata><lolly:recipe xmlns:lolly="https://lolly.tools/ns/recipe" tool="diagram-builder" profile="lolly-start">${escaped}</lolly:recipe>`);
}

/**
 * Run one figure through the CLI into `dest`. The source text travels as one
 * argument, never through a shell, so its newlines and quotes reach the tool
 * intact. The tool writes its own notes to stderr, including the count of source
 * lines its parser skipped, which is the one failure that would otherwise be
 * silent: a skipped line just goes missing from the picture. So stderr is
 * captured to a file and returned for the caller to report.
 */
function render(fig: Figure, dest: string): string {
  const logPath = `${dest}.log`;
  const logFd = openSync(logPath, 'w');
  try {
    execFileSync(
      process.execPath,
      [
        CLI,
        'diagram-builder',
        ...Object.entries(figureInputs(fig)).map(([key, value]) => `--${key}=${value}`),
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
    .filter(line => /diagram-builder:/.test(line));
}

/** Every source file on disk, so a stray or missing one is reported rather than ignored. */
function sourcesOnDisk(): string[] {
  if (!existsSync(SRC_DIR)) return [];
  return readdirSync(SRC_DIR)
    .filter(f => (Object.values(EXT) as string[]).some(ext => f.endsWith(`.${ext}`)))
    .sort();
}

async function main(): Promise<void> {
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
      const route = figureRoute(fig);
      const next = Buffer.from(withRecipe(readFileSync(tmpSvg, 'utf8'), route));
      const dest = outputPath(fig);
      const prev = existsSync(dest) ? readFileSync(dest) : null;
      const same = prev !== null && stripArtManifest(prev.toString(), 'svg') === next.toString()
        && (await artBindingState(prev)).bound;
      if (!same) changed.push(fig.name);
      if (!same && !check) {
        const opts = buildExportC2paOpts({ surface: 'docs', manifest: { id: 'diagram-builder', name: 'Diagram Builder' }, model: [], format: 'svg', days: 365 });
        const environment = opts.environment && typeof opts.environment === 'object' ? opts.environment : {};
        const signed = await embedC2pa(next, 'svg', { ...opts, environment: { ...environment, recipe: route } });
        if (!(await artBindingState(signed)).bound) throw new Error(`${fig.name}: Content Credential does not bind to the diagram`);
        writeFileSync(dest, signed);
      }
      const state = same ? 'unchanged' : check ? 'WOULD CHANGE' : prev === null ? 'new' : 'updated';
      console.log(`${state.padEnd(12)} ${fig.name}.svg  ${next.length} bytes  (${fig.lang})`);
      for (const w of warnings) console.log(`             ${w}`);
    }
    const recipePath = join(OUT_DIR, 'recipes.json');
    const recipes = Object.fromEntries(FIGURES.map(fig => [`diagrams/document-model/${fig.name}`, { route: figureRoute(fig) }]));
    const nextRecipes = `${JSON.stringify(recipes, null, 2)}\n`;
    if (!existsSync(recipePath) || readFileSync(recipePath, 'utf8') !== nextRecipes) {
      changed.push('recipes.json');
      if (!check) writeFileSync(recipePath, nextRecipes);
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  if (check && changed.length) {
    console.error('');
    console.error('build-spec-diagrams --check: these rendered figures do not match their sources:');
    for (const name of changed) console.error(`  docs/diagrams/document-model/${name.endsWith('.json') ? name : `${name}.svg`}`);
    console.error('Run `node scripts/build-spec-diagrams.ts` and commit the result.');
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
