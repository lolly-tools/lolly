// SPDX-License-Identifier: MPL-2.0
/**
 * `numField` - the compact numeric control the Design inspector is built from.
 *
 * One number, one short leading label, an optional unit. Three ways to change it,
 * all of which produce exactly ONE commit per gesture, because every write behind
 * it is `model.setField`, which is one undo step:
 *
 *   • SCRUB. Press the label and drag sideways. The label is the handle, not the
 *     field, so a click on the number still puts a caret in it for typing. One
 *     step per pixel, Shift for ten of them, Alt for a tenth. `onPreview` fires
 *     per move so a caller can mirror a slider beside it; `onCommit` fires once,
 *     on release.
 *   • ARROW KEYS. Up/Down step by the same amounts. Each keystroke repaints and
 *     previews at once, but the commit is held open for {@link KEY_COALESCE_MS}
 *     and re-armed by the next keystroke, so holding Down is one undo step and
 *     not forty.
 *   • TYPING. On Enter or blur the text is read as an expression:
 *     `+10` and `-5` are relative, `50%` is a share of the current value,
 *     `1920/2` and `3*4` are arithmetic, a plain number is itself, a unit written
 *     after a number CONVERTS when the field has a unit of the same kind (`210mm`
 *     in a px field is 793.7, `400ms` in a seconds field is 0.4) and is ignored
 *     otherwise (`30deg` in a plain field is 30), and a comma is the decimal
 *     separator the app's other 25 languages type. Nonsense reverts: a character
 *     the grammar cannot read puts the old value back rather than being deleted so
 *     the rest can be parsed without it. Escape reverts.
 *
 * SPINBUTTON. The input carries `role="spinbutton"` with `aria-valuenow` and the
 * caller's min/max, because the arrow keys change `input.value` from script and a
 * plain text input announces none of that. Every repaint - a key, a scrub move, a
 * model echo - writes the value again, so what is announced is what is shown.
 *
 * A value equal to the one already showing is never committed, so re-typing what
 * is there, or scrubbing out and back, costs no undo step at all.
 *
 * WHY NOT lib/scrub.ts. That helper drags the INPUT (Pro's Width/Height cells,
 * Colour Lab's L/C/H), which means a press on the number is ambiguous between
 * typing and scrubbing, and it has no keyboard or expression half. This control
 * has a dedicated handle and owns the whole gesture set, so it keeps its own,
 * smaller drag loop rather than bending that one.
 *
 * MIXED. A multi-selection whose rows disagree shows the "Mixed" placeholder
 * rather than one row's value pretending to speak for the rest. Typing into it,
 * or scrubbing it, applies to everything the caller writes to; the scrub counts
 * from zero, since there is no shared number to count from.
 *
 * DOM ONLY. No model, no storage, no i18n beyond the one placeholder: the caller
 * owns what a commit means.
 */
import { t } from '../i18n.ts';
import { isUnit, toUnit } from '@lolly/engine';

/** How long an arrow-key burst stays open before it commits as one gesture. */
export const KEY_COALESCE_MS = 300;

/** Pointer travel before a press on the label counts as a scrub rather than a click. */
const SCRUB_SLOP = 2;

export interface NumFieldOpts {
  /** Stable identity for the control, written to `data-nf` so a caller can re-find it. */
  id: string;
  /**
   * The leading label: short glyph text ('X', 'Y', 'W', 'H', 'R'), or an element
   * a caller built itself (an icon, say). An empty string draws a plain grip, for
   * rows that already carry their name in their own label cell.
   */
  label: string | Node;
  /** The accessible name, when the label is a glyph that does not read as one. */
  name?: string;
  /** The current value, or 'mixed' when the rows behind it disagree. */
  value: number | 'mixed';
  /**
   * Trailing unit text (px, %, s). A length unit (px, pt, pc, mm, cm, in) or a time
   * unit (s, ms) is also what a typed suffix converts INTO - see {@link parseNumExpr};
   * any other unit text is shown and nothing more.
   */
  unit?: string;
  min?: number;
  max?: number;
  /** One step: the scrub's per-pixel amount and the arrow keys' amount. Default 1. */
  step?: number;
  /** Decimals kept. Default: as many as `step` has. */
  precision?: number;
  /** Forces the mixed state regardless of `value`. */
  mixed?: boolean;
  /** The one write per gesture. */
  onCommit(v: number): void;
  /** Live value during a scrub or an arrow burst - for mirroring a slider, not for writing. */
  onPreview?(v: number): void;
}

