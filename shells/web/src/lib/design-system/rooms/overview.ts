// SPDX-License-Identifier: MPL-2.0
/**
 * The Overview room - the studio's hub and its completion state (plan 97 section 5).
 *
 * Two faces of one room, decided by whether a design system is in force here - 
 * this device's own install or a real one shipped by the catalog, either way:
 *
 *  - EMPTY: four equal doors for the material a person actually has - one
 *    colour, an existing file, a face, or a logo. Each appears with the control
 *    that makes the decision already open (plan 182 section 3a). This is a
 *    mixing desk, not a setup funnel: an import is not more "complete" than one
 *    colour, and nothing prevents another source being added later.
 *  - FURNISHED: what exists, at a glance - the palette, the type families, how
 *    many logo slots are filled, how many tokens there are. Every block is a
 *    door into its room, laid out as label, count and specimen. Counts, never a
 *    progress bar: nothing here is owed. While the system came with the app, a
 *    "Start here" row of three doors leads (plan 346, change 2).
 *
 * Beside either face sits the live In context specimen (the Colours room's
 * poster, chart and UI card), painted into a panel of the view's own so that two
 * panes can give it a pane (plan 346, changes 3, 15 and 16). On a first run it
 * is in the starter's greys, and it colours in when the first colour arrives.
 *
 * Every count is the one the rooms show (../counts.ts).
 *
 * The website door (plan 97 section 9) is deliberately absent rather than disabled - 
 * it arrives with M6, gated on a transport that actually works, and a greyed
 * third door would advertise something nobody can use.
 *
 * Reads only. Nothing in this room writes tokens; the rooms it opens do.
 */

import { contrastRatio, createTokenSet } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { listLogos, splitVariant, isReverseTreatment, type LogoSlot } from '../../brand-logos.ts';
import { roleAssignments } from '../roles.ts';
import { activeDesignSystemSource } from '../active.ts';
import { STARTER_TOKENS_ID, readStarterTokens, type StarterHost } from '../starter.ts';
import { reportOwnership, isNeutralRampKey, radiusValue, starterColorIds, FONT_ROLES } from '../ownership.ts';
import type { ColorRef, OwnershipReport } from '../ownership.ts';
import { colourCount, designFiles, fileName, tokenCount, typefaceCount, type MaterialCount, type UploadRef } from '../counts.ts';
import { brandFontFamilies } from '../../register-user-fonts.ts';
import { primaryFontFamily, displayFontFamily, monoFontFamily, italicFontFamily } from '../../../user-fonts.ts';
import type { BrandEditorHandle } from '../../brand-editor.ts';
import { icon } from '../../icons.ts';
import { escape } from '../../../utils.ts';
import { t, tRaw } from '../../../i18n.ts';
import { isTauriShell } from '../../instance-choice.ts';
import { brandFontStack } from '../../../brand-vars.ts';
import { listLeads } from '../leads.ts';
import { activePalette, palettePreviewSvgs, type PalettePreviewOptions } from '../../palette-preview.ts';
import { segHtml } from '../../seg.ts';
import { prefersReducedMotion } from '../../a11y-prefs.ts';

/** The whole host; the slices this room reads are reached through the same
 *  narrow casts mountBrandEditor uses (they are web-shell extensions absent
 *  from the tool-facing HostV1 type). */
export type OverviewHost = HostV1;

export interface OverviewCtx {
  host: OverviewHost;
  /** The mounted editor, or null when it failed or is still mounting - read
   *  late, because the room outlives any one editor mount. */
  editor: () => BrandEditorHandle | null;
  /** Open a room by its `?area=` key, optionally naming the control that should
   *  be open when it gets there (`?focus=` - `pick` is the Colours room's colour
   *  picker, `stage` the Type room's face stage). The room hands the word
   *  straight through; the view owns what each one opens. */
  goto: (area: string, focus?: string) => void;
  /** Open the source modal ("Add from…"). */
  openImport: () => void;
  openLooks?: () => void;
  /** The live column: the view's own panel beside the Board, where the room
   *  paints the In context specimen from the same read. Absent, nothing is
   *  painted there (a host with no column for the specimen). */
  live?: HTMLElement;
}

export interface OverviewRoom {
  /** Re-read and repaint. Cheap and idempotent; safe to call on room entry. */
  refresh: () => void;
  teardown: () => void;
}

/** What the room shows. Everything is a count or a name - no progress state. */
export interface OverviewModel {
  /** A design system is in force here - this device's own install, or a real
   *  one shipped by the catalog. False only on the starter placeholder. */
  furnished: boolean;
  /** The design system's OWN swatch values for the strip, capped at STRIP_MAX. */
  colors: string[];
  /** Every colour in the palette - the person's own plus whatever is still the
   *  starter's. Not shown any more (own counts lead), but it is what the room
   *  reads to work the two halves out. */
  colorCount: number;
  /** Distinct family names across the type roles, in role order. */
  fonts: string[];
  logoCount: number;
  tokenCount: number;
  /** How many of `colorCount` are still the shipped starter's, unchanged AND
   *  worth showing - the scaffolding neutral ramp is not (see
   *  {@link isNeutralRampKey}: ink and paper live under Tokens, and counting
   *  them here would put "9 starter" beside a room that draws none of them).
   *  Optional so a caller that has nothing to say about ownership can leave it
   *  out; 0 and absent mean the same thing. */
  starterCount?: number;
  /** Colours the person added or changed - the headline number on the card. */
  ownColorCount?: number;
  /** Starter swatch values for the strip's faded tail, capped at
   *  {@link STARTER_STRIP_MAX}. Empty when the only inherited colours are the
   *  scaffolding neutrals, which is the blank brand's whole palette. */
  starterColors?: string[];
  /** The corner radius in force, and whether anybody moved it. `value` is the
   *  app's own default when the document carries no `shape.radius`. */
  radius?: { value: string; own: boolean };
  /** How many files the design system keeps (the user's own assets). Undefined
   *  when the store could not answer, which reads as "say nothing". */
  fileCount?: number;
  /** The whole ownership read this room already had to do (lib/design-system/
   *  ownership.ts) - counts, faces, logos, radius - so the cards can say which
   *  material is the person's own without deriving it a second time. */
  ownership?: OwnershipReport;
  /** Enough of a design system here to be worth exporting - see
   *  {@link isWorthExporting}. Optional for the same reason `starterCount` is:
   *  absent and false mean the same thing. */
  worthExporting?: boolean;
  /** The active system is the one this build ships (Lolly Demo on lolly.tools).
   *  Its colours, faces and marks are the system's own even though nobody on
   *  this device chose them, so the room shows them and says where they came from. */
  supplied?: boolean;
  /** The colourways, canonical first, as their light-mode lead and its ink. */
  colourways?: Array<{ name: string; primary: string; onPrimary: string; canonical: boolean }>;
  /** The palette's colours, counted as every room counts them (../counts.ts). */
  colours?: MaterialCount;
  /** The typefaces, counted as the Tokens room counts them (../counts.ts). */
  typefaces?: MaterialCount;
  /** The name of the newest file in Files, or '' when there is none. */
  newestFile?: string;
  /** Up to three marks for the Logos card, primaries first, each with an object
   *  URL the room hands back when it repaints. Only read when asked for. */
  marks?: Array<{ url: string; variant: string; reverse: boolean; label: string }>;
}

