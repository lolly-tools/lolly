# rondocode, vendored

**Upstream:** https://github.com/vijaypemmaraju/rondocode (MIT, Copyright (c) 2026 Vijay Pemmaraju)
**Commit:** `fbbf6512df37501308ab6a738b2e00fc183dd5ec` (2026-10-07)
**Re-vendor:** `node scripts/vendor-rondocode.ts --commit=<sha>`, then `node scripts/build-rondo.ts --golden` and the full test run below.

`upstream/` is rondocode's source at that commit with Lolly's patches applied. Its text is kept exactly as upstream wrote it, which is why the tree is excluded from Biome, from this repo's typecheck and from the comment-wording gate. Upstream's own `NOTICE.md` credits the published algorithms and designs it follows.

## What was taken

| Path | Why |
|---|---|
| `packages/engine/src`, `packages/pattern/src`, `packages/rondo/src` | The DSP, the pattern engine and the rondo language. |
| `packages/rondo/examples` | Upstream's rondo examples. |
| `packages/app` (no tests) | The evaluation core (`src/session/evalCode.ts`, `scope.ts`) the renderer needs, and the editor the utility hosts. |
| `packages/server/src/render-runner.ts` | Upstream's headless render path, used verbatim so a render matches upstream's byte for byte. |
| `LICENSE`, `NOTICE.md`, `README.md`, `tsconfig.base.json` | Licence, credits, and the compiler settings the bundles are built with. |

Left out: every `test/` directory, `training/`, `packages/desktop`, `packages/dsp-rs`, the rest of `packages/server` (the MCP server and browser bridge) and `scripts/`.

## How Lolly uses it

`scripts/build-rondo.ts` builds two bundles from this tree:

- `generated/stage.js` holds upstream's evaluation core and runs only inside QuickJS, the `vm` execution class (`src/vm.ts`).
- `generated/render.mjs` holds the DSP and the graph checks, and the build refuses it if `new Function` or acorn reaches it.

It also writes `src/node-types.generated.ts` (the closed node-type list from `packages/engine/src/graph.ts`) and `engine/src/rondo-share-dict.ts` (the share-link dictionary from `packages/app/src/session/share.ts`). CI fails if a rebuild changes any of them (`pnpm run check:rondo`).

## Patches

Each patch is in `patches/` as `NNNN-short-name.patch`, a `git diff` relative to this tree with a header saying why it exists. The vendor script applies them in name order. They serve the Rondocode utility's editor (`community/rondocode`), which runs this app in an opaque-origin frame; none of them touches the evaluation core or the DSP, so the vm renderer's bundles and golden renders are unchanged.

| Patch | Why |
|---|---|
| `0001-lolly-host-seam` | One new file, `src/lolly/host.ts`, that reads what the utility provides from `globalThis.__lollyRondo`. With no host the app is upstream's. |
| `0002-design-system-theme` | `ui/palette.ts`, the CodeMirror theme and the canvas readers read one colour table derived from the app around the editor (light or dark as the app is, the design system's colours, contrast-checked), and follow it live through `var(--c-*)`. |
| `0003-brand-fonts` | Every font stack becomes `var(--font-brand)` or `var(--font-mono)`, set from the design system's faces. |
| `0004-library-in-lolly` | The project library is kept by the utility in `host.state` (the frame has no IndexedDB), and the editor opens and reports the utility's song. |
| `0005-no-mcp-bridge` | The MCP browser bridge (a WebSocket) is never started, so it is not in the build. |
| `0006-lolly-chrome` | Hands Lolly's chrome (built from the web shell's own transport, visualiser, menus and context menus in `editor/chrome.ts`) what it drives through `lolly.mountChrome`; adds an output gain for its volume, tags library rows for their context menu, gives the library the Song menu's verbs (new, rename, duplicate, examples), and leaves the WebGPU `visual()` renderer and the phone overflow menu unmounted (decision D4). |
| `0007-sing-models-through-lolly` | Every singing-model byte, and ONNX Runtime's wasm, is asked of the utility by file id; without models the sung parts stay silent with a notice. The sung parts, their voices and the silent parts are reported, so an export declares its singing. |
| `0008-no-external-fetch` | ddsp instrument models are never fetched; those parts stay silent with a notice. |
| `0009-downloads-through-lolly` | Files the editor makes are saved through the utility, which signs the audio before it saves. |
| `0010-no-analytics-tag` | Upstream's HTML pages load Google Analytics; the tag is removed from the vendored tree (the editor build does not use those pages). |

To change a patch: edit this tree, then rebuild the series from a git repository holding the pristine copy set (one commit per patch), and check that `node scripts/vendor-rondocode.ts --commit=<sha> --from=<clone>` reproduces this tree byte for byte.

## The editor build

`scripts/build-rondo-editor.ts` builds the patched app, Lolly's frame glue and chrome (`editor/`, which bundles the web shell's transport, icons, menus, body popover and MilkDrop visualiser, with three shell modules swapped for frame versions in `editor/shims/`) and the AudioWorklet processor into one self-contained file, `community/rondocode/lib/editor.html`. The chrome's styles are the shell's own rules for those components, taken by selector, plus `editor/chrome.css`; the file names the design tokens they read, and the utility passes their values. The editor's version is the upstream commit and a hash of the patch series (`fbbf6512df37+lolly.editor.<hash>`), which the files it renders record. `--check` fails on drift.

## Proof

`test/fixtures/golden.json` holds upstream's all-native render of every example (8 cycles, 48 kHz). `LOLLY_RONDO_FULL=1 node --test packages/rondo/test/rondo.test.ts` renders all 39 examples in both languages through the vm and compares the PCM: 78 of 78 byte-identical at this commit.
