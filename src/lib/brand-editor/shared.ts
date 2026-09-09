// SPDX-License-Identifier: MPL-2.0
/**
 * Module-level declarations of brand-editor.ts that its feature modules use: the types,
 * constants and pure helpers that used to sit above mountBrandEditor(). Moved here verbatim so
 * no feature module has to import the orchestrator file. The brand editor (colour, type and logo rooms of /start).
 */
import { apcaContrast, colorFaces, colorToHex, colorToHexString, colorToSrgb, contrastRatio, convertColor, createTokenSet, deriveBrandTokens, gamutMapSrgb, hexToOklch, parseColor as parseCssColor, rampOklab } from '@lolly/engine';
import type { BrandDeriveOptions, SchemeKind, StoredFace } from '@lolly/engine';
import { mountedSources, parseProfileLimit, profileFor } from '../color-profiles.ts';
import { draftShades } from '../design-system/palette-draft.ts';
import type { FinishKind, HostV1, SpotColor, TokenSet } from '@lolly-tools/core/host-v1';
import { RAMP_IDS, prettify } from '../brand-doc.ts';
import type { BrandSwatch, RampId } from '../brand-doc.ts';
import type { SwatchExportFormat } from '../swatch-export.ts';
import { contrastText } from '../../components/color-field.ts';
import { formatColor } from '../color-formats.ts';
import { swatchTile } from '../swatches.ts';
import type { FontRole } from '../../user-fonts.ts';
import type { classifyLogoRasterStats } from '../design-system/classify-logo.ts';
import type { Tray } from '../design-system/tray.ts';
import { icon } from '../icons.ts';
import { confirmDialog } from '../../components/confirm-dialog.ts';
import { t, tRaw } from '../../i18n.ts';
import { escape } from '../../utils.ts';
import { segHtml } from '../seg.ts';
import { FONT_ROLES, colorIdentity } from '../design-system/ownership.ts';
import type { FaceState } from '../design-system/ownership.ts';
import type { RoleId } from '../design-system/roles.ts';

// ── Host shape ──────────────────────────────────────────────────────────────
// The editor reads/writes tokens, fonts and brand packs. Every real web host
// (createBridge) satisfies all three; the caller passes its HostV1 and the
// sub-APIs are reached through the same narrow casts the wizard/profile use.
export type EditorHost = HostV1;
export type Scheme = NonNullable<BrandDeriveOptions['scheme']>;
export type Surface = NonNullable<BrandDeriveOptions['surface']>;
export type Contrast = NonNullable<BrandDeriveOptions['contrast']>;
export type Fg = NonNullable<BrandDeriveOptions['foreground']>;

export const SCHEMES: ReadonlyArray<{ id: Scheme; label: string }> = [
  { id: 'mono', label: t('Mono') }, { id: 'complement', label: t('Complement') },
  { id: 'analogous', label: t('Analogous') }, { id: 'triad', label: t('Triad') },
];
// UI intensity - the surface look baked into the brand, collapsed from the old
// Light / Dark / Deep-primary trio to a single Muted ↔ Deep toggle. Light vs dark
// is the app THEME's job (the Theme picker), so this axis only carries how RICH the
// surface reads: `muted` = a neutral surface (light default); `deep` = the
// chroma-rich primary surface. The ids stay the engine's `surface` values so
// deriveBrandTokens is unchanged (see engine/src/brand-derive.ts).
export const INTENSITIES: ReadonlyArray<{ id: Surface; label: string }> = [
  { id: 'light', label: t('Muted') }, { id: 'primary', label: t('Deep') },
];
export const CONTRASTS: ReadonlyArray<{ id: Contrast; label: string }> = [
  { id: 'comfort', label: t('Comfort') }, { id: 'high', label: t('High') },
];
// What sits on top of the brand primary. Auto picks white/black by contrast;
// Light/Dark force it - the fix for a mid-tone brand colour that "should" wear
// white text but auto-flips to black for the higher ratio (see deriveBrandTokens).
export const FOREGROUNDS: ReadonlyArray<{ id: Fg; label: string }> = [
  { id: 'auto', label: t('Auto') }, { id: 'light', label: t('Light') }, { id: 'dark', label: t('Dark') },
];
// The palette download formats, as the bulk bar's Download menu lists them
// (plan 182 section 5.5) - the same six lib/swatch-export.ts serves the pane's
// download dock. The dock keeps its own <select>, whose tokens-json option
// carries a "Penpot / Tokens Studio" note the menu has no room for.
export const PALETTE_FORMATS: ReadonlyArray<{ id: SwatchExportFormat; label: string }> = [
  { id: 'tokens-json', label: t('Design tokens (JSON)') },
  { id: 'css-vars', label: t('CSS variables') },
  { id: 'css-classes', label: t('CSS classes') },
  { id: 'scss', label: t('SCSS variables') },
  { id: 'gpl', label: t('GIMP palette (.gpl)') },
  { id: 'ase', label: t('Adobe Swatch Exchange (.ase)') },
];
export const DEFAULT_PRIMARY = '#4f83cc';

