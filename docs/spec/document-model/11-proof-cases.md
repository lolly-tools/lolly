# Proof cases

> This chapter is a draft for review, dated 2026-09-24.  

This chapter lists the cases the document model must be proved against. Each case is a paper example now and an executable fixture later (plan section 17). None of them is built.

The order of work matters. The plan's section 18 places these cases before any shared type is frozen, so a case that fails is a reason to change the model rather than the fixture. No type is added to `packages/core` and no schema to `schemas/` in this wave.

What a fixture must state is specified in [Conformance and fidelity](conformance.html): its inputs, its immutable dependencies, the reference environment, the features it claims, the expected artifact or typed result and the comparison rules. This chapter states the cases and what each one must show.

## How to read a case

Each case carries two parts. The setup lists what is involved: the records, the operation and, where it decides the answer, the execution class. The expected outcome is what must hold for the case to pass.

None of the 23 has a fixture yet, so the status of every case below is the same until one is built.

A case states the resolution or confirmed decision it tests. Plan section 17 lists the cases and their required evidence; the ids in this chapter are this chapter's own mapping of each case onto the decisions in plan section 2 and the corrections in section 0.1.

A case must never be reworded to match an implementation that failed it. That is why the plan's section 18 places these fixtures before any shared type is frozen: a failure is evidence about the model, not about the fixture.

Twelve cases come from the three pilots and the utilities. Eleven more were added by review: four after the first round and seven from the final review's findings C1 to C7. The eleven are grouped below under the resolution each one tests.

## Pilot and utility cases

**1. Constrained Design, two people.** One authored Design tool is opened twice, once in governed execution and once unmanaged (D12).
Expected outcome: governed execution must enforce the mandatory rules, and the unmanaged person may reject a waivable creative rule without mutating the original definition and without keeping a false approval claim (R6, `packages/core/src/design-tool-v1.ts`).

**2. Chart inside Design and inside another tool.** One chart definition is placed in a Design document and in a second tool, each with its own dataset.
Expected outcome: typed data bindings, public overrides, brand rules and accessibility metadata must survive composition as a `chart` layer, and the two instances must keep independent identity and state (R14, `packages/core/src/chart-v1.ts`).

**3. Design across print, raster and motion.** One authored Design document is rendered to a print target, a raster target and a motion target.
Expected outcome: one authored contract must serve the three output targets with explicit units, resources, timing and stated differences between the outputs (D2, `engine/src/units.ts`).

**4. Agenda in interactive web, slides and motion.** One schedule is published as an interactive page, as slides and as a video.
Expected outcome: the three outputs must preserve the event, presentation and reference clocks, the presentation state and its transitions, the reading order and the declared differences between them (D2, R15, `docs/agenda.md`).

**5. Unpack without a canvas.** The Unpack route takes a design file apart through an operation adapter, and that route has no manifest (R13, `shells/web/src/views/pdf-extract.ts`).
Expected outcome: inspection must stay passive and extraction must return a typed result with its effects declared (R5). A cancellation and a failed item must each have a stated outcome (R13).

**6. Rebrand with partial completion.** A reviewed plan is compiled over a deck and the run stops partway.
Expected outcome: intentional changes and protected content must stay distinguishable, and review, retries and output ownership must stay explicit under `OutcomeV1` (R5, `packages/node-shell/src/rebrand-run-manifest.ts`).

**7. Non-recorded live operation.** A tool that reads live input runs with capture off.
Expected outcome: the operation must succeed without retaining raw input, replay must not be offered and the immediate outcome must be useful on its own (D11, R15).

**8. Unknown extension.** A document carrying an extension this host does not implement is opened.
Expected outcome: safe inspection and byte preservation must work, and an edit that touches the extension's declared dependency scope must be refused or offered as an explicit lossy copy before any data changes (R10, [Capabilities, trust and extensions](extensions.html)).

**9. Flattened chart with matching pixels.** A chart nested through `composes` is compared with the same chart as a native layer.
Expected outcome: the appearance check must pass while the editable round trip must fail, because the nested render returns an image asset and not a chart (R14, `packages/core/src/host-v1/compose.ts`).

**10. Motion with a brief defect.** A short animation carries a defect between two sampled progress points.
Expected outcome: the timing, transition and coverage checks must expose the defect that percentage samples alone miss (D9, R12).