/** Whose system the Board is showing (plan 346, change 1):
 *   - `blank`: nothing chosen yet, so the material doors are up;
 *   - `unowned`: it came with the app, so the next step is to make it the
 *     person's own and "Make it yours" leads;
 *   - `owned`: material of the person's own is in it, so Export leads. */
export type BoardState = 'blank' | 'unowned' | 'owned';

const STRIP_MAX = 12;

/** How many starter minis ride behind the hairline. Fewer than the own strip on
 *  purpose: it is a reminder of what is standing in, not an inventory. */
const STARTER_STRIP_MAX = 5;

/** What `--radius` is when nothing has been declared (styles/tokens.css). */
const DEFAULT_RADIUS = '1rem';

/** How many colours of a person's own read as a palette rather than a first
 *  try. Two is a colour and a second thought; three is a set. */
const OWN_COLORS_ENOUGH = 3;

/** The ramp family only a generate writes. The blank brand ships `primary` and
 *  `neutral`; `deriveBrandTokens` always adds `secondary`, so its presence is
 *  the cheapest honest answer to "has a palette been generated here". */
const GENERATED_RAMP = /(^|\.)ramp\.secondary\./;

export { STARTER_TOKENS_ID };

const EMPTY_MODEL: OverviewModel = {
  furnished: false, colors: [], colorCount: 0, fonts: [], logoCount: 0, tokenCount: 0, starterCount: 0,
};

/**
 * The blank starter document (starter.ts), or null.
 *
 * A first write copies that whole ramp into the user's own document, so from
 * then on the user owns 25 colours nobody chose. Reading the starter's bytes
 * back is what lets a caller tell those apart from the ones a person added, by
 * comparing path and value - no schema change, no flag on the token, and
 * nothing to migrate on a document that predates the idea.
 *
 * Every new design system starts from this document whichever brand the build
 * ships, so it is the reference on every brand. A brand whose own colours never
 * came from it (SUSE's, an ingested pack) matches nothing, so nothing is
 * attributed there, which is the behaviour every caller had before.
 */
export async function readStarterDoc(host: OverviewHost): Promise<unknown> {
  try {
    return (await readStarterTokens(host as unknown as StarterHost)).doc;
  } catch { return null; }
}

/**
 * Every colour in `doc` as the palette RESOLVES it - dotted path plus hex.
 *
 * The value space this room reads in: `host.tokens.colors()` answers with
 * resolved hexes, so the starter it is compared against has to be spelled the
 * same way. The comparison itself is not here - it is `reportOwnership`
 * (lib/design-system/ownership.ts), which the Colours room also reads, in its
 * own (stored-value) space.
 */
function resolvedColorRefs(doc: unknown): ColorRef[] {
  if (!doc) return [];
  try {
    return createTokenSet(doc).colors().map(c => ({ key: c.path, value: c.value }));
  } catch { return []; }
}

/**
 * Is there enough of a design system here to be worth EXPORTING?
 *
 * A harder question than `furnished`, and a different one. Furnished asks
 * whether a design system exists at all, which the very first write makes true -
 * so gating the studio's Export / Tokens / Versions actions on it grew three
 * power actions on the rail one gesture in (plans/163 F4). This asks whether
 * there is something in there a file would be worth carrying, and any ONE of
 * these answers yes:
 *
 *  - the person owns {@link OWN_COLORS_ENOUGH} colours or more (`own` is the
 *    palette minus whatever is still the shipped starter ramp, unchanged);
 *  - a palette has been generated (a `secondary` ramp exists - see
 *    {@link GENERATED_RAMP});
 *  - more than one role points at a colour of theirs. The blank brand ships
 *    every role pre-assigned, so only roles pointing somewhere the starter did
 *    not count - otherwise this would be true from the first write too.
 *
 * Reads what `readOverview` has already loaded. Nothing here writes.
 */
function isWorthExporting(
  swatches: Array<{ value: string; path?: string }>, starter: Map<string, string>, doc: unknown, own: number,
): boolean {
  if (own >= OWN_COLORS_ENOUGH) return true;
  if (swatches.some(s => GENERATED_RAMP.test(s.path ?? ''))) return true;
  const current = new Map(swatches.filter(s => !!s.path).map(s => [s.path!, s.value]));
  // Same test the starter split uses, applied to the swatch a role points at:
  // a key the starter never had, or one whose colour has been changed since.
  return Object.values(roleAssignments(doc))
    // A role pointing at a key the palette no longer shows (every colour hidden) is
    // not a decision about a colour, so it does not count.
    .filter(r => current.has(r.key) && starter.get(r.key) !== current.get(r.key)).length > 1;
}

