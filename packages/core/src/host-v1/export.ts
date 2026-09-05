// SPDX-License-Identifier: MPL-2.0

import type { IngredientCredential } from './assets.ts';

// ─── Export ─────────────────────────────────────────────────────────────────

/**
 * Descriptor for {@link ExportAPI.pack} - a Linux package a tool assembles from
 * files it already holds (fonts/icons/wallpapers). The shell maps this to the
 * engine's package writers; the tool never touches the RPM/cpio format itself.
 * (v1.178, plan 197.)
 */
export interface ExportPackSpec {
  /** `rpm` = a system package (/usr/share/…); `tar.gz` = the no-root home variant. */
  target: 'rpm' | 'tar.gz';
  /** How the shell lays the files out and wires scriptlets. */
  type: 'font' | 'app-icons' | 'generic';
  meta: {
    name: string;
    version: string;
    release?: string;
    summary: string;
    license: string;
    description?: string;
    vendor?: string;
    url?: string;
    group?: string;
    buildEpoch?: number;
  };
  /** type 'generic' / target 'tar.gz': files at absolute (rpm) or home-relative (tar.gz) paths. */
  files?: { path: string; data: Uint8Array; mode?: number }[];
  /** type 'font': the font files, an optional /usr/share/fonts subdir, and AppStream. */
  fonts?: { name: string; data: Uint8Array }[];
  foundry?: string;
  appstream?: { id: string; fontFamilies: string[]; metadataLicense?: string };
  /** type 'app-icons': the icons to place under hicolor. */
  icons?: {
    id: string;
    svg?: Uint8Array;
    symbolicSvg?: Uint8Array;
    rasters?: { size: number; png: Uint8Array }[];
  }[];
}

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
   * Seal files a tool holds into a Linux package and return the bytes (a `.rpm`
   * or `.tar.gz`), for a tool whose `exportFile` hook returns them. Like file(),
   * this is the user's own content - it NEVER watermarks or embeds provenance;
   * the RPM header carries only honest packaging metadata (name/licence/vendor).
   * The engine owns the package format; the tool only describes what it wants.
   * Additive (v1.178, plan 197); a shell without it should be feature-detected
   * (a tool falls back to a plain zip/tarball via file()).
   */
  pack?(spec: ExportPackSpec): Promise<Uint8Array>;

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
   * a shell without a rasteriser returns the input unchanged.
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
  | 'png'
  | 'apng'
  | 'gif'
  | 'jpg'
  | 'svg'
  | 'emf'
  | 'eps'
  | 'eps-cmyk'
  | 'pdf'
  | 'pdf-cmyk'
  | 'cmyk-tiff'
  | 'html'
  | 'webm'
  | 'mp4'
  // Audio-only exports. 'opus' is Opus in a WebM container (audio/webm); 'ogg' is
  // Opus-in-Ogg (the honest voice-memo shape) and 'aac' is bare ADTS - both written
  // through mediabunny's Ogg/Adts output formats. 'flac' is lossless, via
  // @mediabunny/flac-encoder.
  | 'wav'
  | 'mp3'
  | 'm4a'
  | 'aac'
  | 'opus'
  | 'ogg'
  | 'flac';

export interface ExportOpts {
  scale?: number; // raster scale (1, 2, 3) - used when width/height absent
  quality?: number; // jpg quality 0-1
  background?: string; // override transparent
  watermark?: boolean; // forced true for experimental tools by the host
  filename?: string; // suggested filename

  // Output size. A number is CSS px; a string may carry a physical unit
  // ("210mm", "8.5in", "595pt", "800px"). The host converts per format at render
  // time: raster → pixels at `dpi`; PDF → points (resolution-free); SVG → the
  // unit itself with a px viewBox. (See engine/src/units.js.)
  width?: number | string;
  height?: number | string;
  dpi?: number; // raster DPI for physical units (default 300; px → 96)

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
  audio?: {
    id?: string;
    url: string;
    fadeIn?: number;
    fadeOut?: number;
    volume?: number;
    duck?: number;
    start?: number;
  };

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
// `bindToMeta` (e.g. claim, where the artist explicitly declares the
// copyright/licence of their OWN work). They are NEVER auto-derived from the profile
// - Lolly won't assert ownership the user didn't state - and, like every EXIF
// Copyright / XMP dc:rights out there, they are self-declared, not verified facts.
export interface ExportMeta {
  software: string; // "Lolly"
  source: string; // the tool's page ("https://lolly.tools/t/<id>"), or the site root when the id is unknown
  tool: string; // the tool's name
  /** The tool's manifest id and version. A display name is not unique across
   *  brands or locales; these let an inspected export name the exact tool that
   *  made it and let /verify reopen it by id. Absent on records written before
   *  engine 1.157 and on hand-built metas. */
  toolId?: string;
  toolVersion?: string;
  author: string; // "First Last" - '' if the user hasn't set a profile
  contact: string; // "email · phone" - '' if none
  description: string; // human-readable credit line
  /** Rights/copyright notice, e.g. "© 2026 Jane Doe. All rights reserved." User-
   *  asserted (bindToMeta 'copyright'); omitted/'' when none. Written to EXIF
   *  Copyright, PNG Copyright, SVG dc:rights, and the C2PA manifest's dc:rights. */
  copyright?: string;
  /** Licence label and/or URL, e.g. "CC BY 4.0 · https://creativecommons.org/licenses/by/4.0/".
   *  User-asserted (bindToMeta 'license'); omitted/'' when none. */
  license?: string;
}
