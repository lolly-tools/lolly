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

  /**
   * Device capture — record the microphone (and optionally the camera) to a file,
   * plus a DOM-free live audio-level meter. Where `media` is a read-only camera
   * frame *source*, `recorder` is a *sink*: the shell owns getUserMedia({audio}),
   * the MediaRecorder, and the AnalyserNode entirely, and the engine only ever sees
   * plain numbers (AudioLevel) and finished Blobs — never a MediaStream or <video>,
   * so the engine stays DOM-free exactly as it does for `media`/`capture`. UNLIKE
   * `media`, capture prompts for a permission that a shell may be unable to grant,
   * so it IS gated behind the `microphone` (and, for video capture, `camera`)
   * capability in tool.json; the headless CLI provides no `recorder` at all. The
   * runtime drives a tool's `onLevel` hook from the meter and orchestrates a
   * recording session (see runtime.startMeter / startRecording). Optional/additive
   * (v1.17) — a tool feature-detects `host.recorder`. (See host.export.file for how
   * the recorded bytes reach the user: the transform path, never watermarked.)
   */
  recorder?: RecorderAPI;

  /** Logging — goes to console in dev, to a log buffer for support diagnostics. */
  log: (level: 'debug' | 'info' | 'warn' | 'error', msg: string, ctx?: object) => void;
}

// ─── Device capture / recorder (optional) ───────────────────────────────────────

export interface RecorderAPI {
  /**
   * Whether device capture of the given kind is usable right now (a secure context
   * exposing getUserMedia + MediaRecorder). Sync + cheap, so a shell can decide
   * whether to offer a "record" affordance. `kind` defaults to 'audio'. A `true`
   * here does not pre-grant permission — the prompt happens on meter.start()/record().
   */
  isAvailable(kind?: 'audio' | 'video'): boolean;

  /**
   * Live input-level meter, DOM-free — a pre-record "sound check". Prompts for the
   * microphone on first start(), reference-counted + idempotent like MediaAPI. A web
   * shell opens it RAW (noiseSuppression/AGC/echoCancellation OFF, v1.19) so the level
   * and the noiseFloor/hum/hiss cues reflect the true room; the recording session
   * (record()) keeps suppression ON for a clean file, so the two use separate streams.
   * The grant is per-origin, so a sound-check then record() still prompts only once.
   */
  meter: MeterAPI;

  /**
   * Open a capture session (prompting for the requested devices the first time).
   * Resolves once the recorder is running; rejects if the user denies or a device
   * is missing (the shell surfaces the error). The returned session owns the
   * MediaStream + MediaRecorder; the engine only receives its live levels and,
   * on stop(), the finished Blob.
   */
  record(opts?: RecordOpts): Promise<RecordSession>;
}

export interface MeterAPI {
  /**
   * Begin the mic + the level loop (prompting the first time). Resolves once levels
   * are flowing; rejects on denial / no mic. Reference-counted + idempotent:
   * concurrent callers share one stream, and the mic stops only when the matching
   * number of stop() calls arrive.
   */
  start(): Promise<void>;
  /** Release one start() reference; the mic + loop stop when the last is released. */
  stop(): void;
  /**
   * Subscribe to audio-level frames. The shell computes each AudioLevel from an
   * AnalyserNode and pushes it on its own cadence (throttled; paused while the
   * document is hidden). Returns an unsubscribe function. Levels flow only while
   * the meter is start()ed.
   */
  subscribe(cb: (level: AudioLevel) => void): () => void;
}

/**
 * One audio-level sample — DOM-free, so the engine can hand it to a hook (the
 * audio counterpart to MediaFrame). All amplitudes are 0..1 linear except `dbfs`.
 */
