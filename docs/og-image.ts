// Build-time generators for Open Graph (share preview) images.
//
// Two cards share the brand pine field + SUSE type, rasterised with @resvg/resvg-js
// (a build-time-only dependency — a missing dep degrades to the static og.png):
//
//   • createOgRenderer  — the /info pages. Reproduces the standard Lolly OG image
//     (pine field, 3D lollipop, "Lolly" wordmark) and swaps the subtitle for the
//     page title. So /info/authoring-tools.html previews as the brand card captioned
//     "Authoring Tools". The original og.png is embedded as the background and only
//     its subtitle band is repainted, so the lollipop + wordmark stay byte-faithful.
//
//   • createToolCardRenderer — per-tool share cards (scripts/build-tool-og.ts). A
//     gallery-tile look rather than the lollipop card: the tool's icon, name and
//     description on the pine field, with a smaller framed preview of the tool's own
//     output on the right. So a link to /t/qr-code previews as that tool's card.
//
// Why generate rather than reuse one static og.png: social crawlers (Slack, X,
// Facebook, LinkedIn, iMessage) cache one image per URL and only reliably render
// raster (PNG/JPEG), never SVG — so each page/tool needs its own pre-rendered PNG.

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// @resvg/resvg-js's published types don't yet declare the font.fontBuffers option
// (it's supported at runtime — used below to embed the SUSE ttf bytes directly
// instead of relying on system fonts). Widen the option type locally rather than
// casting; a value of the wider type is structurally assignable to the narrower
// upstream ResvgRenderOptions (extra optional props on a variable, not a fresh
// object literal, don't trip TS's excess-property check). Mirrors the same shape
// in scripts/build-tool-og.ts.
type ResvgCtor = typeof import('@resvg/resvg-js').Resvg;
type ResvgRenderOptions = ConstructorParameters<ResvgCtor>[1];
type ResvgFontOptions = NonNullable<NonNullable<ResvgRenderOptions>['font']> & { fontBuffers?: Buffer[] };
type ResvgOptionsWithFontBuffers = Omit<NonNullable<ResvgRenderOptions>, 'font'> & { font?: ResvgFontOptions };

/** A page from the docs build; only these fields drive card generation. */
export interface OgPage {
  slug: string;
  title: string;
  isLanding?: boolean;
}

/** The per-tool card inputs createToolCardRenderer().render() draws. */
export interface ToolCardInput {
  name: string;
  description?: string;
  iconSvg?: string;
  previewDataUri: string | null;
}

/** A renderer for per-tool share cards, bound to the repo's fonts. */
export interface ToolCardRenderer {
  render(card: ToolCardInput): Buffer;
}

/** A renderer for /info page cards, bound to the base card + SUSE font. */
interface OgRenderer {
  render(title: string): Buffer;
}

const OG_W = 1200, OG_H = 630;

// Sampled from the original og.png so the repaint is seamless.
const FIELD   = '#1c4a2e';   // the flat pine background
const SUBTLE  = '#e4e9e6';   // the subtitle's soft off-white
const MUTED   = '#a7bcb0';   // dimmer green-grey for the tool card's description / footer

// The subtitle sits in a left-aligned column under the wordmark. The band below is
// repainted with the field colour to clear the original two-line tagline; the new
// title is drawn centred within it. Bounds measured from og.png's pixel content.
const COL_X     = 606;                       // shared left edge of wordmark + subtitle
const BAND      = { x: 598, y: 330, w: OG_W - 598, h: 162 };
const TITLE_MAXW = OG_W - COL_X - 64;         // keep a right margin
const TITLE_SIZE = 54;                        // matches the original tagline weighting
const TITLE_MIN  = 34;                        // floor for very long titles

const xmlEsc = (s: string): string => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Rough text width (no shaping at build time) → shrink only when a long title would
// overrun the right margin. SUSE Medium averages ~0.54em advance across mixed text.
function fitTitle(title: string): number {
  const est = title.length * 0.54 * TITLE_SIZE;
  return est <= TITLE_MAXW ? TITLE_SIZE : Math.max(TITLE_MIN, Math.floor(TITLE_SIZE * TITLE_MAXW / est));
}

/**
 * Build a renderer bound to the repo's assets (the base card + the SUSE font),
 * loaded once and reused for every page. `Resvg` is injected so the dependency can
 * be loaded dynamically by the caller (a missing build-time dep then degrades to
 * "keep og.png" rather than crashing the whole site build). Throws if the brand
 * assets are missing.
 */
