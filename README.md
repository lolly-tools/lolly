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
| Make a QR code for a link | [QR Code](https://lolly.tools/#/tool/qr-code) |
| Frame a screenshot for a post or presentation | [Frame](https://lolly.tools/#/tool/frame) |
| Turn a recording into a video with a moving waveform | [Audiogram](https://lolly.tools/#/tool/audiogram) |
| Turn data into a chart or diagram | [Chart](https://lolly.tools/#/tool/chart) or [Diagrams](https://lolly.tools/#/tool/diagram-builder) |
| Build a layout I can reuse | [Design](https://lolly.tools/#/tool/design) |
| Remove hidden metadata or shrink a PDF locally | [Strip Hidden Data](https://lolly.tools/#/tool/strip-data) or [Compress](https://lolly.tools/#/tool/compress-pdf) |

Choose a tool, change its inputs, then use **Export** to download. The public app needs no account. [Make your first file](docs/make-something.md) walks you through a QR code.

## Why Lolly?

- **Set the design rules once.** Keep the layout and permitted choices consistent while people make the next version.
- **Work on your device.** Edit, render and transform files locally. Download the resources a tool needs, then render and export offline.
- **Keep the inputs as well as the file.** Save your work to edit later, or share a link that reopens its settings. Local uploads need to travel separately from a plain link.
- **Make one or make many.** Use the app for a single file, a table of values for a batch, or the command line for a repeatable workflow.
- **Use and extend the source.** Run your own copy and add tools. There is no per-seat software licence fee.

Optional network features, sharing, Sync and organisation services have their own data flows. The [privacy guide](docs/privacy.md) explains what stays local and what uses a service. For offline preparation, see [Available offline](docs/profile.md#available-offline).

## Bring your own design system

Add colours, fonts and logos in **Brand Studio**, or import design tokens from DTCG, Tokens Studio or Penpot. Community tools use your active design system.

Import supported Figma, Penpot, Illustrator, InDesign or PDF designs into the canvas. Check the converted layout and fonts, then use **Share with rules** to choose editable inputs and package a reusable tool.

[Set up your design system](docs/quickstart.md) · [Import a design](docs/design-import.md) · [Share a design with rules](docs/create-a-tool.md)

## Get the file you need

Export images, vectors, PDFs, editable PowerPoint decks, audio or video where the tool supports them. Print workflows include physical sizes, bleed, crop marks and CMYK output.

The format register covers **50 in, 56 out** (35 round-trip). Availability depends on the tool, browser and export path; the [format guide](https://lolly.tools/info/formats.html) gives the details.

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

A public clone includes community tools and the neutral **Lolly Start** design system. SUSE's private brand pack is optional.

On macOS or openSUSE, `./setup.sh` can install prerequisites and dependencies. See [INSTALL.md](INSTALL.md) for setup help, or [Releases](https://github.com/lolly-tools/lolly/releases) for packaged apps.

## Automate the repeat work

The CLI uses the same engine as the app. From your checkout, make a QR code as SVG:

```bash
pnpm run cli qr-code --url=https://example.com --output=./qr.svg
```

Use tool inputs in scripts, URLs and batch jobs, or let AI agents call tools through the optional MCP server. Fresh signatures, timestamps and browser encoders can change exported bytes; the [determinism guide](docs/determinism.md) explains reproducibility and its limits.

[CLI guide](docs/cli.md) · [URL inputs](docs/url-mode.md) · [MCP server](docs/mcp.md)

## Use Lolly with a team

Lolly began at SUSE, where people needed to make on-brand files without sending their work to outside services. It is maintained as open source and can run independently of SUSE.

For organisation sign-in, shared assets and projects, approvals, work collaboration, audit records or server rendering, add [lolly.work](https://github.com/lolly-tools/lolly-work). This optional service is maintained separately. Hosting and operations have their own costs.

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
| [`services/`](services/) | Optional MCP and certificate services |
| [`docs/`](docs/) | Guides, architecture and the documentation site |

Start with the [tool-authoring guide](docs/authoring-tools.md), [architecture overview](docs/overview.md) or [glossary](docs/glossary.md).

### Contributing

Bug reports, documentation, tools and code improvements are welcome. [CONTRIBUTING.md](CONTRIBUTING.md) covers setup and checks. [Open an issue](https://github.com/lolly-tools/lolly/issues) with what you were trying to make and what happened.

Report security issues privately using [SECURITY.md](SECURITY.md).

## Licensing & structure

Code is [MPL-2.0](LICENSE). Documentation content is [CC BY-SA 4.0](docs/LICENSE), with attribution to [lolly.tools](https://lolly.tools).

Brand packs and bundled assets carry their own licences and notices. SUSE's proprietary tools and assets stay in the optional private `brands/suse` submodule. Third-party software, fonts and other material retain their stated licences; see [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md).

## Current tools

<!-- tools-table:start -->
The Lolly Start (blank brand) catalog ships **61 tools** today - 60 listed in the gallery, plus one unlisted helper (Asset Export). Generated from `catalog/tools/index.json` by `pnpm run build:readme-tools`:

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