/**
 * Collect what the design system currently holds.
 *
 * Reads `host.tokens.colors()` directly rather than lib/live-palette.ts, whose
 * per-host cache never busts: this room repaints after an install, and a cached
 * palette would show the colours the page opened with.
 */
/** The marks the Logos card shows first: the full-colour forms, then the
 *  reverse ones, then mono. A custom slot follows the canonical ones. */
const MARK_ORDER = ['horizontal-primary', 'vertical-primary', 'horizontal-primary-reverse', 'vertical-primary-reverse', 'horizontal-mono', 'vertical-mono', 'horizontal-mono-reverse', 'vertical-mono-reverse'];
const CARD_MARKS = 3;

function cardMarks(logos: LogoSlot[]): LogoSlot[] {
  const rank = (slot: LogoSlot): number => { const i = MARK_ORDER.indexOf(slot.variant); return i < 0 ? MARK_ORDER.length : i; };
  return [...logos].sort((a, b) => rank(a) - rank(b)).slice(0, CARD_MARKS);
}

export interface ReadOverviewOptions {
  /** Keep object URLs for the Logos card's marks (the caller revokes them). */
  marks?: boolean;
}

export async function readOverview(host: OverviewHost, opts: ReadOverviewOptions = {}): Promise<OverviewModel> {
  const assets = host.assets as unknown as { _findMetaByType?(type: string): Promise<{ id: string } | null> };
  const tokens = host.tokens as unknown as {
    colors?(opts?: { theme?: string }): Promise<Array<{ value: string; path?: string }>>;
    raw?(): Promise<unknown>;
  } | undefined;

  // "Furnished" is about whether a design system EXISTS here, not about who
  // installed it. bridge/tokens.ts resolves an unlocked catalog's own tokens doc
  // when there is no user install, so host.tokens below would answer with that
  // pack's full palette - and an "Nothing here yet" empty state over a painted
  // Colours room is simply false. A SHIPPED system that can be edited (Lolly
  // Demo) is furnished too: it holds colours, faces, marks and colourways, and
  // the room says it came with the app (plan 336, reversing plans/186 section
  // 3.3). The genuinely empty case is the starter placeholder, the shell's own
  // unbranded signal, which the id test below still catches.
  const supplied = (await activeDesignSystemSource(host)) === 'shipped';
  let tokensId = '';
  try { tokensId = (await assets._findMetaByType?.('tokens'))?.id ?? ''; }
  catch { /* discovery unavailable - treat as not installed here */ }
  if (!tokensId || tokensId === STARTER_TOKENS_ID) return EMPTY_MODEL;

  const swatches = await tokens?.colors?.().catch(() => []) ?? [];
  const doc = await tokens?.raw?.().catch(() => null) ?? null;
  const readable = !!doc && typeof doc === 'object';

  const families = await Promise.all([
    primaryFontFamily(host as unknown as Parameters<typeof primaryFontFamily>[0]).catch(() => ''),
    displayFontFamily(host as unknown as Parameters<typeof displayFontFamily>[0]).catch(() => ''),
    monoFontFamily(host as unknown as Parameters<typeof monoFontFamily>[0]).catch(() => ''),
    italicFontFamily(host as unknown as Parameters<typeof italicFontFamily>[0]).catch(() => ''),
  ]);

  // listLogos mints an object URL per slot for its previews. The Logos card
  // draws at most three, and only when the room asked; every other one goes
  // straight back rather than leaking.
  const logos = await listLogos(host as unknown as Parameters<typeof listLogos>[0]).catch(() => []);
  const kept = opts.marks ? cardMarks(logos) : [];
  for (const logo of logos) {
    if (kept.includes(logo)) continue;
    try { URL.revokeObjectURL(logo.url); } catch { /* no blob-URL support - nothing to release */ }
  }

  const starterDoc = await readStarterDoc(host);
  const starterRefs = resolvedColorRefs(starterDoc);
  // One read for every ownership question this room asks. The palette halves are
  // handed in because both are already loaded here and both are RESOLVED values;
  // roles are dropped by the module, so a re-pointed role never inflates a count
  // (plan 182 C5) and this number agrees with the Colours room's.
  const ownership = reportOwnership({
    doc,
    starterDoc,
    palette: { colors: swatches.map(s => ({ key: s.path ?? '', value: s.value })), starter: starterRefs },
    userFontFamilies: brandFontFamilies(),
    resolvedFaces: { brand: families[0], display: families[1], mono: families[2], italic: families[3] },
    // A shipped mark belongs to the design system, not to the person.
    logoSlots: logos.filter(l => !l.shipped).map(l => ({ variant: l.variant, filled: true })),
  });
  const starter = new Map(starterRefs.map(r => [r.key, r.value]));
  // The strip's two halves, in palette order. A role leaf is absent from the
  // ownership map (it re-points, it is not material), and the scaffolding
  // neutrals are dropped from the starter half rather than the palette: they are
  // ink and paper, they live under Tokens, and drawing nine greys behind the
  // hairline would read as a palette nobody chose.
  const own: string[] = [];
  const inherited: string[] = [];
  for (const s of swatches) {
    const state = ownership.colors.get(s.path ?? '');
    if (!state) continue;
    if (state === 'own') own.push(s.value);
    else if (!isNeutralRampKey(s.path ?? '')) inherited.push(s.value);
  }
  // The uploads the Files room lists, by the same rule (../counts.ts), newest
  // first as the store lists them. Undefined when the store cannot answer, which
  // the card reads as "say nothing".
  const store = host.assets as unknown as { _listUserAssets?(): Promise<UploadRef[]> };
  const uploads = await store._listUserAssets?.().then(designFiles, () => undefined);

  return {
    furnished: true,
    colors: own.slice(0, STRIP_MAX),
    // The two halves, not `colors.size`: the map is keyed by token path and a
    // bridge that answered without one would collapse those entries into it.
    colorCount: ownership.counts.ownColors + ownership.counts.starterColors,
    fonts: [...new Set(families.filter(Boolean))],
    logoCount: logos.length,
    tokenCount: tokenCount(doc),
    starterCount: inherited.length,
    ownColorCount: ownership.counts.ownColors,
    starterColors: inherited.slice(0, STARTER_STRIP_MAX),
    radius: { value: radiusValue(doc) || DEFAULT_RADIUS, own: ownership.radius === 'own' },
    fileCount: uploads?.length,
    newestFile: uploads?.[0] ? fileName(uploads[0]) : '',
    ownership,
    worthExporting: isWorthExporting(swatches, starter, doc, ownership.counts.ownColors),
    supplied,
    colourways: colourwaysOf(doc),
    // Read from the document, as the Tokens room reads them. A host that answered
    // with swatches but no readable document leaves the counts to the ownership
    // read above.
    ...(readable ? { colours: colourCount(doc, starterColorIds(starterDoc)), typefaces: typefaceCount(doc, brandFontFamilies()) } : {}),
    marks: kept.map(slot => {
      const { treatment } = splitVariant(slot.variant);
      return { url: slot.url, variant: slot.variant, reverse: !!treatment && isReverseTreatment(treatment), label: slot.label };
    }),
  };
}

