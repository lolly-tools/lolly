# Lolly Tools

Powerfully reproducible assets & tools.
Deterministic, fast, free & open source. 

<img src="https://lolly.tools/info/icon-normal.webp" alt="Lolly Icon - Large green and white lollipop candy" width="350"/>
 
## What is Lolly Tools

A platform that hosts a library of small, focused tools that produce deterministic creative assets. 
Users need no design skill, vendor lock-in or internet and the platform is designed to add premium production-quality rendering certainty to variable data. 

Tools can be used via a:
* Web app - installable offline progressive web app 
* Mobile and Desktop installable packages. 
* and of course, the Command Line. 



## Why deploy Lolly in your organization? 

* Hard-coded constraints of design decisions.
* 100% Free & Open Source, Unlimited scale, No SaaS fees. 
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
- An open canvas editor
- A DAM

See `docs/positioning.md` for the full landscape comparison.

## Repository layout

```
lolly/
├── engine/           # Platform-agnostic core. The reusable, open-sourceable heart.
├── shells/           # Host implementations (web PWA, Tauri desktop/mobile, CLI)
├── tools/            # Tool definitions — data, not code. Synced to clients.
├── catalog/          # Tool and asset registries served to clients
│   ├── tools/        # index.json — tool registry
│   └── assets/       # index.json + asset files (logos, palettes, etc.)
├── schemas/          # JSON Schemas for tool.json, asset manifests, AssetRef, etc.
├── docs/             # Architecture, contracts, tool-authoring guide + the /info site generator
├── scripts/          # build-catalog-index.js, checksum-assets.js, validate-catalog.js
└── tests/            # Engine and contract tests
```

**Critical separation:** `engine/` knows nothing about SUSE. `tools/` and `catalog/assets/` are SUSE-specific content. When the engine is open-sourced, `tools/` and `catalog/assets/` stay private (or move to a private repo).

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

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
npm install

# Run the web shell
npm run dev:web

# Run a tool from CLI
npm run cli -- qr-code --url=https://suse.com --output=./qr.svg

# Validate the catalog
npm run validate:catalog
```

See `docs/authoring-tools.md` to build your first tool.

## Current tools

| Tool | Category | Status |
|---|---|---|
| Color Block | everyone | official |
| Dynamic Layout | everyone | official |
| Quote Card | everyone | official |
| Code Canvas | everyone | official |
| QR Code Generator | everyone | official |
| Day Brief | everyone | official |
| Logo | everyone | official |
| Email Signature | everyone | official |
| Chart Creator | designer | official |
| Filter: Duotone | designer | official |
| Street Map | designer | official |
| Brand Lockup | designer | official |
| Filter: Halftone | designer | official |
| Filter: Scanline | designer | official |
| Animated Ad | designer | official |
| Bag Video | designer | experimental |
| Meeting Planner | event | official |
| Event Name Badge | event | official |
| Wayfinding Signage | event | official |
| Calendar ICS | event | official |
| Color Palette | utility | official |
| Countdown Timer | utility | official |
| Strip Hidden Data | utility | official |
| Text Helper | utility | official |
| Compress PDF | utility | official |
| URL Screenshot | utility | experimental |

The `utility` "Offline Utilities" section always renders last in the gallery.

## Open-sourcing plan

The `engine/`, `shells/`, `schemas/`, and `docs/` directories are designed to be open-sourceable. 

`tools/` and `catalog/assets/` are not under the MPL and will be replaced with more example tools by end of August.

`catalog/fonts/` is a third, distinct license regime: it ships the **SUSE** and **SUSE Mono** typefaces under the [SIL Open Font License 1.1](catalog/fonts/OFL.txt) — neither the MPL nor SUSE-proprietary ("SUSE" itself is a SUSE trademark).

Bundled third-party attributions are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