export interface AudioLevel {
  /** Short-window RMS (loudness), 0..1 linear. The value a VU-style bar tracks. */
  rms: number;
  /** Instantaneous peak amplitude over the window, 0..1 linear. */
  peak: number;
  /** Peak in decibels-relative-to-full-scale: 20·log10(peak). 0 = clip, −∞ = silence. */
  dbfs: number;
  /** True while `peak` sits at/above the clipping threshold (~0.99) — drives a "too hot" warning. */
  clipping: boolean;
  /**
   * Estimated background-noise floor in dBFS — a slow min-hold of the loudness over a
   * few seconds (the level in the quiet gaps). −∞ = silence. Only trustworthy from a
   * RAW meter (the sound-check runs the mic with noiseSuppression/AGC OFF); a recording
   * session runs them ON for a clean file, so its floor reads artificially low.
   * Optional (added v1.19); undefined on shells that don't compute spectral levels.
   */
  noiseFloor?: number;
  /** Signal-to-noise ratio in dB = current RMS loudness − noiseFloor (like-with-like, both RMS). Low (≲15 dB) = noisy room. Optional (v1.19). */
  snr?: number;
  /** 0..1 share of energy in the mains bands (50/60 Hz + harmonics) — tonal electrical HUM / ground loop. Optional (v1.19). */
  hum?: number;
  /** 0..1 spectral flatness (geometric/arithmetic mean of the magnitude spectrum) — broadband HISS (fan/HVAC). Optional (v1.19). */
  hiss?: number;
  /**
   * 0..1 STEADINESS of the loudness envelope over ~1.5s — how constant the RMS is. ~1 =
   * a steady drone (a fan / AC / HVAC / broadband hiss holds a near-constant RMS); ~0 = a
   * modulated signal (speech, whose syllables make the RMS peak and dip). Lets coaching
   * tell background NOISE from SPEECH independent of level — a constant mid-level hiss no
   * longer reads as "speaking". Optional (v1.20). */
  steady?: number;
  /** Monotonic timestamp (ms) of the sample, matching MediaFrame.t. */
  t: number;
}

export interface RecordOpts {
  /** Capture the microphone. Default true. */
  audio?: boolean;
  /** Capture the camera too (an audio+video clip). Default false (audio-only). */
  video?: boolean;
  /**
   * Preferred container. The shell falls back across containers exactly like the
   * video-export path (a browser that can't encode the requested one uses what it
   * can), so this is a hint, not a guarantee — read the returned Blob's `type`.
   */
  format?: 'webm' | 'mp4';
  /** Video downscale: longest edge in px (mirrors MediaAPI subscribe maxEdge). Ignored for audio-only. */
  maxEdge?: number;
  /** Which camera to prefer for a video capture (v1.21). 'user' (front/selfie, default) or
   *  'environment' (rear). Ignored for audio-only; falls back to any camera if unavailable. */
  facingMode?: 'user' | 'environment';
  /** Hard ceiling on clip length in ms; the session auto-stops when reached. */
  maxMs?: number;
  /** Provenance stamped into the finished Blob (best-effort, per container). */
  meta?: ExportMeta;
}

/**
 * A running capture session. The shell keeps the MediaStream + MediaRecorder; the
 * engine holds only this handle. Live levels flow through subscribe() (same shape
 * as MeterAPI) so a tool's coaching UI updates during the take.
 */
export interface RecordSession {
  /** Subscribe to live audio levels while recording. Returns an unsubscribe fn. */
  subscribe(cb: (level: AudioLevel) => void): () => void;
  /** Finalise the recording and resolve the finished media Blob (with provenance where supported). */
  stop(): Promise<Blob>;
  /** Discard the recording and release the devices — no Blob is produced. */
  cancel(): void;
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
   * `opts.facingMode` (v1.21) prefers the front ('user', default) or rear ('environment')
   * camera; honoured only when this start() actually creates the stream (a shared stream
   * keeps its original camera, so a flip is stop() then start()).
   */
  start(opts?: { facingMode?: 'user' | 'environment' }): Promise<void>;

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
  | 'network' | 'filesystem' | 'clipboard' | 'camera' | 'microphone' | 'ffmpeg' | 'wasm' | 'capture' | 'compose';

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
  /** "Use my details" opt-in — gates embedding author/contact into export
   *  provenance (see engine/src/metadata.ts). */
  useDetails?: boolean;
  /** True once the user has dismissed (or acted on) the gallery's first-visit
   *  personalisation nudge — the one-time prompt to opt into `useDetails`. Rides
   *  the profile (not device storage) so the prompt is per-user, not per-device. */
  personalizeNudgeDismissed?: boolean;
  city?: string;
  country?: string;
  headshot?: AssetRef; // Yes — the user's headshot is an AssetRef too.
  custom?: Record<string, string>;
  /** Local UI feature flags, keyed by flag id (default ON when unset). */
  featureFlags?: Record<string, boolean>;
  /** Tool ids the user has starred — the gallery's "Favourites" collection. Rides
   *  the profile so it persists across reloads and travels in the portable backup. */
  favourites?: string[];
  /** Asset ids the user has starred — the Catalog's asset "Favourites", surfaced as a
   *  pinned collapsible section at the top of every asset picker. Distinct from
   *  `favourites` (TOOL ids). Keyed by the base asset id (theme suffix stripped). */
  favouriteAssets?: string[];
  /** Per-user category override for the Catalog + picker grouping: base asset id →
   *  library group key (e.g. 'backgrounds'). Layers over the tag-derived category so a
   *  user can reclassify e.g. a headshot as a background. Immutable catalog tags are
   *  never mutated — this is the per-user overlay. */
  assetCategories?: Record<string, string>;
  /** Base asset ids the user has hidden from THEIR catalogue + every picker. The
   *  shared/immutable catalog file is never deleted; this is a per-user "hide from my
   *  view" overlay (the only honest "delete" for a read-only catalog asset). Tolerant
   *  of an id that vanishes on a future catalog rebuild. */
  hiddenAssets?: string[];
  /** One-shot marker that the shipped Catalog defaults (e.g. the default-hidden asset
   *  set) have been established for this profile. Until it's set, the shell merges those
   *  defaults into the user's overlay at load; once the user first edits the overlay it's
   *  baked in and set true, so their later un-hides stick and the defaults never re-apply. */
  catalogDefaultsSeeded?: boolean;
}

