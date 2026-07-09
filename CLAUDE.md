# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Lolly is a constraint-first, template-driven platform for generating on-brand creative assets (PNG/SVG/PDF/video/etc.) from simple inputs. A single platform-agnostic **engine** runs the same render path across multiple **shells** (web PWA, Tauri desktop/mobile, CLI). Tools are **data, not bundled code** — a manifest + template + optional hooks — synced to clients so new tools ship without app updates.

The package name, repo, and working directory are all `lolly`.

## Commands

```bash
# This repo is split into submodules — community/ (tools), brands/suse/ (PRIVATE brand pack),
# services/{mcp,ca}, docs/, and every shells/* live in github.com/lolly-tools/*.
# Clone with --recurse-submodules, or:
git submodule update --init --recursive   # REQUIRED before npm install (workspaces need every package.json)
                                          # brands/suse is `update = none` (private) — SUSE devs opt in:
git submodule update --init --checkout brands/suse

npm install                  # install workspace deps; postinstall builds the tools/ + catalog PROFILE VIEWS

# Content profiles — tools/ and catalog/ at the repo root are gitignored VIEWS of the
# active profile (profiles.json), built by scripts/use-profile.ts. NEVER commit them.
npm run profile              # show active + available profiles
npm run profile:suse         # community + SUSE tools, SUSE catalog (needs brands/suse mounted)
npm run profile:start        # blank brand: community tools + a single neutral tokens asset (brands/lolly-start)
npm run ingest:brand -- <src> --name <brand> [--register|--activate]  # hydrate a brand pack from DTCG/Tokens-Studio/Penpot tokens (scripts/ingest-brand.ts)

npm run dev:web              # run the web shell (Vite) + live-rebuild the /info site on docs changes
npm run build:web            # production build of the web shell — builds the /info site first

# Run a tool headlessly via the CLI shell (jsdom + same engine path as web)
npm run cli                                              # list available tools
npm run cli -- qr-code                                   # show a tool's inputs
npm run cli -- qr-code --url=https://suse.com --output=./qr.svg
npm run cli -- qr-code --url=https://suse.com --export=png > qr.png

npm run validate:catalog     # validate every tool.json + asset against schemas & invariants
npm run build:catalog        # regenerate catalog/tools/index.json + asset checksums
npm run build:info           # build the docs/info site once (docs/build.ts → shells/web/public/info/). Add --watch to rebuild on change; dev:web runs it in --watch, build:web runs it once. Plain `npm run dev` in shells/web does NOT build /info.
```

### Tests

The engine contract test suite lives at the repo root (`tests/`, node:test, no framework). Run with `npm test`, or directly:

```bash
node --test "tests/**/*.test.ts" "tests/**/*.test.js"
```

Use the quoted glob, not `node --test tests/` — on current Node the bare directory form tries to load `tests` as a module instead of discovering test files. The tests import engine modules across the workspace boundary via `../engine/src`, so the repo root owns the run.

There is no lint script configured. The codebase is **TypeScript** — engine, both shells, `scripts/`, `docs/build.ts`, and `tests/`; the only `.js` left in the migrated TS projects (engine, shells-web/cli/tui, tests, scripts) are tool `hooks.js`, which ship as tool *data* (not compiled); Tauri `bridge-overrides/`, the vite configs, the web service worker (`shells/web/public/sw.js`), the chrome-extension, the `api/` functions and vendored libs (`tools/*/lib/*.min.js`) remain `.js`. The `typecheck` script runs `tsc -p` across every project — `engine/`, `shells/web/`, `shells/cli/`, and `tests/`. Node runs the `.ts` directly via native type-stripping; Vite/esbuild handle the web build.

## Architecture

### The three-layer separation (this is the core idea)

```
engine/     ← platform-agnostic core. Knows NOTHING about brands, the DOM, storage, or networking.
shells/     ← host implementations. Each provides a "capability bridge" the engine calls into.
community/  ← brand-agnostic tool definitions (manifest + template + hooks). Data, not code. Public.
brands/     ← brand packs: suse/ (PRIVATE submodule: SUSE tools + catalog), lolly-start/ (blank, parent-owned).
tools/      ← VIEW (gitignored): the active profile's merged tool set — community/* ∪ brands/<active>/tools/*.
catalog/    ← VIEW (gitignored): symlink to the active brand's catalog.
```

