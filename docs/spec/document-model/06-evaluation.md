# Evaluation and receipts

> This chapter is a draft for review, dated 2026-09-24.  

This chapter specifies how one operation is evaluated and what a run may record about itself. It restates the evaluation and recording contract in normative form. It adds R15 for the receipt, and it carries the review's correction that an unmet declaration is refused at the operation boundary. The operation shapes and the outcome a terminated run returns are specified in [Operations and outcomes](operations.html). The typed values, the budgets, the execution classes and the clocks this pipeline reads are specified in [Values, expressions, code and time](values-and-time.html). The rule set it evaluates against is specified in [Constraints, authority and local choice](policy.html).

## The pipeline is nine steps

The pipeline puts capability and operation selection ahead of dependent work (plan section 9). It states which step depends on which. It does not state that one run passes through every step. An operation that produces no artifact still reaches step 8, because step 8 is also where a typed result is returned. It simply terminates with a result and an empty `artifacts[]`, which R5 keeps apart and C3 requires (R5, C3, D11).

![The nine evaluation steps in order, with inspection before any document code runs and refusal raised at the operation boundary rather than at parse time](/info/diagrams/document-model/evaluation-pipeline.svg)

1. **Inspect and parse.** Read the package without executing document code. Validate the schema version, the integrity map, the structure, the declared limits and the extension declarations. Read `extensionsRequired` here and refuse later, at step 2.
2. **Select.** Choose the operation, the output target and the execution class. Determine the effective policy and the permitted capability envelope. Refuse here when a declaration read at step 1 is unmet for this operation.
3. **Negotiate.** Settle support and select the declared fallbacks before any dependent computation or effect. Resolve only permitted resources, against immutable revisions and digests.
4. **Snapshot.** Validate and snapshot the typed inputs and the authored state. Resolve token scopes, locale, clocks, seed and environment.
5. **Instantiate.** Expand components into an identity-preserving evaluation graph. Evaluate expressions and domain rules under their budgets. Reject invalid cycles and unresolved required values.
6. **Resolve.** Settle layout or other domain constraints and apply the declared invalidation when state, time or a measurement changes.
7. **Validate.** Check the plan or the output against the effective policy, including proposed repairs and findings.
8. **Act.** Render, present, return a typed result or commit the authorised effects.
9. **Report.** Return an outcome and the receipt the recording policy permits.

A host must run steps 1 and 2 before step 3, because a resource resolved for an operation that was never selected is work done outside the grant (R3). A host may merge later steps, and a host may repeat steps 5 and 6 under the invalidation rules (plan sections 9 and 8.3), so the numbering is a dependency order and never a pass count.

### Inspection runs no document code

Step 1 must never execute a tool's hooks, template or expressions. `validateDocument` in `engine/src/document-api.ts` is the shape: with a manifest target it answers through `validateManifest` in `engine/src/validate.ts` and runs nothing of the tool. A host must answer an inspection from declarations alone.

`compileDocument` in the same file calls `createRuntime`, which runs the `onInit` hook before it hydrates the template, so a compiled document is the product of execution and never the answer to an inspection. A host must never reach for the compile verb to satisfy step 1.

The declared dependency envelope and the dependencies discovered during execution must be reported separately (R15). The declared side is already answerable from `engine/src/document-api.ts` without running the tool; the discovered side is what the receipt's `inputs[]` records. A host that merges them cannot later report which resource the document declared and which one the run discovered while executing.

### Refusal happens at the operation boundary

An unmet requirement must be refused for the operation and the output target that need it, never at parse time for the whole package (R10, R11), which is the boundary the four gates in `packages/core/src/host-v1/apis.ts` and `schemas/tool.schema.json` already refuse at.

An unsupported motion extension must never prevent safe inspection of the same package. A host must therefore record the unmet declaration at step 1 and raise it at step 2, against the selected operation. The outcome for the refused operation terminates as `blocked`, which [Operations and outcomes](operations.html) specifies, and the refusal must name the missing item so a caller can act on it. [Capabilities, trust and extensions](extensions.html) specifies refusal by name.

One gate already refuses by name before any document code runs, though it is scoped per mount rather than per operation. `missingRequires` in `packages/core/src/host-v1/apis.ts` compares a manifest's `requires` against the optional host APIs a shell actually provides, and `engine/src/runtime.ts` throws before any hook runs. The model keeps the public `requires` field with the meaning it has today and scopes the refusal to the operation (R11).

## Dynamic dependencies stay inside the grant

