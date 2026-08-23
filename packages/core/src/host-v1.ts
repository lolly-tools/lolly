// SPDX-License-Identifier: MPL-2.0
/**
 * Capability Bridge - v1
 *
 * This is the versioned contract between tools and host shells. Tools call into
 * `host.*` methods provided here. Shells (web PWA, Tauri desktop/mobile, CLI)
 * implement this interface in their own way - but the surface is identical.
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
   * The capabilities this shell can actually fulfil - a subset of the tool.json
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

  /** Clipboard ops. Universal - even CLI has a fallback (writes to stdout/file). */
  clipboard: ClipboardAPI;

  /** Export the rendered template area to a format. The host owns the rasteriser. */
  export: ExportAPI;

  /** Network - only available if the tool declared the 'network' capability. */
  net?: NetAPI;

  /**
   * Design tokens (DTCG). Resolves the catalog's brand token document into a flat,
   * themed lookup. The host UI uses it to source colour-picker swatches from
   * tokens; the runtime uses it to resolve token-referenced input values; a
   * token-aware tool can read the whole tree. Optional and additive (like net/
   * text) - a shell that doesn't provide it just doesn't offer token-driven UI.
   */
  tokens?: TokensAPI;

  /**
   * Text-to-path primitive. Shape and outline a text run into an SVG path.
   * Backed by HarfBuzz WASM - correct shaping including GPOS, ligatures, kerning.
   * DOM-free (HarfBuzz needs no layout engine), so the web PWA, the CLI, and the TUI
   * all provide it; a shell can still legitimately omit it (feature-detected).
   */
  text?: TextAPI;

  /**
   * PDF metadata inspection + removal. Reads the Info dictionary and any XMP
   * packet to report what a PDF carries, and produces a re-saved copy with that
   * metadata stripped (pages preserved; the document is re-serialised, so the
   * result is NOT byte-for-byte). Backed by a PDF library in the shell - optional
   * and additive like net/text: a shell that can't provide it just doesn't offer
   * PDF cleaning, and a tool feature-detects `host.pdf`. Runs locally; the bytes
   * are never uploaded.
   */
  pdf?: PdfAPI;

  /**
   * PPTX inspect + rebrand. Reads an uploaded .pptx deck (slide count, theme,
   * the literal colours/fonts in use) and produces a surgically re-themed copy:
   * only the brand-bearing OOXML values are rewritten - every other byte passes
   * through verbatim, so SmartArt, charts, animations and media survive. Backed
   * by the engine's pptx primitives plus a zip codec in the shell - optional
   * and additive like net/text/pdf: a shell that can't provide it just doesn't
   * offer deck rebranding, and tools must feature-detect `host.pptx`. Runs
   * locally; the bytes are never uploaded.
   */
  pptx?: PptxAPI;

  /**
   * Page capture - rasterise a live URL to an image. Only shells with a real,
   * authoritative browser engine can fulfil it: Tauri's native webview and the
   * CLI's headless Chromium. The web PWA *cannot* - a page cannot read pixels
   * from a cross-origin URL (frame-busting headers block display; tainted-canvas
   * rules block readback), so it exposes a stub that throws. Gated by the
   * 'capture' capability in tool.json. The browser engine lives in the shell,
   * never in the engine - this is only the contract.
   */
  capture?: CaptureAPI;

  /**
   * Compose - render another tool's output to an embeddable asset (tool
   * composition / "nested exports"). The runtime resolves a tool's manifest
   * `composes` entries by calling this, then exposes each result as an extra the
   * template references via `{{asset <id>}}`. The returned AssetRef flows back
   * through the normal render/export path, so the embedded image rasterises (PNG)
   * or inlines as vectors (SVG/PDF) exactly like any other asset. Optional and
   * additive (like net/capture): a shell that can't render a child tool to bytes
   * (e.g. the no-raster CLI for a raster child) just doesn't provide it, and the
   * runtime degrades gracefully (the `{{#if}}` slot stays empty). Gated by the
   * 'compose' capability. The host owns depth/cycle guards - see ComposeSpec._stack.
   */
  compose?: ComposeAPI;

  /**
   * Live media - a camera frame source for motion-reactive tools. Only shells with
   * a real camera + canvas can fulfil it: the web PWA and Tauri's webview (both via
   * getUserMedia) provide it; the headless CLI does not. The shell owns the
   * MediaStream, the <video>, and the grab loop entirely - it hands the runtime
   * plain pixel frames (a typed array, no DOM types), so the engine stays DOM-free
   * exactly as it does for `capture`/`compose`. The runtime drives the tool's
   * `onFrame` hook per frame (see runtime.startLive). Optional/additive (v1.4): a
   * tool feature-degrades to a still-image tool where `host.media` is absent, so
   * this is NOT gated by a `capabilities` flag - it's pure progressive enhancement.
   */
  media?: MediaAPI;

  /**
   * Lift - enumerate an SVG's own layers into standalone documents (the engine's
   * `enumerateSvgLayers`). The shell fetches + sanitises the SVG through its one
   * untrusted-SVG path; the engine owns what a "layer" is, so web and CLI agree. The
   * maths that turns layers into DEPTH is the CALLER's, not this primitive's - it returns
   * geometry (documents + ink boxes + viewBox), never a scene. Optional/additive (v1.123):
   * a shell without a safe SVG fetch/sanitise path omits it, and NOT gated by a capability
   * - it is progressive enhancement (the dedicated Flythrough tool lifts a screenshot into
   * depth planes where `host.lift` is present, and flies one flat plane where it is not).
   */
  lift?: LiftAPI;

  /**
   * Keyframes - evaluate the engine's `kf` wire (the same track format the Design tool's
   * camera and every keyframed input use) into concrete pose samples, for a tool TEMPLATE
   * that cannot import the engine. The engine owns the parse + interpolation + easing (the
   * drift-prone part), so a template's motion matches the Design tool's exactly; the
   * template owns only how it maps the pose CHANNELS onto its own scene. Optional/additive
   * (v1.124); a shell without it omits it (the Flythrough tool then uses its built-in
   * parametric moves and ignores a custom `camera` track).
   */
  keyframes?: KeyframesAPI;

  /**
   * Device capture - record the microphone (and optionally the camera) to a file,
   * plus a DOM-free live audio-level meter. Where `media` is a read-only camera
   * frame *source*, `recorder` is a *sink*: the shell owns getUserMedia({audio}),
   * the MediaRecorder, and the AnalyserNode entirely, and the engine only ever sees
   * plain numbers (AudioLevel) and finished Blobs - never a MediaStream or <video>,
   * so the engine stays DOM-free exactly as it does for `media`/`capture`. UNLIKE
   * `media`, capture prompts for a permission that a shell may be unable to grant,
   * so it IS gated behind the `microphone` (and, for video capture, `camera`;
   * for display capture, `screen`) capability in tool.json; the headless CLI
   * provides no `recorder` at all. The runtime drives a tool's `onLevel` hook from
   * the meter and orchestrates a recording session (see runtime.startMeter /
   * startRecording). Optional/additive (v1.17) - a tool feature-detects
   * `host.recorder`. (See host.export.file for how the recorded bytes reach the
   * user: the transform path, never watermarked.)
   */
  recorder?: RecorderAPI;

  /**
   * Audio analysis - decoded sound in, a per-frame reactivity track out (bass /
   * mid / treble, a log-spaced spectrum, onset strength, tempo, beat times, and
   * optionally raw time-domain windows).
   *
   * Where `recorder.meter` reports the LIVE level of a microphone one sample at a
   * time, this analyses a whole finished clip ahead of drawing it - which is what
   * an audiogram, a music video or a spectrum needs, because it has to know frame
   * 200's bass while it is still drawing frame 1. Nothing here streams.
   *
   * DOM-free CONTRACT, exactly like `images`: a URL or an AssetRef in, plain typed
   * arrays out. The SHELL owns the decoder (the web shell has `decodeAudioData`,
   * the CLI a WAV reader plus the engine's ZzFXM renderer); the analysis MATHS is
   * the engine's `analysePcm`, so a shell attaches it rather than reimplementing
   * it and the browser and the CLI read the same numbers off the same clip.
   *
   * Optional/additive (v1.71) and NOT gated by a `capabilities` flag - a tool
   * feature-detects `host.audio` and falls back to a static waveform where it is
   * absent. Runs locally; the audio is never uploaded.
   */
  audio?: AudioAPI;

  /**
   * Deep image codecs - a float pixel frame in, finished image bytes out at real
   * bit depth. The dual of `export.render` (which rasterises the DOM to 8-bit):
   * a tool that computes its own high-precision pixels (a float grading pipeline,
   * a renderer with genuine headroom) hands over a linear Float32 RGBA frame and
   * gets back a 16-bit PNG, an OpenEXR / Radiance master, or an error-diffused
   * 8-bit PNG - depths the browser's 8-bit canvas cannot originate. Pairs with a
   * tool's `exportStill` hook to own its raster export end to end.
   *
   * DOM-free CONTRACT: a plain typed-array frame in, bytes out. The MATHS is the
   * engine's own writers (packExr / packRadiance / packPng + the Floyd–Steinberg
   * dither), so the SHELL only forwards - and web and CLI produce byte-identical
   * output from the same frame. `data` is RGBA interleaved, LINEAR light,
   * un-premultiplied (the engine `DeepFrame` contract); the SDR encoders
   * (png16 / dither8) gamma-encode and clamp at their display boundary, EXR and
   * Radiance keep the unbounded linear values.
   *
   * Optional/additive and NOT gated by a `capabilities` flag - a tool
   * feature-detects `host.codec` and falls back to the ordinary 8-bit export
   * where it is absent. Runs locally; pixels are never uploaded.
   */
  codec?: CodecAPI;

  /**
   * Layered-bitmap write-back (v1.102) - currently one method: serialise a set
   * of positioned RGBA layers as a layered Photoshop PSD (the engine's own
   * writer; opens in Photoshop, GIMP and Krita). The read side is NOT here:
   * PSD/XCF *import* is a shell ingest flow (drop router → per-layer library
   * assets), not something a running tool does. Optional/additive, feature-
   * detected (`host.layers?.writePsd`); runs locally, bytes never leave the
   * device, and like every `export.file` path the result is never watermarked
   * or provenance-stamped - it is the user's own file.
   */
  layers?: LayersAPI;

  /**
   * On-device AI image upscaling - a low-resolution raster in, a larger one out,
   * run entirely on the device (onnxruntime-web, WebGPU where present falling back
   * to WASM). For the person whose headshot is 400px beside colleagues' 2000px
   * photos: enlarge it offline, and - because the added pixels are model-inferred -
   * the output carries a C2PA credential naming the model (the runtime sets
   * `ExportOpts.c2paAiUpscale` from the upscaled asset's meta, disclosed as the
   * IPTC `compositeWithTrainedAlgorithmicMedia` source type - a real photo,
   * AI-enhanced, never claimed as fully generated).
   *
   * DOM-free CONTRACT: a plain RGBA frame in, a larger RGBA frame out. The SHELL
   * owns the model runtime, the backend choice, the one-time (consented - see
   * `modelBytes`) weight download and the memory-bounded tiling; the engine/tool
   * only ever sees pixels. The models ship under permissive licences (BSD-3-Clause,
   * Apache-2.0) whose attribution the shell carries in its credits.
   *
   * Optional/additive (v1.101) and NOT gated by a `capabilities` flag - a tool
   * feature-detects `host.upscale` and hides its "Upscale" affordance where it is
   * absent (the headless CLI provides none for now). Because the run can take many
   * seconds on a weak device, it is NEVER driven from a time-boxed hook: a shell
   * offers it as an explicit, cancellable, progress-bearing action whose result
   * becomes an asset. Runs locally; the image is never uploaded.
   */
  upscale?: UpscaleAPI;

  /**
   * On-device background removal - a plain RGBA frame in, the same frame with a
   * model-computed alpha matte out (v1.103). A structural twin of `upscale`: the
   * shell owns the ONNX runtime, the WebGPU→WASM backend, the one-time consented
   * model download and the memory bound; the tool only ever sees pixels.
   *
   * Its PROVENANCE is deliberately NOT the upscale kind. Upscale INVENTS pixels
   * (a trained-algorithm composite source type, `aiGenerated:'partial'`); a matte
   * invents nothing - every RGB pixel is the original, and only the alpha channel
   * (a selection, not image content) is computed. So the honest disclosure is an
   * edit step, "Background removed with <model> <version>", with the original kept
   * as a C2PA ingredient - NOT a generated/composite claim, and the asset is NOT
   * flagged AI-generated. That distinction is the whole point of hosting this: a
   * same-format cutout that keeps its metadata, colour and credential intact,
   * where other removers strip all three.
   *
   * Optional/additive and NOT gated by a `capabilities` flag - a tool feature-
   * detects `host.matte` and hides its Remove-Background affordance where it is
   * absent. Like `upscale`, NOT driven from a time-boxed hook: a shell surfaces it
   * as an explicit, cancellable, progress-bearing action whose result is an asset.
   * Runs locally; pixels never leave the device.
   */
  matte?: MatteAPI;

  /**
   * On-device text recognition (OCR) - a plain RGBA frame in, the text the image
   * contains out, as lines with boxes and confidences (v1.127). A structural
   * sibling of `matte` / `upscale`: the shell owns the ONNX runtime, the WASM
   * backend, the one-time (consented - see `modelBytes`) model download and the
   * memory bound; the tool or host only ever sees pixels and plain text.
   *
   * Unlike `matte` / `upscale` this produces NO pixels and NO derived asset, so it
   * carries NO provenance - reading text is not a media edit, there is no C2PA
   * step, no ingredient and no `aiGenerated` flag on anything. Recognition is a
   * best-effort READ, never authoritative: a shell shows the text as a correctable
   * draft, never as a verdict about the image. Note too that OCR reads PIXELS, so
   * any byte-level signal carried by the source's digital text (invisible
   * characters, homoglyphs, a text watermark) is lost in rasterisation - those
   * survive only on native digital text, not on an OCR read.
   *
   * WASM-only by design (`backend()` never reports webgpu): the models are small
   * and ort-web's GPU kernels reject ops these graphs use. Optional/additive and
   * NOT gated by a `capabilities` flag - a tool feature-detects `host.ocr` and
   * hides its "Copy text" affordance where it is absent (the headless CLI provides
   * none for now). Like `matte`, NOT driven from a time-boxed hook: a shell
   * surfaces it as an explicit, cancellable, progress-bearing action. Runs
   * locally; pixels never leave the device.
   */
  ocr?: OcrAPI;

  /**
   * Speech synthesis - text in, spoken PCM plus word timings out (on-device
   * Kokoro TTS).
   *
   * The dual of `audio`: where `analyse` turns a finished clip into numbers a
   * tool can draw, `synthesize` turns a tool's own text into a clip - mono PCM
   * a shell can play, mix under a video export, or hand straight back to
   * `audio.analyse`. The word timings are what a caption or karaoke-highlight
   * tool keys off, so they ride in the same result rather than needing a
   * second alignment pass.
   *
   * DOM-free CONTRACT, exactly like `audio`: a string in, plain typed arrays
   * out. The SHELL owns the model runtime and the (one-time, consented - see
   * `modelBytes`) weight download; the engine only ever sees Float32 samples
   * and plain timing objects.
   *
   * Optional/additive (v1.96) and NOT gated by a `capabilities` flag - a tool
   * feature-detects `host.speech` and hides its voiceover affordance where it
   * is absent (the headless CLI provides none for now). Runs locally; text is
   * never uploaded.
   */
  speech?: SpeechAPI;

  /**
   * MilkDrop visualisation - availability and attribution, and deliberately
   * nothing else. A tool is data: it has no element to hand over and no business
   * holding a GL context, so it renders a `[data-lolly-viz]` placeholder carrying
   * its parameters and the shell owns the canvas behind it (the same contract
   * `[data-lottie-src]` already uses - which is what lets the context and its
   * loaded preset survive the innerHTML rebuild every keystroke causes).
   *
   * Optional/additive (v1.72) and NOT gated by a `capabilities` flag - a shell
   * without this, or without WebGL2, means the tool draws its ordinary canvas
   * style, never that it refuses to render.
   */
  viz?: VizAPI;

  /**
   * Perceptual colour tools - extrapolate from brand primitives without
   * shipping colour science in every tool: ΔEOK distance, APCA + WCAG
   * contrast, OKLab ramps, data class-breaks, and distinct categorical
   * palettes (see engine/src/color-tools.ts, the chroma.js-evaluation port).
   * Pure math, so every method is SYNCHRONOUS and identical across shells -
   * shells attach the engine's `makeColorApi()` rather than implementing
   * anything. Optional/additive (v1.40): a tool feature-detects `host.color`
   * and keeps a small fallback (older shells lack it); not gated by a
   * `capabilities` flag.
   */
  color?: ColorAPI;

  /**
   * Image decode / resize / re-encode - on-device conversion (HEIC → JPEG,
   * compress-to-WebP, downscale) as a first-class capability instead of
   * upload-pipeline plumbing. DOM-free CONTRACT: encoded bytes (or a Blob) in,
   * encoded bytes + dimensions out - the shell owns the decoder/encoder (WASM,
   * canvas, native codecs); the engine never sees a canvas or an <img>.
   * Optional/additive like pdf/pptx (v1.60) and not gated by a `capabilities`
   * flag: a tool feature-detects `host.images` and degrades where it's absent.
   * Runs locally; the bytes are never uploaded.
   */
  images?: ImagesAPI;

  /**
   * Raster primitives for tool hooks that do their own canvas pixel work - a
   * realm-correct capability probe, decode a source to a drawable bitmap,
   * measure it, and encode finished pixels back to bytes. The bridge home for
   * the `canRaster()`/`loadImage()` probes tool hooks used to open-code against
   * the DOM (`typeof document === 'undefined'`, `new Image`), which are WRONG
   * inside a Worker: `document` is absent there even where `OffscreenCanvas`
   * works. A tool asks the host, not the realm, so the same hook is correct on
   * the main thread and inside a Worker (plans/86-worker-isolation-hooks.md section 6.1).
   *
   * Distinct from `host.images`: that is the CONVERT path (encoded bytes in,
   * encoded bytes out, no pixel access) for the upload/export pipeline. This is
   * for tools that composite, sample or mutate pixels themselves (darkroom,
   * the filter-* family, the logo/lockup composers, redact) - so `decode`
   * returns a drawable `ImageBitmap` (valid on a main-thread `<canvas>` AND a
   * Worker `OffscreenCanvas`, unlike an `<img>`) and `encode` takes raw RGBA.
   * Building/drawing INTO a canvas is deliberately NOT here: `new
   * OffscreenCanvas(w, h)` is a realm global a hook constructs directly, so an
   * RPC round-trip would buy nothing. DOM-free CONTRACT - no `HTMLImageElement`
   * or `document` crosses this surface. Optional/additive (v1.105) and NOT gated
   * by a `capabilities` flag: a tool feature-detects `host.raster` (undefined on
   * the headless CLI/jsdom shell, which has no canvas) and degrades to its
   * existing placeholder, exactly as `host.images`/`host.color`/`host.geom` do.
   * Runs locally; the bytes are never uploaded.
   */
  raster?: RasterAPI;

  /**
   * Exact vector geometry - path booleans, offsetting, stroke outlining,
   * authored-spline lowering, simplification and hit testing (see
   * engine/src/geom/). SVG path data in, SVG path data out; nothing flattens,
   * samples or rasterises. Pure math, so every method is SYNCHRONOUS and
   * identical across shells - shells attach the engine's `makeGeomApi()` rather
   * than implementing anything, exactly like `color`. Optional/additive (v1.64)
   * and not gated by a `capabilities` flag: feature-detect `host.geom`.
   * Failures are RETURNED (`{ ok: false, code }`), never thrown - a tool is
   * never handed a plausible-looking wrong path.
   */
  geom?: GeomAPI;

  /**
   * Committed, export-safe connector / line / arrow geometry (v1.106; the path
   * decorations + dash fitting added v1.110). The engine's connector module behind a
   * tool-facing surface - every shell attaches `makeConnectorsApi()` verbatim, so
   * web / Tauri / CLI emit identical geometry: a canvas tool's hooks.js renders its
   * connectors in one line and a headless `--export` keeps them. Pure + synchronous,
   * like `color`/`geom`. Optional/additive and NOT gated by a `capabilities` flag:
   * feature-detect `host.connectors`.
   */
  connectors?: ConnectorsAPI;

  /**
   * Content Credentials signing - embed a FRESH signed C2PA manifest into
   * finished bytes, with NO ingredients and no ingredient thumbnails. This is
   * the redacted-derivative path: carrying the source's manifest forward would
   * re-embed a pixel-accurate thumbnail of the un-redacted original, so the
   * output is signed as a new work instead, and the caller says so in the UI.
   * Not a general provenance surface - ordinary exports keep going through
   * `host.export` (which owns ingredients, action history and the opt-in
   * gates). Optional/additive (v1.85) and not gated by a `capabilities` flag:
   * a tool feature-detects `host.c2pa?.sign`. Signing runs locally with the
   * enrolled device identity when one is valid, else an ephemeral on-device
   * key; the bytes are never uploaded.
   */
  c2pa?: C2paAPI;

  /** Logging - goes to console in dev, to a log buffer for support diagnostics. */
  log: (level: 'debug' | 'info' | 'warn' | 'error', msg: string, ctx?: object) => void;
}

