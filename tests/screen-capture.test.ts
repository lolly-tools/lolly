// SPDX-License-Identifier: MPL-2.0
/**
 * The v1.54 "screencap" surface at the engine/schema/contract seams.
 *
 * This proves the additive contract holds where a tool actually meets the
 * platform: both tool.schema.json copies accept the new `screen` capability and
 * `render.capture: "screen"`, the engine version bumped to 1.54.0, and a tool
 * declaring `^1.54.0` loads against the running engine (the v1.53 engineVersion
 * enforcement doesn't refuse it). The C2PA source-type behaviour is covered by
 * export-action-steps.test.ts; here we cover schema + version + loadTool.
 *
 * The two schema copies are kept byte-identical by an existing drift guard
 * (tests/lolly-tools-core.test.ts, `no drift`), so this file does NOT re-compare
 * them - it exercises each copy's real VALIDATOR instead, which the drift guard
 * does not: validateManifest (engine, reads schemas/tool.schema.json) and
 * validateTool (@lolly-tools/core, reads packages/core/schema/tool.schema.json).
 *
 * Run with: node --test tests/screen-capture.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateManifest } from '../engine/src/validate.ts';
import { validateTool } from '../packages/core/src/index.ts';
import { loadTool, ToolLoadError } from '../engine/src/loader.ts';
import { ENGINE_VERSION } from '../engine/src/version.ts';
import { satisfiesRange } from '../engine/src/semver-range.ts';

/** A well-formed screencap manifest, optionally with overrides merged in. */
function screencapManifest(overrides: Record<string, unknown> = {}): any {
  return {
    id: 'screencap',
    name: 'Screencap',
    version: '1.0.0',
    engineVersion: '^1.54.0',
    status: 'official',
    capabilities: ['screen'],
    render: { width: 1280, height: 720, formats: ['png'], capture: 'screen' },
    inputs: [{ id: 'shot', type: 'asset' }],
    ...overrides,
  };
}

// ─── schema: both copies, via their real validators ──────────────────────────

test('engine validateManifest (schemas/tool.schema.json) accepts screen capability + capture', () => {
  const { valid, errors } = validateManifest(screencapManifest());
  assert.equal(valid, true, JSON.stringify(errors));
});

test('core validateTool (packages/core/schema/tool.schema.json) accepts screen capability + capture', () => {
  const { valid, errors } = validateTool(screencapManifest());
  assert.equal(valid, true, JSON.stringify(errors));
});

test('both validators still REJECT a bogus capability', () => {
  const bogus = screencapManifest({ capabilities: ['screeen'] }); // typo - not in the enum
  assert.equal(validateManifest(bogus).valid, false, 'engine schema must reject an unknown capability');
  assert.equal(validateTool(bogus).valid, false, 'core schema must reject an unknown capability');
});

test('both validators still REJECT a bogus render.capture value', () => {
  const bogus = screencapManifest({
    render: { width: 1, height: 1, formats: ['png'], capture: 'display' }, // not audio/video/av/screen
  });
  assert.equal(validateManifest(bogus).valid, false, 'engine schema must reject an unknown capture mode');
  assert.equal(validateTool(bogus).valid, false, 'core schema must reject an unknown capture mode');
});

test('the sensor capabilities still validate (screen is additive, not a replacement)', () => {
  for (const cap of ['camera', 'microphone', 'screen']) {
    const m = screencapManifest({ capabilities: [cap] });
    assert.equal(validateManifest(m).valid, true, `engine: ${cap}`);
    assert.equal(validateTool(m).valid, true, `core: ${cap}`);
  }
});

// ─── version ─────────────────────────────────────────────────────────────────

