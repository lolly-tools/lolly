# `@lolly/engine`

The platform-agnostic core of Lolly. It loads a tool manifest, builds the input model from it, resolves asset references, runs the tool's hooks, hydrates the Handlebars template, and drives the export. Everything a render needs that is *not* a platform capability lives here, which is why the same tool produces the same output from the web PWA, the Tauri desktop and mobile shells, the CLI and the TUI.

The engine ships as source. `main` is `./src/index.ts` and there is no build step: Node runs the TypeScript directly via native type-stripping, Vite and esbuild handle it for the web shell. Its only runtime dependencies are `handlebars`, `ajv`, `fflate`, `yaml` and the workspace tool-author SDK `@lolly-tools/core`.

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

## Emoji

[The emoji guide](emoji.md) documents the whole feature: the pinned Unicode data
and pack resolver, the bounded static SVG subset, the deterministic brand
treatment, the pass the runtime runs over every rendered tree and every export,
the reserved `emoji` and `emojifx` params, the evidence behind each claim and
what is not built.

## The document API

[`src/document-api.ts`](src/document-api.ts) is the transport-neutral compiler
surface: `compile`, `validate`, `documentSchema`, `inspect`, `diff`, `measure`,
`optimize`, `package` and the shell-owned `render`. Its
`DOCUMENT_API_VERSION` is versioned independently from the HostV1 contract so
CLI, MCP, embeds and Lolly Work can agree on document shapes without inventing
their own adapters. Compile resolves typed inputs, token references and logical
assets without rasterising; inspect/diff/measure operate on that result.

[`src/asset-provider.ts`](src/asset-provider.ts) owns the
`provider://scope/path?option=value` grammar. Resolution remains a host
capability through optional `AssetsAPI.resolveProvider`: browser and CLI hosts
resolve local brand/catalog/library names, while `cms://` and `net://` are
available only where a governed hosted connector supplies them. The engine
never fetches a provider ref itself.

## The capability bridge