function createOgRenderer(Resvg: ResvgCtor, repoRoot: string): OgRenderer {
  const ogBase = readFileSync(resolve(repoRoot, 'shells/web/public/og.png')).toString('base64');
  const font   = readFileSync(resolve(repoRoot, 'catalog/fonts/ttf/SUSE-Medium.ttf'));

  const svgFor = (title: string): string => {
    const size = fitTitle(title);
    // Centre the single line in the repainted band (cap height ≈ 0.7em).
    const baseline = Math.round(BAND.y + BAND.h / 2 + size * 0.35);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">`
      + `<image x="0" y="0" width="${OG_W}" height="${OG_H}" href="data:image/png;base64,${ogBase}"/>`
      + `<rect x="${BAND.x}" y="${BAND.y}" width="${BAND.w}" height="${BAND.h}" fill="${FIELD}"/>`
      + `<text x="${COL_X}" y="${baseline}" font-family="SUSE" font-weight="500" font-size="${size}"`
      + ` fill="${SUBTLE}">${xmlEsc(title)}</text>`
      + `</svg>`;
  };

  return {
    /** Render one page's card to PNG bytes. */
    render(title: string): Buffer {
      const options: ResvgOptionsWithFontBuffers = {
        font: { fontBuffers: [font], defaultFontFamily: 'SUSE', loadSystemFonts: false },
        background: FIELD,
      };
      const resvg = new Resvg(svgFor(title), options);
      return resvg.render().asPng();
    },
  };
}

// ── Per-tool share card (gallery-tile style) ─────────────────────────────────

const CARD_MARGIN = 72;
// Framed preview panel on the right; the left column is everything to its left.
const CARD_PANEL  = { x: 696, y: 96, w: 432, h: 438, r: 28, pad: 26 };

// Position the catalog's inlined icon SVG (lucide-style: 24×24 viewBox,
// stroke="currentColor") as a nested <svg> viewport. resvg has no colour context for
// currentColor, so bind it to an explicit colour first. Some icons also set
// width/height on the root <svg>; strip those on the opening tag only (inner
// <rect width=…> stays) so they don't collide with the ones we inject — a duplicate
// attribute is invalid SVG and resvg rejects the whole card.
function placeIcon(iconSvg: string, x: number, y: number, size: number, color: string): string {
  return iconSvg
    .replace(/currentColor/g, color)
    .replace(/^<svg\b[^>]*>/, (tag) => tag
      .replace(/\s(?:width|height)\s*=\s*"[^"]*"/g, '')
      .replace(/^<svg\b/, `<svg x="${x}" y="${y}" width="${size}" height="${size}"`));
}

