// SPDX-License-Identifier: MPL-2.0
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

import { isTokenValue } from './tokens.ts';
import type { TokenValue } from './tokens.ts';
import type { AssetRef, InputFile } from './bridge/host-v1.ts';

/** An input's declared type (schemas/tool.schema.json `$defs/input.type`). */
export type InputType =
  | 'text' | 'longtext' | 'number' | 'boolean' | 'color' | 'select' | 'asset'
  | 'date' | 'time' | 'datetime-local' | 'url' | 'blocks'
  | 'vector' | 'file';

/** The control a shell should render for a model item (see pickControl). */
export type InputControl =
  | 'slider' | 'textarea' | 'select' | 'asset-picker' | 'palette-picker'
  | 'color-picker' | 'checkbox' | 'time-input' | 'datetime-local-input'
  | 'blocks' | 'vector' | 'file-picker' | 'text-input';

/** A vector input's compound value: one number per declared field id. */
export type VectorValue = Record<string, number>;

/**
 * Any value an input can hold in the model (and the shapes URL/saved-state
 * initial values arrive in). Structured members cover: token-linked colours
 * ({ ref, value }), loaded files, asset refs, vector compounds, blocks lists,
 * and free-form JSON-ish objects (blocks items, unresolved file refs, …).
 */
export type InputValue =
  | string
  | number
  | boolean
  | null
  | Uint8Array
  | TokenValue
  | InputFile
  | AssetRef
  | InputValue[]
  | { [key: string]: InputValue | undefined };

/** One `select` option (may carry an export size the shell applies). */
export interface SelectOption {
  value: string;
  label?: string;
  width?: number;
  height?: number;
  unit?: string;
  /** Icon name (shells/web/src/lib/icons.ts) shown instead of the label when the
   *  input renders as `display: 'icon-toggle'`. The engine only carries it. */
  icon?: string;
}

/** One field of a `vector` compound input. */
export interface VectorFieldSpec {
  id: string;
  label?: string;
  default?: number;
  min?: number;
  max?: number;
  step?: number;
}

/** One option of a select-typed block sub-field (schemas/tool.schema.json). */
export interface BlockFieldOption {
  value: string;
  label?: string;
  /** Lets the add-menu offer this option more than once. */
  repeatable?: boolean;
}

/**
 * One field of a `blocks` row — a superset of VectorFieldSpec: blocks declare
 * richer field objects (typed like inputs, with optional short URL aliases).
 * The engine itself reads only `type`/`urlKey` (plus the VectorFieldSpec
 * members); the rest mirror the schema for shells and tests that read the
 * manifest through the loader's ToolManifest type.
 */
export interface BlockFieldSpec extends VectorFieldSpec {
  type?: string;
  urlKey?: string;
  placeholder?: string;
  help?: string;
  /** Single character shown inside a vector field as its scrub handle. */
  symbol?: string;
  /** Render this field only for rows whose discriminator value is listed. */
  showFor?: string[];
  /** Render this field only when sibling-field / top-level values match. */
  showIf?: Record<string, unknown>;
  /** Choices for a select sub-field. */
  options?: BlockFieldOption[];
  display?: 'input' | 'slider';
  assetType?: string;
  allowUpload?: boolean;
  filter?: { tags?: string[]; namespace?: string };
  /** Reference-picker sourcing (rows of another blocks input). */
  optionsFrom?: Record<string, unknown>;
  /** For a `select` sub-field: append the user's installed brand-font families as
   *  extra options. The engine ignores it (fonts are a shell concept); the web
   *  shell fills the list from user-fonts.ts. */
  brandFonts?: boolean;
  /** Multi-line text entry for these discriminator values; `rows` sets its height. */
  multilineFor?: string[];
  rows?: number;
}

/** Typed "+ Add" menu on a blocks input (one sub-field is the discriminator). */
export interface BlocksAddMenu {
  field: string;
  label?: string;
}

/** Tree presentation of a blocks array (schema `nesting`): the data stays a
 * flat reference-by-id array; only the sidebar presentation is tree-shaped. */
export interface BlocksNesting {
  parentField: string;
  keyField?: string;
  labelField?: string;
  prefix?: string;
  activeWhen?: Record<string, unknown>;
}

