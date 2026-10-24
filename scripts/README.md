# `scripts/`

Build, validation and content-ingest scripts for this repo. There are 52 top-level TypeScript scripts here plus one shell script and two Python converters, and until now they were discoverable only by reading the `scripts` block of the root `package.json`. This file is the index.

Everything here runs on Node directly, without a build step, using Node's native type-stripping. `scripts/tsconfig.json` is what `pnpm run typecheck` uses for this directory.

Native packaging commands clean their ignored Rust and Android intermediates after a successful build with a fresh package. Desktop `bundle/`, Android `outputs/`, and iOS `gen/apple/build/` packages stay in place. Failed and unbundled builds keep their caches. Set `LOLLY_KEEP_NATIVE_CACHE=1` when you need incremental native builds. External `CARGO_TARGET_DIR` caches stay untouched.

Run `node scripts/clean-native-builds.ts` to preview old caches in the current checkout, then add `--apply` to clean them. Use `--mobile` or `--desktop` to choose a shell. Cleanup refuses tracked files, linked cache roots, unrecognised directories, and active native compilers. Symlinks inside caches stay untouched. This command works in each worktree; it never searches or deletes other checkouts.

Read this alongside [`../CONTRIBUTING.md`](../CONTRIBUTING.md), which explains which file lives where.

Before branch cleanup, lock any worktree referenced by production helpers,
backup or migration evidence, or other external configuration with
`git worktree lock --reason "external deployment or recovery reference" <path>`.
Keep the lock until those references have moved. A clean, idle checkout with
commits in main can still be needed by an external tool; the cleanup script
cannot discover those references.

## How to read the tables

Each script carries flags for the things that will surprise you:

| Flag | Meaning |
|---|---|
| **DESTRUCTIVE** | Overwrites or deletes files in place. Commit or stash your work first. |
| **submodule** | Writes into the one remaining git submodule, `brands/suse`, so the change lands in a separate, private repository. |
| **network** | Makes outbound requests. Will not work offline. |
| **browser** | Drives a real Chromium through Playwright. Slow, and needs the browser installed. |
| **native** | Shells out to a native toolchain (Emscripten, poppler, `sips`, Python with PyTorch). |
| **API key** | Needs a credential in the environment. |

A note on `catalog/` in the tables below: there is no `catalog/` directory on disk any more. It is a logical path resolved at build and run time by `packages/node-shell/src/content-roots.ts` (`catalogFile()`) from the active profile's brand pack - `brands/suse/catalog` under the `suse` profile, `brands/lolly-start/catalog` under `lolly-start`. Whether a preview or OG script counts as writing into the private submodule depends on which profile is active; `pnpm run profile` prints the resolved paths.

## Catalog build and validation

The manifest is always the source of truth; `catalog/tools/index.json` and the asset checksums are generated and must not drift. CI's `validate-catalog` job enforces that.

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `build-catalog-index.ts` | part of `build:catalog` | Regenerates `catalog/tools/index.json` from every `tool.json` in the active profile's tool packs. | DESTRUCTIVE, submodule |
| `checksum-assets.ts` | part of `build:catalog` | Recomputes the content checksums in `catalog/assets/index.json`. | DESTRUCTIVE, submodule |
| `build-preview-bundle.ts` | part of `build:catalog`, `previews` | Builds the preview-look bundle the gallery's featured hero row and example carousels render from. | DESTRUCTIVE, submodule |
| `validate-catalog.ts` | `validate:catalog` | Validates every `tool.json` and asset entry against the schemas, then checks the invariants schemas cannot express: checksums, file existence, `bindToProfile` fields, palette references, `replacedBy` chains, and canonical-input divergence (a warning, never an error). | |
| `build-catalog-all.ts` | `build:catalog:all`, `validate:catalog:all` (`--check`) | Rebuilds or checks **every mounted profile's** catalog by passing `--profile=<name>` to the underlying build for each one in turn. This is the one to run after any community `tool.json` edit, because the index is generated per brand. Skips a profile whose packs are not mounted rather than failing. | DESTRUCTIVE, submodule |
| `sign-catalog.ts` | none | Produces `catalog/tools/index.sig.json`, the ECDSA P-256/SHA-256 integrity envelope `engine/src/catalog-integrity.ts` verifies before executing tool code. Deliberately not part of `build:catalog`, and no key lives in the repo: pass `--keyfile` or set `LOLLY_CATALOG_SIGNING_KEY`. `--gen-key` writes a fresh keypair into the gitignored `keys/` and refuses to overwrite an existing one. `--min-seq <n>` or `LOLLY_CATALOG_MIN_SEQ` can only raise the computed sequence. The flag takes precedence; accept integers from 0 to `Number.MAX_SAFE_INTEGER`. | submodule, API key |
| `build-readme-tools.ts` | `build:readme-tools` | Regenerates the "Current tools" section of the root `README.md` between its marker comments, from the active profile's `catalog/tools/index.json`. | DESTRUCTIVE |
| `sync-shared-hooks.ts` | `sync:shared` | Rewrites every `// === lolly:shared <name> ===` region in a tool's `hooks.js` from its canonical source in `community/_shared/`. Idempotent, refuses CRLF files, fails loudly on malformed or nested regions. | DESTRUCTIVE, submodule |

## Profiles and brands

`node scripts/build-adobe-qa-pack.ts --out=<empty-directory> --corpus=<pinned-PSD-corpus>`
builds a native Adobe qualification pack with PSD preservation specimens, IDML,
Premiere XML and original media, an Illustrator SVG and a Darkroom XMP fixture.
The generator checks supported geometry, timing and source hashes. Its manifest
records source identity and leaves native application results pending. Existing
output directories must be empty so prior tester results cannot be overwritten.

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `ingest-brand.ts` | `ingest:brand` | Hydrates a `brands/<name>/` pack from a DTCG, Tokens Studio or Penpot token export, optionally registering or activating it as a profile. | DESTRUCTIVE, native |
| `build-brand-tokens.ts` | none | Emits the canonical SUSE colour tokens as a DTCG document at `catalog/assets/suse/tokens/brand.json`, reshaped from the web shell's swatch list in `shells/web/src/palette.ts` (the script's own header still names the pre-migration `palette.js`). Run `build:catalog` afterwards to checksum it. | DESTRUCTIVE, submodule |
| `check-bootstrap.ts` | `preinstall` | Refuses `pnpm install` when no profile in `profiles.json` is complete on disk - the case that matters now that every pnpm workspace lives in this repository is a missing or incomplete brand pack, not a missing submodule. `brands/suse` being absent is expected and fine, since `lolly-start` covers it. | |

### The content-pack resolver

`packages/node-shell/src/content-roots.ts` is not a script - it is imported at build and run time - but it replaces what `use-profile.ts` used to do here, so it is worth naming: `contentRoots()` resolves the active profile from `profiles.json` and `LOLLY_PROFILE`; `toolFile()` and `catalogFile()` answer where a given tool or catalog path lives for that profile; `materializeInto()` writes a real `tools/` + `catalog/` tree, the one place a build still needs actual files on disk (`dist/`, an RPM payload, a Docker image). Nothing switches a shared view any more, so there is no state file and no restore-on-exit dance - each call just resolves against the current environment. `pnpm run profile` prints what it resolves to.

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
| `build-og-all.ts` | `og:all` | Rebuilds the OG cards for every mounted profile, one `--profile=<name>` pass at a time. | DESTRUCTIVE, submodule, browser |
| `build-svg-card.ts` | `cards:svg` | Generates the animated inline-SVG card format for tools that are, at heart, a self-contained animated SVG. | DESTRUCTIVE, submodule |
| `build-html-card.ts` | `cards:html` | The third card format, produced by running the tool through the CLI shell with `--export=html`. | DESTRUCTIVE, native |

