// SPDX-License-Identifier: MPL-2.0
/**
 * rebrand: the deck theme and a slide's background (plan 275 close-out section 3.10).
 *
 * The deck theme has one home, a popover, and two ways in:
 *
 *   - the Deck theme control in the top bar, beside the design system name: a small
 *     button with the theme's three colours and its name (`renderThemeControl`);
 *   - the door "Deck theme: Light" at the foot of the Background section in the
 *     decision column (`renderStyleSection`).
 *
 * The Background section is the column's only theme part. It is folded by default,
 * with the slide's background as its flag ("Light", or "Dark, this slide" when the slide
 * has its own); open, it holds the per-slide segment and the door. The segment is
 * shown only when the selected slides' layouts have a variant for another background,
 * so a background that cannot apply is hidden rather than explained.
 *
 * Every theme comes from the design system (`deckThemeChoices` in the engine): Light,
 * Dark (the pack's own dark mode), Brand colour when the pack has a hue that stands
 * apart from both, and one tile per saved look when the design system is not locked.
 * When more than one of the palette's hues can carry Brand colour, they follow the
 * tiles as a row of swatches (plan 275 decision 33d). A tile shows the deck's first
 * slide as a 96 px wireframe drawn under that theme (its page, panels and empty slots
 * all take the theme's own colours, because a thumbnail is content and the theme is
 * content), then the three colours, then the name, and "Current" with a check when it
 * is the applied theme. Under "Hide colourful previews" the wireframe goes and the
 * colours and the name stay.
 *
 * A plan whose stored theme is none of the tiles (a look past the tile limit, a look
 * since deleted, a look on a design system locked since) gets a tile of its own
 * marked Current, named by the stored theme, never shown as Light.
 *
 * The note under the tiles states a problem only ("On Dark, 21 texts would be hard to
 * read."), for the tile under the pointer or in focus, else for the applied theme; a
 * theme with no problem leaves it empty. Applying is one undoable step through
 * `rb.controller.setTheme`, and a slide's background one through `setGround`; each
 * result is said in the footer with its Undo (`rb.foot.say`). A controller that does
 * not carry `setTheme` yet, or answers `not-built`, leaves the tiles in place with
 * `aria-disabled` and one line under them.
 *
 * The colours are read here, once per design system, the way the layout chooser reads
 * its master: the active design system's input, which carries its master, its light
 * colours, its dark mode, whether it is locked and its saved looks.
 *
 * A tile's picture is the first slide compiled under its theme (close-out CP5c). The
 * compiles run only while the popover is open, one at a time in the stage worker
 * (`rebrand.compile` with a theme tile's request), each kept by plan revision and theme,
 * so an edit with the popover closed costs nothing and reopening on the same revision
 * compiles nothing again. The applied theme's tile takes the Proposed pane's own drawing
 * when that is current. Until a tile's compile is in, and until the design system's faces
 * are loaded, the tile shows its layout's wireframe in the theme's colours. The compiled
 * drawing is a proposed one, so it is set in the design system's faces (section 9.2).
 */
import {
  brandGroundPath,
  buildDeckTheme,
  contrastRatio,
  deckGround,
  deckThemeChoices,
  framePreviewSvg,
  hexToOklch,
  slideGroundHex,
  slideGroundPlan,
  themedColors,
  themePreview,
  themeSwatches,
  THEME_DISTINCT_GROUND,
  type DeckLookV1,
  type DeckThemeChoiceV1,
  type RebrandDesignSystemInputV1,
  type ThemePreviewV1,
  type ThemeSourceV1,
  type ThemedColorsV1,
} from '@lolly/engine';
import type { CompiledDeckV1, CompiledFrameV1, DeckThemeV1, SlideGroundV1, SlidePlanV1 } from '@lolly-tools/core/rebrand-v1';
import { mountBodyPopover, type BodyPopoverHandle, type PopoverAnchor } from '../../components/body-popover.ts';
import { t, tRaw } from '../../i18n.ts';
import { exampleLooks, readLocalLooks, type LocalLook } from '../../lib/design-system/look-library.ts';
import type { DesignSystemRegistry } from '../../lib/design-system/registry.ts';
import { icon } from '../../lib/icons.ts';
import type { CompileStageInputV1 } from '../../lib/rebrand/controller-api.ts';
import { previewPlanOf } from '../../lib/rebrand/controller.ts';
import { stageRunnerFor } from '../../lib/rebrand/deps.ts';
import { resolveActiveDesignSystem } from '../../lib/rebrand/design-system.ts';
import type { ThemeTileRequestV1 } from '../../lib/rebrand/stage-rebrand.ts';
import { segHtml } from '../../lib/seg.ts';
import { escape as htmlEscape } from '../../utils.ts';
import { archetypeThumbSvg, THUMB_CLASS, THUMB_TONES, type ThumbTones } from '../free-canvas/archetype-thumb.ts';
import { bindOp, type RbCtx } from './context.ts';
import { selectedSlideIds } from './shared.ts';

/** The wireframe's width, the size the plan names. */
export const THEME_THUMB_WIDTH = 96;

/** Looks shown as tiles at most, so the row stays one glance. The applied look is shown past it. */
export const THEME_LOOK_LIMIT = 4;

/** Brand colour hues offered as swatches at most. */
export const THEME_HUE_LIMIT = 6;

/** The contrast a Brand colour ground must give its ink to be offered (the engine's `THEME_TEXT_CONTRAST`). */
const HUE_INK_CONTRAST = 4.5;

/** Below this OKLCH chroma a colour reads as a grey, and a grey is no brand hue. */
const HUE_CHROMA_FLOOR = 0.04;

const GROUNDS: readonly SlideGroundV1[] = ['light', 'dark', 'brand'];

// ─── view-only state ─────────────────────────────────────────────────────────

/** One tile compile: the stage request, tagged with the project and plan revision it was made for. */
export type ThemeTileRunnerV1 = (
  input: CompileStageInputV1 & ThemeTileRequestV1,
  tag: { projectId: string; planRevision: number },
  signal: AbortSignal,
) => Promise<CompiledDeckV1>;

interface ThemeLocal {
  /** The design system the colours below were read for. */
  key: string;
  /** Bumped on every read, so a memo made for an older read is never used again. */
  readSeq: number;
  /** The colours to theme; undefined while they are read, null when this host cannot say. */
  source: ThemeSourceV1 | null | undefined;
  /** The design-system input the stage compiles a tile against. */
  input: RebrandDesignSystemInputV1 | null;
  locked: boolean;
  /** Every saved and example look, the active design system itself left out. */
  looks: DeckLookV1[];
  /** The tile the note speaks for while it has focus or the pointer; null means the current theme. */
  focusKey: string | null;
  /** The controller cannot apply a theme yet. */
  themeOff: boolean;
  /** The controller cannot set a slide's background yet. */
  groundOff: boolean;
  busy: boolean;
  /** The Background section is unfolded. Folded by default: its flag says the state. */
  open: boolean;
  previews: Map<string, ThemePreviewV1>;
  /** The plan the cached previews were made for. */
  previewPlan: object | null;
  /** The tiles and hues for one read and one stored theme, so a render of the column does not build every theme again. */
  set: { key: string; tiles: DeckThemeChoiceV1[]; hues: ThemeHueV1[] } | null;
  /** Each tile's compiled first slide under its theme, by `revision|theme`; null when its compile failed. */
  art: Map<string, CompiledFrameV1 | null>;
  /** What the kept drawings were made for: the project, the plan revision, the slide and the design system. */
  artBase: string;
  /** The tile compile in flight, stopped when the popover closes or the plan moves on. */
  artRun: AbortController | null;
  /**
   * Catalog pictures a tile draws that the Proposed pane has not loaded (the mono mark
   * on a Brand colour ground), by reference: their address, or null while it is read.
   */
  media: Map<string, string | null>;
  /** What the open panel last drew from, so a render redraws it only when something it shows changed. */
  panelKey: string;
  menu: BodyPopoverHandle | null;
  /** The popover's own element while it is open, so a change redraws it in place. */
  menuEl: HTMLElement | null;
  /** Which way in opened the popover: the top-bar control or the column's door. */
  from: 'top' | 'door';
  control: HTMLButtonElement | null;
  controlKey: string;
}

