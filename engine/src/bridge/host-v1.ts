// SPDX-License-Identifier: MPL-2.0
/**
 * Capability Bridge — v1
 *
 * This is the versioned contract between tools and host shells. Tools call into
 * `host.*` methods provided here. Shells (web PWA, Tauri desktop/mobile, CLI)
 * implement this interface in their own way — but the surface is identical.
 *
 * RULES:
 * - Methods may be added in a minor version. Never removed or signature-changed
 *   without a major version bump.
 * - When v2 ships, v1 must continue to work (shells expose both).
 * - Tools declare engineVersion in their manifest; the host refuses to load
 *   tools whose required version exceeds what it implements.
 *
 * DO NOT add platform-specific methods here. If only Tauri can do it, it goes
 * behind a capability flag (declared in tool.json `capabilities`) and the shell
 * exposes a stub/error in environments that can't fulfill it.
 */

export interface HostV1 {
  readonly version: '1';
  readonly shell: 'web' | 'tauri-desktop' | 'tauri-mobile' | 'cli';

  /**
   * The capabilities this shell can actually fulfil — a subset of the tool.json
   * `capabilities` enum. The host uses it to disable tools that declare a
   * capability this shell can't provide (e.g. 'capture' in the web PWA). Absent ⇒
   * gating is skipped, so a shell that doesn't declare it hides nothing.
   */
  readonly capabilities?: readonly Capability[];

  /** User profile data (firstname, headshot, etc). Tools read; user manages via host UI. */
  profile: ProfileAPI;

  /** Global and user asset access. The bridge between tools and the catalog. */
  assets: AssetsAPI;

  /** Persistent state for the current tool/session. IndexedDB on web, FS on Tauri. */
  state: StateAPI;

  /** Clipboard ops. Universal — even CLI has a fallback (writes to stdout/file). */
  clipboard: ClipboardAPI;

  /** Export the rendered template area to a format. The host owns the rasteriser. */
  export: ExportAPI;

  /** Network — only available if the tool declared the 'network' capability. */
  net?: NetAPI;

  /**
   * Design tokens (DTCG). Resolves the catalog's brand token document into a flat,
   * themed lookup. The host UI uses it to source colour-picker swatches from
   * tokens; the runtime uses it to resolve token-referenced input values; a
   * token-aware tool can read the whole tree. Optional and additive (like net/
   * text) — a shell that doesn't provide it just doesn't offer token-driven UI.
   */
  tokens?: TokensAPI;

  /**
   * Text-to-path primitive. Shape and outline a text run into an SVG path.
   * Backed by HarfBuzz WASM — correct shaping including GPOS, ligatures, kerning.
   * Optional: not all shells implement it (CLI has no DOM context).
   */
  text?: TextAPI;

  /**
   * PDF metadata inspection + removal. Reads the Info dictionary and any XMP
   * packet to report what a PDF carries, and produces a re-saved copy with that
   * metadata stripped (pages preserved; the document is re-serialised, so the
   * result is NOT byte-for-byte). Backed by a PDF library in the shell — optional
   * and additive like net/text: a shell that can't provide it just doesn't offer
   * PDF cleaning, and a tool feature-detects `host.pdf`. Runs locally; the bytes
   * are never uploaded.
   */
  pdf?: PdfAPI;

  /**
   * Page capture — rasterise a live URL to an image. Only shells with a real,
   * authoritative browser engine can fulfil it: Tauri's native webview and the
   * CLI's headless Chromium. The web PWA *cannot* — a page cannot read pixels
   * from a cross-origin URL (frame-busting headers block display; tainted-canvas
   * rules block readback), so it exposes a stub that throws. Gated by the
   * 'capture' capability in tool.json. The browser engine lives in the shell,
   * never in the engine — this is only the contract.
   */
  capture?: CaptureAPI;

  /**
   * Compose — render another tool's output to an embeddable asset (tool
   * composition / "nested exports"). The runtime resolves a tool's manifest
   * `composes` entries by calling this, then exposes each result as an extra the
   * template references via `{{asset <id>}}`. The returned AssetRef flows back
   * through the normal render/export path, so the embedded image rasterises (PNG)
   * or inlines as vectors (SVG/PDF) exactly like any other asset. Optional and
   * additive (like net/capture): a shell that can't render a child tool to bytes
   * (e.g. the no-raster CLI for a raster child) just doesn't provide it, and the
   * runtime degrades gracefully (the `{{#if}}` slot stays empty). Gated by the
   * 'compose' capability. The host owns depth/cycle guards — see ComposeSpec._stack.
   */
  compose?: ComposeAPI;

