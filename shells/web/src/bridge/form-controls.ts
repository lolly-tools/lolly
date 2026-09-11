// SPDX-License-Identifier: MPL-2.0
/**
 * What a form control DISPLAYS, for the HTML→SVG walker.
 *
 * A control's value is not a text node. `<input value="hello">` has no children, a
 * `<select>`'s chosen option lives in a UA-rendered box, and a checkbox's tick is
 * drawn by the widget. So the walker's text pass - which walks text nodes - sees
 * nothing, draws the box, and produces the empty fields visible on every tool-page
 * snapshot (12 controls on the qr fixture alone: 3 text, 2 number, 3 select, 2 range,
 * 2 checkbox).
 *
 * This module answers only "what does it say / how far along is it", as pure
 * functions over a plain descriptor. The DOM adapter is a thin read at the bottom,
 * and the SVG assembly stays in export.ts. Split that way because the interesting
 * cases - a password's bullets, a placeholder standing in for an empty value, a
 * multi-select, a range with a backwards or degenerate min/max - are all decidable
 * without layout, and testing them through a browser would only make them slower to
 * check, not better checked.
 */

/** A control, flattened to the fields that decide what it shows. */
export interface ControlDesc {
  tag: 'input' | 'select' | 'textarea' | string;
  type?: string;
  value?: string;
  placeholder?: string;
  /** `<select>`: the labels of the currently selected options, in document order. */
  selectedLabels?: string[];
  checked?: boolean;
  /** `<input type=range|number>` bounds. Strings, as the attributes give them. */
  min?: string;
  max?: string;
}

export interface ControlText {
  text: string;
  /** True when `text` is the placeholder standing in for an empty value - the caller
   *  paints it in the ::placeholder colour rather than the control's own. */
  placeholder: boolean;
  /** Multi-line content is laid out with `pre-wrap`; single-line is centred and clipped. */
  multiline: boolean;
}

/** Input types whose box shows editable text. Deliberately a list, not a negation:
 *  a type we don't know about (or a future one) must fall through to "no text"
 *  rather than have some UA-drawn widget mislabelled as its raw value. */
const TEXTUAL = new Set([
  'text', 'search', 'url', 'tel', 'email', 'password', 'number',
  'date', 'time', 'datetime-local', 'month', 'week',
]);

/** Types drawn as a widget, where `value` is never shown to the reader. */
const WIDGET = new Set(['checkbox', 'radio', 'range', 'color', 'file', 'image', 'hidden']);

/** Button-ish inputs label themselves from `value`, and UA-default it when absent. */
const BUTTONISH: Record<string, string> = { submit: 'Submit', reset: 'Reset', button: '' };

/**
 * The text a control displays, or null if it displays none.
 *
 * Date and time types return the raw ISO value rather than the locale-formatted text
 * the browser paints ("2026-07-26", not "26/07/2026"). The formatted string lives in
 * a closed UA shadow root with no API to read it, so the honest options were the ISO
 * value or nothing; the value at least carries the information.
 */
export function controlText(d: ControlDesc): ControlText | null {
  const tag = d.tag.toLowerCase();

  if (tag === 'textarea') {
    const v = d.value ?? '';
    if (v) return { text: v, placeholder: false, multiline: true };
    return d.placeholder ? { text: d.placeholder, placeholder: true, multiline: true } : null;
  }

  if (tag === 'select') {
    // Multiple selections render one per row; a select with nothing selected (an
    // empty <select>, or one whose only option is disabled) genuinely shows blank.
    const labels = (d.selectedLabels ?? []).filter((s) => s !== '');
    if (!labels.length) return null;
    return { text: labels.join('\n'), placeholder: false, multiline: labels.length > 1 };
  }

  if (tag !== 'input') return null;
  const type = (d.type || 'text').toLowerCase();
  if (WIDGET.has(type)) return null;

  if (type in BUTTONISH) {
    const label = d.value || BUTTONISH[type]!;
    return label ? { text: label, placeholder: false, multiline: false } : null;
  }
  if (!TEXTUAL.has(type)) return null;

  const v = d.value ?? '';
  if (!v)
    return d.placeholder ? { text: d.placeholder, placeholder: true, multiline: false } : null;
  // A password's characters must never reach the output. The walker's whole job is
  // to reproduce what is on screen, and what is on screen is bullets.
  if (type === 'password')
    return { text: '•'.repeat(Math.min(v.length, 64)), placeholder: false, multiline: false };
  return { text: v, placeholder: false, multiline: false };
}

/**
 * How far along a range control's thumb sits, as 0..1.
 *
 * Mirrors the HTML range-state algorithm's clamping rather than trusting the value:
 * `max` below `min` collapses the range to `min` (section range state), a non-numeric or
 * absent value falls back to the midpoint, and a zero-width range is 0 - all of which
 * appear in real markup and none of which should produce a NaN in a coordinate.
 */
export function rangeFraction(d: ControlDesc): number {
  const num = (s: string | undefined, dflt: number) => {
    const n = Number.parseFloat(s ?? '');
    return Number.isFinite(n) ? n : dflt;
  };
  const min = num(d.min, 0);
  const max = Math.max(num(d.max, 100), min);
  const span = max - min;
  const v = num(d.value, min + span / 2);
  if (span <= 0) return 0;
  return Math.min(1, Math.max(0, (v - min) / span));
}

/** True for the controls export.ts paints as geometry rather than text. */
export function isWidgetControl(d: ControlDesc): boolean {
  return d.tag.toLowerCase() === 'input' && WIDGET.has((d.type || 'text').toLowerCase());
}

/** Read a live element into a descriptor. The only DOM-aware part of this module. */
export function describeControl(el: Element): ControlDesc | null {
  const tag = el.tagName.toLowerCase();
  if (tag !== 'input' && tag !== 'select' && tag !== 'textarea') return null;
  const a = el as HTMLInputElement & HTMLSelectElement & HTMLTextAreaElement;
  return {
    tag,
    type: tag === 'input' ? a.type : undefined,
    value: a.value,
    placeholder: tag === 'select' ? undefined : a.placeholder,
    // `.label` falls back to the option's text, which is what the closed listbox
    // paints; `.text` alone would lose an explicit label="" attribute.
    selectedLabels:
      tag === 'select'
        ? Array.from(a.selectedOptions ?? []).map((o) => o.label || o.text)
        : undefined,
    checked: tag === 'input' ? a.checked : undefined,
    min: tag === 'input' ? a.min : undefined,
    max: tag === 'input' ? a.max : undefined,
  };
}
