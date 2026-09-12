# @lolly-tools/node-shell

Shared plumbing for Lolly's Node shells (`shells/cli`, `shells/tui`, `services/mcp`)
and, for the DOM-free modules listed below, for the WEB shell too - the modules that
used to be forked per shell and drifted.

The name is historical: it says where these modules can run at their heaviest, not who
is allowed to import them. Around twenty of them are pure or DOM-optional and
`shells/web/src` consumes them directly, so "Node" here means "no browser required",
not "browser forbidden". A module that does reach for `node:fs`, `node:worker_threads`
or `playwright-core` must stay out of the web import graph; see **What the web shell may
import** below.

## Importing

Every consumer imports through the package's `exports` map:

```ts
import { createPdfAPI } from '@lolly-tools/node-shell/pdf';
```

Not by relative path. `../../../../packages/node-shell/src/pdf.ts` resolves to the same
file, which is why 50 of them accumulated unnoticed, but it walks straight past the
export map: a module with no subpath stays reachable, so the map stops describing the
surface and the serverless bundlers that GENERATE their alias list from it
(`scripts/lib/workspace-aliases.ts`) silently miss it. A subpath in the map is the only
statement that a module is part of the package's API. Adding a module for someone else
to use means adding its subpath in the same commit.

## What each module owns

