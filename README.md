# Lolly Tools

Powerfully reproducable asset & tools.
Deterministic, fast, free & open source. 

> **Status:** Working platform. Web shell live; 16 tools shipped; engine, CLI, and catalog all functional.

 

## What this is

A platform that hosts a library of small, focused tools that produce on-brand creative assets without requiring design skill or vendor lock-in. Tools run online, offline, and from the command line through the same engine.

## Why deploy Lolly in your organization? 

* Hard-coded constraints of design decisions.
* 100% Free & Open Source, Unlimited scale, No SaaS fees. 
* Low-or-Zero server costs: Lolly uses local device compute. 
* Builds for Mac, Linux, iOS, Android, and web. 
* Huge media support: SVG, PDF, PNG, JPEG, WEBP, AVIF, WEBM, MP4, GIF, TXT, HTML, MD 
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
├── docs/             # Architecture, contracts, tool-authoring guide
├── scripts/          # validate-catalog.js
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
| QR Code Generator | everyone | official |
| Quote Card | everyone | official |
| Email Signature | everyone | official |
| Day Brief | everyone | official |
| Code Canvas | everyone | official |
| Meeting Planner | everyone | official |
| Dynamic Layout | everyone | official |
| Logo | everyone | official |
| Chart Creator | designer | official |
| Duotone Filter | designer | official |
| Product Lockup | designer | experimental |
| Bag Video | designer | experimental |
| Film Burn Filter | designer | experimental |
| Color Palette | utility | official |
| Countdown Timer | utility | official |
| URL Screenshot | utility | experimental |

## Open-sourcing plan

The `engine/`, `shells/`, `schemas/`, and `docs/` directories are designed to be open-sourceable. 

`tools/` and `catalog/assets/` are not under the MPL and will be replaced with more example tools by end of August
