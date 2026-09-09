# URL Mode

Every tool's state is expressible as URL parameters. This means any combination of inputs and export settings can be bookmarked, linked, embedded or piped through automation - with no login, no cookies and no server state.

The CLI uses the same parameter names and the same conversion logic. A URL you build for the web shell runs unchanged as `--flag=value` arguments on the CLI.

---

## URL structure

```
https://your-host/t/{toolId}?{param}={value}&{param}={value}
```

That path form is canonical - it's what the address bar shows once a tool has loaded, and what Share and the embed URLs build on. The older hash form, `#/tool/{toolId}?…`, still routes and is what a freshly-opened link often arrives as, so the two are interchangeable in everything below.

**Examples:**

```
/#/tool/qr-code?url=https://suse.com&color=%230c322c
/#/tool/qr-code?url=https://suse.com&format=png&export&filename=my-qr
/#/tool/quotes?quote=Open+source+wins.&name=Andy&format=svg&export&full
```

The first of those opens the QR tool with the address and the dark green already applied, no clicks in between.

![A QR code rendered straight from the URL, in the dark green passed as ?color](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fsuse.com%26color%3D%25230c322c&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=exp-url-qr-color&try=1)

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

The Wordmark tool is nothing but text params, so a link is the whole brief: `/#/tool/wordmark?text=Ship it&weight=800&tracking=-12&size=200`.

![The word "Ship it" outlined in a heavy weight with the letters pulled tight, both settings carried in by the link alone](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DShip%2520it%26weight%3D800%26tracking%3D-12%26size%3D200&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-text-wordmark)

### Select

Pass the option value (not the label).

```
?theme=dark
?ecl=H
```

A one-word change swaps the whole render: `?theme=dark` repaints a design from the URL alone.

### Number

```
?size=800
?padding=4
```

A number can also set how much of a thing gets made. Colour Palette builds one ramp cell per step, so `/#/tool/color-palette?steps=11` returns a wider sheet than the default seven.

![A palette sheet eleven cells wide, the count set only by the steps param](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fsteps%3D11&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-number-steps)

### Boolean

`1` or `true` for on, `0` or `false` for off.

```
?join=1
?showBorder=false
```

One flag can add a whole layer of information: `/#/tool/chart?showValues=1` prints the number on every bar.

![The D3 bar chart with a value printed on each bar, switched on by a single boolean param](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FshowValues%3D1&width=1440&height=900&dpi=192&waitMs=2800&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-boolean-values)

### Color

Pass a hex value (URL-encode the `#`).

```
?color=%230c322c
?background=%23ffffff
```

Colour params stack. Mesh Gradient takes one per stop, so three hex values in a link are three fields of colour in the render.

![A generative gradient blooming in coral, amber and violet, one bloom per colour param](/t/url-shot?url=%2F%23%2Ftool%2Fgradient%3Fcount%3D3%26blend%3Dnormal%26color1%3D%2523ff5f6d%26color2%3D%2523ffc371%26color3%3D%25236a11cb&width=880&height=560&dpi=96&waitMs=2400&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-color-mesh&try=1)

### Asset

Pass the asset's library ID - the runtime resolves it to the full asset object at render time.

```
?logo=suse/logo/primary
?headshot=team/andy-fitzsimon
```

To discover asset IDs, open the asset picker in the tool UI and inspect the value shown when an asset is selected. An audio ID works the same way as an image: Audiogram decodes whichever track the link names and draws its real waveform.

An explicit `AssetRef.pin`, available from engine 1.185, requests an exact retained version and optional format. The existing `version` property remains metadata about the last resolution; it does not by itself pin an asset. For typed state, use `{ id: "library/photo", source: "library", pin: { version: "v1", format: "png" } }`. The engine's `encodeAssetVersion(id, pin)` writes the reserved `#lolly-version=` suffix inside the asset value; let `serializeUrlState` perform the outer query encoding. Pins survive top-level and block asset fields. A missing version stays represented with an empty image URL and a resolution warning, rather than substituting current bytes or deleting the reference. Uploaded asset ids remain device-local even when pinned; editable `.lolly` files and explicit transfers can carry the referenced retained bytes.

![An audiogram card whose waveform is the actual shape of the catalogue track named in the link, with the title and the wide 16:9 size set alongside it](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Frain-on-the-boulevard%26title%3DRain%2520on%2520the%2520Boulevard%26subtitle%3DStraight%2520from%2520the%2520catalogue%26style%3Dwave%26size%3Dwide&width=1440&height=900&dpi=192&waitMs=4200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&cropSelector=%23tool-canvas&dark=1&filename=um-asset-audiogram)

**An asset value can also be another tool's render.** When a user pastes a Lolly tool link into the asset picker (a share link or an embed URL), the chosen value's "id" is the **canonical embed URL** of that render, so it round-trips through the URL exactly like a library id - just longer:

```
?hero=https%3A%2F%2Flolly.tools%2Ftool%2Fqr-code.svg%3Furl%3Dhttps%3A%2F%2Fsuse.com%26w%3D600%26h%3D600
```

