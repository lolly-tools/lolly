// SPDX-License-Identifier: MPL-2.0
/**
 * Web page boxes (plan 288): what lib/design-web-mount.ts lets each marker show, and
 * the frame it builds. Run with the suite's CSS stub:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/design-web-mount.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/#/tool/design' });
const g = globalThis as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.location = dom.window.location;
g.Element = dom.window.Element;
g.HTMLElement = dom.window.HTMLElement;
g.HTMLIFrameElement = dom.window.HTMLIFrameElement;

const { consentToLink, mountWebFrames, parkWebFrames, setWebPresenting, stripWebFrames, unmountWebFrames, webFrameState } = await import('./design-web-mount.ts');
const { parseWebEmbed } = await import('../../../../engine/src/web-embed.ts');
const { initTrustedSites, resetTrustedSitesForTest } = await import('./trusted-sites.ts');
const { setSitePolicy } = await import('./site-policy.ts');

function canvas(boxes: Array<{ id: string; web: string; view?: number; load?: string }>): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = boxes.map((b) => `<div class="lolly-box" data-box-id="${b.id}"><div class="lolly-box-web" data-lolly-web="${b.web}" data-web-view="${b.view ?? 0}" data-web-load="${b.load ?? 'slide'}" data-web-title="t"></div></div>`).join('');
  document.body.appendChild(root);
  return root;
}
const markerOf = (root: Element, id: string) => root.querySelector<HTMLElement>(`[data-box-id="${id}"] .lolly-box-web`)!;
const ctx = { appOrigin: 'https://lolly.tools' };

test('each kind of link gets its state before anyone is asked', () => {
  assert.equal(webFrameState(null, 'editor'), 'invalid');
  assert.equal(webFrameState(parseWebEmbed('https://lolly.tools/#/tool/sandbox?html=x', ctx), 'editor'), 'live', 'a Lolly frame needs no agreement');
  assert.equal(webFrameState(parseWebEmbed('https://github.com/a/b', ctx), 'editor'), 'refused');
  assert.equal(webFrameState(parseWebEmbed('https://codepen.io/team/pen/abc', ctx), 'editor'), 'blocked', 'the hosted web CSP names players only');
  assert.equal(webFrameState(parseWebEmbed('https://vimeo.com/76979871', ctx), 'editor'), 'ask', 'another site is asked about in the editor');
  assert.equal(webFrameState(parseWebEmbed('https://vimeo.com/76979871', ctx), 'present'), 'poster', 'and never while presenting');
});

test('the editor mounts an inert Lolly frame, asks about another site, and notes a refusal', () => {
  const root = canvas([
    { id: 'a', web: 'https://lolly.tools/#/tool/sandbox?html=%3Ch1%3Ehi', view: 1280 },
    { id: 'b', web: 'https://youtu.be/dQw4w9WgXcQ' },
    { id: 'c', web: 'https://github.com/a/b' },
  ]);
  // jsdom has no layout: give the Sandbox box the size a 640x360 box would measure.
  Object.defineProperty(markerOf(root, 'a'), 'clientWidth', { value: 640 });
  Object.defineProperty(markerOf(root, 'a'), 'clientHeight', { value: 360 });
  mountWebFrames(root, { mode: 'editor' });
  const a = markerOf(root, 'a');
  const frame = a.querySelector('iframe')!;
  assert.equal(a.dataset.webState, 'live');
  assert.ok(a.hasAttribute('data-web-inert'), 'inert until entered');
  assert.equal(frame.getAttribute('src'), 'https://lolly.tools/#/tool/sandbox?html=%3Ch1%3Ehi&iframe');
  assert.equal(frame.hasAttribute('sandbox'), false, 'a same-origin Lolly frame runs as the app');
  assert.equal(frame.tabIndex, -1);
  assert.equal(frame.style.width, '1280px', 'laid out at the chosen width…');
  assert.equal(frame.style.height, '720px', '…at the box\'s own aspect…');
  assert.equal(frame.style.transform, 'scale(0.5)', '…and scaled into the box');
  const b = markerOf(root, 'b');
  assert.equal(b.dataset.webState, 'ask');
  assert.equal(b.querySelector('iframe'), null);
  assert.match(b.querySelector('.lolly-box-web-note')!.textContent!, /youtube-nocookie\.com/, 'names the host the frame will contact');
  assert.equal(b.querySelector('.lolly-box-web-note')!.hasAttribute('data-export-hide'), true, 'notes never reach an export');
  assert.equal(markerOf(root, 'c').dataset.webState, 'refused');
  root.remove();
});

test('agreeing to a site mounts its frame with the privacy attributes', () => {
  const root = canvas([{ id: 'v', web: 'https://vimeo.com/76979871' }]);
  consentToLink('https://vimeo.com/76979871');
  mountWebFrames(root, { mode: 'editor' });
  const frame = markerOf(root, 'v').querySelector('iframe')!;
  assert.equal(frame.getAttribute('src'), 'https://player.vimeo.com/video/76979871');
  assert.equal(frame.referrerPolicy, 'strict-origin-when-cross-origin');
  assert.match(frame.getAttribute('sandbox')!, /allow-scripts/);
  assert.doesNotMatch(frame.getAttribute('sandbox')!, /allow-top-navigation/);
  assert.match(frame.getAttribute('allow')!, /fullscreen/);
  root.remove();
});

test('presenting loads only what the deck says is live, and adds autoplay', () => {
  const root = canvas([{ id: 'a', web: 'https://lolly.tools/#/tool/chart?ct=bar' }, { id: 'b', web: 'https://lolly.tools/#/tool/qr-code?url=x' }]);
  mountWebFrames(root, { mode: 'present', shouldBeLive: (m) => m.closest<HTMLElement>('[data-box-id]')!.dataset.boxId === 'a' });
  assert.ok(markerOf(root, 'a').querySelector('iframe'));
  assert.match(markerOf(root, 'a').querySelector('iframe')!.getAttribute('allow')!, /autoplay/);
  assert.equal(markerOf(root, 'b').dataset.webState, 'poster');
  assert.equal(markerOf(root, 'b').querySelector('iframe'), null);
  assert.equal(markerOf(root, 'b').querySelector('.lolly-box-web-note'), null, 'no notes while presenting');
  // A second pass with a new rule unmounts what is no longer live.
  mountWebFrames(root, { mode: 'present', shouldBeLive: () => false });
  assert.equal(markerOf(root, 'a').querySelector('iframe'), null);
  root.remove();
});

test('clones and closing never keep a live frame', () => {
  const root = canvas([{ id: 'a', web: 'https://lolly.tools/#/tool/chart?ct=bar' }]);
  mountWebFrames(root, { mode: 'editor' });
  const clone = root.cloneNode(true) as HTMLElement;
  stripWebFrames(clone);
  assert.equal(clone.querySelector('iframe'), null);
  assert.equal(parkWebFrames(root), null, 'jsdom has no moveBefore, so a repaint reloads rather than parks');
  unmountWebFrames(root);
  assert.equal(root.querySelector('iframe'), null);
  root.remove();
});

test('a trusted site loads without asking, and an organisation block beats a one-time agreement', async () => {
  const profile = { trustedSites: ['www.loom.com'], trustedSitesSeeded: true };
  await initTrustedSites({ profile: { get: async () => profile as never, set: async () => {} } });
  const loom = parseWebEmbed('https://www.loom.com/share/0123456789abcdef0123456789abcdef', ctx);
  assert.equal(webFrameState(loom, 'editor'), 'live');
  assert.equal(webFrameState(loom, 'present'), 'live', 'and while presenting, with nobody asked');
  consentToLink('https://www.loom.com/share/0123456789abcdef0123456789abcdef');
  setSitePolicy({ mode: 'open', allow: [], block: ['loom.com', 'www.loom.com'] });
  assert.equal(webFrameState(loom, 'editor'), 'policy');
  const root = canvas([{ id: 'l', web: 'https://www.loom.com/share/0123456789abcdef0123456789abcdef' }]);
  mountWebFrames(root, { mode: 'editor' });
  assert.match(markerOf(root, 'l').querySelector('.lolly-box-web-note')!.textContent!, /organisation does not allow loom\.com here/);
  assert.equal(webFrameState(parseWebEmbed('https://lolly.tools/#/tool/chart?ct=bar', ctx), 'editor'), 'live', 'Lolly frames are this app, whatever the policy');
  setSitePolicy({ mode: 'none', allow: [], block: [] });
  assert.equal(webFrameState(parseWebEmbed('https://lolly.tools/#/tool/sandbox?html=x', ctx), 'editor'), 'live');
  setSitePolicy(null);
  resetTrustedSitesForTest();
  root.remove();
});

test("while presenting, the editor's own frames unload and come back after", () => {
  const root = canvas([{ id: 'a', web: 'https://lolly.tools/#/tool/chart?ct=bar' }]);
  mountWebFrames(root, { mode: 'editor' });
  assert.ok(markerOf(root, 'a').querySelector('iframe'));
  setWebPresenting(true);
  assert.equal(markerOf(root, 'a').querySelector('iframe'), null, 'dropped at once');
  mountWebFrames(root, { mode: 'editor' });
  assert.equal(markerOf(root, 'a').querySelector('iframe'), null, 'and not mounted again by a repaint');
  assert.equal(markerOf(root, 'a').dataset.webState, 'poster');
  setWebPresenting(false);
  mountWebFrames(root, { mode: 'editor' });
  assert.ok(markerOf(root, 'a').querySelector('iframe'));
  unmountWebFrames(root);
  root.remove();
});
