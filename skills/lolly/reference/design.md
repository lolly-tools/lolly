# design

`design` is the free canvas. Its document is one input, `boxes` (alias `bx`): a
flat array of layers, each an object with a stable `id`, a `kind`
(`box`/`text`/`image`/`path`/`audio`/`camera`/`frame`), a position (`x`, `y`, `w`,
`h`, `rot`) and kind-specific fields. A `frame` layer is an artboard; any layer
naming that frame in its `frame` field is a child of it. The other 12 top-level
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

## Carousels and timed video

- **A carousel** is several `frame` artboards in one document, addressed at export
  with `s` (`url-mode.md`): stills fan out to one file per board, `pdf`/`pptx` make
  one page per board. Add a board with a `frame` layer and give its children that
  board's id in their `frame` field.
- **A timed video** rides on per-layer timing: `start`, `dur` and `lane` put a
  layer on the timeline; `enter`/`exit` name transitions. Render `format=mp4` (or
  `webm`) with `fps`/`seconds`. `lolly_measure` reports the document's duration so
  you can size the clip.

## Top-level inputs

Generated from `community/design/tool.json` (the `boxes` block is documented
separately below).

<!-- GEN:design-inputs -->
| ID | Alias | Type | Default | What it does |
|---|---|---|---|---|
| `background` | - | color | `{color.semantic.surface}` | Canvas background |
| `documentUnit` | - | select | `px` | Document unit |
| `documentDpi` | - | number | 300 | Document DPI |
| `guides` | `gd` | longtext | `""` | Authoring guides |
| `customCss` | - | longtext | `""` | Custom CSS |
| `transition` | - | select | `slide` | Slide transition |
| `autoAdvance` | - | boolean | false | Auto-advance slides |
| `narrationVoice` | - | text | `""` | Narration voice |
| `narrationSpeed` | - | number | 1 | Narration speed |
| `narrationLeadInMs` | - | number | 400 | Narration lead-in (ms) |
| `narrationTailMs` | - | number | 600 | Narration tail (ms) |
| `showCaptionsWhenPresenting` | - | boolean | false | Show captions when presenting |
<!-- /GEN:design-inputs -->

## The `boxes` layer fields

Every field a layer object may carry. Not all apply to every `kind`: `text`, `fg`,
`fontSize`, `weight` and `align` are text; `image`, `fit` and `blend` are image;
`path`, `stroke` and `strokeW` are path; `start`, `dur`, `lane`, `enter` and `exit`
are timing. Generated from the `boxes` block.

