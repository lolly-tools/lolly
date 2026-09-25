# Operations and outcomes

> This chapter is a draft for review, dated 2026-09-24.  

An operation is what a tool can do. A Lolly document represents a complete tool (D1). It declares operations beside inputs, dependencies and rules. Rendering is one operation among several. A tool that draws nothing a person keeps is still a valid tool (D11).

This chapter specifies six operation shapes and the outcome one run returns. It then specifies the lifecycle a multi-stage run moves through and the rules that hold when a run stops early. It restates plan sections 4.2 and 7 in normative form, with the correction the review recorded as C3. The records these operations read and write are specified in [Records and identity](records.html); the pipeline that runs one is specified in [Evaluation and receipts](evaluation.html).

## The six operation shapes

| Operation shape | Example in the tree today | Success criterion |
|---|---|---|
| Render | Design produces PNG or SVG. | The artifact satisfies its output target and passes the conformance suite the run claims. |
| Transform | Rebrand applies a reviewed plan to a deck. | The result satisfies the transformation contract, and unresolved work is reported. |
| Extract | Unpack returns selected content from a source file. | The requested resources and the relevant source relationships are returned. |
| Inspect and validate | `lolly_inspect` and `lolly_validate` report a document's contents or findings. | A typed result is returned. No artifact is required. |
| Present and interact | Agenda runs a searchable programme from an interactive HTML export built with `render.portable`. | State, actions, accessibility and presentation follow the declared contract. |
| Authorised host action | Commit an operation's files to a chosen destination. | The declared action completes inside its grant. Partial completion or failure is reported. |

These are useful shapes, not a closed enum (plan section 7). A namespace may declare another shape, and a host must never treat the six as exhaustive. Two adjacent buttons can drive two operations: previewing a Rebrand result and committing its files are separate operations with separate outcomes. Plan section 4.2 lists a seventh row, multi-stage, whose single instance is Rebrand. It is not a seventh shape: a multi-stage run is a sequence of operations under one run lifecycle, specified below.

The evidence for each shape already exists under other names. `engine/src/document-api.ts` carries the inspect and validate verbs as `validateDocument`, `inspectDocument`, `diffDocuments` and `measureDocument`. `compileDocument` in the same file is not one of them. It calls `createRuntime`, so it runs document code and returns a transient compile result (R4). The `inspectDocument(bytes)` overload is the extract shape over a file, beside `lolly validate --metadata` in `shells/cli/src/validate.ts` and the `#/unpack` route. `packages/core/src/host-v1/export.ts` carries render as `render()` and the authorised host action as `download()` and `share()`. The same file carries the transform path as `file()`, which never watermarks and never embeds provenance. `FileOperationRequestV1` in `packages/core/src/file-operation-v1.ts` is that path's typed request. Thirteen tool directories declare `privacy: on-device` with a `file` input and an `exportFile` hook, which is a raw directory count rather than a resolved one. `schemas/tool.schema.json` carries the present shape as `render.portable`, and `community/agenda/tool.json` is the one tool to declare it.

![The six operation shapes, the three parts of one outcome and the four run lifecycle values, drawn as three separate groups.](/info/diagrams/document-model/operation-shapes.svg)

## Operations without an artifact

An operation must never require a canvas, a scene graph or a visual export to be valid (D11). Inspection, validation and measurement return a typed answer and write nothing.

Unpack, Prepare, Batch, Verify and the Rebrand review are shell routes today, not manifest tools. Each must gain an operation adapter with typed inputs and a typed outcome (R13). None of the five needs a canvas. Until those adapters exist, this chapter describes them as operations and the tree does not yet expose them as such.

## OutcomeV1

One terminated run returns one outcome. Three things the tree conflates into a single enum today are kept apart in it (R5, C3). The first is the typed result of an inspection. The second is the list of artifacts produced and committed. The third is the termination, meaning how the run ended.