## Signing and credentials

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `sign-credentialed-assets.ts` | `sign:credentials:catalog` | Stamps every stampable catalog asset in place as "Delivered by Lolly" (c2pa.published + true author, under the CA identity), and strips any lingering retired `suse/credentials/*` demo entry from the index. The npm command loads the owner-private environment through `run-private-ca.ts`. (The old `suse/credentials/*` "Made with Lolly" demo set it used to mint was retired 2026-08-16.) | DESTRUCTIVE, submodule, API key |
| `run-private-ca.ts` | `ca:dev`, CA signing commands | Validates the device-private directory/file ownership and modes, rejects symlinks, loads `ca.env`, and launches only a reviewed CA task without a shell. See `security/local-credential-storage.md`. | LOCAL, secret-bearing environment |
| `sign-inline-logos.ts` | `sign:signature-logos` | Bakes Content Credentials into the brand logos a tool inlines as `data:` URIs, then syncs the base64 back into that tool's `hooks.js`. Never hand-paste the base64. | DESTRUCTIVE, submodule, API key |
| `sign-docs-media.ts` | none (`run-private-ca.ts sign-docs-media`) | Renews the credential on a served `/info` image whose signing certificate lapsed, without re-encoding it: the old store becomes the `parentOf` ingredient, the new manifest records `c2pa.published` under a Lolly CA leaf, and nothing is written unless the image chunks and decoded pixels match and Verify resolves to "Delivered by Lolly" with any AI declaration intact. `--check` signs in memory only. WebP only for now. | DESTRUCTIVE, secret-bearing environment |
| `lib/durable-node.ts` | none | The build-time Node path for TrustMark durable-credential embedding, the onnxruntime-node counterpart to the browser embed. | |
| `lib/stamp-media.ts` | none | Shared build-time provenance stamping, so every generator (OG cards, previews, thumbnails) credentials its output identically. | |
| `fetch-trustmark-models.ts` | none | Downloads Adobe's official TrustMark ONNX watermark models into `shells/web/public/models/trustmark/`, where the web shell fetches them same-origin at runtime. | network, submodule |
| `convert-trustmark-encoder-onnx.py` | none | Converts Adobe TrustMark's PyTorch **encoder** to ONNX, the embed counterpart to the decoders already fetched. Needs `torch` plus the `trustmark` pip package. | network, native |
| `convert-contentseal-onnx.py` | none | Converts Meta's open Pixel Seal / Video Seal image-mode watermark **extractor** to ONNX for the `/verify` deep scan. | network, native |

## i18n

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `translate.ts` | `translate` | Bulk machine translation via the Claude API, with a shared glossary, content-hash incremental caching, placeholder and structure validation, and a human-overrides layer that always wins. Two corpora: `spa` (the web shell's `src/locales/<lang>.json`) and `tools` (per-tool `i18n/<lang>.json` sidecars, written straight into each pack's source directory rather than through the resolver, so every pack is covered regardless of the active profile). `--check` exits non-zero on stale or missing strings without calling the API. | DESTRUCTIVE, submodule, network, API key (`ANTHROPIC_API_KEY`) |
| `i18n/glossary.json` | | Shared translation glossary. | |
| `i18n/cache.json` | | The content-hash translation cache. | |
| `i18n/extra-keys.spa.json` | | The hand-listed dynamically-keyed `t()` call sites the source scan cannot find. | |
| `i18n/overrides/` | | Human corrections that always beat machine output. | |
| `propagate-shot-recipes.ts` | none | Copies screenshot-recipe images from each English docs page into its translated sidecars under `docs/i18n/<lang>/`, so a localised page shows a screenshot at all. | DESTRUCTIVE, submodule |

## SBOM and licences

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `build-cargo-licenses.ts` | `build:cargo-licenses` | Generates `security/cargo-licenses.json` (crate licences for the Tauri shells, via `cargo metadata`). Needs `cargo`. | DESTRUCTIVE |
| `build-sbom.ts` | `build:sbom` | Generates the Software Bill of Materials. | DESTRUCTIVE |
| `build-licenses.ts` | `build:licenses` | Generates the third-party licence and NOTICE file. | DESTRUCTIVE |

## API function bundles

`api/mcp/[...path].js` and `api/ca/[...path].js` are generated esbuild bundles. Never hand-edit them. CI's `api-bundles` job rebuilds both and fails on drift.

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `build-mcp-fn.ts` | `build:mcp-fn` | Bundles the MCP serverless handler into a single self-contained catch-all function serving the JSON-RPC endpoint and the OAuth flow. | DESTRUCTIVE |
| `build-ca-fn.ts` | `build:ca-fn` | The same treatment for the C2PA device-enrolment CA handler. | DESTRUCTIVE |
| `check-mcp-live.ts` | `check:mcp` | Live smoke check of the deployed serverless functions behind lolly.tools. | network |
| `check-api-bundles.ts` | | Compares the committed `api/` function bundles with a fresh build. Strict on pushes and tags; a pull request fails only when it changes what the bundles are built from. | |

## Engine module map

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `gen-engine-modules.ts` | `build:engine-modules`, `check:engine-modules` (`--check`) | Regenerates the module table in [`../engine/README.md`](../engine/README.md), between the `<!-- engine-modules:start -->` and `<!-- engine-modules:end -->` markers. Never hand-edit inside those markers. `--check` fails on drift; `--check --allow-drift` only warns on drift and still fails on missing markers or a generator error, which is how CI's `typecheck` job and the pre-push hook run it. `.github/workflows/generated-readmes.yml` regenerates the table after each merge (with `gen-web-src-readme.ts`) and proposes it as one bot pull request. | DESTRUCTIVE |
| `pack-engine.ts` | `pack:engine` | Produces the distributable, checksummed engine bundle that downstream consumers pin against, unmodified. | DESTRUCTIVE |