<!-- GEN:design-boxes -->
| ID | Alias | Type | Default | What it does |
|---|---|---|---|---|
| `id` | - | text | - |  |
| `kind` | - | select | `box` | Kind |
| `x` | - | number | 120 | X |
| `y` | - | number | 120 | Y |
| `w` | - | number | 320 | Width |
| `h` | - | number | 200 | Height |
| `rot` | - | number | 0 | Rotation |
| `shape` | - | select | `rect` | Shape |
| `radius` | - | number | 16 | Corner radius |
| `bg` | - | color | `""` | Fill |
| `opacity` | - | number | 100 | Opacity |
| `image` | - | asset | - | Image, animation or video |
| `fit` | - | select | `contain` | Image fit |
| `blend` | - | select | `normal` | Blend mode |
| `text` | - | text | `""` | Text |
| `fg` | - | color | `{color.semantic.text}` | Text colour |
| `fontSize` | - | number | 48 | Text size |
| `align` | - | select | `center` | Align |
| `valign` | - | select | `middle` | Vertical |
| `weight` | - | select | `500` | Weight |
| `font` | - | select | `sans` | Font |
| `lineHeight` | - | number | 1.12 | Line height |
| `tracking` | - | number | 0 | Kerning |
| `ligatures` | - | boolean | true | Ligatures |
| `alternates` | - | boolean | false | Stylistic alternates |
| `group` | - | text | `""` | Group |
| `clip` | - | text | `""` | Clip to |
| `pad` | - | number | 8 | Text padding |
| `shadow` | - | select | `none` | Shadow |
| `shadowColor` | - | color | `#00000055` | Shadow colour |
| `shadowX` | - | number | 0 | Shadow X |
| `shadowY` | - | number | 0 | Shadow Y |
| `shadowBlur` | - | number | 10 | Shadow blur |
| `imgpos` | - | select | `center` | Image position |
| `fitText` | - | boolean | false | Shrink text to fit |
| `path` | - | text | `""` |  |
| `stroke` | - | color | `""` | Stroke |
| `strokeW` | - | number | 0 | Stroke width |
| `fillRule` | - | select | `nonzero` | Fill rule |
| `start` | - | number | `""` | Start (s) |
| `dur` | - | number | `""` | Duration (s) |
| `clipIn` | - | number | 0 | Trim in (s) |
| `speed` | - | number | 1 | Speed |
| `enter` | - | select | `none` | Animate in |
| `exit` | - | select | `none` | Animate out |
| `enterMs` | - | number | 400 | In duration (ms) |
| `exitMs` | - | number | 400 | Out duration (ms) |
| `mute` | - | boolean | false | Mute audio |
| `lane` | - | select | `""` | Lane |
| `strokeDash` | - | select | `""` | Stroke style |
| `strokeCap` | - | select | `round` | Line ends |
| `strokeJoin` | - | select | `round` | Corners |
| `grad` | - | text | `""` | Gradient |
| `blur` | - | number | 0 | Blur |
| `strokeDashLen` | - | number | 0 | Dash length |
| `strokeGapLen` | - | number | 0 | Gap length |
| `bgBlur` | - | number | 0 | Backdrop blur |
| `enterEase` | - | text | `""` | In easing |
| `exitEase` | - | text | `""` | Out easing |
| `frame` | - | text | `""` | Artboard |
| `order` | - | number | 0 | Order |
| `clipChildren` | - | boolean | true | Clip children |
| `headStart` | - | select | `none` | Path start |
| `headEnd` | - | select | `none` | Path end |
| `strokeDashArray` | - | text | `""` | Dash array |
| `dashFit` | - | boolean | false | Fit dashes to corners |
| `bindStart` | - | text | `""` | Start attached to |
| `bindEnd` | - | text | `""` | End attached to |
| `route` | - | select | `""` | Route |
| `z` | - | number | 0 | Depth |
| `kf` | - | text | `""` | Keyframes |
| `linkOf` | - | text | `""` | Linked to |
| `presentAudio` | - | boolean | false | Play sound when presenting |
| `build` | - | number | `""` | Build step |
| `state` | - | text | `""` | Frame state |
| `matchOf` | - | text | `""` | Morph match key |
| `notes` | - | text | `""` | Speaker notes |
| `flipH` | - | boolean | false | Flip horizontal |
| `flipV` | - | boolean | false | Flip vertical |
| `cls` | - | text | `""` | CSS class |
| `gain` | - | number | 1 | Volume |
| `name` | - | text | `""` | Clip name |
| `ignored` | - | boolean | false | Skip on playback |
| `split` | - | select | `""` | Animate text by |
| `stagger` | - | number | 60 | Text stagger (ms) |
| `splitOrder` | - | select | `""` | Text order |
| `hold` | - | select | `""` | While on screen |
| `holdRate` | - | number | 1 | Hold speed (cycles/sec) |
| `rx` | - | number | `""` | Tilt X |
| `ry` | - | number | `""` | Tilt Y |
| `pan` | - | number | `""` | Pan |
| `duck` | - | number | `""` | Under other audio |
| `pitch` | - | number | `""` | Pitch |
| `varispeed` | - | boolean | `""` | Pitch follows speed |
| `fx` | - | text | `""` | Audio effect |
| `stackOf` | - | text | `""` | Stacks under |
| `hidden` | - | boolean | false | Hidden |
| `locked` | - | boolean | false | Locked |
| `slideTransition` | - | select | `""` | Transition to next |
| `plainText` | - | boolean | false | Plain text |
<!-- /GEN:design-boxes -->
