// SPDX-License-Identifier: MPL-2.0
/**
 * How /info PRESENTS a dark-theme twin - the docs-build half of the `dark=1` feature.
 *
 * Scope note, deliberately narrow: the CAPTURE side is already covered by
 * tests/docs-shots-variants.test.ts, which owns the recipe/baseline contract (the
 * param parses; a dark=1 recipe has its committed twin; a twin on disk is claimed by
 * a recipe; a pair is never byte-identical). Those checks are not repeated here - two
 * tests asserting one invariant drift apart and then argue with each other.
 *
 * What is left, and lives here, is everything that happens AFTER capture: whether the
 * page shows the right file, and whether the twin can be trusted like any other shot.
 *
 * Run directly: node --test tests/docs-dark-shots.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readShotProvenance } from '../docs/shot-provenance.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const SHOTS = join(ROOT, 'docs/shots');
const BUILD_TS = readFileSync(join(ROOT, 'docs/build.ts'), 'utf8');

const darkFiles = () => readdirSync(SHOTS).filter((f) => /\.dark\.(svg|png|jpg)$/.test(f));

test('a dark twin carries its own Content Credential', () => {
  // The two files are signed separately, and docs/build.ts gives each its own
  // credential line (shot-cred--alt) because one line describing both would be a claim
  // neither file backs. A twin with no readable manifest would therefore put an
  // uncredentialed screenshot in front of every dark-mode reader - the one class of
  // reader who never sees the credentialed original.
  const unsigned = darkFiles().filter((f) => {
    const p = readShotProvenance(join(SHOTS, f));
    return !p?.signer || !p.when;
  });
  assert.deepEqual(unsigned, [],
    'these dark baselines have no readable credential — re-capture them so the twin is signed too');
});

test('the light/dark swap holds with no JS and cannot be out-specified', () => {
  // Ungated on purpose: no .shots-motion, no media query. Which file is correct to show
  // is not an enhancement - a reader with JS disabled still has a theme, and the site's
  // dark mode is the [data-theme="dark"] attribute they toggled (unified with the web
  // shell, M1), so a prefers-color-scheme source would follow the OS and contradict them.
  const rules = [...BUILD_TS.matchAll(/^([^{\n]*shot--dual[^{\n]*)\{([^}]*)\}/gm)];
  assert.ok(rules.length >= 4, `expected the .shot--dual swap rules, found ${rules.length}`);
  for (const [, sel] of rules) {
    assert.doesNotMatch(sel!, /\.shots-motion|@media/,
      `"${sel!.trim()}" gates the theme swap behind the motion class or a media query — `
      + 'with JS off, or on an OS whose preference disagrees with the toggle, the wrong file shows');
  }
  // Each img rule must name the ELEMENT as well as the class: the base `.docs-content img`
  // rule sets display:block at (0,1,1), so a bare `.shot-alt` (0,1,0) loses and BOTH
  // twins render, one stacked under the other.
  assert.match(BUILD_TS, /\.shot--dual>img\.shot-alt,[^{]*\{display:none\}/,
    'the light-mode rule must hide the twin via an element-qualified selector');
  assert.match(BUILD_TS, /\[data-theme="dark"\] \.shot--dual>img\.shot-alt\{display:block\}/,
    'the dark-mode rule must out-specify the light one it overrides');
  // And the credential line has to follow the image it describes, or a dark-mode reader
  // reads the LIGHT file's signature under the dark picture.
  assert.match(BUILD_TS, /\[data-theme="dark"\] \.shot--dual \.shot-cred--alt\{display:flex\}/);
  assert.match(BUILD_TS, /\[data-theme="dark"\] \.shot--dual[^{]*\.shot-cred:not\(\.shot-cred--alt\)\{display:none\}/);
});

test('the theme-blind token read that eight shots depend on is still theme-blind', () => {
  // WHY THIS EXISTS. Eight recipes deliberately have no dark=1, because their frame is
  // entirely tool paint and a dark capture would come out pixel-identical. For four of
  // them that is true only because of one unobvious detail: engine/src/runtime.ts
  // resolves a colour input's token ref with `host.tokens.get()` and NO theme argument,
  // so createTokenSet falls to the brand doc's first $theme (light) whatever the app is
  // wearing. The tool therefore paints light hexes into a dark-mode capture.
  //
  // Nothing else pins that, and there is a live counter-precedent in the same repo:
  // shells/web/src/lib/brand-editor.ts passes { theme } explicitly. Wire a theme into
  // the runtime path and those four shots silently start differing between themes,
  // while /info goes on showing the light one to dark-mode readers - the original bug,
  // reintroduced with no test failing.
  //
  // NOTE the byte-identical guard in docs-shots-variants.test.ts cannot catch this: the
  // walker stamps the app's inherited text colour into the file as `color="rgb(...)"`
  // even when no pixel uses it, so a re-theme would make the pair byte-DIFFERENT while
  // still pixel-identical. Byte-equality proves waste; it does not prove invariance.
  const runtime = readFileSync(join(ROOT, 'engine/src/runtime.ts'), 'utf8');
  const call = /host\.tokens\.get\(([^)]*)\)/.exec(runtime);
  assert.ok(call, 'engine/src/runtime.ts no longer calls host.tokens.get() — re-check the shots below');
  assert.equal(call[1]!.trim(), '',
    'runtime.ts now passes an argument to host.tokens.get(), so a tool\'s token-defaulted paint '
    + 'follows the app theme. Any docs shot that is pure token-coloured tool output is no longer '
    + 'theme-invariant and needs a dark twin: add dark=1 to its recipe and re-run `loldev shots`. '
    + 'The shots that were exempted on this basis are auth-url-render, use-mesh-output and '
    + 'exp-url-dims (plus ov2-street-map-poster, which is exempt via a hard-coded tool '
    + 'stylesheet background rather than this read).');
});
