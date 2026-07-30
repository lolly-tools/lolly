# Engine changelog

One entry per ENGINE_VERSION minor (the bridge contract version in `src/version.ts`,
re-exported from `src/index.ts`). Additive-only within v1: methods are added in
minors, never removed or signature-changed without a major bump.

Moved verbatim from the comment block that used to live in `src/index.ts`.

1.1.0 — additive: `file` input type, the transform output path
(host.export.file + the `exportFile` hook + runtime.exportFile), and the
`privacy: 'on-device'` utility marker. All backwards-compatible with ^1.0.0
tools; no v1 method was removed or changed.

1.2.0 — additive: tool composition / nested renders — the optional
`host.compose` capability + manifest `composes` (rendered via resolveNestedRenders
into `{{asset <id>}}` extras). Backwards-compatible; shells without compose just
don't resolve composes (the {{#if}} slot stays empty).

1.3.0 — additive: end-user tool-as-image. A Lolly tool URL (share link / embed
URL) pasted into the asset picker becomes an asset whose `id` is the canonical
embed URL; the runtime re-renders it on load via the new optional
`host.compose.renderUrl` (see tool-url.js). Backwards-compatible; a shell
without renderUrl simply leaves such an asset blank.

1.4.0 — additive: live media. The optional `host.media` capability (a camera
frame source) plus a new `onFrame` hook + runtime.startLive/stopLive let a tool
react to a live camera stream frame-by-frame (e.g. a filter that responds to
motion). Pure progressive enhancement: the hook is only driven where the shell
provides host.media; a shell without it (or a tool without onFrame) is unaffected,
and such tools keep working as ordinary still-image tools. No v1 method changed.

1.5.0 — additive: packed URL state. A whole readable query can be compressed into
a single reserved `z` param (raw DEFLATE + base64url — url-pack.js: packQuery /
unpackToken / expandQuery) so complex tools stay shareable past the ~2000-char URL
ceiling. Pure URL-mode enhancement — no bridge/host method added or changed; the
codec is native (CompressionStream) with graceful fallback to the readable form.

1.6.0 — additive: themable two-colour icons. An asset id may carry a colour
pairing (`<baseId>?theme=<themeId>` — icon-theme.js) which shell bridges parse
before catalog lookup and bake into the resolved SVG at resolve time; pairings
are catalog data (a palette-type asset tagged "icon-themes"), never engine code.
No v1 method signature changed — host.assets.get/isAvailable simply accept the
suffixed id form; a shell that ignores it still resolves the base asset.

1.7.0 — additive: two independent format extensions.
  • `parseDataRows` (data-import.js) maps a user's CSV/JSON file onto a `blocks`
    input's sub-fields, driven by the new manifest `blocks.importData` — the
    ingest counterpart to CSV/JSON export. Pure; the result flows through the
    ordinary input-set path (URL/save-safe).
  • `packTiff` (tiff.js) is a baseline RGB/grayscale TIFF emitter backing the new
    `tiff` export format (the DeviceCMYK TIFF keeps its bespoke shell encoder).
No bridge/host method was added or changed; older tools are unaffected.

1.8.0 — additive: on-device Content Credentials verification (c2pa-verify.js —
verifyC2paPdf / extractC2paFromPdf). The read-side counterpart to the 1.x C2PA
embedder: extracts a PDF's manifest, re-checks hashed URIs, the COSE claim
signature, cert validity and the hard binding, and reports c2pa-rs-style
status codes. Backs the web shell's /valid view and the CLI `validate`
command. Pure engine module; no bridge/host method added or changed.

1.9.0 — additive: Content Credentials for every embeddable raster/vector
container. embedC2pa(bytes, format, opts) stamps png/apng, jpg, gif, svg,
tiff/cmyk-tiff and webp (byte-matching c2pa-rs's asset handlers, same
two-pass hard binding as the PDF path), the claim gains
claim_generator_info + digitalSourceType + an optional `tools.lolly.export`
environment assertion, and verifyC2pa() sniffs + verifies all of the above.
mp4/webm (BMFF/Matroska hashing) and avif stay unstamped for now; ico, eps,
emf and the text/data formats have no C2PA container. No bridge change.

1.10.0 — additive: Content Credentials for video. embedC2pa stamps mp4 (the
spec's BMFF binding: manifest in a top-level C2PA `uuid` box appended last —
stco/co64 never shift — under c2pa.hash.bmff.v2, whose box-walk hash matches
c2patool byte-for-byte) and webm (no standardised Matroska binding exists,
so the manifest rides as a `manifest.c2pa` attachment, application/c2pa,
under the ordinary data-hash binding; SeekHead indexed when there's Void
room). verifyC2pa sniffs mp4/webm/mkv, extracts both carriers and validates
c2pa.hash.bmff.v1–v3 flat bindings (foreign c2patool-signed mp4s included;
fragmented/Merkle reported honestly as uncheckable). No bridge change.

1.11.0 — additive: Content Credentials identity. embedC2pa / embedC2paInPdf
accept opts.signer ({ privateKey | sign(bytes) → raw 64-byte r||s, certDer,
chain }) so a CA-issued device credential replaces the ephemeral self-signed
signer (chain bytes frozen per embed; ES256/P-256 only), and verifyC2pa
accepts { trustAnchors } (root cert DERs) to verify the x5chain and report a
trusted identity instead of the unconditional untrusted row. The DER/X.509
authority moved from c2pa.js to x509.js (byte-identical output), which adds
pemToDer / derToPem / generateCaRoot / issueLeafCert — the leaf follows the
c2pa-rs profile (O + CN subject, emailProtection EKU, SKI/AKI, SAN
rfc822Name = verified email). Pure options on pure functions; no bridge
change.

1.12.0 — additive: richer text shaping on host.text.toPath. The already-declared
`features` (OpenType tags, e.g. ['liga=0', 'salt=1']) is now honoured — passed to
HarfBuzz so ligatures/stylistic-alternates toggles bake into the outlined paths —
and a new `letterSpacing` (px) adds uniform tracking to the pen advance, so
letter-spaced text stays outlined (SVG/PDF/EMF) instead of falling back to a live
<text> element. Additive optional opts on an existing method; no bridge change.

1.13.0 — additive: PDF / Adobe Illustrator (.ai) design import. `interpretPdfPage`
(pdf-map.js) reconstructs a page's content stream into editable DesignNodes —
rectangles/ellipses/text/optional-content-group layers become boxes with real
(y-flipped) coordinates, arbitrary paths become baked SVG `_vectorPath` images, and
form XObjects recurse — the PDF counterpart to the Figma/Penpot walkers. Helpers
`parseToUnicode` / `toUnicodeDecoder` recover text from embedded/subset fonts. Pure
engine module; the shell (pdf-import.js) owns the pdf-lib byte work. No bridge change.

