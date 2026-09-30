// SPDX-License-Identifier: MPL-2.0
/**
 * build-spec-diagrams - render the docs figures that Diagram Builder draws from
 * checked-in sources: the document model specification (plans/276), the
 * Shoulders of giants page and the concepts used across the guides. Each set
 * keeps its own sources, output folder and shared styling; the render, signing
 * and `--check` path is the same for every set.
 *
 *   node scripts/build-spec-diagrams.ts                    # render every figure
 *   node scripts/build-spec-diagrams.ts --only=four-records
 *   node scripts/build-spec-diagrams.ts --set=concepts
 *   node scripts/build-spec-diagrams.ts --check            # exit 1 if a rerun would change a byte
 *
 *   sources  docs/spec/document-model/diagrams/<name>.<mmd|dot|pikchr>
 *            docs/diagram-sources/shoulders-of-giants/<name>.txt
 *            docs/diagram-sources/concepts/<name>.dot
 *   output   docs/diagrams/<set>/<name>.svg, plus docs/diagrams/<set>/recipes.json;
 *            a set marked `dark` also writes docs/diagrams/<set>/<name>.dark.svg
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
/** The figure sets, each with its own sources and output folder under docs/diagrams/. */
/** `dark` sets also render a signed dark twin of every figure, `<name>.dark.svg`, which
 *  the docs show in place of the light file when the reader's theme is dark. */
const SET_DIRS = {
  'document-model': { src: join(ROOT, 'docs/spec/document-model/diagrams'), out: join(ROOT, 'docs/diagrams/document-model'), dark: false },
  'shoulders-of-giants': { src: join(ROOT, 'docs/diagram-sources/shoulders-of-giants'), out: join(ROOT, 'docs/diagrams/shoulders-of-giants'), dark: true },
  concepts: { src: join(ROOT, 'docs/diagram-sources/concepts'), out: join(ROOT, 'docs/diagrams/concepts'), dark: true },
} as const;
export type FigureSet = keyof typeof SET_DIRS;
const CLI = join(ROOT, 'shells/cli/bin/lolly.ts');

/** The three diagram languages the tool reads, and the extension each source uses. */
const EXT = { mermaid: 'mmd', dot: 'dot', pikchr: 'pikchr', text: 'txt' } as const;
type Lang = keyof typeof EXT;
/** The tool input that carries each language's source: the text format lives in `dsl`. */
const SOURCE_INPUT: Record<Lang, string> = { mermaid: 'mermaid', dot: 'dot', pikchr: 'pikchr', text: 'dsl' };

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
  /** The set the figure belongs to; the document model specification when omitted. */
  set?: FigureSet;
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

/**
 * The Shoulders of giants page reads as a long editorial piece, so its figures share
 * the specification's house style and take the tool's own editorial layouts in place
 * of flowcharts: bars over four decades, a layercake, a lineage tree, a fan-out and
 * two lanes that meet. The minimal look gives every card a full border (the editorial
 * look adds an accent bar down one side), and the Lolly cards are filled in the
 * brand's green from the source text, so they read as the one focal point.
 */
export const GIANTS_FLAGS = [...SHARED_FLAGS, '--source=text', '--look=minimal', '--cornerRadius=8'];

/**
 * The dark twin takes every surface from the brand's own dark theme, because the tool
 * mixes band colours from that theme's surface: overriding only the page and card
 * colours would leave the bands in a different family. Each light tint a source uses
 * is swapped for a deeper one of the same hue, so a carrier colour means the same
 * thing in both themes, and the brand green is kept as it is.
 */
const DARK_FLAGS = ['--colourMode=dark', '--background=', '--nodeFill='];
const DARK_FILLS: Record<string, string> = { '#dcf3e6': '#1b4a35', '#dde8f7': '#203a63', '#fbeccd': '#56401a' };
export type Variant = 'light' | 'dark';

export const GIANTS_FIGURES: Figure[] = [
  { set: 'shoulders-of-giants', name: 'four-decades', lang: 'text', title: 'Four decades of shared work', flags: ['--diagramType=gantt', '--ganttGrid=false', '--cardWidth=196', '--cardScale=0.9', '--labelSize=16'] },
  { set: 'shoulders-of-giants', name: 'what-lolly-stands-on', lang: 'text', title: 'What Lolly stands on', flags: ['--diagramType=layercake', '--cardWidth=128', '--labelSize=14', '--siblingGap=8', '--rowGap=10'] },
  { set: 'shoulders-of-giants', name: 'one-engine-many-homes', lang: 'text', title: 'One engine, many homes', flags: ['--diagramType=org', '--cardWidth=128', '--labelSize=15', '--siblingGap=10', '--rowGap=34'] },
  { set: 'shoulders-of-giants', name: 'a-solver-that-travelled', lang: 'text', title: 'A solver that travelled', flags: ['--diagramType=org', '--cardWidth=140', '--siblingGap=14', '--rowGap=40'] },
  { set: 'shoulders-of-giants', name: 'one-library-everywhere', lang: 'text', title: 'One library, everywhere', flags: ['--diagramType=mindmap', '--cardWidth=118', '--siblingGap=10', '--rowGap=12'] },
  { set: 'shoulders-of-giants', name: 'into-the-page', lang: 'text', title: 'From the desktop into the page', flags: ['--diagramType=process', '--flowDir=down', '--cardWidth=176', '--siblingGap=24', '--rowGap=26'] },
];