  /**
   * Live media — a camera frame source for motion-reactive tools. Only shells with
   * a real camera + canvas can fulfil it: the web PWA and Tauri's webview (both via
   * getUserMedia) provide it; the headless CLI does not. The shell owns the
   * MediaStream, the <video>, and the grab loop entirely — it hands the runtime
   * plain pixel frames (a typed array, no DOM types), so the engine stays DOM-free
   * exactly as it does for `capture`/`compose`. The runtime drives the tool's
   * `onFrame` hook per frame (see runtime.startLive). Optional/additive (v1.4): a
   * tool feature-degrades to a still-image tool where `host.media` is absent, so
   * this is NOT gated by a `capabilities` flag — it's pure progressive enhancement.
   */
  media?: MediaAPI;

  /** Logging — goes to console in dev, to a log buffer for support diagnostics. */
  log: (level: 'debug' | 'info' | 'warn' | 'error', msg: string, ctx?: object) => void;
}

// ─── Live media (optional) ─────────────────────────────────────────────────────

export interface MediaAPI {
  /**
   * Whether a camera is usable right now (a secure context exposing
   * getUserMedia). Sync + cheap — the shell uses it to decide whether to offer a
   * "live" affordance. A `true` here does not pre-grant permission; the prompt
   * happens on start().
   */
  isAvailable(): boolean;

  /**
   * Begin the camera and the frame loop (prompting for permission the first time).
   * Resolves once frames are flowing; rejects if the user denies or there's no
   * camera. Reference-counted + idempotent: concurrent callers share one stream,
   * and the camera stops only when the matching number of stop() calls arrive.
   */
  start(): Promise<void>;

  /** Release one start() reference; the camera + loop stop when the last is released. */
  stop(): void;

  /**
   * Subscribe to camera frames. The callback receives a MediaFrame whose `data`
   * is valid only for the synchronous duration of the call (the shell may reuse or
   * release the buffer afterwards), so read the pixels synchronously. Returns an
   * unsubscribe function. Frames flow only while the camera is start()ed, are
   * throttled by the shell, and pause while the document is hidden.
   *
   * `opts.maxEdge` (added v1.4, optional) requests the working frame's longest edge
   * in pixels: the shell downscales the source camera frame to a small default that
   * suits a vector trace, but a raster-output tool (whose result is a bitmap, not
   * traced shapes) can ask for more for sharper output. The shell clamps the request
   * to the native camera frame (never upscales) and to its own ceiling, and — when
   * several tools are live — uses the largest requested edge. The runtime forwards a
   * tool's `render.liveMaxEdge` manifest hint here. A shell predating this opt simply
   * ignores it and keeps its default size.
   */
  subscribe(cb: (frame: MediaFrame) => void, opts?: { maxEdge?: number }): () => void;
}

/** One camera frame as raw RGBA pixels — DOM-free, so the engine can pass it to a hook. */
export interface MediaFrame {
  /** Frame width in pixels (the shell may downscale the source for performance). */
  width: number;
  /** Frame height in pixels. */
  height: number;
  /** Tightly-packed RGBA bytes, length width*height*4 (as from CanvasRenderingContext2D.getImageData). */
  data: Uint8ClampedArray;
  /** Monotonic timestamp (ms) of the grab, for a tool that wants frame timing. */
  t: number;
}

/**
 * Host abilities a tool can require via tool.json `capabilities`. A shell runs a
 * tool only when it can fulfil every capability the tool declares. Keep in sync
 * with the enum in schemas/tool.schema.json.
 */
export type Capability =
  | 'network' | 'filesystem' | 'clipboard' | 'camera' | 'ffmpeg' | 'wasm' | 'capture' | 'compose';

// ─── PDF (optional) ───────────────────────────────────────────────────────────

export interface PdfAPI {
  /**
   * Report the metadata a PDF carries (Info dictionary + XMP packet), for a
   * "what's hidden" view. Read-only; never mutates the input.
   */
  analyze(bytes: Uint8Array): Promise<{ findings: PdfFinding[] }>;