/** The colourways in light mode, canonical first. Empty on a document without any,
 *  and on one the leads reader cannot parse: the card then simply does not draw. */
function colourwaysOf(doc: unknown): NonNullable<OverviewModel['colourways']> {
  try {
    return listLeads(doc).map((lead) => {
      const light = lead.colours.light ?? Object.values(lead.colours)[0];
      return { name: lead.name, primary: light?.primary ?? '', onPrimary: light?.['on-primary'] ?? '', canonical: lead.canonical };
    }).filter(way => !!way.primary);
  } catch { return []; }
}


// ── Markup ───────────────────────────────────────────────────────────────────

const countLabels = {
  colors: (n: number): string => t(n === 1 ? '{n} colour' : '{n} colours', { n }),
  logos: (n: number): string => t(n === 1 ? '{n} logo' : '{n} logos', { n }),
  tokens: (n: number): string => t(n === 1 ? '{n} token' : '{n} tokens', { n }),
  colourways: (n: number): string => t(n === 1 ? '{n} colourway' : '{n} colourways', { n }),
  typefaces: (n: number): string => t(n === 1 ? '{n} typeface' : '{n} typefaces', { n }),
  files: (n: number): string => t(n === 1 ? '{n} file' : '{n} files', { n }),
};

/** The muted half of a card's value line - the starter suffix, the role a face
 *  serves. Trusted markup out, escaped text in. */
const suffix = (text: string): string => `<small class="ds-ov-sub-value">${escape(text)}</small>`;

/** A family name set in its own face, so the card is a specimen as well as a
 *  label. brandFontStack refuses anything that is not a plain family name, and a
 *  refused one reads in the studio's own face. Trusted markup out, escaped text in. */
function faceName(family: string): string {
  const stack = brandFontStack(family, 'sans-serif');
  return stack
    ? `<span class="ds-ov-face" style="font-family:${escape(stack)}">${escape(family)}</span>`
    : escape(family);
}

/**
 * The Colours card's value: the palette count every room shows (../counts.ts),
 * with the starter's as a muted suffix behind the person's own.
 *
 * Own counts LEAD (plan 182 section 4.2). "26 colours" after one add reads as a
 * system somebody built; "1 colour · 25 starter" says which part is theirs, and
 * on the blank brand - whose only inherited colours are the scaffolding neutrals
 * the Tokens room owns - there is no suffix at all.
 */
function colorsValue(model: OverviewModel): string {
  const starter = model.starterCount ?? 0;
  const counted = model.colours;
  const own = counted ? counted.shown : model.ownColorCount ?? Math.max(0, model.colorCount - starter);
  const behind = starter > 0 && (!counted || counted.own > 0);
  return escape(countLabels.colors(own)) + (behind ? ` ${suffix(tRaw('· {m} starter', { m: starter }))}` : '');
}

/** What each type role is FOR, in the words the card uses. */
function faceRoleWord(role: (typeof FONT_ROLES)[number]): string {
  switch (role) {
    case 'display': return t('for headings');
    case 'mono': return t('for code');
    case 'italic': return t('for emphasis');
    default: return t('for text');
  }
}

/** One face in its own face, with what it is for. */
const faceRow = (family: string, role: (typeof FONT_ROLES)[number]): string =>
  `<span class="ds-ov-face-row">${faceName(family)} ${suffix(faceRoleWord(role))}</span>`;

/**
 * The Type card's faces, by ROLE: the faces the system chose lead, and whatever
 * is still the starter's is named underneath rather than counted in.
 *
 * A `follows` role is folded into the role it follows (the grammar table in plan
 * 182 section 4.2) - it repeats a decision rather than making one - so only a
 * declared face that came with the app can put a family in the starter line.
 * Without an ownership report there is nothing to attribute, so the card falls
 * back to the plain family list it has always shown.
 */
