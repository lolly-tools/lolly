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
  | 'vector' | 'file' | 'table';

/** The control a shell should render for a model item (see pickControl). */
export type InputControl =
  | 'slider' | 'textarea' | 'select' | 'asset-picker' | 'palette-picker'
  | 'color-picker' | 'checkbox' | 'time-input' | 'datetime-local-input'
  | 'blocks' | 'vector' | 'file-picker' | 'table' | 'text-input';

/** A vector input's compound value: one number per declared field id. */
export type VectorValue = Record<string, number>;

/**
 * A `table` input's value: user-defined column headings plus rows of plain-string
 * cells. Both dimensions are user DATA (unlike `blocks`, whose fields are declared
 * in the manifest) - that's what lets one tool render any table. Rows are kept
 * rectangular: normalizeTableValue pads/folds every row to `columns.length`.
 */
export type TableValue = {
  columns: string[];
  rows: string[][];
};

/**
 * The editor a shell offers for one `table` column (schema `columnEditors`).
 * 'text' is a plain cell, 'url' a plain cell with a URL keyboard, 'emoji' a
 * button that opens an emoji picker. Cells stay plain strings in every case.
 */
export type TableColumnEditor = 'text' | 'url' | 'emoji';

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
  /** Short pill shown beside this option's label. Any option carrying a badge
   *  switches the select to a badged picker in the web shell (a radiogroup of
   *  labelled pills). A discovery hint, e.g. 'vector' / 'raster'. Engine only carries it. */
  badge?: string;
  /** Export formats to offer while THIS option is selected - a subset of
   *  render.formats. Lets a select (e.g. an effect picker) drive the export bar.
   *  Engine only carries it; the web shell intersects it with render.formats. */
  formats?: string[];
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
 * One field of a `blocks` row - a superset of VectorFieldSpec: blocks declare
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
  /** Icon name (shells/web/src/lib/icons.ts) shown inline to the left of this field's
   *  control instead of a stacked text label (on a `labelledFields` block). The engine
   *  only carries it; the web shell resolves + renders the glyph. */
  icon?: string;
  /** On an ASSET sub-field: the shared PREFIX of the row's framing numbers -
   *  <prefix>Zoom / <prefix>X / <prefix>Y / <prefix>Rotate / <prefix>Pitch /
   *  <prefix>Yaw - declaring that those siblings frame THIS image (plans/148). A
   *  block sub-field cannot be a `vector`, so a row spells the values out; naming
   *  the prefix here is what lets the shell's framing overlay bind a block row.
   *  Normally the field's own id; a different prefix only where the numbers
   *  already ship under one (color-block's bgImage + bgX/bgY/bgZoom), since those
   *  ids are permanent URL contracts. */
  framingFor?: string;
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
  /** Always-visible fine print rendered above the control (unlike `help`, which
   *  sits behind an info button). For what the user should read BEFORE typing - 
   *  e.g. the consent disclosure on an input whose value triggers a network
   *  lookup. */
  notice?: string;
  required?: boolean;
  default?: InputValue;
  bindToProfile?: string;
  /** Embed this input's value into the export's provenance metadata under the named
   *  field (EXIF/XMP/PNG text + the C2PA manifest), overriding the profile-derived
   *  default. 'copyright'/'license' are USER-ASSERTED IP fields with no profile
   *  source. See engine/src/metadata.ts (buildExportMeta) and the claim
   *  tool. Carried onto InputModelItem via this extends. */
  bindToMeta?: 'author' | 'contact' | 'description' | 'copyright' | 'license';
  /** For an `asset`/`file` input: the export format DEFAULTS to this input's uploaded
   *  format (a dropped JPEG defaults the export to jpg) until the user picks a format
   *  themselves. The uploaded format must be one the tool offers. Read by the web
   *  shell's renderActions; see the claim tool. */
  matchExportFormat?: boolean;
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
   *  compact button that cycles its options, labelled by each option's `icon`);
   *  `pill` is a boolean variant rendered as an inline chip toggle (the web shell
   *  flows consecutive pill booleans into one wrapped chip bar); `segmented`
   *  renders a select as labelled tabs (a radiogroup of pills). */
  display?: 'input' | 'slider' | 'icon-toggle' | 'pill' | 'segmented';
  // color
  palette?: string;
  swatchesOnly?: boolean;
  // select
  options?: SelectOption[];
  /** For a `select` input: append the user's installed brand-font families as extra
   *  options. The engine ignores it (fonts are a shell concept); the web shell fills
   *  the list from user-fonts.ts. Mirrors the same member on a block sub-field. */
  brandFonts?: boolean;
  // asset
  assetType?: string;
  filter?: Record<string, unknown>;
  allowUpload?: boolean;
  // vector (blocks declares richer field objects; the engine only reads these)
  fields?: BlockFieldSpec[];
  // file
  accept?: string[];
  maxSize?: number;
  /** A `file` input that accepts MANY files at once (batch tools). The value
   *  becomes an `InputFile[]` (empty `[]` when none) instead of a single
   *  `InputFile | null`, and an `exportFile` hook may return one result per file.
   *  The web file-picker sets the `multiple` attribute; the CLI collects repeated
   *  `--<id>=path` occurrences. See the embed-track tool. */
  multiple?: boolean;
  // Presentation members the web shell reads (the engine only carries them - 
  // they mirror schemas/tool.schema.json, same as the block sub-field members).
  /** Sidebar section (collapsible group) this input renders under. */
  section?: string;
  /** Render this input's control INSIDE the named sibling input's control row
   *  (leading), instead of on its own labelled row - for a compact modifier that
   *  belongs to another control, e.g. a fit toggle on an asset slot. It stays an
   *  ordinary input everywhere else (URL params, hooks, state, undo). The engine
   *  only carries it; the web shell places it. */
  attachTo?: string;
  /** On a `vector` input holding image framing ({ zoom, x, y, rotate? }): the id of
   *  the asset input whose content it frames (plans/148). Declares this as THE
   *  framing control for that image - the web shell mounts its generic on-canvas
   *  pan/zoom/rotate overlay on it and offers "Use as a new image". The engine only
   *  carries it; the placement maths is framing.ts and the gestures are shell code. */
  framingFor?: string;
  placeholder?: string;
  /** Unit label shown beside a slider value (e.g. "mm"). */
  unit?: string;
  suffix?: string;
  // table presentation
  /** On a `table` input: which editor each COLUMN uses, matched to the columns by
   *  position (a column with no entry edits as plain text). The engine only carries
   *  it - the stored TableValue is the same strings whichever editor wrote them, so
   *  URL mode and the CLI are unaffected. See schema `columnEditors`. */
  columnEditors?: TableColumnEditor[];
  // blocks presentation/behaviour
  addMenu?: BlocksAddMenu;
  labelledFields?: boolean;
  /** Adds copy / paste / clear buttons to each block's header (next to collapse +
   *  remove) - copy a row's values, paste them onto another row to make the two
   *  match, or clear a row to its field defaults. The engine only carries it; the
   *  web shell renders + wires it. See schema `rowActions`. */
  rowActions?: boolean;
  nesting?: BlocksNesting;
  dropToAdd?: BlocksDropToAdd;
  /** Adds a "Paste Markdown" button to the blocks toolbar (splits clipboard
   *  Markdown into one block per heading). See schema `mdPaste`. */
  mdPaste?: boolean;
  /** Adds a unified "Add data" affordance: pick a file (csv/json/txt/md/xlsx) or a
   *  catalog text/boilerplate asset, and its content fills the field. See schema
   *  `dataSource` and plan 87. `tags` selects which catalog text assets to offer. */
  dataSource?: { tags?: string[]; accept?: string };
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
 * undeclared cap never means an *unbounded* read into memory - file bytes are
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

