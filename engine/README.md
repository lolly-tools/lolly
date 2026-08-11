# `@lolly/engine`

The platform-agnostic core of Lolly. It loads a tool manifest, builds the input model from it, resolves asset references, runs the tool's hooks, hydrates the Handlebars template, and drives the export. Everything a render needs that is *not* a platform capability lives here, which is why the same tool produces the same output from the web PWA, the Tauri desktop and mobile shells, the CLI and the TUI.

The engine ships as source. `main` is `./src/index.ts` and there is no build step: Node runs the TypeScript directly via native type-stripping, Vite and esbuild handle it for the web shell. Its only runtime dependencies are `handlebars`, `ajv` and the workspace tool-author SDK `@lolly-tools/core`.

## The three-layer separation

```
engine/     ← this package. Knows nothing about brands, the DOM, storage or networking.
shells/     ← host implementations. Each provides a capability bridge the engine calls into.
community/  ← brand-agnostic tool definitions (manifest + template + hooks). Data, not code.
brands/     ← brand packs: tools and catalog content for one brand.
```

Two rules hold that separation up.

**Tools never import from the engine.** A tool is data: `tool.json`, `template.html`, optional `styles.css` and `hooks.js`. Hooks receive the host bridge and call `host.*`. That is what lets a tool ship without an app update and run unchanged on every shell.

**The engine never touches a platform.** No `document`, no `window`, no `fetch` at module scope, no filesystem, no storage. Anything platform-specific is injected at runtime by the shell through the bridge. Where a capability only some hosts can provide, it is gated by a `capabilities` flag in `tool.json` and the shells that cannot fulfil it expose a stub or an error.

The compiler only partly enforces this. [`tsconfig.json`](tsconfig.json) sets `"lib": ["ES2023", "DOM", "DOM.Iterable"]`, and the comment there records why: `DOM` is present **only** for the fetch-spec globals that browsers and Node both have, meaning `Blob`, `Response`, `RequestInit` and `URL`, plus `URLSearchParams.entries()` iteration in `url-mode.ts`. It is not a licence to reach for a renderer. The no-`document` rule is enforced in review, not by the compiler, so a reviewer noticing `document.` or `window.` in a diff under `engine/src/` is the actual gate. `"types": []` keeps Node's typings out for the same reason, which is why co-located `*.test.ts` files are excluded from this project's typecheck and are typechecked by the root `tsconfig` instead.

## The `ENGINE_VERSION` contract

[`src/version.ts`](src/version.ts) exports `ENGINE_VERSION`, the HostV1 *contract* version: what level of the bridge this engine implements. Read the live value there rather than trusting a number quoted in prose anywhere, including in this file. It is deliberately decoupled from any product or release version, and `engine/package.json`'s `version` tracks it (`scripts/pack-engine.ts` asserts the two match before packing).

The policy is additive-only within v1, and [`CHANGELOG.md`](CHANGELOG.md) has one entry per minor explaining what was added. Methods may be **added** in a minor version. They are never removed and never change signature without a major bump, and when v2 ships v1 must keep working.

This is not documentation-only. Since 1.53 `loadTool` enforces a manifest's `engineVersion` range against `ENGINE_VERSION` using `src/semver-range.ts`: a tool whose declared range excludes the running engine is refused rather than loaded. Widening the contract is therefore cheap and narrowing it breaks installed tools.

## The capability bridge

The canonical definition of the v1 contract is [`packages/core/src/host-v1.ts`](../packages/core/src/host-v1.ts), 2246 lines, published as the tool-author SDK `@lolly-tools/core` so a third party can build tools against the exact interface without depending on the engine at all.

[`src/bridge/host-v1.ts`](src/bridge/host-v1.ts) is 17 lines and holds no types of its own. It is a header comment restating the two rules above, plus a single line:

```ts
export type * from '@lolly-tools/core/host-v1';
```

Engine and shell code keeps importing `HostV1` and its sub-types from that path unchanged, and the package exposes it as the `./bridge/v1` export. Edit the contract in `packages/core`, never here. `docs/host-api.md` is the prose guide to what the bridge offers a tool author.

## Security posture

Most of the module table below is parsers: C2PA, PDF, PPTX, ICC, X.509/DER, TIFF, WebP, MIDI, MOD, ZIP. They read bytes that arrived from somewhere untrusted, which makes them the engine's real attack surface. Two documents cover that surface and should be read before changing any of them:

- [`docs/threat-model.md`](../docs/threat-model.md): trust boundaries, what is assumed hostile, and what the engine promises.
- [`docs/parser-inventory.md`](../docs/parser-inventory.md): every byte-level parser, its entry point and its hardening state.

