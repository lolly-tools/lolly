// SPDX-License-Identifier: MPL-2.0
/**
 * Find a look: browse saved systems and a few starting points without changing
 * the active one.
 *
 * A click on a look previews it in context: the same poster, chart and UI card
 * the Colours room draws (lib/palette-preview.ts), painted with that look's
 * colours and faces. Nothing is written until the person chooses Use, and every
 * card carries its own Use this look. Compare is a toggle for experts: it puts a
 * checkbox on each card and lays two looks side by side below the list.
 */
import { mountModal } from '../../components/modal.ts';
import { t, tRaw } from '../../i18n.ts';
import { isTauriShell } from '../../lib/instance-choice.ts';
import { escape as escapeText } from '../../utils.ts';
import { brandFontStack } from '../../brand-vars.ts';
import { prefersReducedMotion } from '../../lib/a11y-prefs.ts';
import { brandSpecimenHtml } from '../../lib/design-system/brand-specimen.ts';
import { readLocalLooks, rankLocalLooks, lookTags, lookTagline, lookPalette, type LocalLook } from '../../lib/design-system/look-library.ts';
import { beginRegister } from '../../lib/design-system/register.ts';
import { switchDesignSystem } from '../../lib/design-system/switch.ts';
import { styleEvidenceHtml } from '../../lib/design-system/style-evidence-view.ts';
import { LOLLY_NEUTRAL, palettePreviewSvgs } from '../../lib/palette-preview.ts';
import { segHtml } from '../../lib/seg.ts';
import { saveBlob } from '../../pro/zip.ts';
import { adoptionOf } from '../../lib/design-system/adoption-material.ts';
import '../../styles/parts/looks.css';
import { bindOp, type StartCtx } from './context.ts';

function specimen(look: LocalLook): string {
  const colors = look.context.colors;
  const semantic = ['primary', 'surface', 'text'].flatMap(role => colors.filter(c => c.path === `color.semantic.${role}`).map(c => c.value));
  const font = brandFontStack(look.context.fonts[0]?.value, 'inherit') ?? 'inherit';
  return brandSpecimenHtml(look.name, { font, colors: semantic.length ? semantic : colors.slice(0, 6).map(c => c.value) }, false, false);
}

/** The look's faces as the font roles palette-preview.ts reads. Starting points
 *  carry none, so their scenes keep the current fonts, as the note above the
 *  list says they will when applied. */
function faceVars(look: LocalLook): string {
  const fonts = look.context.fonts;
  const brand = fonts.find(f => f.path === 'font.brand') ?? fonts[0];
  const display = fonts.find(f => f.path === 'font.display') ?? brand;
  const stack = (value?: string): string | null => value ? brandFontStack(value.split(','), 'sans-serif') : null;
  const vars = [['--font-brand', stack(brand?.value)], ['--font-display', stack(display?.value)]]
    .filter(([, v]) => v).map(([k, v]) => `${k}:${v}`).join(';');
  return vars ? ` style="${escapeText(vars)}"` : '';
}

const scenes = () => [{ id: '0', label: t('Poster') }, { id: '1', label: t('Chart') }, { id: '2', label: t('UI card') }];

/** Use this look, or Active on the system already in use. */
function useButton(look: LocalLook, activeId: string | null, primary: boolean): string {
  const id = escapeText(look.id);
  if (look.id === activeId) return `<button type="button" class="be-btn" data-look-use="${id}" disabled>${t('Active')}</button>`;
  return `<button type="button" class="${primary ? 'be-cta is-active' : 'be-btn'}" data-look-use="${id}">${t('Use this look')}</button>`;
}

