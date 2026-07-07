// SPDX-License-Identifier: MPL-2.0
/**
 * Bundle-budget regression guard for the web shell boot path.
 *
 * WHY THIS EXISTS
 * A large front-end perf effort (see plans/ui-perf-audit.md) moved the heavy
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
// Total gzipped size ceiling for entry + modulepreload JS. Measured baseline
// after the perf work is ~95 KB gz; a little headroom absorbs normal churn
// without letting a whole heavy chunk sneak back on.
const MAX_PRELOAD_JS_GZ = 115 * 1024;
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