// ─── Assets ─────────────────────────────────────────────────────────────────

export interface AssetsAPI {
  /**
   * Resolve a specific asset by id. Throws if not found and not in user uploads.
   *
   * 1.6.0: the id may carry an icon colour pairing — `<baseId>?theme=<themeId>`
   * (see engine icon-theme.js). Bridges resolve the BASE asset and, for a
   * themable two-colour icon, bake the pairing into the returned bytes; the
   * returned ref keeps the themed id (it is the persistent identity in URL
   * mode). An unknown theme resolves to the plain asset under the themed id.
   */
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

  /**
   * The stored Content Credentials of a user-uploaded asset, if it carried any
   * at ingest — kept as the raw C2PA manifest store (no pixels/EXIF, so nothing
   * the upload pipeline strips is re-hoarded). Used to preserve a placed asset's
   * provenance as an export ingredient (see engine prepareC2paIngredientFromStore
   * → embedC2pa). Optional (added v1.26): shells without credential capture omit
   * it, and the runtime simply skips ingredient preservation.
   */
  credential?(id: string): Promise<{ store: Uint8Array; format: string } | null>;
}

/**
 * A credentialed source asset's preserved provenance, carried into an export's
 * Content Credentials. The runtime gathers these from credentialed uploads used
 * in a design; the C2PA embedder copies their manifests into the export's store
 * and records a c2pa.ingredient assertion + c2pa.opened action (so an AI or
 * camera origin is never laundered away). Opaque to the shell — forwarded as-is.
 */
export interface IngredientCredential {
  manifestBoxes: Uint8Array[];
  activeLabel: string;
  title?: string;
  format?: string;
  relationship?: string;
  digitalSourceType?: string;
}

export interface AssetQuery {
  type?: 'vector' | 'raster' | 'video' | 'audio' | 'lottie' | 'palette' | 'tokens' | 'font';
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
 * shell's file picker builds this; the tool's hooks read `bytes` directly (by
 * design bytes ride in the value rather than behind a read API — the portable
 * host surface has no file-read call). Never persisted and never serialised
 * into a URL — binary user
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

export type ExportFormat = 'png' | 'apng' | 'jpg' | 'svg' | 'emf' | 'eps' | 'eps-cmyk' | 'pdf' | 'pdf-cmyk' | 'cmyk-tiff' | 'html' | 'webm';

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

