// SPDX-License-Identifier: MPL-2.0
import type { TableValue } from '../../../../engine/src/inputs.ts';

/** Read live cells: input-panel repaint waits until typing finishes. */
export function readTableCells(wrap: HTMLElement): TableValue {
  return {
    columns: [...wrap.querySelectorAll<HTMLInputElement>('thead .table-cell')].map((h) => h.value),
    rows: [...wrap.querySelectorAll('tbody tr')]
      .filter(
        (tr) =>
          !tr.hasAttribute('data-table-ghost') ||
          [...tr.querySelectorAll<HTMLInputElement>('.table-cell')].some(
            (c) => c.value.trim() !== ''
          )
      )
      .map((tr) => [...tr.querySelectorAll<HTMLInputElement>('.table-cell')].map((c) => c.value)),
  };
}

export function wireTableEnter(cell: HTMLElement, wrap: HTMLElement, id: string): void {
  cell.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
    e.preventDefault();
    const [, , row, col] = cell.dataset.fieldId!.split(':');
    wrap
      .querySelector<HTMLElement>(
        `[data-field-id="${CSS.escape(`${id}:t:${Number(row) + 1}:${col}`)}"]`
      )
      ?.focus();
  });
}

export function wireTableRowMoves(
  wrap: HTMLElement,
  read: () => TableValue,
  commit: (value: TableValue) => void
): void {
  wrap.querySelectorAll<HTMLButtonElement>('[data-table-move-up]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const table = read(),
        row = Number(btn.dataset.tableMoveUp);
      if (row > 0) {
        [table.rows[row - 1], table.rows[row]] = [table.rows[row]!, table.rows[row - 1]!];
        commit(table);
      }
    });
  });
}