export interface NumFieldHandle {
  el: HTMLElement;
  /** The text input, so a caller can focus or select it. */
  input: HTMLInputElement;
  /** Repaint from the model. Ignored while the user has unsent text in the field. */
  set(v: number | 'mixed'): void;
  /**
   * True while a pointer is down on the handle - the scrub gesture is in flight.
   *
   * The press is `preventDefault`ed so a click on the label does not focus the input,
   * which means a host looking for "is the user in the middle of something" cannot see
   * this one through `document.activeElement`. A host that rebuilds on a model change
   * has to ask, or its rebuild destroys the field under the user's finger.
   */
  scrubbing(): boolean;
  destroy(): void;
}

/** Decimals in a step, so `0.01` keeps two and `1` keeps none. */
function decimalsOf(step: number): number {
  const s = String(step);
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : Math.min(6, s.length - dot - 1);
}

/**
 * Arithmetic over `+ - * /` and parentheses, by recursive descent.
 *
 * Hand-written rather than `new Function`: this reads text a user typed, and the
 * tool's own hooks already run unsandboxed, so nothing here opens a second door
 * into the realm. Anything the grammar does not accept returns null, and the
 * caller reverts.
 */
function evalArith(src: string): number | null {
  const raw = src.match(/\d*\.?\d+|[()+\-*/]|\s+/g);
  if (!raw) return null;
  const tok = raw.filter((x) => x.trim() !== '');
  // Every character had to be consumed by a token; a stray one means junk, not maths.
  if (tok.join('') !== src.replace(/\s+/g, '')) return null;
  let i = 0;
  const peek = (): string | undefined => tok[i];
  const factor = (): number | null => {
    const cur = peek();
    if (cur === '+' || cur === '-') {
      i++;
      const v = factor();
      return v == null ? null : (cur === '-' ? -v : v);
    }
    if (cur === '(') {
      i++;
      const v = expr();
      if (v == null || tok[i] !== ')') return null;
      i++;
      return v;
    }
    if (cur != null && /^\d*\.?\d+$/.test(cur)) { i++; return parseFloat(cur); }
    return null;
  };
  const term = (): number | null => {
    let left = factor();
    if (left == null) return null;
    while (peek() === '*' || peek() === '/') {
      const op = tok[i++]!;
      const right = factor();
      if (right == null) return null;
      if (op === '/' && right === 0) return null;
      left = op === '*' ? left * right : left / right;
    }
    return left;
  };
  const expr = (): number | null => {
    let left = term();
    if (left == null) return null;
    while (peek() === '+' || peek() === '-') {
      const op = tok[i++]!;
      const right = term();
      if (right == null) return null;
      left = op === '+' ? left + right : left - right;
    }
    return left;
  };
  const out = expr();
  return out != null && i === tok.length && Number.isFinite(out) ? out : null;
}

/**
 * What a typed string means against the value already there. Exported because it
 * is the whole typed half of the control and deserves its own test.
 *
 * A leading `+` or `-` on a bare number is RELATIVE ('-5' takes five off), which
 * is what a designer means by it. An absolute negative is still reachable as
 * `(-5)` or `0-5`, and by the arrow keys and the scrub, which have no such
 * ambiguity to resolve.
 */
