// SPDX-License-Identifier: MPL-2.0
/**
 * The suggestions list inside the inspection panel. Every group starts selected (or
 * follows a loaded recipe's categories), values stay masked until revealed, and the
 * category chips select or clear a whole category at once. The panel controller
 * listens for change/input on the panel and re-prepares the copies as choices move.
 */
import type { PreparationInspection, PreparationChoice } from '@lolly-tools/core/host-v1';
import { icon } from '../../lib/icons.ts';
import { escape as htmlEscape } from '../../utils.ts';
import { t } from '../../i18n.ts';
import { categoryLabel, categoryIcon } from './inspector.ts';

/** Enough of a value to recognise it, never enough to copy it from the screen. */
export function maskValue(value: string): string {
  const chars = [...value];
  if (chars.length <= 4) return '•'.repeat(chars.length);
  const keep = chars.length > 12 ? 3 : 2;
  return chars.slice(0, keep).join('') + '•'.repeat(Math.min(10, chars.length - keep - 1)) + chars.slice(-1).join('');
}

export function renderPreparationReview(root: HTMLElement, inspection: PreparationInspection, categories?: string[]): void {
  const groups = inspection.groups;
  const cats = [...new Set(groups.map(g => g.category))];
  const countFor = (category: string): number => groups.filter(g => g.category === category).length;
  const values = new Map(groups.map(g => [g.id, g.value]));
  // A fresh element per render, so the handlers below never stack across inspections.
  const box = document.createElement('div'); box.className = 'prep-review';
  box.innerHTML = `<header class="prep-sec-head">
      <h3 class="prep-sec-title">${t('Suggestions')} <span class="chip chip--count">${groups.length}</span></h3>
      ${groups.length ? `<div class="prep-sec-tools"><button type="button" class="btn btn--sm btn--ghost" data-select-all>${t('Select all')}</button><button type="button" class="btn btn--sm btn--ghost" data-unchanged data-keep-all>${t('Keep everything')}</button></div>` : ''}
    </header>
    ${groups.length ? `<p class="prep-hint">${t('Patterns can miss private information or flag ordinary text. Selected suggestions are applied to the copies as you change them.')}</p>` : ''}
    ${cats.length > 1 ? `<div class="prep-cats" role="group" aria-label="${t('Categories')}">${cats.map(c => `<button type="button" class="chip prep-cat" data-category="${htmlEscape(c)}" aria-pressed="true">${categoryIcon(c)}${htmlEscape(categoryLabel(c))} <b>${countFor(c)}</b></button>`).join('')}</div>` : ''}
    <div class="prep-groups" data-groups>${groups.map(g => {
      const findings = inspection.findings.filter(f => f.groupId === g.id);
      const uncertain = findings.length > 0 && findings.every(f => f.uncertain);
      const checked = !categories || categories.includes(g.category) ? ' checked' : '';
      return `<div class="prep-group" role="group" aria-label="${htmlEscape(categoryLabel(g.category))}" data-group="${g.id}" data-group-category="${htmlEscape(g.category)}">
        <label class="prep-group-row"><input type="checkbox" class="field-check" data-selected${checked}><span class="prep-group-cat">${categoryIcon(g.category)}${htmlEscape(categoryLabel(g.category))}</span>${uncertain ? `<span class="chip chip--flag">${t('Uncertain')}</span>` : ''}<span class="chip chip--count">${g.count}</span></label>
        <div class="prep-group-body">
          <div class="prep-group-value"><code class="prep-mask" data-mask>${htmlEscape(maskValue(g.value))}</code><button type="button" class="prep-icon-btn" data-reveal aria-pressed="false" aria-label="${t('Reveal value')}">${icon('eye')}</button></div>
          <label class="prep-group-repl"><span class="field-label">${t('Replace with')}</span><input class="field-input field-input--sm field-input--mono" data-replacement maxlength="4096" value="${htmlEscape(g.replacement)}" autocomplete="off" spellcheck="false"></label>
          <details class="prep-occ"><summary>${findings.length} ${findings.length === 1 ? t('occurrence') : t('occurrences')}</summary>${findings.map(f => `<label class="prepare-occurrence"><input type="checkbox" class="field-check" data-finding="${f.id}" checked><span><span class="prep-occ-path">${htmlEscape(inspection.scopes.find(s => s.id === f.scopeId)?.path ?? '')}</span> <span class="prep-occ-loc">${htmlEscape(f.location)} · ${t('line')} ${f.line}${f.uncertain ? ` · ${t('uncertain')}` : ''}</span></span></label>`).join('')}</details>
        </div>
      </div>`;
    }).join('') || `<p class="prep-hint">${t('No pattern suggestions. Read the content yourself before sharing it.')}</p>`}</div>`;
  root.replaceChildren(box);

  const groupBoxes = (): HTMLInputElement[] => [...box.querySelectorAll<HTMLInputElement>('[data-selected]')];
  const syncCategories = (): void => {
    box.querySelectorAll<HTMLButtonElement>('[data-category]').forEach(button => {
      const boxes = groupBoxes().filter(b => b.closest<HTMLElement>('[data-group]')!.dataset.groupCategory === button.dataset.category);
      button.setAttribute('aria-pressed', String(boxes.length > 0 && boxes.every(b => b.checked)));
    });
  };
  box.addEventListener('click', event => {
    const target = event.target as HTMLElement;
    const category = target.closest<HTMLButtonElement>('[data-category]');
    if (category) {
      const boxes = groupBoxes().filter(b => b.closest<HTMLElement>('[data-group]')!.dataset.groupCategory === category.dataset.category);
      const on = !boxes.every(b => b.checked);
      boxes.forEach(b => { b.checked = on; });
      syncCategories();
      return;
    }
    if (target.closest('[data-select-all]')) { groupBoxes().forEach(b => { b.checked = true; }); syncCategories(); return; }
    if (target.closest('[data-keep-all]')) { box.querySelectorAll<HTMLInputElement>('[data-selected], [data-finding]').forEach(b => { b.checked = false; }); syncCategories(); return; }
    const reveal = target.closest<HTMLButtonElement>('[data-reveal]');
    if (reveal) {
      const group = reveal.closest<HTMLElement>('[data-group]')!;
      const mask = group.querySelector<HTMLElement>('[data-mask]')!;
      const shown = reveal.getAttribute('aria-pressed') === 'true';
      mask.textContent = shown ? maskValue(values.get(group.dataset.group!) ?? '') : values.get(group.dataset.group!) ?? '';
      mask.classList.toggle('is-revealed', !shown);
      reveal.setAttribute('aria-pressed', String(!shown));
      reveal.setAttribute('aria-label', shown ? t('Reveal value') : t('Hide value'));
    }
  });
  box.addEventListener('change', event => { if ((event.target as HTMLElement).matches('[data-selected]')) syncCategories(); });
}

export function preparationChoices(root: HTMLElement): PreparationChoice[] {
  return [...root.querySelectorAll<HTMLElement>('[data-group]')].filter(el => el.querySelector<HTMLInputElement>('[data-selected]')!.checked).map(el => ({
    groupId: el.dataset.group!, replacement: el.querySelector<HTMLInputElement>('[data-replacement]')!.value,
    findings: [...el.querySelectorAll<HTMLInputElement>('[data-finding]:checked')].map(i => i.dataset.finding!),
  }));
}
