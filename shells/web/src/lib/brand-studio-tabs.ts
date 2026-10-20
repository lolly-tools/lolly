// SPDX-License-Identifier: MPL-2.0
/**
 * Brand studio tabs - the three studio panels that don't touch the colour
 * pipeline: non-colour token editors (Tokens tab), gradient tokens (Colour
 * tab's optional extra) and catalogue uploads (Catalogue tab). Split out of
 * brand-editor.ts so the editor stays the colour/typography/logo core; each
 * mount gets the same narrow context - the live doc (a GETTER, because the
 * Colour tab reassigns the doc on re-derive/import), the persist funnel and
 * its tab's notify - and returns { render, teardown } so the editor can
 * repaint after a doc swap and unhook on unmount.
 *
 * Pure doc surgery lives in token-studio.ts; storage in upload-dropzone.ts /
 * the picker's storeUserUpload. Nothing here writes outside those funnels.
 */

import type { HostV1 } from '@lolly-tools/core/host-v1';
import { colorToHex, createTokenSet, isAlias } from '@lolly/engine';
import {
  listStudioTokens, addStudioToken, setStudioTokenValue, deleteStudioToken,
  defaultValueFor, gradientCss, resolveStopHex, formatStudioValue,
} from './token-studio.ts';
import type { StudioKind, StudioToken, GradientStop } from './token-studio.ts';
import { walkSwatches, isRec, type BrandSwatch } from './brand-doc.ts';
import { colorIdentity, isNeutralRampKey, isRoleKey } from './design-system/ownership.ts';
import { leadTokenSet } from './design-system/leads.ts';
import { roleAssignments, roleReadouts, rampStepName, type RoleContrast } from './design-system/roles.ts';
import { swatchTile } from './swatches.ts';
import { icon, ICON_METAPHORS, type IconName } from './icons.ts';
import { prefersReducedMotion } from './a11y-prefs.ts';
import type { SwatchExportFormat } from './swatch-export.ts';
import { inspectTokenDocument } from '../../../../engine/src/token-inspect.ts';
import { designMaterialOf } from '../../../../engine/src/design-system.ts';
import { tokenPreviewHtml, tokenValueText } from '../components/token-preview.ts';
import { withRadiusToken, withSpaceToken, familyFromTokenValue } from '../user-fonts.ts';
import { mountUploadDropzone } from './upload-dropzone.ts';
import type { PickerHost } from '../views/picker.ts';
import { confirmDialog } from '../components/confirm-dialog.ts';
import { mountColorField } from '../components/color-field.ts';
import { t, tRaw } from '../i18n.ts';
import { isTauriShell } from './instance-choice.ts';
import { escape } from '../utils.ts';
import { announce } from '../a11y.ts';
import { playSfx } from './sfx.ts';
import { brandFontStack, brandRadiusValue, brandSpaceValue, uiTokenCssValue } from '../brand-vars.ts';
import type { UiTokenKind } from '../brand-vars.ts';
import { listLollyUiTokens, lollyUiOverride, lollyUiTokenDocument, removeLollyUiOverride, setLollyUiOverride } from './lolly-ui-tokens.ts';

import { mountTokenWorkspace } from '../components/token-workspace.ts';
import { webTokenConsumerSources } from './token-consumer-index.ts';

export interface StudioTabCtx {
  host: HostV1;
  doc: () => Record<string, unknown>;
  /** Replace the editor's document. A write that returns a clone (withRadiusToken,
   *  withSpaceToken) comes through here, so the next save from any room carries the new value. */
  setDoc: (next: Record<string, unknown>) => void;
  persist: (immediate?: boolean) => void;
  notify: () => void;
  /** Snapshot the document onto the studio's undo stack under `label`. */
  pushUndo: (label: string) => void;
  /** The walked palette, for the palette download formats. */
  swatches: () => BrandSwatch[];
  /** Something replaced the whole document in place (the workspace's Apply); the
   *  other rooms reseed from the new document. */
  onDocReplaced?: () => void;
  /** The shipped starter's colour identities (lib/design-system/ownership.ts
   *  `colorIdentity`), for a panel that has to tell scaffolding from a decision.
   *  Absent on a host that ships no starter, which attributes nothing - the same
   *  honest default every ownership read keeps. */
  starterIds?: () => ReadonlySet<string>;
  /** Families installed on this device. A face token naming one is the person's
   *  own; any other face came with the system (ownership.ts `faceState`, the test
   *  the Type room and Overview make). Absent attributes every face to the system. */
  userFontFamilies?: () => readonly string[];
}

export interface StudioPanelHandle { render: () => void; teardown: () => void }

/**
 * The studio panel's titled head - `.be-panel-head`/`-title`/`-sub`, which alias
 * chips.css's `.section-header` family (see styles/parts/chips.css). Was typed
 * out as a raw template string eleven times across brand-editor.ts and this
 * module; this is the one copy.
 *
 * Both arguments are **trusted HTML, not escaped** - every call site passes a
 * `t()` string, and several of the subs carry deliberate inline markup
 * (`<strong>`, `<em>`, a `<a href="#/a">` link). Never pass user input here.
 * `sub` is optional; omitting it emits the head with a title alone.
 */
export const panelHead = (title: string, sub?: string): string =>
  `<div class="be-panel-head"><h3 class="be-panel-title">${title}</h3>${sub ? `<p class="be-panel-sub">${sub}</p>` : ''}</div>`;

// ── Tokens panel ──────────────────────────────────────────────────────────────

/** The kinds the Tokens tab offers (gradient lives on the Colour tab instead - 
 *  it's a colour primitive, and colour work shouldn't leave that tab). */
const TOKEN_KINDS: ReadonlyArray<{ id: StudioKind; label: string }> = [
  { id: 'spacing', label: 'Spacing' },
  { id: 'sizing', label: 'Sizing' },
  { id: 'stroke', label: 'Stroke width' },
  { id: 'opacity', label: 'Opacity' },
  { id: 'rotation', label: 'Rotation' },
  { id: 'number', label: 'Number' },
  { id: 'shadow', label: 'Shadow' },
];
const KIND_LABEL = new Map(TOKEN_KINDS.map(k => [k.id, k.label]));

const pathAttr = (t: StudioToken): string => escape(t.path.join('␟')); // ␟ - never in a slug
const pathFrom = (attr: string): string[] => attr.split('␟');

/** Every Tokens Studio type the Lolly UI document uses, as the kind its editor and
 *  validator take. A type missing here gets no Customise button: a Save that could
 *  only return early, with nothing saved and nothing said, is worse than none. */
const UI_KIND: Record<string, UiTokenKind> = {
  color: 'color', spacing: 'length', sizing: 'length', borderRadius: 'length', fontSize: 'length', letterSpacing: 'length',
  shadow: 'shadow', fontFamilies: 'font', fontWeights: 'number', duration: 'duration', cubicBezier: 'easing', number: 'number',
};
/** Letter spacing tightens as often as it opens, so it is the one length that may be negative. */
const SIGNED_LENGTH_RE = /^-?\d+(?:\.\d+)?(?:px|rem|em)$/;
/** Whether Lolly can read and store `value` for a role of this type. */
function uiValueUsable(type: string, kind: UiTokenKind, value: unknown): boolean {
  if (type === 'letterSpacing') return typeof value === 'string' && SIGNED_LENGTH_RE.test(value.trim());
  if (type === 'fontWeights') return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 1000;
  return uiTokenCssValue(kind, value) != null;
}
const UI_STARTER_TOKENS = listLollyUiTokens();
const uiPath = (path: readonly string[]): string => path.join('␟');
const uiValueText = (value: unknown): string => typeof value === 'string' ? value : JSON.stringify(value);
function parseUiValue(raw: string, kind: UiTokenKind): unknown {
  if (kind === 'number') return Number(raw);
  if (kind === 'shadow' || kind === 'easing') return JSON.parse(raw);
  // A font-family default is normally a DTCG string array. Keep that portable
  // form when it is shown as JSON, but let a person type a single family name
  // without forcing brackets and quotes around it.
  if (kind === 'font' && raw.trim().startsWith('[')) return JSON.parse(raw);
  return raw.trim();
}

/** One token row's value editor, per kind. Every control carries the row's
 *  JSON path so one delegated listener serves them all. */
function tokenValueEditor(tok: StudioToken): string {
  const p = pathAttr(tok);
  switch (tok.kind) {
    case 'opacity': {
      const v = typeof tok.raw === 'number' ? tok.raw : 1;
      return `<input type="range" class="field-range be-tok-range" min="0" max="1" step="0.01" value="${v}" data-tok-input="opacity" data-tok-path="${p}" aria-label="${escape(tRaw('{name} opacity', { name: tok.name }))}">
        <output class="be-tok-out" data-tok-out>${escape(formatStudioValue(tok))}</output>`;
    }
    case 'rotation':
    case 'number': {
      const v = typeof tok.raw === 'number' ? tok.raw : 0;
      return `<input type="number" class="be-tok-num" value="${v}" step="${tok.kind === 'rotation' ? 15 : 'any'}" data-tok-input="${tok.kind}" data-tok-path="${p}" aria-label="${escape(tRaw('{name} value', { name: tok.name }))}">${tok.kind === 'rotation' ? '<span class="be-tok-unit">°</span>' : ''}`;
    }
    case 'shadow': {
      const raw = (tok.raw ?? {}) as Record<string, unknown>;
      // The colour holder below carries the stored string VERBATIM. It used to be
      // flattened through colorToHex(...).slice(0, 7) for an <input type=color> that no
      // longer receives it, which dropped an authored alpha ('#00000040' → '#000000')
      // and any non-hex space on every re-render - only shadowFromRow's preference for
      // the stored value hid it. normShadow still gates validity on the way back in.
      const f = (k: string): string => escape(String(raw[k] ?? (k === 'color' ? '#00000040' : '0px')));
      return `<span class="be-tok-shadow-chip" style="box-shadow:${escape(formatStudioValue(tok))}" aria-hidden="true"></span>
        ${(['offsetX', 'offsetY', 'blur', 'spread'] as const).map(k =>
          `<label class="be-tok-shadow-in"><span>${k === 'offsetX' ? t('x') : k === 'offsetY' ? t('y') : k === 'blur' ? t('blur') : t('spread')}</span><input type="text" value="${f(k)}" data-tok-input="shadow" data-tok-field="${k}" data-tok-path="${p}" size="5" aria-label="${escape(tRaw('{name} {field}', { name: tok.name, field: k === 'offsetX' ? t('x') : k === 'offsetY' ? t('y') : k === 'blur' ? t('blur') : t('spread') }))}"></label>`).join('')}
        <span class="be-tok-shadow-cf" data-shadow-cf data-tok-path="${p}" aria-label="${escape(tRaw('{name} colour', { name: tok.name }))}"></span>
        <input type="hidden" data-tok-input="shadow" data-tok-field="color" data-tok-path="${p}" value="${f('color')}">`;
    }
    default: // the dimension kinds: spacing / sizing / stroke
      return `<input type="text" class="be-tok-dim" value="${escape(String(tok.raw ?? ''))}" data-tok-input="dimension" data-tok-path="${p}" size="7" inputmode="decimal" aria-label="${escape(tRaw('{name} value', { name: tok.name }))}" placeholder="8px">`;
  }
}

/** Read a shadow row's five fields back into the DTCG shadow value. The colour
 *  comes from the STORED value unless the colour input itself drove the commit - 
 *  `<input type=color>` only speaks #rrggbb, so echoing it back on every edit
 *  would strip an authored alpha ('#00000040') or oklch() the moment the blur
 *  is touched. */
function shadowFromRow(row: HTMLElement, changedField: string | undefined, currentRaw: unknown): Record<string, string> {
  const val = (k: string): string => row.querySelector<HTMLInputElement>(`[data-tok-field="${k}"]`)?.value.trim() ?? '0px';
  const storedColor = isRecObj(currentRaw) && typeof currentRaw.color === 'string' ? currentRaw.color : val('color');
  return {
    color: changedField === 'color' ? val('color') : storedColor,
    offsetX: val('offsetX'), offsetY: val('offsetY'), blur: val('blur'), spread: val('spread'),
  };
}
const isRecObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The starter neutrals' place in the Colours room (plan 182 section 12). The
 * blank brand ships one neutral ramp so surfaces and text render at all; the
 * Colours pane does not draw it, so this link opens that pane with the group
 * revealed, folded and tagged Starter. A plain anchor: it is a place.
 */
