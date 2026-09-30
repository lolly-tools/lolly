// SPDX-License-Identifier: MPL-2.0
/**
 * Trusted sites (plan 288 section 5.3) and the organisation seam: the precedence
 * lolly-work plan 58 section 3.2 defines, one test per rule.
 *   node --import ./tests/css-stub.mjs --test shells/web/src/lib/trusted-sites.test.ts
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import type { Profile } from '@lolly-tools/core/host-v1';
import { failClosedSitePolicy, setSitePolicy, sitePolicy } from './site-policy.ts';
import {
  canTrustMore, initTrustedSites, resetTrustedSitesForTest, setBrandTrustedSites, siteVerdict, trustSite, trustedSiteRows, untrustSite,
} from './trusted-sites.ts';

function fakeHost(initial: Partial<Profile> = {}) {
  const record = { ...initial } as Profile;
  const writes: Profile[] = [];
  return {
    record,
    writes,
    profile: {
      get: async () => record,
      set: async (p: Profile) => { writes.push(JSON.parse(JSON.stringify(p))); },
    },
  };
}

beforeEach(() => {
  resetTrustedSitesForTest();
  setSitePolicy(null);
});

test('with nobody deciding, a site is a question', async () => {
  await initTrustedSites(fakeHost());
  assert.deepEqual(siteVerdict('https://example.com/'), { state: 'ask' });
});

test("the person's own entries are trusted and say so", async () => {
  await initTrustedSites(fakeHost({ trustedSites: ['*.example.com'], trustedSitesSeeded: true }));
  assert.deepEqual(siteVerdict('https://cdn.example.com/a.css'), { state: 'trusted', entry: '*.example.com', source: 'you' });
});

test('brand entries apply until the person edits the list, and a removal sticks', async () => {
  const host = fakeHost();
  await initTrustedSites(host);
  setBrandTrustedSites(['*.suse.com', 'not an entry']);
  assert.equal(siteVerdict('https://www.suse.com/').source, 'brand');
  await untrustSite('*.suse.com');
  assert.equal(siteVerdict('https://www.suse.com/').state, 'ask', 'removed, and the brand default is not merged back');
  assert.equal(host.record.trustedSitesSeeded, true);
  assert.deepEqual(host.record.trustedSites, []);
});

test('"Always trust" writes the stored form once, and refuses what is not an entry', async () => {
  const host = fakeHost();
  await initTrustedSites(host);
  assert.equal(await trustSite('https://Vimeo.com/'), 'vimeo.com');
  assert.equal(await trustSite('vimeo.com'), 'vimeo.com');
  assert.deepEqual(host.record.trustedSites, ['vimeo.com']);
  assert.equal(await trustSite('http://vimeo.com'), null);
  assert.equal(siteVerdict('https://vimeo.com/1').state, 'trusted');
});

test('an organisation block wins over its own allow and over the person', async () => {
  await initTrustedSites(fakeHost({ trustedSites: ['codepen.io'], trustedSitesSeeded: true }));
  setSitePolicy({ mode: 'open', allow: ['codepen.io'], block: [{ entry: 'codepen.io', reason: 'Runs outside code.' }], by: 'Acme' });
  assert.deepEqual(siteVerdict('https://codepen.io/pen'), { state: 'blocked', entry: 'codepen.io', source: 'organisation', reason: 'Runs outside code.', by: 'Acme' });
});

test('a block on the link as given applies to the host a player loads from', async () => {
  await initTrustedSites(fakeHost({ trustedSites: ['www.youtube-nocookie.com'], trustedSitesSeeded: true }));
  setSitePolicy({ mode: 'open', allow: [], block: ['*.youtube.com'] });
  assert.equal(siteVerdict('https://www.youtube-nocookie.com/embed/x', 'https://www.youtube.com/watch?v=x').state, 'blocked');
  assert.equal(siteVerdict('https://www.youtube-nocookie.com/embed/x').state, 'trusted', 'trust is read for the host contacted');
});

test('ask mode trusts and locks the organisation list, and the person may add more', async () => {
  await initTrustedSites(fakeHost({ trustedSites: ['mine.example'], trustedSitesSeeded: true }));
  setSitePolicy({ mode: 'ask', allow: ['docs.acme.example'], block: [] });
  assert.equal(siteVerdict('https://docs.acme.example/').source, 'organisation');
  assert.equal(siteVerdict('https://mine.example/').source, 'you');
  assert.equal(canTrustMore(), true);
  assert.deepEqual(trustedSiteRows().map((r) => [r.entry, r.source, r.locked]), [['docs.acme.example', 'organisation', true], ['mine.example', 'you', false]]);
});

test('allowlist-only ignores the personal list and asks nothing', async () => {
  const host = fakeHost({ trustedSites: ['mine.example'], trustedSitesSeeded: true });
  await initTrustedSites(host);
  setSitePolicy({ mode: 'allowlist-only', allow: ['docs.acme.example'], block: [] });
  assert.equal(siteVerdict('https://mine.example/').state, 'blocked');
  assert.equal(siteVerdict('https://docs.acme.example/').state, 'trusted');
  assert.equal(canTrustMore(), false);
  assert.equal(await trustSite('other.example'), null);
  assert.deepEqual(host.record.trustedSites, ['mine.example'], 'the stored list is left alone');
});

test('none blocks every site, and a malformed or unreadable policy fails closed', async () => {
  await initTrustedSites(fakeHost({ trustedSites: ['mine.example'], trustedSitesSeeded: true }));
  setSitePolicy({ mode: 'none', allow: ['docs.acme.example'], block: [] });
  assert.equal(siteVerdict('https://docs.acme.example/').state, 'blocked');
  setSitePolicy({ mode: 'wide open' });
  assert.equal(sitePolicy()?.mode, 'none');
  assert.equal(sitePolicy()?.failClosed, true);
  setSitePolicy(undefined);
  assert.equal(sitePolicy()?.mode, 'none');
  assert.deepEqual(failClosedSitePolicy('Acme'), { mode: 'none', allow: [], block: [], by: 'Acme', failClosed: true });
  setSitePolicy(null);
  assert.equal(siteVerdict('https://mine.example/').state, 'trusted', 'lifting the policy restores the person\'s list');
});

test('a locked list stays in force and cannot change; an ignored brand list does not apply', async () => {
  const host = fakeHost({ trustedSites: ['mine.example'], trustedSitesSeeded: true });
  await initTrustedSites(host);
  setBrandTrustedSites(['*.suse.com']);
  setSitePolicy({ mode: 'ask', allow: [], block: [], memberEntries: 'locked' });
  assert.equal(siteVerdict('https://mine.example/').state, 'trusted');
  assert.equal(canTrustMore(), false);
  assert.equal(await trustSite('other.example'), null);
  await untrustSite('mine.example');
  assert.deepEqual(host.record.trustedSites, ['mine.example'], 'a locked list is not written');
  assert.ok(trustedSiteRows().every((r) => r.locked));

  resetTrustedSitesForTest();
  await initTrustedSites(fakeHost());
  setBrandTrustedSites(['*.suse.com']);
  setSitePolicy({ mode: 'open', allow: [], block: [], brandDefaults: 'ignore' });
  assert.equal(siteVerdict('https://www.suse.com/').state, 'ask');
  setSitePolicy(null);
  assert.equal(siteVerdict('https://www.suse.com/').source, 'brand');
});

test('the fail-closed stand-in gives its reason wherever a site is refused', async () => {
  await initTrustedSites(fakeHost());
  setSitePolicy(failClosedSitePolicy(undefined, "Can't reach your organisation's settings."));
  assert.deepEqual(siteVerdict('https://example.com/'), { state: 'blocked', source: 'organisation', reason: "Can't reach your organisation's settings." });
});
