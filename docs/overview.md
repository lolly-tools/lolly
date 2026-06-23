# Overview

This document captures the purpose, structure, and architectural decisions for the Lolly platform. It reflects both the product vision and the current state of the codebase.

---

## Why this exists

Brand teams face a recurring problem: recurring creative work that is too predictable to justify a designer's time, but too brand-sensitive to hand off without guardrails. The result is either slow throughput (designer bottleneck), inconsistency (people using whatever tool they have), or vendor lock-in (a SaaS DAM that controls your templates).

This platform is the structural answer:

> **Programmatic creative at scale** — zero-labor asset generation, with central brand control, for employees, vendors, and partners.

The outcome is **brand abundance**: every event has correct signage, every CVE alert is on-brand, every email signature is current, all without a design ticket. The platform handles recurring operationalised creative. It is deliberately not a bespoke creative tool — designers still own flagship work.

### Where it fits in the landscape

| Capability | Canva | Brandfolder | Illustrator / Inkscape | Figma / Penpot | **Lolly** |
|---|---|---|---|---|---|
| Mass content generation | partial | ✅ | partial | ✅ | ✅ |
| Offline availability | ✅ | ❌ | ✅ | ❌ | ✅ |
| Template logic / constraints | ❌ | ✅ | ❌ | ❌ | ✅ |
| Generative design | ❌ | ✅ | partial | partial | ✅ |
| Low skill required | ✅ | ✅ | ❌ | ❌ | ✅ |
| Easy internal access | ❌ | ✅ | ❌ | ❌ | ✅ |
| Intuitive editor (end user) | ✅ | ✅ | ❌ | ❌ | ✅ |
| Intuitive editor (designer) | ✅ | ❌ | ✅ | ✅ | ❌ |
| Live collaboration | ✅ | ❌ | ❌ | ✅ | ❌ |

The gap is clear: nothing in the existing landscape gives us constraints-first, offline-capable, low-skill, internally accessible output. The trade-off we accept is that this is **not** an open-canvas tool. Designers continue to use Illustrator and Figma for bespoke flagship work. Permutations can be assembled with this tool.

**Use it for:** Rapid generation of operationalised creative assets — event tiles, name badges, signatures, CVE alerts, QR codes, social cards.

**Do not use it for:** Bespoke hero content.

---

## The big picture

```
                ┌─────────────────────────────────────────────┐
                │              Tools (data, not code)         │
                │   tool.json + template.html + hooks.js?     │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ talks to via Capability Bridge v1
                                    ▼
                ┌─────────────────────────────────────────────┐
                │                  Engine                     │
                │   loader · validator · runtime · template   │
                │   inputs · url-mode                         │
                │   PLATFORM AGNOSTIC. Knows nothing of DOM,  │
                │   filesystem, or You.                       │
                └─────────────────────────────────────────────┘
                                    ▲
                                    │ implements HostV1
                                    ▼
        ┌──────────────┬──────────────┬──────────────┬──────────────┐
        │  Web Shell   │ Tauri Desktop│ Tauri Mobile │  CLI Shell   │
        │   (PWA)      │              │              │              │
        └──────────────┴──────────────┴──────────────┴──────────────┘
                                    ▲
                                    │ fetches from
                                    ▼
                ┌─────────────────────────────────────────────┐
                │              Catalogs                       │
                │   catalog/tools/index.json + tool dirs      │
                │   catalog/assets/index.json + asset files   │
                └─────────────────────────────────────────────┘
```

### Repository layout

