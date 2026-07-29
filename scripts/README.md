# `scripts/`

Build, validation and content-ingest scripts for the umbrella repo. There are 52 top-level TypeScript scripts here plus one shell script and two Python converters, and until now they were discoverable only by reading the `scripts` block of the root `package.json`. This file is the index.

Everything here is owned by the umbrella (`lolly`) repo and runs on Node directly, without a build step, using Node's native type-stripping. `scripts/tsconfig.json` is what `npm run typecheck` uses for this directory.

Read this alongside [`../CONTRIBUTING.md`](../CONTRIBUTING.md), which explains the submodule layout and which repo owns which file.

## How to read the tables

Each script carries flags for the things that will surprise you:

| Flag | Meaning |
|---|---|
| **DESTRUCTIVE** | Overwrites or deletes files in place. Commit or stash your work first. |
| **submodule** | Writes into a git submodule, so the change lands in another repository. Usually `catalog/` (a symlink into the active brand pack), `community/`, `docs/` or `shells/web/`. |
| **network** | Makes outbound requests. Will not work offline. |
| **browser** | Drives a real Chromium through Playwright. Slow, and needs the browser installed. |
| **native** | Shells out to a native toolchain (Emscripten, poppler, `sips`, Python with PyTorch). |
| **API key** | Needs a credential in the environment. |

A note on `catalog/` in the tables below: it is the gitignored symlink view of the active profile's brand catalog. Under the `suse` profile it resolves into the private `brands/suse` submodule; under `lolly-start` it resolves into `brands/lolly-start/`, which the umbrella owns. So whether a preview or OG script counts as writing into a submodule depends on which profile is active.

## Catalog build and validation

The manifest is always the source of truth; `catalog/tools/index.json` and the asset checksums are generated and must not drift. CI's `validate-catalog` job enforces that.

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `build-catalog-index.ts` | part of `build:catalog` | Regenerates `catalog/tools/index.json` from every `tool.json` in the active profile's `tools/` view. | DESTRUCTIVE, submodule |
| `checksum-assets.ts` | part of `build:catalog` | Recomputes the content checksums in `catalog/assets/index.json`. | DESTRUCTIVE, submodule |
| `build-preview-bundle.ts` | part of `build:catalog`, `previews` | Builds the preview-look bundle the gallery's featured hero row and example carousels render from. | DESTRUCTIVE, submodule |
| `validate-catalog.ts` | `validate:catalog` | Validates every `tool.json` and asset entry against the schemas, then checks the invariants schemas cannot express: checksums, file existence, `bindToProfile` fields, palette references, `replacedBy` chains, and canonical-input divergence (a warning, never an error). | |
| `build-catalog-all.ts` | `build:catalog:all`, `validate:catalog:all` (`--check`) | Rebuilds or checks **every mounted profile's** catalog, then restores the profile you started on. This is the one to run after any community `tool.json` edit, because the index is generated per brand. Skips a profile whose packs are not mounted rather than failing. | DESTRUCTIVE, submodule |
| `sign-catalog.ts` | none | Produces `catalog/tools/index.sig.json`, the ECDSA P-256/SHA-256 integrity envelope `engine/src/catalog-integrity.ts` verifies before executing tool code. Deliberately not part of `build:catalog`, and no key lives in the repo: pass `--keyfile` or set `LOLLY_CATALOG_SIGNING_KEY`. `--gen-key` writes a fresh keypair into the gitignored `keys/` and refuses to overwrite an existing one. | submodule, API key |
| `build-readme-tools.ts` | `build:readme-tools` | Regenerates the "Current tools" section of the root `README.md` between its marker comments, from the active profile's `catalog/tools/index.json`. | DESTRUCTIVE |
| `sync-shared-hooks.ts` | `sync:shared` | Rewrites every `// === lolly:shared <name> ===` region in a tool's `hooks.js` from its canonical source in `community/_shared/`. Idempotent, refuses CRLF files, fails loudly on malformed or nested regions. | DESTRUCTIVE, submodule |

## Profiles and brands

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `use-profile.ts` | `profile`, `profile:suse`, `profile:start`, `postinstall` (`--auto`) | The profile switcher. Builds the repo-root `tools/` and `catalog/` views. See [Profile resolution](#profile-resolution-and-the-lolly-profile-state-file) below. | DESTRUCTIVE |
| `ingest-brand.ts` | `ingest:brand` | Hydrates a `brands/<name>/` pack from a DTCG, Tokens Studio or Penpot token export, optionally registering or activating it as a profile. | DESTRUCTIVE, native |
| `build-brand-tokens.ts` | none | Emits the canonical SUSE colour tokens as a DTCG document at `catalog/assets/suse/tokens/brand.json`, reshaped from the web shell's swatch list in `shells/web/src/palette.ts` (the script's own header still names the pre-migration `palette.js`). Run `build:catalog` afterwards to checksum it. | DESTRUCTIVE, submodule |
| `check-bootstrap.ts` | `preinstall` | Refuses `npm install` into a half-cloned checkout, where submodule workspace mount points have no `package.json` and npm would fail during workspace resolution with an unhelpful error. | |

