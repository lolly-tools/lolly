# Status and open points

> This chapter is a draft for review, dated 2026-09-24.  

This is that status chapter. It records what is decided, what the final review corrected, what is still Andy's to answer, what is not built and the order the work starts in. The other eleven chapters state the model: [constitution](constitution.html), [records](records.html), [source rows and patches](source-and-patches.html), [operations](operations.html), [values and time](values-and-time.html), [evaluation](evaluation.html), [policy](policy.html), [conformance](conformance.html), [extensions](extensions.html), [packaging](packaging.html) and [proof cases](proof-cases.html).

## What this draft is

The specification is an integration document. It names four records, gives every contract already in the tree a role in one of them and adds only what is missing. A chapter must name an existing contract rather than fork it (R4). A chapter that describes something not yet built must state that in the same sentence (`plans/276-lolly-document-model.md` status line, `plans/276-execution.md` section 3).

No shared type is frozen before the counterexample fixtures pass (plan section 18). Nothing is added to `packages/core` or `schemas/` in this wave, and every proposed record appears as an indented draft shape instead (`plans/276-execution.md` section 3). A draft shape must never be read as a type, and no reader may treat a field name in one as stable.

This draft makes no conformance claim and states no threshold (C8), and it sets no latency target because the current evidence justifies none (plan section 18, review gate 5). It adds no reproducibility promise beyond the ones `docs/determinism.md` already makes. The probe numbers appear in one chapter, [conformance](conformance.html), as evidence that a single whole-image number cannot separate a lost caption from a half-pixel shift (C8).

The notice at the head of every chapter must stay until this chapter records that people have read the draft (`plans/276-execution.md` section 5). That review has not happened, so this chapter records no reading. The chapters that most need it are the constitution, the source rows and patches, the policy and the conformance chapters, because each fixes semantics the later contracts are built on (`plans/276-execution.md` section 5).

## Confirmed decisions

These come from Andy's recorded direction. They are settled and must not be reopened by a chapter (D1 to D13).

| ID | Decision | Chapter that carries it |
|---|---|---|
| D1 | The document represents a complete tool: its interface, behaviour, dependencies, permitted changes and operations. | [constitution](constitution.html) |
| D2 | The pilots are Design, Chart and Agenda: Design spans print, raster and motion, Chart tests nesting and typed data, Agenda spans interactive web, slides and motion. | [proof cases](proof-cases.html) |
| D3 | A claimed renderer suite must pass reference-render fixtures, because a valid JSON tree is not evidence of a render. | [conformance](conformance.html) |
| D4 | Typed declarative behaviour is preferred, with an imperative escape hatch that carries its own execution and trust contract. | [values and time](values-and-time.html) |
| D5 | Spatial and fabricated outputs are extensibility examples, never priorities or gates for 0.1. | [extensions](extensions.html) |
| D6 | Constraints may travel with a tool and may also be supplied by Lolly Work, and the two are modelled separately. | [policy](policy.html) |
| D7 | Outside a governed instance the local person may accept or reject a constraint, and the rejection has an explicit representation. | [policy](policy.html) |
| D8 | Still-image fidelity allows a very low pixel difference, difficult to notice without close inspection. | [conformance](conformance.html) |
| D9 | Motion must match time and look similar at corresponding percentage points, with extra coverage around transitions. | [conformance](conformance.html) |
| D10 | Independent authors may publish feature namespaces and conformance fixtures. | [extensions](extensions.html) |
| D11 | Some operations are non-recordable or non-replayable, and a utility may act on files without rendering anything. | [operations](operations.html) |
| D12 | Reference and acceptance authority is the Lolly Work administrator for a governed brand and the local person otherwise. | [policy](policy.html) |
| D13 | The model reads well to the Kubernetes, Penpot and Rive communities in their own idioms, as direction and not as instruction. | [records](records.html) |

D8 is restated by the comparator probe, not reopened. Andy's intent is no visible loss under close inspection, and the conformance chapter tests that intent with three declared checks instead of one number (D8, R9).

## Resolutions adopted from evidence

Each resolution is adopted unless Andy objects (R1 to R15). A chapter must cite the resolution id, or a repository path, beside the rule it states (`plans/276-execution.md` section 3).

