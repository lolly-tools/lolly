// SPDX-License-Identifier: MPL-2.0
/**
 * Sidebar input-sync decision logic.
 *
 * renderInputs() (in tool.js) rebuilds the whole control panel's innerHTML and
 * re-wires every listener - necessary on first render or a structural change, but
 * pure waste on a keystroke, where the only thing that changed is a value the
 * edited field already shows. These helpers decide when that rebuild can be
 * skipped. They live in their own module, free of the DOM-component / flatpickr
 * imports tool.js carries, so the decision is unit-testable under jsdom.
 *
 * Safety contract: a skip is allowed ONLY when the panel is already in sync with
 * the model, so skipping is a no-op. Anything uncertain returns false → the caller
 * does a full renderInputs() → the panel can never drift from the model.
 */
import type { InputControl, InputValue } from '../../../../engine/src/inputs.ts';

/** The slice of an input model item this module reads. */
export interface SyncableInput {
  id: string;
  value: InputValue;
  control: InputControl;
  group?: string;
  showIf?: Record<string, InputValue>;
}

// Controls whose entire value lives in one [data-input-id] element's .value, so
// the live DOM can be compared to the model directly. checkbox (.checked) is
// handled separately. Everything else (slider, asset/color/file pickers, the
// flatpickr datetime, blocks, vector) is structural: any change to it takes the
// full rebuild path.
export const SIMPLE_VALUE_CONTROLS = new Set<InputControl>(['text-input', 'textarea', 'select', 'time-input']);

// CSS.escape is a browser/jsdom global; resolved at call time so tests can
// provide it. Falls back to identity for the simple ids that never need escaping.
function cssEscape(s: string): string {
  return (globalThis.CSS && globalThis.CSS.escape) ? globalThis.CSS.escape(s) : String(s);
}

/**
 * The panel's currently-visible input ids (export group hidden; showIf evaluated
 * against current values) joined into a stable string. Mirrors renderInputs'
 * panelModel filter exactly, so two models compare cheaply for visibility drift.
 */
export function visibleInputKey(model: SyncableInput[]): string {
  const values = Object.fromEntries(model.map(i => [i.id, i.value]));
  return model
    .filter(i => i.group !== 'export' && (!i.showIf || Object.entries(i.showIf).every(([k, v]) =>
      Array.isArray(v) ? v.includes(values[k] as InputValue) : values[k] === v)))
    .map(i => i.id)
    .join('\n');
}

/**
 * True only when the live DOM control ALREADY shows the input's model value - i.e.
 * the user just typed it, so there is nothing to repaint. Structural controls (and
 * a missing control) always return false so any change takes the full rebuild.
 */
export function domReflectsValue(el: HTMLElement, input: SyncableInput): boolean {
  const control = el.querySelector<HTMLInputElement>(`[data-input-id="${cssEscape(input.id)}"]`);
  if (!control) return false;
  if (input.control === 'checkbox') return control.checked === Boolean(input.value);
  // A custom slider is a <div> (no .value), but mountCustomSlider keeps its
  // authoritative value in aria-valuenow, updated live through a drag AND on every
  // keyboard step. So a committed slider change is already shown - comparing here
  // lets it SKIP the full-panel rebuild that otherwise fires on drop and made the
  // whole section flash/jump ("the sliders feel unreliable"). Numeric compare so a
  // hook that clamps/transforms the value (aria ≠ model) still forces the rebuild.
  if (input.control === 'slider') {
    const now = control.getAttribute('aria-valuenow');
    return now != null && input.value != null && Number(now) === Number(input.value);
  }
  if (SIMPLE_VALUE_CONTROLS.has(input.control)) {
    return control.value === (input.value == null ? '' : String(input.value));
  }
  return false;
}

/**
 * True while the user is mid-typing in an editable block field - number or text.
 * Such a field's live control holds the authoritative value, so rebuilding the
 * panel on the keystroke is at best redundant and at worst destructive:
 *
 *  · NUMBER: a half-typed decimal like "1." reports back as "" (validity.badInput),
 *    and a recreated number input can't have its caret restored (setSelectionRange
 *    is a no-op on type=number) - so the caret jumps and characters scramble
 *    ("1.2" lands as "2.1", Backspace deletes the wrong end).
 *  · TEXT / TEXTAREA: the caret DOES survive (renderInputs restores it by
 *    data-field-id), but the rebuild replaces every row in the panel, so focus is
 *    lost and re-established within the frame - which restarts the focus-spotlight
 *    opacity transition on every other row and section. The whole sidebar visibly
 *    pulses once per keypress. The only thing the rebuild refreshed here is the
 *    collapsed-pill preview, which syncInputs now patches in place instead.
 *
 * The model still updates on every keystroke either way, so the canvas stays live;
 * the panel repaints from the model on the next interaction.
 */