Dynamic dependencies remain possible. A late resource or capability request must fit inside the grant the run already holds, or the run must stop and ask for an explicit additional grant (R3).

- A host must never widen a grant because a document asked it to. The document is the party being constrained.
- A grant is bound to the operation, the phase and the attempt (R3). A strict attempt that was cancelled, or that ran past its budget, must retain no usable write grant, even while its realm code is still running. Trusted compatibility execution keeps its stated limits and cannot make that promise, which is why the class a run used travels in the receipt (R3, C6).
- Nested execution must never acquire a power because its parent holds one (R3). A composed child runs in its own execution class and receives delegated powers explicitly, inside the depth and cycle bound `engine/src/bake.ts` applies before it starts.
- Passive inspection must never write through a hook (R3).

One precedent in the tree supports the first rule. `schemas/tool.schema.json` makes the network capability fail closed: without a `network.allowlist` block, or for a URL no entry matches, every `host.net.fetch` rejects, and `createNetAPI` in `packages/node-shell/src/net.ts` is where that rejection is raised for every shell. A late fetch to an unlisted host is refused rather than negotiated. The third rule has its own: the `ComposeAPI` contract in `packages/core/src/host-v1/compose.ts` requires the host to reject a nested render whose stack already holds the child's `toolId`, or that exceeds the maximum compose depth, so a child render is bounded before it starts.

The second rule has a measured cause. `HOOK_BUDGET_MS` in `engine/src/runtime.ts` races an async hook against its budget, and the comment records what the race does not do: the hook's own code keeps executing after the wait is abandoned, because there is no preemption inside the JavaScript realm it runs in. A grant that outlives the attempt would therefore let abandoned code commit an effect for a run that already terminated.

## Recording is three axes

Rendering, reconstruction, capture and retention are independent properties (D11). A run declares three axes together, and replay is the one that answers for reconstruction.

```text
draft shape

  recording
    capture     unsupported | off | on     can external observations be captured, and were they
    retention   none | session | durable   may the capture be kept, and for how long
    replay      none | semantic | byte     what a replay can promise under the same conformance suite
```

This is a draft shape for review, not a type. No shared type is frozen until the counterexamples in plan section 17 pass, so nothing is added to `packages/core` or to `schemas/` in this wave (plan status line; Codex recommendation).

The three must be read independently (D11). A reproducible transform may have no rendered frame. A visual interaction may retain no input recording. A recording may exist while replay is unavailable, because the executor that would replay it is missing. A host must never infer one axis from another, and a host must never treat `capture: unsupported` as a failure.

## An outcome is immediate, a receipt is conditional

Every operation must return an immediate outcome (R5, D11). A durable receipt and any retention of raw input are conditional on the recording policy.

Adopting this model must never turn a local utility into a permanently logged one (plan section 9.1, D11). A tool that declares `privacy: 'on-device'` in its manifest processes the person's own content, and `engine/src/runtime.ts` already stamps nothing into its output: no provenance metadata and no watermark. Retention for such a run follows the recording policy and defaults to none under Q4 below.

A receipt is therefore optional on the outcome. A caller must treat an absent receipt as "no receipt was retained" and never as "the run was not evaluated".

## EvaluationReceiptV1

Where the recording policy retains one, a receipt records the facts R15 names.

```text
draft shape

  EvaluationReceiptV1
    schemaVersion
    definition        { id, version, revision digest }
    instance          { id, revision }
    inputs[]          input and resource digests, with the redaction state of each
    fonts[]           { family, weight, style, source, file?, sha256? } per resolved face
    shaping           { engine, version }
    textFallbacks[]   runs that stayed live text: { text, reason }
    emoji             { set, version, treatment }
    models[]          { id, version, licence } for any on-device model the run used
    conversions[]     unit and DPI conversions applied, with the site that applied each
    clocks            the clocks the run read and the value each supplied
    environment       { shell, engine, suite versions, execution class }
    policy            { version, issuer, attestedAt }, plus the rules a waiver deactivated
    fallbacks[]       the declared fallbacks this run selected
    findings[]        the same finding shape the outcome carries
    results[]         result identities, including one entry per artifact of a fan-out
    effects[]         the effects this run committed, each with its declared envelope entry and its grant, recorded where the recording policy permits (R3, C6)
    repeatability     the declared repeatability class for this run
    redactions[]      { field, reason }, one entry per field withheld or reduced
    omissions[]       { field, reason }, one entry per field this host could not observe
```

