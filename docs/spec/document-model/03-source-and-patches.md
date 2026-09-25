# Source rows, payloads and patches

> This chapter is a draft for review, dated 2026-09-24.  

This chapter specifies the authoritative content of an instance and the ways a program changes it. [Records and identity](records.html) lists the four records and says which existing contract holds each one. Here the subject is narrower: the rows a person authored and the typed payload records those rows point at. It also covers the patches that edit both.

The rules restate plan resolutions R1 and R14 with the review corrections C1, C2 and C7. The working reference is the collaboration contract in `packages/core/src/canvas-op-v1.ts` and the Design document it already carries.

## One authoritative source

The authoritative source of an instance must be a flat list of rows plus a small set of typed payload records (R1). Component expansion, chart lowering, text shaping and timeline sampling produce derived evaluation graphs. A derived graph must never be edited and must never be persisted as a document (R1). `CompiledDocument` in `engine/src/document-api.ts` is one such derived result and stays a transient compile result.

Today one path breaks that rule and the specification records it. `diffDocuments` in the same file compares two documents' rows by scraping `id=` attributes out of the hydrated HTML (`ids(a.hydrated)`), so a lowered graph is acting as a second source (F10). Semantic diff moves to the source rows, and [packaging](packaging.html) carries the migration. A compiled document keeps a comparison path of its own for template tools that have no source rows.

![Rows keyed by permanent id in the boxes lane, each with one owner pointer and one order key, beside the params lane of input values, with the text document and chart spec payload records referenced by id.](/info/diagrams/document-model/source-rows-and-payloads.svg)

Design is the worked example. Its document is the `boxes` input in `community/design/tool.json`: a flat array of rows, each with a permanent `id`, a `kind`, geometry fields and a `frame` field naming the artboard that owns it.

| Rule | Statement | Evidence |
|---|---|---|
| One owner pointer | A row must carry exactly one ownership pointer, and children must be found by query (R1). | The `frame` field on a Design row; `childLayerIds` in `packages/core/src/design-v1.ts` is derived by the read model. |
| No redundant children | A source must never keep a second list of children beside the pointer (R1). | Penpot keeps a parent, a children list and a frame pointer and needs a validator and a repair module to hold them together. |
| One order rule | Paint order must be a per-row order key with the row id as the tie-break (R1). | `ReferenceCanvasDoc` in `packages/core/src/canvas-op-v1.ts` sorts alive rows by order key then by id. Design does not yet: see below. |

Array position in a serialised document must be derived from the order rule and must never be a second source of order (R1, C2). An adapter that keeps its own list, as the Lolly Work adapter does with a Yjs array, must state the relationship between that list and the order keys (C2).

Design is the first adapter that owes this statement. Its rows paint in `boxes` array position inside an artboard, and its `order` field orders artboards only, tie-broken on ascending x rather than on the row id. The blocks array position is also a frozen positional wire form, so the relationship runs both ways. The order key is authoritative, and the serialised array is written in that order. The migration adds the per-row key without moving an existing row's position. [Packaging](packaging.html) owns it.

Rows must be flat maps of scalar fields (R1). Nesting a tree inside a row breaks the collaboration contract, which is a per-field last-writer-wins register over exactly this shape. Each field merges independently, keyed by a Lamport clock with the client id as the tie-break.

The contract splits field writes into two lanes, and the specification keeps that split (R1). `laneForField` in `packages/core/src/canvas-op-v1.ts` puts the five geometry roles on the geometry lane, which never invalidates a raster. The role names default to `x`, `y`, `w`, `h` and `rot` and are resolved from the tool's own field configuration before they cross the seam, so a tool that renames them keeps the split. Everything else rides the content lane, including the structural `frame`, `group`, `order` and `kind` fields. So an ownership change is an ordinary field write, and a concurrent move and restyle of one row compose without a lost update.

## Typed payload records