1.14.0 — additive: AES-256 (R6 / ISO 32000-2) PDF standard-security-handler
encryptor (pdf-crypto-r6.js) — the pure crypto behind the "Strong lock" export
tier. buildEncryptDictValues computes /U /O /UE /OE /Perms and encryptObjectBytes
wraps each object (IV ‖ AES-256-CBC-PKCS#7, one file key for all objects); DOM-free
(globalThis.crypto only) with all randomness injected as params, so it round-trips a
fixed byte vector. Applied encrypt-last over finished PDF bytes; the shell owns the
pdf-lib object walk + /Encrypt dict assembly. Pure engine module; no bridge change.

1.15.0 — additive: two-tier whole-zip encryption (zip-crypto.js) — the crypto
behind the "lock this download" option. buildEncryptedZip frames an encrypted zip
from pre-compressed entries: `standard` = traditional PKWARE ZipCrypto (opens
anywhere incl. Windows Explorer, weak), `strong` = WinZip AES-256 / AE-2 (PBKDF2-
SHA1 + AES-256 little-endian CTR + HMAC-SHA1; strong, but not Windows Explorer's
built-in extract). DOM-free (globalThis.crypto only; bundles a small AES core for
the LE-CTR keystream since subtle has no ECB and is too slow per-block); all
randomness injected as params so it round-trips a fixed vector. Verified against
`unzip -P` and pyzipper. Shell compresses with fflate + hands over bytes + CRC; no
bridge method changed.

1.16.0 — additive: animated + video assets, end to end.
  • `sniffAnimatedRaster` / `sniffVideoContainer` (media-sniff.js) classify an
    upload from its header bytes so a shell can tell an animated GIF/APNG/animated-
    WebP from a still one (same MIME, different container) and store it VERBATIM
    instead of flattening it through a canvas re-encode. Pure, DOM-free.
  • a logic-less `{{media <asset>}}` template helper emits the right element per
    asset type — <img> for raster/vector (unchanged), a data-lottie-src marker for
    lottie (reuses the existing enhancer), and <video autoplay loop muted playsinline>
    for video — so any tool can consume the new asset kinds without per-tool if/else.
    Every attribute is escaped (SafeString discipline, like the `markdown` helper).
  • AssetRef.meta.posterUrl is documented as the still fallback frame for a video
    (used for <video poster> and as the export/pre-play still), mirroring lottie.
Helpers are not part of the HostV1 contract, so no bridge version moved; older
shells still render the emitted markup (and, absent the shell's export snapshot,
simply drop the moving frame to a still). No v1 method changed.

1.17.0 — additive: device capture. New optional `host.recorder` (RecorderAPI)
records the microphone (and optionally the camera) to a Blob and exposes a
DOM-free live level meter (AudioLevel = rms/peak/dbfs/clipping/t) — the audio
counterpart to host.media's camera frames; the shell owns getUserMedia +
MediaRecorder + AnalyserNode, the engine sees only numbers + Blobs. New
`microphone` Capability (record prompts for a grant a shell may lack, so unlike
media it IS capability-gated; the CLI provides no recorder). Runtime gains an
`onLevel` hook (drop-overlap, not time-boxed, mirroring onFrame) plus
startMeter/stopMeter (sound-check) and startRecording/stopRecording/cancelRecording
orchestration. ExportOpts.audio gains fadeIn/fadeOut (seconds) — a GainNode
envelope baked into the muxed bed, so music fades need no pre-faded assets.

1.18.0 — additive: honest provenance modes. embedC2pa / buildC2paManifest /
embedC2paInPdf accept opts.authorship ('created' | 'delivered', default
'created'). 'delivered' writes the standard c2pa.published action with NO
digitalCreation source type — for an existing asset a signer distributes but
did not author (surfaced as "Delivered by Lolly"). verifyC2pa now requires a
c2pa.created action for `madeWithLolly` (a delivered asset may name Lolly
without ever reading as authored by it) and adds `report.delivered`
(intact + a c2pa.published action, not created). The created path is
byte-unchanged. No bridge change.

1.19.0 — additive: honest audio-level coaching. AudioLevel (host.recorder meter +
record session) gains OPTIONAL noiseFloor/snr/hum/hiss fields — a slow min-hold
noise floor, signal-to-noise ratio, and two spectral cues (mains-band HUM ratio,
spectral-flatness HISS) computed off the AnalyserNode the shell already builds, so
a tool can honestly warn "noisy room / electrical hum / hiss" not just clipping.
Older tools ignore the extra fields. The web meter now opens RAW (noiseSuppression/
AGC/echoCancellation OFF) so the sound-check measures the true room; the RECORDING
session keeps suppression ON for a clean file. No method signatures changed.

1.20.0 — additive: AudioLevel gains OPTIONAL `steady` (0..1) — the steadiness of the
loudness envelope over ~1.5s (rms coefficient-of-variation, inverted). A fan/AC/hiss
holds a constant rms (steady→1); speech modulates it (steady→0). Lets coaching tell
constant background NOISE from SPEECH regardless of level — a mid-level hiss that a
min-hold noise floor + snr would mistake for "speaking" now reads as a drone. Computed
off the rms the meter already tracks; older tools ignore it. No method signatures changed.

1.21.0 — additive: front/rear camera selection. RecordOpts gains OPTIONAL `facingMode`
('user' | 'environment') and MediaAPI.start() gains an OPTIONAL { facingMode } argument,
so a video-capture tool can offer a flip-camera control (record the scene, not the selfie).
Both default to 'user'; existing callers and shells that ignore it are unaffected — a
shared/ref-counted media stream keeps its original camera (flip = stop then start).

1.22.0 — additive: DXF export. `emitDxf` (dxf.ts) is a fourth sink on the SVG
vector pipeline (alongside emitEmf / emitEps): it serializes the same normalized
device-px IR into an ASCII DXF R12 (AC1009) document — POLYLINE entities with
béziers flattened to a flatness tolerance, y-flipped and scaled to millimetres
($INSUNITS = 4), colour as a nearest AutoCAD Color Index — for CAD / laser-cut /
vinyl / CNC interchange. Text is outlined upstream (no TEXT entities); the raster
escape-hatch has no line-art form and is dropped (count returned so the shell can
warn). Pure, imports only units.ts; no bridge/host method added or changed.

1.23.0 — additive: PPTX (PowerPoint) export. `buildPptxParts` (pptx.ts) assembles
the OOXML part tree for a deck (content types, relationships, a minimal slide
master + blank layout + theme, presentation.xml, docProps) and serializes each
slide's SHAPES to DrawingML — pic (raster at native res, OR a real embedded SVG via
PowerPoint's asvg:svgBlip extension so vectors extract at full fidelity), text
(editable text box), rect (solid/gradient/border block). The shell walks the DOM
into shapes + media and zips with fflate. Purpose: transport a page's treated
images + vectors into PowerPoint as independent, extractable objects (layout
secondary). Pure: strings + byte arrays, no zip, no DOM, no deps. No bridge change.

1.24.0 — C2PA 2.x claims. buildC2paManifest / embedC2pa / embedC2paInPdf now emit a
v2 claim (`c2pa.claim.v2`) by default — the format Gemini and every current C2PA
validator (c2patool, contentcredentials.org / c2pa-rs) produce and read: no free-text
claim_generator, no dc:format, a REQUIRED single claim_generator_info map, references
split into created_assertions (+ optional gathered_assertions), the actions assertion
relabelled c2pa.actions.v2 (softwareAgent a generator-info map), and the schema.org
CreativeWork author assertion dropped (the 2.x spec removed it). Box UUIDs, the
data-hash / BMFF bindings, the COSE ES256 envelope, the x509 signer, and every
per-format embedder are version-independent and unchanged; the two-pass length-freeze
carries the differently-shaped-but-deterministic v2 claim. buildC2paManifest keeps an
internal `claimVersion` (default 2; `1` builds the legacy c2pa.claim) purely so the
verifier's v1-read path stays test-covered — the embedders never request it, so Lolly
only ever WRITES v2. verifyC2pa now READS both: it branches on the claim box label,
reads created_assertions + gathered_assertions and the single-map claim_generator_info,
and recognises c2pa.actions.v2 — so external v2 credentials (Gemini "Nano Banana",
Adobe, OpenAI, …) verify on-device instead of failing `credential.unreadable`. No
bridge change.

1.25.0 — additive: catalog signing + runtime integrity verification
(catalog-integrity.ts — closes the SOVEREIGNTY.md "catalog origin is a trust
anchor" boundary). A deployment signs its tool catalog at build time
(scripts/sign-catalog.ts writes catalog/tools/index.sig.json: a sha256 per
tool file — hooks.js included — plus a hash of the exact index.json bytes,
ECDSA P-256/SHA-256 over the canonical-JSON envelope; canonicalJson is the
single shared serialization on both sides). A shell that pins the public key
passes loadTool's new optional `integrity` opts ({ envelope, publicKey }):
the loader then verifies every fetched tool file BEFORE the runtime can
compile hooks.js — a tampered, stripped-but-signed, or unsigned-extra file
is a hard ToolLoadError (fail closed; this also closes the tryFetch
silent-strip hole for signed hooks.js/styles.css), and module-hooks tools
are refused outright since their imported bytes never pass through the
loader. Without integrity opts nothing changes except a one-time
"unsigned catalog" console warning (the dev/compat path). Pure engine
module, DOM-free (globalThis.crypto.subtle only); no bridge change.

1.26.0 — additive: honest export action history + ingredient credential
preservation. (1) buildC2paManifest / embedC2pa / embedC2paInPdf accept
`actions` (a C2paActionInput[] — action code + optional digitalSourceType +
description), REPLACING the historic single created/published action; the new
exportActionSteps(format, flags) assembles an honest list from what an export
actually did (c2pa.created + c2pa.color_adjustments on CMYK/brand-palette +
c2pa.edited on print marks / experimental watermark + c2pa.converted on a
raster/video/PDF render — vector/text outputs add nothing). No `actions` →
byte-identical to before. verifyC2pa now surfaces each action's `description`.
(2) `ingredients` (C2paIngredient[] from prepareC2paIngredient /
prepareC2paIngredientFromStore, sourced from extractC2paStore) carry a placed
credentialed asset's manifests VERBATIM into the new store as a MULTI-manifest
store (ingredient manifests before the active one), plus a c2pa.ingredient.v3
assertion (activeManifest hashed-URI) and a c2pa.opened action that propagates
the ingredient's AI/ML digitalSourceType onto the NEW asset's own active
manifest (the opened action also carries parameters.ingredients, and the
c2pa.ingredient.v3 assertion its required validationResults) — so an AI or
camera origin is never laundered away (the AI flag fires from Lolly's signed
actions even if the ingredient manifests are stripped). Bridge (additive):
host.assets.credential?(id) returns a user upload's captured manifest store
(kept at ingest, manifest-only — no pixels/EXIF), and ExportOpts.ingredients
threads it runtime → export. Both the multi-action and multi-manifest outputs
validate as `Valid` in the reference c2patool (contentauth c2pa-rs) — see the
gated conformance test tests/c2pa-c2patool-conformance.test.ts — with only the
expected self-signed untrusted markers.


1.27.0 — richer, self-describing exports + a JPEG multi-manifest read fix.
(1) New summarizeInputs(model) returns a compact scalar-input digest (id →
short string: colours, sizes, toggles, short text; skips uploads, repeating
groups, long text, and profile-bound PII). The runtime derives it when C2PA
stamping is on and threads it via ExportOpts.c2paInputs; each shell records it
(plus the export date + output dimensions) under the tools.lolly.export
assertion, so an inspected asset shows "what it was made from / where / when /
how big". verifyC2pa now surfaces report.environment.inputs (the nested digest,
string→string only). Purely additive — no digest → byte-identical to before.
(2) extractC2paFromJpeg now reassembles the manifest store by APP11 box-instance
(En) + sequence (Z) instead of scanning every segment for the store UUID — an
assertion URL that plants "c2pa" in a continuation chunk no longer trips a false
"more than one manifest store" rejection (multi-manifest JPEGs, e.g. a design
composed from AI-generated ingredients, now verify like their PNG/PDF siblings).

1.28.0 — additive: OKLCH-native brand tokens. brand-derive.ts is the engine's
sRGB↔OKLCH authority (parseOklch/formatOklch/hexToOklch/oklchToHex — with
deterministic chroma-reduction gamut mapping — plus WCAG 2.1 contrastRatio)
and deriveBrandTokens(), which turns one brand colour into a complete layered
DTCG document (base ramps + brand-tinted spectrum + contrast-enforced
light/dark semantic slots) in exactly the shape createTokenSet consumes.
colorToHex now reads oklch()/lch() strings via that module, and the barrel
exports the brand-import container extractors (coerceTokensDoc /
assembleTokenSetFiles / extractPenpotProject / summarizeTokensDoc). Pure
engine modules; no bridge change.

1.29.0 — additive on host.text: TextToPathOpts.variations (HarfBuzz axis
settings, e.g. ['wght=700']) so a VARIABLE face outlines at the run's actual
weight; TextPathResult.notdef (missing-glyph count) so a caller can prefer
its <text> fallback over outlining tofu; and TextToPathOpts.fallbackFonts (an
ordered face chain, shaped segment-by-segment) for the disjoint unicode
subsets a webfont family ships as. All optional; older hosts keep working.

1.30.0 — additive on host.text: TextAPI.axisDefaults() returns a variable
font's default-instance axis values, so a caller that embeds the raw file
into a renderer with no variable-axis control (jsPDF) can tell whether it'll
render at the weight it asked for. Optional; absent on older hosts.

1.31.0 — provenance chains for DERIVED assets. (1) The runtime's export-time
ingredient sweep now also notes library/catalog-sourced asset inputs (source
'library', not just 'user'), so a credentialed CATALOG image placed into a
tool carries its chain — host.assets.credential(id) may serve those ids by
extracting the store from the asset's own bytes (semantics widened, signature
unchanged). (2) c2pa.ts exports C2paActionInput + DIGITAL_SOURCE_TYPE so a
shell can assemble an honest custom history (recolour / colour treatment /
crop / re-encode steps) for embedC2pa — used by the web catalog's download
paths, which now re-sign modified assets with the source credential preserved
as an ingredient instead of shipping unsigned bytes.

