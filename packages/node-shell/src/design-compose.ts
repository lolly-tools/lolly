// SPDX-License-Identifier: MPL-2.0
/**
 * The Node half of composing slides from a slide master's archetypes (plan 291 W6):
 * `lolly compose` and the `lolly_compose` MCP tool both call these three functions, so
 * the two surfaces hand an agent the same document for the same spec.
 *
 *   - `composeDesign` resolves the master, the design system and the source text, calls
 *     the engine's pure `composeDesignSlides`, then measures every composed text slot
 *     (`fit`) and lists the pictures the document names (`assets`);
 *   - `suggestCompose` reads a deck (or takes its inventory) and calls the engine's
 *     `suggestComposeSlides` for a first spec, with the pictures it names;
 *   - `listComposeArchetypes` is the compact archetype catalogue of the resolved master.
 *
 * THE MASTER LADDER. An explicit master file (`master`, a masters.json or one master)
 * comes first; then the catalog master of the design system in use, which exists only
 * when that system is the content profile's own (`readBriefCatalogFor`); then the
 * engine's `neutralSlideMaster()`. The report records which one answered (`flag`,
 * `catalog` or `neutral`), so a composed deck never claims a brand master it did not use.
 *
 * THE DESIGN SYSTEM. `designSystem` when the caller resolved one (the CLI passes the
 * `system context` ladder: `--file`, the terminal system, the profile); else `file`, a
 * token document on disk; else the active content profile's head tokens. Its colour
 * tokens resolve the master's token paths, and its brief sizes the text styles.
 *
 * FIT. Measurement runs here, never in the engine: HarfBuzz with the faces the canvas
 * loads (`measureDesignRowsReport`). `report` (the default) only records each composed
 * text slot's lines and whether it clips. `shrink` steps a clipping slot's font size
 * down in whole px, to no less than the smallest size the master sets for that role
 * anywhere, and reports what still clips. `maxUnits` caps the characters measured,
 * shrink's extra measures included, so a hosted call ends inside its time; what it
 * leaves unmeasured is listed (`unmeasured`) and noted, never reported as fitting.
 *
 * Reads files and nothing else: no network, no browser.
 */

import { readFile } from 'node:fs/promises';

import {
  composeArchetypeCatalog,
  composeDesignSlides,
  createTokenSet,
  parseTreatedAssetId,
  designBrief,
  withoutRunRefs,
  masterAtSize,
  neutralSlideMaster,
  type DesignComposeContext,
} from '@lolly/engine';
import { roleFontSize } from '@lolly-tools/core';
import type { ComposeReportV1, ContentInventoryV1, DesignComposeSpecV1, SlideMasterV1, TextMeasureV1 } from '@lolly-tools/core';

import { contentInventoryProblems, unwrapContentInventory } from './check.ts';
import { mediaFileName, readContentInventory } from './content-inventory.ts';
import { readBriefCatalogFor, readProfileTokenDocument, type BriefOriginKindV1 } from './design-brief.ts';
import { mediaHashPrefixOfKey } from './design-lolly.ts';
import { DARK_THEME_NAME, colorTokensFromDtcg, darkColorsFromDtcg, isUsableMaster } from './rebrand/design-system.ts';
import { measureDesignRowsReport, measureFontsFromBrief, measureTextNode, textMeasureSpecOfRow } from './text-measure.ts';
import { measureComposePhotos } from './compose-photo-surface.ts';

type Row = Record<string, unknown>;

/** Every code a compose refusal carries. A caller branches on `code`, never on the wording. */
export type DesignComposeErrorCodeV1 =
  | 'spec.invalid'
  | 'master.unreadable'
  | 'tokens.unreadable'
  | 'inventory.invalid'
  | 'source.unreadable';

export class DesignComposeError extends Error {
  readonly code: DesignComposeErrorCodeV1;
  constructor(code: DesignComposeErrorCodeV1, message: string) {
    super(message);
    this.name = 'DesignComposeError';
    this.code = code;
  }
}

/** A design system a caller already resolved, with where it came from. */
export interface ComposeDesignSystemV1 {
  doc: unknown;
  origin: BriefOriginKindV1 | null;
  name?: string;
}

