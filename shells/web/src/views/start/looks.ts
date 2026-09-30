// SPDX-License-Identifier: MPL-2.0
/** Browse and compare local systems without changing the active one. */
import { mountModal } from '../../components/modal.ts';
import { t, tRaw } from '../../i18n.ts';
import { isTauriShell } from '../../lib/instance-choice.ts';
import { escape as escapeText } from '../../utils.ts';
import { brandFontStack } from '../../brand-vars.ts';
import { brandSpecimenHtml } from '../../lib/design-system/brand-specimen.ts';
import { readLocalLooks, rankLocalLooks, lookTags, type LocalLook } from '../../lib/design-system/look-library.ts';
import { switchDesignSystem } from '../../lib/design-system/switch.ts';
import { styleEvidenceHtml } from '../../lib/design-system/style-evidence-view.ts';
import { saveBlob } from '../../pro/zip.ts';
import { adoptionOf } from '../../lib/design-system/adoption-material.ts';
import { bindOp, type StartCtx } from './context.ts';

function specimen(look: LocalLook): string {
  const colors = look.context.colors;
  const semantic = ['primary', 'surface', 'text'].flatMap(role => colors.filter(c => c.path === `color.semantic.${role}`).map(c => c.value));
  const font = brandFontStack(look.context.fonts[0]?.value, 'inherit') ?? 'inherit';
  return brandSpecimenHtml(look.name, { font, colors: semantic.length ? semantic : colors.slice(0, 6).map(c => c.value) }, false, false);
}

