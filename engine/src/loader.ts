// SPDX-License-Identifier: MPL-2.0
/**
 * Tool loader.
 *
 * A "tool" on disk/CDN is a directory:
 *   tool-id/
 *     tool.json          — manifest (required)
 *     template.html      — render markup (required)
 *     styles.css         — optional, scoped
 *     hooks.js           — optional imperative escape hatch
 *     thumb.png          — gallery thumbnail
 *     assets/...         — tool-local assets (not in global catalog)
 *
 * The loader doesn't render anything. It produces a normalised Tool object
 * the runtime can use. This separation lets us pre-warm tool caches without
 * mounting them.
 */

import { validateManifest } from './validate.ts';
import type { ValidationIssue } from './validate.ts';
import type { InputSpec } from './inputs.ts';
import type { ComposeEntry } from './compose.ts';
import type { Capability } from './bridge/host-v1.ts';

/** `render` block of a tool manifest (schemas/tool.schema.json `render`). */
export interface ToolRenderSpec {
  width: number;
  height: number;
  /** Output formats the tool supports (schema enum; the engine treats them as opaque). */
  formats: string[];
  actions?: unknown[];
  export?: boolean;
  layout?: string;
  dims?: boolean;
  printMarks?: boolean;
  transparentBg?: boolean;
  /** Requested longest edge (px) for live camera frames (see host-v1 MediaAPI). */
  liveMaxEdge?: number;
  convertPaths?: boolean;
  preview?: Record<string, unknown>;
  video?: Record<string, unknown>;
  aspectWarning?: Record<string, unknown>;
}

/** Which hooks a tool's hooks.js declares (schemas/tool.schema.json `hooks`). */
export interface ToolHookFlags {
  /** hooks.js is a standard ES module (named exports, sibling imports allowed);
   *  the host loads it via dynamic import instead of evaluating source text. */
  module?: boolean;
  onInit?: boolean;
  onInput?: boolean;
  onFrame?: boolean;
  beforeRender?: boolean;
  beforeExport?: boolean;
  afterExport?: boolean;
  exportFile?: boolean;
}

/**
 * A parsed + schema-validated tool manifest (schemas/tool.schema.json).
 * Produced only by loadTool, which validates the JSON before asserting this
 * shape — everything downstream (runtime, shells) trusts it.
 */
export interface ToolManifest {
  id: string;
  name: string;
  description?: string;
  /** Handlebars template for the canvas's accessible label. */
  a11yLabel?: string;
  version: string;
  engineVersion: string;
  status: 'official' | 'community' | 'experimental';
  category?: string;
  /** 'on-device' marks a privacy utility: never watermarked, no provenance. */
  privacy?: 'on-device';
  tags?: string[];
  render: ToolRenderSpec;
  inputs: InputSpec[];
  capabilities?: Capability[];
  /** Nested renders (tool composition) — see engine/src/compose.ts. */
  composes?: ComposeEntry[];
  hooks?: ToolHookFlags;
}

/**
 * Fetches one file from the tool directory, returning its text. Provided by
 * the host: the web shell fetches from the tools CDN, Tauri reads the synced
 * tools directory, the CLI reads from disk.
 */
export type ToolFetchFile = (path: string) => Promise<string>;

/** A normalised, loaded tool — everything the runtime needs to mount it. */
export interface LoadedTool {
  manifest: ToolManifest;
  /** template.html source (required). */
  template: string;
  /** styles.css source, or null when the tool ships none. */
  styles: string | null;
  /** hooks.js source, or null (absent, undeclared, module-loaded, or failed to fetch). */
  hooksSource: string | null;
  /** Importable URL for module hooks (hooks.module), or null for classic hooks. */
  hooksUrl: string | null;
  /**
   * Sibling text templates (template.ics/.vcf/.csv) keyed by extension —
   * only extensions the manifest declares appear; null marks a failed fetch.
   */
  textTemplates: Record<string, string | null>;
  /** Why a declared text template failed to load, keyed by extension. */
  textTemplateErrors: Record<string, string>;
}

export interface LoadToolOpts {
  /**
   * Resolve a tool-directory-relative path (e.g. "qr-code/hooks.js") to a URL a
   * native dynamic import can load — the web shell maps to /tools/<path>, the
   * CLI to a file:// URL. Required to load a tool that declares hooks.module.
   */
  resolveModuleUrl?: (path: string) => string;
}