// ── Live derive preview (ramps + specimen), same recipe as the wizard ─────────

export const slot = (set: TokenSet, name: string): string => {
  const v = set.resolve(`color.semantic.${name}`); return typeof v === 'string' ? v : '';
};
export const ratioOf = (fg: string, bg: string): string => {
  try { const f = colorToHex(fg), b = colorToHex(bg); return f && b ? contrastRatio(f, b).toFixed(1) : ''; }
  catch { return ''; }
};
// APCA-W3 Lc, |rounded| - ADVISORY beside the WCAG number (it reads dark-mode
// and mid-tone pairs honestly where WCAG 2.1 misjudges); the derive floors
// stay WCAG-enforced. Rough anchors: 60 body text, 75 small text, 90 thin.
export const apcaOf = (fg: string, bg: string): string => {
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
export const GOOGLE_FONTS_ACK = 'lolly-google-fonts-ok';

export async function ensureGoogleFontsConsent(): Promise<boolean> {
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
export interface TypeRoleDef {
  id: FontRole;
  css: string;
  /** The role IS the slant - the specimen has to lean or it says nothing. */
  slanted?: boolean;
  /** Sized down: a code line is longer and set tighter than display copy. */
  mono?: boolean;
}
export const TYPE_ROLES: readonly TypeRoleDef[] = [
  { id: 'brand', css: 'var(--font-brand)' },
  { id: 'display', css: 'var(--font-display, var(--font-brand))' },
  { id: 'mono', css: 'var(--font-mono)', mono: true },
  { id: 'italic', css: 'var(--font-italic, var(--font-brand))', slanted: true },
];

/** Every role in the resting state, for the moment before the ownership read
 *  answers. `unset` is what "nothing read yet" honestly is - it prints no
 *  family and claims nothing. */
export function blankFaces(): Record<FontRole, FaceState> {
  const out = {} as Record<FontRole, FaceState>;
  for (const role of FONT_ROLES) out[role] = { family: '', state: 'unset' };
  return out;
}

/** The role's name on screen. Called at render, not at module load, so a late
 *  locale still arrives (the same reason the rooms build their markup in mount). */
export function typeRoleLabel(role: FontRole): string {
  return role === 'brand' ? t('Primary')
    : role === 'display' ? t('Headings')
      : role === 'mono' ? t('Code') : t('Italic');
}

/** One short line per role - long enough to judge a face, short enough to stay
 *  on one line at any card width. The code line is a real command, not prose:
 *  a mono face is chosen on its digits, its zero and its punctuation. */
export function typeRoleSample(role: FontRole): string {
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
export function typeRoleActStrings(roleLabel: string, isSet: boolean): { text: string; name: string } {
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
export function typeRoleCardHtml(def: TypeRoleDef): string {
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
export interface CurveMark { edited: boolean; open: boolean; }
export type CurveMarks = Partial<Record<RampId, CurveMark>>;
/** The three ramps' display names. Module scope because the Colours room's
 *  markup (the Curves + Contrast wings' ramp picker) is built before any of the
 *  mount's own locals exist. */
export const RAMP_LABEL: Record<RampId, string> = { primary: t('Primary'), neutral: t('Neutral'), secondary: t('Secondary') };
// A small tonal-curve glyph (a rising ease). Inline so it themes with currentColor.
export const CURVE_GLYPH = '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M2 13c4 0 4-10 12-10"/></svg>';

export function rampRow(
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
export function blendRow(set: TokenSet, steps: number): string {
  const a = set.resolve('color.semantic.primary');
  const b = set.resolve('color.semantic.secondary');
  if (typeof a !== 'string' || typeof b !== 'string') return '';
  let hexes: string[];
  try { hexes = rampOklab([a, b], steps, { correctLightness: true }); } catch { return ''; }
  const cells = hexes.map((hex, i) =>
    `<span class="be-ramp-cell" style="background:${escape(hex)}" title="${escape(tRaw('Blend {step} · {value}', { step: i + 1, value: hex }))}"></span>`).join('');
  return `<div class="be-ramp-row"><span class="be-ramp-label" title="${escape(t('Primary → Secondary, perceptually even (OKLab)'))}">${t('Blend')}</span><div class="be-ramp" role="img" aria-label="${escape(t('Primary to secondary blend'))}">${cells}</div></div>`;
}
export function specCard(name: string, set: TokenSet): string {
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
export function deriveSafe(opts: BrandDeriveOptions): Record<string, unknown> | null {
  try { return deriveBrandTokens(opts) as Record<string, unknown>; } catch { return null; }
}
export function previewHtml(doc: Record<string, unknown>, sel: { neutral: number; secondary: number; steps: number; curves?: CurveMarks; palette?: string[] }): string {
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
export const autoCmykOf = (hex: string): [number, number, number, number] => {
  const p = formatColor('cmyk', hex).split(',').map(n => Math.round(parseFloat(n)) || 0);
  return [p[0] ?? 0, p[1] ?? 0, p[2] ?? 0, p[3] ?? 0];
};

/** Same JSON key path - used to tell whether the Palette panel's currently-edited
 *  swatch IS the primary ramp's anchor step, so the two print-lock controls that
 *  can both touch it stay reconciled (see primaryPrintLock's doc comment). */
export const samePath = (a: readonly string[], b: readonly string[]): boolean =>
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
export const FINISHES: ReadonlyArray<{ id: string; label: () => string }> = [
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
export const finishLabel = (id: string): string => FINISHES.find(f => f.id === id)?.label() ?? prettify(id);

export function printLockHtml(): string {
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
export const FACE_SPACES: readonly { target: string; label: string }[] = [
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
export function deriveFace(canonical: string, target: string): string | [number, number, number, number] | null {
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
  if (profile?.nChannels !== 4) return null;
  const lab = convertColor(c, 'lab').components;
  const dev = profile.fromLab(press.intent, [lab[0] as number, lab[1] as number, lab[2] as number] as const);
  if (dev?.length !== 4) return null;
  return dev.map((v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100)) as [number, number, number, number];
}

/** Every target on offer right now: the screen spaces, plus each mounted press. */
export function faceTargets(): { target: string; label: string }[] {
  const out = [...FACE_SPACES];
  // The source's own label, not a ProfileEntry lookup: that is async, and this
  // runs inside a synchronous render. A GamutSource already carries the label the
  // profile panel shows, so the two cannot disagree either.
  for (const src of mountedSources()) out.push({ target: src.id, label: src.label });
  return out;
}

export const faceText = (v: string | [number, number, number, number]): string =>
  Array.isArray(v) ? `C${v[0]} M${v[1]} Y${v[2]} K${v[3]}` : v;

export interface FacesCtx {
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
export function mountFaces(mount: HTMLElement, ctx: FacesCtx): { render: () => void } {
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
export const cssEscape = (s: string): string =>
  (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(s) : s.replace(/[^\w-]/g, '\\$&'));

export interface PrintLockCtx {
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
export function mountPrintLock(mount: HTMLElement, ctx: PrintLockCtx): { render: () => void } {
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
    seg?.querySelectorAll<HTMLElement>('[data-val]').forEach(b => { b.setAttribute('aria-pressed', String(b.dataset.val === val)); });
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
  cInputs.forEach(inp => { inp.addEventListener('input', commitCmyk); });

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
      Array.from(finishSel.options).filter(o => o.dataset.beAdhoc).forEach(o => { o.remove(); });
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

export function tileHtml(s: BrandSwatch, idx: number, roleGlyph?: string): string {
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
export const ROLE_GLYPH: Partial<Record<RoleId, string>> = { primary: 'P', secondary: 'S', surface: 'Su', text: 'T' };

/** Identity of one starter swatch: its key AND its stored value. The definition
 *  and the reason both halves are needed live in lib/design-system/ownership.ts,
 *  which is where every room's "did somebody choose this?" answer comes from;
 *  this alias is only so the call sites below read as they always did. */
export const starterId = colorIdentity;



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
export function logoGroupHtml(
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
  /** Fired after any brand edit arrives, with the tab it came from - the host's
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
// The colour-harmony the "Build the palette" generator suggests accents from - 
// either a fixed SchemeKind (complement/adjacent/triad/tetrad) or the parametric
// 'analogous' mode (its own count + angle controls, generateAnalogous instead of
// generateSchemeAccents). One value because the Harmony control is a single
// mutually-exclusive segmented group. Persisted in panel state like any input.
export type HarmonyKind = SchemeKind | 'analogous';

// ── Level-2 wings ───────────────────────────────────────────────────────────
// Four folded disclosures under the Add + Roles panels. Closed on mount, no
// persistence - the same discipline the palette's own sections keep.
export type WingKey = 'generate' | 'curves' | 'contrast' | 'print';

// ── Replace palette: build a proposal, review it, then swap ─────────────────
// The old flow derived straight into the doc behind a confirm dialog. Now the
// derive builds a candidate document, a review card says exactly what changes,
// and only its own button swaps it in - with an undo snapshot taken first, so
// no confirm dialog stands where an undo suffices (plan 97 section 3 principle 3).

/** What a Replace would do, counted from the two documents. Pure - computed
 *  before anything is swapped, so the card can be honest and then cancelled. */
export interface ReplacePlan {
  steps: number; ramps: number; rebuilt: number; spectrumRebuilt: number;
  roles: number; kept: number; curves: number; locks: number;
  excluded: number; pinnedStops: number; rolesKept: number;
}

export type RasterLogoStats = Parameters<typeof classifyLogoRasterStats>[0];

// ── The confirm-chip queue ──────────────────────────────────────────────────
export interface LogoCandidateChip {
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
