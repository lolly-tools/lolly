# 307 - Diagram builder: semantic layouts and readable output

Status: PLANNED. Research and implementation plan only; no product changes made.
Date: 2026-10-13
Scope: `community/diagram-builder`, its tests, and the shared surfaces needed to inspect its results.
Companions: [308 - Standard skill design-system setup](308-standard-lolly-skill-design-system-setup.md), [309 - Standard skill diagram workflows](309-standard-lolly-skill-diagram-workflows.md).

## Outcome

Make a diagram communicate the intended relationship at the intended reading size. Preserve source meaning, choose an appropriate layout, and report problems that an agent or person can correct. Keep diagrams editable through existing inputs, sessions and URL mode.

The first delivery improves the existing layouts and exposes their limitations. Subsequent deliveries add true sequence and swimlane layouts. Broader type coverage follows evidence from real requests, rather than importing an entire upstream gallery.

## Evidence and existing capability

Reviewed Lolly at `ab21e9c3d` and [diagram-design at `0a8ea20a`](https://github.com/cathrynlavery/diagram-design/tree/0a8ea20ae69b33a5edce6018eedd3a9d26e90c1c). The upstream README advertises 44 types while its skill names 45; use the pinned files as design references, not a target type count.

The useful upstream ideas are selecting behavior before layout, limiting emphasis, budgeting complexity for the reader, and reporting import fidelity. Its [selection guidance](https://github.com/cathrynlavery/diagram-design/blob/0a8ea20ae69b33a5edce6018eedd3a9d26e90c1c/skills/diagram-design/SKILL.md), [layout budgets](https://github.com/cathrynlavery/diagram-design/blob/0a8ea20ae69b33a5edce6018eedd3a9d26e90c1c/skills/diagram-design/references/layout-budget.md) and [output specification](https://github.com/cathrynlavery/diagram-design/blob/0a8ea20ae69b33a5edce6018eedd3a9d26e90c1c/skills/diagram-design/references/output-spec.md) provide examples to adapt.

| Area | Current Lolly behavior | Improvement |
|---|---|---|
| Layouts | Ten manifest types: org, mindmap, layercake, kanban, process, timeline, cycle, pyramid, matrix, gantt | Give each a semantic contract; add only types with distinct required geometry |
| Sources | Visual blocks, text, ASCII, Mermaid, DOT, Pikchr, CSV/table | Preserve identities and report unsupported or simplified source features |
| Appearance | Minimal, Editorial, Soft, Flow, Studio, Legacy; modern looks resolve design-system tokens | Improve hierarchy and reading-size behavior within those looks |
| Text | Brand-font measurement when available; wrapping, glyph and overflow notices | Cover actual font fallback chains and expose findings by object ID |
| Routing | Shape-aware ports, obstacle avoidance, rounded paths, tree trunks, cycle handling | Detect crossings, crowded ports and label collisions systematically |
| Sequence input | Mermaid participants become process nodes; repeated messages between the same actors merge | Preserve each message and draw lifelines when sequence mode is selected |
| Diagnostics | Up to six deduplicated text notices, exposed as `ganttWarning` | Retain the existing notice extra and add structured, source-addressable findings |
| Exports | SVG plus raster, PDF, Penpot, PPTX and other formats | State which elements remain vector or editable and verify requested formats |

Read [the tool README](../community/diagram-builder/README.md), [manifest](../community/diagram-builder/tool.json) and [visual tests](../tests/diagram-builder-visual.test.ts) first. The September visual-upgrade and QA investigations in the main checkout describe work already delivered. This plan builds on that work.

## Decisions

1. Keep `diagram-builder` and every existing asset/input ID. New fields are additive. Append block fields so existing compact encodings keep their positions.
2. Preserve sparse historical links and explicitly selected Legacy rendering. New modern behavior must have a deliberate compatibility path and save/reload coverage.
3. Editorial remains a restrained option. Its defaults can avoid depth, highlights and decorative gradients; Soft, Flow and Studio retain their purposes. Do not turn upstream taste rules into platform-wide bans.
4. Use the active design system's semantic colors, typography and spacing. No upstream coral color, serif family, 4px grid or warm paper is mandatory. Explicit overrides remain authored choices.
5. Separate meaning, layout and appearance. A retry loop, trust boundary or ownership handoff is semantic data, not a color recipe.
6. Keep the current computational bounds, including 300 cards and 900 connections. Reader budgets are advisory and depend on destination; they never delete content or make existing large diagrams unloadable.
7. Use the engine's physical-unit/export contract. Do not add manifest inputs named `width`, `height`, `format` or other reserved URL parameters.

## Delivery A - Readability, fidelity and diagnostics

### A1. Establish fixtures and contracts

Responsibility: the diagram tool and its contract tests.

Create fixtures for a branch with a return edge, a dense architecture overview, a dated roadmap, repeated sequence messages, long multilingual labels, and a sparse historical URL. Record source IDs, node labels, directed relationships, groups and expected supported/unsupported features.

Document the meaning of each existing type. In particular, distinguish chronological timeline from dated task duration, state columns from ownership lanes, categorical matrix from quantitative chart, and fixed-width decorative ribbons from quantity-encoding flows.

Acceptance: every fixture preserves its content census and direction through parse, render and URL/session round-trip. Old sequence import behavior remains covered until a caller opts into the new sequence layout.

### A2. Add a bounded diagnostics model

Responsibility: tool hook helpers; Node and MCP adapters only for exposing the same results.

Add a structured `diagramDiagnostics` extra alongside `ganttWarning`. Proposed finding fields are `code`, `severity`, `sourceInput`, `objectId`, `message` and optional measured bounds. These are proposed fields, not an existing API. Distinguish unsupported source syntax, missing glyphs, text overflow, route obstruction, label collision, repeated-message flattening and reading-size issues.

Retain stable source addresses for imported nodes and connections. Findings must point to a visual block or source line without rewriting the source. Deduplicate repeated findings, keep work bounded, and report the count when displayed findings are capped.

Expose findings through the existing CLI/MCP result conventions after checking their extension points. `lolly_validate` currently validates inputs; `lolly_check` primarily checks Design documents. Neither should be described as a complete diagram audit until this integration exists. Keep geometric checks in one implementation used by all shells.

Acceptance: a deliberately bad fixture produces the expected finding with its source ID; correcting that object removes the finding. A blank or unsupported source does not produce a clean report by omission.

### A3. Make destination size a layout concern

Responsibility: manifest, layout helpers, text helpers and tool templates.

Introduce optional reading presets for document, presentation and print use, with names validated against reserved parameters. A preset sets role sizes and spacing for layout, while export dimensions continue through the existing unit model. Record the intended displayed width when checking readability.

Measure before placing cards and edge labels. Include the bridge's supported fallback-font chain, combining marks and wide punctuation. Preserve readable sizes: first wrap, widen cards, increase gaps or recommend splitting. Avoid making a projected slide legible only when enlarged on a desktop.

For fixed-position ASCII/Pikchr sources, retain authored geometry and report text that cannot fit. For new overview authoring, start with a proposed advisory budget of roughly nine concepts, twelve relationships and two focal elements, then tune against fixtures. An exhaustive imported diagram remains exhaustive unless the user requests simplification.

Acceptance: mixed Latin/CJK, Arabic, combining marks and emoji have no silent missing-glyph or fit failure. An oversized slide suggests an overview/detail split while retaining all source objects.

### A4. Complete connector and accessible-export checks

Responsibility: `source/routing.js`, `source/paint.js`, SVG construction and export tests.

Check distinct port spacing, path intersections, non-endpoint card intersections, and the actual painted bounds of labels and arrowheads. Use bounded rerouting and spacing adjustments before suggesting a split. Shared org-chart trunks are intentional geometry, not automatically classified as accidental overlap.

Use background-aware masks only where needed; a mask must not erase a nearby node or cover an unrelated connector. Keep dashed, headless, bidirectional and explicitly imported arrows meaningful across every look.

Give standalone SVG exports a title, description and resolving accessible-name references. Scope naming and marker IDs when multiple diagrams are inlined. Preserve the editor's focusable cards and settings interactions: test editor semantics separately from a static export's image semantics.

Acceptance: collision mutations produce findings; a clean branching fixture passes. Two diagrams with the same title can be embedded without ID collisions. Keyboard object editing still works.

## Delivery B - True sequence and swimlane layouts

### B1. Sequence

Responsibility: tool-local parser/model/layout helpers and manifest.

Add an explicit sequence mode informed by the upstream [sequence reference](https://github.com/cathrynlavery/diagram-design/blob/0a8ea20ae69b33a5edce6018eedd3a9d26e90c1c/skills/diagram-design/references/type-sequence.md). Preserve an ordered message list with stable IDs, participants, endpoints, message kinds and labels. Do not identify messages solely by their endpoint pair.

Render participant headers, lifelines, ordered messages, returns and self-calls. A second bounded slice can add supported `alt`, `opt` and `loop` fragments and notes. Unsupported operators produce specific findings. Keep source-authored async/return semantics; do not invent them from decorative arrow defaults.

Acceptance: three messages between the same actors remain three messages. Request, return and retry ordering survives editing and reloading. Fragment guards and both branches remain visible, with no inferred source content.

### B2. Swimlane

Responsibility: grouping model and layout helpers.

Add lanes for ownership and arrows for handoffs. Lanes and flow direction are independent. Reuse group IDs where compatible, and add explicit ownership fields only where necessary. Do not repurpose dated Gantt lanes as the complete swimlane contract.

Acceptance: a cross-team process shows the correct owner for each step and the correct direction of each handoff. Renaming a lane does not break relationships. Vertical and horizontal flows pass source and export checks.

### B3. Evaluate the next types

After B1/B2, evaluate state diagrams and ER/schema diagrams against actual requests. They require transition guards or entity/cardinality semantics, respectively. Service blueprints require stage columns, frontstage/backstage rows and a visibility boundary, as illustrated by the upstream [blueprint reference](https://github.com/cathrynlavery/diagram-design/blob/0a8ea20ae69b33a5edce6018eedd3a9d26e90c1c/skills/diagram-design/references/type-service-blueprint.md).

Until those types ship, plan 309 routes specialized one-off compositions to Design with disclosed limitations. Quantitative charts belong in `chart`; do not build another chart engine inside Diagrams. Draw.io/Excalidraw import is a later scoped parser project with source-census fixtures, not a prerequisite for Delivery A.

## Implementation files and checks

| Files | Responsibility |
|---|---|
| `community/diagram-builder/tool.json`, `templates/*.json`, `README.md`, `i18n/*.json` | Additive controls, useful templates, semantics and copy |
| `community/diagram-builder/source/{appearance,text,routing,paint}.js` | Existing modern helpers; edit these rather than their generated copies |
| `community/diagram-builder/hooks.js`, `scripts/build-diagram-hooks.ts` | Existing handwritten parsers plus generated assembly; extend assembly for new helper modules |
| `community/diagram-builder/template.html` | Visible findings and accessible output wiring |
| `tests/diagram-builder-{visual,import,gantt}.test.ts` | Historical behavior, imports, geometry, dates and new contracts |
| CLI/MCP result adapters, selected after A2 design | Return structured findings without adding a second checker |

Run focused diagram tests and `node scripts/build-diagram-hooks.ts --check`. For manifest changes, run the requires generator, `build:catalog:all` and `validate:catalog:all`; initialize the private submodule only when qualifying a mounted private profile. Verify SVG and PNG across browser and CLI, then the requested vector/editable formats. Update previews when appearance changes.

Qualification must record how PDF, Penpot and PPTX represent the result. A picture in a slide is not editable diagram geometry. A missing font, raster fallback or unsupported import construct remains visible in the handoff.

## Order and completion

Deliver A1/A2 first, then A3/A4, then B1 and B2 as separate bounded changes. Plan 309 can document current capabilities immediately and add new recipes only after their acceptance checks pass. Plan 308 is independent and supplies the effective design-system context used here.

Complete Delivery A when current fixtures remain compatible, findings are available to people and agents, and readable output passes the requested-size and export checks. Complete each Delivery B type only after its semantic census and editing round-trips pass. Broader type coverage stays proposed.

Upstream is MIT licensed. These plans adapt concepts; any later copied code or substantial reference text must retain the upstream notice and enter Lolly's dependency/license records.