1.32.0 — per-swatch print locks, generalized from the primary-anchor-only
override. ColorSwatch gains `spot` (SpotColor: name/book/cmyk), read by
tokens.ts's toSwatch() from the same $extensions["com.suse.lolly"] object as
the existing `cmyk` lock — any colour token, not just the primary ramp's
anchor, can now be locked to an exact process CMYK or a named spot ink.
eps.ts's emitEps() takes an optional cmykPalette (quantised-RGB → CMYK map,
same key scheme as shells/web's buildCmykPaletteMap) so EPS CMYK export can
substitute measured/spot inks like the PDF path already does. print-marks.ts's
PaletteSwatch/BarCell gain `spotName` so the verification colour bar can
annotate a spot-locked cell with its ink name instead of raw CMYK numbers.

1.33.0 — additive: zzfxm.ts renders procedural music (ZzFXM songs, a few KB of
nested arrays) to raw stereo PCM — renderZzfxm(song) plus the vendored zzfxG
(ZzFX Micro synth) / zzfxM (ZzFXM renderer). Pure and DOM-free: the web shell
wraps the PCM in an AudioBuffer for the Neurospicy player (in a Worker) and for
video music beds (OfflineAudioContext); ingest/generator scripts audition
output in Node. One runtime path for hand-authored, MIDI→ZzFXM, MOD→ZzFXM, and
generated tracks — no per-format player, WASM, or soundfonts. No bridge change.

1.34.0 — additive: pdf-svg.ts serializes an interpreted PDF page (pdf-map.ts's
PdfNodes, pre-finalizeBoxes) to ONE standalone SVG document — the "PDF page as
an asset" sibling of the Layout Studio boxes path, sharing the same interpreter
so the two ingest surfaces agree. Raster XObjects arrive pre-decoded from the
shell as data: URIs (opts.images); group ids survive as <g data-group> so a
page SVG re-imported into Layout Studio regroups. Transparent background by
default (PDF "paper" is a viewer convention; .ai vector art shouldn't bake a
white plate). No bridge change.

1.35.0 — additive: deeper, honest capture/text provenance. (1) exportActionSteps
gains `capture` ({camera,microphone}) — a live camera frame or a mic/AV recording
swaps the created step's IPTC source type to the new CAPTURE_SOURCE_TYPE
(digitalCapture) with a "captured/recorded live" description — and `textAdded`
(+`textSample`), appending a c2pa.edited "Added text" step for text placed OVER an
opened asset. The runtime derives both from actual sensor use (onFrame /
stopRecording) and an ingredient being present, threading them via new ExportOpts
c2paCapture / c2paTextAdded. (2) summarizeInputs now includes `longtext` and stores
FULL text (bounded) so the exact rendered copy — a tamper-relevant signal — rides
in the tools.lolly.export digest. No bridge signature change.

1.36.0 — additive: midi.ts converts a Standard MIDI File to a ZzfxSong
(midiToZzfxm / parseMidi + midiToSong) — a DOM-free, bounds-hardened SMF parser +
note→pattern mapper. Feeds the same zzfxm.ts render path as authored/generated
songs, so a .mid uploaded in the web shell (or ingested via scripts/ingest-midi.ts,
which now shares this converter) becomes a tiny format:'zzfxm' asset that plays and
previews everywhere. No bridge change.

