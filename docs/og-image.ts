// SPDX-License-Identifier: MPL-2.0
// Build-time generators for Open Graph (share preview) images.
//
// All three cards are light-on-dark in the brand's own field + type, and are rasterised through OUR
// OWN render path (Chromium via Playwright - scripts/lib/rasterize-svg-browser.ts), NOT a
// second SVG interpreter like resvg. One render path means a card is shaped the way the
// app paints, can't drift (resvg mis-rendered some brand illustrations / panicked on
// others), and a missing browser degrades to the committed / static og.png:
//
//   • createLandingCardRenderer - the default share card, shells/web/public/og.png
//     (scripts/build-og-base.ts). The Lolly lollipop beside the wordmark + tagline on
//     the brand field. Generated from icon.svg (via the mark), so the default
//     card can't drift from the app icon - it used to be a hand-made PNG carrying an
//     older lollipop while everything else had moved on.
//
//   • createToolCardRenderer - per-tool share cards (scripts/build-tool-og.ts). The
//     tool's icon, name and description light-on-dark on the brand's own field, under a
//     co-brand row (the Lolly lollipop lockup + the brand's reverse logo), with a framed
//     preview of the tool's own output on the right. So a link to /t/qr-code previews as
//     that tool's card.
//
//   • createViewCardRenderer - per-view AND per-/info-page share cards
//     (scripts/build-view-og.ts and docs/build.ts → generateOgImages). The same
//     light-on-dark language for the app's own sections (Tools, Projects, Catalogue, …)
//     and the docs pages (Authoring Tools, URL Mode, …): a rounded app-icon tile, the
//     title (wrapping to two lines for long docs titles), a one-line description, a
//     faint icon watermark, and the lollipop cropped by the bottom-right corner.
//
// All three renderers take the `BrandChrome` from loadBrandChrome() - field, accent, ink
// and marks resolved from the ACTIVE profile's catalog, with the Lolly mark taken from
// icon.svg - so nothing below hardcodes one brand's palette, and every mounted profile's
// cards come out in its own colours.
//
// Why generate rather than reuse one static og.png: social crawlers (Slack, X,
// Facebook, LinkedIn, iMessage) cache one image per URL and only reliably render
// raster (PNG/JPEG), never SVG - so each page/tool needs its own pre-rendered PNG.

import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createTokenSet, colorToHex } from '../engine/src/tokens.ts';
import { createSvgRasterizer } from '../scripts/lib/rasterize-svg-browser.ts';
import { stampBitmap } from '../scripts/lib/stamp-media.ts';

// A self-contained SVG string → PNG bytes, at the given size. Injected into each card
// renderer so they rasterise through the browser path (createSvgRasterizer) - a missing
// browser then degrades ("keep committed / og.png") rather than crashing the build.
type SvgToPng = (svg: string, opts: { width: number; height: number; background?: string }) => Promise<Buffer>;

// A page from the build's page list; only `slug` + `title` (non-landing) get a card.
// `description` captions the card (falls back to the site tagline when absent).
interface OgPage { slug?: string; title?: string; description?: string; isLanding?: boolean; }

// The per-tool card inputs.
interface ToolCard {
  name: string;
  description: string;
  iconSvg?: string;
  previewDataUri?: string;
}

const OG_W = 1200, OG_H = 630;

const xmlEsc = (s: unknown): string => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// ── Brand chrome, resolved from the ACTIVE PROFILE ───────────────────────────
//
// The tool and view cards are painted light-on-dark in the active brand's own
// colours: the dark theme's `surface` is the field, its `primary` the accent and
// its `text` the ink. Those three semantic tokens exist in every brand pack
// (SUSE's resolve to pine/jungle/white; an ingested brand's to its own ramps), so
// nothing here hardcodes SUSE - which matters because this module renders cards
// for every profile, and `catalog/` is only ever the ACTIVE one (see
// scripts/build-og-all.ts, which rebuilds each mounted profile in turn).
//
// The marks are the co-brand: Lolly's own lollipop (repo-root icon.svg, parent-
// owned and brand-agnostic) top-left as a lockup with the wordmark, and the
// brand's REVERSE (on-dark) horizontal logo top-right, resolved from the catalog
// by asset TAGS rather than by id - `suse/logo/hor-neg-white` is a SUSE-only id,
// but `['logo','horizontal','on-dark']` is how any brand pack describes the same
// thing. A brand with no logo asset (lolly-start) simply gets no second mark.

