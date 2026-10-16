# Diagrams: choose, build, check and hand over

Read this before making, importing or recreating a diagram. The Diagrams tool
(`diagram-builder`) lays out cards and connections from cards, text, ASCII art,
Mermaid, DOT, Pikchr or a table. Chart (`reference/chart.md`) draws quantities.
Design (`reference/design.md`) composes what Diagrams cannot represent, by stable
layer ID. For a requested brand, read `reference/design-system.md` first; a
neutral diagram needs no setup.

Sections marked "generated" come from the tool's manifest and look recipes, written
by `scripts/gen-agent-skill.ts`. They describe the tool version this skill was
built with. `lolly describe diagram-builder --all` or `lolly_describe_tool`
describes the installed version, and the installed version wins.

## Where Diagrams runs

<!-- SHARE:diagram-route -->
Diagrams is an experimental tool. The public render route (`GET /tool/<id>.<ext>`)
serves official and community tools only, so it answers 404 for Diagrams. Render
through the CLI (`lolly run diagram-builder`), an MCP server (`lolly_render`) or an
interactive instance. `lolly_build_url` returns an editable link and a raw render
URL: hand over the editable link and the exported file, and never publish the raw
render URL for this tool.

`lolly describe diagram-builder --json` reports `watermarked: true`. The web
shell's export path draws a visible DRAFT mark: the app, and CLI formats that need
the browser tier. A browser-free CLI export, such as SVG or a plain PNG, has no
visible mark. Look at the delivered file, report whether a mark is present, and
never remove one to make a draft look final.
<!-- /SHARE:diagram-route -->

## Choose by meaning

<!-- SHARE:diagram-choose -->
Start from the reader's question, not from the tool. Choose the pattern when
behaviour matters, then the layout. A diagram is optional: a table or a paragraph
can answer a comparison that has no links.

| Explanation | Route | Keep true |
|---|---|---|
| Reporting lines or a parent and child hierarchy | Diagrams `org` or `mindmap` | Stable IDs and parent references |
| Components by abstraction layer | Diagrams `layercake` | Bands are abstraction levels, not decoration |
| Decisions, directed steps or dependency paths | Diagrams `process`, from any source with edges | Branch labels, direction and return links |
| Events in time or dated work | Diagrams `timeline` or `gantt` | No invented dates or durations |
| State columns or a two-axis grouping | Diagrams `kanban` or `matrix` | A category matrix is not a numeric heatmap |
| A reinforcing loop or a ranked funnel | Diagrams `cycle` or `pyramid` | Keep the feedback; imply no conversion figures |
| Quantities: comparison, distribution or flow | Chart, from a valid chart spec | Values live in the data; diagram ribbons have constant width and carry no amounts |
| Messages between actors in order | A Mermaid `sequenceDiagram` gives a flattened overview, reported as such; Design for explicit lifelines | Diagrams has no native sequence type |
| Ownership handoffs, service visibility or guarded states | Design, with lanes or states drawn as named layers | Diagrams has no native swimlane, service blueprint or state machine |
| Attributes compared with no meaningful links | A table or prose | A drawing is not required |

Six patterns cover most explanations. Use one when behaviour matters; a source
that matches none can go straight to a type.

| Pattern | What the reader learns | Route |
|---|---|---|
| Ownership | Who holds or answers for each part | `org` for reporting; `layercake` or `kanban` groups for parts; Design for handoffs between owners |
| Stage progression | The order work passes through | `process` with a set flow direction, or `timeline` |
| Feedback | An output that returns as an input | `cycle`, or a labelled return connection in `process` |
| Bottleneck | The step that limits the flow | `process` with `emphasis` `accent` on that card; a label is not a measured queue |
| Trust boundary | What is inside and outside a zone | `layercake` bands or Mermaid subgraphs as zones, with labelled connections across them |
| Lifecycle | The states one thing moves through | `cycle` when the states repeat, `process` when they end; Design when transitions have guards |

Infer the audience and destination from the request. Otherwise state your
assumptions about format, displayed size, level of detail and audience. Ask only
when a missing choice changes the meaning or the delivery.
<!-- /SHARE:diagram-choose -->

## Sources

Set `source`, then fill that source's content input. The other sources keep their
sample defaults, which travel in a link but are not drawn. A source left at its own
default draws the sample, so always supply the content you mean.