/**
 * A table input can be POPPED OUT into a floating panel (lib/float-panel), which
 * mounts the grid on `.tool-layout` - outside `#tool-inputs`. Its cells still hold
 * the authoritative value, so the containment test above has to follow the GRID,
 * not the sidebar box.
 *
 * Getting this wrong is worse than the sidebar flicker the deferral exists to
 * prevent. In the sidebar a rebuild replaces the cell and `renderInputs` restores
 * the caret by `data-field-id`; in a panel the rebuild also orphans the panel
 * around the stale wrapper, so the wiring closes it and re-pops the FRESH wrapper
 * into a new one. The element the caret would be restored into no longer exists,
 * and typing dies after a single character.
 *
 * Structural like its caller - `closest` is feature-tested so a plain test stub
 * simply reports "not in a panel" rather than throwing.
 */
function inPoppedTable(active: { closest?: (s: string) => unknown }): boolean {
  return typeof active.closest === 'function' && !!active.closest('.floatp .table-input');
}

function isEditingBlockField(el: HTMLElement): boolean {
  // Structural, NOT instanceof: the unit tests drive this with plain stubs (no
  // DOM globals). `type` is the discriminator for inputs; textareas report none.
  const active = (el && el.ownerDocument && el.ownerDocument.activeElement) as
    (Element & { type?: string; tagName?: string; dataset?: DOMStringMap; closest?: (s: string) => unknown }) | null;
  if (!active || !active.dataset || !active.dataset.fieldId) return false;
  if (!el.contains(active) && !inPoppedTable(active)) return false;
  if (active.type === 'number') return true;
  // A block text field renders with NO type attribute (see blockField), so `type`
  // reads back as 'text'; a textarea has no type at all. Everything else a block
  // can hold - range, checkbox, colour, select, asset button - is a discrete
  // commit rather than typing, and keeps the full rebuild.
  const tag = String(active.tagName || '').toLowerCase();
  if (tag === 'textarea') return true;
  return tag === 'input' && (active.type === undefined || active.type === 'text');
}

/**
 * True while focus is inside a virtualized table GRID (the >50-row data-grid,
 * components/data-grid). Like a block field, the grid's own DOM holds the
 * authoritative value - it repaints the edited cell before committing - so a
 * rebuild on the commit is pure waste, and DESTRUCTIVE when the table is popped
 * out: the rebuild re-pops the float panel (tool-inputs' stale-repop), exiting
 * fullscreen and dropping the caret to <body> on every single cell edit. The
 * grid's cells and editor carry NO data-field-id, so isEditingBlockField can't
 * see them; this matches on the grid container (.table-vgrid) instead, in the
 * sidebar OR a popped panel. Structural (feature-tested closest), like
 * inPoppedTable - a plain stub simply reports "not in a grid".
 */
function isEditingGrid(el: HTMLElement): boolean {
  const active = (el && el.ownerDocument && el.ownerDocument.activeElement) as
    (Element & { closest?: (s: string) => unknown }) | null;
  if (!active || typeof active.closest !== 'function') return false;
  if (!active.closest('.table-vgrid')) return false;
  return el.contains(active as unknown as Node) || inPoppedTable(active);
}

/**
 * Whether a model change needs no sidebar work at all. Safe to skip ONLY when the
 * set of visible rows is unchanged AND every value that changed is already shown
 * by its control (unchanged values keep their object identity, so === detects
 * them). Any uncertainty returns false.
 */
export function canSkipInputsRebuild(el: HTMLElement, model: SyncableInput[], prevModel: SyncableInput[] | null | undefined): boolean {
  if (!prevModel) return false;
  // Defer the rebuild while a block field is being typed into (see above).
  if (isEditingBlockField(el)) return true;
  // …and while a virtualized table grid holds focus - the grid already shows the
  // edit, and rebuilding would remount it (and re-pop a fullscreen panel).
  if (isEditingGrid(el)) return true;
  if (model.length !== prevModel.length) return false;
  if (visibleInputKey(model) !== visibleInputKey(prevModel)) return false;
  const prevById = new Map(prevModel.map(i => [i.id, i]));
  for (const input of model) {
    const prev = prevById.get(input.id);
    if (!prev) return false;
    if (prev.value === input.value) continue;        // unchanged (incl. same object ref)
    if (!domReflectsValue(el, input)) return false;  // changed but not already shown → rebuild
  }
  return true;
}
