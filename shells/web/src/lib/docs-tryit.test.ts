// SPDX-License-Identifier: MPL-2.0
/**
 * Interactive "Try it" embeds for the in-app docs reader (lib/docs-tryit.ts).
 *
 * Run directly:  node --test shells/web/src/lib/docs-tryit.test.ts
 *
 * Two halves: the pure recovery helpers (slug/route classification/embed URL) - the logic
 * that decides WHICH shots light up and WHERE they point - and the DOM hydration over a
 * jsdom fragment shaped like the injected `.docs-content`, with a stubbed manifest fetch.
 *
 * The invariant under test is ADDITIVITY + CONTENT-GATING: only live-tool recipes gain the
 * affordance, view captures and unmatched shots are left byte-identical, and the static
 * baseline (<img> + below-shot text link) is never destroyed.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
// The module builds elements with insertAdjacentHTML(icon) - needs the jsdom realm's ctors.
globalThis.Element = dom.window.Element;
globalThis.HTMLElement = dom.window.HTMLElement;

const {
  shotSlug, toolRouteId, embedSrcFor, hydrateDocsTryIt, _resetManifestCache,
} = await import('./docs-tryit.ts');

// ── Pure helpers ──────────────────────────────────────────────────────────────

test('shotSlug strips path, extension, dark twin and locale - matching the recipe key', () => {
  assert.equal(shotSlug('/info/shots/exp-url-qr-color.svg'), 'exp-url-qr-color');
  assert.equal(shotSlug('/info/shots/exp-url-qr-color.dark.svg'), 'exp-url-qr-color');
  assert.equal(shotSlug('/info/shots/brand-studio.de.svg'), 'brand-studio');
  assert.equal(shotSlug('/info/shots/seq-onion-ghosts.png'), 'seq-onion-ghosts');
});

test('toolRouteId matches live-tool routes and rejects view captures', () => {
  assert.equal(toolRouteId('/#/tool/qr-code?url=https://suse.com&color=%230c322c'), 'qr-code');
  assert.equal(toolRouteId('#/tool/chart?ct=treemap&full'), 'chart');
  assert.equal(toolRouteId('/t/gradient?count=3'), 'gradient');
  // View captures - the content gate must reject every one.
  assert.equal(toolRouteId('/#/'), null);
  assert.equal(toolRouteId('/#/start'), null);
  assert.equal(toolRouteId('/#/u'), null);
  assert.equal(toolRouteId('/#/catalogue'), null);
});

test('embedSrcFor forces full-bleed and strips export/copy triggers, preserving encoding', () => {
  assert.equal(
    embedSrcFor('/#/tool/qr-code?url=https://suse.com&color=%230c322c'),
    '/#/tool/qr-code?url=https://suse.com&color=%230c322c&full',
  );
  // Already full → unchanged.
  assert.equal(embedSrcFor('/#/tool/chart?ct=treemap&full'), '/#/tool/chart?ct=treemap&full');
  // No query → gains ?full.
  assert.equal(embedSrcFor('/#/tool/gradient'), '/#/tool/gradient?full');
  // Export/copy/download triggers dropped so the embed never auto-downloads.
  assert.equal(
    embedSrcFor('/#/tool/qr-code?url=x&format=png&export&copy&filename=my-qr'),
    '/#/tool/qr-code?url=x&full',
  );
});

// ── DOM hydration ───────────────────────────────────────────────────────────────

/** A `.docs-content`-shaped fragment: one live-tool shot (with its static below-shot text
 *  link), one VIEW-capture shot, and one shot with NO recipe. */
function buildFragment(): HTMLElement {
  const root = document.createElement('article');
  root.className = 'docs-content';
  root.innerHTML = `
    <p><span class="shot shot--dual" data-shot="/info/shots/exp-url-qr-color.svg"
      ><img src="/info/shots/exp-url-qr-color.svg" width="600" height="600" alt="qr"></span
      ><a class="shot-try" href="/#/tool/qr-code?url=https://suse.com&amp;color=%230c322c">Try it in the app</a></p>
    <p><span class="shot" data-shot="/info/shots/gallery.svg"
      ><img src="/info/shots/gallery.svg" width="1200" height="800" alt="gallery"></span></p>
    <p><span class="shot" data-shot="/info/shots/no-recipe.svg"
      ><img src="/info/shots/no-recipe.svg" width="400" height="400" alt="none"></span></p>`;
  return root;
}

const MANIFEST = {
  recipes: {
    'exp-url-qr-color': { route: '/#/tool/qr-code?url=https://suse.com&color=%230c322c' },
    gallery: { route: '/#/' }, // a view capture - must NOT be enhanced
  },
};

function stubManifestFetch(): void {
  _resetManifestCache();
  globalThis.fetch = (async () => ({
    ok: true,
    json: async () => MANIFEST,
  })) as unknown as typeof fetch;
}