// ─── Perceptual colour tools (optional, v1.40) ──────────────────────────────────

/**
 * All methods are pure and synchronous. Colour arguments accept hex
 * (`#rgb…#rrggbbaa`) or `oklch()`/`lch()` strings - the forms token values
 * take; metrics return NaN on unparseable input, `ramp` throws (an authoring
 * error). Every emitted colour is a gamut-mapped `#rrggbb`.
 */
/** A native-px rectangle carrying a connector endpoint (a box, or a 0×0 free point).
 *  Structurally identical to the engine's EdgeRect; kept as its own copy so
 *  @lolly-tools/core carries no dependency on @lolly/engine. */
export interface ConnectorRect { x: number; y: number; w: number; h: number }

/** Field names + per-field defaults an edge is read through, plus the wrapping `<svg>`
 *  size. Mirrors the engine's ConnectorRenderOpts exactly. */
export interface ConnectorRenderOpts {
  fromField?: string; toField?: string;
  styleField?: string; arrowField?: string; headField?: string;
  colorField?: string; dashField?: string; widthField?: string;
  /** v1.111 - per-END head shapes (an `AuthoredPath` box's `headStart`/`headEnd`). Naming
   *  either switches a row off the `arrow` + shared-`head` edge reading onto the path one,
   *  so a bound path and a legacy edge render through one builder. */
  headStartField?: string; headEndField?: string;
  /** v1.111 - an AUTHORED dash pattern (array, or a space/comma-separated string). Set →
   *  the shaft is drawn as real `<line>` dash segments fitted to the route's corners, and
   *  the `dash` keyword is not read for that row. */
  dashArrayField?: string;
  /** v1.111 - opt out of the corner FIT while keeping the authored pattern (default on). */
  dashFitField?: string;
  defaultStyle?: string; defaultArrow?: string; defaultHead?: string;
  defaultColor?: string; defaultWidth?: number;
  width: number; height: number;   // canvas size for the wrapping <svg> viewBox
  layerClass?: string;             // class on the <svg> (default 'lolly-connectors')
}

/** A head at the tip of an authored path (v1.110) - see {@link ConnectorsAPI.pathHeadSvg}.
 *  Structurally identical to the engine's PathHeadOpts; a copy, so @lolly-tools/core
 *  carries no dependency on @lolly/engine. */
export interface PathHeadOpts {
  tipX: number; tipY: number;
  /** Tangent at the tip in RADIANS, pointing OUT of the path - `Math.atan2(dy, dx)` of
   *  the last segment at an end head, of the REVERSED first segment at a start head. */
  angle: number;
  /** none · open · triangle · diamond · circle · bar (anything else draws a triangle). */
  head: string;
  color: string;
  /** The path's stroke width; the head size derives from it (`max(9, width × 4)`). */
  width: number;
}

/** A dash interval in absolute distance along a path, in native px (v1.110). */
export interface DashSegment { start: number; end: number }

/** Scale band for the per-span corner fit (v1.110). Outside it a span keeps the
 *  authored pattern unscaled. */
export interface DashFitOpts {
  /** Most the pattern may shrink, default 0.66 (clamped into (0, 1]). */
  minScale?: number;
  /** Most the pattern may grow, default 1.5 (clamped into [1, 16]). */
  maxScale?: number;
}

/**
 * Dash entry + Illustrator-style corner fitting (v1.110) - see
 * {@link ConnectorsAPI.dashFit}. Pure + synchronous.
 */
export interface DashFitAPI {
  /**
   * Parse a user-typed dash string (`"6 4"`, `"6,4,2,4"`) into a canonical, even-length
   * array of NUMBERS, or `null` when it is not one. At most 16 numbers, each 0…1000, at
   * least one above zero; an odd-length list is doubled (the SVG rule). Numbers only, by
   * contract: never put the user's raw text on `stroke-dasharray` - serialize THIS.
   */
  parse(text: string): number[] | null;
  /**
   * One explicit dash array covering the WHOLE path, with the pattern grown/shrunk
   * slightly per span so a dash lands centred on every corner (Illustrator's "align
   * dashes to corners and path ends"). `spanLengths` are the path's corner-to-corner run
   * lengths in order - include the closing span for a closed path. Even-length and
   * summing to exactly the path length, so the pattern never wraps.
   */
  cornerFitDashArray(spanLengths: number[], pattern: number[], opts?: DashFitOpts): number[];
  /**
   * The same fit as absolute `[start, end]` dash intervals along the path - for the
   * committed/export render, which draws real geometry and never `stroke-dasharray`.
   * Inked length agrees exactly with `cornerFitDashArray`'s dash entries.
   */
  dashSegments(spanLengths: number[], pattern: number[], opts?: DashFitOpts): DashSegment[];
}

/** Committed connector/line/arrow render (v1.106; path decorations + dash fit v1.110) -
 *  see {@link HostV1.connectors}. */
export interface ConnectorsAPI {
  /** Render the committed connector layer as an export-safe SVG string: every edge
   *  routed + decorated, wrapped in a canvas-sized `<svg>`. `rectById` maps a box id to
   *  its native rect; a free-point endpoint (`@x,y`) resolves without it. Pure + sync. */
  build(edges: Record<string, unknown>[], rectById: Map<string, ConnectorRect>, opts: ConnectorRenderOpts): string;
  /**
   * An arrowhead/decoration SVG fragment for ONE path tip (v1.110): the same shapes
   * `build` draws on a connector, addressed by tip + outward tangent, so a spline, a
   * line and a connector decorate identically. Baked coordinates, no transform, no
   * `<marker>` - it drops into any `<svg>` and survives the vector walkers.
   * Optional/additive: feature-detect it.
   */
  pathHeadSvg?(opts: PathHeadOpts): string;
  /** How far to pull the shaft back off `head` at stroke `width`, so a filled head is
   *  not stabbed through by its own line (v1.110). The pair for `pathHeadSvg`. */
  pathHeadInset?(head: string, width: number): number;
  /** Manual dash entry + corner-fit dash geometry (v1.110). Optional/additive. */
  dashFit?: DashFitAPI;
  /**
   * The route a BOUND path is drawn with, from its own spline kind (v1.111). A path box
   * with an endpoint attached to another box is a connector, and connector management
   * picks its route - `line`→straight (an authored polyline of 3+ nodes→elbow),
   * `spiro`→arc, every other kind→the smooth curved S. `override` is the box's explicit
   * `route` field and wins whenever it names one of `routeStyles`; that override is what
   * makes the plan-90 edge migration lossless (six kinds cannot name thirteen routes).
   * Pure; feature-detect it.
   */
  routeStyleForKind?(kind: string, override?: string, nodeCount?: number): string;
  /** The thirteen route styles `build` understands, in menu order (v1.111) - so a pack
   *  control and the editor offer one list rather than each spelling it out. */
  routeStyles?: string[];
}

export interface ColorAPI {
  /** ΔEOK - Euclidean distance in OKLab (0 identical … ≈1 black↔white; ~0.02 is a JND). */
  deltaE(a: string, b: string): number;
  /** APCA-W3 Lc, signed (advisory; |60| ≈ body text). WCAG 2.1 stays the compliance number. */
  apca(text: string, bg: string): number;
  /** WCAG 2.1 contrast ratio, 1–21 (order-independent). */
  contrast(a: string, b: string): number;
  /** `n` colours along a smooth OKLab bezier through `stops`; optional perceptually-even lightness steps. */
  ramp(stops: string[], n: number, opts?: { correctLightness?: boolean }): string[];
  /** `n + 1` class boundaries over data - 'e' equal, 'l' log₁₀ (positive data only), 'q' quantile. */
  breaks(data: number[], mode: 'e' | 'l' | 'q', n: number): number[];
  /** Up to `n` visually distinct categorical colours, seeded from a brand anchor. */
  distinct(n: number, opts?: { anchorHex?: string; minDeltaE?: number }): string[];
  /**
   * The ACCENT colours of a classic colour-harmony scheme, seeded from
   * `seedHex` (hex forms only - normalise oklch()/lch() first). The seed
   * itself is never returned (it is the scheme's 0° member), so a k-colour
   * scheme yields k−1 accents; each keeps the seed's OKLCH lightness/chroma
   * and rotates only the hue, emitted gamut-mapped. `kind` defaults to
   * 'complement'. An unparseable seed falls back to a neutral mid-blue rather
   * than throwing - the picker always has something to show (this is the
   * brand editor's generator, engine/src/brand-schemes.ts, attached).
   * Optional/additive (v1.60); feature-detect on older hosts.
   */
  schemes?(seedHex: string, kind?: ColorSchemeKind): ColorSchemeAccent[];
  /**
   * Interpolate between two colours the way CSS Color 4 does: in `opts.space`
   * (default `oklab`), with PREMULTIPLIED alpha, travelling the hue circle per
   * `opts.hue` (default `shorter`). Returns hex (8-digit when translucent), or
   * null if either colour is unreadable.
   *
   * Premultiplication is why this exists rather than a per-channel lerp: mixing
   * toward `transparent` unpremultiplied drags the colour toward transparent's
   * *black*, so a red→transparent midpoint comes out dark red at 50% instead of
   * plain red at 50%. Optional/additive (v1.68); feature-detect on older hosts.
   */
  mix?(a: string, b: string, t: number, opts?: ColorMixOptions): string | null;
  /**
   * A Lolly gradient spec string → a CSS gradient value (`linear-gradient(…)` /
   * `radial-gradient(…)` / `conic-gradient(…)`) ready for `background-image`, or
   * null if the spec can't be read.
   *
   * Spec grammar: `<kind>[.<space>[.<hue>]]_<angle>_<colour>-<pos>_…`, e.g.
   * `lin_90_30ba78-0_efefef-100`. The stops come back interpolated in the spec's
   * space and BAKED into plain sRGB stops - extra stops inserted only where sRGB
   * would visibly diverge - because an SVG `<linearGradient>` and a PDF axial
   * shading have no interpolation-space knob. So one value renders the same on
   * screen, in SVG and in PDF, and a tool never hand-rolls colour maths to get a
   * gradient that isn't muddy. Optional/additive (v1.68).
   */
  gradientCss?(spec: string): string | null;
  /**
   * The narrowest display gamut that can show this colour - `'srgb'`, `'p3'`,
   * `'rec2020'`, or `'none'` when nothing can. Accepts the same hex /
   * `oklch()` / `lch()` forms as the rest of this API.
   *
   * Use it to tell a user *why* a colour changed: `oklchToHex`-style mapping
   * silently reduces chroma, and "outside sRGB, fine on a modern display" is a
   * very different message from "no display can show this".
   * Optional/additive (v1.69); feature-detect on older hosts.
   */
  gamut?(color: string): ColorGamut;
  /**
   * The highest chroma that still fits `limit` (default `'srgb'`) at this
   * lightness (0–1, not the CSS percent) and hue (degrees).
   *
   * This is the real, hue-dependent ceiling - yellow carries far more chroma
   * than blue - so it beats a fixed maximum for building even ramps or
   * clamping a picker. Optional/additive (v1.69).
   */
  maxChroma?(l: number, h: number, limit?: Exclude<ColorGamut, 'none'>): number;
  /**
   * One 2D plane through OKLCH space as RGBA pixels, ready for
   * `new ImageData(data, width)` - the gamut charts on oklch.com, as a
   * primitive. Transparent outside `limit`; see {@link ColorSliceOptions} for
   * the axis convention.
   *
   * Pixels beyond sRGB come back gamut-mapped, because the buffer is 8-bit
   * sRGB - draw the boundary from `maxChroma` on top rather than trusting the
   * fill's colour out there. Optional/additive (v1.69).
   */
  slice?(opts: ColorSliceOptions): ColorSliceImage;
  /**
   * The in-gamut region of a slice plane, as closed rings in the plane's unit
   * square (x right, y DOWN) - multiply by a pixel box and you have an SVG
   * `clipPath` or a filled `<path>`.
   *
   * This is the vector counterpart to {@link ColorAPI.slice}: a raster surface
   * can leave the out-of-gamut area transparent, an SVG has to describe it. An
   * ARRAY of rings, because on the 'lh' plane the region breaks into islands
   * (see `plane` in {@link ColorSliceOptions}). Optional/additive (v1.69).
   */
  gamutRegion?(
    plane: ColorSlicePlane, fixed: number,
    limit?: Exclude<ColorGamut, 'none'>, steps?: number, cMax?: number,
  ): { x: number; y: number }[][];
  /**
   * A colour string → OKLCH (`l` 0–1, not the CSS percent; `h` in degrees), or
   * null if it can't be read. The inverse of {@link ColorAPI.fromOklch}.
   *
   * Without this a tool cannot get at the perceptual axes at all - `schemes()`
   * returns OKLCH for the accents it generates but never for the seed - so any
   * tool wanting to reason about lightness or chroma had to carry its own
   * matrices. Optional/additive (v1.69).
   */
  oklch?(color: string): { l: number; c: number; h: number; alpha?: number } | null;
  /**
   * OKLCH → hex, gamut-mapped into sRGB per CSS Color 4 section 14.2 (hue and
   * lightness preserved, chroma reduced - never a raw channel clip). 8-digit
   * when `alpha` is under 1. Optional/additive (v1.69).
   */
  fromOklch?(o: { l: number; c: number; h: number; alpha?: number }): string;
  /**
   * Invert {@link ColorAPI.apca}: at a fixed `hue`/`chroma`, the OKLCH lightness
   * whose forward APCA Lc against `bgHex` is closest to `|targetLc|`. Returns the
   * solved colour as gamut-mapped hex plus the signed Lc it ACTUALLY achieves.
   *
   * `apca` scores a pair; this is the other direction - "give me a tone of this
   * hue that reads at Lc 60 on this background" - the one move a contrast-first
   * ramp needs and that no forward call can do. Polarity is taken from the
   * background (dark text on a light bg, light on a dark one), never from the
   * sign of `targetLc`; a negative argument is the same request as its magnitude.
   *
   * `reachable` is false when the target magnitude is beyond what this hue/chroma
   * can carry against this background (e.g. past APCA's near-black ceiling) - then
   * `hex`/`lc` are the closest achievable, not a guess. Chroma is clamped into
   * `opts.limit`'s gamut (default `'srgb'`) at the solved lightness, so the colour
   * is real. Optional/additive (v1.107); feature-detect on older hosts.
   */
  solveApca?(hue: number, chroma: number, targetLc: number, bgHex: string, opts?: ColorApcaSolveOptions): ColorApcaSolveResult;
  /**
   * Read an ICC profile's bytes into a handle the three methods below take, or
   * null when the bytes are not a profile that can be evaluated.
   *
   * Until this existed, "will it print?" had no answer here: `gamut()` reports
   * the three DISPLAY gamuts, and a press is neither of them - a colour can sit
   * comfortably inside sRGB and still be unreachable in CMYK, which is exactly
   * the case a brand palette needs flagged before it goes to a printer. The
   * profile is the user's own file (the one their print shop sent), so nothing
   * about a press condition has to be guessed or hard-coded.
   *
   * `intent` defaults to `'relative'`, the intent a proof is normally judged
   * under. A profile that cannot be asked about gamut under that intent yields a
   * handle with `usable: false` rather than one silently answering from a
   * different intent's table - a wrong colour that looks right is worse than no
   * answer.
   *
   * Malformed bytes return null and never throw, however hostile.
   * Optional/additive (v1.70); feature-detect on older hosts.
   */
  iccProfile?(bytes: Uint8Array, intent?: ColorRenderingIntent): ColorProfileGamut | null;
  /**
   * Is this OKLCH colour reproducible on the device `profile` describes?
   * `l` is 0–1 (not the CSS percent), `h` in degrees.
   *
   * A soft-proofing answer, not a colorimetric one: it is decided by whether the
   * profile can round-trip the colour, so within a few ΔE of the gamut surface it
   * may be called either way, and a fully saturated process primary reads as
   * outside. Treat it as "flag this for review", not as a verdict.
   * False for a handle whose `usable` is false. Optional/additive (v1.70).
   */
  inProfileGamut?(profile: ColorProfileGamut, l: number, c: number, h: number): boolean;
  /**
   * The highest chroma this profile can reproduce at a given lightness and hue -
   * {@link ColorAPI.maxChroma}'s counterpart for a press rather than a display,
   * so a ramp can be built to what will actually print. 0 for an unusable
   * handle. Optional/additive (v1.70).
   */
  profileMaxChroma?(profile: ColorProfileGamut, l: number, h: number): number;
  /**
   * Total ink coverage for the colour, or null when the profile's space has no
   * ink (an RGB or a display profile).
   *
   * The unit is channels - 1.0 is one ink at full, so four-colour process can
   * reach 4.0, the trade's "400% TAC". Not normalised to 0–1, because a
   * pressroom's limit is written as a percentage of that total (300%, 340%) and
   * dividing by the channel count would throw away the only figure a printer
   * would recognise. Optional/additive (v1.70).
   */
  inkCoverage?(profile: ColorProfileGamut, l: number, c: number, h: number): number | null;
  /**
   * Serialise a flat list of named swatches as a design-interchange TEXT file -
   * a DTCG design-tokens JSON (`'tokens-json'`, nested by each swatch's dotted
   * key), a plain CSS custom-properties block (`'css-vars'`), a set of bg/text/
   * border utility classes (`'css-classes'`), an SCSS `$var` block (`'scss'`), or
   * a GIMP `.gpl` palette (`'gpl'`). Swatches whose `hex` is empty or an
   * unresolved alias are dropped; `opts.paletteName` names the `.gpl` header.
   *
   * The same serializers the web shell's Swatches download uses, so a palette a
   * tool exports and one the brand editor downloads are byte-identical. Pure +
   * synchronous. The binary Adobe `.ase` is {@link ColorAPI.paletteExportBytes}
   * (bytes, not text). Optional/additive (v1.108); feature-detect on older hosts.
   */
  paletteExport?(swatches: ColorPaletteSwatch[], format: ColorPaletteTextFormat, opts?: { paletteName?: string }): string;
  /**
   * The binary counterpart to {@link ColorAPI.paletteExport}: the same swatch list
   * as an Adobe Swatch Exchange (`.ase`) file - RGB colour-entry blocks readable by
   * Illustrator, Photoshop and Affinity. `format` is `'ase'` (the one binary
   * palette format), taken for symmetry with the text call and forward room.
   * Optional/additive (v1.108); feature-detect on older hosts.
   */
  paletteExportBytes?(swatches: ColorPaletteSwatch[], format: 'ase'): Uint8Array;
}

