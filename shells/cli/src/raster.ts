// SPDX-License-Identifier: MPL-2.0
/**
 * The CLI's raster/PDF/video tier - two levels, smallest-footprint first:
 *
 *   Tier A (no browser):  PNG from an SVG-native tool, rasterised with resvg (pure
 *                         Rust - a few-MB native module, not a browser). Instant,
 *                         always available, zero setup. Covers most of the catalog.
 *   Tier B (headless):    everything else (HTML-layout raster, jpg/webp, pdf, video)
 * - drive the built web shell in a scoped Chromium so the
 *                         bytes match a web/desktop Download exactly (webshell-render).
 *
 * run.ts calls this only for non-engine-native formats; svg/emf/eps + data still go
 * through the DOM-free bridge. The tier internals (pxDims, resvg rasterisation, the
 * web-shell driver) live in @lolly-tools/node-shell, shared with the TUI.
 */
import type { JSDOM } from 'jsdom';
import { serializeUrlState, serializeHdr, HDR_DEFAULTS, isToolUrl } from '@lolly/engine';
import { eligibleForResvgPng, rasterizeTierAPng, rasterizeSvgToRgba, pxDims } from '@lolly-tools/node-shell/raster';
import type { DeepHdrRequest } from '@lolly-tools/node-shell/raster';
import type { RenderDims } from '@lolly-tools/node-shell/webshell-render';
import type { SlideMasterFileV1, SlideMasterV1 } from '@lolly-tools/core';
import { pickFramePage } from './frame-page.ts';
import { note, warn } from './output.ts';

interface Runtime {
  /** The theme choice per token group this runtime renders in (url-mode `_themes`). */
  readonly tokenSelection?: Record<string, string>;
  getHydrated(): string;
  getModel(): unknown;
  /** Draw every emoji in a freshly hydrated tree from the chosen set. */
  applyEmojiToDom(node: unknown): Promise<unknown>;
  export(node: unknown, format: string, opts?: object): Promise<Blob>;
}
interface Manifest { id: string; render?: { width?: number; height?: number } }

export interface RasterResult {
  bytes: Uint8Array;
  usedBrowser: boolean;
  /** Whether the Lolly Imprint was genuinely embedded on the Node tier. Undefined on
   *  the browser tier, which owns (and reports) its own marks. Never guessed: a frame
   *  below the watermark's detection floor writes an unmarked PNG and says false. */
  imprinted?: boolean;
  /** True when THIS process encoded the delivered bytes even though the browser may
   *  have supplied the source pixels (the HDR stills). `usedBrowser` then means only
   *  "tear the browser down"; the Content Credential is still stamped in Node, because
   *  the file the browser produced is not the file being written. */
  nodeEncoded?: boolean;
}

/** The `hdr=` / `depth=` half of a render request. `RenderDims` deliberately does not
 *  carry these: the browser tier is never asked for an HDR still, because the encode
 *  happens here (see renderHdrStill). run.ts passes them through the same `dims`. */
export interface HdrStillRequest {
  hdr?: DeepHdrRequest | null;
  depth?: 8 | 16 | 'float' | 'auto';
}

/** png plus both spellings of JPEG - the two still formats that can carry HDR. */
const HDR_STILL_FORMATS = new Set(['png', 'jpg', 'jpeg']);

/**
 * Should this render take the Node HDR still path?
 *
 * Two exclusions, each with a reason:
 *   - `durable`: the neural TrustMark encoder is a browser feature, so an HDR file
 *     written here could not carry the credential that was asked for. run.ts refuses
 *     the combination before we get here; this is the backstop.
 *   - `depth=8` on a JPEG: unlike the PNG case there IS a coherent 8-bit answer (the
 *     legacy PQ JPEG), and a caller asking for one may have a reason. Web parity - the
 *     web shell's renderRaster gates the gain-map path on exactly this. It falls
 *     through to Tier B, which owns that path.
 */
export function wantsNativeHdrStill(
  fmt: string, dims: HdrStillRequest & { durable?: boolean },
): boolean {
  const f = fmt.toLowerCase();
  if (!dims.hdr || !HDR_STILL_FORMATS.has(f)) return false;
  if (dims.durable) return false;
  if (f !== 'png' && dims.depth === 8) return false;
  return true;
}

/**
 * Render a raster/PDF/video format. Returns the bytes plus whether Tier B (the browser)
 * ran, so the caller can tear the browser + server down on a single-shot CLI invocation.
 */
