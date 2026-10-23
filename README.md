# Lolly

<img src="icon.svg" alt="Lolly's green and white lollipop" width="80"/>

**Make graphics, documents and video from simple inputs.**

Lolly is an open-source creative platform. Pick a tool, add your words, images or data, and download a finished file. Your design system supplies the colours, fonts and assets.

Build a layout once, choose what other people can change, and share it as a tool. They fill in the fields; the tool handles the layout and design rules.

[Open Lolly](https://lolly.tools) · [Make your first file](https://lolly.tools/info/start/make-something.html) · [Downloads](https://github.com/lolly-tools/lolly/releases) · [Documentation](https://lolly.tools/info/)

## What can I make?

Start with a focused tool, or arrange your own text, images and shapes on the Design canvas.

| I need to... | Try... |
| --- | --- |
| Make a QR code for a link | [QR Code](https://lolly.tools/t/qr-code) |
| Frame a screenshot for a post or presentation | [Frame](https://lolly.tools/t/frame) |
| Turn a recording into a video with a moving waveform | [Audiogram](https://lolly.tools/t/audiogram) |
| Turn data into a chart or diagram | [Chart](https://lolly.tools/t/chart) or [Diagrams](https://lolly.tools/t/diagram-builder) |
| Build a layout I can reuse | [Design](https://lolly.tools/t/design) |
| Remove hidden metadata or shrink a PDF locally | [Strip Hidden Data](https://lolly.tools/t/strip-data) or [Compress](https://lolly.tools/t/compress-pdf) |

Choose a tool, change its inputs, then use **Export** to download. The public app needs no account. [Make your first file](docs/make-something.md) walks you through a QR code.

## Why Lolly?

- **Set the design rules once.** Keep the layout and permitted choices consistent while people make the next version.
- **Work on your device.** Edit, render and transform files locally. Download the resources a tool needs, then render and export offline.
- **Keep the inputs as well as the file.** Save your work to edit later, or share a link that reopens its settings. Local uploads need to travel separately from a plain link.
- **Make one or make many.** Use the app for a single file, a table of values for a batch, or the command line for a repeatable workflow.
- **Use and extend the source.** Run your own copy and add tools. There is no per-seat software licence fee.

Optional network features, sharing, Sync and organisation services have their own data flows. The [privacy guide](docs/privacy.md) explains what stays local and what uses a service. For offline preparation, see [Available offline](docs/profile.md#available-offline).

## Bring your own design system

Add colours, fonts and logos in **Design System Setup**, or import design tokens from DTCG, Tokens Studio or Penpot. Community tools use your active design system. lolly.tools starts in **Lolly Demo**, Lolly's own sample design system.

Import supported Figma, Penpot, Illustrator, InDesign or PDF designs into the canvas. Check the converted layout and fonts, then use **Share with rules** to choose editable inputs and package a reusable tool.

[Put your brand in](docs/quickstart.md) · [Import a design](docs/design-import.md) · [Share a design with rules](docs/create-a-tool.md)

## Get the file you need

Export images, vectors, PDFs, editable PowerPoint decks, audio or video where the tool supports them. Print workflows include physical sizes, bleed, crop marks and CMYK output.

The format register covers **55 in, 59 out** (39 round-trip). Availability depends on the tool, browser and export path; the [format guide](https://lolly.tools/info/create/formats.html) gives the details.

Authoring tools can attach **Content Credentials**, a signed record of how a file was made. [Read about credentials and identity](docs/content-credentials-identity.md).

## Run Lolly locally

Development uses Node 26 ([`.nvmrc`](.nvmrc)) and pnpm 11.26.0 ([`package.json`](package.json)). The package minimum is Node 22.18.

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
npm install --global pnpm@11.26.0
pnpm install
pnpm run dev:web
```

Open <http://localhost:5173>. The web app needs a browser with a working WebGPU adapter and graphics acceleration. See [supported environments](docs/supported-environments.md) for the tested combinations.

A public clone includes community tools, **Lolly Demo** (the design system lolly.tools runs) and the neutral **Lolly Starter** design system. SUSE's private brand pack is optional.

On macOS or openSUSE, `./setup.sh` can install prerequisites and dependencies. See [INSTALL.md](INSTALL.md) for setup help, or [Releases](https://github.com/lolly-tools/lolly/releases) for packaged apps.

## Automate the repeat work

The CLI uses the same engine as the app. From your checkout, make a QR code as SVG:

```bash
pnpm run cli qr-code --url=https://example.com --output=./qr.svg
```

Use tool inputs in scripts, URLs and batch jobs, or let AI agents call tools through the optional MCP server. Fresh signatures, timestamps and browser encoders can change exported bytes; the [determinism guide](docs/determinism.md) explains reproducibility and its limits.

[CLI guide](docs/cli.md) · [URL inputs](docs/url-mode.md) · [MCP server](docs/mcp.md)

## Use Lolly with a team

Lolly began at SUSE, where people needed to make on-brand files without sending their work to outside services. It is maintained as open source and runs independently of SUSE.

For organisation sign-in, shared assets and projects, approvals, work collaboration, audit records or server rendering, add [Lolly Work](https://github.com/lolly-tools/lolly-work), the organisation server of the same project. It is optional and maintained in its own repository, and hosting and operations have their own costs. [Why Lolly is free](docs/faq.md) tells the story of who builds it and why.

[Organisation guide](docs/organisation.md) · [Self-hosting and deployment](docs/deployment.md) · [Current status and adoption](docs/adoption-governance.md)

## Build on Lolly

A tool is a manifest and template, with optional styles, assets and JavaScript hooks. Tools are distributed as content, so adding a tool does not require a new app release.

The **engine** loads tools and drives rendering. Each **shell** supplies the platform features it needs through a versioned **bridge**. That keeps brands and platform-specific code out of the engine.

### Repository layout

| Path | What you will find |
| --- | --- |
| [`engine/`](engine/) | Rendering, inputs, templates and export logic |
| [`shells/`](shells/) | Web, desktop, mobile, command-line and terminal apps |
| [`community/`](community/) | Tools that work with different design systems |
| [`brands/`](brands/) | Design systems, assets and brand-specific tools |
| [`packages/`](packages/) | The tool-author SDK and shared components |
| [`schemas/`](schemas/) | Contracts for tool manifests and assets |
| [`services/`](services/) | Optional MCP, certificate and Penpot services, and the server code they share |
| [`docs/`](docs/) | Guides, architecture and the documentation site |

Start with the [tool-authoring guide](docs/authoring-tools.md), the [architecture page](docs/overview.md) or the [glossary](docs/glossary.md).

### Contributing

Bug reports, documentation, tools and code improvements are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers setup and checks. [Open an issue](https://github.com/lolly-tools/lolly/issues) with what you were trying to make and what happened.

Report security issues privately using [SECURITY.md](SECURITY.md).

## Licensing & structure

Code is [MPL-2.0](LICENSE). Documentation content is [CC BY-SA 4.0](docs/LICENSE), with attribution to [lolly.tools](https://lolly.tools).

Brand packs and bundled assets carry their own licences and notices. SUSE's proprietary tools and assets stay in the optional private `brands/suse` submodule. Third-party software, fonts and other material retain their stated licences; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Current tools

<!-- tools-table:start -->
The Lolly Start (blank brand) catalog ships **68 tools** today - 66 listed in the gallery, plus 2 unlisted helpers (Asset Export, Theme swap). Generated from `catalog/tools/index.json` by `pnpm run build:readme-tools`:

| Tool | What it makes |
|---|---|
| 3D | Load a 3D model into a lit scene, orbit and pose the camera, and render a still or a turntable animation. |
| 3D Studio | Turn SVG artwork and 3D models into coordinated images, alone or arranged together in one scene. Shape materials, lighting, focus and transparent shadows with guided or expert controls. |
| Agenda | Turn one programme into branded screens, interactive web pages, animated overviews, PowerPoint slides and calendars. |
| Annotate | Mark up your own screenshot on your device - arrows, boxes, numbered steps, callouts, highlighter and a spotlight dim. |
| Audiogram | Turn a voice clip or song into a video in your design system's colours that actually moves with the sound - bars, spectrum, ring, ridgeline or scope, ready for social. |
| Backdrop | Living backdrops from your design system's colours: sixteen GPU effects - flowing silk, prismatic blooms, liquid contours, metaballs, god rays and more. Tune, freeze the exact moment you want, and export stills or motion loops for heroes, walls and meeting backgrounds. |
| Battlecards | Turn any table into a deck of cards - one card per row, ready as a multi-page PDF. Paste straight from your spreadsheet, doc, or chat. |
| Booklet | Build a multi-page PDF - a cover, flowing content blocks, and a back page. |
| Booth | Dress a 3D event booth with sponsor artwork. Click any panel to drop an image on it, pick a booth design, and render a still or a turntable for a sponsor pitch. |
| Calendar | Turn event details into a calendar (.ics) file for any calendar app. |
| Captions | Subtitles for a clip - turn its speech into text on device or drop in an SRT/VTT file, style the cues, and export burned-in frames plus clean .srt and .vtt sidecars. |
| Certificate | Completion and award certificates from the active design system - one name at a time, or a whole roster from a CSV in Bulk from rows. |
| Chart | Charts from first paste to advanced visualisation - explained data recommendations, explicit field mapping, 35 classic vector families including Pareto, bullet targets and range bars, sixteen statistical and editorial articulations, real-z 3-D scenes, cinematic flights, deterministic motion, accessible descriptions and styles compiled from the active design system. |
| Claim | Claim your name on any media you've already made - image, PDF, video or audio. Stamp your author, copyright and licence as Content Credentials (a durable raster Imprint too), preserving any credential already inside the file - all on your device, before you upload it anywhere. |
| Clean | Clean a voice recording, trim edge silence and set its loudness on your device. |
| Compress | Shrink a PDF by recompressing its images - on your device. |
| Contrast | Check a text and background pair, or every pairing in the design system palette, against WCAG 2.1 and APCA, and see how it reads to colour-blind viewers. |
| Convert Font | Convert a font between TrueType, OpenType and WOFF - on your device. |
| Convert Image | Turn HEIC, TIFF or any photo into WebP, JPEG or PNG - on your device. |
| Countdown | A focused countdown with a live progress ring. Click to pause. |
| Darkroom | Grade photos and video with film looks, Adobe XMP presets, .cube LUTs and your design system colours. Reuse a look through LUT export or Grade a video. Opens Photoshop and GIMP layers for positioning, blending and image export. |
| Design | An open canvas for free arrangement - text, images, shapes and live renders from your other Lolly tools, all held to your design system. |
| Diagrams | Org charts, flowcharts, timelines and more - from cards, text, Mermaid, DOT or CSV. |
| Doc Studio | Write a multi-page document on the canvas - rich text, headings, tables and inserted Lolly renders that flow onto pages and export as a PDF. |
| Filter | One tool for photo effects: pick halftone, scanline, posterize, voronoi, dither or ASCII art (vector) or duotone, pixel-stretch, misprint or glitch (raster). Design system overlays, live camera and exports to as many formats as each effect supports. |
| Finishes | Preview foil, spot UV, emboss and soft-touch finishes on your artwork - then export the printer-ready spot plate. The on-screen sheen is presentation only; the plate is the real deliverable your print house needs. |
| Flow Chart | Build flow charts on an open canvas - drag cards, connect them, and the lines route and stick to the boxes. |
| Flythrough | Fly a real 3D camera through a screenshot. The picture lifts into layers at real depth; big shapes extrude into solid objects; a timeline of poses animates the whole move - depth, opacity, perspective, extrusion, tilt, rotate, scale and the camera flight - then loops it home. Add, drag and reorder poses. Export as video. |
| Frame | Drop in a screenshot and get it framed, padded and shadowed on a design system backdrop. |
| Gradient | Five ways to build a gradient from the design system swatches: soft radial Blend, a real Coons-patch mesh as crisp SVG (Subdivide) or a smooth raster (Mesh), freeform Warp points and the animated Flow waves. Drag everything right on the canvas; export stills or join-free video loops. |
| Growth | Differential growth: a line that repels itself until it folds into coral. Seed it from a ring, a burst, headline letterforms or a logo, and export the result as real, plotter-ready SVG paths. |
| Icon | Favicon and app-icon maker - a multi-size .ico, PNG and SVG, or the whole app kit as one zip. |
| Jump | A one-link landing page: your links, heading, portrait and colours on an expressive page - and the whole page lives inside the link you share. |
| Link Card | Paste a link, get a social card in your design system - title, description, site chip and a thumbnail, at Open Graph, square or summary size. |
| Logo Wall | Arrange a pile of logos into a clean, even sponsor grid - the “NASCAR” wall. |
| Lottie Ad | Build animated ads from layered scenes, each carrying a Lottie motion asset, for any standard size. |
| Markdown Slides | Turn Markdown or a JSON spec into a native, editable PowerPoint deck - real text, bullets, tables and the design system theme - in seconds. The fast text-first path to a deck; reach for the Design canvas when you want to lay slides out by hand or animate them. Charts and diagrams come from your other Lolly tools. Exports .pptx (editable), plus PDF and PNG. |
| Meeting Planner | Plan a global meeting and see the time for every teammate's timezone. |
| Pages | Reorder, rotate, extract, delete, merge or split PDF pages, or turn images into a PDF, on your device. |
| Palette Lab | Grow a palette from one seed colour - harmony accents, perceptual OKLab ramps and WCAG/APCA readability badges, with DTCG tokens and CSV export. |
| Pricing | Plans as columns, features as rows, ticks and crosses, and one plan picked out as the recommended one. |
| Print Sheet | Lay one design - or a whole pile of them - out n-up on A4, Letter or A3, across as many pages as it takes, with crop marks in the margin. |
| Prompt Card | Typeset a long prompt into one compact, legible image for a multimodal model - image input is often cheaper than the same words as text tokens. |
| QR Code | Scannable codes of every kind: QR, Micro QR, Data Matrix, Aztec and PDF417 for links, contacts, Wi-Fi, events, locations and text - plus retail and logistics barcodes from EAN-13 and Code 128 to ITF-14, GS1-128, GS1 DataBar and MaxiCode. |
| Record | Design your own top and tail cards, then record a clip and Lolly wraps them around it automatically. |
| Redact | Black out sensitive content by rebuilding the file, then verify the output before it downloads, all on your device. |
| Rondocode | Write music as code and hear it as you type: synths, patterns and a mix in rondocode's live editor. Export the song as audio, stems or MIDI with Content Credentials that record it, or keep its source. |
| Sandbox | Paste HTML, CSS, JS - or a JSX/TypeScript component - and watch it run in a private, offline sandbox. Perfect for previewing code from an AI assistant. |
| Scan | Read QR codes and barcodes on-device, with nothing sent to any cloud. A reader, not an opener: it decodes, classifies and explains what a code carries - links, Wi-Fi, contacts, product codes - and lets you act deliberately. Copy is always the first action; opening, joining or adding is an explicit, informed tap. |
| Screen Capture | Screenshot or record your whole screen, a window, or a browser tab. Drag on the canvas to crop - the export stays the exact pixels you captured. |
| Sign | Place your signature on a PDF, optionally add a Content Credential and lock the result. |
| Signature | Sign with a finger, stylus or mouse and get a clean signature on transparency - SVG or PNG, no scanner, no photo of a bit of paper. |
| Snippet | Present text in a desktop window, as a still image or a directed interaction with typing, selections, autocomplete and motion. |
| Spatial Photo | Drop in one photo and move a camera through it: depth is read on your device, so a flat picture becomes a scene with real parallax, atmosphere and focus. |
| Stationery | Business cards, letterhead and compliments slips from the design system, each piece sized to its real print trim, ready as a print PDF. |
| Street Map | Clean vector street-block maps of any city. Works offline. |
| Strip Hidden Data | Remove selected DOCX properties or image and PDF metadata, and inspect other Office hidden content, on your device. |
| Synth | A visual instrument you play. Four scenes run live on the GPU: fluid ink, a particle swarm that flies at your headline or your logo, a feedback field, and your own camera. Every colour comes out of the design system palette, and the picture moves to your pointer, to a music track, and to a MIDI controller. Export a still or a join-free loop. |
| Text | Find, edit, understand and transform text. Browse brand characters and emoji, work with code and logs, or create ASCII lettering. |
| Timezone | Turn places and timezones into artwork that follows the design system. Rotate a vector atlas or a detailed WebGL globe, unfold projections, label your people and places, then export artwork, a camera tour or structured schedules. |
| Trim | Cut, turn or shrink an audio or video clip, take a poster frame or contact sheet, mute it or extract its audio on your device. |
| URL Screenshot | Any web page, at any scroll depth, with custom CSS. |
| Voice Recorder | Record a voice note with a live level meter and gentle coaching, then save it as MP3. |
| Wayfinding | Directional event signs - destinations, each with an arrow. Print-ready. |
| Wordmark | Type a word, get a pure-path vector wordmark in the design system font - recipients never need the font installed. |
| Work Avatar | A round profile photo with a treatment and a ring of text - the campaign badge for LinkedIn and every other place your face goes, in your design system's colours and type. |
<!-- tools-table:end -->
