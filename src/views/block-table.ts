// SPDX-License-Identifier: MPL-2.0
/** Present flat block objects in the shared table without changing saved data. */
import type {
  BlockFieldSpec,
  InputModelItem,
  InputValue,
  TableValue,
} from '../../../../engine/src/inputs.ts';
import { normalizeTableValue, parseTableText, looksLikeTable } from '@lolly/engine';

type BlockRow = Record<string, InputValue>;
const sources = new WeakMap<string[], BlockRow>();
const key = (s: string) => s.trim().toLowerCase();
const text = (v: unknown): string =>
  typeof v === 'object' && v !== null ? String((v as { ref?: string }).ref ?? '') : String(v ?? '');

export function blockTableFields(input: InputModelItem): BlockFieldSpec[] {
  const fields = input.fields ?? [];
  const order = [...new Set([...(input.tableColumns ?? []), ...fields.map((f) => f.id)])];
  return order.flatMap((id) => fields.filter((f) => f.id === id));
}

export function inputTableValue(input?: InputModelItem): TableValue {
  if (input?.type !== 'blocks')
    return normalizeTableValue(input?.value) ?? { columns: [], rows: [] };
  const fields = blockTableFields(input);
  const rows = Array.isArray(input.value) ? input.value : [];
  return {
    columns: fields.map((f) => f.label ?? f.id),
    rows: rows.map((row) => {
      const source = row && typeof row === 'object' && !Array.isArray(row) ? (row as BlockRow) : {};
      const cells = fields.map((f) => text(source[f.id]));
      sources.set(cells, source);
      return cells;
    }),
  };
}

/** DOM/grid reads clone cells; carry their original objects across those reads.
 * Structural edits then keep the same row arrays, so ids and unknown metadata
 * follow their row on delete/move. Pasted/new rows have no source. */
export function inheritTableSources(next: TableValue, previous: TableValue): TableValue {
  next.rows.forEach((row, i) => {
    const source = sources.get(previous.rows[i]!);
    if (source) sources.set(row, source);
  });
  return next;
}

export function tableInputValue(
  input: InputModelItem,
  table: TableValue,
  newRow: () => BlockRow
): InputValue {
  if (input.type !== 'blocks') return table;
  const fields = blockTableFields(input);
  return table.rows.map((cells) => {
    const source = sources.get(cells);
    const row = { ...(source ?? newRow()) };
    fields.forEach((field, i) => {
      const value = cells[i] ?? '';
      // Keep untouched token refs, false vs unset, and numeric values as saved.
      if (source && value === text(source[field.id])) return;
      row[field.id] =
        field.type === 'boolean'
          ? /^(true|yes|y|1|on|✓)$/i.test(value.trim())
          : field.type === 'number'
            ? Number.isFinite(Number(value))
              ? Number(value)
              : (field.default ?? 0)
            : value;
    });
    return row;
  });
}

/** Fixed-schema paste accepts labelled columns in any order, or a headerless
 * grid in display order. Plain multi-line lists fill the first (primary) field. */
export function parseInputTable(textValue: string, input: InputModelItem): TableValue | null {
  if (input.type !== 'blocks') return looksLikeTable(textValue) ? parseTableText(textValue) : null;
  const fields = blockTableFields(input);
  let parsed: TableValue | null;
  const csv = parseTableText(textValue);
  const hasHeadings = csv?.columns.some((c) =>
    fields.some((f) => [key(f.id), key(f.label ?? '')].includes(key(c)))
  );
  if (!textValue.includes('\t') && !/^\s*\|.*\|\s*$/m.test(textValue) && !hasHeadings) {
    const lines = textValue
      .trim()
      .split(/\r\n?|\n/)
      .filter((line) => line.trim());
    if (lines.length < 2) return null;
    parsed = { columns: [fields[0]?.label ?? ''], rows: lines.map((line) => [line]) };
  } else parsed = csv;
  if (!parsed) return null;
  const indices = parsed.columns.map((c) =>
    fields.findIndex((f) => [key(f.id), key(f.label ?? '')].includes(key(c)))
  );
  const headed = indices.some((i) => i >= 0);
  // Reject unknown/duplicate labelled columns instead of silently losing cells.
  if (headed && (indices.some((i) => i < 0) || new Set(indices).size !== indices.length))
    return null;
  if (!headed && parsed.columns.length > fields.length) return null;
  const rows = headed ? parsed.rows : [parsed.columns, ...parsed.rows];
  return {
    columns: fields.map((f) => f.label ?? f.id),
    rows: rows.map((cells) => {
      const row = fields.map(() => '');
      cells.forEach((cell, i) => {
        row[headed ? indices[i]! : i] = cell;
      });
      return row;
    }),
  };
}