`tests/fuzz/` holds the fuzz harness: `targets.ts` declares one entry per fuzzed parser with a seed corpus of valid inputs built from the engine's own writers, `mutate.ts` and `prng.ts` drive deterministic mutation, and `tests/fuzz/regressions/` pins the cases that once failed. The Fuzzed column below is generated from those declared targets, so a parser showing `–` there has no fuzz coverage yet.

One more thing worth knowing before you read `runtime.ts`: hooks are loaded with `new Function('host', …)`, which is closure-scope injection and **not** a sandbox. Hook code still runs in the realm's global scope, so in a browser shell it can reach `window` and `document`. `host.*` is the intended path, not an enforced boundary, and third-party tool code is not safe to run until Worker isolation ships.

## How to find your way around

Eight modules are the engine proper. Read them in roughly this order:

| Module | Why it matters |
|---|---|
| `index.ts` | The barrel, and the definition of the public surface. Shells import from here; tools never do. It is excluded from the table below because it is re-exports only. |
| `loader.ts` | Fetches and validates a tool, applies manifest i18n, enforces the `engineVersion` range. |
| `runtime.ts` | One mounted tool's lifecycle: load, build the input model, resolve assets, run `onInit`, hydrate, export. Owns the hook patch semantics and the `HOOK_BUDGET_MS` time-boxing. |
| `inputs.ts` | The single source of truth for input semantics. Shells render the model generically and never interpret manifest declarations themselves, which is how web, Tauri and CLI stay consistent. |
| `template.ts` | Handlebars hydration, the custom helpers, and `annotateTemplate` for mapping rendered nodes back to sidebar controls. Logic-less by design. |
| `validate.ts` | Manifest validation against `schemas/tool.schema.json`. |
| `url-mode.ts` | Every input expressed as URL params, plus the reserved param list. The CLI is this same path under a different transport, so GUI and CLI cannot drift. |
| `units.ts` | Physical-unit maths (`parseDimension`, `toPixels`, `toPoints`, `toCssLength`). The single source of truth each shell's export bridge applies per format. |

Everything else is a format or feature module, and the families are easier to navigate than the flat list suggests:

- **Provenance and trust**: `c2pa*.ts`, `seal.ts`, `contentseal.ts`, `trustmark.ts`, `x509.ts`, `der-read.ts`, `pixel-watermark.ts`, `watermark-search.ts`, `steganalysis.ts`, `file-metadata.ts`, `strip-metadata.ts`, `metadata.ts`.
- **Colour and gamut**: `color*.ts`, `css-color.ts`, `gamut*.ts`, `icc.ts`, `hdr.ts`, `bake.ts`, `image-cloud.ts`, `gradient-spec.ts`.
- **Brand and tokens**: `brand-*.ts`, `tokens.ts`, `design-map.ts`, `icon-theme.ts`, `photo-treatment.ts`.
- **Document and container formats**: `pdf*.ts`, `pptx*.ts`, `eps.ts`, `emf.ts`, `dxf.ts`, `tiff.ts`, `apng.ts`, `webp-anim.ts`, `zip-crypto.ts`, `media-sniff.ts`, `video-meta.ts`, `print-marks.ts`, `pdfx.ts`.
- **Geometry**: `geom/*.ts` with `geom-api.ts` as its façade, plus `svg-path.ts`, `svg-colors.ts`, `svg-custgeom.ts`, `css-box.ts`, `css-paint.ts`.
- **Audio**: `audio-analyse.ts`, `wav.ts`, `midi.ts`, `zzfxm.ts`, `zzfx-compose.ts`, `zzfxm-ref.ts`.
- **Plumbing**: `bytes.ts`, `batch.ts`, `compose.ts`, `tool-url.ts`, `url-pack.ts`, `embed.ts`, `lang.ts`, `fs-token.ts`, `session-record.ts`, `catalog-integrity.ts`, `data-import.ts`, `semver-range.ts`, `version.ts`.

## Module map

The table is generated. Run `node scripts/gen-engine-modules.ts` after adding, removing or renaming a module, and `node scripts/gen-engine-modules.ts --check` to fail on drift. Purpose comes from each file's leading doc comment, so the way to improve a row is to improve that comment.

<!-- engine-modules:start -->
**156 modules** under `engine/src/` (excluding the `index.ts` barrel): 141 re-exported from `index.ts`, 129 with a dedicated `tests/*.test.ts`, 21 covered indirectly, 6 with no coverage under `tests/`, 18 wired into the fuzz corpus. Generated by `node scripts/gen-engine-modules.ts` — do not hand-edit between the markers.

