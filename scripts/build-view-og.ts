#!/usr/bin/env node
/**
 * Per-view Open Graph (social share) generator — the app's own sections.
 *
 * Run as part of `build:web` (after build-tool-og, before the vite build), or directly:
 *   node scripts/build-view-og.ts
 *
 * Companion to scripts/build-tool-og.ts. Where that script gives every *tool* its own
 * share card, this one covers Lolly's top-level *views* — Dashboard (/d), Verify (/v),
 * Catalogue (/c), Projects (/p) and Profile (/profile). Same root cause: the web shell
 * routes these by URL *fragment* (#/d, #/verify, …), which social crawlers (Slack, X,
 * LinkedIn, iMessage, Facebook, Discord) never send to the server and never execute JS
 * for — so a shared /d link only ever previewed as the one generic og.png.
 *
 * Fix (identical mechanism to build-tool-og.ts): for each view we emit a crawler-visible
 * landing stub — the exact static file shells/web/public/view/<slug>.html — whose <head>
 * carries that view's own title, description and 1200×630 share image (og:url/canonical =
 * the clean path, e.g. https://lolly.tools/d). A human visitor's browser then runs the
 * stub's inline redirect into the SPA at the view's hash route (#/d, carrying any
 * ?params); crawlers ignore the script and read the tags. vercel.json rewrites the clean
 * path onto the stub (/d → /view/d.html), placed before the SPA catch-all.
 *
 * Card art is a dark "brand-system" panel (docs/og-image.ts → createViewCardRenderer):
 * pine field, a green app-icon tile, the view title + one-line description, a large
 * translucent watermark of the same icon — cohesive as a family, distinct from the light
 * tool gallery-tile cards. Rendering goes through OUR OWN render path (Chromium via
 * Playwright — scripts/lib/rasterize-svg-browser.ts), not resvg, so a card is shaped the
 * way the app paints and can't drift. The browser isn't on the Vercel build, so — exactly
 * like the tool cards and catalog/previews — the PNGs are COMMITTED at
 * catalog/og/views/<slug>.png (served /catalog/og/views/<slug>.png). build:web / dev:web
 * refresh them LOCALLY; a browser-less build leaves the committed bytes untouched and the
 * stubs still point at them. Stubs (HTML, no rasteriser) are git-ignored, rebuilt each run.
 */

import { writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createViewCardRenderer } from '../docs/og-image.ts';
import { createSvgRasterizer, type SvgRasterizer } from './lib/rasterize-svg-browser.ts';
import { stampBitmap } from './lib/stamp-media.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE_URL = 'https://lolly.tools';

const PUBLIC   = resolve(ROOT, 'shells/web/public');
// Flat stub files under public/view/, served /view/<slug>.html; vercel.json rewrites
// the clean share path (/d, /v, …) onto them (this deploy's catch-all serves ONLY
// exact static paths, so an extensionless /d would otherwise fall through to the SPA
// shell → generic OG). See build-tool-og.ts for the full serving rationale.
const STUB_DIR = resolve(PUBLIC, 'view');            // → /view/<slug>.html   (exact static file)
// Cards are COMMITTED here (served /catalog/og/views/<slug>.png), mirroring the committed
// tool cards + catalog/previews — so a git deploy ships them even though the render browser
// isn't installed on the Vercel build. Locally, build:web refreshes these; commit them.
const OG_DIR   = resolve(ROOT, 'catalog/og/views');  // → /catalog/og/views/<slug>.png (committed)
// --preserve (or LOLLY_PRESERVE=1): keep an already-committed card, skip its re-render.
const PRESERVE = process.argv.includes('--preserve') || process.env.LOLLY_PRESERVE === '1';

const esc = (s: unknown): string => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// The five top-level views. `slug` is the clean share path (/d, /v, …) AND the stub
// filename; `hash` is the SPA route a human is bounced to (the canonical in-app form —
// #/verify, not the /v shortlink). Icons are lucide-style 24×24 stroke marks, matching
// the ones the views themselves use in-app (gallery.ts / view-toggle.ts).
interface View {
  slug: string;
  title: string;
  description: string;
  hash: string;
  icon: string;
}

const VIEWS: View[] = [
  {
    slug: 'd',
    title: 'Dashboard',
    description: 'This device, the brand system and everything Lolly can do — one read-only instrument panel.',
    hash: '#/d',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/></svg>',
  },
  {
    slug: 'v',
    title: 'Verify',
    description: 'Check any file’s Content Credentials on-device — provenance you can trust, in your browser.',
    hash: '#/verify',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>',
  },
  {
    slug: 'c',
    title: 'Catalogue',
    description: 'Every brand asset — logos, icons, palettes and your own uploads — in one searchable library.',
    hash: '#/c',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>',
  },
  {
    slug: 'p',
    title: 'Projects',
    description: 'Your saved sessions and exports, organised into folders. Private to you, and works offline.',
    hash: '#/p',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/></svg>',
  },
  {
    slug: 'profile',
    title: 'Profile',
    description: 'Your details, identity and preferences — the constraints that keep every asset on-brand.',
    hash: '#/profile',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  },
];

