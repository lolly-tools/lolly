// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://instance.test/' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location });
const { projectInviteLinks, reusableInviteUrl } = await import('./project-invite-links.ts');

test('invitation capabilities accept only signed join URLs on the active instance', () => {
  assert.equal(reusableInviteUrl('https://instance.test/l/join/lnk_good?s=signed'), 'https://instance.test/l/join/lnk_good?s=signed');
  for (const url of ['https://other.test/l/join/lnk_good?s=signed', 'https://evil@instance.test/l/join/lnk_good?s=signed',
    'https://instance.test/l/join/lnk_good?s=signed#extra', 'https://instance.test/#/p?team=project',
    'https://instance.test/l/join/lnk_good?s=signed&s=other', 'https://instance.test/l/join/lnk_good?s=signed&next=evil',
    'https://instance.test/l/join/lnk_good', 'javascript:alert(1)']) assert.equal(reusableInviteUrl(url), null, url);
});

test('a deck invite carries the selected role and destination and refuses a changed account', async () => {
  let current = true; const bodies: unknown[] = [];
  globalThis.fetch = (async (_input, init) => { bodies.push(JSON.parse(String(init?.body)));
    return Response.json({ role: 'viewer', url: 'https://instance.test/l/join/lnk_good?s=signed', allowNewPeople: false });
  }) as typeof fetch;
  const capability = projectInviteLinks('prj_event', null, () => current, 'ses_deck');
  assert.deepEqual(await capability.create('viewer'), { url: 'https://instance.test/l/join/lnk_good?s=signed', allowNewPeople: false });
  assert.deepEqual(bodies, [{ role: 'viewer', sessionId: 'ses_deck' }]);
  current = false; await assert.rejects(capability.create('viewer')); assert.equal(bodies.length, 1);
});

test('a delayed response cannot copy a link after the account changes', async () => {
  let current = true, finish!: (response: Response) => void;
  globalThis.fetch = (() => new Promise(resolve => { finish = resolve; })) as typeof fetch;
  const pending = projectInviteLinks('prj_event', null, () => current).create('editor');
  current = false; finish(Response.json({ role: 'editor', url: 'https://instance.test/l/join/lnk_good?s=signed', allowNewPeople: true }));
  await assert.rejects(pending, /context changed/);
});
