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

The table is generated by `node scripts/gen-engine-modules.ts` (`pnpm run build:engine-modules`). It carries no line counts and no totals, so a row changes only when its own module is added, removed or renamed, or when that module's purpose sentence, export, test or fuzz status changes. A pull request that does one of those commits its own rows, and two pull requests that touch different modules touch different lines. CI's typecheck job and the pre-push hook run `--check`, which lists the rows that differ. Purpose comes from each file's leading doc comment, so the way to improve a row is to improve that comment.

<!-- engine-modules:start -->
One row per module under `engine/src/` (the `index.ts` barrel excluded), in path order. Generated by `node scripts/gen-engine-modules.ts` - do not hand-edit between the markers.

| Module | Purpose | Public? | Test | Fuzzed |
|---|---|:--:|---|:--:|
| `adobe-xml.ts` | Format readers share XML admission; the shell supplies the parser. | no | indirect | yes |
| `agent-view.ts` | agent-view.ts - helpers that let an agent LOOK at a render in the render's own coordinates: frame a region of it, lay a labelled grid over it, read colours at points, and name the nearest design-system colour (plans/289… | yes | `tests/agent-view.test.ts` | – |
| `ai-kind.ts` | The IPTC DigitalSourceType slugs that denote AI/ML-generated pixels, and the one lookup every reader shares. | no | `tests/ai-kind.test.ts` | – |
| `apng-decode.ts` | APNG demuxer - pure, DOM-free, platform-agnostic. | yes | `tests/apng-decode.test.ts` | – |
| `apng.ts` | APNG packer - pure, DOM-free, platform-agnostic. | yes | `tests/apng.test.ts` | – |
| `app-surface.ts` | A small, DOM-free description of an exportable Lolly application surface. | yes | `tests/app-surface.test.ts` | – |
| `appstream.ts` |  | yes | `tests/appstream.test.ts` | – |
| `asset-modifiers.ts` | Asset reference syntax, without icon rendering or photo processing dependencies. | no | none | – |
| `asset-provider.ts` | Pure grammar for logical asset references. | yes | `tests/asset-provider.test.ts` | – |
| `asset-rights.ts` | One reader for the rights an asset carries, and the one answer to "may these bytes be passed on?" (plan 253). | yes | `tests/asset-rights.test.ts` | – |
| `asset-version.ts` | Explicit asset versions, portable through typed state and URL-mode values. | yes | `tests/asset-version.test.ts` | – |
| `audio-analyse.ts` | Audio analysis - decoded PCM in, a per-frame reactivity track out. | yes | `tests/audio-analyse.test.ts` | – |
| `audio-clean.test.ts` |  | no | none | – |
| `audio-clean.ts` | Deterministic PCM finishing shared by host.audio implementations. | yes | `tests/audio-clean.test.ts` | – |
| `audio-dynamics.ts` | audio-dynamics.ts - the master true-peak limiter (plans/165 Slice E, plans/101 section 2.5). | yes | `tests/audio-dynamics.test.ts` | – |
| `audio-fx.ts` | audio-fx.ts - the per-clip effect kernels and the `fx` chain grammar (plans/101 sections 2.2 + 3.4, plans/165's deferred tier). | yes | `tests/audio-fx.test.ts` | – |
| `audio-loudness.ts` | audio-loudness.ts - ITU-R BS.1770-4 integrated loudness (plans/101 section 2.5, plans/165's deferred tier). | yes | `tests/audio-loudness.test.ts` | – |
| `audio-repair.ts` | audio-repair.ts - the plan for model-free audio repair (plans/342, package K4). | yes | indirect | – |
| `auxiliary-metadata.ts` | Readable XMP/RDF evidence belonging to an embedded JPEG rendition. | no | `tests/auxiliary-metadata.test.ts` | – |
| `bake.ts` | Bake - freeze a composed render into a static asset, plus the shared compose recursion policy (the depth/cycle guard every shell bridge enforces). | yes | indirect | – |
| `batch.ts` | Batch - the shared, DOM-free contract for "many URL-mode rows under one file". | yes | indirect | – |
| `bmp.ts` | BMP (Windows Bitmap) - uncompressed BI_RGB encoder + decoder. | yes | `tests/bmp.test.ts` | – |
| `brand-check.ts` | Checks authored Design values against one selected design system. | yes | indirect | – |
| `brand-context.ts` | Portable facts and explicit rules derived from the selected token document. | yes | `tests/brand-context.test.ts` | – |
| `brand-derive.ts` | Brand derivation. | yes | `tests/brand-derive.test.ts` | – |
| `brand-evidence.ts` | Bounded style observations shared by saved-page and browser capture readers. | yes | indirect | – |
| `brand-import.ts` | Brand token ingestion. | yes | `tests/brand-import.test.ts` | yes |
| `brand-map.ts` | Brand mapper. | yes | `tests/brand-map.test.ts` | – |
| `brand-page-address.ts` | The address of a design system's published brand page, as an export may record it (plan 351 B5, approved 2026-11-05: the design-system record gains the address only when the publisher opts in per brand, off until a page… | yes | indirect | – |
| `brand-page-render.ts` | The text files of a brand page: the page for people, its markdown twin, the agent file and the agent index. | no | none | – |
| `brand-page.ts` | A brand page: one published address that is a press kit and an agent kit. | no | `tests/brand-page.test.ts` | – |
| `brand-policy.ts` | Shared managed-input projection and evidence checks. | no | `tests/brand-policy.test.ts` | – |
| `brand-resources.ts` | Asset dependencies in brand vocabulary, independent of labels and rule prose. | no | indirect | – |
| `brand-rules.ts` | Bounded predicates for named example slots. | no | `tests/brand-rules.test.ts` | – |
| `brand-schemes.ts` | Brand scheme accents. | yes | `tests/brand-schemes.test.ts` | – |
| `brand-skill.ts` | Brand skills (plan 323): reading, admitting, mapping and exporting a brand's standards when they arrive as Agent Skills. | yes | `tests/brand-skill.test.ts` | – |
| `brand-system.ts` | Reads portable brand vocabulary and rule records without claiming enforcement. | no | `tests/brand-system.test.ts` | – |
| `brand-treatments.ts` | Brand-derived photo treatments + icon duo themes. | yes | `tests/brand-treatments.test.ts` | – |
| `bridge/host-v1.ts` | Capability Bridge - v1 (re-export). | no | indirect | – |
| `bytes.ts` | Shared byte-level primitives for the engine's binary/crypto format modules (c2pa, c2pa-verify, seal, x509, zip-crypto, pdf-crypto-r6, …). | yes | indirect | – |
| `c2pa-approval.ts` | Recording an approval in a file's Content Credentials. | yes | indirect | – |
| `c2pa-containers.ts` | C2PA container placement - the per-format byte-splicing side of the writer: classic-xref PDF incremental update, the png/jpeg/gif/svg/tiff/webp embedders, ISO BMFF (mp4) with its own c2pa.hash.bmff.v2 binding, and the… | yes | `tests/c2pa-containers.test.ts` | yes |
| `c2pa-extract.ts` | C2PA structural extraction - the read side's format-sniffing, CBOR decoding, JUMBF-store walking, and per-container manifest extraction (pdf/png/jpeg/gif/ svg/tiff/webp/mp4/webm/mp3/wav, plus the C2PA 2.4 TEXT bindings… | yes | `tests/c2pa-extract.test.ts` | yes |
| `c2pa-svg.ts` | Where an SVG document's own Content Credential lives: a `<c2pa:manifest>` element in a `<metadata>` element that is a direct child of the root `<svg>` (C2PA specification, Appendix A, the SVG embedding). | no | `tests/c2pa-svg.test.ts` | – |
| `c2pa-trust.ts` | Vendored C2PA trust anchors - the root/anchor certificates whose signing chains verifyC2pa() upgrades from "valid" to TRUSTED (a named, CA-verified signer). | yes | `tests/c2pa-trust.test.ts` | – |
| `c2pa-verdict.ts` | C2PA verdict resolution - the single source of truth for (a) the check-code vocabulary verifyC2pa emits, (b) the flags→verdict ladder every surface renders, and (c) trust-anchor assembly. | yes | `tests/c2pa-verdict.test.ts` | – |
| `c2pa-verify.ts` | C2PA (Content Credentials) verifier - pure, DOM-free. | yes | `tests/c2pa-verify.test.ts` | yes |
| `c2pa.ts` | C2PA (Content Credentials) manifest builder + PDF embedder - pure, DOM-free. | yes | `tests/c2pa.test.ts` | – |
| `calc.ts` | calc.ts - the formula engine's request and answer shapes, for any shell. | yes | indirect | – |
| `camera-raw-preset.ts` | Explicit Camera Raw settings mapped to Darkroom's existing input values. | yes | indirect | – |
| `canonical-json.ts` | Deterministic JSON with sorted object keys and preserved array order. | no | none | – |
| `captions-scc.ts` | SCC (Scenarist Closed Caption) pop-on captions, read and written as pure functions. | yes | indirect | yes |
| `captions-ttml.ts` | TTML2 and IMSC1.1 Text Profile captions, read and written as pure functions. | yes | indirect | yes |
| `captions.ts` | Captions - spoken-word timings in, subtitle cues out. | yes | `tests/captions.test.ts` | – |
| `catalog-integrity.ts` | Catalog signing + runtime integrity verification - the SOVEREIGNTY.md "catalog origin is a trust anchor" gap, closed. | yes | `tests/catalog-integrity.test.ts` | – |
| `chart-spec.ts` | Pure ChartSpecV1 helpers. | yes | `tests/chart-spec.test.ts` | – |
| `check-fidelity.ts` | Fidelity of a Design document to the deck it recreates (plan 291, W1). | yes | `tests/check-fidelity.test.ts` | – |
| `chroma-key.test.ts` | engine/src/chroma-key.ts - the perceptual (OKLab) colour-range key behind the video-matte "Colour key" method (plans/124 WP-G). | no | none | – |
| `chroma-key.ts` | Chroma / colour-range keying: remove a flat background colour by PERCEPTUAL distance, so clean footage shot against an evenly-lit wall or screen keys out without the neural matte model at all (plans/124 WP-G). | yes | none | – |
| `clamp.ts` | The one numeric clamp. | yes | `tests/clamp.test.ts` | – |
| `claudisms.ts` | AI writing-tell patterns for the text-signal analyzer (engine/src/text-signals.ts). | no | `tests/claudisms.test.ts` | – |
| `cmyk-palette.ts` | The brand-swatch → CMYK lookup every CMYK sink shares. | yes | `tests/cmyk-palette.test.ts` | – |
| `cmyk-separation.ts` | RGB to CMYK through a press profile: the separation a print export writes. | yes | `tests/cmyk-separation.test.ts` | – |
| `color-curve.ts` | color-curve.ts - a serializable tonal-curve model for brand colour ramps. | yes | `tests/color-curve.test.ts` | – |
| `color-describe.ts` | One colour, fully described. | yes | `tests/color-describe.test.ts` | – |
| `color-face.ts` | Select an authored colour face without reducing wide-gamut values to hex. | no | `tests/color-face.test.ts` | – |
| `color-faces.ts` | A brand colour's FACES: one canonical value, plus what it becomes in every space and on every press it can be expressed in. | yes | `tests/color-faces.test.ts` | – |
| `color-tools.ts` | Colour tools: perceptual metrics and ramp math on top of brand-derive's OKLab core. | yes | `tests/color-tools.test.ts` | – |
| `color-vision.ts` | Colour-vision-deficiency (CVD) simulation - Machado, Oliveira & Fernandes (2009). | yes | `tests/color-vision.test.ts` | – |
| `color.ts` | Colour profiles for exports: platform-agnostic, no DOM, no network. | yes | `tests/color.test.ts` | – |
| `colour-role-portable.ts` | Colour roles in other formats (plans/352 R4): what a role's words become when a design system leaves Lolly, and how they come back. | yes | indirect | – |
| `colour-roles.ts` | Colour roles: a design system's colours in its own words (plans/352). | yes | `tests/colour-roles.test.ts` | – |
| `colourway.ts` | Colourways: several lead colours in one design system (plans/319). | yes | `tests/colourway.test.ts` | – |
| `compare-alignment.ts` | Unique-key matching keeps the longest common order instead of moving every later item. | no | none | – |
| `compare-budget.ts` | Work and output limits shared by comparison algorithms. | no | `tests/compare-budget.test.ts` | – |
| `compare-document.ts` | Extracted units retain their original locations and disclose ambiguous matching. | no | none | – |
| `compare-structure.ts` | Structured field comparison with ordered arrays and optional stable-ID moves. | no | `tests/compare-structure.test.ts` | – |
| `compare-tables.ts` | Bounded sheets, columns and cells; row keys are chosen explicitly. | no | none | – |
| `compare-text.ts` | Bounded line and word alignment with original source locations. | no | `tests/compare-text.test.ts` | – |
| `compare-visual.ts` | Bounded preview comparison. | yes | `tests/compare-visual.test.ts` | – |
| `compare-yaml.ts` | Ordinary YAML data for structure comparison, without alias or tag evaluation. | yes | `tests/compare-yaml.test.ts` | – |
| `compare.ts` | Shared bounded comparison of supplied immutable content snapshots. | yes | `tests/compare.test.ts` | – |
| `compose.ts` | Compose: resolve a tool's manifest `composes` entries into embeddable assets. | no | `tests/compose.test.ts` | – |
| `connectors.ts` | Connector / line / arrow geometry - the ONE source (plan 90 R1). | yes | indirect | – |
| `content-inventory.ts` | content-inventory.ts - what a source deck says, slide by slide, for an agent that has to rebuild the deck (plan 291 W2). | yes | `tests/content-inventory.test.ts` | – |
| `contentseal.ts` | Meta Content Seal (Pixel Seal / Video Seal, IMAGE mode). | yes | `tests/contentseal.test.ts` | – |
| `cpio.ts` | cpio "newc" (SVR4 / `070701`) writer. | yes | `tests/cpio.test.ts` | – |
| `creation-feedback.ts` | Creation feedback for a Design document: one report that informs a person or an agent while they make the document, and never blocks anything. | yes | `tests/creation-feedback.test.ts` | – |
| `css-box.ts` | Pure, DOM-free CSS box-model + border-radius geometry. | yes | `tests/css-box.test.ts` | – |
| `css-color.ts` | One CSS Color 4 colour value. | yes | `tests/css-color.test.ts` | – |
| `css-paint.ts` | Pure, DOM-free CSS "paint" value parsers: clip-path basic shapes, gradient stops + radial-gradient geometry, and drop-shadow filters. | yes | `tests/css-paint.test.ts` | – |
| `dash-fit.ts` |  | yes | `tests/dash-fit.test.ts` | – |
| `data-import.ts` | Data-file → blocks rows. | yes | `tests/data-import.test.ts` | yes |
| `deck-census-hash.ts` | Small pure hashes the deck census uses to GENERATE candidates (plan 274 section 3.2): a difference hash over a decoded picture, a translation-free hash over vector path data, a digit-wildcarded key for repeated text… | yes | indirect | – |
| `deck-census-rules.ts` | The class rules of the deck census (plan 274 section 3.2), as one pure function over plain numbers. | yes | indirect | – |
| `deck-census-vector.ts` | What the census reads from a drawing's items (plan 275 decision 32). | yes | none | – |
| `deck-census.ts` | Stage 2 of the renovation journey (plan 274 section 3.2): a read source deck in, a `DeckCensusV1` out. | yes | indirect | – |
| `deck-compile.ts` | Compile a read source deck into Design's own authored values (plan 274 section 3.4, stage 5). | yes | indirect | – |
| `deck-md.ts` | deck-md.ts - serialise a .pptx READ-MODEL to Deck Studio's markdown dialect. | yes | indirect | – |
| `deep-codec-api.ts` | Shared codec operations. | no | none | – |
| `deep-compose.ts` | Linear-light compositing with premultiplied interpolation and straight storage. | no | indirect | – |
| `deep-decode.ts` | Original-byte HDR decode. | no | indirect | – |
| `deep-encode.ts` | deep-encode - one place that turns a linear {@link DeepFrame} into finished image bytes at the depth the caller asked for. | no | indirect | – |
| `deep-export.ts` | Encode a real float render without rasterising its display preview. | no | `tests/deep-export.test.ts` | – |
| `deep-exr.ts` | Single-part RGB(A) scanline OpenEXR, NONE/ZIPS/ZIP, HALF/FLOAT/UINT. | no | indirect | – |
| `deep-image.ts` | Shared precision limits and transfer functions for deep stills and video. | no | indirect | yes |
| `deep-png.ts` | Bounded PNG 8/16 ingest, including Adam7, ICC and PQ/HLG cICP. | no | indirect | – |
| `deep-tiff.ts` | Bounded classic TIFF RGB/gray strips at 8/16-bit integer or 32-bit float. | no | indirect | – |
| `deep-video.ts` | WebCodecs raw planes to linear float, before any browser canvas conversion. | no | `tests/deep-video.test.ts` | – |
| `deflate.ts` | Raw DEFLATE compressor + zlib wrapper - the byte-emitting half the engine was missing. | yes | `tests/deflate.test.ts` | – |
| `der-read.ts` | DER/ASN.1 read-side authority - the bounds-checked TLV walker plus the ECDSA signature-shape conversions and the EC named-curve table, shared by the certificate/signature modules (c2pa-verify.ts, x509.ts, seal.ts). | no | `tests/der-read.test.ts` | yes |
| `derived-formats.ts` | Derived export formats - the ones that are a trivial, lossless transform of a format a tool already declares, so a tool that can emit the parent can emit the child for free. | yes | `tests/derived-formats.test.ts` | – |
| `design-authoring.ts` | Design authoring keys lowered to stored rows (plan 291 W5, contract `@lolly-tools/core` design-authoring-v1). | yes | `tests/design-authoring.test.ts` | – |
| `design-brief.ts` | The design brief (plan 291 W3): everything an agent needs to compose on brand, as one JSON document per design system. | yes | `tests/design-brief.test.ts` | – |
| `design-check.ts` | One finding shape for every Design checker (plan 291, W1). | yes | `tests/design-check.test.ts` | – |
| `design-colour-refs.test.ts` | Plan 291 W4: one document, every theme. | no | none | – |
| `design-components.ts` | Penpot component definitions → template descriptors (pure collectors). | yes | `tests/design-components.test.ts` | – |
| `design-compose-suggest.ts` | A first compose spec for a source deck (plan 291 W6, `lolly compose --suggest`, `lolly_compose` in suggest mode): one slide per source slide, each with a master archetype, its slots filled by reference to the inventory… | yes | `tests/design-compose-suggest.test.ts` | – |
| `design-compose.ts` | Compose Design slides from slide-master archetypes (plan 291 W6, contract `@lolly-tools/core` design-compose-v1). | yes | `tests/design-compose.test.ts` | – |
| `design-draw-lottie.ts` | The internal legacy dotLottie vector reading and its operation consumer. | no | `tests/design-draw-lottie.test.ts` | – |
| `design-draw-pdf.ts` | Drawing operations written as PDF (plan 295, phase 3, P3d). | no | `tests/design-draw-pdf.test.ts` | – |
| `design-draw-penpot.ts` | Penpot's existing flat-primitive and gradient reading, separate from Design's CSS geometry. | no | `tests/design-draw-penpot.test.ts` | – |
| `design-draw-pptx.ts` | The native deck's primitive, linear-gradient and single-path reading, distinct from Design's CSS geometry. | no | `tests/design-draw-pptx.test.ts` | – |
| `design-draw-raster.ts` | Internal P3f admission. | no | `tests/design-draw-raster.test.ts` | – |
| `design-draw-svg.ts` | Drawing operations written as SVG (plan 295, phase 3, P3a). | no | indirect | – |
| `design-draw.ts` | Authored Design rows compiled into drawing operations (plan 295, phase 3, P3a). | no | `tests/design-draw.test.ts` | – |
| `design-export-route.ts` | Which renderer draws a Design export (plan 326). | no | none | – |
| `design-hierarchy.ts` | Document ownership is independent of geometry and the active editor canvas. | yes | `tests/design-hierarchy.test.ts` | – |
| `design-house-rules.ts` | House rules for a Design document (plan 291 W1 and W3): brand rule records whose kind is one of `DESIGN_HOUSE_RULE_KINDS`, checked layer by layer against the boxes a Design document stores. | yes | `tests/design-house-rules.test.ts` | – |
| `design-idml.ts` | Deterministic IDML for static Design text, rectangular/oval frames and still images. | no | indirect | – |
| `design-layer-ops.ts` | Design layer edits by stable id (plans/289 D1): `layerOperations` (add, duplicate, remove, reparent, reorder) and `layerPatches` (set fields on one layer). | no | `tests/design-layer-ops.test.ts` | – |
| `design-layout-resources.ts` | Font role names for layout measurement, matching the canvas's brand font variables. | yes | `tests/design-layout-resources.test.ts` | – |
| `design-layout.ts` | Design's layout adapter. | yes | `tests/design-layout.test.ts` | – |
| `design-lottie.ts` | Authored Design values into the shared sequence compiler, identical on every host. | no | `tests/design-lottie.test.ts` | – |
| `design-map-affinity.ts` | An Affinity document model mapped to Design rows (K3, stage 2). | no | indirect | – |
| `design-map-bannerbear.ts` | A Bannerbear V5 image template mapped to Design rows. | no | `tests/design-map-bannerbear.test.ts` | – |
| `design-map.ts` | Design-file → Design boxes (pure mapper). | yes | `tests/design-map.test.ts` | – |
| `design-md.ts` | DESIGN.md in and out (`google-labs-code/design.md`, version `alpha`). | yes | `tests/design-md.test.ts` | yes |
| `design-page-svg.ts` | A Design page exported as SVG from drawing operations (plan 295, phase 3, P3d). | no | `tests/design-page-svg.test.ts` | – |
| `design-path-author.ts` | Absolute path geometry to a stored Design path row (plan 291 W5). | yes | `tests/design-path-author.test.ts` | – |
| `design-premiere.ts` | Authored media clips into a Premiere XML package with original media bytes. | no | indirect | – |
| `design-scene.ts` | The Design scene grammar - what a `kind:'3d'` box's `scene` field holds, and the only place that grammar lives (plan 265 milestone 3, decision Q17). | yes | indirect | – |
| `design-stroke.ts` | Stroke position and per-side stroke widths for Design rows. | yes | indirect | – |
| `design-system.ts` | design-system.ts - the identity and namespace rules for holding SEVERAL design systems on one device (plans/186 section 6). | yes | `tests/design-system.test.ts` | – |
| `design-text-measure.ts` | Measure a plain Design text layer before it is drawn (plan 291, W5): where its lines break, how tall the text is, and whether its box clips the text. | yes | `tests/design-text-measure.test.ts` | – |
| `design-text-style.ts` | Named text styles for Design authoring (plan 291 W5). | yes | indirect | – |
| `design-text.ts` | Formatted source text to Design's text subset and back (plan 275 section 7.2). | yes | `tests/design-text.test.ts` | – |
| `design-tool/compiler.ts` |  | yes | indirect | – |
| `design-tool/layout-preflight.ts` | Worker receipts are checked by the runtime that owns the exported DOM. | no | none | – |
| `design-tool/policy.ts` |  | yes | indirect | – |
| `design-tool/session-compiler.ts` | Compile a captured tool session without replacing its renderer. | yes | indirect | – |
| `design-tool/text-preflight.ts` | Worker hooks return receipts; only the runtime inspects the exported DOM. | no | none | – |
| `design-version.ts` | design-version.ts - the pure model behind versioned design systems (plans/97 section 6a). | yes | `tests/design-version.test.ts` | – |
| `doc-md.ts` | doc-md.ts - the two serialisers over `doc-model.ts`: GFM markdown, and the HTML projection a rich-text editor ingests. | yes | `tests/doc-md.test.ts` | – |
| `doc-model.ts` | doc-model.ts - the ONE block model every document reader produces and every document serialiser consumes. | yes | indirect | – |
| `document-api.ts` | Stable, transport-neutral document/compiler verbs. | yes | `tests/document-api.test.ts` | – |
| `docx-metadata.ts` | Selected DOCX property removal without reconstructing document content. | no | `tests/docx-metadata.test.ts` | – |
| `docx-read.ts` | docx-read.ts: PARSE an unzipped .docx part map into `doc-model.ts` blocks. | yes | `tests/docx-read.test.ts` | yes |
| `docx.ts` | DOCX (Word / WordprocessingML OOXML) builder. | yes | `tests/docx.test.ts` | – |
| `dotlottie.ts` | dotLottie v1/v2 and raw JSON, with exact source bytes retained by the caller. | no | indirect | – |
| `draw-color.ts` | One reading of an authored colour as sRGB and opacity, shared by the drawing compiler (`design-draw.ts`) and the Penpot lowering. | no | none | – |
| `dxf-design.ts` | A flattened DXF drawing as Design boxes. | yes | indirect | – |
| `dxf-import.ts` | DXF import: the flat entity list from the shell's tag reader to paths, text and a report. | yes | `tests/dxf-import.test.ts` | – |
| `dxf.ts` | DXF (AutoCAD Drawing Interchange) emitter - pure, DOM-free, platform-agnostic. | yes | `tests/dxf.test.ts` | yes |
| `edge-trace.ts` | edge-trace.ts - the edges in a picture as polylines, so whoever draws by hand (an agent placing a path box, a person tracing a subject) knows where the lines really are (plans/289 sections 6 and 10). | yes | indirect | – |
| `embed.ts` | Embed URL grammar - the portable surface of tool composition. | yes | `tests/embed.test.ts` | – |
| `emf.ts` | EMF (Enhanced Metafile) emitter - pure, DOM-free, platform-agnostic. | yes | `tests/emf.test.ts` | – |
| `emoji-author.ts` | Author a versioned set from labelled SVGs. | no | `tests/emoji-author.test.ts` | – |
| `emoji-bundle.ts` | Full pack admission for user imports. | no | indirect | yes |
| `emoji-default.ts` | Shared emoji defaults beneath explicit document, brand and personal choices. | no | indirect | – |
| `emoji-dom.ts` | Replace emoji in a rendered tree with pinned pack artwork, over a minimal node interface. | yes | `tests/emoji-dom.test.ts` | – |
| `emoji-inline.ts` | inline-em-v1 sizing, and prepared plus treated emoji artwork for one run of text. | no | `tests/emoji-inline.test.ts` | – |
| `emoji-line.ts` | Experimental single LTR line master. | no | `tests/emoji-line.test.ts` | – |
| `emoji-pack.ts` | Validate pinned emoji manifests and artwork bytes without performing IO or rendering SVG. | no | `tests/emoji-pack.test.ts` | yes |
| `emoji-resolve.ts` | Resolve one complete emoji meaning through an explicit, ordered chain of verified pack pins. | no | `tests/emoji-resolve.test.ts` | – |
| `emoji-rights.ts` | Turn a compiled line's emoji source census into Content Credentials source ingredients and readable credits. | no | `tests/emoji-rights.test.ts` | – |
| `emoji-segment.ts` | Pinned Unicode 17.0 extended grapheme segmentation and mixed emoji/text spans. | no | `tests/emoji-segment.test.ts` | – |
| `emoji-sequence.ts` | Whole-sequence emoji recognition from pinned Unicode data, independent of the host's ICU. | no | `tests/emoji-sequence.test.ts` | – |
| `emoji-source-records.ts` | Portable source declarations retain their original attribution after vector conversion. | no | indirect | – |
| `emoji-style.ts` | Store explicit emoji typography in the existing DTCG vendor extension without changing other tokens. | no | indirect | – |
| `emoji-svg-syntax.ts` | Bounded lexical checks for the initial static emoji SVG subset. | no | indirect | – |
| `emoji-svg-text.ts` | Mixed SVG text uses shaped outlines and the same prepared emoji as HTML. | no | `tests/emoji-svg-text.test.ts` | – |
| `emoji-svg.ts` | Admit verified artwork to a bounded static SVG subset without silent visual removals. | no | `tests/emoji-svg.test.ts` | yes |
| `emoji-text-path.ts` | Bounded path sampling for mixed text and emoji on an SVG baseline. | yes | indirect | – |
| `emoji-tool-text.ts` | Mixed vector text for tools that sample artwork or paint their own canvas. | no | indirect | – |
| `emoji-treatment.ts` | Recolour admitted emoji artwork to a brand palette, deterministically, leaving protected meanings alone. | no | `tests/emoji-treatment.test.ts` | – |
| `emoji-trigger.ts` | The cheap test for "might this text carry an emoji", on its own so the runtime can ask without loading the pinned tables. | no | none | – |
| `enrollment.ts` | Device enrollment protocol and pinned certificate profile validation. | yes | indirect | – |
| `eps.ts` | EPS (Encapsulated PostScript) emitter - pure, DOM-free, platform-agnostic. | yes | `tests/eps.test.ts` | – |
| `epub-read.ts` | epub-read.ts - READ an EPUB back to titled chapters of markdown text. | yes | `tests/epub-read.test.ts` | yes |
| `epub.ts` | EPUB 3 writer - pure, DOM-free, platform-agnostic. | yes | `tests/epub.test.ts` | – |
| `exr.ts` | OpenEXR encoder - scanline, HALF (float16) or FLOAT (32-bit), NONE/ZIPS/ZIP. | no | `tests/exr.test.ts` | – |
| `file-data.ts` | Table conversion shared by browser and Node file operations. | yes | `tests/file-data.test.ts` | – |
| `file-metadata.ts` | Embedded-metadata reader | yes | `tests/file-metadata.test.ts` | yes |
| `font-convert.ts` | Font container interconversion - TTF/OTF ⇄ WOFF1, DOM-free and synchronous. | yes | `tests/font-convert.test.ts` | – |
| `font-inspect.ts` | Font file inspection and verified subsetting to chosen text, DOM-free. | yes | `tests/font-inspect.test.ts` | yes |
| `font-subset-policy.ts` | Whether a font's own tables permit glyph subsetting, read straight off the sfnt directory with no imports, so the Skera worker runtime can enforce it too. | no | indirect | – |
| `forensic.ts` | Byte-bound AI evidence, located motifs, coverage and gated calibration. | yes | `tests/forensic.test.ts` | – |
| `forensic/calibration.ts` | Candidate fits remain unavailable until reviewed, preregistered gates pass. | no | none | – |
| `forensic/design.ts` | Verify pages from a Design document's authored geometry (plan 291, W1). | no | none | – |
| `forensic/heat.ts` | A per-sentence view of a forensic report, for drawing heat over the text and the page. | no | `tests/forensic-heat.test.ts` | – |
| `forensic/layout.ts` | Layout motifs remain weak authorship clues even when geometry is clear. | no | none | – |
| `forensic/model.ts` | Token-measured windows retain context, including a full-context final window. | no | none | – |
| `forensic/raster.ts` | Bounded colour components locate accent strips beside rounded neutral panels. | no | none | – |
| `forensic/report.ts` | Evidence grouping and byte-bound reports do not create probability claims. | no | none | – |
| `forensic/text.ts` | Source offsets, language eligibility and bounded document-wide windows. | no | indirect | – |
| `forensic/types.ts` | Located observations and explicit coverage for a forensic assessment. | no | none | – |
| `format-sniff.ts` | Container identity from bytes, and the requested-format table that decides whether those bytes satisfy a request. | no | `tests/format-sniff.test.ts` | – |
| `frame-address.ts` | The `s=` state address, and the still-export frame filter it drives (plan 112 section 10). | yes | indirect | – |
| `frame-preview-svg.ts` | A compiled frame drawn as a plain SVG (plan 274 section 3.4, "preview and Design share one geometry"). | yes | `tests/frame-preview-svg.test.ts` | – |
| `framing.ts` | Image framing - the ONE way an image is placed, cropped and rotated inside a frame (plans/148). | yes | `tests/framing.test.ts` | – |
| `fs-token.ts` | Reversible, filesystem-safe token codec - pure string logic, no storage, DOM, or platform coupling (it just maps a string to a safe token and back). | yes | `tests/fs-token.test.ts` | – |
| `gainmap-jpeg.ts` | Gain-map JPEG assembly. | no | `tests/gainmap-jpeg.test.ts` | – |
| `gainmap.ts` | Gain maps: the ISO 21496-1 / Adobe "one file, two renditions" math (deeprichpixels plan section 4.2, section 6 B2, section 8 row "gain maps spread beyond JPEG/AVIF"). | no | `tests/gainmap.test.ts` | – |
| `gamut-axis.ts` | How high a CHROMA AXIS has to reach for a given gamut. | yes | `tests/gamut-axis.test.ts` | – |
| `gamut-solid.ts` | The gamut SOLID: a display's whole reachable colour volume as a rotatable 3D surface in OKLCH. | yes | `tests/gamut-solid.test.ts` | – |
| `gamut-source.ts` | Where a gamut COMES FROM: the membership question behind gamut.ts, factored out so it need not be one of three hard-coded RGB matrices. | yes | `tests/gamut-source.test.ts` | – |
| `gamut-tier.ts` | How far OUT of the active gamut a colour is. | yes | `tests/gamut-tier.test.ts` | – |
| `gamut.ts` | Display-gamut classification for OKLCH colours - which of sRGB, Display-P3 or Rec.2020 can actually show a given lightness/chroma/hue. | yes | `tests/gamut.test.ts` | – |
| `geom-api.ts` | `host.geom` - the tool-facing face of the geometry kernel (HostV1 v1.64). | yes | `tests/geom-api.test.ts` | – |
| `geom-nearest-cache.ts` | Bounded private parsed paths for repeated nearest-point queries. | no | `tests/geom-nearest-cache.test.ts` | – |
| `geom/authored-frame.ts` | The frame a path box is drawn in, fitted to its curve: one rule for the pen tool and for every caller that writes a path row from absolute geometry (plan 291 W5). | yes | indirect | – |
| `geom/authored-url.ts` | The wire form of an `AuthoredPath` - what a pen shape looks like inside one `blocks` sub-field, and therefore inside a share link. | yes | indirect | – |
| `geom/bezier.ts` | Cubic Bézier kernel - the geometric substrate for boolean operations, offsetting and stroke outlining. | yes | `tests/geom-bezier.test.ts` | – |
| `geom/boolean.ts` | Boolean operations on regions bounded by cubic Béziers - union, intersection, difference, exclusive-or - and the winding-number test they are all decided by. | yes | `tests/geom-boolean.test.ts` | – |
| `geom/dxf-geom.ts` | Plane geometry for the DXF importer: affine maps, the arbitrary-axis rule for entities that sit in their own plane, arcs and bulges as cubic Beziers, and NURBS sampling. | no | indirect | – |
| `geom/fit.ts` | Fitting cubics to a curve that has no Bézier form - an exact offset, a stroke edge, a distorted path. | yes | `tests/geom-fit.test.ts` | – |
| `geom/intersect.ts` | Curve intersection. | yes | `tests/geom-intersect.test.ts` | – |
| `geom/near-pieces.ts` | Ordered curve-proximity candidates from start, midpoint and end cells. | no | `tests/geom-near-pieces.test.ts` | – |
| `geom/offset-error.ts` | Independent source-to-fitted-chain offset verification with bounded adaptive sampling. | no | indirect | – |
| `geom/offset-source.ts` | Exact cubic offset points and source directions, including vanishing-tangent fallbacks. | no | indirect | – |
| `geom/offset.ts` | Offsetting: moving a path a fixed distance sideways. | yes | `tests/geom-offset.test.ts` | – |
| `geom/operations.ts` | Numerical dependencies belong to one caller-owned geometry operation. | no | indirect | – |
| `geom/path.ts` | The path model the geometry operates on, and its conversions to and from the rest of the engine. | yes | indirect | – |
| `geom/portable-math-wasm.ts` | GENERATED by scripts/build-portable-math.ts from packages/node-shell/wasm/portable-math/. | no | indirect | – |
| `geom/portable-math.ts` | One float64 answer on every JavaScript engine for the geometry's scalar maths. | no | `tests/geom-portable-math.test.ts` | – |
| `geom/ray-cast.ts` | Ordered cubic ray casting with twin classification and exact work handoffs. | no | `tests/geom-ray-cast.test.ts` | – |
| `geom/spiro.ts` | Spiro. | no | `tests/spiro.test.ts` | – |
| `geom/spline.ts` | The seam between an AUTHORED path and the cubics that geometry runs on. | yes | `tests/geom-spline.test.ts` | – |
| `geom/stroke.ts` | Stroke outlining: the region a stroked path paints, expressed as a fillable path. | yes | `tests/geom-stroke.test.ts` | – |
| `grade.ts` |  | yes | `tests/grade.test.ts` | – |
| `gradient-spec.ts` | The Lolly gradient spec: one terse, URL-safe string that describes a gradient, and the CSS it bakes down to. | yes | `tests/gradient-spec.test.ts` | – |
| `guided-matte.ts` | Matte edges pulled onto the photo (plans/289 M4): a guided filter (He, Sun and Tang), adapted from Compositor's GuidedMatte.swift (MIT, Wonder Assembly LLC). | yes | `tests/guided-matte.test.ts` | – |
| `gzip.ts` | gzip (RFC 1952): the member wrapper around raw DEFLATE, plus a synchronous inflater so a `.gz`/`.svgz` can be read back without a platform decoder. | yes | indirect | – |
| `hdr.ts` | HDR raster export: brand-colour highlight boost + PQ (SMPTE ST 2084) encoding. | yes | `tests/hdr.test.ts` | – |
| `heal.ts` | Spot healing (plans/289 M4): Compositor's `spot_heal` (HealPixels.c, MIT, Wonder Assembly LLC), ported line for line and held to the original by tests/heal.test.ts, whose goldens come from the C itself… | yes | `tests/heal.test.ts` | – |
| `hook-worker-core.ts` | Hook worker core - the transport-agnostic half of running a tool's hooks.js OFF the thread that owns the host bridge (plans/86 M2, moved here from the web shell's hook-worker.worker.ts so a Node `worker_threads`… | yes | `tests/hook-worker-core.test.ts` | – |
| `humanize.ts` | "Humanize" a text asset - a DETERMINISTIC, on-device clean-up of the AI artifacts a text-signal analysis flags, plus a tidy of the typography to house style. | yes | `tests/humanize.test.ts` | – |
| `icc-pixels.ts` | ICC profiles applied to deep pixel buffers: the digiKam act (deeprichpixels section 3, section 5.1): input profile → PCS → working/output space, per pixel, over a {@link DeepFrame}. | yes | `tests/icc-pixels.test.ts` | – |
| `icc.ts` | ICC profile reader: the authority for "what can this device actually print?". | yes | `tests/icc.test.ts` | yes |
| `ico-decode.ts` | Windows ICO / CUR reader: picks the LARGEST image in the directory and decodes it to RGBA. | yes | `tests/ico-decode.test.ts` | – |
| `icon-set.ts` | icon-set.ts - plan a freedesktop hicolor icon theme layout from source icons. | yes | indirect | – |
| `icon-theme.ts` |  | yes | `tests/icon-theme.test.ts` | – |
| `idml-master.ts` | IDML master spreads: the items of an applied master are placed on each page, below the page's own items, unless the page overrides them or hides master items. | no | none | – |
| `idml-object.ts` | IDML object styles and item appearance: fill, stroke, corners, opacity and blend, read from the applied object style with the item's own attributes on top, then written onto the node. | no | none | – |
| `idml-read.ts` | Bounded IDML parts into editable Design frames, using injected XML and asset IO. | yes | indirect | yes |
| `idml-styles.ts` | IDML named styles: collect the style elements of Styles.xml, follow `BasedOn` chains with a depth and cycle bound, and read typed text and object properties from the merged result. | no | indirect | – |
| `idml-table.ts` | IDML tables as grouped Design frames: one text frame per cell carrying its text, fill and borders, placed on the table grid. | no | none | – |
| `idml-text.ts` | IDML story text: paragraph and character ranges resolved through named styles into the runs `designTextOf` writes, plus the box-level type a Design text frame carries. | no | none | – |
| `image-cloud.ts` | An image's colours as a point cloud in OKLCH, plus what the distribution says. | yes | `tests/image-cloud.test.ts` | – |
| `image-meta.ts` | Image-metadata byte stampers and the metadata-carry core - DOM-free, shared by the web export bridge and the Node shells. | yes | indirect | – |
| `image-trace.ts` | image-trace.ts - a traced picture as Design paths (plan 342, K5). | no | `tests/image-trace.test.ts` | yes |
| `inpaint.ts` | Telea inpainting: fill a brushed-out region of an RGBA frame from the pixels around it, by fast marching inward from the region boundary. | yes | `tests/inpaint.test.ts` | yes |
| `inputs.ts` | Builds a runtime input model from a tool manifest. | yes | indirect | – |
| `intent-record.ts` | From a resolved intent to the record a file carries (plan 350 W4b). | yes | indirect | – |
| `intent.ts` | Visual intent: a caller states what a piece has to do, and this module chooses the tool for each surface, fills its inputs from the content given and says why (plan 350 W4). | yes | `tests/intent.test.ts` | yes |
| `jpeg-segments.ts` | JPEG marker-segment walker and writer - one shared primitive, DOM-free. | yes | `tests/jpeg-segments.test.ts` | – |
| `jxl-container.ts` | Bounded uncompressed metadata boxes. | no | indirect | – |
| `jxl.ts` | JPEG XL identity and bounded operation policy. | no | `tests/jxl.test.ts` | yes |
| `keyframes.ts` |  | yes | `tests/keyframes.test.ts` | yes |
| `kf-bake.ts` | One channel's keyframes for a player that only knows bezier curves and holds (plans/329). | no | indirect | – |
| `kf-look.ts` | Appearance keyframes (plans/328): what the ten appearance channels of the `kf` wire mean as paint. | yes | `tests/kf-look.test.ts` | – |
| `kf-spring.ts` | Spring easing for the `kf` wire (plans/329): the physics, the landing rule and the wire spelling of one spring. | yes | `tests/kf-spring.test.ts` | – |
| `label-artwork.ts` | Validate a small already-rendered stamp before a host paints it. | no | none | – |
| `lang.ts` | Supported UI/content languages, shared by the `lang` reserved URL param (url-mode.ts), `Profile.lang`, tool-manifest i18n sidecars, and every shell's language picker. | yes | indirect | – |
| `learning/authoring.ts` |  | no | `tests/learning-authoring.test.ts` | – |
| `learning/compile.ts` |  | yes | indirect | – |
| `learning/delivery.ts` | Portable course targets and source renditions, independent of a shell or provider. | yes | indirect | – |
| `learning/module.ts` |  | yes | indirect | – |
| `learning/preflight.ts` |  | yes | `tests/preflight.test.ts` | – |
| `learning/presets.ts` | LMS compatibility presets: validated data that selects an existing course target. | no | `tests/learning-presets.test.ts` | – |
| `learning/progress.ts` |  | yes | indirect | – |
| `linux-pack.ts` | linux-pack.ts - the content-aware layer over `rpm.ts`. | yes | `tests/linux-pack.test.ts` | – |
| `loader.ts` | Tool loader. | yes | indirect | – |
| `lofi-arnhem.test.ts` |  | no | none | – |
| `lofi-arnhem.ts` | Arnhem Land: the region's band music today, the parts of the Arnhem Land style that lib/lofi-compose.ts's dance path hands to this module. | no | none | – |
| `lofi-botanica.test.ts` | Botanica's composer (lofi-botanica.ts), through composeLofiTune. | no | none | – |
| `lofi-botanica.ts` | Botanica, also called petalcore: acoustic instruments and the sounds of a place outdoors under granular pads and digital glitches, organic warmth with a weathered, futuristic edge. | no | none | – |
| `lofi-break-chop.test.ts` | The chopped breaks (lofi-break-chop.ts) and the jungle genre (lofi-jungle.ts). | no | none | – |
| `lofi-break-chop.ts` | Chopped breaks: a drummer's two bars sampled, cut into sixteenths and played back in a new order, the way jungle, breakbeat and boom-bap producers work a break on a sampler. | no | none | – |
| `lofi-breaks.ts` | The note-written break engine: drum and bass's top loop (breakbeat's drums, which it used to write, are now a recorded break chopped by lofi-break-chop.ts). | no | none | – |
| `lofi-chop-cast.test.ts` | Who sings the vocal chops (lofi-chop-cast.ts): each voice alone and each group as a lead of its own, and the genre's own choice behind the first chop id, `chop`, cast from the tune's seed on a stream of its own. | no | none | – |
| `lofi-chop-cast.ts` | Who sings a tune's vocal chops: one voice of four (a woman's, a man's, a baritone's or a child's), or a group of them on one line. | no | none | – |
| `lofi-club.test.ts` | The club genres' promises (lofi-club.ts, lofi-breaks.ts, lofi-break-chop.ts): breakbeat, funky house, UK garage and private school piano, and drum and bass's top loop. | no | none | – |
| `lofi-club.ts` | The club genres of the Lolly Sings family: breakbeat, funky house, UK garage and private school piano (the deep, jazzy strand of amapiano). | no | none | – |
| `lofi-coast-birds.ts` | What the coast's birds' notes mean: the eastern whipbird and the rainbow lorikeet, sung by Noosacore (lofi-noosa.ts), by any style with the Aussie birds turned on, and by any composer that wants them (a `whipbird` or… | no | none | – |
| `lofi-compose.test.ts` | The Lofi composer's promises. | no | none | – |
| `lofi-compose.ts` | Lofi composition: the seeded, endless stream of bars behind the Neurospicy player's Lofi station. | no | indirect | – |
| `lofi-console.test.ts` | Where the console's FM effects go (lofi-console.ts). | no | none | – |
| `lofi-console.ts` | The 16-bit console's FM effects, and where a tune plays them: spins that charge up, long shots with echoing tails, and one moment before each drop. | no | none | – |
| `lofi-cpop.test.ts` | Mandopop and C-Pop (lofi-cpop.ts): a pop song's form, the hook on a traditional instrument, the strings or the pad under the chorus, the last chorus lifted, and each kind of tune's own beat. | no | none | – |
| `lofi-cpop.ts` | Mandopop and C-Pop: the dance composer's Chinese pop tunes, written here so the composer's own module (lofi-compose.ts) only hands the tune over, as salsa's and oompa's are. | no | none | – |
| `lofi-future.test.ts` | How a future-bass chord moves, and how a drop's chords vary (lofi-future.ts). | no | none | – |
| `lofi-future.ts` | How a future-bass chord moves (the keys `future`, Sherbert's chords), and how a drop's chords change from bar to bar. | no | none | – |
| `lofi-jungle.ts` | Jungle: chopped funk breaks at 160 to 175 bpm over a deep dub sub, the way the music was made on samplers in the early nineties. | no | none | – |
| `lofi-noosa.test.ts` | Noosacore's composer (lofi-noosa.ts) and the wave notes it writes (lofi-waves-notes.ts). | no | none | – |
| `lofi-noosa.ts` | Noosacore: the sound of Noosa today, a coastal town where many cultures meet. | no | none | – |
| `lofi-oompa.test.ts` | Oompa (engine/src/lofi-oompa.ts): a Bavarian brass band's polka, march or waltz. | no | none | – |
| `lofi-oompa.ts` | Oompa: the dance composer's Bavarian brass band tunes, written here so the composer's own module (lofi-compose.ts) only hands the tune over. | no | none | – |
| `lofi-salsa.test.ts` | Salsa (engine/src/lofi-salsa.ts): the clave governs every part, the bass and the piano anticipate, the percussion changes between the verse and the montuno, the coro and the pregón trade, and the mambo is the horns'… | no | none | – |
| `lofi-salsa.ts` | Salsa: the dance composer's salsa tunes, written here so the composer's own module (lofi-compose.ts) only hands the tune over. | no | none | – |
| `lofi-scratch.test.ts` | Record scratches placed (lofi-scratch.ts). | no | none | – |
| `lofi-scratch.ts` | Record scratches: a DJ's hand on a record and the crossfader, placed as a producer places them. | no | none | – |
| `lofi-straya.test.ts` |  | no | none | – |
| `lofi-straya.ts` | Straya's didgeridoo and its birds: the parts of the Straya style that lib/lofi-compose.ts's dance path hands to this module. | no | none | – |
| `lofi-trailer.test.ts` | The trailer genre (lofi-trailer.ts): its running order, its hits, the lift into every fourth bar and its section names. | no | none | – |
| `lofi-trailer.ts` | Trailer: the music a film trailer or an event's opening film is cut to. | no | none | – |
| `lofi-waves-notes.ts` | What a `wave` note means: the sea on a sandy shore, the texture Noosacore breathes over (lofi-noosa.ts) and that any style can have when a person turns the waves on. | no | none | – |
| `logo-variant.ts` | Which logo goes on this background (plan 274 section 3.4). | yes | `tests/logo-variant.test.ts` | – |
| `lottie-edit.ts` | Instance-local revisions over immutable Lottie source documents. | no | `tests/lottie-edit.test.ts` | – |
| `lottie-look.ts` | dotLottie for the appearance keyframes (plans/328): a Design shape layer's keyed fill colour, stroke colour, stroke width, corner radius and trim written as NATIVE animated Lottie properties - `fl.c`, `st.c`, `st.w`… | no | `tests/lottie-look.test.ts` | – |
| `lottie-model.ts` | Bounded, platform-independent admission of linear Lottie compositions. | no | indirect | – |
| `lottie-properties.ts` | Numeric Lottie tracks retain their own frame times, dimensions and easing. | no | indirect | – |
| `lottie-sequence.ts` | Compile a frozen, resolved linear sequence without a player or a DOM. | no | indirect | – |
| `media-sniff.ts` | Pure, DOM-free media classification from header bytes. | yes | `tests/media-sniff.test.ts` | yes |
| `metadata.ts` | Export provenance: the generic authorship record embedded into every exported media file (platform-agnostic; no format/DOM knowledge here). | yes | `tests/metadata.test.ts` | – |
| `midi.ts` | Standard MIDI File to ZzFXM. | yes | `tests/midi.test.ts` | yes |
| `motion-cues.ts` | Versioned cue authoring compiled into ordinary Design layer timing. | yes | `tests/motion-cues.test.ts` | yes |
| `motion-report.ts` | Measured delivery facts remain separate from candidates for human review. | yes | none | – |
| `motion-sampling.ts` | Deterministic shutter timing and linear-light accumulation, independent of a shell. | yes | `tests/motion-sampling.test.ts` | – |
| `motion-tokens.ts` | A design system's motion tokens (plans/329): the durations, curves and springs a brand names, read from a resolved DTCG token set into what Sequence can use. | yes | indirect | – |
| `ocr-typeset.ts` | Typesetting recovery from OCR lines (plan 274 section 6, point 4): the lines a recogniser read inside one text region in, paragraphs with reading order, bullets, nesting, an estimated size and a role guess out. | yes | `tests/ocr-typeset.test.ts` | – |
| `odt.ts` | OpenDocument Text (.odt) writer: pure, DOM-free, platform-agnostic. | yes | `tests/odt.test.ts` | – |
| `office-census.ts` | Read-only OOXML package census with shared ZIP, XML and nested-package budgets. | yes | `tests/office-census.test.ts` | – |
| `office-xml.ts` | Small, bounded XML census tree. | no | indirect | – |
| `ogg.ts` | Ogg (RFC 3533) page + Opus comment-header primitives, shared by the C2PA write side (c2pa-containers.ts placeOgg) and the read side (c2pa-extract.ts extractC2paFromOgg). | no | indirect | – |
| `ooxml-props.ts` | Shared OPC docProps/core.xml writer (plans/144 Wave 2 G3): one core-properties shape for every OOXML package the engine writes (pptx.ts, docx.ts), so the authorship fields cannot drift between them. | no | `tests/ooxml-props.test.ts` | – |
| `output-facts.ts` | Facts read from a finished export's bytes: container, pixel and page size, page count, timing, alpha channel, colour model, metadata, credential presence, encryption and fonts. | yes | `tests/output-facts.test.ts` | yes |
| `packbits.ts` | PackBits run-length coding (TIFF 6.0 section 9) - the byte compression Photoshop calls "RLE" for PSD channel data (compression method 1) and TIFF uses for Compression=32773. | yes | `tests/packbits.test.ts` | – |
| `palette-export.ts` | Palette exchange - serialise a flat list of named colours as a standalone file in one of several interchange formats: a DTCG design-tokens JSON (nested under each swatch's canonical dotted key), a plain CSS… | yes | `tests/palette-export.test.ts` | – |
| `partner-kit-attachment.ts` | A partner kit attachment, read from any untrusted value (plans/82 M8). | no | none | – |
| `partner-kit-check.ts` | Guest-mark checks: a Design document's partner marks against the partner kit's rules (Lolly Work plan 82 M8). | yes | `tests/partner-kit-check.test.ts` | – |
| `partner-kit.ts` | Reads a partner kit (`partner-kit-v1`, Lolly Work plan 82 M8) and proposes its colours. | yes | `tests/partner-kit.test.ts` | – |
| `pdf-accessibility.ts` | The PDF accessibility report: which of 32 checks a PDF passes, fails, does not meet or leaves to a person, in Lolly's words. | yes | indirect | – |
| `pdf-artwork.ts` | Vector artwork detection - find the logos on a page full of shapes. | yes | `tests/pdf-artwork.test.ts` | – |
| `pdf-crypto-r6.ts` | PDF Standard Security Handler - revision 6 (R6), AES-256 (ISO 32000-2 section 7.6.4, originally Adobe's "ExtensionLevel 3"). | yes | `tests/pdf-crypto-r6.test.ts` | – |
| `pdf-map.ts` | PDF (and Adobe Illustrator .ai - an .ai IS a PDF) page content stream → DesignNodes. | yes | `tests/pdf-map.test.ts` | yes |
| `pdf-redaction.ts` | Failed-redaction detection: text that is in the file but not on the page. | yes | `tests/pdf-redaction.test.ts` | – |
| `pdf-smask.ts` | Pure helpers for PDF soft masks (ExtGState /SMask, PDF 32000-1 section 11.6.5.2). | yes | `tests/pdf-smask.test.ts` | – |
| `pdf-svg.ts` | PDF page → standalone SVG serializer (pure, DOM-free). | yes | `tests/pdf-svg.test.ts` | – |
| `pdf-text.ts` | PDF text reconstruction: positioned glyph runs to reading-ordered prose. | yes | `tests/pdf-text.test.ts` | – |
| `pdfx.ts` | PDF/X-4 metadata authority: pure strings + small descriptor objects, no PDF byte-wrangling. | yes | `tests/pdfx.test.ts` | – |
| `penpot-bindings.ts` | Applied-token bindings for the `.penpot` writer (plans/222). | yes | indirect | – |
| `penpot-file.ts` | `.penpot` writer - a Lolly document (plus the brand's tokens) → the binfile-v3 archive Penpot itself exports and imports (plans/178). | yes | `tests/penpot-file.test.ts` | – |
| `penpot-layout.ts` | Current binfile-v3 layout properties. | yes | `tests/penpot-layout.test.ts` | yes |
| `photo-look.ts` | Brand photo looks baked into raster pixels (plan 291 W7). | yes | `tests/photo-look.test.ts` | – |
| `photo-treatment.ts` |  | yes | indirect | – |
| `pixel-watermark.ts` | Lolly pixel watermark - block-DCT spread-spectrum | yes | `tests/pixel-watermark.test.ts` | – |
| `pixels.ts` | Deep pixel buffers: the engine's float image interchange (deeprichpixels section 5.1). | yes | `tests/pixels.test.ts` | – |
| `png-generator.ts` | PNG generator hints are scoped to creator and structured generation fields. | no | none | – |
| `png-unfilter.ts` | PNG row-filter reversal (PDF /Predictor >= 10, and standalone PNG IDAT) | yes | `tests/png-unfilter.test.ts` | yes |
| `png.ts` | PNG encoder: 8-bit and 16-bit truecolour, pure bytes, DOM-free. | yes | `tests/png.test.ts` | – |
| `portable-html.ts` | Standalone document assembly for declared, trusted tool presentations. | no | `tests/portable-html.test.ts` | – |
| `pptx-patch.ts` | pptx-patch.ts: SURGICAL rebrand of an unzipped .pptx part map (Pipeline A, plans/49-fable-new-potential-pptx.md section 2.2 / track E2). | yes | `tests/pptx-patch.test.ts` | yes |
| `pptx-read.ts` | pptx-read.ts: PARSE an unzipped .pptx part map into a read-model. | yes | `tests/pptx-read.test.ts` | yes |
| `pptx.ts` | PPTX (PowerPoint / OOXML) builder. | yes | `tests/pptx.test.ts` | – |
| `preflight-output.ts` | The export report: each requested property beside the value read from the finished file. | yes | `tests/preflight-output.test.ts` | – |
| `preflight.ts` | Preflight: pre-export findings over a plain job description. | yes | `tests/preflight.test.ts` | – |
| `premiere-xml.ts` | Supported Final Cut Pro 7 XML interchange, also accepted by Premiere. | yes | indirect | – |
| `prepare-document.ts` | Bounded local document scopes and source-range edits for preparation jobs. | no | `tests/prepare-document.test.ts` | – |
| `prepare-metadata.ts` | Compose existing metadata removal with per-file recovery and output inspection. | yes | indirect | – |
| `prepare-pii.ts` | Typed adaptation of community/_shared/pii.js. | no | indirect | – |
| `prepare-text.ts` | Credential and personal-data suggestions with bounded declarative rules. | yes | `tests/prepare-text.test.ts` | – |
| `prepare.ts` | Source-bound inspection, consistent replacement and content-free preparation reports. | yes | `tests/prepare.test.ts` | yes |
| `present-interact.ts` | Authored presentation controls, independent of a page or a browser. | yes | `tests/present-interact.test.ts` | yes |
| `print-marks.ts` | Print-marks & bleed geometry. | yes | `tests/print-marks.test.ts` | – |
| `production.ts` | Versioned, scoped production measurement and repair primitives. | yes | `tests/production.test.ts` | – |
| `production/collect.ts` |  | no | none | – |
| `production/compare.ts` |  | no | `tests/compare.test.ts` | – |
| `production/contract.ts` |  | no | indirect | – |
| `production/motion.ts` | Encoded delivery requirements and explicitly sampled appearance coverage. | no | none | – |
| `production/repair.ts` |  | no | none | – |
| `production/report.ts` |  | no | none | – |
| `production/types.ts` | Scoped still-output contracts. | no | none | – |
| `provenance-defaults.ts` | Whether an export carries provenance marks WHEN NOBODY SAID. | yes | `tests/provenance-defaults.test.ts` | – |
| `psd-adjustments.ts` | Photoshop adjustment layers as values (plans/289 M3, item 5): Levels, Curves, Hue/Saturation, Brightness/Contrast, Exposure, Invert, Color Balance and Black & White, read from their tagged blocks. | no | `tests/psd-adjustments.test.ts` | – |
| `psd-descriptor.ts` | Photoshop's two structured text formats inside a layer's tagged blocks (plans/289 item 1): the Action Descriptor (the typed key/value tree that type layers, vector origination, solid fills and stroke settings are stored… | no | `tests/psd-descriptor.test.ts` | yes |
| `psd-layer-semantics.ts` | What a Photoshop layer IS, beyond its pixels (plans/289 item 1): live type, a shape drawn with the shape tool, a vector path, a solid colour fill, and the things an importer has to say it could not keep (effects, smart… | no | `tests/psd-layer-semantics.test.ts` | – |
| `psd-outline.ts` | Photoshop vector outlines (psd-layer-semantics.ts `PsdSubpath`) made ready to draw (plans/289): every combined outline turned the same way, overlapping outlines merged into one when a stroke must run round the outside… | no | `tests/psd-outline.test.ts` | – |
| `psd-write.ts` | Photoshop PSD writer: the write-back half of layered import (psd.ts reads). | yes | indirect | – |
| `psd.ts` | Photoshop PSD/PSB reader: layered import for the darkroom tool's layers, Layout Studio and the picker's flatten path. | yes | `tests/psd.test.ts` | yes |
| `radiance.ts` | Radiance RGBE (`.hdr` / `.pic`) reader + writer - pure bytes, DOM-free. | no | `tests/radiance.test.ts` | yes |
| `raster-layers.ts` | The shared shape for layered raster import: what psd.ts and xcf.ts both decode into. | yes | indirect | – |
| `rate-card.ts` | The printer's own rate card - stored, validated, never a source of prices. | yes | indirect | – |
| `read-extract-quality.ts` | read-extract-quality.ts - how close an extract is to a hand-labelled reading of the same file (plan 203, rank 10). | yes | indirect | – |
| `read-extract.ts` | read-extract.ts - a file's words, tables and pictures as one list of blocks in reading order, bounded by a page range and a character budget (plan 203, rank 10). | yes | `tests/read-extract.test.ts` | – |
| `rebrand-archetype.ts` | Which archetype a source slide should be poured into (plan 274 section 3.3). | yes | `tests/rebrand-archetype.test.ts` | – |
| `rebrand-colors.ts` | Colour assignment by use, with feasibility (plan 274 section 3.3). | yes | `tests/rebrand-colors.test.ts` | – |
| `rebrand-decisions.ts` | Carrying a person's decisions into the next revision of a deck, and applying one decision to a plan (plan 274 section 3.3, "persistence and carry-forward"). | yes | `tests/rebrand-decisions.test.ts` | – |
| `rebrand-design-system.ts` | One design system, resolved once for the whole renovation journey (plan 274 sections 3.3 and 3.5). | yes | `tests/rebrand-design-system.test.ts` | – |
| `rebrand-edit.ts` | Pure edits to a renovation plan (plan 274 section 4, "shopping"): the one set of operations the web view, the CLI and the MCP tool apply, so a group apply or a reorder means the same thing on every surface. | yes | `tests/rebrand-edit.test.ts` | – |
| `rebrand-fonts.ts` | Which face a source deck's typefaces become (plan 274 section 3.3). | yes | `tests/rebrand-fonts.test.ts` | – |
| `rebrand-layout-options.ts` | Bounded layout recommendations, checked against a real single-slide compile. | no | `tests/rebrand-layout-options.test.ts` | – |
| `rebrand-order.ts` | One string order for the census, the plan, the colour solve and the compile. | no | `tests/rebrand-order.test.ts` | – |
| `rebrand-plan.ts` | The renovation plan's automatic first pass (plan 274 sections 3.3 and 9). | yes | `tests/rebrand-plan.test.ts` | – |
| `rebrand-report.ts` | The renovation report (plan 274 section 3.4, "never drop silently"). | yes | `tests/rebrand-report.test.ts` | – |
| `rebrand-review.ts` | The review model of a renovation (plan 274 section 4): what the queue, the footer, the report drawer, the CLI `inspect` command and later the TUI show. | yes | `tests/rebrand-review.test.ts` | – |
| `rebrand-structure.ts` | The structure matcher (plan 275 section 3): which layout of the library a source slide was drawn as, how sure the read is, and the one opt-in action that applies the reads across a deck (decision 28, Auto-match). | yes | `tests/rebrand-structure.test.ts` | – |
| `rebrand-theme.ts` | Deck themes and a slide's own ground (plan 275 section 6), as ordinary plan edits. | yes | `tests/rebrand-theme.test.ts` | – |
| `reword.ts` | Reword flagged text - the SEMANTIC half humanize.ts's header defers (plans/127). | yes | `tests/reword.test.ts` | – |
| `riff-meta.ts` | WAV provenance tags: the RIFF LIST/INFO chunk. | yes | `tests/riff-meta.test.ts` | – |
| `rights-attribution.ts` | Turns an attribution plan into readable credits, companion files, source ingredients and a measured receipt (plan 253). | yes | `tests/rights-attribution.test.ts` | – |
| `rights-companion.ts` | Verify readable package credits without claiming a signed credential. | yes | indirect | – |
| `rights-evaluate.ts` | Applies the reviewed licence profiles to recorded works, uses and one delivery context (plan 253). | yes | `tests/rights-evaluate.test.ts` | – |
| `rights-profiles.ts` | Versioned licence identifiers, the reviewed licence profiles the rights evaluator applies, and the one locator rule every credit reads (plan 253). | yes | `tests/rights-profiles.test.ts` | – |
| `rights-report.ts` | Reads a verified credential back as the three rights questions Verify asks about a file (plan 253). | yes | `tests/rights-report.test.ts` | – |
| `rondo-midi.ts` | A rondocode song's scheduled notes as a Standard MIDI File. | yes | none | – |
| `rondo-provenance.test.ts` | rondo-provenance.ts: a render with no singing is algorithmic media and never flagged as AI; a file with synthesised singing declares the singing, lists the parts and models, and reads back as composite AI media. | no | none | – |
| `rondo-provenance.ts` | rondo-provenance.ts: what a file made from a rondocode song says about itself. | yes | indirect | – |
| `rondo-share-dict.ts` | GENERATED by scripts/build-rondo.ts from rondocode's app/src/session/share.ts (MIT, Vijay Pemmaraju; packages/rondo/upstream). | no | none | – |
| `rondo-sign.test.ts` | rondo-sign.ts: a WAV rendered from a song reads back with what it declares. | no | none | – |
| `rondo-sign.ts` | rondo-sign.ts: sign a file rendered from a rondocode song. | no | indirect | – |
| `rondo-source.test.ts` | rondo-source.ts: song files, share links rondocode itself writes (made with pako, as upstream does), canonical bytes, and the ceilings on every untrusted path. | no | none | – |
| `rondo-source.ts` | rondo-source.ts: a rondocode song as an asset's bytes. | yes | indirect | yes |
| `rpm.ts` | RPM v4 package writer - the container half of a `.rpm`. | yes | `tests/rpm.test.ts` | – |
| `runtime.ts` |  | yes | indirect | – |
| `scorm.ts` | SCORM packaging - the pure half (plans/180 section 6). | yes | `tests/scorm.test.ts` | – |
| `seal.ts` | SEAL (hackerfactor.com) signature verifier - pure, DOM-free (globalThis.crypto only, like c2pa-verify.ts / x509.ts). | yes | `tests/seal.test.ts` | yes |
| `semver-range.ts` | Minimal SemVer range satisfaction - enough to enforce a tool manifest's `engineVersion` against the running ENGINE_VERSION (loader.ts, P0-3). | yes | `tests/semver-range.test.ts` | – |
| `sequence-marks.ts` | Version 1: v1\|m,timeMs,endMs,rrggbb,uriLabel\|i,timeMs\|o,timeMs. | no | `tests/sequence-marks.test.ts` | – |
| `sequence-samples.ts` | Bounded authored-time sampling shared by still preview surfaces. | yes | `tests/sequence-samples.test.ts` | – |
| `session-record.ts` | Saved-session record envelope - the version stamps a shell's state bridge writes for one saved tool session, and the migrate-or-warn branch it runs on load. | yes | `tests/session-record.test.ts` | – |
| `share-privacy.ts` | Share-link privacy partition shared by the web and terminal shells. | no | none | – |
| `show-if.test.ts` | matchesShowIf - the one visibility predicate for inputs and select options. | no | none | – |
| `slide-composition.test.ts` |  | no | none | – |
| `slide-composition.ts` | Markdown groups and bounded compositions, shared by slide tools and shells. | no | indirect | – |
| `slide-layout-components.ts` | Content-sized slide components shared by import and authoring paths. | yes | `tests/slide-layout-components.test.ts` | – |
| `slide-master.ts` | Seeding Design frames from a slide master (plan 274 section 3.4). | yes | `tests/slide-master.test.ts` | – |
| `slide-regions.ts` | Region finding for a flattened slide (plan 274 section 6, point 1): a picture of a whole slide in, a list of boxes out, each classed as text, picture, rule or panel with the numbers behind the class. | yes | `tests/slide-regions.test.ts` | – |
| `slide-structures-data.ts` | GENERATED by scripts/build-slide-masters.ts from community/slide-structures/library.json. | no | none | – |
| `slide-structures.ts` | The slide layout library (plan 275 section 2). | yes | `tests/slide-structures.test.ts` | – |
| `smf-export.ts` | Notes to a format-1 Standard MIDI File, for the music tools' `.mid` export. | yes | `tests/smf-export.test.ts` | – |
| `smf.ts` | Standard MIDI File 1.0 reader and writer, lossless. | yes | `tests/smf.test.ts` | yes |
| `software-origin.ts` | Software and rights declarations read from metadata, with their evidence kept alongside them. | yes | `tests/software-origin.test.ts` | – |
| `sonic-profile.ts` | Read and resolve sound profiles without a renderer, storage or personal preferences. | no | `tests/sonic-profile.test.ts` | – |
| `speech-model-bytes.ts` | Kokoro TTS download-size constants. | no | `tests/speech-model-bytes.test.ts` | – |
| `speech-text.ts` | Speech synthesis text machinery - the PURE half of Kokoro TTS. | yes | `tests/speech-text.test.ts` | – |
| `steganalysis.ts` | Classical LSB steganalysis - Westfeld–Pfitzmann chi-square attack | yes | `tests/steganalysis.test.ts` | – |
| `strip-audio.ts` | Audio metadata stripper: lossless byte surgery that removes tags, Content Credentials and other hidden data from audio files while every audio byte stays exactly as it was. | yes | `tests/strip-audio.test.ts` | yes |
| `strip-metadata.ts` | Embedded-metadata stripper | yes | `tests/strip-metadata.test.ts` | yes |
| `studio3d-arrangement.ts` | Several subjects in one photograph: stable ids, selection, numerical edits and overlap guidance. | yes | `tests/studio3d-arrangement.test.ts` | – |
| `studio3d-camera-path.ts` | Camera paths: keys captured from the live view, sampled deterministically over the loop. | yes | `tests/studio3d-camera-path.test.ts` | – |
| `studio3d-collection.ts` | One studio shared by a bounded collection, with explicit per-item overrides. | yes | `tests/studio3d-collection.test.ts` | – |
| `studio3d-lights.ts` | Light placement on the preview: orbit a source about the subject and save it where the rig keeps it. | yes | `tests/studio3d-lights.test.ts` | – |
| `studio3d-look.ts` | The boundary between a studio and a document (plan 265 step 2, milestone 2 lane A). | yes | `tests/studio3d-look.test.ts` | – |
| `studio3d-motion.ts` | What the subject does over the loop (plan 267, lane A). | yes | `tests/studio3d-motion.test.ts` | – |
| `studio3d.ts` | Portable studio recipe validation, material finishes and repeatable camera time. | yes | `tests/studio3d.test.ts` | – |
| `surface-variant.ts` | Surface-aware logos and icons (plan 291 W4): one reference, `<id>?theme=auto`, that takes the variant the surface under the layer asks for. | yes | `tests/surface-variant.test.ts` | – |
| `svg-colors.ts` | Pure, DOM-free colour extraction from raw SVG source text. | yes | `tests/svg-colors.test.ts` | – |
| `svg-custgeom.ts` | Flat-SVG to native PowerPoint shapes. | yes | `tests/svg-custgeom.test.ts` | – |
| `svg-items.ts` | A drawing as bounded, paint-ordered items (plan 275 decision 32, "vectors stay vectors"), and those items as Design rows. | yes | `tests/svg-items.test.ts` | yes |
| `svg-layers.ts` | Lift layers - enumerate an SVG's own layers and derive a standalone document for each one (plans/104 section 7). | yes | `tests/svg-layers.test.ts` | – |
| `svg-path.ts` | SVG path `d` tokenizer. | yes | `tests/svg-path.test.ts` | – |
| `table-edit.ts` | Named table mapping, validation and atomic wall-time edits. | no | `tests/table-edit.test.ts` | – |
| `table-text.ts` | Text-to-table parsing and serialising for the `table` input (the clipboard and file round-trip). | yes | `tests/table-text.test.ts` | – |
| `tar-read.ts` | tar (USTAR / POSIX 1003.1-1988) reader. | yes | `tests/tar-read.test.ts` | yes |
| `tar.ts` | tar (USTAR / POSIX 1003.1-1988) writer. | yes | indirect | – |
| `template-cache.test.ts` |  | no | none | – |
| `template.ts` | Template hydration. | yes | indirect | – |
| `text-ascii.ts` | Small original bitmap alphabet. | no | `tests/text-ascii.test.ts` | – |
| `text-assets.ts` | Font dependencies inside a serialized text document remain visible to asset walkers. | no | indirect | – |
| `text-assist.ts` | Source-referenced, bounded prompts and acceptance rules for local text assistance. | no | indirect | – |
| `text-cleanup.ts` | Optional, reviewable typography edits; never an automatic source normalizer. | yes | `tests/text-cleanup.test.ts` | – |
| `text-composition-cache.ts` | A host-owned workspace reuses unchanged paragraphs and their settled flow prefix. | no | `tests/text-composition-cache.test.ts` | – |
| `text-decoration.ts` | CSS decoration paint for drawn text: the strike from font-instance ascent facts, and the underline with the gaps skip-ink clears, validated before drawing. | no | `tests/text-decoration.test.ts` | – |
| `text-design-wrap.ts` | Design adapts its authored boxes into the generic text-wrap placement contract. | yes | none | – |
| `text-design.ts` | Append-only Design text fields share one source document and independent frame geometry. | yes | `tests/text-design.test.ts` | – |
| `text-display.ts` | Display case preserves authored offsets, including characters that expand when capitalised. | no | none | – |
| `text-document.ts` | Exact text, source selections and bounded undo history for shared editors. | no | `tests/text-document.test.ts` | yes |
| `text-drop-cap.ts` | A drop capital occupies an explicit exclusion beside the first paragraph lines. | no | none | – |
| `text-edits.ts` | Immutable story commands. | yes | `tests/text-edits.test.ts` | – |
| `text-emoji.ts` | Pinned paragraph emoji use the existing artwork admission, treatment and source census. | no | none | – |
| `text-facts.ts` | Document facts - a NEUTRAL census of what a text observably contains, for the verify and catalog panels' interrogation surface. | yes | `tests/text-facts.test.ts` | – |
| `text-flow.ts` | Rectangular flow advances through the authored frame order, independent of paint order. | no | `tests/text-flow.test.ts` | – |
| `text-formats.ts` | Portable formatters and loss-aware structured text conversions. | no | indirect | – |
| `text-fragment.ts` | Portable text fragments resolve styles and rehome font ids without changing source. | yes | `tests/text-fragment.test.ts` | – |
| `text-frame-clipboard.ts` | Portable frame copies carry independent text and exact font pins, never live story references. | yes | `tests/text-frame-clipboard.test.ts` | – |
| `text-frame.ts` | Bounded text frame admission, separate from the story's immutable source. | yes | indirect | yes |
| `text-hidden-unicode.ts` | Contextual hidden-character inspection shared by detection and text cleanup. | no | none | – |
| `text-hyphenation.ts` | Pinned Liang patterns produce candidate offsets, never edited source text. | yes | `tests/text-hyphenation.test.ts` | – |
| `text-layout-cache.ts` | Bounded settled results for synchronous clipboard events. | yes | indirect | – |
| `text-layout-svg.ts` | Settled text becomes vector markup without a second shaping or wrapping pass. | yes | `tests/text-layout-svg.test.ts` | – |
| `text-layout.ts` | DOM-free authored text composition. | yes | `tests/text-layout.test.ts` | – |
| `text-line-layout.ts` | Shared settled glyph, inline and caret placement for a rectangular line. | no | none | – |
| `text-line-policy.ts` | Bounded paragraph optimisation over admitted source boundaries. | no | `tests/text-line-policy.test.ts` | – |
| `text-lines.ts` | Shared line selection. | no | none | – |
| `text-logs.ts` | Log text retains source offsets even when an event cannot be classified. | yes | indirect | – |
| `text-operations.ts` | Discoverable text actions and their portable option declarations. | yes | `tests/text-operations.test.ts` | – |
| `text-paragraph.ts` | Contextual paragraph shaping with logical source and visual placement kept apart. | yes | `tests/text-paragraph.test.ts` | – |
| `text-path.ts` | Shaped clusters follow one authored guide without reversing or rewriting their source. | no | `tests/text-path.test.ts` | – |
| `text-recipes.ts` | Recipes apply only to new work or an explicit paragraph command. | yes | none | – |
| `text-scale.ts` | Explicit typography scaling keeps literal text and named-style identity intact. | yes | indirect | – |
| `text-semantic.ts` | Inline vectors keep their source's bidi and break semantics while occupying one source unit. | yes | indirect | – |
| `text-shaper-host.ts` | A text shaper for the Design measure built on the host's HarfBuzz (plan 295, P3d). | yes | none | – |
| `text-signals.ts` | Text AI-likelihood signals - a string in, a tiered report of the signals that bear on "was this text generated by (or run through) an AI model" out. | yes | `tests/text-signals.test.ts` | – |
| `text-source.ts` | Source boundary helpers shared by editing and composition. | yes | indirect | yes |
| `text-spacing.ts` | Word spacing moves clusters and source carets together without scaling glyph ink. | yes | indirect | – |
| `text-story-document.ts` | Text document admission and exact source round trips. | yes | indirect | – |
| `text-style-commands.ts` | Style commands retain source, literal ranges and no-break constraints. | yes | indirect | – |
| `text-styles.ts` | Style resolution is shared by composition, controls and typed text insertion. | yes | `tests/text-styles.test.ts` | – |
| `text-syntax.ts` | Shared lexical highlighting. | yes | indirect | – |
| `text-tabs.ts` | Tab fields follow authored stops measured from the paragraph's writing edge. | no | none | – |
| `text-thai.ts` | Deterministic dictionary segmentation; unknown runs remain intact. | no | `tests/text-thai.test.ts` | – |
| `text-thread-commands.ts` | Atomic story ownership commands. | yes | `tests/text-thread-commands.test.ts` | – |
| `text-token-bindings.ts` | Paragraph and whole typography links refresh in the shared runtime before composition or export. | no | none | – |
| `text-tools.ts` | On-device text transformations with platform services injected by the host. | yes | indirect | – |
| `text-typography-bindings.test.ts` | Whole typography on composed text uses pinned faces and keeps one undo step per action. | no | none | – |
| `text-unicode.ts` | Unicode 17 source analysis. | no | `tests/text-unicode.test.ts` | – |
| `text-vector.ts` | Conversion consumes settled output, including its decorations, artwork and path poses. | no | `tests/text-vector.test.ts` | – |
| `text-watermark.ts` | Statistical text watermark - the green-list scheme of Kirchenbauer et al., "A Watermark for Large Language Models" (arXiv:2301.10226), as Lolly's own generation paths embed it and /verify detects it. | yes | `tests/text-watermark.test.ts` | – |
| `text-wrap.ts` | Explicit same-artboard obstacles produce bounded line-band exclusions. | no | `tests/text-wrap.test.ts` | – |
| `tiff.ts` | Baseline TIFF encoder (uncompressed, single strip, little-endian). | yes | `tests/tiff.test.ts` | – |
| `timebase.ts` | Project time stays in seconds; frame arithmetic always goes through this module. | no | `tests/timebase.test.ts` | – |
| `timeline-common.ts` | Shared pieces of the EDL, OpenTimelineIO and FCPXML readers: bounded frame rates, drop-frame timecode, and the loss report. | yes | indirect | – |
| `timeline-edl.ts` | CMX 3600 edit decision list reader, written from the public format description. | yes | indirect | yes |
| `timeline-fcpxml.ts` | Final Cut Pro X Markup Language (FCPXML 1.8 to 1.11) reader, written from the public format description. | yes | indirect | yes |
| `timeline-import.ts` | One entry point for every timeline interchange text format Sequence can open. | yes | indirect | – |
| `timeline-otio.ts` | OpenTimelineIO JSON reader, written from the public OTIO schema description. | yes | indirect | yes |
| `token-axes.ts` | Theme groups and what they mean (plans/319). | yes | indirect | – |
| `token-binding.ts` | Typed consumer adapters for token-linked scalar inputs. | yes | none | – |
| `token-block-bindings.test.ts` | Property links keep scalar rendering, portable overrides and explicit cached fallbacks. | no | none | – |
| `token-block-bindings.ts` | Portable links on scalar block properties, with explicit local overrides. | yes | indirect | – |
| `token-border-bindings.test.ts` | Border links preserve a usable stroke and its portable dash overrides. | no | none | – |
| `token-compatibility.ts` | Reports resolver coverage without rewriting imported token data. | no | `tests/token-compatibility.test.ts` | – |
| `token-composite.ts` | Supported DTCG composite fields. | no | none | – |
| `token-consumer-adapters.test.ts` | Composite adapters preserve supported values and bound unsupported data. | no | none | – |
| `token-consumer-adapters.ts` | Closed, explicit projections from composite tokens into existing scalar consumers. | no | none | – |
| `token-context.ts` | Document-scoped token reads, captured snapshots and the family of leads. | yes | indirect | – |
| `token-edit.ts` | Source-preserving typed token value edits. | yes | none | – |
| `token-ext.ts` | The DTCG vendor-extension namespace, alone in its own module. | no | indirect | – |
| `token-font-pins.ts` | Release font identity, byte validation, face matching and render projections. | yes | indirect | – |
| `token-inspect.ts` | Retained token provenance, reference diagnostics and semantic change impact. | yes | indirect | – |
| `token-merge.ts` | Bounded three-way token source merges with explicit conflict decisions. | yes | none | – |
| `token-recipes.ts` | Bounded colour, spacing and modular type recipes. | yes | none | – |
| `token-scope.test.ts` |  | no | none | – |
| `token-scope.ts` | The words a token document says about itself, read through the scope hints. | yes | none | – |
| `token-selection.ts` | Theme group selection, deterministic set precedence and bounded transport parsing. | yes | indirect | – |
| `token-transition-bindings.test.ts` | Enter transitions keep a usable duration and curve across source and local edits. | no | none | – |
| `token-workflows.test.ts` | Token workflow contracts across resolution, binding, recipes, pinned fonts and the shared token fixtures. | no | none | – |
| `tokens.ts` | Design tokens: a platform-agnostic DTCG model. | yes | `tests/tokens.test.ts` | – |
| `tone-curve.ts` | tone-curve.ts - a photo tone curve: control points on the 0..255 scale, the text form an input stores them in, and the curve drawn through them. | no | indirect | – |
| `tool-token-axes.ts` | A tool's opt-out from a kind of theme group (plans/319, manifest `tokenAxes`). | yes | `tests/tool-token-axes.test.ts` | – |
| `tool-url.ts` | Lolly tool-URL recognition. | yes | `tests/tool-url.test.ts` | – |
| `trusted-sites.ts` | Trusted sites (plan 288 section 5.3): the entries a person, a brand or an organisation lists as "may be contacted without asking", and the one matcher every consumer shares (the Sandbox's fetch-and-inline, a Design web… | no | `tests/trusted-sites.test.ts` | – |
| `trustmark.ts` | Adobe TrustMark: BCH data-layer decode (pure GF(2^7) math, DOM-free). | yes | `tests/trustmark.test.ts` | – |
| `tune-provenance.test.ts` | tune-provenance.ts: a tune Lolly composed is algorithmic media and never an AI flag. | no | none | – |
| `tune-provenance.ts` | tune-provenance.ts: what a file made from a Lolly tune says about itself. | no | indirect | – |
| `tune-sign.test.ts` | tune-sign.ts: a WAV made by the music generator reads back with the declaration, the style and the seed, as algorithmic media and with no AI flag, and with the CC BY 4.0 licence and its credit in its tags and its… | no | none | – |
| `tune-sign.ts` | tune-sign.ts: sign a file the music generator made. | no | indirect | – |
| `units.ts` | Physical unit conversions for output dimensions - platform-agnostic, no DOM. | yes | `tests/units.test.ts` | – |
| `url-mode.ts` | URL mode. | yes | indirect | – |
| `url-pack.ts` | Packed URL state - the compact transport for large tool state. | yes | `tests/url-pack.test.ts` | yes |
| `validate.ts` | Validates a tool manifest against the JSON Schema. | yes | indirect | – |
| `vector-paint-import.ts` | Lower admitted static artwork into editable contours and a separate paint tree. | yes | indirect | – |
| `vector-paint-parts.ts` | Separate paint groups only where inherited compositing can remain exact. | no | indirect | – |
| `vector-paint.ts` | Paint trees reference authored contours; geometry has exactly one writable source. | yes | `tests/vector-paint.test.ts` | yes |
| `vector-text.ts` | Outlined labels as live text (plan 275 section 9.3). | no | `tests/vector-text.test.ts` | – |
| `version.ts` | The engine's HostV1 contract version. | yes | indirect | – |
| `video-container-probe.ts` | Video container probe: says what a MOV, MP4 or MXF file holds without decoding a single frame. | no | `tests/video-container-probe.test.ts` | – |
| `video-meta.ts` | Video provenance - embeds the export authorship record (metadata.js) into the two MediaRecorder containers, which are produced bare (no metadata slot exists during recording, so the shell post-processes the finished… | yes | `tests/video-meta.test.ts` | yes |
| `watermark-search.ts` | Lolly pixel watermark - multi-scale + offset recovery search | yes | `tests/watermark-search.test.ts` | – |
| `wav.ts` | WAV reader/writer. | yes | `tests/wav.test.ts` | yes |
| `web-embed.ts` | Web page boxes (plan 288): what a Design box may frame, and in what form. | no | `tests/web-embed.test.ts` | – |
| `webp-anim-decode.ts` | Animated WebP demuxer - pure, DOM-free, platform-agnostic. | yes | `tests/webp-anim-decode.test.ts` | – |
| `webp-anim.ts` | Animated WebP packer - pure, DOM-free, platform-agnostic. | yes | `tests/webp-anim.test.ts` | – |
| `wmf.ts` | WMF (Windows Metafile, 16-bit) emitter - pure, DOM-free, platform-agnostic. | yes | `tests/wmf.test.ts` | – |
| `x509-read.ts` | Shared X.509 parsing and certificate signature verification. | no | none | – |
| `x509.ts` | DER / X.509 authority - pure, DOM-free (globalThis.crypto only; browsers and Node 18+). | yes | `tests/x509.test.ts` | yes |
| `xcf.ts` | GIMP XCF reader - the second layered-bitmap import format beside psd.ts, decoding into the same {@link LayeredRasterDoc}. | yes | `tests/xcf.test.ts` | yes |
| `xlsx-import.ts` | xlsx-import.ts - read one worksheet of an .xlsx into a plain grid. | yes | `tests/xlsx-import.test.ts` | – |
| `xlsx-write.ts` | xlsx-write.ts - write a plain grid out as a valid SpreadsheetML .xlsx. | yes | `tests/xlsx-write.test.ts` | – |
| `xml-escape.ts` | The one XML text/attribute escaper for the document writers (EPUB, ODT, AppStream). | no | `tests/xml-escape.test.ts` | – |
| `xmp-fields.ts` | Bounded XMP/RDF property reader for metadata evidence, including namespace aliases. | no | none | – |
| `zip-crypto.ts` | Two-tier zip encryption - the crypto behind the "lock this download" option. | yes | `tests/zip-crypto.test.ts` | – |
| `zip.ts` | zip.ts - the shared PLAIN (unencrypted) zip primitive. | yes | `tests/zip.test.ts` | – |
| `zzfx-compose.ts` | ZzFXM composition - the shared ZzFX preset bank + the archetype composer behind Lolly's procedural music (Neurospicy Mode tracks, video music beds, the ingest/generator scripts). | yes | `tests/zzfx-compose.test.ts` | – |
| `zzfxm-ref.ts` | zzfxm-ref.ts: the `zzfxm:<seed>[:<style>]` asset id, and nothing else. | yes | `tests/zzfxm-ref.test.ts` | – |
| `zzfxm.ts` | ZzFXM procedural-music renderer. | yes | `tests/zzfxm.test.ts` | yes |
<!-- engine-modules:end -->