  /**
   * Re-save the PDF with its Info-dictionary entries and XMP packet removed.
   * Pages/content are preserved, but the document is re-serialised — the output
   * is not byte-identical, and any digital signature is invalidated.
   */
  strip(bytes: Uint8Array): Promise<{ bytes: Uint8Array }>;

  /**
   * Re-save the PDF smaller. Recompresses oversized embedded JPEG images
   * (downsample + re-encode on a canvas) and re-serialises with object streams;
   * text and vector graphics are left untouched. Like strip(), the output is NOT
   * byte-identical and any digital signature is invalidated. Runs locally — the
   * bytes are never uploaded. The result is guaranteed never larger than the input
   * (the original is returned unchanged when recompression wouldn't shrink it).
   * Image recompression needs a canvas (web/Tauri); a shell without one (the node
   * CLI) still applies the structural pass. Added after analyze/strip, so a tool
   * must feature-detect `host.pdf?.compress` — an older shell may lack it.
   */
  compress(bytes: Uint8Array, opts?: PdfCompressOpts): Promise<PdfCompressResult>;
}

export interface PdfCompressOpts {
  /** Aggressiveness preset; maps to image downsample size + JPEG quality. Default 'balanced'. */
  level?: 'light' | 'balanced' | 'strong';
  /** Re-encode images in grayscale for extra savings (e.g. scanned text). Default false. */
  grayscale?: boolean;
  /** Override the max image dimension (px) the preset implies. */
  maxDim?: number;
  /** Override the JPEG quality (0..1) the preset implies. */
  imageQuality?: number;
}

export interface PdfCompressResult {
  /** The compressed PDF — or the original bytes, if compression wouldn't shrink it. */
  bytes: Uint8Array;
  /** Input size in bytes. */
  before: number;
  /** Output size in bytes (always <= before). */
  after: number;
  /** How many embedded images were recompressed. */
  images: number;
}

export interface PdfFinding {
  /** Short category, e.g. 'Author', 'Created with', 'XMP metadata'. */
  label: string;
  /** The actual embedded value (revealed behind the tool's "show details" toggle). */
  detail: string;
  /** 'warn' flags personally-identifying / fingerprinting data; '' is neutral. */
  tone: '' | 'warn';
}

// ─── Profile ────────────────────────────────────────────────────────────────

export interface ProfileAPI {
  get(): Promise<Profile>;
  /** Subscribe to profile changes (e.g. user updates headshot mid-session). */
  subscribe(fn: (p: Profile) => void): () => void;
}

export interface Profile {
  firstname?: string;
  lastname?: string;
  email?: string;
  phone?: string;
  city?: string;
  country?: string;
  headshot?: AssetRef; // Yes — the user's headshot is an AssetRef too.
  custom?: Record<string, string>;
  /** Local UI feature flags, keyed by flag id (default ON when unset). */
  featureFlags?: Record<string, boolean>;
}

// ─── Assets ─────────────────────────────────────────────────────────────────

export interface AssetsAPI {
  /** Resolve a specific asset by id. Throws if not found and not in user uploads. */
  get(id: string, opts?: { format?: string; version?: string }): Promise<AssetRef>;

  /** Query the catalog by filter. Returns a list of resolved AssetRefs. */
  query(filter: AssetQuery): Promise<AssetRef[]>;

  /**
   * Open a host-provided picker UI. Returns the chosen AssetRef, or null if cancelled.
   * This is what tools use for asset-typed inputs — the host owns the picker chrome.
   */
  pick(opts: AssetPickerOpts): Promise<AssetRef | null>;

  /** Check if an asset is available offline right now (for graceful degradation). */
  isAvailable(id: string): Promise<boolean>;
}

export interface AssetQuery {
  type?: 'vector' | 'raster' | 'video' | 'palette' | 'font';
  namespace?: string; // e.g. 'suse/logo' matches everything under it
  tags?: string[];    // AND across tags
  includeDeprecated?: boolean; // default false
}

export interface AssetPickerOpts extends AssetQuery {
  title?: string;
  allowUpload?: boolean;
  /** Pre-select this asset id if present in results. */
  current?: string;
}

// ─── State ──────────────────────────────────────────────────────────────────

