# Lolly Tools

Powerfully reproducible assets & tools.
Deterministic, fast, open-source platform — bring your own brand. 

<img src="https://lolly.tools/info/icon.webp" alt="Lolly Icon - Large green and white lollipop candy" width="350"/>
 
## What is Lolly Tools

A platform that hosts a library of small, focused tools that produce deterministic creative assets. 
Users need no design skill, vendor lock-in or internet and the platform is designed to add premium production-quality rendering certainty to variable data. 

It's also your personal DAM — every logo, palette, font and upload lives in an on-device catalog, hydrated and supercharged by your design system and tools. 

Tools can be used via a:
* Web app - installable offline progressive web app 
* Mobile and Desktop installable packages. 
* and of course, the Command Line. 



## Why deploy Lolly in your organization? 

* Hard-coded constraints of design decisions.
* Free, open-source platform — the engine, every shell, the schemas and docs are MPL-2.0. Tools and assets are just data: bring your own brand content (SUSE's tool & asset packs are proprietary — see [Licensing & structure](#licensing--structure)).
* Unlimited scale, No SaaS fees. 
* Low-or-Zero server costs: Lolly uses local device compute. 
* Builds for Mac, Linux, iOS, Android, web, and the command line. 
* Huge format support: SVG · EMF · PDF · Print PDF (CMYK) · CMYK TIFF · PNG · JPEG · WebP · AVIF · ICO · WebM · MP4 · GIF · HTML · MD · TXT · JSON · CSV · ICS · VCF · ZIP 
* Print-ready output: CMYK PDF & TIFF, physical units, bleed, crop/registration marks, colour bars, and press (FOGRA/SWOP) profiles. 
* Infinite deterministic media creation.
* Works 100% Offline.
* Full command-line support.
* Save tokens, tell your model to try Lolly first!



## What this is **not**

- A general-purpose design tool

It *does* include an open canvas — Layout Studio — but even there, colours, type
and assets conform to the brand globals, so free arrangement never becomes
off-brand output. See `docs/positioning.md` for the full landscape comparison.

## Repository layout

`lolly` is an **umbrella repo**: the app core lives here, and each shippable unit is a **git submodule** hosted under [github.com/lolly-tools](https://github.com/lolly-tools). Every submodule is mounted at its original path, so the monorepo builds and runs exactly as before.

```
lolly/                              # umbrella — engine + glue (this repo)
├── engine/                         # platform-agnostic core (the open-source heart)
├── schemas/                        # JSON Schemas for tool.json, assets, AssetRef
├── scripts/                        # catalog build/validate + scripts/subrepo/ split toolkit
├── tests/                          # engine + contract tests
├── api/                            # Vercel functions (mcp, ca)
├── brands/lolly-start/             # blank starter brand (neutral tokens only) — parent-owned
├── tools/                          # VIEW: the active profile's merged tool set (gitignored)
├── catalog/                        # VIEW: the active profile's brand catalog (gitignored)
│                                   #  ── submodules (github.com/lolly-tools/*) ──
├── docs/              → lolly-docs             # architecture, guides, /info generator
├── community/         → lolly-tools            # community-safe tools (data, not code; MPL-2.0)
├── brands/suse/       → suse-lolly             # PRIVATE: SUSE tools + brand catalog
├── services/mcp/      → lolly-mcp-server       # Model Context Protocol server
├── services/ca/       → lolly-ca               # device-credential Certificate Authority
└── shells/
    ├── web/           → lolly-web              # installable PWA
    ├── cli/           → lolly-cli              # command line
    ├── tui/           → lolly-tui              # terminal UI
    ├── tauri-desktop/ → lolly-desktop          # macOS / Linux / Windows
    ├── tauri-mobile/  → lolly-mobile           # iOS / Android
    └── chrome-extension/ → lolly-chrome-extension
```

**Critical separation:** `engine/` knows nothing about SUSE. Brand-specific content lives in **brand packs** (`brands/suse` — private; `brands/lolly-start` — the blank starter brand), brand-agnostic tools in `community/`; the shells, services, engine and docs are MPL-2.0. The repo-root `tools/` and `catalog/` paths every script and shell consumes are **profile views** built by `scripts/use-profile.ts` from `profiles.json` — switch brands with `npm run profile:suse` / `npm run profile:start`. Keeping each unit in its own repo lets it ship on its own cadence while the umbrella pins a known-good combination.

## Architectural commitments

These decisions are settled. Changing any of them is a major undertaking:

1. **Declarative tools.** A tool is a manifest + template + assets. Inputs are declared in the manifest, not inferred from template tokens. `hooks.js` is an optional escape hatch for tools that need imperative behavior (chart.js rendering, QR encoding).

2. **Tools and assets are data, not bundled code.** Clients sync them from a signed manifest URL. New tools and assets don't require app updates.

3. **Capability bridge.** Tools never touch the filesystem, network, or DOM-outside-template directly. They call a versioned `host.*` API. This is what makes the same tool work in browser, Tauri, and CLI.

4. **Stable asset IDs forever.** `suse/logo/primary` is a contract. Never reuse, never rename. Version in the manifest, never in the path.

5. **URL mode is first-class.** Every input must be expressible as URL params. CLI mode = hidden browser + URL mode + file output. One render path.

6. **Storage via the bridge.** Tools call `host.state.save()` / `host.state.load()`. The bridge picks IndexedDB (web), filesystem (Tauri), or memory (CLI). Tools never know which.

7. **Maturity tags.** Every tool declares `status: official | community | experimental`. Experimental tools watermark their exports. This is the structural answer to the "brand approved by default" risk.

## Getting started

Because the shippable units are submodules, **clone recursively**:

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
cd lolly
# already cloned non-recursively? → git submodule update --init --recursive

npm install                    # workspaces need every submodule's package.json — init submodules FIRST
                               # (postinstall picks a content profile automatically — see below)

npm run dev:web                # run the web shell
npm run cli -- qr-code --url=https://suse.com --output=./qr.svg   # run a tool headlessly
npm run validate:catalog       # validate the catalog
```

**Content profiles.** `tools/` and `catalog/` are gitignored *views* assembled from the mounted packs (`profiles.json`): the private `brands/suse` pack (skipped automatically on clone if you don't have access — it's `update = none`) plus the public `community/` tools. Without SUSE access you land on the blank **lolly-start** brand and everything still builds and runs. Switch explicitly:

```bash
npm run profile          # show the active profile + what's available
npm run profile:suse     # SUSE brand pack (needs: git submodule update --init --checkout brands/suse)
npm run profile:start    # blank starter brand — community tools only
```

See `docs/authoring-tools.md` to build your first tool, and [Development](#development) below for the submodule workflow. A new brand pack can be generated from design tokens with `npm run ingest:brand` (DTCG / Tokens Studio / Penpot exports).

## Development

Lolly is an umbrella repo composed of **git submodules** (see [Repository layout](#repository-layout)). That changes two things: how you clone, and where each change is committed.

**Clone / update**

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
git submodule update --init --recursive     # in an existing clone — run BEFORE npm install
```

Each submodule is checked out on its own `main`, tracking its repo under `github.com/lolly-tools/*`.

**Where your changes go** — the umbrella pins a specific commit of each submodule, so a change is committed to *the repo that owns the file*, then the umbrella records the new pointer:

| You edit… | Commits to |
|---|---|
| `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, root files | the umbrella (`lolly`) |
| `docs/` | `lolly-docs` |
| `community/` (or a community tool via the `tools/` view) | `lolly-tools` |
| `brands/suse/` (or SUSE tools/catalog via the views) | `suse-lolly` (private) |
| `brands/lolly-start/`, `profiles.json` | the umbrella (`lolly`) |
| `services/mcp`, `services/ca` | `lolly-mcp-server`, `lolly-ca` |
| any `shells/*` | `lolly-web` · `lolly-cli` · `lolly-tui` · `lolly-desktop` · `lolly-mobile` · `lolly-chrome-extension` |

> ⚠️ Committing from the umbrella root does **not** capture edits made *inside* a submodule — git only sees the pointer. Commit inside the submodule, or use `loldev` (below). The `tools/` and `catalog/` views are symlinks into the packs, so editing through them lands in the right pack checkout automatically. Editing a SUSE tool touches two repos (`suse-lolly` + umbrella pointer); a community tool touches three (`lolly-tools` manifest, `suse-lolly` regenerated index, umbrella pointer).

**`loldev` — one command to ship a change.** A helper that does the multi-repo dance for you. Install it on your PATH:

```bash
ln -sf "$PWD/scripts/subrepo/loldev" /usr/local/bin/loldev   # or any dir on your PATH
```

```bash
loldev gtg -m "replaced suse logomark"   # build catalog → commit + push every changed
                                         # submodule to its repo → commit + push the umbrella
loldev gtg                               # same, with an empty commit message
loldev ship -m "…"                       # gtg, THEN deploy to Vercel prod (lolly.tools); --preview for a preview URL
loldev status                            # what's dirty / ahead, per repo
loldev profile suse|lolly-start          # switch the content profile (rebuilds tools/ + catalog views)
loldev pull                              # pull umbrella + update all submodules + refresh views
loldev dev                               # run the web shell
loldev cli -- qr-code --url=…            # run a tool headlessly
loldev help                              # every command
```

`loldev` operates on `~/Build/lolly` by default (override with `LOLLY_ROOT`). The underlying scripts live in [`scripts/subrepo/`](scripts/subrepo/) — `sync.sh`, `status.sh`, `verify.sh`, plus `migrate.sh`/`snap-history.sh` (the one-time split).

## Current tools

The SUSE catalog ships **46 tools** today — 45 listed in the gallery, plus one unlisted helper (Asset Export, the render-anything embed endpoint). Generated from `catalog/tools/index.json`:

| Tool | What it makes |
|---|---|
| 3D | Load a 3D model into a lit scene, orbit and pose the camera, and render a still or a turntable animation. |
| Animated Ad | Build animated ads from layered scenes for any standard size. |
| Bag Video | An animated, on-brand video for bag visuals. |
| Brand Lockup | Official SUSE logo lockups — chameleon, wordmark and a name. |
| Calendar ICS | Turn event details into a calendar (.ics) file for any calendar app. |
| Carousel Maker | Design a multi-page carousel on one canvas — set 1–6 same-size pages, drop objects onto each page, export an image sequence or a multi-page PDF. |
| Chart Creator | On-brand charts from your data — bar, donut, pie or stacked. |
| Code Canvas | Turn code snippets into clean, syntax-highlighted, shareable images. |
| Color Block | Colour blocks — text, image, logo — auto-arranged into a grid. |
| Color Palette | Browse SUSE brand colors — click a swatch to copy it. |
| Compress PDF | Shrink a PDF by recompressing its images — on your device. |
| Countdown Timer | A focused countdown with a live progress ring. Click to pause. |
| D3 Chart Studio | Powerful data-driven charts with D3 — paste a table and it charts itself. Bars, lines, areas, scatter, pie, radar, treemap, heatmap and more, on-brand and vector-clean. |
| Day Brief | Quote of the day with live weather, time and a map for any city. |
| Diagram Builder | Org charts, flowcharts, timelines and more — from cards, text, Mermaid or CSV. |
| Doc Studio | Write a multi-page document on the canvas — rich text, headings, tables and inserted Lolly renders that flow onto pages and export as a PDF. |
| Dynamic Layout | A do-anything layout that recomposes around whatever you add, at any size. |
| Email Signature | An on-brand SUSE email signature, ready to paste into any client. |
| Event Name Badge | Conference name badges with a colour-coded role and optional QR. |
| Filter: Duotone | A two-color duotone for any photo — shadows one color, highlights another. |
| Filter: Halftone | Vector halftone from any photo — dots sized by brightness. |
| Filter: Pixel Stretch | Smear a column of pixels across a photo from a threshold line. Works live. |
| Filter: Posterize Bitmap | Trace any photo into flat, screenprint-style vector colour separations. |
| Filter: Scanline | Horizontal 'infinity lines' scanline vector effect from any photo |
| Filter: Voronoi Cells | Shatter any photo into a Voronoi cell mosaic — each cell filled with the nearest colour, as flat vector. |
| Flow Chart | Build flow charts on an open canvas — drag cards, connect them, and the lines route and stick to the boxes. |
| Layout Studio | Free-form layouts on an open canvas. |
| Logo | Place the SUSE logo — it auto-picks the right variant and exports vector. |
| Logo Lockup: Grid (NASCAR) | Arrange a pile of logos into a clean, even sponsor grid — the “NASCAR” wall. |
| Logo Lockup: Partner | The SUSE logo beside a partner's, with a divider between — light or dark. |
| Lottie Ad | Build animated ads from layered scenes, each carrying a Lottie motion asset, for any standard size. |
| Meeting Planner | Plan a global meeting and see the time for every teammate's timezone. |
| Multi-Page PDF | Build a multi-page PDF — a cover, flowing content blocks, and a back page. |
| Pose Geeko | Pose the SUSE Geeko with sliders — eyes, blink and limbs. No animation, just a still you can dial in and export print-ready. |
| QR Code Generator | QR codes for any URL, with full color and style control. |
| Quote Card | On-brand quote cards for social posts and slides. |
| Record | Design your own top and tail cards, then record a clip and Lolly wraps them around it automatically. |
| Street Map | Clean vector street-block maps of any city. Works offline. |
| Strip Hidden Data | Reveal and remove hidden metadata from images and PDFs — on your device. |
| Text Helper | Format, decode, hash and de-identify text — JSON, JWT and more. |
| Top & Tail Video | Record a clip in any orientation, then auto-wrap it with branded intro and outro bookends, a lower-third, and a music bed. |
| URL Screenshot | Any web page, at any scroll-depth, with custom CSS |
| Voice Recorder | Record a voice note with a live level meter and gentle coaching, then save it as MP3. |
| Wayfinding Signage | Directional event signs — destinations, each with an arrow. Print-ready. |
| Web Icon Maker | Favicon and app-icon maker — a multi-size .ico, plus PNG and SVG. |

The `utility` "Offline Utilities" section always renders last in the gallery.

## Licensing & structure

Every unit now lives in its own repo under [github.com/lolly-tools](https://github.com/lolly-tools), pinned as a submodule of this umbrella (see [Repository layout](#repository-layout)).

- **Code** — `engine/`, `shells/*`, `services/*`, `docs/` — is **[MPL-2.0](LICENSE)**.
- **`tools/`** (`lolly-suse-tools`) and **`catalog/`** (`lolly-suse-catalog`) hold SUSE-specific content; see each repo's `NOTICE.md`. Licensed music (`catalog/assets/suse/music/`, PremiumBeat) ships in the catalog repo **only until 2026-08-29**, when it is removed (see `catalog/NOTICE.md`).
- **`catalog/fonts/`** ships the **SUSE** and **SUSE Mono** typefaces under the [SIL Open Font License 1.1](catalog/fonts/OFL.txt) — neither the MPL nor SUSE-proprietary ("SUSE" is a SUSE trademark).

Bundled third-party attributions are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