export async function renderRaster(opts: {
  runtime: Runtime; dom: JSDOM; manifest: Manifest; format: string; dims: RenderDims & HdrStillRequest;
  /** The reserved emoji params this run was given, forwarded into the Tier-B URL
   *  so the browser tier draws the same set from the same pins. */
  emoji?: { emoji?: string | null; emojiFx?: string | null; emojiStyle?: string | null };
  /** The values the runtime was created from. Tier B restores from them any Lolly
   *  tool link this process could not compose itself (see restoreToolLinks). */
  initial?: Record<string, unknown>;
  /** A Design document's design system when it is not the content profile's (`--file`, a
   *  terminal system): the browser tier's page resolves token links in it (plan 291 M4). */
  designSystem?: Record<string, unknown>;
}): Promise<RasterResult> {
  const { runtime, dom, manifest } = opts;
  const floatEditing = (runtime.getModel() as ModelItem[]).some(item => item.id === 'editingRange' && item.value === 'hdr') || manifest.id === 'design' && !!opts.dims.hdr;
  const dims = floatEditing && opts.dims.hdr ? { ...opts.dims, hdrParam: opts.dims.hdrParam || serializeHdr({ ...HDR_DEFAULTS, ...opts.dims.hdr }) } : opts.dims;
  const fmt = opts.format.toLowerCase();
  const sampled = (dims.cuts ?? 1) > 1 || dims.sampleTimes !== undefined || !!dims.motionBlur || !!dims.sequenceRange;

  // HDR stills (`--hdr=1` with png/jpg) are encoded HERE, on either tier's pixels.
  // Before this, `hdr=` reached neither: Tier A never saw it and the Tier-B URL
  // builder never forwarded it, so the flag produced a byte-identical SDR file and
  // exit 0. The encode is DOM-free engine code (16-bit PQ PNG, ISO 21496-1 gain-map
  // JPEG), so Node does it directly - which also makes the bytes device-independent,
  // the same whether resvg or Chromium supplied the source frame.
  if (!sampled && !floatEditing && wantsNativeHdrStill(fmt, dims)) {
    return await renderHdrStill({ ...opts, format: fmt, dims });
  }

  // Tier A - PNG from an SVG-native tool: resvg rasterises the engine's own SVG. No
  // browser, no built web shell. jpg/webp/pdf/video fall through to Tier B (resvg is
  // PNG-only, and layout formats need a real engine). A durable-credential (neural
  // TrustMark) request still falls through - that encoder is a browser feature.
  //
  // The pixel-watermark (imprint) used to fall through too, and that stopped being
  // acceptable the moment the Imprint became default-on for CLI renders (contract section 12
  // O2): every `--export=png` would have demanded the scoped Chromium for a mark the
  // caller never asked for. It is embedded HERE instead, browser-free, through the
  // engine's own DOM-free watermark maths (rasterizeSvgToImprintedPng). A frame below
  // the detection floor comes back null and writes the ordinary PNG - the browser
  // could not have marked it either.
  //
  // Print prep falls through too, as a BACKSTOP. resvg is handed the tool's own SVG and
  // knows nothing about a bleed box or crop marks, so Tier A used to accept --bleed /
  // --marks and produce bytes identical to a run without them: no marks, no warning,
  // exit 0. run.ts now refuses those flags outright for any format that cannot carry
  // page geometry (PRINT_PREP_FORMATS), so this should be unreachable - it stays so the
  // silent no-op cannot come back if that allowlist ever widens.
  if (!sampled && !floatEditing && eligibleForResvgPng(fmt, dims)) {
    const svg = await tryRenderSvg(runtime, dom, dims.slide);
    if (svg) {
      // Shared Tier-A rasteriser (node-shell): imprint + physical-unit DPI, identical to the
      // TUI. `imprinted` reflects whether the mark was actually embedded - the imprinted path
      // returns the plain PNG (no mark) below the watermark detection floor.
      const { bytes, imprinted } = await rasterizeTierAPng(svg, dims, manifest);
      return { bytes, usedBrowser: false, imprinted };
    }
  }

  // Tier B - drive the built web shell in the scoped Chromium; capture the exact bytes
  // its own export path downloads (one render path, no drift vs web/desktop).
  // The emoji set and its treatment travel in the URL, exactly as they do in a share
  // link: Tier B is the web shell rendering the same address, so it has to be told
  // which set to draw from or it would fall back to the browser's own emoji font.
  const model = opts.initial ? restoreToolLinks(runtime.getModel() as ModelItem[], opts.initial) : runtime.getModel();
  // A Design document goes to the web shell as a session (plan 291 W9): its pictures
  // travel as files, so neither the address cap nor a dropped upload limits a deck.
  if (manifest.id === 'design' && process.env.LOLLY_VIDEO_CAPTURE !== 'screenshot') {
    return { bytes: await renderDesignSession(runtime, model as ModelItem[], fmt, dims, opts), usedBrowser: true };
  }
  // inlineBakedAssets: this query is handed to a browser on this machine, not shared, so
  // a local file given to an asset input travels as its bytes instead of being dropped.
  const query = serializeUrlState(model as never, { emoji: opts.emoji?.emoji, emojiFx: opts.emoji?.emojiFx, emojiStyle: opts.emoji?.emojiStyle, inlineBakedAssets: true, ...(runtime.tokenSelection ? { tokenSelection: runtime.tokenSelection } : {}) });
  const MOTION = ['gif', 'apng', 'webm', 'mp4'];
  // PROTOTYPE opt-in: real Playwright screenshots instead of dom-to-image for the
  // frame-by-frame capture (see renderVideoViaScreenshot's doc comment). Motion
  // formats only, and only when explicitly requested - every other case, and the
  // default with this unset, still goes through renderViaWebShell unchanged.
  if (MOTION.includes(fmt) && process.env.LOLLY_VIDEO_CAPTURE === 'screenshot') {
    const { renderVideoViaScreenshot } = await import('@lolly-tools/node-shell/webshell-render');
    const { bytes } = await renderVideoViaScreenshot(manifest.id, query, fmt, dims);
    return { bytes, usedBrowser: true };
  }
  const { renderViaWebShell } = await import('@lolly-tools/node-shell/webshell-render');
  const { bytes } = await renderViaWebShell(manifest.id, query, fmt, dims);
  return { bytes, usedBrowser: true };
}

