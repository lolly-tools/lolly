# Overview

![Lolly Icon - Large green and white lollipop candy](/info/icon.svg)

This document captures the purpose, structure and architectural decisions for the Lolly platform. It reflects both the product vision and the current state of the codebase.

> **Status:** Lolly is an internal prototype in a **closed pilot that hasn't completed**. The engine is deterministic and internally consistent, but the product is early - SUSE is customer number one - and its cryptography and file-parsing engines are currently undergoing SUSE's strict infrastructure hardening, preparing for enterprise scale (we're really good at this). Read the architecture below as design intent under test, not a finished, certified product. See [Adoption & Governance](/info/adoption-governance.html#status) for how the pilot is run and measured.

> **How to read this page.** It carries two kinds of material, in order. The first half is
> **why this exists**: the problem, the positioning and the lifecycle a single asset travels
> through. From [The big picture](#the-big-picture-how-the-layers-fit) onward it is
> **how the layers fit**: the architecture document for contributors, covering the engine/shell/pack
> separation, the repository layout, the delivery targets and the commitments that constrain every
> change to the platform. If you are here to change the codebase rather than to understand the
> product, start at the big picture.
>
> Two companions go deeper than this page does. [`engine/README.md`](../engine/README.md) in the
> repository is the module-by-module map of the engine, with a generated table of every module and
> what it parses or writes. [Threat Model & Trust Boundaries](/info/threat-model.html)
> is the same architecture read as trust boundaries, and it is the right page for any question about
> what the engine treats as untrusted.

---

## Why this exists

Teams face a recurring problem: repeatable creative and content work that is too predictable to justify skilled hands every time, but too quality-sensitive to hand off without guardrails. The result is either slow throughput (specialist bottleneck), inconsistency (people using whatever tool they have) or vendor lock-in (a SaaS DAM that controls your templates).

This platform is the direct answer:

> **Programmatic creative and content at scale** - zero-labor asset generation, with the rules under central control, for employees, vendors and partners.

Lolly isn't where a design system gets invented - it's where it gets produced. Think of it like a vending machine for design: make a selection, get a result. Every time. The engine works for the highest quality each format can produce on the hardware in front of you, and the same engine makes the same file on every surface it ships to.

The outcome is **abundance**: every event has correct signage, every CVE alert matches the house style, every label prints clean, every email signature is current - all without a design ticket. The platform handles recurring operationalised creative. It is deliberately not a bespoke creative tool - designers still own flagship work.

### Innovate probabilistically, scale deterministically

Every argument about AI in a creative pipeline stalls on the same question: which part of this is the machine's job? It is an old question with a settled answer. Scribes and illuminators already worked between two instruments - the loose sketch, where nothing was fixed and everything could be tried, and the printing press, intimidating precisely because it committed. The sketches were where the art happened. The press was how it reached anyone. Nobody confused the two, and both kept advancing - new inks, new faces, new presses - each improving in harmony with the craft and the intention it served.

Lolly draws the same line. Explore probabilistically: a model, a designer, a rough idea, a prompt that goes somewhere nobody planned. Then scale deterministically - the thing that reaches ten thousand outputs is a *tool*, and a tool renders the same way every time from inputs you can read. The exploration stays free because nothing downstream depends on it landing the same way twice. The output earns trust because it is not a guess. Getting AI experimentation into predictable, reproducible outcomes is not a new discipline; it is the same division of labour that made printed work worth trusting in the first place.

> Trust the creative process, scale with rigour.

### Against the alternatives

::: figure positioning-comparison
Capability completeness across today's creative tools, researched August 2026. Scoring: 0 absent, 25 workaround-grade, 50 real but gated or partial, 75 strong with caveats, 100 core competency.
:::

The gap is plain: nothing shipping today gives us constraints-first, offline-capable, low-skill, internally accessible output. Lolly even includes an open canvas - **Design** - where colours, type and assets conform to the brand globals, so free arrangement stays constraints-first. What it is **not** is an unconstrained design suite: designers continue to use Illustrator and Figma for bespoke flagship work. Permutations can be assembled with this tool.

![Every tool in the library as a card, grouped by category, so a producer picks one and starts](/t/url-shot?url=%2F%23%2F&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&waitSelector=.gallery-view%5Bdata-shots-settled%5D&walker=1&format=svg&dark=1&filename=aud-gallery-landscape)

**Use it for:** Rapid generation of operationalised creative assets - event tiles, name badges, signatures, CVE alerts, QR codes, social cards, consignment labels, structured reports.

**Do not use it for:** Bespoke hero content.

---

## The lifecycle of a campaign

The clearest way to see what Lolly is isn't a feature list - it's to follow a single asset as it passes from hand to hand. Watch one localized campaign card move through the organisation:

1. **The creative sets the rules.** A designer authors the base template in the Design tool, hard-coding the brand's typography and colour variables. They're not making one card - they're doing the foundational work *once* so they never have to hand-localize it again.
2. **The developer scales it.** That same template is wired into a nightly pipeline through the CLI, so a fresh chart or a new language variant is generated automatically - no designer re-opens the file.
3. **The producer just uses it.** A sales rep, offline on a plane, opens the same tool and generates a perfectly on-brand deck for a client meeting. No design skill, no network, no wait.

The "fresh chart" in step two is a render like this one, produced from a data string and a handful of parameters with nobody opening a design file:

![A titled stacked area chart, its three series banded in a cool palette with axes, legend and title all placed by the template rather than by hand](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FchartType%3Darea%26stackMode%3Dstacked%26palette%3Dcool%26heading%3DProduct%2520mix%2520by%2520quarter%26full&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-lifecycle-chart)

The point isn't that Lolly is good for designers *and* good for developers *and* good for sales, each in a vacuum. It's a **relay race**: the creative's initial work is scaled by the developer, which in turn empowers the producer. The effortless experience for the non-technical rep on the plane is only *possible* because of the rigour the designer set and the developer deployed.

That's the force multiplier. Lolly isn't a drawer of separate tools for separate roles - it's one deterministic asset lifecycle that every role touches, and each hand it passes through multiplies the value of the last.

---

## One approval, ten thousand assets

Because approval lives in the tool and not the file (see [How Lolly compares](/info/positioning.html)), scale stops being a review problem. Approve a localized social-card tool once, then generate **10,000 assets across 12 languages** from a spreadsheet - and not one of them needs a fresh compliance check from legal or brand, because the template they all come from was already approved.

The same deterministic tool reaches that scale three ways, all producing identical, pre-approved output:

- <!--i:people--> **A person, in the app.** The `/pro` batch grid: paste or import the rows, get one finished asset per row, download the zip. No design skill, no ticket, no wait.
- <!--i:code--> **A developer, from the command line.** The CLI runs the *same* engine and the *same* render path headless, so the tool can be sequenced over all 10,000 rows in a script or a nightly pipeline. A `lolly <tool> --field=…` call in a loop is the whole integration.
- <!--i:cpu--> **A system or an AI agent, over MCP.** The same tool operated programmatically, at the same fidelity and even greater scale - because a machine won't get bored while thousands of files roll in.

![Batch mode on a fresh install: one empty row waiting for a tool, with the whole spreadsheet surface and its Render button in place before any data arrives](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=ov2-batch-grid)

One set of brand constraints, fixed once by a designer; three routes to the identical pre-approved output - and the machine route scales furthest of all, because it never tires while the files roll in.

---

## The big picture: how the layers fit

Everything from here down is architecture. The diagram is the whole system in one view: tools are
data at the top, the engine in the middle knows nothing of any platform, the shells below it
implement one contract, and the catalogs supply the content.

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

Content is mounted as packs: `community/`, `docs/`, every `shells/*`, both `services/*` and `brands/suse` are each their own repository, checked out as git submodules of this one. The parent owns `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/` and `profiles.json`. See [Build Guide » Getting the source](/info/build-guide.html) for the checkout command and the cross-repo workflow.

```
lolly/
├── engine/           # Platform-agnostic core. Open source (MPL-2.0).
│   └── src/
│       ├── index.ts          # public surface - loader, runtime, template, inputs, url-mode
│       ├── loader.ts         # fetches and validates tool files
│       ├── runtime.ts        # orchestrates the 5-step lifecycle
│       ├── template.ts       # Handlebars hydration + annotateTemplate
│       ├── inputs.ts         # manifest → runtime input model
│       ├── url-mode.ts       # URL ↔ input state round-trip
│       ├── validate.ts       # JSON Schema validation of manifests
│       ├── compose.ts        # resolve nested tool renders (composes)
│       ├── embed.ts          # parse portable lolly.tools embed URLs
│       └── bridge/
│           └── host-v1.ts    # type re-export of the @lolly-tools/core contract
│
├── shells/
│   ├── web/          # PWA - hosted online; primary distribution
│   │   └── src/
│   │       ├── main.ts           # boot, routing
│   │       ├── theme.ts          # theme apply/persist (FOUC prevention)
│   │       ├── bridge/           # web implementations of HostV1 APIs
│   │       │   ├── index.ts      # compose all bridge pieces
│   │       │   ├── db.ts         # IndexedDB setup
│   │       │   ├── state.ts      # host.state - saved edits
│   │       │   ├── profile.ts    # host.profile - user details
│   │       │   ├── assets.ts     # host.assets - catalog + user uploads
│   │       │   ├── clipboard.ts  # host.clipboard
│   │       │   ├── export.ts     # host.export - rasterise/serialize
│   │       │   ├── net.ts        # host.net - allowlisted fetch
│   │       │   └── media.ts      # host.media - live camera frames (onFrame)
│   │       ├── catalog/
│   │       │   └── sync.ts       # boot-time catalog sync + offline cache
│   │       ├── styles/           # app-wide CSS (app.css, picker.css, tokens.css)
│   │       └── views/
│   │           ├── gallery.ts    # tool library listing + saved-state cards
│   │           ├── tool.ts       # mounts one tool (inputs + canvas + actions)
│   │           ├── picker.ts     # asset picker UI (invoked by host.assets)
│   │           ├── profile.ts    # user details editor
│   │           ├── projects.ts   # /p - folders of saved sessions (nested; folder/selection export)
│   │           └── free-canvas.ts # free-canvas editor overlay for render.layout:"editor" tools
│   │
│   ├── cli/          # Node.js CLI - same engine, headless jsdom
│   │   ├── bin/lolly.ts
│   │   └── src/
│   │       ├── run.ts    # loadTool → createRuntime → export → write file
│   │       └── bridge.ts # CLI implementation of HostV1
│   │
│   ├── tui/          # Interactive terminal shell (Ink) - reuses the CLI bridge
│   │   └── src/
│   │       ├── main.tsx  # full-screen app: Gallery / Projects / Profile / ToolView
│   │       └── bridge.ts # CLI bridge + on-disk state under ~/.lolly
│   │
│   ├── tauri-desktop/ # downloadable desktop app
│   └── tauri-mobile/  # iOS/Android app
│
├── tools/            # profile VIEW (gitignored) - data, not code. Merged from packs:
│                     #   community/ (public, brand-agnostic, MPL) + brands/<active>/tools (brand-owned).
│                     #   A SELECTION follows - the mounted set depends on the profile.
│   ├── qr-code/
│   ├── quotes/
│   ├── email-signature/
│   ├── snippet/
│   ├── countdown-timer/
│   ├── color-palette/
│   ├── color-block/           # typed/heterogeneous blocks (addMenu discriminator)
│   ├── dynamic-layout/
│   ├── tool-logo/         # "Logo" - auto-switching brand logo
│   ├── street-map/        # offline vector city-block maps
│   ├── url-shot/          # "URL Screenshot" (capture capability)
│   ├── strip-data/        # on-device metadata strip - JPEG/PNG/SVG/PDF (file in → clean file out)
│   ├── compress-pdf/      # on-device PDF compressor - recompresses images (file in → smaller file out)
│   ├── brand-lockup/      # "Brand Lockup" - SUSE logo lockups; HarfBuzz text-to-path (wasm)
│   ├── chart-creator/     # SVG charts from structured data
│   ├── filter/            # photo effects in one tool - halftone/scanline/posterize/voronoi (vector), duotone/pixel-stretch/imperfections (raster)
│   ├── meeting-planner/   # global timezone meeting scheduler
│   ├── calendar-ics/      # event → .ics calendar file plus a card
│   ├── digi-ad/           # "Animated Ad" - looping banner from scenes
│   ├── event-name-badge/  # conference badges - composes qr-code as an SVG
│   ├── wayfinding-signage/ # event signage; directions blocks auto-fit label text
│   ├── text-helper/       # on-device text workbench (format/decode/hash/de-identify)
│   ├── design/     # "Design" - freeform WYSIWYG editor canvas (render.layout: editor)
│   ├── multi-page-pdf/    # multi-page PDF document - cover, flowing content blocks, back page
│   ├── diagram-builder/   # org / layercake / process / cycle / pyramid diagrams
│   ├── logo-wall/         # many logos → auto-packed grid
│   ├── logo-lockup-partner/ # SUSE + partner co-brand lockup
│   ├── icon/          # favicon .ico / png / svg from text + colours
│   ├── lottie-digi-ad/    # animated Lottie ad banners
│   └── pose-geeko/        # pose the SUSE Geeko mascot - print-ready stills
│
├── catalog/
│   ├── tools/index.json        # tool registry
│   └── assets/
│       ├── index.json          # asset registry
│       └── suse/...            # logo, palette, etc.
│
├── schemas/          # JSON Schema for tool.json, asset entries, AssetRef
├── scripts/          # build-catalog-index.ts, checksum-assets.ts, validate-catalog.ts
├── tests/            # engine tests
└── docs/             # this file + authoring guides + positioning
```

---

## Platform delivery model

The platform runs across several surfaces - web PWA, Tauri desktop/mobile, the scriptable CLI and the interactive TUI. All of them use the same engine and the same tool files.

### Web (PWA) - primary distribution
Hosted at a SUSE-controlled URL. Works offline once the service worker has cached tools and assets. This is where most employees, vendors and partners will use the platform. No account required - state is stored in IndexedDB per device.

The web shell is responsive from one layout. On desktop a tool is a resizable controls sidebar beside a preview stage with trackpad-native canvas navigation (Cmd/Ctrl-wheel or pinch to zoom about the cursor, Space- or middle-drag to pan, `0`/`1`/`+`/`−` keys and a Fit/% HUD). On mobile (≤640px) the controls become a top-anchored sheet with a drag grip that snaps peek/half/full (tap toggles) over a static full-screen preview, and a floating **Render** button opens the **Export** controls in a bottom-sheet popup. Touch gets pinch-zoom and drag-pan on the preview. The render path and the export controls are identical across both - only the chrome reflows.

![The desktop split view - controls generated from the manifest on the left, the live canvas on the right](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&dark=1&filename=aud-web-split)

The same tool at phone width, with no second layout to maintain: the controls become a sheet at the top, the preview holds the whole screen and the render pill floats over it.

![An audiogram on a 430px-wide screen - the controls sheet above, the finished square artwork below and the floating render pill](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Ffireplace-loop%26title%3DField%2520notes%26subtitle%3DEpisode%252012%26style%3Dwave&width=430&height=900&dpi=192&waitMs=3200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&dark=1&filename=ov2-phone-audiogram)

**Batch mode (`/pro`).** The web shell also ships a spreadsheet-style batch grid (`shells/web/src/pro/`) that renders many rows at once across one or many tools. It does CSV/TSV round-trip plus spreadsheet paste, per-row template/format/size/unit/dpi, a blocks-editor side panel with a live preview, collapsible export columns, a per-row "relevance" tag bar, left drag-handle row reorder, two-step delete confirm, saved batch sessions and a `.zip` download. This is the one-to-many surface behind the "mass content generation" positioning.

### Tauri desktop / mobile
Packaged native app (small footprint via Tauri). Provides full offline availability, filesystem access for CLI-dependent tools (PDF Smasher, Font Outliner) and camera access. Scheduled for mid-2026 tooling enhancement.

### CLI
`lolly <tool-id> [--input=value ...] --output=file.png`

Desktop users can invoke many tools from the terminal. The CLI shell loads the same engine, creates a jsdom DOM, runs the same render path and writes the file. URL mode is the transport - CLI is not a separate implementation. This guarantees CLI and GUI outputs are identical.

```bash
lolly qr-code --url=https://suse.com --output=qr.svg
lolly quotes --quote="Ship it." --output=quote.png
lolly                        # lists available tools
lolly qr-code                # lists inputs for that tool
```

### TUI
`pnpm run tui`

The interactive counterpart to the CLI: a full-screen, keyboard-first terminal app (built on Ink) for browsing tools, filling in inputs, saving projects and exporting - all without a GUI. Its host bridge **reuses the CLI's implementation** for the DOM-free formats (SVG/EMF/EPS/HTML + text/data), and adds on-disk state under `~/.lolly` plus an opt-in inline preview. Beyond that it has a **browser render tier**: a scoped headless Chromium (the same one the MCP server installs) that produces raster/PDF/video and live-URL capture on demand - driving a built copy of the web shell so output is identical, and launching only when you first export such a format. So `url-shot` (with crop + recolor + vector PDF/SVG) and every raster/pdf tool run in the terminal too. See the [TUI guide](/info/tui.html).

Whichever surface you are on, the dashboard's Capabilities tab is the full map of what the platform declares it can do, grouped and readable without opening a single tool.

---

## Tool categories

Tools are tagged with a `category` in their manifest for gallery grouping.

Rows are listed in gallery section order. The `utility` section always renders **last** in the gallery (after every other category, including future ones) - it's the on-device "Offline Utilities" drawer.

| Category | Examples | Planned |
|---|---|---|
| `everyone` | QR Code Generator, Quote Card, Email Signature, Logo, Wordmark, Audiogram, Battlecards, Sequence, Record | Employee Image Stationery |
| `designer` | Brand Lockup, Design, Chart, Darkroom, Filter, Pose Geeko, Booklet | Font Outliner |
| `event` | Meeting Planner, Event Name Badge, Wayfinding Signage, Calendar ICS, Booth Studio | Event Stationery, Bulk Name Badges, Room Agenda Cards |
| `product` | - | CVE Alert, Product Release Announcement, Blog OG Image |
| `utility` | Strip Hidden Data, Text, Compress PDF, Convert Image, Convert Font, Redact, Run Web Code, Screen Capture, URL Screenshot | Unit/format converters, more on-device privacy utilities |

Those cells are **examples, not inventories**. Which tools exist is a property of the profile you mounted, not of this page: a brand pack adds its own, and can exclude a community tool it would rather not ship. `catalog/tools/index.json` - generated from the manifests, and the registry the gallery actually reads - is the authoritative list; to count what a profile mounts, count the manifests (`ls community/*/tool.json brands/*/tools/*/tool.json`) rather than trusting a number written down here. (A tool id present in two packs mounts once, from the winning pack.)

Tools are also classified by status: `official` (brand approved, no watermark), `community` (external contribution), `experimental` (watermarked exports). Most of the library is `official`; the newer studios and the capture tools tend to sit at `community` or `experimental` while they settle. Every surface shows the badge, so a reader knows what they are picking up before they open it - and, like the category cells above, the per-status membership moves too fast to enumerate here. Read it off the gallery or the generated index.

**Design** is the first tool built on the `render.layout: "editor"` free-canvas mode - a chromeless, direct-manipulation surface where you drag, resize, rotate and snap boxes of text, shapes and images, then export through the same render path as every other tool.

**Strip Hidden Data** is the first **on-device utility** (`privacy: "on-device"`): a content-transform tool that takes a file *you* supply, processes it entirely in the browser and hands back a clean copy - never uploaded, never watermarked, no provenance stamped. **Text** is the second - an on-device workbench for everyday paste-into-a-website jobs (JSON format, JWT decode, Base64, URL encode/decode, SHA hashing). **Compress PDF** is the third - it shrinks a PDF by recompressing its images, again entirely on-device. The marker and its badge text "Runs on your device - nothing is uploaded" now cover the whole transform set: Strip Hidden Data, Text, Compress PDF, **Convert Image** (HEIC/TIFF/AVIF → WebP/JPG/PNG), **Convert Font**, **Redact** (destroy regions of an image, SVG or PDF), **Prompt Card** and **Rebrand** (re-theme a `.pptx` in place) where the profile mounts it. This is a privacy-utility category that replaces handing confidential files to single-purpose websites.

![The Utilities drawer, where every card is a tool that transforms a file you already have](/t/url-shot?url=%2F%23%2Fu&width=1440&height=900&dpi=192&waitMs=1600&css=.welcome-dialog%2C.personalize-nudge%2C.brand-tips%7Bdisplay%3Anone!important%7D&tolerance=0.03&format=svg&walker=1&dark=1&filename=aud-utilities)

> Note: `category` and `status` are denormalised into `catalog/tools/index.json` (the registry the gallery reads) from each `tool.json`. The manifest is the source of truth - the index is **generated** by `pnpm run build:catalog` and `pnpm run validate:catalog` fails CI if the committed index drifts from the manifests.

---

## Architectural commitments

These decisions are settled. Changing any of them is a major undertaking - they shape every other decision in the codebase.

### 1. Declarative tools, with an imperative escape hatch

A tool is a manifest (`tool.json`) + a template (`template.html`) + optional `hooks.js`.

**The manifest declares inputs.** Not the template. Inputs are not inferred from Handlebars tokens. The manifest is the contract; the template consumes named variables by `{{id}}`.

![Street Map's control stack - a city dropdown, a theme select, weight sliders and colour triggers, every one of them drawn from a manifest line](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-canvas%7Bdisplay%3Anone%7D&cropSelector=%23tool-inputs&dark=1&filename=ov2-street-map-controls)

**Hooks are optional.** Most tools are pure declarative - manifest + template is enough. Tools needing computed values (QR encoding, chart data shaping) provide `hooks.js` exposing named lifecycle functions (`onInit`, `onInput`, `onFrame` - the per-frame live-camera hook for motion-reactive tools - `onLevel`, `beforeExport`, `afterExport`, `exportFile` - the file-in/file-out transform path used by on-device utilities like Strip Hidden Data - and `exportStill`, for a tool that owns its own deep raster). The host loads hooks via `new Function('host', …)` with the capability bridge injected as closure scope. This is a **portability contract, not a security sandbox**: hooks still run in the page realm and *can* reach `window`/`fetch`/`document` in a browser shell - `host.*` is the supported, portable surface, not an enforced boundary. Async hook results are time-boxed (`onInit` 5s, `onInput` 2s, `beforeExport`/`afterExport` 5s, `exportFile`/`exportStill` 10s) and late results discarded; a runaway *synchronous* hook cannot be preempted. Untrusted third-party hook code is therefore not safe to run until Worker isolation ships.

This matters because: declarative tools can be authored by non-developers. If every tool were a web app, the risk note "limited skills to create/maintain workhorse templates" becomes a permanent bottleneck.

### 2. Tools and assets are data, not bundled code

The web and Tauri apps fetch tool and asset catalogs from a known URL at boot, cache them locally and operate on whatever is there. **Adding a new event tile or seasonal asset does not require an app release.**

Asset bytes are SHA-256 checksummed to prevent CDN poisoning. Asset `id` + `version` drives cache invalidation.

### 3. The Capability Bridge is the only API tools see

Tools never touch the DOM outside their template area, never call `fetch` directly, never read the filesystem. They call versioned `host.*` methods. The contract's canonical definition is `packages/core/src/host-v1.ts` - the tool-author SDK `@lolly-tools/core`, so a third party can build against it without depending on the engine; `engine/src/bridge/host-v1.ts` is a type re-export of it, and engine/shell code keeps importing from that path unchanged:

| Bridge API | What it does |
|---|---|
| `host.profile` | User's firstname, email, headshot, city, etc. Pre-fills inputs via `bindToProfile`. |
| `host.assets` | Catalog queries, asset resolution, host-provided picker UI. |
| `host.state` | Save / load input slots. IndexedDB on web, filesystem on Tauri, memory on CLI. |
| `host.clipboard` | Write text or image to clipboard (with platform fallbacks). |
| `host.export` | Rasterise or serialise the render target. Applies watermark for experimental tools. |
| `host.net` | Allowlisted fetch - only available if the tool declared `"network"` capability. (No shipping tool currently uses it.) |

Optional, additive surfaces appear only when a shell provides them. Some are **capability-gated** - exposed only when the tool declares the matching flag: `host.compose` (embed another tool's render - `compose`), `host.capture` (page capture for URL Screenshot - `capture`) and `host.recorder` (mic/camera/display capture for the recording tools - `microphone` / `camera` / `screen`). The rest are **feature-detected** - present whenever the shell can provide them, with the tool keeping a fallback for shells that can't.

A handful of headline surfaces, to show what it covers - [Host API](/info/host-api.html) documents every one, and `packages/core/src/host-v1.ts` is the contract itself:

| Surface | Since | What it adds |
|---|---|---|
| `host.tokens` | 1.0 | DTCG design tokens - the brand's own primitives |
| `host.text` | 1.0 | Text-to-path via HarfBuzz WASM (the `wasm` capability flags tools that rely on it) |
| `host.media` | 1.4 | Live camera frames driving the `onFrame` hook. Progressive enhancement, deliberately *not* gated by the `camera` flag - such a tool still works as an ordinary still-image tool |
| `host.color` | 1.40 | Perceptual colour maths: ΔEOK, WCAG + APCA contrast, OKLab ramps, class-breaks, categorical palettes, harmony schemes (1.60), CSS Color 4 mixing and gradient baking (1.68). Pure and synchronous - shells attach the engine's `makeColorApi()` rather than implementing anything, so it cannot drift |
| `host.images` | 1.60 | Decode / resize / re-encode bytes on device - the convert path (HEIC → JPEG, compress to WebP, downscale). Shipped in the web shell as a lazy facade, so the HEIC decoder never enters the boot chunk |
| `host.geom` | 1.64 | Exact vector geometry: path booleans, offsetting, stroke-to-fill, spline lowering, simplification, hit testing. Also pure, synchronous and attached from the engine (`makeGeomApi()`); failures are *returned*, never thrown |

The rest follow the same rules and are documented alongside them: `pdf` (1.8) and `pptx` (1.58) for on-device document surgery, `audio` (1.71) and `speech` (1.96) for clip analysis and on-device TTS/transcription, `viz` (1.72) for the MilkDrop placeholder contract, `codec` (1.100) and `layers` (1.102) for deep-bit and layered-bitmap output, `upscale` (1.101) and `matte` (1.103) for the on-device models, `raster` (1.105) for hooks doing their own pixel work, `connectors` (1.106) for export-safe arrows and `c2pa` (1.85) for signing finished bytes. The count grows; the rules don't.

The declarable capabilities are: `network`, `filesystem`, `clipboard`, `camera`, `microphone`, `screen`, `ffmpeg`, `wasm`, `capture`, `compose`. (`screen`, added in 1.54, is display capture via `host.recorder` - the user picks a screen/window/tab in browser-native UI; distinct from `capture`, which rasterises a URL the tool itself names.)

The same tool runs in browser, Tauri and headless CLI because each shell implements this interface - the tool never knows which it's in.

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
lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H
```

![That link on its own, with nothing else in it, is the finished asset](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26ecl%3DH%26full&width=760&height=760&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-url-mode-qr)

CLI mode is URL mode under a different transport - the CLI shell builds a URL-state object from argv and runs the **same** engine pipeline. There is one render path. CLI cannot drift from GUI because it isn't a separate implementation.

`url-mode.ts` handles the round-trip (parse and serialize). A set of **reserved params** is never forwarded to the tool as inputs: the output controls (`format`, `export`, `copy`, `filename`, `width`/`w`, `height`/`h`, `unit`, `dpi`), the print and provenance dials (`bleed`, `marks`, `profile`, `password`, `c2pa`, `imprint`, `durable`, `meta`, `hdr`, `depth`, `cuts`) and the state carriers (`template`, `z` - the "Shortest link" packed token - and `zx`, the same encrypted under a password). The `RESERVED` set in `engine/src/url-mode.ts` is the authority and is pinned by a test; [URL Mode](/info/url-mode.html) documents every one of them, including the handful not listed here. Asset inputs in URL mode are serialised by their `id`; the runtime resolves them via `host.assets.get()` before hydration. `width`/`height` are values in `unit` (default `px`, also `mm`/`cm`/`in`/`pt`/`pc`); with a physical unit `dpi` sets raster resolution. They set the canvas document size and pre-fill the export dimensions panel.

Because every input travels in the link, a parameter change is a different finished asset. This whole palette is one seed colour, a harmony and a step count:

![Nine steps across four hues, all grown from the single seed colour carried in the link](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fseed%3De0521a%26harmony%3Dtetrad-4%26steps%3D9%26full&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-url-palette)

### 6. Storage goes through the bridge, not direct

Web shell: IndexedDB. Tauri: filesystem. CLI: in-memory. Tools see only `host.state.save(slot, data)` and `host.state.load(slot)`. `localStorage` is not used - it's too small and can't hold blobs.

Users can save multiple named edit slots per tool and return to each session later. No account creation is required; state is per-device. Because the bridge is the only seam, that per-device state is also *portable*: `shells/web/src/data-transfer.ts` reads everything back out through `host.profile`/`host.state`/`host.assets` into a single `lolly-backup` zip that imports on any other install - the offline answer to "move to a new device" that doesn't need a server (full spec: `docs/data-transfer.md`). SUSE ID integration (multi-device sync) is a future milestone on top of this.

### 7. Maturity tags answer the "brand approved" risk by design

Every tool declares `status: official | community | experimental` in its manifest. The gallery sorts by status. Experimental tools watermark their exports automatically - the watermark is applied by `host.export.render`, not by the tool, so it cannot be opted out of by a non-official tool author.

This is a structural answer to the perception risk that using any tool implies brand approval. Process answers (a review queue, SUSE ID gating) layer on top.

### 8. Tool inputs are typed via the manifest, including assets

Inputs declare a `type`: `text`, `longtext`, `number`, `boolean`, `color`, `select`, `asset`, `date`, `time`, `datetime-local`, `url`, `blocks`, `vector`, `table` and `file`. The host renders a generic control per type from the manifest - tools write zero control code. (Pre-filling from the user's profile is not a type - any input can carry `bindToProfile`.) Three carry more weight than the rest:

- **`asset`** (with `filter` and `allowUpload`) is the bridge to the global asset system; `allowUpload: false` is the brand-enforceability lever for things like sponsorship-tile logos where only library assets are permitted. User uploads use the same `AssetRef` shape as library assets, so tools handle them identically.
- **`blocks`** is a repeating field-group - a mini-table inside one input, edited in a side panel, with a typed/discriminated add menu and per-block asset fields. Clicking a rendered block on the canvas focuses that block's row. Used by `meeting-planner`, `chart-creator`, `event-name-badge`, `wayfinding-signage`, `color-block` and `digi-ad`.
- **`vector`** groups a fixed set of numbers (e.g. a transform) into one compound control; **`file`** holds the user's own file as bytes in memory for on-device transform utilities (e.g. `strip-data` and `compress-pdf`).

### 9. Templates are logic-less (Handlebars, not EJS)

Handlebars was chosen over EJS deliberately:
- Logic-less. Templates can be authored by non-developers.
- Safe by default. `{{x}}` HTML-escapes; `{{{x}}}` is opt-in raw.
- No arbitrary JS in templates means no per-template XSS audit surface.

Logic lives in `hooks.js` where it is explicit and reviewable. Available Handlebars helpers: `{{default}}`, `{{upper}}`, `{{lower}}`, `{{eq}}`, `{{markdown}}`, `{{asset ref}}`, `{{asset ref "property"}}` (plus data-format helpers `icsStamp`/`rfcText`/`csvCell` used by sibling `.ics`/`.vcf`/`.csv` templates).

### 10. Tools compose tools

A tool can embed **another** tool's render with no tool-to-tool imports - composition is resolved by the engine, never by tool code. There are two surfaces:

- **Declarative manifest** - `composes: [{ id, tool, inputs, format?, width?, height? }]`. The engine renders the named child and places the result in the logic-less template as `{{asset <id>}}`. `event-name-badge` composes `qr-code` as an SVG today.
- **Portable embed URL** - `<img src="https://lolly.tools/tool/<id>.<ext>?<inputs>">`. The shell renders that child **locally** (a placeholder pixel shows until the local render resolves); nothing is ever fetched from `lolly.tools`.

Compose any tool's render: an **SVG** child stays a true vector when the parent exports to SVG or PDF and rasterises crisply for PNG; **PNG/JPG/WEBP** children embed as images. Requires the `compose` capability. Composed children are intermediates - never watermarked or provenance-stamped - and composition degrades gracefully: a shell that can't render a child just omits the slot and the parent still renders.

---

## What we explicitly chose not to do

- **No EJS / no arbitrary JS in templates.** XSS surface is zero. Logic lives in `hooks.js`.
- **No mandatory asset CMS.** Individuals ingest their own creative files straight into their catalogue in-app (the [Catalogue](/info/using.html) view and the Brand Studio) - no server, no admin console. Work is handed on as a **session**: a share link carries the whole state, and the same session travels in a backup or over a collab session. Whoever controls the deployment can then lock a shared session in as a **template** - open the link, record its values as a template entry in that tool's directory in the brand pack and commit - after which it appears in the tool's "New from template" chooser and is deep-linkable as `?template=<id>`. Git is the deployment owner's locking step, never the creator's. For a *shared, governed* catalog, an organisation **can** manage the asset directory the same way and gate updates through PR review - an available governance model, not a requirement of the app.
- **No forced RBAC.** The open app is public-access by default; brand risk is managed by maturity tags + watermarks. An org that wants tighter control layers on its own auth and the git-reviewed catalog above.
- **No central database.** All user state is per-device. SUSE ID integration is on the roadmap but not a launch blocker.
- **No shared tools/engine code path.** The engine is open source and so are the brand-agnostic tools in `community/`; a brand pack such as the private `brands/suse/` carries its own tools and catalog under its own terms. Either way the separation is enforced (no cross-imports from `engine/` into tool content) so the split stays clean.

---

## Lifecycle, end to end

A user opens `lolly.tools/#/tool/qr-code?url=https://suse.com&ecl=H`:

1. **Boot.** Web shell opens IndexedDB, constructs the capability bridge, syncs the tool and asset catalogs (or loads from cache when offline).
2. **Route.** URL hash → `tool` view, with `qr-code` and URL params extracted.
3. **Load.** `loadTool('qr-code', fetchFile)` fetches `tool.json`, validates against the JSON Schema, fetches `template.html`, `styles.css` and `hooks.js` source.
4. **Parse URL state.** `parseUrlState` translates URL params into initial input values. Asset refs (`?logo=suse/logo/primary`) are parsed as lightweight `{ id, _unresolved: true }` objects.
5. **Runtime.** `createRuntime(tool, host, initialValues)` builds the input model (merging profile data, defaults and initial values), resolves asset refs via `host.assets.get()`, loads hooks (closure-scoped `host`, not sandboxed), calls `hooks.onInit`.
6. **Render.** Shell subscribes to runtime; on every state change it receives `{ model, hydrated }`. It renders input controls from the model and writes the hydrated template HTML into `#tool-canvas`.
7. **Interact.** User types in an input → `runtime.setInput(id, value)` → constraints applied → `hooks.onInput` called → re-hydrate → re-render. The canvas updates live.
8. **Export.** User clicks Download(PNG) → `runtime.export(canvasNode, 'png')` → `host.export.render` (rasterises via dom-to-image-more; SVG/PDF go through dedicated DOM-walking vectorisers) → blob → `host.export.download`. The format range a tool can opt into is broad, and the `render.formats` enum in `schemas/tool.schema.json` is the authority on it - rasters and float rasters, vectors and cut files, print/CMYK, motion, editable documents (`pptx`, `docx`, `odt`), palette and data/text outputs, audio and font files. [URL Mode](/info/url-mode.html) names every id and what it produces. Audio is in that enum like anything else (`wav`, `mp3`, `m4a`, `opus`, declared by the audiogram and the recording tools); separately, a recording tool's `render.capture` mode drives `host.recorder`, whose take arrives as a finished Blob in whatever container the browser recorded. (Tools that set `render.export: false` - e.g. Color Palette, Countdown Timer, Strip Hidden Data, Text, Compress PDF - hide the download/format/dimension controls.) Physical units are converted per format here (PDF → true page points, raster → pixels at DPI with a `pHYs` chunk). Authorship/provenance metadata (author, tool, source - built by `engine/src/metadata.ts`) is embedded per format: PNG iTXt, JPEG EXIF, PDF info dict, SVG `<metadata>`, GIF comment. Experimental tools get a watermark inserted by the host, not the tool.

![The export panel that `?options` opens: the filename and format pair, the output size and the controls that write the file](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=aud-export-popup)

Same lifecycle in Tauri. Same lifecycle in CLI - jsdom provides the headless DOM; output goes to a file or stdout.

---

## Open-source status

**Code is MPL-2.0.** `engine/`, `shells/*`, `services/*`, `schemas/` and `docs/` are open source under **MPL-2.0** - a vendor-neutral scaffolding platform for brand tooling, with each shippable unit in its own repository under [github.com/lolly-tools](https://github.com/lolly-tools).

**Tool content ships as brand packs**, each with its own terms (see the pack's `NOTICE.md`). `community/` is the public [`lolly-tools`](https://github.com/lolly-tools/lolly-tools) repository and its brand-agnostic tools are MPL-2.0 too. `brands/suse/` is the private `suse-lolly` pack: the SUSE tools and the SUSE catalog, **proprietary to SUSE**, including its licensed PremiumBeat music. `brands/lolly-start/` is the blank starter brand this repository owns. Fonts ship inside a pack under the **SIL Open Font License 1.1** - the SUSE pack carries the SUSE and SUSE Mono typefaces.

The repo-root `tools/` and `catalog/` are gitignored *views*: a profile assembles them from `community/` plus the active brand pack, which is why every script and shell reads those two paths and never a pack directly.

The split is enforced - there are no cross-imports from `engine/` into tool content - so the platform/content boundary stays clean.

---

## Where the engine ends and the host begins

If you can describe it in pure data + Handlebars → **engine**.
If it touches the DOM, filesystem, network or any browser/OS API → **host**.

The line is sharp on purpose. The engine is the open-source part. Everything that knows about SUSE, specific platforms or runtime environments stays out of it.

For the next level of detail, [`engine/README.md`](../engine/README.md) enumerates every engine module and what it is responsible for, and [Threat Model & Trust Boundaries](/info/threat-model.html) records where that same line doubles as a trust boundary.
