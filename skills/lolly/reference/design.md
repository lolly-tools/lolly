# design

`design` is the free canvas. Its document is one input, `boxes` (alias `bx`): a
flat array of layers, each an object with a stable `id`, a `kind`
(`box`/`text`/`image`/`path`/`audio`/`camera`/`frame`/`3d`), a position (`x`, `y`, `w`,
`h`, `rot`) and kind-specific fields. A `frame` layer is an artboard; any layer
naming that frame in its `frame` field is a child of it. The other top-level
inputs are document-wide settings (background, units, guides, transitions,
narration).

Two rules make an agent's edits safe:

- **Ids are permanent.** Address a layer by its id, never by its position. The
  stable id survives every edit.
- **Read before you write.** `lolly_inspect` returns the semantic read model
  (`packages/core/src/design-v1.ts`): artboards, layers by id, timing, and
  findings. Use it to discover the ids you are about to patch, and to catch
  structural errors (a layer outside its artboard, a duplicate id, an empty text
  layer) before rendering.

## Editing a document through MCP

Two additive edit channels, applied in order (`layerOperations`, then
`layerPatches`), accepted by `lolly_compile`, `lolly_inspect`, `lolly_measure`,
`lolly_validate`, `lolly_build_url` and `lolly_render`:

- **`layerOperations`**: an ordered array of structural ops, each by stable id.
  - `{ "op": "add", "layer": { "id": …, … }, "afterId"?, "beforeId"? }`
  - `{ "op": "duplicate", "id": …, "newId": …, "childIds"? }`
  - `{ "op": "remove", "id": …, "cascade"? }`
  - `{ "op": "reparent", "id": …, "artboardId": … | null }`
  - `{ "op": "reorder", "id": …, "afterId"? | "beforeId"? }`
- **`layerPatches`**: `[{ "id": …, "set": { … } }]`, merging fields into one layer
  without resending its coordinates. The id itself cannot be changed.

An `add` layer and a patch's `set` may also carry the authoring keys described
below (`$in`, `$style`, `$points`, `$d`, and in an `add` the layout keys). They
are lowered to plain layer fields before the operation runs.

## A poster, plus one `layerOperations` add

Start with a one-artboard poster and a headline:

```json
[
  { "id": "board1", "kind": "frame", "name": "Poster", "x": 0, "y": 0, "w": 1080, "h": 1350, "bg": "#faf7f2" },
  { "id": "headline", "kind": "text", "frame": "board1", "x": 80, "y": 120, "w": 920, "h": 300,
    "text": "Launch day", "fg": "#0c322c", "fontSize": 140, "weight": "800" }
]
```

Render it as SVG and add a subtitle in the same call, without re-sending the
document:

```json
{
  "name": "lolly_render",
  "arguments": {
    "toolId": "design",
    "inputs": { "boxes": [
      { "id": "board1", "kind": "frame", "name": "Poster", "x": 0, "y": 0, "w": 1080, "h": 1350, "bg": "#faf7f2" },
      { "id": "headline", "kind": "text", "frame": "board1", "x": 80, "y": 120, "w": 920, "h": 300,
        "text": "Launch day", "fg": "#0c322c", "fontSize": 140, "weight": "800" }
    ] },
    "layerOperations": [
      { "op": "add",
        "layer": { "id": "subtitle", "kind": "text", "frame": "board1", "x": 80, "y": 440, "w": 920, "h": 120,
          "text": "1 October", "fg": "#30ba78", "fontSize": 64 },
        "afterId": "headline" }
    ],
    "format": "svg"
  }
}
```

The response carries the SVG and an editable `lolly.tools` link. Hand the human the
link when they will keep iterating.

Design is an HTML-layout tool, so its SVG, raster and PDF go through the browser
(Tier-B) render path: `lolly_render` on the hosted MCP endpoint and the CLI both
escalate to it for you, but the browser-free surfaces (the public render route and
the lightweight MCP endpoint) refuse it. Use `lolly_compile` / `lolly_inspect` /
`lolly_validate` to work with the document structure without a browser.

## Authoring keys: artboard coordinates, text styles and layouts

Stored layers are written in **global canvas coordinates**, with every text field
spelled out. That is what the renderer, the exporters and the editor read, and the
stored form does not change. Writing a whole deck that way means adding each
artboard's origin to every position by hand and repeating the same size, weight,
line height and colour on every text layer. Authoring keys let you write positions
relative to an artboard, text by named style and repeated layouts once, and Lolly
lowers them to stored layers before anything else reads the document.

Every authoring key starts with `$`. A key is read once, then removed: it is never
stored, and a layer with no `$` key passes through unchanged, so a stored document
lowers to itself. Any other `$` key is an error. The contract is
`design-authoring-v1` (`https://lolly.tools/schemas/design-authoring-v1.schema.json`).

The keys are accepted wherever a Design document goes in:

- MCP: in `inputs.boxes` (with `$styles` and `$theme` beside `boxes` in `inputs`),
  in an `add` operation's `layer` and in a patch's `set`, on every tool that takes
  a Design source (`lolly_validate`, `lolly_compile`, `lolly_inspect`,
  `lolly_measure`, `lolly_build_url`, `lolly_render`, `lolly_check`,
  `lolly_package` and the looking tools). `lolly_live_apply` lowers them too, with
  the built-in styles and no brief colours, so pass colours or an inline `$style`
  there.
