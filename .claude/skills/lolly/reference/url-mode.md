# URL mode

Every tool input and every export control is a URL query parameter. The same
contract drives four transports: a share link, the public render route, the MCP
`query`/`inputs`, and the CLI's `--flag=value` pairs. Learn this table once and
you have learned all four. Source of truth: `docs/url-mode.md` and the `RESERVED`
set in `engine/src/url-mode.ts`.

## The shape of a link

```
https://lolly.tools/#/tool/<id>?<param>=<value>&<param>=<value>
```

- `https://lolly.tools/tool/<id>?…` (no hash) is the canonical path the address
  bar shows once a tool has loaded. `https://lolly.tools/#/tool/<id>?…` is the
  older hash form. Both route, so they are interchangeable.
- `https://lolly.tools/tool/<id>.<ext>?…` (with a format extension) is the render
  and embed route: it returns the finished asset, not the app. See `surfaces.md`.

Inputs are set by their `id` or by their short `urlKey` alias. Reserved names
below are never inputs. Any key that is neither a known input/alias nor reserved
is silently ignored, so a typo in an input name renders defaults with no error:
name inputs exactly as the manifest declares them.

## Reserved parameters

These names are controls, never tool inputs. The live set is `RESERVED` in
`engine/src/url-mode.ts`.

| Param | Controls |
|---|---|
| `format` | Output format (`png`, `svg`, `pdf`, …). Must be one the tool declares. |
| `export` | Presence flag: download on load. |
| `copy` | Presence flag: arm copy-to-clipboard on first interaction (web only). |
| `full` | Presence flag: open fullscreen, sidebar collapsed. |
| `options` | Presence flag: open with the export panel expanded. `full` wins over it. |
| `filename` | Name for the downloaded file (no extension). Defaults to the tool id. |
| `output` | CLI only: file path to write to (`-` is stdout). |
| `_v` | Tool version pin. Any key starting with `_` is skipped before input matching. |
| `width` / `w` | Output width, as a value in `unit`. |
| `height` / `h` | Output height, as a value in `unit`. |
| `unit` | Physical unit for `width`/`height`: `px` (default), `mm`, `cm`, `in`, `pt`, `pc`. |
| `dpi` | Raster resolution for physical units (default `300`). Ignored for `px` and vectors. |
| `profile` | Raster ICC profile (`srgb`/`none`), or the CMYK press condition for the print formats (`fogra51`, `own`). |
| `password` | Open password for `pdf`/`zip` (standard tier). Travels in clear text. Ignored when `bleed`/`marks` are on. |
| `bleed` | Bleed for the print formats, as a dimension (`3mm`, `0.125in`). |
| `marks` | Print marks for the print formats: a CSV of `crop`, `reg`, `bleed`, `bars`, `prov` (`prov` is PDF only). |
| `c2pa` | Content Credentials. On by default. `c2pa=off` per export; `c2pa=7\|30\|90\|365` sets the certificate lifetime. |
| `imprint` | Lolly pixel watermark for raster. On by default; `imprint=0` turns it off. |
| `durable` | Durable neural watermark for raster. Off by default; `durable=1` turns it on. |
| `meta` | Generator-metadata toggle. On by default; `meta=off` strips the source field. |
| `hdr` | HDR raster (Rec.2100 PQ). Off by default; `hdr=1`, or tuned `hdr=<peakNits>-<reach>-<lift>-<focus>`. |
| `depth` | Requested bit depth: `8`, `16`, `float`, `auto` (default). A request, not a promise. |
| `cuts` | Contact sheet of a timed composition. Integer, default `1`. Clamped `1`-`64`. |
| `lang` | UI/content language: `en` (default), `es`, `de`, `fr`, `zh`, `ar`, … |
| `designv` | Design-system version to render against: a published slug, or `latest`. Never written into a share link. |
| `ds` | Design system to render against: a system id held on the device. Never written into a share link. |
| `slot` | Name of a saved-state slot to pre-load. URL params override the saved values. |
| `template` / `preset` | Seed a fresh session from a manifest `templates[]` entry (and a preset inside it). |
| `present` | Presence flag: open a frame document as a fullscreen, click-advanced deck. |
| `s` | State address of a deck: `s=2` (1-based order), a frame id, or `s=2.3` (build step). Also a still-export filter. |
| `kiosk` | Presence flag: the presenter wraps and a timed document loops (signage). |
| `nostage` | Presence flag: for `html` export, drop the fixed-size canvas frame. |
| `fps` / `seconds` / `wait` / `codec` / `vq` | Motion controls for `mp4`/`webm`/`gif`/`apng`/`webp-anim`. |
| `z` / `zx` | A packed (`z`) or password-encrypted (`zx`) whole-state token. See below. |

