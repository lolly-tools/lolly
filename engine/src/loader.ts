// SPDX-License-Identifier: MPL-2.0
/**
 * Tool loader.
 *
 * A "tool" on disk/CDN is a directory:
 *   tool-id/
 *     tool.json          - manifest (required)
 *     template.html      - render markup (required)
 *     styles.css         - optional, scoped
 *     hooks.js           - optional imperative escape hatch
 *     thumb.png          - gallery thumbnail
 *     assets/...         - tool-local assets (not in global catalog)
 *
 * The loader does not render anything. It produces a normalised Tool object
 * the runtime can use. This separation lets us pre-warm tool caches without
 * mounting them.
 */

import { validateManifest } from './validate.ts';
import type { ValidationIssue } from './validate.ts';
import { expandDerivedFormats } from './derived-formats.ts';
import type { InputSpec } from './inputs.ts';
import type {
  RenderSpec,
  ToolHookFlags as ToolHookFlagsBase,
  ToolManifest as ToolManifestBase,
} from '@lolly-tools/core';
import { TEXT_TEMPLATE_EXTS, verifyEnvelopeSignature, verifyToolFile } from './catalog-integrity.ts';
import type { CatalogSignatureEnvelope, IntegrityResult } from './catalog-integrity.ts';
import type { Lang } from './lang.ts';
import { ENGINE_VERSION } from './version.ts';
import { satisfiesRange } from './semver-range.ts';

/** `render` block of a tool manifest. The canonical shape lives in the
 *  tool-author SDK (`@lolly-tools/core` {@link RenderSpec}, mirroring
 *  schemas/tool.schema.json); re-exported under the engine's historical name. */
export type ToolRenderSpec = RenderSpec;

/**
 * Which hooks a tool's hooks.js declares. The schema-mirrored flags live in
 * `@lolly-tools/core` (ToolHookFlags); the engine adds `module`, which loadTool
 * implements but schemas/tool.schema.json does not yet admit (its `hooks` block
 * is `additionalProperties: false`; see the note in tests/catalog-integrity.test.ts).
 */
export interface ToolHookFlags extends ToolHookFlagsBase {
  /** hooks.js is a standard ES module (named exports, sibling imports allowed);
   *  the host loads it via dynamic import instead of evaluating source text. */
  module?: boolean;
}

/**
 * A parsed + schema-validated tool manifest (schemas/tool.schema.json).
 * Produced only by loadTool, which validates the JSON before asserting this
 * shape. Everything downstream (runtime, shells) trusts it.
 *
 * The field set is canonical in the tool-author SDK (`@lolly-tools/core`
 * ToolManifest, the schema-mirrored authoring type); the engine narrows the
 * two members whose runtime semantics it owns: `inputs` uses the engine's
 * {@link InputSpec} (the single source of input semantics; see inputs.ts),
 * and `hooks` admits the engine-implemented `module` flag.
 */
export interface ToolManifest extends Omit<ToolManifestBase, 'inputs' | 'hooks'> {
  inputs: InputSpec[];
  hooks?: ToolHookFlags;
}

/**
 * Fetches one file from the tool directory, returning its text. Provided by
 * the host: the web shell fetches from the tools CDN, Tauri reads the synced
 * tools directory, the CLI reads from disk.
 */
export type ToolFetchFile = (path: string) => Promise<string>;

/** A normalised, loaded tool: everything the runtime needs to mount it. */
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
   * Sibling text templates (template.ics/.vcf/.csv) keyed by extension.
   * Only extensions the manifest declares appear; null marks a failed fetch.
   */
  textTemplates: Record<string, string | null>;
  /** Why a declared text template failed to load, keyed by extension. */
  textTemplateErrors: Record<string, string>;
}

/**
 * Catalog-integrity enforcement config (catalog-integrity.ts). When a shell
 * passes this, every fetched tool file must match the signed digest map or
 * loadTool refuses to return the tool. This fails closed, verified BEFORE the
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
   * native dynamic import can load. The web shell maps to /tools/<path>, the
   * CLI to a file:// URL. Required to load a tool that declares hooks.module.
   */
  resolveModuleUrl?: (path: string) => string;
  /** Verify every fetched tool file against a signed catalog envelope. */
  integrity?: ToolIntegrityOpts;
  /**
   * UI/content language for this tool's manifest strings (see
   * plans/38-localize.md section 7). When set and not 'en', loadTool best-effort fetches
   * a sibling `i18n/<lang>.json` overlay and merges it onto the returned
   * manifest's user-facing strings before anything downstream (buildInputModel,
   * every shell) ever sees it. One overlay point, every shell benefits.
   * Missing sidecar, missing keys, a malformed file, or a sidecar that fails
   * integrity verification under a signed catalog all fall back to the
   * manifest's own English strings; a translation problem never fails a tool load.
   */
  lang?: Lang;
}