```
lolly/
├── engine/           # Platform-agnostic core. Open-sourceable.
│   └── src/
│       ├── index.js          # public surface — loader, runtime, template, inputs, url-mode
│       ├── loader.js         # fetches and validates tool files
│       ├── runtime.js        # orchestrates the 5-step lifecycle
│       ├── template.js       # Handlebars hydration + annotateTemplate
│       ├── inputs.js         # manifest → runtime input model
│       ├── url-mode.js       # URL ↔ input state round-trip
│       ├── validate.js       # JSON Schema validation of manifests
│       └── bridge/
│           └── host-v1.ts    # TypeScript interface — the bridge contract
│
├── shells/
│   ├── web/          # PWA — hosted online; primary distribution
│   │   └── src/
│   │       ├── main.js           # boot, routing
│   │       ├── theme.js          # theme apply/persist (FOUC prevention)
│   │       ├── bridge/           # web implementations of HostV1 APIs
│   │       │   ├── index.js      # compose all bridge pieces
│   │       │   ├── db.js         # IndexedDB setup
│   │       │   ├── state.js      # host.state — saved edits
│   │       │   ├── profile.js    # host.profile — user details
│   │       │   ├── assets.js     # host.assets — catalog + user uploads
│   │       │   ├── clipboard.js  # host.clipboard
│   │       │   ├── export.js     # host.export — rasterise/serialize
│   │       │   └── net.js        # host.net — allowlisted fetch
│   │       ├── catalog/
│   │       │   └── sync.js       # boot-time catalog sync + offline cache
│   │       ├── styles/           # app-wide CSS (app.css, picker.css, tokens.css)
│   │       └── views/
│   │           ├── gallery.js    # tool library listing + saved-state cards
│   │           ├── tool.js       # mounts one tool (inputs + canvas + actions)
│   │           ├── picker.js     # asset picker UI (invoked by host.assets)
│   │           └── profile.js    # user details editor
│   │
│   ├── cli/          # Node.js CLI — same engine, headless jsdom
│   │   ├── bin/brand-tool.js
│   │   └── src/
│   │       ├── run.js    # loadTool → createRuntime → export → write file
│   │       └── bridge.js # CLI implementation of HostV1
│   │
│   ├── tauri-desktop/ # downloadable desktop app
│   └── tauri-mobile/  # iOS/Android app
│
├── tools/            # Tool definitions — data, not code. SUSE-specific. Stays private.
│   ├── qr-code/
│   ├── quotes/
│   ├── email-signature/
│   ├── daily-card/        # "Day Brief" — weather/time/map (uses host.net)
│   ├── code-canvas/
│   ├── countdown-timer/
│   ├── color-palette/
│   ├── lockup/            # opentype.js text-to-path
│   ├── bag-video/
│   ├── film-burn-filter/
│   ├── chart-creator/     # SVG charts from structured data
│   ├── duotone-filter/    # two-color photo treatment
│   └── meeting-planner/   # global timezone meeting scheduler
│
├── catalog/
│   ├── tools/index.json        # tool registry
│   └── assets/
│       ├── index.json          # asset registry
│       └── suse/...            # logo, palette, etc.
│
├── schemas/          # JSON Schema for tool.json, asset entries, AssetRef
├── scripts/          # build-catalog-index.js, checksum-assets.js, validate-catalog.js
├── tests/            # engine tests
└── docs/             # this file + authoring guides + positioning
```

---

## Platform delivery model

The platform runs in three modes. All three use the same engine and the same tool files.

### Web (PWA) — primary distribution
Hosted at a SUSE-controlled URL. Works offline once the service worker has cached tools and assets. This is where most employees, vendors, and partners will use the platform. No account required — state is stored in IndexedDB per device.

The web shell is responsive from one layout. On desktop a tool is a resizable controls sidebar beside a preview stage with trackpad-native canvas navigation (Cmd/Ctrl-wheel or pinch to zoom about the cursor, Space- or middle-drag to pan, `0`/`1`/`+`/`−` keys, and a Fit/% HUD). On mobile (≤640px) the controls become a top-anchored sheet with a drag grip that snaps peek/half/full (tap toggles) over a static full-screen preview, and a floating **Render** button opens the **Export** controls in a bottom-sheet popup. Touch gets pinch-zoom and drag-pan on the preview. The render path and the export controls are identical across both — only the chrome reflows.

### Tauri desktop / mobile
Packaged native app (small footprint via Tauri). Provides full offline availability, filesystem access for CLI-dependent tools (PDF Smasher, Font Outliner), and camera access. Scheduled for mid-2026 tooling enhancement.

### CLI
`brand-tool <tool-id> [--input=value ...] --output=file.png`

Desktop users can invoke many tools from the terminal. The CLI shell loads the same engine, creates a jsdom DOM, runs the same render path, and writes the file. URL mode is the transport — CLI is not a separate implementation. This guarantees CLI and GUI outputs are identical.