| Module | Lines | Purpose | Public? | Test | Fuzzed |
|---|--:|---|:--:|---|:--:|
| `apng-decode.ts` | 258 | APNG demuxer — pure, DOM-free, platform-agnostic. | yes | `tests/apng-decode.test.ts` | – |
| `apng.ts` | 194 | APNG packer — pure, DOM-free, platform-agnostic. | yes | `tests/apng.test.ts` | – |
| `audio-analyse.ts` | 539 | Audio analysis — decoded PCM in, a per-frame reactivity track out. | yes | `tests/audio-analyse.test.ts` | – |
| `bake.ts` | 149 | Bake — freeze a composed render into a static asset, plus the shared compose recursion policy (the depth/cycle guard every shell bridge enforces). | yes | indirect | – |
| `batch.ts` | 186 | Batch — the shared, DOM-free contract for "many URL-mode rows under one file". | yes | none | – |
| `bmp.ts` | 258 | BMP (Windows Bitmap) — uncompressed BI_RGB encoder + decoder. | yes | `tests/bmp.test.ts` | – |
| `brand-derive.ts` | 787 | Brand derivation — OKLCH-native colour math + the semantic-token generator behind the lolly-start onboarding (plans/archive/brand-token-contract.md). | yes | `tests/brand-derive.test.ts` | – |
| `brand-import.ts` | 583 | Brand token ingestion — container extraction for the three shapes Penpot (and Tokens Studio) export the SAME token document in: | yes | `tests/brand-import.test.ts` | – |
| `brand-map.ts` | 425 | Brand mapper — the "make a foreign document look intentionally on-brand" primitives (plan track E3, plans/49-fable-new-potential-pptx.md §E3). | yes | `tests/brand-map.test.ts` | – |
| `brand-schemes.ts` | 166 | Brand scheme accents — a pure, deterministic accent-colour generator for the Lolly brand generator's harmony picker. | yes | `tests/brand-schemes.test.ts` | – |
| `brand-treatments.ts` | 249 | Brand-derived photo treatments + icon duo themes. | yes | `tests/brand-treatments.test.ts` | – |
| `bridge/host-v1.ts` | 23 | Capability Bridge — v1 (re-export). | no | indirect | – |
| `bytes.ts` | 75 | Shared byte-level primitives for the engine's binary/crypto format modules (c2pa, c2pa-verify, seal, x509, zip-crypto, pdf-crypto-r6, …). | no | none | – |
| `c2pa-containers.ts` | 1340 | C2PA container placement — the per-format byte-splicing side of the writer: classic-xref PDF incremental update, the png/jpeg/gif/svg/tiff/webp embedders, ISO BMFF (mp4) with its own c2pa.hash.bmff.v2 binding, and the… | no | `tests/c2pa-containers.test.ts` | yes |
| `c2pa-extract.ts` | 917 | C2PA structural extraction — the read side's format-sniffing, CBOR decoding, JUMBF-store walking, and per-container manifest extraction (pdf/png/jpeg/gif/ svg/tiff/webp/mp4/webm/mp3/wav), plus the ingredient-preparation… | no | `tests/c2pa-extract.test.ts` | yes |
| `c2pa-trust.ts` | 1496 | Vendored C2PA trust anchors — the root/anchor certificates whose signing chains verifyC2pa() upgrades from "valid" to TRUSTED (a named, CA-verified signer). | yes | `tests/c2pa-trust.test.ts` | – |
| `c2pa-verdict.ts` | 257 | C2PA verdict resolution — the single source of truth for (a) the check-code vocabulary verifyC2pa emits, (b) the flags→verdict ladder every surface renders, and (c) trust-anchor assembly. | yes | `tests/c2pa-verdict.test.ts` | – |
| `c2pa-verify.ts` | 1031 | C2PA (Content Credentials) verifier — pure, DOM-free. | yes | `tests/c2pa-verify.test.ts` | yes |
| `c2pa.ts` | 809 | C2PA (Content Credentials) manifest builder + PDF embedder — pure, DOM-free. | yes | `tests/c2pa.test.ts` | – |
| `captions.ts` | 129 | Captions — spoken-word timings in, subtitle cues out. | yes | `tests/captions.test.ts` | – |
| `catalog-integrity.ts` | 241 | Catalog signing + runtime integrity verification — the SOVEREIGNTY.md "catalog origin is a trust anchor" gap, closed. | yes | `tests/catalog-integrity.test.ts` | – |
| `cmyk-palette.ts` | 120 | The brand-swatch → CMYK lookup every CMYK sink shares. | yes | none | – |
| `color-curve.ts` | 205 | color-curve.ts — a serializable tonal-curve model for brand colour ramps. | yes | `tests/color-curve.test.ts` | – |
| `color-describe.ts` | 221 | One colour, fully described — the join between css-color.ts (which already parses and converts 14 CSS Color 4 spaces) and gamut.ts (which knows what a display can actually show). | yes | `tests/color-describe.test.ts` | – |
| `color-faces.ts` | 255 | A brand colour's FACES: one canonical value, plus what it becomes in every space and on every press it can be expressed in. | yes | `tests/color-faces.test.ts` | – |
| `color-tools.ts` | 727 | Colour tools — perceptual metrics and ramp math on top of brand-derive's OKLab core. | yes | `tests/color-tools.test.ts` | – |
| `color-vision.ts` | 211 | Colour-vision-deficiency (CVD) simulation — Machado, Oliveira & Fernandes (2009). | yes | `tests/color-vision.test.ts` | – |
| `color.ts` | 387 | Colour profiles for exports — platform-agnostic, no DOM, no network. | yes | `tests/color.test.ts` | – |
| `compose.ts` | 177 | Compose — resolve a tool's manifest `composes` entries into embeddable assets. | no | `tests/compose.test.ts` | – |
| `connectors.ts` | 640 | Connector / line / arrow geometry — the ONE source (plan 90 R1). | yes | indirect | – |
| `contentseal.ts` | 168 | Meta Content Seal (Pixel Seal / Video Seal, IMAGE mode) — the pure, message-free consensus decision (DOM-free, no ONNX, no network). | yes | `tests/contentseal.test.ts` | – |
| `css-box.ts` | 429 | Pure, DOM-free CSS box-model + border-radius geometry. | yes | `tests/css-box.test.ts` | – |
| `css-color.ts` | 972 | One CSS Color 4 colour value — the engine's single source of truth for parsing, converting, gamut-mapping and serialising colour. | yes | `tests/css-color.test.ts` | – |
| `css-paint.ts` | 465 | Pure, DOM-free CSS "paint" value parsers: clip-path basic shapes, gradient stops + radial-gradient geometry, and drop-shadow filters. | yes | `tests/css-paint.test.ts` | – |
| `dash-fit.ts` | 263 | Dash fitting — manual dash entry, and Illustrator-style corner-fit dashes (plan 96). | yes | `tests/dash-fit.test.ts` | – |
| `data-import.ts` | 230 | Data-file → blocks rows. | yes | `tests/data-import.test.ts` | yes |
| `deep-encode.ts` | 98 | deep-encode — one place that turns a linear {@link DeepFrame} into finished image bytes at the depth the caller asked for. | no | indirect | – |
| `deflate.ts` | 837 | Raw DEFLATE compressor + zlib wrapper — the byte-emitting half the engine was missing. | yes | `tests/deflate.test.ts` | – |
| `der-read.ts` | 120 | DER/ASN.1 read-side authority — the bounds-checked TLV walker plus the ECDSA signature-shape conversions and the EC named-curve table, shared by the certificate/signature modules (c2pa-verify.ts, x509.ts, seal.ts). | no | `tests/der-read.test.ts` | yes |
| `derived-formats.ts` | 45 | Derived export formats — the ones that are a trivial, lossless transform of a format a tool already declares, so a tool that can emit the parent can emit the child for free. | yes | `tests/derived-formats.test.ts` | – |
| `design-components.ts` | 326 | Penpot component definitions → template descriptors (pure collectors). | yes | `tests/design-components.test.ts` | – |
| `design-map.ts` | 2156 | Design-file → Layout Studio boxes (pure mapper). | yes | `tests/design-map.test.ts` | – |
| `design-version.ts` | 485 | design-version.ts — the pure model behind versioned design systems (plans/97 §6a). | yes | `tests/design-version.test.ts` | – |
| `docx.ts` | 177 | DOCX (Word / WordprocessingML OOXML) builder — pure, DOM-free, platform-agnostic. | yes | `tests/docx.test.ts` | – |
| `dxf.ts` | 189 | DXF (AutoCAD Drawing Interchange) emitter — pure, DOM-free, platform-agnostic. | yes | `tests/dxf.test.ts` | – |
| `embed.ts` | 73 | Embed URL grammar — the portable surface of tool composition. | yes | `tests/embed.test.ts` | – |
| `emf.ts` | 464 | EMF (Enhanced Metafile) emitter — pure, DOM-free, platform-agnostic. | yes | `tests/emf.test.ts` | – |
| `eps.ts` | 221 | EPS (Encapsulated PostScript) emitter — pure, DOM-free, platform-agnostic. | yes | `tests/eps.test.ts` | – |
| `epub-read.ts` | 258 | epub-read.ts — READ an EPUB back to titled chapters of markdown text. | yes | `tests/epub-read.test.ts` | – |
| `epub.ts` | 172 | EPUB 3 writer — pure, DOM-free, platform-agnostic. | yes | `tests/epub.test.ts` | – |
| `exr.ts` | 505 | OpenEXR encoder — scanline, HALF (float16) or FLOAT (32-bit), NONE/ZIPS/ZIP. | no | `tests/exr.test.ts` | – |
| `file-metadata.ts` | 908 | Embedded-metadata reader | yes | `tests/file-metadata.test.ts` | yes |
| `font-convert.ts` | 327 | Font container interconversion — TTF/OTF ⇄ WOFF1, DOM-free and synchronous. | yes | `tests/font-convert.test.ts` | – |
| `fs-token.ts` | 40 | Reversible, filesystem-safe token codec — pure string logic, no storage, DOM, or platform coupling (it just maps a string to a safe token and back). | yes | `tests/fs-token.test.ts` | – |
| `gainmap-jpeg.ts` | 528 | Gain-map JPEG assembly — the container half of plans/61-deeprichpixels.md §6 B2. | no | `tests/gainmap-jpeg.test.ts` | – |
| `gainmap.ts` | 396 | Gain maps — the ISO 21496-1 / Adobe "one file, two renditions" math (deeprichpixels plan §4.2, §6 B2, §8 row "gain maps spread beyond JPEG/AVIF"). | no | `tests/gainmap.test.ts` | – |
| `gamut-axis.ts` | 122 | How high a CHROMA AXIS has to reach for a given gamut — the one number every chroma scale in the UI is drawn against. | yes | `tests/gamut-axis.test.ts` | – |
| `gamut-solid.ts` | 614 | The gamut SOLID — a display's whole reachable colour volume as a rotatable 3D surface in OKLCH. | yes | `tests/gamut-solid.test.ts` | – |
| `gamut-source.ts` | 284 | Where a gamut COMES FROM — the membership question behind gamut.ts, factored out so it need not be one of three hard-coded RGB matrices. | yes | `tests/gamut-source.test.ts` | – |
| `gamut-tier.ts` | 100 | How far OUT of the active gamut a colour is — "which ring", not "in or out". | yes | `tests/gamut-tier.test.ts` | – |
| `gamut.ts` | 542 | Display-gamut classification for OKLCH colours — which of sRGB, Display-P3 or Rec.2020 can actually show a given lightness/chroma/hue. | yes | `tests/gamut.test.ts` | – |
| `geom-api.ts` | 684 | `host.geom` — the tool-facing face of the geometry kernel (HostV1 v1.64). | yes | `tests/geom-api.test.ts` | – |
| `geom/authored-url.ts` | 316 | The wire form of an `AuthoredPath` — what a pen shape looks like inside one `blocks` sub-field, and therefore inside a share link. | yes | indirect | – |
| `geom/bezier.ts` | 472 | Cubic Bézier kernel — the geometric substrate for boolean operations, offsetting and stroke outlining. | yes | `tests/geom-bezier.test.ts` | – |
| `geom/boolean.ts` | 1413 | Boolean operations on regions bounded by cubic Béziers — union, intersection, difference, exclusive-or — and the winding-number test they are all decided by. | yes | `tests/geom-boolean.test.ts` | – |
| `geom/fit.ts` | 1261 | Fitting cubics to a curve that has no Bézier form — an exact offset, a stroke edge, a distorted path. | yes | `tests/geom-fit.test.ts` | – |
| `geom/intersect.ts` | 418 | Curve intersection — the operation every boolean, offset and stroke outline is built on, and the one that decides whether the whole geometry layer is clean. | yes | `tests/geom-intersect.test.ts` | – |
| `geom/offset.ts` | 1297 | Offsetting — moving a path a fixed distance sideways, which is what an inset/outset, a shadow ramp and (through stroke.ts) an outlined stroke are all made of. | yes | `tests/geom-offset.test.ts` | – |
| `geom/path.ts` | 224 | The path model the geometry operates on, and its conversions to and from the rest of the engine. | yes | indirect | – |
| `geom/spiro.ts` | 430 | Spiro — Raph Levien's Euler-spiral interpolating spline, the one Inkscape and FontForge ship. | no | `tests/spiro.test.ts` | – |
| `geom/spline.ts` | 1040 | The seam between an AUTHORED path and the cubics geometry runs on. | yes | `tests/geom-spline.test.ts` | – |
| `geom/stroke.ts` | 375 | Stroke outlining — the region a stroked path paints, as a fillable path. | yes | `tests/geom-stroke.test.ts` | – |
| `gradient-spec.ts` | 255 | The Lolly gradient spec — one terse, URL-safe string describing a gradient, and the CSS it bakes down to. | yes | `tests/gradient-spec.test.ts` | – |
| `gzip.ts` | 420 | gzip (RFC 1952) — the member wrapper around raw DEFLATE, plus a self-contained inflater so a `.gz`/`.svgz` can be read back without a platform decoder. | yes | indirect | – |
| `hdr.ts` | 444 | HDR raster export — brand-colour highlight boost + PQ (SMPTE ST 2084) encoding. | yes | `tests/hdr.test.ts` | – |
| `icc-pixels.ts` | 482 | ICC profiles applied to deep pixel buffers — the digiKam act (deeprichpixels §3, §5.1): input profile → PCS → working/output space, per pixel, over a {@link DeepFrame}. | yes | `tests/icc-pixels.test.ts` | – |
| `icc.ts` | 1390 | ICC profile reader — the authority for "what can this device actually print?". | yes | `tests/icc.test.ts` | yes |
| `ico-decode.ts` | 273 | Windows ICO / CUR reader — picks the LARGEST image in the directory and decodes it to RGBA. | yes | `tests/ico-decode.test.ts` | – |
| `icon-theme.ts` | 204 | Two-colour themable icons. | yes | `tests/icon-theme.test.ts` | – |
| `image-cloud.ts` | 272 | An image's colours as a point cloud in OKLCH, plus what the distribution says. | yes | `tests/image-cloud.test.ts` | – |
| `inputs.ts` | 692 | Builds a runtime input model from a tool manifest. | yes | indirect | – |
| `jpeg-segments.ts` | 372 | JPEG marker-segment walker and writer — one shared primitive, DOM-free. | no | `tests/jpeg-segments.test.ts` | – |
| `keyframes.ts` | 986 | Keyframe tracks, the `kf` wire grammar, and the depth-camera projection — the shared, DOM-free maths every consumer of plans/104 trusts. | yes | `tests/keyframes.test.ts` | – |
| `lang.ts` | 171 | Supported UI/content languages, shared by the `lang` reserved URL param (url-mode.ts), `Profile.lang`, tool-manifest i18n sidecars, and every shell's language picker. | yes | indirect | – |
| `loader.ts` | 470 | Tool loader. | yes | indirect | – |
| `media-sniff.ts` | 235 | Pure, DOM-free media classification from header bytes. | yes | `tests/media-sniff.test.ts` | yes |
| `metadata.ts` | 85 | Export provenance — the generic authorship record embedded into every exported media file (platform-agnostic; no format/DOM knowledge here). | yes | `tests/metadata.test.ts` | – |
| `midi.ts` | 169 | Standard MIDI File → ZzFXM. | yes | `tests/midi.test.ts` | – |
| `odt.ts` | 181 | OpenDocument Text (.odt) writer — pure, DOM-free, platform-agnostic. | yes | `tests/odt.test.ts` | – |
| `ogg.ts` | 199 | Ogg (RFC 3533) page + Opus comment-header primitives, shared by the C2PA write side (c2pa-containers.ts placeOgg) and the read side (c2pa-extract.ts extractC2paFromOgg). | no | indirect | – |
| `packbits.ts` | 97 | PackBits run-length coding (TIFF 6.0 §9) — the byte compression Photoshop calls "RLE" for PSD channel data (compression method 1) and TIFF uses for Compression=32773. | yes | `tests/packbits.test.ts` | – |
| `palette-export.ts` | 157 | Palette exchange — serialise a flat list of named colours as a standalone file in one of several interchange formats: a DTCG design-tokens JSON (nested under each swatch's canonical dotted key), a plain CSS… | yes | `tests/palette-export.test.ts` | – |
| `pdf-artwork.ts` | 310 | Vector artwork detection — finding the logos in a page full of shapes. | yes | `tests/pdf-artwork.test.ts` | – |
| `pdf-crypto-r6.ts` | 180 | PDF Standard Security Handler — revision 6 (R6), AES-256 (ISO 32000-2 §7.6.4, originally Adobe's "ExtensionLevel 3"). | yes | `tests/pdf-crypto-r6.test.ts` | – |
| `pdf-map.ts` | 2036 | PDF (and Adobe Illustrator .ai — an .ai IS a PDF) page content stream → DesignNodes. | yes | `tests/pdf-map.test.ts` | yes |
| `pdf-redaction.ts` | 228 | Failed-redaction detection — text that is in the file but not on the page. | yes | `tests/pdf-redaction.test.ts` | – |
| `pdf-smask.ts` | 169 | Pure helpers for PDF soft masks (ExtGState /SMask — PDF 32000-1 §11.6.5.2). | yes | `tests/pdf-smask.test.ts` | – |
| `pdf-svg.ts` | 915 | PDF page → standalone SVG serializer (pure, DOM-free). | yes | `tests/pdf-svg.test.ts` | – |
| `pdf-text.ts` | 691 | PDF text reconstruction — positioned glyph runs → reading-ordered prose. | yes | `tests/pdf-text.test.ts` | – |
| `pdfx.ts` | 288 | PDF/X-4 metadata authority — pure strings + small descriptor objects, no PDF byte-wrangling. | yes | `tests/pdfx.test.ts` | – |
| `photo-treatment.ts` | 176 | Colour treatments for raster photo assets — the raster analogue of the two-colour icon themes in ./icon-theme.ts. | yes | indirect | – |
| `pixel-watermark.ts` | 468 | Lolly pixel watermark — block-DCT spread-spectrum | yes | `tests/pixel-watermark.test.ts` | – |
| `pixels.ts` | 473 | Deep pixel buffers — the engine's float image interchange (deeprichpixels §5.1). | yes | `tests/pixels.test.ts` | – |
| `png-unfilter.ts` | 88 | PNG row-filter reversal (PDF /Predictor >= 10, and standalone PNG IDAT) | yes | `tests/png-unfilter.test.ts` | – |
| `png.ts` | 485 | PNG encoder — 8-bit and 16-bit truecolour, pure bytes, DOM-free. | yes | `tests/png.test.ts` | – |
| `pptx-patch.ts` | 352 | pptx-patch.ts — SURGICAL rebrand of an unzipped .pptx part map (Pipeline A, plans/49-fable-new-potential-pptx.md §2.2 / track E2). | yes | `tests/pptx-patch.test.ts` | yes |
| `pptx-read.ts` | 901 | pptx-read.ts — PARSE an unzipped .pptx part map into a read-model. | yes | `tests/pptx-read.test.ts` | yes |
| `pptx.ts` | 756 | PPTX (PowerPoint / OOXML) builder — pure, DOM-free, platform-agnostic. | yes | `tests/pptx.test.ts` | – |
| `preflight.ts` | 1548 | Preflight — pre-export findings over a plain job description. | yes | `tests/preflight.test.ts` | – |
| `print-marks.ts` | 315 | Print-marks & bleed geometry — platform-agnostic, no DOM. | yes | `tests/print-marks.test.ts` | – |
| `provenance-defaults.ts` | 91 | Whether an export carries provenance marks WHEN NOBODY SAID — the one home for the two default-on answers every shell needs before it exports anything: | yes | none | – |
| `psd-write.ts` | 285 | Photoshop PSD writer — the write-back half of layered import (psd.ts reads). | yes | indirect | – |
| `psd.ts` | 812 | Photoshop PSD/PSB reader — layered import for the layer-stack tool, Layout Studio and the picker's flatten path. | yes | `tests/psd.test.ts` | yes |
| `radiance.ts` | 646 | Radiance RGBE (`.hdr` / `.pic`) reader + writer — pure bytes, DOM-free. | no | `tests/radiance.test.ts` | – |
| `raster-layers.ts` | 235 | The shared vocabulary of layered raster import — what psd.ts and xcf.ts both decode INTO, and the blend-mode bridges between the source formats and the one blend vocabulary the platform actually renders: CSS… | yes | indirect | – |
| `rate-card.ts` | 689 | The printer's own rate card — stored, validated, never a source of prices. | yes | indirect | – |
| `riff-meta.ts` | 94 | WAV provenance tags — the RIFF LIST/INFO chunk, the container's native equivalent of the mp4 ilst / WebM Tags the video exports already carry (video-meta.ts). | yes | `tests/riff-meta.test.ts` | – |
| `runtime.ts` | 1501 | Runtime — orchestrates the 5-step lifecycle for a single mounted tool. | yes | indirect | – |
| `seal.ts` | 728 | SEAL (hackerfactor.com) signature verifier — pure, DOM-free (globalThis.crypto only, like c2pa-verify.ts / x509.ts). | yes | `tests/seal.test.ts` | – |
| `semver-range.ts` | 112 | Minimal SemVer range satisfaction — just enough to enforce a tool manifest's `engineVersion` against the running ENGINE_VERSION (loader.ts, P0-3). | yes | `tests/semver-range.test.ts` | – |
| `session-record.ts` | 99 | Saved-session record envelope — the version stamps a shell's state bridge writes for one saved tool session, and the migrate-or-warn branch it runs on load. | yes | `tests/session-record.test.ts` | – |
| `speech-model-bytes.ts` | 27 | Kokoro TTS download-size constants — split out of speech-text.ts as a dependency-free LEAF module. | no | none | – |
| `speech-text.ts` | 432 | Speech synthesis text machinery — the PURE half of Kokoro TTS. | yes | `tests/speech-text.test.ts` | – |
| `steganalysis.ts` | 127 | Classical LSB steganalysis — Westfeld–Pfitzmann chi-square attack | yes | `tests/steganalysis.test.ts` | – |
| `strip-metadata.ts` | 365 | Embedded-metadata stripper | yes | `tests/strip-metadata.test.ts` | yes |
| `svg-colors.ts` | 115 | Pure, DOM-free colour extraction from raw SVG source text. | yes | `tests/svg-colors.test.ts` | – |
| `svg-custgeom.ts` | 338 | Flat-SVG → NATIVE PowerPoint custom geometry — pure, DOM-free, platform-agnostic. | yes | `tests/svg-custgeom.test.ts` | – |
| `svg-path.ts` | 307 | SVG path `d` tokenizer — pure, DOM-free, platform-agnostic. | yes | `tests/svg-path.test.ts` | – |
| `table-text.ts` | 113 | Text ⇄ table parsing/serialising for the `table` input (the clipboard and file round-trip) — the batch-editing story is "edit in the spreadsheet you already have", so paste-in and copy-out must be lossless against the… | yes | `tests/table-text.test.ts` | – |
| `tar-read.ts` | 187 | tar (USTAR / POSIX 1003.1-1988) reader — the import half of tar.ts's writer, so `.tar` (and, gunzipped, `.tar.gz`) becomes round-trip. | yes | `tests/tar-read.test.ts` | – |
| `tar.ts` | 155 | tar (USTAR / POSIX 1003.1-1988) writer — the container half of `.tar` and, gzipped, `.tar.gz`. | yes | indirect | – |
| `template.ts` | 415 | Template hydration. | yes | indirect | – |
| `tiff.ts` | 224 | Baseline TIFF encoder (uncompressed, single strip, little-endian). | yes | `tests/tiff.test.ts` | – |
| `tokens.ts` | 548 | Design tokens — a platform-agnostic DTCG model. | yes | `tests/tokens.test.ts` | – |
| `tool-url.ts` | 133 | Lolly tool-URL recognition — the END-USER surface of tool composition. | yes | `tests/tool-url.test.ts` | – |
| `trustmark.ts` | 971 | Adobe TrustMark — BCH data-layer decode (pure GF(2^7) math, DOM-free). | yes | `tests/trustmark.test.ts` | – |
| `units.ts` | 98 | Physical unit conversions for output dimensions — platform-agnostic, no DOM. | yes | `tests/units.test.ts` | – |
| `url-mode.ts` | 749 | URL mode. | yes | indirect | – |
| `url-pack.ts` | 308 | Packed URL state — the compact transport for large tool state. | yes | `tests/url-pack.test.ts` | yes |
| `validate.ts` | 78 | Validates a tool manifest against the JSON Schema. | yes | indirect | – |
| `version.ts` | 16 | The engine's HostV1 contract version. | yes | indirect | – |
| `video-meta.ts` | 437 | Video provenance — embeds the export authorship record (metadata.js) into the two MediaRecorder containers, which are produced bare (no metadata slot exists during recording, so the shell post-processes the finished… | yes | `tests/video-meta.test.ts` | yes |
| `watermark-search.ts` | 255 | Lolly pixel watermark — multi-scale + offset recovery search | yes | `tests/watermark-search.test.ts` | – |
| `wav.ts` | 267 | WAV reader/writer — RIFF bytes in, Float32 channel data out, and back again. | yes | `tests/wav.test.ts` | yes |
| `webp-anim-decode.ts` | 172 | Animated WebP demuxer — pure, DOM-free, platform-agnostic. | yes | `tests/webp-anim-decode.test.ts` | – |
| `webp-anim.ts` | 164 | Animated WebP packer — pure, DOM-free, platform-agnostic. | yes | `tests/webp-anim.test.ts` | – |
| `wmf.ts` | 327 | WMF (Windows Metafile, 16-bit) emitter — pure, DOM-free, platform-agnostic. | yes | `tests/wmf.test.ts` | – |
| `x509.ts` | 316 | DER / X.509 authority — pure, DOM-free (globalThis.crypto only; browsers and Node 18+). | yes | `tests/x509.test.ts` | yes |
| `xcf.ts` | 623 | GIMP XCF reader — the second layered-bitmap import format beside psd.ts, decoding into the same {@link LayeredRasterDoc}. | yes | `tests/xcf.test.ts` | yes |
| `xlsx-import.ts` | 562 | xlsx-import.ts — read the first worksheet of an .xlsx into a plain grid. | yes | `tests/xlsx-import.test.ts` | – |
| `xlsx-write.ts` | 267 | xlsx-write.ts — write a plain grid out as a valid SpreadsheetML .xlsx. | yes | `tests/xlsx-write.test.ts` | – |
| `zip-crypto.ts` | 345 | Two-tier zip encryption — the crypto behind the "lock this download" option. | yes | `tests/zip-crypto.test.ts` | – |
| `zip.ts` | 343 | zip.ts — the shared PLAIN (unencrypted) zip primitive. | yes | `tests/zip.test.ts` | – |
| `zzfx-compose.ts` | 446 | ZzFXM composition — the shared ZzFX preset bank + the archetype composer behind Lolly's procedural music (Neurospicy Mode tracks, video music beds, the ingest/generator scripts). | yes | `tests/zzfx-compose.test.ts` | – |
| `zzfxm-ref.ts` | 102 | zzfxm-ref.ts — the `zzfxm:<seed>[:<style>]` asset id, and nothing else. | yes | none | – |
| `zzfxm.ts` | 337 | ZzFXM procedural-music renderer — pure, DOM-free, deterministic-ish. | yes | `tests/zzfxm.test.ts` | – |
<!-- engine-modules:end -->