**11. Missing or conflicting requirements.** One run is given a missing font, an unsupported capability and two conflicting required rules.
Expected outcome: each must fail at the boundary that owns it, with no silent substitution and no committed effect. The missing font must fail at the resource boundary (R15). The unsupported capability must fail at the requirement gate, scoped to the affected operation (R11). The two conflicting required rules must stop the affected operation at the policy boundary, reported with both ids (R6, `engine/src/runtime.ts`).

**12. Legacy compatibility.** Representative existing tools run unchanged through an adapter.
Expected outcome: their behaviour must be preserved, and the adapter must report its trust, editing and repeatability limits rather than inherit a strict claim (R3, `engine/src/hook-worker-core.ts`).

## Cases added by the review

### Typed payloads and one authoritative source (R1, R14, C1)

**13. Typed payload round trip.** A nested chart is serialised, reopened, copied, patched, synchronised and exported.
Expected outcome: datasets, encodings and accessibility metadata must survive every step, two concurrent edits to one payload must produce the documented outcome and no step may turn the chart into a string or a flattened image (R14, C1). The collaboration row value is a string, a number, a boolean or null, so a chart must travel as its own payload record (`packages/core/src/canvas-op-v1.ts`, `schemas/canvas-op.schema.json`). The mechanism is specified in [Source rows, payloads and patches](source-and-patches.html).

**14. Second coordinate domain.** Design's `3d` layer carries its scene as a URL-encoded string inside a scalar field today (`community/design/tool.json`).
Expected outcome: that scene must become a typed payload record referenced by the row, without breaking the frozen blocks wire order and without breaking an already shared link (R1, `schemas/blocks-wire-order.json`).

### Concurrent merges (R1, C2)

**15. Concurrent reparent.** Five merges: Alice reparents A into B while Bob reparents B into A, a delete against a reparent, two concurrent atomic choices, an envelope whose final operation is invalid and two patches against one mutable head (C2).
Expected outcome: each merge must be run in both delivery orders and across a reconnect and a checkpoint, and each invalid result must block evaluation with both edits kept for repair (R1). The reference model converges per field and produces the cycle in either order, so validation must run after convergence rather than on each patch alone (`packages/core/src/canvas-op-v1.ts`). The MCP path transforms supplied inputs and holds no head, so its outcome must record that no base revision was checked (`services/mcp/src/tools.ts`).

### Outcomes that are not one file (R5, C3)

**16. Outcomes beyond one file.** Five runs are compared (C3): a zero-artifact inspection, a batch cancelled after two of three writes, a failure after a committed write, an unknown completion after a lost acknowledgement and a Rebrand plan that is `ready` before any export.
Expected outcome: the inspection must succeed with a typed result and no artifact (R5). The cancelled batch must keep both committed files (R5). The failure after a committed write must keep that artifact under `artifacts[]` (R5). The unknown completion must be reported as unknown and never as failed (R5). The Rebrand plan that is `ready` must read as a lifecycle state and never as a succeeded export (R5). Each must map onto the persisted legacy vocabularies without changing them: the single-file invariant stays inside its adapter (`packages/core/src/file-operation-v1.ts`), and `pending` and `ready` stay run lifecycle states beside the outcome (`packages/node-shell/src/rebrand-run-manifest.ts`). [Operations and outcomes](operations.html) specifies the split.

**17. Fan-out export.** A three-artboard document is exported as stills.
Expected outcome: one outcome must carry three artifacts with stable per-artifact ids (R5, plan section 7.2). Each artifact must be addressed by the reserved `s` state selector and never by an index into the artifact list. The selector carries a frame id where the document stamps one and a one-based position in presentation order where it does not (`engine/src/url-mode.ts`, `engine/src/frame-address.ts`).

### Local choice and the offline governed client (R6, R7, C4, C5)

**18. Local waiver.** An authored approved-font rule is rejected locally, the same rejection is then attempted under a Lolly Work overlay that forbids it and then a fingerprinted fact changes (C4).
Expected outcome: the unmanaged operation must complete with an explicit exception, the governed attempt must be blocked and the changed fact must require a fresh decision (R6). Measured conformance to the unmodified rule must read failed or excepted and never passed (R6, C4). The recorded-decision pattern is the session record's rights decisions, keyed by work and kind with a fingerprint (`engine/src/session-record.ts`). The web view, the CLI and the MCP validation projection must agree on all three results (C4). [Constraints, authority and local choice](policy.html) specifies the resolution order.