1.37.0 — additive: verifyC2pa() gains report.likelyMadeWithLolly — true when
every check passed EXCEPT the hard binding (assertion.dataHash/bmffHash
mismatch: the file's bytes, not the manifest, changed after signing) and the
claim still records a Lolly creation. The claim signature and every
hashed-URI-bound assertion — the actions and export-context digest a report
shows as edit history / "made from" — are still verified, so that content is
trustworthy even though the bytes can no longer be vouched for (a re-saved,
re-encoded, or re-uploaded Lolly export). Always false when madeWithLolly is
already true. No bridge change.

1.38.0 — additive: color-tools.ts, the perceptual metrics + ramp math the
chroma.js evaluation (plans/chroma-eval.md) chose to PORT rather than adopt:
deltaEOk (OKLab distance), apcaContrast (APCA-1.0.98G Lc, advisory — WCAG
2.1 stays the enforced number), rampOklab (bezier through OKLab with
optional correctLightness bisection), classBreaks (equal/log/quantile bins),
and distinctColors (anchor-seeded greedy-maximin categorical palette —
chroma.js has no equivalent). All pure, OKLab-based, gamut-mapped via
brand-derive's oklchToHex. No bridge change.

1.39.0 — additive: gradient-token colour plumbing. (1) brand-derive.ts gains
mixOklch(a, b, t) — perceptual OKLCH interpolation (shortest-arc hue, an
achromatic endpoint adopts the other side's hue) for gradient previews and
midpoint stop seeding. (2) tokens.ts resolveAliases now also resolves
aliases nested inside a gradient-typed token's stops ($value[].color —
scoped composite resolution, cycle-safe, the caller's raw doc left
untouched), so a brand gradient whose stops reference palette swatches
({color.ramp.primary.5}) reaches the CLI and tools as concrete colours
instead of raw alias strings. No bridge change.

1.40.0 — additive on host: `color` (ColorAPI) — the color-tools primitives
behind short tool-facing names (deltaE/apca/contrast/ramp/breaks/distinct),
SYNCHRONOUS pure math. Shells attach the engine's makeColorApi() verbatim,
so the implementation can never drift between web/CLI/Tauri. Not gated by a
capabilities flag (progressive enhancement — tools feature-detect
host.color and keep a small fallback for older shells). First consumers:
chart-creator + d3 brand-driven series palettes (color.spectrum.* tokens
first, distinct() top-up, shipped palette fallback).

1.41.0 — additive: multi-language groundwork. (1) lang.ts is the shared
canonical language table (LANGS: en/es/de/fr/zh/ja/vi, LANG_META for
native/English names + <html lang> values, normalizeLang for informal
aliases like `cn`/`jp`) used by url-mode.ts, Profile, and tool-manifest i18n
sidecars alike. (2) url-mode.ts gains the reserved `lang` param — parsed with
alias normalization, serialized (omitted for the English default), never a
tool input. (3) Profile (packages/core/src/host-v1.ts) gains `lang?: string`,
a legal `bindToProfile: "lang"` target, riding the same profile record as
every other per-user preference. No bridge signature change; the engine
still emits zero user-facing English itself — all display text originates in
manifests/templates, which may now ship a per-tool i18n sidecar (see loader.ts).

1.42.0 — additive: 7 more LANGS entries — pt (Brazilian Portuguese, htmlLang
pt-BR), zh-hant (Traditional Chinese, htmlLang zh-Hant — distinct from zh's
Simplified/zh-Hans), cs (Czech), nl (Dutch), tl (Tagalog), sv (Swedish), ms
(Malay). New ALIASES: br/pt-br/pt_br→pt, tw/hk/zh-tw/zh-hk/zh-hant-tw/hant→
zh-hant, my→ms, fil→tl. Purely additive to the LANGS/LANG_META/ALIASES
tables — no signature change on url-mode.ts, Profile, or the loader's i18n
overlay, all of which already iterate LANGS generically.

1.43.0 — additive: baked assets + the shared compose guard (bake.ts). (1)
bakeAssetRef freezes a composed render (a renderUrl result whose bytes ride
in a data: URL, capped at MAX_BAKED_URL_CHARS) into a static asset: id
'baked/<base36 ms>', meta { baked, bakedAt, bakedFrom? } — provenance for
on-demand re-baking — with meta.toolUrl (the live-edit key) and any
blob:-valued meta removed. The runtime resolves an isBakedRef value AS-IS
(no bridge call, no compose-stack growth — a baked embed consumes no compose
depth and never live-re-renders); URL mode serializes its bakedFrom so a
share-link recipient degrades to a live re-render — top-level assets AND
block sub-fields alike (assetIdForUrl / blocksForUrl, exported so shell
serializers share the one degradation policy). DroppedAsset gains an
optional `reason` ('render-failed' / 'not-found' / 'baked-bytes-lost'). (2)
assertComposeStack / ComposeGuardError / MAX_COMPOSE_DEPTH move the per-shell
cycle/depth guards into the engine so every bridge shares one policy.
Forward-compat: an OLDER engine re-resolves a baked id via assets.get, which
fails ('baked/…' is in no catalog), so the slot drops gracefully. (3) One
more LANGS entry — ro (Romanian, htmlLang ro) — purely additive to the
LANGS/LANG_META tables, same shape as the 1.42.0 additions. No bridge
signature change.

1.44.0 — additive: ar (Arabic, htmlLang ar) — the first right-to-left
LANGS entry. LangMeta gains an optional `dir?: 'rtl'` field (absent ⇒ ltr);
consumers that stamp <html lang> from LANG_META must now stamp `dir` from
the same entry (web shell i18n.ts/index.html pre-paint, docs/build.ts).
New ALIASES: ar-sa/ar-eg/ar-ae → ar. Purely additive — no bridge signature
change; url-mode's `lang` param, Profile.lang, and the loader's sidecar
overlay all iterate LANGS generically.

1.45.0 — additive: vector + windowed page capture. (1) CaptureSpec gains
`crop` (0..0.9 trim insets, the TUI's url-capture semantics promoted onto
the bridge — applied by the HOST at capture time, so the returned ref's
width/height already reflect the trim) and `rangeTo` (extend the shot below
`scrollDepth` into a tall strip for scroll-pan videos; callers derive the
pan distance from the RESULT dims, so a host that ignores/clamps the field
degrades to a shorter or static pan, never an error). Hosts that predate
both fields ignore them via their deserializers — old shell + new tool
stays a plain viewport shot. (2) CaptureAPI gains optional `vector(spec)`:
print the page to a true vector document and return it as a self-contained
SVG AssetRef (type 'vector'), windowed identically to page(). Feature-
detected (like compose.renderUrl); the web stub and the extension bridge
simply don't grow it. (3) pdf-svg.ts gains windowPdfSvg (crop a pdfNodesToSvg
document to a sub-rect via viewBox — pure string surgery, no DOM), exported
for the shells that window a vector capture. (4) HOOK_BUDGET_MS is now
re-exported from the engine index so a shell that fulfils `capture` natively
can raise the beforeExport budget (the documented "shells with unusual
needs" escape hatch) without a deep runtime.ts import. No bridge signature
change; every addition is optional/ignorable.

1.46.0 — additive: LangMeta gains an optional `flags?: readonly string[]` (1–3
ISO 3166-1 alpha-2 country codes per language, most-representative first — en →
gb/us/au) plus a pure `flagEmoji(cc)` helper (country code → regional-indicator
emoji). Purely additive garnish for language pickers — the nativeName stays the
accessible label, older consumers ignore the field, and no bridge signature
changes. Every LANG_META entry is populated; the field is typed optional so a
future language without flags still validates.

1.47.0 — additive: hi (Hindi, htmlLang hi, Devanagari, ltr) — one more
LANGS/LANG_META entry, ordered before ar in the picker. New ALIASES:
hi-in → hi. Purely additive, same shape as the 1.43/1.44 language
additions — no bridge signature change; url-mode's `lang` param,
Profile.lang, and the loader's sidecar overlay all iterate LANGS
generically.

1.48.0 — additive: three LANGS/LANG_META entries — bn (Bengali, htmlLang bn,
Bengali script), ur (Urdu, htmlLang ur — the SECOND rtl language after ar;
consumers that stamp dir from LANG_META need no change, hand-mirrored maps
like the web shell's pre-paint script must add it), and id (Indonesian,
htmlLang id — distinct register from ms/Malay). New ALIASES: bn-bd/bn-in → bn,
ur-pk/ur-in → ur, and in/in-id/id-id → id (`in` is Indonesian's deprecated
ISO 639-1 code, still emitted by Android WebViews). Purely additive — no
bridge signature change.

1.49.0 — additive: LangMeta gains a required `speakers` field (approx. total
speakers in millions, picker-sort data — not a census) and lang.ts gains
sortedLangs(LangSort)/LangSort — the shared language-picker orderings used
by every language menu (web shell + /info site): 'speakers' desc = default,
az = nativeName A–Z. No bridge signature change.

1.50.0 — additive: design-map de-brands. mapFontFamily/mapWeight/nodeToBox/
finalizeBoxes accept optional DesignMapOptions ({ fonts: { defaultFamily,
monoFamily, monoMaxWeight }, seedColors: { boxBg, textFg, imageBg } }) so the
SHELL supplies the target tool's font vocabulary + addKinds seed colours from
the active brand pack; the engine's built-in defaults are the neutral
lolly-start values ('sans'/'mono', mono capped at 800). Box.font widens
'SUSE'|'SUSE Mono' → string. Existing callers compile unchanged (options are
optional); un-threaded callers now emit the neutral vocabulary instead of
SUSE's. The PPTX theme (pptx.ts themeXml) likewise drops the hardcoded brand
accents for lolly-start-spectrum neutrals (accent1-3 + hlink; theme-picker
data only — rendered shapes carry explicit colours). Brand hex values now
grep clean of engine/src; the frozen DTCG vendor key 'com.suse.lolly'
(tokens.ts TOKEN_EXT / brand-derive.ts VENDOR_EXT) deliberately stays — it
is a permanent serialization contract, renameable only via dual-read.

1.51.0 — additive: LANGS/LANG_META entry tr (Turkish, htmlLang tr, Latin
script, ltr — no RTL work; latin-ext font subset already kept). New ALIASES:
tr-tr/tr-cy → tr (regioned navigator.language tags). Purely additive, same
shape as the 1.47/1.48 language additions — no bridge signature change;
hand-mirrored maps (web shell pre-paint HTML_LANG) must add it.

1.52.0 — additive: LANGS/LANG_META entries uk (Ukrainian, Cyrillic script —
cyrillic font subset already kept) and pl (Polish — latin-ext already kept);
both ltr, no RTL work. New ALIASES: uk-ua/ua → uk, pl-pl → pl. Also fixes
applyManifestI18n: an option label whose manifest `value` is the empty
string (e.g. a "Default" choice) was untranslatable — the overlay-key
matchers required ≥1 char after "options." and silently skipped the key;
they now accept the empty value (mirrored in scripts/validate-catalog.ts).
No bridge signature change; hand-mirrored maps (web shell pre-paint
HTML_LANG) must add the two new languages.

1.53.0 — release-freeze hardening (plans/action-plan.md). (1) loadTool now
ENFORCES a manifest's `engineVersion` range: a tool whose range excludes the
running ENGINE_VERSION is REFUSED, not warned (P0-3) — the load-bearing floor
of the fast-catalog / slow-binary model. New dependency-free range check in
semver-range.ts (satisfiesRange); no `semver` dep added. (2) New
session-record.ts (sessionVersionStamp / migrateSessionRecord /
SESSION_FORMAT_VERSION): every saved-session record now carries formatVersion
+ engineVersion, and the state bridges read them through a migrate-or-warn
branch on load (P0-5). Both purely additive to the engine surface; no bridge
signature change. ENGINE_VERSION also moves to version.ts (re-exported here)
so the loader can read it without an index↔loader import cycle.

1.54.0 — additive: DISPLAY capture on host.recorder. (1) RecordOpts gains
`source: 'device' | 'screen'` (default 'device', so every existing caller is
byte-for-byte unchanged) + `systemAudio`, so a screen recording is the same
RecordSession a camera take is. (2) New RecorderAPI.still(StillOpts) → Blob:
one frame, source released immediately — a screenshot has no session to stop.
(3) isAvailable() accepts 'screen'. (4) New `screen` capability + render.capture
value 'screen' (both schema copies). The browser's own picker is the selection
UI — a page cannot enumerate, name, or pre-answer it — so the engine never
learns what a display source IS, only the bytes the user chose to hand over.

1.55.0 — additive: PPTX speaker notes. PptxSlide gains an OPTIONAL `notes`
string; buildPptxParts (pptx.ts) emits a p:notes part per noted slide plus one
shared notesMaster, and wires the slide→notesSlide rel, the notesMasterIdLst
and the content-type Overrides. Gated on the note being non-blank, so a deck
without notes is byte-for-byte unchanged. Three OOXML traps found against real
PowerPoint decks, not the spec prose: notesMasterIdLst must precede sldIdLst
(CT_Presentation is an xsd:sequence); a theme part is 1:1 with a master, so the
notes master needs its OWN theme2.xml (sharing theme1 is a known repair
trigger); and a notesSlide relates only to the notesMaster — the slide→notes
direction is the sole binding. The web shell's renderPptx reads each note from
a display:none [data-slide-notes] node, so tools opt in with pure tool data.

1.56.0 — additive: PPTX native rich elements (feeds the `presentation` tool; the
engine stays DOM-free and brand-free). Three additions to pptx.ts, all opt-in so a
deck that uses none is byte-for-byte unchanged: (1) rich text — PptxPara gains
bullet (round/number/custom-glyph), 0–8 indent `level`, line/space spacing, and
PptxRun gains `underline`; a bare {runs, align} still serializes to the old
`<a:pPr algn>`. (2) native tables — a new PptxTable shape emits an inline a:tbl in a
p:graphicFrame (header row, per-cell fill/border/align, colSpan/rowSpan merges via a
rectangular hMerge/vMerge grid) needing NO extra part/rel/content-type. (3) themed
master from VALUES — PptxBuildOpts.theme (hexes + font names the shell resolves from
brand tokens) overrides the neutral clrScheme/fontScheme in theme1.xml (+ notes
theme2.xml); the engine never reads tokens or a brand pack. OOXML order traps
respected: a:pPr children (lnSpc→spcBef→spcAft→bullet), a:tcPr fill AFTER the four
borders, p:xfrm prefix vs a:off/a:ext. Deferred (separate track, spec saved): native
c:chart — the `presentation` tool composes our chart tools (d3/org-chart/chart-
creator) into vector pictures instead.

1.57.0 — additive: NATIVE-vector PPTX for flat SVG art. (1) pptx.ts gains a `path`
shape (PptxPath) — arbitrary M/L/C subpaths lowered to a:custGeom / a:pathLst
(moveTo/lnTo/cubicBezTo/close) inside one a:path w=cx h=cy, solid fill + solid
stroke; all subpaths collapse into one path so holes cut out. (2) new svg-custgeom.ts
`svgToCustGeomPaths(svgText, targetW, targetH)` — a DOM-free scan that walks the tag
stream, tracks the group transform stack + inherited fill/stroke/stroke-width,
converts path/rect/circle/ellipse/line/polygon/polyline to `d`, and maps coords
through (group transforms) ∘ (viewBox → target EMU) into PptxPath[]; returns null
(→ raster fallback) on gradients/filters/masks/clip-paths/opacity/blend/image/text/
use/style/currentColor/unknown-named-colour/rotate-or-skew/unreadable-viewBox, so a
non-flat SVG never regresses. The web shell's export-pptx tries it first for an
<svg>/SVG <img>/SVG background and emits native shapes when it succeeds. Reuses
parseSvgPath + colorToHex; no bridge/host method added or changed.

1.58.0 — additive: pptx rebrand bridge. New optional host.pptx (PptxAPI):
inspect() reads an uploaded .pptx (slide count, theme, literal colours/fonts
with nearest-brand suggestions) and rebrand() surgically re-themes it
(pptx-patch) — shells unzip/rezip with fflate and inject DOMParser; engine
stays zip- and DOM-free. New suggestRebrandTheme in brand-map.ts maps brand
swatches onto the 12 clrScheme slots.

1.59.0 — additive: C2paReport.partsMadeWithLolly — an INTACT credential whose
active manifest isn't a (likely) Lolly creation but whose preserved provenance
chain records Lolly steps (a Lolly export later edited/re-signed by another
tool). Surfaced as the amber "Parts made with Lolly" pip/pill in /verify and
`~ Parts made with Lolly` in `lolly validate`. Also: file-metadata.ts reads
bare-XMP IPTC DigitalSourceType + Credit (JPEG/PNG/SVG + MP4/QuickTime uuid
box) into FileMetadata.ai — the declaration layer behind the AI banner and
the SynthID/Meta likelihood pips.

1.60.0 — additive: four contract pieces for the Wave-2 surface plays, all
optional/feature-detected. (1) host.color gains schemes(seedHex, kind?) —
the brand editor's pure harmony generator (brand-schemes.ts
generateSchemeAccents; kinds complement/adjacent-3/triad-3/tetrad-4/
free-2..4, default 'complement') attached to makeColorApi(), so a tool
(Palette Lab) generates scheme accents without shipping colour science;
SCHEME_KINDS stays the barrel export for shell picker UIs. (2) New optional
host.images (ImagesAPI) — CONTRACT ONLY this minor: decode (bytes|Blob →
oriented dims + sniffed mime), resize (maxEdge / fit-within, never
upscales), encode (convert to webp/jpeg/png) — the web bridge's existing
HEIC decode + bomb-guarded resize machinery to be exposed the host.pdf way;
DOM-free bytes-in/bytes-out, shells implement in a later pass. (3) host.text
gains optional fontUrl(family, {weight?, italic?}) — CONTRACT ONLY: resolve
an installed/registered family to a fetchable font file plus the
variable-font `variations` needed to hit the requested weight, so a
wordmark-style tool can drive toPath() from a family name. (4) The ZzFXM
composer moves into the engine: new zzfx-compose.ts (composeSong + the
PRESETS/SCALES bank, body verbatim from scripts/lib/zzfx-music.ts, which is
now a re-export shim) — pure and deterministic, renders via the existing
renderZzfxm, so shells can generate music beds/tracks at runtime. No v1
method changed. Plus a barrel-only addition: brand-treatments.ts
(derivePhotoTreatmentsDoc / deriveIconThemesDoc) — pure, deterministic
derivation of a brand's photo-treatments + icon-themes palette docs from its
token document (or resolved swatches) via the OKLCH machinery, consumed by
scripts/ingest-brand.ts and the lolly-start neutral set so blank/ingested
brands get real treatment/theme strips instead of inert ones.

