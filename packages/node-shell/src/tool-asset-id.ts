// SPDX-License-Identifier: MPL-2.0
/**
 * An asset id for a picture a tool ships in its own folder:
 * `/tools/<tool-id>/assets/<file>`, the path the site already serves the file at.
 *
 * Why it exists: a tool's example looks (manifest `examples`) are carried in the
 * catalog index, the first-paint slim index (as each look's signature) and the
 * preview bundle, so a look that brought its own pictures as data: URLs put their
 * bytes in all three. Logo Wall's eleven placeholder logos were about 37 KB of
 * base64 in each. Named by path, a picture is a few dozen bytes there, and its
 * bytes are read only when the look is drawn.
 *
 * The grammar is deliberately narrow: one file directly in the tool's `assets`
 * folder, a picture extension, no query, no `..` (a file name cannot hold a
 * slash). Each shell reads the bytes its own way: the web shell through its
 * verified catalog fetch (tool files are signed with the catalog), the Node
 * shells from the profile's tool folder. DOM-free and Node-free, so the web shell
 * imports this module too.
 */

/** A picture a tool ships, parsed from its asset id. */
export interface ToolAssetId {
  toolId: string;
  /** The file name inside the tool's `assets` folder. */
  file: string;
  type: 'vector' | 'raster';
  /** The asset format, as an AssetRef spells it (`svg`, `png`, `jpg`, `webp`). */
  format: string;
  mime: string;
}

const TOOL_ASSET_RE = /^\/tools\/([a-z0-9][a-z0-9-]*)\/assets\/([a-z0-9][a-z0-9_.-]*\.(svg|png|jpe?g|webp))$/i;

const FORMATS: Record<string, { format: string; mime: string }> = {
  svg: { format: 'svg', mime: 'image/svg+xml' },
  png: { format: 'png', mime: 'image/png' },
  jpg: { format: 'jpg', mime: 'image/jpeg' },
  jpeg: { format: 'jpg', mime: 'image/jpeg' },
  webp: { format: 'webp', mime: 'image/webp' },
};

/** The parts of a tool asset id, or null when `id` is not one. */
export function parseToolAssetId(id: unknown): ToolAssetId | null {
  if (typeof id !== 'string') return null;
  const m = TOOL_ASSET_RE.exec(id);
  if (!m) return null;
  const kind = FORMATS[m[3]!.toLowerCase()]!;
  return { toolId: m[1]!, file: m[2]!, type: kind.format === 'svg' ? 'vector' : 'raster', format: kind.format, mime: kind.mime };
}
