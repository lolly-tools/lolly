# Vendored upstreams

Code and data that Lolly copies into this repository, rather than installing
with pnpm or Cargo, and how each one is updated. Versions and commits are kept
in the record listed for each row, not on this page, so an update changes the
record and leaves this page alone.

Three sets of generated files describe all of them:

- `THIRD-PARTY-NOTICES.md` and `shells/web/public/THIRD-PARTY-LICENSES.txt`,
  from `scripts/build-licenses.ts` (`pnpm run build:licenses`).
- `sbom.cdx.json`, from `scripts/build-sbom.ts` (`pnpm run build:sbom`). The
  generator reads `security/vendor-artifacts.json`, which pins single vendored
  files by SHA-256 and stops when their bytes change, and its own
  `VENDORED_LIBS` list for the tool bundles.
- `security/cargo-licenses.json`, from `pnpm run build:cargo-licenses`, which
  needs Cargo. `pnpm run check:cargo-licenses` checks coverage without Cargo.

After any update below, regenerate the files the change touches and commit them
in the same change. CI fails when they drift.

## WASM kernels

Each kernel in `packages/node-shell/wasm/<name>/` builds from its own
`Cargo.lock` with the Rust version in its `rust-toolchain.toml`.
`node scripts/build-<name>.ts` rebuilds the `.wasm` and its `LICENSES.txt`.
Dependabot proposes crates.io updates for the kernels listed in
`.github/dependabot.yml`. Take a crate bump together with a rebuild, never on
its own.

| Kernel | Upstream | Record |
|---|---|---|
| `adobe-psd` | storytold PhotoCraft, `crates/psd` | `vendor/photocraft-psd/UPSTREAM.md` |
| `camera-raw` | storytold PhotoCraft, `crates/raw` | `vendor/photocraft-raw/UPSTREAM.md` |
| `affinity` | storytold VectorCraft, `crates/affinity` | `vendor/vectorcraft-affinity/UPSTREAM.md` |
| `image-trace` | storytold VectorCraft, `crates/trace` and `crates/geom` | `vendor/*/UPSTREAM.md` |
| `dxf` | storytold CADCraft, `crates/dxf` | `vendor/cadcraft-dxf/UPSTREAM.md` |
| `audio-dsp` | storytold FilmCraft, `crates/audio-dsp` | `vendor/filmcraft-audio-dsp/UPSTREAM.md` |
| `xlsx-numfmt`, `gridcraft-calc` | storytold GridCraft crates | `vendor/*/UPSTREAM.md` |
| `inpaint` | storytold LightCraft, `crates/inpaint` | `vendor/lightcraft-inpaint/UPSTREAM.md` |
| `pdf-a11y` | storytold PdfCraft crates | `vendor/UPSTREAM.md` and `vendor/*/UPSTREAM.md` |
| `indd` | storytold `indd-utils` | `vendor/indd-utils/UPSTREAM.md` |
| `skera` | the `skera` crate from crates.io, unmodified | `Cargo.lock` and `README.md` |
| `layout-kernel` | Penpot `render-wasm` layout routines | `upstream.json`; rebuild with `pnpm run build:layout-kernel` |
| `jxl` | libjxl with Brotli, Highway and skcms, compiled with Emscripten | `README.md` and `security/vendor-artifacts.json`; rebuild with `bash scripts/build-jxl-wasm.sh` |

`geometry-kernel`, `pixel-kernel` and `portable-math` are Lolly's own code and
have no upstream.

## Shells and the root `vendor/` directory

| Upstream | In the tree | Record | How to update |
|---|---|---|---|
| libopenmpt | `shells/web/src/vendor/libopenmpt/` | its `README.md`; `security/vendor-artifacts.json` | `bash scripts/build-libopenmpt-wasm.sh` with the new source tarball and its hash |
| Signalsmith Stretch | `shells/web/src/vendor/signalsmith-stretch/` | its `README.md`; hash in `tests/audio-stretch.test.ts` | copy the npm build and reapply the patch the README describes |
| GTCRN, from `@sapphi-red/web-noise-suppressor` | `shells/web/src/vendor/gtcrn/` | its `README.md`; hash in `tests/audio-clean.test.ts` | the steps in the README |
| Jelly UI | `shells/web/src/vendor/jelly/` | its `README.md`; `security/vendor-artifacts.json` | rebuild from a chosen upstream commit and keep the local performance patch |
| Detent physics | `shells/web/src/lib/detent-physics.ts` | the file header; `security/vendor-artifacts.json` | by hand, keeping the local changes listed in the header |
| Penpot layout sidebar | `shells/web/src/views/design-layout-section.penpot/` | `upstream.json` and `PROVENANCE.md` | by hand, as `PROVENANCE.md` describes |
| Penpot canvas interactions | `shells/web/src/views/design-canvas-ux.penpot/` | `upstream.json` and `PROVENANCE.md` | by hand, as `PROVENANCE.md` describes |
| glib, patched for the Tauri shells | `vendor/glib/` | `vendor/glib/PATCHES.md`; `sourceTrees` in `security/vendor-artifacts.json` | by hand; remove the override when the shells' GTK crates accept a corrected glib release, as `PATCHES.md` says |
| application release classifier, from lolly-work | `vendor/application-release-classifier/` | `scripts/data/application-release-classifier-source.json` | copy the files again and update the commit and blob hashes |
| Flathub shared-modules | `shells/tauri-desktop/flatpak/shared-modules/` | its notice | by hand |

