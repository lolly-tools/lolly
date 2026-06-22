/**
 * Builds a runtime input model from a tool manifest.
 *
 * The manifest declares inputs abstractly ({ id, type, ... }). This module
 * resolves defaults, applies profile bindings, and produces a model the host
 * UI can render generically. Same model regardless of shell.
 *
 * IMPORTANT: This is the ONLY place input semantics live. Shells render the
 * model; they do not interpret manifest declarations themselves. That's how
 * we keep behaviour consistent across web/Tauri/CLI.
 */

import { isTokenValue } from './tokens.js';

/**
 * @param {ToolManifest} manifest
 * @param {object} opts
 * @param {object} [opts.profile]  user profile, for bindToProfile resolution
 * @param {object} [opts.initial]  initial values (from saved state or URL)
 * @returns {InputModel[]}
 */
export function buildInputModel(manifest, { profile = {}, initial = {} } = {}) {
  const declared = manifest.inputs ?? [];

  // Synthesise model entries for render-level options so hooks can react to them
  // via onInput/onInit without tools needing to redeclare them as user inputs.
  const synthetic = [];
  if (
    manifest.render?.transparentBg !== undefined &&
    !declared.some(i => i.id === 'transparentBg')
  ) {
    synthetic.push({
      id: 'transparentBg',
      label: 'No BG',
      type: 'boolean',
      default: Boolean(manifest.render.transparentBg),
      group: 'export',
      help: 'Remove the background fill so alpha-supporting formats export with transparency.',
    });
  }

  // 'Convert paths' — auto-injected for any tool that exports a vector format.
  // Outlines text to paths in SVG/PDF so output renders identically without the
  // fonts installed. On by default; the export bridge reads its value as
  // opts.convertPaths. A tool can set render.convertPaths:false to suppress the
  // toggle entirely (e.g. capture tools, where text-outlining doesn't apply).
  const VECTOR_FORMATS = ['svg', 'pdf', 'pdf-cmyk'];
  if (
    manifest.render?.convertPaths !== false &&
    (manifest.render?.formats ?? []).some(f => VECTOR_FORMATS.includes(f)) &&
    !declared.some(i => i.id === 'convertPaths')
  ) {
    synthetic.push({
      id: 'convertPaths',
      label: 'Convert paths',
      type: 'boolean',
      default: manifest.render?.convertPaths !== false,
      group: 'export',
      help: 'Outline text as vector paths so SVG/PDF render identically without the fonts installed. Turn off to keep selectable, editable text.',
    });
  }

  return [...declared, ...synthetic].map(input => {
    const value = resolveInitialValue(input, profile, initial);
    return {
      ...input,
      value,
      isDirty: input.id in initial,
      control: pickControl(input),
    };
  });
}

function resolveInitialValue(input, profile, initial) {
  // Vector holds a compound { fieldId: number }; merge any initial (URL/saved)
  // over the per-field defaults, clamped to each field's range.
  if (input.type === 'vector') return resolveVectorValue(input, initial[input.id]);
  if (input.id in initial) return initial[input.id];
  if (input.bindToProfile && profile[input.bindToProfile] !== undefined) {
    return profile[input.bindToProfile];
  }
  return input.default ?? defaultForType(input.type);
}

function resolveVectorValue(input, initial) {
  const fields = input.fields ?? [];
  const out = {};
  for (const f of fields) {
    let n = f.default ?? 0;
    const raw = initial && typeof initial === 'object' ? initial[f.id] : undefined;
    if (raw !== undefined && raw !== null && raw !== '') {
      const parsed = Number(raw);
      if (!Number.isNaN(parsed)) n = parsed;
    }
    if (f.min !== undefined && n < f.min) n = f.min;
    if (f.max !== undefined && n > f.max) n = f.max;
    out[f.id] = n;
  }
  return out;
}

function defaultForType(type) {
  switch (type) {
    case 'text':
    case 'longtext':
    case 'url':
      return '';
    case 'number':
      return 0;
    case 'boolean':
      return false;
    case 'color':
      return '#000000';
    case 'select':
      return null;
    case 'asset':
      return null;
    case 'time':
    case 'datetime-local':
      return '';
    case 'blocks':
      return [];
    case 'vector':
      return {};
    default:
      return null;
  }
}

function pickControl(input) {
  if (input.type === 'number' && input.display === 'slider') return 'slider';
  if (input.type === 'longtext') return 'textarea';
  if (input.type === 'select') return 'select';
  if (input.type === 'asset') return 'asset-picker';
  if (input.type === 'color' && input.palette) return 'palette-picker';
  if (input.type === 'color') return 'color-picker';
  if (input.type === 'boolean') return 'checkbox';
  if (input.type === 'time') return 'time-input';
  if (input.type === 'datetime-local') return 'datetime-local-input';
  if (input.type === 'blocks') return 'blocks';
  if (input.type === 'vector') return 'vector';
  return 'text-input';
}

/**
 * Apply user input changes back to the model, with constraint enforcement.
 * Returns a new model array — caller passes it to the renderer.
 */
export function updateInput(model, id, value) {
  return model.map(input => {
    if (input.id !== id) return input;
    const constrained = constrain(input, value);
    return { ...input, value: constrained, isDirty: true };
  });
}

function constrain(input, value) {
  if (input.type === 'text' || input.type === 'longtext') {
    if (typeof value !== 'string') return input.value;
    if (input.maxLength && value.length > input.maxLength) {
      return value.slice(0, input.maxLength);
    }
    return value;
  }
  if (input.type === 'number') {
    const n = Number(value);
    if (Number.isNaN(n)) return input.value;
    if (input.min !== undefined && n < input.min) return input.min;
    if (input.max !== undefined && n > input.max) return input.max;
    return n;
  }
  if (input.type === 'vector') {
    if (!value || typeof value !== 'object') return input.value;
    const fields = input.fields ?? [];
    const out = { ...(input.value && typeof input.value === 'object' ? input.value : {}) };
    for (const f of fields) {
      if (value[f.id] === undefined) continue;
      let n = Number(value[f.id]);
      if (Number.isNaN(n)) continue;
      if (f.min !== undefined && n < f.min) n = f.min;
      if (f.max !== undefined && n > f.max) n = f.max;
      out[f.id] = n;
    }
    return out;
  }
  return value;
}

/** Flatten the model into a plain { id: value } object for template hydration. */
export function modelToValues(model) {
  return Object.fromEntries(model.map(i => [i.id, flattenValue(i.value)]));
}

/**
 * The model as hooks should see it: token-backed colour values flattened to their
 * resolved hex string, matching what templates (and CLI/JSON export) receive. The
 * `{ ref, value }` shape is an engine implementation detail for keeping a colour
 * linked to a token; leaking it to hooks breaks the common `(inputs.x || '').trim()`
 * pattern. Other values (incl. AssetRefs, which carry no `ref`) pass through.
 */
export function modelForHooks(model) {
  return model.map(i => {
    const v = flattenValue(i.value);
    return v === i.value ? i : { ...i, value: v };
  });
}

// A token-backed colour value ({ ref, value }) hydrates as its resolved hex —
// the template (and CLI/JSON export) only ever sees a plain colour string. The
// runtime refreshes `.value` from the live token set before this; the cached hex
// is the fallback. Plain values (incl. AssetRefs, which carry no `ref`) pass through.
export function flattenValue(v) {
  return isTokenValue(v) ? (v.value ?? '') : v;
}