/** Where the master, the design system and the source text come from. */
export interface ComposeSourceOptionsV1 {
  /** The source deck's inventory (`lolly read --json`, its envelope, or a `lolly_read` result). */
  inventory?: ContentInventoryV1 | unknown;
  /** The source deck itself; read here when no inventory is given. */
  source?: { bytes: Uint8Array; name: string };
  /** A token document on disk. */
  file?: string;
  /** A masters.json (or one master as JSON) on disk: the first rung of the ladder. */
  master?: string;
  /** A design system the caller resolved; wins over `file` and the profile. */
  designSystem?: ComposeDesignSystemV1;
}

export interface ComposeDesignOptionsV1 extends ComposeSourceOptionsV1 {
  /** The artboard size; wins over the spec's own `size`. Default 1920x1080. */
  size?: { width: number; height: number };
  /** `dark` picks each archetype's dark twin; wins over the spec's own `theme`. */
  theme?: 'light' | 'dark';
  /**
   * The token themes the document is composed for; wins over the spec's own `themes`.
   * With more than one, logo furniture is written as `<id>?theme=auto` (plan 291 W4).
   */
  themes?: string[];
  /** `report` (default) records what clips; `shrink` steps a clipping slot down to the master's smallest size for its role. */
  fit?: 'report' | 'shrink';
  /**
   * Text units (UTF-16) fitting measures at most, counting every measure `shrink` makes
   * again at a smaller size. A slot past the budget is left unmeasured with a
   * `compose.fit.unmeasured` note, and a clipping slot keeps its size once the budget
   * cannot pay for another step. A hosted server sets this so a call ends inside the
   * function's time. Default: no budget.
   */
  maxUnits?: number;
  /**
   * Picture bytes by the `image` value rows name (`photo:cover`), as `lolly package
   * --asset` takes them (plan 291 M4). With the source deck's media, they let `logo:
   * auto` measure a photograph under a slide before it keeps a mark there.
   */
  assets?: Record<string, Uint8Array>;
}

/** A picture the composed document names, with the bytes when the source deck was read here. */
export interface ComposeAssetV1 {
  /** The exact `image` value the rows carry: `photo:<sha12>` or `user/media/<sha256>`. */
  key: string;
  sha256: string;
  /** The file name `lolly read --media` writes it under, `<sha256>.<ext>`. */
  name: string;
  mime?: string;
  /** Where `lolly read --media` wrote it, when the inventory says. */
  file?: string;
  bytes?: Uint8Array;
}

export interface ComposeDesignResultV1 {
  document: Record<string, unknown>;
  report: ComposeReportV1;
  edits: unknown[];
  assets: ComposeAssetV1[];
  /** The composed text slots fitting did not measure (a face not here, or past `maxUnits`); each has a `compose.fit.unmeasured` note. */
  unmeasured: string[];
}

/** The master the ladder chose, with its logos, the design system's tokens and its brief. */
export interface ResolvedComposeMasterV1 {
  master: SlideMasterV1;
  origin: 'flag' | 'catalog' | 'neutral';
  logos?: DesignComposeContext['logos'];
  /** The design system's token document, or null when none resolves. */
  doc: unknown;
  brief: unknown | null;
  /** Why a rung was passed over, for the report's notes. */
  notes: Array<{ path: string; code: string; message: string }>;
}

/** The artboard size a spec gets when it names none, px. */
export const COMPOSE_DEFAULT_SIZE = Object.freeze({ width: 1920, height: 1080 });
/** The largest artboard side compose takes, px. */
export const COMPOSE_MAX_SIDE = 16384;

const record = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);

/** `1920x1080` (or `1920×1080`) as a size; null when it is not one. */
export function parseComposeSize(value: string): { width: number; height: number } | null {
  const m = /^\s*(\d+)\s*[x×X]\s*(\d+)\s*$/.exec(value);
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (!(width >= 1 && height >= 1 && width <= COMPOSE_MAX_SIDE && height <= COMPOSE_MAX_SIDE)) return null;
  return { width, height };
}

// ─── the design system and the master ladder ─────────────────────────────────