/**
 * A single swatch for {@link ColorAPI.paletteExport} / `paletteExportBytes`: a
 * canonical dotted key (slugged into CSS identifiers / JSON path segments and
 * nested for the tokens tree), a display name, a group label (prefixed onto the
 * .gpl / .ase entry names), and a resolved sRGB hex. A swatch whose `hex` is
 * empty or a non-hex value (an unresolved alias, `transparent`) is dropped by the
 * serializers. Mirrored locally - packages/core carries no engine dependency -
 * from the engine's `PaletteSwatch`.
 */
export interface ColorPaletteSwatch {
  key: string;
  name: string;
  group: string;
  hex: string;
}

/** The TEXT palette formats {@link ColorAPI.paletteExport} produces (the binary
 *  `.ase` goes through `paletteExportBytes`). */
export type ColorPaletteTextFormat = 'tokens-json' | 'css-vars' | 'css-classes' | 'scss' | 'gpl';

/**
 * Options for {@link ColorAPI.solveApca}. Mirrored locally (packages/core carries
 * no engine dependency) from the engine's `ApcaSolveOptions`.
 */
export interface ColorApcaSolveOptions {
  /** Gamut the solved chroma is clamped into (default `'srgb'`). */
  limit?: Exclude<ColorGamut, 'none'>;
  /** Lightness-scan resolution for locating the contrast maximum (default 512).
   *  Higher tightens the max on the unreachable path; the reachable path is exact
   *  by bisection regardless. */
  samples?: number;
}

/**
 * The result of {@link ColorAPI.solveApca}. Mirrored locally (packages/core carries
 * no engine dependency) from the engine's `ApcaSolveResult`.
 */
export interface ColorApcaSolveResult {
  /** Solved OKLCH lightness (0–1). */
  l: number;
  /** Chroma actually used at `l`, clamped into `limit`'s gamut (≤ the request). */
  chroma: number;
  /** The hue passed through, unchanged (normalised to 0–360). */
  hue: number;
  /** The solved colour, gamut-mapped hex. */
  hex: string;
  /** Signed forward APCA Lc this colour ACTUALLY achieves (positive dark-on-light,
   *  negative light-on-dark). */
  lc: number;
  /** Signed target: `|targetLc|` carrying the polarity forced by the background. */
  target: number;
  /** False when the target magnitude exceeds the most this hue/chroma can reach
   * against this background - then `hex`/`lc` are the closest achievable. */
  reachable: boolean;
}

/**
 * The four ICC rendering intents. Which one a profile is asked under changes the
 * answer, so it is fixed when the handle is made rather than passed per query.
 */
export type ColorRenderingIntent = 'perceptual' | 'relative' | 'saturation' | 'absolute';

/**
 * A parsed ICC profile, as a handle plus what is worth showing a user about it.
 *
 * Opaque by design: the tables themselves stay in the host, and a tool passes
 * this object back to `inProfileGamut` / `profileMaxChroma` / `inkCoverage`.
 * An object a tool built itself is not a handle and gets the no-answer result
 * (false / 0 / null), never a plausible wrong one.
 */
export interface ColorProfileGamut {
  /** Stable identity, derived from the profile's own bytes + intent. Safe as a
   *  cache key; a tool caching by anything else keys on nothing. */
  readonly id: string;
  /** Human label, e.g. 'Coated FOGRA39 (relative)'. */
  readonly label: string;
  /** ICC device class: 'prtr' (printer), 'mntr' (display), 'scnr', … */
  readonly deviceClass: string;
  /** ICC data colour space: 'CMYK', 'RGB', 'GRAY', … */
  readonly colourSpace: string;
  /** Device channel count - 4 for process CMYK. */
  readonly channels: number;
  /** The intent this handle answers under. */
  readonly intent: ColorRenderingIntent;
  /** ICC spec version the profile declares, e.g. '2.2.0' or '4.3.0'. */
  readonly version: string;
  /** False when this profile cannot answer a gamut question under `intent` - no
   *  table for it, no reverse transform to test membership with, or an abstract
   *  transform with no device gamut at all. Every query then returns its
   *  no-answer value. Check this before drawing a chart of nothing. */
  readonly usable: boolean;
}

/** Display gamuts, narrowest first; `'none'` is outside even Rec.2020. */
export type ColorGamut = 'srgb' | 'p3' | 'rec2020' | 'none';

/**
 * Which plane {@link ColorAPI.slice} paints. In every name the FIRST letter is
 * the vertical axis and the SECOND is the horizontal one:
 *
 * 'lc' - lightness (y, 1 at the top) × chroma (x, 0 at the left), at a fixed hue
 * 'ch' - chroma (y, 0 at the bottom) × hue (x, 0–360°), at a fixed lightness
 * 'lh' - lightness (y, 1 at the top) × hue (x, 0–360°), at a fixed chroma
 */
export type ColorSlicePlane = 'lc' | 'ch' | 'lh';

export interface ColorSliceOptions {
  plane: ColorSlicePlane;
  /** The third channel: hue° for 'lc', lightness 0–1 for 'ch', chroma for 'lh'. */
  fixed: number;
  width: number;
  height: number;
  /** Ceiling of the chroma axis. Default 0.4. */
  cMax?: number;
  /** Paint nothing beyond this gamut. Default 'rec2020'. */
  limit?: Exclude<ColorGamut, 'none'>;
}

export interface ColorSliceImage {
  /** RGBA bytes, row-major from the TOP row. */
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

/** Options for {@link ColorAPI.mix} (mirrors CSS Color 4 section 12–13). */
export interface ColorMixOptions {
  /** Interpolation space. Default `oklab`; `srgb` models a plain CSS gradient. */
  space?: ColorInterpolationSpace;
  /** Hue travel for a polar space. Default `shorter`. */
  hue?: ColorHueDirection;
}

/** The interpolation spaces `mix()` and a gradient spec accept. */
export type ColorInterpolationSpace =
  | 'oklab' | 'oklch' | 'lab' | 'lch' | 'srgb' | 'srgb-linear' | 'hsl';

/** How to travel around the hue circle between two polar colours. */
export type ColorHueDirection = 'shorter' | 'longer' | 'increasing' | 'decreasing';

/** The harmony schemes `schemes()` accepts (mirrors engine brand-schemes.ts -
 *  the numeral is the scheme's TOTAL colour count, seed included). */
export type ColorSchemeKind =
  | 'complement' | 'adjacent-3' | 'triad-3' | 'tetrad-4'
  | 'free-2' | 'free-3' | 'free-4';

/** One generated harmony accent: its gamut-mapped sRGB hex, the OKLCH it was
 * emitted from, and the normalised hue (degrees, [0,360) - same as `oklch.h`,
 *  surfaced for callers that sort/group swatches by hue). */
export interface ColorSchemeAccent {
  hex: string;
  oklch: { l: number; c: number; h: number };
  hue: number;
}

// ─── Vector geometry (optional, v1.64) ───────────────────────────────────────

/**
 * Exact Bézier geometry - booleans, offsetting, stroke outlining, authored-spline
 * lowering, simplification and hit testing. The engine's geometry kernel
 * (engine/src/geom/) behind a tool-facing surface, attached verbatim by every
 * shell (`host.geom = makeGeomApi()`), so web / Tauri / CLI can never drift.
 * Pure math: DOM-free, synchronous, no platform dependency - the same shape as
 * `host.color`. Optional/additive and NOT gated by a `capabilities` flag: a tool
 * feature-detects `host.geom` and degrades where it's absent (or raises its
 * manifest `engineVersion` floor to `">=1.64"` if it genuinely cannot).
 *
 * ## The currency is SVG path data
 *
 * Every path in and out of this API is a path-data **string** - the form a tool
 * already puts in a template, stores in state and packs into a URL. Nothing here
 * asks a tool to build flat control-point tuples. `parse` / `toPathData` expose
 * the structured form (whole cubics, 8 numbers each) for callers that want to
 * walk or edit the curves themselves; `d` in, `d` out is the normal path.
 *
 * ## Errors are RETURNED, not thrown
 *
 * Every method returns a discriminated result: `{ ok: true, … }` or
 * `{ ok: false, code, message }`. Two reasons, both about what a tool can do
 * with the answer:
 *
 * - Invalid path data is *ordinary* input here, not an exceptional condition. A
 *   `d` string can arrive from a paste, a URL param or a half-finished pen drag,
 *   and "that isn't a path" is a state the tool must render something for.
 * - A throw from `onInit`/`onInput` is caught and LOGGED by the runtime, then
 * discarded - the tool's inputs simply don't update and the user sees nothing.
 *   A pen tool that silently stopped responding mid-drag is the worst possible
 *   failure mode, so failure is made a value the hook has to look at.
 *
 * `code` keeps the distinctions the kernel makes; it never collapses them:
 *
 * - `'invalid-path'` - the path data is malformed (bad command, wrong argument
 *   count, unparseable number, a non-finite or absurd coordinate). Your input
 *   was wrong. Reject it; do not retry.
 * - `'too-large'` - well-formed but past the parse ceilings (see `limits()`):
 *   too many characters, commands or curves. Retryable with a smaller path.
 * - `'limit'` - the *operation* could not be answered within bounded work (the
 *   kernel's `GeomLimitError`). The input was fine and the answer exists; this
 *   engine declines to guess at it. Retryable with simpler operands, a coarser
 *   `tolerance`, or fewer paths at once.
 * - `'invalid-argument'` - a non-path argument is wrong (a NaN distance, an
 *   unknown join style, one path where two were needed).
 * - `'unsupported'` - a declared-but-unimplemented feature, e.g. a `spline`
 *   `kind` the running engine knows the name of but cannot lower yet.
 * - `'internal'` - an unexpected engine failure. A bug; report it.
 *
 * What no code means: a silently-wrong path. There is no degraded fallback
 * anywhere in this API - every method either returns geometry it stands behind
 * or tells you it didn't.
 */
export interface GeomAPI {
  // ── boolean operations ──────────────────────────────────────────────────────
  /** Union of two or more paths - everything any operand covers. */
  union(paths: string[], opts?: GeomBooleanOpts): GeomPathResult;
  /** Intersection of two or more paths - only what EVERY operand covers, folded
   *  left to right. */
  intersect(paths: string[], opts?: GeomBooleanOpts): GeomPathResult;
  /** The first path minus every later one (`paths[0] − paths[1] − …`). */
  difference(paths: string[], opts?: GeomBooleanOpts): GeomPathResult;
  /** Symmetric difference - covered by an odd number of operands. */
  xor(paths: string[], opts?: GeomBooleanOpts): GeomPathResult;
  /**
   * Canonical form of ONE path: self-intersections resolved, contours oriented
   * so holes wind opposite their shell, overlaps merged. What a pen tool should
   * run on a freshly-closed path before filling it, and the only boolean that
   * never reports `'limit'`.
   */
  selfUnion(d: string, opts?: GeomBooleanOpts): GeomPathResult;

  // ── offset / stroke ─────────────────────────────────────────────────────────
  /**
   * Grow (`distance > 0`) or shrink (`distance < 0`) a path. Closed contours
   * offset outward/inward; an open contour yields the one-sided offset, positive
   * to the left of travel. An inward offset past the shape's inradius correctly
   * returns an EMPTY path (`ok: true`, `d: ''`), not the input.
   */
  offset(d: string, distance: number, opts?: GeomOffsetOpts): GeomPathResult;
  /**
   * The outline of `d` stroked at `width`, as a path that FILLS to the same
   * region under the nonzero rule - a real `<path fill>`, no `stroke` attribute.
   * Defaults match SVG's (`butt` cap, `miter` join, miter limit 4) so the
   * outline reproduces what a renderer would have painted.
   */
  stroke(d: string, width: number, opts?: GeomStrokeOpts): GeomPathResult;

  // ── authored splines (the pen tool's own form) ───────────────────────────────
  /**
   * Lower an authored node list to path data. `kind` is a plain STRING that the
   * ENGINE validates, so a spline kind added in a later engine needs no bridge
   * change: pass it through and read the result - an engine that doesn't know it
   * answers `'invalid-argument'`, one that knows-but-can't answers
   * `'unsupported'`.
   */
  fromNodes(path: GeomAuthoredPath): GeomPathResult;
  /**
   * Re-apply a node's continuity constraint after ONE of its handles moved
   * (`'in'` or `'out'`) - the operation a pen tool performs on every handle
   * drag. Returns the corrected node; `'corner'` nodes come back untouched.
   */
  continuity(node: GeomNode, moved: 'in' | 'out'): GeomResult<GeomNode>;
  /**
   * An authored path - or SEVERAL, which is the general case - → ONE string that
   * is safe to store in an input value, a `blocks` sub-field and a share link.
   *
   * Several, because a `GeomAuthoredPath` holds exactly one `nodes` run and a
   * great many shapes are not one run: a boolean subtract punches a hole, an xor
   * of two rings is four loops. Pass the list and lower every member (`fillRule`
   * then does its job across them). A one-element list, and a bare path, encode
   * to the same bytes.
   *
   * The reason this is on the bridge rather than left to each caller: a pen
   * shape is persisted, so it is written by an editor (shell code), read by
   * `hooks.js` (tool code, which cannot import the engine) and asserted on by
   * tests. Three copies of a codec is three codecs that drift, and a drifted
   * one silently mis-renders every link already in the wild.
   *
   * The form is delimiter-safe by construction: every character is in
   * `encodeURIComponent`'s unreserved set except `~`, so it contains no `,` and
   * no `~` - the two separators of the compact blocks-URL format, which cannot
   * be escaped (`URLSearchParams` percent-decodes the query before the block
   * splitter runs). It therefore costs zero bytes to percent-encode and never
   * pushes a blocks input onto its JSON fallback. Treat it as opaque: it is
   * versioned, and only this API is entitled to read it.
   */
  encodeAuthored(path: GeomAuthoredPath | GeomAuthoredPath[]): GeomResult<string>;
  /**
   * The inverse. ALWAYS a list, of at least one path - a one-path value decodes
   * to a one-element array rather than to a bare path, so a caller can never
   * accidentally render the first contour of a shape and drop its holes.
   *
   * A value that is not an encoded authored path - empty, garbage, hand-edited,
   * or written by a NEWER format version - answers `'invalid-argument'` rather
   * than a partially-decoded path: half a shape would render as
   * confidently-wrong artwork. One well-formed but oversized (past the node
   * ceiling `limits().maxNodes` reports, counted across the whole value) answers
   * `'too-large'`, which is the same distinction every other method makes.
   */
  decodeAuthored(value: string): GeomResult<GeomAuthoredPath[]>;

  // ── simplify ────────────────────────────────────────────────────────────────
  /**
   * Fewer segments within `tolerance` (default 0.01 px), by curve fitting.
   * Returns the path UNCHANGED when a fit wouldn't actually be shorter.
   *
   * A deliberate decision about a FINISHED path, made for file size. Do not run
   * it between booleans: a boolean's output points lie exactly on its inputs,
   * and fitting moves them off, so a simplified path can no longer be combined
   * with the shapes it came from without accumulating error.
   */
  simplify(d: string, opts?: { tolerance?: number }): GeomPathResult;

  // ── measurement / hit testing ───────────────────────────────────────────────
  /** Tight bounding box - the curves' true extent, not their control hull.
   *  An empty path has no box, so `value` is `null`. */
  bounds(d: string): GeomResult<GeomBox | null>;
  /**
   * SIGNED area, exact (Green's theorem per cubic - nothing is sampled).
   * Positive means counter-clockwise in a y-up frame, which reads as clockwise
   * on screen in SVG's y-down one. Self-overlapping input gives the algebraic,
   * winding-weighted area; run `selfUnion` first for the FILLED area.
   */
  area(d: string): GeomResult<number>;
  /** Is the point inside the filled region, under `fillRule` (default
   *  `'nonzero'`)? Ray casting against the real curves. */
  contains(d: string, x: number, y: number, opts?: { fillRule?: GeomFillRule }): GeomResult<boolean>;
  /** Winding number at the point - how many times the path wraps it, signed.
   *  `contains` under the nonzero rule is `winding !== 0`. */
  winding(d: string, x: number, y: number): GeomResult<number>;
  /**
   * Nearest point ON the path to an arbitrary point, with the address that
   * located it - a pen tool's hit test, snap, and "insert a node here". The
   * point is computed from the curve, not sampled near it.
   */
  nearest(d: string, x: number, y: number): GeomResult<GeomNearest>;

  // ── structured form ─────────────────────────────────────────────────────────
  /**
   * Path data → whole cubics. Every shorthand is expanded and every curve type
   * normalised: H/V → lines, Q/T → cubics exactly, A → cubics by the SVG spec's
   * endpoint parameterisation (F.6.5), one per ≤90° sweep.
   */
  parse(d: string): GeomResult<GeomContour[]>;
  /** Whole cubics → path data. Straight pieces are written as `L`, not as a
   *  cubic with collinear controls. `decimals` defaults to 4. */
  toPathData(contours: GeomContour[], opts?: { decimals?: number }): GeomPathResult;