**19. Offline governed client.** A governed client loses its connection and the same authored document is opened 25 hours later (C5).
Expected outcome: the document must open and stay usable, a governed claim must follow the explicit freshness rule and the receipt must name the policy version it evaluated rather than claim current online approval (R7). A host that cannot be reached answers `unreachable`, and a stale mark must stay reserved for an update that could not be brought down (`shells/web/src/lib/design-system/hosted.ts`). Leave must keep the person's sessions and perform its documented cleanup, and an editable copy must be a separate action with known dependencies and no inherited governance claim (R7, `shells/web/src/lib/instance-leave.ts`).

### Effect authority (R3, C6)

**20. Effect authority.** Four attempts: a bracketed member access and a local alias against a strict grant, a write through a hook during passive inspection, a hook that resolves after cancellation and a trusted compatibility run (C6).
Expected outcome: an alias and a dynamic access must not bypass a strict grant (R3). Passive inspection must not write through a hook (R3). A hook that resolves after cancellation must not commit a new strict effect (R3). A trusted run must never receive a strict claim (R3). The generated inventory is a pattern over `host.<api>` and misses both alias forms, so it is lint and never authority (`scripts/tool-requires.ts`). A hook that overran its budget keeps running in the realm, which is why a grant binds to the operation, the phase and the attempt (`engine/src/runtime.ts`). [Values, expressions, code and time](values-and-time.html) specifies the execution classes.

### Preservation across save and restart (R10, R11, C7)

**21. Preservation round trip.** A future optional extension is imported, saved locally, restarted, edited in an unrelated permitted way and exported (C7).
Expected outcome: the opaque bytes must compare equal after that round trip (R10). A touch on a protected dependency must be refused or routed through an explicit lossy copy (R10). An older client must refuse by its reader gate (R11). A stale receipt must never describe the new revision as accepted (R11). Additive parts already travel under the integrity map while the manifest is rebuilt from typed fields on every save, so a retained package state must connect those two boundaries (`shells/web/src/lib/lolly-pack.ts`). [Packaging, identity and migration](packaging.html) specifies that state.

### Fidelity evidence (R9, R15, C8)

**22. Vanished caption.** A render loses its caption, and no whole-image measurement separates it from a harmless half-pixel shift or a resample: the three pairs sit within 0.2 points of each other on changed pixels and on SSIM (C8, `plans/276-document-model-evidence/README.md`).
Expected outcome: the three checks must read the produced artifact or an independently extracted representation of it, never the authored source (R9, C8). They must fail that render. An unchanged result must pass. An accepted shift must pass only inside a calibrated band. Text with similar ink but the wrong content must fail (R9). An incomplete extraction or an undetermined comparison must never count as a pass (`engine/src/compare.ts`). PNG alpha, PDF page boxes and colour intent must each have their own checks, and a white RGB fixture must never be generalised to CMYK print conformance (C8). The measurements that motivated this case are in [Conformance and fidelity](conformance.html), and this fixture must replace them before any number enters a suite (C8).

**23. Live-text fallback.** A run whose text stayed a live `<text>` element instead of an outline is exported.
Expected outcome: the receipt must record that fallback per run, with the resolved font files by digest, the shaping engine version and the emoji set and treatment (R15). The run must not claim font-independent fidelity (R15). The command line already warns on an unresolvable font or a baseline shift it cannot place exactly, and a strict run promotes that warning to a refusal (`shells/cli/src/svg-outline.ts`). Today that fact reaches standard error, the `--json` envelope's `warnings` list and, under `--strict`, the exit code, but never a receipt (`shells/cli/src/output.ts`, `shells/cli/src/envelope.ts`). The receipt is the gap this case closes.

## What must never pass

For every admitted visual suite, schema validity alone must never pass the gate (D3, plan section 17). For an action-only operation, a fabricated preview must never stand in for the real outcome (D11, plan section 17).