export async function loadTool(toolId: string, fetchFile: ToolFetchFile, opts: LoadToolOpts = {}): Promise<LoadedTool> {
  const manifestText = await fetchFile(`${toolId}/tool.json`);
  const parsed: unknown = JSON.parse(manifestText);

  const { valid, errors } = validateManifest(parsed);
  if (!valid) {
    throw new ToolLoadError(`Manifest for "${toolId}" failed validation`, errors);
  }
  // JSON trust boundary: ajv just enforced schemas/tool.schema.json, which is
  // the source of the ToolManifest shape — this assertion records that fact.
  const manifest = parsed as ToolManifest;
  if (manifest.id !== toolId) {
    throw new ToolLoadError(
      `Manifest id "${manifest.id}" doesn't match directory "${toolId}"`,
      [],
    );
  }

  // Only the manifest is a true dependency (it tells us which optional files even
  // apply). Once parsed, fire every declared file concurrently — template (the one
  // other required file), styles, hooks, and any sibling text templates — so the
  // mount isn't serialised on a chain of independent fetches.
  const declared = manifest.render?.formats ?? [];
  // Sibling text templates for data formats (template.ics / .vcf / .csv). Only
  // fetched when the manifest actually declares that format, so most tools incur
  // no extra requests. The runtime hydrates these from the input model on export.
  const textExts = ['ics', 'vcf', 'csv'].filter(ext => declared.includes(ext));

  // Module hooks (hooks.module) aren't fetched as text at all — the runtime
  // imports them natively, so sibling imports resolve and the browser/node
  // module cache applies. A host that can't resolve module URLs must fail HERE,
  // loudly: silently mounting a hook-less tool would render wrong output.
  const wantsModuleHooks = manifest.hooks?.module === true;
  if (wantsModuleHooks && !opts.resolveModuleUrl) {
    throw new ToolLoadError(
      `"${toolId}" declares module hooks, but this host provides no module-URL resolver`,
      [],
    );
  }
  const hooksUrl = wantsModuleHooks && opts.resolveModuleUrl
    ? opts.resolveModuleUrl(`${toolId}/hooks.js`)
    : null;

  const [[template, styles, hooksSource], textResults] = await Promise.all([
    Promise.all([
      fetchFile(`${toolId}/template.html`),                                  // required
      tryFetch(fetchFile, `${toolId}/styles.css`),                           // optional → null
      manifest.hooks && !wantsModuleHooks ? tryFetch(fetchFile, `${toolId}/hooks.js`) : Promise.resolve(null),
    ]),
    // Text templates capture their failure reason (vs. a plain null) so the runtime
    // can tell a transient load failure apart from a genuinely-absent template.
    Promise.all(textExts.map(ext => fetchText(fetchFile, `${toolId}/template.${ext}`))),
  ]);

  const textTemplates: Record<string, string | null> = {};
  const textTemplateErrors: Record<string, string> = {};
  textExts.forEach((ext, i) => {
    const result = textResults[i];
    if (!result) return; // same length as textExts by construction
    textTemplates[ext] = result.value;
    if (result.error != null) textTemplateErrors[ext] = result.error;
  });

  return {
    manifest,
    template,
    styles,
    hooksSource,
    hooksUrl,
    textTemplates,
    textTemplateErrors,
  };
}

/** A text-template fetch outcome: the source, or null plus why it failed. */
interface TextFetchResult {
  value: string | null;
  error: string | null;
}

// Fetch a declared text template, capturing why it failed (rather than collapsing
// every failure to null) so the runtime can surface a load error distinct from a
// tool that simply ships no template for the format.
async function fetchText(fetchFile: ToolFetchFile, path: string): Promise<TextFetchResult> {
  try {
    return { value: await fetchFile(path), error: null };
  } catch (e) {
    return { value: null, error: e instanceof Error ? e.message : String(e) };
  }
}

async function tryFetch(fetchFile: ToolFetchFile, path: string): Promise<string | null> {
  try {
    return await fetchFile(path);
  } catch {
    return null;
  }
}

export class ToolLoadError extends Error {
  validationErrors: ValidationIssue[];

  constructor(message: string, validationErrors: ValidationIssue[]) {
    super(message);
    this.name = 'ToolLoadError';
    this.validationErrors = validationErrors;
  }
}