/** Drop-to-add on a blocks input (schema `dropToAdd`). */
export interface BlocksDropToAdd {
  field: string;
  accept?: string;
}

/** One declared input from the tool manifest (schemas/tool.schema.json). */
export interface InputSpec {
  id: string;
  type: InputType;
  /** Short URL param alias (compact URL encoding), e.g. "textColor" → "tc". */
  urlKey?: string;
  label?: string;
  help?: string;
  required?: boolean;
  default?: InputValue;
  bindToProfile?: string;
  group?: string;
  showIf?: Record<string, InputValue>;
  // text / longtext
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  rows?: number;
  // number
  min?: number;
  max?: number;
  step?: number;
  /** `slider` is a number-input variant; `icon-toggle` is a select variant (a
   *  compact button that cycles its options, labelled by each option's `icon`). */
  display?: 'input' | 'slider' | 'icon-toggle';
  // color
  palette?: string;
  swatchesOnly?: boolean;
  // select
  options?: SelectOption[];
  // asset
  assetType?: string;
  filter?: Record<string, unknown>;
  allowUpload?: boolean;
  // vector (blocks declares richer field objects; the engine only reads these)
  fields?: BlockFieldSpec[];
  // file
  accept?: string[];
  maxSize?: number;
  // Presentation members the web shell reads (the engine only carries them —
  // they mirror schemas/tool.schema.json, same as the block sub-field members).
  /** Sidebar section (collapsible group) this input renders under. */
  section?: string;
  /** Render this input's control INSIDE the named sibling input's control row
   *  (leading), instead of on its own labelled row — for a compact modifier that
   *  belongs to another control, e.g. a fit toggle on an asset slot. It stays an
   *  ordinary input everywhere else (URL params, hooks, state, undo). The engine
   *  only carries it; the web shell places it. */
  attachTo?: string;
  placeholder?: string;
  /** Unit label shown beside a slider value (e.g. "mm"). */
  unit?: string;
  suffix?: string;
  // blocks presentation/behaviour
  addMenu?: BlocksAddMenu;
  labelledFields?: boolean;
  nesting?: BlocksNesting;
  dropToAdd?: BlocksDropToAdd;
  /** Adds a "Paste Markdown" button to the blocks toolbar (splits clipboard
   *  Markdown into one block per heading). See schema `mdPaste`. */
  mdPaste?: boolean;
  /** Marks a blocks array as the editor-layout canvas (schema `canvas`). */
  canvas?: Record<string, unknown>;
}

/** One entry of the runtime input model: the spec plus its live value. */
export interface InputModelItem extends InputSpec {
  value: InputValue;
  isDirty: boolean;
  control: InputControl;
}

/** The manifest slice this module reads. */
export interface InputManifest {
  inputs?: InputSpec[];
  render?: {
    transparentBg?: boolean;
    convertPaths?: boolean;
    formats?: string[];
  };
}

/**
 * Backstop size cap for `file` inputs whose manifest omits `maxSize`. Shells
 * enforce `input.maxSize ?? DEFAULT_FILE_MAX_BYTES` at pick/drop time so an
 * undeclared cap never means an *unbounded* read into memory — file bytes are
 * held in RAM (and some downstream parsers make byte-transparent string copies),
 * so a multi-GB pick would OOM the tab long before any hook could run. Tools
 * with a real need above this declare their own `maxSize`.
 */
export const DEFAULT_FILE_MAX_BYTES = 100 * 1024 * 1024;

/** Profile fields readable via bindToProfile, keyed by field name. */
export type ProfileValues = Record<string, InputValue | undefined>;

/**
 * A loaded FileRef: carries actual bytes (the shell resolved it). An
 * unresolved {__file, path} URL/CLI ref or a stray string does not qualify.
 */
export function isFileValue(v: unknown): v is InputFile {
  return (
    typeof v === 'object' && v !== null &&
    '__file' in v && Boolean(v.__file) &&
    'bytes' in v && Boolean(v.bytes)
  );
}