const LOCAL = new WeakMap<RbCtx, ThemeLocal>();

function localOf(rb: RbCtx): ThemeLocal {
  let local = LOCAL.get(rb);
  if (!local) {
    local = {
      key: '',
      readSeq: 0,
      source: undefined,
      input: null,
      locked: false,
      looks: [],
      focusKey: null,
      themeOff: false,
      groundOff: false,
      busy: false,
      open: false,
      previews: new Map(),
      previewPlan: null,
      set: null,
      art: new Map(),
      artBase: '',
      artRun: null,
      media: new Map(),
      panelKey: '',
      menu: null,
      menuEl: null,
      from: 'top',
      control: null,
      controlKey: '',
    };
    LOCAL.set(rb, local);
  }
  return local;
}

// ─── reading the design system ───────────────────────────────────────────────

function hasRegistry(host: object): host is { designSystems: DesignSystemRegistry; assets: { _getBlob?(id: string): Promise<Blob | null> } } {
  if (!('designSystems' in host) || !('assets' in host)) return false;
  const registry = host.designSystems;
  return registry !== null && typeof registry === 'object' && 'list' in registry && typeof registry.list === 'function';
}

/** A saved look's colours as the engine takes them. */
export function deckLookOf(look: LocalLook): DeckLookV1 {
  const colors: Record<string, string> = {};
  for (const color of look.context.colors) {
    if (typeof color.value === 'string') colors[color.path] = color.value;
  }
  return { id: look.id, name: look.name, colors };
}

/** The saved looks and the example looks, the active design system itself left out: a look of itself is no choice. */
async function readLooks(host: object, activeId: string | null): Promise<DeckLookV1[]> {
  let looks: LocalLook[] = exampleLooks();
  if (hasRegistry(host)) {
    try {
      looks = (await readLocalLooks(host)).looks;
    } catch {
      // A registry that cannot be read leaves the example looks.
    }
  }
  return looks.filter((look) => look.id !== activeId).map(deckLookOf);
}

function systemKey(rb: RbCtx): string {
  return `${rb.state.designSystem?.id ?? ''}|${rb.state.plan?.designSystem.tokenHash ?? ''}`;
}

/** The colours to theme, read once per design system. A read that finishes redraws both places. */
function sourceOf(rb: RbCtx): ThemeSourceV1 | null | undefined {
  const local = localOf(rb);
  const key = systemKey(rb);
  if (local.key === key) return local.source;
  local.key = key;
  local.source = undefined;
  local.input = null;
  local.previews.clear();
  void (async () => {
    try {
      const resolved = await resolveActiveDesignSystem(rb.host);
      if (!resolved) return { source: null, input: null, locked: false, looks: [] };
      const { input } = resolved;
      const locked = 'locked' in input && input.locked === true;
      // The input carries the looks only while the design system is not locked; a locked
      // one still names a stored look by its own name, so its looks are read here then.
      const carried = 'looks' in input && Array.isArray(input.looks) ? input.looks.filter(isLook) : null;
      const looks = carried && carried.length > 0 ? carried : await readLooks(rb.host, input.id).catch(() => []);
      const source: ThemeSourceV1 = {
        colors: input.colors,
        master: input.master,
        ...(input.darkColors ? { darkColors: input.darkColors } : {}),
      };
      return { source, input, locked, looks };
    } catch {
      return { source: null, input: null, locked: false, looks: [] };
    }
  })().then((read) => {
    if (local.key !== key) return;
    local.source = read.source;
    local.input = read.input;
    local.locked = read.locked;
    local.looks = read.looks;
    local.readSeq += 1;
    local.controlKey = '';
    redraw(rb);
  });
  return undefined;
}

function isLook(value: unknown): value is DeckLookV1 {
  return value !== null && typeof value === 'object'
    && 'id' in value && typeof value.id === 'string'
    && 'name' in value && typeof value.name === 'string'
    && 'colors' in value && value.colors !== null && typeof value.colors === 'object';
}

/** Redraw the Background section, the top-bar control and the open popover after something only this module knows changed. */
function redraw(rb: RbCtx): void {
  rb.memo.decide = '';
  rb.decide.render();
  const local = localOf(rb);
  local.controlKey = '';
  if (local.control?.parentElement) renderThemeControl(rb, local.control.parentElement);
  if (local.menuEl && local.menu?.isOpen()) fillPanel(rb, local.menuEl);
}

// ─── the choices ─────────────────────────────────────────────────────────────

/** One key per distinct theme: a look by its id, a Brand colour theme by the hue it grounds on. */
function themeKeyOf(theme: DeckThemeV1 | null | undefined): string {
  if (!theme || (theme.id === 'light' && theme.remap.length === 0 && !theme.mode && !theme.flipDark)) return 'light';
  if (theme.id === 'look') return `look:${theme.lookId ?? ''}`;
  if (theme.id === 'brand') return `brand:${theme.remap.find((row) => row.from === 'color.semantic.surface')?.to ?? ''}`;
  return theme.id;
}

function choiceKey(choice: Pick<DeckThemeChoiceV1, 'theme'>): string {
  return themeKeyOf(choice.theme);
}

/** The looks drawn as tiles: the first few, and the applied one wherever it is in the list. */
function shownLooks(rb: RbCtx): DeckLookV1[] {
  const local = localOf(rb);
  const shown = local.looks.slice(0, THEME_LOOK_LIMIT);
  const applied = rb.state.plan?.designSystem.theme;
  if (applied?.id === 'look' && !shown.some((one) => one.id === applied.lookId)) {
    const look = local.looks.find((one) => one.id === applied.lookId);
    if (look) shown.push(look);
  }
  return shown;
}

/** The hue a stored Brand colour theme grounds on, so its tile draws that hue and not the default one. */
function storedHue(rb: RbCtx): string | undefined {
  const theme = rb.state.plan?.designSystem.theme;
  return theme?.id === 'brand' ? brandGroundPath(theme) : undefined;
}

function choicesOf(rb: RbCtx): DeckThemeChoiceV1[] {
  const local = localOf(rb);
  const source = sourceOf(rb);
  if (!source) return [];
  const hue = storedHue(rb);
  return deckThemeChoices(source, { locked: local.locked, looks: shownLooks(rb), ...(hue ? { hue } : {}) });
}

/** A token path's last part as a name: `color.brand.jungle` reads "Jungle". */
export function hueName(tokenPath: string): string {
  const last = (tokenPath.split('.').pop() ?? tokenPath).replace(/[-_]+/g, ' ').trim();
  return last ? last.charAt(0).toUpperCase() + last.slice(1) : tokenPath;
}

/** One Brand colour hue the swatch row offers. */
export interface ThemeHueV1 {
  path: string;
  name: string;
  choice: DeckThemeChoiceV1;
}