async function readJsonFile(path: string, code: DesignComposeErrorCodeV1, what: string): Promise<unknown> {
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch (err) {
    throw new DesignComposeError(code, `${what} ${path} could not be read: ${(err as Error).message}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new DesignComposeError(code, `${what} ${path} is not JSON: ${(err as Error).message}`);
  }
}

async function designSystemOf(opts: ComposeSourceOptionsV1): Promise<ComposeDesignSystemV1> {
  if (opts.designSystem) return opts.designSystem;
  if (opts.file) return { doc: await readJsonFile(opts.file, 'tokens.unreadable', 'The token document'), origin: 'file' };
  const profile = readProfileTokenDocument();
  if (!profile) return { doc: null, origin: null };
  return { doc: profile.doc, origin: 'profile', ...(profile.label ? { name: profile.label } : {}) };
}

/** The first usable master in a masters.json, or the master itself when the file is one. */
function masterFromFile(value: unknown, path: string): SlideMasterV1 {
  const candidate = record(value) && Array.isArray(value.masters) ? value.masters[0] : value;
  if (!isUsableMaster(candidate))
    throw new DesignComposeError('master.unreadable', `${path} holds no slide master this build can use: a masters.json ({version: 1, masters: [...]}) or one master with id, size, archetypes, furniture, typeScale and logo.`);
  return candidate;
}

/**
 * The master ladder: an explicit master file, then the design system's catalog master
 * (only when the system is the profile's own), then the neutral master.
 */
export async function resolveComposeMaster(opts: ComposeSourceOptionsV1 = {}): Promise<ResolvedComposeMasterV1> {
  const system = await designSystemOf(opts);
  const notes: ResolvedComposeMasterV1['notes'] = [];
  const catalog = readBriefCatalogFor(system.origin, system.doc);
  let brief: unknown | null = null;
  if (system.doc !== null && system.doc !== undefined) {
    try {
      brief = designBrief(system.doc, catalog, system.name ? { name: system.name } : {});
    } catch (err) {
      throw new DesignComposeError('tokens.unreadable', `The design system could not be read: ${(err as Error).message}`);
    }
  }
  const logosOf = (master: SlideMasterV1): DesignComposeContext['logos'] | undefined =>
    catalog?.master?.id === master.id && catalog.logos && Object.keys(catalog.logos).length ? { ...catalog.logos } : undefined;
  if (opts.master) {
    const master = masterFromFile(await readJsonFile(opts.master, 'master.unreadable', 'The slide master'), opts.master);
    const logos = logosOf(master);
    if (!logos) notes.push({ path: '/master', code: 'compose.master.no-logos', message: `The master from ${opts.master} has no logo this design system resolves, so logo furniture is left out.` });
    return { master, origin: 'flag', ...(logos ? { logos } : {}), doc: system.doc, brief, notes };
  }
  if (catalog?.master) {
    const logos = logosOf(catalog.master);
    return { master: catalog.master, origin: 'catalog', ...(logos ? { logos } : {}), doc: system.doc, brief, notes };
  }
  notes.push({
    path: '/master',
    code: 'compose.master.neutral',
    message: system.origin === null
      ? 'No design system resolves here, so the neutral master is used.'
      : system.origin === 'profile'
        ? 'The design system has no slide master, so the neutral master is used.'
        : 'The design system in use is not the content profile\'s own, so its catalog master does not apply and the neutral master is used. Pass --master=<masters.json> for another.',
  });
  return { master: neutralSlideMaster(), origin: 'neutral', doc: system.doc, brief, notes };
}

function tokenResolver(doc: unknown): (path: string) => string | undefined {
  if (doc === null || doc === undefined) return () => undefined;
  let colours: Map<string, string>;
  try {
    colours = colorTokensFromDtcg(doc);
  } catch {
    return () => undefined;
  }
  return (path) => colours.get(path);
}

/**
 * A token reference an `under` row writes (`{color.brand.pine}`, a `$tint`) as the
 * colour value the deck's theme gives it, for the photo measurement; null when it
 * does not resolve to a colour. Role tokens count here, as they do on the canvas.
 */
function photoColourResolver(doc: unknown, theme: string | undefined): (ref: string) => string | null {
  if (doc === null || doc === undefined) return () => null;
  let set: ReturnType<typeof createTokenSet>;
  try {
    const base = createTokenSet(doc);
    const dark = theme === 'dark' ? base.themes().find((one) => DARK_THEME_NAME.test(one.name.trim())) : undefined;
    set = dark ? createTokenSet(doc, { theme: dark.name }) : base;
  } catch {
    return () => null;
  }
  return (ref) => {
    const path = ref.trim().replace(/^\{\s*|\s*\}$/g, '');
    const entry = set.get(path);
    return entry && entry.type === 'color' && typeof entry.value === 'string' && entry.value ? entry.value : null;
  };
}

/**
 * The design system's tokens in the deck's theme (the dark-named token theme for a dark
 * deck), the theme a composed document's literals are cached in (plan 291 W4, E20).
 * Null when there is no design system or it cannot be read.
 */
function composeTokenSet(doc: unknown, theme: string | undefined): ReturnType<typeof createTokenSet> | null {
  if (doc === null || doc === undefined) return null;
  try {
    const base = createTokenSet(doc);
    const dark = theme === 'dark' ? base.themes().find((one) => DARK_THEME_NAME.test(one.name.trim())) : undefined;
    return dark ? createTokenSet(doc, { theme: dark.name }) : base;
  } catch {
    return null;
  }
}

/**
 * The design system's tokens in each theme the spec names, by name (plan 291 M4): what
 * compose reads to tell a colour that follows the theme from one that never changes.
 * A name the design system does not declare is left out. Null with fewer than two.
 */
function composeThemeTokens(doc: unknown, names: readonly string[] | undefined): Record<string, ReturnType<typeof createTokenSet>> | null {
  if (doc === null || doc === undefined || !names || names.length < 2) return null;
  try {
    const declared = createTokenSet(doc).themes().map((one) => one.name);
    const out: Record<string, ReturnType<typeof createTokenSet>> = {};
    for (const name of names) {
      const hit = declared.find((one) => one.trim().toLowerCase() === name.trim().toLowerCase());
      if (hit !== undefined) out[name] = createTokenSet(doc, { theme: hit });
    }
    return Object.keys(out).length > 1 ? out : null;
  } catch {
    return null;
  }
}

/** The design system's colours and dark mode, which a light archetype with no dark twin is themed from in a dark deck. */
function themeColorsOf(doc: unknown): Pick<DesignComposeContext, 'themeColors'> {
  if (doc === null || doc === undefined) return {};
  try {
    const colors = Object.fromEntries(colorTokensFromDtcg(doc));
    const dark = darkColorsFromDtcg(doc);
    if (!Object.keys(colors).length) return {};
    return { themeColors: { colors, ...(dark?.size ? { darkColors: Object.fromEntries(dark) } : {}) } };
  } catch {
    return {};
  }
}

// ─── the source text ─────────────────────────────────────────────────────────

interface SourceRead {
  inventory: ContentInventoryV1 | null;
  /** Picture bytes by sha256, when the deck was read here. */
  media: Map<string, { bytes: Uint8Array; mime: string }>;
  census: unknown;
  source: unknown;
}

function checkedInventory(raw: unknown): ContentInventoryV1 {
  const inventory = unwrapContentInventory(raw);
  const problems = contentInventoryProblems(inventory);
  if (problems.length)
    throw new DesignComposeError('inventory.invalid', `The inventory is not a content inventory (lolly read --json): ${problems.slice(0, 3).join('; ')}${problems.length > 3 ? '; ...' : ''}.`);
  return inventory as ContentInventoryV1;
}

async function readSource(opts: ComposeSourceOptionsV1): Promise<SourceRead> {
  const media = new Map<string, { bytes: Uint8Array; mime: string }>();
  // The deck is read whenever it is given, for its pictures' bytes and its census; an
  // inventory given with the deck still answers for the text.
  if (opts.source) {
    let read: Awaited<ReturnType<typeof readContentInventory>>;
    try {
      read = await readContentInventory({ bytes: opts.source.bytes, name: opts.source.name });
    } catch (err) {
      throw new DesignComposeError('source.unreadable', `${opts.source.name} could not be read: ${(err as Error).message}`);
    }
    for (const [ref, item] of read.media) {
      const hex = /([0-9a-f]{64})$/.exec(ref)?.[1];
      if (hex) media.set(hex, { bytes: item.bytes, mime: item.mime });
    }
    const inventory = opts.inventory !== undefined ? checkedInventory(opts.inventory) : read.inventory;
    return { inventory, media, census: read.census ?? null, source: read.source ?? null };
  }
  return { inventory: opts.inventory !== undefined ? checkedInventory(opts.inventory) : null, media, census: null, source: null };
}

// ─── the pictures a document names ───────────────────────────────────────────

const imageId = (value: unknown): string => (typeof value === 'string' ? value : record(value) && typeof value.id === 'string' ? value.id : '');

/** Every picture the rows name that the source deck can supply, and the placeholder keys nothing supplies. */
function assetsOf(rows: readonly unknown[], read: SourceRead): { assets: ComposeAssetV1[]; needed: string[] } {
  const known = new Map<string, { sha256: string; mime: string; file?: string }>();
  for (const m of read.inventory?.media ?? []) known.set(m.sha256, { sha256: m.sha256, mime: m.mime, ...(m.file ? { file: m.file } : {}) });
  for (const [sha256, m] of read.media) if (!known.has(sha256)) known.set(sha256, { sha256, mime: m.mime });
  const byPrefix = (prefix: string): { sha256: string; mime: string; file?: string } | undefined => {
    const hits = [...known.values()].filter((m) => m.sha256.startsWith(prefix));
    return hits.length === 1 ? hits[0] : undefined;
  };
  const assets: ComposeAssetV1[] = [];
  const needed: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    if (!record(row) || !('image' in row)) continue;
    // A photo look rides on the id (`photo:<sha12>?treatment=<look>`); the bytes are the
    // base picture's, which is the key lolly package resolves and --asset names.
    const key = parseTreatedAssetId(imageId(row.image)).baseId;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const upload = /^user\/media\/([0-9a-f]{64})$/.exec(key);
    // The rule lolly package resolves these keys by, so a picture listed here packages from the deck.
    const prefix = upload ? null : mediaHashPrefixOfKey(key);
    const hit = upload ? known.get(upload[1]!) : prefix ? byPrefix(prefix) : undefined;
    if (hit) {
      const bytes = read.media.get(hit.sha256)?.bytes;
      assets.push({ key, sha256: hit.sha256, name: mediaFileName(hit.sha256, hit.mime), mime: hit.mime, ...(hit.file ? { file: hit.file } : {}), ...(bytes ? { bytes } : {}) });
    } else if (!upload && /^[a-z][a-z0-9+.-]*:/i.test(key) && !/^(https?:|data:|blob:)/i.test(key)) needed.push(key);
  }
  return { assets, needed };
}

/** The bytes of a picture an `under` row names: a supplied file first, then the source deck's media. */
function pictureBytes(key: string, read: SourceRead, given: Record<string, Uint8Array> | undefined): Uint8Array | null {
  const own = given?.[key];
  if (own) return own;
  const upload = /^user\/media\/([0-9a-f]{64})$/.exec(key);
  if (upload) return read.media.get(upload[1]!)?.bytes ?? null;
  const prefix = mediaHashPrefixOfKey(key);
  if (!prefix) return null;
  const hits = [...read.media].filter(([sha]) => sha.startsWith(prefix));
  return hits.length === 1 ? hits[0]![1].bytes : null;
}

/** Every logo mark compose may place over a photo: the master's, and those a logo-surface rule lists. */
function logoMarks(logos: NonNullable<DesignComposeContext['logos']>, brief: unknown): string[] {
  const out = Object.values(logos).filter((v): v is string => typeof v === 'string' && !!v);
  const rules = record(brief) && record(brief.logos) && Array.isArray(brief.logos.rules) ? brief.logos.rules : [];
  for (const rule of rules) {
    const params = record(rule) && record(rule.parameters) ? rule.parameters : {};
    for (const key of ['photo', 'dark', 'light']) if (Array.isArray(params[key])) out.push(...(params[key] as unknown[]).filter((v): v is string => typeof v === 'string'));
  }
  return [...new Set(out)];
}

// ─── fit ─────────────────────────────────────────────────────────────────────

type FitEntry = NonNullable<ComposeReportV1['slides'][number]['fit']>[number];

/** The smallest px size the master sets for each role, at the composed size. */
function minimumSizes(master: SlideMasterV1): Map<string, number> {
  const out = new Map<string, number>();
  for (const archetype of master.archetypes) {
    for (const ph of archetype.placeholders) {
      if (ph.kind !== 'text') continue;
      const size = roleFontSize(master, ph.role, ph.style);
      if (Number.isFinite(size) && size > 0) out.set(ph.role, Math.min(out.get(ph.role) ?? Infinity, Math.round(size)));
    }
  }
  return out;
}

const clips = (m: TextMeasureV1): boolean => m.overflow?.clipped === true;

async function fitDocument(
  rows: Row[],
  report: ComposeReportV1,
  master: SlideMasterV1,
  brief: unknown | null,
  mode: 'report' | 'shrink',
  maxUnits?: number,
): Promise<string[]> {
  const slots = rows.filter((row) => row.kind === 'text' && typeof row.role === 'string' && !row.furniture && !row.textStory && typeof row.id === 'string');
  if (!slots.length) return [];
  const budget = maxUnits !== undefined && Number.isFinite(maxUnits) && maxUnits >= 0 ? maxUnits : Infinity;
  const unitsOf = (row: Row): number => String(row.text ?? '').length;
  // The slots alone, with no layerIds: a slot whose face is not here is then skipped
  // with the reason, where naming it would refuse the whole run.
  // A `{@path …|}` run is measured by its words: the runtime lowers it to a colour, which
  // takes no width (plan 291 M4).
  const forMeasure = (row: Row): Row => (typeof row.text === 'string' && row.text.includes('{@') ? { ...row, text: withoutRunRefs(row.text) } : row);
  const measured = await measureDesignRowsReport(slots.map(forMeasure), { ...(brief ? { brief } : {}), ...(budget < Infinity ? { maxUnits: budget } : {}) });
  const byId = new Map(slots.map((r) => [r.id as string, r]));
  // What the first pass spent; every shrink step is paid from what is left.
  let spent = measured.measured.reduce((sum, { layerId }) => sum + unitsOf(byId.get(layerId)!), 0);
  const slideOf = new Map(report.slides.map((s, i) => [s.id, i]));
  const fonts = measureFontsFromBrief(brief);
  const floors = minimumSizes(master);
  for (const { layerId, measure } of measured.measured) {
    const row = byId.get(layerId)!;
    let m = measure;
    const entry: FitEntry = { layerId, lines: m.lineCount, overflow: clips(m) };
    const current = Number(row.fontSize);
    let outOfBudget = false;
    if (mode === 'shrink' && clips(m) && Number.isFinite(current)) {
      const floor = Math.min(floors.get(String(row.role)) ?? current, current);
      // The largest whole size from floor to current - 1 that fits: overflow only grows
      // with the size, so a bisection finds it in a handful of measures.
      let lo = floor;
      let hi = Math.floor(current) - 1;
      let best: { size: number; m: TextMeasureV1 } | null = null;
      const tried = new Map<number, TextMeasureV1>();
      const at = async (size: number): Promise<TextMeasureV1> => measureTextNode(textMeasureSpecOfRow({ ...forMeasure(row), fontSize: size }, fonts));
      while (lo <= hi) {
        if (spent + unitsOf(row) > budget) {
          outOfBudget = true;
          break;
        }
        spent += unitsOf(row);
        const mid = Math.floor((lo + hi) / 2);
        const one = await at(mid);
        tried.set(mid, one);
        if (clips(one)) hi = mid - 1;
        else {
          best = { size: mid, m: one };
          lo = mid + 1;
        }
      }
      // A bisection the budget cut short keeps the size it found that fits, or the
      // size the slot had: never a floor it did not get to measure.
      const size = best ? best.size : outOfBudget ? current : floor;
      if (size < current) {
        m = best ? best.m : (tried.get(floor) ?? (await at(floor)));
        row.fontSize = size;
        entry.fontSize = size;
        entry.shrunk = true;
        entry.lines = m.lineCount;
        entry.overflow = clips(m);
      }
    }
    const index = slideOf.get(String(row.frame ?? ''));
    if (index === undefined) continue;
    const slide = report.slides[index]!;
    if (!slide.fit) slide.fit = [];
    slide.fit.push(entry);
    if (entry.overflow)
      report.notes.push({
        path: `/slides/${index}`,
        code: 'compose.fit.overflow',
        message: outOfBudget && !entry.shrunk
          ? `Slide ${index + 1}: ${layerId} (${String(row.role)}) still runs past its box; this run's measuring budget of ${budget} characters ran out before shrink could step the size down, so shorten the text or compose fewer slides in one call.`
          : `Slide ${index + 1}: ${layerId} (${String(row.role)}) still runs past its box${entry.shrunk ? ` at ${entry.fontSize} px, the smallest the master sets for ${String(row.role)}` : ''}; shorten the text${mode === 'report' ? ', or compose with fit shrink' : ''}.`,
      });
  }
  // One note per reason, so a face missing here is said once rather than per slot.
  const unmeasured = new Map<string, string[]>();
  for (const skipped of measured.skipped) unmeasured.set(skipped.reason, [...(unmeasured.get(skipped.reason) ?? []), skipped.layerId]);
  for (const [reason, ids] of unmeasured)
    report.notes.push({
      path: '/slides',
      code: 'compose.fit.unmeasured',
      message: `${ids.length === 1 ? `${ids[0]} was` : `${ids.length} text slots were`} not measured (${reason.replace(/\.$/, '')})${ids.length > 1 ? `: ${ids.slice(0, 6).join(', ')}${ids.length > 6 ? ', ...' : ''}` : ''}.`,
    });
  return measured.skipped.map((s) => s.layerId);
}