| ID | Resolution | Chapter |
|---|---|---|
| R1 | The canonical source is flat rows keyed by permanent id, one owner pointer and one order key, with structured values in typed payload records and patches carrying a base revision. | [source rows and patches](source-and-patches.html) |
| R2 | Declarative logic is a closed JSON expression tree with a static cost estimate refused at authoring time and a runtime budget per evaluation, and `showIf` stays as its v0 subset. | [values and time](values-and-time.html) |
| R3 | Imperative logic stays in hooks, specified as eight protocol contracts with an authored effect envelope, per-attempt grants and an execution class that enforces them. | [values and time](values-and-time.html) |
| R4 | The four records map onto existing persisted forms, and the compile result is transient and never persisted as a document. | [records](records.html) |
| R5 | One outcome vocabulary with three separate parts: a typed result, a record of committed artifacts and a termination, with review states on a run lifecycle beside it. | [operations](operations.html) |
| R6 | Effective policy resolves authority first, then composes attributed layers, and a local waiver deactivates a named waivable creative rule only in unmanaged execution. | [policy](policy.html) |
| R7 | A governed client that loses its connection keeps enforcing the policy it holds, and refresh due, update known, policy validity and attestation stay four separate facts. | [policy](policy.html) |
| R8 | Measured conformance is a suite report with core and extended features, and contextual acceptance is a separate record naming the authority and each exception. | [conformance](conformance.html) |
| R9 | The still-image comparator is three checks declared per fixture: a whole-image fuzz band, region-scoped measures and semantic checks on the artifact. | [conformance](conformance.html) |
| R10 | Extensions live in a namespaced map with used and required lists, a version per extension and a complete dependency scope a host without it must protect. | [extensions](extensions.html) |
| R11 | Every record carries its own version, readers upgrade on read, a container carries a minimum reader and one internal evaluator normalises the four gates. | [packaging](packaging.html) |
| R12 | Native 0.1 is one still-image suite, `still-2d/1`, over PNG, SVG and PDF, with motion staged after the timeline contract and interactive output kept as an adapter. | [conformance](conformance.html) |
| R13 | Unpack, Prepare, Batch, Verify and the Rebrand review get operation adapters with typed inputs and outcomes, and none of them needs a canvas. | [operations](operations.html) |
| R14 | A chart inside Design is a layer kind whose row references a chart payload record by id, lowered by pure engine code and replaced as one atomic value. | [source rows and patches](source-and-patches.html) |
| R15 | An evaluation receipt records the definition and instance revisions, the resolved fonts by digest, the shaping engine, the emoji set, the clocks, the effective policy version and the execution class. | [evaluation](evaluation.html) |

## Corrections from the final review

Codex reviewed the finalised plan on 2026-09-24. Every finding was checked against the code before it changed the plan, and all of them held. A chapter must not restate a claim these corrections removed (C1 to C9); the Change column of plan section 0.1 records what each one removed.

| ID | Correction | Verified against |
|---|---|---|
| C1 | Typed values cannot travel in the scalar collaboration rows, so typed payload storage is specified apart from flat ownership. | `packages/core/src/canvas-op-v1.ts`, `schemas/canvas-op.schema.json` |
| C2 | Two valid reparents merge into an ownership cycle in either delivery order, and a revision precondition alone cannot prevent it. | `plans/276-document-model-evidence/crdt-cycle-probe.mjs` over `packages/core/src/canvas-op-v1.ts`, and `services/mcp/src/tools.ts` for the stateless edit path |
| C3 | The single-file rule does not generalise, because an inspection succeeds with no artifact and a cancelled batch keeps the files it wrote. | `packages/core/src/file-operation-v1.ts`, `packages/node-shell/src/rebrand-run-manifest.ts` |
| C4 | Placing a local decision below the authored required rules makes a local rejection ineffective, so authority resolves first. | Read of the authority rule in plan section 10.1 |
| C5 | Offline answers `unreachable` rather than `stale`, cached material keeps working, Leave removes rather than forks and "Make an editable copy" is a separate action. | `shells/web/src/lib/design-system/hosted.ts`, `shells/web/src/lib/instance-leave.ts` |
| C6 | A generated effect inventory is a regular-expression scan that an alias evades, so it is lint and never authority. | `scripts/tool-requires.ts`, `engine/src/runtime.ts` |
| C7 | Preserving unknown fields at parse time is not a round trip, because the writer rebuilds its manifest from typed input on every save. | `shells/web/src/lib/lolly-pack.ts` |
| C8 | The probe supports the direction and settles no method, and an incomplete comparison must never pass. | `engine/src/compare.ts` |
| C9 | The tool count is two numbers, not one: 81 raw directories with 79 distinct ids, and the tools a content profile resolves, which is 67 for `lolly-start` and 77 for `suse`. The evidence scripts were also made rerunnable from the repository, and the retained comparator fixture was regenerated from the measured transformation. | `packages/node-shell/src/content-roots.ts` |