const NEUTRALS_LINK = '#/start?area=color&group=neutral';

/** The DTCG type each studio kind's leaves carry, for the row previews. */
const KIND_TYPE: Record<StudioKind, string> = {
  spacing: 'dimension', sizing: 'dimension', stroke: 'dimension', opacity: 'number', rotation: 'number', number: 'number', shadow: 'shadow', gradient: 'gradient',
};

/** The Tokens Studio types the Lolly UI document uses, as the DTCG type a preview draws. */
const UI_PREVIEW_TYPE: Record<string, string> = { spacing: 'dimension', borderRadius: 'dimension', fontSize: 'dimension', fontFamilies: 'fontFamily' };

/** The App appearance groups' names. Literal t() calls, because the string scan reads only those. */
const UI_GROUP_LABEL: Record<string, string> = {
  color: 'Colour', size: 'Size', space: 'Space', radius: 'Radius', elevation: 'Elevation', edge: 'Edge', effect: 'Effect', type: 'Type', motion: 'Motion', layer: 'Layer',
};
const uiGroupLabel = (group: string): string => {
  const labels: Record<string, string> = {
    color: t('Colour'), size: t('Size'), space: t('Space'), radius: t('Radius'), elevation: t('Elevation'),
    edge: t('Edge'), effect: t('Effect'), type: t('Type'), motion: t('Motion'), layer: t('Layer'),
  };
  return Object.hasOwn(UI_GROUP_LABEL, group) ? labels[group]! : escape(group.replace(/-/g, ' '));
};

/** The Lolly app's own UI document, read once: every role's stock value. */
const UI_DEFAULTS = createTokenSet(lollyUiTokenDocument());

type RoomSection = 'color' | 'type' | 'logos' | 'shape' | 'more' | 'all';
const SECTION_ICON: Record<RoomSection, IconName> = {
  color: ICON_METAPHORS.colour, type: 'font', logos: 'shapes', shape: 'box', more: 'sliders', all: ICON_METAPHORS.tokens,
};
const sectionLabel = (id: RoomSection): string => ({
  color: t('Colours'), type: t('Type'), logos: t('Logos'), shape: t('Shape and spacing'), more: t('More'), all: t('All tokens'),
})[id];

/** The Type section's roles, in the order tools reach for them. */
const FONT_ROLES: ReadonlyArray<string> = ['font.brand', 'font.display', 'font.mono', 'font.italic'];
const fontRoleLabel = (path: string): string => {
  switch (path) {
    case 'font.brand': return t('Text');
    case 'font.display': return t('Headings');
    case 'font.mono': return t('Code');
    case 'font.italic': return t('Emphasis');
    default: return sentence(path.split('.').at(-1) ?? path);
  }
};

/** Rows a colour group shows before its Show all. */
const GROUP_PEEK = 12;

const sentence = (s: string): string => { const w = s.replace(/[-_]+/g, ' ').trim(); return w.charAt(0).toUpperCase() + w.slice(1); };
/** A role's row name from its key, not its description (which is often a sentence):
 *  `color.semantic.on-primary` is On primary, `color.chrome.edge` is Chrome edge. */
const roleRowName = (s: BrandSwatch): string => {
  const parts = s.key.split('.');
  const leaf = parts.at(-1) ?? s.key, parent = parts.at(-2) ?? '';
  return sentence(parent && parent !== 'semantic' && parent !== 'role' && parent !== 'color' ? `${parent} ${leaf}` : leaf);
};
const isUiKey = (key: string): boolean => key.startsWith('lolly.') || key.startsWith('color.lolly.');

interface ColourRow { key: string; name: string; hex: string; value: string; starter: boolean; title: string }
interface ColourGroup { id: string; label: string; ramp: boolean; neutral: boolean; note: boolean; rows: ColourRow[] }
interface ContrastPair { label: 'text' | 'primary' | 'muted'; fg: string; bg: string; contrast: RoleContrast }
interface NamedRow { key: string; name: string; value: string; raw: unknown; starter: boolean }
interface LogoRow extends NamedRow {
  /** The catalog or upload id the slot draws. */
  assetId: string;
  /** The first slot above this one that draws the same file, or ''. */
  sameAs: string;
}

/** What the Tokens room draws, read from the document alone. Pure, so a test can read every state. */
export interface TokensRoomModel {
  groups: ColourGroup[];
  gradients: Array<{ key: string; name: string; css: string }>;
  pairs: { light: ContrastPair[]; dark: ContrastPair[] };
  fonts: NamedRow[];
  logos: LogoRow[];
  more: StudioToken[];
  /** The palette is only the starter's neutral ramp: Edit in Colours opens that group. */
  starterOnly: boolean;
  example: { name: string; hex: string } | null;
  /**
   * The person's own material per section, the way Overview and the Colours,
   * Type and Logos rooms count it: palette colours (roles re-point, they are not
   * colours) that differ from the shipped starter, faces installed on this device,
   * marks uploaded here. What came with the system is counted in `starter`.
   */
  counts: Record<RoomSection, number>;
  starter: { color: number; type: number; logos: number };
  /** No colour, face or logo of the person's own yet: the room shows its one blank card. */
  empty: boolean;
}

function contrastPairs(doc: unknown, mode: 'light' | 'dark'): ContrastPair[] {
  try {
    const set = leadTokenSet(doc, mode);
    const r = roleReadouts(doc, mode, key => set.resolve(key));
    const out: ContrastPair[] = [];
    // A side missing is a pair not drawn: roleReadouts measures ink on white when
    // there is no surface, which is not a pair this system has.
    if (r.surface.hex && r.text.hex && r.text.contrast) out.push({ label: 'text', fg: r.text.hex, bg: r.text.against, contrast: r.text.contrast });
    if (r.primary.hex && r.primary.against && r.primary.contrast) out.push({ label: 'primary', fg: r.primary.against, bg: r.primary.hex, contrast: r.primary.contrast });
    if (r.surface.hex && r.muted.hex && r.muted.contrast) out.push({ label: 'muted', fg: r.muted.hex, bg: r.muted.against, contrast: r.muted.contrast });
    return out;
  } catch { return []; }
}

/** A logo token's asset id, from a bare id or an `{ id }` value. */
const assetIdOf = (value: unknown): string =>
  typeof value === 'string' ? value : isRec(value) && typeof value.id === 'string' ? value.id : '';

export function tokensRoomModel(
  doc: Record<string, unknown>, starter: ReadonlySet<string> = new Set(), userFonts: readonly string[] = [],
): TokensRoomModel {
  const set = leadTokenSet(doc, 'light');
  const resolve = (key: string): unknown => set.resolve(key);
  let swatches: BrandSwatch[] = [];
  try { swatches = walkSwatches(doc, 'light', resolve).filter(s => !isUiKey(s.key)); } catch { /* an unreadable doc has no colours */ }
  const isStarter = (s: BrandSwatch): boolean => starter.has(colorIdentity(s.key, s.raw));

  const byGroup = new Map<string, BrandSwatch[]>();
  for (const s of swatches) (byGroup.get(s.group) ?? byGroup.set(s.group, []).get(s.group)!).push(s);
  const groups: ColourGroup[] = [...byGroup.entries()].map(([name, items]) => {
    const ramp = items.every(s => s.kind === 'ramp');
    const neutral = ramp && items.every(s => isNeutralRampKey(s.key));
    const inherited = neutral && items.some(isStarter);
    return {
      id: name, ramp, neutral, note: inherited,
      label: neutral ? (inherited ? tRaw('Neutrals · starter · {n}', { n: items.length }) : tRaw('Neutrals · {n}', { n: items.length })) : name,
      rows: items.map(s => ({
        key: s.key,
        name: s.kind === 'semantic' ? roleRowName(s) : rampStepName(s.name, s.key),
        hex: s.hex, value: s.hex || String(s.raw), starter: isStarter(s),
        title: s.kind === 'semantic' && s.name !== roleRowName(s) ? s.name : '',
      })),
    };
  });

  const studio = listStudioTokens(doc);
  const gradients = studio.filter(tok => tok.kind === 'gradient').map(tok => ({
    key: tok.key, name: tok.name, css: gradientCss(tok.raw, tok.angle, { resolve, space: 'oklch' }),
  }));
  const more = studio.filter(tok => tok.kind !== 'gradient' && tok.key !== 'space.base');

  const installed = new Set(userFonts.map(f => String(f).trim().toLowerCase()).filter(Boolean));
  const fonts = set.query({ type: 'fontFamily' })
    .filter(e => !isUiKey(e.path))
    .sort((a, b) => {
      const ra = FONT_ROLES.indexOf(a.path), rb = FONT_ROLES.indexOf(b.path);
      return (ra < 0 ? 99 : ra) - (rb < 0 ? 99 : rb);
    })
    .map(e => ({
      key: e.path, name: fontRoleLabel(e.path), value: tokenValueText('fontFamily', e.value), raw: e.value,
      starter: !installed.has(familyFromTokenValue(e.value).trim().toLowerCase()),
    }));
  const seen = new Map<string, string>();
  const logos = set.query({ type: 'asset' })
    .filter(e => !isUiKey(e.path))
    .map(e => {
      const assetId = assetIdOf(e.value);
      const name = sentence(e.path.split('.').at(-1) ?? e.path);
      const sameAs = assetId ? seen.get(assetId) ?? '' : '';
      if (assetId && !seen.has(assetId)) seen.set(assetId, name);
      // The Logos room draws only marks uploaded to this device (brand-logos.ts
      // listLogos), so a slot pointing anywhere else is one that came with the system.
      const own = !!assetId && designMaterialOf(assetId)?.kind === 'logo';
      return { key: e.path, name, value: assetId || tokenValueText('asset', e.value), raw: e.value, starter: !own, assetId, sameAs };
    });

  // Roles re-point at a colour; they are not one (ownership.ts isRoleKey), so they
  // never add to the count. Spectrum entries do: Overview and the Colours room count them.
  const palette = swatches.filter(s => !isRoleKey(s.key));
  const starterOnly = palette.length > 0 && palette.every(s => isNeutralRampKey(s.key) && isStarter(s));
  const light = contrastPairs(doc, 'light');
  const hasDark = set.themes().some(theme => theme.name === 'dark' || theme.id === 'dark');
  const dark = hasDark ? contrastPairs(doc, 'dark') : [];

  let example: TokensRoomModel['example'] = null;
  try {
    const primary = roleAssignments(doc, 'light', resolve).primary;
    const named = primary && swatches.find(s => s.key === primary.key);
    if (primary?.hex && named) example = { name: rampStepName(named.name, named.key), hex: primary.hex };
  } catch { /* no example line */ }

  let all = 0;
  try { all = inspectTokenDocument(doc).tokens.length; } catch { all = set.size; }
  const ownColours = palette.filter(s => !isStarter(s)).length + gradients.length;
  const ownFonts = fonts.filter(f => !f.starter).length;
  const ownLogos = logos.filter(l => !l.starter).length;
  return {
    groups, gradients, pairs: { light, dark }, fonts, logos, more, starterOnly, example,
    counts: { color: ownColours, type: ownFonts, logos: ownLogos, shape: 2, more: more.length, all },
    starter: { color: palette.length + gradients.length - ownColours, type: fonts.length - ownFonts, logos: logos.length - ownLogos },
    empty: !ownColours && !ownFonts && !ownLogos,
  };
}

/** One shape token's slider: shape.radius or space.base. */
interface Dial {
  path: 'shape.radius' | 'space.base';
  fallback: number;
  read: (value: unknown) => string | null;
  write: (doc: unknown, value: string | null) => Record<string, unknown>;
  cssVar: '--radius' | '--space';
  undo: () => string;
  paint: (preview: HTMLElement, css: string) => void;
  slider: HTMLInputElement | null;
  preview: HTMLElement | null;
  valueEl: HTMLElement | null;
  err: HTMLElement | null;
  own: HTMLElement | null;
  pending: string | null;
  timer: ReturnType<typeof setTimeout> | undefined;
  dragging: boolean;
}

/** A stored length as a slider position in rem (px reads at 16 to the rem). */
const remOf = (css: string): number => css.endsWith('px') ? parseFloat(css) / 16 : parseFloat(css);

