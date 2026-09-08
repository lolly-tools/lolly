// SPDX-License-Identifier: MPL-2.0
/**
 * Brand studio - the ONE place brand primitives are created, edited, saved,
 * imported and exported. Mounted exclusively by #/start (the Dashboard's
 * Design-system tab is a read-only rendering of the result; user preferences
 * like the app theme live on #/profile - that separation is the whole point).
 *
 * The studio renders five tab panels, each wrapped in `[data-be-tab-panel]`;
 * the host view (start.ts) drives visibility by setting `data-active-tab` on
 * the editor root - every panel stays mounted (and wired) whichever tab shows:
 *
 *  1. logos - the Logos room (plan 97 section 7.3). Level 0 is one multi-file drop
 *                 zone: each file is classified (classify-logo.ts), proposes one
 *                 of the eight slots and waits as a confirm chip, and a placed
 *                 colour SVG offers generated mono / reverse siblings. Under it,
 *                 unchanged, the canonical orientation × treatment matrix
 *                 (brand-logos.ts), user-named custom marks ("icon", "crest")
 *                 and additional logo identities. Every placement runs the
 *                 shared trim-to-content offer first (trim-offer.ts), and an SVG
 *                 feeds the Colours room's "found in the logo" primary
 *                 suggestion, with its other colours going to the tray.
 *  2. color - the Colours room (plan 97 section 7.1). Level 0 leads: "Add a colour"
 *                 writes exactly one token, and the Roles strip says which
 *                 swatch plays each part. The expert controls - Generate a
 *                 starter palette, Shade curves, Contrast, Print - are folded
 *                 into four wings below it. The palette (every swatch an
 *                 editable tile + the OKLCH wheel) and optional gradient tokens
 *                 sit in the side pane.
 *  3. type - the Type room (plan 97 section 7.2). Level 0 is four ROLE CARDS
 *                 (Primary, Headings, Code, Italic - brand-vars.ts's FONT_SLOTS),
 *                 each showing the face that serves it on a live one-line
 *                 specimen. A card opens the COMPARE STAGE inline
 *                 (design-system/type-compare.ts): Google families by name,
 *                 dropped font files, and font candidates a source scan left in
 *                 the tray all stand side by side on one editable specimen at
 *                 one size, and NOTHING installs until a card is chosen. The
 *                 stage previews faces as session-scoped FontFaces and installs
 *                 nothing itself - `applyTypeChoice` here is the only writer
 *                 (installGoogleFont / installFontFromBytes, then the role).
 *                 Below it: the management list of installed families (roles,
 *                 delete), the font-file upload panel, and the full four-role
 *                 specimen.
 *  4. tokens - the corner radius plus every other non-colour primitive
 *                 (spacing, sizing, stroke, opacity, rotation, numbers, shadows
 * - lib/token-studio.ts).
 *  5. catalogue - brand asset uploads, sorted the same way the Catalogue view
 *                 sorts them (vector / image / audio / motion).
 *
 * Everything persists to the active design system's head via the bridge's
 * single write chokepoint (installUserTokens → bust → the next get()/colors()/
 * resolve() re-reads). ONE save discipline (plan 97 section 6): every commit-level
 * action persists immediately and a session undo stack (Ctrl/Cmd+Z, scoped to
 * the Colours room) is the safety net - there is no draft, no dirty flag, and
 * no confirm dialog where an undo suffices.
 * Import/export of the whole brand pack is exposed on the handle
 * (exportPack/importPack) so the host view owns those buttons' placement.
 *
 * A LOCKED build (host.tokens.isLocked()) exposes none of this - the caller
 * renders a read-only note instead. Everything is best-effort and DOM-guarded:
 * a detached editor (route changed mid-op) never writes to a dead node.
 */

import '../styles/parts/brand-studio.css'; // every .be-* rule - rides this module's lazy chunk
import '../styles/parts/tool.css';         // .help-tip-btn/-pop/-host - the shared chunk the tool
                                           // view and /profile already pull for the same primitive
import './oklch-slice.css';                // the gamut chart's .okls-* rules (see oklch-slice.ts)
import type { Unzipped } from 'fflate';
import { deriveBrandTokens, createTokenSet, colorToHex, parseColor as parseCssColor, convertColor, colorToHexString, aliasPath, contrastRatio, apcaContrast, rampOklab, extractSvgColors, hexToOklch, formatOklch, parseOklch, deserializeCurve, RAMP_STEPS_MIN, RAMP_STEPS_MAX, SCHEME_KINDS, generateSchemeAccents, generateAnalogous,
  // `formatColor` is ALIASED: this module already imports a different one from
  // ./color-formats.ts (`formatColor('cmyk', hex)`), and letting the two share a
  // name is how a call silently gets the wrong function.
  gamutMapSrgb, colorToSrgb, formatColor as formatCssColor, colorFaces } from '@lolly/engine';
import type { StoredFace } from '@lolly/engine';
import { parseProfileLimit, profileFor, mountedSources } from './color-profiles.ts';
import type { BrandDeriveOptions, SchemeKind, Oklch, ColorCurve } from '@lolly/engine';
import { nameColor } from './color-namer.ts';
import { palettePreviewSvgs } from './palette-preview.ts';
import { addDraftShades, draftShades } from './design-system/palette-draft.ts';
import { paletteHtml, mountPaletteGroupControls } from './design-system/palette-view.ts';
import { paletteGroups, addPaletteGroup, carryPaletteGroups, groupName } from './design-system/palette-groups.ts';
import type { HostV1, TokenSet } from '@lolly-tools/core/host-v1';
import type { WebTokensAPI } from '../bridge/tokens.ts';
import { installUserTokens } from '../bridge/tokens.ts';
import { isUserDesignSystemActive } from './design-system/active.ts';
import {
  isRec, prettify, walkSwatches, setSwatchValue, setSwatchName, deleteSwatch, addSwatch, setSwatchGroup, setSemanticRampAlias,
  setSwatchCmykLock, setSwatchSpotLock, getSwatchPrintOverride, primaryAnchorPath,
  getSwatchFaces, setSwatchFace, leafAt,
  getExcludedSwatches, setSwatchExcluded,
  getRampCurve, setRampCurve, seedRampCurve, reanchorCurve, overlayRampCurves, RAMP_IDS,
  contrastTargets, contrastLockCurve, rotateCurveHue, nudgeSwatch,
} from './brand-doc.ts';
import type { BrandSwatch, PrintLock, RampCurves, RampId, ContrastLockPreset } from './brand-doc.ts';
import { mountCurveEditor } from './curve-editor.ts';
import type { CurveEditorHandle } from './curve-editor.ts';
import { exportSwatches, type SwatchExportFormat } from './swatch-export.ts';
import type { SpotColor, FinishKind } from '@lolly-tools/core/host-v1';
import { applyChromeBrandVars, tokenValueToHex, brandRadiusValue, brandSpaceValue } from '../brand-vars.ts';
import { colorFieldHtml, wireColorField, setSwatches, refreshSwatches, contrastText } from '../components/color-field.ts';
import { STORAGE_FORMATS, formatColor, serializeColor, storageFormatOf } from './color-formats.ts';
import type { StorageFormat } from './color-formats.ts';
import {
  renderBrandWheel, wireBrandWheel, updateWheelDot, oklchToStored, oklchHex,
} from './palette-wheel.ts';
import type { WheelDot } from './palette-wheel.ts';
import {
  renderSliceChart, paintSliceChart, wireSliceChart, updateSliceDot,
  sliceFixedOf, SLICE_AXES, sliceCMax, formatFixed,
} from './oklch-slice.ts';
import type { SliceChartState, SliceDot } from './oklch-slice.ts';
import type { SlicePlane } from '@lolly/engine';
import { swatchTile, tileLabel } from './swatches.ts';
import {
  listUserFonts, installGoogleFont, installFontFromBytes, setPrimaryFont, setMonoFont, removeUserFont,
  primaryFontFamily, monoFontFamily, setBrandRadius, setBrandSpace,
  setDisplayFont, setItalicFont, displayFontFamily, italicFontFamily,
} from '../user-fonts.ts';
import type { UserFontsHost, UserFontFamily, FontRole } from '../user-fonts.ts';
import {
  LOGO_ORIENTATIONS, LOGO_TREATMENTS, ORIENTATION_META, TREATMENT_META, LOGO_SLUG_RE,
  splitVariant, variantLabel, listLogos, installLogo, removeLogo,
} from './brand-logos.ts';
import type { LogoVariant, LogoSlot } from './brand-logos.ts';
import { classifyLogoSvg, classifyLogoRasterStats } from './design-system/classify-logo.ts';
import type { LogoClassification } from './design-system/classify-logo.ts';
import { hasPendingLogoFiles, takePendingLogoFiles } from './design-system/pending-files.ts';
import { deriveMonoSvg, deriveReverseSvg, eligibleForDerivedVariants } from './design-system/recolor-logo.ts';
import { prepareTrim, mountTrimOffer } from './design-system/trim-offer.ts';
import { rasterAlphaBounds } from './design-system/trim-bounds.ts';
import { createTray, candidatesFromCensus } from './design-system/tray.ts';
import type { Tray } from './design-system/tray.ts';
import {
  mountTypeCompare, faceLine, collapsedFaceText, pinnedFaces, stageAfterIndex,
} from './design-system/type-compare.ts';
import type { CompareChoice, TypeCompare } from './design-system/type-compare.ts';
import { googleMatch, parseFaceName } from './design-system/font-resolve.ts';
import { censusFromSvgColors, censusHex } from './design-system/census.ts';
import { icon } from './icons.ts';
import { mountTokensPanel, mountGradientsPanel, mountCataloguePanel, panelHead } from './brand-studio-tabs.ts';
import { STUDIO_GROUPS, gradientAliasRefCount, materializeGradientAliases } from './token-studio.ts';
import { POPULAR_FAMILIES, PINNED_FAMILIES } from './google-fonts.ts';
import { exportBrandPack, importBrandPack } from '../brand-transfer.ts';
import type { BrandTransferHost } from '../brand-transfer.ts';
import { saveBlob } from '../pro/zip.ts';
import { confirmDialog } from '../components/confirm-dialog.ts';
import { fmtBytes } from './device-info.ts';
import { t, tRaw } from '../i18n.ts';
import { escape } from '../utils.ts';
import { segHtml } from './seg.ts';
import { announce } from '../a11y.ts';
import { prefersReducedMotion } from './a11y-prefs.ts';
import { playSfx } from './sfx.ts';
import { mountAddColor, COLOR_NOTATION_EXAMPLES } from './design-system/add-color.ts';
import type { ColorEntry } from './design-system/add-color.ts';
import { colourBeat } from './design-system/beats.ts';
import type { Beat } from './design-system/beats.ts';
import { createSelection } from './design-system/palette-select.ts';
import type { SelectTile } from './design-system/palette-select.ts';
import { readStarterDoc } from './design-system/rooms/overview.ts';
import { colorIdentity, starterColorIds, reportOwnership, FONT_ROLES } from './design-system/ownership.ts';
import type { FaceState } from './design-system/ownership.ts';
import { typeBeat } from './design-system/beats-type.ts';
import type { TypeBeat } from './design-system/beats-type.ts';
import { helpTip, wireHelpTips } from '../components/help-tip.ts';
import {
  ROLE_IDS, ROLE_IDS_ALL, roleLabel, readRoles, assignRole, clearRole, mountRolesStrip,
} from './design-system/roles.ts';
import type { RoleId } from './design-system/roles.ts';

// ── Host shape ──────────────────────────────────────────────────────────────
// The editor reads/writes tokens, fonts and brand packs. Every real web host
// (createBridge) satisfies all three; the caller passes its HostV1 and the
// sub-APIs are reached through the same narrow casts the wizard/profile use.
type EditorHost = HostV1;
type Scheme = NonNullable<BrandDeriveOptions['scheme']>;
type Surface = NonNullable<BrandDeriveOptions['surface']>;
type Contrast = NonNullable<BrandDeriveOptions['contrast']>;
type Fg = NonNullable<BrandDeriveOptions['foreground']>;

const SCHEMES: ReadonlyArray<{ id: Scheme; label: string }> = [
  { id: 'mono', label: t('Mono') }, { id: 'complement', label: t('Complement') },
  { id: 'analogous', label: t('Analogous') }, { id: 'triad', label: t('Triad') },
];
// UI intensity - the surface look baked into the brand, collapsed from the old
// Light / Dark / Deep-primary trio to a single Muted ↔ Deep toggle. Light vs dark
// is the app THEME's job (the Theme picker), so this axis only carries how RICH the
// surface reads: `muted` = a neutral surface (light default); `deep` = the
// chroma-rich primary surface. The ids stay the engine's `surface` values so
// deriveBrandTokens is unchanged (see engine/src/brand-derive.ts).
const INTENSITIES: ReadonlyArray<{ id: Surface; label: string }> = [
  { id: 'light', label: t('Muted') }, { id: 'primary', label: t('Deep') },
];
const CONTRASTS: ReadonlyArray<{ id: Contrast; label: string }> = [
  { id: 'comfort', label: t('Comfort') }, { id: 'high', label: t('High') },
];
// What sits on top of the brand primary. Auto picks white/black by contrast;
// Light/Dark force it - the fix for a mid-tone brand colour that "should" wear
// white text but auto-flips to black for the higher ratio (see deriveBrandTokens).
const FOREGROUNDS: ReadonlyArray<{ id: Fg; label: string }> = [
  { id: 'auto', label: t('Auto') }, { id: 'light', label: t('Light') }, { id: 'dark', label: t('Dark') },
];
// The palette download formats, as the bulk bar's Download menu lists them
// (plan 182 section 5.5) - the same six lib/swatch-export.ts serves the pane's
// download dock. The dock keeps its own <select>, whose tokens-json option
// carries a "Penpot / Tokens Studio" note the menu has no room for.
const PALETTE_FORMATS: ReadonlyArray<{ id: SwatchExportFormat; label: string }> = [
  { id: 'tokens-json', label: t('Design tokens (JSON)') },
  { id: 'css-vars', label: t('CSS variables') },
  { id: 'css-classes', label: t('CSS classes') },
  { id: 'scss', label: t('SCSS variables') },
  { id: 'gpl', label: t('GIMP palette (.gpl)') },
  { id: 'ase', label: t('Adobe Swatch Exchange (.ase)') },
];
const DEFAULT_PRIMARY = '#4f83cc';
// The engine's own default for `secondary` (deriveBrandTokens hardcodes ramp
// step 5); `neutral` has no engine default to match since it's not a slot the
// engine emits at all - step 5 (the ramp's contrast-anchor step) is this
// editor's own sensible starting point for it.
const DEFAULT_RAMP_STEP = 5;

// ── Live derive preview (ramps + specimen), same recipe as the wizard ─────────

const slot = (set: TokenSet, name: string): string => {
  const v = set.resolve(`color.semantic.${name}`); return typeof v === 'string' ? v : '';
};
const ratioOf = (fg: string, bg: string): string => {
  try { const f = colorToHex(fg), b = colorToHex(bg); return f && b ? contrastRatio(f, b).toFixed(1) : ''; }
  catch { return ''; }
};
// APCA-W3 Lc, |rounded| - ADVISORY beside the WCAG number (it reads dark-mode
// and mid-tone pairs honestly where WCAG 2.1 misjudges); the derive floors
// stay WCAG-enforced. Rough anchors: 60 body text, 75 small text, 90 thin.
const apcaOf = (fg: string, bg: string): string => {
  try {
    const f = colorToHex(fg), b = colorToHex(bg);
    if (!f || !b) return '';
    const lc = apcaContrast(f, b);
    return Number.isFinite(lc) ? String(Math.round(Math.abs(lc))) : '';
  } catch { return ''; }
};
/**
 * One ramp's 9 steps. When `selected` is given the cells become buttons the
 * user can pick a step from (data-be-ramp/data-be-step carry which); the
 * chosen one gets `.is-selected` - the same ring treatment `.be-swatch` uses
 * in the Palette panel below. Omitted (the Primary ramp - it's already driven
 * by the colour field above) they stay plain, non-interactive swatches.
 */
// One-time, informed opt-in before any Google Fonts request. Adding a Google
// Font sends the family name and - unavoidably - the user's IP address to
// Google's servers. That is a third-party transfer the user gets to refuse, so
// it is gated here rather than only described in docs/privacy.md. Asked once and
// remembered: consent is per-purpose, not per-font, and re-prompting for every
// family would be nagging rather than informing.
const GOOGLE_FONTS_ACK = 'lolly-google-fonts-ok';

async function ensureGoogleFontsConsent(): Promise<boolean> {
  try { if (localStorage.getItem(GOOGLE_FONTS_ACK) === '1') return true; }
  catch { /* storage blocked - ask every time rather than assume yes */ }
  const ok = await confirmDialog({
    title: t('Fetch this font from Google?'),
    // Trimmed to the two facts and the one reassurance (plan 182 section 6.3): the
    // dialog now arrives on the press somebody just made, so it has to be
    // readable at a glance rather than skimmed past.
    message: t('Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.'),
    confirmLabel: t('Fetch from Google'),
  });
  if (!ok) return false;
  try { localStorage.setItem(GOOGLE_FONTS_ACK, '1'); } catch { /* not fatal */ }
  return true;
}

// ── Type room: the four role cards (plan 97 section 7.2, level 0) ───────────────────
/**
 * The faces the chrome, the tools and every export read - brand-vars.ts's
 * FONT_SLOTS, in the order the room shows them. `brand` is the TOKEN id and it
 * is never renamed (section 3 rule 9); "Primary" is the word on screen, because nobody
 * calls their body face "the brand face".
 *
 * `css` is the exact `font-family` value the card's specimen paints in, so each
 * card shows what its role RESOLVES to right now rather than what it was
 * assigned: an unset Headings card renders in the primary, because that is what
 * a heading actually wears today. The var chain is brand-vars.ts's own
 * (`--font-display` falls back to `--font-brand`), so a card cannot drift from
 * the chrome it is describing.
 */
interface TypeRoleDef {
  id: FontRole;
  css: string;
  /** The role IS the slant - the specimen has to lean or it says nothing. */
  slanted?: boolean;
  /** Sized down: a code line is longer and set tighter than display copy. */
  mono?: boolean;
}
const TYPE_ROLES: readonly TypeRoleDef[] = [
  { id: 'brand', css: 'var(--font-brand)' },
  { id: 'display', css: 'var(--font-display, var(--font-brand))' },
  { id: 'mono', css: 'var(--font-mono)', mono: true },
  { id: 'italic', css: 'var(--font-italic, var(--font-brand))', slanted: true },
];

/** Every role in the resting state, for the moment before the ownership read
 *  answers. `unset` is what "nothing read yet" honestly is - it prints no
 *  family and claims nothing. */
function blankFaces(): Record<FontRole, FaceState> {
  const out = {} as Record<FontRole, FaceState>;
  for (const role of FONT_ROLES) out[role] = { family: '', state: 'unset' };
  return out;
}

/** The role's name on screen. Called at render, not at module load, so a late
 *  locale still lands (the same reason the rooms build their markup in mount). */
function typeRoleLabel(role: FontRole): string {
  return role === 'brand' ? t('Primary')
    : role === 'display' ? t('Headings')
      : role === 'mono' ? t('Code') : t('Italic');
}

/** One short line per role - long enough to judge a face, short enough to stay
 *  on one line at any card width. The code line is a real command, not prose:
 *  a mono face is chosen on its digits, its zero and its punctuation. */
function typeRoleSample(role: FontRole): string {
  return role === 'brand' ? t('Body copy, buttons and every tool')
    : role === 'display' ? t('Headlines set the tone')
      : role === 'mono' ? 'lolly qr-code --export=svg 0O1lI'
        : t('Emphasis, quotations and asides');
}

/**
 * The role button's two strings, kept in one place because they have to agree.
 *
 * The button is icon-free but ROLE-free too: "Change" on its own would be four
 * identical buttons on four cards, so the accessible name names the role. WCAG
 * 2.5.3 (Label in Name) then requires the visible words to be IN that name - 
 * speech control says "click Change", and a name of "Change the Headings face"
 * matches while "Choose the Headings face" over a visible "Change" does not.
 * Both strings below are built so the visible label is a literal prefix of the
 * spoken one, in every state. `paintRoleCards` rewrites BOTH together.
 */
function typeRoleActStrings(roleLabel: string, isSet: boolean): { text: string; name: string } {
  return isSet
    ? { text: t('Change'), name: tRaw('Change the {role} face', { role: roleLabel }) }
    : { text: t('Choose a face'), name: tRaw('Choose a face for {role}', { role: roleLabel }) };
}

/**
 * One role card's markup. Part of the room's own scaffold write, so nothing
 * dynamic reaches it: every interpolation is a t() literal or an in-code
 * constant from TYPE_ROLES. The face name and the button's label are written
 * later as textContent by `paintRoleCards`, never as markup.
 */
function typeRoleCardHtml(def: TypeRoleDef): string {
  const label = typeRoleLabel(def.id);
  const act = typeRoleActStrings(label, false);
  return `
    <article class="be-typecard" data-be-typecard="${def.id}">
      <header class="be-typecard-head">
        <span class="be-typecard-role">${label}</span>
        <span class="be-typecard-face" data-be-typecard-face></span>
        ${/* The starter pill - the same recipe the palette's inherited groups
               wear (.be-pal-starter), because it is the same statement about the
               same kind of material. Empty and hidden until paintRoleCards says
               the face is one nobody chose. */''}
        <span class="be-pal-starter be-typecard-tag" data-be-typecard-tag hidden></span>
      </header>
      ${/* The card's one-line self while the stage is open (plan 182 section
             6.6). Same data, different template - the strip is what puts the
             stage on the first screen of a phone. */''}
      <span class="be-typecard-chip" data-be-typecard-chip></span>
      <p class="be-typecard-sample${def.mono ? ' be-typecard-sample--mono' : ''}"
        style="font-family:${def.css}${def.slanted ? ';font-style:italic' : ''}">${typeRoleSample(def.id)}</p>
      <button type="button" class="be-btn be-typecard-act" data-be-typecard-choose="${def.id}"
        aria-label="${escape(act.name)}"><span data-be-typecard-actlabel>${act.text}</span></button>
      ${def.id === 'brand'
      ? `<span class="be-typecard-note">${t('Nothing installs until you choose one.')}</span>`
      : ''}
    </article>`;
}

/** Per-ramp state of the tonal-curve affordance rendered on each ramp row:
 *  whether the ramp carries a user-tuned curve, and whether its editor is open. */
interface CurveMark { edited: boolean; open: boolean; }
type CurveMarks = Partial<Record<RampId, CurveMark>>;
/** The three ramps' display names. Module scope because the Colours room's
 *  markup (the Curves + Contrast wings' ramp picker) is built before any of the
 *  mount's own locals exist. */
const RAMP_LABEL: Record<RampId, string> = { primary: t('Primary'), neutral: t('Neutral'), secondary: t('Secondary') };
// A small tonal-curve glyph (a rising ease). Inline so it themes with currentColor.
const CURVE_GLYPH = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 13c4 0 4-10 12-10"/></svg>';

function rampRow(
  set: TokenSet, ramp: string, label: string, steps: number,
  opts: { selected?: number; curve?: CurveMark } = {},
): string {
  const selected = opts.selected;
  let cells = '';
  for (let i = 1; i <= steps; i++) {
    const v = set.resolve(`color.ramp.${ramp}.${i}`);
    const css = typeof v === 'string' ? v : 'transparent';
    const title = tRaw('{label} {step} · {value}', { label, step: i, value: css });
    cells += selected === undefined
      ? `<span class="be-ramp-cell" style="background:${escape(css)}" title="${escape(title)}"></span>`
      : `<button type="button" class="be-ramp-cell${i === selected ? ' is-selected' : ''}" style="background:${escape(css)}"
           title="${escape(title)}" data-be-ramp="${escape(ramp)}" data-be-step="${i}"
           aria-pressed="${i === selected}" aria-label="${escape(title)}"></button>`;
  }
  // The curve-edit toggle (all three ramps). `is-edited` = a curve is stored;
  // `is-open` = this ramp's editor is showing. Its click is handled by the
  // preview's own [data-be-curve] delegate, never the step-pick one.
  const cm = opts.curve;
  const curveBtn = cm
    ? `<button type="button" class="be-ramp-curve${cm.edited ? ' is-edited' : ''}${cm.open ? ' is-open' : ''}"
         data-be-curve="${escape(ramp)}" aria-pressed="${cm.open}"
         title="${escape(tRaw('Edit the {label} tonal curve', { label }))}"
         aria-label="${escape(tRaw('Edit the {label} tonal curve', { label }))}">${CURVE_GLYPH}</button>`
    : '';
  return `<div class="be-ramp-row"><span class="be-ramp-label">${escape(label)}</span><div class="be-ramp" role="${selected === undefined ? 'img' : 'group'}" aria-label="${escape(tRaw('{label} ramp', { label }))}">${cells}</div>${curveBtn}</div>`;
}
/**
 * The primary→secondary hue bridge: `rampOklab` through the two semantic
 * anchors, perceptually even (lightness-corrected) - the in-between colours a
 * gradient or chart can safely borrow. Display-only spans, mirroring the
 * non-interactive Primary row's treatment.
 */
function blendRow(set: TokenSet, steps: number): string {
  const a = set.resolve('color.semantic.primary');
  const b = set.resolve('color.semantic.secondary');
  if (typeof a !== 'string' || typeof b !== 'string') return '';
  let hexes: string[];
  try { hexes = rampOklab([a, b], steps, { correctLightness: true }); } catch { return ''; }
  const cells = hexes.map((hex, i) =>
    `<span class="be-ramp-cell" style="background:${escape(hex)}" title="${escape(tRaw('Blend {step} · {value}', { step: i + 1, value: hex }))}"></span>`).join('');
  return `<div class="be-ramp-row"><span class="be-ramp-label" title="${escape(t('Primary → Secondary, perceptually even (OKLab)'))}">${t('Blend')}</span><div class="be-ramp" role="img" aria-label="${escape(t('Primary to secondary blend'))}">${cells}</div></div>`;
}
function specCard(name: string, set: TokenSet): string {
  const s = slot(set, 'surface'), text = slot(set, 'text'), muted = slot(set, 'muted');
  const edge = slot(set, 'edge'), prim = slot(set, 'primary'), on = slot(set, 'on-primary');
  const ratio = ratioOf(text, s);
  const lc = apcaOf(text, s);
  const btnTip = tRaw('Primary button - WCAG {ratio}:1 · APCA Lc {lc} (advisory)', { ratio: ratioOf(on, prim), lc: apcaOf(on, prim) });
  const ratioTip = tRaw('Text on surface - WCAG {ratio}:1 · APCA Lc {lc} (advisory: 60≈body, 75≈small text)', { ratio, lc });
  return `
    <article class="be-spec" style="background:${escape(s)};border-color:${escape(edge)}">
      <span class="be-spec-name" style="color:${escape(muted)}">${escape(name)}</span>
      <h4 class="be-spec-h" style="color:${escape(text)}">${t('The quick brown fox')}</h4>
      <p class="be-spec-b" style="color:${escape(muted)}">${t('Body copy sits one step back - calm and unmistakably yours.')}</p>
      <div class="be-spec-row">
        <span class="be-spec-btn" style="background:${escape(prim)};color:${escape(on)}" title="${escape(btnTip)}">${t('Primary')}</span>
        ${ratio ? `<span class="be-spec-ratio" style="color:${escape(muted)}" title="${escape(ratioTip)}">${escape(ratio)}:1${lc ? ` · Lc ${escape(lc)}` : ''}</span>` : ''}
      </div>
    </article>`;
}
/** `deriveBrandTokens`, swallowing an unparseable primary (mid-edit hex). */
function deriveSafe(opts: BrandDeriveOptions): Record<string, unknown> | null {
  try { return deriveBrandTokens(opts) as Record<string, unknown>; } catch { return null; }
}
function previewHtml(doc: Record<string, unknown>, sel: { neutral: number; secondary: number; steps: number; curves?: CurveMarks; palette?: string[] }): string {
  const light = createTokenSet(doc, { theme: 'light' });
  const dark = createTokenSet(doc, { theme: 'dark' });
  const present = new Set(sel.palette?.map(hex => hex.toLowerCase()));
  const choices = RAMP_IDS.map(ramp => {
    const shades = draftShades(doc, ramp);
    const remaining = shades.filter(shade => !present.has(shade.hex.toLowerCase())).length;
    const label = RAMP_LABEL[ramp];
    return `<section class="be-draft-ramp"><div class="be-draft-head"><h3>${escape(label)}</h3><button type="button" class="be-btn be-btn--sm" data-be-add-ramp="${ramp}"${remaining ? '' : ' disabled'}>${remaining ? remaining === 1 ? t('Add 1 shade') : tRaw('Add {n} shades', { n: remaining }) : t('Already in palette')}</button></div><div class="be-draft-shades">${shades.map(shade => {
      const added = present.has(shade.hex.toLowerCase());
      return `<button type="button" class="be-draft-shade" data-be-add-shade="${shade.key}" style="background:${escape(shade.hex)};color:${contrastText(shade.hex)}" aria-label="${escape(added ? tRaw('{label} shade {step} is in your palette', { label, step: shade.step }) : tRaw('Add {label} shade {step}, {hex}', { label, step: shade.step, hex: shade.hex }))}" title="${escape(shade.hex)}"${added ? ' disabled' : ''}>${added ? icon('check', { size: 14 }) : '<span aria-hidden="true">+</span>'}</button>`;
    }).join('')}</div></section>`;
  }).join('');
  return `${choices}
    <details class="be-draft-themes"><summary>${t('Theme preview')}</summary><p class="be-gen-note">${t('Examples using these shades. Adding shades keeps your current theme roles.')}</p>
    <div class="be-ramps">${rampRow(light, 'primary', t('Primary'), sel.steps, {})}${rampRow(light, 'neutral', t('Neutral'), sel.steps, { selected: sel.neutral })}${rampRow(light, 'secondary', t('Secondary'), sel.steps, { selected: sel.secondary })}${blendRow(light, sel.steps)}</div>
    <div class="be-specs">${specCard(t('Light'), light)}${specCard(t('Dark'), dark)}</div></details>`;
}

// `segHtml` moved to lib/seg.ts (component audit rec 1 - the one `.view-seg`
// primitive, shared beyond the brand studio); re-exported here for compat with
// anything still importing it from this module.
export { segHtml };

// ── Shared print-lock control (independent CMYK lock + Spot-colour lock) ─────
// One control, two mounts: the Colour panel's primary field and the Palette
// panel's swatch popover (see mountPrintLock's two call sites below). CMYK and
// spot are independent (see brand-doc.ts's PrintLock doc comment) - a swatch
// may carry either, both, or neither: CMYK is the process-colour fallback used
// for preview / non-PDF export / the PDF Separation tint-transform's alternate
// space whether or not a spot is also set, so locking a named ink never
// discards a separately-tuned CMYK build.

/** The auto sRGB→CMYK conversion of a hex (C,M,Y,K 0–100) - the value the CMYK
 *  block seeds from when first locked, and what it shows while auto. */
const autoCmykOf = (hex: string): [number, number, number, number] => {
  const p = formatColor('cmyk', hex).split(',').map(n => Math.round(parseFloat(n)) || 0);
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 0];
};

/** Same JSON key path - used to tell whether the Palette panel's currently-edited
 *  swatch IS the primary ramp's anchor step, so the two print-lock controls that
 *  can both touch it stay reconciled (see primaryPrintLock's doc comment). */
const samePath = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((seg, i) => seg === b[i]);

/** The finishes a brand may declare an ink to BE. Ids are stable and canonical - 
 *  they become plate names in PDF finish-plate emission, so this is format
 *  vocabulary, not brand data; the brand's *choice* among them is the data, and
 *  it rides `$extensions` (no schema change, see setSwatchSpotLock).
 *
 *  Deliberately not split by foil colour (no `foil-gold`/`foil-silver`): the
 *  spot's own name + colour already say which foil it is, and duplicating that
 *  here would drift. A later slice can prepend brand-declared entries to this
 *  list without any type change - `finish` is an open union. */
const FINISHES: ReadonlyArray<{ id: string; label: () => string }> = [
  { id: 'foil', label: () => t('Foil') },
  { id: 'emboss', label: () => t('Emboss') },
  { id: 'deboss', label: () => t('Deboss') },
  { id: 'spot-uv', label: () => t('Spot UV') },
  { id: 'soft-touch', label: () => t('Soft touch') },
  // 'Die cut', not 'Cut' - the bare word is already a chrome string owned by the
  // timeline panel's video-cut junction kind, and translates as the editing verb.
  { id: 'cut', label: () => t('Die cut') },
  { id: 'crease', label: () => t('Crease') },
  { id: 'perforate', label: () => t('Perforate') },
];
/** A finish id's display label - falls back to the raw id so a brand-declared
 *  finish this build doesn't know still reads as itself, never as blank. */
const finishLabel = (id: string): string => FINISHES.find(f => f.id === id)?.label() ?? prettify(id);

function printLockHtml(): string {
  return `
    <div class="be-lock" data-be-lock>
      <div class="be-lock-block" data-be-lock-block="cmyk">
        <div class="be-subst-line">
          <span class="be-subst-key">CMYK</span>
          <code class="be-subst-val" data-be-lock-readout="cmyk"></code>
        </div>
        ${segHtml('lock-cmyk', [{ id: 'auto', label: t('Auto') }, { id: 'locked', label: t('Locked') }], 'auto', t('CMYK print colour'))}
        <div class="be-lock-body" data-be-lock-cmyk-body hidden>
          <div class="be-cmyk-inputs">
            ${['C', 'M', 'Y', 'K'].map((l, i) => `<label class="be-cmyk-in"><span>${l}</span><input type="number" min="0" max="100" step="1" inputmode="numeric" data-be-lock-c="${i}" aria-label="${l === 'K' ? t('Black') : l === 'C' ? t('Cyan') : l === 'M' ? t('Magenta') : t('Yellow')} %"></label>`).join('')}
          </div>
        </div>
      </div>
      <div class="be-lock-block" data-be-lock-block="spot">
        <div class="be-subst-line">
          <span class="be-subst-key">${t('Spot colour')}</span>
          <code class="be-subst-val" data-be-lock-readout="spot"></code>
        </div>
        ${segHtml('lock-spot', [{ id: 'none', label: t('None') }, { id: 'set', label: t('Set') }], 'none', t('Spot colour lock'))}
        <div class="be-lock-spot" data-be-lock-spot-body hidden>
          <label class="be-lock-field"><span>${t('Name')}</span><input type="text" data-be-lock-name placeholder="PANTONE 186 C" autocomplete="off" spellcheck="false"></label>
          <label class="be-lock-field"><span>${t('Book')} <em>${t('(optional)')}</em></span><input type="text" data-be-lock-book placeholder="PANTONE+ Solid Coated" autocomplete="off" spellcheck="false"></label>
          <label class="be-lock-field"><span>${t('Finish')} <em>${t('(optional)')}</em></span><select data-be-lock-finish aria-label="${t('Print finish')}">
            <option value="">${t('Ordinary ink')}</option>
            ${FINISHES.map(f => `<option value="${escape(f.id)}">${escape(f.label())}</option>`).join('')}
          </select></label>
        </div>
      </div>
    </div>`;
}

// ── Per-space faces: what this colour becomes everywhere else ────────────────
// The generalisation of the print lock, per plans/60-color-spaces.md section 11.3. Each
// row is a target the swatch can be expressed in; each is either DERIVED from
// the canonical value or AUTHORED, and an authored one wins at export.
//
// The sRGB row is the reason for this feature. It is the BAKE: what most
// viewers, most print pipelines, and every older browser actually receive. The
// automatic section 14.2 map picks the nearest colour by ΔE, but a brand will often
// prefer a DIFFERENT sRGB green: one that looks like the same brand colour to a
// human even though it is not the closest by measurement. So the row is
// editable, and any drift from the automatic answer is shown, not hidden.
//
// Press profiles appear as derived rows and are deliberately NOT editable here.
// Authoring a CMYK build already has a home two rows up, in the print lock.
// Two editors writing the same target would let them disagree without warning.
// When the press side moves onto this model, the lock moves with it in one change.

/** Screen targets every swatch has, in the order they are keyed elsewhere. */
const FACE_SPACES: readonly { target: string; label: string }[] = [
  { target: 'srgb', label: 'sRGB' },
  { target: 'display-p3', label: 'Display-P3' },
  { target: 'rec2020', label: 'Rec.2020' },
];

/**
 * Derive one target's value from a canonical colour, or null when this build
 * cannot answer for it.
 *
 * sRGB is gamut-MAPPED rather than clipped, because the row is the bake and a
 * clip is not what the platform does. The wider spaces are plain conversions:
 * a colour inside them needs no mapping, and one outside them is reported as it
 * is so the drift number stays meaningful.
 */
function deriveFace(canonical: string, target: string): string | [number, number, number, number] | null {
  const c = parseCssColor(canonical);
  if (!c) return null;
  if (target === 'srgb') {
    // MAPPED, not clipped. `colorToHexString` alone would clip each channel, and a
    // clip is not what the platform does to an out-of-gamut colour - CSS Color 4
    // section 14.2 preserves L and H and reduces C. This row IS that bake, so it has to
    // show the same answer a browser would.
    const rgb = gamutMapSrgb(colorToSrgb(c));
    return colorToHexString({ space: 'srgb', components: rgb, alpha: c.alpha, missing: 0 });
  }
  if (target === 'display-p3' || target === 'rec2020') {
    // Rounded to 4 decimals. `formatColor` emits full float precision, which wraps
    // the row onto three lines and - because pressing Set SEEDS the input from this
    // - would put `0.044335162...` in front of someone about to hand-edit it. Four
    // decimals is ~1/10000 of a channel: far finer than any display step, so
    // nothing reachable is lost.
    const cc = convertColor(c, target);
    const n = (v: unknown): string => String(Math.round((v as number) * 1e4) / 1e4);
    return `color(${target} ${n(cc.components[0])} ${n(cc.components[1])} ${n(cc.components[2])})`;
  }
  const press = parseProfileLimit(target);
  if (!press) return null;
  const profile = profileFor(press.digest);
  // Four inks only. A row of six or seven device channels is not a CMYK build
  // and rendering it as one would be a lie about what the press does.
  if (!profile || profile.nChannels !== 4) return null;
  const lab = convertColor(c, 'lab').components;
  const dev = profile.fromLab(press.intent, [lab[0] as number, lab[1] as number, lab[2] as number] as const);
  if (!dev || dev.length !== 4) return null;
  return dev.map((v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100)) as [number, number, number, number];
}

/** Every target on offer right now: the screen spaces, plus each mounted press. */
function faceTargets(): { target: string; label: string }[] {
  const out = [...FACE_SPACES];
  // The source's own label, not a ProfileEntry lookup: that is async, and this
  // runs inside a synchronous render. A GamutSource already carries the label the
  // profile panel shows, so the two cannot disagree either.
  for (const src of mountedSources()) out.push({ target: src.id, label: src.label });
  return out;
}

const faceText = (v: string | [number, number, number, number]): string =>
  Array.isArray(v) ? `C${v[0]} M${v[1]} Y${v[2]} K${v[3]}` : v;

interface FacesCtx {
  /** The subject's canonical colour, in any CSS notation. '' when there is none. */
  canonical: () => string;
  get: () => Map<string, StoredFace>;
  set: (target: string, face: StoredFace | null) => void;
}

/**
 * Render the faces list into `mount`. Returns a handle whose `render()` the
 * caller calls when the subject changes underneath it.
 *
 * Rebuilt wholesale on render, which is safe because the only mounted state is
 * the row inputs - and the focused one is left alone, so typing an override does
 * not fight the re-render its own commit triggers.
 */
function mountFaces(mount: HTMLElement, ctx: FacesCtx): { render: () => void } {
  const commit = (target: string, raw: string): void => {
    const v = raw.trim();
    if (!v) return;                       // nothing typed yet; not a clear
    if (!parseCssColor(v)) return;         // not a colour yet - wait for more typing
    ctx.set(target, { value: v });
    render();
  };

  mount.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-be-face-act]');
    if (!btn) return;
    const target = btn.dataset.beFaceTarget ?? '';
    if (!target) return;
    if (btn.dataset.beFaceAct === 'auto') { ctx.set(target, null); render(); return; }
    // "Set" seeds from the derived value, so the row never sits in a limbo where
    // it claims to be authored but holds nothing.
    const derived = deriveFace(ctx.canonical(), target);
    if (derived === null || Array.isArray(derived)) return;
    ctx.set(target, { value: derived });
    render();
    mount.querySelector<HTMLInputElement>(`[data-be-face-in="${cssEscape(target)}"]`)?.focus();
  });
  mount.addEventListener('input', (e) => {
    const inp = e.target as HTMLInputElement;
    const target = inp.dataset?.beFaceIn;
    if (target) commit(target, inp.value);
  });

  function render(): void {
    const canonical = ctx.canonical();
    const focused = document.activeElement as HTMLElement | null;
    const keepFocus = focused?.dataset?.beFaceIn ?? null;
    const faces = colorFaces(canonical, faceTargets(), ctx.get(), deriveFace);
    if (!faces.length) { mount.innerHTML = ''; return; }
    mount.innerHTML = `<div class="be-faces">${faces.map(f => {
      const editable = !Array.isArray(f.value) && FACE_SPACES.some(s => s.target === f.target);
      const isSet = f.origin === 'set';
      const absent = !faceTargets().some(t => t.target === f.target);
      return `<div class="be-face${isSet ? ' is-set' : ''}${absent ? ' is-absent' : ''}">
        <span class="be-face-key">${escape(f.label ?? f.target)}</span>
        <code class="be-face-val">${escape(faceText(f.value))}</code>
        ${/* ΔEOK, not "ΔE", and three decimals - both deliberate. `deltaEOkColor`
              is Euclidean distance in OKLab, where a just-noticeable difference is
              around 0.02; labelling it "ΔE" invites reading it as CIE ΔE, on which
              2.3 is a JND, so a genuinely enormous difference reads as "0.5, near
              enough". One decimal made it worse: every real override rounded to
              0.0. `ΔEOK` is the vocabulary the rest of this codebase already uses
              (components/color-field.ts's nearest-swatch tooltip). Ink builds are
              percentage POINTS, which is why they get their own unit. */''}
        ${f.drift !== undefined && f.drift > 0.0005
          ? `<span class="be-face-drift" title="${escape(Array.isArray(f.value)
            ? t('Largest single-ink difference from the automatic separation, in points')
            : t('Perceptual distance from the automatic conversion (OKLab; about 0.02 is just noticeable)'))}">${
            Array.isArray(f.value) ? `${Math.round(f.drift)}pt` : `ΔEOK ${f.drift.toFixed(3)}`}</span>`
          : ''}
        ${absent
          ? `<span class="be-face-tag">${escape(t('profile not on this device'))}</span>`
          : editable
            ? `<span class="be-face-acts">
                <button type="button" class="be-face-btn" data-be-face-act="auto" data-be-face-target="${escape(f.target)}" aria-pressed="${!isSet}">${escape(t('Auto'))}</button>
                <button type="button" class="be-face-btn" data-be-face-act="set" data-be-face-target="${escape(f.target)}" aria-pressed="${isSet}">${escape(t('Set'))}</button>
              </span>`
            : `<span class="be-face-tag">${escape(t('derived'))}</span>`}
        ${isSet && editable
          ? `<input type="text" class="field-input be-face-in" data-be-face-in="${escape(f.target)}" value="${escape(String(f.value))}" spellcheck="false" autocomplete="off" aria-label="${escape(tRaw('Value for {t}', { t: f.label ?? f.target }))}">`
          : ''}
      </div>`;
    }).join('')}</div>`;
    if (keepFocus) {
      const back = mount.querySelector<HTMLInputElement>(`[data-be-face-in="${cssEscape(keepFocus)}"]`);
      if (back) { back.focus(); back.setSelectionRange(back.value.length, back.value.length); }
    }
  }

  render();
  return { render };
}

/** Attribute-selector-safe form of a target id (they contain `:`). */
const cssEscape = (s: string): string =>
  (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, '\\$&'));

interface PrintLockCtx {
  /** The subject's current screen colour - feeds the Auto CMYK conversion. */
  hex: () => string;
  getCmyk: () => [number, number, number, number] | null;
  setCmyk: (cmyk: [number, number, number, number] | null) => void;
  getSpot: () => SpotColor | null;
  setSpot: (spot: SpotColor | null) => void;
  /** Called after either block re-renders. The primary panel's folded
   *  "Print & screen" summary chips hang off this so BOTH lock funnels - the
   *  control's own toggles AND afterSwatchLockChange → primaryLock.render()
   *  (the popover editing the primary anchor) - keep them in step. */
  onRender?: () => void;
}

/**
 * Render the print-lock markup into `mount` and wire it against `ctx`. Returns
 * a handle whose `render()` the caller calls whenever the subject changes
 * underneath it (a newly selected swatch, an edited primary hex) so the
 * readouts/fields resync without re-mounting the control.
 *
 * Call this AFTER any generic `[data-be-seg]` delegate (see the Scheme/Surface/
 * Contrast wiring below) has already run its one-time `querySelectorAll` - the
 * control's own Auto/Locked and None/Set toggles are built on that same
 * `segHtml` markup, so mounting later keeps them out of that older NodeList.
 */
function mountPrintLock(mount: HTMLElement, ctx: PrintLockCtx): { render: () => void } {
  mount.innerHTML = printLockHtml();
  const cmykReadout = mount.querySelector<HTMLElement>('[data-be-lock-readout="cmyk"]');
  const cmykSeg = mount.querySelector<HTMLElement>('[data-be-seg="lock-cmyk"]');
  const cmykBlock = mount.querySelector<HTMLElement>('[data-be-lock-block="cmyk"]');
  const cmykBody = mount.querySelector<HTMLElement>('[data-be-lock-cmyk-body]');
  const cInputs = Array.from(mount.querySelectorAll<HTMLInputElement>('[data-be-lock-c]'));

  const spotReadout = mount.querySelector<HTMLElement>('[data-be-lock-readout="spot"]');
  const spotSeg = mount.querySelector<HTMLElement>('[data-be-seg="lock-spot"]');
  const spotBlock = mount.querySelector<HTMLElement>('[data-be-lock-block="spot"]');
  const spotBody = mount.querySelector<HTMLElement>('[data-be-lock-spot-body]');
  const nameInput = mount.querySelector<HTMLInputElement>('[data-be-lock-name]');
  const bookInput = mount.querySelector<HTMLInputElement>('[data-be-lock-book]');
  const finishSel = mount.querySelector<HTMLSelectElement>('[data-be-lock-finish]');

  const setPressed = (seg: HTMLElement | null, val: string): void =>
    seg?.querySelectorAll<HTMLElement>('[data-val]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.val === val)));
  const cmykFromInputs = (): [number, number, number, number] =>
    cInputs.map(i => Math.min(100, Math.max(0, Math.round(parseFloat(i.value) || 0)))) as [number, number, number, number];

  const commitCmyk = (): void => { ctx.setCmyk(cmykFromInputs()); renderCmyk(); };
  const commitSpot = (): void => {
    const name = nameInput?.value.trim();
    if (!name) return; // a spot lock needs a name - nothing to commit yet
    const book = bookInput?.value.trim();
    const finish = finishSel?.value.trim();
    ctx.setSpot({ name, ...(book ? { book } : {}), ...(finish ? { finish: finish as FinishKind } : {}) });
    renderSpot();
  };

  cmykSeg?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-val]'); if (!btn) return;
    if (btn.dataset.val === 'auto') { ctx.setCmyk(null); renderCmyk(); return; }
    // Locking always leaves something pinned, never a limbo state - seed from
    // the auto conversion.
    ctx.setCmyk(autoCmykOf(ctx.hex()));
    renderCmyk();
  });
  cInputs.forEach(inp => inp.addEventListener('input', commitCmyk));

  spotSeg?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-val]'); if (!btn) return;
    if (btn.dataset.val === 'none') { ctx.setSpot(null); renderSpot(); return; }
    // "Set" opens the name field but doesn't commit anything yet - a spot lock
    // needs a name (commitSpot no-ops until one's typed).
    setPressed(spotSeg, 'set');
    if (spotBody) spotBody.hidden = false;
    nameInput?.focus();
  });
  nameInput?.addEventListener('input', commitSpot);
  bookInput?.addEventListener('input', () => { if (nameInput?.value.trim()) commitSpot(); });
  // A finish is a property OF the spot, so it can only be committed once the
  // spot has a name - same guard the Book field uses.
  finishSel?.addEventListener('change', () => { if (nameInput?.value.trim()) commitSpot(); });

  function renderCmyk(): void {
    const cmyk = ctx.getCmyk();
    const eff = cmyk ?? autoCmykOf(ctx.hex());
    if (cmykReadout) cmykReadout.textContent = `C${eff[0]} M${eff[1]} Y${eff[2]} K${eff[3]}`;
    cmykBlock?.classList.toggle('is-pinned', !!cmyk);
    setPressed(cmykSeg, cmyk ? 'locked' : 'auto');
    if (cmykBody) cmykBody.hidden = !cmyk;
    cInputs.forEach((inp, i) => { if (document.activeElement !== inp) inp.value = String(eff[i]); });
    ctx.onRender?.();
  }
  function renderSpot(): void {
    const spot = ctx.getSpot();
    if (spotReadout) spotReadout.textContent = spot ? spot.name : t('Not set');
    spotBlock?.classList.toggle('is-pinned', !!spot);
    setPressed(spotSeg, spot ? 'set' : 'none');
    if (spotBody) spotBody.hidden = !spot;
    if (nameInput && document.activeElement !== nameInput) nameInput.value = spot?.name ?? '';
    if (bookInput && document.activeElement !== bookInput) bookInput.value = spot?.book ?? '';
    // A brand-declared finish this build has no <option> for would silently
    // reset the select to '' and then be committed away - keep it addressable.
    if (finishSel && document.activeElement !== finishSel) {
      const cur = spot?.finish ?? '';
      // The injected option belongs to THIS render, not to the mount - the swatch
      // popover mounts this control once and drives it for every swatch, so an
      // option left behind would be offered on unrelated swatches.
      Array.from(finishSel.options).filter(o => o.dataset.beAdhoc).forEach(o => o.remove());
      if (cur && !Array.from(finishSel.options).some(o => o.value === cur)) {
        const opt = new Option(finishLabel(cur), cur);
        opt.dataset.beAdhoc = '1';
        finishSel.add(opt);
      }
      finishSel.value = cur;
    }
    ctx.onRender?.();
  }
  function render(): void { renderCmyk(); renderSpot(); }
  render();
  return { render };
}


// ── Swatch tile + palette grid ────────────────────────────────────────────────
// The tile markup itself is the shared factory in swatches.ts (component-audit
// rec 12 - swatchTile), so the grid, mobile mirror and this file's in-place
// recolour paths (syncTileMeta) all compose the same accessible-name string.

function tileHtml(s: BrandSwatch, idx: number, roleGlyph?: string): string {
  return swatchTile({ label: s.name, hex: s.hex, locked: !!s.lock }, {
    idx, roleGlyph, roleOnLight: roleGlyph ? (hexToOklch(s.hex)?.l ?? 0) > 0.68 : false,
  });
}

/**
 * The corner mark an assigned tile wears (plan 182 section 4.2).
 *
 * Two letters for Surface because S is already Secondary's, and the whole point
 * of the glyph is that it is readable at 10px on a 44px tile without a legend.
 * Untranslated on purpose - it is a mark, not a word (the `PANTONE 186 C`
 * precedent), and the Roles strip beside it carries the translated names.
 */
// Partial: the contract has seven slots (plan 182 section 5.7) and only these
// four earn a mark. Muted, edge and on-primary are derived company for the
// colours above them - a tile wearing four glyphs would be a legend, not a mark.
const ROLE_GLYPH: Partial<Record<RoleId, string>> = { primary: 'P', secondary: 'S', surface: 'Su', text: 'T' };

/** Identity of one starter swatch: its key AND its stored value. The definition
 *  and the reason both halves are needed live in lib/design-system/ownership.ts,
 *  which is where every room's "did somebody choose this?" answer comes from;
 *  this alias is only so the call sites below read as they always did. */
const starterId = colorIdentity;



/**
 * One group of logo slots.
 *
 * A group with nothing in it folds behind its own heading (plan 137 C4): eight
 * empty slots per identity is a form to fill in, and the room's actual entry
 * point is the drop zone above them, which never folds. A group that holds a
 * mark renders exactly as it always did - open, in flow, no disclosure.
 *
 * `name`, `hint` and `body` are trusted markup: callers pass a t() string or an
 * already-escape()d label, the same contract panelHead keeps.
 */
function logoGroupHtml(
  g: { name: string; hint: string; body: string; filled: boolean; cls?: string },
): string {
  const head = `<span class="be-logo-group-name">${g.name}</span>
      <span class="be-logo-group-hint">${g.hint}</span>`;
  const cls = `be-logo-group${g.cls ?? ''}`;
  return g.filled
    ? `<div class="${cls}">
        <div class="be-logo-group-head">${head}</div>
        <div class="be-logo-row">${g.body}</div>
      </div>`
    : `<details class="${cls} be-logo-group--fold">
        <summary class="be-logo-group-head">${head}</summary>
        <div class="be-logo-row">${g.body}</div>
      </details>`;
}

// ── Mount ─────────────────────────────────────────────────────────────────────

/**
 * Render the brand studio into `root` and wire it. Returns a teardown that stops
 * the (font/preview) listeners. Locked builds render a read-only note and no-op.
 */
/** The five areas the studio renders - the host view drives which one shows by
 *  setting `data-active-tab` on the editor root, and `onChange` names the one an
 *  edit came from.
 *
 *  The `BRAND_TABS` label+icon table that used to sit here is gone with the tab
 *  bar it fed: the design-system studio is rooms, and `views/start.ts` builds
 *  its own navigation. The key itself is still the studio's vocabulary. */
export type BrandTabKey = 'logos' | 'color' | 'type' | 'tokens' | 'catalogue';

export interface BrandEditorOptions {
  /** Fired after any brand edit lands, with the tab it came from - the host's
   *  refresh hook. */
  onChange?: (tab: BrandTabKey) => void;
  /** Take a durable, named checkpoint of the design system before a destructive
   *  action. The host owns the rolling history (lib/design-system/studio-state.ts);
   *  absent, the session undo stack is the only net. Best-effort: a rejection is
   *  swallowed, never surfaced as a failed edit. Additive since plan 97 M1. */
  checkpoint?: (label: string) => Promise<void>;
  /**
   * The host's already-loaded candidate tray (plan 97 section 8).
   *
   * There must be exactly ONE live tray per mounted studio. It persists its
   * whole candidate list on every write, so two instances over the same storage
   * key each save their own in-memory copy and whichever writes last erases the
   * other's candidates. The Logos room hands a mark's extra colours to a tray;
   * given one, it uses the host's rather than creating a second - which also
   * means those candidates show up in the panel the host already mounted.
   *
   * Must be LOADED by the host before it is passed. Absent, the room creates
   * (and loads) its own, which is correct only because a host that owns a tray
   * always passes it. Additive since plan 97 M5.
   */
  tray?: Tray;
  /** Open the host's source picker - beat 0's "or bring a file" (plan 182
   *  section 3a). The room never learns the picker has stages. Absent, the link
   *  is inert, which is the honest state for a host that has no picker. */
  openImport?: () => void;
  /**
   * Read an image file as colour candidates - "From an image" beside the add
   * row (plan 182 section 5.3).
   *
   * The HOST owns this pipeline (sample → colour cloud → census → tray) because
   * the source picker's image tile already runs it, and two copies of it would
   * drift on the first tweak to the condensing. Absent, the row does not render
   * the button at all.
   */
  scanImage?: (file: File) => void;
}

/** teardown: unmount. exportPack/importPack: the brand-file share pair, exposed
 *  here so the host view owns the buttons' placement (errors propagate - the
 *  caller shows them). */
export interface BrandEditorHandle {
  teardown: () => void;
  /** Retained only so an older caller still compiles. Every commit in the studio
   *  persists immediately (plan 97 section 6), so there is never a draft to save and
   *  never a pending state to report - start.ts consulted neither, verified. */
  saveDraft: () => void;
  isDirty: () => boolean;
  /** Add n colours as n swatches, through the Colours room's own write - one
   *  `addSwatch` each, one persist, no derive and nothing suggested-into (plan
   *  97 section 3 principle 1). Returns how many landed.
   *
   *  This is the ONLY correct way for another surface (the tray) to add a
   *  colour: it writes into the live document this editor holds, so an add can
   *  never reinstall a stale snapshot over edits made in the room. Additive
   *  since plan 97 M2; absent on a locked build, which writes nothing at all. */
  addColors?: (entries: ColorEntry[]) => number;
  exportPack: () => Promise<{ filename: string }>;
  importPack: (source: File | Unzipped) => Promise<void>;
  /** Re-read the installed doc and repaint every panel - for a host that
   *  installed tokens through its own path (JSON/SVG import) underneath us. */
  reload: () => Promise<void>;
  /** Close any floating editor UI (the swatch popover) - the host calls this
   *  on tab switches, where an open popover would otherwise outlive the tile
   *  it was anchored to (the popover sits outside the tab panels). */
  closeOverlays: () => void;
  /** Subscribe to COMMITTED-palette changes. Fired from both repaintPalette
   *  and persist() - in-place recolours (wheel drags, popover edits) bypass
   *  repaintPalette and only funnel through persist(), so a single hook point
   *  would miss one path. Returns an unsubscribe. */
  onPalette: (cb: () => void) => () => void;
  /** Deep-link entry: reveal the folded Colour chart card (the OKLCH wheel) the
   *  Colours tab opens on click - repaints itself via its own toggle handler.
   *  Returns false when the card isn't present (a locked build renders no
   *  studio), so a host can degrade gracefully. */
  openColorChart: () => boolean;
  /** Open a level-2 wing of the Colours room. False when absent (a locked build
   *  renders no studio). Additive since plan 97 M1. */
  openWing?: (key: 'generate' | 'curves' | 'contrast' | 'print') => boolean;
  /** Prime the Generate wing's primary colour (the `?seed=` deep link - the
   *  added-chip's "Generate your palette from this colour"). Runs the same
   *  fan-out a manual pick runs. Additive, audit 167 F-A12. */
  setGeneratePrimary?: (hex: string) => void;
  /** Session undo for the room's destructive actions. Additive since M1. */
  undo?: () => boolean;
  canUndo?: () => boolean;
  /** Which beat the Colours room is showing (plan 182 section 3a) - 0 when the
   *  design system has no colour of its own, 1 after the first, 2 once there is
   *  a palette. The host reads it to decide whether the phone's palette mirror
   *  has anything to mirror. 2 on a locked build, which renders no studio and
   *  therefore holds nothing back. Additive. */
  colourBeat?: () => 0 | 1 | 2;
  /** Show one INHERITED colour group in the Colours pane, folded and tagged
   *  Starter (`?area=color&group=neutral` - the Tokens room's "Open"). The one
   *  place a starter tile is ever drawn. False when no such group exists.
   *  Additive. */
  openStarterGroup?: (group: string) => boolean;
  /** Open the Colours room's colour picker, anchored to the add row's chip
   *  (`?area=color&focus=pick` - the Overview's "Pick a colour" door). Nothing is
   *  written until the person presses Add colour. False when the room did not
   *  render (a locked build). Additive, plan 182 section 3a. */
  openPickCard?: () => boolean;
  /** Open the Type room's face stage for one role (`?area=type&focus=stage` -
   *  the Overview's "Choose a face" door). Presentation only: the stage installs
   *  nothing until a card is chosen. False when the room did not render.
   *  Additive, plan 182 section 3a. */
  openTypeStage?: (role: FontRole) => boolean;
}

export async function mountBrandEditor(root: HTMLElement, host: EditorHost, opts: BrandEditorOptions = {}): Promise<BrandEditorHandle> {
  const tokens = host.tokens as unknown as WebTokensAPI | undefined;
  const fontsHost = host as unknown as UserFontsHost;
  const transferHost = { host: host as unknown as BrandTransferHost, storage: localStorage };

  let locked = false;
  try { locked = !!(await tokens?.isLocked?.()); } catch { /* treat as unlocked */ }
  if (locked) {
    root.innerHTML = `<p class="be-locked">${t('This build ships with a fixed brand - its colours, fonts and tokens are what the whole app, your tools and every export wear. Brand editing is turned off here.')}</p>`;
    return {
      teardown: () => {}, saveDraft: () => {}, isDirty: () => false,
      exportPack: () => Promise.reject(new Error(t('This brand is fixed - there is nothing of yours to export.'))),
      importPack: () => Promise.reject(new Error(t('This brand is fixed - imports are turned off.'))),
      reload: () => Promise.resolve(),
      closeOverlays: () => {},
      onPalette: () => () => {},
      openColorChart: () => false,
    };
  }

  // The document we edit: the installed brand if any, else a fresh derive from
  // the default primary so the palette is never empty on an unbranded install.
  let doc = (await tokens?.raw().catch(() => null)) as Record<string, unknown> | null;
  const installedDoc = isRec(doc) ? doc : null; // stable snapshot for seeding, below - never reassigned
  if (!isRec(doc)) doc = deriveBrandTokens({ primary: DEFAULT_PRIMARY, name: 'My brand' }) as Record<string, unknown>;

  // Whether installedDoc is something the USER actually saved here, vs just the
  // catalog's own shipped/placeholder brand - distinct from "is there any doc at
  // all", since a fresh install still resolves ITS tokens as installedDoc. Only a
  // real user save should seed a control (like Shades below) away from its
  // considered default; the catalog's incidental step count isn't a user choice.
  let isUserBrand = false;
  try {
    isUserBrand = await isUserDesignSystemActive(host);
  } catch { /* discovery unavailable - treat as not user-owned */ }

  // Derive-control state (separate from the edited doc - it RE-SEEDS on install).
  // Primary is seeded from the REAL installed brand's current colour, so the
  // picker opens on what's actually running, not a hardcoded default - only a
  // genuinely unbranded install (no real doc yet) falls back to DEFAULT_PRIMARY.
  // Scheme/surface/contrast aren't recoverable (deriveBrandTokens doesn't persist
  // its own input options into the doc), so those stay at their usual defaults.
  let primary = DEFAULT_PRIMARY;
  if (installedDoc) {
    try {
      primary = tokenValueToHex(createTokenSet(installedDoc, { theme: 'light' }).resolve('color.semantic.primary')) ?? DEFAULT_PRIMARY;
    } catch { /* malformed/tokenless doc - keep the default seed */ }
  }
  let scheme: Scheme = 'mono', surface: Surface = 'light', contrast: Contrast = 'comfort';
  // Foreground preference (text on the brand colour). Defaults to 'auto' - the
  // engine's contrast pick - until the user forces Light or Dark.
  let foreground: Fg = 'auto';
  // How many shades each ramp carries. New brands start at 5 (a tight, decisive
  // palette); a brand the USER saved here keeps whatever it shipped (seeded from
  // its primary ramp's step count) so re-opening the editor never silently
  // reshapes it - but the catalog's own placeholder brand doesn't count as a user
  // choice, so it doesn't override the 5-step default either.
  const DEFAULT_STEPS = 5;
  const anchorStep = (n: number): number => Math.round((n - 1) / 2) + 1; // mid step = engine at(0.5)
  let steps = DEFAULT_STEPS;
  if (installedDoc && isUserBrand) {
    try {
      const g = createTokenSet(installedDoc).query({ type: 'color' }).filter(t => /^color\.ramp\.primary\.\d+$/.test(t.path));
      if (g.length >= RAMP_STEPS_MIN) steps = Math.min(RAMP_STEPS_MAX, g.length);
    } catch { /* keep the default */ }
  }
  // Neutral/secondary ramp-step picks - default to the anchor (mid) step for the
  // current division count, so they track the shade count until the user picks.
  let neutralStep = anchorStep(steps), secondaryStep = anchorStep(steps);
  // The primary's pinned print lock (null = auto-convert at export) - read LIVE
  // off `doc` rather than cached, since the very same swatch (the primary ramp's
  // anchor step) is also reachable - and lockable - through the Palette panel's
  // swatch popover (see mountPrintLock's two call sites below). A cached copy
  // would drift the moment the OTHER surface writes the lock straight to `doc`.
  const primaryPrintLock = (): PrintLock | null => {
    const p = primaryAnchorPath(doc);
    return p ? getSwatchPrintOverride(doc, p) : null;
  };
  // The colour-harmony the "Build the palette" generator suggests accents from - 
  // either a fixed SchemeKind (complement/adjacent/triad/tetrad) or the parametric
  // 'analogous' mode (its own count + angle controls, generateAnalogous instead of
  // generateSchemeAccents). One value because the Harmony control is a single
  // mutually-exclusive segmented group. Persisted in panel state like any input.
  type HarmonyKind = SchemeKind | 'analogous';
  let harmonyKind: HarmonyKind = 'adjacent-3';
  // Parametric-analogous params - only read when harmonyKind === 'analogous'.
  let analogCount = 3;   // number of accents (2–5)
  let analogAngle = 30;  // hue step in degrees between consecutive accents (10–45)
  let currentTheme = document.documentElement.dataset.theme || 'light';

  // ── Per-ramp tonal curves - the editable master behind each ramp's steps ─────
  // Loaded from the installed doc's ramp-group $extensions; ABSENT on a curve-less
  // brand, which then stays byte-identical to today's pure derive (overlay is a
  // no-op for a ramp with no curve). Draft-until-"Use this colour", exactly like
  // the other derive inputs - overlaid onto every derived preview below, and onto
  // the fresh `next` in the derive handler so a curve survives a re-derive.
  const curves: RampCurves = {};
  for (const ramp of RAMP_IDS) {
    const stored = getRampCurve(doc, ramp);
    if (stored) curves[ramp] = deserializeCurve(stored);
  }
  // The primary the live curves are currently anchored to - a primary edit shifts
  // them by the per-channel delta from here (see reanchorCurvesTo below).
  let curveAnchorPrimary = primary;
  // Which ramp's curve editor is open (null = none). Its state, plus whether each
  // ramp carries a curve, drives the affordance rendered on every ramp row.
  let editingCurveRamp: RampId | null = null;
  const curveMarks = (): CurveMarks => ({
    primary: { edited: !!curves.primary, open: editingCurveRamp === 'primary' },
    neutral: { edited: !!curves.neutral, open: editingCurveRamp === 'neutral' },
    secondary: { edited: !!curves.secondary, open: editingCurveRamp === 'secondary' },
  });

  // The brand's resolved surface role - the default background contrast-lock
  // measures against (what a step will actually sit on). Falls back to white on a
  // tokenless / unresolvable doc, exactly like the Palette Lab tool's `bg`.
  const surfaceHex = (): string => {
    try {
      const v = createTokenSet(doc, { theme: currentTheme === 'dark' ? 'dark' : 'light' }).resolve('color.semantic.surface');
      return colorToHex(v) ?? '#ffffff';
    } catch { return '#ffffff'; }
  };
  // Contrast-lock presets - labels only; the [low,high] Lc spans live in
  // brand-doc's contrastTargets (shared verbatim with the Palette Lab tool).
  const CONTRAST_LOCK_PRESETS: ReadonlyArray<{ id: ContrastLockPreset; label: string }> = [
    { id: 'even', label: t('Even') },
    { id: 'text', label: t('Text-first') },
    { id: 'ui', label: t('UI states') },
  ];

  // The default contrast-lock background, seeded once for the control's initial
  // value (the user can re-pick it any time; Apply reads the live input).
  const contrastLockBg = surfaceHex();

  // The ramp the Shade curves + Contrast wings act on. The curve editor and the
  // two one-shot transforms used to share the "whichever ramp's glyph you
  // clicked" state; now that they live in two separate wings, each wing renders
  // the SAME picker and this is the one value both read.
  // `primary` is only the right default while the document HAS a primary ramp.
  // The starter cut ships none (plan 182 section 12), so a design system that
  // has never generated a palette would open both wings on a ramp that does not
  // exist; neutral is the one ramp a starter always carries. The wings are
  // beat-2 material either way, so this only ever bites the person who reached
  // beat 2 on custom colours alone.
  let curveRamp: RampId = primaryAnchorPath(doc) ? 'primary' : 'neutral';
  /** The ramp picker, rendered once per wing (the two instances stay in sync).
   *  Its own `groupAttr` keeps it out of DERIVE_SEGS's generic delegate. */
  const rampPickHtml = (): string => segHtml(
    'ramppick', RAMP_IDS.map(r => ({ id: r, label: RAMP_LABEL[r] })), curveRamp, t('Ramp'),
    { attr: 'data-ramp', extraClass: 'be-ramppick', groupAttr: 'data-be-ramp-pick' },
  );

  const initialDraft = deriveSafe({ primary, scheme, surface, contrast, steps, foreground });

  // The Logos room's lead was six lines of taxonomy before anyone had added a
  // single mark (plan 137 C4). The whole of it is still here, one tap away in
  // the shared help tip, and the room opens on the one sentence that says what
  // to do. Plain text, no markup: helpTip escapes what it is given.
  const logoTaxonomyTip = helpTip(t('Each orientation (horizontal, vertical) can carry each treatment: primary and mono, each with a reverse form for dark backgrounds. Marks the design system names its own way - an icon, a crest - go under Custom marks. A design system with more than one logo can carry each as its own set. Every slot is optional. PNG, SVG, JPEG or WebP; they stay on this device and travel in the design system file.'));

  root.innerHTML = `
    <div class="be" data-brand-editor>
      <div class="be-tab" data-be-tab-panel="logos">
        <div class="be-panel be-logos">
          ${panelHead(t('Logos'), `<span class="help-tip-host be-logos-lead">${t('Add the marks - Lolly reads each file and offers it the right slot.')} ${logoTaxonomyTip.button}${logoTaxonomyTip.pop}</span>`)}
          ${/* Level 0 (plan 97 section 7.3): one multi-file drop zone. Each file is
                read for shape and ink, proposes a slot, and waits for a tap - 
                the matrix below stays exactly as it was, per-slot drops and
                all. The trim offer mounts between the two. */''}
          <div class="be-logo-intake" data-be-logo-intake>
            <label class="be-logo-intake-drop">
              <input type="file" class="visually-hidden" data-be-logo-multi multiple accept="image/png,image/jpeg,image/svg+xml,image/webp" aria-label="${escape(t('Choose logo files'))}">
              <span class="be-logo-intake-glyph" aria-hidden="true">${icon('uploadImage', { size: 20 })}</span>
              <span class="be-logo-intake-lead">${t('Drop marks here, or choose several at once')}</span>
              <span class="be-logo-intake-hint">${t('Each file is read for its shape and its ink, then offered the slot it looks like. Nothing is placed until you tap.')}</span>
            </label>
            <div class="be-logo-queue" data-be-logo-queue hidden></div>
            <div class="be-logo-trim" data-be-logo-trim hidden></div>
          </div>
          <div class="be-logo-grid" data-be-logos></div>
          <p class="be-err" data-be-logo-err hidden></p>
        </div>
      </div>

      <div class="be-tab be-tab--split" data-be-tab-panel="color">
      <aside class="be-split-side" data-be-split-side aria-label="${escape(t('Palette'))}">
      <!-- Inner scroller: the panels scroll in here (≥1100px, the pane's height
           viewport-anchored by the host - see brand-studio.css) while the
           download dock below stays OUTSIDE it, keeping its seat at the pane's
           bottom edge however far the palette scrolls. -->
      <div class="be-split-scroll" data-be-split-scroll>
      <div class="be-panel be-palette">
        <div class="be-palette-heading"><h2>${t('Your colours')}</h2><span class="be-save-state" data-be-save-state role="status" hidden></span></div>
        <div class="be-pal" data-be-pal></div>
        <button type="button" class="be-pal-restore" data-be-undo hidden>${t('Undo')}</button>
      <details class="be-addcolor"><summary>${t("Paste colours or use an image")}</summary>
        ${/* Beat 0's whole room (plan 182 section 3a): a title, a line, the pick
              row, and one quiet sentence saying what arrives later and where a
              file goes instead. It replaces the panel head rather than joining
              it - two headings over one control is the wall this beat removes. */''}
        <div data-be-addcolor></div>

        ${/* The answer to one add (plan 137 C1): the colour, its name, and the two
              things worth doing next. Static markup filled in place (textContent
              and one custom property) so a swatch name never reaches a markup
              sink. Borrows the logo suggestion's box - it is the same kind of
              row in the same panel. */''}
        <div class="be-suggest be-added" data-be-added hidden>
          <span class="be-suggest-note">
            <span class="be-suggest-sw" data-be-added-sw aria-hidden="true"></span>
            <span data-be-added-name></span>
          </span>
          <button type="button" class="be-btn" data-be-added-primary>${t('Use as primary?')}</button>
          <button type="button" class="be-btn" data-be-added-tune>${t('Fine-tune')}</button>
          <button type="button" class="be-suggest-dismiss" data-be-added-dismiss aria-label="${escape(t('Dismiss'))}">&#x2715;</button>
        </div>
        <div class="be-suggest" data-be-suggest hidden></div>
      </details>

        <!-- The colour charts, demoted to a folded card - repainted on open,
             since a hidden mount measures 0×0 (see the toggle wiring below).
             Two views of the SAME swatches: the wheel reads a palette's spread
             at a glance, the gamut chart shows where the displayable range
             actually ends. Wheel stays the default so the ?wheel deep-link and
             everyone's muscle memory land where they always did. -->
        <details class="be-subst-details be-chart-details" data-be-chart>
          <summary><span class="be-subst-details-label">${t('Colour chart')}</span></summary>
          ${segHtml('chartview', [
            { id: 'wheel', label: t('Wheel') },
            { id: 'slices', label: t('Gamut') },
          ], 'wheel', t('Chart view'), { attr: 'data-be-chartview', extraClass: 'be-chartview' })}
          <div class="be-pal-wheel" data-be-wheel-mount></div>
          <div class="be-pal-slice" data-be-slice-mount hidden></div>
        </details>
        <p class="be-err" data-be-pal-err hidden></p>
      </div>

      <div class="be-panel be-gradients" data-be-grads-mount></div>
      </div>

      <!-- Download-all - a floating pill (the catalog toolbar's clothes) at the
           pane's anchored bottom edge, so exporting the palette never scrolls
           away. Lives OUTSIDE .be-split-scroll - see above. -->
      <div class="be-pal-dock" data-be-pal-dock>
        <select class="field-select field-select--auto field-select--sm be-pal-fmt-sel" data-be-pal-fmt aria-label="${escape(t('Download the palette as'))}">
          <option value="tokens-json">${t('Design tokens (JSON)')} &middot; Penpot / Tokens Studio</option>
          <option value="css-vars">${t('CSS variables')}</option>
          <option value="css-classes">${t('CSS classes')}</option>
          <option value="scss">${t('SCSS variables')}</option>
          <option value="gpl">${t('GIMP palette (.gpl)')}</option>
          <option value="ase">${t('Adobe Swatch Exchange (.ase)')}</option>
        </select>
        <button type="button" class="be-btn be-btn--sm" data-be-pal-download data-sfx="whoosh">${t('Download')}</button>
      </div>
      </aside>
      <div class="be-split-main">
      ${/* ── Level 0: the one control. Adding a colour writes exactly one token
             (plan 97 section 7.1) - nothing is derived, suggested-into, or demanded. */''}
      <section class="be-context" aria-label="${escape(t('Palette previews'))}">
        <div class="be-context-head"><h2>${t('In context')}</h2><span data-be-preview-source>${t('Your palette')}</span></div>
        <div class="be-previews" data-be-previews></div>
        ${segHtml('preview-scene', [{ id: '0', label: t('Poster') }, { id: '1', label: t('Chart') }, { id: '2', label: t('UI card') }], '0', t('Preview scene'), { attr: 'data-scene', groupAttr: 'data-be-scenes' })}
      </section>

      ${/* Roles are an assignment layer over the swatches that already exist -
            a design system of three loose colours with no roles is valid. */''}
      <details class="be-wing be-roles"><summary class="be-wing-head"><span class="be-wing-title">${t("Colour roles")}</span><span class="be-wing-sub">${t("Choose what tools use")}</span></summary><div class="be-wing-body">
        <div data-be-roles></div>
      </div></details>

      ${/* ── Level 2: the expert wings. Folded by default, no persistence - the
             same discipline the palette's own sections keep. */''}
      <details class="be-wing" data-be-wing="generate">
        <summary class="be-wing-head">
          <span class="be-wing-title">${t('Explore shades & harmonies')}</span>
          <span class="be-wing-sub">${t('Add the colours you like')}</span>
        </summary>
        <div class="be-wing-body">
      <div class="be-colour">
        ${panelHead(t('Find a few more colours'), t('Choose a starting colour, then add individual shades or a shade group. Your existing colours and roles stay as they are.'))}
        <p class="be-draft-status" data-be-draft-status role="status" aria-live="polite"></p>
        <div class="be-derive">
          <div class="be-colorpick">
            <span class="be-field-label">${t('Starting colour')}</span>
            <div data-be-primary-field>${colorFieldHtml('be-primary', primary, { inline: true, modes: true, progressive: true })}</div>
          </div>
          <div class="be-derive-controls">
            <label class="be-field"><span class="be-field-label">${t('Scheme')}</span>${segHtml('scheme', SCHEMES, scheme, t('Colour scheme'))}</label>
            <div class="be-field be-steps-field">
              <span class="be-field-label">${t('Shades')} <span class="be-steps-val" data-be-steps-val>${steps}</span></span>
              <input type="range" class="field-range be-steps-slider" data-be-steps min="${RAMP_STEPS_MIN}" max="${RAMP_STEPS_MAX}" step="1" value="${steps}" aria-label="${escape(t('Shades per ramp'))}">
            </div>
            <details class="be-subst-details be-finetune" data-be-finetune>
              <summary><span class="be-subst-details-label">${t('Fine-tune')}</span></summary>
              <div class="be-finetune-body">
                <label class="be-field"><span class="be-field-label">${t('UI intensity')}</span>${segHtml('surface', INTENSITIES, surface, t('UI intensity'))}</label>
                <label class="be-field"><span class="be-field-label">${t('Contrast')}</span>${segHtml('contrast', CONTRASTS, contrast, t('Contrast target'))}</label>
                <label class="be-field"><span class="be-field-label">${t('Text on brand')}</span>${segHtml('foreground', FOREGROUNDS, foreground, t('Text colour on the brand colour'))}</label>
              </div>
            </details>
          </div>
          <div class="be-preview" data-be-preview>${initialDraft ? previewHtml(initialDraft, { neutral: neutralStep, secondary: secondaryStep, steps, curves: curveMarks(), palette: walkSwatches(doc, currentTheme).filter(s => s.kind !== 'semantic').flatMap(s => s.hex ? [s.hex] : []) }) : ''}</div>
        </div>
      </div>

      <details class="be-generate-detail">
        <summary>${t('Find matching colours')}</summary>
      <div class="be-generate">
        ${panelHead(t('Find matching colours'), t('Choose a harmony and add the colours you like. Each added colour can be renamed in your palette.'))}
        <div class="be-field">
          <span class="be-field-label">${t('Harmony')}</span>
          ${/* The shared segmented-control primitive (lib/seg.ts). The free-N kinds
                are hidden UI-side only - the engine keeps them (stored docs may
                reference them) and the default stays adjacent-3. `data-kind` is
                this group's own value hook, kept because its click delegate below
                keys off it; segHtml emits `data-val` alongside either way. */''}
          ${/* "Analogous" is appended UI-side as an ADDITIONAL parametric mode; the
                fixed engine schemes (incl. adjacent-3) are untouched. Its own count
                + angle controls appear below only while it is the active kind. */''}
          ${segHtml('schemekind', [
            ...SCHEME_KINDS.filter(k => !k.id.startsWith('free-')),
            { id: 'analogous', label: t('Analogous') },
          ], harmonyKind, t('Colour harmony'), {
            attr: 'data-kind', extraClass: 'be-schemekinds', groupAttr: 'data-be-schemekind',
          })}
        </div>
        <!-- Parametric-analogous controls - N accents at a variable hue step.
             Hidden unless the Analogous harmony is picked (shown/hidden by the
             segmented-control delegate below). -->
        <div class="be-analogous" data-be-analogous${(harmonyKind as HarmonyKind) === 'analogous' ? '' : ' hidden'}>
          <div class="be-field be-analog-field">
            <span class="be-field-label">${t('Accents')} <span class="be-analog-val" data-be-analog-count-val>${analogCount}</span></span>
            <input type="range" class="field-range be-analog-slider" data-be-analog-count min="2" max="5" step="1" value="${analogCount}" aria-label="${escape(t('Number of analogous accents'))}">
          </div>
          <div class="be-field be-analog-field">
            <span class="be-field-label">${t('Angle')} <span class="be-analog-val" data-be-analog-angle-val>${analogAngle}°</span></span>
            <input type="range" class="field-range be-analog-slider" data-be-analog-angle min="10" max="45" step="1" value="${analogAngle}" aria-label="${escape(t('Hue step between analogous accents in degrees'))}">
          </div>
        </div>
        <div class="be-candidates" data-be-candidates aria-live="polite"></div>

      </div>
      </details>

      <details class="be-generate-detail be-rebuild" data-be-rebuild>
        <summary>${t('Rebuild the whole palette…')}</summary>
        <p class="be-gen-note">${t('Replace generated ramps and update theme roles from these settings. Review the result before applying; Undo restores the previous palette.')}</p>
        <button type="button" class="be-btn" data-be-replace-palette>${t('Preview full rebuild')}</button>
        <div class="be-review" data-be-review hidden></div>
      </details>
        </div>
      </details>

      ${/* The three wings below are for a system that already exists (plans/163
            F7): they are marked advanced so they read quieter than Generate,
            and so the palette rides above them wherever the split stacks. */''}
      <details class="be-wing be-wing--advanced" data-be-wing="curves">
        <summary class="be-wing-head">
          <span class="be-wing-title">${t('Shade curves')}</span>
          <span class="be-wing-sub">${t('Fine-tune a colour ramp')}</span>
        </summary>
        <div class="be-wing-body">
          <label class="be-field"><span class="be-field-label">${t('Ramp')}</span>${rampPickHtml()}</label>
          <!-- The tonal-curve editor. Revealed with the wing (the Shades slider
               in the Generate wing resamples whatever it holds). -->
          <div class="be-curve" data-be-curve-editor hidden>
            <div class="be-curve-head">
              <span class="be-curve-title" data-be-curve-title></span>
              <div class="be-curve-head-actions">
                <button type="button" class="be-btn be-btn--sm be-curve-rebuild" data-be-curve-rebuild>${t('Rebuild from colour')}</button>
                <button type="button" class="be-curve-close" data-be-curve-close aria-label="${escape(t('Close the curve editor'))}" title="${escape(t('Close'))}">✕</button>
              </div>
            </div>
            <p class="be-curve-hint">${t('Drag a point to reshape this ramp. Lightness, chroma and hue each have their own curve - switch with L / C / H. The shades below rebake live; the number of shades follows the slider above.')}</p>
            <div class="be-curve-mount" data-be-curve-mount></div>
          </div>
        </div>
      </details>

      <details class="be-wing be-wing--advanced" data-be-wing="contrast">
        <summary class="be-wing-head">
          <span class="be-wing-title">${t('Contrast')}</span>
          <span class="be-wing-sub">${t('Check and adjust readability')}</span>
        </summary>
        <div class="be-wing-body">
          <label class="be-field"><span class="be-field-label">${t('Ramp')}</span>${rampPickHtml()}</label>
          <!-- Contrast-lock: a one-shot curve transform. It retones every step
               to hit an APCA target against a background, keeping each step's
               hue + chroma, then hands the result to the SAME curve machinery
               (drag / re-anchor / Rebuild all apply as-is afterwards). -->
          <div class="be-cl" data-be-cl>
            <div class="be-cl-head">
              <span class="be-cl-title">${t('Contrast-lock')}</span>
              <span class="be-cl-sub">${t('Retone this ramp to hit APCA contrast targets against a background - each step keeps its hue and chroma.')}</span>
            </div>
            <div class="be-cl-controls">
              <label class="be-field be-cl-bg-field">
                <span class="be-field-label">${t('Background')}</span>
                <input type="color" class="be-cl-bg" data-be-cl-bg value="${escape(contrastLockBg)}" aria-label="${escape(t('Contrast-lock background colour'))}">
              </label>
              <label class="be-field be-cl-preset-field">
                <span class="be-field-label">${t('Targets')}</span>
                <select class="field-select field-select--auto field-select--sm be-cl-preset" data-be-cl-preset aria-label="${escape(t('Contrast target preset'))}">
                  ${CONTRAST_LOCK_PRESETS.map(p => `<option value="${escape(p.id)}">${escape(p.label)}</option>`).join('')}
                </select>
              </label>
              <label class="be-field be-cl-custom-field">
                <span class="be-field-label">${t('Custom Lc')} <em>${t('(optional)')}</em></span>
                <input type="text" class="field-input field-input--sm be-cl-custom" data-be-cl-custom placeholder="15, 45, 75, 90" inputmode="numeric" autocomplete="off" spellcheck="false" aria-label="${escape(t('Custom APCA Lc targets, comma-separated'))}">
              </label>
            </div>
            <div class="be-cl-actions">
              <button type="button" class="be-btn be-btn--sm be-cl-apply" data-be-cl-apply>${t('Apply contrast-lock')}</button>
              <span class="be-cl-readout" data-be-cl-readout aria-live="polite"></span>
            </div>
          </div>
          <!-- Rotate hue: a one-shot curve transform. It shifts every step's hue
               by a fixed angle, keeping each step's lightness + chroma, turning
               the whole ramp bodily around the wheel - then hands the result to
               the SAME curve machinery (drag / re-anchor / Rebuild all apply). -->
          <div class="be-hr" data-be-hr>
            <div class="be-hr-head">
              <span class="be-hr-title">${t('Rotate hue')}</span>
              <span class="be-hr-sub">${t('Turn this whole ramp around the hue wheel. Every shade keeps its lightness and chroma.')}</span>
            </div>
            <div class="be-hr-controls">
              <div class="be-field be-hr-deg-field">
                <span class="be-field-label">${t('Degrees')} <span class="be-hr-val" data-be-hr-val>0°</span></span>
                <input type="range" class="field-range be-hr-slider" data-be-hr-deg min="-180" max="180" step="1" value="0" aria-label="${escape(t('Hue rotation in degrees'))}">
              </div>
              <button type="button" class="be-btn be-btn--sm be-hr-apply" data-be-hr-apply>${t('Apply rotation')}</button>
            </div>
          </div>
        </div>
      </details>

      <details class="be-wing be-wing--advanced" data-be-wing="print">
        <summary class="be-wing-head">
          <span class="be-wing-title">${t('Print')}</span>
          <span class="be-wing-sub">${t('CMYK and spot inks')}</span>
          <span class="be-subst-chips" data-be-print-chips></span>
        </summary>
        <div class="be-wing-body">
          <!-- The primary is one colour; Lolly shows its on-screen (sRGB) form and
               auto-converts it for print - UNLESS the shared print lock inside pins
               an exact CMYK anchor or a named spot colour instead. -->
          ${/* A print lock pins the PRIMARY RAMP's anchor step, and a design
                system that has never generated a palette has no primary ramp to
                pin (the starter cut, plan 182 section 12) - primaryAnchorPath
                answers null. Rather than show four CMYK sliders that write
                nowhere, the wing says what is missing and offers nothing. */''}
          <p class="be-subst-none" data-be-print-none hidden>${t('Generate a palette to pin a print build for the primary.')}</p>
          <div class="be-subst" data-be-subst>
            <div class="be-subst-line">
              <span class="be-subst-key">${t('Screen')}</span>
              <code class="be-subst-val" data-be-screen></code>
              <span class="be-subst-tag">${t('auto')}</span>
            </div>
            <div data-be-lock-mount="primary"></div>
          </div>
        </div>
      </details>
      </div>


      </div>

      ${/* The room has two beats (plan 182 section 3a), written on the panel by
             paintFonts and read by the CSS below it: 0 = no face of its own, so
             ONE card and one decision; 1 = the four cards, the Fonts list and
             the specimen. `beats-type.ts` decides; nothing here guesses. */''}
      <div class="be-tab" data-be-tab-panel="type" data-be-beat="0">
      ${/* ── Level 0 (plan 97 section 7.2): the four role cards. Each shows the face
             that serves its role right now and opens the compare stage scoped
             to it. Nothing on a card commits anything. */''}
      <div class="be-panel be-typecards" data-be-typecards-panel>
        ${/* Beat 0's own head - the room's first decision, said as a decision.
               The panel head below is the beat-1 head; exactly one shows. */''}
        <div class="be-typelede">
          <h3 class="be-typelede-title">${t('Choose a face')}</h3>
          <p class="be-typelede-sub">${t('One face for body copy, buttons and every tool. Search Google Fonts, or drop a font file.')}</p>
        </div>
        ${panelHead(t('Type'), t('Four faces the app, the tools and every export read. Each card shows what serves that role today, and opens a stage where candidates stand side by side before anything installs.'))}
        <div class="be-typecard-grid" data-be-typecards>${TYPE_ROLES.map(typeRoleCardHtml).join('')}</div>
        ${/* Beat 0's tail: the three optional roles are not hidden, they are
               DEFERRED, and the sentence says what they do meanwhile. Revealing
               them holds for the mount - a disclosure that re-folds under you is
               a disclosure you stop trusting. */''}
        <p class="be-typemore" data-be-typemore>${t('Headings, code and italic follow the primary until you choose them.')}
          <button type="button" class="be-typemore-btn" data-be-typemore-toggle>${t('Choose them separately')} <span aria-hidden="true">▸</span></button>
        </p>
      </div>

      ${/* The compare stage (lib/design-system/type-compare.ts), hosted inline by
             the room rather than in a dialog: the room has the width, and a
             panel keeps the role cards it was opened from on screen. Escape
             cancels and hands the keyboard back to that card. */''}
      <section class="be-panel be-typestage" data-be-typestage hidden aria-labelledby="be-typestage-title">
        <div class="be-typestage-head">
          <h3 class="be-typestage-title" id="be-typestage-title" data-be-typestage-title></h3>
          <button type="button" class="be-typestage-x" data-be-typestage-close aria-label="${escape(t('Close without choosing'))}">${icon('close', { size: 14 })}</button>
        </div>
        <form class="be-typestage-search" data-be-typestage-search>
          <label class="visually-hidden" for="be-typestage-q">${t('Font name')}</label>
          ${/* Example values, not prose - untranslated on purpose, the same
                 PANTONE-placeholder precedent the print lock keeps. */''}
          <input type="text" id="be-typestage-q" data-be-typestage-q list="be-google-fonts" placeholder="Inter, Fraunces, Space Mono…" autocomplete="off" autocapitalize="words" spellcheck="false">
          <datalist id="be-google-fonts">${POPULAR_FAMILIES.map(f => `<option value="${escape(f)}"></option>`).join('')}</datalist>
          <button type="submit" class="be-cta" data-be-typestage-add>${t('Preview')}</button>
        </form>
        ${/* Six families, one press each (plan 182 section 6.4). On a fresh
               origin this is the first thing that shows what a candidate looks
               like, and it costs nothing until pressed - the chips are names,
               and a press is what fetches. The row is filled by openStage (the
               families already serving a role are dropped), so the buttons
               themselves are built with textContent, never markup. */''}
        <div class="be-typestage-pins" data-be-typestage-pins hidden>
          <span class="be-typestage-pins-label">${t('Pinned')}</span>
          <div class="be-typestage-pinrow" data-be-typestage-pinrow></div>
          <span class="be-typestage-pinnote">${t('one press each')}</span>
        </div>
        <div data-be-typestage-mount></div>
        <p class="be-err" data-be-typestage-err hidden></p>
      </section>

      ${/* The management list: every installed family, its roles, and delete.
             Behaviour unchanged; only its place in the room moved. Adding a face
             now goes through the stage, so there is one door and everything is
             seen before it is stored. */''}
      <div class="be-panel be-fonts">
        ${panelHead(t('Fonts'), t("Every face on this device and the role it serves. Faces of the design system's own travel in its file; starter faces come with the app."))}
        <ul class="be-font-list" data-be-fonts role="list"></ul>
        <div class="be-font-add">
          <button type="button" class="be-btn" data-be-font-compare>${t('Add a face')}</button>
          <span class="be-font-addnote">${t('Opens the compare stage. Search Google Fonts, or drop a font file.')}</span>
        </div>
        <p class="be-err" data-be-font-err hidden></p>
      </div>

      ${/* The second upload door is gone (plan 182 T6, section 6.4): the stage's
             own drop zone is the one door for a file, and it runs the same
             validators the panel did. */''}
      <div class="be-panel be-typeroles">
        ${panelHead(t('Type roles'), t('What each face is <em>for</em> - the roles tools and the app read. Body and UI wear the primary; set an optional <em>display</em> face for the top headings (h1/h2), an <em>italic</em> face for emphasis, and a <em>mono</em> face for code and data. Each falls back to the primary until you assign it.'))}
        <div class="be-specimen" data-be-specimen aria-live="off"></div>
      </div>
      </div>

      <div class="be-tab" data-be-tab-panel="tokens">
      <div class="be-panel be-radius-panel">
        ${panelHead(t('Rounded corners'), t('One brand radius drives a full scale: fine controls use smaller steps, panels use the base, and the pill step becomes fully rounded. Set it to 0 for straight corners everywhere.'))}
        <div class="brand-radius-row">
          <span class="brand-radius-preview" data-be-radius-preview aria-hidden="true"></span>
          <input type="range" class="field-range brand-radius-slider" data-be-radius-slider min="0" max="1.5" step="0.05" aria-label="${escape(t('Corner radius'))}">
          <span class="brand-radius-value" data-be-radius-value></span>
        </div>
        <p class="be-err" data-be-radius-err role="alert" hidden></p>
      </div>
      <div class="be-panel be-space-panel">
        ${panelHead(t('Spacing rhythm'), t('One base space token drives every Lolly gap: the compact steps, controls, panels and page margins all move together. This only writes <code>space.base</code> to your brand.'))}
        <div class="brand-space-row">
          <span class="brand-space-preview" data-be-space-preview aria-hidden="true"><i></i><i></i><i></i></span>
          <input type="range" class="field-range brand-space-slider" data-be-space-slider min="0.25" max="1.5" step="0.05" aria-label="${escape(t('Base spacing'))}">
          <span class="brand-space-value" data-be-space-value></span>
        </div>
        <p class="be-err" data-be-space-err role="alert" hidden></p>
      </div>
      <div class="be-panel be-tokens" data-be-tokens-mount></div>
      </div>

      <div class="be-tab" data-be-tab-panel="catalogue">
      <div class="be-panel be-cat" data-be-cat-mount></div>
      </div>

      <!-- Swatch editor popover (shared; positioned under the clicked tile).
           The SAME pieces as the Colour panel's primary field, in a card: the
           identity row up top, then the full picker (mode tabs - the value input
           reads and writes hex/OKLCH/HSL/RGB/CMYK, so there's no separate "set by
           value" row), the storage notation, and the shared print-lock control
           folded away. Delete/Save are pinned to a sticky footer so the two
           actions never scroll off.
           The card grows with its folds and REPOSITIONS (see positionEditor) -
           opening a section moves the card to where it fits rather than starting
           an inner scroll. -->
      ${/* The bulk bar (plan 182 section 5.5). It arrives with the first selected
             tile and leaves with the last - there is no mode to be in. Move to
             and Give a role are held back until beat 2: at beat 1 the pane holds
             a handful of tiles and there is nothing to sort them into.
             Each menu is a button plus a panel that opens under it; the Move-to
             panel's rows are built at open time (they are the live group names),
             the other two are fixed lists and are written here. */''}
      <div class="be-bulkbar" data-be-bulkbar role="region" aria-label="${escape(t('Selection actions'))}" hidden>
        <span class="be-bulkbar-n" data-be-bulk-n aria-live="polite"></span>
        <button type="button" class="be-bulkbar-btn be-bulk-preview" data-be-bulk-preview>${t('Preview')}</button>
        <span class="be-bulkbar-sep" aria-hidden="true"></span>
        <span class="be-bulkbar-wrap" data-be-bulk-wrap="move">
          <button type="button" class="be-bulkbar-btn" data-be-bulk-menu="move" aria-haspopup="true" aria-expanded="false">${t('Move to')} <span aria-hidden="true">▾</span></button>
          <div class="be-bulkbar-menu" data-be-bulk-panel="move" hidden></div>
        </span>
        <span class="be-bulkbar-wrap" data-be-bulk-wrap="role">
          <button type="button" class="be-bulkbar-btn" data-be-bulk-menu="role" aria-haspopup="true" aria-expanded="false">${t('Give a role')} <span aria-hidden="true">▾</span></button>
          <div class="be-bulkbar-menu" data-be-bulk-panel="role" hidden>
            <p class="be-bulkbar-menu-note">${t('Each selected colour takes the next role in turn.')}</p>
            ${ROLE_IDS.map(r => `<button type="button" class="be-bulkbar-item" data-be-bulk-role="${escape(r)}">${escape(roleLabel(r))}</button>`).join('')}
          </div>
        </span>
        <span class="be-bulkbar-wrap" data-be-bulk-wrap="download">
          <button type="button" class="be-bulkbar-btn" data-be-bulk-menu="download" aria-haspopup="true" aria-expanded="false">${t('Download')} <span aria-hidden="true">▾</span></button>
          <div class="be-bulkbar-menu" data-be-bulk-panel="download" hidden>
            ${PALETTE_FORMATS.map(f => `<button type="button" class="be-bulkbar-item" data-be-bulk-dl="${escape(f.id)}">${escape(f.label)}</button>`).join('')}
          </div>
        </span>
        <button type="button" class="be-bulkbar-btn" data-be-bulk-copy>${t('Copy values')}</button>
        <button type="button" class="be-bulkbar-del" data-be-bulk-del>${t('Delete')}</button>
        <button type="button" class="be-bulkbar-x" data-be-bulk-cancel aria-label="${escape(t('Cancel selection'))}">✕</button>
      </div>
      <div class="be-editor" data-be-editor hidden>
        <div class="be-editor-card" role="dialog" aria-label="${escape(t('Edit swatch'))}">
          <div class="be-editor-scroll">
            <div class="be-editor-id">
              <span class="be-editor-chip" data-be-editor-chip aria-hidden="true"></span>
              <input type="text" class="be-editor-name" data-be-editor-name autocomplete="off" aria-label="${escape(t('Swatch name'))}">
              <span class="be-swatch-lock be-editor-lockbadge" data-be-editor-lockbadge hidden>${t('LOCK')}</span>
            </div>
            <div class="be-editor-field"><div data-be-editor-color></div></div>
            <label class="be-editor-group">${t('Group')}<select class="field-select" data-be-editor-group></select></label>
            <div class="be-editor-field be-stored" data-be-stored-row>
              <span class="be-stored-label" id="be-stored-label">${t('Stored as')}</span>
              ${/* Built from the shared segmented-control primitive (lib/seg.ts) - 
                    .be-stored-seg keeps only its delta (a compact joined trough
                    instead of .view-seg-btn's gapped pills; see brand-studio.css).
                    aria-labelledby, not aria-label: the group's name is already on
                    screen as #be-stored-label. No option starts pressed - every
                    button renders aria-pressed="false" and renderStoredSeg() marks
                    the open swatch's notation once the editor knows it. */''}
              ${segHtml('stored', STORAGE_FORMATS, '', '', {
                attr: 'data-store-fmt', extraClass: 'be-stored-seg', groupAttr: 'data-be-stored', labelledBy: 'be-stored-label',
              })}
            </div>
            ${/* Roles are identity, print is output - so "Use as" sits above the
                  print fold. Hidden for a role's own tile: a role cannot take a
                  role (the alias would chain). */''}
            <div class="be-useas-row" data-be-useas hidden>
              <span class="be-useas-label">${t('Use as')}</span>
              ${ROLE_IDS.map(r => `<button type="button" class="be-btn be-btn--sm" data-be-useas="${escape(r)}" aria-pressed="false">${escape(roleLabel(r))}</button>`).join('')}
            </div>
            <details class="be-subst-details" data-be-subst-details>
              <summary><span class="be-subst-details-label">${t('Print substitutes')}</span><span class="be-subst-chips" data-be-subst-chips></span></summary>
              <div data-be-subst-mount></div>
            </details>
            ${/* What this colour becomes everywhere else (plans/60-color-spaces.md
                  section 11.3). Folded, and BELOW the print substitutes: those are the
                  established control and this widens the same idea, so leading
                  with it would make the familiar row look like the afterthought. */''}
            <details class="be-subst-details be-faces-details" data-be-faces-details>
              <summary><span class="be-subst-details-label">${t('In other spaces')}</span><span class="be-subst-chips" data-be-faces-chips></span></summary>
              <div data-be-faces-mount></div>
            </details>
          </div>
          ${/* Two footers in one row, one pair showing at a time: Delete | Save
                for a swatch that exists, Cancel | Add colour for the pick card
                (plan 182 section 5.1), which is bound to no token until it is
                pressed. */''}
          <div class="be-editor-actions">
            <button type="button" class="be-editor-del" data-be-editor-del hidden>${t('Delete')}</button>
            <button type="button" class="be-editor-del be-editor-cancel" data-be-editor-cancel hidden>${t('Cancel')}</button>
            <button type="button" class="be-cta be-editor-done" data-be-editor-done>${t('Save')}</button>
            <button type="button" class="be-cta be-editor-done be-editor-add" data-be-editor-add hidden>${t('Add colour')}</button>
          </div>
        </div>
      </div>
    </div>`;

  const $ = <T extends Element>(sel: string): T | null => root.querySelector<T>(sel);
  const preview = $('[data-be-preview]') as HTMLElement | null;
  const palMount = $('[data-be-pal]') as HTMLElement | null;
  // The Colours room's own panel - the element the beat is stamped on, and the
  // scope every beat rule in brand-studio.css hangs off.
  const colorPanel = $('[data-be-tab-panel="color"]') as HTMLElement | null;
  const editorEl = $('[data-be-editor]') as HTMLElement | null;
  const editorCard = editorEl?.querySelector<HTMLElement>('.be-editor-card') ?? null;
  const cleanups: Array<() => void> = [];

  // The shared help-tip wiring (tap toggle, Escape, outside-click) for the
  // Logos lead's tip. Delegated on the studio root, and its document-level
  // dismiss listener comes off with the studio - a detached tree held alive by
  // one listener is the leak this primitive documents.
  wireHelpTips(root as HTMLElement & { _helpTipsWired?: boolean; _helpTipDismiss?: (e: MouseEvent) => void });
  cleanups.push(() => {
    const scope = root as HTMLElement & { _helpTipDismiss?: (e: MouseEvent) => void };
    if (scope._helpTipDismiss) document.removeEventListener('click', scope._helpTipDismiss, true);
  });

  // ── Palette state + persistence ─────────────────────────────────────────────
  let swatches: BrandSwatch[] = [];
  let selected = -1;
  // The OKLCH channel the palette grid's keyboard nudging steps (huetone-style).
  // A mode that persists across tiles; L by default, re-armed with l/c/h.
  // Null until a letter arms one: the arrow keys are the palette grid's
  // navigation (plan 182 section 5.5), and only an armed channel takes Arrow
  // Up/Down away from them.
  let armedChannel: 'L' | 'C' | 'H' | null = null;
  // The tile/dot the open swatch popover is anchored to - repositioning on
  // side-pane scroll needs it (the popover positions in `.be` space, so the
  // sticky pane's own scroll would otherwise drift it off its tile).
  let editorAnchor: HTMLElement | null = null;
  let saveTimer: ReturnType<typeof setTimeout> | undefined;
  // The wheel is a second view of the SAME swatches - assigned once the handlers
  // it needs (openEditor/applyEditedHex/addSwatch) exist, and called by every
  // repaintPalette so grid + wheel never drift.
  const wheelMount = $('[data-be-wheel-mount]') as HTMLElement | null;
  let wheelTeardown: (() => void) | undefined;
  let paintWheel: () => void = () => {};
  // The gamut chart - the same swatches again, on a plane through OKLCH space
  // where the sRGB/P3/Rec.2020 boundaries are visible. Only ONE of the two
  // charts is mounted at a time (the hidden one measures 0×0 and would paint
  // nothing anyway), so `chartView` gates both the markup and the repaints.
  const sliceMount = $('[data-be-slice-mount]') as HTMLElement | null;
  let sliceTeardown: (() => void) | undefined;
  let chartView: 'wheel' | 'slices' = 'wheel';
  // No cMax: the chart derives its chroma ceiling from the gamut it charts
  // (Rec.2020 by default, so 0.5), which is what stops the wide-gamut spikes
  // being drawn with flat tops.
  const sliceState: SliceChartState = { plane: 'lc', fixed: 30 };
  let paintSlices: () => void = () => {};

  // Hooks run at the end of every repaintPalette (the generator's candidate
  // "added" states + applied-previews subscribe here, so any palette change - 
  // add / delete / re-derive - keeps them in sync). Declared as a mutable list
  // to sidestep the TDZ: the generator functions are defined further below.
  const paletteHooks: Array<() => void> = [];
  // External observers of the COMMITTED palette (the handle's onPalette - the
  // mobile mirror, gradient stop chips). Notified from BOTH repaintPalette and
  // persist(): in-place recolours (wheel drags, popover edits) bypass
  // repaintPalette and only reach persist(), so either seam alone would miss
  // one path. Observers must tolerate double-fires (a repaint + its persist).
  const paletteObservers = new Set<() => void>();
  const notifyPaletteObservers = (): void => {
    for (const fn of paletteObservers) { try { fn(); } catch { /* observer's problem */ } }
  };
  // Every colour the SHIPPED starter document holds, as key+value pairs. Read
  // once after the first paint (the read is async and must not hold it up), and
  // empty on any brand that ships no starter - so the palette and the Overview
  // count agree about which colours nobody chose. See readStarterDoc.
  let starterSwatches = new Set<string>();
  /** Is a swatch still exactly as the starter shipped it? The one test, spelled
   *  once, so the pane, the count, the beat and the roles strip all agree. */
  const isStarterSwatch = (s: BrandSwatch): boolean =>
    starterSwatches.size > 0 && starterSwatches.has(starterId(s.key, s.raw));
  /** Colours the person actually chose - the headline number, and what the beat
   *  is decided on (plan 182 sections 3a, 4.2). Roles are skipped for the reason
   *  paletteHtml skips them: an alias is not a colour somebody added. */
  const ownColorCount = (): number => swatches.filter(s => s.kind !== 'semantic' && !isStarterSwatch(s)).length;
  let revealedStarterGroup: string | null = null;
  /** Which swatch wears which role mark, read off the doc's own aliases so the
   *  glyph and the Roles strip can never disagree. */
  const roleGlyphsNow = (): Map<string, string> => {
    const out = new Map<string, string>();
    let resolve: ((key: string) => unknown) | undefined;
    try {
      const set = createTokenSet(doc, { theme: currentTheme === 'dark' ? 'dark' : 'light' });
      resolve = (key: string) => set.resolve(key);
    } catch { /* unresolvable doc - no marks rather than wrong ones */ }
    const held = readRoles(doc, currentTheme === 'dark' ? 'dark' : 'light', resolve);
    for (const role of ROLE_IDS) {
      const ref = held[role]?.ref;
      const glyph = ROLE_GLYPH[role];
      if (ref && glyph && !out.has(ref)) out.set(ref, glyph);
    }
    return out;
  };
  const repaintPalette = (): void => {
    // Roles store `{alias}` refs, so hand the walker a resolver built from the
    // SAME doc + theme the tiles are describing - otherwise every role renders
    // as a blank chip.
    let resolve: ((key: string) => unknown) | undefined;
    try {
      const set = createTokenSet(doc, { theme: currentTheme === 'dark' ? 'dark' : 'light' });
      resolve = (key: string) => set.resolve(key);
    } catch { /* a malformed doc still lists its literal swatches */ }
    // Excluded keys (a "deleted" derived step/role - the token stays, the tile
    // goes) are filtered here, so the grid, wheel, picker swatches and gradient
    // stop grids all inherit the exclusion from this one seam.
    const excluded = new Set(getExcludedSwatches(doc));
    swatches = walkSwatches(doc, currentTheme, resolve).filter(s => !excluded.has(s.key));
    if (palMount) {
      // Keep user-folded sections folded across the innerHTML replace (every
      // group renders `open` by default) - the same re-render/state guard the
      // gradients panel's details carries. Session-only; no persistence.
      const closed = new Set(
        [...palMount.querySelectorAll<HTMLDetailsElement>('.be-pal-group:not([open])')]
          .map(d => d.dataset.beGroup ?? '').filter(Boolean),
      );
      palMount.innerHTML = paletteHtml(swatches, starterSwatches, {
        roles: roleGlyphsNow(), starterGroup: revealedStarterGroup,
        groups: paletteGroups(doc), hidden: excluded.size,
      });
      if (closed.size) {
        palMount.querySelectorAll<HTMLDetailsElement>('.be-pal-group').forEach(d => {
          if (closed.has(d.dataset.beGroup ?? '')) d.open = false;
        });
      }
    }
    paintWheel();
    paintSlices();
    syncPickerSwatches();
    for (const fn of paletteHooks) fn();
    applyBeat();
    notifyPaletteObservers();
  };

  // Ownership still informs Overview and mobile affordances; it never hides palette editing.
  let beat: Beat = 2;
  /** A beat the room owes but has not applied - see applyBeat. */
  let beatPending = false;
  /** The ramp only a generate writes. `deriveBrandTokens` always emits
   *  `secondary`, so its presence is the cheapest honest answer to "has a
   *  palette been generated here" - the same test the Overview's
   *  `worthExporting` latch makes, deliberately spelled the same way. */
  const GENERATED_RAMP = /(^|\.)ramp\.secondary\./;
  /**
   * Stamp the beat, unless something is open over the room.
   *
   * The layout MOVES between beats - the split appears, panels arrive - and
   * doing that under an open swatch card or picker would pull the thing the
   * person is operating out from under them. So a beat that falls due mid-
   * interaction is held and applied by the next close (see closeEditor).
   */
  const applyBeat = (): void => {
    if (!colorPanel) return;
    if (editorEl && !editorEl.hidden) { beatPending = true; return; }
    beatPending = false;
    const next = colourBeat(
      { counts: { ownColors: ownColorCount(), starterColors: 0, ownFaces: 0, logos: 0 } },
      { generatedRamp: swatches.some(s => GENERATED_RAMP.test(s.key)) },
    );
    if (colorPanel.dataset.beBeat === String(next)) return;
    beat = next;
    colorPanel.dataset.beBeat = String(next);
    syncAddPlaceholder();
    // The roles strip widens to all seven slots at beat 2 (plan 182 section 5.7),
    // and the palette hooks above have already run with the OLD beat - so the
    // strip is re-rendered here, on the change itself. Its own render is a no-op
    // patch when the row set has not moved.
    rolesStrip?.render();
  };

  // Feed the colour PICKER's swatch grid from the live (draft) brand palette, so
  // the inline primary picker's swatches reflect exactly the colours this brand
  // carries - and grow/shrink as the user adds or deletes them. Roles (aliases)
  // are skipped (they duplicate the ramp step they point at); transparent leads.
  // refreshSwatches repopulates the already-open inline grid in place.
  const syncPickerSwatches = (): void => {
    const opts = swatches
      .filter(s => s.hex && s.kind !== 'semantic')
      .map(s => ({ value: s.hex, label: s.name, group: s.group, ref: s.isAlias ? null : `{${s.key}}` }));
    setSwatches([{ value: 'transparent', label: t('Transparent'), group: null, ref: null }, ...opts]);
    refreshSwatches(root);
  };

  /** A `{path}` alias (or bare dotted path) → its current hex, or null. Reads
   *  the `swatches` array first - kept fresh by BOTH repaintPalette and the
   *  in-place recolour paths, so gradient chips resolve mid-drag values without
   *  re-flattening the doc - falling back to a full token-set resolve for refs
   *  that aren't palette swatches (hand-authored imports). */
  const resolveTokenRef = (ref: string): string | null => {
    const key = aliasPath(ref) ?? ref;
    const hit = swatches.find(s => s.key === key && s.hex);
    if (hit) return hit.hex;
    try {
      return colorToHex(createTokenSet(doc, { theme: currentTheme === 'dark' ? 'dark' : 'light' }).resolve(ref)) ?? null;
    } catch { return null; }
  };

  // ── Session undo (plan 97 section 6) ───────────────────────────────────────────────
  // The one save discipline means every commit writes straight through, so the
  // destructive actions need a way back. Snapshots are whole documents - a few
  // KB of JSON - so the cap is memory-shaped, not a product limit. Checkpoints
  // (the durable, cross-reload net) belong to the host and are reached through
  // opts.checkpoint. Six actions push, every one of which REMOVES something the
  // user cannot retype: Replace palette, bulk delete, a single swatch delete,
  // clearing a role from the strip, un-pressing a "Use as" role in the swatch
  // popover, and "Rebuild from colour" (which discards a hand-tuned curve). An
  // ordinary recolour, rename or curve drag is not destructive - the value is
  // still on screen - and would only flood the stack.
  const UNDO_LIMIT = 20;
  const undoStack: Array<{ doc: Record<string, unknown>; label: string }> = [];
  const pushUndo = (label: string): void => {
    if (!isRec(doc)) return;
    undoStack.push({ doc: structuredClone(doc) as Record<string, unknown>, label });
    if (undoStack.length > UNDO_LIMIT) undoStack.shift();
    const undo = $<HTMLButtonElement>('[data-be-undo]');
    if (undo) { undo.hidden = false; undo.textContent = tRaw('Undo: {action}', { action: label }); }
  };
  /** Take a durable checkpoint through the host, best-effort. A rejection is a
   *  missing safety net, never a failed edit - the local stack still has it. */
  const ctxCheckpoint = (label: string): void => {
    try { void opts.checkpoint?.(label)?.catch?.(() => {}); } catch { /* host's problem */ }
  };

  /** Tell the host view a brand edit just landed on `tab` (Save-&-continue
   *  appearance + next-tab nudge). Best-effort - a throwing listener must never
   *  break an edit. */
  const notify = (tab: BrandTabKey): void => { try { opts.onChange?.(tab); } catch { /* host's problem */ } };

  /**
   * Push the edited doc to the install (debounced) + refresh chrome & pickers.
   * The ONE write, and the one save discipline: every commit-level action in
   * this room calls it immediately (plan 97 section 6). Every caller is a Colour-tab
   * surface (palette tiles, wheel, locks, generator, the add row), so this is
   * also the one place that flags colour-tab activity to the host.
   */
  let saveQueue = Promise.resolve();
  let saveRevision = 0;
  const persist = (immediate = false): void => {
    const revision = ++saveRevision;
    clearTimeout(saveTimer);
    const status = $<HTMLElement>('[data-be-save-state]');
    if (status) { status.hidden = false; status.textContent = t('Saving…'); status.classList.remove('is-error'); }
    notify('color');
    notifyPaletteObservers(); // the doc is already mutated - mirrors repaint now, not post-debounce
    const run = (): void => {
      const snapshot = structuredClone(doc);
      saveQueue = saveQueue.then(async () => {
      try {
        await installUserTokens(host as unknown as Parameters<typeof installUserTokens>[0], snapshot, { label: 'My brand' });
        if (status && revision === saveRevision) { status.textContent = t('Saved'); }
        void applyChromeBrandVars(host);
        // Reflect the new palette in every picker without a tool remount.
        try {
          const cols = (await tokens?.colors?.()) ?? [];
          setSwatches(cols.map(c => ({ value: c.value, label: c.name, group: c.group, ref: c.ref })));
        } catch { /* pickers refresh on next tool mount regardless */ }
      } catch (err) {
        if (status && revision === saveRevision) { status.classList.add('is-error'); status.textContent = tRaw("Couldn't save: {error}", { error: String((err as { message?: unknown })?.message ?? err) }); }
        if (root.isConnected) announce(tRaw("Couldn't save the brand: {error}", { error: String((err as { message?: unknown })?.message ?? err) }), { assertive: true });
      }
      });
    };
    if (immediate) run(); else saveTimer = setTimeout(run, 300);
  };

  /**
   * How many shade steps the INSTALLED doc's ramp actually carries.
   *
   * NOT `steps`: that is the Generate wing's Shades slider, a preview-only
   * control that deliberately writes nothing until Replace palette is applied.
   * Baking a curve into `doc` at the slider's count rewrites leaves `1..n` and
   * leaves the rest of a longer ramp untouched, which is how a 9-step ramp
   * baked at 5 came out non-monotonic (step 5 the lightest, step 6 back down)
   * with duplicated tails. Every write into the committed document counts the
   * document's own leaves; only the preview follows the slider. 0 when the ramp
   * is absent, so callers fall back to the slider for a doc with no ramps.
   */
  const docRampSteps = (ramp: RampId): number => {
    const base = (isRec(doc) && isRec((doc as Record<string, unknown>).base)
      ? (doc as Record<string, unknown>).base : doc) as Record<string, unknown>;
    const group = leafAt(base, ['color', 'ramp', ramp]);
    return group ? Object.keys(group).filter(k => /^\d+$/.test(k)).length : 0;
  };
  /** The step count a write into `doc` must use for `ramp`. */
  const bakeSteps = (ramp: RampId): number => docRampSteps(ramp) || steps;

  /** Set once the Replace-palette review card exists (it is declared far below
   *  this, and every derive control funnels through renderPreview). A parked
   *  proposal describes the controls as they were when it was built, so a later
   *  change must drop it rather than leave a card that would install a document
   *  the panel no longer describes. */
  let dropPendingReplacement: () => void = () => {};

  // ── Derive controls (the Generate wing) ─────────────────────────────────────
  // Exploring does not write. Only adding shades or applying a reviewed full
  // rebuild changes the palette; specimens outside this wing stay committed.
  const renderPreview = (): void => {
    const next = deriveSafe({ primary, scheme, surface, contrast, steps, foreground });
    if (!next) return; // a half-typed hex mid-edit - keep the last good preview
    // Exploration starts from the chosen colour. Saved curves belong to the
    // existing palette and the optional full rebuild, not to these new shades.
    if (preview) {
      const themesOpen = preview.querySelector<HTMLDetailsElement>('.be-draft-themes')?.open;
      const focusedStep = document.activeElement instanceof HTMLElement && preview.contains(document.activeElement)
        ? { ramp: document.activeElement.dataset.beRamp, step: document.activeElement.dataset.beStep } : null;
      preview.innerHTML = previewHtml(next, { neutral: neutralStep, secondary: secondaryStep, steps, curves: curveMarks(), palette: walkSwatches(doc, currentTheme).filter(s => s.kind !== 'semantic').flatMap(s => s.hex ? [s.hex] : []) });
      const themes = preview.querySelector<HTMLDetailsElement>('.be-draft-themes');
      if (themes && themesOpen) themes.open = true;
      if (focusedStep?.ramp && focusedStep.step) preview.querySelector<HTMLElement>(`[data-be-ramp="${focusedStep.ramp}"][data-be-step="${focusedStep.step}"]`)?.focus({ preventScroll: true });
    }
    dropPendingReplacement(); // the parked proposal is now stale - see its comment
    // Deliberately NO notify(): a preview-only change has landed nowhere, so
    // telling the host an edit happened would be a lie.
  };
  // Shades slider - how many divisions each ramp carries. Re-derives live; the
  // neutral/secondary step picks re-centre on the new anchor (and clamp in range).
  const stepsSlider = $('[data-be-steps]') as HTMLInputElement | null;
  const stepsVal = $('[data-be-steps-val]') as HTMLElement | null;
  stepsSlider?.addEventListener('input', () => {
    steps = Math.round(Number(stepsSlider.value)) || DEFAULT_STEPS;
    if (stepsVal) stepsVal.textContent = String(steps);
    neutralStep = Math.min(neutralStep, steps);
    secondaryStep = Math.min(secondaryStep, steps);
    renderPreview();
    syncCurveEditor(); // the curve is the master; the slider only resamples it
  });
  const onPrimaryFieldChange = (id: string, value: string | { value: string }): void => {
    if (id !== 'be-primary') return;
    const raw = typeof value === 'string' ? value : value.value;
    if (!raw || raw === 'transparent') return;
    const nextPrimary = /^#[0-9a-fA-F]{8}$/.test(raw) ? raw.slice(0, 7) : raw;
    reanchorCurvesTo(nextPrimary); // shift live curves by the primary delta (never discard)
    primary = nextPrimary;
    renderPreview();
    renderScreen();
    primaryLock?.render();
    renderGenerator();
  };
  wireColorField(root, { onChange: onPrimaryFieldChange });
  /** Programmatically move the primary (the logo-colour pathway): re-seed the
   *  visual field (fresh render + wire - no setter exists on the component) and
   *  run the same fan-out a manual pick runs. */
  const setPrimaryTo = (hex: string): void => {
    reanchorCurvesTo(hex); // keep any live curves anchored to the moving primary
    primary = hex;
    const wrap = $('[data-be-primary-field]') as HTMLElement | null;
    if (wrap) {
      wrap.innerHTML = colorFieldHtml('be-primary', hex, { inline: true, modes: true, progressive: true });
      wireColorField(wrap, { onChange: onPrimaryFieldChange });
      refreshSwatches(wrap);
    }
    renderPreview();
    renderScreen();
    primaryLock?.render();
    renderGenerator();
  };

  // ── Level-2 wings ───────────────────────────────────────────────────────────
  // Four folded disclosures under the Add + Roles panels. Closed on mount, no
  // persistence - the same discipline the palette's own sections keep.
  type WingKey = 'generate' | 'curves' | 'contrast' | 'print';
  const wingEl = (k: WingKey): HTMLDetailsElement | null => $(`[data-be-wing="${k}"]`);
  /** Open a wing and bring it into view. False when it is absent (a locked build
   *  renders no studio at all). Scrolls ONLY when the wing was closed: revealing
   *  something is worth moving the page for, re-pointing a control inside a wing
   *  that is already open is not - that scroll used to yank the viewport away
   *  from whatever the user was actually using. */
  const openWing = (k: WingKey): boolean => {
    const el = wingEl(k);
    if (!el) return false;
    const wasOpen = el.open;
    el.open = true;
    // Guarded: jsdom (the CLI shell's renderer, and the unit tests) has no
    // scrollIntoView, and this runs on the ordinary curve-glyph path. The glide
    // is JS-driven motion, so it asks the shared read (OS query OR the app pref)
    // and jumps instead when either says reduce - the wing's own CSS marker
    // rotation is already gated the same way.
    if (!wasOpen) {
      el.scrollIntoView?.({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
    return true;
  };

  // The ramp picker is rendered once per wing, so both instances must agree.
  const syncRampPick = (): void => {
    root.querySelectorAll<HTMLElement>('[data-be-ramp-pick] [data-ramp]').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.ramp === curveRamp)));
  };

  // ── Tonal-curve editor wiring ───────────────────────────────────────────────
  // A curve edit is a real write, debounced like every other edit in the room:
  // it bakes the ramp's steps onto `doc` and installs once the drag settles.
  const curveEditorMount = $('[data-be-curve-editor]') as HTMLElement | null;
  const curveMountEl = $('[data-be-curve-mount]') as HTMLElement | null;
  const curveTitleEl = $('[data-be-curve-title]') as HTMLElement | null;
  let curveHandle: CurveEditorHandle | null = null;

  /** Any CSS colour → OKLCH: exact for oklch()/lch() literals, else via hex. */
  const colorToOklch = (s: string): Oklch | null => {
    const direct = parseOklch(s);
    if (direct) return direct;
    const hex = colorToHex(s);
    return hex ? hexToOklch(hex) : null;
  };
  /** Re-anchor every live curve by the primary's per-channel delta (old anchor →
   *  new primary), so a primary edit carries an edited palette with it rather
   *  than dropping it. Cumulative - the anchor tracks each step, so composed
   *  deltas sum. A no-op (bar bookkeeping) when no ramp carries a curve. */
  const reanchorCurvesTo = (nextPrimary: string): void => {
    if (!RAMP_IDS.some(r => curves[r])) { curveAnchorPrimary = nextPrimary; return; }
    const pOld = colorToOklch(curveAnchorPrimary);
    const pNew = colorToOklch(nextPrimary);
    if (pOld && pNew) {
      for (const r of RAMP_IDS) { const c = curves[r]; if (c) curves[r] = reanchorCurve(c, pOld, pNew); }
      syncCurveEditor();
    }
    curveAnchorPrimary = nextPrimary;
  };
  /** Push the current curve + step count into an open editor (Shades slider,
   *  re-anchor). No-op when nothing is open. */
  const syncCurveEditor = (): void => {
    if (!editingCurveRamp || !curveHandle) return;
    curveHandle.render({ curve: curves[editingCurveRamp], steps });
  };
  const closeCurveEditor = (repaint = true): void => {
    editingCurveRamp = null;
    curveHandle?.teardown(); curveHandle = null;
    if (curveEditorMount) curveEditorMount.hidden = true;
    if (repaint) renderPreview(); // clear the row's open state (skipped in reload)
  };
  // A curve drag fires per frame. renderPreview is cheap (one re-derive into the
  // wing's own markup); the palette repaint is not - it rebuilds the grid, the
  // wheel and the gamut slices - and NEITHER is persist(): it synchronously runs
  // notify('color') (the host re-reads the whole design system for the Overview)
  // and notifyPaletteObservers() (the mobile sheet rebuilds its markup and
  // re-measures) before its own 300ms install debounce even starts. Both are
  // exactly the work a per-frame handler must not do, so the repaint AND the
  // save trail the drag by 250ms together.
  const CURVE_SETTLE_MS = 250;
  let curveSettleTimer: ReturnType<typeof setTimeout> | undefined;
  let curveSaveDue = false;
  /** A curve edit landed on `doc`: repaint + install once the drag settles. */
  const queueCurveSave = (): void => {
    curveSaveDue = true;
    clearTimeout(curveSettleTimer);
    curveSettleTimer = setTimeout(() => {
      curveSaveDue = false;
      if (root.isConnected) repaintPalette();
      persist(true);
    }, CURVE_SETTLE_MS);
  };
  /** Drop a pending settle - for a path that has just persisted the same doc
   *  itself (the one-shot transforms), so it doesn't install twice. */
  const cancelCurveSave = (): void => { clearTimeout(curveSettleTimer); curveSaveDue = false; };
  // A teardown mid-drag must not repaint a dead tree - but it must not eat the
  // last frame either, so a pending save is flushed rather than dropped.
  cleanups.push(() => {
    clearTimeout(curveSettleTimer);
    if (curveSaveDue) { curveSaveDue = false; persist(true); }
  });

  const openCurveEditor = (ramp: RampId, opts2: { toggle?: boolean; reveal?: boolean } = {}): void => {
    if (opts2.toggle !== false && editingCurveRamp === ramp) { closeCurveEditor(); return; }
    // The editor lives in the Curves wing now, and a curve glyph clicked on a
    // preview ramp row sits in the Generate wing - reveal its home first.
    // `reveal: false` is for a control INSIDE another wing re-pointing an editor
    // that is already open: the editor moves, the viewport does not.
    if (opts2.reveal !== false) openWing('curves');
    editingCurveRamp = ramp;
    curveRamp = ramp;
    syncRampPick();
    // Seed on first open from the LIVE draft derive (so it matches the visible
    // preview even after an uncommitted primary/scheme/shade change), at full
    // OKLCH precision - an untouched ramp re-bakes byte-identically until the
    // user actually drags. Falls back to the committed doc if the derive fails.
    if (!curves[ramp]) {
      const draft = deriveSafe({ primary, scheme, surface, contrast, steps, foreground });
      curves[ramp] = seedRampCurve(draft ?? doc, ramp, steps);
    }
    curveAnchorPrimary = primary; // curves are now anchored to today's primary
    if (curveEditorMount) curveEditorMount.hidden = false;
    if (curveTitleEl) curveTitleEl.textContent = tRaw('{label} tonal curve', { label: RAMP_LABEL[ramp] });
    if (curveMountEl) {
      curveHandle?.teardown();
      curveHandle = mountCurveEditor(curveMountEl, {
        curve: curves[ramp]!, steps,
        onChange: (next) => {
          // The open ramp can change under a re-anchor; always write the LIVE one.
          if (!editingCurveRamp) return;
          curves[editingCurveRamp] = next;
          // A real write: bake the steps + stamp the curve on the doc, repaint
          // the wing's preview per frame, and let the palette + install trail.
          // The bake counts the DOC's own steps, never the preview slider - 
          // see docRampSteps.
          overlayRampCurves(doc, { [editingCurveRamp]: next }, bakeSteps(editingCurveRamp));
          renderPreview();
          queueCurveSave();
        },
      });
    }
    renderPreview(); // reflect the open + edited state on the ramp rows
  };
  /** Open (never toggle) the curve editor on the wings' currently picked ramp - 
   *  what the Curves wing does on reveal and what its ramp picker does. */
  const showCurveEditor = (ramp: RampId): void => { openCurveEditor(ramp, { toggle: false }); };
  /** "Rebuild from colour": drop this ramp's curve and re-bake ONLY its steps
   *  from the pure derive (other ramps + manual palette edits untouched). Never
   *  a silent discard - it's an explicit reset, and it lands immediately. */
  const rebuildRampFromColour = (): void => {
    const ramp = editingCurveRamp ?? curveRamp;
    if (!isRec(doc)) return;
    // It DELETES a hand-tuned curve and overwrites the ramp's steps, and a curve
    // cannot be retyped - so it takes a snapshot, like every other removal.
    pushUndo(t('Rebuild from colour')); // the button's own label - no new string
    cancelCurveSave(); // this path persists itself; no stale settle behind it
    delete curves[ramp];
    setRampCurve(doc, ramp, null); // clear the stored curve on the committed doc
    // Copy this ramp's pure-derive step literals back over the doc so the palette
    // reflects the reset immediately. Derived at the DOC's shade count, not the
    // preview slider's: copyRampLiterals only overwrites the leaves the source
    // has, so a shorter derive would leave the ramp's tail on the old curve.
    const fresh = deriveSafe({ primary, scheme, surface, contrast, steps: bakeSteps(ramp), foreground });
    if (fresh) copyRampLiterals(fresh, ramp);
    closeCurveEditor(); // re-renders the preview → pure derive for this ramp
    repaintPalette();
    persist(true);
    announce(tRaw('{label} ramp rebuilt from your colour', { label: RAMP_LABEL[ramp] }));
  };
  /** Copy one ramp's numeric step `$value`s from `src` into the committed `doc`. */
  const copyRampLiterals = (src: Record<string, unknown>, ramp: string): void => {
    if (!isRec(doc)) return;
    const sBase = (isRec(src.base) ? src.base : src) as Record<string, unknown>;
    const dBase = (isRec(doc.base) ? doc.base : doc) as Record<string, unknown>;
    const sGroup = leafAt(sBase, ['color', 'ramp', ramp]);
    const dGroup = leafAt(dBase, ['color', 'ramp', ramp]);
    if (!sGroup || !dGroup) return;
    for (const k of Object.keys(dGroup)) {
      if (!/^\d+$/.test(k)) continue;
      const sv = sGroup[k], dv = dGroup[k];
      if (isRec(sv) && isRec(dv) && typeof (sv as Record<string, unknown>).$value === 'string') {
        (dv as Record<string, unknown>).$value = (sv as Record<string, unknown>).$value;
      }
    }
  };
  curveEditorMount?.querySelector('[data-be-curve-rebuild]')?.addEventListener('click', () => rebuildRampFromColour());
  curveEditorMount?.querySelector('[data-be-curve-close]')?.addEventListener('click', () => closeCurveEditor());
  cleanups.push(() => { curveHandle?.teardown(); curveHandle = null; });

  // ── Contrast-lock (a curve TRANSFORM over the picked ramp) ───────────────────
  // Builds a fresh curve that hits per-step APCA targets against a background,
  // KEEPING each step's hue + chroma, then hands it to the SAME curve machinery
  // every other curve rides. The commit shape mirrors the sibling "Rebuild from
  // colour" button (rebuildRampFromColour): write curves[ramp], overlay onto the
  // doc (bake + stamp), re-render the editor + preview, repaint the palette, and
  // persist. One-shot: afterwards the ramp is an ordinary curve (drag / re-anchor
  // on primary edit / Rebuild-from-colour all apply as-is).
  const clBgInput = $('[data-be-cl-bg]') as HTMLInputElement | null;
  const clPresetSel = $('[data-be-cl-preset]') as HTMLSelectElement | null;
  const clCustomInput = $('[data-be-cl-custom]') as HTMLInputElement | null;
  const clReadout = $('[data-be-cl-readout]') as HTMLElement | null;
  const applyContrastLock = (): void => {
    // The transform lives in its own wing now, so it acts on the ramp the wings'
    // picker names - not on whichever curve editor happens to be open.
    const ramp = curveRamp;
    if (!isRec(doc)) return;
    const rawPreset = clPresetSel?.value;
    const preset: ContrastLockPreset = rawPreset === 'text' || rawPreset === 'ui' ? rawPreset : 'even';
    const custom = clCustomInput?.value ?? '';
    // A valid picked colour wins; anything unreadable falls back to the resolved
    // surface (never an empty bg, which the solver can't measure against).
    const bg = (clBgInput?.value ? colorToHex(clBgInput.value) : null) ?? surfaceHex();
    // Every count here is the INSTALLED ramp's, not the preview slider's - this
    // writes the committed doc (see docRampSteps), so the targets, the solve and
    // the bake all have to describe the same ramp.
    const n = bakeSteps(ramp);
    const targets = contrastTargets(preset, n, custom);
    // Seed a curve when this ramp has none yet - from the LIVE draft derive so it
    // matches the visible preview, exactly like openCurveEditor's first-open seed.
    const base = curves[ramp]
      ?? seedRampCurve(deriveSafe({ primary, scheme, surface, contrast, steps, foreground }) ?? doc, ramp, steps);
    const { curve, unreachable } = contrastLockCurve(base, n, targets, bg);
    curves[ramp] = curve;
    curveAnchorPrimary = primary;           // the locked curve is anchored to today's primary
    cancelCurveSave();                      // this path persists itself
    overlayRampCurves(doc, { [ramp]: curve }, n); // bake steps + stamp the curve on the committed doc
    if (editingCurveRamp === ramp) curveHandle?.render({ curve, steps }); // reflect it in an open editor
    renderPreview();                        // repaint the wing's ramp rows
    repaintPalette();                       // the Palette panel shows the retoned steps
    persist(true);
    if (clReadout) {
      clReadout.textContent = unreachable === 0
        ? t('All shades reached their target.')
        : unreachable === 1
          ? t('1 shade could not reach its target (capped at the closest tone).')
          : tRaw('{n} shades could not reach their target (capped at the closest tone).', { n: unreachable });
    }
    announce(tRaw('{label} ramp contrast-locked', { label: RAMP_LABEL[ramp] }));
    playSfx('click');
  };
  $('[data-be-cl-apply]')?.addEventListener('click', () => applyContrastLock());

  // ── Rotate hue (a curve TRANSFORM over the picked ramp) ──────────────────────
  // Shifts every step's hue by a fixed angle (L + C untouched, gamut-mapped at
  // bake by oklchToHex), rotating the whole ramp bodily around the wheel. The
  // commit shape is the SAME as contrast-lock / Rebuild-from-colour: write
  // curves[ramp], overlay onto the doc (bake + stamp), re-render the editor +
  // preview, repaint the palette, persist. One-shot: the slider resets to 0
  // afterwards and the ramp is an ordinary curve (further rotation composes;
  // drag / re-anchor / Rebuild all apply as-is).
  const hrDegInput = $('[data-be-hr-deg]') as HTMLInputElement | null;
  const hrDegVal = $('[data-be-hr-val]') as HTMLElement | null;
  hrDegInput?.addEventListener('input', () => {
    if (hrDegVal) hrDegVal.textContent = `${Number(hrDegInput.value) || 0}°`;
  });
  const applyHueRotate = (): void => {
    const ramp = curveRamp;
    if (!isRec(doc)) return;
    const degrees = Number(hrDegInput?.value) || 0;
    if (!degrees) return; // 0° is a no-op - nothing to commit
    // Seed a curve when this ramp has none yet - from the LIVE draft derive so it
    // matches the visible preview, exactly like applyContrastLock's seed.
    const base = curves[ramp]
      ?? seedRampCurve(deriveSafe({ primary, scheme, surface, contrast, steps, foreground }) ?? doc, ramp, steps);
    const curve = rotateCurveHue(base, degrees);
    curves[ramp] = curve;
    curveAnchorPrimary = primary;           // the rotated curve is anchored to today's primary
    cancelCurveSave();                      // this path persists itself
    overlayRampCurves(doc, { [ramp]: curve }, bakeSteps(ramp)); // bake the doc's own steps + stamp the curve
    if (editingCurveRamp === ramp) curveHandle?.render({ curve, steps }); // reflect it in an open editor
    renderPreview();                        // repaint the wing's ramp rows
    repaintPalette();                       // the Palette panel shows the rotated steps
    persist(true);
    if (hrDegInput) hrDegInput.value = '0'; // reset - the transform is applied, further turns compose
    if (hrDegVal) hrDegVal.textContent = '0°';
    announce(tRaw('{label} ramp hue rotated', { label: RAMP_LABEL[ramp] }));
    playSfx('click');
  };
  $('[data-be-hr-apply]')?.addEventListener('click', () => applyHueRotate());

  // ── Wing wiring: the ramp picker (two instances) + the Curves wing's reveal ──
  root.querySelectorAll<HTMLElement>('[data-be-ramp-pick]').forEach(seg => {
    // The Curves wing's own picker OWNS the editor: it opens it on whichever
    // ramp is picked, which is also the way back after the editor's ✕ (the wing
    // would otherwise show a picker that does nothing at all until it is
    // collapsed and re-expanded). Any other copy - the Contrast wing's - only
    // re-points an editor that is already showing, and never reveals the Curves
    // wing behind it or scrolls the page there mid-interaction.
    const ownsEditor = !!seg.closest('[data-be-wing="curves"]');
    seg.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-ramp]'); if (!btn) return;
      const next = btn.dataset.ramp;
      if (next !== 'primary' && next !== 'neutral' && next !== 'secondary') return;
      curveRamp = next;
      syncRampPick();
      if (ownsEditor) showCurveEditor(curveRamp);
      else if (editingCurveRamp) openCurveEditor(curveRamp, { toggle: false, reveal: false });
    });
  });
  // The editor lives in the Curves wing and is hidden until asked; revealing the
  // wing IS the ask, so it opens on whichever ramp the picker names.
  wingEl('curves')?.addEventListener('toggle', function (this: HTMLDetailsElement) {
    if (this.open) showCurveEditor(curveRamp);
  });

  /** The last primary that resolved to a real hex - what an unreadable primary
   *  falls back to, so the generator never sees a broken string. */
  let goodPrimaryHex = /^#[0-9a-fA-F]{6,8}$/.test(primary) ? primary.slice(0, 7) : DEFAULT_PRIMARY;
  /** The current primary as a `#`-prefixed hex (shared by the generator + the
   *  screen/print readout below). `primary` is whatever the picker or a token
   *  resolution handed over - a named colour, `oklch()`, or a wide-gamut
   *  `color()` all reach here - and generateSchemeAccents throws on anything that
   *  is not a hex, which empties the candidate list. So parse it properly:
   *  concatenating a `#` onto `oklch(62% 0.19 260)` produced a string nothing
   *  downstream could read. */
  const primaryHex = (): string => {
    const p = (primary || '').trim();
    if (/^#[0-9a-fA-F]{6,8}$/.test(p)) { goodPrimaryHex = p.slice(0, 7).toLowerCase(); return goodPrimaryHex; }
    const parsed = p && p.toLowerCase() !== 'transparent' ? parseCssColor(p) : null;
    if (parsed) goodPrimaryHex = colorToHexString(parsed).slice(0, 7);
    return goodPrimaryHex;
  };

  // ── Build the palette: generate harmony accents (named) + live "applied" previews ──
  // Each accent is a candidate the user must explicitly + Add to officiate it
  // into the brand (addSwatch → repaintPalette → persist), matching the Palette
  // panel's add semantics. The previews render the CURRENT brand palette on
  // illustrative graphics so the effect of adding/removing colours is felt.
  const candidatesEl = $('[data-be-candidates]') as HTMLElement | null;
  const previewsEl = $('[data-be-previews]') as HTMLElement | null;
  /** The brand's live palette as hexes (primary first), deduped - feeds the previews. */
  let previewSelection: string[] = [];
  let previewScene = 0;
  const paletteHexes = (): string[] => {
    const out: string[] = [];
    const seen = new Set<string>();
    const add = (h: string | undefined): void => { const k = (h || '').toLowerCase(); if (h && /^#[0-9a-fA-F]{6}/.test(h) && !seen.has(k)) { seen.add(k); out.push(h.slice(0, 7)); } };
    if (previewSelection.length) swatches.filter(s => previewSelection.includes(s.key)).forEach(s => { add(s.hex); });
    else {
      const material = swatches.filter(s => s.kind !== 'semantic');
      const chosen = material.filter(s => !isStarterSwatch(s) || paletteGroups(doc).includes(groupName(s.group)));
      const pool = chosen.length ? chosen : material;
      const primaryRole = readRoles(doc, currentTheme === 'dark' ? 'dark' : 'light').primary.ref;
      const lead = pool.find(s => s.key === primaryRole);
      if (lead) add(lead.hex);
      for (const s of pool.filter(s => s.kind === 'custom' || s.kind === 'spectrum')) add(s.hex);
      for (const s of pool) add(s.hex);
    }
    return out;
  };
  const isInPalette = (hex: string): boolean => {
    const k = hex.toLowerCase().slice(0, 7);
    return swatches.some(s => (s.hex || '').toLowerCase().slice(0, 7) === k);
  };
  const renderCandidates = (): void => {
    if (!candidatesEl) return;
    let accents: ReturnType<typeof generateSchemeAccents> = [];
    try {
      accents = harmonyKind === 'analogous'
        ? generateAnalogous(primaryHex(), { count: analogCount, angle: analogAngle })
        : generateSchemeAccents(primaryHex(), harmonyKind);
    } catch { accents = []; }
    candidatesEl.innerHTML = accents.map(a => {
      const name = nameColor(a.hex);
      const added = isInPalette(a.hex);
      return `<div class="be-cand${added ? ' is-added' : ''}">
          <span class="be-cand-sw" style="background:${escape(a.hex)}" aria-hidden="true"></span>
          <span class="be-cand-meta"><span class="be-cand-name">${escape(name)}</span><span class="be-cand-hex">${escape(a.hex)}</span></span>
          <button type="button" class="be-cand-add" data-add-hex="${escape(a.hex)}" data-add-name="${escape(name)}"${added ? ' disabled aria-disabled="true"' : ''}>${added ? t('✓ Added') : t('+ Add')}</button>
        </div>`;
    }).join('');
  };
  const renderPreviews = (): void => {
    if (!previewsEl) return;
    const colors = paletteHexes();
    if (!colors.length) {
      const empty = document.createElement('p'); empty.className = 'be-preview-empty';
      empty.textContent = t('Add a colour to see it in context.'); previewsEl.replaceChildren(empty); return;
    }
    const set = createTokenSet(doc, { theme: currentTheme === 'dark' ? 'dark' : 'light' });
    const role = (name: string): string | undefined => colorToHex(set.resolve(`color.semantic.${name}`)) ?? undefined;
    const scenes = palettePreviewSvgs(colors, { roles: previewSelection.length ? undefined : {
      primary: role('primary'), secondary: role('secondary'), surface: role('surface'), text: role('text'), onPrimary: role('on-primary'),
    } });
    // `s.svg` is interpolated RAW, deliberately - it is markup, so escaping it
    // would render the tags as text. It is safe because lib/palette-preview.ts
    // BUILDS these scenes from developer-authored templates and passes every
    // user-supplied colour through its `col()` whitelist (hex or 'transparent',
    // nothing else) before it reaches an attribute; the module contains no
    // <script>, href or url(), and palette-preview.test.ts pins all of that
    // against hostile colour strings. `s.label` is ours but escaped anyway,
    // since it is text rather than markup.
    previewsEl.innerHTML = scenes.map((s, i) => `<figure class="be-pv"${i === previewScene ? '' : ' hidden'}><div class="be-pv-art">${s.svg}</div><figcaption class="be-pv-cap">${escape(s.label)}</figcaption></figure>`).join('');
  };
  $('[data-be-scenes]')?.addEventListener('click', (e) => {
    const button = (e.target as HTMLElement).closest<HTMLElement>('[data-scene]');
    if (!button) return;
    previewScene = Number(button.dataset.scene);
    $('[data-be-scenes]')?.querySelectorAll('[data-scene]').forEach(b => { b.setAttribute('aria-pressed', String(b === button)); });
    renderPreviews();
  });
  paletteObservers.add(renderPreviews);
  const renderGenerator = (): void => { renderCandidates(); renderPreviews(); };
  // The parametric-analogous count/angle controls, shown only in that mode.
  const analogWrap = $('[data-be-analogous]') as HTMLElement | null;
  const analogCountInput = $('[data-be-analog-count]') as HTMLInputElement | null;
  const analogAngleInput = $('[data-be-analog-angle]') as HTMLInputElement | null;
  const analogCountVal = $('[data-be-analog-count-val]') as HTMLElement | null;
  const analogAngleVal = $('[data-be-analog-angle-val]') as HTMLElement | null;
  $('[data-be-schemekind]')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-kind]'); if (!btn) return;
    harmonyKind = btn.dataset.kind as HarmonyKind;
    root.querySelectorAll<HTMLElement>('[data-be-schemekind] [data-kind]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    if (analogWrap) analogWrap.hidden = harmonyKind !== 'analogous';
    renderCandidates();
  });
  analogCountInput?.addEventListener('input', () => {
    analogCount = Number(analogCountInput.value) || analogCount;
    if (analogCountVal) analogCountVal.textContent = String(analogCount);
    renderCandidates();
  });
  analogAngleInput?.addEventListener('input', () => {
    analogAngle = Number(analogAngleInput.value) || analogAngle;
    if (analogAngleVal) analogAngleVal.textContent = `${analogAngle}°`;
    renderCandidates();
  });
  candidatesEl?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-add-hex]'); if (!btn || btn.disabled) return;
    const hex = btn.dataset.addHex!, name = btn.dataset.addName || nameColor(hex);
    if (isInPalette(hex)) return;
    pushUndo(t('Add matching colour'));
    addSwatch(doc, 'spectrum', name, serializeColor(hex, 'lch')); // LCH - the storage default
    repaintPalette();       // refreshes swatches + picker + wheel + (via hook) the generator
    persist(true);          // officiate: the accent is now part of the brand
    playSfx('click');
    announce(tRaw('{name} added to the palette', { name }));
  });
  paletteHooks.push(() => { renderGenerator(); renderPreview(); }); // keep candidates + previews in sync with the palette
  renderGenerator();                  // initial paint

  preview?.addEventListener('click', e => {
    const button = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-be-add-ramp], [data-be-add-shade]');
    if (!button || button.disabled) return;
    const ramp = button.dataset.beAddRamp ?? button.dataset.beAddShade?.split('.')[2];
    if (!ramp || !RAMP_IDS.includes(ramp as RampId)) return;
    const draft = deriveSafe({ primary, scheme, surface, contrast, steps, foreground });
    if (!draft) return;
    const shades = draftShades(draft, ramp).filter(shade => !button.dataset.beAddShade || shade.key === button.dataset.beAddShade);
    const label = tRaw('{label} shades', { label: RAMP_LABEL[ramp as RampId] });
    pushUndo(t('Add shades'));
    const added = addDraftShades(doc, shades, label);
    if (!added) return;
    repaintPalette();
    persist(true);
    const status = $<HTMLElement>('[data-be-draft-status]');
    if (status) status.textContent = added === 1 ? t('1 shade added. Undo is available above your palette.') : tRaw('{n} shades added. Undo is available above your palette.', { n: added });
    // Repainting replaces the trigger. Keep focus in the workbench even when
    // every shade has been added and the ramp's buttons are now disabled.
    const nextButton = preview?.querySelector<HTMLButtonElement>(`[data-be-add-ramp="${ramp}"]:not(:disabled)`);
    if (nextButton) nextButton.focus();
    else if (status) { status.tabIndex = -1; status.focus(); }
    announce(added === 1 ? t('1 shade added to your palette') : tRaw('{n} shades added to your palette', { n: added }));
  });

  // ── Screen readout - the primary's on-screen (sRGB) form. ───────────────────
  const screenEl = $('[data-be-screen]') as HTMLElement | null;
  const renderScreen = (): void => {
    const hex = primaryHex();
    if (screenEl) screenEl.textContent = `${hex.toUpperCase()} · rgb(${formatColor('rgb', hex)})`;
  };
  renderScreen();
  // The four derive segments. Named explicitly because `[data-be-seg]` is the
  // shared primitive's hook, not this listener's - the Harmony and "Stored as"
  // segments now render through segHtml() too, and they own their own delegates
  // (renderCandidates / renderStoredSeg). Without this guard they'd be swept in
  // here as well and re-run renderPreview() on every click.
  const DERIVE_SEGS = new Set(['scheme', 'surface', 'contrast', 'foreground']);
  root.querySelectorAll<HTMLElement>('[data-be-seg]').forEach(seg => {
    if (!DERIVE_SEGS.has(seg.dataset.beSeg ?? '')) return;
    const on = (e: Event): void => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-val]'); if (!btn) return;
      const name = seg.dataset.beSeg;
      if (name === 'scheme') scheme = btn.dataset.val as Scheme;
      else if (name === 'surface') surface = btn.dataset.val as Surface;
      else if (name === 'contrast') contrast = btn.dataset.val as Contrast;
      else if (name === 'foreground') foreground = btn.dataset.val as Fg;
      seg.querySelectorAll<HTMLElement>('[data-val]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
      renderPreview();
    };
    seg.addEventListener('click', on);
  });
  // The "Print & screen" summary chips - rendered via mountPrintLock's own
  // render (ctx.onRender), never by a caller directly, so both lock funnels
  // (the control's toggles AND afterSwatchLockChange → primaryLock.render())
  // update them without either knowing about the folded summary.
  const printChips = $('[data-be-print-chips]') as HTMLElement | null;
  const printNone = $('[data-be-print-none]') as HTMLElement | null;
  const printSubst = $('[data-be-subst]') as HTMLElement | null;
  /** No primary ramp, no anchor step, nothing a print build could pin itself
   *  to - so the wing states that instead of offering controls that write
   *  nowhere. Re-read live, because a Replace palette creates the ramp. */
  const syncPrintWing = (): void => {
    const anchored = primaryAnchorPath(doc) !== null;
    if (printNone) printNone.hidden = anchored;
    if (printSubst) printSubst.hidden = !anchored;
    if (printChips) printChips.hidden = !anchored;
  };
  const renderPrintChips = (): void => {
    syncPrintWing();
    if (!printChips) return;
    const lock = primaryPrintLock();
    const bits: string[] = [];
    if (lock?.cmyk) bits.push(`<span class="be-ps-chip">C${lock.cmyk[0]} M${lock.cmyk[1]} Y${lock.cmyk[2]} K${lock.cmyk[3]}</span>`);
    if (lock?.spot) bits.push(`<span class="be-ps-chip">${escape(lock.spot.name)}${lock.spot.finish ? ` · ${escape(finishLabel(lock.spot.finish))}` : ''}</span>`);
    printChips.innerHTML = bits.length ? bits.join('') : `<span class="be-ps-chip be-ps-chip--auto">${t('auto')}</span>`;
  };
  // The primary's print lock - mounted only now, AFTER the generic [data-be-seg]
  // delegate above has taken its one-time querySelectorAll snapshot, so this
  // control's own Auto/Locked + Process/Spot segments (built on the same
  // segHtml markup) don't get swept into that older Scheme/Surface/Contrast
  // listener (see mountPrintLock's doc comment).
  const primaryLockMount = $('[data-be-lock-mount="primary"]') as HTMLElement | null;
  const primaryLock = primaryLockMount ? mountPrintLock(primaryLockMount, {
    onRender: renderPrintChips,
    hex: () => primaryHex(),
    getCmyk: () => primaryPrintLock()?.cmyk ?? null,
    setCmyk: (cmyk) => {
      const path = primaryAnchorPath(doc);
      if (path) setSwatchCmykLock(doc, path, cmyk);
      repaintPalette(); // same swatch is a tile in the Palette panel - keep its lock badge in sync
      persist();        // the popover's afterSwatchLockChange does exactly this
    },
    getSpot: () => primaryPrintLock()?.spot ?? null,
    setSpot: (spot) => {
      const path = primaryAnchorPath(doc);
      if (path) setSwatchSpotLock(doc, path, spot);
      repaintPalette();
      persist();
    },
  }) : null;
  // Neutral/secondary ramp-step picks - the Primary ramp stays non-interactive
  // (it's already driven by the colour field above, not a step choice).
  preview?.addEventListener('click', (e) => {
    const cell = (e.target as HTMLElement).closest<HTMLElement>('[data-be-ramp]');
    if (!cell) return;
    const step = Number(cell.dataset.beStep);
    if (cell.dataset.beRamp === 'neutral') neutralStep = step;
    else if (cell.dataset.beRamp === 'secondary') secondaryStep = step;
    else return;
    renderPreview();
  });
  // The per-ramp tonal-curve toggle (a separate attribute → never swept up by
  // the step-pick delegate above, which keys off [data-be-ramp] on the cells).
  preview?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-be-curve]');
    if (!btn) return;
    const ramp = btn.dataset.beCurve;
    if (ramp === 'primary' || ramp === 'neutral' || ramp === 'secondary') openCurveEditor(ramp);
  });
  /**
   * Re-seed every Generate-wing control from whatever `doc` currently holds.
   * Split out of reload() because an undo needs exactly the same work: the
   * document was swapped wholesale, so the primary, the shade count, the ramp
   * anchors, the stored curves and the preview all describe the wrong brand
   * until this runs. Reads the steps off the GIVEN doc rather than a fresh
   * tokens.raw() - an undo has not installed anything yet.
   */
  const reseedFromDoc = (): void => {
    try {
      const set = createTokenSet(doc, { theme: 'light' });
      primary = tokenValueToHex(set.resolve('color.semantic.primary')) ?? primary;
      const g = set.query({ type: 'color' }).filter(tk => /^color\.ramp\.primary\.\d+$/.test(tk.path));
      if (g.length >= RAMP_STEPS_MIN) steps = Math.min(RAMP_STEPS_MAX, g.length);
      neutralStep = anchorStep(steps); secondaryStep = anchorStep(steps);
    } catch { /* tokenless/malformed doc - keep the previous seeds */ }
    if (stepsSlider) stepsSlider.value = String(steps);
    if (stepsVal) stepsVal.textContent = String(steps);
    // Re-load per-ramp tonal curves from the doc (a pack import may carry them; a
    // plain brand won't, leaving curves empty → pure derive). Any open editor
    // described the OLD brand, so close it first - without a preview repaint
    // (the fresh preview is painted below).
    closeCurveEditor(false);
    for (const ramp of RAMP_IDS) { delete curves[ramp]; const st = getRampCurve(doc, ramp); if (st) curves[ramp] = deserializeCurve(st); }
    curveAnchorPrimary = primary;
    const wrap = $('[data-be-primary-field]') as HTMLElement | null;
    if (wrap) {
      wrap.innerHTML = colorFieldHtml('be-primary', primary, { inline: true, modes: true, progressive: true });
      wireColorField(wrap, { onChange: onPrimaryFieldChange });
    }
    // New shade suggestions follow the current starting colour.
    const fresh = deriveSafe({ primary, scheme, surface, contrast, steps, foreground });
    if (preview && fresh) preview.innerHTML = previewHtml(fresh, { neutral: neutralStep, secondary: secondaryStep, steps, curves: curveMarks(), palette: walkSwatches(doc, currentTheme).filter(s => s.kind !== 'semantic').flatMap(s => s.hex ? [s.hex] : []) });
    renderScreen();
    primaryLock?.render();
    renderGenerator();
    dropPendingReplacement(); // the doc was swapped wholesale - any parked proposal is stale
  };

  /** Pop the last snapshot and make the room describe it again. Returns false
   *  when there is nothing to undo, so the key event can fall through. */
  const undoLast = (): boolean => {
    const prev = undoStack.pop();
    if (!prev) return false;
    doc = prev.doc;
    reseedFromDoc();
    closeEditor();
    exitPalSelect();
    repaintPalette();
    persist(true);
    playSfx('click');
    announce(tRaw('Undone: {action}', { action: prev.label }));
    const undo = $<HTMLButtonElement>('[data-be-undo]');
    if (undo) { undo.hidden = undoStack.length === 0; undo.textContent = tRaw('Undo: {action}', { action: undoStack.at(-1)?.label ?? '' }); }
    return true;
  };
  $('[data-be-undo]')?.addEventListener('click', () => { undoLast(); });

  // ── Replace palette: build a proposal, review it, then swap ─────────────────
  // The old flow derived straight into the doc behind a confirm dialog. Now the
  // derive builds a candidate document, a review card says exactly what changes,
  // and only its own button swaps it in - with an undo snapshot taken first, so
  // no confirm dialog stands where an undo suffices (plan 97 section 3 principle 3).

  /** What a Replace would do, counted from the two documents. Pure - computed
   *  before anything is swapped, so the card can be honest and then cancelled. */
  interface ReplacePlan {
    steps: number; ramps: number; rebuilt: number; spectrumRebuilt: number;
    roles: number; kept: number; curves: number; locks: number;
    excluded: number; pinnedStops: number; rolesKept: number;
  }
  const reviewEl = $('[data-be-review]') as HTMLElement | null;
  /** The proposal the review card is describing, or null when it is closed. */
  let pendingReplacement: Record<string, unknown> | null = null;

  const countLeaves = (node: unknown): number =>
    isRec(node) ? Object.keys(node).filter(k => !k.startsWith('$')).length : 0;

  const buildReplacement = (): { next: Record<string, unknown>; plan: ReplacePlan } | null => {
    let next: Record<string, unknown>;
    try { next = deriveBrandTokens({ primary, scheme, surface, contrast, steps, foreground, name: 'My brand' }) as Record<string, unknown>; }
    catch (err) { announce(tRaw("Couldn't derive from {primary}: {error}", { primary, error: String((err as { message?: unknown })?.message ?? err) }), { assertive: true }); return null; }
    setSemanticRampAlias(next, 'secondary', secondaryStep);
    setSemanticRampAlias(next, 'neutral', neutralStep);
    // Re-apply any tonal curves onto the fresh derive - this is what makes an
    // edited ramp SURVIVE a re-derive (the curve is regenerated from its control
    // points, and its extension re-stamped on the new doc). A no-op for a ramp
    // with no curve, so a curve-less re-derive is byte-identical to before.
    overlayRampCurves(next, curves, steps);
    // Read the lock LIVE off the pre-derive `doc` - whichever surface (the print
    // wing or the Palette panel's swatch popover) set it last, since both write
    // straight to `doc` - so re-deriving never silently drops a lock the other
    // surface just set (see primaryPrintLock's doc comment above). cmyk and spot
    // are independent, so both are re-pinned onto the freshly derived doc.
    const priorLock = primaryPrintLock();
    const p = priorLock ? primaryAnchorPath(next) : null;
    if (p && priorLock?.cmyk) setSwatchCmykLock(next, p, priorLock.cmyk); // ramp rebuilt → re-pin the print lock
    if (p && priorLock?.spot) setSwatchSpotLock(next, p, priorLock.spot);

    const cur = isRec(doc) ? doc : {};
    const srcBase = (isRec(cur.base) ? cur.base : cur) as Record<string, unknown>;
    const dstBase = (isRec(next.base) ? next.base : next) as Record<string, unknown>;
    // Count the derive's own spectrum BEFORE the carry below grows it.
    const spectrumRebuilt = countLeaves(isRec(dstBase.color) ? (dstBase.color as Record<string, unknown>).spectrum : null);

    // Deriving only rebuilds COLOUR - everything else the doc carries (the
    // studio's spacing/shadows/gradients, the font roles, the logos' asset
    // tokens, shape.radius) survives it, same precedent as the print lock.
    // deriveBrandTokens never emits these groups, so a straight carry is safe.
    for (const g of [...STUDIO_GROUPS, 'font', 'asset', 'shape']) {
      if (dstBase[g] === undefined && isRec(srcBase[g])) dstBase[g] = structuredClone(srcBase[g]);
    }

    // Colour carry - what makes "added colours kept" true. STUDIO_GROUPS does not
    // cover `color`, so before this every custom swatch was silently dropped and
    // the old flow needed a confirm dialog to say so.
    let kept = 0;
    {
      const srcColor = isRec(srcBase.color) ? srcBase.color as Record<string, unknown> : null;
      const dstColor = isRec(dstBase.color) ? dstBase.color as Record<string, unknown> : null;
      if (srcColor && dstColor) {
        // `custom` is user-owned outright - nothing derived ever lands there.
        if (isRec(srcColor.custom)) { dstColor.custom = structuredClone(srcColor.custom); kept += countLeaves(srcColor.custom); }
        // `spectrum` is shared: the derive rebuilds its six fixed hues, every OTHER
        // key is an accent the user added from the generator, so it comes across.
        if (isRec(srcColor.spectrum)) {
          const dst = (isRec(dstColor.spectrum) ? dstColor.spectrum : (dstColor.spectrum = {})) as Record<string, unknown>;
          for (const [k, v] of Object.entries(srcColor.spectrum as Record<string, unknown>)) {
            if (k.startsWith('$') || k in dst) continue;
            dst[k] = structuredClone(v);
            kept++;
          }
        }
      }
    }

    const nextKeys = new Set(walkSwatches(next, currentTheme).map(s => s.key));

    // Role carry - a hand-assigned secondary/surface/text survives the rebuild.
    // Deliberately NOT primary or on-primary: the wing's own picker IS the
    // primary, and keeping a hand-assigned one would contradict the ramps this
    // derive just built around it.
    // Per THEME, because the roles are: a surface assigned in light mode has no
    // business landing in the dark theme's set (see roles.ts). A role kept in
    // both themes is one kept role, not two, so the count is over the names.
    const rolesCarried = new Set<string>();
    {
      for (const th of ['light', 'dark'] as const) {
        const before = readRoles(doc, th);
        for (const role of ['secondary', 'surface', 'text'] as const) {
          const ref = before[role].ref;
          if (!ref || ref.startsWith('color.ramp.') || ref.startsWith('color.semantic.')) continue;
          if (!nextKeys.has(ref)) continue;
          if (assignRole(next, role, ref, th)) rolesCarried.add(role);
        }
      }
    }
    const rolesKept = rolesCarried.size;

    // Carry the swatch exclusion list ("deleted" derived steps stay deleted) - 
    // but only entries whose swatch still exists in the fresh derive: a smaller
    // shade count drops its stale ramp-step exclusions, per the delete contract.
    // Runs AFTER the colour + role carries, so a carried swatch keeps its
    // exclusion rather than losing it to a key that wasn't there yet.
    carryPaletteGroups(doc, next);
    let excluded = 0;
    {
      const wasExcluded = getExcludedSwatches(doc);
      const keys = new Set(walkSwatches(next, currentTheme).map(s => s.key));
      for (const k of wasExcluded) if (keys.has(k)) { setSwatchExcluded(next, k, true); excluded++; }
    }

    // The carried gradients' stops alias ramp/spectrum/custom keys, and this
    // derive may have rebuilt or dropped their targets (fewer shades; custom
    // swatches go). Resolve every alias against the OLD doc now (`doc` hasn't
    // swapped yet - resolveTokenRef still answers from it) and pin the ones the
    // fresh doc can no longer answer, so an exported pack never carries a
    // dangling ref. Aliases that still resolve keep tracking their swatch.
    const nextSet = createTokenSet(next, { theme: currentTheme === 'dark' ? 'dark' : 'light' });
    const pinnedStops = materializeGradientAliases(next, ref => colorToHex(nextSet.resolve(ref)) == null, resolveTokenRef);

    const lightSet = isRec(next.light) ? next.light as Record<string, unknown> : next;
    const roles = countLeaves(isRec(lightSet.color) ? (lightSet.color as Record<string, unknown>).semantic : null);
    return {
      next,
      plan: {
        steps, ramps: RAMP_IDS.length, rebuilt: steps * RAMP_IDS.length, spectrumRebuilt,
        roles, kept, curves: RAMP_IDS.filter(r => curves[r]).length,
        locks: (priorLock?.cmyk ? 1 : 0) + (priorLock?.spot ? 1 : 0),
        excluded, pinnedStops, rolesKept,
      },
    };
  };

  /** Where focus goes when a card that HELD it is taken away: back to the button
   *  that opens one. Only when the focus really was inside - a card retired
   *  underneath somebody working elsewhere must not yank them here. */
  const hideReview = (): void => {
    pendingReplacement = null;
    if (!reviewEl) return;
    const hadFocus = reviewEl.contains(document.activeElement);
    reviewEl.hidden = true;
    reviewEl.innerHTML = '';
    if (hadFocus) $<HTMLElement>('[data-be-replace-palette]')?.focus();
  };
  // A proposal is a snapshot of the derive controls, and the card sits in the
  // same open wing as the controls that built it - so any later change retires
  // it rather than leaving a card whose counts, and whose document, describe a
  // panel that has moved on. Only an OPEN proposal is dropped: the "replaced,
  // Undo" card that follows a commit holds no document and stays put.
  dropPendingReplacement = (): void => { if (pendingReplacement) hideReview(); };
  /** Wrap a rendered line. Every string below is a LITERAL at its t()/tRaw()
   *  call site - the chrome-string process reads these statically, so a
   *  plural-picking helper that took the key as an argument would hide them. */
  const li = (text: string): string => `<li>${text}</li>`;

  const renderReview = (plan: ReplacePlan): void => {
    if (!reviewEl) return;
    const bits = [
      li(tRaw('{n} shades rebuilt across {ramps} ramps', { n: plan.rebuilt, ramps: plan.ramps })),
      li(plan.spectrumRebuilt === 1 ? t('1 spectrum hue rebuilt') : tRaw('{n} spectrum hues rebuilt', { n: plan.spectrumRebuilt })),
      li(`${plan.roles === 1 ? t('1 role re-derived') : tRaw('{n} roles re-derived', { n: plan.roles })}${
        plan.rolesKept ? tRaw(', {n} kept as assigned', { n: plan.rolesKept }) : ''}`),
    ];
    if (plan.kept) bits.push(li(plan.kept === 1 ? t('1 added colour kept') : tRaw('{n} added colours kept', { n: plan.kept })));
    if (plan.curves) bits.push(li(plan.curves === 1 ? t('1 shade curve re-anchored') : tRaw('{n} shade curves re-anchored', { n: plan.curves })));
    if (plan.locks) bits.push(li(plan.locks === 1 ? t('1 print lock re-pinned') : tRaw('{n} print locks re-pinned', { n: plan.locks })));
    if (plan.excluded) bits.push(li(plan.excluded === 1 ? t('1 hidden shade stays hidden') : tRaw('{n} hidden shades stay hidden', { n: plan.excluded })));
    if (plan.pinnedStops) bits.push(li(plan.pinnedStops === 1 ? t('1 gradient stop keeps its colour') : tRaw('{n} gradient stops keep their colour', { n: plan.pinnedStops })));
    reviewEl.innerHTML = `
      <p class="be-review-title">${t('Rebuild the palette?')}</p>
      <div class="be-specs">${specCard(t('Current'), createTokenSet(doc, { theme: 'light' }))}${pendingReplacement ? specCard(t('Proposed'), createTokenSet(pendingReplacement, { theme: 'light' })) : ''}</div>
      <ul class="be-review-list">${bits.join('')}</ul>
      <div class="be-review-actions">
        <button type="button" class="be-cta" data-be-review-go>${t('Apply rebuilt palette')}</button>
        <button type="button" class="be-btn" data-be-review-cancel>${t('Cancel')}</button>
      </div>`;
    reviewEl.hidden = false;
    reviewEl.querySelector<HTMLButtonElement>('[data-be-review-go]')?.focus();
  };
  const renderReviewDone = (): void => {
    if (!reviewEl) return;
    reviewEl.innerHTML = `
      <p class="be-review-title">${t('Palette rebuilt.')}</p>
      <div class="be-review-actions">
        <button type="button" class="be-btn" data-be-review-undo>${t('Undo')}</button>
      </div>`;
    reviewEl.hidden = false;
    // Undo IS the safety net this whole path leans on, and the Replace button
    // that was focused a moment ago has just been replaced out of the document.
    // Hand focus straight to it rather than leaving it on <body>, from where
    // reaching Undo means tabbing in from the top of the page.
    reviewEl.querySelector<HTMLButtonElement>('[data-be-review-undo]')?.focus();
  };

  const commitReplacement = (next: Record<string, unknown>): void => {
    pushUndo(t('Rebuild palette'));                        // snapshot BEFORE the swap
    ctxCheckpoint(t('Before replacing the palette'));       // durable, best-effort
    doc = next;
    curveAnchorPrimary = primary;
    repaintPalette();
    persist(true);
    pendingReplacement = null;
    renderReviewDone();
    playSfx('click');
    announce(t('Palette rebuilt. Undo is available.'));
  };

  $('[data-be-replace-palette]')?.addEventListener('click', () => {
    const built = buildReplacement();
    if (!built) return;
    pendingReplacement = built.next;
    renderReview(built.plan);
  });
  reviewEl?.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    if (el.closest('[data-be-review-go]')) { if (pendingReplacement) commitReplacement(pendingReplacement); return; }
    if (el.closest('[data-be-review-cancel]')) { hideReview(); return; }
    if (el.closest('[data-be-review-undo]')) { hideReview(); undoLast(); }
  });

  // ── Palette: click a tile → open the shared swatch editor ───────────────────
  // One way to set a colour, not two: the popover's colour field is the full
  // picker (`modes` - its value input reads AND writes hex / OKLCH / HSL / RGB /
  // CMYK), so the old "Set by value" select+input row it duplicated is gone.
  // Everything funnels through applyEditedHex, which WRITES the doc in the
  // swatch's storage format (the "Stored as" toggle - LCH by default, or the
  // notation already in the doc for older edits).
  const editorLockBadge = editorEl?.querySelector<HTMLElement>('[data-be-editor-lockbadge]') ?? null;
  const editorChip = editorEl?.querySelector<HTMLElement>('[data-be-editor-chip]') ?? null;
  const storedSeg = editorEl?.querySelector<HTMLElement>('[data-be-stored]') ?? null;
  const storedRow = editorEl?.querySelector<HTMLElement>('[data-be-stored-row]') ?? null;
  const substDetails = editorEl?.querySelector<HTMLDetailsElement>('[data-be-subst-details]') ?? null;
  const substChips = editorEl?.querySelector<HTMLElement>('[data-be-subst-chips]') ?? null;
  /** The open swatch's $value notation (the "Stored as" toggle). */
  let storedFmt: StorageFormat = 'lch';

  const renderStoredSeg = (): void => {
    storedSeg?.querySelectorAll<HTMLElement>('[data-store-fmt]').forEach(b =>
      b.setAttribute('aria-pressed', String(b.dataset.storeFmt === storedFmt)));
  };
  /** The print-substitute state, summarised on the folded row so a lock is
   *  visible without opening it. */
  const renderSubstChips = (): void => {
    const cur = selected >= 0 ? swatches[selected] : null;
    if (!substChips) return;
    const bits: string[] = [];
    if (cur?.lock?.cmyk) bits.push(`<span class="be-ps-chip">C${cur.lock.cmyk[0]} M${cur.lock.cmyk[1]} Y${cur.lock.cmyk[2]} K${cur.lock.cmyk[3]}</span>`);
    if (cur?.lock?.spot) bits.push(`<span class="be-ps-chip">${escape(cur.lock.spot.name)}${cur.lock.spot.finish ? ` · ${escape(finishLabel(cur.lock.spot.finish))}` : ''}</span>`);
    substChips.innerHTML = bits.length ? bits.join('') : `<span class="be-ps-chip be-ps-chip--auto">${t('auto')}</span>`;
  };

  /** Keep a shape-only tile's tooltip + accessible name (name - hex) fresh - 
   *  the grid shows no text, so every in-place recolour/rename re-stamps these. */
  const syncTileMeta = (tile: HTMLElement, s: BrandSwatch): void => {
    const label = tileLabel(s.name, s.hex, !!s.lock);
    tile.title = label;
    tile.setAttribute('aria-label', label);
    const card = tile.closest('.be-pal-card');
    const name = card?.querySelector('.be-pal-name');
    const hex = card?.querySelector('.be-pal-hex');
    if (name) name.textContent = s.name;
    if (hex) hex.textContent = s.hex || 'transparent';
  };

  /** Refresh a swatch's tile in place (lock badge + colour), without a full repaint - 
   *  preserves `.is-selected` (tileHtml doesn't know selection state) so an open
   *  popover's tile doesn't lose its ring the moment its lock changes. */
  const refreshTile = (idx: number): void => {
    const s = swatches[idx]; const tile = palMount?.querySelector<HTMLElement>(`[data-be-tile="${idx}"]`);
    if (!s || !tile) return;
    const wasSelected = tile.classList.contains('is-selected');
    tile.outerHTML = tileHtml(s, idx);
    if (wasSelected) palMount?.querySelector<HTMLElement>(`[data-be-tile="${idx}"]`)?.classList.add('is-selected');
  };
  // The swatch popover's print substitutes - always read/write whichever swatch
  // is CURRENTLY open (`selected`), so the control is built once and driven
  // dynamically rather than re-mounted per swatch (openEditor calls render()).
  const substMount = editorEl?.querySelector<HTMLElement>('[data-be-subst-mount]') ?? null;
  // Re-syncs the popover's lock badge + folded-row chips + tile + the
  // primary-panel control (when the edited swatch IS the primary anchor - see
  // primaryPrintLock's doc comment) after either half of the swatch lock changes.
  const afterSwatchLockChange = (): void => {
    if (selected < 0) return;
    const cur = swatches[selected]!;
    cur.lock = getSwatchPrintOverride(doc, cur.path);
    refreshTile(selected);
    if (editorLockBadge) editorLockBadge.hidden = !cur.lock;
    renderSubstChips();
    persist();
    const anchorPath = primaryAnchorPath(doc);
    if (anchorPath && samePath(anchorPath, cur.path)) primaryLock?.render();
  };
  const swatchSubst = substMount ? mountPrintLock(substMount, {
    hex: () => (selected >= 0 ? swatches[selected]!.hex : ''),
    getCmyk: () => (selected >= 0 ? getSwatchPrintOverride(doc, swatches[selected]!.path)?.cmyk ?? null : null),
    setCmyk: (cmyk) => { if (selected >= 0) { setSwatchCmykLock(doc, swatches[selected]!.path, cmyk); afterSwatchLockChange(); } },
    getSpot: () => (selected >= 0 ? getSwatchPrintOverride(doc, swatches[selected]!.path)?.spot ?? null : null),
    setSpot: (spot) => { if (selected >= 0) { setSwatchSpotLock(doc, swatches[selected]!.path, spot); afterSwatchLockChange(); } },
  }) : null;

  // The faces list, mounted beside the print lock. Its ctx reads the doc LIVE for
  // the same reason the lock's does: the popover and a re-derive can both change
  // a swatch's overrides, and a cached copy would show a stale row.
  const facesMount = $('[data-be-faces-mount]') as HTMLElement | null;
  const facesChips = $('[data-be-faces-chips]') as HTMLElement | null;
  const facesDetails = $('[data-be-faces-details]') as HTMLDetailsElement | null;
  const swatchFaces = facesMount ? mountFaces(facesMount, {
    canonical: () => {
      const cur = selected >= 0 ? swatches[selected] : null;
      if (!cur) return '';
      // The stored `$value` where it is a literal, NOT the resolved hex: the hex is
      // the sRGB bake, and deriving a wide-gamut face from a bake would clamp the
      // very chroma the face exists to carry. An alias has no literal, so it falls
      // back to the hex - a role's colour lives on the swatch it points at.
      return cur.isAlias ? cur.hex : (cur.raw || cur.hex);
    },
    get: () => (selected >= 0 ? getSwatchFaces(doc, swatches[selected]!.path) : new Map()),
    set: (target, face) => {
      if (selected < 0) return;
      setSwatchFace(doc, swatches[selected]!.path, target, face);
      renderFacesChips();
      persist();
    },
  }) : null;

  /** How many faces this swatch has authored - the folded summary. */
  function renderFacesChips(): void {
    if (!facesChips) return;
    const n = selected >= 0 ? [...getSwatchFaces(doc, swatches[selected]!.path).keys()].length : 0;
    facesChips.textContent = n ? tRaw('{n} set', { n: String(n) }) : '';
  }

  // "Stored as" - re-serialise the open swatch's $value in the picked notation.
  // An alias role has no literal of its own to re-write, so the row hides for
  // those (recolouring detaches the alias first, which re-shows it).
  storedSeg?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-store-fmt]'); if (!btn) return;
    const next = btn.dataset.storeFmt as StorageFormat;
    if (next === storedFmt) return;
    storedFmt = next;
    renderStoredSeg();
    const cur = selected >= 0 ? swatches[selected] : null;
    if (!cur || cur.isAlias || !cur.hex) return;
    const stored = serializeColor(colorToHex(cur.raw) ?? cur.hex, storedFmt);
    setSwatchValue(doc, cur.path, stored);
    cur.raw = stored;
    persist();
  });

  /** (Re)build the visual colour field on a hex, wiring its live onChange. */
  const renderEditField = (hex: string): void => {
    const mountEl = editorEl?.querySelector<HTMLElement>('[data-be-editor-color]'); if (!mountEl) return;
    // The same field the primary gets: inline (it lays out in the card's flow
    // rather than as a popover that would overlap the rows below), `modes`,
    // whose value input IS the typed-value entry (hex, OKLCH, HSL, RGB, CMYK),
    // and `dials` - the L/C/H wheels the first pick is worth opening on.
    mountEl.innerHTML = colorFieldHtml('be-edit-color', hex || '#888888', {
      inline: true, modes: true, dials: true, progressive: pickHex !== null,
    });
    wireColorField(mountEl, {
      onChange: (id, value) => {
        if (id !== 'be-edit-color') return;
        const raw = typeof value === 'string' ? value : value.value;
        // In pick mode nothing is bound to a token yet - the drag paints the
        // card and the add row, and only "Add colour" writes.
        if (pickHex !== null) { setPickHex(raw); return; }
        applyEditedHex(raw); // field-driven → don't re-render the field under the user
      },
    });
  };
  /**
   * Apply a colour to the selected swatch from EITHER surface: write it to the
   * doc, repaint the tile + value row, and persist. Alpha is kept - an `#rrggbbaa`
   * from the field's opacity slider (or an rgba()/oklch(… / a) value) flows
   * through verbatim, so brand swatches can be translucent. `rerenderField`
   * re-seeds the visual field (used when the value row drove the change, so the
   * sliders catch up; NOT when the field itself did, mid-drag).
   */
  function applyEditedHex(rawHex: string, opts: { rerenderField?: boolean } = {}): void {
    if (selected < 0) return;
    writeSwatchHex(selected, rawHex, storedFmt, opts);
  }

  /**
   * The doc-write half of applyEditedHex, parameterised by swatch index + storage
   * format so BOTH the popover (the open `selected` swatch, LCH/hex per its "Stored
   * as" toggle) and the keyboard nudge (any FOCUSED tile, in the swatch's own
   * notation) land through one path - the tile repaints in place and it persists on
   * Save exactly like a popover edit. The popover-only touches (chip, value field,
   * the alias-detach row) fire only when `idx` IS the open swatch.
   */
  function writeSwatchHex(idx: number, rawHex: string, fmt: StorageFormat, opts: { rerenderField?: boolean } = {}): void {
    const cur = swatches[idx]; if (!cur) return;
    if (!rawHex || rawHex === 'transparent') return;
    const hex = rawHex; // keep #rrggbbaa alpha - brand swatches may be translucent
    // The doc stores the swatch's chosen notation ("Stored as" - LCH default);
    // the tile/UI keep working in resolved hex. Recolouring an alias role
    // detaches it to a literal, which is when the storage toggle starts to bite.
    const stored = serializeColor(colorToHex(hex) ?? hex, fmt);
    setSwatchValue(doc, cur.path, stored);
    cur.hex = colorToHex(hex) ?? hex; cur.raw = stored;
    if (cur.isAlias) { cur.isAlias = false; if (idx === selected && storedRow) storedRow.hidden = false; }
    const tile = palMount?.querySelector<HTMLElement>(`[data-be-tile="${idx}"]`);
    if (tile) {
      tile.style.setProperty('--sw', cur.hex);
      tile.classList.remove('is-empty');
      syncTileMeta(tile, cur);
    }
    if (idx === selected && editorChip) editorChip.style.setProperty('--sw', cur.hex);
    if (idx === selected && opts.rerenderField) renderEditField(cur.hex);
    persist();
  }

  /**
   * Place the popover against `tile`. The card is allowed to be tall - opening
   * the print fold, or switching to CMYK's four sliders, grows it - and the
   * answer to that is to MOVE it, not to scroll it: below the tile by default,
   * flipped above when it would overhang and there's room up there, and only
   * pinned to the viewport (letting the card's own max-height start an inner
   * scroll) when it fits in neither direction.
   *
   * Coordinates are viewport-space until the last line, which converts into `.be`
   * space (the popover is absolute within it). The left floor (8) must win over
   * the right clamp, so a viewport narrower than the card never pushes it off the
   * left edge. Needs the popover measurable - openEditor unhides it before calling.
   */
  const MARGIN = 8; // viewport breathing room, and the tile↔card gap
  const positionEditor = (tile: HTMLElement): void => {
    if (!editorEl) return;
    const r = tile.getBoundingClientRect(), pr = root.getBoundingClientRect();
    const w = editorEl.offsetWidth, h = editorEl.offsetHeight;
    editorEl.style.left = `${Math.max(MARGIN, Math.min(r.left - pr.left, pr.width - w - MARGIN))}px`;

    const below = r.bottom + MARGIN;
    const above = r.top - MARGIN - h;
    const fitsBelow = below + h <= window.innerHeight - MARGIN;
    const fitsAbove = above >= MARGIN;
    // Prefer below (it reads as "belonging to" the tile); flip up only when below
    // overhangs AND above actually has the room.
    let top = fitsBelow || !fitsAbove ? below : above;
    // Taller than the viewport: pin it and let .be-editor-card's max-height scroll.
    top = Math.max(MARGIN, Math.min(top, window.innerHeight - MARGIN - h));
    editorEl.style.top = `${top - pr.top}px`;
  };
  /** Re-place the open card against its anchor - after anything that resized it.
   *  Never in the phone's sheet pose, where the card has no anchor to follow:
   *  it is docked to the viewport's bottom edge and the CSS owns its box. */
  const reposition = (): void => {
    if (pickSheet) return;
    if (editorAnchor && editorEl && !editorEl.hidden) positionEditor(editorAnchor);
  };
  const closeEditor = (): void => {
    if (editorEl) { editorEl.hidden = true; }
    const focusBack = editorAnchor;
    selected = -1; editorAnchor = null;
    if (focusBack?.isConnected) focusBack.focus();
    leavePickMode();
    root.querySelectorAll('.be-swatch.is-selected').forEach(t => t.classList.remove('is-selected'));
    // A beat that fell due while this card was open is owed now (see applyBeat).
    if (beatPending) { applyBeat(); notifyPaletteObservers(); }
  };
  const { renderEditorGroup } = mountPaletteGroupControls(palMount, editorEl, {
    doc: () => doc, swatches: () => swatches, current: () => swatches[selected],
    before: pushUndo, commit: () => { repaintPalette(); persist(true); },
    close: closeEditor, open: path => openSwatchAt(path),
  });
  const openEditor = (idx: number, tile: HTMLElement): void => {
    const s = swatches[idx]; if (!s || !editorEl) return;
    selected = idx;
    root.querySelectorAll('.be-swatch.is-selected').forEach(t => t.classList.remove('is-selected'));
    tile.classList.add('is-selected');
    const nameInput = editorEl.querySelector<HTMLInputElement>('[data-be-editor-name]')!;
    const delBtn = editorEl.querySelector<HTMLButtonElement>('[data-be-editor-del]')!;
    renderEditField(s.hex);
    if (editorChip) editorChip.style.setProperty('--sw', s.hex || 'transparent');
    nameInput.value = s.name;
    // Everything is deletable: real removal for the user's own swatches, an
    // exclusion (hide) for derived ramp steps + roles - see the Delete handler.
    delBtn.hidden = false;
    delBtn.textContent = s.deletable && s.kind !== 'ramp' && !isStarterSwatch(s) ? t('Delete') : t('Hide colour');
    renderEditorGroup(s);
    if (editorLockBadge) editorLockBadge.hidden = !s.lock;
    // Storage notation: respect what the doc already holds (an older hex edit
    // stays hex); the app default for everything else - aliases included, which
    // start storing the moment a recolour detaches them - is LCH. The row hides
    // while there's no literal to re-write.
    storedFmt = s.isAlias ? 'lch' : storageFormatOf(s.raw);
    renderStoredSeg();
    if (storedRow) storedRow.hidden = s.isAlias;
    renderUseAs();
    renderSubstChips();
    if (substDetails) substDetails.open = false; // folded until asked - the lock chips say enough
    swatchSubst?.render();
    renderFacesChips();
    if (facesDetails) facesDetails.open = false; // folded, like the print section
    swatchFaces?.render();
    editorAnchor = tile;
    editorEl.hidden = false; // before positioning - the clamp measures offsetHeight
    positionEditor(tile);
    nameInput.focus();
  };

  // ── The first pick: the same card, not bound to a token (plan 182 section 5.1)
  // The Fine-tune popover is the best colour control in the app, and it was one
  // click away from where the first colour had to be TYPED. Pick mode opens that
  // exact card with nothing selected: the chip and name field, the full OKLCH
  // picker, "Stored as", and a footer of Cancel | Add colour instead of Delete |
  // Save. Nothing is written until Add colour; Cancel and Escape leave the add
  // row exactly as they found it. Roles and print substitutes are hidden - both
  // are things you do to a colour that exists.
  const editorAddBtn = editorEl?.querySelector<HTMLButtonElement>('[data-be-editor-add]') ?? null;
  const editorCancelBtn = editorEl?.querySelector<HTMLButtonElement>('[data-be-editor-cancel]') ?? null;
  const editorDoneBtn = editorEl?.querySelector<HTMLButtonElement>('[data-be-editor-done]') ?? null;
  const editorDelBtn = editorEl?.querySelector<HTMLButtonElement>('[data-be-editor-del]') ?? null;
  /** The colour the pick card is holding, or null when it is not open. */
  let pickHex: string | null = null;
  let pickGroup: string | undefined;
  /** True while the card is docked to the phone's bottom edge rather than
   *  anchored to the chip - the pose has no anchor, so nothing may reposition
   *  it and no anchor scroll may close it. */
  let pickSheet = false;
  const PICK_SEED = '#7c3aed';
  /** Put the card back in swatch-editing clothes. Idempotent - closeEditor calls
   *  it on every close, including the ones that were never a pick. */
  const leavePickMode = (): void => {
    if (pickHex === null) return;
    pickHex = null;
    pickGroup = undefined;
    pickSheet = false;
    editorEl?.classList.remove('is-pick', 'is-picksheet');
    if (editorAddBtn) editorAddBtn.hidden = true;
    if (editorCancelBtn) editorCancelBtn.hidden = true;
    if (editorDoneBtn) editorDoneBtn.hidden = false;
    // The folds pick mode put away belong to the next swatch that opens here;
    // openEditor decides their OPEN state, never their existence.
    if (substDetails) substDetails.hidden = false;
    if (facesDetails) facesDetails.hidden = false;
  };
  /** A live drag: paint the card's chip and write the add row's field, so the
   *  row's own chip follows and the value is there to be pasted elsewhere. */
  const setPickHex = (raw: string): void => {
    if (!raw || raw === 'transparent') return;
    pickHex = colorToHex(raw) ?? raw;
    editorChip?.style.setProperty('--sw', pickHex);
    const field = addField();
    if (field) {
      field.value = serializeColor(pickHex, storedFmt);
      // The row parses on `input`, which is also what repaints its chip - so
      // one dispatch keeps the two controls saying the same thing.
      field.dispatchEvent(new Event('input', { bubbles: true }));
    }
  };
  /**
   * Open the card in pick mode against `anchor`, seeded with `current` (the
   * colour the add row is holding) or a considered default when it holds none.
   *
   * On a phone the card docks to the bottom edge instead of floating over a
   * 44px chip: the inline anchoring has nowhere to put a 340px card there, and
   * the CSS parks the palette mirror underneath for the same single-owner
   * reason the tray does.
   */
  const openPickCard = (anchor: HTMLElement, current: string | null): void => {
    if (!editorEl) return;
    closeEditor();                       // one card at a time, whatever it held
    const nameInput = editorEl.querySelector<HTMLInputElement>('[data-be-editor-name]');
    const hex = current || PICK_SEED;
    pickHex = hex;
    storedFmt = 'lch';
    renderStoredSeg();
    if (storedRow) storedRow.hidden = true;
    if (editorLockBadge) editorLockBadge.hidden = true;
    if (useasRow) useasRow.hidden = true;
    if (substDetails) { substDetails.open = false; substDetails.hidden = true; }
    if (facesDetails) { facesDetails.open = false; facesDetails.hidden = true; }
    if (editorDelBtn) editorDelBtn.hidden = true;
    if (editorDoneBtn) editorDoneBtn.hidden = true;
    if (editorAddBtn) editorAddBtn.hidden = false;
    if (editorCancelBtn) editorCancelBtn.hidden = false;
    editorEl.classList.add('is-pick');
    renderEditField(hex);
    const fineToggle = editorEl.querySelector<HTMLButtonElement>('[data-color-fine-toggle]');
    fineToggle?.addEventListener('click', () => {
      if (storedRow) storedRow.hidden = fineToggle.getAttribute('aria-expanded') !== 'true';
      reposition();
    });
    editorChip?.style.setProperty('--sw', hex);
    if (nameInput) nameInput.value = nameColor(hex);
    pickSheet = typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 640px)')?.matches;
    editorEl.classList.toggle('is-picksheet', pickSheet);
    editorAnchor = pickSheet ? null : anchor;
    editorEl.hidden = false;             // before positioning - the clamp measures offsetHeight
    if (pickSheet) { editorEl.style.left = ''; editorEl.style.top = ''; }
    else positionEditor(anchor);
    editorEl.querySelector<HTMLInputElement>('[data-color-hex]')?.focus();
  };
  /** Commit the pick through the room's ONE add path, carrying the name the
   *  person typed. The add row is cleared the way it clears itself. */
  const commitPickCard = (): void => {
    const hex = pickHex;
    if (!hex) return;
    const name = editorEl?.querySelector<HTMLInputElement>('[data-be-editor-name]')?.value ?? '';
    const value = serializeColor(hex, storedFmt);
    const group = pickGroup;
    closeEditor();
    const field = addField();
    if (field) { field.value = ''; field.dispatchEvent(new Event('input', { bubbles: true })); }
    addColorEntries([{ value, hex: colorToHex(hex) ?? hex, name }], true, group);
  };

  /**
   * Select the swatch at a JSON path and open its editor against the best
   * available anchor. Never "the last one" - key order shifts on repaint - and
   * never a hidden tile: a folded palette group measures 0×0 and would place
   * the popover at the panel origin, so the caller's own anchor (a wheel dot,
   * a gamut dot) takes over. A no-op when the path did not land.
   */
  const openSwatchAt = (path: string[] | null, fallback?: HTMLElement | null): void => {
    if (!path) return;
    const idx = swatches.findIndex(s => s.path.length === path.length && s.path.every((seg, i) => seg === path[i]));
    if (idx < 0) return;
    const tile = palMount?.querySelector<HTMLElement>(`[data-be-tile="${idx}"]`) ?? null;
    const anchor = (tile && tile.offsetParent !== null ? tile : null) ?? fallback ?? tile;
    if (anchor) openEditor(idx, anchor);
  };

  // The card earns its height back by MOVING. Anything that resizes it - folding
  // the print section open, switching the picker to CMYK's four sliders, a spot
  // name field appearing - re-runs positionEditor, which flips the card above the
  // tile when there's room up there. A ResizeObserver catches all of it, including
  // the changes we don't own (the colour field's own internals), so this is one
  // hook rather than a listener per control. Guarded: jsdom (the CLI shell's
  // renderer, and the unit tests) has no ResizeObserver.
  if (editorCard && typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => reposition());
    ro.observe(editorCard);
    cleanups.push(() => ro.disconnect());
  }

  // Palette selection supports checkboxes, touch, marquee and keyboard gestures.
  const swKey = (s: BrandSwatch): string => s.path.join('␟');
  const bulkbar = $('[data-be-bulkbar]') as HTMLElement | null;
  const ownTileEls = (groupSel = ''): HTMLElement[] => palMount
    ? [...palMount.querySelectorAll<HTMLElement>(`.be-pal-group${groupSel} [data-be-tile]`)]
    : [];
  const keyOfTile = (el: HTMLElement): string | null => {
    const s = swatches[Number(el.dataset.beTile)];
    return s ? swKey(s) : null;
  };
  const ownOrder = (): string[] => ownTileEls().map(keyOfTile).filter((k): k is string => !!k);
  const palSel = createSelection({ order: ownOrder });
  /** The tile holding the grid's one tab stop (roving tabindex). */
  let palFocusKey: string | null = null;
  const tileForKey = (key: string): HTMLElement | null => ownTileEls().find(el => keyOfTile(el) === key) ?? null;
  /** The selected swatches in the pane's READING order, which is the order the
   *  bar's role walk and the copied list both follow. */
  const selectedSwatches = (): BrandSwatch[] => {
    const byKey = new Map(swatches.map(s => [swKey(s), s]));
    return palSel.keys().map(k => byKey.get(k)).filter((s): s is BrandSwatch => !!s);
  };

  // The bar's three menus. One open at a time; a second press on its own button
  // closes it, as does Escape, an outside pointer, and the bar itself leaving.
  let openBulkPanel: string | null = null;
  const closeBulkMenu = (): void => {
    if (!bulkbar) return;
    openBulkPanel = null;
    bulkbar.querySelectorAll<HTMLElement>('[data-be-bulk-panel]').forEach(p => { p.hidden = true; });
    bulkbar.querySelectorAll<HTMLElement>('[data-be-bulk-menu]').forEach(b => b.setAttribute('aria-expanded', 'false'));
  };
  const syncPalSelect = (): void => {
    palSel.prune();
    const n = palSel.size();
    previewSelection = selectedSwatches().map(s => s.key);
    const source = $('[data-be-preview-source]');
    if (source) source.textContent = n ? tRaw('{n} selected', { n }) : t('Your palette');
    renderPreviews();
    const order = ownOrder();
    if (palFocusKey && !order.includes(palFocusKey)) palFocusKey = null;
    const roving = palFocusKey ?? order[0] ?? null;
    for (const el of ownTileEls()) {
      const k = keyOfTile(el);
      if (!k) continue;
      const on = palSel.has(k);
      el.classList.toggle('is-multi', on);
      const check = el.closest('.be-pal-card')?.querySelector<HTMLInputElement>('[data-be-select]');
      if (check) check.checked = on;
      if (on) el.setAttribute('aria-pressed', 'true');
      else el.removeAttribute('aria-pressed');
      // One tab stop for the whole grid: Tab crosses it in a press and the
      // arrows do the walking inside it.
      el.tabIndex = k === roving ? 0 : -1;
    }
    if (bulkbar) {
      bulkbar.hidden = n === 0;
      if (n === 0) closeBulkMenu();
      const nEl = bulkbar.querySelector<HTMLElement>('[data-be-bulk-n]');
      if (nEl) nEl.textContent = n === 1 ? t('1 selected') : tRaw('{n} selected', { n });
      for (const id of ['move', 'role']) {
        const wrap = bulkbar.querySelector<HTMLElement>(`[data-be-bulk-wrap="${id}"]`);
        if (wrap) wrap.hidden = false;
      }
    }
    if (n) root.setAttribute('data-pal-selecting', '1');
    else root.removeAttribute('data-pal-selecting');
    dockBulkBar();
  };
  /**
   * Sit the bar on the palette pane's bottom edge where there IS a pane to sit
   * on - the ≥1100px split, whose width is a per-person number the divider
   * writes, so no stylesheet can know it. Below that (and on the phone, where
   * the bar rides the sheet's free edge) it stays the centred pill it was.
   */
  const dockBulkBar = (): void => {
    if (!bulkbar) return;
    const pane = root.querySelector<HTMLElement>('[data-be-split-side]');
    let wide = false;
    try { wide = !!window.matchMedia?.('(min-width: 1100px)').matches; } catch { /* no matchMedia - stay centred */ }
    const r = wide ? pane?.getBoundingClientRect() : null;
    if (!r || !r.width) { bulkbar.classList.remove('is-docked'); return; }
    bulkbar.style.setProperty('--be-bulk-left', `${Math.round(r.left)}px`);
    bulkbar.style.setProperty('--be-bulk-w', `${Math.round(r.width)}px`);
    bulkbar.style.setProperty('--be-bulk-bottom', `${Math.max(8, Math.round(window.innerHeight - r.bottom + 8))}px`);
    bulkbar.classList.add('is-docked');
  };
  const onBulkResize = (): void => { if (!bulkbar?.hidden) dockBulkBar(); };
  window.addEventListener('resize', onBulkResize);
  cleanups.push(() => window.removeEventListener('resize', onBulkResize));
  /**
   * Hand focus back to the grid once the bulk bar has gone.
   *
   * Cancel and Delete both hide the bar that holds the button being pressed, so
   * without this the document's focus falls to `<body>` and a keyboard user
   * restarts from the top of the page. Only a bar that HELD focus hands it over
   * (`was` inside the bar) - plus the `<body>` case, which is both a Safari
   * click, where pressing a button never focuses it, and the state left behind
   * when a repaint has already detached whatever was focused. Focus that is
   * demonstrably somewhere else is left alone.
   *
   * The tile is re-queried each time: it lives in the grid, which the delete
   * path rebuilds, so a handle taken before the repaint would be a dead node.
   */
  const handBackPalFocus = (was: Element | null): void => {
    if (was && was !== document.body && !bulkbar?.contains(was)) return;
    const order = ownOrder();
    const key = palFocusKey && order.includes(palFocusKey) ? palFocusKey : order[0];
    if (key) tileForKey(key)?.focus();
  };
  const exitPalSelect = (): void => {
    if (!palSel.size()) return;
    const was = document.activeElement;
    palSel.clear(); syncPalSelect();
    handBackPalFocus(was);
  };
  paletteHooks.push(syncPalSelect);
  bulkbar?.querySelector<HTMLElement>('[data-be-bulk-cancel]')?.addEventListener('click', exitPalSelect);
  $('[data-be-bulk-preview]')?.addEventListener('click', () => { $('.be-context')?.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' }); });

  // ── What the bar does ──────────────────────────────────────────────────────
  // Every bulk write is ONE undo entry and one durable checkpoint: forty
  // swatches moved with one press come back with one Ctrl-Z.
  const bulkWrite = (label: string, checkpoint: string, run: () => void): void => {
    pushUndo(label);
    ctxCheckpoint(checkpoint);
    run();
    closeBulkMenu();
    repaintPalette(); persist(true);
  };
  const moveSelectionTo = (group: string): void => {
    const items = selectedSwatches();
    // The tag is stored theme-less by contract (see setSwatchGroup), so a live
    // heading loses its "· Light" before it is written.
    const name = group.replace(/\s*·.*$/, '').trim();
    if (!items.length || !name) return;
    bulkWrite(tRaw('Move {n} swatches', { n: items.length }), t('Before moving swatches'), () => {
      addPaletteGroup(doc, name);
      for (const s of items) setSwatchGroup(doc, s.path, name);
    });
    announce(`${tRaw('{n} moved to {group}.', { n: items.length, group: name })} ${t('Undo with Control Z.')}`);
  };
  /** Walk the selection onto consecutive roles from the one that was chosen, so
   *  a four-tile selection can take all four in one press. A role's own alias
   *  tile cannot take a role (the alias would chain), so those sit it out. */
  const giveSelectionRoles = (from: RoleId): void => {
    const items = selectedSwatches().filter(s => s.kind !== 'semantic');
    const start = ROLE_IDS.indexOf(from);
    if (!items.length || start < 0) return;
    const pairs = items.slice(0, ROLE_IDS.length - start).map((s, i) => ({ s, role: ROLE_IDS[start + i]! }));
    bulkWrite(tRaw('Give {n} swatches a role', { n: pairs.length }), t('Before assigning roles'), () => {
      for (const p of pairs) assignRole(doc, p.role, p.s.key, roleTheme());
    });
    const said = pairs.map(p => tRaw('{role} is now {name}', { role: roleLabel(p.role), name: p.s.name })).join(' ');
    const spare = items.length - pairs.length;
    const left = spare > 0 ? ` ${tRaw('{n} colours had no role left to take.', { n: spare })}` : '';
    announce(`${said}${left} ${t('Undo with Control Z.')}`);
  };
  const downloadSelection = async (format: SwatchExportFormat): Promise<void> => {
    const items = selectedSwatches();
    if (!items.length) return;
    closeBulkMenu();
    if (palErr) palErr.hidden = true;
    try {
      const fonts = format === 'tokens-json' ? await exportFonts() : undefined;
      const { blob, filename } = exportSwatches(items, format, undefined, fonts?.length ? { fonts } : undefined);
      await saveBlob(blob, filename);
      announce(tRaw('{n} colours downloaded as {filename}', { n: items.length, filename }));
    } catch (err) {
      if (palErr) { palErr.textContent = String((err as { message?: unknown })?.message ?? err); palErr.hidden = false; }
    }
  };
  const copySelectionValues = (): void => {
    const items = selectedSwatches();
    if (!items.length) return;
    closeBulkMenu();
    // The STORED notation - what the document holds and what a person pasting it
    // back would type. An alias has no notation of its own, so it copies as the
    // hex it currently resolves to.
    const text = items.map(s => (s.isAlias ? s.hex : s.raw)).filter(Boolean).join('\n');
    void Promise.resolve(host.clipboard?.writeText?.(text)).then(
      () => announce(items.length === 1
        ? tRaw('Copied {value}', { value: text })
        : tRaw('{n} colours copied', { n: items.length })),
      () => announce(t('Copy failed - your browser blocked clipboard access'), { assertive: true }),
    );
  };

  /** The Move-to menu's rows: every heading the pane is showing right now, plus
   *  the door to a new one. Built at open time with textContent because the
   *  names are the person's own group headings. */
  const fillMoveMenu = (panel: HTMLElement): void => {
    panel.textContent = '';
    const stems: string[] = [...paletteGroups(doc)];
    for (const el of ownTileEls()) {
      const stem = (el.closest<HTMLElement>('.be-pal-group')?.dataset.beGroup ?? '').replace(/\s*·.*$/, '').trim();
      if (stem && !stems.includes(stem)) stems.push(stem);
    }
    for (const stem of stems) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'be-bulkbar-item';
      b.dataset.beBulkMove = stem;
      b.textContent = stem;
      panel.append(b);
    }
    const fresh = document.createElement('button');
    fresh.type = 'button';
    fresh.className = 'be-bulkbar-item';
    fresh.dataset.beBulkMoveNew = '1';
    fresh.textContent = t('New group…');
    panel.append(fresh);
  };
  /** "New group…" asks for the name in the menu itself rather than in a prompt
   *  the person has to leave the selection to answer. */
  const askNewGroup = (panel: HTMLElement): void => {
    panel.textContent = '';
    const form = document.createElement('form');
    form.className = 'be-bulkbar-newgroup';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'field-input be-bulkbar-newname';
    input.maxLength = 60;
    input.autocomplete = 'off';
    input.placeholder = t('Group name');
    input.setAttribute('aria-label', t('New group name'));
    const go = document.createElement('button');
    go.type = 'submit';
    go.className = 'be-bulkbar-item';
    go.textContent = t('Move');
    form.append(input, go);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (input.value.trim()) moveSelectionTo(input.value);
      else input.focus();
    });
    panel.append(form);
    input.focus();
  };
  const openBulkMenu = (id: string): void => {
    if (!bulkbar) return;
    const wasOpen = openBulkPanel === id;
    closeBulkMenu();
    if (wasOpen) return;
    const panel = bulkbar.querySelector<HTMLElement>(`[data-be-bulk-panel="${id}"]`);
    const btn = bulkbar.querySelector<HTMLElement>(`[data-be-bulk-menu="${id}"]`);
    if (!panel || !btn) return;
    if (id === 'move') fillMoveMenu(panel);
    panel.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    openBulkPanel = id;
    panel.querySelector<HTMLElement>('button, input')?.focus();
  };
  bulkbar?.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const menu = el.closest<HTMLElement>('[data-be-bulk-menu]');
    if (menu) { openBulkMenu(menu.dataset.beBulkMenu ?? ''); return; }
    const move = el.closest<HTMLElement>('[data-be-bulk-move]');
    if (move) { moveSelectionTo(move.dataset.beBulkMove ?? ''); return; }
    if (el.closest('[data-be-bulk-move-new]')) {
      const panel = bulkbar.querySelector<HTMLElement>('[data-be-bulk-panel="move"]');
      if (panel) askNewGroup(panel);
      return;
    }
    const role = el.closest<HTMLElement>('[data-be-bulk-role]');
    if (role) { giveSelectionRoles(role.dataset.beBulkRole as RoleId); return; }
    const dl = el.closest<HTMLElement>('[data-be-bulk-dl]');
    if (dl) { void downloadSelection(dl.dataset.beBulkDl as SwatchExportFormat); return; }
    if (el.closest('[data-be-bulk-copy]')) copySelectionValues();
  });
  // No confirm dialog: undo is the safety net (plan 97 section 3 principle 3). The
  // gradient-stop side effect moves from a pre-hoc warning to a post-hoc
  // statement, and the per-swatch semantics are byte-for-byte what they were.
  bulkbar?.querySelector<HTMLElement>('[data-be-bulk-del]')?.addEventListener('click', () => {
    deleteSelection();
  });
  const deleteSelection = (): void => {
    const items = selectedSwatches();
    if (!items.length) return;
    const refs = items.reduce((n, s) => n + (s.kind !== 'ramp' && s.kind !== 'semantic' && s.deletable ? gradientAliasRefCount(doc, s.key) : 0), 0);
    pushUndo(items.length === 1 ? tRaw('Delete {name}', { name: items[0]!.name }) : tRaw('Delete {n} swatches', { n: items.length }));
    ctxCheckpoint(t('Before removing swatches'));
    let removed = 0;
    for (const s of items) {
      if (!s.deletable || isStarterSwatch(s) || s.kind === 'ramp' || s.kind === 'semantic') { setSwatchExcluded(doc, s.key, true); removed++; continue; }
      if (!s.deletable) continue;
      if (gradientAliasRefCount(doc, s.key)) materializeGradientAliases(doc, ref => aliasPath(ref) === s.key, () => s.hex || null);
      deleteSwatch(doc, s.path); removed++;
    }
    exitPalSelect(); closeBulkMenu(); closeEditor(); repaintPalette(); persist(true);
    // The repaint rebuilt the grid, and with it the tile exitPalSelect had
    // just focused - so the handoff is repeated against the live one.
    handBackPalFocus(document.activeElement);
    const gone = removed === 1 ? t('1 swatch removed') : tRaw('{n} swatches removed', { n: removed });
    // Selection reaches every own tile now, so a selection can hold a swatch
    // this room does not remove (a token an import brought in read-only). Say
    // so rather than quietly dropping it from the count.
    const held = items.length - removed;
    const kept = held > 0 ? ` ${tRaw('{n} were kept - they are not this room to remove.', { n: held })}` : '';
    const stops = refs === 0 ? ''
      : refs === 1 ? ` ${t('1 gradient stop keeps its colour as a fixed value.')}`
        : ` ${tRaw('{refs} gradient stops keep their colour as a fixed value.', { refs })}`;
    announce(`${gone}${kept}${stops} ${t('Undo with Control Z.')}`);
  };

  // ── Marquee, and the touch gesture that stands in for it ───────────────────
  // Drag on the pane's empty space and every tile the rectangle touches joins
  // the selection, across group boundaries. Pure geometry over
  // getBoundingClientRect(), no library. The rectangle is one absolutely
  // positioned div inside `.be-pal` (which is position: relative for exactly
  // this), so it scrolls with the tiles and paints under the swatch popover,
  // which is a sibling of the pane at z 30.
  //
  // Tiles come from the OPEN groups only: a folded <details> contributes none,
  // which is what stops a sweep collecting colours nobody can see.
  //
  // TOUCH HAS NO MARQUEE. A drag on a phone is the pane scrolling, so a long
  // press on a tile starts the selection instead and every later tap toggles;
  // the per-group "Select all" carries the rest.
  const DRAG_SLOP = 4;
  const LONG_PRESS_MS = 500;
  let lastPointerType = '';
  /** A long press has just made a selection - swallow the click it turns into,
   *  or the tap that started the selection immediately undoes it. */
  let swallowTileClick = false;
  let longPressTimer: ReturnType<typeof setTimeout> | undefined;
  let longPressFrom: { x: number; y: number } | null = null;
  let marqueeEl: HTMLElement | null = null;
  let marqueeFrom: { x: number; y: number } | null = null;
  let marqueeBase: string[] = [];
  let marqueeMoved = false;
  cleanups.push(() => clearTimeout(longPressTimer));

  const marqueeTiles = (): SelectTile[] => ownTileEls('[open]').flatMap((el) => {
    const k = keyOfTile(el);
    if (!k) return [];
    const r = el.getBoundingClientRect();
    return [{ key: k, rect: { left: r.left, top: r.top, right: r.right, bottom: r.bottom } }];
  });
  const endMarquee = (): void => {
    marqueeEl?.remove();
    marqueeEl = null; marqueeFrom = null; marqueeMoved = false;
    palMount?.classList.remove('is-marqueeing');
  };
  cleanups.push(endMarquee);

  palMount?.addEventListener('pointerdown', (e) => {
    lastPointerType = e.pointerType;
    // A press that never became a click (a long press then a scroll) must not
    // leave the swallow armed for whatever is pressed next.
    swallowTileClick = false;
    clearTimeout(longPressTimer); longPressFrom = null;
    const el = e.target as HTMLElement;
    const tile = el.closest<HTMLElement>('[data-be-tile]');
    if (tile) {
      if (e.pointerType !== 'touch' || palSel.size()) return;
      const k = keyOfTile(tile);
      if (!k) return;
      longPressFrom = { x: e.clientX, y: e.clientY };
      longPressTimer = setTimeout(() => {
        longPressFrom = null;
        swallowTileClick = true;
        palFocusKey = k;
        palSel.toggle(k);
        syncPalSelect();
        playSfx('click');
      }, LONG_PRESS_MS);
      return;
    }
    if (e.button !== 0 || e.pointerType === 'touch' || !palMount) return;
    // The pane's own empty space only - a group head, a disclosure or a button
    // is a control, not canvas.
    if (el.closest('button, a, input, select, label, summary, .be-pal-group-note')) return;
    e.preventDefault(); // no text selection dragging along behind the rectangle
    marqueeBase = (e.shiftKey || e.metaKey || e.ctrlKey) ? palSel.keys() : [];
    const pr = palMount.getBoundingClientRect();
    marqueeFrom = { x: e.clientX - pr.left, y: e.clientY - pr.top };
    marqueeMoved = false;
    try { palMount.setPointerCapture(e.pointerId); } catch { /* capture is a nicety, not the gesture */ }
  });

  palMount?.addEventListener('pointermove', (e) => {
    if (longPressFrom
      && (Math.abs(e.clientX - longPressFrom.x) > DRAG_SLOP || Math.abs(e.clientY - longPressFrom.y) > DRAG_SLOP)) {
      clearTimeout(longPressTimer); longPressFrom = null; // a scroll, not a press
    }
    if (!marqueeFrom || !palMount) return;
    // Measured fresh every move: the pane's scroller can move under the drag,
    // and the anchor is held in pane-local coordinates so it stays on the tile
    // it started beside rather than on a point of the viewport.
    const pr = palMount.getBoundingClientRect();
    const x = e.clientX - pr.left, y = e.clientY - pr.top;
    if (!marqueeMoved) {
      if (Math.abs(x - marqueeFrom.x) < DRAG_SLOP && Math.abs(y - marqueeFrom.y) < DRAG_SLOP) return;
      marqueeMoved = true;
      marqueeEl = document.createElement('div');
      marqueeEl.className = 'be-marquee';
      palMount.append(marqueeEl);
      palMount.classList.add('is-marqueeing');
    }
    const left = Math.min(x, marqueeFrom.x), top = Math.min(y, marqueeFrom.y);
    const w = Math.abs(x - marqueeFrom.x), h = Math.abs(y - marqueeFrom.y);
    if (marqueeEl) {
      marqueeEl.style.left = `${left}px`; marqueeEl.style.top = `${top}px`;
      marqueeEl.style.width = `${w}px`; marqueeEl.style.height = `${h}px`;
    }
    palSel.marquee(
      { left: pr.left + left, top: pr.top + top, right: pr.left + left + w, bottom: pr.top + top + h },
      marqueeTiles(), marqueeBase,
    );
    syncPalSelect();
  });

  const finishPalPointer = (e: PointerEvent): void => {
    clearTimeout(longPressTimer); longPressFrom = null;
    if (!marqueeFrom) return;
    const moved = marqueeMoved;
    try { palMount?.releasePointerCapture(e.pointerId); } catch { /* already released */ }
    endMarquee();
    // A press on empty space that never became a drag drops the selection - the
    // same gesture every file manager answers to.
    if (!moved && palSel.size()) { palSel.clear(); syncPalSelect(); }
  };
  palMount?.addEventListener('pointerup', finishPalPointer);
  palMount?.addEventListener('pointercancel', finishPalPointer);

  palMount?.addEventListener('change', e => {
    const checkbox = (e.target as HTMLElement).closest<HTMLInputElement>('[data-be-select]');
    if (!checkbox) return;
    const s = swatches[Number(checkbox.dataset.beSelect)];
    if (s) { palSel.toggle(swKey(s)); syncPalSelect(); }
  });
  palMount?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('.be-pal-check')) return;
    if (target.closest('[data-be-hide-starter]')) {
      e.preventDefault(); pushUndo(t('Hide starter colours'));
      for (const swatch of swatches.filter(s => s.kind !== 'semantic' && isStarterSwatch(s) && !paletteGroups(doc).includes(groupName(s.group)))) setSwatchExcluded(doc, swatch.key, true);
      repaintPalette(); persist(true); return;
    }
    if (target.closest('[data-be-restore]')) {
      pushUndo(t('Restore hidden colours'));
      for (const key of getExcludedSwatches(doc)) setSwatchExcluded(doc, key, false);
      repaintPalette(); persist(true); return;
    }
    if (swallowTileClick) { swallowTileClick = false; e.preventDefault(); return; }
    const all = (e.target as HTMLElement).closest<HTMLElement>('[data-be-pal-all]');
    if (all) {
      // It sits in a <summary>, so the default toggle has to be swallowed or
      // selecting a section folds it away under the selection.
      e.preventDefault();
      const g = all.dataset.bePalAll ?? '';
      // Matched in JS rather than through a selector: a heading is the person's
      // own text and may hold anything a CSS attribute selector would need
      // escaping for.
      const keys = ownTileEls()
        .filter(el => (el.closest<HTMLElement>('.be-pal-group')?.dataset.beGroup ?? '') === g)
        .map(keyOfTile).filter((k): k is string => !!k);
      palSel.allInGroup(keys);
      syncPalSelect();
      return;
    }
    const add = (e.target as HTMLElement).closest<HTMLElement>('[data-be-add]');
    if (add) {
      // Group Adds live inside a <summary> - swallow the default toggle so
      // adding a swatch never folds the section it lands in.
      e.preventDefault();
      openPickCard(add, null);
      pickGroup = add.dataset.beAddGroup;

      return;
    }
    const tileEl = (e.target as HTMLElement).closest<HTMLElement>('[data-be-tile]');
    if (!tileEl) return;
    const tIdx = Number(tileEl.dataset.beTile);
    const s = swatches[tIdx];
    const k = s ? swKey(s) : null;
    const own = !!k;
    if (own && k) {
      palFocusKey = k;
      if (e.metaKey || e.ctrlKey) { palSel.toggle(k); syncPalSelect(); return; }
      if (e.shiftKey) { palSel.range(palSel.anchor() ?? k, k); syncPalSelect(); return; }
      // On a touch screen there is no marquee and no modifier key, so once a
      // long press has started a selection a tap adds and removes. With a
      // pointer, a plain click still opens the editor exactly as it always did,
      // and drops the selection on the way in.
      if (lastPointerType === 'touch' && palSel.size()) { palSel.toggle(k); syncPalSelect(); return; }
      if (palSel.size()) { palSel.clear(); syncPalSelect(); }
    }
    openEditor(tIdx, tileEl);
  });

  // ── Palette grid: keyboard channel nudging (huetone-style) ──────────────────
  // With a swatch TILE focused (a native <button>, so Tab reaches it and Enter/
  // click still opens the popover), l/c/h ARM an OKLCH channel and Arrow Up/Down
  // nudge it (Shift = coarse). Shift+H copies the hex, Shift+C the oklch() string.
  // We only ever act when the tile itself is the focused element - a text input in
  // the popover (a separate element outside palMount) never reaches this listener,
  // so no browser default is hijacked. The one deviation from the brief's "c
  // copies hex": bare `c` ARMS Chroma (keeping the L/C/H channel model whole), so
  // copy-hex moved to Shift+H (H = Hex) - the model reads "letter arms, Shift+
  // letter copies", and Cmd/Ctrl+C is never touched, which was the real rule.
  /** How many tiles sit in the focused tile's row. Measured, not assumed: the
   *  grid is `auto-fill`, so the count moves with the pane's width. */
  const gridColumns = (tile: HTMLElement): number => {
    const grid = tile.closest<HTMLElement>('.be-pal-grid');
    if (!grid) return 1;
    const kids = [...grid.children] as HTMLElement[];
    const top = kids[0]?.offsetTop ?? 0;
    return Math.max(1, kids.filter(el => el.offsetTop === top).length);
  };
  /**
   * The grid's own keyboard (plan 182 section 5.5): arrows move the focused
   * tile, Shift-arrows extend the selection, Space toggles, Cmd-A takes every
   * own colour, Delete removes the selection. True means the press was consumed,
   * so the channel nudging below only ever sees what is left.
   *
   * THE ARROWS BELONG TO THE GRID NOW, and the channel nudge keeps them only
   * while a channel is ARMED - which is why `armedChannel` starts at null rather
   * than 'L'. The model was always "a letter arms, the arrows nudge"; it just
   * started armed, so the first Arrow Up on a freshly focused tile recoloured it
   * instead of moving. Press l, c or h and Arrow Up/Down nudge exactly as they
   * always did.
   *
   * Escape is deliberately NOT here: the studio's Escape ladder (popover, then
   * the review card, then the selection) lives on the document handler, and one
   * ladder is the only way it stays in order.
   */
  const paletteSelectKey = (e: KeyboardEvent, tile: HTMLElement): boolean => {
    const k = keyOfTile(tile);
    if (!k || e.key === 'Escape') return false;
    palFocusKey = k;
    if ((e.key === 'Delete' || e.key === 'Backspace') && palSel.size()) {
      e.preventDefault();
      deleteSelection();
      return true;
    }
    if (armedChannel && (e.key === 'ArrowUp' || e.key === 'ArrowDown') && !e.metaKey && !e.ctrlKey) return false;
    const r = palSel.keyboard(e.key, k, {
      shift: e.shiftKey, meta: e.metaKey || e.ctrlKey, columns: gridColumns(tile),
    });
    if (!r.handled) return false;
    e.preventDefault();
    if (r.focus) palFocusKey = r.focus;
    syncPalSelect();
    if (r.focus && r.focus !== k) tileForKey(r.focus)?.focus();
    return true;
  };

  const CHANNEL_NAME: Record<'L' | 'C' | 'H', string> = { L: t('Lightness'), C: t('Chroma'), H: t('Hue') };
  const channelValueStr = (ch: 'L' | 'C' | 'H', hex: string): string => {
    const o = hexToOklch(hex);
    if (!o) return hex;
    return ch === 'L' ? `L ${o.l.toFixed(2)}` : ch === 'C' ? `C ${o.c.toFixed(3)}` : `H ${Math.round(o.h)}°`;
  };
  const nudgeFmtOf = (s: BrandSwatch): StorageFormat => (s.isAlias ? 'lch' : storageFormatOf(s.raw));
  const copyTileText = (text: string, spoken: string): void => {
    void Promise.resolve(host.clipboard?.writeText?.(text)).then(
      () => announce(spoken),
      () => announce(t('Copy failed - your browser blocked clipboard access'), { assertive: true }),
    );
  };
  palMount?.addEventListener('keydown', (e) => {
    const tile = (e.target as HTMLElement | null)?.closest?.<HTMLElement>('[data-be-tile]') ?? null;
    // Only when the tile BUTTON itself holds focus - never a nested/other control.
    if (!tile || tile !== (e.target as HTMLElement) || e.altKey) return;
    if (paletteSelectKey(e, tile)) return; // arrows, Shift-arrows, Space, Cmd-A, Delete
    if (e.metaKey || e.ctrlKey) return;
    const idx = Number(tile.dataset.beTile);
    const s = Number.isInteger(idx) ? swatches[idx] : undefined;
    if (!s || !s.hex) return;
    const k = e.key;
    // Arm a channel (bare l/c/h) - a live readout via the shared aria-live region.
    if (!e.shiftKey && (k === 'l' || k === 'c' || k === 'h')) {
      e.preventDefault();
      armedChannel = k.toUpperCase() as 'L' | 'C' | 'H';
      announce(tRaw('{channel} armed · {value}', { channel: CHANNEL_NAME[armedChannel], value: channelValueStr(armedChannel, s.hex) }));
      return;
    }
    // Copy - Shift+C the oklch() string, Shift+H the hex.
    if (e.shiftKey && (k === 'C' || k === 'H')) {
      e.preventDefault();
      const o = hexToOklch(s.hex);
      if (k === 'C' && o) copyTileText(formatOklch(o), tRaw('Copied {value}', { value: formatOklch(o) }));
      else copyTileText(s.hex, tRaw('Copied {value}', { value: s.hex }));
      return;
    }
    // Nudge the armed channel (Shift = coarse ×5), written through the same doc
    // path a popover edit uses, so it persists on Save identically.
    if (armedChannel && (k === 'ArrowUp' || k === 'ArrowDown')) {
      e.preventDefault();
      const next = nudgeSwatch(s.hex, armedChannel, k === 'ArrowUp' ? 1 : -1, e.shiftKey);
      writeSwatchHex(idx, next, nudgeFmtOf(s));
      announce(tRaw('{channel} {value}', { channel: CHANNEL_NAME[armedChannel], value: channelValueStr(armedChannel, next) }));
    }
  });

  editorEl?.querySelector('[data-be-editor-name]')?.addEventListener('input', (e) => {
    if (selected < 0) return;
    const cur = swatches[selected]; if (!cur) return;
    const val = (e.target as HTMLInputElement).value;
    setSwatchName(doc, cur.path, val); cur.name = val || cur.name;
    const tile = palMount?.querySelector<HTMLElement>(`[data-be-tile="${selected}"]`);
    if (tile) syncTileMeta(tile, cur); // the grid is shape-only - the name lives in title/aria
    persist();
  });
  editorEl?.querySelector('[data-be-editor-del]')?.addEventListener('click', () => {
    if (selected < 0) return;
    const cur = swatches[selected]; if (!cur) return;
    pushUndo(tRaw('Delete {name}', { name: cur.name }));
    // Derived leaves (ramp steps + the theme roles) are structural - "delete"
    // HIDES them via the doc's exclusion list: the ramp stays derived and the
    // token keeps resolving (so semantic roles and gradient aliases pointing at
    // an excluded step never dangle - no materialisation needed), while the
    // tile vanishes from the grid + picker swatches. A re-derive clears entries
    // whose step no longer exists (see the derive flow above).
    if (!cur.deletable || isStarterSwatch(cur) || cur.kind === 'ramp' || cur.kind === 'semantic') {
      setSwatchExcluded(doc, cur.key, true);
      closeEditor(); repaintPalette(); persist(true);
      announce(`${tRaw('{name} removed', { name: cur.name })} ${t('Undo with Control Z.')}`);
      return;
    }
    if (!cur.deletable) { undoStack.pop(); return; } // nothing happened - drop the snapshot
    // Gradient stops may wear this swatch by alias - pin them to its current hex
    // before it goes, so the doc and any exported pack never carry a dangling
    // ref. No confirm: the announcement says what happened, and undo restores it.
    const refs = gradientAliasRefCount(doc, cur.key);
    if (refs) materializeGradientAliases(doc, ref => aliasPath(ref) === cur.key, () => cur.hex || null);
    deleteSwatch(doc, cur.path); closeEditor(); repaintPalette(); persist(true);
    const stops = refs === 0 ? ''
      : refs === 1 ? ` ${t('1 gradient stop keeps its colour as a fixed value.')}`
        : ` ${tRaw('{refs} gradient stops keep their colour as a fixed value.', { refs })}`;
    announce(`${tRaw('{name} removed', { name: cur.name })}${stops} ${t('Undo with Control Z.')}`);
  });
  // Save = the affirmative close: edits already landed live (same contract as
  // the wheel/tiles), so this flushes the debounce, confirms audibly, and closes.
  editorEl?.querySelector('[data-be-editor-done]')?.addEventListener('click', () => {
    persist(true); playSfx('saveProfile'); closeEditor();
  });
  editorEl?.querySelector('[data-be-editor-name]')?.addEventListener('keydown', (event) => {
    const e = event as KeyboardEvent;
    if (e.key !== 'Enter' || e.isComposing) return;
    e.preventDefault();
    if (pickHex !== null) commitPickCard();
    else { persist(true); closeEditor(); }
  });
  // The pick card's footer. Cancel is a real cancel - nothing was written, so
  // there is nothing to undo and the add row keeps whatever it had.
  editorEl?.querySelector('[data-be-editor-cancel]')?.addEventListener('click', () => {
    closeEditor();
    addField()?.focus();
  });
  editorEl?.querySelector('[data-be-editor-add]')?.addEventListener('click', () => { commitPickCard(); });
  // Esc / outside-click closes the swatch editor (the colour popover stops its own Esc).
  // The add row's chip is exempt: it OPENS this card, so letting the pointer-down
  // close it first would make every press a toggle that ends closed.
  const onDocPointer = (e: PointerEvent): void => {
    // The bulk bar's menus dismiss on the same press, and on their own: the bar
    // shows whether or not a swatch card is open.
    if (openBulkPanel && !bulkbar?.contains(e.target as Node)) closeBulkMenu();
    if (!editorEl || editorEl.hidden || editorEl.contains(e.target as Node)) return;
    const el = e.target as HTMLElement;
    if (el.closest('[data-be-tile]') || el.closest('[data-ds-addc-pick]')) return;
    closeEditor();
  };
  // stopImmediatePropagation, not stopPropagation: the host view's own
  // Esc-to-leave handler listens on the SAME document target, and plain
  // stopPropagation can't stop a sibling listener - Esc on an open popover
  // would close it AND kick the user out of the studio. The editor mounts
  // before the host wires its handler, so this one runs first.
  const onKey = (e: KeyboardEvent): void => {
    // Undo - Colours room only, and never over a text field (a native input owns
    // its own undo; hijacking a browser default is not on). With an empty stack
    // the key falls straight through to the page.
    if ((e.key === 'z' || e.key === 'Z') && (e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      const be = root.querySelector<HTMLElement>('[data-brand-editor]');
      // No data-active-tab at all = every panel stacked, i.e. the room is showing.
      if (be?.dataset.activeTab && be.dataset.activeTab !== 'color') return;
      if (!undoStack.length) return;
      e.preventDefault(); e.stopImmediatePropagation();
      undoLast();
      return;
    }
    if (e.key !== 'Escape') return;
    if (editorEl && !editorEl.hidden) { e.stopImmediatePropagation(); closeEditor(); return; }
    if (reviewEl && !reviewEl.hidden) { e.stopImmediatePropagation(); hideReview(); return; }
    if (openBulkPanel) { e.stopImmediatePropagation(); closeBulkMenu(); return; }
    // The model decides whether there was anything to clear, and the event is
    // only stopped when there was - an Escape this room did not answer has to
    // reach the studio's own handler, or the room becomes a trap.
    const was = document.activeElement;
    if (palSel.keyboard('Escape', palFocusKey).cleared) {
      e.stopImmediatePropagation();
      syncPalSelect();
      handBackPalFocus(was);
    }
  };
  document.addEventListener('pointerdown', onDocPointer, true);
  document.addEventListener('keydown', onKey);
  cleanups.push(() => { document.removeEventListener('pointerdown', onDocPointer, true); document.removeEventListener('keydown', onKey); });


  // The popover positions in `.be` space, but its anchors live inside the side
  // pane's own scrollport (and below 1100px the page itself still scrolls) - 
  // either scroll drifts an open popover off its tile. Capture-phase scroll
  // catches both: follow the tile while it exists, close when it's gone.
  // refreshTile swaps tiles via outerHTML, so a disconnected anchor is
  // re-queried by index before giving up.
  const onAnchorScroll = (e: Event): void => {
    if (!editorEl || editorEl.hidden || pickSheet) return; // the phone pose is docked, not anchored
    if (e.target instanceof Node && editorEl.contains(e.target)) return; // the popover's own body scrolling
    const anchor = editorAnchor?.isConnected
      ? editorAnchor
      : (selected >= 0 ? palMount?.querySelector<HTMLElement>(`[data-be-tile="${selected}"]`) ?? null : null);
    if (!anchor) { closeEditor(); return; }
    // An anchor inside the side pane's clipped scrollport can scroll out from
    // under the popover - following it would float the popover over the derive
    // panel (and slide it under the sticky action row). Close once it leaves.
    const pane = anchor.closest('.be-split-scroll');
    if (pane) {
      const pr = pane.getBoundingClientRect(), ar = anchor.getBoundingClientRect();
      if (ar.bottom < pr.top || ar.top > pr.bottom) { closeEditor(); return; }
    }
    editorAnchor = anchor; positionEditor(anchor);
  };
  document.addEventListener('scroll', onAnchorScroll, { capture: true, passive: true });
  cleanups.push(() => document.removeEventListener('scroll', onAnchorScroll, true));

  // ── The wheel: a live OKLCH hue/chroma view of the SAME swatches ────────────
  // Drag a dot to recolour it (hue+chroma from where it lands, lightness kept),
  // click a dot to open its editor, click empty space to drop a new custom
  // swatch there. Re-rendered (and re-wired) on every repaint so it never drifts
  // from the grid; recolours update the one dot + its grid tile in place.
  const liveTile = (idx: number, hex: string): void => {
    const tile = palMount?.querySelector<HTMLElement>(`[data-be-tile="${idx}"]`);
    if (!tile) return;
    tile.style.setProperty('--sw', hex);
    tile.classList.remove('is-empty');
    const s = swatches[idx];
    if (s) syncTileMeta(tile, s); // hex already updated on the swatch by the caller
  };
  paintWheel = (): void => {
    if (!wheelMount) return;
    const dots: WheelDot[] = swatches.map((s, idx) => ({ idx, hex: s.hex, label: s.name }));
    wheelMount.innerHTML = renderBrandWheel(dots);
    wheelTeardown?.();
    wheelTeardown = wireBrandWheel(wheelMount, {
      hexOf: (idx) => swatches[idx]?.hex ?? '#888888',
      onRecolor: (idx, o) => {
        const cur = swatches[idx]; if (!cur) return;
        // Respect the swatch's stored notation: LCH swatches (the default) get
        // the exact oklch() string; a swatch the user stores as hex/rgb/hsl
        // keeps its notation through a wheel drag too.
        const fmt = storageFormatOf(cur.raw);
        const hex = oklchHex(o);
        const stored = fmt === 'lch' ? oklchToStored(o) : serializeColor(hex, fmt);
        setSwatchValue(doc, cur.path, stored);
        cur.raw = stored; cur.hex = hex;
        updateWheelDot(wheelMount, idx, hex);
        liveTile(idx, hex);
        if (selected === idx && editorChip) editorChip.style.setProperty('--sw', hex); // keep an open editor's chip in step
      },
      onCommit: () => persist(),
      onPick: (idx) => {
        // The tile can hide inside a folded palette group (display:none - 
        // offsetParent null); a hidden anchor would place the popover at the
        // panel origin, so fall back to the wheel dot itself.
        const tile = palMount?.querySelector<HTMLElement>(`[data-be-tile="${idx}"]`);
        const anchor = (tile && tile.offsetParent !== null ? tile : null)
          ?? wheelMount.querySelector<HTMLElement>(`[data-be-widx="${idx}"]`);
        if (anchor) openEditor(idx, anchor);
      },
      onAdd: (seed) => {
        const path = addSwatch(doc, 'custom', t('New swatch'), oklchHex(seed));
        if (path) setSwatchValue(doc, path, oklchToStored(seed)); // sit exactly where dropped
        repaintPalette(); persist(true);
        const idx = path ? swatches.findIndex(s => s.path.length === path.length && s.path.every((seg, i) => seg === path[i])) : -1;
        openSwatchAt(path, idx >= 0 ? wheelMount.querySelector<HTMLElement>(`[data-be-widx="${idx}"]`) : null);
      },
    });
  };
  cleanups.push(() => wheelTeardown?.());

  // ── The gamut chart ────────────────────────────────────────────────────────
  // A plane through OKLCH space with the sRGB / Display-P3 / Rec.2020 bands
  // drawn on it. The wheel shows what a palette IS; this shows what it can
  // still become - the sRGB boundary is a curve in lightness×chroma that moves
  // with hue, so it only becomes visible on a plane that has one of those as a
  // real axis. Same swatches, same drag/click/add gestures, same persist path.

  /** The range the fixed-channel slider covers, per plane. */
  const FIXED_RANGE: Record<SlicePlane, { min: number; max: number; step: number }> = {
    lc: { min: 0, max: 359, step: 1 },        // hue°
    ch: { min: 0, max: 1, step: 0.01 },       // lightness
    // Chroma - the same ceiling the chart's own axis uses, so the slider cannot
    // ask for a slice the plot has no room to show.
    lh: { min: 0, max: sliceCMax(sliceState), step: 0.005 },
  };
  const FIXED_LABEL: Record<SlicePlane, string> = {
    lc: t('Hue'), ch: t('Lightness'), lh: t('Chroma'),
  };
  /**
   * A swatch's AUTHORED colour, for positioning its dot on the slice charts.
   *
   * `s.hex` is the resolved sRGB bake - gamut-MAPPED, so for a swatch stored as
   * `oklch()` past sRGB it carries a reduced chroma. Positioning from it plots the
   * sRGB ceiling instead of the colour (the same defect just fixed in the Colour
   * Lab), and worse, a drag then reads back that clamped value and ratchets the
   * swatch's real chroma down a step at a time.
   *
   * `s.raw` is the stored `$value`, which is `oklch()` for anything the wheel wrote.
   * An alias (`{color.x}`) or an unparseable value has no authored colour of its own
   * - those fall back to the hex, which is what they were always positioned by.
   */
  const swatchOklch = (s: { raw: string; isAlias: boolean }): { l: number; c: number; h: number } | undefined => {
    if (s.isAlias) return undefined;
    const parsed = parseCssColor(s.raw);
    if (!parsed) return undefined;
    const [l, c, h] = convertColor(parsed, 'oklch').components;
    return Number.isFinite(l) && Number.isFinite(c) && Number.isFinite(h) ? { l, c, h } : undefined;
  };

  const sliceDots = (): SliceDot[] =>
    swatches.map((s, idx) => ({ idx, hex: s.hex, label: s.name, oklch: swatchOklch(s) }));

  /** Move every dot to where the CURRENT slice puts it, without a re-render - 
   *  the off-plane fade changes on every tick of the fixed slider. */
  const refreshSliceDots = (): void => {
    if (!sliceMount) return;
    for (const s of swatches.keys()) {
      updateSliceDot(sliceMount, s, swatches[s]!.hex, sliceState, swatchOklch(swatches[s]!));
    }
  };

  // Repaint at most once per frame while the fixed slider is scrubbed, at half
  // resolution - three engine slices is ~17ms of real work, too much to run
  // synchronously inside a pointermove.
  let sliceFrame = 0;
  const schedulePaint = (quality: 'full' | 'draft'): void => {
    if (sliceFrame) cancelAnimationFrame(sliceFrame);
    sliceFrame = requestAnimationFrame(() => {
      sliceFrame = 0;
      if (sliceMount) paintSliceChart(sliceMount, sliceState, { quality });
    });
  };
  cleanups.push(() => { if (sliceFrame) cancelAnimationFrame(sliceFrame); });

  paintSlices = (): void => {
    if (!sliceMount || chartView !== 'slices') return;
    const axes = SLICE_AXES[sliceState.plane];
    const range = FIXED_RANGE[sliceState.plane];
    sliceMount.innerHTML = `
      <div class="be-slice-ctl">
        ${segHtml('sliceplane', [
          { id: 'lc', label: t('L × C') },
          { id: 'ch', label: t('C × H') },
          { id: 'lh', label: t('L × H') },
        ], sliceState.plane, t('Slice plane'), { attr: 'data-be-plane', extraClass: 'be-sliceplane' })}
        <label class="be-slice-fixed">
          <span class="be-slice-fixed-label">${escape(FIXED_LABEL[sliceState.plane])}</span>
          <input type="range" class="be-slice-range" data-be-slice-fixed
            min="${range.min}" max="${range.max}" step="${range.step}" value="${sliceState.fixed}"
            aria-label="${escape(FIXED_LABEL[sliceState.plane])}">
          <output class="be-slice-fixed-val" data-be-slice-out>${escape(formatFixed(sliceState.plane, sliceState.fixed))}</output>
        </label>
      </div>
      ${renderSliceChart(sliceState, sliceDots(), { editable: true })}
      <p class="be-wheel-hint">${t('Colour inside the bright region is displayable everywhere; the drained bands need a Display-P3 or Rec.2020 screen, and the checkerboard is beyond every display. The solid line is the sRGB edge, the dashed one Display-P3. Drag a dot to recolour · click to edit · click empty space to add.')}</p>`;

    sliceTeardown?.();
    const teardowns: Array<() => void> = [];

    teardowns.push(wireSliceChart(sliceMount, {
      stateOf: () => sliceState,
      hexOf: (idx) => swatches[idx]?.hex ?? '#888888',
      onRecolor: (idx, o) => {
        const cur = swatches[idx]; if (!cur) return;
        // Same storage-notation contract as the wheel: an LCH swatch keeps the
        // exact oklch(), a hex/rgb/hsl one keeps its own notation.
        const fmt = storageFormatOf(cur.raw);
        const hex = oklchHex(o);
        const stored = fmt === 'lch' ? oklchToStored(o) : serializeColor(hex, fmt);
        setSwatchValue(doc, cur.path, stored);
        cur.raw = stored; cur.hex = hex;
        updateSliceDot(sliceMount, idx, hex, sliceState);
        liveTile(idx, hex);
        if (selected === idx && editorChip) editorChip.style.setProperty('--sw', hex);
      },
      onCommit: () => persist(),
      onPick: (idx) => {
        // Clicking an off-plane dot brings the SLICE to the colour rather than
        // the colour to the slice - the palette is what's being read here, and
        // silently rotating a swatch's hue to match the chart would be the
        // chart editing something the user only pointed at.
        const s = swatches[idx];
        if (s) {
          const o = hexToOklch(s.hex);
          if (o) {
            const want = sliceFixedOf(sliceState.plane, o);
            if (Math.abs(want - sliceState.fixed) > (axes.fixed === 'h' ? 0.5 : 0.005)) {
              sliceState.fixed = want;
              paintSlices();
              return; // the re-render replaced the dot; let the user click again to edit
            }
          }
        }
        const tile = palMount?.querySelector<HTMLElement>(`[data-be-tile="${idx}"]`);
        const anchor = (tile && tile.offsetParent !== null ? tile : null)
          ?? sliceMount.querySelector<HTMLElement>(`[data-okls-idx="${idx}"]`);
        if (anchor) openEditor(idx, anchor);
      },
      onAdd: (seed) => {
        const path = addSwatch(doc, 'custom', t('New swatch'), oklchHex(seed));
        if (path) setSwatchValue(doc, path, oklchToStored(seed));
        repaintPalette(); persist(true);
        const idx = path ? swatches.findIndex(s => s.path.length === path.length && s.path.every((seg, i) => seg === path[i])) : -1;
        openSwatchAt(path, idx >= 0 ? sliceMount.querySelector<HTMLElement>(`[data-okls-idx="${idx}"]`) : null);
      },
    }));

    // Plane switch: a full re-render, since the axes, ticks and slider range all
    // change. Carry the fixed value across by reading it off the palette's
    // primary, so the new plane opens somewhere useful rather than at zero.
    const planeSeg = sliceMount.querySelector<HTMLElement>('[data-be-seg="sliceplane"]');
    if (planeSeg) {
      const onPlane = (e: Event): void => {
        const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-val]'); if (!btn) return;
        const next = btn.dataset.val as SlicePlane;
        if (next === sliceState.plane) return;
        sliceState.plane = next;
        const anchorHex = swatches.find(s => (hexToOklch(s.hex)?.c ?? 0) > 0.02)?.hex ?? swatches[0]?.hex;
        const o = anchorHex ? hexToOklch(anchorHex) : null;
        sliceState.fixed = o ? sliceFixedOf(next, o) : FIXED_RANGE[next].min;
        paintSlices();
      };
      planeSeg.addEventListener('click', onPlane);
      teardowns.push(() => planeSeg.removeEventListener('click', onPlane));
    }

    const fixedInput = sliceMount.querySelector<HTMLInputElement>('[data-be-slice-fixed]');
    const fixedOut = sliceMount.querySelector<HTMLElement>('[data-be-slice-out]');
    if (fixedInput) {
      const onInput = (): void => {
        sliceState.fixed = Number(fixedInput.value);
        if (fixedOut) fixedOut.textContent = formatFixed(sliceState.plane, sliceState.fixed);
        refreshSliceDots();
        schedulePaint('draft');
      };
      // `change` fires when the scrub ends (and on a keyboard step) - the moment
      // to spend the full-resolution repaint.
      const onChange = (): void => { onInput(); schedulePaint('full'); };
      fixedInput.addEventListener('input', onInput);
      fixedInput.addEventListener('change', onChange);
      teardowns.push(() => {
        fixedInput.removeEventListener('input', onInput);
        fixedInput.removeEventListener('change', onChange);
      });
    }

    // The plot's box is set by the pane width, which the split divider can drag.
    const plot = sliceMount.querySelector<HTMLElement>('[data-okls-plot]');
    if (plot && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => schedulePaint('full'));
      ro.observe(plot);
      teardowns.push(() => ro.disconnect());
    }

    sliceTeardown = () => { for (const fn of teardowns) fn(); };
    paintSliceChart(sliceMount, sliceState, { quality: 'full' });
  };
  cleanups.push(() => sliceTeardown?.());

  // The Colour chart card folds closed by default, and a hidden mount measures
  // 0×0 - repaint the moment the card opens so the first reveal (and any palette
  // change that happened while it was folded) renders true.
  const chartDetails = $('[data-be-chart]') as HTMLDetailsElement | null;
  const paintChart = (): void => { paintWheel(); paintSlices(); };
  chartDetails?.addEventListener('toggle', () => { if (chartDetails.open) paintChart(); });

  // Wheel ⇄ Gamut. Only the visible chart is mounted: the hidden one would
  // measure 0×0 and paint nothing, and leaving three engine slices' worth of
  // work wired up behind a `hidden` attribute is exactly the kind of cost that
  // never shows up in a profile until the pane is resized.
  const chartSeg = $('[data-be-seg="chartview"]') as HTMLElement | null;
  chartSeg?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-val]'); if (!btn) return;
    const next = btn.dataset.val === 'slices' ? 'slices' : 'wheel';
    if (next === chartView) return;
    chartView = next;
    chartSeg.querySelectorAll<HTMLElement>('[data-val]').forEach(b => b.setAttribute('aria-pressed', String(b === btn)));
    if (wheelMount) wheelMount.hidden = chartView !== 'wheel';
    if (sliceMount) sliceMount.hidden = chartView !== 'slices';
    if (chartView === 'wheel') {
      sliceTeardown?.(); sliceTeardown = undefined;
      if (sliceMount) sliceMount.innerHTML = '';
      paintWheel();
    } else {
      // Seed the plane's fixed channel from the palette's first chromatic
      // colour, so the first switch opens on the brand rather than on hue 30.
      const anchorHex = swatches.find(s => (hexToOklch(s.hex)?.c ?? 0) > 0.02)?.hex ?? swatches[0]?.hex;
      const o = anchorHex ? hexToOklch(anchorHex) : null;
      if (o) sliceState.fixed = sliceFixedOf(sliceState.plane, o);
      paintSlices();
    }
  });

  // ── The post-add chip (plan 137 C1) ─────────────────────────────────────────
  // Adding one colour used to open the full swatch editor on the new tile: the
  // deepest surface in the room as the answer to its shallowest action, and the
  // first thing a first-run visitor met. The chip confirms the colour instead
  // and offers the two things worth doing next - give it the primary role, or
  // open that same editor deliberately. Nothing about the multi-paste chips
  // changes; several colours at once are still announced and nothing else.
  const addedEl = $('[data-be-added]') as HTMLElement | null;
  const addedSw = addedEl?.querySelector<HTMLElement>('[data-be-added-sw]') ?? null;
  const addedNameEl = addedEl?.querySelector<HTMLElement>('[data-be-added-name]') ?? null;
  const addedPrimaryBtn = addedEl?.querySelector<HTMLButtonElement>('[data-be-added-primary]') ?? null;
  const addedTuneBtn = addedEl?.querySelector<HTMLButtonElement>('[data-be-added-tune]') ?? null;
  /** The swatch the visible chip describes, or null when no chip is showing. */
  let addedSwatch: { path: string[]; name: string } | null = null;
  /** Put the chip away. Called by the next add, by Dismiss, by either action
   *  once it has run, and by the host on a room change (closeOverlays). */
  const clearAddedChip = (): void => {
    addedSwatch = null;
    if (addedEl) addedEl.hidden = true;
  };
  /** Hand focus back to the field the add came from. Both actions retire the
   *  chip that holds the pressed button, so without this a keyboard user
   *  restarts from the top of the page (the same hand-off handBackPalFocus
   *  makes for the bulk bar). */
  const focusAddField = (): void => {
    root.querySelector<HTMLElement>('[data-ds-addc-input]')?.focus();
  };
  /**
   * The chip in its "this colour now has the primary role" state - what a press
   * of "Use as primary?" leaves behind, and what the very first colour of all
   * shows straight away (it becomes the primary on arrival, plan 182 section
   * 5.2). One action is left, Fine-tune, and the ✕.
   *
   * The generate handover is NOT here any more. It was a link on this chip,
   * which a dismiss took away with it; it is the `.be-generate-cta` panel now,
   * which is on screen for the whole of beat 1.
   */
  const showPrimarySetChip = (name: string): void => {
    if (addedPrimaryBtn) addedPrimaryBtn.hidden = true;
    if (addedTuneBtn) addedTuneBtn.hidden = false;
    if (addedNameEl) addedNameEl.textContent = tRaw('{role} is now {name}', { role: roleLabel('primary'), name });
    addedTuneBtn?.focus();
  };
  const showAddedChip = (one: { path: string[]; name: string; hex: string }, primarySet = false): void => {
    if (!addedEl || !addedNameEl) return;
    addedSwatch = { path: one.path, name: one.name };
    addedNameEl.textContent = one.name;
    // A previous chip may have ended in the primary-set state (the offer button
    // hidden) - a fresh add starts with both actions back.
    if (addedPrimaryBtn) addedPrimaryBtn.hidden = false;
    if (addedTuneBtn) addedTuneBtn.hidden = false;
    addedSw?.style.setProperty('--sw', one.hex || 'transparent');
    addedEl.hidden = false;
    if (primarySet) showPrimarySetChip(one.name);
    else addedPrimaryBtn?.focus();
  };
  addedEl?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-be-added-dismiss]')) { clearAddedChip(); focusAddField(); return; }
    if (target.closest('[data-be-added-tune]')) {
      const path = addedSwatch?.path ?? null;
      clearAddedChip();       // before the popover opens - it takes focus itself
      openSwatchAt(path);
      return;
    }
    if (!target.closest('[data-be-added-primary]') || !addedSwatch) return;
    // Deliberately UNSCOPED (no theme), for the reason takePrimaryFromLogo
    // states: a colour someone names as their primary is the brand's primary in
    // both themes, unlike surface and text, which each theme inverts.
    const path = addedSwatch.path;
    const name = addedSwatch.name;
    const key = swatches.find(s => s.path.length === path.length && s.path.every((seg, i) => seg === path[i]))?.key;
    if (!key || !assignRole(doc, 'primary', key)) { clearAddedChip(); focusAddField(); return; }
    repaintPalette(); persist(true); playSfx('click');
    // The chip STAYS as a confirmation (plans/163 F3 - retiring the whole row
    // here used to destroy the only handover to Generate). The handover is the
    // `.be-generate-cta` panel now, which the same repaint has just re-titled
    // after this colour, so the chip's remaining job is to say what happened.
    showPrimarySetChip(name);
    announce(tRaw('{role} is now {name}', { role: roleLabel('primary'), name }));
  });

  // ── Level 0: Add a colour ───────────────────────────────────────────────────
  // The module parses; this callback is the only thing that writes. One colour
  // in, one addSwatch out - nothing derived, nothing suggested-into (plan 97 section 3
  // principle 1). Notation is preserved as typed: storageFormatOf maps `#…`→hex,
  // `rgb(…)`→rgb, `hsl(…)`→hsl and everything else to the app's LCH default.
  /**
   * The room's write for "here are n colours" - one `addSwatch` each, one
   * persist for the batch. Returns how many landed.
   *
   * Exposed on the handle as `addColors` (plan 97 section 2b) because it writes into
   * the doc THIS editor is holding. A caller that keeps its own snapshot of the
   * installed document and writes into that instead would reinstall the snapshot
   * - silently reverting every edit made in the room since it was taken. There
   * is one live document; this is the way in.
   *
   * `reveal` is the room's own affordance (confirm the new swatch, announce it)
   * and belongs to a press made IN the room. A tray add announces for itself
   * from the panel the press happened in, and must not put a chip in the Add
   * hero for a colour that was added somewhere else.
   */
  const addColorEntries = (entries: ColorEntry[], reveal = false, group?: string): number => {
    if (entries.length) pushUndo(t('Add colours'));
    // Was this room empty of the person's own colour before the add? That is
    // what makes the next line the FIRST colour, and the first colour becomes
    // the primary (plan 182 section 5.2) - it is what nine people in ten mean
    // by it, and asking would be asking about a decision already made.
    const wasEmpty = ownColorCount() === 0;
    const added: Array<{ path: string[]; name: string; hex: string }> = [];
    for (const e of entries) {
      // The picker card names the colour it committed; a scan of pasted text
      // has no name to report, so the room's own namer answers for those.
      const name = e.name?.trim() || nameColor(e.hex);
      const path = addSwatch(doc, 'custom', name, serializeColor(e.hex, storageFormatOf(e.value)), group ? { displayGroup: group } : {});
      if (path) added.push({ path, name, hex: e.hex });
    }
    if (!added.length) return 0;
    // Deliberately UNSCOPED (no theme), for the reason the chip's own "Use as
    // primary?" is: a colour someone names as their primary is the primary in
    // both themes, unlike surface and text, which each theme inverts.
    const first = added[0]!;
    const firstKey = walkSwatches(doc, currentTheme)
      .find(s => s.path.length === first.path.length && s.path.every((seg, i) => seg === first.path[i]))?.key;
    const tookPrimary = !!(wasEmpty && added.length === 1 && firstKey && assignRole(doc, 'primary', firstKey));
    repaintPalette(); persist(true); playSfx('click');
    if (reveal) {
      clearAddedChip();   // one chip at a time: the previous add has had its answer
      if (added.length === 1) {
        showAddedChip(first, tookPrimary);
        announce(tookPrimary
          ? tRaw('{role} is now {name}', { role: roleLabel('primary'), name: first.name })
          : tRaw('{name} added', { name: first.name }));
      } else {
        announce(tRaw('{n} colours added', { n: added.length }));
      }
    }
    return added.length;
  };

  const addColorMount = $('[data-be-addcolor]') as HTMLElement | null;
  if (addColorMount) {
    const teardownAdd = mountAddColor(addColorMount, {
      t: (source, params) => (params ? tRaw(source, params) : t(source)),
      onAdd: (entries: ColorEntry[]) => { addColorEntries(entries, true); },
      // The chip opens the studio's OWN swatch card in pick mode (plan 182
      // section 5.1) - the same OKLCH picker a tile opens, with Add colour as
      // its footer instead of Delete/Save. One picker in the room, not two.
      onOpenPicker: (anchor, current) => { openPickCard(anchor, current); },
      // "From an image" is the studio's existing image source, reached through
      // the host rather than re-implemented: sample → colour cloud → census →
      // tray, exactly as the source picker's image tile does it. Without a host
      // that offers it, the button is not rendered at all.
      onImageFile: opts.scanImage ? (file: File) => { opts.scanImage?.(file); } : undefined,
    });
    cleanups.push(teardownAdd);
  }
  /** The add row's field, the one place the pick card writes its live value. */
  const addField = (): HTMLInputElement | null => root.querySelector<HTMLInputElement>('[data-ds-addc-input]');
  /**
   * Beat 0 spells the notations out in full under a 72px chip; the compact row
   * keeps the short sentence, because by then the person has done this once.
   * The example values stay untranslated (they are values, not prose).
   */
  function syncAddPlaceholder(): void {
    const field = addField();
    if (!field) return;
    field.placeholder = beat === 0
      ? `${t('Paste a colour')} · ${COLOR_NOTATION_EXAMPLES}`
      : t('Paste a colour, or a list');
  }
  // "Or bring a file" - beat 0's one alternative door, opening the host's own
  // source picker (the same one the rail's "Add from…" opens).
  root.querySelector('[data-be-beat0-file]')?.addEventListener('click', () => { opts.openImport?.(); });

  paletteHooks.push(syncPrintWing);

  // ── Roles as an assignment layer ────────────────────────────────────────────
  // The strip reads the doc and writes through assignRole/clearRole; every
  // repaint re-reads it, so an add, a delete, a Replace or an undo all land.
  const rolesMount = $('[data-be-roles]') as HTMLElement | null;
  /** The theme the strip is reading, and therefore the ONE it may write. A
   *  derived doc's light and dark roles are deliberately inverted (surface is
   *  the lightest neutral in one and the darkest in the other), so an unscoped
   *  write from here would overwrite dark mode with the light theme's choices. */
  const roleTheme = (): string => (currentTheme === 'dark' ? 'dark' : 'light');
  /** A swatch key's display name, for the announcements. */
  const nameOfKey = (key: string): string => swatches.find(s => s.key === key)?.name ?? key;
  // Every non-role swatch is assignable, INCLUDING the starter's neutrals -
  // Surface and Text want paper and ink, and pointing at them on purpose is a
  // real decision. What the flag buys is the picker filing them under their own
  // "Starter" heading, and the strip painting a role that sits on one in the
  // muted register (plan 182 section 4.2).
  const roleSwatchOptions = (): Array<{ key: string; name: string; hex: string; group?: string; starter?: boolean }> =>
    swatches.filter(s => s.hex && s.kind !== 'semantic')
      .map(s => ({ key: s.key, name: s.name, hex: s.hex, group: s.group, starter: isStarterSwatch(s) }));
  const rolesStrip = rolesMount ? mountRolesStrip(rolesMount, {
    doc: () => doc as Record<string, unknown>,
    theme: roleTheme,
    // Four slots until there is a palette, then every slot a tool can read
    // (plan 182 section 5.7 step 1). Seven rows in front of somebody who has
    // just added their first colour is a form; four is a strip.
    ids: () => (beat >= 2 ? ROLE_IDS_ALL : ROLE_IDS),
    resolve: (key) => {
      try { return createTokenSet(doc, { theme: roleTheme() }).resolve(key); }
      catch { return null; }
    },
    swatches: roleSwatchOptions,
    // Both callbacks report what actually happened: a refused write (a document
    // the role can't land in) re-renders the strip so the picker snaps back to
    // the truth, rather than persisting nothing and announcing success.
    assign: (role, key) => {
      if (!assignRole(doc, role, key, roleTheme())) { rolesStrip?.render(); return; }
      repaintPalette(); persist(true);
      announce(tRaw('{role} is now {name}', { role: roleLabel(role), name: nameOfKey(key) }));
    },
    clear: (role) => {
      // A removal: clearing `primary` deletes the token the app's own accent
      // reads, and nothing on screen holds the swatch it pointed at. Snapshot
      // first, and drop it again if there turned out to be nothing to remove.
      pushUndo(tRaw('Clear {role}', { role: roleLabel(role) }));
      if (!clearRole(doc, role, roleTheme())) { undoStack.pop(); rolesStrip?.render(); return; }
      repaintPalette(); persist(true);
      announce(tRaw('{role} is not set', { role: roleLabel(role) }));
    },
  }) : null;
  paletteHooks.push(() => rolesStrip?.render());

  // The swatch popover's "Use as" row - the same assignment, reached from the
  // colour itself. A pressed button means "this swatch IS that role", so
  // pressing it again clears the role rather than re-writing it.
  const useasRow = editorEl?.querySelector<HTMLElement>('[data-be-useas]') ?? null;
  const renderUseAs = (): void => {
    if (!useasRow) return;
    const cur = selected >= 0 ? swatches[selected] : null;
    useasRow.hidden = !cur || cur.kind === 'semantic';
    if (useasRow.hidden || !cur) return;
    const held = readRoles(doc, roleTheme());
    useasRow.querySelectorAll<HTMLElement>('[data-be-useas]').forEach(b => {
      const role = b.dataset.beUseas as RoleId | undefined;
      b.setAttribute('aria-pressed', String(!!role && held[role]?.ref === cur.key));
    });
  };
  useasRow?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-be-useas]');
    const role = btn?.dataset.beUseas as RoleId | undefined;
    if (!role || selected < 0) return;
    const cur = swatches[selected]; if (!cur || cur.kind === 'semantic') return;
    const key = cur.key;
    const wasSet = btn!.getAttribute('aria-pressed') === 'true';
    // Un-pressing REMOVES the role (the strip's Clear by another door), so it
    // takes the same snapshot; assigning is not destructive and does not. The
    // snapshot is dropped again if the write turned out to change nothing.
    if (wasSet) pushUndo(tRaw('Clear {role}', { role: roleLabel(role) }));
    const wrote = wasSet ? clearRole(doc, role, roleTheme()) : assignRole(doc, role, key, roleTheme());
    if (!wrote) {
      if (wasSet) undoStack.pop();
      renderUseAs(); // the button's pressed state describes the doc, not the tap
      return;
    }
    // repaintPalette rebuilds the grid, so re-find the tile the popover is on.
    const path = cur.path;
    repaintPalette(); persist(true); playSfx('click');
    const idx = swatches.findIndex(s => s.path.length === path.length && s.path.every((seg, i) => seg === path[i]));
    if (idx >= 0) { selected = idx; refreshTile(idx); }
    renderUseAs();
    announce(wasSet
      ? tRaw('{role} is not set', { role: roleLabel(role) })
      : tRaw('{role} is now {name}', { role: roleLabel(role), name: cur.name }));
  });

  // Which of these colours came with the blank brand rather than from a person
  // (plan 137 C3). AWAITED before the first paint, unlike the fire-and-forget
  // read it replaced: the beat is decided on the own count, and a room that
  // painted first and learned second would show a first-time visitor the whole
  // studio for one frame and then collapse it to a single control. The read is
  // one IDB hit plus a JSON parse, in a mount that already awaits three.
  // starterColorIds walks BOTH themes, because a role's stored value differs
  // between them and either spelling is equally a starter one.
  try {
    const starterDoc = await readStarterDoc(host);
    const pairs = starterDoc ? starterColorIds(starterDoc) : new Set<string>();
    if (pairs.size) starterSwatches = pairs;
  } catch { /* no starter reachable - the palette claims nothing */ }

  repaintPalette();

  // ── Type (the Type room, plan 97 section 7.2) ───────────────────────────────────────
  // Three layers, top to bottom: the four ROLE CARDS (level 0 - what serves each
  // role, and the one action that changes it), the COMPARE STAGE they open (six
  // faces at one size on one specimen; nothing installs until a card is chosen),
  // and the MANAGEMENT LIST of everything already on the device (roles, delete).
  // The stage is presentation only - type-compare.ts installs nothing and this
  // file owns every write, which is why `applyTypeChoice` below is the single
  // place a face becomes an asset and a token.
  const fontErr = $('[data-be-font-err]') as HTMLElement | null;
  const showFontErr = (m: string): void => { if (fontErr) { fontErr.textContent = m; fontErr.hidden = !m; } if (m) announce(m, { assertive: true }); };
  let fontFamilies: UserFontFamily[] = [];
  let monoFamily = '';    // the font.mono role's family, '' when the platform default serves
  let displayFamily = ''; // the font.display (h1/h2 heading) role's family
  let italicFamily = '';  // the font.italic role's family
  let brandFace = '';     // what the primary role RESOLVES to (a starter face counts)
  /**
   * Which faces are the person's own and which came with the app - one read of
   * ownership.ts per paintFonts, and the cards, the rows, the specimen and the
   * BEAT all print from it. Before it says otherwise every role reads `unset`,
   * which is the honest resting state: nothing has been read yet.
   */
  let faces: Record<FontRole, FaceState> = blankFaces();
  /** 0 = no face of its own (one card, one decision), 1 = the room. Named for
   *  its room: the Colours room keeps its own beat in this same mount scope. */
  let typeRoomBeat: TypeBeat = 0;
  /** The role the open stage is choosing for, and whether one is open at all.
   *  Held here rather than read off the stage block below, which is declared
   *  after the paints that need it. */
  let choosingRole: FontRole | null = null;
  let stageOpen = false;
  const typePanel = $('[data-be-tab-panel="type"]') as HTMLElement | null;
  const typeCardsPanel = $('[data-be-typecards-panel]') as HTMLElement | null;
  // One optional face-role chip: an active badge, or a button to assign the role.
  const roleControl = (family: string, active: boolean, activeLabel: string, badgeMod: string, dataAttr: string, assignLabel: string, assignTitle: string): string =>
    active
      ? `<span class="be-font-badge be-font-badge--${badgeMod}">${activeLabel}</span>`
      : `<button type="button" class="be-btn be-font-role" ${dataAttr}="${escape(family)}" title="${escape(assignTitle)}">${assignLabel}</button>`;
  /** A face of the design system's own. Every row in this list is one - the
   *  starter's faces are never rows, they are the fold below - so `is-own` is
   *  the tint every row wears and the green PRIMARY badge is earned by the one
   *  that serves the primary role (plan 182 section 4.2). */
  const fontRow = (f: UserFontFamily): string => {
    return `
    <li class="be-font-row is-own" data-font-family="${escape(f.family)}">
      <span class="be-font-aa" style="font-family:'${escape(f.family)}'" aria-hidden="true">Aa</span>
      <span class="be-font-meta"><span class="be-font-name" style="font-family:'${escape(f.family)}'">${escape(f.family)}</span>
        <span class="be-font-sub">${escape(f.weights)} · ${fmtBytes(f.bytes)}</span></span>
      <span class="be-font-roles">
      ${f.primary ? `<span class="be-font-badge">${t('Primary')}</span>`
        : `<button type="button" class="be-btn be-font-mp" data-mp="${escape(f.family)}">${t('Make primary')}</button>`}
      ${roleControl(f.family, f.family === displayFamily, t('Headings'), 'display', 'data-display', t('Use for headings'), tRaw('Use {family} for h1/h2 headings', { family: f.family }))}
      ${roleControl(f.family, f.family === monoFamily, t('Code'), 'mono', 'data-mono', t('Use for code'), tRaw('Use {family} for code & data', { family: f.family }))}
      ${roleControl(f.family, f.family === italicFamily, t('Italic'), 'italic', 'data-italic', t('Use for italic'), tRaw('Use {family} for italic text', { family: f.family }))}
      </span>
      <button type="button" class="be-font-del" data-del="${escape(f.family)}" aria-label="${escape(tRaw('Remove {family}', { family: f.family }))}">&#x2715;</button>
    </li>`;
  };
  // The list of everything the person themself installed, plus one folded row
  // for what the app shipped. Two registers, one list (plan 182 section 6.5):
  // an own face is a row with its roles and a delete; the starter's faces are a
  // fold that says which roles they are serving until somebody chooses.
  const joinWords = (items: readonly string[]): string =>
    items.length <= 1
      ? (items[0] ?? '')
      : `${items.slice(0, -1).join(', ')} ${t('and')} ${items[items.length - 1]}`;
  const starterFoldHtml = (): string => {
    // family -> the roles it is serving, in the order the room shows them.
    const served = new Map<string, string[]>();
    for (const role of FONT_ROLES) {
      const face = faces[role];
      if (face.state !== 'inherited' || !face.family) continue;
      const list = served.get(face.family) ?? [];
      list.push(typeRoleLabel(role));
      served.set(face.family, list);
    }
    if (!served.size) return '';
    const summary = t('{families} · serving {roles} until you choose', {
      families: [...served.keys()].join(', '),
      roles: joinWords([...served.values()].flat()),
    });
    const rows = [...served.entries()].map(([family, roles]) => `
      <div class="be-font-row be-font-row--starter">
        <span class="be-font-aa" style="font-family:'${escape(family)}'" aria-hidden="true">Aa</span>
        <span class="be-font-meta"><span class="be-font-name">${escape(family)}</span>
          <span class="be-font-sub">${t('Serving {roles}', { roles: joinWords(roles) })}</span></span>
      </div>`).join('');
    return `
    <li class="be-font-starter">
      <details class="be-subst-details be-font-starterfold">
        <summary><span class="be-pal-starter">${t('Starter')}</span><span class="be-font-startersum">${summary}</span></summary>
        <div class="be-font-starterbody">${rows}</div>
      </details>
    </li>`;
  };
  // The live specimen (Type roles panel): each role rendered in the face that
  // actually serves it - --font-brand / --font-mono, whatever set them.
  /** The face under a specimen block: the family plus the state it is in, so the
   *  same face can appear three times without three of them looking chosen
   *  (plan 182 T2). Text - it is escape()d into the sink below. */
  const specimenWho = (role: FontRole): string => {
    const face = faces[role];
    const family = face.family;
    if (face.state === 'own') return family;
    if (face.state === 'inherited') return family ? `${family} · ${t('starter')}` : t('starter');
    if (face.state === 'follows') return family ? `${family} · ${t('follows Primary')}` : t('follows Primary');
    return collapsedFaceText(role, face, tRaw);
  };
  const paintSpecimen = (): void => {
    const mount = $('[data-be-specimen]') as HTMLElement | null; if (!mount) return;
    if (!root.isConnected) return;
    mount.innerHTML = `
      <div class="be-typerole">
        <span class="be-typerole-role">${t('Heading (h1/h2)')}</span>
        <span class="be-typerole-sample be-typerole-sample--h" style="font-family:var(--font-display, var(--font-brand))">${t('Pack my box with five dozen liqueur jugs')}</span>
        <span class="be-typerole-face">${escape(specimenWho('display'))}</span>
      </div>
      <div class="be-typerole">
        <span class="be-typerole-role">${t('Body')}</span>
        <span class="be-typerole-sample" style="font-family:var(--font-brand)">${t('Every tool, page and export follows the primary face - headings, body copy and UI alike. Sub-heading, call-to-action and italic roles arrive here as tokens tools can read.')}</span>
        <span class="be-typerole-face">${escape(specimenWho('brand'))}</span>
      </div>
      <div class="be-typerole">
        <span class="be-typerole-role">${t('Italic')}</span>
        <span class="be-typerole-sample" style="font-family:var(--font-italic, var(--font-brand));font-style:italic">${t('Emphasis, quotations and asides wear the italic face.')}</span>
        <span class="be-typerole-face">${escape(specimenWho('italic'))}</span>
      </div>
      <div class="be-typerole">
        <span class="be-typerole-role">${t('Code &amp; data')}</span>
        <span class="be-typerole-sample be-typerole-sample--mono" style="font-family:var(--font-mono)">lolly qr-code --url=https://example.com --export=svg</span>
        <span class="be-typerole-face">${escape(specimenWho('mono'))}</span>
      </div>`;
  };
  /**
   * The four role cards (level 0), updated IN PLACE - every dynamic string is
   * written as textContent onto nodes the scaffold already built. Deliberately
   * not a re-render: a repaint that replaced the cards would take the keyboard
   * off the button that caused it, and no family name would then be a step away
   * from a markup sink. The specimen itself needs no touching at all - it paints
   * through the role's CSS var, which applyChromeBrandVars has already moved.
   *
   * The card says which of four states its face is in (plan 182 section 4.2):
   * `is-own` is the tint, and it is earned only by a face the person installed -
   * an inherited one wears the Starter pill instead, a following one draws the
   * arrow and the role it follows. The button reads "Change" only on an own
   * face, because everything else is still a first choice.
   */
  const paintRoleCards = (): void => {
    const grid = $('[data-be-typecards]') as HTMLElement | null;
    if (!grid || !root.isConnected) return;
    typeCardsPanel?.toggleAttribute('data-collapsed', stageOpen);
    for (const def of TYPE_ROLES) {
      const card = grid.querySelector<HTMLElement>(`[data-be-typecard="${def.id}"]`);
      if (!card) continue;
      const face = faces[def.id];
      const own = face.state === 'own';
      card.classList.toggle('is-own', own);
      card.classList.toggle('is-choosing', choosingRole === def.id);
      // tRaw, not t: these are written with textContent, so a family with an
      // ampersand in it must arrive as the ampersand (see type-compare.ts's
      // note on the two translators).
      const line = faceLine(def.id, face, tRaw);
      const faceEl = card.querySelector<HTMLElement>('[data-be-typecard-face]');
      if (faceEl) faceEl.textContent = line.text;
      const tagEl = card.querySelector<HTMLElement>('[data-be-typecard-tag]');
      if (tagEl) { tagEl.textContent = line.tag; tagEl.hidden = !line.tag; }
      const chipEl = card.querySelector<HTMLElement>('[data-be-typecard-chip]');
      if (chipEl) chipEl.textContent = collapsedFaceText(def.id, face, tRaw, choosingRole === def.id);
      // The label and the accessible name move together - see typeRoleActStrings.
      const act = typeRoleActStrings(typeRoleLabel(def.id), own);
      const actEl = card.querySelector<HTMLElement>('[data-be-typecard-actlabel]');
      if (actEl) actEl.textContent = act.text;
      const btn = card.querySelector<HTMLElement>('[data-be-typecard-choose]');
      btn?.setAttribute('aria-label', act.name);
      // Beat 0's one card carries the room's only decision, so its button is the
      // filled primary rather than the outline every card wears at beat 1. A
      // class swap, not a second fill recipe (buttons.css owns the fill).
      const hero = typeRoomBeat === 0 && def.id === 'brand';
      btn?.classList.toggle('be-cta', hero);
      btn?.classList.toggle('be-btn', !hero);
    }
  };
  const paintFonts = async (): Promise<void> => {
    const list = $('[data-be-fonts]') as HTMLElement | null; if (!list) return;
    fontFamilies = await listUserFonts(fontsHost).catch(() => []);
    monoFamily = await monoFontFamily(fontsHost).catch(() => '');
    displayFamily = await displayFontFamily(fontsHost).catch(() => '');
    italicFamily = await italicFontFamily(fontsHost).catch(() => '');
    brandFace = await primaryFontFamily(fontsHost).catch(() => '');
    const liveDoc = await tokens?.raw().catch(() => null) ?? null;
    if (!root.isConnected) return;
    // FACES ONLY. Two empty palette halves are what stop the read walking both
    // documents for an answer this room never asks for; face state does not
    // consult the starter document at all, since a declared family is the
    // person's own when it names a face installed HERE and inherited otherwise
    // (ownership.ts, `faceState`).
    const report = reportOwnership({
      doc: liveDoc,
      starterDoc: null,
      palette: { colors: [], starter: [] },
      userFontFamilies: fontFamilies.map(f => f.family),
      resolvedFaces: { brand: brandFace, display: displayFamily, mono: monoFamily, italic: italicFamily },
    });
    faces = report.faces;
    // An installed face with no role still needs its row, so the count of
    // families is part of the question - see beats-type.ts.
    typeRoomBeat = typeBeat(report, fontFamilies.length);
    typePanel?.setAttribute('data-be-beat', String(typeRoomBeat));
    const rows: string[] = [];
    if (fontFamilies.length) rows.push(`<li class="be-font-glabel" role="presentation">${t('In the design system')}</li>`);
    rows.push(...fontFamilies.map(fontRow));
    const fold = starterFoldHtml();
    rows.push(fold);
    if (!fontFamilies.length && !fold) rows.push(`<li class="be-font-empty">${t('No fonts added yet. Choose a face on a card above.')}</li>`);
    list.innerHTML = rows.join('');
    paintSpecimen();
    paintRoleCards();
    // A stage opened from a cold `?focus=stage` mount painted its pinned chips
    // before these faces resolved, so the starter's own SUSE and SUSE Mono were
    // offered as things to add. The faces are known now: repaint the row.
    if (stageOpen) paintStagePins();
  };
  void paintFonts();
  // ── The compare stage (plan 97 section 7.2) ────────────────────────────────────────
  // type-compare.ts renders candidates side by side and installs NOTHING; this
  // block owns opening it, seeding it, persisting a choice and closing it.
  //
  // NETWORK HONESTY. Google Fonts is the one egress in the studio and it stays
  // behind the same one-time consent it always was: `ensureGoogleFontsConsent`
  // is handed to the stage as its gate, so a PREVIEW asks exactly as an install
  // used to. Fetching a Google Font sends the family name and, unavoidably, the
  // user's IP address to Google, which is a third-party transfer they get to
  // refuse. (A German court has awarded damages over exactly this transfer:
  // LG München I, 3 O 17493/20.) Nothing else here reaches the network.
  const stageEl = $('[data-be-typestage]') as HTMLElement | null;
  const stageMount = $('[data-be-typestage-mount]') as HTMLElement | null;
  const stageTitleEl = $('[data-be-typestage-title]') as HTMLElement | null;
  const stageQ = $('[data-be-typestage-q]') as HTMLInputElement | null;
  const stageErr = $('[data-be-typestage-err]') as HTMLElement | null;
  let stage: TypeCompare | null = null;
  // Which role the open stage is choosing for lives in `choosingRole`, declared
  // up with the paints - they read it on every repaint to tint the card that is
  // choosing and to write "choosing…" into its collapsed pill. Null = the Fonts
  // panel's "Add a face": the face installs and takes no role beyond the
  // only-font promotion every install has always done.
  /** The control the stage was opened from - where the keyboard goes when it
   *  closes, however it closes. */
  let stageReturn: HTMLElement | null = null;
  /** Lowercased family → the tray candidate that put it on the stage, so a
   *  chosen face stops being pending in the tray instead of being offered again
   *  next week. */
  const stageFromTray = new Map<string, string>();
  /** How many tray faces the stage opens with. Six cards fit; the point of the
   *  stage is the comparison the person is making, so a source's finds seed it
   *  without filling it. */
  const TRAY_SEED_MAX = 3;

  /** The stage's own error line. Written, never announced: the stage announces
   *  the outcome of a press itself, and two polite messages for one action is
   *  one too many. This carries the REASON the stage's own sentence cannot. */
  const setStageErr = (m: string): void => {
    if (!stageErr) return;
    stageErr.textContent = m;
    stageErr.hidden = !m;
  };

  /** The stage's seat when nothing is open: the scaffold position, straight
   *  after the cards panel. Both halves are remembered, because appending to the
   *  parent would park it after the Fonts panel instead. */
  const stageHome = stageEl?.parentElement ?? null;
  const stageHomeNext = stageEl?.nextElementSibling ?? null;
  /**
   * Move the stage under the card that opened it (plan 182 section 6.6). It
   * becomes a full-width item of the card grid, so at any column count it sits
   * on the row below its own card rather than below all four - which on a phone
   * was a stage a screen and a half down (T7).
   *
   * Two cases go back to the seat instead: the Fonts panel's "Add a face",
   * which no card owns, and any width where the collapsed strip is a sideways
   * scroller (≤640px) - a stage inside a scroller would be off to the right of
   * the pills rather than under them.
   */
  const narrowStrip = (): boolean => {
    try { return !!root.ownerDocument.defaultView?.matchMedia('(max-width: 640px)').matches; }
    catch { return false; }
  };
  const placeStage = (): void => {
    if (!stageEl) return;
    const grid = $('[data-be-typecards]') as HTMLElement | null;
    const after = choosingRole && grid && !narrowStrip()
      ? grid.querySelector<HTMLElement>(`[data-be-typecard="${choosingRole}"]`)
      : null;
    if (after) after.insertAdjacentElement('afterend', stageEl);
    else if (stageHome && stageEl.parentElement !== stageHome) stageHome.insertBefore(stageEl, stageHomeNext);
  };

  /** Close the stage. Always a cancel: nothing is installed on the way out, and
   *  every preview registration goes with it (type-compare.ts's teardown). */
  const closeStage = (opts: { restoreFocus?: boolean } = {}): void => {
    const open = stage;
    stage = null;
    choosingRole = null;
    stageOpen = false;
    stageFromTray.clear();
    open?.teardown();
    if (stageEl) stageEl.hidden = true;
    setStageErr('');
    // The cards come back BEFORE the keyboard does: the control we are handing
    // focus to is a card button, and a display:none button cannot take it.
    placeStage();
    paintRoleCards();
    const back = stageReturn;
    stageReturn = null;
    // Never let a close drop the keyboard on <body>.
    if (open && opts.restoreFocus !== false && back?.isConnected) back.focus();
  };
  cleanups.push(() => closeStage({ restoreFocus: false }));
  // A width change while the stage is open moves it: under its card on a wide
  // screen, after the strip on a narrow one. Without this, rotating a phone
  // leaves the stage inside a sideways scroller.
  try {
    const mq = root.ownerDocument.defaultView?.matchMedia('(max-width: 640px)');
    const onWidth = (): void => { if (stageOpen) placeStage(); };
    mq?.addEventListener('change', onWidth);
    cleanups.push(() => mq?.removeEventListener('change', onWidth));
  } catch { /* no matchMedia - the stage keeps its seat, which works at any width */ }

  /**
   * Persist one stage choice. The stage hands over a candidate and this decides
   * the rail: a Google pick through `installGoogleFont`, a file through
   * `installFontFromBytes` (plan 97 section 4 gap 3 - the second entrance into the role
   * system), then the role that OPENED the stage is assigned through the same
   * withFontRoleToken writers the list rows use.
   *
   * Throwing is meaningful: the stage keeps the card standing and says the press
   * failed, so it can be tried again. The reason lands under the stage.
   */
  const applyTypeChoice = async (choice: CompareChoice): Promise<void> => {
    const role = choosingRole;
    setStageErr('');
    let family = '';
    try {
      if (choice.install === 'google') {
        // `primary: true` only for the Primary card. Every other role still gets
        // installGoogleFont's standing only-font promotion, which is the right
        // answer when there is no primary yet.
        const fam = await installGoogleFont(fontsHost, choice.family, role === 'brand' ? { primary: true } : {});
        family = fam.family;
      } else if (choice.bytes) {
        const fam = await installFontFromBytes(fontsHost, choice.bytes, {
          ...(choice.label ? { filename: choice.label } : {}),
          ...(role === 'brand' ? { makePrimary: true } : {}),
        });
        // installFontFromBytes returns null rather than throwing for bytes it
        // will not take, because its other callers are multi-file drop zones
        // where one bad file must not abandon the rest. Here there is one file
        // and one deliberate press, so a refusal is an error to show.
        if (!fam) throw new Error(t('That font file could not be installed.'));
        family = fam.family;
      } else {
        throw new Error(t('That candidate has no face to install.'));
      }
      if (role === 'display') await setDisplayFont(fontsHost, family);
      else if (role === 'mono') await setMonoFont(fontsHost, family);
      else if (role === 'italic') await setItalicFont(fontsHost, family);
    } catch (err) {
      setStageErr(String((err as { message?: unknown })?.message ?? err));
      throw err;
    }
    // The tray candidate that put this face on the stage has been shopped.
    const trayId = stageFromTray.get(choice.family.trim().toLowerCase());
    if (trayId) {
      try {
        const handle = await trayHandle();
        // Re-read before writing. The candidate list is one host.state record and
        // the studio view holds its OWN Tray over it (views/start.ts's rail
        // panel), so a write from a stale in-memory copy would drop whatever it
        // has done since. This narrows that window to the write itself; it does
        // not close it, which is a two-instances problem and not this room's.
        await handle?.load();
        await handle?.markAdded(trayId);
      } catch { /* the tray is a convenience; it never fails an install */ }
    }
    playSfx('saveProfile');
    await paintFonts();
    notify('type');
    announce(role
      ? tRaw('{family} now serves {role}', { family, role: typeRoleLabel(role) })
      : tRaw('Added {family}', { family }));
    closeStage();
  };

  /** Font candidates a source scan left in the tray, put on the stage with their
   *  provenance. A face discovered in a document arrives spelled its own way
   *  ("ABCDEF+Inter-SemiBold"); font-resolve.ts resolves the whole spelling
   *  first and the parsed family second, which is the order its tests pin. An
   *  unresolvable family is still offered - the stage says honestly that it has
   *  no source for it, which beats hiding a face the person's own file names. */
  const seedStageFromTray = async (): Promise<void> => {
    const open = stage;
    const handle = await trayHandle();
    if (!handle) return;
    await handle.load().catch(() => {}); // freshest list - see applyTypeChoice
    // The stage may have been closed or replaced while that was in flight.
    if (!open || open !== stage) return;
    const pending = handle.list()
      .filter(c => c.type === 'font' && c.state === 'pending')
      .slice(0, TRAY_SEED_MAX);
    for (const c of pending) {
      const resolved = googleMatch(c.value) ?? googleMatch(parseFaceName(c.value).family) ?? c.value;
      const spelled = c.value.trim();
      stageFromTray.set(resolved.trim().toLowerCase(), c.id);
      open.addCandidate({
        kind: 'tray',
        family: resolved,
        ...(resolved.trim().toLowerCase() === spelled.toLowerCase() ? {} : { label: spelled }),
        provenance: c.provenance.label,
      });
    }
  };

  /**
   * The pinned families, as one-press previews (plan 182 section 6.4).
   *
   * Built with DOM calls rather than markup: the only value that varies is a
   * family NAME, which never needs to be markup, and textContent keeps it out of
   * a sink altogether. Families already serving a role are dropped by
   * `pinnedFaces` - a chip offering the face you are already wearing previews
   * nothing.
   */
  const paintStagePins = (): void => {
    const wrap = $('[data-be-typestage-pins]') as HTMLElement | null;
    const row = $('[data-be-typestage-pinrow]') as HTMLElement | null;
    if (!wrap || !row) return;
    // Every family a role RESOLVES to counts as taken, the starter's included:
    // the ownership report is the settled answer, the four locals are the same
    // reads one paint earlier, and both are listed so a stage opened before
    // paintFonts resolved still skips whatever is already on a card.
    const taken = [
      ...fontFamilies.map(f => f.family),
      ...Object.values(faces).map(f => f.family),
      brandFace, displayFamily, monoFamily, italicFamily,
    ];
    const families = pinnedFaces(PINNED_FAMILIES, taken);
    row.replaceChildren(...families.map((family) => {
      const chip = row.ownerDocument.createElement('button');
      chip.type = 'button';
      chip.className = 'be-btn be-typestage-pin';
      chip.dataset.bePin = family;
      chip.textContent = family;
      return chip;
    }));
    wrap.hidden = families.length === 0;
  };

  const openStage = (role: FontRole | null, opener: HTMLElement | null): void => {
    if (!stageEl || !stageMount) return;
    closeStage({ restoreFocus: false }); // one stage, one decision
    choosingRole = role;
    stageOpen = true;
    stageReturn = opener;
    stageEl.hidden = false;
    // The cards fold to a one-line strip and the stage takes their place under
    // the one being chosen for, so the decision and its subject are on the same
    // screen at every width (plan 182 section 6.6).
    placeStage();
    paintRoleCards();
    paintStagePins();
    if (stageTitleEl) {
      stageTitleEl.textContent = role
        ? tRaw('Choose the {role} face', { role: typeRoleLabel(role) })
        : t('Compare faces');
    }
    stage = mountTypeCompare(stageMount, {
      host: host as unknown as HostV1,
      t,
      tRaw,
      consentGoogle: ensureGoogleFontsConsent,
      onSelect: applyTypeChoice,
    });
    // Into the stage, on its first control: opening a panel from a press has to
    // move the keyboard with it.
    if (stageQ) { stageQ.value = ''; stageQ.focus(); }
    stageEl.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    void seedStageFromTray();
  };

  $('[data-be-typecards]')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-be-typecard-choose]');
    const role = btn?.dataset.beTypecardChoose as FontRole | undefined;
    if (!btn || !role) return;
    openStage(role, btn);
  });
  // Beat 0's disclosure: the other three roles, revealed for good. No state is
  // stored - a fresh mount is a fresh first decision - and once the room is at
  // beat 1 the sentence and its button are gone anyway.
  $('[data-be-typemore-toggle]')?.addEventListener('click', () => {
    typePanel?.setAttribute('data-be-more', 'on');
    announce(t('Headings, code and italic are now on the page.'));
  });
  $('[data-be-typestage-pinrow]')?.addEventListener('click', (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-be-pin]');
    const family = chip?.dataset.bePin;
    if (!family || !stage) return;
    // Exactly what the search field's Preview does, minus the typing: one press
    // admits the card AND starts its load, and the consent dialog is what that
    // press asks (plan 182 section 6.4).
    stage.addCandidate({ kind: 'google', family });
  });
  $('[data-be-font-compare]')?.addEventListener('click', (e) => {
    openStage(null, e.currentTarget as HTMLElement);
  });
  $('[data-be-typestage-close]')?.addEventListener('click', () => closeStage());
  $('[data-be-typestage-search]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const family = stageQ?.value.trim();
    if (!family || !stage) return;
    // A PREVIEW, not an install. The card appears already loading: the stage's
    // own `add()` starts it, and the consent dialog fires from inside that load,
    // so this one press is the press that asks (plan 182 section 6.1). Nothing
    // is stored until "Use this face".
    stage.addCandidate({ kind: 'google', family });
    if (stageQ) { stageQ.value = ''; stageQ.focus(); }
  });
  stageEl?.addEventListener('keydown', (e) => {
    if ((e as KeyboardEvent).key !== 'Escape' || !stage) return;
    // Cancel, never commit. The specimen field answers Escape only while it has
    // an edit to cancel (it reverts the text and stops the key there); with
    // nothing to cancel the key bubbles to here and closes the stage, so the
    // field the stage opens on is not a place Escape stops working.
    e.stopPropagation();
    closeStage();
  });
  $('[data-be-fonts]')?.addEventListener('click', async (e) => {
    const mp = (e.target as Element).closest<HTMLButtonElement>('[data-mp]');
    if (mp) { mp.disabled = true; try { await setPrimaryFont(fontsHost, mp.dataset.mp!); await paintFonts(); notify('type'); announce(tRaw('{family} is now your primary font', { family: mp.dataset.mp ?? '' })); } catch (err) { mp.disabled = false; showFontErr(String((err as { message?: unknown })?.message ?? err)); } return; }
    const mono = (e.target as Element).closest<HTMLButtonElement>('[data-mono]');
    if (mono) { mono.disabled = true; try { await setMonoFont(fontsHost, mono.dataset.mono!); await paintFonts(); notify('type'); announce(tRaw('{family} now serves code & data', { family: mono.dataset.mono ?? '' })); } catch (err) { mono.disabled = false; showFontErr(String((err as { message?: unknown })?.message ?? err)); } return; }
    const disp = (e.target as Element).closest<HTMLButtonElement>('[data-display]');
    if (disp) { disp.disabled = true; try { await setDisplayFont(fontsHost, disp.dataset.display!); await paintFonts(); notify('type'); announce(tRaw('{family} now serves h1/h2 headings', { family: disp.dataset.display ?? '' })); } catch (err) { disp.disabled = false; showFontErr(String((err as { message?: unknown })?.message ?? err)); } return; }
    const ital = (e.target as Element).closest<HTMLButtonElement>('[data-italic]');
    if (ital) { ital.disabled = true; try { await setItalicFont(fontsHost, ital.dataset.italic!); await paintFonts(); notify('type'); announce(tRaw('{family} now serves italic text', { family: ital.dataset.italic ?? '' })); } catch (err) { ital.disabled = false; showFontErr(String((err as { message?: unknown })?.message ?? err)); } return; }
    const del = (e.target as Element).closest<HTMLButtonElement>('[data-del]'); if (!del) return;
    const fam = fontFamilies.find(f => f.family === del.dataset.del); if (!fam) return;
    const ok = await confirmDialog({
      title: tRaw('Remove {family}?', { family: fam.family }),
      message: fam.primary
        ? tRaw('Its font files ({size}) are deleted from this device and the next font becomes primary.', { size: fmtBytes(fam.bytes) })
        : tRaw('Its font files ({size}) are deleted from this device.', { size: fmtBytes(fam.bytes) }),
      confirmLabel: t('Remove'),
    });
    if (!ok) return; del.disabled = true;
    try {
      await removeUserFont(fontsHost, fam);
      // A removed face can't keep any role it served.
      if (fam.family === monoFamily) await setMonoFont(fontsHost, null).catch(() => {});
      if (fam.family === displayFamily) await setDisplayFont(fontsHost, null).catch(() => {});
      if (fam.family === italicFamily) await setItalicFont(fontsHost, null).catch(() => {});
      await paintFonts(); notify('type');
    } catch (err) { del.disabled = false; showFontErr(String((err as { message?: unknown })?.message ?? err)); }
  });

  // ── Logos (the Logos room) ───────────────────────────────────────────────────
  // Identity sections (a brand can carry several distinct logos), each holding
  // the canonical orientation × treatment matrix plus user-named custom marks
  // ("icon", "crest", …). Each slot is a drop/upload tile: empty → "Add",
  // filled → the mark on a chip themed to its treatment (reverse on dark, mono
  // on neutral) with a Replace/Remove pair. Stored as user assets via
  // brand-logos.ts; every slot optional.
  const logoErr = $('[data-be-logo-err]') as HTMLElement | null;
  const showLogoErr = (m: string): void => { if (logoErr) { logoErr.textContent = m; logoErr.hidden = !m; } if (m) announce(m, { assertive: true }); };
  let logoUrls: string[] = []; // object URLs to revoke on repaint/teardown
  // Identities the user added this session that hold no assets yet - an identity
  // only truly exists through its assets, so empty sections live here until the
  // first mark lands (and vanish on reload if none ever does; that's honest).
  const pendingIdentities: string[] = [];
  const identityLabel = (id: string): string => (id === 'default' ? t('The logo') : prettify(id));
  const logoTile = (v: string, identity: string, slot: LogoSlot | undefined, label?: string): string => {
    const { treatment } = splitVariant(v);
    const tm = treatment ? TREATMENT_META[treatment] : null;
    const name = label ?? slot?.label ?? (tm ? tm.label : prettify(v));
    const hint = slot ? t('Click to replace') : (tm ? tm.hint : t('A mark named its own way.'));
    // An empty slot says what it IS - "Not set", in the muted register - rather
    // than showing a bare "+" that reads as an instruction (plan 182 section
    // 4.2). The whole tile is still the drop target and the file input's label,
    // so nothing about adding a mark changed; only the words did.
    const body = slot
      ? `<span class="be-logo-art"><img src="${escape(slot.url)}" alt="${escape(tRaw('{name} logo', { name }))}" loading="lazy"></span>`
      : `<span class="be-logo-empty">${t('Not set')}</span>`;
    // The slot's file input is `visually-hidden`, never `hidden`: a display:none
    // input is not focusable, which made every logo slot mouse-only. The label
    // draws the keyboard ring on its behalf via .be-logo-drop:focus-within
    // (brand-studio.css) - the same construction the shared dropzone uses.
    return `<div class="be-logo-slot${slot ? ' is-filled' : ''}" data-be-logo="${escape(v)}" data-treatment="${treatment ?? 'custom'}">
        <div class="be-logo-slot-head"><span class="be-logo-slot-name">${escape(name)}</span>
          ${slot ? `<button type="button" class="be-logo-del" data-logo-del="${escape(v)}" data-identity="${escape(identity)}" aria-label="${escape(tRaw('Remove the {name} mark', { name }))}">&#x2715;</button>` : ''}</div>
        <label class="be-logo-drop">
          ${body}
          <input type="file" class="be-logo-file visually-hidden" data-logo-file="${escape(v)}" data-identity="${escape(identity)}" accept="image/png,image/jpeg,image/svg+xml,image/webp" aria-label="${escape(tRaw('Replace the {name} mark', { name }))}">
        </label>
        <p class="be-logo-hint">${escape(hint)}</p>
      </div>`;
  };
  // Which of the unnamed identity's slots currently hold a mark. Refreshed by
  // every paint and read by the intake queue: a chip says "Replace" instead of
  // "Place" for a taken slot, and a derived variant is only offered for an EMPTY
  // sibling. The intake files into the unnamed identity only - a named identity's
  // slots are still filled from their own tiles, which is where their context is.
  let filledDefaultSlots = new Set<string>();
  // Repaints the intake queue. Assigned further down (the queue's own render
  // needs helpers declared after this point); declared here as a mutable so
  // paintLogos can keep the chips' "Place" / "Replace" labels honest without a
  // temporal-dead-zone reference.
  let renderIntake: () => void = () => {};
  // Drains marks handed over by another view (the #/pdf exploder's "Send to the
  // Design System studio"). Same forward-declared shape as renderIntake above
  // and for the same reason: the paint runs before the queue's own helpers
  // exist, and the real drain needs addLogoFiles.
  let drainPendingLogos: () => void = () => {};
  const paintLogos = async (): Promise<void> => {
    const mount = $('[data-be-logos]') as HTMLElement | null; if (!mount) return;
    logoUrls.forEach(u => URL.revokeObjectURL(u)); logoUrls = [];
    const slots = await listLogos(fontsHost).catch(() => [] as LogoSlot[]);
    logoUrls = slots.map(s => s.url);
    filledDefaultSlots = new Set(slots.filter(s => s.identity === 'default').map(s => s.variant));
    // default leads, then stored identities in first-seen order, then this
    // session's still-empty additions.
    const identities: string[] = ['default'];
    for (const s of slots) if (!identities.includes(s.identity)) identities.push(s.identity);
    for (const p of pendingIdentities) if (!identities.includes(p)) identities.push(p);
    const sections = identities.map(identity => {
      const mine = slots.filter(s => s.identity === identity);
      const byVariant = new Map(mine.map(s => [s.variant, s]));
      const groups = LOGO_ORIENTATIONS.map(o => {
        const om = ORIENTATION_META[o];
        const variants = LOGO_TREATMENTS.map(tr => `${o}-${tr}` as LogoVariant);
        const tiles = variants.map(v => logoTile(v, identity, byVariant.get(v))).join('');
        return logoGroupHtml({
          name: escape(om.label), hint: escape(om.hint), body: tiles,
          filled: variants.some(v => byVariant.has(v)),
        });
      }).join('');
      const customs = mine.filter(s => s.custom);
      const customTiles = customs.map(s => logoTile(s.variant, identity, s)).join('');
      const customGroup = logoGroupHtml({
        name: t('Custom marks'),
        hint: t('Marks the design system names its own way - an icon, a crest, a favicon.'),
        cls: ' be-logo-group--custom',
        filled: customs.length > 0,
        body: `${customTiles}
            <form class="be-logo-addmark" data-logo-addmark data-identity="${escape(identity)}">
              <input type="text" class="be-logo-addmark-name" data-addmark-name placeholder="${escape(t('Name it - Icon, Crest…'))}" autocomplete="off" spellcheck="false" aria-label="${escape(t('Custom mark name'))}">
              <label class="be-btn be-logo-addmark-pick">${t('Choose file…')}
                <input type="file" class="visually-hidden" data-addmark-file accept="image/png,image/jpeg,image/svg+xml,image/webp" aria-label="${escape(t('Choose a file for this mark'))}"></label>
            </form>`,
      });
      return `<section class="be-logo-identity" data-identity="${escape(identity)}">
          ${identities.length > 1 || identity !== 'default' ? `<div class="be-logo-identity-head"><h4 class="be-logo-identity-name">${escape(identityLabel(identity))}</h4></div>` : ''}
          ${groups}${customGroup}
        </section>`;
    }).join('');
    const addIdentity = `<form class="be-logo-addidentity" data-logo-addidentity>
        <input type="text" data-addidentity-name placeholder="${escape(t('Another logo? Name it - Product, Event…'))}" autocomplete="off" spellcheck="false" aria-label="${escape(t('New logo name'))}">
        <button type="submit" class="be-btn">${t('+ Add another logo')}</button>
      </form>`;
    // A room that went away mid-paint drains NOTHING. `takePendingLogoFiles()`
    // empties the one-shot stash and nothing can re-arm it, so draining into a
    // torn-down room does not just waste the paint - it destroys the hand-off,
    // and the marks cannot be sent again without re-opening the document.
    if (!root.isConnected) return;
    mount.innerHTML = sections + addIdentity;
    renderIntake();
    // Only the FIRST paint has anything to drain (the stash is one-shot and the
    // drain latches), so the repaint after every placement costs one boolean.
    drainPendingLogos();
  };
  void paintLogos();
  cleanups.push(() => logoUrls.forEach(u => URL.revokeObjectURL(u)));

  /** A slug brand-logos accepts, from whatever the user typed. */
  const slugify = (name: string): string =>
    name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);

  // The logo-colour pathway: an SVG mark carries the design system's real
  // colours, so offer (or on a still-unbranded install, simply apply) its first
  // colour. The note lives in the Add hero, where the colour lands.
  const suggestEl = $('[data-be-suggest]') as HTMLElement | null;
  /** Add the colour, give it the primary role, and point the Generate wing's
   *  picker at it - one motion, persisted immediately (plan 97 section 6). */
  const takePrimaryFromLogo = (hex: string): void => {
    const name = nameColor(hex);
    const path = addSwatch(doc, 'custom', name, serializeColor(hex, 'lch'));
    // walkSwatches owns the path→key mapping (it strips the set prefix), so read
    // the key back off the swatch rather than re-deriving it here.
    const swatchKey = path
      ? walkSwatches(doc, currentTheme).find(s => s.path.length === path.length && s.path.every((seg, i) => seg === path[i]))?.key
      : undefined;
    // Deliberately UNSCOPED (no theme): a mark's colour is the brand's primary
    // in both themes, unlike surface and text, which each theme inverts.
    if (swatchKey) assignRole(doc, 'primary', swatchKey);
    setPrimaryTo(hex); // the Generate wing's picker follows the new primary
    repaintPalette();
    persist(true);
  };
  // The candidate tray (plan 97 section 8) - the HOST's, whenever it has one, because
  // two live trays over one storage key erase each other (see BrandEditorOptions
  // .tray). Only a host that mounts no tray of its own falls through to the
  // second branch, which creates one lazily - and only when a mark actually has
  // colours to hand over, so a session that never touches a logo pays nothing.
  // `load()` runs before the first add either way: the tray persists the whole
  // candidate list on every write, so adding to an unloaded one would erase
  // whatever a source scan left there earlier.
  let tray: Tray | null = null;
  const trayHandle = async (): Promise<Tray | null> => {
    if (opts.tray) return opts.tray;
    if (tray) return tray;
    try {
      const made = createTray(host);
      await made.load();
      tray = made;
      return tray;
    } catch { return null; }
  };
  /**
   * The colours a mark carries beyond the one the hero offers. They used to be
   * dropped on the floor; now they wait in the tray for as long as the user
   * likes (plan 97 section 8) and nothing is added to the palette on their account.
   */
  const trayColorsFromLogo = async (colors: string[], label: string): Promise<void> => {
    if (!colors.length) return;
    const handle = await trayHandle();
    if (!handle) return;
    // censusFromSvgColors appends an implied white ground when the artwork
    // carries none - a claim about the PAGE a mark sits on, which is right for
    // the role proposer and wrong for a shopping list. Candidates are filtered
    // back to the colours the file actually paints with.
    const own = new Set(colors.map(c => censusHex(c)).filter((h): h is string => !!h));
    const candidates = candidatesFromCensus(censusFromSvgColors(colors, label))
      .filter(c => c.type === 'color' && own.has(censusHex(c.value) ?? ''));
    if (!candidates.length) return;
    try {
      const added = await handle.add(candidates);
      if (added > 0) announce(t('Other colours from this file are waiting in the tray.'));
    } catch { /* the tray is a convenience; a failed add never fails an install */ }
  };
  const suggestFromLogo = async (file: File): Promise<void> => {
    if (!/svg/i.test(file.type) || file.size > 10 * 1024 * 1024) return;
    let colors: string[] = [];
    try { colors = extractSvgColors(await file.text()).map(c => colorToHex(c) ?? '').filter(c => /^#/.test(c)); } catch { return; }
    const first = colors[0];
    // The leading colour keeps its privileged path below; every other one is a
    // candidate, not a decision.
    void trayColorsFromLogo(colors.slice(1), file.name);
    if (!first || !suggestEl) return;
    if (!isUserBrand) {
      // Nothing of the user's to clobber yet - take it, and say what happened.
      takePrimaryFromLogo(first);
      // ONCE, though. That call just wrote a custom swatch, gave it the primary
      // role and persisted, so from here on there IS something of the user's:
      // the second file of a multi-file drop must OFFER rather than take (plan
      // 97 section 7.3 keeps exactly one auto-set, primary on a first-ever install).
      // Without this line every extra logo adds another swatch and reassigns the
      // role, and the last file dropped silently wins.
      isUserBrand = true;
      suggestEl.innerHTML = `<span class="be-suggest-note"><span class="be-suggest-sw" style="--sw:${escape(first)}" aria-hidden="true"></span>${t('Primary set from the logo.')}</span>`;
      suggestEl.hidden = false;
      announce(t('Primary set from the logo.'));
      return;
    }
    suggestEl.innerHTML = `
      <span class="be-suggest-note"><span class="be-suggest-sw" style="--sw:${escape(first)}" aria-hidden="true"></span>${t('Found in the logo:')} <code>${escape(first)}</code></span>
      <button type="button" class="be-btn be-btn--sm" data-be-suggest-use="${escape(first)}">${t('Use as primary')}</button>
      <button type="button" class="be-suggest-dismiss" data-be-suggest-dismiss aria-label="${escape(t('Dismiss suggestion'))}">&#x2715;</button>`;
    suggestEl.hidden = false;
  };
  suggestEl?.addEventListener('click', (e) => {
    const use = (e.target as HTMLElement).closest<HTMLElement>('[data-be-suggest-use]');
    if (use) {
      takePrimaryFromLogo(use.dataset.beSuggestUse!);
      suggestEl.hidden = true; playSfx('click');
      announce(t('Primary set from the logo.'));
      return;
    }
    if ((e.target as HTMLElement).closest('[data-be-suggest-dismiss]')) suggestEl.hidden = true;
  });

  // ── Level 0: multi-file intake → classify → confirm chip (plan 97 section 7.3) ─────
  // A dropped file is never filed silently. Each one is classified by the pure
  // heuristics in classify-logo.ts, proposes one of the eight slots, and waits as
  // a confirm chip; under LOGO_CONFIRM_MIN the chip leads with the slot menu
  // instead, because a guess is not a proposal. Every placement (chip or per-slot
  // tile) runs the shared trim offer first, and a placed colour SVG then offers
  // its generated mono / reverse siblings as further chips.

  /** Mirrors brand-logos.ts's own ACCEPT gate (not exported there): what enters
   *  the queue has to be something installLogo will actually take, so a chip
   *  never promises a placement that cannot happen. */
  const LOGO_ACCEPT_TYPES = /^image\/(png|jpeg|svg\+xml|webp)$/;
  /** The OTHER half of that gate, mirrored for the same reason: installLogo
   *  refuses anything over 4 MB, and a chip that led to that refusal would have
   *  cost a classification, a trim answer and a tap to say no. */
  const LOGO_MAX_BYTES = 4 * 1024 * 1024;
  const isSvgLogoFile = (f: File): boolean => /^image\/svg(\+xml)?$/i.test(f.type);
  /** Below this the classification is guesswork, so the chip leads with the slot
   *  menu and nothing is one tap away (plan 97 section 14.5: an ambiguous file always
   *  gets the confirm chip, never a silent placement). */
  const LOGO_CONFIRM_MIN = 0.6;
  /** How many files may wait at once - past this a queue stops being a list and
   *  becomes a backlog. */
  const LOGO_INTAKE_MAX = 12;
  /** Classification decode budget: the readback holds four bytes a pixel, and a
   *  logo is not a hero photo. */
  const CLASSIFY_MAX_PIXELS = 24_000_000;
  /** At most this many samples feed the colour census - a mark's ink is no more
   *  legible for having counted every pixel of a 4000px export. */
  const CLASSIFY_MAX_SAMPLES = 120_000;
  /** Census bucket size per channel (16 levels), so an anti-aliased edge does not
   *  read as a hundred separate inks. */
  const CLASSIFY_QUANT = 16;
  /** Alpha at or below this is not ink. */
  const CLASSIFY_ALPHA_MIN = 8;
  /** The ink a generated mono mark falls back to when the document names no text
   *  colour. Near-black rather than pure black, the same restraint the palette keeps. */
  const MONO_INK_FALLBACK = '#111111';

  type RasterLogoStats = Parameters<typeof classifyLogoRasterStats>[0];

  /**
   * A raster mark's stats for the classifier: content bounds for the shape, a
   * quantized census for the ink, and how much of the frame is transparent. The
   * decode lives here because classify-logo.ts is deliberately DOM-free.
   */
  const rasterLogoStats = async (file: File): Promise<RasterLogoStats | null> => {
    let bitmap: ImageBitmap;
    try { bitmap = await createImageBitmap(file); } catch { return null; }
    const { width, height } = bitmap;
    if (!width || !height || width * height > CLASSIFY_MAX_PIXELS) { bitmap.close?.(); return null; }
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) { bitmap.close?.(); return null; }
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close?.();
    let data: Uint8ClampedArray;
    try { data = ctx.getImageData(0, 0, width, height).data; } catch { return null; }
    // Sample on a grid rather than every pixel: the census needs the ink's
    // proportions, and a stride keeps a 12 Mpx export as cheap as a 300px one.
    const stride = Math.max(1, Math.ceil(Math.sqrt((width * height) / CLASSIFY_MAX_SAMPLES)));
    const q = (v: number): string =>
      Math.min(255, Math.round(v / CLASSIFY_QUANT) * CLASSIFY_QUANT).toString(16).padStart(2, '0');
    const counts = new Map<string, number>();
    let sampled = 0;
    let clear = 0;
    for (let y = 0; y < height; y += stride) {
      for (let x = 0; x < width; x += stride) {
        const i = (y * width + x) * 4;
        sampled++;
        if (data[i + 3]! <= CLASSIFY_ALPHA_MIN) { clear++; continue; }
        const key = `#${q(data[i]!)}${q(data[i + 1]!)}${q(data[i + 2]!)}`;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    // Orientation reads CONTENT bounds, never the canvas: a mark centred in a
    // padded export is the same shape whatever the padding.
    const box = rasterAlphaBounds(data, width, height, { alphaMin: CLASSIFY_ALPHA_MIN });
    return {
      width: box?.width || width,
      height: box?.height || height,
      colors: [...counts].sort((a, b) => b[1] - a[1]).slice(0, 16).map(([hex, weight]) => ({ hex, weight })),
      transparentShare: sampled > 0 ? clear / sampled : 0,
      // Deliberately not a number: classifyLogoRasterStats recomputes the light
      // share from `colors` against its own OKLCH threshold, and passing one here
      // would mean duplicating that threshold and then drifting from it.
      lightShare: Number.NaN,
    };
  };

  const classifyLogoFile = async (file: File): Promise<LogoClassification | null> => {
    if (isSvgLogoFile(file)) {
      try { return classifyLogoSvg(await file.text()); } catch { return null; }
    }
    const stats = await rasterLogoStats(file);
    return stats ? classifyLogoRasterStats(stats) : null;
  };

  // ── The trim offer, in front of every placement ─────────────────────────────
  const trimMount = $('[data-be-logo-trim]') as HTMLElement | null;
  let trimTeardown: (() => void) | null = null;
  let trimAbandon: (() => void) | null = null;
  /** Close whatever offer is open. A placement still waiting on it resolves with
   *  its ORIGINAL file - the non-destructive answer, the same one Escape gives. */
  const closeTrimOffer = (): void => {
    const teardown = trimTeardown; trimTeardown = null;
    const abandon = trimAbandon; trimAbandon = null;
    teardown?.();
    if (trimMount) trimMount.hidden = true;
    abandon?.();
  };
  cleanups.push(closeTrimOffer);
  /** True while a trim card is on screen. One mount, one decision: a second
   *  placement started now would tear that card down under the user, so every
   *  entry point checks this first. */
  const trimBusy = (): boolean => trimTeardown !== null;
  /**
   * Run the shared trim offer over a file on its way to becoming an asset and
   * resolve with the bytes to ingest. NULL means the user backed out (Escape, or
   * the card's ✕): the placement is abandoned and nothing is installed.
   *
   * `restore` hands the keyboard back after the card is answered - the card took
   * focus on mount and its buttons are about to be removed, so without it every
   * placement drops the user on <body>. Called for a USER answer only; on the
   * abandon path the whole surface is going away.
   *
   * ORDERING (trim-offer.ts's own rule, plan 97 section 4 gap 4): this MUST run BEFORE
   * the store path - storeUserUpload's normaliser strips the root width/height,
   * after which a viewBox rewrite has nothing left to bite on. A file with no
   * margin worth removing never sees a card at all.
   */
  const withTrimOffer = (file: File, restore?: () => void): Promise<File | null> => new Promise<File | null>((resolve) => {
    void (async () => {
      let proposal: Awaited<ReturnType<typeof prepareTrim>> = null;
      try { proposal = await prepareTrim(file); } catch { /* unreadable - no offer */ }
      if (!proposal || !trimMount || !root.isConnected) { resolve(file); return; }
      closeTrimOffer();
      trimMount.hidden = false;
      let settled = false;
      const finish = (chosen: File | null, restoreFocus = false): void => {
        if (settled) return;
        settled = true;
        closeTrimOffer();
        if (restoreFocus) restore?.();
        resolve(chosen);
      };
      // The room repainting under an open card is not the user backing out: the
      // file they picked still installs, with the margins it arrived with.
      trimAbandon = () => finish(file);
      trimTeardown = mountTrimOffer(trimMount, proposal, {
        t,
        onResolve: chosen => finish(chosen, true),
        onCancel: () => finish(null, true),
      });
      trimMount.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    })();
  });

  /** installLogo expresses the unnamed identity by OMITTING it (passing
   *  'default' is refused as a reserved name), so every install funnels through
   *  here rather than repeating that ternary at each call site. */
  const installLogoFile = (variant: string, identity: string, file: File, label?: string): Promise<void> =>
    installLogo(fontsHost, variant, file, {
      ...(identity && identity !== 'default' ? { identity } : {}),
      ...(label ? { label } : {}),
    });

  // ── The confirm-chip queue ──────────────────────────────────────────────────
  interface LogoCandidateChip {
    key: string;
    file: File;
    /** The slot this chip fills: the classifier's proposal until the user picks
     *  another from the menu. */
    variant: string;
    confidence: number;
    reasons: string[];
    url: string;
    menuOpen: boolean;
    busy: boolean;
    /** True for a mark this room generated (mono / reverse), not one dropped. */
    generated: boolean;
  }

  const queueEl = $('[data-be-logo-queue]') as HTMLElement | null;
  let intake: LogoCandidateChip[] = [];
  let intakeSeq = 0;
  /** A selector to focus after the next render - the queue re-renders whole, so
   *  a menu toggle, a placement or a dismissal would otherwise drop the keyboard
   *  where it stood, i.e. on <body>. EVERY path that re-renders says where the
   *  keyboard goes; the only exception is the queue emptying, which is
   *  `intakeEmptyFocus` below because there is no chip left to name. */
  let intakeFocus: string | null = null;
  let intakeEmptyFocus = false;

  /** Focus something in the room right now, if it is still there. Used to hand
   *  the keyboard back the instant a card closes, ahead of whatever repaint the
   *  answer triggers (which re-anchors it through `intakeFocus`). */
  const refocus = (sel: string): void => { root.querySelector<HTMLElement>(sel)?.focus(); };

  /** The chip element itself. It carries `tabindex="-1"` for the one moment its
   *  own buttons cannot hold focus: while a placement is busy and they are
   *  disabled. */
  const chipSel = (key: string): string => `[data-logo-chip="${key}"]`;
  /** The chip's first control - Place on a confident chip, Change slot on an
   *  unsure one, the dismiss ✕ when it has neither. */
  const chipActionSel = (key: string): string => `${chipSel(key)} button`;
  /**
   * Where the keyboard lands when a chip leaves the queue: the chip that took its
   * place (or the one before it, when the tail went), and the drop zone that
   * started all this when nothing is left.
   */
  const focusAfterChip = (index: number): void => {
    const next = intake[index] ?? intake[index - 1];
    intakeEmptyFocus = !next;
    intakeFocus = next ? chipActionSel(next.key) : null;
  };

  /** Returns the index the candidate held, so the caller can say where the
   *  keyboard goes next (-1 when there was no such chip). */
  const dropCandidate = (key: string): number => {
    const i = intake.findIndex(c => c.key === key);
    if (i < 0) return -1;
    URL.revokeObjectURL(intake[i]!.url);
    intake.splice(i, 1);
    return i;
  };
  cleanups.push(() => { for (const c of intake) URL.revokeObjectURL(c.url); intake = []; });

  const slotMenuHtml = (c: LogoCandidateChip): string =>
    `<div class="be-logo-chip-menu" data-logo-menu-for="${escape(c.key)}" role="group" aria-label="${escape(t('Choose a slot'))}">
        ${LOGO_ORIENTATIONS.flatMap(o => LOGO_TREATMENTS.map(tr => {
      const v = `${o}-${tr}` as LogoVariant;
      return `<button type="button" class="be-btn be-btn--sm be-logo-chip-slot${v === c.variant ? ' is-suggested' : ''}" data-logo-place="${escape(c.key)}" data-variant="${escape(v)}">
            <span>${escape(variantLabel(v))}</span>${filledDefaultSlots.has(v) ? `<span class="be-logo-chip-taken">${t('in use')}</span>` : ''}
          </button>`;
    })).join('')}
      </div>`;

  const candidateChipHtml = (c: LogoCandidateChip): string => {
    const label = variantLabel(c.variant);
    const sure = c.generated || c.confidence >= LOGO_CONFIRM_MIN;
    const lead = c.generated
      ? tRaw('Generated {variant}', { variant: label })
      : sure ? tRaw('Looks like the {variant}', { variant: label }) : t('Not sure which slot this is');
    // The classifier's own reason fragments, verbatim - they say what was measured.
    const why = c.reasons.filter(Boolean).join(', ');
    const act = c.generated ? t('Add') : filledDefaultSlots.has(c.variant) ? t('Replace') : t('Place');
    return `<div class="be-logo-chip" data-logo-chip="${escape(c.key)}" tabindex="-1"${c.generated ? ' data-generated="1"' : ''}>
        <span class="be-logo-chip-art"><img src="${escape(c.url)}" alt="" loading="lazy"></span>
        <div class="be-logo-chip-body">
          <p class="be-logo-chip-lead">${escape(lead)}${c.generated ? `<span class="be-logo-chip-tag">${t('Generated')}</span>` : ''}</p>
          <p class="be-logo-chip-why" title="${escape(why)}">${escape(c.file.name)}${why ? ` · ${escape(why)}` : ''}</p>
        </div>
        <div class="be-logo-chip-acts">
          ${sure ? `<button type="button" class="be-cta be-btn--sm" data-logo-place="${escape(c.key)}" data-variant="${escape(c.variant)}"${c.busy ? ' disabled' : ''}>${escape(act)}</button>` : ''}
          ${c.generated ? '' : `<button type="button" class="be-btn be-btn--sm" data-logo-menu="${escape(c.key)}" aria-expanded="${c.menuOpen ? 'true' : 'false'}"${c.busy ? ' disabled' : ''}>${t('Change slot')}</button>`}
          <button type="button" class="be-logo-chip-x" data-logo-dismiss="${escape(c.key)}" aria-label="${escape(tRaw('Dismiss {name}', { name: c.file.name }))}">&#x2715;</button>
        </div>
        ${c.menuOpen && !c.generated ? slotMenuHtml(c) : ''}
      </div>`;
  };

  renderIntake = (): void => {
    if (!queueEl) return;
    // A generated chip whose slot has SINCE been filled has nothing left to
    // offer: it was only ever an offer for an empty sibling (see
    // offerDerivedVariants), and a chip that lingered would keep an action that
    // displaces the mark the user just chose. Pruned here rather than at offer
    // time alone, because the slot can fill after the chip appears.
    for (const c of intake.filter(x => x.generated && !x.busy && filledDefaultSlots.has(x.variant))) {
      dropCandidate(c.key);
    }
    if (!intake.length) {
      queueEl.innerHTML = '';
      queueEl.hidden = true;
      intakeFocus = null;
      // The last chip went and took the keyboard with it: hand it to the drop
      // zone, which is where the queue came from and where the next file starts.
      if (intakeEmptyFocus) {
        intakeEmptyFocus = false;
        root.querySelector<HTMLElement>('[data-be-logo-multi]')?.focus();
      }
      return;
    }
    queueEl.hidden = false;
    // Chips remain, so the "hand it back to the drop zone" answer no longer
    // applies: drop it rather than letting it fire at some later empty render.
    intakeEmptyFocus = false;
    queueEl.innerHTML = `<p class="be-logo-queue-head">${t('Waiting for a slot')}</p>`
      + intake.map(candidateChipHtml).join('');
    if (intakeFocus) {
      queueEl.querySelector<HTMLElement>(intakeFocus)?.focus();
      intakeFocus = null;
    }
  };

  const addLogoFiles = async (files: File[]): Promise<void> => {
    if (!files.length) return;
    showLogoErr('');
    const typed = files.filter(f => LOGO_ACCEPT_TYPES.test(f.type));
    if (typed.length < files.length) showLogoErr(t('Use a PNG, JPEG, SVG or WebP image.'));
    const usable = typed.filter(f => f.size <= LOGO_MAX_BYTES);
    const tooBig = typed.find(f => f.size > LOGO_MAX_BYTES);
    // The same sentence installLogo throws, said before the classify/trim/tap
    // rather than after all three.
    if (tooBig) showLogoErr(tRaw('That logo is {size} MB - the limit is 4 MB.', { size: (tooBig.size / 1024 / 1024).toFixed(1) }));
    const room = Math.max(0, LOGO_INTAKE_MAX - intake.length);
    if (usable.length > room) showLogoErr(t('Place or dismiss the marks already waiting, then drop the rest.'));
    for (const file of usable.slice(0, room)) {
      const judged = await classifyLogoFile(file);
      if (!root.isConnected) return;
      intake.push({
        key: `belg${++intakeSeq}`,
        file,
        variant: judged ? `${judged.orientation}-${judged.treatment}` : 'horizontal-primary',
        confidence: judged ? judged.confidence : 0,
        reasons: judged ? judged.reasons : [t('this file could not be read')],
        url: URL.createObjectURL(file),
        menuOpen: !judged || judged.confidence < LOGO_CONFIRM_MIN,
        busy: false,
        generated: false,
      });
      renderIntake(); // chips appear as each file is judged, not in one late batch
    }
  };

  /**
   * Marks sent over from another view (plan 97 section 8, M5 - the PDF exploder's
   * "Send to the Design System studio"). They go through addLogoFiles, the very
   * same door a multi-file drop uses: classified, chipped, and waiting for a tap.
   * A mark lifted off page 3 of a guidelines PDF is exactly as much of a guess as
   * one dropped by hand, so it is never placed into a slot on arrival.
   *
   * Drained once. `takePendingLogoFiles()` empties the stash, so a second call
   * would find nothing anyway - the latch says so at the call site rather than
   * leaving the guarantee to a module the paint cannot see.
   */
  let pendingLogosDrained = false;
  drainPendingLogos = (): void => {
    if (pendingLogosDrained || !hasPendingLogoFiles()) return;
    pendingLogosDrained = true;
    const arrived = takePendingLogoFiles();
    void addLogoFiles(arrived).then(() => {
      if (!root.isConnected) return;
      // What actually reached the queue, not what was handed over: the type,
      // size and room gates above can turn some of it away, and they say so
      // themselves in the error line. Counting the chips keeps this sentence
      // from claiming marks the room refused.
      const n = intake.filter(c => arrived.includes(c.file)).length;
      if (!n) return;
      announce(tRaw(n === 1 ? '{n} mark arrived from the PDF' : '{n} marks arrived from the PDF', { n }));
    });
  };

  /** The ink a generated mono mark is painted in: the design system's own text
   *  colour, read from the LIGHT theme deliberately - a mono mark is the one that
   *  has to read on paper, and a dark theme's text is nearly white, which would
   *  generate an invisible mark. */
  const monoInk = (): string => {
    try {
      return colorToHex(createTokenSet(doc, { theme: 'light' }).resolve('color.semantic.text')) ?? MONO_INK_FALLBACK;
    } catch { return MONO_INK_FALLBACK; }
  };

  const derivedName = (name: string, suffix: string): string =>
    `${name.replace(/\.[a-z0-9]+$/i, '') || 'logo'}-${suffix}.svg`;

  /**
   * A colour SVG placed in a primary slot can father its own siblings: a
   * single-ink mono and a light-for-dark reverse (recolor-logo.ts, pure). They
   * arrive as chips marked Generated and are placed only on a tap, and only into
   * an EMPTY sibling - a generated mark never displaces one the user chose. A
   * mark the recolour cannot honestly derive from (a gradient, a pattern) gets no
   * chip at all, never a disabled one.
   */
  const offerDerivedVariants = async (file: File, variant: string, identity: string): Promise<void> => {
    if (identity !== 'default' || !isSvgLogoFile(file)) return;
    const { orientation, treatment } = splitVariant(variant);
    if (!orientation || treatment !== 'primary') return;
    let text = '';
    try { text = await file.text(); } catch { return; }
    const eligible = eligibleForDerivedVariants(text);
    if (!eligible.mono && !eligible.reverse) return;
    const wanted: Array<{ slot: string; suffix: string; svg: string | null; why: string }> = [];
    if (eligible.mono) {
      wanted.push({
        slot: `${orientation}-mono`, suffix: 'mono', svg: deriveMonoSvg(text, monoInk()),
        why: t('one ink, recoloured from the colour mark'),
      });
    }
    if (eligible.reverse) {
      wanted.push({
        slot: `${orientation}-primary-reverse`, suffix: 'reverse', svg: deriveReverseSvg(text),
        why: t('dark ink turned white, so it reads on a dark background'),
      });
    }
    let offered = false;
    for (const w of wanted) {
      if (!w.svg || filledDefaultSlots.has(w.slot)) continue;
      if (intake.some(c => c.generated && c.variant === w.slot)) continue;
      const made = new File([w.svg], derivedName(file.name, w.suffix), { type: 'image/svg+xml' });
      intake.push({
        key: `belg${++intakeSeq}`, file: made, variant: w.slot, confidence: 1,
        reasons: [w.why], url: URL.createObjectURL(made), menuOpen: false, busy: false, generated: true,
      });
      offered = true;
    }
    if (offered) { renderIntake(); announce(t('Generated marks are offered for the empty slots.')); }
  };

  const placeCandidate = async (key: string, variant: string): Promise<void> => {
    const c = intake.find(x => x.key === key);
    if (!c || c.busy || !LOGO_SLUG_RE.test(variant)) return;
    if (trimBusy()) { showLogoErr(t('Answer the trim card above first.')); return; }
    // A generated mark is an offer for an EMPTY slot and never displaces one the
    // user chose (offerDerivedVariants states the rule; this is where it is kept).
    // The slot can fill between the chip appearing and the tap, so the check
    // belongs at the moment of the act, not only at offer time.
    if (c.generated && filledDefaultSlots.has(variant)) {
      const i = dropCandidate(key);
      focusAfterChip(i);
      renderIntake();
      showLogoErr(t('That slot holds a mark you added, so the generated one was dropped.'));
      return;
    }
    c.busy = true; c.variant = variant;
    // The button the user just pressed is about to be re-rendered as a disabled
    // one, so the chip itself holds the keyboard until the placement settles.
    intakeFocus = chipSel(key);
    renderIntake();
    showLogoErr('');
    try {
      // A generated mark is derived from bytes the user already resolved, so it
      // is not offered a second trim.
      const file = c.generated ? c.file : await withTrimOffer(c.file, () => refocus(chipSel(key)));
      if (!root.isConnected) return;
      if (!file) {
        // Backed out of the trim card: the chip stays exactly as it was, with the
        // keyboard back on its action.
        c.busy = false;
        intakeFocus = chipActionSel(key);
        renderIntake();
        return;
      }
      await installLogoFile(variant, 'default', file);
      playSfx('saveProfile');
      const i = dropCandidate(key);
      focusAfterChip(i);
      renderIntake();     // the chip goes now, whatever the matrix repaint does
      focusAfterChip(i);  // …and the matrix repaint re-renders the queue under it
      await paintLogos(); // repaints the matrix, and the queue's labels with it
      notify('logos');
      announce(tRaw('{variant} logo added', { variant: variantLabel(variant) }));
      if (!c.generated) {
        void suggestFromLogo(file);
        void offerDerivedVariants(file, variant, 'default');
      }
    } catch (err) {
      c.busy = false;
      intakeFocus = chipActionSel(key);
      renderIntake();
      showLogoErr(String((err as { message?: unknown })?.message ?? err));
    }
  };

  const intakeZone = $('[data-be-logo-intake]') as HTMLElement | null;
  if (intakeZone) {
    intakeZone.addEventListener('change', (e) => {
      const input = (e.target as HTMLElement).closest<HTMLInputElement>('[data-be-logo-multi]');
      if (!input) return;
      const picked = [...(input.files ?? [])];
      input.value = '';
      void addLogoFiles(picked);
    });
    const over = (e: DragEvent): void => { e.preventDefault(); intakeZone.classList.add('is-over'); };
    intakeZone.addEventListener('dragenter', over);
    intakeZone.addEventListener('dragover', over);
    intakeZone.addEventListener('dragleave', (e) => {
      // Crossing into a child fires dragleave on the parent; only a real exit counts.
      const to = e.relatedTarget as Node | null;
      if (to && intakeZone.contains(to)) return;
      intakeZone.classList.remove('is-over');
    });
    intakeZone.addEventListener('drop', (e) => {
      // preventDefault also stops the wrapped file input claiming the drop itself,
      // so the files are read here exactly once; stopPropagation keeps a
      // view-level drop router (drop-router.ts, attached per view) from ALSO
      // opening the front-door chooser over a drop that named its destination.
      e.preventDefault();
      e.stopPropagation();
      intakeZone.classList.remove('is-over');
      void addLogoFiles([...(e.dataTransfer?.files ?? [])]);
    });
  }

  queueEl?.addEventListener('click', (e) => {
    const el = e.target as HTMLElement;
    const place = el.closest<HTMLElement>('[data-logo-place]');
    if (place) { void placeCandidate(place.dataset.logoPlace ?? '', place.dataset.variant ?? ''); return; }
    const menu = el.closest<HTMLElement>('[data-logo-menu]');
    if (menu) {
      const c = intake.find(x => x.key === menu.dataset.logoMenu);
      if (!c) return;
      c.menuOpen = !c.menuOpen;
      intakeFocus = c.menuOpen
        ? `[data-logo-menu-for="${c.key}"] .be-logo-chip-slot`
        : `[data-logo-menu="${c.key}"]`;
      renderIntake();
      return;
    }
    const dismiss = el.closest<HTMLElement>('[data-logo-dismiss]');
    if (dismiss) {
      // The ✕ the user pressed is about to be removed with its chip, so say where
      // the keyboard goes before the queue re-renders.
      focusAfterChip(dropCandidate(dismiss.dataset.logoDismiss ?? ''));
      renderIntake();
    }
  });
  queueEl?.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-logo-chip]');
    const c = chip ? intake.find(x => x.key === chip.dataset.logoChip) : null;
    // Only a menu the user OPENED closes: on a low-confidence chip the menu IS
    // the chip's body, and closing it would leave nothing to act on.
    if (!c || !c.menuOpen || c.confidence < LOGO_CONFIRM_MIN) return;
    e.stopPropagation();
    c.menuOpen = false;
    intakeFocus = `[data-logo-menu="${c.key}"]`;
    renderIntake();
  });

  $('[data-be-logos]')?.addEventListener('change', async (e) => {
    const target = e.target as HTMLElement;
    // A custom-mark file pick: needs the name typed beside it.
    const addFile = target.closest<HTMLInputElement>('[data-addmark-file]');
    if (addFile) {
      const form = addFile.closest<HTMLElement>('[data-logo-addmark]');
      const nameInput = form?.querySelector<HTMLInputElement>('[data-addmark-name]');
      const identity = form?.dataset.identity || 'default';
      const label = nameInput?.value.trim() ?? '';
      const slug = slugify(label);
      const file = addFile.files?.[0]; addFile.value = '';
      if (!file) return;
      showLogoErr('');
      if (!slug || !LOGO_SLUG_RE.test(slug)) { showLogoErr(t('Name the mark first - letters and numbers, e.g. "Icon".')); nameInput?.focus(); return; }
      if (trimBusy()) { showLogoErr(t('Answer the trim card above first.')); return; }
      // The picker that started this is inside the form, which paintLogos
      // rebuilds; the keyboard goes back to the same control on the fresh markup.
      const addmarkSel = `[data-logo-addmark][data-identity="${identity}"] [data-addmark-name]`;
      try {
        const picked = await withTrimOffer(file, () => refocus(addmarkSel));
        if (!root.isConnected) return;
        if (!picked) return;   // backed out of the trim card: nothing is installed
        // installLogoFile, not installLogo: the unnamed identity has to be
        // OMITTED, and the literal 'default' this path used to pass is refused
        // outright ("default is reserved") - so no custom mark could be added to
        // the first logo at all.
        await installLogoFile(slug, identity, picked, label);
        playSfx('saveProfile'); await paintLogos(); notify('logos');
        refocus(addmarkSel);
        void suggestFromLogo(picked);
        announce(tRaw('{label} mark added', { label }));
      } catch (err) { showLogoErr(String((err as { message?: unknown })?.message ?? err)); }
      return;
    }
    const input = target.closest<HTMLInputElement>('[data-logo-file]'); if (!input) return;
    const variant = input.dataset.logoFile!;
    const identity = input.dataset.identity || 'default';
    const file = input.files?.[0]; input.value = ''; if (!file) return;
    showLogoErr('');
    if (trimBusy()) { showLogoErr(t('Answer the trim card above first.')); return; }
    // paintLogos rebuilds the whole matrix, so the keyboard is handed back to the
    // same tile's file input on the fresh markup rather than left on <body>.
    const tileSel = `[data-logo-file="${variant}"][data-identity="${identity}"]`;
    try {
      // The same trim offer the intake chips get - the affordance belongs to
      // "a user file becomes an asset", not to one control (plan 97 section 7.3).
      const picked = await withTrimOffer(file, () => refocus(tileSel));
      if (!root.isConnected) return;
      if (!picked) return;   // backed out of the trim card: nothing is installed
      await installLogoFile(variant, identity, picked);
      playSfx('saveProfile'); await paintLogos(); notify('logos');
      refocus(tileSel);
      void suggestFromLogo(picked);
      void offerDerivedVariants(picked, variant, identity);
      announce(tRaw('{variant} logo added', { variant: variantLabel(variant) }));
    } catch (err) { showLogoErr(String((err as { message?: unknown })?.message ?? err)); }
  });
  $('[data-be-logos]')?.addEventListener('submit', (e) => {
    // The custom-mark form has no submit button (its "action" is the file
    // picker), but Enter in its name field still implicitly submits - swallow
    // that and forward the intent to the picker instead of reloading the page.
    const addmark = (e.target as HTMLElement).closest<HTMLElement>('[data-logo-addmark]');
    if (addmark) {
      e.preventDefault();
      addmark.querySelector<HTMLInputElement>('[data-addmark-file]')?.click();
      return;
    }
    const form = (e.target as HTMLElement).closest<HTMLElement>('[data-logo-addidentity]');
    if (!form) return;
    e.preventDefault();
    const nameInput = form.querySelector<HTMLInputElement>('[data-addidentity-name]');
    const slug = slugify(nameInput?.value ?? '');
    showLogoErr('');
    if (!slug || !LOGO_SLUG_RE.test(slug)) { showLogoErr(t('Name the logo first - letters and numbers, e.g. "Product".')); nameInput?.focus(); return; }
    if (slug === 'default') { showLogoErr(t('“Default” is the unnamed logo above - pick a different name.')); nameInput?.focus(); return; }
    if (!pendingIdentities.includes(slug)) pendingIdentities.push(slug);
    void paintLogos().then(() => {
      // Land the user in the fresh section rather than leaving them at the form.
      root.querySelector(`[data-be-logos] .be-logo-identity[data-identity="${slug}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  });
  $('[data-be-logos]')?.addEventListener('click', async (e) => {
    const del = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-logo-del]'); if (!del) return;
    e.preventDefault();
    const variant = del.dataset.logoDel!;
    const identity = del.dataset.identity || 'default';
    const ok = await confirmDialog({ title: tRaw('Remove the {variant} mark?', { variant: variantLabel(variant).toLowerCase() }), message: t('It’s deleted from this device.'), confirmLabel: t('Remove') });
    if (!ok) return; del.disabled = true;
    try {
      await removeLogo(fontsHost, variant, identity === 'default' ? undefined : identity);
      await paintLogos(); notify('logos');
    } catch (err) { del.disabled = false; showLogoErr(String((err as { message?: unknown })?.message ?? err)); }
  });

  // ── Palette download ─────────────────────────────────────────────────────
  const palErr = $('[data-be-pal-err]') as HTMLElement | null;
  const palFmtSel = $('[data-be-pal-fmt]') as HTMLSelectElement | null;
  // The brand's font.* role tokens, for the tokens-json export - so the faces a
  // user assigned in the Type room travel with the palette (plans/173 slice 1).
  // Only SET roles export: with none set the file has no font group, because
  // exporting the platform default would claim SUSE as the user's own brand.
  const exportFonts = async (): Promise<Array<{ role: string; families: string[] }>> => {
    const out: Array<{ role: string; families: string[] }> = [];
    for (const role of ['brand', 'mono', 'display', 'italic']) {
      const v = await (tokens as { resolve?(ref: string): Promise<unknown> } | undefined)
        ?.resolve?.(`{font.${role}}`).catch(() => null);
      const fams = (Array.isArray(v) ? v : [v])
        .filter((f): f is string => typeof f === 'string' && f.trim().length > 0)
        .map((f) => f.trim().replace(/^['"]+|['"]+$/g, ''));
      if (fams.length) out.push({ role, families: fams });
    }
    return out;
  };
  $('[data-be-pal-download]')?.addEventListener('click', async () => {
    if (palErr) palErr.hidden = true;
    try {
      const format = (palFmtSel?.value ?? 'tokens-json') as SwatchExportFormat;
      const fonts = format === 'tokens-json' ? await exportFonts() : undefined;
      const { blob, filename } = exportSwatches(swatches, format, undefined, fonts?.length ? { fonts } : undefined);
      await saveBlob(blob, filename);
      announce(tRaw('Palette downloaded as {filename}', { filename }));
    } catch (err) {
      if (palErr) { palErr.textContent = String((err as { message?: unknown })?.message ?? err); palErr.hidden = false; }
    }
  });

  // ── Corner radius (the Tokens tab) ───────────────────────────────────────
  // Live app-wide preview on every drag tick (set --radius directly - instant,
  // no round trip), persisted debounced so a drag doesn't spam writes.
  const radiusSlider = $('[data-be-radius-slider]') as HTMLInputElement | null;
  const radiusPreview = $('[data-be-radius-preview]') as HTMLElement | null;
  const radiusValueEl = $('[data-be-radius-value]') as HTMLElement | null;
  const radiusErr = $('[data-be-radius-err]') as HTMLElement | null;
  void (async () => {
    // Seed from the installed brand's --radius, else the shell default (1rem).
    // parseFloat tolerates a stored px/em value from a hand-authored import;
    // the slider always writes back in rem.
    const current = await (tokens as { resolve?(ref: string): Promise<unknown> } | undefined)
      ?.resolve?.('{shape.radius}').then(v => brandRadiusValue(v)).catch(() => null) ?? null;
    const rem = current ? parseFloat(current) : 1;
    if (radiusSlider) radiusSlider.value = String(rem);
    if (radiusPreview) radiusPreview.style.borderRadius = `${rem}rem`;
    if (radiusValueEl) radiusValueEl.textContent = `${rem}rem`;
  })();
  let radiusDebounce: ReturnType<typeof setTimeout> | undefined;
  let radiusPending: string | null = null; // flushed on teardown - a drag right before leaving must still land
  radiusSlider?.addEventListener('input', () => {
    const css = `${radiusSlider.value}rem`;
    if (radiusPreview) radiusPreview.style.borderRadius = css;
    if (radiusValueEl) radiusValueEl.textContent = css;
    document.documentElement.style.setProperty('--radius', css);
    notify('tokens');
    radiusPending = css;
    clearTimeout(radiusDebounce);
    radiusDebounce = setTimeout(() => {
      radiusPending = null;
      setBrandRadius(fontsHost, css).catch(err => {
        if (radiusErr) { radiusErr.textContent = String((err as { message?: unknown })?.message ?? err); radiusErr.hidden = false; }
      });
    }, 400);
  });
  cleanups.push(() => {
    clearTimeout(radiusDebounce);
    if (radiusPending) void setBrandRadius(fontsHost, radiusPending).catch(() => {});
  });

  // ── Spacing rhythm (the Tokens tab) ─────────────────────────────────────
  // The generated scale maps the default 0.5rem source to the existing
  // 2/4/6/8/10/12/16/24px steps. This slider alters one source, not eight
  // disconnected gap preferences, and persists only when the user touches it.
  const spaceSlider = $('[data-be-space-slider]') as HTMLInputElement | null;
  const spacePreview = $('[data-be-space-preview]') as HTMLElement | null;
  const spaceValueEl = $('[data-be-space-value]') as HTMLElement | null;
  const spaceErr = $('[data-be-space-err]') as HTMLElement | null;
  void (async () => {
    const current = await (tokens as { resolve?(ref: string): Promise<unknown> } | undefined)
      ?.resolve?.('{space.base}').then(v => brandSpaceValue(v)).catch(() => null) ?? null;
    const rem = current ? parseFloat(current) : .5;
    if (spaceSlider) spaceSlider.value = String(rem);
    if (spacePreview) spacePreview.style.setProperty('--brand-space-preview', `${rem}rem`);
    if (spaceValueEl) spaceValueEl.textContent = `${rem}rem`;
  })();
  let spaceDebounce: ReturnType<typeof setTimeout> | undefined;
  let spacePending: string | null = null;
  spaceSlider?.addEventListener('input', () => {
    const css = `${spaceSlider.value}rem`;
    if (spacePreview) spacePreview.style.setProperty('--brand-space-preview', css);
    if (spaceValueEl) spaceValueEl.textContent = css;
    document.documentElement.style.setProperty('--space', css);
    notify('tokens');
    spacePending = css;
    clearTimeout(spaceDebounce);
    spaceDebounce = setTimeout(() => {
      spacePending = null;
      setBrandSpace(fontsHost, css).catch(err => {
        if (spaceErr) { spaceErr.textContent = String((err as { message?: unknown })?.message ?? err); spaceErr.hidden = false; }
      });
    }, 400);
  });
  cleanups.push(() => {
    clearTimeout(spaceDebounce);
    if (spacePending) void setBrandSpace(fontsHost, spacePending).catch(() => {});
  });

  // ── The three studio panels that live outside this file ──────────────────
  // Token editors, gradients and catalogue uploads (brand-studio-tabs.ts) - 
  // each gets the same narrow context: the live doc (getter - the Colour tab
  // reassigns it on re-derive/import), the persist funnel, and its tab's notify.
  const studioCtx = {
    host,
    doc: () => doc as Record<string, unknown>,
    persist: (immediate?: boolean) => persist(immediate),
    // The shipped starter's colour identities, so a panel can tell scaffolding
    // from a decision without a second comparison of its own (the Tokens room's
    // neutrals row is the one caller - plan 182 section 12).
    starterIds: (): ReadonlySet<string> => starterSwatches,
  };
  // (The fonts-manager panel that used to mount here is gone - plan 182 section
  // 6.4 leaves one file door, the compare stage's own drop zone.)
  const tokensMount = $('[data-be-tokens-mount]') as HTMLElement | null;
  const tokensPanel = tokensMount ? mountTokensPanel(tokensMount, { ...studioCtx, notify: () => notify('tokens') }) : null;
  const gradsMount = $('[data-be-grads-mount]') as HTMLElement | null;
  // The gradient stop picker's view of the palette: the same walkSwatches-fed
  // `swatches` array the grid renders (kept fresh by both repaintPalette and
  // the in-place recolour paths). Alias roles are excluded - a stop wearing a
  // role would chain two aliases deep.
  const gradSwatches = (): Array<{ ref: string; hex: string; label: string; group: string }> =>
    swatches.filter(s => s.hex && !s.isAlias && s.kind !== 'semantic')
      .map(s => ({ ref: `{${s.key}}`, hex: s.hex, label: s.name, group: s.group }));
  const gradsPanel = gradsMount ? mountGradientsPanel(gradsMount, {
    ...studioCtx, notify: () => notify('color'), primaryHex, paletteHexes,
    paletteSwatches: gradSwatches,
    resolveRef: resolveTokenRef,
    onPalette: (cb) => { paletteObservers.add(cb); return () => { paletteObservers.delete(cb); }; },
  }) : null;
  const catMount = $('[data-be-cat-mount]') as HTMLElement | null;
  const catPanel = catMount ? mountCataloguePanel(catMount, { host, notify: () => notify('catalogue') }) : null;
  cleanups.push(() => { tokensPanel?.teardown(); gradsPanel?.teardown(); catPanel?.teardown(); });
  // Token/gradient groups ride the same doc the palette walks, so a re-derive
  // or pack import must repaint them too.
  paletteHooks.push(() => { tokensPanel?.render(); gradsPanel?.render(); });
  const themeObserver = new MutationObserver(() => {
    const theme = document.documentElement.dataset.theme || 'light';
    if (theme === currentTheme) return;
    currentTheme = theme;
    closeEditor();
    repaintPalette();
  });
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  cleanups.push(() => themeObserver.disconnect());

  // ── Share (brand pack in/out) - exposed on the handle; the host view owns
  //    the buttons' placement (its persistent Import/Export action row).
  const exportPack = async (): Promise<{ filename: string }> => {
    const { blob, filename, summary } = await exportBrandPack(transferHost);
    await saveBlob(blob, filename);
    announce(summary.fontFamilies === 1
      ? tRaw('Brand exported - {n} font family', { n: summary.fontFamilies })
      : tRaw('Brand exported - {n} font families', { n: summary.fontFamilies }));
    return { filename };
  };
  // Something replaced the installed tokens underneath us (a pack import, the
  // host view's own JSON/SVG install path) - reload the doc and repaint every
  // panel so the studio shows what's actually installed. The Generate wing's
  // CONTROLS re-seed too (primary, shade count, ramp anchors, the preview):
  // they were captured from the pre-import doc at mount, and leaving them stale
  // would make Replace palette silently derive from the old brand.
  const reload = async (): Promise<void> => {
    tokens?.bust?.();
    doc = ((await tokens?.raw().catch(() => null)) as Record<string, unknown> | null) ?? doc;
    isUserBrand = true; // every reload() caller just installed on the user's behalf
    reseedFromDoc();
    repaintPalette(); await paintFonts(); await paintLogos(); void applyChromeBrandVars(host);
  };
  const importPack = async (source: File | Unzipped): Promise<void> => {
    const summary = await importBrandPack(
      transferHost,
      typeof File !== 'undefined' && source instanceof File ? await source.arrayBuffer() : source as Unzipped,
    );
    await reload();
    if (summary.packInstance) {
      // The pack chose the instance base - the first-run chooser must not re-ask.
      void import('./instance-choice.ts')
        .then(({ markInstanceChoiceMade }) => markInstanceChoiceMade())
        .catch(() => { /* best-effort */ });
    }
    if (summary.packTools > 0) {
      // An instance pack (plans/131) landed tools + catalog entries beside the
      // brand: resync now so the gallery lists them without a reload/boot, then
      // re-merge the installed (sideloaded) tools over the fresh index - the
      // same order main.ts's boot path runs.
      void import('../catalog/sync.ts')
        .then(({ syncCatalog }) => syncCatalog(host as unknown as Parameters<typeof syncCatalog>[0]))
        .then(() => import('./installed-tools.ts'))
        .then(({ mergeInstalledToolsIntoIndex }) => mergeInstalledToolsIntoIndex())
        .catch(() => { /* next boot's sync picks it up */ });
      announce(tRaw('Brand loaded - {name}: {n} tools installed', {
        name: summary.packName ?? t('instance pack'), n: summary.packTools,
      }));
    } else {
      announce(t('Brand loaded'));
    }
  };

  return {
    teardown: () => {
      clearTimeout(saveTimer); cleanups.forEach(fn => fn());
      paletteObservers.clear();
      // The chrome already reflects what is installed; this is the cheap resync
      // after an unmount (nothing here was ever a draft).
      void applyChromeBrandVars(host);
    },
    saveDraft: () => {},   // no-op: every commit persists immediately (plan 97 section 6)
    isDirty: () => false,  // nothing is ever pending
    addColors: (entries) => addColorEntries(entries),
    exportPack,
    importPack,
    reload,
    // The host calls this on every room change, which is also when a post-add
    // chip stops being about anything the person can see.
    closeOverlays: () => { closeEditor(); clearAddedChip(); },
    onPalette: (cb) => { paletteObservers.add(cb); return () => { paletteObservers.delete(cb); }; },
    openColorChart: () => {
      if (!chartDetails) return false;
      chartDetails.open = true; // fires the toggle handler above → paintWheel()
      chartDetails.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      return true;
    },
    openWing: (key) => openWing(key),
    colourBeat: () => beat,
    openStarterGroup: (group) => {
      const name = String(group || '').trim();
      if (!name) return false;
      revealedStarterGroup = name;
      repaintPalette();
      const details = palMount?.querySelector<HTMLDetailsElement>('.be-pal-group--starter');
      if (!details) { revealedStarterGroup = null; return false; }
      // On a fresh design system this IS beat 0, where the pane is not on
      // screen at all - so the pane comes back for the group that was asked for
      // by name, holding nothing else (see the beat rules in brand-studio.css).
      colorPanel?.classList.add('is-starter-shown');
      details.open = true;
      details.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      return true;
    },
    openPickCard: () => {
      // Anchored on the add row's own chip, which is the control the card
      // belongs to at every beat - on a phone the card ignores the anchor and
      // docks to the bottom edge (see openPickCard).
      const chip = $('[data-be-tab-panel="color"] [data-ds-addc-pick]') as HTMLElement | null;
      if (!chip) return false;
      openPickCard(chip, null);
      return true;
    },
    openTypeStage: (role) => {
      // The card for that role is the opener, so Escape returns focus where the
      // person would have pressed. A room that did not render has no card.
      const card = $(`[data-be-typecard-choose="${role}"]`) as HTMLButtonElement | null;
      if (!card) return false;
      openStage(role, card);
      return true;
    },
    setGeneratePrimary: (hex) => {
      setPrimaryTo(hex);
      // A colour deep link opens its suggested shades and Add actions. The
      // wing opens in the same tick, so wait one frame before positioning it.
      requestAnimationFrame(() => {
        const previews = $('[data-be-preview]') as HTMLElement | null;
        previews?.scrollIntoView?.({ block: 'center', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      });
    },
    undo: () => undoLast(),
    canUndo: () => undoStack.length > 0,
  };
}