## Previews and thumbnails

These drive tools in a real browser and export through the app's own render path, so the committed preview is byte-faithful to a real user export. They are one-shot generators: run locally, commit the output.

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `build-previews.ts` | part of `previews` | Captures each tool's gallery preview, keeping SVG where it can and rasterising where it cannot. | DESTRUCTIVE, submodule, browser |
| `build-animated-previews.ts` | `previews:animated` | Gives an animating tool a looping APNG instead of a frozen still, exported through the engine's own `renderApng` path. Writes committed authored overrides in the tool dir, which win over build-generated previews. | DESTRUCTIVE, submodule, browser |
| `build-thumbnails.ts` | `optimize:thumbnails` | Derives the raster thumbnail sizes for catalog assets listed in `catalog/assets/index.json`. | DESTRUCTIVE, submodule |
| `optimize-previews.ts` | `optimize:previews` | Runs svgo over every generated `catalog/previews/*.svg` in place. | DESTRUCTIVE, submodule |
| `optimize-preview-svg.ts` | none | The build-time SVG optimisation helpers `build-previews.ts` uses per thumbnail. | |
| `optimize-preview-png.ts` | `optimize:preview-png` | Downscales the raster previews. | DESTRUCTIVE, submodule |
| `optimize-preview-webp.ts` | `optimize:preview-webp`, part of `previews` | Converts the rasterised previews to WebP. | DESTRUCTIVE, submodule |
| `optimize-assets.ts` | `optimize:assets` | Runs svgo over the authored catalog SVG assets in place, cutting transfer for the gallery and pickers. | DESTRUCTIVE, submodule |

## OG images and cards

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `build-tool-og.ts` | part of `og`, part of `build:web` | Per-tool Open Graph share cards. | DESTRUCTIVE, submodule, browser |
| `build-view-og.ts` | part of `og`, part of `build:web` | Per-view Open Graph cards for the app's own sections. | DESTRUCTIVE, submodule, browser |
| `build-og-all.ts` | `og:all` | Rebuilds the OG cards for every mounted profile, restoring the starting profile afterwards. | DESTRUCTIVE, submodule, browser |
| `build-svg-card.ts` | `cards:svg` | Generates the animated inline-SVG card format for tools that are, at heart, a self-contained animated SVG. | DESTRUCTIVE, submodule |
| `build-html-card.ts` | `cards:html` | The third card format, produced by running the tool through the CLI shell with `--export=html`. | DESTRUCTIVE, native |

## Signing and credentials

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `sign-credentialed-assets.ts` | `sign:credentials`, `sign:credentials:ca`, `sign:credentials:catalog` | Mints the "Made with Lolly" Content Credentials demo set for the catalog. The `:ca` and `:catalog` aliases run under `--env-file=services/ca/.env`. | DESTRUCTIVE, submodule, API key |
| `sign-inline-logos.ts` | `sign:signature-logos` | Bakes Content Credentials into the brand logos a tool inlines as `data:` URIs, then syncs the base64 back into that tool's `hooks.js`. Never hand-paste the base64. | DESTRUCTIVE, submodule, API key |
| `lib/durable-node.ts` | none | The build-time Node path for TrustMark durable-credential embedding, the onnxruntime-node counterpart to the browser embed. | |
| `lib/stamp-media.ts` | none | Shared build-time provenance stamping, so every generator (OG cards, previews, thumbnails) credentials its output identically. | |
| `fetch-trustmark-models.ts` | none | Downloads Adobe's official TrustMark ONNX watermark models into `shells/web/public/models/trustmark/`, where the web shell fetches them same-origin at runtime. | network, submodule |
| `convert-trustmark-encoder-onnx.py` | none | Converts Adobe TrustMark's PyTorch **encoder** to ONNX, the embed counterpart to the decoders already fetched. Needs `torch` plus the `trustmark` pip package. | network, native |
| `convert-contentseal-onnx.py` | none | Converts Meta's open Pixel Seal / Video Seal image-mode watermark **extractor** to ONNX for the `/verify` deep scan. | network, native |

