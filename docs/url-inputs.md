# Inputs in URLs

Write a link by hand, or generate one from code, and every input a tool declares can be set in the link. The key is the input's `id` from the tool's manifest, and the value is written the way this page shows for each kind of input. Run `lolly <tool>` with no flags to list a tool's input ids.

## Setting tool inputs

Each section below is one kind of input, with an example link and the render it makes. The same values work on the command line as `--id=value`.

### String, text, longtext, url

Pass the value directly. URL-encode spaces and special characters.

```
?text=Ship+it
?heading=Quarterly+results
?url=https%3A%2F%2Fexample.com
```

The Wordmark tool is nothing but text params, so a link is the whole brief: `/t/wordmark?text=Ship it&weight=800&tracking=-12&size=200`.

![The word "Ship it" outlined in a heavy weight with the letters pulled tight, both settings carried in by the link alone](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DShip%2520it%26weight%3D800%26tracking%3D-12%26size%3D200&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&cropSelector=%23tool-canvas&filename=um-text-wordmark)

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

A number can also set how much of a thing gets made. Colour Palette builds one ramp cell per step, so `/t/color-palette?steps=11` returns a wider sheet than the default seven.

![A palette sheet eleven cells wide, the count set only by the steps param](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fsteps%3D11&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-number-steps)

### Boolean

`1` or `true` for on, `0` or `false` for off.

```
?join=1
?showGrid=false
```

One flag can add a whole layer of information: `/t/chart?chartType=line&showPoints=1` marks every data point on a line chart.

![A chart with a mark on every data point, switched on by a single boolean param](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3FshowValues%3D1&width=1440&height=900&dpi=192&waitMs=2800&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-boolean-values)

### Color

Pass a hex value (URL-encode the `#`).

```
?color=%230c322c
?background=%23ffffff
```

