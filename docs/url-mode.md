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

---

## Reserved parameters

These keys are never treated as tool inputs. They control shell-level behaviour.

| Param | Where | Description |
|---|---|---|
| `format` | web + CLI | Output format (`png`, `svg`, `pdf`, …). Used by `export` and `copy`. |
| `export` | web + CLI | Presence flag — trigger an immediate download on page load. |
| `copy` | web only | Presence flag — arm copy-to-clipboard on first interaction. |
| `full` | web only | Presence flag — open in fullscreen (sidebar collapsed). |
| `filename` | web only | Name for the downloaded file (no extension). Defaults to the tool ID. |
| `slot` | web + CLI | Name of a saved state slot to pre-load. URL params override saved values. |
| `output` | CLI only | File path to write the exported file. Defaults to stdout. |
| `_v` | web + CLI | Tool version pin (e.g. `1.0.0`). Ignored if not matched — forward-compat safety. |
| `width` / `w` | web + CLI | Output width, as a value in `unit`. Also pre-fills the export dimensions panel. |
| `height` / `h` | web + CLI | Output height, as a value in `unit`. Also pre-fills the export dimensions panel. |
| `unit` | web + CLI | Physical unit for `width`/`height`: `px` (default), `mm`, `cm`, `in`, `pt`, `pc`. |
| `dpi` | web + CLI | Raster resolution for physical units (default `300`). Ignored for `px` and for vector formats. |

`export`, `copy`, and `full` are **presence flags** — the parameter value is ignored; what matters is whether the key appears in the URL.

### Physical units (`unit=` + `dpi=`)

`width`/`height` are plain numbers; `unit` says what they mean. With a physical unit the output is rendered at the correct **physical** size for the format, not just a pixel count:

- **PDF** → a true page of that size (points, resolution-free). `?w=210&h=297&unit=mm&format=pdf` is a real A4.
- **SVG** → `width`/`height` carry the unit (e.g. `210mm`) with a px `viewBox`, so it scales cleanly.
- **PNG / JPG / WebP** → pixels at `dpi` (e.g. 210mm @ 300dpi = 2480px). PNG also embeds the DPI (a `pHYs` chunk) so print/layout software places it at the intended size.

`px` is the default and behaves exactly as before (the CSS 96-DPI convention).

```
brand-tool poster --title=Hello --width=210 --height=297 --unit=mm --export=svg --output=a4.svg
```

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
| `html` | Static HTML document |
| `gif` | Animated GIF (animated tools only) |
| `webm` | WebM video (animated tools only; Chrome/Firefox/Android) |
| `mp4` | MP4 video (animated tools only; Safari/iOS and recent Chrome) |

Not all tools support all formats — only the formats listed in the tool's manifest `render.formats` are valid. Requesting an unsupported format falls back gracefully.

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