1.61.0 — additive: HDR raster export. New engine module hdr.ts —
hdrBoostToPQ(rgba, opts) transforms an 8-bit sRGB canvas render into
Rec.2100-PQ code values in place, boosting pixels that match the active
brand's primary colours (passed in as `targets` — brand-agnostic, the engine
never derives them) toward peak luminance so they glow on HDR displays. The
boost is a hue-preserving luminance multiplier gated on OKLab lightness: mid-
and-above colours punch to peak (white hits it; a saturated mid primary isn't
far behind), rolling off below mid so dark primaries are calmed, not blown out
(dark areas stay dark and give the glow its contrast). Near-white is a default
target so white text glows. Barrel exports pqEncode + the HDR_PQ_CICP tuple.
color.ts gains pqBt2020IccProfile() — a generated ICC v4 BT.2020+PQ display
profile whose `cicp` tag (9,16,0,1) is the HDR signal colour-managed apps key
off (JPEG); the shared ICC layout was factored into buildIcc() and the sRGB
builder now rides it (byte-identical output). Pure/DOM-free; shells apply the
transform to canvas pixels and embed the profile / PNG cICP chunk at export.
No v1 method changed.

1.62.0 — additive: crop culling for the page-SVG path. pdf-svg.ts gains
cullPdfNodes(nodes, win) — drops the interpreted nodes that provably cannot
paint inside a crop rectangle — plus pdfNodeExtent(n) (the axis-aligned
page-space box containing every pixel a node can paint, or null when it can't
be bounded) and pdfNodeElementKind(n), the serializer's element dispatch
extracted so the two can never drift. Purpose: a cropped capture (the docs
screenshot pipeline, capture.vector(), any windowed page export) spends nearly
all of its bytes and seconds on a handful of enormous nodes — a re-sourced
canvas raster, a ShadingType-1 tile — so culling BEFORE the shell decodes
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
    to whichever font the renderer resolves — so a wrapped paragraph or any
    full-width script paints past it. The vertical band (fontSize-derived) still
    culls, and the docs path outlines text anyway, which is exact.
  • OUTLINED text is bounded by scanning its glyph path data per line — exact, no
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

