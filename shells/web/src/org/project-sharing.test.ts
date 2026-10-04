// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
const dom = new JSDOM('<!doctype html><body><button id="anchor">Share</button></body>', { url: 'https://instance.test/#/p' });
Object.assign(globalThis, { window: dom.window, document: dom.window.document, location: dom.window.location,
  HTMLElement: dom.window.HTMLElement, Element: dom.window.Element, Node: dom.window.Node });
globalThis.fetch = (async () => Response.json({ myRole: 'manager', members: [] })) as typeof fetch;
const { showProjectInviteLink } = await import('./project-sharing.ts');

test('a document invitation offers its role picker on the first open and cleans up on close', async () => {
  const popover = showProjectInviteLink(document.getElementById('anchor')!, 'prj_event', () => true, 'ses_deck');
  try {
    for (let i = 0; i < 5; i++) await new Promise(resolve => setTimeout(resolve, 0));
    const control = document.querySelector<HTMLElement>('.project-invite-popover .invite-link-control')!;
    assert.equal(control.hidden, false);
    assert.deepEqual([...control.querySelectorAll('option')].map(option => option.value), ['editor', 'viewer']);
  } finally { popover.close(); }
  assert.equal(document.querySelector('.project-invite-popover'), null);
});
