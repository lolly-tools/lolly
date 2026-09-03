// SPDX-License-Identifier: MPL-2.0
/**
 * Dist-size budget guard for the built /info docs (plan 131 B.4).
 *
 * WHY THIS EXISTS
 * Every locale ships in the binary - no second-class languages (plan 131 B.4). That
 * is affordable only because the chrome does NOT multiply per page: the shared CSS/JS
 * ships once (B.1), and screenshots are one English set (B.2). Both wins are silent to
 * lose. A single localized-shot recipe, or the shared stylesheet drifting back inline,
 * re-multiplies megabytes across ~4,300 pages and nothing would fail - the docs just
 * quietly regrow the app binary.
 *
 * This measures the built /info tree (raw + summed per-file gzip - the honest per-asset
 * transfer/embed cost) and fails if the gzip total crosses a ceiling. Run it in CI
 * AFTER `npm run build:info`, or by hand (`npm run check:docs-size`). Standalone, like
 * scripts/check-bundle-budget.ts.
 *
 * WHAT THE CEILING IS, AND ISN'T
 * The ceiling ratifies the CURRENT measured size plus headroom - it stops regressions,
 * it does not certify the size is small. As of 2026-08-22 /info is ~142 MB gz, still
 * dominated by ~63 KB/page of INLINE SVG (mascots + nav chrome) that B.1 deliberately
 * left inline (a `<use>`/`<img>` cut interacts with currentColor theming - flagged as
 * the B.5 follow-up spike). When that inline SVG is externalized, LOWER this ceiling to
 * match - the number is only useful if a real win is made to move it, never raised to
 * make a failing build pass. Override for a one-off with LOLLY_DOCS_MAX_GZ_MB.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const infoDir = path.join(root, 'shells/web/public/info');

// Gzip ceiling for the whole /info tree. 161 MB = the ~142 MB measured on 2026-08-22
// (post-B.1/B.2) plus ~13% headroom for content growth, plus the three lane mascots
// priced on 2026-09-03 (lorikeet, kookaburra-lolly, bandicoot: 424 KB of webp that gzip
// cannot shrink; 160.3 MB measured with them in). 162.5 MB from 2026-09-03 (later):
// the landing's Cover Flow went from 6 covers to 16 posed 4:3 covers plus three
// ~6 s loops (docs/shots/covers, 1.5 MB of webp/webm, again incompressible; 161.3 MB
// measured with them in). 163.5 MB the same evening for the docs accuracy pass:
// six recipe shots in light and dark for the export panels and the timeline strip,
// the SCORM format page and its locale twins (162.3 MB measured with them in). 170.5 MB
// from 2026-09-03 (night): three covers became the tools' OWN 60 fps H.264 exports
// (backdrop 1.9 MB, gradient 2.2 MB, audiogram 3.6 MB - MilkDrop and film grain do not
// compress; 169.4 MB measured with them in, the two recordings they replaced were
// 0.2 MB). NOT a target - see the header.
const MAX_INFO_GZ = (Number(process.env.LOLLY_DOCS_MAX_GZ_MB) || 170.5) * 1024 * 1024;

function fail(msg: string): never {
  console.error(`✗ docs size budget FAILED: ${msg}`);
  process.exit(1);
}

if (!existsSync(infoDir)) {
  fail(`no built /info at ${path.relative(root, infoDir)} - run \`npm run build:info\` first`);
}

let rawTotal = 0;
let gzTotal = 0;
let files = 0;
const walk = (dir: string): void => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { walk(full); continue; }
    if (!entry.isFile()) continue;
    const bytes = readFileSync(full);
    rawTotal += statSync(full).size;
    gzTotal += gzipSync(bytes).length;
    files++;
  }
};
walk(infoDir);

const mb = (n: number) => (n / 1024 / 1024).toFixed(1);

if (files === 0) fail('/info is empty - did the build write nothing?');

if (gzTotal > MAX_INFO_GZ) {
  fail(
    `/info is ${mb(gzTotal)} MB gz (${mb(rawTotal)} MB raw, ${files} files), over the ` +
      `${mb(MAX_INFO_GZ)} MB gz budget. A shot went localized (B.2), the shared chrome ` +
      `drifted back inline (B.1), or a locale wave was added without pricing - check the diff.`,
  );
}

console.log(
  `✓ docs size budget OK (${mb(gzTotal)} MB gz / ${mb(MAX_INFO_GZ)} MB budget; ` +
    `${mb(rawTotal)} MB raw across ${files} files)`,
);