  /** The parse ceilings this engine enforces, so a tool can check a path before
   *  offering an operation rather than after failing one. */
  limits(): GeomLimits;
}

export type GeomFillRule = 'nonzero' | 'evenodd';
export type GeomJoinStyle = 'miter' | 'round' | 'bevel';
export type GeomCapStyle = 'butt' | 'round' | 'square';

/** Why a geometry call couldn't answer - see the `GeomAPI` doc comment. */
export type GeomErrorCode =
  | 'invalid-path' | 'too-large' | 'limit' | 'invalid-argument' | 'unsupported' | 'internal';

export interface GeomFailure {
  ok: false;
  code: GeomErrorCode;
  /** Human-readable, safe to log; not intended for end-user display. */
  message: string;
}

/** A path-producing result. `d` is `''` for a legitimately empty region (an
 * intersection that doesn't overlap, an over-shrunk offset) - `ok: true` with
 *  no geometry is an ANSWER, not a failure. */
export type GeomPathResult =
  | { ok: true; d: string; contours: number; curves: number }
  | GeomFailure;

/** A value-producing result. */
export type GeomResult<T> = { ok: true; value: T } | GeomFailure;

export interface GeomBooleanOpts {
  /** Positional tolerance - how far apart two coordinates may be and still count
   *  as the same point. Default 1e-9-ish (the kernel's EPS). */
  tolerance?: number;
  /** How the OPERANDS' own interiors are read. It does not describe the result:
   *  a boolean's output never self-overlaps, so both rules read it identically. */
  fillRule?: GeomFillRule;
  /** Decimal places in the emitted path data (default 4). */
  decimals?: number;
}

export interface GeomOffsetOpts {
  /** Outer-corner treatment, default `'miter'`. */
  join?: GeomJoinStyle;
  /** Miter spike ratio past which a miter becomes a bevel, default 4 (SVG's). */
  miterLimit?: number;
  /** How closely the offset curves must follow the TRUE offset, in px. Default
   * 0.01 - finer than any raster device resolves. A fitting error, not a
   *  positional tolerance. */
  tolerance?: number;
  decimals?: number;
}

export interface GeomStrokeOpts extends GeomOffsetOpts {
  /** Open-end treatment, default `'butt'`. */
  cap?: GeomCapStyle;
}

/** One contour: whole cubics, each `[x0,y0, x1,y1, x2,y2, x3,y3]`, consecutive
 *  curves sharing endpoints. `closed` means the last curve's endpoint joins the
 * first's start - the closing straight edge is implicit and not stored. */
export interface GeomContour {
  curves: number[][];
  closed: boolean;
}

export interface GeomBox { x0: number; y0: number; x1: number; y1: number }

export interface GeomNearest {
  /** The point on the path. */
  x: number;
  y: number;
  /** Distance from the queried point (always ≥ 0 - unsigned; use `contains` for
   *  which side). */
  distance: number;
  /** Index of the contour it landed on, and of the curve within that contour. */
  contour: number;
  curve: number;
  /** Bézier parameter on that curve, 0…1 - where to split for a new node. */
  t: number;
}

/** How a node's handles behave when one is dragged. Authoring intent: it cannot
 *  be recovered from the geometry afterwards, which is why the authored form is
 *  kept alongside the lowered path. */
export type GeomContinuity = 'corner' | 'smooth' | 'symmetric';

/** One authored on-curve point. Handles are OFFSETS from the point, not absolute
 *  coordinates, so moving a node moves its handles with it. */
export interface GeomNode {
  x: number;
  y: number;
  /** Incoming handle offset (towards the previous node). */
  hInX?: number;
  hInY?: number;
  /** Outgoing handle offset (towards the next node). */
  hOutX?: number;
  hOutY?: number;
  continuity?: GeomContinuity;
}

export interface GeomAuthoredPath {
  /**
   * The spline family. A STRING, not a union, on purpose: the engine owns the
   * list and validates it, so a kind added in a later engine version reaches it
   * through an unchanged bridge. Known at v1.64: `'cubic'` (explicit handles -
   * the ordinary pen path), `'line'`, `'catmull-rom'`, `'bspline'`,
   * `'hyperbezier'` (Levien's two-parameter curve - curvature-continuous from
   * nodes alone, and the pen tool's default), plus declared-not-implemented
   * kinds that answer `'unsupported'`.
   *
   * Two notes specific to `'hyperbezier'`, because they surprise pen-tool
   * authors: a node's `continuity` defaults to `'smooth'` here rather than
   * `'corner'` (a default that broke the spline would draw polylines), and an
   * authored handle pins the tangent DIRECTION only - the solve owns arm
   * length, since that is what it spends to make curvature continuous.
   */
  kind: string;
  nodes: GeomNode[];
  closed: boolean;
  /** Catmull-Rom only: 0 uniform, 0.5 centripetal (default), 1 chordal. */
  tension?: number;
  decimals?: number;
}

/** The parse ceilings. Untrusted path data (a paste, a URL param, an imported
 *  SVG) is the normal case, so parsing is bounded rather than trusted: past any
 *  of these a call returns `'too-large'` instead of working for a long time. */
export interface GeomLimits {
  /** Characters in one `d` string. */
  maxChars: number;
  /** Path commands in one `d` string. */
  maxCommands: number;
  /** Cubics after normalisation (arcs expand to up to 4 each). */
  maxCurves: number;
  /** Largest absolute coordinate accepted. Bigger is not a bigger drawing, it is
   *  a corrupt number: past this a call returns `'invalid-path'`, because the
   *  arithmetic downstream of it overflows to Infinity. */
  maxCoordinate: number;
  /** Operand paths one boolean call may take. */
  maxPaths: number;
  /** Nodes in one `fromNodes` call. */
  maxNodes: number;
}

// ─── Images (optional, v1.60) ────────────────────────────────────────────────

/**
 * On-device image transforms. Every method accepts raw encoded bytes or a Blob
 * (the two forms user files arrive in - InputFile.bytes, picker Blobs) and
 * resolves to plain bytes + dimensions, so the contract stays DOM-free.
 * Decode-bomb guards, EXIF-orientation baking, and per-format support are the
 * SHELL's responsibility - read the RESULT's mime/width/height rather than
 * assuming a request was honoured exactly (a shell may fall back, e.g. PNG
 * where WebP encoding is unsupported).
 */
export interface ImagesAPI {
  /**
   * Decode enough of the image to report its pixel dimensions and detected
   * MIME type (sniffed from the bytes, never from a filename). Dimensions are
   * the ORIENTED ones (EXIF rotation applied), matching what resize/encode
   * produce. Rejects when the bytes are not a decodable image on this shell.
   */
  decode(input: Uint8Array | Blob): Promise<ImageInfo>;

  /**
   * Downscale the image (aspect preserved; never upscales) and return it
   * re-encoded. `maxEdge` caps the longest edge; explicit `width`/`height`
   * fit the image WITHIN that box. Output format defaults per the shell
   * (typically the source format where re-encodable) - pass `format` to pin
   * it. An animated source flattens to its first frame.
   */
  resize(input: Uint8Array | Blob, opts: ImageResizeOpts): Promise<ImageResult>;

  /**
   * Re-encode the image into `format` at its full (oriented) size - the
   * convert path: HEIC → JPEG, PNG → WebP, … `quality` applies to the lossy
   * formats. An animated source flattens to its first frame.
   */
  encode(input: Uint8Array | Blob, opts: ImageEncodeOpts): Promise<ImageResult>;
}

export interface ImageInfo {
  /** Oriented pixel width (EXIF rotation applied). */
  width: number;
  /** Oriented pixel height. */
  height: number;
  /** MIME type sniffed from the bytes, e.g. 'image/heic'. */
  mime: string;
  /** True for an animated container (GIF/APNG/animated WebP) - a resize/encode
   *  flattens it to a still. Absent when the shell can't tell. */
  animated?: boolean;
}

/** Encodings host.images can emit. Deliberately narrower than what it can
 *  READ (HEIC/AVIF/TIFF decode in, but only web-safe formats out). */
export type ImageEncodeFormat = 'webp' | 'jpeg' | 'png';

export interface ImageResizeOpts {
  /** Longest-edge cap in px (aspect preserved). */
  maxEdge?: number;
  /** Fit-within target width in px. */
  width?: number;
  /** Fit-within target height in px. */
  height?: number;
  /** Output encoding; defaults per the shell (see resize()). */
  format?: ImageEncodeFormat;
  /** Quality 0..1 for the lossy formats. Ignored for PNG. */
  quality?: number;
}

export interface ImageEncodeOpts {
  /** Target encoding. */
  format: ImageEncodeFormat;
  /** Quality 0..1 for the lossy formats. Ignored for PNG. */
  quality?: number;
}

/** An encoded transform result - the mime/dimensions of `bytes`, which may
 *  differ from the request (shell fallbacks; never-upscale clamping). */
export interface ImageResult {
  /** The encoded image. */
  bytes: Uint8Array;
  /** MIME type of `bytes`. */
  mime: string;
  /** Output pixel width. */
  width: number;
  /** Output pixel height. */
  height: number;
}

// ─── Raster primitives (optional, v1.105) ────────────────────────────────────

/**
 * On-device raster access for tool hooks - see the `raster?` field on HostV1
 * for what this is and why it is separate from `host.images`. Every source it
 * accepts and every value it returns is realm-portable (bytes, Blob, URL,
 * AssetRef, ImageBitmap, RGBA frame); no `HTMLImageElement` and no `document`
 * appear anywhere, so a hook written against it is unchanged when it moves from
 * `new Function` closure-scope injection into a Worker.
 */
export interface RasterAPI {
  /**
   * Realm-correct, SYNCHRONOUS capability probe: can THIS realm rasterise (a 2D
   * canvas context + `createImageBitmap` available)? True on the main thread and
   * inside a Worker with `OffscreenCanvas`; the single honest replacement for
   * every hand-rolled `typeof document === 'undefined'` guard, which reports
   * false in a Worker even where rastering works fine. Synchronous so a hook can
   * branch on it before deciding what to render (like `host.viz.isAvailable`),
   * which is why it is attached eagerly and cannot hide behind a Promise.
   */
  canRaster(): boolean;

  /**
   * Decode enough of `src` to report its ORIENTED pixel dimensions (EXIF
   * rotation applied, matching `decode`) and sniffed MIME. Rejects when `src`
   * can't be read here. Reuses the `ImageInfo` shape `host.images.decode`
   * already returns.
   */
  measure(src: RasterSource): Promise<ImageInfo>;

  /**
   * Decode `src` to a drawable `ImageBitmap` - EXIF orientation baked in,
   * HEIC/AVIF handled via the shell's bundled fallback, SVG via the shell's
   * reliable `<img>` path (decoding an SVG blob directly is unreliable), all
   * behind a decode-bomb guard. Draw it with `ctx.drawImage(bitmap, …)` on a
   * locally-built canvas/OffscreenCanvas exactly where an `<img>` was drawn
   * before - the only call-site change is the object's type. `ImageBitmap` has
   * `width`/`height` (no `naturalWidth`), and the shipped consumers already read
   * `img.naturalWidth || img.width`, so they are unchanged. Call `.close()` when
   * done to release the backing store eagerly (optional; GC'd otherwise). Rejects
   * when `src` can't be read.
   */
  decode(src: RasterSource): Promise<ImageBitmap>;

  /**
   * Encode finished pixels to bytes - the sink side of every `toDataURL` /
   * `toBlob` / `convertToBlob` a hook used to call. Accepts EITHER an
   * `ImageBitmap` (the cheap path - a hook that only composited, no per-pixel
   * read-back) OR a `RasterFrame` of raw RGBA (a hook that pulled pixels via
   * `getImageData` to do its own maths; a live `MediaFrame` is structurally a
   * `RasterFrame` and passes straight through). Mirrors `host.images`'
   * `{ format, quality }` in / `{ bytes, mime, width, height }` out - read the
   * result's actual mime back, since an encoder may fall back (PNG where WebP is
   * unsupported).
   */
  encode(source: ImageBitmap | RasterFrame, opts: ImageEncodeOpts): Promise<ImageResult>;
}

/**
 * What `host.raster` can decode/measure: a fetchable URL (including a `blob:` or
 * `data:` one - the form every AssetRef.url in this app takes), an AssetRef
 * directly (so a hook need not unwrap `.url` itself), or raw encoded bytes / a
 * Blob (so a `file` input's in-memory upload is readable without being written
 * anywhere first). Mirrors `AudioSource`, with `Blob` for `host.images` parity.
 * A local `blob:`/`data:` URL needs no `network` capability.
 */
export type RasterSource = string | AssetRef | Uint8Array | Blob;

/**
 * Raw RGBA pixels - the DOM-free shape `getImageData`/`putImageData` deal in,
 * and the encode-input sibling of `MediaFrame` (minus the timestamp a finished
 * still has no use for). A `MediaFrame` value is structurally assignable here,
 * so an `onFrame` frame hands straight to `encode()`.
 */
export interface RasterFrame {
  width: number;
  height: number;
  /** Tightly-packed RGBA bytes, length width*height*4. */
  data: Uint8ClampedArray;
}

// ─── Audio analysis (optional, v1.71) ─────────────────────────────────────────

export interface AudioAPI {
  /**
   * Whether this shell can decode and analyse audio at all. Sync + cheap - a tool
   * uses it to decide whether to offer reactive styles or stay on a static
   * waveform. True does not promise any PARTICULAR file decodes: a container the
   * platform lacks a codec for still rejects at `analyse`.
   */
  isAvailable(): boolean;

  /**
   * Decode `src` and analyse it. Rejects when the bytes can't be fetched or the
   * platform has no codec for them - a tool should catch and fall back rather than
   * assume, since codec support genuinely differs (Safari and Chromium disagree
   * about Ogg; nothing but Chromium reads much of what a phone records).
   *
   * Costs one FFT per output frame, so it is linear in `fps × window` and
   * independent of `bands`. The shell decides where that runs (the web shell moves
   * it to a Worker); either way it is a single await, not a stream.
   */
  analyse(src: AudioSource, opts?: AudioAnalyseOpts): Promise<AudioAnalysis>;
}

/**
 * What can be analysed: a fetchable URL (including a `blob:` or `data:` one), a
 * catalog/user AssetRef, or raw encoded bytes - the last so a `file` input's
 * in-memory upload can be analysed without being written anywhere first.
 */
export type AudioSource = string | AssetRef | ArrayBuffer | Uint8Array;

export interface AudioAnalyseOpts {
  /** Frames per second of the analysis track. Default 30. Match the export fps. */
  fps?: number;
  /** Magnitude bins per frame, log-spaced across the audible range. Default 64. */
  bands?: number;
  /** Static waveform buckets (the classic peak-per-column overview). Default 128. */
  buckets?: number;
  /** In-point in seconds. Default 0. Clamped into the source rather than erroring. */
  start?: number;
  /** Window length in seconds from `start`. Default: to the end of the source. */
  window?: number;
  /**
   * Also emit raw time-domain windows of this many samples per frame (rounded UP to
   * a power of two, capped at 4096). Off by default because it is by far the largest
   * thing here - 1,024 samples × 3 channels × every frame - and only a caller that
   * feeds a sample-domain visualiser needs it. `1024` is what butterchurn wants: its
   * AudioProcessor is `numSamps = 512`, `fftSize = numSamps * 2`, and `updateAudio`
   * does a bare `.set()`, so a longer window throws RangeError inside the renderer
   * and stands the visualizer down over a black canvas with nothing logged near the
   * cause.
   */
  samples?: number;
}

/**
 * Per-frame reactivity, indexed by frame number.
 *
 * Struct-of-arrays, not an array of per-frame objects: a minute at 60fps is 3,600
 * frames, and a draw loop wants a few flat Float32Arrays it can index, not 3,600
 * allocations to chase. `magnitude` and the `wave*` arrays are `count` consecutive
 * rows of `bands` / `samples` entries - row i starts at `i * bands`.
 *
 * Everything is normalised 0..1 across the analysed window EXCEPT `peak`, which
 * stays absolute so a tool can still see that the source clipped. Normalising is
 * what lets a quiet voice memo and a mastered single both fill the frame;
 * `bass`/`mid`/`treb` share one scale between them, so they read as a balance
 * rather than each independently reaching 1.
 */
export interface AudioFrames {
  /** Number of frames. */
  count: number;
  /** Magnitude bins per frame (`magnitude` row length). */
  bands: number;
  /** Time-domain window length per frame, or 0 when `opts.samples` was not asked for. */
  samples: number;
  /** Frame time in seconds, relative to the analysed window's start. */
  t: Float32Array;
  /** Window RMS (loudness), 0..1 normalised. The value a VU-style bar tracks. */
  rms: Float32Array;
  /** Window peak amplitude, 0..1 ABSOLUTE (not normalised - 1 means it clipped). */
  peak: Float32Array;
  /** Energy below 320Hz, 0..1. Shares a scale with `mid`/`treb`. */
  bass: Float32Array;
  /** Energy 320Hz–2.8kHz, 0..1. */
  mid: Float32Array;
  /** Energy above 2.8kHz, 0..1. */
  treb: Float32Array;
  /** Spectral centroid ("brightness") as a 0..1 position across the audible range. */
  centroid: Float32Array;
  /** Positive spectral flux, 0..1 - onset strength. Peaks land on note attacks. */
  flux: Float32Array;
  /** `count` × `bands` log-spaced magnitudes, 0..1. */
  magnitude: Float32Array;
  /** `count` × `samples` mono time-domain bytes, 128 = silence. Empty unless asked for. */
  wave: Uint8Array;
  /** Left channel of the above; equals `wave` for a mono source. */
  waveL: Uint8Array;
  /** Right channel of the above; equals `wave` for a mono source. */
  waveR: Uint8Array;
}

export interface AudioAnalysis {
  /** Duration of the WHOLE source in seconds - not of the analysed window. */
  duration: number;
  /** Source sample rate in Hz. */
  sampleRate: number;
  /** Source channel count. */
  channels: number;
  /** The in-point actually analysed, in seconds (`opts.start` clamped). */
  start: number;
  /** The window length actually analysed, in seconds (`opts.window` clamped). */
  window: number;
  /** Frames per second of `frames` (`opts.fps` clamped to 1..120). */
  fps: number;
  /** `buckets` peak amplitudes over the window, 0..1 normalised - the overview waveform. */
  peaks: Float32Array;
  /** Per-frame reactivity. */
  frames: AudioFrames;
  /**
   * Estimated tempo, or **null** when the window holds too little rhythm to call
   * one. Null is a real answer and the common one for speech, ambience and pads -
   * a visual built on a wrong beat grid looks far worse than one built on none, so
   * this refuses rather than guesses. Never treat null as 120.
   */
  bpm: number | null;
  /** Beat times in seconds relative to `start`. Empty when `bpm` is null. */
  beats: Float32Array;
}

// ─── Speech synthesis (optional, v1.96) ───────────────────────────────────────

/** A voice the shell's model can speak in. */
export interface SpeechVoiceInfo {
  /** Stable voice id, the value `SpeechSynthesizeOpts.voice` takes. */
  id: string;
  /** Human-readable name for a picker. */
  name: string;
  /** BCP 47 language tag, e.g. 'en-US'. */
  lang: string;
  gender?: 'female' | 'male';
  /** Model-reported quality grade, where the model publishes one. */
  grade?: string;
}

/** One spoken word's span. Times are seconds, relative to the clip start. */
export interface SpeechWordTiming {
  text: string;
  start: number;
  end: number;
}

export interface SpeechResult {
  /** Mono samples. */
  pcm: Float32Array;
  /** Sample rate in Hz - 24000 for Kokoro. */
  sampleRate: number;
  /** Clip length in seconds. */
  duration: number;
  /**
   * Word spans for captioning. May be sentence-granular when the model only
   * aligns at sentence level; empty when no alignment is available at all -
   * check `granularity` rather than inferring it from span lengths.
   */
  words: SpeechWordTiming[];
  /** What one entry of `words` spans. */
  granularity: 'word' | 'sentence' | 'none';
}

/** Progress during the one-time model download or the synthesis itself. */
export interface SpeechProgress {
  phase: 'download' | 'synthesis';
  /** Bytes so far (download phase). */
  loaded?: number;
  /** Total bytes, or null when the transport doesn't say. */
  total?: number | null;
  /** 0..1 where a fraction is knowable. */
  fraction?: number;
}

export interface SpeechSynthesizeOpts {
  /** A `SpeechVoiceInfo.id`. The shell's default voice when omitted. */
  voice?: string;
  /** Speaking rate multiplier, 1 = the voice's natural pace. */
  speed?: number;
  /**
   * Abort a long synthesis: the promise rejects promptly (AbortError) and the
   * shell stops synthesizing at the next sentence boundary. Aborting during
   * the first-use model download also rejects promptly, but the download
   * itself is not cancelled - it completes in the background and is cached,
   * so the next request starts warm instead of re-downloading.
   */
  signal?: AbortSignal;
  onProgress?: (p: SpeechProgress) => void;
}

/** What on-device Whisper heard in a clip. */
export interface SpeechTranscript {
  /** The full transcription as one string. */
  text: string;
  /**
   * Timed spans for captioning - the same shape synthesis emits, so caption
   * plumbing built on `SpeechResult.words` reads a transcript unchanged.
   */
  words: SpeechWordTiming[];
  /** BCP 47 tag of the language the model detected (or was told). */
  lang: string;
  /** What one entry of `words` spans - check this, not span lengths. */
  granularity: 'word' | 'segment';
}

export interface SpeechTranscribeOpts {
  /** BCP 47 hint. The model auto-detects when omitted. */
  lang?: string;
  /** Abort a long transcription: the promise rejects promptly (AbortError). */
  signal?: AbortSignal;
  onProgress?: (p: SpeechProgress) => void;
}

export interface SpeechAPI {
  /**
   * Whether this shell can synthesise at all (possibly after a model download).
   * Sync feature-detect - a tool uses it to decide whether to offer a voiceover
   * affordance, before any bytes move.
   */
  isAvailable(): boolean;
  /** Are the model bytes already on-device? Never downloads. */
  cached(): Promise<boolean>;
  /** Approximate one-time download size in bytes, for a consent UI. */
  modelBytes(): number;
  voices(): Promise<SpeechVoiceInfo[]>;
  synthesize(text: string, opts?: SpeechSynthesizeOpts): Promise<SpeechResult>;

