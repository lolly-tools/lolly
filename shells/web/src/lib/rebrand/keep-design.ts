// SPDX-License-Identifier: MPL-2.0
/**
 * Keep the design (plan 274 sections 0 and 4, mode A): the surgical patch the
 * `rebrand-deck` tool has always made, driven by the renovation's design system
 * instead of the tool's form.
 *
 * The steps are the tool's own (`community/rebrand-deck/hooks.js`), so both paths
 * give the same file for the same deck and design system:
 *
 *   1. `host.pptx.inspect` reads the deck with the design system's swatches and
 *      faces, and answers the literal colours and typefaces on the slides, each
 *      with its nearest design-system value (`nearestBrandColor`, `mapFontsToBrand`
 *      in the engine's `brand-map.ts`) plus a whole theme (`suggestRebrandTheme`).
 *   2. That answer becomes the patch plan: the suggested theme, every colour and
 *      typeface whose suggestion differs from what the deck states, and embedded
 *      fonts dropped when a typeface changes (an embedded old face is stale after
 *      a swap).
 *   3. `host.pptx.rebrand` rewrites those values and passes every other byte of the
 *      package through as it arrived.
 *
 * The swatch list is built the way the tool builds it from `host.tokens.colors`:
 * one swatch per colour token path, the path as its name and its role hint, since
 * `brand-map.ts` reads a role by substring (`color.semantic.primary` is an accent).
 *
 * The theme slots are one place this path departs from the tool. `suggestRebrandTheme`
 * picks dk1 and lt1 by lightness among the swatches it reads as neutral, and a design
 * system whose text colour is a tinted dark (SUSE pine) has no dark neutral, so text
 * set in `tx1` came out white on a white slide. Every slot the design system names by
 * token (`themeSlotsFromColors`: dk1 from `color.semantic.text`, lt1 from
 * `color.semantic.surface`, dk2 from `color.semantic.muted`, accent1 to accent3 from
 * primary, secondary and accent) is taken from that token; the suggestion fills only
 * the slots no token names.
 *
 * The preview reads the patched file back through the stage 1 adapter
 * (`sourceDeckFromPptx`) and `compileFaithful`, the same pair that draws the
 * Original pane, so the two panes share one geometry and a wipe between them
 * compares like with like. The patch never touches media, so every picture in
 * the patched file has the content hash it had in the original. The media sink
 * here therefore stores nothing: it answers a ref from the hash alone
 * (`mediaRef`, by default the exact media hash as the contract states refs), and
 * `keep-design.test.ts` checks that no picture arrives that the original did not
 * already hold.
 *
 * Refuses a host without `host.pptx` with `KeepDesignError` code
 * `pptx-unavailable`, and bytes that are not a readable deck with `not-a-deck`.
 * The signal is checked between every step and handed to the read, which checks it
 * between slides; an abort rejects with the signal's own reason.
 *
 * The web ingest stores each picture as a user asset and keeps the id the store
 * gives it, which the hash alone cannot answer. So in the web shell the preview's
 * refs are not the original's; `views/rebrand/keep.ts` draws the Result through the
 * Original's refs, matched by layer id, and a caller that knows the original refs
 * passes `mediaRef` to make them equal here.
 */
import type { HostV1, PptxBrandFonts, PptxBrandSwatch, PptxInspectResult, PptxRebrandPlan } from '@lolly-tools/core/host-v1';
import { compileFaithful, ENGINE_VERSION, parseColorToSrgb8, sha256Hex, THEME_SLOTS, themeSlotsFromColors, type RebrandDesignSystemInputV1 } from '@lolly/engine';
import { inflatePptx } from '@lolly-tools/node-shell/pptx';
import { sourceDeckFromPptx } from '@lolly-tools/node-shell/rebrand/source-pptx';
import type { KeepDesignResultV1, RebrandControllerDepsV1 } from './controller-api.ts';

/** Parses one OOXML part. The web shell passes its native `DOMParser`; a test passes jsdom's. */
export type KeepDesignXmlParserV1 = (xml: string) => Document;

export interface KeepDesignOptionsV1 {
  /** Defaults to the realm's `DOMParser`, created on first use. */
  parseXml?: KeepDesignXmlParserV1;
  /**
   * The asset ref the original read gave the picture with this content hash
   * (hex sha256). Defaults to `sha256:<hex>`, the exact media hash. A shell whose
   * ingest mints refs another way passes its own rule here.
   */
  mediaRef?: (hash: string, mime: string) => string;
}

