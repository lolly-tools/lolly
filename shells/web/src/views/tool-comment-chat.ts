// SPDX-License-Identifier: MPL-2.0
import { icon, type IconName } from '../lib/icons.ts';
import { collabLabelColor } from '../lib/collab-label-color.ts';
import { collabInitials } from '../components/collab-pill.ts';
import type { CollabSession } from '../lib/collab-session.ts';
import type { CollabColor } from '../lib/collab-colors.ts';
import type { CommentMessage } from '@lolly-tools/core/canvas-review-v1';
import { currentLang } from '../i18n.ts';

const controls: Record<string, IconName> = {
  'Comments': 'messageCircle', 'Close comments': 'close', 'Pin a comment': 'pin',
  'Comment on selection': 'messageCircle', 'Comment at canvas center': 'plus',
  'Show comment location': 'pin', 'Edit message': 'pen', 'Delete message': 'trash',
  'Save message': 'check', 'Cancel edit': 'close', 'Resolve thread': 'check', 'Reopen thread': 'refresh', 'Send': 'arrowRight',
};
export function commentIcon(button: HTMLButtonElement, key: string, override?: IconName): void {
  const glyph = override ?? controls[key]; if (!glyph) return;
  const label = button.textContent ?? '';
  button.setAttribute('aria-label', label); button.title = label;
  button.innerHTML = icon(glyph, { size: 18 });
  const text = button.ownerDocument.createElement('span'); text.className = 'visually-hidden'; text.textContent = label;
  button.append(text); button.classList.add('collab-comment-icon');
}

/** Cache identity colors so leaving the live roster does not recolor old replies. */
export function commentPeople(session?: CollabSession, palette: readonly CollabColor[] = []) {
  const colors = new Map<string, string>();
  return (id: string): string => {
    const state = session?.state(), person = state && [state.self, ...state.peers].find(person => person.userId === id);
    if (person?.color) colors.set(id, person.color);
    if (!colors.has(id)) {
      let hash = 0; for (const char of id) hash = (Math.imul(hash, 31) + char.codePointAt(0)!) >>> 0;
      colors.set(id, palette.length ? palette[hash % palette.length]!.hex : '#7474a0');
    }
    return colors.get(id)!;
  };
}

export function commentAvatar(doc: Document, name: string, color: string): HTMLElement {
  const avatar = doc.createElement('span'), label = collabLabelColor(color);
  avatar.className = 'collab-comment-avatar'; avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = collabInitials(name); avatar.style.background = label.fill; avatar.style.color = label.ink;
  return avatar;
}

export function commentPin(pin: HTMLButtonElement, number: number, color: string): void {
  if (pin.dataset.number !== String(number)) { pin.innerHTML = icon('messageCircle', { size: 18 }); pin.dataset.number = String(number); }
  const label = collabLabelColor(color); pin.style.background = label.fill; pin.style.color = label.ink;
}

export function commentBubble(doc: Document, message: CommentMessage, color: string, own: boolean): { article: HTMLElement; bubble: HTMLElement } {
  const article = doc.createElement('article'), bubble = doc.createElement('div'), author = doc.createElement('strong'), time = doc.createElement('time');
  article.className = 'collab-comment-message'; article.dataset.own = String(own); article.dataset.messageId = message.id;
  bubble.className = 'collab-comment-bubble'; const label = collabLabelColor(color, 90);
  bubble.style.background = label.fill; bubble.style.color = label.ink; bubble.style.setProperty('--comment-person-color', color);
  const meta = doc.createElement('header'); meta.className = 'collab-comment-meta'; author.textContent = message.authorName;
  time.dateTime = message.createdAt;
  const date = new Date(message.createdAt);
  if (Number.isFinite(date.getTime())) { time.textContent = new Intl.DateTimeFormat(currentLang(), { hour: 'numeric', minute: '2-digit' }).format(date); time.title = date.toLocaleString(currentLang()); }
  meta.append(author, time); bubble.append(meta); article.append(commentAvatar(doc, message.authorName, color), bubble);
  return { article, bubble };
}