// slug is a fixed literal ([a-z]); safe to embed raw in JS strings / attributes.
function stubHtml({ slug, title, description, hash, image }:
  View & { image: string }): string {
  const pageTitle = `${title} — Lolly`;
  const url = `${SITE_URL}/${slug}`;
  // Redirect target is ROOT-anchored ('/#/verify', not the bare fragment '#/verify').
  // The stub is served AT the clean path (e.g. the browser URL stays /v via the Vercel
  // rewrite), so a bare-fragment location.replace('#/verify') resolves to /v#/verify —
  // the PATH is unchanged, making it a same-document hash change that NEVER loads the SPA
  // (which lives in index.html), stranding the human on the stub. The leading '/' changes
  // the path to '/', forcing a real cross-document navigation to index.html so the app
  // boots and its router reads the hash. Mirrors build-tool-og.ts ('/#/tool/<id>').
  const redirect = `/${hash}`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(pageTitle)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${esc(url)}" />
<meta name="theme-color" content="#0c322c" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="Lolly" />
<meta property="og:title" content="${esc(pageTitle)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:url" content="${esc(url)}" />
<meta property="og:image" content="${esc(image)}" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta property="og:image:alt" content="${esc(title)} — a Lolly view" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(pageTitle)}" />
<meta name="twitter:description" content="${esc(description)}" />
<meta name="twitter:image" content="${esc(image)}" />
<link rel="icon" href="/favicon.ico" sizes="any" />
<script>
  // A human who followed a shared link lands here → boot the app at the view's route,
  // carrying any shared params. Crawlers don't run this; they just read the tags above.
  location.replace(${JSON.stringify(redirect)} + location.search);
</script>
</head>
<body>
<p style="font-family:system-ui,-apple-system,sans-serif;padding:2rem;color:#1c4a2e">
  Opening ${esc(title)} in Lolly… <a href="${esc(redirect)}">Continue</a>
</p>
</body>
</html>
`;
}

async function main(): Promise<void> {
  // Renderer is best-effort: a missing browser (or SUSE fonts) degrades cards to the
  // committed bytes (or, first time, none) rather than failing the whole web build.
  let renderer: ReturnType<typeof createViewCardRenderer> | null = null;
  let rasterizer: SvgRasterizer | null = null;
  // On Vercel, DON'T rasterise: cards are committed and ship via git (see header +
  // build-tool-og.ts), and the render browser isn't installed there. Refresh locally.
  if (process.env.VERCEL) {
    console.log('view-og: on Vercel — using committed cards, skipping browser rasterisation');
  } else {
    try {
      rasterizer = await createSvgRasterizer(ROOT);
      renderer = createViewCardRenderer(rasterizer.rasterize);
    } catch (e) {
      console.log(`view-og: card generation skipped (${(e as Error).message}); stubs point at committed cards`);
    }
  }

  // Stubs (HTML, no browser needed) are git-ignored and rebuilt from scratch each run.
  // Cards (catalog/og/views/<slug>.png) are COMMITTED and only (re)written when the
  // browser is available — never wiped — so a Vercel build keeps the committed cards
  // rather than deleting them.
  rmSync(STUB_DIR, { recursive: true, force: true });
  mkdirSync(STUB_DIR, { recursive: true });
  mkdirSync(OG_DIR, { recursive: true });

  let cards = 0, stubs = 0;
  for (const v of VIEWS) {
    // Refresh the committed card when the browser is available (local build:web / dev:web).
    // With --preserve, keep an existing committed card and skip the re-render.
    if (renderer && !(PRESERVE && existsSync(resolve(OG_DIR, `${v.slug}.png`)))) {
      try {
        const png = await renderer.render({ title: v.title, description: v.description, iconSvg: v.icon });
        // Stamp our own share card with the Lolly Imprint + "made with Lolly" C2PA
        // before committing (see scripts/lib/stamp-media.ts).
        const stamped = await stampBitmap(png, 'png', { id: v.slug, name: v.title });
        writeFileSync(resolve(OG_DIR, `${v.slug}.png`), stamped);
        cards++;
      } catch (e) {
        console.log(`view-og: ${v.slug} card failed (${(e as Error).message})`);
      }
    }
    // Point at the committed card if it exists (just rendered, or shipped in the repo on
    // a resvg-less Vercel build); otherwise the generic og.png so the stub is never broken.
    const image = existsSync(resolve(OG_DIR, `${v.slug}.png`))
      ? `${SITE_URL}/catalog/og/views/${v.slug}.png`
      : `${SITE_URL}/og.png`;

    writeFileSync(resolve(STUB_DIR, `${v.slug}.html`), stubHtml({ ...v, image }));
    stubs++;
  }

  await rasterizer?.close();

  console.log(`✓ view-og: ${stubs} stub${stubs === 1 ? '' : 's'}, ${cards} card${cards === 1 ? '' : 's'} refreshed`);
  if (!renderer && !process.env.VERCEL) console.log('view-og: browser unavailable — kept committed catalog/og/views cards (regenerate locally with build:web/dev:web).');
}

main().catch(e => { console.error(e); process.exit(1); });
