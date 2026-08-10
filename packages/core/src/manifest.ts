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
  | 'file'
  | 'table';

/** One choice in a `select` input. */
export interface SelectOption {
  value: string;
  label?: string;
  /** Short pill shown beside the option (e.g. 'vector'/'raster'). Any option with a
   *  badge switches the select to a badged picker in the web shell. */
  badge?: string;
  /** Export formats offered while this option is selected — a subset of
   *  render.formats, letting the option drive the export format bar. */
  formats?: string[];
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
  /** Which edge a paged tool's slide-sorter filmstrip runs along. `'left'` (the
   *  default) is a vertical rail beside the canvas — right for tall documents.
   *  `'bottom'` is the deck-strip shape, for tools whose pages are wide and few
   *  (cards, slides), where a left rail eats the width the page needs. */
  filmstrip?: 'left' | 'bottom';
  /** `false` hides the 'Print marks & bleed' card (multi-page tools). `true`
   *  DECLARES PRINT INTENT — the card's master toggle defaults ON for every
   *  print-capable format. Unset: card offered, but marks/bleed default OFF for
   *  the RGB vector formats (pdf/svg/eps) and ON only for the separating press
   *  formats (pdf-cmyk/cmyk-tiff/eps-cmyk). */
  printMarks?: boolean;
  transparentBg?: boolean;
  c2pa?: boolean;
  /** Marks a device-recording tool (requires `host.recorder` + the matching
   *  `'microphone'`/`'camera'` capability): which record affordance the shell
   *  mounts. `'screen'` is display capture via `host.recorder`. */
  capture?: 'audio' | 'video' | 'av' | 'screen';
  /** Requested longest edge (px) for live-camera frames (see `MediaAPI`). */
  liveMaxEdge?: number;
  /** id of a number input whose value overrides `liveMaxEdge` — a user-facing
   *  resolution control. The runtime reads it at go-live and re-applies to the live
   *  stream whenever it changes, so the camera resolution follows a slider. */
  liveMaxEdgeInput?: string;
  convertPaths?: boolean;
  /** Multi-page ("carousel") editor config; names the number-input ids driving page count/size. */
  pages?: { count: string; width: string; height: string; gap?: number; min?: number; max?: number };
  /** Engine-driven pagination: `source` names a `table` input whose rows each
   *  produce one page. The runtime hydrates the template once per row — with a
   *  `page` context object ({ index, number, count, first, cells, fields }) —
   *  and wraps each hydration in its own `[data-pdf-page]` box, so the tool
   *  authors ONE page and never manages pagination itself. Pair with
   *  `paged: true` for the scrolling all-pages canvas. */
  paginate?: { source: string };
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
  beforeExport?: boolean;
  afterExport?: boolean;
  exportFile?: boolean;
  /**
   * The tool owns a raster still export at a bit depth the 8-bit DOM raster
   * cannot originate (16-bit/HDR PNG, OpenEXR, Radiance). The runtime (engine
   * 1.100+) calls it before host.export.render with { node, format, opts, host };
   * returning { bytes, mime } short-circuits the export to those bytes (computed
   * in float via host.codec), returning null declines and falls through. The
   * export panel opens the pro float formats (exr/hdr) for a tool that declares
   * this and has host.codec — see shells/web/src/views/tool-actions.ts.
   *
   * The bytes need not be a raster: the hook may own any tool-authored format for
   * a declared `format` — e.g. color-palette returns an Adobe `.ase` swatch file
   * (host.color.paletteExportBytes) for `format === 'ase'` and declines the rest.
   */
  exportStill?: boolean;
}

/** One route through a tool's {@link ToolGuide} — e.g. "on a computer" vs "on a phone". */
export interface ToolGuideTrack {
  /** Stable key; the i18n sidecar path (`guide.tracks.<id>.…`) is built from it. */
  id: string;
  /** Tab label, one or two words. */
  label: string;
  /** Ordered steps. Plain text; `**bold**` is the only markup. */
  steps: string[];
  /** Optional closing caveat under the steps. */
  note?: string;
}

/**
 * A short walkthrough for the last mile a render can't teach on its own — where
 * the export goes and what to do with it there. The web shell shows it as a
 * dialog behind a help button beside the tool title, opened once automatically
 * on a device's first visit to the tool. A handful of steps, not documentation.
 */
export interface ToolGuide {
  /** Dialog heading; the shell falls back to a generic one when omitted. */
  title?: string;
  /** One or more routes. A single track renders as a plain list; several as tabs. */
  tracks: ToolGuideTrack[];
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
  /**
   * Optional design-system version this tool renders against (plans/97 §6a): a
   * published version's slug, or `'latest'` for the edit head. Author-controlled
   * stability — a pinned tool keeps rendering against its version whatever gets
   * republished.
   *
   * Unlike {@link ToolManifest.engineVersion} this is NOT enforced at load. A pin
   * naming a version the device does not have falls through to the active version
   * and then to the head, so a tool always draws; a render can override it with
   * `?designv=`. On a device that never published a version it has no effect.
   */
  designVersion?: string;
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
  /** Marks this tool for the gallery's "Featured" hero row — its presence (even
   *  `{}`) includes the tool. `blurb` is the one-line hook shown over the hero
   *  tile; `order` an ascending sort key; `variants` a DEPRECATED alias for
   *  top-level `examples` (which wins when both are present). */
  featured?: { blurb?: string; order?: number; variants?: unknown[] };
  examples?: unknown[];
  /** Named starting points for the web shell's "New from template" chooser (shown
   *  only on a blank fresh open). Each entry is `{ id, name, description?, category?,
   *  thumb?, values }`; `values` is a full input seed read in-process (never packed
   *  into the URL), and the reserved `?template=<id>` param launches one directly,
   *  skipping the chooser. Additive — a tool without it is unchanged, and the
   *  manifest `default` composition still renders on URL-mode/CLI/deep-link opens. */
  templates?: unknown[];
  capabilities?: Capability[];
  /** `'network'`-capability config: the https URL allowlist the host builds `host.net`
   *  from. A trailing `*` on an entry is a prefix wildcard; otherwise it permits that
   *  exact URL. Absent ⇒ every `host.net` fetch rejects. */
  network?: { allowlist: string[] };
  composes?: ComposeEntry[];
  /** Optional "now what?" walkthrough shown by the shell (see {@link ToolGuide}). */
  guide?: ToolGuide;
  hooks?: ToolHookFlags;
  /**
   * Opt this tool's hooks into a Worker-isolated execution context (engine
   * 1.105+, plans/86-worker-isolation-hooks.md M2) instead of the default
   * in-realm `new Function` path. Set only once hooks.js is verified never to
   * touch DOM globals (document/window/Image/canvas); a shell without a
   * Worker-backed executor silently runs the tool in-realm, so declaring it is
   * always safe — a hint, not a hard requirement.
   */
  isolate?: boolean;
}