A row field may hold a scalar and nothing else (R1, C1). `Scalar` in `packages/core/src/canvas-op-v1.ts` is string, number, boolean or null, and `schemas/canvas-op.schema.json` enforces the same union (C1). A structured value therefore has no place in a row field. Encoding one as a string is refused by the [constitution](constitution.html), whose rule 8 states it directly: a structured value travels as a typed payload record referenced by id, never as an ad hoc string. The consequence this chapter adds is the practical one. A domain hidden in a string cannot be validated, diffed or merged by anything but the tool that wrote it.

A structured value must live in a typed, versioned payload record referenced from the row by id (R1, C1). The payload must be replaced as one atomic value, and it must never be spread across scalar fields (R1).

Design comes closest for text, and the part it gets right is the division. The `textDocument` input holds one document of stories. A row points at its story in `textStory` and its frame settings in `textFrame`. `composeDesignStories` in `community/design/hooks.js` refuses a frame settings object that carries `id`, `storyId`, `width` or `height`, because identity and size belong to the row. It also refuses a story whose named frame is missing, or whose row points at a different story. What it does not yet supply is the record. The document travels as JSON inside a `longtext` input and the frame settings as JSON inside a `text` row field (`JSON.parse(inp.textDocument)`, `JSON.parse(box.textFrame)`), with no `kind` and no `schemaVersion`. The division is the precedent; the typed record is owed here too, and the [proof cases](proof-cases.html) carry it beside the `3d` scene.

draft shape

```text
    TypedPayloadRecordV1
      id             permanent id, referenced by one or more rows
      kind           the payload type, such as text-story, chart-spec or scene
      schemaVersion  the payload's own version, upgraded on read
      value          the typed content, replaced as one atomic value
```

This is a draft shape for review, not a type. Nothing is added to `packages/core` or `schemas/` in this wave (R11).

Two consequences follow:

- Concurrent edits to one payload conflict or replace the whole payload, until finer operations are specified for that payload kind (R1, C1). An implementation may not claim field-level collaborative editing of a payload before those operations exist.
- The scalar wire contract stays unchanged for existing clients (C1). A row gains a pointer field and never a structured value. A blocks input's field order is frozen and append-only in `schemas/blocks-wire-order.json`, so that pointer is appended at the end. [Packaging](packaging.html) owns that migration.

The `3d` layer kind is the loudest case, not the only one. Its `scene` field in `community/design/tool.json` carries the 3D Studio's settings as a link query inside a 2D row, which is a coordinate domain smuggled in as text, and it must become a typed payload record referenced from the row (R1). In the same input, `textFrame`, `textWrap` and `vectorSource` hold JSON in a `text` field, and `path`, `kf`, `fx` and `grad` hold their own grammars. The rule reaches all of them. It does not follow that all of them move the same way. `path`, `kf`, `fx` and `grad` are compact because they travel in a link, so the specification must say whether a published grammar with a decoder satisfies the rule or whether the row pointer replaces it. [Packaging](packaging.html) owns that decision. The migration appends a field beside the string and leaves the existing links working; the [proof cases](proof-cases.html) carry it.

## The chart payload

A chart inside a Design document must be a `chart` layer kind whose row references a `ChartSpecV1` payload record by id (R14). `packages/core/src/chart-v1.ts` already holds that type, with datasets, series, scales, theme, motion, presentation and accessibility as structured members. None of them fits in a scalar field, which is why the chart follows the `textDocument` pattern rather than the row (C1, R14).

The payload must be lowered by pure engine code at evaluation time, and the lowered result must never be persisted as the source (R1, R14). A payload's datasets, encodings and accessibility metadata must survive nesting, lowering, serialising, reopening, copying, patching, synchronising and export (R14, C1). The [proof cases](proof-cases.html) run that sequence, and no step in it may turn the chart into a string or a flattened image. Synchronisation replaces the whole payload as one atomic value until finer chart operations are specified (R1).

Today's behaviour is different, and the specification records the difference. `composes` and `compose.renderUrl` nest a child render as an image, so the chart arrives flattened with no datasets and no accessibility metadata. That is the failing proof case, not the pilot (R14). It appears in the [proof cases](proof-cases.html) as the flattened chart whose pixels match while the editable round trip fails.

## What a revision covers

A revision covers the definition binding and the authoritative instance content, including order and payloads (C2). A revision excludes selection, caches and receipts (C2).