```text
draft shape

  OutcomeV1
    operation       the operation id
    termination     succeeded | partial | failed | cancelled | blocked
    code?           a stable error code; this draft does not specify the code table
    result?         the typed answer of an inspection, validation or measurement
    artifacts[]     what was produced and committed: { id, facts, destination, state },
                    kept whatever the termination
    effects[]       host actions attempted: { kind, target, state }, using the receipt states
    findings[]      { code, severity, message, path?, evidence? }, one shape everywhere
    attempt         { id, resumable }, so a resumed run reconciles against what it committed
    recording       { capture, retention, replay } as declared for this run
    receipt?        EvaluationReceiptV1 when the recording policy retains one
```

This is a draft shape, not a frozen type. Nothing is added to `packages/core` or `schemas/` in this wave, and the plan's section 18 orders the counterexample fixtures before any of it is frozen.

No tree-wide code table exists. `REBRAND_ERROR_CODES`, with the `RUN_PERMANENT_ERROR_CODES` and `RUN_RETRYABLE_ERROR_CODES` split in `packages/node-shell/src/rebrand-run-manifest.ts`, is the only worked example. Transience there is a property of the code, not a grant to retry.

A terminated run must carry exactly one `termination`, and must keep every artifact it committed whatever the termination (R5, C3). A `findings` entry must use one shape across every operation (R5). The file operation findings in `packages/core/src/file-v1.ts` and the rules findings in [Constraints, authority and local choice](policy.html) must then read the same way.

| Termination | Meaning |
|---|---|
| `succeeded` | The operation completed. There may be no artifact. |
| `partial` | The operation did not complete and at least one artifact or effect was committed. |
| `failed` | The operation did not complete and committed nothing. The cause was an error. |
| `cancelled` | The operation stopped on request and committed nothing. |
| `blocked` | The operation could not start or continue because a declared requirement was unmet. |

`partial` is the state a run reaches when it committed something and did not finish. The reason is in `code` and in `findings`, not in the termination. `fileBatchReportV1` in `packages/core/src/file-operation-v1.ts` already resolves a cancelled batch with one success to `partially_succeeded` rather than to `cancelled`, so the model follows the adapter rather than correcting it.

This draft reads `blocked` as an unmet requirement rather than an error: a missing extension declared in `extensionsRequired`, an unmet host API in `requires`, or two active required rules that conflict. [Constraints, authority and local choice](policy.html) specifies the conflict case, and [Capabilities, trust and extensions](extensions.html) specifies refusal by name. A block is scoped to the operation that needed the thing. Declarations are read before any operation is selected, and refusal happens at the affected operation and output (plan section 9, steps 1 and 2). An unsupported motion extension therefore never prevents safe inspection of the same document.

## The run lifecycle

A run lifecycle sits beside the outcome and never inside it (R5). `pending`, `running`, `needs-review` and `ready` say where a multi-stage run is. Only a terminated run carries a termination.

The Rebrand run manifest keeps its four values on disk unchanged. `RUN_OUTCOMES` in `packages/node-shell/src/rebrand-run-manifest.ts` is `pending`, `ready`, `needs-review` and `failed`, and that file's own comment records that `needs-review` is not a success. The caller records an outcome and a stage together, so `ready` at the plan stage means a plan is ready and nothing has been exported. The model must never rewrite those persisted values to reach its own vocabulary.

| Persisted value | Where it lives | How it maps |
|---|---|---|
| `pending` | `RunOutcomeV1` | Lifecycle `pending`. No termination. |
| `ready` | `RunOutcomeV1` | Lifecycle `ready`. No termination. The recorded stage says what is ready. |
| `needs-review` | `RunOutcomeV1` | Lifecycle `needs-review`. No termination. |
| `failed` | `RunOutcomeV1` | Termination `failed`, or `partial` when an output was written, with the error code. |
| `ready`, `needs-review`, `failed` | `FILE_OUTCOMES` and `FileOutcomeV1` in `packages/core/src/rebrand-v1.ts`, persisted per stage as `StageRunV1.outcome` in `shells/cli/src/rebrand.ts` | The same mapping as `RunOutcomeV1`, read against the stage that recorded it. |
| `succeeded` | `FileOperationReportV1.state` | Termination `succeeded`. |
| `partially_succeeded` | `FileOperationReportV1.state` | Termination `partial`. |
| `failed` | `FileOperationReportV1.state` | Termination `failed`. |
| `cancelled` | `FileOperationReportV1.state` | Termination `cancelled`, with no committed artifact. |
| `prepared`, `written`, `readback-confirmed`, `delivered`, `destination-confirmed`, `user-recorded-external-action` | `ReceiptStateV1` in `packages/core/src/rights-v1.ts` | The `state` of one entry in `effects[]`. `user-recorded-external-action` is a person's statement about a destination, not the host's observation of one, and an outcome must never read it as a confirmed commit. |