export function parseNumExpr(raw: string, current: number, unit?: string): number | null {
  let cleaned = raw.trim();
  if (!cleaned) return null;
  // A comma is the decimal separator in most of the languages the app speaks, and it
  // is what `inputMode="decimal"` offers on their phone keypads, so '12,5' is 12.5
  // (and '12,5mm' is 12.5 mm). Three digits after it is the one case that is not
  // readable either way - '1,000' is a thousand as often as it is one - so that one
  // falls through to the junk guard and reverts rather than being read as 1.
  const dec = /^([+-]?\s*\d+),(\d+)(\s*\p{L}*)$/u.exec(cleaned);
  if (dec && dec[2]!.length !== 3) cleaned = `${dec[1]}.${dec[2]}${dec[3]}`;
  // A unit may stand directly after a number, at the end of the text or before an
  // operator. When the field has a unit of the same kind it CONVERTS: '210mm' in a px
  // field is 793.7, '8.5in' is 816, '400ms' in a seconds field is 0.4, and both halves
  // of '100mm + 20px' are read in their own unit (plans/184 R10). Anything else - a
  // unit of another kind, or a field with no unit - just drops the suffix, so '120px',
  // '400 ms' and '30deg' are their numbers. Everything else keeps every character it
  // had, so evalArith's junk guard can see it and the caller reverts. Deleting each
  // unreadable character wherever it sat is what silently made '12,5' into 125, '1e3'
  // into 13 and '12px34' into 1234.
  cleaned = cleaned.replace(/(\d*\.?\d+)\s*(\p{L}+)(?=$|[\s+\-*/)])/gu, (_m, num: string, suffix: string) => {
    const v = convertSuffix(parseFloat(num), suffix, unit);
    return v == null ? num : String(v);
  }).trim();
  const pct = /^([+-]?)\s*(\d*\.?\d+)\s*%$/.exec(cleaned);
  if (pct) {
    const part = current * (parseFloat(pct[2]!) / 100);
    if (!Number.isFinite(part)) return null;
    if (pct[1] === '+') return current + part;
    if (pct[1] === '-') return current - part;
    return part;
  }
  const rel = /^([+-])\s*(\d*\.?\d+)$/.exec(cleaned);
  if (rel) {
    const n = parseFloat(rel[2]!);
    return rel[1] === '+' ? current + n : current - n;
  }
  return evalArith(cleaned);
}

/** Seconds per time unit a field or a typed suffix may name. */
const TIME_UNITS: Record<string, number> = { ms: 0.001, s: 1 };

/**
 * A typed `value suffix` re-expressed in the field's unit, or null when the two are not
 * of one kind - the caller then keeps the bare number, as it always did.
 */
function convertSuffix(value: number, suffix: string, fieldUnit: string | undefined): number | null {
  if (!fieldUnit || !Number.isFinite(value)) return null;
  const s = suffix.toLowerCase();
  const f = fieldUnit.toLowerCase();
  if (s === f) return value;
  if (isUnit(f) && isUnit(s)) return toUnit({ value, unit: s }, f);
  if (f in TIME_UNITS && s in TIME_UNITS) return value * TIME_UNITS[s]! / TIME_UNITS[f]!;
  return null;
}