Two further limits follow from the same rule. A skipped test must never be recorded as a pass (R8). A comparison that was cut short by its budget must never be recorded as a pass, and it must stay distinguishable from a harmless truncation of displayed detail (R9, `engine/src/compare-budget.ts`).

This chapter makes no conformance or reproducibility claim beyond the ones `docs/determinism.md` already makes, and it states no threshold.

Spatial and fabrication examples stay paper probes in this wave (D5). They test whether an extension boundary holds, and they are not a commitment to build those suites.

## The five that come first

The plan's section 18 names five of these cases as the ones that run before any shared type is frozen, because each one carries contract semantics that a type would otherwise settle by accident.

| Order | Case | What a failure would change |
|---|---|---|
| 1 | 13, typed payload round trip | Where a structured value lives and how it synchronises (R1, R14) |
| 2 | 15, concurrent reparent | What a revision covers and where a merge is validated (R1) |
| 3 | 16, outcomes beyond one file | Whether a typed result, the committed artifacts and a termination stay separate (R5) |
| 4 | 18, local waiver | Whether a recorded local decision has any effect (R6, D7) |
| 5 | 21, preservation round trip | What is preserved across save, restart and an older client (R10, R11) |

The patch envelope and the source-aware diff land when their semantics are fixed in [Source rows, payloads and patches](source-and-patches.html) and [Packaging, identity and migration](packaging.html), not before (plan section 18). Cases 13, 15 and 16 are the evidence those semantics are settled.

## Open points

- **Q1. The first editable interchange routes per pilot.** Default from plan section 16: the four routes and three edits named in [Conformance and fidelity](conformance.html). No case in this chapter yet covers a route end to end: cases 2 and 9 test only the chart half of an editable round trip, so a route fixture is owed when Q1 is answered. Evidence that would change it: a customer route that outranks them.
- **Q2. The granularity and persistence of a local rejection.** Default from plan section 16: per rule, instance-scoped, recorded on the session record with a fingerprint, which is what case 18 asserts. A derived tool revision is a Design tool export and is not part of 0.1. Evidence that would change it: a need to share a rejected state as a reusable tool.
- **Q3. What freshness a governed-claim export needs, and who states it.** Default from plan section 16: freshness is a policy rule the instance issues with a validity interval and a stated behaviour when it cannot be established, which is what case 19 asserts. With no such rule the held policy is enforced, and the receipt records the policy version it evaluated and when it was last attested. Evidence that would change it: an organisation that needs a hard deadline, or a fully offline site.
- **Q4. What non-recordable means for a local utility and a live-input tool.** Default from plan section 16: for a utility, capture off, retention none and replay semantic from pinned inputs. For live input, capture unsupported unless the person turns it on, retention session and replay none. Case 7 tests the second. Evidence that would change it: a regulated workflow that needs durable receipts for utilities.

The other open questions are settled in other chapters. Q5 is answered in [Conformance and fidelity](conformance.html). Q6 is answered in [Status and open points](status.html).

## Precedents

- `packages/core/src/canvas-op-v1.ts`
- `packages/core/src/chart-v1.ts`
- `packages/core/src/design-tool-v1.ts`
- `packages/core/src/file-operation-v1.ts`
- `packages/core/src/host-v1/compose.ts`
- `packages/node-shell/src/rebrand-run-manifest.ts`
- `schemas/canvas-op.schema.json`
- `schemas/blocks-wire-order.json`
- `engine/src/runtime.ts`
- `engine/src/compare.ts`
- `engine/src/compare-budget.ts`
- `engine/src/frame-address.ts`
- `engine/src/session-record.ts`
- `engine/src/units.ts`
- `engine/src/hook-worker-core.ts`
- `engine/src/url-mode.ts`
- `services/mcp/src/tools.ts`
- `scripts/tool-requires.ts`
- `shells/cli/src/envelope.ts`
- `shells/cli/src/output.ts`
- `shells/cli/src/svg-outline.ts`
- `shells/web/src/lib/lolly-pack.ts`
- `shells/web/src/lib/design-system/hosted.ts`
- `shells/web/src/lib/instance-leave.ts`
- `shells/web/src/views/pdf-extract.ts`
- `community/design/tool.json`
- `docs/agenda.md`
- `docs/determinism.md`
- `plans/276-document-model-evidence/README.md`
