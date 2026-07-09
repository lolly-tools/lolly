// SPDX-License-Identifier: MPL-2.0
/**
 * Engine public surface.
 *
 * Host shells (web/Tauri/CLI) import from here. Tools NEVER import from here —
 * tools talk to the host through the capability bridge passed to their hooks.
 */

export { loadTool, ToolLoadError } from './loader.ts';
export type { LoadedTool, ToolManifest, ToolFetchFile, LoadToolOpts, ToolIntegrityOpts } from './loader.ts';
export {
  canonicalJson, sha256Hex, jwkThumbprint, importSpkiOrJwkPublicKey,
  signCatalogEnvelope, verifyEnvelopeSignature, verifyCatalogEnvelope, verifyToolFile,
  CATALOG_SIG_ALG, CATALOG_SIG_PATH, CATALOG_SIGNED_TOOL_FILES,
} from './catalog-integrity.ts';
export type {
  CatalogSignatureEnvelope, UnsignedCatalogEnvelope, IntegrityResult,
} from './catalog-integrity.ts';
export { validateManifest } from './validate.ts';
export { createRuntime } from './runtime.ts';
export { hydrate, annotateTemplate } from './template.ts';
export { sniffAnimatedRaster, sniffVideoContainer } from './media-sniff.ts';
export type { AnimatedRasterKind, VideoContainer } from './media-sniff.ts';
export { buildInputModel, summarizeInputs, DEFAULT_FILE_MAX_BYTES } from './inputs.ts';
export { parseUrlState, serializeUrlState, RESERVED } from './url-mode.ts';
export { packQuery, unpackToken, expandQuery, hasPackedState, isPackAvailable, PACK_PARAM } from './url-pack.ts';
export { packEncrypted, unpackEncrypted, hasEncryptedState, isEncryptAvailable, ENC_PARAM } from './url-pack.ts';
export { parseEmbedUrl } from './embed.ts';
export { parseToolUrl, buildEmbedUrl, isToolUrl } from './tool-url.ts';
export { toCSV, parseDelimited, detectDelimiter, parseBatchCsv, batchCsvTemplate } from './batch.ts';
export type { BatchRow, BatchTemplateTool } from './batch.ts';
export { buildExportMeta } from './metadata.ts';
export { extractFileMetadata, META_GROUP_ORDER, META_GROUP_LABEL } from './file-metadata.ts';
export type { FileMetadata, MetaField, MetaGroup } from './file-metadata.ts';
export { stripMetadata, isStrippableFormat } from './strip-metadata.ts';
export type { StripFormat } from './strip-metadata.ts';
export {
  embedWatermark, detectWatermark, WATERMARK_VERSION, DEFAULT_STRENGTH, DETECT_THRESHOLD,
} from './pixel-watermark.ts';
export type { EmbedOptions, DetectResult, WatermarkGeometry } from './pixel-watermark.ts';
export {
  UNITS, CSS_DPI, isUnit, parseDimension,
  toInches, isPhysical, toPixels, toPoints, toCssPx, toCssLength, toUnit,
} from './units.ts';
export {
  srgbIccProfile, iccProfileBytes, COLOR_PROFILES,
  rgbToCmyk, cmykCondition, CMYK_CONDITIONS, DEFAULT_CMYK_CONDITION,
} from './color.ts';
export {
  computePrintGeometry, cmykToRgbApprox, PRINT_MARK_DEFAULTS,
} from './print-marks.ts';
export { parseSvgPath, parseSvgPathArgs, svgArcToBeziers } from './svg-path.ts';
export {
  parseCssLength, cornerRadii, uniformRadius, insetCorners, roundedRectPath, parseBoxShadow,
} from './css-box.ts';
export {
  parseClipShape, parseRadialGradient, parseDropShadowFilter,
  splitCssArgs, parseGradientAngle, parseGradientStop,
} from './css-paint.ts';
export type { ClipShape, GradientStop, RadialGradient, DropShadow } from './css-paint.ts';
export { emitEmf } from './emf.ts';
export { emitEps } from './eps.ts';
export { emitDxf } from './dxf.ts';
export { buildPptxParts, EMU_PER_INCH, EMU_PER_PX } from './pptx.ts';
export type {
  PptxSlide, PptxShape, PptxRect, PptxText, PptxPic, PptxRun, PptxPara, PptxFill, PptxMedia, PptxBuildOpts,
} from './pptx.ts';
export {
  buildPdfXXmp, formatPdfDate, makeDocumentId, pdfxOutputIntentSpec, PDFX_VERSION,
} from './pdfx.ts';
export { buildC2paManifest, embedC2paInPdf, embedC2pa, exportActionSteps, C2PA_FORMATS, LOLLY_EXPORT_ASSERTION, DIGITAL_SOURCE_TYPE } from './c2pa.ts';
export type { C2paActionInput } from './c2pa.ts';
export { verifyC2pa, verifyC2paPdf, extractC2paFromPdf, prepareC2paIngredient, prepareC2paIngredientFromStore, extractC2paStore } from './c2pa-verify.ts';
export type { C2paIngredientData } from './c2pa-verify.ts';
export { c2paTrustAnchors } from './c2pa-trust.ts';
export { pemToDer, derToPem, generateCaRoot, issueLeafCert } from './x509.ts';
export { packApng } from './apng.ts';
export { packWebpAnim } from './webp-anim.ts';
export { packTiff } from './tiff.ts';
export { videoProvenanceTags, embedMp4Meta, embedWebmMeta } from './video-meta.ts';
export { parseDataRows, DEFAULT_ROW_LIMIT } from './data-import.ts';
export {
  decomposeMatrix, boxGeomFromBBox, mapWeight, mapFontFamily, mapAlign,
  safeColor, nodeToBox, finalizeBoxes, parsePenpotContent, penpotShapeToNode,
  figmaNodesToNodes, colorRunsToText, decodeFigVectorPath,
} from './design-map.ts';
export { interpretPdfPage, parseToUnicode, toUnicodeDecoder } from './pdf-map.ts';
export type { PdfPageInput, PdfNode, PdfResources, PdfXObject, PdfFontInfo, FontDecoder } from './pdf-map.ts';
export {
  createTokenSet, resolveColorValue, colorToHex,
  isAlias, aliasPath, isTokenValue, TOKEN_EXT,
} from './tokens.ts';
export {
  parseOklch, formatOklch, hexToOklch, oklchToHex, contrastRatio, deriveBrandTokens,
} from './brand-derive.ts';
export type { Oklch, BrandDeriveOptions } from './brand-derive.ts';
export {
  coerceTokensDoc, assembleTokenSetFiles, extractPenpotProject, summarizeTokensDoc,
} from './brand-import.ts';
export type { TokensExtraction } from './brand-import.ts';
export {
  parseThemedAssetId, buildThemedAssetId, isThemableIconSvg, isValidThemeId,
  applyIconTheme, restyleIconTheme, parseIconThemesDoc,
} from './icon-theme.ts';
export type { IconTheme, IconThemesDoc, ParsedThemedAssetId } from './icon-theme.ts';
export {
  parseTreatedAssetId, buildTreatedAssetId, isValidTreatmentId, stripAssetModifiers,
  parsePhotoTreatmentsDoc, treatmentFilterSvg, wrapRasterWithTreatment,
} from './photo-treatment.ts';
export type { PhotoTreatment, PhotoTreatmentsDoc, ParsedTreatedAssetId, RasterTreatmentWrap } from './photo-treatment.ts';
export {
  hashR6, preparePassword, buildEncryptDictValues, encryptObjectBytes,
} from './pdf-crypto-r6.ts';
export type { EncryptDictInput, EncryptDictValues } from './pdf-crypto-r6.ts';
export {
  crc32, zipCryptoEncrypt, deriveAesZipKey, aesZipEncryptEntry, buildEncryptedZip,
} from './zip-crypto.ts';
export type { ZipTier, ZipEntryInput, AesZipKeys } from './zip-crypto.ts';