export function mountTokensPanel(mount: HTMLElement, ctx: StudioTabCtx): StudioPanelHandle {
  const secHead = (id: RoomSection, n: number | null, action = '', name = sectionLabel(id)): string =>
    `<div class="tk-sec-head"><span class="tk-sec-ic" aria-hidden="true">${icon(SECTION_ICON[id])}</span><h3 class="tk-sec-name" id="tk-sec-${id}">${name}</h3>${n === null ? '' : `<span class="tk-sec-n" data-tk-n="${id}">${n}</span>`}${action}</div>`;
  mount.innerHTML = `
    <header class="tk-head">
      <p class="tk-intro" data-tk-intro>${t('Tokens are the named values behind your brand: colours, typefaces, logos, corners and spacing. Tools read them by name, so a change here reaches every tool at once.')}</p>
      <p class="tk-intro-example" data-tk-example hidden></p>
      <div class="tk-status"><span class="be-save-state" data-be-save-state role="status" hidden></span><button type="button" class="be-pal-restore" data-be-undo hidden>${t('Undo')}</button></div>
      <div class="tk-actions" data-tk-actions>
        <select class="field-select field-select--auto field-select--sm tk-fmt" data-tk-fmt aria-label="${escape(t('Download as'))}">
          <option value="tokens-json">${t('Design tokens (JSON)')}</option>
          <option value="css-vars">${t('CSS variables')}</option>
          <option value="css-classes">${t('CSS classes')}</option>
          <option value="scss">${t('SCSS variables')}</option>
          <option value="gpl">${t('GIMP palette (.gpl)')}</option>
          <option value="ase">${t('Adobe Swatch Exchange (.ase)')}</option>
        </select>
        <button type="button" class="be-btn be-btn--sm" data-tk-download data-sfx="whoosh">${t('Download')}</button>
        <button type="button" class="be-btn be-btn--sm" data-tk-copy-css>${t('Copy CSS')}</button>
        <button type="button" class="be-btn be-btn--sm" data-tk-import aria-haspopup="dialog">${t('Add from…')}</button>
      </div>
      <p class="tk-head-note">${t('JSON is your whole system, and Add from… reads it back. Penpot and Tokens Studio for Figma open JSON; CSS and SCSS suit code.')} <a href="/examples/beacon.tokens.json" download="beacon.tokens.json">${t('See an example file')}</a></p>
      <p class="be-err" data-tk-err role="alert" hidden></p>
    </header>
    <div class="tk-main" data-tk-main></div>
    <section class="be-panel tk-sec" data-tk-sec="shape" aria-labelledby="tk-sec-shape" tabindex="-1">
      ${secHead('shape', null)}
      <p class="tk-sec-sub">${t('Two tokens the app and every tool follow: shape.radius and space.base.')}</p>
      <div class="tk-sec-body tk-dials" data-tk-body="shape">
        <div class="tk-dial">
          <div class="tk-dial-head"><h4 class="tk-dial-name">${t('Rounded corners')}</h4><span class="tk-own" data-tk-radius-own></span></div>
          <p class="tk-dial-sub">${t('One brand radius drives a full scale: fine controls use smaller steps, panels use the base, and the pill step becomes fully rounded. Set it to 0 for straight corners everywhere.')}</p>
          <div class="brand-radius-row">
            <span class="brand-radius-preview" data-be-radius-preview aria-hidden="true"></span>
            <input type="range" class="field-range brand-radius-slider" data-be-radius-slider min="0" max="1.5" step="0.05" aria-label="${escape(t('Corner radius'))}">
            <span class="brand-radius-value" data-be-radius-value></span>
          </div>
          <p class="be-err" data-be-radius-err role="alert" hidden></p>
        </div>
        <div class="tk-dial">
          <div class="tk-dial-head"><h4 class="tk-dial-name">${t('Spacing rhythm')}</h4><span class="tk-own" data-tk-space-own></span></div>
          <p class="tk-dial-sub">${t('One base space token drives every Lolly gap: the compact steps, controls, panels and page margins all move together. This only writes <code>space.base</code> to your brand.')}</p>
          <div class="brand-space-row">
            <span class="brand-space-preview" data-be-space-preview aria-hidden="true"><i></i><i></i><i></i></span>
            <input type="range" class="field-range brand-space-slider" data-be-space-slider min="0.25" max="1.5" step="0.05" aria-label="${escape(t('Base spacing'))}">
            <span class="brand-space-value" data-be-space-value></span>
          </div>
          <p class="be-err" data-be-space-err role="alert" hidden></p>
        </div>
      </div>
    </section>
    <section class="be-panel tk-sec" data-tk-sec="more" aria-labelledby="tk-sec-more" tabindex="-1">
      ${secHead('more', 0, '', t('More tokens'))}
      <p class="tk-sec-sub">${t('The rest of the system - spacing, sizing, stroke widths, opacity, rotation, plain numbers and shadows. Tools that read tokens follow these the way they follow the colours.')}</p>
      <div class="tk-sec-body" data-tk-body="more">
        <div class="be-tok-list" data-tok-list></div>
        <form class="be-tok-add" data-tok-add>
          <select class="field-select field-select--auto field-select--sm be-tok-add-kind" data-tok-add-kind aria-label="${escape(t('Token type'))}">
            ${TOKEN_KINDS.map(k => `<option value="${k.id}">${escape(t(k.label))}</option>`).join('')}
          </select>
          <input type="text" class="be-tok-add-name" data-tok-add-name placeholder="${escape(t('Name it - Gutter, Card shadow…'))}" autocomplete="off" spellcheck="false" aria-label="${escape(t('Token name'))}">
          <button type="submit" class="be-btn">${t('+ Add token')}</button>
        </form>
        <p class="be-err" data-tok-err hidden></p>
      </div>
    </section>
    <details class="section-card tk-adv" data-tk-adv="ui">
      <summary class="section-card-summary"><span class="section-card-title">${t('App appearance (advanced)')}</span><span class="section-card-chev" aria-hidden="true">${icon('chevronRight', { size: 16 })}</span></summary>
      <p class="tk-adv-sub">${t('The colours, sizes and shadows Lolly’s own screens use. Change one only if the app chrome should follow your brand.')}</p>
      <div class="be-ui-starter" data-be-ui-starter></div>
    </details>
    <details class="section-card tk-adv" data-tk-adv="inspect">
      <summary class="section-card-summary"><span class="section-card-title">${t('Inspect every token (advanced)')}</span><span class="section-card-chev" aria-hidden="true">${icon('chevronRight', { size: 16 })}</span></summary>
      <p class="tk-adv-sub">${t('Search, filter and edit any token’s stored value. Changes are reviewed before they apply.')}</p>
      <div data-tk-workspace></div>
    </details>`;

  const $ = <T extends HTMLElement>(sel: string): T | null => mount.querySelector<T>(sel);
  const main = $('[data-tk-main]')!;
  const list = $('[data-tok-list]')!;
  const err = $('[data-tok-err]');
  const headErr = $('[data-tk-err]');
  const example = $('[data-tk-example]');
  const uiFold = $<HTMLDetailsElement>('[data-tk-adv="ui"]')!;
  const inspectFold = $<HTMLDetailsElement>('[data-tk-adv="inspect"]')!;
  const uiStarter = $('[data-be-ui-starter]');
  const showErr = (m: string): void => { if (err) { err.textContent = m; err.hidden = !m; } if (m) announce(m, { assertive: true }); };
  const showHeadErr = (m: string): void => { if (headErr) { headErr.textContent = m; headErr.hidden = !m; } if (m) announce(m, { assertive: true }); };
  const openGroups = new Set<string>();
  let model = tokensRoomModel(ctx.doc(), ctx.starterIds?.(), ctx.userFontFamilies?.());
  let workspace: ReturnType<typeof mountTokenWorkspace> | undefined;
  let uiRendered = false;
  let openUiEditor = '';
  /** App appearance groups a person opened, kept open across a repaint. */
  const openUiGroups = new Set<string>();

  // ── Copy and the head actions ──────────────────────────────────────────────
  // A row's copy control shows the reference it copies, so pressing it never puts
  // something on the clipboard that the row did not show.
  const refBtn = (ref: string): string => {
    const label = escape(tRaw('Copy {ref}', { ref }));
    return `<button type="button" class="tk-ref" data-tk-copy="${escape(ref)}" aria-label="${label}" title="${label}"><code>${escape(ref)}</code><span class="tk-ref-ic" aria-hidden="true">${icon('duplicate', { size: 12 })}</span></button>`;
  };
  const clearCopyErrors = (): void => { for (const el of mount.querySelectorAll('.tk-copy-err')) el.remove(); };
  /** The clipboard said no (a locked-down or embedded browser). The message goes
   *  beside the control that was pressed, with the text selected to copy by hand. */
  const copyRefused = (from: HTMLElement | null, text: string): void => {
    const message = t('Lolly couldn’t reach the clipboard. Select this and copy by hand:');
    announce(message, { assertive: true });
    const row = from?.closest<HTMLElement>('li, [data-tok-row]');
    if (!row) { showHeadErr(t('Lolly couldn’t reach the clipboard. Choose CSS variables and Download instead.')); return; }
    const note = document.createElement('p');
    note.className = 'be-err tk-copy-err';
    note.setAttribute('role', 'alert');
    note.textContent = `${message} `;
    const code = document.createElement('code');
    code.className = 'tk-copy-manual';
    code.textContent = text;
    note.appendChild(code);
    row.appendChild(note);
    const range = document.createRange();
    range.selectNodeContents(code);
    const selection = window.getSelection();
    selection?.removeAllRanges(); selection?.addRange(range);
  };
  const copyText = async (text: string, said: string, from: HTMLElement | null): Promise<void> => {
    clearCopyErrors();
    showHeadErr('');
    try {
      await ctx.host.clipboard.writeText(text);
      announce(said);
    } catch {
      if (from?.matches('[data-tk-copy-css]')) showHeadErr(t('Lolly couldn’t reach the clipboard. Choose CSS variables and Download instead.'));
      else copyRefused(from, text);
    }
  };
  const activeSlug = async (): Promise<{ label: string; slug: string }> => {
    const label = (await ctx.host.tokens?.active?.().catch(() => null))?.label ?? '';
    const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return { label: label || t('Design system'), slug: slug || 'design-system' };
  };
  /** A save that failed or was turned down. A cancelled save dialog is the person's choice, so it says nothing. */
  const saveFailed = (error: unknown): void => {
    if ((error as { name?: unknown })?.name === 'AbortError') return;
    showHeadErr(t('Lolly couldn’t save the file. Try again, or choose another format.'));
  };
  $('[data-tk-download]')?.addEventListener('click', async () => {
    showHeadErr('');
    try {
      const format = ($<HTMLSelectElement>('[data-tk-fmt]')?.value ?? 'tokens-json') as SwatchExportFormat;
      const { label, slug } = await activeSlug();
      const { saveBlob } = await import('../pro/zip.ts');
      if (format === 'tokens-json') {
        const filename = `${slug}.tokens.json`;
        await saveBlob(new Blob([JSON.stringify(ctx.doc(), null, 2)], { type: 'application/json' }), filename);
        announce(tRaw('Downloaded {filename}', { filename }));
        return;
      }
      const { exportSwatches } = await import('./swatch-export.ts');
      const { blob, filename } = exportSwatches(ctx.swatches(), format, label);
      await saveBlob(blob, filename);
      announce(tRaw('Palette downloaded as {filename}', { filename }));
    } catch (error) { saveFailed(error); }
  });
  $('[data-tk-copy-css]')?.addEventListener('click', async (e) => {
    const button = e.currentTarget as HTMLElement;
    let text = '';
    try {
      const { exportSwatches } = await import('./swatch-export.ts');
      text = await exportSwatches(ctx.swatches(), 'css-vars').blob.text();
    } catch { showHeadErr(t('Lolly couldn’t write the CSS for this palette.')); return; }
    await copyText(text, t('CSS variables copied'), button);
  });
  // The importer belongs to the studio view, not this room. A hash link would land
  // on the route already showing; the event is the lolly:* convention the rooms use.
  mount.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-tk-import]')) { mount.dispatchEvent(new CustomEvent('lolly:start-import', { bubbles: true })); return; }
    const copy = target.closest<HTMLElement>('[data-tk-copy]');
    if (copy) { const ref = copy.dataset.tkCopy ?? ''; void copyText(ref, tRaw('Copied {ref}', { ref }), copy); return; }
    const chip = target.closest<HTMLElement>('[data-tk-sec="color"] [data-stu-tile]');
    if (chip) { const ref = `{${chipKeys[Number(chip.dataset.stuTile)] ?? ''}}`; if (ref !== '{}') void copyText(ref, tRaw('Copied {ref}', { ref }), chip); return; }
    const more = target.closest<HTMLButtonElement>('[data-tk-more]');
    if (more) {
      const group = more.closest<HTMLElement>('[data-tk-group]');
      const id = group?.dataset.tkGroup ?? '';
      const open = !group?.classList.contains('is-open');
      group?.classList.toggle('is-open', open);
      if (open) openGroups.add(id); else openGroups.delete(id);
      more.setAttribute('aria-expanded', String(open));
      more.textContent = open ? t('Show fewer') : tRaw('Show all {n}', { n: Number(more.dataset.tkMore) });
      return;
    }
    const jump = target.closest<HTMLElement>('[data-tk-jump]');
    if (jump) jumpTo(jump.dataset.tkJump as RoomSection);
  });

  const jumpTo = (id: RoomSection): void => {
    if (id === 'all') { inspectFold.open = true; ensureWorkspace(); }
    const el = id === 'all' ? inspectFold : $(`[data-tk-sec="${id}"]`);
    if (!el) return;
    if (id === 'all') inspectFold.querySelector<HTMLElement>('summary')?.focus({ preventScroll: true });
    else el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'start', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  };

  // ── The room's drawn half: tiles and the Colours, Type and Logos sections ──
  let chipKeys: string[] = [];
  const emptyHtml = (sentenceText: string, actions: string, extra = '', note = ''): string =>
    `<div class="tk-empty${extra}"><p>${sentenceText}</p>${note ? `<p class="tk-empty-note">${note}</p>` : ''}${actions ? `<div class="tk-empty-actions">${actions}</div>` : ''}</div>`;
  const pickColour = `<a class="be-btn be-btn--sm" href="#/start?area=color">${t('Pick a colour')}</a>`;
  const chooseFace = `<a class="be-btn be-btn--sm" href="#/start?area=type">${t('Choose a face')}</a>`;
  const addLogo = `<a class="be-btn be-btn--sm" href="#/start?area=logos">${t('Add a logo')}</a>`;
  const addFrom = `<button type="button" class="be-btn be-btn--sm" data-tk-import aria-haspopup="dialog">${t('Add from…')}</button>`;
  const starterTag = (): string => `<span class="tk-tag">${t('Starter')}</span>`;

  const pairsHtml = (pairs: ContrastPair[], mode: 'light' | 'dark', labelled: boolean): string => pairs.length ? `
    <div class="tk-pairs" data-tk-pairs="${mode}">${labelled ? `<span class="tk-pairs-mode">${mode === 'dark' ? t('Dark') : t('Light')}</span>` : ''}
      <ul class="tk-pair-list" role="list">${pairs.map(p => `
        <li class="tk-pair-item"${p.contrast.weak ? ' data-weak' : ''} title="${escape(tRaw('WCAG {ratio}:1', { ratio: p.contrast.wcag.toFixed(1) }))}">
          <span class="tk-pair" style="--bg:${escape(p.bg)};--fg:${escape(p.fg)}" aria-hidden="true"><span class="tk-pair-aa">Aa</span></span>
          <span class="tk-pair-text"><span class="tk-pair-label">${p.label === 'text' ? t('Text on surface') : p.label === 'primary' ? t('On primary') : t('Muted on surface')}</span><span class="tk-pair-lc">${escape(tRaw('Lc {lc} · {band}', { lc: Math.round(Math.abs(p.contrast.lc)), band: p.contrast.label }))}</span></span>
          ${p.contrast.weak ? `<span class="tk-pair-weak" role="img" aria-label="${escape(t('Weak contrast'))}">${icon('alert', { size: 14 })}</span>` : ''}
        </li>`).join('')}
      </ul>
    </div>` : '';

  const colourGroupHtml = (g: ColourGroup): string => {
    // One Starter tag on the group when every colour in it is the starter's; a
    // tag on each row only where a group mixes the two.
    const allStarter = g.rows.length > 0 && g.rows.every(r => r.starter);
    if (g.ramp) {
      const chips = g.rows.map(r => { chipKeys.push(r.key); return swatchTile({ label: tRaw('Copy the reference for {name}', { name: `${r.name} ${r.hex}` }), hex: r.hex }, { size: 'sm', idx: chipKeys.length - 1 }); }).join('');
      return `<div class="tk-group tk-group--ramp">
        <div class="tk-group-head"><span class="tk-group-name">${escape(g.label)}</span>${g.neutral ? '' : `<span class="tk-group-n">${g.rows.length}</span>`}${allStarter && !g.note ? starterTag() : ''}</div>
        <div class="tk-ramp">${chips}</div>
        ${g.note ? `<p class="tk-group-note">${t("Lolly's ink and paper. Tools use them until the design system has colours of its own.")}</p>` : ''}
      </div>`;
    }
    const open = openGroups.has(g.id);
    return `<div class="tk-group${open ? ' is-open' : ''}" data-tk-group="${escape(g.id)}">
      <div class="tk-group-head"><span class="tk-group-name">${escape(g.label)}</span><span class="tk-group-n">${g.rows.length}</span>${allStarter ? starterTag() : ''}</div>
      <ul class="tk-colors" role="list">${g.rows.map(r => `<li class="tk-color"${r.title ? ` title="${escape(r.title)}"` : ''}><span class="tk-chip" style="--sw:${escape(r.hex || 'transparent')}" aria-hidden="true"></span><span class="tk-color-main"><span class="tk-color-line"><span class="tk-color-name">${escape(r.name)}</span>${r.starter && !allStarter ? starterTag() : ''}<code class="tk-color-value">${escape(r.value)}</code></span>${refBtn(`{${r.key}}`)}</span></li>`).join('')}</ul>
      ${g.rows.length > GROUP_PEEK ? `<button type="button" class="be-btn be-btn--sm tk-group-more" data-tk-more="${g.rows.length}" aria-expanded="${open}">${open ? t('Show fewer') : t('Show all {n}', { n: g.rows.length })}</button>` : ''}
    </div>`;
  };

  const fontRowHtml = (f: NamedRow): string =>
    `<li class="tk-row">${tokenPreviewHtml('fontFamily', f.raw)}<span class="tk-row-text"><span class="tk-row-line"><span class="tk-row-name">${escape(f.name)}</span><span class="tk-row-value">${escape(f.value)}</span></span>${refBtn(`{${f.key}}`)}</span></li>`;
  const logoRowHtml = (l: LogoRow): string =>
    `<li class="tk-row"><span class="tk-logo${/reverse$/.test(l.key) ? ' is-reverse' : ''}" data-tk-logo="${escape(l.assetId)}" aria-hidden="true"></span><span class="tk-row-text"><span class="tk-row-line"><span class="tk-row-name">${escape(l.name)}</span>${l.sameAs
      ? `<span class="tk-row-value" title="${escape(l.value)}">${escape(tRaw('Same file as {name}', { name: l.sameAs }))}</span>`
      : `<code class="tk-row-value">${escape(l.value)}</code>`}</span>${refBtn(`{${l.key}}`)}</span></li>`;
  /** A section's own rows, then what came with the system under one Starter head. */
  const ownThenStarter = <R extends NamedRow>(rows: R[], row: (r: R) => string): string => {
    const own = rows.filter(r => !r.starter), inherited = rows.filter(r => r.starter);
    return `${own.length ? `<ul class="tk-rows" role="list">${own.map(row).join('')}</ul>` : ''}${inherited.length ? `<div class="tk-group">
      <div class="tk-group-head"><span class="tk-group-name">${t('Starter')}</span><span class="tk-group-n">${inherited.length}</span></div>
      <ul class="tk-rows" role="list">${inherited.map(row).join('')}</ul></div>` : ''}`;
  };

  const tileHtml = (id: RoomSection, preview = ''): string => {
    const label = sectionLabel(id), n = model.counts[id];
    const starterOnlyTile = !n && (id === 'color' || id === 'type' || id === 'logos') && model.starter[id] > 0;
    const aria = starterOnlyTile ? `${tRaw('{label}: {n}', { label, n })}, ${t('Starter')}` : tRaw('{label}: {n}', { label, n });
    return `<button type="button" class="tk-tile" data-tk-jump="${id}" aria-label="${escape(aria)}"><span class="tk-tile-ic" aria-hidden="true">${icon(SECTION_ICON[id])}</span><span class="tk-tile-n">${n}</span><span class="tk-tile-label">${label}</span><span class="tk-tile-preview" aria-hidden="true">${preview}${starterOnlyTile ? starterTag() : ''}</span></button>`;
  };

  const renderMain = (): void => {
    chipKeys = [];
    const m = model;
    if (m.empty) {
      const inherited = m.starter.color + m.starter.type + m.starter.logos > 0;
      main.innerHTML = emptyHtml(
        t('Nothing here yet. Tokens appear as you pick colours, choose a face and add logos. You can also start from a file.'),
        `${pickColour}${chooseFace}${addFrom}`, ' tk-empty--room',
        inherited ? t('Until then, tools use the starter colours, faces and logos that came with Lolly.') : '');
      return;
    }
    const ownHexes = m.groups.flatMap(g => g.rows).filter(r => r.hex && !r.starter && !isRoleKey(r.key)).slice(0, 5);
    const firstHexes = ownHexes.map(r => `<span class="tk-chip" style="--sw:${escape(r.hex)}"></span>`).join('');
    const brandFace = m.fonts.find(f => f.key === 'font.brand') ?? m.fonts[0];
    const faceStack = brandFace ? brandFontStack(brandFace.raw, 'sans-serif') : null;
    const tiles = `<nav class="tk-overview" aria-label="${escape(t('Token sections'))}" data-tk-overview>
      ${tileHtml('color', firstHexes)}${tileHtml('type', faceStack ? `<span class="tk-face-aa" style="font-family:${escape(faceStack)}">Aa</span>` : '')}${tileHtml('logos')}${tileHtml('shape')}${tileHtml('more')}${tileHtml('all')}
    </nav>`;

    const anyColour = m.counts.color + m.starter.color > 0;
    const colourAction = !anyColour ? '' : `<a class="be-btn be-btn--sm tk-sec-act" href="${m.starterOnly ? NEUTRALS_LINK : '#/start?area=color'}">${t('Edit in Colours')}</a>`;
    const colourBody = !anyColour
      ? emptyHtml(t('No colours yet. Pick a colour, or add from a file.'), `${pickColour}${addFrom}`)
      : `${pairsHtml(m.pairs.light, 'light', m.pairs.dark.length > 0)}${pairsHtml(m.pairs.dark, 'dark', true)}
        ${m.groups.map(colourGroupHtml).join('')}
        ${m.gradients.length ? `<div class="tk-group"><div class="tk-group-head"><span class="tk-group-name">${t('Gradients')}</span><span class="tk-group-n">${m.gradients.length}</span></div><ul class="tk-colors" role="list">${m.gradients.map(g => `<li class="tk-color tk-color--gradient">${tokenPreviewHtml('gradient', null, { css: g.css })}<span class="tk-color-main"><span class="tk-color-line"><span class="tk-color-name">${escape(g.name)}</span><a class="be-btn be-btn--sm" href="#/start?area=color">${t('Edit in Colours')}</a></span>${refBtn(`{${g.key}}`)}</span></li>`).join('')}</ul></div>` : ''}`;

    // A section with nothing of the person's own leads with its blank state, and
    // whatever came with the system follows under one Starter head.
    const typeBody = !m.fonts.length
      ? emptyHtml(t('No typeface chosen yet. Lolly uses SUSE until you pick one.'), chooseFace)
      : `${m.counts.type ? '' : emptyHtml(t('No typeface of your own yet. Tools use the starter faces below until you choose one.'), chooseFace)}${ownThenStarter(m.fonts, fontRowHtml)}`;
    const logosBody = !m.logos.length
      ? emptyHtml(t('No logos yet. Drop a logo file and Lolly suggests its slot.'), addLogo)
      : `${m.counts.logos ? '' : emptyHtml(t('No logos of your own yet. Tools use the starter marks below until you add one.'), addLogo)}${ownThenStarter(m.logos, logoRowHtml)}`;

    const section = (id: RoomSection, sub: string, body: string, action = ''): string =>
      `<section class="be-panel tk-sec" data-tk-sec="${id}" aria-labelledby="tk-sec-${id}" tabindex="-1">${secHead(id, m.counts[id], action)}<p class="tk-sec-sub">${sub}</p><div class="tk-sec-body" data-tk-body="${id}">${body}</div></section>`;
    main.innerHTML = tiles
      + section('color', t('Swatches, shades and the pairs tools put together.'), colourBody, colourAction)
      + section('type', t('The faces tools use for text, headings and code.'), typeBody, m.counts.type ? `<a class="be-btn be-btn--sm tk-sec-act" href="#/start?area=type">${t('Edit in Type')}</a>` : '')
      + section('logos', t('Marks tools can place. Add or replace them in Logos.'), logosBody, m.counts.logos ? `<a class="be-btn be-btn--sm tk-sec-act" href="#/start?area=logos">${t('Edit in Logos')}</a>` : '');
    void paintLogos();
  };

  /** Each logo row's mark, drawn from the asset itself. `_getCurrent` is the
   *  bridge's read that records nothing (assets.get keeps a placement record);
   *  a host without it leaves the rows text-only. The bridge caches each URL. */
  const logoUrls = new Map<string, Promise<string>>();
  const paintLogos = async (): Promise<void> => {
    const read = (ctx.host.assets as unknown as { _getCurrent?: (id: string) => Promise<{ url?: string }> })?._getCurrent;
    if (typeof read !== 'function') return;
    for (const slot of main.querySelectorAll<HTMLElement>('[data-tk-logo]')) {
      const id = slot.dataset.tkLogo ?? '';
      if (!id) continue;
      if (!logoUrls.has(id)) logoUrls.set(id, read.call(ctx.host.assets, id).then(ref => ref?.url ?? '', () => ''));
      const url = await logoUrls.get(id)!;
      if (!url || !slot.isConnected || slot.firstChild) continue;
      const img = document.createElement('img');
      img.alt = ''; img.decoding = 'async'; img.loading = 'lazy'; img.src = url;
      slot.appendChild(img);
    }
  };

  const renderExample = (): void => {
    if (!example) return;
    example.hidden = !model.example;
    example.textContent = model.example ? tRaw('For example, Primary is {name}, {hex}.', { name: model.example.name, hex: model.example.hex }) : '';
  };

  // ── Shape and spacing: the two sliders ──────────────────────────────────────
  // Live app-wide preview on every drag tick (the CSS variable on <html>), a
  // debounced write through the editor's own document, so the next save from any
  // room carries it instead of putting the old value back.
  const dial = (key: 'radius' | 'space'): Dial => ({
    path: key === 'radius' ? 'shape.radius' : 'space.base',
    fallback: key === 'radius' ? 1 : .5,
    read: key === 'radius' ? brandRadiusValue : brandSpaceValue,
    write: key === 'radius' ? withRadiusToken : withSpaceToken,
    cssVar: key === 'radius' ? '--radius' : '--space',
    undo: () => (key === 'radius' ? t('Rounded corners') : t('Spacing rhythm')),
    paint: key === 'radius' ? (el, css) => { el.style.borderTopLeftRadius = css; } : (el, css) => { el.style.setProperty('--brand-space-preview', css); },
    slider: $<HTMLInputElement>(`[data-be-${key}-slider]`),
    preview: $(`[data-be-${key}-preview]`),
    valueEl: $(`[data-be-${key}-value]`),
    err: $(`[data-be-${key}-err]`),
    own: $(`[data-tk-${key}-own]`),
    pending: null, timer: undefined, dragging: false,
  });
  const dials = [dial('radius'), dial('space')];
  const seedDial = (d: Dial): void => {
    let stored: string | null = null;
    try { stored = d.read(leadTokenSet(ctx.doc(), 'light').resolve(d.path)); } catch { stored = null; }
    if (d.own) { d.own.textContent = stored ? t('Yours') : t('Lolly default'); d.own.classList.toggle('is-own', !!stored); }
    if (d.pending !== null || d.dragging) return; // never yank a slider out from under a drag
    const rem = stored ? remOf(stored) : d.fallback;
    const css = stored ?? `${d.fallback}rem`;
    if (d.slider) d.slider.value = String(rem);
    if (d.preview) d.paint(d.preview, `${rem}rem`);
    if (d.valueEl) d.valueEl.textContent = css;
  };
  const flushDial = (d: Dial, immediate = false): void => {
    clearTimeout(d.timer);
    const css = d.pending;
    if (css === null) return;
    d.pending = null;
    if (!d.read(css)) return;
    try {
      ctx.setDoc(d.write(ctx.doc(), css));
      if (d.err) d.err.hidden = true;
      ctx.persist(immediate); ctx.notify();
      if (d.own) { d.own.textContent = t('Yours'); d.own.classList.add('is-own'); }
    } catch (error) {
      if (d.err) { d.err.textContent = String((error as { message?: unknown })?.message ?? error); d.err.hidden = false; }
    }
  };
  for (const d of dials) {
    const { slider } = d;
    if (!slider) continue;
    slider.addEventListener('input', () => {
      if (!d.dragging) { ctx.pushUndo(d.undo()); d.dragging = true; }
      const css = `${slider.value}rem`;
      if (d.preview) d.paint(d.preview, css);
      if (d.valueEl) d.valueEl.textContent = css;
      document.documentElement.style.setProperty(d.cssVar, css);
      d.pending = css;
      clearTimeout(d.timer);
      d.timer = setTimeout(() => flushDial(d), 400);
    });
    slider.addEventListener('change', () => { flushDial(d); d.dragging = false; });
  }

  // ── More tokens ─────────────────────────────────────────────────────────────
  // A shadow token's colour uses our own picker (never the OS one), mounted over a
  // hidden holder input that carries the stored colour string, so the delegated
  // shadow commit (which reads [data-tok-field="color"] on `change`) keeps working.
  const wireShadowFields = (): void => {
    list.querySelectorAll<HTMLElement>('[data-shadow-cf]').forEach(span => {
      const row = span.closest<HTMLElement>('[data-tok-row]');
      const holder = row?.querySelector<HTMLInputElement>('input[data-tok-field="color"]');
      mountColorField(span, `shadow-${span.dataset.tokPath ?? ''}`, {
        value: holder?.value || '#000000', float: true,
        onChange: (v) => {
          if (!holder) return;
          holder.value = v; // canonical #rrggbb / #rrggbbaa: the shadow may carry alpha
          holder.dispatchEvent(new Event('change', { bubbles: true }));
        },
      });
    });
  };
  const renderMore = (): void => {
    const all = model.more;
    const n = $('[data-tk-n="more"]');
    if (n) n.textContent = String(all.length);
    if (!all.length) {
      list.innerHTML = `<p class="be-tok-empty">${t('No extra tokens yet - most brands start with a spacing unit and a card shadow.')}</p>`;
      return;
    }
    const byKind = new Map<StudioKind, StudioToken[]>();
    for (const tok of all) (byKind.get(tok.kind) ?? byKind.set(tok.kind, []).get(tok.kind)!).push(tok);
    list.innerHTML = [...byKind.entries()].map(([kind, items]) => `
      <div class="be-tok-group">
        <div class="be-tok-group-head"><span class="be-tok-group-label">${escape(t(KIND_LABEL.get(kind) ?? kind))}</span><span class="be-tok-group-n">${items.length}</span></div>
        ${items.map(tok => `
          <div class="be-tok-row" data-tok-row data-tok-path="${pathAttr(tok)}">
            <span class="tk-prev" data-tk-prev>${tok.kind === 'shadow' ? '' : tokenPreviewHtml(KIND_TYPE[tok.kind], tok.raw, { path: tok.key })}</span>
            <span class="tk-name-stack"><span class="be-tok-name">${escape(tok.name)}</span>${refBtn(`{${tok.key}}`)}</span>
            <span class="be-tok-editor">${tokenValueEditor(tok)}</span>
            <button type="button" class="be-tok-del" data-tok-del="${pathAttr(tok)}" aria-label="${escape(tRaw('Delete {name}', { name: tok.name }))}">&#x2715;</button>
          </div>`).join('')}
      </div>`).join('');
    wireShadowFields();
  };

  // ── App appearance: Lolly's own UI starter roles ────────────────────────────
  /**
   * The app's semantic role set is a preview, not a preset that quietly bloats
   * every new brand. A role becomes owned only when its edited value is saved
   * below. The stock value is resolved against the canonical Lolly document, so
   * an authored override is always a literal the live CSS projection can check.
   */
  /** A role's name inside its group: the group is the summary above, so it is dropped here. */
  const uiLabel = (path: readonly string[]): string => {
    const s = (path.length > 1 ? path.slice(1) : path).map(segment => segment.replace(/-/g, ' ').replace(/\bui\b/g, 'UI')).join(' · ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  const uiCurrent = (tok: typeof UI_STARTER_TOKENS[number], own: Record<string, unknown> | null): unknown =>
    own?.$value ?? own?.value ?? UI_DEFAULTS.resolve(`lolly.ui.${tok.path.join('.')}`) ?? tok.value;
  const renderUiStarter = (): void => {
    if (!uiStarter) return;
    uiRendered = true;
    const doc = ctx.doc();
    const owned = new Map(UI_STARTER_TOKENS.map(tok => [uiPath(tok.path), lollyUiOverride(doc, tok.path)]));
    const groups = new Map<string, typeof UI_STARTER_TOKENS>();
    for (const tok of UI_STARTER_TOKENS) {
      const group = tok.path[0] ?? 'other';
      (groups.get(group) ?? groups.set(group, []).get(group)!).push(tok);
    }
    const ownedCount = [...owned.values()].filter(Boolean).length;
    // Two words for one idea, used everywhere in this fold: a role is the Lolly
    // default until a person saves a value of their own for that role.
    uiStarter.innerHTML = `
      <div class="be-ui-starter-head">
        <p class="be-ui-starter-note">${tRaw('These stay out of your design system and its tokens file until you save a value of your own, kept as one {path} token.', { path: '<code>lolly.ui</code>' })}</p>
        <span class="be-ui-starter-count">${ownedCount ? tRaw('{owned} of {total} yours', { owned: ownedCount, total: UI_STARTER_TOKENS.length }) : tRaw('{total} Lolly defaults', { total: UI_STARTER_TOKENS.length })}</span>
      </div>
      <div class="be-ui-starter-groups">
        ${[...groups.entries()].map(([group, tokens]) => `
          <details class="be-ui-group" data-ui-group="${escape(group)}" ${openUiGroups.has(group) || tokens.some(tok => uiPath(tok.path) === openUiEditor) ? 'open' : ''}>
            <summary><span>${uiGroupLabel(group)}</span><span class="be-ui-group-count">${tokens.length}</span>${tokens.some(tok => owned.get(uiPath(tok.path))) ? `<span class="tk-tag is-own">${tRaw('{n} yours', { n: tokens.filter(tok => owned.get(uiPath(tok.path))).length })}</span>` : ''}</summary>
            <div class="be-ui-role-list">
              ${tokens.map(tok => {
                const key = uiPath(tok.path);
                const own = owned.get(key) ?? null;
                const kind = UI_KIND[tok.type];
                const current = uiCurrent(tok, own);
                const textValue = uiValueText(current);
                const editing = openUiEditor === key;
                const previewType = UI_PREVIEW_TYPE[tok.type] ?? tok.type;
                return `<article class="be-ui-role${own ? ' is-owned' : ''}" data-ui-role="${escape(key)}">
                  <div class="be-ui-role-meta">
                    <span class="be-ui-role-name">${escape(uiLabel(tok.path))}</span>
                    <code class="be-ui-role-path">lolly.ui.${escape(tok.path.join('.'))}</code>
                  </div>
                  <div class="be-ui-role-state"><span class="be-ui-role-value">${tokenPreviewHtml(previewType, current, { path: tok.path.join('.') })}<span class="be-ui-role-text">${escape(tokenValueText(previewType, current))}</span></span><span class="be-ui-role-badge">${own ? t('Your value') : t('Lolly default')}</span></div>
                  <div class="be-ui-role-actions">
                    ${kind ? `<button type="button" class="be-btn be-btn--sm" data-ui-customize="${escape(key)}" aria-expanded="${editing}">${editing ? t('Close editor') : own ? t('Edit') : t('Customise')}</button>` : ''}
                    ${own ? `<button type="button" class="be-btn be-btn--sm" data-ui-reset="${escape(key)}">${t('Reset')}</button>` : ''}
                  </div>
                  ${editing && kind ? `<form class="be-ui-edit" data-ui-edit="${escape(key)}">
                    <label>${escape(tRaw('New value for {name}', { name: uiLabel(tok.path) }))}
                      ${kind === 'color'
                        ? `<span class="be-ui-cf" data-ui-cf></span><input type="hidden" data-ui-value value="${escape(textValue)}">`
                        : kind === 'shadow' || kind === 'easing'
                          ? `<textarea data-ui-value rows="3" spellcheck="false">${escape(textValue)}</textarea>`
                          : `<input type="text" data-ui-value value="${escape(textValue)}" spellcheck="false" autocomplete="off"${kind === 'length' ? ' inputmode="decimal"' : ''}>`}
                    </label>
                    <p>${t('Lolly keeps its default until you save a new value.')}</p>
                    <p class="be-err" data-ui-err role="alert" hidden></p>
                    <button type="submit" class="be-cta" data-ui-save="${escape(key)}" disabled>${t('Save')}</button>
                  </form>` : ''}
                </article>`;
              }).join('')}
            </div>
          </details>`).join('')}
      </div>`;
    // A colour role edits through the app's own picker, writing a hidden holder.
    const cf = uiStarter.querySelector<HTMLElement>('[data-ui-cf]');
    const holder = uiStarter.querySelector<HTMLInputElement>('input[type="hidden"][data-ui-value]');
    if (cf && holder) {
      mountColorField(cf, `ui-${openUiEditor}`, {
        value: holder.value, float: true,
        onChange: (v) => { holder.value = v; holder.dispatchEvent(new Event('input', { bubbles: true })); },
      });
    }
  };
  const closeUiEditor = (key: string): void => {
    openUiEditor = '';
    renderUiStarter();
    uiStarter?.querySelector<HTMLButtonElement>(`[data-ui-customize="${CSS.escape(key)}"]`)?.focus();
  };
  uiFold.addEventListener('toggle', () => { if (uiFold.open && !uiRendered) renderUiStarter(); });
  // toggle does not bubble, so listen in the capture phase for the groups inside.
  uiStarter?.addEventListener('toggle', (e) => {
    const group = (e.target as HTMLElement).closest<HTMLDetailsElement>('[data-ui-group]');
    if (!group || e.target !== group) return;
    if (group.open) openUiGroups.add(group.dataset.uiGroup ?? ''); else openUiGroups.delete(group.dataset.uiGroup ?? '');
  }, true);

  // ── Inspect every token: the workspace, mounted on first open ──────────────
  const ensureWorkspace = (): void => {
    if (workspace) return;
    const root = $('[data-tk-workspace]');
    if (!root) return;
    workspace = mountTokenWorkspace(root, {
      label: t('All tokens'), embedded: true, read: ctx.doc, host: ctx.host, consumers: webTokenConsumerSources(ctx.host),
      commit: candidate => {
        const current = ctx.doc();
        for (const key of Object.keys(current)) delete current[key];
        Object.assign(current, candidate);
        render();
        ctx.persist(true); ctx.notify();
        ctx.onDocReplaced?.();
      },
    });
  };
  inspectFold.addEventListener('toggle', () => { if (inspectFold.open) ensureWorkspace(); });

  const render = (): void => {
    model = tokensRoomModel(ctx.doc(), ctx.starterIds?.(), ctx.userFontFamilies?.());
    renderExample();
    renderMain();
    for (const d of dials) seedDial(d);
    renderMore();
    if (uiRendered) renderUiStarter();
    workspace?.refresh();
  };
  render();

  uiStarter?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const key = target.closest<HTMLButtonElement>('[data-ui-customize]')?.dataset.uiCustomize;
    if (key) {
      openUiEditor = openUiEditor === key ? '' : key;
      renderUiStarter();
      if (openUiEditor) {
        const form = uiStarter.querySelector<HTMLElement>('[data-ui-edit]');
        form?.querySelector<HTMLElement>('textarea[data-ui-value], input[type="text"][data-ui-value], [data-ui-cf] button')?.focus();
      } else uiStarter.querySelector<HTMLButtonElement>(`[data-ui-customize="${CSS.escape(key)}"]`)?.focus();
      return;
    }
    const reset = target.closest<HTMLButtonElement>('[data-ui-reset]')?.dataset.uiReset;
    if (!reset) return;
    const token = UI_STARTER_TOKENS.find(item => uiPath(item.path) === reset);
    if (!token || !removeLollyUiOverride(ctx.doc(), token.path)) return;
    openUiEditor = '';
    renderUiStarter(); ctx.persist(true); ctx.notify();
    announce(tRaw('{name} reset to the Lolly default', { name: uiLabel(token.path) }));
  });
  uiStarter?.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !openUiEditor) return;
    // The studio reads a bare Escape as "leave". Anywhere in a role whose editor is
    // open (the form, or its Close editor toggle after a Shift+Tab) it closes the
    // editor instead, and focus moves to that toggle.
    const target = e.target as HTMLElement;
    const key = target.closest<HTMLElement>('[data-ui-edit]')?.dataset.uiEdit
      ?? target.closest<HTMLElement>('[data-ui-role]')?.dataset.uiRole;
    if (key !== openUiEditor) return;
    e.preventDefault(); e.stopPropagation();
    closeUiEditor(key);
  });
  uiStarter?.addEventListener('input', (e) => {
    const input = e.target as HTMLInputElement | HTMLTextAreaElement;
    if (!input.matches('[data-ui-value]')) return;
    const form = input.closest<HTMLFormElement>('[data-ui-edit]');
    const token = UI_STARTER_TOKENS.find(item => uiPath(item.path) === form?.dataset.uiEdit);
    const save = form?.querySelector<HTMLButtonElement>('[data-ui-save]');
    if (!token || !save) return;
    const formErr = form?.querySelector<HTMLElement>('[data-ui-err]');
    if (formErr) formErr.hidden = true;
    input.removeAttribute('aria-invalid');
    save.disabled = input.value === uiValueText(uiCurrent(token, lollyUiOverride(ctx.doc(), token.path)));
  });
  uiStarter?.addEventListener('submit', (e) => {
    const form = e.target as HTMLFormElement;
    if (!form.matches('[data-ui-edit]')) return;
    e.preventDefault();
    const token = UI_STARTER_TOKENS.find(item => uiPath(item.path) === form.dataset.uiEdit);
    const input = form.querySelector<HTMLInputElement | HTMLTextAreaElement>('[data-ui-value]');
    const kind = token ? UI_KIND[token.type] : undefined;
    if (!token || !input) return;
    let value: unknown;
    let usable = !!kind;
    try { if (kind) value = parseUiValue(input.value, kind); } catch { usable = false; }
    if (!usable || !kind || !uiValueUsable(token.type, kind, value)) {
      const formErr = form.querySelector<HTMLElement>('[data-ui-err]');
      const message = t('That isn’t a value Lolly can read. Try #ff0000 or 16px.');
      if (formErr) { formErr.textContent = message; formErr.hidden = false; }
      input.setAttribute('aria-invalid', 'true');
      announce(message, { assertive: true });
      return;
    }
    setLollyUiOverride(ctx.doc(), token.path, token.type, value);
    openUiEditor = '';
    renderUiStarter(); ctx.persist(true); ctx.notify(); playSfx('click');
    uiStarter.querySelector<HTMLButtonElement>(`[data-ui-customize="${CSS.escape(uiPath(token.path))}"]`)?.focus();
    announce(tRaw('{name} saved', { name: uiLabel(token.path) }));
  });

  // ── More tokens: one delegated commit for every editor control ─────────────
  // Range/number commit on input (cheap and atomic); text dimensions commit on
  // change so a half-typed "1.5re" never lands.
  const rowError = (row: HTMLElement | null, el: HTMLInputElement, message: string): void => {
    el.setAttribute('aria-invalid', 'true');
    if (!row) return;
    let slot = row.querySelector<HTMLElement>('.tk-row-err');
    if (!slot) { slot = document.createElement('span'); slot.className = 'be-err tk-row-err'; slot.setAttribute('role', 'alert'); row.appendChild(slot); }
    slot.textContent = message;
  };
  const clearRowError = (row: HTMLElement | null, el: HTMLInputElement): void => {
    el.removeAttribute('aria-invalid');
    row?.querySelector('.tk-row-err')?.remove();
  };
  const refreshRowPreview = (row: HTMLElement | null, tok: StudioToken | undefined): void => {
    const prev = row?.querySelector<HTMLElement>('[data-tk-prev] > *');
    if (!prev || !tok) return;
    if (prev.classList.contains('tk-bar') && typeof tok.raw === 'string') prev.style.setProperty('--len', tok.raw);
    if (prev.classList.contains('tk-chip--opacity') && typeof tok.raw === 'number') prev.style.setProperty('--op', String(tok.raw));
    if (prev.classList.contains('tk-turn') && typeof tok.raw === 'number') prev.style.setProperty('--turn', `${tok.raw}deg`);
  };
  const findTok = (path: string[]): StudioToken | undefined => listStudioTokens(ctx.doc()).find(x => x.path.join('␟') === path.join('␟'));
  const commit = (el: HTMLInputElement): void => {
    const path = pathFrom(el.dataset.tokPath ?? '');
    const kind = el.dataset.tokInput;
    const row = el.closest<HTMLElement>('[data-tok-row]');
    // A cleared number field reports '' and Number('') is 0, which would persist
    // a value the user never typed. Wait for real input (or a blur revert).
    if ((kind === 'rotation' || kind === 'number' || kind === 'opacity') && el.value.trim() === '') return;
    let ok = false;
    if (kind === 'shadow') {
      if (row) ok = setStudioTokenValue(ctx.doc(), path, shadowFromRow(row, el.dataset.tokField, findTok(path)?.raw));
      if (ok) {
        const chip = row?.querySelector<HTMLElement>('.be-tok-shadow-chip');
        const tok = findTok(path);
        if (chip && tok) chip.style.boxShadow = formatStudioValue(tok);
      }
    } else if (kind === 'opacity') {
      ok = setStudioTokenValue(ctx.doc(), path, Number(el.value));
      const out = el.parentElement?.querySelector<HTMLElement>('[data-tok-out]');
      if (out) out.textContent = String(Number(el.value));
    } else if (kind === 'rotation' || kind === 'number') {
      ok = setStudioTokenValue(ctx.doc(), path, Number(el.value));
    } else {
      ok = setStudioTokenValue(ctx.doc(), path, el.value);
    }
    if (!ok) {
      rowError(row, el, t(kind === 'dimension' ? "Couldn't read that value - use a CSS length like 8px or 0.5rem." : "Couldn't read that value - check it and try again."));
      return;
    }
    clearRowError(row, el);
    showErr('');
    refreshRowPreview(row, findTok(path));
    ctx.persist();
    ctx.notify();
  };
  list.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.tokInput === 'opacity' || el.dataset.tokInput === 'rotation' || el.dataset.tokInput === 'number') commit(el);
  });
  list.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.tokInput === 'dimension' || el.dataset.tokInput === 'shadow') commit(el);
  });
  // A refused value is put back on blur, so the field never shows a value the document does not hold.
  list.addEventListener('focusout', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.getAttribute('aria-invalid') !== 'true' || !el.dataset.tokPath) return;
    const tok = findTok(pathFrom(el.dataset.tokPath));
    const field = el.dataset.tokField;
    if (tok) el.value = field && isRecObj(tok.raw) ? String(tok.raw[field] ?? '') : String(tok.raw ?? '');
    clearRowError(el.closest<HTMLElement>('[data-tok-row]'), el);
  });
  list.addEventListener('click', async (e) => {
    const del = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-tok-del]'); if (!del) return;
    const path = pathFrom(del.dataset.tokDel ?? '');
    const tok = findTok(path);
    const ok = await confirmDialog({ title: tRaw('Delete {name}?', { name: tok?.name ?? t('this token') }), message: t('Anything reading it falls back to its own default.'), confirmLabel: t('Delete') });
    if (!ok) return;
    if (deleteStudioToken(ctx.doc(), path)) { render(); ctx.persist(true); ctx.notify(); }
  });
  $<HTMLFormElement>('[data-tok-add]')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const kindSel = $<HTMLSelectElement>('[data-tok-add-kind]');
    const nameInput = $<HTMLInputElement>('[data-tok-add-name]');
    const kind = (kindSel?.value ?? 'spacing') as StudioKind;
    const name = nameInput?.value.trim() ?? '';
    if (!name) { showErr(t('Name the token first.')); nameInput?.focus(); return; }
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const clash = listStudioTokens(ctx.doc()).some(x => x.kind === kind && (x.name.trim().toLowerCase() === name.toLowerCase() || x.path.at(-1) === slug));
    if (clash) { showErr(tRaw('You already have a token called {name}.', { name })); nameInput?.focus(); return; }
    const path = addStudioToken(ctx.doc(), kind, name, defaultValueFor(kind));
    if (!path) { showErr(t("Couldn't add that token.")); return; }
    showErr('');
    if (nameInput) nameInput.value = '';
    render(); ctx.persist(true); ctx.notify(); playSfx('click');
    announce(tRaw('{name} added', { name }));
    // Land focus on the fresh row's first control so the value is one keystroke away.
    list.querySelector<HTMLElement>(`[data-tok-row][data-tok-path="${pathAttr({ path } as StudioToken)}"] input`)?.focus();
  });

  // A face installed or removed elsewhere changes which faces are the person's own.
  const onFonts = (): void => { render(); };
  document.addEventListener('lolly:brand-fonts', onFonts);

  return {
    render,
    teardown: () => {
      document.removeEventListener('lolly:brand-fonts', onFonts);
      for (const d of dials) flushDial(d, true);
      workspace?.teardown();
    },
  };
}