/** A well-formed value for a `multiple` file input: an array of loaded FileRefs.
 *  Stray non-file entries are not tolerated - the whole value must be clean. */
export function isFileArrayValue(v: unknown): v is InputFile[] {
  return Array.isArray(v) && v.every(isFileValue);
}

/**
 * Coerce any candidate value into a well-formed {@link TableValue}, or null when
 * it isn't table-shaped at all. Cells and headings become trimmed-of-nothing plain
 * strings (numbers/booleans stringify; objects/arrays are rejected per-cell to '');
 * every row is padded with '' or truncated to `columns.length`, so downstream
 * consumers (template pagination, the URL codec, shells) can index cells by column
 * position without guarding ragged data.
 */
export function normalizeTableValue(v: unknown): TableValue | null {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return null;
  const o = v as { columns?: unknown; rows?: unknown };
  if (!Array.isArray(o.columns) || !Array.isArray(o.rows)) return null;
  const cell = (c: unknown): string =>
    typeof c === 'string' ? c
    : (typeof c === 'number' || typeof c === 'boolean') ? String(c)
    : '';
  const columns = o.columns.map(cell);
  const rows = o.rows
    .filter((r): r is unknown[] => Array.isArray(r))
    .map(r => {
      const out = r.slice(0, columns.length).map(cell);
      while (out.length < columns.length) out.push('');
      return out;
    });
  return { columns, rows };
}

