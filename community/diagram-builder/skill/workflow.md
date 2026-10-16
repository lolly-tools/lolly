# Preserve meaning through the diagram workflow

<!-- Each GEN block below is copied from skills/lolly/reference/diagrams.md by
scripts/gen-agent-skill.ts. Edit the reference, then run that script. -->

The overall Lolly skill's `reference/diagrams.md` holds the same guidance, plus
the syntax each text source reads and the card, connection and group fields.

## Where Diagrams runs

<!-- GEN:diagram-route -->
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
<!-- /GEN:diagram-route -->

## Choose by meaning

<!-- GEN:diagram-choose -->
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
<!-- /GEN:diagram-choose -->

## Sources

Set `source`, then fill that source's content input. A source left at its own
default draws the sample, so always supply the content you mean.

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

## Looks and defaults

<!-- GEN:diagram-look-rule -->
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
<!-- /GEN:diagram-look-rule -->

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

## Inventory and fidelity record

<!-- GEN:diagram-fidelity -->
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
<!-- /GEN:diagram-fidelity -->

## Review loop

<!-- GEN:diagram-review -->
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
<!-- /GEN:diagram-review -->

## Complexity budgets

<!-- GEN:diagram-budgets -->
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
<!-- /GEN:diagram-budgets -->

## Exports

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

<!-- GEN:diagram-export-checks -->
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
<!-- /GEN:diagram-export-checks -->

## Hand over

<!-- GEN:diagram-handover -->
Return:

- the requested export, checked as above;
- the editable link or the inputs JSON with `look` set, never a raw render URL;
- for an import or recreation, the fidelity record;
- the assumptions you made about audience, destination and size;
- the checks you ran, what they cannot prove, and any notice or defect still open.
<!-- /GEN:diagram-handover -->

## Live adapters

For an input-model live adapter, read the current input definitions and revision,
submit the advertised input operation, and reread before recomputing a stale edit.
Do not send layer patches to an input adapter or assume that uploaded file bytes
are available through a document invitation.