Presence flags (`export`, `copy`, `full`, `options`, `nostage`, `present`,
`kiosk`) ignore their value: what matters is that the key appears.

## Compact encoding

A link stays short because of four rules (`docs/url-mode.md`):

- **`urlKey` aliases.** An input or block field can declare a short key, so chart's
  `chartType` is `ct`, its CSV `data` is `d`, its palette is `pl`.
- **Colours without `#`.** A 6-char hex is stored bare (`color=0c322c`) and
  restored to `#0c322c` on parse. In long form the `#` is percent-encoded as `%23`.
- **Tilde-delimited block arrays.** A `blocks` input serialises as
  `field,field,field~field,field,field`: one `~`-separated group per item, values
  URL-encoded, colours `#`-less. (Over about 8 KB a blocks value is not written to
  the URL; use a `slot` or a packed `z` link instead.)
- **Omitted defaults.** A value equal to the input's default is dropped entirely.

So `?ct=radar&pl=cool&t=Short+keys&lg=0` is chart type, palette, heading and
legend in a dozen characters of query.

## Packed links (`z` and `zx`)

When a readable query grows past about 1800 characters the address bar switches to
a packed token automatically, and only when it is actually shorter.

- `z=<tag><payload>`. Tag `1` is raw DEFLATE (RFC 1951) carried as base64url, the
  default and shortest form (`z=1eJyF…`). Tag `2` is the same bytes as unpadded
  upper-case base32, every character inside a QR code's alphanumeric set. Both
  decode everywhere, forever; the tag versions the codec. The engine's
  `expandQuery()` turns a `z` link back into a plain query before parsing, so
  on-visit flags (`export`, `full`, `_v`) can ride alongside `z` in readable form.
- `zx=<tag><payload>` is the same DEFLATE bytes AES-256-GCM encrypted under a
  PBKDF2-derived key. The password is never in the link, and `expandQuery` never
  touches `zx`, so an encrypted link renders at defaults on the headless embed
  path (it is interactive only).

The reserved `z`/`zx` above are top-level only. A design box's own `z` depth field
and a keyframe track's `z` channel live inside the `boxes` block's per-box
sub-fields, a separate namespace decoded positionally.

## Multi-artboard documents

On a Design document with more than one artboard, the artboards are the size
truth and `width`/`height` describe the active board (the selected one for stills,
the one under the playhead for animation). Address a specific board with `s`:

- `?s=2` is the 1-based position in presentation order; `s=<frameId>` or a ULID
  names a board by id; `s=2.3` names a build step within board 2.
- `?present&s=2` deep-links that slide in the presenter; `?present&kiosk` loops.
- `?s=2&format=png` is a still-export filter: it renders just that one board.

At export each format resolves boards its own way: stills fan out to one file per
board at that board's own size (zipped when there is more than one, and `?s=`
narrows to one); `pdf` and `pptx` carry every board as a page at native size; the
animated formats composite every scene into one `width`x`height` frame,
letterboxing a board whose aspect differs.

## Embed grammar

A tool render can be embedded inside another tool's asset slot:

```html
<img src="https://lolly.tools/tool/qr-code.svg?url=https://suse.com&color=0c322c">
```

