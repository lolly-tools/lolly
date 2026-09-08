# Tool catalogue

Every tool in the public Lolly catalogue, generated from
`brands/lolly-start/catalog/tools/index.json`. A private brand pack (for example
SUSE) adds its own tools on top of these; this table is the set an agent can rely
on in any checkout and on the public host.

How to read a row:

- **ID** is the permanent contract. It never changes and never gets reused. Use
  it in a URL (`/#/tool/<id>`), the render route (`/tool/<id>.<ext>`), an MCP call
  (`toolId`), or the CLI (`lolly <id>`).
- **Formats** are the export formats the tool declares. You may only request one
  it lists; ask for anything else and the render falls back or refuses. The public
  render route serves only the browser-free subset plus PNG for SVG-native tools
  (see `surfaces.md`).
- **Requires** are the optional `host.*` APIs the tool's hooks call. A shell that
  cannot provide one greys the tool out; the render route and CLI stub or refuse.
- **Capabilities** are device abilities the tool needs (camera, microphone,
  screen). They gate the tool on shells that cannot fulfil them.
- **Purpose** is the first line of the tool's own description. Call
  `lolly_describe_tool` (MCP) or `lolly describe <id>` (CLI) for the full input
  schema, examples and canvas size.

Three tools carry their own reference page because their input is a structured
document rather than a handful of fields: **chart** (`chart.md`), **design**
(`design.md`) and **deck-studio** (`deck.md`).

## Tools