// Any non-null object value - the shape vector compounds (and the JSON-ish
// initial values they merge) take. Arrays pass too, mirroring the original
// `typeof v === 'object'` checks (a string-keyed read on one is undefined).
function isObjectValue(v: InputValue | null | undefined): v is { [key: string]: InputValue | undefined } {
  return typeof v === 'object' && v !== null;
}

/**
 * Render-level options surfaced as synthetic boolean inputs, so hooks can react to them
 * (onInit/onInput) and URL mode can set them - without a tool redeclaring them. Shared by
 * buildInputModel (the model) and parseUrlState (URL/CLI params): if only buildInputModel
 * knew about these, `?transparentBg=true` would be silently dropped on load, which is
 * exactly the bug this centralises away.
 */
export function syntheticInputs(manifest: InputManifest): InputSpec[] {
  const declared = manifest.inputs ?? [];
  const synthetic: InputSpec[] = [];
  if (
    manifest.render?.transparentBg !== undefined &&
    !declared.some(i => i.id === 'transparentBg')
  ) {
    // A sidebar input, NOT group:'export': the background is a creative choice the
    // user makes alongside colour/theme, and they rarely open the export panel where
    // it used to hide. (convertPaths below stays in the export group - it only ever
    // affects the exported vector file, not the on-canvas result.)
    synthetic.push({
      id: 'transparentBg',
      label: 'Transparent background',
      type: 'boolean',
      default: Boolean(manifest.render.transparentBg),
      help: 'Remove the background fill so alpha-supporting formats (PNG/WebP/SVG) keep transparency.',
    });
  }

  // 'Convert paths' - auto-injected for any tool that exports a vector format.
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
  return synthetic;
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
  const synthetic = syntheticInputs(manifest);

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
  // can carry an unresolved {__file, path} ref or a stray string - accept only a
  // ref that actually carries bytes (the shell loaded it); otherwise start blank.
  // (The CLI resolves path→bytes before createRuntime; the web picker provides the
  // bytes directly. Binary content is never expressible in a shareable URL.)
  if (input.type === 'file') {
    const v = initial[input.id];
    // A `multiple` file input holds an array of loaded FileRefs (empty when none);
    // a single one holds one ref or null. Accept only clean values so the model
    // never carries an unresolved {__file, path} ref or a stray string.
    if (input.multiple) return isFileArrayValue(v) ? v : (isFileValue(v) ? [v] : []);
    return isFileValue(v) ? v : null;
  }
  // A table initial (URL/saved state) is normalized on the way in so the model
  // never holds a ragged or non-string grid; unparseable → declared default.
  if (input.type === 'table') {
    const v = normalizeTableValue(initial[input.id]);
    if (v) return v;
    return normalizeTableValue(input.default) ?? { columns: [], rows: [] };
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
    case 'table':
      return { columns: [], rows: [] };
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
  if (input.type === 'table') return 'table';
  return 'text-input';
}

/**
 * Apply user input changes back to the model, with constraint enforcement.
 * Returns a new model array - caller passes it to the renderer.
 */
export function updateInput(model: InputModelItem[], id: string, value: InputValue): InputModelItem[] {
  return model.map(input => {
    if (input.id !== id) return input;
    const constrained = constrain(input, value);
    return { ...input, value: constrained, isDirty: true };
  });
}

/**
 * The input model's value gate - every write through `updateInput` (a keystroke, a
 * canvas commit, a `/multi` fan-out, `runtime.applyPatch`) passes here, and a value
 * the declared constraints reject keeps the input's PRIOR value rather than entering
 * the model. That "rejection = the old value" convention is what lets applyPatch
 * detect a rejected key (plans/100 section 11.11) without a second validation pass.
 *
 * NOT a policy engine: it enforces what the manifest DECLARES (an enum's options, a
 * number's range, a string's maxLength) and the value SHAPE each type is defined to
 * hold. Two types are deliberately shape-blind, because their legitimate values are
 * object-shaped and resolved elsewhere in the lifecycle: `asset` (an AssetRef, or a
 * `{_unresolved}` stub that resolveAssetRefs completes) and `color` (a plain hex, or
 * a `{ref}` token value that resolveTokenRefs completes). A caller that accepts
 * values from a peer must therefore still gate those two by declared type at ITS
 * boundary - the web shell's collab plumbing does, in lib/collab-plumbing.ts.
 *
 * Hook patches do NOT come through here (runtime.ts's mergePatch is the tool's own
 * trust boundary - a hook may compute anything for its own tool).
 */
function constrain(input: InputModelItem, value: InputValue): InputValue {
  if (input.type === 'select') {
    // The enum whitelist (plans/100 section 11.11's first named case). Only when the
    // manifest actually declares the options AND does not extend them at runtime:
    // a `brandFonts` select is appended to by the shell with the user's installed
    // families, so its declared list is not the whole truth - the same carve-out
    // engine/src/preflight.ts's checkSelectValue makes. Compared as strings because
    // a shell's select control hands back the option's value as text.
    const options = input.options;
    if (!Array.isArray(options) || options.length === 0 || input.brandFonts === true) return value;
    if (typeof value === 'object' && value !== null) return input.value;   // never an object
    return options.some(o => String(o?.value) === String(value)) ? value : input.value;
  }
  if (input.type === 'boolean') {
    if (typeof value === 'boolean') return value;
    // The canonical wire spellings a URL/CLI param carries (`?flag=1`), normalised
    // rather than rejected so those transports keep working. Anything else - an
    // object, an array, an arbitrary string - is not a boolean and is refused.
    if (value === 1 || value === '1' || value === 'true') return true;
    if (value === 0 || value === '0' || value === 'false' || value === '' || value === null) return false;
    return input.value;
  }
  if (input.type === 'date' || input.type === 'time' || input.type === 'datetime-local' || input.type === 'url') {
    // Plain-string types: the format is the control's business (and the tool's), but
    // an object or an array in one of them is garbage no writer legitimately sends.
    // `null` passes as the shell's "cleared" marker (a clear button hands it to every
    // type), and hydrates as empty exactly as it did before this gate existed.
    return typeof value === 'string' || value === null ? value : input.value;
  }
  if (input.type === 'blocks') {
    // A repeating field group is an ARRAY of rows, always. A non-array would break
    // every consumer that iterates it (template `{{#each}}`, the sidebar panel, the
    // collab row projection), so it keeps the prior value.
    return Array.isArray(value) ? value : input.value;
  }
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
    // A `multiple` input holds an array of FileRefs; keep only clean file entries
    // (empty array when cleared), never garbage.
    if (input.multiple) {
      if (isFileArrayValue(value)) return value;
      if (Array.isArray(value)) return value.filter(isFileValue);
      if (value === null) return [];
      return input.value;
    }
    // A picked file is a FileRef object (bytes + metadata) or null (cleared).
    // Reject anything else (e.g. a stray string) so the model can't hold garbage.
    if (value === null) return null;
    if (value && typeof value === 'object') return value;
    return input.value;
  }
  if (input.type === 'table') {
    // Only a well-formed grid may enter the model; anything else keeps the
    // current value (mirrors the file/vector garbage rejection).
    return normalizeTableValue(value) ?? input.value;
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
// repeating groups (blocks/vector) - bulky or not a legible entry. Text AND
// longtext ARE recorded: the exact rendered copy is a tamper-relevant signal, so
// it belongs in the credential (stored in full, bounded by TEXT_VALUE_CAP below).
const SUMMARISABLE_TYPES = new Set<string>([
  'text', 'longtext', 'number', 'boolean', 'color', 'select', 'url', 'date', 'time', 'datetime-local',
]);
// Text/longtext are kept in FULL (not truncated to the scalar sample length) so the
// verifiable copy matches what the asset shows - capped only against a pathological
// manifest. Non-text scalars keep the short `maxValueLen` sample.
const TEXT_VALUE_CAP = 4000;

/**
 * A compact, human-readable digest of a tool's scalar inputs - id → short string
 * - for embedding in export provenance (the C2PA `tools.lolly.export`
 * assertion), so an inspected asset answers "what was this made from": the
 * colours, sizes, toggles and short text it was rendered with.
 *
 * Privacy-aware: skips uploads and repeating groups (see {@link SUMMARISABLE_TYPES})
 * and profile-bound inputs, so a user's pre-filled name/email never rides along
 * unless they opted into authorship separately; drops empties; appends a number's
 * unit ("12 mm"). Text and longtext are recorded IN FULL (bounded by TEXT_VALUE_CAP)
 * - the exact rendered copy is a tamper-relevant signal - while other scalars keep a
 * short sample. Bounded by `maxEntries`. Never throws - enrichment must not fail an export.
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

// A token-backed colour value ({ ref, value }) hydrates as its resolved hex - 
// the template (and CLI/JSON export) only ever sees a plain colour string. The
// runtime refreshes `.value` from the live token set before this; the cached hex
// is the fallback. Plain values (incl. AssetRefs, which carry no `ref`) pass through.
export function flattenValue(v: InputValue): InputValue {
  if (!isTokenValue(v)) return v;
  // The cached value is a resolved colour string; anything else (or a missing
  // cache) flattens to '' - the same fallback the `?? ''` gave.
  return typeof v.value === 'string' ? v.value : '';
}

/**
 * Content-derived export filename (plans/140 S1). `render.filenameFrom` names
 * input ids whose VALUES name the exported file - "ana-kovac", not a fifth
 * "Event Name Badge.pdf". Returns the slug of the listed values in order, or
 * null when the manifest opts out or every listed value is empty (callers keep
 * their existing fallback, the tool name). A URL value contributes its host and
 * path ("https://suse.com/events" - "suse-com-events") so link tools name by
 * destination. Pure string derivation shared by the web export bar and the
 * batch grid, so both produce the same name for the same values.
 */
export function deriveExportFilename(
  manifest: { render?: { filenameFrom?: unknown } },
  values: Record<string, unknown>,
): string | null {
  const ids = manifest.render?.filenameFrom;
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const parts: string[] = [];
  for (const id of ids) {
    const v = flattenValue(values[String(id)] as InputValue);
    if (v == null || v === '' || typeof v === 'object') continue;
    let s = String(v);
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) {
      try { const u = new URL(s); s = `${u.hostname}${u.pathname}`; } catch { /* keep the raw string */ }
    }
    const slug = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase().slice(0, 40).replace(/-+$/, '');
    if (slug) parts.push(slug);
  }
  return parts.length ? parts.join('-').slice(0, 80).replace(/-+$/, '') : null;
}
