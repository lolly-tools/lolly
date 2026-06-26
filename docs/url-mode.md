# URL Mode

Every tool's state is expressible as URL parameters. This means any combination of inputs and export settings can be bookmarked, linked, embedded, or piped through automation — with no login, no cookies, and no server state.

The CLI uses the same parameter names and the same conversion logic. A URL you build for the web shell runs unchanged as `--flag=value` arguments on the CLI.

---

## URL structure

```
https://your-host/#/tool/{toolId}?{param}={value}&{param}={value}
```

**Examples:**

```
/#/tool/qr-code?url=https://suse.com&color=%230c322c
/#/tool/qr-code?url=https://suse.com&format=png&export&filename=my-qr
/#/tool/quotes?quote=Open+source+wins.&name=Andy&format=svg&export&full
```

### Clean URL redirect

If a tool is deployed at a dedicated domain or path, you can use a plain query string and the shell redirects to hash form automatically:

```
https://qr.brand.example.com/?url=https://suse.com
  → redirects to → /#/tool/qr-code?url=https://suse.com
```

---

## Setting tool inputs

Every input defined in a tool's manifest can be set as a URL parameter using its `id` as the key.

### String, text, longtext, url

Pass the value directly. URL-encode spaces and special characters.

```
?quote=The+best+way+to+predict+the+future+is+to+create+it.
?name=Andy+Fitzsimon
?url=https%3A%2F%2Fwww.suse.com
```

### Select

Pass the option value (not the label).

```
?theme=dark
?ecl=H
```

### Number

```
?size=800
?padding=4
```

### Boolean

`1` or `true` for on, `0` or `false` for off.

```
?join=1
?showBorder=false
```

### Color

Pass a hex value (URL-encode the `#`).

```
?color=%230c322c
?background=%23ffffff
```

### Asset

Pass the asset's library ID — the runtime resolves it to the full asset object at render time.

```
?logo=suse/logo/primary
?headshot=team/andy-fitzsimon
```

To discover asset IDs, open the asset picker in the tool UI and inspect the value shown when an asset is selected.

> **User-uploaded images are device-local and not URL-shareable.** Images a user adds from their own device (`AssetRef.source: "user"`, ids like `user/upload/…`) live only in that device's local storage. There is no shareable id to encode, so they are deliberately omitted from the URL — a link that referenced one would not resolve on another device. To share a layout that uses a personal image, the recipient must select their own. (Avoiding this would require cloud hosting, which the platform intentionally does not do.)

### Blocks

Blocks inputs are repeating groups of fields (e.g. a list of team members, each with a name and city). Pass the value as a JSON array of objects, URL-encoded.

```
?people=[{"name":"Andy","city":"Nuremberg"},{"name":"Lisa","city":"Sydney"}]
```

Each object's keys must match the field `id`s defined in the tool's manifest. Fields can be omitted — missing fields are treated as empty strings.

**CLI:**
```bash
brand-tool meeting-planner --people='[{"name":"Andy","city":"Nuremberg"},{"name":"Lisa","city":"Sydney"}]'
```

The URL updates automatically as block items are added, removed, or edited in the UI — copy from the address bar to get a shareable link with all entries included.

> Blocks with a JSON representation larger than 8 KB are not written to the URL to avoid exceeding browser URL limits. In that case, use a saved state `slot` for sharing.

### Vector

A `vector` input is a fixed group of numbers edited as one control (e.g. a zoom + x/y offset). It has **no** single-param form — pass each field as a flat dotted param `<inputId>.<fieldId>`:

```
?transform.zoom=200&transform.x=30&transform.y=70
```

One readable value per param. Used by tools such as `bag-video`, `chart-creator`, `duotone-filter`, `dynamic-layout`, and `quotes`.

### File

