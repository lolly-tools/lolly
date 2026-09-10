# Utility views

A utility view is a workbench built into the app rather than a tool: you bring a file to it, do one job and take the result away. The spreadsheet, the converter, the Colour Lab, the PDF extractor and Script audio are the five, and they all run on your device.

## What a utility view is (and is not)

A tool is data - a manifest, a template, inputs that live in the URL - so it saves sessions, reopens from a link, renders from the CLI and exports through the shared pipeline. A utility view is none of those things. It is a page of the app with no manifest, no session store and no export panel: what you take away is a download, and when you leave, the file you dropped is gone.

That trade buys the things a tool cannot have. A view can use the shell's own controls (the Colour Lab is built on the app's multi-space colour picker), it can simply be a very tall page instead of a fixed canvas and it can hold a 200,000-row grid or a 400-page document that no render path would want. The cost is honest and easy to name before you start: no saved sessions, and nothing to keep offline per view, since they ship inside the app shell and are available whenever it is.

They live in the **Utilities** tab (`#/u`), alongside the on-device utility *tools* - Strip Hidden Data, Compress PDF, Pages, Trim, Sign, Clean, Convert Image, Convert Font, Redact, Screen Capture, Text Helper and the rest - because to anyone using them they are the same kind of thing: something you open from that grid. A view's tile can be starred like a tool's ([Your favourites](/info/favourites.html) covers the strip that puts starred things on top), and each carries a details dialog. What a view's tile does not offer is *keep offline* or *saved sessions*, for the reasons above.

![Strip Hidden Data: the file arrives on the canvas and the badge states plainly that nothing is uploaded](/t/url-shot?url=%2F%23%2Ftool%2Fstrip-data&width=1200&height=750&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-strip-data)

> **Verify & Inspect** (`#/verify`) is the sixth member of the family and has pages of its own: [Verify It Yourself](/info/verify-yourself.html) and [Security & Verification](/info/security.html).

## Everyday file tools

**Pages** is the PDF page manager: give it a 1-based expression such as `1-3,7,10-` to reorder, rotate, extract or delete those pages, append a second PDF, or split comma-separated ranges into separate files. The page strip shows the selection before download. It preserves the primary document's own metadata, adds none of Lolly's, and refuses encrypted PDFs and XFA forms rather than risking a partial document.

**Trim** cuts audio and video at exact in and out points, keeps or changes the container, removes sound, extracts an audio track, and makes short GIFs. It uses packet copy when the chosen boundary and container permit it; when an exact video boundary sits between keyframes it re-encodes that span instead of silently moving the cut. The result names the real container and any codec the device could not handle.

**Sign** places a transparent signature on a chosen PDF page in PDF-point coordinates; drag it on the page or enter the numbers. Initials and today's date are optional. A Content Credential is on by default and names the profile signer only when **Use my details** is enabled; a password lock is available at download time, but cannot be combined with that credential because encrypting afterwards would invalidate it. This is a visible signed document with optional provenance, not a regulated e-signature or identity-verification service.

**Clean** reduces voice noise with the on-device speech model, trims silent edges sample-exactly, normalises to podcast, streaming or broadcast loudness, and holds the output under a -1 dBTP ceiling. Audio can leave as WAV, MP3, M4A or Opus. For a video, the picture is carried into the new container while the cleaned audio replaces its original track. The terminal path accepts WAV without pretending Node has codecs it does not; other containers move to the browser tier or are refused by name.

## Prepare for sharing - `#/prepare`

Inspect text, JSON, YAML, HAR and ZIP files locally, choose replacements, review
originals beside the resulting copies, then copy, download, send or save a result
to the library. Text Helper opens the same panel for the selected input text (or
all input when there is no selection). Catalog assets and saved file results have
a **Prepare for sharing** action; exported file utilities offer it for the copy.