// ─── the three entry points ──────────────────────────────────────────────────

function specOf(raw: unknown, opts: ComposeDesignOptionsV1): DesignComposeSpecV1 {
  const spec = Array.isArray(raw) ? { slides: raw } : raw;
  if (!record(spec) || !Array.isArray(spec.slides))
    throw new DesignComposeError('spec.invalid', 'A compose spec is an object with a slides array (or the slides array itself): {"slides": [{"archetype": "title", "slots": {"title": "..."}}]}.');
  if (!spec.slides.length) throw new DesignComposeError('spec.invalid', '/slides: name at least one slide.');
  const out = { ...spec } as unknown as DesignComposeSpecV1;
  if (opts.size) out.size = { ...opts.size };
  if (opts.theme) out.theme = opts.theme;
  if (opts.themes?.length) out.themes = [...opts.themes];
  return out;
}

/** Engine refusals carry a JSON pointer first; they become `spec.invalid`. */
function asComposeError(err: unknown): unknown {
  if (err instanceof DesignComposeError) return err;
  if (err instanceof Error && !(err instanceof TypeError) && !(err instanceof RangeError)) return new DesignComposeError('spec.invalid', err.message);
  return err;
}

/**
 * Compose a spec into a Design document on the resolved master: the frames in slide
 * order, the master's bindings on every row, then each text slot measured.
 */
