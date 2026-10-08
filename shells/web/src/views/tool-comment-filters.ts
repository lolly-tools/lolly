// SPDX-License-Identifier: MPL-2.0
/**
 * Which review threads the comments list shows, and which of them are unread for the
 * signed-in person. Read marks come from the host; marks made in this tab apply at once
 * and give way to the host's own marks as soon as those catch up.
 */
import type { CommentThread } from '@lolly-tools/core/canvas-review-v1';
import type { CommentListResult } from '../lib/canvas-comments.ts';
import { t, tRaw } from '../i18n.ts';
import { mentionsOf } from './tool-comment-mentions.ts';

export type CommentFilter = 'open' | 'resolved' | 'unread' | 'involving';
export const COMMENT_FILTERS: readonly CommentFilter[] = ['open', 'resolved', 'unread', 'involving'];

const time = (iso: string | undefined): number | undefined => {
  const value = iso === undefined ? Number.NaN : Date.parse(iso);
  return Number.isFinite(value) ? value : undefined;
};

/** The newest message of a thread, by anyone: what a person has seen once the thread is open. */
export function newestMessage(thread: CommentThread): { at: number; iso: string } | undefined {
  let newest: { at: number; iso: string } | undefined;
  for (const message of thread.messages) {
    const at = time(message.createdAt);
    if (at !== undefined && (!newest || at > newest.at)) newest = { at, iso: message.createdAt };
  }
  return newest;
}

/** True when `me` started the thread, wrote in it, or is mentioned in a message still there. */
export function threadInvolves(thread: CommentThread, me: string): boolean {
  return !!me && (thread.authorId === me || thread.messages.some(message => message.authorId === me
    || !message.deletedAt && mentionsOf(message).some(person => person.id === me)));
}

export type CommentReads = ReturnType<typeof createCommentReads>;
/**
 * Unread state. A thread is unread when a message by someone else, still present, is newer
 * than the person's mark for that thread (or the document's read floor), or when an inbox
 * notice is waiting for the thread. Off unless the host reports read marks and can store them.
 */
export function createCommentReads() {
  let enabled = false, floor = 0, reads: Record<string, string> = {}, notices = new Set<string>();
  const local = new Map<string, number>();
  const mark = (id: string): number => Math.max(time(reads[id]) ?? floor, local.get(id) ?? Number.NEGATIVE_INFINITY);
  return {
    get enabled() { return enabled; },
    apply(result: CommentListResult, canMark: boolean): void {
      const readFloor = time(result.readFloor);
      enabled = canMark && result.features?.reads === true && readFloor !== undefined;
      floor = readFloor ?? 0; reads = enabled && result.reads ? result.reads : {};
      notices = new Set(enabled ? result.notices ?? [] : []);
      for (const [id, at] of local) if ((time(reads[id]) ?? Number.NEGATIVE_INFINITY) >= at) local.delete(id);
    },
    unread(thread: CommentThread, me: string): boolean {
      if (!enabled) return false;
      if (notices.has(thread.id) && !local.has(thread.id)) return true;
      const seen = mark(thread.id);
      return thread.messages.some(message => !message.deletedAt && message.authorId !== me && (time(message.createdAt) ?? 0) > seen);
    },
    /** Count `thread` as read up to its newest message in this tab, before the host confirms. */
    markLocal(thread: CommentThread): void {
      local.set(thread.id, newestMessage(thread)?.at ?? Date.now()); notices.delete(thread.id);
    },
    /** Drop this tab's marks for `ids` after the host refused them; the next list restores the truth. */
    forget(ids: readonly string[]): void { for (const id of ids) local.delete(id); },
  };
}

export function matchesFilter(thread: CommentThread, filter: CommentFilter, me: string, reads: CommentReads): boolean {
  switch (filter) {
    case 'open': return !thread.resolvedAt;
    case 'resolved': return !!thread.resolvedAt;
    case 'unread': return reads.unread(thread, me);
    case 'involving': return threadInvolves(thread, me);
  }
}

