// SPDX-License-Identifier: MPL-2.0
/**
 * Illustrative "your palette applied to graphics" mockups for the brand
 * generator - à la palettemaker.com: instead of a flat row of swatches, show
 * the palette living on real-looking artwork (a poster, a chart, a UI card) so
 * the user sees how the colours actually behave together, and how the picture
 * fills out as they add more colours.
 *
 * Every scene is a viewBox'd SVG string (no <script>, no
 * external <image>/href, no url() refs) meant to be dropped into the DOM via
 * innerHTML. Because the palette comes from user input, EVERY colour is passed
 * through `col()` before it touches an SVG attribute - only `#rgb…#rrggbbaa`
 * hex (per /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i) or the literal 'transparent' survives; anything
 * else (`'#000;url(x)'`, `'red"/>'`, …) is replaced with a safe fallback, so a
 * hostile string can never break out of the attribute it lands in.
 *
 * Typography follows the loaded --font-brand/--font-display roles; export
 * capture bakes their computed styles. The same palette and roles yield the
 * same markup, with no random colours or generated tints.
 */

import { contrastRatio } from '@lolly/engine';
import { escape as escapeHtml } from '../utils.ts';
import { clamp } from '@lolly/engine';

export interface PalettePreviewOptions {
  steps?: number;
  /** Resolved colours from the active design system. Omit for a swatch selection. */
  roles?: { primary?: string; secondary?: string; surface?: string; text?: string; onPrimary?: string };
}

export interface PalettePreview {
  /** Human name for the scene ("Poster", "Chart", "UI card"). */
  label: string;
  /** SVG artwork; font roles inherit from the mounted design system. */
  svg: string;
}

// ── Colour sanitisation ───────────────────────────────────────────────────────

/** The only shapes allowed straight into an SVG attribute (plus 'transparent'). */
const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
/** Neutral stand-in when a colour is missing/invalid, or the palette is empty. */
const FALLBACK = '#8a8f98';
/** A pleasant default palette when the caller passes nothing usable at all. */
const FALLBACK_PALETTE = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'] as const;

/** Attribute-safe colour: a validated hex, 'transparent', or the fallback. */
function col(c: unknown, fallback: string = FALLBACK): string {
  if (c === 'transparent') return 'transparent';
  return typeof c === 'string' && HEX_RE.test(c) ? c : fallback;
}

/** Choose readable text from the engine's WCAG contrast calculation. The scenes
 * use real small type now, so the old brightness threshold is insufficient. */
function ink(bg: string): string {
  const hex = col(bg);
  if (hex === 'transparent') return '#000000';
  return contrastRatio(hex, '#ffffff') > contrastRatio(hex, '#000000') ? '#ffffff' : '#000000';
}

// ── Palette prep ──────────────────────────────────────────────────────────────

/** Sanitise the caller's palette to a non-empty list of real hex colours. */
function normalizePalette(colors: unknown): string[] {
  const arr = Array.isArray(colors) ? colors : [];
  const clean = arr
    .map((c) => (typeof c === 'string' && HEX_RE.test(c) ? c : null))
    .filter((c): c is string => c !== null);
  return clean.length ? clean : [...FALLBACK_PALETTE];
}

/** Use the actual palette for supporting surfaces and text. Only use a neutral
 * fallback when none of its colours can provide readable small text. */
function readableInk(background: string, palette: string[]): string {
  return palette.find(value => contrastRatio(background, value) >= 4.5) ?? ink(background);
}
function paperColour(palette: string[]): string {
  return palette.reduce((lightest, value) => contrastRatio(value, '#000000') > contrastRatio(lightest, '#000000') ? value : lightest);
}

/** Cycle: colour at index `i`, wrapping the palette. */
const at = (pal: string[], i: number): string => col(pal[i % pal.length]);
const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Opening tag: viewBox'd, responsive (fills width, keeps ratio), labelled. */
function open(w: number, h: number, label: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" role="img" `
    + `aria-label="${label}" style="width:100%;height:auto;display:block">`;
}

/** Actual typography and colour proportions, shared by the studio and component gallery.
 * Text follows the loaded brand font roles; export capture bakes their computed styles. */
function text(x: number, y: number, size: number, value: string, fill: string, weight = 400): string {
  const family = size >= 24 ? 'var(--font-display, var(--font-brand, sans-serif))' : 'var(--font-brand, sans-serif)';
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${size}" font-weight="${weight}" fill="${col(fill)}">${escapeHtml(value)}</text>`;
}

