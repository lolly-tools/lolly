// SPDX-License-Identifier: MPL-2.0
/**
 * type-compare.ts - the Type room's side-by-side compare stage (plan 97 section 7.2, M4).
 *
 * Nothing in this shell has ever let anyone SEE two faces before choosing one.
 * The brand editor's type panel is commit-then-look: a Google family installs
 * first and shows itself afterwards, and an uploaded file is only visible once
 * it is a stored asset. This stage is the answer - candidates from all three
 * sources stand next to each other on ONE editable specimen, at ONE size, and
 * nothing is installed until a card is chosen.
 *
 * PRESENTATION ONLY, ON PURPOSE. This module never writes a token, never stores
 * an asset and does not import user-fonts.ts. A press hands a `CompareChoice` to
 * `ctx.onSelect` and the caller persists it - `installGoogleFont` for a Google
 * family, `installFontFromBytes` for a file. That split is what keeps the stage
 * testable under jsdom, and it is the same seam the tray uses (a surface asks;
 * the room that owns the material commits).
 *
 * NETWORK. Google Fonts is the one egress in this whole studio, and it is
 * already consent-gated in the type panel. Every fetch here rides the SAME gate:
 * `ctx.consentGoogle()` must resolve true before a single request is made, and a
 * decline leaves the card saying so plainly rather than quietly falling back.
 * Once consent is given it holds for the mount, so the second Google candidate
 * previews without asking again. Nothing else in this file touches the network.
 *
 * PREVIEW FACES NEVER PERSIST. A previewed face is an in-memory `FontFace` added
 * to `document.fonts` under a session-scoped family name (`__ds-preview-<slug>-<n>`
 * - see `previewFamilyName`), and it is `delete`d when its card is removed or the
 * stage is torn down. It is not an asset, it is not in IndexedDB, and it does not
 * survive a reload. The serial in the name is not decoration: two cards can hold
 * the same family from different sources (a Google Inter beside an uploaded
 * Inter.ttf) and must never share one registration, or removing either would
 * blank the other.
 *
 * NO FACE PRETENDS TO BE ANOTHER. A card whose face has not loaded - fetching,
 * declined, failed - draws a SKELETON bar the height of the specimen instead of
 * setting the line in the interface face. A silent fallback here would be the
 * one unforgivable bug in a type comparison: you would choose a face you never
 * saw. The one card that does show the interface face is `no-source`, where
 * nothing is ever coming, and it says so in words. `select()` refuses anything
 * that is not `ready`, which is what makes the rule true rather than decorative
 * - the button is simply absent until then, never present and greyed out
 * (plan 182 section 6.2, "no dead primaries").
 *
 * A PRESS ALWAYS ANSWERS. The card row is rebuilt wholesale on every state
 * change, so a load that ends changes nothing but text in a subtree that was
 * just replaced - invisible to anyone not watching it. Two rules follow. Every
 * finished load is `announce`d once (ready, failed, declined), and the card
 * itself is focusable (`tabindex="-1"`, named by its family, described by its
 * state sentence) so the repaint has somewhere to put the keyboard that is NOT
 * the Remove button - pressing Preview must never leave the next Enter on
 * Delete. When the repaint does land on the card, the announcement is skipped:
 * the description says the same thing, and hearing it twice is worse than once.
 *
 * TWO HALVES, like trim-offer.ts.
 *   PURE - the candidate model (`admitCandidate`, the cap), the preview-family
 *   naming, the load state machine (`applyCardEvent`), the Google face pick
 *   (`pickPreviewFace`), the honesty facts read off a font file
 *   (`describeFaceBytes`), the default specimen text, and the markup
 *   (`compareCardsHtml`). All unit-tested in type-compare.test.ts.
 *   BROWSER - `mountTypeCompare`: the DOM, the FontFace registrations, the
 *   consent-gated fetch, the drop zone.
 *
 * COPY. Strings arrive as `ctx.t` / `ctx.tRaw` (the consuming file's i18n
 * bindings) so the stage can be mounted from any surface without reaching for
 * the runtime - trim-offer.ts's precedent.
 */

import '../../styles/parts/type-compare.css'; // .tycmp* rules - rides this module's lazy chunk

import { escape } from '../../utils.ts';
import { icon } from '../icons.ts';
import { announce } from '../../a11y.ts';
import { detectFontFormat, parseFontMetadata, readFontEmbedding, validateFontFile } from '../font-utils.ts';
import type { FontEmbedding, FontFormat } from '../font-utils.ts';
import { variableWeightRange } from './font-resolve.ts';
// Type-only, erased at build: the grammar helpers below speak the ownership
// report's own vocabulary without pulling its module (or user-fonts) into this
// lazy chunk.
import type { FaceState } from './ownership.ts';
import type { FontRole } from '../../user-fonts.ts';
import {
  GOOGLE_FAMILY_RE, POPULAR_FAMILIES, keepFaces, parseGoogleFontCss, resolveFamilySpec,
} from '../google-fonts.ts';
import type { GoogleFontFace } from '../google-fonts.ts';
import type { HostV1 } from '@lolly-tools/core/host-v1';

// ── Contract ─────────────────────────────────────────────────────────────────

/** The consuming file's `t`/`tRaw` (i18n.ts), injected - see the module note. */
export type TFn = (source: string, params?: Record<string, string | number>) => string;

/** Where a candidate came from. Equal citizens on the stage; the only thing the
 *  kind decides is how a preview is obtained and which install path applies. */
export type CompareKind = 'google' | 'upload' | 'tray';

export interface CompareCandidate {
  kind: CompareKind;
  /** The family as its source spells it. Shown verbatim. */
  family: string;
  /** An optional second line (a file name, a PDF's own label). */
  label?: string;
  /** The face itself, when the candidate carries one - an upload always does, a
   *  tray candidate does when its source had the bytes (a PDF-embedded font). */
  bytes?: Uint8Array;
  /** Honesty chips the SOURCE established and this stage only renders: SUBSET,
   *  a licence signal, a subsetted-PDF warning. Shown verbatim (escaped). */
  chips?: string[];
  /** Where it was found, for the provenance chip. */
  provenance?: string;
}

/** What a press on "Use this face" hands back. The stage has installed nothing. */
export interface CompareChoice {
  kind: CompareKind;
  family: string;
  label?: string;
  /** The candidate's own file, when it had one. */
  bytes?: Uint8Array;
  /** Which install path applies. `'bytes'` → installFontFromBytes. `'google'` →
   *  installGoogleFont: the previewed single face is a PREVIEW, not the install
   *  (the real one pulls the family's whole weight/slant ladder), so it is
   *  deliberately not handed over as bytes. */
  install: 'bytes' | 'google';
}

export interface TypeCompareCtx {
  host: HostV1;
  t: TFn;
  tRaw: TFn;
  /** The type tab's existing one-time Google Fonts consent. Must resolve true
   *  before anything is fetched; a true answer holds for the mount. */
  consentGoogle: () => Promise<boolean>;
  /** The caller persists. Throwing marks the press as failed and leaves the card
   *  standing so it can be tried again. */
  onSelect: (choice: CompareChoice) => Promise<void>;
  /** Candidates to open with (the tray hands its font candidates in here). */
  candidates?: CompareCandidate[];
}

export interface TypeCompare {
  /** Add one candidate. Refused (with a spoken reason) when it duplicates a card
   *  already on the stage or the stage is full. */
  addCandidate(c: CompareCandidate): void;
  teardown(): void;
}

// ── Pure: the candidate model ────────────────────────────────────────────────