On load the runtime re-renders it via `host.compose.renderUrl` instead of looking it up in the catalog. This is how one tool's output (a QR code, a filtered hero graphic) flows into another tool's image slot through a plain shareable link. See [Tool composition](#tool-composition-portable-embed-url) and the authoring guide.

> **User-uploaded images are device-local and not URL-shareable.** Images a user adds from their own device (`AssetRef.source: "user"`, ids like `user/upload/…`) live only in that device's local storage. There is no shareable id to encode, so they are deliberately omitted from the URL - a link that referenced one would not resolve on another device. To share a layout that uses a personal image, the recipient must select their own. (Avoiding this would require cloud hosting, which the platform intentionally does not do.)

### Blocks

Blocks inputs are repeating groups of fields (e.g. a list of team members, each with a name and city). Pass the value as a JSON array of objects, URL-encoded.

```
?people=[{"name":"Andy","city":"Nuremberg"},{"name":"Lisa","city":"Sydney"}]
```

Each object's keys must match the field `id`s defined in the tool's manifest. Fields can be omitted - missing fields are treated as empty strings. Chart Creator's `data` input is a blocks list of label, value and colour, so a whole dataset travels in the link:

![A three bar chart whose labels, values and bar colours all arrived as one JSON blocks param](/t/url-shot?url=%2F%23%2Ftool%2Fchart-creator%3FchartType%3Dvertical-bar%26data%3D%5B%7B%22label%22%3A%22Berlin%22%2C%22value%22%3A%2242%22%2C%22color%22%3A%22%25232453ff%22%7D%2C%7B%22label%22%3A%22Sydney%22%2C%22value%22%3A%2231%22%2C%22color%22%3A%22%252300a3a3%22%7D%2C%7B%22label%22%3A%22Lisbon%22%2C%22value%22%3A%2219%22%2C%22color%22%3A%22%2523fe7c3f%22%7D%5D&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-blocks-chart)

**CLI:**
```bash
lolly meeting-planner --people='[{"name":"Andy","city":"Nuremberg"},{"name":"Lisa","city":"Sydney"}]'
```

The URL updates automatically as block items are added, removed or edited in the UI - copy from the address bar to get a shareable link with all entries included.

> Blocks with a JSON representation larger than 8 KB are not written to the URL to avoid exceeding browser URL limits. In that case, use a saved state `slot` for sharing.

### Vector

A `vector` input is a fixed group of numbers edited as one control (e.g. a zoom + x/y offset). It has **no** single-param form - pass each field as a flat dotted param `<inputId>.<fieldId>`:

```
?imageFraming.zoom=200&imageFraming.x=30&imageFraming.y=70
```

One readable value per param. Used by tools such as `pose-geeko`, `chart-creator`, `filter`, `dynamic-layout` and `quotes`. Mesh Gradient parks each colour stop with one, so adding `?pos1.x=8&pos1.y=8&pos2.x=92&pos2.y=12&pos3.x=50&pos3.y=94` to the gradient above drives its three blooms out to the edges:

![The coral, amber and violet gradient again, this time with each bloom pinned to an edge by its own dotted x and y param](/t/url-shot?url=%2F%23%2Ftool%2Fgradient%3Fcount%3D3%26blend%3Dnormal%26color1%3D%2523ff5f6d%26color2%3D%2523ffc371%26color3%3D%25236a11cb%26pos1.x%3D8%26pos1.y%3D8%26pos2.x%3D92%26pos2.y%3D12%26pos3.x%3D50%26pos3.y%3D94&width=880&height=560&dpi=96&waitMs=2400&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-vector-positions)

### File

A `file` input (the user's own file, processed in memory) is **never** put in a URL - its bytes live only on the device, so there is nothing shareable to encode. On the CLI a file param is a filesystem path, loaded into memory before rendering:

```bash
lolly strip-data --source=./photo.jpg --format=jpg --output=clean.jpg
```

In the web shell a `file` input can't be pre-filled from a URL; a link that referenced one resolves as blank, and the recipient picks their own file.

### Table

A `table` input (a user-defined grid: column headings + rows, e.g. `battlecards`) is always **one compact param** - the header row first, then one `~`-separated segment per data row, cells `,`-separated and percent-escaped so prose cells full of commas survive:

```
?t=Pain,Summary,Strategy~Assurance,Is%20it%20open%3F,Table%20stakes%2C%20compete%20with%20why
```

A JSON form (`{"columns":[…],"rows":[…]}`) also parses. Long tables ride the packed `z` link like any other big state. On the CLI the same value works inline, or `--<inputId>-data=table.csv` fills the input from a CSV / TSV / Markdown-table file (first row = headings):

```bash
lolly battlecards --data-data=./cards.csv --output=deck.pdf
```

### Keyframe tracks

`kf` is not an input type - it is a **sub-field of a `blocks` input** (one per box), and like every other sub-field it rides the block's own encoding described under [Compact encoding](#compact-encoding-opt-in) below.

A box's `kf` field packs a whole animation track (position, size, scale, rotation, opacity, blur, depth) into one compact string, charset `A-Za-z0-9._*()-` only. Keyframes are separated by `*`; inside a keyframe, tokens are separated by `_`. The first token is always `t<ms>` (the keyframe's local box time, unscaled). The remaining tokens are channel values and an optional ease token:

- **Channels:** `x12.5`, `y-40`, `s1.2`, `r15`, `z140`, `o0.8`, `b2.5`, the size pair `w1280` / `h720`, the tilt pair `rx-8` / `ry20`, plus camera-only `f`/`a`/`p`. Tilt is a **camera** channel: `rx` pitches the camera and `ry` yaws it, in degrees, about the point it is already looking at - so the centre of the frame stays put and the artwork turns around it. **Negative `rx` pitches the camera down over the surface**, which puts the near edge of a layer at the bottom of the frame and sends the far edge toward a horizon at the top. Any non-zero angle makes the projection a perspective one rather than a flat scale, and a motion export of a tilted scene is captured off the live page frame by frame; a tilted scene that also holds a **video clip** refuses to export as motion, with a notice saying so.
- **Absolute vs relative.** `x`/`y`/`s`/`r`/`o`/`b` are **offsets and multipliers** over what the box already had, so a track composes with the authored pose and with any enter/exit transition. `z`, `w` and `h` are **absolute** and **replace** the box's own field for the segment they are keyed on. Size is the channel to reach for when the content must reflow - a keyed `w` re-lays-out the box, so text rewraps and a border stays one pixel wide, where `s` scales the finished picture instead.
- **Ease:** one of the eight presets `el`/`ei`/`eo`/`eio`/`ev`/`ea`/`es`/`ek`, the hold `eh` or a paren-delimited bezier `eb(0.32)(0)(0.67)(1)`. **Absent means `eio`** (ease-in-out), so an uneased segment is smoothed, never linear.
- **Longest name wins.** A token is read as the **longest channel name whose remainder parses as a number**: `rx-8` is channel `rx` at -8, never channel `r` followed by junk. A token that matches no channel or ease form that way is skipped rather than rejected, so a hand-edited link degrades gracefully instead of failing the render.

```
t0_z0_b4*t1500_eo_z140_b0*t4000_eh_z140_x-60
```

`kf` is written by the app, never hand-typed in practice, and hooks always re-parse and re-serialise it rather than passing the raw field through - so an unparseable or malicious value simply emits no track.

---

## Compact encoding (opt-in)

Tools can opt into a shorter URL form, which the web shell emits when you **copy a share link** (the live address bar keeps the readable long form). Both the long forms above and the compact forms below parse, so either kind of link works:

- **`urlKey` aliases** - an input (or block field) can declare a short key, e.g. `textColor` → `tc`, so `?tc=ff0000` sets it.
- **Colors without `#`** - a 6-char hex is stored bare (`?color=0c322c`), restored to `#0c322c` on parse.
- **Tilde-delimited block arrays** - instead of JSON, blocks serialise as `field,field,field~field,field,field` (one `~`-separated group per item; values URL-encoded, colors `#`-less).
- **Omitted defaults** - values equal to the input's default are dropped from the URL entirely.

`chart-creator` is a live tool that uses `urlKey`, so a link copied via its Copy URL / share button won't match the long-form examples in this doc - that's expected. `d3` uses them too: `?ct=radar&pl=cool&t=Short keys&lg=0` is chart type, palette, heading and legend in twelve characters of query.

![A radar chart in the cool palette, drawn from four short-key params instead of their long names](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dradar%26pl%3Dcool%26t%3DShort%2520keys%26lg%3D0&width=1440&height=900&dpi=192&waitMs=2800&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-compact-shortkeys)

---

## Reserved parameters

These keys are never treated as tool inputs. They control shell-level behaviour.

| Param | Where | Description |
|---|---|---|
| `format` | web + CLI | Output format (`png`, `svg`, `pdf`, …). Used by `export` and `copy`. |
| `export` | web + CLI | Presence flag - trigger an immediate download on page load. |
| `copy` | web only | Presence flag - arm copy-to-clipboard on first interaction. |
| `full` | web only | Presence flag - open in fullscreen (sidebar collapsed). |
| `options` | web only | Presence flag - open with the export-settings panel expanded instead of the collapsed Render button. `full` wins if both are set. |
| `filename` | web only | Name for the downloaded file (no extension). Defaults to the tool ID. |
| `slot` | web only | Name of a saved state slot to pre-load. URL params override saved values. (The one-shot CLI has no saved-state store, so it ignores `slot`.) |
| `template` | web only | Id of a `templates[]` entry in the tool's manifest to seed a fresh session from, skipping the "New from template" chooser (a launcher for a retired tool id, e.g. `?template=carousel`). The entry's `values` are read in-process (never packed into the link); an unknown or absent id falls through to the normal fresh-open flow. The CLI has no chooser, so it ignores `template`. |
| `preset` | web only | Id of a preset inside the named template - a preset is a curated values overlay on its template's base values, so `?template=poster&preset=story` seeds the Poster template in its Story variant. Only read alongside `template`; an unknown or absent id applies the template base alone. Ignored by the CLI. |
| `output` | CLI only | File path to write the exported file. Defaults to stdout. |
| `_v` | web + CLI | Tool version pin (e.g. `1.0.0`). Ignored if not matched - forward-compat safety. The `_` prefix as a whole is a **reserved namespace**: any param starting with `_` is skipped before input matching, and no tool input or `urlKey` may claim such a name - future reserved params are minted there so they can never collide with a tool's inputs. |
| `width` / `w` | web + CLI | Output width, as a value in `unit`. Also pre-fills the export dimensions panel. On a multi-artboard document, see the note below the table. |
| `height` / `h` | web + CLI | Output height, as a value in `unit`. Also pre-fills the export dimensions panel. On a multi-artboard document, see the note below the table. |
| `unit` | web + CLI | Physical unit for `width`/`height`: `px` (default), `mm`, `cm`, `in`, `pt`, `pc`. |
| `dpi` | web + CLI | Raster resolution for physical units (default `300`). Ignored for `px` and for vector formats. |
| `password` | web + CLI | Open password for `pdf` and `zip` - the **standard** tier only (the export panel's strong AES-256 tier, which also covers `pdf-cmyk`, is typed at export and deliberately never travels in a link). The CLI applies it wherever it can render a PDF. A basic lock, not strong encryption; it travels in clear text in the URL, so it's a light deterrent, not protection for confidential material. Ignored when `bleed`/`marks` are on (encrypted PDFs can't carry print finishing). |
| `profile` | web + CLI (press condition) | Colour profile, two roles by format. For ordinary raster (`png` / `jpg`) it selects the ICC profile: `srgb` (the default) embeds an sRGB profile; `none` omits it. For the print formats (`pdf-cmyk` / `cmyk-tiff`) it is the CMYK press condition, e.g. `fogra51` - **named** in the PDF's output intent (no profile bytes: no CMYK ICC ships with Lolly), recorded in the TIFF's provenance. `profile=own` instead **embeds** a CMYK profile loaded on the device the link is opened on, which is what a conformant PDF/X-4 Print PDF needs (see the print section for what else can withhold the claim); it resolves only when exactly one such profile is loaded, and otherwise writes no output intent and declares nothing. A digest is deliberately never in the link - which profile is embedded is the recipient's device's business, and so is the resulting file size. |
| `bleed` | web + CLI (browser tier) | Bleed amount for the print formats (`pdf` / `pdf-cmyk` / `cmyk-tiff`), as a dimension (e.g. `3mm`, `0.125in`). The artwork is scaled to fill the bleed; the PDF declares `TrimBox`/`BleedBox`, the TIFF is enlarged to the full sheet. |
| `marks` | web + CLI (browser tier) | Print marks for the print formats (`pdf` / `pdf-cmyk` / `cmyk-tiff`) - a CSV of `crop`, `reg`, `bleed`, `bars`, `prov`. Drawn in the page margin (PDF) or rasterised into the image margin (TIFF); registration prints on all four plates in `pdf-cmyk` and `cmyk-tiff`. `prov` (provenance credit text) is PDF-only. |
| `c2pa` | web + CLI (both default-on) | Content Credentials for the stampable formats. **On by default on both surfaces** - a tool opts out with `render.c2pa:false`, an on-device privacy utility never carries them and `c2pa=off` forces it off per export. `c2pa=7`/`30`/`90`/`365` sets the ephemeral-certificate lifetime in days; `c2pa=1` (or a bare `--c2pa` on the CLI) uses the default (30). Web: an enrolled identity's certificate window (fixed at enrolment) takes precedence and the lifetime value is ignored. CLI: ephemeral signing only; `--no-provenance` turns this and the imprint off together, which is how you get byte-identical output run to run. Mutually exclusive with `password` on PDFs. |
| `durable` | web (opt-in) | **Durable Content Credential** for raster exports (`png` / `jpg`/`jpeg` / `webp` / `avif` / `tiff`): an opt-in neural **TrustMark-format watermark** carrying Lolly's own identifier, so the "made with Lolly" link survives a metadata strip (a social upload, a re-save) and any TrustMark-aware tool can recover it. **Off by default** - a heavy on-device neural encode that also needs a model fetched once - so pass `durable=1` (or `durable=on`) to turn it on. A no-op if the encoder model isn't on-device (see `scripts/convert-trustmark-encoder-onnx.py`); raster-only for now (not the `pdf`/`pptx` container rasters). Complements - does not replace - the default `imprint` and the `c2pa` credential. Recognised on-device on the [/verify](/verify) page as a "Lolly durable mark" pip. See `plans/28-durable-content-credentials.md`. |
| `imprint` | web + CLI (both default-on) | Lolly **pixel watermark** for raster exports (`png` / `jpg`/`jpeg` / `webp` / `avif` / `tiff` - the RGB TIFF, not Print/CMYK TIFF), plus **Lolly-rendered raster content embedded inside a `pdf`, `pdf-cmyk` or `pptx`** export - a composed tool render, a gradient/filter fallback or an SVG illustration that gets walked to pixels still carries the mark even though the container itself isn't a raster format (a `zip` bundle carries it through to whichever of its members qualify). It never marks a user's own uploaded image - only art Lolly itself rasterised. **On by default**, like `c2pa` - embedded unless explicitly disabled; `imprint=0` (or `imprint=off`) turns it **off** (as does the CLI's `--no-provenance`). `imprint=1` (or a bare `?imprint`) is still accepted for existing links (redundant with the default). The **CLI** defaults it on too, and the browser-free resvg PNG path now embeds the mark itself rather than escalating to the browser tier; a render below the watermark's detection floor is reported and written unmarked. Unlike `c2pa` - which lives in a metadata container and dies to any re-save or strip - the imprint survives metadata stripping, recompression (down to ~JPEG q50) and an 8-pixel-aligned crop, so it's a durable **complement** to the credential. TIFF (lossless) round-trips the mark exactly; AVIF's AV1 encode applies the mark pre-encode but its survival through that encode is not yet calibrated/verified. It does **not** survive an arbitrary resize, and it is security-through-obscurity (the detector key is public), so it's an integrity hint, not a hardened claim. Detected on-device on the [/verify](/verify) page - for `pdf`/`pdf-cmyk`/`pptx` files, detection scans the embedded Lolly-rendered rasters, not the page/slide as a whole. |
| `meta` | web + CLI (default-on) | **Generator-metadata toggle.** A generated export normally names its source in the format's own generator field - EPS `%%Creator`, DXF `999` comment, EXR/Radiance `software`/`SOFTWARE=`, PDF `Producer` - plain ASCII `Lolly lolly.tools`, no scheme or punctuation a vintage reader could choke on. **On by default**, like `imprint`/`c2pa`; pass `meta=off` (or `meta=0`) to strip that source field for a metadata-free export. This is a generated artifact's generator field only - a *user's own* file goes through the on-device transform path (Strip Hidden Data), which never adds metadata. Distinct from `c2pa` (the signed credential) and `imprint` (the pixel watermark): `meta=off` drops only the plain generator text, not the credential. |
| `hdr` | web + CLI/MCP | **HDR raster export** (`png` / `jpg`/`jpeg` / `avif` / `tiff`): re-encode the pixels to **Rec.2100 PQ** - BT.2020 primaries, SMPTE ST 2084 transfer - so brand colours and white text reach peak brightness on an HDR display, and tag the container so a colour-managed viewer reads them that way (an ICC v4 profile carrying a `cicp` tag for `jpg`/`tiff`, a `cICP` chunk for `png`, a rewritten `colr` box for `avif`). **Off by default** - it changes the pixels rather than labelling them - so pass `hdr=1` (or `hdr=on`/`hdr=pq`) to turn it on. A **tuned** form carries the export panel's four author dials in the same value: `hdr=<peakNits>-<reach>-<lift>-<focus>`, e.g. `hdr=1600-60-0-50` (White 1600 nits, Reach 60, Dark lift 0, Focus 50); `hdr=1` means the defaults (`1000-45-0-40`). The boost is gated on OKLab lightness and hue-preserving, so darks stay dark and a brand green doesn't drift minty. **`webp` is deliberately excluded** (8-bit, no working HDR decode path - a PQ WebP just looks dark), as are the vector formats and PDF. Note that many platforms re-encode uploads and **strip** the HDR signal, which can leave the image looking dark - see [Exporting → HDR](/info/exporting.html#hdr-bright-colours). On the CLI and MCP it is also what makes the float formats possible: `--export=exr` and `--export=hdr` REQUIRE `--hdr=1`, because the terminal render path rasterises to 8-bit sRGB and the view transform is the only thing that generates genuine above-1.0 range (without it, and when a render has nothing to lift, the export refuses rather than padding 8 bits into float). |
| `depth` | web, CLI | **Requested bit depth** for the export: `8`, `16`, `float` or `auto` (the default). Bits per channel for `8`/`16`; `float` means floating-point samples, the depth the film and VFX formats speak. It is a **request, not a promise**: depth follows provenance, so a consumer writes deep bits only where the pipeline actually produced them - a 16-bit file made from an 8-bit canvas render is padding, and Lolly would rather hand you the honest 8-bit file than a bigger one that carries no more picture. `auto` asks for the deepest the chain supports, which is how deep output becomes the default as more of the pipeline earns it (the same rule gamut follows - see [Colour spaces](/info/color-spaces.html)). Formats that are inherently deep (OpenEXR, Radiance `.hdr`) ignore the param except for one choice - on the CLI, `depth=float` writes an EXR with 32-bit float samples instead of the default 16-bit half - and an HDR PNG is written at 16 bits regardless because 8-bit PQ bands (`depth=8` there falls back to the legacy encode). What the CLI does **not** do is honour `depth=16` on png/tiff: the terminal render path rasterises to 8-bit sRGB, so those bits would be padding, and the request is ignored silently rather than obeyed. Junk (`depth=32`, `depth=deep`, an empty value) reads as `auto` rather than failing the export. See [`plans/61-deeprichpixels.md`](https://github.com/lolly-tools/lolly/blob/main/plans/61-deeprichpixels.md), section 10. |
| `cuts` | web export panel; CLI refuses `cuts>1` | **Contact sheet** for a still export (`png` / `jpg` / `webp` / `svg` / `pdf`) of a **timed composition** - a Sequence timeline, or any tool whose stage carries `data-sequence`. An integer, default `1`. `cuts=1` renders the frame at the **playhead** (what you see is what you get) and is identical to leaving the param off. The web shell takes the count from the export panel's **Frames** field, not from the link; the CLI reads the param and exits 3 on `cuts>1`, writing nothing, rather than quietly handing back one frame. `cuts=N` for `N > 1` samples `N` stills at equal intervals across the sequence and hands them back together: raster and SVG as `N` **zipped** files (`<filename>-01.png`, `-02.png`, …), `pdf` as **one document of `N` pages**. Sampling is **midpoint**, not endpoint - `t_i = duration x (i + 0.5) / N` - because at `t = 0` an `enter` transition is still at alpha 0 (a blank card) and at `t = duration` every clip has ended, so endpoint sampling would waste the first and last frame of a sheet on blanks. Clamped to `1`-`64`; junk (non-numeric, `0`, negative, `Infinity`) falls back to `1` rather than failing the export. Ignored for non-still formats (video/animation already have every frame) and for stages with no sequence. See [`plans/51-fable-timeline-editing.md`](https://github.com/lolly-tools/lolly/blob/main/plans/51-fable-timeline-editing.md), section 4.6. |
| `fps` | web + CLI/MCP | **Frame rate** for the motion formats (`mp4` / `webm` / `gif` / `apng` / `webp-anim`): an integer 1..120, the URL form of the export panel's Frame rate select (24, 25, 30, 50, 60 there; any integer here). Absent or junk leaves each format's own default (30 for the video containers). On the CLI, `--fps=60` is this param forwarded to the browser tier. |
| `seconds` | web + CLI/MCP | **Clip length** in seconds (0.5..3600) for the motion formats - the panel's Duration field. A length given here is a **deliberate** one: the export carries it as `durationUserSet`, so a tool whose hook would otherwise stretch the clip to its material (the Audiogram runs to the end of its audio; a Sequence to its timeline) renders exactly this long instead. Named `seconds` because `duration` is an input id in several tools (3d, flythrough, spatial-photo) and a reserved name must collide with none. |
| `wait` | web + CLI/MCP | **Settle time** in seconds (0..30) before the first frame is captured - the panel's Start after field. For a tool whose first frames are a fade-in or a data fetch. |
| `codec` | web + CLI/MCP | **Video codec** for `mp4` / `webm`: `h264`, `hevc`, `vp9` or `av1` (aliases `avc`, `h265`, `vp09`, `av01` read the same). The panel's Codec select; absent means Auto, the best the encoder offers, which on many machines is AV1 - so pin `codec=h264` when the file has to play in every browser's `<video>` or on an older phone. |
| `vq` | web + CLI/MCP | **Video quality** stop: `smaller`, `balanced` (the default) or `best` - the panel's Quality select, which drives the bitrate ladder. Named `vq` because `quality` is an input id (convert-image). |
| `lang` | web + CLI | UI/content language as a canonical short code: `en` (default), `es`, `de`, `fr`, `zh` (Simplified), `zh-hant` (Traditional), `ja`, `ko`, `vi`, `pt`, `it`, `nl`, `sv`, `no`, `pl`, `cs`, `ro`, `tr`, `uk`, `bg`, `ms`, `id`, `tl`, `hi`, `bn`, `ur` and `ar` (the `LANGS` set in `engine/src/lang.ts` is the source of truth). Arabic and Urdu render right-to-left (the whole UI mirrors). Informal aliases (`cn`, `jp` and `in` for `id`) are accepted and normalized on parse. Applies for that session only - it does **not** overwrite the recipient's saved language preference. Unset/unrecognized falls back to the profile, then `localStorage`, then the browser's language, then English. |
| `designv` | web + CLI | The **design-system version** this render resolves against: a published version's slug, or `latest` for the edit head. Highest rung of the resolution ladder - it beats a tool's `designVersion` manifest pin and the active version, and it falls through to the next rung when it names nothing this device has, so a link never fails to draw. A testing lever for authors ("check against `latest`, fix, then publish"); it is never written into a generated share link, because a version belongs to the design system it was published in, not to whoever opens the link. On a device that has never published a version, every value resolves to the edit head - the behaviour before versions existed. One difference between the two shells today: the CLI reads the pin out of the tool's manifest as the rung below this param, while the web shell resolves this param and the active version only, so a manifest pin does not change what a browser draws yet. |
| `ds` | web + CLI | The **design system** this render resolves against: the id of one of the design systems held on the device (`default`, `shipped`, or a slug like `acme-2026`). A value that fails the id grammar reads as absent, and an id for a system the device does not hold falls through to the active one with a warning, so a link never fails to draw. Like `designv`, it is never written into a generated share link: a design system belongs to whoever holds it, and a link must not pin its recipient to one that isn't theirs. Pair it with `designv` to name a published version of that system. |
| `nostage` | web only | Presence flag - for the `html` export only, drop the fixed-size canvas frame ("stage") so the saved page fills the whole window: the tool's content becomes the document body, with no centred card or grey backdrop. Mirrors the **Full page** toggle in the export panel. |
| `present` | web only | Presence flag - open a frame document (Design) as a fullscreen, click-advanced **deck**. The document's frames become slides in presentation order (`order`, tie-break `x`); a non-frame **timed** document instead mounts normally and starts its sequence transport. The CLI documents it as a no-op (there is no fullscreen to present into). |
| `s` | web + CLI | The **state address** of a deck. `s=2` is the 1-based position in presentation order; anything else (`s=slide1`, a ULID) is a frame id; an `.N` suffix (`s=2.3`) names a build step. With `present` it deep-links that slide (and that build step); without `present` the editor centres that frame on mount. It is also a **still-export filter**: `?s=2&format=png` renders just that one slide, so every slide of a deck has its own image link, and `lolly design --s=2 --export=png` means the same thing (both shells resolve the address with the same engine code). Build steps are presenter-only - a still export always shows every build. Formats that carry the whole deck by construction (`pdf`, `zip`, `pptx`, `html`) and the motion formats (where time selects the frame, not `s`) are rendered whole; the CLI says so rather than obeying a filter it cannot apply. An address that names no slide never falls back to slide 1: the web shell exports the whole deck and announces the mismatch, the CLI exits 2 and writes nothing. |
| `kiosk` | web only (present mode) | Presence flag - the presenter **wraps** at the ends and a timed document's transport loops, so `?present&kiosk` is digital signage (pair with per-frame `dur` for dwell). This flag was named `loop` until 2026-08-28; it was renamed and reserved because `loop` is a real input id in several tools (3D, Flythrough, …) and could never be reserved without stripping their value. Old `?present&loop` links no longer loop - re-mint them with `kiosk`. |
| `z` | web + CLI | A **packed** whole-state token - the entire readable query, compressed (raw DEFLATE) and base64url-encoded, for complex tools whose readable link would blow past practical URL limits. See [Packed links](#packed-links-z) below. |
| `zx` | web only | An **encrypted** whole-state token - the packed state AES-256-GCM-encrypted under a password-derived key (PBKDF2). Opening the link prompts for the password **in the browser** (no server); the password itself is never in the link. See [Encrypted links](#encrypted-links-zx) below. |

The reserved `z` (and `zx`) above is a **top-level** param only - the whole-state packed/encrypted token. A box's own `z` depth field and a keyframe track's `z` channel token live inside the `boxes` block's per-box sub-fields, a separate namespace decoded positionally, so there is no collision between the two.

**Dimensions on a multi-artboard document** (a Design doc with more than one artboard): the artboards are the size truth, and `width`/`height` describe the **active** artboard - the selected one for still formats, the one under the playhead for animated ones. In the app the export panel mirrors that artboard live, and editing the fields resizes it. At export time each format resolves the boards its own way: still images fan out to one file per artboard at that board's own size (zipped when there is more than one, and `?s=` narrows to one board), PDF and PPTX carry every board as a page at its native size, and the animated formats composite every scene into a `width`×`height` output frame, letterboxing a board whose aspect differs. So on a framed document `w`/`h` never scales the whole set - it is the size of one board, and the video frame.

`export`, `copy`, `full`, `options`, `nostage`, `present` and `kiosk` are **presence flags** - the parameter value is ignored; what matters is whether the key appears in the URL.

`lang` is the one reserved param that changes the interface rather than the file. Adding `?lang=ja` to any tool link hands the recipient the whole sidebar in Japanese for that session, without touching their saved preference.

![The Colour Palette controls with every label, hint and dropdown option in Japanese, from one lang param](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Flang%3Dja&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-inputs&css=%23tool-canvas%7Bdisplay%3Anone%7D&dark=1&filename=um-lang-japanese)

> **Building share links in the UI.** In the web shell you don't have to hand-write these. The **Share** button (in the export panel) opens a dialog with the ready-to-copy link plus a toggle for each on-visit flag - _open fullscreen_ (`full`), _open with the export panel expanded_ (`options`), _download automatically_ (`export`), _copy to clipboard_ (`copy`) and _pin tool version_ (`_v`). The copy toggle appears only for clipboard-friendly formats (bitmap/text/html) and is hidden for SVG, PDF and video. Ticking a box rewrites the link in place. The **same dialog** is reachable from **Projects → Share link** on any saved session (it reconstructs the tool URL from the saved inputs).

### Packed links (`z`)

Readable URLs are first-class - a simple `?color=30BA78&theme=dark` link can be hand-edited. But a complex tool (e.g. Design, with dozens of boxes each carrying coordinates, colours and text) serialises to thousands of characters, past the ~2000-char ceiling that pasted links, social crawlers, QR codes and some servers still enforce.

For those, the app compresses the **entire readable query** into one `z` param:

```
/t/design?background=…&boxes=…&format=png   ← readable (e.g. 2729 chars)
/t/design?z=1eJyFkc…                         ← packed   (e.g. 1059 chars)
```

- **Codec.** `z`'s value is `<tag><payload>`. Tag `1` is raw DEFLATE (RFC 1951, a frozen standard) via the platform-native `CompressionStream`, carried as base64url - the default, and the shortest form in characters. Tag `2` is the same DEFLATE bytes carried as unpadded upper-case base32 (RFC 4648): about 20% more characters, but every character sits in a QR code's alphanumeric set (5.5 bits per character instead of 8), so the Share dialog's **QR** button re-mints large links this way and the printed code comes out a version or two smaller. Both tags decode everywhere, forever; the tag byte versions the codec so future variants can be added without breaking links minted today.
- **Stable by construction.** The packed form compresses the app's own canonical readable query, so there's no separate encoding to keep in sync - and DEFLATE is standard, so a link packed in a browser decodes identically in Node's `zlib` (and the CLI), across app versions. There is no server-side or app-side lookup table that could drift.
- **When it kicks in.** Packing is used only when it's actually shorter (it *loses* on short links - DEFLATE framing plus base64's ⁴⁄₃ blow-up exceed tiny payloads), and the address bar switches to it automatically once the readable query passes ~1800 characters. Below that, links stay readable and editable. The **Share** dialog surfaces a **Shortest link** checkbox (auto-ticked for large states) showing the character saving.
- **Expansion.** `expandQuery()` (engine) turns a `z` link back into a plain query *before* parsing, so everything downstream - the web shell, the CLI (`lolly <id> --z=1eJ…`) and pasted-link composition - behaves identically to the readable form. On-visit flags (`export`, `full`, `_v`, …) can ride alongside `z` in readable form and still take effect.

### Encrypted links (`zx`)

A password-gated variant of a packed link: share a link that only opens for someone who knows the password - with **no server and no account**.

The state is DEFLATE'd then **AES-256-GCM**-encrypted under a key derived from a password (**PBKDF2-SHA256**), and carried in a `zx` param. Opening the link prompts for the password, derives the key and decrypts **entirely in the recipient's browser**, then rebuilds the tool content. Wrong password → it asks again; cancel → the tool loads at its defaults.

- **The password never travels.** Only the ciphertext (plus a random salt and IV) is in the link. You share the password separately - and because it's not stored anywhere, it can't be recovered if lost.
- **Turn it on in the Share dialog** - tick *Password-protect this link* and set a password; the link updates to the `zx` form. On-visit flags still ride readable alongside it.
- **Interactive-only.** An encrypted link can be *opened* in Lolly but not *embedded as an image* (the embed path renders headless and can't prompt) - such a link simply renders at defaults there.
- **Independent of `z`.** `zx` is its own codec (`<tag><base64url>` of `salt‖iv‖ciphertext`), so it versions separately and `expandQuery` deliberately never touches it - decryption happens only at the interactive load boundary that can prompt.

### Physical units (`unit=` + `dpi=`)

`width`/`height` are plain numbers; `unit` says what they mean. With a physical unit the output is rendered at the correct **physical** size for the format, not just a pixel count:

- **PDF** → a true page of that size (points, resolution-free). `?w=210&h=297&unit=mm&format=pdf` is a real A4.
- **SVG** → `width`/`height` carry the unit (e.g. `210mm`) with a px `viewBox`, so it scales cleanly.
- **PNG / JPG / WebP** → pixels at `dpi` (e.g. 210mm @ 300dpi = 2480px). PNG also embeds the DPI (a `pHYs` chunk) so print/layout software places it at the intended size.

`px` is the default and behaves exactly as before (the CSS 96-DPI convention). The canvas takes the physical shape straight away, so `?w=210&h=297&unit=mm&format=pdf` shows you a portrait A4 before you export anything.

![The Wordmark canvas standing as a portrait A4 page, its shape set by the width, height and unit params before anything is exported](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DPrint%2520me%26size%3D120%26w%3D210%26h%3D297%26unit%3Dmm%26format%3Dpdf&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&cropSelector=%23tool-canvas-outer&dark=1&filename=um-units-a4)

```
lolly quotes --quote="Print me." --width=210 --height=297 --unit=mm --export=svg --output=a4.svg
```

### Print marks & bleed (`bleed=` + `marks=`)

For print-ready output, `bleed=` and `marks=` add the prep a print shop expects to the
`pdf` (RGB), `pdf-cmyk` (Print PDF) and `cmyk-tiff` (Print TIFF) formats. They're ignored
for every other format. The two CMYK formats apply the same engine geometry - the PDF as
vectors with declared page boxes, the TIFF rasterised onto an enlarged sheet.

![The Print marks and bleed card opened by a bleed and marks link, with each mark toggle already set](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpdf-cmyk%26bleed%3D3mm%26marks%3Dcrop%2Creg%2Cbleed%2Cbars%26options&width=1440&height=900&dpi=192&waitMs=2000&format=svg&cropSelector=.export-print&walker=1&dark=1&filename=exp-print-marks-card)

- `bleed=3mm` - the design is scaled to fill the bleed (the trim area is unchanged). The PDF declares its `TrimBox` (final cut) and `BleedBox` for the RIP; the TIFF is enlarged to the full sheet, the artwork composited over white to cover the bleed.
- `marks=crop,reg,bleed,bars` - draws, in the margin: **crop** (trim) marks, **reg**istration targets, **bleed** marks and a colour **bars**. In `pdf-cmyk` the line marks are DeviceCMYK `1 1 1 1` so they print on every plate; in `cmyk-tiff` they're written straight into the pixel buffer as all four channels at full ink (`C=M=Y=K=255`, the raster analogue), drawn **after** the RGB→CMYK pass so they aren't remapped; in the RGB `pdf` they're black. Mark length, gap and stroke weight are fixed to print standards.
  - In `pdf-cmyk` the bar becomes a **brand verification strip**: the four solid process primaries (C, M, Y, K) come first as a fixed calibration reference, then - after a wider gap - each brand colour that actually substituted in this artwork appears as an RGB reference swatch touching its CMYK substitution, so a press operator can confirm the RGB→CMYK swap was applied. Only the inks really used are shown (substitution records which palette colours were hit); the pairs are capped by the available margin width and a flat ceiling of 12 brand cells. The RGB `pdf` and the `cmyk-tiff` (which does a flat per-pixel conversion with no exact substitution to verify) show a generic process/overprint/tint control bar instead.
- `prov` (PDF only) - adds small **provenance** credit text in the proof margin, taken from the export's authorship metadata: the export timestamp *{YYYY-MM-DD HH:MM}* at the top-left, *"Made with https://lolly.tools"* at the top-right and *"{Tool} by {Author}"* climbing the bottom-left. Like the other marks it sits outside the trim, so it's removed at the final cut (a proof annotation, not artwork). The author appears only when the user has opted into personal details (Profile → "Use my details").

The CMYK press condition (`profile=`, e.g. `fogra51`) is carried for both CMYK formats: the Print PDF declares it in the document's output intent; the Print TIFF records it as provenance in `ImageDescription` (the pixels stay untagged DeviceCMYK - no embedded profile, so the file is never mislabelled).

A named condition tells a RIP what the DeviceCMYK values mean, but PDF/X-4 also wants the profile itself **inside** the file, and no CMYK ICC ships with Lolly. So a named condition writes the output intent and **not** the `GTS_PDFXVersion` conformance claim. Load a CMYK profile of your own (Colour Lab, or the export panel's Colour profile control) and pick its *Embed* row - `profile=own` in a link - and the profile is embedded as the `DestOutputProfile`, at which point the file can claim PDF/X-4 - and does, unless something else in the export makes the claim untrue: RGB artwork the CMYK pass couldn't convert, `marks=prov` (its credit text is set in a standard font that isn't embedded, which X-4 doesn't excuse) or a strong password (X-4 forbids encryption). The output intent is written either way. The intent then declares the registered condition only where the profile itself proves one (its own `targ` characterization data, or a fetch Lolly made from the ICC registry); otherwise it declares `Custom` under the profile's own name, which is the honest reading of an unpaired profile.

```
?format=cmyk-tiff&bleed=3mm&marks=crop,reg,bleed,bars&profile=fogra51&export
```

> Marks/bleed and the PDF open-`password` are mutually exclusive: print finishing is applied via pdf-lib, which can't write encrypted PDFs, so a `password` is ignored when marks/bleed are on. (`cmyk-tiff` has no password concept.)

---

### Contact sheets (`cuts=`)

A still export of a **timed composition** renders the frame at the playhead. That's the
contract: what you see on the stage is what goes into the file. A contact sheet asks for
more than that frame - `N` stills sampled at equal intervals across the sequence, for a
storyboard, a thumbnail sheet or a social carousel.

> **Set this in the export panel, not the link.** The **Frames** field in the export panel
> is what produces a contact sheet today - see
> [Exporting](/info/exporting.html#stills-from-a-timed-composition). `cuts` is reserved,
> parsed and clamped by the engine, but the web shell takes the count from that field
> rather than from the URL, so a link carrying `?cuts=6` renders the single playhead frame
> and a Share link never carries the value. The **CLI** does read it, and answers plainly:
> `--cuts=6` (or a pasted link carrying it) exits 3 and writes nothing, because the
> sequence renderer lives in the web shell and a single frame under the filename you asked
> for would be a different artefact. The rest of this section describes the behaviour the
> Frames field drives.

With `N > 1` and **PDF** chosen you get **one N-page PDF**, one page per sample, in time
order; with `png`/`jpg`/`webp`/`svg` you get a **zip of N files** (`-01` … `-0N`) instead,
because PDF is the only still format that can hold several frames in one file. `1` is the
single playhead frame.

Samples land at the **midpoint** of each slice - `t_i = duration x (i + 0.5) / N`, so a
6-cut render of a 12-second sequence samples at 1s, 3s, 5s, 7s, 9s and 11s. Sampling the
endpoints instead (0s and 12s) would hand you two blank cards: at `t = 0` an `enter`
transition hasn't faded in yet, and at `t = duration` every clip has already ended.

Values are clamped to `1`-`64` (a contact sheet is for a human to look at; 64 is already
an 8x8 wall), and anything unparseable falls back to `1` rather than failing the export.
Non-still formats ignore `cuts` entirely - a video already contains every frame.

---

## Format with `format=`

`format=<fmt>` selects the output format for both `export` (download) and `copy` (clipboard).

Supported values:

| Value | Output |
|---|---|
| `svg` | Scalable vector (requires `<svg>` root in the template) |
| `svg-anim` | Animated SVG - self-contained vector flipbook (animated tools only) |
| `emf` | Enhanced Metafile vector (for Office apps) |
| `eps` | Encapsulated PostScript vector (RGB) |
| `eps-cmyk` | Encapsulated PostScript vector - DeviceCMYK (naive conversion, no output intent) |
| `dxf` | DXF vector cut file - AutoCAD R12, paths in mm (laser/vinyl/CNC) |
| `png` | Lossless raster |
| `jpg` / `jpeg` | Lossy raster |
| `webp` | Lossy/lossless raster |
| `avif` | AVIF raster |
| `tiff` | Uncompressed sRGB raster (RGB TIFF) |
| `exr` / `hdr` | Float raster interchange - OpenEXR and Radiance RGBE, written over a render carrying genuine headroom (`hdr=1`) |
| `pdf` | PDF document |
| `pdf-cmyk` | Print PDF - CMYK with output intent (see print marks & bleed) |
| `cmyk-tiff` | Print TIFF - flattened CMYK raster |
| `pptx` | PowerPoint deck - native editable text/shapes + extractable images/vectors |
| `penpot` | Penpot design file - boards, editable shapes and the brand's colours, typographies and design tokens |
| `docx` / `odt` | Word / OpenDocument text - headings and paragraphs read off the render, editable, not a picture of the page |
| `ico` | Icon bundle (e.g. `tool-logo`) |
| `zip` | Multi-file bundle (optionally password-locked - see Exporting → Locked downloads) |
| `html` | Static HTML document |
| `md` / `txt` | Markdown / plain text |
| `json` / `csv` | Structured data |
| `css` / `scss` | Colour tokens as CSS custom properties or Sass variables |
| `gpl` / `ase` | Swatches for other design apps - GIMP palette, Adobe Swatch Exchange |
| `ics` / `vcf` | Calendar event / contact card |
| `ttf` / `otf` / `woff` | Font files (Convert Font) |
| `gif` | Animated GIF (animated tools only) |
| `apng` | Animated PNG - full colour + real alpha (animated tools only) |
| `webp-anim` | Animated WebP - full colour + alpha, smallest file (animated tools only) |
| `webm` | WebM video (animated tools only; Chrome/Firefox/Android) |
| `mp4` | MP4 video (animated tools only; Safari/iOS and recent Chrome) |
| `wav` / `mp3` / `m4a` / `opus` | Audio only - the sound with no picture |

Not all tools support all formats - only the formats listed in the tool's manifest `render.formats` are valid. The authority on the whole set is the `render.formats` enum in `schemas/tool.schema.json`; this table names what each value produces. Requesting an unsupported format falls back gracefully.

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

Sets the name of the downloaded file. The format extension is appended automatically - do not include it.

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
first interaction with the page - the click that supplies the required gesture.

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

Mixing long and short forms is fine - `?width=1200&h=630` works. The canvas preview updates to the new aspect ratio.

![Mesh Gradient reshaped to a 1920 by 1080 canvas by the w and h params alone](/t/url-shot?url=%2F%23%2Ftool%2Fgradient%3Fw%3D1920%26h%3D1080&width=880&height=560&dpi=96&waitMs=2400&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=exp-url-dims)

---

## Fullscreen with `full`

`full` collapses the sidebar so the canvas fills the entire viewport. The value is ignored - presence of the param is enough.

```
/#/tool/qr-code?url=https://suse.com&full
```

Any tool takes it. Mesh Gradient with `full` is artwork and nothing else.

![A tool opened with full - no sidebar and no chrome, just the artwork edge to edge](/t/url-shot?url=%2F%23%2Ftool%2Fgradient%3Ffull&width=880&height=560&dpi=96&waitMs=2400&walker=1&format=svg&dark=1&filename=exp-url-full)

Combine with `export` for a clean unattended export flow:

```
/#/tool/qr-code?url=https://suse.com&format=png&filename=my-qr&export&full
```

---

## Land on the export panel with `options`

`options` opens the tool with the export-settings panel already expanded (format, dimensions, DPI and the export/copy buttons) instead of the collapsed **Render** button. Use it to share a link where the recipient is one click from downloading.

```
/#/tool/qr-code?url=https://suse.com&options
```

![The export panel already expanded at the foot of the sidebar, one click from a download](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26options&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&cropSelector=.export-popup&dark=1&filename=exp-options-panel)

`options` is the opposite of `full`: `full` hides all chrome to show only the preview, while `options` surfaces the export chrome. If both appear, `full` wins (there's nowhere to anchor the export panel once the sidebar is collapsed). The flag is web-only - the CLI ignores it.

---

## Transparent background

Tools that support transparent export expose a `transparentBg` boolean input. Pass it like any other boolean input:

```
?transparentBg=1
```

Transparency is preserved in formats that support an alpha channel: `png`, `webp` and `avif`. It is ignored for `jpg`, `pdf` and `svg` (SVG has no background rect when transparent).

Full example:

```
/#/tool/qr-code?url=https://suse.com&color=%230c322c&transparentBg=1&format=png&export&filename=qr-transparent
```

The engine injects a second export toggle the same way: `convertPaths` (the **Convert paths** text-to-vector outlining control) is added automatically to tools that export a vector format. It is URL-expressible as any boolean - `?convertPaths=0` to leave text live, `?convertPaths=1` to outline it - and defaults on. A tool that sets `render.convertPaths: false` suppresses it (and the param has no effect).

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

This opens the QR tool, applies all inputs, sets the canvas to 600×600, collapses the sidebar and immediately downloads `event-qr.png`.

The same stacking works on a chart, where inputs, compact keys, canvas size and `full` arrive together:

```
/#/tool/chart?ct=donut&pl=warm&t=Everything+in+one+link&lg=1&lp=right&sv=1&w=1200&h=800&full
```

![A warm-palette donut with a legend on the right and values on every slice, filling the window because the same link also passed full](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Ddonut%26pl%3Dwarm%26t%3DEverything%2520in%2520one%2520link%26lg%3D1%26lp%3Dright%26sv%3D1%26w%3D1200%26h%3D800%26full&width=1440&height=900&dpi=192&waitMs=2800&walker=1&format=svg&dark=1&filename=um-combined-stack)

---

## CLI usage

The CLI uses the same param names as URL mode - `--key=value` instead of `?key=value`. `--export=<fmt>` sets the output format and `--output` the destination; all other params are tool inputs. Note that on the CLI `--export` *takes* the format - it is not URL mode's presence flag, which has no CLI equivalent because writing a file **is** the export. (`--format=<fmt>` is accepted as a synonym, but never pass a bare `--export` alongside it: the bare form is read as the format `1` and the render aborts.)

```bash
# Web equivalent: /t/qr-code?url=https://suse.com&format=png&export&filename=my-qr
lolly qr-code --url=https://suse.com --export=png --output=my-qr.png

# Pipe SVG to another tool
lolly qr-code --url=https://suse.com --export=svg > qr.svg

# Print available inputs for a tool
lolly qr-code
```

---

## Integration patterns

### Shareable link

The web shell writes the current input state to the URL query automatically as inputs change - copy from the address bar at any time.

### Pre-filled embed

Embed the tool in an iframe with inputs pre-filled via URL:

```html
<iframe src="https://brand.example.com/#/tool/qr-code?url=https://suse.com&full"
        width="900" height="700" frameborder="0"></iframe>
```

Embedding a page **into another origin** is off unless the deployment turns it on.
Lolly ships `frame-ancestors 'self'` in its Content-Security-Policy, so a shell
frames inside its own site but not inside someone else's. That is the safer default
for an app holding your documents and offering export actions, since a page you do
not control can otherwise position an invisible frame over its own buttons. Framing
within one origin (your marketing page embedding your own Lolly) needs no change.
To allow another origin, the operator adds it to `frame-ancestors` where the headers
are set (`vercel.json`, or `deploy/docker/security-headers.conf` for the container),
naming the specific origins rather than widening it to every site.

### Tool composition (portable embed URL)

A tool can embed **another tool's** render with no tool-to-tool imports. The URL-mode face of this is a portable embed URL - a real-looking image URL whose query is ordinary URL-mode params:

```html
<img src="https://lolly.tools/tool/qr-code.svg?url=https://suse.com&color=0c322c">
```

**Nothing is ever fetched from `lolly.tools`.** A shell recognises this exact shape and renders the named tool **locally**, substituting the result (a placeholder pixel shows until the local render resolves). Anything that isn't exactly this grammar is treated as an ordinary image - that strict match is the security boundary.

The path extension is the author's fidelity choice. Compose any tool's render: an SVG child stays a **true vector** when the parent exports to SVG or PDF and rasterises crisply for PNG; raster children (`png`, `jpg`/`jpeg`, `webp`) embed as images. (`pdf` appears in the grammar but is not inlined as a child format.)

This is the URL-mode surface of composition. The declarative form - a manifest `composes: [{ id, tool, inputs, format? }]` block resolved by the engine and placed in the template as `{{asset <id>}}` - is not a URL param; see the authoring guide. Either form requires the tool to declare the `compose` capability. `event-name-badge` composes `qr-code` as SVG today.

### Automation / CI

Call the CLI in a build pipeline to generate assets on demand:

```bash
lolly qr-code \
  --url=https://suse.com/product/${SLUG} \
  --color=#0c322c \
  --export=svg \
  --output=./dist/qr-${SLUG}.svg
```

---

## App links

Everything above addresses a **tool**. The rest of the app is addressable the same way: the browse views, the studio, the dashboard and the settings pages each read a few params off their own route, so a link can land someone on a particular shelf of the catalogue or a particular settings card rather than on the front door.

Two audiences use this, and they want the same thing for different reasons:

- **Sharing.** "Here, look at *this*" - a link that opens where you were looking, so the person on the other end doesn't have to be talked through four clicks.
- **Automation.** A screenshot run, an agent driving the app, a docs recipe. Every `/info` screenshot in these docs is one of these links handed to `url-shot`; the app has to arrive in a known state, deterministically, with no clicking.

Three rules hold everywhere below, and they are what make the links safe to paste:

1. **Consumed on arrival.** These params are read once, when the view mounts. They are never written back into a link the app generates for you, so a state you deep-linked into doesn't get re-shared by accident.
2. **Never persisted.** A param that overrides a saved preference - sort order, view mode, theme - does so *for that page load only*. Opening someone's link never rewrites your own settings.
3. **Unknown values are ignored.** A param naming something that doesn't exist (a retired category, a typo'd section) is dropped and the view opens normally. Links don't break; they just stop steering.

### The `lolly://` scheme

The installed apps register `lolly://` as their own URL scheme, so anything that can open a URL can open Lolly at an exact place: a launcher's "open URL" action (Raycast, Alfred, PowerToys Run), a macOS Shortcut, a `.desktop` Action, a GNOME Shell or KRunner result, a link in a note or a QR code on a slide, or a terminal:

```bash
open      "lolly://t/qr-code?url=https://suse.com"     # macOS
xdg-open  "lolly://t/qr-code?url=https://suse.com"     # Linux
start     "lolly://t/qr-code?url=https://suse.com"     # Windows
```

The grammar is the web address with the site name taken for granted: `lolly://<route>` is `https://lolly.tools/<route>`. Every tool form works (`lolly://t/<id>?…`, `lolly://tool/<id>?…`, a bare `lolly://<id>?…`, and the embed form `lolly://tool/<id>.svg?…`, whose extension becomes `format=`), with the same inputs, reserved parameters and packed `z=` links as the https form. Any app route works too (`lolly://lab`, `lolly://verify?asset=lolly/logo/primary`, `lolly://docs/build/authoring-tools`). A copied https link with `https://` swapped for `lolly://` keeps working - the `lolly.tools` host segment is dropped rather than read as a tool id.

The Share dialog can write this form for you: open **Link options** and turn on **Open in the installed app**. The field and its **Copy** and **QR** actions switch to `lolly://` while keeping the exact same state, password/packing token and behaviour flags. Turn it off and the field returns to the ordinary web link. That makes the web URL the safe default for a recipient who may not have Lolly, and the app URI an explicit choice for shortcuts and automation.

Read an app URI in three pieces; there is no second parameter vocabulary hiding behind the scheme:

| Piece | Example | Meaning |
|---|---|---|
| Scheme | `lolly://` | Ask the operating system to launch the installed Lolly app. |
| Route | `t/qr-code` | Open a tool (`t/<id>`), or another documented app route such as `lab`, `profile` or `verify`. |
| Query | `?url=https%3A%2F%2Fsuse.com&full` | The tool inputs and reserved controls from the tables on this page. Values use normal URL encoding; a presence flag such as `full` needs no `=1`. |

So `lolly://t/qr-code?url=https%3A%2F%2Fsuse.com&full` launches Lolly, opens QR Code with its `url` input filled, and uses the reserved `full` behaviour. `z=` and `zx=` are just compact or encrypted versions of the same query state; every readable flag that follows them still wins in the usual way.

A link that names no route the app owns is refused, not guessed at: the OS hands the app an untrusted string, so the mapper only ever opens a tool id that parses or a word from the app's frozen route vocabulary. Pasting a `lolly://` link anywhere the app already accepts a Lolly link (the asset picker, the pasted-link paths, the CLI's `Lolly <link>` form) works the same way.

Where it is registered: the macOS and Windows installers and the Linux `.desktop` entries all declare the scheme, as do the Android and iOS apps. A `tauri dev` build registers itself on Windows and Linux at launch; on macOS only the installed `.app` can receive the scheme. Spotlight itself opens web addresses, not custom schemes - on a Mac, reach the scheme through `open`, a Shortcut or a launcher. The MCP server's resource URIs (`lolly://catalog`, `lolly://tool/{id}`) share the prefix but are a different namespace: resources an agent reads, not routes the app opens.

### App-wide

| Param | Description |
|---|---|
| `lang` | UI language for this session, on any route (`#/c?lang=ja`, `/#/profile?lang=ar`). Same value set as the tool-route `lang` above; same "session only, saved preference untouched" rule. |
| `theme` | `light`, `dark` or `brand` - pins the app's look for this page load. Deliberately **not** saved to the profile or to `localStorage`: a link you paste must not permanently flip someone's theme. Mostly for screenshots and for "here's how it looks in dark" links. **App views only** - on a tool link (`/t/<id>`, `#/tool/<id>`, `/design`) it is left alone, because `theme` is a declared input in a dozen tools where it already means "draw the artwork dark". |

### Gallery (`#/`, and `#/u` for utilities)

| Param | Description |
|---|---|
| `q` | Seeds the search field. |
| `cat` | Category pill to open on - `all`, `favourites`, or a category key the pills actually show on that install (feature flags and the Utilities view already narrow that set). |
| `sort` | `recent`, `az`, `za`, `format` or `category`. Overrides the saved sort for this visit only. |
| `dir` | `asc` or `desc`. |
| `tool=<id>` | Opens that tool card's info dialog on top of the gallery. |
| `history` \| `history=<id>` | Opens a tool's saved-sessions dialog instead of the info one. |
| `welcome` | Presence flag - forces the first-run welcome dialog open even if it has been dismissed, so it can be captured deterministically. Ignored on branded and brand-locked installs: a link can't nag someone who already has a design system. |

### Catalogue (`#/c`)

| Param | Description |
|---|---|
| `asset=<id>` | Scrolls to and highlights that asset. |
| `section=<key>[,<key>…]` | Opens with those sections expanded (over the collapsed default) and scrolls the first into view. |
| `q` | Seeds the search field. |
| `type` | Filetype filter: `all`, `image`, `vector`, `motion`, `audio`, `text`. Falls back to `all` if that bucket is empty on this install. |
| `hidden` | Presence flag - opens with hidden assets revealed. |

### Projects (`#/p`, `#/p/<folderId>`)

| Param | Description |
|---|---|
| `q` | Enters the explicit results mode with that search. |
| `tools` | Narrows to sessions belonging to those tools. |
| `view` | `preview` (tile grid) or `list`. |
| `sort` | `modified`, `added`, `name`, `tool` or `size`. |
| `rev` | Presence flag - reverses whichever sort is active. |

`view`, `sort` and `rev` override both the device-wide and the per-folder saved preference for that visit, and neither is rewritten.

### Batch (`#/batch`)

`#/batch?s=<slot>,<slot>` opens those saved sessions as rows in the grid - what **Edit as sheet** builds. `#/pro` was the route's name before 2026-08-20 and still redirects here with its query intact, as does the `/pro` path form.

### Multi-edit (`#/multi`)

`#/multi?s=<slot>,<slot>` opens those sessions side by side.

### Design system studio (`#/start`)

| Param | Description |
|---|---|
| `area` | Which room: `overview`, `color`, `type`, `logos`, `tokens`, `catalogue`, or `versions`. |
| `focus` | A wing of the colour room: `generate`, `curves`, `contrast`, `print`, `chart`. |
| `seed=<hex>` | Primes the Generate wing's primary colour before it opens. |
| `wheel` | Presence flag - opens the OKLCH colour chart (the same target as `focus=chart`). |
| `import` | Presence flag - opens the source picker on arrival (`import=0` means shut). |
| `source` | Which source the picker opens on: `file`, `image`, `font`, `pdf`, `url`. Naming one implies the picker opens. It is a signpost, never an action - nothing is fetched or read on your behalf. |

Everything except `area` is one-shot: it acts on arrival and is dropped from the address bar as soon as you move between rooms. That is deliberate, so a link copied mid-session says which room you're in rather than re-firing a modal for the next person.

### Dashboard (`#/d`)

`#/d?tab=<tab>` opens a primary tab - `device`, `brand`, `caps`, `activity`. `#/d?<section-id>` scrolls to and opens one section directly (`#/d?dash-storage`, `#/d?cap-formats`); the section ids are the `DASH_SECTIONS` rows in `shells/web/src/views/dashboard-registry.ts`. `#/b` and `#/brand` are shortlinks to the Design system tab.

### Profile (`#/profile`)

`#/profile?focus=<section>` opens and scrolls to one settings card. The sections are `details-section`, `identity-section`, `appearance-section`, `a11y-section`, `connections-section`, `renders-section`, `storage-section`, `offline-section`, `activity-section`, `feature-flags-section` and `instance-section`.

### The remaining views

| Route | Params |
|---|---|
| `#/verify` | `src=<path>` checks a file **served by this site** (an absolute same-origin path - anything else is refused, because the page's promise is that it fetches nothing on your behalf). `check=1` alongside it also resolves the credential reference the page names, without the second "Fetch and check" click. |
| `#/docs/<slug>` | Renders in the app's current language; `#/docs/<lang>/<slug>` pins one, and `?lang=` does the same thing. `?h=<heading>` jumps to a heading. |
| `#/ask` | `?q=<question>` seeds the question box. |
| `#/lab` | `?c=<any CSS colour>` opens the Colour Lab on that colour. |

### On a tool route

For completeness, the app-state flags that live on a tool link rather than on a view. All but one are in the reserved-parameter table above: `options` (open on the export panel), `full` (fullscreen, no chrome), `template=<id>` (start from that template, skipping the chooser - a bare `?template=` opens the chooser itself, which is what the gallery's **+New** chip links to), `present` + `s=` + `kiosk` (presentation mode), `slot=` (resume a saved session). The exception is `share`, a presence flag read by the tool view rather than by the engine: it opens the Share dialog on load, so a click-only surface has an address.

A few more, on the canvas editors only, set EDITOR state rather than the document and are one-shot (read on load, dropped from the address on the first edit): `_sel=<id>,<id>` selects those boxes, `_t=<seconds>` opens the timeline with the playhead parked there, and `_panel=choreograph` opens the Choreograph picker over the selection. The object form `_ui=` carries the same state as one param - base64url JSON of `{ "v": 1, "sel": ["a", "b"], "t": 2.5, "panel": "choreograph" }` - for links built by other apps; every key is optional, unknown keys are ignored so the object can grow, and the three shorthands stay first-class and win on conflict. They all live in the `_` namespace, which the engine reserves outright (no tool input can ever be named that way), so they need no row in the table above. They exist so a link can open on a state - a documentation screenshot, a bug report, a "look at this frame" message - without a script of clicks. The same object drives a runtime channel while a canvas editor is mounted: `window.lolly.ui` exposes `getState()` (the object a link to the current view would carry) and `apply(state)`, and an embedding page can `postMessage({ type: 'lolly:ui', state })` to the same effect.