## i18n

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `translate.ts` | `translate` | Bulk machine translation via the Claude API, with a shared glossary, content-hash incremental caching, placeholder and structure validation, and a human-overrides layer that always wins. Two corpora: `spa` (the web shell's `src/locales/<lang>.json`) and `tools` (per-tool `i18n/<lang>.json` sidecars, written straight into each pack's source directory rather than through the `tools/` view, so every pack is covered regardless of the active profile). `--check` exits non-zero on stale or missing strings without calling the API. | DESTRUCTIVE, submodule, network, API key (`ANTHROPIC_API_KEY`) |
| `i18n/glossary.json` | | Shared translation glossary. | |
| `i18n/cache.json` | | The content-hash translation cache. | |
| `i18n/extra-keys.spa.json` | | The hand-listed dynamically-keyed `t()` call sites the source scan cannot find. | |
| `i18n/overrides/` | | Human corrections that always beat machine output. | |
| `propagate-shot-recipes.ts` | none | Copies screenshot-recipe images from each English docs page into its translated sidecars under `docs/i18n/<lang>/`, so a localised page shows a screenshot at all. | DESTRUCTIVE, submodule |

## SBOM and licences

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `build-sbom.ts` | `build:sbom` | Generates the Software Bill of Materials. | DESTRUCTIVE |
| `build-licenses.ts` | `build:licenses` | Generates the third-party licence and NOTICE file. | DESTRUCTIVE |

## API function bundles

`api/mcp/[...path].js` and `api/ca/[...path].js` are generated esbuild bundles. Never hand-edit them. CI's `api-bundles` job rebuilds both and fails on drift.

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `build-mcp-fn.ts` | `build:mcp-fn` | Bundles the MCP serverless handler into a single self-contained catch-all function serving the JSON-RPC endpoint and the OAuth flow. | DESTRUCTIVE |
| `build-ca-fn.ts` | `build:ca-fn` | The same treatment for the C2PA device-enrolment CA handler. | DESTRUCTIVE |
| `check-mcp-live.ts` | `check:mcp` | Live smoke check of the deployed serverless functions behind lolly.tools. | network |

## Engine module map

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `gen-engine-modules.ts` | `build:engine-modules`, `check:engine-modules` (`--check`) | Regenerates the module table in [`../engine/README.md`](../engine/README.md), between the `<!-- engine-modules:start -->` and `<!-- engine-modules:end -->` markers. Never hand-edit inside those markers. `--check` fails on drift and is wired into CI's `typecheck` job as the "Engine module map drift" step. | DESTRUCTIVE |
| `pack-engine.ts` | `pack:engine` | Produces the distributable, checksummed engine bundle that downstream consumers pin against, unmodified. | DESTRUCTIVE |

## Dev helpers, guards and audits

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `dev-web.ts` | `dev:web` | The local dev orchestrator: runs the web shell and keeps the deploy artifacts, including the `/info` site, fresh as docs change. | |
| `copy-ort.ts` | `build:ort` | Copies the onnxruntime-web runtime files out of `node_modules`, tolerating either hoisting layout. | DESTRUCTIVE, submodule |
| `copy-viz-presets.ts` | none | Stages the curated MilkDrop artist presets from `node_modules/butterchurn-presets` into `shells/web/public/viz-presets/`. Depend, do not vendor: these are community works by roughly 118 authors and are never committed here. | DESTRUCTIVE, submodule |
| `build-viz-preset-list.ts` | none | Rebuilds `scripts/viz-preset-list.json` and the matching option list in `community/audiogram/tool.json` from butterchurn's own packs, replacing what used to be a hand-assembled selection. | DESTRUCTIVE, submodule |
| `check-bundle-budget.ts` | `check:bundle` | Regression guard on the web shell's boot-path bundle size. | |
| `build-docs-shots.ts` | `docs:shots` | Captures, compares and credentials the docs screenshots that are declared as ordinary markdown images in the docs pages. Switches profile while it runs and restores it afterwards. | DESTRUCTIVE, submodule, browser, native |
| `lib/shot-compare.ts` | none | The pure comparison logic behind `build-docs-shots.ts`. | |
| `lib/rasterize-svg-browser.ts` | none | SVG to PNG through our own render path in Chromium rather than resvg. | browser |
| `lib/pdfrender.swift` | none | Renders page one of a PDF to PNG via Quartz, the renderer every macOS app uses. An independent ground truth for the vector audit. | native |
| `audit-vector-render.ts` | none | Three-way conformance audit of the print-PDF to SVG interpreter: a screen screenshot, the same print PDF rendered by an independent engine (poppler `pdftoppm`, else macOS `sips`), and our SVG rasterised back. Splits the loss into Chromium's print pass and our interpreter. Writes a dated report under `plans/`. | browser, native, network |
| `characterize-export.ts` | none | Characterisation harness for `shells/web/src/bridge/export.ts`, the large web-shell export bridge with no direct tests. Snapshots to `scratch/export-characterization.json`. | DESTRUCTIVE, browser |
| `probe-tool-paint-order.ts` | none | A/B probe for `ExportOpts.stackingOrder` against real tools. Evidence, not a gate. | browser |
| `build-libopenmpt-wasm.sh` | none | Reproducibly rebuilds the vendored libopenmpt WebAssembly tracker decoder as a single self-contained ES module. Needs Emscripten. | DESTRUCTIVE, submodule, native, network |

