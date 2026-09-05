// SPDX-License-Identifier: MPL-2.0

import type { AssetsAPI } from './assets.ts';

import type { AudioAPI } from './audio.ts';

import type { C2paAPI } from './c2pa.ts';

import type { CaptureAPI } from './capture.ts';

import type { ClipboardAPI } from './clipboard.ts';

import type { CodecAPI } from './codec.ts';

import type { ColorAPI } from './color.ts';

import type { ComposeAPI } from './compose.ts';

import type { ConnectorsAPI } from './connectors.ts';

import type { ExportAPI } from './export.ts';

import type { GeomAPI } from './geom.ts';

import type { ImagesAPI } from './images.ts';

import type { KeyframesAPI } from './keyframes.ts';

import type { LayersAPI } from './layers.ts';

import type { LiftAPI } from './lift.ts';

import type { MatteAPI } from './matte.ts';

import type { MediaAPI } from './media.ts';

import type { NetAPI } from './net.ts';

import type { OcrAPI } from './ocr.ts';

import type { PdfAPI } from './pdf.ts';

import type { PptxAPI } from './pptx.ts';

import type { ProfileAPI } from './profile.ts';

import type { RasterAPI } from './raster.ts';

import type { RecorderAPI } from './recorder.ts';

import type { ScanAPI } from './scan.ts';

import type { SpeechAPI } from './speech.ts';

import type { StateAPI } from './state.ts';

import type { TextAPI } from './text.ts';

import type { TokensAPI } from './tokens.ts';

import type { UpscaleAPI } from './upscale.ts';

import type { VizAPI } from './viz.ts';

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
   * Scan - detect machine-readable codes (QR, Data Matrix, Aztec, PDF417, the
   * 1D families) in one RGBA frame, fully on-device. The dual of the qr-code
   * generator (plans/162): every code the platform writes, it should read back,
   * with no "scan with our cloud". The shell owns the decoder ladder - native
   * `BarcodeDetector` where present, a lazy zxing-wasm chunk otherwise - and hands
   * the engine plain hits (text + optional bytes + quad), no DOM types, exactly
   * like `media`. Optional/additive (v1.153): a shell without a decoder omits it,
   * and it is NOT gated by a `capabilities` flag - a reader tool feature-degrades
   * (e.g. hides the live viewfinder, keeps the from-image path) where it is absent.
   * Pairs with `media` for a live viewfinder and stands alone for still images.
   */
  scan?: ScanAPI;

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
   * absent (the headless CLI attaches it over onnxruntime-node and refuses with a
   * `lolly models fetch` hint until the weights are staged). Because the run can take many
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
   * hides its "Copy text" affordance where it is absent (the headless CLI attaches
   * it over onnxruntime-node once its weights are staged). Like `matte`, NOT
   * driven from a time-boxed hook: a shell
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
   * is absent (the headless CLI attaches it over onnxruntime-node once the Kokoro
   * weights are staged - `lolly speak`). Runs locally; text is
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
   * by a `capabilities` flag: a tool feature-detects `host.raster` (undefined on a
   * shell with no canvas; the headless CLI attaches it over @napi-rs/canvas when
   * that package is installed) and degrades to its
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

/**
 * Host abilities a tool can require via tool.json `capabilities`. A shell runs a
 * tool only when it can fulfil every capability the tool declares. Keep in sync
 * with the enum in schemas/tool.schema.json.
 */
export type Capability =
  | 'network'
  | 'filesystem'
  | 'clipboard'
  | 'camera'
  | 'microphone'
  | 'ffmpeg'
  | 'wasm'
  | 'capture'
  | 'compose'
  // 'screen' (v1.54) - display capture via host.recorder (getDisplayMedia). Distinct from
  // 'capture', which rasterises a URL the tool names; 'screen' photographs whatever the
  // USER picks from their own desktop, so it's the more sensitive of the two.
  | 'screen';
