// SPDX-License-Identifier: MPL-2.0
/**
 * The landing fragment contract (plans/123): the /info front door renders inside the app
 * at #/docs/index, through the same fragment rehost every other docs page uses.
 *
 * Two halves have to agree, and they live in different repos - docs/build.ts writes the
 * built pages (a submodule), shells/web reads them - so nothing but a test can hold them
 * together:
 *
 *  1. THE MARKER. Every built index.html wraps its body in `<main class="docs-landing
 *     page-index">`. It is deliberately not a `.docs-content` (that class carries article
 *     typography which would out-specify the landing's band rules), so the reader's
 *     extractor accepts both, and a build that dropped the wrapper would leave
 *     #/docs/index showing "could not be displayed" in all 27 locales.
 *  2. THE NEUTRALIZER. styles/parts/docs-landing.css - the ONE band stylesheet build.ts
 *     inlines and the reader injects - hides every band with `.reveal{opacity:0}` until a
 *     page script adds `.visible`. The reader strips fetched scripts by design, so
 *     lib/docs-landing.ts ships an override. If the `.reveal` rule ever leaves that file
 *     the override becomes dead weight; while it is there, the override is mandatory.
 *
 * Pure file reads, no build step: this runs in `npm test` against the committed output.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INFO = join(ROOT, 'shells/web/public/info');
const WEB_SRC = join(ROOT, 'shells/web/src');

const MARKER = '<main class="docs-landing page-index"';

/** The built English page plus every locale directory that carries an index.html. */
function landingPages(): string[] {
  const out = [join(INFO, 'index.html')];
  for (const name of readdirSync(INFO, { withFileTypes: true })) {
    if (!name.isDirectory()) continue;
    const p = join(INFO, name.name, 'index.html');
    if (existsSync(p)) out.push(p);
  }
  return out;
}

test('every built /info landing wraps its body in the .docs-landing fragment marker', () => {
  const pages = landingPages();
  // Non-vacuity: 27 locales ship today (English unprefixed + 26 directories).
  assert.ok(pages.length >= 20, `only ${pages.length} landing pages found under ${INFO}`);
  assert.ok(
    pages.some((p) => p.endsWith('/de/index.html')),
    'the German landing is built (a locale sweep that silently found only English proves nothing)',
  );

  const missing = pages
    .filter((p) => !readFileSync(p, 'utf8').includes(MARKER))
    .map((p) => p.slice(INFO.length + 1));
  assert.deepEqual(missing, [], `landing pages with no ${MARKER}> wrapper: ${missing.join(', ')}`);
});

test('the reader extracts .docs-landing beside .docs-content', () => {
  const view = readFileSync(join(WEB_SRC, 'views/docs.ts'), 'utf8');
  assert.ok(
    view.includes(`querySelector('.docs-content, .docs-landing')`),
    'views/docs.ts must accept both fragment markers',
  );
  assert.ok(
    !/slug === 'index' \? 'quickstart'/.test(view),
    'the #/docs/index -> quickstart alias is gone: the landing rehosts for real now',
  );
});

test('the shared landing stylesheet still hides bands until .visible, so the override stays', () => {
  const css = readFileSync(join(WEB_SRC, 'styles/parts/docs-landing.css'), 'utf8');
  assert.ok(css.includes('.reveal{'), 'docs-landing.css declares the scroll-reveal start state');
  assert.ok(
    /\.reveal\{opacity:0/.test(css),
    'the reveal start state is still opacity:0 (what the in-app neutralizer exists to undo)',
  );

  const mod = readFileSync(join(WEB_SRC, 'lib/docs-landing.ts'), 'utf8');
  assert.ok(mod.includes('@scope (.docs-landing)'), 'the band CSS is injected scoped, never loose in the shell');
  assert.ok(
    /\.docs-reader--landing \.reveal/.test(mod),
    'the in-app reveal neutralizer is present (without it every band mounts invisible)',
  );
});

test('the audience tabs are CSS-only: radio pairing in the stylesheet, radios in the build', () => {
  // The whole tab mechanism is stylesheet + markup (plan 123 D1 final form) - if either
  // half loses its side of the contract, the section silently shows one frozen card.
  const css = readFileSync(join(WEB_SRC, 'styles/parts/docs-landing.css'), 'utf8');
  assert.ok(
    /\.aud-radio:nth-of-type\(1\):checked ~ \.audience-panels > \.audience-card:nth-child\(1\)/.test(css),
    'the :checked pairing rules drive card visibility',
  );
  assert.ok(
    /\.aud-radio ~ \.audience-panels > \.audience-card\{display:none\}/.test(css),
    'the hide rule anchors on a preceding radio sibling (so the machines band is never gated)',
  );
  assert.ok(
    !/display:none/.test(css.match(/\.aud-radio\{[^}]*\}/)?.[0] ?? ''),
    'the radios stay focusable (visually hidden, never display:none) - they ARE the keyboard interface',
  );

  const landing = readFileSync(join(INFO, 'index.html'), 'utf8');
  assert.ok(landing.includes('<input class="aud-radio" type="radio" name="audience"'), 'the built landing ships the radio group');
  assert.ok(landing.includes('<label class="audience-tab" for="aud-'), 'each pill is a label for its radio');
  assert.ok(!landing.includes('activateBySlug'), 'no tab script ships on the landing');
});
