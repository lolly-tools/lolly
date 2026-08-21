#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Per-view Open Graph (social share) generator - the app's own sections.
 *
 * Run as part of `build:web` (after build-tool-og, before the vite build), or directly:
 *   node scripts/build-view-og.ts
 *
 * Companion to scripts/build-tool-og.ts. Where that script gives every *tool* its own
 * share card, this one covers Lolly's top-level *views* - Dashboard (/d), Verify (/v),
 * Catalogue (/c), Projects (/p) and Profile (/profile). Same root cause: the web shell
 * routes these by URL *fragment* (#/d, #/verify, …), which social crawlers (Slack, X,
 * LinkedIn, iMessage, Facebook, Discord) never send to the server and never execute JS
 * for - so a shared /d link only ever previewed as the one generic og.png.
 *
 * Fix (identical mechanism to build-tool-og.ts): for each view we emit a crawler-visible
 * landing stub - the exact static file shells/web/public/view/<slug>.html - whose <head>
 * carries that view's own title, description and 1200×630 share image (og:url/canonical =
 * the clean path, e.g. https://lolly.tools/d). A human visitor's browser then runs the
 * stub's inline redirect into the SPA at the view's hash route (#/d, carrying any
 * ?params); crawlers ignore the script and read the tags. vercel.json rewrites the clean
 * path onto the stub (/d → /view/d.html), placed before the SPA catch-all.
 *
 * Card art is a dark "brand-system" panel (docs/og-image.ts → createViewCardRenderer):
 * pine field, a green app-icon tile, the view title + one-line description, a large
 * translucent watermark of the same icon - cohesive as a family, distinct from the light
 * tool gallery-tile cards. Rendering goes through OUR OWN render path (Chromium via
 * Playwright - scripts/lib/rasterize-svg-browser.ts), not resvg, so a card is shaped the
 * way the app paints and can't drift. The browser isn't on the Vercel build, so - exactly
 * like the tool cards and catalog/previews - the PNGs are COMMITTED at
 * catalog/og/views/<slug>.png (served /catalog/og/views/<slug>.png). build:web / dev:web
 * refresh them LOCALLY; a browser-less build leaves the committed bytes untouched and the
 * stubs still point at them. Stubs (HTML, no rasteriser) are git-ignored, rebuilt each run.
 */

import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createViewCardRenderer, loadBrandChrome } from '../docs/og-image.ts';
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
// tool cards + catalog/previews - so a git deploy ships them even though the render browser
// isn't installed on the Vercel build. Locally, build:web refreshes these; commit them.
const OG_DIR   = resolve(ROOT, 'catalog/og/views');  // → /catalog/og/views/<slug>.png (committed)
// Input-hash gate (see build-tool-og.ts for the full rationale): a card is re-rendered
// only when its render inputs change, so the non-deterministic render path (Playwright +
// Imprint/C2PA stamp) stops churning identical-looking PNGs every push. We persist, per
// view slug, a sha256 over the card's render inputs plus OG_RENDER_VERSION in a COMMITTED
// sidecar (OG_DIR/.og-sigs.json); a card whose sig matches AND whose file exists is
// skipped. BUMP OG_RENDER_VERSION after any card template / stamp change.
const OG_RENDER_VERSION = 1;
const SIGS_FILE = resolve(OG_DIR, '.og-sigs.json');
const sha256 = (s: string): string => createHash('sha256').update(s).digest('hex');
// --preserve (or LOLLY_PRESERVE=1): keep an already-committed card, skip its re-render.
const PRESERVE = process.argv.includes('--preserve') || process.env.LOLLY_PRESERVE === '1';