/**
 * The palette's hues that can carry Brand colour (plan 275 decision 33d): the primary,
 * secondary and accent, then the named brand colours, each kept when it has colour, its
 * ground stands apart from the Light and Dark grounds, and its ink holds on it. One per
 * ground, at most `THEME_HUE_LIMIT`, the applied hue always among them.
 */
function buildHues(rb: RbCtx, tiles: DeckThemeChoiceV1[]): ThemeHueV1[] {
  const source = localOf(rb).source;
  if (!source || !tiles.some((one) => one.id === 'brand')) return [];
  const colors = source.colors;
  const named = Object.keys(colors).filter((one) => /^color\.brand\.[^.]+$/.test(one)).sort();
  const paths = [...new Set(['color.semantic.primary', 'color.semantic.secondary', 'color.semantic.accent', ...named])];
  const others = tiles.filter((one) => one.id === 'light' || one.id === 'dark').map((one) => one.swatches.ground);
  const applied = storedHue(rb);
  const out: ThemeHueV1[] = [];
  const grounds = new Set<string>();
  for (const path of paths) {
    const hex = colors[path];
    if (typeof hex !== 'string' || out.length >= THEME_HUE_LIMIT) continue;
    const kept = path === applied;
    if (!kept && (hexToOklch(hex)?.c ?? 0) < HUE_CHROMA_FLOOR) continue;
    const choice = buildDeckTheme('brand', source, { hue: path });
    if (!choice || grounds.has(choice.swatches.ground)) continue;
    const stands = others.every((ground) => contrastRatio(choice.swatches.ground, ground) >= THEME_DISTINCT_GROUND);
    const reads = contrastRatio(choice.swatches.ink, choice.swatches.ground) >= HUE_INK_CONTRAST;
    if (!kept && (!stands || !reads)) continue;
    grounds.add(choice.swatches.ground);
    out.push({ path, name: hueName(path), choice });
  }
  if (applied && !out.some((one) => one.path === applied)) {
    const choice = tiles.find((one) => one.id === 'brand');
    if (choice) out.unshift({ path: applied, name: hueName(applied), choice });
  }
  return out.length > 1 ? out.slice(0, THEME_HUE_LIMIT) : [];
}

/**
 * The plan's stored theme as a tile of its own, when it is none of the offered tiles:
 * a look since deleted, a look on a design system locked since, a Brand colour theme
 * on a hue the tiles no longer offer. Undefined when the stored theme is offered.
 */
function storedChoice(rb: RbCtx, choices: DeckThemeChoiceV1[]): DeckThemeChoiceV1 | undefined {
  const theme = rb.state.plan?.designSystem.theme;
  const source = localOf(rb).source;
  if (!theme || !source) return undefined;
  const key = themeKeyOf(theme);
  if (key === 'light' || choices.some((one) => choiceKey(one) === key)) return undefined;
  const look = theme.id === 'look' ? localOf(rb).looks.find((one) => one.id === theme.lookId) : undefined;
  const themed = themedColors(source, theme, look ? { look } : {});
  const choice: DeckThemeChoiceV1 = { id: theme.id, theme, swatches: themeSwatches(themed), notes: themed.notes };
  if (look) choice.name = look.name;
  return choice;
}

/**
 * The tiles and hues for this read of the design system and the plan's stored theme,
 * built once and kept: every render of the column asks for the current theme's name,
 * and building each theme's colours again for that would cost every flick.
 */
function themeSet(rb: RbCtx): { tiles: DeckThemeChoiceV1[]; hues: ThemeHueV1[] } {
  const local = localOf(rb);
  const source = sourceOf(rb);
  if (!source) return { tiles: [], hues: [] };
  const key = `${local.key}|${local.readSeq}|${JSON.stringify(rb.state.plan?.designSystem.theme ?? null)}`;
  if (local.set?.key === key) return local.set;
  const choices = choicesOf(rb);
  const stored = storedChoice(rb, choices);
  const tiles = stored ? [...choices, stored] : choices;
  local.set = { key, tiles, hues: buildHues(rb, tiles) };
  return local.set;
}

/** The tiles drawn: the offered themes, then the stored one when it is none of them. */
function tilesOf(rb: RbCtx): DeckThemeChoiceV1[] {
  return themeSet(rb).tiles;
}

/** Brand colour's hues for the swatch row. */
function huesOf(rb: RbCtx): ThemeHueV1[] {
  return themeSet(rb).hues;
}

export function themeName(choice: Pick<DeckThemeChoiceV1, 'id' | 'name'>): string {
  switch (choice.id) {
    case 'light':
      return tRaw('Light');
    case 'dark':
      return tRaw('Dark');
    case 'brand':
      return tRaw('Brand colour');
    case 'look':
      return choice.name ?? tRaw('Look');
  }
}

function lookOf(rb: RbCtx, choice: DeckThemeChoiceV1): DeckLookV1 | undefined {
  return choice.id === 'look' ? localOf(rb).looks.find((one) => one.id === choice.theme.lookId) : undefined;
}

/** A look theme the locked design system does not apply. */
function lockedOut(rb: RbCtx, choice: Pick<DeckThemeChoiceV1, 'id'>): boolean {
  return localOf(rb).locked && choice.id === 'look';
}

/** What the colour solve finds under one theme, cached per plan. Null without a plan or a census. */
function previewOf(rb: RbCtx, choice: DeckThemeChoiceV1): ThemePreviewV1 | null {
  const local = localOf(rb);
  const plan = rb.state.plan;
  const census = rb.state.census;
  const source = local.source;
  if (!plan || !census || !source) return null;
  if (local.previewPlan !== plan) {
    local.previews.clear();
    local.previewPlan = plan;
  }
  const key = choiceKey(choice);
  const cached = local.previews.get(key);
  if (cached) return cached;
  try {
    const look = lookOf(rb, choice);
    const preview = themePreview(plan, choice.id === 'light' ? null : choice.theme, {
      census,
      system: source,
      ...(rb.state.source ? { source: rb.state.source } : {}),
      ...(look ? { look } : {}),
      locked: local.locked,
    });
    local.previews.set(key, preview);
    return preview;
  } catch {
    return null;
  }
}

/** The deck's first included slide in its order, which the tiles draw. */
function firstSlide(rb: RbCtx): SlidePlanV1 | undefined {
  const plan = rb.state.plan;
  if (!plan) return undefined;
  const states = (rb.derived?.slides ?? []).filter((one) => one.include);
  const first = states.length > 0 ? states.reduce((a, b) => (b.order < a.order ? b : a)) : undefined;
  return plan.slides.find((one) => one.id === first?.id) ?? plan.slides.find((one) => one.include);
}

// ─── the wireframe ───────────────────────────────────────────────────────────

function hexRgb(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{6})/i.exec(hex.trim());
  if (!m?.[1]) return null;
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `a` moved towards `b` by `share`, in sRGB, as a six-digit hex. */
export function mixHex(a: string, b: string, share: number): string {
  const x = hexRgb(a);
  const y = hexRgb(b);
  if (!x || !y) return a;
  const part = (i: 0 | 1 | 2): string => Math.round(x[i] + (y[i] - x[i]) * share).toString(16).padStart(2, '0');
  return `#${part(0)}${part(1)}${part(2)}`;
}

/** The tones a wireframe is drawn in under one theme: the ground, the ink and the panels of the theme itself. */
export interface ThemeThumbTonesV1 {
  page: string;
  edge: string;
  placeholder: string;
  mark: string;
  /** Each piece of furniture the layout shows, in paint order. */
  furniture: string[];
}

