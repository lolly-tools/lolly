// SPDX-License-Identifier: MPL-2.0
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
 *   - `bleed`    — bleed amount (dimension string, e.g. `3mm`) for the print
 *                  formats (`pdf`/`pdf-cmyk`/`cmyk-tiff`); ignored otherwise.
 *   - `marks`    — print marks for the print formats: a CSV of `crop`, `reg`,
 *                  `bleed`, `bars`, `prov` drawn in the page/image margin.
 *   - `z`        — a PACKED whole-state token (raw DEFLATE + base64url) that carries
 *                  the entire query for complex tools whose readable form would blow
 *                  past practical URL limits. Expanded back into a plain query by
 *                  `expandQuery` (url-pack.js) at the load boundary, BEFORE this
 *                  parser runs, so parseUrlState never sees a live `z`. Listed here
 *                  only so a stray one is never mistaken for a tool input.
 *
 * NOTE: this list, the RESERVED set below, and docs/url-mode.md must stay in
 * sync — tests/engine.test.js asserts the RESERVED set against an inline copy.
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

import { isUnit } from './units.ts';
import type { Unit } from './units.ts';
import { isTokenValue, isAlias } from './tokens.ts';
import { isToolUrl } from './tool-url.ts';
import type { BlockFieldSpec, InputManifest, InputSpec, InputValue } from './inputs.ts';
import type { PrintMarksFlags } from './print-marks.ts';

/** Parsed URL state: input values plus the reserved export/render controls. */
export interface UrlState {
  values: Record<string, InputValue>;
  format: string | null;
  export: boolean;
  copy: boolean;
  slot: string | null;
  filename: string | null;
  version: string | null;
  width: number | null;
  height: number | null;
  unit: Unit | null;
  dpi: number | null;
  profile: string | null;
  password: string | null;
  bleed: string | null;
  marks: PrintMarksFlags | null;
}

/** The slice of an input model item serializeUrlState reads. */
export interface UrlSerializableInput {
  id: string;
  type: string;
  value?: InputValue;
  required?: boolean;
  fields?: BlockFieldSpec[];
}

/** Reserved-control overrides folded into a serialised URL. */
export interface SerializeUrlOpts {
  format?: string | null;
  export?: boolean;
  slot?: string | null;
  width?: number | null;
  height?: number | null;
  unit?: string | null;
  dpi?: number | null;
  profile?: string | null;
  password?: string | null;
  bleed?: string | null;
  /** CSV of mark names, as documented for the `marks` param. */
  marks?: string | null;
}

// Param names that are NOT tool inputs (export/render controls). Exported so the
// engine contract test can assert it stays in lock-step with the documented list
// (the header comment above + docs/url-mode.md) and nothing drifts silently.
export const RESERVED = new Set(['format', 'export', 'copy', 'slot', 'output', 'filename', '_v', 'width', 'height', 'w', 'h', 'unit', 'dpi', 'profile', 'password', 'bleed', 'marks', 'full', 'options', 'nostage', 'z']);

