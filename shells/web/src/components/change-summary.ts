// SPDX-License-Identifier: MPL-2.0
import { escape as esc } from '../utils.ts';

export interface ChangeSummaryRow { label: string; detail: string }
/** A readable action scope, using a native definition list and the shared card. */
export function changeSummaryHtml(label: string, rows: readonly ChangeSummaryRow[]): string {
  return `<div class="card card--sub change-summary"><h4>${esc(label)}</h4><dl>${rows.map(row => `<div><dt>${esc(row.label)}</dt><dd>${esc(row.detail)}</dd></div>`).join('')}</dl></div>`;
}