export function numField(opts: NumFieldOpts): NumFieldHandle {
  const step = typeof opts.step === 'number' && Number.isFinite(opts.step) && opts.step > 0 ? opts.step : 1;
  const precision = typeof opts.precision === 'number' && Number.isFinite(opts.precision)
    ? Math.max(0, Math.min(6, Math.round(opts.precision)))
    : decimalsOf(step);
  const min = typeof opts.min === 'number' && Number.isFinite(opts.min) ? opts.min : -Infinity;
  const max = typeof opts.max === 'number' && Number.isFinite(opts.max) ? opts.max : Infinity;
  const quant = 10 ** precision;

  /** Clamped and rounded to the field's own precision, so what is shown is what commits. */
  const fix = (v: number): number => {
    const r = Math.round(v * quant) / quant;
    return r < min ? min : (r > max ? max : r);
  };
  const fmt = (v: number): string => {
    const r = Math.round(v * quant) / quant;
    return Object.is(r, -0) ? '0' : String(r);
  };

  /** The last value the model told us about, or null while the rows disagree. */
  let base: number | null = opts.mixed || opts.value === 'mixed' ? null : fix(opts.value as number);
  /** True once the user has typed something the field has not read back yet. */
  let dirty = false;
  let destroyed = false;

  // ── markup ────────────────────────────────────────────────────────────────
  const el = document.createElement('div');
  el.className = 'num-field';
  el.setAttribute('data-num-field', opts.id);

  const labelText = typeof opts.label === 'string' ? opts.label : '';
  const name = opts.name || labelText || opts.id;
  const lbl = document.createElement('span');
  lbl.className = `num-field-lbl${typeof opts.label === 'string' && opts.label === '' ? ' num-field-lbl--grip' : ''}`;
  // The handle is decoration for a screen reader: the input beside it already
  // carries the name, and a second copy of 'X' announced before every number is
  // noise. It is also deliberately not focusable - five geometry fields in a row
  // would otherwise be ten tab stops, and the arrow keys do the same job.
  lbl.setAttribute('aria-hidden', 'true');
  lbl.setAttribute('data-tip', name);
  if (typeof opts.label === 'string') lbl.textContent = opts.label;
  else lbl.appendChild(opts.label);

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'num-field-in';
  input.inputMode = 'decimal';
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.setAttribute('data-nf', opts.id);
  input.setAttribute('aria-label', name);
  // A spinbutton, not a plain text box: the arrow keys write `input.value` from script,
  // and a text input announces nothing when script changes it. The role is what makes a
  // screen reader read the new number on every ArrowUp, and the bounds the callers
  // already enforce in `fix` are what tell it the value has stopped moving at the end.
  input.setAttribute('role', 'spinbutton');
  if (Number.isFinite(min)) input.setAttribute('aria-valuemin', String(min));
  if (Number.isFinite(max)) input.setAttribute('aria-valuemax', String(max));
  el.append(lbl, input);

  if (opts.unit) {
    const u = document.createElement('i');
    u.className = 'num-field-unit';
    u.setAttribute('aria-hidden', 'true');
    u.textContent = opts.unit;
    el.appendChild(u);
  }

  /**
   * What the spinbutton reports, kept beside what the box shows. The unit rides in
   * `aria-valuetext` because the unit element itself is `aria-hidden`, so without it
   * "350" is announced for a width and for a duration alike; a mixed field has no
   * number to report at all, and says so.
   */
  function announce(v: number | null): void {
    if (v == null) {
      input.removeAttribute('aria-valuenow');
      input.setAttribute('aria-valuetext', t('Mixed'));
      return;
    }
    input.setAttribute('aria-valuenow', fmt(v));
    if (opts.unit) input.setAttribute('aria-valuetext', `${fmt(v)} ${opts.unit}`);
    else input.removeAttribute('aria-valuetext');
  }

  function paint(): void {
    if (base == null) {
      input.value = '';
      input.placeholder = t('Mixed');
    } else {
      input.value = fmt(base);
      input.placeholder = '';
    }
    announce(base);
    dirty = false;
  }
  paint();

  // ── commits ───────────────────────────────────────────────────────────────

  /** The one write. Silent when the value has not moved. */
  function commit(v: number): void {
    const next = fix(v);
    if (base != null && next === base) { paint(); return; }
    base = next;
    paint();
    opts.onCommit(next);
  }

  let keyTimer: ReturnType<typeof setTimeout> | null = null;
  let keyPending: number | null = null;

  function flushKeys(): void {
    if (keyTimer != null) { clearTimeout(keyTimer); keyTimer = null; }
    const v = keyPending;
    keyPending = null;
    if (v != null) commit(v);
  }
  /** Hold the commit open so a burst of arrow keys is one gesture, and one undo step. */
  function armKeys(v: number): void {
    keyPending = v;
    if (keyTimer != null) clearTimeout(keyTimer);
    keyTimer = setTimeout(() => { keyTimer = null; flushKeys(); }, KEY_COALESCE_MS);
  }
  function cancelKeys(): void {
    if (keyTimer != null) { clearTimeout(keyTimer); keyTimer = null; }
    keyPending = null;
  }

  /** Read what is typed and commit it, or put the last known value back. */
  function applyTyped(): void {
    if (!dirty) return;
    const v = parseNumExpr(input.value, base ?? 0, opts.unit);
    if (v == null) { paint(); return; }
    commit(v);
  }

  function revert(): void {
    cancelKeys();
    paint();
    if (base != null) opts.onPreview?.(base);
  }

  // ── keyboard ──────────────────────────────────────────────────────────────

  function onKey(ev: KeyboardEvent): void {
    if (ev.key === 'ArrowUp' || ev.key === 'ArrowDown') {
      ev.preventDefault();
      const mult = ev.shiftKey ? 10 : (ev.altKey ? 0.1 : 1);
      const from = keyPending ?? parseNumExpr(input.value, base ?? 0, opts.unit) ?? base ?? 0;
      const next = fix(from + (ev.key === 'ArrowUp' ? 1 : -1) * step * mult);
      input.value = fmt(next);
      announce(next);
      dirty = false;
      opts.onPreview?.(next);
      armKeys(next);
      return;
    }
    if (ev.key === 'Enter') {
      ev.preventDefault();
      flushKeys();
      applyTyped();
      return;
    }
    if (ev.key === 'Escape') {
      // Handled here and nowhere else: the Design inspector's own root key gate
      // reads Escape as "back out of the reveal", which would move focus out of a
      // field the user was only trying to correct.
      ev.preventDefault();
      ev.stopPropagation();
      revert();
    }
  }

  const onInput = (): void => { dirty = true; };
  const onBlur = (): void => { flushKeys(); applyTyped(); };

  input.addEventListener('keydown', onKey);
  input.addEventListener('input', onInput);
  input.addEventListener('blur', onBlur);

  // ── scrub ─────────────────────────────────────────────────────────────────

  let dragId: number | null = null;
  let dragX = 0;
  let dragBase = 0;
  let dragValue: number | null = null;
  let moved = false;

  function onDown(ev: PointerEvent): void {
    if (ev.button != null && ev.button !== 0) return;
    dragId = ev.pointerId;
    dragX = ev.clientX;
    dragBase = base ?? 0;
    dragValue = null;
    moved = false;
    try { lbl.setPointerCapture?.(ev.pointerId); } catch { /* pointer already gone */ }
    lbl.addEventListener('pointermove', onMove);
    lbl.addEventListener('pointerup', onUp);
    lbl.addEventListener('pointercancel', onUp);
    ev.preventDefault();
  }

  function onMove(ev: PointerEvent): void {
    if (dragId == null) return;
    const dx = ev.clientX - dragX;
    if (!moved) {
      if (Math.abs(dx) < SCRUB_SLOP) return;
      moved = true;
      el.classList.add('is-scrubbing');
      document.body.classList.add('is-scrubbing');
    }
    const mult = ev.shiftKey ? 10 : (ev.altKey ? 0.1 : 1);
    const next = fix(dragBase + dx * step * mult);
    if (next === dragValue) return;
    dragValue = next;
    input.value = fmt(next);
    announce(next);
    dirty = false;
    opts.onPreview?.(next);
    ev.preventDefault();
  }

  function onUp(): void {
    if (dragId == null) return;
    try { lbl.releasePointerCapture?.(dragId); } catch { /* never captured */ }
    lbl.removeEventListener('pointermove', onMove);
    lbl.removeEventListener('pointerup', onUp);
    lbl.removeEventListener('pointercancel', onUp);
    dragId = null;
    el.classList.remove('is-scrubbing');
    document.body.classList.remove('is-scrubbing');
    if (!moved) { input.focus(); input.select(); return; }
    if (dragValue != null) commit(dragValue);
    dragValue = null;
  }

  lbl.addEventListener('pointerdown', onDown);

  return {
    el,
    input,
    set(v: number | 'mixed'): void {
      if (destroyed) return;
      base = v === 'mixed' ? null : fix(v);
      // Half-typed text is the user's, not the model's: overwriting it mid-edit
      // deletes what they were saying.
      if (dirty && typeof document !== 'undefined' && document.activeElement === input) return;
      paint();
    },
    scrubbing: () => dragId != null,
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      // A pending arrow burst is dropped, not flushed: destroy runs from a rebuild,
      // and committing from inside one would re-enter the render that is tearing
      // this field down. The field's own blur flushes it in every real path.
      cancelKeys();
      // A torn-down field is not mid-gesture, whatever the pointer was doing: a host
      // asking `scrubbing()` about a handle it has already dropped gets the truth.
      dragId = null;
      input.removeEventListener('keydown', onKey);
      input.removeEventListener('input', onInput);
      input.removeEventListener('blur', onBlur);
      lbl.removeEventListener('pointerdown', onDown);
      lbl.removeEventListener('pointermove', onMove);
      lbl.removeEventListener('pointerup', onUp);
      lbl.removeEventListener('pointercancel', onUp);
      document.body.classList.remove('is-scrubbing');
      el.remove();
    },
  };
}
