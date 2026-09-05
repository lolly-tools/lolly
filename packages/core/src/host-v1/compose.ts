// SPDX-License-Identifier: MPL-2.0

import type { AssetRef } from './asset-ref.ts';

import type { ExportFormat } from './export.ts';

// ─── Compose ──────────────────────────────────────────────────────────────────

export interface ComposeAPI {
  /**
   * Render the named tool with the given inputs to a self-contained AssetRef
   * (`source: 'remote'`, `url` a `blob:`/`data:` URL). The child render goes
   * through the same loadTool → createRuntime → host.export.render path, so it is
   * pixel-identical to rendering that tool directly - but watermark/provenance are
   * suppressed because the result is an intermediate asset, not the deliverable.
   *
   * The host enforces recursion guards: it rejects if `_stack` already contains
   * `toolId` (a cycle, A→B→A) or exceeds the max compose depth, so a self- or
   * mutually-embedding tool fails fast instead of looping. The runtime threads and
   * extends `_stack` automatically; callers outside the runtime may omit it.
   */
  render(spec: ComposeSpec): Promise<AssetRef>;

  /**
   * Render a tool *URL* (a link a user pasted) to an embeddable AssetRef - the
   * end-user counterpart to render(). The host parses the URL (manifest-aware, so
   * typed inputs coerce exactly as URL mode would), renders the named tool, and
   * returns an AssetRef whose `id` is the CANONICAL embed URL
   * (`https://lolly.tools/tool/<id>.<ext>?…`, see tool-url.js buildEmbedUrl).
   *
   * That canonical id is the asset's persistent identity: it round-trips through
   * URL mode + saved sessions, and the runtime feeds it back here to re-render the
   * asset on load - so a tool-sourced image survives reload and travels inside a
   * shared link, exactly as a library asset id does. `opts` overrides (format /
   * size) take precedence over anything parsed from the URL and are folded into
   * the returned id. Returns null when the URL isn't a recognised tool URL or the
   * tool can't be rendered (the caller then leaves the slot empty).
   *
   * Accepts every shape the app hands a user (embed URL, hash share route, pretty
   * path); the toolId must resolve to a real local tool, so a pasted link can only
   * render a tool that already ships in this build. Optional/additive (v1.3) -
   * older shells lack it, so callers feature-detect `host.compose?.renderUrl`.
   */
  renderUrl?(url: string, opts?: ComposeUrlOpts): Promise<AssetRef | null>;
}

export interface ComposeUrlOpts {
  /** Override the child render format (else the URL's, else the child default). */
  format?: ExportFormat;
  /** Override render width (a number in `unit`). Default: the URL's, else native. */
  width?: number;
  /** Override render height (a number in `unit`). Default: the URL's, else native. */
  height?: number;
  /** Unit for width/height: 'px' (default), 'mm', 'cm', 'in', 'pt'. */
  unit?: string;
  /** Raster DPI for physical units (mirrors ExportOpts.dpi). */
  dpi?: number;
  /** Engine-managed recursion stack - threaded by the runtime on re-resolve. */
  _stack?: readonly string[];
}

export interface ComposeSpec {
  /** id of the tool to render. */
  toolId: string;
  /** Inputs for the child tool (already hydrated to concrete values by the runtime). */
  inputs: Record<string, unknown>;
  /** Child render format. Defaults to the child tool's first declared format (its
   *  manifest `render.formats[0]`); a `jpg`/`jpeg` request matches either spelling. */
  format?: ExportFormat;
  /** Render width, a number in `unit`. Default: the child's native width. */
  width?: number;
  /** Render height, a number in `unit`. Default: the child's native height. */
  height?: number;
  /** Unit for width/height: 'px' (default), 'mm', 'cm', 'in', 'pt'. */
  unit?: string;
  /** Raster DPI for physical units (mirrors ExportOpts.dpi). */
  dpi?: number;
  /** Engine-managed recursion stack of tool ids already on the compose path. */
  _stack?: readonly string[];
  /**
   * One-shot render: skip the host's render cache entirely - no lookup, no
   * insertion. For a bulk bake (a design import turning 30+ scenes into stored
   * assets) each result is used once and never re-requested, so caching them
   * only evicts the live preview entries and pins their blobs. The CALLER then
   * owns the returned `url` and must release it once the bytes are copied (on
   * web that means URL.revokeObjectURL) - with the cache holding no reference,
   * nothing else will. Optional/additive (v1.5); absent → cached as before.
   */
  transient?: boolean;
  /**
   * Post-mount settle before the child is captured, in ms. The host's default
   * waits long enough for images/lottie/video inside the child to decode; a
   * caller that KNOWS the child has no such media may pass a much smaller value.
   * Advisory - a host may clamp or ignore it. Optional/additive (v1.5).
   */
  settleMs?: number;
}
