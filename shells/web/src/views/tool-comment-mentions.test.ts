// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import type { CommentMessage, CommentThread } from '@lolly-tools/core/canvas-review-v1';
import type { CommentPerson } from '../lib/canvas-comments.ts';
import { attachMentionPicker, mentionIdsFor, mentionSegments, mentionsMissed, mentionsOf, MENTION_LIMIT } from './tool-comment-mentions.ts';
import { commentText } from './tool-comment-chat.ts';

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
function message(body: string, mentions?: unknown, extra: Partial<CommentMessage> = {}): CommentMessage {
  const value: CommentMessage = { id: 'm1', authorId: 'ana', authorName: 'Ana', body, createdAt: '2026-10-07T10:00:00Z', ...extra };
  // Any stored value, malformed ones included: the reader must cope with whatever a host keeps.
  return mentions === undefined ? value : Object.assign(value, { mentions });
}

test('mention names render as text nodes only, never as markup', () => {
  const dom = new JSDOM('<body></body>');
  try {
    const name = '<img src=x onerror="globalThis.hit=1">';
    const body = commentText(dom.window.document, message(`Hi @${name}, see @Bo and @Bob.`, [{ id: 'evil', name }, { id: 'bo', name: 'Bo' }]), 'Deleted message');
    assert.equal(body.querySelector('img'), null);
    const mentions = [...body.querySelectorAll('strong.collab-comment-mention')];
    assert.deepEqual(mentions.map(node => node.textContent), [`@${name}`, '@Bo'], '@Bob is a longer word, not a mention of Bo');
    assert.ok(mentions.every(node => node.childNodes.length === 1 && node.firstChild!.nodeType === 3));
    assert.equal(mentions[1]!.getAttribute('title'), 'Mention of Bo');
    assert.equal(body.textContent, `Hi @${name}, see @Bo and @Bob.`);
    assert.equal(commentText(dom.window.document, message('gone', [{ id: 'bo', name: 'Bo' }], { deletedAt: '2026-10-07T11:00:00Z' }), 'Deleted message').textContent, 'Deleted message');
  } finally { dom.window.close(); }
});

test('stored mentions are read defensively from hosts with and without mentions', () => {
  assert.deepEqual(mentionsOf(message('no mentions')), []);
  assert.deepEqual(mentionsOf(message('odd', 'not a list')), []);
  assert.deepEqual(mentionsOf(message('mixed', [{ id: 'a', name: 'Ana' }, { id: 'a', name: 'Ana again' }, { id: 7, name: 'Seven' }, { id: 'b' }, null, { id: 'c', name: '' }])), [{ id: 'a', name: 'Ana' }]);
  assert.deepEqual(mentionSegments('@Ana Lopez and @Ana', [{ id: 'a', name: 'Ana' }, { id: 'al', name: 'Ana Lopez' }]).filter(part => part.mention).map(part => part.mention!.id), ['al', 'a'],
    'the longest name wins at each @');
});

test('ids whose @Name was removed before sending are dropped, and at most ten are sent', () => {
  const chosen = new Map([['ana', 'Ana Lopez'], ['bo', 'Bo']]);
  assert.deepEqual(mentionIdsFor('Thanks @Ana Lopez', chosen), ['ana']);
  assert.deepEqual(mentionIdsFor('Thanks @Ana Lo and @Bob', chosen), []);
  const many = new Map(Array.from({ length: 12 }, (_, index) => [`p${index}`, `Person${index}`] as const));
  assert.equal(mentionIdsFor([...many.values()].map(name => `@${name}`).join(' '), many).length, MENTION_LIMIT);
});

test('a send is reported as not notified when a requested mention was not stored or nobody was notified', () => {
  const thread = (mentions: CommentPerson[], notified?: boolean): CommentThread & { notified?: boolean } => ({
    id: 't', sessionId: 's', anchor: { kind: 'canvas', surface: 'page', x: 0, y: 0 }, authorId: 'me', authorName: 'Me', revision: 2,
    createdAt: '2026-10-07T10:00:00Z', updatedAt: '2026-10-07T10:00:00Z', messages: [message('Hi', mentions, { id: 'sent' })], ...(notified === undefined ? {} : { notified }),
  });
  assert.equal(mentionsMissed(thread([{ id: 'ana', name: 'Ana' }]), 'sent', ['ana']), false);
  assert.equal(mentionsMissed(thread([]), 'sent', ['ana']), true);
  assert.equal(mentionsMissed(thread([{ id: 'ana', name: 'Ana' }], false), 'sent', ['ana']), true);
  assert.equal(mentionsMissed(thread([], false), 'sent', []), false, 'a send without mentions says nothing about mentions');
});

