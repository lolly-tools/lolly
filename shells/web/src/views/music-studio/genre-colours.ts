// SPDX-License-Identifier: MPL-2.0
/**
 * The genre picker's tile colours (views/music-studio/genre-picker.ts): each genre's card
 * gets its own wash of two brand colours, so the genres read apart at a glance and the
 * icons stay as they are.
 *
 * The colours come from the design system the way the audio thumbnails' ink does
 * (lib/audio-thumb-colour.ts): the colourways' leads first, then the brand palette, each
 * kept only when it shows against the theme's surface and reads as a different colour
 * from every colour already kept. No hue the brand does not own is invented: a brand with
 * one colour gets its variety from how strongly that colour is mixed in and which way
 * the wash runs.
 *
 * Each of the wash's two stops is a brand colour mixed into the card's own surface in
 * OKLCH (engine/src/brand-derive.ts), as strongly as the title allows: the mix backs off
 * until the title's colour reaches 4.5:1 against the stop, so the wash never costs the
 * text its contrast, in light or dark, under any brand.
 *
 * The assignment follows the genre's place in the picker (its group, then A to Z), so a
 * genre keeps its look, tiles side by side in a row take different colours, and the
 * groups open on colours spread evenly round the pool: six different ones when the brand
 * has at least six.
 *
 * The music generator's genre button (genre-hero.ts) wears the same colours as the
 * genre's card, much stronger (HERO_WASH), so the genre playing reads at a glance from
 * across the room. On a light theme a deep brand colour, which could hold dark text only
 * as a pale wash, turns the text to the surface's own colour (white) and shows at the
 * lightest mix that keeps 6:1, rich rather than near black; every stop holds at least
 * 4.5:1 against whichever text it carries. On a dark theme the blend stays nearer
 * the cards', so a bright brand colour does not glare out of a dark bar.
 */
import { contrastRatio, hexToOklch, mixOklch, oklchToHex } from '../../../../../engine/src/brand-derive.ts';
import { parseColorToSrgb8 } from '../../../../../engine/src/css-color.ts';
import type { LofiMood } from '../../../../../engine/src/lofi-compose.ts';
import { audioThumbLeads, audioThumbPool, type ThumbTheme } from '../../lib/audio-thumb-colour.ts';
import { GENRE_GROUPS } from '../../lib/genre-icons.ts';
import { livePalette } from '../../lib/live-palette.ts';

/** One genre's wash: the stronger stop, the softer stop and the direction between them,
 *  and the text colour when it is not the theme's own (`ink`, the hero's light text on a deep colour). */
export interface GenreTile { from: string; to: string; angle: number; ink?: string }

/** How strongly a wash takes the brand's colours. */
export interface WashStrength {
  /** How much brand colour the stronger stop starts with, on its first and second lap of the pool. */
  lead: readonly [number, number];
  /** How much the softer stop starts with. */
  trail: number;
  /** Whether the text may take the surface's own colour where that lets far more colour show. */
  flipInk?: boolean;
}
/** The picker's cards: a soft wash, the softer stop just enough to read as a second colour. */
export const CARD_WASH: WashStrength = { lead: [0.42, 0.28], trail: 0.16 };
/** The genre button, the bar's hero: most of the colour on a light theme, a measured step up from the cards on a dark one. */
export const HERO_WASH: Readonly<Record<ThumbTheme, WashStrength>> = {
  light: { lead: [0.9, 0.78], trail: 0.55, flipInk: true },
  dark: { lead: [0.56, 0.44], trail: 0.26 },
};
/** How far each try backs the mix off when the title would lose its contrast. */
const STEP = 0.02;
/** The title's contrast floor against every stop (WCAG 2.1 AA for text). */
export const TITLE_CONTRAST = 4.5;
/** The contrast light text asks of a deep colour on the hero: well past the floor, so the
 *  colour is rich, and no further, so it stays a colour rather than near black. */
const FLIP_CONTRAST = 6;
/** How much more colour light text must let show before the hero turns its text light. */
const FLIP_GAIN = 0.1;
/** The wash's two directions, alternating so a repeated colour still reads as a different tile. */
const ANGLES = [135, 45] as const;

/** A colour mixed into the surface as strongly as `start` allows, backed off until the text
 *  keeps its contrast: the mix and how much colour it holds, or null when no mix does. */
function strongest(surface: string, colour: string, start: number, text: string): { hex: string; t: number } | null {
  const s = hexToOklch(surface);
  const c = hexToOklch(colour);
  if (!s || !c) return null;
  for (let t = start; t > 0; t -= STEP) {
    const hex = oklchToHex(mixOklch(s, c, t));
    if (contrastRatio(hex, text) >= TITLE_CONTRAST) return { hex, t };
  }
  return null;
}

/** A colour mixed into the surface as lightly as keeps the text at `floor` against it, from
 *  `from` upward: for light text on a colour that darkens as more goes in. Null when none does. */
function lightest(surface: string, colour: string, from: number, text: string, floor: number): { hex: string; t: number } | null {
  const s = hexToOklch(surface);
  const c = hexToOklch(colour);
  if (!s || !c) return null;
  for (let t = from; t <= 1 + 1e-9; t += STEP) {
    const hex = oklchToHex(mixOklch(s, c, Math.min(1, t)));
    if (contrastRatio(hex, text) >= floor) return { hex, t: Math.min(1, t) };
  }
  return null;
}

/** A colour's place in OKLab, for telling how far apart two colours read. */
function oklab(hex: string): [number, number, number] | null {
  const o = hexToOklch(hex);
  if (!o) return null;
  const r = (o.h * Math.PI) / 180;
  return [o.l, o.c * Math.cos(r), o.c * Math.sin(r)];
}