export interface BrandLogo {
  /** The logo SVG as a data-URI, ready for an <image href>. */
  href: string;
  /** width / height, from its viewBox - the caller sets width and derives height. */
  ratio: number;
}

export interface BrandChrome {
  /** Card field - the brand's dark-theme surface. */
  field: string;
  /** Accent for the tool icon / app-icon tile - the dark-theme primary. */
  accent: string;
  /** Primary type - the dark-theme text colour. */
  ink: string;
  /** Descriptions: ink mixed back toward the field. */
  muted: string;
  /** Footer: one step dimmer again. */
  footer: string;
  /** The brand's reverse (on-dark) horizontal logo, or null when it ships none. */
  logo: BrandLogo | null;
  /** Lolly's own lollipop mark as a data-URI, or null if the asset is missing. */
  mark: string | null;
}

// Fallbacks when a brand ships no readable tokens: the SUSE-sampled pine family the
// cards have always used, so a tokenless profile (lolly-start) still renders a card in
// the house style rather than failing.
const CHROME_FALLBACK = { field: '#0c322c', accent: '#30ba78', ink: '#ffffff' };

/** Blend two #rrggbb colours in sRGB. Chrome only - never a palette value. */
function mixHex(a: string, b: string, t: number): string {
  const parse = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [ar, ag, ab] = parse(a), [br, bg, bb] = parse(b);
  const ch = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0');
  return `#${ch(ar!, br!)}${ch(ag!, bg!)}${ch(ab!, bb!)}`;
}

/** Read the active catalog's asset index, or null when there isn't one. */
function readAssetIndex(repoRoot: string): { assets?: unknown[] } | null {
  const file = resolve(repoRoot, 'catalog/assets/index.json');
  if (!existsSync(file)) return null;
  try { return JSON.parse(readFileSync(file, 'utf8')); } catch { return null; }
}

// Asset-index entries are dynamic JSON; only the fields read here are typed.
interface IndexAsset {
  id?: string;
  type?: string;
  tags?: string[];
  formats?: Array<{ format?: string; url?: string }>;
}

