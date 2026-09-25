# Records and identity

> This chapter is a draft for review, dated 2026-09-24.  

The model has four records: definition, instance, evaluation and artifact. All four already exist in this repository, spread over at least seven contracts with no shared naming (R4). This chapter gives each contract a record, states what identity each record keeps and says which record every override mechanism changes. It adds no file format and no new type.

The thesis and the invariants are in the [constitution](constitution.html). The rules for the rows inside an instance are in [source rows, payloads and patches](source-and-patches.html).

## The four records

A Lolly document represents a complete tool (D1). Completeness is a property of the four records together. The model must never require that a definition, a person's authored state and an execution history share one version number (R4).

- A definition record must hold the typed interface, the operations, the dependencies, the tokens and the authored rules of one tool (D1).
- An instance record must hold authored state against one definition (R4). Evaluating an instance under a new organisation policy must never silently rewrite it (R6). A rewrite that does happen is a versioned transform that reports findings ([packaging](packaging.html)).
- An evaluation record must describe one run of one operation, naming the definition and instance revisions it ran against (R15).
- An artifact record is the produced bytes, content addressed where they are carried (R4).
- Every record must carry its own `schemaVersion` (R11). Several records may live in one package: a `.lolly` file already carries a session, a tool bundle, a project or a renovation in one zip (`shells/web/src/lib/lolly-pack.ts`).

A definition may be reused by more than one instance. A Chart definition used by two Design instances with different datasets keeps one identity, and changing one dataset must never mutate the definition (R4). The two instances keep independent identity and state (plan section 1, and the "Chart inside Design and another tool" case in [proof cases](proof-cases.html)).

## The record map

![The record map: each existing contract in the repository on the left, with one edge to the record it holds on the right.](/info/diagrams/document-model/record-map.svg)

| Record | Existing contract | Where | Identity and change today |
|---|---|---|---|
| Tool definition | `tool.json` (closed schema, `additionalProperties: false`), `template.html`, `hooks.js`, `styles.css`; `DesignToolDefinitionV1` for tools compiled from Design; the `.lolly` kind `tool` bundle with `minReader: 2`. | `schemas/tool.schema.json`, `packages/core/src/design-tool-v1.ts`, `shells/web/src/lib/lolly-pack.ts`, `packages/node-shell/src/lolly-file.ts` | Permanent `id`, SemVer `version`. An installed Design tool keeps immutable revisions served from `/tools/<id>/.revisions/<digest>/`, and the same version with different bytes is refused (`shells/web/src/lib/installed-tools.ts`). |
| Authored instance | The session record at format 4: slot, tool id and version, data, design-system stamp, emoji stamp and `rightsDecisions`; the `.lolly` kind `session`; the URL, readable or packed. | `engine/src/session-record.ts`, `engine/src/url-mode.ts`, `schemas/blocks-wire-order.json` | A slot id on device. The field order of every blocks input is a frozen, append-only wire contract; the packed `z` token is raw DEFLATE, so a one-field edit changes the whole token and the JSON rows are the only diffable form. |
| Evaluation result | `CompiledDocument` (transient); the C2PA manifest with actions and source ingredients; `AttributionReceiptV1` with `ReceiptStateV1`; `FileOperationReportV1`; the rebrand `RunFileV1` with its `RunOutcomeV1` and report; the `.lolly` manifest's `engineVersion`, `app`, `exportedAt` and fonts by sha256. | `engine/src/document-api.ts`, `engine/src/c2pa.ts`, `packages/core/src/rights-v1.ts`, `packages/core/src/file-operation-v1.ts`, `packages/node-shell/src/rebrand-run-manifest.ts` | Bound to one run. Nothing joins these six forms today (F1, plan section 4.1). |
| Produced artifacts | Exported bytes; the renders Projects keeps; `.lolly` carried assets, split into `asset` rows that carry bytes and `asset-ref` rows the recipient resolves locally, under an integrity map. | `shells/web/src/lib/lolly-pack.ts` | Content addressed where carried. |

R4 fixes the mapping. A definition is the tool bundle, carried as a signed catalog tool or as a `.lolly` kind `tool` with immutable revision digests. An instance is the session record, a `.lolly` kind `session` or a URL. An evaluation is a receipt: the C2PA manifest, `AttributionReceiptV1` and the proposed `EvaluationReceiptV1` that the [evaluation chapter](evaluation.html) describes. An artifact is the exported bytes.

Each record keeps the identity rules it has today. A tool `id` and an asset `id` are permanent contracts and must never be renamed or reused to express a version (invariant 7, plan section 13, `docs/glossary.md`). Resource identity is a stable logical id plus an immutable revision or digest for one evaluation (invariant 7, plan section 13).

## CompiledDocument stays transient

`compileDocument` mounts a runtime, reads the input model and returns a `CompiledDocument` holding the manifest, the model, the values, the resolved token references where the model holds any, the hydrated markup and the scoped styles, which are null when the tool ships none (`engine/src/document-api.ts`).

