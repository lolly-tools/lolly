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
 * title, description and a 1200×630 share card (brand field + tool name + tool icon).
 * A human visitor's browser then runs the stub's inline redirect into the SPA at
 * /#/tool/<id> (carrying any shared ?params); crawlers ignore the script and read the
 * tags.
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

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createOgRenderer } from '../docs/og-image.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://lolly.tools';

const PUBLIC  = resolve(ROOT, 'shells/web/public');
// Flat files, NOT <id>/index.html: this deploy's catch-all rewrite (/(.*) →
// /index.html, no cleanUrls) serves ONLY exact static file paths — a directory or
// extensionless path falls through to the SPA shell (verified against the live
// site). So the stub is the exact file /t/<id>.html; vercel.json rewrites the clean
// /t/<id> share URL onto it. See the og: comment block at the top of this file.
const STUB_DIR = resolve(PUBLIC, 't');         // → /t/<id>.html        (exact static file)
const IMG_DIR  = resolve(PUBLIC, 'og/tools');  // → /og/tools/<id>.png  (alongside the static /og.png)
const FALLBACK_IMG = `${SITE_URL}/og.png`;
const FALLBACK_DESC = 'Generate on-brand assets from simple inputs. Works offline.';

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// id is a validated slug ([a-z0-9-]); safe to embed raw in JS strings / attributes.
function stubHtml({ id, name, description, image }) {
  const title = `${name} — Lolly`;
  const url   = `${SITE_URL}/t/${id}`;
  const desc  = description || FALLBACK_DESC;
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
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
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

async function main() {
  const index = JSON.parse(readFileSync(resolve(ROOT, 'catalog/tools/index.json'), 'utf8'));
  const tools = Array.isArray(index.tools) ? index.tools : [];

  // Renderer is best-effort: a missing build-time resvg degrades stubs to og.png
  // rather than failing the whole web build (mirrors docs/og-image.js).
  let renderer = null;
  try {
    const { Resvg } = await import('@resvg/resvg-js');
    renderer = createOgRenderer(Resvg, ROOT);
  } catch (e) {
    console.log(`tool-og: card generation skipped (${e.message}); stubs fall back to og.png`);
  }

  // Rebuild from scratch so a removed/renamed tool leaves no stale stub or card.
  rmSync(STUB_DIR, { recursive: true, force: true });
  rmSync(IMG_DIR,  { recursive: true, force: true });
  mkdirSync(STUB_DIR, { recursive: true });
  if (renderer) mkdirSync(IMG_DIR, { recursive: true });

  let cards = 0, stubs = 0;
  for (const t of tools) {
    if (!t.id || !t.name) continue;

    let image = FALLBACK_IMG;
    if (renderer) {
      try {
        writeFileSync(resolve(IMG_DIR, `${t.id}.png`), renderer.render(t.name, { iconSvg: t.icon }));
        image = `${SITE_URL}/og/tools/${t.id}.png`;
        cards++;
      } catch (e) {
        console.log(`tool-og: ${t.id} card failed (${e.message}); falls back to og.png`);
      }
    }

    writeFileSync(resolve(STUB_DIR, `${t.id}.html`), stubHtml({ id: t.id, name: t.name, description: t.description, image }));
    stubs++;
  }

  console.log(`✓ tool-og: ${stubs} stub${stubs === 1 ? '' : 's'}, ${cards} card${cards === 1 ? '' : 's'}`);
}

main().catch(e => { console.error(e); process.exit(1); });
