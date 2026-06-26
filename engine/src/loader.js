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

import { validateManifest } from './validate.js';

/**
 * @param {string} toolId
 * @param {(path: string) => Promise<string|ArrayBuffer>} fetchFile
 *   Provided by the host. In the web shell, this fetches from the tools CDN.
 *   In Tauri, it reads from the synced tools directory. In CLI, from disk.
 * @returns {Promise<Tool>}
 */
export async function loadTool(toolId, fetchFile) {
  const manifestText = await fetchFile(`${toolId}/tool.json`);
  const manifest = JSON.parse(manifestText);

  const { valid, errors } = validateManifest(manifest);
  if (!valid) {
    throw new ToolLoadError(`Manifest for "${toolId}" failed validation`, errors);
  }
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

  const [template, styles, hooksSource, ...textResults] = await Promise.all([
    fetchFile(`${toolId}/template.html`),                                   // required
    tryFetch(fetchFile, `${toolId}/styles.css`),                           // optional → null
    manifest.hooks ? tryFetch(fetchFile, `${toolId}/hooks.js`) : Promise.resolve(null),
    // Text templates capture their failure reason (vs. a plain null) so the runtime
    // can tell a transient load failure apart from a genuinely-absent template.
    ...textExts.map(ext => fetchText(fetchFile, `${toolId}/template.${ext}`)),
  ]);

  const textTemplates = {};
  const textTemplateErrors = {};
  textExts.forEach((ext, i) => {
    const { value, error } = textResults[i];
    textTemplates[ext] = value;
    if (error != null) textTemplateErrors[ext] = error;
  });

  return {
    manifest,
    template,
    styles,
    hooksSource,
    textTemplates,
    textTemplateErrors,
  };
}

// Fetch a declared text template, capturing why it failed (rather than collapsing
// every failure to null) so the runtime can surface a load error distinct from a
// tool that simply ships no template for the format.
async function fetchText(fetchFile, path) {
  try {
    return { value: await fetchFile(path), error: null };
  } catch (e) {
    return { value: null, error: String(e?.message ?? e) };
  }
}

async function tryFetch(fetchFile, path) {
  try {
    return await fetchFile(path);
  } catch {
    return null;
  }
}

export class ToolLoadError extends Error {
  constructor(message, validationErrors) {
    super(message);
    this.name = 'ToolLoadError';
    this.validationErrors = validationErrors;
  }
}