  /**
   * Transcription (v1.99) - audio in, text plus word timings out, via
   * on-device Whisper. Feature-detected like synthesis, not capability-gated:
   * audio never leaves the device, and the first use downloads the STT model
   * once (a separate download from the TTS model - gate it with its own
   * consent via `transcribeModelBytes`). Word timestamps feed the same
   * caption cues synthesis produces. The CLI omits transcription for now -
   * always check `transcribeAvailable()` first.
   */
  transcribeAvailable(): boolean;
  /** Are the STT model bytes already on-device? Never downloads. */
  transcribeCached(): Promise<boolean>;
  /** Approximate one-time STT download size in bytes, for a consent UI. */
  transcribeModelBytes(): number;
  transcribe(src: AudioSource, opts?: SpeechTranscribeOpts): Promise<SpeechTranscript>;
}

// ─── MilkDrop visualisation (optional, v1.72) ─────────────────────────────────

export interface VizAPI {
  /** Synchronous, so a hook can branch on it before deciding what to analyse. */
  isAvailable(): boolean;
  /** Ours first, then the artist pack (empty when it isn't staged in this build). */
  presets(): Promise<VizPresetInfo[]>;
}

/**
 * A preset the visualiser can run, with the attribution a credit line needs.
 * Artist presets are prefixed `stock:`.
 */
export interface VizPresetInfo {
  id: string;
  name: string;
  /**
   * Who authored it. Twenty years of MilkDrop craft ships alongside our own
   * presets, and a tool showing one is expected to say whose it is - so credit
   * only a preset the shell CONFIRMS it has: naming an artist whose work is not
   * on screen (a pack that isn't staged falls back to a brand-native preset) is
   * worse than crediting nobody.
   */
  author: string;
  /** Safe to offer under prefers-reduced-motion. */
  calm: boolean;
}

// ─── Device capture / recorder (optional) ───────────────────────────────────────

export interface RecorderAPI {
  /**
   * Whether device capture of the given kind is usable right now (a secure context
   * exposing getUserMedia + MediaRecorder; for 'screen', getDisplayMedia). Sync +
   * cheap, so a shell can decide whether to offer a "record" affordance. `kind`
   * defaults to 'audio'. A `true` here does not pre-grant permission - the prompt
   * happens on meter.start()/record()/still().
   */
  isAvailable(kind?: 'audio' | 'video' | 'screen'): boolean;

  /**
   * Live input-level meter, DOM-free - a pre-record "sound check". Prompts for the
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

  /**
   * Grab ONE still frame and resolve to its encoded bytes - a screenshot (v1.54).
   * Where record() opens a session that runs until stop(), this opens the source,
   * takes a single frame, and releases it immediately: the picker/permission is the
   * whole interaction, so there is nothing to stop() and no session to leak.
   *
   * `source: 'screen'` prompts the display picker (whole screen / a window / a tab -
   * the user's choice IS the selection, made by browser-native UI a page cannot
   * spoof or pre-answer) and is gated behind the `screen` capability. Rejects if the
   * user dismisses the picker (NotAllowedError) or the shell can't grab a frame.
   *
   * DOM-free like the rest of `recorder`: the shell owns the MediaStream and the
   * frame grab; the engine only ever receives the finished Blob.
   */
  still(opts?: StillOpts): Promise<Blob>;
}

export interface StillOpts {
  /**
   * What to photograph. 'screen' prompts the display picker; 'camera' takes a frame
   * from the camera. Default 'screen' - the camera path already has host.media.
   */
  source?: 'screen' | 'camera';
  /**
   * Encoded image type. Default 'image/png' - lossless, which is what a screenshot of
   * text and UI wants. A shell falls back to PNG where the type is unsupported, so read
   * the returned Blob's `type` rather than assuming.
   */
  type?: 'image/png' | 'image/jpeg' | 'image/webp';
  /** Quality 0..1 for the lossy types. Ignored for PNG. Default 0.97. */
  quality?: number;
  /** Downscale: longest edge in px. Omit for the source's native resolution (the default -
   *  a screenshot scaled down is a blurry screenshot). */
  maxEdge?: number;
  /** Provenance stamped into the finished Blob (best-effort, per format). */
  meta?: ExportMeta;
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
 * One audio-level sample - DOM-free, so the engine can hand it to a hook (the
 * audio counterpart to MediaFrame). All amplitudes are 0..1 linear except `dbfs`.
 */
export interface AudioLevel {
  /** Short-window RMS (loudness), 0..1 linear. The value a VU-style bar tracks. */
  rms: number;
  /** Instantaneous peak amplitude over the window, 0..1 linear. */
  peak: number;
  /** Peak in decibels-relative-to-full-scale: 20·log10(peak). 0 = clip, −∞ = silence. */
  dbfs: number;
  /** True while `peak` sits at/above the clipping threshold (~0.99) - drives a "too hot" warning. */
  clipping: boolean;
  /**
   * Estimated background-noise floor in dBFS - a slow min-hold of the loudness over a
   * few seconds (the level in the quiet gaps). −∞ = silence. Only trustworthy from a
   * RAW meter (the sound-check runs the mic with noiseSuppression/AGC OFF); a recording
   * session runs them ON for a clean file, so its floor reads artificially low.
   * Optional (added v1.19); undefined on shells that don't compute spectral levels.
   */
  noiseFloor?: number;
  /** Signal-to-noise ratio in dB = current RMS loudness − noiseFloor (like-with-like, both RMS). Low (≲15 dB) = noisy room. Optional (v1.19). */
  snr?: number;
  /** 0..1 share of energy in the mains bands (50/60 Hz + harmonics) - tonal electrical HUM / ground loop. Optional (v1.19). */
  hum?: number;
  /** 0..1 spectral flatness (geometric/arithmetic mean of the magnitude spectrum) - broadband HISS (fan/HVAC). Optional (v1.19). */
  hiss?: number;
  /**
   * 0..1 STEADINESS of the loudness envelope over ~1.5s - how constant the RMS is. ~1 =
   * a steady drone (a fan / AC / HVAC / broadband hiss holds a near-constant RMS); ~0 = a
   * modulated signal (speech, whose syllables make the RMS peak and dip). Lets coaching
   * tell background NOISE from SPEECH independent of level - a constant mid-level hiss no
   * longer reads as "speaking". Optional (v1.20). */
  steady?: number;
  /** Monotonic timestamp (ms) of the sample, matching MediaFrame.t. */
  t: number;
}

export interface RecordOpts {
  /**
   * Where the video track comes from (v1.54). 'device' = the camera (getUserMedia);
   * 'screen' = the display picker (getDisplayMedia - whole screen / a window / a tab,
   * chosen in browser-native UI), gated behind the `screen` capability. Default
   * 'device', so every pre-1.54 caller keeps its exact behaviour. Ignored when
   * `video` is false: there is no such thing as an audio-only screen.
   */
  source?: 'device' | 'screen';
  /** Capture the microphone. Default true. */
  audio?: boolean;
  /** Capture the camera (or, with source:'screen', the display) - an audio+video clip.
   *  Default false (audio-only). */
  video?: boolean;
  /**
   * Also capture the source's own audio - tab/system sound (v1.54). Only meaningful
   * with source:'screen'; the user grants it in the SAME picker as the video (there is
   * no separate prompt), and may withhold it, so the finished clip can be silent even
   * with this true. Mixed with the mic track when `audio` is also true, so a narrated
   * screen recording is one track. Ignored for source:'device'. Default false.
   *
   * Platform reality this cannot paper over: system-wide audio is Chromium-on-
   * Windows/ChromeOS only; elsewhere the user gets tab audio (Chromium) or nothing
   * (Safari/Firefox). Never promise the user sound you can't know you'll get.
   */
  systemAudio?: boolean;
  /**
   * Preferred container. The shell falls back across containers exactly like the
   * video-export path (a browser that can't encode the requested one uses what it
   * can), so this is a hint, not a guarantee - read the returned Blob's `type`.
   */
  format?: 'webm' | 'mp4';
  /** Video downscale: longest edge in px (mirrors MediaAPI subscribe maxEdge). Ignored for audio-only. */
  maxEdge?: number;
  /** Which camera to prefer for a video capture (v1.21). 'user' (front/selfie, default) or
   *  'environment' (rear). Ignored for audio-only and for source:'screen'; falls back to any
   *  camera if unavailable. */
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
  /** Discard the recording and release the devices - no Blob is produced. */
  cancel(): void;
  /**
   * Whether a microphone track was ACTUALLY acquired for this session (v1.54).
   * Distinguishes a granted mic from a requested-but-denied one: a screen recording
   * proceeds without the mic if the user blocks it, so `audio: true` in the request
   * does NOT prove a mic was captured. Callers use this to keep the provenance honest
   * (never stamp "with microphone narration" on a silent take) and to warn the user.
   * Known synchronously once record() resolves. Undefined on shells/paths that don't
   * report it - treat undefined as "unknown", not "no mic".
   */
  readonly micActive?: boolean;
}

// ─── Live media (optional) ─────────────────────────────────────────────────────

export interface MediaAPI {
  /**
   * Whether a camera is usable right now (a secure context exposing
   * getUserMedia). Sync + cheap - the shell uses it to decide whether to offer a
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
   * to the native camera frame (never upscales) and to its own ceiling, and - when
   * several tools are live - uses the largest requested edge. The runtime forwards a
   * tool's `render.liveMaxEdge` manifest hint here. A shell predating this opt simply
   * ignores it and keeps its default size.
   */
  subscribe(cb: (frame: MediaFrame) => void, opts?: { maxEdge?: number }): () => void;
}

/** One camera frame as raw RGBA pixels - DOM-free, so the engine can pass it to a hook. */
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
  | 'network' | 'filesystem' | 'clipboard' | 'camera' | 'microphone' | 'ffmpeg' | 'wasm' | 'capture' | 'compose'
  // 'screen' (v1.54) - display capture via host.recorder (getDisplayMedia). Distinct from
  // 'capture', which rasterises a URL the tool names; 'screen' photographs whatever the
  // USER picks from their own desktop, so it's the more sensitive of the two.
  | 'screen';

// ─── PDF (optional) ───────────────────────────────────────────────────────────

export interface PdfAPI {
  /**
   * Report the metadata a PDF carries (Info dictionary + XMP packet), for a
   * "what's hidden" view. Read-only; never mutates the input.
   */
  analyze(bytes: Uint8Array): Promise<{ findings: PdfFinding[] }>;

  /**
   * Re-save the PDF with its Info-dictionary entries and XMP packet removed.
   * Pages/content are preserved, but the document is re-serialised - the output
   * is not byte-identical, and any digital signature is invalidated.
   */
  strip(bytes: Uint8Array): Promise<{ bytes: Uint8Array }>;

  /**
   * Re-save the PDF smaller. Recompresses oversized embedded JPEG images
   * (downsample + re-encode on a canvas) and re-serialises with object streams;
   * text and vector graphics are left untouched. Like strip(), the output is NOT
   * byte-identical and any digital signature is invalidated. Runs locally - the
   * bytes are never uploaded. The result is guaranteed never larger than the input
   * (the original is returned unchanged when recompression wouldn't shrink it).
   * Image recompression needs a canvas (web/Tauri); a shell without one (the node
   * CLI) still applies the structural pass. Added after analyze/strip, so a tool
   * must feature-detect `host.pdf?.compress` - an older shell may lack it.
   */
  compress(bytes: Uint8Array, opts?: PdfCompressOpts): Promise<PdfCompressResult>;

  /**
   * Redact by rasterise-and-rebuild. Each page is rendered to an image, the
   * given bars are burned in as fully opaque fills, and a BRAND-NEW document is
   * constructed whose pages contain only those images at the original page
   * sizes - no text layer, fonts, annotations, attachments, layers, scripts or
   * metadata survive, because nothing is carried over. Bar coordinates are in
   * PDF points with y measured from the TOP of the page, and each bar names its
   * page by 1-based index. Like strip(), the output is not byte-identical and
   * any digital signature is invalidated; unlike strip(), the content under a
   * bar is destroyed, not hidden. Needs a real canvas, so shells without one
   * (the node CLI) omit it - a tool must feature-detect `host.pdf?.redact`
   * per method, exactly as for compress. Runs locally; the bytes are never
   * uploaded.
   */
  redact?(bytes: Uint8Array, opts: PdfRedactOpts): Promise<PdfRedactResult>;

  /**
   * Render each page to a self-contained SVG document, for interactive tools
   * that need a live preview to draw on (the Redact tool's bar overlay). Text
   * is outlined to real paths with fonts embedded as a safety net, so the SVG
   * renders identically with no document fonts installed. Each page's viewBox
   * is in PDF points with the origin at the TOP-LEFT - the same coordinate
   * space as PdfRedactBar, so an overlay measured against the rendered SVG
   * converts to bars with a single scale factor (widthPt / rendered width) and
   * no DPI involved. At most `maxPages` pages are returned (default 40), with
   * `truncated` reporting that more exist; a page that fails to render is
   * SKIPPED from `pages` rather than thrown, so one broken page cannot kill
   * the preview. Optional per method like redact: the web shell provides it
   * and the node CLI does not - a tool must feature-detect `host.pdf?.pages`.
   * Runs locally; the bytes are never uploaded.
   */
  pages?(bytes: Uint8Array, opts?: { maxPages?: number }): Promise<PdfPagesResult>;
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
  /** The compressed PDF - or the original bytes, if compression wouldn't shrink it. */
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

/** One redaction bar, in PDF points, y measured from the TOP of the page. */
export interface PdfRedactBar {
  /** 1-based page index the bar sits on. */
  page: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PdfRedactOpts {
  /** The bars to burn in. Bars on out-of-range pages are ignored. */
  bars: PdfRedactBar[];
  /** Raster resolution for the rebuilt pages. Default 200, clamped 72..300. */
  dpi?: number;
  /** Drop colour on the way out (e.g. a scan whose yellow channel carries printer tracking dots). */
  grayscale?: boolean;
  /**
   * Bar fill as a 6-digit hex (v1.90). Colour is security-neutral - any fully
   * opaque fill destroys the pixels underneath equally - so a caller may paint
   * its brand's own tone instead of black. Translucency is NOT neutral, so a
   * value carrying alpha below full opacity is REFUSED, as is anything
   * unreadable: the host falls back to its neutral near-black rather than
   * painting a bar the caller did not mean. Default: the neutral near-black.
   */
  color?: string;
  /**
   * Corner radius in PDF points (v1.90). The painted shape is INFLATED by the
   * radius before the corners are rounded, so the bar the caller asked for
   * stays entirely inside the opaque region - a rounded mark never leaves an
   * uncovered corner sliver. A corner whose sides had to clamp to the page edge
   * is painted square. Default 0 (square).
   */
  radius?: number;
  /**
   * A short label painted ON TOP of the finished bar (v1.90) - an attribution
   * stamp, e.g. the redacting person's or organisation's name. Safe because the
   * pixels beneath are already destroyed. The host never derives this text from
   * the document; it paints exactly what it is given, trimmed and clipped to
   * bars with room for it. Default: no label.
   */
  label?: string;
  /** Label colour as a 6-digit hex (v1.90), validated like `color`. Default white. */
  labelColor?: string;
}

export interface PdfRedactResult {
  /** The rebuilt document - page images only, nothing else. */
  bytes: Uint8Array;
  /** Page count of the output (same as the input's). */
  pages: number;
  /** Per-page render fallbacks (a page that could not be rendered ships blank). */
  warnings?: string[];
}

/** One page of a host.pdf.pages preview: a self-contained SVG document. */
export interface PdfPageSvg {
  /** Standalone SVG markup - text outlined, fonts embedded, images inlined. */
  svg: string;
  /** 1-based page index in the source document. */
  page: number;
  /** Page width in PDF points (the viewBox width). */
  widthPt: number;
  /** Page height in PDF points (the viewBox height). */
  heightPt: number;
}

export interface PdfPagesResult {
  /** Rendered pages in document order. A page that failed to render is absent. */
  pages: PdfPageSvg[];
  /** True when the document has more pages than the cap allowed to return. */
  truncated: boolean;
  /**
   * 1-based numbers of pages within the cap whose render failed (absent when
   * none did), so a caller can say which previews are missing instead of
   * letting a skipped page pass silently.
   */
  failed?: number[];
}

// ─── Content Credentials signing (optional, v1.85; widened v1.104) ────────────

export interface C2paSignOpts {
  /** Labels the primary edit step in the action history. */
  description?: string;
  /** dc:title for the manifest - usually the file's own name. */
  title?: string;
  /**
   * Asserted authorship → the manifest's dc:creator. A bare string is shorthand
   * for `{ name }`. This is how an artist claims their name over content they
   * already have digitised, before uploading it anywhere. `email`/`url` are the
   * licensing contact - both survive in the manifest and /verify shows them.
   */
  author?: { name: string; email?: string; url?: string } | string;
  /** © notice + licence, combined into one line → the manifest's dc:rights. */
  rights?: string;
  /**
   * Source manifests to PRESERVE as ingredients (relationship `parentOf`), so a
   * credential already inside the bytes - or a signed element within a container
   * (a C2PA raster embedded in a PDF/SVG, a signed track in an MP4) - survives
   * and is referenced rather than orphaned. Read them with the engine's
   * `extractC2paStore` / `prepareC2paIngredientFromStore` (and `extractC2paFromPdf`
   * for a document-level PDF manifest). When present the engine prepends a
   * `c2pa.opened` step per ingredient and the new claim reads as an edit of prior
   * work, so the history must NOT also claim `c2pa.created`.
   */
  ingredients?: IngredientCredential[];
  /**
   * What Lolly did to the bytes, for an honest action history:
   * • `'imported'` - content authored elsewhere; authorship/rights/metadata added
   *    here without re-rendering the essence (the any-media stamping path). The
   *    default whenever `author`, `rights`, or `ingredients` is supplied.
   * • `'redacted'` - a fresh derivative with content removed (the redact path):
   *    `c2pa.created` + a `c2pa.redacted` step. The default when none of the above
   *    are given, preserving the original v1.85 contract.
   */
  action?: 'imported' | 'redacted';
  /**
   * The caller applied the durable Lolly pixel imprint to the essence before
   * signing (raster only) - records an honest `c2pa.edited` watermark step.
   * Ignored on `'redacted'`.
   */
  imprinted?: boolean;
}

export interface C2paAPI {
  /**
   * Embed a freshly signed C2PA manifest into `bytes` and return the stamped
   * bytes. `format` is the output format key ('pdf', 'png', 'jpg', 'mp4', 'm4a',
   * …) - see the engine's `C2PA_FORMATS` for the full set. Two modes, chosen by
   * `opts` (see {@link C2paSignOpts}):
   *  • the default derivative path (v1.85): a redacted file, no ingredients; and
   *  • the any-media authorship path (v1.104): stamp an existing file with the
   *    artist's author/copyright/licence, carrying any manifests already inside
   *    it forward as ingredients so nested credentials are preserved, not lost.
   * Throws when the format cannot carry a manifest or signing fails - the caller
   * decides whether unsigned bytes may still ship.
   */
  sign(bytes: Uint8Array, format: string, opts?: C2paSignOpts): Promise<Uint8Array>;