Five compatibility gates came from the same review and are stated in the chapters they affect. The public `requires` field keeps its meaning. Diff gains a source-aware path. An unmet extension is refused at the operation boundary. Aggregate work is bounded, and not only expression size. Incremental edits are measured on a device before any responsiveness claim.

## Open questions

Six questions are Andy's. Each has a default so that drafting proceeds without an answer (plan section 16), and a chapter that depends on one states the question and its default in its Open points (`plans/276-execution.md` section 1A).

| ID | Question | Default | Evidence that would change it |
|---|---|---|---|
| Q1 | The first editable interchange routes per pilot. | The four routes and three edits in the conformance chapter. | A customer route that outranks them. |
| Q2 | The granularity and persistence of a local rejection. | Per rule, instance-scoped, recorded on the session record against a fingerprint of the facts. A derived tool revision is a Design tool export and is not part of 0.1 (R6). | A need to share a rejected state as a reusable tool. |
| Q3 | What freshness a governed-claim export needs, and who states it. | Freshness is a policy rule the instance issues, with a validity interval and a stated behaviour when it cannot be established. With no such rule the held policy is enforced, and the receipt says which policy version was evaluated and when it was last attested. Leave and "Make an editable copy" keep their current meanings (R7). | An organisation that needs a hard deadline, or a fully offline site. |
| Q4 | What non-recordable means for a local utility and for a live-input tool. | Utility: capture off, retention none, replay semantic from pinned inputs. Live input: capture unsupported unless the person turns it on, retention session, replay none. | A regulated workflow that needs durable receipts for utilities. |
| Q5 | Who may publish a suite under the `lolly` namespace, and how a local or Work suite is named. | Suites under `lolly/*` are published from this repository's continuous integration only, instances publish under `work:<instance>/*`, people publish under `local/*` and an acceptance record always states the suite it judged (R8). | A partner programme that needs a shared namespace. |
| Q6 | Whether the specification is public from the first draft. | Yes, because `docs/constraints.md`, `docs/determinism.md` and `docs/reproducibility.md` already make public promises this model keeps. | A reason to keep the drafts private until the pilots pass. |

## What is not built

Nothing in this specification is implemented. The list below is what a reader must not assume exists.

- No shared document type and no schema. `packages/core/src/document-v1.ts` and `schemas/document-v1.schema.json` do not exist.
- No shared outcome, receipt, report or acceptance type. `packages/core/src` holds no `OutcomeV1`, `EvaluationReceiptV1`, `ConformanceReportV1` or `AcceptanceV1` (R5, R8, R15).
- No expression, rule, timeline, dependency graph or accessibility finding type, and no `ComponentDefinitionV1`. Plans 190, 191, 192, 194, 195 and 196 define them and none is built. Plan 193 is partly built, and its `ChartSpecV1` is in `packages/core/src/chart-v1.ts` (plan section 0, F2). The component v0 does exist: `packages/core/src/design-tool-v1.ts` holds `DesignToolDraftV1`, and plan 190's type is specified as its generalisation (plan section 6.4).
- No conformance suite and no fixtures. `tests/conformance/` does not exist, and no suite version has been released (R8, R12).
- No three-check comparator. `engine/src/compare.ts` re-exports `compareStructure` and `comparisonBudget`, and its visual mode answers a preview-grade whole-image comparison. No band is calibrated (R9, C8).
- No chart layer kind. Composition still produces a flattened image, which the proof cases record as a failing case rather than the pilot (R14).
- No operation adapters for Unpack, Prepare, Batch, Verify and the Rebrand review (R13).
- No patch envelope and no source-aware diff. `engine/src/document-api.ts` still diffs hydrated HTML (R1).
- No device measurements. No latency target is justified by the current evidence, and none is stated (plan section 18).