1.63.0 — additive: real /Luminosity soft-mask support, so a CSS box-shadow
finally RENDERS in a vector page capture instead of being dropped. New
pdf-smask.ts (pure: maskRegion / relativeLuminance / constantMask /
isShadowPlate / isAchromatic). PdfResources.extgstates.smask widens from a
boolean to a four-state field whose richest form is the new PdfSoftMaskDef — an
ExtGState /SMask pre-decoded by the SHELL into a content stream + resources,
i.e. the same shape as a form XObject (PDF 32000-1 §11.6.5.2). The interpreter
re-runs that group through ITSELF, so a raster mask, a gradient mask and a
vector mask are one code path with no classifier, and the mask's own images
arrive as ordinary imageKeys the shell resolves through the existing `images`
record — no bytes cross the boundary. Nodes carry the result as the new shared
PdfNode._softMask, and pdf-svg emits a deduped <mask maskUnits="userSpaceOnUse"
style="color-interpolation:sRGB"> whose children go through the serializer's own
renderNode (so gradients, clips, rasters and even-odd rules work inside a mask
for free); /S /Alpha becomes mask-type="alpha". Four-rung ladder, monotone —
nothing renders worse than before at any rung: a real <mask>; a group that is
one flat rect over its bbox folds to a constant alpha with no <mask> at all; a
group that paints nothing is exactly a black mask, so the paint is dropped; and
a group that is refused (over budget, >64 nodes, mask-in-mask, /TR, /BC ≠ 0,
degenerate /BBox, or an undecodable group) falls back to the pre-existing
translucent+achromatic shadow-plate heuristic, now the last resort rather than
the answer. Fuzz-guarded for untrusted input: 96 distinct (mask, CTM)
evaluations per page, 64 nodes per group, an in-flight set that breaks a
self-referential group, a hard one-level nesting cap, and no throw path — every
refusal is an onWarn plus the previous behaviour. Also recovers CSS gradients
that carry alpha (Chromium encodes them as a one-cell tiling pattern whose body
installs the alpha ramp as a mask), which the tiling collapse used to discard
whole. No v1 method changed.

1.64.0 — additive: `host.geom`, the tool-facing face of the vector geometry kernel
(engine/src/geom/). New optional GeomAPI + `makeGeomApi()` in the new geom-api.ts,
attached verbatim by the web and CLI/TUI bridges like `color`, so the surface cannot
drift between shells. Path booleans over a whole selection (union / intersect /
difference / xor, folded left to right, fill rule selectable, plus `selfUnion` for the
canonical form of one path), `offset`, `stroke` (stroke-to-fill outline with SVG's own
cap/join/miter-limit defaults), `fromNodes` + `continuity` (authored-spline lowering
and the handle-drag constraint a pen tool runs on every drag), `encodeAuthored` /
`decodeAuthored` (the authored path's WIRE form — one field value, delimiter-safe by
construction so it survives the compact `blocks` URL format whose `,`/`~` separators
cannot be escaped; on the bridge because an editor writes it, a tool's `hooks.js` reads
it and neither may share code any other way. A value carries one path or SEVERAL,
`*`-separated, because an `AuthoredPath` holds exactly one `nodes` run and a great many
shapes are not one run — a boolean subtract punches a hole. `*` is unreserved under
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
    tool silently stop responding. The codes keep every distinction the kernel makes —
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
  geom-api validates the grammar first in one linear, recursion-free forward pass —
  512k chars, 20k commands, 16k normalised curves, 64 operands, ±1e9 coordinates, a
  required leading moveto, a known command vocabulary, argument runs that are a whole
  number of groups, terminated number tokens, and a finiteness sweep over the
  normalised output — and rejects rather than guesses. Q/T raise to cubics by exact
  degree elevation and A decomposes by the spec's endpoint parameterisation (F.6.5,
  radii scaled per F.6.6) into one cubic per ≤90° sweep, both unchanged from the shared
  tokenizer. No v1 method changed.

1.65.0 — additive: canvas time-field mappings (timeline time model) on the blocks
input's `canvas` schema config — `startField`, `durField`, `clipInField`, `speedField`,
`enterField`, `exitField`, `enterMsField`, `exitMsField`, `muteField`, `laneField`.
These are pure schema/documentation additions (optional string properties naming
which box sub-fields hold timing data), phase 1 of the Fable timeline editing work
(`plans/fable-timeline-phase-1.md`) — inert until a shell mounts a timeline panel
that reads them; a manifest declaring none of them, or a template rendering an
untimed box, is byte-identical to before. No v1 method changed, no runtime behaviour
changed by this entry alone.

1.66.0 — additive: reserved `cuts` param for contact-sheet still exports. `cuts` joins
the RESERVED set in `src/url-mode.ts` (parsed into `UrlState.cuts`, serialisable via
`SerializeUrlOpts.cuts`), turning a still export (`png`/`jpg`/`webp`/`svg`/`pdf`) of a
timed composition into N frames sampled across the sequence — raster/SVG zipped, PDF as
one N-page document. Sampling is MIDPOINT (`t_i = duration × (i + 0.5) / N`, the exported
`cutTime` helper), never endpoint, so no frame lands on the blank card at t=0 or the
all-clips-ended state at t=duration. The value is clamped to 1…`CUTS_MAX` (64) and every
junk input (non-numeric, 0, negative, NaN, Infinity) degrades to 1 rather than throwing.
Default `cuts=1` is the playhead frame — byte-identical to a link without the param, so
every existing URL and every untimed tool is unaffected. Phase 2.5 of the Fable timeline
work (`plans/fable-timeline-editing.md` §4.6). No v1 method changed.

1.67.0 — additive: the `zzfxm:<seed>[:<style>]` asset-id scheme (`src/zzfxm-ref.ts`,
exported as `ZZFXM_SCHEME`, `ZZFXM_ARCHETYPES`, `isZzfxmRef`, `parseZzfxmRef`,
`formatZzfxmRef`). A PROCEDURAL asset: the id names a song the shell synthesises from
the seeded composer in `src/zzfx-compose.ts` rather than a file the catalog stores, so
it resolves to ITSELF — a ref whose `url` IS the id — and the seed reaches the audio
mix through the one `resolveAssetRefs` path preview and export share. This is the
engine's vocabulary for the same reason `src/tool-url.ts` is: every shell that resolves
an asset id has to recognise the scheme, and they must not each invent the rule (the
web and CLI bridges both consume it). The parser is strict — leading zeros and seeds
past uint32 are refused rather than folded — so `parse(format(x))` is byte-stable and a
shared link's bed can never be silently repointed at a different tune. `composeSong`
now also pins `zzfxG`'s `randomness` parameter to 0 on every instrument it emits, so a
preset authored with a short array cannot re-enable per-render detuning and break seed
determinism. No v1 method changed; no runtime resolution behaviour changed (a shell
that does not recognise the scheme behaves exactly as before).

1.68.0 — additive: CSS-correct colour interpolation + the gradient spec. Two optional
`host.color` methods (`mix`, `gradientCss`) plus the engine primitives behind them
(`src/css-color.ts` `interpolateColor` / `gradientStops`, `src/gradient-spec.ts`).

`interpolateColor` implements CSS Color 4 §12–13 properly: interpolation in a chosen
space (default OKLab), the four hue directions, missing-component carry-over, and —
the part that is easy to skip and visibly wrong when you do — PREMULTIPLIED alpha. A
per-channel lerp toward `transparent` drags the colour toward transparent's *black*, so
a red→transparent midpoint came out dark red at 50% instead of plain red at 50%. That
defect was live in the SVG/EMF conic-gradient fan (`conicFanEl` in the web shell's
export bridge), which lerped raw channels and therefore disagreed with what the browser
painted for the same element; it now routes through this one interpolator. Note the fan
still interpolates in **sRGB** deliberately — that is what a plain CSS gradient
specifies, so matching the browser means staying there.

`gradient-spec.ts` is the wire format for an authored gradient — one URL-safe string
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

No v1 method changed. Both new methods are optional — a tool must feature-detect
(`host.color?.gradientCss`) since its declared `engineVersion` range may admit an older
engine.

1.69.0 — additive: display-gamut classification and OKLCH slice planes. New engine
module `src/gamut.ts` (pure, no DOM, no canvas) plus three optional `host.color`
methods: `gamut(color)` → `'srgb' | 'p3' | 'rec2020' | 'none'`, `maxChroma(l, h,
limit?)`, and `slice(opts)` → RGBA bytes for one 2D plane through OKLCH space.

The engine already mapped out-of-gamut colours back into sRGB (`gamutMapOklch`,
CSS Color 4 §14.2), which answers "what will this become?". This answers the two
questions a brand designer actually asks next: *how far out is it*, and *would a
wider display carry it?* — "outside sRGB but fine on P3" is a different decision
from "no display can show this". The P3 and Rec.2020 tests are pre-composed 3×3
matrices from linear sRGB (shared D65 white, so no chromatic adaptation), reusing
brand-derive's Oklab core rather than carrying a second set of matrices.

`maxChroma` is the honest, hue-dependent ceiling — at L 0.7, sRGB gives yellow-green
~0.22 and cyan ~0.12, and P3 widens the reds/greens by >20% while barely moving the
blues. That per-hue asymmetry is why a fixed chroma cap makes lopsided ramps, and why
the charts are worth drawing at all.

`slice` exists as a bridge primitive, rather than each surface painting its own, so the
brand studio's gamut charts and the Colour Lab utility tool cannot drift about where
sRGB ends. It returns 8-bit sRGB, so pixels past sRGB are painted GAMUT-MAPPED — the
caller draws the real boundary from `maxChroma`/`sliceGamutEdge` on top, because the
boundary line is the information and the fill out there is an approximation.

No v1 method changed. All three are optional — a tool must feature-detect
(`host.color?.slice`) since its declared `engineVersion` range may admit an older engine.

1.70.0 — additive: ICC profiles as gamuts. A new hardened reader (`src/icc.ts`) plus
`src/gamut-source.ts`, which factors the membership question out of `src/gamut.ts`, and
four optional `host.color` methods: `iccProfile(bytes, intent?)`, `inProfileGamut`,
`profileMaxChroma` and `inkCoverage`.