A colour can also be a design token reference, such as `?color={color.semantic.primary}`, which redraws in whatever that token means on the device that opens the link. [Design Tokens](/info/design-tokens.html#the-value-model-reference-cached-value) shows the round trip.

Colour params stack. Mesh Gradient takes one per stop, so three hex values in a link are three fields of colour in the render.

![A generative gradient blooming in coral, amber and violet, one bloom per colour param](/t/url-shot?url=%2F%23%2Ftool%2Fgradient%3Fcount%3D3%26blend%3Dnormal%26color1%3D%2523ff5f6d%26color2%3D%2523ffc371%26color3%3D%25236a11cb&width=880&height=560&dpi=96&waitMs=2400&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-color-mesh&try=1)

### Asset

Pass the asset's library ID - the runtime resolves it to the full asset object at render time.

```
?logo=lolly/logo/primary
?image=lolly/demo/lorikeet-lollipop
```

To find an asset's id, open the asset picker in the tool and look at the value shown when an asset is selected. An audio id works the same way as an image: Audiogram decodes whichever track the link gives and draws its real waveform.

An asset value can pin one retained version with a `#lolly-version=` suffix, so the link keeps drawing that version after the library moves on.

::: details Pinning an asset version (engine 1.185 and later)
An explicit `AssetRef.pin` requests an exact retained version and an optional format. The existing `version` property is metadata about the last resolution; it does not pin an asset by itself. For typed state, use `{ id: "library/photo", source: "library", pin: { version: "v1", format: "png" } }`. The engine's `encodeAssetVersion(id, pin)` writes the reserved `#lolly-version=` suffix inside the asset value; let `serializeUrlState` do the outer query encoding.

Pins work in top-level and block asset fields. A missing version stays a reference with an empty image URL and a resolution warning, rather than drawing current bytes or deleting the reference. Uploaded asset ids stay device-local even when pinned; editable `.lolly` files and explicit transfers can carry the retained bytes they point at.
:::

![An audiogram card whose waveform is the actual shape of the catalogue track named in the link, with the title and the wide 16:9 size set alongside it](/t/url-shot?url=%2F%23%2Ftool%2Faudiogram%3Faudio%3Dlolly%2Floops%2Frain-on-the-boulevard%26title%3DRain%2520on%2520the%2520Boulevard%26subtitle%3DStraight%2520from%2520the%2520catalogue%26style%3Dwave%26size%3Dwide&width=1440&height=900&dpi=192&waitMs=4200&css=%23ag-wave%7Bdisplay%3Anone!important%7D.ag-ph%7Bdisplay%3Ablock!important%7D&walker=1&format=svg&rasterDpi=110&cropSelector=%23tool-canvas&dark=1&filename=um-asset-audiogram)

**An asset value can also be another tool's render.** When a user pastes a Lolly tool link into the asset picker (a share link or an embed URL), the chosen value's "id" is the **canonical embed URL** of that render, so it round-trips through the URL exactly like a library id - just longer:

```
?image=https%3A%2F%2Flolly.tools%2Ftool%2Fqr-code.svg%3Furl%3Dhttps%3A%2F%2Fexample.com%26w%3D600%26h%3D600
```

On load the runtime re-renders it via `host.compose.renderUrl` instead of looking it up in the catalog. This is how one tool's output (a QR code, a filtered hero graphic) flows into another tool's image slot through a plain shareable link. See [Tool composition](/info/url-mode.html#tool-composition-portable-embed-url) and the authoring guide.

::: note Uploaded images stay on your device
Images you add from your own device (`AssetRef.source: "user"`, ids like `user/upload/…`) live only in that device's storage, so a link leaves them out: on another device the id would point at nothing. The recipient picks their own image, or you send a `.lolly` file that carries yours ([What a link carries](/info/url-app-links.html#what-a-link-carries)).
:::

### Blocks

Blocks inputs are repeating groups of fields (e.g. a list of team members, each with a name and city). Pass the value as a JSON array of objects, URL-encoded.

```
?people=[{"name":"Mei","city":"Nuremberg"},{"name":"Lisa","city":"Sydney"}]
```

Each object's keys must match the field `id`s defined in the tool's manifest. Fields can be omitted - missing fields are treated as empty strings. Wayfinding's `directions` input is a blocks list of a label, an arrow, a side and a colour per row, so a whole sign travels in the link:

![A wayfinding sign whose three destinations, their arrows and their colours all arrived as one JSON blocks param](/t/url-shot?url=%2F%23%2Ftool%2Fwayfinding-signage%3Fheading%3DThis%2520way%26directions%3D%255B%257B%2522label%2522%253A%2522Registration%2522%252C%2522arrow%2522%253A%2522left%2522%252C%2522side%2522%253A%2522left%2522%252C%2522color%2522%253A%2522%2523008657%2522%257D%252C%257B%2522label%2522%253A%2522Keynote%2520hall%2522%252C%2522arrow%2522%253A%2522up%2522%252C%2522side%2522%253A%2522left%2522%252C%2522color%2522%253A%2522%25231a85c4%2522%257D%252C%257B%2522label%2522%253A%2522Workshops%2522%252C%2522arrow%2522%253A%2522right%2522%252C%2522side%2522%253A%2522right%2522%252C%2522color%2522%253A%2522%2523c55123%2522%257D%255D&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-blocks-wayfinding)

**CLI:**
```bash
lolly meeting-planner --people='[{"name":"Mei","city":"Nuremberg"},{"name":"Lisa","city":"Sydney"}]'
```

> A blocks value has no size cap. A large one packs into the `z` link, and when a link grows too long to pass around, the Share dialog offers a `.lolly` file instead.

### Vector

A `vector` input is a fixed group of numbers edited as one control (e.g. a zoom + x/y offset). It has **no** single-param form - pass each field as a flat dotted param `<inputId>.<fieldId>`:

```
?imageFraming.zoom=200&imageFraming.x=30&imageFraming.y=70
```

One readable value per param. Used by tools such as `frame`, `darkroom`, `filter`, `3d` and `gradient`. Mesh Gradient parks each colour stop with one, so adding `?pos1.x=8&pos1.y=8&pos2.x=92&pos2.y=12&pos3.x=50&pos3.y=94` to the gradient above drives its three blooms out to the edges:

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

`kf` is not an input type. It is a **sub-field of a `blocks` input**, one per box in Design, and like every other sub-field it rides the block's own encoding described under [Compact encoding](#compact-encoding-opt-in) below. The app writes it; nobody types one in practice, and hooks always parse and rewrite it rather than passing the raw field through, so an unparseable or hostile value simply makes no track.

```
t0_z0_b4*t1500_eo_z140_b0*t4000_eh_z140_x-60
```

::: details Keyframe track grammar
A box's `kf` field packs a whole animation track (position, size, scale, rotation, opacity, blur, depth) into one compact string, charset `A-Za-z0-9._*()-` only. Keyframes are separated by `*`; inside a keyframe, tokens are separated by `_`. The first token is always `t<ms>` (the keyframe's local box time, unscaled). The remaining tokens are channel values and an optional ease token:

- **Channels:** `x12.5`, `y-40`, `s1.2`, `r15`, `z140`, `o0.8`, `b2.5`, the size pair `w1280` / `h720`, the tilt pair `rx-8` / `ry20`, plus camera-only `f`/`a`/`p`. Tilt is a **camera** channel: `rx` pitches the camera and `ry` yaws it, in degrees, about the point it is already looking at - so the centre of the frame stays put and the artwork turns about that centre. **Negative `rx` pitches the camera down over the surface**, which puts the near edge of a layer at the bottom of the frame and sends the far edge toward a horizon at the top. Any non-zero angle makes the projection a perspective one rather than a flat scale, and a motion export of a tilted scene is captured off the live page frame by frame; a tilted scene that also holds a **video clip** refuses to export as motion, with a notice saying so.
- **Absolute vs relative.** `x`/`y`/`s`/`r`/`o`/`b` are **offsets and multipliers** over what the box already had, so a track composes with the authored pose and with any enter/exit transition. `z`, `w` and `h` are **absolute** and **replace** the box's own field for the segment they are keyed on. Size is the channel to reach for when the content must reflow - a keyed `w` re-lays-out the box, so text rewraps and a border stays one pixel wide, where `s` scales the finished picture instead.
- **Ease:** one of the eight presets `el`/`ei`/`eo`/`eio`/`ev`/`ea`/`es`/`ek`, the hold `eh` or a paren-delimited bezier `eb(0.32)(0)(0.67)(1)`. **Absent means `eio`** (ease-in-out), so an uneased segment is smoothed, never linear.
- **Longest name wins.** A token is read as the **longest channel name whose remainder parses as a number**: `rx-8` is channel `rx` at -8, never channel `r` followed by junk. A token that matches no channel or ease form that way is skipped rather than rejected, so a hand-edited link degrades gracefully instead of failing the render.
:::

---

## Compact encoding (opt-in)

Tools can opt into a shorter form, which the web app writes when you **copy a share link**; the live address bar keeps the readable long form. Both forms parse, so either kind of link works.

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

Chart uses short keys, so a link copied from its Share button looks like the compact form rather than the long examples on this page. `?ct=radar&pl=cool&t=Short keys&lg=0` sets the chart type, palette, heading and legend:

![A radar chart in the cool palette, drawn from four short-key params instead of their long names](/t/url-shot?url=%2F%23%2Ftool%2Fchart%3Fct%3Dradar%26pl%3Dcool%26t%3DShort%2520keys%26lg%3D0&width=1440&height=900&dpi=192&waitMs=2800&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=um-compact-shortkeys)

