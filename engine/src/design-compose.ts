// SPDX-License-Identifier: MPL-2.0
/**
 * Compose Design slides from slide-master archetypes (plan 291 W6, contract
 * `@lolly-tools/core` design-compose-v1).
 *
 * An agent writes a deck as archetypes and slot content; `composeDesignSlides` lowers
 * it to stored Design rows bound to the master, the way Design's own New slide from
 * layout would lay each slide down at the spec's page size:
 *
 *   1. the master is scaled once with `masterAtSize` (the editor's rule: whole px, the
 *      smaller axis decides), so a composed title takes the editor's numbers;
 *   2. each slide's archetype is found (a `-dark` twin for a dark ground through
 *      `darkVariantOf`, a `flow-cards|columns-N-C` layout and its dark twin through
 *      `withSlideLayoutComponents`); an unknown id is refused with the closest ids.
 *      A light archetype with no twin on a dark ground is drawn from the master under
 *      the design system's Dark theme (`buildDeckTheme`, `themedColors`); `ground:
 *      "light"` on an archetype that is dark by design is reported, never silent;
 *   3. `seedFrame` lays the slide down, four to a row with `gap` between, its `order`
 *      the slide's place in the deck;
 *   4. slots are filled by key (`title`, `body#2`) and cells by role, from Design text,
 *      a picture reference, or an inventory object (`from`, one paragraph by `para`,
 *      every line run into one by `join`). In a display slot a source's bold follows
 *      the brand (E15: the accent ink when a text-weight house rule forbids 700, or
 *      `emphasis`), and `case: "sentence"` sets sentence case on request; both are
 *      reported and listed in `edits`;
 *   5. every slot left empty is dropped and reported, because an empty placeholder
 *      warns in check and exports as an empty box;
 *   6. page numbers count presentation order, footers take the spec's text, and
 *      furniture the slide or the deck omits, a footer with no text and a logo with
 *      no mark are left off; over a photograph covering the slide, `logo: auto`
 *      takes the on-photo mark; kept furniture is `locked`;
 *   7. text rows take pad 0 and their role's line height (`DESIGN_TEXT_LINE_HEIGHTS`),
 *      so measure, renderer and PowerPoint agree, and Reset slide keeps both;
 *   8. the frame takes its speaker notes;
 *   9. `under` and `over` rows are lowered through `expandDesignAuthoring` with `$in`
 *      set to the slide, painted before and after the archetype's layers.
 *
 * The rows keep their master bindings (`master`, `archetype`, `role`, `furniture`):
 * check's house rules read them, and Tier A PowerPoint binds them to placeholders.
 * Nothing is measured here; a host fits text afterwards. `edits` lists the source
 * strings the composed slides change or leave out, worked out by `checkFidelity`
 * against the slides named by `source`, in the shape `lolly check --edits` reads.
 *
 * Pure and synchronous: all or nothing, errors thrown as Error('<json pointer>: ...').
 */
import type { ArchetypeV1, DesignBoxRowV1, FurnitureLayerV1, SlideMasterV1, SourceParaV1 } from '@lolly-tools/core';
import { DESIGN_COMPOSE_TRANSITIONS, findArchetype } from '@lolly-tools/core';
import type { ContentInventoryV1, InventorySlideV1 } from '@lolly-tools/core/content-inventory-v1';
import type {
  ComposeArchetypeV1,
  ComposeEditV1,
  ComposeReportNoteV1,
  ComposeReportSlideV1,
  ComposeReportV1,
  DesignComposeGroundV1,
  DesignComposeMasterOriginV1,
  DesignComposeSpecV1,
  DesignTextStyleV1,
} from '@lolly-tools/core';
import { hexToOklch } from './brand-derive.ts';
import { checkFidelity, normaliseFidelityText } from './check-fidelity.ts';
import { expandDesignAuthoring } from './design-authoring.ts';
import { designTextOf, plainOfDesignText } from './design-text.ts';
import { DESIGN_TEXT_LINE_HEIGHTS, assertTextStyle, resolveTextStyle, textStylesFromBrief } from './design-text-style.ts';
import { bgIsDark, contrastRatio } from './logo-variant.ts';
import { masterTokenPaths, themedColors, type ThemeSourceV1 } from './rebrand-design-system.ts';
import { buildDeckTheme } from './rebrand-theme.ts';
import { archetypePlaceholders, masterAtSize, masterBoxToPx, seedFrame, type TokenResolver } from './slide-master.ts';
import { slideLayoutRecipe, withSlideLayoutComponents } from './slide-layout-components.ts';
import { darkVariantOf, findStructure, structureOf } from './slide-structures.ts';
import type { TokenSet } from './bridge/host-v1.ts';
import { resolveTokenBinding } from './token-binding.ts';
import { hasDesignColourRefs, normaliseDesignColourRefs, readBlockRunBindings, readBlockTokenBindings, withBlockTokenBinding } from './token-block-bindings.ts';
import { aliasPath } from './tokens.ts';
import { canonicalJson } from './canonical-json.ts';
import type { InputValue } from './inputs.ts';

type Rec = Record<string, unknown>;

/** What composing needs besides the spec. The host resolves the master, colours and logos. */
export interface DesignComposeContext {
  /** The master at its own size; composing scales it to the spec's size. */
  master: SlideMasterV1;
  masterOrigin: DesignComposeMasterOriginV1;
  /** Token path to a literal colour, for grounds, bars and ink. */
  resolveToken: TokenResolver;
  /** Logo marks (catalog ids or urls) per surface; without them logo furniture is left off. */
  logos?: { onLight?: string; onDark?: string; monoOnLight?: string; monoOnDark?: string };
  /** The source deck's inventory, for `from`, `notes: true` and the edits list. */
  inventory?: ContentInventoryV1 | null;
  /** A `designBrief` result, for `$style` and the colours of `under` and `over` text. */
  brief?: unknown | null;
  /** Named text styles under the spec's own `$styles`. */
  styles?: Record<string, unknown>;
  /**
   * The design system's colours, token path to hex, and its dark mode when it states
   * one: what a light archetype with no dark twin is themed from in a dark deck
   * (`buildDeckTheme('dark')`). Left out, the master's own token paths are read
   * through `resolveToken`, and the dark is built from them.
   */
  themeColors?: { colors: Record<string, string>; darkColors?: Record<string, string> };
  /**
   * What a host measured of the photographs under the slides (plan 291 M4), for `logo:
   * auto` over a photo: `luminanceUnder` gives the relative luminance of the picture
   * under a slide-local box as its 20th and 80th percentiles, or null when it was not
   * measured; `inks` lists each logo mark's colours. A mark the brand allows on
   * photography is kept only when every colour of it reaches 3:1 (graphics) against
   * both; when none does, the logo is left off with `compose.logo.photo-contrast`.
   */
  /**
   * The design system's tokens in the theme the document's literals are cached in (plan
   * 291 W4, E20). Read only when the spec names more than one theme: the master's token
   * paths then resolve in them, every colour a path gives is stored with a link to it,
   * `under` and `over` colour references are lowered to the literal plus a link, and a
   * slide whose ground is dark draws the light archetype when its colours resolve dark
   * here and its ink still reads, so the document follows the theme with no script.
   */
  tokens?: TokenSet | null;
  /**
   * The design system's tokens in every theme the spec names, by theme name (plan 291
   * M4). Read only with `tokens` and more than one theme. With them a colour that must
   * follow the theme is linked to a token that does: an ink the master takes from a
   * brand constant on a ground that follows the theme is linked to the theme's own ink
   * of the same colour (`color.semantic.text`), a light ground taken from a constant to
   * `color.semantic.surface` or `color.role.alt-surface`, and a slide that is dark by
   * design keeps its own colours in every theme. Accent emphasis is linked too.
   */
  themeTokens?: Readonly<Record<string, TokenSet>> | null;
  photoSurface?: {
    /** `mid`, the median, judges a text slot's ink over the picture (`compose.text.photo-contrast`). */
    luminanceUnder: (slideIndex: number, box: { x: number; y: number; w: number; h: number }) => { low: number; high: number; mid?: number } | null;
    inks: Record<string, readonly string[]>;
  };
}

/** The composed document: Design input values ready for `lolly package`, `lolly check` and `lolly run design --document`. */
export interface DesignComposeDocumentV1 {
  boxes: Record<string, unknown>[];
  transition?: string;
  __export_width: string;
  __export_height: string;
  __export_unit: 'px';
}

export interface DesignComposeResultV1 {
  document: DesignComposeDocumentV1;
  report: ComposeReportV1;
  edits: ComposeEditV1[];
}

/** One archetype of the catalogue `lolly compose --list` prints. */
export type DesignComposeArchetypeV1 = ComposeArchetypeV1;

const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;
const DEFAULT_GAP = 160;
const MAX_SLIDES = 500;
const MAX_SIDE = 100_000;
/** Slides per row on the canvas. */
const PER_ROW = 4;

const SPEC_KEYS: ReadonlySet<string> = new Set(['size', 'theme', 'themes', 'slides', '$styles', 'footer', 'pageNumbers', 'transition', 'gap', 'furniture', 'emphasis', 'case']);
const SLIDE_KEYS: ReadonlySet<string> = new Set(['archetype', 'id', 'name', 'ground', 'source', 'slots', 'cells', 'notes', 'furniture', 'under', 'over', 'intent', 'emphasis', 'case']);
const FURNITURE_KEYS: ReadonlySet<string> = new Set(['omit', 'footer', 'logo']);
const RESERVED: ReadonlySet<string> = new Set(['id', 'kind', 'frame', 'master', 'archetype', 'role', 'furniture', 'order', 'z', 'group']);
const CONTENT_KEYS: ReadonlySet<string> = new Set(['text', 'image', 'from', 'para', 'join', 'case', 'emphasis', '$style']);
const EMPHASIS_MODES: readonly string[] = ['accent', 'bold', 'keep'];
const CASE_MODES: readonly string[] = ['sentence', 'keep'];
/** Slot roles whose source emphasis follows the brand (E15): the display roles. */
const HEADLINE_SLOT_ROLES: ReadonlySet<string> = new Set(['title', 'subtitle', 'quote', 'number']);
/** The roles a `headline` house-rule target means for a role-bound row (design-house-rules.ts). */
const HEADLINE_RULE_ROLES: ReadonlySet<string> = new Set(['title']);
/** An `under` picture covering this share of the slide is the slide's photograph, for `logo: auto`. */
const PHOTO_COVER = 0.9;
/** Contrast an accent needs on its ground when the brand declares no pairing for it: large text. */
const ACCENT_CONTRAST = 3;
const FURNITURE_KINDS: ReadonlySet<string> = new Set(['logo', 'page-number', 'footer', 'bar', 'rect']);
/** A source string that only counts: "01", "2", "3." or "4)" (plan 291 M4: dropped counters are declared as such). */
const COUNTER = /^\s*0?\d{1,2}[.)]?\s*$/;
/** The reason an edit the source comparison found carries. */
const REWORDED = 'Reworded in the composed slides.';
/** Row fields a resolved text style writes. `italic` is applied to the text instead. */
const STYLE_ROW_FIELDS = ['fontSize', 'weight', 'lineHeight', 'tracking', 'font', 'align', 'valign', 'pad', 'fg'] as const;

const record = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const seg = (key: string | number): string => String(key).replace(/~/g, '~0').replace(/\//g, '~1');
const plural = (n: number, one: string, many = `${one}s`): string => `${n} ${n === 1 ? one : many}`;

function numberAt(value: unknown, pointer: string): number {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isFinite(n)) throw new Error(`${pointer}: expected a number.`);
  return n;
}

// ─── the spec ────────────────────────────────────────────────────────────────

function checkKeys(value: Rec, allowed: ReadonlySet<string>, pointer: string, what: string): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`${pointer}/${seg(key)}: unknown ${what} key; expected one of ${[...allowed].join(', ')}.`);
  }
}

function groundAt(value: unknown, pointer: string): DesignComposeGroundV1 | undefined {
  if (value === undefined) return undefined;
  if (value !== 'light' && value !== 'dark') throw new Error(`${pointer}: expected "light" or "dark".`);
  return value;
}

type EmphasisMode = 'accent' | 'bold' | 'keep';
type CaseMode = 'sentence' | 'keep';

function emphasisAt(value: unknown, pointer: string): EmphasisMode | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !EMPHASIS_MODES.includes(value)) throw new Error(`${pointer}: expected "accent", "bold" or "keep".`);
  return value as EmphasisMode;
}

function caseAt(value: unknown, pointer: string): CaseMode | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || !CASE_MODES.includes(value)) throw new Error(`${pointer}: expected "sentence" or "keep".`);
  return value as CaseMode;
}

/** The spec's `themes`: distinct theme names, 1 to 16, each 1 to 64 characters. */
function themesAt(value: unknown, pointer: string): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length < 1 || value.length > 16) throw new Error(`${pointer}: expected a list of 1 to 16 theme names, such as ["light", "dark"].`);
  const seen = new Set<string>();
  value.forEach((name, i) => {
    if (typeof name !== 'string' || !name || name.length > 64) throw new Error(`${pointer}/${i}: expected a theme name.`);
    if (seen.has(name)) throw new Error(`${pointer}/${i}: theme "${name}" is listed twice.`);
    seen.add(name);
  });
  return [...seen];
}

interface FurnitureSpec { omit: string[]; footer?: string; logo?: 'auto' | 'mono' | 'none' }

/** A `furniture` object, on the spec (the deck's defaults) or on a slide. */
function furnitureAt(value: unknown, pointer: string): FurnitureSpec {
  if (value === undefined) return { omit: [] };
  if (!record(value)) throw new Error(`${pointer}: expected { omit, footer, logo }.`);
  checkKeys(value, FURNITURE_KEYS, pointer, 'furniture');
  const omit = value.omit === undefined ? [] : value.omit;
  if (!Array.isArray(omit) || omit.some((o) => typeof o !== 'string' || !o)) throw new Error(`${pointer}/omit: expected a list of furniture ids or kinds.`);
  const logo = value.logo;
  if (logo !== undefined && logo !== 'auto' && logo !== 'mono' && logo !== 'none') throw new Error(`${pointer}/logo: expected "auto", "mono" or "none".`);
  if (value.footer !== undefined && typeof value.footer !== 'string') throw new Error(`${pointer}/footer: expected the footer text.`);
  return { omit: omit as string[], ...(typeof value.footer === 'string' ? { footer: value.footer } : {}), ...(logo !== undefined ? { logo } : {}) };
}