**This reverses the engine's earlier "no ICC transforms" position, deliberately.** Until
now `src/color.ts` only ever WROTE profiles — it generates sRGB and Rec.2100-PQ bytes for
an export to carry — and `rgbToCmyk` is a naïve GCR-free separation with the press
condition declared in an OutputIntent rather than applied (see `src/pdfx.ts`: a CMYK
intent is registry-name only, "X-4 ready" not conformant — no longer the whole story
as of 1.74, which lets a caller supply profile bytes). The reasoning was that
applying a profile means shipping a colour engine, and the engine is meant to stay
dependency-free and small. That reasoning held for *export*, where declaring the space
the pixels were made in is the honest thing to do and converting into someone else's
press is not our call. It does not hold for the question a brand designer asks before
sending a palette to a printer: **will this colour print?** Nothing in the engine could
answer it. `gamut()` reports the three DISPLAY gamuts, and a press is none of them — a
swatch can sit comfortably inside sRGB and still be unreachable in CMYK, and the naïve
separation will cheerfully hand back four numbers that say nothing about whether the ink
exists. Answering it needs a real profile evaluated, so the reader is in.

What made it affordable is that it is a *reader*, not a colour engine: `mft1`/`mft2`/
`mAB `/`mBA ` all reduce to one ordered stage pipeline (curves / matrix / CLUT) with a
single evaluator, plus matrix/TRC and `kTRC` for the profiles that have no LUT at all.
No dependency, no shipped profile bytes — the profile is the user's own file, the one
their print shop sent them.

`gamut-source.ts` is the seam that keeps this from being a second colour system.
`gamut.ts` only ever asked one thing of a gamut ("is this OKLCH colour reproducible?")
and built the chroma ceiling, the slice fills, the boundary curves and the 3D solid on
top of that single predicate. So a gamut is now a predicate plus an identity
(`GamutSource`), the three display gamuts are sources over the SAME pre-composed
matrices they always used, and `iccGamutSource(profile, intent)` is a fourth kind that
drops into every one of those functions unchanged — `inGamut`, `maxChroma`, `oklchSlice`,
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
one, so a 320×200 `oklchSlice` against a press profile is ~85ms — render it on a profile
change, not under a drag.