- A `CompiledDocument` must never be persisted as a document record (R4).
- A reader must never treat a compile result as a source of authored content (R4).
- A compile result may be held as a cache (plan section 6.3, review gate 5). A revision covers the definition binding and the authoritative instance content. It excludes caches. A cached result is therefore keyed by the revisions it was produced from and never stands in for them. [Evaluation](evaluation.html) states when such a cache is invalidated.

Today `diffDocuments` fills its `boxes` field by matching every `id=` attribute in the hydrated markup with a regular expression (`engine/src/document-api.ts`). That makes a lowered result into a second source of authored content, which the source rule forbids (R1). Semantic diff must move to the authored rows (R1). The [packaging chapter](packaging.html) states the source-aware path and what stays as it is for template tools that have no rows.

Component expansion, chart lowering, text shaping and timeline sampling produce derived evaluation graphs in the same way. Such a graph is never edited and is never persisted as a document (R1).

## Definition contents

The contents below are the draft grouping, not a file layout. Nothing here is added to `packages/core` or `schemas/` in this wave.

draft shape

```text
  Tool definition
    identity + schemaVersion + engineVersion + authorship/provenance
    typed inputs + defaults + validation (the input model, unchanged)
    operations + typed outcomes + declared effects
    resources + immutable dependency resolution rules
    tokens + authored rules
    reusable components and public interfaces
    optional compositions, interactions and timelines
    output targets + execution requirements (one `requires` vocabulary)
    extensions (used / required) + separate authoring metadata
```

The input model stays exactly as it is: inputs are declared in the manifest and never inferred from the template (`schemas/tool.schema.json`). The [operations chapter](operations.html) owns the operation and outcome entries. [Values and time](values-and-time.html) owns the typed values and the execution requirements, and [capabilities, trust and extensions](extensions.html) owns the extension lists.

A composition has a coordinate domain and roots (plan section 6.2). A row in an appropriate domain has an identity, a kind, one owner, an order and the traits that apply to it (plan section 6.2, R1). Transforms and visibility must never be modelled as universal row properties, because an extraction operation has no rotation (plan section 6.2, D11). Geometry, text, media, charts, layout and interaction use composable traits rather than an inheritance hierarchy (plan section 6.2). A component exposes a typed interface, and an instance may provide overrides only at declared override points (R1, `packages/core/src/design-tool-v1.ts`).

## The component v0

`DesignToolDraftV1` is already a component contract (`packages/core/src/design-tool-v1.ts`). Its parts map onto the component vocabulary one for one.

| Component concept | In `DesignToolDraftV1` today |
|---|---|
| Public interface | `inputs`, each a `DesignInputV1` wrapping one `InputSpec`. |
| Declared override points | `targets`, each a variant id, a layer id and one of nine properties. |
| Constraints | `approved` lists per input, `fixedInputs` per choice option, `DesignTextRuleV1` and `DesignImageRuleV1`. |
| Atomic multi-property change | `DesignChoiceV1.options[].writes`, a list of writes applied together. |
| Declarative text composition | `DesignTextRecipeV1`, a target plus input and literal parts. |
| One writer per property | `validateDesignTool` keys every write by variant, layer and property and refuses a second writer. |
| Compiled form | `DesignToolDefinitionV1` adds `compilerVersion`, `rendererDigest`, scoped `css` and `dependencies` with digests. |

Slide masters are components with slots. A master is design-system data a brand pack ships, holding archetypes with named placeholder roles and the furniture each one shows; `seedFrame` lays a new slide down and `applyArchetype` re-lays one into another archetype, reading the `master`, `role` and `furniture` fields on each seeded layer (`shells/web/src/views/free-canvas/slide-masters.ts`).

`ComponentDefinitionV1` must be specified as the generalisation of `DesignToolDraftV1` and never as a new object (R1, `packages/core/src/design-tool-v1.ts`). The generalisation adds a semantic version, a dependency set and a lock section. It keeps the target and ownership rules that `validateDesignTool` enforces today (`packages/core/src/design-tool-v1.ts`). An instance pins a version or a range, maps parent values explicitly and may select only declared variants (R11). Rive splits a typed View Model from its instances and its bindings, which is the same three-way separation between interface, values and wiring (plan section 6.4; D13 is the direction that makes the comparison worth stating).

Two identity rules follow the component into the source rows. An expanded component row keeps the source row id and the instance id together (R1). A component upgrade whose override target disappeared is reported rather than dropped (R1). [Source rows, payloads and patches](source-and-patches.html) states both.

## Three overlay mechanisms

Three different override mechanisms already ship. The model must never unify their implementations, and it says which record each one changes so a fourth is not added without that answer (R4).