<!-- GEN:tools-main -->
| ID | Name | Category | Formats | Requires | Capabilities | Purpose |
|---|---|---|---|---|---|---|
| `3d` | 3D | designer | png, jpg, webp, webm, mp4, gif, avif, tiff, apng, webp-anim | - | - | Load a 3D model into a lit scene, orbit and pose the camera, and render a still or a turntable animation. |
| `agenda` | Agenda | event | pdf, pdf-cmyk, svg, penpot, png, jpg, webp, ics | - | - | A conference programme from one table - a chronological list, a multi-track timetable, or a now-and-next screen for t… |
| `asset-export` | Asset Export | everyone | svg, penpot, png, jpg, webp, pdf, pdf-cmyk, cmyk-tiff, ico, zip, avif, tiff, eps, dxf, emf | - | - | Render any catalog asset - or a Lolly tool link - out to any format and size. |
| `audiogram` | Audiogram | everyone | png, webm, mp4, gif, webp-anim, html, wav, mp3, m4a, opus, srt, vtt, apng | - | - | Turn a voice clip or song into a branded video that actually moves with the sound - bars, spectrum, ring, ridgeline o… |
| `backdrop` | Backdrop | everyone | png, jpg, webp, avif, webm, mp4, gif, tiff, webp-anim | - | - | Living backdrops from your design system's colours: sixteen GPU effects - flowing silk, prismatic blooms, liquid cont… |
| `battlecards` | Battlecards | everyone | pdf, svg, penpot, pdf-cmyk, emf, png, webp, avif, jpeg, tiff, cmyk-tiff | - | - | Turn any table into a deck of cards - one card per row, ready as a multi-page PDF. |
| `booth-studio` | Booth | event | png, jpg, webp, webm, mp4, gif, avif, tiff, webp-anim | - | - | Dress a 3D event booth with sponsor artwork. |
| `calendar-ics` | Calendar | event | ics, png, svg, penpot, pdf, jpg, webp | - | - | Turn event details into a calendar (.ics) file for any calendar app. |
| `captions` | Captions | everyone | png, svg, penpot, srt, vtt, json, jpg, webp | - | - | Subtitles for a clip - turn its speech into text on device or drop in an SRT/VTT file, style the cues, and export bur… |
| `certificate` | Certificate | everyone | pdf, pdf-cmyk, svg, penpot, png, jpg, webp, tiff, cmyk-tiff | - | - | Completion and award certificates from the active brand - one name at a time, or a whole roster from a CSV in Bulk fr… |
| `chart` | Chart | designer | png, md, svg, penpot, emf, pdf, pdf-cmyk, cmyk-tiff, tiff, pptx, webp, jpg, apng, webp-anim, gif, webm, mp4, avif, csv, json | - | - | Charts from first paste to advanced visualisation - explained data recommendations, explicit field mapping, 35 classi… |
| `darkroom` | Darkroom | designer | png, jpg, webp, svg, penpot, webm, mp4, exr, hdr, tiff, pdf, avif | - | - | A pro photo-grading darkroom: film looks, third-party .cube LUTs, brand-seeded colour treatments and finishing textur… |
| `deck-studio` | Markdown Slides | designer | pptx, pdf, png, html, jpg, webp | - | - | Turn Markdown or a JSON spec into a native, editable PowerPoint deck - real text, bullets, tables and brand theme - i… |
| `design` | Design | designer | png, svg, penpot, pdf, pdf-cmyk, cmyk-tiff, jpg, webp, mp4, webm, gif, apng, wav, mp3, m4a, opus, pptx, scorm, avif, tiff, emf, webp-anim | - | - | An open canvas for free arrangement - text, images, shapes and live renders from your other Lolly tools, all held to… |
| `diagram-builder` | Diagrams | everyone | svg, penpot, pdf, dxf, png, jpg, webp, avif, emf, pdf-cmyk, pptx | - | - | Org charts, flowcharts, timelines and more - from cards, text, Mermaid, DOT or CSV. |
| `doc-studio` | Doc Studio | designer | pdf, pptx, svg, penpot, md, docx, odt, html | - | - | Write a multi-page document on the canvas - rich text, headings, tables and inserted Lolly renders that flow onto pag… |
| `filter` | Filter | designer | svg, penpot, pdf, pdf-cmyk, emf, png, jpg, webp, avif, tiff, cmyk-tiff, gif, apng, webp-anim, webm, mp4, txt, md | - | - | One tool for photo effects: pick halftone, scanline, posterize, voronoi, dither or ASCII art (vector) or duotone, pix… |
| `finish-preview` | Finishes | designer | svg, penpot, pdf, pdf-cmyk, png, jpg, webp, avif, tiff, cmyk-tiff, gif, apng, webp-anim, webm, mp4 | - | - | Preview foil, spot UV, emboss and soft-touch finishes on your artwork - then export the printer-ready spot plate. |
| `flythrough` | Flythrough | designer | png, jpg, webp, webm, mp4, gif, avif, tiff, webp-anim | - | - | Fly a real 3D camera through a screenshot. |
| `frame` | Frame | everyone | png, jpg, webp, svg, penpot, pdf, avif, tiff | - | - | Drop in a screenshot and get it framed, padded and shadowed on a brand backdrop. |
| `gradient` | Gradient | everyone | svg, penpot, png, jpg, webp, avif, webm, mp4, gif, pdf, tiff, webp-anim | - | - | Five ways to build a gradient from your brand swatches: soft radial Blend, a real Coons-patch mesh as crisp SVG (Subd… |
| `growth` | Growth | designer | svg, penpot, pdf, png, jpg, webp, gif, webm, mp4, avif, tiff, emf, eps, dxf, webp-anim | - | - | Differential growth: a line that repels itself until it folds into coral. |
| `icon` | Icon | everyone | ico, png, svg, penpot, zip, webp | - | compose | Favicon and app-icon maker - a multi-size .ico, PNG and SVG, or the whole app kit as one zip. |
| `link-card` | Link Card | everyone | png, jpg, webp, svg, penpot, pdf, avif, tiff | - | - | Paste a link, get a branded social card - title, description, site chip and a thumbnail, at Open Graph, square or sum… |
| `logo-wall` | Logo Wall | designer | png, svg, penpot, pdf, dxf, jpg, webp, avif, tiff, emf, eps, pdf-cmyk | - | - | Arrange a pile of logos into a clean, even sponsor grid - the “NASCAR” wall. |
| `lottie-digi-ad` | Lottie Ad | designer | mp4, gif, webm, apng, png, svg, penpot, svg-anim, webp, webp-anim | - | - | Build animated ads from layered scenes, each carrying a Lottie motion asset, for any standard size. |
| `meeting-planner` | Meeting Planner | event | png, jpeg, svg, penpot, ics, json, pdf, webp, csv | - | - | Plan a global meeting and see the time for every teammate's timezone. |
| `multi-page-pdf` | Booklet | designer | pdf, pptx, svg, penpot, md | - | - | Build a multi-page PDF - a cover, flowing content blocks, and a back page. |
| `org-chart` | Flow Chart | everyone | png, svg, penpot, pdf, jpg, webp, avif, tiff, emf, pdf-cmyk, pptx | - | - | Build flow charts on an open canvas - drag cards, connect them, and the lines route and stick to the boxes. |
| `pricing-table` | Pricing | everyone | png, svg, penpot, pdf, csv, json, jpg, webp, avif | - | - | Plans as columns, features as rows, ticks and crosses, and one plan picked out as the recommended one. |
| `print-sheet` | Print Sheet | everyone | pdf, pdf-cmyk, svg, penpot, png, cmyk-tiff | - | - | Lay one design - or a whole pile of them - out n-up on A4, Letter or A3, across as many pages as it takes, with crop… |
| `qr-code` | QR Code | everyone | svg, penpot, png, jpeg, webp, avif, tiff, pdf, pdf-cmyk, cmyk-tiff, eps, eps-cmyk, dxf, emf | - | - | Scannable codes of every kind: QR, Micro QR, Data Matrix, Aztec and PDF417 for links, contacts, Wi-Fi, events, locati… |
| `record` | Record | everyone | mp4, webm, srt, vtt, gif, webp-anim | - | camera, microphone | Design your own top and tail cards, then record a clip and Lolly wraps them around it automatically. |
| `signature` | Signature | everyone | svg, penpot, png, webp, avif, pdf | - | - | Sign with a finger, stylus or mouse and get a clean signature on transparency - SVG or PNG, no scanner, no photo of a… |
| `snippet` | Snippet | everyone | png, svg, penpot, jpg, webp, pdf | - | - | Turn code snippets into clean, syntax-highlighted, shareable images. |
| `spatial-photo` | Spatial Photo | designer | png, jpg, webp, webm, mp4, gif, avif, tiff, webp-anim | - | - | Drop in one photo and move a camera through it: depth is read on your device, so a flat picture becomes a scene with… |
| `stationery` | Stationery | everyone | pdf, pdf-cmyk, svg, penpot, png, jpg, webp, tiff, cmyk-tiff | - | - | Business cards, letterhead and compliments slips from your brand - each piece sized to its real print trim, ready as… |
| `street-map` | Street Map | designer | svg, penpot, emf, dxf, pdf, pdf-cmyk, png, jpg, webp, avif, tiff, eps | - | - | Clean vector street-block maps of any city. |
| `synth` | Synth | designer | png, jpg, webp, webm, mp4, gif, apng, avif, tiff, webp-anim | - | - | A visual instrument you play. |
| `timezone` | Timezone | event | svg, png, pdf, webp, jpeg, webm, mp4, gif, json, csv, md, ics | - | - | Turn places and timezones into brand-led artwork. |
| `voice-recorder` | Voice Recorder | everyone | png, svg, penpot, mp3, wav, m4a, opus | - | microphone | Record a voice note with a live level meter and gentle coaching, then save it as MP3. |
| `wayfinding-signage` | Wayfinding | event | pdf, pdf-cmyk, svg, penpot, dxf, png, jpg, webp, avif, tiff, cmyk-tiff, emf | - | - | Directional event signs - destinations, each with an arrow. |
| `wordmark` | Wordmark | everyone | svg, penpot, emf, eps, eps-cmyk, dxf, pdf, pdf-cmyk, cmyk-tiff, tiff, png, jpeg, webp, avif | - | - | Type a word, get a pure-path vector wordmark in your brand font - recipients never need the font installed. |
| `work-avatar` | Work Avatar | everyone | png, jpg, webp, avif, svg, pdf | - | - | A round profile photo with a treatment and a ring of text - the campaign badge for LinkedIn and every other place you… |
<!-- /GEN:tools-main -->

## Utilities

On-device file utilities: bytes in, bytes out. Most take the user's own file
(`file` input) and never watermark or embed provenance. Reach for these through
`lolly_transform` (MCP) or `lolly <id> --source=<file>` (CLI).

<!-- GEN:tools-utilities -->
| ID | Name | Category | Formats | Requires | Capabilities | Purpose |
|---|---|---|---|---|---|---|
| `annotate` | Annotate | utility | png, jpg, webp, avif, tiff | - | - | Mark up your own screenshot on your device - arrows, boxes, numbered steps, callouts, highlighter and a spotlight dim. |
| `claim` | Claim | utility | png, jpg, webp, avif, tiff, gif, svg, penpot, pdf, mp4, webm, m4a, mp3, wav | c2pa | - | Claim your name on any media you've already made - image, PDF, video or audio. |
| `clean` | Clean | utility | wav, mp3, m4a, opus, mp4, webm | - | - | Clean a voice recording, trim edge silence and set its loudness on your device. |
| `color-palette` | Palette Lab | utility | svg, penpot, png, jpg, webp, csv, json, css, scss, gpl, ase, avif, pdf | - | - | Grow a palette from one seed colour - harmony accents, perceptual OKLab ramps and WCAG/APCA readability badges, with… |
| `compress-pdf` | Compress | utility | pdf | - | - | Shrink a PDF by recompressing its images - on your device. |
| `contrast-check` | Contrast | utility | svg, penpot, png, pdf, csv, json, jpg, webp, avif | - | - | Check a text and background pair, or every pairing in your brand palette, against WCAG 2.1 and APCA, and see how it r… |
| `convert-image` | Convert Image | utility | webp, jpg, png, avif | - | - | Turn HEIC, TIFF or any photo into WebP, JPEG or PNG - on your device. |
| `countdown-timer` | Countdown | utility | html | - | - | A focused countdown with a live progress ring. |
| `font-convert` | Convert Font | utility | ttf, otf, woff | - | - | Convert a font between TrueType, OpenType and WOFF - on your device. |
| `jump` | Jump | utility | html | - | - | A one-link landing page: your links, heading, portrait and colours on an expressive page - and the whole page lives i… |
| `pages` | Pages | utility | pdf, zip | - | - | Reorder, rotate, extract, delete, merge or split PDF pages on your device. |
| `prompt-card` | Prompt Card | utility | png, webp, jpg, avif, svg, penpot, pdf | - | - | Typeset a long prompt into one compact, legible image for a multimodal model - image input is often cheaper than the… |
| `rebrand-deck` | Rebrand | utility | pptx | - | - | Upload a PowerPoint deck and snap its colours and fonts to your brand - rebuilt on your device, nothing uploaded. |
| `redact` | Redact | utility | png, jpg, webp, svg, penpot, pdf | - | - | Black out sensitive content by rebuilding the file, then verify the output before it downloads, all on your device. |
| `sandbox` | Sandbox | utility | png, svg, penpot, pdf, jpg, webp | - | - | Paste HTML, CSS, JS - or a JSX/TypeScript component - and watch it run in a private, offline sandbox. |
| `scan-code` | Scan | utility | png | - | - | Read QR codes and barcodes on-device, with nothing sent to any cloud. |
| `screencap` | Screen Capture | utility | png, jpg, webp, avif, tiff | - | screen, microphone | Screenshot or record your whole screen, a window, or a browser tab. |
| `sign` | Sign | utility | pdf | - | - | Place your signature on a PDF, optionally add a Content Credential and lock the result. |
| `strip-data` | Strip Hidden Data | utility | jpg, png, svg, penpot, pdf | - | - | Reveal and remove hidden metadata from images and PDFs - on your device. |
| `text-helper` | Text Helper | utility | html | - | - | Format, decode, hash and de-identify text - JSON, JWT and more. |
| `trim` | Trim | utility | mp4, webm, gif, m4a, opus, wav | - | - | Cut an audio or video clip, change its container, mute it or extract its audio on your device. |
| `url-shot` | URL Screenshot | utility | png, jpg, webp, svg, penpot, pdf, webm, mp4, avif, tiff, gif | - | capture | Any web page, at any scroll-depth, with custom CSS |
<!-- /GEN:tools-utilities -->
