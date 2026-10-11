// SPDX-License-Identifier: MPL-2.0
/** Bounded sheets, columns and cells; row keys are chosen explicitly. */
import type { ComparisonLocation, ComparisonOptions, ComparisonTable } from '@lolly-tools/core/host-v1';
import { comparisonValue, COMPARE_MAX_TEXT, type ComparisonBudget } from './compare-budget.ts';
import { keyedComparisonPairs, positionalComparisonPairs, uniqueComparisonKeys, type ComparisonPair } from './compare-alignment.ts';

function withinLimits(tables: readonly ComparisonTable[], budget: ComparisonBudget): boolean {
  if (tables.length > 32) { budget.limit('Only 32 tables per source can be compared.'); return false; }
  let cells = 0, chars = 0;
  for (const table of tables) {
    if (typeof table.name !== 'string' || table.name.length > 1024 || table.columns.length > 512 || table.rows.length > 10_000) { budget.limit('A table exceeds the name, 512-column or 10,000-row limit.'); return false; }
    chars += table.name.length;
    for (const label of table.columns) { if (typeof label !== 'string') { budget.limit('Table column labels must be text.'); return false; } chars += label.length; }
    for (const row of table.rows) {
      if (!budget.spend() || row.length > table.columns.length) { budget.limit('Some table cells have no declared column or exceed the work limit.'); return false; }
      cells += table.columns.length;
      if (cells > 100_000) { budget.limit('Table content exceeds the 100,000-cell comparison limit.'); return false; }
      for (const cell of row) {
        if (typeof cell === 'string') chars += cell.length;
        else if (!(cell === null || typeof cell === 'boolean' || typeof cell === 'number' && Number.isFinite(cell))) { budget.limit('Only text, finite numbers, booleans and empty table cells are supported.'); return false; }
      }
      if (chars > COMPARE_MAX_TEXT) { budget.limit('Table text exceeds the 2 MiB comparison limit.'); return false; }
    }
    if (chars > COMPARE_MAX_TEXT) { budget.limit('Table text exceeds the 2 MiB comparison limit.'); return false; }
  }
  return true;
}
function add(budget: ComparisonBudget, kind: 'added' | 'removed' | 'changed' | 'moved', before: unknown, after: unknown, left?: ComparisonLocation, right?: ComparisonLocation): void {
  const a = comparisonValue(before), b = comparisonValue(after);
  budget.add({ kind, ...(left ? { before: left, beforeValue: a.text } : {}), ...(right ? { after: right, afterValue: b.text } : {}), valueTruncated: a.truncated || b.truncated });
}
const location = (table: ComparisonTable, row?: number, column?: number): ComparisonLocation => ({ path: [table.name, ...(row === undefined ? [] : [row]), ...(column === undefined ? [] : [column])], table: table.name, ...(row === undefined ? {} : { row: row + 1 }), ...(column === undefined ? {} : { column: table.columns[column] || String(column + 1) }) });
function rowKeys(table: ComparisonTable, label: string): Map<string, number> | undefined {
  const columns = table.columns.map((value, index) => value === label ? index : -1).filter(index => index !== -1);
  if (columns.length !== 1) return undefined;
  const keys = table.rows.map(row => { const value = row[columns[0]!]; return value === null || value === undefined || value === '' ? '' : `${typeof value}:${String(value)}`; });
  return uniqueComparisonKeys(keys);
}
function compareTable(before: ComparisonTable, after: ComparisonTable, options: ComparisonOptions, budget: ComparisonBudget): boolean {
  const leftColumns = uniqueComparisonKeys(before.columns), rightColumns = uniqueComparisonKeys(after.columns);
  const columns = leftColumns && rightColumns ? keyedComparisonPairs(leftColumns, rightColumns) : positionalComparisonPairs(before.columns.length, after.columns.length);
  if (!leftColumns || !rightColumns) budget.limitations.add('Blank or duplicate column labels were compared by column position.');
  for (const pair of columns) {
    if (!budget.spend()) return false;
    const a = pair.before === undefined ? undefined : before.columns[pair.before], b = pair.after === undefined ? undefined : after.columns[pair.after];
    const left = pair.before === undefined ? undefined : location(before, undefined, pair.before), right = pair.after === undefined ? undefined : location(after, undefined, pair.after);
    if (pair.moved) add(budget, 'moved', a, b, left, right);
    if (a !== b) add(budget, a === undefined ? 'added' : b === undefined ? 'removed' : 'changed', a, b, left, right);
  }
  const leftKeys = options.tableRowKey ? rowKeys(before, options.tableRowKey) : undefined, rightKeys = options.tableRowKey ? rowKeys(after, options.tableRowKey) : undefined;
  const keyed = !!(leftKeys && rightKeys);
  if (options.tableRowKey && !keyed) budget.limitations.add('The selected row key is missing, blank or duplicated. Every row in that table was compared by position; ambiguous rows were not matched by key.');
  const rows: ComparisonPair[] = keyed ? keyedComparisonPairs(leftKeys!, rightKeys!) : positionalComparisonPairs(before.rows.length, after.rows.length);
  for (const pair of rows) {
    if (!budget.spend()) return keyed;
    const a = pair.before === undefined ? undefined : before.rows[pair.before], b = pair.after === undefined ? undefined : after.rows[pair.after];
    const left = pair.before === undefined ? undefined : location(before, pair.before), right = pair.after === undefined ? undefined : location(after, pair.after);
    if (!a || !b) { add(budget, a ? 'removed' : 'added', a, b, left, right); continue; }
    if (pair.moved) add(budget, 'moved', a, b, left, right);
    for (const column of columns) {
      if (!budget.spend()) return keyed;
      const av = column.before === undefined ? undefined : a[column.before], bv = column.after === undefined ? undefined : b[column.after];
      if (av === bv) continue;
      add(budget, av === undefined ? 'added' : bv === undefined ? 'removed' : 'changed', av, bv,
        column.before === undefined ? undefined : location(before, pair.before, column.before), column.after === undefined ? undefined : location(after, pair.after, column.after));
    }
  }
  return keyed;
}
export function compareTables(before: readonly ComparisonTable[], after: readonly ComparisonTable[], options: ComparisonOptions, budget: ComparisonBudget): 'table-key' | 'table-position' {
  if (!withinLimits(before, budget) || !withinLimits(after, budget)) return 'table-position';
  const left = uniqueComparisonKeys(before.map(table => table.name)), right = uniqueComparisonKeys(after.map(table => table.name));
  const pairs = left && right ? keyedComparisonPairs(left, right) : positionalComparisonPairs(before.length, after.length);
  if (!left || !right) budget.limitations.add('Blank or duplicate table names were compared by table position.');
  let allKeyed = !!options.tableRowKey;
  for (const pair of pairs) {
    if (!budget.spend()) break;
    const a = pair.before === undefined ? undefined : before[pair.before], b = pair.after === undefined ? undefined : after[pair.after];
    if (!a || !b) { add(budget, a ? 'removed' : 'added', a, b, a ? location(a) : undefined, b ? location(b) : undefined); continue; }
    if (pair.moved) add(budget, 'moved', a.name, b.name, location(a), location(b));
    if (a.name !== b.name) add(budget, 'changed', a.name, b.name, location(a), location(b));
    if (!compareTable(a, b, options, budget)) allKeyed = false;
  }
  return allKeyed ? 'table-key' : 'table-position';
}