// Parse the `marks` param (csv: crop,reg,bleed,bars,prov) into a print-mark
// toggle map. Returns null when absent so callers fall back to their own defaults.
function parseMarks(raw: string | null): PrintMarksFlags | null {
  if (raw == null) return null;
  const set = new Set(String(raw).split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  return {
    crop:         set.has('crop'),
    registration: set.has('reg') || set.has('registration'),
    bleed:        set.has('bleed'),
    colorBars:    set.has('bars') || set.has('colorbars'),
    provenance:   set.has('prov') || set.has('provenance'),
  };
}

/**
 * Parse URL params into an input-state object the runtime can apply.
 * Returns { values, format, export, copy, slot, version, width, height }.
 *
 * Accepts both legacy long-form param names and short urlKey aliases.
 * Accepts both JSON and compact tilde-delimited block arrays.
 */
export function parseUrlState(searchParams: string | URLSearchParams, manifest: InputManifest): UrlState {
  const params = new URLSearchParams(searchParams);
  const values: Record<string, InputValue> = {};

  // Build lookup keyed by both id and urlKey so either form works in URLs.
  const inputsByKey: Record<string, InputSpec> = {};
  // Vector sub-fields are flat params named "<inputId>.<fieldId>" (e.g.
  // transform.zoom=200) — legible and one value per param.
  const vectorFieldByKey: Record<string, { input: InputSpec; field: BlockFieldSpec }> = {};
  for (const i of manifest.inputs ?? []) {
    inputsByKey[i.id] = i;
    if (i.urlKey) inputsByKey[i.urlKey] = i;
    if (i.type === 'vector') {
      for (const f of i.fields ?? []) vectorFieldByKey[`${i.id}.${f.id}`] = { input: i, field: f };
    }
  }

  // Vector params accumulate one field per param into a shared per-input object.
  const vectorAcc: Record<string, Record<string, number>> = {};
  params.forEach((raw, key) => {
    if (RESERVED.has(key)) return;
    const vec = vectorFieldByKey[key];
    if (vec) {
      const n = Number(raw);
      if (raw !== '' && !Number.isNaN(n)) {
        const box = (vectorAcc[vec.input.id] ??= {});
        box[vec.field.id] = n;
        values[vec.input.id] = box;
      }
      return;
    }
    const input = inputsByKey[key];
    if (!input) return;
    values[input.id] = coerceFromString(input, raw);
  });

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
export function serializeUrlState(model: UrlSerializableInput[], opts: SerializeUrlOpts = {}): string {
  const params = new URLSearchParams();
  for (const input of model) {
    if (input.value === null || input.value === undefined) continue;
    // A picked file is binary user content — it has no shareable URL form (its
    // bytes live only in memory on this device). Never serialise it.
    if (input.type === 'file') continue;
    if (input.type === 'vector') {
      // One flat param per field: "<inputId>.<fieldId>=<value>".
      const v = input.value;
      if (v && typeof v === 'object') {
        const byField = new Map<string, unknown>(Object.entries(v));
        for (const f of input.fields ?? []) {
          const fv = byField.get(f.id);
          if (fv !== undefined && fv !== null) params.set(`${input.id}.${f.id}`, String(fv));
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

function coerceFromString(input: InputSpec, raw: string): InputValue {
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
      // Lightweight ref. The runtime resolves it before hydration. A Lolly tool
      // URL (a share link the user dropped into the picker) is a 'remote' asset
      // the runtime re-renders via host.compose.renderUrl; a plain id is a
      // 'library' asset resolved via host.assets.get.
      return { source: isToolUrl(raw) ? 'remote' : 'library', id: raw, _unresolved: true };
    case 'file':
      // Files can't ride in a URL as bytes. In CLI transport a file param is a
      // filesystem path (--photo=./pic.jpg); the CLI loads its bytes into a
      // FileRef before createRuntime. In the web shell this unresolved ref carries
      // no bytes, so the runtime treats it as blank (resolveInitialValue).
      return raw ? { __file: true, path: raw, _unresolved: true } : null;
    case 'blocks':
      // Accept legacy JSON format and compact tilde-delimited format.
      if (raw.startsWith('[')) {
        // JSON trust boundary: parse to unknown, admit only JSON-shaped values
        // (which JSON.parse always yields, so this never rejects real output).
        try {
          const parsed: unknown = JSON.parse(raw);
          return isJsonInputValue(parsed) ? parsed : [];
        } catch { return []; }
      }
      return decodeBlocksCompact(raw, input.fields ?? []);
    // NOTE: 'vector' has no single-param form — each field is its own flat param
    // ("<inputId>.<fieldId>"), handled in parseUrlState.
    default:
      return raw;
  }
}

// Every value JSON.parse can produce is structurally an InputValue (its union
// covers string/number/boolean/null plus arrays and string-keyed objects).
function isJsonInputValue(v: unknown): v is InputValue {
  if (v === null) return true;
  const t = typeof v;
  if (t === 'string' || t === 'number' || t === 'boolean') return true;
  if (Array.isArray(v)) return v.every(isJsonInputValue);
  if (typeof v === 'object') return Object.values(v).every(isJsonInputValue);
  return false;
}

function coerceToString(input: UrlSerializableInput, value: InputValue): string {
  if (input.type === 'boolean') return value ? '1' : '0';
  if (input.type === 'asset' && value && typeof value === 'object' && 'id' in value) return String(value.id);
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
function decodeBlocksCompact(str: string, fields: BlockFieldSpec[]): InputValue[] {
  if (!str || !fields.length) return [];
  return str.split('~').filter(Boolean).map(item => {
    // Cap to exactly fields.length parts: the encoder percent-encodes ',' and '~'
    // inside values, so any *raw* comma is a hand-edited URL. Folding the overflow
    // back into the last field contains the damage — a stray comma can only ever
    // corrupt the final field instead of shifting every field after it.
    const parts = splitToFields(item, fields.length);
    const obj: { [key: string]: InputValue | undefined } = {};
    fields.forEach((f, i) => {
      const raw = decodeURIComponent(parts[i] ?? '');
      if (f.type === 'asset') {
        // Lightweight ref by id; the runtime resolves it before hydration
        // (resolveAssetRefs descends into block asset fields). A tool URL is a
        // 'remote' compose-rendered ref; a plain id is a 'library' asset. Empty
        // → no image.
        obj[f.id] = raw ? { source: isToolUrl(raw) ? 'remote' : 'library', id: raw, _unresolved: true } : null;
      } else if (f.type === 'color' && raw && !raw.startsWith('#')) {
        obj[f.id] = '#' + raw;
      } else {
        obj[f.id] = raw;
      }
    });
    return obj;
  });
}

// Split into at most `count` comma-separated parts, joining any overflow back into
// the final part (so a raw, un-encoded comma can't shift the field alignment past
// the schema). Unlike String.split(s, limit), the tail is preserved, not dropped.
function splitToFields(str: string, count: number): string[] {
  const parts = str.split(',');
  if (parts.length <= count) return parts;
  return [...parts.slice(0, count - 1), parts.slice(count - 1).join(',')];
}