export type KeepDesignErrorCodeV1 = 'pptx-unavailable' | 'not-a-deck';

/** A refusal the view can name by `code`. `message` is plain English for a log. */
export class KeepDesignError extends Error {
  readonly code: KeepDesignErrorCodeV1;
  constructor(code: KeepDesignErrorCodeV1, message: string) {
    super(message);
    this.name = 'KeepDesignError';
    this.code = code;
  }
}

/** The twelve colour slots a theme part states, the list the tool's before and after strip reads. */
const THEME_COLOUR_SLOTS = [
  'dk1', 'lt1', 'dk2', 'lt2',
  'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6',
  'hlink', 'folHlink',
] as const;

/** Reader identity recorded on the preview source, for replay. */
const PREVIEW_READER = { name: 'pptx-read', version: ENGINE_VERSION };

/** One swatch per colour token path, the path as name and role hint, the way the tool builds its list. */
export function keepDesignSwatches(colors: Record<string, string>): PptxBrandSwatch[] {
  return Object.keys(colors)
    .sort()
    .flatMap((tokenPath): PptxBrandSwatch[] => {
      const hex = colors[tokenPath];
      return typeof hex === 'string' && hex.trim() ? [{ hex, name: tokenPath, role: tokenPath }] : [];
    });
}

/** The design system's faces in the shape `host.pptx.inspect` takes, or undefined when it names none. */
export function keepDesignFonts(system: RebrandDesignSystemInputV1): PptxBrandFonts | undefined {
  const out: PptxBrandFonts = {};
  const { brand, serif, mono } = system.fonts ?? {};
  if (brand?.trim()) out.brand = brand.trim();
  if (serif?.trim()) out.serif = serif.trim();
  if (mono?.trim()) out.mono = mono.trim();
  return Object.keys(out).length > 0 ? out : undefined;
}