## Dev helpers, guards and audits

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `dev-web.ts` | `dev:web` | The local dev orchestrator: runs the web shell and keeps the deploy artifacts, including the `/info` site, fresh as docs change. | |
| `copy-ort.ts` | `build:ort` | Copies the onnxruntime-web runtime files out of `node_modules`, tolerating either hoisting layout. | DESTRUCTIVE, submodule |
| `copy-viz-presets.ts` | none | Stages the curated MilkDrop artist presets from `node_modules/butterchurn-presets` into `shells/web/public/viz-presets/`. Depend, do not vendor: these are community works by roughly 118 authors and are never committed here. | DESTRUCTIVE, submodule |
| `build-viz-preset-list.ts` | none | Rebuilds `scripts/viz-preset-list.json` and the matching option list in `community/audiogram/tool.json` from butterchurn's own packs, replacing what used to be a hand-assembled selection. | DESTRUCTIVE, submodule |
| `migrate-checkout.sh` | none | Moves a checkout from the pre-fold submodule layout onto the folded repository in place: dry run by default, `--yes` applies; exports local submodule commits as patches, parks the gitignored heavy directories, deinitialises the ten old submodules, fast-forwards main, removes the retired views, reinstalls. | DESTRUCTIVE |
| `prune-caches.ts` | `prune:caches` | Reports the regenerable build caches (Tauri Rust targets, Playwright browsers, Xcode DerivedData, the MCP browser install, unreferenced pnpm store packages) with sizes; `--yes` deletes them, `--when-below=<GiB>` acts only when the disk is that low. The Claude Code SessionStart hook runs it with `--yes --when-below=10 --quiet`. | DESTRUCTIVE |
| `branch-hygiene.ts` | `branch:hygiene` | Reports remote branches, local branches and worktrees against `origin/main`, including equivalent squash/rebase merges and open PR heads or bases. Fetch preserves stale remote-tracking refs. `--prune` rechecks live main, each remote branch SHA, GitHub PRs and protection before a leased delete; only ancestors of the pinned main are eligible, so equivalent changes with unique history stay for manual archival. Worktree removal requires a fresh successful process inventory, unchanged registration, no lock or nested worktree, an idle index, no local or ignored paths, and a HEAD already in pinned main. No `--force`, notes transfer, local branch deletion or global worktree-registration pruning. Build directories, `node_modules`, notes and unfamiliar files retain their worktree; use the separate cache tools after reviewing them. Every action logs its SHA first. GitHub metadata checks and the SHA lease are separate operations, so coordinate with other users before cleanup. `--remote-only --check` is the weekly report. | DESTRUCTIVE (`--prune` only), network |
| `check-bundle-budget.ts` | `check:bundle` | Regression guard on the web shell's boot-path bundle size. | |
| `check-house-rules.ts` | `check:house-rules` | Ratcheting check of the web shell's own CSS against the house rules: no single-edge rail on a rounded element (H1), dashed only for drop areas (H2), durations from the motion tokens (H4), both Reduce motion switches on anything that moves (H5) and no custom property that nothing defines (H6). Reads `shells/web/src` (vendor excepted), the `<style>` blocks in `shells/web/index.html` and the CSS literals in `docs/build.ts`; not a brand's Design rules. Counts per file and rule live in `scripts/house-rules-baseline.json`, reviewed exceptions in `scripts/data/house-rules-allow.json`. Runs in CI and the pre-push hook. | `--write` records a fall and refuses a rise; `--list [--rule=H2] [--file=<path>]` prints every finding |
| `check-pushed-plans.ts` | none | Refuses a push whose new commits add or change a file under `plans/`, the gitignored private folder that `git add -f` can still commit. Commits that a remote-tracking ref already reaches are not checked again, side branches are followed through their merges and deletions pass, so the folder can be emptied. Runs first in the pre-push hook; `tests/no-tracked-plans.test.ts` is the CI backstop. | `--pre-push` reads ref updates on stdin; otherwise pass commits or refs |
| `check-ui-performance.ts` | `check:ui-performance` | Measures gallery scroll/search, tool opening/editing, idle main-thread use and live Performance UI toggling in Chromium. Repeated OFF/ON runs with CPU throttling; JSON report and optional target enforcement. See [`shells/web/PERFORMANCE.md`](../shells/web/PERFORMANCE.md). | browser, network |
| `build-docs-shots.ts` | `docs:shots` | Captures, compares and credentials the docs screenshots that are declared as ordinary markdown images in the docs pages. Pins the `lolly-start` profile for the capture, since SUSE tools and assets must never reach the public docs repo. | DESTRUCTIVE, submodule, browser, native |
| `lib/shot-compare.ts` | none | The pure comparison logic behind `build-docs-shots.ts`. | |
| `docs-ratchets.ts` | none | Three one-directional docs checks with baselines in `scripts/data/docs-ratchets/`: an English page that uses a tool or asset id a public clone lacks, a page whose first heading is not its nav title, and a page that names Vercel more often than before. Reports by default; `--write` rewrites the baselines from this tree, and `--also-ref=<ref>` adds what another branch carries. The tests are `tests/docs-public-examples.test.ts`, `tests/docs-h1-title.test.ts` and `tests/docs-platform-neutral.test.ts`. | |
| `lib/rasterize-svg-browser.ts` | none | SVG to PNG through our own render path in Chromium rather than resvg. | browser |
| `lib/pdfrender.swift` | none | Renders page one of a PDF to PNG via Quartz, the renderer every macOS app uses. An independent ground truth for the vector audit. | native |
| `audit-vector-render.ts` | none | Three-way conformance audit of the print-PDF to SVG interpreter: a screen screenshot, the same print PDF rendered by an independent engine (poppler `pdftoppm`, else macOS `sips`), and our SVG rasterised back. Splits the loss into Chromium's print pass and our interpreter. Writes a dated report under `plans/`. | browser, native, network |
| `characterize-export.ts` | none | Characterisation harness for `shells/web/src/bridge/export.ts`, the large web-shell export bridge with no direct tests. Snapshots to `plans/validation-scratch/export-characterization.json`. | DESTRUCTIVE, browser |
| `probe-tool-paint-order.ts` | none | A/B probe for `ExportOpts.stackingOrder` against real tools. Evidence, not a gate. | browser |
| `build-presentation-trial.ts` | none | Builds a portable three-slide Design `.lolly` with private notes, an embedded logo and saved presentation scenes. Optional positional output directory; defaults to `/tmp/lolly-presentation-260/m1-acceptance/kit`. Camera startup stays explicit. | DESTRUCTIVE (fixture files only) |
| `build-libopenmpt-wasm.sh` | none | Reproducibly rebuilds the vendored libopenmpt WebAssembly tracker decoder as a single self-contained ES module. Needs Emscripten. | DESTRUCTIVE, submodule, native, network |

### Vernacular gates: why CI fails on wording

Three checks fail a merge on wording alone: `check-docs-vernacular.ts` (English docs sources), `check-code-comment-vernacular.ts` (`check:code-comments`, comments in the owned TypeScript) and `check-ui-copy-vernacular.ts` (`check:ui-copy`, the strings a person reads in the app). They look like style police to a newcomer, so here is the case in full.

Much of this repo is written with AI assistance, and AI-written text has habits a reader recognises: em dashes, filler phrases ("seamless", "worth noting") and a few words nobody says out loud. Readers notice, the product's promise is output a person directed, and every doc page is machine-translated into 26 languages where those habits translate badly. The maintainer asked for them gone and kept gone (2026-08-16), and a rule that lives in a memory file only binds whoever reads it. A script binds everyone, including the assistant that keeps reintroducing them.

