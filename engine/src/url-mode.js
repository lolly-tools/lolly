/**
 * URL mode.
 *
 * Every tool's input state must be expressible as URL params. This module
 * handles the round-trip.
 *
 *   tooldomain.com/qr-codes/?url=https://suse.com&theme=dark&format=png&export
 *
 * The CLI shell uses the SAME conversion — CLI is just URL mode under a
 * different transport. This guarantees CLI and GUI never drift.
 *
 * Reserved param names (not used as inputs):
 *   - `format`   — output format (png/svg/pdf/...) used by export and copy
 *   - `export`   — presence flag: trigger an immediate download on load
 *   - `copy`     — presence flag: arm copy-to-clipboard on first interaction
 *   - `full`     — presence flag: open in fullscreen (sidebar collapsed)
 *   - `options`  — presence flag: open with the export-settings panel expanded
 *                  (web shell only; ignored by CLI). `full` wins if both are set.
 *   - `slot`     — saved state slot to load
 *   - `output`   — output filename (CLI only)
 *   - `filename` — download filename (web shell)
 *   - `_v`       — tool version pinning (optional)
 *   - `width`/`w`, `height`/`h` — output dimensions (value in `unit`, default px)
 *   - `unit`     — physical unit for width/height: px (default), mm, cm, in, pt
 *   - `dpi`      — raster resolution for physical units (default 300; px → 96)
 *   - `profile`  — colour profile: raster ICC ('srgb'/'none') or, for pdf-cmyk,
 *                  the press condition ('fogra39', 'swop', 'gracol', …)
 *   - `password` — open-password for the standard `pdf` format (a basic lock, not
 *                  strong encryption). Intentionally clear-text in the URL — it
 *                  exists so links can pre-set a password for quick, short-lived
 *                  transactional use; do not use it for confidential material.
 *
 * Compact URL encoding (opt-in per tool via tool.json):
 *   - Inputs can declare a short `urlKey` alias (e.g. "textColor" → "tc")
 *   - Block fields can declare a short `urlKey` too
 *   - Color params are stored without the leading `#` (6-char hex)
 *   - Block arrays use a compact tilde-delimited format instead of JSON:
 *       label,value,color~label2,value2,color2~...
 *     Values are encodeURIComponent'd; colors omit the `#` prefix.
 *   - Default values are omitted from the URL entirely
 *   Both old long-form and new short-form URLs are accepted on parse.
 *
 * Vector inputs: each field is its own flat param "<inputId>.<fieldId>", e.g.
 *   ?transform.zoom=200&transform.x=30&transform.y=70
 * (one readable value per param; no single-param form).
 */

import { isUnit } from './units.js';
import { isTokenValue, isAlias } from './tokens.js';

const RESERVED = new Set(['format', 'export', 'copy', 'slot', 'output', 'filename', '_v', 'width', 'height', 'w', 'h', 'unit', 'dpi', 'profile', 'password', 'bleed', 'marks', 'full', 'options']);