function poster(ex: string[], roles: PalettePreviewOptions['roles']): string {
  const bg = col(roles?.primary, at(ex, 0)), accent = col(roles?.secondary, at(ex, 1)), third = at(ex, 2);
  const foreground = col(roles?.onPrimary, readableInk(bg, ex));
  return open(480, 360, 'Colour festival poster using your palette')
    + `<rect width="480" height="360" fill="${bg}"/>`
    + text(28, 34, 11, 'FORM / COLOUR / POSSIBILITY', foreground, 700)
    + text(420, 34, 11, '01—03', foreground)
    + `<path d="M260 64H448V252H260Z" fill="${accent}"/>`
    + `<circle cx="354" cy="158" r="94" fill="${third}"/>`
    + `<path d="M260 158A94 94 0 0 1 354 64V158Z" fill="${bg}"/>`
    + `<path d="M354 158H448A94 94 0 0 1 354 252Z" fill="${at(ex, 3)}"/>`
    + text(25, 119, 58, 'Made', foreground, 700)
    + text(25, 178, 58, 'of', foreground, 700)
    + text(25, 237, 58, 'colour.', foreground, 700)
    + `<rect x="28" y="279" width="424" height="1" fill="${foreground}" opacity=".24"/>`
    + text(28, 308, 12, 'A festival for curious minds.', foreground)
    + text(28, 330, 11, 'Design. Play. Make something new.', foreground)
    + text(367, 330, 11, 'SEP 18—20', foreground, 700)
    + '</svg>';
}

function chart(ex: string[], bars: number, roles: PalettePreviewOptions['roles']): string {
  const paper = col(roles?.surface, paperColour(ex)), foreground = col(roles?.text, readableInk(paper, ex));
  let columns = '';
  const gap = 8, width = (408 - gap * (bars - 1)) / bars;
  for (let i = 0; i < bars; i++) {
    const height = Math.round(52 + 110 * (0.5 + 0.5 * Math.sin(i * 1.25 + .7)));
    columns += `<rect x="${r1(36 + i * (width + gap))}" y="${286 - height}" width="${r1(width)}" height="${height}" rx="4" fill="${at(ex, i)}"/>`;
  }
  return open(480, 360, 'Analytics dashboard using your palette')
    + `<rect width="480" height="360" fill="${paper}"/>`
    + text(32, 34, 11, 'STUDIO / OVERVIEW', foreground, 700)
    + text(32, 77, 24, 'A little more every day.', foreground, 700)
    + text(32, 108, 12, 'Your creative output, this month', foreground)
    + `<path d="M32 286H448M32 230H448M32 174H448" stroke="${foreground}" opacity=".09"/>`
    + columns
    + text(36, 308, 10, 'WEEK 01', foreground)
    + text(391, 308, 10, 'WEEK 04', foreground)
    + `<circle cx="38" cy="336" r="4" fill="${at(ex, 0)}"/>`
    + text(50, 340, 11, 'Made this month', foreground)
    + text(356, 340, 11, '+24% growth', foreground, 700)
    + '</svg>';
}

function uiCard(ex: string[], roles: PalettePreviewOptions['roles']): string {
  const primary = col(roles?.primary, at(ex, 0)), paper = col(roles?.surface, paperColour(ex));
  const foreground = col(roles?.text, readableInk(paper, ex));
  const accent = col(roles?.secondary, at(ex, 1)), third = at(ex, 2);
  return open(480, 360, 'Product card using your palette')
    + `<rect width="480" height="360" fill="${paper}"/>`
    + text(28, 33, 13, 'objects.', foreground, 700)
    + text(348, 33, 10, 'SHOP   /   BAG (0)', foreground)
    + `<rect x="24" y="53" width="432" height="177" rx="8" fill="${accent}"/>`
    // A sculptural desk lamp: a useful object, no photographic dependencies.
    + `<ellipse cx="245" cy="212" rx="90" ry="8" fill="${ink(accent)}" opacity=".1"/>`
    + `<path d="M239 118H251V202H239Z" fill="${primary}"/>`
    + `<path d="M204 202H286L296 212H194Z" fill="${third}"/>`
    + `<path d="M168 136Q178 68 245 68Q312 68 322 136Z" fill="${primary}"/>`
    + `<ellipse cx="245" cy="136" rx="77" ry="8" fill="${third}"/>`
    + text(28, 264, 24, 'Everyday light', foreground, 700)
    + text(400, 262, 15, '$89', foreground, 700)
    + text(28, 286, 11, 'A bright idea for your favourite corner.', foreground)
    + [primary, accent, third, at(ex, 3)].map((colour, i) => `<circle cx="${36 + i * 25}" cy="321" r="8" fill="${colour}"/>`).join('')
    + `<rect x="299" y="303" width="153" height="36" rx="18" fill="${primary}"/>`
    + text(331, 326, 12, 'Add to bag  +', col(roles?.onPrimary, readableInk(primary, ex)), 700)
    + '</svg>';
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Three illustrative SVG scenes painted from `colors` (the brand palette, in
 * order - `colors[0]` is treated as primary). Bar count in the chart reflects
 * the palette size, or `opts.steps` when given. Pure + deterministic; each SVG
 * uses loaded brand font roles and is safe to inject via innerHTML.
 */
export function palettePreviewSvgs(colors: string[], opts?: PalettePreviewOptions): PalettePreview[] {
  const pal = normalizePalette(colors);
  const bars = opts?.steps != null && Number.isFinite(opts.steps)
    ? clamp(Math.round(opts.steps), 2, 12)
    : clamp(pal.length, 5, 8);
  // Cycle the real colours; previews must not invent extra palette shades.
  const ex = pal;
  return [
    { label: 'Poster', svg: poster(ex, opts?.roles) },
    { label: 'Chart', svg: chart(ex, bars, opts?.roles) },
    { label: 'UI card', svg: uiCard(ex, opts?.roles) },
  ];
}
