// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { CollabSession, CollabSessionState } from '../lib/collab-session.ts';
import { commentPeople, commentBubble } from './tool-comment-chat.ts';
import { setAccountHeadshot } from '../lib/account-headshots.ts';

test('account colours stay distinct across replies and a peer leaving; portraits replace initials with a fallback', () => {
  const dom = new JSDOM('<body></body>', { url: 'https://lolly.ing/' });
  let state = { self: { userId: 'andy', clientId: 'device-a', color: '#008657' }, peers: [{ userId: 'ravan', clientId: 'device-r', color: '#b96b49' }] } as unknown as CollabSessionState;
  const colors = commentPeople({ state: () => state } as CollabSession);
  try {
    const message = (id: string, authorId: string) => ({ id, authorId, authorName: authorId, body: 'A reply', createdAt: '2026-10-05T11:00:00Z' });
    const a = commentBubble(dom.window.document, message('a', 'andy'), colors('andy'), true);
    const r = commentBubble(dom.window.document, message('r', 'ravan'), colors('ravan'), false);
    dom.window.document.body.append(a.article, r.article);
    assert.notEqual(a.bubble.style.background, r.bubble.style.background);
    assert.equal(a.bubble.style.getPropertyValue('--comment-person-color'), '#008657');
    state = { ...state, peers: [] };
    const reply = commentBubble(dom.window.document, message('reply', 'ravan'), colors('ravan'), false);
    assert.equal(reply.bubble.style.background, r.bubble.style.background);
    setAccountHeadshot('andy', 'https://lolly.ing/profile-photo.png', dom.window.document);
    const image = a.article.querySelector<HTMLImageElement>('img')!;
    assert.equal(image.getAttribute('src'), 'https://lolly.ing/profile-photo.png');
    image.dispatchEvent(new dom.window.Event('load')); assert.equal((image.previousElementSibling as HTMLElement).hidden, true);
    image.dispatchEvent(new dom.window.Event('error')); assert.equal(a.article.querySelector('img'), null);
    assert.equal(a.article.querySelector<HTMLElement>('.collab-comment-avatar > span')!.hidden, false);
    setAccountHeadshot('ravan', 'https://arbitrary.example/photo.png', dom.window.document);
    assert.equal(r.article.querySelector('img'), null);
  } finally { setAccountHeadshot('andy', undefined, dom.window.document); dom.window.close(); }
});
