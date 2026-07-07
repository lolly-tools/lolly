#!/usr/bin/env node
/**
 * Animated HTML card generator.
 *
 * The third card format, alongside build-svg-card.ts (vector) and the committed APNG
 * cards. For tools whose canvas is HTML/CSS — <div> scenes driven by CSS @keyframes,
 * possibly via hooks (e.g. digi-ad) — the lightest animated gallery/picker preview is a
 * committed `tools/<id>/card.html`: the tool's own self-contained animated markup, a few
 * KB of CSS (not the ~2 MB an equivalent APNG would weigh), shown in a sandboxed <iframe>
 * that animates natively and pauses off-screen. The catalog index honours it as the
 * preview (build-catalog-index.ts) and the gallery/picker render `.html` previews in an
 * iframe. Run `npm run build:catalog` after.
 *
 * The HTML comes from the tool's REAL `html` export via the CLI shell (jsdom + engine +
 * hooks — deterministic, NO browser), so it's byte-faithful to the tool's own output. The
 * tool must declare `html` in render.formats. We wrap that node in a standalone document:
 * a SUSE @font-face (the iframe is a separate document and doesn't inherit the app's
 * fonts) + full-bleed sizing so the responsive (container-query) banner fills the frame.
 *
 *   node scripts/build-html-card.ts <toolId> [<toolId> ...]
 *   npm run cards:html digi-ad
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// The iframe document is separate from the app, so it must register the brand fonts
// itself (same-origin URLs — the card is served from /tools/<id>/). Mirrors
// shells/web/src/styles/fonts.css.
const FONT_FACES = `
@font-face{font-family:'SUSE';src:url('/catalog/fonts/webfonts/SUSE[wght].woff2') format('woff2-variations');font-weight:100 900;font-style:normal;font-display:swap}
@font-face{font-family:'SUSE';src:url('/catalog/fonts/webfonts/SUSE-Italic[wght].woff2') format('woff2-variations');font-weight:100 900;font-style:italic;font-display:swap}
@font-face{font-family:'SUSE Mono';src:url('/catalog/fonts/webfonts/SUSEMono[wght].woff2') format('woff2-variations');font-weight:100 900;font-style:normal;font-display:swap}`;

function buildCard(toolId: string): void {
  const dir = join(ROOT, 'tools', toolId);
  const manifest = JSON.parse(readFileSync(join(dir, 'tool.json'), 'utf8'));
  if (!(manifest.render?.formats ?? []).includes('html')) {
    throw new Error(`${toolId}: render.formats must include "html" (it's the export this lifts)`);
  }
  // The tool's real html export (canvas node + its inline <style>/@keyframes), rendered
  // through the engine + hooks by the CLI shell — no browser.
  const res = spawnSync('node', ['shells/cli/bin/lolly.ts', toolId, '--export=html'], {
    cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  if (res.status !== 0) throw new Error(`${toolId}: CLI html export failed — ${(res.stderr || '').split('\n')[0]}`);
  const body = res.stdout.trim();
  if (!body || !body.includes('<')) throw new Error(`${toolId}: CLI produced no HTML`);

  // Standalone document: fonts + full-bleed sizing. The rendered node (#canvas > tool
  // root) fills the frame; the tool's own container-query CSS scales the rest.
  const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="color-scheme" content="light dark">
<style>${FONT_FACES}
html,body{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:transparent}
body>*{width:100%;height:100%}
body>*>*{width:100%;height:100%}</style></head>
<body>${body}</body></html>`;

  const file = join(dir, 'card.html');
  writeFileSync(file, doc);
  console.log(`✓ ${toolId}: wrote tools/${toolId}/card.html (${(doc.length / 1024).toFixed(1)} KB)`);
}

const ids = process.argv.slice(2);
if (!ids.length) { console.error('usage: node scripts/build-html-card.ts <toolId> [...]'); process.exit(1); }
for (const id of ids) {
  if (!existsSync(join(ROOT, 'tools', id))) { console.error(`✗ ${id}: no such tool`); continue; }
  try { buildCard(id); } catch (e) { console.error(`✗ ${id}: ${(e as Error).message}`); }
}