## Libraries inside tools

| Upstream | In the tree | Record | How to update |
|---|---|---|---|
| three.js | `community/3d/lib/`, `community/flythrough/lib/` | the bundle banner | `pnpm run build:three`, from the root `three` devDependency |
| three.js | `community/chart/lib/three-chart.min.js` | the bundle banner | `pnpm run build:chart-three` |
| three.js, D3 Geo, D3 Array | `community/timezone/lib/renderer.min.js` and `hooks.js` | `community/timezone/THIRD_PARTY.md` | `pnpm run build:timezone`; `node scripts/build-timezone.ts --check` reports drift |
| Observable Plot | `community/chart/lib/observable-plot.min.js` | the bundle banner | `pnpm run build:chart-plot` copies the devDependency's UMD build; it stops when Plot declares a D3 other than the vendored one |
| D3 | `community/{chart,meeting-planner,street-map}/lib/d3.min.js` | the bundle banner | copy the official `d3.min.js` into all three tools |
| topojson-client | `community/meeting-planner/lib/topojson.min.js` | the bundle banner | by hand |
| Paper Shaders | `community/backdrop/lib/` | the bundle banner; `security/vendor-artifacts.json` | no build script is kept; the notice records what is known |
| React, ReactDOM, Babel standalone | `community/sandbox/lib/` | `security/vendor-artifacts.json` | copy the unchanged npm files and update their hashes |
| bwip-js with BWIPP, qrcode-svg | inlined in `community/qr-code/hooks.js` | the comment above the bundle | the rebuild steps in that comment |
| webgl-noise | inlined in `community/gradient/template.html` | its notice | by hand |
| rondocode | `packages/rondo/upstream/`, patches in `packages/rondo/patches/` | `packages/rondo/UPSTREAM.md` | `node scripts/vendor-rondocode.ts --commit=<sha>`, then the steps in its header |
| Compositor algorithms | ported into `community/filter/hooks.js`, `engine/src/heal.ts` and `engine/src/guided-matte.ts` | its notice | a port by hand |
| Composa edge tracer | ported into `engine/src/edge-trace.ts` | its notice | a port by hand |
| FilmSim LUTs | `community/darkroom/assets/luts/` | `NOTICE.md` and `_build-cube.mjs` there | `_build-cube.mjs` |

## Data, fonts and icons

| Upstream | In the tree | Record | How to update |
|---|---|---|---|
| Unicode text properties, ICU Thai dictionary, TeX hyphenation patterns | `engine/src/text-*.json`, `engine/src/text-hyphen-data/` | sources under `scripts/data/` | `node scripts/build-text-unicode.ts`, `build-text-thai.ts` and `build-text-hyphenation.ts` |
| Unicode emoji data | `engine/src/emoji-data/` | `engine/emoji.md` | `node scripts/build-emoji-data.ts` and `build-emoji-text-data.ts` |
| Emoji packs | `community/emoji-packs/` | `engine/emoji.md` and each pack manifest | `node scripts/import-emoji-pack.ts` |
| Noto fallback fonts | `community/fallback-fonts/` | `scripts/data/fallback-fonts.json` | `node scripts/import-fallback-fonts.ts` |
| Noto Color Emoji font | `shells/web/public/fonts/` | its notice | by hand |
| SUSE, SUSE Mono and Outfit fonts | `shells/web/public/fonts/`, `brands/lolly-demo/catalog/fonts/` | the OFL files beside them; the notices | by hand |
| Lucide icon paths | tool `icon.svg` files, `shells/web/src/lib/icons.ts`, the Etiquette icons | its notice; no Lucide version was recorded | copy path data by hand; `scripts/build-etiquette-icons.ts` redraws the Etiquette set |
| Coated FOGRA39 press profile | `packages/node-shell/icc/` | `README.md` there; `security/vendor-artifacts.json` | by hand, from storytold/craft-libs |
| C2PA trust anchors | `engine/src/c2pa-trust.ts` | the file header | paste the PEM blocks from the published lists |
| Timezone boundaries, places and cities | `community/timezone/data/` | `community/timezone/THIRD_PARTY.md` and `data/sources.json` | `node scripts/vendor-timezone-data.ts` |
| world-atlas countries | `community/meeting-planner/lib/`, `community/timezone/data/` | its notice | by hand, or with the timezone data |
| OpenStreetMap street clips | `community/street-map/lib/roads/` | its notice | `node scripts/build-street-clips.ts`, which queries the Overpass API |

On-device model weights are not in the repository. Their pins are in
`packages/node-shell/src/ml/model-pins.ts` and the `scripts/fetch-*-models.ts`
scripts; `pnpm run models:vendor` fetches them.