/**
 * The largest share of the slide one `under` picture row covers, 0 to 1. Only plain
 * rows with a box count; a macro or a row without numbers is not measured.
 */
function underPhotoShare(list: unknown, size: { width: number; height: number }): number {
  if (!Array.isArray(list)) return 0;
  let best = 0;
  for (const row of list) {
    if (!record(row) || (row.kind !== 'image' && (row.kind !== undefined || typeof row.image !== 'string'))) continue;
    const [x, y, w, h] = ['x', 'y', 'w', 'h'].map((k) => Number(row[k]));
    if (![x, y, w, h].every((n) => Number.isFinite(n)) || !(w! > 0) || !(h! > 0)) continue;
    const across = Math.max(0, Math.min(size.width, x! + w!) - Math.max(0, x!));
    const down = Math.max(0, Math.min(size.height, y! + h!) - Math.max(0, y!));
    best = Math.max(best, (across * down) / (size.width * size.height));
  }
  return best;
}

function sizeOf(spec: Rec): { width: number; height: number } {
  if (spec.size === undefined) return { width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT };
  if (!record(spec.size)) throw new Error('/size: expected { width, height } in px.');
  checkKeys(spec.size, new Set(['width', 'height']), '/size', 'size');
  const width = Math.round(numberAt(spec.size.width, '/size/width'));
  const height = Math.round(numberAt(spec.size.height, '/size/height'));
  if (!(width > 0) || width > MAX_SIDE) throw new Error(`/size/width: expected a page width from 1 to ${MAX_SIDE} px.`);
  if (!(height > 0) || height > MAX_SIDE) throw new Error(`/size/height: expected a page height from 1 to ${MAX_SIDE} px.`);
  return { width, height };
}

// ─── archetypes ──────────────────────────────────────────────────────────────

