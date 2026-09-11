# Exporting & Formats

How to get a finished file out of a tool - picking the right format, setting the output size and what each option does. Like everything else, **export happens on your device**; nothing is uploaded.

## How export works

The preview *is* the file. When you export, the host renders that canvas to the format you chose and hands you a download (or puts it on your clipboard). A tool only offers the formats its author declared, and the picker hides any your browser can't produce (see [Video](#video)).

Three paths produce a file. Most tools **render the canvas** to the chosen format. Text and data formats (HTML, MD, TXT, JSON, CSV, ICS, VCF) are instead **generated from the tool's content**, not rasterised from the picture. And privacy utilities (e.g. *Strip Hidden Data*) use a third path: the file *you* pick is transformed byte-for-byte on device and handed straight back - no canvas, no watermark and no provenance metadata added, because it's already your own file.

The actions in the export controls:

- <!--i:download--> **Download** - save the file (the primary action).
- <!--i:photos--> **Copy** - put the image on your clipboard to paste straight into Slack, email, a doc. Where a browser can't copy images, it downloads instead and tells you.
- <!--i:folder--> **Save** - keep the current design as a saved tool session in your library.
- <!--i:link--> **Share** - opens the **Share dialog**: a copyable link that reproduces the design, on-visit toggles (fullscreen, export panel, download- or copy-on-open) and an optional **Shortest link** that packs the whole state into a compact token (see [URL Mode](/info/url-mode.html)).