export interface StateAPI {
  /** Save the current tool's input state. Keyed by tool id + a slot name. */
  save(slot: string, data: object): Promise<void>;
  load(slot: string): Promise<object | null>;
  list(): Promise<StateEntry[]>;
  delete(slot: string): Promise<void>;
}

export interface StateEntry {
  slot: string;
  toolId: string;
  toolVersion: string;
  updatedAt: string; // ISO
  label?: string;    // user-given name
}

// ─── Design tokens ────────────────────────────────────────────────────────────

export interface TokensAPI {
  /** The resolved token set for the active (or named) theme. */
  get(opts?: { theme?: string }): Promise<TokenSet>;
  /** Colour tokens as picker-ready swatches. */
  colors(opts?: { theme?: string }): Promise<ColorSwatch[]>;
  /** Resolve a `{dotted.path}` alias (or bare path) to its concrete value. */
  resolve(ref: string, opts?: { theme?: string }): Promise<unknown>;
  /** Theme names declared in the document. */
  themes(): Promise<{ name: string; group: string | null }[]>;
}

/** A resolved token set. Returned by tokens.get(); see engine/src/tokens.js. */
export interface TokenSet {
  readonly size: number;
  has(path: string): boolean;
  get(path: string): TokenEntry | undefined;
  resolve(ref: string): unknown;
  query(filter?: { type?: string }): TokenEntry[];
  colors(): ColorSwatch[];
  themes(): { name: string; group: string | null }[];
}

export interface TokenEntry {
  path: string;                 // dotted path, e.g. 'color.brand.jungle'
  type: string | null;          // DTCG $type (possibly inherited from a group)
  value: unknown;               // resolved value (aliases already followed)
  description: string | null;   // DTCG $description
  extensions: Record<string, unknown> | null; // DTCG $extensions (e.g. CMYK anchors)
}

export interface ColorSwatch {
  ref: string;                  // canonical reference, e.g. '{color.brand.jungle}'
  path: string;
  name: string;                 // display label ($description, or prettified leaf)
  group: string | null;        // display group (parent group, prettified)
  value: string;               // resolved colour as a hex string
  description: string | null;
  cmyk: number[] | null;       // [C,M,Y,K] from $extensions, when present
}

// ─── Clipboard ──────────────────────────────────────────────────────────────

export interface ClipboardAPI {
  writeText(text: string): Promise<void>;
  /** Writes an image to clipboard if the platform supports it; otherwise falls back to download. */
  writeImage(blob: Blob): Promise<{ method: 'clipboard' | 'download' }>;
}

// ─── Export ─────────────────────────────────────────────────────────────────

export interface ExportAPI {
  /**
   * Export a DOM node (the tool's render target) to a format.
   * The host owns the renderer (html-to-image, dom-to-svg, pdf-lib, etc.) so
   * tools don't bundle their own. Tools may apply tool-specific options.
   */
  render(node: Element, format: ExportFormat, opts?: ExportOpts): Promise<Blob>;
  /** Trigger the host's download flow with a given blob. */
  download(blob: Blob, filename: string): Promise<void>;

  /**
   * Deliver a blob the tool produced itself — the transform path (file in →
   * transformed file out), as opposed to render() which rasterises a DOM node.
   * Used by on-device utilities (EXIF strip, redact, compress, convert): the
   * tool's `exportFile` hook returns the transformed bytes, the shell wraps them
   * in a Blob, and this hands them to the user (download on web, a save target on
   * Tauri/CLI). UNLIKE render(), this NEVER watermarks and NEVER embeds
   * provenance metadata — the bytes are the user's own content, not a generated
   * artifact, so stamping them would be both wrong and self-defeating (a metadata
   * stripper must not add metadata). Added in v1.1; older shells without it fall
   * back to download().
   */
  file(blob: Blob, opts?: { filename?: string }): Promise<void>;
}

/**
 * The value of a `file`-typed input: a user-picked file loaded into memory. The
 * shell's file picker builds this; the tool's hooks read `bytes` directly (the
 * hook sandbox has no fetch, so bytes ride in the value rather than behind a
 * read API). Never persisted and never serialised into a URL — binary user
 * content lives only in memory on the device, which is the whole privacy point.
 */