/** The emoji params of a render, spelled as the URL spells them, with the empty ones left out. */
function emojiQueryParams(emoji: { emoji?: string | null; emojiFx?: string | null; emojiStyle?: string | null } | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (emoji?.emoji) out.emoji = emoji.emoji;
  if (emoji?.emojiFx) out.emojifx = emoji.emojiFx;
  if (emoji?.emojiStyle) out.emojistyle = emoji.emojiStyle;
  return out;
}

/**
 * Tier B for Design through the session transport: the model's values are packaged as
 * a `.lolly` and opened in the web shell, and the export address carries only the slot,
 * the theme choice and the export settings (renderDesignViaSession).
 *
 * The desktop renderer keeps the address transport (plan 291 E27), so unless
 * LOLLY_RENDERER pins Chromium the document also travels as the URL-mode query every
 * other tool sends: a running or installed desktop app renders it when the address
 * fits its request, and Chromium takes the session otherwise.
 */
async function renderDesignSession(
  runtime: Runtime, model: readonly ModelItem[], fmt: string, dims: RenderDims,
  opts: { emoji?: { emoji?: string | null; emojiFx?: string | null; emojiStyle?: string | null }; initial?: Record<string, unknown>; designSystem?: Record<string, unknown> },
): Promise<Uint8Array> {
  const { renderDesignViaSession } = await import('@lolly-tools/node-shell/webshell-render');
  const { rendererPreference } = await import('@lolly-tools/node-shell/desktop-renderer');
  const values = Object.fromEntries(model.map((item) => [item.id, item.value]));
  const urlQuery = rendererPreference() === 'chromium'
    ? undefined
    : serializeUrlState(model as never, { emoji: opts.emoji?.emoji, emojiFx: opts.emoji?.emojiFx, emojiStyle: opts.emoji?.emojiStyle, inlineBakedAssets: true, ...(runtime.tokenSelection ? { tokenSelection: runtime.tokenSelection } : {}) });
  const result = await renderDesignViaSession(values, fmt, dims, {
    ...(runtime.tokenSelection ? { tokenSelection: runtime.tokenSelection } : {}),
    emoji: emojiQueryParams(opts.emoji),
    ...(opts.initial ? { fill: opts.initial } : {}),
    ...(urlQuery !== undefined ? { urlQuery } : {}),
    ...(opts.designSystem ? { designSystem: opts.designSystem } : {}),
  });
  for (const line of result.notes ?? []) note(`Note: ${line}`);
  return result.bytes;
}

interface ModelItem { id: string; type: string; value: unknown; fields?: Array<{ id: string; type?: string }> }

const toolLinkOf = (v: unknown): boolean => {
  const id = typeof v === 'string' ? v : v && typeof v === 'object' ? (v as { id?: unknown }).id : null;
  return typeof id === 'string' && isToolUrl(id);
};