// Greedy word-wrap to <= maxLines, char width estimated from the font size (resvg's
// <text> doesn't auto-wrap). The last line is ellipsised when text remains.
function wrapLines(text: string | undefined, fontSize: number, boxWidth: number, maxLines: number): string[] {
  const maxChars = Math.max(8, Math.floor(boxWidth / (0.52 * fontSize)));
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  let i = 0;
  for (; i < words.length; i++) {
    const word = words[i];
    if (word === undefined) break;          // unreachable given the loop bound (noUncheckedIndexedAccess)
    const trial = cur ? `${cur} ${word}` : word;
    if (trial.length <= maxChars) { cur = trial; continue; }
    if (cur) lines.push(cur);
    cur = word;
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
 * returns PNG bytes: the tool's icon + name + description on the pine field, with the
 * (already-rasterised) preview framed in a white panel on the right. With no preview,
 * a large tinted icon stands in. Same dynamic-import / degrade contract as createOgRenderer.
 */
export function createToolCardRenderer(Resvg: ResvgCtor, repoRoot: string): ToolCardRenderer {
  const fonts = ['Bold', 'Medium', 'Regular']
    .map((w) => readFileSync(resolve(repoRoot, `catalog/fonts/ttf/SUSE-${w}.ttf`)));

  const svgFor = ({ name, description, iconSvg, previewDataUri }: ToolCardInput): string => {
    const M = CARD_MARGIN;
    const P = CARD_PANEL;
    const textW = P.x - M - 40;                  // left column width

    const nameSize = fitName(name, textW);
    const nameLines = wrapLines(name, nameSize, textW, 2);

    const out: string[] = [];
    out.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${OG_W}" height="${OG_H}" viewBox="0 0 ${OG_W} ${OG_H}">`);
    out.push(`<rect width="${OG_W}" height="${OG_H}" fill="${FIELD}"/>`);

    // Brand wordmark, top-left.
    out.push(`<text x="${M}" y="98" font-family="SUSE" font-weight="700" font-size="34" fill="${SUBTLE}">Lolly</text>`);

    // Preview panel: soft shadow → white card → contain-fit preview (or a tinted
    // placeholder icon when the tool has no preview yet).
    out.push(`<rect x="${P.x + 6}" y="${P.y + 12}" width="${P.w}" height="${P.h}" rx="${P.r}" fill="rgba(0,0,0,0.22)"/>`);
    out.push(`<rect x="${P.x}" y="${P.y}" width="${P.w}" height="${P.h}" rx="${P.r}" fill="#ffffff"/>`);
    if (previewDataUri) {
      const ix = P.x + P.pad, iy = P.y + P.pad, iw = P.w - 2 * P.pad, ih = P.h - 2 * P.pad;
      out.push(`<image x="${ix}" y="${iy}" width="${iw}" height="${ih}" preserveAspectRatio="xMidYMid meet" href="${previewDataUri}"/>`);
    } else if (iconSvg) {
      const s = 190;
      out.push(placeIcon(iconSvg, P.x + (P.w - s) / 2, P.y + (P.h - s) / 2, s, FIELD));
    }

    // Tool icon (left column).
    if (iconSvg) out.push(placeIcon(iconSvg, M, 148, 60, SUBTLE));

    // Tool name (1–2 lines), then description (≤3 lines).
    let y = 250;
    for (const line of nameLines) {
      out.push(`<text x="${M}" y="${y}" font-family="SUSE" font-weight="700" font-size="${nameSize}" fill="${SUBTLE}">${xmlEsc(line)}</text>`);
      y += Math.round(nameSize * 1.06);
    }
    y += 16;
    for (const line of wrapLines(description, 26, textW, 3)) {
      out.push(`<text x="${M}" y="${y}" font-family="SUSE" font-weight="400" font-size="26" fill="${MUTED}">${xmlEsc(line)}</text>`);
      y += 36;
    }

    // Footer.
    out.push(`<text x="${M}" y="${OG_H - 54}" font-family="SUSE" font-weight="500" font-size="24" fill="${MUTED}">lolly.tools</text>`);

    out.push(`</svg>`);
    return out.join('');
  };

  return {
    /** Render one tool's card to PNG bytes. */
    render(card: ToolCardInput): Buffer {
      const options: ResvgOptionsWithFontBuffers = {
        font: { fontBuffers: fonts, defaultFontFamily: 'SUSE', loadSystemFonts: false },
        background: FIELD,
      };
      const resvg = new Resvg(svgFor(card), options);
      return resvg.render().asPng();
    },
  };
}

/**
 * Generate one PNG per page into <outDir>/og/<slug>.png. `pages` is the build's
 * page list; only pages with a `slug` and `title` get a card (the landing page is
 * skipped — it keeps the canonical untitled og.png). Best-effort: returns the set
 * of slugs successfully written, or an empty set if the renderer can't start, so
 * the caller can point only those pages at their generated image.
 */
export async function generateOgImages(
  pages: OgPage[],
  outDir: string,
  repoRoot: string,
  log: (message: string) => void = () => {},
): Promise<Set<string>> {
  let renderer: OgRenderer;
  try {
    const { Resvg } = await import('@resvg/resvg-js');   // dynamic: a missing dep falls back, not crashes
    renderer = createOgRenderer(Resvg, repoRoot);
  } catch (e) {
    log(`og: image generation skipped (${e instanceof Error ? e.message : String(e)}); pages fall back to og.png`);
    return new Set();
  }
  mkdirSync(resolve(outDir, 'og'), { recursive: true });
  const done = new Set<string>();
  for (const page of pages) {
    if (!page.slug || !page.title || page.isLanding) continue;
    try {
      writeFileSync(resolve(outDir, 'og', `${page.slug}.png`), renderer.render(page.title));
      done.add(page.slug);
    } catch (e) {
      log(`og: ${page.slug} failed (${e instanceof Error ? e.message : String(e)}); falls back to og.png`);
    }
  }
  log(`og: generated ${done.size} page card${done.size === 1 ? '' : 's'}`);
  return done;
}
