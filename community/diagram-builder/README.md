# Diagrams

New diagrams start in Minimal. Editorial adds focal emphasis, Soft depth raises the cards, Flow adds colour transitions, and Studio combines these with shallow highlights. All five use the current design system. Legacy preserves the previous layout and appearance for existing links and saved diagrams.

Choose connection shape independently of direction markers. Rounded elbows can be headless or directed. The new open head has a 90-degree included angle, wings at 45 degrees to the shaft, rounded tips and a rounded join. Automatic sizing follows line weight. Ribbons have constant width and do not encode quantities.

## Editing the diagram

Start with the content controls, then choose Style, Arrow defaults or Layout. Advanced holds reference IDs and named gradient tokens. Controls follow the source and diagram type: fixed-position sources keep their authored geometry, and card-only settings stay out of Gantt and pyramid controls.

Click a card, connection or group band to open its settings in the left panel. Imported objects open their source editor. Right-click (including a trackpad secondary click) opens that object's settings menu; touch and hold does the same on a touch screen. Enter opens the focused object's sidebar control, and Shift+F10 opens its menu. Menu changes use the same input model, undo and save path as the sidebar.

Use **Focal emphasis** for the leading card, or set **Emphasis** on an individual visual card. Studio exposes **Surface highlight**. Card depth and line depth can be adjusted independently, and gradient options appear when the connection paint uses a gradient. **Cards per row** wraps a layer diagram without shrinking its labels. Disconnected process flows retain their own alignment.

Blank global colours inherit from the design system. Explicit card, line and imported colours remain authored overrides. Clear a global connector colour to allow the selected brand gradient. Imported colours can also be deliberately replaced using **Use design system**. Corner radius can remain linked to the design system or use a custom value. **Reset look** restores the coordinated defaults without changing the diagram's content.

Fonts, semantic colours, spacing, radius, gradient stops and a recognised card shadow are resolved at render time. Incomplete systems use neutral fallbacks. A sole gradient token is automatic; multiple gradients require a token path. For shadows, `shadow.card`, `shadow.medium`, or a sole shadow token supplies bounded offset, blur and colour. Functional labels are measured through the text bridge. Missing glyphs, fixed source boxes that cannot fit their text, and routes that cannot clear nearby cards produce visible notices.

## Diagram types

Choose the type that shows the relationship the reader needs. Each type reads particular card fields and ignores the others, so switching type keeps the content. The table is the contract for each type: what it means, what it reads and what it does not claim.

| Type | Shows | Reads | Direction | Not for |
| --- | --- | --- | --- | --- |
| `org` | A hierarchy of reporting lines | Each card's Reports to; extra connections | Down or right; siblings share one trunk | Ownership across a process |
| `mindmap` | Ideas branching from a centre | Each card's Reports to | Balanced on both sides, or to the right | Ordered or ranked steps |
| `layercake` | Levels of abstraction, one band per level | Each card's Group, bands in group order; connections | Bands stack top to bottom | Owner lanes or time |
| `kanban` | Work items by state | Each card's Group as its column, cards in order | Columns left to right | Owner lanes: a column is a state, not a team |
| `process` | Directed steps, branches and return links | Connections, which set the ranks | Down or right; a return link keeps its direction | Messages between participants over time |
| `timeline` | Events in order | Card order; a detail line can hold a date as text | Right or down, evenly spaced | Durations or a date scale |
| `cycle` | A loop that repeats | Card order; the last card leads back to the first | Clockwise from the top | A process with an exit |
| `pyramid` | Ranked stages or a narrowing funnel | Card order from top to base | Pyramid, funnel or inverted | Quantities: tier widths are fixed steps |
| `matrix` | Items sorted into four categories | Each card's Quadrant; text mode can also place a card at a relative position | The axis labels you supply | Measured values on a scale |
| `gantt` | Task durations and, with dates, a roadmap | Start and length, or start and end dates; Milestone; Group as a lane once dated | Time runs left to right | Owner swimlanes |

The pairs that are easy to confuse:

- **Timeline and Gantt.** A timeline spaces events evenly in the order given. Distance on a timeline does not measure time. Gantt bars have a length. One dated card turns Gantt into a dated roadmap with real ticks, a lane per Group and an optional today marker; end dates are inclusive and a milestone is a point on its start date.
- **State columns and owner lanes.** Kanban columns are states. Layercake bands are levels of abstraction. Neither type assigns an owner, and a dated Gantt lane groups tasks without making the lane their owner. No swimlane type exists yet.
- **Matrix and Chart.** Matrix quadrants are categories. A relative position from text mode places a card inside the square but draws no scale and no values. Quantities belong in the Chart tool.
- **Ribbons and flows.** A ribbon connection has a constant width. Ribbon width never encodes an amount.

Imported sources choose their own type. A Mermaid flowchart and a DOT graph become `process`, or `layercake` when they declare subgraphs or clusters. A Mermaid `sequenceDiagram` becomes a left-to-right `process`: participants become cards in their declared order, and messages between the same two participants in the same direction merge into one connection whose label numbers each message in source order. Notes and blocks such as `loop` are skipped and logged. ASCII and Pikchr keep their drawn positions and use no type.

## Sources and layout

All existing source modes and diagram types remain supported. Imported direction and explicit arrowheads retain their meaning. ASCII and Pikchr retain authored positions. Process ranks handle strongly connected components and return links. Org charts draw shared trunks once; mind maps balance subtree footprints. Dated Gantt keeps its existing time geometry.

Modern rendering admits up to 300 cards and 900 connections. Labels/details are bounded to 1600 characters and 12 displayed lines, with an overflow notice. Routes use at most 24 nearby corridors per axis plus outer alternatives; curves use bounded sampling. These are deliberate geometry budgets, not a machine-speed-dependent change of look.

## Export behaviour

| Format | Behaviour |
| --- | --- |
| SVG | Vector cards, paths and text; sampled vector colour transitions and shadow bands |
| PNG, JPG, WebP, AVIF | Raster artwork at the requested output dimensions |
| PDF, PDF-CMYK | Vector geometry and outlined text through the current web export path |
| Penpot | Individual editable path/text objects where supported by the existing importer; no native graph semantics |
| PPTX | Placed artwork, not native editable diagram connectors; experimental exports retain their DRAFT mark |
| EMF | Outlined round geometry; alpha is flattened against the export background |
| DXF | Technical path geometry; presentation fills, gradients and soft depth do not retain their appearance |

Use SVG, PNG or PDF when material appearance matters. A transparent diagram still needs a suitable backing surface for text and thin connections. The exporter cannot infer the colour of a document into which it will later be placed.

## Maintenance

The original renderer and parsers remain in `hooks.js`. Modern appearance, text, routing and paint live in `source/*.js`. The source exports identify reusable functions for linting; the generator strips those declarations and appends the helpers as one self-contained tool-data script. No runtime import or extra network request is required.

After editing a helper:

```sh
pnpm run build:diagram-hooks
node scripts/build-diagram-hooks.ts --check
node --test tests/diagram-builder-visual.test.ts tests/diagram-builder-import.test.ts tests/diagram-builder-gantt.test.ts tests/diagram-builder-fixtures.test.ts
```

The assembly test rejects stale generated code. `tests/fixtures/diagram-builder` holds six recorded diagrams: a branch with a return link, a dense architecture overview, a dated roadmap, repeated sequence messages, long multilingual labels and a sparse historical link. The fixture test checks that each keeps its ids, labels, directed connections, groups and layout direction through parsing, rendering, a written link and a saved session. Add a fixture when a change alters what a source means. Changes to block field order must remain append-only and update `schemas/blocks-wire-order.json`. After manifest/template changes, rebuild and validate all mounted catalogs.

A fresh mount is distinguished by the input model's supplied-value flags. Fresh mounts seed Minimal; supplied historical inputs without `look` retain Legacy. New templates and saved modern documents carry `look`. Recipes seed unspecified controls on initial load; subsequent custom changes persist. Changing Look reapplies its geometric recipe while keeping authored colours; Reset look also clears global colour overrides.

The document-model figures are generated with `node scripts/build-spec-diagrams.ts`. The same inputs produce the SVGs and their editable docs links. Each file carries Content Credentials covering the artwork and embedded recipe. Unchanged artwork retains its signature; `--check` verifies the file binding and compares the source render. The docs footer opens the verifier or restores the figure in Diagram Builder using the current brand.
