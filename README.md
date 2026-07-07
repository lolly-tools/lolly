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
- A DAM

It *does* include an open canvas — Layout Studio — but even there, colours, type
and assets conform to the brand globals, so free arrangement never becomes
off-brand output. See `docs/positioning.md` for the full landscape comparison.

## Repository layout

`lolly` is an **umbrella repo**: the app core lives here, and each shippable unit is a **git submodule** hosted under [github.com/lolly-tools](https://github.com/lolly-tools). Every submodule is mounted at its original path, so the monorepo builds and runs exactly as before.

```
lolly/                              # umbrella — engine + glue (this repo)
├── engine/                         # platform-agnostic core (the open-sourceable heart)
├── schemas/                        # JSON Schemas for tool.json, assets, AssetRef
├── scripts/                        # catalog build/validate + scripts/subrepo/ split toolkit
├── tests/                          # engine + contract tests
├── api/                            # Vercel functions (mcp, ca)
│                                   #  ── submodules (github.com/lolly-tools/*) ──
├── docs/              → lolly-docs             # architecture, guides, /info generator
├── tools/             → lolly-suse-tools       # tool definitions (data, not code)
├── catalog/           → lolly-suse-catalog     # tool + asset registries, fonts
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

**Critical separation:** `engine/` knows nothing about SUSE. `tools/` and `catalog/` hold the SUSE-specific content; the shells, services, engine and docs are MPL-2.0. Keeping each unit in its own repo lets it ship on its own cadence while the umbrella pins a known-good combination.

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

npm run dev:web                # run the web shell
npm run cli -- qr-code --url=https://suse.com --output=./qr.svg   # run a tool headlessly
npm run validate:catalog       # validate the catalog
```

See `docs/authoring-tools.md` to build your first tool, and [Development](#development) below for the submodule workflow.

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
| `tools/` | `lolly-suse-tools` |
| `catalog/` | `lolly-suse-catalog` |
| `services/mcp`, `services/ca` | `lolly-mcp-server`, `lolly-ca` |
| any `shells/*` | `lolly-web` · `lolly-cli` · `lolly-tui` · `lolly-desktop` · `lolly-mobile` · `lolly-chrome-extension` |

> ⚠️ Committing from the umbrella root does **not** capture edits made *inside* a submodule — git only sees the pointer. Commit inside the submodule, or use `loldev` (below). Editing a tool usually touches three repos: the manifest (`lolly-suse-tools`), the regenerated `catalog/tools/index.json` (`lolly-suse-catalog`), and the umbrella pointer bump.

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
loldev pull                              # pull umbrella + update all submodules
loldev dev                               # run the web shell
loldev cli -- qr-code --url=…            # run a tool headlessly
loldev help                              # every command
```

`loldev` operates on `~/Build/lolly` by default (override with `LOLLY_ROOT`). The underlying scripts live in [`scripts/subrepo/`](scripts/subrepo/) — `sync.sh`, `status.sh`, `verify.sh`, plus `migrate.sh`/`snap-history.sh` (the one-time split).

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

## Licensing & structure

Every unit now lives in its own repo under [github.com/lolly-tools](https://github.com/lolly-tools), pinned as a submodule of this umbrella (see [Repository layout](#repository-layout)).

- **Code** — `engine/`, `shells/*`, `services/*`, `docs/` — is **[MPL-2.0](LICENSE)**.
- **`tools/`** (`lolly-suse-tools`) and **`catalog/`** (`lolly-suse-catalog`) hold SUSE-specific content; see each repo's `NOTICE.md`. Licensed music (`catalog/assets/suse/music/`, PremiumBeat) ships in the catalog repo **only until 2026-08-29**, when it is removed (see `catalog/NOTICE.md`).
- **`catalog/fonts/`** ships the **SUSE** and **SUSE Mono** typefaces under the [SIL Open Font License 1.1](catalog/fonts/OFL.txt) — neither the MPL nor SUSE-proprietary ("SUSE" is a SUSE trademark).

Bundled third-party attributions are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
