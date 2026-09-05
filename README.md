# Lolly Tools

Powerfully reproducible assets & tools.
Deterministic, fast, open-source platform - bring your own brand. 

<img src="icon.svg" alt="Lolly Icon - Large green and white lollipop candy" width="350"/>

**Try it now.** [lolly.tools](https://lolly.tools) runs in the browser and installs as an app. Nothing you make ever leaves your device without your say. [lolly.art](https://lolly.art) is the same app on a blank brand. Desktop, mobile and command-line builds are on the [releases page](https://github.com/lolly-tools/lolly/releases).

**Read first.** The platform is explained at [lolly.tools/info](https://lolly.tools/info/), with one door each for [creators](https://lolly.tools/info/create/creators.html), [builders](https://lolly.tools/info/build/builders.html) and [operators](https://lolly.tools/info/operate/operators.html), a [quickstart](https://lolly.tools/info/start/quickstart.html), and the [trust pages](https://lolly.tools/info/trust/trust.html) that back each claim with the mechanism that enforces it.

> **We built Lolly for ourselves.** SUSE needed thousands of on-brand files, each with its name sealed inside, made without handing anything to outside services. So we built a tool that does all of it on the device, and released it as open source, like everything else we make. We keep maintaining it because we use it every day. **There is no obligation:** everything here works with or without us.

## What is Lolly Tools

A platform that hosts a library of small, focused tools that produce deterministic creative assets. 
Users need no design skill, no vendor lock-in and no internet to render, and the platform is designed to add premium production-quality rendering certainty to variable data. 

It's also your personal DAM - every logo, palette, font and upload lives in an on-device catalog, hydrated and supercharged by your design system and tools. 

Tools can be used via a:
* Web app - installable offline progressive web app 
* Mobile and Desktop installable packages. 
* and of course, the Command Line - plus a full-screen terminal UI (TUI). 



## Why deploy Lolly in your organization? 

* Hard-coded constraints of design decisions.
* Free, open-source platform - the engine, every shell, the schemas and docs are MPL-2.0. Tools and assets are just data: bring your own brand content (SUSE's tool & asset packs are proprietary - see [Licensing & structure](#licensing--structure)).
* Unlimited scale, No SaaS fees. 
* Low-or-Zero server costs: Lolly uses local device compute. 
* Builds for Mac, Windows, Linux, iOS, Android, web and the command line. 
* Huge format support - **37 in, 40 out** (21 round-trip). Export: SVG · EPS · CMYK EPS · EMF · DXF · PDF · Print PDF (CMYK) · PPTX · PNG · Animated PNG · JPEG · WebP · Animated WebP · AVIF · TIFF · CMYK TIFF · ICO · **PSD** · EXR · Radiance HDR · MP4 · WebM · GIF · Animated SVG · MP3 · M4A · WAV · Opus · HTML · MD · TXT · CSV · JSON · ICS · VCF · ZIP. Import adds layered **PSD · PSB · XCF**, HEIC, MOV · Lottie, GLB · glTF, audio & tracker (OGG · FLAC · MIDI · MOD) and live designs from Illustrator · InDesign · Figma · Penpot. EXR and Radiance HDR are floating-point HDR masters (via `host.codec`). Plus **design tokens & palettes** - import DTCG and Tokens Studio; export DTCG · ASE · GPL · CSS variables. 
* Print-ready output: CMYK PDF & TIFF, physical units, bleed, crop/registration marks, colour bars and press (FOGRA/SWOP) profiles. 
* Infinite deterministic media creation.
* Renders and exports 100% offline - the shells need no network at render time. (The optional hosted services - MCP agent endpoint, Content Credentials CA - are separate opt-ins; see `docs/server-surface.md`.)
* Full command-line support.
* Save tokens, tell your model to try Lolly first!



## What this is **not**

- A general-purpose design tool

It *does* include an open canvas - the Design tool - but even there, colours, type
and assets conform to the brand globals, so free arrangement never becomes
off-brand output. See `docs/positioning.md` for the full market comparison.

## Repository layout

`lolly` is an **umbrella repo**: the app core lives here, and each shippable unit is a **git submodule** hosted under [github.com/lolly-tools](https://github.com/lolly-tools). Every submodule is mounted at its original path, so the monorepo builds and runs exactly as before.

```
lolly/                              # umbrella: engine + glue (this repo)
├── engine/                         # platform-agnostic core (the open-source heart)
├── packages/                       # @lolly-tools/core (tool-author SDK, the HostV1 contract) + node-shell
├── schemas/                        # JSON Schemas for tool.json, assets, AssetRef
├── scripts/                        # catalog build/validate + scripts/subrepo/ split toolkit
├── tests/                          # engine + contract tests
├── api/                            # Vercel functions (mcp, ca)
├── brands/lolly-start/             # blank starter brand (neutral tokens only), parent-owned
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

**Critical separation:** `engine/` knows nothing about SUSE. Brand-specific content lives in **brand packs** (`brands/suse` - private; `brands/lolly-start` - the blank starter brand), brand-agnostic tools in `community/`; the shells, services, engine and docs are MPL-2.0. The repo-root `tools/` and `catalog/` paths every script and shell consumes are **profile views** built by `scripts/use-profile.ts` from `profiles.json` - switch brands with `npm run profile:suse` / `npm run profile:start`. Keeping each unit in its own repo lets it ship on its own cadence while the umbrella pins a known-good combination.

## Architectural commitments

These decisions are settled. Changing any of them is a major undertaking:

1. **Declarative tools.** A tool is a manifest + template + assets. Inputs are declared in the manifest, not inferred from template tokens. `hooks.js` is an optional escape hatch for tools that need imperative behavior (chart.js rendering, QR encoding).

2. **Tools and assets are data, not bundled code.** Clients sync them from a signed manifest URL. New tools and assets don't require app updates.

3. **Capability bridge.** Tools never touch the filesystem, network or DOM-outside-template directly. They call a versioned `host.*` API. This is what makes the same tool work in browser, Tauri and CLI.

4. **Stable asset IDs forever.** `suse/logo/primary` is a contract. Never reuse, never rename. Version in the manifest, never in the path.

5. **URL mode is first-class.** Every input must be expressible as URL params. CLI mode = headless DOM (jsdom) + URL mode + file output. One render path.

6. **Storage via the bridge.** Tools call `host.state.save()` / `host.state.load()`. The bridge picks IndexedDB (web), filesystem (Tauri) or memory (CLI). Tools never know which.

7. **Maturity tags.** Every tool declares `status: official | community | experimental`. Experimental tools watermark their exports. This is the structural answer to the "brand approved by default" risk.

## Getting started

**Fresh macOS or openSUSE machine? One command does it all:**

```bash
git clone https://github.com/lolly-tools/lolly.git && cd lolly && ./setup.sh
```

`./setup.sh` installs the prerequisites (git, Node), checks out the submodules, runs `npm install` and builds a content profile - then tells you what to run next. SUSE devs add `--suse` to mount the private brand pack. Full details, the manual path and troubleshooting are in **[INSTALL.md](INSTALL.md)**.

Prefer to do it by hand? Because the shippable units are submodules, **clone recursively**:

```bash
# Prerequisite: Node >=22.18 or >=24 (see .nvmrc). Older Node fails npm install -
# the scripts run TypeScript directly via native type-stripping. INSTALL.md has the table.
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
cd lolly
# already cloned non-recursively? → git submodule update --init --recursive

npm install                    # workspaces need every submodule's package.json, so init submodules FIRST
                               # (postinstall picks a content profile automatically; see below)

npm run dev:web                # run the web shell → then open http://localhost:5173
npm run cli -- qr-code --url=https://suse.com --output=./qr.svg   # run a tool headlessly
npm run validate:catalog       # validate the catalog
```

Once it is running, **[docs/make-something.md](docs/make-something.md)** walks a first render in about 60 seconds (no account, nothing to configure), and **[docs/quickstart.md](docs/quickstart.md)** covers making Lolly wear your own brand.

**Content profiles.** `tools/` and `catalog/` are gitignored *views* assembled from the mounted packs (`profiles.json`): the private `brands/suse` pack (skipped automatically on clone if you don't have access - it's `update = none`) plus the public `community/` tools. Without SUSE access you land on the blank **lolly-start** brand and everything still builds and runs. Switch explicitly:

```bash
npm run profile          # show the active profile + what's available
npm run profile:suse     # SUSE brand pack (needs: git submodule update --init --checkout brands/suse)
npm run profile:start    # blank starter brand: community tools + neutral tokens
```

See `docs/authoring-tools.md` to build your first tool, and [Development](#development) below for the submodule workflow. Writing a tool without cloning the platform? `npm i -D @lolly-tools/core` installs the tool-author SDK from npm: the `HostV1` contract types, the manifest validator and a mock host for testing hooks headlessly (see [`packages/core/README.md`](packages/core/README.md)). A new brand pack can be generated from design tokens with `npm run ingest:brand` (DTCG / Tokens Studio / Penpot exports).

## The CLI

`lolly` runs any tool from the terminal through the same engine and the same render path as the web shell - it *is* URL mode under a different transport, so `--url=x` is the value the app reads from `?url=x`. That makes it the build-pipeline, CI and scripting surface: generate an OG card at build time, fan a CSV out into 400 badges, render-check the whole catalog as a gate.

```bash
npm run --silent cli -- qr-code --url=https://suse.com --export=png > qr.png
```

Every export carries Content Credentials by default, signed on-device. To sign as **you** - so a recipient who pins your root reads *Verified* with your address on it rather than an anonymous signer - point it at your own key and certificate chain:

```bash
npm run --silent cli -- qr-code --url=https://suse.com --output=./qr.svg \
  --sign-key=~/.config/lolly/signing-key.pem --sign-cert=./signing-chain.pem
```

Full command surface in [`docs/cli.md`](docs/cli.md); the setup path from a clean machine to a working, trusted signing identity is [`docs/cli-signing.md`](docs/cli-signing.md).

## Development

> **New contributor?** Start at **[CONTRIBUTING.md](CONTRIBUTING.md)** - it routes you through the recursive clone, content profiles, the `tools/`/`catalog/` symlink-view trap, which repo owns which file and the commands to run before a PR. Auditors and anyone touching a parser or a crypto module should read **[docs/threat-model.md](docs/threat-model.md)** and **[docs/parser-inventory.md](docs/parser-inventory.md)**.

Lolly is an umbrella repo composed of **git submodules** (see [Repository layout](#repository-layout)). That changes two things: how you clone, and where each change is committed.

**Clone / update**

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly.git
git submodule update --init --recursive     # in an existing clone, run BEFORE npm install
```

Each submodule is checked out on its own `main`, tracking its repo under `github.com/lolly-tools/*`.

**Where your changes go** - the umbrella pins a specific commit of each submodule, so a change is committed to *the repo that owns the file*, then the umbrella records the new pointer. The full path-to-repo ownership table lives in **[CONTRIBUTING.md section 4](CONTRIBUTING.md#4-where-your-changes-go)**, which is the single source of truth for it.

> ⚠️ Committing from the umbrella root does **not** capture edits made *inside* a submodule - git only sees the pointer. Commit inside the submodule, or use `loldev` (below). The `tools/` and `catalog/` views are symlinks into the packs, so editing through them flows to the right pack checkout automatically. Editing a SUSE tool touches two repos (`suse-lolly` + umbrella pointer); a community tool touches three (`lolly-tools` manifest, `suse-lolly` regenerated index, umbrella pointer).

**`loldev` - one command to ship a change.** A helper that does the multi-repo dance for you. Install it on your PATH:

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

`loldev` operates on `~/Build/lolly` by default (override with `LOLLY_ROOT`). The underlying scripts live in [`scripts/subrepo/`](scripts/subrepo/) - `sync.sh`, `status.sh`, `verify.sh`, plus `migrate.sh`/`snap-history.sh` (the one-time split).

## Current tools

<!-- tools-table:start -->
The Lolly Start (blank brand) catalog ships **61 tools** today - 60 listed in the gallery, plus one unlisted helper (Asset Export). Generated from `catalog/tools/index.json` by `npm run build:readme-tools`:

| Tool | What it makes |
|---|---|
| 3D | Load a 3D model into a lit scene, orbit and pose the camera, and render a still or a turntable animation. |
| Agenda | A conference programme from one table - a chronological list, a multi-track timetable, or a now-and-next screen for the door - and a real .ics of every session. |
| Annotate | Mark up your own screenshot on your device - arrows, boxes, numbered steps, callouts, highlighter and a spotlight dim. |
| Audiogram | Turn a voice clip or song into a branded video that actually moves with the sound - bars, spectrum, ring, ridgeline or scope, ready for social. |
| Backdrop | Living backdrops from your design system's colours: fifteen GPU effects - metaballs, god rays, neuro noise, warped fields, orbiting dots and more. Tune, freeze the exact moment you want, and export stills or motion loops for heroes, walls and meeting backgrounds. |
| Booklet | Build a multi-page PDF - a cover, flowing content blocks, and a back page. |
| Booth | Dress a 3D event booth with sponsor artwork. Click any panel to drop an image on it, pick a booth design, and render a still or a turntable for a sponsor pitch. |
| Calendar | Turn event details into a calendar (.ics) file for any calendar app. |
| Captions | Subtitles for a clip - turn its speech into text on device or drop in an SRT/VTT file, style the cues, and export burned-in frames plus clean .srt and .vtt sidecars. |
| Certificate | Completion and award certificates from the active brand - one name at a time, or a whole roster from a CSV in Bulk from rows. |
| Chart | Charts from first paste to advanced visualisation - explained data recommendations, explicit field mapping, 32 classic vector families, sixteen statistical and editorial articulations, real-z 3-D scenes, cinematic flights, deterministic motion, accessible descriptions and styles compiled from the active brand profile. |
| Claim | Claim your name on any media you've already made - image, PDF, video or audio. Stamp your author, copyright and licence as Content Credentials (a durable raster Imprint too), preserving any credential already inside the file - all on your device, before you upload it anywhere. |
| Clean | Clean a voice recording, trim edge silence and set its loudness on your device. |
| Compress | Shrink a PDF by recompressing its images - on your device. |
| Contrast | Check a text and background pair, or every pairing in your brand palette, against WCAG 2.1 and APCA, and see how it reads to colour-blind viewers. |
| Convert Font | Convert a font between TrueType, OpenType and WOFF - on your device. |
| Convert Image | Turn HEIC, TIFF or any photo into WebP, JPEG or PNG - on your device. |
| Countdown | A focused countdown with a live progress ring. Click to pause. |
| Darkroom | A pro photo-grading darkroom: film looks, third-party .cube LUTs, brand-seeded colour treatments and finishing texture - then bake your look as a LUT any editor can use. Opens a Photoshop or GIMP file as layers too: position, blend and hide each one, grade the composite, and export flat images or a layered PSD. |
| Design | An open canvas for free arrangement - text, images, shapes and live renders from your other Lolly tools, all held to your brand. |
| Diagrams | Org charts, flowcharts, timelines and more - from cards, text, Mermaid, DOT or CSV. |
| Doc Studio | Write a multi-page document on the canvas - rich text, headings, tables and inserted Lolly renders that flow onto pages and export as a PDF. |
| Filter | One tool for photo effects: pick halftone, scanline, posterize, voronoi, dither or ASCII art (vector) or duotone, pixel-stretch, imperfections or glitch (raster). Brand overlays, live camera, and exports to as many formats as each effect supports. |
| Finishes | Preview foil, spot UV, emboss and soft-touch finishes on your artwork - then export the printer-ready spot plate. The on-screen sheen is presentation only; the plate is the real deliverable your print house needs. |
| Flythrough | Fly a real 3D camera through a screenshot. The picture lifts into layers at real depth; big shapes extrude into solid objects; a timeline of poses animates the whole move - depth, opacity, perspective, extrusion, tilt, rotate, scale and the camera flight - then loops it home. Add, drag and reorder poses. Export as video. |
| Frame | Drop in a screenshot and get it framed, padded and shadowed on a brand backdrop. |
| Gradient | Five ways to build a gradient from your brand swatches: soft radial Blend, a real Coons-patch mesh as crisp SVG (Subdivide) or a smooth raster (Mesh), freeform Warp points, and the animated Flow waves. Drag everything right on the canvas; export stills or join-free video loops. |
| Growth | Differential growth: a line that repels itself until it folds into coral. Seed it from a ring, a burst, your headline's letterforms or your logo, and export the result as real, plotter-ready SVG paths. |
| Icon | Favicon and app-icon maker - a multi-size .ico, PNG and SVG, or the whole app kit as one zip. |
| Jump | A one-link landing page: your links, heading, portrait and colours on an expressive page - and the whole page lives inside the link you share. |
| Link Card | Paste a link, get a branded social card - title, description, site chip and a thumbnail, at Open Graph, square or summary size. |
| Logo Wall | Arrange a pile of logos into a clean, even sponsor grid - the “NASCAR” wall. |
| Lottie Ad | Build animated ads from layered scenes, each carrying a Lottie motion asset, for any standard size. |
| Markdown Slides | Turn Markdown or a JSON spec into a native, editable PowerPoint deck - real text, bullets, tables and brand theme - in seconds. The fast text-first path to a deck; reach for the Design canvas when you want to lay slides out by hand or animate them. Charts and diagrams come from your other Lolly tools. Exports .pptx (editable), plus PDF and PNG. |
| Pages | Reorder, rotate, extract, delete, merge or split PDF pages on your device. |
| Palette Lab | Grow a palette from one seed colour - harmony accents, perceptual OKLab ramps and WCAG/APCA readability badges, with DTCG tokens and CSV export. |
| Print Sheet | Lay one design - or a whole pile of them - out n-up on A4, Letter or A3, across as many pages as it takes, with crop marks in the margin. |
| Prompt Card | Typeset a long prompt into one compact, legible image for a multimodal model - image input is often cheaper than the same words as text tokens. |
| QR Code | Scannable codes of every kind: QR, Micro QR, Data Matrix, Aztec and PDF417 for links, contacts, Wi-Fi, events, locations and text - plus retail and logistics barcodes from EAN-13 and Code 128 to ITF-14, GS1-128, GS1 DataBar and MaxiCode. |
| Rebrand | Upload a PowerPoint deck and snap its colours and fonts to your brand - rebuilt on your device, nothing uploaded. |
| Record | Design your own top and tail cards, then record a clip and Lolly wraps them around it automatically. |
| Redact | Black out sensitive content by rebuilding the file, then verify the output before it downloads, all on your device. |
| Sandbox | Paste HTML, CSS, JS - or a JSX/TypeScript component - and watch it run in a private, offline sandbox. Perfect for previewing code from an AI assistant. |
| Scan | Read QR codes and barcodes on-device, with nothing sent to any cloud. A reader, not an opener: it decodes, classifies and explains what a code carries - links, Wi-Fi, contacts, product codes - and lets you act deliberately. Copy is always the first action; opening, joining or adding is an explicit, informed tap. |
| Screen Capture | Screenshot or record your whole screen, a window, or a browser tab. Drag on the canvas to crop - the export stays the exact pixels you captured. |
| Sign | Place your signature on a PDF, optionally add a Content Credential and lock the result. |
| Signature | Sign with a finger, stylus or mouse and get a clean signature on transparency - SVG or PNG, no scanner, no photo of a bit of paper. |
| Snippet | Turn code snippets into clean, syntax-highlighted, shareable images. |
| Spatial Photo | Drop in one photo and move a camera through it: depth is read on your device, so a flat picture becomes a scene with real parallax, atmosphere and focus. |
| Stationery | Business cards, letterhead and compliments slips from your brand - each piece sized to its real print trim, ready as a print PDF. |
| Street Map | Clean vector street-block maps of any city. Works offline. |
| Strip Hidden Data | Reveal and remove hidden metadata from images and PDFs - on your device. |
| Synth | A visual instrument you play. Four scenes run live on the GPU: fluid ink, a particle swarm that flies at your headline or your logo, a feedback field, and your own camera. Every colour comes out of your brand palette, and the picture moves to your pointer, to a music track, and to a MIDI controller. Export a still or a join-free loop. |
| Text Helper | Format, decode, hash and de-identify text - JSON, JWT and more. |
| Trim | Cut an audio or video clip, change its container, mute it or extract its audio on your device. |
| URL Screenshot | Any web page, at any scroll-depth, with custom CSS |
| Voice Recorder | Record a voice note with a live level meter and gentle coaching, then save it as MP3. |
| Wayfinding | Directional event signs - destinations, each with an arrow. Print-ready. |
| Wordmark | Type a word, get a pure-path vector wordmark in your brand font - recipients never need the font installed. |
| Work Avatar | A round profile photo with a treatment and a ring of text - the campaign badge for LinkedIn and every other place your face goes, in your brand's colours and face. |
<!-- tools-table:end -->

The `utility` "Offline Utilities" section always renders last in the gallery.

## Licensing & structure

Every unit now lives in its own repo under [github.com/lolly-tools](https://github.com/lolly-tools), pinned as a submodule of this umbrella (see [Repository layout](#repository-layout)).

- **Code** - `engine/`, `shells/*`, `services/*`, `docs/` - is **[MPL-2.0](LICENSE)**.
- **Tool content ships as brand packs.** `community/` (public [`lolly-tools`](https://github.com/lolly-tools/lolly-tools)) holds the brand-agnostic tools; `brands/suse/` (private `suse-lolly`) holds the SUSE tools and catalog - including its licensed PremiumBeat music, which stays private with the pack. The repo-root `tools/` and `catalog/` are gitignored profile *views* assembled from those packs; see each pack's `NOTICE.md`.
- **Fonts** ship inside each brand pack under the SIL Open Font License 1.1 - the SUSE pack carries the **SUSE** and **SUSE Mono** typefaces (neither the MPL nor SUSE-proprietary; "SUSE" is a SUSE trademark). They appear at `catalog/fonts/` in a built profile view.

Bundled third-party attributions are listed in [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).