test('ENGINE_VERSION is 1.128.0', () => {
  // A literal pin: the screencap surface shipped at 1.54, and tools declare
  // ^1.54.0 to require it. session-record only checks the stamp equals whatever
  // ENGINE_VERSION happens to be (tautological) - this catches an errant bump.
  // Moved 1.60.0 → 1.61.0 by the deliberate HDR raster-export bump (hdr.ts,
  // PQ/BT.2020), then 1.62.0 (crop culling: cullPdfNodes/pdfNodeExtent) and
  // 1.63.0 (/Luminosity soft masks) and 1.64.0 (host.geom - the geometry kernel's
  // tool-facing surface) and 1.65.0 (canvas time-field mappings - the Fable
  // timeline time model, phase 1) and 1.66.0 (the reserved `cuts` URL param - 
  // contact-sheet still exports, timeline phase 2.5) and 1.67.0 (the `zzfxm:`
  // procedural asset-id scheme - zzfxm-ref.ts) and 1.68.0 (host.color.mix +
  // host.color.gradientCss - CSS Color 4 interpolation and the gradient spec)
  // and 1.69.0 (host.color.gamut/maxChroma/slice - display-gamut classification
  // and the OKLCH slice planes behind the brand studio's gamut charts and the
  // Colour Lab tool) and 1.70.0 (host.color.iccProfile/inProfileGamut/
  // profileMaxChroma/inkCoverage - the user's own ICC profile as a gamut, so
  // "will this print?" has an answer) and 1.71.0 (host.audio - decoded sound in,
  // a per-frame reactivity track out) and 1.72.0 (host.viz - the MilkDrop
  // visualizer as something a tool can drive) and 1.73.0 (the 'profile' asset
  // type - a user-supplied ICC profile stored on the user-asset rail) and 1.74.0
  // (pdfxProfileEligibility + iccCharacterization + supplied DestOutputProfile
  // bytes - a user's own CMYK profile can be embedded in a PDF/X-4 output intent)
  // and 1.75.0 (extractPageText/joinPageText - a PDF's positioned glyph runs
  // reassembled into reading-ordered prose, plus the WinAnsi decoding fix) and
  // 1.76.0 (findHiddenText - text an opaque shape is painted over, i.e. the
  // failed-redaction check, decided on paint order) and 1.77.0 (color-faces - 
  // per-space/per-profile overrides on a brand colour, with ColorSwatch.faces
  // added and ColorSwatch.value now returning an AUTHORED sRGB face in
  // preference to the automatic bake) and 1.78.0 (the `table` input type +
  // render.paginate - one page per table row, plus the table-text codec) and
  // 1.79.0 (PptxInspectResult.content - the slide node-kind tally that lets a
  // rebrand tool warn that a flattened, picture-only deck cannot change) and
  // 1.80.0 (markdown links + images in the {{markdown}} helper, and the
  // render.filmstrip edge for paged tools) and 1.81.0 (manifest `guide` - a
  // tool's own short walkthrough, translated through its i18n sidecar) and
  // 1.82.0 (paginate context `col` + `page.byColumn` - the cell addressing the
  // web shell's on-canvas table editing binds to) and 1.83.0 (figmaNodesToScenes
  // - per-frame design-import scenes, behind the sequence editor's
  // canvas.import.mode:'scenes') and 1.84.0 (readingOrder - scene import plays
  // decks in reading order, not Z order) and 1.85.0 (host.pdf.redact - 
  // rasterise-and-rebuild PDF redaction - and host.c2pa.sign - a fresh
  // no-ingredients manifest for redacted derivatives) and 1.86.0 (src/pixels.ts - 
  // the DeepFrame float-RGBA buffer in linear light with its PixelSpace travelling
  // alongside, plus the u8/u16/binary16 converters and convertSpace; engine-only,
  // no HostV1 method added) and 1.87.0 (Penpot format currency: token-first brand
  // ingest - scanPenpotAppliedTokens/typographyFamilies - plus dash/gap stroke
  // patterns and background-blur import; engine-only, no HostV1 method added) and
  // 1.88.0 (the reserved `depth` URL param + the additive ExportOpts.depth field,
  // and src/png.ts - the engine's own 8/16-bit PNG writer behind the first deep
  // output: 16-bit cICP HDR PNG. A field, not a method, so every existing shell
  // is unaffected) and 1.89.0 (the gain-map JPEG: src/gainmap.ts, src/gainmap-jpeg.ts
  // and src/jpeg-segments.ts, plus readMpfIndex/appendedIsExpected on the
  // file-metadata surface, behind ISO 21496-1 / Ultra HDR HDR JPEG export;
  // engine-only, no HostV1 method added) and 1.90.0 (four additive optional
  // fields on PdfRedactOpts - color/radius/label/labelColor, the branded
  // redaction mark - plus the inflate-by-radius containment rule; fields, not a
  // method, so every existing shell is unaffected) and 1.91.0 (SpotColor.finish
  // + the OPEN FinishKind union - a brand declaring that one of its inks is a
  // foil, an emboss/deboss, a spot varnish or a cutting rule, i.e. an ink the
  // press applies as its own plate rather than part of the process build. A
  // field, not a method; absent means what it always meant, and an unrecognised
  // finish degrades to none rather than failing the whole spot lock closed) and
  // 1.92.0 (src/exr.ts - a scanline OpenEXR writer, half/float, ZIP - and
  // src/radiance.ts - an RGBE .hdr writer+reader - plus deflate.ts's slab-fed
  // incremental deflater, which lifts png.ts's 16 MiB single-shot ceiling.
  // All three are engine-internal (not in the barrel) and surfaced CLI-first as
  // --export=exr/hdr; no HostV1 method or field was added) and 1.93.0 (src/preflight.ts
  // - the rules-over-facts preflight evaluator, plus the Finding contract in
  // @lolly-tools/core and src/cmyk-palette.ts lifted so both shells build the spot
  // palette identically. Rules in the engine, facts collected per shell, exactly the
  // print-marks split; no HostV1 method or field was added) and 1.94.0
  // (src/provenance-defaults.ts - the manifest-read policy for "is this export
  // credentialed / imprinted by default", previously private to the web shell, plus
  // an `includeVendored` option on defaultTrustAnchors so a verifier can ask for an
  // EMPTY anchor set. Both are shell-side policy; no HostV1 method or field was added,
  // and a tool cannot see either) and 1.95.0 (src/rate-card.ts - parseRateCard + the
  // cost arithmetic over preflight counts, the packages/core money.ts serialized shape,
  // and the 'ratecard' user-asset type. It multiplies a rate the user supplied by a
  // quantity Lolly counted and never originates a price; no HostV1 method was added, and
  // a tool cannot cost itself any more than it can preflight itself) and 1.96.0
  // (HostV1.synthesize - on-device Kokoro TTS: text in, spoken PCM + word timings out,
  // the dual of audio.analyse; a real additive HostV1 method) and 1.97.0 (the chrome
  // extension contract - packages/core/src/extension-v1.ts, the host-v1 analog for named
  // chrome SLOTS: core defines the doors + the enumerable SLOT_REGISTRY, components are
  // hydrated at runtime through three channels (control-plane, community, local), empty
  // doors render nothing. Its own EXTENSION_CONTRACT_VERSION; no HostV1 method was added,
  // and a tool cannot fill a chrome slot any more than it can grant itself a capability)
  // and 1.98.0 (src/speech-text.ts - the pure half of Kokoro TTS moved into the
  // engine under the one-synthesis-layer rule: text normalization, the phoneme
  // pipeline, chunking and word-timing maths, model/voice constants; engine-only,
  // no HostV1 method added) and 1.99.0 (host.speech transcription - on-device
  // Whisper: transcribeAvailable/transcribeCached/transcribeModelBytes/transcribe
  // over the host.audio AudioSource, returning a SpeechTranscript; contract only
  // in this minor, no shell implements yet. The same minor adds the additive
  // synthetic-audio provenance surface: GENERATED_SOURCE_TYPE, action
  // `parameters` on the read side, wav/mp3 ingredient MIME and the mp3 ID3v2
  // GEOB C2PA container)
  // and 1.100.0 (deep raster output for tools: the additive host.codec API - 
  // png16/exr/radiance/dither8, a linear Float32 CodecFrame in, deep image bytes
  // out, wrapping engine/src/deep-encode.ts - plus the exportStill hook +
  // manifest.hooks.exportStill, intercepted in runtime.export before the DOM
  // raster path so a tool can return its own encoded bytes for a format and skip
  // host.export.render, or decline (null) and fall through byte-identical);
  // the ^1.54.0 screencap floor below is unaffected (a minor bump still satisfies it).
  // Then 1.101.0 (host.upscale - on-device AI upscaling + the c2paAiUpscale
  // provenance surface) and 1.102.0 (layered-bitmap import/export: readPsd/
  // writePsd/readXcf + packbits/raster-layers/sniffLayeredRaster - plain engine
  // exports consumed like pdf-map; no HostV1 method added) and 1.103.0 (host.matte
  // - on-device background removal, a real additive HostV1 method; plus the
  // ToolHookFlags.exportStill type fix). Then 1.104.0 (host.c2pa.sign widened to
  // C2paSignOpts for the any-media authorship path) and 1.105.0 (host.raster - 
  // canRaster/measure/decode/encode: the bridge home for the canRaster()/loadImage()
  // probes tool hooks used to open-code against the DOM, plans/86 section 6.1) and 1.106.0
  // (host.connectors - the engine's committed connector/line/arrow SVG builder behind a
  // tool-facing surface, so a canvas tool renders its connectors in one line and a headless
  // --export keeps them; plan 90) and 1.107.0 (host.color.solveApca - the APCA INVERSE
  // solver: the OKLCH lightness that hits a target Lc on a background, the generative dual
  // of the forward apcaContrast, behind the contrast-first palette generation; a real
  // additive HostV1 method, so every existing shell is unaffected). Then 1.108.0
  // (host.color.paletteExport + paletteExportBytes - palette exchange lifted into
  // engine/src/palette-export.ts: a flat swatch list → DTCG tokens JSON / CSS vars /
  // CSS classes / SCSS / GIMP .gpl as text, or a binary Adobe .ase; the color-palette
  // tool's parity with the Swatches download. Two real additive HostV1 methods, plus
  // json-as-sibling-template + css/scss/gpl data-export formats at the runtime seam).
  // Then 1.109.0 (versioned design systems, plans/97 section 6a - the pure design-version.ts
  // module: the version ledger, the head/version asset-id scheme and its
  // discovery-exclusion rule, the resolution ladder, and the pinned-asset helpers, all
  // shared by the web bridge, the CLI and the MCP server; plus the reserved `designv`
  // param and the optional `designVersion` manifest pin. No HostV1 method changed).
  // Then 1.110.0 (plan 96 P1 - host.connectors.pathHeadSvg/pathHeadInset put a connector's
  // arrowhead on ANY authored path by tip + tangent, and host.connectors.dashFit adds
  // manual dash entry plus Illustrator-style corner-fit dashes, as an array for a preview
  // or as absolute segments for the committed render; new pure module dash-fit.ts, and
  // every shell now attaches the engine's makeConnectorsApi() factory).
  // Then 1.111.0 (plan 96 P3-P5 - endpoint binding: pathRouteStyle maps a bound path's
  // SPLINE KIND to the route connector management draws it with, host.connectors gains
  // routeStyleForKind/routeStyles, routedLineSvg becomes the ONE committed-geometry
  // function a legacy edge and a bound path both reach, and ConnectorRenderOpts grows
  // headStartField/headEndField/dashArrayField/dashFitField so an authored dash pattern
  // lands on the committed layer as real corner-fitted <line> segments).
  // Then 1.112.0 (plan 100 wave 0.4 - runtime.applyPatch: an atomic multi-input apply
  // with one render, for a remote collaboration op that arrives as a set of values;
  // onInput still runs per changed id in insertion order, only the emit coalesces).
  // Then 1.113.0 (runtime.startLive gains { source?: 'camera' | 'asset' } - the web
  // shell replays an ANIMATED ASSET through the same onFrame loop as the camera, and
  // the 'asset' source renders identically but never sets the live-camera provenance
  // flag, so a decoded file can't claim digitalCapture in a signed manifest).
  // Then 1.114.0 (plans/104 P0 - engine/src/keyframes.ts: the `kf` wire grammar,
  // per-channel sparse evaluation, the ease adapter, and the affine depth-camera
  // projection/DOF both sequence evaluators fold; no HostV1 method changed).
  // Then 1.115.0 (plans/105 M1 - the C2PA 2.4 text-binding READ side: SniffFormat
  // gains 'html' | 'text' | 'code', extractC2paDetailed with the HTML/armour/
  // variation-selector extractors, the NFC-normalised section 15.12.1.3 text hash pipeline,
  // and c2pa.ai-disclosure read for every format; read-only, no HostV1 method changed).
  // Then 1.116.0 (plans/105 M2 section 7 - verifyC2pa gains an optional `externalManifest`:
  // the CALLER resolves a section A.7.1.2/section A.9.3 external credential reference under its own
  // network policy and passes the bytes in, so a document whose manifest lives beside
  // it can finally be checked; the engine still never fetches, the option is only read
  // when the asset carries no store, and report.textBinding.externalManifestUsed marks
  // every report that used it. No HostV1 method changed).
  // Then 1.117.0 (plans/105 M3 - the C2PA 2.4 text-binding WRITE side: C2PA_FORMATS
  // gains html/js/css/md, placeHtml (section A.7 inline) + placeArmor (section A.9 armoured block),
  // and the documented `html-fragment` Lolly profile; write-only, no HostV1 method
  // changed).
  // Then 1.118.0 (plans/104 section 5.2 P1 - the `kf` grammar gains `w`/`h`: absolute px
  // that REPLACE the box's size for their segment, so a tween can reflow text.
  // `KF_MAX_CHARS` moved 40960 → 49152 because it is DERIVED from KF_MAX_KEYS and
  // two more channels are 20 chars a key; no HostV1 method changed).
  // Then 1.119.0 (plans/104 section 7 P3 - `engine/src/svg-layers.ts`: "Lift layers"
  // enumerates a sanitised SVG's own layers into one standalone document each,
  // DOM-free so the CLI lifts the same way the editor does; read-only, no HostV1
  // method changed).
  // Then 1.120.0 (the P3 adversarial-review fixes to that same module - root-level
  // unit compositing refused instead of split silently, cross-layer references
  // resolved from the wrappers and the carried markup too, id resolution taken off
  // the layers x refs product, DROP_TAGS applied at any depth, and the new
  // `SVG_LAYERS_HEAVY_BYTES` warning; still read-only, no HostV1 method changed).
  // Then 1.121.0 (plans/104 P2 - the TILT tier in keyframes.ts: `rx`/`ry` stop being
  // channels that only parse. `cameraTilted` gates an exact zero, `projectLayer` grows
  // a `m: KfMatrix3 | null` element-local homography, `kfMatrix3dCss` spells it as the
  // one CSS transform that divides by w, the behind-camera guard moves from the layer's
  // plane to its nearest corner and DOF reads distance along the view axis; additive,
  // no HostV1 method changed).
  // Then 1.122.0 (the P3.2/P2 adversarial-review fix to svg-layers.ts: `cropScale`,
  // so a crop is snapped to whole px of the ROW it will be drawn into rather than to
  // whole USER units - the two are the same thing only at scale 1, which is the one
  // configuration 1.121's "fidelity-neutral" measurement had. Additive and defaulted
  // to 1:1, so omitting it reproduces 1.121 exactly; no HostV1 method changed).
  // Then 1.123.0 (plans/111 M1 - `host.lift` with `lift.svg(source)`, the CANONICAL
  // SVG layer enumeration (enumerateSvgLayers) exposed to a tool template; additive,
  // NOT capability-gated, no HostV1 method changed).
  // Then 1.124.0 (plans/111 M2 - `host.keyframes` with `keyframes.sample(kf, count)`,
  // running the engine's parseKf + evaluateKf so a tool template can drive motion from
  // the same `kf` wire the Design tool's camera uses; additive, no HostV1 method changed).
  // Then 1.125.0 (plans/116 - inputs gain the optional `notice` fine-print string;
  // manifest + i18n sidecar surface, no HostV1 method changed).
  // Then 1.126.0 (plans/114 Wave 3 - `host.export` gains optional `share`/`canShare`
  // for the OS share sheet; additive verbs on an existing API).
  // Then 1.127.0 (plans/125, on-device OCR - `HostV1` gains an optional `ocr` API:
  // an RGBA frame in, recognised text lines out; additive, feature-detected, NOT
  // capability-gated).
  // Then 1.128.0 (the EMF emitter learns LIVE text - a `text` vector prim written as
  // a real GDI font + string record so exported text stays editable; no HostV1 method
  // changed).
  // Then 1.129.0 (plans/126 - the text AI-likelihood analyser gains heat temperatures,
  // a rolling-window heatmap, chatbot-boilerplate + placeholder tells, doc kinds, and
  // a doubled fingerprint table; pure exports only, no HostV1 method changed).
  // Then 1.130.0 (plans/112 section 10 - the `s=` state address becomes engine-visible:
  // `UrlState.slide` plus src/frame-address.ts's parseFrameAddress/selectFramePage, so
  // the still-export slide filter is one definition across web and CLI; additive, no
  // HostV1 method changed).
  // Then 1.131.0 (plans/127 - src/reword.ts, the pure side of on-device rewording:
  // the deterministic suggestion table, sentence-span selection, the shared prompt,
  // and the candidate gate; the model stays shell-side; pure exports only, no HostV1
  // method changed).
  // Then 1.132.0 (plans/124 WP-E - src/inpaint.ts, the pure Telea fast-marching
  // content-aware fill behind Retouch; pure exports only, no HostV1 method changed).
  // Then 1.133.0 (plans/130 - src/grade.ts, the darkroom look engine's pure half:
  // the .cube/.3dl readers, the tetrahedral sampler, the RGBA frame apply and the
  // grain + vignette pass, so a shell can grade a video the way the tool grades a
  // still; the grain seed advances per frame, frameIndex 0 reproducing the still.
  // Pure exports only, no HostV1 method changed).
  // Then 1.134.0 (file-metadata.ts reads the ISO BMFF container tree - ilst tags,
  // handler notes, track codecs, mvhd stamps, QuickTime mdta keys, ©xyz GPS - and
  // gains the `producer` pipeline fingerprint behind /verify's "Likely
  // AI-generated" tier. Pure exports only, no HostV1 method changed).
  // Then 1.135.0 (pptx.ts buildPptxParts learns slide-layout galleries: PptxLayout /
  // PptxPlaceholder, PptxSlide.layout, PptxText.ph - branded layouts + placeholder
  // bindings so an exported deck doubles as a PowerPoint template. Pure exports
  // only, no HostV1 method changed).
  // Then 1.136.0 (text-watermark.ts - the Kirchenbauer et al. green-list text
  // watermark, arXiv:2301.10226: the keyed vocabulary partition + logit bias the
  // reword samplers embed, and the unique-bigram z-test /verify detects it with.
  // Pure exports only, no HostV1 method changed).
  // Then 1.137.0 (text-signals applyModelEstimate - plans/126 WP-A's classifier
  // fold: a staged on-device detector's calibrated verdict becomes a fourth,
  // style-capped evidence bucket + an estimate finding. Pure exports only, no
  // HostV1 method changed).
  // Then 1.138.0 (text-facts.ts - the neutral document census: hidden chars by
  // name, script shares, link hosts, structure + line-ending forensics; also
  // the one home of invisibleCharName. Pure exports only, no HostV1 change).
  // Then 1.139.0 (claudisms.ts abstract-register tells - ledger/machinery/
  // mechanics-of/figurative-survives/structure-of-the-argument, literal senses
  // carved out; LEXICON_VERSION 5. Pure exports only, no HostV1 change).
  // Then 1.140.0 (WP-B3: collectAiIngredientDeclarations + exportActionSteps
  // aiIngredients - a user's AI-origins assertion on placed assets becomes a
  // composite created step, a naming c2pa.placed step and a section 18.28
  // ai-disclosure in the fresh credential. Pure exports only, no HostV1 change).
  // Then 1.141.0 (ExportOpts.signal - the optional AbortSignal a shell's export
  // pipeline polls at its yield points, rejecting with an 'AbortError'; audit
  // finding T1, the export shutter's Cancel. A field, unset by default).
  // Then 1.142.0 (plans/139 deck read side: pptx-read ph + para lvl +
  // readingOrder, and deck-md.ts deckToMarkdown - the PptxDeckRead -> Markdown
  // serialiser pinned to deck-studio's spec dialect. Pure exports only, no
  // HostV1 change).
  // Then 1.143.0 (plans/139 document read side: doc-model.ts DocBlocks,
  // doc-md.ts mdFromBlocks/htmlFromBlocks, docx-read.ts readDocx/isDocx -
  // WordprocessingML to the shared block model under xlsx-import's threat
  // model. Pure exports only, no HostV1 change).
  // Then 1.144.0 (plans/139 docx write depth: writeDocx accepts DocBlocks -
  // styled runs, hyperlinks, lists via conditional numbering.xml, spanned
  // tables, inline images, real footnotes; legacy DocxBlock output stays
  // byte-identical. No HostV1 change).
  // Then 1.145.0 (plans/139 pptx placeholder cascade: run styling inherited
  // through layout/master/txStyles/defaultTextStyle, idx-only ph type
  // resolution, lineWidthPt. Additive read-model fields, no HostV1 change).
  // Then 1.146.0 (hook lifecycle: a raced-out onInit/onInput's late resolution
  // applies when it resolves iff still the newest run - see runtime-hooks.test.ts.
  // No HostV1 change).
  // Then 1.147.0 (plans/140 S1: deriveExportFilename + render.filenameFrom -
  // content-derived export filenames. Additive export + manifest field, no
  // HostV1 change - see derive-filename.test.ts).
  // Then 1.148.0 (plans/142: reserved URL param `preset` - a values overlay
  // inside a ?template= entry, resolved shell-side. Reserved-set addition
  // only, no HostV1 change - see engine.test.ts's RESERVED drift guard).
  // Then 1.149.0 (plans/144 Waves 1+2+5: images carryMetadata + carried report
  // (additive ImagesAPI opts/result fields), image-meta.ts stampers + carry
  // core, WebP/DOCX/WAV export metadata parity, ooxml coreProps read-back +
  // both-authors sourceAuthor combine, IPTC-IIM read + pro-photo XMP write,
  // HEIF/AVIF item read + AVIF Exif item write - see image-meta-carry.test.ts).
  // Then 1.150.0 (plans/147 T1a: manifest key render.transcribe - the shell
  // mounts consent + job + one undoable write from a declaration - plus the
  // srt/vtt sibling text formats. Manifest + format additions, no HostV1
  // change; speech.transcribe has existed since 1.99 - see transcribe-spec.test.ts).
  // Then 1.151.0 (QR-friendly packed links: `z` codec tag 2 - the same DEFLATE
  // bytes as tag 1 in base32-upper so the token rides a QR encoder's
  // alphanumeric mode; packQuery gains { qr } and unpackToken reads both tags -
  // see url-pack.test.ts. Codec addition only, no HostV1 change).
  // Then 1.152.0 (plans/148: one uniform image framing - engine/src/framing.ts's
  // frameRect + framingStyle, the {{framing}} template helper and its data-framing
  // marker, the optional manifest key `framingFor`, and canonical imageFraming.rotate
  // / imageFit / imageCrop. Manifest + template additions, no HostV1 change - see
  // framing.test.ts).
  // Then 1.153.0 (plans/162 Part 2: host.scan - the optional/additive on-device
  // code reader, ScanAPI in packages/core/src/host-v1.ts. New HostV1 field, no
  // change to any existing method - see the scan-code + qr-code-roundtrip suites).
  // Then 1.154.0 (plans/162: AssetQuery.motion? - an optional/additive field that
  // widens an image asset query to admit video for a motion/onFrame slot, fixing
  // the picker hiding catalog video. Additive-only - see assets.test.ts).
  // Then 1.155.0 (plans/171 URL contract freeze: kiosk flag reserved, `_` prefix
  // namespace, /t/ recognised by parseToolUrl, engine-owned encodeBlocksCompact +
  // keepUserIds. Parse strictly widens; no HostV1 change - see engine.test.ts +
  // tool-url.test.ts).
  // Then 1.156.0 (plans/173 slice 1: paletteTokensJson gains optional
  // PaletteTokensOpts.fonts - fontFamilies tokens beside the colour leaves so a
  // brand's faces travel to Penpot/Tokens Studio. Additive; single-argument
  // call sites emit byte-identical output - see palette-export.test.ts).
  // Then 1.157.0 (an export names the exact tool that made it: ExportMeta gains
  // optional toolId/toolVersion, source becomes the tool's /t/<id> page, both ride
  // the tools.lolly.export assertion and /verify recreates by id - see metadata.test.ts).
  // Then 1.158.0 (native PPTX animation, plans/175 WP-E: PptxAnim/PptxEffect +
  // timingXml, one <p:timing> per slide with anim - see pptx-anim.test.ts; a deck
  // with none serialises byte-identically). Then 1.159.0 (host.text.toPath
  // `clusters`, plans/175 WP-D - the per-cluster breakdown behind the shaped-glyph
  // letter tier; see text-clusters.test.ts). Then 1.160.0 (per-box rx/ry tilt -
  // KfLayerPose gains the box's own pitch/yaw and projectLayer composes its local
  // homography, plans/104 P2.1; see keyframes-tilt.test.ts). Then 1.161.0 (the
  // master true-peak limiter, plans/165 Slice E - createTruePeakLimiter in
  // audio-dynamics.ts, the WP-7 stretch gate; see audio-dynamics.test.ts). Then
  // 1.162.0 (activitySpans, plans/165 WP-6 v2 - signal-derived duck spans over
  // decoded PCM; same test file). Then 1.163.0 (BS.1770-4 integrated loudness,
  // plans/101 - createLoudnessMeter behind the Normalize targets; see
  // audio-loudness.test.ts). Then 1.164.0 (the fx kernels + grammar, plans/101
  // sections 2.2/3.4 - parseFxChain/processFxPcm; see audio-fx.test.ts).
  // The ^1.54.0 screencap floor below still holds (a minor bump satisfies it).
  assert.equal(ENGINE_VERSION, '1.164.0');
});