```bash
brand-tool qr-code --url=https://suse.com --theme=brand --output=qr.svg
brand-tool alert --heading="CVE Alert" --copy="The SUSE Linux Team..." --output=cve.png
brand-tool                        # lists available tools
brand-tool qr-code                # lists inputs for that tool
```

---

## Tool categories

Tools are tagged with a `category` in their manifest for gallery grouping.

| Category | Shipped tools | Planned |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Day Brief, Code Canvas, Meeting Planner | Employee Image Stationery |
| `utility` | Countdown Timer, Color Palette | Unit/format converters |
| `event` | — | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | — | CVE Alert, Product Release Announcement, Blog OG Image |
| `designer` | Product Lockup, Bag Video, Film Burn Filter, Chart Creator, Duotone Filter | PDF Smasher, Font Outliner |

Tools are also classified by status: `official` (brand approved, no watermark), `community` (external contribution), `experimental` (watermarked exports). Product Lockup, Bag Video, and Film Burn Filter currently carry `experimental` status.

> Note: `category` and `status` are denormalised into `catalog/tools/index.json` (the registry the gallery reads) from each `tool.json`. The manifest is the source of truth — the index is **generated** by `npm run build:catalog` and `npm run validate:catalog` fails CI if the committed index drifts from the manifests.

---

## Architectural commitments

These decisions are settled. Changing any of them is a major undertaking — they shape every other decision in the codebase.

### 1. Declarative tools, with an imperative escape hatch

A tool is a manifest (`tool.json`) + a template (`template.html`) + optional `hooks.js`.

**The manifest declares inputs.** Not the template. Inputs are not inferred from Handlebars tokens. The manifest is the contract; the template consumes named variables by `{{id}}`.

**Hooks are optional.** Most tools are pure declarative — manifest + template is enough. Tools needing computed values (QR encoding, chart data shaping) provide `hooks.js` exposing named lifecycle functions (`onInit`, `onInput`, `beforeExport`, `afterExport`). The host loads hooks in a sandboxed `Function()` scope with only the capability bridge in reach — no `window`, no `fetch`, no globals.

This matters because: declarative tools can be authored by non-developers. If every tool were a web app, the risk note "limited skills to create/maintain workhorse templates" becomes a permanent bottleneck.

### 2. Tools and assets are data, not bundled code

The web and Tauri apps fetch tool and asset catalogs from a known URL at boot, cache them locally, and operate on whatever is there. **Adding a new event tile or seasonal asset does not require an app release.**

Asset bytes are SHA-256 checksummed to prevent CDN poisoning. Asset `id` + `version` drives cache invalidation.

### 3. The Capability Bridge is the only API tools see

Tools never touch the DOM outside their template area, never call `fetch` directly, never read the filesystem. They call versioned `host.*` methods. The bridge is defined in `engine/src/bridge/host-v1.ts`:

| Bridge API | What it does |
|---|---|
| `host.profile` | User's firstname, email, headshot, city, etc. Pre-fills inputs via `bindToProfile`. |
| `host.assets` | Catalog queries, asset resolution, host-provided picker UI. |
| `host.state` | Save / load input slots. IndexedDB on web, filesystem on Tauri, memory on CLI. |
| `host.clipboard` | Write text or image to clipboard (with platform fallbacks). |
| `host.export` | Rasterise or serialise the render target. Applies watermark for experimental tools. |
| `host.net` | Allowlisted fetch — only available if the tool declared `"network"` capability. |

The same tool runs in browser, Tauri, and headless CLI because each shell implements this interface — the tool never knows which it's in.

The bridge is versioned. Adding methods is a minor version. Removing or changing signatures is a major version bump. When v2 ships, v1 must continue to work.

### 4. Asset IDs are forever

`suse/logo/primary` is a contract. Once published:
- The ID never changes, never gets reused.
- Byte changes → bump `version` in the manifest.
- Replaced by a new asset → set `deprecated: true` and optionally `replacedBy`.
- Existing references always resolve.

This makes saved tool states and URL-shared links durable across years.

### 5. URL mode is first-class

Every input must be expressible as a URL parameter:

```
lolly.tools/#/tool/qr-code?url=https://suse.com&theme=brand
```

