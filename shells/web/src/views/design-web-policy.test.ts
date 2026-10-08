// SPDX-License-Identifier: MPL-2.0
import test, { beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { Profile } from '@lolly-tools/core/host-v1';

const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://lolly.ing/#/design' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location,
  Element: dom.window.Element, HTMLElement: dom.window.HTMLElement, HTMLIFrameElement: dom.window.HTMLIFrameElement });
const { parseWebEmbed } = await import('../../../../engine/src/web-embed.ts');
const { initTrustedSites, resetTrustedSitesForTest } = await import('../lib/trusted-sites.ts');
const { setSitePolicy } = await import('../lib/site-policy.ts');
const { webFrameState, mountWebFrames } = await import('../lib/design-web-mount.ts');
const { approveWebLink, webApprovalRows } = await import('./design-web-policy.ts');
const embed = (url: string) => parseWebEmbed(url, { appOrigin: location.origin })!;
const rows = (url: string) => webApprovalRows(embed(url), (label, value) => `${label}: ${value}`, (label, action) => `${action}: ${label}`);
let profile: Profile;
beforeEach(async () => {
  resetTrustedSitesForTest(); setSitePolicy(null); document.documentElement.removeAttribute('data-lolly-any-site');
  profile = { trustedSites: [], trustedSitesSeeded: true } as Profile;
  await initTrustedSites({ profile: { get: async () => profile, set: async value => { profile = value; } } });
});

test('an external page has inline approval choices, with the reload explained', () => {
  const html = rows('https://example.com/inline-approval');
  assert.match(html, /webapprove: Allow this time/);
  assert.match(html, /webtrust: Always trust example.com/);
  assert.match(html, /Other sites still need your approval/);
});

test('one-time approval survives the wider-policy reload and leaves other sites unapproved', async () => {
  const url = 'https://approval-once.example/demo'; let reloaded = false;
  const result = await approveWebLink(url, false, { probe: async () => 'offered', enter: () => { reloaded = true; return true; } });
  assert.equal(result.ok, true); assert.equal(reloaded, true);
  assert.ok(JSON.parse(window.sessionStorage.getItem('lolly:web-consent')!).includes('https://approval-once.example'));
  assert.deepEqual(profile.trustedSites, []);
  document.documentElement.setAttribute('data-lolly-any-site', '');
  const root = document.createElement('div');
  root.innerHTML = `<div class="lolly-box" data-box-id="demo"><div class="lolly-box-web" data-lolly-web="${url}"></div></div>`;
  document.body.append(root);mountWebFrames(root, { mode: 'editor' });
  assert.equal(root.querySelector('iframe')?.getAttribute('src'), url);
  assert.equal(webFrameState(embed('https://still-unapproved.example/demo'), 'editor'), 'ask');
  root.remove();
});

test('always trust saves only the named site and enables the existing frame path', async () => {
  document.documentElement.setAttribute('data-lolly-any-site', '');
  assert.equal((await approveWebLink('https://approval-always.example/demo', true)).ok, true);
  assert.deepEqual(profile.trustedSites, ['approval-always.example']);
  assert.equal(webFrameState(embed('https://approval-always.example/other'), 'editor'), 'live');
  assert.equal(webFrameState(embed('https://another-always.example/other'), 'editor'), 'ask');
});

test('destination refusals and workspace blocks do not offer or grant approval', async () => {
  assert.doesNotMatch(rows('https://github.com/lolly-tools/lolly'), /webapprove|webtrust/);
  assert.equal((await approveWebLink('https://github.com/lolly-tools/lolly')).ok, false);
  setSitePolicy({ mode: 'none', allow: [], block: [] });
  assert.doesNotMatch(rows('https://blocked-approval.example/demo'), /webapprove|webtrust/);
  assert.equal((await approveWebLink('https://blocked-approval.example/demo')).ok, false);
});

test('an unavailable wide-policy route grants no consent and a new policy during the probe still wins', async () => {
  const missing = 'https://not-offered-approval.example/demo';
  assert.equal((await approveWebLink(missing, false, { probe: async () => 'not-offered', enter: () => { throw Error('must not reload'); } })).ok, false);
  document.documentElement.setAttribute('data-lolly-any-site', '');
  assert.equal(webFrameState(embed(missing), 'editor'), 'ask');
  document.documentElement.removeAttribute('data-lolly-any-site');
  const changed = await approveWebLink('https://changed-approval.example/demo', false, {
    probe: async () => { setSitePolicy({ mode: 'none', allow: [], block: [] }); return 'offered'; },
    enter: () => { throw Error('must not reload'); },
  });
  assert.equal(changed.ok, false);
});
