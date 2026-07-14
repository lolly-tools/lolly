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
import { verifyEnvelopeSignature, verifyToolFile } from './catalog-integrity.ts';
import type { CatalogSignatureEnvelope, IntegrityResult } from './catalog-integrity.ts';
import type { Lang } from './lang.ts';
import { ENGINE_VERSION } from './version.ts';
import { satisfiesRange } from './semver-range.ts';

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
  paged?: boolean;
  /** Multi-page ("carousel") editor config (schema `render.pages`). Present only on
   *  editor-layout tools whose canvas is a strip of N same-size `[data-pdf-page]`
   *  frames; names the number-input ids the page count/size are read from. */
  pages?: { count: string; width: string; height: string; gap?: number; min?: number; max?: number };
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

/**
 * Catalog-integrity enforcement config (catalog-integrity.ts). When a shell
 * passes this, every fetched tool file must match the signed digest map or
 * loadTool refuses to return the tool — fail closed, verified BEFORE the
 * runtime ever compiles hooks.js. Without it the loader behaves exactly as
 * before (plus a one-time "unsigned catalog" console warning).
 */
export interface ToolIntegrityOpts {
  /** The signed catalog envelope (catalog/tools/index.sig.json, as fetched). */
  envelope: CatalogSignatureEnvelope;
  /** The deployment's pinned catalog public key, imported for ECDSA-P256 verify. */
  publicKey: CryptoKey;
}

export interface LoadToolOpts {
  /**
   * Resolve a tool-directory-relative path (e.g. "qr-code/hooks.js") to a URL a
   * native dynamic import can load — the web shell maps to /tools/<path>, the
   * CLI to a file:// URL. Required to load a tool that declares hooks.module.
   */
  resolveModuleUrl?: (path: string) => string;
  /** Verify every fetched tool file against a signed catalog envelope. */
  integrity?: ToolIntegrityOpts;
  /**
   * UI/content language for this tool's manifest strings (see
   * plans/localize.md §7). When set and not 'en', loadTool best-effort fetches
   * a sibling `i18n/<lang>.json` overlay and merges it onto the returned
   * manifest's user-facing strings before anything downstream (buildInputModel,
   * every shell) ever sees it — one overlay point, every shell benefits.
   * Missing sidecar, missing keys, a malformed file, or (deliberately, for now
   * — see applyManifestI18n) an integrity-enforced load all fall back to the
   * manifest's own English strings; a translation problem never fails a tool load.
   */
  lang?: Lang;
}

/** A tool's optional `i18n/<lang>.json` sidecar: a flat, dotted-path overlay
 *  onto its own manifest fields — sparse (only the strings a translator
 *  touched), same identity-fallback contract as the SPA's i18n.ts catalogs.
 *  Keys: "name", "description", "a11yLabel", "inputs.<id>.label",
 *  "inputs.<id>.help", "inputs.<id>.placeholder", "inputs.<id>.section",
 *  "inputs.<id>.suffix", "inputs.<id>.options.<value>" (select option label),
 *  "inputs.<id>.addMenu.label", "inputs.<id>.fields.<fieldId>.label" /
 *  ".help" / ".placeholder" (blocks/vector sub-fields), and
 *  "inputs.<id>.fields.<fieldId>.options.<value>" (block sub-field option label).
 *  `featured.blurb` is intentionally NOT applied here — `featured` isn't part
 *  of the typed ToolManifest (it's catalog-index-only data); the same sidecar
 *  file's `featured.blurb` key is read separately by build-catalog-index.ts. */
export type ToolI18nOverlay = Record<string, string>;

/** Apply a sidecar overlay onto a manifest's user-facing strings, in place.
 *  Unknown/malformed keys are ignored (best-effort) — validated separately by
 *  scripts/validate-catalog.ts so authoring mistakes are caught at build time,
 *  not silently swallowed at runtime. */