`inkCoverage` is the one question a matrix cannot answer and a printer must. Its unit is
channels (1.0 = one ink at full, so process CMYK reaches 4.0 — the trade's 400% TAC),
deliberately not normalised to 0–1: a pressroom limit is written as 300% or 340% of that
total, and dividing by the channel count would discard the only figure a printer would
recognise. RGB sources return null rather than a made-up zero.

No v1 method changed. All four are optional — a tool must feature-detect
(`host.color?.iccProfile`) since its declared `engineVersion` range may admit an older
engine. The handle a tool receives is inert data; the profile's tables never cross the
bridge, and a handle the host did not issue gets the no-answer result (null / false / 0)
rather than an answer computed against some other profile. `usable` is the gate to check
first, and it means "this profile can answer a membership question under this intent" —
which needs the REVERSE transform, not merely a tag for the intent (`iccGamutIntent`), so
the abstract profiles that carry A2B0 alone report false instead of an empty gamut behind
a valid label.

Pure additions since, no version bump (the `HostV1` contract is untouched, so there is
no minor to name): `fastRgbContains` in `src/gamut-source.ts` — a built-in gamut's
membership test with the name comparison and the domain guard hoisted out of the loop,
for the per-pixel callers — and `src/gamut-tier.ts` (`gamutTier`, `gamutTierProbe`,
`BEYOND_TIER`, `GAMUT_TIER_LADDER`), which answers "which ring OUT of the active gamut"
so the picker's broken tracks and the Colour Lab sliders paint the unreachable stretches
as concentric washes from one classifier instead of two. A tier is always a `contains`
answer, never an index into an ordering: Display-P3 is not inside Rec.2020.

1.71.0 — additive: `host.audio`, audio analysis. Decoded sound in, a per-frame
reactivity track out — RMS, a bass/mid/treble split at butterchurn's own crossover
frequencies, a log-spaced magnitude spectrum, spectral centroid, onset flux, a
tempo, beat times, and optionally raw time-domain windows.

It exists because the only audio a tool could previously reason about was LIVE:
`recorder.meter` reports the microphone one sample at a time. Anything drawing a
finished clip — an audiogram, a music video, a spectrum — has to know frame 200's
bass while it is still drawing frame 1, so it needs the whole clip analysed up
front. Lacking that, the audiogram tool decoded audio itself off `window.
OfflineAudioContext`, reduced the entire track to a handful of static peak buckets,
and faked reactivity with a Gaussian bump travelling under a playhead. That is why
it never ran headlessly and why nothing about it was testable.

DOM-free contract like `images`: a URL, an AssetRef or raw encoded bytes in, plain
typed arrays out. The shell owns the DECODER (the web shell's `decodeAudioData`, the
CLI's WAV reader plus `renderZzfxm`); the MATHS is the engine's `analysePcm`, which
shells attach rather than reimplement — so the browser and the CLI read the same
numbers off the same clip. `fftInPlace` (iterative radix-2, 30 lines, no dependency)
is exported alongside it and pinned against an analytically-known spectrum.

Three decisions in the result shape, each load-bearing:

  • **Struct-of-arrays.** A minute at 60fps is 3,600 frames. As objects that is
    3,600 allocations for a draw loop to chase; as `AudioFrames` it is a few flat
    Float32Arrays, with `magnitude` and the `wave*` arrays as `count` consecutive
    rows.
  • **`bass`/`mid`/`treb` share ONE normalisation scale.** Normalised independently
    a bass-only clip divides its own near-silent treble by itself and reports treble
    pinned at 1.0 — a full-height treble bar for an 80Hz sine. The split is a
    balance, so the loudest band reads 1 and the others read their share of it.
    `peak` alone stays absolute, so a tool can still see that a source clipped.
  • **`bpm` is `null` when there is no rhythm to find**, and that is the common
    answer for speech, ambience and pads. The estimator autocorrelates the onset
    flux over 60–180 BPM and refuses below a share of the track's own variance,
    because a visual built on a wrong beat grid looks far worse than one built on
    none. Beats are then anchored on the strongest onset and stepped outward —
    walking fixed windows from frame 0 instead drops any window that happens to
    fall between two hits, which prints double-length gaps into a metronome-steady
    click train.

Raw `wave`/`waveL`/`waveR` windows are opt-in (`opts.samples`) because they dwarf
everything else — 2,048 bytes × 3 channels × every frame — and only a sample-domain
visualiser needs them. 2048 is butterchurn's `fftSize`, and the bytes are already in
its 0..255-centred-on-128 form, so a MilkDrop preset can be driven frame-exactly off
a decoded file through `render({ audioLevels })` instead of a live AnalyserNode. That
is what makes a reactive WebGL visual DETERMINISTICALLY exportable rather than
something you can only screen-record in real time.

Optional/additive and not capability-gated: a tool feature-detects `host.audio` and
falls back to a static waveform. No v1 method changed.

1.72.0 — additive: `host.viz` — the MilkDrop visualizer as something a TOOL can use,
not just the app's own audio dock.

Two questions a tool genuinely cannot answer for itself, and nothing else:
`isAvailable()` (WebGL2, synchronous, so a hook can branch on it before deciding what
to analyse) and `presets()` (id, name, AUTHOR, calm). Deliberately not a mounting API:
a tool is data, it has no element to hand over and no business holding a GL context.
It renders a `[data-lolly-viz]` placeholder carrying its parameters and the shell
enhances it after paint, the same contract `[data-lottie-src]` and `video[data-video-key]`
already use — which is also what lets the canvas, its context and its loaded preset
survive the innerHTML rebuild every keystroke causes. Remounting per paint would burn
a WebGL2 context each time, and browsers drop the oldest past ~16: the tool would go
black a dozen edits in with nothing logged.

`author` is in the contract because the artist presets are the point. Twenty years of
MilkDrop craft ships alongside our own eval-free ones, and a tool showing one is
expected to say whose it is — on the exported card, not in the UI around it.
Attribution is only emitted for a preset the shell CONFIRMS it has, since a pack that
isn't staged falls back to a brand-native preset and a credit line naming an artist
whose work is not on screen is worse than none.

The reason this lands as a contract rather than a shell feature is 1.71's opt-in
`samples`: MilkDrop's renderer takes injected time-domain bytes (`render({ audioLevels })`)
and only reads its own AnalyserNode when given none. So the visual becomes a function
of (preset, palette, frame index) instead of of what the speakers are doing, and a
video export matches the audio track rather than the render machine's frame rate.
Three traps paid for in black canvases: the injected window must be EXACTLY
butterchurn's `fftSize` of 1024 (`numSamps * 2`, not the 2048 the 1.71 note claims) —
longer throws RangeError inside the renderer, shorter silently leaves the previous
frame's tail behind; the frame `elapsedTime` must be a constant 1/fps, because the
preset clock advances by 1/fps and damps its estimate toward what it is told, so real
deltas make the same frame index render differently on a busy machine; and the WebGL2
context has to be acquired with `preserveDrawingBuffer` BEFORE the visualizer is
constructed, since a second `getContext` returns the first context and ignores the new
attributes — without it `toDataURL` (how dom-to-image snapshots a canvas) reads a
buffer the compositor already cleared and every exported frame is blank.

MilkDrop is a feedback simulation, so a frame rendered cold is a near-empty field —
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
and the tool draws its ordinary canvas style — the audiogram falls back to `bars` and
still renders headlessly. No v1 method changed.

1.73.0 — additive: `'profile'` joins the `AssetRef['type']` union (and both copies
of `asset.schema.json`) — an ICC colour profile the USER supplied, stored as an
ordinary user asset at `user/profiles/<digest>` where `<digest>` is the same
16-hex SHA-256 prefix `icc.ts` puts in a `GamutSource.id`. That content-addressed
id is the point: re-adding the same file overwrites rather than duplicating, and a
shared `?limit=icc:<digest>:<intent>` link finds a locally stored profile by
construction. No new bridge method — the profile rides the user-asset rail that
already carries fonts and tokens, so the storage meter, data export, backup
restore and clear-all all cover it with no wiring.

A profile has no visual form: it is a gamut to compare against, not something to
place. Surfaces that tile images filter it out exactly as they already filter
`font` and `tokens`. No v1 method changed.

Also additive in this minor: `ExportOpts.audio.start`, the music bed's in-point in
seconds. A tool whose visuals begin partway through a clip (the audiogram's "Start
at") could already analyse from there, but the exported video's sound still started
at 0:00 — picture and audio disagreed. A looping bed now repeats the [start, end)
region rather than the whole track: `loopStart` defaults to 0, so a wrap would
otherwise replay the head the visuals deliberately skipped. Out of range degrades to
0 with a logged warning rather than exporting silence. Absent, it is 0 and nothing
about an existing export changes.

1.74.0 — additive: a PDF/X-4 output intent can carry an embedded
DestOutputProfile for a CMYK press condition. `pdfxOutputIntentSpec` gained
`iccBytes` / `components` / `identifier` / `registry` options — the engine never
reads a profile store, so a caller that HAS the bytes (the web shell, from a
profile the user loaded on their own device) supplies them, and a caller that has
none (the CLI) passes nothing and gets exactly the previous registry-name intent.
`registry: null` omits RegistryName, which is what the standard's `Custom`
identifier requires: a profile that proves no registered characterization is
declared under its own name rather than borrowing one.

Two new pure rules, here rather than in a shell because what X-4 requires is the
engine's business: `pdfxProfileEligibility(facts, 'CMYK' | 'RGB')` (device class
`prtr`, the intent's own colour space, /N ∈ {1,3,4}, ICC 2.x–4.2) and
`iccCharacterization(bytes)` — the `FILE_DESCRIPTOR` line of an ICC's `targ` tag,
i.e. the characterization data set the profile SAYS it was built from. That is
testimony, not measurement; it pairs a profile with a condition, it does not prove
the numbers. No v1 bridge method changed.

1.75.0 — additive: PDF text reconstruction. `extractPageText(nodes, {width,
height})` turns the positioned glyph runs `interpretPdfPage` produces into
reading-ordered prose (lines, columns, paragraphs, headings, list items) with a
`markdown` and a plain `text` rendering, and `joinPageText(pages)` joins them
into a document. No OCR and no second parse: a born-digital PDF already contains
its glyphs and their positions, so this is reassembly, not recognition. A page
that is a scanned image reports `scanned: true` with no text, so a caller can
say "this needs OCR" rather than "this page is blank".

Column detection is deliberately biased toward ONE column — reading a single
column as two destroys prose, whereas reading two as one merely interleaves it —
and a table is separated from a real multi-column layout by requiring each column
to be wider than the gutter beside it.

Also a decoding FIX in `pdf-map.ts`, which changes existing output: a simple font
with no /ToUnicode used to fall back to byte→code-point (Latin-1), so WinAnsi
(CP1252) bytes 0x80-0x9F decoded to invisible C1 control characters. That range
is exactly where English publishing keeps its punctuation, so bullets, en/em
dashes, ellipses and smart quotes were silently lost — from extracted text AND
from the Layout Studio / design-import path. They now decode correctly. No v1
bridge method changed.

1.76.0 — additive: failed-redaction detection. `findHiddenText(nodes)` reports
text that an OPAQUE shape is painted over — words present in the file that the
page does not show. `findHiddenTextInPages(pages)` tags findings by page and
`describeHiddenText(findings)` summarises them.

The check rests entirely on PAINT ORDER, which is what separates a redaction from
a highlight: a filled box painted BEFORE text is a background, the same box
painted AFTER it is a cover. `interpretPdfPage` returns nodes in the order the
content stream painted them and never sorts them; tests/pdf-redaction.test.ts
pins that invariant deliberately, because a sort added upstream would silently
invert every result rather than fail.

Coverage is the UNION of the overlapping shapes, not the largest one and not
their sum — a line struck out in several pieces is covered by no single bar, and
summing would double-count wherever bars overlap. Translucent shapes (<90%
opacity) and soft-masked shapes are refused: neither can be vouched for as
actually concealing. Colour is deliberately NOT a criterion — a white box over
black text hides it exactly as well as a black one, and a colour test would miss
the quieter version of the same mistake.

The finding claims only "present but not visible", never intent; the cause could
be a botched redaction or ordinary sloppy layering, and callers should keep that
wording. No v1 bridge method changed.

## 1.77.0 — a brand colour's faces, and the sRGB one wins at export

`color-faces.ts`: one canonical value per brand colour plus per-target overrides,
keyed by target id (a CSS space name, or `icc:<digest>:<intent>`). The
generalisation of the shipped `cmyk`/`spot` print lock to every space and press —
`readFaces`, `writeFace`, `colorFaces`, `faceDrift`, `canonicalValue`.

`ColorSwatch` gains optional `faces` (additive; v1 keeps working), and its `value`
now returns an **authored sRGB face** in preference to the automatic bake. That is
one line in `toSwatch` rather than a change per export path, because every
consumer of a brand colour funnels through that field — and it is what stops an
override being decoration. The reason the narrow face must win: CSS Color 4
§14.2's map picks the nearest reproducible colour by ΔE, while a brand will often
prefer a DIFFERENT sRGB green, one that reads as the same brand colour to a human
even though it is not the closest by measurement.

Only sRGB is substituted into `value`. A wider face cannot go into a hex-typed
field without being baked itself, which would discard exactly what it was authored
to carry, so those ride in `faces` untouched.

Two things a reader should not assume. An override keyed to a profile that is not
currently mounted is KEPT, not pruned — dropping it because a profile was
unplugged is data loss, and the failure would be silent. And a PRESS face is not
yet consulted by the CMYK export paths: those target a `CMYK_CONDITIONS` name
while a face is keyed by profile identity, and those are different id spaces.
Bridging them is where the `cmyk` lock migrates onto this model.

Also `gamut.ts`'s `encodeOklch` (one colour encoded for a canvas colour space, on
the same ceiling grid `oklchSlice` paints from, so a filled vector shape and a
painted pixel cannot disagree), `gamut-solid.ts`'s `projectSolidPoints` (a batch
projector — the single-point form rebuilds the camera per call, which scans every
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

1.77.0 — additive: TAGGED reading order, plus two content-stream parser fixes it
depended on.

`extractPageText(nodes, { tagged })` takes a page's `/StructTreeRoot` elements in
document order (`TaggedElement[]`, flattened by the shell, which owns the PDF
object walk) and assembles blocks from the structure instead of from geometry.
Geometry still joins runs into lines INSIDE an element — within one paragraph,
position genuinely does say what follows what — but everything geometry cannot
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
    optional-content layer name — `/OC /MC0 BDC` grouped correctly while
    `/OC /MC0 <</MCID 0>> BDC` did not. That affected Illustrator layer grouping
    in the design-import path, not only this feature.
  • The dictionary scanner counted `<<`/`>>` with no string awareness, so a `>>`
    inside a literal (`/ActualText (a >> b)`) closed the dictionary early and the
    remainder was mis-tokenized as operators. `/ActualText` is exactly what a
    tagged PDF writes there, so tagged files could actively corrupt parsing.

No v1 bridge method changed.

## 1.78.0 — the table input, and pages that make themselves

Additive: batch creation as a first-class engine concern.

  • `table` input type — a user-defined grid ({ columns, rows }, all strings)
    where the column headings AND the rows are user DATA, unlike `blocks`
    (manifest-declared fields). `normalizeTableValue` keeps every grid
    rectangular on the way into the model. In URL mode a table is always ONE
    compact param (header segment + one tilde segment per row, cells
    percent-escaped — encodeTableCompact/decodeTableCompact, JSON accepted on
    parse). New module `table-text.ts` carries the text ⇄ table round-trip
    (TSV / Markdown pipe / RFC 4180 CSV parse + TSV/Markdown/HTML serialise)
    shared by the web sidebar's spreadsheet paste and the CLI's
    `--<inputId>-data=file` import.
  • `render.paginate: { source: '<tableInputId>' }` — engine-driven pagination:
    the runtime hydrates the template once per row, each wrapped in its own
    `[data-pdf-page]` box, with a per-page `page` context object
    (index/number/count, `first`, `cells`, `fields`). Tools author ONE page and
    never manage pagination; the existing paged canvas/PDF/pptx paths see N
    pages. Reference tool: community/battlecards (hook-free).

No v1 bridge method changed.
