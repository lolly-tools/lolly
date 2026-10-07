// SPDX-License-Identifier: MPL-2.0
/**
 * `@` mentions for the comments composer: a listbox of people who can open the document,
 * fed by the host's `suggest`, plus the plain-text split that shows a stored mention.
 * Names and bodies reach the page only as text nodes, never as markup.
 */
import type { CommentMessage, CommentThread } from '@lolly-tools/core/canvas-review-v1';
import type { CommentPerson } from '../lib/canvas-comments.ts';
import { tRaw } from '../i18n.ts';

/** The most people one message may mention (the core review contract's limit). */
export const MENTION_LIMIT = 10;
const QUERY_LIMIT = 64;
const SHOWN_LIMIT = 20;
const WORD = /[\p{L}\p{N}_]/u;

/** Mentions stored on a message. A host without mentions stores none, so this reads defensively. */
export function mentionsOf(message: CommentMessage | undefined): CommentPerson[] {
  const stored: unknown = message && 'mentions' in message ? message.mentions : undefined;
  if (!Array.isArray(stored)) return [];
  const entries: readonly unknown[] = stored, people: CommentPerson[] = [];
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || !('id' in entry) || !('name' in entry)) continue;
    const { id, name } = entry;
    if (typeof id === 'string' && typeof name === 'string' && name && !people.some(person => person.id === id)) people.push({ id, name });
  }
  return people;
}

/** True when `@name` starts at `index` of `body` and is not the start of a longer word. */
function mentionAt(body: string, index: number, name: string): boolean {
  if (!name || !body.startsWith(`@${name}`, index)) return false;
  const next = body.charAt(index + name.length + 1);
  return !next || !WORD.test(next);
}

/** `body` split into plain text and stored mentions; the longest matching name wins at each `@`. */
export function mentionSegments(body: string, mentions: readonly CommentPerson[]): Array<{ text: string; mention?: CommentPerson }> {
  const names = [...mentions].sort((a, b) => b.name.length - a.name.length), parts: Array<{ text: string; mention?: CommentPerson }> = [];
  let plain = '', index = 0;
  while (index < body.length) {
    const mention = body[index] === '@' ? names.find(person => mentionAt(body, index, person.name)) : undefined;
    if (!mention) { plain += body[index]; index += 1; continue; }
    if (plain) parts.push({ text: plain }); plain = '';
    parts.push({ text: `@${mention.name}`, mention }); index += mention.name.length + 1;
  }
  if (plain) parts.push({ text: plain });
  return parts;
}

/** The chosen people whose `@Name` is still in `body`; a mention removed before sending is dropped. */
export function mentionIdsFor(body: string, chosen: ReadonlyMap<string, string>): string[] {
  const ids: string[] = [];
  for (const [id, name] of chosen) {
    let found = false;
    for (let index = body.indexOf('@'); index >= 0 && !found; index = body.indexOf('@', index + 1)) found = mentionAt(body, index, name);
    if (found) ids.push(id);
  }
  return ids.slice(0, MENTION_LIMIT);
}

/** True when someone asked for in `requested` was not stored on the sent message, or the host notified nobody. */
export function mentionsMissed(result: CommentThread & { notified?: boolean }, messageId: string, requested: readonly string[]): boolean {
  if (!requested.length) return false;
  if (result.notified === false) return true;
  const stored = new Set(mentionsOf(result.messages.find(message => message.id === messageId)).map(person => person.id));
  return requested.some(id => !stored.has(id));
}

export interface MentionPickerOptions {
  suggest(query: string): Promise<{ people: CommentPerson[]; truncated: boolean }>;
  /** The mentions chosen for the text currently in the field (id to name). */
  chosen(): Map<string, string>;
  onError(error: unknown): void;
}
export interface MentionPicker { readonly open: boolean; close(): void; dispose(): void }

let serial = 0;
/**
 * Offer people while the text before the caret ends in `@query`. Arrow keys move, Enter or
 * Tab chooses, Escape closes; choosing inserts `@Name ` and records the person's id.
 */
