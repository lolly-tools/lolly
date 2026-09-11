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
 *    door into its room. Counts, never a progress bar: nothing here is owed.
 *
 * The website door (plan 97 section 9) is deliberately absent rather than disabled - 
 * it arrives with M6, gated on a transport that actually works, and a greyed
 * third door would advertise something nobody can use.
 *
 * Reads only. Nothing in this room writes tokens; the rooms it opens do.
 */

import { summarizeTokensDoc, createTokenSet } from '@lolly/engine';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { listLogos } from '../../brand-logos.ts';
import { roleAssignments } from '../roles.ts';
import { activeDesignSystemSource } from '../active.ts';
import { reportOwnership, isNeutralRampKey, radiusValue, FONT_ROLES } from '../ownership.ts';
import type { ColorRef, OwnershipReport } from '../ownership.ts';
import { brandFontFamilies } from '../../register-user-fonts.ts';
import { primaryFontFamily, displayFontFamily, monoFontFamily, italicFontFamily } from '../../../user-fonts.ts';
import type { BrandEditorHandle } from '../../brand-editor.ts';
import { icon } from '../../icons.ts';
import { escape } from '../../../utils.ts';
import { t, tRaw } from '../../../i18n.ts';

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
}

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

/** The starter catalog's placeholder tokens asset (brands/lolly-start). Matching
 *  it is the shell's existing "unbranded" test - views/gallery.ts gates the
 *  first-run welcome on the same id - and it is the one tokens asset that means
 *  nothing has been furnished yet. Exported because the Colours room needs the
 *  same asset for the same reason (a starter swatch it did not write), and two
 *  copies of a well-known id is how they drift apart. */
export const STARTER_TOKENS_ID = 'lolly/tokens/brand';

const EMPTY_MODEL: OverviewModel = {
  furnished: false, colors: [], colorCount: 0, fonts: [], logoCount: 0, tokenCount: 0, starterCount: 0,
};

/**
 * The shipped starter document (brands/lolly-start's tokens asset), or null.
 *
 * A first write copies that whole ramp into the user's own document, so from
 * then on the user owns 25 colours nobody chose. Reading the SHIPPED bytes back
 * is what lets a caller tell those apart from the ones a person added, by
 * comparing path and value - no schema change, no flag on the token, and
 * nothing to migrate on a document that predates the idea.
 *
 * Null on any brand whose catalog ships no such asset (SUSE's, an ingested
 * pack), and null before boot sync has cached it - both mean "nothing to
 * attribute", which is exactly the behaviour every caller had before.
 */
