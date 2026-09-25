# Constitution

> This chapter is a draft for review, dated 2026-09-24.  

This chapter states what a Lolly document is, which four records it is made of, the words the rest of the specification uses and the thirteen invariants every later chapter is measured against. It settles no serialisation and freezes no type. The other chapters carry the detail: [records](records.html), [source rows and patches](source-and-patches.html), [operations](operations.html), [values and time](values-and-time.html), [evaluation](evaluation.html), [policy](policy.html), [conformance](conformance.html), [extensions](extensions.html), [packaging](packaging.html), [proof cases](proof-cases.html) and [status](status.html).

## Thesis

A Lolly document represents a complete tool (D1). It carries the tool's typed interface, its authored content, its dependencies, its rules, its behaviour and the operations it offers. An operation may render, transform, extract, inspect, present or perform an explicitly authorised action (D1). A tool may produce a document, and a document may be used by another tool.

Operations are the foundation. Compositions, timelines and recorded sessions are optional (D11). A valid tool must not be required to have a canvas, a scene graph or a visual export (D11). The plan's evidence folder counts thirteen tool directories that declare an on-device transform, where a file goes in and bytes come out, so the operation is the whole tool. Unpack, Prepare, Batch and Verify are shell routes with no manifest at all, which is why R13 gives them operation adapters rather than tool definitions. The community tool `community/countdown-timer/tool.json` declares no inputs and exports only HTML.

An authored instance and one evaluation of it keep separate identities (R4). Changing a dataset in one instance must never mutate the definition that instance reuses, and evaluating an instance under a new organisation policy must never rewrite the authored instance (R4, R6).

Governance supplies the applicable rules and the acceptance authority (D6, D12). It never defines what a render means. Measured conformance and contextual acceptance stay separate answers for that reason (R8).

Generative or model-driven assets may be inputs or declared computations. Their dependency identity, repeatability and provenance are explicit claims in the evaluation record, never consequences assumed from a seed (R15).

The model is meant to produce five outcomes, and each later chapter answers to one of them:

- One model for complete tools, covering authored graphics, parameterised templates, data visualisations, timed media, interactive experiences and operations with no visual output (D1, D11).
- Local evaluation with explicit dependencies and declared repeatability, where recorded inputs and receipts are available when supported and permitted, never mandatory for a utility (D11, R15).
- Programmatic inspection, editing, patching and component reuse with stable identity and explicit constraint handling, with the MCP surface as the first consumer because it already edits by stable id (R1).
- A small conforming core with separately specified suites for particular media, outputs and interactions (R8, R12).
- Incremental adoption through adapters and native producers, with no catalog rewrite (R13).

## The four records

The four records already exist in this repository across eleven contracts with no shared naming (R4). The model gives them one set of names and states how they relate. It does not fork them.

![The four records of the document model - definition, instance, evaluation and artifact - each labelled with the existing contracts that hold it today](/info/diagrams/document-model/four-records.svg)

- **Definition.** What a tool is: identity, typed inputs, operations, resources, tokens, authored rules, components, output targets and extensions. It is held today by a manifest plus its template and hooks (`schemas/tool.schema.json`), by `DesignToolDefinitionV1` for tools compiled from Design (`packages/core/src/design-tool-v1.ts`, described in `docs/design-tool-contract.md`) and by the `.lolly` bundle of kind `tool`, which `shells/web/src/lib/lolly-pack.ts` writes and `packages/node-shell/src/lolly-file.ts` reads.
- **Instance.** One person's authored state against a definition revision, held today by the saved-session record at format 4 (`engine/src/session-record.ts`), by the `.lolly` bundle of kind `session` or by a URL (`engine/src/url-mode.ts`).
- **Evaluation.** What one run did and under which facts, recorded as a receipt: the C2PA manifest, the attribution receipt (`packages/core/src/rights-v1.ts`) and the proposed `EvaluationReceiptV1` (R15).
- **Artifact.** The produced bytes and their identity, content-addressed where a package carries them (`shells/web/src/lib/lolly-pack.ts`).

