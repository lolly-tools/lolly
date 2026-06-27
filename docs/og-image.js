// Build-time generator for per-page Open Graph (share preview) images.
//
// Every /info page gets its own 1200×630 card that reproduces the standard Lolly
// OG image — the pine field, the 3D lollipop, the "Lolly" wordmark — but swaps the
// subtitle line for that page's own title. So a link to /info/authoring-tools.html
// previews as the brand card captioned "Authoring Tools".
//
// Why generate rather than reuse one static og.png: social crawlers (Slack, X,
// Facebook, LinkedIn, iMessage) cache one image per URL and only reliably render
// raster (PNG/JPEG), never SVG — so each page needs its own pre-rendered PNG.
//
// How: the original og.png is embedded as the background and only its subtitle band
// is repainted, so the lollipop + wordmark + colours stay byte-faithful to the
// brand card; the new title is drawn in the SUSE typeface. The composite SVG is
// rasterised with @resvg/resvg-js — a build-time-only dependency. Nothing here
// ships to the browser bundle or the engine; if the dependency is missing the
// caller falls back to the static og.png (see docs/build.js).

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OG_W = 1200, OG_H = 630;

// Sampled from the original og.png so the repaint is seamless.
const FIELD   = '#1c4a2e';   // the flat pine background
const SUBTLE  = '#e4e9e6';   // the subtitle's soft off-white

// The subtitle sits in a left-aligned column under the wordmark. The band below is
// repainted with the field colour to clear the original two-line tagline; the new
// title is drawn centred within it. Bounds measured from og.png's pixel content.
const COL_X     = 606;                       // shared left edge of wordmark + subtitle
const BAND      = { x: 598, y: 330, w: OG_W - 598, h: 162 };
const TITLE_MAXW = OG_W - COL_X - 64;         // keep a right margin
const TITLE_SIZE = 54;                        // matches the original tagline weighting
const TITLE_MIN  = 34;                        // floor for very long titles

const xmlEsc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Rough text width (no shaping at build time) → shrink only when a long title would
// overrun the right margin. SUSE Medium averages ~0.54em advance across mixed text.
function fitTitle(title) {
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
function createOgRenderer(Resvg, repoRoot) {
  const ogBase = readFileSync(resolve(repoRoot, 'shells/web/public/og.png')).toString('base64');
  const font   = readFileSync(resolve(repoRoot, 'catalog/fonts/ttf/SUSE-Medium.ttf'));

  const svgFor = (title) => {
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
    render(title) {
      const resvg = new Resvg(svgFor(title), {
        font: { fontBuffers: [font], defaultFontFamily: 'SUSE', loadSystemFonts: false },
        background: FIELD,
      });
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
export async function generateOgImages(pages, outDir, repoRoot, log = () => {}) {
  let renderer;
  try {
    const { Resvg } = await import('@resvg/resvg-js');   // dynamic: a missing dep falls back, not crashes
    renderer = createOgRenderer(Resvg, repoRoot);
  } catch (e) {
    log(`og: image generation skipped (${e.message}); pages fall back to og.png`);
    return new Set();
  }
  mkdirSync(resolve(outDir, 'og'), { recursive: true });
  const done = new Set();
  for (const page of pages) {
    if (!page.slug || !page.title || page.isLanding) continue;
    try {
      writeFileSync(resolve(outDir, 'og', `${page.slug}.png`), renderer.render(page.title));
      done.add(page.slug);
    } catch (e) {
      log(`og: ${page.slug} failed (${e.message}); falls back to og.png`);
    }
  }
  log(`og: generated ${done.size} page card${done.size === 1 ? '' : 's'}`);
  return done;
}