Generated:

<!-- GEN:diagram-sources -->
| `source` | Label | Content input | Files | Layout | Default content |
|---|---|---|---|---|---|
| `visual` | Visual editor | `nodes`, `arrows`, `layers` | - | The chosen `diagramType` | Sample content in `nodes`, `layers` |
| `text` | Text (type it) | `dsl` | `.txt` | The chosen `diagramType` | Sample content in `dsl` |
| `ascii` | ASCII art (draw it) | `asciiArt` | `.txt` | Keeps the drawn positions | Sample content in `asciiArt` |
| `mermaid` | Mermaid (paste it) | `mermaid` | `.mmd`, `.mermaid`, `.txt` | `process`, or `layercake` when there are subgraphs; a `sequenceDiagram` becomes `process` | Sample content in `mermaid` |
| `dot` | DOT / Graphviz (paste it) | `dot` | `.dot`, `.gv`, `.txt` | `process`, or `layercake` when there are clusters | Sample content in `dot` |
| `pikchr` | Pikchr (paste it) | `pikchr` | `.pikchr`, `.txt` | Keeps the positions the Pikchr layout computes | Sample content in `pikchr` |
| `table` | Table / CSV (paste it) | `table` | `.csv`, `.tsv`, `.txt`, `.xlsx` | The chosen `diagramType` | Sample content in `table` |
<!-- /GEN:diagram-sources -->

Each text source reads a subset of its language. The manifest help states that
subset (generated):

