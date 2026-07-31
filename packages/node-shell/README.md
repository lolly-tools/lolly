# @lolly-tools/node-shell

Shared plumbing for Lolly's Node shells (`shells/cli`, `shells/tui`) — the modules
that used to be forked per shell and drifted:

| Module | What it owns |
|---|---|
| `repo-root` | `repoRoot()` — `LOLLY_ROOT` → marker-based walk → `cwd` resolution of the directory holding `catalog/` + `tools/` (works from source and from an esbuild bundle) |
| `browsers` | the scoped headless-Chromium launcher/pool ("Tier B"), `resolveBrowsersDir()` (env → repo-root `.browsers` → `services/mcp/.browsers` sibling reuse), `BrowserError`, `browserInstalled()` |
| `webshell-render` | drive the built web shell in Chromium and capture its download — byte-identical to a web/desktop export (incl. the `password` PDF-lock param) |
| `raster` | `NODE_FORMATS` (the DOM-free format split), `pxDims()`, and the resvg SVG→PNG fast path ("Tier A") |
| `c2pa-opts` | `buildExportC2paOpts()` — the export Content-Credentials payload, including profile author under the `useDetails` opt-in |
| `net` | `createNetAPI()` — host.net's allowlisted fetch: the prefix matcher and the 64 MB counting-stream body cap |
| `pptx` | `createPptxAPI()` (+ `inflatePptx`, `looksLikePptxFile`, `PPTX_MIME`) — host.pptx deck inspect + surgical rebrand, with the XML parser injected |
| `pdf-pages` | `scanPdfPages()` — the pdf-lib walk (page content stream + resolved fonts/xobjects/extgstates/OCGs) that feeds the engine's pure `interpretPdfPage`, for EVERY page and never throwing. The first-page-only versions of this walk in `shells/web/src/views/pdf-import.ts` and `shells/tui/src/import/pdf.ts` should call it |
| `inspect` | `inspectBytes()`/`inspectPath()` — "what is in this file, and is it safe to share": embedded metadata, PDF structure, and text present in the file but not visible on the page (the failed-redaction case), plus Content Credentials on request. Backs `lolly validate --metadata`; the TUI and MCP consume the same call |
| `inspect-render` | `renderInspection()` — the terminal rendering of an `Inspection`. Every interpolated value is control-character scrubbed, because all of it comes out of the file being examined |
| `verdict-slugs` | `VERDICT_SLUGS` / `verdictSlug()` — the stable slug + headline for each engine-resolved C2PA state. The engine owns the ladder; this owns the vocabulary every machine surface reports it in, so `lolly validate --json` and the MCP `verify_file` tool cannot answer the same question two ways |

`net` and `pptx` are shared with the WEB shell as well, not just the terminal ones.
Both are DOM-free (`net` is `fetch` + `TransformStream`; `pptx` is engine primitives +
fflate with the XML parser passed in), and `shells/web/src/bridge/{net,pptx}.ts` are now
thin re-exports of them, so web import sites are unchanged. They lived in `shells/web`
until 2026-07-29, which meant `shells/cli` and `shells/tui` could not typecheck without
that separately versioned submodule checked out. Two web bridge modules the CLI still
reaches across for could NOT follow, because they genuinely touch the DOM:
`bridge/pdf.ts` (canvas image recompression, feature-detected) and `bridge/svg-ir.ts`
(canvas `<image>` decode, plus `font-registry.ts` → IndexedDB and `document.fonts`).

Heavy dependencies (`playwright-core`, `@resvg/resvg-js`) are imported dynamically at
point of use, so importing the package pulls no browser or native module at startup.

`inspect` makes two promises that are not implementation details and must survive any
refactor: it NEVER claims invisible-watermark detection of any kind (SynthID is not
detected by Lolly at all, and the pixel-watermark decoders need a browser), and every
result carries a `limits` list ending in `ABSENCE_CAVEAT` — a report that found nothing
says so as "these checks found nothing", never as "this file is clean".

Bundling note: `shells/cli/src/bridge.ts` (inlined into the Vercel MCP function by
`scripts/build-mcp-fn.ts`, which treats bare package specifiers as external) imports
`repo-root` via a **relative** path so esbuild inlines it. Keep it that way for any
module that becomes reachable from `services/mcp`'s import graph.