export interface InputFile {
  readonly __file: true;
  /** Original filename, e.g. "holiday.jpg". */
  name: string;
  /** MIME type as reported by the platform, e.g. "image/jpeg". */
  mime: string;
  /** Size in bytes. */
  size: number;
  /** Raw file bytes. The hook transforms these and returns new bytes. */
  bytes: Uint8Array;
  /** Object URL for previewing the original in the template; null in headless shells. */
  url: string | null;
}

export type ExportFormat = 'png' | 'jpg' | 'svg' | 'emf' | 'eps' | 'eps-cmyk' | 'pdf' | 'pdf-cmyk' | 'cmyk-tiff' | 'html' | 'webm' | 'av1';

export interface ExportOpts {
  scale?: number;        // raster scale (1, 2, 3) — used when width/height absent
  quality?: number;      // jpg quality 0-1
  background?: string;   // override transparent
  watermark?: boolean;   // forced true for experimental tools by the host
  filename?: string;     // suggested filename

  // Output size. A number is CSS px; a string may carry a physical unit
  // ("210mm", "8.5in", "595pt", "800px"). The host converts per format at render
  // time: raster → pixels at `dpi`; PDF → points (resolution-free); SVG → the
  // unit itself with a px viewBox. (See engine/src/units.js.)
  width?: number | string;
  height?: number | string;
  dpi?: number;          // raster DPI for physical units (default 300; px → 96)

  // Provenance embedded into the asset via the format's native metadata
  // (PNG iTXt, JPEG EXIF, PDF info dict, SVG <metadata>, …). Auto-assembled by
  // the runtime from the host profile; pass your own to override, or set
  // embedMeta:false to skip (e.g. thumbnails). Text/HTML/MD carry none.
  meta?: ExportMeta;
  embedMeta?: boolean;

  /**
   * Colour-management tag for the output. For raster formats (PNG/JPEG) this is
   * the ICC profile embedded into the file: 'srgb' (default) records the colour
   * space the canvas actually renders in, so colour-managed apps reproduce the
   * pixels faithfully; 'none' skips embedding (e.g. thumbnails). For pdf-cmyk it
   * names the press condition declared in the PDF's OutputIntent — one of the
   * keys in CMYK_CONDITIONS ('fogra39' default, 'swop', 'gracol', …). The
   * profile data and conversions live in the engine (engine/src/color.js); the
   * bridge only writes them into each format's native slot.
   */
  colorProfile?: 'srgb' | 'none' | string;

  /**
   * Hint: this export is a low-fidelity thumbnail/preview, not the deliverable.
   * Hooks may take a cheap path — e.g. an expensive-capture tool can reuse the
   * last render already on the canvas instead of re-running the capture.
   */
  thumbnail?: boolean;
}

// Provenance only — no copyright/licence/ownership fields (can't be asserted safely).
export interface ExportMeta {
  software: string;     // "Lolly"
  source: string;       // "https://lolly.tools"
  tool: string;         // the tool's name
  author: string;       // "First Last" — '' if the user hasn't set a profile
  contact: string;      // "email · phone" — '' if none
  description: string;  // human-readable credit line
}

// ─── Text-to-path ───────────────────────────────────────────────────────────

export interface TextAPI {
  /**
   * Shape `text` using the given font at `fontSize` px and return an SVG path.
   *
   * The returned `d` string uses SVG coordinates (Y-down) with the baseline at
   * y=0. `bbox.x1` may be slightly positive (left side bearing). `advanceWidth`
   * is the total pen advance in pixels. `bbox` is null for blank/whitespace-only
   * runs.
   *
   * Font shaping respects OpenType features (GPOS, GSUB — ligatures, kerning,
   * contextual alternates) via HarfBuzz, unlike naïve glyph-by-glyph approaches.
   */
  toPath(opts: TextToPathOpts): Promise<TextPathResult>;

  /** Warm the font cache for `fontUrl` without doing any shaping. */
  preload(fontUrl: string): Promise<void>;
}

export interface TextToPathOpts {
  text: string;
  fontUrl: string;
  fontSize: number;
  /** OpenType feature tags to enable/disable, e.g. `['liga=1', 'kern=1']`. */
  features?: string[];
}

export interface TextPathResult {
  /** SVG path data string. Baseline at y=0; Y-down coordinate system. */
  d: string;
  /** Total horizontal advance of the run, in pixels. */
  advanceWidth: number;
  /**
   * Tight glyph bounding box in pixels. null for blank or whitespace-only runs.
   * y1 is above the baseline (negative), y2 is below (positive for descenders).
   */
  bbox: { x1: number; y1: number; x2: number; y2: number } | null;
}