/** The theme's own tones for one layout: its ground, an ink that holds on it, and each piece of furniture in its themed colour. */
export function themeThumbTones(themed: Pick<ThemedColorsV1, 'colors' | 'master'>, archetypeId: string, ground: string, swatches: DeckThemeChoiceV1['swatches']): ThemeThumbTonesV1 {
  // The theme's ink where it reads on this ground; a slide on a ground of its own may
  // need the theme's ground colour instead, as a dark slide on a light deck does.
  const reads = (hex: string): number => (hexRgb(hex) && hexRgb(ground) ? contrastRatio(hex.slice(0, 7), ground.slice(0, 7)) : 0);
  const ink = [swatches.ink, swatches.ground].find((hex) => reads(hex) >= 3)
    ?? (reads('#000000') >= reads('#ffffff') ? '#000000' : '#ffffff');
  const archetype = themed.master.archetypes.find((one) => one.id === archetypeId);
  const pieces = new Map(themed.master.furniture.map((piece) => [piece.id, piece]));
  // Only the pieces the thumbnail draws, in its paint order.
  const drawn = (archetype?.furniture ?? []).map((id) => pieces.get(id)).filter((piece) => piece !== undefined);
  const furniture = drawn.map((piece) => {
    if (piece.kind === 'rect' || piece.kind === 'bar') {
      const fill = piece.tokenPath !== undefined ? themed.colors[piece.tokenPath] : piece.hex;
      if (fill && hexRgb(fill)) return `#${fill.trim().replace(/^#/, '').slice(0, 6).toLowerCase()}`;
      return swatches.accent;
    }
    // A logo, a page number or a footer: a mark in the ink, quieter than the words.
    return mixHex(ground, ink, piece.kind === 'logo' ? 0.5 : 0.35);
  });
  return { page: ground, edge: mixHex(ground, ink, 0.2), placeholder: mixHex(ground, ink, 0.12), mark: ink, furniture };
}

/**
 * Redraw a wireframe the thumbnail module drew in its fixed neutrals in the theme's
 * own tones. The thumbnail module draws every element with a tone on the element, a
 * class naming what it is and the furniture in paint order, so each fill and stroke
 * is swapped by the tone it was drawn in, and each piece of furniture takes its own.
 */
function retone(svg: string, neutral: ThumbTones, tones: ThemeThumbTonesV1): string {
  const byTone = new Map<string, string>([
    [neutral.page, tones.page],
    [neutral.edge, tones.edge],
    [neutral.placeholder, tones.placeholder],
    [neutral.mark, tones.mark],
  ]);
  let at = 0;
  return svg.replace(/<(rect|path|circle)\b[^>]*>/g, (tag) => {
    const furniture = tag.includes(`class="${THUMB_CLASS.furniture}"`);
    const own = furniture ? tones.furniture[at++] : undefined;
    return tag.replace(/\b(fill|stroke)="(#[0-9a-fA-F]{6})"/g, (whole, attr: string, hex: string) => {
      const next = attr === 'fill' && own ? own : byTone.get(hex.toLowerCase()) ?? (hex.toLowerCase() === neutral.furniture ? tones.furniture[0] ?? tones.edge : undefined);
      return next ? `${attr}="${next}"` : whole;
    });
  });
}