  /**
   * Read EVERY C2PA manifest a file already carries and package each as an
   * ingredient ready to pass to `sign({ ingredients })` (v1.104). Collects the
   * file's own container-level credential - for any supported format (PDF, PNG,
   * JPEG, MP4, M4A, WebP, AVIF, TIFF, GIF, SVG, WebM, MP3, WAV) - plus the
   * element-level credentials nested inside a container (today: signed rasters an
   * SVG embeds via `<image href="data:…">`). This is how a tool that stamps an
   * authorship claim onto an EXISTING file preserves what is already inside it,
   * relationship `parentOf`, instead of orphaning it. Read-only; NEVER throws -
   * a file with nothing signed resolves to `[]`.
   */
  readIngredients(bytes: Uint8Array): Promise<IngredientCredential[]>;
}

// ─── PPTX (optional) ──────────────────────────────────────────────────────────

export interface PptxAPI {
  /**
   * Report what a deck carries - slide count, the read theme, and the distinct
   * literal colours + explicit typefaces found on slides - for a "what will
   * change" review UI. Read-only; never mutates the input, and NEVER throws:
   * bytes that aren't a readable .pptx resolve with `ok: false` (a picker feeds
   * arbitrary files here, so "not a deck" is an expected answer, not an error).
   * Pass the active brand's swatches/fonts in `opts` to get nearest-brand
   * `suggested` values per colour/font plus a ready-made `themeSuggestion`.
   */
  inspect(bytes: Uint8Array, opts?: PptxInspectOpts): Promise<PptxInspectResult>;

  /**
   * Produce a re-themed copy of the deck. Surgical: only the values the plan
   * names are rewritten (theme slots, literal colour remaps, explicit typeface
   * remaps, embedded-font stripping); every untouched part is byte-identical.
   * THROWS a friendly Error when the bytes are not a .pptx - by the time a
   * rebrand runs the tool has committed to the file, so failure is exceptional
   * (inspect() is the never-throwing probe). Runs locally.
   */
  rebrand(bytes: Uint8Array, plan?: PptxRebrandPlan): Promise<PptxRebrandResult>;
}

/** One brand colour offered as a rebrand target. */
export interface PptxBrandSwatch {
  /** Any common hex form; the host normalises. */
  hex: string;
  /** Display label, e.g. 'Jungle'. */
  name?: string;
  /** Role hint ('bg'/'ink'/'accent'/'neutral' families) - improves slot mapping. */
  role?: string;
}

/** The brand's font slots (family names as they should appear in the deck). */
export interface PptxBrandFonts {
  brand?: string;
  serif?: string;
  mono?: string;
}

export interface PptxInspectOpts {
  /** Brand swatches to suggest against. Non-empty ⇒ the result carries per-colour
   *  `suggested` values and a `themeSuggestion`. */
  swatches?: PptxBrandSwatch[];
  /** Brand fonts to suggest against (per-font `suggested` values). */
  fonts?: PptxBrandFonts;
}

/** One distinct literal colour found on the slides. */
export interface PptxInspectColor {
  /** The colour as found, normalised to `#RRGGBB`. */
  hex: string;
  /** Nearest brand swatch as `#RRGGBB` (present when opts.swatches given). */
  suggested?: string;
  /** True when the nearest match is a perceptual stretch - surface it for a human. */
  review?: boolean;
}

/**
 * What the slides are actually MADE of - the node kinds the reader found,
 * summed across every slide. Added in engine 1.79, so a tool must treat it as
 * optional: an older shell omits it entirely.
 *
 * The point of the counters is to tell a rebrandable deck from a flattened one.
 * A deck whose slides are nothing but `pictures` (a PDF or a set of exported
 * images dropped onto blank slides) carries no colour or typeface a rebrand can
 * reach: the theme swap still rewrites the theme part, but nothing on the slides
 * references it, so the visible result is identical to the input. A tool should
 * say so BEFORE the user spends a download on it.
 */
export interface PptxInspectContent {
  /** Picture nodes (embedded bitmaps/EMF/SVG) across all slides. */
  pictures: number;
  /** Text-bearing nodes. */
  texts: number;
  /** Shape nodes (a fill/line the rebrand can remap). */
  shapes: number;
  /** Table nodes. */
  tables: number;
  /** Nodes the reader could not classify (charts, SmartArt, OLE, …). */
  unknown: number;
}

/** One distinct explicit typeface found in the deck. */
export interface PptxInspectFont {
  family: string;
  /** Brand replacement family (present when opts.fonts given). */
  suggested?: string;
}

export interface PptxInspectResult {
  /** False when the bytes aren't a readable .pptx - every other field is then empty/zero. */
  ok: boolean;
  slideCount: number;
  /** The deck's read theme: clrScheme slot → `#RRGGBB`, plus the scheme faces. */
  theme: { colors: Record<string, string>; majorFont?: string; minorFont?: string };
  /**
   * Distinct LITERAL (non-scheme-linked) colours found on slides, in first-
   * appearance order, capped at 256. Scheme-linked colours are deliberately
   * absent: they follow the theme, so the theme swap rebrands them for free -
   * this list is exactly the residue a colorMap must handle.
   */
  colors: PptxInspectColor[];
  /** Distinct explicit typefaces incl. the theme major/minor, capped at 64. */
  fonts: PptxInspectFont[];
  /** Node-kind tally across the slides - how to spot a flattened, picture-only
   *  deck that a rebrand cannot visibly change. Added in 1.79; optional, so a
   *  tool must feature-detect it (an older shell omits it). */
  content?: PptxInspectContent;
  /** A ready-made theme plan from the brand swatches (present when opts.swatches
   * is non-empty). Colour slots are `#RRGGBB` - pass it to rebrand() as-is. */
  themeSuggestion?: PptxRebrandTheme;
}

/** A brand theme as flat values - the 12 clrScheme slots + the scheme faces.
 *  As plan input the colour slots accept `#RRGGBB` or any common hex form (the
 *  host/engine strip the hash and normalise on write); inspect's
 *  `themeSuggestion` always emits `#RRGGBB`. Any slot omitted is left as-is. */
export interface PptxRebrandTheme {
  dk1?: string; lt1?: string; dk2?: string; lt2?: string;
  accent1?: string; accent2?: string; accent3?: string;
  accent4?: string; accent5?: string; accent6?: string;
  hlink?: string; folHlink?: string;
  majorFont?: string; minorFont?: string;
}

export interface PptxRebrandPlan {
  /** Overwrite the given theme colour slots + scheme fonts in every theme part. */
  theme?: PptxRebrandTheme;
  /** Literal colour remap, `from -> to`. Keys accept any common hex form; the
   *  host normalises them to the engine's hexNorm form before matching. */
  colorMap?: Record<string, string>;
  /** Explicit-typeface remap, exact family name `from -> to`. */
  fontMap?: Record<string, string>;
  /** Remove all embedded-font machinery (list element, parts, rels, content type). */
  dropEmbeddedFonts?: boolean;
}

/** What the rebrand actually changed. */
export interface PptxRebrandReport {
  themesPatched: number;
  colorsRemapped: number;
  fontsRemapped: number;
  embeddedFontsStripped: number;
  /** Part paths of the slides whose bytes changed. */
  slidesTouched: string[];
}

export interface PptxRebrandResult {
  /** The re-themed deck, ready to download. */
  bytes: Uint8Array;
  report: PptxRebrandReport;
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
  /** Job title / role line - a `bindToProfile` target for signature, badge and
   *  card tools (which today take it as a per-tool input). Optional like every
   *  field here; a deployment with a directory/IdP may populate it centrally. */
  title?: string;
  /** Organisation / company line - the creator's org, used for shared-file
   *  provenance (the `.lolly` creator block, plans/114). Optional like every field
   *  here; on a control-plane instance the shell derives it from the instance name
   *  when unset. Gated by `useDetails` at the point it is embedded, same as name. */
  org?: string;
  /** "Use my details" opt-in - gates embedding author/contact into export
   *  provenance (see engine/src/metadata.ts). */
  useDetails?: boolean;
  /** True once the user has dismissed (or acted on) the gallery's first-visit
   * personalisation nudge - the one-time prompt to opt into `useDetails`. Rides
   *  the profile (not device storage) so the prompt is per-user, not per-device. */
  personalizeNudgeDismissed?: boolean;
  /** True once the user has dismissed (or acted on) the gallery's one-time
   * offline-downloads nudge - the prompt pointing at Profile → Available
   *  offline. Deliberately RE-CLEARED by the web shell when the PWA is
   *  installed (`appinstalled`): installing reads as "I have the app now", and
   *  the app must say "not all of it, yet" once more before the user finds out
   *  the hard way on a plane. */
  offlineNudgeDismissed?: boolean;
  city?: string;
  country?: string;
  headshot?: AssetRef; // Yes - the user's headshot is an AssetRef too.
  custom?: Record<string, string>;
  /** Local UI feature flags, keyed by flag id (default ON when unset). */
  featureFlags?: Record<string, boolean>;
  /** Accessibility preferences - all opt-in, default off (unset = the regular
   *  experience, byte-for-byte). Shells apply them to their own chrome only;
   *  a tool's rendered output is never affected (motion/type inside the render
   *  canvas is the user's creative output, not app chrome). */
  a11y?: {
    /** Tame chrome animations/transitions even when the OS doesn't ask for it. */
    reduceMotion?: boolean;
    /** Stronger foreground/border contrast for the app chrome. */
    highContrast?: boolean;
    /** Larger app-chrome type (never scales the tool canvas or exports). */
    largeText?: boolean;
  };
  /** Nearby-discovery preferences (plans/110). Additive + optional, so a profile
   *  without it is byte-identical to today. The only PERSISTED visibility mode is
   * `standing` ("always visible on networks I join") - an opt-in for trusted LANs;
   *  the ordinary timed "visible for 10 minutes" window is runtime state and never
   *  stored. Even `standing` advertises only while the app is running. */
  nearby?: {
    /** Keep advertising discoverable whenever the app runs, without re-arming a
     * timed window each time. Default (unset) is off - a device is discoverable
     *  only during an explicit timed window. */
    standing?: boolean;
  };
  /** Tool ids the user has starred - the gallery's "Favourites" collection. Rides
   *  the profile so it persists across reloads and travels in the portable backup. */
  favourites?: string[];
  /** Tool ids the user has hidden from the gallery/utilities grids ("Hide tool").
   *  Same per-user overlay idea as `hiddenAssets`: the tool stays installed and
   * deep links keep working - this only removes its tile from the browse surfaces,
   *  behind a "Show hidden tools" reveal. Utility VIEW cards (app routes, not tools)
   *  share the store under their `view:<id>` namespaced key, mirroring how
   *  `favourites` stars them. Tolerant of ids that no longer resolve. */
  hiddenTools?: string[];
  /** One-shot marker that the brand's shipped default-hidden TOOL set (`defaultHiddenTools`
   *  in the catalog index) has been established for this profile. Until it's set, those
   *  defaults are merged into `hiddenTools` at load; the user's first hide/un-hide bakes the
   *  current set in and sets this true, so their later un-hides stick and the defaults never
   *  re-apply. The tool twin of `catalogDefaultsSeeded` (which covers the asset overlay). */
  hiddenToolsSeeded?: boolean;
  /** Asset ids the user has starred - the Catalog's asset "Favourites", surfaced as a
   *  pinned collapsible section at the top of every asset picker. Distinct from
   *  `favourites` (TOOL ids). Keyed by the base asset id (theme suffix stripped). */
  favouriteAssets?: string[];
  /** Refs the user has starred in the Projects view - folders, saved sessions, or folder
   *  images. Distinct from `favourites` (TOOL ids) and `favouriteAssets` (catalog ids): these
   *  are the user's OWN project refs. Surfaced as a favourites strip at the top of Projects. */
  favouriteProjects?: string[];
  /** Per-user category override for the Catalog + picker grouping: base asset id →
   *  library group key (e.g. 'backgrounds'). Layers over the tag-derived category so a
   *  user can reclassify e.g. a headshot as a background. Immutable catalog tags are
   * never mutated - this is the per-user overlay. */
  assetCategories?: Record<string, string>;
  /**
   * Per-user cover art for an audio asset: base asset id → a RECIPE, not pixels.
   *
   * Every audio asset already gets a generated look - a waveform shape and a brand
   * colour derived deterministically from its id - and that is the product. This is the
   * opt-in override for the handful of tracks a user cares enough about to style, so a
   * favourite gets something closer to an album cover.
   *
   * The value is `"<shape>"` or `"<shape>:<colourIndex>"`, deliberately NOT a hex and
   * NOT an image:
   *   - STRUCTURE IS FROZEN. The shape is the user's choice and nothing may change it;
   *     a rebrand must never turn their blob into a ring.
   *   - COLOUR RE-RESOLVES. The index points into the ACTIVE brand's colour pool, so a
   *     cover re-skins with the brand and keeps mixing with its surroundings. That is
   *     the intended behaviour, not drift.
   * Storing a baked hex would freeze the paint too and strand the cover on an old brand;
   * storing an image would also cost bytes and stop it re-rendering crisply at any size.
   *
   * Keyed by BASE asset id, like the overlays above, and tolerant of an id that vanishes
   * on a catalog rebuild. Absent for the overwhelming majority of assets, by design.
   */
  audioCovers?: Record<string, string>;
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
  /** UI/content language as a canonical short code (see engine/src/lang.ts's
   * LANGS) - 'es'|'de'|'fr'|'zh'|'ja'|'vi', or unset for English. Written by the
   *  welcome-dialog and profile-card language pickers; mirrored to `localStorage
   *  'lang'` for a pre-paint read, and a legal `bindToProfile: "lang"` target. */
  lang?: string;
  /** Auto-save each finished render into the personal library (the 'renders'
   *  tag) as it downloads. Default ON: unset means enabled, only an explicit
   *  `false` turns it off. Shells save the exact credentialed bytes the user
   *  received, deduped by checksum, so a re-download of the same file never
   *  stacks a second copy. Set from Profile like the a11y prefs (never
   *  localStorage). */
  saveRenders?: boolean;
  /** Export home (plans/138 Tier A1): a connected provider KIND ('dropbox',
   *  's3', …) the user pinned as "my exports live here". When set, every finished
   *  export ALSO auto-sends to it over the same send-target driver a manual send
   *  uses. Unset = no home (the default). Names a kind only; the connection itself
   *  is device-local, so on a device that lacks it the home is simply inert. */
  exportHome?: string;
}

// ─── Assets ─────────────────────────────────────────────────────────────────

export interface AssetsAPI {
  /**
   * Resolve a specific asset by id. Throws if not found and not in user uploads.
   *
   * 1.6.0: the id may carry an icon colour pairing - `<baseId>?theme=<themeId>`
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
   * This is what tools use for asset-typed inputs - the host owns the picker chrome.
   */
  pick(opts: AssetPickerOpts): Promise<AssetRef | null>;

  /** Check if an asset is available offline right now (for graceful degradation). */
  isAvailable(id: string): Promise<boolean>;

  /**
   * The stored Content Credentials of a user-uploaded asset, if it carried any
   * at ingest - kept as the raw C2PA manifest store (no pixels/EXIF, so nothing
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
 * camera origin is never laundered away). Opaque to the shell - forwarded as-is.
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
  type?: 'vector' | 'raster' | 'video' | 'audio' | 'lottie' | 'palette' | 'tokens' | 'font' | 'profile' | 'ratecard' | 'text' | 'data';
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
  spot: SpotColor | null;      // named spot/Pantone lock from $extensions, when present
  /**
   * Per-target overrides the brand AUTHORED for this colour, keyed by target id
   * (a CSS space name, or `icc:<digest>:<intent>` - see the engine's
   * `gamutSourceId`). Empty for a token with none, which is most of them.
   *
   * `value` above already honours an authored **sRGB** face, so a consumer that
   * only paints does not need to read this - it is here for a consumer that has
   * to know WHICH faces were chosen rather than computed, or that can honour a
   * wider target than sRGB.
   *
   * v1.77.
   */
  faces?: Record<string, string | number[]>;
}

/** A named spot ink (e.g. Pantone) locked onto a token. Independent of the
 * sibling `cmyk` lock above - a token may carry either, both, or neither:
 *  `cmyk` is the process-colour fallback (preview, non-PDF export, and the
 *  Separation alternate-space value) whether or not a spot is also set; when
 *  neither is set it's derived from the token's own colour at export time. */
export interface SpotColor {
  name: string;
  book?: string;
  /** (v1.91) The tactile finish this ink IS, when it is not an ink at all: a foil,
   *  an emboss/deboss, a spot varnish, a cut/crease. Absent = an ordinary spot ink,
   * which is every spot lock that exists today - so this is strictly additive
   *  and changes nothing for them. `name` still says WHICH ('Gold', 'Silver',
   *  'Die'); `finish` says what the press DOES with it. */
  finish?: FinishKind;
}

/**
 * (v1.91) Print finishes a brand can declare on a spot.
 *
 * A finish ink is not a colour. It is something the press applies as its own
 * PLATE - a foil stamp, an embossing/debossing die, a spot-UV varnish screen, a
 * cutting or creasing rule - so it never contributes to the process build and
 * must not be gamut-mapped, previewed as a pigment, or merged into CMYK. It
 * rides the spot contract because a finish already IS a named separation whose
 * "value" is a press instruction, not because it is a kind of colour.
 *
 * The contract defines only how a finish is SPELLED. The *offered* set is brand
 * data: a brand declares the finishes it can actually buy, on its own colour
 * tokens (plans/67-tactile-brand-control.md). That is why the union is open - the
 * listed ids are the canonical spellings (they become plate names), while the
 * trailing `(string & {})` lets a house process ('letterpress', 'thermography',
 * 'holographic-foil') exist with no type, schema, or engine release. Editor
 * autocomplete still offers the known members.
 *
 * A consumer MUST treat an unrecognised value as "a finish I do not know how to
 * render" - never as an error, and never as a reason to discard the surrounding
 * ink, whose `name` is the one field a plate actually needs. Any `switch` over
 * it needs a `default:` arm.
 */
export const KNOWN_FINISH_KINDS = [
  'foil', 'emboss', 'deboss', 'spot-uv', 'soft-touch', 'cut', 'crease', 'perforate',
] as const;

export type FinishKind = (typeof KNOWN_FINISH_KINDS)[number] | (string & {});

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
   * Deliver a blob the tool produced itself - the transform path (file in →
   * transformed file out), as opposed to render() which rasterises a DOM node.
   * Used by on-device utilities (EXIF strip, redact, compress, convert): the
   * tool's `exportFile` hook returns the transformed bytes, the shell wraps them
   * in a Blob, and this hands them to the user (download on web, a save target on
   * Tauri/CLI). UNLIKE render(), this NEVER watermarks and NEVER embeds
   * provenance metadata - the bytes are the user's own content, not a generated
   * artifact, so stamping them would be both wrong and self-defeating (a metadata
   * stripper must not add metadata). Added in v1.1; older shells without it fall
   * back to download().
   */
  file(blob: Blob, opts?: { filename?: string }): Promise<void>;

  /**
   * Hand a finished blob to the host's OS share sheet - the Web Share API
   * (`navigator.share`) on web, or a Tauri shell's native share (Android `ACTION_SEND`).
   * Used by the Share modal's "Send to…" to hand over a `.lolly` file or a rendered
   * export. UNLIKE render(), this NEVER watermarks or re-encodes. Resolves `true` when
   * the sheet handled it (INCLUDING a deliberate user-cancel - so the caller does not
   * then also trigger a download), `false` when it could not share so the caller falls
   * back to download(). IMPORTANT: web Web Share only accepts an allowlisted set of file
   * types, so a caller MUST gate its "Send to…" affordance on canShare() below rather
   * than assume share() will succeed. Progressive enhancement - older shells lack it.
   * (v1.126)
   */
  share?(blob: Blob, opts?: { filename?: string; mime?: string; title?: string }): Promise<boolean>;

  /**
   * Synchronous capability probe: will share() actually reach an OS share sheet for a
   * file of this type on THIS shell? Web returns whether `navigator.canShare` accepts a
   * file of `opts.mime` - Chromium enforces a fixed type/extension safelist, and a
   * private `application/vnd.lolly+zip` / `.lolly` is NOT on it, so this is `false`
   * there; a Tauri native-share shell returns whether its native bridge is present. The
   * "Send to…" button is rendered only when this is true, so it never silently degrades
   * to a download while claiming a share. (v1.126)
   */
  canShare?(opts?: { mime?: string; filename?: string }): boolean;

