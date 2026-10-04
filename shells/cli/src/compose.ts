// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly compose` (plan 291 W6): slides composed from the slide master's archetypes,
 * as a Design document that `lolly package`, `lolly check` and `lolly run design
 * --document` take as it is.
 *
 *   lolly compose <spec.json|-> [--inventory=<inventory.json>|--source=<deck>]
 *                 [--size=1920x1080] [--theme=light|dark] [--file=<tokens.json>]
 *                 [--master=<masters.json>] [--fit=report|shrink] [--output=<design.json>]
 *                 [--edits-out=<edits.json>] [--asset=KEY=PATH]... [--force] [--json]
 *   lolly compose --list [--file=<tokens.json>] [--master=<masters.json>] [--json]
 *   lolly compose --suggest --source=<deck>|--inventory=<inventory.json>
 *                 [--file] [--master] [--output=<spec.json>] [--force] [--json]
 *
 * The work is `composeDesign`, `suggestCompose` and `composeArchetypeListing`
 * (@lolly-tools/node-shell/design-compose), shared with the `lolly_compose` MCP tool,
 * so both hand back the same document for the same spec.
 *
 * The master is the first that answers of `--master`, the catalog master of the design
 * system in use (only when it is the content profile's own), and the neutral master;
 * the report says which. The design system follows `system context`: `--file`, then
 * the active terminal system, then the content profile. With no design system at all
 * the neutral master still composes, so the verb runs on a content-free install.
 *
 * `--source` takes the deck (a `.json` there is read as its inventory, as `lolly check
 * --source` reads one); the deck's pictures are then known by hash, and `--suggest`
 * reads its layouts. `--edits-out` writes the source wording the composed slides change
 * or leave out, in the shape `lolly check --edits` reads.
 *
 * Exit codes: 0 composed (a text slot that still clips is reported, not a failure),
 * 2 usage (an unknown or bare flag, a missing file, a size or theme that is not one, a
 * master or token file that will not read), 4 refused (a spec the composer refuses,
 * with its JSON pointer; an output that exists without --force), 1 a deck that could
 * not be read.
 */

import { readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import type { ComposeReportV1 } from '@lolly-tools/core';
import type { ComposeAssetV1, ComposeDesignSystemV1, ComposeSourceOptionsV1, DesignComposeErrorCodeV1 } from '@lolly-tools/node-shell/design-compose';
import { cleanControlChars } from '@lolly-tools/node-shell/verdict-report';
import { emitResult } from './envelope.ts';
import { CliError, EXIT, usageError } from './exit-codes.ts';
import { note, writeOut } from './output.ts';
import { readStdin } from './run.ts';

export interface ComposeCliOptions {
  json?: boolean;
  /** Every `--asset=KEY=PATH` given, when the flag was repeated. */
  assets?: string[];
}

/** What `lolly compose --help` prints: the three forms, the spec's keys and the exit codes. */
export const COMPOSE_HELP = `lolly compose: slides laid out from the slide master's archetypes, as a Design
document that lolly package, lolly check and lolly run design --document take.

Usage:
  lolly compose <spec.json|-> [--inventory=<inventory.json>|--source=<deck>]
                [--size=1920x1080] [--theme=light|dark] [--themes=light,dark]
                [--file=<tokens.json>] [--master=<masters.json>] [--fit=report|shrink]
                [--output=<design.json>] [--edits-out=<edits.json>]
                [--asset=KEY=PATH]... [--force] [--json]
  lolly compose --list [--file=<tokens.json>] [--master=<masters.json>] [--json]
  lolly compose --suggest --source=<deck>|--inventory=<inventory.json>
                [--file] [--master] [--output=<spec.json>] [--force] [--json]

The spec (schemas/design-compose-v1.schema.json):
  size         {"width":1920,"height":1080}, the default
  theme        light (default) or dark: dark takes each archetype's dark twin
  themes       the token themes the document is for, such as ["light","dark"]:
               with more than one, logos are written as <id>?theme=auto and take
               the mark the surface under them asks for in each theme
  footer       footer text for every slide that shows a footer
  pageNumbers  true (default) numbers slides in presentation order; false leaves
               page-number furniture off
  transition   the deck's slide transition: slide, fade, morph or flight
  gap          px between slides on the canvas, 0 to 100000 (default 160)
  $styles      named text styles over the brief's, for $style in slots and rows
  furniture    the deck's furniture defaults, which each slide's merges over:
               omit lists add up, a slide's footer and logo win
  emphasis     how a source's bold reads in title, subtitle, quote and number
               slots: accent (the brand's accent ink), bold, or keep (bold with the
               source's colours); left out, accent where a weight house rule
               forbids bold, else bold
  case         sentence sets slot text in sentence case (capitals and words like
               iPhone kept; it lowers a Title Case proper noun too, so it is never
               the default); keep leaves it as written
  slides[]     one per slide, in order:
    archetype  an id from lolly compose --list, a -dark twin, or a
               flow-cards-N-C / flow-columns-N-C layout (N 2 to 12, C 1 to 4)
    source     the 1-based slide of --inventory/--source it recreates: from
               looks there first, its notes are carried, its words decide the edits
    slots      by slot key: a role (title) or role#n (body#2), as --list shows
    cells      a repeat archetype's cells in reading order, each keyed by role
    ground     light or dark, over the spec's theme
    notes      a string, true for the source slide's notes, null for none; left
               out, a slide with a source carries that slide's notes
    furniture  {"omit": [ids or kinds: logo, page-number, footer, bar, rect],
                "footer": "...", "logo": "auto" | "mono" | "none"}; auto takes
               the on-photo mark over an under picture covering 90% of the slide.
               When the picture's bytes are here (the --source deck, or
               --asset=KEY=PATH for a placeholder key), compose measures the
               picture under the logo: a mark the brand allows on photography
               must reach 3:1 there, else the logo is left off with a
               compose.logo.photo-contrast note. A slide it cannot draw as the
               canvas does (a photo look) gets compose.logo.photo-unmeasured,
               and a text slot that does not read on the picture gets
               compose.text.photo-contrast
    emphasis, case  over the spec's
    under      Design authoring rows painted before the archetype, x and y
               relative to the slide (a full-bleed photo under a title)
    over       authoring rows painted after it (a line the master has no slot for)
    id, name   the artboard id (s01, s02, ...) and name; intent: your own note

A slot value:
  "text"       Design text markup (**bold**, *italic*, "- " list lines, \\n)
  null or ""   leave the slot out; it is dropped and reported
  {"from": "<inventory object id>", "para": 0}
               that object's words (para picks one 0-based paragraph); a picture's
               object id gives its user/media/<sha256> ref
  {"from": "<id>", "join": ": "}
               every line of that text run into one with ": " between
  {"from": ["<eyebrow id>", "<heading id>"], "join": ": "}
               several text objects in that order, so an eyebrow set as its own
               object joins the heading (without join, each keeps its lines)
  {"from": "<id>", "para": [1, 2]}
               those paragraphs, so a heading set at two sizes fills a title
               and a subtitle; with "join": " " their lines run into one
  {"$table": {"pitch": 80, "columns": [...], "rows": [...]}}
               a table slot (data) set out as text rows in its own box, x and y
               relative to the slot (a divider's own x is measured from the
               slide); nothing else goes beside it
  {"image": "<catalog id | user/media/<sha256> | photo:cover>"}
  any other key overrides the seeded layer: x and y relative to the slide, w, h,
  fg, fontSize, weight, align, valign, fit; $style names a text style. The master
  bindings (id, kind, frame, master, archetype, role, furniture, order, z, group)
  are refused. case and emphasis on a slot win over the slide's. A hex fg keeps
  the master's colour link: one that differs from the master's colour stays in
  every theme, one equal to it still follows the theme; write "{color.role.x}"
  (a token path) to follow another token.

Dark asked of a light archetype with no twin (main-point, split) draws it from the
master under the design system's Dark theme (compose.dark.themed), or keeps it
light when that gives no dark ground (compose.dark.none); a flow-* layout takes a
twin made from the master's dark content slide. ground "light" on a slide whose
archetype is dark by design (title, full-image, closing-thanks) changes nothing
and is a compose.ground.ignored note.

A source's bold set in the accent ink is a compose.emphasis.accent note and an
edit; when the brand allows no accent ink on that ground, bold stays and a
compose.emphasis.no-accent note says why. Bold you write in slot text stays as
written. Each line sentence case changes is an edit with its result and a
compose.case.sentence note. An omit entry that matches no furniture is a
compose.furniture.unknown note (once, at /furniture/omit, for the deck's list).

The report lists, per slide, the
archetype used, the slots filled and dropped, the furniture kept and the text slots
that clip (every text slot is measured; --fit=shrink steps a clipping one down).
--edits-out writes {"edits": [...]}, the shape lolly check --edits reads; replace its
reasons with your own before you hand it over.

Exit codes: 0 composed (a text slot that still clips is reported, not refused),
2 usage, 4 refused (a spec the composer refuses, with its JSON pointer; an output
that exists without --force), 1 a deck that could not be read.
`;

/** The exit code each refusal carries. */
const EXIT_OF: Record<DesignComposeErrorCodeV1, number> = {
  'spec.invalid': EXIT.REFUSED,
  'master.unreadable': EXIT.USAGE,
  'tokens.unreadable': EXIT.USAGE,
  'inventory.invalid': EXIT.USAGE,
  'source.unreadable': EXIT.FAILED,
};

const kindOf = (code: string): string => code.toUpperCase().replace(/[.-]/g, '_');
const isOn = (v: string | undefined): boolean => v !== undefined && !/^(0|false|off|no)$/i.test(v);
const clean = cleanControlChars;

function asCliError(err: unknown): unknown {
  if (err instanceof Error && err.name === 'DesignComposeError') {
    const code = (err as Error & { code: DesignComposeErrorCodeV1 }).code;
    return new CliError(err.message, EXIT_OF[code] ?? EXIT.FAILED, kindOf(code), code);
  }
  return err;
}

async function readPath(path: string, what: string): Promise<Uint8Array> {
  try {
    return new Uint8Array(await readFile(resolve(process.cwd(), path)));
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') throw usageError(`No file at ${path} (${what}).`, 'FILE_NOT_FOUND');
    if (code === 'EISDIR') throw usageError(`${path} is a folder; ${what} takes a file.`, 'BAD_FLAG_VALUE');
    throw err;
  }
}

function parseJson(bytes: Uint8Array, what: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch (err) {
    throw usageError(`${what} is not JSON (${(err as Error).message}).`, 'BAD_INPUT');
  }
}

/** Refuse an output file that exists, unless `--force` asks for the file to be replaced. */
async function refuseExisting(path: string | undefined, shown: string, force: boolean): Promise<void> {
  if (!path || force) return;
  if (await stat(path).catch(() => null)) throw new CliError(`${shown} already exists; pass --force to replace it.`, EXIT.REFUSED, 'OUTPUT_EXISTS');
}

async function refuseMissingFolder(path: string | undefined, shown: string): Promise<void> {
  if (!path) return;
  const info = await stat(dirname(path)).catch(() => null);
  if (!info?.isDirectory()) throw usageError(`The folder for ${shown} does not exist; make it first.`, 'BAD_FLAG_VALUE');
}

/** The flags only one form of the verb takes, so naming one with another form is said. */
const COMPOSE_ONLY = ['size', 'theme', 'themes', 'fit', 'edits-out', 'asset'] as const;
const SOURCE_FLAGS = ['inventory', 'source'] as const;

function refuseFlags(flags: Record<string, string>, names: readonly string[], form: string): void {
  const named = names.find((f) => flags[f] !== undefined);
  if (named) throw usageError(`--${named} does not apply to ${form}.`, 'UNKNOWN_FLAG');
}

/** The design system by the `system context` ladder, in the form compose takes. */
async function designSystemFor(flags: Record<string, string>): Promise<ComposeDesignSystemV1> {
  const { briefSource } = await import('./system.ts');
  const { doc, origin, name } = await briefSource(flags);
  return { doc, origin: origin?.kind ?? null, ...(name ? { name } : {}) };
}

/** `--inventory` or `--source` (a deck, or a `.json` inventory), as compose takes them. */
async function sourceOptions(flags: Record<string, string>): Promise<Pick<ComposeSourceOptionsV1, 'inventory' | 'source'>> {
  if (flags.inventory !== undefined && flags.source !== undefined && /\.json$/i.test(flags.source))
    throw usageError('--source is an inventory and so is --inventory: give one of the two.', 'BAD_FLAG_VALUE');
  const out: Pick<ComposeSourceOptionsV1, 'inventory' | 'source'> = {};
  if (flags.inventory !== undefined) out.inventory = parseJson(await readPath(flags.inventory, '--inventory'), flags.inventory);
  if (flags.source !== undefined) {
    const bytes = await readPath(flags.source, '--source');
    if (/\.json$/i.test(flags.source)) out.inventory = parseJson(bytes, flags.source);
    else out.source = { bytes, name: basename(flags.source) };
  }
  return out;
}

async function commonOptions(flags: Record<string, string>): Promise<ComposeSourceOptionsV1> {
  return {
    designSystem: await designSystemFor(flags),
    ...(flags.master !== undefined ? { master: resolve(process.cwd(), flags.master) } : {}),
  };
}

/** "1 slide", "2 slides". */
const count = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

/** The human summary of a composed deck: the master, a line per slide, then the notes. */
export function composeOutline(report: ComposeReportV1, extra: { output?: string; editsOut?: string; edits: number; assets: ComposeAssetV1[]; next: string[] }): string {
  const lines = [
    `${extra.output ? `${clean(extra.output)}: ` : ''}${count(report.slides.length, 'slide')} at ${report.size.width}x${report.size.height} on ${clean(report.master.id)} ${clean(report.master.version)} (${report.master.origin}).`,
  ];
  for (const s of report.slides) {
    const fit = s.fit ?? [];
    const clipped = fit.filter((f) => f.overflow).map((f) => f.layerId);
    const shrunk = fit.filter((f) => f.shrunk).length;
    const swapped = s.archetype !== s.requested ? ` (asked ${clean(s.requested)})` : '';
    lines.push(
      `  ${String(s.index + 1).padStart(2)}  ${clean(s.archetype)}${swapped}  ${s.ground}  filled ${s.filled.length}${s.dropped.length ? `, dropped ${clean(s.dropped.join(' '))}` : ''}${s.notes ? ', notes' : ''}${shrunk ? `, ${shrunk} shrunk` : ''}${clipped.length ? `, CLIPS ${clean(clipped.join(' '))}` : ''}`,
    );
  }
  if (extra.edits) lines.push(`${count(extra.edits, 'source string')} changed or left out${extra.editsOut ? `, written to ${clean(extra.editsOut)}` : '; pass --edits-out=<edits.json> to declare them for lolly check'}.`);
  if (extra.assets.length) lines.push(`Pictures: ${extra.assets.map((a) => `${clean(a.key)} (${a.sha256.slice(0, 12)})`).join(', ')}.`);
  if (extra.next.length) lines.push(`Next: ${extra.next.join('; ')}.`);
  return `${lines.join('\n')}\n`;
}

/** The `--asset` argument for each picture: the file `lolly read --media` wrote, else its name there. */
function assetArgs(assets: ComposeAssetV1[]): string {
  return assets.map((a) => ` --asset=${a.key}=${a.file ?? `<media>/${a.name}`}`).join('');
}

/** A flag value as one shell word: quoted when it holds a space or a shell character. */
function shellWord(value: string): string {
  return /^[\w@%+=:,./-]+$/.test(value) ? value : JSON.stringify(value);
}

/**
 * The flags a next command repeats so it reads the same design system and master
 * (plan 291 section 6): `--file` and, for compose itself, `--master`. Empty when none
 * was given.
 */
function systemArgs(flags: Record<string, string>, names: ReadonlyArray<'file' | 'master'>): string {
  return names.filter((n) => flags[n]).map((n) => ` --${n}=${shellWord(flags[n]!)}`).join('');
}

async function listCli(flags: Record<string, string>, opts: ComposeCliOptions): Promise<number> {
  refuseFlags(flags, [...COMPOSE_ONLY, ...SOURCE_FLAGS, 'output', 'force', 'suggest'], 'lolly compose --list, which takes --file and --master');
  const { composeArchetypeListing } = await import('@lolly-tools/node-shell/design-compose');
  let listing: Awaited<ReturnType<typeof composeArchetypeListing>>;
  try {
    listing = await composeArchetypeListing(await commonOptions(flags));
  } catch (err) {
    throw asCliError(err);
  }
  if (opts.json) {
    await emitResult(listing, EXIT.OK);
    return EXIT.OK;
  }
  const m = listing.master;
  const lines = [`${clean(m.id)} ${clean(m.version)} "${clean(m.name)}" (${m.origin}), ${m.size.width}x${m.size.height}, ${count(listing.archetypes.length, 'archetype')}:`];
  for (const a of listing.archetypes) {
    const slots = a.slots.map((s) => `${s.key}${s.optional ? '?' : ''}${s.kind === 'text' ? '' : `:${s.kind}`}`).join(' ');
    lines.push(`  ${clean(a.id).padEnd(26)} ${a.ground.padEnd(5)} ${slots}${a.cells ? `  x${a.cells} cells` : ''}${a.dark ? `  dark: ${clean(a.dark)}` : ''}`);
  }
  for (const n of listing.notes) note(`Note (${n.code}): ${clean(n.message)}`);
  await writeOut(`${lines.join('\n')}\n`);
  return EXIT.OK;
}

async function suggestCli(positionals: string[], flags: Record<string, string>, opts: ComposeCliOptions): Promise<number> {
  refuseFlags(flags, [...COMPOSE_ONLY, 'list'], 'lolly compose --suggest, which takes --source or --inventory, --file, --master and --output');
  if (positionals.length) throw usageError('lolly compose --suggest reads a deck from --source or --inventory, and takes no spec.', 'TOO_MANY_ARGUMENTS');
  if (flags.source === undefined && flags.inventory === undefined)
    throw usageError('lolly compose --suggest needs the deck: --source=<deck> (or --inventory=<inventory.json>).', 'MISSING_ARGUMENT');
  const output = flags.output && flags.output !== '-' ? resolve(process.cwd(), flags.output) : undefined;
  await refuseExisting(output, flags.output ?? '', isOn(flags.force));
  const { suggestCompose } = await import('@lolly-tools/node-shell/design-compose');
  let suggested: Awaited<ReturnType<typeof suggestCompose>>;
  try {
    suggested = await suggestCompose({ ...(await commonOptions(flags)), ...(await sourceOptions(flags)) });
  } catch (err) {
    throw asCliError(err);
  }
  const specText = `${JSON.stringify(suggested.spec, null, 2)}\n`;
  if (output) await writeFile(output, specText);
  const assets = suggested.assets.map(({ bytes: _bytes, ...rest }) => rest);
  const next = output ? [`lolly compose ${flags.output}${flags.source !== undefined ? ` --source=${flags.source}` : ` --inventory=${flags.inventory}`}${systemArgs(flags, ['file', 'master'])} --output=<design.json> --edits-out=<edits.json>`] : [];
  if (opts.json) {
    await emitResult({ ...(output ? { output } : { spec: suggested.spec }), master: suggested.master, reasons: suggested.reasons, assets, next }, EXIT.OK);
    return EXIT.OK;
  }
  if (!output) {
    await writeOut(specText);
    return EXIT.OK;
  }
  const lines = [`${clean(flags.output!)}: ${count(suggested.spec.slides.length, 'slide')} suggested on ${clean(suggested.master.id)} (${suggested.master.origin}).`];
  for (const r of suggested.reasons as Array<{ slide?: number; archetype?: string; why?: string }>) lines.push(`  ${String(r.slide ?? '').padStart(2)}  ${clean(String(r.archetype ?? ''))}  ${clean(String(r.why ?? ''))}`);
  if (next.length) lines.push(`Next: ${next.join('; ')}.`);
  await writeOut(`${lines.join('\n')}\n`);
  return EXIT.OK;
}

async function readSpec(path: string | undefined): Promise<{ spec: unknown; name: string }> {
  if (!path) throw usageError('lolly compose needs a spec: lolly compose <spec.json|->, or --list for the archetypes, or --suggest --source=<deck> for a first spec.', 'MISSING_ARGUMENT');
  if (path === '-') {
    const bytes = new Uint8Array(await readStdin());
    if (!bytes.length) throw usageError('Standard input is empty.', 'EMPTY_INPUT');
    return { spec: parseJson(bytes, 'Standard input'), name: 'standard-input.json' };
  }
  return { spec: parseJson(await readPath(path, 'the spec'), path), name: basename(path) };
}

/** Run `lolly compose` in whichever of its three forms the flags name. Returns the exit code. */
export async function composeCli(positionals: string[], flags: Record<string, string>, opts: ComposeCliOptions = {}): Promise<number> {
  if (isOn(flags.list) && isOn(flags.suggest)) throw usageError('--list and --suggest are two forms of lolly compose: give one.', 'BAD_FLAG_VALUE');
  if (isOn(flags.list)) {
    if (positionals.length) throw usageError('lolly compose --list takes no spec.', 'TOO_MANY_ARGUMENTS');
    return listCli(flags, opts);
  }
  if (isOn(flags.suggest)) return suggestCli(positionals, flags, opts);
  if (positionals.length > 1) throw usageError(`lolly compose takes one spec; got ${positionals.length}.`, 'TOO_MANY_ARGUMENTS');

  const { parseComposeSize } = await import('@lolly-tools/node-shell/design-compose');
  let size: { width: number; height: number } | undefined;
  if (flags.size !== undefined) {
    const parsed = parseComposeSize(flags.size);
    if (!parsed) throw usageError(`--size takes WIDTHxHEIGHT in px, such as 1920x1080 (got "${flags.size}").`, 'BAD_FLAG_VALUE');
    size = parsed;
  }
  const theme = flags.theme;
  if (theme !== undefined && theme !== 'light' && theme !== 'dark') throw usageError(`--theme must be light or dark: dark picks each archetype's dark twin (got "${theme}").`, 'BAD_FLAG_VALUE');
  const fit = flags.fit;
  if (fit !== undefined && fit !== 'report' && fit !== 'shrink') throw usageError(`--fit must be report or shrink (got "${fit}").`, 'BAD_FLAG_VALUE');
  const themes = flags.themes === undefined ? undefined : flags.themes.split(',').map((name) => name.trim()).filter(Boolean);
  if (themes !== undefined && (!themes.length || themes.length > 16 || new Set(themes).size !== themes.length)) {
    throw usageError(`--themes takes 1 to 16 distinct theme names separated by commas, such as light,dark (got "${flags.themes}").`, 'BAD_FLAG_VALUE');
  }

  const { spec } = await readSpec(positionals[0]);
  const output = flags.output && flags.output !== '-' ? resolve(process.cwd(), flags.output) : undefined;
  const editsFlag = flags['edits-out'];
  if (editsFlag !== undefined && (editsFlag === '' || editsFlag === '-')) {
    throw usageError('--edits-out names the file the edits are written to; with --json they are also under "edits" on standard output.', 'BAD_FLAG_VALUE');
  }
  const editsOut = editsFlag !== undefined ? resolve(process.cwd(), editsFlag) : undefined;
  // macOS and Windows folders usually ignore case, so Deck.json and deck.json are one file there.
  const samePath = (a: string, b: string): boolean => (process.platform === 'darwin' || process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b);
  if (output && editsOut && samePath(output, editsOut)) {
    throw usageError(`--output and --edits-out both name ${flags.output}; the document and its edits go to two files.`, 'BAD_FLAG_VALUE');
  }
  const force = isOn(flags.force);
  await refuseExisting(output, flags.output ?? '', force);
  await refuseExisting(editsOut, editsFlag ?? '', force);
  // Both folders before either file, so a missing one never leaves half the output behind.
  await refuseMissingFolder(output, flags.output ?? '');
  await refuseMissingFolder(editsOut, editsFlag ?? '');

  // --asset=KEY=PATH, as lolly package takes it: the picture for a placeholder key, so
  // logo: auto can measure a photograph under a slide (plan 291 M4).
  const assetArgsGiven = opts.assets ?? (flags.asset !== undefined ? [flags.asset] : []);
  const givenAssets: Record<string, Uint8Array> = {};
  for (const value of assetArgsGiven) {
    const at = value.indexOf('=');
    const key = at > 0 ? value.slice(0, at) : '';
    const path = at > 0 ? value.slice(at + 1) : '';
    if (!key || !path) throw usageError(`--asset takes KEY=PATH, the image value rows name and the picture file (got "${value}").`, 'BAD_FLAG_VALUE');
    givenAssets[key] = await readPath(path, `--asset ${key}`);
  }

  const { composeDesign } = await import('@lolly-tools/node-shell/design-compose');
  let composed: Awaited<ReturnType<typeof composeDesign>>;
  try {
    composed = await composeDesign(spec, {
      ...(await commonOptions(flags)),
      ...(await sourceOptions(flags)),
      ...(size ? { size } : {}),
      ...(theme ? { theme: theme as 'light' | 'dark' } : {}),
      ...(themes ? { themes } : {}),
      ...(fit ? { fit: fit as 'report' | 'shrink' } : {}),
      ...(Object.keys(givenAssets).length ? { assets: givenAssets } : {}),
    });
  } catch (err) {
    throw asCliError(err);
  }

  const documentText = `${JSON.stringify(composed.document, null, 2)}\n`;
  if (output) await writeFile(output, documentText);
  if (editsOut) await writeFile(editsOut, `${JSON.stringify({ edits: composed.edits }, null, 2)}\n`);
  const assets = composed.assets.map(({ bytes: _bytes, ...rest }) => rest);
  const next: string[] = [];
  if (output) {
    const shown = flags.output!;
    const stem = shown.replace(/\.json$/i, '').replace(/\.(design|compose|boxes)$/i, '') || 'deck';
    const deck = flags.source !== undefined && !/\.json$/i.test(flags.source) ? ` --source=${flags.source}` : '';
    // With the deck, lolly package takes every picture it holds from --source, photo:<sha12>
    // keys included; with an inventory alone, each picture is the file lolly read wrote.
    const given = assetArgsGiven.map((a) => ` --asset=${a}`).join('');
    // The same --file system the document was composed in, and its themes, so the package
    // caches the same colours and the check judges every theme (plan 291 section 6).
    const system = systemArgs(flags, ['file']);
    const specThemes = (spec as { themes?: unknown } | null)?.themes;
    const docThemes = themes ?? (Array.isArray(specThemes) && specThemes.every((t) => typeof t === 'string') ? specThemes as string[] : undefined);
    const themesArg = docThemes && docThemes.length > 1 ? ` --themes=${shellWord(docThemes.join(','))}` : '';
    next.push(`lolly package ${shown}${deck ? deck : assetArgs(composed.assets)}${given}${system} --output=${stem}.lolly`);
    const against = flags.source ?? flags.inventory;
    next.push(`lolly check ${stem}.lolly${against !== undefined ? ` --source=${against}${editsOut ? ` --edits=${flags['edits-out']}` : ''}` : ''}${themesArg}${system}`);
  }
  if (opts.json) {
    await emitResult({
      ...(output ? { output } : { document: composed.document }),
      report: composed.report,
      edits: composed.edits,
      ...(editsOut ? { editsOutput: editsOut } : {}),
      assets,
      next,
    }, EXIT.OK);
    return EXIT.OK;
  }
  for (const n of composed.report.notes) note(`Note (${clean(n.code)}): ${clean(n.message)}`);
  if (!output) {
    await writeOut(documentText);
    return EXIT.OK;
  }
  await writeOut(composeOutline(composed.report, { output: flags.output!, ...(editsOut ? { editsOut: flags['edits-out']! } : {}), edits: composed.edits.length, assets: composed.assets, next }));
  return EXIT.OK;
}