/**
 * The pool in the order the tiles take it: the lead first, then each time the colour
 * farthest from the one before, so the colours side by side in the picker are the
 * brand's least alike, whatever order the brand lists them in.
 */
export function spreadPool(pool: readonly string[]): string[] {
  const left = pool.flatMap((hex) => { const p = oklab(hex); return p ? [{ hex, p }] : []; });
  const out: Array<{ hex: string; p: [number, number, number] }> = [];
  while (left.length) {
    const last = out[out.length - 1];
    let pick = 0;
    if (last) {
      let far = -1;
      left.forEach((c, i) => {
        const d = Math.hypot(c.p[0] - last.p[0], c.p[1] - last.p[1], c.p[2] - last.p[2]);
        if (d > far) { far = d; pick = i; }
      });
    }
    out.push(left.splice(pick, 1)[0]!);
  }
  return out.map((c) => c.hex);
}

/**
 * Every genre's wash from a colour pool (audioThumbPool), the card's surface and the
 * title's colour, both as hex, as strongly as `strength` allows (the cards' soft wash by
 * default). Empty when the pool is: the cards keep their plain surface.
 */
export function genreTiles(colours: readonly string[], surface: string, text: string, strength: WashStrength = CARD_WASH): Map<LofiMood, GenreTile> {
  const out = new Map<LofiMood, GenreTile>();
  const pool = spreadPool(colours);
  const n = pool.length;
  if (!n || !hexToOklch(surface) || !hexToOklch(text)) return out;
  GENRE_GROUPS.forEach((group, c) => { group.moods.forEach((mood, k) => {
    const slot = k + Math.floor((c * n) / GENRE_GROUPS.length);
    const lead = slot % n;
    const lap = Math.floor(slot / n) % 2;
    // The softer stop is another of the brand's colours, a step or two on round the pool.
    const trail = n > 1 ? (lead + 1 + (n > 2 ? lap : 0)) % n : lead;
    let from = strongest(surface, pool[lead]!, strength.lead[lap]!, text);
    let ink: string | undefined;
    if (strength.flipInk) {
      // A deep colour holds dark text only as a pale wash: where light text (the surface's own
      // colour) lets clearly more of the colour show, the text turns light.
      const turned = lightest(surface, pool[lead]!, from?.t ?? 0, surface, FLIP_CONTRAST);
      if (turned && turned.t >= (from?.t ?? 0) + FLIP_GAIN) { from = turned; ink = surface; }
    }
    const lit = from?.hex ?? surface;
    // The softer stop holds the same text. Under light text it is another deep colour of the
    // brand's, or else the lead a shade deeper, so the wash still runs between two stops.
    const to = ink
      ? ((trail !== lead ? lightest(surface, pool[trail]!, 0, ink, FLIP_CONTRAST) : null) ?? lightest(surface, pool[lead]!, Math.min(1, (from?.t ?? 1) + 0.12), ink, TITLE_CONTRAST))?.hex ?? lit
      : strongest(surface, pool[trail]!, strength.trail, text)?.hex ?? surface;
    out.set(mood, { from: lit, to, angle: ANGLES[(k + c) % 2]!, ...(ink ? { ink } : {}) });
  }); });
  return out;
}

/** A computed CSS colour as hex, or null when it cannot be read or is not opaque enough to judge contrast on. */
export function cssHex(value: string | null | undefined): string | null {
  const rgba = parseColorToSrgb8(value);
  if (!rgba || rgba[3] < 0.95) return null;
  return `#${rgba.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Every genre's wash for a surface and a title colour as the page draws them (computed CSS
 * colours): the pool for that surface's theme, from the design system. Empty when either
 * colour cannot be read, or the design system gives no colours; the genre picker's cards
 * and the music generator's genre button (genre-hero.ts, `use: 'hero'`, the stronger
 * HERO_WASH for the surface's theme) both paint from this.
 */
export async function genreWashes(host: unknown, surfaceCss: string | null | undefined, textCss: string | null | undefined, use: 'card' | 'hero' = 'card'): Promise<Map<LofiMood, GenreTile>> {
  const surface = cssHex(surfaceCss);
  const text = cssHex(textCss);
  const lightness = surface ? hexToOklch(surface)?.l : undefined;
  if (!surface || !text || lightness === undefined) return new Map();
  const theme: ThumbTheme = lightness < 0.5 ? 'dark' : 'light';
  const h = host as Parameters<typeof livePalette>[0];
  let pool: string[] = [];
  try { pool = audioThumbPool(await livePalette(h), host as Parameters<typeof audioThumbPool>[1], theme, await audioThumbLeads(host, theme)); } catch { pool = []; }
  return genreTiles(pool, surface, text, use === 'hero' ? HERO_WASH[theme] : CARD_WASH);
}

/**
 * Paint the picker's cards: read the card's surface and the title's colour as the page
 * draws them, build the pool for that surface's theme and set each card's wash. Leaves
 * the cards plain when any of those cannot be read.
 */
export async function paintGenreTiles(cards: readonly HTMLElement[], host: unknown): Promise<void> {
  // A card that is not the genre playing now, whose selected look would be read instead.
  const first = cards.find(c => c.getAttribute('aria-pressed') !== 'true') ?? cards[0];
  if (!first) return;
  const tiles = await genreWashes(host, getComputedStyle(first).backgroundColor, getComputedStyle(first.querySelector('.msg-name') ?? first).color);
  for (const card of cards) {
    const tile = tiles.get(card.dataset.genreCard as LofiMood);
    if (!tile) continue;
    card.style.setProperty('--msg-from', tile.from);
    card.style.setProperty('--msg-to', tile.to);
    card.style.setProperty('--msg-angle', `${tile.angle}deg`);
    card.classList.add('is-tinted');
  }
}
