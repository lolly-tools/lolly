# Links that do something on open

A Lolly link can do more than show a design. It can download the file, ready it for pasting, open at print size, present a deck or sit inside another page with no controls. Each recipe below is one example you can copy, with a link to the reserved word's row in [Reserved URL parameters](/info/url-parameters.html).

Most of these words are presence flags: the key alone is enough, and any value is ignored.

## Download a file

Add `export` and the file downloads as soon as the tool finishes rendering. `format=` picks the file type, and `filename=` sets the download's name, without its extension:

```
/t/qr-code?url=https://example.com&format=svg&export
/t/qr-code?url=https://example.com&format=png&export&filename=homepage-qr   → homepage-qr.png
```

::: timeline
- <!--i:link--> **The link opens.** The tool reads its inputs and the reserved words from the address.
- <!--i:layers--> **The tool renders.** The app waits until the canvas has settled and the design system's colours are ready.
- <!--i:download--> **The file downloads.** No click is needed, because a download needs no gesture from the person.
:::

Without `format`, the download uses the first format the tool lists. Without `filename`, the file is named after the tool id, as in `qr-code.png`.

`format=` takes any value in the tool's `render.formats`. A format the tool does not list falls back gracefully. [Every format Lolly can open and make](/info/formats.html) says what each format is for, and the fold below gives the value to write in a link.

::: details Every format value
Not every tool offers every format: a link can ask only for one the tool lists in `render.formats`. The `render.formats` list in `schemas/tool.schema.json` is the authority on the whole set.

