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
 * AFTER `pnpm run build:info`, or by hand (`pnpm run check:docs-size`). Standalone, like
 * scripts/check-bundle-budget.ts.
 *
 * WHAT THE CEILING IS, AND ISN'T
 * The ceiling ratifies the CURRENT measured size plus headroom - it stops regressions,
 * it does not certify the size is small. On 2026-10-06, withdrawing Listen reduced
 * the measured build from 177.7 MiB gzip to 153.8 MiB. The 180 MiB ceiling leaves
 * about 17% for ordinary content growth while retaining a meaningful guard against
 * duplicated localized media and inline chrome. Lower it after structural savings;
 * review measured growth before changing it. Override with LOLLY_DOCS_MAX_GZ_MB.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const infoDir = path.join(root, 'shells/web/public/info');

// 180 MiB: measured 153.8 MiB plus content-growth room after Listen withdrawal.
// This is a ceiling, not a size target.
const MAX_INFO_GZ = (Number(process.env.LOLLY_DOCS_MAX_GZ_MB) || 180.0) * 1024 * 1024;

function fail(msg: string): never {
  console.error(`✗ docs size budget FAILED: ${msg}`);
  process.exit(1);
}

if (!existsSync(infoDir)) {
  fail(`no built /info at ${path.relative(root, infoDir)} - run \`pnpm run build:info\` first`);
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
