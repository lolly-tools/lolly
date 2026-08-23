# Engine changelog

One entry per ENGINE_VERSION minor (the bridge contract version in `src/version.ts`,
re-exported from `src/index.ts`). Additive-only within v1: methods are added in
minors, never removed or signature-changed without a major bump.

Moved verbatim from the comment block that used to live in `src/index.ts`.

1.146.0 - lifecycle: a raced-out async onInit/onInput now applies its LATE
resolution when it finally arrives, iff no newer onInit/onInput run has started
since (a per-runtime sequence guards ordering; the runtime logs the recovery
at info). Previously the late result was discarded outright, so a first
analysis that outran its budget - the audiogram's cold audio decode + worker
spawn was the reproducer - left the card permanently stale with nothing to
retry it. A superseding keystroke still wins; export-path hooks
(beforeExport/afterExport/exportFile/exportStill) still never late-apply -
their overrun fails that export visibly. No HostV1 change.

1.145.0 - additive: the pptx placeholder CASCADE (plans/139 WP7). `pptx-read`
now resolves run styling through the full inheritance chain - run rPr ->
paragraph defRPr -> shape lstStyle -> slide-layout placeholder -> slide-master
placeholder and txStyles -> presentation defaultTextStyle - filling ONLY what
the slide left undefined, with explicit-off (`b="0"`) honoured at every
layer. Placeholders match slide -> layout -> master by idx first, then by
type with title/ctrTitle unified, so an idx-only slide placeholder gets its
type resolved (better title detection for deckToMarkdown and the deck-editor
ingest). Shapes additionally surface `lineWidthPt` from `a:ln@w`. Layout and
master parts are attacker-controlled like everything else: size caps,
per-part placeholder caps, parse-once memoisation, degrade-to-no-cascade on
any hostile/missing part. Decks without layout parts parse identically to
1.144.0 (pinned by a guard test). Pure additive read-model change, no HostV1
change.

1.144.0 - additive: docx WRITE depth (plans/139 WP5). `writeDocx` accepts the
shared doc-model `DocBlock` shape alongside the legacy `DocxBlock` (union
array; legacy-only documents stay byte-identical, pinned by a guard test) and
emits styled runs (b/i/u/strike, nesting), hyperlinks (per-href rels),
bullet/decimal lists via a conditional `word/numbering.xml` (two abstractNums,
nine levels), tables with `gridSpan`/`vMerge` and a `w:tblHeader` header row,
inline images (`DocxDoc.media` supplies bytes; PNG/GIF/JPEG natural size
sniffed, capped to the printable width) and real footnotes
(`word/footnotes.xml`). The DocBlocks -> writeDocx -> readDocx round trip is
pinned by tests/docx-roundtrip.test.ts. No HostV1 change.

1.143.0 - additive: the document read side of plans/139. New `doc-model.ts`
(`DocBlock`/`DocInline` and friends - the shared block model every document
reader projects into), `doc-md.ts` (`mdFromBlocks` - GFM with pipe tables,
an inline-HTML table escape hatch for real row/col spans, `[^n]` footnotes;
and `htmlFromBlocks` - escape-first HTML with real colspan/rowspan for the
doc-studio TipTap ingest; URL scheme allowlist on both), and `docx-read.ts`
(`readDocx(parts, parseXml)` + `isDocx` - WordprocessingML to DocBlocks:
pStyle/outlineLvl headings, numbering.xml lists, gridSpan/vMerge tables,
hyperlinks, footnotes/endnotes, images with alt, track-changes accepted;
xlsx-import's hostile-file threat model, macro-enabled refused, caps set
`truncated` instead of throwing). Fuzz target `docx-read` registered. Pure
exports only, no HostV1 change.