export async function openLooks(start: StartCtx): Promise<void> {
  if (start.looksModal) return;
  start.adoptionReviewBase = adoptionOf(start.host)?.capture().catch(error => error instanceof Error ? error : new Error(String(error)));
  const modal = mountModal(`<header class="start-import-head"><h2 class="modal-title">${t('Find a look')}</h2><button type="button" class="be-btn" data-looks-close>${t('Close')}</button></header>
    <p>${t('Compare saved design systems and a few starting points. Nothing changes until you choose Use.')}</p>
    <p role="status" data-looks-status>${t('Loading design systems…')}</p><div data-looks-body></div>`, {
    className: 'modal start-import-modal ds-looks-modal', ariaLabel: t('Find a look'),
    onClose: () => { start.looksModal = null; },
  });
  start.looksModal = modal;
  modal.el.querySelector('[data-looks-close]')?.addEventListener('click', () => modal.close());
  const status = modal.el.querySelector<HTMLElement>('[data-looks-status]')!;
  try {
    const host = start.host;
    const result = await readLocalLooks(host);
    if (!modal.el.isConnected) return;
    const activeId = await host.designSystems.activeId();
    const active = result.looks.find(look => look.id === activeId);
    const body = modal.el.querySelector<HTMLElement>('[data-looks-body]')!;
    body.innerHTML = `<div class="ds-looks-filters"><label class="field-label">${t('Search looks')}<input type="search" class="field-input" maxlength="160" data-looks-search placeholder="${escapeText(t('Name, colour tag or font'))}"></label>
      <label class="ds-reference-choice"><input type="checkbox" class="field-check" data-looks-similar>${t('Closest to my current palette')}</label></div>
      <p class="ds-src-stage-note">${t('Examples use your current fonts when applied. Saved systems keep their own declared fonts.')}</p>
      <div class="ds-looks-grid" data-looks-grid></div><section data-looks-compare tabindex="-1" hidden></section><footer class="ds-looks-selection" hidden><button type="button" class="be-btn" data-looks-review></button></footer>`;
    status.textContent = result.unavailable ? tRaw('{n} saved systems could not be previewed. Open them from Profile to manage them.', { n: result.unavailable }) : '';
    const search = body.querySelector<HTMLInputElement>('[data-looks-search]')!;
    const similar = body.querySelector<HTMLInputElement>('[data-looks-similar]')!;
    const grid = body.querySelector<HTMLElement>('[data-looks-grid]')!;
    const compare = body.querySelector<HTMLElement>('[data-looks-compare]')!;
    const selected = new Set<string>();
    const selection = body.querySelector<HTMLElement>('.ds-looks-selection')!;
    const review = body.querySelector<HTMLButtonElement>('[data-looks-review]')!;
    review.addEventListener('click', () => { compare.scrollIntoView({ block: 'start' }); compare.focus({ preventScroll: true }); });
    let busy = false;
    const comparePaint = (): void => {
      const choices = result.looks.filter(look => selected.has(look.id));
      compare.hidden = choices.length === 0;
      selection.hidden = choices.length === 0;
      review.textContent = choices.length === 1 ? t('Review this look') : t('Compare these two looks');
      compare.innerHTML = `<h3>${t('Compare looks')}</h3><div class="ds-looks-comparison">${choices.map(look => `<article data-look-detail="${escapeText(look.id)}">
        <h4>${escapeText(look.name)}</h4>${specimen(look)}
        <p>${look.source === 'saved' ? (isTauriShell() ? t('Saved on this device') : t('Saved in this browser')) : t('Reusable Lolly example')}</p>
        <p>${escapeText(look.context.fonts.map(f => f.value).join(' · ') || t('Your current fonts'))}</p>
        <button type="button" class="be-cta is-active" data-look-use="${escapeText(look.id)}" ${look.id === activeId ? 'disabled' : ''}>${look.id === activeId ? t('Active') : look.source === 'saved' ? t('Use this saved system') : t('Use these colours')}</button>
        ${look.source === 'example' ? `<p class="ds-src-stage-note">${t('Replaces the active colours and style settings. Restore brand settings recovers the previous version.')}</p>` : ''}
        <details class="ds-reference-details"><summary>${t('Details and design context')}</summary>
          ${look.context.styles ? styleEvidenceHtml(look.context.styles) : `<p>${t('No source style observations are recorded.')}</p>`}
          ${look.source === 'saved' ? `<label class="field-label">${t('Search tags')}<input class="field-input" maxlength="240" data-look-tags value="${escapeText(look.tags.join(', '))}"></label><button type="button" class="be-btn" data-look-save-tags="${escapeText(look.id)}">${t('Save tags')}</button>` : `<p>${escapeText(look.tags.join(', '))}</p>`}
          <button type="button" class="be-btn" data-look-context="${escapeText(look.id)}">${t('Download design context')}</button>
        </details></article>`).join('')}</div>`;
    };
    const paint = (): void => {
      const found = rankLocalLooks(result.looks, search.value, similar.checked ? active : undefined);
      grid.innerHTML = found.length ? found.map(look => `<label class="ds-look-option ${selected.has(look.id) ? 'is-selected' : ''}">
        <input type="checkbox" class="field-check" data-look-select="${escapeText(look.id)}" ${selected.has(look.id) ? 'checked' : ''}>
        <span>${escapeText(look.name)}</span>${specimen(look)}<span class="ds-src-stage-note">${escapeText(look.tags.join(' · '))}</span>
      </label>`).join('') : `<p>${t('No matching looks. Try a different name, tag or font.')}</p>`;
    };
    search.addEventListener('input', paint);
    similar.addEventListener('change', paint);
    grid.addEventListener('change', event => {
      const input = event.target as HTMLInputElement;
      const id = input.dataset.lookSelect;
      if (!id) return;
      if (input.checked && selected.size >= 2) { input.checked = false; status.textContent = t('Compare two looks at a time. Deselect one to choose another.'); return; }
      if (input.checked) selected.add(id); else selected.delete(id);
      input.closest('.ds-look-option')?.classList.toggle('is-selected', input.checked);
      status.textContent = selected.size === 0 ? '' : selected.size === 1
        ? t('One look selected. Its preview is below the list.')
        : t('Two looks selected. Their comparison is below the list.');
      comparePaint();
    });
    compare.addEventListener('click', async event => {
      const button = (event.target as Element).closest<HTMLButtonElement>('button');
      if (!button || busy) return;
      const id = button.dataset.lookUse ?? button.dataset.lookContext ?? button.dataset.lookSaveTags;
      const look = result.looks.find(l => l.id === id);
      if (!look) return;
      busy = true;
      button.disabled = true;
      try {
        if (button.hasAttribute('data-look-use')) {
          if (look.source === 'saved') await switchDesignSystem(host, look.id, { route: 'start' });
          else await start.tokens.install(look.doc, look.name, button, { area: 'overview', requireCheckpoint: true, onError: message => { status.textContent = message; }, onInstalled: () => modal.close() });
        } else if (button.hasAttribute('data-look-context')) {
          await saveBlob(new Blob([JSON.stringify(look.context, null, 2)], { type: 'application/json' }), 'lolly-design-context.json');
        } else {
          const record = await host.designSystems.get(look.id);
          if (!record) throw new Error(t('This saved system is no longer available.'));
          const tags = lookTags(button.closest('article')?.querySelector<HTMLInputElement>('[data-look-tags]')?.value.split(','));
          await host.designSystems.put({ ...record, tags });
          look.tags = tags;
          status.textContent = t('Tags saved.');
          paint();
        }
      } catch { status.textContent = t('Could not complete this action. Please try again.'); }
      finally { busy = false; button.disabled = false; }
    });
    paint();
    search.focus();
  } catch { status.textContent = t('Saved systems could not be loaded. Close this window and try again.'); }
}
export function looksOps(start: StartCtx) { return { openLooks: bindOp(start, openLooks) }; }