/** A tool's optional `i18n/<lang>.json` sidecar: a flat, dotted-path overlay
 *  onto its own manifest fields. Sparse (only the strings a translator
 *  touched), same identity-fallback contract as the SPA's i18n.ts catalogs.
 *  Keys: "name", "description", "a11yLabel", "inputs.<id>.label",
 *  "inputs.<id>.help", "inputs.<id>.notice", "inputs.<id>.placeholder", "inputs.<id>.section",
 *  "inputs.<id>.suffix", "inputs.<id>.options.<value>" (select option label),
 *  "inputs.<id>.addMenu.label", "inputs.<id>.fields.<fieldId>.label" /
 *  ".help" / ".placeholder" (blocks/vector sub-fields), and
 *  "inputs.<id>.fields.<fieldId>.options.<value>" (block sub-field option label),
 *  plus the walkthrough: "guide.title", "guide.tracks.<id>.label" / ".note" /
 *  ".steps.<index>".
 *  `featured.blurb` is intentionally NOT applied here. `featured` isn't part
 *  of the typed ToolManifest (it's catalog-index-only data); the same sidecar
 *  file's `featured.blurb` key is read separately by build-catalog-index.ts. */
export type ToolI18nOverlay = Record<string, string>;

/** Apply a sidecar overlay onto a manifest's user-facing strings, in place.
 *  Unknown/malformed keys are ignored (best-effort). They are validated separately by
 *  scripts/validate-catalog.ts so authoring mistakes are caught at build time,
 *  not silently swallowed at runtime. */