1.142.0 - additive: the deck-content read side of plans/139 ("rebrand this
content"). `pptx-read` now surfaces the slide's own `p:ph` placeholder
(`ph?: { type?, idx? }` on text/shape nodes, type defaulting to `body` when
the element is present but untyped) and the paragraph outline level
(`lvl?` on `PptxReadPara`), and exports `readingOrder(nodes)` - a pure
position sort (y-banded at half a line, then x) that never mutates the
stored spTree order. New module `deck-md.ts`: `deckToMarkdown(deck)` turns a
`PptxDeckRead` into the Marp-flavoured Markdown dialect deck-studio's `spec`
input parses (`---` slide breaks, ph-classified titles, 2-space list levels,
GFM pipe tables, `<!-- notes: ... -->` speaker notes, furniture placeholders
skipped) plus a media manifest; the round trip is pinned by
tests/deck-roundtrip.test.ts against deck-studio's own parser. Pure exports
only, no HostV1 change.

1.141.0 - additive: `ExportOpts.signal` (an optional AbortSignal), so an
export can be CANCELLED rather than only hidden (mobile UX audit finding T1 -
the export shutter's status block offered "Hide" because no abort seam
existed). A pipeline polls it at its natural yield points and rejects with a
DOMException named 'AbortError'; a path with no yield point may ignore it, and
then the caller's only guarantee is that the result is discarded. The web
shell honours it in the video/GIF/APNG/WebP/animated-SVG frame loops, the CMYK
row pass, the SVG and PDF vector walks (their existing cooperative yield, plus
the multi-page boundary), the sequence compositor (in-thread, GPU and
tilt-capture paths, plus the worker offload's SEQ_ABORTED mapped to the one
AbortError shape) and the two real-time recorder compositors. Unset by default,
so every existing export is byte-identical.

1.140.0 - additive (no HostV1 change): the user's AI-origins assertion
becomes signed provenance at export (plans/126 WP-B3, Andy-approved
2026-08-21). `collectAiIngredientDeclarations` (c2pa.ts) walks a runtime
input model's placed assets - top-level and blocks sub-fields, the same
descent as the aiUpscale scan - for `meta.aiGenerated` declarations;
`exportActionSteps` gains `aiIngredients`, which swaps the created step to
compositeWithTrainedAlgorithmicMedia and appends a c2pa.placed step naming
each declared piece with its grade. The runtime passes the census to the
shell (`c2paAiIngredients`); the web bridge and node-shell's shared
buildExportC2paOpts pair it with a section 18.28 ai-disclosure assertion (generic
model type - the user asserted THAT a model made the piece, never which
one), so web, CLI and TUI exports declare identically. No declarations →
byte-identical output.

1.139.0 - additive (no HostV1 change): claudisms.ts learns the
abstract-register tells Andy flagged - bookkeeping and machine words applied
to ideas ("ledger of decisions", "the machinery of", "mechanics of",
figurative "survives", "the structure of the argument"), scoped so literal
senses (an account ledger, quantum mechanics, a data structure) never trip.
LEXICON_VERSION 4 -> 5, so persisted aiSignals notes from the old lexicon
recompute on next read. The same frames enter the docs/code vernacular gates.

1.138.0 - additive (no HostV1 change): `src/text-facts.ts`, the neutral
document census behind the verify/catalog interrogation surface: `textFacts`
(hidden characters by name+count with a severity grade - RLO/TAG/PUA-class
characters read as severe warnings, never neutral inventory - script shares of
the letters, link hosts - never fetched - punctuation counts, words/sentences/
paragraphs/bullets, CRLF/LF mix, BOM) and `invisibleCharName` (the one home of
invisible-character naming; the web shell's chip renderers import it, so
census, extract and preview can never disagree). Facts carry no verdict - the
score keeps that job - but severity still reads as severity.

1.137.0 - additive (no HostV1 change): `applyModelEstimate` on text-signals -
the fold for plans/126 WP-A's on-device classifier tier. A shell that ran a
staged detector model hands its calibrated verdict (`AiModelEstimate`: probAi,
operating threshold, model id/name) to this pure function, which adds an
"On-device model estimate" finding and rescores the report with the model as a
FOURTH evidence bucket, capped at the style ceiling (a classifier alone
reaches 'notable' at most - detector models over-score fluent human prose,
especially non-native English, so the band never rests on the model alone).
Below the threshold the report returns unchanged: an inconclusive run is
absence of evidence, never exoneration. With no model staged the function is
simply never called - the deterministic tiers stand alone, which is the
progressive-enhancement promise. The models themselves stay shell-side
(shells/web lib/ai-detect*, staged + licence-gated like OCR via
scripts/fetch-ai-detect-models.ts, AI_DETECT_STAGED=false until Andy's gate).

1.136.0 - additive (no HostV1 change): `src/text-watermark.ts`, the statistical
text watermark of Kirchenbauer et al. (arXiv:2301.10226) as pure exports:
`WatermarkScheme` / `REWORD_WATERMARK` (the public scheme Lolly's reword
generation embeds - gamma 0.25, delta 5, key 0x4c4f4c4c), `mix32` /
`isGreenToken` (the keyed vocabulary partition), `addGreenBias` (the embedder's
logit pass, shared by the web worker's logits processor and mirrored in the
desktop shell's native sampler), and `greenListZ` / `binomialTailP` /
`scoreTokenWatermark` (the detector: green counts over unique (prev, token)
bigrams thresholded on the EXACT binomial tail - at a lone sentence's 10-15
scorable tokens the normal z overstates the evidence - plus a sliding-window
pass so a reworded cluster inside a long human document still surfaces;
repetition is deduped so degenerate text cannot convict). Tokenizers stay
shell-side; the engine owns only the maths, so embedder and detector cannot
drift. The key is public by design - a match is a provenance disclosure, not a
cryptographic guarantee.

1.135.0 - additive (no HostV1 change): `buildPptxParts` learns slide-layout
galleries. `PptxBuildOpts.layouts` takes `PptxLayout[]` - each a named branded
layout with an optional bg fill, static furniture shapes/media (same shape
vocabulary as slides, so a vector logo stays an svgBlip), and `PptxPlaceholder`s
(title/ctrTitle/subTitle/body/sldNum) carrying role text styles + prompt text.
`PptxSlide.layout` binds a slide to its gallery entry; `PptxText.ph` binds a
text shape to a layout placeholder (`<p:ph>` in nvPr, own xfrm kept - the
template convention), which is what makes PowerPoint's outline view, Reset
Slide, and "New Slide" gallery work on an exported deck. With layouts present
the master also gains minimal `<p:txStyles>`. No `layouts` → byte-identical
pre-1.135 output. Modelled on the SUSE brand template's structure.

1.134.0 - additive (no HostV1 change): the embedded-metadata reader
(`src/file-metadata.ts`) learns to read the ISO BMFF container tree itself, not
just its XMP uuid box. An MP4/M4A/MOV dropped on /verify now discloses its
iTunes-style `ilst` tags (encoder, title, artist, date…), each track's handler
description, per-track codec summaries (H.264 720 × 1280, AAC 44.1 kHz stereo),
the mvhd created stamp and duration, the ftyp brand (with fragmented/DASH
delivery named), QuickTime `mdta` keys - an iPhone movie's make/model/software
and its ISO 6709 GPS fix, mapped like EXIF GPS - Android's `©xyz` GPS string,
and the `XMP_` udta box. New `FileMetadata.producer` (type `MediaProducer` on
the barrel): a maker-pipeline fingerprint matched byte-for-byte against known
packaging - today Google's, where the bare "ISO Media file produced by Google
Inc." handler note and/or an `©too` of exactly "Google" is the signature of
Gemini/Veo/NotebookLM AI downloads (`signature: 'ai-download'`), while the
dated "Created on:" variant is a YouTube-style server re-encode
(`'reencode'`). A fingerprint OF the pipeline, not a declaration BY it - the
verify view words it as "likely", never as a verdict. All parsing is
bounds-before-read (including loop bounds) against hostile sizes.

1.133.0 - additive (plans/130, no HostV1 change): `src/grade.ts`, the pure half
of the darkroom tool's look engine promoted into the engine so a shell can grade
a VIDEO with the same maths that graded the still. It exports the `.cube` and
`.3dl` readers (`parseCubeLut`/`parse3dlLut`, plus the try-both `parseLutText`),
the tetrahedral `sampleLut`, the in-place RGBA frame apply `applyLutFrame` (with
an `intensity` lerp the tool did not need), and `applyGrainVignette` - the film
grain lattice and vignette falloff, with two changes from the tool, both optional
arguments that default to its behaviour. The PRNG seed advances per frame (`seed
+ frameIndex * 9973`), so a clip boils like real stock instead of wearing one
frozen grain pattern; `frameIndex` 0 reproduces the darkroom still exactly. And
`refLongEdge` (with `GRAIN_REF_LONG_EDGE`, the 1080 reference every video
consumer passes, and the pure `grainCellPx` that computes it) measures the grain
lattice against the picture instead of the pixel grid: `grainSize` is a cell in
device pixels, so a grade previewed on a 960-wide frame and rendered at 1920
otherwise ships grain exactly twice as fine as the one that was approved. `CUBE_MAX_N`/`TDL_MAX_N` come across as the declared
bounds on untrusted LUT bytes, still checked before any allocation, and
`tests/fuzz`'s `lut-parse` target now fuzzes this module directly instead of
lifting the parsers out of the hook source. `gradeMulberry32` is darkroom's exact
PRNG variant and must NOT be deduplicated against `mulberry32` in
`zzfx-compose.ts` - same name, different sequence, every grain pixel would move.
The runtime's public surface also gains `getHydratedText` (the raw, non-escaping
sibling of `getHydratedString`, previously internal to the data-template path):
a shell reading a JSON hook extra out of the runtime - darkroom's `videoLook`
baked-look envelope is the first consumer - needs the quotes unescaped, and the
escaping variant would entity-encode them.
Tools never import the engine, so `community/darkroom/hooks.js` keeps its own
copy; `tests/grade-drift.test.ts` is what stops the two drifting.

1.132.0 - additive (plans/124 WP-E, no HostV1 change): `src/inpaint.ts`, a pure
TypeScript port of Telea 2004 fast-marching inpainting (`inpaintTelea`) - the
content-aware fill behind the web shell's Retouch dialog. DOM-free typed-array
math with mask-bbox windowing; deterministic; no model, no weights, no new
bridge surface. Also fixes `media-sniff.ts` `sniffVideoContainer`: an
ISO-BMFF ftyp box whose brands name the AVIF/HEIC image family is no longer
reported as an mp4 video (every AVIF upload was being routed into the video
pipeline). And `src/c2pa.ts`'s CBOR encoder now writes non-integer numbers as
float64 instead of throwing - a fractional manifest value (the TTS speed
0.8/1.2) was silently costing synthetic audio its whole Content Credential.

1.131.0 - additive (plans/127, no HostV1 change): `src/reword.ts`, the pure side
of on-device rewording - the deterministic rewrite-suggestion table
(`suggestRewrites`/`applySuggestion`; filler-opener deletions and plain-word
swaps, quote-masked, LEXICON_VERSION untouched), `rewordableSpans` (which
sentences of an analysed text are worth offering a model - style marks,
sentence-bounded, heat-ranked, capped), the shared prompt
(`buildRewordMessages`/`REWORD_SYSTEM_PROMPT`), and the gate
(`rewordGate`/`rewordCandidates`: a model candidate is offered only if it is no
longer than the original, keeps every number/link/name both directions, scores
no hotter on the analyser, and carries no artifact-tier finding). The model is
shell-side; accepting its output makes the save AI-flagged (`aiGenerated`),
per humanize.ts's provenance rule. `quotedAt` is now exported from
text-signals.ts so the suggestion table skips quoted phrases by the same rule.

1.130.0 - additive (plans/112 section 10, no HostV1 change): the `s=` STATE ADDRESS
becomes engine-visible. `UrlState` gains `slide` (the raw `s` value, carried
verbatim - `s` was already reserved, so no RESERVED change), and a new module
`src/frame-address.ts` exports `parseFrameAddress` + `selectFramePage` with the
`FrameAddress`/`FrameSelection` types: the one definition of what `s=2`,
`s=slide1` and `s=2.3` mean against the pages a render actually produced. It is
what makes the still-export filter (`?s=2&format=png` renders just that slide)
identical in the web fan-out and the CLI instead of two shells agreeing to
behave alike. DOM-free - callers pass the page ids they read off
`[data-frame-id]`, in render order. An address that names nothing resolves as
`unmatched` (never silently "the first page"); build steps parse but do not
filter, because a still export shows every build.

1.129.0 - additive (plans/125 v2, no HostV1 change): the text AI-likelihood
analyser grows confidence TEMPERATURES and a heat map. Every
`TextSignalFinding` now carries `heat` (0-1, its individual confidence grade -
1 = a hard artifact, ~0.3 = the softest style hint) so shells render graded
highlights instead of a binary flag; `TextSignalReport` gains `heatmap` (a
rolling 40-word-window density map, `TextHeatmap`/`TextHeatCell`) and `docKind`
('prose'|'markdown'|'code', detected or overridden via
`AnalyzeTextSignalsOpts.docKind` - code runs style tells on COMMENT text only
and skips prose statistics, so an AI word in a string literal never flags).
New signal families: chatbot boilerplate (`chatbot-leftover`, verbatim
assistant-register phrases in their own scoring bucket - unlike pure style it
can reach 'strong' when distinct phrases stack, and a QUOTED phrase is skipped
as a human writing about AI), unfilled template placeholders
(`template-placeholder`), paragraph-length uniformity (`uniform-paragraphs`),
and the sandwich detector (`ai-span`: an AI-dense region inside otherwise-quiet
human writing, found from the heat map's hot-run-vs-cold-median). The
fingerprint table roughly doubles (ChatML/GPT tags, OpenAI private-use
citation delimiters U+E200-E206, lenticular citations, canvas markers,
chatgpt.com/copilot.com/grok.com link params, Gemini cite_start +
googleusercontent placeholders, Llama/Mistral instruction tags, reasoning
<think> tags, Claude transcript + tool scaffolding), and `TextStyleGuess`
gains ranked `candidates` with the guess now COMPETED across per-family tell
lists (`FAMILY_TELLS`) rather than defaulting to Claude on any tic.
False-positive guards tightened: soft hyphens between letters (PDF/Word copy
residue) no longer read as invisible-char artifacts, and em-dashes flag on
density (>=15/1000 words), not bare count. `LEXICON_VERSION` (claudisms.ts,
re-exported) keys persisted analyses so a stored verdict from an older lexicon
is recomputed, not trusted. Pure exports only; no HostV1 method changed.

1.128.0 - additive (no HostV1 change): the EMF emitter learns LIVE text. The
vector IR gains a `text` prim (`VectorTextPrim` in `src/emf.ts`) and `emitEmf`
writes it as a real GDI font + string record pair (EXTCREATEFONTINDIRECTW +
EXTTEXTOUTW, with SETTEXTALIGN/SETTEXTCOLOR and a one-time SETBKMODE
TRANSPARENT), so exported text stays selectable and editable in Office and
Google Drawings instead of always arriving as outlines. Alignment maps
text-anchor to TA_LEFT/CENTER/RIGHT and the baseline to TA_BASELINE/TA_TOP -
the RENDERER's own font metrics resolve both, which degrades gracefully under
font substitution; rotation rides lfEscapement/lfOrientation. No Dx array is
written, deliberately: live means the destination lays the run out with the
metrics of whatever face it has. The IR producer (the shells' svg-ir walker,
textMode:'live') decides per run - anything GDI text can't express (tracking,
OpenType features, strokes, skew/anisotropic scale, centred dominant-baseline)
is still outlined to paths as before. A file with no text prims is
byte-identical to the 1.127 writer (nHandles stays 3; the font slot and the
bkmode record only exist when text does). WMF/EPS/DXF are unchanged and ignore
text prims. Shipped with the shells' EMF default flipping to live text
(`--text=outline` / the export panel's "Outline fonts" chip restores
text-as-paths), and EMF/WMF downloads re-typed `application/x-msmetafile` so
Google Drive routes them into Drawings/Slides.

Same release, same journey, second door: the flat-SVG → native-PPTX lowering
learns text. `svgToNativePptx` (src/svg-custgeom.ts, new alongside the
unchanged `svgToCustGeomPaths`) returns custGeom shapes PLUS plain `<text>`
runs as native `PptxText` boxes - font name, size, colour, bold/italic,
text-anchor as paragraph alignment, dy/em handling for d3 tick labels - so a
chart's labels arrive in PowerPoint and Google Slides as live, editable text
(Slides matches run font names against the Google Fonts catalogue, so a brand
face that lives there, like SUSE, renders real). Deliberately narrow: tracking,
textLength, per-glyph rotate, positioned/styled tspans, textPath, stroked text
or an anisotropic map return null and the caller keeps its raster path, so
nothing regresses. Partial opacity, though, now LOWERS instead of bailing -
DrawingML solids carry `<a:alpha>`, so `PptxRun`/line gained an optional
`alpha` and tinted gridlines, secondary labels and translucent track bars (the
constructs every real chart is made of - the old opacity bail rasterised every
chart-creator render) ride through with their transparency; group `opacity`
multiplies down per leaf, the svg-ir flatten. The web shell's PPTX walker
feeds it computed-baked attributes (export-pptx.ts bakeTextStyles - fonts and
paint for text, paint for drawables) and then strips spent `<style>` blocks,
whose mere presence was the other guaranteed raster bail (the community
brand-font pattern puts one in every tool's `<defs>`); the same bake fixes the
svgBlip picture path's serif font substitution. Verified against the real
chart-creator donut markup: 4 slice paths + 8 native centred text runs.

1.127.0 - additive (plans/125, on-device OCR): `HostV1` gains an optional
**`ocr?: OcrAPI`** - a plain RGBA frame in, the text the image contains out, as
lines with axis-aligned boxes and per-line confidences (`OcrResult`/`OcrLine`).
A structural sibling of `matte`/`upscale`: the shell owns the ONNX runtime, the
one-time consented model download and the memory bound; the caller sees only
pixels and plain text. WASM-only (`backend()` never reports webgpu - the models
are small and ort-web's GPU kernels reject ops these graphs use). Feature-detected
and NOT capability-gated. Unlike matte/upscale it produces no pixels, no derived
asset and NO provenance - reading text is not a media edit - and it is a
best-effort read a shell presents as a correctable draft, never a verdict. Any
byte-level signal in the source's digital text (invisible characters, homoglyphs,
a text watermark) is lost in rasterisation, so it survives only on native digital
text, not on an OCR read. First use: "Copy text" on a catalog asset. Older shells
simply lack it.

1.126.0 - additive (plans/114 Wave 3, the OS share sheet): `host.export` gains two optional verbs -
**`share(blob, opts?)`** hands finished bytes to the platform share sheet (the Web Share API
`navigator.share` on web; native Android `ACTION_SEND` on the Tauri mobile shell - desktop/iOS
native is a later draw-down), resolving `true` when the sheet handled it (a deliberate user-cancel
counts, so the caller does not then also dump a download) and `false` when it could not share so the
caller falls back to `download()`; and **`canShare(opts?)`** - a synchronous probe for whether
share() will actually reach a sheet on this shell (web Web Share enforces a fixed file-type safelist
that excludes the private `application/vnd.lolly+zip` / `.lolly`, so it is `false` on Chromium). The
Share modal's "Send to…" is rendered ONLY when `canShare` is true, so it never silently degrades to a
download while claiming a share. First use: sending a `.lolly` file from the Share modal. Never
watermarks or re-encodes. Older shells simply lack both.

1.125.0 - additive (plans/116, the consent gate): inputs gain an optional **`notice`**
string - always-visible fine print a shell renders above the control, unlike `help`
(which sits behind an info button). Reserved for what the user should read BEFORE
typing; its first use is the network disclosure on an input whose value triggers a
lookup (meeting-planner's host city → open-meteo geocoding). Schema (both copies),
`InputSpec`, the i18n sidecar overlay (`inputs.<id>.notice`) and the catalog
validator all learn the key. Old engines tolerate the field (the input def is
permissive), so tools using it need no engineVersion floor.

1.124.0 - additive (plans/111 M2, the Flythrough tool's camera): a new optional bridge API
**`host.keyframes`** with one method, `keyframes.sample(kf, count)`. It runs the engine's
`parseKf` + `evaluateKf` at `count` times evenly spaced across the track's own span and hands
back each pose as a channel→value map. This lets a tool TEMPLATE (which cannot import the
engine) drive motion from the SAME `kf` wire the Design tool's camera uses - the interpolation
and easing stay canonical in the engine, and only the mapping of channels onto the scene is the
caller's. The Flythrough tool uses it for a URL-shareable custom `camera` track; without it, the
tool falls back to its built-in parametric moves.

1.123.0 - additive (plans/111 M1, the dedicated Flythrough tool): a new optional bridge API
**`host.lift`** with one method, `lift.svg(source)`. The shell fetches + sanitises an SVG named
by URL and runs the engine's `enumerateSvgLayers`, returning each layer as a standalone SVG
document + its ink bbox (in paint order) plus the source viewBox (`LiftLayer` / `LiftResult`).
It exposes the CANONICAL layer enumeration - the same the Design tool's Lift and the CLI Tier-A
path use - to any tool TEMPLATE, which cannot `import` the engine (it runs as an IIFE / a hook's
`new Function`). NOT gated by a capability: a shell without a safe SVG fetch/sanitise path simply
omits it (the Flythrough tool then flies one flat plane instead of depth layers). The DEPTH maths
that turns layers into a scene stays the caller's - this primitive returns geometry, not a scene.

1.122.0 - additive + corrective (the plans/104 P3.2 adversarial review): `enumerateSvgLayers`
gains **`cropScale`**, the per-axis scale - user units → destination px - at which the caller is
about to place the cropped rows, and `cropFor` snaps each crop outwards to whole px of **that
ROW** instead of whole USER units.
⚑ **The two are the same thing only at scale 1, and that was the only configuration 1.121
measured.** Every fixture in `tests/svg-lift-identity.browser.test.ts` was 320×240 into a
320×240 box - k = 1 with an integer viewBox, where whole user units are also whole row px - so
1.121's "fidelity-neutral, measured" claim was made on the single case that could not see the
defect. A lifted box on a canvas is any size, so k is arbitrary: `docs/shots/brand-colours.svg`
in a 1000×625 box measured **88 675** channels beyond ±1 with the crop on against **1 758** with
it off (max 189 vs 63), and `seq-studio-timeline` 48 355 against 518 with a MEAN of 1.54 - the
whole layer bilinear-filtered back onto the pixel grid, i.e. every anti-aliased edge, which on
dense UI screenshots is all the text and every hairline. With `cropScale` supplied those two land
**exactly on the uncropped floor** (1 758 vs 1 758; 521 vs 518). The derived viewBox is now
usually fractional, which is the right way round - a viewBox only has to be a superset of the
ink, a row has to be a rectangle of pixels.
⚑ **The honest boundary, measured, because 1.121's sentence is what this entry is fixing:** a
crop is fidelity-neutral when the row it maps to lands on the pixel grid. When the SOURCE box's
own content rect is FRACTIONAL (a 443.78-unit-tall shot drawn 550.625 px tall), the browser
rasterises that fractional container into a rounded bitmap and scales it, while an integer-sized
cropped row escapes that filtering - so the two disagree by a fraction of a pixel over the whole
ink no matter how the crop is snapped (isolated: shortening one layer's viewport from 443.78 to
266 at scale 1 and origin 0, 283 px beyond ±1, max 89). That residue is the renderer's container
rounding, not the crop's arithmetic, and it is measured in the identity suite's new
fractional-container case rather than claimed away.
`cropScale` is optional and defaults to 1:1, so a caller that says nothing gets 1.121's exact
arithmetic. Shell side: `liftCropScale` (free-canvas-math) answers it from the same
`liftContentRect` that places the rows, so the dialog and the write cannot disagree about k.
⚑ **Also corrective, in prose only:** 1.121 described `dofBlur`'s tilted branch as "effᴰ re-read
at `D = P − κ(z − camZ)`" as though that were the LAYER's depth. It is the aim column's. `dofBlur`
takes a depth and no position, so under tilt every layer gets the on-axis number: at `rx = −40`,
`f = 600`, `a = 1`, a layer at frame centre wants 24.83 px and gets it, one in the near field
(centre y 918, D 957) wants 46.35 and still gets 24.83, one in the far field (D 1443) wants 15.55.
Up to ~1.9× out on the near side. The approximation is unchanged - correcting it is a signature
change plus a matching edit in both evaluators, so it wants a measured pass with its own goldens -
but it is now written down where the branch is, instead of implied away.
⚑ **`KF_MATRIX3_IDENTITY` is no longer exported from the barrel.** 1.121 added it and nothing in
`engine/`, `shells/`, `tests/` or `packages/` read it; since a minor's additions are permanent, an
unused export is a forever commitment made by accident. The untilted tier returns `m: null` rather
than an identity (that IS the byte-identity gate), so there was no caller to give it.

1.121.0 - additive (plans/104 P2, the tilt tier): `rx`/`ry` stop being channels that merely
parse. `engine/src/keyframes.ts` grows the homography half of the projection - `cameraTilted`
(the gate), `KfMatrix3` + `kfMatrix3dCss` (a 2D homography as the one CSS transform that
performs a perspective divide), `projectSurfacePoint`, and a `m: KfMatrix3 | null` field on
`KfProjection`. `KfLayerPose` gains optional `w`/`h` (the layer's surface extent, read only by
the tilted branch). No HostV1 method changed.
⚑ **The camera ORBITS its aim point; it does not swivel in place.** `C = Q + R·(0,0,P)` with
`Q` the point the untilted camera was already looking at, so the first degree of tilt pitches
the artwork about the centre of frame instead of sending it out of the bottom of it. At
`rx = ry = 0` the camera is exactly where it always was and every formula reduces
algebraically to the affine fold - including the element-local matrix, which collapses to the
`translate(dx, dy)` the DOM path has always written (pinned as a golden, and the reason
`KfProjection.scale` still carries eff: the matrix has the centre magnification divided back
out so no other consumer has to know about tilt).
⚑ **The behind-camera guard moves from the layer's PLANE to its nearest CORNER.** A pitched
camera puts one edge of a screen-parallel layer closer than the other, so the plane ramp would
let a corner cross `w = 0` - which is not a soft failure, a homography with a sign change in
its denominator paints garbage. Ramping on `Dmin` over the four posed corners means the layer
is fully faded before any part of it can get there, and the matrix handed out always has a
positive denominator over the whole box. Identical expression to the affine ramp in ℝ; the
untilted path still evaluates the original spelling, so it is identical in IEEE-754 too.
⚑ **DOF reads distance along the VIEW AXIS.** `blur = a·K·|z−f|·effᴰ(z)·effᴰ(f)·κ/P` with
`effᴰ` re-read at `D = P − κ·(z − camZ)` and `κ = cos(rx)·cos(ry)` - the orbit lowers the
camera's height above the surface, so both the layer's and the focal plane's depths move and
their separation picks up its own κ. κ = 1 is the shipped expression, evaluated in the shipped
order.
The exact-zero test on both angles is the byte-identity gate throughout: an epsilon would make
a track keyframing `rx` from 0 to 40 change tiers mid-move, at whatever threshold was picked.

**Also in 1.121.0 (plans/104 P3.2, lift intelligence - one milestone, one minor):**
`engine/src/svg-layers.ts` learns two things the P3.1 acceptance pass measured the lack of,
and `keyframes.ts` gains `depthForEff`, the inverse of `projectDepth` (`z = camZ + P(1 − 1/eff)`)
- because depth is the wire and MAGNIFICATION is the taste, and the two are only the same
sentence at one perspective.
⚑ **A layer holding nearly all the artwork is opened up.** `docs/shots/brand-colours.svg`
enumerated into 5 layers of which ONE held 472 of the document's 492 paint elements - a picture
with a frame around it, not a stack. A candidate over `SVG_LAYERS_HERO_SHARE` (⅔) is now
descended into and re-clustered, up to `SVG_LAYERS_HERO_ROUNDS` times. Two things differ one
level down: groups cluster too (at the root a `<g>` is a layer because the author said so;
below a hero that signal has just been MEASURED as uninformative), and the count is budgeted -
a raw descent of that file yields 80 candidates, so the merge distance walks up
`SVG_LAYERS_HERO_GAP_SCALES` until the level fits `SVG_LAYERS_HERO_BUDGET`, and merging is
bounded by `SVG_LAYERS_PEER_AREA_RATIO` so a content pane cannot absorb every card on it.
Measured: 5 → 16 layers on brand-colours, every other banked shot unchanged.
⚑ **A derived document is CROPPED to its own ink**, and `SvgLayer.viewBox` reports the rect
(`SvgLayersResult.viewBox` carries the source's, `svgRootViewBox` reads it without enumerating).
A full-stage document made every lifted layer a full-stage box, so `shadow: depth` on a 16 px
icon cost a full-frame gaussian - which is what aborted the encoder watchdog on three of the six
acceptance shots. Measured after: the filtered area falls to 6–32 % of the full-stage cost, and
the P3 demo's shadow cache goes from 1.2× to 5.6× faster than uncached.
A viewBox is also a CLIP, so the crop is a stack of refusals: every member measured, no
percentage length (tested per element, so a gradient's `offset="100%"` in a carried `<defs>`
cannot refuse a crop it has nothing to do with), no `marker`, no carried `<style>` at all, filter
regions RESOLVED through `filterUnits="userSpaceOnUse"` and unioned in (which is exactly what our
own walker emits for a CSS box-shadow) rather than guessed at, a pad for stroke half-widths times
the worst legal miter, the result intersected with the source viewBox and snapped outward to whole
user units. ⚑ **The "fidelity-neutral, measured" claim this entry made is WITHDRAWN - see
1.122.0.** It rested on `tests/svg-lift-identity.browser.test.ts` matching its pre-crop channel
count exactly, and every fixture in that suite is k = 1 with an integer viewBox, the one
configuration in which snapping to whole user units also lands on whole row px. Both behaviours
are opt-out (`heroDescent`,
`cropToInk`), and opting out reproduces 1.119/1.120 byte for byte.

1.120.0 - corrective (+ one additive constant): `engine/src/svg-layers.ts`, the adversarial
review of the 1.119.0 lift. Five things that were true of the prose and not of the code.
⚑ **A root that composites AS A UNIT is now refused, not split silently.** `UNIT_PROPS`
(`opacity` below 1, `filter`, `mask`, `mix-blend-mode`, `isolation`) was tested on a descended
wrapper `<g>` and never on the `<svg>` itself, while `rootAttributes()` re-emits the root
verbatim into every derived document - so `<svg opacity="0.55">` had its opacity applied N
times over instead of once over the composite. Measured in Chromium against the browser
suite's own harness (320×240, two overlapping groups): 45 203 channels beyond ±1 where the
suite allows 154, mean absolute error 5.70; a root `filter` moved 12 952. Both produced zero
warnings. There is no split that preserves either picture, so the answer is the wrapper's:
`kept the artwork whole - its \`opacity\` applies to all of it at once`, layers `[]`.
⚑ **Cross-layer references are resolved from the WRAPPERS and the CARRIED markup too.** The
repair scanned the layer body only, so a descended `<g clip-path="url(#c)">` whose `<clipPath>`
lives inside one of the layers left every other layer unclipped - Chromium renders an
unresolvable `clip-path` as no clip at all: 76 800 channels different, warnings empty. Same
omission for a carried `<clipPath><use href="#…"/></clipPath>` (the shape Illustrator emits).
Both now repair to 0 channels different. References past `SVG_LAYERS_MAX_REFS` are named in a
warning rather than quietly dropped.
⚑ **Id resolution is off the caps' PRODUCT.** "Already resolvable here?" was a fresh `RegExp`
per (layer × reference) over the whole body and the whole carried markup: 64 layers × 64 refs
× ~4 MB is ~16 GB of scanning, all of it inside the declared caps. Measured on the shipped
code, on the main thread, behind the dialog's "Reading the artwork…" panel: 1 832 ms for plain
filler and 10 682 ms when the filler near-missed the regex, against 1 ms with no references at
all - the same hazard `SVG_LAYERS_MAX_CANDIDATES` exists to close, on a different axis. Now a
byte-span query against one id index: 6 ms and 9 ms, and the module's "work is linear in the
input length" is true again (with the one documented exception, the quadratic clustering the
candidate cap bounds).
⚑ **`DROP_TAGS` applies at ANY depth.** `<title>`, `<desc>`, `<metadata>` and `<script>` were
filtered out of the nodes the enumerator ENUMERATES, but a layer body is a verbatim slice, so
`<g><script>…</script></g>` and `<g><title>Andy's draft</title>` rode through whole while the
header, this changelog and a test all read as though they could not. The spans are spliced out
of the slice now - every emitted fragment is still verbatim, it just has holes.
⚑ **Correction to 1.119.0's own wording**: "the ingest-time PII strip is not undone by a lift"
described a guarantee nothing implements. `stripMetadata` runs on PNG/JPEG only and behind an
opt-in flag; an uploaded SVG takes the DOMPurify branch, which keeps `data-*`. Dropping the
three metadata ELEMENTS is a property this module owns; `data-name`/`inkscape:label` survive an
upload today, lift or no lift, and the module header now says so.
Additive: `SVG_LAYERS_HEAVY_BYTES` (8 MB), exported and barrelled. Carrying the whole `<defs>`
into every layer is free in pixels and not free in bytes, and only the layer COUNT was bounded:
an ordinary 1.0 MB file (one `<pattern>` holding a PNG, 24 groups) derives 24.0 MB, and the
shell writes every byte into IndexedDB on one confirm click - ~256 MB at the caps, silently.
The enumerator now prices the result and warns, so the dialog can say so before the click.

1.119.0 - additive: `engine/src/svg-layers.ts` - "Lift layers" (plans/104 section 7 P3).
`enumerateSvgLayers(markup)` reads a sanitised SVG and returns one standalone `<svg>`
document per layer: the root's direct children in paint order, every `<g>` a layer, stray
leaves clustered SPATIALLY with `pdf-artwork.ts`'s posture verbatim (group is a hint, never
a requirement), a lone wrapping `<g id="Layer_1">` descended through unless its own
attributes composite its children as a unit. Each derived document carries the root's
attributes and the WHOLE of every non-rendering sibling (`<defs>`, `<style>`, paint
servers), which is what makes the layers a byte-exact PARTITION of the original: `<defs>`
paints nothing, `source-over` is associative, so stacking the N documents in order
reproduces the source - section 7's identity property, asserted structurally in
`tests/svg-layers.test.ts` and as rendered pixels in `tests/svg-lift-identity.browser.test.ts`.
⚑ Measured amendment to section 7's wording: the STRUCTURAL identity is byte-exact, the RENDERED
one is exact to within compositing rounding - a browser rasterises each layer into its own
8-bit premultiplied buffer, so it rounds twice where one pass rounds once (Chromium,
320×240: every channel within ±1 except ≤ 0.025 % of them, worst single channel 56/255 at a
near-zero-coverage spike). Not a lift defect and not removable from here; the numbers and
the bounds live in that test's header.
Two hazards are handled rather than hoped about: a cluster that another layer paints
through is split back into contiguous runs (paint order is never reordered), and a
`<use href="#p">` whose referent now lives in a DIFFERENT layer has that element copied
into the borrowing layer's own `<defs>`, where it cannot double-draw. Names stay stripped
- labels are `Layer 1..N` by index, and `<title>`/`<desc>`/`<metadata>` are dropped from
the derived roots, so the ingest-time PII strip is not undone by a lift. DOM-free by
design (bounds are analytic, from geometry attributes and path control points via
`parseSvgPath`), so the CLI can lift too. Untrusted-input caps are named and exported:
`SVG_LAYERS_MAX_CHARS` 4 MB, `SVG_LAYERS_MAX_TAGS` 40 000, `SVG_LAYERS_MAX` 64 layers,
`SVG_LAYERS_MAX_CANDIDATES` 4 000 root children clustered (the clustering is a pairwise
union-find, so its cost is quadratic - measured before the cap: 10 000 leaves 0.7 s,
20 000 leaves 4.3 s, 39 000 leaves 16 s, i.e. a hang on markup a stranger sends),
`SVG_LAYERS_MAX_DEPTH` 64, `SVG_LAYERS_MAX_DESCENT` 8, `SVG_LAYERS_MAX_REFS` 64. BOTH
count caps merge the TAIL rather than truncating - a contiguous run at the end of the
document folds into one layer, so paint order is preserved and a cap can never drop
artwork. Nothing throws; junk yields fewer layers and more warnings. No HostV1 method
changed.

1.118.0 - additive: the `kf` wire grammar gains the `w` and `h` channels
(`engine/src/keyframes.ts`; plans/104 section 5.2, the P1 reversal - Andy, 2026-08-12 hands-on:
"I can't change width and height of elements and have them tween"). Both are ABSOLUTE px
and REPLACE the box's own size for their segment, exactly as `z` replaces the `z` field -
a multiplier reading is what `s` already is, and `s` does not reflow. Clamped to
[0, 16384] (twice `PLATE_LONG_SIDE_LARGE`: this is the untrusted-input backstop, the
operative limit is the plate budget's long-side cap, which knows the export scale),
quantised at 0.01 like every other px channel. The vocabulary stays append-only - the two
names are added at the TAIL of `KF_CHANNELS`, because that array is the canonical
serialisation order and inserting in the middle would re-spell tracks already on the wire.
Consequence, and the reason this is a minor rather than a footnote: `KF_MAX_CHARS` is
DERIVED from `KF_MAX_KEYS`, and two more channels are 20 chars per key - the widest key
goes 154 → 174 chars and a full-density track 39 679 → 44 799 - so the cap moves
40 960 → 49 152 to keep dominating (`tests/keyframes.test.ts` re-derives it and would have
failed otherwise). No HostV1 method changed. Consumers: the sequence DOM applier writes
`width`/`height` per frame - the one deliberate exception to the no-layout-writes rule,
because text REFLOWING is the whole point - and the canvas compositor treats a w/h-tweened
layer like a live Lottie (per-frame re-capture), since a stretched plate would diverge from
the preview's reflow and parity beats speed.

1.117.0 - additive: C2PA 2.4 text-binding WRITE side (`engine/src/c2pa-containers.ts`,
`engine/src/c2pa.ts`; plans/105 M3 - `plans/105-m345-brief.md`,
`plans/105-c2pa-text-bindings-and-docs-mastheads.md` section 5). `C2PA_FORMATS` gains `html`, `js`,
`css`, `md`: `placeHtml` (section A.7 inline form) inserts/replaces `<script type="application/c2pa">`
in `<head>`, excluding the WHOLE element (opening tag through closing tag inclusive) - wider
than the SVG placer's base64-only exclusion, because that is what section A.7.1.3 requires; `placeArmor`
(section A.9) writes the `-----BEGIN/END C2PA MANIFEST-----` block as a `data:application/c2pa;base64,…`
URI inside each host language's comment syntax (`//` js, `/*! … */` css with the preservation
hint, `<!-- -->` md), end-of-file, one exclusion over the whole block, LF/CRLF only. A new
`html-fragment` format registers a documented Lolly profile - markup+script fragments (no
`<head>`, so section A.7 does not apply) carry the same section A.9 armour mechanics in an HTML comment; it is
real C2PA, spec-adjacent only in its carrier convention, and reports itself as exactly that, never
as section A.7. The two-pass placer contract holds for all four: bytes outside the exclusion depend only
on manifest length. `buildC2paManifest` gains an optional `aiDisclosure` input - assertion label
`c2pa.ai-disclosure` (section 18.28), CBOR map `{modelType, modelName?, modelIdentifier?,
contentProfile?: {humanOversightLevel}}`, `modelType` defaulting to the generic
`c2pa.types.model` - referenced from `created_assertions`, plus `specVersion` (`'2.4.0'`) inside
`claim_generator_info` (the 2.4 move off the claim). M1's `report.aiDisclosure` reader round-trips
every new field. Also new: an external-store build path (for M5) that signs bytes with a
whole-document hash (no exclusions) and returns the JUMBF store without placing it in any
container - the section A.7 link form / section 11.4 external-manifest shape - with optional ingredients via
the existing `prepareC2paIngredientFromStore` machinery. No shipping library (c2pa-rs v0.90.10)
implements section A.7/section A.9 yet, so this write path is validated by spec-literal fixtures and our own
M1 read path, not third-party interop - flagged, not hidden. No existing signature or export
behaviour changed; a call that never sets `aiDisclosure`/`specVersion` and never targets the new
formats is byte-for-byte the 1.116.0 behaviour.

1.116.0 - additive: `verifyC2pa(bytes, { externalManifest })` (plans/105 M2 section 7). C2PA 2.4
section A.7.1.2 (`<link rel="c2pa-manifest">`) and section A.9.3 let a text asset REFERENCE its credential
instead of carrying it; 1.115.0 reports that honestly (`manifest.inaccessible` + the URL on
`report.textBinding.manifestUrl`) but could never check such a document, because resolving the
reference is network I/O and the engine does none. The new option closes that loop without
moving the rule: the CALLER fetches the sidecar under its own policy - the web shell only for a
same-origin URL, only on an explicit "Fetch and check" click - and hands the bytes back in. The
store is then verified against the document exactly as an embedded one would be (the link form's
binding is the whole document, no exclusions, so the existing hash pipeline runs unchanged).
It is consulted ONLY when the asset carries no store of its own, so a caller-supplied manifest
can never shadow an embedded one, and `report.textBinding.externalManifestUsed` marks every
report that used it - "these bytes match a credential served from over there" must not be able to
print as "the credential inside this document is intact". No existing signature or report field
changed; a call without the option is byte-for-byte the 1.115.0 behaviour.

1.115.0 - additive: C2PA 2.4 text-binding READ side (`engine/src/c2pa-extract.ts`,
`engine/src/c2pa-verify.ts`; plans/105 M1 - `plans/105-m1-brief.md`, `plans/105-c2pa-text-bindings-and-docs-mastheads.md`
section 1-3). `SniffFormat` gains `'html' | 'text' | 'code'`, sniffed in a fixed order (binary
magics → html → svg → code → text) ahead of the existing loose `<svg` scan, so a pasted
HTML document with an early inline `<svg>` no longer mis-sniffs as `'svg'`. Three new
extractors - `extractC2paFromHtml` (section A.7: `<script type="application/c2pa">` in `<head>`
or `<link rel="c2pa-manifest">`, at most one association), `extractC2paFromArmor` (section A.9:
the `-----BEGIN/END C2PA MANIFEST-----` comment-armour block, `data:` URI or external URL
ref), and `extractC2paFromTextVS` (section A.8: the U+FEFF + variation-selector wrapper, magic
`C2PATXT\0`, version 1 only) - all implementing a new `extractC2paDetailed(bytes, format)`
that returns `{ store, externalUrl? }`; the engine never fetches an external ref, that's
the shell's call. Hash validation in `c2pa-verify.ts` gets an `html`/`code` branch reusing
the existing raw-byte exclusion walk, and a distinct section 15.12.1.3 pipeline for `text`: locate
every wrapper, NFC-normalize (`String.prototype.normalize('NFC')`) before UTF-8 encoding
and hashing, match the wrapper whose byte range exactly equals the assertion's exclusions,
and report a fragment-honest status when a wrapper decodes but doesn't hash-match (pinned
against a composed-vs-decomposed é fixture). `report.aiDisclosure` now reads the
`c2pa.ai-disclosure` assertion (section 18.28: `modelType`/`modelName`/`modelIdentifier`/
`oversight`) for ALL formats, and `claim_generator_info.specVersion` is read alongside the
tolerated claim-level field. Read-only: no writer/placer, `C2PA_FORMATS` untouched - write
side is M3. New suite `tests/c2pa-text-bindings.test.ts`.

1.114.0 - additive: `engine/src/keyframes.ts` - keyframe tracks, the `kf` wire grammar,
and the depth-camera projection (plans/104 P0). No HostV1 method changed; this is a new
pure module on the public surface, which is where the engine already keeps wire formats
(url-mode, blocks) and where the plan put it (section 12 Q9) so the goldens live at the repo root
and a future CLI posed-still path is free.

What it owns. **The wire**: `parseKf`/`serialiseKf` over the LOCKED section 5.1 grammar -
keyframes separated by `*`, tokens by `_`, first token `t<ms>` in local box time, charset
`A–Z a–z 0–9 - . _ * ( )` and nothing else (every member is encodeURIComponent-unescaped
and safe inside double quotes in bash/zsh, because "the CLI is URL mode under a different
transport" is law; `!` is out for exactly that reason, which is why a custom bezier is
paren-delimited `eb(0.32)(0)(0.67)(1)`). A channel token matches the LONGEST channel name
whose suffix parses as a strict decimal, so `rx-8` is `rx` at −8 and never `r` followed by
junk; anything that matches nothing is skipped, never thrown. Parse caps are the
untrusted-input posture, since a `kf` value is free text that can arrive from a
hand-edited share URL: 256 keyframes, `KF_MAX_CHARS` chars, `t` clamped to an hour, every
channel clamped (`b` 0…300, `o`/`a` 0…1, `s` 0.01…100, degrees and `p` likewise; `z`
±12000, because one `kf` grammar carries both a box's lift and the CAMERA's dolly, and
`camZ` is the only zoom control there is - the per-box field's own −300…900 is
`KF_Z_FIELD_CLAMP`, applied where that field is read) and quantised at the section 4.6 quanta -
`t` integer ms, px 0.01, unit-ish 0.001. Parse applies the clamps and quanta too, which is
what makes the round-trip law `parse(serialise(parse(s))) === parse(s)` true by
construction rather than by luck - and the char cap is DERIVED from the key cap
(`KF_MAX_KEYS` × the widest a keyframe can serialise to, 40 960 > 39 679) so that stays
true at full density instead of only for short tracks: two caps that cannot both be met
would mean the module emitting a wire it then truncates. That is also what lets the hooks
hold their strict-emission rule: parse, re-serialise, emit, so raw user text never reaches
a `data-t-kf` attribute.

**Easing**: eight named preset tokens that round-trip BY NAME - `el ei eo eio ev ea es ek`
(linear, ease-in, ease-out, ease-in-out, overshoot, anticipate, smooth, snappy) - plus
`eh` hold and the custom `eb(...)`. The first six are byte-identical to the web shell's
`EASING_POINTS`, so an ease authored on a transition and one authored on a keyframe are
the same curve; `smooth` is `cubic-bezier(0.4,0,0.2,1)` as the plan specifies and `snappy`
is `cubic-bezier(0.4,0,0.6,1)` (Material's "sharp": the same in-ramp as smooth, a much
later out-handle). `kfEaseToken` ⇄ `kfEaseCss` is the mandatory bidirectional adapter
between a track token and the canonical `cubic-bezier(a,b,c,d)` wire the easing editor
speaks - the canonical spelling uses commas, which the charset bans, so without the
adapter the two vocabularies could not meet. `cubicBezierAt` is a deliberate local copy of
the shell's (the engine must not import from a shell), pinned by golden tables on both
sides.

`subdivideKfEase(ease, λ)` is the segment-splitting half of the same vocabulary, and the
reason a trim/split/join rebase (section 5.6) can be honest rather than approximately honest: a
segment interpolating `av → bv` through eased progress `E`, cut at the time fraction λ,
needs `E_L(u) = E(u·λ)/E(λ)` before the cut and `E_R(u) = (E(λ + (1 − λ)u) − E(λ))/(1 −
E(λ))` after it - exactly the de Casteljau halves of the cubic at the parameter where
x = λ, each rescaled back into the unit square, returned as canonical tokens (a half that
lands on a preset comes back BY NAME). It reproduces the original to the bezier quantum;
the THREE inexpressible cases keep the original token and say so - `eh` has no bezier to
split; `E(λ) → 0`/`→ 1` make the half's endpoints coincide, so a two-point segment is
constant whatever curve it carries; and a renormalised half whose control y leaves ±10
cannot be spelled on the wire at all. That third case is the one the M1 review found:
`easeFromPoints` CLAMPS y to ±10, which is right for an author typing a wild bezier and
catastrophic for a subdivision - a half computed at y = −40 came back spelled −10, a
completely different motion, silently. Detected and refused now, which also states the
residual honestly: only the overshoot family reaches its own endpoint value in flight
(`ev` crosses E = 1 at λ ≈ 0.369, `ea` returns to 0 at λ ≈ 0.274), and around each
crossing there is a narrow band - λ ∈ [0.348, 0.387] and [0.264, 0.284] - where the halves
are an approximation with up to ~0.10 of error in E, falling to zero at each edge. The
earlier claim that "the excursion is bounded by the endpoints' separation" was false
exactly there: `ev`'s endpoints COINCIDE while its excursion is 56 % of travel. That is an
expressive limit of any easing vocabulary, ours or CSS's, and the tests sweep both bands.

**Evaluation**: `evaluateKf(track, t, channels?)` is sparse per channel - each channel
interpolates between the nearest keyframes that MENTION it, so a diamond in between that
says nothing about it is transparent, using the earlier mentioning keyframe's ease, and
clamp-holds outside the authored range. A channel the track never mentions is ABSENT from
the result, so a consumer can tell "not authored" from "authored 0". The segment ease
governs every channel EXCEPT `o`, which always interpolates linearly (a fade that tracks a
slow curve turns to mud once the frame has been through video compression) - `eh` still
holds it, like any channel. Tracks are plain data (arrays of `{t, ease, v}`), so a track
survives `structuredClone` to a worker; the bezier cache is a module-level Map keyed on
the token string, per thread, never a compiled closure inside the cloned form.

**The projection**: `projectLayer` is the section 4.1 fold verbatim - `cx = bx + dxT + dxK`,
`eff = P/(P − (z − camZ))`, `cx' = W/2 + (cx − camX − W/2)·eff`, returning
`{dx: cx' − bx, dy, scale: eff, alphaGuard}` in stage-native px BEFORE the export scale S.
The transition and keyframe offsets sit INSIDE the projection and therefore scale by eff,
which is the whole point: the naive reading (camera displacement added to an unscaled
offset) makes a slide enter land short on a lifted layer. Rotation is untouched because a
uniform scale commutes with it. `projectDepth` carries the section 4.5 behind-camera guard as
formula, part of the byte-stable contract: `u = (z − camZ)/P`, eff uses `min(u, 0.9)` so
`eff_max = 10`, `alphaGuard = clamp((0.9 − u)/0.1, 0, 1)` - eff FREEZES at its clamp while
alpha ramps, so the pole is unreachable and everything stays continuous. eff is evaluated
in P-space (`P/(P − min(dz, 0.9P))`) and held to `KF_EFF_MAX`, so the clamp returns exactly
10: `1/(1 − 0.9)` is 10.000000000000002, and a declared maximum the function can exceed is
no use to the plate buckets and λ budget that measure themselves against it. `dofBlur` is the
section 4.4 corrected formula `a·K·|z − f|·eff(z)·eff(f)/P` with `K = 40` px at `P = 1200`
exported as `DOF_K`; the `eff(z)·eff(f)` factor is the correction, since without it
dollying toward an out-of-focus layer SHARPENED it. `resolveCamera(cameras, t)` is the
section 5.4 cuts rule - latest-in-array clip whose half-open window covers t, folded to a pose -
and with no camera covering t it returns the DEFAULT camera (P = 1200, pose 0), never a
literal identity: an identity would swallow z, while the default projects z = 0 at eff = 1
so every existing document renders byte-identically. Every channel of the resolved pose is
re-held to its declared range on the way out (not just `p`): `ev`/`ea` overshoot by design,
so a segment between two in-range keys leaves the range mid-flight, and the resolved pose
is the public contract the camera panel and the plate budget read. `p` is perspective
strength (FOV), never magnification: `eff(z = camZ) === 1` for every value of it, which is
why a dolly is `camZ` and why `p` is a no-op on a flat scene.

1.113.0 - additive: `runtime.startLive(opts?)` gains `{ source?: 'camera' | 'asset' }`.
The live frame loop was built for the camera, but a shell can equally feed it a
decoded ANIMATED ASSET (an SVG with CSS/SMIL animation, a GIF/APNG, a video) -
same onFrame hook, same drop-overlap throttle, same render path. What must differ
is provenance: only `source: 'camera'` (the default, so every existing caller is
unchanged) marks rendered frames as a live device capture (`liveCameraShown` →
IPTC digitalCapture in the export's C2PA capture signal); `source: 'asset'`
renders identically but never sets that flag, because claiming a sensor capture
for replayed file content would be a false statement in a signed manifest. No v1
method changed; the zero-arg call keeps its exact behaviour.

1.112.0 - additive: `runtime.applyPatch(values)` - an atomic multi-input apply with ONE
render (plans/100 section 5, wave 0.4). The batch counterpart to `setInput`, for a remote
collaboration op that arrives as a set of values (and equally for `/multi` and URL
hydration). Every value passes through EXACTLY `setInput`'s constraint path
(`updateInput` → `constrain`), so a batch can never put anything in the model a keystroke
couldn't; a key naming no declared input - version skew between peers - or one whose value
the constraints reject is dropped ON ITS OWN, leaving the rest of the batch to apply, and
nothing throws mid-apply (section 11.11). `onInput` still runs per CHANGED id, sequentially in the
object's insertion order, under the same `HOOK_BUDGET_MS` time-box and warn-don't-throw
handling `setInput` uses - the hook contract is per-input and does not change meaning
because the values arrived together. What coalesces is the RENDER: subscribers are notified
exactly once, after the last hook, instead of once per key (a batch where nothing landed
emits nothing at all). Each hook is told the value that actually entered the model
(post-constrain, flattened), captured at apply time so an earlier hook's patch cannot change
what a later id reports. `setInput` is untouched, and the live-capture retirement + nested
`composes` re-resolution tails behave exactly as they do there (both paths share the one
`setInputSeq` counter, so neither can clobber the other's newer values).

Same minor, and what makes the sentence above mean something: `constrain` (`src/inputs.ts`)
now covers the types it used to fall through - a `select` value must be one of the
manifest's declared `options` (section 11.11's "enum outside whitelist"; skipped for a
`brandFonts` select, whose list the shell extends at runtime, and for a select that
declares none, exactly as `preflight`'s `checkSelectValue` already carved out), a `boolean`
must be a boolean (the URL/CLI spellings `1`/`0`/`true`/`false`/`''` still normalise,
anything else is refused), `date`/`time`/`datetime-local`/`url` must be strings, and a
`blocks` value must be an array. Rejection is the existing convention - the input keeps its
prior value - so this tightens every write path (keystroke, canvas commit, `/multi`,
`applyPatch`) identically. `asset` and `color` stay shape-blind on purpose: their
legitimate values are object-shaped and completed later in the lifecycle (`resolveAssetRefs`
/ `resolveTokenRefs`), so a caller taking values from an untrusted peer gates those two by
declared type at its own boundary. Hook patches are unaffected - `mergePatch` is the tool's
own trust boundary and never passed through `constrain`.

1.111.0 - additive: endpoint binding, one routed-line renderer, real dash segments on the
committed connector layer (plans/96 P3–P5). `engine/src/connectors.ts` grows the plan-96
BOUND-path half of the unified primitive. `pathRouteStyle(kind, override, nodeCount)` is
the ONE mapping from a path's spline kind to the route connector management draws it with
- `line`→`straight` (a 3+-node authored polyline→`elbow`), `spiro`→`arc`, every other kind
→the smooth `curved` S - with `override` (a box's explicit `route` field) winning whenever
it names one of the thirteen `CONNECTOR_ROUTE_STYLES`, which is what keeps the plan-90 edge
migration lossless: six kinds cannot name thirteen routes, so `elbow-src` survives as an
override rather than collapsing to `elbow`. `routedLineSvg(a, b, decor)` is now the single
committed-geometry function; `buildConnectorSvg` reduces a row to a `ConnectorDecor` and
calls it, so a legacy `{arrow,head}` edge and a plan-96 `{headStart,headEnd}` path are the
same drawing by construction. `ConnectorRenderOpts` therefore gains `headStartField` /
`headEndField` (naming either switches a row onto the path reading) plus `dashArrayField` /
`dashFitField`: an AUTHORED dash pattern on the committed layer is emitted as real `<line>`
segments through `dashFit.dashSegments`, corner-fitted per route span (elbow bends get a
whole dash; a sampled curve or arc is one span), never `stroke-dasharray`. `host.connectors`
gains `routeStyleForKind` and `routeStyles` so a pack hook and the editor agree about which
route a bound path takes. No existing method changed signature and no existing output moved
- the legacy edge reading maps `arrow:'end'`→`{headStart:'none', headEnd:head}` and
`arrow:'both'`→both, byte-for-byte what it drew before.

1.110.0 - additive: path decorations + dash fitting on host.connectors (plans/96 P1).
`host.connectors` grows three optional members, all attached from the engine by the new
`makeConnectorsApi()` factory (which every shell now calls instead of naming `{ build }`
itself, the way `makeColorApi`/`makeGeomApi` already work, so the surface cannot drift):
`pathHeadSvg({ tipX, tipY, angle, head, color, width })` - an arrowhead for ONE tip of an
authored path, addressed by tip + outward tangent in RADIANS and drawn by the SAME
`edgeArrowHead` shapes a routed connector uses, so a spline, a line and a connector
decorate identically in the editor, the export and the CLI; `pathHeadInset(head, width)`,
its shaft-trim pair; and `dashFit`, the new pure module `engine/src/dash-fit.ts`.
`dashFit.parse(text)` is manual dash entry for power users - whitespace/comma separated
non-negative numbers, ≤16 of them, each 0…1000, odd lists doubled per the SVG rule, and
NUMBERS ONLY on the way out, which is the injection boundary (a hook serializes the array;
it never puts typed text on `stroke-dasharray`). `dashFit.cornerFitDashArray(spanLengths,
pattern)` is Illustrator's "align dashes to corners and path ends": each corner-to-corner
span carries half a dash at each end, so the two halves either side of a corner join into
one dash centred on it, with the pattern scaled by `L / (n · cycle)`, `n = max(1,
round(L / cycle))` - clamped to [0.66, 1.5], beyond which the span keeps the authored
pattern unscaled so a 2px stub cannot mint absurd dashes. `dashFit.dashSegments(…)` is the
same fit as absolute `[start, end]` intervals for the committed/export render, which draws
real geometry and never `stroke-dasharray`; both read one assembly, so their inked length
agrees to 2dp. No existing method changed and no existing output moved.

1.109.0 - additive: versioned design systems (plans/97 section 6a). New pure module
`engine/src/design-version.ts` - the version ledger (`readVersionIndex` /
`withVersionIndex` / `stripVersionIndex`), the slug grammar (`slugifyVersion`,
`isVersionSlug` - the id-segment charset, the 48-character bound and the reserved
`latest`, enforced at BOTH the mint and the read, so an imported pack cannot post a
slug nobody typed, `suggestNextLabel`), the asset-id scheme (`versionAssetId`,
`isVersionAssetId`, and `pickHeadAssetId`, the descendant-exclusion rule every
shell's tokens discovery now applies), the `resolveDesignVersion` ladder (explicit
override → the tool's manifest pin → the active version → the head), `docChecksum`
/ `diffTokenDocs` for publish-time compat diffs, and the pinned-asset helpers
(`collectAssetTokens`, `collectFontFamilies`, `frozenAssetId`, `applyPinnedAssets`).
All re-exported from the barrel so the web bridge, the CLI and the MCP server
resolve a version identically instead of each inventing the rule; the web shell's
`lib/design-system/versions.ts` became a re-export of it. Reserved param `designv`
joins `RESERVED` in url-mode (the per-render override; `designv=latest` previews the
edit head) and `UrlState` gains `designVersion`; it is deliberately absent from
`serializeUrlState`, so a share link never pins its recipient to your version.
`tool.json` gains an optional `designVersion` pin, admitted by both schema copies
and NOT enforced at load: unlike `engineVersion`, an unresolvable pin falls through
the ladder rather than refusing the tool, and `validate:catalog` checks that a pack
tool's pin names a version that pack actually ships. No v1 method changed, and a
design system that never publishes resolves exactly as it did before.

1.108.0 - additive: palette exchange on host.color. Two new optional methods -
`host.color.paletteExport(swatches, format, opts?)` and
`host.color.paletteExportBytes(swatches, 'ase')` - attached verbatim from the new
pure module `engine/src/palette-export.ts`. A flat `PaletteSwatch[]` (`{ key, name,
group, hex }`) serialises to a DTCG design-tokens JSON, a CSS custom-properties
block, bg/text/border utility classes, an SCSS `$var` block, a GIMP `.gpl`
(all TEXT, via `paletteExport`), or a binary Adobe Swatch Exchange `.ase`
(via `paletteExportBytes`). Unresolved / non-hex swatches are dropped. The six
serializers were LIFTED out of the web shell's `shells/web/src/lib/swatch-export.ts`
(now a thin re-export over the engine), so the brand editor's Swatches download and a
tool's palette export produce byte-identical files across web, Worker, Tauri and CLI.
The `color-palette` community tool uses them to export DTCG JSON / CSS / SCSS / GIMP /
Adobe swatches (the `.ase` rides the `exportStill` hook). Also additive at the runtime
seam: `json` becomes a per-tool opt-in sibling `template.json` (model-dump default
unchanged when a tool ships none), and `css`/`scss`/`gpl` join the model-derived
data-export formats (`DATA_FORMATS` + the loader's `textExts`). No v1 method changed.

1.107.0 - additive: inverse APCA on host.color. New optional
`host.color.solveApca(hue, chroma, targetLc, bgHex, opts?)` - a verbatim wrapper
over the engine's `solveLightnessForApca` (engine/src/color-tools.ts): at a fixed
hue/chroma it returns the OKLCH lightness whose FORWARD APCA Lc against `bgHex` is
closest to `|targetLc|`, plus the signed Lc it achieves and a `reachable` flag
(false past the branch's ceiling - then the closest achievable colour is returned).
Polarity is fixed from the background, never the sign of the argument. The other
direction of the forward `apca` metric, and the one move a contrast-first ramp needs
(the color-palette tool's Contrast mode is the first caller). Attached inside
`makeColorApi()`, so every shell (web via installToolApis, Worker, Tauri, CLI
verbatim) gets it with no shell-file edit. Optional/additive, feature-detect
`host.color.solveApca`. `ColorApcaSolveOptions`/`ColorApcaSolveResult` mirrored into
`@lolly-tools/core`'s host-v1 contract.

1.106.0 - additive: committed connector/line/arrow render. New optional
`host.connectors` (ConnectorsAPI: `build(edges, rectById, opts) → string`) - a thin,
verbatim wrapper over the engine's `buildConnectorSvg` (engine/src/connectors.ts), the
ONE source for connector geometry (routing, arrowheads, the `id | @x,y` endpoint model)
that also drives the editor's live preview. A canvas tool's hooks.js renders its
committed, export-safe connector layer in one line (`host.connectors.build(...)`), and
because every shell attaches the SAME engine function, a headless CLI `--export` keeps
the lines - no shell-only geometry. Export-safe by construction: filled `<path>`/`<line>`
heads (never `<marker>`/`<polygon>`), real `<line>` dash segments (never
stroke-dasharray). Attached beside `host.color`/`host.geom` (web via installToolApis,
CLI verbatim). Optional/additive, not capability-gated: feature-detect `host.connectors`.
Plan 90 R1.

1.105.0 - additive: on-device raster primitives. New optional `host.raster`
(RasterAPI: canRaster/measure/decode/encode) - a source (bytes/Blob/URL/AssetRef)
in, a drawable `ImageBitmap` or an `ImageInfo` out; raw RGBA or an `ImageBitmap`
in, encoded bytes out. The bridge home for the `canRaster()`/`loadImage()` probes
tool hooks used to open-code against the DOM (`typeof document`, `new Image`) -
which are WRONG inside a Worker, where `document` is absent even though
`OffscreenCanvas` works - so a hook asks the host, not the realm, and stays correct
once isolated (plans/86 section 6.1). DOM-free CONTRACT: no `HTMLImageElement`/`document`
crosses the surface; `decode` returns an `ImageBitmap`, drawable on a main-thread
canvas AND a Worker OffscreenCanvas. Distinct from `host.images` (the bytes-in/
bytes-out convert path with no pixel access). Web (and Tauri, via the web bridge)
only for now; undefined on the headless CLI, which a tool feature-detects and
degrades past, exactly like `host.images`. No v1 method changed.

1.104.0 - additive: `host.c2pa.sign` widened for the any-media authorship path.
Its opts grow from `{ description }` to `C2paSignOpts` - `{ description, title,
author, rights, ingredients, action, imprinted }` - so a tool can stamp an EXISTING
file (made elsewhere) with the artist's asserted author (dc:creator), copyright +
licence (dc:rights), and a title, and - crucially - carry any manifests already
inside the bytes forward as C2PA **ingredients** (a document-level PDF manifest, a
signed raster element in a PDF/SVG, a signed track in an MP4), so nested credentials
are preserved and referenced, never orphaned. `action` picks an honest history:
`'imported'` (default when author/rights/ingredients are given) preserves the essence
byte-for-byte and claims c2pa.metadata (+ the engine's c2pa.opened per ingredient),
NEVER c2pa.created; `'redacted'` (the default when none are given) keeps the original
v1.85 redact behaviour byte-for-byte. Backward compatible: existing `sign(bytes, fmt,
{ description })` callers (redact) are unchanged. Widened in `packages/core` (the
contract), the web shell (`signFreshC2pa`), and - new - the CLI bridge (`host.c2pa`
was web-only before; the DOM-free engine `embedC2pa` signs identically headless).
Also adds `host.c2pa.readIngredients(bytes)` → `IngredientCredential[]`: reads every
manifest a file already carries (its own container-level credential for every
supported format, PLUS the signed rasters an SVG embeds as `<image href="data:…">`)
so a tool can feed them straight to `sign({ ingredients })`. Backed by the new
engine `collectIngredients` (exported from the barrel). Multi-file batch is also
now expressible: a `file` input may set `multiple: true` (value becomes an
`InputFile[]`, the web picker takes many, the CLI collects repeated `--id=path`),
and an `exportFile` hook may return one `{ bytes, mime, filename }` per file, which
each shell delivers as a single zip.

1.103.0 - additive: on-device background removal. New optional `host.matte`
(MatteAPI: isAvailable/backend/models/modelBytes/cached/canRun/run - a plain RGBA
frame in, the same frame with a model-computed straight-alpha matte out), the
structural twin of `host.upscale`: the shell owns the onnxruntime-web runtime, the
WebGPU→WASM backend, the one-time consented ONNX download (IndexedDB-cached), and
the memory bound. Its provenance is DELIBERATELY not the upscale kind - a matte
invents nothing (RGB is the original, only alpha is computed), so the result is
disclosed as a C2PA edit step ("Background removed with <model> <version>") with
the original preserved as an ingredient, and is NOT flagged AI-generated. Roster
(all permissive, Apache-2.0/MIT; the popular BRIA/RMBG models are non-commercial
and excluded): u2netp / isnet-general / birefnet-lite, each with its own
normalization + activation (shell-side lib/matte-models.ts MATTE_MODEL_SPEC).
Models ship STAGED-OFF until each licence + ONNX is human-verified
(scripts/fetch-matte-models.ts). Also fixes a type drift: `exportStill` (engine
1.100) was missing from `ToolHookFlags`; adding it lets the export panel open the
pro float formats (exr/hdr) on the web for a tool that owns them through exportStill
+ host.codec (Bitmap Studio's EXR/Radiance masters - previously filtered out).

1.102.0 - additive: layered-bitmap import/export. New engine exports (plain
modules, consumed like pdf-map - no bridge surface): `readPsd`/`isPsd` (PSD v1
AND v2/PSB; RGB + grayscale + CMYK-via-embedded-ICC with a naive warned
fallback; 8/16-bit folded to 8; RAW/RLE always, ZIP via an injected
`InflateFn`; luni names, lsct groups, raster masks into alpha, merged
composite, ICC resource 1039; typed `PsdUnsupportedError` refusals, per-layer
warn+skip, `maxDecodedBytes` budget - default 256 MiB - reserved before every
allocation), `writePsd` (8-bit RGB v1: PackBits channels with RAW fallback,
luni names, opacity/blend/visibility, merged composite, ICC pass-through;
read(write(doc)) pins name/rect/opacity/blend/visibility/pixels),
`readXcf`/`isXcf` (v0–v011 + attempted v012+ with warning; 8/16-bit non-linear
integer precision; none/GIMP-RLE/zlib tiles; offsets, float opacity, modes,
groups via item paths, masks; same budget discipline; typed
`XcfUnsupportedError`), shared `packbits.ts` + `raster-layers.ts`
(`LayeredRasterDoc`/`RasterLayer`, blend tables PSD↔CSS and XCF→CSS pinned to
GIMP 2.10 devel-docs/xcf.txt), and `sniffLayeredRaster` in media-sniff. An XCF
WRITER is deliberately deferred (single strict consumer; the conversion story
is XCF in → PSD out). Fuzz targets `psd` + `xcf` seeded from our own writers.

1.101.0 - additive: on-device AI image upscaling. Two backwards-compatible
surfaces: (1) the optional `host.upscale` API (isAvailable / backend / models /
modelBytes / cached / canRun / run) - a plain RGBA `UpscaleFrame` in, a larger
one out, run entirely on-device (onnxruntime-web, WebGPU→WASM) with a one-time
consented model download and memory-bounded tiling; the models ship under
permissive licences (BSD-3-Clause / Apache-2.0) whose attribution the shell
carries. NOT capability-gated (feature-detect `host.upscale`); NOT driven from a
time-boxed hook - a shell offers it as an explicit, cancellable, progress-bearing
action whose result becomes an asset. (2) `ExportOpts.c2paAiUpscale` +
`exportActionSteps({ aiUpscale })` + the `COMPOSITE_SOURCE_TYPE` constant - the
runtime, when the render's essence is an AI-upscaled asset (carried on the placed
asset's `meta.aiUpscale`), marks the created step with the IPTC
`compositeWithTrainedAlgorithmicMedia` source type and appends an "AI-upscaled
with <model> <version>" edit step. The read side already maps the slug to
'composite' (c2pa-extract aiKind), so /verify surfaces the AI flag unchanged.

1.100.0 - additive: real high-bit-depth raster output for tools. Two new,
backwards-compatible surfaces: (1) the optional `host.codec` API (png16 / exr /
radiance / dither8) - a linear Float32 `CodecFrame` in, finished deep image
bytes out, wrapping the engine's own `deep-encode.ts` (packExr / packRadiance /
packPng + a new Floyd–Steinberg dither) so web and CLI encode identically; (2)
the `exportStill` hook + `manifest.hooks.exportStill` - intercepted in
`runtime.export` before the DOM raster path, letting a tool return its own
encoded bytes (`{ bytes, mime }`) for a format and skip host.export.render, or
decline (null) and fall through unchanged. Non-declaring tools and every format
a tool doesn't own stay byte-identical. Tool-supplied bytes carry no watermark /
engine provenance (the exportFile precedent).

1.1.0 - additive: `file` input type, the transform output path
(host.export.file + the `exportFile` hook + runtime.exportFile), and the
`privacy: 'on-device'` utility marker. All backwards-compatible with ^1.0.0
tools; no v1 method was removed or changed.

1.2.0 - additive: tool composition / nested renders - the optional
`host.compose` capability + manifest `composes` (rendered via resolveNestedRenders
into `{{asset <id>}}` extras). Backwards-compatible; shells without compose just
don't resolve composes (the {{#if}} slot stays empty).

1.3.0 - additive: end-user tool-as-image. A Lolly tool URL (share link / embed
URL) pasted into the asset picker becomes an asset whose `id` is the canonical
embed URL; the runtime re-renders it on load via the new optional
`host.compose.renderUrl` (see tool-url.js). Backwards-compatible; a shell
without renderUrl simply leaves such an asset blank.

1.4.0 - additive: live media. The optional `host.media` capability (a camera
frame source) plus a new `onFrame` hook + runtime.startLive/stopLive let a tool
react to a live camera stream frame-by-frame (e.g. a filter that responds to
motion). Pure progressive enhancement: the hook is only driven where the shell
provides host.media; a shell without it (or a tool without onFrame) is unaffected,
and such tools keep working as ordinary still-image tools. No v1 method changed.

1.5.0 - additive: packed URL state. A whole readable query can be compressed into
a single reserved `z` param (raw DEFLATE + base64url - url-pack.js: packQuery /
unpackToken / expandQuery) so complex tools stay shareable past the ~2000-char URL
ceiling. Pure URL-mode enhancement - no bridge/host method added or changed; the
codec is native (CompressionStream) with graceful fallback to the readable form.

1.6.0 - additive: themable two-colour icons. An asset id may carry a colour
pairing (`<baseId>?theme=<themeId>` - icon-theme.js) which shell bridges parse
before catalog lookup and bake into the resolved SVG at resolve time; pairings
are catalog data (a palette-type asset tagged "icon-themes"), never engine code.
No v1 method signature changed - host.assets.get/isAvailable simply accept the
suffixed id form; a shell that ignores it still resolves the base asset.

1.7.0 - additive: two independent format extensions.
  • `parseDataRows` (data-import.js) maps a user's CSV/JSON file onto a `blocks`
    input's sub-fields, driven by the new manifest `blocks.importData` - the
    ingest counterpart to CSV/JSON export. Pure; the result flows through the
    ordinary input-set path (URL/save-safe).
  • `packTiff` (tiff.js) is a baseline RGB/grayscale TIFF emitter backing the new
    `tiff` export format (the DeviceCMYK TIFF keeps its bespoke shell encoder).
No bridge/host method was added or changed; older tools are unaffected.

1.8.0 - additive: on-device Content Credentials verification (c2pa-verify.js -
verifyC2paPdf / extractC2paFromPdf). The read-side counterpart to the 1.x C2PA
embedder: extracts a PDF's manifest, re-checks hashed URIs, the COSE claim
signature, cert validity and the hard binding, and reports c2pa-rs-style
status codes. Backs the web shell's /valid view and the CLI `validate`
command. Pure engine module; no bridge/host method added or changed.

1.9.0 - additive: Content Credentials for every embeddable raster/vector
container. embedC2pa(bytes, format, opts) stamps png/apng, jpg, gif, svg,
tiff/cmyk-tiff and webp (byte-matching c2pa-rs's asset handlers, same
two-pass hard binding as the PDF path), the claim gains
claim_generator_info + digitalSourceType + an optional `tools.lolly.export`
environment assertion, and verifyC2pa() sniffs + verifies all of the above.
mp4/webm (BMFF/Matroska hashing) and avif stay unstamped for now; ico, eps,
emf and the text/data formats have no C2PA container. No bridge change.

1.10.0 - additive: Content Credentials for video. embedC2pa stamps mp4 (the
spec's BMFF binding: manifest in a top-level C2PA `uuid` box appended last -
stco/co64 never shift - under c2pa.hash.bmff.v2, whose box-walk hash matches
c2patool byte-for-byte) and webm (no standardised Matroska binding exists,
so the manifest rides as a `manifest.c2pa` attachment, application/c2pa,
under the ordinary data-hash binding; SeekHead indexed when there's Void
room). verifyC2pa sniffs mp4/webm/mkv, extracts both carriers and validates
c2pa.hash.bmff.v1–v3 flat bindings (foreign c2patool-signed mp4s included;
fragmented/Merkle reported honestly as uncheckable). No bridge change.

1.11.0 - additive: Content Credentials identity. embedC2pa / embedC2paInPdf
accept opts.signer ({ privateKey | sign(bytes) → raw 64-byte r||s, certDer,
chain }) so a CA-issued device credential replaces the ephemeral self-signed
signer (chain bytes frozen per embed; ES256/P-256 only), and verifyC2pa
accepts { trustAnchors } (root cert DERs) to verify the x5chain and report a
trusted identity instead of the unconditional untrusted row. The DER/X.509
authority moved from c2pa.js to x509.js (byte-identical output), which adds
pemToDer / derToPem / generateCaRoot / issueLeafCert - the leaf follows the
c2pa-rs profile (O + CN subject, emailProtection EKU, SKI/AKI, SAN
rfc822Name = verified email). Pure options on pure functions; no bridge
change.

1.12.0 - additive: richer text shaping on host.text.toPath. The already-declared
`features` (OpenType tags, e.g. ['liga=0', 'salt=1']) is now honoured - passed to
HarfBuzz so ligatures/stylistic-alternates toggles bake into the outlined paths -
and a new `letterSpacing` (px) adds uniform tracking to the pen advance, so
letter-spaced text stays outlined (SVG/PDF/EMF) instead of falling back to a live
<text> element. Additive optional opts on an existing method; no bridge change.

1.13.0 - additive: PDF / Adobe Illustrator (.ai) design import. `interpretPdfPage`
(pdf-map.js) reconstructs a page's content stream into editable DesignNodes -
rectangles/ellipses/text/optional-content-group layers become boxes with real
(y-flipped) coordinates, arbitrary paths become baked SVG `_vectorPath` images, and
form XObjects recurse - the PDF counterpart to the Figma/Penpot walkers. Helpers
`parseToUnicode` / `toUnicodeDecoder` recover text from embedded/subset fonts. Pure
engine module; the shell (pdf-import.js) owns the pdf-lib byte work. No bridge change.

1.14.0 - additive: AES-256 (R6 / ISO 32000-2) PDF standard-security-handler
encryptor (pdf-crypto-r6.js) - the pure crypto behind the "Strong lock" export
tier. buildEncryptDictValues computes /U /O /UE /OE /Perms and encryptObjectBytes
wraps each object (IV ‖ AES-256-CBC-PKCS#7, one file key for all objects); DOM-free
(globalThis.crypto only) with all randomness injected as params, so it round-trips a
fixed byte vector. Applied encrypt-last over finished PDF bytes; the shell owns the
pdf-lib object walk + /Encrypt dict assembly. Pure engine module; no bridge change.

1.15.0 - additive: two-tier whole-zip encryption (zip-crypto.js) - the crypto
behind the "lock this download" option. buildEncryptedZip frames an encrypted zip
from pre-compressed entries: `standard` = traditional PKWARE ZipCrypto (opens
anywhere incl. Windows Explorer, weak), `strong` = WinZip AES-256 / AE-2 (PBKDF2-
SHA1 + AES-256 little-endian CTR + HMAC-SHA1; strong, but not Windows Explorer's
built-in extract). DOM-free (globalThis.crypto only; bundles a small AES core for
the LE-CTR keystream since subtle has no ECB and is too slow per-block); all
randomness injected as params so it round-trips a fixed vector. Verified against
`unzip -P` and pyzipper. Shell compresses with fflate + hands over bytes + CRC; no
bridge method changed.

1.16.0 - additive: animated + video assets, end to end.
  • `sniffAnimatedRaster` / `sniffVideoContainer` (media-sniff.js) classify an
    upload from its header bytes so a shell can tell an animated GIF/APNG/animated-
    WebP from a still one (same MIME, different container) and store it VERBATIM
    instead of flattening it through a canvas re-encode. Pure, DOM-free.
  • a logic-less `{{media <asset>}}` template helper emits the right element per
    asset type - <img> for raster/vector (unchanged), a data-lottie-src marker for
    lottie (reuses the existing enhancer), and <video autoplay loop muted playsinline>
    for video - so any tool can consume the new asset kinds without per-tool if/else.
    Every attribute is escaped (SafeString discipline, like the `markdown` helper).
  • AssetRef.meta.posterUrl is documented as the still fallback frame for a video
    (used for <video poster> and as the export/pre-play still), mirroring lottie.
Helpers are not part of the HostV1 contract, so no bridge version moved; older
shells still render the emitted markup (and, absent the shell's export snapshot,
simply drop the moving frame to a still). No v1 method changed.

1.17.0 - additive: device capture. New optional `host.recorder` (RecorderAPI)
records the microphone (and optionally the camera) to a Blob and exposes a
DOM-free live level meter (AudioLevel = rms/peak/dbfs/clipping/t) - the audio
counterpart to host.media's camera frames; the shell owns getUserMedia +
MediaRecorder + AnalyserNode, the engine sees only numbers + Blobs. New
`microphone` Capability (record prompts for a grant a shell may lack, so unlike
media it IS capability-gated; the CLI provides no recorder). Runtime gains an
`onLevel` hook (drop-overlap, not time-boxed, mirroring onFrame) plus
startMeter/stopMeter (sound-check) and startRecording/stopRecording/cancelRecording
orchestration. ExportOpts.audio gains fadeIn/fadeOut (seconds) - a GainNode
envelope baked into the muxed bed, so music fades need no pre-faded assets.

1.18.0 - additive: honest provenance modes. embedC2pa / buildC2paManifest /
embedC2paInPdf accept opts.authorship ('created' | 'delivered', default
'created'). 'delivered' writes the standard c2pa.published action with NO
digitalCreation source type - for an existing asset a signer distributes but
did not author (surfaced as "Delivered by Lolly"). verifyC2pa now requires a
c2pa.created action for `madeWithLolly` (a delivered asset may name Lolly
without ever reading as authored by it) and adds `report.delivered`
(intact + a c2pa.published action, not created). The created path is
byte-unchanged. No bridge change.

1.19.0 - additive: honest audio-level coaching. AudioLevel (host.recorder meter +
record session) gains OPTIONAL noiseFloor/snr/hum/hiss fields - a slow min-hold
noise floor, signal-to-noise ratio, and two spectral cues (mains-band HUM ratio,
spectral-flatness HISS) computed off the AnalyserNode the shell already builds, so
a tool can honestly warn "noisy room / electrical hum / hiss" not just clipping.
Older tools ignore the extra fields. The web meter now opens RAW (noiseSuppression/
AGC/echoCancellation OFF) so the sound-check measures the true room; the RECORDING
session keeps suppression ON for a clean file. No method signatures changed.

1.20.0 - additive: AudioLevel gains OPTIONAL `steady` (0..1) - the steadiness of the
loudness envelope over ~1.5s (rms coefficient-of-variation, inverted). A fan/AC/hiss
holds a constant rms (steady→1); speech modulates it (steady→0). Lets coaching tell
constant background NOISE from SPEECH regardless of level - a mid-level hiss that a
min-hold noise floor + snr would mistake for "speaking" now reads as a drone. Computed
off the rms the meter already tracks; older tools ignore it. No method signatures changed.

1.21.0 - additive: front/rear camera selection. RecordOpts gains OPTIONAL `facingMode`
('user' | 'environment') and MediaAPI.start() gains an OPTIONAL { facingMode } argument,
so a video-capture tool can offer a flip-camera control (record the scene, not the selfie).
Both default to 'user'; existing callers and shells that ignore it are unaffected - a
shared/ref-counted media stream keeps its original camera (flip = stop then start).

1.22.0 - additive: DXF export. `emitDxf` (dxf.ts) is a fourth sink on the SVG
vector pipeline (alongside emitEmf / emitEps): it serializes the same normalized
device-px IR into an ASCII DXF R12 (AC1009) document - POLYLINE entities with
béziers flattened to a flatness tolerance, y-flipped and scaled to millimetres
($INSUNITS = 4), colour as a nearest AutoCAD Color Index - for CAD / laser-cut /
vinyl / CNC interchange. Text is outlined upstream (no TEXT entities); the raster
escape-hatch has no line-art form and is dropped (count returned so the shell can
warn). Pure, imports only units.ts; no bridge/host method added or changed.

1.23.0 - additive: PPTX (PowerPoint) export. `buildPptxParts` (pptx.ts) assembles
the OOXML part tree for a deck (content types, relationships, a minimal slide
master + blank layout + theme, presentation.xml, docProps) and serializes each
slide's SHAPES to DrawingML - pic (raster at native res, OR a real embedded SVG via
PowerPoint's asvg:svgBlip extension so vectors extract at full fidelity), text
(editable text box), rect (solid/gradient/border block). The shell walks the DOM
into shapes + media and zips with fflate. Purpose: transport a page's treated
images + vectors into PowerPoint as independent, extractable objects (layout
secondary). Pure: strings + byte arrays, no zip, no DOM, no deps. No bridge change.

1.24.0 - C2PA 2.x claims. buildC2paManifest / embedC2pa / embedC2paInPdf now emit a
v2 claim (`c2pa.claim.v2`) by default - the format Gemini and every current C2PA
validator (c2patool, contentcredentials.org / c2pa-rs) produce and read: no free-text
claim_generator, no dc:format, a REQUIRED single claim_generator_info map, references
split into created_assertions (+ optional gathered_assertions), the actions assertion
relabelled c2pa.actions.v2 (softwareAgent a generator-info map), and the schema.org
CreativeWork author assertion dropped (the 2.x spec removed it). Box UUIDs, the
data-hash / BMFF bindings, the COSE ES256 envelope, the x509 signer, and every
per-format embedder are version-independent and unchanged; the two-pass length-freeze
carries the differently-shaped-but-deterministic v2 claim. buildC2paManifest keeps an
internal `claimVersion` (default 2; `1` builds the legacy c2pa.claim) purely so the
verifier's v1-read path stays test-covered - the embedders never request it, so Lolly
only ever WRITES v2. verifyC2pa now READS both: it branches on the claim box label,
reads created_assertions + gathered_assertions and the single-map claim_generator_info,
and recognises c2pa.actions.v2 - so external v2 credentials (Gemini "Nano Banana",
Adobe, OpenAI, …) verify on-device instead of failing `credential.unreadable`. No
bridge change.

1.25.0 - additive: catalog signing + runtime integrity verification
(catalog-integrity.ts - closes the SOVEREIGNTY.md "catalog origin is a trust
anchor" boundary). A deployment signs its tool catalog at build time
(scripts/sign-catalog.ts writes catalog/tools/index.sig.json: a sha256 per
tool file - hooks.js included - plus a hash of the exact index.json bytes,
ECDSA P-256/SHA-256 over the canonical-JSON envelope; canonicalJson is the
single shared serialization on both sides). A shell that pins the public key
passes loadTool's new optional `integrity` opts ({ envelope, publicKey }):
the loader then verifies every fetched tool file BEFORE the runtime can
compile hooks.js - a tampered, stripped-but-signed, or unsigned-extra file
is a hard ToolLoadError (fail closed; this also closes the tryFetch
silent-strip hole for signed hooks.js/styles.css), and module-hooks tools
are refused outright since their imported bytes never pass through the
loader. Without integrity opts nothing changes except a one-time
"unsigned catalog" console warning (the dev/compat path). Pure engine
module, DOM-free (globalThis.crypto.subtle only); no bridge change.

1.26.0 - additive: honest export action history + ingredient credential
preservation. (1) buildC2paManifest / embedC2pa / embedC2paInPdf accept
`actions` (a C2paActionInput[] - action code + optional digitalSourceType +
description), REPLACING the historic single created/published action; the new
exportActionSteps(format, flags) assembles an honest list from what an export
actually did (c2pa.created + c2pa.color_adjustments on CMYK/brand-palette +
c2pa.edited on print marks / experimental watermark + c2pa.converted on a
raster/video/PDF render - vector/text outputs add nothing). No `actions` →
byte-identical to before. verifyC2pa now surfaces each action's `description`.
(2) `ingredients` (C2paIngredient[] from prepareC2paIngredient /
prepareC2paIngredientFromStore, sourced from extractC2paStore) carry a placed
credentialed asset's manifests VERBATIM into the new store as a MULTI-manifest
store (ingredient manifests before the active one), plus a c2pa.ingredient.v3
assertion (activeManifest hashed-URI) and a c2pa.opened action that propagates
the ingredient's AI/ML digitalSourceType onto the NEW asset's own active
manifest (the opened action also carries parameters.ingredients, and the
c2pa.ingredient.v3 assertion its required validationResults) - so an AI or
camera origin is never laundered away (the AI flag fires from Lolly's signed
actions even if the ingredient manifests are stripped). Bridge (additive):
host.assets.credential?(id) returns a user upload's captured manifest store
(kept at ingest, manifest-only - no pixels/EXIF), and ExportOpts.ingredients
threads it runtime → export. Both the multi-action and multi-manifest outputs
validate as `Valid` in the reference c2patool (contentauth c2pa-rs) - see the
gated conformance test tests/c2pa-c2patool-conformance.test.ts - with only the
expected self-signed untrusted markers.


1.27.0 - richer, self-describing exports + a JPEG multi-manifest read fix.
(1) New summarizeInputs(model) returns a compact scalar-input digest (id →
short string: colours, sizes, toggles, short text; skips uploads, repeating
groups, long text, and profile-bound PII). The runtime derives it when C2PA
stamping is on and threads it via ExportOpts.c2paInputs; each shell records it
(plus the export date + output dimensions) under the tools.lolly.export
assertion, so an inspected asset shows "what it was made from / where / when /
how big". verifyC2pa now surfaces report.environment.inputs (the nested digest,
string→string only). Purely additive - no digest → byte-identical to before.
(2) extractC2paFromJpeg now reassembles the manifest store by APP11 box-instance
(En) + sequence (Z) instead of scanning every segment for the store UUID - an
assertion URL that plants "c2pa" in a continuation chunk no longer trips a false
"more than one manifest store" rejection (multi-manifest JPEGs, e.g. a design
composed from AI-generated ingredients, now verify like their PNG/PDF siblings).

1.28.0 - additive: OKLCH-native brand tokens. brand-derive.ts is the engine's
sRGB↔OKLCH authority (parseOklch/formatOklch/hexToOklch/oklchToHex - with
deterministic chroma-reduction gamut mapping - plus WCAG 2.1 contrastRatio)
and deriveBrandTokens(), which turns one brand colour into a complete layered
DTCG document (base ramps + brand-tinted spectrum + contrast-enforced
light/dark semantic slots) in exactly the shape createTokenSet consumes.
colorToHex now reads oklch()/lch() strings via that module, and the barrel
exports the brand-import container extractors (coerceTokensDoc /
assembleTokenSetFiles / extractPenpotProject / summarizeTokensDoc). Pure
engine modules; no bridge change.

1.29.0 - additive on host.text: TextToPathOpts.variations (HarfBuzz axis
settings, e.g. ['wght=700']) so a VARIABLE face outlines at the run's actual
weight; TextPathResult.notdef (missing-glyph count) so a caller can prefer
its <text> fallback over outlining tofu; and TextToPathOpts.fallbackFonts (an
ordered face chain, shaped segment-by-segment) for the disjoint unicode
subsets a webfont family ships as. All optional; older hosts keep working.

1.30.0 - additive on host.text: TextAPI.axisDefaults() returns a variable
font's default-instance axis values, so a caller that embeds the raw file
into a renderer with no variable-axis control (jsPDF) can tell whether it'll
render at the weight it asked for. Optional; absent on older hosts.

1.31.0 - provenance chains for DERIVED assets. (1) The runtime's export-time
ingredient sweep now also notes library/catalog-sourced asset inputs (source
'library', not just 'user'), so a credentialed CATALOG image placed into a
tool carries its chain - host.assets.credential(id) may serve those ids by
extracting the store from the asset's own bytes (semantics widened, signature
unchanged). (2) c2pa.ts exports C2paActionInput + DIGITAL_SOURCE_TYPE so a
shell can assemble an honest custom history (recolour / colour treatment /
crop / re-encode steps) for embedC2pa - used by the web catalog's download
paths, which now re-sign modified assets with the source credential preserved
as an ingredient instead of shipping unsigned bytes.

1.32.0 - per-swatch print locks, generalized from the primary-anchor-only
override. ColorSwatch gains `spot` (SpotColor: name/book/cmyk), read by
tokens.ts's toSwatch() from the same $extensions["com.suse.lolly"] object as
the existing `cmyk` lock - any colour token, not just the primary ramp's
anchor, can now be locked to an exact process CMYK or a named spot ink.
eps.ts's emitEps() takes an optional cmykPalette (quantised-RGB → CMYK map,
same key scheme as shells/web's buildCmykPaletteMap) so EPS CMYK export can
substitute measured/spot inks like the PDF path already does. print-marks.ts's
PaletteSwatch/BarCell gain `spotName` so the verification colour bar can
annotate a spot-locked cell with its ink name instead of raw CMYK numbers.

1.33.0 - additive: zzfxm.ts renders procedural music (ZzFXM songs, a few KB of
nested arrays) to raw stereo PCM - renderZzfxm(song) plus the vendored zzfxG
(ZzFX Micro synth) / zzfxM (ZzFXM renderer). Pure and DOM-free: the web shell
wraps the PCM in an AudioBuffer for the Neurospicy player (in a Worker) and for
video music beds (OfflineAudioContext); ingest/generator scripts audition
output in Node. One runtime path for hand-authored, MIDI→ZzFXM, MOD→ZzFXM, and
generated tracks - no per-format player, WASM, or soundfonts. No bridge change.

1.34.0 - additive: pdf-svg.ts serializes an interpreted PDF page (pdf-map.ts's
PdfNodes, pre-finalizeBoxes) to ONE standalone SVG document - the "PDF page as
an asset" sibling of the Layout Studio boxes path, sharing the same interpreter
so the two ingest surfaces agree. Raster XObjects arrive pre-decoded from the
shell as data: URIs (opts.images); group ids survive as <g data-group> so a
page SVG re-imported into Layout Studio regroups. Transparent background by
default (PDF "paper" is a viewer convention; .ai vector art shouldn't bake a
white plate). No bridge change.

1.35.0 - additive: deeper, honest capture/text provenance. (1) exportActionSteps
gains `capture` ({camera,microphone}) - a live camera frame or a mic/AV recording
swaps the created step's IPTC source type to the new CAPTURE_SOURCE_TYPE
(digitalCapture) with a "captured/recorded live" description - and `textAdded`
(+`textSample`), appending a c2pa.edited "Added text" step for text placed OVER an
opened asset. The runtime derives both from actual sensor use (onFrame /
stopRecording) and an ingredient being present, threading them via new ExportOpts
c2paCapture / c2paTextAdded. (2) summarizeInputs now includes `longtext` and stores
FULL text (bounded) so the exact rendered copy - a tamper-relevant signal - rides
in the tools.lolly.export digest. No bridge signature change.

1.36.0 - additive: midi.ts converts a Standard MIDI File to a ZzfxSong
(midiToZzfxm / parseMidi + midiToSong) - a DOM-free, bounds-hardened SMF parser +
note→pattern mapper. Feeds the same zzfxm.ts render path as authored/generated
songs, so a .mid uploaded in the web shell (or ingested via scripts/ingest-midi.ts,
which now shares this converter) becomes a tiny format:'zzfxm' asset that plays and
previews everywhere. No bridge change.

1.37.0 - additive: verifyC2pa() gains report.likelyMadeWithLolly - true when
every check passed EXCEPT the hard binding (assertion.dataHash/bmffHash
mismatch: the file's bytes, not the manifest, changed after signing) and the
claim still records a Lolly creation. The claim signature and every
hashed-URI-bound assertion - the actions and export-context digest a report
shows as edit history / "made from" - are still verified, so that content is
trustworthy even though the bytes can no longer be vouched for (a re-saved,
re-encoded, or re-uploaded Lolly export). Always false when madeWithLolly is
already true. No bridge change.

1.38.0 - additive: color-tools.ts, the perceptual metrics + ramp math the
chroma.js evaluation (plans/archive/chroma-eval.md) chose to PORT rather than adopt:
deltaEOk (OKLab distance), apcaContrast (APCA-1.0.98G Lc, advisory - WCAG
2.1 stays the enforced number), rampOklab (bezier through OKLab with
optional correctLightness bisection), classBreaks (equal/log/quantile bins),
and distinctColors (anchor-seeded greedy-maximin categorical palette -
chroma.js has no equivalent). All pure, OKLab-based, gamut-mapped via
brand-derive's oklchToHex. No bridge change.

1.39.0 - additive: gradient-token colour plumbing. (1) brand-derive.ts gains
mixOklch(a, b, t) - perceptual OKLCH interpolation (shortest-arc hue, an
achromatic endpoint adopts the other side's hue) for gradient previews and
midpoint stop seeding. (2) tokens.ts resolveAliases now also resolves
aliases nested inside a gradient-typed token's stops ($value[].color -
scoped composite resolution, cycle-safe, the caller's raw doc left
untouched), so a brand gradient whose stops reference palette swatches
({color.ramp.primary.5}) reaches the CLI and tools as concrete colours
instead of raw alias strings. No bridge change.

1.40.0 - additive on host: `color` (ColorAPI) - the color-tools primitives
behind short tool-facing names (deltaE/apca/contrast/ramp/breaks/distinct),
SYNCHRONOUS pure math. Shells attach the engine's makeColorApi() verbatim,
so the implementation can never drift between web/CLI/Tauri. Not gated by a
capabilities flag (progressive enhancement - tools feature-detect
host.color and keep a small fallback for older shells). First consumers:
chart-creator + d3 brand-driven series palettes (color.spectrum.* tokens
first, distinct() top-up, shipped palette fallback).

1.41.0 - additive: multi-language groundwork. (1) lang.ts is the shared
canonical language table (LANGS: en/es/de/fr/zh/ja/vi, LANG_META for
native/English names + <html lang> values, normalizeLang for informal
aliases like `cn`/`jp`) used by url-mode.ts, Profile, and tool-manifest i18n
sidecars alike. (2) url-mode.ts gains the reserved `lang` param - parsed with
alias normalization, serialized (omitted for the English default), never a
tool input. (3) Profile (packages/core/src/host-v1.ts) gains `lang?: string`,
a legal `bindToProfile: "lang"` target, riding the same profile record as
every other per-user preference. No bridge signature change; the engine
still emits zero user-facing English itself - all display text originates in
manifests/templates, which may now ship a per-tool i18n sidecar (see loader.ts).

1.42.0 - additive: 7 more LANGS entries - pt (Brazilian Portuguese, htmlLang
pt-BR), zh-hant (Traditional Chinese, htmlLang zh-Hant - distinct from zh's
Simplified/zh-Hans), cs (Czech), nl (Dutch), tl (Tagalog), sv (Swedish), ms
(Malay). New ALIASES: br/pt-br/pt_br→pt, tw/hk/zh-tw/zh-hk/zh-hant-tw/hant→
zh-hant, my→ms, fil→tl. Purely additive to the LANGS/LANG_META/ALIASES
tables - no signature change on url-mode.ts, Profile, or the loader's i18n
overlay, all of which already iterate LANGS generically.

1.43.0 - additive: baked assets + the shared compose guard (bake.ts). (1)
bakeAssetRef freezes a composed render (a renderUrl result whose bytes ride
in a data: URL, capped at MAX_BAKED_URL_CHARS) into a static asset: id
'baked/<base36 ms>', meta { baked, bakedAt, bakedFrom? } - provenance for
on-demand re-baking - with meta.toolUrl (the live-edit key) and any
blob:-valued meta removed. The runtime resolves an isBakedRef value AS-IS
(no bridge call, no compose-stack growth - a baked embed consumes no compose
depth and never live-re-renders); URL mode serializes its bakedFrom so a
share-link recipient degrades to a live re-render - top-level assets AND
block sub-fields alike (assetIdForUrl / blocksForUrl, exported so shell
serializers share the one degradation policy). DroppedAsset gains an
optional `reason` ('render-failed' / 'not-found' / 'baked-bytes-lost'). (2)
assertComposeStack / ComposeGuardError / MAX_COMPOSE_DEPTH move the per-shell
cycle/depth guards into the engine so every bridge shares one policy.
Forward-compat: an OLDER engine re-resolves a baked id via assets.get, which
fails ('baked/…' is in no catalog), so the slot drops gracefully. (3) One
more LANGS entry - ro (Romanian, htmlLang ro) - purely additive to the
LANGS/LANG_META tables, same shape as the 1.42.0 additions. No bridge
signature change.

1.44.0 - additive: ar (Arabic, htmlLang ar) - the first right-to-left
LANGS entry. LangMeta gains an optional `dir?: 'rtl'` field (absent ⇒ ltr);
consumers that stamp <html lang> from LANG_META must now stamp `dir` from
the same entry (web shell i18n.ts/index.html pre-paint, docs/build.ts).
New ALIASES: ar-sa/ar-eg/ar-ae → ar. Purely additive - no bridge signature
change; url-mode's `lang` param, Profile.lang, and the loader's sidecar
overlay all iterate LANGS generically.

1.45.0 - additive: vector + windowed page capture. (1) CaptureSpec gains
`crop` (0..0.9 trim insets, the TUI's url-capture semantics promoted onto
the bridge - applied by the HOST at capture time, so the returned ref's
width/height already reflect the trim) and `rangeTo` (extend the shot below
`scrollDepth` into a tall strip for scroll-pan videos; callers derive the
pan distance from the RESULT dims, so a host that ignores/clamps the field
degrades to a shorter or static pan, never an error). Hosts that predate
both fields ignore them via their deserializers - old shell + new tool
stays a plain viewport shot. (2) CaptureAPI gains optional `vector(spec)`:
print the page to a true vector document and return it as a self-contained
SVG AssetRef (type 'vector'), windowed identically to page(). Feature-
detected (like compose.renderUrl); the web stub and the extension bridge
simply don't grow it. (3) pdf-svg.ts gains windowPdfSvg (crop a pdfNodesToSvg
document to a sub-rect via viewBox - pure string surgery, no DOM), exported
for the shells that window a vector capture. (4) HOOK_BUDGET_MS is now
re-exported from the engine index so a shell that fulfils `capture` natively
can raise the beforeExport budget (the documented "shells with unusual
needs" escape hatch) without a deep runtime.ts import. No bridge signature
change; every addition is optional/ignorable.

1.46.0 - additive: LangMeta gains an optional `flags?: readonly string[]` (1–3
ISO 3166-1 alpha-2 country codes per language, most-representative first - en →
gb/us/au) plus a pure `flagEmoji(cc)` helper (country code → regional-indicator
emoji). Purely additive garnish for language pickers - the nativeName stays the
accessible label, older consumers ignore the field, and no bridge signature
changes. Every LANG_META entry is populated; the field is typed optional so a
future language without flags still validates.

1.47.0 - additive: hi (Hindi, htmlLang hi, Devanagari, ltr) - one more
LANGS/LANG_META entry, ordered before ar in the picker. New ALIASES:
hi-in → hi. Purely additive, same shape as the 1.43/1.44 language
additions - no bridge signature change; url-mode's `lang` param,
Profile.lang, and the loader's sidecar overlay all iterate LANGS
generically.

1.48.0 - additive: three LANGS/LANG_META entries - bn (Bengali, htmlLang bn,
Bengali script), ur (Urdu, htmlLang ur - the SECOND rtl language after ar;
consumers that stamp dir from LANG_META need no change, hand-mirrored maps
like the web shell's pre-paint script must add it), and id (Indonesian,
htmlLang id - distinct register from ms/Malay). New ALIASES: bn-bd/bn-in → bn,
ur-pk/ur-in → ur, and in/in-id/id-id → id (`in` is Indonesian's deprecated
ISO 639-1 code, still emitted by Android WebViews). Purely additive - no
bridge signature change.

1.49.0 - additive: LangMeta gains a required `speakers` field (approx. total
speakers in millions, picker-sort data - not a census) and lang.ts gains
sortedLangs(LangSort)/LangSort - the shared language-picker orderings used
by every language menu (web shell + /info site): 'speakers' desc = default,
az = nativeName A–Z. No bridge signature change.

1.50.0 - additive: design-map de-brands. mapFontFamily/mapWeight/nodeToBox/
finalizeBoxes accept optional DesignMapOptions ({ fonts: { defaultFamily,
monoFamily, monoMaxWeight }, seedColors: { boxBg, textFg, imageBg } }) so the
SHELL supplies the target tool's font vocabulary + addKinds seed colours from
the active brand pack; the engine's built-in defaults are the neutral
lolly-start values ('sans'/'mono', mono capped at 800). Box.font widens
'SUSE'|'SUSE Mono' → string. Existing callers compile unchanged (options are
optional); un-threaded callers now emit the neutral vocabulary instead of
SUSE's. The PPTX theme (pptx.ts themeXml) likewise drops the hardcoded brand
accents for lolly-start-spectrum neutrals (accent1-3 + hlink; theme-picker
data only - rendered shapes carry explicit colours). Brand hex values now
grep clean of engine/src; the frozen DTCG vendor key 'com.suse.lolly'
(tokens.ts TOKEN_EXT / brand-derive.ts VENDOR_EXT) deliberately stays - it
is a permanent serialization contract, renameable only via dual-read.

1.51.0 - additive: LANGS/LANG_META entry tr (Turkish, htmlLang tr, Latin
script, ltr - no RTL work; latin-ext font subset already kept). New ALIASES:
tr-tr/tr-cy → tr (regioned navigator.language tags). Purely additive, same
shape as the 1.47/1.48 language additions - no bridge signature change;
hand-mirrored maps (web shell pre-paint HTML_LANG) must add it.

1.52.0 - additive: LANGS/LANG_META entries uk (Ukrainian, Cyrillic script -
cyrillic font subset already kept) and pl (Polish - latin-ext already kept);
both ltr, no RTL work. New ALIASES: uk-ua/ua → uk, pl-pl → pl. Also fixes
applyManifestI18n: an option label whose manifest `value` is the empty
string (e.g. a "Default" choice) was untranslatable - the overlay-key
matchers required ≥1 char after "options." and silently skipped the key;
they now accept the empty value (mirrored in scripts/validate-catalog.ts).
No bridge signature change; hand-mirrored maps (web shell pre-paint
HTML_LANG) must add the two new languages.

1.53.0 - release-freeze hardening (plans/03-action-plan.md). (1) loadTool now
ENFORCES a manifest's `engineVersion` range: a tool whose range excludes the
running ENGINE_VERSION is REFUSED, not warned (P0-3) - the load-bearing floor
of the fast-catalog / slow-binary model. New dependency-free range check in
semver-range.ts (satisfiesRange); no `semver` dep added. (2) New
session-record.ts (sessionVersionStamp / migrateSessionRecord /
SESSION_FORMAT_VERSION): every saved-session record now carries formatVersion
+ engineVersion, and the state bridges read them through a migrate-or-warn
branch on load (P0-5). Both purely additive to the engine surface; no bridge
signature change. ENGINE_VERSION also moves to version.ts (re-exported here)
so the loader can read it without an index↔loader import cycle.

1.54.0 - additive: DISPLAY capture on host.recorder. (1) RecordOpts gains
`source: 'device' | 'screen'` (default 'device', so every existing caller is
byte-for-byte unchanged) + `systemAudio`, so a screen recording is the same
RecordSession a camera take is. (2) New RecorderAPI.still(StillOpts) → Blob:
one frame, source released immediately - a screenshot has no session to stop.
(3) isAvailable() accepts 'screen'. (4) New `screen` capability + render.capture
value 'screen' (both schema copies). The browser's own picker is the selection
UI - a page cannot enumerate, name, or pre-answer it - so the engine never
learns what a display source IS, only the bytes the user chose to hand over.

1.55.0 - additive: PPTX speaker notes. PptxSlide gains an OPTIONAL `notes`
string; buildPptxParts (pptx.ts) emits a p:notes part per noted slide plus one
shared notesMaster, and wires the slide→notesSlide rel, the notesMasterIdLst
and the content-type Overrides. Gated on the note being non-blank, so a deck
without notes is byte-for-byte unchanged. Three OOXML traps found against real
PowerPoint decks, not the spec prose: notesMasterIdLst must precede sldIdLst
(CT_Presentation is an xsd:sequence); a theme part is 1:1 with a master, so the
notes master needs its OWN theme2.xml (sharing theme1 is a known repair
trigger); and a notesSlide relates only to the notesMaster - the slide→notes
direction is the sole binding. The web shell's renderPptx reads each note from
a display:none [data-slide-notes] node, so tools opt in with pure tool data.

1.56.0 - additive: PPTX native rich elements (feeds the `presentation` tool; the
engine stays DOM-free and brand-free). Three additions to pptx.ts, all opt-in so a
deck that uses none is byte-for-byte unchanged: (1) rich text - PptxPara gains
bullet (round/number/custom-glyph), 0–8 indent `level`, line/space spacing, and
PptxRun gains `underline`; a bare {runs, align} still serializes to the old
`<a:pPr algn>`. (2) native tables - a new PptxTable shape emits an inline a:tbl in a
p:graphicFrame (header row, per-cell fill/border/align, colSpan/rowSpan merges via a
rectangular hMerge/vMerge grid) needing NO extra part/rel/content-type. (3) themed
master from VALUES - PptxBuildOpts.theme (hexes + font names the shell resolves from
brand tokens) overrides the neutral clrScheme/fontScheme in theme1.xml (+ notes
theme2.xml); the engine never reads tokens or a brand pack. OOXML order traps
respected: a:pPr children (lnSpc→spcBef→spcAft→bullet), a:tcPr fill AFTER the four
borders, p:xfrm prefix vs a:off/a:ext. Deferred (separate track, spec saved): native
c:chart - the `presentation` tool composes our chart tools (d3/org-chart/chart-
creator) into vector pictures instead.

1.57.0 - additive: NATIVE-vector PPTX for flat SVG art. (1) pptx.ts gains a `path`
shape (PptxPath) - arbitrary M/L/C subpaths lowered to a:custGeom / a:pathLst
(moveTo/lnTo/cubicBezTo/close) inside one a:path w=cx h=cy, solid fill + solid
stroke; all subpaths collapse into one path so holes cut out. (2) new svg-custgeom.ts
`svgToCustGeomPaths(svgText, targetW, targetH)` - a DOM-free scan that walks the tag
stream, tracks the group transform stack + inherited fill/stroke/stroke-width,
converts path/rect/circle/ellipse/line/polygon/polyline to `d`, and maps coords
through (group transforms) ∘ (viewBox → target EMU) into PptxPath[]; returns null
(→ raster fallback) on gradients/filters/masks/clip-paths/opacity/blend/image/text/
use/style/currentColor/unknown-named-colour/rotate-or-skew/unreadable-viewBox, so a
non-flat SVG never regresses. The web shell's export-pptx tries it first for an
<svg>/SVG <img>/SVG background and emits native shapes when it succeeds. Reuses
parseSvgPath + colorToHex; no bridge/host method added or changed.

1.58.0 - additive: pptx rebrand bridge. New optional host.pptx (PptxAPI):
inspect() reads an uploaded .pptx (slide count, theme, literal colours/fonts
with nearest-brand suggestions) and rebrand() surgically re-themes it
(pptx-patch) - shells unzip/rezip with fflate and inject DOMParser; engine
stays zip- and DOM-free. New suggestRebrandTheme in brand-map.ts maps brand
swatches onto the 12 clrScheme slots.

1.59.0 - additive: C2paReport.partsMadeWithLolly - an INTACT credential whose
active manifest isn't a (likely) Lolly creation but whose preserved provenance
chain records Lolly steps (a Lolly export later edited/re-signed by another
tool). Surfaced as the amber "Parts made with Lolly" pip/pill in /verify and
`~ Parts made with Lolly` in `lolly validate`. Also: file-metadata.ts reads
bare-XMP IPTC DigitalSourceType + Credit (JPEG/PNG/SVG + MP4/QuickTime uuid
box) into FileMetadata.ai - the declaration layer behind the AI banner and
the SynthID/Meta likelihood pips.

1.60.0 - additive: four contract pieces for the Wave-2 surface plays, all
optional/feature-detected. (1) host.color gains schemes(seedHex, kind?) -
the brand editor's pure harmony generator (brand-schemes.ts
generateSchemeAccents; kinds complement/adjacent-3/triad-3/tetrad-4/
free-2..4, default 'complement') attached to makeColorApi(), so a tool
(Palette Lab) generates scheme accents without shipping colour science;
SCHEME_KINDS stays the barrel export for shell picker UIs. (2) New optional
host.images (ImagesAPI) - CONTRACT ONLY this minor: decode (bytes|Blob →
oriented dims + sniffed mime), resize (maxEdge / fit-within, never
upscales), encode (convert to webp/jpeg/png) - the web bridge's existing
HEIC decode + bomb-guarded resize machinery to be exposed the host.pdf way;
DOM-free bytes-in/bytes-out, shells implement in a later pass. (3) host.text
gains optional fontUrl(family, {weight?, italic?}) - CONTRACT ONLY: resolve
an installed/registered family to a fetchable font file plus the
variable-font `variations` needed to hit the requested weight, so a
wordmark-style tool can drive toPath() from a family name. (4) The ZzFXM
composer moves into the engine: new zzfx-compose.ts (composeSong + the
PRESETS/SCALES bank, body verbatim from scripts/lib/zzfx-music.ts, which is
now a re-export shim) - pure and deterministic, renders via the existing
renderZzfxm, so shells can generate music beds/tracks at runtime. No v1
method changed. Plus a barrel-only addition: brand-treatments.ts
(derivePhotoTreatmentsDoc / deriveIconThemesDoc) - pure, deterministic
derivation of a brand's photo-treatments + icon-themes palette docs from its
token document (or resolved swatches) via the OKLCH machinery, consumed by
scripts/ingest-brand.ts and the lolly-start neutral set so blank/ingested
brands get real treatment/theme strips instead of inert ones.

1.61.0 - additive: HDR raster export. New engine module hdr.ts -
hdrBoostToPQ(rgba, opts) transforms an 8-bit sRGB canvas render into
Rec.2100-PQ code values in place, boosting pixels that match the active
brand's primary colours (passed in as `targets` - brand-agnostic, the engine
never derives them) toward peak luminance so they glow on HDR displays. The
boost is a hue-preserving luminance multiplier gated on OKLab lightness: mid-
and-above colours punch to peak (white hits it; a saturated mid primary isn't
far behind), rolling off below mid so dark primaries are calmed, not blown out
(dark areas stay dark and give the glow its contrast). Near-white is a default
target so white text glows. Barrel exports pqEncode + the HDR_PQ_CICP tuple.
color.ts gains pqBt2020IccProfile() - a generated ICC v4 BT.2020+PQ display
profile whose `cicp` tag (9,16,0,1) is the HDR signal colour-managed apps key
off (JPEG); the shared ICC layout was factored into buildIcc() and the sRGB
builder now rides it (byte-identical output). Pure/DOM-free; shells apply the
transform to canvas pixels and embed the profile / PNG cICP chunk at export.
No v1 method changed.

1.62.0 - additive: crop culling for the page-SVG path. pdf-svg.ts gains
cullPdfNodes(nodes, win) - drops the interpreted nodes that provably cannot
paint inside a crop rectangle - plus pdfNodeExtent(n) (the axis-aligned
page-space box containing every pixel a node can paint, or null when it can't
be bounded) and pdfNodeElementKind(n), the serializer's element dispatch
extracted so the two can never drift. Purpose: a cropped capture (the docs
screenshot pipeline, capture.vector(), any windowed page export) spends nearly
all of its bytes and seconds on a handful of enormous nodes - a re-sourced
canvas raster, a ShadingType-1 tile - so culling BEFORE the shell decodes
rasters, rasterises tiles and shapes text is where the win is; windowPdfSvg
stays an exact, unchanged viewBox rewrite at the end. Conservative and
fail-open by construction: a padded window (CULL_PAD_PT = 2pt), stroke-miter
and text-metric outsets, clip-bbox intersection (the only thing that bounds an
`sh` shading or a print-engine shadow plate, both of which cover the whole
page), and any node whose extent can't be established is KEPT and counted.
A degenerate window is a no-op. Also fixes a pre-existing wart the culler would
have made expensive: <defs> gradient/pattern entries are now emitted only for
ids that actually reached the output, so a node that yields no element no
longer ships its base64 tile. No v1 method changed.
  Four things pdfNodeExtent deliberately does NOT guess, each one a silent cull
  it would otherwise cause:
  • a `<text>` run's horizontal extent is reported as UNBOUNDED. pdf-map's `w` is
    a char-count estimate off the FIRST line only, and the final advance belongs
    to whichever font the renderer resolves - so a wrapped paragraph or any
    full-width script paints past it. The vertical band (fontSize-derived) still
    culls, and the docs path outlines text anyway, which is exact.
  • OUTLINED text is bounded by scanning its glyph path data per line - exact, no
    metrics at all.
  • a vector node is bounded by the `d` the serializer will actually WRITE (the
    sanitiser deletes rather than escapes, so `L1'0000` fuses into a different
    coordinate), unioned with the declared box, and fails open if the path
    vocabulary isn't scannable.
  • path/clip `d` scanning is gated by a WHITELIST of `M L C Q Z`: a blacklist of
    absolute command letters let the RELATIVE forms through, and a relative path
    read as absolute yields a bbox that need not contain the real path.
  Clip and soft-mask regions are widened by 1pt before intersecting, because a
  rasteriser paints up to a device pixel past a clip edge: a real page had a card
  backdrop whose left edge exactly equalled its clip's right edge, and the exact
  zero-width intersection dropped the antialiased column Chromium had drawn there
  (an empty extent overlaps no window, so CULL_PAD_PT cannot cover this case).
  Consumed by shells/web/src/views/pdf-import.ts (PdfPageSvgOpts.cull, applied
  before raster inlining / tile rasterisation / text outlining, reported back as
  PdfPageSvg.culled; elementCount stays PRE-cull so a bad crop can't be
  misdiagnosed as a blank print).

1.63.0 - additive: real /Luminosity soft-mask support, so a CSS box-shadow
finally RENDERS in a vector page capture instead of being dropped. New
pdf-smask.ts (pure: maskRegion / relativeLuminance / constantMask /
isShadowPlate / isAchromatic). PdfResources.extgstates.smask widens from a
boolean to a four-state field whose richest form is the new PdfSoftMaskDef - an
ExtGState /SMask pre-decoded by the SHELL into a content stream + resources,
i.e. the same shape as a form XObject (PDF 32000-1 section 11.6.5.2). The interpreter
re-runs that group through ITSELF, so a raster mask, a gradient mask and a
vector mask are one code path with no classifier, and the mask's own images
arrive as ordinary imageKeys the shell resolves through the existing `images`
record - no bytes cross the boundary. Nodes carry the result as the new shared
PdfNode._softMask, and pdf-svg emits a deduped <mask maskUnits="userSpaceOnUse"
style="color-interpolation:sRGB"> whose children go through the serializer's own
renderNode (so gradients, clips, rasters and even-odd rules work inside a mask
for free); /S /Alpha becomes mask-type="alpha". Four-rung ladder, monotone -
nothing renders worse than before at any rung: a real <mask>; a group that is
one flat rect over its bbox folds to a constant alpha with no <mask> at all; a
group that paints nothing is exactly a black mask, so the paint is dropped; and
a group that is refused (over budget, >64 nodes, mask-in-mask, /TR, /BC ≠ 0,
degenerate /BBox, or an undecodable group) falls back to the pre-existing
translucent+achromatic shadow-plate heuristic, now the last resort rather than
the answer. Fuzz-guarded for untrusted input: 96 distinct (mask, CTM)
evaluations per page, 64 nodes per group, an in-flight set that breaks a
self-referential group, a hard one-level nesting cap, and no throw path - every
refusal is an onWarn plus the previous behaviour. Also recovers CSS gradients
that carry alpha (Chromium encodes them as a one-cell tiling pattern whose body
installs the alpha ramp as a mask), which the tiling collapse used to discard
whole. No v1 method changed.

1.64.0 - additive: `host.geom`, the tool-facing face of the vector geometry kernel
(engine/src/geom/). New optional GeomAPI + `makeGeomApi()` in the new geom-api.ts,
attached verbatim by the web and CLI/TUI bridges like `color`, so the surface cannot
drift between shells. Path booleans over a whole selection (union / intersect /
difference / xor, folded left to right, fill rule selectable, plus `selfUnion` for the
canonical form of one path), `offset`, `stroke` (stroke-to-fill outline with SVG's own
cap/join/miter-limit defaults), `fromNodes` + `continuity` (authored-spline lowering
and the handle-drag constraint a pen tool runs on every drag), `encodeAuthored` /
`decodeAuthored` (the authored path's WIRE form - one field value, delimiter-safe by
construction so it survives the compact `blocks` URL format whose `,`/`~` separators
cannot be escaped; on the bridge because an editor writes it, a tool's `hooks.js` reads
it and neither may share code any other way. A value carries one path or SEVERAL,
`*`-separated, because an `AuthoredPath` holds exactly one `nodes` run and a great many
shapes are not one run - a boolean subtract punches a hole. `*` is unreserved under
`encodeURIComponent`, is neither blocks delimiter, and no other production in the grammar
can emit it, so a one-path value contains none and encodes to exactly the bytes the
singular form always did. `decodeAuthored` therefore answers a LIST, always, of at least
one path: handing back a bare path for the common case is how a caller ends up rendering
the first contour of a holed shape and dropping the hole. The node ceiling is counted
across the whole value, so N paths cannot multiply it, and a well-formed value past it
answers `'too-large'` rather than `'invalid-argument'`), `simplify`, measurement
(`bounds` / `area` / `contains` / `winding` / `nearest`, the last reporting the contour,
curve and `t` a pen tool splits at to insert a node), and the structured seam
(`parse` / `toPathData` / `limits`). Three contract decisions worth knowing:
  • The currency is an SVG path-data STRING both ways. Tools cannot import `Cubic` or
    `GeomPath`, and `d` is what already lives in their templates, state and URLs; the
    structured form (whole cubics, 8 numbers each) is offered by `parse`/`toPathData`,
    never required.
  • Failures are RETURNED, not thrown: every method answers `{ ok: true, … }` or
    `{ ok: false, code, message }`. A throw out of `onInit`/`onInput` is caught, logged
    and DISCARDED by the runtime, so a kernel `GeomLimitError` would have made a pen
    tool silently stop responding. The codes keep every distinction the kernel makes -
    `'limit'` (the answer exists, this engine declines to guess at it) is never
    conflated with `'invalid-path'` (malformed input), `'too-large'` (past the parse
    ceilings), `'invalid-argument'`, `'unsupported'` (a declared-but-unimplemented
    spline kind), or with `ok: true, d: ''`, which is a legitimately EMPTY region and
    an answer rather than a failure. There is no degraded fallback anywhere in the API:
    a tool is never handed a plausible-looking wrong path.
  • `fromNodes` takes the spline `kind` as a plain string that the ENGINE validates, so
    a spline family added in a later engine version reaches it through an unchanged
    bridge.
  Untrusted `d` strings (a paste, a URL param, an imported SVG) are the normal case, so
  parsing is bounded and validating rather than lenient: `svg-path.ts`'s tokenizer is
  built for the engine's own well-formed output and silently ignores garbage, so
  geom-api validates the grammar first in one linear, recursion-free forward pass -
  512k chars, 20k commands, 16k normalised curves, 64 operands, ±1e9 coordinates, a
  required leading moveto, a known command vocabulary, argument runs that are a whole
  number of groups, terminated number tokens, and a finiteness sweep over the
  normalised output - and rejects rather than guesses. Q/T raise to cubics by exact
  degree elevation and A decomposes by the spec's endpoint parameterisation (F.6.5,
  radii scaled per F.6.6) into one cubic per ≤90° sweep, both unchanged from the shared
  tokenizer. No v1 method changed.

1.65.0 - additive: canvas time-field mappings (timeline time model) on the blocks
input's `canvas` schema config - `startField`, `durField`, `clipInField`, `speedField`,
`enterField`, `exitField`, `enterMsField`, `exitMsField`, `muteField`, `laneField`.
These are pure schema/documentation additions (optional string properties naming
which box sub-fields hold timing data), phase 1 of the Fable timeline editing work
(`plans/52-fable-timeline-phase-1.md`) - inert until a shell mounts a timeline panel
that reads them; a manifest declaring none of them, or a template rendering an
untimed box, is byte-identical to before. No v1 method changed, no runtime behaviour
changed by this entry alone.

1.66.0 - additive: reserved `cuts` param for contact-sheet still exports. `cuts` joins
the RESERVED set in `src/url-mode.ts` (parsed into `UrlState.cuts`, serialisable via
`SerializeUrlOpts.cuts`), turning a still export (`png`/`jpg`/`webp`/`svg`/`pdf`) of a
timed composition into N frames sampled across the sequence - raster/SVG zipped, PDF as
one N-page document. Sampling is MIDPOINT (`t_i = duration × (i + 0.5) / N`, the exported
`cutTime` helper), never endpoint, so no frame lands on the blank card at t=0 or the
all-clips-ended state at t=duration. The value is clamped to 1…`CUTS_MAX` (64) and every
junk input (non-numeric, 0, negative, NaN, Infinity) degrades to 1 rather than throwing.
Default `cuts=1` is the playhead frame - byte-identical to a link without the param, so
every existing URL and every untimed tool is unaffected. Phase 2.5 of the Fable timeline
work (`plans/51-fable-timeline-editing.md` section 4.6). No v1 method changed.

1.67.0 - additive: the `zzfxm:<seed>[:<style>]` asset-id scheme (`src/zzfxm-ref.ts`,
exported as `ZZFXM_SCHEME`, `ZZFXM_ARCHETYPES`, `isZzfxmRef`, `parseZzfxmRef`,
`formatZzfxmRef`). A PROCEDURAL asset: the id names a song the shell synthesises from
the seeded composer in `src/zzfx-compose.ts` rather than a file the catalog stores, so
it resolves to ITSELF - a ref whose `url` IS the id - and the seed reaches the audio
mix through the one `resolveAssetRefs` path preview and export share. This is the
engine's vocabulary for the same reason `src/tool-url.ts` is: every shell that resolves
an asset id has to recognise the scheme, and they must not each invent the rule (the
web and CLI bridges both consume it). The parser is strict - leading zeros and seeds
past uint32 are refused rather than folded - so `parse(format(x))` is byte-stable and a
shared link's bed can never be silently repointed at a different tune. `composeSong`
now also pins `zzfxG`'s `randomness` parameter to 0 on every instrument it emits, so a
preset authored with a short array cannot re-enable per-render detuning and break seed
determinism. No v1 method changed; no runtime resolution behaviour changed (a shell
that does not recognise the scheme behaves exactly as before).

1.68.0 - additive: CSS-correct colour interpolation + the gradient spec. Two optional
`host.color` methods (`mix`, `gradientCss`) plus the engine primitives behind them
(`src/css-color.ts` `interpolateColor` / `gradientStops`, `src/gradient-spec.ts`).

`interpolateColor` implements CSS Color 4 section 12–13 properly: interpolation in a chosen
space (default OKLab), the four hue directions, missing-component carry-over, and -
the part that is easy to skip and visibly wrong when you do - PREMULTIPLIED alpha. A
per-channel lerp toward `transparent` drags the colour toward transparent's *black*, so
a red→transparent midpoint came out dark red at 50% instead of plain red at 50%. That
defect was live in the SVG/EMF conic-gradient fan (`conicFanEl` in the web shell's
export bridge), which lerped raw channels and therefore disagreed with what the browser
painted for the same element; it now routes through this one interpolator. Note the fan
still interpolates in **sRGB** deliberately - that is what a plain CSS gradient
specifies, so matching the browser means staying there.

`gradient-spec.ts` is the wire format for an authored gradient - one URL-safe string
(`lin_90_30ba78-0_efefef-100`), because a gradient has to survive the same round trip
every other input does (editor → block row → shared URL → CLI → identical render).
`gradientCss` bakes it: the stops are interpolated in the spec's space and emitted as
plain sRGB stops, with extra stops inserted ONLY where sRGB would visibly diverge
(adaptive subdivision against a ΔEOK tolerance, anchored on the segment endpoints so a
`longer` hue sweep can't oscillate under recursion). Baking rather than emitting
`linear-gradient(in oklab, …)` is what makes it portable: an SVG `<linearGradient>` and
a PDF axial shading have no interpolation-space knob, so a CSS-space gradient would
render one way on screen and another in every exported vector file. One value, three
renderers, and no new syntax for the export walkers to learn.

No v1 method changed. Both new methods are optional - a tool must feature-detect
(`host.color?.gradientCss`) since its declared `engineVersion` range may admit an older
engine.

1.69.0 - additive: display-gamut classification and OKLCH slice planes. New engine
module `src/gamut.ts` (pure, no DOM, no canvas) plus three optional `host.color`
methods: `gamut(color)` → `'srgb' | 'p3' | 'rec2020' | 'none'`, `maxChroma(l, h,
limit?)`, and `slice(opts)` → RGBA bytes for one 2D plane through OKLCH space.

The engine already mapped out-of-gamut colours back into sRGB (`gamutMapOklch`,
CSS Color 4 section 14.2), which answers "what will this become?". This answers the two
questions a brand designer actually asks next: *how far out is it*, and *would a
wider display carry it?* - "outside sRGB but fine on P3" is a different decision
from "no display can show this". The P3 and Rec.2020 tests are pre-composed 3×3
matrices from linear sRGB (shared D65 white, so no chromatic adaptation), reusing
brand-derive's Oklab core rather than carrying a second set of matrices.

`maxChroma` is the honest, hue-dependent ceiling - at L 0.7, sRGB gives yellow-green
~0.22 and cyan ~0.12, and P3 widens the reds/greens by >20% while barely moving the
blues. That per-hue asymmetry is why a fixed chroma cap makes lopsided ramps, and why
the charts are worth drawing at all.

`slice` exists as a bridge primitive, rather than each surface painting its own, so the
brand studio's gamut charts and the Colour Lab utility tool cannot drift about where
sRGB ends. It returns 8-bit sRGB, so pixels past sRGB are painted GAMUT-MAPPED - the
caller draws the real boundary from `maxChroma`/`sliceGamutEdge` on top, because the
boundary line is the information and the fill out there is an approximation.

No v1 method changed. All three are optional - a tool must feature-detect
(`host.color?.slice`) since its declared `engineVersion` range may admit an older engine.

1.70.0 - additive: ICC profiles as gamuts. A new hardened reader (`src/icc.ts`) plus
`src/gamut-source.ts`, which factors the membership question out of `src/gamut.ts`, and
four optional `host.color` methods: `iccProfile(bytes, intent?)`, `inProfileGamut`,
`profileMaxChroma` and `inkCoverage`.

**This reverses the engine's earlier "no ICC transforms" position, deliberately.** Until
now `src/color.ts` only ever WROTE profiles - it generates sRGB and Rec.2100-PQ bytes for
an export to carry - and `rgbToCmyk` is a naïve GCR-free separation with the press
condition declared in an OutputIntent rather than applied (see `src/pdfx.ts`: a CMYK
intent is registry-name only, "X-4 ready" not conformant - no longer the whole story
as of 1.74, which lets a caller supply profile bytes). The reasoning was that
applying a profile means shipping a colour engine, and the engine is meant to stay
dependency-free and small. That reasoning held for *export*, where declaring the space
the pixels were made in is the honest thing to do and converting into someone else's
press is not our call. It does not hold for the question a brand designer asks before
sending a palette to a printer: **will this colour print?** Nothing in the engine could
answer it. `gamut()` reports the three DISPLAY gamuts, and a press is none of them - a
swatch can sit comfortably inside sRGB and still be unreachable in CMYK, and the naïve
separation will cheerfully hand back four numbers that say nothing about whether the ink
exists. Answering it needs a real profile evaluated, so the reader is in.

What made it affordable is that it is a *reader*, not a colour engine: `mft1`/`mft2`/
`mAB `/`mBA ` all reduce to one ordered stage pipeline (curves / matrix / CLUT) with a
single evaluator, plus matrix/TRC and `kTRC` for the profiles that have no LUT at all.
No dependency, no shipped profile bytes - the profile is the user's own file, the one
their print shop sent them.

`gamut-source.ts` is the seam that keeps this from being a second colour system.
`gamut.ts` only ever asked one thing of a gamut ("is this OKLCH colour reproducible?")
and built the chroma ceiling, the slice fills, the boundary curves and the 3D solid on
top of that single predicate. So a gamut is now a predicate plus an identity
(`GamutSource`), the three display gamuts are sources over the SAME pre-composed
matrices they always used, and `iccGamutSource(profile, intent)` is a fourth kind that
drops into every one of those functions unchanged - `inGamut`, `maxChroma`, `oklchSlice`,
`sliceGamutEdge`, `sliceGamutRegion`, `gamutSolid`. Cross-checked end to end: the chroma
ceiling measured through macOS's own sRGB/P3/Rec.2020 profiles lands within 0.02 of the
matrix path at the same lightness, and the CMYK numbers match littleCMS on the same file
to the digit.

Two honest limits, both documented at their constant. Membership is a round-trip test
against `ICC_GAMUT_DELTA_E` (3.0 ΔE*ab), which is soft-proofing rather than colorimetry,
and it is conservative by more than a rounding: measured against Apple's Generic CMYK
Profile's own forward table it accepts ~65% of the device values the profile can produce,
refusing a flat 20% yellow tint and most of the yellow lobe above L* 90 as well as the
heavy-ink shadows (the full measurement is at `ICC_GAMUT_DELTA_E`). Read what it draws as
a conservative proof, never as a gamut boundary. And a profile-backed `contains` is ~14× the cost of a matrix
one, so a 320×200 `oklchSlice` against a press profile is ~85ms - render it on a profile
change, not under a drag.

`inkCoverage` is the one question a matrix cannot answer and a printer must. Its unit is
channels (1.0 = one ink at full, so process CMYK reaches 4.0 - the trade's 400% TAC),
deliberately not normalised to 0–1: a pressroom limit is written as 300% or 340% of that
total, and dividing by the channel count would discard the only figure a printer would
recognise. RGB sources return null rather than a made-up zero.

No v1 method changed. All four are optional - a tool must feature-detect
(`host.color?.iccProfile`) since its declared `engineVersion` range may admit an older
engine. The handle a tool receives is inert data; the profile's tables never cross the
bridge, and a handle the host did not issue gets the no-answer result (null / false / 0)
rather than an answer computed against some other profile. `usable` is the gate to check
first, and it means "this profile can answer a membership question under this intent" -
which needs the REVERSE transform, not merely a tag for the intent (`iccGamutIntent`), so
the abstract profiles that carry A2B0 alone report false instead of an empty gamut behind
a valid label.

Pure additions since, no version bump (the `HostV1` contract is untouched, so there is
no minor to name): `fastRgbContains` in `src/gamut-source.ts` - a built-in gamut's
membership test with the name comparison and the domain guard hoisted out of the loop,
for the per-pixel callers - and `src/gamut-tier.ts` (`gamutTier`, `gamutTierProbe`,
`BEYOND_TIER`, `GAMUT_TIER_LADDER`), which answers "which ring OUT of the active gamut"
so the picker's broken tracks and the Colour Lab sliders paint the unreachable stretches
as concentric washes from one classifier instead of two. A tier is always a `contains`
answer, never an index into an ordering: Display-P3 is not inside Rec.2020.

1.71.0 - additive: `host.audio`, audio analysis. Decoded sound in, a per-frame
reactivity track out - RMS, a bass/mid/treble split at butterchurn's own crossover
frequencies, a log-spaced magnitude spectrum, spectral centroid, onset flux, a
tempo, beat times, and optionally raw time-domain windows.

It exists because the only audio a tool could previously reason about was LIVE:
`recorder.meter` reports the microphone one sample at a time. Anything drawing a
finished clip - an audiogram, a music video, a spectrum - has to know frame 200's
bass while it is still drawing frame 1, so it needs the whole clip analysed up
front. Lacking that, the audiogram tool decoded audio itself off `window.
OfflineAudioContext`, reduced the entire track to a handful of static peak buckets,
and faked reactivity with a Gaussian bump travelling under a playhead. That is why
it never ran headlessly and why nothing about it was testable.

DOM-free contract like `images`: a URL, an AssetRef or raw encoded bytes in, plain
typed arrays out. The shell owns the DECODER (the web shell's `decodeAudioData`, the
CLI's WAV reader plus `renderZzfxm`); the MATHS is the engine's `analysePcm`, which
shells attach rather than reimplement - so the browser and the CLI read the same
numbers off the same clip. `fftInPlace` (iterative radix-2, 30 lines, no dependency)
is exported alongside it and pinned against an analytically-known spectrum.

Three decisions in the result shape, each load-bearing:

  • **Struct-of-arrays.** A minute at 60fps is 3,600 frames. As objects that is
    3,600 allocations for a draw loop to chase; as `AudioFrames` it is a few flat
    Float32Arrays, with `magnitude` and the `wave*` arrays as `count` consecutive
    rows.
  • **`bass`/`mid`/`treb` share ONE normalisation scale.** Normalised independently
    a bass-only clip divides its own near-silent treble by itself and reports treble
    pinned at 1.0 - a full-height treble bar for an 80Hz sine. The split is a
    balance, so the loudest band reads 1 and the others read their share of it.
    `peak` alone stays absolute, so a tool can still see that a source clipped.
  • **`bpm` is `null` when there is no rhythm to find**, and that is the common
    answer for speech, ambience and pads. The estimator autocorrelates the onset
    flux over 60–180 BPM and refuses below a share of the track's own variance,
    because a visual built on a wrong beat grid looks far worse than one built on
    none. Beats are then anchored on the strongest onset and stepped outward -
    walking fixed windows from frame 0 instead drops any window that happens to
    fall between two hits, which prints double-length gaps into a metronome-steady
    click train.

Raw `wave`/`waveL`/`waveR` windows are opt-in (`opts.samples`) because they dwarf
everything else - 2,048 bytes × 3 channels × every frame - and only a sample-domain
visualiser needs them. 2048 is butterchurn's `fftSize`, and the bytes are already in
its 0..255-centred-on-128 form, so a MilkDrop preset can be driven frame-exactly off
a decoded file through `render({ audioLevels })` instead of a live AnalyserNode. That
is what makes a reactive WebGL visual DETERMINISTICALLY exportable rather than
something you can only screen-record in real time.

Optional/additive and not capability-gated: a tool feature-detects `host.audio` and
falls back to a static waveform. No v1 method changed.

1.72.0 - additive: `host.viz` - the MilkDrop visualizer as something a TOOL can use,
not just the app's own audio dock.

Two questions a tool genuinely cannot answer for itself, and nothing else:
`isAvailable()` (WebGL2, synchronous, so a hook can branch on it before deciding what
to analyse) and `presets()` (id, name, AUTHOR, calm). Deliberately not a mounting API:
a tool is data, it has no element to hand over and no business holding a GL context.
It renders a `[data-lolly-viz]` placeholder carrying its parameters and the shell
enhances it after paint, the same contract `[data-lottie-src]` and `video[data-video-key]`
already use - which is also what lets the canvas, its context and its loaded preset
survive the innerHTML rebuild every keystroke causes. Remounting per paint would burn
a WebGL2 context each time, and browsers drop the oldest past ~16: the tool would go
black a dozen edits in with nothing logged.

`author` is in the contract because the artist presets are the point. Twenty years of
MilkDrop craft ships alongside our own eval-free ones, and a tool showing one is
expected to say whose it is - on the exported card, not in the UI around it.
Attribution is only emitted for a preset the shell CONFIRMS it has, since a pack that
isn't staged falls back to a brand-native preset and a credit line naming an artist
whose work is not on screen is worse than none.

The reason this lands as a contract rather than a shell feature is 1.71's opt-in
`samples`: MilkDrop's renderer takes injected time-domain bytes (`render({ audioLevels })`)
and only reads its own AnalyserNode when given none. So the visual becomes a function
of (preset, palette, frame index) instead of of what the speakers are doing, and a
video export matches the audio track rather than the render machine's frame rate.
Three traps paid for in black canvases: the injected window must be EXACTLY
butterchurn's `fftSize` of 1024 (`numSamps * 2`, not the 2048 the 1.71 note claims) -
longer throws RangeError inside the renderer, shorter silently leaves the previous
frame's tail behind; the frame `elapsedTime` must be a constant 1/fps, because the
preset clock advances by 1/fps and damps its estimate toward what it is told, so real
deltas make the same frame index render differently on a busy machine; and the WebGL2
context has to be acquired with `preserveDrawingBuffer` BEFORE the visualizer is
constructed, since a second `getContext` returns the first context and ignores the new
attributes - without it `toDataURL` (how dom-to-image snapshots a canvas) reads a
buffer the compositor already cleared and every exported frame is blank.

MilkDrop is a feedback simulation, so a frame rendered cold is a near-empty field -
the black frame people report as a broken visualizer. Every export therefore pins its
sequence at t=0: the preset is re-loaded, the feedback buffers and the renderer's own
clock are cleared, and ~1.6s of real audio is replayed before the frame is read; after
that it is one render per exported frame. butterchurn is also genuinely random in its
hot path (`rand()`, mesh jitter, `rand_preset`), so a driven frame runs with Math.random
seeded from the frame index, restored immediately after. Measured on an M4 in Chromium:
our own presets reproduce to within a mean absolute difference of ~1/255 per channel
across separate mounts of the same clip; the artist presets, whose equation state
butterchurn keeps on the preset object itself, get much closer than the naive path but
are not bit-exact. Audio-locked, not wall-clock-locked, is the guarantee.

Progressive enhancement, not a capability: no `host.viz`, no WebGL2 or no DOM at all
and the tool draws its ordinary canvas style - the audiogram falls back to `bars` and
still renders headlessly. No v1 method changed.

1.73.0 - additive: `'profile'` joins the `AssetRef['type']` union (and both copies
of `asset.schema.json`) - an ICC colour profile the USER supplied, stored as an
ordinary user asset at `user/profiles/<digest>` where `<digest>` is the same
16-hex SHA-256 prefix `icc.ts` puts in a `GamutSource.id`. That content-addressed
id is the point: re-adding the same file overwrites rather than duplicating, and a
shared `?limit=icc:<digest>:<intent>` link finds a locally stored profile by
construction. No new bridge method - the profile rides the user-asset rail that
already carries fonts and tokens, so the storage meter, data export, backup
restore and clear-all all cover it with no wiring.

A profile has no visual form: it is a gamut to compare against, not something to
place. Surfaces that tile images filter it out exactly as they already filter
`font` and `tokens`. No v1 method changed.

Also additive in this minor: `ExportOpts.audio.start`, the music bed's in-point in
seconds. A tool whose visuals begin partway through a clip (the audiogram's "Start
at") could already analyse from there, but the exported video's sound still started
at 0:00 - picture and audio disagreed. A looping bed now repeats the [start, end)
region rather than the whole track: `loopStart` defaults to 0, so a wrap would
otherwise replay the head the visuals deliberately skipped. Out of range degrades to
0 with a logged warning rather than exporting silence. Absent, it is 0 and nothing
about an existing export changes.

1.74.0 - additive: a PDF/X-4 output intent can carry an embedded
DestOutputProfile for a CMYK press condition. `pdfxOutputIntentSpec` gained
`iccBytes` / `components` / `identifier` / `registry` options - the engine never
reads a profile store, so a caller that HAS the bytes (the web shell, from a
profile the user loaded on their own device) supplies them, and a caller that has
none (the CLI) passes nothing and gets exactly the previous registry-name intent.
`registry: null` omits RegistryName, which is what the standard's `Custom`
identifier requires: a profile that proves no registered characterization is
declared under its own name rather than borrowing one.

Two new pure rules, here rather than in a shell because what X-4 requires is the
engine's business: `pdfxProfileEligibility(facts, 'CMYK' | 'RGB')` (device class
`prtr`, the intent's own colour space, /N ∈ {1,3,4}, ICC 2.x–4.2) and
`iccCharacterization(bytes)` - the `FILE_DESCRIPTOR` line of an ICC's `targ` tag,
i.e. the characterization data set the profile SAYS it was built from. That is
testimony, not measurement; it pairs a profile with a condition, it does not prove
the numbers. No v1 bridge method changed.

1.75.0 - additive: PDF text reconstruction. `extractPageText(nodes, {width,
height})` turns the positioned glyph runs `interpretPdfPage` produces into
reading-ordered prose (lines, columns, paragraphs, headings, list items) with a
`markdown` and a plain `text` rendering, and `joinPageText(pages)` joins them
into a document. No OCR and no second parse: a born-digital PDF already contains
its glyphs and their positions, so this is reassembly, not recognition. A page
that is a scanned image reports `scanned: true` with no text, so a caller can
say "this needs OCR" rather than "this page is blank".

Column detection is deliberately biased toward ONE column - reading a single
column as two destroys prose, whereas reading two as one merely interleaves it -
and a table is separated from a real multi-column layout by requiring each column
to be wider than the gutter beside it.

Also a decoding FIX in `pdf-map.ts`, which changes existing output: a simple font
with no /ToUnicode used to fall back to byte→code-point (Latin-1), so WinAnsi
(CP1252) bytes 0x80-0x9F decoded to invisible C1 control characters. That range
is exactly where English publishing keeps its punctuation, so bullets, en/em
dashes, ellipses and smart quotes were silently lost - from extracted text AND
from the Layout Studio / design-import path. They now decode correctly. No v1
bridge method changed.

1.76.0 - additive: failed-redaction detection. `findHiddenText(nodes)` reports
text that an OPAQUE shape is painted over - words present in the file that the
page does not show. `findHiddenTextInPages(pages)` tags findings by page and
`describeHiddenText(findings)` summarises them.

The check rests entirely on PAINT ORDER, which is what separates a redaction from
a highlight: a filled box painted BEFORE text is a background, the same box
painted AFTER it is a cover. `interpretPdfPage` returns nodes in the order the
content stream painted them and never sorts them; tests/pdf-redaction.test.ts
pins that invariant deliberately, because a sort added upstream would silently
invert every result rather than fail.

Coverage is the UNION of the overlapping shapes, not the largest one and not
their sum - a line struck out in several pieces is covered by no single bar, and
summing would double-count wherever bars overlap. Translucent shapes (<90%
opacity) and soft-masked shapes are refused: neither can be vouched for as
actually concealing. Colour is deliberately NOT a criterion - a white box over
black text hides it exactly as well as a black one, and a colour test would miss
the quieter version of the same mistake.

The finding claims only "present but not visible", never intent; the cause could
be a botched redaction or ordinary sloppy layering, and callers should keep that
wording. No v1 bridge method changed.

## 1.77.0 - a brand colour's faces, and the sRGB one wins at export

`color-faces.ts`: one canonical value per brand colour plus per-target overrides,
keyed by target id (a CSS space name, or `icc:<digest>:<intent>`). The
generalisation of the shipped `cmyk`/`spot` print lock to every space and press -
`readFaces`, `writeFace`, `colorFaces`, `faceDrift`, `canonicalValue`.

`ColorSwatch` gains optional `faces` (additive; v1 keeps working), and its `value`
now returns an **authored sRGB face** in preference to the automatic bake. That is
one line in `toSwatch` rather than a change per export path, because every
consumer of a brand colour funnels through that field - and it is what stops an
override being decoration. The reason the narrow face must win: CSS Color 4
section 14.2's map picks the nearest reproducible colour by ΔE, while a brand will often
prefer a DIFFERENT sRGB green, one that reads as the same brand colour to a human
even though it is not the closest by measurement.

Only sRGB is substituted into `value`. A wider face cannot go into a hex-typed
field without being baked itself, which would discard exactly what it was authored
to carry, so those ride in `faces` untouched.

Two things a reader should not assume. An override keyed to a profile that is not
currently mounted is KEPT, not pruned - dropping it because a profile was
unplugged is data loss, and the failure would be silent. And a PRESS face is not
yet consulted by the CMYK export paths: those target a `CMYK_CONDITIONS` name
while a face is keyed by profile identity, and those are different id spaces.
Bridging them is where the `cmyk` lock migrates onto this model.

Also `gamut.ts`'s `encodeOklch` (one colour encoded for a canvas colour space, on
the same ceiling grid `oklchSlice` paints from, so a filled vector shape and a
painted pixel cannot disagree), `gamut-solid.ts`'s `projectSolidPoints` (a batch
projector - the single-point form rebuilds the camera per call, which scans every
quad) and `SolidQuad.oklch` (the patch colour before its sRGB bake, so a
wide-gamut canvas can paint the real thing), plus `image-cloud.ts`:
`imageColorCloud` turns decoded RGBA into an OKLCH point cloud with gamut
coverage, clipping and dominant-hue statistics. Its gamut classification carries a
LINEAR-CUBE tolerance, not a chroma one: an sRGB colour round-tripped through an
8-bit Display-P3 encoding lands ~0.3% outside the unit cube, which near the sRGB
cusp reads as 0.048 chroma and made 5.2% of the sRGB cube misclassify as
wide-gamut. `gamut-source.ts` gains `linearP3ToLinearSrgb`, the exact inverse of
its forward twin (pinned by a round-trip test, including outside the cube).

No v1 bridge method changed.

1.77.0 - additive: TAGGED reading order, plus two content-stream parser fixes it
depended on.

`extractPageText(nodes, { tagged })` takes a page's `/StructTreeRoot` elements in
document order (`TaggedElement[]`, flattened by the shell, which owns the PDF
object walk) and assembles blocks from the structure instead of from geometry.
Geometry still joins runs into lines INSIDE an element - within one paragraph,
position genuinely does say what follows what - but everything geometry cannot
know is taken from the document: which paragraph comes next, where a block ends,
and what is a heading. `PdfNode.mcid` carries the marked-content id, and
`PageText.order` is now `'geometric' | 'tagged'` with `untagged` counting runs
the tree did not claim.

Structure types OUTRANK the font-size heuristic: a `/P` set in 24pt is a
paragraph the author set large, and `/H1`…`/H6` are headings however they are
set. A tree covering less than 60% of the page's characters is refused outright
and geometry runs instead, because following a token structure tree would hand
back a confident-looking fragment of the page.

This is a separate assembly path, not a sort applied afterwards: `toLines` and
`blocksFromColumn` both re-sort by baseline, so a reading rank attached upstream
would simply be discarded, and block BOUNDARIES are geometric there too.

Two REAL BUGS fixed in pdf-map.ts's tokenizer on the way, both of which changed
existing behaviour:

  • An inline `<<…>>` operand was reported as `{t:'op'}`, so it fell through the
    operator switch to `default`, which calls reset() and wiped the pending
    `/OC /Name`. Any BDC carrying a property dictionary therefore LOST its
    optional-content layer name - `/OC /MC0 BDC` grouped correctly while
    `/OC /MC0 <</MCID 0>> BDC` did not. That affected Illustrator layer grouping
    in the design-import path, not only this feature.
  • The dictionary scanner counted `<<`/`>>` with no string awareness, so a `>>`
    inside a literal (`/ActualText (a >> b)`) closed the dictionary early and the
    remainder was mis-tokenized as operators. `/ActualText` is exactly what a
    tagged PDF writes there, so tagged files could actively corrupt parsing.

No v1 bridge method changed.

## 1.78.0 - the table input, and pages that make themselves

Additive: batch creation as a first-class engine concern.

  • `table` input type - a user-defined grid ({ columns, rows }, all strings)
    where the column headings AND the rows are user DATA, unlike `blocks`
    (manifest-declared fields). `normalizeTableValue` keeps every grid
    rectangular on the way into the model. In URL mode a table is always ONE
    compact param (header segment + one tilde segment per row, cells
    percent-escaped - encodeTableCompact/decodeTableCompact, JSON accepted on
    parse). New module `table-text.ts` carries the text ⇄ table round-trip
    (TSV / Markdown pipe / RFC 4180 CSV parse + TSV/Markdown/HTML serialise)
    shared by the web sidebar's spreadsheet paste and the CLI's
    `--<inputId>-data=file` import.
  • `render.paginate: { source: '<tableInputId>' }` - engine-driven pagination:
    the runtime hydrates the template once per row, each wrapped in its own
    `[data-pdf-page]` box, with a per-page `page` context object
    (index/number/count, `first`, `cells`, `fields`). Tools author ONE page and
    never manage pagination; the existing paged canvas/PDF/pptx paths see N
    pages. Reference tool: community/battlecards (hook-free).

No v1 bridge method changed.

## 1.79.0 - inspect tells you when a deck is flattened

Additive: `PptxInspectResult.content` - a node-kind tally across the slides
(`pictures` / `texts` / `shapes` / `tables` / `unknown`).

  • The signal a rebrand tool needs to distinguish a rebrandable deck from a
    flattened one. Slides that are nothing but pictures - a PDF or a set of
    exported images dropped onto blank slides - carry no literal colour and no
    typeface the patcher can reach; the theme swap still rewrites the theme
    part, but nothing on the slides references it, so the output is visibly
    identical to the input. `community/rebrand-deck` now says so up front
    instead of handing back a byte-shuffled copy.
  • Optional on the contract, so an older shell that omits it is still valid and
    a tool must feature-detect it.

No v1 bridge method changed.

## 1.80.0 - markdown cells: links, images, and a bottom filmstrip

Additive: the `{{markdown}}` template helper gains **links and images** -
`[label](url)` → `<a href>`, `![alt](url)` → `<img class="md-image">` - on top of
the bold/italic/strikethrough, `#`…`######` headings and bullet/numbered lists it
already rendered.

  • Both URLs are allowlisted. Links take http/https/mailto/tel, images add
    data:/blob: (a pasted or host-resolved asset URL is usually one of those);
    anything else - `javascript:`, `vbscript:`, `file:` - is dropped and the
    label/alt renders as plain text. The probe undoes the `&`-escape and strips
    control characters first, so `java\tscript:` can't smuggle a scheme past it.
  • The escape-first order is unchanged and is the whole security model: author
    text is HTML-escaped before any tag is introduced, so no cell, label or alt
    can emit a live element. URLs are parked in placeholders across the emphasis
    pass, so an asterisk or `~~` in a query string can't be rewritten into a tag
    mid-attribute; quotes in a URL or alt are entity-encoded.
  • Manifest `render.filmstrip: "left" | "bottom"` (default `"left"`) - which
    edge a `paged` tool's slide-sorter rail runs along. `"bottom"` is the
    deck-strip shape, for tools whose pages are wide and few (cards, slides),
    where a left rail eats the width the page needs.

Reference tool: community/battlecards 1.1.0 (markdown cells + bottom filmstrip).
Existing `{{markdown}}` callers are unaffected unless their copy already contains
`[…](…)`, which now renders as the link it reads as.

No v1 bridge method changed.

## 1.82.0 - paginate context: cell addresses and by-name column lookup

Additive: two extensions to the `render.paginate` page context, both in service
of on-canvas table editing (a shell affordance - the engine only supplies the
addressing a template needs to opt in).

  • `page.cells` / `page.fields` entries gain `col` - the cell's ORIGINAL column
    index. A template that renders only some columns (or reorders them) can still
    address each cell against the source table, e.g. a `data-cell="{{page.index}}:
    {{col}}"` marker the web shell's canvas cell editor binds to.
  • `page.byColumn` - trimmed, lower-cased column name → the row's cell value,
    for by-name lookup with the built-in `lookup` helper:
    `{{lookup page.byColumn "icon"}}`. First matching column wins. The map is
    null-prototype so a user column named "constructor"/"__proto__" can't shadow
    an inherited key (see the enum-whitelist rule in the security notes).

No bridge method changes; templates that ignore the new fields render unchanged.

## 1.81.0 - a tool can carry its own walkthrough

Additive: manifest `guide` - a short, translatable "you have a render, now what?"
walkthrough, declared as tool data like everything else about a tool.

  • Shape: `{ title?, tracks: [{ id, label, steps: [string], note? }] }`. One
    track per route the user might take (on a computer vs on a phone); a single
    track is a plain step list, several render as tabs. Steps are plain text with
    `**bold**` as the only markup, for naming the control a step points at.
  • For the last mile a canvas cannot teach: an email signature is finished the
    moment it is pasted into Gmail's settings, and nothing on the canvas says so.
    A handful of steps, not documentation - link to the docs from a step when the
    long version is what's wanted.
  • Translatable through the tool's existing `i18n/<lang>.json` sidecar:
    `guide.title`, `guide.tracks.<id>.label` / `.note` / `.steps.<index>`, applied
    by `applyManifestI18n` alongside every other user-facing manifest string. A
    step index past the end of the track is ignored (a translator cannot add
    steps the manifest does not have) and `scripts/validate-catalog.ts` reports
    it as an authoring error rather than letting it silently vanish.
  • Purely declarative - the engine only carries and translates it. Rendering is
    the shell's: the web shell shows a help button beside the tool title and
    opens the dialog once per device on a first visit
    (`shells/web/src/components/tool-guide.ts`). A shell that ignores `guide`
    behaves exactly as before, and a tool without one is untouched.

Reference tool: brands/suse/tools/email-signature 1.7.0 (copy as HTML → Gmail
signature settings, with a phone track).

No v1 bridge method changed.

## 1.83.0 - design import: per-frame scenes

Additive: `figmaNodesToScenes` (+ the `DesignFrameScene` type) in design-map -
the per-frame counterpart to `figmaNodesToNodes`. Instead of merging the first
page into one node list, every top-level frame/section on every real page comes
back as its own `{ name, width, height, nodes }` scene, nodes shifted to the
frame's origin and sized to the frame's crop (overflowing content stays put and
crops at render, matching Figma). Loose top-level shapes collect into one extra
scene per page. Node production is identical to the single-page walk, so media
placeholders (`_imageHash`, `_vectorPath`) resolve through the same shell code.

In service of the sequence editor's scene-mode import (web shell): a dropped
Figma/Penpot/PDF file's frames become timed clips on the timeline
(`canvas.import.mode: 'scenes'` - see free-canvas importAsScenes and
design-import parseDesignScenes; the Penpot binfile board split is a shell walk
over per-shape JSON, so it needed no engine change).

No v1 bridge method changed.

## 1.84.0 - scene import plays decks in reading order

Additive: `readingOrder` in design-map - order frames the way a person reads a
storyboard (rows top-to-bottom, then left-to-right, rows clustered on centre-y
with half-median-height tolerance). `figmaNodesToScenes` now applies it per page
and only emits a loose-shapes scene on a frame-less page. Ground-truthed against
a real 31-slide Penpot keynote (its PDF export): canvas child order is
Z/creation order, which played the deck backwards and surfaced component-master
boards and scratch content as scenes. The Penpot side of the same fixes
(skip `componentRoot`+`mainInstance` masters, skip `hidden` subtrees, top-level
`hideInViewer` boards excluded as scenes but nested ones still painted) lives in
the shell walk (design-import.ts).

Also additive on the bridge: two optional `ComposeSpec` fields for that bulk bake
path - `transient` (skip the host's render cache in both directions; the CALLER
then owns the returned url and must release it) and `settleMs` (advisory
post-mount settle override, only safe when the child mounts no image/lottie/video).
Both absent → byte-identical behaviour, so no v1 method changed.

Also additive in design-map, the same keynote's biggest fidelity gap (2,290
`path` shapes imported as their selrect rectangles): `penpotShapeToNode` now
routes `path`/`bool` content through the Figma `_vectorPath` markers -
`_vectorSize` carries the PAGE-SPACE origin (Penpot path coords are absolute
page coords, unlike Figma's shape-local vectors), plus `_vectorGradient` (the
raw `fillColorGradient`, baked as a native SVG def, never the grad-spec route)
and a stroke marker with opacity. New pure exports: `penpotPathContentToD`
(d-string passthrough + segment-object conversion), `penpotGradientSvgDef`, and
`penpotGroupToSvg` - flatten an all-vector group subtree (paths/bools,
solid/gradient circles/rects, nested groups, `maskedGroup` via `<clipPath>`)
into ONE standalone SVG string in `shapes` z-order, so a 500-path illustration
imports as one image box instead of hundreds of colour blobs. Mixed subtrees
(text, image fills, shadows) refuse and fall through to the per-shape import.

## 1.85.0 - PDF redaction + fresh-manifest signing

Additive, two optional bridge surfaces for the Redact utility:

`host.pdf.redact(bytes, { bars, dpi?, grayscale? })` - rasterise-and-rebuild
redaction. Every page is rendered to an image, each bar (PDF points, y from the
TOP of the page, 1-based page index) is burned in as a fully opaque fill, and a
brand-new pdf-lib document is constructed whose pages contain only those images
at the original MediaBox sizes - no text layer, fonts, annotations,
attachments, layers, scripts or metadata survive, because nothing is carried
over. Optional per-method like compress: it needs a real canvas, so the web
shell provides it and the node CLI does not - tools feature-detect
`host.pdf?.redact`.

`host.pdf.pages(bytes, { maxPages? })` - each page rendered to a
self-contained SVG document (text outlined to paths, fonts embedded as a
safety net, viewBox in PDF points with the origin at the TOP-LEFT), the live
preview an interactive tool draws on. The viewBox space is exactly the space
PdfRedactBar lives in, so an overlay converts client rects to bars with one
scale factor and no DPI. At most `maxPages` pages return (default 40,
`truncated` flags the rest), and a page that fails to render is skipped, not
thrown. No canvas needed, but it reaches the web shell's own page interpreter,
so like redact it is optional per method - feature-detect `host.pdf?.pages`;
the node CLI omits it.

`host.c2pa.sign(bytes, format, { description? })` - embed a FRESH signed C2PA
manifest with NO ingredients and no ingredient thumbnails, for the opt-in
re-sign of a redacted derivative (carrying the source manifest forward would
re-embed a thumbnail of the un-redacted original). Reuses the web shell's
existing manifest build + signing path (enrolled identity when valid, else the
ephemeral on-device key). Throws on an unstampable format or signing failure.

Both absent → byte-identical behaviour; no v1 method changed.

Pure additions since, no version bump (the `HostV1` contract is untouched, so there
is no minor to name): `scanPenpotUsage` in `src/brand-import.ts` (+ the
`PenpotUsage`/`PenpotUsageColor`/`PenpotUsageGradient` types, barrel-exported) - a
usage census for token-LESS Penpot projects, the dual of `extractPenpotProject`'s
dead end. It tallies every paint source per colour (fills, strokes, text-run leaf
fills, gradient stops from both fill and stroke gradients), dedupes gradients by
type + stop signature with a modal aspect-ignorant angle (raw endpoint fractions,
ties toward the smaller angle), and aggregates `collectPenpotFontUsage` across text
shapes with `fontId` verbatim, so a shell can propose brand roles from what a
designer actually used. Container walking only - no colour theory in the engine.

Pure additions since, no version bump (no HostV1 change): `collectPenpotExportMarks`
in `src/design-map.ts` (+ the `PenpotExportEntry`/`PenpotExportMark` types,
barrel-exported) - collects a Penpot page's export-marked shapes in paint order,
normalizes each `exports` entry (explicit png/jpeg/svg type comparisons, scale
clamped 0.1..8, suffix stringified) and dedupes identical entries, pruning hidden
subtrees and component-master subtrees (a mark on a master OR any descendant is a
definition, not content). The shell decides how each entry becomes a stored asset.

Pure additions/fixes since, no version bump (no HostV1 change): Penpot per-corner
radii + flip fidelity in `src/design-map.ts`. New pure helpers
`penpotTransformBaked`, `pathDBounds`, `mirrorPenpotGradient` and
`penpotRoundedRectD` (a thin adapter over css-box's `cornerRadii` +
`roundedRectPath`, so the CSS section 5.5 overlap clamp stays shared with the export
walker). Fixes: a path whose `transform` bakes rotation/flip into its page-space
`content` now maps to the content bbox with rot 0 instead of double-transforming
on selrect + rot; flipped shapes mirror their gradient endpoints (box `grad`,
group-bake defs) since consumers emit unflipped geometry; unequal per-corner rect
radii (r1–r4) route through the vector bake as a four-corner rounded-rect path
(flip-permuted), while equal corners keep the byte-identical `rounded`/`<rect rx>`
paths; image fills on flipped shapes carry a transient `_fillFlip` marker the web
shell's media loader bakes into the stored pixels.

Pure additions since, no version bump (no HostV1 method change): `PdfPagesResult`
gains an optional `failed?: number[]` - the 1-based pages within the cap whose
render failed, so a host.pdf.pages caller can name the missing previews instead
of letting a skipped page pass silently. Absent when every requested page
rendered; existing callers are unaffected.

## 1.86.0 - deep pixels: the float foundation

Additive, engine-only (no HostV1 method added or changed - the minor names the
pixel-pipeline foundation the deep encoders and filter migration will build on;
plans/61-deeprichpixels.md Phase A):

`src/pixels.ts` - the `DeepFrame` buffer (`Float32Array` RGBA, LINEAR light,
un-premultiplied, UNBOUNDED - >1.0 headroom and <0 out-of-gamut excursions are
legal) whose `PixelSpace` travels with the data, babl-style, so downstream
operations never silently assume sRGB. Plus every converter between it and the
byte world: u8-sRGB decode/encode (IEC 61966-2.1, the encode being the ONE
display-referred clamp boundary), u16 linear interchange, IEEE 754-2008 binary16
pack/unpack (ties-to-even in a single rounding step, `Float16Array` fast path
when the platform has it), `convertSpace` hubbed through XYZ-D65 with CSS Color 4
full-precision matrices (Bradford folded in for the D50 legs, CIELAB per CIE 15),
premultiply/unpremultiply at encode boundaries only, and zero-copy
`mapScanlines`. Barrel-exported, with `DeepFrame`/`PixelSpace` types.

`src/icc-pixels.ts` - parsed ICC profiles APPLIED to frames (the digiKam act):
`applyIccToFrame` (device ↔ PCS Lab per scanline), `convertViaIcc` (both legs
fused per row, no intermediate PCS frame), matrix/TRC + gray profiles evaluated
analytically, pure-LUT profiles pre-linked once into a tetrahedral device-link
lattice, and `iccResolvedIntent` implementing the ICC v4 clause-8
rendering-intent fallback. Never throws (null on malformed/unusable, matching
the reader); device-side outputs carry the `ICC_DEVICE_SPACE` sentinel so
colorimetric machinery fails loud instead of laundering device values - and
`toPcs` REQUIRES that sentinel on its input symmetrically (a linear-tagged
`DeepFrame` is refused, `iccFrameRefusal` names why), so a `fromU8Srgb` frame
can never be silently read as encoded device bytes.

`src/deflate.ts` - a pure raw-DEFLATE compressor (RFC 1951: 32 KB-window LZ77
with lazy matching, fixed Huffman, stored-block fallback so incompressible input
costs at most 5 bytes per block) plus `zlibCompress` (RFC 1950 wrapper) and
`adler32`. The half of zlib the tree lacked - inflate already ships (url-pack);
this is what the own-PNG-writer and OpenEXR phases need for IDAT/ZIP chunks.
Validated against node:zlib and DecompressionStream as independent oracles.

`src/hdr.ts` - the float view transform: `hdrViewTransform` returns a LINEAR
`rec2020-linear` DeepFrame (boost gain only - no PQ, no clip), the PQ encode
moved behind `pqEncodeFrame` → `PqImage` (`encoding: 'pq'`, deliberately NOT a
DeepFrame: PQ signal is not linear light) and `pqToU16` for 16-bit consumers.
The legacy `hdrBoostToPQ` 8-bit entry is kept byte-identical (sha256-pinned by
tests) so existing AVIF HDR output and its C2PA hashes cannot drift.

`src/tiff.ts` - `packTiff` gains `depth?: 8 | 16 | 'float32'`: BitsPerSample
16 with SampleFormat 1, or 32 with SampleFormat 3 (IEEE float, TIFF 6.0 section 19).
Default-8 output stays byte-identical (SampleFormat omitted = spec default);
the writer never converts depths - buffer element type must match, conversion
is pixels.ts's seam. Fixtures validated against libtiff + sips and pinned.

Ingest honesty landed shell-side in the same pass (web: `depthHint` beside
`profileHint` - a >8-bit upload now says so instead of being silently crushed),
but that is shell code, not engine surface.

No v1 bridge method changed.

## 1.87.0 - token-first brand ingest

(The `ENGINE_VERSION` bump to 1.87.0 belongs to the same change set as this
minor's design-map work; this section covers the brand-ingest modules only.)

`src/brand-import.ts` - new `scanPenpotAppliedTokens(entries)`: the third
walker over an unzipped `.penpot` archive, tallying every shape's
`appliedTokens` map (attribute name → declared token name) into fill, text,
stroke, type and geometry signals per token. It is what lets an import rank a
file's DECLARED tokens by how the designer actually used them, instead of
guessing brand roles from raw hexes. Attribute names are read in the camelCase,
kebab and `:key` spellings `scanPenpotUsage` already tolerates; token names
accumulate in a `Map` because they are file-controlled. Attributes the census
does not model are skipped rather than mis-filed, so a future Penpot attribute
can only under-count. Never throws; an archive with no applied tokens (every
file exported before the feature, including the UXDays keynote fixture) returns
`[]` and the caller falls back to the usage census exactly as before. The
manifest → page-path resolution both walkers need is now one shared helper, so
two censuses of the same archive cannot disagree about which shapes exist.

`src/tokens.ts` - `$metadata.activeThemes` is now honoured for SINGLE-axis
docs too, not only the multi-axis branch: a doc with several ungrouped themes
and no explicit `theme` resolves the theme the file says is active instead of
always taking the first. Grouped themes may be named bare or as `group/name`.
Docs without `activeThemes` are unaffected. Also new: `typographyFamilies`, a
pure reader for the font families in a typography composite - Penpot's encoder
writes plural keys (`fontFamilies`) and stores split families as arrays, while
Tokens Studio and hand-authored docs use the singular string form. Families
only; sizes, weights and line heights carry units this has no business guessing.

No v1 bridge method changed.

`src/design-map.ts` - background blur import (Penpot 2.17, PR #10034). Penpot
moved background blur out of `blur` onto its own shape attribute,
`backgroundBlur: {id, type:'background-blur', value, hidden}`, a sibling of
`blur` that may coexist with it, and narrowed the `blur` enum to `layer-blur`.
New export `penpotBackgroundBlurPx(shape)` reads it - plus the LEGACY pre-2.17
`blur: {type:'background-blur'}` spelling, which no Penpot migration rewrites -
and converts the radius for CSS: Penpot's shipping Skia renderer uses
sigma = 0.57735 * value + 0.5 and CSS `backdrop-filter: blur(R)` is sigma R/2,
so R = 1.1547 * value + 1. That constant is an approximation, pinned by a test
so a fixture comparison moves it deliberately. The value lands on the new
`bgBlur` box field, on plain boxes and image-fill boxes only: Penpot masks a
text shape's background blur to the glyphs, and baked vector art would get a
rectangular frost behind an arbitrary outline, so both drop it and the shell
warns once per import. `penpotGroupToSvg` now refuses to flatten a subtree
carrying a visible background blur (a standalone SVG has no primitive that can
read a backdrop) so the shapes fall to the per-shape import instead. `blur`
itself is unchanged, and a background blur never reaches it.

---

## 1.88.0 - depth follows provenance: the `depth` param and our own PNG writer

Also in 1.88.0, pure additions with no bridge surface (Penpot design-system
import, plans/46-penpot-design-system.md):

`src/design-components.ts` (new) - `collectPenpotComponents` enumerates a
Penpot file's component definitions, grouping a variant set into ONE logical
component (Penpot writes one record per variant, sharing `variantId`; the
container id is the logical identity) and censusing instances that point at
external shared libraries by `componentFile`, which is the only honest test:
in a real deck three foreign component ids also exist locally, because the
library was duplicated from that file. `penpotComponentSlots` infers the
editable slots of a master subtree - text shapes and image fills, labelled by
the author's own shape names. Pure: parsed JSON in, data out.

`src/design-map.ts` - `penpotFlowOrder` orders boards by a file's prototype
flow (navigate edges from the page's declared `startingFrame`, triggers on
nested shapes resolved to their board, cycles terminated, first authored
branch taken, orphans appended) with the caller's reading order as the
fallback; `penpotAnimationToTransition` maps Penpot's animation types onto the
scene enter vocabulary (dissolve → fade with its authored duration, slide/push
→ directional slides). A file with no interactions produces no flow and no
transitions, so its scenes are unchanged.

Both are observed-from-fixture, not inferred: tests/fixtures/penpot-kitchen-sink.penpot
is a real 2.17.1-RC4 export authored for this purpose. It corrected two guesses
already - the action type is `navigate`, not `navigate-to`, and the flow's
start lives on the page record rather than a shape.

The first slice of plans/61-deeprichpixels.md Phase B, plus the URL-mode plumbing
its section 10 calls for. Additive: one optional FIELD on `ExportOpts`, no HostV1
method added or changed, so every existing shell behaves exactly as before.

`src/url-mode.ts` - new reserved param `depth` (`8 | 16 | float | auto`,
default `auto`), beside `hdr`/`dpi`/`unit`. `parseDepth()` is total over
untrusted input: accepted spellings are case- and whitespace-insensitive and
everything else (absent, empty, `32`, `deep`, `constructor`) degrades quietly
to `'auto'`. The whitelist is a `Map`, not an object literal, because it is
indexed by URL text - a plain object answers truthily for `constructor` and
`__proto__`. Web (`?depth=16`), CLI (`--depth=16`) and MCP inherit it from this
one change; the plumbing IS the surface.

`ExportOpts.depth` (packages/core/src/host-v1.ts) - the request as it reaches an
export bridge. A request, never a promise: consumers apply the governing rule,
**depth follows provenance** - emit deep bits only where the pipeline produced
them. A 16-bit container over an 8-bit render is padding, and shipping it is the
export-side twin of the silent-ingest lie Phase A fixed.

`src/png.ts` - new: `packPng`, the engine's own PNG encoder. 8-bit and 16-bit
truecolour (RGB/RGBA), IHDR/cICP/pHYs/iTXt/IDAT/IEND, adaptive row filtering
(libpng's MSAD heuristic), IDAT split into 1 MiB chunks. 16-bit samples are
big-endian per PNG spec section 7.1 - deliberately the opposite of `tiff.ts`'s
little-endian files, so the same `Uint16Array` lands as different bytes in each
writer. It NEVER converts depth: `depth: 16` demands a `Uint16Array` the caller
already produced at 16 bits, which is the provenance rule expressed as a type
error. `deflate.ts` still has no incremental surface, so a single-shot ceiling
(default 16 MiB of FILTERED bytes) either throws or, with `oversize: 'store'`,
writes spec-valid uncompressed zlib blocks in O(1) extra memory. mDCV and cLLI
are deliberately NOT emitted - nothing in the pipeline produces mastering-display
or content-light-level values yet, and inventing them would break the same rule.

First consumer (web shell, not engine): `?hdr=1&format=png` now runs
`fromU8Srgb → hdrViewTransform → pqEncodeFrame → pqToU16 → packPng(depth 16,
cICP 9/16/0/1)` instead of 8-bit `hdrBoostToPQ` + a chunk splice, closing the
plan's sharpest recorded defect (PQ quantised to 8 bits bands the shadows). No
new toggle - an invisible upgrade under the existing `hdr=`. `depth=8` is
ignored there with a logged note, because 8-bit PQ *is* the defect.

Also: catalog asset records gain an optional sniffed `depth` (bits per channel)
on each format entry - schema-side only, no engine code reads it yet.

## 1.89.0 - the gain-map JPEG: one file, two renditions

Phase B2 of plans/61-deeprichpixels.md (section 4.2, section 6 B2, section 9c). Three new engine
modules and one deliberate behaviour change; no HostV1 method was added or
changed, so no shell had to move. `?hdr=1&format=jpeg` now writes an ISO
21496-1 / Ultra HDR v1.1 gain-map JPEG instead of an 8-bit PQ-encoded,
Rec.2100-tagged one - the only HDR still-image output that renders as real HDR
in Chromium/Safari/Android and degrades to an ordinary SDR JPEG everywhere
else. The legacy PQ path remains, reached by `depth=8` or by any failure in the
new one.

`src/gainmap.ts` (new) - the container-agnostic gain-map maths.
`computeGainMap(sdr, hdr, opts)` derives `log2(HDR/SDR)` per pixel from a pair
of `DeepFrame`s, quantises it into a single luminance channel against the
fitted `[min, max]` range, and returns the map plus the ISO/Adobe metadata that
describes it (gamma, SDR/HDR offsets, HDR capacity, base rendition); its
inverse `applyGainMap` and the display-side `gainMapWeight` (the headroom ramp a
viewer applies) are there so the round trip is testable rather than asserted.
Sources are cited per use site - ISO 21496-1:2025, the Adobe Gain Map
Specification v1.0, Google's Ultra HDR v1.1 pseudo-code, libultrahdr's
`gainmapmath.cpp`, BT.2020-2 luma coefficients. The map is emitted at full
resolution (Ultra HDR commonly ships 1/2 or 1/4 scale - a pure size
optimisation, and the honest place for it is resampling the linear log2 field
before quantisation, never the 8-bit map). One channel only: `meta.channels`
is `1`, so a 3-channel mode stays additive.

`src/jpeg-segments.ts` (new) - the shared JPEG marker-segment walker and
writer the tree had been re-implementing per feature (`c2pa-containers`'s
`placeJpeg`, `strip-metadata`'s `scanJpeg`, the shell's metadata splicers).
`scanJpegSegments` returns segments, SOS, EOI, trailer start and a `truncated`
flag; malformed input yields a short scan rather than a throw, and only a
missing SOI returns `null`. `insertJpegSegments` places new segments at a
documented rank so metadata order is a rule instead of an accident.

`src/gainmap-jpeg.ts` (new) - the container. `assembleGainMapJpeg(base, map,
meta)` glues an SDR base JPEG and a gain-map JPEG into one file: an MPF APP2
index (CIPA DC-007 - a big-endian TIFF stream whose MP Index IFD carries
MPFVersion/NumberOfImages/MPEntry, offsets measured from the MP Endian field),
the Google Container XMP on the primary, and BOTH of the metadata forms real
decoders read on the map - the `hdrgm` XMP packet and the ISO 21496-1 APP2 box.
`repairMpfOffsets(bytes)` re-derives the index after something is spliced into
the primary; the extended-XMP GUID chain is deliberately NOT implemented (this
path's packets are under 2 KB, and a silently truncated XMP packet fails
invisibly), so `buildXmpApp1` throws past 65503 bytes rather than guessing.

`src/c2pa-containers.ts` - `placeJpeg` now runs `repairMpfOffsets` over its
output. Splicing an APP11 JUMBF store into the primary grows it without growing
what MPF claims, which left a structurally invalid index (`MPEntry[0].size` no
longer covered the image it describes) and a gain map an aware decoder could
not locate. Stamping a gain-map JPEG is now lossless in both directions.
No-MPF files are byte-identical, so every shipped C2PA hash is unaffected.

`src/file-metadata.ts` - new exports `readMpfIndex` (a verified MPF read: a
second image is reported only when its declared range lies inside the buffer
AND begins with SOI) and `appendedIsExpected`, the single rule behind the
`sensitive` flag on appended data, plus the `JpegMpfIndex` type; all three are
re-exported from `index.ts` because shells already consume
`extractFileMetadata` from the barrel and need them to interpret its output.
The behaviour fix: a trailing payload the file's own container declares is
described (`HDR gain map (ISO 21496-1 / Ultra HDR)`, `second image (MPF
multi-picture)`) instead of being flagged as hidden appended data. Undeclared
trailers - including a real second JPEG with no index, or a zip appended behind
a genuine MPF segment - stay flagged exactly as before. `appendedIsExpected`
says the bytes are *explained*, not that they are harmless; /verify still
offers to view and extract every payload.

`src/strip-metadata.ts` - **behaviour change:** stripping a JPEG whose MPF
index declares extra images now truncates at the primary's own EOI, so the
clean copy is a single ordinary SDR image rather than a file whose remaining
bytes no index accounts for. Files with no MPF index are byte-for-byte
unaffected. The cut is taken from `trailerStart` - the primary's real EOI, not
an offset the file merely claims - so it can only ever land on a marker
boundary.

First consumer (web shell, not engine): `shells/web/src/bridge/export-gainmap-jpeg.ts`,
a DOM-free seam (pixels in, bytes out, the one DOM-bound step - JPEG encoding -
injected), wired into `renderRaster`'s JPEG branch. `imprint`/`durable` marks
are applied to the SDR pixels BEFORE the base is encoded, so the mark lives in
the delivered image and the gain map is computed from the marked pixels.
`hdrViewTransform` derives the HDR rendition FROM the SDR frame, so base and map
are pixel-aligned by construction - one rasterisation, and depth follows
provenance: the map comes from the float transform, never an upsampled 8-bit
intermediate.

## 1.90.0 - a redaction mark can carry a brand, and still cover everything

Additive, four optional fields on `PdfRedactOpts` (`host.pdf.redact`). No method
was added or changed, so every existing shell and tool is unaffected.

`color` - the bar fill as a 6-digit hex. Colour is security-neutral: any fully
opaque fill destroys the pixels beneath it equally, which is what lets a
redaction read as an accountable edit by a known entity rather than an anonymous
smear. Translucency is NOT neutral and is refused, as is anything unreadable -
the host falls back to its neutral near-black instead. That refusal is load
bearing rather than defensive: assigning an unreadable string to a canvas
`fillStyle` is a silent no-op, and the previous fill in the page rebuild is the
opaque white background, so an unvalidated colour would paint white-on-white
bars that redact nothing.

`radius` - corner radius in points. The painted shape is INFLATED by the radius
before its corners are rounded, so the requested rectangle stays entirely inside
the opaque region: each arc's centre lands exactly on a corner of the requested
rect, so no point of it can fall outside the shape. A corner whose sides had to
clamp to the page edge is painted square, because a clamp pulls the arc centre
inward and would cut back into the rect. `inflateForRadius` in the web shell's
`pdf-redact-core.ts` owns the maths and is asserted in node.

`label` / `labelColor` - a short attribution stamp painted ON TOP of the
finished bar (safe: the pixels beneath are already destroyed). The host paints
exactly the string it is given and never derives it from the document; bars with
no room for it are left unstamped.

Behaviour change in the same surface: the optional grayscale pass now runs
BEFORE the bars are burned rather than after. "Scanned page" mode exists to drop
the source's colour (the yellow channel colour lasers hide tracking dots in);
the bars are the caller's own mark, and draining them made the burned colour
disagree with the tool's preview.

## 1.91.0 - an ink that is not a colour

Additive, one optional field on `SpotColor` (`host.tokens` → `ColorSwatch.spot`)
plus the open `FinishKind` union it takes. No method was added or changed, and
absent means exactly what it meant before, so every existing brand and shell is
unaffected.

`finish` - what the press DOES with this ink, when the ink is not an ink at all:
a foil, an emboss or deboss, a spot varnish, a cutting or creasing rule. `name`
still says WHICH ('Gold', 'Silver', 'Die'); `finish` says what happens to it. The
distinction matters because a finish never contributes to the process build: it
is applied as its own plate, and must not be gamut-mapped or merged into CMYK
the way an ordinary spot's alternate space is.

The union is deliberately OPEN (`(string & {})`), because the contract's job is
to define how a finish is SPELLED, not to enumerate what any given press offers.
The offered set is brand data - a brand declares its own finishes on its own
swatches - so a house finish this file has never heard of is a normal case, not
an error. Consequently an unrecognised value must degrade rather than reject:
`readSpotColor` in `engine/src/tokens.ts` drops ONLY a malformed `finish` and
keeps the ink, where the guard it replaced would have failed the whole spot lock
closed and silently un-locked a Pantone because of a typo in a neighbouring
field. Any `switch` over a finish needs a `default:`.

The shell half is the brand editor's existing print-lock control, which gains a
third segment beside CMYK and Spot rather than a new tab, and writes the field
into the same `$extensions` object - so this needs no schema change anywhere.

## 1.92.0 - the formats a video person asks for

Additive, and entirely below the bridge: no HostV1 method was added or changed,
and nothing here is reachable from a tool. Two new engine writers plus the
compressor work that both of them (and the deep PNG path) needed.

`exr.ts` - a single-part scanline OpenEXR encoder: HALF (float16) or FLOAT,
NONE/ZIPS/ZIP compression, INCREASING_Y, channels written in the alphabetical
A/B/G/R order the format requires. It takes a `DeepFrame` and applies no
transfer curve, no tone map and no clamp, because scene-linear and
negative-tolerant is what EXR is FOR - this is the first container in the tree
that can hold a `DeepFrame` without losing either end of its range. The frame's
`space` becomes a `chromaticities` attribute whenever it is not Rec.709/D65 (an
EXR with no such attribute already MEANS Rec.709/D65, so omitting it there is
the honest encoding); `lab` and `xyz-d50` frames are refused rather than
reinterpreted, since EXR's R/G/B are RGB primaries by definition.

`radiance.ts` - a Radiance RGBE (`.hdr`) writer AND reader, new-style RLE plus
the old-style `(1,1,1,n)` shift chain on read. The reader exists so the writer
is testable against itself and so a future `.hdr` ingest has something to call.
Its module header derives, and its tests re-measure, the format's real accuracy:
one shared exponent means error is bounded at 1/256 of the pixel's BRIGHTEST
channel and effectively unbounded relative to a much darker one. That is why EXR
half is the interchange format and this is the convenience format.

`deflate.ts` - a slab-fed incremental deflater (`createDeflateStream` /
`createZlibStream`, create → push → finish, the shape `createStreamingMux`
already uses). `png.ts` streams through it above 4 MiB of filtered bytes, so the
16 MiB single-shot ceiling that made a 4K 16-bit PNG choose between a ~66 MB
stored IDAT and a refusal is gone at the engine level. Verified independently at
2560×1440 (28.1 MiB filtered): 12.19 MiB compressed against 28.13 MiB stored,
fixed-Huffman blocks rather than stored ones, decoding to identical pixels.

`exr.ts` and `radiance.ts` are not in the barrel, following the `gainmap.ts` /
`bytes.ts` precedent - they are engine-internal, consumed by deep-path import.
(`deflate.ts` itself IS barrel-exported; its new streaming API is not.) The
surfacing is CLI-first (plan section 10 item 4): `--export=exr` and `--export=hdr` in
`NODE_FORMATS`, refusing an 8-bit-only source rather than padding it.

## 1.93.0 - the check that says what it could not check

`src/preflight.ts`, plus the `Finding` contract in `@lolly-tools/core`
(`packages/core/src/preflight.ts`) and `src/cmyk-palette.ts` lifted out of the web
shell. No HostV1 method or field was added - a tool cannot see any of this, and
deliberately so: a tool must not be able to contribute a verdict about its own
export.

The split is `print-marks.ts`'s, for the same reason. The engine owns the RULES
and the vocabulary; each shell collects the FACTS from its own platform. So the
engine never touches a DOM, never learns a brand, and the web panel, the CLI's
`lolly preflight` and the batch pre-pass all reach the same verdict from the same
evaluator instead of three implementations drifting apart - which is what already
happened to export settings, where five readers ended up disagreeing.

The design decision worth recording is what happens when a check CANNOT run. A
preflight that stays quiet because it could not look is indistinguishable, to a
reader, from one that looked and found nothing - and that is the worst outcome
available, because it reads as a pass. So a gap is a first-class result: a finding
carrying `needs` (`not-set`, `needs-mount`, `needs-render`, `not-computable`) is
forced to info severity and forced to carry no count, in `add()` rather than at
forty call sites. "Lolly cannot measure ink coverage, and a guess would be worse
than nothing" is an answer. Silence is not.

The same rule governs bounds. A plate count derived from a brand's declared spots
is a ceiling - the artwork decides what actually separates, and that is only known
once the file is written - so it reports as *at most*, and stays a ceiling in every
surface it reaches. Nothing in this module converts a bound into a bare number.

It counts; it does not cost. There is no currency, no rate and no monetary field
anywhere in it, and none may be added: pricing arrives later, from a rate card the
user or their printer supplies, and an invented price is worse than no price.

Also in this minor: `SpotColor.finish` now reaches the export path. A finish ink
declared by a brand - a foil, an emboss, a spot varnish, a die - previously emitted
an ordinary `/Separation` whose tint transform ran to the swatch's colour build, so
a RIP that flattened it printed plausible metallic gold and nothing in the file said
otherwise. The alternate is now 100% K, which changes nothing for a RIP that honours
the plate and turns the flattened case into an unmistakable black mask a prepress
operator catches. Overprint is still not implemented, so the plate knocks out the
artwork beneath it; preflight says so rather than leaving it to be discovered.

## 1.94.0 - one answer to "is this signed?", and one to "trusted by whom?"

`src/provenance-defaults.ts` (`c2paDefaultOn`, `imprintDefaultOn`, `isImprintFormat`,
`IMPRINT_FORMATS`) plus an `includeVendored` option on `defaultTrustAnchors`. No HostV1
method or field was added - a tool can no more choose whether its own export is
credentialed than it can preflight itself.

Both are policy that was already being answered, just in more than one place. Whether an
export carries Content Credentials is declared by the tool manifest - `render.c2pa`,
documented in `schemas/tool.schema.json` as "Default TRUE", forced off for
`privacy:'on-device'` - and the web shell read that declaration while the CLI did not,
so the same tool produced a signed file in the app and a bare one from the terminal. The
rule now lives here and both shells call it (`shells/web/src/lib/c2pa-policy.ts` is a
delegating re-export). Same story for the format gate: `IMPRINT_FORMATS` is the web
shell's `isImprintFmt` list, moved where the terminal shells can reach it.

`defaultTrustAnchors({ includeVendored: false })` exists because "trust nothing except
what I pinned" is a legitimate question a verifier should be able to ask, and the answer
to it is an EMPTY anchor set, not a degenerate one. It pairs with the CLI's
`--no-default-anchors`.

The product decisions these enable are recorded in plans/73-cli-ga-contract.md section 12 (Andy,
2026-08-01): the terminal surfaces now pin the Lolly CA root by default, so "Verified"
means the same thing in a browser and in a terminal; and a CLI render carries the same
provenance marks an app export does, at the cost of byte-determinism, which
`--no-provenance` buys back.

1.95.0 - additive: the certificate read side becomes public API. `parseCertificate`
and `signedBy` (and the `ParsedCertificate` / `DName` / `CertSigAlg` types) are
re-exported from `src/index.ts`, alongside the `Signer` type as `C2paSigner`. Nothing
new is implemented - these have backed the trust-chain walk in `c2pa-verify.ts` since
1.11 - but a Node shell could not reach them, because the engine's package exports are
`.` and `./bridge/v1` only.

Why they are needed outside the engine: an ENROLLED SIGNING IDENTITY for the terminal
(`packages/node-shell/src/signing-identity.ts`). Handing `embedC2pa` a real key + x5chain
is the easy half; the half that has to be right is refusing a misconfigured one BEFORE it
writes a file nobody can verify - the key's public half must equal the leaf's
SubjectPublicKeyInfo, the certificate must be inside its validity window, and the chain
must actually link leaf → issuer. That is exactly `parseCertificate` + `signedBy`, and a
second implementation of certificate parsing living in a shell is precisely the drift
this engine exists to prevent.

## 1.95.0 - it multiplies your printer's rates; it never makes one up

`src/rate-card.ts` - `parseRateCard` and the cost arithmetic over preflight counts -
plus the money-object contract in `@lolly-tools/core` (`packages/core/src/money.ts`)
and the `'ratecard'` user-asset type. No HostV1 method or field was added: a tool
cannot cost its own export any more than it can preflight it.

The whole surface exists to hold one line that must never move. Lolly may multiply a
rate the USER attached - on a rate card their printer gave them - by a quantity Lolly
COUNTED, and must show every multiplication so the user can check it. It may never
originate, default, infer or round-up a price. A number Lolly invented and shown as
money is worse than showing none, for the same reason invented dot-gain was worse than
no simulation: it is trusted precisely because it looks measured.

So the rules are load-bearing, not decorative. There is no default currency anywhere -
the currency comes from the card, and a card without one prices nothing. A rate is stored
at full precision and only the finished subtotal is rounded to the currency's own
minor-unit resolution, so a sub-cent trade rate (routine - fractions of a cent per piece)
is not rounded to zero before it multiplies. A total exists ONLY when every counted line
is priced; one uncosted line and there is no scalar total at all, because a partial card
under-estimates by an unbounded amount and the missing line is often the largest. A count
that is a ceiling - the plate set is only known once the file is written - stays a ceiling
through the multiplication: the money reads "up to", never a bare figure. The minimum
charge is a visible adjustment row, never a silent floor, so the rows always sum to the
headline. And the serialized object a client might be mailed carries its caveats as
sibling fields - `kind:"estimate"`, `isQuote:false`, the disclaimer, whose rates and
whether they had lapsed - because a caveat that lives only in a UI string is lost the
moment the file travels. The field is `estimatedTotalFromSuppliedRates`, null unless
coverage is complete; there is no field named `total`.

The example card ships schema-INVALID on purpose (its rates are placeholder strings),
`parseRateCard` refuses it by digest, and a repo scan forbids a numeric rate in any
shipped `.json`, so a plausible-looking rate can never be copied into working money
wearing the user's own card. Also in this minor: the 1.73 `AssetQuery.type` drift - it
never gained `'profile'` - is fixed, and the asset-type guard now watches all four copies
(both JSON schemas, `AssetQuery`, and `asset-kinds`' sets) instead of only the two
schemas, which is how `'ratecard'` could be added without repeating the rot.

## 1.96.0 - a tool can speak, and the same clip captions itself

Additive: `host.speech`, on-device text-to-speech (Kokoro). Text in, mono Float32
PCM out at 24kHz, plus per-word timings - the dual of 1.71's `host.audio`: where
`analyse` turns a finished clip into numbers a tool can draw, `synthesize` turns
a tool's own text into a clip, and the result feeds straight back into
`audio.analyse` so a voiceover can drive the same reactive visuals as any other
track. Optional/additive, feature-detected NOT capability-gated - a tool checks
`host.speech` and hides its voiceover affordance where it is absent; the headless
CLI omits it for now. The model weights are a one-time download the user consents
to (`modelBytes` sizes the ask, `cached` answers without fetching); synthesis
runs locally and the text is never uploaded.

The word timings exist for captions, so the engine grows the module that consumes
them: `src/captions.ts` - `groupWordsToCues` (greedy grouping on sentence
punctuation, character/duration ceilings and spoken pauses), `cuesToVtt` /
`cuesToSrt` (dot- vs comma-millisecond timestamps), and `cueAt` (binary search
for a draw loop). Pure maths on the `analysePcm` pattern: the shell owns the
model, the engine owns the grouping, so the browser and a headless export break
caption lines at the same words. A result may be sentence-granular or carry no
alignment at all - `granularity` says which, and a captioning tool reads it
rather than guessing. No v1 method changed.

## 1.97.0 - Lolly leaves a door open; everyone else brings their own furniture

`packages/core/src/extension-v1.ts` - the chrome EXTENSION contract, the `host-v1`
analog for the shell instead of the tool canvas. It is Lolly's founding thesis turned
on its governance and chrome surfaces: tools are data hydrated into the canvas at
runtime through community and brand channels; extensions are components hydrated into
named chrome SLOTS at runtime through their own channels. Same idea, different surface.
No HostV1 method or field was added - a tool cannot fill a chrome slot any more than it
can grant itself a capability. The contract carries its own `EXTENSION_CONTRACT_VERSION`
and is additive like HostV1: slots and fields are added in minors, never removed.

Core defines the doors and nothing else. `SLOT_REGISTRY` is a plain, enumerable data
constant - the chrome analog of the tool catalog index - so a control plane or a
community author, each in a separate repo, can discover what doors exist to fill and
compile against the spec without depending on the engine or the web shell. A slot has a
`SlotHost` (what a component receives: the element it owns, a scoped typed context, `t`
and `announce`, and which channel supplied it) and an `Extension` (what a component
provides: an id, its slot, an optional contract-version floor checked at register time,
and a mount lifecycle returning a disposer). The host surface is deliberately minimal
and generic over the mount target, so a non-DOM shell could reuse the mechanism and so
the base never grows per feature - slot-specific capability rides in the typed context.

Three supply channels share one contract: `control-plane` (governed enterprise
extensions), `community` (an OSS opt-in a self-hoster deploys at their own choice), and
`local` (a deliberate power-user opt-in). The channel is carried for governance and an
honest provenance chip, and it is NEVER a security boundary: a hydrated component runs
in the shell realm exactly like a tool hook, which is not a sandbox. Control-plane
furniture is org-trusted; community furniture is opt-in-at-the-deployer's-risk; Worker
isolation is the same future hardening tools already await. Core states this plainly and
claims no isolation it does not provide.

Dormant by construction: an empty door renders nothing, importing the registry pulls in
no furniture and no DOM, and a shell with zero extensions registered is byte-identical to
before. The first door is `cost-authoring`. The rate-card AUTHORING UI - org and deployer
config, not core-individual config, and already unwired in core - moves behind it, so the
individual is never expected to author a supplier's price list. What stays in core is the
honest, universal part: the preflight counts, the pure cost calculator, and card
CONSUMPTION, so a card supplied by the CLI or a control-plane catalog asset still parses,
stores and prices with no authoring UI present.

## 1.98.0 - the synthesis text maths moves into the engine

`src/speech-text.ts` - the pure half of Kokoro TTS (formerly
`shells/web/src/lib/speech-kokoro.ts`), moved under the inclusive-audio
roadmap's one-synthesis-layer rule: normalizeText and the phoneme pipeline
port, splitSentences/splitWords/chunkByPhonemeLength, phonemeTokenSpans,
wordTimingsFromDurations, concatClips, and the voice/model constants. All
plain math and string work with the model, tokenizer and phonemizer injected
around it - the analysePcm split - so the web worker and Node scripts
(scripts/build-docs-audio.ts renders the /info narration on it) speak the same
words the same way. The web-shell module stays as a thin re-export, so no
import site moved. New pure exports on the barrel; no HostV1 method added or
changed.

## 1.99.0 - the speech contract learns to listen

Additive: transcription on the optional `host.speech` (tts-stt-programme section 8).
`SpeechAPI` gains `transcribeAvailable()` (sync feature-detect, the mirror of
`isAvailable`), `transcribeCached()`, `transcribeModelBytes()` and
`transcribe(src, opts)` - on-device Whisper over the existing `AudioSource`
type from host.audio, returning a `SpeechTranscript` (text + the same
`SpeechWordTiming[]` shape synthesis emits, so caption plumbing reads either).
Feature-detected, not capability-gated: audio never leaves the device, and the
first use downloads the STT model once, gated by its own consent separate from
the TTS download. The CLI omits transcription for now. Contract only in this
minor - no shell implements it yet. No v1 method changed.

Also in this minor (additive, synthetic-audio provenance - the EU AI Act
Article 50 item in plans/41-tts-stt-programme.md section 2): `GENERATED_SOURCE_TYPE`
(IPTC trainedAlgorithmicMedia) joins the exported source-type constants beside
digitalCreation/digitalCapture/screenCapture, so a shell stamping a generated
clip's credential names the AI origin from one shared constant; the read side
now surfaces each recorded action's raw `parameters` (on `C2paHistoryStep` and
the claim's action list) so a reader can recover the machine-readable context a
writer stored on a step - e.g. the exact script, voice and model a TTS clip was
synthesized from; a preserved audio ingredient's `dc:format` resolves for
wav/mp3; and mp3 joins `C2PA_FORMATS` - the C2PA MPEG-1/2 audio binding, the
manifest store as a GEOB frame in the leading ID3v2 tag (existing frames kept,
re-stamp replaces, the whole tag excluded from the hard binding), with sniff +
extraction so verify reads it back. No signature changed and existing manifests
hash identically.
