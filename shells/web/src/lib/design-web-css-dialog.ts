// SPDX-License-Identifier: MPL-2.0
import { mountModal } from '../components/modal.ts';
import { t } from '../i18n.ts';
import { mountCssEditor } from './css-code-editor.ts';
import { compileWebCss, WEB_CSS_LIMIT } from './design-web-css.ts';
import '../styles/parts/design-web-css.css';

/** Cancel leaves the object intact; Apply writes one undoable object edit. */
export function editWebCss(value: string): Promise<string | null> {
  return new Promise(resolve => {
    let destroyEditor: (() => void) | undefined;
    const modal = mountModal<string | null>(
      `<h2>${t('Page CSS')}</h2>`
      + `<p>${t('Changes the live page in this object and in presentation. The poster used for exports stays as chosen. Imports, fonts and resource URLs are not supported.')}</p>`
      + '<div class="web-css-editor"></div><p class="web-css-error" role="alert"></p>'
      + `<div class="modal-actions"><button type="button" class="btn" data-web-css-cancel>${t('Cancel')}</button>`
      + `<button type="button" class="btn btn--primary" data-web-css-apply>${t('Apply')}</button></div>`,
      { className: 'modal web-css-dialog', ariaLabel: t('Page CSS'), cancelValue: null,
        onClose(result) { destroyEditor?.(); resolve(result ?? null); } },
    );
    const editor = mountCssEditor(modal.el.querySelector<HTMLElement>('.web-css-editor')!, {
      value, ariaLabel: t('Page CSS'), placeholder: '#onetrust-banner-sdk { display: none !important; }',
    });
    destroyEditor = () => editor.destroy();
    const textarea = modal.el.querySelector('textarea')!;
    textarea.maxLength = WEB_CSS_LIMIT;
    textarea.setSelectionRange(0, 0);
    modal.el.querySelector('[data-web-css-cancel]')!.addEventListener('click', () => modal.close(null));
    modal.el.querySelector('[data-web-css-apply]')!.addEventListener('click', () => {
      try { compileWebCss(editor.getValue()); modal.close(editor.getValue()); }
      catch (error) {
        modal.el.querySelector<HTMLElement>('.web-css-error')!.textContent = error instanceof Error ? error.message : t('Check the CSS rules.');
      }
    });
    editor.focus();
  });
}
