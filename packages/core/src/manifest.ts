// SPDX-License-Identifier: MPL-2.0
/**
 * Tool manifest — authoring types (`tool.json`).
 *
 * The AUTHORITATIVE contract for a manifest is the JSON Schema shipped alongside
 * this package (`@lolly-tools/core/schema/tool.schema.json`), enforced by
 * {@link validateTool} and by Lolly's catalog CI. These TypeScript types are an
 * authoring CONVENIENCE — they give editor autocomplete and type-checking when you
 * write your manifest as a typed object via {@link defineTool}. They intentionally
 * mirror the schema; where the two ever disagree the SCHEMA wins (and the repo's
 * drift-guard test fails). Type-specific input members (blocks sub-fields, vector
 * field specs, …) are deliberately left to the schema — {@link InputSpec} carries an
 * index signature so those extra members type-check while the schema validates them.
 */
import type { Capability, ExportFormat } from './host-v1.ts';

/** The kinds of input a tool can declare. Mirrors the schema's `inputs[].type` enum. */
export type InputType =
  | 'text'
  | 'longtext'
  | 'number'
  | 'boolean'
  | 'color'
  | 'select'
  | 'asset'
  | 'date'
  | 'time'
  | 'datetime-local'
  | 'url'
  | 'blocks'
  | 'vector'
  | 'file';

/** One choice in a `select` input. */
export interface SelectOption {
  value: string;
  label?: string;
}

/**
 * One declared input — the tool's public control surface. The shell renders every
 * input generically from this declaration and each is expressible as a URL param.
 * Only the members common to the built-in input types are named here; richer,
 * type-specific members are validated by the schema and accepted via the index
 * signature.
 */
export interface InputSpec {
  id: string;
  type: InputType;
  label?: string;
  help?: string;
  required?: boolean;
  default?: unknown;
  /** Pre-fill from the user profile, e.g. `"firstname"`. */
  bindToProfile?: string;
  /** Short URL-param alias for compact links, e.g. `"textColor"` → `"tc"`. */
  urlKey?: string;
  /** Collapsible sidebar section this control renders under. */
  section?: string;
  group?: string;
  /** Show this input only while the named inputs hold the given values. */
  showIf?: Record<string, unknown>;
  // text / longtext
  maxLength?: number;
  minLength?: number;
  pattern?: string;
  rows?: number;
  placeholder?: string;
  // number
  min?: number;
  max?: number;
  step?: number;
  display?: 'input' | 'slider';
  unit?: string;
  suffix?: string;
  // color
  palette?: string;
  swatchesOnly?: boolean;
  // select
  options?: SelectOption[];
  // asset
  assetType?: string;
  allowUpload?: boolean;
  filter?: Record<string, unknown>;
  // file
  accept?: string[];
  maxSize?: number;
  /** Type-specific members (blocks/vector/…) are validated by the schema. */
  [key: string]: unknown;
}

/**
 * The `render` block — canvas size, output formats, and layout behaviour.
 * `formats` entries are validated against the schema's format enum.
 */
export interface RenderSpec {
  width: number;
  height: number;
  formats: string[];
  layout?: string;
  export?: boolean;
  dims?: boolean;
  /** Set false to offer pixels only — the download bar hides the physical-unit
   *  selector + DPI field, so an on-screen pixel is an exported pixel. */
  units?: boolean;
  paged?: boolean;
  printMarks?: boolean;
  transparentBg?: boolean;
  c2pa?: boolean;
  capture?: Record<string, unknown>;
  /** Requested longest edge (px) for live-camera frames (see `MediaAPI`). */
  liveMaxEdge?: number;
  convertPaths?: boolean;
  /** Multi-page ("carousel") editor config; names the number-input ids driving page count/size. */
  pages?: { count: string; width: string; height: string; gap?: number; min?: number; max?: number };
  aspectWarning?: { min?: number; max?: number; message?: string };
  preview?: Record<string, unknown>;
  video?: Record<string, unknown>;
  actions?: unknown[];
  [key: string]: unknown;
}

/** A `composes` entry — a nested render exposed to the template as `{{asset <id>}}`. */
export interface ComposeEntry {
  /** Name the composed asset is exposed under. */
  id?: string;
  /** id of the tool to render. */
  tool?: string;
  /** Child inputs; string values are Handlebars-bound to the parent context. */
  inputs?: Record<string, unknown>;
  format?: ExportFormat;
  width?: number;
  height?: number;
}

/**
 * Which lifecycle hooks a tool's `hooks.js` declares. Mirrors the schema's `hooks`
 * block exactly (`additionalProperties: false`) — declaring a hook here tells the
 * host to wire that lifecycle point to your module's matching export.
 */
export interface ToolHookFlags {
  onInit?: boolean;
  onInput?: boolean;
  onFrame?: boolean;
  onLevel?: boolean;
  beforeRender?: boolean;
  beforeExport?: boolean;
  afterExport?: boolean;
  exportFile?: boolean;
}

/**
 * A parsed tool manifest. Author it with {@link defineTool} for type-checking, then
 * validate with {@link validateTool} before shipping (Lolly's catalog CI does the
 * same). `id` is a permanent contract — never rename or reuse it.
 */
export interface ToolManifest {
  id: string;
  name: string;
  version: string;
  engineVersion: string;
  status: 'official' | 'community' | 'experimental';
  render: RenderSpec;
  inputs: InputSpec[];
  description?: string;
  /** Handlebars template for the canvas's accessible label. */
  a11yLabel?: string;
  category?: string;
  new?: boolean;
  listed?: boolean;
  /** `'on-device'` marks a privacy utility: never watermarked, no embedded provenance. */
  privacy?: 'on-device';
  tags?: string[];
  featured?: boolean;
  examples?: unknown[];
  capabilities?: Capability[];
  /** `'network'`-capability config: the https URL allowlist the host builds `host.net`
   *  from. A trailing `*` on an entry is a prefix wildcard; otherwise it permits that
   *  exact URL. Absent ⇒ every `host.net` fetch rejects. */
  network?: { allowlist: string[] };
  composes?: ComposeEntry[];
  hooks?: ToolHookFlags;
}