// ─── loadTool: a ^1.54.0 tool loads against this engine ───────────────────────

/** fetchFile serving the screencap tool.json (+ template) for a given engineVersion. */
function makeFetchFile(engineVersion: string) {
  const files: Record<string, string> = {
    'screencap/tool.json': JSON.stringify(screencapManifest({ engineVersion })),
    'screencap/template.html': '<div data-screen-preview></div>',
  };
  return async (path: string): Promise<string> => {
    const text = files[path];
    if (text === undefined) throw new Error(`404: ${path}`);
    return text;
  };
}

test('sanity: the running engine satisfies ^1.54.0', () => {
  assert.equal(satisfiesRange(ENGINE_VERSION, '^1.54.0'), true);
});

test('loadTool accepts a tool that requires ^1.54.0 (the screencap engineVersion)', async () => {
  const tool = await loadTool('screencap', makeFetchFile('^1.54.0'));
  assert.equal(tool.manifest.id, 'screencap');
  assert.equal(tool.manifest.render.capture, 'screen');
});

test('loadTool REFUSES a screencap tool pinned to a future engine', async () => {
  // Derived from ENGINE_VERSION (one minor ahead) so a deliberate engine bump
  // can never silently turn this "future" pin into the present.
  const [maj, min] = ENGINE_VERSION.split('.').map(Number);
  await assert.rejects(loadTool('screencap', makeFetchFile(`^${maj}.${min! + 1}.0`)), ToolLoadError);
});