  /**
   * Apply Lolly's durable RASTER marks to finished image bytes - the transform-
   * path counterpart to render()'s automatic marking, for a tool that stamps an
   * EXISTING file (Embed, Imprint & Track) rather than rendering a DOM node.
   * Embeds the pixel Imprint (a fast-to-read DCT watermark that survives re-
   * encoding) always, plus the imperceptible neural durable mark when
   * `opts.durable`, then re-encodes to the SAME raster format. Raster-only and
   * best-effort: a non-raster format (pdf/mp4/audio/svg), undecodable bytes, or a
   * sub-8px image returns the input UNCHANGED, and it NEVER throws - a marking
   * hiccup returns the bytes, because losing the file is worse than a missing
   * mark. Distinct from file(): callers combine it with host.c2pa.sign to layer
   * the pixel/durable marks under the C2PA credential. Progressive enhancement:
   * a shell without a rasteriser (headless CLI) returns the input unchanged.
   * (v1.104)
   */
  imprint(bytes: Uint8Array, format: string, opts?: { durable?: boolean }): Promise<Uint8Array>;
}

/**
 * The value of a `file`-typed input: a user-picked file loaded into memory. The
 * shell's file picker builds this; the tool's hooks read `bytes` directly (by
 * design bytes ride in the value rather than behind a read API - the portable
 * host surface has no file-read call). Never persisted and never serialised
 * into a URL - binary user
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

export type ExportFormat =
  | 'png' | 'apng' | 'jpg' | 'svg' | 'emf' | 'eps' | 'eps-cmyk' | 'pdf' | 'pdf-cmyk' | 'cmyk-tiff' | 'html' | 'webm'
  // Audio-only exports. 'opus' is Opus in a WebM container (audio/webm), not Ogg -
  // the shells already carry a WebM muxer and none can write an Ogg stream.
  | 'wav' | 'mp3' | 'm4a' | 'opus';

export interface ExportOpts {
  scale?: number;        // raster scale (1, 2, 3) - used when width/height absent
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

  /**
   * REQUESTED bits per channel for the output (the `depth` URL param): 8, 16,
   * 'float' (floating-point samples - EXR / Radiance .hdr / float TIFF), or
   * 'auto' (the default when omitted) meaning "the deepest the provenance chain
   * supports".
   *
   * A request, never a promise. Consumers MUST apply the depth-follows-provenance
   * rule: emit deep bits only where the pipeline actually produced them. A 16-bit
   * container written over an 8-bit canvas render is padding, and shipping it is
   * the export-side twin of the silent-ingest lie - so an unsupported request
   * degrades to what the source can honestly carry rather than upsampling.
   * Formats that are inherently deep (EXR, .hdr) ignore it; the first consumer is
   * the HDR PNG path (16-bit cICP PNG). Optional/additive (engine 1.88+, with the
   * Phase B deep-pixel writers) - a field, not a method, and unset by default, so
   * a shell that ignores it behaves exactly as before.
   * See plans/61-deeprichpixels.md section 10.
   */
  depth?: 8 | 16 | 'float' | 'auto';

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
   * names the press condition declared in the PDF's OutputIntent - one of the
   * keys in CMYK_CONDITIONS ('fogra39' default, 'swop', 'gracol', …). The
   * profile data and conversions live in the engine (engine/src/color.js); the
   * bridge only writes them into each format's native slot.
   */
  colorProfile?: 'srgb' | 'none' | string;

  /**
   * Hint: this export is a low-fidelity thumbnail/preview, not the deliverable.
   * Hooks may take a cheap path - e.g. an expensive-capture tool can reuse the
   * last render already on the canvas instead of re-running the capture.
   */
  thumbnail?: boolean;

  /**
   * Cancellation for a long export. A shell's export pipeline SHOULD poll it at
   * its natural yield points - between frames, rows, pages - and reject with a
   * DOMException named 'AbortError' as soon as it is aborted, so the work stops
   * instead of finishing unwatched. A path with no yield point (a single
   * synchronous encode, a real-time recorder handing back one blob) MAY ignore
   * it, and then the only contract the caller gets is that the RESULT is
   * discarded: it must not treat an abort as a failure, and must not deliver the
   * bytes. Optional/additive (v1.141) - unset by default, so a shell that
   * ignores it behaves exactly as before.
   */
  signal?: AbortSignal;

  /**
   * Optional audio bed for the video formats (webm/mp4) - like the de-facto
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
   * the fade is baked into the muxed track - no pre-faded asset variants needed.
   * `volume` (0..1, default 1) is the bed's overall level. `duck` (0..1, default 1
   * = no ducking) is the level the bed drops to while foreground audio is present -
   * the top-&-tail compositor lowers the music to `volume·duck` over the body clip
   * when the footage carries its own audio, then restores it for the outro, so an
   * uploaded talking clip stays intelligible under the bed.
   *
   * `start` (seconds, default 0) is the bed's in-point: playback begins that far
   * into the source instead of at 0:00, so a tool whose visuals start partway
   * through a clip (the audiogram's "Start at") exports picture and sound in
   * sync. A looping bed repeats the [start, end) region, not the whole track. It
   * is clamped into the decoded source - a start past the end degrades to 0 with
   * a log warning rather than exporting silence.
   */
  audio?: { id?: string; url: string; fadeIn?: number; fadeOut?: number; volume?: number; duck?: number; start?: number };

  /**
   * Content Credentials to preserve from placed source assets (added v1.26). The
   * runtime gathers these from credentialed uploads used in the design; the C2PA
   * embedder carries their manifests into the export's provenance chain. Opaque
   * to the shell; ignored by exports that aren't C2PA-stamped.
   */
  ingredients?: IngredientCredential[];

  /**
   * A compact digest of the tool's scalar inputs (id → short string) that
   * produced this render - colours, sizes, toggles, short text (added v1.27).
   * The runtime derives it via summarizeInputs() when C2PA stamping is on; the
   * shell records it under `inputs` in the `tools.lolly.export` assertion so an
   * inspected asset shows what it was made from. Opaque to the shell; ignored by
   * exports that aren't C2PA-stamped.
   */
  c2paInputs?: Record<string, string>;

  /**
   * Live-capture provenance for the C2PA action history (added v1.35). Set by the
   * runtime when the essence of this render came from a device sensor - a filter
   * tool's live camera frame (host.media / onFrame), or a recorder tool's take
   * (host.recorder): a video take carries both; an audio take, the mic alone. The
   * C2PA embedder marks the created step with the IPTC `digitalCapture` source
   * type and an honest "captured/recorded live" description, so an inspected asset
   * declares its real-world origin. Opaque to the shell; ignored by non-C2PA exports.
   */
  c2paCapture?: { camera?: boolean; microphone?: boolean };

  /**
   * Text-added provenance for the C2PA action history (added v1.35). Set by the
   * runtime ONLY when rendered text sits over an OPENED asset (a credentialed
   * upload/catalog image is present as an ingredient) - a genuine edit worth its
   * own `c2pa.edited` "Added text" step. From-scratch text is the work's content,
   * not an edit: it rides in the `c2paInputs` digest instead. `sample` is a short
   * teaser for the step label; the full copy is in the digest. Opaque to the shell.
   */
  c2paTextAdded?: { sample?: string };