| Mechanism | Where | Record it changes | What it does |
|---|---|---|---|
| `extends: "community"` | `schemas/tool.schema.json`, `packages/node-shell/src/content-roots.ts` | Definition | A brand-pack tool declares a per-file union with the community tool of the same id. The overlay file wins on a filename collision and the marker is stripped from the manifest consumers see. A declared overlay whose base is missing is an error, never a partial tool. |
| Slide masters | `shells/web/src/views/free-canvas/slide-masters.ts` | Definition | Archetypes with placeholder roles and furniture are seeded into a frame. Furniture is committed locked, and a layer a person drew by hand carries none of the three fields and is never re-laid. |
| `composes` and `compose.renderUrl` | `schemas/tool.schema.json`, `packages/core/src/host-v1/compose.ts` | Evaluation | A nested render is produced through the same load and render path and handed to the template as an embeddable asset. Recursion is depth and cycle guarded by the host. |

A `composes` result is an image, so it changes the evaluation and never the definition or the instance (`packages/core/src/host-v1/compose.ts`). Appearance can pass a still comparison while the editable round trip fails, which is the flattened-chart case in [proof cases](proof-cases.html). A nested chart must instead be a typed payload record referenced from the row (R14), and [source rows, payloads and patches](source-and-patches.html) carries that rule.

An author who adds a fourth override mechanism must name the record it changes before it ships (R4).

## Chapters re-homed from plans 190 to 196

Seven September plans define contracts this model needs, in six chapters. None of them is built, except that plan 193 is partly built. This specification settles the records and identity rules those plans share: each becomes a chapter of the model rather than a separate contract (R4).

| Chapter | Source plan | Status | What this specification settles | Where |
|---|---|---|---|---|
| Dependency graph and components | 190 | Not built | The record and identity rules above. The graph is emitted at evaluation and pinned in the receipt, never kept as a second source (R1). | This chapter and [evaluation](evaluation.html) |
| Locales, layouts, variants | 191 | Not built | Layout selection uses the `ExpressionV1` rules, and a selected layout id is part of the instance snapshot (R2). | [Values and time](values-and-time.html) |
| Declarative charts | 192, 193 | 193 partly built | A `chart` layer kind whose row references a `ChartSpecV1` payload by id (R14). Renderer adapters pass the same conformance suite. | [Source rows and patches](source-and-patches.html), [conformance](conformance.html) |
| Rules and expressions | 194 | Not built | The JSON AST with a closed operator set, a static cost estimate at authoring time and a runtime budget (R2). | [Values and time](values-and-time.html) |
| Accessibility findings | 195 | Not built | An accessibility finding uses the one finding entry every other finding table in the tree uses: a code, a severity, a message and an optional path and evidence (R5, `packages/core/src/file-v1.ts`). | [Evaluation](evaluation.html), [conformance](conformance.html) |
| Timelines and motion capabilities | 196 | Not built | The `motion-2d/1` suite is staged after `TimelineV1` exists (R12); the clocks are specified with the other time rules. | [Values and time](values-and-time.html), [conformance](conformance.html) |

Each of those plans keeps its own build sequence. This chapter settles only the records they attach to and the identity rules they must keep.

## Open points

- **Q2, granularity and persistence of local rejection.** Default: per rule, instance scoped, recorded on the session record with a fingerprint (R6). A derived tool revision is a Design tool export and is not part of 0.1. This touches the instance record, which already carries `rightsDecisions` keyed by work and kind with a fingerprint (`engine/src/session-record.ts`). The rule side is in [constraints, authority and local choice](policy.html). Evidence that would change it: a need to share a rejected state as a reusable tool.
- **Q6, whether the specification is public from the first draft.** Default: yes, published under `/info/` with the draft notice, since the constraints, determinism and reproducibility pages already make public promises this model has to keep. Evidence that would change it: a reason to keep the drafts private until the pilots pass. The [status chapter](status.html) records the answer.

The other open questions are settled in other chapters. Q1 and Q5 are answered in [Conformance and fidelity](conformance.html). Q3 is answered in [Constraints, authority and local choice](policy.html). Q4 is answered in [Operations and outcomes](operations.html).

## Precedents

- `schemas/tool.schema.json`
- `schemas/blocks-wire-order.json`
- `packages/core/src/design-tool-v1.ts`
- `packages/core/src/rights-v1.ts`
- `packages/core/src/file-v1.ts`
- `packages/core/src/file-operation-v1.ts`
- `packages/core/src/host-v1/compose.ts`
- `packages/node-shell/src/lolly-file.ts`
- `packages/node-shell/src/content-roots.ts`
- `packages/node-shell/src/rebrand-run-manifest.ts`
- `engine/src/c2pa.ts`
- `engine/src/document-api.ts`
- `engine/src/session-record.ts`
- `engine/src/url-mode.ts`
- `shells/web/src/lib/lolly-pack.ts`
- `shells/web/src/lib/installed-tools.ts`
- `shells/web/src/views/free-canvas/slide-masters.ts`
- `docs/glossary.md`