const sameHex = (a: string | undefined, b: string | undefined): boolean =>
  typeof a === 'string' && typeof b === 'string' && a.replace(/^#/, '').toUpperCase() === b.replace(/^#/, '').toUpperCase();

const sameFace = (a: string | undefined, b: string | undefined): boolean =>
  typeof a === 'string' && typeof b === 'string' && a.trim().toLowerCase() === b.trim().toLowerCase();

/** The patch plan and the changes it claims, from one inspect answer. */
export interface KeepDesignPlanV1 {
  plan: PptxRebrandPlan;
  /** Theme colour slots whose suggested value differs from the deck's own. */
  themeSlots: number;
  /** Distinct literal colours the plan remaps. */
  colours: number;
  /** Typeface changes, scheme faces first, one entry per source face. */
  fonts: Array<{ from: string; to: string }>;
}

/**
 * A token's colour as `#RRGGBB`, whatever CSS form the design system wrote it in
 * (`#fff`, `#11201CFF`, `rgb()`, `oklch()`, a bare hex), through the engine's colour
 * parser. Undefined only when the value is not a colour at all, or is fully transparent.
 */
export function themeHex(value: string | undefined): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  const rgb = parseColorToSrgb8(/^[0-9a-f]{3,8}$/i.test(raw) ? `#${raw}` : raw);
  if (!rgb) return undefined;
  return `#${rgb.slice(0, 3).map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/**
 * The theme the patch writes: every slot the design system names by token, in the
 * `#RRGGBB` form the plan takes, over the inspect suggestion for the rest. A token in
 * any CSS colour form counts (`themeHex`), so a slot never falls back to the lightness
 * suggestion because its token was written as `#fff` or `rgb()`. With no colours given,
 * the suggestion is used as it is.
 */
export function keepDesignTheme(
  suggestion: PptxInspectResult['themeSuggestion'],
  colors?: Record<string, string>,
): NonNullable<PptxInspectResult['themeSuggestion']> | undefined {
  const theme = { ...(suggestion ?? {}) };
  if (colors) {
    const slots = themeSlotsFromColors(colors);
    for (const slot of THEME_SLOTS) {
      const hex = themeHex(slots[slot]?.hex);
      if (hex) theme[slot] = hex;
    }
  }
  return Object.keys(theme).length > 0 ? theme : undefined;
}

/**
 * Turn an inspect answer into the patch plan, dropping identity rows the same way
 * the tool's `mapOf` does, so a no-op mapping never churns a slide part. `colors`, the
 * design system's colour tokens, sets every theme slot a token names
 * (`keepDesignTheme`).
 */
export function keepDesignPlan(inspected: PptxInspectResult, colors?: Record<string, string>): KeepDesignPlanV1 {
  const plan: PptxRebrandPlan = {};
  let themeSlots = 0;
  const fonts: Array<{ from: string; to: string }> = [];
  const seenFace = new Set<string>();
  const addFace = (from: string | undefined, to: string | undefined): void => {
    if (!from || !to || sameFace(from, to)) return;
    const key = from.trim().toLowerCase();
    if (seenFace.has(key)) return;
    seenFace.add(key);
    fonts.push({ from, to });
  };

  const theme = keepDesignTheme(inspected.themeSuggestion, colors);
  if (theme && Object.keys(theme).length > 0) {
    plan.theme = { ...theme };
    for (const slot of THEME_COLOUR_SLOTS) {
      const to = theme[slot];
      if (to && !sameHex(inspected.theme.colors[slot], to)) themeSlots += 1;
    }
    addFace(inspected.theme.majorFont, theme.majorFont);
    addFace(inspected.theme.minorFont, theme.minorFont);
  }

  const colorMap: Record<string, string> = {};
  for (const colour of inspected.colors) {
    if (colour.suggested && !sameHex(colour.hex, colour.suggested)) colorMap[colour.hex] = colour.suggested;
  }
  const colours = Object.keys(colorMap).length;
  if (colours > 0) plan.colorMap = colorMap;

  const fontMap: Record<string, string> = {};
  for (const font of inspected.fonts) {
    if (font.suggested && !sameFace(font.family, font.suggested)) {
      fontMap[font.family] = font.suggested;
      addFace(font.family, font.suggested);
    }
  }
  if (Object.keys(fontMap).length > 0) plan.fontMap = fontMap;
  plan.dropEmbeddedFonts = fonts.length > 0;

  return { plan, themeSlots, colours, fonts };
}

function defaultParser(): KeepDesignXmlParserV1 {
  let parser: DOMParser | null = null;
  return (xml) => {
    parser ??= new DOMParser();
    return parser.parseFromString(xml, 'application/xml');
  };
}

const defaultMediaRef = (hash: string): string => `sha256:${hash}`;

/**
 * Mode A as the controller's `keepDesign` dependency. Every call inspects, patches
 * and reads back one deck; nothing is kept between calls.
 */
export function keepDesignPatch(
  host: Pick<HostV1, 'pptx'>,
  options: KeepDesignOptionsV1 = {},
): NonNullable<RebrandControllerDepsV1['keepDesign']> {
  const parseXml = options.parseXml ?? defaultParser();
  const mediaRef = options.mediaRef ?? defaultMediaRef;

  return async ({ bytes, system, signal }): Promise<KeepDesignResultV1> => {
    signal.throwIfAborted();
    const pptx = host.pptx;
    if (!pptx || typeof pptx.inspect !== 'function' || typeof pptx.rebrand !== 'function') {
      throw new KeepDesignError('pptx-unavailable', 'This app cannot patch PowerPoint files.');
    }

    const fonts = keepDesignFonts(system);
    const inspected = await pptx.inspect(bytes, fonts
      ? { swatches: keepDesignSwatches(system.colors), fonts }
      : { swatches: keepDesignSwatches(system.colors) });
    signal.throwIfAborted();
    if (!inspected.ok) throw new KeepDesignError('not-a-deck', 'The file is not a readable PowerPoint deck.');

    const planned = keepDesignPlan(inspected, system.colors);
    const patched = await pptx.rebrand(bytes, planned.plan);
    signal.throwIfAborted();

    const parts = await inflatePptx(patched.bytes);
    signal.throwIfAborted();
    const hash = `sha256:${await sha256Hex(patched.bytes)}`;
    signal.throwIfAborted();
    const source = await sourceDeckFromPptx(parts, parseXml, {
      hash,
      instanceId: 'keep-design',
      bytes: patched.bytes.byteLength,
      // Stores nothing: the patch leaves media alone, so the ref the original
      // read gave this content hash is the ref here too.
      sink: async (_media, mime, mediaHash) => mediaRef(mediaHash, mime),
      reader: PREVIEW_READER,
      signal,
    });
    signal.throwIfAborted();

    return {
      bytes: patched.bytes,
      preview: compileFaithful(source),
      changes: {
        themeSlots: patched.report.themesPatched > 0 ? planned.themeSlots : 0,
        colours: patched.report.colorsRemapped > 0 ? planned.colours : 0,
        fonts: planned.fonts,
      },
    };
  };
}
