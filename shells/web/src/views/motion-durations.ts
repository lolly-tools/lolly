// SPDX-License-Identifier: MPL-2.0
/**
 * The design system's durations, offered beside a length field (plans/329).
 *
 * A field that takes a duration (the Motion group's Enter and Exit lengths, Choreograph's
 * Length) gets the design system's `duration` tokens as suggestions: a native `<datalist>`
 * on the number input, so the browser lists "Short", "Medium" and "Long" with their
 * values and typing any other number still works. Nothing is bound: choosing one writes
 * the number, as typing it would. Tokens outside the field's range are left out, and a
 * design system with none in range adds nothing at all.
 */
import { motionTokens } from '../lib/motion-tokens.ts';

let seq = 0;

export interface DurationOffer {
  /** The field's range, in its own unit. */
  min: number;
  max: number;
  /** The unit the field reads in. */
  unit: 'ms' | 's';
}

/**
 * Attach the design system's durations to `input`. The `<datalist>` goes into the
 * input's parent, so it leaves with the field. Call again to refresh; the old list is
 * replaced.
 */
export function offerMotionDurations(input: HTMLInputElement, offer: DurationOffer): void {
  const prev = input.list;
  const fits = motionTokens().durations
    .map((d) => ({ label: d.label, value: offer.unit === 's' ? d.ms / 1000 : d.ms }))
    .filter((d) => d.value >= offer.min && d.value <= offer.max);
  if (!fits.length) {
    if (prev) { prev.remove(); input.removeAttribute('list'); }
    return;
  }
  const list = document.createElement('datalist');
  list.id = prev?.id ?? `lolly-motion-durations-${++seq}`;
  for (const d of fits) {
    const o = document.createElement('option');
    o.value = String(Math.round(d.value * 1000) / 1000);
    o.label = d.label;
    list.appendChild(o);
  }
  prev?.remove();
  if (!input.parentElement) return;
  input.parentElement.appendChild(list);
  input.setAttribute('list', list.id);
}