Nothing is ever fetched from `lolly.tools`: a shell recognises this exact shape
and renders the named tool locally, substituting the result. Anything that is not
exactly this grammar is treated as an ordinary image, and that strict match is the
security boundary. The extension is a fidelity choice: an `svg` child stays a true
vector when the parent exports to SVG or PDF; `png`/`jpg`/`webp` children embed as
images (`pdf` is in the grammar but not inlined as a child). The `lolly://tool/<id>.svg?…`
form maps to the same thing, its extension becoming `format=`.

When a tool link is pasted into an asset picker, the chosen value's id is that
canonical embed URL, re-rendered on load through `host.compose.renderUrl`.

## Physical units and print prep

`width`/`height` are plain numbers; `unit` says what they mean. Conversion happens
per format at export: PDF gets a true page of that size in points; SVG carries the
unit with a px `viewBox`; raster is pixels at `dpi` (210mm at 300dpi is 2480px, and
PNG embeds the DPI as a `pHYs` chunk). `px` is the default, at the CSS 96-DPI
convention.

For print, `bleed=` and `marks=` add prep to `pdf`, `pdf-cmyk` and `cmyk-tiff` and
are ignored elsewhere: the artwork scales to fill the bleed, the PDF declares its
`TrimBox`/`BleedBox`, and `marks` draws crop/registration/bleed marks and colour
bars in the margin. `profile=fogra51` sets the CMYK press condition; `profile=own`
embeds a loaded CMYK profile for PDF/X-4. Marks/bleed and a PDF `password` are
mutually exclusive.

## Ten worked links

Every line here parses through `parseUrlState` with no unknown input.
`tests/agent-skill.test.ts` checks each one against its tool's manifest.

```text
https://lolly.tools/#/tool/qr-code?url=https://suse.com&color=%230c322c&format=svg&export
https://lolly.tools/tool/qr-code.png?url=https://suse.com&color=0c322c&background=faf7f2
https://lolly.tools/#/tool/qr-code?payload=wifi&ssid=Studio+Guest&wifiKey=welcome-2026&wifiSecurity=WPA&format=svg&export
https://lolly.tools/#/tool/chart?ct=line&d=Quarter%2CCoffee%2CTea%0AQ1%2C42%2C28%0AQ2%2C49%2C35%0AQ3%2C55%2C40&t=Beverage+sales&st=FY26&pl=cool&sv=1&lg=1&lp=tr&w=1200&h=800&format=png&export
https://lolly.tools/tool/gradient.svg?mode=blend&color1=0c322c&color2=30ba78&count=2
https://lolly.tools/#/tool/wordmark?text=Ship+it&weight=800&tracking=-12&size=200&color=%230c322c&format=svg&export
https://lolly.tools/#/tool/gradient?mode=mesh&color1=%230c322c&color2=%2330ba78&count=2&w=1600&h=900&format=png&export
https://lolly.tools/#/tool/qr-code?url=https://suse.com&format=pdf-cmyk&bleed=3mm&marks=crop,reg,bleed,bars&profile=fogra51&export
https://lolly.tools/#/tool/wordmark?text=Print+me&width=210&height=297&unit=mm&format=pdf&export
https://lolly.tools/#/tool/design?z=1eJyrVkrLz1eyUlBKSSxJVLIqLkksSVWyqgUAKQ0GmA&export
```

Reading them, in order: an on-brand QR as SVG; the same QR as a PNG straight off
the browser-free render route; a Wi-Fi QR from a `payload` variant; a line chart
built from a CSV pasted into `d` (chart is HTML-layout, so this app link exports
its PNG through the browser tier); a two-stop gradient straight off the render
route; a wordmark; a mesh gradient; a CMYK print PDF with crop marks and a FOGRA
press profile; an A4 wordmark sized in millimetres; and a packed Design link whose
whole document rides in `z`. Only vector-native tools (`qr-code`, `gradient`, …)
serve off the render route; an HTML-layout tool like `chart` needs the app or the
CLI (see `surfaces.md`).