What the gates do: match a fixed list of characters and phrases, literally. No model judges the text. They read wording only and never run behaviour. The comment and UI-copy gates are ratchets: `scripts/vernacular-code-baseline.json` and `scripts/vernacular-ui-baseline.json` hold a per-file count that may only go down, a new file must be clean, and a reviewed improvement is recorded with `--write`. The docs gate is a hard ban, with one ratcheted rule of its own: a sentence that ends in "it" was too common in the existing pages to ban at once, so `RATCHETED_PHRASES` is counted per file against `scripts/vernacular-docs-baseline.json` (`node scripts/check-docs-vernacular.ts --write` records a fix). A heading that ends in "it" is a hard ban everywhere. Every gate prints the same short explanation (`scripts/lib/vernacular-why.ts`) when it fails. To pass, reword the flagged line in plain English; do not extend the allow list unless the use is literal (a waveform's shape, not a metaphor).

### House rules: why CI fails on CSS

`check-house-rules.ts` (`check:house-rules`) fails a merge on the shell's own stylesheets. Lolly's chrome follows a few written design rules: a rounded element gets a full border, a full wash or padding rather than a stripe on one edge; dashed means "drop here" and nothing else; motion uses the shared duration tokens and honours both the operating system's `prefers-reduced-motion` and the app's `html[data-a11y-motion="reduce"]`; and every custom property a sheet reads is defined somewhere or carries a fallback. These kept coming back after every fix because nothing enforced them, so a script holds them now.

The check is plain string work with no browser, so a heuristic can miss a case: a radius set in another sheet, or a reduce rule written against a parent selector. It under-reports rather than blocks, and `--list` shows exactly what it sees. It is a ratchet like the vernacular gates: `scripts/house-rules-baseline.json` holds a count per file and rule that may only go down, a new file or rule must be clean and a reviewed fall is recorded with `--write`, which refuses to record a rise. A real drop area and the few shapes the corner logic misreads live in `scripts/data/house-rules-allow.json`, each with a reason of more than 40 characters, matched on file, rule and selector; an entry that matches nothing fails as stale. So do the dashed exceptions Andy approved (C4, 15 October 2026): guides drawn while editing, such as snap lines, marquees, crop boxes and page guides, plus the High contrast drag source and Valid's forensic region overlay. The explanation printed on failure is `scripts/lib/house-rules-why.ts`. To pass, fix the finding; never raise a count or widen the allowlist for something that is not one of those cases.

## Audio and media ingest

All four write into `brands/lolly-start/catalog/`, which this repository owns, so they do not touch the private submodule.

| Script | npm alias | Purpose | Flags |
|---|---|---|---|
| `gen-music.ts` | none | Generates a varied set of CC0 ZzFXM tracks (ambient, rhythmic and others) for Neurospicy Mode and video music beds. | DESTRUCTIVE |
| `ingest-midi.ts` | none | Converts a Standard MIDI File into a small ZzFXM song and registers it as an `audio`/`zzfxm` catalog asset tagged `neurospicy`. | DESTRUCTIVE |
| `ingest-lofi.ts` | none | Converts a curated set of public-domain lo-fi tracks to opus and registers them under `lolly/loops/`. | DESTRUCTIVE, network |
| `ingest-audio.ts` | none | Tracker-module and general audio catalog ingest. Dry run by default. | DESTRUCTIVE |
| `build-voice-clips.ts` | `voice` | Synthesises a robot voice speaking each UI filter, treatment and theme name at build time. One-shot: run locally, commit the output. | DESTRUCTIVE, submodule |
| `build-street-clips.ts` | none | Offline road and water geometry prep for the `street-map` tool, fetched from OpenStreetMap via the public Overpass API. Writes into the tool's own `lib/` directory in its pack, `community/street-map/lib/`. | DESTRUCTIVE, submodule, network |
| `lib/zzfx-music.ts` | none | A re-export shim. The ZzFX preset bank and ZzFXM composition helpers now live in `engine/src/zzfx-compose.ts`. | |

## Profile resolution

There is no state file and no view-building script any more. `packages/node-shell/src/content-roots.ts`'s `contentRoots()` resolves the active profile named in [`../profiles.json`](../profiles.json) fresh on every call, in this order: an explicit `profile` argument, then `LOLLY_PROFILE` in the environment (trimmed - the mechanism that works on Vercel), then the `default` field in `profiles.json` if its packs are all present on disk, then the first profile in `profiles.json` whose packs are all complete. That last step is the public-clone path: `brands/suse` is `update = none`, so it is absent, the declared default is incomplete, and resolution lands on `lolly-start`.

One fail-loud exception cuts across that order: on Vercel (`$VERCEL` set) an incomplete profile is a hard failure rather than a fallback, because silently falling back there would deploy the blank brand to production. An overlay authoring error - a brand tool declaring `"extends": "community"` whose base is missing - fails the same way, rather than shipping a silent partial tool.

`toolFile()` and `catalogFile()` answer where a given path lives for the resolved profile, so most consumers never need a real `tools/`/`catalog/` tree on disk. `materializeInto()` is the one place that still writes one - a build that ships static files (`dist/`, an RPM payload, a Docker image) - and it writes a plain copy, not symlinks, since a copy is what a package manifest or a container layer can actually contain.

Retired with the old view: `scripts/use-profile.ts`, `scripts/subrepo/` (the multi-repo `loldev` toolkit - `sync.sh`, `status.sh`, `verify.sh`, `migrate.sh`, `snap-history.sh` - whose reason for existing was coordinating separate repositories), and the `.lolly-profile` sticky-choice file.

## Deployment targets

`lolly.tools` and `lolly.ing` use operator-managed UpCloud K3s releases after the
2026-10-07 cutover. Read the instance's current deployment handoff and the
[sovereign profile](../deploy/helm/profiles/sovereign/README.md) before choosing a
target. lolly.tools ships the `lolly-demo` profile (Lolly's own demo brand), and
`pnpm run gate` validates it through the committed `k3s` target; the packaged
apps keep `lolly-start`. `pnpm run ship`, including preview, production and `--no-gate`
modes, refuses that target before the gate, credential setup or upload.

For the next application release, follow Work's maintained
[application update guide](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/APP-UPDATES.md).
From a qualified `lolly-work` checkout, `python3 scripts/app-update.py --target
/protected/production-target.json --release /protected/reviewed-release.json
--plan-out /protected/app-update-plan.json` prepares an image update. Review the
plan, then use the guide's explicit apply command and reviewed plan hash. This
updates the existing application's image without provisioning infrastructure.
The public web image includes its shell, tools and catalog. A private Work image
update preserves any mounted shell or tool pack; publish those separately using
the guide's content release procedure.

For another instance, configure `scripts/data/ship-targets.json` with an explicit
`vercel` or `internal_it` driver and its own domain and project. Vercel also needs
an explicit team ID. There is no default adapter, and the old Lolly production
projects and managed domains cannot be deployed through either legacy adapter.
The Vercel configuration remains an optional adapter with automatic Git
deployments disabled. Operators adopting that adapter must deliberately arrange
their own project and deployment trigger.

## Hosted web app releases

These are maintainer runbooks for publishing the Lolly web app to the project's hosted
sites and to private Lolly Work instances. They moved here from `/info` on 2026-10-23,
because readers who install Lolly or Lolly Work do not run them. They are English only
and are not translated. Unless a step says otherwise, the commands run from a qualified
`lolly-work` checkout, and every `deploy/helm/...` path below is in that repository. The
reader-facing page for a private instance is
[Shell deployment workflow](https://lolly.tools/info/operate/shell-deployment-workflow.html).

### The hosted sites

Since 7 October 2026, `lolly.ing` and `lolly.tools`, with their `www` aliases, run on one
UpCloud host with openSUSE Leap 16.0 and K3s. Work, the render worker and the live relay
are separate Kubernetes workloads, and PostgreSQL 18.6, the public web app, the APIs and
the managed HTTPS edge run on the same host. The `lolly.work` evaluation demo runs there
too, in its own namespace, with throwaway sample data, separate keys and network
isolation from private workspaces; its automatic deployment from Work's CI is retired.

The former `lolly.ing` Compose services stay stopped and their database access is fenced.
That host is kept only for SSH access and checked HTTPS forwarding to the current host.
Do not replay its Compose, hosted-database or serverless rollback commands, restore its
database access, or point production DNS at those old targets. The reviewed deployment
handoff for each instance defines its real host, cluster, secrets, volumes and pinned
release; a generic example in the docs is not that handoff.

### Classify a change before preparing a release

`scripts/classify-application-release.ts` inspects a clean local Lolly or Lolly Work
checkout at an exact candidate commit. It reads Git objects only: it never builds,
downloads, starts a workflow or contacts production. Node 24 and Git are the only
prerequisites. Use full lowercase commit hashes and the canonical absolute checkout
folder, and the base must be an ancestor of the candidate. Dirty tracked files, untracked
files and changed submodules refuse the inspection.

```sh
node scripts/classify-application-release.ts \
  --repo /absolute/isolated/lolly-checkout \
  --base FULL_PREVIOUS_SOURCE_COMMIT \
  --candidate FULL_CANDIDATE_SOURCE_COMMIT
```

The JSON records both commits and tree hashes, every changed path and object identity, a
deterministic inventory checksum and an advisory classification:

| Classification | Meaning |
| --- | --- |
| `web-shell-only` | Only regular web source, the web entry or the service worker changed, optionally with tests and the generated web source README. Shared engine, core, schema, tool, profile, brand, catalog, dependency, deployment and service inputs are unchanged. |
| `no-change` | The committed trees are identical. This does not show whether a running deployment already matches them. |
| `full-or-paired-required` | The rule cannot establish a narrow web scope. Review the actual changes before choosing broader qualification or deciding that no application release is needed. |

Documentation-only, test-only and README-only changes do not select a web release.
Unknown or mixed paths, browser-support and release-gate changes, symlinks and submodule
pointers need manual review, and Work changes stay in the broader category because no
backend rule has been qualified. The limits are 4,096 changed paths, 1,024 bytes per path
and 2 MiB of Git output per command. Invalid UTF-8, unsafe file names and ambiguous ranges
refuse the whole inspection, and renames record both the removed and the added path.

This is a preparation aid, not permission to deploy or reuse an artifact. Every result
keeps `normalCiRequired` and `privateCompatibilityReviewRequired` true, and
`artifactReuseAuthorized` and `promotionAuthorized` false. It does not authenticate main,
CI, image provenance, signatures or the production target. Do not classify a moving main
reference or derive deployment state from local source; ignored build output is neither
read nor evidence.

For an advisory web-only result, Lolly's `deployment-suse.yml` accepts an explicit
`release_scope=web` with the exact reviewed source and its successful normal push or main
CI. The main-web preparation workflow runs its own source and web release-gate checks
before requesting a candidate. The classifier is connected to neither workflow and cannot
bypass their checks. Native and device holds stay independent. A private web app still
needs its own signing and profile inputs, a compatible engine, pack and pin review,
retention of old lazy-loaded assets, and acceptance of the owning runtime, HTTPS and
interaction.

Follow the [application update guide](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/APP-UPDATES.md)
for reviewed image plans and existing volume custody. For compatible frontend changes,
use the [private shell quickstart](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/PRIVATE-SHELL-QUICKSTART.md)
or the [public shell preparation guide](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/PUBLIC-SHELL-UPDATES.md).
These reuse accepted images and keep the existing engine and tool catalogue. Automatic
promotion of a moving main is separate work, and the classifier changes no production
credentials, infrastructure, database, DNS or release gates. Its disposable Git fixture
tests need no cluster: `node --test tests/application-release-classification.test.ts`.

### Update the web app without rebuilding its image

Start from an exact qualified source commit and the instance's current accepted release.
For a compatible web TypeScript, CSS or layout change, build the new frontend and publish
a new shell claim, keeping the accepted application image, engine, catalogue, database and
infrastructure. A single-owner `Recreate` instance has a short reconnect window when its
new owner starts, and someone using the instance sees the new interface after acceptance,
possibly after reconnecting an open tab. No cloud provisioning, Helm reinstall or database
restore is part of a normal application update.

Use this path for web application code only. Backend TypeScript, the baked Work admin
console, dependencies, engine, core and schema, tools, brand and build-policy changes need
their broader release path. The classifier above checks the exact committed changes; an
allowed file name alone does not prove compatibility. A developer supplies the immutable
source and its successful CI, and the operator supplies the accepted baseline and the
protected instance inputs. A new commit on `main` is the input to qualification, not an
automatic live release, and old claims and immutable files stay until the new release is
accepted.

| Change | Release path |
| --- | --- |
| Compatible web TypeScript, CSS or layout | The private shell commands below; on a public site, the root and validator map advance together |
| Images or documentation inside unchanged signed content | Reuse those accepted bytes; there is no need to rebuild them |
| Changed tools, catalogued assets, brand content or served documentation | Qualify a complete content release with signatures and kept addresses; reuse the runtime only when its exact compatibility is established |
| Backend TypeScript or the baked admin console | A qualified application image, through the application update guide |
| Engine, schema, native runtime or dependency changes | The matched release and its broader checks; infrastructure stays unless the release needs an infrastructure change |

#### Before the first update

An IT operator sets up the reusable inputs and records the first accepted baseline, then
keeps the protected files available to the release operator. The private lane needs an
existing dedicated shell volume. The public lane needs an accepted Nginx image; its first
update adds five read-only serving mounts and a read-only whole-volume anchor. The public
producer uses the reviewed `lolly.tools` policy, and another public instance needs its own
reviewed policy contract.

| Reusable instance input | What the operator reviews |
| --- | --- |
| Target and guard programs | Cluster and host identity, all protected components, the mandatory preflight and actual host mount checks |
| Accepted image and runtime inputs | Engine, pack and pin or public Nginx configuration, and separate model storage |
| Public verification key | The existing public-only P-256 key; no signing secret is needed for unchanged signed content |
| Helper source closure | Exact maintained scripts, imports and probe hashes; review again when helpers change |
| Private instance profile | Storage bounds, stage-name policy, runtime probes and an optional approved signed-in catalogue caller |

| Fresh release input | Where it comes from |
| --- | --- |
| Exact main commit and successful normal CI | Original source, run and job records for that immutable commit; a moving `main` name or a local success label is not enough |
| Current accepted baseline | The genuine `accepted.previous.json`, the complete accepted snapshot and manifest; advance only after acceptance |
| New build custody and evidence | Accepted settings and compatibility inputs, original producer and web-gate reports and complete manifests |
| New shell claim and attempt folders | An explicit reviewed selection and unused names; outputs are exclusive |

Use Node 24 or later, Python 3.10 or later and already installed locked dependencies in
clean isolated checkouts; the producer installs nothing. Reuse the exact accepted ignored
ORT and ORT-HF cache bytes where Vite needs them. IT supplies the reviewed custody and
evidence files: these commands do not create provider-origin proof from handwritten JSON.
Keep protected instance inputs outside the source repository.

#### Private Work instance: three commands

Replace the uppercase placeholders with reviewed full commits and SHA-256 values, and the
`/protected/` paths with your existing protected folder. The accepted snapshot includes
kept lazy chunks that already-open tabs still need.

```sh
pnpm update:shell:build \
  --source /clean/lolly --base ACCEPTED_SHELL_COMMIT --candidate NEW_MAIN_COMMIT \
  --previous-shell /protected/accepted-shell --public-key /protected/public.jwk.json \
  --custody /protected/build-custody.json --custody-sha256 REVIEWED_CUSTODY_SHA256 \
  --out /protected/build-NEW_MAIN_COMMIT

pnpm update:shell:prepare \
  --evidence /protected/shell-evidence.json \
  --reviewed-evidence-sha256 REVIEWED_EVIDENCE_SHA256 \
  --existing-public-pin-sha256 REVIEWED_CANONICAL_PUBLIC_JWK_SHA256 \
  --node /path/to/node24 --out-dir /protected/prepared-NEW_MAIN_COMMIT

pnpm update:shell run \
  --profile /protected/instance-profile.json --profile-sha256 REVIEWED_PROFILE_SHA256 \
  --prepared /protected/prepared-NEW_MAIN_COMMIT/shell.prepared.json \
  --prepared-sha256 REVIEWED_PREPARED_SHA256 \
  --operator-sha256 REVIEWED_UPDATE_OPERATOR_SHA256 \
  --out /protected/update-NEW_MAIN_COMMIT
```

Build and preparation are local; review their original reports and hashes before `run`.
`run` captures fresh resources, stages isolated content, plans, dry-runs, applies once and
observes the new owner. It streams snapshots through the current owner into new claims and
never mounts an active claim into a staging pod. A successful `run.actual.json` has status
`PRIVATE_SHELL_UPDATE_RUNTIME_ACCEPTED` and links `accepted.previous.json` and
`instance-profile.next.json`. Use that exact next profile for the next release, keeping both
profiles and their snapshots and receipts. It advances the baseline while keeping the
reviewed image, pack, pin and caller policy. Export, document-agent and signed-in reconnect
checks stay separate.

The [private quickstart](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/PRIVATE-SHELL-QUICKSTART.md)
covers the offline `check` and `plan`, naming and next-profile details; the
[private input contract](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/SHELL-UPDATES.md)
covers custody and preparation; and the
[signed-in catalogue guide](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/PRIVATE-SHELL-CATALOG-PROBES.md)
covers the reusable caller policy. Assembling the inputs stays an operator review step.

#### Public Nginx instance: the complete-root layout

A complete-root public image has a full SHA validator map with gzip and Brotli siblings,
and its root and map must come from the same complete inventory. The old five-path
producer refuses that baseline: do not remove its hold or reuse a baked map for new
JavaScript. The maintained
[complete-root preparation helpers](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/PLAN300-PUBLIC-FULL-ROOT.md)
assemble current and kept content, validate every coding and derive one guarded root-claim
patch, reusing the accepted image, configuration and models for a compatible later update.

Complete-root assembly and patch derivation are local preparation. A site's stager, native
qualifier and publisher must bind that protocol and provide real resource, memory, HTTP,
retirement and TLS acceptance before promotion; these helpers do not make the older public
facade work on a map-bearing image. The
[complete-root runtime adapter](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/PUBLIC-DELIVERY-RUNTIME.md)
provides explicit prepare, isolated stage, qualified switch and observation commands for
its declared managed K3s layout; its source controls do not replace registration and real
native acceptance on the operator's target. Only the new qualified frontend root and its
paired map advance.

`update:public-shell:build` accepts an original version 2 complete-root serving record. It
verifies that record through the maintained read-only validator and emits a version 2
`public-full-root-frontend` descriptor. The builder keeps the accepted image, public catalog,
configuration and model recipe, recompiles the frontend and compresses only changed entry
files and new chunks. Kept immutable identities and gzip and Brotli bytes stay exact; it
checks every encoded file and generates the validator map from the final inventory.
Complete-root assembly then reads this descriptor in `frontend` mode, and the legacy
five-path facade still refuses a map-bearing root.

Keep the original preparation, qualification and publication records, including any
explicitly verified continuation after an interrupted staging attempt. Reading that history
does not rerun old operators or erase failed journals, and new preparation also holds the
complete current validator source closure. Avoiding an image rebuild does not make
publication instant: whole-root and HTTP qualification take time in proportion to the kept
content.

After a successful complete-root observation, the publisher keeps `observe.accepted.json`
and writes `accepted-release.actual.json` plus `handoff.accepted.json`. Use that version 2
record as the next preparation's `acceptedRelease`, with its manifest as `previousManifest`
and fresh complete target captures. The next preparation checks again the original input
and source, dry run, atomic switch, retirement, command streams and stable serving owner
bookends; a failed or partial observation cannot produce this handoff. Existing registered
version 1 baselines stay readable. This records serving acceptance only; browser and native
target registration keep their own scope. Memory admission keeps the adapter's
current ≤ peak < configured limit and zero-OOM requirements.

Kept HTTP verification binds the complete held identity rows to a closed count, byte total
and canonical SHA-256 digest before any request. Its finite 8 GiB transfer ceiling matches
complete-root assembly and is separate from the pod's memory limit. Single bodies stay
capped at 2 GiB and stream in 64 KiB blocks. Native result capture, strict parsing and
compact HTTP receipts share a 32 MiB envelope including newlines; every response field stays
in that receipt, and an oversized result refuses qualification rather than dropping headers
or rows. Process identity, hash, cache, Range and CORS checks and command deadlines still
apply. Admission checks the historical preparer's original hash and reviewed source
membership independently of the current checkout, all resources and protected fields are
derived again under the current guards, and original receipts are kept when preparation
moves to another checkout.

#### Legacy public Nginx instance: supervised phases

These five-path commands remain for an accepted legacy image without a validator map, and
cannot stand in for complete-root publication. The public lane reuses its accepted image
and signed neutral catalogue. Its overlay holds only `_app`, `index.html`, `precache.json`,
`sw.js` and `portable/player.js`; models and the rest of the image stay unchanged. Keep
private artifacts out of this lane.

For the managed local-volume plugin, the claim source stays writable to the kubelet while
every application mount stays read-only. The first whole-volume mount allows normal SELinux
relabelling before the five serving subpaths. The selected `OnRootMismatch` policy keeps file
modes when the backing root already has GID 101, owner and group `rwx` and setgid. The
operator checks that root before each handoff, and the separate model root before
publication; a mismatch stops the update without changing permissions. These checks support
the pinned `local` plugin with `rancher.io/local-path`, not CSI or `hostPath` volumes.

```sh
pnpm update:public-shell:build \
  --source /clean/lolly --base ACCEPTED_SHELL_COMMIT --candidate NEW_MAIN_COMMIT \
  --previous-shell /protected/accepted-public-static --public-key /protected/public.jwk.json \
  --custody /protected/public-custody.json --custody-sha256 REVIEWED_CUSTODY_SHA256 \
  --out /protected/public-build-NEW_MAIN_COMMIT

pnpm update:public-shell:prepare \
  --evidence /protected/public-evidence.json \
  --reviewed-evidence-sha256 REVIEWED_EVIDENCE_SHA256 \
  --node /path/to/node24 --out-dir /protected/public-prepared-NEW_MAIN_COMMIT

python3 -B scripts/stage-public-shell.py check \
  --inputs /protected/public-stage.json --sha256 REVIEWED_STAGE_INPUT_SHA256 \
  --operator-sha256 REVIEWED_STAGER_SOURCE_SHA256
python3 -B scripts/stage-public-shell.py run \
  --inputs /protected/public-stage.json --sha256 REVIEWED_STAGE_INPUT_SHA256 \
  --operator-sha256 REVIEWED_STAGER_SOURCE_SHA256
```

IT assembles the stage input from the original preparation and fresh complete captures.
After a successful isolated qualification and exact writer and qualifier retirement,
assemble and review the publication input from those actual receipts. Run each command
separately, and inspect the previous result before going on:

```sh
python3 -B scripts/publish-public-shell.py check \
  --inputs /protected/publication.json --sha256 REVIEWED_PUBLICATION_INPUT_SHA256 \
  --operator-sha256 REVIEWED_PUBLISHER_SOURCE_SHA256
python3 -B scripts/publish-public-shell.py dryrun \
  --inputs /protected/publication.json --sha256 REVIEWED_PUBLICATION_INPUT_SHA256 \
  --operator-sha256 REVIEWED_PUBLISHER_SOURCE_SHA256
python3 -B scripts/publish-public-shell.py apply \
  --inputs /protected/publication.json --sha256 REVIEWED_PUBLICATION_INPUT_SHA256 \
  --operator-sha256 REVIEWED_PUBLISHER_SOURCE_SHA256
python3 -B scripts/publish-public-shell.py observe \
  --inputs /protected/publication.json --sha256 REVIEWED_PUBLICATION_INPUT_SHA256 \
  --operator-sha256 REVIEWED_PUBLISHER_SOURCE_SHA256
```

There is no public one-command facade. `observe` writes
`observe.acceptance.original.json` with `PUBLIC_SHELL_RUNTIME_AND_HTTPS_ACCEPTED` and a
genuine `accepted.previous.json` for the next preparation. Keep the original image
expectation, the new effective-static and overlay manifests and the original receipts;
browser, presentation and native checks keep their own scope. The
[public preparation guide](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/PUBLIC-SHELL-UPDATES.md)
defines custody and baseline fields, and the
[public promotion guide](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/PUBLIC-SHELL-PROMOTION.md)
defines the stage and publication inputs, exact guards and phases.

#### Results, timing and refusals

Full file hashes, sizes, modes, the signed catalogue and storage and owner identity stay
mandatory. Public snapshots are single-member gzip tar streams: the CRC, trailer, complete
file inventory and tar end blocks must pass before extraction, and a zero exit code alone
does not prove complete transport.

Read measured phase receipts rather than treating Vite time as deployment time. The private
facade records `elapsedSecondsByPhase`; neither lane promises a fixed end-to-end duration or
follows main unattended. A local build, offline plan or synthetic fixture is not live
acceptance, and normal CI and the explicit web release gate stay required, with native and
device holds separate.

Serialise updates that share a target. Every change needs its mandatory site preflight last,
plus fresh exact resource guards. If a phase refuses, keep the exclusive attempt folder and
`*.uncertain.json` with its original responses, and inspect the current state read-only: do
not repeat apply, replay an intent or relabel a failure as success. A forward fix or rollback
needs a new reviewed intent against the current state. Keep old qualified claims until
acceptance, and keep current user data.

The maintained full-root stage and publisher write `<phase>.timing.actual.json` with
monotonic elapsed seconds, including their guard work. Model HTTPS checks also write
`models-http.timing.actual.json` during qualification and
`owning-models-tls.timing.actual.json` during observation. They record requests started,
responses completed and response-body bytes actually read, including partial reads on
failure; bytes exclude headers and TLS framing and are not network-interface measurements.
Model time is part of its enclosing phase time, so do not add them, and constructor and
local preparation time are not covered. These diagnostic files grant no acceptance: keep the
accepted or uncertain receipt and the original command evidence beside them. An interrupted
process may leave no timing file.

Avoiding an image build does not make a full public release immediate. The full-root
qualifier still checks the complete static root, the models, native HTTP behaviour and
normal-TLS responses before publication. At each of its three model checkpoints it uses one
complete physical scan for both the owner assertion and the inode and hash comparison, which
removes three duplicate scans without reusing an older checkpoint or skipping a byte check on
either side of HTTP; the accepted receipt format is unchanged. One 177-model qualification
read 5.39 GB of models and transferred 10.78 GB over TLS through ordinary and mismatching
If-Range requests; its TLS part took about 13 minutes and the full qualification about 28.
Those are measurements from that run, not a promised duration or a measured result of the
scan reduction. The accepted-checkpoint option and operation measurements below address the
work tracked in [issue 115](https://github.com/lolly-tools/lolly-work/issues/115).

Reuse of model proofs stays within the exact same verified owner and process checkpoint. A
replaced owner or process needs full qualification even when image and storage identities
match, and a `Recreate` rollout always changes the owner, so a proof from the old serving
owner cannot qualify the new one.

#### Completing a failed observation under the same owner

The maintained frontend publisher writes `observe.checkpoint.actual.json` only after its full
model TLS checks, complete physical checks on both sides of HTTP and the final owner and
native-process bookend succeed. This checkpoint is explicitly **not release acceptance**. If a
later diagnostic fails, keep the original `observe.uncertain.json` and every command and raw
stream.

`continue-public-observation.py` supports only `check` and `observe`. A reviewed input binds
the original publication proof (with its checkpoint as the observation receipt), the original
started and uncertain markers, the complete sorted list of original command references and a
new exclusive output folder. The continuation operator must already belong to the original
reviewed source registry. Pass the exact input and operator hashes with
`--reviewed-input-sha256` and `--reviewed-operator-sha256`; there is no publication or
rollback action.

A continuation must start and finish within 15 minutes of the checkpoint. It needs the same
Deployment, ReplicaSet, pod, container, native PID and start ticks, boot, namespace,
executable and root identity, with unchanged reviewed configuration and storage. It runs
fresh complete physical model and static hashes, health, native HTTP, memory and fixed-entry
TLS checks, and every model gets fresh cache, CORS, conditional request and range checks whose
range hashes must match the original full verification. Only the two complete-body transfers
for model files larger than 64 KiB are reused, labelled `REUSED` with their original values
and receipt rather than described as new downloads; smaller files still get both
complete-body requests.

Expiry, an owner or process replacement, changed bytes, configuration or storage, missing
original commands, altered validators, a failed fresh check, or an attempt already accepted
or rolled back all refuse the continuation. A failed continuation keeps its own uncertain
journal and never erases or retries the original attempt, and normal publication acceptance
validates both journals and the exact proof links. This recovery path keeps full physical
scans and applies only to its original owner; no production speedup is claimed for this
path.

### Model proof reuse and release measurements

A frontend stage can opt into a prior successful model checkpoint by adding a `modelReuse`
held file reference to its reviewed runtime input. Without that field, staging still
downloads every model body. The referenced request has exactly these fields:

```json
{
  "version": 1,
  "status": "REVIEWED_ACCEPTED_MODEL_CHECKPOINT_REUSE_NOT_EXECUTED",
  "acceptedRelease": { "path": "/absolute/accepted-release.actual.json", "sha256": "<exact sha256>" },
  "checkpointProof": { "version": 1, "input": {}, "operator": {}, "phases": {} }
}
```

`checkpointProof` is the original accepted publication proof, with its observe accepted
reference pointing at its genuine `observe.checkpoint.actual.json`. The helper derives the
accepted publication and checkpoint again, including the original source, commands, owner,
configuration and full-body HTTP proof. The empty objects above are placeholders, not
runnable inputs.

The checkpoint must be no more than **24 hours old at both qualification bookends**. Its exact
Deployment, ReplicaSet, pod, container, native PID and start time, boot, namespaces,
executable and root must still be selected, and the model recipe, image, configuration bytes,
origin, claim and volume identities and backing specs must match. Historical records without
the native-process checkpoint cannot opt in. An invalid or expired explicit opt-in refuses;
choosing full qualification needs a separately reviewed input without the option.

Staging still runs all three complete physical model hash and inode scans, full static
qualification, native HTTP and fresh global resource checks, and every model gets fresh
normal-TLS cache, CORS, conditional and range checks. Only the two full-body responses for
models larger than 64 KiB may be reused; smaller models still transfer both bodies. The model
receipt links `reuse` to the prior full-body proof and the new process, physical and HTTP
bookends, never describes prior bytes as a current download, and staging mounts no active
model volume. Publication after `Recreate` always runs the full model-body checks on the new
owning process, and its newly accepted checkpoint can seed the next stage. The separate
failed-observation continuation uses its 15-minute window and does not allow new owners or
replace successful-stage admission.

`measure-public-release.py run` wraps one explicitly reviewed Python or Node command and runs
no later phase automatically; the wrapped adapter keeps its own source checks, preflights,
approvals and original receipts. A reviewed input contains `version: 1`,
`status: REVIEWED_SINGLE_PUBLIC_RELEASE_OPERATION`, one `releaseId`, an `activity` of
`preparation`, `staging`, `publication` or `verification`, held `program` and `entrypoint`
files, `interpreterArguments`, literal `arguments`, held `inputFiles`, an exact `cwd`, a new
`outputDirectory`, `timeoutSeconds` and the expected new `httpTimingPaths`. Pass its checksum
and the wrapper's:

```sh
python3 -B scripts/measure-public-release.py run \
  --input /absolute/operation-input.json \
  --reviewed-input-sha256 <sha256> \
  --reviewed-operator-sha256 <sha256>
```

Each journal keeps the original process exit, standard output and error and the monotonic
interval, including the wrapped constructor and local preparation. A failed command or a
corrupt or missing expected sidecar stays recorded, and telemetry cannot turn a command
failure into success. The wrapper never retries, and a command that succeeds while telemetry
fails keeps its real zero exit code apart from the refused timing result.

For an end-to-end record, wrap preparation, each staging command and each publication command
with the same release ID, then pass an array of their held `operation.actual.json` references
to the `summarize` action, with `--output` naming a new file. A summary needs one host boot and
intervals that do not overlap. It reports activity totals, the elapsed time from the first
command to the last and unmeasured gaps separately. Nested model HTTP seconds are not added to
operation seconds. HTTP bytes count response bodies actually read, including partial failure
reads, and exclude headers and TLS framing. Wrapper setup before the first command and after
the last is outside the measured span.

**Local measurements.** `tests/public_model_reuse_measurement_fixture.py --out-dir <newdir>`
uses a real loopback HTTP server with four synthetic models (empty, 64 KiB, 64 KiB plus 1 byte
and 8 MiB). It compares complete verification, same-process reuse and an unconditional
full-publication transfer control; it does not establish production owner custody or measure
TLS or network performance. On the 2026-10-13 run, the 8,519,681-byte inventory transferred
17,039,653 response-body bytes in the full pass, 131,363 in the reuse pass and 17,039,653 again
in the control, with HTTP parts of about 0.108 s, 0.084 s and 0.108 s and the whole wrapped
fixture about 0.986 s.

`python3 -B tests/public_release_end_to_end_fixture.py run --out-dir /absolute/new-local-benchmark`
runs a complete local qualification through the maintained operation timer. It creates real
files and serves them over loopback HTTP from a child process; prepares the inventory and
frontend; runs an initial full model check; copies and hashes the staged frontend; scans the
model bytes three times while checking the same serving process again; then publishes a local
copy and starts a distinct serving process, which always gets full-body checks. It does not run
or simulate Kubernetes acceptance phases, and its result sets `clusterCustodyQualified`,
`tlsMeasured` and `productionCalls` to false. On 2026-10-13, on macOS 27.0.1 arm64 with Python
3.14.6, with four models totalling 8,519,681 bytes and 524,364 frontend bytes:

| Operation | Command time | HTTP body bytes | Physical model scans |
| --- | ---: | ---: | ---: |
| Preparation | 0.146 s | 0 | 1 |
| Initial full model verification | 0.235 s | 17,039,653 | 2 |
| Same-owner staging and protocol recheck | 0.191 s | 131,363 | 3 |
| Publication with a new serving process | 0.310 s | 17,039,653 | 2 |

The four commands took 0.882 s of active time and 0.991 s from first start to final exit,
including 0.109 s between commands for local server start-up, shutdown and receipt handling;
HTTP checks account for 0.242 s within the command times. Outputs are local test artifacts
and must not be committed as release acceptance. These short loopback times are not
production release estimates: production adds TLS, network and storage throughput, full
signed catalog and static verification, Kubernetes allocation and guards, source custody,
native container ownership and `Recreate` readiness. The 177-model baseline above remains the
production expectation. Do not scale the loopback time into a production estimate or describe
a release as instant.

### Shell update benchmarks

The private shell deployment avoids rebuilding accepted artifacts and replaying successful
stages, and guard batching cuts network round trips while keeping each fresh response. A
previous deployment spent about 369 seconds preparing the local shell although Vite took about
11 seconds, with copying and repeated content hashes costing several more minutes; the journal
now records preparation durations alongside each operator's per-command timings.

Local delta validation indexes candidate paths once before checking every protected resource,
instead of scanning the whole candidate for each accepted file, with the same exact path, size
and content-hash comparisons. To compare the former scan and the indexed lookup on saved
manifests (read-only; three samples per implementation, with a check that their complete
deltas match; in-memory comparison only):

```sh
node scripts/benchmark-shell-update-delta.ts \
  "$PRIVATE_RELEASE/previous-shell.manifest.json" \
  "$PRIVATE_RELEASE/candidate-shell.manifest.json"
```

Fresh file hashes use a zeroed read buffer capped to the file size and 1 MiB; empty files keep
a one-byte buffer so the end-of-file read still detects growth. Every descriptor, path, stamp
and folder check stays, and each inventory still reads and hashes every byte. To measure one
fresh inventory of a saved tree, checking the resulting manifest bytes and reporting its shell
ID (an optional third argument selects a saved `shell-update-files.ts` helper for before and
after runs; alternate the order on the same immutable tree and keep all samples, since caches
and host load affect results):

```sh
node scripts/benchmark-shell-manifest.ts \
  "$PRIVATE_RELEASE/prepared-shell" \
  "$PRIVATE_RELEASE/prepared-shell.manifest.json"
```

### Public documentation routes and moving the public host

The public Lolly web app, like a Work instance that serves a signed web app, must serve its
public documentation before the app fallback: `/info/`, literal `/info/` articles, `/docs`
aliases, `/robots.txt` and the sitemap. The public hosted web app does not offer the
extensionless article addresses that native Work does. A static host needs equivalent aliases
and discovery routing; a generic single-page fallback alone does not meet the contract. Before
accepting a release, run the checks in the reader page
[Run Lolly Work on UpCloud or Evroc](https://lolly.tools/info/operate/cloud-deployment.html)
against the candidate address.

Serving static files on a VM does not reproduce every hosted function. Before moving the
public domain, list the CA, public MCP, image fetch and Penpot RPC proxy, and keep their
existing authentication, token custody, origin checks, request limits, SSRF protection and
rate-limit behaviour. The Work document-agent connector must still require the member's scoped
grant even when the public catalog MCP allows anonymous reads. Lolly has standalone CA and MCP
server entry points; the Penpot proxy still uses a hosted-function entry point and needs an
explicit standalone mount, and full route parity with the public hosted web app, Penpot
included, is not yet qualified. The existing VM router can proxy these APIs while the public
host is qualified. Replace that dependency only after signed catalog, discovery, MCP, CA,
Penpot, image-fetch, models, WebSocket and mobile first-load checks pass at the candidate
address, and keep OAuth callback addresses and trusted signing keys across the move.