/**
 * Put back the Lolly tool links this process dropped. A slot that embeds another tool
 * (a chart on a slide) resolves through this shell's own compose, which cannot draw an
 * HTML-layout tool in jsdom; the runtime then records the slot as empty. The browser
 * tier composes those links itself, so its URL has to carry them as the caller gave
 * them, or every such slot renders blank. Only an EMPTY slot whose input value was a
 * tool link is restored; blocks are matched by position and only when the count is
 * unchanged.
 */
export function restoreToolLinks(model: readonly ModelItem[], initial: Record<string, unknown>): ModelItem[] {
  return model.map((input) => {
    const given = initial[input.id];
    if (input.type === 'asset') return input.value == null && toolLinkOf(given) ? { ...input, value: given } : input;
    if (input.type !== 'blocks' || !Array.isArray(input.value) || !Array.isArray(given) || given.length !== input.value.length) return input;
    const fields = (input.fields ?? []).filter(f => f.type === 'asset').map(f => f.id);
    let changed = false;
    const value = input.value.map((item, i) => {
      const source = given[i];
      if (!item || typeof item !== 'object' || !source || typeof source !== 'object') return item;
      let next = item as Record<string, unknown>;
      for (const fid of fields) {
        const link = (source as Record<string, unknown>)[fid];
        if (next[fid] == null && toolLinkOf(link)) { next = { ...next, [fid]: link }; changed = true; }
      }
      return next;
    });
    return changed ? { ...input, value } : input;
  });
}

/**
 * Render the runtime's current state to an SVG string, or null when this tool can't
 * produce SVG in a pure-Node shell (HTML-layout tools have no <svg> and need a browser).
 *
 * `slide` is url-mode's `s` (plan 112): this tier re-hydrates the canvas itself, so the
 * one-slide filter run.ts applied to the DOM-free path has to be applied again here, or a
 * `--s=2 --export=png` of an SVG-native paged tool would quietly rasterise every slide.
 * An address that names nothing throws out of pickFramePage, as it does on the other path.
 */
async function tryRenderSvg(runtime: Runtime, dom: JSDOM, slide?: string | null): Promise<string | null> {
  const canvas = dom.window.document.getElementById('canvas');
  if (!canvas) return null;
  try {
    canvas.innerHTML = runtime.getHydrated();
    // This tier re-hydrates a canvas of its own, so it runs the emoji pass of its
    // own too - before the slide filter picks one page out of the document.
    await runtime.applyEmojiToDom(canvas);
  } catch {
    return null;                      // as before: no SVG here, escalate to the browser tier
  }
  // OUTSIDE the try: a bad `--s=` is a usage error the caller must see, not a reason to
  // fall through to the browser tier and render the whole document there.
  const picked = pickFramePage(canvas, slide);
  try {
    const blob = await runtime.export(picked?.node ?? canvas, 'svg', {});
    return await blob.text();
  } catch {
    return null;
  }
}

/**
 * `--hdr=1 --export=png|jpg`: the two HDR still writers, over whichever tier can
 * supply the source pixels.
 *
 *   png  16-bit Rec.2100-PQ, cICP 9/16/0/1, pHYs, iCCP. PQ is a 10/12-bit transfer,
 *        so 8-bit PQ bands in the shadows and `--depth=8` is answered rather than
 *        obeyed (`--depth=16`/`float`/`auto` all take this path).
 *   jpg  ISO 21496-1 / Ultra HDR gain map: an ordinary SDR JPEG with a second image
 *        appended saying how much brighter each pixel gets. Every decoder that has
 *        never heard of gain maps reads the SDR base, byte for byte.
 *
 * SOURCE PIXELS, in the tier order the rest of this file uses: resvg over the tool's
 * own SVG when there is one (no browser), else the Tier-B web shell's PLAIN SDR PNG,
 * decoded here. The browser is asked for neither the mark nor the credential in that
 * case: both belong on the delivered file, which this process writes. That is what
 * `nodeEncoded` tells run.ts.
 *
 * The Imprint follows the CLI's own rule, not the web's: below the watermark's
 * detection floor the mark is skipped and reported (`imprinted: false`), the same as
 * `rasterizeTierAPng`, rather than embedding something no detector can read.
 */
