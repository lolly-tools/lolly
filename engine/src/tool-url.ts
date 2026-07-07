// SPDX-License-Identifier: MPL-2.0
/**
 * Lolly tool-URL recognition — the END-USER surface of tool composition.
 *
 * Where embed.js / `parseEmbedUrl` is the STRICT, host-locked gate for an embed
 * URL an *author* writes into a template (a security boundary: an arbitrary
 * `<img src>` must never be coerced into "render this as a tool"), this module is
 * the LIBERAL recogniser for a link an *end user* deliberately pastes into the
 * asset picker to say "render this tool as my image". Because the user's intent is
 * explicit, every shape the app can hand them is accepted:
 *
 *   - embed form ....... https://lolly.tools/tool/qr-code.svg?url=…   (parseEmbedUrl)
 *   - hash share route . https://lolly.tools/#/tool/qr-code?url=…     (the Share dialog)
 *   - pretty path ...... https://lolly.tools/qr-code?url=…            (the path shortcut)
 *
 * Host is NOT checked for the hash/path forms (a link copied from localhost or a
 * preview deploy is still the user's own tool). The real safety net is downstream:
 * the toolId must resolve to a REAL local tool (the host loader 404s otherwise), so
 * a pasted link can only ever render a tool that already ships in this build — the
 * same guarantee embed.js relies on.
 *
 * `buildEmbedUrl` canonicalises any of the above into the strict embed form, which
 * becomes the asset's persistent identity: it round-trips through URL mode + saved
 * sessions and is re-rendered on load via host.compose.renderUrl. Pure + DOM-free.
 */

import { parseEmbedUrl } from './embed.ts';
import type { EmbedFormat } from './embed.ts';

/** A recognised user-pasted tool URL. `format` is only known for the embed form. */
export interface ToolUrlRef {
  toolId: string;
  format: EmbedFormat | null;
  query: string;
}

/** Spec for minting the canonical embed URL. Liberal: guarded at runtime. */
export interface EmbedUrlSpec {
  toolId?: string;
  format?: string | null;
  query?: string | null;
}

// Tool ids: lowercase, digits, hyphens; >=2 chars; no leading/trailing hyphen.
// Same grammar as the manifest id and embed.js's ID_RE.
const ID_RE = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/;

// Render format -> path extension for the canonical embed URL. Mirrors the set
// embed.js (parseEmbedUrl) accepts, so a built URL always re-parses. 'jpeg'
// collapses to 'jpg' so the identity is stable regardless of how it was spelled.
// The motion formats (webm/mp4/gif/apng) keep their own extension so a placed
// MOVING embed re-renders as motion — not a still — when its id is reloaded.
const FORMAT_EXT: Record<string, string> = { png: 'png', jpg: 'jpg', jpeg: 'jpg', webp: 'webp', svg: 'svg', pdf: 'pdf', webm: 'webm', mp4: 'mp4', gif: 'gif', apng: 'apng' };

// Top-level app routes that share the pretty-path shape but are NOT tools.
const APP_ROUTES = new Set(['tool', 'pro', 'platform', 'capabilities', 'profile', 'gallery']);

// Max URL length. Matches parseEmbedUrl's cap so a URL we ACCEPT here and the
// canonical embed id we MINT from it (buildEmbedUrl) share one bound — the minted
// id must re-parse through parseEmbedUrl on load (the persistent-identity invariant).
const MAX_URL = 4096;

/**
 * Recognise any Lolly tool URL a user might paste. Returns
 * `{ toolId, format, query }` — `format` is the explicit choice from an embed-form
 * extension, else null (the caller picks a default); `query` is the raw query
 * string (no leading '?'). Returns null for anything that isn't a Lolly tool URL.
 * `src` is whatever the user pasted — narrowed immediately.
 */
export function parseToolUrl(src: unknown): ToolUrlRef | null {
  if (typeof src !== 'string') return null;
  const s = src.trim();
  if (!s || s.length > MAX_URL) return null;

  // 1) Strict embed form (…/tool/<id>.<ext>?…) — reuse the canonical parser, so
  //    the host-locked security shape stays authoritative for that form.
  const embed = parseEmbedUrl(s);
  if (embed) return { toolId: embed.toolId, format: embed.format, query: embed.query };

  let u: URL;
  try { u = new URL(s); } catch { return null; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;

  // 2) Hash share route (…/#/tool/<id>?<query>) — what the Share dialog produces.
  //    Everything after '#' is the fragment, so the route + its query both live in
  //    u.hash, e.g. "#/tool/qr-code?url=…". Split on the FIRST '?' only.
  if (u.hash) {
    const hash = u.hash.replace(/^#\/?/, '');           // "tool/qr-code?url=…"
    const qi = hash.indexOf('?');
    const hPath = qi === -1 ? hash : hash.slice(0, qi);
    const hQuery = qi === -1 ? '' : hash.slice(qi + 1);
    const m = /^tool\/([a-z0-9-]+)$/.exec(hPath);
    const hId = m?.[1];
    if (hId !== undefined && ID_RE.test(hId)) return { toolId: hId, format: null, query: hQuery };
  }

  // 3) Pretty path shortcut (…/<id> or …/tool/<id>, no extension) — the path the
  //    router rewrites into the hash route on load.
  const segs = u.pathname.split('/').filter(Boolean);
  const cand = segs.length === 2 && segs[0] === 'tool' ? segs[1]
    : segs.length === 1 ? segs[0]
      : null;
  if (cand && ID_RE.test(cand) && !APP_ROUTES.has(cand)) {
    return { toolId: cand, format: null, query: u.search.replace(/^\?/, '') };
  }

  return null;
}

/** True if `src` is any recognised Lolly tool URL (embed / hash-route / path). */
export function isToolUrl(src: unknown): boolean {
  return parseToolUrl(src) !== null;
}

/**
 * Canonicalise into the strict embed form
 * `https://lolly.tools/tool/<id>.<ext>?<query>` — the persistent identity for a
 * tool-sourced asset. `query` is the child's input params (already URL-encoded);
 * reserved size params (w/h/unit/dpi) should already be folded in by the caller.
 * Returns null for a bad tool id, so a malformed spec can't mint a junk identity.
 */
export function buildEmbedUrl({ toolId, format, query = '' }: EmbedUrlSpec = {}): string | null {
  if (typeof toolId !== 'string' || !ID_RE.test(toolId)) return null;
  const ext = FORMAT_EXT[String(format || '').toLowerCase()] || 'svg';
  const q = String(query || '').replace(/^\?/, '');
  const url = q
    ? `https://lolly.tools/tool/${toolId}.${ext}?${q}`
    : `https://lolly.tools/tool/${toolId}.${ext}`;
  // Refuse to mint an identity longer than parseEmbedUrl will accept — an id that
  // can't re-parse on load is worse than no asset (renderUrl then returns null and
  // the picker reports it couldn't render, rather than persisting a dead slot).
  return url.length > MAX_URL ? null : url;
}