/** The URL of an asset's format, resolved to a path inside the active catalog view. */
function assetFile(repoRoot: string, asset: IndexAsset, format: string): string | null {
  const url = asset.formats?.find(f => f.format === format)?.url;
  if (!url) return null;
  const file = resolve(repoRoot, url.replace(/^\//, ''));
  return existsSync(file) ? file : null;
}

/** The dark-theme semantic colours of the active brand's DTCG token asset. */
function brandColors(repoRoot: string, assets: IndexAsset[]): typeof CHROME_FALLBACK {
  const tokens = assets.find(a => a.type === 'tokens' && a.tags?.includes('brand'));
  const file = tokens ? assetFile(repoRoot, tokens, 'json') : null;
  if (!file) return CHROME_FALLBACK;
  try {
    // The dark theme is the one the cards paint in - light-on-dark by design.
    const set = createTokenSet(JSON.parse(readFileSync(file, 'utf8')), { theme: 'dark' });
    const hex = (path: string, fallback: string) =>
      colorToHex(set.resolve(path)) || fallback;
    return {
      field:  hex('color.semantic.surface', CHROME_FALLBACK.field),
      accent: hex('color.semantic.primary', CHROME_FALLBACK.accent),
      ink:    hex('color.semantic.text',    CHROME_FALLBACK.ink),
    };
  } catch { return CHROME_FALLBACK; }
}

/** The brand's reverse (on-dark) horizontal logo, by tags - never by brand-specific id. */
function brandLogo(repoRoot: string, assets: IndexAsset[]): BrandLogo | null {
  const onDark = assets.filter(a => a.tags?.includes('logo') && a.tags.includes('on-dark'));
  // Prefer a horizontal mono/white lockup (it sits beside white type without
  // introducing a second hue), then any horizontal one, then anything on-dark.
  const pick = onDark.find(a => a.tags!.includes('horizontal') && a.tags!.includes('mono'))
    ?? onDark.find(a => a.tags!.includes('horizontal'))
    ?? onDark[0];
  const file = pick ? assetFile(repoRoot, pick, 'svg') : null;
  if (!file) return null;
  const svg = readFileSync(file, 'utf8');
  const vb = /viewBox="([\d.eE+\-\s]+)"/.exec(svg)?.[1]?.trim().split(/\s+/).map(Number);
  if (!vb || vb.length < 4 || !vb[2] || !vb[3]) return null;
  return { href: `data:image/svg+xml,${encodeURIComponent(svg)}`, ratio: vb[2] / vb[3] };
}

/**
 * Resolve the card chrome for whatever profile is currently mounted. Pure reads - 
 * a missing/unreadable catalog degrades to the pine fallback rather than throwing,
 * because a card is worth more than a build failure (same contract as the missing
 * browser). Call once per run and pass the result to both card renderers.
 */
export function loadBrandChrome(repoRoot: string): BrandChrome {
  const assets = (readAssetIndex(repoRoot)?.assets ?? []) as IndexAsset[];
  const { field, accent, ink } = brandColors(repoRoot, assets);
  // The Lolly mark: the single source of truth, repo-root icon.svg (the hand-drawn,
  // C2PA- + RDF-signed vector) - the SAME file the app icons + og.png derive from, so the
  // card mark can't drift from the app icon. Embedded as an SVG data-URI and rasterised
  // through the Chromium card path (which paints its mix-blend-mode + filters correctly,
  // unlike resvg/librsvg), exactly like brandLogo() above. The source's `<style>` block
  // (shutter-blade spin + hue drift) is stripped from the EMBEDDED STRING only - derived
  // cards are static by decision (2026-08-10), and a screenshot of the animated mark
  // would capture a nondeterministic, hue-shifted frame. The signed file is untouched.
  const markFile = resolve(repoRoot, 'icon.svg');
  return {
    field, accent, ink,
    muted:  mixHex(ink, field, 0.38),
    footer: mixHex(ink, field, 0.58),
    logo: brandLogo(repoRoot, assets),
    mark: existsSync(markFile)
      ? `data:image/svg+xml,${encodeURIComponent(stripSvgAnimation(readFileSync(markFile, 'utf8')))}`
      : null,
  };
}

/**
 * Remove CSS `<style>` animation blocks (and any SMIL animation elements) from an SVG
 * string. Nested <style> blocks drain via the loop; the orphan close tag a nested block
 * leaves behind is dropped too, so the result stays valid standalone SVG/XML for a
 * data-URI `<image>` href (an XML parser would reject a stray `</style>`).
 */
function stripSvgAnimation(svg: string): string {
  let out = svg;
  while (/<style\b/.test(out)) out = out.replace(/<style\b[^>]*>[\s\S]*?<\/style>/, '');
  return out
    .replace(/<\/style>/g, '')
    .replace(/<(animate|animateTransform|animateMotion|set)\b[^>]*\/>/g, '')
    .replace(/<(animate|animateTransform|animateMotion|set)\b[\s\S]*?<\/\1>/g, '');
}

/** The Lolly lollipop + wordmark lockup, top-left of every card. */
function lockup(chrome: BrandChrome, x: number, baseline: number, size = 54): string {
  const mark = chrome.mark
    ? `<image x="${x}" y="${baseline - size + 8}" width="${size}" height="${size}" href="${chrome.mark}"/>`
    : '';
  const tx = chrome.mark ? x + size + 18 : x;
  return `${mark}<text x="${tx}" y="${baseline}" font-family="SUSE" font-weight="700"`
    + ` font-size="36" fill="${chrome.ink}">Lolly</text>`;
}

/** The brand's reverse logo at a given width, or nothing when the brand ships none. */
function brandMark(chrome: BrandChrome, x: number, y: number, w: number): string {
  if (!chrome.logo) return '';
  return `<image x="${x}" y="${y}" width="${w}" height="${w / chrome.logo.ratio}" href="${chrome.logo.href}"/>`;
}

// ── Landing / default share card (og.png) ───────────────────────────────────
//
// The one card that isn't about a specific tool, view or page: shells/web/public/og.png,
// the default share image for the site and the fallback whenever a per-page card is
// missing. The Lolly lollipop beside the wordmark + tagline on the brand field - 
// generated from icon.svg (chrome.mark), so it can never fall behind the app icon.

const LANDING_TAGLINE = ['fast, free, reproducible', 'assets & tools'];

/**
 * Build the landing-card renderer. `render()` returns og.png's bytes: the lollipop on
 * the left, the "Lolly" wordmark + tagline on the right, on the brand field. `rasterize`
 * is injected (browser path) so a missing browser degrades to "keep the committed og.png"
 * rather than crashing; `chrome` comes from loadBrandChrome().
 */
export function createLandingCardRenderer(rasterize: SvgToPng, chrome: BrandChrome) {
  const svgFor = (): string => {
    const markSize = 430;
    const markX = 92, markY = Math.round((OG_H - markSize) / 2);
    const textX = markX + markSize + 76;
    const out: string[] = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">`);
    out.push(`<rect width="${OG_W}" height="${OG_H}" fill="${chrome.field}"/>`);
    if (chrome.mark) out.push(`<image x="${markX}" y="${markY}" width="${markSize}" height="${markSize}" href="${chrome.mark}"/>`);
    out.push(`<text x="${textX}" y="298" font-family="SUSE" font-weight="700" font-size="150" fill="${chrome.ink}">Lolly</text>`);
    let ty = 388;
    for (const line of LANDING_TAGLINE) {
      out.push(`<text x="${textX}" y="${ty}" font-family="SUSE" font-weight="400" font-size="46" fill="${chrome.muted}">${xmlEsc(line)}</text>`);
      ty += 62;
    }
    out.push(`</svg>`);
    return out.join('');
  };
  return {
    /** Render the landing card to PNG bytes (via the injected browser rasteriser). */
    render(): Promise<Buffer> {
      return rasterize(svgFor(), { width: OG_W, height: OG_H, background: chrome.field });
    },
  };
}

// ── Per-tool share card (gallery-tile style) ─────────────────────────────────

const CARD_MARGIN = 72;
// Framed preview panel on the right; the left column is everything to its left.
// It sits BELOW the header rule (y 150, not 96) so the co-brand row reads as chrome.
const CARD_PANEL  = { x: 696, y: 150, w: 432, h: 372, r: 28, pad: 24 };

// The panel stays WHITE even though the field is dark: tool previews are authored
// for a light canvas (the brand-lockup preview's black wordmark disappears on a
// tinted dark panel), so the card frames the tool's own output on white and leaves
// the brand colours to the field around it.
const CARD_PANEL_BG    = '#ffffff';
const CARD_PLACEHOLDER = '#d8e0dc';   // no-preview placeholder icon tint (on the white panel)

// Left-column vertical rhythm: co-brand row, rule, tool icon, name, description.
const CARD_RULE_Y      = 120;   // hairline under the co-brand row
const CARD_LOGO_W      = 150;   // brand reverse logo width, top-right
const CARD_ICON_SIZE   = 96;    // tool icon, in the accent
const CARD_ICON_Y      = 172;   // icon top edge, below the rule
const CARD_NAME_Y      = 360;   // first name baseline
const CARD_STROKE_W    = 1.2;   // icon stroke-width (lucide viewBox units)

// Position the catalog's inlined icon SVG (lucide-style: 24×24 viewBox,
// stroke="currentColor") as a nested <svg> viewport. resvg has no colour context for
// currentColor, so bind it to an explicit colour first. Some icons also set
// width/height (and their own stroke-width) on the root <svg>; strip those on the
// opening tag only (inner <rect width=…> stays) so they don't collide with the ones
// we inject - a duplicate attribute is invalid SVG and resvg rejects the whole card.
// stroke-width is injected on the root and inherited by the (unstyled) child paths.
function placeIcon(iconSvg: string, x: number, y: number, size: number, color: string, strokeWidth: number = CARD_STROKE_W): string {
  return iconSvg
    .replace(/currentColor/g, color)
    .replace(/^<svg\b[^>]*>/, (tag) => tag
      .replace(/\s(?:width|height|stroke-width)\s*=\s*"[^"]*"/g, '')
      .replace(/^<svg\b/, `<svg x="${x}" y="${y}" width="${size}" height="${size}" stroke-width="${strokeWidth}"`));
}

// Greedy word-wrap to <= maxLines, char width estimated from the font size (resvg's
// <text> doesn't auto-wrap). The last line is ellipsised when text remains.
function wrapLines(text: string, fontSize: number, boxWidth: number, maxLines: number): string[] {
  const maxChars = Math.max(8, Math.floor(boxWidth / (0.52 * fontSize)));
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  let i = 0;
  for (; i < words.length; i++) {
    const trial = cur ? `${cur} ${words[i]!}` : words[i]!;
    if (trial.length <= maxChars) { cur = trial; continue; }
    if (cur) lines.push(cur);
    cur = words[i]!;
    if (lines.length === maxLines) break;          // all lines filled, words remain
  }
  if (lines.length < maxLines && cur) { lines.push(cur); cur = ''; i = words.length; }
  if (i < words.length || (cur && lines.length === maxLines)) {
    let last = lines[lines.length - 1] || '';
    while (last.length && last.length + 1 > maxChars) last = last.slice(0, -1);
    lines[lines.length - 1] = `${last.replace(/[\s,.;:]+$/, '')}…`;
  }
  return lines;
}

// Shrink the tool name only when it would overrun the text column at the base size.
function fitName(name: string, boxWidth: number): number {
  const BASE = 58, MIN = 40;
  const est = String(name).length * 0.55 * BASE;
  return est <= boxWidth ? BASE : Math.max(MIN, Math.floor(BASE * boxWidth / est));
}

/**
 * Build a per-tool card renderer. `render({ name, description, iconSvg, previewDataUri })`
 * returns PNG bytes: the co-brand row (Lolly lockup + the brand's reverse logo), then the
 * tool's icon + name + description on the brand's dark field, with the preview framed in a
 * white panel on the right (the preview rides in as an SVG data-URI and is painted by the
 * same browser that rasterises the card - no second interpreter). With no preview, a large
 * tinted icon stands in. `rasterize` is injected so a missing browser degrades ("keep
 * committed card") instead of crashing, like the old resvg path; `chrome` comes from
 * loadBrandChrome() so the card is painted in the ACTIVE profile's colours and marks.
 */
export function createToolCardRenderer(rasterize: SvgToPng, chrome: BrandChrome) {
  const svgFor = ({ name, description, iconSvg, previewDataUri }: ToolCard): string => {
    const M = CARD_MARGIN;
    const P = CARD_PANEL;
    const textW = P.x - M - 48;                  // left column width

    const nameSize = fitName(name, textW);
    const nameLines = wrapLines(name, nameSize, textW, 2);

    const out: string[] = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">`);
    out.push(`<rect width="${OG_W}" height="${OG_H}" fill="${chrome.field}"/>`);

    // Co-brand row: Lolly lockup left, the brand's reverse logo right, hairline under both.
    out.push(lockup(chrome, M, 96));
    out.push(brandMark(chrome, OG_W - M - CARD_LOGO_W, 62, CARD_LOGO_W));
    out.push(`<rect x="${M}" y="${CARD_RULE_Y}" width="${OG_W - 2 * M}" height="1" fill="${chrome.ink}" opacity="0.16"/>`);

    // Preview panel: soft shadow → white card → contain-fit preview (or a tinted
    // placeholder icon when the tool has no preview yet).
    out.push(`<rect x="${P.x + 6}" y="${P.y + 12}" width="${P.w}" height="${P.h}" rx="${P.r}" fill="#000000" opacity="0.22"/>`);
    out.push(`<rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" rx="${P.r}" fill="${CARD_PANEL_BG}"/>`);
    if (previewDataUri) {
      const ix = P.x + P.pad, iy = P.y + P.pad, iw = P.w - 2 * P.pad, ih = P.h - 2 * P.pad;
      out.push(`<image x="${ix}" y="${iy}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMid meet" href="${previewDataUri}"/>`);
    } else if (iconSvg) {
      const s = 170;
      out.push(placeIcon(iconSvg, P.x + (P.w - s) / 2, P.y + (P.h - s) / 2, s, CARD_PLACEHOLDER));
    }

    // Tool icon (left column) - thin-stroked in the brand accent, above the name.
    if (iconSvg) out.push(placeIcon(iconSvg, M, CARD_ICON_Y, CARD_ICON_SIZE, chrome.accent));

    // Tool name (1–2 lines), then description (≤3 lines).
    let y = CARD_NAME_Y;
    for (const line of nameLines) {
      out.push(`<text x="${M}" y="${y}" font-family="SUSE" font-weight="700" font-size="${nameSize}" fill="${chrome.ink}">${xmlEsc(line)}</text>`);
      y += Math.round(nameSize * 1.06);
    }
    y += 14;
    for (const line of wrapLines(description, 26, textW, 3)) {
      out.push(`<text x="${M}" y="${y}" font-family="SUSE" font-weight="400" font-size="26" fill="${chrome.muted}">${xmlEsc(line)}</text>`);
      y += 36;
    }

    // Footer.
    out.push(`<text x="${M}" y="${OG_H - 54}" font-family="SUSE" font-weight="500" font-size="24" fill="${chrome.footer}">lolly.tools</text>`);

    out.push(`</svg>`);
    return out.join('');
  };

  return {
    /** Render one tool's card to PNG bytes (via the injected browser rasteriser). */
    render(card: ToolCard): Promise<Buffer> {
      return rasterize(svgFor(card), { width: OG_W, height: OG_H, background: chrome.field });
    },
  };
}

// ── Per-view share card (app-section header style) ───────────────────────────
//
// The app's own sections (Tools, Utilities, Projects, Catalogue, Dashboard, Verify,
// Brand setup, Colour Lab, Batch mode, PDF, Profile) shared as clean deep links
// (/tools, /u, /p, /c, /d, /v, …). Same field, marks and type as the tool card - what
// differs is the composition: no preview panel, but an app-icon tile in the accent, a
// much bigger title, a low-opacity watermark of the same icon bleeding off the right
// edge, and the lollipop cropped by the corner. Cohesive as a family; distinguished by
// icon + title.

const VIEW_MARGIN = 72;
// Colours come from the active brand (loadBrandChrome) - the view card is the same
// light-on-dark family as the tool card, so only its composition differs.
const VIEW_LOGO_W = 150;             // brand reverse logo width, top-right
// The accent app-icon tile (top-left) and the title beneath it.
const VIEW_TILE   = { x: VIEW_MARGIN, y: 176, size: 120, r: 28 };
const VIEW_ICON_INSET = 28;          // icon padding inside the tile
const VIEW_TITLE_Y   = 418;          // title baseline
const VIEW_TITLE_SIZE = 82;
const VIEW_TITLE_MIN  = 52;
// The lollipop, big and cropped by the bottom-right corner - brand texture that
// says "Lolly" without competing with the type column on the left.
const VIEW_MARK_SIZE = 300;

// The per-view card inputs. `iconSvg` is a lucide-style 24×24 stroke icon.
interface ViewCard {
  title: string;
  description: string;
  iconSvg: string;
}

// Shrink the (usually one-word) title only if it would overrun the text column.
function fitViewTitle(title: string, boxWidth: number): number {
  const est = String(title).length * 0.6 * VIEW_TITLE_SIZE;
  return est <= boxWidth ? VIEW_TITLE_SIZE : Math.max(VIEW_TITLE_MIN, Math.floor(VIEW_TITLE_SIZE * boxWidth / est));
}

/**
 * Build a per-view card renderer. `render({ title, description, iconSvg })` returns
 * PNG bytes: a green app-icon tile, the view title and a one-line description on the
 * pine field, with a large translucent icon watermark bleeding off the right. `rasterize`
 * is injected (browser path) so a missing browser degrades to the committed cards.
 */
export function createViewCardRenderer(rasterize: SvgToPng, chrome: BrandChrome) {
  const svgFor = ({ title, description, iconSvg }: ViewCard): string => {
    const M = VIEW_MARGIN;
    const textW = OG_W - M - 480;                // type column - clear of the lollipop
    const titleSize = fitViewTitle(title, textW);

    const out: string[] = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">`);
    out.push(`<rect width="${OG_W}" height="${OG_H}" fill="${chrome.field}"/>`);

    // Watermark: the view's own icon, huge and faint, bleeding off the right edge - 
    // brand texture that names the section without competing with the type.
    const wm = 600;
    out.push(`<g opacity="0.10">${placeIcon(iconSvg, OG_W - wm + 176, (OG_H - wm) / 2, wm, chrome.accent, 1.1)}</g>`);

    // The lollipop, cropped by the bottom-right corner.
    if (chrome.mark) {
      const s = VIEW_MARK_SIZE;
      out.push(`<image x="${OG_W - s - 40}" y="${OG_H - s + 96}" width="${s}" height="${s}" href="${chrome.mark}"/>`);
    }

    // Co-brand row: Lolly lockup left, the brand's reverse logo right.
    out.push(lockup(chrome, M, 96));
    out.push(brandMark(chrome, OG_W - M - VIEW_LOGO_W, 62, VIEW_LOGO_W));

    // App-icon tile: a rounded accent square with the view icon in the field colour - 
    // reads like a real app icon, so each section has a recognisable mark.
    const T = VIEW_TILE;
    out.push(`<rect x="${T.x}" y="${T.y}" width="${T.size}" height="${T.size}" rx="${T.r}" fill="${chrome.accent}"/>`);
    out.push(placeIcon(iconSvg, T.x + VIEW_ICON_INSET, T.y + VIEW_ICON_INSET, T.size - 2 * VIEW_ICON_INSET, chrome.field, 2));

    // Title, then a one-line (≤2) description beneath it.
    // Title wraps to ≤2 lines (short view names stay one line; long docs titles like
    // "Import a design (Figma, Penpot, …)" take two). The LAST line sits on the base
    // baseline so a one- vs two-line title keeps the same optical anchor.
    const titleLines = wrapLines(title, titleSize, textW, 2);
    const titleStep = Math.round(titleSize * 0.94);
    let ty = VIEW_TITLE_Y - (titleLines.length - 1) * titleStep;
    for (const line of titleLines) {
      out.push(`<text x="${M}" y="${ty}" font-family="SUSE" font-weight="700" font-size="${titleSize}" fill="${chrome.ink}">${xmlEsc(line)}</text>`);
      ty += titleStep;
    }
    let y = VIEW_TITLE_Y + 56;
    for (const line of wrapLines(description, 30, textW, 2)) {
      out.push(`<text x="${M}" y="${y}" font-family="SUSE" font-weight="400" font-size="30" fill="${chrome.muted}">${xmlEsc(line)}</text>`);
      y += 42;
    }

    // Footer.
    out.push(`<text x="${M}" y="${OG_H - 44}" font-family="SUSE" font-weight="500" font-size="24" fill="${chrome.footer}">lolly.tools</text>`);

    out.push(`</svg>`);
    return out.join('');
  };

  return {
    /** Render one view's card to PNG bytes (via the injected browser rasteriser). */
    render(card: ViewCard): Promise<Buffer> {
      return rasterize(svgFor(card), { width: OG_W, height: OG_H, background: chrome.field });
    },
  };
}

// The mark every /info card carries in its app-icon tile + watermark: a book, in the
// same lucide 24×24 stroke style as the view icons - so a docs card reads as part of
// the same family as the Tools / Utilities / Dashboard cards, just captioned by its
// page title. (One mark for all docs pages; the title is what distinguishes them.)
const DOCS_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
  + '<path d="M12 7v14"/>'
  + '<path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>'
  + '</svg>';

// Pages without their own description fall back to the site tagline rather than a bare
// title card. Matches docs/build.ts's SITE_DESCRIPTION intent (kept in sync by eye).
const DOCS_DESC_FALLBACK = 'Fast, free, reproducible assets and tools - on your own device.';

/**
 * Generate one PNG per /info page into <outDir>/og/<slug>.png, in the same view-card
 * family as the app's own sections: a docs-icon tile, the page title (wrapping to two
 * lines), the page description, a faint watermark and the corner lollipop. `pages` is
 * the build's page list; only pages with a `slug` and `title` get a card (the landing
 * page keeps the canonical og.png). Best-effort: returns the set of slugs successfully
 * written, or an empty set if the renderer can't start, so the caller can point only
 * those pages at their generated image.
 */
export async function generateOgImages(
  pages: OgPage[],
  outDir: string,
  repoRoot: string,
  log: (msg: string) => void = () => {},
): Promise<Set<string>> {
  let renderer: ReturnType<typeof createViewCardRenderer>;
  let rasterizer: Awaited<ReturnType<typeof createSvgRasterizer>>;
  try {
    // Our own render path (Chromium). A missing browser / fonts throws → pages fall
    // back to og.png, same degrade contract as the old dynamic-resvg import.
    rasterizer = await createSvgRasterizer(repoRoot);
    renderer = createViewCardRenderer(rasterizer.rasterize, loadBrandChrome(repoRoot));
  } catch (e) {
    log(`og: image generation skipped (${(e as Error).message}); pages fall back to og.png`);
    return new Set();
  }
  mkdirSync(resolve(outDir, 'og'), { recursive: true });
  const done = new Set<string>();
  for (const page of pages) {
    if (!page.slug || !page.title || page.isLanding) continue;
    try {
      // Stamp our own brand card with the Lolly Imprint + "made with Lolly" C2PA
      // before writing (see scripts/lib/stamp-media.ts).
      const png = await renderer.render({
        title: page.title,
        description: page.description || DOCS_DESC_FALLBACK,
        iconSvg: DOCS_ICON,
      });
      const stamped = await stampBitmap(new Uint8Array(png), 'png', { id: page.slug, name: page.title });
      writeFileSync(resolve(outDir, 'og', `${page.slug}.png`), Buffer.from(stamped));
      done.add(page.slug);
    } catch (e) {
      log(`og: ${page.slug} failed (${(e as Error).message}); falls back to og.png`);
    }
  }
  await rasterizer.close();
  log(`og: generated ${done.size} page card${done.size === 1 ? '' : 's'}`);
  return done;
}