async function renderHdrStill(opts: {
  runtime: Runtime; dom: JSDOM; manifest: Manifest; format: string; dims: RenderDims & HdrStillRequest;
  emoji?: { emoji?: string | null; emojiFx?: string | null; emojiStyle?: string | null };
  initial?: Record<string, unknown>;
  designSystem?: Record<string, unknown>;
}): Promise<RasterResult> {
  const { runtime, dom, manifest } = opts;
  const dims = opts.dims;
  const isPng = opts.format === 'png';
  const [{ encodeHdrPng, encodeGainMapJpeg, hdrBoostOptions, decodeRgba }, engine] = await Promise.all([
    import('@lolly-tools/node-shell/hdr'),
    import('@lolly/engine'),
  ]);
  const { canCarryWatermark, LOSSLESS_STRENGTH, pqBt2020IccProfile, iccProfileBytes } = engine;

  let frame: { data: Uint8Array; width: number; height: number };
  let usedBrowser = false;
  const svg = await tryRenderSvg(runtime, dom, dims.slide);
  if (svg) {
    const { width, height } = pxDims(dims, manifest);
    frame = await rasterizeSvgToRgba(svg, width, height);
  } else {
    const sourceDims: RenderDims = { ...dims, hdrParam: undefined, depth: undefined, imprint: false, c2pa: false };
    let bytes: Uint8Array;
    if (manifest.id === 'design') {
      // The same session transport as the plain Tier B above (plan 291 W9).
      bytes = await renderDesignSession(runtime, runtime.getModel() as ModelItem[], 'png', sourceDims, opts);
    } else {
      const query = serializeUrlState(runtime.getModel() as never, { emoji:opts.emoji?.emoji, emojiFx:opts.emoji?.emojiFx, emojiStyle:opts.emoji?.emojiStyle, inlineBakedAssets: true, ...(runtime.tokenSelection ? { tokenSelection: runtime.tokenSelection } : {}) });
      const { renderViaWebShell } = await import('@lolly-tools/node-shell/webshell-render');
      ({ bytes } = await renderViaWebShell(manifest.id, query, 'png', sourceDims));
    }
    const decoded = await decodeRgba(bytes);
    frame = { data: decoded.data as Uint8Array, width: decoded.width, height: decoded.height };
    usedBrowser = true;
  }

  // Physical units only: px carries no DPI, matching the plain raster paths.
  const dpi = dims.unit && dims.unit !== 'px' && dims.dpi && dims.dpi > 0 ? dims.dpi : undefined;
  const imprint = dims.imprint !== false && canCarryWatermark(frame.width, frame.height);
  const hdr = hdrBoostOptions(dims.hdr ?? {});
  // The encoders answer a `depth=` they cannot obey (8-bit PQ bands, and JPEG has no
  // float sample format) by explaining rather than obeying. Route that to the terminal:
  // an unheard explanation is the same as no explanation.
  const log = (level: 'info' | 'warn', message: string): void => {
    if (level === 'warn') warn('HDR_NOTE', message, 'gate'); else note(`Note: ${message}`);
  };

  if (isPng) {
    const bytes = await encodeHdrPng(frame, {
      hdr,
      ...(dpi ? { dpi } : {}),
      // The HDR signal itself: a Rec.2100-PQ profile beside the cICP chunk, as the
      // web path writes. The CLI attaches no export metadata, so there is no iTXt.
      icc: pqBt2020IccProfile(),
      imprint,
      imprintStrength: LOSSLESS_STRENGTH, // PNG is lossless, so the gentler mark
      ...(dims.depth !== undefined ? { depth: dims.depth } : {}),
      log,
    });
    return { bytes, usedBrowser, imprinted: imprint, nodeEncoded: true };
  }

  const res = await encodeGainMapJpeg(frame, {
    hdr,
    ...(dpi ? { dpi } : {}),
    // The base is a genuine SDR JPEG, so it carries the render's own space (sRGB),
    // never the Rec.2100-PQ profile the legacy 8-bit HDR JPEG stamped.
    icc: iccProfileBytes('srgb'),
    imprint, // JPEG keeps the quantisation-calibrated default strength
    ...(dims.depth !== undefined ? { depth: dims.depth } : {}),
    log,
  });
  return { bytes: res.bytes, usedBrowser, imprinted: imprint, nodeEncoded: true };
}

// ── Tier A: a native .pptx from a Design document, with no browser ─────────────
//
// `pptx` used to be a browser-only format here: the web shell walked the rendered
// DOM, so the CLI had to drive it in Chromium. A Design document does not need that.
// Its authored rows are already in the render as `<script data-penpot-doc>`, and
// `designFramesToPptx` lowers them to real slides - placeholder-bound text where a
// frame names a slide master, plain text, rectangles and pictures where it does not.
// Anything else (a tool that is not Design, a document with no frames, a master that
// is not on this profile) answers null and the caller keeps to Tier B.

