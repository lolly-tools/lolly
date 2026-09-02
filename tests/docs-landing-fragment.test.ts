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

test('every built /info landing wraps its body in the .docs-landing fragment marker', (t) => {
  // Reads the BUILT docs site; the built .html pages are gitignored, so runners
  // that never run build:info (CI) have nothing to check. Skip with a reason -
  // the ship gate and local runs, where the site is built, still enforce this.
  if (!existsSync(join(INFO, 'index.html'))) {
    t.skip('no built /info on disk (run npm run build:info) - enforced where the site is built');
    return;
  }
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

test('the persona device is CSS-only: radio pairing in the stylesheet, radios in the build', (t) => {
  // The device (top tabs + side tabs, plans/177) is stylesheet + markup, the same
  // contract the audience tabs held before it: if either half loses its side, the
  // section silently shows one frozen pane - and the in-app reader (which strips
  // scripts) would break invisibly.
  const css = readFileSync(join(WEB_SRC, 'styles/parts/docs-landing.css'), 'utf8');
  assert.ok(
    /#door-creators:checked ~ \.persona-panes \.persona-pane:nth-child\(1\)/.test(css),
    'the :checked pairing rules drive door-pane visibility',
  );
  assert.ok(
    /\.lane-radio:nth-of-type\(1\):checked ~ \.lane-cols \.lane-panes \.lane-pane:nth-child\(1\)/.test(css),
    'the :checked pairing rules drive lane-pane visibility',
  );
  assert.ok(
    !/display:none/.test(css.match(/\.persona-radio,\.lane-radio\{[^}]*\}/)?.[0] ?? 'display:none'),
    'the radios stay focusable (visually hidden, never display:none) - they ARE the keyboard interface',
  );

  // The markup half reads the BUILT landing - absent where /info was never built
  // (CI; the built .html is gitignored). The stylesheet asserts above already ran,
  // so a CSS regression still fails there before this skip is reached.
  if (!existsSync(join(INFO, 'index.html'))) {
    t.skip('no built /info on disk (run npm run build:info) - markup half enforced where the site is built');
    return;
  }
  const landing = readFileSync(join(INFO, 'index.html'), 'utf8');
  assert.ok(landing.includes('<input class="persona-radio" type="radio" name="persona-door"'), 'the built landing ships the door radio group');
  assert.ok(landing.includes('<input class="lane-radio" type="radio" name="lane-creators"'), 'each pane ships its lane radio group');
  assert.ok(landing.includes('<label class="persona-tab" for="door-'), 'each door tab is a label for its radio');
  assert.ok(landing.includes('<label class="lane-tab" for="lane-'), 'each side tab is a label for its radio');
});
