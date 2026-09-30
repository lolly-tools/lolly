// SPDX-License-Identifier: MPL-2.0
/** A bounded metric with an accessible description; null means unmeasured. */
import { escape as esc } from '../utils.ts';
import '../styles/parts/metric-ring.css';
export function metricRing(value: number | null, label: string, description: string): string {
  const amount =
    value === null || !Number.isFinite(value) ? null : Math.max(0, Math.min(100, value));
  return `<span class="metric-ring${amount === null ? ' is-unknown' : ''}" role="img" aria-label="${esc(description)}" title="${esc(description)}"><svg viewBox="0 0 48 48" aria-hidden="true"><circle class="metric-ring-track" cx="24" cy="24" r="20"/>${amount === null ? '' : `<circle class="metric-ring-value" cx="24" cy="24" r="20" pathLength="100" stroke-dasharray="${amount} 100"/>`}</svg><span aria-hidden="true">${esc(label)}</span></span>`;
}