/** The picture types a deck can carry, by file extension. */
function deckMimeOfFile(file: string): string {
  const lower = file.toLowerCase();
  return lower.endsWith('.png') ? 'image/png'
    : lower.endsWith('.jpg') || lower.endsWith('.jpeg') ? 'image/jpeg'
      : lower.endsWith('.svg') ? 'image/svg+xml' : '';
}

/** The bytes and type of a `data:` URL, base64 or percent-encoded, or null when it is not one. */
export function dataUrlBytes(url: string): { bytes: Uint8Array; mime: string } | null {
  const m = /^data:([^,]*?),/i.exec(url);
  if (!m) return null;
  const params = m[1]!.split(';').map((p) => p.trim());
  const mime = (params[0] || 'text/plain').toLowerCase();
  const body = url.slice(m[0].length);
  try {
    const bytes = params.slice(1).some((p) => p.toLowerCase() === 'base64')
      ? new Uint8Array(Buffer.from(decodeURIComponent(body), 'base64'))
      : new TextEncoder().encode(decodeURIComponent(body));
    return bytes.length ? { bytes, mime } : null;
  } catch {
    return null;
  }
}

/** Which format of a catalog entry a deck takes: a vector first, then PNG, then JPEG. */
const DECK_FORMAT_ORDER = ['svg', 'png', 'jpg', 'jpeg'];

/**
 * One image an exported layer names, read off the catalog of this profile.
 *
 * A layer gives its picture as a bare catalog id (`lolly/logo/primary`), a catalog
 * path (`/catalog/...`), or, once the bridge has resolved the id, a `data:` URL. A bare id
 * takes the entry's vector when it has one, so a logo travels as an SVG with a PNG
 * fallback. An id carrying a theme or a treatment is left to `fallback`, the bridge's
 * own resolver, because only the bridge bakes those.
 */
export async function catalogAssetBytes(
  ref: string,
  fallback?: (ref: string) => Promise<{ bytes: Uint8Array; mime: string } | null>,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (/^data:/i.test(ref)) return dataUrlBytes(ref);
  const { contentUrlFile, readAssetIndex } = await import('@lolly-tools/node-shell/content-roots');
  const { readFile } = await import('node:fs/promises');
  let file: string | null = null;
  try {
    if (ref.startsWith('/')) {
      file = contentUrlFile(ref);
    } else if (!ref.includes('?') && !/^[a-z][a-z0-9+.-]*:/i.test(ref)) {
      const index = readAssetIndex() as { assets?: Array<{ id?: string; formats?: Array<{ format?: string; url?: string }> }> };
      const entry = (index.assets ?? []).find((a) => a.id === ref);
      const formats = (entry?.formats ?? [])
        .filter((f) => f.url && DECK_FORMAT_ORDER.includes(String(f.format).toLowerCase()))
        .sort((a, b) => DECK_FORMAT_ORDER.indexOf(String(a.format).toLowerCase()) - DECK_FORMAT_ORDER.indexOf(String(b.format).toLowerCase()));
      for (const f of formats) {
        file = contentUrlFile(f.url!);
        if (file) break;
      }
    }
  } catch { file = null; }
  const mime = file ? deckMimeOfFile(file) : '';
  if (file && mime) return { bytes: new Uint8Array(await readFile(file)), mime };
  return fallback ? fallback(ref) : null;
}

/** The slide master with this id, from whichever catalog entry is tagged `slide-master`. */
async function catalogSlideMaster(id: string): Promise<SlideMasterV1 | null> {
  try {
    const { readAssetIndex, contentUrlFile } = await import('@lolly-tools/node-shell/content-roots');
    const { readFile } = await import('node:fs/promises');
    const index = readAssetIndex() as { assets: Array<Record<string, unknown>> };
    for (const asset of index.assets ?? []) {
      const tags = Array.isArray(asset.tags) ? asset.tags as string[] : [];
      if (!tags.includes('slide-master')) continue;
      const formats = Array.isArray(asset.formats) ? asset.formats as Array<{ url?: string }> : [];
      for (const fmt of formats) {
        const file = fmt.url ? contentUrlFile(fmt.url) : null;
        if (!file) continue;
        const parsed = JSON.parse(await readFile(file, 'utf8')) as SlideMasterFileV1;
        const hit = parsed?.masters?.find((m) => m.id === id);
        if (hit) return hit;
      }
    }
  } catch { /* no master on this profile - Tier B still exports */ }
  return null;
}

