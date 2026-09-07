# Code map: `shells/web/src`

This file exists so you can find the code for a feature without reading all of it. For what the shell *is*, how the bridge is composed and how to run it, see [`../README.md`](../README.md).

The counts below are GENERATED - `npm run build:web-src-readme`, checked in CI by `npm run check:web-src-readme`, so they cannot rot the way the hand-measured ones did. They convey proportion; don't cite them as an API.

<!-- web-src-dirs:start -->
Roughly 503,000 lines of TypeScript, tests included, and 45,000 lines of CSS.

| Directory | Source | Tests | CSS |
|---|---|---|---|
| `views/` | 134 files, 135,158 lines | 124 files, 50,196 lines | none |
| `lib/` | 424 files, 106,964 lines | 271 files, 56,516 lines | 8 files, 1,100 lines |
| `bridge/` | 100 files, 42,289 lines | 78 files, 19,344 lines | none |
| `components/` | 45 files, 20,450 lines | 28 files, 9,305 lines | 2 files, 221 lines |
| `collab/` | 18 files, 12,959 lines | 20 files, 13,683 lines | none |
| `pro/` | 20 files, 7,906 lines | 10 files, 1,666 lines | 2 files, 1,210 lines |
| `org/` | 17 files, 5,811 lines | 13 files, 3,828 lines | none |
| `catalog/` | 2 files, 836 lines | 1 file, 86 lines | none |
| `ext/` | 2 files, 136 lines | 1 file, 86 lines | none |
| `styles/` | none | 4 files, 837 lines | 81 files, 42,366 lines |

Plus 43 `.ts`/`.js` files at the top level of `src/`, 14,802 lines all told, of which 18 are tests and 3 are ambient declarations. `main.ts` is 2,028 of that.
<!-- web-src-dirs:end -->

## How do I find a feature

Start from the route, not from a grep.

