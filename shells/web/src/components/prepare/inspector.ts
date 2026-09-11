// SPDX-License-Identifier: MPL-2.0
/**
 * The inspection panel: the sidebar the route docks into the app's one right edge
 * column, and the dialog keeps in flow. Renders the shell once; the panel controller
 * fills its slots as work progresses (status, counts, suggestions, coverage, rules,
 * the report). Nothing rendered here is a private VALUE - counts, categories, paths
 * and hashes only - so the element can leave the page root for the dock without
 * carrying content the review keeps behind a reveal.
 */
import type { PreparationInspection, PreparationReport, PreparationRule } from '@lolly-tools/core/host-v1';
import { icon, type IconName } from '../../lib/icons.ts';
import { escape as htmlEscape } from '../../utils.ts';
import { t } from '../../i18n.ts';

export type InspectorTone = 'idle' | 'busy' | 'ready' | 'error';

/** Engine categories (prepare-text.ts / prepare-pii.ts) → what a person calls them. */
const CATEGORY: Record<string, { label: () => string; icon: IconName }> = {
  credential: { label: () => t('Credentials and keys'), icon: 'lock' },
  email: { label: () => t('Email addresses'), icon: 'mail' },
  phone: { label: () => t('Phone numbers'), icon: 'speech' },
  iban: { label: () => t('Bank accounts'), icon: 'hash' },
  card: { label: () => t('Card numbers'), icon: 'hash' },
  address: { label: () => t('Street addresses'), icon: 'building' },
  postcode: { label: () => t('Postcodes'), icon: 'pin' },
  name: { label: () => t('Names'), icon: 'user' },
  date: { label: () => t('Dates'), icon: 'calendar' },
  custom: { label: () => t('Your values'), icon: 'tag' },
};
export function categoryLabel(category: string): string {
  const known = CATEGORY[category];
  return known ? known.label() : category.charAt(0).toUpperCase() + category.slice(1);
}
export function categoryIcon(category: string): string {
  return icon(CATEGORY[category]?.icon ?? 'tag');
}

function scopeStatusLabel(status: string): string {
  if (status === 'inspected') return t('Inspected');
  if (status === 'partial') return t('Partly inspected');
  return t('Not inspected');
}

export function renderInspectorShell(side: HTMLElement): void {
  side.innerHTML = `<div class="prep-side-head">
      <span class="prep-side-icon" aria-hidden="true">${icon('shield')}</span>
      <h2 class="prep-side-title">${t('Inspection')}</h2>
      <span class="chip prep-side-status" data-side-status data-tone="idle">${t('Waiting for content')}</span>
      <button type="button" class="btn btn--sm btn--primary" data-preview hidden>${t('Try again')}</button>
      <button type="button" class="btn btn--sm btn--ghost" data-cancel hidden>${t('Cancel')}</button>
    </div>
    <div class="prep-side-scroll">
      <div class="prep-stats" data-stats hidden></div>
      <section class="prep-sec" data-review aria-label="${t('Suggestions')}"></section>
      <section class="prep-sec" data-coverage aria-label="${t('Coverage')}" hidden></section>
      <section class="prep-sec" data-report aria-label="${t('Result')}" hidden></section>
      <details class="prep-fold" data-rules>
        <summary class="prep-fold-head"><h3 class="prep-sec-title">${t('Rules and recipes')} <span class="chip chip--count" data-rule-count>0</span></h3><span class="prep-fold-chev" aria-hidden="true">${icon('play')}</span></summary>
        <div class="prep-fold-body">
          <p class="prep-hint">${t('Add a value the patterns missed, or a field name whose values should always be replaced. Literal values never enter a recipe.')}</p>
          <div class="prep-rule-form">
            <select class="field-select field-select--sm" data-rule-kind aria-label="${t('Rule type')}"><option value="literal">${t('Exact private value')}</option><option value="field">${t('Field name')}</option></select>
            <input class="field-input field-input--sm" data-rule-value maxlength="256" autocomplete="off" spellcheck="false" placeholder="${t('Value or field name')}" aria-label="${t('Value or field name')}">
            <button type="button" class="btn btn--sm" data-rule-add>${t('Add rule')}</button>
          </div>
          <ul class="prep-rules" data-rule-list></ul>
          <div class="prep-actions">
            <button type="button" class="btn btn--sm btn--ghost" data-rule-clear>${t('Clear rules')}</button>
            <button type="button" class="btn btn--sm btn--ghost" data-recipe-save>${t('Save recipe')}</button>
            <label class="btn btn--sm btn--ghost">${t('Load recipe…')}<input type="file" accept=".json" data-recipe-load class="prep-vh"></label>
          </div>
        </div>
      </details>
    </div>
    <div class="prep-side-foot">
      <button type="button" class="btn btn--sm btn--ghost" data-originals>${t('Download originals')}</button>
      <button type="button" class="btn btn--sm btn--ghost" data-reset>${t('Clear')}</button>
    </div>`;
}

export function setInspectorStatus(side: HTMLElement, text: string, tone: InspectorTone): void {
  const chip = side.querySelector<HTMLElement>('[data-side-status]');
  if (!chip) return;
  chip.textContent = text; chip.dataset.tone = tone; chip.title = text;
}