function picker(people: CommentPerson[], options: { truncated?: boolean; fail?: unknown } = {}) {
  const dom = new JSDOM('<form id="host"><textarea></textarea></form>', { pretendToBeVisual: true });
  const doc = dom.window.document, field = doc.querySelector('textarea')!, host = doc.getElementById('host')!;
  const chosen = new Map<string, string>(), queries: string[] = [], errors: unknown[] = [];
  const handle = attachMentionPicker(field, host, {
    async suggest(query) { queries.push(query); if (options.fail) throw options.fail; return { people: people.filter(person => person.name.startsWith(query)), truncated: !!options.truncated }; },
    chosen: () => chosen, onError: error => { errors.push(error); },
  });
  const type = async (value: string) => {
    field.value = value; field.setSelectionRange(value.length, value.length);
    field.dispatchEvent(new dom.window.Event('input', { bubbles: true })); await wait(150);
  };
  const key = (name: string) => { const event = new dom.window.KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }); field.dispatchEvent(event); return event; };
  const options_ = () => [...doc.querySelectorAll<HTMLElement>('[role="option"]')];
  return { dom, doc, field, host, chosen, queries, errors, handle, type, key, options: options_, box: () => doc.querySelector<HTMLElement>('.collab-comment-mentions')! };
}

test('the @ listbox is keyboard operable: arrows move, Enter and Tab choose, Escape closes without leaving the panel', async () => {
  const f = picker([{ id: 'ana', name: 'Ana Lopez' }, { id: 'al', name: 'Alex' }, { id: 'bo', name: 'Bo' }]);
  try {
    let escapes = 0; f.host.addEventListener('keydown', event => { if (event.key === 'Escape') escapes += 1; });
    assert.equal(f.field.getAttribute('aria-autocomplete'), 'list'); assert.equal(f.field.getAttribute('aria-haspopup'), 'listbox');
    const live = f.doc.querySelector('.collab-comment-mention-live')!;
    assert.equal(live.parentElement, f.host, 'the live region is in the page before the list opens, outside the list box');
    assert.equal(live.getAttribute('aria-live'), 'polite');
    await f.type('Hello @A');
    assert.deepEqual(f.queries, ['A']); assert.equal(f.box().hidden, false);
    const listbox = f.doc.querySelector('[role="listbox"]')!;
    assert.equal(listbox.getAttribute('aria-label'), 'People you can mention'); assert.equal(f.field.getAttribute('aria-controls'), listbox.id);
    assert.equal(listbox.getAttribute('aria-expanded'), 'true');
    assert.deepEqual(f.options().map(option => [option.textContent, option.getAttribute('aria-selected')]), [['Ana Lopez', 'true'], ['Alex', 'false']]);
    assert.equal(live.textContent, 'Ana Lopez', 'the first person is said when the list opens');
    assert.ok(f.key('ArrowDown').defaultPrevented);
    assert.equal(f.field.getAttribute('aria-activedescendant'), f.options()[1]!.id);
    assert.equal(live.textContent, 'Alex', 'each move is said');
    f.key('ArrowDown'); assert.equal(f.options()[0]!.getAttribute('aria-selected'), 'true', 'arrows wrap');
    f.key('ArrowUp'); assert.equal(f.options()[1]!.getAttribute('aria-selected'), 'true');
    assert.ok(f.key('Enter').defaultPrevented);
    assert.equal(f.field.value, 'Hello @Alex '); assert.deepEqual([...f.chosen], [['al', 'Alex']]);
    assert.equal(f.box().hidden, true); assert.equal(f.field.hasAttribute('aria-activedescendant'), false);
    assert.equal(listbox.getAttribute('aria-expanded'), 'false'); assert.equal(live.textContent, '');
    await f.type('Hello @Alex and @B'); f.key('Tab');
    assert.equal(f.field.value, 'Hello @Alex and @Bo '); assert.equal(f.chosen.get('bo'), 'Bo');
    await f.type('Hello @Alex and @Bo and @A'); assert.equal(f.box().hidden, false);
    f.key('Escape'); assert.equal(f.box().hidden, true); assert.equal(escapes, 0, 'Escape closes the list, not the comments panel');
    assert.equal(f.field.value, 'Hello @Alex and @Bo and @A');
  } finally { f.handle.dispose(); f.dom.window.close(); }
});

test('the listbox explains an empty match and a truncated list, and passes failures on', async () => {
  const f = picker([{ id: 'ana', name: 'Ana' }], { truncated: true });
  try {
    await f.type('@Zed'); assert.equal(f.box().hidden, false); assert.equal(f.options().length, 0);
    assert.equal(f.doc.querySelector('.collab-comment-mention-note')!.textContent, 'No one who can open this document matches @Zed.');
    const live = () => f.doc.querySelector('.collab-comment-mention-live')?.textContent;
    assert.equal(live(), 'No one who can open this document matches @Zed.', 'a match of nobody is said from the persistent region');
    await f.type('@A'); assert.equal(f.doc.querySelector('.collab-comment-mention-note')!.textContent, 'Keep typing to see more people.');
    assert.equal(live(), 'Ana. Keep typing to see more people.');
    await f.type('plain text'); assert.equal(f.box().hidden, true);
    f.handle.dispose(); assert.equal(f.field.hasAttribute('aria-autocomplete'), false); assert.equal(f.box(), null);
    assert.equal(f.field.hasAttribute('aria-haspopup'), false); assert.equal(live(), undefined, 'disposing removes the live region');
  } finally { f.dom.window.close(); }
  const g = picker([], { fail: Object.assign(new Error('missing'), { status: 404 }) });
  try {
    await g.type('@a'); assert.equal(g.box().hidden, true); assert.equal((g.errors[0] as { status: number }).status, 404);
  } finally { g.handle.dispose(); g.dom.window.close(); }
});