Suggestions cover credential fields and common token shapes, email, payment-card,
bank-account, phone, date, postcode, address and possible name patterns. They can
be wrong and can miss confidential information. **Keep all** and **Continue
unchanged** remain available. Add a missed exact value or a sensitive field name;
edit a replacement or choose individual occurrences. Identical values share a
mapping across every file in the job.

Supported PDF, JPEG, PNG and SVG copies can use the existing **Strip Hidden Data**
operation inside the panel, with metadata inspected again afterward. Removal can
invalidate signatures, remove colour profiles or discard JPEG HDR gain maps.
Visible content needs its own review; **Redact** opens the selected original in
its existing utility, and its exported copy can return to preparation. Opening a
utility leaves the preparation view, so finish or download other copies first.
Office, audio, OCR and language-model expansion are separate work.

Jobs accept up to 100 files, 32 MiB each and 64 MiB total. Text inspection stops at
1 MiB per file/value; ZIP inspection has a global 300-member limit, three archive
levels and a 64 MiB expansion budget. Unsupported, encrypted or malformed members
are listed as uninspected and can be retained or removed. Names and archive comments
are not inspected; rebuilding removes archive comments and empty directory records.
YAML aliases are inspected at their anchors, without expanding sensitive field
context at alias uses. Reports state these limitations; zero suggestions is not a
certificate that a copy contains no private data.

Working originals, replacement maps and preview content stay in memory. Clearing
or leaving the view releases them. Saving a recipe keeps category choices and
custom field names, without prior text, literal rules or mappings. **Add to
library** explicitly saves the result bytes into normal library backup/sync;
it does not save the source or map. Downloaded reports contain counts, scope IDs,
hashes and limitations, without filenames or private values.

The CLI uses the same engine, with no catalog required:

```sh
lolly prepare request.har
lolly prepare request.har --review-file=private-review.json
lolly prepare request.har --choices=private-review.json --output=prepared.har
lolly prepare one.json two.yaml --replace-all --out-dir=prepared
lolly prepare image.png --strip-hidden-data --output=prepared.png
```

The default JSON report never fails solely because findings remain. Explicit
`--review-file` output contains private values and editable choices bound to source
hashes; keep it private. `--recipe`, `--save-recipe`, `--rules` and `--report` support
repeated work. Files are created with owner-only permissions and existing files
are preserved. Partial delivery reports successful copies separately from failures.
In the TUI, press **P** from Tools; add file paths, inspect, choose replacements,
review coverage with Tab, and download the resulting copies. Escape cancels work.

## Spreadsheet - `#/data`

Open, read and lightly edit a spreadsheet with no Excel, no LibreOffice and no internet. Drop an `.xlsx`, `.csv`, `.tsv` or `.json`, or choose one; a multi-sheet workbook gets a tab bar and you can switch sheets without re-picking the file. Cells are editable in place, and **Download as** writes the grid as it stands - CSV, Excel, JSON or TSV.

The grid renders only the rows in view and recycles them as you scroll, so a very large file stays responsive: the viewer reads up to 200,000 rows, and a pathological workbook is bounded at two million cells by the reader itself. Where either bites, the banner above the grid says how much you are looking at.

**It shows values.** A formula arrives as its current computed result, and styles, merged cells, charts and every sheet but the one you downloaded do not survive the download. The banner above the grid states this before you edit anything, because the failure would otherwise be silent. Use it to read a file, fix some numbers and hand the data on - not to round-trip a formatted workbook.

Nothing is uploaded, and nothing is kept: the file lives in the page until you leave it.

## Convert - `#/convert`

Drop a file, pick a target, get a download. Every conversion runs in the app with the engine's own codecs - no upload, no service.

| You bring | You can get |
|---|---|
| TrueType, OpenType or WOFF | any of the other two container formats |
| SVG or SVGZ | its compressed or uncompressed twin, plus the raster list below |
| Any image the app can decode | PNG, JPEG, WebP, AVIF, TIFF, BMP, PDF (one page, sized to the pixels) or ICO |
| `.xlsx`, `.csv`, `.tsv` or `.json` | any of the other three |