export function applyManifestI18n(manifest: ToolManifest, overlay: ToolI18nOverlay): void {
  for (const [key, value] of Object.entries(overlay)) {
    if (typeof value !== 'string' || !value) continue;
    if (key === 'name') { manifest.name = value; continue; }
    if (key === 'description') { manifest.description = value; continue; }
    if (key === 'a11yLabel') { manifest.a11yLabel = value; continue; }

    const m = /^inputs\.([^.]+)\.(.+)$/.exec(key);
    if (!m) continue;
    const [, inputId, rest] = m as unknown as [string, string, string];
    const input = manifest.inputs?.find(i => i.id === inputId);
    if (!input) continue;

    if (rest === 'label' || rest === 'help' || rest === 'placeholder' || rest === 'section' || rest === 'suffix') {
      (input as unknown as Record<string, string>)[rest] = value;
      continue;
    }
    // (.*) not (.+): an option's manifest `value` may be the empty string
    // (e.g. a "Default" choice), and its label must still be translatable.
    const optMatch = /^options\.(.*)$/.exec(rest);
    if (optMatch) {
      const opt = input.options?.find(o => o.value === optMatch[1]);
      if (opt) opt.label = value;
      continue;
    }
    if (rest === 'addMenu.label') {
      if (input.addMenu) input.addMenu.label = value;
      continue;
    }
    const fieldMatch = /^fields\.([^.]+)\.(.+)$/.exec(rest);
    if (fieldMatch) {
      const [, fieldId, fieldRest] = fieldMatch as unknown as [string, string, string];
      const field = input.fields?.find(f => f.id === fieldId);
      if (!field) continue;
      if (fieldRest === 'label' || fieldRest === 'help' || fieldRest === 'placeholder') {
        (field as unknown as Record<string, string>)[fieldRest] = value;
        continue;
      }
      const fieldOptMatch = /^options\.(.*)$/.exec(fieldRest);
      if (fieldOptMatch) {
        const fieldOpt = field.options?.find(o => o.value === fieldOptMatch[1]);
        if (fieldOpt) fieldOpt.label = value;
      }
    }
  }
}

const integrityTextEncoder = new TextEncoder();

// One envelope signature check per envelope object, shared across every
// loadTool call the shell makes with it (the per-file digests are the hot path).
const envelopeTrust = new WeakMap<CatalogSignatureEnvelope, Promise<IntegrityResult>>();

async function assertEnvelopeTrusted(integrity: ToolIntegrityOpts): Promise<void> {
  let pending = envelopeTrust.get(integrity.envelope);
  if (!pending) {
    pending = verifyEnvelopeSignature(integrity.envelope, integrity.publicKey);
    envelopeTrust.set(integrity.envelope, pending);
  }
  const result = await pending;
  if (!result.ok) {
    throw new ToolLoadError(`catalog integrity: envelope rejected — ${result.reason}`, []);
  }
}

/**
 * Verify one fetched file's bytes against the signed map. `text === null`
 * means the fetch failed/degraded — fatal when the catalog signed that file
 * (a stripped hooks.js must not silently mount a hook-less tool), fine when
 * the tool genuinely ships no such file (absent from the map too).
 */
async function assertFileIntegrity(
  integrity: ToolIntegrityOpts,
  toolId: string,
  filename: string,
  text: string | null,
): Promise<void> {
  if (text == null) {
    if (integrity.envelope.files?.[`${toolId}/${filename}`]) {
      throw new ToolLoadError(
        `catalog integrity: "${toolId}/${filename}" is signed in the catalog but failed to load — refusing to run without it`,
        [],
      );
    }
    return;
  }
  const result = await verifyToolFile(integrity.envelope, toolId, filename, integrityTextEncoder.encode(text));
  if (!result.ok) {
    throw new ToolLoadError(`catalog integrity: ${result.reason}`, []);
  }
}

// The unsigned-catalog compat path warns ONCE per process/session, not per tool.
let warnedUnsignedCatalog = false;
function warnUnsignedCatalogOnce(): void {
  if (warnedUnsignedCatalog) return;
  warnedUnsignedCatalog = true;
  console.warn('catalog integrity: unsigned catalog — tool code is not verified');
}