const esc = (s: unknown): string => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Every shareable top-level view. `slug` is the clean share path (/d, /v, /tools, …) AND
// the stub filename; `hash` is the SPA route a human is bounced to (the canonical in-app
// form - #/verify, not the /v shortlink); `aliases` are extra clean paths that serve the
// same stub (so /u previews like /utilities). Icons are lucide-style 24×24 stroke marks,
// matching the ones the views themselves use in-app (icons.ts / view-toggle.ts).
//
// Two routes deliberately get NO card: #/multi is meaningless without its ?s= selection,
// and #/components is a developer surface nobody shares. Both still resolve in-app; they
// just preview as the generic og.png.
//
// EVERY slug and alias needs a rewrite in vercel.json (clean path → /view/<slug>.html),
// or the path falls through to the SPA shell and previews as the generic og.png. Adding a
// row here without that rule is the one way to half-ship a view card.
interface View {
  slug: string;
  title: string;
  description: string;
  hash: string;
  icon: string;
  aliases?: string[];
}

// One <svg> wrapper for every mark, so a row carries only its path data.
const mark = (paths: string): string =>
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
  + ` stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

// Descriptions are kept to ~2 lines of the card's type column (about 85 characters);
// longer copy is ellipsised by the renderer's wrap, which reads as a truncation bug in
// a social preview rather than as a caption.
const VIEWS: View[] = [
  {
    slug: 'tools',
    title: 'Tools',
    description: 'Every Lolly tool in one gallery. Pick one, fill it in, export what you need.',
    hash: '#/',
    // wrench - the in-app Tools tab (components/view-toggle.ts)
    icon: mark('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>'),
  },
  {
    slug: 'utilities',
    title: 'Utilities',
    description: 'Strip hidden data, compress a PDF, convert an image. All on your own device.',
    hash: '#/u',
    aliases: ['u'],
    // hammer - the in-app Utilities tab
    icon: mark('<path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9"/><path d="m18 15 4-4"/><path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5"/>'),
  },
  {
    slug: 'p',
    title: 'Projects',
    description: 'Your saved sessions and exports, in folders. Private to you, and offline.',
    hash: '#/p',
    icon: mark('<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>'),
  },
  {
    slug: 'c',
    title: 'Catalogue',
    description: 'Every brand asset and every upload of yours, in one searchable library.',
    // No /catalog alias: the catalog's own static assets are served under /catalog/*,
    // and a rewrite next door to that path is not worth the ambiguity. /c is canonical.
    hash: '#/c',
    icon: mark('<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>'),
  },
  {
    slug: 'd',
    title: 'Dashboard',
    description: 'This device, the brand system and everything Lolly can do, in one panel.',
    hash: '#/d',
    icon: mark('<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>'),
  },
  {
    slug: 'v',
    title: 'Verify',
    description: 'Check any file for Content Credentials, on device, in your own browser.',
    hash: '#/verify',
    aliases: ['verify', 'valid'],
    icon: mark('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
  },
  {
    slug: 'start',
    title: 'Brand setup',
    description: 'Import your tokens, fonts and logos, then every tool follows them.',
    hash: '#/start',
    // palette - the brand editor's own mark (lib/icons.ts)
    icon: mark('<circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/>'),
  },
  {
    slug: 'lab',
    title: 'Colour Lab',
    description: 'Inspect any colour in OKLCH, check contrast, see what survives print.',
    hash: '#/lab',
    // flask - lib/icons.ts
    icon: mark('<path d="M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"/><path d="M6.453 15h11.094"/><path d="M8.5 2h7"/>'),
  },
  {
    slug: 'pro',
    title: 'Batch mode',
    description: 'Hundreds of assets from one spreadsheet, a row at a time.',
    hash: '#/pro',
    // checklist - lib/icons.ts
    icon: mark('<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3 6 1.3 1.3L6.5 5"/><path d="m3 12 1.3 1.3 2.2-2.3"/><path d="m3 18 1.3 1.3 2.2-2.3"/>'),
  },
  {
    slug: 'pdf',
    title: 'Take a PDF apart',
    description: 'Pull the text, images and vectors out of any PDF, on your device.',
    hash: '#/pdf',
    // document - lib/icons.ts
    icon: mark('<path d="M14 3v5h5"/><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>'),
  },
  {
    slug: 'profile',
    title: 'Profile',
    description: 'Your details and preferences, the constraints that keep assets on brand.',
    hash: '#/profile',
    icon: mark('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  },
];

// slug is a fixed literal ([a-z]); safe to embed raw in JS strings / attributes.
function stubHtml({ slug, title, description, hash, image }:
  View & { image: string }): string {
  const pageTitle = `${title} - Lolly`;
  const url = `${SITE_URL}/${slug}`;
  // Redirect target is ROOT-anchored ('/#/verify', not the bare fragment '#/verify').
  // The stub is served AT the clean path (e.g. the browser URL stays /v via the Vercel
  // rewrite), so a bare-fragment location.replace('#/verify') resolves to /v#/verify - 
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
<meta property="og:image:alt" content="${esc(title)} - a Lolly view" />
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
    console.log('view-og: on Vercel - using committed cards, skipping browser rasterisation');
  } else {
    try {
      rasterizer = await createSvgRasterizer(ROOT);
      // Same active-profile chrome as the tool cards (see docs/og-image.ts).
      renderer = createViewCardRenderer(rasterizer.rasterize, loadBrandChrome(ROOT));
    } catch (e) {
      console.log(`view-og: card generation skipped (${(e as Error).message}); stubs point at committed cards`);
    }
  }

  // Stubs (HTML, no browser needed) are git-ignored and rebuilt from scratch each run.
  // Cards (catalog/og/views/<slug>.png) are COMMITTED and only (re)written when the
  // browser is available - never wiped - so a Vercel build keeps the committed cards
  // rather than deleting them.
  rmSync(STUB_DIR, { recursive: true, force: true });
  mkdirSync(STUB_DIR, { recursive: true });
  mkdirSync(OG_DIR, { recursive: true });

  // Load the committed input-hash manifest (slug → sig). Missing/corrupt → empty map, so a
  // first run (or a bumped OG_RENDER_VERSION) re-renders everything.
  let sigs: Record<string, string> = {};
  try {
    const parsed = JSON.parse(readFileSync(SIGS_FILE, 'utf8'));
    if (parsed && typeof parsed === 'object') sigs = parsed as Record<string, string>;
  } catch { /* no manifest yet - treat every card as stale */ }

  let cards = 0, stubs = 0;
  for (const v of VIEWS) {
    // Refresh the committed card when the browser is available (local build:web / dev:web).
    // With --preserve, keep an existing committed card and skip the re-render. Also skip
    // when the input-hash gate says the render inputs are unchanged AND the card exists.
    const cardPath = resolve(OG_DIR, `${v.slug}.png`);
    const sig = sha256(JSON.stringify([
      OG_RENDER_VERSION, v.title, v.description, v.icon, v.hash,
    ]));
    const gated = sigs[v.slug] === sig && existsSync(cardPath);
    if (renderer && !(PRESERVE && existsSync(cardPath)) && !gated) {
      try {
        const png = await renderer.render({ title: v.title, description: v.description, iconSvg: v.icon });
        // Stamp our own share card with the Lolly Imprint + "made with Lolly" C2PA
        // before committing (see scripts/lib/stamp-media.ts).
        const stamped = await stampBitmap(png, 'png', { id: v.slug, name: v.title });
        writeFileSync(cardPath, stamped);
        sigs[v.slug] = sig;
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

  // Persist the input-hash manifest (committed). Deterministic (sorted keys) so an
  // unchanged build leaves no diff. Prune slugs no longer in VIEWS, but only when a
  // renderer ran - a browser-less/Vercel build must not drop sigs for committed cards it
  // can't re-render.
  if (renderer) {
    const live = new Set(VIEWS.map(v => v.slug));
    for (const slug of Object.keys(sigs)) if (!live.has(slug)) delete sigs[slug];
  }
  const ordered: Record<string, string> = {};
  for (const slug of Object.keys(sigs).sort()) ordered[slug] = sigs[slug] as string;
  writeFileSync(SIGS_FILE, `${JSON.stringify(ordered, null, 2)}\n`);

  console.log(`✓ view-og: ${stubs} stub${stubs === 1 ? '' : 's'}, ${cards} card${cards === 1 ? '' : 's'} refreshed`);
  if (!renderer && !process.env.VERCEL) console.log('view-og: browser unavailable - kept committed catalog/og/views cards (regenerate locally with build:web/dev:web).');
}

main().catch(e => { console.error(e); process.exit(1); });