## The order the work starts in

The work starts in this order, each step small.

1. The vocabulary and the record map as public prose, with authority, authored identity, typed payload storage, operation results and committed-effect semantics worked as concrete examples (R4). In progress: this specification and the summary page `docs/document-model.md` are that step, pending the read described above.
2. The counterexamples of the [proof cases](proof-cases.html) chapter as contract fixtures, covering the scalar row boundary, the concurrent cycle, partial cancellation, an effective local waiver and a save-and-restart preservation case (C1, C2, C3, C4, C7).
3. Only the smallest additive types and adapters those fixtures justify, starting with an outcome and a finding type mapped onto the three existing vocabularies (R5).
4. Package preservation and old-client gates, before any new native document is emitted (R10, R11).
5. The three-check comparator calibrated on positive and negative cases, before any suite pass is advertised (R9).
6. The chart layer kind and the five route adapters incrementally, with existing tools and local offline operation retained throughout (R13, R14).

Two rules bind that order. No shared type may be frozen before the fixtures in step 2 pass (C1, C2, C3, C4, C7). The patch envelope and the source-aware diff land only after the semantics in [source rows and patches](source-and-patches.html) and in [packaging](packaging.html) are settled, never before (plan section 18, R1). This draft states them as draft shapes and builds neither.

## Completion criteria for the planning phase

| Criterion | State |
|---|---|
| Inventory and vocabulary checked against the working tree | Met, first pass; the per-format capability matrix is outstanding |
| Confirmed decisions retained without reopening them | Met |
| Remaining product choices recorded with defaults, including staged scope | Met |
| Pilot and utility examples expressed with expected outcomes | Met, as the [proof cases](proof-cases.html) chapter |
| Effective governance, local rejection and acceptance claims distinguished | Met |
| Fidelity, timing and editable preservation each have a testable contract | Met, one of them supported by a probe |
| Package and identity compatibility and legacy execution classifications agreed | Met |
| The counterexamples pass as contract fixtures before any shared type is frozen | Outstanding |
| Andy's answers to Q1 to Q6, or acceptance of the defaults | Outstanding |
| Specification drafting started | In progress: this draft |

## Change log

| Date | Change |
|---|---|
| 2026-09-24 | Draft for review. The twelve chapters were written from the plan 276 consolidation after its final review, with D1 to D13 confirmed, R1 to R15 adopted from evidence, C1 to C9 corrected and Q1 to Q6 recorded with their defaults. No type is frozen and no conformance claim is made. |

A change to any chapter must add a row here with its date and what changed, so that the chapter sources in `docs/spec/document-model/` carry one history (`plans/276-execution.md` section 1A). A row lists the resolution ids the change affects, which is this specification's own convention.

## Open points

- **Q6. Whether the specification is public from the first draft.** Default from plan section 16: yes, published from `docs/` to the `/info` site, because `docs/constraints.md`, `docs/determinism.md` and `docs/reproducibility.md` already make public promises this model keeps. Evidence that would change it: a reason to keep the drafts private until the pilots pass.

The other five questions are recorded in the open questions table above with their defaults, and each is carried, unanswered, by the chapter it touches: Q1 and Q5 in [conformance](conformance.html), Q2 and Q3 in [policy](policy.html), Q4 in [operations](operations.html).

## Precedents

- `docs/constraints.md`
- `docs/determinism.md`
- `docs/reproducibility.md`
- `docs/glossary.md`
- `packages/core/src/canvas-op-v1.ts`
- `packages/core/src/chart-v1.ts`
- `packages/core/src/design-tool-v1.ts`
- `packages/core/src/file-operation-v1.ts`
- `packages/node-shell/src/rebrand-run-manifest.ts`
- `packages/node-shell/src/content-roots.ts`
- `schemas/canvas-op.schema.json`
- `services/mcp/src/tools.ts`
- `scripts/tool-requires.ts`
- `engine/src/compare.ts`
- `engine/src/runtime.ts`
- `engine/src/document-api.ts`
- `shells/web/src/lib/lolly-pack.ts`
- `shells/web/src/lib/design-system/hosted.ts`
- `shells/web/src/lib/instance-leave.ts`
- `plans/276-document-model-evidence/crdt-cycle-probe.mjs`