| Value | What you get |
|---|---|
| `svg` | Scalable vector |
| `svg-anim` | Animated SVG, a self-contained vector flipbook (animated tools only) |
| `emf` | Enhanced Metafile vector, for Office apps |
| `eps` | Encapsulated PostScript vector (RGB) |
| `eps-cmyk` | Encapsulated PostScript vector in DeviceCMYK, a simple conversion with no output intent |
| `dxf` | DXF cut file: AutoCAD R12, paths in millimetres, for laser, vinyl and CNC |
| `png` | Lossless raster |
| `jpg` / `jpeg` | Lossy raster |
| `webp` | Lossy or lossless raster |
| `avif` | AVIF raster |
| `jxl` / `jxl-lossless` | JPEG XL raster, lossy or lossless |
| `tiff` | Uncompressed sRGB raster (RGB TIFF) |
| `exr` / `hdr` | Float raster interchange, OpenEXR and Radiance RGBE, written over a render with real headroom (`hdr=1`) |
| `pdf` | PDF document |
| `pdf-cmyk` | Print PDF: CMYK with an output intent ([Print-ready output](#print-ready-output)) |
| `cmyk-tiff` | Print TIFF: a flattened CMYK raster |
| `pptx` | PowerPoint deck with native editable text and shapes, and images and vectors you can extract |
| `idml` | InDesign IDML: a static subset of the layout (Design) |
| `premiere-xml` | Premiere XML sequence and its media files, in a ZIP (Design) |
| `scorm` | SCORM course package, a ZIP a learning system imports (Design) |
| `penpot` | Penpot design file: boards, editable shapes and the brand's colours, typographies and design tokens |
| `docx` / `odt` | Word or OpenDocument text: headings and paragraphs read off the render, editable rather than a picture of the page |
| `ico` | Icon bundle (Icon, Asset Export) |
| `zip` | A bundle of several files, which a password can lock ([Exporting](/info/exporting.html#password-protection)) |
| `html` | Static HTML document |
| `md` / `txt` | Markdown or plain text |
| `json` / `csv` | Structured data |
| `css` / `scss` | Colour tokens as CSS custom properties or Sass variables |
| `gpl` / `ase` | Swatches for other design apps: GIMP palette and Adobe Swatch Exchange |
| `ics` / `vcf` | Calendar event or contact card |
| `srt` / `vtt` | Captions: SubRip and WebVTT |
| `ttf` / `otf` / `woff` | Font files (Convert Font) |
| `gif` | Animated GIF (animated tools only) |
| `apng` | Animated PNG with full colour and real alpha (animated tools only) |
| `webp-anim` | Animated WebP with full colour and alpha, the smallest file (animated tools only) |
| `lottie` | dotLottie animation (Design) |
| `webm` | WebM video (animated tools only; Chrome, Firefox and Android) |
| `mp4` | MP4 video (animated tools only; Safari, iOS and recent Chrome) |
| `wav` / `mp3` / `m4a` / `opus` | Audio only: the sound with no picture |
:::

### Transparency and outlined text

A tool that supports a transparent background has a `transparentBg` input. Pass it like any other on-off input:

```
/t/qr-code?url=https://example.com&color=%230c322c&transparentBg=1&format=png&export&filename=qr-transparent
```

PNG, WebP and AVIF keep the transparency, and so does SVG, which then has no background shape. JPG and PDF ignore the setting.

Tools that export a vector format also get a `convertPaths` input from the engine, the **Convert paths** control. `?convertPaths=1` outlines text and `?convertPaths=0` keeps it live. It is off by default, so text stays live unless a link or the export panel asks for outlines. A tool that sets `render.convertPaths: false` has no such control, and the parameter does nothing.

## Copy to the clipboard

`copy` gets the tool's Copy action ready. Pair it with `format=` to choose what is copied:

```
/t/agenda?title=Launch+day&format=html&copy
/t/qr-code?url=https://example.com&format=png&copy
```

The copy waits for your first click on the page. A browser allows a clipboard write only in answer to a gesture, so the app highlights the **Copy** button and copies on the click. Use `export` instead when nobody will be there to click. `copy` is for "open this link, then paste". The CLI ignores it and writes to `--output` or stdout.

## Set the size

`width` and `height`, or `w` and `h`, set the canvas size and fill in the export panel. They are not passed to the tool as inputs, and long and short forms mix (`?width=1200&h=630`):

```
?w=1920&h=1080
```

![Mesh Gradient reshaped to a 1920 by 1080 canvas by the w and h params alone](/t/url-shot?url=%2F%23%2Ftool%2Fgradient%3Fw%3D1920%26h%3D1080&width=880&height=560&dpi=96&waitMs=2400&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=exp-url-dims)

### Physical units (`unit=` + `dpi=`)

`unit` says what the numbers mean: `px` (the default), `mm`, `cm`, `in`, `pt` or `pc`. With a physical unit, each format comes out at its real size:

- **PDF** is a true page of that size, in points, with no resolution. `?w=210&h=297&unit=mm&format=pdf` is an A4 page.
- **SVG** carries the unit in its `width` and `height` (`210mm`) with a pixel `viewBox`, so it scales cleanly.
- **PNG, JPG and WebP** are pixels at `dpi`, which defaults to 300: 210 mm at 300 dpi is 2,480 pixels. PNG also records the DPI in a `pHYs` chunk, so print and layout software places it at the intended size.

`px` follows the CSS convention of 96 pixels to the inch. The canvas takes the physical shape straight away, so the A4 link shows a portrait page before you export anything:

![The Wordmark canvas standing as a portrait A4 page, its shape set by the width, height and unit params before anything is exported](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DPrint%2520me%26size%3D120%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&cropSelector=%23tool-canvas-outer&filename=um-units-a4)

```
lolly wordmark --text="Print me." --size=120 --width=210 --height=297 --unit=mm --export=svg --output=a4.svg
```

A document with several artboards treats `width` and `height` as the size of one board; [Reserved URL parameters](/info/url-parameters.html#the-file) explains how each format handles the set.

## Open clean, embed or publish

Four flags change what the person sees when the link opens.

| Flag | What opens | Use it for |
|---|---|---|
| `full` | The tool with the sidebar collapsed, so the artwork fills the window | Showing a finished piece, or running an unattended export with `export` |
| `options` | The tool with the export panel already expanded | A link where the recipient is one click from a download |
| `iframe` | Only the rendered output, with no app chrome, keeping nothing on the device | A tool placed inside another page ([Embed a tool in a page](/info/url-mode.html#embed-a-tool-in-a-page)) |
| `nostage` | On a tool with no export, a plain web page with no controls | Publishing a jump page or a countdown as a page |

```
/t/gradient?full
/t/qr-code?url=https://example.com&options
/t/qr-code?url=https://example.com&format=png&filename=my-qr&export&full
/t/jump?heading=Our+links&nostage
```

::: cols
## With full

![A tool opened with full - no sidebar and no chrome, just the artwork edge to edge](/t/url-shot?url=%2F%23%2Ftool%2Fgradient%3Ffull&width=880&height=560&dpi=96&waitMs=2400&walker=1&format=svg&dark=1&filename=exp-url-full)

## With options

![The export panel already expanded at the foot of the sidebar, one click from a download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-popup&dark=1&filename=exp-options-panel)
:::

`full` and `options` pull in opposite directions: one hides the chrome, the other opens the export chrome. If both appear, `full` wins, because a collapsed sidebar leaves nowhere to show the export panel. Both are web only.

`nostage` has a second meaning on a tool that exports: the `html` export drops its fixed-size frame and fills the whole window, with the tool's content as the page body and no centred card or grey backdrop. It matches the **Full page** toggle in the export panel. On a tool with no export, the Share dialog offers the visitor page as **Open as a web page (no controls)** and ticks it by default.

## Present a deck

`present` opens a Design document as a fullscreen deck that advances on a click. Its frames become slides in presentation order. `s` picks where to start, and `kiosk` loops:

```
/t/design?z=…&present           ← from the first slide
/t/design?z=…&present&s=2       ← from slide 2
/t/design?z=…&present&s=2.3     ← slide 2 at its third build step
/t/design?z=…&present&kiosk     ← wrap at the end, for a screen in a lobby
```

A timed document that is not made of frames starts its playback instead, and `kiosk` loops the playback. Give each frame a `dur` for how long a sign stays on each slide.

Without `present`, `s` is a still filter: `?s=2&format=png&export` downloads slide 2 alone, so every slide has an image link of its own. [Presenting](/info/using.html#presenting) covers the deck in the app, and [Presenting with camera](/info/presenting.html) puts your camera over the deck.

## Print-ready output

`bleed=` and `marks=` add what a print shop expects to `pdf` (RGB), `pdf-cmyk` (Print PDF) and `cmyk-tiff` (Print TIFF). Every other format ignores them.

```
?format=cmyk-tiff&bleed=3mm&marks=crop,reg,bleed,bars&profile=fogra51&export
```

![The Print marks and bleed card opened by a bleed and marks link, with each mark toggle already set](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf-cmyk%26bleed%3D3mm%26marks%3Dcrop%2Creg%2Cbleed%2Cbars%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-print&walker=1&dark=1&filename=exp-print-marks-card)

- **`bleed=3mm`** scales the design to fill the bleed and leaves the trim area unchanged. The PDF declares its `TrimBox` and `BleedBox` for the RIP. The TIFF grows to the full sheet, with the artwork over white to cover the bleed.
- **`marks=crop,reg,bleed,bars`** draws crop marks, registration targets, bleed marks and a colour bar in the margin. Mark length, gap and stroke weight follow print standards.
- **`prov`** (PDF only) adds a small provenance credit in the proof margin, outside the trim.
- **`profile=fogra51`** sets the CMYK press condition. The Print PDF declares it in its output intent; the Print TIFF records it in `ImageDescription` and keeps its pixels untagged DeviceCMYK, so the file is never mislabelled.

Print finishing and an open `password` cannot be combined, because the finishing step cannot write an encrypted PDF. A `password` is ignored when marks or bleed are on, and `cmyk-tiff` has no password at all.

::: details How the marks are drawn in each format
Both CMYK formats use the same engine geometry: the PDF as vectors with declared page boxes, the TIFF rasterised onto an enlarged sheet.

In `pdf-cmyk` the line marks are DeviceCMYK `1 1 1 1`, so they print on every plate. In `cmyk-tiff` they are written into the pixels as all four channels at full ink (`C=M=Y=K=255`), after the RGB to CMYK pass so they are not remapped. In the RGB `pdf` they are black. Registration prints on all four plates in both CMYK formats.

In `pdf-cmyk` the colour bar becomes a brand verification strip. The four solid process primaries (C, M, Y, K) come first as a fixed reference. After a wider gap, each brand colour that substituted in this artwork appears as an RGB swatch touching its CMYK substitution, so a press operator can confirm the swap happened. Only the inks really used are shown, capped by the margin's width and at 12 brand cells. The RGB `pdf` and the `cmyk-tiff`, which converts each pixel with no exact substitution to check, show a general process, overprint and tint bar instead.
:::

::: details What the provenance credit says
The `prov` credit takes its text from the export's authorship metadata: the export time *{YYYY-MM-DD HH:MM}* at the top left, *"Made with https://lolly.tools"* at the top right and *"{Tool} by {Author}"* up the bottom left. It sits outside the trim, so the final cut removes the credit.

The author appears only when you have chosen to share your details (Settings → **Your details** → **Use my details to create**). When the export records a colourway, the tool's name carries it as the description does, as in *"Chart (Beach colourway) by Sam Rivera"*. With the **Design system** card off, or `_madewith=0`, the credit keeps its plain form. The design system's own name never appears in the credit.
:::

::: details When a Print PDF claims PDF/X-4
A named condition tells a RIP what the DeviceCMYK values mean, but PDF/X-4 also wants the profile itself inside the file, and no CMYK ICC profile ships with Lolly. So a named condition writes the output intent and not the `GTS_PDFXVersion` conformance claim.

Load a CMYK profile of your own, in Colour Lab or the export panel's Colour profile control, and choose its *Embed* row (`profile=own` in a link). The profile is embedded as the `DestOutputProfile`, and the file claims PDF/X-4 unless something else in the export makes the claim untrue: RGB artwork the CMYK pass could not convert, `marks=prov` (its credit is set in a standard font that is not embedded) or a strong password (X-4 forbids encryption). The output intent is written either way.

The intent declares the registered condition only where the profile itself proves one, through its own `targ` characterisation data or a lookup Lolly made in the ICC registry. Otherwise it declares `Custom` under the profile's own name.
:::

## Motion

Motion formats take their settings from the link too: `fps`, `seconds`, `wait`, `codec` and `vq` match the export panel's Frame rate, Duration, Start after, Codec and Quality controls. `motionblur` adds blur and `seqrange` exports part of a movie. Their rows in [Reserved URL parameters](/info/url-parameters.html#motion-and-timed-documents) give the ranges.

```
/t/flythrough?format=mp4&fps=60&seconds=8&codec=h264&export
```

Pin `codec=h264` when the file has to play everywhere. Left on Auto, the encoder often picks AV1.

### Contact sheets

A still export of a timed composition renders the frame at the playhead: what you see on the stage is what goes into the file. A contact sheet asks for more, with `cuts=N` stills sampled at equal intervals across the sequence for a storyboard, a thumbnail sheet or a social carousel.

::: figure url-export-contact-sheet
Six cuts of a twelve-second sequence sample at 1, 3, 5, 7, 9 and 11 seconds.
:::

With `N` above 1 and `pdf` chosen, you get one PDF of `N` pages in time order. With `png`, `jpg`, `webp` or `svg` you get a ZIP of `N` files (`-01` to `-0N`), because PDF is the only still format that holds several frames, so choose a `.zip` output filename. `1` is the single playhead frame.

Values are clamped to 1 to 64: a contact sheet is for a person to look at, and 64 is already an 8 by 8 wall. Anything unparseable falls back to 1 rather than failing the export. For exact times instead of even ones, use `sampletimes=0,1.5,3` (MCP `sampleTimes: [0, 1.5, 3]`).

The export panel's **Frames** field makes the same request ([Exporting](/info/exporting.html#stills-from-a-timed-composition)).

::: details Contact sheets on the CLI and MCP
Web auto-export, the CLI and MCP carry the same `cuts` request to the browser renderer, and the CLI and MCP refuse a sampling request for a format that cannot take one. Ordinary web exports keep each format's own behaviour. The uniform sheet samples layer motion, while an embedded video keeps its parked poster frame; use a draft movie to review video. Explicit raster `sampletimes` requests drive supported media through the movie compositor.
:::

## Resume a saved session

A saved session is a named snapshot of input values stored in the browser. `slot` loads one by name, and any other parameter in the link overrides the saved value for that visit:

```
/t/wordmark?slot=launch-wordmark
/t/qr-code?slot=homepage-qr&format=png&export
```

A slot exists only on the device that saved the session. The CLI has no saved-session store, so it ignores `slot`; to move a session to another device, send its `.lolly` file ([What a link carries](/info/url-app-links.html#what-a-link-carries)).