  /**
   * Optional audio bed for the video formats (webm/mp4) — like the de-facto
   * wait/duration/fps timing opts, a web-shell extension the engine passes
   * through untouched. `url` is any fetchable audio file (the export popup
   * resolves a catalog `type: 'audio'` asset to its blob URL); it is decoded
   * via Web Audio, muxed into the recording, and plays for the clip duration,
   * looping when the clip outlasts the track. Ignored by non-video formats;
   * degrades to a silent video (with a log warning) where audio recording is
   * unsupported.
   *
   * `fadeIn`/`fadeOut` (seconds, added v1.17) apply a linear gain envelope to the
   * bed: it ramps up from silence over the first `fadeIn` seconds and down to
   * silence over the last `fadeOut` seconds of the clip. 0/omitted = no fade (a
   * hard cut). The shell applies them with a GainNode inside the audio graph, so
   * the fade is baked into the muxed track — no pre-faded asset variants needed.
   * `volume` (0..1, default 1) is the bed's overall level. `duck` (0..1, default 1
   * = no ducking) is the level the bed drops to while foreground audio is present —
   * the top-&-tail compositor lowers the music to `volume·duck` over the body clip
   * when the footage carries its own audio, then restores it for the outro, so an
   * uploaded talking clip stays intelligible under the bed.
   */
  audio?: { id?: string; url: string; fadeIn?: number; fadeOut?: number; volume?: number; duck?: number };

  /**
   * Content Credentials to preserve from placed source assets (added v1.26). The
   * runtime gathers these from credentialed uploads used in the design; the C2PA
   * embedder carries their manifests into the export's provenance chain. Opaque
   * to the shell; ignored by exports that aren't C2PA-stamped.
   */
  ingredients?: IngredientCredential[];

  /**
   * A compact digest of the tool's scalar inputs (id → short string) that
   * produced this render — colours, sizes, toggles, short text (added v1.27).
   * The runtime derives it via summarizeInputs() when C2PA stamping is on; the
   * shell records it under `inputs` in the `tools.lolly.export` assertion so an
   * inspected asset shows what it was made from. Opaque to the shell; ignored by
   * exports that aren't C2PA-stamped.
   */
  c2paInputs?: Record<string, string>;
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

  /**
   * The font's variable-axis DEFAULT values, tag → value (`{ wght: 400 }`), or
   * `{}` for a static font. A caller embedding the raw file into a renderer with
   * no variable-axis control (jsPDF) gets exactly this instance, so it needs the
   * defaults to know whether the file will render at the weight it wants.
   * Optional/additive (v1.30); absent on older hosts. (v1.30)
   */
  axisDefaults?(fontUrl: string): Promise<Record<string, number>>;
}

export interface TextToPathOpts {
  text: string;
  fontUrl: string;
  fontSize: number;
  /** OpenType feature tags to enable/disable, e.g. `['liga=1', 'kern=1']`. */
  features?: string[];
  /**
   * Uniform tracking added after every glyph, in pixels (CSS letter-spacing). The
   * baked-in advance keeps outlined text (SVG/PDF/EMF) matching the on-screen run
   * instead of forcing a non-outlined <text> fallback. Defaults to 0.
   */
  letterSpacing?: number;
  /**
   * OpenType variation-axis settings for a VARIABLE font, as HarfBuzz strings
   * (`['wght=700']`). Without them a variable face shapes at its default
   * instance — a bold run would outline as regular. Axes not listed take their
   * default value. Ignored by static fonts. (v1.29)
   */
  variations?: string[];
  /**
   * Faces to shape the characters `fontUrl` has no glyph for, tried in order —
   * the same job the browser's font fallback does. Needed because webfont
   * families arrive as DISJOINT subsets (Google Fonts' `latin` file holds no
   * `Ł`, and its `latin-ext` file holds no ASCII), so a single face cannot
   * outline "Łódź". Characters no face covers shape as `.notdef` and are
   * counted in `notdef`. (v1.29)
   */
  fallbackFonts?: Array<{ fontUrl: string; variations?: string[] }>;
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
  /**
   * How many glyphs in the run fell back to `.notdef` — the font has no glyph
   * for that character. Outlining then draws blanks or tofu boxes, so a caller
   * that has a fallback (an SVG `<text>` element) should prefer it when this is
   * non-zero. Absent on hosts that predate the field; treat as 0. (v1.29)
   */
  notdef?: number;
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
  type: 'vector' | 'raster' | 'video' | 'audio' | 'lottie' | 'palette' | 'tokens' | 'font';
  format: string;
  url: string;
  width?: number;
  height?: number;
  version?: string;
  checksum?: string;
  // Free-form, host-populated. Conventional keys the engine/shells recognise:
  //   name       display label
  //   tags       string[] for filtering
  //   animated   true for an animated raster (gif/apng/animated-webp) — the frame
  //              badge marks it and exports know it flattens to a still
  //   posterUrl  a still fallback frame for a lottie or video (used for the
  //              <video poster> attribute and as the pre-play / export still)
  meta?: Record<string, unknown>;
}