/** Edit distance, for naming the archetypes closest to an unknown id. */
function distance(a: string, b: string): number {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i += 1) {
    let prev = row[0]!;
    row[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = Math.min(row[j]! + 1, row[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row[j]!;
      row[j] = next;
    }
  }
  return row[b.length]!;
}

function closestIds(master: SlideMasterV1, id: string): string[] {
  const words = new Set(id.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  return master.archetypes
    .filter((a) => !a.variantOf)
    .map((a) => {
      const shared = a.id.split(/[^a-z0-9]+/).filter((w) => words.has(w)).length;
      return { id: a.id, score: distance(id.toLowerCase(), a.id) - shared * 3 };
    })
    .sort((a, b) => a.score - b.score || a.id.localeCompare(b.id))
    .slice(0, 4)
    .map((a) => a.id);
}

/** Is this archetype's ground dark: its own statement first, else its resolved ground colour. */
function archetypeIsDark(archetype: ArchetypeV1, resolve: TokenResolver): boolean {
  if (typeof archetype.background?.dark === 'boolean') return archetype.background.dark;
  const bg = archetype.background?.hex ?? (archetype.background?.tokenPath ? resolve(archetype.background.tokenPath) : undefined);
  return typeof bg === 'string' && bg ? bgIsDark(bg) : false;
}

/**
 * Is this archetype drawn on a dark colour: its ground resolves the way `seedFrame`
 * resolves it (its hex, else its token) and that colour reads as dark. A stated `dark`
 * whose colour does not resolve gives a frame with no `bg`, which paints white.
 */
function drawsOnDark(archetype: ArchetypeV1, resolve: TokenResolver): boolean {
  const hex = archetype.background?.hex;
  const path = archetype.background?.tokenPath;
  const bg = typeof hex === 'string' && hex ? hex : path ? resolve(path) : undefined;
  return typeof bg === 'string' && !!bg && bgIsDark(bg);
}

/**
 * Does every text placeholder's ink stand out from the archetype's ground (3:1, the
 * large-text floor) under `resolve`? A master whose ground follows the theme while its
 * ink is a brand constant (pine text on a ground that turns pine) does not let a light
 * archetype stand in for its dark twin.
 */
function inkReadsOnGround(archetype: ArchetypeV1, resolve: TokenResolver): boolean {
  const bgHex = archetype.background?.hex;
  const bgPath = archetype.background?.tokenPath;
  const bg = typeof bgHex === 'string' && bgHex ? bgHex : bgPath ? resolve(bgPath) : undefined;
  if (typeof bg !== 'string' || !bg) return false;
  for (const ph of archetypePlaceholders(archetype)) {
    if (ph.kind === 'image') continue;
    const style = ph.style;
    const ink = style?.fg ? style.fg : style?.fgTokenPath ? resolve(style.fgTokenPath) : undefined;
    if (typeof ink !== 'string' || !ink) continue;
    const ratio = contrastRatio(ink, bg);
    if (!Number.isFinite(ratio) || ratio < 3) return false;
  }
  return true;
}

// ─── slots ───────────────────────────────────────────────────────────────────

/** `title`, `body#2` and `body#1` to the canonical key (`title`, `body#2`, `body`); null when malformed. */
function slotKeyOf(key: string): { role: string; n: number; key: string } | null {
  const m = /^([a-z]+)(?:#([1-9][0-9]*))?$/.exec(key);
  if (!m) return null;
  const n = m[2] ? Number(m[2]) : 1;
  return { role: m[1]!, n, key: n === 1 ? m[1]! : `${m[1]}#${n}` };
}

/** The slot key a seeded role-bound row fills, from its id (`f.body`, `f.body-2`). */
function seededKey(row: DesignBoxRowV1, prefix: string): string | null {
  const role = typeof row.role === 'string' ? row.role : '';
  const id = typeof row.id === 'string' ? row.id : '';
  if (!role) return null;
  if (id === `${prefix}.${role}`) return role;
  const m = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.${role}-(\\d+)$`).exec(id);
  return m ? `${role}#${m[1]}` : role;
}

/** The line height a role's text takes: its own style id's, else body's. */
function lineHeightFor(role: string): number {
  return (DESIGN_TEXT_LINE_HEIGHTS as Record<string, number>)[role] ?? DESIGN_TEXT_LINE_HEIGHTS.body;
}

/** Sets each line in `*` emphasis, keeping a list marker outside the emphasis (the authoring rule). */
function italicText(text: string, pointer: string): string {
  if (!text) return text;
  // A literal \* or \_ (escaped from the source) is a character, not emphasis markup.
  if (/[*_]/.test(text.replace(/\\[\s\S]/g, ''))) throw new Error(`${pointer}: an italic style cannot set text that already carries * or _ markup; write the emphasis in the text.`);
  return text.split('\n').map((line) => {
    if (!line.trim()) return line;
    const m = /^(\s*(?:[-•]\s|\d+\.\s))?(.*)$/.exec(line)!;
    return `${m[1] ?? ''}*${m[2]}*`;
  }).join('\n');
}

// ─── sentence case ───────────────────────────────────────────────────────────

/** A word in Title Case: an upper-case first letter and every other letter lower case. `I` and words with digits are kept. */
function titleCaseWord(word: string): boolean {
  if (/\p{N}/u.test(word)) return false;
  const letters = [...word].filter((c) => /\p{L}/u.test(c));
  const first = letters[0];
  if (!first || first !== word[0] || first === first.toLowerCase() || first !== first.toUpperCase()) return false;
  if (letters.length === 1) return word !== 'I';
  // I'm, I've, I'll, I'd: the pronoun keeps its capital in a contraction too.
  if (/^I['’]\p{L}+$/u.test(word)) return false;
  return letters.slice(1).every((c) => c === c.toLowerCase() && c !== c.toUpperCase());
}

/**
 * Design text markup in sentence case: every word in Title Case is lowered except the
 * first word of the text, of each line and of each sentence. Words in capitals or with
 * a capital inside (AI, SUSE, iPhone) are kept, and so are acronyms joined by & . / or +
 * (R&D, AT&T, U.S., C++), `I` and its contractions (I'm, I've) and words with digits.
 * A proper noun in Title Case (Europe) is lowered too, which is why this is asked for,
 * never the default. Markup (attribute heads, emphasis markers, escapes) is untouched.
 */
export function sentenceCaseDesignText(text: string): string {
  let out = '';
  let start = true;
  let ended = false;
  let i = 0;
  while (i < text.length) {
    const head = /^\{[^{}|\n]*\|/.exec(text.slice(i, i + 64));
    if (head && text[i] === '{') {
      out += head[0];
      i += head[0].length;
      continue;
    }
    const ch = text[i]!;
    if (ch === '\\') {
      out += text.slice(i, i + 2);
      i += 2;
      continue;
    }
    // Letters joined by & . / or + with no lower-case letter among them are one acronym
    // (R&D, AT&T, U.S., C++), kept whole; the dot of a dotted one (U.S.) ends no sentence.
    const joined = /^[\p{L}\p{N}'\u2019]+(?:[&./+][\p{L}\p{N}'\u2019]+)*\+*/u.exec(text.slice(i));
    if (joined && /[&./+]/.test(joined[0]) && /\p{Lu}/u.test(joined[0]) && !/\p{Ll}/u.test(joined[0])) {
      let w = joined[0];
      if (text[i + w.length] === '.' && /^(?:\p{Lu}\.)+\p{Lu}$/u.test(w)) w += '.';
      out += w;
      start = false;
      ended = false;
      i += w.length;
      continue;
    }
    const word = /^[\p{L}\p{N}'\u2019]+/u.exec(text.slice(i));
    if (word) {
      const w = word[0];
      out += !start && !ended && titleCaseWord(w) ? w.charAt(0).toLowerCase() + w.slice(1) : w;
      start = false;
      ended = false;
      i += w.length;
      continue;
    }
    if (ch === '\n') start = true;
    else if (/[.!?\u2026]/u.test(ch)) ended = true;
    else if (/\s/u.test(ch) && ended) {
      start = true;
      ended = false;
    }
    out += ch;
    i += 1;
  }
  return out;
}

/** Each changed line of a slot's text as an edit, in the shape `lolly check --edits` reads. */
function lineEdits(before: string, after: string, reason: string): ComposeEditV1[] {
  const a = plainOfDesignText(before).split('\n');
  const b = plainOfDesignText(after).split('\n');
  const out: ComposeEditV1[] = [];
  a.forEach((line, k) => {
    const result = b[k] ?? '';
    if (line.trim() && line !== result) out.push({ source: line.trim(), result: result.trim(), reason });
  });
  return out;
}

// ─── emphasis (E15) ──────────────────────────────────────────────────────────

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.length > 0) : []);

function hex6(value: unknown): string | null {
  const m = typeof value === 'string' ? /^#?([0-9a-f]{6})([0-9a-f]{2})?$/i.exec(value.trim()) : null;
  return m?.[1] ? `#${m[1].toLowerCase()}` : null;
}

/**
 * Would a bold run break a text-weight house rule on this role-bound row? The rule's
 * own target decides which rows it covers, as `checkDesignHouseRules` reads it: its
 * `roles`, else `headline` (the title role) or `body` (every other role), less its
 * `exemptRoles`.
 */
function boldBreaksRules(brief: unknown, role: string): string | null {
  const rules = record(brief) && Array.isArray(brief.houseRules) ? brief.houseRules : [];
  for (const rule of rules) {
    if (!record(rule) || rule.kind !== 'text-weight') continue;
    const scope = record(rule.scope) && Array.isArray(rule.scope.tools) ? rule.scope.tools : null;
    if (scope && !scope.includes('design')) continue;
    const p = record(rule.parameters) ? rule.parameters : {};
    const allowed = strings(p.weights).map(String);
    if (!allowed.length || allowed.includes('700')) continue;
    if (strings(p.exemptRoles).includes(role)) continue;
    const roles = strings(p.roles);
    const target = typeof p.target === 'string' ? p.target : 'text';
    const covers = roles.length ? roles.includes(role)
      : target === 'headline' ? HEADLINE_RULE_ROLES.has(role)
        : target === 'body' ? !HEADLINE_RULE_ROLES.has(role)
          : true;
    if (covers) return typeof rule.id === 'string' ? rule.id : 'text-weight';
  }
  return null;
}

/**
 * The brand's accent ink for words on `ground` set in `ink`: the brief's accent,
 * secondary or primary for a ground of that darkness, then the inks the brand pairs
 * with that ground (most colourful first). An ink is taken when it differs from the
 * row's own and the brand allows it as text there: by the declared combinations when
 * the ground has one, else by 3:1 contrast. Null when no ink qualifies.
 */
function accentInk(brief: unknown, ground: string, ink: string | null): string | null {
  if (!record(brief)) return null;
  const dark = bgIsDark(ground);
  const themes = Array.isArray(brief.themes) ? brief.themes.filter(record) : [];
  const theme = themes.find((t) => t.name === (dark ? 'dark' : 'light'))
    ?? themes.find((t) => typeof t.name === 'string' && /dark/i.test(t.name) === dark)
    ?? themes[0];
  const semantic = theme && record(theme.semantic) ? theme.semantic : {};
  const combos = record(brief.combinations) ? brief.combinations : {};
  const pairs = Array.isArray(combos.pairs) ? combos.pairs.filter(record) : [];
  const declared = combos.from === 'declared';
  const pair = declared ? pairs.find((one) => record(one.background) && hex6(one.background.value) === ground) : undefined;
  const pairInks = pair && Array.isArray(pair.text) ? pair.text.filter(record).map((t) => hex6(t.value)).filter((h): h is string => !!h) : [];
  const chroma = (hex: string): number => hexToOklch(hex)?.c ?? 0;
  const candidates = [
    ...['accent', 'secondary', 'primary'].map((slot) => hex6(semantic[slot])),
    ...[...pairInks].sort((a, b) => chroma(b) - chroma(a)),
  ].filter((h): h is string => !!h);
  for (const hex of candidates) {
    if (hex === ink) continue;
    if (pair ? pairInks.includes(hex) : contrastRatio(hex, ground) >= ACCENT_CONTRAST) return hex;
  }
  return null;
}

interface InventoryHit { slide: InventorySlideV1; kind: 'text' | 'picture' | 'table'; index: number }

function findInventoryObject(inventory: ContentInventoryV1, id: string, source: number | undefined): InventoryHit | null {
  const order = source !== undefined && inventory.slides[source - 1]
    ? [inventory.slides[source - 1]!, ...inventory.slides.filter((_, k) => k !== source - 1)]
    : inventory.slides;
  for (const slide of order) {
    const t = slide.text.findIndex((x) => x.objectId === id);
    if (t >= 0) return { slide, kind: 'text', index: t };
    const p = slide.pictures.findIndex((x) => x.objectId === id);
    if (p >= 0) return { slide, kind: 'picture', index: p };
    if (slide.tables.some((x) => x.objectId === id)) return { slide, kind: 'table', index: 0 };
  }
  return null;
}

type InventoryParagraphs = InventorySlideV1['text'][number]['paragraphs'];

/**
 * Every worded line of the paragraphs run into one, with `sep` between them (`join`):
 * a paragraph break and a line break (pptx `a:br`) both end a line, and empty lines are
 * dropped. Bullets go; a line that already ends with the separator's mark (`Agenda:`
 * joined with `: `) keeps its own.
 */
function joinedParagraphs(paragraphs: InventoryParagraphs, sep: string): InventoryParagraphs {
  type Run = InventoryParagraphs[number]['runs'][number];
  const lines: Run[][] = [];
  for (const p of paragraphs) {
    let line: Run[] = [];
    for (const r of p.runs) {
      r.text.split(/\r\n?|\n/).forEach((piece, k) => {
        if (k > 0) {
          lines.push(line);
          line = [];
        }
        if (piece) line.push({ ...r, text: piece });
      });
    }
    lines.push(line);
  }
  const worded = lines.filter((line) => line.some((r) => r.text.trim()));
  const mark = sep.trimEnd();
  const runs: Run[] = [];
  worded.forEach((line, k) => {
    const own = line.map((r) => ({ ...r }));
    while (own.length && !own[0]!.text.trim()) own.shift();
    while (own.length && !own[own.length - 1]!.text.trim()) own.pop();
    own[0]!.text = own[0]!.text.replace(/^\s+/u, '');
    const last = own[own.length - 1]!;
    last.text = last.text.replace(/\s+$/u, '');
    runs.push(...own);
    if (k < worded.length - 1) runs.push({ text: mark !== '' && last.text.endsWith(mark) ? sep.slice(mark.length) : sep });
  });
  const align = paragraphs.find((p) => p.runs.some((r) => r.text.trim()))?.align;
  return [{ runs, ...(align ? { align } : {}) }];
}

/**
 * Inventory paragraphs as Design text. The master sets the type, so bold or italic that
 * covers every word is the source's style, not emphasis, and is left to the slot.
 *
 * Emphasis (E15): `bold` carries a bold run as bold; `accent` sets it in the accent ink
 * at the row's own weight; `keep` carries it as bold and every run's own source colour
 * with the bold. `mapped` lists each plain line whose emphasis was recoloured.
 */
function designTextOfInventory(
  paragraphs: InventoryParagraphs,
  rowWeight: number,
  emphasis: { mode: EmphasisMode; accent?: string } = { mode: 'bold' },
): { text: string; mapped: string[] } {
  const runs = paragraphs.flatMap((p) => p.runs).filter((r) => r.text.trim());
  const allBold = runs.length > 0 && runs.every((r) => r.bold);
  const allItalic = runs.length > 0 && runs.every((r) => r.italic);
  const mapped: string[] = [];
  const paras: SourceParaV1[] = paragraphs.map((p) => {
    // The plain lines of the paragraph, each marked when a run on it is recoloured.
    const lines: Array<{ text: string; recoloured: boolean }> = [{ text: '', recoloured: false }];
    for (const r of p.runs) {
      const recolour = r.bold === true && !allBold && emphasis.mode === 'accent' && !!emphasis.accent && !!r.text.trim();
      r.text.split(/\r\n?|\n/).forEach((piece, k) => {
        if (k > 0) lines.push({ text: '', recoloured: false });
        const line = lines[lines.length - 1]!;
        line.text += piece;
        if (recolour && piece.trim()) line.recoloured = true;
      });
    }
    for (const line of lines) if (line.recoloured) mapped.push(line.text.trim());
    const para: SourceParaV1 = {
      runs: p.runs.map((r) => {
        const bold = r.bold === true && !allBold;
        if (bold && emphasis.mode === 'accent' && emphasis.accent && r.text.trim()) {
          return { text: r.text, color: { hex: emphasis.accent }, ...(r.italic && !allItalic ? { italic: true } : {}) };
        }
        return {
          text: r.text,
          ...(bold ? { bold: true } : {}),
          ...(r.italic && !allItalic ? { italic: true } : {}),
          ...(emphasis.mode === 'keep' && r.color ? { color: { hex: r.color } } : {}),
        };
      }),
    };
    if (p.bullet === true) para.bullet = 'bullet';
    else if (p.bullet === 'number') para.bullet = 'number';
    if (p.lvl !== undefined && p.lvl > 0) para.lvl = p.lvl;
    return para;
  });
  const carryColour = emphasis.mode === 'keep' || mapped.length > 0;
  return { text: designTextOf(paras, { carryColour, masterSetsType: true, rowWeight }).text, mapped };
}

// ─── compose ─────────────────────────────────────────────────────────────────

interface Aggregate { slides: string[]; path: string }

/**
 * Lower a design-compose-v1 spec to master-bound Design rows. See the module comment
 * for the steps. Throws Error('<json pointer>: message') at the first problem.
 */
export function composeDesignSlides(spec: DesignComposeSpecV1, ctx: DesignComposeContext): DesignComposeResultV1 {
  const raw: unknown = spec;
  if (!record(raw)) throw new Error('/: a compose spec is an object with a slides array.');
  checkKeys(raw, SPEC_KEYS, '', 'spec');
  if (!Array.isArray(raw.slides) || raw.slides.length === 0) throw new Error('/slides: a compose spec needs at least one slide.');
  if (raw.slides.length > MAX_SLIDES) throw new Error(`/slides: ${raw.slides.length} slides is more than the cap of ${MAX_SLIDES}.`);
  if (!ctx || !record(ctx.master) || !Array.isArray(ctx.master.archetypes)) throw new Error('/: no slide master to compose from.');
  if (!['flag', 'catalog', 'neutral'].includes(ctx.masterOrigin)) throw new Error(`/: unknown master origin "${String(ctx.masterOrigin)}".`);
  const size = sizeOf(raw);
  const theme = groundAt(raw.theme, '/theme') ?? 'light';
  // Composed for more than one token theme (plan 291 W4): logo furniture is written as
  // `<id>?theme=auto`, so each theme shows the mark the surface under the logo asks for.
  const surfaceAuto = themesAt(raw.themes, '/themes').length > 1;
  const gap = raw.gap === undefined ? DEFAULT_GAP : numberAt(raw.gap, '/gap');
  if (gap < 0 || gap > MAX_SIDE) throw new Error(`/gap: expected a number from 0 to ${MAX_SIDE} px.`);
  if (raw.footer !== undefined && typeof raw.footer !== 'string') throw new Error('/footer: expected the footer text.');
  if (raw.pageNumbers !== undefined && typeof raw.pageNumbers !== 'boolean') throw new Error('/pageNumbers: expected true or false.');
  if (raw.transition !== undefined && (typeof raw.transition !== 'string' || !(DESIGN_COMPOSE_TRANSITIONS as readonly string[]).includes(raw.transition))) {
    // Design swaps an unknown transition for its default without a word, so it is refused here.
    throw new Error(`/transition: expected one of ${DESIGN_COMPOSE_TRANSITIONS.join(', ')} (Design's slide transitions).`);
  }
  // The deck's furniture defaults, emphasis and case, which every slide's own merge over.
  const deckFurniture = furnitureAt(raw.furniture, '/furniture');
  const deckEmphasis = emphasisAt(raw.emphasis, '/emphasis');
  const deckCase = caseAt(raw.case, '/case');

  // Named styles: the host's, then the spec's own, each checked where it was written.
  const styles: Record<string, DesignTextStyleV1> = {};
  for (const [id, style] of Object.entries(ctx.styles ?? {})) styles[id] = assertTextStyle(style, `(styles)/${seg(id)}`);
  if (raw.$styles !== undefined) {
    if (!record(raw.$styles)) throw new Error('/$styles: expected an object of named text styles.');
    for (const [id, style] of Object.entries(raw.$styles)) styles[id] = assertTextStyle(style, `/$styles/${seg(id)}`);
  }

  const tokenSet = ctx.tokens ?? null;
  const themeNames = surfaceAuto ? themesAt(raw.themes, '/themes') : undefined;
  const resolve: TokenResolver = surfaceAuto && tokenSet ? tokenSetResolver(tokenSet, ctx.resolveToken) : (ctx.resolveToken ?? ((): undefined => undefined));
  // One theme keeps its references for the runtime, as before; a document for several
  // must follow the theme, so its references are lowered here.
  const lowering = surfaceAuto && tokenSet ? { tokens: tokenSet, ...(themeNames ? { themes: themeNames } : {}) } : {};
  // A light archetype whose linked ground resolves dark in the tokens is already the dark
  // slide of a document that follows the theme: its twin is not drawn (plan 291 E20).
  const followsTheme = surfaceAuto && !!tokenSet;
  // Every theme's tokens, when the host gave them: colours that must follow the theme are
  // linked to tokens that do, and a slide that is dark by design is held as it is.
  const follow = followsTheme && tokenSet ? themeFollowOf(tokenSet, themeNames ?? [], ctx.themeTokens, ctx.resolveToken) : null;
  const inventory = ctx.inventory ?? null;
  const brief = ctx.brief ?? null;
  const briefThemes = record(brief) && Array.isArray(brief.themes)
    ? new Set(brief.themes.filter(record).map((t) => t.name).filter((n): n is string => typeof n === 'string'))
    : new Set<string>();
  const briefTheme = (ground: DesignComposeGroundV1): string | undefined => (briefThemes.has(ground) ? ground : undefined);
  const tables = new Map<string, Record<string, DesignTextStyleV1>>();
  const styleTable = (ground: DesignComposeGroundV1): Record<string, DesignTextStyleV1> => {
    const key = briefTheme(ground) ?? '';
    const hit = tables.get(key);
    if (hit) return hit;
    const base = textStylesFromBrief(record(brief) ? brief : null, { width: size.width, height: size.height, theme: briefTheme(ground) });
    const table: Record<string, DesignTextStyleV1> = { ...base };
    for (const [id, style] of Object.entries(styles)) table[id] = base[id] && style.basedOn === undefined ? { ...base[id], ...style } : style;
    tables.set(key, table);
    return table;
  };

  const master = masterAtSize(ctx.master, size);
  const boxes: Record<string, unknown>[] = [];
  const reportSlides: ComposeReportSlideV1[] = [];
  const notes: ComposeReportNoteV1[] = [];
  const frameIds = new Set<string>();
  /** Every layer id composed so far and what holds it, so no two layers of the deck share one. */
  const takenBy = new Map<string, { pointer: string; what: string; extra: boolean }>();
  const footerless: Aggregate = { slides: [], path: '' };
  const logoless: Aggregate = { slides: [], path: '' };
  const sources: number[] = [];
  const textEdits: ComposeEditV1[] = [];
  const literals: LiteralSlot[] = [];
  const deckOmitUsed = new Set<string>();

  // A light archetype with no dark twin, in a dark deck, is drawn from the master under
  // the design system's Dark theme (built once, on first need).
  let themedDark: { master: SlideMasterV1; resolve: TokenResolver } | null | undefined;
  const darkThemed = (): { master: SlideMasterV1; resolve: TokenResolver } | null => {
    if (themedDark !== undefined) return themedDark;
    const colors: Record<string, string> = { ...(ctx.themeColors?.colors ?? {}) };
    if (!ctx.themeColors) {
      for (const path of masterTokenPaths(master).keys()) {
        const hex = resolve(path);
        if (typeof hex === 'string' && hex) colors[path] = hex;
      }
    }
    const darkColors = ctx.themeColors?.darkColors;
    const source: ThemeSourceV1 = { colors, ...(darkColors && Object.keys(darkColors).length ? { darkColors } : {}), master };
    const choice = Object.keys(colors).length ? buildDeckTheme('dark', source) : null;
    if (!choice) {
      themedDark = null;
      return null;
    }
    const themed = themedColors(source, choice.theme);
    themedDark = { master: themed.master, resolve: (path) => themed.colors[path] ?? resolve(path) };
    return themedDark;
  };

  raw.slides.forEach((slideValue: unknown, index: number) => {
    const p = `/slides/${index}`;
    if (!record(slideValue)) throw new Error(`${p}: expected a slide object with an archetype.`);
    const slide = slideValue;
    checkKeys(slide, SLIDE_KEYS, p, 'slide');
    if (typeof slide.archetype !== 'string' || !slide.archetype) throw new Error(`${p}/archetype: an archetype id is required.`);
    const requested = slide.archetype;
    if (slide.id !== undefined && (typeof slide.id !== 'string' || !slide.id)) throw new Error(`${p}/id: expected an artboard id.`);
    if (slide.name !== undefined && typeof slide.name !== 'string') throw new Error(`${p}/name: expected a name.`);
    if (slide.intent !== undefined && typeof slide.intent !== 'string') throw new Error(`${p}/intent: expected text.`);
    const frameId = (slide.id as string | undefined) ?? `s${String(index + 1).padStart(2, '0')}`;
    if (frameIds.has(frameId)) throw new Error(`${p}/id: artboard "${frameId}" is used by an earlier slide.`);
    const frameTaker = takenBy.get(frameId);
    if (frameTaker?.extra && slide.id === undefined) throw new Error(`${frameTaker.pointer}: layer "${frameId}" is also the id slide ${index + 1} takes by default; give this row another id, or the slide an id.`);
    if (frameTaker) throw new Error(`${p}/id: artboard "${frameId}" is already the id of ${frameTaker.what} (${frameTaker.pointer}); give this slide another id.`);
    frameIds.add(frameId);
    takenBy.set(frameId, { pointer: `${p}/id`, what: `slide ${index + 1}`, extra: false });
    const groundAsked = groundAt(slide.ground, `${p}/ground`);
    const ground = groundAsked ?? theme;
    const slideEmphasis = emphasisAt(slide.emphasis, `${p}/emphasis`) ?? deckEmphasis;
    const slideCase = caseAt(slide.case, `${p}/case`) ?? deckCase;

    let source: number | undefined;
    if (slide.source !== undefined) {
      const n = slide.source;
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 1) throw new Error(`${p}/source: expected a 1-based slide number.`);
      if (inventory && n > inventory.slides.length) throw new Error(`${p}/source: the inventory has ${plural(inventory.slides.length, 'slide')}.`);
      source = n;
      if (inventory && !sources.includes(n)) sources.push(n);
    }

    // The slide's furniture over the deck's: omit lists add up, footer and logo from the slide win.
    const slideFurniture = furnitureAt(slide.furniture, `${p}/furniture`);
    const omit = [...new Set([...deckFurniture.omit, ...slideFurniture.omit])];
    const logoMode = slideFurniture.logo ?? deckFurniture.logo ?? 'auto';
    const footerText = slideFurniture.footer ?? deckFurniture.footer ?? (raw.footer as string | undefined);

    // 2. The archetype, with its dark twin for a dark ground. A content-sized layout's
    // twin is made from the master's dark content slide.
    const ids = ground === 'dark' && slideLayoutRecipe(requested) ? [requested, `${requested}-dark`] : [requested];
    let expanded = withSlideLayoutComponents(master, ids);
    let archetype = findArchetype(expanded, requested);
    if (!archetype) {
      throw new Error(`${p}/archetype: master ${master.id} has no archetype "${requested}"; the closest are ${closestIds(master, requested).join(', ')} (or a flow-cards-N-C / flow-columns-N-C layout).`);
    }
    let slideResolve: TokenResolver = resolve;
    if (ground === 'dark' && !archetypeIsDark(archetype, resolve) && !(followsTheme && drawsOnDark(archetype, resolve) && inkReadsOnGround(archetype, resolve))) {
      const twin = darkVariantOf(expanded, archetype.id);
      const themed = twin ? null : darkThemed();
      const drawn = themed ? findArchetype(withSlideLayoutComponents(themed.master, ids), requested) : undefined;
      if (twin) {
        archetype = twin;
      } else if (themed && drawn && drawsOnDark(drawn, themed.resolve)) {
        // Only a ground that resolves to a dark colour: a themed token with no colour
        // would leave the frame white under the theme's light ink.
        expanded = withSlideLayoutComponents(themed.master, ids);
        archetype = drawn;
        slideResolve = themed.resolve;
        notes.push({
          path: `${p}/archetype`, code: 'compose.dark.themed',
          message: `Archetype "${archetype.id}" has no dark twin, so slide ${index + 1} is drawn from the master under the design system's Dark theme.`,
        });
      } else {
        notes.push({ path: `${p}/archetype`, code: 'compose.dark.none', message: `Archetype "${archetype.id}" has no dark twin and the design system's Dark theme does not give it a dark ground, so slide ${index + 1} keeps its own light ground.` });
      }
    } else if (groundAsked === 'light' && archetypeIsDark(archetype, resolve)) {
      const light = archetype.variantOf ? findArchetype(expanded, archetype.variantOf) : undefined;
      if (light && !archetypeIsDark(light, resolve)) {
        archetype = light;
      } else {
        notes.push({ path: `${p}/ground`, code: 'compose.ground.ignored', message: `Archetype "${archetype.id}" is dark by design and has no light version, so slide ${index + 1} keeps its dark ground; ground "light" changed nothing.` });
      }
    }

    // 3. Seed at the slide's place on the canvas. On a photograph under the whole slide,
    // `logo: auto` takes the on-photo mark (the mono mark for dark grounds, else the
    // on-dark mark) where the master places its logo.
    const x = (index % PER_ROW) * (size.width + gap);
    const y = Math.floor(index / PER_ROW) * (size.height + gap);
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > Number.MAX_SAFE_INTEGER || Math.abs(y) > Number.MAX_SAFE_INTEGER) {
      throw new Error(`${p}: slide ${index + 1} would sit outside the canvas; use a smaller gap or size.`);
    }
    const photoMark = logoMode === 'auto' && ctx.logos && underPhotoShare(slide.under, size) >= PHOTO_COVER
      ? ctx.logos.monoOnDark ?? ctx.logos.onDark
      : undefined;
    const logos = photoMark ? { onLight: photoMark, onDark: photoMark, monoOnLight: photoMark, monoOnDark: photoMark } : ctx.logos;
    const seeded = seedFrame(expanded, archetype.id, {
      frameId, x, y, order: index, resolveToken: slideResolve,
      ...(typeof slide.name === 'string' && slide.name ? { name: slide.name } : {}),
      ...(logoMode !== 'none' && logos ? { logos } : {}),
      ...(logoMode === 'mono' ? { monoLogo: true } : {}),
      ...(surfaceAuto ? { surfaceAuto: true, linkTokens: true } : {}),
    });
    if (!seeded) throw new Error(`${p}/archetype: archetype "${archetype.id}" could not be seeded.`);
    const frame = seeded.frame as Rec;
    const origin = { x: Math.round(Number(frame.x)), y: Math.round(Number(frame.y)) };
    // Over a photograph a host measured, the mark must stand out from the picture there.
    const unreadableLogo = photoMark ? photoLogoCheck(seeded.layers, origin, index, p, ctx, notes) : null;
    // The master's colours in a document for every theme: before the slots, so a slot's
    // own colour replaces the link this gives.
    if (follow && slideResolve === resolve) followTheme(follow, archetype, frame, seeded.layers);

    // 4. Slots by key, then cells by role.
    const slotRows = new Map<string, DesignBoxRowV1>();
    for (const row of seeded.layers) {
      const key = row.furniture ? null : seededKey(row, frameId);
      if (key) slotRows.set(key, row);
    }
    const keysOf = (): string => [...slotRows.keys()].join(', ');
    const assigned = new Map<DesignBoxRowV1, { value: unknown; pointer: string }>();
    if (slide.slots !== undefined) {
      if (!record(slide.slots)) throw new Error(`${p}/slots: expected slot content by slot key.`);
      for (const [key, value] of Object.entries(slide.slots)) {
        const at = `${p}/slots/${seg(key)}`;
        const parsed = slotKeyOf(key);
        const row = parsed ? slotRows.get(parsed.key) : undefined;
        if (!row) throw new Error(`${at}: archetype "${archetype.id}" has no slot "${key}" (its slots: ${keysOf()}).`);
        const prev = assigned.get(row);
        if (prev) throw new Error(`${at}: slot "${key}" is also filled by ${prev.pointer}.`);
        assigned.set(row, { value, pointer: at });
      }
    }
    if (slide.cells !== undefined) {
      if (!Array.isArray(slide.cells)) throw new Error(`${p}/cells: expected a list of cells, each keyed by role.`);
      const cells = seeded.cells ?? [];
      if (cells.length === 0 && slide.cells.length > 0) throw new Error(`${p}/cells: archetype "${archetype.id}" has no cells; fill its slots by key (${keysOf()}).`);
      if (slide.cells.length > cells.length) {
        throw new Error(`${p}/cells: archetype "${archetype.id}" has ${plural(cells.length, 'cell')} and ${slide.cells.length} were given; a flow-cards-N-C or flow-columns-N-C layout takes N.`);
      }
      slide.cells.forEach((cell: unknown, k: number) => {
        const cp = `${p}/cells/${k}`;
        if (!record(cell)) throw new Error(`${cp}: expected a cell keyed by role.`);
        const rows = cells[k]!.layerIds.map((id) => seeded.layers.find((l) => l.id === id)).filter((l): l is DesignBoxRowV1 => !!l);
        for (const [key, value] of Object.entries(cell)) {
          const at = `${cp}/${seg(key)}`;
          const parsed = slotKeyOf(key);
          const row = parsed ? rows.filter((r) => r.role === parsed.role)[parsed.n - 1] : undefined;
          if (!row) {
            const roles = rows.map((r) => String(r.role)).join(', ');
            throw new Error(`${at}: cell ${k + 1} of "${archetype.id}" has no "${key}" (its roles: ${roles}).`);
          }
          const prev = assigned.get(row);
          if (prev) throw new Error(`${at}: this slot is also filled by ${prev.pointer}.`);
          assigned.set(row, { value, pointer: at });
        }
      });
    }

    const filled: string[] = [];
    const dropped: string[] = [];
    const kept: DesignBoxRowV1[] = [];
    const slotTables: Array<{ row: Rec; pointer: string }> = [];
    const furnitureKept: string[] = [];
    const omitUsed = new Set<string>();
    const furnitureOf = (id: string): FurnitureLayerV1 | undefined => expanded.furniture.find((f) => f.id === id);

    for (const row of seeded.layers) {
      if (typeof row.furniture === 'string' && row.furniture) {
        // 6. Furniture.
        if (row === unreadableLogo) continue;
        const f = furnitureOf(row.furniture);
        const kind = f?.kind ?? '';
        const omitted = omit.filter((o: string) => o === row.furniture || o === kind);
        if (omitted.length) {
          for (const o of omitted) {
            omitUsed.add(o);
            deckOmitUsed.add(o);
          }
          continue;
        }
        if (kind === 'page-number') {
          if (raw.pageNumbers === false) continue;
          row.text = String(index + 1);
        } else if (kind === 'footer') {
          const text = footerText;
          if (!text) {
            footerless.slides.push(frameId);
            if (!footerless.path) footerless.path = raw.footer === undefined ? `${p}/furniture` : '/footer';
            continue;
          }
          row.text = text;
        } else if (kind === 'logo') {
          if (typeof row.image !== 'string' || !row.image) {
            if (logoMode !== 'none') {
              logoless.slides.push(frameId);
              if (!logoless.path) logoless.path = `${p}/furniture`;
            }
            continue;
          }
        }
        if (row.kind === 'text') {
          row.pad = 0;
          row.lineHeight = lineHeightFor(kind === 'page-number' ? 'number' : 'label');
        }
        row.locked = true;
        kept.push(row);
        furnitureKept.push(row.furniture);
        continue;
      }
      const key = seededKey(row, frameId) ?? String(row.role ?? '');
      if (row.kind === 'text') {
        // 7. Pad 0 and the role's line height, under any override.
        row.pad = 0;
        row.lineHeight = lineHeightFor(String(row.role ?? 'body'));
      }
      const given = assigned.get(row);
      // A table slot given a `$table` (plan 291 M4): its rows are set out in the slot's
      // box, after the archetype's layers, and the slot's own text row is not drawn.
      if (given && record(given.value) && given.value.$table !== undefined) {
        slotTables.push(slotTableRow(row, given.value, given.pointer, origin, archetype, frameId));
        filled.push(key);
        continue;
      }
      const fx: FillContext = {
        origin, source, inventory, table: () => styleTable(ground), archetypeId: archetype.id,
        emphasis: slideEmphasis, textCase: slideCase, brief, notes, edits: textEdits,
        groundAt: (slot) => groundUnder(slot, frame, seeded.layers), literals,
        ...(follow ? { themeAccent: (slot: DesignBoxRowV1) => themeAccentFor(follow, slot, frame, seeded.layers) } : {}),
      };
      if (!given || !fillSlot(row, given.value, given.pointer, fx)) {
        dropped.push(key);
        continue;
      }
      filled.push(key);
      kept.push(row);
    }
    // A slot's own colour reference and `{@path …|}` runs, in a document for every theme:
    // the literal plus a link, which replaces the link the master gave that field.
    if (surfaceAuto && tokenSet) lowerSlotColours(kept, tokenSet, (row) => assigned.get(row)?.pointer ?? `${p}/archetype`);
    for (const o of slideFurniture.omit) {
      if (!omitUsed.has(o)) {
        const what = FURNITURE_KINDS.has(o) ? `no ${o} furniture` : `no furniture "${o}"`;
        notes.push({ path: `${p}/furniture/omit`, code: 'compose.furniture.unknown', message: `Slide ${index + 1} (${archetype.id}) shows ${what}, so "${o}" left nothing out.` });
      }
    }

    // 8. Speaker notes.
    let noteText: string | undefined;
    if (typeof slide.notes === 'string') {
      noteText = slide.notes || undefined;
    } else if (slide.notes === true || (slide.notes === undefined && source !== undefined && inventory)) {
      if (!inventory) throw new Error(`${p}/notes: notes: true copies the source slide's notes, and no inventory was given.`);
      if (source === undefined) throw new Error(`${p}/notes: notes: true needs the slide's source.`);
      const inv = inventory.slides[source - 1]!;
      // Paragraphs a blank line apart and line breaks one newline apart (plan 291 M4),
      // the form the PowerPoint notes writer reads back into a:p and a:br.
      if (inv.notes?.text) noteText = notesTextOf(inv.notes);
      else if (slide.notes === true) notes.push({ path: `${p}/notes`, code: 'compose.notes.none', message: `Slide ${source} of the inventory has no speaker notes, so slide ${index + 1} has none.` });
    } else if (slide.notes !== undefined && slide.notes !== null) {
      throw new Error(`${p}/notes: expected the notes text, true or null.`);
    }
    if (noteText) frame.notes = noteText;

    // Over a photograph a host measured, each text slot's ink must read against the
    // picture under it (plan 291 M4); a slot that does not is noted, never recoloured.
    if (ctx.photoSurface && underPhotoShare(slide.under, size) >= PHOTO_COVER) photoTextCheck(kept, origin, index, p, ctx, notes);

    // 9. under and over rows, slide-local.
    // The slide's own layers may not take an id an earlier slide's layers hold: an
    // earlier under or over row is pointed at, since renaming it is the fix.
    for (const row of kept) {
      if (typeof row.id !== 'string' || !row.id) continue;
      const id = row.id;
      const what = `slide ${index + 1}'s ${String(row.furniture ? `${row.furniture} furniture` : row.role ?? row.kind)} row`;
      const taker = takenBy.get(id);
      if (taker?.extra) throw new Error(`${taker.pointer}: layer "${id}" is also the id of ${what}; give this row another id.`);
      // An earlier slide's own id over this slide's default one: that id is the one to change.
      if (taker && slide.id === undefined && taker.pointer.endsWith('/id')) throw new Error(`${taker.pointer}: artboard "${id}" is also the id of ${what}; give that slide another id.`);
      if (taker) throw new Error(`${p}/id: layer "${id}" of slide ${index + 1} is already the id of ${taker.what} (${taker.pointer}); give this slide another id.`);
      takenBy.set(id, { pointer: `${p}/archetype`, what, extra: false });
    }
    const before = [...boxes, frame, ...kept];
    const under = lowerExtras(slide.under, 'under', p, frameId, { styles, brief, theme: briefTheme(ground), existing: before, notes, ...lowering });
    const tables = slotTables.flatMap((t) => {
      let r: ReturnType<typeof expandDesignAuthoring>;
      try {
        r = expandDesignAuthoring([t.row], { styles, brief, ...(briefTheme(ground) ? { theme: briefTheme(ground) } : {}), existing: [...before, ...under], pointer: t.pointer, ...lowering });
      } catch (err) {
        // The expansion points into its one-row list; the row is the slot's own value.
        if (err instanceof Error) err.message = err.message.split(`${t.pointer}/0/`).join(`${t.pointer}/`).split(`${t.pointer}/0:`).join(`${t.pointer}:`);
        throw err;
      }
      for (const note of r.notes) notes.push({ path: note.path.split(`${t.pointer}/0/`).join(`${t.pointer}/`), code: note.code, message: note.message });
      for (const made of r.rows) {
        if (typeof made.id !== 'string' || !made.id) continue;
        const taker = takenBy.get(made.id);
        if (taker) throw new Error(`${t.pointer}/$table: layer "${made.id}" is already the id of ${taker.what} (${taker.pointer}); give the table's templates other ids.`);
        takenBy.set(made.id, { pointer: t.pointer, what: `a table row of slide ${index + 1}`, extra: true });
      }
      return r.rows;
    });
    const over = lowerExtras(slide.over, 'over', p, frameId, { styles, brief, theme: briefTheme(ground), existing: [...before, ...under, ...tables], notes, ...lowering });

    for (const [key, rows] of [['under', under], ['over', over]] as const) {
      const given: unknown[] = Array.isArray(slide[key]) ? slide[key] as unknown[] : [];
      for (const row of rows) {
        if (typeof row.id !== 'string' || !row.id) continue;
        const id = row.id;
        // The row that gave the id, or the row an automatic `<slide>.<key>-<n>` id was made for.
        const auto = new RegExp(`^${frameId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.${key}-(\\d+)$`).exec(id);
        const n = auto ? Number(auto[1]) - 1 : -1;
        const k = n >= 0 && record(given[n]) && (given[n] as Rec).id === undefined ? n : given.findIndex((g) => record(g) && g.id === row.id);
        const pointer = k >= 0 ? `${p}/${key}/${k}` : `${p}/${key}`;
        const taker = takenBy.get(id);
        if (taker) throw new Error(`${pointer}: layer "${id}" is already the id of ${taker.what} (${taker.pointer}); give this row another id.`);
        takenBy.set(id, { pointer, what: `${key === 'under' ? 'an under' : 'an over'} row of slide ${index + 1}`, extra: true });
      }
    }
    boxes.push(frame, ...under, ...kept, ...tables, ...over);
    reportSlides.push({
      index,
      id: frameId,
      archetype: archetype.id,
      requested,
      ground: (followsTheme ? drawsOnDark(archetype, slideResolve) : archetypeIsDark(archetype, slideResolve)) ? 'dark' : 'light',
      filled,
      dropped,
      furniture: furnitureKept,
      notes: typeof frame.notes === 'string' && frame.notes.length > 0,
    });
  });

  for (const o of deckFurniture.omit) {
    if (!deckOmitUsed.has(o)) {
      const what = FURNITURE_KINDS.has(o) ? `no ${o} furniture` : `no furniture "${o}"`;
      notes.push({ path: '/furniture/omit', code: 'compose.furniture.unknown', message: `No slide shows ${what}, so "${o}" left nothing out.` });
    }
  }
  if (follow) notes.push(...themeFollowNotes(follow));
  if (footerless.slides.length) {
    notes.push({
      path: footerless.path, code: 'compose.footer.empty',
      message: `${plural(footerless.slides.length, 'slide shows', 'slides show')} a footer with no footer text (${footerless.slides.join(', ')}), so the footer was left off. Set footer on the spec, or furniture.footer on a slide.`,
    });
  }
  if (logoless.slides.length) {
    notes.push({
      path: logoless.path, code: 'compose.logo.unresolved',
      message: `${plural(logoless.slides.length, 'slide', 'slides')} (${logoless.slides.join(', ')}) left the logo off: ${ctx.logos ? 'no mark resolved for the ground under it' : 'no logo marks were given'}.`,
    });
  }

  // The edits: what the composed slides do not carry of their sources, in the shape check reads.
  let edits: ComposeEditV1[] = [];
  if (inventory && sources.length) {
    const sub: ContentInventoryV1 = { ...inventory, slides: sources.map((n) => inventory.slides[n - 1]!) };
    // A `{@path …|}` run a one-theme document keeps for the runtime is compared by its words.
    const fidelity = checkFidelity(sub, boxes.map((row) => (typeof row.text === 'string' && row.text.includes('{@') ? { ...row, text: withoutRunRefs(row.text) } : row)), { notes: false });
    edits = [
      ...fidelity.fidelity.missingStrings.map((source) => replacedBy(source, literals, inventory)
        ?? { source, reason: COUNTER.test(source) ? 'Decorative numbering left out: the number only counted the items, in reading order.' : 'Left out of the composed slides.' }),
      ...fidelity.fidelity.editedStrings.map((e) => ({ source: e.source, result: e.result, reason: REWORDED })),
    ];
    if (!fidelity.complete) {
      notes.push({ path: '/slides', code: 'compose.edits.partial', message: 'The comparison with the source stopped at a size cap, so the edits list may be short.' });
    }
  }
  // Emphasis recoloured and sentence case set: the words are the source's, the form is not.
  for (const edit of textEdits) {
    const same = edits.find((e) => e.source === edit.source && e.result === edit.result);
    // The form's own reason says more than the comparison's generic one; two forms on one
    // line (accent emphasis and sentence case) give both reasons.
    if (!same) edits.push(edit);
    else if (same.reason === REWORDED) same.reason = edit.reason;
    else if (!same.reason.includes(edit.reason)) same.reason = `${same.reason} ${edit.reason}`;
  }
  // A source line a joined slot reads inside a longer line (`AI: are we ...`) gets the
  // comparison's generic edit with the whole slot as its result. When a form edit names
  // that line and the slot holds its result, the form edit says what changed and the
  // generic one goes, so check reads the specific reason (plan 291 M4).
  const formKey = (t: string): string => normaliseFidelityText(t).toLowerCase();
  edits = edits.filter((e) => !(e.reason === REWORDED && typeof e.result === 'string' && textEdits.some((t) =>
    typeof t.result === 'string' && formKey(t.source) === formKey(e.source) && formKey(e.result!).includes(formKey(t.result)))));

  const document: DesignComposeDocumentV1 = {
    boxes,
    ...(typeof raw.transition === 'string' ? { transition: raw.transition } : {}),
    __export_width: String(size.width),
    __export_height: String(size.height),
    __export_unit: 'px',
  };
  const report: ComposeReportV1 = {
    format: 'lolly-compose',
    version: 1,
    master: { id: ctx.master.id, version: String(ctx.master.version ?? ''), origin: ctx.masterOrigin },
    size,
    slides: reportSlides,
    notes,
  };
  return { document, report, edits };
}

interface FillContext {
  origin: { x: number; y: number };
  source: number | undefined;
  inventory: ContentInventoryV1 | null;
  table: () => Record<string, DesignTextStyleV1>;
  archetypeId: string;
  /** The slide's emphasis over the spec's; a slot's own wins. */
  emphasis?: EmphasisMode;
  /** The slide's case over the spec's; a slot's own wins. */
  textCase?: CaseMode;
  brief: unknown | null;
  notes: ComposeReportNoteV1[];
  edits: ComposeEditV1[];
  /** The opaque colour under a slot: the master's panel there, else the slide's ground. */
  groundAt: (row: DesignBoxRowV1) => string | null;
  /** Slots given their own words on a slide with a source, for the edits list (plan 291 M4). */
  literals?: LiteralSlot[];
  /** The source lines the slot carries, set by `from`, so its edits name those lines. */
  carried?: { lines: string[]; bold: string[] };
  /** In a document for every theme: the accent token for emphasis in this slot, read in every theme. */
  themeAccent?: (row: DesignBoxRowV1) => { path: string; hex: string } | null;
}

/** A text slot given its own words on a slide that recreates a source slide. */
interface LiteralSlot { source: number; role: string; key: string; text: string }

/** WCAG contrast between two relative luminances. */
const luminanceContrast = (a: number, b: number): number => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Relative luminance of a #rrggbb colour, or null. */
function luminanceOf(hex: string): number | null {
  const h = hex6(hex);
  if (!h) return null;
  const lin = (i: number): number => {
    const c = Number.parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(1) + 0.7152 * lin(3) + 0.0722 * lin(5);
}

/**
 * The marks the brand allows on photography (plan 291 M4): a logo-surface rule's
 * `photo` list (else its `dark` list) among the host's marks, in the rule's order;
 * with no rule, every mark, the on-photo pick first.
 */
function photoLegalMarks(brief: unknown, logos: NonNullable<DesignComposeContext['logos']>, picked: string): string[] {
  const own = [picked, logos.monoOnDark, logos.onDark, logos.onLight, logos.monoOnLight].filter((v): v is string => typeof v === 'string' && !!v);
  const rules = record(brief) && record(brief.logos) && Array.isArray(brief.logos.rules) ? brief.logos.rules.filter(record) : [];
  const listed = rules.flatMap((r) => {
    const params = record(r.parameters) ? r.parameters : {};
    return strings(params.photo).length ? strings(params.photo) : strings(params.dark);
  });
  if (!listed.length) return [...new Set(own)];
  const known = new Set(own);
  const legal = listed.filter((id) => known.has(id));
  return [...new Set(legal.length ? legal : listed.filter((id) => id === picked))];
}

/**
 * `logo: auto` over a photograph the host measured (plan 291 M4): keep the picked mark
 * when each of its colours reaches 3:1 against the picture under the logo, else take the
 * first legal mark that does. When none does, the logo row is returned to be left off,
 * with a `compose.logo.photo-contrast` note. Null when nothing changes.
 */
/** Roles set large (WCAG large text, 3:1); every other text slot needs 4.5:1. */
const LARGE_TEXT_ROLES: ReadonlySet<string> = new Set(['title', 'subtitle', 'quote', 'number']);

/**
 * Text slots over a photograph the host measured (plan 291 M4): a slot whose ink falls
 * short of 3:1 (large text) or 4.5:1 against the median light of the picture under its
 * box gets a `compose.text.photo-contrast` note. A white statement over a light photo
 * in a dark deck is the case this catches; the slot keeps the master's ink, since only
 * the author can choose between a scrim, another ink or a calmer crop.
 */
function photoTextCheck(rows: readonly DesignBoxRowV1[], origin: { x: number; y: number }, index: number, p: string, ctx: DesignComposeContext, notes: ComposeReportNoteV1[]): void {
  const surface = ctx.photoSurface;
  if (!surface) return;
  for (const row of rows) {
    if (row.kind !== 'text' || row.furniture || typeof row.role !== 'string' || !String(row.text ?? '').trim()) continue;
    const ink = luminanceOf(String(row.fg ?? ''));
    if (ink === null) continue;
    const box = { x: Number(row.x) - origin.x, y: Number(row.y) - origin.y, w: Number(row.w), h: Number(row.h) };
    if (![box.x, box.y, box.w, box.h].every(Number.isFinite) || !(box.w > 0) || !(box.h > 0)) continue;
    const under = surface.luminanceUnder(index, box);
    if (!under) continue;
    const mid = under.mid ?? (under.low + under.high) / 2;
    const ratio = luminanceContrast(ink, mid);
    const need = LARGE_TEXT_ROLES.has(row.role) ? 3 : 4.5;
    if (ratio >= need) continue;
    notes.push({
      path: `${p}/slots/${seg(seededKey(row, String(row.frame ?? '')) ?? row.role)}`, code: 'compose.text.photo-contrast',
      message: `Slide ${index + 1}: ${String(row.id ?? row.role)} (${row.role}) is set in ${hex6(row.fg)} over the photograph, whose light under it has a median relative luminance of ${mid.toFixed(2)}: ${ratio.toFixed(2)}:1, short of ${need}:1. Put a scrim under the text (an under box with a linear grad and $tint), set the slot's fg, or compose the slide in the other theme.`,
    });
  }
}

function photoLogoCheck(layers: DesignBoxRowV1[], origin: { x: number; y: number }, index: number, p: string, ctx: DesignComposeContext, notes: ComposeReportNoteV1[]): DesignBoxRowV1 | null {
  const surface = ctx.photoSurface;
  const logo = layers.find((row) => typeof row.furniture === 'string' && row.kind === 'image' && typeof row.image === 'string' && row.image);
  if (!surface || !logo || !ctx.logos) return null;
  const box = { x: Number(logo.x) - origin.x, y: Number(logo.y) - origin.y, w: Number(logo.w), h: Number(logo.h) };
  if (![box.x, box.y, box.w, box.h].every(Number.isFinite) || !(box.w > 0) || !(box.h > 0)) return null;
  const under = surface.luminanceUnder(index, box);
  if (!under) return null;
  const picked = String(logo.image);
  const worst = (id: string): number | null => {
    const inks = (surface.inks[id] ?? []).map(luminanceOf).filter((l): l is number => l !== null);
    if (!inks.length) return null;
    return Math.min(...inks.flatMap((l) => [luminanceContrast(l, under.low), luminanceContrast(l, under.high)]));
  };
  const candidates = photoLegalMarks(ctx.brief, ctx.logos, picked).map((id) => ({ id, ratio: worst(id) }));
  const good = candidates.find((c) => c.ratio !== null && c.ratio >= 3);
  if (good) {
    logo.image = good.id;
    return null;
  }
  // A mark whose colours are not known here might still read; only marks all measured too faint are left off.
  if (candidates.some((c) => c.ratio === null)) return null;
  const best = Math.max(...candidates.map((c) => c.ratio ?? 0));
  notes.push({
    path: `${p}/furniture`, code: 'compose.logo.photo-contrast',
    message: `Slide ${index + 1}: the photograph under the logo is too light or too busy there (relative luminance ${under.low.toFixed(2)} to ${under.high.toFixed(2)}), and no mark the brand allows on photography reaches 3:1 against it (best ${best.toFixed(2)}:1), so the logo was left off. Place the logo yourself on a calmer part of the picture, or over a scrim.`,
  });
  return logo;
}

/** The opaque ground under a slot's centre: the last master panel or bar there, else the frame's own. */
function groundUnder(row: DesignBoxRowV1, frame: Rec, layers: readonly DesignBoxRowV1[]): string | null {
  const cx = Number(row.x) + Number(row.w) / 2;
  const cy = Number(row.y) + Number(row.h) / 2;
  let ground = hex6(frame.bg);
  for (const layer of layers) {
    if (layer === row) break;
    if (!layer.furniture || layer.kind !== 'box' || typeof layer.bg !== 'string' || !/^#?[0-9a-f]{6}$/i.test(layer.bg.trim())) continue;
    const [x, y, w, h] = [layer.x, layer.y, layer.w, layer.h].map(Number);
    if (cx >= x! && cx <= x! + w! && cy >= y! && cy <= y! + h!) ground = hex6(layer.bg);
  }
  return ground;
}

/**
 * Write one slot value into its seeded row. False when the value leaves the slot
 * empty (`null`, `''`), which drops the slot.
 */
function fillSlot(row: DesignBoxRowV1, value: unknown, pointer: string, fx: FillContext): boolean {
  const image = row.kind === 'image';
  if (value === null || value === '') return false;
  if (typeof value === 'string') {
    if (image) row.image = value;
    else {
      row.text = casedText(value, fx.textCase, pointer, fx);
      noteLiteral(row, value, pointer, fx);
    }
    return true;
  }
  if (!record(value)) throw new Error(`${pointer}: expected ${image ? 'a picture reference' : 'Design text'}, null, or an object with ${image ? 'image' : 'text'} or from.`);
  for (const key of Object.keys(value)) {
    if (RESERVED.has(key)) throw new Error(`${pointer}/${seg(key)}: "${key}" belongs to the master binding and cannot be set on a slot.`);
    if (key.startsWith('$') && key !== '$style') throw new Error(`${pointer}/${seg(key)}: unknown key; a slot takes $style and Design row fields.`);
  }
  const given = ['text', 'image', 'from'].filter((k) => value[k] !== undefined);
  if (given.length > 1) throw new Error(`${pointer}: give one of text, image or from (this slot gives ${given.join(' and ')}).`);
  if (value.para !== undefined && value.from === undefined) throw new Error(`${pointer}/para: para picks a paragraph of the from object; give from.`);
  if (value.join !== undefined) {
    if (value.from === undefined) throw new Error(`${pointer}/join: join runs the paragraphs of the from object together; give from.`);
    if (typeof value.join !== 'string') throw new Error(`${pointer}/join: expected the text to put between paragraphs, such as ": ".`);
  }
  if (image && value.text !== undefined) throw new Error(`${pointer}/text: slot "${String(row.role)}" holds a picture; give image or from.`);
  if (!image && value.image !== undefined) throw new Error(`${pointer}/image: slot "${String(row.role)}" holds text; give text or from.`);
  if (image && value.$style !== undefined) throw new Error(`${pointer}/$style: only text slots take a text style.`);
  for (const key of ['case', 'emphasis'] as const) {
    if (image && value[key] !== undefined) throw new Error(`${pointer}/${key}: only text slots take ${key}.`);
  }
  const slotCase = caseAt(value.case, `${pointer}/case`) ?? fx.textCase;
  const slotEmphasis = emphasisAt(value.emphasis, `${pointer}/emphasis`) ?? fx.emphasis;
  if (value.text === undefined && value.image === undefined && value.from === undefined) {
    throw new Error(`${pointer}: give text, image or from, or null to leave the slot out.`);
  }
  const literal = value.text ?? value.image;
  if (literal !== undefined && typeof literal !== 'string') throw new Error(`${pointer}/${value.text !== undefined ? 'text' : 'image'}: expected a string.`);

  // The style goes under the explicit fields, over the master's. Both are written before
  // the words, so a source's emphasis is set against the slot's final weight and ink.
  let italic = false;
  if (value.$style !== undefined) {
    const ref = value.$style;
    if (typeof ref !== 'string' && !record(ref)) throw new Error(`${pointer}/$style: expected a text style id or a style object.`);
    const style = resolveTextStyle(ref as string | DesignTextStyleV1, fx.table(), `${pointer}/$style`);
    for (const key of STYLE_ROW_FIELDS) if (style[key] !== undefined) row[key] = style[key] as string | number;
    if (typeof row.weight === 'number') row.weight = String(row.weight);
    italic = style.italic === true;
  }
  for (const [key, v] of Object.entries(value)) {
    if (CONTENT_KEYS.has(key)) continue;
    if (key === 'x' || key === 'y') {
      row[key] = (key === 'x' ? fx.origin.x : fx.origin.y) + numberAt(v, `${pointer}/${key}`);
    } else if (key === 'w' || key === 'h') {
      const n = numberAt(v, `${pointer}/${key}`);
      if (n <= 0) throw new Error(`${pointer}/${key}: expected a size above 0.`);
      row[key] = n;
    } else if (v === null || ['string', 'number', 'boolean'].includes(typeof v)) {
      row[key] = key === 'weight' && typeof v === 'number' ? String(v) : (v as string | number | boolean | null);
      // A token reference in a colour field replaces the master's link for that field: it
      // is lowered with the slot when the tokens are here, and by the runtime otherwise.
      if (COMPOSE_COLOUR_FIELDS.includes(key) && typeof v === 'string' && isColourRef(v)) setColourLink(row, key, null);
    } else {
      throw new Error(`${pointer}/${seg(key)}: a Design row field holds a string, number, boolean or null.`);
    }
  }

  const editsBefore = fx.edits.length;
  const content = typeof literal === 'string' ? literal : fromInventory(row, value, pointer, fx, slotEmphasis);
  if (!content) return false;
  if (typeof literal === 'string' && !image) noteLiteral(row, literal, pointer, fx);
  if (image) row.image = content;
  else {
    const cased = casedText(content, slotCase, pointer, fx, editsBefore);
    row.text = italic ? italicText(cased, `${pointer}/$style`) : cased;
  }
  return true;
}

/** Text in the case asked for: sentence case recorded as an edit per changed line, and reported. */
function casedText(text: string, mode: CaseMode | undefined, pointer: string, fx: FillContext, slotEditsFrom?: number): string {
  if (mode !== 'sentence') return text;
  const out = sentenceCaseDesignText(text);
  if (out === text) return text;
  // This slot's earlier edits (its accent emphasis) name a line as the slot read before
  // casing: their results become the line as the slot reads it now.
  if (slotEditsFrom !== undefined) {
    const now = plainOfDesignText(out);
    for (const edit of fx.edits.slice(slotEditsFrom)) {
      if (typeof edit.result !== 'string' || !edit.result) continue;
      const at = now.toLowerCase().indexOf(edit.result.toLowerCase());
      if (at >= 0) edit.result = now.slice(at, at + edit.result.length);
    }
  }
  const changes = againstSourceLines(lineEdits(text, out, 'Set in sentence case (case: sentence).'), fx.carried?.lines, true);
  fx.edits.push(...changes);
  const shown = changes.map((e) => `"${e.source}" to "${e.result}"`).join('; ');
  fx.notes.push({ path: pointer, code: 'compose.case.sentence', message: `Sentence case: ${shown}.` });
  return out;
}

/**
 * How a source's bold reads in this slot (E15). Only a display slot (title, subtitle,
 * quote, number) follows the brand: by the slot's, slide's or spec's `emphasis`, else
 * `accent` when a text-weight house rule on the slot does not allow 700, so a bold run
 * would break that rule. Anywhere else, bold stays bold.
 */
function emphasisFor(row: DesignBoxRowV1, asked: EmphasisMode | undefined, pointer: string, fx: FillContext, hasEmphasis = true): { mode: EmphasisMode; accent?: string; accentRef?: string; why: string } {
  const role = String(row.role ?? '');
  if (!HEADLINE_SLOT_ROLES.has(role)) return { mode: 'bold', why: '' };
  const rule = asked ? null : boldBreaksRules(fx.brief, role);
  const mode: EmphasisMode = asked ?? (rule ? 'accent' : 'bold');
  if (mode !== 'accent') return { mode, why: '' };
  // No bold run among plain ones (none, or every word bold): nothing to set in an accent.
  if (!hasEmphasis) return { mode: 'bold', why: '' };
  const ground = fx.groundAt(row);
  // A document for every theme takes an accent token that reads in each of them, so the
  // emphasis follows the theme (plan 291 M4); else the brief's accent for this ground.
  const themed = fx.themeAccent?.(row) ?? null;
  const accent = themed?.hex ?? (ground ? accentInk(fx.brief, ground, hex6(row.fg)) : null);
  if (!accent) {
    fx.notes.push({
      path: pointer, code: 'compose.emphasis.no-accent',
      message: `No accent colour the brand allows as text on ${ground ?? 'this ground'} differs from the slot's own ink, so the source's bold in "${String(row.role)}" stays bold${rule ? ` (house rule "${rule}" does not allow 700)` : ''}.`,
    });
    return { mode: 'bold', why: '' };
  }
  return { mode, accent, ...(themed ? { accentRef: themed.path } : {}), why: rule ? `house rule "${rule}" does not allow bold (700)` : 'emphasis: accent' };
}

/** The text or picture an inventory object gives a slot. */
function fromInventory(row: DesignBoxRowV1, value: Rec, pointer: string, fx: FillContext, asked?: EmphasisMode): string {
  // A list of objects (plan 291 M4): their paragraphs in the order given, as one text,
  // so an eyebrow set as its own object can join the heading.
  if (Array.isArray(value.from)) return fromInventoryList(row, value, pointer, fx, asked);
  const id = value.from;
  if (typeof id !== 'string' || !id) throw new Error(`${pointer}/from: expected an inventory object id.`);
  if (!fx.inventory) throw new Error(`${pointer}/from: no inventory was given to copy "${id}" from.`);
  const hit = findInventoryObject(fx.inventory, id, fx.source);
  if (!hit) throw new Error(`${pointer}/from: the inventory has no text or picture "${id}".`);
  const image = row.kind === 'image';
  if (hit.kind === 'table') throw new Error(`${pointer}/from: "${id}" is a table; set it out with a $table row in over, placed in the slot's box.`);
  if (hit.kind === 'picture') {
    if (!image) throw new Error(`${pointer}/from: "${id}" is a picture and slot "${String(row.role)}" holds text.`);
    if (value.para !== undefined) throw new Error(`${pointer}/para: "${id}" is a picture and has no paragraphs.`);
    if (value.join !== undefined) throw new Error(`${pointer}/join: "${id}" is a picture and has no paragraphs.`);
    return `user/media/${hit.slide.pictures[hit.index]!.sha256}`;
  }
  if (image) throw new Error(`${pointer}/from: "${id}" is text and slot "${String(row.role)}" holds a picture.`);
  const text = hit.slide.text[hit.index]!;
  return carriedText(row, text.paragraphs, value, pointer, fx, asked);
}

/** `from` as a list of text objects: every paragraph of each, in order. */
function fromInventoryList(row: DesignBoxRowV1, value: Rec, pointer: string, fx: FillContext, asked?: EmphasisMode): string {
  const ids = value.from as unknown[];
  if (!ids.length) throw new Error(`${pointer}/from: expected an inventory object id, or a list of them.`);
  if (!fx.inventory) throw new Error(`${pointer}/from: no inventory was given to copy from.`);
  if (value.para !== undefined) throw new Error(`${pointer}/para: para picks a paragraph of one object; give from as one id.`);
  if (row.kind === 'image') throw new Error(`${pointer}/from: slot "${String(row.role)}" holds a picture; a list of objects joins text.`);
  const paragraphs: InventoryParagraphs = [];
  ids.forEach((id, k) => {
    if (typeof id !== 'string' || !id) throw new Error(`${pointer}/from/${k}: expected an inventory object id.`);
    const hit = findInventoryObject(fx.inventory!, id, fx.source);
    if (!hit) throw new Error(`${pointer}/from/${k}: the inventory has no text or picture "${id}".`);
    if (hit.kind !== 'text') throw new Error(`${pointer}/from/${k}: "${id}" is a ${hit.kind}; a list of objects joins text.`);
    paragraphs.push(...hit.slide.text[hit.index]!.paragraphs);
  });
  return carriedText(row, paragraphs, value, pointer, fx, asked);
}

/** The plain lines of inventory paragraphs (a paragraph end and a line break both end one), and those with a bold run. */
function sourceLinesOf(paragraphs: InventoryParagraphs): { lines: string[]; bold: string[] } {
  const lines: string[] = [];
  const bold: string[] = [];
  for (const p of paragraphs) {
    const pieces: Array<{ text: string; bold: boolean }> = [{ text: '', bold: false }];
    for (const r of p.runs) {
      r.text.split(/\r\n?|\n/).forEach((piece, k) => {
        if (k > 0) pieces.push({ text: '', bold: false });
        const line = pieces[pieces.length - 1]!;
        line.text += piece;
        if (r.bold === true && piece.trim()) line.bold = true;
      });
    }
    for (const line of pieces) {
      const t = line.text.replace(/\s+/g, ' ').trim();
      if (!t) continue;
      lines.push(t);
      if (line.bold) bold.push(t);
    }
  }
  return { lines, bold };
}

/**
 * Inventory paragraphs as the slot's text: one paragraph or a list of them (`para`),
 * every line run into one (`join`), both (the picked paragraphs' lines run into one),
 * or all of them.
 */
function carriedText(row: DesignBoxRowV1, source: InventoryParagraphs, value: Rec, pointer: string, fx: FillContext, asked?: EmphasisMode): string {
  const id = Array.isArray(value.from) ? (value.from as string[]).join(', ') : String(value.from);
  let paragraphs = source;
  if (value.para !== undefined) {
    // One paragraph, or a list of them in that order (plan 291 M4).
    const list = Array.isArray(value.para) ? value.para : [value.para];
    if (!list.length) throw new Error(`${pointer}/para: expected a 0-based paragraph number, or a list of them.`);
    const seen = new Set<number>();
    paragraphs = list.map((n, k) => {
      const at = Array.isArray(value.para) ? `${pointer}/para/${k}` : `${pointer}/para`;
      if (typeof n !== 'number' || !Number.isInteger(n) || n < 0) throw new Error(`${at}: expected a 0-based paragraph number.`);
      if (n >= source.length) throw new Error(`${at}: "${id}" has ${plural(source.length, 'paragraph')} (0 to ${source.length - 1}).`);
      if (seen.has(n)) throw new Error(`${at}: paragraph ${n} is listed twice.`);
      seen.add(n);
      return source[n]!;
    });
  }
  // The source lines the slot carries: the picked paragraphs, or the whole object.
  const carried = value.para !== undefined ? paragraphs : source;
  if (typeof value.join === 'string') paragraphs = joinedParagraphs(paragraphs, value.join);
  fx.carried = sourceLinesOf(carried);
  const weight = Number(row.weight);
  const worded = paragraphs.flatMap((p) => p.runs).filter((r) => r.text.trim());
  const hasEmphasis = worded.some((r) => r.bold === true) && !worded.every((r) => r.bold === true);
  const emphasis = emphasisFor(row, asked, pointer, fx, hasEmphasis);
  const out = designTextOfInventory(paragraphs, Number.isFinite(weight) && weight > 0 ? weight : 400, emphasis);
  let text = out.text;
  if (out.mapped.length && emphasis.accent) {
    const reason = `Bold emphasis set in the accent colour ${emphasis.accent}, the brand's form for it (${emphasis.why}).`;
    for (const line of out.mapped) fx.edits.push(...againstSourceLines([{ source: line, result: line, reason }], fx.carried?.bold, false));
    fx.notes.push({
      path: pointer, code: 'compose.emphasis.accent',
      message: `The source's bold in "${String(row.role)}" is set in ${emphasis.accent}${emphasis.accentRef ? ` ({${emphasis.accentRef}}, which follows the theme)` : ''} at the slot's weight: ${emphasis.why}.`,
    });
    // The accent runs as `{@path …|}`, lowered with the slot to the literal plus a run link.
    if (emphasis.accentRef) text = withRunRef(text, emphasis.accent, emphasis.accentRef);
  }
  return tidyCarriedText(text);
}

/**
 * Carried text without the source's loose ends (plan 291 M4): the spaces before each
 * line break and at the end, and blank lines at either end. Inner blank lines stay,
 * because the speaker or designer left them there.
 */
function tidyCarriedText(text: string): string {
  const lines = text.split('\n').map((line) => line.replace(/(^|[^\\])[ \t\u00a0]+$/u, '$1').replace(/(^|[^\\])[ \t\u00a0]+(\}+)$/u, '$1$2'));
  while (lines.length && !lines[0]!.trim()) lines.shift();
  while (lines.length && !lines[lines.length - 1]!.trim()) lines.pop();
  return lines.join('\n');
}

/**
 * Edits named by the source's own lines (plan 291 M4), so `lolly check --edits` matches
 * each one: an edit whose source is a slot line made of several source lines (a join)
 * becomes one edit per source line it holds, its result that line as the slot now reads
 * it (the same words in their new case or colour). With `changedOnly`, a source line
 * the slot still holds word for word is no edit.
 */
function againstSourceLines(edits: ComposeEditV1[], lines: readonly string[] | undefined, changedOnly: boolean): ComposeEditV1[] {
  if (!lines?.length) return edits;
  const norm = (t: string): string => t.replace(/\s+/g, ' ').trim();
  const out: ComposeEditV1[] = [];
  for (const edit of edits) {
    const source = norm(edit.source);
    const result = norm(edit.result ?? '');
    if (lines.some((line) => norm(line) === source)) {
      out.push(edit);
      continue;
    }
    const held = lines.map(norm).filter((line) => line && source.includes(line) && (!changedOnly || !result.includes(line)));
    if (!held.length) {
      out.push(edit);
      continue;
    }
    for (const line of held) {
      // Case changes keep the length, so a search that ignores case finds the line in the result.
      const at = result.toLowerCase().indexOf(line.toLowerCase());
      const now = at >= 0 ? result.slice(at, at + line.length) : result;
      if (!out.some((e) => e.source === line && e.result === now)) out.push({ ...edit, source: line, result: now });
    }
  }
  return out;
}

/** Remember a text slot given its own words on a slide with a source, for `replacedBy`. */
function noteLiteral(row: DesignBoxRowV1, text: string, pointer: string, fx: FillContext): void {
  if (fx.source === undefined || !fx.literals || typeof row.role !== 'string') return;
  const plain = plainOfDesignText(text).replace(/\s+/g, ' ').trim();
  if (plain) fx.literals.push({ source: fx.source, role: row.role, key: pointer, text: plain });
}

/**
 * A source string the composed slides do not carry, when the slot of its role on its
 * slide was given other words: an edit with that result (plan 291 M4). Null when no
 * slot answers, or two slots of that role do.
 */
function replacedBy(missing: string, literals: readonly LiteralSlot[], inventory: ContentInventoryV1): ComposeEditV1 | null {
  const norm = (t: string): string => t.replace(/\s+/g, ' ').trim();
  const want = norm(missing);
  const hits = literals.filter((lit) => {
    const slide = inventory.slides[lit.source - 1];
    const said = norm(lit.text).toLowerCase();
    // The slot rewrote the whole object: none of its lines is carried there word for word.
    return !!slide && slide.text.some((t) => {
      const lines = t.plain.split('\n').map(norm).filter(Boolean);
      return t.role === lit.role && lines.includes(want) && !lines.some((line) => said.includes(line.toLowerCase()));
    });
  });
  const one = hits.length === 1 ? hits[0]! : null;
  if (!one || norm(one.text) === want) return null;
  return { source: missing, result: one.text, reason: `Replaced by the words written for the ${one.role} slot (${one.key}).` };
}

/** An empty line inside a notes paragraph, in the notes text: one no-break space (U+00A0). */
const NOTES_EMPTY_LINE = '\u00a0';

/** Speaker notes as text: a blank line between paragraphs, a newline for each line break inside one. */
function notesTextOf(notes: NonNullable<InventorySlideV1['notes']>): string {
  // A blank line inside a paragraph (two a:br in a row) is written as a line holding
  // only a no-break space, so it stays a line and is not read back as a paragraph break.
  const paras = Array.isArray(notes.paragraphs) && notes.paragraphs.length
    ? notes.paragraphs.map((p) => p.lines.map((line, k) => (line.trim() === '' && k > 0 && k < p.lines.length - 1 ? NOTES_EMPTY_LINE : line)).join('\n'))
    : [notes.text];
  return paras.join('\n\n').replace(/^\s*\n|\n\s*$/g, '');
}

/**
 * A table slot's `$table` as one authoring row (plan 291 M4): its `x` and `y` are
 * relative to the slot's box, its id the slot row's. Only a slot the master declares a
 * table takes one, and nothing else may be given beside the `$table`.
 */
function slotTableRow(row: DesignBoxRowV1, value: Rec, pointer: string, origin: { x: number; y: number }, archetype: ArchetypeV1, frameId: string): { row: Rec; pointer: string } {
  const role = String(row.role ?? '');
  const kind = archetype.placeholders.find((ph) => ph.role === role)?.kind;
  if (kind !== 'table') throw new Error(`${pointer}/$table: slot "${role}" holds ${kind === 'image' ? 'a picture' : 'text'}; a $table fills a table slot (data), or goes in over.`);
  for (const key of Object.keys(value)) {
    if (key !== '$table') throw new Error(`${pointer}/${seg(key)}: a table slot given a $table takes nothing else; style its rows in the $table's templates.`);
  }
  const macro = value.$table;
  if (!record(macro)) throw new Error(`${pointer}/$table: expected a $table object (pitch, columns, rows).`);
  const at = (k: 'x' | 'y'): number => (k === 'x' ? Number(row.x) - origin.x : Number(row.y) - origin.y) + (macro[k] === undefined ? 0 : numberAt(macro[k], `${pointer}/$table/${k}`));
  return { row: { id: row.id, $in: frameId, $table: { ...macro, x: at('x'), y: at('y') } }, pointer };
}

/** `under` or `over` rows lowered through the authoring expansion, slide-local. */
function lowerExtras(
  list: unknown,
  key: 'under' | 'over',
  p: string,
  frameId: string,
  opts: {
    styles: Record<string, DesignTextStyleV1>; brief: unknown | null; theme: string | undefined; existing: readonly Record<string, unknown>[]; notes: ComposeReportNoteV1[];
    tokens?: TokenSet; themes?: readonly string[];
  },
): Record<string, unknown>[] {
  if (list === undefined) return [];
  if (!Array.isArray(list)) throw new Error(`${p}/${key}: expected a list of Design rows.`);
  const rows = list.map((row: unknown, k: number) => {
    const at = `${p}/${key}/${k}`;
    if (!record(row)) throw new Error(`${at}: expected a Design row.`);
    if (row.kind === 'frame' || row.$artboard !== undefined) throw new Error(`${at}: a slide's ${key} rows sit on the slide; an artboard belongs in the slides list.`);
    if (row.$in !== undefined && row.$in !== frameId) throw new Error(`${at}/$in: ${key} rows belong to this slide ("${frameId}"); leave $in out.`);
    for (const reserved of ['master', 'archetype', 'furniture', 'order']) {
      if (row[reserved] !== undefined) throw new Error(`${at}/${reserved}: ${key} rows are the slide's own layers, outside the master binding.`);
    }
    const isMacro = ['$stack', '$grid', '$table'].some((m) => row[m] !== undefined);
    const out: Rec = { ...row, $in: frameId };
    if (!isMacro && out.id === undefined) out.id = `${frameId}.${key}-${k + 1}`;
    return out;
  });
  if (!rows.length) return [];
  const r = expandDesignAuthoring(rows, {
    styles: opts.styles,
    brief: opts.brief,
    ...(opts.theme ? { theme: opts.theme } : {}),
    existing: opts.existing,
    pointer: `${p}/${key}`,
    ...(opts.tokens ? { tokens: opts.tokens } : {}),
    ...(opts.themes ? { themes: opts.themes } : {}),
  });
  for (const note of r.notes) opts.notes.push({ path: note.path, code: note.code, message: note.message });
  return r.rows;
}

/**
 * A master token path as the colour `tokens` give it (plan 291 W4): the theme the
 * document's literals are cached in. A path the tokens do not resolve to a colour falls
 * back to the host's resolver.
 */
// ─── following every theme (plan 291 M4) ─────────────────────────────────────

/** The colour fields of a Design row a token reference may be written into. */
const COMPOSE_COLOUR_FIELDS: readonly string[] = ['bg', 'fg', 'stroke', 'shadowColor'];
/** Theme-following grounds a light archetype's constant ground may stand for, in order. */
const SURFACE_TOKENS: readonly string[] = ['color.semantic.surface', 'color.role.alt-surface'];
/** Theme-following inks a constant ink may stand for, in order; then every other semantic or role colour. */
const INK_TOKENS: readonly string[] = [
  'color.semantic.text', 'color.role.secondary-ink', 'color.role.muted-ink', 'color.role.accent-ink',
  'color.role.alert-ink', 'color.role.strong-card-ink', 'color.semantic.muted', 'color.semantic.primary', 'color.semantic.secondary',
];
/** Accent tokens for emphasis in a document for every theme, in order. */
const ACCENT_TOKENS: readonly string[] = ['color.role.accent-ink', 'color.role.accent', 'color.semantic.secondary', 'color.semantic.primary'];
/** Contrast an ink must keep on its ground in every theme to be linked to a theme-following token (large text). */
const THEME_INK_CONTRAST = 3;

interface ThemeFollow {
  /** The tokens in every theme the document is shown in. */
  sets: readonly TokenSet[];
  /** The theme the literals are cached in. */
  cached: TokenSet;
  /** The master's own colours: what a slide that is dark by design is held at. */
  authored: TokenResolver | undefined;
  /** Hex to a token path whose colour is the same in every theme, built on first need. */
  constants?: Map<string, string>;
  /** Slides whose master colours were linked to theme-following tokens. */
  relinked: string[];
  /** Slides dark by design, held at the master's colours in every theme. */
  pinned: string[];
  /** Slides whose inks follow the theme on a ground that does not, held at the master's ink. */
  inkHeld: string[];
  /** Inks a brand constant gave on a ground that follows the theme, with no token to stand for them. */
  stranded: Array<{ id: string; hex: string; themes: number[] }>;
}

function themeFollowOf(cached: TokenSet, names: readonly string[], byName: DesignComposeContext['themeTokens'], authored: TokenResolver | undefined): ThemeFollow | null {
  if (!byName) return null;
  const sets = names.map((name) => byName[name]).filter((set): set is TokenSet => !!set);
  return sets.length > 1 ? { sets, cached, authored, relinked: [], pinned: [], inkHeld: [], stranded: [] } : null;
}

/** A colour token in one theme as `#rrggbb`, or null. */
function tokenColour(set: TokenSet, path: string): string | null {
  const result = resolveTokenBinding(set.get(path), { type: 'color', colorTarget: 'srgb' });
  return result.status === 'linked' ? hex6(result.value) : null;
}

/** A token's colour in every theme, in theme order; null when one theme has no such token. */
function themeValues(f: ThemeFollow, path: string): string[] | null {
  const out: string[] = [];
  for (const set of f.sets) {
    const hex = tokenColour(set, path);
    if (!hex) return null;
    out.push(hex);
  }
  return out;
}

const varies = (values: readonly string[]): boolean => values.some((v) => v !== values[0]);

/** The live link on a row's field: its token path, or null for none, a custom one or a tint. */
function linkedPath(row: Rec, field: string): string | null {
  const link = readBlockTokenBindings(row.tokenLinks)[field];
  if (!link || link.custom || link.mode) return null;
  return aliasPath(link.ref) ?? null;
}

/** A row's colour in every theme: its link's, else its literal in all of them. */
function rowColours(f: ThemeFollow, row: Rec, field: string): string[] | null {
  const raw = row[field];
  // A slot's own reference, not lowered yet, or the field's live link.
  const path = typeof raw === 'string' && /^\s*\{[^{}]+\}\s*$/.test(raw) ? aliasPath(raw.trim()) ?? null : linkedPath(row, field);
  const linked = path ? themeValues(f, path) : null;
  if (linked) return linked;
  const hex = hex6(raw);
  return hex ? f.sets.map(() => hex) : null;
}

/** Set or drop the link on one colour field, keeping the row's other links and run links. */
function setColourLink(row: Rec, field: string, link: { ref: string; value: string } | null): void {
  if (link) {
    Object.assign(row, withBlockTokenBinding(row as never, 'tokenLinks', field, link as never));
    return;
  }
  if (typeof row.tokenLinks !== 'string') return;
  const links: Rec = { ...readBlockTokenBindings(row.tokenLinks) };
  if (!(field in links)) return;
  delete links[field];
  const runs = readBlockRunBindings(row.tokenLinks);
  if (Object.keys(runs).length) links.__runs = runs;
  if (Object.keys(links).length) row.tokenLinks = canonicalJson(links);
  else delete row.tokenLinks;
}

/** A token path whose colour is `hex` in every theme: a brand colour first, then a ramp step. */
function constantPathFor(f: ThemeFollow, hex: string): string | null {
  if (!f.constants) {
    f.constants = new Map();
    const rank = (path: string): number => (path.startsWith('color.brand.') ? 0 : path.startsWith('color.ramp.') ? 1 : 2);
    const paths = f.cached.colors().map((c) => c.path).sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : a > b ? 1 : 0));
    for (const path of paths) {
      const values = themeValues(f, path);
      if (values && !varies(values) && !f.constants.has(values[0]!)) f.constants.set(values[0]!, path);
    }
  }
  return f.constants.get(hex) ?? null;
}

/** The opaque row under a slot's centre: the last master panel or bar there, else the frame. */
function groundRowUnder(row: DesignBoxRowV1, frame: Rec, layers: readonly DesignBoxRowV1[]): Rec {
  const cx = Number(row.x) + Number(row.w) / 2;
  const cy = Number(row.y) + Number(row.h) / 2;
  let ground: Rec = frame;
  for (const layer of layers) {
    if (layer === row) break;
    if (!layer.furniture || layer.kind !== 'box' || !hex6(layer.bg)) continue;
    const [x, y, w, h] = [layer.x, layer.y, layer.w, layer.h].map(Number);
    if (cx >= x! && cx <= x! + w! && cy >= y! && cy <= y! + h!) ground = layer;
  }
  return ground;
}

/**
 * The master's colours on one seeded slide of a document for every theme (plan 291 M4).
 *
 * A slide that is dark by design (an archetype whose ground is dark and that is no
 * light archetype's twin: a title, a full-page picture, a closing slide) is held at the
 * master's own colours: each link to a token that changes with the theme is moved to a
 * token that does not, with the same colour, or dropped. Any other slide follows the
 * theme: a light ground the master takes from a constant is linked to the theme's own
 * surface of the same colour, and an ink a brand constant gives on a ground that follows
 * the theme is linked to the theme's own ink of the same colour that reads on that
 * ground in every theme, so a dark title on a surface that turns dark turns light.
 */
function followTheme(f: ThemeFollow, archetype: ArchetypeV1, frame: Rec, layers: DesignBoxRowV1[]): void {
  const id = String(frame.id);
  if (archetype.background?.dark === true && !archetype.variantOf) {
    let held = false;
    for (const row of [frame, ...layers] as Rec[]) {
      for (const field of COMPOSE_COLOUR_FIELDS) {
        const path = linkedPath(row, field);
        const values = path ? themeValues(f, path) : null;
        if (!path || !values || !varies(values)) continue;
        const hex = hex6(f.authored?.(path)) ?? hex6(row[field]);
        if (!hex) continue;
        row[field] = hex;
        const constant = constantPathFor(f, hex);
        setColourLink(row, field, constant ? { ref: `{${constant}}`, value: hex } : null);
        held = true;
      }
    }
    if (held) f.pinned.push(id);
    return;
  }
  let moved = false;
  if (archetype.background?.dark !== true) {
    const path = linkedPath(frame, 'bg');
    const values = path ? themeValues(f, path) : null;
    const hex = hex6(frame.bg);
    if (path && values && !varies(values) && hex && typeof frame.bg === 'string') {
      const surface = SURFACE_TOKENS.find((candidate) => {
        const v = themeValues(f, candidate);
        return !!v && varies(v) && tokenColour(f.cached, candidate) === hex;
      });
      if (surface) {
        setColourLink(frame, 'bg', { ref: `{${surface}}`, value: frame.bg });
        moved = true;
      }
    }
  }
  const others = f.cached.colors().map((c) => c.path).filter((p) => /^color\.(semantic|role)\./.test(p) && !INK_TOKENS.includes(p)).sort();
  let held = false;
  for (const row of layers) {
    if (row.kind !== 'text' || typeof row.fg !== 'string') continue;
    const path = linkedPath(row, 'fg');
    const values = path ? themeValues(f, path) : null;
    const grounds = path && values ? rowColours(f, groundRowUnder(row, frame, layers), 'bg') : null;
    const ink = hex6(row.fg);
    if (!path || !values || !grounds || !ink) continue;
    if (varies(values)) {
      // An ink that follows the theme on a ground that never changes (a light statement
      // slide with no dark form): where it would stop reading, it is held at the master's.
      if (varies(grounds) || values.every((c, t) => contrastRatio(c, grounds[t]!) >= THEME_INK_CONTRAST)) continue;
      const hex = hex6(f.authored?.(path)) ?? ink;
      if (contrastRatio(hex, grounds[0]!) < THEME_INK_CONTRAST) continue;
      row.fg = hex;
      const constant = constantPathFor(f, hex);
      setColourLink(row, 'fg', constant ? { ref: `{${constant}}`, value: hex } : null);
      held = true;
      continue;
    }
    if (!varies(grounds)) continue;
    const pick = [...INK_TOKENS, ...others].find((candidate) => {
      const v = themeValues(f, candidate);
      return !!v && varies(v) && tokenColour(f.cached, candidate) === ink
        && v.every((c, t) => contrastRatio(c, grounds[t]!) >= THEME_INK_CONTRAST);
    });
    if (pick) {
      setColourLink(row, 'fg', { ref: `{${pick}}`, value: row.fg });
      moved = true;
      continue;
    }
    const faint = grounds.map((g, t) => (contrastRatio(ink, g) < THEME_INK_CONTRAST ? t : -1)).filter((t) => t >= 0);
    if (faint.length) f.stranded.push({ id: String(row.id), hex: ink, themes: faint });
  }
  if (moved) f.relinked.push(id);
  if (held) f.inkHeld.push(id);
}

/** The accent token for emphasis in a slot of a document for every theme: one that differs from the slot's ink and reads on its ground in each theme. */
function themeAccentFor(f: ThemeFollow, row: DesignBoxRowV1, frame: Rec, layers: readonly DesignBoxRowV1[]): { path: string; hex: string } | null {
  const inks = rowColours(f, row, 'fg');
  const grounds = rowColours(f, groundRowUnder(row, frame, layers), 'bg');
  if (!inks || !grounds) return null;
  for (const path of ACCENT_TOKENS) {
    const values = themeValues(f, path);
    const hex = tokenColour(f.cached, path);
    if (!values || !hex) continue;
    if (values.every((c, t) => c !== inks[t] && contrastRatio(c, grounds[t]!) >= ACCENT_CONTRAST)) return { path, hex };
  }
  return null;
}

/** What following every theme did, as report notes. */
function themeFollowNotes(f: ThemeFollow): ComposeReportNoteV1[] {
  const out: ComposeReportNoteV1[] = [];
  if (f.relinked.length) {
    out.push({
      path: '/themes', code: 'compose.theme.linked',
      message: `On ${plural(f.relinked.length, 'slide')} (${f.relinked.join(', ')}) a ground or ink the master takes from a colour that never changes was linked to the theme's own token of the same colour, so it follows the theme.`,
    });
  }
  if (f.pinned.length) {
    out.push({
      path: '/themes', code: 'compose.theme.held',
      message: `${plural(f.pinned.length, 'slide is', 'slides are')} dark by design (${f.pinned.join(', ')}), so ${f.pinned.length === 1 ? 'its' : 'their'} colours stay the master's in every theme.`,
    });
  }
  if (f.inkHeld.length) {
    out.push({
      path: '/themes', code: 'compose.theme.ink-held',
      message: `On ${plural(f.inkHeld.length, 'slide')} (${f.inkHeld.join(', ')}) the ground never changes with the theme and the master's ink does, so the ink is held at the master's colour where it would stop reading. Give the slide a ground that follows the theme (an under box with "bg": "{color.semantic.surface}") if it should change.`,
    });
  }
  for (const s of f.stranded) {
    out.push({
      path: '/themes', code: 'compose.theme.ink-fixed',
      message: `${s.id} is set in ${s.hex}, a colour that never changes, on a ground that follows the theme, and no theme token of that colour reads there in every theme; it falls below ${THEME_INK_CONTRAST}:1 in theme ${s.themes.map((t) => t + 1).join(', ')}. Set the slot's fg to a token reference.`,
    });
  }
  return out;
}

/** Is this a token reference a colour field may hold (`{path}` or the web field's `var(--brand-token-…)`)? */
function isColourRef(value: string): boolean {
  const v = value.trim();
  return (v.startsWith('{') && v.endsWith('}')) || v.includes('--brand-token-');
}

/** Lower each slot row's colour references and `{@path …|}` runs to literals plus links; refuse one that does not resolve. */
function lowerSlotColours(rows: DesignBoxRowV1[], tokens: TokenSet, pointerOf: (row: DesignBoxRowV1) => string): void {
  for (const row of rows) {
    if (!hasDesignColourRefs([row as InputValue], COMPOSE_COLOUR_FIELDS, 'tokenLinks', false)) continue;
    const at = pointerOf(row);
    const [next] = normaliseDesignColourRefs([row as InputValue], COMPOSE_COLOUR_FIELDS, tokens, 'srgb', {
      refresh: false,
      onIssue: (issue) => {
        const field = issue.pointer.slice(issue.pointer.lastIndexOf('/') + 1);
        throw new Error(`${at}/${field}: ${issue.message}`);
      },
    });
    Object.assign(row, next as Rec);
  }
}

/** Design text with each run head's `#hex` token (any case) written as `@path`. */
function withRunRef(text: string, hex: string, path: string): string {
  const want = hex.toLowerCase();
  return text.replace(/\{([^|{}]+)\|/g, (whole, attrs: string) => {
    const toks = attrs.trim().split(/\s+/);
    if (!toks.some((t) => t.toLowerCase() === want)) return whole;
    return `{${toks.map((t) => (t.toLowerCase() === want ? `@${path}` : t)).join(' ')}|`;
  });
}

/**
 * Design text with the `@path` colour tokens taken out of its run heads (plan 291 M4),
 * the words and the other attributes as they were: what a measure or a comparison with
 * the source reads before the runtime lowers the runs. A head left with no attribute
 * becomes the plain words.
 */
export function withoutRunRefs(text: string): string {
  if (!text.includes('{@')) return text;
  return text.replace(/\{([^|{}]+)\|([^{}]*)\}/g, (whole, attrs: string, inner: string) => {
    const toks = attrs.trim().split(/\s+/);
    if (!toks.some((t) => t.startsWith('@'))) return whole;
    const rest = toks.filter((t) => !t.startsWith('@'));
    return rest.length ? `{${rest.join(' ')}|${inner}}` : inner;
  });
}

function tokenSetResolver(tokens: TokenSet, fallback: TokenResolver | undefined): TokenResolver {
  return (path) => {
    const result = resolveTokenBinding(tokens.get(path), { type: 'color', colorTarget: 'srgb' });
    if (result.status === 'linked' && typeof result.value === 'string' && result.value) return result.value.toLowerCase();
    return fallback?.(path);
  };
}

// ─── catalogue ───────────────────────────────────────────────────────────────

/**
 * The master's light archetypes as a compact catalogue: per archetype its dark twin,
 * ground, slots by key with kind, optional mark and slide-local px box at the master's
 * size (pass `masterAtSize(master, size)` for another page size), the cell count of a
 * repeat, and the layout library's keywords. Dark twins are reached through `dark`.
 * Content-sized `flow-cards-N-C` and `flow-columns-N-C` layouts are made on demand and
 * are not listed.
 */
export function composeArchetypeCatalog(master: SlideMasterV1): ComposeArchetypeV1[] {
  const ids = new Set(master.archetypes.map((a) => a.id));
  const twins = new Set(master.archetypes.map((a) => a.variants?.dark).filter((d): d is string => !!d));
  return master.archetypes
    .filter((a) => !a.variantOf && !twins.has(a.id))
    .map((a) => {
      const seen = new Map<string, number>();
      const slots = a.placeholders.map((ph) => {
        const n = (seen.get(ph.role) ?? 0) + 1;
        seen.set(ph.role, n);
        return {
          key: n === 1 ? ph.role : `${ph.role}#${n}`,
          role: ph.role,
          kind: ph.kind,
          optional: ph.optional === true,
          box: masterBoxToPx(master, ph.box),
        };
      });
      const groups = new Set(a.placeholders.map((ph) => ph.group).filter((g): g is string => g !== undefined));
      const keywords = findStructure(structureOf(a))?.keywords ?? [];
      const entry: ComposeArchetypeV1 = { id: a.id, name: a.name, ground: a.background?.dark === true ? 'dark' : 'light', slots };
      const dark = a.variants?.dark;
      if (dark && ids.has(dark)) entry.dark = dark;
      if (groups.size > 0) entry.cells = groups.size;
      if (keywords.length) entry.useWhen = keywords.join(', ');
      return entry;
    });
}
