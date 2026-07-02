#!/usr/bin/env node
/**
 * Per-tool Open Graph (social share) generator.
 *
 * Run as part of `build:web` (after build:info, before the vite build), or directly:
 *   node scripts/build-tool-og.js
 *
 * Why this exists: the web shell routes tools by URL *fragment* (#/tool/<id>), which
 * social crawlers (Slack, X, LinkedIn, iMessage, Facebook, Discord) never send to the
 * server and never execute JS for. So every shared tool link previewed as the one
 * generic og.png. This generates, per tool, a crawler-visible landing stub — the exact
 * static file shells/web/public/t/<id>.html — whose <head> carries that tool's own
 * title, description and 1200×630 share image. A human visitor's browser then runs the
 * stub's inline redirect into the SPA at /#/tool/<id> (carrying any shared ?params);
 * crawlers ignore the script and read the tags.
 *
 * Share image, in priority order:
 *   1. Author override — tools/<id>/og.{png,jpg,jpeg,webp} (committed, raster). Lets a
 *      tool ship its own preferred art; it WINS over the generated default.
 *   2. Generated default — a gallery-tile card (tool icon + name + description + a
 *      framed preview of the tool's own output) rendered by docs/og-image.js into
 *      catalog/og/<id>.png. These are COMMITTED (like catalog/previews) and served at
 *      /catalog/og/<id>.png. Rendering needs @resvg/resvg-js, which does NOT reliably
 *      install on the Vercel build (it was a devDep; promoting it to a dependency still
 *      didn't take because the build restores a stale node_modules cache and npm no-ops
 *      "up to date"). So we commit the cards: build:web / dev:web refresh them LOCALLY
 *      (where resvg works), and the git deploy ships those bytes. On a resvg-less build
 *      the cards are left untouched (never wiped) and the stubs still point at them.
 *   3. Fallback — the generic /og.png only when a tool has no committed card at all.
 *
 * Serving: this deploy's catch-all rewrite (/(.*) → /index.html, no cleanUrls) serves
 * ONLY exact static file paths — extensionless/directory paths fall through to the SPA
 * shell (verified against lolly.tools). So the stub is a flat file at /t/<id>.html, and
 * vercel.json + .vercel/output/config.json rewrite the clean /t/<id> share URL onto it
 * (a scoped rule before the SPA catch-all). The Share button emits /t/<id>
 * (shells/web/src/views/tool.js, shareUrlFromParts); parseRoute (shells/web/src/main.js)
 * also redirects /t/<id> for a human who lands without the rewrite (dev, or a
 * fall-through) so routing degrades gracefully even if only crawler OG is affected.
 *
 * Source of truth is the committed catalog/tools/index.json — it already carries each
 * tool's name, description and inlined icon SVG, so this needs no manifest walk and
 * works on a plain git deploy. Output dirs are git-ignored and rebuilt each run,
 * mirroring the /info OG images. The share card is rendered with @resvg/resvg-js, a
 * build-time-only dep: if it's missing, stubs still emit but point at og.png.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createToolCardRenderer, type ToolCardRenderer } from '../docs/og-image.ts';
import type { CatalogIndexEntry } from './build-catalog-index.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://lolly.tools';

// `@resvg/resvg-js`'s published types don't yet declare the `font.fontBuffers` option
// (it's supported at runtime — used below to embed the SUSE ttf bytes directly instead
// of relying on system fonts). Extend the option type locally rather than casting to
// `any`; a value of this wider type is structurally assignable to the narrower
// upstream `ResvgRenderOptions` (extra optional properties on a variable, not a fresh
// object literal, don't trip TS's excess-property check).
type ResvgCtor = typeof import('@resvg/resvg-js').Resvg;
type ResvgRenderOptions = ConstructorParameters<ResvgCtor>[1];
type ResvgFontOptions = NonNullable<NonNullable<ResvgRenderOptions>['font']> & { fontBuffers?: Buffer[] };
type ResvgOptionsWithFontBuffers = Omit<NonNullable<ResvgRenderOptions>, 'font'> & { font?: ResvgFontOptions };

// Author override: a tool may ship its own preferred share image as
// tools/<id>/og.{png,jpg,jpeg,webp} (committed, served at /tools/<id>/og.<ext>).
// When present it WINS over the generated default — authors force their own art.
// Raster only: crawlers don't take SVG, and an SVG would need resvg at serve time.
const AUTHOR_EXTS = ['png', 'jpg', 'jpeg', 'webp'];
function authorOgImage(id: string): string | null {
  for (const ext of AUTHOR_EXTS) {
    if (existsSync(resolve(ROOT, 'tools', id, `og.${ext}`))) {
      return `${SITE_URL}/tools/${id}/og.${ext}`;
    }
  }
  return null;
}

const PUBLIC = resolve(ROOT, 'shells/web/public');
// Flat files, NOT <id>/index.html: this deploy's catch-all rewrite (/(.*) →
// /index.html, no cleanUrls) serves ONLY exact static file paths — a directory or
// extensionless path falls through to the SPA shell (verified against the live
// site). So the stub is the exact file /t/<id>.html; vercel.json rewrites the clean
// /t/<id> share URL onto it. See the og: comment block at the top of this file.
const STUB_DIR = resolve(PUBLIC, 't');         // → /t/<id>.html        (exact static file)
// Generated default cards are COMMITTED here (served /catalog/og/<id>.png), mirroring
// the committed catalog/previews — so a git deploy ships them even though @resvg/resvg-js
// fails to install on the Vercel build (devDep pruning + stale build cache). Locally,
// where resvg works, build:web refreshes these; commit the changes like previews.
const OG_DIR = resolve(ROOT, 'catalog/og');    // → /catalog/og/<id>.png (committed)
const FALLBACK_IMG = `${SITE_URL}/og.png`;
const FALLBACK_DESC = 'Generate on-brand assets from simple inputs. Works offline.';

const esc = (s: string): string => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

interface StubHtmlOpts {
  id: string;
  name: string;
  description?: string;
  image: string;
  sized: boolean;
}

// id is a validated slug ([a-z0-9-]); safe to embed raw in JS strings / attributes.
// `sized` declares the 1200×630 dimensions — true for our generated card and the
// og.png fallback (both 1200×630), false for an author override of unknown size.
function stubHtml({ id, name, description, image, sized }: StubHtmlOpts): string {
  const title = `${name} — Lolly`;
  const url = `${SITE_URL}/t/${id}`;
  const desc = description || FALLBACK_DESC;
  const dims = sized
    ? `\n<meta property="og:image:width" content="1200" />\n<meta property="og:image:height" content="630" />`
    : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
<link rel="canonical" href="${esc(url)}" />
<meta name="theme-color" content="#0c322c" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Lolly" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${esc(image)}" />${dims}
<meta property="og:image:alt" content="${esc(name)} — a Lolly tool" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(title)}" />
<meta name="twitter:description" content="${esc(desc)}" />
<meta name="twitter:image" content="${esc(image)}" />
<link rel="icon" href="/favicon.ico" sizes="any" />
<script>
  // A human who followed a shared link lands here → boot the app at the tool route,
  // carrying any shared params. Crawlers don't run this; they just read the tags above.
  location.replace('/#/tool/${id}' + location.search);
</script>
</head>
<body>
<p style="font-family:system-ui,-apple-system,sans-serif;padding:2rem;color:#1c4a2e">
  Opening ${esc(name)} in Lolly… <a href="/#/tool/${id}">Continue</a>
</p>
</body>
</html>
`;
}

// The tool's preview thumbnail (catalog index `preview` path), turned into a PNG
// data-URI the card can embed. PNG previews are inlined as-is; SVG previews are
// rasterised through resvg first (they're self-contained brand vectors — verified to
// render — but a crawler only takes raster). Returns null when there's no preview
// file, so the card falls back to a placeholder icon.
function previewDataUri(previewPath: string | undefined, Resvg: ResvgCtor, fontBuffers: Buffer[]): string | null {
  if (!previewPath) return null;
  const file = resolve(ROOT, previewPath.replace(/^\//, ''));
  if (!existsSync(file)) return null;
  if (file.endsWith('.png')) {
    return `data:image/png;base64,${readFileSync(file).toString('base64')}`;
  }
  if (file.endsWith('.svg')) {
    try {
      const options: ResvgOptionsWithFontBuffers = {
        font: { fontBuffers, loadSystemFonts: false, defaultFontFamily: 'SUSE' },
        fitTo: { mode: 'width', value: 820 },   // ~2× the card's preview box for crispness
        background: 'white',                     // letterbox blends into the white frame
      };
      const r = new Resvg(readFileSync(file, 'utf8'), options);
      return `data:image/png;base64,${r.render().asPng().toString('base64')}`;
    } catch { return null; }
  }
  return null;
}

async function main(): Promise<void> {
  const parsed: unknown = JSON.parse(readFileSync(resolve(ROOT, 'catalog/tools/index.json'), 'utf8'));
  // JSON trust boundary: catalog/tools/index.json is generated by
  // build-catalog-index.ts and validated by validate-catalog.ts.
  const index = parsed as { tools: CatalogIndexEntry[] };
  const tools = Array.isArray(index.tools) ? index.tools : [];

  // Renderer is best-effort: a missing build-time resvg degrades stubs to og.png
  // rather than failing the whole web build (mirrors docs/og-image.js).
  let renderer: ToolCardRenderer | null = null;
  let Resvg: ResvgCtor | null = null;
  let previewFonts: Buffer[] = [];
  try {
    ({ Resvg } = await import('@resvg/resvg-js'));
    renderer = createToolCardRenderer(Resvg, ROOT);
    // Fonts for rasterising SVG previews that carry live text.
    previewFonts = ['Medium', 'Regular'].map((w) => readFileSync(resolve(ROOT, `catalog/fonts/ttf/SUSE-${w}.ttf`)));
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.log(`tool-og: card generation skipped (${message}); stubs fall back to og.png`);
  }

  // Stubs (HTML, no resvg needed) are git-ignored and rebuilt from scratch each run.
  // Cards (catalog/og/<id>.png) are COMMITTED and only (re)written when resvg is
  // available — never wiped — so a Vercel build (where resvg won't install) keeps the
  // committed cards rather than deleting them and falling back to og.png.
  rmSync(STUB_DIR, { recursive: true, force: true });
  mkdirSync(STUB_DIR, { recursive: true });
  mkdirSync(OG_DIR, { recursive: true });

  let cards = 0, stubs = 0, withPreview = 0, overrides = 0;
  for (const t of tools) {
    if (!t.id || !t.name) continue;

    // Resolve the share image, priority order: author override (forced) → committed
    // generated card → generic og.png. `sized` is true only when the image is 1200×630.
    const override = authorOgImage(t.id);
    let image: string;
    let sized: boolean;
    if (override) {
      image = override;            // author forces their own art; skip the default render
      sized = false;
      overrides++;
    } else {
      // Refresh the committed card when resvg is available (local build:web / dev:web).
      if (renderer && Resvg) {
        try {
          const preview = previewDataUri(t.preview, Resvg, previewFonts);
          if (preview) withPreview++;
          const png = renderer.render({ name: t.name, description: t.description, iconSvg: t.icon, previewDataUri: preview });
          writeFileSync(resolve(OG_DIR, `${t.id}.png`), png);
          cards++;
        } catch (e) {
          const message = e instanceof Error ? e.message : String(e);
          console.log(`tool-og: ${t.id} card failed (${message})`);
        }
      }
      // Point at the committed card if it exists (just rendered, or shipped in the
      // repo on a resvg-less Vercel build); otherwise the generic card.
      if (existsSync(resolve(OG_DIR, `${t.id}.png`))) {
        image = `${SITE_URL}/catalog/og/${t.id}.png`;
        sized = true;
      } else {
        image = FALLBACK_IMG;
        sized = true;
      }
    }

    writeFileSync(resolve(STUB_DIR, `${t.id}.html`), stubHtml({ id: t.id, name: t.name, description: t.description, image, sized }));
    stubs++;
  }

  const total = tools.filter((t) => t.id && t.name).length;
  console.log(`✓ tool-og: ${stubs} stub${stubs === 1 ? '' : 's'}, ${cards} card${cards === 1 ? '' : 's'} refreshed (${withPreview} with preview, ${overrides} author override${overrides === 1 ? '' : 's'}); ${total - overrides} tools point at committed cards`);
  if (!renderer) console.log('tool-og: resvg unavailable — kept committed catalog/og cards (regenerate locally with build:web/dev:web).');
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