The canonical entry point for the v1 contract is [`packages/core/src/host-v1.ts`](../packages/core/src/host-v1.ts), a stable barrel over capability-sized declarations in `packages/core/src/host-v1/`. It is published as the tool-author SDK `@lolly-tools/core` so a third party can build tools against the exact interface without depending on the engine at all. `security/host-v1-api.json` snapshots every public declaration; `pnpm run check:host-v1-api` rejects accidental signature drift.

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
- **Geometry**: `geom/*.ts` with `geom-api.ts` as its façade, plus `svg-path.ts`, `svg-colors.ts`, `svg-custgeom.ts`, `css-box.ts`, `css-paint.ts`. See [Why the geometry is in-house](#why-the-geometry-is-in-house).
- **Audio**: `audio-analyse.ts`, `wav.ts`, `midi.ts`, `zzfxm.ts`, `zzfx-compose.ts`, `zzfxm-ref.ts`.
- **Plumbing**: `bytes.ts`, `batch.ts`, `compose.ts`, `tool-url.ts`, `url-pack.ts`, `embed.ts`, `lang.ts`, `fs-token.ts`, `session-record.ts`, `catalog-integrity.ts`, `data-import.ts`, `semver-range.ts`, `version.ts`.

## Why the geometry is in-house

`geom/*.ts` plus `geom-api.ts` is roughly 8,000 lines of Bézier geometry: booleans, offsetting, stroke outlining, curve intersection, spline lowering, cubic fitting. It is the one family in this engine with an obvious off-the-shelf answer for each job (paper.js, a Clipper2 port, bezier-js), so the reasons for writing it are recorded here rather than assumed.

- **The engine's dependency rule.** `engine/package.json` declares five runtime dependencies (`@lolly-tools/core`, `ajv`, `fflate`, `handlebars`, `yaml`) and no DOM library, framework or storage backend. `scripts/check-engine-purity.ts` enforces that by scanning: it fails on any `node:` builtin import, any DOM or storage global, and any import escaping `engine/src` other than the few it names one by one. A geometry package would have to go into `engine/package.json`, be granted an exception in that guard, and then run unchanged in a browser, in Node, and inside a Worker.
- **One kernel, attached verbatim by every shell.** `host.geom = makeGeomApi()` is the whole of what a shell does here: `shells/cli/src/bridge.ts` and `shells/web/src/bridge/index.ts` attach the same object, and `hook-worker-core.ts` co-locates `geom` in bucket A, constructing it inside the worker instead of proxying every call back over RPC. Being pure and dependency-free is what allows that copy. A shell-side library would mean a second implementation behind the same method names, and web/CLI/Tauri could then disagree.
- **The output is a coordinate, and it has to be the same coordinate everywhere.** `bezier.ts` keeps full cubic precision and returns parameters on the ORIGINAL curves; `intersect.ts` never flattens, samples or rasterises inside the geometry; `spline.ts`'s `hyperbezierCubics` places control points from the chord vector so the lowering is exactly equivariant under translation, rotation and uniform scale, to rounding. A polygon clipper decides regions on flattened input, which is the approximation those modules refuse. Pen shapes also travel inside share links, in the compact wire form of `geom/authored-url.ts`, so a design link opened a year later has to lower to the numbers it was saved with.
- **Two of the curve families are not cubic-library work.** `spline.ts` keeps an `AuthoredPath` (knots, handles, per-node continuity) and lowers one direction only, because a pen tool that stored cubics alone could not round-trip a knot. The curves it lowers come from Raph Levien's own sources, cited in the module headers: `spiro.ts` reproduces the Euler-spiral solver's formulae from the paper and from libspiro's `compute_ends` / `spiro_to_bpath` (upstream MIT OR Apache-2.0), and the `hyperbezier` default comes from spline-research. `fit.ts` determines each cubic by matching signed area and first x-moment in closed form, and measures Fréchet rather than Hausdorff error. A cubic-Bézier utility library replaces none of those three files.
- **Hardening is at the tool boundary, not in the kernel.** `geom-api.ts` validates a `d` string's grammar first (size, command vocabulary, argument arity, number syntax, coordinate magnitude) against exported ceilings - `MAX_CHARS`, `MAX_COMMANDS`, `MAX_CURVES`, `MAX_PATHS`, `MAX_NODES`, `MAX_COORD` - and returns a discriminated result rather than throwing, because a throw out of `onInit` is caught and discarded by the runtime. The parser upstream of it, `svg-path.ts`, carries its own ceilings in `docs/parser-inventory.md` and is fuzzed under the `svg-readers` target. The kernel itself has no fuzz target; its assurance is per-module tests (`tests/geom-*.test.ts`, `tests/spiro.test.ts`) plus the consumer suites `tests/design-path.test.ts`, `tests/path-stroke-pad.test.ts` and `tests/connector-geometry.test.ts`.
- **Licence posture.** The engine is MPL-2.0. `security/npm-licenses.json` records an exact-version licence for every locked package and feeds `scripts/build-sbom.ts`; none of paper.js, a Clipper2 port or bezier-js appears in it today, so each would be a new entry there, in the SBOM, and in the release audit.

None of this says those libraries are bad. It says a replacement has to clear the purity guard, produce identical coordinates in web, CLI, Tauri and the hook worker, and still leave `spline.ts`, `spiro.ts` and `fit.ts` in the tree.

## Module map

The table is generated. Run `node scripts/gen-engine-modules.ts` after adding, removing or renaming a module, and `node scripts/gen-engine-modules.ts --check` to fail on drift. Purpose comes from each file's leading doc comment, so the way to improve a row is to improve that comment.

<!-- engine-modules:start -->
**357 modules** under `engine/src/` (excluding the `index.ts` barrel): 260 re-exported from `index.ts`, 257 with a dedicated `tests/*.test.ts`, 80 covered indirectly, 20 with no coverage under `tests/`, 39 wired into the fuzz corpus. Generated by `node scripts/gen-engine-modules.ts` - do not hand-edit between the markers.

| Module | Lines | Purpose | Public? | Test | Fuzzed |
|---|--:|---|:--:|---|:--:|
| `ai-kind.ts` | 18 | The IPTC DigitalSourceType slugs that denote AI/ML-generated pixels, and the one lookup every reader shares. | no | `tests/ai-kind.test.ts` | – |
| `apng-decode.ts` | 311 | APNG demuxer - pure, DOM-free, platform-agnostic. | yes | `tests/apng-decode.test.ts` | – |
| `apng.ts` | 194 | APNG packer - pure, DOM-free, platform-agnostic. | yes | `tests/apng.test.ts` | – |
| `app-surface.ts` | 137 | A small, DOM-free description of an exportable Lolly application surface. | yes | `tests/app-surface.test.ts` | – |
| `appstream.ts` | 120 |  | yes | `tests/appstream.test.ts` | – |
| `asset-provider.ts` | 15 | Pure grammar for logical asset references. | yes | `tests/asset-provider.test.ts` | – |
| `asset-version.ts` | 54 | Explicit asset versions, portable through typed state and URL-mode values. | yes | `tests/asset-version.test.ts` | – |
| `audio-analyse.ts` | 536 | Audio analysis - decoded PCM in, a per-frame reactivity track out. | yes | `tests/audio-analyse.test.ts` | – |
| `audio-clean.test.ts` | 29 |  | no | none | – |
| `audio-clean.ts` | 153 | Deterministic PCM finishing shared by host.audio implementations. | yes | `tests/audio-clean.test.ts` | – |
| `audio-dynamics.ts` | 280 | audio-dynamics.ts - the master true-peak limiter (plans/165 Slice E, plans/101 section 2.5). | yes | `tests/audio-dynamics.test.ts` | – |
| `audio-fx.ts` | 313 | audio-fx.ts - the per-clip effect kernels and the `fx` chain grammar (plans/101 sections 2.2 + 3.4, plans/165's deferred tier). | yes | `tests/audio-fx.test.ts` | – |
| `audio-loudness.ts` | 137 | audio-loudness.ts - ITU-R BS.1770-4 integrated loudness (plans/101 section 2.5, plans/165's deferred tier). | yes | `tests/audio-loudness.test.ts` | – |
| `auxiliary-metadata.ts` | 37 | Readable XMP/RDF evidence belonging to an embedded JPEG rendition. | no | `tests/auxiliary-metadata.test.ts` | – |
| `bake.ts` | 150 | Bake - freeze a composed render into a static asset, plus the shared compose recursion policy (the depth/cycle guard every shell bridge enforces). | yes | indirect | – |
| `batch.ts` | 186 | Batch - the shared, DOM-free contract for "many URL-mode rows under one file". | yes | indirect | – |
| `bmp.ts` | 265 | BMP (Windows Bitmap) - uncompressed BI_RGB encoder + decoder. | yes | `tests/bmp.test.ts` | – |
| `brand-check.ts` | 107 | Checks authored Design values against one selected design system. | yes | indirect | – |
| `brand-context.ts` | 56 | Portable facts and explicit rules derived from the selected token document. | yes | `tests/brand-context.test.ts` | – |
| `brand-derive.ts` | 789 | Brand derivation. | yes | `tests/brand-derive.test.ts` | – |
| `brand-evidence.ts` | 55 | Bounded style observations shared by saved-page and browser capture readers. | yes | indirect | – |
| `brand-import.ts` | 800 | Brand token ingestion. | yes | `tests/brand-import.test.ts` | yes |
| `brand-map.ts` | 424 | Brand mapper. | yes | `tests/brand-map.test.ts` | – |
| `brand-schemes.ts` | 168 | Brand scheme accents. | yes | `tests/brand-schemes.test.ts` | – |
| `brand-treatments.ts` | 252 | Brand-derived photo treatments + icon duo themes. | yes | `tests/brand-treatments.test.ts` | – |
| `bridge/host-v1.ts` | 23 | Capability Bridge - v1 (re-export). | no | indirect | – |
| `bytes.ts` | 77 | Shared byte-level primitives for the engine's binary/crypto format modules (c2pa, c2pa-verify, seal, x509, zip-crypto, pdf-crypto-r6, …). | no | indirect | – |
| `c2pa-containers.ts` | 1917 | C2PA container placement - the per-format byte-splicing side of the writer: classic-xref PDF incremental update, the png/jpeg/gif/svg/tiff/webp embedders, ISO BMFF (mp4) with its own c2pa.hash.bmff.v2 binding, and the… | no | `tests/c2pa-containers.test.ts` | yes |
| `c2pa-extract.ts` | 2085 | C2PA structural extraction - the read side's format-sniffing, CBOR decoding, JUMBF-store walking, and per-container manifest extraction (pdf/png/jpeg/gif/ svg/tiff/webp/mp4/webm/mp3/wav, plus the C2PA 2.4 TEXT bindings… | no | `tests/c2pa-extract.test.ts` | yes |
| `c2pa-trust.ts` | 1503 | Vendored C2PA trust anchors - the root/anchor certificates whose signing chains verifyC2pa() upgrades from "valid" to TRUSTED (a named, CA-verified signer). | yes | `tests/c2pa-trust.test.ts` | – |
| `c2pa-verdict.ts` | 286 | C2PA verdict resolution - the single source of truth for (a) the check-code vocabulary verifyC2pa emits, (b) the flags→verdict ladder every surface renders, and (c) trust-anchor assembly. | yes | `tests/c2pa-verdict.test.ts` | – |
| `c2pa-verify.ts` | 1650 | C2PA (Content Credentials) verifier - pure, DOM-free. | yes | `tests/c2pa-verify.test.ts` | yes |
| `c2pa.ts` | 1311 | C2PA (Content Credentials) manifest builder + PDF embedder - pure, DOM-free. | yes | `tests/c2pa.test.ts` | – |
| `captions.ts` | 187 | Captions - spoken-word timings in, subtitle cues out. | yes | `tests/captions.test.ts` | – |
| `catalog-integrity.ts` | 267 | Catalog signing + runtime integrity verification - the SOVEREIGNTY.md "catalog origin is a trust anchor" gap, closed. | yes | `tests/catalog-integrity.test.ts` | – |
| `chart-spec.ts` | 387 | Pure ChartSpecV1 helpers. | yes | `tests/chart-spec.test.ts` | – |
| `chroma-key.test.ts` | 97 | engine/src/chroma-key.ts - the perceptual (OKLab) colour-range key behind the video-matte "Colour key" method (plans/124 WP-G). | no | none | – |
| `chroma-key.ts` | 97 | Chroma / colour-range keying: remove a flat background colour by PERCEPTUAL distance, so clean footage shot against an evenly-lit wall or screen keys out without the neural matte model at all (plans/124 WP-G). | yes | none | – |
| `clamp.ts` | 10 | The one numeric clamp. | yes | `tests/clamp.test.ts` | – |
| `claudisms.ts` | 366 | AI writing-tell patterns for the text-signal analyzer (engine/src/text-signals.ts). | no | `tests/claudisms.test.ts` | – |
| `cmyk-palette.ts` | 120 | The brand-swatch → CMYK lookup every CMYK sink shares. | yes | `tests/cmyk-palette.test.ts` | – |
| `color-curve.ts` | 205 | color-curve.ts - a serializable tonal-curve model for brand colour ramps. | yes | `tests/color-curve.test.ts` | – |
| `color-describe.ts` | 221 | One colour, fully described. | yes | `tests/color-describe.test.ts` | – |
| `color-face.ts` | 26 | Select an authored colour face without reducing wide-gamut values to hex. | no | `tests/color-face.test.ts` | – |
| `color-faces.ts` | 258 | A brand colour's FACES: one canonical value, plus what it becomes in every space and on every press it can be expressed in. | yes | `tests/color-faces.test.ts` | – |
| `color-tools.ts` | 727 | Colour tools: perceptual metrics and ramp math on top of brand-derive's OKLab core. | yes | `tests/color-tools.test.ts` | – |
| `color-vision.ts` | 211 | Colour-vision-deficiency (CVD) simulation - Machado, Oliveira & Fernandes (2009). | yes | `tests/color-vision.test.ts` | – |
| `color.ts` | 387 | Colour profiles for exports: platform-agnostic, no DOM, no network. | yes | `tests/color.test.ts` | – |
| `compare-budget.ts` | 70 | Work and output limits shared by comparison algorithms. | no | `tests/compare-budget.test.ts` | – |
| `compare-structure.ts` | 88 | Structured field comparison with ordered arrays and optional stable-ID moves. | no | `tests/compare-structure.test.ts` | – |
| `compare-text.ts` | 51 | Bounded line and word alignment with original source locations. | no | `tests/compare-text.test.ts` | – |
| `compare-visual.ts` | 91 | Bounded preview comparison. | yes | `tests/compare-visual.test.ts` | – |
| `compare.ts` | 43 | Shared bounded comparison results for supplied immutable text or structure snapshots. | yes | `tests/compare.test.ts` | – |
| `compose.ts` | 177 | Compose: resolve a tool's manifest `composes` entries into embeddable assets. | no | `tests/compose.test.ts` | – |
| `connectors.ts` | 640 | Connector / line / arrow geometry - the ONE source (plan 90 R1). | yes | indirect | – |
| `contentseal.ts` | 171 | Meta Content Seal (Pixel Seal / Video Seal, IMAGE mode). | yes | `tests/contentseal.test.ts` | – |
| `cpio.ts` | 142 | cpio "newc" (SVR4 / `070701`) writer. | yes | `tests/cpio.test.ts` | – |
| `css-box.ts` | 499 | Pure, DOM-free CSS box-model + border-radius geometry. | yes | `tests/css-box.test.ts` | – |
| `css-color.ts` | 972 | One CSS Color 4 colour value. | yes | `tests/css-color.test.ts` | – |
| `css-paint.ts` | 465 | Pure, DOM-free CSS "paint" value parsers: clip-path basic shapes, gradient stops + radial-gradient geometry, and drop-shadow filters. | yes | `tests/css-paint.test.ts` | – |
| `dash-fit.ts` | 263 |  | yes | `tests/dash-fit.test.ts` | – |
| `data-import.ts` | 230 | Data-file → blocks rows. | yes | `tests/data-import.test.ts` | yes |
| `deck-census-hash.ts` | 292 | Small pure hashes the deck census uses to GENERATE candidates (plan 274 section 3.2): a difference hash over a decoded picture, a translation-free hash over vector path data, a digit-wildcarded key for repeated text… | yes | indirect | – |
| `deck-census-rules.ts` | 890 | The class rules of the deck census (plan 274 section 3.2), as one pure function over plain numbers. | yes | indirect | – |
| `deck-census-vector.ts` | 205 | What the census reads from a drawing's items (plan 275 decision 32). | yes | none | – |
| `deck-census.ts` | 1722 | Stage 2 of the renovation journey (plan 274 section 3.2): a read source deck in, a `DeckCensusV1` out. | yes | indirect | – |
| `deck-compile.ts` | 5277 | Compile a read source deck into Design's own authored values (plan 274 section 3.4, stage 5). | yes | indirect | – |
| `deck-md.ts` | 268 | deck-md.ts - serialise a .pptx READ-MODEL to Deck Studio's markdown dialect. | yes | indirect | – |
| `deep-codec-api.ts` | 19 | Shared codec operations. | no | none | – |
| `deep-compose.ts` | 64 | Linear-light compositing with premultiplied interpolation and straight storage. | no | indirect | – |
| `deep-decode.ts` | 43 | Original-byte HDR decode. | no | indirect | – |
| `deep-encode.ts` | 98 | deep-encode - one place that turns a linear {@link DeepFrame} into finished image bytes at the depth the caller asked for. | no | indirect | – |
| `deep-export.ts` | 73 | Encode a real float render without rasterising its display preview. | no | `tests/deep-export.test.ts` | – |
| `deep-exr.ts` | 85 | Single-part RGB(A) scanline OpenEXR, NONE/ZIPS/ZIP, HALF/FLOAT/UINT. | no | indirect | – |
| `deep-image.ts` | 63 | Shared precision limits and transfer functions for deep stills and video. | no | indirect | yes |
| `deep-png.ts` | 122 | Bounded PNG 8/16 ingest, including Adam7, ICC and PQ/HLG cICP. | no | indirect | – |
| `deep-tiff.ts` | 93 | Bounded classic TIFF RGB/gray strips at 8/16-bit integer or 32-bit float. | no | indirect | – |
| `deep-video.ts` | 49 | WebCodecs raw planes to linear float, before any browser canvas conversion. | no | `tests/deep-video.test.ts` | – |
| `deflate.ts` | 853 | Raw DEFLATE compressor + zlib wrapper - the byte-emitting half the engine was missing. | yes | `tests/deflate.test.ts` | – |
| `der-read.ts` | 120 | DER/ASN.1 read-side authority - the bounds-checked TLV walker plus the ECDSA signature-shape conversions and the EC named-curve table, shared by the certificate/signature modules (c2pa-verify.ts, x509.ts, seal.ts). | no | `tests/der-read.test.ts` | yes |
| `derived-formats.ts` | 47 | Derived export formats - the ones that are a trivial, lossless transform of a format a tool already declares, so a tool that can emit the parent can emit the child for free. | yes | `tests/derived-formats.test.ts` | – |
| `design-components.ts` | 326 | Penpot component definitions → template descriptors (pure collectors). | yes | `tests/design-components.test.ts` | – |
| `design-lottie.ts` | 149 | Authored Design values into the shared sequence compiler, identical on every host. | no | `tests/design-lottie.test.ts` | – |
| `design-map.ts` | 2170 | Design-file → Design boxes (pure mapper). | yes | `tests/design-map.test.ts` | – |
| `design-scene.ts` | 149 | The Design scene grammar - what a `kind:'3d'` box's `scene` field holds, and the only place that grammar lives (plan 265 milestone 3, decision Q17). | yes | indirect | – |
| `design-system.ts` | 257 | design-system.ts - the identity and namespace rules for holding SEVERAL design systems on one device (plans/186 section 6). | yes | `tests/design-system.test.ts` | – |
| `design-text.ts` | 602 | Formatted source text to Design's text subset and back (plan 275 section 7.2). | yes | `tests/design-text.test.ts` | – |
| `design-tool/compiler.ts` | 80 |  | yes | indirect | – |
| `design-tool/policy.ts` | 20 |  | yes | indirect | – |
| `design-tool/session-compiler.ts` | 179 | Compile a captured tool session without replacing its renderer. | yes | indirect | – |
| `design-tool/text-preflight.ts` | 19 | Worker hooks return receipts; only the runtime inspects the exported DOM. | no | none | – |
| `design-version.ts` | 487 | design-version.ts - the pure model behind versioned design systems (plans/97 section 6a). | yes | `tests/design-version.test.ts` | – |
| `doc-md.ts` | 415 | doc-md.ts - the two serialisers over `doc-model.ts`: GFM markdown, and the HTML projection a rich-text editor ingests. | yes | `tests/doc-md.test.ts` | – |
| `doc-model.ts` | 77 | doc-model.ts - the ONE block model every document reader produces and every document serialiser consumes. | yes | indirect | – |
| `document-api.ts` | 226 | Stable, transport-neutral document/compiler verbs. | yes | `tests/document-api.test.ts` | – |
| `docx-read.ts` | 1031 | docx-read.ts: PARSE an unzipped .docx part map into `doc-model.ts` blocks. | yes | `tests/docx-read.test.ts` | yes |
| `docx.ts` | 815 | DOCX (Word / WordprocessingML OOXML) builder. | yes | `tests/docx.test.ts` | – |
| `dotlottie.ts` | 130 | dotLottie v1/v2 and raw JSON, with exact source bytes retained by the caller. | no | indirect | – |
| `dxf.ts` | 190 | DXF (AutoCAD Drawing Interchange) emitter - pure, DOM-free, platform-agnostic. | yes | `tests/dxf.test.ts` | – |
| `embed.ts` | 73 | Embed URL grammar - the portable surface of tool composition. | yes | `tests/embed.test.ts` | – |
| `emf.ts` | 609 | EMF (Enhanced Metafile) emitter - pure, DOM-free, platform-agnostic. | yes | `tests/emf.test.ts` | – |
| `emoji-author.ts` | 40 | Author a versioned set from labelled SVGs. | no | `tests/emoji-author.test.ts` | – |
| `emoji-bundle.ts` | 44 | Full pack admission for user imports. | no | indirect | yes |
| `emoji-default.ts` | 36 | Shared emoji defaults beneath explicit document, brand and personal choices. | no | indirect | – |
| `emoji-dom.ts` | 365 | Replace emoji in a rendered tree with pinned pack artwork, over a minimal node interface. | yes | `tests/emoji-dom.test.ts` | – |
| `emoji-inline.ts` | 198 | inline-em-v1 sizing, and prepared plus treated emoji artwork for one run of text. | no | `tests/emoji-inline.test.ts` | – |
| `emoji-line.ts` | 151 | Experimental single LTR line master. | no | `tests/emoji-line.test.ts` | – |
| `emoji-pack.ts` | 146 | Validate pinned emoji manifests and artwork bytes without performing IO or rendering SVG. | no | `tests/emoji-pack.test.ts` | yes |
| `emoji-resolve.ts` | 42 | Resolve one complete emoji meaning through an explicit, ordered chain of verified pack pins. | no | `tests/emoji-resolve.test.ts` | – |
| `emoji-rights.ts` | 169 | Turn a compiled line's emoji source census into Content Credentials source ingredients and readable credits. | no | `tests/emoji-rights.test.ts` | – |
| `emoji-segment.ts` | 85 | Pinned Unicode 17.0 extended grapheme segmentation and mixed emoji/text spans. | no | `tests/emoji-segment.test.ts` | – |
| `emoji-sequence.ts` | 61 | Whole-sequence emoji recognition from pinned Unicode data, independent of the host's ICU. | no | `tests/emoji-sequence.test.ts` | – |
| `emoji-source-records.ts` | 15 | Portable source declarations retain their original attribution after vector conversion. | no | none | – |
| `emoji-style.ts` | 222 | Store explicit emoji typography in the existing DTCG vendor extension without changing other tokens. | no | indirect | – |
| `emoji-svg-syntax.ts` | 89 | Bounded lexical checks for the initial static emoji SVG subset. | no | indirect | – |
| `emoji-svg-text.ts` | 207 | Mixed SVG text uses shaped outlines and the same prepared emoji as HTML. | no | `tests/emoji-svg-text.test.ts` | – |
| `emoji-svg.ts` | 421 | Admit verified artwork to a bounded static SVG subset without silent visual removals. | no | `tests/emoji-svg.test.ts` | yes |
| `emoji-text-path.ts` | 34 | Bounded path sampling for mixed text and emoji on an SVG baseline. | yes | indirect | – |
| `emoji-tool-text.ts` | 102 | Mixed vector text for tools that sample artwork or paint their own canvas. | no | indirect | – |
| `emoji-treatment.ts` | 367 | Recolour admitted emoji artwork to a brand palette, deterministically, leaving protected meanings alone. | no | `tests/emoji-treatment.test.ts` | – |
| `eps.ts` | 221 | EPS (Encapsulated PostScript) emitter - pure, DOM-free, platform-agnostic. | yes | `tests/eps.test.ts` | – |
| `epub-read.ts` | 398 | epub-read.ts - READ an EPUB back to titled chapters of markdown text. | yes | `tests/epub-read.test.ts` | yes |
| `epub.ts` | 164 | EPUB 3 writer - pure, DOM-free, platform-agnostic. | yes | `tests/epub.test.ts` | – |
| `exr.ts` | 504 | OpenEXR encoder - scanline, HALF (float16) or FLOAT (32-bit), NONE/ZIPS/ZIP. | no | `tests/exr.test.ts` | – |
| `file-data.ts` | 42 | Values-only table conversion shared by browser and Node file operations. | yes | `tests/file-data.test.ts` | – |
| `file-metadata.ts` | 1684 | Embedded-metadata reader | yes | `tests/file-metadata.test.ts` | yes |
| `font-convert.ts` | 348 | Font container interconversion - TTF/OTF ⇄ WOFF1, DOM-free and synchronous. | yes | `tests/font-convert.test.ts` | – |
| `frame-address.ts` | 141 | The `s=` state address, and the still-export frame filter it drives (plan 112 section 10). | yes | indirect | – |
| `frame-preview-svg.ts` | 645 | A compiled frame drawn as a plain SVG (plan 274 section 3.4, "preview and Design share one geometry"). | yes | `tests/frame-preview-svg.test.ts` | – |
| `framing.ts` | 298 | Image framing - the ONE way an image is placed, cropped and rotated inside a frame (plans/148). | yes | `tests/framing.test.ts` | – |
| `fs-token.ts` | 40 | Reversible, filesystem-safe token codec - pure string logic, no storage, DOM, or platform coupling (it just maps a string to a safe token and back). | yes | `tests/fs-token.test.ts` | – |
| `gainmap-jpeg.ts` | 528 | Gain-map JPEG assembly. | no | `tests/gainmap-jpeg.test.ts` | – |
| `gainmap.ts` | 397 | Gain maps: the ISO 21496-1 / Adobe "one file, two renditions" math (deeprichpixels plan section 4.2, section 6 B2, section 8 row "gain maps spread beyond JPEG/AVIF"). | no | `tests/gainmap.test.ts` | – |
| `gamut-axis.ts` | 122 | How high a CHROMA AXIS has to reach for a given gamut. | yes | `tests/gamut-axis.test.ts` | – |
| `gamut-solid.ts` | 614 | The gamut SOLID: a display's whole reachable colour volume as a rotatable 3D surface in OKLCH. | yes | `tests/gamut-solid.test.ts` | – |
| `gamut-source.ts` | 284 | Where a gamut COMES FROM: the membership question behind gamut.ts, factored out so it need not be one of three hard-coded RGB matrices. | yes | `tests/gamut-source.test.ts` | – |
| `gamut-tier.ts` | 100 | How far OUT of the active gamut a colour is. | yes | `tests/gamut-tier.test.ts` | – |
| `gamut.ts` | 542 | Display-gamut classification for OKLCH colours - which of sRGB, Display-P3 or Rec.2020 can actually show a given lightness/chroma/hue. | yes | `tests/gamut.test.ts` | – |
| `geom-api.ts` | 689 | `host.geom` - the tool-facing face of the geometry kernel (HostV1 v1.64). | yes | `tests/geom-api.test.ts` | – |
| `geom/authored-url.ts` | 316 | The wire form of an `AuthoredPath` - what a pen shape looks like inside one `blocks` sub-field, and therefore inside a share link. | yes | indirect | – |
| `geom/bezier.ts` | 483 | Cubic Bézier kernel - the geometric substrate for boolean operations, offsetting and stroke outlining. | yes | `tests/geom-bezier.test.ts` | – |
| `geom/boolean.ts` | 1812 | Boolean operations on regions bounded by cubic Béziers - union, intersection, difference, exclusive-or - and the winding-number test they are all decided by. | yes | `tests/geom-boolean.test.ts` | – |
| `geom/fit.ts` | 1260 | Fitting cubics to a curve that has no Bézier form - an exact offset, a stroke edge, a distorted path. | yes | `tests/geom-fit.test.ts` | – |
| `geom/intersect.ts` | 2351 | Curve intersection. | yes | `tests/geom-intersect.test.ts` | – |
| `geom/offset.ts` | 1315 | Offsetting: moving a path a fixed distance sideways. | yes | `tests/geom-offset.test.ts` | – |
| `geom/path.ts` | 226 | The path model the geometry operates on, and its conversions to and from the rest of the engine. | yes | indirect | – |
| `geom/spiro.ts` | 437 | Spiro. | no | `tests/spiro.test.ts` | – |
| `geom/spline.ts` | 1044 | The seam between an AUTHORED path and the cubics that geometry runs on. | yes | `tests/geom-spline.test.ts` | – |
| `geom/stroke.ts` | 382 | Stroke outlining: the region a stroked path paints, expressed as a fillable path. | yes | `tests/geom-stroke.test.ts` | – |
| `grade.ts` | 576 |  | yes | `tests/grade.test.ts` | – |
| `gradient-spec.ts` | 255 | The Lolly gradient spec: one terse, URL-safe string that describes a gradient, and the CSS it bakes down to. | yes | `tests/gradient-spec.test.ts` | – |
| `gzip.ts` | 283 | gzip (RFC 1952): the member wrapper around raw DEFLATE, plus a synchronous inflater so a `.gz`/`.svgz` can be read back without a platform decoder. | yes | indirect | – |
| `hdr.ts` | 555 | HDR raster export: brand-colour highlight boost + PQ (SMPTE ST 2084) encoding. | yes | `tests/hdr.test.ts` | – |
| `hook-worker-core.ts` | 461 | Hook worker core - the transport-agnostic half of running a tool's hooks.js OFF the thread that owns the host bridge (plans/86 M2, moved here from the web shell's hook-worker.worker.ts so a Node `worker_threads`… | yes | `tests/hook-worker-core.test.ts` | – |
| `humanize.ts` | 88 | "Humanize" a text asset - a DETERMINISTIC, on-device clean-up of the AI artifacts a text-signal analysis flags, plus a tidy of the typography to house style. | yes | `tests/humanize.test.ts` | – |
| `icc-pixels.ts` | 482 | ICC profiles applied to deep pixel buffers: the digiKam act (deeprichpixels section 3, section 5.1): input profile → PCS → working/output space, per pixel, over a {@link DeepFrame}. | yes | `tests/icc-pixels.test.ts` | – |
| `icc.ts` | 1390 | ICC profile reader: the authority for "what can this device actually print?". | yes | `tests/icc.test.ts` | yes |
| `ico-decode.ts` | 293 | Windows ICO / CUR reader: picks the LARGEST image in the directory and decodes it to RGBA. | yes | `tests/ico-decode.test.ts` | – |
| `icon-set.ts` | 85 | icon-set.ts - plan a freedesktop hicolor icon theme layout from source icons. | yes | indirect | – |
| `icon-theme.ts` | 206 | Two-colour themable icons. | yes | `tests/icon-theme.test.ts` | – |
| `image-cloud.ts` | 274 | An image's colours as a point cloud in OKLCH, plus what the distribution says. | yes | `tests/image-cloud.test.ts` | – |
| `image-meta.ts` | 1111 | Image-metadata byte stampers and the metadata-carry core - DOM-free, shared by the web export bridge and the Node shells. | yes | indirect | – |
| `inpaint.ts` | 422 | Telea inpainting: fill a brushed-out region of an RGBA frame from the pixels around it, by fast marching inward from the region boundary. | yes | `tests/inpaint.test.ts` | – |
| `inputs.ts` | 837 | Builds a runtime input model from a tool manifest. | yes | indirect | – |
| `jpeg-segments.ts` | 372 | JPEG marker-segment walker and writer - one shared primitive, DOM-free. | no | `tests/jpeg-segments.test.ts` | – |
| `jxl-container.ts` | 43 | Bounded uncompressed metadata boxes. | no | indirect | – |
| `jxl.ts` | 37 | JPEG XL identity and bounded operation policy. | no | `tests/jxl.test.ts` | yes |
| `keyframes.ts` | 1682 |  | yes | `tests/keyframes.test.ts` | yes |
| `label-artwork.ts` | 6 | Validate a small already-rendered stamp before a host paints it. | no | none | – |
| `lang.ts` | 171 | Supported UI/content languages, shared by the `lang` reserved URL param (url-mode.ts), `Profile.lang`, tool-manifest i18n sidecars, and every shell's language picker. | yes | indirect | – |
| `learning/authoring.ts` | 156 |  | no | `tests/learning-authoring.test.ts` | – |
| `learning/compile.ts` | 190 |  | yes | indirect | – |
| `learning/delivery.ts` | 80 | Portable course targets and source renditions, independent of a shell or provider. | yes | indirect | – |
| `learning/module.ts` | 258 |  | yes | indirect | – |
| `learning/preflight.ts` | 33 |  | yes | `tests/preflight.test.ts` | – |
| `learning/progress.ts` | 128 |  | yes | indirect | – |
| `linux-pack.ts` | 153 | linux-pack.ts - the content-aware layer over `rpm.ts`. | yes | `tests/linux-pack.test.ts` | – |
| `loader.ts` | 533 | Tool loader. | yes | indirect | – |
| `logo-variant.ts` | 141 | Which logo goes on this background (plan 274 section 3.4). | yes | `tests/logo-variant.test.ts` | – |
| `lottie-edit.ts` | 181 | Instance-local revisions over immutable Lottie source documents. | no | `tests/lottie-edit.test.ts` | – |
| `lottie-model.ts` | 113 | Bounded, platform-independent admission of linear Lottie compositions. | no | indirect | – |
| `lottie-properties.ts` | 159 | Numeric Lottie tracks retain their own frame times, dimensions and easing. | no | indirect | – |
| `lottie-sequence.ts` | 143 | Compile a frozen, resolved linear sequence without a player or a DOM. | no | indirect | – |
| `media-sniff.ts` | 255 | Pure, DOM-free media classification from header bytes. | yes | `tests/media-sniff.test.ts` | yes |
| `metadata.ts` | 92 | Export provenance: the generic authorship record embedded into every exported media file (platform-agnostic; no format/DOM knowledge here). | yes | `tests/metadata.test.ts` | – |
| `midi.ts` | 169 | Standard MIDI File to ZzFXM. | yes | `tests/midi.test.ts` | yes |
| `ocr-typeset.ts` | 895 | Typesetting recovery from OCR lines (plan 274 section 6, point 4): the lines a recogniser read inside one text region in, paragraphs with reading order, bullets, nesting, an estimated size and a role guess out. | yes | `tests/ocr-typeset.test.ts` | – |
| `odt.ts` | 173 | OpenDocument Text (.odt) writer: pure, DOM-free, platform-agnostic. | yes | `tests/odt.test.ts` | – |
| `ogg.ts` | 199 | Ogg (RFC 3533) page + Opus comment-header primitives, shared by the C2PA write side (c2pa-containers.ts placeOgg) and the read side (c2pa-extract.ts extractC2paFromOgg). | no | indirect | – |
| `ooxml-props.ts` | 44 | Shared OPC docProps/core.xml writer (plans/144 Wave 2 G3): one core-properties shape for every OOXML package the engine writes (pptx.ts, docx.ts), so the authorship fields cannot drift between them. | no | `tests/ooxml-props.test.ts` | – |
| `packbits.ts` | 97 | PackBits run-length coding (TIFF 6.0 section 9) - the byte compression Photoshop calls "RLE" for PSD channel data (compression method 1) and TIFF uses for Compression=32773. | yes | `tests/packbits.test.ts` | – |
| `palette-export.ts` | 171 | Palette exchange - serialise a flat list of named colours as a standalone file in one of several interchange formats: a DTCG design-tokens JSON (nested under each swatch's canonical dotted key), a plain CSS… | yes | `tests/palette-export.test.ts` | – |
| `pdf-artwork.ts` | 342 | Vector artwork detection - find the logos on a page full of shapes. | yes | `tests/pdf-artwork.test.ts` | – |
| `pdf-crypto-r6.ts` | 180 | PDF Standard Security Handler - revision 6 (R6), AES-256 (ISO 32000-2 section 7.6.4, originally Adobe's "ExtensionLevel 3"). | yes | `tests/pdf-crypto-r6.test.ts` | – |
| `pdf-map.ts` | 2296 | PDF (and Adobe Illustrator .ai - an .ai IS a PDF) page content stream → DesignNodes. | yes | `tests/pdf-map.test.ts` | yes |
| `pdf-redaction.ts` | 235 | Failed-redaction detection: text that is in the file but not on the page. | yes | `tests/pdf-redaction.test.ts` | – |
| `pdf-smask.ts` | 170 | Pure helpers for PDF soft masks (ExtGState /SMask, PDF 32000-1 section 11.6.5.2). | yes | `tests/pdf-smask.test.ts` | – |
| `pdf-svg.ts` | 997 | PDF page → standalone SVG serializer (pure, DOM-free). | yes | `tests/pdf-svg.test.ts` | – |
| `pdf-text.ts` | 1256 | PDF text reconstruction: positioned glyph runs to reading-ordered prose. | yes | `tests/pdf-text.test.ts` | – |
| `pdfx.ts` | 288 | PDF/X-4 metadata authority: pure strings + small descriptor objects, no PDF byte-wrangling. | yes | `tests/pdfx.test.ts` | – |
| `penpot-bindings.ts` | 216 | Applied-token bindings for the `.penpot` writer (plans/222). | yes | indirect | – |
| `penpot-file.ts` | 2198 | `.penpot` writer - a Lolly document (plus the brand's tokens) → the binfile-v3 archive Penpot itself exports and imports (plans/178). | yes | `tests/penpot-file.test.ts` | – |
| `photo-treatment.ts` | 176 | Colour treatments for raster photo assets: the raster analogue of the two-colour icon themes in ./icon-theme.ts. | yes | indirect | – |
| `pixel-watermark.ts` | 478 | Lolly pixel watermark - block-DCT spread-spectrum | yes | `tests/pixel-watermark.test.ts` | – |
| `pixels.ts` | 473 | Deep pixel buffers: the engine's float image interchange (deeprichpixels section 5.1). | yes | `tests/pixels.test.ts` | – |
| `png-unfilter.ts` | 92 | PNG row-filter reversal (PDF /Predictor >= 10, and standalone PNG IDAT) | yes | `tests/png-unfilter.test.ts` | yes |
| `png.ts` | 485 | PNG encoder: 8-bit and 16-bit truecolour, pure bytes, DOM-free. | yes | `tests/png.test.ts` | – |
| `portable-html.ts` | 16 | Standalone document assembly for declared, trusted tool presentations. | no | `tests/portable-html.test.ts` | – |
| `pptx-patch.ts` | 352 | pptx-patch.ts: SURGICAL rebrand of an unzipped .pptx part map (Pipeline A, plans/49-fable-new-potential-pptx.md section 2.2 / track E2). | yes | `tests/pptx-patch.test.ts` | yes |
| `pptx-read.ts` | 2919 | pptx-read.ts: PARSE an unzipped .pptx part map into a read-model. | yes | `tests/pptx-read.test.ts` | yes |
| `pptx.ts` | 1375 | PPTX (PowerPoint / OOXML) builder. | yes | `tests/pptx.test.ts` | – |
| `preflight.ts` | 1579 | Preflight: pre-export findings over a plain job description. | yes | `tests/preflight.test.ts` | – |
| `prepare-document.ts` | 189 | Bounded local document scopes and source-range edits for preparation jobs. | no | `tests/prepare-document.test.ts` | – |
| `prepare-metadata.ts` | 54 | Compose existing metadata removal with per-file recovery and output inspection. | yes | indirect | – |
| `prepare-pii.ts` | 173 | Typed adaptation of community/_shared/pii.js. | no | indirect | – |
| `prepare-text.ts` | 104 | Credential and personal-data suggestions with bounded declarative rules. | yes | `tests/prepare-text.test.ts` | – |
| `prepare.ts` | 163 | Source-bound inspection, consistent replacement and content-free preparation reports. | yes | `tests/prepare.test.ts` | yes |
| `print-marks.ts` | 315 | Print-marks & bleed geometry. | yes | `tests/print-marks.test.ts` | – |
| `provenance-defaults.ts` | 91 | Whether an export carries provenance marks WHEN NOBODY SAID. | yes | `tests/provenance-defaults.test.ts` | – |
| `psd-write.ts` | 285 | Photoshop PSD writer: the write-back half of layered import (psd.ts reads). | yes | indirect | – |
| `psd.ts` | 812 | Photoshop PSD/PSB reader: layered import for the darkroom tool's layers, Layout Studio and the picker's flatten path. | yes | `tests/psd.test.ts` | yes |
| `radiance.ts` | 646 | Radiance RGBE (`.hdr` / `.pic`) reader + writer - pure bytes, DOM-free. | no | `tests/radiance.test.ts` | yes |
| `raster-layers.ts` | 235 | The shared shape for layered raster import: what psd.ts and xcf.ts both decode into. | yes | indirect | – |
| `rate-card.ts` | 689 | The printer's own rate card - stored, validated, never a source of prices. | yes | indirect | – |
| `rebrand-archetype.ts` | 472 | Which archetype a source slide should be poured into (plan 274 section 3.3). | yes | `tests/rebrand-archetype.test.ts` | – |
| `rebrand-colors.ts` | 834 | Colour assignment by use, with feasibility (plan 274 section 3.3). | yes | `tests/rebrand-colors.test.ts` | – |
| `rebrand-decisions.ts` | 364 | Carrying a person's decisions into the next revision of a deck, and applying one decision to a plan (plan 274 section 3.3, "persistence and carry-forward"). | yes | `tests/rebrand-decisions.test.ts` | – |
| `rebrand-design-system.ts` | 1281 | One design system, resolved once for the whole renovation journey (plan 274 sections 3.3 and 3.5). | yes | `tests/rebrand-design-system.test.ts` | – |
| `rebrand-edit.ts` | 733 | Pure edits to a renovation plan (plan 274 section 4, "shopping"): the one set of operations the web view, the CLI and the MCP tool apply, so a group apply or a reorder means the same thing on every surface. | yes | `tests/rebrand-edit.test.ts` | – |
| `rebrand-fonts.ts` | 162 | Which face a source deck's typefaces become (plan 274 section 3.3). | yes | `tests/rebrand-fonts.test.ts` | – |
| `rebrand-order.ts` | 19 | One string order for the census, the plan, the colour solve and the compile. | no | `tests/rebrand-order.test.ts` | – |
| `rebrand-plan.ts` | 809 | The renovation plan's automatic first pass (plan 274 sections 3.3 and 9). | yes | `tests/rebrand-plan.test.ts` | – |
| `rebrand-report.ts` | 283 | The renovation report (plan 274 section 3.4, "never drop silently"). | yes | `tests/rebrand-report.test.ts` | – |
| `rebrand-review.ts` | 1406 | The review model of a renovation (plan 274 section 4): what the queue, the footer, the report drawer, the CLI `inspect` command and later the TUI show. | yes | `tests/rebrand-review.test.ts` | – |
| `rebrand-structure.ts` | 1635 | The structure matcher (plan 275 section 3): which layout of the library a source slide was drawn as, how sure the read is, and the one opt-in action that applies the reads across a deck (decision 28, Auto-match). | yes | `tests/rebrand-structure.test.ts` | – |
| `rebrand-theme.ts` | 870 | Deck themes and a slide's own ground (plan 275 section 6), as ordinary plan edits. | yes | `tests/rebrand-theme.test.ts` | – |
| `reword.ts` | 401 | Reword flagged text - the SEMANTIC half humanize.ts's header defers (plans/127). | yes | `tests/reword.test.ts` | – |
| `riff-meta.ts` | 98 | WAV provenance tags: the RIFF LIST/INFO chunk. | yes | `tests/riff-meta.test.ts` | – |
| `rights-attribution.ts` | 323 | Turns an attribution plan into readable credits, companion files, source ingredients and a measured receipt (plan 253). | yes | `tests/rights-attribution.test.ts` | – |
| `rights-companion.ts` | 22 | Verify readable package credits without claiming a signed credential. | no | indirect | – |
| `rights-evaluate.ts` | 777 | Applies the reviewed licence profiles to recorded works, uses and one delivery context (plan 253). | yes | `tests/rights-evaluate.test.ts` | – |
| `rights-profiles.ts` | 648 | Versioned licence identifiers, the reviewed licence profiles the rights evaluator applies, and the one locator rule every credit reads (plan 253). | yes | `tests/rights-profiles.test.ts` | – |
| `rights-report.ts` | 154 | Reads a verified credential back as the three rights questions Verify asks about a file (plan 253). | yes | `tests/rights-report.test.ts` | – |
| `rpm.ts` | 443 | RPM v4 package writer - the container half of a `.rpm`. | yes | `tests/rpm.test.ts` | – |
| `runtime.ts` | 2317 | Runtime - orchestrates the 5-step lifecycle for a single mounted tool. | yes | indirect | – |
| `scorm.ts` | 627 | SCORM packaging - the pure half (plans/180 section 6). | yes | `tests/scorm.test.ts` | – |
| `seal.ts` | 756 | SEAL (hackerfactor.com) signature verifier - pure, DOM-free (globalThis.crypto only, like c2pa-verify.ts / x509.ts). | yes | `tests/seal.test.ts` | yes |
| `semver-range.ts` | 112 | Minimal SemVer range satisfaction - enough to enforce a tool manifest's `engineVersion` against the running ENGINE_VERSION (loader.ts, P0-3). | yes | `tests/semver-range.test.ts` | – |
| `sequence-marks.ts` | 60 | Version 1: v1\|m,timeMs,endMs,rrggbb,uriLabel\|i,timeMs\|o,timeMs. | no | `tests/sequence-marks.test.ts` | – |
| `session-record.ts` | 181 | Saved-session record envelope - the version stamps a shell's state bridge writes for one saved tool session, and the migrate-or-warn branch it runs on load. | yes | `tests/session-record.test.ts` | – |
| `show-if.test.ts` | 48 | matchesShowIf - the one visibility predicate for inputs and select options. | no | none | – |
| `slide-master.ts` | 944 | Seeding Design frames from a slide master (plan 274 section 3.4). | yes | `tests/slide-master.test.ts` | – |
| `slide-regions.ts` | 3014 | Region finding for a flattened slide (plan 274 section 6, point 1): a picture of a whole slide in, a list of boxes out, each classed as text, picture, rule or panel with the numbers behind the class. | yes | `tests/slide-regions.test.ts` | – |
| `slide-structures-data.ts` | 98 | GENERATED by scripts/build-slide-masters.ts from community/slide-structures/library.json. | no | none | – |
| `slide-structures.ts` | 475 | The slide layout library (plan 275 section 2). | yes | `tests/slide-structures.test.ts` | – |
| `software-origin.ts` | 164 | Software and rights declarations read from metadata, with their evidence kept alongside them. | yes | `tests/software-origin.test.ts` | – |
| `speech-model-bytes.ts` | 27 | Kokoro TTS download-size constants. | no | `tests/speech-model-bytes.test.ts` | – |
| `speech-text.ts` | 937 | Speech synthesis text machinery - the PURE half of Kokoro TTS. | yes | `tests/speech-text.test.ts` | – |
| `steganalysis.ts` | 137 | Classical LSB steganalysis - Westfeld–Pfitzmann chi-square attack | yes | `tests/steganalysis.test.ts` | – |
| `strip-metadata.ts` | 365 | Embedded-metadata stripper | yes | `tests/strip-metadata.test.ts` | yes |
| `studio3d-arrangement.ts` | 144 | Several subjects in one photograph: stable ids, selection, numerical edits and overlap guidance. | yes | `tests/studio3d-arrangement.test.ts` | – |
| `studio3d-camera-path.ts` | 351 | Camera paths: keys captured from the live view, sampled deterministically over the loop. | yes | `tests/studio3d-camera-path.test.ts` | – |
| `studio3d-collection.ts` | 231 | One studio shared by a bounded collection, with explicit per-item overrides. | yes | `tests/studio3d-collection.test.ts` | – |
| `studio3d-lights.ts` | 90 | Light placement on the preview: orbit a source about the subject and save it where the rig keeps it. | yes | `tests/studio3d-lights.test.ts` | – |
| `studio3d-look.ts` | 305 | The boundary between a studio and a document (plan 265 step 2, milestone 2 lane A). | yes | `tests/studio3d-look.test.ts` | – |
| `studio3d-motion.ts` | 273 | What the subject does over the loop (plan 267, lane A). | yes | `tests/studio3d-motion.test.ts` | – |
| `studio3d.ts` | 586 | Portable studio recipe validation, material finishes and repeatable camera time. | yes | `tests/studio3d.test.ts` | – |
| `svg-colors.ts` | 126 | Pure, DOM-free colour extraction from raw SVG source text. | yes | `tests/svg-colors.test.ts` | – |
| `svg-custgeom.ts` | 609 | Flat-SVG to native PowerPoint shapes. | yes | `tests/svg-custgeom.test.ts` | – |
| `svg-items.ts` | 1776 | A drawing as bounded, paint-ordered items (plan 275 decision 32, "vectors stay vectors"), and those items as Design rows. | yes | `tests/svg-items.test.ts` | yes |
| `svg-layers.ts` | 1790 | Lift layers - enumerate an SVG's own layers and derive a standalone document for each one (plans/104 section 7). | yes | `tests/svg-layers.test.ts` | – |
| `svg-path.ts` | 355 | SVG path `d` tokenizer. | yes | `tests/svg-path.test.ts` | – |
| `table-edit.ts` | 117 | Named table mapping, validation and atomic wall-time edits. | no | `tests/table-edit.test.ts` | – |
| `table-text.ts` | 114 | Text-to-table parsing and serialising for the `table` input (the clipboard and file round-trip). | yes | `tests/table-text.test.ts` | – |
| `tar-read.ts` | 227 | tar (USTAR / POSIX 1003.1-1988) reader. | yes | `tests/tar-read.test.ts` | yes |
| `tar.ts` | 155 | tar (USTAR / POSIX 1003.1-1988) writer. | yes | indirect | – |
| `template-cache.test.ts` | 28 |  | no | none | – |
| `template.ts` | 601 | Template hydration. | yes | indirect | – |
| `text-ascii.ts` | 99 | Small original bitmap alphabet. | no | `tests/text-ascii.test.ts` | – |
| `text-assets.ts` | 18 | Font dependencies inside a serialized text document remain visible to asset walkers. | no | indirect | – |
| `text-assist.ts` | 131 | Source-referenced, bounded prompts and acceptance rules for local text assistance. | no | indirect | – |
| `text-cleanup.ts` | 46 | Optional, reviewable typography edits; never an automatic source normalizer. | yes | `tests/text-cleanup.test.ts` | – |
| `text-composition-cache.ts` | 41 | A host-owned workspace reuses unchanged paragraphs and their settled flow prefix. | no | `tests/text-composition-cache.test.ts` | – |
| `text-design-wrap.ts` | 15 | Design adapts its authored boxes into the generic text-wrap placement contract. | yes | none | – |
| `text-design.ts` | 63 | Append-only Design text fields share one source document and independent frame geometry. | yes | `tests/text-design.test.ts` | – |
| `text-display.ts` | 21 | Display case preserves authored offsets, including characters that expand when capitalised. | no | none | – |
| `text-document.ts` | 120 | Exact text, source selections and bounded undo history for shared editors. | no | `tests/text-document.test.ts` | yes |
| `text-drop-cap.ts` | 35 | A drop capital occupies an explicit exclusion beside the first paragraph lines. | no | none | – |
| `text-edits.ts` | 141 | Immutable story commands. | yes | `tests/text-edits.test.ts` | – |
| `text-emoji.ts` | 47 | Pinned paragraph emoji use the existing artwork admission, treatment and source census. | no | none | – |
| `text-facts.ts` | 167 | Document facts - a NEUTRAL census of what a text observably contains, for the verify and catalog panels' interrogation surface. | yes | `tests/text-facts.test.ts` | – |
| `text-flow.ts` | 83 | Rectangular flow advances through the authored frame order, independent of paint order. | no | `tests/text-flow.test.ts` | – |
| `text-formats.ts` | 93 | Portable formatters and loss-aware structured text conversions. | no | indirect | – |
| `text-fragment.ts` | 49 | Portable text fragments resolve styles and rehome font ids without changing source. | yes | `tests/text-fragment.test.ts` | – |
| `text-frame-clipboard.ts` | 50 | Portable frame copies carry independent text and exact font pins, never live story references. | yes | `tests/text-frame-clipboard.test.ts` | – |
| `text-frame.ts` | 29 | Bounded text frame admission, separate from the story's immutable source. | yes | indirect | yes |
| `text-hyphenation.ts` | 67 | Pinned Liang patterns produce candidate offsets, never edited source text. | yes | `tests/text-hyphenation.test.ts` | – |
| `text-layout-cache.ts` | 26 | Bounded settled results for synchronous clipboard events. | yes | indirect | – |
| `text-layout-svg.ts` | 44 | Settled text becomes vector markup without a second shaping or wrapping pass. | yes | `tests/text-layout-svg.test.ts` | – |
| `text-layout.ts` | 155 | DOM-free authored text composition. | yes | `tests/text-layout.test.ts` | – |
| `text-line-layout.ts` | 51 | Shared settled glyph, inline and caret placement for a rectangular line. | no | none | – |
| `text-line-policy.ts` | 70 | Bounded paragraph optimisation over admitted source boundaries. | no | `tests/text-line-policy.test.ts` | – |
| `text-lines.ts` | 128 | Shared line selection. | no | none | – |
| `text-logs.ts` | 214 | Log text retains source offsets even when an event cannot be classified. | yes | indirect | – |
| `text-operations.ts` | 275 | Discoverable text actions and their portable option declarations. | yes | `tests/text-operations.test.ts` | – |
| `text-paragraph.ts` | 175 | Contextual paragraph shaping with logical source and visual placement kept apart. | yes | `tests/text-paragraph.test.ts` | – |
| `text-path.ts` | 86 | Shaped clusters follow one authored guide without reversing or rewriting their source. | no | `tests/text-path.test.ts` | – |
| `text-recipes.ts` | 10 | Recipes apply only to new work or an explicit paragraph command. | yes | none | – |
| `text-scale.ts` | 22 | Explicit typography scaling keeps literal text and named-style identity intact. | yes | indirect | – |
| `text-semantic.ts` | 10 | Inline vectors keep their source's bidi and break semantics while occupying one source unit. | yes | indirect | – |
| `text-signals.ts` | 1102 | Text AI-likelihood signals - a string in, a tiered report of the signals that bear on "was this text generated by (or run through) an AI model" out. | yes | `tests/text-signals.test.ts` | – |
| `text-source.ts` | 70 | Source boundary helpers shared by editing and composition. | yes | indirect | yes |
| `text-spacing.ts` | 38 | Word spacing moves clusters and source carets together without scaling glyph ink. | yes | indirect | – |
| `text-story-document.ts` | 119 | Text document admission and exact source round trips. | yes | indirect | – |
| `text-style-commands.ts` | 36 | Style commands retain source, literal ranges and no-break constraints. | yes | indirect | – |
| `text-styles.ts` | 41 | Style resolution is shared by composition, controls and typed text insertion. | yes | `tests/text-styles.test.ts` | – |
| `text-syntax.ts` | 179 | Shared lexical highlighting. | yes | indirect | – |
| `text-tabs.ts` | 24 | Tab fields follow authored stops measured from the paragraph's writing edge. | no | none | – |
| `text-thai.ts` | 47 | Deterministic dictionary segmentation; unknown runs remain intact. | no | `tests/text-thai.test.ts` | – |
| `text-thread-commands.ts` | 129 | Atomic story ownership commands. | yes | `tests/text-thread-commands.test.ts` | – |
| `text-tools.ts` | 557 | On-device text transformations with platform services injected by the host. | yes | indirect | – |
| `text-unicode.ts` | 96 | Unicode 17 source analysis. | no | `tests/text-unicode.test.ts` | – |
| `text-vector.ts` | 78 | Conversion consumes settled output, including its decorations, artwork and path poses. | no | `tests/text-vector.test.ts` | – |
| `text-watermark.ts` | 227 | Statistical text watermark - the green-list scheme of Kirchenbauer et al., "A Watermark for Large Language Models" (arXiv:2301.10226), as Lolly's own generation paths embed it and /verify detects it. | yes | `tests/text-watermark.test.ts` | – |
| `text-wrap.ts` | 73 | Explicit same-artboard obstacles produce bounded line-band exclusions. | no | `tests/text-wrap.test.ts` | – |
| `tiff.ts` | 224 | Baseline TIFF encoder (uncompressed, single strip, little-endian). | yes | `tests/tiff.test.ts` | – |
| `timebase.ts` | 31 | Project time stays in seconds; frame arithmetic always goes through this module. | no | `tests/timebase.test.ts` | – |
| `token-ext.ts` | 27 | The DTCG vendor-extension namespace, alone in its own module. | no | indirect | – |
| `tokens.ts` | 560 | Design tokens: a platform-agnostic DTCG model. | yes | `tests/tokens.test.ts` | – |
| `tool-url.ts` | 173 | Lolly tool-URL recognition. | yes | `tests/tool-url.test.ts` | – |
| `trustmark.ts` | 971 | Adobe TrustMark: BCH data-layer decode (pure GF(2^7) math, DOM-free). | yes | `tests/trustmark.test.ts` | – |
| `units.ts` | 98 | Physical unit conversions for output dimensions - platform-agnostic, no DOM. | yes | `tests/units.test.ts` | – |
| `url-mode.ts` | 1056 | URL mode. | yes | indirect | – |
| `url-pack.ts` | 360 | Packed URL state - the compact transport for large tool state. | yes | `tests/url-pack.test.ts` | yes |
| `validate.ts` | 78 | Validates a tool manifest against the JSON Schema. | yes | indirect | – |
| `vector-paint-import.ts` | 61 | Lower admitted static artwork into editable contours and a separate paint tree. | yes | indirect | – |
| `vector-paint-parts.ts` | 30 | Separate paint groups only where inherited compositing can remain exact. | no | indirect | – |
| `vector-paint.ts` | 107 | Paint trees reference authored contours; geometry has exactly one writable source. | yes | `tests/vector-paint.test.ts` | yes |
| `vector-text.ts` | 758 | Outlined labels as live text (plan 275 section 9.3). | no | `tests/vector-text.test.ts` | – |
| `version.ts` | 16 | The engine's HostV1 contract version. | yes | indirect | – |
| `video-meta.ts` | 437 | Video provenance - embeds the export authorship record (metadata.js) into the two MediaRecorder containers, which are produced bare (no metadata slot exists during recording, so the shell post-processes the finished… | yes | `tests/video-meta.test.ts` | yes |
| `watermark-search.ts` | 257 | Lolly pixel watermark - multi-scale + offset recovery search | yes | `tests/watermark-search.test.ts` | – |
| `wav.ts` | 267 | WAV reader/writer. | yes | `tests/wav.test.ts` | yes |
| `webp-anim-decode.ts` | 219 | Animated WebP demuxer - pure, DOM-free, platform-agnostic. | yes | `tests/webp-anim-decode.test.ts` | – |
| `webp-anim.ts` | 164 | Animated WebP packer - pure, DOM-free, platform-agnostic. | yes | `tests/webp-anim.test.ts` | – |
| `wmf.ts` | 333 | WMF (Windows Metafile, 16-bit) emitter - pure, DOM-free, platform-agnostic. | yes | `tests/wmf.test.ts` | – |
| `x509.ts` | 316 | DER / X.509 authority - pure, DOM-free (globalThis.crypto only; browsers and Node 18+). | yes | `tests/x509.test.ts` | yes |
| `xcf.ts` | 623 | GIMP XCF reader - the second layered-bitmap import format beside psd.ts, decoding into the same {@link LayeredRasterDoc}. | yes | `tests/xcf.test.ts` | yes |
| `xlsx-import.ts` | 553 | xlsx-import.ts - read the first worksheet of an .xlsx into a plain grid. | yes | `tests/xlsx-import.test.ts` | – |
| `xlsx-write.ts` | 267 | xlsx-write.ts - write a plain grid out as a valid SpreadsheetML .xlsx. | yes | `tests/xlsx-write.test.ts` | – |
| `xml-escape.ts` | 16 | The one XML text/attribute escaper for the document writers (EPUB, ODT, AppStream). | no | `tests/xml-escape.test.ts` | – |
| `xmp-fields.ts` | 48 | Bounded XMP/RDF property reader for metadata evidence, including namespace aliases. | no | none | – |
| `zip-crypto.ts` | 344 | Two-tier zip encryption - the crypto behind the "lock this download" option. | yes | `tests/zip-crypto.test.ts` | – |
| `zip.ts` | 452 | zip.ts - the shared PLAIN (unencrypted) zip primitive. | yes | `tests/zip.test.ts` | – |
| `zzfx-compose.ts` | 446 | ZzFXM composition - the shared ZzFX preset bank + the archetype composer behind Lolly's procedural music (Neurospicy Mode tracks, video music beds, the ingest/generator scripts). | yes | `tests/zzfx-compose.test.ts` | – |
| `zzfxm-ref.ts` | 102 | zzfxm-ref.ts: the `zzfxm:<seed>[:<style>]` asset id, and nothing else. | yes | `tests/zzfxm-ref.test.ts` | – |
| `zzfxm.ts` | 493 | ZzFXM procedural-music renderer. | yes | `tests/zzfxm.test.ts` | yes |
<!-- engine-modules:end -->