/** The panel's content before anything is inspected: what the patterns look for. */
export function renderInspectorEmpty(review: HTMLElement): void {
  const rows: [IconName, string][] = [
    ['lock', t('Credentials, keys and signed tokens')],
    ['mail', t('Email addresses and phone numbers')],
    ['hash', t('Bank account and card numbers')],
    ['building', t('Street addresses and postcodes')],
    ['user', t('Names and dates, marked as uncertain')],
    ['tag', t('Your own values and field names, from the rules below')],
  ];
  review.innerHTML = `<header class="prep-sec-head"><h3 class="prep-sec-title">${t('What gets checked')}</h3></header>
    <ul class="prep-checks">${rows.map(([glyph, label]) => `<li>${icon(glyph)}<span>${htmlEscape(label)}</span></li>`).join('')}</ul>
    <p class="prep-hint">${t('Inspection starts as soon as you add a file or paste text, and copies are prepared with the suggested changes. Nothing is downloaded, sent or saved until you choose.')}</p>`;
}

export function renderInspectorStats(side: HTMLElement, stats: { files: number; size: string; findings?: number; changed?: number } | null): void {
  const box = side.querySelector<HTMLElement>('[data-stats]');
  if (!box) return;
  if (!stats) { box.hidden = true; box.replaceChildren(); return; }
  const chip = (n: number | string, label: string): string => `<span class="chip chip--stat"><b>${htmlEscape(String(n))}</b> ${htmlEscape(label)}</span>`;
  box.innerHTML = chip(stats.files, stats.files === 1 ? t('source') : t('sources')) + chip(stats.size, t('read'))
    + (stats.findings != null ? chip(stats.findings, stats.findings === 1 ? t('finding') : t('findings')) : '')
    + (stats.changed != null ? chip(stats.changed, t('changed')) : '');
  box.hidden = false;
}

export function renderCoverage(side: HTMLElement, inspection: PreparationInspection | null): void {
  const box = side.querySelector<HTMLElement>('[data-coverage]');
  if (!box) return;
  if (!inspection) { box.hidden = true; box.replaceChildren(); return; }
  box.innerHTML = `<header class="prep-sec-head"><h3 class="prep-sec-title">${t('Coverage')} <span class="chip chip--count">${inspection.scopes.length}</span></h3></header>
    <ul class="prep-scopes">${inspection.scopes.map(s => `<li class="prep-scope">
      <span class="prep-scope-path">${htmlEscape(s.path)}</span>
      <span class="chip chip--status prep-scope-status" data-status="${htmlEscape(s.status)}">${scopeStatusLabel(s.status)}</span>
      <span class="chip">${htmlEscape(s.format)}</span>
      ${s.limitations.length ? `<details class="prep-scope-notes"><summary>${s.limitations.length} ${s.limitations.length === 1 ? t('note') : t('notes')}</summary>${s.limitations.map(l => `<p>${htmlEscape(l)}</p>`).join('')}</details>` : ''}
      ${s.id !== s.sourceId ? `<label class="prep-scope-remove"><input type="checkbox" class="field-check" data-remove="${htmlEscape(s.id)}"> ${t('Leave this member out of the copy')}</label>` : ''}
    </li>`).join('')}</ul>`;
  box.hidden = false;
}

export function renderReport(side: HTMLElement, report: PreparationReport | null): void {
  const box = side.querySelector<HTMLElement>('[data-report]');
  if (!box) return;
  if (!report) { box.hidden = true; box.replaceChildren(); return; }
  const failed = report.stages?.filter(s => s.status === 'failed').length ?? 0;
  box.innerHTML = `<header class="prep-sec-head"><h3 class="prep-sec-title">${t('Result')}</h3>
      <div class="prep-sec-tools"><button type="button" class="btn btn--sm btn--ghost" data-report>${t('Download report')}</button></div></header>
    <div class="prep-stats"><span class="chip chip--stat"><b>${report.replaced}</b> ${t('changed')}</span><span class="chip chip--stat"><b>${report.remaining}</b> ${t('still flagged')}</span></div>
    ${failed ? `<p class="prep-alert" role="alert">${t('Some changes could not be made. The affected files were kept for review; the other copies are ready.')}</p>` : ''}
    <p class="prep-hint">${t('Sensitive field names can still suggest a placeholder. No result is certified free of private information.')}</p>
    <details><summary class="prep-hint">${t('Report JSON')}</summary><pre class="prep-pre">${htmlEscape(JSON.stringify(report, null, 2))}</pre></details>
    <p class="prep-hint">${t('The report holds counts, scope IDs and file hashes. It never holds filenames, private values or replacement maps.')}</p>`;
  box.hidden = false;
}

export function renderRules(side: HTMLElement, rules: PreparationRule[]): void {
  const count = side.querySelector<HTMLElement>('[data-rule-count]');
  if (count) count.textContent = String(rules.length);
  const list = side.querySelector<HTMLElement>('[data-rule-list]');
  if (!list) return;
  list.innerHTML = rules.map(r => `<li class="prep-rule"><span class="chip chip--flag">${r.kind === 'field' ? t('Field') : t('Value')}</span><code>${htmlEscape(r.kind === 'field' ? r.value : '•'.repeat(Math.min(12, r.value.length)))}</code><button type="button" class="prep-icon-btn" data-rule-remove="${htmlEscape(r.id)}" aria-label="${t('Remove rule')}">${icon('close')}</button></li>`).join('');
}