export interface DesignPptxRequest {
  /** The hydrated canvas, which carries Design's own `<script data-penpot-doc>`. */
  canvas: Element;
  /** The tool this render came from; only `design` takes this path. */
  toolId: string;
  /** Reads one brand custom property off the canvas, for the token colours. */
  brandVar: (name: string) => string;
  /**
   * Answers one `font.<slot>` token of the active brand, with the authored family names
   * (see `authoredBrandFont`). The canvas carries the brand colours only, so the theme
   * fonts and the mono face come from here; without it the deck keeps the theme's own
   * default faces.
   */
  brandFont?: (slot: 'brand' | 'display' | 'mono') => unknown;
  meta?: { title?: string; description?: string; source?: string; contact?: string; author?: string; sourceAuthor?: string } | null;
  now?: string;
  /**
   * The bridge's own asset lookup (`host.assets.get`), for a picture the catalog cannot
   * answer by itself: an upload in a session, or an id with a theme or a treatment.
   */
  assets?: { get(id: string): Promise<{ url?: string } | null | undefined> };
}

/**
 * The docProps metadata for a deck this shell writes.
 *
 * The browser tier used to write these because `runtime.export()` assembled them; Tier A
 * never calls it, so they are threaded in by the caller instead, and the source author a
 * composed render stamps on the canvas is picked up here.
 */
function pptxDeckMeta(req: DesignPptxRequest): DesignPptxRequest['meta'] {
  const el = req.canvas.querySelector?.('[data-source-author]');
  const sourceAuthor = el?.getAttribute?.('data-source-author')?.trim() || undefined;
  if (!req.meta && !sourceAuthor) return null;
  return { ...(req.meta ?? {}), ...(sourceAuthor ? { sourceAuthor } : {}) };
}

/**
 * The `font.<slot>` resolver a native deck reads, over the bridge's `host.tokens`.
 *
 * Under a design version that pins font faces, `host.tokens.resolve` answers from the
 * render projection, where a pinned family is the internal 'Lolly Release <sha256>' alias
 * that only this renderer can load. A .pptx is portable output, so it takes the authored
 * families instead: `snapshot()` restores them (`restorePinnedFontFamilies`) and records
 * the active theme selection, which `createTokenSet` honours. A host with no snapshot, or
 * one that fails, falls back to `resolve`.
 */
export async function authoredBrandFont(
  tokens: { resolve(ref: string): unknown; snapshot?(): Promise<{ document: unknown }> } | undefined,
): Promise<DesignPptxRequest['brandFont']> {
  if (!tokens) return undefined;
  let document: unknown;
  try { document = (await tokens.snapshot?.())?.document; } catch { document = undefined; }
  if (document && typeof document === 'object') {
    const { createTokenSet } = await import('@lolly/engine');
    const set = createTokenSet(document);
    return (slot) => set.resolve(`{font.${slot}}`);
  }
  return (slot) => tokens.resolve(`{font.${slot}}`);
}