A `file` input (the user's own file, processed in memory) is **never** put in a URL — its bytes live only on the device, so there is nothing shareable to encode. On the CLI a file param is a filesystem path, loaded into memory before rendering:

```bash
brand-tool strip-data --source=./photo.jpg --format=jpg --output=clean.jpg
```

In the web shell a `file` input can't be pre-filled from a URL; a link that referenced one resolves as blank, and the recipient picks their own file.

---

## Compact encoding (opt-in)

Tools can opt into a shorter URL form, which the web shell emits when you **copy a share link** (the live address bar keeps the readable long form). Both the long forms above and the compact forms below parse, so either kind of link works:

- **`urlKey` aliases** — an input (or block field) can declare a short key, e.g. `textColor` → `tc`, so `?tc=ff0000` sets it.
- **Colors without `#`** — a 6-char hex is stored bare (`?color=0c322c`), restored to `#0c322c` on parse.
- **Tilde-delimited block arrays** — instead of JSON, blocks serialise as `field,field,field~field,field,field` (one `~`-separated group per item; values URL-encoded, colors `#`-less).
- **Omitted defaults** — values equal to the input's default are dropped from the URL entirely.

`chart-creator` is a live tool that uses `urlKey`, so a link copied via its Copy URL / share button won't match the long-form examples in this doc — that's expected.

---

## Reserved parameters

These keys are never treated as tool inputs. They control shell-level behaviour.

| Param | Where | Description |
|---|---|---|
| `format` | web + CLI | Output format (`png`, `svg`, `pdf`, …). Used by `export` and `copy`. |
| `export` | web + CLI | Presence flag — trigger an immediate download on page load. |
| `copy` | web only | Presence flag — arm copy-to-clipboard on first interaction. |
| `full` | web only | Presence flag — open in fullscreen (sidebar collapsed). |
| `options` | web only | Presence flag — open with the export-settings panel expanded instead of the collapsed Render button. `full` wins if both are set. |
| `filename` | web only | Name for the downloaded file (no extension). Defaults to the tool ID. |
| `slot` | web + CLI | Name of a saved state slot to pre-load. URL params override saved values. |
| `output` | CLI only | File path to write the exported file. Defaults to stdout. |
| `_v` | web + CLI | Tool version pin (e.g. `1.0.0`). Ignored if not matched — forward-compat safety. |
| `width` / `w` | web + CLI | Output width, as a value in `unit`. Also pre-fills the export dimensions panel. |
| `height` / `h` | web + CLI | Output height, as a value in `unit`. Also pre-fills the export dimensions panel. |
| `unit` | web + CLI | Physical unit for `width`/`height`: `px` (default), `mm`, `cm`, `in`, `pt`, `pc`. |
| `dpi` | web + CLI | Raster resolution for physical units (default `300`). Ignored for `px` and for vector formats. |
| `password` | web only | PDF open password (`pdf` only). A basic lock, not strong encryption; it travels in clear text in the URL, so it's a light deterrent, not protection for confidential material. Ignored when `bleed`/`marks` are on (encrypted PDFs can't carry print finishing). |
| `profile` | web only | Colour profile, two roles by format. For ordinary raster (`png` / `jpg`) it selects the ICC profile: `srgb` (the default) embeds an sRGB profile; `none` omits it. For the print formats (`pdf-cmyk` / `cmyk-tiff`) it is the CMYK press condition, e.g. `fogra51` — embedded as the PDF's output intent, recorded in the TIFF's provenance. |
| `bleed` | web only | Bleed amount for the print formats (`pdf` / `pdf-cmyk` / `cmyk-tiff`), as a dimension (e.g. `3mm`, `0.125in`). The artwork is scaled to fill the bleed; the PDF declares `TrimBox`/`BleedBox`, the TIFF is enlarged to the full sheet. |
| `marks` | web only | Print marks for the print formats (`pdf` / `pdf-cmyk` / `cmyk-tiff`) — a CSV of `crop`, `reg`, `bleed`, `bars`, `prov`. Drawn in the page margin (PDF) or rasterised into the image margin (TIFF); registration prints on all four plates in `pdf-cmyk` and `cmyk-tiff`. `prov` (provenance credit text) is PDF-only. |

`export`, `copy`, `full`, and `options` are **presence flags** — the parameter value is ignored; what matters is whether the key appears in the URL.

> **Building share links in the UI.** In the web shell you don't have to hand-write these. The **Share** button (in the export panel) opens a dialog with the ready-to-copy link plus a toggle for each on-visit flag — _open fullscreen_ (`full`), _open with the export panel expanded_ (`options`), _download automatically_ (`export`), _copy to clipboard_ (`copy`), and _pin tool version_ (`_v`). The copy toggle appears only for clipboard-friendly formats (bitmap/text/html) and is hidden for SVG, PDF, and video. Ticking a box rewrites the link in place.

