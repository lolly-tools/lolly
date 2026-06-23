/**
 * Sidebar input-sync decision logic.
 *
 * renderInputs() (in tool.js) rebuilds the whole control panel's innerHTML and
 * re-wires every listener — necessary on first render or a structural change, but
 * pure waste on a keystroke, where the only thing that changed is a value the
 * edited field already shows. These helpers decide when that rebuild can be
 * skipped. They live in their own module, free of the DOM-component / flatpickr
 * imports tool.js carries, so the decision is unit-testable under jsdom.
 *
 * Safety contract: a skip is allowed ONLY when the panel is already in sync with
 * the model, so skipping is a no-op. Anything uncertain returns false → the caller
 * does a full renderInputs() → the panel can never drift from the model.
 */

// Controls whose entire value lives in one [data-input-id] element's .value, so
// the live DOM can be compared to the model directly. checkbox (.checked) is
// handled separately. Everything else (slider, asset/color/file pickers, the
// flatpickr datetime, blocks, vector) is structural: any change to it takes the
// full rebuild path.
export const SIMPLE_VALUE_CONTROLS = new Set(['text-input', 'textarea', 'select', 'time-input']);

// CSS.escape is a browser/jsdom global; resolved at call time so tests can
// provide it. Falls back to identity for the simple ids that never need escaping.
function cssEscape(s) {
  return (globalThis.CSS && globalThis.CSS.escape) ? globalThis.CSS.escape(s) : String(s);
}

/**
 * The panel's currently-visible input ids (export group hidden; showIf evaluated
 * against current values) joined into a stable string. Mirrors renderInputs'
 * panelModel filter exactly, so two models compare cheaply for visibility drift.
 */
export function visibleInputKey(model) {
  const values = Object.fromEntries(model.map(i => [i.id, i.value]));
  return model
    .filter(i => i.group !== 'export' && (!i.showIf || Object.entries(i.showIf).every(([k, v]) => values[k] === v)))
    .map(i => i.id)
    .join('\n');
}

/**
 * True only when the live DOM control ALREADY shows the input's model value — i.e.
 * the user just typed it, so there is nothing to repaint. Structural controls (and
 * a missing control) always return false so any change takes the full rebuild.
 */
export function domReflectsValue(el, input) {
  const control = el.querySelector(`[data-input-id="${cssEscape(input.id)}"]`);
  if (!control) return false;
  if (input.control === 'checkbox') return control.checked === Boolean(input.value);
  if (SIMPLE_VALUE_CONTROLS.has(input.control)) {
    return control.value === (input.value == null ? '' : String(input.value));
  }
  return false;
}

/**
 * Whether a model change needs no sidebar work at all. Safe to skip ONLY when the
 * set of visible rows is unchanged AND every value that changed is already shown
 * by its control (unchanged values keep their object identity, so === detects
 * them). Any uncertainty returns false.
 */
export function canSkipInputsRebuild(el, model, prevModel) {
  if (!prevModel) return false;
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