// Parse the `marks` param (csv: crop,reg,bleed,bars) into a print-mark toggle map.
// Returns null when absent so callers fall back to their own defaults.
function parseMarks(raw) {
  if (raw == null) return null;
  const set = new Set(String(raw).split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  return {
    crop:         set.has('crop'),
    registration: set.has('reg') || set.has('registration'),
    bleed:        set.has('bleed'),
    colorBars:    set.has('bars') || set.has('colorbars'),
  };
}

/**
 * Parse URL params into an input-state object the runtime can apply.
 * Returns { values, format, export, copy, slot, version, width, height }.
 *
 * Accepts both legacy long-form param names and short urlKey aliases.
 * Accepts both JSON and compact tilde-delimited block arrays.
 */
export function parseUrlState(searchParams, manifest) {
  const params = new URLSearchParams(searchParams);
  const values = {};

  // Build lookup keyed by both id and urlKey so either form works in URLs.
  const inputsByKey = {};
  // Vector sub-fields are flat params named "<inputId>.<fieldId>" (e.g.
  // transform.zoom=200) — legible and one value per param.
  const vectorFieldByKey = {};
  for (const i of manifest.inputs ?? []) {
    inputsByKey[i.id] = i;
    if (i.urlKey) inputsByKey[i.urlKey] = i;
    if (i.type === 'vector') {
      for (const f of i.fields ?? []) vectorFieldByKey[`${i.id}.${f.id}`] = { input: i, field: f };
    }
  }

  for (const [key, raw] of params.entries()) {
    if (RESERVED.has(key)) continue;
    const vec = vectorFieldByKey[key];
    if (vec) {
      const n = Number(raw);
      if (raw !== '' && !Number.isNaN(n)) (values[vec.input.id] ??= {})[vec.field.id] = n;
      continue;
    }
    const input = inputsByKey[key];
    if (!input) continue;
    values[input.id] = coerceFromString(input, raw);
  }

  const rawW = params.get('width') ?? params.get('w');
  const rawH = params.get('height') ?? params.get('h');
  const rawUnit = (params.get('unit') || '').toLowerCase();
  const rawDpi = params.get('dpi');

  return {
    values,
    format:   params.get('format') || null,
    export:   params.has('export'),
    copy:     params.has('copy'),
    slot:     params.get('slot') || null,
    filename: params.get('filename') || null,
    version:  params.get('_v') || null,
    width:    rawW != null ? (Number(rawW) || null) : null,
    height:   rawH != null ? (Number(rawH) || null) : null,
    // Physical unit for width/height (default px) and the raster DPI for it.
    unit:     isUnit(rawUnit) ? rawUnit : null,
    dpi:      rawDpi != null ? (Number(rawDpi) || null) : null,
    // Colour profile / CMYK press condition for the export (see color.js).
    profile:  params.get('profile') || null,
    // Open-password for the standard `pdf` export (basic lock; clear-text by design).
    password: params.get('password') || null,
    // Print prep for pdf / pdf-cmyk: bleed amount (dimension string) and which
    // crop / registration / bleed / colour-bar marks to draw (see print-marks.js).
    bleed:    params.get('bleed') || null,
    marks:    parseMarks(params.get('marks')),
  };
}

/**
 * Build a URL-encoded param string from current input values.
 * AssetRef values are serialised by id so the URL stays short and shareable.
 */
export function serializeUrlState(model, opts = {}) {
  const params = new URLSearchParams();
  for (const input of model) {
    if (input.value === null || input.value === undefined) continue;
    if (input.type === 'vector') {
      // One flat param per field: "<inputId>.<fieldId>=<value>".
      const v = input.value;
      if (v && typeof v === 'object') {
        for (const f of input.fields ?? []) {
          if (v[f.id] !== undefined && v[f.id] !== null) params.set(`${input.id}.${f.id}`, String(v[f.id]));
        }
      }
      continue;
    }
    if (input.value === '' && !input.required) continue;
    params.set(input.id, coerceToString(input, input.value));
  }
  if (opts.format) params.set('format', opts.format);
  if (opts.export) params.set('export', '');
  if (opts.slot)   params.set('slot',   opts.slot);
  if (opts.width)  params.set('w', String(opts.width));
  if (opts.height) params.set('h', String(opts.height));
  if (opts.unit && opts.unit !== 'px') params.set('unit', opts.unit);
  if (opts.dpi)    params.set('dpi', String(opts.dpi));
  if (opts.profile) params.set('profile', opts.profile);
  if (opts.password) params.set('password', opts.password);
  if (opts.bleed) params.set('bleed', opts.bleed);
  if (opts.marks) params.set('marks', opts.marks);
  return params.toString();
}

function coerceFromString(input, raw) {
  switch (input.type) {
    case 'number':
      return Number(raw);
    case 'boolean':
      return raw === '1' || raw === 'true';
    case 'color':
      // A `{token.path}` alias is a token-backed colour; keep it as an unresolved
      // token value for the runtime to resolve (mirrors the asset _unresolved path).
      if (isAlias(raw)) return { ref: raw, _unresolved: true };
      // Colors are stored without # for compactness; restore it here.
      if (raw.length === 6 && /^[0-9a-fA-F]{6}$/.test(raw)) return '#' + raw;
      return raw;
    case 'asset':
      // Lightweight ref. The runtime resolves it before hydration.
      return { source: 'library', id: raw, _unresolved: true };
    case 'blocks':
      // Accept legacy JSON format and compact tilde-delimited format.
      if (raw.startsWith('[')) {
        try { return JSON.parse(raw); } catch { return []; }
      }
      return decodeBlocksCompact(raw, input.fields ?? []);
    // NOTE: 'vector' has no single-param form — each field is its own flat param
    // ("<inputId>.<fieldId>"), handled in parseUrlState.
    default:
      return raw;
  }
}

function coerceToString(input, value) {
  if (input.type === 'boolean') return value ? '1' : '0';
  if (input.type === 'asset' && value && typeof value === 'object') return value.id;
  // A token-backed colour serialises to its reference ('{color.brand.jungle}'),
  // so a shared link re-resolves against the destination's tokens (canonical).
  if (input.type === 'color' && isTokenValue(value)) return value.ref;
  if (input.type === 'blocks') return JSON.stringify(value ?? []);
  // 'vector' is serialised per-field in serializeUrlState, not here.
  return String(value);
}

/**
 * Decode a compact tilde-delimited block string into an array of row objects.
 * Format: "v1a,v1b,v1c~v2a,v2b,v2c~..."
 * Field values are decodeURIComponent'd. Color fields get their # restored.
 */
function decodeBlocksCompact(str, fields) {
  if (!str || !fields.length) return [];
  return str.split('~').filter(Boolean).map(item => {
    const parts = item.split(',');
    const obj = {};
    fields.forEach((f, i) => {
      const raw = decodeURIComponent(parts[i] ?? '');
      obj[f.id] = (f.type === 'color' && raw && !raw.startsWith('#')) ? '#' + raw : raw;
    });
    return obj;
  });
}