This is a draft shape for review, not a type. No shared type is frozen until the counterexamples in plan section 17 pass (plan status line; Codex recommendation).

Three rules hold over every field.

- A receipt must record what was measured, never what was assumed. `AttributionReceiptV1` in `packages/core/src/rights-v1.ts` is the precedent: it carries `expected` and `observed` as separate lists and a `checks` array, and its own contract states that it describes one output measured after writing.
- A receipt must be scoped to the revisions it names (C7). A receipt describing an earlier revision must be retained as a historical record when that revision changes, and must never describe the new revision as accepted.
- A receipt must never be required for an operation to succeed (D11).

An effect recorded here is an observation, never a permission: a receipt that lists an effect does not authorise it on a later run.

### Fonts, shaping and live text

A receipt must record the font files a run resolved, by digest, together with the shaping engine and its version (R15).

`LollyFontEntry` in `shells/web/src/lib/lolly-pack.ts` is the precedent and it already draws the distinction the receipt needs. It records a face as identity rather than bytes. It digests the whole source file rather than a subset, because a subset is a function of the text. And it allows `source: 'platform'` with no file and no digest, as the record of a run that drew in whatever the machine had installed. A receipt must keep that third case as a named state, because a run with no resolvable digest is a different claim from a run with one.

A receipt must record every text run that stayed a live `<text>` element, and a host must never claim font-independent fidelity for such a run (R15). The fact already exists and goes nowhere durable. `shells/web/src/bridge/export-svg-text-runs.ts` logs a warning and keeps the element when an outline cannot be produced. `shells/cli/src/run.ts` collects the same runs through an `onTextFallback` callback, reports each with its reason and refuses the export under `--strict`. The comparator probe in the plan's evidence hit exactly this: one caption kept live text because `dominant-baseline` shifted its baseline. The CLI emitted the warning to standard error and the product kept nothing, so the probe had to capture it by hand into `environment.cliWarnings` of `pixel-comparator-results.json` (F14).

`docs/determinism.md` already states the public limit this serves: vector export converts text to outlines, so the bytes depend on which font file was resolved, and a machine with a different font set is a different render. The receipt records that dependency so a reader can check it afterwards.

### Clocks

Clocks are explicit and separate, and a receipt must name which ones fed the run and with what values (R15, plan section 8.5).

| Clock | What it decides | Precedent |
|---|---|---|
| Event | What is happening. | `docs/agenda.md`: the event clock decides which sessions are happening. |
| Presentation | Which scene and which title position to show. | `docs/agenda.md`: the presentation clock decides the scene and the title position. |
| Reference | A frozen moment for review. | `docs/agenda.md`: reference time fixes a moment for review. |
| Media | Position inside one clip. | `shells/web/src/bridge/frame-clock.ts`: a driven frame receives a normalised loop time and the clip's real length in seconds. |
| Wall | When the export ran. | `shells/web/src/lib/lolly-pack.ts`: the package manifest records an export time. |

A run that read no clock must record none (R15). A host must never substitute wall time for a clock the document did not read (R15).

### Units and DPI conversions

Each unit and DPI conversion a run applied must be recorded with the site that applied it (R15, plan section 8.4).

`engine/src/units.ts` holds the conversion maths and must stay the only place that holds it (plan section 8.4). The conversion is applied at several boundaries, one per export format in each shell's export bridge, which is why a receipt records the site as well as the number. Three DPI conventions are live at once: the rebrand reference space at 96 (`REBRAND_REFERENCE_DPI` in `packages/core/src/rebrand-v1.ts`), the export default at 300 (the `dpi` parameter in `engine/src/url-mode.ts`) and a Design document's own resolution (the `documentDpi` input in `community/design/tool.json`). A receipt that records the converted number without the convention cannot be read back, so both must travel.

### Emoji, models and policy

- The emoji set and the brand treatment must be recorded (R15). The session record already carries the pair as a stamp at format 3 and keeps it as the two reserved parameters verbatim rather than as resolved bytes (`engine/src/session-record.ts`), and the receipt must record the same identity.
- Any on-device model must be recorded by identity and version (R15). `packages/node-shell/src/ml/matte-models.ts` carries a version string per model and copies it verbatim into the provenance edit step, which is the identity a receipt reuses.
- The effective policy version, its issuer and the execution class the run used must be recorded (R15, R3). Where a local waiver deactivated a rule, the receipt must list the bypassed rules, and measured conformance to the unmodified rule reads failed, never passed (R6). The waiver is recorded as an exception on the acceptance, never on the report (R8).