/** Guide concepts use a full card border and the same label and connector treatment. */
export const CONCEPT_FIGURES: Figure[] = [
  { set: 'concepts', name: 'platform-layers', lang: 'dot', title: 'Tools, engine and shells', flags: ['--look=minimal', '--cardWidth=180', '--siblingGap=18'] },
  { set: 'concepts', name: 'three-export-paths', lang: 'dot', title: 'Three paths to a finished file', flags: ['--look=minimal', '--cardWidth=170', '--siblingGap=16'] },
  { set: 'concepts', name: 'private-collab-handshake', lang: 'dot', title: 'Invite, reply, then connect', flags: ['--look=minimal', '--cardWidth=190', '--rowGap=36'] },
  { set: 'concepts', name: 'personal-sync', lang: 'dot', title: 'Your devices, your storage', flags: ['--look=minimal', '--cardWidth=180'] },
  { set: 'concepts', name: 'share-with-rules', lang: 'dot', title: 'From a master to a reusable tool', flags: ['--look=minimal', '--cardWidth=178'] },
  { set: 'concepts', name: 'token-resolution', lang: 'dot', title: 'From token sources to tool values', flags: ['--look=minimal', '--cardWidth=178'] },
  { set: 'concepts', name: 'one-render-path', lang: 'dot', title: 'Two transports, one render path', flags: ['--look=minimal', '--cardWidth=178'] },
  { set: 'concepts', name: 'rights-evidence-to-delivery', lang: 'dot', title: 'Evidence, obligation and delivery', flags: ['--look=minimal', '--cardWidth=190'] },
];

/** Every figure the script renders, in set order. */
export const ALL_FIGURES: Figure[] = [...FIGURES, ...GIANTS_FIGURES, ...CONCEPT_FIGURES];

const setOf = (fig: Figure): FigureSet => fig.set ?? 'document-model';
const sourcePath = (fig: Figure): string => join(SET_DIRS[setOf(fig)].src, `${fig.name}.${EXT[fig.lang]}`);
const outputPath = (fig: Figure, variant: Variant = 'light'): string => join(SET_DIRS[setOf(fig)].out, `${fig.name}${variant === 'dark' ? '.dark' : ''}.svg`);
/** The variants a figure is rendered in: every figure has a light file, dark sets add a twin. */
export const figureVariants = (fig: Figure): Variant[] => (SET_DIRS[setOf(fig)].dark ? ['light', 'dark'] : ['light']);
/** The published path a page embeds and the recipes are keyed by: `diagrams/<set>/<name>`. */
export const figureSlug = (fig: Figure): string => `diagrams/${setOf(fig)}/${fig.name}`;
/** The tool input the figure's source travels in. */
export const sourceInput = (fig: Figure): string => SOURCE_INPUT[fig.lang];

