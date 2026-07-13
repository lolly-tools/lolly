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

Heavy dependencies (`playwright-core`, `@resvg/resvg-js`) are imported dynamically at
point of use, so importing the package pulls no browser or native module at startup.

Bundling note: `shells/cli/src/bridge.ts` (inlined into the Vercel MCP function by
`scripts/build-mcp-fn.ts`, which treats bare package specifiers as external) imports
`repo-root` via a **relative** path so esbuild inlines it. Keep it that way for any
module that becomes reachable from `services/mcp`'s import graph.