`CompiledDocument` is a transient compile result and must never be persisted as a document (R4, `engine/src/document-api.ts`). The same rule covers every other derived form: component expansion, chart lowering, text shaping and timeline sampling produce evaluation graphs that are never edited and never saved as the source (R1).

The records may travel in one package and must not be required to share one version number (R11). Each record must carry its own `schemaVersion`, a container must carry a minimum reader version and a definition must carry an engine version range (R11). Only the Design tool definition does so today (`packages/core/src/design-tool-v1.ts`); the session record carries `formatVersion` 4 (`engine/src/session-record.ts`) and the `.lolly` container carries `minReader` (`shells/web/src/lib/lolly-pack.ts`).

draft shape

```text
    Definition   id + schemaVersion + engineVersion + revision digest
    Instance     schemaVersion + definition binding (id, version, revision) + authored content
    Evaluation   schemaVersion + definition revision + instance revision + facts of the run
    Artifact     bytes + digest + the evaluation that produced them
```

This is a draft shape for review, not a type. Nothing is added to `packages/core` or `schemas/` in this wave, and the plan's section 18 orders the counterexample fixtures before any of it is frozen.

## Vocabulary

The glossary (`docs/glossary.md`) already defines engine, shell, host, tool, manifest, template, hooks, input model, URL mode, capabilities and requires, status, isolate, compose, content profile, catalog, asset, design tokens, session, user template, utility, batch, collab, project, export, Content Credentials, watermark and ship gate. Those words keep their meanings here.

One word carries three senses in this tree, and each is written in full every time. Two of them are a content profile and a user profile (`docs/glossary.md`). The third is the colour handling named by the reserved export parameter `profile` (`engine/src/url-mode.ts`). A conformance suite and an execution class carry the two senses an earlier draft would have added to this word, so no fourth or fifth sense is minted. Feature and output target are named for the same reason: each says what it is.

| Term | Meaning | Not |
|---|---|---|
| Record | One of four semantic units: definition, instance, evaluation, artifact. | A file format. Several records may share one package. |
| Operation | What a tool can do: render, transform, extract, inspect, present, act. A tool may expose several. | A closed enum; namespaces may add shapes. |
| Outcome | The typed result of one operation run: state, effects, findings, optional receipt. | A boolean. |
| Output target | A format plus size, units, DPI, colour handling and paging for one render. | The ICC `profile=` parameter, which is one field of it. |
| Execution class | The trust and enforcement context code runs in: `trusted-realm`, `isolated-worker`, `strict-worker`, `node-worker` and later `vm` for an interpreter in WebAssembly or a hardened compartment. | A capability flag. |
| Conformance suite | An immutable, versioned set of fixtures, references, a comparator and a reference environment, such as `still-2d/1`. | A content profile or a colour profile. |
| Feature | A named capability inside a suite, marked core or extended. | A host API in `requires`. |
| Acceptance | An authority's recorded decision about a measured result, including exceptions. | A pass. |
| Effective policy | The composed, attributed rule set one evaluation ran under. | The manifest. |

## The thirteen invariants

The plan lists these as candidates. This chapter states them as rules so reviewers can argue with them; the [status chapter](status.html) records when they bind. Each one cites the resolution or the repository file it rests on.