/** The same explicit inputs drive the CLI and the editable docs link. */
export function figureInputs(fig: Figure, variant: Variant = 'light'): Record<string, string> {
  let source = readFileSync(sourcePath(fig), 'utf8');
  if (variant === 'dark') source = source.replace(/#[0-9a-f]{6}\b/gi, hex => DARK_FILLS[hex.toLowerCase()] ?? hex);
  const inputs: Record<string, string> = { source: fig.lang, title: fig.title, [SOURCE_INPUT[fig.lang]]: source };
  const shared = setOf(fig) === 'shoulders-of-giants' ? GIANTS_FLAGS : SHARED_FLAGS;
  for (const flag of [...shared, ...(fig.flags ?? []), ...(variant === 'dark' ? DARK_FLAGS : [])]) {
    const split = flag.indexOf('=');
    inputs[flag.slice(2, split)] = flag.slice(split + 1);
  }
  return inputs;
}

export function figureRoute(fig: Figure, variant: Variant = 'light'): string {
  return `/#/tool/diagram-builder?${new URLSearchParams(figureInputs(fig, variant))}`;
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
function render(fig: Figure, dest: string, variant: Variant): string {
  const logPath = `${dest}.log`;
  const logFd = openSync(logPath, 'w');
  try {
    execFileSync(
      process.execPath,
      [
        CLI,
        'diagram-builder',
        ...Object.entries(figureInputs(fig, variant)).map(([key, value]) => `--${key}=${value}`),
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

/** Every source file on disk in a set, so a stray or missing one is reported rather than ignored. */
function sourcesOnDisk(set: FigureSet): string[] {
  const dir = SET_DIRS[set].src;
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter(f => (Object.values(EXT) as string[]).some(ext => f.endsWith(`.${ext}`)))
    .sort();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const check = args.includes('--check');
  const only = args.find(a => a.startsWith('--only='))?.slice('--only='.length);
  const set = args.find(a => a.startsWith('--set='))?.slice('--set='.length);
  const unknown = args.filter(a => a !== '--check' && !a.startsWith('--only=') && !a.startsWith('--set='));
  if (unknown.length) {
    console.error(`build-spec-diagrams: unknown argument ${unknown[0]}`);
    process.exit(2);
  }

  if (set && !Object.hasOwn(SET_DIRS, set)) {
    console.error(`build-spec-diagrams: unknown set "${set}". Known: ${Object.keys(SET_DIRS).join(', ')}`);
    process.exit(2);
  }
  const selected = set ? ALL_FIGURES.filter(f => setOf(f) === set) : ALL_FIGURES;
  const figures = only ? selected.filter(f => f.name === only) : selected;
  if (only && !figures.length) {
    console.error(`build-spec-diagrams: no figure called "${only}". Known: ${selected.map(f => f.name).join(', ')}`);
    process.exit(2);
  }

  const problems: string[] = [];
  if (!only) {
    for (const figureSet of (set ? [set] : Object.keys(SET_DIRS)) as FigureSet[]) {
      const expected = new Set(ALL_FIGURES.filter(f => setOf(f) === figureSet).map(f => basename(sourcePath(f))));
      for (const f of sourcesOnDisk(figureSet)) if (!expected.has(f)) problems.push(`stray source with no figure entry in ${figureSet}: ${f}`);
    }
  }
  for (const fig of figures) {
    if (!existsSync(sourcePath(fig))) problems.push(`missing source: ${sourcePath(fig).slice(ROOT.length + 1)}`);
  }
  if (problems.length) {
    for (const p of problems) console.error(`build-spec-diagrams: ${p}`);
    process.exit(1);
  }

  for (const fig of figures) mkdirSync(SET_DIRS[setOf(fig)].out, { recursive: true });
  const work = mkdtempSync(join(tmpdir(), 'lolly-spec-diagrams-'));
  const changed: string[] = [];
  try {
    for (const fig of figures) for (const variant of figureVariants(fig)) {
      const file = basename(outputPath(fig, variant));
      const tmpSvg = join(work, file);
      const warnings = warningsIn(render(fig, tmpSvg, variant));
      const route = figureRoute(fig, variant);
      const next = Buffer.from(withRecipe(readFileSync(tmpSvg, 'utf8'), route));
      const dest = outputPath(fig, variant);
      const prev = existsSync(dest) ? readFileSync(dest) : null;
      const same = prev !== null && stripArtManifest(prev.toString(), 'svg') === next.toString()
        && (await artBindingState(prev)).bound;
      if (!same) changed.push(`${setOf(fig)}/${file}`);
      if (!same && !check) {
        const opts = buildExportC2paOpts({ surface: 'docs', manifest: { id: 'diagram-builder', name: 'Diagram Builder' }, model: [], format: 'svg', days: 365 });
        const environment = opts.environment && typeof opts.environment === 'object' ? opts.environment : {};
        const signed = await embedC2pa(next, 'svg', { ...opts, environment: { ...environment, recipe: route } });
        if (!(await artBindingState(signed)).bound) throw new Error(`${file}: Content Credential does not bind to the diagram`);
        writeFileSync(dest, signed);
      }
      const state = same ? 'unchanged' : check ? 'WOULD CHANGE' : prev === null ? 'new' : 'updated';
      console.log(`${state.padEnd(12)} ${file}  ${next.length} bytes  (${fig.lang})`);
      for (const w of warnings) console.log(`             ${w}`);
    }
    for (const set of new Set(figures.map(setOf))) {
      const recipePath = join(SET_DIRS[set].out, 'recipes.json');
      const recipes = Object.fromEntries(ALL_FIGURES.filter(fig => setOf(fig) === set).map(fig => [figureSlug(fig), { route: figureRoute(fig) }]));
      const nextRecipes = `${JSON.stringify(recipes, null, 2)}\n`;
      if (!existsSync(recipePath) || readFileSync(recipePath, 'utf8') !== nextRecipes) {
        changed.push(`${set}/recipes.json`);
        if (!check) writeFileSync(recipePath, nextRecipes);
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  if (check && changed.length) {
    console.error('');
    console.error('build-spec-diagrams --check: these rendered figures do not match their sources:');
    for (const name of changed) console.error(`  docs/diagrams/${name}`);
    console.error('Run `node scripts/build-spec-diagrams.ts` and commit the result.');
    process.exit(1);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await main();