// 1.1.0 — additive: `file` input type, the transform output path
// (host.export.file + the `exportFile` hook + runtime.exportFile), and the
// `privacy: 'on-device'` utility marker. All backwards-compatible with ^1.0.0
// tools; no v1 method was removed or changed.
// 1.2.0 — additive: tool composition / nested renders — the optional
// `host.compose` capability + manifest `composes` (rendered via resolveNestedRenders
// into `{{asset <id>}}` extras). Backwards-compatible; shells without compose just
// don't resolve composes (the {{#if}} slot stays empty).
// 1.3.0 — additive: end-user tool-as-image. A Lolly tool URL (share link / embed
// URL) pasted into the asset picker becomes an asset whose `id` is the canonical
// embed URL; the runtime re-renders it on load via the new optional
// `host.compose.renderUrl` (see tool-url.js). Backwards-compatible; a shell
// without renderUrl simply leaves such an asset blank.
// 1.4.0 — additive: live media. The optional `host.media` capability (a camera
// frame source) plus a new `onFrame` hook + runtime.startLive/stopLive let a tool
// react to a live camera stream frame-by-frame (e.g. a filter that responds to
// motion). Pure progressive enhancement: the hook is only driven where the shell
// provides host.media; a shell without it (or a tool without onFrame) is unaffected,
// and such tools keep working as ordinary still-image tools. No v1 method changed.
// 1.5.0 — additive: packed URL state. A whole readable query can be compressed into
// a single reserved `z` param (raw DEFLATE + base64url — url-pack.js: packQuery /
// unpackToken / expandQuery) so complex tools stay shareable past the ~2000-char URL
// ceiling. Pure URL-mode enhancement — no bridge/host method added or changed; the
// codec is native (CompressionStream) with graceful fallback to the readable form.
// 1.6.0 — additive: themable two-colour icons. An asset id may carry a colour
// pairing (`<baseId>?theme=<themeId>` — icon-theme.js) which shell bridges parse
// before catalog lookup and bake into the resolved SVG at resolve time; pairings
// are catalog data (a palette-type asset tagged "icon-themes"), never engine code.
// No v1 method signature changed — host.assets.get/isAvailable simply accept the
// suffixed id form; a shell that ignores it still resolves the base asset.
// 1.7.0 — additive: two independent format extensions.
//   • `parseDataRows` (data-import.js) maps a user's CSV/JSON file onto a `blocks`
//     input's sub-fields, driven by the new manifest `blocks.importData` — the
//     ingest counterpart to CSV/JSON export. Pure; the result flows through the
//     ordinary input-set path (URL/save-safe).
//   • `packTiff` (tiff.js) is a baseline RGB/grayscale TIFF emitter backing the new
//     `tiff` export format (the DeviceCMYK TIFF keeps its bespoke shell encoder).
// No bridge/host method was added or changed; older tools are unaffected.
// 1.8.0 — additive: on-device Content Credentials verification (c2pa-verify.js —
// verifyC2paPdf / extractC2paFromPdf). The read-side counterpart to the 1.x C2PA
// embedder: extracts a PDF's manifest, re-checks hashed URIs, the COSE claim
// signature, cert validity and the hard binding, and reports c2pa-rs-style
// status codes. Backs the web shell's /valid view and the CLI `validate`
// command. Pure engine module; no bridge/host method added or changed.
// 1.9.0 — additive: Content Credentials for every embeddable raster/vector
// container. embedC2pa(bytes, format, opts) stamps png/apng, jpg, gif, svg,
// tiff/cmyk-tiff and webp (byte-matching c2pa-rs's asset handlers, same
// two-pass hard binding as the PDF path), the claim gains
// claim_generator_info + digitalSourceType + an optional `tools.lolly.export`
// environment assertion, and verifyC2pa() sniffs + verifies all of the above.
// mp4/webm (BMFF/Matroska hashing) and avif stay unstamped for now; ico, eps,
// emf and the text/data formats have no C2PA container. No bridge change.
// 1.10.0 — additive: Content Credentials for video. embedC2pa stamps mp4 (the
// spec's BMFF binding: manifest in a top-level C2PA `uuid` box appended last —
// stco/co64 never shift — under c2pa.hash.bmff.v2, whose box-walk hash matches
// c2patool byte-for-byte) and webm (no standardised Matroska binding exists,
// so the manifest rides as a `manifest.c2pa` attachment, application/c2pa,
// under the ordinary data-hash binding; SeekHead indexed when there's Void
// room). verifyC2pa sniffs mp4/webm/mkv, extracts both carriers and validates
// c2pa.hash.bmff.v1–v3 flat bindings (foreign c2patool-signed mp4s included;
// fragmented/Merkle reported honestly as uncheckable). No bridge change.
// 1.11.0 — additive: Content Credentials identity. embedC2pa / embedC2paInPdf
// accept opts.signer ({ privateKey | sign(bytes) → raw 64-byte r||s, certDer,
// chain }) so a CA-issued device credential replaces the ephemeral self-signed
// signer (chain bytes frozen per embed; ES256/P-256 only), and verifyC2pa
// accepts { trustAnchors } (root cert DERs) to verify the x5chain and report a
// trusted identity instead of the unconditional untrusted row. The DER/X.509
// authority moved from c2pa.js to x509.js (byte-identical output), which adds
// pemToDer / derToPem / generateCaRoot / issueLeafCert — the leaf follows the
// c2pa-rs profile (O + CN subject, emailProtection EKU, SKI/AKI, SAN
// rfc822Name = verified email). Pure options on pure functions; no bridge
// change.
// 1.12.0 — additive: richer text shaping on host.text.toPath. The already-declared
// `features` (OpenType tags, e.g. ['liga=0', 'salt=1']) is now honoured — passed to
// HarfBuzz so ligatures/stylistic-alternates toggles bake into the outlined paths —
// and a new `letterSpacing` (px) adds uniform tracking to the pen advance, so
// letter-spaced text stays outlined (SVG/PDF/EMF) instead of falling back to a live
// <text> element. Additive optional opts on an existing method; no bridge change.
// 1.13.0 — additive: PDF / Adobe Illustrator (.ai) design import. `interpretPdfPage`
// (pdf-map.js) reconstructs a page's content stream into editable DesignNodes —
// rectangles/ellipses/text/optional-content-group layers become boxes with real
// (y-flipped) coordinates, arbitrary paths become baked SVG `_vectorPath` images, and
// form XObjects recurse — the PDF counterpart to the Figma/Penpot walkers. Helpers
// `parseToUnicode` / `toUnicodeDecoder` recover text from embedded/subset fonts. Pure
// engine module; the shell (pdf-import.js) owns the pdf-lib byte work. No bridge change.
// 1.14.0 — additive: AES-256 (R6 / ISO 32000-2) PDF standard-security-handler
// encryptor (pdf-crypto-r6.js) — the pure crypto behind the "Strong lock" export
// tier. buildEncryptDictValues computes /U /O /UE /OE /Perms and encryptObjectBytes
// wraps each object (IV ‖ AES-256-CBC-PKCS#7, one file key for all objects); DOM-free
// (globalThis.crypto only) with all randomness injected as params, so it round-trips a
// fixed byte vector. Applied encrypt-last over finished PDF bytes; the shell owns the
// pdf-lib object walk + /Encrypt dict assembly. Pure engine module; no bridge change.
// 1.15.0 — additive: two-tier whole-zip encryption (zip-crypto.js) — the crypto
// behind the "lock this download" option. buildEncryptedZip frames an encrypted zip
// from pre-compressed entries: `standard` = traditional PKWARE ZipCrypto (opens
// anywhere incl. Windows Explorer, weak), `strong` = WinZip AES-256 / AE-2 (PBKDF2-
// SHA1 + AES-256 little-endian CTR + HMAC-SHA1; strong, but not Windows Explorer's
// built-in extract). DOM-free (globalThis.crypto only; bundles a small AES core for
// the LE-CTR keystream since subtle has no ECB and is too slow per-block); all
// randomness injected as params so it round-trips a fixed vector. Verified against
// `unzip -P` and pyzipper. Shell compresses with fflate + hands over bytes + CRC; no
// bridge method changed.
// 1.16.0 — additive: animated + video assets, end to end.
//   • `sniffAnimatedRaster` / `sniffVideoContainer` (media-sniff.js) classify an
//     upload from its header bytes so a shell can tell an animated GIF/APNG/animated-
//     WebP from a still one (same MIME, different container) and store it VERBATIM
//     instead of flattening it through a canvas re-encode. Pure, DOM-free.
//   • a logic-less `{{media <asset>}}` template helper emits the right element per
//     asset type — <img> for raster/vector (unchanged), a data-lottie-src marker for
//     lottie (reuses the existing enhancer), and <video autoplay loop muted playsinline>
//     for video — so any tool can consume the new asset kinds without per-tool if/else.
//     Every attribute is escaped (SafeString discipline, like the `markdown` helper).
//   • AssetRef.meta.posterUrl is documented as the still fallback frame for a video
//     (used for <video poster> and as the export/pre-play still), mirroring lottie.
// Helpers are not part of the HostV1 contract, so no bridge version moved; older
// shells still render the emitted markup (and, absent the shell's export snapshot,
// simply drop the moving frame to a still). No v1 method changed.
// 1.17.0 — additive: device capture. New optional `host.recorder` (RecorderAPI)
// records the microphone (and optionally the camera) to a Blob and exposes a
// DOM-free live level meter (AudioLevel = rms/peak/dbfs/clipping/t) — the audio
// counterpart to host.media's camera frames; the shell owns getUserMedia +
// MediaRecorder + AnalyserNode, the engine sees only numbers + Blobs. New
// `microphone` Capability (record prompts for a grant a shell may lack, so unlike
// media it IS capability-gated; the CLI provides no recorder). Runtime gains an
// `onLevel` hook (drop-overlap, not time-boxed, mirroring onFrame) plus
// startMeter/stopMeter (sound-check) and startRecording/stopRecording/cancelRecording
// orchestration. ExportOpts.audio gains fadeIn/fadeOut (seconds) — a GainNode
// envelope baked into the muxed bed, so music fades need no pre-faded assets.
// 1.18.0 — additive: honest provenance modes. embedC2pa / buildC2paManifest /
// embedC2paInPdf accept opts.authorship ('created' | 'delivered', default
// 'created'). 'delivered' writes the standard c2pa.published action with NO
// digitalCreation source type — for an existing asset a signer distributes but
// did not author (surfaced as "Delivered by Lolly"). verifyC2pa now requires a
// c2pa.created action for `madeWithLolly` (a delivered asset may name Lolly
// without ever reading as authored by it) and adds `report.delivered`
// (intact + a c2pa.published action, not created). The created path is
// byte-unchanged. No bridge change.
// 1.19.0 — additive: honest audio-level coaching. AudioLevel (host.recorder meter +
// record session) gains OPTIONAL noiseFloor/snr/hum/hiss fields — a slow min-hold
// noise floor, signal-to-noise ratio, and two spectral cues (mains-band HUM ratio,
// spectral-flatness HISS) computed off the AnalyserNode the shell already builds, so
// a tool can honestly warn "noisy room / electrical hum / hiss" not just clipping.
// Older tools ignore the extra fields. The web meter now opens RAW (noiseSuppression/
// AGC/echoCancellation OFF) so the sound-check measures the true room; the RECORDING
// session keeps suppression ON for a clean file. No method signatures changed.
// 1.20.0 — additive: AudioLevel gains OPTIONAL `steady` (0..1) — the steadiness of the
// loudness envelope over ~1.5s (rms coefficient-of-variation, inverted). A fan/AC/hiss
// holds a constant rms (steady→1); speech modulates it (steady→0). Lets coaching tell
// constant background NOISE from SPEECH regardless of level — a mid-level hiss that a
// min-hold noise floor + snr would mistake for "speaking" now reads as a drone. Computed
// off the rms the meter already tracks; older tools ignore it. No method signatures changed.
// 1.21.0 — additive: front/rear camera selection. RecordOpts gains OPTIONAL `facingMode`
// ('user' | 'environment') and MediaAPI.start() gains an OPTIONAL { facingMode } argument,
// so a video-capture tool can offer a flip-camera control (record the scene, not the selfie).
// Both default to 'user'; existing callers and shells that ignore it are unaffected — a
// shared/ref-counted media stream keeps its original camera (flip = stop then start).
// 1.22.0 — additive: DXF export. `emitDxf` (dxf.ts) is a fourth sink on the SVG
// vector pipeline (alongside emitEmf / emitEps): it serializes the same normalized
// device-px IR into an ASCII DXF R12 (AC1009) document — POLYLINE entities with
// béziers flattened to a flatness tolerance, y-flipped and scaled to millimetres
// ($INSUNITS = 4), colour as a nearest AutoCAD Color Index — for CAD / laser-cut /
// vinyl / CNC interchange. Text is outlined upstream (no TEXT entities); the raster
// escape-hatch has no line-art form and is dropped (count returned so the shell can
// warn). Pure, imports only units.ts; no bridge/host method added or changed.
// 1.23.0 — additive: PPTX (PowerPoint) export. `buildPptxParts` (pptx.ts) assembles
// the OOXML part tree for a deck (content types, relationships, a minimal slide
// master + blank layout + theme, presentation.xml, docProps) and serializes each
// slide's SHAPES to DrawingML — pic (raster at native res, OR a real embedded SVG via
// PowerPoint's asvg:svgBlip extension so vectors extract at full fidelity), text
// (editable text box), rect (solid/gradient/border block). The shell walks the DOM
// into shapes + media and zips with fflate. Purpose: transport a page's treated
// images + vectors into PowerPoint as independent, extractable objects (layout
// secondary). Pure: strings + byte arrays, no zip, no DOM, no deps. No bridge change.
// 1.24.0 — C2PA 2.x claims. buildC2paManifest / embedC2pa / embedC2paInPdf now emit a
// v2 claim (`c2pa.claim.v2`) by default — the format Gemini and every current C2PA
// validator (c2patool, contentcredentials.org / c2pa-rs) produce and read: no free-text
// claim_generator, no dc:format, a REQUIRED single claim_generator_info map, references
// split into created_assertions (+ optional gathered_assertions), the actions assertion
// relabelled c2pa.actions.v2 (softwareAgent a generator-info map), and the schema.org
// CreativeWork author assertion dropped (the 2.x spec removed it). Box UUIDs, the
// data-hash / BMFF bindings, the COSE ES256 envelope, the x509 signer, and every
// per-format embedder are version-independent and unchanged; the two-pass length-freeze
// carries the differently-shaped-but-deterministic v2 claim. buildC2paManifest keeps an
// internal `claimVersion` (default 2; `1` builds the legacy c2pa.claim) purely so the
// verifier's v1-read path stays test-covered — the embedders never request it, so Lolly
// only ever WRITES v2. verifyC2pa now READS both: it branches on the claim box label,
// reads created_assertions + gathered_assertions and the single-map claim_generator_info,
// and recognises c2pa.actions.v2 — so external v2 credentials (Gemini "Nano Banana",
// Adobe, OpenAI, …) verify on-device instead of failing `credential.unreadable`. No
// bridge change.
// 1.25.0 — additive: catalog signing + runtime integrity verification
// (catalog-integrity.ts — closes the SOVEREIGNTY.md "catalog origin is a trust
// anchor" boundary). A deployment signs its tool catalog at build time
// (scripts/sign-catalog.ts writes catalog/tools/index.sig.json: a sha256 per
// tool file — hooks.js included — plus a hash of the exact index.json bytes,
// ECDSA P-256/SHA-256 over the canonical-JSON envelope; canonicalJson is the
// single shared serialization on both sides). A shell that pins the public key
// passes loadTool's new optional `integrity` opts ({ envelope, publicKey }):
// the loader then verifies every fetched tool file BEFORE the runtime can
// compile hooks.js — a tampered, stripped-but-signed, or unsigned-extra file
// is a hard ToolLoadError (fail closed; this also closes the tryFetch
// silent-strip hole for signed hooks.js/styles.css), and module-hooks tools
// are refused outright since their imported bytes never pass through the
// loader. Without integrity opts nothing changes except a one-time
// "unsigned catalog" console warning (the dev/compat path). Pure engine
// module, DOM-free (globalThis.crypto.subtle only); no bridge change.
// 1.26.0 — additive: honest export action history + ingredient credential
// preservation. (1) buildC2paManifest / embedC2pa / embedC2paInPdf accept
// `actions` (a C2paActionInput[] — action code + optional digitalSourceType +
// description), REPLACING the historic single created/published action; the new
// exportActionSteps(format, flags) assembles an honest list from what an export
// actually did (c2pa.created + c2pa.color_adjustments on CMYK/brand-palette +
// c2pa.edited on print marks / experimental watermark + c2pa.converted on a
// raster/video/PDF render — vector/text outputs add nothing). No `actions` →
// byte-identical to before. verifyC2pa now surfaces each action's `description`.
// (2) `ingredients` (C2paIngredient[] from prepareC2paIngredient /
// prepareC2paIngredientFromStore, sourced from extractC2paStore) carry a placed
// credentialed asset's manifests VERBATIM into the new store as a MULTI-manifest
// store (ingredient manifests before the active one), plus a c2pa.ingredient.v3
// assertion (activeManifest hashed-URI) and a c2pa.opened action that propagates
// the ingredient's AI/ML digitalSourceType onto the NEW asset's own active
// manifest (the opened action also carries parameters.ingredients, and the
// c2pa.ingredient.v3 assertion its required validationResults) — so an AI or
// camera origin is never laundered away (the AI flag fires from Lolly's signed
// actions even if the ingredient manifests are stripped). Bridge (additive):
// host.assets.credential?(id) returns a user upload's captured manifest store
// (kept at ingest, manifest-only — no pixels/EXIF), and ExportOpts.ingredients
// threads it runtime → export. Both the multi-action and multi-manifest outputs
// validate as `Valid` in the reference c2patool (contentauth c2pa-rs) — see the
// gated conformance test tests/c2pa-c2patool-conformance.test.ts — with only the
// expected self-signed untrusted markers.
//
// 1.27.0 — richer, self-describing exports + a JPEG multi-manifest read fix.
// (1) New summarizeInputs(model) returns a compact scalar-input digest (id →
// short string: colours, sizes, toggles, short text; skips uploads, repeating
// groups, long text, and profile-bound PII). The runtime derives it when C2PA
// stamping is on and threads it via ExportOpts.c2paInputs; each shell records it
// (plus the export date + output dimensions) under the tools.lolly.export
// assertion, so an inspected asset shows "what it was made from / where / when /
// how big". verifyC2pa now surfaces report.environment.inputs (the nested digest,
// string→string only). Purely additive — no digest → byte-identical to before.
// (2) extractC2paFromJpeg now reassembles the manifest store by APP11 box-instance
// (En) + sequence (Z) instead of scanning every segment for the store UUID — an
// assertion URL that plants "c2pa" in a continuation chunk no longer trips a false
// "more than one manifest store" rejection (multi-manifest JPEGs, e.g. a design
// composed from AI-generated ingredients, now verify like their PNG/PDF siblings).
// 1.28.0 — additive: OKLCH-native brand tokens. brand-derive.ts is the engine's
// sRGB↔OKLCH authority (parseOklch/formatOklch/hexToOklch/oklchToHex — with
// deterministic chroma-reduction gamut mapping — plus WCAG 2.1 contrastRatio)
// and deriveBrandTokens(), which turns one brand colour into a complete layered
// DTCG document (base ramps + brand-tinted spectrum + contrast-enforced
// light/dark semantic slots) in exactly the shape createTokenSet consumes.
// colorToHex now reads oklch()/lch() strings via that module, and the barrel
// exports the brand-import container extractors (coerceTokensDoc /
// assembleTokenSetFiles / extractPenpotProject / summarizeTokensDoc). Pure
// engine modules; no bridge change.
// 1.29.0 — additive on host.text: TextToPathOpts.variations (HarfBuzz axis
// settings, e.g. ['wght=700']) so a VARIABLE face outlines at the run's actual
// weight; TextPathResult.notdef (missing-glyph count) so a caller can prefer
// its <text> fallback over outlining tofu; and TextToPathOpts.fallbackFonts (an
// ordered face chain, shaped segment-by-segment) for the disjoint unicode
// subsets a webfont family ships as. All optional; older hosts keep working.
// 1.30.0 — additive on host.text: TextAPI.axisDefaults() returns a variable
// font's default-instance axis values, so a caller that embeds the raw file
// into a renderer with no variable-axis control (jsPDF) can tell whether it'll
// render at the weight it asked for. Optional; absent on older hosts.
// 1.31.0 — provenance chains for DERIVED assets. (1) The runtime's export-time
// ingredient sweep now also notes library/catalog-sourced asset inputs (source
// 'library', not just 'user'), so a credentialed CATALOG image placed into a
// tool carries its chain — host.assets.credential(id) may serve those ids by
// extracting the store from the asset's own bytes (semantics widened, signature
// unchanged). (2) c2pa.ts exports C2paActionInput + DIGITAL_SOURCE_TYPE so a
// shell can assemble an honest custom history (recolour / colour treatment /
// crop / re-encode steps) for embedC2pa — used by the web catalog's download
// paths, which now re-sign modified assets with the source credential preserved
// as an ingredient instead of shipping unsigned bytes.
export const ENGINE_VERSION = '1.31.0';
