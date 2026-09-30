// SPDX-License-Identifier: MPL-2.0
import { mountBodyPopover } from '../components/body-popover.ts';
import { t } from '../i18n.ts';

/** Keep the original export pipeline, permissions and delivery feedback. */
export function mountLockedActions(view: HTMLElement, actions: HTMLElement, formats: string[], reset: () => void): () => void {
  const bar = document.createElement('div'); bar.className = 'locked-actions';
  const primary = document.createElement('button'); primary.type = 'button'; primary.className = 'btn btn--primary';
  const original = actions.querySelector<HTMLElement>('[data-action="download"],[data-action="request-approval"]');
  const sourceFormat = actions.querySelector<HTMLSelectElement>('[data-action="format"]');
  const format = document.createElement('select'); format.className = 'field-select'; format.setAttribute('aria-label', t('Download format'));
  for (const value of formats) { const option = document.createElement('option'); option.value = value; option.textContent = value.toUpperCase(); format.append(option); }
  const sync = (): void => {
    format.value = sourceFormat?.value || formats[0] || '';
    primary.textContent = original?.hasAttribute('aria-busy') ? original.textContent : original?.dataset.action === 'request-approval' ? t('Request approval') : t('Download {format}', { format: format.value.toUpperCase() });
    primary.disabled = !original || original.hasAttribute('disabled') || original.getAttribute('aria-disabled') === 'true';
    primary.setAttribute('aria-busy', String(original?.getAttribute('aria-busy') === 'true'));
  };
  format.addEventListener('change', () => { if (sourceFormat) { sourceFormat.value = format.value; sourceFormat.dispatchEvent(new Event('change', { bubbles: true })); } sync(); });
  primary.addEventListener('click', () => { if (!primary.disabled) original?.click(); });
  const more = document.createElement('button'); more.type = 'button'; more.className = 'btn'; more.textContent = t('More');
  const parking = document.createElement('div'); parking.hidden = true; view.append(parking);
  const moved: Array<{ node: HTMLElement; home: Comment }> = [];
  for (const node of view.querySelectorAll<HTMLElement>('#multi-edit-btn,#templates-btn,#bulk-rows-btn,#bulk-files-btn')) {
    const home = document.createComment('Recipient action'); node.replaceWith(home); parking.append(node); moved.push({ node, home });
  }
  const menu = mountBodyPopover(more, el => {
    el.replaceChildren();
    const action = (label: string, run: () => void): void => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'btn btn--ghost'; button.textContent = label;
      button.addEventListener('click', () => { menu.close(); run(); }); el.append(button);
    };
    for (const { node } of moved) if (!node.hidden) action(node.getAttribute('aria-label') || '', () => node.click());
    action(t('Reset inputs'), reset);
    for (const node of view.querySelectorAll<HTMLButtonElement>('.history-controls .history-btn')) if (!node.disabled) action(node.getAttribute('aria-label') || '', () => node.click());
    const home = view.querySelector<HTMLElement>('.sidebar-back'); if (home) action(t('Home'), () => home.click());
    if (view.querySelector('#render-save')) action(t('Save'), () => view.querySelector<HTMLElement>('#render-save')?.click());
    action(t('Export options'), () => view.querySelector<HTMLElement>('#render-fab')?.click());
    return el.querySelector<HTMLElement>('button');
  }, { className: 'folder-menu locked-actions-menu', ariaLabel: t('More actions') });
  more.addEventListener('click', () => { if (menu.isOpen()) menu.close(true); else menu.open(); });
  if (original) { if (sourceFormat && formats.length > 1) bar.append(format); bar.append(primary); }
  bar.append(more); view.append(bar);
  const feedback = document.createElement('div'); feedback.className = 'locked-delivery'; feedback.setAttribute('role', 'status'); bar.append(feedback);
  const refresh = (): void => {
    sync();
    const source = actions.querySelector<HTMLElement>('[data-export-delivery]:not([hidden]),.export-blocked-note');
    if (feedback.textContent !== source?.textContent) {
      feedback.replaceChildren();
      if (source) {
        const copy = source.cloneNode(true) as HTMLElement; copy.removeAttribute('role');
        const buttons = [...source.querySelectorAll<HTMLElement>('button,a')];
        copy.querySelectorAll<HTMLElement>('button,a').forEach((button, index) => { button.addEventListener('click', e => { e.preventDefault(); buttons[index]?.click(); }); });
        feedback.append(copy);
      }
    }
  };
  const observer = new MutationObserver(refresh); observer.observe(actions, { subtree: true, childList: true, characterData: true, attributes: true }); refresh();
  return () => { observer.disconnect(); menu.close(); bar.remove(); for (const { node, home } of moved) home.replaceWith(node); parking.remove(); };
}