- `engine/` has **no** dependency on a DOM library, framework, or storage backend (see `engine/package.json` — only `handlebars` + `ajv`). Everything platform-specific is injected at runtime by the shell via the bridge.
- **Tools never import from the engine** and never touch the DOM/filesystem/network directly. They call `host.*` methods. This is what makes one tool run unchanged in browser, Tauri, and CLI.
- **Repository split (done — brand-pack layout since 2026-07-08):** content is mounted as packs: `community/` → public [`lolly-tools`](https://github.com/lolly-tools/lolly-tools) (the 13 brand-agnostic tools: utilities, qr-code, street-map, filter-*), `brands/suse/` → **private** `suse-lolly` (33 SUSE tools + the full SUSE catalog, incl. tokens and the PremiumBeat music — private, so the old 2026-08-29 public-removal deadline no longer applies to it), plus `services/mcp`, `services/ca`, `docs/`, and every `shells/*` as public submodules. `engine/`, `schemas/`, `api/`, `scripts/`, `tests/`, `brands/lolly-start/`, and `profiles.json` stay in this parent repo. The repo-root `tools/` and `catalog/` are gitignored **profile views** built by `scripts/use-profile.ts` (symlink farm; real copies on Vercel where `postinstall` runs with `VERCEL=1`, and the views are `.vercelignore`d) — every script/shell/deploy path still consumes those two paths unchanged. `brands/suse` is `update = none` in `.gitmodules` so public clones (and CI) skip the private pack and fall back to the `lolly-start` profile. The split toolkit + day-to-day workflow live in `scripts/subrepo/` (see its README); `loldev profile <name>` switches profiles. Editing a SUSE tool touches two repos (`suse-lolly` + parent pointer); a community tool touches three (`lolly-tools` manifest, `suse-lolly` regenerated `index.json`, parent pointer). The no-cross-imports rule stays enforced so the split stays clean. **Do not add SUSE-specific or DOM-specific logic to `engine/`, and never commit the `tools/`/`catalog/` views.** The retired public `lolly-suse-tools` / `lolly-suse-catalog` repos await archiving (music must leave the public one before 2026-08-29).

### The Capability Bridge (`engine/src/bridge/host-v1.ts`)

The versioned contract between tools and shells (current `ENGINE_VERSION = '1.30.0'`, `engine/src/index.ts` — a changelog comment block above the const tracks each minor). `HostV1` exposes the required `profile`, `assets`, `state`, `clipboard`, `export`, and `log`, plus optional/additive APIs (added in minor versions, never removed): `net` (allowlisted fetch), `tokens` (DTCG design tokens), `text` (text-to-path via HarfBuzz WASM — v1.29 adds `variations` for variable-font weights and a `fallbackFonts` chain for disjoint webfont subsets; `fallbackFonts` shapes a run across disjoint webfont subsets, `notdef` reports uncovered glyphs so callers can keep a `<text>` fallback, and v1.30 `axisDefaults` reports a variable font's default instance so a jsPDF-embed caller knows the weight it'll get), `pdf` (analyze/strip/compress), `capture` (rasterise a live URL), `compose` (nested tool renders — `render()` for authored `composes`, plus `renderUrl()` (v1.3) for the end-user path where a Lolly tool link pasted into the asset picker becomes an image; a tool-sourced asset's id is its canonical embed URL, re-rendered on load — see `engine/src/tool-url.ts`), and `media` (v1.4 — a live camera frame source for motion-reactive tools; DOM-free RGBA frames drive a tool's `onFrame` hook, e.g. the `filter-*` tools' "Go live" mode. Progressive enhancement — NOT gated by the `camera` capability flag; the runtime owns the frame loop via `startLive()`/`stopLive()`), and `recorder` (v1.17 — mic/AV capture + a DOM-free audio-level meter driving the `onLevel` hook for the recording tools; gated by the `microphone`/`camera` capabilities). `export` itself has `render()` (rasterise a DOM node), `download()`, and `file()` — the v1.1 on-device transform path (file-in → bytes-out), which never watermarks or embeds provenance. Rules that matter when editing it:

- Methods may be **added** in a minor version; never removed or signature-changed without a major bump. When v2 ships, v1 must keep working.
- **No platform-specific methods** on the bridge. If only Tauri can do something, it goes behind a `capabilities` flag declared in `tool.json`, and shells that can't fulfill it expose a stub/error.
- Storage always goes through `host.state` — the bridge picks IndexedDB (web), filesystem (Tauri), or memory (CLI). **No `localStorage`** for tool state. (The web shell uses `localStorage` only for the theme/FOUC flash; tool state never.)

### The runtime lifecycle (`engine/src/runtime.ts`)

`createRuntime(tool, host, initialState)` orchestrates one mounted tool: load → build input model → resolve asset refs → run `onInit` hook → hydrate template → export. Key concepts:

- **Input model** (`engine/src/inputs.ts`) is the single source of truth for input semantics. Shells *render* the model generically; they never interpret manifest declarations themselves. That's how web/Tauri/CLI stay consistent.
- **Hook patch semantics:** hooks return a plain object. Keys matching a declared input `id` update that input's value; keys with no match go into `extras` — a parallel store of computed values the template can reference directly (e.g. QR module lists, chart data) without being declared as user-facing inputs.
- **Hooks run with the host bridge injected (not isolated):** loaded via `new Function('host', ...)` so the `host` bridge is the supported, portable API surface passed in — but this is closure-scope injection only, **not** a security sandbox. Hooks still execute in the realm's global scope, so in a browser shell they *can* reach `window`/`document`/`fetch` (some shipping tools rely on it); `host.*` is the intended path, not an enforced boundary. Async hook results are time-boxed (`HOOK_BUDGET_MS` in `runtime.ts`, exported mutable for tests: `onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile` 10s): the race abandons the wait and discards the late result (it never patches inputs/extras), but the hook keeps executing — synchronous runaway code can't be preempted in-realm, so a sync overrun is only measured and logged as a warning. `onInit`/`onInput` errors are logged, not thrown; `beforeExport`/`exportFile` errors (incl. timeouts) fail that export visibly, and `afterExport` (the cleanup guarantee in export's `finally`) is caught + logged so it can't mask a render error. The v1.4 `onFrame` hook (live camera) and `onLevel` run once per frame/sample, are NOT time-boxed, and the runtime drops overlapping frames so a slow per-frame render self-throttles. Third-party/untrusted tool code is not safe to run until Worker isolation ships.
- **Experimental tools watermark exports** automatically (`status: 'experimental'` forces `watermark: true` in `export()`).

### Templates (`engine/src/template.ts`)

Handlebars, **logic-less by design** — so non-developers can author them and there's no per-template XSS audit (`{{x}}` escapes; `{{{x}}}` is opt-in raw). Tools needing real logic use `hooks.js`. Custom helpers: `default`, `upper`, `lower`, `eq`, `markdown` (tiny subset), `asset` (`{{asset logo}}` → url, `{{asset logo "width"}}` → field), plus data-format helpers for sibling text templates (`template.ics`/`.vcf`/`.csv`) — `icsStamp` (date → iCal basic form), `rfcText` (RFC 5545/6350 escaping), `csvCell` (RFC 4180 quoting), and `arrow` (leading `>` `<` `^` `v` → `→ ← ↑ ↓`). `annotateTemplate` wraps input references in HTML comment markers so the web shell can map rendered DOM nodes back to sidebar controls.

### URL mode is first-class (`engine/src/url-mode.ts`)

Every input must be expressible as URL params. **The CLI is URL mode under a different transport** — `--foo=bar` argv pairs become the same values the web shell parses from `?foo=bar`. One render path, so CLI and GUI never drift. Reserved params (not inputs): `format`, `export`, `copy`, `full`, `options`, `slot`, `output`, `filename`, `_v`, `width`/`w`, `height`/`h`, `unit`, `dpi`, `bleed`, `marks`, `c2pa`, `password`, `profile`, `nostage`, `z`. Tools can opt into compact encoding (`urlKey` aliases, `#`-less colors, tilde-delimited block arrays).

**Physical units:** `width`/`height` are values in `unit` (`px` default, or `mm`/`cm`/`in`/`pt`); `dpi` sets raster resolution for physical units (default 300). Conversion happens at export time per format — PDF→points (true page size), SVG→unit+px-viewBox, raster→pixels at DPI (PNG embeds a `pHYs` DPI chunk). The math is the engine's single source of truth in `engine/src/units.ts` (`parseDimension`, `toPixels`, `toPoints`, `toCssLength`, …); each shell's export bridge (`shells/web/src/bridge/export.ts`, `shells/cli/src/bridge.ts`) applies it per format.

## Tools: anatomy and invariants

A tool is a directory under `tools/<id>/`:

```
tools/<id>/
├── tool.json        # required — manifest (validated against schemas/tool.schema.json)
├── template.html    # required — Handlebars markup
├── styles.css       # optional — auto-scoped to the tool canvas
├── hooks.js         # optional — imperative escape hatch (only if manifest declares `hooks`)
├── thumb.png        # optional — gallery thumbnail
└── assets/          # optional — tool-local assets (not in the global catalog)
```

- **Inputs are declared in the manifest, not inferred from the template.** Input types: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks` (repeating field groups — see `meeting-planner` for the reference implementation), `vector` (a fixed group of numbers as one control), and `file` (the user's own file, bytes in memory — for on-device transform utilities like `strip-data`).
- Any input can `bindToProfile: "firstname"` to pre-fill from the user profile.
- See `docs/authoring-tools.md` for the full authoring guide and `docs/url-mode.md` for URL encoding.

### Hard invariants (changing these is a major undertaking)

- **Tool `id` and asset `id` are permanent contracts.** `suse/logo/primary` never gets renamed or reused. Version in the manifest, never in the path.
- After editing any `tool.json` or asset, run `npm run build:catalog` then `npm run validate:catalog`. The manifest is the source of truth; `catalog/tools/index.json` is *generated* and must not drift (the validator fails CI if it does). The validator also checks asset checksums, file existence, `bindToProfile` fields, palette references, and `replacedBy` chains.

## Repository layout

| Path | Role |
|---|---|
| `engine/src/` | `index.ts` (public surface), `loader.ts`, `runtime.ts`, `inputs.ts`, `template.ts`, `validate.ts`, `url-mode.ts`, `units.ts`, `color.ts`, `print-marks.ts`, `emf.ts`, `svg-path.ts`, `tokens.ts`, `compose.ts`, `embed.ts`, `metadata.ts`, `tool-url.ts`, `c2pa.ts`, `c2pa-verify.ts`, `x509.ts`, `video-meta.ts`, `apng.ts`, `batch.ts`, `css-box.ts`, `data-import.ts`, `design-map.ts`, `eps.ts`, `icon-theme.ts`, `media-sniff.ts`, `pdf-crypto-r6.ts`, `pdf-map.ts`, `pdfx.ts`, `photo-treatment.ts`, `tiff.ts`, `url-pack.ts`, `zip-crypto.ts`, `bridge/host-v1.ts` (43 TS modules) |
| `shells/web/` | Vite PWA. Bridge impls under `src/bridge/`, views under `src/views/`, catalog sync under `src/catalog/` (all `.ts`) |
| `shells/cli/` | `bin/lolly.ts` (entry), `src/run.ts` (jsdom render), `src/bridge.ts` (CLI bridge) |
| `shells/tauri-desktop`, `shells/tauri-mobile` | Tauri shells with `bridge-overrides/` |
| `community/` | 13 brand-agnostic tool dirs (qr-code, street-map, strip-data, text-helper, filter-*, …) — public submodule `lolly-tools` |
| `brands/suse/` | PRIVATE submodule `suse-lolly`: `tools/` (33 SUSE tool dirs) + `catalog/` (assets incl. `assets/suse/tokens/brand.json`, fonts, previews, og, generated `tools/index.json`) |
| `brands/lolly-start/` | parent-owned blank brand: near-empty `catalog/` (one neutral tokens asset) — where the brand-import (DTCG) experience gets built |
| `tools/`, `catalog/` | gitignored profile VIEWS of the above (scripts/use-profile.ts + profiles.json) — what every script/shell actually reads |
| `schemas/` | `tool.schema.json`, `asset.schema.json`, `asset-ref.schema.json` |
| `scripts/` | `build-catalog-index.ts`, `checksum-assets.ts`, `validate-catalog.ts` |
| `docs/` | architecture, authoring guides, positioning, URL mode; `build.ts` builds the info site |