// Any non-null object value — the shape vector compounds (and the JSON-ish
// initial values they merge) take. Arrays pass too, mirroring the original
// `typeof v === 'object'` checks (a string-keyed read on one is undefined).
function isObjectValue(v: InputValue | null | undefined): v is { [key: string]: InputValue | undefined } {
  return typeof v === 'object' && v !== null;
}

/**
 * @param manifest the tool manifest (inputs + render option slice)
 * @param opts.profile  user profile, for bindToProfile resolution
 * @param opts.initial  initial values (from saved state or URL)
 */
export function buildInputModel(
  manifest: InputManifest,
  { profile = {}, initial = {} }: { profile?: ProfileValues; initial?: Record<string, InputValue> } = {},
): InputModelItem[] {
  const declared = manifest.inputs ?? [];

  // Synthesise model entries for render-level options so hooks can react to them
  // via onInput/onInit without tools needing to redeclare them as user inputs.
  const synthetic: InputSpec[] = [];
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
  const VECTOR_FORMATS = ['svg', 'emf', 'eps', 'eps-cmyk', 'pdf', 'pdf-cmyk'];
  if (
    manifest.render?.convertPaths !== false &&
    (manifest.render?.formats ?? []).some(f => VECTOR_FORMATS.includes(f)) &&
    !declared.some(i => i.id === 'convertPaths')
  ) {
    synthetic.push({
      id: 'convertPaths',
      label: 'Convert paths',
      type: 'boolean',
      // Always true here: the guard above already excluded convertPaths === false.
      default: true,
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

function resolveInitialValue(
  input: InputSpec,
  profile: ProfileValues,
  initial: Record<string, InputValue>,
): InputValue {
  // Vector holds a compound { fieldId: number }; merge any initial (URL/saved)
  // over the per-field defaults, clamped to each field's range.
  if (input.type === 'vector') return resolveVectorValue(input, initial[input.id]);
  // A file input only ever holds a loaded FileRef (bytes + metadata). URL/CLI
  // can carry an unresolved {__file, path} ref or a stray string — accept only a
  // ref that actually carries bytes (the shell loaded it); otherwise start blank.
  // (The CLI resolves path→bytes before createRuntime; the web picker provides the
  // bytes directly. Binary content is never expressible in a shareable URL.)
  if (input.type === 'file') {
    const v = initial[input.id];
    return isFileValue(v) ? v : null;
  }
  if (input.id in initial) return initial[input.id] ?? null;
  const bound = input.bindToProfile ? profile[input.bindToProfile] : undefined;
  if (input.bindToProfile && bound !== undefined) {
    return bound;
  }
  return input.default ?? defaultForType(input.type);
}

function resolveVectorValue(input: InputSpec, initial: InputValue | undefined): VectorValue {
  const fields = input.fields ?? [];
  const out: VectorValue = {};
  for (const f of fields) {
    let n = f.default ?? 0;
    const raw = isObjectValue(initial) ? initial[f.id] : undefined;
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

function defaultForType(type: InputType): InputValue {
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
    case 'file':
      return null;
    default:
      return null;
  }
}

function pickControl(input: InputSpec): InputControl {
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
  if (input.type === 'file') return 'file-picker';
  return 'text-input';
}

/**
 * Apply user input changes back to the model, with constraint enforcement.
 * Returns a new model array — caller passes it to the renderer.
 */
export function updateInput(model: InputModelItem[], id: string, value: InputValue): InputModelItem[] {
  return model.map(input => {
    if (input.id !== id) return input;
    const constrained = constrain(input, value);
    return { ...input, value: constrained, isDirty: true };
  });
}

function constrain(input: InputModelItem, value: InputValue): InputValue {
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
  if (input.type === 'file') {
    // A picked file is a FileRef object (bytes + metadata) or null (cleared).
    // Reject anything else (e.g. a stray string) so the model can't hold garbage.
    if (value === null) return null;
    if (value && typeof value === 'object') return value;
    return input.value;
  }
  if (input.type === 'vector') {
    if (!isObjectValue(value)) return input.value;
    const fields = input.fields ?? [];
    const out: { [key: string]: InputValue | undefined } =
      { ...(isObjectValue(input.value) ? input.value : {}) };
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

/** Flatten the model into a plain { id: value } object for template hydration.
 * A direct loop (vs Object.fromEntries(map(...))) avoids the intermediate pair-array
 * allocations on this per-keystroke hot path. Input ids are schema-constrained to
 * `^[a-zA-Z][a-zA-Z0-9_]*$`, so no `__proto__` key is possible. */
export function modelToValues(model: InputModelItem[]): Record<string, InputValue> {
  const out: Record<string, InputValue> = {};
  for (const i of model) out[i.id] = flattenValue(i.value);
  return out;
}

// Input types whose value is worth recording in export provenance ("what was this
// rendered from"). Deliberately excludes the user's own uploads (asset/file) and
// repeating groups (blocks/vector) — bulky or not a legible entry. Text AND
// longtext ARE recorded: the exact rendered copy is a tamper-relevant signal, so
// it belongs in the credential (stored in full, bounded by TEXT_VALUE_CAP below).
const SUMMARISABLE_TYPES = new Set<string>([
  'text', 'longtext', 'number', 'boolean', 'color', 'select', 'url', 'date', 'time', 'datetime-local',
]);
// Text/longtext are kept in FULL (not truncated to the scalar sample length) so the
// verifiable copy matches what the asset shows — capped only against a pathological
// manifest. Non-text scalars keep the short `maxValueLen` sample.
const TEXT_VALUE_CAP = 4000;

/**
 * A compact, human-readable digest of a tool's scalar inputs — id → short string
 * — for embedding in export provenance (the C2PA `tools.lolly.export`
 * assertion), so an inspected asset answers "what was this made from": the
 * colours, sizes, toggles and short text it was rendered with.
 *
 * Privacy-aware: skips uploads and repeating groups (see {@link SUMMARISABLE_TYPES})
 * and profile-bound inputs, so a user's pre-filled name/email never rides along
 * unless they opted into authorship separately; drops empties; appends a number's
 * unit ("12 mm"). Text and longtext are recorded IN FULL (bounded by TEXT_VALUE_CAP)
 * — the exact rendered copy is a tamper-relevant signal — while other scalars keep a
 * short sample. Bounded by `maxEntries`. Never throws — enrichment must not fail an export.
 */
export function summarizeInputs(
  model: readonly InputModelItem[],
  { maxValueLen = 48, maxEntries = 24 }: { maxValueLen?: number; maxEntries?: number } = {},
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const item of model) {
    if (Object.keys(out).length >= maxEntries) break;
    if (!item || !SUMMARISABLE_TYPES.has(item.type) || item.bindToProfile) continue;
    const v = flattenValue(item.value);
    if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') continue;
    let s = String(v).trim();
    if (!s) continue;
    if (item.unit && typeof v === 'number') s += ` ${item.unit}`;
    // Text keeps its full copy (bounded); other scalars keep the short sample.
    const cap = (item.type === 'text' || item.type === 'longtext') ? TEXT_VALUE_CAP : maxValueLen;
    if (s.length > cap) s = s.slice(0, Math.max(1, cap - 1)) + '…';
    out[item.id] = s;
  }
  return out;
}

/**
 * The model as hooks should see it: token-backed colour values flattened to their
 * resolved hex string, matching what templates (and CLI/JSON export) receive. The
 * `{ ref, value }` shape is an engine implementation detail for keeping a colour
 * linked to a token; leaking it to hooks breaks the common `(inputs.x || '').trim()`
 * pattern. Other values (incl. AssetRefs, which carry no `ref`) pass through.
 */
export function modelForHooks(model: InputModelItem[]): InputModelItem[] {
  return model.map(i => {
    const v = flattenValue(i.value);
    return v === i.value ? i : { ...i, value: v };
  });
}

// A token-backed colour value ({ ref, value }) hydrates as its resolved hex —
// the template (and CLI/JSON export) only ever sees a plain colour string. The
// runtime refreshes `.value` from the live token set before this; the cached hex
// is the fallback. Plain values (incl. AssetRefs, which carry no `ref`) pass through.
export function flattenValue(v: InputValue): InputValue {
  if (!isTokenValue(v)) return v;
  // The cached value is a resolved colour string; anything else (or a missing
  // cache) flattens to '' — the same fallback the `?? ''` gave.
  return typeof v.value === 'string' ? v.value : '';
}