/** The first slide as a 96 px wireframe under one theme, drawn in the theme's own colours. */
export function themeThumbSvg(source: ThemeSourceV1, choice: DeckThemeChoiceV1, slide: Pick<SlidePlanV1, 'layout' | 'ground'> | undefined, look?: DeckLookV1): string {
  const theme = choice.id === 'light' ? null : choice.theme;
  const themed = themedColors(source, theme, look ? { look } : {});
  const layout = slide ?? { layout: themed.master.archetypes[0]?.id ?? 'content' };
  const placed = slideGroundPlan(layout, themed.master, theme);
  // The boxes stay empty: a tile shows a theme's colours, and a plus in a slot would read
  // as a button that adds something.
  const svg = archetypeThumbSvg(themed.master, placed.archetype, { width: THEME_THUMB_WIDTH, marks: 'none' });
  if (!svg) return '';
  const groundHex = slideGroundHex(layout, themed)?.hex ?? choice.swatches.ground;
  const ground = hexRgb(groundHex) ? groundHex : choice.swatches.ground;
  const dark = themed.master.archetypes.find((one) => one.id === placed.archetype)?.background?.dark === true;
  const toned = retone(svg, dark ? THUMB_TONES.dark : THUMB_TONES.light, themeThumbTones(themed, placed.archetype, ground, choice.swatches));
  // The chooser's class names are renamed, so a query for the chooser's tiles or pages
  // never finds a theme tile.
  return toned.replace(/class="arch-/g, 'class="rb-art-');
}

// ─── the compiled tiles ──────────────────────────────────────────────────────

let tileRunner: ThemeTileRunnerV1 | null = null;
let stageTileRunner: ThemeTileRunnerV1 | null = null;

/** Stand a runner in for the stage worker in a test; null gives the stage worker back. */
export function setThemeTileRunnerForTest(run: ThemeTileRunnerV1 | null): void {
  tileRunner = run;
}

/** The tile request, through the stage worker the controller's compiles use (quiet: no job of its own on the toast). */
function runnerOf(): ThemeTileRunnerV1 {
  if (tileRunner) return tileRunner;
  if (!stageTileRunner) {
    const run = stageRunnerFor();
    stageTileRunner = (input, tag, signal) => run<CompileStageInputV1 & ThemeTileRequestV1, CompiledDeckV1>('rebrand.compile', input, tag, signal);
  }
  return stageTileRunner;
}

/** A slide's own first frame in a compiled deck, a continuation left out. */
function frameOf(deck: Pick<CompiledDeckV1, 'frames'>, slideId: string): CompiledFrameV1 | undefined {
  return deck.frames.find((frame) => frame.sourceSlideId === slideId && frame.continuation !== true);
}

/** The Proposed pane's drawing of this slide, when it is of the plan as it stands. */
function paneFrame(rb: RbCtx, slideId: string): CompiledFrameV1 | undefined {
  const { plan, preview, previewStale } = rb.state;
  if (!plan || !preview || previewStale || preview.planRevision !== plan.revision) return undefined;
  return frameOf(preview.deck, slideId);
}

/**
 * A tile's compiled first slide: the applied theme's from the Proposed pane, another's
 * from its own compile. Undefined while it is not in, null when its compile failed.
 */
function tileFrame(rb: RbCtx, choice: DeckThemeChoiceV1, slide: SlidePlanV1 | undefined): CompiledFrameV1 | null | undefined {
  if (!slide) return undefined;
  const key = choiceKey(choice);
  if (key === themeKeyOf(rb.state.plan?.designSystem.theme)) return paneFrame(rb, slide.id);
  return localOf(rb).art.get(key);
}

/**
 * A picture's address for a tile: the one the controller loaded for the Proposed pane,
 * else the catalog's own, read once and then drawn on the next redraw of the popover.
 */
function tileMediaHref(rb: RbCtx, ref: string): string | undefined {
  const loaded = rb.controller.mediaHref(ref);
  if (loaded) return loaded;
  const local = localOf(rb);
  if (local.media.has(ref)) return local.media.get(ref) ?? undefined;
  local.media.set(ref, null);
  const assets = rb.host.assets;
  if (!assets || typeof assets.get !== 'function') return undefined;
  void assets.get(ref).then((asset) => {
    const url = asset?.url;
    if (!url) return;
    local.media.set(ref, url);
    if (local.menuEl) fillPanel(rb, local.menuEl);
  }, () => undefined);
  return undefined;
}

/** The compiled slide at the tile's width, set in the design system's faces. */
function tileArtSvg(rb: RbCtx, frame: CompiledFrameV1): string {
  const { brand, mono } = rb.compare.fonts();
  const fonts = { ...(brand ? { brand } : {}), ...(mono ? { mono } : {}) };
  const svg = framePreviewSvg(frame, {
    assetHref: (ref) => tileMediaHref(rb, ref),
    ...(brand || mono ? { fonts } : {}),
    detail: 'thumbnail',
    longEdge: THEME_THUMB_WIDTH,
    // An empty slot is the stage's to hatch; on a tile it would only be noise.
    emptySlots: false,
  });
  const long = Math.max(frame.width, frame.height, 1);
  const w = Math.max(1, Math.round((frame.width * THEME_THUMB_WIDTH) / long));
  const h = Math.max(1, Math.round((frame.height * THEME_THUMB_WIDTH) / long));
  return svg.replace(/^<svg([^>]*?) width="[^"]*" height="[^"]*"/, `<svg$1 width="${w}" height="${h}"`);
}

/**
 * Keep the drawings only while they are of the plan as it stands: another project, plan
 * revision, first slide or design system drops them and stops the compile in flight.
 */
function keepArtFor(rb: RbCtx): void {
  const local = localOf(rb);
  const base = `${rb.state.project?.id ?? ''}|${rb.state.plan?.revision ?? ''}|${firstSlide(rb)?.id ?? ''}|${local.key}`;
  if (local.artBase === base) return;
  stopArt(rb);
  local.art.clear();
  local.artBase = base;
}

/** Stop the tile compile in flight. The drawings already in are kept for the next open. */
function stopArt(rb: RbCtx): void {
  const local = localOf(rb);
  local.artRun?.abort();
  local.artRun = null;
}

/**
 * Start the next tile compile while the popover is open: one at a time, in tile order,
 * each theme once per plan revision. The applied theme is never compiled here, because
 * the Proposed pane's own drawing stands for it. A drawing that comes in redraws the
 * popover, which asks for the next.
 */
function requestArt(rb: RbCtx): void {
  const local = localOf(rb);
  const { plan, source: deck, project, census } = rb.state;
  const input = local.input;
  const slide = firstSlide(rb);
  if (!local.menuEl || !plan || !deck || !project || !input || !slide) return;
  keepArtFor(rb);
  if (local.artRun) return;
  const current = themeKeyOf(plan.designSystem.theme);
  const next = tilesOf(rb).find((choice) => {
    const key = choiceKey(choice);
    return key !== current && !lockedOut(rb, choice) && !local.art.has(key);
  });
  if (!next) return;
  const key = choiceKey(next);
  const run = new AbortController();
  local.artRun = run;
  const request: CompileStageInputV1 & ThemeTileRequestV1 = {
    source: deck,
    ...(census ? { census } : {}),
    plan: previewPlanOf(plan),
    system: input,
    applyUnreviewed: true,
    applyNeedsAttention: true,
    tile: { theme: next.id === 'light' ? null : next.theme, slideIds: [slide.id] },
  };
  void runnerOf()(request, { projectId: project.id, planRevision: plan.revision }, run.signal)
    .then((compiled) => frameOf(compiled, slide.id) ?? null, () => null)
    .then((frame) => {
      // Stopped, or the plan moved on: this drawing is for nobody.
      if (local.artRun !== run || run.signal.aborted) return;
      local.artRun = null;
      local.art.set(key, frame);
      if (local.menuEl) fillPanel(rb, local.menuEl);
    });
}

// ─── copy ────────────────────────────────────────────────────────────────────

/** What the solve found for one theme, as the note's sentence: a problem only, empty when every text reads. */
export function contrastSentence(preview: Pick<ThemePreviewV1, 'textsUnder'> | null, name: string): string {
  if (!preview || preview.textsUnder <= 0) return '';
  const n = preview.textsUnder;
  if (n === 1) return tRaw('On {name}, 1 text would be hard to read.', { name });
  return tRaw('On {name}, {n} texts would be hard to read.', { name, n });
}

/** The note for one theme: what stops it, or what it would make hard to read. Empty when neither. */
function noteText(rb: RbCtx, choice: DeckThemeChoiceV1 | undefined): string {
  if (!choice) return '';
  const name = themeName(choice);
  if (lockedOut(rb, choice)) return tRaw('This design system is locked, so choose Light to use its own colours instead of {name}.', { name });
  const sentence = contrastSentence(previewOf(rb, choice), name);
  if (!sentence) return '';
  // Colours lists the texts once the theme is applied; before that the sentence is enough.
  const current = choiceKey(choice) === themeKeyOf(rb.state.plan?.designSystem.theme);
  return current ? `${sentence} ${tRaw('Colours lists them.')}` : sentence;
}

/**
 * The tile's own sentence, for its `title`: what a Dark with no dark mode is made of.
 * A look tile has none, because the one line under the looks row already says what a
 * look changes, and the same words on every tile would only repeat it.
 */
function tileTitle(choice: DeckThemeChoiceV1): string {
  if (choice.notes.some((note) => note.code === 'theme.no-dark-mode')) {
    return tRaw('This design system has no dark mode, so Dark uses the darkest step of its main colour.');
  }
  return '';
}

function themeOff(rb: RbCtx): boolean {
  return !rb.controller.setTheme || localOf(rb).themeOff;
}

function groundOff(rb: RbCtx): boolean {
  return !rb.controller.setGround || localOf(rb).groundOff;
}

const NOT_BUILT = (): string => tRaw('Themes arrive with the next update.');

// ─── the popover ─────────────────────────────────────────────────────────────

const HEX = /^#[0-9a-f]{6}$/i;

function swatchHtml(hex: string): string {
  return `<i class="rb-theme-sw" style="--sw:${HEX.test(hex) ? hex : 'transparent'}"></i>`;
}

function swatchesHtml(choice: DeckThemeChoiceV1): string {
  return `<span class="rb-theme-sws" aria-hidden="true">${swatchHtml(choice.swatches.ground)}${swatchHtml(choice.swatches.ink)}${swatchHtml(choice.swatches.accent)}</span>`;
}

const NOTE_ID = 'rb-theme-note';

/**
 * One tile: the first slide under the theme, its three colours, its name, and the check
 * when applied. The picture is the compiled slide once it is in and the faces are
 * loaded, else the layout's wireframe in the theme's colours.
 */
function tileHtml(rb: RbCtx, source: ThemeSourceV1, choice: DeckThemeChoiceV1, opts: { checked: boolean; off: boolean }): string {
  const key = choiceKey(choice);
  const title = tileTitle(choice);
  const slide = firstSlide(rb);
  const frame = tileFrame(rb, choice, slide);
  const compiled = frame && rb.compare.fontsReady() ? tileArtSvg(rb, frame) : '';
  const thumb = compiled || themeThumbSvg(source, choice, slide, lookOf(rb, choice));
  return `<button type="button" class="rb-theme-tile" data-theme-act="apply" data-theme-key="${htmlEscape(key)}"`
    + ` data-key="theme-${htmlEscape(key)}" aria-pressed="${opts.checked}" aria-describedby="${NOTE_ID}"`
    + `${title ? ` title="${htmlEscape(title)}"` : ''}${opts.off ? ' aria-disabled="true"' : ''}>`
    + `<span class="rb-theme-thumb" data-theme-art="${compiled ? 'compiled' : 'wireframe'}">${thumb}</span>`
    + swatchesHtml(choice)
    + `<span class="rb-theme-name">${htmlEscape(themeName(choice))}</span>`
    + (opts.checked ? `<span class="rb-theme-cap">${icon('check')}${t('Current')}</span>` : '')
    + '</button>';
}

/**
 * A group of tiles. Each is a button that applies its theme on Enter, Space or a click,
 * pressed when it is the applied one, as the segments are (lib/seg.ts); Tab reaches each,
 * and the arrow keys also move along the group. Not a radio group, whose arrow keys
 * would apply a theme on every press.
 */
function groupHtml(rb: RbCtx, source: ThemeSourceV1, tiles: DeckThemeChoiceV1[], label: string, cls: string): string {
  const current = themeKeyOf(rb.state.plan?.designSystem.theme);
  const off = themeOff(rb);
  const drawn = tiles.map((choice) => tileHtml(rb, source, choice, { checked: choiceKey(choice) === current, off })).join('');
  return `<div class="rb-theme-grid ${cls}" role="group" aria-label="${htmlEscape(label)}">${drawn}</div>`;
}

/** Brand colour's other hues, as a row of swatches under the tiles. */
function huesHtml(rb: RbCtx, hues: ThemeHueV1[]): string {
  if (hues.length === 0) return '';
  const current = themeKeyOf(rb.state.plan?.designSystem.theme);
  const off = themeOff(rb);
  const swatches = hues.map((one) => {
    const key = choiceKey(one.choice);
    return `<button type="button" class="rb-theme-hue" data-theme-act="apply" data-theme-key="${htmlEscape(key)}"`
      + ` data-key="hue-${htmlEscape(one.path)}" aria-pressed="${key === current}" aria-describedby="${NOTE_ID}"`
      + ` aria-label="${htmlEscape(one.name)}" title="${htmlEscape(one.name)}"${off ? ' aria-disabled="true"' : ''}>`
      + `${swatchHtml(one.choice.swatches.ground)}</button>`;
  }).join('');
  return '<div class="rb-theme-hues">'
    + `<span class="rb-theme-hues-name" id="rb-theme-hues-name">${t('Brand colour')}</span>`
    + `<div class="rb-theme-hue-row" role="group" aria-labelledby="rb-theme-hues-name">${swatches}</div></div>`;
}

/** The popover's content: the themes, Brand colour's hues, the looks, the note and the not-built line. */
function panelHtml(rb: RbCtx): string {
  const local = localOf(rb);
  const source = sourceOf(rb);
  if (source === undefined) return `<p class="lp-help rb-theme-wait">${t('Reading the design system colours.')}</p>`;
  if (source === null) return `<p class="lp-help">${t('This device cannot read the design system colours, so themes cannot be shown.')}</p>`;
  const tiles = tilesOf(rb);
  const themes = tiles.filter((one) => one.id !== 'look');
  const looks = tiles.filter((one) => one.id === 'look');
  const current = themeKeyOf(rb.state.plan?.designSystem.theme);
  const focus = [...tiles, ...huesOf(rb).map((one) => one.choice)].find((one) => choiceKey(one) === (local.focusKey ?? current));
  const note = noteText(rb, focus);
  return `<div class="rb-theme-body"${local.busy ? ' aria-busy="true"' : ''}>`
    + groupHtml(rb, source, themes, tRaw('Theme'), 'rb-theme-grid--themes')
    + huesHtml(rb, huesOf(rb))
    + (looks.length > 0
      ? groupHtml(rb, source, looks, tRaw('Looks'), 'rb-theme-grid--looks')
        + `<p class="rb-theme-line">${t('Looks change this project only.')}</p>`
      : '')
    + '</div>'
    + `<p class="rb-theme-note" id="${NOTE_ID}" data-theme-note${note ? '' : ' hidden'}>${icon('alert')}<span data-theme-note-text>${htmlEscape(note)}</span></p>`
    + (themeOff(rb) ? `<p class="rb-theme-off">${htmlEscape(NOT_BUILT())}</p>` : '');
}

/** What the panel draws from besides this module's own state: the plan, the pane's drawing and the faces. */
function panelKeyOf(rb: RbCtx): string {
  const { plan, preview, previewStale } = rb.state;
  return `${plan?.revision ?? ''}|${JSON.stringify(plan?.designSystem.theme ?? null)}|${preview?.planRevision ?? ''}|${previewStale}|${rb.compare.fontsReady()}`;
}

/**
 * Redraw the popover's content, put focus back on the control that had it (found by its
 * `data-key`), and ask for the next tile compile.
 */
function fillPanel(rb: RbCtx, el: HTMLElement): void {
  const active = document.activeElement;
  const key = active instanceof HTMLElement && el.contains(active) ? active.dataset.key : undefined;
  keepArtFor(rb);
  el.innerHTML = panelHtml(rb);
  localOf(rb).panelKey = panelKeyOf(rb);
  if (key) {
    const again = [...el.querySelectorAll<HTMLElement>('[data-key]')].find((one) => one.dataset.key === key);
    again?.focus();
  }
  requestArt(rb);
}

// ─── the Background section ──────────────────────────────────────────────────

/** The deck's own ground under the plan's theme, a look's read from its colours. */
function planDeckGround(rb: RbCtx, themed: ThemedColorsV1 | null): SlideGroundV1 {
  const theme = rb.state.plan?.designSystem.theme;
  if (theme?.id !== 'look' || !themed) return deckGround(theme);
  return deckGround(theme, { surface: themed.colors['color.semantic.surface'], master: themed.master });
}

/** The plan's theme resolved against the design system, or null while the colours are read. */
function currentThemed(rb: RbCtx): ThemedColorsV1 | null {
  const source = localOf(rb).source;
  const theme = rb.state.plan?.designSystem.theme;
  if (!source) return null;
  const look = theme?.id === 'look' ? localOf(rb).looks.find((one) => one.id === theme.lookId) : undefined;
  return themedColors(source, theme, { ...(look ? { look } : {}), locked: localOf(rb).locked });
}

function groundWord(ground: SlideGroundV1): string {
  return ground === 'light' ? tRaw('Light') : ground === 'dark' ? tRaw('Dark') : tRaw('Brand colour');
}

/** What the Background section shows for the selected slides. */
export interface BackgroundModelV1 {
  ids: string[];
  /** The deck's own ground, which a slide with no ground of its own shows. */
  deck: SlideGroundV1;
  /** The ground every selected slide shows, or undefined when they differ. */
  shown: SlideGroundV1 | undefined;
  /** The grounds the segment offers; fewer than two hides it. */
  offered: SlideGroundV1[];
  /** The folded section's flag: "Light", "Dark, this slide", "Dark, 3 slides" or "Mixed". */
  flag: string;
}

/** The Background section's facts for the selection, or null with no plan. */
export function backgroundModel(rb: RbCtx): BackgroundModelV1 | null {
  const plan = rb.state.plan;
  if (!plan) return null;
  const ids = selectedSlideIds(rb.sel, rb.derived?.slides ?? []);
  const themed = currentThemed(rb);
  const theme = plan.designSystem.theme;
  const deck = planDeckGround(rb, themed);
  const slides = ids.map((id) => plan.slides.find((one) => one.id === id)).filter((one): one is SlidePlanV1 => one !== undefined);
  const grounds = new Set(slides.map((one) => one.ground ?? deck));
  const shown = grounds.size === 1 ? [...grounds][0] : slides.length === 0 ? deck : undefined;
  // A ground no selected slide's layout has a variant for is not offered: the compile
  // would draw the deck's ground anyway, so the choice would change nothing.
  const takes = (ground: SlideGroundV1): boolean => ground === deck || !themed
    || slides.some((one) => slideGroundPlan({ layout: one.layout, ground }, themed.master, theme).noVariant !== true);
  // Brand colour is left out where it would draw the very ground Dark draws.
  const first = slides[0];
  const brandIsDark = Boolean(themed && first && deck !== 'brand' && shown !== 'brand' && (() => {
    const brand = slideGroundHex({ layout: first.layout, ground: 'brand' }, themed)?.hex;
    const dark = slideGroundHex({ layout: first.layout, ground: 'dark' }, themed)?.hex;
    return brand && dark && contrastRatio(brand, dark) < THEME_DISTINCT_GROUND;
  })());
  const offered = slides.length === 0
    ? []
    : GROUNDS.filter((ground) => ground === shown || ((ground !== 'brand' || !brandIsDark) && takes(ground)));
  let flag: string;
  if (shown === undefined) flag = tRaw('Mixed');
  else if (shown === deck || ids.length === 0) flag = groundWord(shown);
  else if (ids.length === 1) flag = tRaw('{ground}, this slide', { ground: groundWord(shown) });
  else flag = tRaw('{ground}, {n} slides', { ground: groundWord(shown), n: ids.length });
  return { ids, deck, shown, offered, flag };
}

/** The per-slide segment, as markup. Empty when it would offer one ground, or the controller cannot set one. */
function groundSegHtml(rb: RbCtx, model: BackgroundModelV1): string {
  if (model.offered.length < 2 || groundOff(rb)) return '';
  const number = rb.derived?.slides.find((one) => one.id === model.ids[0])?.number ?? 0;
  const label = model.ids.length === 1
    ? tRaw('Background for slide {n}', { n: number })
    : tRaw('Background for {n} slides', { n: model.ids.length });
  const seg = segHtml('ground', model.offered.map((id) => ({ id, label: groundWord(id) })), model.shown ?? '', label, {
    variant: 'panel',
    attr: 'data-ground',
    extraClass: 'rb-ground-seg',
    busy: localOf(rb).busy,
  });
  const many = model.ids.length > 1 ? `<p class="lp-help rb-ground-help">${t('Sets {n} slides.', { n: model.ids.length })}</p>` : '';
  return '<div class="lp-row rb-ground">'
    + `<span class="lp-row-icon"></span><span class="lp-label">${model.ids.length === 1 ? t('This slide') : t('These slides')}</span>`
    + `<div class="lp-control">${seg}</div>${many}</div>`;
}

/** The theme's name as the door and the top-bar control show it. */
function currentName(rb: RbCtx): { name: string; choice: DeckThemeChoiceV1 | undefined } {
  const choice = currentChoice(rb);
  return { name: choice ? themeName(choice) : storedName(rb), choice };
}

/** The door to the theme popover, at the foot of the Background section. */
function doorHtml(rb: RbCtx): string {
  const local = localOf(rb);
  const { name } = currentName(rb);
  const open = local.from === 'door' && local.menu?.isOpen() === true;
  // In the control column, under the segment, so the section's two controls share one edge.
  return '<div class="lp-row rb-theme-door-row"><span class="lp-row-icon"></span><div class="lp-control">'
    + `<button type="button" class="lp-door rb-theme-door" data-theme-act="open" data-theme-door data-key="theme-door" aria-haspopup="dialog" aria-expanded="${open}">`
    + `<span>${t('Deck theme: {name}', { name })}</span>${icon('arrowRight')}</button></div></div>`;
}

/** Stamp each segment button with the `data-key` the column's focus memo restores by. */
function keySegment(root: HTMLElement): void {
  for (const button of root.querySelectorAll<HTMLElement>('.rb-ground-seg [data-ground]')) button.dataset.key = `ground-${button.dataset.ground ?? ''}`;
}

// ─── work ────────────────────────────────────────────────────────────────────

/** A theme by its key, among the tiles and Brand colour's hues. */
function findChoice(rb: RbCtx, key: string): DeckThemeChoiceV1 | undefined {
  const tiles = tilesOf(rb);
  return tiles.find((one) => choiceKey(one) === key) ?? huesOf(rb).map((one) => one.choice).find((one) => choiceKey(one) === key);
}

async function applyTheme(rb: RbCtx, key: string): Promise<void> {
  const local = localOf(rb);
  if (local.busy) return;
  const choice = findChoice(rb, key);
  if (!choice) return;
  const setTheme = rb.controller.setTheme;
  if (!setTheme || local.themeOff) {
    rb.announce(NOT_BUILT());
    return;
  }
  if (key === themeKeyOf(rb.state.plan?.designSystem.theme)) return;
  if (lockedOut(rb, choice)) {
    rb.announce(tRaw('This design system is locked, so choose Light to use its own colours instead of {name}.', { name: themeName(choice) }));
    return;
  }
  local.busy = true;
  redraw(rb);
  try {
    const outcome = await setTheme.call(rb.controller, choice.id === 'light' ? null : choice.theme);
    if (outcome.refusal === 'not-built') {
      local.themeOff = true;
      rb.announce(NOT_BUILT());
    } else if (outcome.ok) {
      rb.foot.say(tRaw('Deck theme: {name}.', { name: themeName(choice) }), { undo: true });
    }
  } finally {
    local.busy = false;
    local.focusKey = null;
    redraw(rb);
  }
}

async function applyGround(rb: RbCtx, ground: SlideGroundV1): Promise<void> {
  const local = localOf(rb);
  const plan = rb.state.plan;
  if (local.busy || !plan) return;
  const ids = selectedSlideIds(rb.sel, rb.derived?.slides ?? []);
  if (ids.length === 0 || groundOff(rb)) return;
  const setGround = rb.controller.setGround;
  if (!setGround) return;
  const value = ground === planDeckGround(rb, currentThemed(rb)) ? null : ground;
  local.busy = true;
  redraw(rb);
  try {
    const outcome = await setGround.call(rb.controller, ids, value);
    if (outcome.refusal === 'not-built') {
      // The segment goes: a background that cannot apply is hidden, not explained.
      local.groundOff = true;
    } else if (outcome.ok) {
      const word = groundWord(ground);
      rb.foot.say(ids.length === 1
        ? tRaw('Background: {ground}.', { ground: word })
        : tRaw('Background on {n} slides: {ground}.', { n: ids.length, ground: word }), { undo: true });
    }
  } finally {
    local.busy = false;
    redraw(rb);
  }
}

/** Point the note at a theme while it has focus or the pointer, without redrawing the tiles. */
function showNote(rb: RbCtx, root: HTMLElement, key: string | null): void {
  const local = localOf(rb);
  if (local.focusKey === key) return;
  local.focusKey = key;
  const current = themeKeyOf(rb.state.plan?.designSystem.theme);
  const text = noteText(rb, findChoice(rb, key ?? current));
  for (const note of root.querySelectorAll<HTMLElement>('[data-theme-note]')) {
    const span = note.querySelector<HTMLElement>('[data-theme-note-text]');
    if (span) span.textContent = text;
    note.hidden = !text;
  }
}

const CHOICE = 'button[data-theme-key]';

/** Listeners for the popover's element. It is made once per open, so nothing is wired twice. */
function wirePanel(rb: RbCtx, root: HTMLElement): void {
  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-theme-act="apply"]') : null;
    if (target && root.contains(target) && target.dataset.themeKey) void applyTheme(rb, target.dataset.themeKey);
  });
  const choiceOf = (event: Event): HTMLElement | null =>
    event.target instanceof Element ? event.target.closest<HTMLElement>(CHOICE) : null;
  const point = (event: Event): void => {
    const choice = choiceOf(event);
    if (choice?.dataset.themeKey) showNote(rb, root, choice.dataset.themeKey);
  };
  root.addEventListener('focusin', point);
  root.addEventListener('pointerover', point);
  root.addEventListener('focusout', (event) => {
    const next = event.relatedTarget instanceof Element ? event.relatedTarget.closest(CHOICE) : null;
    if (!next) showNote(rb, root, null);
  });
  root.addEventListener('pointerleave', () => {
    const active = document.activeElement instanceof Element ? document.activeElement.closest<HTMLElement>(CHOICE) : null;
    showNote(rb, root, active && root.contains(active) ? active.dataset.themeKey ?? null : null);
  });
  // Enter and Space apply, as on every button. The arrow keys also move focus along one
  // group, without applying: a theme is applied only when asked for.
  root.addEventListener('keydown', (event) => {
    const choice = choiceOf(event);
    const group = choice?.closest('[role="group"]');
    if (!choice || !group) return;
    const choices = [...group.querySelectorAll<HTMLElement>(CHOICE)];
    const at = choices.indexOf(choice);
    let next = -1;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (at + 1) % choices.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (at - 1 + choices.length) % choices.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = choices.length - 1;
    if (next < 0) return;
    event.preventDefault();
    choices[next]?.focus();
  });
}