export async function composeDesign(spec: unknown, opts: ComposeDesignOptionsV1 = {}): Promise<ComposeDesignResultV1> {
  const composeSpec = specOf(spec, opts);
  const resolved = await resolveComposeMaster(opts);
  const read = await readSource(opts);
  const size = composeSpec.size ?? COMPOSE_DEFAULT_SIZE;
  const ctx: DesignComposeContext = {
    master: resolved.master,
    masterOrigin: resolved.origin,
    resolveToken: tokenResolver(resolved.doc),
    ...themeColorsOf(resolved.doc),
    tokens: composeTokenSet(resolved.doc, composeSpec.theme),
    themeTokens: composeThemeTokens(resolved.doc, composeSpec.themes),
    ...(resolved.logos ? { logos: resolved.logos } : {}),
    inventory: read.inventory,
    brief: resolved.brief,
    ...(record(composeSpec.$styles) ? { styles: composeSpec.$styles } : {}),
  };
  const unmeasuredPhotos: Array<{ index: number; reason: string }> = [];
  // Measured with or without logos: the text slots over a photograph are judged too.
  const logos = resolved.logos;
  const photoSurface = await measureComposePhotos(composeSpec, size, (key) => pictureBytes(key, read, opts.assets), logos ? logoMarks(logos, resolved.brief) : [], {
    resolveColour: photoColourResolver(resolved.doc, composeSpec.theme),
    ...(logos ? { onUnmeasured: (index: number, reason: string) => unmeasuredPhotos.push({ index, reason }) } : {}),
  });
  if (photoSurface) ctx.photoSurface = photoSurface;
  let composed: ReturnType<typeof composeDesignSlides>;
  try {
    composed = composeDesignSlides(composeSpec, ctx);
  } catch (err) {
    throw asComposeError(err);
  }
  const report = composed.report;
  report.notes.unshift(...resolved.notes);
  for (const { index, reason } of unmeasuredPhotos)
    report.notes.push({
      path: `/slides/${index}/under`, code: 'compose.logo.photo-unmeasured',
      message: `Slide ${index + 1}: the photograph under the logo was not measured (${reason}), so the on-photo mark was kept without a contrast check. Look at the slide before you settle it.`,
    });
  const document = composed.document as unknown as Record<string, unknown>;
  const rows = (Array.isArray(document.boxes) ? document.boxes : []) as Row[];
  const unmeasured = await fitDocument(rows, report, masterAtSize(resolved.master, size), resolved.brief, opts.fit ?? 'report', opts.maxUnits);
  const { assets, needed } = assetsOf(rows, read);
  for (const key of needed)
    report.notes.push({ path: '/slides', code: 'compose.asset.needed', message: `${key} is a picture placeholder nothing here supplies: give the file to lolly package as --asset=${key}=<file>.` });
  return { document, report, edits: composed.edits, assets, unmeasured };
}