### Physical units (`unit=` + `dpi=`)

`width`/`height` are plain numbers; `unit` says what they mean. With a physical unit the output is rendered at the correct **physical** size for the format, not just a pixel count:

- **PDF** → a true page of that size (points, resolution-free). `?w=210&h=297&unit=mm&format=pdf` is a real A4.
- **SVG** → `width`/`height` carry the unit (e.g. `210mm`) with a px `viewBox`, so it scales cleanly.
- **PNG / JPG / WebP** → pixels at `dpi` (e.g. 210mm @ 300dpi = 2480px). PNG also embeds the DPI (a `pHYs` chunk) so print/layout software places it at the intended size.

`px` is the default and behaves exactly as before (the CSS 96-DPI convention).

```
brand-tool poster --title=Hello --width=210 --height=297 --unit=mm --export=svg --output=a4.svg
```

### Print marks & bleed (`bleed=` + `marks=`)

For print-ready output, `bleed=` and `marks=` add the prep a print shop expects to the
`pdf` (RGB), `pdf-cmyk` (Print PDF) and `cmyk-tiff` (Print TIFF) formats. They're ignored
for every other format. The two CMYK formats apply the same engine geometry — the PDF as
vectors with declared page boxes, the TIFF rasterised onto an enlarged sheet.

- `bleed=3mm` — the design is scaled to fill the bleed (the trim area is unchanged). The PDF declares its `TrimBox` (final cut) and `BleedBox` for the RIP; the TIFF is enlarged to the full sheet, the artwork composited over white to cover the bleed.
- `marks=crop,reg,bleed,bars` — draws, in the margin: **crop** (trim) marks, **reg**istration targets, **bleed** marks, and a colour **bars**. In `pdf-cmyk` the line marks are DeviceCMYK `1 1 1 1` so they print on every plate; in `cmyk-tiff` they're written straight into the pixel buffer as all four channels at full ink (`C=M=Y=K=255`, the raster analogue), drawn **after** the RGB→CMYK pass so they aren't remapped; in the RGB `pdf` they're black. Mark length, gap and stroke weight are fixed to print standards.
  - In `pdf-cmyk` the bar becomes a **brand verification strip**: the four solid process primaries (C, M, Y, K) come first as a fixed calibration reference, then — after a wider gap — each brand colour that actually substituted in this artwork appears as an RGB reference swatch touching its CMYK substitution, so a press operator can confirm the RGB→CMYK swap landed. Only the inks really used are shown (substitution records which palette colours were hit); the pairs are capped by the available margin width and a flat ceiling of 12 brand cells. The RGB `pdf` and the `cmyk-tiff` (which does a flat per-pixel conversion with no exact substitution to verify) show a generic process/overprint/tint control bar instead.
- `prov` (PDF only) — adds small **provenance** credit text in the proof margin, taken from the export's authorship metadata: the export timestamp *{YYYY-MM-DD HH:MM}* at the top-left, *"Made with https://lolly.tools"* at the top-right, and *"{Tool} by {Author}"* climbing the bottom-left. Like the other marks it sits outside the trim, so it's removed at the final cut (a proof annotation, not artwork). The author appears only when the user has opted into personal details (Profile → "Use my details").

The CMYK press condition (`profile=`, e.g. `fogra51`) is carried for both CMYK formats: the Print PDF embeds it as the document's output intent; the Print TIFF records it as provenance in `ImageDescription` (the pixels stay untagged DeviceCMYK — no embedded profile, so the file is never mislabelled).

```
?format=cmyk-tiff&bleed=3mm&marks=crop,reg,bleed,bars&profile=fogra51&export
```

> Marks/bleed and the PDF open-`password` are mutually exclusive: print finishing is applied via pdf-lib, which can't write encrypted PDFs, so a `password` is ignored when marks/bleed are on. (`cmyk-tiff` has no password concept.)

---

## Format with `format=`

`format=<fmt>` selects the output format for both `export` (download) and `copy` (clipboard).

Supported values:

| Value | Output |
|---|---|
| `svg` | Scalable vector (requires `<svg>` root in the template) |
| `png` | Lossless raster |
| `jpg` / `jpeg` | Lossy raster |
| `webp` | Lossy/lossless raster |
| `avif` | AVIF raster |
| `pdf` | PDF document |
| `pdf-cmyk` | Print PDF — CMYK with output intent (see print marks & bleed) |
| `cmyk-tiff` | Print TIFF — flattened CMYK raster |
| `ico` | Icon bundle (e.g. `tool-logo`) |
| `zip` | Multi-file bundle |
| `html` | Static HTML document |
| `md` / `txt` | Markdown / plain text |
| `json` / `csv` | Structured data |
| `ics` / `vcf` | Calendar event / contact card |
| `gif` | Animated GIF (animated tools only) |
| `webm` | WebM video (animated tools only; Chrome/Firefox/Android) |
| `mp4` | MP4 video (animated tools only; Safari/iOS and recent Chrome) |

Not all tools support all formats — only the formats listed in the tool's manifest `render.formats` are valid (the full set is the 21-value enum in `schemas/tool.schema.json`). Requesting an unsupported format falls back gracefully.

---

## Download with `export`

Adding `export` (no value needed) triggers an automatic download the moment the tool finishes rendering. Pair it with `format=` to set the file type; if `format` is omitted the tool's default format is used.

```
/#/tool/qr-code?url=https://suse.com&format=svg&export
/#/tool/qr-code?url=https://suse.com&format=png&export
/#/tool/qr-code?url=https://suse.com&format=pdf&export
```

`export` without `format` downloads in the tool's first listed format:

```
/#/tool/qr-code?url=https://suse.com&export
```

---

## Download filename with `filename=`

Sets the name of the downloaded file. The format extension is appended automatically — do not include it.

```
/#/tool/qr-code?url=https://suse.com&format=png&export&filename=homepage-qr
→ downloads as homepage-qr.png

/#/tool/qr-code?url=https://suse.com&format=svg&export&filename=event-badge
→ downloads as event-badge.svg
```

Without `filename=`, the download is named after the tool ID (e.g. `qr-code.png`).

---

## Copy to clipboard with `copy`

`copy` (no value needed) arms the tool's copy-to-clipboard action. Pair it with `format=` to choose the format; if `format` is omitted the tool's default is used.

```
/#/tool/email-signature?firstname=Andy&format=html&copy
/#/tool/qr-code?url=https://suse.com&copy
/#/tool/qr-code?url=https://suse.com&format=png&copy
```

**It does not fire silently on load.** Browsers only allow a clipboard write in
response to a user gesture (`navigator.clipboard.write` rejects otherwise, and
the image path would fall back to an unexpected download). So when `copy` is
present, the shell highlights the **Copy** button and performs the copy on your
first interaction with the page — the click that supplies the required gesture.

Use `export` instead if you want a genuinely unattended result (a download needs
no gesture). `copy` is for "open this link, then it's ready to paste." It is a
web-shell affordance; the CLI ignores it (use `--output` / stdout).

---

## Canvas dimensions with `width=` / `height=`

`width` and `height` (short aliases `w` and `h`) set both the canvas document size and pre-fill the export dimensions panel. They are not passed to the tool as inputs.

```
?width=1200&height=630
?w=800&h=800
?w=1920&h=1080
```

Mixing long and short forms is fine — `?width=1200&h=630` works. The canvas preview updates to the new aspect ratio.

---

## Fullscreen with `full`

`full` collapses the sidebar so the canvas fills the entire viewport. The value is ignored — presence of the param is enough.

```
/#/tool/qr-code?url=https://suse.com&full
```

Combine with `export` for a clean unattended export flow:

```
/#/tool/qr-code?url=https://suse.com&format=png&filename=my-qr&export&full
```

---

## Land on the export panel with `options`

`options` opens the tool with the export-settings panel already expanded (format, dimensions, DPI, and the export/copy buttons) instead of the collapsed **Render** button. Use it to share a link where the recipient is one click from downloading.

```
/#/tool/qr-code?url=https://suse.com&options
```

