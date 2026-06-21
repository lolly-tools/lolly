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

  const template = await fetchFile(`${toolId}/template.html`);
  const styles = await tryFetch(fetchFile, `${toolId}/styles.css`);
  const hooksSource = manifest.hooks
    ? await tryFetch(fetchFile, `${toolId}/hooks.js`)
    : null;

  // Sibling text templates for data formats (template.ics / .vcf / .csv). Only
  // fetched when the manifest actually declares that format, so most tools incur
  // no extra requests. The runtime hydrates these from the input model on export.
  const textTemplates = {};
  const declared = manifest.render?.formats ?? [];
  for (const ext of ['ics', 'vcf', 'csv']) {
    if (declared.includes(ext)) {
      textTemplates[ext] = await tryFetch(fetchFile, `${toolId}/template.${ext}`);
    }
  }

  return {
    manifest,
    template,
    styles,
    hooksSource,
    textTemplates,
  };
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