Some edges to know. The prompt and the file chooser's filter name fonts, images and SVG only, so a spreadsheet or a `.json` has to be **dropped** onto the view rather than picked - it converts perfectly well once it arrives. A font swap and an SVG⇄SVGZ swap are exact byte work, so an embedded Content Credential and outlined text come through untouched; anything on the raster row is drawn to a canvas first, which is a re-encode. WOFF2 is recognised but has nothing to convert to, so it reports that rather than pretending. Vector-to-vector transcoding (SVG to EPS or DXF) is not offered at all, because the engine's vector writers walk a rendered canvas rather than arbitrary source SVG and would misconvert it. An `.xlsx` converts from its first sheet. And where a browser cannot encode a format it is asked for, the view says so instead of handing back a PNG wearing an `.avif` name.

**Convert the view versus Convert Image the tool.** The tool is the photo path: it decodes HEIC and HEIF with a bundled decoder, gives you a quality setting and a longest-edge resize, saves sessions and travels in a link like every other tool. The view is format plumbing with no settings - one click per target, whatever the browser can decode - and it reaches fonts, SVG and tabular data, which the tool does not. There is a **Convert Font** tool too, for the same swap as a saveable, linkable session.

Convert has no tile in the Utilities grid. Type "convert" into [Search](/info/search.html) from any listing screen, or go to `#/convert` directly.

## Colour Lab - `#/lab`

One colour, comprehensively. `#/lab?c=<css colour>` opens the report on any CSS colour, and the address tracks what you pick, so a link reproduces the page you are looking at.

The report runs in five steps: **set a colour** (the app's tabbed multi-space picker, or your brand's own swatches), **plotted on a colour space** (four charts, governed by a comparison target you choose), **every notation** (the same colour written for each space, copyable, with a *clamped* mark where a space is too narrow to hold it), **tones and blends** (a perceptually even ramp through the colour, and a blend across to a second one at a step count you set) and **displayable range and readability** (the gamut verdict, then the contrast scores - APCA first because it models polarity, WCAG second because people still have to report it, with a foldable grid of every brand colour against every other and a colour-vision simulation over it).

The colour is never collapsed to sRGB on the way in. `color(display-p3 1 0 0)` is described at its real chroma and its real gamut rather than flattened to `#ff0000` and then declared safe, and every swatch is painted from the value you authored, so a wide-gamut display shows the real thing.

**Your own ICC profiles.** The comparison target is sRGB, Display-P3 or Rec.2020 or a press profile you load yourself. A stored profile rides the same rail as an uploaded font - it is a user asset, so the storage meter counts it, a data export carries the bytes and *Clear all my data* removes it - and its id is derived from the file's own content, so a `&limit=icc:…` link matches the same profile on someone else's device rather than depending on a filename. Two files are refused rather than stored: one the parser cannot read, and one no rendering intent can be asked a gamut question of. This is also where you load the CMYK profile a PDF/X-4 export has to embed - see [URL Mode](/info/url-mode.html).

A **This screen** panel at the foot reports the display the charts are being judged against, read live and stored nowhere.

There is no export here. The page is the document: no canvas, no render, no CLI equivalent - copy the notations you need, or share the link.

## Unpack - `#/unpack`

A design file is a container, and most software treats it as one opaque thing. This view opens it: the words, the vector marks, the images, the fonts, the colours and the attachments, each viewable and downloadable. Drop a PDF or Illustrator file, an SVG, an InDesign `.idml`, a Penpot `.penpot`, a Figma `.fig`, a PowerPoint `.pptx` or a Photoshop/GIMP `.psd`/`.xcf`. Nothing is uploaded. (The older `#/pdf` link still works.)

Each format gives up what it honestly holds. A PDF and a slide deck carry their glyphs, so the words come out; an SVG or `.idml` names its fonts rather than embedding the files, so those come back as names-only rows you cannot download; a Penpot or Photoshop file embeds its images, so those travel as real bytes, while an InDesign document only links its images, so their pixels stay where they live and are counted, not fetched. A layered PSD/XCF gives every layer as its own named PNG; its text was flattened to pixels by the reader, so it has no words to extract here (which is not the same as the file having none).