1. **Intent over implementation.** The source must record meaning, parameters, dependencies and permitted changes, and renderer internals must live in declared extensions (D1, R10). A document that stores one renderer's internals cannot be read by a second renderer.
2. **Inspection before execution.** A host must be able to read declared inputs, operations, rules, code, required powers and known dependencies without running any document code (D4, `schemas/tool.schema.json`). Inputs are declared in the manifest and never inferred from the template, and one module owns what an input means (`engine/src/inputs.ts`), so the declared surface can be read before anything runs. The declared dependency envelope and the dependencies discovered during execution must be reported separately (R15).
3. **Explicit evaluation context.** A result must identify the definition and instance revisions, the resolved resources, the engine and suite versions, the execution class, the effective policy, the time, the seed and the capabilities granted for that operation (R15). A receipt that omits the font files it resolved cannot support a fidelity claim about the file it describes.
4. **Output-based conformance, in three parts.** A claim must be tested against reference artifacts with a declared fuzz band, against region-scoped structural checks and against semantic checks on the produced artifact (R9, D3). One whole-image number cannot separate a vanished caption from a half-pixel shift, which is why the evidence appears in the [conformance chapter](conformance.html) and nowhere else. Byte identity across platforms is a separate and stronger claim with a known price: the emoji treatment's colour core uses no transcendental function, because V8 and JavaScriptCore agree bit for bit on add, subtract, multiply, divide and square root but not on pow, cbrt, exp or log (`engine/src/emoji-treatment.ts`).
5. **Repeatability is declared.** Rendering, reconstruction, capture and retention are four independent properties, and an operation may succeed with no persisted recording (D11, R15). A utility that strips metadata from a person's own file has done its job without retaining anything.
6. **Safe failure.** A missing capability, resource, grant or compatible version must produce a structured failure at the affected operation, and an optional feature must have an explicit fallback with the loss reported (R5, R10). A host must never claim to have rendered a feature it does not support. The single-file rule that an unsuccessful operation claims no outputs stays inside the adapter that owns it and must not be generalised to every operation (C3, `packages/core/src/file-operation-v1.ts`).
7. **Stable identity.** Tools, instances, rows, components and assets must keep permanent identities, a small edit must produce a small diff on the source rows, and a patch must state the revision it was made against, which a merge must still be validated after, because two patches valid against the same base can converge into an invalid document (R1, C2, `packages/core/src/canvas-op-v1.ts`). Identity by position breaks the moment two people edit at once.
8. **Typed authorable values.** A property must have a declared type and property-specific permissions for literals, tokens, bindings, conditionals, expressions and timed values, and a structured value must travel as a typed payload record referenced by id, never as an ad hoc string (R2, R14, C1). The collaboration row permits only strings, numbers, booleans and null, so a chart cannot be spread across scalar fields.
9. **Separate concerns.** Definitions, authored state, evaluation results, artifacts, tokens, data and policy have distinct semantics, and editor selection and panel state are separate metadata (R4, `shells/web/src/lib/editor-state.ts`). A selection that travelled as document content would make two identical designs compare as different.
10. **Least authority for strict execution.** Code must never acquire a device power because the host happens to support it, and trusted compatibility execution must be classified as such and must never inherit a strict claim (R3, C6, `engine/src/hook-worker-core.ts`). In-realm hooks can reach page globals, which `docs/constraints.md` already states as the limit of that path.
11. **Accessible intent.** Roles, descriptions, reading and focus order and input alternatives must be available where they are meaningful, with checks specific to each output (D1; the plan's section 6.6 re-homes the accessibility chapter, and its findings take the one finding shape R5 gives every outcome). Roles and reading order that survive to the screen but not into PDF or video are lost at the export boundary, and each output needs a check of its own.
12. **Media and operation independence.** A new domain or output kind must be addable without forcing every tool into image or scene semantics (D5, D11). Extraction has no rotation, and a transform has no canvas.
13. **Existing tools remain usable.** Adoption must be incremental, and an opaque adapter must state which guarantees and editing surfaces it preserves (R13, D11). Every mounted tool keeps working while the model is adopted, or the model is not adopted.

## Measured conformance and contextual acceptance

These are two answers and must never be merged into one (R8, D12).

**Measured conformance** lists the suite and its released version, the reference environment, the comparator version and the per-feature results, split into core and extended. A core feature must never be skipped, and a skipped test must never read as a pass (R8). A report is data: trust is the separate decision the authority below records, never a consequence of publishing one (R8, D12).

**Contextual acceptance** records the authority, the suite reference it judged and each exception it granted (R8, D12). The authority is the Lolly Work administrator for a governed brand and the local person otherwise (D12).

An authority may select a suite, require stricter checks, approve references or accept an exception. None of those decisions may change the meaning of a suite version already published under another identity (R8). A local waiver of a creative rule must leave measured conformance to the unmodified rule reading failed or excepted, never passed (R6, C4).

What exists today is the material for suites, not a suite. `lolly smoke` renders every tool in the active content profile at its defaults, each to its first Node-native format (`shells/cli/src/smoke.ts`). It skips a tool gated on a live capture and a transform tool with no committed fixture. Each skip carries a stated reason and is never counted as a pass. The host conformance kit checks that a live host carries the members the contract declares (`packages/core/src/host-conformance.ts`). The comparison modules return `undetermined` when a budget cuts the comparison short (`engine/src/compare.ts`). An incomplete comparison must never be recorded as a pass (C8).

## What this model does not promise

- **No cloud service.** The core requires no hosted service, and a governed client that loses its connection keeps enforcing the policy it holds (R7). What a link needs in order to render again is the list in `docs/reproducibility.md`, and no item on it is an account.
- **No identical pixels across hardware.** The model makes no unconditional promise of identical pixels on all hardware. This draft adds no conformance or reproducibility claim beyond those `docs/determinism.md` already makes. It states no threshold (C8) and no latency target, because the plan's section 18 puts baseline device measurements before any responsiveness claim.
- **No fabrication or spatial commitment.** Spatial experiences, fabrication and unfamiliar media are extensibility checks, not roadmap items or gates for the first native suite (D5). They exist to keep the extension boundary coherent.
- **No frozen types.** Nothing here freezes a document type, an outcome vocabulary, the patch envelope or the migration contract. Run the counterexamples in the [proof cases chapter](proof-cases.html) before freezing anything, and read the draft shapes in this specification as review material only (R11).
- **No claim that this is built.** The chapters describe a model and name the contracts it would rest on. The [status chapter](status.html) lists what is decided, what is open and what is not built.

## Open points

- **Q4, what "non-recordable" means for the first two cases.** Default: for a utility, capture off, retention none and replay semantic from pinned inputs; for a live-input tool, capture unsupported unless the person turns it on, retention for the session and no replay. Touches invariant 5.
- **Q5, who may publish a suite under the `lolly` namespace.** Default: `lolly/*` suites are published from this repository's CI only; Work instances and local people publish under their own namespace; an acceptance record always says which suite it judged. Touches the conformance and acceptance section.
- **Q6, whether the specification is public from the first draft.** Default: yes, because the constraints, determinism and reproducibility pages already make public promises this model keeps. Touches this chapter as a whole.

The other open questions (Q1 on first interchange routes, Q2 on the granularity of local rejection, Q3 on freshness for a governed claim) are carried, with their defaults, by the [conformance](conformance.html) and [policy](policy.html) chapters.

## Precedents

- `docs/glossary.md`
- `docs/constraints.md`
- `docs/determinism.md`
- `docs/reproducibility.md`
- `docs/design-tool-contract.md`
- `schemas/tool.schema.json`
- `packages/core/src/design-tool-v1.ts`
- `packages/core/src/canvas-op-v1.ts`
- `packages/core/src/rights-v1.ts`
- `packages/core/src/file-operation-v1.ts`
- `packages/core/src/host-conformance.ts`
- `engine/src/session-record.ts`
- `engine/src/url-mode.ts`
- `engine/src/document-api.ts`
- `engine/src/inputs.ts`
- `engine/src/hook-worker-core.ts`
- `engine/src/compare.ts`
- `engine/src/emoji-treatment.ts`
- `shells/web/src/lib/lolly-pack.ts`
- `shells/web/src/lib/editor-state.ts`
- `shells/cli/src/smoke.ts`
- `packages/node-shell/src/lolly-file.ts`
