// SPDX-License-Identifier: MPL-2.0
/**
 * Embed URL grammar — the portable surface of tool composition.
 *
 * An author can write a literal, real-looking image URL in a template:
 *
 *   <img src="https://lolly.tools/tool/qr-code.svg?url=https://suse.com&color=0c322c">
 *
 * Nothing is ever fetched from lolly.tools. A shell recognises this exact shape
 * with `parseEmbedUrl`, renders the named tool LOCALLY (through host.compose),
 * and substitutes the result. The same URL is forward-compatible with a real
 * server that renders it for the outside world (email, third-party pages), so
 * the grammar lives in the engine as the single source of truth shared by the
 * client interceptor and any future server route.
 *
 * This module is pure and DOM-free: it only parses a string. The strict matcher
 * is the security boundary — anything that is not exactly this shape returns
 * null, and the caller then treats the src as an ordinary image (no local
 * render, so no way to coerce an arbitrary URL into "render this as a tool").
 */

const EMBED_HOST = 'lolly.tools';

/** A child render format an embed URL extension can name. Still formats plus the
 *  motion formats — webm/mp4 (video) and gif/apng (animated raster) — so a tool
 *  with movement can be embedded as a MOVING image, not just a frozen frame. The
 *  motion extensions must live here (not only in the liberal recogniser) because
 *  buildEmbedUrl mints `…/tool/<id>.webm?…` as the asset's persistent identity and
 *  that URL has to re-parse through THIS gate on reload. */
export type EmbedFormat = 'png' | 'jpg' | 'jpeg' | 'webp' | 'svg' | 'pdf' | 'webm' | 'mp4' | 'gif' | 'apng';

/** A parsed (valid) embed URL. */
export interface EmbedRef {
  toolId: string;
  ext: string;
  format: EmbedFormat;
  query: string;
}

// Extension → child render format. The path extension is the author's explicit
// fidelity choice (svg stays vector in svg/pdf exports; png/webp/jpg rasterise;
// webm/mp4/gif/apng carry the child's motion through as a video / animated raster).
const EXT_FORMAT: Record<string, EmbedFormat> = { png: 'png', jpg: 'jpg', jpeg: 'jpeg', webp: 'webp', svg: 'svg', pdf: 'pdf', webm: 'webm', mp4: 'mp4', gif: 'gif', apng: 'apng' };

// Same grammar as a tool id on disk / in the manifest schema: lowercase, digits,
// hyphens, no leading/trailing hyphen, ≥2 chars. Anchored — no slashes, no `..`.
const ID_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

/**
 * Parse a Lolly embed URL. Returns { toolId, ext, format, query } for a valid
 * `https://lolly.tools/tool/<id>.<ext>?<query>`, or null for anything else.
 * `src` is whatever a template put in an attribute — narrowed immediately.
 */
export function parseEmbedUrl(src: unknown): EmbedRef | null {
  if (typeof src !== 'string' || src.length > 4096) return null;
  let u;
  try { u = new URL(src); } catch { return null; }
  // Normalise a single FQDN trailing dot ("lolly.tools.") so the matcher and the
  // shell's neutralizer agree on what counts as the embed host.
  const host = u.hostname.replace(/\.$/, '');
  if (u.protocol !== 'https:' || host !== EMBED_HOST) return null;

  const m = /^\/tool\/([a-z0-9-]+)\.([A-Za-z0-9]+)$/.exec(u.pathname);
  if (!m) return null;

  const toolId = m[1];
  const ext = m[2]?.toLowerCase();
  if (toolId === undefined || ext === undefined) return null; // groups always match
  const format = EXT_FORMAT[ext];
  if (!format || !ID_RE.test(toolId)) return null;

  return { toolId, ext, format, query: u.search.replace(/^\?/, '') };
}
