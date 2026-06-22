# Exporting & Formats

How to get a finished file out of a tool — picking the right format, setting the output size, and what each option does. Like everything else, **export happens on your device**; nothing is uploaded.

## How export works

The preview *is* the file. When you export, the host renders that canvas to the format you chose and hands you a download (or puts it on your clipboard). A tool only offers the formats its author declared, and the picker hides any your browser can't produce (see [Video](#video)).

Three actions sit in the export controls:

- **Download** — save the file (the primary action).
- **Copy** — put the image on your clipboard to paste straight into Slack, email, a doc. Where a browser can't copy images, it downloads instead and tells you.
- **Copy URL / Share** — copy a link that reproduces the design (see [URL Mode](/info/url-mode.html)).

## Choosing a format

| You want… | Use | Why |
|---|---|---|
| Crisp logos / artwork that scales | **SVG** | Vector — infinitely scalable, tiny, editable |
| A photo or general-purpose image | **PNG** (lossless) or **JPG** (smaller) | Universal raster |
| Smaller modern images | **WebP** / **AVIF** | Better compression, alpha |
| Print | **PDF**, or **Print PDF** (CMYK) | True page size; CMYK for press |
| Animated for the web | **GIF** | Works everywhere, larger files |
| Video for social / sharing | **MP4** or **WebM** | Best quality-per-byte (see below) |
| Rich text / email signature | **HTML** | Pastes formatted into mail clients |
| Plain content | **MD** / **TXT** | Text only |

## Size & print units

By default exports use the tool's native pixel size. Where a tool exposes **dimensions**, you can set width × height and a **unit**:

- **px** (default) — exact pixels.
- **mm · cm · in · pt · pc** — physical/print sizes. With a physical unit you also set **DPI** (default **300** for print); the engine converts correctly per format — **PDF** becomes a true page at that size, **raster** renders at the right pixel count for the DPI (and embeds the resolution), **SVG** keeps the physical unit with a px viewBox.
- **2×** — a quick toggle to double the raster resolution.

Example: width `210`, height `297`, unit `mm` → an A4 page.

## Transparency

Tools that support it offer a **transparent background** toggle (e.g. *No BG*). Transparency is preserved by PNG, WebP, AVIF, and SVG. JPG and PDF are always opaque.

## Colour profiles

So colours reproduce faithfully in colour-managed apps (print shops, Photoshop, browsers), exports are **tagged with a colour profile**:

- **PNG / JPG** carry an embedded **sRGB** ICC profile — the colour space the preview is actually rendered in — so nothing is left to guess. (Tagging only; the pixels aren't re-encoded.)
- **Print PDF (CMYK)** declares a target **press condition** in its *OutputIntent* (default *Coated FOGRA39*), telling a RIP/print shop how its CMYK inks are meant to be read. Brand swatches with measured ink values are converted exactly; other colours use a standard device conversion.
- **SVG** is resolution- and profile-independent; its colours are plain sRGB values.

This is automatic — no setting to fiddle with. Thumbnails and previews skip the tag to stay small.

## Video

Animated tools export motion as **MP4**, **WebM**, or **GIF**. Which video container you see depends on your browser — the picker only shows what it can actually record:

| Browser | Shows |
|---|---|
| Safari / iOS | **MP4** |
| Firefox | **WebM** |
| Chrome / Edge 126+ / Android | **MP4 and WebM** |
| Older Chrome | **WebM** |

GIF works everywhere (great for chat/email; larger and lower-colour than video). Animated tools also expose **Wait** (seconds to let the animation settle before recording) and **Duration** (clip length).

> A shared `?format=…` link that requests a container your browser can't record gracefully falls back to the other and names the file accordingly.

## Provenance & watermark

Where the format supports it, exports carry **provenance metadata** — software, source, the tool's name, and your profile credit line — embedded natively (PNG iTXt, JPEG EXIF, PDF info, SVG `<metadata>`, GIF comment). It's authorship only; nothing is uploaded. **Experimental** tools additionally stamp a visible watermark, applied by the host so it can't be removed by editing the tool.

## On a phone

The export controls live behind the floating **Render** button, which opens the **Export** sheet — same formats, size, copy, download, and share, sized for touch.

## Format reference

`png` · `jpg`/`jpeg` · `webp` · `avif` · `svg` · `pdf` · `pdf-cmyk` (Print PDF) · `html` · `md` · `txt` · `webm` · `mp4` · `gif`. These ids are also the values for the URL `format=` parameter and the CLI `--export=` flag — see [URL Mode](/info/url-mode.html) and [CLI](/info/cli.html).