## Audio and media ingest

All four write into `brands/lolly-start/catalog/`, which the umbrella owns, so they do not touch a submodule.

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `gen-music.ts` | none | Generates a varied set of CC0 ZzFXM tracks (ambient, rhythmic and others) for Neurospicy Mode and video music beds. | DESTRUCTIVE |
| `ingest-midi.ts` | none | Converts a Standard MIDI File into a small ZzFXM song and registers it as an `audio`/`zzfxm` catalog asset tagged `neurospicy`. | DESTRUCTIVE |
| `ingest-lofi.ts` | none | Converts a curated set of public-domain lo-fi tracks to opus and registers them under `lolly/loops/`. | DESTRUCTIVE, network |
| `ingest-audio.ts` | none | Tracker-module and general audio catalog ingest. Dry run by default. | DESTRUCTIVE |
| `build-voice-clips.ts` | `voice` | Synthesises a robot voice speaking each UI filter, treatment and theme name at build time. One-shot: run locally, commit the output. | DESTRUCTIVE, submodule |
| `build-street-clips.ts` | none | Offline road and water geometry prep for the `street-map` tool, fetched from OpenStreetMap via the public Overpass API. Writes into the tool's `lib/` directory through the `tools/` view, so it lands in `community/street-map/lib/`. | DESTRUCTIVE, submodule, network |
| `lib/zzfx-music.ts` | none | A re-export shim. The ZzFX preset bank and ZzFXM composition helpers now live in `engine/src/zzfx-compose.ts`. | |

## The subrepo split toolkit

[`subrepo/`](subrepo/README.md) holds the multi-repo workflow, documented in its own README. `subrepo/loldev` is the wrapper you put on your PATH; `config.sh`, `status.sh`, `sync.sh`, `verify.sh`, `snap-history.sh` and `migrate.sh` are the pieces behind it. `loldev ship` is the only supported route to a lolly.tools deploy, because it archive-deploys the local tree (private packs included) and pins `LOLLY_PROFILE` for that one build.

## Profile resolution and the `.lolly-profile` state file

`scripts/use-profile.ts` materialises the repo-root `tools/` and `catalog/` paths as gitignored views of one profile named in [`../profiles.json`](../profiles.json). `catalog` becomes a symlink to the brand's catalog directory, and `tools/` becomes a directory of per-tool symlinks merged from the profile's tool roots, with later roots winning on id collision so a brand pack can override a community tool.

**`.lolly-profile`** is a one-line file at the repo root holding the name of the currently active profile. It is gitignored (`.gitignore` line 249), it is the sticky record of your local choice, and it is what `npm run profile` prints as "Active profile". Other scripts read it too: `build-catalog-all.ts`, `build-og-all.ts` and `build-docs-shots.ts` all snapshot it before switching profiles so they can restore your choice afterwards, `shells/web/vite.config.js` reads it to know which brand it is building, and `subrepo/status.sh` and `subrepo/verify.sh` report it.

When the script is given an explicit name (`npm run profile:suse`), that name wins outright. Under `--auto`, which is what `postinstall` runs, the resolution order is:

1. **`LOLLY_PROFILE`** in the environment, trimmed. Explicit, and the mechanism that works on Vercel.
2. **`.lolly-profile`**, the sticky local choice, but only if it names a known profile whose packs are all present on disk.
3. **The `default`** field in `profiles.json` (`suse` today), if its packs are all present.
4. **The first profile in `profiles.json` whose packs are all complete.** This is the public-clone path: `brands/suse` is `update = none`, so it is absent, the default is incomplete, and the fallback lands on `lolly-start` with a warning.

Two deliberate fail-loud exceptions cut across that order. On Vercel (`$VERCEL` set) an incomplete profile is a hard `exit 1` rather than a fallback, whether the profile came from the default branch or from an explicitly set `LOLLY_PROFILE`, because silently falling back there would deploy the blank brand to production. And an overlay authoring error (a brand tool declaring `"extends": "community"` whose base is missing) fails the build even under `--auto`, rather than shipping a silent partial tool.

Two more behaviours worth knowing. `--copy`, implied by `$VERCEL`, materialises real copies instead of symlinks, because Vercel's function-bundling globs and the tgz archive path are not symlink-safe. And a view is only ever deleted when it is recognisably ours, meaning a symlink, a symlink farm, or a copy carrying the `.lolly-view.json` marker. Real content sitting at `tools/` or `catalog/` aborts the switch instead of being clobbered.