function typeCard(model: OverviewModel): { lead: string; sub: string } {
  const faces = model.ownership?.faces;
  if (!faces) return { lead: model.fonts.length ? escape(model.fonts.join(', ')) : '', sub: '' };
  // A role the report does not carry is a role nothing can be said about - read
  // through, never off the end (a report is built per host, and a degraded one
  // must not take the card down with it).
  const stateOf = (role: (typeof FONT_ROLES)[number]): string => faces[role]?.state ?? '';
  const familyOf = (role: (typeof FONT_ROLES)[number]): string => faces[role]?.family ?? '';
  // A supplied system's faces are the system's own: nobody installed them on this
  // device, but they are what it was made with, so they lead rather than trail.
  // So are the faces of a system that chose any beyond the starter's (an edited
  // copy of Lolly Demo): ownership.ts marks those `starter: false`. Headings
  // lead, since they show a face best; a role set in a family another role
  // already names (italic in the text face, most often) is not repeated.
  const chosenBeyondStarter = FONT_ROLES.some(role => stateOf(role) === 'inherited' && faces[role]?.starter === false);
  if (model.supplied || chosenBeyondStarter) {
    const seen = new Set<string>();
    const set = (['display', 'brand', 'mono', 'italic'] as const).filter((role) => {
      const family = familyOf(role);
      if (stateOf(role) === 'follows' || !family || seen.has(family)) return false;
      seen.add(family);
      return true;
    });
    if (set.length) return { lead: set.map(role => faceRow(familyOf(role), role)).join(''), sub: '' };
  }
  const own = FONT_ROLES.filter(role => stateOf(role) === 'own');
  const rest = FONT_ROLES.filter(role => stateOf(role) === 'inherited' || stateOf(role) === 'unset');
  const restFamilies = [...new Set(rest.map(familyOf).filter(Boolean))];
  const lead = own.map(role => faceRow(familyOf(role), role)).join('');
  const sub = restFamilies.length
    ? (own.length
      ? tRaw('Starter for the rest · {families}', { families: restFamilies.join(', ') })
      : tRaw('Starter · {families}', { families: restFamilies.join(', ') }))
    : '';
  return { lead, sub };
}

/** The Tokens card's sub-line: the one shape token, and who set it. */
function radiusLine(model: OverviewModel): string {
  const radius = model.radius;
  if (!radius) return '';
  // A supplied system's radius is its own setting, never the starter's.
  return radius.own || model.supplied
    ? tRaw('Corner radius · {value}', { value: radius.value })
    : tRaw('Corner radius · starter {value}', { value: radius.value });
}

/** A corner radius the specimen square may wear: a plain length, never anything
 *  a style attribute could be talked into reading as a second declaration. */
const CSS_LENGTH = /^(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em|%)?$/;

/** A card's own sub-line - the muted line under the value. */
const cardSub = (text: string): string =>
  (text ? `<span class="ds-ov-card-note">${escape(text)}</span>` : '');

function doorHtml(door: string, glyph: string, name: string, note: string, extra = ''): string {
  return `
    <button type="button" class="ds-ov-door" data-ds-door="${escape(door)}">
      <span class="ds-ov-door-ic" aria-hidden="true">${glyph}</span>
      <span class="ds-ov-door-name">${escape(name)}</span>
      <span class="ds-ov-door-note">${escape(note)}</span>${extra}
    </button>`;
}

/** One "Start here" door, in the welcome dialog's shape: what it opens, what it
 *  does, and where it goes (components/welcome-dialog.ts). The way-in line is
 *  decoration: the name and the line are the button's accessible name. */
function startDoorHtml(door: string, glyph: string, name: string, line: string, cta: string): string {
  return `
    <button type="button" class="ds-ov-start-door" data-ds-door="${escape(door)}">
      <span class="ds-ov-start-ic" aria-hidden="true">${glyph}</span>
      <span class="ds-ov-start-name">${escape(name)}</span>
      <span class="ds-ov-start-line">${escape(line)}</span>
      <span class="ds-ov-start-cta" aria-hidden="true">${escape(cta)}</span>
    </button>`;
}

/** One card: label, value, specimen, in that order and at the same height as
 *  every other card. `valueHtml` and `specimen` are TRUSTED markup - every call
 *  site escapes its own text (see {@link suffix}). */
function cardHtml(area: string, label: string, valueHtml: string, specimen = ''): string {
  return `
    <button type="button" class="ds-ov-card" data-ds-goto="${escape(area)}">
      <span class="ds-ov-card-label">${escape(label)}</span>
      <span class="ds-ov-card-value">${valueHtml}</span>
      <span class="ds-ov-card-spec">${specimen}</span>
    </button>`;
}

/**
 * Has anything here been CHOSEN? Not the same question as `furnished`, which the
 * very first write makes true whatever that write was.
 *
 * A design system whose every colour, face and mark is still what shipped has
 * nothing to show at a glance, so it gets the four material doors instead of five cards
 * counting other people's decisions (plan 182 section 3a). Radius counts: moving
 * it is a decision, even though it adds no material. A model with no ownership
 * report cannot be asked, and falls back to `furnished` exactly as before.
 */
function hasOwnMaterial(model: OverviewModel): boolean {
  const own = model.ownership;
  if (!own) return model.furnished;
  return own.counts.ownColors > 0 || own.counts.ownFaces > 0 || own.counts.logos > 0
    || own.radius === 'own';
}

/**
 * Whose system this is - the Overview's ownership test, which the studio's bar
 * also follows (views/start/rooms.ts). A supplied system has material even when
 * none of it was chosen on this device, so it is never blank; it stops being
 * merely supplied on its first edit, which makes it a copy of the person's own.
 */
export function boardState(model: OverviewModel): BoardState {
  if (!model.furnished || (!model.supplied && !hasOwnMaterial(model))) return 'blank';
  return model.supplied ? 'unowned' : 'owned';
}

/** The lightest and the darkest colour the system holds, as the grounds a
 *  mark is drawn on: a full-colour mark on paper, a reverse one on ink. A
 *  palette without a near-white or a near-black falls back to plain ones. */
