// SPDX-License-Identifier: MPL-2.0
import type { RevisionEntry, RevisionHistoryAPI, RevisionQuery } from '../bridge/revision-history.ts';
import type { ComparisonSource } from '@lolly-tools/core/host-v1';
import { mountHistoryComparison } from './history-comparison.ts';
import { t } from '../i18n.ts';

const button = (label: string): HTMLButtonElement => {
  const el = document.createElement('button'); el.type = 'button'; el.className = 'btn'; el.textContent = t(label); return el;
};

/** Lazy History-only controls. Compare decodes at most the selected pair. */
export function mountHistoryWorkflows(history: RevisionHistoryAPI, changed: () => void, error: (message: string) => void, onNamed?: () => void, current?: (entry: RevisionEntry) => Promise<ComparisonSource | null>) {
  const el = document.createElement('div'); el.className = 'revision-history-workflows';
  const filters = document.createElement('details');
  const summary = document.createElement('summary'); summary.textContent = t('Find a version'); filters.append(summary);
  const search = document.createElement('input'); search.type = 'search'; search.className = 'field-input'; search.placeholder = t('Search names and milestones'); search.setAttribute('aria-label', t('Search history')); search.maxLength = 200;
  const tool = document.createElement('select'); tool.className = 'field-select'; tool.setAttribute('aria-label', t('Filter by tool')); tool.add(new Option(t('All tools'), ''));
  const knownTools = new Set<string>();
  const addTool = (id: string, name = id): void => { if (!knownTools.has(id)) { knownTools.add(id); tool.add(new Option(name, id)); } };
  const catalog = (window as typeof window & { __toolIndex?: { tools?: Array<{ id: string; name: string }> } }).__toolIndex;
  for (const entry of catalog?.tools ?? []) addTool(entry.id, entry.name);
  const dates = document.createElement('div'); dates.className = 'revision-history-dates';
  const dateField = (label: string): HTMLInputElement => {
    const wrap = document.createElement('label'); wrap.textContent = t(label);
    const input = document.createElement('input'); input.type = 'date'; input.className = 'field-input'; input.setAttribute('aria-label', t(label)); wrap.append(input); dates.append(wrap); return input;
  };
  const from = dateField('From date'), to = dateField('To date');
  const namedLabel = document.createElement('label');
  const named = document.createElement('input'); named.type = 'checkbox'; namedLabel.append(named, document.createTextNode(t('Named milestones only')));
  const reset = button('Clear filters');
  filters.append(search, tool, dates, namedLabel, reset);
  const compare = document.createElement('section'); compare.className = 'revision-history-compare'; compare.hidden = true; compare.setAttribute('aria-label', t('Version comparison'));
  el.append(filters, compare);
  let timer: ReturnType<typeof setTimeout> | undefined, closed = false, generation = 0;
  let comparisonJob: AbortController | undefined, disposeComparison: (() => void) | undefined;
  const selected = new Map<string, RevisionEntry>();
  const controls = new Set<HTMLInputElement>();
  const query = (): RevisionQuery => ({ search: search.value.trim() || undefined, toolId: tool.value || undefined, milestones: named.checked || undefined,
    from: from.value ? new Date(`${from.value}T00:00:00`).toISOString() : undefined,
    to: to.value ? new Date(`${to.value}T23:59:59.999`).toISOString() : undefined });
  const notify = (): void => { clearTimeout(timer); timer = setTimeout(() => { if (!closed) changed(); }, 250); };
  search.addEventListener('input', notify);
  for (const input of [tool, from, to, named]) input.addEventListener('change', notify);
  reset.addEventListener('click', () => { clearTimeout(timer); search.value = tool.value = from.value = to.value = ''; named.checked = false; changed(); });

  const showComparison = async (useCurrent = false): Promise<void> => {
    comparisonJob?.abort(); disposeComparison?.(); disposeComparison = undefined;
    const controller = new AbortController(); comparisonJob = controller;
    const request = ++generation;
    compare.hidden = !selected.size; compare.replaceChildren();
    if (!selected.size) return;
    const info = document.createElement('p'); info.setAttribute('role', 'status');
    info.textContent = selected.size < 2 ? t('Select one more version to compare.') : t('Comparing versions…');
    const clear = button('Clear comparison');
    clear.addEventListener('click', () => { selected.clear(); for (const input of controls) input.checked = false; void showComparison(); });
    compare.append(info, clear);
    const pair = [...selected.values()].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    if (selected.size < 2 && !useCurrent) {
      if (current) { const now = button('Compare with current'); now.addEventListener('click', () => { void showComparison(true); }); compare.append(now); }
      return;
    }
    const body = document.createElement('div'); compare.append(body);
    try {
      const after = useCurrent ? await current?.(pair[0]!) : pair[1];
      if (!after) throw new Error(t('The current creation is unavailable.'));
      if (closed || request !== generation) return;
      disposeComparison = await mountHistoryComparison(body, history, pair[0]!, after, controller.signal);
      if (closed || request !== generation) { disposeComparison(); return; }
      info.textContent = '';
    } catch (failure) { if (!closed && request === generation) info.textContent = failure instanceof Error ? failure.message : t('Could not compare these versions.'); }
  };

  return { el, query, addTool,
    active: () => !!(search.value.trim() || tool.value || from.value || to.value || named.checked),
    pageChanged() { controls.clear(); },
    actions(entry: RevisionEntry): HTMLElement {
      addTool(entry.toolId);
      const actions = document.createElement('div'); actions.className = 'revision-history-actions';
      const name = button(entry.milestone ? 'Rename milestone' : 'Name version');
      const checkLabel = document.createElement('label'), check = document.createElement('input');
      check.type = 'checkbox'; check.checked = selected.has(entry.id); checkLabel.append(check, document.createTextNode(t('Compare'))); controls.add(check);
      check.addEventListener('change', () => {
        if (check.checked && [...selected.values()].some(other => other.documentId !== entry.documentId)) { check.checked = false; error(t('Choose versions of the same creation to compare.')); return; }
        if (check.checked && selected.size === 2) { check.checked = false; error(t('Clear the comparison or deselect a version before choosing another.')); return; }
        if (check.checked) selected.set(entry.id, entry); else selected.delete(entry.id);
        void showComparison();
      });
      name.addEventListener('click', () => {
        name.hidden = true;
        const form = document.createElement('form'), input = document.createElement('input');
        input.className = 'field-input'; input.maxLength = 120; input.required = true; input.value = entry.milestone ?? ''; input.placeholder = t('Milestone name'); input.setAttribute('aria-label', t('Milestone name'));
        const save = button('Keep milestone'); save.type = 'submit'; const cancel = button('Cancel');
        cancel.addEventListener('click', () => { form.remove(); name.hidden = false; name.focus(); });
        form.append(input, save, cancel); actions.append(form); input.focus();
        form.addEventListener('submit', async event => {
          event.preventDefault(); save.disabled = true;
          try { await history.name(entry.id, input.value); if (!closed) { changed(); onNamed?.(); } }
          catch (failure) { error(failure instanceof Error ? failure.message : t('Could not name this version.')); save.disabled = false; }
        });
      });
      actions.append(name, checkLabel); return actions;
    },
    dispose() { comparisonJob?.abort(); disposeComparison?.(); closed = true; generation++; clearTimeout(timer); selected.clear(); controls.clear(); compare.replaceChildren(); },
  };
}