/** The In context pane for one look. */
export function lookPreviewHtml(look: LocalLook, scene: number, activeId: string | null): string {
  const { colors, roles } = lookPalette(look);
  const art = palettePreviewSvgs(colors.length ? colors : [...LOLLY_NEUTRAL], colors.length ? { roles } : undefined);
  // `s.svg` is markup, interpolated raw on purpose: palette-preview.ts builds it
  // from its own templates and passes every colour through its hex whitelist
  // (palette-preview.test.ts pins that against hostile strings), as the Colours
  // room's own In context does (brand-editor/derive.ts renderPreviews).
  return `<div class="ds-looks-preview-head"><h3>${t('In context')}</h3><span class="ds-looks-preview-name">${escapeText(look.name)}</span></div>
    <div class="ds-looks-scenes"${faceVars(look)}>${art.map((s, i) => `<figure class="ds-looks-scene"${i === scene ? '' : ' hidden'}>${s.svg}</figure>`).join('')}</div>
    <div class="ds-looks-preview-foot">${segHtml('looks-scene', scenes(), String(scene), t('Preview scene'), { attr: 'data-looks-scene' })}${useButton(look, activeId, true)}</div>
    ${look.source === 'example' ? `<p class="ds-src-stage-note">${t('Replaces the active colours and style settings. Restore brand settings recovers the previous version.')}</p>` : ''}`;
}

/** One look in the list: the specimen (a click previews it), its tag line, and its own Use. */
export function lookCardHtml(look: LocalLook, state: { previewId: string | null; activeId: string | null; compare: boolean; selected: ReadonlySet<string> }): string {
  const id = escapeText(look.id);
  const previewing = look.id === state.previewId;
  const chosen = state.selected.has(look.id);
  return `<article class="ds-look-card${previewing ? ' is-previewing' : ''}" data-look-card="${id}">
      <button type="button" class="ds-look-pick" data-look-preview="${id}" aria-pressed="${previewing}" aria-label="${escapeText(tRaw('Preview of {name}', { name: look.name }))}">${specimen(look)}</button>
      <p class="ds-look-tagline">${escapeText(lookTagline(look).join(' · '))}</p>
      <div class="ds-look-actions">
        ${state.compare ? `<label class="ds-look-compare"><input type="checkbox" class="field-check" data-look-select="${id}"${chosen ? ' checked' : ''}>${t('Compare')}</label>` : ''}
        ${useButton(look, state.activeId, false)}
      </div>
    </article>`;
}