/** Listeners for the Background section. Its nodes are new on each draw, so nothing is wired twice. */
function wireBackground(rb: RbCtx, root: HTMLElement): void {
  root.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>('[data-theme-act], [data-ground]') : null;
    if (!target || !root.contains(target)) return;
    if (target.dataset.themeAct === 'fold') {
      const local = localOf(rb);
      local.open = !local.open;
      rb.memo.decide = '';
      rb.decide.render();
    } else if (target.dataset.themeAct === 'open') {
      openMenu(rb, 'door');
    } else if (target.dataset.ground) {
      const ground = GROUNDS.find((one) => one === target.dataset.ground);
      if (ground && target.getAttribute('aria-pressed') !== 'true') void applyGround(rb, ground);
    }
  });
}

// ─── the ways in ─────────────────────────────────────────────────────────────

/** The theme a plan shows, for the control and the door: an offered tile, else the stored theme's own. */
function currentChoice(rb: RbCtx): DeckThemeChoiceV1 | undefined {
  const current = themeKeyOf(rb.state.plan?.designSystem.theme);
  return tilesOf(rb).find((one) => choiceKey(one) === current);
}

/** The stored theme's name while the colours are still being read. */
function storedName(rb: RbCtx): string {
  const theme = rb.state.plan?.designSystem.theme;
  if (!theme || themeKeyOf(theme) === 'light') return tRaw('Light');
  const look = theme.id === 'look' ? localOf(rb).looks.find((one) => one.id === theme.lookId) : undefined;
  return themeName({ id: theme.id, ...(look ? { name: look.name } : {}) });
}