<!-- GEN:diagram-source-syntax -->
- `visual`, `nodes`: One card per row. In org / mind map, drag a card onto another to nest it - drop above or below to make it a sibling, or onto the middle to make it a child. Elsewhere, drag to reorder (order sets sibling order, layer/column order, and the sequence for timeline/cycle/pyramid/gantt). The ID is an optional short handle.
- `visual`, `arrows`: Connect cards or groups by name. Leave colour, head and route at their defaults to follow the look. Click a connection on the canvas to edit this row.
- `visual`, `layers`: Each band of the layercake, stacked in this order. Cards reference a band by its ID. (Kanban columns are created automatically from each card's Group ID.)
- `text`, `dsl`: Org/Mind map: indent for hierarchy. Layercake/Kanban: “# Group” headings with cards below. Process/Gantt: “A -> B” (Gantt adds “ : 0..3”). Timeline/Cycle/Pyramid: one item per line, in order. Matrix: “# top-right” sections or “Item @ (0.8,0.3)”. Shared: “:: subtitle”, “#hex” fill, “(Rounded)”/“[Box]”/“([Pill])” shape, “@ https://…/logo.png” image, edge styles --> -.-> ==> <->, “// comment”.
- `ascii`, `asciiArt`: Draw boxes with + - | and connect them with - | and arrowheads > < ^ v. Keep each box's | sides lined up with its +---+ borders. The first line inside a box is its title, the rest its subtitle, and a line of “@ https://…/logo.png” adds an image. Your layout is preserved - we just render it as clean cards.
- `mermaid`, `mermaid`: Paste a Mermaid flowchart or sequenceDiagram subset, or drop a .mmd file. Flowchart: “graph/flowchart TD/LR/BT/RL” sets direction; A[Box], A(Rounded), A([Pill]), A{Diamond} define nodes; A-->B, A---B, A-.->B, A==>B, A-->|label|B, A -- label --> B are edges; chains A-->B-->C and fan-outs A --> B & C work; subgraph Name … end becomes layer bands (nested ones fold into the outermost). Sequence: participants become cards left to right and each message an arrow, so lifelines and timing are approximated, not drawn. Unsupported lines (classDef, click, style, notes, loop/alt…) are skipped, never run.
- `dot`, `dot`: Paste a Graphviz digraph, or drop a .dot file. “digraph { a -> b }” for directed, “graph { a -- b }” for plain lines; rankdir=LR/TB/RL/BT sets direction; node attributes [label="…", shape=box|ellipse|circle|diamond|cylinder|hexagon|note|plaintext, fillcolor="#hex"] and edge attributes [label="…", style=dashed|dotted|bold, dir=both|none, arrowhead=…] are read; “subgraph cluster_x { label="…" }” becomes a layer band; “node [shape=…]” sets defaults. Node lists (a, b -> c) and chains (a -> b -> c) expand. Anything else is skipped, never run.
- `pikchr`, `pikchr`: Paste a PIC-style Pikchr diagram. Objects flow in a direction: box/circle/ellipse/oval/cylinder/file/dot/line/arrow/move, each with "labels", fill/color, dashed/dotted/thick, wid/ht/rad. Place with from/to/at, compass points (last box.s, .n .e .w .ne …), named objects (Name: box) and ->/<-/<->. Supported subset - macros, [blocks], expressions and splines are skipped, never run.
- `table`, `table`: Paste comma- or tab-separated rows, or drop a CSV. Org/Mind map: id,label,detail,parent. Process: from,to,label (an edge list - ids are created automatically). Timeline/Cycle/Pyramid: label,detail. A header row (id/label/from/…) is detected and skipped.
<!-- /GEN:diagram-source-syntax -->

What the help leaves out:

- `diagramType` applies to `visual`, `text` and `table` only. Mermaid and DOT
  choose `process`, or `layercake` when the source groups nodes; a nested subgraph
  folds into the outermost band.
- A Mermaid `sequenceDiagram` becomes a `process` diagram flowing right: one card
  per participant and one arrow per pair and direction, labelled with the numbered
  messages it carries (`1. Request · 3. Retry`). Replies (`-->>`) are dashed.
  Lifelines, activation, timing, notes and `alt`, `opt` or `loop` blocks are not
  drawn; messages inside a block are drawn without the block. Report the result as a
  flattened overview, never as a sequence diagram.
- ASCII and Pikchr keep the authored positions, so layout controls that move cards
  do not apply to them.
- Unsupported lines are skipped and never run. On the CLI, stderr gives a count and
  the first few lines, such as `[info] diagram-builder: 2 mermaid line(s) skipped
  (unsupported): …`. No surface returns a full list yet, so compare the source
  inventory with the render yourself.
- Cards and groups refer to each other by ID. A blank `nodeId` or `layerId` is
  derived from the label, so renaming the label changes the reference. Give every
  card and group an explicit ID, and keep it when the label changes.

## Diagram types

Generated. "Controls for this type" lists controls that appear for four types or
fewer.

<!-- GEN:diagram-types -->
| `diagramType` | Label | Structure comes from | Controls for this type |
|---|---|---|---|
| `org` | Org chart (hierarchy) | Each card's `parent` | `nodes.parent`, `connectorWidth`, `orgDir` |
| `mindmap` | Mind map | Each card's `parent` | `nodes.parent`, `connectorWidth`, `mindmapStyle`, `branchColors` |
| `layercake` | Layercake (layered architecture) | Each card's `layer`, bands in `layers` order | `nodes.layer`, `layers`, `layerColumns` |
| `kanban` | Kanban / columns | Each card's `layer`, one column per group | `nodes.layer`, `layers`, `kanbanCount` |
| `process` | Process (flowchart) | Connections (`arrows`, or the source's edges) | `flowDir` |
| `timeline` | Timeline | Card order | `connectorWidth`, `timelineDir` |
| `cycle` | Cycle (loop) | Card order, closing back to the first card | `connectorWidth`, `cycleArrows`, `cycleCurved` |
| `pyramid` | Pyramid / funnel | Card order, top to bottom | `pyramidStyle` |
| `matrix` | Matrix (2×2 quadrant) | Each card's `quadrant`, with the four axis labels | `nodes.quadrant`, `matrixXHigh`, `matrixXLow`, `matrixYHigh`, `matrixYLow` |
| `gantt` | Gantt / roadmap | Each card's dates, or `ganttStart` and `ganttLen` | `nodes.layer`, `nodes.ganttStart`, `nodes.ganttLen`, `nodes.startDate`, `nodes.endDate`, `nodes.milestone`, `layers`, `ganttGrid`, `ganttUnit`, `ganttScale`, `ganttToday` |
<!-- /GEN:diagram-types -->

## Looks and defaults

<!-- SHARE:diagram-look-rule -->
Set `look` every time. The manifest default is `legacy`, and what you get depends
on what you supply:

- A fresh interactive mount with no supplied values starts in `minimal`.
- Supplied inputs without `look` render in Legacy, the earlier appearance kept for
  existing links and saved diagrams. A CLI, MCP or link render with any input but
  no `look` is Legacy.
- A supplied modern look (any value but `legacy`) fills every control you did not
  supply from its recipe. It also blanks the global colours (`nodeFill`,
  `nodeStroke`, `nodeText`, `edgeColor`, `background`) and the group band fills
  so that they follow the design system. Values you supply win.
- Changing `look` in the app reapplies its recipe and keeps authored colours;
  `resetLook` also clears global colour overrides. Cards and text stay.

The root `<svg>` of an export carries `data-diagram-look` for a modern look and no
such attribute for Legacy, a quick check of what was drawn.
<!-- /SHARE:diagram-look-rule -->

Looks (generated):

<!-- GEN:diagram-looks -->
| `look` | Label | Recipe |
|---|---|---|
| `minimal` | Minimal | The base recipe |
| `editorial` | Editorial | Minimal with `cornerRadius` `5`, `focalEmphasis` `first` |
| `soft` | Soft depth | Minimal with `cardDepth` `1` |
| `flow` | Flow | Minimal with `connectionRoute` `curve`, `connectionPaint` `gradient`, `cardDepth` `0.5` |
| `studio` | Studio | Minimal with `connectionRoute` `curve`, `connectionPaint` `gradient`, `cardDepth` `1.5`, `lineDepth` `0.5`, `focalEmphasis` `first`, `surfaceHighlight` `1` |
| `legacy` | Legacy | No recipe: the manifest defaults, plus the Legacy-only controls |
<!-- /GEN:diagram-looks -->

Legacy and Minimal defaults (generated):

<!-- GEN:diagram-defaults -->
Manifest default for `look`: `legacy`.

| Control | Manifest default (Legacy) | Minimal recipe |
|---|---|---|
| `cardWidth` | `196` | `208` |
| `rowGap` | `56` | `76` |
| `siblingGap` | `30` | `32` |
| `cornerRadius` | `14` | `12` |
| `radiusMode` | `custom` | `design` |
| `labelSize` | `10` | `16` |
| `labelWeight` | `500` | `600` |
| `cardBorderWidth` | `2` | `1` |
| `connectorWidth` | `2.6` | `1.75` |
| `arrowWidth` | `2` | `1.75` |
| `arrowHead` | `triangle` | `open` |
| `gridBg` | `dots` | `none` |
| `nodeFill` | `{color.semantic.surface}` | blank (follows the design system) |
| `nodeStroke` | `{color.semantic.primary}` | blank (follows the design system) |
| `nodeText` | `{color.semantic.text}` | blank (follows the design system) |
| `edgeColor` | `{color.semantic.primary}` | blank (follows the design system) |
| `background` | `{color.semantic.surface}` | blank (follows the design system) |

Same value in both: `cardScale`, `canvasPadding`, `arrowHeadSizing`, `theme`, `connectionRoute`, `connectionPaint`, `connectionForm`, `bendRadius`, `cardDepth`, `lineDepth`, `directionMarkers`, `focalEmphasis`, `surfaceHighlight`.
<!-- /GEN:diagram-defaults -->

Controls that apply to some looks only (generated):

<!-- GEN:diagram-look-controls -->
- Legacy only: `diagramPreset`, `theme`, `density`, `branchColors`.
- Every modern look: `nodes.emphasis`, `arrows.route`, `colourMode`, `focalEmphasis`, `cardDepth`, `radiusMode`, `importColours`, `resetLook`, `connectionRoute`, `bendRadius`, `directionMarkers`, `arrowHeadSizing`, `connectionPaint`, `gradientFrom`, `gradientTo`, `connectionForm`, `lineDepth`, `layerColumns`, `gradientToken`.
- Only `studio`: `surfaceHighlight`.
<!-- /GEN:diagram-look-controls -->

## Card, connection and group fields

These are the rows of the `visual` source. Row order carries meaning: it sets
sibling order, band and column order, and the sequence for `timeline`, `cycle`,
`pyramid` and `gantt`. A reference field takes an ID, not a label. Leave a
connection's colour, head and route at their defaults to follow the look.

Cards, `nodes` (generated):

<!-- GEN:diagram-card-fields -->
| Field | Type | Default | What it does | Allowed values | Shown in the editor when |
|---|---|---|---|---|---|
| `shape` | select | `rounded` | Shape | `box`, `rounded`, `pill`, `circle`, `ellipse`, `cylinder`, `file`, `diamond`, `hexagon` | always |
| `label` | text | - | Label | - | always |
| `fill` | color | blank | Card colour: Overrides the global card fill for this card only. | - | always |
| `image` | asset | - | Image: Optional headshot, icon, or product logo shown on the card. | - | any type but `pyramid`, `gantt` |
| `nodeId` | text | - | ID: Short unique handle. | - | `showIds` `true` |
| `detail` | text | - | Detail | - | always |
| `parent` | reference | blank | Reports to: Org / mind map: the card this one reports to / branches from. | a `nodeId` from `nodes` | `diagramType` `org` or `mindmap` |
| `layer` | reference | blank | Group: Layercake: which band. | a `layerId` from `layers`, or a new name | `diagramType` `layercake` or `kanban` or `gantt` |
| `quadrant` | select | `tr` | Quadrant | `tr`, `tl`, `br`, `bl` | `diagramType` `matrix` |
| `ganttStart` | number | - | Start: Bar start on the time axis. | - | `diagramType` `gantt` |
| `ganttLen` | number | - | Length: Bar length in the same units. | - | `diagramType` `gantt` |
| `startDate` | text | - | Start date: yyyy-mm-dd. | - | `diagramType` `gantt` |
| `endDate` | text | - | End date: yyyy-mm-dd, inclusive. | - | `diagramType` `gantt` |
| `milestone` | boolean | `false` | Milestone: Draw a diamond on the start date instead of a bar. | - | `diagramType` `gantt` |
| `emphasis` | select | `auto` | Emphasis | `auto`, `accent`, `quiet` | a modern look and any type but `pyramid`, `gantt` |
<!-- /GEN:diagram-card-fields -->

Connections, `arrows` (generated):

<!-- GEN:diagram-connection-fields -->
| Field | Type | Default | What it does | Allowed values | Shown in the editor when |
|---|---|---|---|---|---|
| `from` | reference | blank | From | a `nodeId` from `nodes` or a `layerId` from `layers` | always |
| `to` | reference | blank | To | a `nodeId` from `nodes` or a `layerId` from `layers` | always |
| `label` | text | - | Label | - | always |
| `style` | select | blank | Line | `""`, `solid`, `dashed`, `dotted` | always |
| `head` | select | blank | Arrowhead | `""`, `triangle`, `open`, `diamond`, `circle`, `bar`, `double`, `none` | always |
| `width` | number | `0` | Width: 0 = use the global arrow width. | - | always |
| `color` | color | blank | Colour: Leave empty to inherit the connection colour. | - | always |
| `route` | select | `auto` | Route | `auto`, `straight`, `elbow`, `curve` | a modern look |
<!-- /GEN:diagram-connection-fields -->

Groups, `layers` (generated):

<!-- GEN:diagram-group-fields -->
| Field | Type | Default | What it does | Allowed values | Shown in the editor when |
|---|---|---|---|---|---|
| `kind` | select | `layer` | Kind | `layer` | always |
| `layerId` | text | - | ID | - | `showIds` `true` |
| `label` | text | - | Label | - | always |
| `bandFill` | color | blank | Band colour | - | always |
<!-- /GEN:diagram-group-fields -->

## Design system

Read the effective system before choosing colours or type
(`reference/design-system.md`). The modern looks resolve these at render time: the
font (`font.brand`, `font.mono`, `typography.body`), the semantic colours
(`color.semantic.surface`, `text`, `primary`, `secondary`, `muted` and `edge`),
`space.base`, `shape.radius`, gradient tokens, and a card shadow (`shadow.card`,
`shadow.medium` or a sole shadow token). A missing token falls back to a neutral
value without a notice, so check colours and type in the render. `colourMode`
`light` or `dark` picks the system's theme of that name, or adjusts a neutral
surface when the system has none.

Blank global colours follow the system. Explicit card, connection and imported
colours stay as authored. `importColours` `brand` replaces imported source colours
with system colours; keep `preserve` unless the request asks for restyling. A
single gradient token is used automatically; with several, set `gradientToken`.

## Exports

Generated:

<!-- GEN:diagram-exports -->
Declared formats, in manifest order. The render frame is 1600 × 1000 px.

| Format | Without a browser on the CLI | What the file holds |
|---|---|---|
| `svg` | Yes | Vector cards, paths and text; colour transitions and shadows drawn as sampled vector bands |
| `penpot` | Yes | Separate editable paths and text where the importer supports them; no connector or diagram semantics |
| `pdf` | No: browser tier | Vector geometry and outlined text |
| `dxf` | Yes | Technical path geometry; fills, gradients and depth are not kept |
| `png` | Yes, for a plain PNG (no bleed, marks or durable credential) | Raster artwork at the export size |
| `jpg` | No: browser tier | Raster artwork at the export size, no transparency |
| `webp` | No: browser tier | Raster artwork at the export size |
| `avif` | No: browser tier | Raster artwork at the export size |
| `emf` | Yes | Outlined geometry; transparency flattened against the export background |
| `pdf-cmyk` | No: browser tier | Vector geometry and outlined text, converted to CMYK |
| `pptx` | No: browser tier | The diagram placed as artwork; no native editable shapes or connectors |
<!-- /GEN:diagram-exports -->

<!-- SHARE:diagram-export-checks -->
Check the export the person asked for, separately from the preview. Each of these
is its own fact:

- Size. An SVG takes the diagram's own size. A PNG draws the diagram into the
  render frame, or `width` by `height`, and fits it with margins. Set the frame to
  the diagram's proportions when the margins matter.
- Fonts. A requested family is not proof that the font resolved. Look at a render,
  and read the CLI's `[warn]` lines about missing characters.
- Vector or raster, and what a person can edit. A Design or Penpot object a person
  can edit is not the same as an SVG or picture placed on a PowerPoint slide. A
  PPTX from Diagrams holds the diagram as artwork, not as native shapes or
  connectors.
- Accessible names. A CLI SVG export carries the tool name in `<title>` and a
  credit line in `<desc>`, not the diagram's title. Read the file before claiming
  an accessible name, and add one where the destination needs a name.
- Draft mark. See "Where Diagrams runs".

Report the format, the size, vector or raster, what a person can edit, and
anything you could not check.
<!-- /SHARE:diagram-export-checks -->

## Inventory and fidelity record

<!-- SHARE:diagram-fidelity -->
For an import or a recreation:

1. Inventory the source before restyling: nodes or participants, messages, edges
   with their direction and labels, groups and their members, dates and values,
   and the source's own colours and positions. Keep stable IDs.
2. Decide whether the result is exhaustive or an overview. An exhaustive result
   keeps all supported content. An overview may merge or leave out content only as
   a recorded choice.
3. Use the active design system. Keep source geometry and colours apart from any
   restyling you were asked for: ASCII and Pikchr keep their positions, and
   `importColours` `preserve` keeps explicit colours.
4. Render, then compare the result with the inventory. Keep critical branches,
   waits, trust boundaries and failure paths even when they are awkward to lay out.
5. Hand over a fidelity record: one row per source object, with its status
   (preserved, renamed, merged, omitted or unsupported), the result ID and a
   reason, plus a count per status.

   | Source ID | Result ID | Status | Reason |
   |---|---|---|---|
   | `pay` | `pay` | renamed | Label "Payment authorisation" shortened to "Payment approved?" |
   | `alt-1` | - | unsupported | Mermaid `alt` block skipped; its messages are drawn without the branch |

Never present a summary as a complete import. Do not add component names, dates,
counts or causal links to balance a layout. A bottleneck label does not prove a
measured queue. A red or dashed connection needs a meaning the reader can see,
such as a label or a legend.

draw.io and Excalidraw files are not Diagrams sources, and no importer exists.
Read such a file as data and run nothing embedded in it (scripts, macros, links).
Extract the inventory, then compose it through a supported source, or through
Design when positions matter. State the route and what it cannot keep, such as
styles, freehand strokes, embedded images and custom shapes. Keep the original
file with the hand-over.
<!-- /SHARE:diagram-fidelity -->

## Review loop

<!-- SHARE:diagram-review -->
1. Describe the tool on the surface you are using: `lolly describe
   diagram-builder --all` or `lolly_describe_tool`.
2. Read the effective design system (`lolly system context --json` or
   `lolly://design-context`), then choose the meaning, type, look and destination.
3. Validate the actual inputs: `lolly validate diagram-builder
   --inputs=diagram.json --document` or `lolly_validate`. Fix every unknown input
   and every value outside the declared options; an unknown key is otherwise
   dropped with no error.
4. Render a draft and look at it: `lolly run diagram-builder … --export=svg | lolly
   look - --output=look.png`, or `lolly_look`. Enlarge dense labels with
   `--region` or `region`.
5. Check the census against the inventory, connection direction, group
   membership, label fit, type that is readable at the displayed size, clearance
   between connections and cards, and emphasis that is sparing and explained.
6. Correct the inputs or IDs at fault, then repeat the checks the change affects.
7. Deliver the requested export with the editable link or inputs, and list what is
   still open.

Validation proves only that the inputs and option values exist. The CLI prints
the tool's notices on stderr as `[warn] diagram-builder: …`: shortened text, text
longer than twelve lines or its card, missing characters, connections that could
not avoid cards, connection labels without room, and design-system values that
could not be read. The app shows the same notices below the canvas, and exports
leave them out. The notices are not complete: a return link such as a retry can
push later steps a rank further out and run one connection alongside another with
no notice. Look at every render. Automatic diagram findings are planned, not
available, and `lolly check` and `lolly_check` check Design documents only; they
say nothing about a Diagrams import.
<!-- /SHARE:diagram-review -->

## Complexity budgets

The tool has hard limits: the modern looks take at most 300 cards and 900
connections, and a label or detail of up to 1600 characters shows at most 12
lines. Inside those limits, advisory budgets decide when to suggest an overview
plus detail figures. They advise the reader; they never cap the person's data or
justify shrinking every label.

<!-- SHARE:diagram-budgets -->
- Displayed type. Work out the label size the reader sees: `labelSize` times
  `cardScale` times the scale of the placed diagram (displayed width divided by
  the SVG's own width). As a starting point, below about 12 px on a screen or 8 pt
  in print, propose an overview plus detail, or a larger destination, rather than
  smaller type.
- Crossings and detours. When connections must cross each other or detour round
  cards to show the relationships, split by group or by stage.
- One question per figure. When the reader's question concerns one part, show
  that part in detail and the rest as context.
- Keep everything. An overview lists what each detail figure holds, and the
  fidelity record accounts for every source object across the set.
<!-- /SHARE:diagram-budgets -->

## Hand over

<!-- SHARE:diagram-handover -->
Return:

- the requested export, checked as above;
- the editable link or the inputs JSON with `look` set, never a raw render URL;
- for an import or recreation, the fidelity record;
- the assumptions you made about audience, destination and size;
- the checks you ran, what they cannot prove, and any notice or defect still open.
<!-- /SHARE:diagram-handover -->

## Worked inputs

Each block below validates against the manifest (`tests/agent-skill.test.ts`
checks them). Save one as `diagram.json` and run `lolly validate diagram-builder
--inputs=diagram.json --document`; give the same object as `inputs` to
`lolly_validate` and `lolly_render`.

A branching process from cards with stable IDs, flowing right:

```json
{
  "look": "minimal",
  "source": "visual",
  "diagramType": "process",
  "flowDir": "right",
  "title": "Order handling",
  "nodes": [
    { "nodeId": "receive", "label": "Receive order" },
    { "nodeId": "check", "label": "Payment approved?" },
    { "nodeId": "ship", "label": "Ship order" },
    { "nodeId": "hold", "label": "Hold order" },
    { "nodeId": "notify", "label": "Email customer" }
  ],
  "arrows": [
    { "from": "receive", "to": "check" },
    { "from": "check", "to": "ship", "label": "Yes" },
    { "from": "check", "to": "hold", "label": "No" },
    { "from": "hold", "to": "notify" }
  ]
}
```

An org chart from a table, with a detail line on one card:

```json
{
  "look": "minimal",
  "source": "table",
  "diagramType": "org",
  "title": "Leadership",
  "table": "id,label,detail,parent\nceo,Chief Executive,,\ncto,Technology,Engineering and IT,ceo\ncfo,Finance,,ceo\nops,Operations,,ceo"
}
```

On the CLI, the same org chart renders from a CSV file with `lolly run
diagram-builder --look=minimal --source=table --diagramType=org --title=Leadership
--table="$(cat org.csv)" --export=svg --output=org.svg`.