test('hydrate enhances only the live-tool shot, with a working navigate anchor + live button', async () => {
  stubManifestFetch();
  const root = buildFragment();
  document.body.appendChild(root);

  await hydrateDocsTryIt(root, { reducedMotion: false });

  const shots = root.querySelectorAll<HTMLElement>('.shot');
  const [toolShot, viewShot, noRecipeShot] = [shots[0]!, shots[1]!, shots[2]!];

  // Tool shot: overlay added, marked tryable.
  assert.ok(toolShot.classList.contains('shot--tryable'), 'tool shot marked tryable');
  const overlay = toolShot.querySelector('.shot-tryit');
  assert.ok(overlay, 'tool shot has the overlay');
  const open = overlay!.querySelector<HTMLAnchorElement>('a.shot-tryit-open');
  assert.ok(open, 'overlay has the navigate anchor');
  assert.equal(open!.getAttribute('href'), '/#/tool/qr-code?url=https://suse.com&color=%230c322c');
  const live = overlay!.querySelector<HTMLButtonElement>('button.shot-tryit-live');
  assert.ok(live, 'overlay has the live-embed button (motion allowed)');
  assert.equal(live!.getAttribute('aria-pressed'), 'false');

  // The static below-shot text link is superseded (hidden), not destroyed.
  const textLink = root.querySelector('.shot-try');
  assert.ok(textLink, 'static text link still in the DOM');
  assert.ok(textLink!.classList.contains('shot-try--superseded'), 'static text link superseded');

  // The static <img> baseline is never removed.
  assert.ok(toolShot.querySelector('img[src="/info/shots/exp-url-qr-color.svg"]'), 'static img retained');

  // View capture and no-recipe shots are byte-identical - no overlay, no class.
  assert.equal(viewShot.querySelector('.shot-tryit'), null, 'view shot not enhanced');
  assert.ok(!viewShot.classList.contains('shot--tryable'));
  assert.equal(noRecipeShot.querySelector('.shot-tryit'), null, 'no-recipe shot not enhanced');

  root.remove();
});

test('clicking the live button mounts/removes the iframe over the retained image', async () => {
  stubManifestFetch();
  const root = buildFragment();
  document.body.appendChild(root);
  await hydrateDocsTryIt(root, { reducedMotion: false });

  const toolShot = root.querySelector<HTMLElement>('.shot')!;
  const live = toolShot.querySelector<HTMLButtonElement>('button.shot-tryit-live')!;

  live.click();
  const frame = toolShot.querySelector<HTMLIFrameElement>('iframe.shot-live-frame');
  assert.ok(frame, 'iframe mounted on first click');
  assert.match(frame!.getAttribute('src') ?? '', /\/#\/tool\/qr-code\?.*full$/);
  assert.ok(toolShot.classList.contains('shot--live'));
  assert.equal(live.getAttribute('aria-pressed'), 'true');
  assert.ok(toolShot.querySelector('img[src="/info/shots/exp-url-qr-color.svg"]'), 'img retained under the live frame');

  live.click();
  assert.equal(toolShot.querySelector('iframe.shot-live-frame'), null, 'iframe removed on second click');
  assert.ok(!toolShot.classList.contains('shot--live'));
  assert.equal(live.getAttribute('aria-pressed'), 'false');

  root.remove();
});

test('reduced motion offers navigate only - no in-place live embed', async () => {
  stubManifestFetch();
  const root = buildFragment();
  document.body.appendChild(root);

  await hydrateDocsTryIt(root, { reducedMotion: true });

  const toolShot = root.querySelector<HTMLElement>('.shot')!;
  assert.ok(toolShot.querySelector('a.shot-tryit-open'), 'navigate affordance present under reduce');
  assert.equal(toolShot.querySelector('button.shot-tryit-live'), null, 'no live-embed button under reduce');

  root.remove();
});

test('hydration is idempotent and a missing manifest is a silent no-op', async () => {
  // Idempotent: a second pass adds nothing.
  stubManifestFetch();
  const root = buildFragment();
  document.body.appendChild(root);
  await hydrateDocsTryIt(root, { reducedMotion: false });
  await hydrateDocsTryIt(root, { reducedMotion: false });
  assert.equal(root.querySelectorAll('.shot-tryit').length, 1, 'exactly one overlay after two passes');
  root.remove();

  // Missing manifest: nothing enhanced, nothing thrown.
  _resetManifestCache();
  globalThis.fetch = (async () => ({ ok: false, json: async () => ({}) })) as unknown as typeof fetch;
  const root2 = buildFragment();
  document.body.appendChild(root2);
  await hydrateDocsTryIt(root2, { reducedMotion: false });
  assert.equal(root2.querySelector('.shot-tryit'), null, 'no overlay when the manifest is absent');
  root2.remove();
});