/** Draw the Deck theme control into the top bar: a small button that opens the popover. Not on the narrow bar. */
export function renderThemeControl(rb: RbCtx, host: HTMLElement): void {
  const local = localOf(rb);
  const show = Boolean(rb.state.plan) && rb.state.mode === 'renovate';
  host.hidden = !show || rb.narrow;
  if (!show) {
    local.menu?.close(false);
    return;
  }
  if (!local.control || !host.contains(local.control)) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn btn--ghost btn--sm rb-theme-btn';
    button.dataset.key = 'theme-control';
    button.setAttribute('aria-haspopup', 'dialog');
    button.setAttribute('aria-expanded', 'false');
    button.addEventListener('click', () => openMenu(rb, 'top'));
    host.replaceChildren(button);
    local.control = button;
    local.controlKey = '';
  }
  // An open popover follows the plan: an edit, the pane's new drawing or the faces coming in redraw it.
  if (local.menuEl && local.panelKey !== panelKeyOf(rb)) fillPanel(rb, local.menuEl);
  const { name, choice } = currentName(rb);
  const key = `${name}|${choice ? JSON.stringify(choice.swatches) : ''}|${local.busy}`;
  if (local.controlKey === key) return;
  local.controlKey = key;
  const button = local.control;
  button.innerHTML = (choice ? swatchesHtml(choice) : '')
    + `<span class="rb-btn-label">${htmlEscape(name)}</span>${icon('chevronDown')}`;
  button.setAttribute('aria-label', tRaw('Deck theme: {name}', { name }));
  button.title = tRaw('Deck theme: {name}', { name });
}