export async function openLooks(start: StartCtx): Promise<void> {
  if (start.looksModal) return;
  start.adoptionReviewBase = adoptionOf(start.host)?.capture().catch(error => error instanceof Error ? error : new Error(String(error)));
  const modal = mountModal(`<header class="start-import-head"><h2 class="modal-title">${t('Find a look')}</h2><button type="button" class="be-btn" data-looks-close>${t('Close')}</button></header>
    <p>${t('Preview saved design systems and a few starting points. Nothing changes until you choose Use.')}</p>
    <p role="status" data-looks-status>${t('Loading design systems…')}</p><p class="visually-hidden" role="status" data-looks-announce></p><div data-looks-body></div>`, {
    className: 'modal start-import-modal ds-looks-modal', ariaLabel: t('Find a look'),
    onClose: () => { start.looksModal = null; },
  });
  start.looksModal = modal;
  modal.el.querySelector('[data-looks-close]')?.addEventListener('click', () => modal.close());
  const status = modal.el.querySelector<HTMLElement>('[data-looks-status]')!;
  // The look's name is already on screen in the pane's header, so the preview is announced
  // to assistive tech here without a second visible line.
  const announce = modal.el.querySelector<HTMLElement>('[data-looks-announce]')!;
  try {
    const host = start.host;
    const result = await readLocalLooks(host);
    if (!modal.el.isConnected) return;
    const activeId = (await host.designSystems.activeId()) ?? null;
    const active = result.looks.find(look => look.id === activeId);
    const body = modal.el.querySelector<HTMLElement>('[data-looks-body]')!;
    body.innerHTML = `<div class="ds-looks-filters"><label class="field-label">${t('Search looks')}<input type="search" class="field-input" maxlength="160" data-looks-search placeholder="${escapeText(t('Name, colour tag or font'))}"></label>
      <label class="ds-reference-choice"><input type="checkbox" class="field-check" data-looks-similar>${t('Closest to the current palette')}</label>
      <button type="button" class="be-btn" data-looks-compare-toggle aria-pressed="false">${t('Compare looks')}</button></div>
      <p class="ds-src-stage-note">${t('Examples use your current fonts when applied. Saved systems keep their own declared fonts.')}</p>
      <div class="ds-looks-layout"><div class="ds-looks-grid" data-looks-grid></div><section class="ds-looks-preview" data-looks-preview></section></div>
      <section data-looks-compare tabindex="-1" hidden></section><footer class="ds-looks-selection" hidden><button type="button" class="be-btn" data-looks-review></button></footer>`;
    status.textContent = result.unavailable ? tRaw('{n} saved systems could not be previewed. Open them from Profile to manage them.', { n: result.unavailable }) : '';
    const search = body.querySelector<HTMLInputElement>('[data-looks-search]')!;
    const similar = body.querySelector<HTMLInputElement>('[data-looks-similar]')!;
    const compareToggle = body.querySelector<HTMLButtonElement>('[data-looks-compare-toggle]')!;
    const grid = body.querySelector<HTMLElement>('[data-looks-grid]')!;
    const pane = body.querySelector<HTMLElement>('[data-looks-preview]')!;
    const compare = body.querySelector<HTMLElement>('[data-looks-compare]')!;
    const selection = body.querySelector<HTMLElement>('.ds-looks-selection')!;
    const review = body.querySelector<HTMLButtonElement>('[data-looks-review]')!;
    const selected = new Set<string>();
    let compareOn = false;
    let previewId: string | null = active?.id ?? rankLocalLooks(result.looks, '')[0]?.id ?? null;
    let scene = 0;
    let busy = false;
    review.addEventListener('click', () => { compare.scrollIntoView({ block: 'start' }); compare.focus({ preventScroll: true }); });

    const comparePaint = (): void => {
      const choices = result.looks.filter(look => selected.has(look.id));
      compare.hidden = choices.length === 0;
      selection.hidden = choices.length === 0;
      review.textContent = choices.length === 1 ? t('Review this look') : t('Compare these two looks');
      compare.innerHTML = `<h3>${t('Compare looks')}</h3><div class="ds-looks-comparison">${choices.map(look => `<article data-look-detail="${escapeText(look.id)}">
        <h4>${escapeText(look.name)}</h4>${specimen(look)}
        <p>${look.source === 'saved' ? (isTauriShell() ? t('Saved on this device') : t('Saved in this browser')) : t('Reusable Lolly example')}</p>
        <p>${escapeText(look.context.fonts.map(f => f.value).join(' · ') || t('Your current fonts'))}</p>
        ${useButton(look, activeId, true)}
        ${look.source === 'example' ? `<p class="ds-src-stage-note">${t('Replaces the active colours and style settings. Restore brand settings recovers the previous version.')}</p>` : ''}
        <details class="ds-reference-details"><summary>${t('Details and design context')}</summary>
          ${look.context.styles ? styleEvidenceHtml(look.context.styles) : `<p>${t('No source style observations are recorded.')}</p>`}
          ${look.source === 'saved' ? `<label class="field-label">${t('Search tags')}<input class="field-input" maxlength="240" data-look-tags value="${escapeText(look.tags.join(', '))}"></label><button type="button" class="be-btn" data-look-save-tags="${escapeText(look.id)}">${t('Save tags')}</button>` : `<p>${escapeText(look.tags.join(', '))}</p>`}
          <button type="button" class="be-btn" data-look-context="${escapeText(look.id)}">${t('Download design context')}</button>
        </details></article>`).join('')}</div>`;
    };
    const paintPreview = (): void => {
      const look = result.looks.find(l => l.id === previewId);
      pane.hidden = !look;
      pane.innerHTML = look ? lookPreviewHtml(look, scene, activeId) : '';
    };
    const paint = (): void => {
      const found = rankLocalLooks(result.looks, search.value, similar.checked ? active : undefined);
      grid.innerHTML = found.length
        ? found.map(look => lookCardHtml(look, { previewId, activeId, compare: compareOn, selected })).join('')
        : `<p>${t('No matching looks. Try a different name, tag or font.')}</p>`;
    };
    /** Show a look in the pane. Nothing is applied: the pane only draws the look. */
    const preview = (id: string, card: HTMLElement | null): void => {
      const look = result.looks.find(l => l.id === id);
      if (!look) return;
      previewId = id;
      paintPreview();
      for (const other of grid.querySelectorAll<HTMLElement>('[data-look-card]')) {
        const on = other.dataset.lookCard === id;
        other.classList.toggle('is-previewing', on);
        other.querySelector('[data-look-preview]')?.setAttribute('aria-pressed', String(on));
      }
      announce.textContent = tRaw('Previewing {name}', { name: look.name });
      // One column (a phone): the pane sits above the list, so bring it into view.
      if (card && pane.getBoundingClientRect().bottom <= card.getBoundingClientRect().top) {
        pane.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
      }
    };
    const use = async (look: LocalLook, button: HTMLButtonElement): Promise<void> => {
      // Applying a look is a service the person asked for: the register.
      const endRegister = beginRegister(button.closest<HTMLElement>('[data-look-card], [data-looks-preview], [data-look-detail]') ?? body);
      try {
        if (look.source === 'saved') await switchDesignSystem(host, look.id, { route: 'start' });
        else await start.tokens.install(look.doc, look.name, button, { area: 'overview', requireCheckpoint: true, onError: message => { status.textContent = message; }, onInstalled: () => modal.close() });
      } finally { endRegister(); }
    };

    search.addEventListener('input', paint);
    similar.addEventListener('change', paint);
    compareToggle.addEventListener('click', () => {
      compareOn = !compareOn;
      compareToggle.setAttribute('aria-pressed', String(compareOn));
      if (!compareOn) { selected.clear(); comparePaint(); }
      paint();
      status.textContent = compareOn ? t('Choose up to two looks to compare.') : '';
    });
    grid.addEventListener('change', event => {
      const input = event.target as HTMLInputElement;
      const id = input.dataset.lookSelect;
      if (!id) return;
      if (input.checked && selected.size >= 2) { input.checked = false; status.textContent = t('Compare two looks at a time. Deselect one to choose another.'); return; }
      if (input.checked) selected.add(id); else selected.delete(id);
      status.textContent = selected.size === 0 ? '' : selected.size === 1
        ? t('One look selected. Its preview is below the list.')
        : t('Two looks selected. Their comparison is below the list.');
      comparePaint();
    });
    body.addEventListener('click', async event => {
      const target = event.target as Element;
      const pick = target.closest<HTMLElement>('[data-look-preview]');
      if (pick) { preview(pick.dataset.lookPreview ?? '', pick.closest<HTMLElement>('[data-look-card]')); return; }
      const sceneButton = target.closest<HTMLElement>('[data-looks-scene]');
      if (sceneButton) {
        scene = Number(sceneButton.dataset.looksScene) || 0;
        pane.querySelectorAll<HTMLElement>('.ds-looks-scene').forEach((figure, i) => { figure.hidden = i !== scene; });
        pane.querySelectorAll('[data-looks-scene]').forEach(b => { b.setAttribute('aria-pressed', String(b === sceneButton)); });
        return;
      }
      const button = target.closest<HTMLButtonElement>('[data-look-use], [data-look-context], [data-look-save-tags]');
      if (!button || busy) return;
      const look = result.looks.find(l => l.id === (button.dataset.lookUse ?? button.dataset.lookContext ?? button.dataset.lookSaveTags));
      if (!look) return;
      busy = true;
      button.disabled = true;
      try {
        if (button.hasAttribute('data-look-use')) await use(look, button);
        else if (button.hasAttribute('data-look-context')) {
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
    paintPreview();
    search.focus();
  } catch { status.textContent = t('Saved systems could not be loaded. Close this window and try again.'); }
}
export function looksOps(start: StartCtx) { return { openLooks: bindOp(start, openLooks) }; }