export async function readStarterDoc(host: OverviewHost): Promise<unknown> {
  const assets = host.assets as unknown as { _getBlob?(id: string): Promise<Blob | null> };
  try {
    const blob = await assets._getBlob?.(STARTER_TOKENS_ID);
    return blob ? JSON.parse(await blob.text()) : null;
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
    .filter(r => starter.get(r.key) !== current.get(r.key)).length > 1;
}

/**
 * Collect what the design system currently holds.
 *
 * Reads `host.tokens.colors()` directly rather than lib/live-palette.ts, whose
 * per-host cache never busts: this room repaints after an install, and a cached
 * palette would show the colours the page opened with.
 */
export async function readOverview(host: OverviewHost): Promise<OverviewModel> {
  const assets = host.assets as unknown as { _findMetaByType?(type: string): Promise<{ id: string } | null> };
  const tokens = host.tokens as unknown as {
    colors?(opts?: { theme?: string }): Promise<Array<{ value: string; path?: string }>>;
    raw?(): Promise<unknown>;
  } | undefined;

  // "Furnished" is about whether a design system EXISTS here, not about who
  // installed it. bridge/tokens.ts resolves an unlocked catalog's own tokens doc
  // when there is no user install, so host.tokens below would answer with that
  // pack's full palette - and an "Nothing here yet" empty state over a painted
  // Colours room is simply false. The genuinely empty cases are the SHIPPED
  // design system being the active one (plans/186 section 3.3) and, with no
  // registry to ask, the starter placeholder - the shell's own unbranded signal.
  if ((await activeDesignSystemSource(host)) === 'shipped') return EMPTY_MODEL;
  let tokensId = '';
  try { tokensId = (await assets._findMetaByType?.('tokens'))?.id ?? ''; }
  catch { /* discovery unavailable - treat as not installed here */ }
  if (!tokensId || tokensId === STARTER_TOKENS_ID) return EMPTY_MODEL;

  const swatches = await tokens?.colors?.().catch(() => []) ?? [];
  const doc = await tokens?.raw?.().catch(() => null) ?? null;
  let tokenCount = 0;
  try { tokenCount = doc ? summarizeTokensDoc(doc).tokenCount : 0; }
  catch { /* an unreadable doc still shows its palette */ }

  const families = await Promise.all([
    primaryFontFamily(host as unknown as Parameters<typeof primaryFontFamily>[0]).catch(() => ''),
    displayFontFamily(host as unknown as Parameters<typeof displayFontFamily>[0]).catch(() => ''),
    monoFontFamily(host as unknown as Parameters<typeof monoFontFamily>[0]).catch(() => ''),
    italicFontFamily(host as unknown as Parameters<typeof italicFontFamily>[0]).catch(() => ''),
  ]);

  // listLogos mints an object URL per slot for its previews; this room only
  // counts them, so hand every one straight back rather than leaking it.
  const logos = await listLogos(host as unknown as Parameters<typeof listLogos>[0]).catch(() => []);
  for (const logo of logos) {
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
    logoSlots: logos.map(l => ({ variant: l.variant, filled: true })),
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
  // A key-only read (bridge/assets.ts `_userAssetsCount`), so the Files card can
  // say "Nothing yet" without loading a single blob. Undefined when the store
  // cannot answer, which the card reads as "say nothing".
  const files = host.assets as unknown as { _userAssetsCount?(): Promise<number> };
  const fileCount = await files._userAssetsCount?.().catch(() => undefined);

  return {
    furnished: true,
    colors: own.slice(0, STRIP_MAX),
    // The two halves, not `colors.size`: the map is keyed by token path and a
    // bridge that answered without one would collapse those entries into it.
    colorCount: ownership.counts.ownColors + ownership.counts.starterColors,
    fonts: [...new Set(families.filter(Boolean))],
    logoCount: logos.length,
    tokenCount,
    starterCount: inherited.length,
    ownColorCount: ownership.counts.ownColors,
    starterColors: inherited.slice(0, STARTER_STRIP_MAX),
    radius: { value: radiusValue(doc) || DEFAULT_RADIUS, own: ownership.radius === 'own' },
    fileCount,
    ownership,
    worthExporting: isWorthExporting(swatches, starter, doc, ownership.counts.ownColors),
  };
}

// ── Markup ───────────────────────────────────────────────────────────────────

const countLabels = {
  colors: (n: number): string => t(n === 1 ? '{n} colour' : '{n} colours', { n }),
  logos: (n: number): string => t(n === 1 ? '{n} logo' : '{n} logos', { n }),
  tokens: (n: number): string => t(n === 1 ? '{n} token' : '{n} tokens', { n }),
};

/** The muted half of a card's value line - the starter suffix, the role a face
 *  serves. Trusted markup out, escaped text in. */
const suffix = (text: string): string => `<small class="ds-ov-sub-value">${escape(text)}</small>`;

/**
 * The Colours card's value: the person's own count, with the starter's as a
 * muted suffix behind it.
 *
 * Own counts LEAD (plan 182 section 4.2). "26 colours" after one add reads as a
 * system somebody built; "1 colour · 25 starter" says which part is theirs, and
 * on the blank brand - whose only inherited colours are the scaffolding neutrals
 * the Tokens room owns - there is no suffix at all.
 */
function colorsValue(model: OverviewModel): string {
  const starter = model.starterCount ?? 0;
  const own = model.ownColorCount ?? Math.max(0, model.colorCount - starter);
  return escape(countLabels.colors(own))
    + (starter > 0 ? ` ${suffix(tRaw('· {m} starter', { m: starter }))}` : '');
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

/**
 * The Type card, by ROLE: the faces the person chose lead, and whatever is still
 * the starter's is named underneath rather than counted in.
 *
 * A `follows` role is folded into the role it follows (the grammar table in plan
 * 182 section 4.2) - it repeats a decision rather than making one - so only a
 * declared face that came with the app can put a family in the starter line.
 * Without an ownership report there is nothing to attribute, so the card falls
 * back to the plain family list it has always shown.
 */
function typeCard(model: OverviewModel): { value: string; sub: string } {
  const faces = model.ownership?.faces;
  if (!faces) {
    return { value: escape(model.fonts.length ? model.fonts.join(', ') : t('Not set')), sub: '' };
  }
  // A role the report does not carry is a role nothing can be said about - read
  // through, never off the end (a report is built per host, and a degraded one
  // must not take the card down with it).
  const stateOf = (role: (typeof FONT_ROLES)[number]): string => faces[role]?.state ?? '';
  const familyOf = (role: (typeof FONT_ROLES)[number]): string => faces[role]?.family ?? '';
  const own = FONT_ROLES.filter(role => stateOf(role) === 'own');
  const rest = FONT_ROLES.filter(role => stateOf(role) === 'inherited' || stateOf(role) === 'unset');
  const restFamilies = [...new Set(rest.map(familyOf).filter(Boolean))];
  const value = own.length
    ? own.map(role => `${escape(familyOf(role))} ${suffix(faceRoleWord(role))}`).join(' · ')
    : escape(t('Not set'));
  const sub = restFamilies.length
    ? (own.length
      ? tRaw('Starter for the rest · {families}', { families: restFamilies.join(', ') })
      : tRaw('Starter · {families}', { families: restFamilies.join(', ') }))
    : '';
  return { value, sub };
}

/** The Tokens card's sub-line: the one shape token, and who set it. */
function radiusLine(model: OverviewModel): string {
  const radius = model.radius;
  if (!radius) return '';
  return radius.own
    ? tRaw('Corner radius · {value}', { value: radius.value })
    : tRaw('Corner radius · starter {value}', { value: radius.value });
}

/** A card's own sub-line - the muted line under the value. */
const cardSub = (text: string): string =>
  (text ? `<span class="ds-ov-card-note">${escape(text)}</span>` : '');

function doorHtml(door: string, glyph: string, name: string, note: string): string {
  return `
    <button type="button" class="ds-ov-door" data-ds-door="${escape(door)}">
      <span class="ds-ov-door-ic" aria-hidden="true">${glyph}</span>
      <span class="ds-ov-door-name">${escape(name)}</span>
      <span class="ds-ov-door-note">${escape(note)}</span>
    </button>`;
}

/** One card. `valueHtml` is TRUSTED markup - every call site escapes its own
 *  text (see {@link suffix}) - because the value line carries a muted suffix. */
function cardHtml(area: string, label: string, valueHtml: string, body = ''): string {
  return `
    <button type="button" class="ds-ov-card" data-ds-goto="${escape(area)}">
      <span class="ds-ov-card-label">${escape(label)}</span>
      <span class="ds-ov-card-value">${valueHtml}</span>
      ${body}
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

/** The room's markup for a model, or the resting line while the read runs. */
export function overviewHtml(model: OverviewModel | null): string {
  if (!model) return `<p class="ds-ov-loading">${t('Reading the design system…')}</p>`;

  if (!model.furnished || !hasOwnMaterial(model)) {
    // One door per thing somebody might already have. A complete .lolly pack is
    // as immediate as one colour; the in-between cases stay first-class and can
    // be mixed freely. Each opens with its deciding control already up.
    return `
      <div class="ds-ov ds-ov--empty">
        <h2 class="ds-ov-title">${t('Nothing here yet')}</h2>
        <p class="ds-ov-sub">${t('Add one thing, and keep going whenever you like. Everything stays on this device.')}</p>
        <div class="ds-ov-doors">
          ${doorHtml('color-pick', icon('palette'), t('Pick a colour'),
            t('It becomes the primary. Shades and roles can follow from it.'))}
          ${doorHtml('file', icon('upload'), t('Bring a file'),
            '.lolly · JSON · Penpot · PDF · SVG')}
          ${doorHtml('type-stage', icon('font'), t('Choose a face'),
            t('Google Fonts or a font file. Stays on this device.'))}
          ${doorHtml('logos', icon('shapes'), t('Add a logo'),
            t('Drop a mark; Lolly reads its shape and offers the right slot.'))}
        </div>
        <p class="ds-ov-bring">${t('Nothing installs until you choose one.')} <a class="ds-ov-inline" href="#/">${escape(t('Explore the tools'))}</a>.</p>
      </div>`;
  }

  // Own colours lead; the starter's follow a hairline, faded, and only when
  // there are any to show at all.
  const chips = (values: string[], cls: string): string => values
    .map(hex => `<span class="ds-ov-chip${cls}" style="background:${escape(hex)}"></span>`).join('');
  const starterChips = model.starterColors?.length
    ? `<span class="ds-ov-strip-rule"></span>${chips(model.starterColors, ' is-starter')}`
    : '';
  const strip = model.colors.length || starterChips
    ? `<span class="ds-ov-strip" aria-hidden="true">${chips(model.colors, '')}${starterChips}</span>`
    : '';
  const type = typeCard(model);
  const files = model.fileCount === 0 ? t('Nothing yet') : '';

  return `
    <div class="ds-ov">
      <h2 class="ds-ov-title">${t('The design system')}</h2>
      <p class="ds-ov-sub">${t('This is live. Every tool, page and export follows it. Open a room to change anything.')}</p>
      <div class="ds-ov-cards">
        ${cardHtml('color', t('Colours'), colorsValue(model), strip)}
        ${cardHtml('type', t('Type'), type.value, cardSub(type.sub))}
        ${cardHtml('logos', t('Logos'),
          model.logoCount ? escape(countLabels.logos(model.logoCount)) : escape(t('Not set')),
          model.logoCount ? '' : cardSub(t('Horizontal, vertical, custom marks')))}
        ${cardHtml('tokens', t('Tokens'), escape(countLabels.tokens(model.tokenCount)), cardSub(radiusLine(model)))}
        ${cardHtml('catalogue', t('Files'), escape(t('Uploads and downloads')), cardSub(files))}
      </div>
      <div class="ds-ov-more">
        <button type="button" class="be-btn" data-ds-door="file">${t('Add from…')}</button>
        <button type="button" class="be-btn" data-ds-door="color-pick">${t('Pick a colour')}</button>
        <a class="ds-ov-exit" href="#/">${t('Explore the tools')}</a>
      </div>
    </div>`;
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

  const paint = (model: OverviewModel | null): void => { el.innerHTML = overviewHtml(model); };

  const refresh = (): void => {
    const mine = ++seq;
    void readOverview(ctx.host)
      .catch(() => EMPTY_MODEL)
      // A slower earlier read must not repaint over a newer one.
      .then(model => { if (alive && mine === seq && el.isConnected) paint(model); });
  };

  const onClick = (e: Event): void => {
    const target = e.target as HTMLElement;
    const goto = target.closest<HTMLElement>('[data-ds-goto]');
    if (goto?.dataset.dsGoto) { ctx.goto(goto.dataset.dsGoto); return; }
    const door = target.closest<HTMLElement>('[data-ds-door]')?.dataset.dsDoor;
    // Each door is a room plus the control that should be open in it - the same
    // pair a `#/start?area=…&focus=…` link carries, so the door and the link
    // cannot describe different places.
    if (door === 'file') ctx.openImport();
    else if (door === 'color-pick') ctx.goto('color', 'pick');
    else if (door === 'type-stage') ctx.goto('type', 'stage');
    else if (door === 'logos') ctx.goto('logos');
  };

  paint(null);
  el.addEventListener('click', onClick);
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
    },
  };
}
