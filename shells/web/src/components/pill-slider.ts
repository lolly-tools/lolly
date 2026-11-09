// SPDX-License-Identifier: MPL-2.0
/**
 * A pill slider: one rounded bar that fills as its value rises, with its name and value
 * written across the bar. The whole pill is the hit area: press anywhere to set a value,
 * or drag along the pill. Sliders built this way line up in a neat grid with room between
 * them, because each one is a single box with nothing hanging off its ends.
 *
 * A native `<input type="range">` covers the pill, transparent, so pointer, touch,
 * keyboard (the arrows, Home, End, Page Up and Down) and assistive technology all get a
 * real slider. Its `aria-label` is the name; the text drawn on the pill is decoration. The
 * text is drawn twice: once in the ordinary ink, and once in the action colour's
 * on-colour, clipped to the fill, so the name and the value read clearly on either side
 * of the fill's edge. Styles: styles/parts/pill-slider.css (primitives layer), which
 * loads with this module, so a page that never shows one never fetches them.
 *
 * Markup comes from `pillSliderHtml()`; after the value changes, `showPillSlider()` moves
 * the fill and rewrites the value. The caller listens to the input's own `input` and
 * `change` events, so a pill slider drops into code written for a plain range input.
 */
import { escape as escapeHtml } from '../utils.ts';
import '../styles/parts/pill-slider.css';

export interface PillSliderSpec {
  /** The slider's name, written on the pill and read out as its label. */
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  /** Extra attributes for the input, such as `data-slider="fx"`. Trusted markup. */
  attrs?: string;
  /** The value as written on the pill. Two decimal places when not given. */
  format?: (v: number) => string;
}

const fmt = (spec: Pick<PillSliderSpec, 'format'>, v: number): string => (spec.format ?? ((n: number) => n.toFixed(2)))(v);
/** How far `v` is from `min` towards `max`, as a percentage of the pill. */
export const pillPercent = (v: number, min: number, max: number): number => max > min ? Math.min(100, Math.max(0, ((v - min) / (max - min)) * 100)) : 0;

/** A pill slider's markup. */
export function pillSliderHtml(spec: PillSliderSpec): string {
  const { label, min, max, step, value, attrs = '' } = spec;
  const name = escapeHtml(label);
  const shown = escapeHtml(fmt(spec, value));
  const text = (extra: string): string =>
    `<span class="pill-slider-text${extra}" aria-hidden="true"><span class="pill-slider-name">${name}</span><span class="pill-slider-value" data-pill-value>${shown}</span></span>`;
  return `<label class="pill-slider" style="--pill-pct: ${pillPercent(value, min, max).toFixed(2)}%">`
    + `<span class="pill-slider-fill" aria-hidden="true"></span>${text('')}${text(' pill-slider-text--over')}`
    + `<input type="range" class="pill-slider-input" min="${min}" max="${max}" step="${step}" value="${value}" aria-label="${name}" ${attrs}>`
    + '</label>';
}

/** Move a pill slider's fill to its input's value and write that value on the pill. */
export function showPillSlider(input: HTMLInputElement, format?: (v: number) => string): void {
  const pill = input.closest<HTMLElement>('.pill-slider');
  if (!pill) return;
  const v = Number(input.value);
  pill.style.setProperty('--pill-pct', `${pillPercent(v, Number(input.min), Number(input.max)).toFixed(2)}%`);
  const shown = fmt({ format }, v);
  for (const el of pill.querySelectorAll<HTMLElement>('[data-pill-value]')) el.textContent = shown;
}
