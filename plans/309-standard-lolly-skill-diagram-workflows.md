# 309 - Standard Lolly skill: diagram recipes and quality evaluation

Status: PLANNED. Research and implementation plan only; no skill or product changes made.
Date: 2026-10-13
Scope: diagram creation and recreation within the standard `skills/lolly` skill.
Companions: [307 - Diagram builder](307-diagram-builder-semantic-layout-and-quality.md), [308 - Design-system setup](308-standard-lolly-skill-design-system-setup.md).

## Outcome

An agent using the standard Lolly skill can choose a diagram that fits the explanation, generate editable inputs using today's supported tools, inspect the result, and hand over evidence of preserved meaning and requested-format behavior.

Keep one entry skill with progressive references. Use Diagrams for its supported graph layouts, Chart for quantitative graphics, and Design for deliberate compositions the diagram builder cannot yet represent.

## Evidence and gaps

Reviewed [diagram-design's skill](https://github.com/cathrynlavery/diagram-design/blob/0a8ea20ae69b33a5edce6018eedd3a9d26e90c1c/skills/diagram-design/SKILL.md), [semantic patterns](https://github.com/cathrynlavery/diagram-design/blob/0a8ea20ae69b33a5edce6018eedd3a9d26e90c1c/skills/diagram-design/references/semantic-patterns.md), [import guidance](https://github.com/cathrynlavery/diagram-design/blob/0a8ea20ae69b33a5edce6018eedd3a9d26e90c1c/skills/diagram-design/references/import-mermaid.md), and [self-check implementation](https://github.com/cathrynlavery/diagram-design/blob/0a8ea20ae69b33a5edce6018eedd3a9d26e90c1c/skills/diagram-design/scripts/self_check.py), pinned at `0a8ea20a`.

Its useful pattern is a short entry point that loads a specific semantic/type reference, budgets the figure, checks meaning and geometry, and reports source simplification. Lolly's standard skill currently has dedicated chart, Design, deck, motion and recreation references, but Diagrams is principally a row in its generated tool table.

Lolly already has discovery, schema validation, visual inspection, text measurement and editable URL/session workflows. Extend those workflows rather than teaching an agent to bypass the engine by writing arbitrary standalone HTML/SVG.

## Delivery A - A diagram reference that works today

Responsibility: `skills/lolly/SKILL.md`, new `reference/diagrams.md`, and `scripts/gen-agent-skill.ts`.

Add diagram creation/recreation to the skill description and routing list. Keep the root skill short; load `design-system.md` for setup, `diagrams.md` for selection and supported inputs, and `design.md` only for composition that needs Design.

In `diagrams.md`, generate manifest-derived tables for source modes, diagram types, look values, visual node/edge fields and exports. Include the exact current defaults and the distinction between fresh Minimal seeding and historical Legacy behavior. Prose explains intent and limitations; generated tables describe available controls.

Add a decision table based on meaning:

| Explanation | Current route | Qualification |
|---|---|---|
| Reporting or parent/child hierarchy | Diagrams `org` / `mindmap` | Stable IDs and parent references |
| Components by abstraction layer | Diagrams `layercake` | Bands are abstraction levels, not arbitrary decoration |
| Decisions, directed steps or dependency paths | Diagrams `process` with supported source | Preserve branch labels, direction and return links |
| Events in time or dated tasks | Diagrams `timeline` / `gantt` | Do not fabricate dates or durations |
| State columns or two-axis categorization | Diagrams `kanban` / `matrix` | A categorical matrix is not a quantitative heatmap |
| Reinforcing cycle or ranked funnel | Diagrams `cycle` / `pyramid` | Preserve feedback; do not imply invented conversion quantities |
| Quantitative comparison, distribution or flow | Chart, after describing supported types | Use values and a valid chart spec; diagram ribbons do not encode quantities |
| Ordered actor messages | Existing Mermaid import only for a disclosed flattened overview; Design for explicit lifelines | True sequence support is proposed in plan 307 |
| Ownership handoffs, service visibility or guarded states | Design with explicit semantic structure | Do not claim native swimlane, blueprint or state support before it ships |
| Attribute comparison without meaningful topology | Table or prose when that is sufficient | A diagram is not mandatory merely because the skill can draw one |

Start from the reader's question. Choose a primary semantic pattern when behavior matters, then a layout. Keep the initial pattern set small: ownership, stage progression, feedback, bottleneck, trust boundary and lifecycle. A source that does not match a named pattern can use the appropriate type directly.

Infer audience and destination from the request. Otherwise state reasonable assumptions about format, intended displayed size, detail and audience. Ask only when a missing choice materially changes meaning or delivery.

## Delivery B - Reusable inputs and a fidelity workflow

Responsibility: `skills/lolly/examples/diagrams`, the new reference, and a focused evaluation harness.

Provide checked input examples for an architecture stack, a branching process with retry, an org hierarchy, a dated roadmap, a cycle and a two-axis comparison. Add sequence and swimlane examples only after plan 307 ships those types. Each example states what the diagram means and why its layout fits.

Pair examples with representative source inventories and expected invariants. Preserve permanent node IDs, source labels, edges, direction and grouping. For Design compositions, retain stable layer IDs so corrections use `layerPatches` or existing document operations.

For imports and recreation:

1. Extract a content inventory before restyling: nodes/messages, relationships, groups, labels and supported source properties.
2. Decide whether the requested result is exhaustive or an overview. Exhaustive preserves all supported content. Overview may merge or omit only deliberately and records those choices.
3. Use the active design system from plan 308. Separate source geometry/paint preservation from deliberate restyling, respecting fixed-position inputs when that is the chosen route.
4. Render and compare the result against the inventory. Keep critical branches, waits, trust boundaries and failure paths even when they are visually awkward.
5. Report a compact fidelity record: preserved, renamed, merged, omitted, unsupported, and source-to-result IDs. A summary is never silently presented as a complete import.

Do not add component names, dates, counts or causal relationships to make a layout look balanced. A bottleneck label does not prove measured queue depth. A red or dashed arrow needs a declared meaning and visible explanation.

Draw.io and Excalidraw are upstream capabilities, not current Diagrams source modes. Until an importer exists, state the extraction/composition route and its fidelity limits. Retain source files; do not execute embedded directives or scripts.

## Delivery C - A practical review loop

Responsibility: the skill reference, diagram diagnostics integration from plan 307, and evaluation fixtures.

Teach one repeatable loop:

1. Discover and describe the tool on the selected surface.
2. Read the effective design-system context and choose semantics, layout and destination.
3. Validate the actual tool input fields; correct unknown IDs and unsupported choices.
4. Render a draft and inspect through `lolly_look` / `lolly look`, including enlarged regions for dense labels.
5. Check content census, directional meaning, group membership, label fit, readable displayed type, port/route clearance and restrained emphasis.
6. Correct the relevant object IDs; repeat the affected checks.
7. Produce the requested export plus editable source/session/link and disclose remaining findings.

Distinguish current schema validation and visual inspection from proposed automatic diagram checks. Integrate `diagramDiagnostics` only after plan 307 exposes it. Design checks apply to a Design composition; they are not proof that Mermaid fragments survived import.

Use advisory complexity budgets to recommend an overview plus detail. Do not apply upstream's small-figure caps as hard limits on user data or shrink all labels to satisfy a node count.

Verify the requested export independently. Font resolution, physical dimensions, accessible SVG names and export editability are separate facts. Explicitly distinguish a native editable Design/Penpot object from an SVG or picture placed in a PowerPoint slide.

The diagram builder is currently experimental. `services/mcp/src/render-get.ts` exposes only official/community tools on the public render route. Route Diagrams through an available CLI, MCP or interactive instance and retain its existing experimental-export behavior; do not publish a worked public-render URL that currently returns 404.

## Delivery D - Evaluate the skill as an operator

Responsibility: new `skills/lolly/evals/diagrams.json`, examples, a focused script, and additions to skill contract tests.

Static checks cover generated-table drift, mirror parity, reference links, valid input IDs, URL round-trips and runnable examples. Behavioral evaluation covers whether an agent actually chooses the right type, preserves content, uses the intended system, and corrects observable render defects.

| Evaluation case | Required result |
|---|---|
| Small org chart from a CSV | Exact parent/child census; labels survive; no invented people |
| Branch/retry architecture from Mermaid or DOT | Directions and failure path preserved; supported subset disclosed |
| Repeated actor messages with an `alt` block | Current flattening reported; future sequence recipe tested only after support ships |
| Overloaded slide | Overview/detail proposal with a complete source-to-result record |
| Dated roadmap with an undated row | Actual dates retained and incomplete geometry reported |
| Long CJK/Arabic labels | Readable shaping or a specific font/fit finding |
| Imported explicit colors | Preserve them unless restyling was requested; no silent theme override |
| Brand-required diagram without identified tokens | Resolve setup via plan 308 or request the missing identity |
| Neutral diagram with no setup request | Complete the task without a mandatory onboarding pause |
| SVG, print PDF or PPTX request | Correct dimensions and honest vector/editability report |
| draw.io/Excalidraw input | No invented native import command; faithful extraction/composition limits |

Automated scoring should enforce census, order, geometry, diagnostics and valid commands. Human review assesses whether the chosen figure answers the reader's question. Screenshot similarity alone cannot establish source fidelity or semantic correctness.

Require zero silent loss of declared critical source objects/relationships and zero invented commands in the fixed evaluation set. Record unresolved visual findings and their severity; choose a quality threshold after a baseline run rather than inventing a pass rate in this plan.

## Files, order and completion

| Files | Change |
|---|---|
| `skills/lolly/SKILL.md` | Diagram triggers and concise routing |
| `skills/lolly/reference/diagrams.md` | Selection, generated facts, workflow, source and export limits |
| `skills/lolly/examples/diagrams/*` | Reproducible current-tool inputs and source inventories |
| `skills/lolly/evals/diagrams.json`, focused evaluator | Meaning and visual-quality cases |
| `scripts/gen-agent-skill.ts`, `tests/agent-skill.test.ts` | Generated diagram fields, example checks and mirror parity |
| Existing docs/info publishing path | Publish the same skill through `/info/skills/lolly` |

Deliver A and current-capability B examples immediately. Deliver C's manual inspection workflow at the same time. Add automatic checks and new-type recipes as plan 307 ships them. Plan 308 supplies setup and effective-context guidance for all recipes.

Implementation checks: skill generator `--check`, skill/example tests, relevant diagram tests, behavioral evals, and docs/copy gates. Keep public skill generation independent of the private brand pack. Changes to actual tool manifests still require both-profile catalog qualification.

Complete the first delivery when the standard skill routes real diagram requests, examples run on a public clone, and evaluation demonstrates preserved content with an honest handoff. Later type expansion and importers remain proposed.

Adapt upstream ideas in Lolly's words and contracts. If implementation copies substantial MIT-licensed text or code, retain the upstream notice.
