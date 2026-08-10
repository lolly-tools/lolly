// SPDX-License-Identifier: MPL-2.0
/**
 * Bundle-budget regression guard for the web shell boot path.
 *
 * WHY THIS EXISTS
 * A large front-end perf effort (see plans/archive/ui-perf-audit.md) moved the heavy
 * render/validation libraries (engine render path, handlebars, ajv, html2canvas)
 * OFF the initial boot path — they now load lazily only when a tool actually
 * renders. That win is *silent to lose*: a single careless top-level
 * `import { createRuntime }` in an entry/preloaded module re-drags ~85 KB gz of
 * engine + handlebars + ajv back onto the critical path, and nothing would fail.
 *
 * This script re-derives the boot payload straight from the built
 * `dist/index.html` (the entry <script> + every <link rel="modulepreload">) and
 * asserts two things:
 *   1. None of the deliberately-lazied heavy chunks appear on the boot path.
 *   2. The total GZIPPED size of the boot JS stays under a budget.
 *
 * It is a STANDALONE check — intentionally NOT wired into `build:web`. Run it in
 * CI or by hand (`npm run check:bundle`) AFTER a production build exists.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDir = path.join(root, 'shells/web/dist');
const indexHtml = path.join(distDir, 'index.html');

// --- Budget knobs (tune here) ------------------------------------------------
// Filenames matching this pattern MUST NOT be preloaded/entry JS. These are the
// heavy libs deliberately pushed off the boot path by the perf effort; seeing
// one on the boot path means a static import pulled it back in.
// `engine-c2pa` is anchored (the `-` suffix) so it matches the c2pa/verify/CBOR
// chunk but NOT the tiny `engine-x509` chunk that legitimately boots (pemToDer).
const FORBIDDEN_BOOT_CHUNK = /(engine-render|engine-c2pa|handlebars|ajv|html2canvas)-/;
// Total gzipped size ceiling for entry + modulepreload JS. The 115 KB figure came
// from a ~95 KB post-perf baseline plus headroom. Raised to 135 KB on 2026-07-29
// after boot drifted to 200.8 KB and a dedicated pass took it back to 129.7:
// host.geom + host.color off the eager bridge (-37.1), the Tauri/first-run probes
// split out (-12.5), neuro-dock + music-player deferred (-9.3), lazy facades for
// net/text/pdf/pptx/capture/viz/identity (-6.0), the user-fonts boot slice (-5.6).
// What remains on boot is index, engine-util and bridge — all first-paint work, so
// the ceiling moved rather than the measurement. Do NOT raise this again to make a
// failing build pass; the point of the number is that a regression has to be argued.
// 2026-08-09: boot had drifted to 173.3 (an engine barrel re-dragged onto boot via
// org/index.ts, since fixed to a leaf import, plus accumulated feature weight). A diet
// took it back under WITHOUT moving the ceiling: gallery bulk-bar / context-menu /
// tile-select / confirm-dialog inject on their first gesture, the filter popover's
// sound toggle + the whole ambient-audio cluster (atmosphere/neurospicy/sound-toggle)
// defer together, drop-router / custom-slider / the user-fonts chain idle-defer, the
// Kokoro model-bytes constant reads from a leaf (engine/src/speech-model-bytes.ts) not
// the speech-text barrel, the view-topbar language menu lazy-loads its dropdown, and the
// sfx VOICES synthesis split into a lazy shells/web/src/lib/sfx-voices.ts. Landed 134.2.
// 2026-08-10: 140.9 on CI (the collab work landed on top of that 134.2 measurement).
// Back to 129.9, again without moving the ceiling, by restoring four lazy boundaries.
// The collab boot imports were NOT the offender — private-opener / collab-share-private /
// collab-mount / collab-launch / the live-mount install are ~7.8 KB of minified registry
// between them, with every heavy body (ceremony, RTC, beam, QR) already behind a dynamic
// import. What was actually on the critical path:
//   - engine/src/design-version.ts re-exported the two-line `sha256Hex` FROM
//     catalog-integrity.ts. design-version is first-paint work (bridge/assets.ts), so
//     that edge carried catalog-integrity + x509 + der-read along. sha256Hex now lives
//     in the engine/src/bytes.ts leaf; catalog-integrity re-exports it (unchanged barrel).
//   - bytes.ts then co-located INTO the engine-x509 chunk, which kept the cert parser on
//     boot anyway — the same trap the engine-util note above describes. It has its own
//     `engine-bytes` chunk group now (vite.config.js), ahead of engine-x509.
//   - shells/web/src/catalog/integrity.ts imported the verifier statically for a feature
//     that is INERT unless a build pins VITE_CATALOG_PUBLIC_KEY_JWK. Dynamic now.
//   - host.media + host.recorder were the last EAGER impls on the bridge (media.ts,
//     recorder.ts, video-mime.ts). Now lazy facades like capture/net/text/pdf, with the
//     synchronous isAvailable() answered from a shared probe leaf, bridge/capture-support.ts.
//   - lib/offline-manager.ts (the "Available offline" download manager) reached boot from
//     catalog/sync.ts and views/offline-nudge.ts; all three call sites were already async.
//   - bridge/capture-extension.ts's two-line "is the extension here?" probe split into
//     bridge/capture-extension-probe.ts, so the boot-time impl choice no longer pulls the
//     postMessage transport in behind it.
const MAX_PRELOAD_JS_GZ = 135 * 1024;
// -----------------------------------------------------------------------------

function fail(msg: string): never {
  console.error(`✗ bundle budget FAILED: ${msg}`);
  process.exit(1);
}

let html: string;
try {
  html = readFileSync(indexHtml, 'utf8');
} catch {
  fail(`cannot read ${path.relative(root, indexHtml)} — run \`npm run build:web\` first`);
}

// Collect boot JS: the entry <script type="module" src> and every
// <link rel="modulepreload" href>. Only same-origin /assets JS counts.
const bootHrefs = new Set<string>();
for (const m of html.matchAll(/<script[^>]*\bsrc=["']([^"']+)["']/gi)) {
  const src = m[1];
  if (src && /\.js(\?|$)/i.test(src)) bootHrefs.add(src);
}
for (const m of html.matchAll(/<link[^>]*\brel=["']modulepreload["'][^>]*>/gi)) {
  const href = m[0].match(/\bhref=["']([^"']+)["']/i)?.[1];
  if (href && /\.js(\?|$)/i.test(href)) bootHrefs.add(href);
}

if (bootHrefs.size === 0) {
  fail('found no entry/preload JS in index.html — did the HTML shape change?');
}

// Check for forbidden heavy chunks on the boot path.
const offenders = [...bootHrefs].filter((h) => FORBIDDEN_BOOT_CHUNK.test(path.basename(h)));
if (offenders.length > 0) {
  fail(
    `heavy chunk(s) back on the boot path (matched ${FORBIDDEN_BOOT_CHUNK}):\n  ` +
      offenders.map((o) => path.basename(o)).join('\n  ') +
      '\n  A static import likely re-dragged engine/handlebars/ajv/html2canvas onto boot.',
  );
}

// Sum gzipped bytes of every boot JS file.
let totalGz = 0;
const missing: string[] = [];
for (const href of bootHrefs) {
  const rel = href.replace(/^\//, '').split('?')[0] ?? href;
  const file = path.join(distDir, rel);
  try {
    totalGz += gzipSync(readFileSync(file)).length;
  } catch {
    missing.push(rel);
  }
}
if (missing.length > 0) {
  fail(`boot JS referenced by index.html is missing from dist:\n  ${missing.join('\n  ')}`);
}

const kb = (n: number) => (n / 1024).toFixed(1);
if (totalGz > MAX_PRELOAD_JS_GZ) {
  fail(
    `boot JS is ${kb(totalGz)} KB gz, over the ${kb(MAX_PRELOAD_JS_GZ)} KB budget ` +
      `(${bootHrefs.size} files). Something got heavier on the critical path.`,
  );
}

console.log(
  `✓ bundle budget OK (${kb(totalGz)} KB gz / ${kb(MAX_PRELOAD_JS_GZ)} KB budget; ` +
    `no heavy chunks preloaded)`,
);