| In the revision | Out of the revision |
|---|---|
| The definition the instance is bound to, with its version | Editor selection and panel state, carried as `_ui=` today (`docs/url-app-links.md`) |
| Every source row, its fields, its owner pointer and its order key | Rendered caches, thumbnails and derived graphs |
| Every typed payload record the rows reference | Receipts and acceptance records, which name the revision they describe |

A receipt, a signature or an acceptance describes exactly the revision it was made against, and a later revision must never inherit it (C7). [Evaluation and receipts](evaluation.html) and [packaging](packaging.html) carry that rule for receipts and packages.

## Where compare-and-swap is atomic

Compare-and-swap on a base revision is atomic only where a mutable head exists (C2). Two such heads exist today: the shell's session store, whose record layout is `engine/src/session-record.ts`, and a collaboration room held by the Lolly Work adapter. Neither stores a revision yet. The session record versions its own layout and the engine that wrote it, and the collaboration contract orders field writes by Lamport clock with the client id as the tie-break. The revision is a field the envelope adds at both heads rather than one it reads. Against either head, a patch envelope whose base revision no longer matches must be refused rather than merged (C2).

The MCP path is a stateless transformation of supplied inputs, and it must declare that mode (C2). `resolveInputs` in `services/mcp/src/tools.ts` takes the caller's inputs, applies `layerOperations` then `layerPatches` and returns a new value. It never reads a persistent head, so a hash of the supplied inputs could not detect another writer's change elsewhere. A stateless path must never claim to protect an external head (C2).

A stale revision alone does not identify the rows that changed. Changed ids may be returned only when a retained base or a change history supports the claim (C2).

Today neither channel carries a precondition at all. `layerOperations` and `layerPatches` in `services/mcp/src/tools.ts` apply to whatever inputs the caller supplied. An agent therefore edits without a base, which is the gap the envelope closes. The stateless mode is kept and named rather than removed (C2).

## The patch envelope

![A patch envelope carrying a base revision and an ordered list of operations, applied all or nothing against a mutable head, with merge validation after convergence blocking an ownership cycle.](/info/diagrams/document-model/patch-envelope.svg)

A patch envelope carries a base revision and an ordered list of operations (R1).

draft shape

```text
    PatchEnvelopeV1
      baseRevision   the revision the operations were written against
      ops[]          add | duplicate | remove | reparent | reorder | set, applied in order
```

This is a draft shape for review, not a type. Nothing is added to `packages/core` or `schemas/` in this wave (R11).

The operation names are the ones the MCP surface already uses, split there across two arguments: `layerOperations` carries the five structural operations and `layerPatches` carries `set` (`.claude/skills/lolly/reference/design.md`, `services/mcp/src/tools.ts`).

Two differences from today are part of the contract. The envelope interleaves structural operations and field sets in one ordered list, while the MCP surface applies every `layerOperations` entry before every `layerPatches` entry. So an existing caller's two arrays must keep their phased meaning, and the envelope arrives as an additive, explicitly versioned path beside them, never as a reinterpretation of those two fields. Both channels are also Design-only today. The envelope is defined for any instance whose source is rows, so a tool that has no row source refuses it by name rather than silently accepting it.

| Operation | What it does | Addressing |
|---|---|---|
| `add` | Insert a row, optionally before or after a named sibling. | The new row's permanent id, refused if it already exists. |
| `duplicate` | Clone a row. An artboard's children are cloned too, each under a new id the caller supplies; a row that is not an artboard may not supply child ids. | Source id, the new id and, for an artboard with children, a complete old-id to new-id map. |
| `remove` | Delete a row. Removing an artboard that still has children requires an explicit cascade, so nothing is orphaned or deleted by default. | Row id, plus the cascade flag for a non-empty artboard. |
| `reparent` | Change a row's owner pointer. | Row id plus the new owner, or none. |
| `reorder` | Move a row before or after a sibling. | Row id plus an anchor id. |
| `set` | Merge declared fields into one row. | Row id; the id itself can never be changed. |