/**
 * A first spec for a deck: an archetype per slide from its layout read, its text roles
 * as `from` references, its pictures as `photo:<sha12>` placeholders, its notes kept.
 */
export async function suggestCompose(opts: ComposeSourceOptionsV1 = {}): Promise<{ spec: DesignComposeSpecV1; reasons: Array<{ slide: number; archetype: string; read?: string; band?: string; why: string }>; assets: ComposeAssetV1[]; master: { id: string; version: string; origin: ResolvedComposeMasterV1['origin'] } }> {
  if (!opts.source && opts.inventory === undefined)
    throw new DesignComposeError('spec.invalid', 'A suggestion reads a deck: give the deck (source) or its inventory.');
  const resolved = await resolveComposeMaster(opts);
  const read = await readSource(opts);
  if (!read.inventory) throw new DesignComposeError('inventory.invalid', 'The deck gave no inventory.');
  // Loaded when asked for, so composing never waits on the suggestion priors.
  const { suggestComposeSlides } = await import('@lolly/engine');
  let suggested: ReturnType<typeof suggestComposeSlides>;
  try {
    suggested = suggestComposeSlides({ census: read.census, source: read.source, inventory: read.inventory }, resolved.master);
  } catch (err) {
    throw asComposeError(err);
  }
  // The engine lists each picture by its placeholder key; the bytes come from the deck when the deck was read here.
  const assets: ComposeAssetV1[] = suggested.assets.map((a) => {
    const bytes = read.media.get(a.sha256)?.bytes;
    return { key: a.key, sha256: a.sha256, name: mediaFileName(a.sha256, a.mime), mime: a.mime, ...(a.file ? { file: a.file } : {}), ...(bytes ? { bytes } : {}) };
  });
  return {
    spec: suggested.spec,
    reasons: suggested.reasons,
    assets,
    master: { id: resolved.master.id, version: resolved.master.version, origin: resolved.origin },
  };
}

/** The resolved master and its archetypes, compact: what `lolly compose --list` prints. */
export async function composeArchetypeListing(opts: Pick<ComposeSourceOptionsV1, 'file' | 'master' | 'designSystem'> = {}): Promise<{
  master: { id: string; version: string; name: string; origin: ResolvedComposeMasterV1['origin']; size: { width: number; height: number } };
  archetypes: ReturnType<typeof composeArchetypeCatalog>;
  notes: ResolvedComposeMasterV1['notes'];
}> {
  const resolved = await resolveComposeMaster(opts);
  const { master } = resolved;
  return {
    master: { id: master.id, version: master.version, name: master.name, origin: resolved.origin, size: { ...master.size } },
    archetypes: composeArchetypeCatalog(master),
    notes: resolved.notes,
  };
}

/** The archetype catalogue of the master the ladder resolves. */
export async function listComposeArchetypes(opts: Pick<ComposeSourceOptionsV1, 'file' | 'master' | 'designSystem'> = {}): Promise<ReturnType<typeof composeArchetypeCatalog>> {
  return (await composeArchetypeListing(opts)).archetypes;
}