/** How many faces can stand side by side. Past this the comparison stops being
 *  one - the cards are too narrow to judge a face, and the specimen line wraps
 *  differently in each, which is exactly the variable a comparison must hold
 *  still. Removing a card makes room; nothing is queued behind the cap. */
export const MAX_COMPARE_CARDS = 6;

/** A card's LOAD state. Orthogonal to `busy` (a select in flight), which is not
 *  part of this machine: a face is loaded or it is not, whatever the buttons are
 *  doing. */
export type CardState = 'idle' | 'loading' | 'ready' | 'failed';

/** Why a card is not showing its face. A code, not a sentence, so the model
 *  stays pure and the copy stays in one place (`reasonText`). */
export type CardReason = 'no-source' | 'declined' | 'fetch-failed' | 'decode-failed' | 'unsupported';

export interface CompareCard {
  /** Stable for the life of the stage; the id every data attribute carries. */
  id: string;
  /** Mount-scoped serial - what makes the preview family name unique. */
  seq: number;
  kind: CompareKind;
  family: string;
  label?: string;
  chips: string[];
  provenance?: string;
  state: CardState;
  reason?: CardReason;
  /** The `document.fonts` family this card's face is (or will be) registered
   *  under. Computed at admission so removal can always find it. */
  previewFamily: string;
  /** The candidate's own file, when it had one. */
  bytes?: Uint8Array;
  /** True when the face has to come off the network (a Google family, or a tray
   *  candidate whose source had no bytes). Decides whether the card needs the
   *  consent gate before it can show anything. */
  needsFetch: boolean;
  /** A select is in flight - the press is disabled, the card is not. */
  busy: boolean;
}

/** Lowercase, alphanumeric-and-dashes. Also the safety gate before a family name
 *  reaches a CSS `font-family` value: the output charset cannot close a quote or
 *  open a declaration. */