(A tool's author picks which of these appear; the default set is Copy, Download and Save.)

![The export panel - format, size and the Copy / Download / Save / Share actions](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&walker=1&dark=1&filename=export-panel)

Share opens over the tool, with the link already built and the on-visit toggles under it.

### Rendering many at once

A single export is one file, but you can render **many** in one pass - each delivered as one `.zip`:

- <!--i:folder--> **Projects → Render folder** exports every saved session in a folder (and its sub-folders) as one nested zip; **Render selection** does the same for any multi-selection; a single saved session renders straight to its own file. No Batch/Pro needed - see [Using Lolly → Projects](/info/using.html).
- <!--i:layers--> **Batch (Pro)** renders a grid of input sets - every variant of one template at once.

A saved session can also be re-shared as a tool link from Projects (it reconstructs the tool URL from the saved inputs), so a link reopens it with the exact same settings.

## Choosing a format

The filename and the format picker sit at the top of the panel as one `name.format` pair, and the picker lists only the formats this tool's author declared.

![The filename field fused to the format picker, so the export reads as one name.format pair](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.filename-extension&walker=1&dark=1&filename=exp-format-picker)

| You want… | Use | Why |
|---|---|---|
| Crisp logos / artwork that scales | **SVG** | Vector - infinitely scalable, tiny, editable |
| Vector for Office / Windows apps | **EMF** | Pastes as editable vector into PowerPoint / Word; text stays live and editable, and Google Drive opens it in Google Drawings for Slides |
| Vector for print / design apps | **EPS**, or **EPS (CMYK)** | PostScript vector for Illustrator / press workflows |
| Vector for cutting / CAD machines | **DXF** | Laser cutters, vinyl plotters, CNC - outline paths in millimetres |
| An editable slide deck | **PowerPoint** (PPTX) | Native editable text + shapes, with images and vectors kept extractable |
| A course an LMS can import | **SCORM** (LMS) | A zip with the manifest, a launch page, the slides and the narrated film with captions - from a Design deck |
| An editable text document | **Word** (DOCX) or **OpenDocument** (ODT) | Real paragraphs and headings a word processor can keep editing (Doc Studio) |
| A photo or general-purpose image | **PNG** (lossless) or **JPG** (smaller) | Universal raster |
| Smaller modern images | **WebP** / **AVIF** | Better compression, alpha |
| Print | **PDF**, or **Print PDF** (CMYK) | True page size; CMYK for press |
| Print raster for a press | **Print TIFF** (CMYK) | DeviceCMYK pixels for a RIP |
| Animated for the web | **GIF** | Works everywhere, larger files |
| Animated with full colour + real alpha | **APNG** | Animated PNG - no palette limit, true transparency |
| Animated, smallest file | **Animated WebP** | Full colour + alpha, better-compressed than GIF or APNG |
| Animated vector that scales | **Animated SVG** | Self-contained; loops in a browser or `<img>`, no codec, any size |
| Video for social / sharing | **MP4** or **WebM** | Best quality-per-byte (see below) |
| Rich text / email signature | **HTML** | Pastes formatted into mail clients |
| Plain content | **MD** / **TXT** | Text only |
| A calendar event | **ICS** | Imports into any calendar app |
| A contact card | **VCF** | Imports into Contacts / address books |
| Structured data to re-import | **JSON** / **CSV** | Round-trips the tool's content |
| A favicon | **ICO** | Multi-size site icon (**ZIP** bundles several formats) |

The first row is the common case. A wordmark set in your brand face exports as SVG, where every letter is an outlined path rather than a pixel, so it stays crisp at a business-card size and at a building-wrap size from the same file.

![A hairline wide-tracked wordmark reading Aurora, the kind of pure vector artwork the SVG row of the table is about](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DAurora%26weight%3D200%26tracking%3D16%26size%3D200%26full&width=1440&height=900&dpi=192&waitMs=2200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-wordmark-vector)

## Size & print units

By default exports use the tool's native pixel size. Where a tool exposes **dimensions**, you can set width × height and a **unit**:

- **px** (default) - exact pixels.
- **mm · cm · in · pt · pc** - physical/print sizes. With a physical unit you also set **DPI** (default **300** for print); the engine converts correctly per format - **PDF** becomes a true page at that size, **raster** renders at the right pixel count for the DPI (and embeds the resolution), **SVG** keeps the physical unit with a px viewBox.

To get a higher-resolution raster, enter a larger width/height, or choose a physical unit and raise the DPI (pixels = size × DPI). There's no one-click scale toggle.

Example: width `210`, height `297`, unit `mm` → an A4 page.

![The dimensions row set to 210 by 297 mm, with the DPI field revealed because the unit is physical](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-dims&walker=1&dark=1&filename=exp-export-dims)

## Stills from a timed composition

A **timed composition** - a [Sequence](/info/using.html#timeline-sequence) timeline in Design, or any timeline-driven artboard - is a moving thing, so a still export has to answer "which moment?". The rule is what you'd expect: **the frame at the playhead**. Park the playhead where you want the picture and export; what you see is what comes out.

When you want more than one moment, the **Frames** field appears beside the output size (only for a timed composition, and only for a still format - PNG, JPG, WebP, SVG or PDF). Leave it at `1` for the playhead frame. Raise it and you get that many stills sampled at equal intervals across the whole sequence:

- **Raster and SVG** come back as one **zip** - `<name>-01.png`, `-02.png` and so on.
- **PDF** comes back as a **single document of that many pages**.

Useful for a storyboard, a thumbnail sheet, a contact sheet for review or a social carousel cut straight from a video edit.

Sampling is taken at the **midpoint** of each interval rather than at the edges, because the first instant of a sequence is often an enter transition that hasn't faded in yet and the last is the state after every clip has ended - endpoint sampling would spend two of your frames on near-blank ones. The count is capped at **64** (a contact sheet is for a human to read), and anything nonsensical typed into the field falls back to `1` rather than failing the export. Each frame is an ordinary still, so Content Credentials, the imprint, physical units and DPI all behave exactly as they do for a single export.

The **Frames** field is the way to get a sheet today. The engine reserves a matching `cuts` URL param, but no shell reads it from a link yet, so a shared link always reopens on the playhead frame - see [URL Mode](/info/url-mode.html#contact-sheets-cuts).

## Multi-page PDF

Some tools build a **multi-page PDF document** instead of a single artwork - a cover, content that flows onto as many pages as it needs and a back page, all in one file (see the *Booklet* tool). Each page is a **true PDF page** sized to that page's box, so readers and printers get real pages, not one tall image.

- **Pages from content.** Add blocks of text and images; new pages are created automatically as the blocks fill, and you can force any block to start a new page.
- **Real page sizes.** Choose A4, US Letter or A5 (portrait - the two-column layout is built for it) - every page, and the exported PDF, renders at exactly that size.

Multi-page PDFs are RGB documents and don't carry crop/bleed marks - those belong to the single-page **Print PDF** path above. They do carry the same **PDF/X-4 metadata** as every PDF export (page boxes, XMP, document ID, an sRGB output intent with embedded profile), and they offer **Content Credentials** (below) - on the *Booklet* tool the option comes pre-selected.

## Making many things at once

Lolly has three distinct ways to work at volume, and they solve different jobs - batch editing is a first-class capability of the platform, not something each tool reinvents:

- <!--i:document--> **One design × a table of rows → one multi-page document.** Tools with a `table` input (like *Battlecards*) turn every row into a page automatically - paste a table from your spreadsheet, get a deck-sized PDF. Your real batch editor stays the spreadsheet: fix ten rows there, paste again. The tool itself never manages pages.
- <!--i:layers--> **One design × a data file → many separate files.** The `/pro` batch grid takes a CSV and renders one export *per row* - name badges, certificates, one file each.
- <!--i:sliders--> **Many different assets, edited side by side.** *Multi-edit* opens several saved sessions in one view for coordinated touch-ups across distinct designs.

Rule of thumb: rows of the same design that belong in **one document** → a table-driven tool; rows that must ship as **separate files** → `/pro`; **different designs** that need the same tweak → multi-edit. (A planned "combine media" render option will bridge the first two - concatenating same-format exports into one PDF, one video or a proofing contact sheet.)

## PowerPoint (PPTX)

Design, Markdown Slides, Booklet, Doc Studio, Chart and Diagrams can export a **PowerPoint deck** - one slide per page. The point isn't a pixel-perfect screenshot; it's to hand a colleague a deck they can actually **edit and take assets out of**. So each page is decomposed into native objects:

- <!--i:font--> **Text** becomes real, **editable PowerPoint text boxes** - with the font size, colour, weight, italics and alignment from the layout - so you can fix a typo or restyle in PowerPoint.
- <!--i:pentool--> **Vectors** (logos, icons, the SUSE mark) are embedded as **real SVG pictures** - they stay crisp at any size, and PowerPoint can even *Convert to Shape* on them.
- <!--i:photos--> **Images** come through at their native resolution as their own extractable pictures (a `cover`-cropped hero keeps the full image behind the crop, so you can re-frame it), with any on-image treatment (filters, blends) baked in faithfully.
- <!--i:layers--> **Backgrounds, borders and rules** become real rectangle/line shapes.

![The export panel with PowerPoint chosen: one slide per page, text and shapes kept editable](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio%3Foptions&width=1440&height=900&dpi=192&waitMs=2500&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22pptx%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-pptx)

Layout is approximate by design - the goal is faithful, reusable **content**, not a locked screenshot. Anything the walker can't express natively (a complex filtered or masked region) is embedded as a picture so nothing is lost. A deck has a single slide size, taken from the first page.

PowerPoint is also a way **in**. Drop a `.pptx` on any upload surface and pick the slides you want - each becomes an asset to place, grade or build on. **Markdown Slides** writes a fresh deck from Markdown (and hands out a branded `.pptx` template), and the **Rebrand** utility re-themes an existing deck in place - theme palette, hardcoded colours and fonts - without touching its charts, SmartArt or animations, handing back a `.pptx`. See [Import a design → Decks and documents](/info/design-import.html#decks-and-documents).

## Penpot

Any tool that can export SVG can also export a **Penpot file** (`.penpot`) - the document, ready to keep editing in Penpot rather than just to look at.

- <!--i:layout--> From **Design**, each frame becomes a Penpot **board**, every box on it carries over as its own editable shape - rectangle, ellipse, text, image or path - and the result arrives as a reusable **component** in the Assets panel, ready to drag out again.
- <!--i:pentool--> From a tool whose render is **plain geometry** - the vector tools such as QR Code, Street Map, Wordmark and Palette Lab - every path, rectangle, text run and gradient carries over the same way, as its own editable shape.
- <!--i:font--> From a tool that lays its render out in **HTML**, the **text stays text** - one editable Penpot text object per line, not an outline and not a flat picture. A piece of artwork Penpot has no construct for - a complex illustration, a live canvas - rides along on its own as an image, so it never flattens the text and boxes around it. A whole layout Penpot cannot separate faithfully can still come across as one picture at full fidelity, so nothing is ever dropped.
- <!--i:palette--> A colour or font a shape **inherits from a brand token** stays **linked** to that token in the file: change the token in Penpot's Tokens panel and every shape that inherits it re-paints together, while a one-off literal colour stays exactly where it is. The brand's colours and typographies also land in the **Assets** panel and its full design-token set in the **Tokens** panel - the same DTCG token set Lolly's own palette uses. Penpot keeps its own copy from there: an edit made in its Tokens panel comes back into the brand through [Brand Studio's import](/info/design-import.html), not on its own.

| What you made | In Penpot |
|---|---|
| Text | Editable text objects - fix a typo or restyle |
| Shapes, paths, gradients, images | Their own editable vector shapes |
| A colour or font from a brand token | A live token link - edit the token, every shape that inherits it follows |
| The whole design | A reusable component in the Assets panel |
| A complex illustration or live canvas | Embedded on its own as an image, the editable content around it untouched |

![The export panel with Penpot chosen: the .penpot file, and Send to Penpot beside the download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&drive=click%3A%5Bdata-fmt-trigger%5D%3Bwait%3A400%3Bclick%3A%5Bdata-fmt%3D%22penpot%22%5D%3Bwait%3A800&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-penpot)

To open it, start Penpot, pick a project and choose **Import**. Signed in to Penpot from the export panel, **Send to Penpot** does that step for you - pick a project there and the file goes straight into it.

## SCORM (course packages)

A Design deck can leave as a **SCORM package** - the zip a learning management system imports, whether that is Moodle, Canvas, Blackboard or a corporate LMS. Pick **SCORM (LMS)** in the format picker and the export writes:

- <!--i:layout--> **The slides**, one image per artboard, as vector where the artboard allows it and as pixels only where it does not.
- <!--i:play--> **The narrated film** with its caption track - the speaker notes read by an on-device voice, exactly as [Presenting](/info/create/using.html#presenting) plays them.
- <!--i:file--> **A launch page** that steps through the slides, plays the film and reports completion back to the LMS through the SCORM 1.2 runtime, the version every LMS accepts.
- <!--i:font--> The fonts the deck uses, so the launch page renders the same offline.

![The export panel on a Design deck with SCORM (LMS) chosen](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3Dfeature-tour%26format%3Dscorm%26options&width=1440&height=900&dpi=192&waitMs=3500&css=.fc-insp%7Bdisplay%3Anone!important%7D.edge-dock-slot--fill%7Bflex%3A1%201%20auto!important%3Bheight%3Aauto!important%3Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D.export-popup.is-floating%7Bheight%3Aauto!important%7D.export-popup-body%7Bmax-height%3Anone!important%3Boverflow%3Avisible!important%7D&cropSelector=.export-popup&walker=1&format=svg&dark=1&filename=exp-scorm)

Nothing in the package calls home: it is files in a zip, and it runs inside the LMS with no bundler, no CDN and no account. The web and desktop apps build it; the CLI does not, because photographing the artboards and encoding the film need the browser.

## DXF (cut files)

Vector tools (Brand Lockup, QR Code, Street Map, Wayfinding Signage, Pose Geeko, the logo lockups, Diagram Builder) can export **DXF** - the AutoCAD R12 interchange format that laser cutters, vinyl plotters and CNC/CAD software read. Geometry is written as outline **paths in millimetres** (curves flattened to a fine tolerance), text is outlined to paths and colour maps to the nearest AutoCAD Color Index (which typically drives the tool/operation on a cutter). DXF is line-art only - a photographic or filtered region has no cut-path form and is dropped (Lolly warns), so use SVG/PDF when you need to keep raster content.

Street Map is the clearest case: the whole design is already strokes, so every road and canal becomes a cut path with nothing to drop.

::: showcase
![A Street Map render of Paris in ink on cream - pure line art, so every stroke survives the trip to a cutter](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Dparis%26roadColor%3D1a1a2e%26waterColor%3D93c5fd%26background%3Dfaf7f2%26full&width=1440&height=900&dpi=96&waitMs=3200&cropSelector=%23tool-canvas&walker=1&format=svg&dark=1&filename=vt-street-map-cut)

Scroll, and the camera pulls back through the actual geometry: seven paths, no pixels anywhere, every stroke hairline-crisp at any zoom. That is the same file a cutter reads.
:::

## Animated SVG

Motion tools (Animated Ad, Lottie Ad) can export **Animated SVG** - a self-contained, *vector* animation. Unlike GIF/APNG/WebP (which sample each frame to pixels), an animated SVG stacks vector snapshots with embedded CSS keyframes, so it **scales to any size with no codec and no external runtime** - it loops in a browser tab or an `<img>`. Text stays outlined so it renders anywhere. It shares the animated formats' **Duration** / frame-rate controls, and (being heavier per frame than a bitmap) uses a lower default frame rate.

## Transparency

Tools that support it offer a **transparent background** toggle (e.g. *No BG*). Transparency is preserved by PNG, WebP, AVIF, SVG (still and animated), APNG and Animated WebP. JPG and PDF are always opaque, and TIFF flattens onto white (onto black on the HDR path - see below).

## Colour spaces

Two different questions, worth keeping apart: which colour spaces Lolly can **read and think in**, and which ones it **writes**.

**Reading.** Wherever a colour is written - a tool's stylesheet, an imported SVG's paint, a design token's value, a shadow or gradient inside a CSS shorthand - Lolly reads the full **CSS Color 4** vocabulary: `#hex`, `rgb()`, `hsl()`, `hwb()`, `lab()`, `lch()`, `oklab()`, `oklch()`, the CSS named colours and `color()` in the predefined spaces - `srgb`, `srgb-linear`, `display-p3`, `a98-rgb`, `prophoto-rgb`, `rec2020`, `xyz-d50`, `xyz-d65` - including components written as the `none` keyword. One parser does this for the whole platform, so the browser and every export walker agree on what a colour string means.

That matters more than it sounds, because a browser resolves modern CSS into modern CSS. Write `color-mix(in oklab, …)` and Chrome computes `oklab(…)`; use a brand token stored as `oklch()` and that's the literal value the export walker sees. Colours in those forms are read correctly rather than dropped - which is what a walker that only understood `rgb()` did, exporting brand-coloured text as black, losing tinted panels and table rules and reading `oklch(0.7 0.1 200) 0px 2px 4px` as a shadow offset of 0.7 by 0.1.

**Thinking.** Colour maths happens perceptually rather than in raw channels. Palette derivation, ramps, harmonies and contrast run in **OKLCH/OKLab**, and an out-of-gamut colour is brought into range by CSS Color 4's own gamut-mapping algorithm - chroma reduction with a perceptual-distance check - rather than by clipping channels, so a vivid colour settles on the nearest colour you'd actually accept instead of a flattened one. Gradients interpolate in a space you pick (OKLab by default, or `oklch`, `lab`, `lch`, `srgb`, `srgb-linear`, `hsl`, with a hue-travel direction for the polar ones), and mixing is **premultiplied**, so a fade to transparent stays the right colour instead of darkening toward black on the way. One interpolator serves both the preview and the export walkers - which is what stopped a conic gradient from being blended one way on screen and another in the exported file.

**Writing.** The output is deliberately narrower than the input, because a file has to be readable by whatever opens it, and a space is only ever *declared* on output when the numbers were really converted into it. Screen and web formats are written as **sRGB** and tagged as such; the print formats are written as **CMYK** against a named press condition (below); and the HDR path is **Rec.2100 PQ** (above). A wide-gamut colour that reaches an export is mapped into sRGB rather than mislabelled - carrying `color(display-p3 …)` through into a vector file is a planned extension, not something today's exports claim to do. A gradient authored in OKLab is *baked* to plain sRGB stops on the way out, with extra stops inserted only where sRGB would visibly diverge from the perceptual curve, because an SVG `<linearGradient>` and a PDF axial shading have no interpolation-space setting to carry the intent. One authored value, three renderers, no drift.

## Colour profiles

So colours reproduce faithfully in colour-managed apps (print shops, Photoshop, browsers), exports are **tagged with a colour profile**:

- **PNG / JPG** carry an embedded **sRGB** ICC profile - the colour space the preview is actually rendered in - so nothing is left to guess. (Tagging only; the pixels aren't re-encoded.)
- **Print PDF (CMYK)** declares a target **press condition** in its *OutputIntent* (default *Coated FOGRA39*), telling a RIP/print shop how its CMYK inks are meant to be read. Brand swatches with measured ink values are converted exactly; other colours use a standard device conversion. That declaration is a *name*: no CMYK profile ships with Lolly, and PDF/X-4 wants the profile embedded, so a named condition writes the output intent without claiming PDF/X-4 conformance. Load a CMYK profile of your own and choose its **Embed** row in the Colour profile control and it is embedded as the file's *DestOutputProfile* - at which point the PDF can genuinely be PDF/X-4, and claims it whenever the rest of the file allows. Three things withhold the claim while keeping the output intent (a RIP still wants that): RGB artwork the CMYK pass couldn't convert, the `prov` proof-margin credit text (drawn in a standard font that isn't embedded, and X-4 makes no exception for those) and a **Strong** password, since X-4 forbids encryption. The condition it declares is then read off that profile: a registered name where the profile proves one, `Custom` under the profile's own name where it does not, so the file can never name one press condition while carrying another's measurements.
- **Print TIFF (CMYK)** writes untagged **DeviceCMYK** pixels and records the same press condition as provenance in its TIFF metadata (*ImageDescription*) rather than embedding a profile. The same Colour-profile control drives both CMYK formats - a TIFF cannot embed a press profile at all, so an **Embed** row records that profile's own name there and nothing more.
- **TIFF (RGB)** is the plain, uncompressed sRGB sibling - a lossless raster at the chosen DPI for archival or an editor round-trip, with provenance recorded in the same TIFF metadata. Any transparency is flattened onto white (this profile carries no alpha). Like the CMYK TIFF it's desktop-only, since browsers can't preview a TIFF and mobile downloads dead-end.
- **SVG**, **EMF**, **EPS** and **DXF** are resolution- and profile-independent vectors with no embedded profile - SVG's colours are plain sRGB, EMF's and EPS's are device RGB (and **EPS (CMYK)** writes naive DeviceCMYK) and **DXF** carries the nearest AutoCAD Color Index. (SVG, EPS and DXF, like PDF, outline any text to vector paths, so the result renders even where the font isn't installed. EMF instead keeps text LIVE by default - real metafile text records that stay selectable and editable in Office and Google Slides, falling back to outlines only for runs the format cannot express; the export panel's "Outline fonts" option forces paths everywhere.) **SVG** also reproduces CSS `box-shadow` from the HTML - each outer shadow is painted behind the box, offset/spread and Gaussian-blurred to match the browser, and inset shadows are painted inside it the same way.

This is automatic - no setting to fiddle with. Thumbnails and previews skip the tag to stay small. One profile *is* a choice, because it changes the pixels rather than just labelling them - see **HDR** below.

## HDR (bright colours)

Ordinary exports are sRGB: white is white, and a saturated brand colour is as bright as the screen's normal white. On an HDR-capable display there's a lot of headroom above that, and the **HDR** card in the export panel uses it - your brand colours and white text are boosted toward peak brightness so they genuinely *glow*, while the dark areas stay dark and give the glow its contrast.

![The HDR card in the export panel, switched on, with the White / Reach / Dark lift / Focus dials revealed under it](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26hdr%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-hdr&walker=1&dark=1&filename=exp-hdr-card)

- **Formats.** The raster formats with a place to carry the signal: **PNG**, **JPG**, **AVIF** and **TIFF**. (Not WebP - it's 8-bit with no working HDR decode path, so a PQ WebP would simply look dark. Vectors and PDF have no HDR model at all.)
- **Off by default**, unlike colour tagging - it changes the pixels, so it's opt-in. Tick the card, or pass `hdr=1` in a share link.
- **What's actually written.** The pixels are re-encoded to **Rec.2100 PQ** - BT.2020 primaries with the SMPTE ST 2084 (PQ) transfer curve - and the container carries the matching signal so a colour-managed app knows to read them that way: a generated **ICC v4 profile with a `cicp` tag** (JPG, TIFF), a **`cICP` chunk** (PNG) or a rewritten `colr` box (AVIF). The boost is gated on **perceptual (OKLab) lightness**, so mid-and-above colours punch to peak and dark ones are calmed rather than blown out, and it's hue-preserving - a brand green gets brighter, not minty.
- **The dials.** Four, revealed when the card is on: **White** (the peak-brightness ceiling, 400–2000 nits), **Reach** (how far down the tones the glow spreads), **Dark lift** (how much the darks brighten - `0` keeps them dark) and **Focus** (how much colour richness the boost keeps). They ride in the same param as a compact tuned value - `hdr=1600-60-0-50` is White 1600, Reach 60, Dark lift 0, Focus 50 - so a tuned look is reproducible from the link.
- **Where you'll see it.** Colour-managed viewers on an HDR display: Preview / Quick Look / Safari on Apple devices, Chrome on an HDR monitor. On an ordinary SDR screen the file still shows as a normal image.
- **Know before you ship it.** Many platforms **re-encode** what you upload and strip the HDR signal - social networks, messaging apps, some CMSes - which can leave the image looking dark or washed out. Use HDR where you control the destination (a site you build, a video wall, a deck on a bright panel), not as a default for everything.
- **Transparency.** PNG and AVIF keep their alpha; JPG is opaque as always. The **TIFF** path flattens onto **black**, not the SDR path's white - in PQ, white is the 10,000-nit code, so flattening onto it would ring every edge with a blinding halo.
- **The same bytes from the terminal.** `--hdr=1` with `--export=png` or `--export=jpg` writes the 16-bit Rec.2100 PQ PNG and the ISO 21496-1 gain-map JPEG on the [CLI](/info/cli.html) too, out of the same engine encoders rather than a browser - so an `<svg>`-native tool produces an HDR file with no Chromium anywhere in the path, and the PNG is byte-identical to the web shell's. AVIF and TIFF stay web-shell exports for now.

## Video

Animated tools export motion as **MP4**, **WebM** or **GIF** - and, where offered, **APNG**, **Animated WebP** or the vector **Animated SVG** (above). Which video container you see depends on your browser - the picker only shows what it can actually record:

| Browser | Shows |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 and WebM** |
| Older Chrome | **WebM** |

GIF works everywhere (great for chat/email; larger and lower-colour than video). Animated tools also expose **Wait** (seconds to let the animation settle before recording) and **Duration** (clip length).

> A shared `?format=…` link that requests a container your browser can't record gracefully falls back to the other and names the file accordingly.

**Sound.** Video exports aren't silent. A tool can lay a **music bed** under the clip - an audio asset from the catalogue, looped or trimmed to the clip length, with fade-in/out, volume and automatic ducking under the footage's own sound - and the recording tools carry their footage's live audio straight through to the file. **MP4** and **WebM** keep the mixed track; GIF and the animated image formats (APNG, Animated WebP, Animated SVG) are silent by nature.

## Audio

Some tools export **audio on its own**, not just as a video track. The **Voice Recorder** captures a mic take with a live level meter and gentle coaching, then saves it as **MP3** (the default, transcoded in your browser) or in its native container - **M4A** (AAC), **OGG** or **WebM** (Opus), whichever your browser recorded. As with everything else, the encode happens on your device - nothing is uploaded.

Audio you *bring in* is just as broad. The asset picker accepts **MP3**, **WAV**, **OGG**/**Opus**, **M4A**/**AAC** and **FLAC** (kept byte-for-byte and decoded on-device), **MIDI** (`.mid` - converted on import to a tiny on-device synth track) and **tracker modules** - **MOD**, **XM**, **IT**, **S3M**, **STM**, **MTM** (decoded on-device by a bundled player, a few kilobytes of song data). Any of these can become the **music bed** under a video export, or play in Neurospicy Mode's ambient player.

Audio *is* part of the `format=` / `--export=` pipeline below: `wav`, `mp3`, `m4a` and `opus` are ordinary format ids, so an audio-only export is as shareable and as scriptable as a PNG. What comes out is the sound alone, no picture.

## Provenance & watermark

Where the format supports it, exports carry **provenance metadata** - software, source, the tool's name and your profile credit line - embedded natively (PNG iTXt, JPEG EXIF, PDF info, SVG `<metadata>`, GIF comment). It's authorship only; nothing is uploaded. **Experimental** tools additionally stamp a visible watermark, applied by the host so it can't be removed by editing the tool.

**The Lolly Imprint.** Raster exports also carry Lolly's own **invisible pixel watermark** - the *Lolly Imprint* - **on by default**, just like Content Credentials. Where the credential and the provenance metadata travel *alongside* the pixels and are lost to a re-save, a screenshot or a metadata strip, the Imprint lives *in* the pixels and survives recompression - so a copy of the image can still be recognised as Lolly-made later. It's a durable hint, not a cryptographic guarantee, and it's presence-only (it carries no personal data). It rides in **PNG, JPG, WebP, AVIF, TIFF and BMP**, and in the Lolly-rendered rasters composited into a **PDF or PPTX** - never in an image *you* embedded, only in what Lolly itself renders. Uncheck the **Lolly Imprint** card in the export panel to skip it, or pass `imprint=0` in a share link. (AVIF survival through re-encoding isn't calibrated yet; PDF/PPTX detection covers the embedded Lolly rasters.) [/verify](/verify) detects it on-device - see [Content Credentials Identity](/info/content-credentials-identity.html#the-lolly-imprint).

**The durable credential.** A second, heavier mark sits beside the Imprint: **Durable credential**, which uses an on-device neural model (TrustMark format) to write Lolly's id *into* the pixels so the "made with Lolly" link survives a metadata strip, a re-encode and re-reading by TrustMark-aware tools as well as Lolly's own. It's **off by default** - unlike the pure-JavaScript Imprint it costs a neural pass per export plus a one-time model download, so it's a deliberate opt-in rather than a quiet tax. Raster only (**PNG, JPG, WebP, AVIF, TIFF**), ticked in the export panel or passed as `durable=1` in a share link. On the desktop and mobile apps the card is hidden outright rather than shown as a no-op, because there's no origin to fetch the model from offline.

**Content protection.** In the export panel, *Password protect*, **C2PA Credentials**, the **Lolly Imprint** and the **Durable credential** fold into one collapsed, format-aware **Content protection** group, so a file's provenance and protection options live in one place - the group shows only the cards that apply to the chosen format, and hides itself entirely when none of them do. Print marks are deliberately *not* in it: they're print production geometry rather than protection, so **Print marks & bleed** - the bleed measurement in millimetres plus Crop, Registration, Bleed, Colour bars and Stamp details - keeps its own top-level card on the print formats.

![The Content protection group opened on a PNG export, showing only the cards that apply to it](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26imprint%3D1%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-protection&dark=1&filename=exp-content-protection)

**Before you export (print preflight).** Turn on **Print preflight** (`export-preflight`) in your Profile's feature flags - it is **off by default**, so an individual exporting a PNG for a chat message is never ambushed by prepress findings, and a deployment's control plane ([lolly.work](https://lolly.work)) can default it on for its members - and a **Before you export** card appears at the foot of the panel, immediately above the buttons, whenever the print rules have something true to say about the job: format, size and bleed, then trim and bleed areas, ink coverage, plate counts and page count, with a verdict beside its heading. It sits under every setting because it's a statement *about* those settings rather than another one of them - and it never blocks an export. It tells you what a print shop is about to see.

**Cost, worked out from your rate card.** Below preflight - last of all, still above the buttons - sits a card that turns those same counts into money, and only ever from prices somebody gave it. It reads whatever the preflight pass counted, whether or not the preflight card itself is switched on, and it needs two things to be true: the job has something a price list can price at all (plates, sheets, area, pages, variant rows or output files - so a plain logo PNG never shows it), **and** a **rate card** is present. A rate card is a JSON price list from your printer. A default build carries none and has no in-app way to load one: it arrives either as a catalogue asset a deployment ships, or through the optional rate-card extension a self-hoster or control plane switches on. With no rate card, nothing is shown - not a prompt, not an empty table.

The rule the whole thing is built around is that **it never invents money**. Every figure is a rate you supplied times a quantity Lolly counted - `4 plate × €35.00` - and the total names its own source in the same sentence as the figure: the issuer the card names, and the date the card says its rates are from. There is no default currency, no placeholder and no zero standing in for a missing price. What the file says about itself stays reported speech: *"The file says: … Lolly has not verified this."*

And when it can't compute honestly, the working table **disappears** rather than degrading into a greyed-out or filled-in figure:

- Lines the card doesn't price mean **no total at all** - just a headline saying how many of them are unpriced. A partial sum isn't a smaller answer, it's a wrong one.
- A quantity that's a ceiling rather than an exact count carries **"up to"** through into its subtotal, so a bound is never laundered into a flat figure.
- Rates past their valid-until date show **counts only**, until you press *Use these rates anyway* - and then the expiry date rides with the figure, so a lapsed total can't be read as a current one.
- Opened through a **link**, money stays hidden until you ask for it on this device. Neither the card nor that reveal ever travels in a URL - the same reason the CLI takes `--rate-card=<file.json>` as a local file flag and never as a link param.

The card is chrome, never content: it's stripped from every export stage, so it cannot move a pixel of the file you download. And it's arithmetic, not a quote - only your printer can give you one.

**Composed renders.** When a tool embeds another tool's output (e.g. an *Event Name Badge* embedding a *QR Code*), the nested render is inlined into the parent's export - it stays a **true vector** in SVG and PDF and rasterises crisply in PNG/JPG/WebP. The embedded child is an intermediate: it gets *no* watermark and *no* provenance of its own; only the finished parent asset does. (Composition covers SVG and the raster formats; HTML/MD/TXT can't be composed.)

## Password protection

Two independent kinds of lock, both entirely on-device.

**PDF open-password** - the export panel's *Password protect* card offers two tiers:

![The Password protect card expanded on a PDF export, with the password field and the two lock tiers](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf%26password%3Ddemo%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-pdfpass&dark=1&filename=exp-pdf-password)

- **Standard** - a basic 40-bit lock (RC4). It opens in *any* PDF app, and - being a light deterrent, not real protection - it can travel in a share link (clear-text, by design). RGB `pdf` only.
- **Strong** - AES-256 (PDF 2.0). Its password is typed at export and is **never** put in a link; it opens only in newer PDF apps (Acrobat / Preview ~2018 on), and older apps may report the file as damaged. Strong also applies to **Print / CMYK PDFs** and to **each PDF inside a batch zip** (the batch confirm dialog collects the password). Because PDF/X-4 forbids encryption, a Strong-locked Print PDF keeps its CMYK, marks and output-intent but drops the PDF/X-4 conformance claim.

Either tier is mutually exclusive with Content Credentials (an encrypted PDF can't take the credential).

**Locked downloads (whole-zip + defense-in-depth)** - a **ZIP** export (the export panel's *ZIP* format, which bundles several of a tool's formats), a **folder** download (Projects → Download) or the **batch grid** can lock the entire zip with one password, at two tiers:

- **Standard** - traditional **ZipCrypto**: opens in *any* unzip tool including Windows Explorer's built-in extract, but weak (a deterrent). Its password can travel in a `?password=` share link.
- **Strong** - **AES-256** (WinZip AE-2): strong, but does **not** open in Windows Explorer's built-in extract - the recipient needs 7-Zip / WinZip / Keka / macOS. Typed at export, never put in a link.

The same *Password protect* card in the export panel drives both the PDF and ZIP locks, rewording itself for the chosen format. The one password protects **every** member - images, SVG, everything, PDFs included (only the zip container can protect non-PDF files, which have no lock of their own). And it's **defense-in-depth**: any PDF inside is *also* individually AES-256-locked with the same password, so a PDF stays locked even after the zip is unpacked. The prompt appears when you start the download; a blank password means no lock.

**Password-gated share links** - any share link can be encrypted so that opening it asks the recipient for a password. The whole link state is AES-256-encrypted under a key derived from the password (PBKDF2); only ciphertext travels, so the **password is never in the link** and decryption happens **in the recipient's browser** - the server that serves the link sees only the ciphertext in the URL, never the password and never the decrypted design. Turn it on in the **Share** dialog. An encrypted link can only be *opened* in Lolly (it can't be embedded as an image, since that path can't prompt). See [URL Mode → Encrypted links](/info/url-mode.html).

## Content Credentials (C2PA)

Exports can carry **Content Credentials** - a signed [C2PA](https://c2pa.org) manifest embedded in the file that records, in a tamper-evident way, that the file was made with Lolly and hasn't been altered since. It's the standards-track version of the provenance metadata above: a cryptographic claim (what made the file, when, by whom and where) bound to a hash of the file's bytes, so any later edit is detectable by a C2PA-aware viewer. The standard is stewarded by the [Content Authenticity Initiative](https://contentauthenticity.org) (Adobe, BBC, Microsoft, Nikon and others), so the same credentials Lolly writes are the ones cameras, newsrooms and creative suites are adopting.

![The C2PA Credentials card, pre-ticked, with the credential lifetime beside it](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26c2pa%3D30%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-c2pa%5Bdata-c2pa-only%5D&walker=1&dark=1&filename=exp-c2pa-card)

- **Formats.** Every container with a C2PA embedding: **PDF** (both RGB and Print), **PNG / Animated PNG**, **JPG**, **GIF**, **SVG**, **TIFF** (RGB and Print), **WebP** (still and animated), **AVIF**, **MP4**, **WebM** and the audio containers **MP3**, **WAV**, **M4A** and **OGG/Opus** - so a recorded or synthesised voice clip ships with the same credential a picture does. A **ZIP** bundle stamps each supported member individually, which is also where an **Animated SVG** picks one up (it's an ordinary SVG document underneath; a direct Animated SVG export offers no card of its own). MP4, AVIF and M4A use the spec's BMFF binding and MP3 its ID3v2 mapping, so `c2patool` and other C2PA-aware viewers verify them; **WebM** and **OGG/Opus** have no standardised C2PA mapping yet, so Lolly carries the manifest as a Matroska attachment and an OpusTags field respectively, which Lolly's own verifier (and CLI) checks. (`ico`, `eps`, `emf`, `dxf`, `bmp`, `pptx`, the Office formats and the text/data formats have no C2PA container.)
- **On by default.** The **C2PA Credentials** card in the export panel comes pre-selected for nearly every tool - untick it to skip the credential on a single export (or pass `c2pa=off` in a share link). A tool can opt out entirely in its manifest.
- **What it records.** The tool and app that made the file, the signing time, the export surface (browser engine family + OS family - coarse on purpose, never a fingerprint) and - only when *Profile → Use my details* is on - your name and email as the work's author.
- **What recipients see.** Inspect-content-credentials tools (Adobe apps, `c2patool`, contentcredentials.org/verify) will read the manifest and show the claim. Because Lolly signs with a key generated **on your device** - not a certificate from a trust list - viewers report it as an *unverified* credential. The structure and the tamper-evidence are real; the signer identity is simply not vouched for by an authority. To upgrade that, you can enrol a **verified identity** (Profile → Content Credentials): a short-lived certificate from the Lolly CA ties your email to your exports while the signing key still never leaves your device - see [Content Credentials Identity](/info/content-credentials-identity.html).
- **Checking a file.** Lolly verifies its own credentials too: drop any file on [/verify](/verify) (or run `lolly validate <file>` in the CLI) for an on-device report - headlined by whether the file was genuinely made with Lolly and unchanged since. The web Verify view reads well beyond the credential: it flags **AI-generated content**, detects the **Lolly Imprint**, checks **SEAL** signatures and (opt-in) third-party pixel watermarks and surfaces **hidden data** - all on-device, nothing uploaded. See [Content Credentials Identity → Beyond the credential](/info/content-credentials-identity.html#beyond-the-credential-what-else-verify-shows).
- **Privacy.** Everything happens on your device: the signing key is created for the export and never leaves the browser, nothing is uploaded and the claim contains only what the provenance metadata already carries. Privacy utilities (on-device transforms of *your own* files) never add credentials, and *Strip Hidden Data* will remove a C2PA manifest like any other embedded metadata.
- **Interactions.** For PDFs, Content Credentials and **password protection** (either tier - see above) are mutually exclusive (an encrypted PDF can't take the credential attachment). The credential is added as the final step over the finished bytes - after DPI/EXIF/colour-profile stamping, PDF/X metadata and print marks.

## On a phone

The export controls live behind the floating **Render** button, which opens the **Export** sheet - same formats, size, copy, download and share, sized for touch.

## Format reference

Every id the host can render, grouped. These are also the values for the URL `format=` parameter and the CLI `--export=` flag - see [URL Mode](/info/url-mode.html) and [CLI](/info/cli.html). A tool offers only the subset its author declared, so the picker is always shorter than this list.

| Kind | Ids |
|---|---|
| Raster | `png` · `jpg`/`jpeg` · `webp` · `avif` · `tiff` (RGB TIFF) · `cmyk-tiff` (Print TIFF) · `bmp` · `ico` |
| Vector | `svg` · `svgz` (gzipped SVG) · `emf` · `wmf` · `eps` · `eps-cmyk` (EPS CMYK) · `dxf` (cut file) |
| Page & document | `pdf` · `pdf-cmyk` (Print PDF) · `pptx` (PowerPoint) · `scorm` (SCORM course package, a zip) · `penpot` (Penpot design file) · `docx` (Word) · `odt` (OpenDocument Text) |
| Motion | `gif` · `apng` (Animated PNG) · `webp-anim` (Animated WebP) · `svg-anim` (Animated SVG) · `webm` · `mp4` |
| Audio | `wav` · `mp3` · `m4a` · `opus` |
| Text & data | `html` · `md` · `txt` · `json` · `csv` · `ics` · `vcf` · `css` · `scss` · `gpl` (GIMP palette) |
| Bundle | `zip` |

A few more ids come from a **tool's own export hook** rather than the shared render path: `ase` (Adobe Swatch Exchange, from Palette Lab), `exr` and `hdr` (Darkroom's high-dynamic-range rasters) and `ttf` / `otf` / `woff` (Font Convert). They pick a format the same way - the picker, `format=`, `--export=` - the bytes are just built by the tool. Font Convert is the one exception: it transforms a font file *you* supply, so there's nothing for a bare URL to render.