An outcome is produced only when a run terminates. A run at `pending`, `running` or `needs-review` has not terminated and returns no outcome. The artifacts and effects it already committed are held on the run record, and they appear in `artifacts[]` and `effects[]` of the outcome the terminating run returns. A run that stops while review is still owed terminates `partial`, with the review requirement in `findings` (R5, C3).

The stage a run reached is a third fact, separate from the termination and from the lifecycle. `PROJECT_STAGES` in `packages/core/src/rebrand-v1.ts` runs `ingest`, `census`, `plan`, `review`, `compile` and `done`. The manifest records a stage per input file beside its outcome. A stage must never be read as a termination.

## Rules that hold when a run stops early

### A success may have no artifact

An inspection may succeed with a result and no artifact (R5, C3). A host must never require an artifact to record a success.

`assertFileOperationReport` in `packages/core/src/file-operation-v1.ts` refuses a succeeded single-file report with no output. It also refuses a failed or cancelled one that claims an output. That invariant must stay inside that adapter. It describes one file in and one file out. It must never be generalised to inspection, presentation or a run that writes several files.

### Committed artifacts are kept

A run that stops before completing must keep every artifact it committed, and must report each one under `artifacts[]` with its destination and state (R5, C3). That run terminates as `partial`, which is what `partial` is for. The nearest precedent does not yet do this. `resume()` in `packages/node-shell/src/rebrand-run-manifest.ts` clears `entry.outputs` when an input's bytes changed, so the files remain on disk while the record of them leaves the manifest. An operation adapter must retain those entries against the attempt that wrote them.

The write rules come from `packages/node-shell/src/rebrand-run-manifest.ts` and must never be relaxed. An output is written to a temporary name in the same directory and then renamed, so a half-written file never appears under its real name. A name is claimed with an exclusive create, so two writes of one name produce two files. A collision takes a numeric suffix and the entry records both the requested and the written name. `allocateFileName` in `packages/core/src/file-v1.ts` reserves the returned name immediately, including a generated suffix. `overwrite: true` is the caller stating the opposite intent and must be explicit.

There is no promise of universal rollback and no promise of exactly-once execution (R5).

### Retry reads committed effects, never the code alone

A transient error code must never by itself authorise a retry after an uncertain write (R5, C3). Retry eligibility must read the code together with the committed artifacts, the attempt identity in `attempt` and the operation's declared idempotency.

`isRetryable` in `packages/node-shell/src/rebrand-run-manifest.ts` reads the error code alone, against `RUN_RETRYABLE_ERROR_CODES`, which is `REBRAND_ERROR_CODES` less `RUN_PERMANENT_ERROR_CODES`. A failed entry that carries no code at all is retryable by default. That answer says which inputs to offer again. It is sound there because a retried input is re-hashed and resumed from its recorded stage. It is not a grant to repeat a committed effect. The model must add the committed-effect facts before a retry crosses a destination.

### An unknown completion is not a failure

A run whose acknowledgement was lost must be reported as unknown, never as failed (R5). This draft records the uncertainty on the affected entry in `effects[]`, and does not resolve whether an unknown commit terminates as `partial` or needs a value of its own. The table's `partial` means a commit that is known to have happened. The proof case in [Proof cases](proof-cases.html) settles both the field and the termination.

### Passive work commits nothing

Passive inspection, thumbnails, layout recalculation and reference testing must never commit a file-writing effect (plan section 7). The authored effect envelope enforces the rule, with grants bound to the operation, phase and attempt (R3, C6). The execution class the run uses is where a grant is enforced, never a generated inventory, which is lint. A hook that resolves after its attempt was cancelled must never commit a new effect. A `trusted-realm` run carries its stated limits and no strict claim, and [Evaluation and receipts](evaluation.html) specifies the classes. A replay must never silently repeat an external action. A replay uses captured effect results or a controlled simulation, unless a new execution authorises the actions again.