export function slugFamily(family: string): string {
  return String(family ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'face';
}

/**
 * The session-scoped family a preview registers under. The `__ds-preview-`
 * prefix says what it is to anyone reading `document.fonts` in a devtools
 * console, and the two serials keep two cards of the SAME family on separate
 * registrations - see the module note.
 *
 * BOTH serials are required, and the mount one is the subtle half.
 * `document.fonts` is per DOCUMENT, not per mount: a card serial alone makes
 * `__ds-preview-inter-1` in one stage collide with `__ds-preview-inter-1` in a
 * second stage mounted anywhere else on the page, and two registrations of one
 * family name are ambiguous - the specimen could paint the OTHER stage's bytes.
 * The Type room happens to keep one stage at a time, but `mountTypeCompare` is
 * exported and caller-agnostic, so the guarantee belongs here rather than in
 * whoever calls it.
 *
 * The result is also an id namespace (`<name>-note`, `<name>-fallback`): both
 * numbers and `slugFamily`'s [a-z0-9-] output are safe in an id, in an attribute
 * selector, and in a CSS `font-family` value.
 */
export function previewFamilyName(family: string, seq: number, mount = 0): string {
  return `__ds-preview-${slugFamily(family)}-${mount}-${seq}`;
}

/** Families we hold a fetchable source for, lowercased once. The same rule and
 *  the same list as tray-ui's `isFetchableFamily` - computed here rather than
 *  imported from it, because importing the tray SURFACE would drag its panel and
 *  its bottom-sheet driver into the Type room's chunk. */
const KNOWN_FAMILIES = new Set(POPULAR_FAMILIES.map((f) => f.trim().toLowerCase()));

/**
 * Is there a source we can actually fetch this face from?
 *
 * The answer differs by where the candidate came from, and that is deliberate:
 *
 *  - `google` - someone picked this family out of the Google picker BY NAME. The
 *    curated `POPULAR_FAMILIES` list is a suggestion list, not an availability
 *    list (its own header says so), so refusing a family merely because it is
 *    not on it would refuse real Google fonts. The gate is the same one
 *    `fetchGoogleFont` uses: the css2 name charset.
 *  - `tray` - an arbitrary family name a site or a PDF happened to mention.
 *    Firing a doomed request at every "Helvetica Neue LT Std 57" is egress spent
 *    on nothing, so an unrecognised family is reported honestly instead, exactly
 *    as the tray reports it.
 */
export function hasFetchableSource(kind: CompareKind, family: string): boolean {
  const name = String(family ?? '').trim();
  if (!name) return false;
  return kind === 'google' ? GOOGLE_FAMILY_RE.test(name) : KNOWN_FAMILIES.has(name.toLowerCase());
}

/** Why a candidate was turned away. `invalid` is a candidate with nothing to
 *  show (no family, or an upload with no bytes). */
export type AdmitRefusal = 'cap' | 'duplicate' | 'invalid';

export type AdmitResult =
  | { ok: true; card: CompareCard }
  | { ok: false; refusal: AdmitRefusal };

/**
 * Turn a candidate into a card, or say why not. Pure: the caller owns the list
 * and the serial.
 *
 * Order matters. A duplicate is reported as a duplicate even when the stage is
 * also full, because "it is already here" is the useful answer and "remove one
 * first" would send someone hunting for room they do not need.
 */
export function admitCandidate(
  cards: readonly CompareCard[],
  candidate: CompareCandidate,
  seq: number,
  mount = 0,
): AdmitResult {
  const family = String(candidate?.family ?? '').trim();
  if (!family) return { ok: false, refusal: 'invalid' };
  const bytes = candidate.bytes && candidate.bytes.byteLength > 0 ? candidate.bytes : undefined;
  if (candidate.kind === 'upload' && !bytes) return { ok: false, refusal: 'invalid' };

  const key = `${candidate.kind}:${family.toLowerCase()}`;
  if (cards.some((c) => `${c.kind}:${c.family.toLowerCase()}` === key)) {
    return { ok: false, refusal: 'duplicate' };
  }
  if (cards.length >= MAX_COMPARE_CARDS) return { ok: false, refusal: 'cap' };

  const needsFetch = !bytes;
  // A family we hold no fetchable source for is admitted, not hidden: it is a
  // real thing the source found, and the card is where we say we cannot show it.
  const fetchable = !needsFetch || hasFetchableSource(candidate.kind, family);

  return {
    ok: true,
    card: {
      id: `tycmp-card-${seq}`,
      seq,
      kind: candidate.kind,
      family,
      ...(candidate.label ? { label: candidate.label } : {}),
      chips: (candidate.chips ?? []).map((chip) => String(chip)),
      ...(candidate.provenance ? { provenance: candidate.provenance } : {}),
      state: fetchable ? 'idle' : 'failed',
      ...(fetchable ? {} : { reason: 'no-source' as CardReason }),
      previewFamily: previewFamilyName(family, seq, mount),
      ...(bytes ? { bytes } : {}),
      needsFetch,
      busy: false,
    },
  };
}

/** What can happen to a card's face. */
export type CardEvent =
  | { type: 'start' }
  /** `chips` are facts the FETCHED file stated (its weight axis), which a Google
   *  card cannot know before the bytes arrive. Added to the card's own, never
   *  replacing them, and only for a card that had none of its own already. */
  | { type: 'ready'; chips?: readonly string[] }
  | { type: 'fail'; reason: CardReason }
  | { type: 'declined' };

/**
 * The load state machine. Returns the SAME object when the event does not apply,
 * so a stale async resolution landing on a card that has moved on is a provable
 * no-op rather than a repaint.
 *
 * `no-source` is terminal: there is nothing to retry against, and a Retry button
 * that cannot succeed is worse than no button.
 */
export function applyCardEvent(card: CompareCard, ev: CardEvent): CompareCard {
  switch (ev.type) {
    case 'start': {
      if (card.state === 'loading' || card.state === 'ready') return card;
      if (card.state === 'failed' && card.reason === 'no-source') return card;
      const { reason: _drop, ...rest } = card;
      return { ...rest, state: 'loading' };
    }
    case 'ready': {
      if (card.state !== 'loading') return card;
      const { reason: _drop, ...rest } = card;
      const extra = (ev.chips ?? []).map((chip) => String(chip)).filter(Boolean);
      return { ...rest, state: 'ready', ...(extra.length ? { chips: [...card.chips, ...extra] } : {}) };
    }
    case 'fail':
      if (card.state !== 'loading') return card;
      return { ...card, state: 'failed', reason: ev.reason };
    case 'declined':
      // A decline is not a failure: nothing broke, nothing was fetched, and the
      // offer stands. Back to idle so the Preview button returns.
      if (card.state !== 'loading') return card;
      return { ...card, state: 'idle', reason: 'declined' };
    default:
      return card;
  }
}

// ── Pure: what a font file says about itself ─────────────────────────────────

/** The honesty facts a font file states. `embeddingReadable` is the difference
 *  between "this font states no restriction" and "we cannot read what it
 *  states" - a WOFF/WOFF2 wrapper hides the OS/2 table from us, and reporting
 *  that as "no restriction stated" would be a claim the file never made. */
export interface FaceFacts {
  format: FontFormat;
  family: string | null;
  /** `OS/2.usWeightClass` - the DEFAULT INSTANCE's weight, which for a variable
   *  face is one rung of the ladder it carries. Read `weightRange` first. */
  weight: number | null;
  /** The `fvar` `wght` axis as a CSS descriptor ("100 900"), or null for a
   *  static face. A variable font previewed at its default instance would show
   *  Thin beside a Google candidate's 400 - the one variable a comparison must
   *  hold still. See font-resolve.ts's `variableWeightRange`. */
  weightRange: string | null;
  style: 'normal' | 'italic' | 'oblique' | null;
  embedding: FontEmbedding;
  embeddingReadable: boolean;
  noSubsetting: boolean;
  bitmapOnly: boolean;
}

/**
 * Read a dropped file's own statements - format, name-table metadata, the `fvar`
 * weight axis and `OS/2.fsType` - through the shipped pure validators
 * (lib/font-utils.ts, font-resolve.ts). Nothing here is inferred from the file
 * name.
 *
 * A WOFF/WOFF2 wrapper is NOT opened, which is why `embeddingReadable` exists.
 * Unwrapping would mean pulling the woff2 decompressor (a wasm module) or the
 * engine's woff reader into a preview that only wants to draw a chip, so this
 * half stays sync and pure and says what it could not read. The install path
 * does unwrap, and records the face's real statement in the stored asset's meta
 * (`user-fonts.ts` `installFontFromBytes`) where it persists - so the fact is
 * kept, on the surface that keeps things.
 */
export function describeFaceBytes(bytes: Uint8Array): FaceFacts {
  const buffer = bytes.slice().buffer as ArrayBuffer;
  const format = detectFontFormat(buffer);
  const readable = format === 'ttf' || format === 'otf';
  const meta = readable ? parseFontMetadata(buffer) : null;
  const embed = readFontEmbedding(buffer);
  return {
    format,
    family: meta?.family ?? null,
    weight: meta?.weight ?? null,
    weightRange: readable ? variableWeightRange(buffer) : null,
    style: meta?.style ?? null,
    embedding: embed.permission,
    embeddingReadable: readable,
    noSubsetting: embed.noSubsetting,
    bitmapOnly: embed.bitmapOnly,
  };
}

const FORMAT_CHIP: Record<FontFormat, string> = {
  ttf: 'TTF', otf: 'OTF', woff: 'WOFF', woff2: 'WOFF2', unknown: '',
};

/**
 * The chips a dropped file earns. Every one is something the FILE said.
 *
 * These are TEXT, not markup: `chipsHtml` escapes each one on its way to the
 * sink, so the translator passed in must be the NON-escaping one (`tRaw`).
 * Handing it `t` would escape a family or a file name here and escape it again
 * there, and "Q&A Sans" would reach the page as "Q&amp;A Sans".
 */
export function chipsFromFacts(facts: FaceFacts, t: TFn): string[] {
  const chips: string[] = [];
  const fmt = FORMAT_CHIP[facts.format];
  if (fmt) chips.push(fmt);
  // The axis, when there is one: "Weight 100" off a variable font's default
  // instance is true of one rung and misleading about the file.
  if (facts.weightRange) chips.push(t('Variable weight {range}', { range: facts.weightRange.replace(' ', '–') }));
  else if (facts.weight != null) chips.push(t('Weight {n}', { n: facts.weight }));
  if (facts.style === 'italic' || facts.style === 'oblique') chips.push(t('Italic'));
  if (!facts.embeddingReadable) {
    chips.push(t('Licence flags not readable in this format'));
  } else if (facts.embedding === 'restricted') {
    chips.push(t('Embedding not permitted'));
  } else if (facts.embedding === 'preview-print') {
    chips.push(t('Preview and print only'));
  } else if (facts.embedding === 'unknown') {
    chips.push(t('Licence not stated'));
  }
  if (facts.noSubsetting) chips.push(t('Subsetting not permitted'));
  if (facts.bitmapOnly) chips.push(t('Bitmap embedding only'));
  return chips;
}

// ── Pure: picking one Google face to preview ─────────────────────────────────

/** Distance from `target` to a css2 weight descriptor - a static number, or a
 *  variable range ("100 900"), which costs nothing when it covers the target. */
function weightDistance(weight: string, target: number): number {
  const nums = String(weight ?? '').trim().split(/\s+/).map(Number).filter((n) => Number.isFinite(n));
  if (nums.length === 0) return Number.POSITIVE_INFINITY;
  if (nums.length === 1) return Math.abs((nums[0] as number) - target);
  const lo = Math.min(...nums);
  const hi = Math.max(...nums);
  return target < lo ? lo - target : target > hi ? target - hi : 0;
}

/**
 * ONE face out of a family's css2 blocks - upright, latin, closest to 400 (a
 * variable range covering 400 wins outright).
 *
 * A preview downloads one file, not the family. `fetchGoogleFont` pulls every
 * kept subset and slant because it is building a permanent on-device install;
 * a look at a face is not worth a few hundred KB, and the install path is the
 * caller's job anyway. The spec LADDER is still the shipped one
 * (`resolveFamilySpec`) - only the download is narrowed.
 */
export function pickPreviewFace(faces: readonly GoogleFontFace[]): GoogleFontFace | null {
  if (!faces.length) return null;
  const upright = faces.filter((f) => f.style !== 'italic');
  const pool = upright.length ? upright : [...faces];
  const latin = pool.filter((f) => f.subset === 'latin');
  const from = latin.length ? latin : pool;
  let best: GoogleFontFace | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (const face of from) {
    const score = weightDistance(face.weight, 400);
    if (score < bestScore) { best = face; bestScore = score; }
  }
  return best;
}

// ── Pure: the specimen's opening text ────────────────────────────────────────

/** Labels the tokens bridge writes when nobody has named anything (see
 *  bridge/tokens.ts `meta: { name: opts.label ?? 'Brand tokens' }` and
 *  user-fonts.ts's 'My brand'). They are placeholders, not names, and setting a
 *  specimen to one would put a stranger's default in front of the user. */
const PLACEHOLDER_NAMES = new Set(['brand tokens', 'my brand', 'untitled', 'brand']);

/** A name worth putting on the specimen, or null. */
export function usableSystemName(raw: unknown): string | null {
  const name = typeof raw === 'string' ? raw.trim() : '';
  if (!name || name.length > 48) return null;
  return PLACEHOLDER_NAMES.has(name.toLowerCase()) ? null : name;
}

/**
 * What the specimen line opens with: the design system's own name when it has
 * one (the most useful string anyone can set type in), else a pangram.
 */
export function defaultSpecimen(systemName: string | null, t: TFn): string {
  return usableSystemName(systemName) ?? t('Sphinx of black quartz, judge my vow');
}

/** The installed tokens asset's label. Duck-typed through the same narrow cast
 *  the Overview room uses - these are web-shell extensions, absent from the
 *  tool-facing HostV1 type. Never throws: no name is a fine answer. */
export async function readSystemName(host: HostV1): Promise<string | null> {
  const assets = host?.assets as unknown as {
    _findMetaByType?(type: string): Promise<{ name?: string; meta?: Record<string, unknown> } | null>;
  } | undefined;
  try {
    const meta = await assets?._findMetaByType?.('tokens');
    const nested = meta?.meta?.['name'];
    return usableSystemName(nested) ?? usableSystemName(meta?.name);
  } catch {
    return null; // discovery unavailable - the pangram is a fine specimen
  }
}

// ── Pure: markup ─────────────────────────────────────────────────────────────

function reasonText(reason: CardReason, t: TFn): string {
  switch (reason) {
    case 'no-source': return t('No source we can fetch for this family. A font file installs it.');
    // Names the third party, because that is the fact a decline was about.
    case 'declined': return t('Not fetched. Nothing was sent to Google.');
    case 'fetch-failed': return t('Could not fetch this face from Google Fonts.');
    case 'decode-failed': return t('This file did not load as a font.');
    case 'unsupported': return t('This browser cannot preview a font file.');
    default: return '';
  }
}

const KIND_CHIP: Record<CompareKind, (t: TFn) => string> = {
  google: (t) => t('Google Fonts'),
  upload: (t) => t('From a file'),
  tray: (t) => t('From a source'),
};

/**
 * Two kinds of chip, two safeties, and mixing them up is how a family name ends
 * up on the page as "Q&amp;A Sans".
 *
 * A KIND label and the provenance line are TRANSLATOR OUTPUT: `t()` escapes its
 * own interpolated params (i18n.ts) and the catalog string itself is the
 * documented raw boundary, so they reach the sink exactly as `t()` returned
 * them. The source's own chips are untrusted text with no such guarantee, so
 * they go through `escape()` here. Escaping the first group as well would escape
 * the ampersand twice.
 */
function chipsHtml(card: CompareCard, t: TFn): string {
  const html = [
    `<li class="tycmp-chip">${KIND_CHIP[card.kind](t)}</li>`,
    ...card.chips.map((chip) => `<li class="tycmp-chip">${escape(chip)}</li>`),
  ];
  if (card.provenance) {
    html.push(`<li class="tycmp-chip">${t('from {source}', { source: card.provenance })}</li>`);
  }
  return html.join('');
}

/** The two sentences under the specimen, addressed so a card can point at them.
 *  `previewFamily` is the per-card, per-MOUNT token (see previewFamilyName), so
 *  these stay unique even with a second stage open in the same document. */
const fallbackId = (card: CompareCard): string => `${card.previewFamily}-fallback`;
const noteId = (card: CompareCard): string => `${card.previewFamily}-note`;

/** The sentence under the specimen. Empty on a `ready` card: a face you can see
 *  needs no explanation. */
function noteText(card: CompareCard, t: TFn): string {
  if (card.state === 'loading') {
    return card.needsFetch ? t('Fetching from Google…') : t('Reading the file…');
  }
  if (card.reason) return reasonText(card.reason, t);
  // Transient since plan 182 (a fetchable card previews on the press that admits
  // it), but reachable - a stage seeded with candidates it cannot fetch yet.
  return card.state === 'idle' ? t('Not fetched yet.') : '';
}

/**
 * One card.
 *
 * ONE PRIMARY PER STATE, AND NEVER A DISABLED ONE (plan 182 section 6.2). The old
 * card carried "Use this face" in every state and greyed it out in four of
 * them, so the loudest thing on a candidate a person had just asked for was a
 * dead button - read as "this is broken" rather than as "press the other one",
 * which was a ghost button beside it. Now the state decides the button:
 *
 *   loading   skeleton  "Fetching from Google…"            (no button)
 *   ready     the face  -                                  Use this face
 *   declined  skeleton  "Not fetched. Nothing was sent…"   Fetch from Google
 *   failed    skeleton  the reason                         Try again
 *   no-source specimen  "No source we can fetch…"          (no button)
 *   idle      skeleton  "Not fetched yet."                 Fetch from Google
 *
 * `select()` keeps its `state !== 'ready'` guard, and that guard - not an
 * attribute - is what makes a face nobody has seen unchoosable.
 *
 * THE SKELETON IS NOT A FALLBACK. A specimen set in the interface face is the
 * one unforgivable bug in a type comparison (see the module note), and a bar of
 * the right height says "nothing here yet" without drawing a single letter in
 * the wrong face. The exception is `no-source`, where nothing is ever coming:
 * there the interface face is all there is, and the card says so in words.
 */
function cardHtml(card: CompareCard, text: string, t: TFn): string {
  const ready = card.state === 'ready';
  const noSource = card.reason === 'no-source';
  // The face only paints when it is REALLY loaded.
  const style = ready ? ` style="font-family:'${escape(card.previewFamily)}'"` : '';
  const note = noteText(card, t);
  const retry = card.state === 'failed' && !noSource && card.reason !== 'unsupported';
  // Idle is the pre-fetch state, declined or not: both offer the same press, and
  // a decline is not a refusal - somebody may change their mind on the card.
  const fetch = card.state === 'idle' && card.needsFetch;
  // t(), NOT escape(t()): the translator has already escaped the family it
  // interpolated, and escaping that again is what puts "&amp;amp;" in an
  // accessible name.
  const remove = t('Remove {family}', { family: card.family });
  // What the card is, and why it is in the state it is in. The <article> is the
  // one thing an AT user can land on that is not a button, and a loading card
  // has no button at all - so the description belongs here, where the keyboard
  // can always reach it. It is focusable programmatically (tabindex="-1") so a
  // repaint that destroys the pressed control can hand the keyboard back to the
  // card rather than to its Remove.
  const describedBy = [noSource ? fallbackId(card) : '', note ? noteId(card) : ''].filter(Boolean).join(' ');
  const specimen = ready || noSource
    ? `<p class="tycmp-specimen" data-tycmp-specimen${style} aria-hidden="true">${escape(text)}</p>`
    : `<div class="tycmp-skel" aria-hidden="true"></div>`;

  return `
    <article class="tycmp-card" data-tycmp-card="${escape(card.id)}" data-tycmp-state="${escape(card.state)}"
      tabindex="-1" aria-label="${escape(card.family)}"${describedBy ? ` aria-describedby="${escape(describedBy)}"` : ''}>
      <header class="tycmp-card-head">
        <span class="tycmp-glyph" aria-hidden="true">${icon('font', { size: 16 })}</span>
        <span class="tycmp-family">${escape(card.family)}</span>
        <button type="button" class="tycmp-x" data-tycmp-remove="${escape(card.id)}"
          aria-label="${remove}" title="${remove}">${icon('close', { size: 14 })}</button>
      </header>
      ${card.label ? `<p class="tycmp-label">${escape(card.label)}</p>` : ''}
      ${specimen}
      ${noSource ? `<p class="tycmp-fallback" id="${escape(fallbackId(card))}">${t('Shown in the interface face.')}</p>` : ''}
      ${note ? `<p class="tycmp-note" id="${escape(noteId(card))}">${escape(note)}</p>` : ''}
      <ul class="tycmp-chips" role="list">${chipsHtml(card, t)}</ul>
      <div class="tycmp-acts">
        ${fetch ? `<button type="button" class="btn btn--primary btn--sm" data-tycmp-preview="${escape(card.id)}">${t('Fetch from Google')}</button>` : ''}
        ${retry ? `<button type="button" class="btn btn--primary btn--sm" data-tycmp-preview="${escape(card.id)}">${t('Try again')}</button>` : ''}
        ${ready ? `<button type="button" class="btn btn--primary btn--sm" data-tycmp-select="${escape(card.id)}"${card.busy ? ' aria-busy="true"' : ''}>${t('Use this face')}</button>` : ''}
      </div>
    </article>`;
}

/**
 * The card row as markup - pure, so the escaping, the per-state controls and the
 * "does this card paint its face" decision are testable without a DOM
 * (trayHtml's precedent). The scaffold around it - the specimen field, the size
 * control, the drop zone - is the mount's, because none of it changes with the
 * cards.
 */
export function compareCardsHtml(cards: readonly CompareCard[], text: string, t: TFn): string {
  return cards.map((card) => cardHtml(card, text, t)).join('');
}

// ── Pure: the ownership grammar the Type room paints with (plan 182 sections 4.2, 6.5) ──
//
// The room's four role cards and their collapsed pills say one thing each: which
// state this role's face is in. `reportOwnership` (ownership.ts) decides the
// state; these turn it into the words, so the strings live beside the stage they
// belong to and are testable without booting the room.
//
// TEXT, NOT MARKUP. Every return here is written with `textContent` - the family
// is a name a person typed or a font file stated, and the one place it could
// meet a markup sink is the caller's, which uses textContent instead. Hand these
// the NON-escaping translator (`tRaw`), for the same reason `chipsFromFacts`
// takes it.
//
// The two imports are TYPE-ONLY and erase at build, so the stage still pulls no
// user-fonts or brand-doc code into its lazy chunk.

/** One card's face line: the words, plus the "Starter" pill when the face is one
 *  nobody chose. An empty `tag` means no pill. */
export interface FaceLine { text: string; tag: string }

/**
 * What a role card says about its face.
 *
 *   own        the family, and nothing else - it is the person's
 *   inherited  the family plus the Starter pill: a real face, chosen by nobody
 *   follows    the arrow and the role it defers to (only display/italic can)
 *   unset      mono falls through to the starter mono; anything else that still
 *              resolves to a face is showing a starter one; a role resolving to
 *              nothing at all is "Not set"
 *
 * The `follows` line names Primary rather than the resolved family on purpose:
 * a chain is a different fact from a choice, and restating "SUSE" on three cards
 * was the defect (plan 182 T2).
 */
export function faceLine(role: FontRole, face: FaceState, t: TFn): FaceLine {
  const family = String(face?.family ?? '').trim();
  switch (face?.state) {
    case 'own': return { text: family, tag: '' };
    case 'inherited': return { text: family, tag: t('Starter') };
    case 'follows': return { text: t('↳ follows Primary'), tag: '' };
    default:
      if (role === 'mono') return { text: t('↳ follows the starter mono'), tag: '' };
      return family ? { text: family, tag: t('Starter') } : { text: t('Not set'), tag: '' };
  }
}

/**
 * The same face, on one line, for the strip the cards collapse to while the
 * stage is open (plan 182 section 6.6). The card being chosen for says so
 * instead: it is the one the stage below belongs to.
 */
export function collapsedFaceText(role: FontRole, face: FaceState, t: TFn, choosing = false): string {
  if (choosing) return t('choosing…');
  const line = faceLine(role, face, t);
  return line.tag ? `${line.text} · ${line.tag}` : line.text;
}

/**
 * The pinned families offered as one-press previews under the search field
 * (plan 182 section 6.4), minus anything already serving a role or installed
 * here - a chip for the face you are already using previews nothing.
 *
 * `max` is six because six is what fits on one row beside the "Pinned" label,
 * and the stage's own cap is six cards.
 */
export function pinnedFaces(pinned: readonly string[], taken: readonly string[] = [], max = 6): string[] {
  const skip = new Set(taken.map((f) => String(f ?? '').trim().toLowerCase()).filter(Boolean));
  const out: string[] = [];
  for (const family of pinned) {
    const name = String(family ?? '').trim();
    const key = name.toLowerCase();
    if (!name || skip.has(key)) continue;
    skip.add(key);           // the pinned list may repeat a family; the chips may not
    out.push(name);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * Which card the stage is moved in after (plan 182 section 6.6): the index of
 * the role that opened it, or -1 for the Fonts panel's "Add a face", which
 * belongs to no card and goes back after the strip.
 */
export function stageAfterIndex(roles: readonly string[], role: string | null): number {
  return role ? roles.indexOf(role) : -1;
}

// ── Browser: FontFace plumbing ───────────────────────────────────────────────

interface FontSetLike {
  add(face: FontFace): void;
  delete(face: FontFace): boolean;
}

/** `document.fonts`, when the document has one. jsdom does not. */
function fontSet(doc: Document): FontSetLike | null {
  const set = (doc as unknown as { fonts?: FontSetLike }).fonts;
  return set && typeof set.add === 'function' && typeof set.delete === 'function' ? set : null;
}

type FontFaceCtor = new (family: string, source: BufferSource, descriptors?: FontFaceDescriptors) => FontFace;

/** Read at CALL time, never at module load: a stage can be mounted into a
 *  document whose window gained the constructor later, and the tests stub it. */
function fontFaceCtor(): FontFaceCtor | null {
  const ctor = (globalThis as { FontFace?: unknown }).FontFace;
  return typeof ctor === 'function' ? ctor as FontFaceCtor : null;
}

/**
 * Register one face for preview under `family` and wait for it to actually
 * decode. Throws when the engine cannot do this at all, and when the bytes are
 * not a font - both of which the caller turns into an honest card state.
 */
async function loadPreviewFace(
  doc: Document, family: string, bytes: Uint8Array, descriptors: FontFaceDescriptors,
): Promise<FontFace> {
  const Ctor = fontFaceCtor();
  const set = fontSet(doc);
  if (!Ctor || !set) throw new Error('no-fontface');
  // slice(), not the view: a Uint8Array can be a window onto a larger buffer and
  // FontFace would read the whole thing.
  const face = new Ctor(family, bytes.slice().buffer as ArrayBuffer, descriptors);
  await face.load();
  set.add(face);
  return face;
}

// ── Browser: the stage ───────────────────────────────────────────────────────

const SIZE_MIN = 20;
const SIZE_MAX = 84;
const SIZE_DEFAULT = 44;

const FONT_ACCEPT = '.ttf,.otf,.woff,.woff2,font/ttf,font/otf,font/woff,font/woff2';

/** Attribute-selector quoting for our OWN ids (`tycmp-card-<n>`), which contain
 *  nothing exotic. Belt and braces, so a future id scheme cannot break a query. */
function cssQuote(value: string): string {
  return value.replace(/["\\]/g, '\\$&');
}

let mountSeq = 0;

/**
 * Mount the compare stage into `el`.
 *
 * The stage does NOT own a dialog - the caller decides what holds it (the Type
 * room, a sheet on a phone) and therefore owns closing. Escape here does the one
 * thing that IS this module's: it cancels an IN-PROGRESS edit of the specimen
 * field, restoring the text the field held when it was focused. It never
 * commits, and it never closes something it did not open - and, just as
 * important, it only STOPS the key while there is an edit to cancel. With
 * nothing to cancel (or on the second press, after the first restored the text)
 * Escape belongs to whatever holds the stage, so it bubbles and closes it. A
 * field that swallowed every Escape would make the surrounding panel
 * uncloseable by keyboard from the one control the stage focuses first.
 */
export function mountTypeCompare(el: HTMLElement, ctx: TypeCompareCtx): TypeCompare {
  const { t, tRaw } = ctx;
  const doc = el.ownerDocument;
  const uid = ++mountSeq;
  const textId = `tycmp-text-${uid}`;
  const sizeId = `tycmp-size-${uid}`;
  const dropId = `tycmp-drop-${uid}`;

  let cards: CompareCard[] = [];
  let cardSeq = 0;
  let alive = true;
  let consented = false;
  let specimen = defaultSpecimen(null, t);
  /** True once someone has typed: a late name read must not overwrite an edit. */
  let specimenTouched = false;

  /** Live registrations, so teardown and removal can always find the face. */
  const faces = new Map<string, FontFace>();
  /** Per-card generation, bumped on every start/removal - a fetch that resolves
   *  after its card was removed or restarted must not paint anything. */
  const gen = new Map<string, number>();

  const ac = new AbortController();
  const { signal } = ac;

  // Sink 1 of 2: the scaffold. Every interpolation is a t() literal, an icon()
  // constant, a NUMBER, or an escape()d id - no candidate data reaches it.
  el.innerHTML = `
    <section class="tycmp" data-tycmp>
      <div class="tycmp-bar">
        <div class="tycmp-field">
          <label class="field-label" for="${escape(textId)}">${t('Specimen text')}</label>
          <input class="field-input tycmp-text" id="${escape(textId)}" type="text"
            autocomplete="off" spellcheck="false" data-tycmp-text value="${escape(specimen)}">
        </div>
        <div class="tycmp-field tycmp-field--size">
          <label class="field-label" for="${escape(sizeId)}">${t('Size')}</label>
          <input class="tycmp-size" id="${escape(sizeId)}" type="range" data-tycmp-size
            min="${SIZE_MIN}" max="${SIZE_MAX}" step="1" value="${SIZE_DEFAULT}">
          <output class="tycmp-size-out" for="${escape(sizeId)}" data-tycmp-size-out>${SIZE_DEFAULT}</output>
        </div>
      </div>
      <div class="tycmp-cards" data-tycmp-cards></div>
      ${/* Under the cards, not over them (plan 182 section 6.4): it describes the
             comparison, so it reads as a footnote to the row it is about rather
             than as a paragraph between the controls and the faces. */''}
      <p class="tycmp-lede">${t('Every face is set at the same size on the same line. Nothing installs until you choose one.')}</p>
      <p class="tycmp-empty" data-tycmp-empty>${t('No faces to compare yet. Drop a font file, or bring one in from a source.')}</p>
      <label class="tycmp-drop" for="${escape(dropId)}" data-tycmp-drop>
        <span class="tycmp-drop-ic" aria-hidden="true">${icon('upload', { size: 20 })}</span>
        <span class="tycmp-drop-text">${t('Drop a font file here, or browse. TTF, OTF, WOFF, WOFF2.')}</span>
        <input class="tycmp-drop-input" id="${escape(dropId)}" type="file" data-tycmp-file
          accept="${escape(FONT_ACCEPT)}" multiple>
      </label>
      <p class="tycmp-msg" data-tycmp-msg></p>
    </section>`;

  const root = el.querySelector<HTMLElement>('[data-tycmp]');
  const cardsEl = el.querySelector<HTMLElement>('[data-tycmp-cards]');
  const emptyEl = el.querySelector<HTMLElement>('[data-tycmp-empty]');
  const textEl = el.querySelector<HTMLInputElement>('[data-tycmp-text]');
  const sizeEl = el.querySelector<HTMLInputElement>('[data-tycmp-size]');
  const sizeOut = el.querySelector<HTMLElement>('[data-tycmp-size-out]');
  const dropEl = el.querySelector<HTMLElement>('[data-tycmp-drop]');
  const fileEl = el.querySelector<HTMLInputElement>('[data-tycmp-file]');
  const msgEl = el.querySelector<HTMLElement>('[data-tycmp-msg]');

  // ── Painting ───────────────────────────────────────────────────────────────

  /** Which control had focus, in terms that survive the innerHTML that destroys
   *  it: what kind of action, on which card, at which position (tray-ui's memo). */
  interface FocusMemo { attr: string; id: string; index: number }
  const ACT_ATTR = ['data-tycmp-select', 'data-tycmp-preview', 'data-tycmp-remove'] as const;
  const CARD_ATTR = 'data-tycmp-card';

  function focusMemo(): FocusMemo | null {
    const active = doc.activeElement as HTMLElement | null;
    if (!active || !cardsEl?.contains(active)) return null;
    const btn = active.closest<HTMLElement>(ACT_ATTR.map((a) => `[${a}]`).join(','));
    const attr = btn && ACT_ATTR.find((a) => btn.hasAttribute(a));
    if (btn && attr) {
      const id = btn.getAttribute(attr) ?? '';
      return { attr, id, index: cards.findIndex((c) => c.id === id) };
    }
    // No control - the CARD itself is holding focus, which is where focusInCard
    // parks the keyboard while a load is in flight. Remember the card, or the
    // next repaint would drop focus on the body one frame later.
    const id = active.closest<HTMLElement>(`[${CARD_ATTR}]`)?.getAttribute(CARD_ATTR) ?? '';
    return id ? { attr: CARD_ATTR, id, index: cards.findIndex((c) => c.id === id) } : null;
  }

  /** The card whose ARTICLE the last repaint focused, if any - see `update`. */
  let landedOnCard: string | null = null;

  /** Put the keyboard somewhere sensible ON this card: the action it is now
   *  offering, else the card itself. Remove is deliberately NOT in the list - 
   *  it is the destructive control, and a repaint caused by pressing Preview
   *  must never leave the next Enter on Delete. It is one Tab away, which is
   *  where a control you did not ask for belongs. */
  function focusInCard(id: string): boolean {
    if (!cardsEl) return false;
    for (const attr of ['data-tycmp-select', 'data-tycmp-preview'] as const) {
      const el = cardsEl.querySelector<HTMLElement>(`[${attr}="${cssQuote(id)}"]`);
      if (el && !(el as HTMLButtonElement).disabled) { el.focus(); return true; }
    }
    // Nothing pressable is left (a load in flight offers no button at all): the
    // card itself, which carries the family as its accessible name and the state
    // sentence as its description, so landing there SAYS where you are and why.
    // Tab from here reaches Remove.
    const article = cardsEl.querySelector<HTMLElement>(`[${CARD_ATTR}="${cssQuote(id)}"]`);
    if (article) { article.focus(); landedOnCard = id; return true; }
    return false;
  }

  function restoreFocus(memo: FocusMemo): void {
    if (!cardsEl) return;
    if (memo.attr !== CARD_ATTR) {
      const same = cardsEl.querySelector<HTMLElement>(`[${memo.attr}="${cssQuote(memo.id)}"]`);
      if (same && !(same as HTMLButtonElement).disabled) { same.focus(); return; }
    }
    // The control went away, is now disabled, or the card itself had focus and a
    // control has since become available. Stay on the SAME card while it is here
    // - a press acts on that card and the keyboard should not travel - else the
    // card that took its place. Never the body: a stage that drops focus on a
    // repaint is unusable by keyboard.
    if (cards.some((c) => c.id === memo.id) && focusInCard(memo.id)) return;
    const index = Math.min(Math.max(memo.index, 0), cards.length - 1);
    if (cards[index] && focusInCard(cards[index]!.id)) return;
    (fileEl ?? textEl)?.focus();
  }

  function paint(): void {
    if (!alive || !cardsEl) return;
    const memo = focusMemo();
    landedOnCard = null;
    // Sink 2 of 2: the cards, from the pure compareCardsHtml().
    cardsEl.innerHTML = compareCardsHtml(cards, specimen, t);
    if (emptyEl) emptyEl.hidden = cards.length > 0;
    if (dropEl) dropEl.classList.toggle('is-full', cards.length >= MAX_COMPARE_CARDS);
    if (memo) restoreFocus(memo);
  }

  /** The message line under the drop zone. Plain text, deliberately NOT a live
   *  region: announce() already owns the one polite region, and two would say
   *  everything twice. */
  function say(message: string): void {
    if (msgEl) msgEl.textContent = message;
    if (message) announce(message);
  }

  /** What a finished load should SAY. Empty while it is still in flight:
   *  "loading" is visible on the card and is not news worth interrupting for. */
  function outcomeText(card: CompareCard): string {
    if (card.state === 'ready') return tRaw('{family} is ready to compare.', { family: card.family });
    if (card.reason) return tRaw('{family}: {why}', { family: card.family, why: reasonText(card.reason, tRaw) });
    return '';
  }

  function update(id: string, ev: CardEvent): void {
    const index = cards.findIndex((c) => c.id === id);
    if (index < 0) return;
    const before = cards[index] as CompareCard;
    const after = applyCardEvent(before, ev);
    if (after === before) return; // the event did not apply - no repaint
    cards = [...cards.slice(0, index), after, ...cards.slice(index + 1)];
    paint();
    // A load that ends changes nothing but text inside a subtree that was just
    // replaced wholesale, so without this a screen-reader user presses Preview
    // and hears nothing back - ever. Said once, and NOT when the repaint has
    // just moved focus onto this card: landing on the article reads the same
    // sentence out of its description, and twice is worse than once.
    if (landedOnCard !== id) announce(outcomeText(after));
  }

  // ── Previewing ─────────────────────────────────────────────────────────────

  function dropFace(id: string): void {
    const face = faces.get(id);
    if (!face) return;
    faces.delete(id);
    try { fontSet(doc)?.delete(face); } catch { /* engine already forgot it */ }
  }

  /** One consent, then it holds for the mount. A decline is not remembered as a
   *  refusal - someone may press Fetch again, and asking again is the honest
   *  reading of a second press.
   *
   *  Single-flight: two presses landing before the first answer share ONE
   *  dialog. Two stacked modals asking the same question is not two questions,
   *  and the second would be answering for a card whose press nobody made. */
  let asking: Promise<boolean> | null = null;
  async function ensureConsent(): Promise<boolean> {
    if (consented) return true;
    if (!asking) asking = ctx.consentGoogle().catch(() => false);
    const ok = await asking;
    asking = null;   // idempotent: every awaiter clears the same settled promise
    if (ok) consented = true;
    return ok;
  }

  /** The candidate's own bytes → a live face. No network. */
  async function previewFromBytes(card: CompareCard, bytes: Uint8Array): Promise<FontFace> {
    const facts = describeFaceBytes(bytes);
    if (facts.format === 'unknown') throw new Error('decode-failed');
    return loadPreviewFace(doc, card.previewFamily, bytes, {
      // A variable face is registered across its whole axis, so the specimen
      // renders at the same 400 every other card does. Registering it at its
      // default instance would put a Thin file beside a regular one and call
      // that a comparison.
      weight: facts.weightRange ?? (facts.weight ? String(facts.weight) : '400'),
      style: facts.style === 'italic' || facts.style === 'oblique' ? 'italic' : 'normal',
    });
  }

  /**
   * The Google path: the shipped spec ladder, then ONE face file.
   * `resolveFamilySpec` is the only thing that talks to fonts.googleapis.com and
   * the face URL is on fonts.gstatic.com - both already in the CSP, and both
   * reached only after `ensureConsent()` said yes.
   */
  async function previewFromGoogle(card: CompareCard): Promise<{ face: FontFace; chips: string[] }> {
    const css = await resolveFamilySpec(card.family);
    if (!css) throw new Error('fetch-failed');
    const pick = pickPreviewFace(keepFaces(parseGoogleFontCss(css)));
    if (!pick) throw new Error('fetch-failed');
    const resp = await fetch(pick.url).catch(() => null);
    if (!resp?.ok) throw new Error('fetch-failed');
    const bytes = new Uint8Array(await resp.arrayBuffer());
    const face = await loadPreviewFace(doc, card.previewFamily, bytes, { weight: pick.weight, style: pick.style });
    // The axis the FAMILY SPEC stated, which the served woff2 cannot be asked
    // for (describeFaceBytes only opens ttf/otf). Same sentence a dropped
    // variable file earns, so the two kinds of card read alike.
    const range = pick.weight.includes(' ') ? pick.weight.replace(' ', '–') : '';
    return { face, chips: range ? [tRaw('Variable weight {range}', { range })] : [] };
  }

  /** Start (or restart) one card's preview. Consent first for anything that has
   *  to leave the device; nothing is fetched before that answer. */
  async function preview(id: string): Promise<void> {
    const card = cards.find((c) => c.id === id);
    if (!card || card.state === 'loading' || card.state === 'ready') return;
    if (card.state === 'failed' && card.reason === 'no-source') return;

    const mine = (gen.get(id) ?? 0) + 1;
    gen.set(id, mine);
    dropFace(id);
    update(id, { type: 'start' });
    const current = (): boolean => alive && gen.get(id) === mine && cards.some((c) => c.id === id);

    if (!fontFaceCtor() || !fontSet(doc)) {
      if (current()) update(id, { type: 'fail', reason: 'unsupported' });
      return;
    }

    let face: FontFace;
    let chips: string[] = [];
    try {
      if (card.bytes) {
        face = await previewFromBytes(card, card.bytes);
      } else {
        const ok = await ensureConsent();
        if (!current()) return;
        if (!ok) { update(id, { type: 'declined' }); return; }
        const loaded = await previewFromGoogle(card);
        face = loaded.face;
        chips = loaded.chips;
      }
    } catch (err) {
      if (!current()) return;
      const reason: CardReason = (err as Error)?.message === 'decode-failed' || card.bytes
        ? 'decode-failed' : 'fetch-failed';
      update(id, { type: 'fail', reason });
      return;
    }
    // The card left (or restarted) while the face was loading: the registration
    // is real and nobody owns it, so it goes straight back off the set.
    if (!current()) {
      try { fontSet(doc)?.delete(face); } catch { /* engine already forgot it */ }
      return;
    }
    // Held by card id, not by family: removal must pull back exactly THIS
    // registration, and two cards can carry the same family.
    faces.set(id, face);
    update(id, { type: 'ready', ...(chips.length ? { chips } : {}) });
  }

  // ── Adding and removing ────────────────────────────────────────────────────

  function add(candidate: CompareCandidate): void {
    if (!alive) return;
    // The serial is only SPENT on a card that exists: a refused candidate must
    // not leave a hole in the preview family names.
    const result = admitCandidate(cards, candidate, cardSeq + 1, uid);
    if (!result.ok) {
      if (result.refusal === 'cap') {
        say(tRaw('Comparing {n} faces already. Remove one to add another.', { n: MAX_COMPARE_CARDS }));
      } else if (result.refusal === 'duplicate') {
        say(tRaw('{family} is already on the stage.', { family: String(candidate.family ?? '') }));
      } else {
        say(tRaw('That candidate has no face to show.'));
      }
      return;
    }
    cardSeq++;
    cards = [...cards, result.card];
    say('');
    paint();
    // A candidate somebody ASKED for previews at once (plan 182 section 6.1).
    //
    //  - a file or a candidate carrying bytes has nothing to ask about;
    //  - a `google` candidate is a family somebody typed and pressed Preview on,
    //    so it previews now: `ensureConsent()` inside `preview()` is what that
    //    press asks. The network contract is exactly what it was - nothing
    //    leaves this device before the dialog resolves true. What changed is
    //    WHEN the dialog arrives: at the press the person made, instead of two
    //    presses later on a ghost button they had to notice first.
    //  - a `tray` candidate is SEEDED, not asked for. A stage opens with up to
    //    three of them, so previewing those would fire a fetch (and a consent
    //    dialog) per card for family names nobody chose. They keep their own
    //    button, which is the press that asks.
    if (result.card.kind !== 'tray' || !result.card.needsFetch) void preview(result.card.id);
  }

  function remove(id: string): void {
    const index = cards.findIndex((c) => c.id === id);
    if (index < 0) return;
    gen.set(id, (gen.get(id) ?? 0) + 1); // abandon anything in flight for this card
    dropFace(id);
    cards = cards.filter((c) => c.id !== id);
    paint();
    // Focus follows the removal: the card that took this one's place, else the
    // drop zone. paint()'s memo only covers a repaint, not a deletion of the
    // element that had focus.
    const next = cards[Math.min(index, cards.length - 1)];
    const target = next && cardsEl
      ? cardsEl.querySelector<HTMLElement>(`[data-tycmp-remove="${cssQuote(next.id)}"]`)
      : null;
    (target ?? fileEl ?? textEl)?.focus();
  }

  async function select(id: string): Promise<void> {
    const card = cards.find((c) => c.id === id);
    if (!card || card.state !== 'ready' || card.busy) return;
    const setBusy = (busy: boolean): void => {
      const at = cards.findIndex((c) => c.id === id);
      if (at < 0) return;
      cards = [...cards.slice(0, at), { ...(cards[at] as CompareCard), busy }, ...cards.slice(at + 1)];
      paint();
    };
    setBusy(true);
    try {
      await ctx.onSelect({
        kind: card.kind,
        family: card.family,
        ...(card.label ? { label: card.label } : {}),
        ...(card.bytes ? { bytes: card.bytes } : {}),
        install: card.bytes ? 'bytes' : 'google',
      });
      if (!alive) return;
      say(tRaw('{family} chosen.', { family: card.family }));
    } catch {
      if (!alive) return;
      say(tRaw('{family} could not be applied. Nothing changed.', { family: card.family }));
    } finally {
      if (alive) setBusy(false);
    }
  }

  // ── Files ──────────────────────────────────────────────────────────────────

  async function takeFiles(list: FileList | File[] | null): Promise<void> {
    const files = [...(list ?? [])];
    if (!files.length) return;
    for (const file of files) {
      if (!alive) return;
      const check = validateFontFile(file);
      if (!check.valid) { say(tRaw('{name}: {why}', { name: file.name, why: check.error ?? '' })); continue; }
      let bytes: Uint8Array;
      try { bytes = new Uint8Array(await file.arrayBuffer()); }
      catch { say(tRaw('{name} could not be read.', { name: file.name })); continue; }
      const facts = describeFaceBytes(bytes);
      if (facts.format === 'unknown') {
        say(tRaw('{name} is not a font file we recognise.', { name: file.name }));
        continue;
      }
      add({
        kind: 'upload',
        family: facts.family ?? file.name.replace(/\.[a-z0-9]+$/i, ''),
        label: file.name,
        bytes,
        chips: chipsFromFacts(facts, tRaw), // chipsHtml escapes them - see its note
        provenance: file.name,
      });
    }
  }

  // ── Events ─────────────────────────────────────────────────────────────────

  el.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    if (!target) return;
    const removeId = target.closest<HTMLElement>('[data-tycmp-remove]')?.getAttribute('data-tycmp-remove');
    if (removeId) { remove(removeId); return; }
    const previewId = target.closest<HTMLElement>('[data-tycmp-preview]')?.getAttribute('data-tycmp-preview');
    if (previewId) { void preview(previewId); return; }
    const selectId = target.closest<HTMLElement>('[data-tycmp-select]')?.getAttribute('data-tycmp-select');
    if (selectId) void select(selectId);
  }, { signal });

  if (textEl) {
    /** What Escape restores: the value the field held when focus arrived. */
    let onEntry = textEl.value;
    textEl.addEventListener('focus', () => { onEntry = textEl.value; }, { signal });
    textEl.addEventListener('input', () => {
      specimenTouched = true;
      specimen = textEl.value;
      // Text only - no repaint. A keystroke must not rebuild six cards (and
      // must not throw away the focus the field is holding).
      for (const node of el.querySelectorAll<HTMLElement>('[data-tycmp-specimen]')) {
        node.textContent = specimen;
      }
    }, { signal });
    textEl.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key !== 'Escape') return;
      // Only an edit in progress is ours to answer. Otherwise the key keeps
      // bubbling to whatever holds the stage, which is the only way a keyboard
      // user closes it from the field the caller focuses on open.
      if (textEl.value === onEntry) return;
      e.stopPropagation(); // it cancels the edit, it does not close anything
      textEl.value = onEntry;
      textEl.dispatchEvent(new (doc.defaultView as Window & typeof globalThis).Event('input'));
      textEl.focus(); // never let a cancel drop focus
    }, { signal });
  }

  if (sizeEl) {
    sizeEl.addEventListener('input', () => {
      const px = Math.max(SIZE_MIN, Math.min(SIZE_MAX, Math.round(Number(sizeEl.value) || SIZE_DEFAULT)));
      // One custom property on the root: the size is SHARED, and a comparison
      // where each card could differ would not be one.
      root?.style.setProperty('--tycmp-size', `${px}px`);
      if (sizeOut) sizeOut.textContent = String(px);
    }, { signal });
  }

  if (fileEl) {
    fileEl.addEventListener('change', () => {
      void takeFiles(fileEl.files).finally(() => { fileEl.value = ''; });
    }, { signal });
  }

  if (dropEl) {
    dropEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropEl.classList.add('is-dragover');
    }, { signal });
    dropEl.addEventListener('dragleave', () => { dropEl.classList.remove('is-dragover'); }, { signal });
    dropEl.addEventListener('drop', (e) => {
      e.preventDefault();
      dropEl.classList.remove('is-dragover');
      void takeFiles((e as DragEvent).dataTransfer?.files ?? null);
    }, { signal });
  }

  // ── Boot ───────────────────────────────────────────────────────────────────

  paint();
  for (const candidate of ctx.candidates ?? []) add(candidate);

  // The design system's own name is the best specimen anyone can set type in, so
  // it replaces the pangram when it arrives - unless someone has already typed,
  // in which case the read loses. An edit outranks a default, always.
  void readSystemName(ctx.host).then((name) => {
    if (!alive || specimenTouched || !name) return;
    specimen = name;
    if (textEl) textEl.value = specimen;
    for (const node of el.querySelectorAll<HTMLElement>('[data-tycmp-specimen]')) node.textContent = specimen;
  });

  return {
    addCandidate: add,
    teardown(): void {
      alive = false;
      ac.abort();
      // Previews never outlive the stage - that is the whole reason they are
      // registrations and not assets.
      for (const id of [...faces.keys()]) dropFace(id);
      gen.clear();
      cards = [];
      el.innerHTML = '';
    },
  };
}