- CLI: `lolly run design --document=<file|->`, `lolly compile design --inputs=<file>`,
  `lolly validate design --inputs=<file> --document`, `lolly check <file>`,
  `lolly measure <file> --text-layers` and `lolly package <file>`. Text styles take
  their sizes and colours from the design system `lolly check` uses (`--file`, then
  the terminal's active system, then the content profile).

### The keys on a layer

| Key | Means |
|---|---|
| `$in: "<artboardId>"` | `x` and `y`, `$points`, `$d` and a layout's `x` and `y` are relative to that artboard's top-left corner (rounded to whole px, as the renderer rounds the corner). `frame` is set to the same id; a `frame` already there must match. Without `$in`, positions stay global. |
| `$style: "<id>"` or `{…}` | Text layers. A style id from the style table, or an inline style object. |
| `$artboard: true` | The layer is an artboard: kind `frame`, `rot` 0, shape `rect`, `clipChildren` true. Needs `w` and `h`. |
| `$points: [[x, y], …]` | Path layers. The nodes in px; the box (`x`, `y`, `w`, `h`) and `path` are computed from them, so the 320 x 200 add defaults never apply. |
| `$d: "M … C …"` | Path layers. SVG path data in px, in place of `$points`. |
| `$closed`, `$curve`, `$tension` | With `$points`: close the shape, join the nodes as `line` (the default), `cubic`, `catmull-rom`, `bspline`, `hyperbezier` or `spiro`, and the spline's tension. |
| `$tint: "{color.semantic.surface}"` | A layer with a linear `grad`: every stop takes the token's colour and keeps its own alpha, and stays linked, so one scrim is white in a light theme and dark in a dark one. |

The artboard is looked up over the whole document and the layers already there,
so an artboard may come after its own layers. Numbers given as strings (`"744"`)
are read as numbers. In a patch's `set`, `$in` must be the layer's own artboard,
and makes `set.x` and `set.y` relative to that artboard. A patch that moves an
artboard does not move the artboard's layers; the result carries a note when that
happens.

### Colours that follow the theme

A colour field (`bg`, `fg`, `stroke`, `shadowColor`, an artboard's `bg`) may hold
a token reference, `"fg": "{color.role.muted-ink}"`, and a rich-text run may name
one, `{@color.role.accent-ink w500|risk}`. Each is stored as the literal colour of
the theme the document is in plus a `tokenLinks` entry, so the layer paints
everywhere and changes colour when the theme does (`--themes` on the CLI, the
Theme row of the Design inspector's Document section on the web). A run keeps its
literal `{#rrggbb …|…}` form in `text`, and its link sits under `tokenLinks.__runs`,
keyed by that hex. `$tint` does the same for a gradient scrim.

A `grad` is a Lolly gradient spec, not CSS: `<kind>_<angle>_<stop>_<stop>…`, where
the kind is `lin`, `rad` or `con`, the angle is in degrees as in CSS (`180` runs
top to bottom), and each stop is a hex colour, `rrggbb` or `rrggbbaa` with its
alpha, then `-` and a position from 0 to 100. A scrim that fades from clear at the
top to 80% white at the bottom, and turns dark in a dark theme, is:

```json
{ "id": "s01-scrim", "kind": "box", "$in": "s01", "x": 0, "y": 540, "w": 1920, "h": 540,
  "grad": "lin_180_ffffff00-0_ffffffcc-100", "$tint": "{color.semantic.surface}" }
```

`$tint` and both PowerPoint exports take a linear spec only. A CSS
`linear-gradient(…)` in `grad` is refused under `$tint`, with a JSON pointer to the
row. `lolly schema design` prints the same grammar on the `grad` field.

`lolly package` and `lolly check` store a reference against the design system
they read (`--file`, then the terminal's active system, then the content profile).
There, a reference that does not resolve in the brand's tokens is an error with
its JSON pointer, and so are two run references in one layer that resolve to the
same colour. Where no tokens are at hand (`lolly run design --document`, the
`under` and `over` rows of `lolly compose`, and the MCP tools other than
`lolly_check`), the reference is kept as written,
an `authoring.colour.deferred` note says so, and the document resolves it when it
opens. A link that does not resolve in a theme keeps its last colour and is a
`brand.token-link.unresolved` warning in `lolly check`.

The semantic slots (`{color.semantic.text}`, `surface`, `muted`, `primary`, ...)
cover a slide's ground and main ink. The `color.role.*` tokens name the other
themed colours a slide uses: inks (`muted-ink`, `secondary-ink`, `accent-ink`,
`alert-ink`, `strong-card-ink`), lines (`hairline`, `card-hairline`, `track`),
card tints (`card`, `quiet-card`, `mint-card`, `strong-card`, `alert-card`,
`quiet-alert-card`, `alert-tint`, `alt-surface`) and `accent`. `lolly system
context --json` lists the ones a design system has, with their value per theme,
under `themes[].roles`; a design system without them lists none.

### Text styles

A text layer that carries any authoring key gets an explicit value for every text
field. Each value comes from the first of these that sets the field:

1. the layer's own fields, which always win;
2. an inline `$style` object;
3. the named style, then its `basedOn` chain;
4. the style table: the document's `$styles`, then the styles derived from the
   design brief (a `$styles` entry with a brief style's id extends that style);
5. the base: left, top, padding 0, font `sans`, line height 1.2, weight 400, 24 px.

A text layer with no `$style` takes the `body` style. A `$style` takes the place
of `body`, so an inline style without `basedOn` sits on the base alone: to
recolour body text and keep its size, write `{ "basedOn": "body", "fg": "…" }`
or set `fg` on the layer.

The brief gives one style per archetype text role: `title`, `subtitle`, `body`,
`caption`, `label`, `quote`, `number` and `attribution`, listed with their values
at the master size under `type.styles` in `lolly system context --json` and
`lolly://design-context`. Each size is the size the master's placeholders for that
role state most often (`type.roles`); `type.scale` only fills in a title, subtitle,
body or caption size the master never states, so size text from `type.styles`.
Sizes are whole px scaled from the slide master to the artboard's width, weights
follow the house rules, line heights come from a fixed table (title 1.1, subtitle 1.25, body 1.35,
caption 1.3, label 1.2, quote 1.2, number 1, attribution 1.3), and `fg` is the
theme's text colour (the muted one for subtitle, caption and attribution).
`$theme` picks the token theme those colours come from. A style may set
`fontSize`, `weight`, `lineHeight`, `tracking`, `font`, `align`, `valign`, `pad`,
`fg`, `italic` and `basedOn`. `fg` is written as the literal colour. With
`"$themes": ["light", "dark"]` (or `"all"`) beside `boxes`, it is written as a link
to the brief theme's slot instead, so the text follows the theme. `italic: true` sets each line in `*` emphasis. With no brief and no
colour from a style, `fg` is black or white by contrast with the layer's own `bg`,
or the artboard's when the layer has none, and a note in the result reports the
choice. When neither fill is a colour that can be read, `fg` is black and the note
says no contrast check was made. A colour the layer did not set itself that reads
below 3:1 on that fill is noted too. An unknown style id, or a `basedOn` cycle,
is an error.

### Layouts: `$stack`, `$grid` and `$table`

A layout layer holds an optional `id`, an optional `$in` and exactly one layout
key. It is replaced, in paint order, by the plain box, text, image and path layers
it describes; each of those then goes through `$in`, the style and the path keys
like any other layer.

- **`$stack`**: items one after another, `pitch` px apart. Fields: `x`, `y`, `w`,
  `h`, `pitch`, `axis` (`y` down, the default, or `x` across), `divider` (a straight
  rule before every item but the first), `item` (the templates for one item) and
  `items`. Down a `y` stack, `w` is the width of a text slot that gives none and
  the length of each divider. Across an `x` stack, `w` sets no slot's width, so
  give each text template its own `w`; `h` (or the divider's own `h`) is the
  length of each divider there.
- **`$grid`**: cells in `columns` columns, `colWidth` + `colGap` apart across and
  `rowPitch` down. Fields: `x`, `y`, `columns`, `rows`, `colWidth`, `colGap`,
  `rowPitch`, `order` (`row`, the default, or `column`), `cell` (the templates for
  one cell) and `items`.
- **`$table`**: rows `pitch` px apart, each an optional label then one cell per
  column. Fields: `x`, `y`, `pitch`, `divider` (before every row but the first),
  `label` (a template), `columns` (one template per column, or `{ x, y, cell: […] }`
  for several) and `rows` (each an array of cells, or `{ label, cells }`).

A divider's own `x` (down a `y` stack, or in a table) or `y` (across an `x` stack)
is measured from the artboard, as the layout's `x` and `y` are, and never from the
item or the row. Leave it out and the divider starts where the items do (in a
table, at the left of the label and columns). `dy` moves it down from the top of
each row or item, and `dx` across from the left of each item.

A template is a layer whose `x`, `y`, `$points` and `$d` are relative to its item
(or to the artboard alone with `at: "artboard"`), plus `slot`, the name an item
uses for the template. An item is a string, which fills the first text slot, or an
object from slot name to value: a string fills that slot's content (`text` for
text, `$d` for a path, `image` for an image), `null` leaves the slot out for that
item, and an object overrides the template's fields. Ids are templates too: `{i}`
is the item index, `{r}` and `{c}` the row and column. A template with no id
becomes `<layout id>-<slot>{i}`. Two layers with the same id are an error.

Layouts never write `z`, `role` or `group`, and a `group` that starts with
`narration:` is refused. An `add` whose layer expands to more than one layer
cannot carry `afterId` or `beforeId`. A document may expand to at most 5000
layers per call.

### A worked example

One artboard placed away from the canvas origin, a title in the brief's title
style, a three-item list with rules between the items, and an arrow:

```json
{
  "$styles": { "lead": { "basedOn": "body", "fontSize": 32 } },
  "boxes": [
    { "id": "s1", "$artboard": true, "name": "Agenda", "x": 2040, "y": 0, "w": 1920, "h": 1080, "bg": "#ffffff" },
    { "id": "s1-title", "$in": "s1", "$style": "title", "x": 120, "y": 96, "w": 1680, "h": 90, "text": "Agenda" },
    { "id": "s1-list", "$in": "s1", "$stack": {
      "x": 120, "y": 240, "w": 900, "pitch": 110,
      "divider": { "id": "s1-rule{i}", "stroke": "#cccccc", "strokeW": 2 },
      "item": [{ "slot": "text", "id": "s1-item{i}", "$style": "lead", "y": 16, "h": 80 }],
      "items": ["Where we are", "What changes", "What we need"]
    } },
    { "id": "s1-arrow", "$in": "s1", "kind": "path", "$points": [[1100, 300], [1500, 300], [1500, 600]],
      "stroke": "#333333", "strokeW": 4, "headEnd": "triangle" }
  ]
}
```

It lowers to eight stored layers: the artboard, `s1-title` at `x` 2160, the items
`s1-item0` to `s1-item2` at `y` 256, 366 and 476, the rules `s1-rule1` and
`s1-rule2` before the second and third items, and `s1-arrow` with its box and
`path` computed from the points. A document that cannot be lowered is refused
whole, with a JSON pointer to the key (`/boxes/2/$stack/pitch: expected a
number`); notes, such as a colour chosen by contrast, come back beside the result.

### Measure, package and check

- **Measure before you place.** `lolly_measure_text` (or `lolly measure
  --text=<text> --width=<px>`) gives the line breaks and height of a plain text
  layer before it is drawn, with the faces the canvas loads. Pass `style` (or
  `--style=<id>`) to measure the box as an authored layer; a style is sized for an
  artboard 1920 px wide unless you pass `artboardWidth` (`--artboard-width=<px>`).
  Otherwise absent fields take the renderer's defaults (48 px, weight 700, line
  height 1.12, padding 8). To measure with a document's own `$styles`, measure the
  document: `lolly measure <file> --text-layers --layer=<id>`. A
  line marked `nearEdge` is within a few px of breaking: widen the box rather than
  trust a sub-pixel fit. `lolly measure <file> --text-layers` measures every plain
  text layer of a document.
- **Package for a person.** `lolly_package` (or `lolly package <file>
  --output=<name>.lolly`) writes a `.lolly` the app reopens as the same document,
  with its pictures and its name. Give the bytes of each placeholder picture
  (`assets`, or `--asset=photo:title=title.jpg`); every other picture must be a
  catalog id of the profile, and an unresolved one is refused. The source deck
  (`source`, or `--source=<deck>`) resolves `user/media/<sha256>` refs and keys that
  end in a picture's hash, such as the `photo:4fd58e623334` keys `lolly compose
  --suggest` writes, from the deck itself; `--asset-dir=<dir>` resolves them from
  the folder `lolly read --media` wrote. A placeholder gets
  its bytes only here: `lolly run design --document` draws the slide without it
  (and refuses `--asset`), and `lolly check` on the authoring file lists it as
  `brand.asset.review`. Preview and check the packaged `.lolly` instead.
- **Check the result.** `lolly_check` (or `lolly check`) runs on the lowered
  layers; a key that cannot be lowered is a `design.authoring.invalid` finding
  with its pointer.

## Compose slides from the slide master

For a deck in the design system, compose the slides from the slide master instead
of placing every layer. `lolly compose <spec.json>` (MCP `lolly_compose`) takes a
spec that gives an archetype for each slide and what goes in its slots, and writes
a Design document: each slide seeded from the master at the spec's size (1920 x
1080 unless `size` says otherwise) the way the editor's New slide from layout
seeds it, with the master's margins, type, colour bars, page number, footer and
logo. Every layer keeps its binding to the master (`master`, `archetype`, `role`
and `furniture`; furniture is locked), and that binding is what makes the
difference downstream:

- `lolly check` judges a bound slide by the house rules the master was made for,
  so master furniture and archetype roles are not flagged as stray text;
- the PowerPoint export writes real slide layouts with title, subtitle and body
  placeholders, which a person can edit as slides. A document of authored layers
  alone exports as loose shapes on blank slides.

Use the authoring keys for what no archetype has, inside a composed slide (`under`
and `over`) or as hand-placed slides beside composed ones.

### The loop

```bash
lolly compose --list                                   # the archetypes and their slots
lolly compose --suggest --source=old.pptx --output=spec.json
lolly compose spec.json --source=old.pptx --output=deck.json --edits-out=edits.json
lolly package deck.json --source=old.pptx --label="Harbour lights" --output=deck.lolly
lolly check deck.lolly --source=old.pptx --edits=edits.json
```

`--list` prints each archetype with its slot keys (`label?` is optional,
`visual:image` and `data:table` name the slot's kind), its ground and its dark
twin; `--json` adds each slot's box in px at the master's size. `--suggest` reads a
deck and writes a first spec: an archetype per slide with the reason it was picked,
slots filled by `from` references, the deck's pictures as placeholder keys
(`photo:<first 12 hex of the sha256>`), and `source` and `notes` on every slide.
A heading whose first line is short (at most three words) over one longer line,
such as `AI` over the question it introduces, is suggested as `{ "from": ...,
"join": ": " }`, one heading instead of an eyebrow over a title. A first line that
cannot stand alone (it ends in a word such as `of`, `we` or `the`, or the next line
runs on in lower case) is a title wrapped by hand and stays whole. An eyebrow
set as its own object over the heading folds in the same way, with `from` listing
both objects. A heading object set at two sizes fills the title with its larger
paragraphs and the subtitle with the smaller ones (`para` lists them), and a short
line just under the subtitle (a role under a name) joins that slot as its second
line. Cards numbered 1, 2, 3 in reading order stay a row of columns with the
numbers left out, which compose then declares as decorative numbering. One short
line set large over a full-bleed photograph mid deck is a statement (`main-point`)
with the photo as an `under` row; its ink is the master's, so over a dark picture
set the title's `fg` or compose the slide dark. A table is set out as the data
slot's `$table`. The spec's
`footer` is set only when one footer recurs (on two slides or more, and most of
those that carry one); a slide whose own footer differs keeps its footer as
`furniture.footer`. Page numbers, footers, logos and recurring text are left to the
master, and the reason quotes any such text that is not on every slide (a chart
legend), because no other report lists those words.
Treat it as a draft: read the reasons, change the archetypes that do not fit, and
drop what the design system does not want. `--edits-out` writes the source wording
the composed slides leave out or change, as `{ "edits": [...] }`, which `lolly
check --edits` reads; its reasons are generic ("Left out of the composed slides."),
so write your own before you hand the file over. The sentence case and accent
emphasis edits keep the source's words, so check never reports them as unused.
`--output` and `--edits-out` must name two files in folders that exist.
`lolly compose --help` prints the spec's keys.

Compose the whole deck, one slide per source slide with `source` set on each.
Fidelity pairs artboards with source slides by their text, so a deck that recreates
only some slides reports the rest as missing and can pair a slide with the wrong
source.

### The spec

```json
{
  "footer": "Harbour lights",
  "slides": [
    { "archetype": "title", "source": 1,
      "slots": { "title": { "from": "ppt/slides/slide1.xml.1" },
                 "subtitle": { "from": "ppt/slides/slide1.xml.2" } },
      "under": [{ "id": "s01-photo", "kind": "image", "image": "photo:4fd58e623334",
                  "x": 0, "y": 0, "w": 1920, "h": 1080, "fit": "cover" }] },
    { "archetype": "columns-3", "source": 2,
      "slots": { "title": { "from": "ppt/slides/slide2.xml.0" } },
      "cells": [{ "label": { "from": "ppt/slides/slide2.xml.4" }, "body": { "from": "ppt/slides/slide2.xml.5" } },
                { "label": { "from": "ppt/slides/slide2.xml.9" }, "body": { "from": "ppt/slides/slide2.xml.10" } },
                { "label": { "from": "ppt/slides/slide2.xml.14" }, "body": { "from": "ppt/slides/slide2.xml.15" } }],
      "furniture": { "omit": ["page-number"] } },
    { "archetype": "closing-thanks", "source": 8,
      "slots": { "title": { "from": "ppt/slides/slide8.xml.0" }, "subtitle": null,
                 "caption": { "from": "ppt/slides/slide8.xml.1" } } }
  ]
}
```

On the synthetic `tests/fixtures/rebrand/recreate.pptx` under the public neutral
master, that is a title over the deck's cover photo, three columns of question and
answer with the decorative `01` to `03` left out (and declared in the edits), and a
closing slide without its subtitle.

At the top of the spec: `slides`, and optionally `size` (`{ "width", "height" }`
in px), `theme` (`light`, the default, or `dark`), `themes` (the token themes the
document is for, such as `["light", "dark"]`, or `--themes=light,dark`: with more
than one, the document follows the theme, as "One document in every theme"
below sets out), `footer` (the text for every
slide that shows a footer), `pageNumbers` (`false` leaves page-number furniture
off; otherwise each one shows the slide's place in the deck), `transition` (the
deck's slide transition: `slide`, `fade`, `morph` or `flight`), `furniture` (the deck's furniture defaults, which each
slide's own `furniture` merges over: the `omit` lists add up, and a slide's
`footer` and `logo` win), `emphasis` and `case` (see below, for every slide unless
it states its own), `gap` (px between slides on the canvas, 0 to 100000, 160 by default)
and `$styles` (named text styles over the brief's).

Each slide:

| Key | Means |
|---|---|
| `archetype` | An id from `lolly compose --list`, a `-dark` twin, or a content-sized `flow-cards-N-C` or `flow-columns-N-C` layout (N 2 to 12 cards or columns, C 1 to 4 per row). An unknown id is refused with the closest ids. |
| `source` | The 1-based slide of `--source` or `--inventory` the slide recreates. A `from` id is looked up there first, its notes are carried, and its words decide the edits list. |
| `slots` | Content by slot key: a role (`title`) for the first slot of that role, `role#n` (`body#2`) for the n-th, as `--list` shows them. |
| `cells` | A repeat archetype's cells (`columns-3`, `steps-4`, `flow-cards-4-2`) in reading order, each keyed by role (`label`, `body`, `number`). |
| `ground` | `light` or `dark`, over the spec's `theme`. |
| `notes` | The speaker notes: a string, `true` for the `source` slide's notes, `null` for none. Left out, a slide with a `source` carries that slide's notes. |
| `furniture` | `omit`: furniture ids (`logo-hero`, `caption-scrim`) or kinds (`logo`, `page-number`, `footer`, `bar`, `rect`) to leave off this slide, added to the deck's; `footer`: this slide's footer text; `logo`: `auto` (the mark the ground asks for, the default; over an `under` picture covering 90% of the slide or more, the on-photo mark), `mono` or `none`. |
| `emphasis`, `case` | Over the spec's, for this slide's slots. |
| `under` | Authoring rows painted before the archetype's layers, with `x` and `y` relative to the slide: a full-bleed photo under a title, a panel. |
| `over` | Authoring rows painted after them: a line the archetype has no slot for. |
| `id`, `name`, `intent` | The artboard id (`s01`, `s02`, ... by default; a slot's layer is `<id>.<slot>`), its name, and a note for yourself that nothing reads. |

A slot value is one of:

- a string: Design text markup for a text or table slot (`**bold**`, `*italic*`,
  `{#rrggbb|coloured words}`, `- ` list lines, `\n` line breaks), or for an image
  slot a catalog id, a `user/media/<sha256>` ref or a placeholder key such as
  `photo:cover` that `lolly package` resolves;
- `null` or `""`: leave the slot out. It is dropped and reported, never left as an
  empty placeholder;
- an object: `from` (an inventory object id; its words, or a picture's
  `user/media/<sha256>` ref) with `para` (one 0-based paragraph of that text) or
  `join` (every line of that text run into one, with this text between them:
  `"join": ": "` makes `AI` over `Are we ready?` into `AI: Are we ready?`), or
  `from` as a list of text objects taken in that order (`{ "from": ["<eyebrow>",
  "<heading>"], "join": ": " }` folds an eyebrow set as its own object into the
  heading; without `join` each object keeps its own lines, so a role line can sit
  under a name), with `para` as a list too (`"para": [1, 2]` takes those
  paragraphs, so a heading object set at two sizes fills a title and a
  subtitle), or `text` or `image` as above, plus `case` and `emphasis` for this slot alone, plus
  any layer field to set over the seeded slot:
  `x` and `y` relative to the slide, `w`, `h`, `fg`, `fontSize`, `weight`,
  `align`, `valign`, `fit`, and `$style` for a text style whose fields go under
  the explicit ones. The binding fields (`id`, `kind`, `frame`, `master`,
  `archetype`, `role`, `furniture`, `order`, `z`, `group`) are refused.

A table slot is a text layer, because Design has no table primitive: for rows and
columns, give the slot a `{ "$table": { ... } }`. Its `x` and `y` are relative to
the slot's box, its rows are set out there in place of the slot's text, and the
report lists the slot as filled; nothing else goes beside the `$table`. A `$table`
in `over` at the slot's box, with the slot dropped, still works. `--list --json`
gives the box at the master's own size (`master.size`, 1280 x 720 for the neutral
master), so scale it to the spec's size (by 1.5 for 1920 x 1080). `from` is
refused on a table slot. A table's `divider` is placed by `x`, `w` and `dy` (`dy`
moves it down from the top of each row); `y`, `h` or `dx` there is refused with a
pointer, as `x`, `w` or `dy` is on the divider of an `x` stack. Only the table's
own `x` and `y` are moved to the slot: a divider's `x` is measured from the
slide's left edge, so a rule under a slot at `x` 120 starts at `"x": 120`, not
`0`. Leave the divider's `x` and `w` out and it spans the label and columns (each
column template then needs its own `w`).

### What compose decides, and what it reports

- **The master.** The first of `--master=<masters.json>`, the slide master of the
  design system in use (only when that system is the content profile's own), and
  the engine's neutral master; the report's `master.origin` says which (`flag`,
  `catalog` or `neutral`). A `--file` design system from another brand composes on
  the neutral master, with a `compose.master.neutral` note.
- **Dark.** `theme: "dark"` or a slide's `ground: "dark"` takes each archetype's
  `-dark` twin. A `flow-cards-N-C` or `flow-columns-N-C` layout takes a twin made
  from the master's dark content slide (`flow-cards-4-2-dark`). A light archetype
  with no twin (`main-point`, `split`, `big-number`) is drawn from the master under
  the design system's Dark theme, with a `compose.dark.themed` note; when that
  theme gives it no dark ground either, it stays light with a `compose.dark.none`
  note. An archetype that is dark by design (`title`, `full-image`, `quote`,
  `closing-thanks`) keeps itself in a light deck; a slide that asks it for
  `ground: "light"` gets a `compose.ground.ignored` note, and a `-dark` id asked
  for light takes its light archetype.
- **Logos.** A logo mark comes from the catalog of the design system whose master
  is used. With `logo: "auto"`, a slide whose `under` picture covers 90% of it or
  more takes the on-photo mark (the design system's mono mark for dark grounds,
  else its on-dark mark) where the master places the logo, so a photo slide keeps
  its logo without a surface warning. Under the neutral master of a `--file`
  system there is no mark, and the logo is left off with a note. To place a mark,
  put an image row in `over` with the logo's catalog id, or a placeholder key you
  give the picture for with `lolly package --asset`. When the photograph's bytes
  are at hand (a `--source` deck's picture, or `lolly compose --asset=KEY=PATH`
  for a placeholder key, the same flag `lolly package` takes), compose measures
  the picture under the logo box: a mark the brand allows on photography (a
  `logo-surface` rule's `photo` list; with no rule, any of its marks) is kept only
  when each of its colours reaches 3:1 there. When none does, the logo is left off
  with a `compose.logo.photo-contrast` note giving the light it measured; place a
  mark yourself on a calmer part of the picture, or over a scrim. A mark whose own
  colours carry 3:1 between them (a badge) is not judged against the picture.
  The picture is measured as drawn: an `under` box's fill and opacity (a percent),
  a token fill and a linear `grad` with its `$tint`. A slide whose `under` rows it
  cannot draw that way (a token that does not resolve, a radial gradient, a
  picture with a photo look) is not measured, and a
  `compose.logo.photo-unmeasured` note says why. The text slots over the
  photograph are measured too: a slot whose ink falls short of 3:1 (title,
  subtitle, quote, number) or 4.5:1 against the picture under it gets a
  `compose.text.photo-contrast` note and keeps its ink; put a scrim under it or
  set its `fg`.
- **Fit.** Every composed text slot is measured. The report lists each one that
  clips; `--fit=shrink` (MCP `fit: "shrink"`) steps it down in whole px to the
  smallest size the master sets for that role, and reports what still clips.
- **Edits.** The source wording a composed slide leaves out or changes, relative to
  its `source` slide. Each edit names a line of the source: a sentence case or
  accent change on a joined slot is recorded per source line it changed, its
  result that line as the slot now reads it. A slot given its own words in place
  of the source object of its role (`"title": "Three questions"` for `3 Main
  Questions`) is an edit with that result, and a dropped counter (`01`, `02`) is
  declared as decorative numbering.
- **Notes.** A source slide's notes are carried with a blank line between
  paragraphs and a single newline for each line break inside one; the `.pptx`
  writes those as `a:p` and `a:br`, so a note broken by line breaks comes back as
  one paragraph.
- **Dark slides in PowerPoint.** A light archetype drawn dark (`compose.dark.themed`)
  binds the light slide layout in the `.pptx`, its dark ground and ink set on the
  slide itself. Reset Slide in PowerPoint, or a new slide from that layout, comes
  back light; the export notes name those slides.
- **Theme colours in PowerPoint.** The `.pptx` theme takes `dk1`, `lt1`, `dk2`,
  `accent1` and `accent2` from the design system's `color.semantic.*` tokens, and
  `accent3` from `color.semantic.accent` when the system states one. Every other
  slot is filled from the system's own colours: `lt2` with the colour nearest the
  surface on the same side of mid grey, and the accents with `color.brand.*` first,
  then the spectrum, ramp and role colours. PowerPoint's colour picker then offers brand colours only, in
  each theme the deck is exported in.

### Where the master's look is not the source's

Compose is correct by construction against the master, so these are the places to
add intent:

- **Emphasis follows the brand.** In a title, subtitle, quote or number slot, a
  bold run copied with `from` is set in the brand's accent colour at the slot's
  own weight when a text-weight house rule on that slot does not allow bold (700).
  The accent is the brief's accent, secondary or primary colour for that ground,
  else an ink the brand pairs with the ground, as long as the brand's combinations
  allow it as text there and it differs from the slot's own ink: a colour the
  pairings forbid as text on white is passed over for one they allow. Each change
  is a `compose.emphasis.accent` note and an edit in the edits list. When no ink
  qualifies, the bold stays bold and a `compose.emphasis.no-accent` note says
  why. `emphasis` on the spec, a slide or a slot sets it yourself: `accent`,
  `bold` (bold stays bold), or `keep` (bold, with the source's own run colours).
  Other slots carry bold as bold. Text you write yourself is yours: bold you write
  in a slot's text stays bold, so write `{#rrggbb|word}` there for the accent.
- **Several lines in one heading.** `from` copies every paragraph of the object,
  `para` picks one (or a list, `[1, 2]`), and `join` runs every line into one with
  the text you give (`"join": ": "`). Paragraph breaks and line breaks both count
  as lines, and a line that already ends with the separator's mark keeps its own.
  With both, the picked paragraphs' lines run into one (`{"from": "...", "para":
  [1, 2], "join": " "}`): a sentence broken by hand over more lines than its slot
  holds, which `--suggest` writes this way.
- **Sentence case.** `case` is `sentence` or `keep`. `case: "sentence"` on the
  spec, a slide or a slot lowers each word in Title Case except the first word of
  the text, of a line and of a sentence, and keeps words in capitals or with a capital inside (`AI`, `SUSE`,
  `iPhone`), acronyms joined by `&`, `.`, `/` or `+` (`R&D`, `U.S.`, `C++`), `I` and its
  contractions (`I'm`), and words with digits. Each changed line is an edit with its
  result and a `compose.case.sentence` note. It cannot tell a proper noun in Title
  Case (`Europe`, a person's name) from any other word, so it lowers those too:
  it is never the default, and `case: "keep"` on a slot or slide keeps a name as
  written.
- **Furniture on photographs and closings.** The master's page number, colour bar
  and logo appear wherever the archetype has them, including over a full-bleed
  `under` photo. The logo there takes the on-photo mark by itself (`logo:
  "auto"`), so it needs no workaround. Leave furniture off for the whole deck
  with the spec's `furniture.omit`, or per slide; `pageNumbers: false` drops
  every page number. An `omit` entry that matches no furniture is a
  `compose.furniture.unknown` note: once at `/furniture/omit` for the deck's
  list, and per slide for a slide's own.
- **Photographs drawn larger than their pixels.** A picture drawn at more than
  twice its pixel size is a `design.image.low-resolution` warning in `lolly
  check` (an upload the `.lolly` carries, or a catalog file; an SVG is never
  judged). A full-bleed `under` photo on a 1920 x 1080 slide needs a picture of
  at least 960 x 540 px.
- **Master defaults under another design system.** The neutral master's own
  styles (a `#1d1d1db8` caption scrim, labels at weight 700) can trip a `--file`
  system's house rules. Override the slot (`{ "from": "...", "weight": "400" }`),
  or omit the scrim and draw your own with a brand colour and `opacity`. Where
  it can go depends on where the photograph is. On `full-image` the photograph is
  the archetype's own `visual` slot: a row in `under` paints beneath the photo
  and never shows, and a row in `over` paints over the caption too. So for a brand
  scrim there, set the photo as an `under` row on an archetype with no picture
  slot (`main-point`, `title`) and draw the scrim in `under` after it. Omitting
  it (`"furniture": { "omit": ["caption-scrim"] }`) reaches the `.pptx` too: the
  slide layout made from an archetype carries only the furniture every slide on
  that archetype keeps, so the master's scrim is not drawn under your slide and a
  new slide made from that layout in PowerPoint has none. Each slide still draws
  the furniture it keeps as its own shapes. A
  palette colour with an alpha channel (`#13294bcc` over a palette `#13294b`)
  counts as that palette colour to `lolly check`. Any other colour with alpha,
  such as the neutral scrim when `#1d1d1d` is not in the palette, stays
  `brand.color.unknown`.
- **Editing after.** In the editor, Reset slide puts a slot's `fontSize`,
  `weight`, `align`, `valign`, `font` and `fg` back to the master's, so an
  override of those six is lost there. `lineHeight` and `pad` stay.

## One document in every theme

A design system with more than one theme (`lolly system context --json` lists
them under `themes`, usually `light` and `dark`) can be served by one Design
document. Four things follow the theme the document is shown in:

- **Colours**, written as token references (see "Colours that follow the theme"
  above). A colour written as a hex stays that hex in every theme.
- **Logos and icons**, written as `<id>?theme=auto`.
- **Photo looks**, written as `?treatment=<look id>` on a picture whose look has a
  variant for the theme.
- **Gradient scrims**, linked with `$tint`.

### Logos and icons that follow the surface

An image layer whose `image` is any member of a logo family, or a themable icon,
followed by `?theme=auto` (`lolly/logo/primary?theme=auto`), takes the variant the
surface under it asks for, in every theme. The surface is the topmost earlier
layer of the same artboard that covers at least 90% of the logo, else the
artboard's own fill: a picture is `photo`, a translucent colour or gradient over a
picture (a scrim) is still `photo`, and a colour is `light` or `dark`. Then:

- a logo takes the first mark of the brand's `logo-surface` house rule for that
  surface with the same orientation (photography falls back to the dark list),
  and a mono mark asks for a mono mark first. Without that rule, the
  `asset.logo.*` tokens flip a treatment to its reverse on dark. Without those,
  the slide master's marks answer;
- an icon takes the first icon theme whose `surfaces` include the surface (a
  photograph counts as dark unless a theme names `photo`), else the brief's 3:1
  contrast test against the light and dark surfaces.

The layer keeps the `?theme=auto` id, so the pick is made again whenever the
document opens, changes theme or the layers under it change. Where nothing
answers, the id before `?` is drawn. `lolly check` treats an auto id as known, and
the logo-surface house rule judges the mark that was picked. The brief gives the
form as `logos.autoForm` and `icons.autoForm`.

### Photo looks

A photo look is the brand's grade for photography, declared in the design
system's photo treatments (`media.treatments` in the brief, with
`media.idForm` `<id>?treatment=<treatmentId>`). Write it on the picture's id: a
catalog photo (`<id>?treatment=tone`), an upload (`user/media/<sha256>?treatment=tone`)
or a placeholder key `lolly package` fills (`photo:cover?treatment=tone`). There is
no layer field for it. A look of kind `gradient-map` maps the photo's lightness
onto two to sixteen brand colours in OKLab, after an optional `contrast` and
`lightness` grade, at `amount` percent; `lut` applies a catalog `.cube` file;
`greyscale` and `duotone` are the older kinds. A look may carry `themes`
variants (`"themes": { "dark": { "stops": [...] } }`), and the variant for the
document's theme is the one drawn, so one picture is graded light in the light
export and dark in the dark one. The starter design system declares a neutral
`tone` look with a dark variant.

The look is baked into the picture's pixels when the document resolves the
picture (in a worker in the browser, with `@napi-rs/canvas` on the CLI), so every
export, PowerPoint included, receives an ordinary picture. A CLI without that
canvas draws the plain picture and warns. A look the design system does not
declare is a `brand.reference.unknown` finding in `lolly check`. One id carries a
look or a `?theme=` choice, never both. In the app, a person changes or clears a
look from the image layer's Set image picker: the Colour row heads the Catalogue's
photo groups and the Private assets tab, which holds the uploads, with the current
look pressed. Choosing None and then the picture stores the plain id.

### Exporting and checking every theme

- `lolly run <file.lolly> --themes=light,dark --export=pptx --output=deck.pptx`
  opens the file once and writes `deck-light.pptx` and `deck-dark.pptx`. The same
  flag works on `lolly run design --document=<file>` and on any tool, as one export
  per theme. `--themes=all` takes every theme the content profile's design system
  declares, in its order. `--themes` needs `--output`, and a name the design
  system does not declare is refused with the names it does.
- `lolly check <file> --themes=light,dark` (MCP `lolly_check` with `themes`)
  gives one report and runs the render, brand and Verify families in each theme:
  the page is painted once per theme, linked colours, logos and looks resolve in
  that theme, and each of those findings carries `theme`. Structure and fidelity
  run once, in the first theme, since the layers and the words are the same in
  every theme. `--theme=<name>` checks one theme.
- In URL mode the parameter is `_themes`, the theme per token group as JSON
  (`_themes={"":"dark"}`), in the app's links and on the CLI. A choice the design
  system does not declare draws that group's default theme with no warning, so
  prefer `--themes`, which refuses an unknown name. The public render route reads
  `_themes` too, but it refuses Design in any theme, because Design needs the
  browser tier (see the top of this page).
- In the app, the Design inspector's Document section shows a Theme row when the
  design system declares more than one theme. A session saved from the app keeps
  the choice; `lolly package` stores none, so the file opens in the default theme.

`lolly compose` with `themes: ["light", "dark"]` (or `--themes=light,dark`) writes
one document that follows the theme:

- logo furniture is written as `<id>?theme=auto`;
- every ground, bar and ink the master takes from a token is stored as the colour
  of the spec's `theme` plus a link to that token, so each theme repaints it;
- a `{path}` colour, a `$tint` or an `@` run in an `under` or `over` row is lowered
  the same way, and a reference that does not resolve is refused at its pointer;
- on a dark deck (`"theme": "dark"`), a light archetype whose ground turns dark in
  the dark theme, with ink that still reads on it, is used in place of its dark
  twin, so the slide is light in the light theme. A master whose inks are brand
  colours that stay the same in every theme keeps the twin;
- an ink the master takes from a brand colour that never changes, on a ground
  that follows the theme, is linked to the theme's own ink of the same colour that
  reads on that ground in every theme (`color.semantic.text`, then the role inks),
  so a dark title on a surface that turns dark turns light.
  A light ground taken from a constant (main-point's tint) is linked to
  `color.semantic.surface` or `color.role.alt-surface` when one has its colour;
  with neither, an ink that would stop reading on it is held at the master's
  colour. The report lists these under `compose.theme.linked` and
  `compose.theme.ink-held`, and names any ink left fixed with `compose.theme.ink-fixed`;
- a slide that is dark by design (`title`, `full-image`, `quote`,
  `closing-thanks`) keeps the master's colours in every theme
  (`compose.theme.held`), and its PowerPoint layout keeps them too, so a slide
  reset or added in PowerPoint stays dark;
- accent emphasis (E15) is written as a run linked to `color.role.accent-ink`
  (or the first accent token that reads on the slot's ground in every theme), so
  it follows the theme.

A colour the master states as a hex stays literal in every theme. With one theme,
compose writes the literal colours it always did and leaves `under` and `over`
references for the runtime.

A slot's own `fg` keeps the master's link. Written as a hex, it replaces the colour
and leaves the master's `tokenLinks` entry in the row, and what the row does then
depends on the hex. One that differs from the master's colour in the spec's `theme`
wins over the link, so it stays that hex in every theme. One equal to the master's
colour reads as the master's own, so the link still repaints it in each theme. To
make a slot follow another token, write the reference: compose stores its colour
with a link to it in place of the master's, and refuses a reference that does not
resolve: `"fg": "{color.role.accent-ink}"`. An `@` run in a slot's text is lowered
the same way.

### What reaches PowerPoint

Both PowerPoint paths, the one with slide layouts and placeholders and the one
with free shapes, write these as native objects:

- a box with a linear `grad`, such as a scrim over a photograph, as a gradient
  fill with one alpha per stop. A box with a `bg` under its gradient becomes two
  shapes, the fill below the gradient;
- a mirrored picture (`flipH`, `flipV`) and a translucent one (`opacity`);
- a `fit: "cover"` picture, cropped from its own pixels, and a `contain` picture
  letterboxed in its box;
- a photo with a look, as the baked picture.

A radial or conic gradient, a turned gradient box, a translucent gradient over its
own `bg`, a gradient on text or a picture, and mirrored text are left out of the
deck. The export with slide layouts names each one in its notes; the free-shape
export leaves it out without a note. Paint those another way, or keep them off
slides meant for PowerPoint.

## Carousels and timed video

- **A carousel** is several `frame` artboards in one document, addressed at export
  with `s` (`url-mode.md`): in the app, stills fan out to one file per board
  (zipped when there is more than one), and `pdf`/`pptx` make one page per board.
  `lolly run <file.lolly> --export=png` writes one still, the first board unless
  `--s` names another, and says so on stderr: run it once per board with
  `--s=<n>` for a set. Add a board with a `frame` layer and give its children that
  board's id in their `frame` field.
- **A timed video** rides on per-layer timing: `start`, `dur` and `lane` put a
  layer on the timeline; `enter`/`exit` name transitions. Render `format=mp4` (or
  `webm`) with `fps`/`seconds`. `lolly_measure` reports the document's duration so
  you can size the clip.

Read [Motion in Design](motion.md) for timing units, motion recipes, review and
the differences between the available export surfaces. The generated fields
below list the allowed select values; an empty string is a real choice.

## Top-level inputs

Generated from `community/design/tool.json` (the `boxes` block is documented
separately below).

<!-- GEN:design-inputs -->
| ID | Alias | Type | Default | What it does | Allowed values |
|---|---|---|---|---|---|
| `editingRange` | - | select | `sdr` | Editing range | `"sdr"`, `"hdr"` |
| `background` | - | color | `{color.semantic.surface}` | Canvas background | - |
| `documentUnit` | - | select | `px` | Document unit | `"px"`, `"mm"`, `"cm"`, `"in"`, `"pt"` |
| `documentDpi` | - | number | 300 | Document DPI | - |
| `guides` | `gd` | longtext | `""` | Authoring guides | - |
| `customCss` | - | longtext | `""` | Custom CSS | - |
| `transition` | - | select | `slide` | Slide transition | `"slide"`, `"fade"`, `"morph"`, `"flight"` |
| `autoAdvance` | - | boolean | false | Auto-advance slides | - |
| `narrationVoice` | - | text | `""` | Narration voice | - |
| `narrationSpeed` | - | number | 1 | Narration speed | - |
| `narrationLeadInMs` | - | number | 400 | Narration lead-in (ms) | - |
| `narrationTailMs` | - | number | 600 | Narration tail (ms) | - |
| `showCaptionsWhenPresenting` | - | boolean | false | Show captions when presenting | - |
| `projectFps` | - | select | `30` | Project frame rate | `"24"`, `"25"`, `"30"`, `"50"`, `"60"` |
| `sequenceMarks` | - | longtext | `""` | Timeline markers | - |
| `textDocument` | `tdoc` | longtext | `""` | Text document | - |
| `exportVisibleText` | - | boolean | false | Export visible text only | - |
| `sequenceTiming` | - | longtext | `""` | Beat and cue timing | - |
| `sequenceMotionBlur` | - | longtext | `""` | Temporal motion blur | - |
<!-- /GEN:design-inputs -->

## The `boxes` layer fields

Every field a layer object may carry. Not all apply to every `kind`: `text`, `fg`,
`fontSize`, `weight` and `align` are text; `image`, `fit` and `blend` are image;
`path`, `stroke` and `strokeW` are path; `start`, `dur`, `lane`, `enter` and `exit`
are timing. Generated from the `boxes` block.

<!-- GEN:design-boxes -->
| ID | Alias | Type | Default | What it does | Allowed values |
|---|---|---|---|---|---|
| `id` | - | text | - |  | - |
| `kind` | - | select | `box` | Kind | `"box"`, `"text"`, `"image"`, `"path"`, `"audio"`, `"camera"`, `"frame"`, `"3d"`, `"web"` |
| `x` | - | number | 120 | X | - |
| `y` | - | number | 120 | Y | - |
| `w` | - | number | 320 | Width | - |
| `h` | - | number | 200 | Height | - |
| `rot` | - | number | 0 | Rotation | - |
| `shape` | - | select | `rect` | Shape | `"rect"`, `"rounded"`, `"pill"`, `"ellipse"`, `"circle"` |
| `radius` | - | number | 16 | Corner radius | - |
| `bg` | - | color | `""` | Fill | - |
| `opacity` | - | number | 100 | Opacity | - |
| `image` | - | asset | - | Image, animation or video | - |
| `fit` | - | select | `contain` | Image fit | `"contain"`, `"cover"`, `"fill"` |
| `blend` | - | select | `normal` | Blend mode | `"normal"`, `"multiply"`, `"screen"`, `"overlay"`, `"darken"`, `"lighten"`, `"color-dodge"`, `"color-burn"`, `"hard-light"`, `"soft-light"`, `"difference"`, `"exclusion"`, `"hue"`, `"saturation"`, `"color"`, `"luminosity"` |
| `text` | - | text | `""` | Text | - |
| `fg` | - | color | `{color.semantic.text}` | Text colour | - |
| `fontSize` | - | number | 48 | Text size | - |
| `align` | - | select | `center` | Align | `"left"`, `"center"`, `"right"` |
| `valign` | - | select | `middle` | Vertical | `"top"`, `"middle"`, `"bottom"` |
| `weight` | - | select | `500` | Weight | `"100"`, `"200"`, `"300"`, `"400"`, `"500"`, `"600"`, `"700"`, `"800"`, `"900"` |
| `font` | - | select | `sans` | Font | `"sans"`, `"display"`, `"mono"` |
| `lineHeight` | - | number | 1.12 | Line height | - |
| `tracking` | - | number | 0 | Kerning | - |
| `ligatures` | - | boolean | true | Ligatures | - |
| `alternates` | - | boolean | false | Stylistic alternates | - |
| `group` | - | text | `""` | Group | - |
| `clip` | - | text | `""` | Clip to | - |
| `pad` | - | number | 8 | Text padding | - |
| `shadow` | - | select | `none` | Shadow | `"none"`, `"box"`, `"text"`, `"content"`, `"depth"` |
| `shadowColor` | - | color | `#00000055` | Shadow colour | - |
| `shadowX` | - | number | 0 | Shadow X | - |
| `shadowY` | - | number | 0 | Shadow Y | - |
| `shadowBlur` | - | number | 10 | Shadow blur | - |
| `imgpos` | - | select | `center` | Image position | `"left top"`, `"center top"`, `"right top"`, `"left center"`, `"center"`, `"right center"`, `"left bottom"`, `"center bottom"`, `"right bottom"` |
| `fitText` | - | boolean | false | Shrink text to fit | - |
| `path` | - | text | `""` |  | - |
| `stroke` | - | color | `""` | Stroke | - |
| `strokeW` | - | number | 0 | Stroke width | - |
| `fillRule` | - | select | `nonzero` | Fill rule | `"nonzero"`, `"evenodd"` |
| `start` | - | number | `""` | Start (s) | - |
| `dur` | - | number | `""` | Duration (s) | - |
| `clipIn` | - | number | 0 | Trim in (s) | - |
| `speed` | - | number | 1 | Speed | - |
| `enter` | - | select | `none` | Animate in | `"fade"`, `"pop"`, `"grow"`, `"rise"`, `"drop"`, `"slide-left"`, `"slide-right"`, `"slide-up"`, `"slide-down"`, `"zoom-in"`, `"zoom-out"`, `"tilt"`, `"swoop"`, `"spin"`, `"drift"`, `"none"` |
| `exit` | - | select | `none` | Animate out | `"fade"`, `"pop"`, `"grow"`, `"rise"`, `"drop"`, `"slide-left"`, `"slide-right"`, `"slide-up"`, `"slide-down"`, `"zoom-in"`, `"zoom-out"`, `"tilt"`, `"swoop"`, `"spin"`, `"drift"`, `"none"` |
| `enterMs` | - | number | 400 | In duration (ms) | - |
| `exitMs` | - | number | 400 | Out duration (ms) | - |
| `mute` | - | boolean | false | Mute audio | - |
| `lane` | - | select | `""` | Lane | `""`, `"seq"` |
| `strokeDash` | - | select | `""` | Stroke style | `""`, `"dashed"`, `"dotted"` |
| `strokeCap` | - | select | `round` | Line ends | `"round"`, `"butt"`, `"square"` |
| `strokeJoin` | - | select | `round` | Corners | `"round"`, `"miter"`, `"bevel"` |
| `grad` | - | text | `""` | Gradient | - |
| `blur` | - | number | 0 | Blur | - |
| `strokeDashLen` | - | number | 0 | Dash length | - |
| `strokeGapLen` | - | number | 0 | Gap length | - |
| `bgBlur` | - | number | 0 | Backdrop blur | - |
| `enterEase` | - | text | `""` | In easing | - |
| `exitEase` | - | text | `""` | Out easing | - |
| `frame` | - | text | `""` | Artboard | - |
| `order` | - | number | 0 | Order | - |
| `clipChildren` | - | boolean | true | Clip children | - |
| `headStart` | - | select | `none` | Path start | `"none"`, `"triangle"`, `"open"`, `"circle"`, `"diamond"`, `"bar"` |
| `headEnd` | - | select | `none` | Path end | `"none"`, `"triangle"`, `"open"`, `"circle"`, `"diamond"`, `"bar"` |
| `strokeDashArray` | - | text | `""` | Dash array | - |
| `dashFit` | - | boolean | false | Fit dashes to corners | - |
| `bindStart` | - | text | `""` | Start attached to | - |
| `bindEnd` | - | text | `""` | End attached to | - |
| `route` | - | select | `""` | Route | `""`, `"straight"`, `"elbow"`, `"elbow-v"`, `"elbow-h"`, `"elbow-src"`, `"elbow-tgt"`, `"curved"`, `"curved-v"`, `"curved-h"`, `"arc"`, `"arc-wide"`, `"arc-flip"`, `"arc-flip-wide"` |
| `z` | - | number | 0 | Depth | - |
| `kf` | - | text | `""` | Keyframes | - |
| `linkOf` | - | text | `""` | Linked to | - |
| `presentAudio` | - | boolean | false | Play sound when presenting | - |
| `build` | - | number | `""` | Build step | - |
| `state` | - | text | `""` | Frame state | - |
| `matchOf` | - | text | `""` | Morph match key | - |
| `notes` | - | text | `""` | Speaker notes | - |
| `flipH` | - | boolean | false | Flip horizontal | - |
| `flipV` | - | boolean | false | Flip vertical | - |
| `cls` | - | text | `""` | CSS class | - |
| `gain` | - | number | 1 | Volume | - |
| `name` | - | text | `""` | Clip name | - |
| `ignored` | - | boolean | false | Skip on playback | - |
| `split` | - | select | `""` | Animate text by | `""`, `"word"`, `"line"`, `"letter"` |
| `stagger` | - | number | 60 | Text stagger (ms) | - |
| `splitOrder` | - | select | `""` | Text order | `""`, `"reverse"`, `"center"`, `"random"` |
| `hold` | - | select | `""` | While on screen | `""`, `"pulse"`, `"bob"`, `"sway"`, `"flicker"` |
| `holdRate` | - | number | 1 | Hold speed (cycles/sec) | - |
| `rx` | - | number | `""` | Tilt X | - |
| `ry` | - | number | `""` | Tilt Y | - |
| `pan` | - | number | `""` | Pan | - |
| `duck` | - | number | `""` | Under other audio | - |
| `pitch` | - | number | `""` | Pitch | - |
| `varispeed` | - | boolean | `""` | Pitch follows speed | - |
| `fx` | - | text | `""` | Audio effect | - |
| `stackOf` | - | text | `""` | Stacks under | - |
| `hidden` | - | boolean | false | Hidden | - |
| `locked` | - | boolean | false | Locked | - |
| `slideTransition` | - | select | `""` | Transition to next | `""`, `"slide"`, `"fade"`, `"morph"`, `"flight"`, `"none"`, `"custom"` |
| `plainText` | - | boolean | false | Plain text | - |
| `scene` | - | text | `""` | Scene | - |
| `animationId` | - | text | `""` | Animation in source | - |
| `animationEdits` | - | text | `""` | Internal animation edits | - |
| `textStory` | - | text | `""` | Text story | - |
| `textFrame` | - | text | `""` | Text frame settings | - |
| `pathPaint` | - | text | `""` | Vector paint | - |
| `vectorSource` | - | text | `""` | Vector source and credits | - |
| `textWrap` | - | text | `""` | Text wrap settings | - |
| `master` | - | text | `""` | Slide master | - |
| `role` | - | select | `""` | Archetype role | `""`, `"title"`, `"subtitle"`, `"body"`, `"visual"`, `"data"`, `"caption"`, `"number"`, `"label"`, `"quote"`, `"attribution"` |
| `furniture` | - | text | `""` | Master furniture | - |
| `archetype` | - | text | `""` | Slide archetype | - |
| `textDirection` | - | select | `""` | Text direction | `""`, `"ltr"`, `"rtl"` |
| `tokenLinks` | - | text | `""` | Token links | - |
| `web` | - | text | `""` | Web page | - |
| `webView` | - | number | 0 | Lay out as | - |
| `webLoad` | - | select | `slide` | When presenting | `"slide"`, `"early"`, `"keep"`, `"click"` |
| `webCss` | - | text | `""` | Page CSS | - |
| `webHideCookies` | - | boolean | false | Hide cookie banners | - |
<!-- /GEN:design-boxes -->
