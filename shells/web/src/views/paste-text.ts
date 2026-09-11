// SPDX-License-Identifier: MPL-2.0
/**
 * Paste text - type or paste text and save it as a first-class TEXT asset in
 * "Your uploads", exactly as if a .txt/.md file had been dropped: the same
 * storeUserUpload path classifies it, keeps the real bytes verbatim, and runs
 * the ingest-time AI-signal analysis so the note travels with the asset.
 *
 * A host-owned modal in the script-audio mould (same overlay classes, same
 * Escape/backdrop/nav teardown, nested focus trap), opened lazily from the
 * catalog's "Your uploads" section. Built with DOM nodes only - no raw-HTML
 * sink - because every string here is static chrome copy.
 */

import '../styles/script-audio.css';   // the shared overlay/panel look (lazy chunk)
import { trapFocus, type FocusTrap } from '../lib/focus-trap.ts';
import { NAV_EVENTS } from '../utils.ts';
import { t } from '../i18n.ts';
import { storeUserUpload, type PickerHost } from './picker.ts';
import type { AssetRef } from '@lolly-tools/core/host-v1';

/** Lines that read as Markdown STRUCTURE (heading, fence, bold, link, list). */
const MD_SHAPE = /^#{1,6}\s|^```|\*\*[^*\n]+\*\*|\[[^\]]+\]\([^)]+\)|^[ \t]*[-*+][ \t]+\S/m;

/**
 * The file a paste becomes: markdown-shaped text saves as .md (so the catalog
 * preview and any markdown consumer treat it right), anything else as .txt.
 * `name` is the user's label, slugged; empty falls back to 'pasted-text'.
 * Pure and exported for its test.
 */
export function pastedTextFile(name: string, text: string): { fileName: string; mime: string } {
  const slug = name.trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'pasted-text';
  const md = MD_SHAPE.test(text);
  return { fileName: `${slug}.${md ? 'md' : 'txt'}`, mime: md ? 'text/markdown' : 'text/plain' };
}

/** el() - the tiny DOM builder this dialog uses instead of an innerHTML sink. */
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, className?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Open the dialog; resolves with the stored AssetRef, or null when the user
 * backs out (Escape, backdrop, ×, Cancel, or a route change).
 */
export function openPasteTextDialog(host: PickerHost): Promise<AssetRef | null> {
  return new Promise((resolve) => {
    let trap: FocusTrap | undefined;
    let saving = false;

    const overlay = el('div', 'script-audio-overlay');
    const backdrop = el('div', 'script-audio-backdrop');
    backdrop.setAttribute('aria-hidden', 'true');
    const panel = el('div', 'script-audio-panel');
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.setAttribute('aria-label', t('Paste text'));

    const head = el('header', 'script-audio-head');
    head.appendChild(el('span', undefined, t('Paste text')));
    const closeBtn = el('button', 'script-audio-close', '×');
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', t('Close'));
    head.appendChild(closeBtn);

    const body = el('div', 'script-audio-body');
    const nameLabel = el('label', 'script-audio-label', t('Name'));
    nameLabel.htmlFor = 'paste-text-name';
    const nameInput = el('input', 'field-input');
    nameInput.id = 'paste-text-name';
    nameInput.type = 'text';
    nameInput.placeholder = t('Pasted text');
    const textLabel = el('label', 'script-audio-label', t('Text'));
    textLabel.htmlFor = 'paste-text-body';
    const textarea = el('textarea', 'field-input script-audio-text');
    textarea.id = 'paste-text-body';
    textarea.rows = 10;
    textarea.placeholder = t('Type or paste text or Markdown. It is stored verbatim as a text asset and analysed for AI-writing signals on the way in.');
    const hint = el('p', 'script-audio-consent', t('Markdown-shaped text saves as .md, anything else as .txt.'));
    body.append(nameLabel, nameInput, textLabel, textarea, hint);

    const actions = el('footer', 'script-audio-actions');
    const cancelBtn = el('button', 'script-audio-cancel', t('Cancel'));
    cancelBtn.type = 'button';
    const saveBtn = el('button', 'script-audio-save', t('Save to your uploads'));
    saveBtn.type = 'button';
    saveBtn.disabled = true;
    actions.append(cancelBtn, saveBtn);

    panel.append(head, body, actions);
    overlay.append(backdrop, panel);
    document.body.appendChild(overlay);
    const opener = document.activeElement;

    const cleanup = (): void => {
      trap?.release();
      document.removeEventListener('keydown', onKey);
      NAV_EVENTS.forEach((ev) => window.removeEventListener(ev, onNav));
      overlay.remove();
      if (opener instanceof HTMLElement) opener.focus();
    };
    const done = (val: AssetRef | null): void => { cleanup(); resolve(val); };
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.preventDefault(); done(null); } };
    const onNav = (): void => done(null);
    document.addEventListener('keydown', onKey);
    NAV_EVENTS.forEach((ev) => window.addEventListener(ev, onNav));
    backdrop.addEventListener('click', () => done(null));
    closeBtn.addEventListener('click', () => done(null));
    cancelBtn.addEventListener('click', () => done(null));
    textarea.addEventListener('input', () => { saveBtn.disabled = textarea.value.trim().length === 0; });

    saveBtn.addEventListener('click', () => {
      void (async () => {
        if (saving || !textarea.value.trim()) return;
        saving = true;
        saveBtn.disabled = true;
        const orig = saveBtn.textContent;
        saveBtn.textContent = t('Saving…');
        try {
          const { fileName, mime } = pastedTextFile(nameInput.value, textarea.value);
          const ref = await storeUserUpload(host, new File([textarea.value], fileName, { type: mime }));
          done(ref);
        } catch {
          // The upload failed - reopen the button so the text is not lost.
          saving = false;
          saveBtn.disabled = false;
          saveBtn.textContent = orig;
          hint.textContent = t('Saving failed. Your text is still here, try again.');
        }
      })();
    });

    trap = trapFocus(overlay, { initialFocus: textarea });
  });
}