## Results with more than one artifact

A still export of a multi-artboard document fans out to one file per board. A PDF or a PPTX makes one page per board. An event kit is a ZIP of many files. An operation result is therefore a list of artifacts with a stable per-artifact identity, never one blob (R5, plan section 7.2).

The identity is the board id, the page index or the path inside the kit, and each of those is already a permanent identifier (R1). A caller can therefore address one artifact of a fan-out without re-reading the whole result. Whether the same instance at the same revision produces the same artifact ids on two runs is a draft decision. Plan section 7.2 requires the identity to be stable and says nothing about reproducing it across runs, so the fan-out export case in [Proof cases](proof-cases.html) settles it.

The `s` parameter is the selector and the model keeps it. `s` is reserved in `engine/src/url-mode.ts`. `s=2` is a one-based position in presentation order, any other value is a frame id, and an `.N` suffix picks a build step. `engine/src/frame-address.ts` resolves the value against the rendered pages for the web fan-out and for the CLI alike, so `?s=2&format=png` is a link to one artifact. The selector does not reach the formats that carry every frame by construction. `FRAME_FILTER_SKIP_FORMATS` in the same module excludes `pdf`, `zip`, `html`, `pptx`, `scorm` and the motion formats. A filter there would produce a one-page document where the format's own answer is the whole deck. A page index inside a multi-page container is therefore an artifact id in the result, not an address `s` resolves. `pdf-cmyk` is not in that set, because the web fan-out already renders one press-ready PDF per page. Build steps are presenter-only and a still export always shows every build.

## What each operation must specify

An operation declaration must state each of these (plan section 7.1):

- the input and result types and their cardinality;
- the resources, execution capabilities and permission scopes it requires;
- its declared effects, their trigger conditions and who owns each destination;
- its completion, review, blocked, failed, cancelled and partial semantics;
- its cancellation boundaries, its retry rules and its idempotency;
- whether a result can be returned without writing any output file.

A suite tests the features the suite declares. An operation declares what it supports. An operation that claims a suite and does not declare one of its core features fails that suite, because core features cannot be skipped (R8). An item that no claimed suite covers is reported as untested, never as covered. [Conformance and fidelity](conformance.html) specifies suites and features.

## Recording, receipts and the outcome

`recording` states what this run captured, what it retained and whether it can be replayed. The three are independent axes, and an operation may succeed with none of them (plan section 9.1). `receipt` would carry an `EvaluationReceiptV1` when the recording policy retains one. No such type exists in the tree. R4 lists it as new, and nothing is added to `packages/core` or `schemas/` in this wave. R15 lists what it would record, and [Evaluation and receipts](evaluation.html) specifies it.

An operation that is not recordable is still a valid operation (D11). A live-input tool and a local utility are the two cases the plan works through, and Q4 below carries their defaults.

## Open points

- **Q4. What "non-recordable" means for the first two cases, a local utility and a live-input tool.** Default from plan section 16: for a utility, capture off, retention none and replay semantic from pinned inputs. For live input, capture unsupported unless the person turns it on, retention session, replay none. Evidence that would change it: a regulated workflow that needs durable receipts for utilities.

The other open questions are carried in other chapters, each with its default. Q1 and Q5 are carried in [Conformance and fidelity](conformance.html). Q2 and Q3 are carried in [Constraints, authority and local choice](policy.html). Q6 is carried in [Status and open points](status.html).

## Precedents

- `packages/core/src/file-operation-v1.ts`
- `packages/core/src/file-v1.ts`
- `packages/node-shell/src/rebrand-run-manifest.ts`
- `packages/core/src/rebrand-v1.ts`
- `packages/core/src/rights-v1.ts`
- `packages/core/src/host-v1/export.ts`
- `engine/src/document-api.ts`
- `engine/src/url-mode.ts`
- `engine/src/frame-address.ts`
- `shells/cli/src/rebrand.ts`
- `shells/cli/src/validate.ts`
- `schemas/tool.schema.json`
- `community/agenda/tool.json`
- `services/mcp/src/tools.ts`