| Module | What it owns |
|---|---|
| `repo-root` | `repoRoot()` - `LOLLY_ROOT` → marker-based walk → `cwd` resolution of the directory holding `catalog/` + `tools/` (works from source and from an esbuild bundle) |
| `browsers` | the scoped headless-Chromium launcher/pool ("Tier B"), `resolveBrowsersDir()` (env → repo-root `.browsers` → `services/mcp/.browsers` sibling reuse), `BrowserError`, `browserInstalled()` |
| `webshell-render` | drive the built web shell in Chromium and capture its download - byte-identical to a web/desktop export (incl. the `password` PDF-lock param) |
| `desktop-renderer` | the installed-app full-fidelity rung: discover or launch `Lolly --render-server`, authenticate to its loopback endpoint, send the same export URL over the framed protocol, and make `auto` fall through visibly to Chromium |
| `raster` | `NODE_FORMATS` (the DOM-free format split), `pxDims()`, and the resvg SVG→PNG fast path ("Tier A") |
| `hdr` | `encodeHdrPng()` (16-bit Rec.2100-PQ with cICP 9/16/0/1) and `encodeGainMapJpeg()` (ISO 21496-1 / Ultra HDR) - the Node ports of the web shell's two HDR writers, calling the same engine modules in the same order, with sharp injected where the browser used its canvas encoder. Also `hdrBoostOptions()`, the author dials shared with `raster`'s EXR path |
| `models-dir` | the ONE models-directory resolver every Node caller shares: the rungs (`opts.modelsDir` → `$LOLLY_MODELS_DIR` → the repo's `shells/web/public/models` → `~/.cache/lolly/models`), the WRITE policy (`resolveModelsDir`, used by `host.speech` and `lolly models fetch`, which takes the env var as given) and the READ policy (`resolveExistingModelsDir`, used by the ML runners, which passes over a rung that is not on disk). Also `ModelFilePin`, `missingPinnedFiles()` and `pinnedBytes()` - "is this file staged" answered once, by size against its pin |
| `speech` | `createNodeSpeechAPI()` - host.speech in Node: Kokoro synthesis and Whisper transcription over `@huggingface/transformers` on the onnxruntime-node backend, with `allowRemoteModels` off. Every number comes from the engine's `speech-text` and this package's `speech-whisper`/`tts-blend`, so a clip synthesized in the terminal says the same words at the same times as one from a browser tab. Owns `SPEECH_MODEL_FILES` (the kokoro + whisper pins) and the missing-model refusal that names `lolly models fetch <family>` |
| `sequence-audio` | `mixSequenceAudio()` and the design timeline's soundtrack without a browser: windowing, gain envelopes, equal-power pan, signal-derived ducking, bed handling, then normalise + true-peak limit through the engine's own meters. `readSeqAudioPlan()` reads the plan off a hydrated stage; what cannot be mixed here (a stretched clip, a container Node has no codec for) is named in `warnings`, never silently dropped |
| `c2pa-opts` | `buildExportC2paOpts()` - the export Content-Credentials payload, including profile author under the `useDetails` opt-in |
| `signing-identity` | `resolveSigningIdentity()` - load an operator's own P-256 key + certificate chain from a path or an env PEM and hand `embedC2pa` a real signer, so a terminal export carries a verifiable identity instead of an anonymous ephemeral key. Owns the refusals that keep a misconfiguration from becoming an unverifiable file: key/certificate match, validity window, chain order, curve. Takes no key material from argv, ever, and no error it raises contains any |
| `net` | `createNetAPI()` - host.net's allowlisted fetch: the prefix matcher and the 64 MB counting-stream body cap |
| `pptx` | `createPptxAPI()` (+ `inflatePptx`, `looksLikePptxFile`, `PPTX_MIME`) - host.pptx deck inspect + surgical rebrand, with the XML parser injected |
| `pdf` | `createPdfAPI()` (+ `analyzePdf`, `stripPdf`, `compressPdf`) - host.pdf's metadata inspect/strip and the compressor. Pure pdf-lib, except the image re-encode pass, which feature-detects a canvas and is skipped when there is none, so Node gets the structural re-save. `shells/web/src/bridge/pdf.ts` re-exports it |
| `pdf-structure` | `scanPdfStructure()` - what a PDF CARRIES and DOES rather than what it says about itself: attachments, open-time JavaScript, outward actions, filled form values, annotations, hidden layers. Depth-capped, cycle-guarded, output-capped, and every accessor swallows a malformed object, because the graph is hostile input. `pdf` loads it lazily; `shells/web/src/bridge/pdf-structure.ts` re-exports it |
| `text-svg` | the pure parsers vector text export runs on: the catalog font-file resolver, `canVectoriseText`, `featureSettingsToHb`, `letterSpacingPx`, `textBaselineY`, `textStrokeAttrs`. No DOM, no Node. `shells/web/src/bridge/text-svg.ts` re-exports it |
| `svg-ir` | `svgDomToIr()` - the SVG DOM → device-pixel vector IR walk that EMF, EPS, DXF, WMF and the Penpot PDF sink all consume. DOM-light: attribute reads plus an optional computed style, so it runs under jsdom. The font resolver is injected (`ctx.resolveFont`), so it carries no registry of its own. `shells/web/src/bridge/svg-ir.ts` re-exports it with the web registry wired in |
| `speech-whisper` | the pure half of Whisper transcription: the model pins, the silence floors, chunk planning at the quietest moment near each 25 s boundary, timestamp repair and stitching. `shells/web/src/lib/speech-whisper.ts` re-exports it |
| `tts-blend` | `blendStyleRow()` and `phonemesForWord()` - the two per-chunk inputs every Kokoro model call takes: the weighted style row for a voice blend, and a word's hand-written IPA with its own punctuation kept. `shells/web/src/lib/tts-blend.ts` re-exports it |
| `pdf-pages` (internal) | `scanPdfPages()` - the pdf-lib walk (page content stream + resolved fonts/xobjects/extgstates/OCGs) that feeds the engine's pure `interpretPdfPage`, for EVERY page and never throwing. The first-page-only versions of this walk in `shells/web/src/views/pdf-import.ts` and `shells/tui/src/import/pdf.ts` should call it. Also `openPdfForRender()` - the same walk plus embedded-raster resolution, serialised through the engine's `pdfNodesToSvg`, so a page can be RENDERED here and not only read |
| `canvas` | `isCanvasAvailable()` / `createNodeRasterAPI()` (host.raster) / `installNodeCanvas()` - a real 2D canvas over `@napi-rs/canvas`, conditionally attached like sharp. The install makes a jsdom realm genuinely raster-capable (`getContext('2d')`, `toBlob`, `Image`, `createImageBitmap`, `URL.createObjectURL`) so a tool hook that rebuilds pixels runs headlessly instead of escalating to a browser |
| `pdf-redact-core` | the DOM-free maths + pdf-lib rebuild BOTH redaction halves share: DPI clamp, point→pixel bar mapping, radius inflation, stamp layout, grayscale, `buildImagePdf()`. `shells/web/src/bridge/pdf-redact-core.ts` re-exports it |
| `pdf-redact` | `redactPdf()` / `pdfPages()` (host.pdf.redact + host.pdf.pages) - rasterise-and-rebuild over `openPdfForRender` → resvg → the canvas, with every number from `pdf-redact-core` so a bar covers identical pixels in the terminal and in the browser |
| `image-redact` (internal) | `redactImage()` - the redact utility's raster repaint without a browser: composite onto white, optional colour drain, bars at full opacity, re-encode so no EXIF/XMP/ICC/C2PA can survive. Owns `paintBars()`, the one mark painter the PDF half uses too |
| `ml/` | the on-device model utilities for the Node shells: `createNodeUpscaleAPI` / `createNodeMatteAPI` / `createNodeOcrAPI` (host.upscale / host.matte / host.ocr over onnxruntime-node, sharp for pixels), plus `createNodeAiDetectAPI`, `createNodeRewordAPI` and `createNodeDepthAPI` for the three families that have no HostV1 member. `ml/session.ts` owns the shared plumbing: the models-directory read policy (from `models-dir`), memoised CPU sessions (`LOLLY_ORT_EP=coreml` opts in), the RGBA8 ↔ sharp helpers, and the one refusal that names `lolly models fetch <family>` with the size. `ml/model-pins.ts` holds what each family IS - every file, size and SHA-256 - so `lolly models fetch` and the presence checks read one list; it is drift-tested against the `scripts/fetch-*-models.ts` PINS tables, and `depth` is registered as unpublished so its fetch refuses instead of 404-ing. Nothing here ever downloads a model. The ROSTERS and the MATHS (`*-models.ts`, `*-math.ts`) are shared with the web shell, which re-exports them |
| `inspect` | `inspectBytes()`/`inspectPath()` - "what is in this file, and is it safe to share": embedded metadata, PDF structure, and text present in the file but not visible on the page (the failed-redaction case), plus Content Credentials on request. Backs `lolly validate --metadata`; the TUI and MCP consume the same call |
| `inspect-render` | `renderInspection()` - the terminal rendering of an `Inspection`. Every interpolated value is control-character scrubbed, because all of it comes out of the file being examined |
| `verdict-slugs` | `VERDICT_SLUGS` / `verdictSlug()` - the stable slug + headline for each engine-resolved C2PA state. The engine owns the ladder; this owns the vocabulary every machine surface reports it in, so `lolly validate --json` and the MCP `verify_file` tool cannot answer the same question two ways |

`ml/` carries the same kind of sharing, for the same reason: `ml/{upscale,matte,ocr,depth,ai-detect,reword}-models.ts`
hold the model rosters and `ml/{upscale,matte,ocr,depth}-math.ts` the tiling, letterbox,
CTC and resampling maths, and the matching `shells/web/src/lib/` files import or
re-export them. Two copies would let `models()`/`modelBytes()` answer differently in the
app and in the terminal, and let a mask or a tile seam drift; one copy cannot.

## What the web shell may import

`text-tools` supplies the Node `host.textTools` adapter and runs the engine's operations in disposable workers. `text-xml` supplies bounded XML/XSD parsing through libxml2-wasm for both Node and web workers. Source text is never logged or fetched by either module; external DTDs and schema dependencies are refused. The shared syntax implementation is `engine/src/text-syntax.ts`.

`net`, `pptx`, `pdf`, `pdf-structure`, `pdf-redact-core`, `pdf-file-operation`,
`text-svg`, `svg-ir`, `speech-whisper`, `tts-blend` and the `ml/*-models` +
`ml/*-math` pairs are shared with the WEB shell as well, not just the terminal ones.
Each is DOM-free or DOM-optional, and each web file is a thin re-export. They lived in
`shells/web` - `net` and `pptx` until 2026-07-29, the rest until plans/202 WP1.1 -
which meant `shells/cli` and `shells/tui` could not typecheck without the web shell's
own dependency tree installed. Nothing under `shells/cli`, `shells/tui` or here imports
from `shells/web` any more.

The line a web import must not cross is `node:*`, `playwright-core`, `@resvg/resvg-js`,
`sharp`, `@napi-rs/canvas` and `onnxruntime-node`. Every module in the list above is
free of all of them, transitively, at RUNTIME - the one edge from that set into a
Node-flavoured module is `ml/model-pins` → `models-dir` for the `ModelFilePin` type,
and it is an `import type`, so it erases. Before a web file imports a new subpath, walk
that module's own imports: `browsers`, `webshell-render`, `desktop-renderer`, `raster`,
`hdr`, `models-dir`, `file-operations`, `hook-worker`, `inspect`, `canvas`, `speech`
and everything under `ml/` that is not a `*-models` or `*-math` file all read the disk,
spawn a browser or load a native addon. When a web file needs one pure function out of
a module like that, split the function into its own DOM-free module (that is what the
`*-math` files are) rather than widening the browser's import graph.

Nothing enforces this mechanically yet: Vite would happily bundle a `node:fs` import
and fail at runtime. The check is reading the module you are about to import.

`svg-ir` was the one that had to change shape to make the move: it reached
`bridge/font-registry.ts`, which reads IndexedDB and `document.fonts`. The font resolver
is INJECTED now (`SvgIrContext.resolveFont`), so the web shim passes `resolveVectorFont`
and a shell with no registry passes nothing. Its `<image>` decode and `pdf`'s canvas
image recompression stay where they are, both feature-detected, both already skipped in
Node.

Heavy dependencies (`playwright-core`, `@resvg/resvg-js`) are imported dynamically at
point of use, so importing the package pulls no browser or native module at startup.

`inspect` makes two promises that are not implementation details and must survive any
refactor: it NEVER claims invisible-watermark detection of any kind (SynthID is not
detected by Lolly at all, and the pixel-watermark decoders need a browser), and every
result carries a `limits` list ending in `ABSENCE_CAVEAT` - a report that found nothing
says so as "these checks found nothing", never as "this file is clean".

Bundling note: `scripts/build-mcp-fn.ts` and `scripts/build-ca-fn.ts` treat bare
package specifiers as external, so a workspace import they do not alias resolves at
runtime to a TypeScript file that is not in the deployed function. They no longer need
relative imports to dodge that: `scripts/lib/workspace-aliases.ts` reads THIS
package.json's `exports` map and aliases every subpath in it to the real source file,
and `assertNoBareWorkspaceImports` fails the build on anything that escaped. The cost
is that the map has to be complete - a module reachable from `services/mcp` or
`shells/cli/src/bridge.ts` with no `exports` subpath cannot be imported by specifier at
all, and adding the import without adding the subpath breaks the function, not the
typecheck.

Two modules are NOT in the map by choice, and the table marks them `(internal)`:
`pdf-pages` and `image-redact`. Both are used only inside this package (and, for
`pdf-pages`, by a repo-root test that imports it by file path). Give either one a
subpath the moment a shell needs it - the web shell's `views/pdf-import.ts` calling
`scanPdfPages()` is the obvious next one.