The **Text** pass rebuilds each page in reading order with the page's own vector picture beside it, noting how many columns it was read as and how many rotated runs were left out, so you can judge the reconstruction. Take it away with **Copy all**, **Download .md** or **Download .txt** or copy one page at a time. For an SVG the text is its `<text>` runs in document order; an SVG whose type was outlined to paths honestly yields nothing, the same answer a PDF gives when its text was converted to curves.

**Unpack extracts, it does not read pixels.** A born-digital PDF already contains its glyphs and their positions, which is why the extraction works offline at all - but a scanned page holds a picture of text and nothing else, and it is reported as exactly that, page by page. A document where every page is a scan gets that as a banner at the top rather than a footnote, because the next thing you need is a different surface: Lolly's **on-device text reader**. Drop the image into [Verify](/#/verify) and press **Read the text in this image**, or open it in the Catalogue and press **Read text** - the recognition model downloads once and runs on the device, nothing is uploaded. The same reader powers **Snap to text** in Annotate and **Suggest** in Redact. See [Generated once, rendered the same](/info/ai-features.html) for what it is and is not marked as.

The tabs sit in a raised strip pinned to the top of the report, so as you scroll the pages you keep seeing that your images, fonts and colours came out too. Each tab appears only when a pass found something, so the strip describes your document rather than what a container could theoretically hold: **Palette** (the distinct colours it paints with, each with a copy button), **Logos** (vector marks, downloadable as SVG and usually the most useful thing in a guidelines file, since they stay sharp at any size), **Images** (embedded rasters - undecodable or linked-from-elsewhere ones are counted rather than hidden, and a linked image's pixels are never fetched), **Fonts** (each with its own embedding caveats stated plainly - a subset is called a subset, a names-only face carries no bytes and "no embedding restriction" is not called a licence) and **Attachments**.

One check runs before any of it: text painted underneath an opaque shape is reported at the top of the report, with the hidden words shown. A black bar that does not actually remove the words underneath is worth seeing rather than trusting.

Three hand-offs go straight into the brand: a font row installs its face, a mark goes to the [Brand Studio](/info/brand-studio.html)'s Logos room and the bar sends the whole scan to the studio. None of them re-scans the document - each is built from what the passes already extracted.

Limits, stated: 400 pages and 120 MB, beyond which it reads what it can and says the rest is too long, and a single mark over 4 MB is not sent to the studio (download the SVG instead).

## Script audio - `#/script`

A writing surface over on-device speech. Write or paste a script - markdown is fine, only the words are read, so code blocks and images drop out and links keep their text - pick a voice, audition it, choose a speed and press **Generate speech** (or Ctrl/Cmd-Enter). Under the sheet sit the two numbers a narrator wants: how many words, and roughly how long they take to listen to, always labelled as an estimate.

The first run downloads the voice model once, with its size stated before you commit. After that it runs on the device, and the script itself is never uploaded. A script past about five thousand characters gets a warning, not a wall.

**Save to your uploads** writes the clip as a WAV in your own asset library, with the voice, speed and per-word timings kept on the record - which is what a captioning surface later reads. It is marked as AI-generated and carries that badge wherever assets are shown, and the file itself is signed: a Content Credential is embedded in the WAV bytes, so the clip says what made it wherever it travels. See [Generated once, rendered the same](/info/ai-features.html) for why generated audio is declared this way.

Where a device or browser has no speech support, the view says so in a sentence rather than showing a form that cannot work, and the Utilities grid does not draw the card at all.

---

**Related:** [Using Lolly](/info/using.html) for the tools and the gallery these sit beside. [Your favourites](/info/favourites.html) for starring a utility tile. [Search](/info/search.html) for reaching any of them by name from anywhere. [Exporting & Formats](/info/exporting.html) for what the tools themselves can write.
