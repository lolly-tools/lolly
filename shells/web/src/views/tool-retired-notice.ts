// SPDX-License-Identifier: MPL-2.0
/**
 * What a person sees when they open a tool that has moved into another one: a line
 * at the head of the tool's controls saying where the work now lives, with a link
 * that opens this document there (lib/tool-successors.ts carries what can be
 * carried). The retired tool keeps working, so the line only informs.
 *
 * Drawn on the page, not in the notifications list: a person who followed an old
 * link needs to see this before they start work, and the list is two presses away.
 */
import { successorHref } from '../lib/tool-successors.ts';
import { tRaw } from '../i18n.ts';

export function mountRetiredToolNotice(opts: {
  /** Where the line goes: the head of the tool's controls. */
  body: HTMLElement;
  toolId: string;
  name: string;
  successorId: string;
  successorName: string;
  /** The document's values now, read when the person asks to move. */
  values(): Record<string, unknown>;
  open(href: string): void;
}): () => void {
  const doc = opts.body.ownerDocument;
  const el = doc.createElement('div');
  el.className = 'tool-notice tool-notice--info';
  el.id = 'retired-tool-notice';
  el.setAttribute('role', 'status');
  const text = doc.createElement('span');
  text.className = 'tool-notice-text';
  text.textContent = tRaw('{name} is now part of {successor}.', { name: opts.name, successor: opts.successorName });
  const go = doc.createElement('button');
  go.type = 'button';
  go.className = 'tool-notice-link';
  go.textContent = tRaw('Open in {successor}', { successor: opts.successorName });
  go.addEventListener('click', () => opts.open(successorHref(opts.toolId, opts.successorId, opts.values())));
  text.append(' ', go);
  el.append(text);
  opts.body.prepend(el);
  return () => el.remove();
}