CLI mode is URL mode under a different transport — the CLI shell builds a URL-state object from argv and runs the **same** engine pipeline. There is one render path. CLI cannot drift from GUI because it isn't a separate implementation.

`url-mode.js` handles the round-trip (parse and serialize). Reserved params (never forwarded to the tool as inputs): `format`, `export`, `copy`, `slot`, `output`, `filename`, `_v`, `width`/`w`, `height`/`h`, `unit`, `dpi`, `full`. Asset inputs in URL mode are serialised by their `id`; the runtime resolves them via `host.assets.get()` before hydration. `width`/`height` are values in `unit` (default `px`, also `mm`/`cm`/`in`/`pt`/`pc`); with a physical unit `dpi` sets raster resolution. They set the canvas document size and pre-fill the export dimensions panel.

### 6. Storage goes through the bridge, not direct

Web shell: IndexedDB. Tauri: filesystem. CLI: in-memory. Tools see only `host.state.save(slot, data)` and `host.state.load(slot)`. `localStorage` is not used — it's too small and can't hold blobs.

Users can save multiple named edit slots per tool and return to each session later. No account creation is required; state is per-device. Because the bridge is the only seam, that per-device state is also *portable*: `shells/web/src/data-transfer.js` reads everything back out through `host.profile`/`host.state`/`host.assets` into a single `lolly-backup` zip that imports on any other install — the offline answer to "move to a new device" that doesn't need a server (full spec: `docs/data-transfer.md`). SUSE ID integration (multi-device sync) is a future milestone on top of this.

### 7. Maturity tags answer the "brand approved" risk structurally

Every tool declares `status: official | community | experimental` in its manifest. The gallery sorts by status. Experimental tools watermark their exports automatically — the watermark is applied by `host.export.render`, not by the tool, so it cannot be opted out of by a non-official tool author.

This is a structural answer to the perception risk that using any tool implies brand approval. Process answers (a review queue, SUSE ID gating) layer on top.

### 8. Tool inputs are typed via the manifest, including assets

The `asset` input type (with `filter` and `allowUpload`) is the bridge between tools and the global asset system. The host generates picker UI from this declaration — tools write zero picker code. `allowUpload: false` is the brand-enforceability lever for things like sponsorship-tile logos where only library assets are permitted.

User uploads use the same `AssetRef` shape as library assets. Tools handle them identically.

### 9. Templates are logic-less (Handlebars, not EJS)

Handlebars was chosen over EJS deliberately:
- Logic-less. Templates can be authored by non-developers.
- Safe by default. `{{x}}` HTML-escapes; `{{{x}}}` is opt-in raw.
- No arbitrary JS in templates means no per-template XSS audit surface.

Logic lives in `hooks.js` where it is explicit and reviewable. Available Handlebars helpers: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{asset ref}}`, `{{asset ref "property"}}`.

---

## What we explicitly chose not to do

- **No EJS / no arbitrary JS in templates.** XSS surface is zero. Logic lives in `hooks.js`.
- **No asset CMS.** The asset catalog is git. Updates go through PR review. No upload UI, no auth, no moderation queue. The git review _is_ the moderation.
- **No RBAC in MVP.** Public access. Brand risk managed by maturity tags + watermarks + the structural fact that all assets users see came through PR review.
- **No central database.** All user state is per-device. SUSE ID integration is on the roadmap but not a launch blocker.
- **No shared tools/engine code path.** When the engine is open-sourced, `tools/` and `assets/` stay private. The separation is enforced now (no cross-imports) so the eventual split is clean.

---

## Lifecycle, end to end

A user opens `lolly.tools/#/tool/qr-code?url=https://suse.com&theme=brand`:

1. **Boot.** Web shell opens IndexedDB, constructs the capability bridge, syncs the tool and asset catalogs (or loads from cache when offline).
2. **Route.** URL hash → `tool` view, with `qr-code` and URL params extracted.
3. **Load.** `loadTool('qr-code', fetchFile)` fetches `tool.json`, validates against the JSON Schema, fetches `template.html`, `styles.css`, and `hooks.js` source.
4. **Parse URL state.** `parseUrlState` translates URL params into initial input values. Asset refs (`?logo=suse/logo/primary`) are parsed as lightweight `{ id, _unresolved: true }` objects.
5. **Runtime.** `createRuntime(tool, host, initialValues)` builds the input model (merging profile data, defaults, and initial values), resolves asset refs via `host.assets.get()`, loads and sandboxes hooks, calls `hooks.onInit`.
6. **Render.** Shell subscribes to runtime; on every state change it receives `{ model, hydrated }`. It renders input controls from the model and writes the hydrated template HTML into `#tool-canvas`.
7. **Interact.** User types in an input → `runtime.setInput(id, value)` → constraints applied → `hooks.onInput` called → re-hydrate → re-render. The canvas updates live.
8. **Export.** User clicks Download(PNG) → `runtime.export(canvasNode, 'png')` → `host.export.render` (rasterises via dom-to-image-more; SVG/PDF go through dedicated DOM-walking vectorisers) → blob → `host.export.download`. Physical units are converted per format here (PDF → true page points, raster → pixels at DPI with a `pHYs` chunk). Authorship/provenance metadata (author, tool, source — built by `engine/src/metadata.js`) is embedded per format: PNG iTXt, JPEG EXIF, PDF info dict, SVG `<metadata>`, GIF comment. Experimental tools get a watermark inserted by the host, not the tool.

Same lifecycle in Tauri. Same lifecycle in CLI — jsdom provides the headless DOM; output goes to a file or stdout.

---

## Open-source plan

The `engine/`, `shells/`, `schemas/`, and `docs/` directories are designed to be open-sourced as a vendor-neutral, brand-tool scaffolding platform. `tools/` and `assets/` are SUSE-specific content and will move to a private repository before that happens.

The split is enforced now — there are no cross-imports from `engine/` to `tools/` or `assets/`. The eventual extraction is clean.

---

## Roadmap

| Milestone | Target | What |
|---|---|---|
| **Initial tools** | ✅ Done | QR Code, Quote Card, Email Signature, Day Brief, Code Canvas, Countdown Timer, Color Palette, Product Lockup, Bag Video, Film Burn Filter, Chart Creator, Duotone Filter, Meeting Planner — web shell live |
| **Enhance current tooling** | Mid 2026 ✅ Done  | Downloadable offline app (Tauri); additional employee and event tools; richer export pipeline (text-to-path stability, metadata, extra formats — see `plans.md`) |
| **Open source the engine** | Late 2026 ✅ Done  | Engine, shells, schemas, docs go public — not the branded tools/assets |
| **Device-to-device transfer** | ✅ Done | Portable `lolly-backup` bundle carries profile, saved sessions, uploaded images and prefs between any two installs — offline or online, no account. Forward-compatible, integrity-checked envelope (spec: `docs/data-transfer.md`) |
| **Establish formal tool roadmap** | Late 2026 | Customer reference kits, Claude design ingest, GET/URL request mode |
| **Design tokens (DTCG)** | 🚧 Colour shipped | Brand primitives as canonical [W3C Design Tokens (DTCG)](https://www.designtokens.org/TR/drafts/format/) — the format [Penpot imports/exports](https://help.penpot.app/user-guide/design-systems/design-tokens/). **Done:** colour tokens (`suse/tokens/brand`), `host.tokens` bridge, picker swatches + reference-linked values (spec: `docs/design-tokens.md`). **Next:** dimension/type tokens, Penpot import/export, user tokens in the transfer bundle (`tokens.json`) |
| **Penpot file ingest as tools** | 2027+ | Import a Penpot file and surface it *as a Lolly tool* (declarative, constraint-first), turning designs authored in Penpot into deterministic, on-brand generators |
| **MCP + Penpot extension (online-only authoring)** | 2027+ | A Penpot MCP server articulates new tools with AI — the most visual way to create deterministic templates: a brand-informed first round, perfected with a human in the loop, targeting one-shot new contexts over time. Tool *creation* is online-only; the tools it produces run anywhere |
| **RBAC + SUSE ID** | 2027+ | Gate specific tools behind SUSE ID; multi-device saved state; Google Drive ingest/export |

---

## Where the engine ends and the host begins

If you can describe it in pure data + Handlebars → **engine**.
If it touches the DOM, filesystem, network, or any browser/OS API → **host**.

The line is sharp on purpose. The engine is what gets open-sourced. Everything that knows about SUSE, specific platforms, or runtime environments stays out of it.