export function attachMentionPicker(field: HTMLTextAreaElement, host: HTMLElement, options: MentionPickerOptions): MentionPicker {
  const doc = field.ownerDocument, win = doc.defaultView!, abort = new win.AbortController(), id = `collab-mentions-${++serial}`;
  const box = doc.createElement('div'); box.className = 'collab-comment-mentions'; box.hidden = true;
  const list = doc.createElement('ul'); list.id = id; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', tRaw('People you can mention'));
  const note = doc.createElement('p'); note.className = 'collab-comment-mention-note'; note.setAttribute('aria-live', 'polite');
  box.append(list, note); host.append(box);
  field.setAttribute('aria-autocomplete', 'list');
  let people: CommentPerson[] = [], active = 0, token: { start: number; query: string } | undefined, ticket = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  function tokenAt(): { start: number; query: string } | undefined {
    const caret = field.selectionStart ?? field.value.length;
    if (field.selectionEnd !== null && field.selectionEnd !== caret) return undefined;
    const match = /(?:^|\s)@([^\s@]*)$/u.exec(field.value.slice(0, caret));
    const query = match?.[1];
    return query !== undefined && query.length <= QUERY_LIMIT ? { start: caret - query.length - 1, query } : undefined;
  }
  function close(): void {
    ticket += 1; if (timer) clearTimeout(timer); timer = undefined;
    token = undefined; people = []; active = 0;
    box.hidden = true; list.replaceChildren(); note.textContent = '';
    field.removeAttribute('aria-activedescendant'); field.removeAttribute('aria-controls');
  }
  function paintActive(): void {
    list.querySelectorAll<HTMLElement>('[role="option"]').forEach((option, index) => { option.setAttribute('aria-selected', String(index === active)); });
    const current = doc.getElementById(`${id}-${active}`);
    if (current) { field.setAttribute('aria-activedescendant', current.id); current.scrollIntoView?.({ block: 'nearest' }); }
    else field.removeAttribute('aria-activedescendant');
  }
  function choose(index: number): void {
    const person = people[index], at = token;
    if (!person || !at) return;
    const end = field.selectionStart ?? field.value.length, text = `@${person.name} `;
    field.value = field.value.slice(0, at.start) + text + field.value.slice(end);
    const caret = at.start + text.length; field.setSelectionRange(caret, caret);
    options.chosen().set(person.id, person.name); close();
    field.dispatchEvent(new win.Event('input', { bubbles: true }));
  }
  function show(found: CommentPerson[], truncated: boolean, query: string): void {
    people = found.slice(0, SHOWN_LIMIT); active = 0;
    if (!people.length && !query) { close(); return; }
    list.replaceChildren(...people.map((person, index) => {
      const option = doc.createElement('li'); option.id = `${id}-${index}`; option.setAttribute('role', 'option'); option.textContent = person.name;
      option.addEventListener('pointerdown', event => { event.preventDefault(); });
      option.addEventListener('click', () => { choose(index); field.focus(); });
      return option;
    }));
    note.textContent = !people.length ? tRaw('No one who can open this document matches {query}.', { query: `@${query}` })
      : truncated ? tRaw('Keep typing to see more people.') : '';
    box.hidden = false; field.setAttribute('aria-controls', id); paintActive();
  }
  function lookup(): void {
    token = tokenAt();
    if (!token) { close(); return; }
    const mine = ++ticket, query = token.query;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = undefined;
      void options.suggest(query).then(result => { if (mine === ticket && token) show(result.people, result.truncated, query); }, error => {
        if (mine !== ticket) return; close(); options.onError(error);
      });
    }, 120);
  }
  field.addEventListener('input', lookup, { signal: abort.signal });
  field.addEventListener('blur', close, { signal: abort.signal });
  field.addEventListener('keydown', event => {
    if (box.hidden || event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); return; }
    if (!people.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault(); active = (active + (event.key === 'ArrowDown' ? 1 : people.length - 1)) % people.length; paintActive();
    } else if (event.key === 'Enter' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); choose(active); }
  }, { signal: abort.signal });
  return {
    get open() { return !box.hidden; },
    close,
    dispose() { close(); abort.abort(); box.remove(); field.removeAttribute('aria-autocomplete'); },
  };
}
