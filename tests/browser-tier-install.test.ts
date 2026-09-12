// SPDX-License-Identifier: MPL-2.0
/**
 * The browser tier installs the revision the browser tier looks for.
 *
 * Two packages are in play, on purpose. `lolly install-browser`
 * (shells/cli/src/install-browser.ts) downloads Chromium through the
 * `playwright-core` CLI, because that is the only playwright package the shipped
 * shells depend on - a plain `pnpm install` must never pull a browser. The
 * browser-tier TESTS and the capture scripts launch it through the full
 * `playwright`, which is a dev-only dependency.
 *
 * Each playwright release wants its OWN `chromium-<revision>` directory, and
 * `playwright@X` pins `playwright-core@X` exactly. So the moment the two drift a
 * minor apart, the installer writes one revision and every gate looks for another:
 * `chromium.executablePath()` points at a directory that does not exist, the
 * `existsSync` check in each browser-gated suite fails, and the whole tier reports
 * "no Chromium (pnpm exec playwright install chromium)" on a machine that has one.
 *
 * That is not hypothetical. Between 2026-09-08 and 2026-09-11 the CI browser shard
 * installed Chromium, cached it, pointed PLAYWRIGHT_BROWSERS_PATH at it, and still
 * skipped 149 tests: playwright-core sat at 1.62.1 (chromium-1234) while playwright
 * was at 1.63.0 (chromium-1243). The versions are held together by the
 * `playwright-core: '$playwright'` override in pnpm-workspace.yaml; this is the
 * assertion that says so out loud, so a lockfile change cannot quietly undo it and
 * leave a green-looking shard that tested nothing.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const version = (name: string): string => (require(`${name}/package.json`) as { version: string }).version;

test('playwright and playwright-core resolve to the same release', () => {
  const full = version('playwright');
  const core = version('playwright-core');
  assert.equal(core, full,
    `playwright ${full} expects playwright-core ${full}, but ${core} is installed. `
    + 'The installer drives playwright-core and the gates drive playwright, so a split '
    + 'here makes every browser-tier test skip. Check the playwright-core override in '
    + 'pnpm-workspace.yaml.');

  // The pin playwright itself declares, in case the tree ever hoists a second copy.
  const declared = (require('playwright/package.json') as { dependencies?: Record<string, string> })
    .dependencies?.['playwright-core'];
  assert.equal(declared, full, `playwright ${full} declares playwright-core ${declared}`);
});

test('the installer and the gates name the same chromium revision directory', () => {
  const before = process.env.PLAYWRIGHT_BROWSERS_PATH;
  process.env.PLAYWRIGHT_BROWSERS_PATH = '/nonexistent-browsers-root';
  try {
    // executablePath() is pure path arithmetic - it reports where the browser WOULD
    // live, with no check that it is there, which is exactly the number compared here.
    const revision = (name: string): string => {
      const { chromium } = require(name) as { chromium: { executablePath: () => string } };
      return /(chromium[^/\\]*-\d+)/.exec(chromium.executablePath())?.[1] ?? '';
    };
    const gate = revision('playwright');
    const installer = revision('playwright-core');
    assert.ok(gate, 'playwright reports no chromium revision directory');
    assert.equal(installer, gate,
      `the installer writes ${installer} and the browser gates look in ${gate}`);
  } finally {
    if (before === undefined) delete process.env.PLAYWRIGHT_BROWSERS_PATH;
    else process.env.PLAYWRIGHT_BROWSERS_PATH = before;
  }
});
