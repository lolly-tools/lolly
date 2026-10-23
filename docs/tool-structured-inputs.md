# Structured inputs and canvas controls

Some tools need more than a list of fields: a guest list with a row per person, an org chart people drag around, a photo they zoom and straighten in place. Three input patterns cover those jobs. `blocks` repeats a group of fields, a `canvas` object on a `blocks` input turns its rows into boxes on an editor canvas, and `vector` groups a few numbers into one control, which is how image framing works.

## `blocks` - repeating groups

A `blocks` input is a list of repeating records, such as team members with a name and a city each. Declare the fields of one row under `fields`:

```json
{
  "id": "people",
  "type": "blocks",
  "label": "Team members",
  "fields": [
    { "id": "name", "type": "text",  "label": "Name" },
    { "id": "city", "type": "text",  "label": "City" }
  ]
}
```

In the template, loop with `{{#each people}}…{{/each}}`. The value travels in a link as a JSON array, and the shell packs a long link automatically. When a list grows past what a link can carry, the Share dialog points to a `.lolly` file instead, and a [saved slot](/info/url-export.html#loading-saved-state-with-slot) also works. Rows are edited in a side panel, and clicking a rendered row on the canvas focuses its fields. `meeting-planner` is the reference for rows that all have the same fields.

![Deck Studio's blocks input - each row is its own card of fields, carrying the row type as its label and an Add slide button below the stack](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&cropSelector=.blocks-input%5Bdata-input-id%3D%22deck%22%5D&dark=1&filename=auth-blocks-rows)

### Rows of different kinds

A row's fields can be `text`, `color`, `select`, `asset`, `number` or `boolean`. A `select` field can also decide what kind of row each one is:

- `addMenu: { field, label }` turns the **Add** button into a menu with one entry per option of the named `select` field. That kind is fixed when the row is created and shown as the row's label instead of an editable control. An entry already used is disabled unless its option sets `repeatable: true`.
- `showFor: ["kind"]` on a field shows it only on rows of the listed kinds.
- `multilineFor: ["kind"]`, with an optional `rows`, turns a text field into a text area on rows of those kinds.

`multi-page-pdf` is the reference, with `addMenu` on a `kind` select, `showFor` and `multilineFor`; `deck-studio` does the same with a `layout` select.

### Filling rows from files, Markdown and spreadsheets

- **Drop files to add rows.** `dropToAdd: { field, accept }` appends one row per file dropped on the list, uploading each into the named `asset` field; the row's other fields start at their defaults. `accept` is a MIME filter, `image/*` by default. `logo-wall` is the reference: drop many logos and get one row each.
- **Paste a Markdown document.** `mdPaste: true` adds a **Paste Markdown** button. It reads the clipboard and adds one row per heading: the heading line goes into the row's `heading` field and the section under it into `body`, kept as Markdown for a `{{markdown}}` render. A whole document arrives as editable rows that flow across pages, which is how the paged and document tools take Markdown in.
- **Import a spreadsheet.** `importData: { formats?, mode?, columns? }` adds an **Import data** button that fills the list from a CSV or JSON file. An explicit `columns` map (`{ fieldId: "Column Name" }`) wins; otherwise each column header or key is matched, ignoring case, to a field's `id` and then its `label`. `formats` limits the accepted types (both by default), and `mode` is `replace` (the default) or `append`. JSON may be an array of objects, an array of arrays in field order or `{ "data": [ … ] }`. Imported rows are ordinary rows that go into links and saved sessions like typed ones. `deck-studio` is the reference, with one row per slide.

### Rows that point at other rows

**Reference pickers (`optionsFrom`).** A field can be a dropdown whose choices are the rows of another `blocks` input, so a row refers to another row by a readable name instead of a typed id:

```json
{ "id": "parent", "label": "Reports to",
  "optionsFrom": { "input": "nodes", "value": "nodeId", "label": "label",
                   "excludeSelf": true, "excludeDescendants": true, "emptyLabel": "- Top level -" } }
```

The stored value is the target row's derived id: `slug(value field)`, else `slug(label)`, else an ordinal, made unique. That is exactly the id a hook resolves with, so slug both a row's id and the reference in your hook and they agree. A stored value that matches no current row shows as a selected **(unknown)** option rather than vanishing, so a stale reference stays visible.

The options are `value`, `label` and `prefix` (the source fields and an ordinal prefix); `sources: [{input,value,label}]` to merge several inputs, such as cards and layers, without duplicates; `freeText: true` for a combobox that also accepts a typed value, such as a new kanban column; `excludeSelf`; `excludeDescendants`, which needs `nesting`; and `emptyLabel`.

**Tree rows (`nesting`).** A `blocks` input can be edited as a tree. The sidebar shows the flat array as an indented outline, and dragging a card's header drops it above or below another card as a sibling, or inside it as a child, updating its parent reference; the card's whole subtree moves along. The data stays a flat array of rows that refer to each other by id, so it travels in links and renders exactly as before.

```json
{ "id": "nodes", "type": "blocks", "nesting": {
    "parentField": "parent", "keyField": "nodeId", "labelField": "label",
    "activeWhen": { "diagramType": ["org", "mindmap"] } } }
```

`activeWhen` turns tree mode on only while top-level inputs hold the given values (an array value matches by membership); leave it out to always nest. `diagram-builder` is the reference for both `optionsFrom` and `nesting`: org charts and mind maps nest, while process, kanban and layercake diagrams stay flat and refer to rows through the picker.

## Editor canvas: connectors, grid & fixed size (`canvas.connect` / `grid` / `fixedCanvas`)

A `blocks` input with a `canvas` object is the free-form artboard behind `render.layout: "editor"` ([layouts](/info/tool-manifest.html#layout-and-sidebar)). Its `*Field` keys say which field of each row holds which part of a box's geometry (`xField`, `yField`, `wField`, `hField`, `rotationField`, plus fill, text and image fields). The shell then mounts its select, drag, resize and rotate overlay while the data stays a flat array that fits in a link. It also mounts the whole editor rail, with add, arrange, undo and the main export actions, so the manifest declares geometry fields and nothing else.

![The free-canvas editor rail the shell mounts for an editor layout - add, arrange, undo and export, none of it declared by the manifest](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&css=.fc-toolbar%7Bopacity%3A1!important%7D&walker=1&format=svg&cropSelector=.fc-toolbar&dark=1&filename=auth-editor-rail)

Two keys turn a plain box canvas into a diagram editor:

- **`grid`** - `{ size, default }`. Snap to a grid of `size` canvas pixels while dragging and resizing, on at the start when `default` is true. Alignment guides still win. Holding Cmd or Ctrl turns the snap off while resizing, and Alt, Cmd or Ctrl turns it off while moving.
- **`fixedCanvas`** - `true` locks the canvas to `render.width` and `render.height`: the shell withholds `setCanvasSize` and ignores the reserved `?width` and `?height`, so box coordinates stay one to one with the render size. **Required whenever a hook draws into an overlay with a fixed viewBox**, such as connector arrows in an `<svg>` sized to the artboard.

### Connectors as bound paths

`org-chart` is the public reference for an editor canvas with `grid` and `fixedCanvas: true`. Its connectors are **bound paths**: each one is an ordinary row of the same `boxes` input, a path whose ends can attach to boxes. These `canvas` keys map those rows:

- `pathField` - the text field holding the authored path: the pen tool's nodes and handles, normalised to the box frame, so moving, resizing and rotating act on the path like any box. Machine-written, so give it `showFor: []`.
- `strokeField`, `strokeWField`, `strokeDashField`, `strokeCapField`, `strokeJoinField` and `fillRuleField` - the path's stroke and fill.
- `headStartField` and `headEndField` - the decoration at the first and last point: `none`, `triangle`, `open`, `circle`, `diamond` or `bar`.
- `bindStartField` and `bindEndField` - the id of the box each end is attached to, empty for a free end. Written by the bind gesture, never typed.
- `routeField` - how a path with a bound end travels between its boxes: straight, elbow, curved or arc, or empty for automatic.
- `pathLayerClass` - the class on the `<svg>` layer where the hook draws the committed paths. The shell hides that layer during a drag while it paints its own preview.

The `canvas` object has about a hundred keys in all. The `canvas` property of a `blocks` input in `schemas/tool.schema.json` describes each one.

::: details The older `connect` key, which no public tool uses
`connect` opts into connector authoring as a second `blocks` input of edges: a **Connect** rail button (click a source box, then targets), a live connector preview and an **Auto-arrange** button that tidies the canvas into a tree. The tool's `hooks.js` reads the edges and draws the arrows as filled paths in one artboard-sized `<svg>`. The `*Field` keys refer to fields of that edges input:

```json
"connect": {
  "input": "connectors",
  "fromField": "from", "toField": "to",
  "styleField": "style", "arrowField": "arrow", "headField": "head",
  "colorField": "color", "dashField": "dash", "widthField": "width",
  "layerClass": "oc-connectors",
  "defaultStyle": "elbow", "defaultArrow": "end", "defaultHead": "triangle",
  "defaultColor": "#94a3b8", "defaultWidth": 2.5
}
```

- `fromField` and `toField` (default `from` and `to`) hold the source and target box ids.
- `styleField` - the route: `straight`, `elbow`, `elbow-v`, `elbow-h`, `elbow-src`, `elbow-tgt` or `curved`.
- `arrowField` - which ends carry an arrow: `none`, `end` or `both`. `headField` - the arrowhead: `triangle`, `open`, `circle`, `diamond` or `bar`.
- `colorField`, `dashField` (`solid`, `dashed`, `dotted`) and `widthField` (pixels) - the line styling.
- `layerClass` - the class on the tool's connector `<svg>`, hidden mid-drag while the shell paints its preview.
- `defaultStyle`, `defaultArrow`, `defaultHead`, `defaultColor` and `defaultWidth` - the values a new edge starts with.
:::

### Timelines and depth

A canvas that maps all ten time fields becomes a timeline editor: the shell mounts the timeline panel, the clock and the sequence export. Map all ten or none. A partial mapping would give the panel somewhere to read and nowhere to write, so it counts as absent.

| Key | The field that holds |
| --- | --- |
| `startField`, `durField` | When the box appears and how long it stays, in seconds. An empty start keeps the box visible throughout |
| `clipInField`, `speedField` | Where a video, Lottie or audio box starts reading its own media, plus its playback rate |
| `enterField`, `exitField` | The named animate-in and animate-out presets, such as fade, rise or pop |
| `enterMsField`, `exitMsField` | How long each preset takes, in milliseconds |
| `muteField` | Whether the box's own audio is silenced in the mix |
| `laneField` | The lane: a free overlay lane, or the main sequence row where clips stay gapless and edits ripple |

Three optional keys add to that, each on its own:

- **`zField`** - the `number` field holding a box's depth: how far it sits in front of the stage plane (positive) or behind it (negative), in canvas pixels. The projection and depth ordering use it, and so does the depth shadow below.
- **`kfField`** - the `text` field holding a box's keyframe track ([Keyframe tracks](/info/url-inputs.html#keyframe-tracks) has the wire grammar). A track can key a box's **size** (`w`, `h` in pixels) as well as its pose, and size is the one pair that re-lays the box out: text rewraps and a border stays one pixel wide. Hooks must **parse and re-serialise** this field, never pass the stored value through to a rendered attribute, because a hand-edited share link can put anything in a text field. Re-serialising keeps only clean tokens on the page.
- **`linkField`** - the `text` field holding the back-reference written when a clip's audio is detached onto its own lane. It holds the id of the box on the other side and is written on both sides, so reattaching works from either end. Machine-written, so give it `showFor: []`. It does not share geometry or create instances; a tool without it is fully time-capable and never offers **Detach audio**.

Two more depth features are values inside existing declarations rather than `canvas` keys. A box `kind` of **`camera`** is an invisible marker that aims and moves the view: it has no footprint on the canvas, is left out of hit-testing, marquee selection, alignment and stacking, is selected from its timeline bar or chip and adds no pixels to the export. And the `shadow` select can offer a **`depth`** option: a drop shadow derived from the box's `zField` value, falling off with depth, instead of an authored offset, blur and colour.

## `vector` - a group of numbers as one control

Use `vector` when a few numbers belong together: zoom and pan, an x and y offset, padding, margins. Separate `number` inputs would mean one Batch column each. A `vector` is one input, one control and one column: a row of compact number fields whose labels can be dragged to scrub the value or typed into. Declare the numbers under `fields`:

```json
{
  "id": "imageFraming",
  "type": "vector",
  "label": "Zoom & Position",
  "fields": [
    { "id": "zoom", "label": "Zoom", "min": 100, "max": 400, "step": 1, "default": 100 },
    { "id": "x",    "label": "X",    "min": 0,   "max": 100, "step": 1, "default": 50  },
    { "id": "y",    "label": "Y",    "min": 0,   "max": 100, "step": 1, "default": 50  }
  ]
}
```

![A vector control in Mesh Gradient - one labelled row of compact number fields you can drag to scrub or type into](/t/url-shot?url=%2F%23%2Ftool%2Fgradient%3Fmode%3Dblend&width=1440&height=900&dpi=192&waitMs=2000&css=%23tool-canvas%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.input-row%3Ahas%28.vector-input%5Bdata-input-id%3D%22pos1%22%5D%29&dark=1&filename=auth-vector-control&drive=click%3A.input-section%3Ahas%28%5Bdata-input-id%3D%22pos1%22%5D%29%20%3E%20summary&waitSelector=.vector-input%5Bdata-input-id%3D%22pos1%22%5D)

The value is an object keyed by field id, so the template reads each part with a dot: `{{imageFraming.zoom}}`, `{{imageFraming.x}}`, `{{imageFraming.y}}`. Each field clamps to its own `min` and `max` and falls back to its `default`.

In links and Batch CSV, each field is its own parameter or column, named `<inputId>.<fieldId>`: `?imageFraming.zoom=200&imageFraming.x=30&imageFraming.y=70`, or the CSV columns `imageFraming.zoom`, `imageFraming.x` and `imageFraming.y`. A vector has no `urlKey`. `frame` is the reference; the `filter` tool carries the same control for each raster effect, with its own prefix (`du_imageFraming`).

`imageFraming` is a [canonical input](/info/tool-inputs.html#canonical-inputs-reuse-shared-ids): reuse that id and field set exactly for any zoom-and-pan control instead of inventing another name.

## Framing an image: one pattern, every tool

Placing, cropping, straightening and correcting the perspective of an image is one control in every tool. Do not write an `object-position` string by hand, and do not invent a second set of ids for the same job: a different id or range loses the shared Batch column, and a hand-written recipe drifts from what the export paths do.

Three declarations make an image slot framable:

```json
{ "id": "image", "type": "asset", "assetType": "image", "label": "Image" },
{ "id": "imageFraming", "type": "vector", "label": "Zoom & Position", "framingFor": "image",
  "fields": [
    { "id": "zoom",   "label": "Zoom",       "min": 100,  "max": 400, "step": 1,   "default": 100 },
    { "id": "x",      "label": "X",          "min": 0,    "max": 100, "step": 1,   "default": 50  },
    { "id": "y",      "label": "Y",          "min": 0,    "max": 100, "step": 1,   "default": 50  },
    { "id": "rotate", "label": "Rotate",     "min": -180, "max": 180, "step": 0.5, "default": 0   },
    { "id": "pitch",  "label": "Vertical",   "min": -45,  "max": 45,  "step": 0.5, "default": 0   },
    { "id": "yaw",    "label": "Horizontal", "min": -45,  "max": 45,  "step": 0.5, "default": 0   }
  ] },
{ "id": "imageFit", "type": "select", "label": "Fit", "attachTo": "image", "display": "icon-toggle",
  "default": "cover",
  "options": [
    { "value": "cover",   "label": "Fill", "icon": "fitCover" },
    { "value": "contain", "label": "Fit",  "icon": "fitContain" }
  ] }
```

Every field is optional: declare `x` and `y` alone for a pan-only slot, add `rotate` to straighten, and add `pitch` and `yaw` for perspective correction, like the Geometry panel in Lightroom or Adjust in Instagram. `framingFor` points at the asset input the vector frames, and turns the sidebar numbers into a control on the canvas.

Render it with the **`{{framing}}` helper**, which writes the placement CSS and the marker the shell binds to in one call:

```html
<img src="{{asset image}}" {{framing "imageFraming"}}>
```

The argument is the input's **id**, not its value: the helper needs the id for the marker and reads the value, and the companion `imageFit`, from the render context. A `style=` option adds your own declarations after the geometry, and `persp=` changes the viewing distance the pitch and yaw projection uses.

::: check What those three declarations give you
With no shell code and no special case in your tool:

- **On the canvas**, people tap the image to arm it, then drag to move it, scroll or pinch to zoom around the pointer, drag the top handle to straighten (Shift snaps to 15 degrees) and hold Alt while dragging to correct converging verticals. Double-click resets, arrow keys nudge and Escape releases. One drag is one undo step.
- **Use as a new image** bakes the framing into new pixels, saved to the person's library as a child of the original with the source recorded as a Content Credentials ingredient. The input then points at the new image and the framing resets. It happens only on that explicit click; otherwise the original stays untouched and the framing lives in the link.
- **Links and the CLI** take the same values with no extra work: `?imageFraming.zoom=180&imageFraming.yaw=-6`, or `--imageFraming.yaw=-6`.
- **Every export** places the image from the same numbers: the SVG walker, the vector PDF path, the raster path and PPTX.
:::

One caveat before you offer `pitch` and `yaw`. A tilted plane needs a projective transform, which SVG and PDF do not have. Pan, zoom and roll stay fully vector, but a tilted image exports that element as a positioned raster. Leave the two fields out of a tool whose output must stay vector.

**Tools that draw into a `<canvas>`** call `drawFramed(ctx, source, iw, ih, W, H, framing, fit)` from `community/_shared/framing.js` instead of the helper, and mark the rendered element with `data-framing="imageFraming"` by hand. The maths is the same, and a fixture table keeps the two implementations equal, so a canvas tool and a markup tool place a photo the same way.

**Inside a `blocks` row** a field cannot be a `vector`, so the same values live as sibling numbers: `<prefix>Zoom`, `<prefix>X`, `<prefix>Y`, `<prefix>Rotate`, `<prefix>Pitch` and `<prefix>Yaw`. Put `framingFor: "<prefix>"` on the row's asset field and use the helper's block mode:

```html
{{#each blocks}}<img src="{{asset this.bgImage}}" {{framing "bg" block="blocks" index=@index}}>{{/each}}
```

Whole marks are the exception: `logo-wall` and `snippet`'s title icon offer scale only, because a logo is not cropped.

## Clickable artwork and object menus

The web shell can connect template artwork to the declared inputs. Add `data-canvas-input="title"` to focus one input, `data-canvas-input="nodes:2"` to open the third row of a `blocks` input, or `data-canvas-input="nodes:2:label"` to focus that row's label field. A tool driven by source text should point imported artwork at the visible source editor instead of a hidden row.

Add a readable `data-canvas-name` and a space-separated `data-canvas-settings` list to offer the object's settings on secondary click or touch-and-hold. Select settings change directly in the menu, and other settings focus the sidebar. Hidden controls, unavailable fields and input policies still apply. For keyboard access, give SVG groups `tabindex="0"`, `role="button"` and an `aria-label`: Enter opens the sidebar control and Shift+F10 opens the menu.

```html
<g data-canvas-input="nodes:2" data-canvas-name="Design"
   data-canvas-settings="nodes:2:label nodes:2:shape nodes:2:fill"
   tabindex="0" role="button" aria-label="Design">
  <!-- Render the card here. -->
</g>
```

The shell owns the interaction and writes through the runtime, and hooks only emit escaped annotations. A thin connection can have a wider transparent hit path marked `data-export-hide`; exports remove that path and the menu affordances.