export function applyManifestI18n(manifest: ToolManifest, overlay: ToolI18nOverlay): void {
  for (const [key, value] of Object.entries(overlay)) {
    if (typeof value !== 'string' || !value) continue;
    if (key === 'name') { manifest.name = value; continue; }
    if (key === 'description') { manifest.description = value; continue; }
    if (key === 'a11yLabel') { manifest.a11yLabel = value; continue; }
    if (key.startsWith('guide.')) { applyGuideI18n(manifest, key.slice('guide.'.length), value); continue; }

    const m = /^inputs\.([^.]+)\.(.+)$/.exec(key);
    if (!m) continue;
    const [, inputId, rest] = m as unknown as [string, string, string];
    const input = manifest.inputs?.find(i => i.id === inputId);
    if (!input) continue;

    if (rest === 'label' || rest === 'help' || rest === 'notice' || rest === 'placeholder' || rest === 'section' || rest === 'suffix') {
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

/** The `guide.*` half of {@link applyManifestI18n}: "title",
 *  "tracks.<id>.label", "tracks.<id>.note", "tracks.<id>.steps.<index>".
 *  A step index past the end of the track is ignored. A translator cannot add
 *  steps the manifest does not have. */
function applyGuideI18n(manifest: ToolManifest, rest: string, value: string): void {
  const guide = manifest.guide;
  if (!guide) return;
  if (rest === 'title') { guide.title = value; return; }

  const m = /^tracks\.([^.]+)\.(.+)$/.exec(rest);
  if (!m) return;
  const [, trackId, field] = m as unknown as [string, string, string];
  const track = guide.tracks?.find(t => t.id === trackId);
  if (!track) return;
  if (field === 'label' || field === 'note') { track[field] = value; return; }

  const stepMatch = /^steps\.(\d+)$/.exec(field);
  if (stepMatch && track.steps?.[Number(stepMatch[1])] !== undefined) track.steps[Number(stepMatch[1])] = value;
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
    throw new ToolLoadError(`catalog integrity: envelope rejected - ${result.reason}`, []);
  }
}

/**
 * Verify one fetched file's bytes against the signed map. `text === null`
 * means the fetch failed or degraded. This is fatal when the catalog signed that file
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
        `catalog integrity: "${toolId}/${filename}" is signed in the catalog but failed to load - refusing to run without it`,
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
  // A calm info, not a warning: an unsigned catalog is the EXPECTED state for a local
  // or dev build (a signed deploy carries an integrity envelope and never reaches here),
  // so it should inform without the alarming console.warn triangle. Plain console.info
  // (no %c/emoji) because the engine also runs in the CLI/node, where those are noise.
  console.info('catalog integrity: unsigned catalog (tool code is not signature-verified) - expected for a local or dev catalog');
}

export async function loadTool(toolId: string, fetchFile: ToolFetchFile, opts: LoadToolOpts = {}): Promise<LoadedTool> {
  const integrity = opts.integrity ?? null;
  if (integrity) {
    await assertEnvelopeTrusted(integrity);
  } else {
    warnUnsignedCatalogOnce();
  }

  const manifestText = await fetchFile(`${toolId}/tool.json`);
  // Verify the manifest bytes before parsing or trusting anything it declares.
  if (integrity) await assertFileIntegrity(integrity, toolId, 'tool.json', manifestText);
  const parsed: unknown = JSON.parse(manifestText);

  // Engine-compatibility floor (P0-3) runs BEFORE schema validation, and the order
  // is required, not incidental. A tool built against a newer engine will often
  // ALSO use manifest vocabulary this build's schema has never heard of: a new canvas
  // key, a new input type. `additionalProperties: false` turns that into an Ajv
  // error. Validate first and the diagnostic is "failed validation / must NOT have
  // additional properties", which reads as a broken tool. Check the range first and the
  // same tool reports the actionable, designed answer: it needs an engine this build
  // does not implement. The range is read defensively off the unparsed JSON (a pure
  // string comparison, no trust extended). Anything missing or non-string falls
  // through to validation, which requires `engineVersion` and reports it properly.
  const declaredRange = parsed && typeof parsed === 'object'
    && typeof (parsed as { engineVersion?: unknown }).engineVersion === 'string'
    ? (parsed as { engineVersion: string }).engineVersion
    : null;
  if (declaredRange !== null && !satisfiesRange(ENGINE_VERSION, declaredRange)) {
    throw new ToolLoadError(
      `"${toolId}" requires engine ${declaredRange}, but this build implements ${ENGINE_VERSION} - refusing to load`,
      [],
    );
  }

  const { valid, errors } = validateManifest(parsed);
  if (!valid) {
    throw new ToolLoadError(`Manifest for "${toolId}" failed validation`, errors);
  }
  // JSON trust boundary: ajv just enforced schemas/tool.schema.json, which is
  // the source of the ToolManifest shape. This assertion records that fact.
  const manifest = parsed as ToolManifest;
  if (manifest.id !== toolId) {
    throw new ToolLoadError(
      `Manifest id "${manifest.id}" doesn't match directory "${toolId}"`,
      [],
    );
  }

  // (The engine-compatibility floor is the essential element of the
  // fast-catalog / slow-binary model, and it fails closed deliberately. It was
  // checked above, before validation. Tools sync to clients as data, ahead of
  // the binary; a tool needing a newer engine than this build implements is
  // REFUSED before its template/hooks are even fetched, never half-loaded to
  // call a method that isn't there and die.)

  // Translation overlay (see LoadToolOpts.lang / applyManifestI18n above).
  // Under integrity the sidecar must match its signed digest (sign-catalog.ts
  // enumerates i18n/<lang>.json per tool: CATALOG_SIGNED_I18N_SIDECAR). Fail
  // CLOSED, but only on the overlay: a sidecar that is unsigned (old envelope),
  // tampered, or stripped in transit is DROPPED, never applied, and never
  // fails the tool. Unlike a stripped hooks.js, a lost translation only
  // downgrades the language, so English fallback is the right severity.
  if (opts.lang && opts.lang !== 'en') {
    try {
      const sidecar = `i18n/${opts.lang}.json`;
      const overlayText = await fetchFile(`${toolId}/${sidecar}`);
      if (integrity) await assertFileIntegrity(integrity, toolId, sidecar, overlayText);
      applyManifestI18n(manifest, JSON.parse(overlayText) as ToolI18nOverlay);
    } catch {
      // No sidecar for this tool/language, a failed integrity check, or a
      // malformed file. The manifest's own (English) strings are always a
      // valid fallback.
    }
  }

  // Only the manifest is a true dependency (it tells us which optional files even
  // apply). Once parsed, fire every declared file concurrently: template (the one
  // other required file), styles, hooks, and any sibling text templates. This way
  // the mount is not serialised on a chain of independent fetches.
  // Expand derived export formats (svg→svgz, emf→wmf, png/tiff→bmp) into the loaded
  // manifest so both shells' export menus and the CLI's format gate offer them without
  // every tool.json having to list them. Runtime-only: the generated catalog index is
  // left unexpanded on purpose (see engine/src/derived-formats.ts). After schema
  // validation, so the added ids never have to be in the schema's formats enum.
  if (manifest.render?.formats) {
    manifest.render.formats = expandDerivedFormats(manifest.render.formats);
  }
  const declared = manifest.render?.formats ?? [];
  // Sibling text templates for data formats (template.ics / .vcf / .csv / .srt /
  // .vtt / .md / .css / .scss / .gpl / .json). Only fetched when the manifest
  // actually declares that format, so most tools incur no extra requests. The
  // runtime hydrates these from the input model on export. `md` and `json` are
  // opt-in per tool: with a template.md/.json the export is model-derived; without
  // one, `md` falls back to serialising the rendered DOM and `json` to the built-in
  // {tool,version,inputs} dump. The extension list is catalog-integrity.ts's, not
  // a copy: what this fetches must be exactly what the catalog signer signs, or a
  // signed deploy refuses the tool (see TEXT_TEMPLATE_EXTS).
  const textExts = TEXT_TEMPLATE_EXTS.filter(ext => declared.includes(ext));

  // Module hooks (hooks.module) are not fetched as text at all. The runtime
  // imports them natively, so sibling imports resolve and the browser/node
  // module cache applies. A host that cannot resolve module URLs must fail HERE,
  // loudly: silently mounting a hook-less tool would render wrong output.
  const wantsModuleHooks = manifest.hooks?.module === true;
  // Module hooks are imported natively, so the loader never sees their bytes, and
  // the signed digest map CANNOT cover what actually executes (nor sibling
  // imports). Fail closed rather than pretend they are verified.
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