An envelope must apply all or nothing, including when the invalid operation is the last one in the list (C2). A target that was removed must fail by id and never by position (R1). The MCP path already fails this way: every operation with a target resolves it through a row lookup that reports the missing id in its error, and `add` refuses an id that already exists.

Where no mutable head exists the envelope still carries its base revision, and the receiving path records that it applied the operations as a transformation rather than as a compare-and-swap (C2).

## Merge validation after convergence

Two individually valid edits can converge on an invalid document, so validation must run after convergence and not only on each patch (R1, C2).

The counterexample runs against the reference model in `packages/core/src/canvas-op-v1.ts`, and [proof cases](proof-cases.html) carries it as a merge to be proved. Alice sets A's owner to B while Bob sets B's owner to A. Each edit is valid against the same base. The reference CRDT converges per field, so both writes survive in either delivery order and the merged document owns A inside B inside A. A base revision precondition cannot prevent it, because neither patch was stale.

After convergence, an ownership cycle, a deleted owner, a dangling reference or a torn atomic choice must block evaluation deterministically, and both edits must be kept for repair (R1, C2). A torn atomic choice is a set of fields one option writes as a unit (`choices` in `packages/core/src/design-tool-v1.ts`) whose members merged from two different options. An implementation must never silently drop an edge to make a merge converge (C2). The finding vocabulary already exists in part: `packages/core/src/design-v1.ts` raises `design.layer.artboard-missing` for a dangling owner and `design.layer.id-duplicate` for a repeated id, and [Operations and outcomes](operations.html) gives every finding one shape.

Cycles in ownership are always invalid (R1). Value dependencies, resource dependencies and interaction graphs have their own cycle rules, which [values and time](values-and-time.html) states.

The merge cases must be proved in both delivery orders and across a reconnect and a checkpoint (C2). The [proof cases](proof-cases.html) list them: the concurrent reparent, delete against reparent, two concurrent atomic choices, an invalid final operation in an envelope and two patches against one mutable head.

## Component expansion and upgrade

A component expands into rows at evaluation time. Expansion must be bounded by depth and by fan-out, and a recursive reference must be refused at validation with the path that reached it (R1). This chapter sets no numbers. The bounds must be declared by the implementation and refused at validation with a reason (R1). Two bounded paths exist already. `createRuntime` in `engine/src/runtime.ts` carries a compose stack into nested renders so a tool that embeds itself trips a cycle and depth guard instead of recursing. `validateDesignTool` in `packages/core/src/design-tool-v1.ts` refuses a draft over its artboard, layer, input and choice limits.

An expanded row must keep the source-row id and the instance id together, so repeated components stay distinct and re-evaluation preserves correspondence (R1).

Component upgrade must be an explicit migration (R1). An override whose target disappeared must be reported and must never be silently dropped (R1). `validateDesignTool` already raises `missing-layer` for a target input whose linked object was removed, and the finding gives the input and the layer. [Packaging](packaging.html) states the general migration rules, and [records and identity](records.html) covers the component contract that `DesignToolDraftV1` holds today.

## Open points

- **Q2, granularity and persistence of local rejection.** Default: per rule, instance-scoped, recorded on the session record with a fingerprint of the facts it was made about. This chapter does not settle whether a recorded waiver is part of the authoritative instance content a revision covers. [Constraints, authority and local choice](policy.html) owns that decision, and this chapter follows it.
- **Q6, whether the specification is public from the first draft.** Default: yes, published to `/info/build/` beside the constraints and determinism pages, with the draft notice at the head of every chapter. Those pages already make public promises this model has to keep.

No other open question touches this chapter.

## Precedents

- `packages/core/src/canvas-op-v1.ts`
- `schemas/canvas-op.schema.json`
- `packages/core/src/design-v1.ts`
- `packages/core/src/design-tool-v1.ts`
- `packages/core/src/chart-v1.ts`
- `services/mcp/src/tools.ts`
- `community/design/tool.json`
- `community/design/hooks.js`
- `engine/src/document-api.ts`
- `engine/src/runtime.ts`
- `engine/src/session-record.ts`
- `schemas/blocks-wire-order.json`
- `.claude/skills/lolly/reference/design.md`
- `docs/url-app-links.md`