function markGrounds(model: OverviewModel): { paper: string; ink: string } {
  const pool = [...model.colors, ...(model.starterColors ?? [])].filter(hex => /^#[0-9a-f]{6}$/i.test(hex));
  const against = (hex: string, other: string): number => { try { return contrastRatio(hex, other); } catch { return 1; } };
  const darkest = pool.reduce<string | null>((best, hex) => !best || against(hex, '#ffffff') > against(best, '#ffffff') ? hex : best, null);
  const lightest = pool.reduce<string | null>((best, hex) => !best || against(hex, '#000000') > against(best, '#000000') ? hex : best, null);
  return {
    ink: darkest && against(darkest, '#ffffff') >= 7 ? darkest : '#1d1d1d',
    paper: lightest && against(lightest, '#000000') >= 15 ? lightest : '#ffffff',
  };
}

/** The markup for the four material doors (the blank Board). */
function blankHtml(): string {
  // One door per thing somebody might already have. A complete .lolly pack is
  // as immediate as one colour; the in-between cases stay first-class and can be
  // mixed freely. Each opens with its deciding control already up. The studio's
  // bar carries the system's name, so this heading says what to do. A logo is
  // what most people have first, so it leads; the file door is last because it
  // is the one that needs the most explaining. The lorikeet's place watches the
  // colour door, where the first colour arrives (Fauna, drawn later).
  return `
    <div class="ds-ov ds-ov--empty" data-board="blank">
      <div class="ds-ov-intro">
        <h2 class="ds-ov-title">${t('Start with what you have')}</h2>
        <p class="ds-ov-sub">${t('Pick any one. Add the rest later.')}</p>
      </div>
      <div class="ds-ov-doors">
        ${doorHtml('logos', icon('shapes'), t('Add a logo'),
          t('Drop a logo file and Lolly suggests its slot.'))}
        ${doorHtml('color-pick', icon('palette'), t('Pick a colour'),
          t('It becomes the primary. Shades and roles can follow.'),
          '<span class="fauna-slot" data-fauna="lorikeet" data-fauna-watch="pick-colour" aria-hidden="true"></span>')}
        ${doorHtml('type-stage', icon('font'), t('Choose a face'),
          isTauriShell() ? t('Google Fonts or a font file. Stays on this device.') : t('Google Fonts or a font file. Stays in this browser.'))}
        ${doorHtml('file', icon('upload'), t('Start from a reference'),
          t('A logo, screenshot, web page or design file. Preview before applying.'))}
      </div>
      <p class="ds-ov-bring"><button type="button" class="be-btn" data-ds-door="looks">${t('Find a look')}</button> ${t('Ready-made colours and type to try. Nothing installs until you pick one.')}</p>
      <p class="ds-ov-bring"><a class="ds-ov-inline" href="#/">${escape(t('Explore the tools'))}</a></p>
    </div>`;
}

/** The room's markup for a model, or the resting line while the read runs. */
export function overviewHtml(model: OverviewModel | null): string {
  if (!model) return `<p class="ds-ov-loading">${t('Reading the design system…')}</p>`;
  const state = boardState(model);
  if (state === 'blank') return blankHtml();

  // Own colours lead; the starter's follow a hairline, faded, and only when
  // there are any to show at all.
  const chips = (values: string[], cls: string): string => values
    .map(hex => `<span class="ds-ov-chip${cls}" style="background:${escape(hex)}"></span>`).join('');
  const starterChips = model.starterColors?.length
    ? `<span class="ds-ov-strip-rule"></span>${chips(model.starterColors, ' is-starter')}`
    : '';
  // The system's own colours as one bar across the card, each an equal share of
  // it, so a palette of any size reads as a palette rather than a wrapped row.
  const ownBar = model.colors.length ? `<span class="ds-ov-bar">${chips(model.colors, '')}</span>` : '';
  const strip = ownBar || starterChips
    ? `<span class="ds-ov-strip" aria-hidden="true">${ownBar}${starterChips}</span>`
    : '';
  const type = typeCard(model);
  const typeValue = model.typefaces?.shown
    ? escape(countLabels.typefaces(model.typefaces.shown))
    : type.lead || escape(t('Not set'));
  const typeSpec = (model.typefaces?.shown && type.lead ? `<span class="ds-ov-faces">${type.lead}</span>` : '') + cardSub(type.sub);
  const ways = model.colourways ?? [];
  // Each colourway as a small tile in its lead colour, with "Aa" in the ink
  // that reads on that colour. Values are hexes the engine resolved; escaped all the same.
  const wayTiles = ways.length
    ? `<span class="ds-ov-ways" aria-hidden="true">${ways.slice(0, 8).map(w =>
      `<span class="ds-ov-way" style="--lead:${escape(w.primary)};--on:${escape(w.onPrimary || '#ffffff')}">Aa</span>`).join('')}</span>`
    : '';
  // The marks on their own grounds: a full-colour mark on the system's paper, a
  // reverse one on its ink. Object URLs the room minted for this paint.
  const grounds = markGrounds(model);
  const marks = model.marks?.length
    ? `<span class="ds-ov-marks" aria-hidden="true" style="--ds-ov-paper:${escape(grounds.paper)};--ds-ov-ink:${escape(grounds.ink)}">${model.marks.map(m =>
      `<span class="ds-ov-mark${m.reverse ? ' is-reverse' : ''}"><img src="${escape(m.url)}" alt="" decoding="async"></span>`).join('')}</span>`
    : '';
  const logoSpec = model.logoCount ? marks : cardSub(t('Horizontal, vertical, custom marks'));
  const radius = model.radius && CSS_LENGTH.test(model.radius.value.trim())
    ? `<span class="ds-ov-radius" aria-hidden="true" style="--ds-ov-r:${escape(model.radius.value.trim())}"></span>`
    : '';
  const tokenSpec = radiusLine(model) ? `<span class="ds-ov-spec-line">${radius}${cardSub(radiusLine(model))}</span>` : '';
  const filesValue = model.fileCount === undefined ? escape(t('Uploads and downloads'))
    : model.fileCount === 0 ? escape(t('Nothing yet'))
      : escape(countLabels.files(model.fileCount));
  // The newest file by name, or what the room is for while it holds none.
  const filesNote = model.fileCount && model.newestFile ? model.newestFile : model.fileCount === 0 ? t('Uploads and downloads') : '';
  const filesSpec = filesNote
    ? `<span class="ds-ov-spec-line"><span class="ds-ov-file-ic" aria-hidden="true">${icon('folder')}</span>${cardSub(filesNote)}</span>`
    : '';

  // While the system came with the app, the first move leads: three doors in
  // the welcome dialog's shape, above the inventory (plan 346, change 2).
  const start = state === 'unowned' ? `
      <section class="ds-ov-start" aria-labelledby="ds-ov-start-title">
        <h3 class="ds-ov-start-title" id="ds-ov-start-title">${t('Start here')}</h3>
        <div class="ds-ov-start-doors">
          ${startDoorHtml('looks', icon('sparkle'), t('Find a look'),
            t('Ready-made colours and type to try. Nothing installs until you pick one.'), t('Browse looks →'))}
          ${startDoorHtml('file', icon('upload'), t('Add from…'),
            t('A logo, screenshot, web page or design file. Preview before applying.'), t('Pick what you have →'))}
          ${startDoorHtml('color-pick', icon('palette'), t('Pick a colour'),
            t('It becomes the primary. Shades and roles can follow.'), t('Open the picker →'))}
        </div>
      </section>` : '';
  const more = state === 'owned'
    ? `<div class="ds-ov-more">
        <button type="button" class="be-btn" data-ds-door="looks">${t('Find a look')}</button>
        <button type="button" class="be-btn" data-ds-door="color-pick">${t('Pick a colour')}</button>
        <a class="ds-ov-exit" href="#/">${t('Explore the tools')}</a>
      </div>`
    : `<p class="ds-ov-bring"><a class="ds-ov-inline" href="#/">${escape(t('Explore the tools'))}</a></p>`;

  return `
    <div class="ds-ov" data-board="${state}">
      <div class="ds-ov-intro">
        <div class="ds-ov-head">
          <h2 class="ds-ov-title">${t('The design system')}</h2>
          ${model.supplied ? `<span class="ds-ov-supplied">${t('Came with this app')}</span>` : ''}
        </div>
        <p class="ds-ov-sub">${t('Tools use these settings where they follow this design system. Saved designs can keep their own colours and fonts.')}</p>
      </div>
      ${start}
      <div class="ds-ov-cards">
        ${cardHtml('color', t('Colours'), colorsValue(model), strip)}
        ${ways.length ? cardHtml('color', t('Colourways'), escape(countLabels.colourways(ways.length)), wayTiles) : ''}
        ${cardHtml('type', t('Type'), typeValue, typeSpec)}
        ${cardHtml('logos', t('Logos'),
          model.logoCount ? escape(countLabels.logos(model.logoCount)) : escape(t('Not set')), logoSpec)}
        ${cardHtml('tokens', t('Tokens'), escape(countLabels.tokens(model.tokenCount)), tokenSpec)}
        ${cardHtml('catalogue', t('Files'), filesValue, filesSpec)}
      </div>
      ${more}
    </div>`;
}

// ── The live column: In context ─────────────────────────────────────────────

/** The scenes the specimen can show, in the Colours room's order. */
const SCENE_COUNT = 3;

/** The scene artwork's own ground (the first rect each scene paints), so the
 *  stage around it is the same colour and the scene sits on it without a seam. */
const groundOf = (svg: string): string => /<rect width="480" height="360" fill="(#[0-9a-f]{3,8})"/i.exec(svg)?.[1] ?? '';

/**
 * The live column's markup: the Colours room's In context scenes, painted from
 * the active palette (lib/palette-preview.ts builds them, and validates every
 * colour before it reaches an attribute), the scene switch and the way to
 * Colours. `noir` is the first run, before any colour is the person's own: the
 * scenes are in the starter's greys, the lorikeet's place watches them, and one
 * quiet line says why.
 */
export function liveHtml(scenes: ReadonlyArray<{ label: string; svg: string }>, scene: number, noir: boolean): string {
  const shown = Math.min(Math.max(0, scene), Math.max(0, scenes.length - 1));
  const labels = [t('Poster'), t('Chart'), t('UI card')];
  // `s.svg` is markup, so it goes in raw: palette-preview.ts builds the scenes
  // from developer-authored templates and passes every colour through its hex
  // whitelist (palette-preview.test.ts pins that against hostile strings).
  return `
    <div class="ds-live-head">
      <h2 class="ds-live-title" id="ds-live-title">${t('In context')}</h2>
      <button type="button" class="be-btn be-btn--sm ds-live-edit" data-ds-goto="color">${t('Edit in Colours')}</button>
    </div>
    <div class="ds-live-stage" style="--ds-live-ground:${escape(groundOf(scenes[shown]?.svg ?? ''))}">
      ${scenes.map((s, i) => `<figure class="ds-live-scene" data-live-figure="${i}"${i === shown ? '' : ' hidden'}><div class="ds-live-art">${s.svg}</div><figcaption class="visually-hidden">${escape(labels[i] ?? s.label)}</figcaption></figure>`).join('')}
      ${noir ? '<span class="fauna-slot" data-fauna="lorikeet" data-fauna-watch="specimen" aria-hidden="true"></span>' : ''}
    </div>
    ${segHtml('ds-live-scene', labels.slice(0, SCENE_COUNT).map((label, i) => ({ id: String(i), label })), String(shown), t('Preview scene'), { attr: 'data-live-scene', groupAttr: 'data-ds-live-scenes', extraClass: 'ds-live-scenes' })}
    ${noir ? `<p class="ds-live-note">${t('Starter greys until a colour is added.')}</p>` : ''}`;
}

// ── Mount ────────────────────────────────────────────────────────────────────

/**
 * Render the room into `el` and wire its doors. `el`'s `hidden` state is the
 * view's to set, and it is also what the palette subscription reads: a hidden
 * room skips the repaint (the view refreshes it on entry) rather than re-reading
 * the whole design system on every frame of a colour-wheel drag.
 */
export function mountOverviewRoom(el: HTMLElement, ctx: OverviewCtx): OverviewRoom {
  let alive = true;
  let seq = 0;
  /** The Logos card's object URLs, handed back when the card is repainted. */
  let markUrls: string[] = [];
  /** The scene the live column shows; kept across repaints. */
  let scene = 0;
  /** Whether the specimen last painted was the first run's greys. */
  let lastNoir: boolean | null = null;

  const release = (urls: readonly string[]): void => {
    for (const url of urls) {
      try { URL.revokeObjectURL(url); } catch { /* no blob-URL support - nothing to release */ }
    }
  };
  const marksOf = (model: OverviewModel | null): string[] => model?.marks?.map(m => m.url) ?? [];

  const paint = (model: OverviewModel | null): void => {
    el.innerHTML = overviewHtml(model);
    release(markUrls);
    markUrls = marksOf(model);
  };

  /** The palette the Colours room's own In context is painted from, so the two
   *  specimens are the same picture: its colours in its order when the editor
   *  is mounted, the active palette otherwise; the roles from the active system. */
  const specimenPalette = async (): Promise<{ colors: string[]; roles?: PalettePreviewOptions['roles'] }> => {
    const active = await activePalette(ctx.host.tokens, 'light');
    const fromRoom = ctx.editor()?.contextHexes?.() ?? [];
    return { colors: fromRoom.length ? fromRoom : active.colors, roles: active.roles };
  };

  /** Point the stage's ground at the scene in view. */
  const syncGround = (): void => {
    const live = ctx.live;
    const stage = live?.querySelector<HTMLElement>('.ds-live-stage');
    const fill = live?.querySelector(`[data-live-figure="${scene}"] svg rect`)?.getAttribute('fill') ?? '';
    if (stage && /^#[0-9a-f]{3,8}$/i.test(fill)) stage.style.setProperty('--ds-live-ground', fill);
  };

  const paintLive = async (model: OverviewModel, mine: number): Promise<void> => {
    const live = ctx.live;
    if (!live) return;
    const noir = boardState(model) === 'blank';
    const { colors, roles } = await specimenPalette().catch(() => ({ colors: [] as string[], roles: undefined }));
    if (!alive || mine !== seq || !live.isConnected) return;
    // The first colour turns the starter's greys into the person's palette: one
    // cross-fade from the last grey picture, never under either Reduce motion.
    const was = lastNoir === true && !noir && !prefersReducedMotion()
      ? live.querySelector<HTMLElement>('.ds-live-stage')?.cloneNode(true) as HTMLElement | undefined
      : undefined;
    live.innerHTML = liveHtml(palettePreviewSvgs(colors, { roles }), scene, noir);
    live.dataset.noir = String(noir);
    syncGround();
    lastNoir = noir;
    const stage = live.querySelector<HTMLElement>('.ds-live-stage');
    if (was && stage) {
      was.className = 'ds-live-was';
      was.setAttribute('aria-hidden', 'true');
      was.inert = true;
      was.querySelector('.fauna-slot')?.remove();
      stage.append(was);
      was.addEventListener('animationend', () => was.remove(), { once: true });
      // A tab that never runs the animation must not keep the grey picture.
      setTimeout(() => was.remove(), 2000);
    }
  };

  const refresh = (): void => {
    const mine = ++seq;
    void readOverview(ctx.host, { marks: true })
      .catch(() => EMPTY_MODEL)
      .then(model => {
        // A slower earlier read must not repaint over a newer one.
        if (alive && mine === seq && el.isConnected) {
          paint(model);
          void paintLive(model, mine);
        } else release(marksOf(model));
      });
  };

  const onClick = (e: Event): void => {
    const target = e.target as HTMLElement;
    const goto = target.closest<HTMLElement>('[data-ds-goto]');
    if (goto?.dataset.dsGoto) { ctx.goto(goto.dataset.dsGoto); return; }
    const door = target.closest<HTMLElement>('[data-ds-door]')?.dataset.dsDoor;
    // Each door is a room plus the control that should be open in it - the same
    // pair a `#/start?area=…&focus=…` link carries, so the door and the link
    // cannot describe different places.
    if (door === 'looks') ctx.openLooks?.();
    else if (door === 'file') ctx.openImport();
    else if (door === 'color-pick') ctx.goto('color', 'pick');
    else if (door === 'type-stage') ctx.goto('type', 'stage');
    else if (door === 'logos') ctx.goto('logos');
  };

  const onLiveClick = (e: Event): void => {
    const target = e.target as HTMLElement;
    const pick = target.closest<HTMLElement>('[data-live-scene]');
    if (pick && ctx.live) {
      scene = Math.min(SCENE_COUNT - 1, Math.max(0, Number(pick.dataset.liveScene) || 0));
      ctx.live.querySelectorAll<HTMLElement>('[data-live-figure]').forEach(fig => { fig.hidden = fig.dataset.liveFigure !== String(scene); });
      ctx.live.querySelectorAll<HTMLElement>('[data-live-scene]').forEach(btn => { btn.setAttribute('aria-pressed', String(btn === pick)); });
      syncGround();
      return;
    }
    const goto = target.closest<HTMLElement>('[data-ds-goto]');
    if (goto?.dataset.dsGoto) ctx.goto(goto.dataset.dsGoto);
  };

  paint(null);
  el.addEventListener('click', onClick);
  ctx.live?.addEventListener('click', onLiveClick);
  // A palette change lands here from anywhere in the studio, including rooms
  // that repaint on every frame of a wheel drag - so only a VISIBLE overview
  // re-reads. A hidden one is caught by the refresh() the view runs on entry.
  const unsubscribe = ctx.editor()?.onPalette(() => { if (!el.hidden) refresh(); }) ?? ((): void => {});
  refresh();

  return {
    refresh,
    teardown: () => {
      alive = false;
      unsubscribe();
      el.removeEventListener('click', onClick);
      ctx.live?.removeEventListener('click', onLiveClick);
      release(markUrls);
      markUrls = [];
    },
  };
}
