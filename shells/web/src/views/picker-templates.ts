// SPDX-License-Identifier: MPL-2.0
/**
 * The new-asset picker's Templates tab (plans/245 scope 3).
 *
 * One template-picking surface, not two: the list is the same one the Projects
 * Templates collection renders (yours first, then what shipped with each tool,
 * hidden ones left out), and a pick goes through the collection's own open action.
 * The picker stays generic - the caller passes a {@link CollectTemplates} source, so
 * this module knows nothing about profiles, refs or seeds.
 */
import { t } from '../i18n.ts';
import { templateCard, type PickerTemplate } from './picker-cards.ts';
import type { CollectResult } from './picker.ts';

/** What the caller lends the tab: the list, and the two things a pick can mean. */
export interface CollectTemplates {
  /** Every template a person can start from, in display order. */
  list(): Promise<readonly PickerTemplate[]>;
  /** Open the tool seeded from this template. Navigates, so the dialog closes. */
  onOpen(ref: string): void;
  /** File a project from this template without opening the editor. */
  onQuickAdd(ref: string): Promise<CollectResult | boolean>;
}

/** The picker pieces the tab borrows: its pane, its per-card feedback, its teardown. */
export interface TemplatesTabDeps {
  pane: HTMLElement;
  /** Flash the added / could-not-add badge on a card (the picker owns that feedback). */
  flash(element: HTMLElement, result: CollectResult | boolean): void;
  /** Close the dialog, for a pick that navigates away from it. */
  close(): void;
  /** The list arrived after the first paint: repaint with the live query. */
  onLoaded(): void;
}

export interface TemplatesTab {
  render(query: string): void;
  /** Matches for the tab's search badge (0 until the list has arrived). */
  count(query: string): number;
  /**
   * True when the click was a template card, so the picker stops handling it.
   * Answers synchronously: the picker's click handler calls preventDefault and
   * stopPropagation on the branches below this one, and neither counts for anything
   * once the event has finished dispatching. So a quick-add's own work runs in the
   * background and the answer comes back inside the same dispatch.
   */
  handle(target: HTMLElement): boolean;
}

/** Fold for matching: lowercase, diacritics stripped (the Projects search rule). */
const fold = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

/** Name, description and tool, matched token-AND like every other picker pane. */
export function matchesPickerTemplate(template: PickerTemplate, query: string): boolean {
  const tokens = fold(query).split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const hay = fold(`${template.name} ${template.description ?? ''} ${template.toolName} ${template.toolId}`);
  return tokens.every(token => hay.includes(token));
}

/** The pane's whole markup for one query: loading, empty, or the card grid. */
export function templatesPaneHtml(list: readonly PickerTemplate[] | null, query: string): string {
  if (!list) return `<div class="asset-picker-loading">${t('Loading…')}</div>`;
  const kept = list.filter(template => matchesPickerTemplate(template, query));
  if (!kept.length) {
    return `<p class="asset-picker-empty" role="status">${list.length
      ? t('No templates match.')
      : t('No templates yet. Save one from a tool with “Save as”, or from a project tile.')}</p>`;
  }
  return `<div class="asset-picker-section-head">${t('Start a new creation from a template')} <span class="asset-picker-count">${list.length}</span></div>`
    + `<div class="asset-picker-grid asset-picker-toolgrid">${kept.map(template => templateCard(template, true)).join('')}</div>`;
}

/**
 * Wire the tab over one picker mount. The list loads once, on mount, so switching to
 * the tab paints immediately on every later visit.
 */
export function mountTemplatesTab(source: CollectTemplates, deps: TemplatesTabDeps): TemplatesTab {
  let list: readonly PickerTemplate[] | null = null;
  void source.list()
    .then((loaded) => { list = loaded; deps.onLoaded(); })
    .catch(() => { list = []; deps.onLoaded(); });

  function render(query: string): void {
    deps.pane.innerHTML = templatesPaneHtml(list, query);
  }

  function count(query: string): number {
    return (list ?? []).filter(template => matchesPickerTemplate(template, query)).length;
  }

  function handle(target: HTMLElement): boolean {
    // The "+ Add" control sits INSIDE the card cell, so it is tested first.
    const quick = target.closest<HTMLElement>('[data-quickadd-template]');
    if (quick) {
      // Claiming the click is the synchronous part; filing the project is not, so it
      // runs on its own and flashes the card once it finishes.
      void (async () => {
        const result = await source.onQuickAdd(quick.dataset.quickaddTemplate ?? '');
        // A silent result means the person dismissed a step, so nothing was added and
        // there is nothing to report.
        if (!(typeof result === 'object' && result.silent)) deps.flash(quick, result);
      })();
      return true;
    }
    const open = target.closest<HTMLElement>('[data-template-ref]');
    if (open) {
      source.onOpen(open.dataset.templateRef ?? '');
      deps.close();
      return true;
    }
    return false;
  }

  return { render, count, handle };
}
