# Inputs in URLs

Every input a tool declares can be set in a link, written by hand or from code. The key is the input's `id` from the tool's manifest; run `lolly <tool>` with no flags to list a tool's input ids.

## Setting tool inputs

The same values work on the command line as `--id=value`.

| Input | In a link |
|---|---|
| [String, text, longtext, url](#string-text-longtext-url) | The value, URL-encoded |
| [Select](#select) | The option value, not its label |
| [Number](#number) | The number |
| [Boolean](#boolean) | `1` or `true`, `0` or `false` |
| [Color](#color) | A hex value with its `#` encoded, or a token reference |
| [Asset](#asset) | A library id, or another tool's embed URL |
| [Blocks](#blocks) | A JSON array of objects, URL-encoded |
| [Vector](#vector) | One dotted param per field |
| [File](#file) | Never in a link; a file path on the CLI |
| [Table](#table) | One compact param, a `~` between rows |
| [Keyframe tracks](#keyframe-tracks) | A field inside a blocks input, written by the app |

### String, text, longtext, url

Pass the value. URL-encode spaces and special characters.

```
?text=Ship+it
?heading=Quarterly+results
?url=https%3A%2F%2Fexample.com
```

The Wordmark tool takes only text params, so one link sets the whole wordmark: `/t/wordmark?text=Ship it&weight=800&tracking=-12&size=200`.

![The word "Ship it" outlined in a heavy weight with the letters pulled tight, both settings carried in by the link alone](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DShip%2520it%26weight%3D800%26tracking%3D-12%26size%3D200&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&cropSelector=%23tool-canvas&filename=um-text-wordmark)

### Select

Pass the option value (not the label).

```
?theme=dark
?ecl=H
```

`?theme=dark` repaints the whole design.

### Number

```
?size=800
?padding=4
```

A number can also set a count. Colour Palette builds one ramp cell per step, so `/t/color-palette?steps=11` returns a wider sheet than the default seven.

![A palette sheet eleven cells wide, the count set only by the steps param](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fsteps%3D11&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-number-steps)

### Boolean

`1` or `true` for on, `0` or `false` for off.

```
?join=1
?showGrid=false
```

`/t/chart?chartType=line&showPoints=1` marks every data point on a line chart.

![A chart with a mark on every data point, switched on by a single boolean param](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FshowValues%3D1&width=1440&height=900&dpi=192&waitMs=2800&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-boolean-values)

### Color

Pass a hex value (URL-encode the `#`).

```
?color=%230c322c
?background=%23ffffff
```

A colour can also be a design token reference, such as `?color={color.semantic.primary}`. The colour then follows that token's value on the device that opens the link. [Design Tokens](/info/design-tokens.html#the-value-model-reference-cached-value) shows the round trip.

Mesh Gradient takes one colour param per stop, so three hex values in a link are three fields of colour in the render.

![A generative gradient blooming in coral, amber and violet, one bloom per colour param](/t/url-shot?url=%2F%23%2Ftool%2Fgradient%3Fcount%3D3%26blend%3Dnormal%26color1%3D%2523ff5f6d%26color2%3D%2523ffc371%26color3%3D%25236a11cb&width=880&height=560&dpi=96&waitMs=2400&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-color-mesh&try=1)

### Asset

Pass the asset's library ID. The runtime resolves the ID to the full asset object at render time.

```
?logo=lolly/logo/primary
?image=lolly/demo/lorikeet-lollipop
```

To find an asset's id, select the asset in the tool's asset picker and read the value shown. An audio id works the same way: Audiogram decodes the track the link gives and draws its waveform.

A `#lolly-version=` suffix on an asset value pins one retained version. The link keeps drawing that version after the library changes.

::: details Pinning an asset version (engine 1.185 and later)
`AssetRef.pin` requests an exact retained version and an optional format. The `version` property records the last resolution and does not pin an asset by itself. For typed state, use `{ id: "library/photo", source: "library", pin: { version: "v1", format: "png" } }`. The engine's `encodeAssetVersion(id, pin)` writes the reserved `#lolly-version=` suffix inside the asset value. Let `serializeUrlState` do the outer query encoding.

Pins work in top-level and block asset fields. A missing version stays a reference with an empty image URL and a resolution warning. It does not draw current bytes or delete the reference. Uploaded asset ids stay device-local even when pinned. Editable `.lolly` files and explicit transfers can carry the retained bytes they point at.
:::

![An audiogram card whose waveform is drawn from the generated song in the link, with the title and the wide 16:9 size set alongside it](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dzzfxm%253A11%253Alofi%26title%3DLate%2520Study%26subtitle%3DGenerated%2520from%2520a%2520seed%26style%3Dwave%26size%3Dwide&width=1440&height=900&dpi=192&waitMs=4200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&cropSelector=%23tool-canvas&dark=1&filename=um-asset-audiogram)

**An asset value can also be another tool's render.** When a user pastes a Lolly tool link (a share link or an embed URL) into the asset picker, the value's id is the **canonical embed URL** of that render. The value round-trips through the URL like a library id:

```
?image=https%3A%2F%2Flolly.tools%2Ftool%2Fqr-code.svg%3Furl%3Dhttps%3A%2F%2Fexample.com%26w%3D600%26h%3D600
```

On load the runtime re-renders the value through `host.compose.renderUrl` instead of looking it up in the catalog. This puts one tool's output, such as a QR code or a filtered hero graphic, into another tool's image slot through a shareable link. See [Tool composition](/info/url-mode.html#tool-composition-portable-embed-url) and the authoring guide.

::: note Uploaded images stay on your device
Images you add from your device (`AssetRef.source: "user"`, ids like `user/upload/…`) live only in that device's storage, so a link leaves them out. The recipient picks their own image, or you send a `.lolly` file that carries yours ([What a link carries](/info/url-app-links.html#what-a-link-carries)).
:::

### Blocks

A blocks input is a repeating group of fields, such as team members with a name and a city each. Pass the value as a URL-encoded JSON array of objects.

```
?people=[{"name":"Mei","city":"Nuremberg"},{"name":"Lisa","city":"Sydney"}]
```

Each object's keys must match the field `id`s in the tool's manifest. Fields can be omitted - missing fields are treated as empty strings. A field can be left out; a missing field reads as an empty string. Wayfinding's `directions` input is a blocks list with a label, an arrow, a side and a colour per row, so one link has a whole sign:

![A wayfinding sign whose three destinations, their arrows and their colours all arrived as one JSON blocks param](/t/url-shot?url=%2F%23%2Ftool%2Fwayfinding-signage%3Fheading%3DThis%2520way%26directions%3D%255B%257B%2522label%2522%253A%2522Registration%2522%252C%2522arrow%2522%253A%2522left%2522%252C%2522side%2522%253A%2522left%2522%252C%2522color%2522%253A%2522%2523008657%2522%257D%252C%257B%2522label%2522%253A%2522Keynote%2520hall%2522%252C%2522arrow%2522%253A%2522up%2522%252C%2522side%2522%253A%2522left%2522%252C%2522color%2522%253A%2522%25231a85c4%2522%257D%252C%257B%2522label%2522%253A%2522Workshops%2522%252C%2522arrow%2522%253A%2522right%2522%252C%2522side%2522%253A%2522right%2522%252C%2522color%2522%253A%2522%2523c55123%2522%257D%255D&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-blocks-wayfinding)

**CLI:**
```bash
lolly meeting-planner --people='[{"name":"Mei","city":"Nuremberg"},{"name":"Lisa","city":"Sydney"}]'
```

::: note A blocks value has no size cap
A large value packs into the `z` link. When a link is too long to pass around, the Share dialog offers a `.lolly` file instead.
:::

### Vector

A `vector` input is a fixed group of numbers edited as one control, such as a zoom and an x/y offset. It has **no** single-param form. Pass each field as a flat dotted param `<inputId>.<fieldId>`:

```
?imageFraming.zoom=200&imageFraming.x=30&imageFraming.y=70
```

Tools such as `frame`, `darkroom`, `filter`, `3d` and `gradient` use vector inputs. Mesh Gradient places each colour stop with one, so adding `?pos1.x=8&pos1.y=8&pos2.x=92&pos2.y=12&pos3.x=50&pos3.y=94` to the gradient above moves its three blooms out to the edges:

![The coral, amber and violet gradient again, this time with each bloom pinned to an edge by its own dotted x and y param](/t/url-shot?url=%2F%23%2Ftool%2Fgradient%3Fcount%3D3%26blend%3Dnormal%26color1%3D%2523ff5f6d%26color2%3D%2523ffc371%26color3%3D%25236a11cb%26pos1.x%3D8%26pos1.y%3D8%26pos2.x%3D92%26pos2.y%3D12%26pos3.x%3D50%26pos3.y%3D94&width=880&height=560&dpi=96&waitMs=2400&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-vector-positions)

### File

A `file` input (the user's own file, processed in memory) is **never** put in a URL. Its bytes live only on the device. On the CLI a file param is a filesystem path, loaded into memory before rendering:

```bash
lolly strip-data --source=./photo.jpg --output=clean.jpg
```

In the web shell, a link that references a `file` input resolves as blank, and the recipient picks their own file.

### Table

A `table` input (a user-defined grid of column headings and rows, such as `agenda`) is always **one compact param**. The header row comes first, then one `~`-separated segment per data row. Cells are `,`-separated and percent-escaped, so commas inside a cell survive:

```
?t=Pain,Summary,Strategy~Assurance,Is%20it%20open%3F,Table%20stakes%2C%20compete%20with%20why
```

A JSON form (`{"columns":[…],"rows":[…]}`) also parses. Long tables use the packed `z` link like any other big state. Long tables travel in the packed `z` link. On the CLI the same value works inline, or `--<inputId>-data=table.csv` fills the input from a CSV / TSV / Markdown-table file (first row = headings):

```bash
lolly agenda --sessions-data=./sessions.csv --output=agenda.pdf
```

### Keyframe tracks

`kf` is not an input type. It is a **sub-field of a `blocks` input**, one per box in Lolly Design, and uses the block's own encoding under [Compact encoding](#compact-encoding-opt-in). The app writes the field. Hooks always parse and rewrite the field and never pass the raw field through, so an unparseable or hostile value makes no track.

```
t0_z0_b4*t1500_eo_z140_b0*t4000_eh_z140_x-60
```

::: details Keyframe track grammar
A box's `kf` field packs an animation track (position, size, scale, rotation, opacity, blur, depth) into one string of the characters `A-Za-z0-9._*()-` only. `*` separates keyframes; `_` separates the tokens inside a keyframe. The first token is always `t<ms>` (the keyframe's local box time, unscaled). The remaining tokens are channel values and an optional ease token:

- **Channels:** `x12.5`, `y-40`, `s1.2`, `r15`, `z140`, `o0.8`, `b2.5`, the size pair `w1280` / `h720`, the tilt pair `rx-8` / `ry20`, plus camera-only `f`/`a`/`p`. Tilt is a **camera** channel: `rx` pitches the camera and `ry` yaws the camera, in degrees, about the point the camera looks at. The centre of the frame stays put and the artwork turns about that centre. **Negative `rx` pitches the camera down over the surface**: the near edge of a layer is at the bottom of the frame and the far edge goes toward a horizon at the top. Any non-zero angle makes the projection perspective. A motion export of a tilted scene is captured off the live page frame by frame. A tilted scene that also holds a **video clip** refuses to export as motion and shows a notice.
- **Absolute vs relative.** `x`/`y`/`s`/`r`/`o`/`b` are **offsets and multipliers** over the box's own values, so a track composes with the authored pose and with any enter/exit transition. `z`, `w` and `h` are **absolute** and **replace** the box's own field for the segment they are keyed on. Use size when the content must reflow. A keyed `w` lays out the box again: text rewraps and a border stays one pixel wide. `s` scales the finished picture.
- **Path handles:** `hi(-80)(-60)` and `ho(80)(-60)` bend the travel into and out of a keyframe's position, in px from that position, before any camera. Handles follow the channel tokens and are only on a keyframe that sets both `x` and `y`. A handle of `(0)(0)` is the same as none. Between two keyframes with a handle, the box travels along that curve at the speed the segment's ease gives along the curve's length.
- **Ease:** one of the eight presets `el`/`ei`/`eo`/`eio`/`ev`/`ea`/`es`/`ek`, the hold `eh` or a paren-delimited bezier `eb(0.32)(0)(0.67)(1)`. **Absent means `eio`** (ease-in-out), so an uneased segment is smoothed, never linear.
- **Longest name wins.** A token is read as the **longest channel name whose remainder parses as a number**: `rx-8` is channel `rx` at -8, never channel `r` followed by junk. A token that matches no channel or ease form is skipped, so a hand-edited link does not fail the render.
:::

---

## Compact encoding (opt-in)

Tools can opt into a shorter form. The web app writes this form when you **copy a share link**; the live address bar keeps the readable long form. Both forms parse, so either kind of link works. Both forms parse.

::: cols
## Long form

```
?chartType=radar&palette=cool&heading=Short+keys&showLegend=0
```

## Compact form

```
?ct=radar&pl=cool&t=Short+keys&lg=0
```
:::

- **`urlKey` aliases.** An input or block field can declare a short key, such as `textColor` → `tc`, so `?tc=ff0000` sets that input.
- **Colours without `#`.** A 6-character hex is stored bare (`?color=0c322c`) and gets its `#` back on parse.
- **Tilde-delimited block arrays.** Instead of JSON, blocks are written as `field,field,field~field,field,field`: one `~`-separated group per item, values URL-encoded, colours without `#`.
- **Omitted defaults.** A value equal to the input's default is left out of the link.

Lolly Chart uses short keys, so a link copied from its Share button takes the compact form. `?ct=radar&pl=cool&t=Short keys&lg=0` sets the chart type, palette, heading and legend:

![A radar chart in the cool palette, drawn from four short-key params instead of their long names](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dradar%26pl%3Dcool%26t%3DShort%2520keys%26lg%3D0&width=1440&height=900&dpi=192&waitMs=2800&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-compact-shortkeys)

