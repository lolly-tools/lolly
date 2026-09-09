// SPDX-License-Identifier: MPL-2.0
import type { RevisionEntry, RevisionHistoryAPI, RevisionQuery } from '../bridge/revision-history.ts';
import { t } from '../i18n.ts';

const button = (label: string): HTMLButtonElement => {
  const el = document.createElement('button'); el.type = 'button'; el.className = 'btn'; el.textContent = t(label); return el;
};

/** Lazy History-only controls. Compare decodes at most the selected pair. */
export function mountHistoryWorkflows(history: RevisionHistoryAPI, changed: () => void, error: (message: string) => void, onNamed?: () => void) {
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
  const selected = new Map<string, RevisionEntry>();
  const controls = new Set<HTMLInputElement>();
  const query = (): RevisionQuery => ({ search: search.value.trim() || undefined, toolId: tool.value || undefined, milestones: named.checked || undefined,
    from: from.value ? new Date(`${from.value}T00:00:00`).toISOString() : undefined,
    to: to.value ? new Date(`${to.value}T23:59:59.999`).toISOString() : undefined });
  const notify = (): void => { clearTimeout(timer); timer = setTimeout(() => { if (!closed) changed(); }, 250); };
  search.addEventListener('input', notify);
  for (const input of [tool, from, to, named]) input.addEventListener('change', notify);
  reset.addEventListener('click', () => { clearTimeout(timer); search.value = tool.value = from.value = to.value = ''; named.checked = false; changed(); });

  const showComparison = async (): Promise<void> => {
    const request = ++generation;
    compare.hidden = !selected.size; compare.replaceChildren();
    if (!selected.size) return;
    const info = document.createElement('p'); info.setAttribute('role', 'status');
    info.textContent = selected.size < 2 ? t('Select one more version to compare.') : t('Comparing versions…');
    const clear = button('Clear comparison');
    clear.addEventListener('click', () => { selected.clear(); for (const input of controls) input.checked = false; void showComparison(); });
    compare.append(info, clear);
    if (selected.size < 2) return;
    const pair = [...selected.values()].sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
    try {
      const payloads = await Promise.all(pair.map(entry => history.read(entry.id)));
      if (closed || request !== generation) return;
      if (payloads.some(value => !value)) throw new Error(t('One of these versions is no longer available.'));
      const { revisionDifference } = await import('../lib/revision-difference.ts');
      if (closed || request !== generation) return;
      const diff = revisionDifference(payloads[0], payloads[1]);
      info.textContent = diff.changed ? (diff.changed === 1 && !diff.truncated ? t('1 value changed') : `${diff.changed}${diff.truncated ? '+' : ''} ${t('values changed')}`) : t('The editable values are identical.');
      const pictures = document.createElement('div'); pictures.className = 'revision-history-comparison-pair';
      const previews = await Promise.all(pair.map(entry => history.preview(entry.id)));
      if (closed || request !== generation) return;
      pair.forEach((entry, index) => {
        const figure = document.createElement('figure'), caption = document.createElement('figcaption');
        caption.textContent = `${index ? t('Later') : t('Earlier')} · ${entry.milestone ?? entry.label}`;
        const image = document.createElement('img'); image.alt = caption.textContent;
        const preview = previews[index];
        if (preview && /^data:image\/(png|jpeg|webp);base64,/.test(preview)) { image.src = preview; figure.append(image); }
        else { const missing = document.createElement('p'); missing.textContent = t('Preview unavailable'); figure.append(missing); }
        figure.append(caption); pictures.append(figure);
      });
      const paths = document.createElement('ul');
      for (const path of diff.paths) { const row = document.createElement('li'); row.textContent = path; paths.append(row); }
      compare.append(pictures, paths);
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
    dispose() { closed = true; generation++; clearTimeout(timer); selected.clear(); controls.clear(); compare.replaceChildren(); },
  };
}
