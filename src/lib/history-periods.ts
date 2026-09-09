// SPDX-License-Identifier: MPL-2.0
import type { AppHistoryRow } from '../bridge/app-history.ts';

/** Inferred editing periods from retained checkpoints, never a click log or an
 * assertion that the user edited continuously. A different creation breaks one. */
export function historyPeriods(rows: readonly AppHistoryRow[]): AppHistoryRow[][] {
  const periods: AppHistoryRow[][] = [];
  for (const row of rows) {
    const last = periods.at(-1)?.at(-1);
    const sameDay = last && new Date(last.at).toDateString() === new Date(row.at).toDateString();
    if (last?.kind === 'revision' && row.kind === 'revision' && row.slot === last.slot && sameDay
      && Date.parse(last.at) - Date.parse(row.at) <= 600_000) periods.at(-1)!.push(row);
    else periods.push([row]);
  }
  return periods;
}