/** The .pptx bytes, or null when this document is not one this tier can write. */
export async function renderDesignPptx(req: DesignPptxRequest): Promise<Uint8Array | null> {
  if (req.toolId !== 'design') return null;
  const { designFramesToPptx, framesOfDesignDoc, hasMasterBindings, parseDesignDoc, transitionsOfDeckModel, MAX_SLIDES } =
    await import('@lolly-tools/node-shell/design-pptx');
  const { slideMasterForExport, tokenColorsFromStyle } = await import('@lolly-tools/node-shell/design-pptx');
  const { STATIC_FACE_DIR, withBrandFonts } = await import('@lolly-tools/node-shell/pptx-deck');
  const { contentUrlFileExact } = await import('@lolly-tools/node-shell/content-roots');
  const script = req.canvas.querySelector?.('[data-penpot-doc]');
  const doc = parseDesignDoc(script?.textContent);
  if (!doc) return null;
  // THE SAME GATE THE WEB SHELL APPLIES (export-pptx.ts renderPptx). A document with no
  // slide-master binding keeps to the deck model on both shells, which is the lowering
  // that carries per-element animation and the document-level transition. Taking Tier A
  // for those here would make `lolly design --export=pptx` and the web shell's own
  // download write different decks from one document.
  if (!hasMasterBindings(doc)) return null;
  const frames = framesOfDesignDoc(doc).slice(0, MAX_SLIDES);
  if (!frames.length) return null;

  const deckTransitions = transitionsOfDeckModel(req.canvas.querySelector?.('[data-pptx-deck]')?.textContent);
  const masterId = frames.map((f) => (typeof f.row.master === 'string' ? f.row.master : '')).find(Boolean);
  // The active catalog's master, or the engine's neutral one when the frames name it and
  // this profile ships another (plan 291 M3): a composed neutral deck stays Tier A.
  const bound = masterId ? slideMasterForExport(masterId, await catalogSlideMaster(masterId)) : null;
  if (masterId && !bound) return null;   // a binding we cannot honour is not Tier A
  const master = bound?.master ?? null;
  if (bound?.note) note(`pptx: ${bound.note}.`);

  // The theme fonts, from the brand's token document the way rebrand compile takes them
  // (font.display heads the major font when present). Without them a run whose font is
  // a slot keyword, or absent, has no typeface and opens in the theme's Calibri. A
  // generic-only stack gives none, so that brand keeps the theme it had.
  const brandFont = req.brandFont;
  const brandFonts = brandFont
    ? await (await import('@lolly-tools/node-shell/pptx-deck')).tokenBrandFonts(brandFont)
    : undefined;

  const result = await designFramesToPptx({
    frames,
    ...(master ? { master } : {}),
    ...(brandFonts ? { fonts: brandFonts } : {}),
    tokens: (path: string) => {
      const m = /^color\.semantic\.([a-z0-9-]+)$/i.exec(path);
      return m ? (req.brandVar(`--brand-${m[1]}`) || undefined) : undefined;
    },
    // A Design colour is commonly authored as `var(--brand-primary, #1e293b)`. Without
    // this the literal inside the var() is what gets written, so the deck comes out in
    // the fallback colours rather than the brand's own - wrong, and silently so.
    cssVars: req.brandVar,
    // The design system's colour tokens the canvas carries (`--brand-token-*`), for the
    // theme slots no semantic token fills, so PowerPoint offers brand colours only.
    tokenColors: tokenColorsFromStyle((req.canvas as HTMLElement).style ?? { length: 0, item: () => '', getPropertyValue: () => '' }),
    // The document-level transition is an input, not a row, and the tool has already
    // resolved it per slide in its own deck model. Read it back so a deck that sets
    // the transition once still leaves each slide the way it was authored to.
    ...(deckTransitions ? { slideTransitions: deckTransitions } : {}),
    // A bare catalog id, a catalog path or a resolved data: URL is read here; anything
    // else goes to the bridge, which resolves it the way the render did.
    resolveAsset: (ref: string) => catalogAssetBytes(ref, req.assets ? async (id) => {
      const got = await req.assets!.get(id).catch(() => null);
      return got?.url ? dataUrlBytes(got.url) : null;
    } : undefined),
    // An SVG picture travels as the vector with a PNG fallback beside it, which resvg
    // draws here at the size the picture shows at on the slide.
    rasterizeSvg: async (bytes: Uint8Array, w: number, h: number) => {
      try {
        const { rasterizeSvgToPng } = await import('@lolly-tools/node-shell/raster');
        return await rasterizeSvgToPng(new TextDecoder().decode(bytes), w, h);
      } catch {
        return null;
      }
    },
    // Plan 291 D3, the same as the web shell: a Medium 500 run is written as the brand's
    // static Medium face when the active pack ships that file, and keeps its family when
    // it does not. The canvas's brand faces stand in for a run with no family.
    // Matched letter for letter, so a Mac and a Linux host write the same deck.
    shipsFace: (file: string) => contentUrlFileExact(STATIC_FACE_DIR + file) !== null,
    faceFonts: withBrandFonts(undefined, req.brandVar)?.fonts,
  });
  for (const line of result.notes) note(`pptx: ${line}.`);

  const { buildPptxParts, EMU_PER_PX } = await import('@lolly/engine');
  const parts = buildPptxParts(result.slides, {
    emuW: Math.max(1, Math.round(result.size.w * EMU_PER_PX)),
    emuH: Math.max(1, Math.round(result.size.h * EMU_PER_PX)),
    ...(result.theme ? { theme: result.theme } : {}),
    ...(result.layouts.length ? { layouts: result.layouts } : {}),
    meta: pptxDeckMeta(req),
    now: req.now ?? new Date().toISOString(),
  });
  const { zipSync } = await import('fflate');
  const enc = new TextEncoder();
  const files: Record<string, Uint8Array> = {};
  for (const [path, content] of Object.entries(parts)) {
    files[path] = typeof content === 'string' ? enc.encode(content) : content;
  }
  return zipSync(files);
}