1. Open `main.ts` and find the `switch (route.name)` (around line 227). Every route resolves to exactly one `await import('./views/<x>.ts')`, and the table in [`../README.md`](../README.md#routing) lists all of them. The gallery is the default case and the only statically imported view.
2. Open that view module. A view owns its own markup, its own event wiring and its own stylesheet import. `views/tool.ts` is the one that mounts an actual tool: it builds the runtime through `lib/mount-runtime.ts`, renders the sidebar via `views/tool-inputs.ts` and the export controls via `views/tool-actions.ts`.
3. If the behaviour is not in the view, it is in a helper the view imports from `lib/` or a widget it imports from `components/`. Follow the import rather than guessing at a filename.

If the feature is about producing bytes rather than showing a screen, skip the views entirely and go to `bridge/`.

## What lives where

**`views/`**: one module per screen, each lazily imported by the `main.ts` switch, plus the sub-modules those screens split into. The routed entry points are `tool.ts`, `gallery.ts`, `catalog.ts`, `projects.ts`, `profile.ts`, `dashboard.ts`, `valid.ts` (the `/verify` Content Credentials check), `multi-edit.ts`, `start.ts` (the brand studio), `color-lab.ts`, `pdf-extract.ts` and `components.ts` (the browsable component library). Everything else in here is a piece of one of those: `tool-inputs.ts`, `tool-actions.ts`, `tool-stage-nav.ts` and `tool-types.ts` belong to the tool view; `free-canvas*.ts`, `timeline-panel.ts`, `deck-editor.ts`, `doc-editor.ts` and `rich-text.ts` are editor surfaces; `pdf-import.ts`, `pptx-import.ts`, `idml-import.ts` and `design-import.ts` are ingest paths; `picker.ts` is the asset picker that `host.assets.pick` lazily loads.

**`bridge/`**: the web implementation of `HostV1`, one file per capability, composed by `index.ts`. Everything to do with turning a rendered DOM node into a file is here: `export.ts` and its satellites (`export-pdf-vector.ts`, `export-pdfx.ts`, `export-css.ts`, `export-image-meta.ts`, `export-pptx.ts`), `svg-ir.ts`, `text.ts` and `text-svg.ts` (HarfBuzz text-to-path), `font-registry.ts`, the `sequence-*.ts` and `video-encode*.ts` family for motion export, plus `state.ts`, `assets.ts`, `pdf.ts`, `pptx.ts`, `capture.ts`, `recorder.ts`, `media.ts`, `images.ts`, `audio.ts` and `viz.ts`. Six of them are now re-export shims over `packages/node-shell/src/` (`pdf.ts`, `pdf-structure.ts`, `pptx.ts`, `net.ts`, `svg-ir.ts`, `text-svg.ts`) - the terminal shells run the same code, and plans/202 WP1.1 moved the implementations into the package so `shells/cli` no longer imports across the submodule boundary. Treat their public exports as a contract with other shells and edit the node-shell file, not the shim. Four more are replaced wholesale at build time by the Tauri desktop shell (`state.ts`, `capture.ts`, `export.ts`, `capabilities-provided.ts`; the mobile shell overrides the same set minus `capture.ts`), which puts their public exports under the same rule.

**`lib/`**: 144 modules of shared helpers, and the part of the tree that is honestly **grep-first**. There is no hierarchy and no index; names are descriptive and that is the whole navigation story. Clusters worth knowing exist rather than discovering by accident: brand (`brand-editor.ts`, `brand-doc.ts`, `brand-logos.ts`, `brand-seal.ts`, `brand-studio-tabs.ts`), fonts (`font-utils.ts`, `google-fonts.ts`, `load-user-fonts.ts`, `register-user-fonts.ts`), audio and atmosphere (`audio-*.ts`, `ambience-*.ts`, `atmosphere.ts`, `butterchurn-viz.ts`), colour (`color-formats.ts`, `color-namer.ts`, `color-profiles.ts`, `display-gamut.ts`, `gamut-slider.ts`), policy and gating (`export-policy.ts`, `field-policy.ts`, `input-policy.ts`, `c2pa-policy.ts`), and the mount chokepoint `mount-runtime.ts`. When you want a helper, grep `lib/` for the noun before you write a new file.

**`components/`**: 28 reusable UI primitives and widgets with no route of their own: `modal.ts`, `confirm-dialog.ts`, `share-dialog.ts`, `body-popover.ts`, `custom-slider.ts`, `color-field.ts`, `back-pill.ts`, `footer-nav.ts`, `view-topbar.ts`, `profile-menu.ts`, `theme-toggle.ts`, `lang-menu.ts`, `fonts-manager.ts`, `profiles-manager.ts`, `headshot-cropper.ts`, `viz-overlay.ts` and friends. `views/components.ts` renders a browsable gallery of these at `#/components`.

**`styles/`**: plain CSS, no preprocessor. `app.css` is the render-blocking landing and chrome sheet, and it declares the cascade-layer order for the entire application in one line. `tokens.css` and `fonts.css` stay unlayered on purpose. `parts/` holds 42 per-area sheets, most of them imported by the lazy view module that needs them so Vite emits them as async CSS chunks. `hidden-attribute-guard.test.ts` sits in here and guards one specific regression.

**`pro/`**: the `/pro` batch mode, an isolated feature. It imports only the engine, the host and its own siblings, which is why `main.ts` injects `openFolderOverlay` and the metrics callback rather than letting `pro/` import them. Deleting `src/pro/` plus its `case` and route branch is a supported removal.

**`org/`**: the single seam through which an *optional* deployment control plane talks to this shell. On a plain deployment such as the public lolly.tools, `initOrg()` probes once, finds nothing, resolves to `null` and remembers that, and the shell behaves as though the module were absent: no gate, no banner, an empty field-policy registry.

**`catalog/`**: just two files. `sync.ts` fetches and diffs the tool and asset manifests against IndexedDB on boot, tolerates network failure by falling back to cache, and routes every fetch through `lib/instance.ts` so a remote instance syncs the same way. `integrity.ts` is the web wiring for the engine's signed-catalogue check, inert unless the build pins `VITE_CATALOG_PUBLIC_KEY_JWK`, and fail-closed when it does.

## The big files

Do not be ambushed by these. The largest source files, by line count:

<!-- web-src-largest:start -->
| Lines | File | Direct test coverage |
|---|---|---|
| 17,112 | `views/free-canvas.ts` | yes, nine `free-canvas-*.test.ts` files |
| 11,281 | `bridge/export.ts` | yes, but mostly gated. `export-audio-bed.test.ts` imports `bedStartOffset` and `connectMusic` directly and always runs; the SVG and PDF emission is covered by ten `chromiumOrSkip()` suites (`export-m3`, `export-paint-order`, `export-stroke-paint`, `export-shadow-fidelity`, `export-pdf-shadow-fidelity`, `export-emf-eps-shadow`, `export-atomic-inline`, `export-backdrop-blur`, `export-form-controls`, `export-text-emission`) that esbuild-bundle the real `renderSvgFromHtml` and drive it in Chromium, and which **self-skip** when no Chromium is installed. `export-text-emission` is the newest and covers the `<path>`-vs-`<text>` decision layer specifically; unlike the SUSE-gated golden suite it is brand-independent, so it runs on `lolly-start` too. |
| 10,838 | `views/timeline-panel.ts` | yes |
| 7,142 | `views/tool.ts` | partial - the undo/redo model (coalescing, the byte-carrying filter, the cap, the redo chain) is extracted to `tool-history.ts` and covered by `tool-history.test.ts`; the rest of `mountTool` is not. |
| 7,112 | `views/catalog.ts` | partial - the selection model (visibility, filetype filter, search, favourites dedupe, selectable ids, prune) is extracted to `catalog-filter.ts` and covered by `catalog-filter.test.ts`; the 3,000-line `mountCatalog` body around it is not. |
| 6,325 | `lib/brand-editor.ts` | none |
| 5,509 | `views/tool-actions.ts` | yes |
| 4,243 | `views/picker.ts` | partial - the format and embeddability rules are extracted to `picker-formats.ts` and covered by `picker-formats.test.ts`, plus `picker-initial-tab.test.ts`; the 3,000-line panel body is not. |
| 4,145 | `views/valid.ts` | `valid-verdict.test.ts` only |
| 4,043 | `views/tool-inputs.ts` | none |
| 3,680 | `views/start.ts` | yes |
| 3,659 | `views/color-lab.ts` | yes |
| 3,362 | `views/profile.ts` | none |
| 3,286 | `views/projects.ts` | none |
| 3,285 | `views/gallery.ts` | none |
| 3,146 | `bridge/sequence-render.ts` | yes |
| 2,675 | `views/deck-editor.ts` | yes |
| 2,502 | `views/design-import.ts` | **none** |
| 2,363 | `views/free-canvas-math.ts` | yes |
| 2,276 | `views/timeline-math.ts` | yes |
<!-- web-src-largest:end -->

The pattern is consistent and worth internalising: the **pure helpers** extracted out of a big view are well covered (`free-canvas-math.ts`, `timeline-math.ts`, `valid-verdict.ts`, `export-css.ts`, `text-svg.ts`, `svg-ir.ts`, `catalog-filter.ts`, `tool-history.ts`, `picker-formats.ts`), while the DOM-mounting bodies of the big views mostly are not. When you change one of the uncovered files, the cheapest way to get coverage is to extract the logic into a sibling pure module and test that, which is how the covered ones came to exist.

Largest stylesheets, for the same reason: `styles/parts/tool.css` (2,850), `gallery.css` (1,654), `brand-studio.css` (1,280), `color-lab.css` (1,265), `styles/picker.css` (1,188), `valid.css` (1,166) and `tool-chrome.css` (1,030).

## `FEATURES.md` is not this file

`src/FEATURES.md` is **user-facing release notes**: per-feature status, benefits and click-by-click usage instructions. It is not a structural map, it does not track the tree, and nothing generates it. Read it to learn what a feature is meant to do for a user. Read this file to learn where the code is.

## Conventions that will bite you

- Tool and session state goes through `host.state`. `localStorage` is used only by the pre-paint script in `index.html`, for theme, brand fonts, brand radius and language.
- Every path that mounts a tool goes through `createToolRuntime` in `lib/mount-runtime.ts`, because that is where the synchronous `host.color` and `host.geom` APIs are installed. Do not build a runtime around it.
- A new top-level `import` in `main.ts`, `bridge/index.ts` or `views/gallery.ts` lands on the boot path and is measured. Run `npm run check:bundle` after a production build if you add one.
- Any new stylesheet must be imported into a layer. An unlayered sheet outranks everything, including `a11y`.
