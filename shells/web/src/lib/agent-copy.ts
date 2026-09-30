// SPDX-License-Identifier: MPL-2.0
/**
 * The landing's "AI Instructions" pill: one control with three icons. A click on the
 * pill copies the instructions; the icons copy, view them in a modal and download
 * them. The text rides on the pill itself (`data-agent-text`, filled by the docs build
 * from docs/agents-pages.ts buildAgentInstructions, the same text served as
 * /info/agent-instructions.md), so every action works without the network and a copy
 * happens inside the click, and an attribute stays out of the page text that search
 * and narration read. One module for both readers: docs/build.ts bundles it into the
 * static page, and the in-app reader (lib/docs-landing.ts) calls it on the fragment
 * it adopts.
 *
 * Copy feedback replaces the label for a moment and goes to the pill's live region.
 * When the browser has no clipboard the pill says so; View and Download are the
 * manual routes. The modal is a native dialog (Escape closes it, focus returns to the
 * eye), created on open and removed on close, inside the pill's own container so the
 * in-app reader's scoped landing styles apply to the dialog.
 */

import { mountModal } from '../components/modal.ts';
import { anchorSave } from '../bridge/anchor-save.ts';
import { getHostRef } from './host-ref.ts';

const RESET_MS = 2400;

type WriteText = (text: string) => Promise<void>;
type Action = 'copy' | 'view' | 'download';

const clipboardWrite: WriteText = (text) =>
  typeof navigator !== 'undefined' && navigator.clipboard?.writeText
    ? navigator.clipboard.writeText(text)
    : Promise.reject(new Error('unavailable'));

export interface AgentCopyOptions {
  writeText?: WriteText;
  /** Saves `text` as `filename`. Replaced in tests, where there is no download. */
  save?: (text: string, filename: string, doc: Document) => void | Promise<void>;
}

async function saveFile(text: string, filename: string, doc: Document): Promise<void> {
  const view = doc.defaultView;
  if (!view) return;
  const blob = new view.Blob([text], { type: 'text/markdown;charset=utf-8' });
  const host = getHostRef();
  if (host?.export.download) await host.export.download(blob, filename);
  else anchorSave(blob, filename);
}

/** An icon button for the dialog header, cloned from the pill's own so the glyph and
 *  the translated tip are the same. */
function cloneAction(pill: HTMLElement, action: Action): HTMLElement | null {
  const source = pill.querySelector<HTMLElement>(`.agent-pill-icon[data-agent-action="${action}"]`);
  if (!source) return null;
  const btn = pill.ownerDocument.createElement('button');
  btn.type = 'button';
  btn.className = 'agent-pill-icon';
  btn.dataset.agentAction = action;
  for (const name of ['data-tip', 'aria-label']) {
    const value = source.getAttribute(name);
    if (value) btn.setAttribute(name, value);
  }
  btn.replaceChildren(...[...source.childNodes].map(node => node.cloneNode(true)));
  return btn;
}

function openDialog(pill: HTMLElement, text: string, act: (action: Action) => void): void {
  const doc = pill.ownerDocument;
  const host = pill.parentElement ?? doc.body;
  host.querySelector<HTMLDialogElement>('dialog.agent-dialog')?.close();
  const modal = mountModal('', { className: 'agent-dialog', container: host });
  const dialog = modal.el;
  const titleId = `agent-dialog-title-${Math.random().toString(36).slice(2, 8)}`;
  dialog.setAttribute('aria-labelledby', titleId);

  const head = doc.createElement('div');
  head.className = 'agent-dialog-head';
  const title = doc.createElement('h2');
  title.id = titleId;
  title.textContent = pill.dataset.title || 'AI Instructions';
  const tools = doc.createElement('div');
  tools.className = 'agent-dialog-tools';
  for (const action of ['copy', 'download'] as const) {
    const btn = cloneAction(pill, action);
    if (btn) tools.appendChild(btn);
  }
  const close = doc.createElement('button');
  close.type = 'button';
  close.className = 'agent-pill-icon agent-dialog-close';
  close.setAttribute('aria-label', pill.dataset.close || 'Close');
  close.dataset.tip = pill.dataset.close || 'Close';
  close.innerHTML = pill.dataset.closeIcon || '×';
  tools.appendChild(close);
  head.append(title, tools);

  const status = doc.createElement('p');
  status.className = 'agent-dialog-status';
  status.setAttribute('aria-live', 'polite');

  const body = doc.createElement('pre');
  body.className = 'agent-dialog-body';
  body.tabIndex = 0;
  // Focus starts on the text, so arrow keys scroll it and no header tip pops up.
  body.setAttribute('autofocus', '');
  body.textContent = text;
  dialog.append(head, status, body);
  body.focus();

  dialog.addEventListener('click', (event) => {
    const target = event.target as Element;
    if (target.closest('.agent-dialog-close')) { modal.close(); return; }
    const action = target.closest<HTMLElement>('[data-agent-action]')?.dataset.agentAction;
    if (action === 'copy' || action === 'download') act(action);
  });
}

export function wireAgentCopy(root: ParentNode, opts: AgentCopyOptions = {}): void {
  const writeText = opts.writeText ?? clipboardWrite;
  const save = opts.save ?? saveFile;
  for (const pill of root.querySelectorAll<HTMLElement>('[data-agent-pill]')) {
    if (pill.dataset.agentWired) continue;
    pill.dataset.agentWired = '1';
    const label = pill.querySelector<HTMLElement>('.agent-copy-label');
    const idle = label?.textContent ?? '';
    const live = pill.querySelector<HTMLElement>('.agent-copy-status');
    let timer: ReturnType<typeof setTimeout> | undefined;
    const say = (text: string, state: 'done' | 'failed'): void => {
      if (label) label.textContent = text;
      pill.dataset.state = state;
      if (live) live.textContent = text;
      // An open dialog says it too, since the pill is behind the backdrop.
      const inDialog = pill.parentElement?.querySelector<HTMLElement>('.agent-dialog-status');
      if (inDialog) inDialog.textContent = text;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (label) label.textContent = idle;
        delete pill.dataset.state;
        if (live) live.textContent = '';
        const stillOpen = pill.parentElement?.querySelector<HTMLElement>('.agent-dialog-status');
        if (stillOpen) stillOpen.textContent = '';
      }, RESET_MS);
    };

    const act = (action: Action): void => {
      const text = pill.dataset.agentText ?? '';
      if (!text) return;
      if (action === 'view') { openDialog(pill, text, act); return; }
      if (action === 'download') {
        void Promise.resolve(save(text, pill.dataset.filename || 'lolly-ai-instructions.md', pill.ownerDocument))
          .catch(() => say('Download did not work', 'failed'));
        return;
      }
      let write: Promise<void>;
      try { write = writeText(text); } catch (error) { write = Promise.reject(error); }
      write.then(
        () => say(pill.dataset.copied || 'Copied', 'done'),
        () => say(pill.dataset.failed || 'Copy did not work', 'failed'),
      );
    };

    // Anywhere on the pill copies, except the view and download icons.
    pill.addEventListener('click', (event) => {
      const target = event.target as Element;
      const action = (target.closest<HTMLElement>('[data-agent-action]')?.dataset.agentAction ?? 'copy') as Action;
      // Download is a real link, so it works with scripts off. With scripts on, the
      // file is written from the same text as the copy, with no request.
      if (action === 'download') event.preventDefault();
      act(action);
    });
  }
}
