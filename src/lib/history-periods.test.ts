// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { historyPeriods } from './history-periods.ts';
import type { AppHistoryRow } from '../bridge/app-history.ts';
const row = (minute: number, slot = 'one', kind: AppHistoryRow['kind'] = 'revision'): AppHistoryRow => ({
  id: `${minute}:${slot}`, ref: String(minute), title: slot, toolId: 'design', slot, kind, at: new Date(2026, 8, 8, 12, minute).toISOString(),
});
test('nearby checkpoints group, while another creation, an export, inactivity and midnight split periods', () => {
  const rows = [row(59), row(55), row(54, 'two'), row(53), row(52, 'one', 'export'), row(51), row(30), row(29)];
  assert.deepEqual(historyPeriods(rows).map(group => group.length), [2, 1, 1, 1, 1, 2]);
  const nextDay = { ...row(0), at: new Date(2026, 8, 9, 0, 1).toISOString() };
  const yesterday = { ...row(1), at: new Date(2026, 8, 8, 23, 59).toISOString() };
  assert.equal(historyPeriods([nextDay, yesterday]).length, 2);
});