// ─── Network ────────────────────────────────────────────────────────────────

export interface NetAPI {
  /** Allowlisted fetch. The host may deny based on tool manifest. */
  fetch(url: string, init?: RequestInit): Promise<Response>;
}

// ─── Capture ────────────────────────────────────────────────────────────────

export interface CaptureAPI {
  /**
   * Navigate to `url` in a real browser engine and rasterise the result to an
   * image. Returns a raster AssetRef (`source: 'remote'`) that flows back through
   * the normal render/export path — so units, format conversion, provenance and
   * the experimental watermark all apply downstream exactly as for a template
   * render. Capture is the *source*; export remains the single output path.
   *
   * Slow and side-effectful (a real navigation + settle), unlike instant
   * template renders — call it from an explicit action, not on every keystroke.
   */
  page(spec: CaptureSpec): Promise<AssetRef>;
}

export interface CaptureSpec {
  /** The URL to load and capture. */
  url: string;
  /** Viewport width in px. The engine resolves physical units before calling. */
  width: number;
  /** Viewport height in px. Omit to capture the full scrollable page height. */
  height?: number;
  /**
   * Scroll before capturing: a 0..1 fraction of the scrollable height, or a px
   * offset when > 1. Lets the shot frame below-the-fold content.
   */
  scrollDepth?: number;
  /** Settle time after load — and after scrolling — before the shot, in ms. */
  waitMs?: number;
  /** Device pixel ratio for a crisp raster; maps onto the export `dpi` concept. */
  dpr?: number;
  /**
   * Custom CSS injected into the page before the shot (userstyles-style, additive
   * — appended so it layers over the page's own rules by source order). Use it to
   * hide cookie banners, restyle elements, etc.
   */
  css?: string;
}

// ─── Compose ──────────────────────────────────────────────────────────────────

export interface ComposeAPI {
  /**
   * Render the named tool with the given inputs to a self-contained AssetRef
   * (`source: 'remote'`, `url` a `blob:`/`data:` URL). The child render goes
   * through the same loadTool → createRuntime → host.export.render path, so it is
   * pixel-identical to rendering that tool directly — but watermark/provenance are
   * suppressed because the result is an intermediate asset, not the deliverable.
   *
   * The host enforces recursion guards: it rejects if `_stack` already contains
   * `toolId` (a cycle, A→B→A) or exceeds the max compose depth, so a self- or
   * mutually-embedding tool fails fast instead of looping. The runtime threads and
   * extends `_stack` automatically; callers outside the runtime may omit it.
   */
  render(spec: ComposeSpec): Promise<AssetRef>;

  /**
   * Render a tool *URL* (a link a user pasted) to an embeddable AssetRef — the
   * end-user counterpart to render(). The host parses the URL (manifest-aware, so
   * typed inputs coerce exactly as URL mode would), renders the named tool, and
   * returns an AssetRef whose `id` is the CANONICAL embed URL
   * (`https://lolly.tools/tool/<id>.<ext>?…`, see tool-url.js buildEmbedUrl).
   *
   * That canonical id is the asset's persistent identity: it round-trips through
   * URL mode + saved sessions, and the runtime feeds it back here to re-render the
   * asset on load — so a tool-sourced image survives reload and travels inside a
   * shared link, exactly as a library asset id does. `opts` overrides (format /
   * size) take precedence over anything parsed from the URL and are folded into
   * the returned id. Returns null when the URL isn't a recognised tool URL or the
   * tool can't be rendered (the caller then leaves the slot empty).
   *
   * Accepts every shape the app hands a user (embed URL, hash share route, pretty
   * path); the toolId must resolve to a real local tool, so a pasted link can only
   * render a tool that already ships in this build. Optional/additive (v1.3) —
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
  /** Engine-managed recursion stack — threaded by the runtime on re-resolve. */
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
}

// Re-export the AssetRef shape from the schema for convenience.
export interface AssetRef {
  source: 'library' | 'user' | 'remote';
  id: string;
  type: 'vector' | 'raster' | 'video' | 'palette' | 'font';
  format: string;
  url: string;
  width?: number;
  height?: number;
  version?: string;
  checksum?: string;
  meta?: Record<string, unknown>;
}