`options` is the opposite of `full`: `full` hides all chrome to show only the preview, while `options` surfaces the export chrome. If both appear, `full` wins (there's nowhere to anchor the export panel once the sidebar is collapsed). The flag is web-only — the CLI ignores it.

---

## Transparent background

Tools that support transparent export expose a `transparentBg` boolean input. Pass it like any other boolean input:

```
?transparentBg=1
```

Transparency is preserved in formats that support an alpha channel: `png`, `webp`, and `avif`. It is ignored for `jpg`, `pdf`, and `svg` (SVG has no background rect when transparent).

Full example:

```
/#/tool/qr-code?url=https://suse.com&color=%230c322c&transparentBg=1&format=png&export&filename=qr-transparent
```

The engine injects a second export toggle the same way: `convertPaths` (the **Convert paths** text-to-vector outlining control) is added automatically to tools that export a vector format. It is URL-expressible as any boolean — `?convertPaths=0` to leave text live, `?convertPaths=1` to outline it — and defaults on. A tool that sets `render.convertPaths: false` suppresses it (and the param has no effect).

---

## Loading saved state with `slot=`

Saved state slots are named snapshots of input values stored in the browser. The `slot` param loads one by name. Any URL params present alongside `slot` override the saved values for that render only.

```
/#/tool/quotes?slot=andy-quote-v2
/#/tool/qr-code?slot=homepage-qr&format=png&export
```

---

## Combining parameters

All parameters compose freely. A fully-specified automation URL might look like:

```
/#/tool/qr-code?url=https://suse.com/event&color=%230c322c&background=%23ffffff&ecl=H&padding=4&format=png&export&filename=event-qr&w=600&h=600&full
```

This opens the QR tool, applies all inputs, sets the canvas to 600×600, collapses the sidebar, and immediately downloads `event-qr.png`.

---

## CLI usage

The CLI uses the same param names as URL mode — `--key=value` instead of `?key=value`. `format`, `export`, and `output` are handled as special flags; all other params are tool inputs.

```bash
# Web equivalent: /#/tool/qr-code?url=https://suse.com&format=png&export&filename=my-qr
brand-tool qr-code --url=https://suse.com --format=png --export --output=my-qr.png

# Pipe SVG to another tool
brand-tool qr-code --url=https://suse.com --format=svg > qr.svg

# Print available inputs for a tool
brand-tool qr-code
```

---

## Integration patterns

### Shareable link

The web shell writes the current input state to the URL hash automatically as inputs change — copy from the address bar at any time.

### Pre-filled embed

Embed the tool in an iframe with inputs pre-filled via URL:

```html
<iframe src="https://brand.example.com/#/tool/qr-code?url=https://suse.com&full"
        width="900" height="700" frameborder="0"></iframe>
```

### Tool composition (portable embed URL)

A tool can embed **another tool's** render with no tool-to-tool imports. The URL-mode face of this is a portable embed URL — a real-looking image URL whose query is ordinary URL-mode params:

```html
<img src="https://lolly.tools/tool/qr-code.svg?url=https://suse.com&color=0c322c">
```

**Nothing is ever fetched from `lolly.tools`.** A shell recognises this exact shape and renders the named tool **locally**, substituting the result (a placeholder pixel shows until the local render resolves). Anything that isn't exactly this grammar is treated as an ordinary image — that strict match is the security boundary.

The path extension is the author's fidelity choice. Compose any tool's render: an SVG child stays a **true vector** when the parent exports to SVG or PDF and rasterises crisply for PNG; raster children (`png`, `jpg`/`jpeg`, `webp`) embed as images. (`pdf` appears in the grammar but is not inlined as a child format.)

This is the URL-mode surface of composition. The declarative form — a manifest `composes: [{ id, tool, inputs, format? }]` block resolved by the engine and placed in the template as `{{asset <id>}}` — is not a URL param; see the authoring guide. Either form requires the tool to declare the `compose` capability. `event-name-badge` composes `qr-code` as SVG today.

### Automation / CI

Call the CLI in a build pipeline to generate assets on demand:

```bash
brand-tool qr-code \
  --url=https://suse.com/product/${SLUG} \
  --color=#0c322c \
  --format=svg \
  --export \
  --output=./dist/qr-${SLUG}.svg
```
