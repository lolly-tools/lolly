// SPDX-License-Identifier: MPL-2.0
import { mountBodyPopover } from '../components/body-popover.ts';
import { createHistoryPreviews, isPreviewDataUrl } from '../components/history-previews.ts';
import { fold, tokenize, scoreHaystack } from '../lib/search/match.ts';
import { t } from '../i18n.ts';
import { historyElement as element, historyIcon } from './history-timeline.ts';

interface PickerOptions {
  id: string;
  label: string;
  searchLabel: string;
  emptyLabel: string;
  glyph: Parameters<typeof historyIcon>[0];
  icon?(id: string): string | undefined;
  preview?(id: string): Promise<string | null>;
}

/** Keep the filter's native value while presenting searchable, illustrated choices. */
export function historyFilterPicker(select: HTMLSelectElement, options: PickerOptions) {
  const trigger = element('button', undefined, 'btn app-history-picker-trigger'); trigger.type = 'button';
  trigger.setAttribute('aria-label', t(options.label)); trigger.setAttribute('aria-haspopup', 'dialog');
  trigger.setAttribute('aria-expanded', 'false'); select.hidden = true;
  let selectedGeneration = 0, disposed = false;
  let previews: ReturnType<typeof createHistoryPreviews> | undefined;
  const media = (id: string): HTMLElement => {
    const cover = element('span', undefined, 'app-history-picker-media'); cover.setAttribute('aria-hidden', 'true');
    cover.append(historyIcon(options.glyph));
    const markup = options.icon?.(id);
    if (markup) void import('dompurify').then(({ default: purify }) => {
      if (disposed) return;
      const fragment = purify.sanitize(markup, { USE_PROFILES: { svg: true }, RETURN_DOM_FRAGMENT: true,
        FORBID_TAGS: ['style', 'image', 'use', 'a'], FORBID_ATTR: ['style'] });
      if (fragment.querySelector('svg')) cover.replaceChildren(fragment);
    }).catch(() => {});
    return cover;
  };
  const refresh = (): void => {
    const token = ++selectedGeneration;
    const name = select.selectedOptions[0]?.textContent || select.options[0]?.textContent || '';
    const cover = media(select.value), caption = element('span', name, 'app-history-picker-name'); caption.id = `${options.id}-value`;
    trigger.replaceChildren(cover, caption, historyIcon('chevronDown'));
    trigger.setAttribute('aria-describedby', caption.id); trigger.dataset.value = select.value; trigger.title = name;
    if (options.preview && select.value) void options.preview(select.value).then(preview => {
      if (disposed || token !== selectedGeneration || !isPreviewDataUrl(preview)) return;
      const image = element('img'); image.alt = ''; image.src = preview; cover.append(image);
    }).catch(() => {});
  };
  const popover = mountBodyPopover(trigger, (panel, handle) => {
    const search = element('input', undefined, 'field-input app-history-picker-search'); search.type = 'search'; search.maxLength = 200;
    search.placeholder = t(options.searchLabel); search.setAttribute('aria-label', t(options.searchLabel));
    search.setAttribute('role', 'combobox'); search.setAttribute('aria-expanded', 'true'); search.setAttribute('aria-autocomplete', 'list');
    const list = element('div', undefined, 'app-history-picker-list'); list.id = `${options.id}-choices`; list.setAttribute('role', 'listbox'); list.setAttribute('aria-label', t(options.label));
    search.setAttribute('aria-controls', list.id);
    const empty = element('p', t(options.emptyLabel), 'app-history-picker-empty'); empty.setAttribute('role', 'status');
    panel.append(search, list, empty);
    if (options.preview) previews = createHistoryPreviews(list, options.preview);
    const choices = Array.from(select.options).map(option => ({ id: option.value, name: option.textContent || '', haystack: fold(option.textContent || '') }));
    let active = 0, buttons: HTMLButtonElement[] = [];
    const highlight = (): void => {
      buttons.forEach((button, index) => { button.classList.toggle('is-active', index === active); });
      const button = buttons[active];
      if (button) { search.setAttribute('aria-activedescendant', button.id); button.scrollIntoView({ block: 'nearest' }); }
      else search.removeAttribute('aria-activedescendant');
    };
    const paint = (): void => {
      previews?.clear(); list.replaceChildren(); buttons = [];
      const tokens = tokenize(search.value);
      const matches = choices.filter(choice => !tokens.length || scoreHaystack([{ text: choice.haystack, weight: 1 }], tokens) > 0);
      active = Math.max(0, matches.findIndex(choice => choice.id === select.value));
      for (const choice of matches) {
        const option = element('button', undefined, 'btn btn--ghost app-history-picker-option'); option.type = 'button'; option.tabIndex = -1;
        option.id = `${options.id}-option-${buttons.length}`; option.dataset.value = choice.id;
        option.setAttribute('role', 'option'); option.setAttribute('aria-selected', String(choice.id === select.value));
        const cover = media(choice.id); option.append(cover, element('span', choice.name, 'app-history-picker-name'));
        if (choice.id === select.value) option.append(historyIcon('check'));
        if (previews && choice.id) { const image = element('img'); image.alt = ''; image.hidden = true; cover.append(image); previews.add(choice.id, option, image); }
        option.addEventListener('click', () => { select.value = choice.id; refresh(); handle.close(true); select.dispatchEvent(new Event('change', { bubbles: true })); });
        list.append(option); buttons.push(option);
      }
      empty.hidden = !!matches.length; highlight();
    };
    search.addEventListener('input', paint);
    panel.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        if (buttons.length) active = (active + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
        search.focus(); highlight();
      } else if (event.key === 'Enter' && event.target === search) { event.preventDefault(); buttons[active]?.click(); }
    });
    paint(); queueMicrotask(highlight);
    if (window.matchMedia('(pointer: coarse)').matches) { panel.tabIndex = -1; return panel; }
    return search;
  }, { className: 'app-history-picker-popover', role: 'dialog', ariaLabel: t(options.label), trackScroll: true,
    onClose: () => { previews?.dispose(); previews = undefined; } });
  trigger.addEventListener('click', () => { if (popover.isOpen()) popover.close(true); else popover.open(); });
  trigger.addEventListener('keydown', event => { if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); popover.open(); } });
  refresh();
  return { trigger, refresh, dispose: () => { disposed = true; selectedGeneration++; popover.close(); } };
}