/** The element the popover hangs from now: the door while it opened from there and is on screen, else the control. */
function liveAnchor(rb: RbCtx): HTMLElement | null {
  const local = localOf(rb);
  if (local.from === 'door') {
    const door = document.querySelector<HTMLElement>('[data-theme-door]');
    if (door?.isConnected) return door;
  }
  return local.control?.isConnected ? local.control : null;
}

/**
 * Open the popover from the top-bar control or the column's door, or close it when it
 * is open from the same place. The anchor follows the live element, because the
 * column redraws its door on every change while the popover stays open.
 */
export function openMenu(rb: RbCtx, from: 'top' | 'door'): void {
  const local = localOf(rb);
  if (local.menu?.isOpen()) {
    const same = local.from === from;
    local.menu.close(false);
    if (same) return;
  }
  local.from = from;
  const anchor: PopoverAnchor = {
    getBoundingClientRect: () => (liveAnchor(rb) ?? document.body).getBoundingClientRect(),
    contains: (node) => liveAnchor(rb)?.contains(node) ?? false,
    focus: () => liveAnchor(rb)?.focus(),
    setAttribute: (name, value) => liveAnchor(rb)?.setAttribute(name, value),
  };
  local.menu ??= mountBodyPopover(anchor, (el) => {
    local.menuEl = el;
    fillPanel(rb, el);
    wirePanel(rb, el);
    // Focus opens on the applied theme, wherever its group is, so the note speaks for it.
    return el.querySelector<HTMLElement>(`${CHOICE}[aria-pressed="true"]`)
      ?? el.querySelector<HTMLElement>(CHOICE);
  }, {
    className: 'rb-theme-pop',
    role: 'dialog',
    ariaLabel: tRaw('Deck theme'),
    // A pointer that rested on a tile when the popover closed must not leave its
    // sentence for the next open.
    onClose: () => {
      local.focusKey = null;
      local.menuEl = null;
      // The tiles compile only while the popover is open.
      stopArt(rb);
    },
  });
  local.menu.open();
  requestArt(rb);
}

/** Draw the Background section into the decision column: the flag, the per-slide segment and the door to the deck theme. */
export function renderStyleSection(rb: RbCtx, host: HTMLElement): void {
  // The colours are read on first use; the read redraws this section when it finishes.
  if (rb.state.plan) sourceOf(rb);
  const model = rb.state.mode === 'renovate' ? backgroundModel(rb) : null;
  if (!model) {
    host.replaceChildren();
    return;
  }
  const local = localOf(rb);
  host.innerHTML = '<section class="lp-sec rb-bg" data-sec="background">'
    + `<button type="button" class="lp-sec-head" data-theme-act="fold" data-key="sec-background" aria-expanded="${local.open}">`
    + `${icon('image')}<span class="lp-sec-name">${t('Background')}</span><em class="lp-sec-flag">${htmlEscape(model.flag)}</em>`
    + '<i class="lp-caret" aria-hidden="true"></i></button>'
    + `<div class="lp-rows"${local.open ? '' : ' hidden'}>${groundSegHtml(rb, model)}${doorHtml(rb)}</div></section>`;
  keySegment(host);
  wireBackground(rb, host);
}

export function themeOps(rb: RbCtx) {
  return {
    renderControl: bindOp(rb, renderThemeControl),
    renderStyle: bindOp(rb, renderStyleSection),
  };
}