/** The empty-list sentence for a filter that matches nothing while the document has threads. */
export function emptyFilterText(filter: CommentFilter): string {
  switch (filter) {
    case 'open': return t('No open threads.');
    case 'resolved': return t('No resolved threads.');
    case 'unread': return t('No unread threads.');
    case 'involving': return t('No threads involve you yet.');
  }
}

function filterLabel(filter: CommentFilter): string {
  switch (filter) {
    case 'open': return tRaw('Open threads');
    case 'resolved': return tRaw('Resolved threads');
    case 'unread': return tRaw('Unread');
    case 'involving': return tRaw('Involving me');
  }
}

/** A segmented control (one radio group) choosing the filter; arrow keys move between segments. */
export function mountCommentFilters(doc: Document, onChange: (filter: CommentFilter) => void) {
  const group = doc.createElement('div'); group.className = 'collab-comment-filters'; group.setAttribute('role', 'radiogroup');
  group.setAttribute('aria-label', t('Comment filter'));
  let value: CommentFilter = 'open';
  const segments = new Map(COMMENT_FILTERS.map(filter => {
    const segment = doc.createElement('button'); segment.type = 'button'; segment.className = 'collab-comment-filter';
    segment.setAttribute('role', 'radio'); segment.dataset.filter = filter;
    segment.addEventListener('click', () => { choose(filter); });
    group.append(segment);
    return [filter, segment] as const;
  }));
  function choose(filter: CommentFilter): void {
    const changed = filter !== value; value = filter;
    for (const [key, segment] of segments) { segment.setAttribute('aria-checked', String(key === value)); segment.tabIndex = key === value ? 0 : -1; }
    if (changed) onChange(filter);
  }
  group.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const shown = COMMENT_FILTERS.filter(filter => !segments.get(filter)!.hidden), at = shown.indexOf(value);
    const rtl = doc.defaultView?.getComputedStyle(group).direction === 'rtl';
    const step = event.key === 'ArrowDown' || event.key === (rtl ? 'ArrowLeft' : 'ArrowRight') ? 1
      : event.key === 'ArrowUp' || event.key === (rtl ? 'ArrowRight' : 'ArrowLeft') ? -1 : 0;
    const next = event.key === 'Home' ? shown[0] : event.key === 'End' ? shown.at(-1) : step ? shown[(at + step + shown.length) % shown.length] : undefined;
    if (!next) return;
    event.preventDefault(); choose(next); segments.get(next)!.focus();
  });
  return {
    element: group,
    get value() { return value; },
    choose,
    /** Repaint counts; the Unread segment shows only while unread state is available. */
    paint(counts: Record<CommentFilter, number>, unreadOn: boolean): void {
      for (const [filter, segment] of segments) {
        segment.hidden = filter === 'unread' && !unreadOn;
        const text = tRaw('{label} · {count}', { label: filterLabel(filter), count: counts[filter] });
        if (segment.textContent !== text) segment.textContent = text;
        segment.setAttribute('aria-checked', String(filter === value)); segment.tabIndex = filter === value ? 0 : -1;
      }
    },
  };
}

/** The Comments button states how many threads are unread, as a badge and in its name. */
export function paintUnreadCount(open: HTMLButtonElement, count: number): void {
  const label = count ? tRaw('Comments, {count} unread', { count }) : tRaw('Comments');
  if (open.getAttribute('aria-label') !== label) { open.setAttribute('aria-label', label); open.title = label; }
  const hidden = open.querySelector<HTMLElement>('.visually-hidden');
  if (hidden && hidden.textContent !== label) hidden.textContent = label;
  let badge = open.querySelector<HTMLElement>('.collab-comments-badge');
  if (!count) { badge?.remove(); return; }
  if (!badge) { badge = open.ownerDocument.createElement('span'); badge.className = 'collab-comments-badge'; badge.setAttribute('aria-hidden', 'true'); open.append(badge); }
  badge.textContent = count > 99 ? '99+' : String(count);
}
