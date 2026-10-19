// SPDX-License-Identifier: MPL-2.0
import { RowSelection, BATCH_PAGE_SIZE, rowPage, duplicateRows, removeRows, restoreRows } from './row-selection.ts';
import { deriveColumns } from './model.ts';
import { t, tRaw } from '../i18n.ts';
import { announce } from '../a11y.ts';

interface Row {
  uid: string;
  toolId: string;
  values: Record<string, unknown>;
  manifest: Parameters<typeof deriveColumns>[0][number]['manifest'];
  kitOutputId?: string;
}
interface State<R extends Row> { rows: R[]; running: boolean; kit?: unknown }
interface Actions {
  changed(): void;
  selected(): void;
  newUid(): string;
  edit(anchor: HTMLElement, key: string, blocks: boolean): void;
}

/** The row command bar owns transient selection, page position and delete recovery. */
export function mountRowActions<R extends Row>(root: HTMLElement, state: State<R>, actions: Actions) {
  const selection = new RowSelection();
  let page = 0;
  let active = true;
  let removed: Array<{ row: R; index: number }> = [];
  const bar = root.querySelector<HTMLElement>('[data-row-actions]')!;
  const grid = root.querySelector<HTMLElement>('#pro-grid-host')!;
  const q = <E extends HTMLElement>(selector: string): E => root.querySelector<E>(selector)!;
  const scope = (): R[] => selection.scope(state.rows);
  const visible = () => { const result = rowPage(state.rows, page); page = result.page; return result; };

  function sync(): void {
    if (!active) return;
    selection.reconcile(state.rows);
    const n = selection.ids.size;
    const current = visible();
    const count = q<HTMLElement>('[data-selection-count]');
    count.textContent = n ? tRaw('{n} selected', { n }) : t('Select rows to work on a group');
    bar.classList.toggle('has-selection', n > 0);
    q<HTMLElement>('[data-selected-actions]').hidden = !n;
    q<HTMLElement>('[data-selection-hint]').hidden = n > 0;
    const all = q<HTMLButtonElement>('[data-select-every-row]');
    all.hidden = !n || n === state.rows.length;
    all.textContent = tRaw('Select all {n} rows', { n: state.rows.length });
    const undo = q<HTMLButtonElement>('[data-undo-remove]');
    undo.hidden = !removed.length;
    undo.disabled = state.running;
    undo.textContent = tRaw('Undo remove ({n})', { n: removed.length });
    for (const tr of grid.querySelectorAll<HTMLElement>('tbody tr[data-row]')) {
      const checked = selection.ids.has(tr.dataset.row!);
      tr.classList.toggle('is-selected', checked);
      tr.setAttribute('aria-selected', String(checked));
      const box = tr.querySelector<HTMLInputElement>('[data-select-row]');
      if (box) box.checked = checked;
    }
    const fillEmpty = grid.querySelector<HTMLButtonElement>('[data-fill-last]');
    if (fillEmpty) {
      fillEmpty.disabled = state.running || !state.rows.some(row => row.toolId) || !scope().some(row => !row.toolId);
      fillEmpty.title = n ? t('Copy the last template row into selected empty rows') : t('Copy the last template row into all empty rows');
    }
    const checkAll = grid.querySelector<HTMLInputElement>('[data-select-page]');
    if (checkAll) {
      const checked = current.rows.filter(row => selection.ids.has(row.uid)).length;
      checkAll.checked = checked === current.rows.length && checked > 0;
      checkAll.indeterminate = checked > 0 && checked < current.rows.length;
    }
    const edit = q<HTMLSelectElement>('[data-edit-selected]');
    const cols = n ? deriveColumns(scope().filter(row => row.manifest)).filter(col => col.bulk || col.type === 'blocks') : [];
    edit.replaceChildren(new Option(t('Edit input…'), ''), ...cols.map(col => {
      const option = new Option(col.label, col.key);
      option.dataset.blocks = String(col.type === 'blocks');
      return option;
    }));
    edit.disabled = !cols.length || state.running;
    q<HTMLButtonElement>('[data-duplicate-rows]').disabled = !!state.kit || state.running;
    q<HTMLButtonElement>('[data-remove-rows]').disabled = !!state.kit || state.running;
    q<HTMLElement>('#pro-toolbar-group').inert = state.running;
    for (const selector of ['[data-toolbar-add]', '[data-import-csv]', '#pro-sessions', '#pro-common-inputs']) q<HTMLButtonElement>(selector).disabled = state.running;
    const ready = scope().filter(row => row.toolId && row.manifest).length;
    const render = q<HTMLButtonElement>('#pro-render');
    render.textContent = n ? tRaw('Render selected ({n})', { n: ready }) : tRaw('Render all ({n})', { n: ready });
    render.disabled = !ready || state.running;
    const csv = q<HTMLButtonElement>('[data-export-csv]');
    csv.textContent = n ? t('Export selected CSV') : t('Export CSV');
    csv.disabled = !ready || state.running;
    const sheet = q<HTMLButtonElement>('#pro-tosheet');
    sheet.textContent = n ? t('Print selected rows') : t('Print sheet');
    sheet.disabled = !ready || state.running;
    for (const fill of grid.querySelectorAll<HTMLElement>('[data-bulk-col], [data-bulk-blocks]')) {
      const label = fill.closest('th')?.querySelector('.pro-col-label')?.textContent ?? '';
      const title = n ? tRaw('Edit {name} in selected rows', { name: label }) : tRaw('Edit {name} in all rows', { name: label });
      fill.title = title; fill.setAttribute('aria-label', title);
    }
  }

  function changedSelection(): void { actions.selected(); sync(); announce(q<HTMLElement>('[data-selection-count]').textContent!); }
  function reset(): void { page = 0; selection.clear(); removed = []; }
  function reveal(uid: string): void { const index = state.rows.findIndex(row => row.uid === uid); if (index >= 0) page = Math.floor(index / BATCH_PAGE_SIZE); }
  function remove(ids: ReadonlySet<string>): void {
    if (state.running || state.kit) return;
    const result = removeRows(state.rows, ids);
    if (!result.removed.length) return;
    state.rows = result.rows; removed = result.removed;
    selection.clear(); actions.changed();
    q<HTMLButtonElement>('[data-undo-remove]').focus();
    announce(tRaw('Removed {n} rows. Undo is available.', { n: removed.length }));
  }
  const click = (event: MouseEvent): void => {
    const target = event.target as HTMLElement;
    const checkbox = target.closest<HTMLInputElement>('[data-select-row]');
    if (checkbox) {
      selection.toggle(state.rows, checkbox.dataset.selectRow!, checkbox.checked, event.shiftKey);
      changedSelection(); return;
    }
    if (target.matches('[data-select-page]')) {
      const checked = (target as HTMLInputElement).checked;
      for (const row of visible().rows) selection.toggle(state.rows, row.uid, checked);
      changedSelection(); return;
    }
    if (target.closest('[data-select-every-row]')) {
      for (const row of state.rows) selection.ids.add(row.uid);
      changedSelection();
    } else if (target.closest('[data-clear-selection]')) {
      selection.clear(); changedSelection(); grid.querySelector<HTMLInputElement>('[data-select-page]')?.focus();
    } else if (target.closest('[data-duplicate-rows]') && !state.running && !state.kit) {
      const result = duplicateRows(state.rows, selection.ids, actions.newUid);
      state.rows = result.rows; selection.clear();
      for (const row of result.copies) selection.ids.add(row.uid);
      if (result.copies[0]) reveal(result.copies[0].uid);
      actions.changed(); announce(tRaw('Duplicated {n} rows', { n: result.copies.length }));
    } else if (target.closest('[data-remove-rows]')) remove(selection.ids);
    else if (target.closest('[data-undo-remove]') && !state.running) {
      state.rows = restoreRows(state.rows, removed); selection.clear();
      for (const { row } of removed) selection.ids.add(row.uid);
      if (removed[0]) reveal(removed[0].row.uid);
      removed = []; actions.changed(); q<HTMLButtonElement>('[data-remove-rows]').focus(); announce(t('Rows restored'));
    } else {
      const pager = target.closest<HTMLElement>('[data-batch-page]');
      if (pager) {
        const direction = pager.dataset.batchPage!;
        page += direction === 'next' ? 1 : -1; actions.changed();
        const next = grid.querySelector<HTMLButtonElement>(`[data-batch-page="${direction}"]`);
        (next && !next.disabled ? next : grid.querySelector<HTMLButtonElement>('[data-batch-page]:not(:disabled)'))?.focus();
      }
    }
  };
  const keydown = (event: KeyboardEvent): void => {
    const target = event.target as HTMLElement;
    if (!target.matches('td, [data-select-row], [data-select-page]')) return;
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'a' && !target.matches('td')) {
      event.preventDefault(); event.stopPropagation();
      for (const row of state.rows) selection.ids.add(row.uid);
      changedSelection();
    } else if (event.shiftKey && event.key === ' ' && target.matches('td')) {
      const uid = target.dataset.row;
      if (uid) { event.preventDefault(); event.stopPropagation(); selection.toggle(state.rows, uid, !selection.ids.has(uid)); changedSelection(); }
    } else if (event.key === 'Escape' && selection.ids.size) {
      event.preventDefault(); event.stopPropagation(); selection.clear(); changedSelection();
    }
  };
  const edit = q<HTMLSelectElement>('[data-edit-selected]');
  const onEdit = (): void => {
    if (!edit.value) return;
    actions.edit(edit, edit.value, edit.selectedOptions[0]?.dataset.blocks === 'true');
    edit.value = '';
  };
  root.addEventListener('click', click);
  grid.addEventListener('keydown', keydown, true);
  edit.addEventListener('change', onEdit);
  return { selection, scope, visible, reveal, sync, reset, remove,
    destroy() { active = false; root.removeEventListener('click', click); grid.removeEventListener('keydown', keydown, true); edit.removeEventListener('change', onEdit); },
  };
}
