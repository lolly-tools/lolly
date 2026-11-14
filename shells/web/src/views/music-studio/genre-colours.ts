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
 */
import { contrastRatio, hexToOklch, mixOklch, oklchToHex } from '../../../../../engine/src/brand-derive.ts';
import { parseColorToSrgb8 } from '../../../../../engine/src/css-color.ts';
import type { LofiMood } from '../../../../../engine/src/lofi-compose.ts';
import { audioThumbLeads, audioThumbPool, type ThumbTheme } from '../../lib/audio-thumb-colour.ts';
import { GENRE_GROUPS } from '../../lib/genre-icons.ts';
import { livePalette } from '../../lib/live-palette.ts';

/** One genre's wash: the stronger stop, the softer stop and the direction between them. */
export interface GenreTile { from: string; to: string; angle: number }

/** How much brand colour the stronger stop starts with, on its first and second lap of the pool. */
const LEAD = [0.42, 0.28] as const;
/** How much the softer stop starts with: just enough to read as a second colour. */
const TRAIL = 0.16;
/** How far each try backs the mix off when the title would lose its contrast. */
const STEP = 0.02;
/** The title's contrast floor against every stop (WCAG 2.1 AA for text). */
export const TITLE_CONTRAST = 4.5;
/** The wash's two directions, alternating so a repeated colour still reads as a different tile. */
const ANGLES = [135, 45] as const;

/** A colour mixed into the surface, backed off until the text keeps its contrast; the surface itself when no mix does. */
function stop(surface: string, ink: string, start: number, text: string): string {
  const s = hexToOklch(surface);
  const i = hexToOklch(ink);
  if (!s || !i) return surface;
  for (let t = start; t > 0; t -= STEP) {
    const hex = oklchToHex(mixOklch(s, i, t));
    if (contrastRatio(hex, text) >= TITLE_CONTRAST) return hex;
  }
  return surface;
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
 * title's colour, both as hex. Empty when the pool is: the cards keep their plain surface.
 */
export function genreTiles(colours: readonly string[], surface: string, text: string): Map<LofiMood, GenreTile> {
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
    out.set(mood, {
      from: stop(surface, pool[lead]!, LEAD[lap]!, text),
      to: stop(surface, pool[trail]!, TRAIL, text),
      angle: ANGLES[(k + c) % 2]!,
    });
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
 * Paint the picker's cards: read the card's surface and the title's colour as the page
 * draws them, build the pool for that surface's theme and set each card's wash. Leaves
 * the cards plain when any of those cannot be read.
 */
export async function paintGenreTiles(cards: readonly HTMLElement[], host: unknown): Promise<void> {
  // A card that is not the genre playing now, whose selected look would be read instead.
  const first = cards.find(c => c.getAttribute('aria-pressed') !== 'true') ?? cards[0];
  if (!first) return;
  const surface = cssHex(getComputedStyle(first).backgroundColor);
  const text = cssHex(getComputedStyle(first.querySelector('.msg-name') ?? first).color);
  const lightness = surface ? hexToOklch(surface)?.l : undefined;
  if (!surface || !text || lightness === undefined) return;
  const theme: ThumbTheme = lightness < 0.5 ? 'dark' : 'light';
  const h = host as Parameters<typeof livePalette>[0];
  let pool: string[] = [];
  try { pool = audioThumbPool(await livePalette(h), host as Parameters<typeof audioThumbPool>[1], theme, await audioThumbLeads(host, theme)); } catch { pool = []; }
  const tiles = genreTiles(pool, surface, text);
  for (const card of cards) {
    const tile = tiles.get(card.dataset.genreCard as LofiMood);
    if (!tile) continue;
    card.style.setProperty('--msg-from', tile.from);
    card.style.setProperty('--msg-to', tile.to);
    card.style.setProperty('--msg-angle', `${tile.angle}deg`);
    card.classList.add('is-tinted');
  }
}