export async function loadTool(toolId: string, fetchFile: ToolFetchFile, opts: LoadToolOpts = {}): Promise<LoadedTool> {
  const integrity = opts.integrity ?? null;
  if (integrity) {
    await assertEnvelopeTrusted(integrity);
  } else {
    warnUnsignedCatalogOnce();
  }

  const manifestText = await fetchFile(`${toolId}/tool.json`);
  // Verify the manifest bytes before parsing/trusting anything it declares.
  if (integrity) await assertFileIntegrity(integrity, toolId, 'tool.json', manifestText);
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

  // Engine-compatibility floor (P0-3). Tools sync to clients as data, ahead of
  // the binary; a tool needing a newer engine than this build implements must be
  // REFUSED here — before its template/hooks are even fetched — not half-loaded
  // to call a method that isn't there and die. `engineVersion` is schema-required
  // (validateManifest ran above), so it's present; the range is matched against
  // the running ENGINE_VERSION with a dependency-free caret/tilde/comparator
  // check (semver-range.ts). This is the load-bearing element of the whole
  // fast-catalog / slow-binary model — it fails closed, deliberately.
  if (!satisfiesRange(ENGINE_VERSION, manifest.engineVersion)) {
    throw new ToolLoadError(
      `"${toolId}" requires engine ${manifest.engineVersion}, but this build implements ${ENGINE_VERSION} — refusing to load`,
      [],
    );
  }

  // Translation overlay (see LoadToolOpts.lang / applyManifestI18n above).
  // Deliberately skipped when integrity is enforced: i18n/<lang>.json isn't
  // (yet) part of CATALOG_SIGNED_TOOL_FILES, so there's no signed digest to
  // check it against — applying an unverified overlay under a signed catalog
  // would be a trust-boundary regression. Extend the signing pipeline
  // (scripts/checksum-assets.ts, catalog-integrity.ts's file list) before
  // lifting this restriction.
  if (opts.lang && opts.lang !== 'en' && !integrity) {
    try {
      const overlayText = await fetchFile(`${toolId}/i18n/${opts.lang}.json`);
      applyManifestI18n(manifest, JSON.parse(overlayText) as ToolI18nOverlay);
    } catch {
      // No sidecar for this tool/language, or it failed to parse — the
      // manifest's own (English) strings are always a valid fallback.
    }
  }

  // Only the manifest is a true dependency (it tells us which optional files even
  // apply). Once parsed, fire every declared file concurrently — template (the one
  // other required file), styles, hooks, and any sibling text templates — so the
  // mount isn't serialised on a chain of independent fetches.
  const declared = manifest.render?.formats ?? [];
  // Sibling text templates for data formats (template.ics / .vcf / .csv / .md).
  // Only fetched when the manifest actually declares that format, so most tools
  // incur no extra requests. The runtime hydrates these from the input model on
  // export. `md` is opt-in per tool: with a template.md the export is model-derived
  // markdown; without one, the host falls back to serialising the rendered DOM.
  const textExts = ['ics', 'vcf', 'csv', 'md'].filter(ext => declared.includes(ext));

  // Module hooks (hooks.module) aren't fetched as text at all — the runtime
  // imports them natively, so sibling imports resolve and the browser/node
  // module cache applies. A host that can't resolve module URLs must fail HERE,
  // loudly: silently mounting a hook-less tool would render wrong output.
  const wantsModuleHooks = manifest.hooks?.module === true;
  // Module hooks are imported natively — the loader never sees their bytes, so
  // the signed digest map CANNOT cover what actually executes (nor sibling
  // imports). Fail closed rather than pretend they're verified.
  if (wantsModuleHooks && integrity) {
    throw new ToolLoadError(
      `catalog integrity: "${toolId}" declares module hooks, whose imported bytes cannot be verified against the signed catalog`,
      [],
    );
  }
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

  // Fail closed on every fetched file before the tool can reach the runtime
  // (this is upstream of hooks compilation). Note the null cases: a signed
  // styles.css/hooks.js that degraded to null is fatal here, closing the
  // tryFetch silent-strip hole the unsigned path still has.
  if (integrity) {
    await assertFileIntegrity(integrity, toolId, 'template.html', template);
    await assertFileIntegrity(integrity, toolId, 'styles.css', styles);
    if (manifest.hooks && !wantsModuleHooks) {
      await assertFileIntegrity(integrity, toolId, 'hooks.js', hooksSource);
    }
    for (const ext of textExts) {
      await assertFileIntegrity(integrity, toolId, `template.${ext}`, textTemplates[ext] ?? null);
    }
  }

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