// ── Gradients panel (Colour tab) ──────────────────────────────────────────────

/** One palette swatch as the gradient stop picker sees it - `ref` is the
 *  canonical `{color.…}` alias a stop stores. Built by brand-editor.ts from
 *  the same walkSwatches output the palette grid renders. */
export interface GradientSwatch { ref: string; hex: string; label: string; group: string }

export interface GradientsCtx extends StudioTabCtx {
  primaryHex: () => string;
  paletteHexes: () => string[];
  /** The committed palette, in grid order (alias roles excluded). */
  paletteSwatches: () => GradientSwatch[];
  /** A `{path}` alias → resolved hex against the live doc, or null. */
  resolveRef: (ref: string) => string | null;
  /** The committed-palette seam (BrandEditorHandle.onPalette - fires from BOTH
   *  repaintPalette and persist(); double-fires expected, so subscribers must
   *  be idempotent). Returns an unsubscribe. */
  onPalette: (cb: () => void) => () => void;
}

const GRAD_STOPS_MIN = 2;
const GRAD_STOPS_MAX = 8;

export function mountGradientsPanel(mount: HTMLElement, ctx: GradientsCtx): StudioPanelHandle {
  mount.innerHTML = `
    ${panelHead(t('Gradients'), t("Optional colour tokens - blends of the palette for backgrounds and accents. Stops wear the swatches, so they follow a recolour. Skip these entirely if the design system doesn't do gradients."))}
    <details class="be-subst-details be-grads-details" data-be-grads-details>
      <summary><span class="be-subst-details-label">${t('Gradients')}</span><span class="be-subst-chips"><span class="be-ps-chip" data-grad-count></span></span></summary>
      <div class="be-grad-list" data-grad-list></div>
      <button type="button" class="be-add" data-grad-add>${t('+ Add gradient')}</button>
      <p class="be-err" data-grad-err hidden></p>
    </details>
    <div class="be-grad-pop" data-grad-pop hidden>
      <div class="be-grad-pop-card" role="dialog" aria-label="${escape(t('Stop colour'))}">
        <div class="be-grad-pop-grid" data-grad-pop-grid></div>
        <details class="be-grad-pop-custom" data-grad-pop-custom>
          <summary>${t('Custom value')}</summary>
          <div class="be-grad-pop-customrow">
            <input type="text" class="be-fmt-input" data-grad-pop-hex placeholder="#rrggbb / oklch(…)" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="${escape(t('Custom stop value'))}">
          </div>
        </details>
      </div>
    </div>`;

  const list = mount.querySelector<HTMLElement>('[data-grad-list]')!;
  const details = mount.querySelector<HTMLDetailsElement>('[data-be-grads-details]');
  const countChip = mount.querySelector<HTMLElement>('[data-grad-count]');
  const err = mount.querySelector<HTMLElement>('[data-grad-err]');
  const showErr = (m: string): void => { if (err) { err.textContent = m; err.hidden = !m; } if (m) announce(m, { assertive: true }); };
  const grads = (): StudioToken[] => listStudioTokens(ctx.doc()).filter(t => t.kind === 'gradient');

  const stopsOf = (t: StudioToken): GradientStop[] => (Array.isArray(t.raw) ? (t.raw as GradientStop[]) : []);
  /** A stop's renderable colour ('transparent' when its alias can't answer). */
  const stopCss = (s: GradientStop): string => resolveStopHex(s, ctx.resolveRef) ?? 'transparent';
  const previewCss = (t: StudioToken): string => gradientCss(t.raw, t.angle, { resolve: ctx.resolveRef, space: 'oklch' });
  /** The next palette swatch no stop already wears (by ref or resolved hex). */
  const nextUnusedSwatch = (stops: GradientStop[]): GradientSwatch | undefined => {
    const used = new Set<string>();
    for (const s of stops) {
      used.add(s.color);
      const hex = resolveStopHex(s, ctx.resolveRef);
      if (hex) used.add(hex.toLowerCase().slice(0, 7));
    }
    return ctx.paletteSwatches().find(w => !used.has(w.ref) && !used.has(w.hex.toLowerCase().slice(0, 7)));
  };

  const stopChipHtml = (tok: StudioToken, s: GradientStop, i: number, removable: boolean): string => {
    const p = pathAttr(tok);
    const isRef = isAlias(s.color);
    const swName = isRef ? ctx.paletteSwatches().find(w => w.ref === s.color)?.label ?? s.color : s.color;
    const label = tRaw('{name} stop {n} - {swatch}', { name: tok.name, n: i + 1, swatch: swName });
    return `<span class="be-grad-stopwrap">
        <button type="button" class="be-grad-stop-chip${isRef ? ' is-ref' : ''}" data-grad-stop="${i}" data-grad-path="${p}"
          style="--sw:${escape(stopCss(s))}" title="${escape(swName)}" aria-label="${escape(label)}" aria-haspopup="dialog"></button>
        ${removable ? `<button type="button" class="be-grad-stopdel" data-grad-stopdel="${i}" data-grad-path="${p}" aria-label="${escape(tRaw('Remove {label}', { label }))}">&#x2715;</button>` : ''}
      </span>`;
  };
  const rowHtml = (tok: StudioToken): string => {
    const stops = stopsOf(tok);
    const p = pathAttr(tok);
    const removable = stops.length > GRAD_STOPS_MIN;
    return `
      <div class="be-grad-row" data-grad-row data-grad-path="${p}">
        <span class="be-grad-preview" style="background:${escape(previewCss(tok))}" aria-hidden="true"></span>
        <span class="be-grad-meta">
          <span class="be-grad-name">${escape(tok.name)}</span>
          <span class="be-grad-stops">
            ${stops.map((s, i) => stopChipHtml(tok, s, i, removable)).join('')}
            ${stops.length < GRAD_STOPS_MAX ? `<button type="button" class="be-grad-addstop" data-grad-addstop="${p}" aria-label="${escape(tRaw('Add a stop to {name}', { name: tok.name }))}">+</button>` : ''}
            <label class="be-grad-nstops"><input type="number" min="${GRAD_STOPS_MIN}" max="${GRAD_STOPS_MAX}" step="1" value="${stops.length}" data-grad-nstops data-grad-path="${p}" aria-label="${escape(tRaw('{name} stop count', { name: tok.name }))}">${t('stops')}</label>
            <label class="be-grad-angle"><input type="number" value="${tok.angle ?? 180}" step="15" data-grad-angle data-grad-path="${p}" aria-label="${escape(tRaw('{name} angle', { name: tok.name }))}">°</label>
          </span>
        </span>
        <button type="button" class="be-tok-del" data-grad-del="${p}" aria-label="${escape(tRaw('Delete {name}', { name: tok.name }))}">&#x2715;</button>
      </div>`;
  };

  // ── The ONE shared stop popover - swatch grid first, custom value folded ────
  const pop = mount.querySelector<HTMLElement>('[data-grad-pop]')!;
  const popGrid = mount.querySelector<HTMLElement>('[data-grad-pop-grid]')!;
  const popCustom = mount.querySelector<HTMLDetailsElement>('[data-grad-pop-custom]')!;
  const popHex = mount.querySelector<HTMLInputElement>('[data-grad-pop-hex]')!;
  let popPath = ''; // pathAttr of the token whose stop is being edited ('' = closed)
  let popStop = -1;

  const closePop = (): void => { pop.hidden = true; popPath = ''; popStop = -1; };
  const popTarget = (): { t: StudioToken; stops: GradientStop[] } | null => {
    const t = tokenAt(popPath); if (!t) return null;
    const stops = stopsOf(t);
    return popStop >= 0 && popStop < stops.length ? { t, stops } : null;
  };
  const renderPopGrid = (): void => {
    const curColor = popTarget()?.stops[popStop]?.color ?? '';
    popGrid.innerHTML = ctx.paletteSwatches().map(w => `
      <button type="button" class="be-grad-pop-sw${w.ref === curColor ? ' is-active' : ''}" data-pop-ref="${escape(w.ref)}"
        style="--sw:${escape(w.hex)}" title="${escape(`${w.group} · ${w.label}`)}" aria-label="${escape(`${w.label} (${w.group})`)}" aria-pressed="${w.ref === curColor}"></button>`).join('');
  };
  const openPop = (chip: HTMLElement): void => {
    popPath = chip.dataset.gradPath ?? '';
    popStop = Number(chip.dataset.gradStop);
    const cur = popTarget();
    if (!cur) { closePop(); return; }
    const stop = cur.stops[popStop]!;
    renderPopGrid();
    popHex.value = isAlias(stop.color) ? '' : stop.color;
    popCustom.open = !isAlias(stop.color); // a literal stop opens on the row that set it
    pop.hidden = false;
    // Position under the chip, clamped inside the panel; flipped above when
    // the side pane's scrollport (or the viewport) would clip it below. The
    // popover is absolute INSIDE the panel, so the pane's own scroll carries
    // it with its anchor - no `.be`-space drift to chase.
    const mr = mount.getBoundingClientRect(), cr = chip.getBoundingClientRect();
    pop.style.left = `${Math.max(0, Math.min(cr.left - mr.left, mr.width - (pop.offsetWidth || 248)))}px`;
    const h = pop.offsetHeight;
    const scroller = mount.closest<HTMLElement>('.be-split-scroll');
    const limit = scroller && scroller.clientHeight < scroller.scrollHeight
      ? scroller.getBoundingClientRect().bottom : window.innerHeight;
    pop.style.top = cr.bottom + 6 + h <= limit
      ? `${cr.bottom - mr.top + 6}px`
      : `${Math.max(0, cr.top - mr.top - h - 6)}px`;
  };
  /** Write the open stop's colour (an alias ref or a literal) and repaint. */
  const setStopColor = (color: string): void => {
    const cur = popTarget(); if (!cur || !color) return;
    const next = cur.stops.map((s, i) => (i === popStop ? { ...s, color } : s));
    if (!setStudioTokenValue(ctx.doc(), cur.t.path, next)) return;
    repaintRow(popPath);
    renderPopGrid();
    ctx.persist();
    ctx.notify();
  };

  const render = (): void => {
    const items = grads();
    // Count chip updates in place; the <details> open state is deliberately
    // never touched here, so the repaintPalette-driven re-render (the editor's
    // paletteHooks) can't fold an open panel shut.
    if (countChip) {
      countChip.textContent = items.length ? String(items.length) : t('none');
      countChip.classList.toggle('be-ps-chip--auto', !items.length);
    }
    if (!pop.hidden) closePop(); // the chip it anchors to is about to be rebuilt
    list.innerHTML = items.map(rowHtml).join('');
  };
  // Default-collapsed only while the brand carries no gradients - a brand that
  // has them shows them.
  if (details) details.open = grads().length > 0;
  render();

  const tokenAt = (attr: string): StudioToken | undefined =>
    grads().find(t => t.path.join('␟') === attr);
  /** In-place repaint of one row's preview + chips (no re-render - keeps the
   *  popover and any focused control alive). */
  const repaintRow = (attr: string): void => {
    const t = tokenAt(attr);
    const row = list.querySelector<HTMLElement>(`[data-grad-row][data-grad-path="${CSS.escape(attr)}"]`);
    if (!t || !row) return;
    const prev = row.querySelector<HTMLElement>('.be-grad-preview');
    if (prev) prev.style.background = previewCss(t);
    const stops = stopsOf(t);
    row.querySelectorAll<HTMLElement>('[data-grad-stop]').forEach(chip => {
      const s = stops[Number(chip.dataset.gradStop)];
      if (!s) return;
      chip.style.setProperty('--sw', stopCss(s));
      chip.classList.toggle('is-ref', isAlias(s.color));
    });
  };
  // The committed-palette seam: an in-place recolour (wheel drag, popover edit)
  // changes what alias stops resolve to with no structural edit - repaint every
  // row (and an open stop popover's grid) in place.
  const repaintAll = (): void => {
    for (const t of grads()) repaintRow(t.path.join('␟'));
    if (!pop.hidden) renderPopGrid();
  };
  const unsubPalette = ctx.onPalette(repaintAll);

  list.addEventListener('input', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.gradAngle === undefined) return;
    const attr = el.dataset.gradPath ?? '';
    const t = tokenAt(attr); if (!t) return;
    if (el.value.trim() === '') return; // cleared field - Number('') would write 0
    const angle = Number(el.value);
    if (!Number.isFinite(angle)) return;
    // Angle-only edit: the stored stops ride through the write gate untouched
    // (alias refs included - normStops keeps them verbatim).
    if (!setStudioTokenValue(ctx.doc(), t.path, { stops: stopsOf(t), angle })) return;
    repaintRow(attr);
    ctx.persist();
    ctx.notify();
  });
  list.addEventListener('change', (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.gradNstops === undefined) return;
    const attr = el.dataset.gradPath ?? '';
    const t = tokenAt(attr); if (!t) return;
    let stops = [...stopsOf(t)];
    const n = Math.max(GRAD_STOPS_MIN, Math.min(GRAD_STOPS_MAX, Math.round(Number(el.value)) || stops.length));
    if (n === stops.length) { el.value = String(stops.length); return; }
    if (n > stops.length) {
      if (stops.length < 2) {
        // Degenerate stored run (imported doc) - rebuild it evenly.
        while (stops.length < n) stops.push({ color: nextUnusedSwatch(stops)?.ref ?? '#888888', position: 1 });
        stops = stops.map((s, i) => ({ ...s, position: i / (stops.length - 1) }));
      } else {
        // Grow: append the next palette swatches nothing wears yet, as
        // aliases, spread evenly through the tail gap (between the last two
        // stops) - a whole-run re-space would wipe positions the "+" flow
        // hand-placed at the largest gap's midpoint.
        const last = stops[stops.length - 1]!;
        const from = stops[stops.length - 2]!.position;
        const added = n - stops.length;
        for (let i = 1; i <= added; i++) {
          stops.splice(stops.length - 1, 0, {
            color: nextUnusedSwatch(stops)?.ref ?? '#888888',
            position: from + ((last.position - from) * i) / (added + 1),
          });
        }
      }
    } else {
      // Shrink: drop from the end, keeping the first and last stops - and
      // every survivor's position.
      stops = [...stops.slice(0, n - 1), stops[stops.length - 1]!];
    }
    if (!setStudioTokenValue(ctx.doc(), t.path, stops)) return;
    render(); ctx.persist(); ctx.notify();
  });
  list.addEventListener('click', async (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-grad-stop]');
    if (chip) { openPop(chip); return; }
    const delStop = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-grad-stopdel]');
    if (delStop) {
      const attr = delStop.dataset.gradPath ?? '';
      const t = tokenAt(attr); if (!t) return;
      const stops = [...stopsOf(t)];
      if (stops.length <= GRAD_STOPS_MIN) return;
      stops.splice(Number(delStop.dataset.gradStopdel), 1);
      if (!setStudioTokenValue(ctx.doc(), t.path, stops)) return;
      render(); ctx.persist(); ctx.notify();
      return;
    }
    const addStop = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-grad-addstop]');
    if (addStop) {
      const t = tokenAt(addStop.dataset.gradAddstop ?? ''); if (!t) return;
      const stops = [...stopsOf(t)];
      if (stops.length >= GRAD_STOPS_MAX) return;
      // Seed at the midpoint of the largest gap, wearing the next unused
      // palette swatch - as an alias, so it follows a recolour.
      let gi = 0;
      for (let i = 1; i + 1 < stops.length; i++) {
        if (stops[i + 1]!.position - stops[i]!.position > stops[gi + 1]!.position - stops[gi]!.position) gi = i;
      }
      const pos = stops.length >= 2 ? (stops[gi]!.position + stops[gi + 1]!.position) / 2 : 0.5;
      stops.splice(gi + 1, 0, { color: nextUnusedSwatch(stops)?.ref ?? '#888888', position: pos });
      if (setStudioTokenValue(ctx.doc(), t.path, stops)) { render(); ctx.persist(); ctx.notify(); }
      return;
    }
    const del = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-grad-del]'); if (!del) return;
    const tok = tokenAt(del.dataset.gradDel ?? '');
    const ok = await confirmDialog({ title: tRaw('Delete {name}?', { name: tok?.name ?? t('this gradient') }), message: t('It’s removed from the design system tokens.'), confirmLabel: t('Delete') });
    if (!ok || !tok) return;
    if (deleteStudioToken(ctx.doc(), tok.path)) { render(); ctx.persist(true); ctx.notify(); }
  });

  popGrid.addEventListener('click', (e) => {
    const sw = (e.target as HTMLElement).closest<HTMLElement>('[data-pop-ref]');
    if (sw) setStopColor(sw.dataset.popRef ?? '');
  });
  const commitPopHex = (): void => {
    const raw = popHex.value.trim();
    if (!raw || colorToHex(raw) == null) return; // half-typed - leave the stored value alone
    setStopColor(raw);
  };
  popHex.addEventListener('change', commitPopHex);
  popHex.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); commitPopHex(); } });

  // Esc closes the stop popover FIRST and stops the event dead - registered
  // here (during mountBrandEditor, so ahead of start.ts's sheet/back handler,
  // and after the swatch editor's own - resolution: swatch editor wins when
  // both are somehow open). Outside-pointerdown (capture, the swatch editor's
  // pattern) closes it too.
  const onPopKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && !pop.hidden) { e.stopImmediatePropagation(); closePop(); }
  };
  const onPopPointer = (e: PointerEvent): void => {
    if (!pop.hidden && !pop.contains(e.target as Node) && !(e.target as HTMLElement).closest('[data-grad-stop]')) closePop();
  };
  document.addEventListener('keydown', onPopKey);
  document.addEventListener('pointerdown', onPopPointer, true);

  mount.querySelector<HTMLButtonElement>('[data-grad-add]')?.addEventListener('click', () => {
    const n = grads().length + 1;
    // Seed from the palette AS ALIASES (the primary's swatch first) so the new
    // gradient tracks recolours; literals only when the palette can't supply two.
    const sws = ctx.paletteSwatches();
    const primary = ctx.primaryHex().toLowerCase().slice(0, 7);
    const first = sws.find(w => w.hex.toLowerCase().slice(0, 7) === primary) ?? sws[0];
    const second = sws.find(w => w !== first && w.hex.toLowerCase() !== (first?.hex ?? '').toLowerCase());
    const from = first?.ref ?? ctx.primaryHex();
    const to = second?.ref ?? ctx.paletteHexes().find(h => h.toLowerCase() !== primary) ?? '#ffffff';
    const gradName = t('Gradient {n}', { n });
    const path = addStudioToken(ctx.doc(), 'gradient', gradName, {
      stops: [{ color: from, position: 0 }, { color: to, position: 1 }], angle: 135,
    });
    if (!path) { showErr(t("Couldn't add a gradient.")); return; }
    showErr('');
    render(); ctx.persist(true); ctx.notify(); playSfx('click');
    announce(tRaw('{name} added', { name: gradName }));
  });

  return {
    render,
    teardown: () => {
      unsubPalette();
      document.removeEventListener('keydown', onPopKey);
      document.removeEventListener('pointerdown', onPopPointer, true);
    },
  };
}

// ── Catalogue panel ───────────────────────────────────────────────────────────

/** Display buckets, in render order - the same coarse cut the Catalogue view
 *  makes: motion = video, Lottie and animated rasters. */
const CAT_BUCKETS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'vector', label: 'Vector' },
  { key: 'image', label: 'Images' },
  { key: 'audio', label: 'Audio' },
  { key: 'motion', label: 'Motion' },
];

/** Internal ids (fonts, logos, tokens, the headshot) aren't catalogue uploads. */
const INTERNAL_ID = /^user\/(fonts|logo|tokens|headshot)/;

function bucketOf(ref: { type: string; meta?: Record<string, unknown> }): string | null {
  if (ref.type === 'vector') return 'vector';
  if (ref.type === 'audio') return 'audio';
  if (ref.type === 'video' || ref.type === 'lottie') return 'motion';
  if (ref.type === 'raster') return ref.meta?.animated ? 'motion' : 'image';
  return null;
}

export interface CataloguePanelCtx { host: HostV1; notify: () => void }

export function mountCataloguePanel(mount: HTMLElement, ctx: CataloguePanelCtx): StudioPanelHandle {
  mount.innerHTML = `
    ${panelHead(t('Files'), tRaw("Files the design system keeps - drop them here and they land in {link}, sorted into its sections, ready for every tool's asset picker.", { link: `<a href="#/a">${t('Assets')}</a>` }))}
    <div data-be-cat-dropzone></div>
    <div class="be-cat-groups" data-be-cat-groups aria-live="polite"></div>`;

  const groupsEl = mount.querySelector<HTMLElement>('[data-be-cat-groups]')!;
  const pickerHost = ctx.host as PickerHost;

  const render = (): void => { void paint(); };
  const paint = async (): Promise<void> => {
    let refs: Array<{ id: string; type: string; meta?: Record<string, unknown> }> = [];
    try { refs = await pickerHost.assets._listUserAssets(); } catch { /* fresh install - nothing yet */ }
    const uploads = refs.filter(r => !INTERNAL_ID.test(r.id));
    if (!mount.isConnected) return;
    if (!uploads.length) {
      groupsEl.innerHTML = `<p class="be-cat-empty">${isTauriShell() ? t('Nothing yet - everything you add stays on this device.') : t('Nothing yet - everything you add stays in this browser.')}</p>`;
      return;
    }
    const byBucket = new Map<string, string[]>();
    for (const r of uploads) {
      const b = bucketOf(r); if (!b) continue;
      const name = String(r.meta?.name ?? r.id.split('/').pop() ?? '');
      (byBucket.get(b) ?? byBucket.set(b, []).get(b)!).push(name);
    }
    groupsEl.innerHTML = CAT_BUCKETS.map(({ key, label }) => {
      const names = byBucket.get(key) ?? [];
      if (!names.length) return '';
      return `<div class="be-cat-group">
          <span class="be-cat-group-label">${escape(t(label))}<span class="be-cat-group-n">${names.length}</span></span>
          <span class="be-cat-group-names">${names.slice(0, 6).map(n => `<span class="be-cat-name">${escape(n)}</span>`).join('')}${names.length > 6 ? `<span class="be-cat-more">${t('+{n} more', { n: names.length - 6 })}</span>` : ''}</span>
        </div>`;
    }).join('');
  };
  render();

  const dzMount = mount.querySelector<HTMLElement>('[data-be-cat-dropzone]')!;
  const teardownDz = mountUploadDropzone(dzMount, pickerHost, {
    onAdded: async () => { await paint(); ctx.notify(); },
  });

  return { render, teardown: teardownDz };
}