## Redaction is an explicit field

A receipt must never imply that it holds every private input (R15).

- A field withheld for privacy must appear in `redactions[]` with a reason.
- A field this host could not observe must appear in `omissions[]` with a reason.
- An absent field with no entry in either list means the run did not read that fact at all.

A reader must therefore be able to tell three states apart: recorded, withheld and never observed. A host that drops a field silently collapses those three into one answer.

A decision a person made must be recorded against the facts it was made about, never as a blanket permission. `RightsDecisionV1` in `packages/core/src/rights-v1.ts` is the precedent already shipping: a decision carries a fingerprint of the situation as it stood, and the evaluator applies the choice only while the facts still hash to it.

## Replaying an interaction

A claimed replayable interaction must reproduce the specified semantic state under the named conformance suite, from a pinned initial state and a normalised timestamped input trace (R15, R8).

- Live sensor or network observations must be captured as inputs or excluded from the claim.
- A replay must never silently repeat an external action. It uses captured effect results or a controlled simulation, unless a new execution authorises the actions again (R3).
- A `byte` replay claim must be made only for a run that recorded every fact the bytes depend on, because byte identity is a separate and stronger claim than semantic identity (invariant 4). A run that fell back to live text, or that resolved a platform face with no digest, may claim `semantic` at most, since the receipt cannot name the file the recipient will shape with (R15, F14).
- A comparison that could not finish must never count as a replay (C8). `compareSources` in `engine/src/compare.ts` answers `undetermined` when a source was incomplete or a budget ran out, reports completeness separately and lists its own limitations. A caller must read that answer as not proven, never as equal.

One normalisation is needed before any comparison. Signing timestamps and provenance containers need not be byte-identical for a visual or semantic result, and `stripSvgC2pa` in `packages/node-shell/src/lolly-file.ts` is the existing normalisation both sides of a comparison must apply. `docs/determinism.md` states the reason: a default export is signed afresh with a new key and timestamp on every run, so two correct runs differ in exactly that block.

A live run is a weaker case again. `engine/src/runtime.ts` runs the `onFrame` and `onLevel` hooks once per frame or sample, leaves them outside the time box and drops overlapping samples so a slow per-frame render throttles itself. The frame count of such a run is an observation of the machine that ran it. A host must therefore never claim a byte replay of a live-input run, and Q4 below carries the default for what it records instead.

## Open points

- **Q2. Granularity and persistence of local rejection.** Default from plan section 16: per rule, instance-scoped, recorded on the session record with a fingerprint (R6). It touches this chapter because the receipt lists the bypassed rules, and the granularity of the waiver decides what there is to list. Evidence that would change it: a need to share a rejected state as a reusable tool.
- **Q3. What freshness a governed-claim export needs, and who states it.** Default from plan section 16: freshness is a policy rule the instance issues, with a validity interval and a stated behaviour when it cannot be established. With no such rule, the held policy is enforced and the receipt says which policy version was evaluated and when it was last attested. Evidence that would change it: an organisation that needs a hard deadline, or a fully offline site.
- **Q4. What "non-recordable" means for the first two cases, a local utility and a live-input tool.** Default from plan section 16: for a utility, capture off, retention none, replay semantic from pinned inputs. For live input, capture unsupported unless the person turns it on, retention session, replay none. Evidence that would change it: a regulated workflow that needs durable receipts for utilities.

Q1 and Q5 are answered in [Conformance and fidelity](conformance.html). Q6 is answered in [Status and open points](status.html).

## Precedents

- `engine/src/runtime.ts`
- `engine/src/document-api.ts`
- `engine/src/validate.ts`
- `engine/src/session-record.ts`
- `engine/src/units.ts`
- `engine/src/url-mode.ts`
- `engine/src/bake.ts`
- `engine/src/compare.ts`
- `packages/core/src/host-v1/apis.ts`
- `packages/core/src/host-v1/compose.ts`
- `packages/core/src/rights-v1.ts`
- `packages/core/src/rebrand-v1.ts`
- `packages/node-shell/src/lolly-file.ts`
- `packages/node-shell/src/net.ts`
- `packages/node-shell/src/ml/matte-models.ts`
- `shells/web/src/lib/lolly-pack.ts`
- `shells/web/src/bridge/export-svg-text-runs.ts`
- `shells/web/src/bridge/frame-clock.ts`
- `shells/cli/src/run.ts`
- `schemas/tool.schema.json`
- `community/design/tool.json`
- `docs/agenda.md`
- `docs/determinism.md`
