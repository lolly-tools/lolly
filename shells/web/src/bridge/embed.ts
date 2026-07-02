// SPDX-License-Identifier: MPL-2.0
/**
 * Web interceptor for the portable embed URL surface (Phase 2 of tool composition).
 *
 * An author writes a literal `<img src="https://lolly.tools/tool/<id>.<ext>?...">`.
 * Nothing is fetched from lolly.tools: `neutralizeEmbeds` swaps the magic src for
 * a transparent placeholder BEFORE the HTML is inserted (so the editor never
 * fires a failing network request), and `hydrateEmbeds` then renders the named
 * tool LOCALLY via host.compose and swaps in the resulting blob URL. Because the
 * resolved value is a blob: URL in the live DOM, every existing export seam
 * (blob→data, SVG-inline-as-vector) handles it unchanged — exactly like the
 * declarative {{asset}} path — so the export pipeline needs no embed-specific code.
 *
 * Security: parseEmbedUrl is the strict gate (engine/src/embed.js). A tool is
 * only rendered if its id resolves to a real local tool (getTool fetches from our
 * own /tools/<id>/ and 404s otherwise). An unrecognised or unrenderable URL
 * resolves to null and the neutral placeholder stays — no arbitrary URL is ever
 * fetched as a "tool", and the editor never reaches out to the network.
 */

import { parseEmbedUrl, parseUrlState } from '@lolly/engine';
import type { RuntimeHost } from '@lolly/engine';
import type { ExportFormat } from '../../../../engine/src/bridge/host-v1.ts';
import { getTool } from './tool-loader.ts';

// 1×1 transparent GIF — the placeholder a neutralised embed shows until (and if)
// it resolves. Inert and self-contained, so no request is ever made.
export const TRANSPARENT_PX =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const XLINK_NS = 'http://www.w3.org/1999/xlink';

/** The original embed URL if neutralised, else the live src/href. */
export function embedSrcOf(el: Element): string {
  return el.getAttribute('data-lolly-embed') || el.getAttribute('src') || el.getAttribute('href') || '';
}

/**
 * Rewrite magic embed `<img>`/`<image>` in a hydrated HTML string to a neutral
 * placeholder + a `data-lolly-embed` marker, returning the new string. Parsing
 * into an inert <template> does NOT load images, so this fires no network
 * request. Cheap-exits when the string can't contain an embed.
 */
export function neutralizeEmbeds(html: string): string {
  // Case-insensitive, host-only cheap-exit (so `LOLLY.TOOLS`, a port, or a trailing
  // dot can't slip past the matcher's gate). parseEmbedUrl remains the real gate.
  if (typeof html !== 'string' || !/lolly\.tools/i.test(html)) return html;
  const tpl = document.createElement('template');
  tpl.innerHTML = html;
  let found = false;
  tpl.content.querySelectorAll('img, image').forEach((el) => {
    // SVG2 `href` / HTML `src`, plus the legacy namespaced `xlink:href` synonym.
    for (const attr of ['src', 'href']) {
      const v = el.getAttribute(attr);
      if (v && parseEmbedUrl(v)) {
        el.setAttribute('data-lolly-embed', v);
        el.setAttribute(attr, TRANSPARENT_PX);
        found = true;
        return;
      }
    }
    const xv = el.getAttributeNS?.(XLINK_NS, 'href');
    if (xv && parseEmbedUrl(xv)) {
      el.setAttribute('data-lolly-embed', xv);
      el.setAttributeNS(XLINK_NS, 'href', TRANSPARENT_PX);
      found = true;
    }
  });
  return found ? tpl.innerHTML : html;
}

/** Recursion-guard bookkeeping threaded through nested compose renders. */
export interface EmbedStackOpts {
  stack?: readonly string[];
}

/** Shared options for resolving/hydrating embeds against a host. */
export interface EmbedHostOpts {
  host?: RuntimeHost | null;
  embed?: EmbedStackOpts;
}

/**
 * Resolve one embed URL to a local blob URL via host.compose, or null when it
 * isn't a valid embed / the tool can't be rendered (caller keeps the placeholder).
 */
export async function resolveLollyToolUrl(src: string, { host, embed }: EmbedHostOpts = {}): Promise<string | null> {
  const parsed = parseEmbedUrl(src);
  if (!parsed || !host?.compose) return null;

  let tool;
  try { tool = await getTool(parsed.toolId); } // unknown id → 404 → throw → null
  catch { return null; }

  const st = parseUrlState(parsed.query, tool.manifest); // query → safe input model
  try {
    const ref = await host.compose.render({
      toolId: parsed.toolId,
      inputs: st.values,
      // parsed.format is the embed URL's path-extension format (EmbedFormat: png/
      // jpg/jpeg/webp/svg/pdf). host-v1's ComposeSpec.format uses the narrower,
      // tool-facing ExportFormat enum (see export/types.ts's comment: host-v1
      // enumerates only the "headline" formats, this module's internal set is a
      // superset) — but the value flows unmodified into pro/render-export.ts's
      // renderRowToBlob, whose `format` param is a plain string, so no runtime
      // behavior depends on the declared union. Narrowing the static type here
      // changes nothing at runtime.
      format: parsed.format as ExportFormat,
      width: st.width ?? undefined,
      height: st.height ?? undefined,
      unit: st.unit ?? undefined,       // honour ?width=210&unit=mm
      dpi: st.dpi ?? undefined,
      _stack: embed?.stack ?? [],
    });
    return ref?.url ?? null;
  } catch (e) {
    host.log?.('warn', `embed "${parsed.toolId}": ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/**
 * Resolve every neutralised embed within `node`, swapping the placeholder for the
 * composed blob URL. Fire-and-forget from the render path; `isCurrent()` (if
 * given) guards against a stale render overwriting a newer one.
 */
export async function hydrateEmbeds(
  node: ParentNode,
  { host, isCurrent, embed }: EmbedHostOpts & { isCurrent?: () => boolean } = {},
): Promise<void> {
  const els = [...node.querySelectorAll('[data-lolly-embed]')];
  if (!els.length) return;
  await Promise.all(els.map(async (el) => {
    // Bail BEFORE the (expensive) compose render if the preview already moved on —
    // a mid-render input change makes this hydration stale, so don't waste the work.
    // The post-await gate below still guards a change that lands during the render.
    if (isCurrent && !isCurrent()) return;
    // Thread the caller's recursion stack so an embed inside a composed child is
    // still cycle/depth-guarded (defaults to a fresh top-level stack in preview).
    const url = await resolveLollyToolUrl(el.getAttribute('data-lolly-embed') ?? '', { host, embed: embed ?? { stack: [] } });
    if (url && (!isCurrent || isCurrent())) {
      if (el.tagName.toLowerCase() === 'image') {
        el.setAttribute('href', url);
        el.setAttributeNS?.(XLINK_NS, 'href', url); // cover legacy SVG renderers
      } else {
        el.setAttribute('src', url);
      }
    }
  }));
}
