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
   * Page capture — rasterise a live URL to an image. Only shells with a real,
   * authoritative browser engine can fulfil it: Tauri's native webview and the
   * CLI's headless Chromium. The web PWA *cannot* — a page cannot read pixels
   * from a cross-origin URL (frame-busting headers block display; tainted-canvas
   * rules block readback), so it exposes a stub that throws. Gated by the
   * 'capture' capability in tool.json. The browser engine lives in the shell,
   * never in the engine — this is only the contract.
   */
  capture?: CaptureAPI;

  /** Logging — goes to console in dev, to a log buffer for support diagnostics. */
  log: (level: 'debug' | 'info' | 'warn' | 'error', msg: string, ctx?: object) => void;
}

/**
 * Host abilities a tool can require via tool.json `capabilities`. A shell runs a
 * tool only when it can fulfil every capability the tool declares. Keep in sync
 * with the enum in schemas/tool.schema.json.
 */
export type Capability =
  | 'network' | 'filesystem' | 'clipboard' | 'camera' | 'ffmpeg' | 'wasm' | 'capture';

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
}

export type ExportFormat = 'png' | 'jpg' | 'svg' | 'pdf' | 'pdf-cmyk' | 'cmyk-tiff' | 'html' | 'webm' | 'av1';

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