  /**
   * AI-upscale provenance for the C2PA action history (added v1.101). Set by the
   * runtime when the essence of this render is an on-device AI-upscaled asset
   * (host.upscale, carried on the placed asset's `meta.aiUpscale`). The C2PA
   * embedder marks the created step with the IPTC
   * `compositeWithTrainedAlgorithmicMedia` source type and appends an honest
   * "AI-upscaled with <model> <version>" edit step, so an inspected asset names the
   * model that enlarged it. Opaque to the shell; ignored by non-C2PA exports.
   */
  c2paAiUpscale?: { model: string; version: string };
}

// Provenance attribution, auto-assembled from the profile + tool. The trailing two
// are USER-ASSERTED IP fields, filled ONLY when a tool's inputs carry them via
// `bindToMeta` (e.g. embed-track-image, where the artist explicitly declares the
// copyright/licence of their OWN work). They are NEVER auto-derived from the profile
// - Lolly won't assert ownership the user didn't state - and, like every EXIF
// Copyright / XMP dc:rights out there, they are self-declared, not verified facts.
export interface ExportMeta {
  software: string;     // "Lolly"
  source: string;       // "https://lolly.tools"
  tool: string;         // the tool's name
  author: string;       // "First Last" - '' if the user hasn't set a profile
  contact: string;      // "email · phone" - '' if none
  description: string;  // human-readable credit line
  /** Rights/copyright notice, e.g. "© 2026 Jane Doe. All rights reserved." User-
   *  asserted (bindToMeta 'copyright'); omitted/'' when none. Written to EXIF
   *  Copyright, PNG Copyright, SVG dc:rights, and the C2PA manifest's dc:rights. */
  copyright?: string;
  /** Licence label and/or URL, e.g. "CC BY 4.0 · https://creativecommons.org/licenses/by/4.0/".
   *  User-asserted (bindToMeta 'license'); omitted/'' when none. */
  license?: string;
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
   * Font shaping respects OpenType features (GPOS, GSUB - ligatures, kerning,
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

  /**
   * Resolve a font FAMILY the host knows - brand statics, user-uploaded faces,
   * on-device Google Fonts, the platform face - to a fetchable font file
   * usable as `fontUrl` in toPath()/preload(). `opts` picks the nearest face:
   * `weight` (CSS 100–900, default 400) and `italic` (default false). When the
   * resolved file is a VARIABLE font, `variations` carries the HarfBuzz axis
   * settings (e.g. ['wght=700']) needed to reach the requested weight - pass
   * them through to toPath(), which otherwise shapes the default instance.
   * Resolves null when no file can be found for the family (the caller keeps
   * its <text>/CSS fallback). Optional/additive (v1.60); absent on older
   * hosts - feature-detect `host.text?.fontUrl`.
   */
  fontUrl?(family: string, opts?: { weight?: number; italic?: boolean }): Promise<{ url: string; variations?: string[] } | null>;
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
   * instance - a bold run would outline as regular. Axes not listed take their
   * default value. Ignored by static fonts. (v1.29)
   */
  variations?: string[];
  /**
   * Faces to shape the characters `fontUrl` has no glyph for, tried in order -
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
   * How many glyphs in the run fell back to `.notdef` - the font has no glyph
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
   * the normal render/export path - so units, format conversion, provenance and
   * the experimental watermark all apply downstream exactly as for a template
   * render. Capture is the *source*; export remains the single output path.
   *
   * The returned ref's `width`/`height` are the ACTUAL captured CSS-px box -
   * after any `crop` insets and `rangeTo` extension - so callers size their
   * composite from the result, never from the request. Hosts SHOULD also report
   * the resolved page geometry in `meta` (`pageWidth`/`pageHeight` in CSS px and
   * `scrollYPx`, the resolved scroll offset) where the engine can measure it;
   * callers must treat those as optional (older shells omit them).
   *
   * Slow and side-effectful (a real navigation + settle), unlike instant
   * template renders - call it from an explicit action, not on every keystroke.
   */
  page(spec: CaptureSpec): Promise<AssetRef>;

  /**
   * Vector capture - print `url` to a TRUE vector document and return it as an
   * SVG AssetRef (`type: 'vector'`, `format: 'svg'`, `url` a data: URL holding a
   * self-contained SVG: text as <text>, boxes/paths as vectors, page images
   * inlined as data: URIs). Where page() reads pixels, this reads *geometry* -
   * the same fidelity ladder as the PDF import path (pdf-map.ts), so the result
   * is crisp at any zoom and re-editable, at the cost of pixel-perfection
   * (webfonts resolve by family name, exotic paint degrades per the ladder).
   *
   * The shell applies the SAME windowing as page(): `scrollDepth` + `height`
   * frame the region, `crop` trims insets - all as viewBox geometry, so a vector
   * shot and a raster shot of one spec frame identical content. Omit `height`
   * to get the full page.
   *
   * Optional/additive (v1.45) - only shells whose browser engine can print to a
   * vector format provide it; callers feature-detect `host.capture.vector` and
   * fall back to page() (a raster in an <svg> wrapper) where absent.
   */
  vector?(spec: CaptureSpec): Promise<AssetRef>;
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
  /**
   * Extend the capture DOWN the page from `scrollDepth` to this scroll position
   * (same 0..1-fraction / px-offset semantics; values ≤ the resolved
   * `scrollDepth` mean no extension). The captured image becomes a tall strip:
   * the viewport at `scrollDepth` plus everything down to the viewport at
   * `rangeTo` - the strip a scroll animation pans over. Callers derive the pan
   * distance from the RESULT (`ref.height` − the framed viewport height), so a
   * host that ignores or clamps this field (older shells; texture limits)
   * degrades to a shorter - or static - pan, never an error. (v1.45)
   */
  rangeTo?: number;
  /** Settle time after load - and after scrolling - before the shot, in ms. */
  waitMs?: number;
  /** Device pixel ratio for a crisp raster; maps onto the export `dpi` concept. */
  dpr?: number;
  /**
   * Custom CSS injected into the page before the shot (userstyles-style, additive
   * - appended so it layers over the page's own rules by source order). Use it to
   * hide cookie banners, restyle elements, etc.
   */
  css?: string;
  /**
   * Trim insets, each a 0..0.9 fraction of the framed viewport box (the TUI's
   * url-capture semantics, now on the bridge). Applied by the host at capture
   * time - clip geometry for a raster, viewBox geometry for a vector - so the
   * returned ref's width/height already reflect the trim. Hosts that predate the
   * field ignore it (the caller reads the result dims either way). (v1.45)
   */
  crop?: { top?: number; right?: number; bottom?: number; left?: number };
}

// ─── Lift (optional) ────────────────────────────────────────────────────────────

/** One lifted layer: a standalone SVG document plus its ink extent (v1.123). */
export interface LiftLayer {
  /**
   * The layer as a complete, standalone `<svg>…</svg>` document. It keeps the source's
   * ROOT coordinate system, so every layer overlays the others exactly - ready to
   * rasterise to a texture or store as an asset with no fix-up. (The engine's
   * `SvgLayer.markup`.)
   */
  svg: string;
  /**
   * The layer's analytic ink bounding box in the SOURCE viewBox's user units, or null
   * when nothing in it could be measured without a renderer. Advisory - for clustering
   * and placement hints, never a pixel-exact crop.
   */
  bbox: { x: number; y: number; w: number; h: number } | null;
  /** How many of the source's top-level nodes this layer gathered - a hint for telling a
   *  real layer from a cluster of stray leaves. */
  nodes: number;
}

/**
 * The result of lifting an SVG: its layers in PAINT ORDER (background first, so a caller
 * placing planes back-to-front can walk the array), plus the source document's own
 * viewBox (the denominator for every layer's bbox).
 */
export interface LiftResult {
  layers: LiftLayer[];
  viewBox: { x: number; y: number; w: number; h: number } | null;
  /** Anything the enumerator refused, repaired or capped, in plain words. Never thrown. */
  warnings: string[];
}

export interface LiftAPI {
  /**
   * Lift an SVG - named by URL (a catalog/library asset, an uploaded `blob:`, or a
   * `data:` URL) - into its own layers. The shell fetches + sanitises the markup through
   * its one untrusted-SVG path, then runs the engine's `enumerateSvgLayers`. Returns the
   * layers in paint order as standalone SVG documents + their ink boxes, and the source
   * viewBox. A source that is not an SVG, or has fewer than two layers, comes back with
   * `layers: []` (the caller then treats the shot as a single plane) - this method never
   * throws on "nothing to lift", only on a fetch/parse failure the caller should surface.
   */
  svg(source: string): Promise<LiftResult>;
}

// ─── Keyframes (optional) ───────────────────────────────────────────────────────

export interface KeyframesAPI {
  /**
   * Evaluate a `kf` track at `count` times evenly spaced across its OWN span (first to last
   * keyframe), returning each pose as a channel→value map (`x`, `y`, `z`, `rx`, `ry`, `p`,
   * `f`, `a`, …). Runs the engine's `parseKf` + `evaluateKf`, so the interpolation and
   * easing are canonical - a template's motion matches the Design tool's exactly. An
   * empty / parse-failed track returns `[]`. The caller maps the channels onto its own
   * camera or transform (a real-3D tool interprets `rx`/`ry`/`z` differently from the
   * Design tool's 2.5D homography, which is why the mapping stays with the caller).
   */
  sample(kf: string, count: number): Promise<Record<string, number>[]>;
}

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

// Re-export the AssetRef shape from the schema for convenience.
export interface AssetRef {
  source: 'library' | 'user' | 'remote';
  id: string;
  // 'profile' is an ICC colour profile the USER supplied (a press or display
  // profile, `user/profiles/<digest>`). It has no visual form - it is a gamut to
  // compare against, not something to place - so image surfaces filter it out
  // the same way they filter 'font' and 'tokens'.
  type: 'vector' | 'raster' | 'video' | 'audio' | 'lottie' | 'palette' | 'tokens' | 'font' | 'profile' | 'ratecard' | 'text' | 'data';
  format: string;
  url: string;
  width?: number;
  height?: number;
  version?: string;
  checksum?: string;
  // Free-form, host-populated. Conventional keys the engine/shells recognise:
  //   name       display label
  //   tags       string[] for filtering
  // animated true for an animated raster (gif/apng/animated-webp) - the frame
  //              badge marks it and exports know it flattens to a still
  //   posterUrl  a still fallback frame for a lottie or video (used for the
  //              <video poster> attribute and as the pre-play / export still)
  //   baked      true for a FROZEN composed render (engine bake.ts): the url is
  // a self-contained data: URL, resolved as-is on every mount - no
  //              compose depth consumed, never live-re-rendered
  //   bakedAt    epoch ms the bake happened
  // bakedFrom the canonical embed URL the bake rendered from - provenance
  //              for on-demand re-baking (absent when none could be minted)
  // durationMs playback length in milliseconds - video, audio, and lottie assets.
  //              Resolved at ingest (storeUserUpload probes it; a catalog asset
  //              authors it in asset.schema.json's per-format entry). Only ever
  // present when it resolved to a finite positive number - never 0
  //              or a bogus placeholder.
  // fps a lottie's frame rate (its `fr`), alongside its durationMs -
  //              not meaningful for video/audio.
  // aiSignals  a text asset's persisted AI-likelihood note from the engine's
  //              analyzeTextSignals: { v, band, score, source, family?,
  //              confidence? }. `v` is the LEXICON_VERSION that produced it -
  //              a stale v means recompute, never trust. A SIGNAL carried for
  //              the user's own confidence in an ingredient, never a verdict,
  //              and never written into signed provenance.
  meta?: Record<string, unknown>;
}

/**
 * A deep image frame handed to `host.codec` - the tool-facing mirror of the
 * engine's `DeepFrame` (tools cannot import the engine, so the shape is restated
 * here as the versioned contract). RGBA interleaved Float32, LINEAR light,
 * un-premultiplied, unbounded; `space` travels WITH the buffer (babl's lesson).
 * Default space is `'srgb-linear'`.
 */
export interface CodecFrame {
  width: number;
  height: number;
  /** RGBA interleaved, length = width * height * 4. Linear, un-premultiplied, unbounded. */
  data: Float32Array;
  /** Working-space primaries + white point. Default `'srgb-linear'`. */
  space?: 'srgb-linear' | 'display-p3-linear' | 'rec2020-linear';
}

/**
 * Deep image codecs (see `HostV1.codec`). Each turns a linear {@link CodecFrame}
 * into finished image bytes; the tool decides depth by picking the method. All
 * async (a shell may offload to a Worker) and all pure with respect to the frame
 * (never mutated). A shell without a given format resolves to the same bytes as
 * its sibling - the maths is the engine's, not the shell's.
 */
export interface CodecAPI {
  /** 16-bit sRGB PNG - real per-channel precision, no HDR. Smooth where 8-bit bands. */
  png16(frame: CodecFrame, opts?: { dpi?: number; channels?: 3 | 4 }): Promise<Uint8Array>;
  /** OpenEXR master. `'half'` (default) or `'float'` samples. */
  exr(frame: CodecFrame, opts?: { pixelType?: 'half' | 'float'; channels?: 'rgba' | 'rgb' }): Promise<Uint8Array>;
  /** Radiance RGBE (.hdr) master. */
  radiance(frame: CodecFrame, opts?: { exposure?: number }): Promise<Uint8Array>;
  /** Error-diffused (Floyd–Steinberg) 8-bit sRGB PNG from a deep source - smooth 8-bit. */
  dither8(frame: CodecFrame, opts?: { dpi?: number; channels?: 3 | 4 }): Promise<Uint8Array>;
}

// ─── Layered-bitmap write-back (optional, v1.102) ────────────────────────────

/**
 * One layer of a {@link LayersAPI.writePsd} document - the tool-facing mirror
 * of the engine's `PsdWriteLayer` (tools cannot import the engine, so the shape
 * is restated here as the versioned contract). Pixels are plain 8-bit RGBA,
 * un-premultiplied sRGB - exactly what a canvas `getImageData` gives.
 */
export interface LayerWrite {
  name: string;
  /** Document-space bounds; width/height must match the pixel buffer. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** RGBA8, length width*height*4. */
  pixels: Uint8Array;
  /** 0..1, default 1. */
  opacity?: number;
  /** A CSS mix-blend-mode value ('normal' | 'multiply' | …), default 'normal'. */
  blend?: string;
  /** Default true. */
  visible?: boolean;
}

/** A layered document for {@link LayersAPI.writePsd}; layers are bottom-to-top. */
export interface LayeredWriteDoc {
  width: number;
  height: number;
  layers: LayerWrite[];
}

/**
 * Layered-bitmap serialisers (see `HostV1.layers`). Async so a shell may
 * offload the encode; the maths is the engine's `psd-write.ts`, so web and CLI
 * emit identical bytes for identical docs.
 */
export interface LayersAPI {
  /** Serialise as a layered Photoshop PSD (8-bit RGB v1; see engine psd-write.ts). */
  writePsd(doc: LayeredWriteDoc): Promise<Uint8Array>;
}

// ─── On-device AI upscaling (optional, v1.101) ────────────────────────────────

/**
 * A plain 8-bit RGBA pixel frame handed to / returned from `host.upscale` -
 * straight (un-premultiplied) alpha, exactly what a canvas `getImageData` gives
 * and `putImageData` takes, so a tool never has to touch a tensor. DOM-free: the
 * shell owns the model runtime; the contract only ever sees typed arrays.
 */
export interface UpscaleFrame {
  width: number;
  height: number;
  /** RGBA interleaved, 8-bit, straight alpha, length = width * height * 4. */
  data: Uint8ClampedArray;
}

/** A `host.upscale` model an id can select - see `UpscaleAPI.models`. Two general
 *  Real-ESRGAN nets (fast + quality), an illustration/line-art net
 *  (`realesrgan-x4plus-anime`, the 6-block anime model) and a face restorer. */
export type UpscaleModelId =
  | 'realesr-general-x4v3'
  | 'realesrgan-x4plus'
  | 'realesrgan-x4plus-anime'
  | 'gfpgan-v1.4';

/**
 * One entry in the on-device model catalogue. `license` + `attribution` are not
 * decoration: the models ship under permissive licences (BSD-3-Clause,
 * Apache-2.0) whose one real obligation is carrying their copyright/notice, so a
 * shell surfaces them in its credits (a "Larger Work" under those terms).
 * `version` is the model release string and lands verbatim in the C2PA
 * disclosure ("AI-upscaled with <name> <version>").
 */
export interface UpscaleModelInfo {
  id: UpscaleModelId;
  /** Human name for the picker, e.g. "Real-ESRGAN general (fast)". */
  name: string;
  /** Native output multiple. */
  scale: 2 | 4;
  /** Approximate one-time download in bytes, for the consent UI + offline manager. */
  approxBytes: number;
  /** SPDX id, e.g. 'BSD-3-Clause' | 'Apache-2.0'. Surfaced in credits + disclosure. */
  license: string;
  /** Copyright / notice line to carry in the app's credits (the licence obligation). */
  attribution: string;
  /** Model release string; lands verbatim in the C2PA disclosure. */
  version: string;
  /**
   * A face RESTORER (GFPGAN) rather than a plain resolution enhancer - it can
   * synthesise facial detail that was never in the source. The shell shows this
   * string beside the option; for GFPGAN it reads exactly
   * "warning can invent face details".
   */
  warning?: string;
  /** True when the model only restores aligned face crops (needs the face path). */
  facesOnly?: boolean;
}

export interface UpscaleProgress {
  phase: 'download' | 'inference';
  /** Bytes so far (download phase). */
  loaded?: number;
  /** Total bytes, or null when the transport doesn't say. */
  total?: number | null;
  /** Tile index / count (inference phase) - the run is tiled to bound memory. */
  tile?: number;
  tiles?: number;
  /** 0..1 where a fraction is knowable. */
  fraction?: number;
}

export interface UpscaleOpts {
  /** A `UpscaleModelId`; defaults to the general fast model. */
  model?: UpscaleModelId;
  /** Target output multiple; clamped to what the model + device allow. */
  scale?: 2 | 4;
  /** 0..1 denoise strength (general model only - blends its WDN pair). */
  denoise?: number;
  /**
   * Hard cap on the output's longest edge in pixels - the device/user lever. The
   * run trims its plan to honour it, so a phone never attempts a 6000px master.
   */
  targetMaxEdge?: number;
  /**
   * Abort a long run: the promise rejects promptly (AbortError) at the next tile
   * boundary. Aborting during the first-use download rejects promptly but the
   * download completes in the background and is cached (like `speech`).
   */
  signal?: AbortSignal;
  onProgress?: (p: UpscaleProgress) => void;
}

/**
 * The honest answer to "can THIS device do THIS job?" - computed before any bytes
 * move (see `UpscaleAPI.canRun`). When `ok` is false the shell tells the user
 * plainly and offers the concrete lever (`suggestedMaxEdge` / `suggestedModel`)
 * rather than attempting the run and crashing.
 */
export interface UpscaleFeasibility {
  ok: boolean;
  /** Why not, when `ok` is false. */
  reason?: 'memory' | 'no-backend' | 'too-large';
  /** Plain, non-blaming copy the shell can show as-is. */
  message?: string;
  /** A longest-edge that WOULD fit, when the ask was too big. */
  suggestedMaxEdge?: number;
  /** A lighter model that would fit, when the chosen one won't. */
  suggestedModel?: UpscaleModelId;
}

/**
 * On-device AI image upscaling (see `HostV1.upscale`). A plain RGBA frame in, a
 * larger RGBA frame out - the shell owns the ONNX runtime, the WebGPU→WASM
 * backend choice, the one-time (consented - see `modelBytes`) model download, and
 * the memory-bounded tiling; the engine/tool only ever sees pixels.
 *
 * The heavy run is NOT driven from a tool hook (hooks are time-boxed and their
 * late results discarded): a shell surfaces this through an explicit,
 * progress-bearing, cancellable affordance whose result becomes an asset. All
 * async methods reject rather than half-produce; failures degrade to an honest
 * message, never a stuck spinner.
 */
export interface UpscaleAPI {
  /** Whether this shell can upscale at all (a backend + Worker exist). Sync. */
  isAvailable(): boolean;
  /** The resolved execution backend, or null before one is probed / when none. */
  backend(): 'webgpu' | 'wasm' | null;
  /** The model catalogue - ids, sizes, licences, warnings. Sync + static. */
  models(): UpscaleModelInfo[];
  /** Approximate one-time download for a model, for a consent UI. Sync. */
  modelBytes(id: UpscaleModelId): number;
  /** Are a model's bytes already on-device? Never downloads. */
  cached(id: UpscaleModelId): Promise<boolean>;
  /** Honest feasibility of a job on this device, before any bytes move. */
  canRun(src: { width: number; height: number }, opts?: UpscaleOpts): Promise<UpscaleFeasibility>;
  /** Upscale a frame. Rejects (AbortError) on `opts.signal`; never half-produces. */
  run(frame: UpscaleFrame, opts?: UpscaleOpts): Promise<UpscaleFrame>;
}

// ─── On-device background removal / matting (optional, v1.103) ─────────────────

/**
 * A plain 8-bit RGBA pixel frame handed to / returned from `host.matte` - the
 * same shape a canvas `getImageData` gives and `putImageData` takes, so a tool
 * never touches a tensor. On the way IN alpha is ignored (the model sees RGB); on
 * the way OUT the RGB is BYTE-FOR-BYTE the input's and the alpha is the computed
 * matte (straight, un-premultiplied) - a cutout you can composite directly.
 */
export interface MatteFrame {
  width: number;
  height: number;
  /** RGBA interleaved, 8-bit, straight alpha, length = width * height * 4. */
  data: Uint8ClampedArray;
}

/**
 * A `host.matte` model an id can select - see `MatteAPI.models`. A tiny fast
 * preview net, a general default, a portrait specialist, and the full-size
 * "max quality" edge model (`birefnet`) for when the user will wait on a large
 * (~490 MB) download. All ship under permissive licences (Apache-2.0 / MIT); the
 * roster is deliberately free of the popular non-commercial models (BRIA RMBG et al.).
 */
export type MatteModelId = 'u2netp' | 'birefnet-lite' | 'birefnet' | 'modnet';

/**
 * One entry in the on-device matte catalogue. `license` + `attribution` carry the
 * model's real obligation (permissive-licence notice, surfaced in credits);
 * `version` lands verbatim in the C2PA edit step ("Background removed with <name>
 * <version>"). `tier` orders the picker: fast preview → general → pro edges.
 */
export interface MatteModelInfo {
  id: MatteModelId;
  /** Human name for the picker, e.g. "BiRefNet lite". */
  name: string;
  /** Ordering + intent for the picker. */
  tier: 'fast' | 'default' | 'pro';
  /** Approximate one-time download in bytes, for the consent UI + offline manager. */
  approxBytes: number;
  /** SPDX id, e.g. 'Apache-2.0' | 'MIT'. Surfaced in credits + the edit step. */
  license: string;
  /** Copyright / notice line to carry in the app's credits (the licence obligation). */
  attribution: string;
  /** Model release string; lands verbatim in the C2PA edit step. */
  version: string;
  /** One-line quality/latency note the picker shows beside the option. */
  note?: string;
}

export interface MatteProgress {
  phase: 'download' | 'inference';
  /** Bytes so far (download phase). */
  loaded?: number;
  /** Total bytes, or null when the transport doesn't say. */
  total?: number | null;
  /** 0..1 where a fraction is knowable. */
  fraction?: number;
}

export interface MatteOpts {
  /** A `MatteModelId`; defaults to the general model. */
  model?: MatteModelId;
  /**
   * Hard cap on the OUTPUT's longest edge in pixels - the device/user lever. The
   * matte net runs at its own fixed input size regardless, so this only bounds the
   * full-resolution alpha buffer the mask is scaled back into (a phone need not
   * allocate a 8000px cutout). Absent ⇒ the source's own size.
   */
  maxEdge?: number;
  /**
   * Abort a long run: the promise rejects promptly (AbortError). Aborting during
   * the first-use download rejects promptly but the download completes in the
   * background and is cached (like `upscale`/`speech`).
   */
  signal?: AbortSignal;
  onProgress?: (p: MatteProgress) => void;
}

/**
 * The honest answer to "can THIS device do THIS job?" before any bytes move (see
 * `MatteAPI.canRun`). When `ok` is false the shell says so plainly and offers the
 * concrete lever rather than attempting the run and crashing.
 */
export interface MatteFeasibility {
  ok: boolean;
  reason?: 'memory' | 'no-backend' | 'too-large';
  /** Plain, non-blaming copy the shell can show as-is. */
  message?: string;
  /** A longest-edge that WOULD fit, when the ask was too big. */
  suggestedMaxEdge?: number;
  /** A lighter model that would fit, when the chosen one won't. */
  suggestedModel?: MatteModelId;
}

/**
 * On-device background removal (see `HostV1.matte`). A plain RGBA frame in, the
 * same frame with a model-computed alpha matte out - the shell owns the ONNX
 * runtime, the WebGPU→WASM backend, the one-time (consented - see `modelBytes`)
 * download and the memory bound; the tool only ever sees pixels. The output's RGB
 * is the input's, untouched; only the alpha is new. All async methods reject
 * rather than half-produce; failures degrade to an honest message, never a stuck
 * spinner.
 */
export interface MatteAPI {
  /** Whether this shell can matte at all (a backend + Worker exist). Sync. */
  isAvailable(): boolean;
  /** The resolved execution backend, or null before one is probed / when none. */
  backend(): 'webgpu' | 'wasm' | null;
  /** The model catalogue - ids, tiers, sizes, licences. Sync + static. */
  models(): MatteModelInfo[];
  /** Approximate one-time download for a model, for a consent UI. Sync. */
  modelBytes(id: MatteModelId): number;
  /** Are a model's bytes already on-device? Never downloads. */
  cached(id: MatteModelId): Promise<boolean>;
  /** Honest feasibility of a job on this device, before any bytes move. */
  canRun(src: { width: number; height: number }, opts?: MatteOpts): Promise<MatteFeasibility>;
  /** Cut out the subject. Rejects (AbortError) on `opts.signal`; never half-produces. */
  run(frame: MatteFrame, opts?: MatteOpts): Promise<MatteFrame>;
}

// ─── On-device text recognition / OCR (optional, v1.127) ──────────────────────

/**
 * A plain 8-bit RGBA pixel frame handed to `host.ocr` - the same shape a canvas
 * `getImageData` gives, so a caller never touches a tensor. Only RGB is read
 * (alpha ignored); the frame is never mutated.
 */
export interface OcrFrame {
  width: number;
  height: number;
  /** RGBA interleaved, 8-bit, length = width * height * 4. */
  data: Uint8ClampedArray;
}

/** An axis-aligned box in SOURCE-image pixel coordinates (origin top-left). */
export interface OcrBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * One recognised line of text: what it says, its position, and how sure the
 * model is. `confidence` is the model's own 0..1 recognition score for THIS
 * line's characters - not a claim about correctness, and never surfaced as a
 * verdict. `box` is axis-aligned in v1 (the detector's rotated quad reduced to
 * its bounding box); a later minor may add an optional 4-point `quad`.
 */
export interface OcrLine {
  text: string;
  confidence: number;
  box: OcrBox;
}

/**
 * What `host.ocr.run` read out of an image. `text` is every line joined in
 * reading order (top→bottom, left→right) with newlines - ready to drop into a
 * clipboard or a text field; `lines` keeps the per-line boxes and confidences for
 * a caller that wants to draw, filter, or re-read them. A best-effort READ, never
 * authoritative: a shell presents `text` as a correctable draft.
 */
export interface OcrResult {
  text: string;
  lines: OcrLine[];
  /** BCP 47 tag of the script/language the active model recognises. */
  lang: string;
}

/**
 * A `host.ocr` model an id selects (see `OcrAPI.models`). Kept a plain string
 * rather than a fixed union because the live roster grows by language pack - the
 * authoritative set is whatever `models()` returns on this shell.
 */
export type OcrModelId = string;

/**
 * One entry in the on-device OCR catalogue. `license` + `attribution` carry the
 * model's real obligation (permissive-licence notice, surfaced in credits).
 * `approxBytes` covers the whole logical model - detector + recogniser + the
 * charset dictionary - since all of them download together.
 */
export interface OcrModelInfo {
  id: OcrModelId;
  /** Human name for a picker, e.g. "PP-OCRv5 (English)". */
  name: string;
  /** Ordering + intent for a picker: fast preview → general → accurate. */
  tier: 'fast' | 'default' | 'accurate';
  /** Approximate one-time download in bytes (det + rec + charset), for consent + the offline manager. */
  approxBytes: number;
  /** SPDX id, e.g. 'Apache-2.0'. Surfaced in credits. */
  license: string;
  /** Copyright / notice line to carry in the app credits (the licence obligation). */
  attribution: string;
  /** Model release string. */
  version: string;
  /** BCP 47 tags the model recognises, e.g. ['en'] or ['en','fr','de']. */
  languages: string[];
  /** One-line quality/latency note a picker shows beside the option. */
  note?: string;
}

export interface OcrProgress {
  phase: 'download' | 'detect' | 'recognize';
  /** Bytes so far (download phase). */
  loaded?: number;
  /** Total bytes, or null when the transport doesn't say. */
  total?: number | null;
  /** 0..1 where a fraction is knowable. */
  fraction?: number;
}

export interface OcrOpts {
  /** An `OcrModelId`; defaults to the shell's default model. */
  model?: OcrModelId;
  /**
   * Skip detection and recognise the WHOLE frame as one line - for a caller that
   * has already cropped to a single text line (e.g. re-reading one box). Absent ⇒
   * detect boxes, then recognise each.
   */
  singleLine?: boolean;
  /** Drop lines whose confidence is below this 0..1 floor. Absent ⇒ keep all. */
  minConfidence?: number;
  /**
   * Abort a long run: the promise rejects promptly (AbortError). Aborting during
   * the first-use download rejects promptly but the download completes in the
   * background and is cached (like `matte` / `speech`).
   */
  signal?: AbortSignal;
  onProgress?: (p: OcrProgress) => void;
}

/**
 * The honest answer to "can THIS device read THIS image?" before any bytes move
 * (see `OcrAPI.canRun`). When `ok` is false the shell says so plainly and offers
 * the concrete lever rather than attempting the run and crashing.
 */
export interface OcrFeasibility {
  ok: boolean;
  reason?: 'memory' | 'no-backend' | 'too-large';
  /** Plain, non-blaming copy the shell can show as-is. */
  message?: string;
  /** A longest-edge that WOULD fit, when the ask was too big. */
  suggestedMaxEdge?: number;
  /** A lighter model that would fit, when the chosen one won't. */
  suggestedModel?: OcrModelId;
}

/**
 * On-device text recognition (see `HostV1.ocr`). A plain RGBA frame in, the text
 * the image contains out - the shell owns the ONNX runtime, the WASM backend, the
 * one-time (consented - see `modelBytes`) model download and the memory bound; the
 * caller only ever sees pixels and plain text. Produces no pixels, no asset and no
 * provenance. All async methods reject rather than half-produce; failures degrade
 * to an honest message, never a stuck spinner.
 */
export interface OcrAPI {
  /** Whether this shell can OCR at all (a WASM backend + Worker exist). Sync. */
  isAvailable(): boolean;
  /** The resolved backend, or null before one is probed / when none. Never 'webgpu'. */
  backend(): 'wasm' | null;
  /** The model catalogue - ids, tiers, sizes, licences, languages. Sync + static. */
  models(): OcrModelInfo[];
  /** Approximate one-time download for a model, for a consent UI. Sync. */
  modelBytes(id: OcrModelId): number;
  /** Are a model's bytes already on-device? Never downloads. */
  cached(id: OcrModelId): Promise<boolean>;
  /** Honest feasibility of a read on this device, before any bytes move. */
  canRun(src: { width: number; height: number }, opts?: OcrOpts): Promise<OcrFeasibility>;
  /** Read the text. Rejects (AbortError) on `opts.signal`; never half-produces. */
  run(frame: OcrFrame, opts?: OcrOpts): Promise<OcrResult>;
}
