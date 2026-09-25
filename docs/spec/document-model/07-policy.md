# Constraints, authority and local choice

> This chapter is a draft for review, dated 2026-09-24.  

A constraint is a rule the software enforces, not guidance a style guide offers (`docs/constraints.md`). Constraints can travel with a tool and can also be supplied by Lolly Work (D6). This chapter specifies how those sources compose into the one rule set an evaluation ran under, which this model calls the effective policy.

Three separate decisions are kept apart throughout: a creative rule, structural validity and a device grant. Rejecting an approved-font rule must never make an invalid graph valid, and it must never grant code a device power (R6). A single control labelled "accept constraints" must never combine brand acceptance, code trust and device permission (R6).

This chapter restates plan section 10 in normative form, with the correction the review recorded as C4 and the correction it recorded as C5. The pipeline step that determines effective policy is specified in [Evaluation and receipts](evaluation.html). The suites and reports that measure a result are specified in [Conformance and fidelity](conformance.html). Lolly Work is a separate repository, and a `lolly-work/` path in this chapter is a file in that checkout rather than in this tree.

## What a rule is

A rule is a typed predicate with an identity, so that a finding can name it and a waiver can be recorded against it (R6).

```text
draft shape

  RuleV1
    id              permanent within its issuer's namespace
    revision        changes when the predicate or its parameters change
    issuer          who placed the rule: an instance overlay, the tool author, a person
    scope           the inputs, rows, collections or output targets it applies to
    class           advisory | waivable-creative | structural
    severity        how a violation is reported when the rule is active
    phase           the validation phase it runs in, per the evaluation pipeline
    predicate       an ExpressionV1 (R2, plan 194's JSON AST, defined there and not built),
                    evaluated under its budget
    repair?         guidance for the patch a repair would propose
```

This is a draft shape, not a frozen type. Nothing is added to `packages/core` or `schemas/` in this wave, and the plan's section 18 orders the counterexample fixtures before any of it is frozen.

Every enforced rule and every exception must name its issuer (R6). Lolly Work already carries that attribution where an operator supplied it. `resolveInputAccess` in `lolly-work/server/src/policy/overlay.ts` copies the overlay's display name onto `by` and the rule author's text onto `reason` on every matched rule. Both stay absent when the overlay is unnamed or the rule carries no reason. The question "why is this locked" is answered by the same resolution that locked it, so the answer and the lock can never disagree. A Kubernetes reader will recognise the arrangement: an issuer here does what a field manager does there (D13). This model closes the remaining case. An issuer is required, not optional, so an unnamed overlay must never lock an input while naming nobody.

## Three rule classes

A rule must declare one of three classes (R6, C4). The class decides who, if anyone, may set the rule aside.

| Class | Meaning | Who may set it aside |
|---|---|---|
| Advisory | A preference. A violation is reported and never stops the operation. | Nobody needs to: it does not block. |
| Waivable creative | An authored creative rule, such as an approved font or a palette. | The authority for this execution, recorded as an exception. |
| Structural | Structural validity, a required input or a device grant. | Nobody. A waiver against a structural rule must be refused. |

The review found the plan alternating between "the stronger rule wins" and "both rules conflict" without saying which case applied (C4). The class is what decides. A waivable creative rule may be deactivated by a recorded waiver. A structural rule may not, whatever the context (R6).

## The three layers

Rules reach an evaluation from three layers. Each layer must name the issuer of every rule it contributes (R6).

![Authority decided first, then the applicable exceptions, then the active rule set composed from the instance overlay, the authored rules and the local decisions, then evaluation, with the issuer carried on every edge.](/info/diagrams/document-model/policy-layers.svg)

**1. Instance overlay, supplied by Lolly Work.** `lolly-work/server/src/policy/overlay.ts` defines `AccessLevel` as `editable`, `choice`, `locked` or `hidden` per input and group, with an optional fixed `value`, an allowed set and a written `reason`. The same overlay carries an `enforce` block with `formats`, `c2pa`, `watermark` and an `escalation` string that points at an approval chain. `lolly-work/server/src/policy/org-config.ts` resolves that overlay per caller into `OrgConfigPayload.tools`, where a hidden tool is absent rather than marked, and folds the result into one `policyVersion` string that behaves as an ETag. `checkParams` in `lolly-work/server/src/policy/overlay.ts` refuses a locked, hidden or out-of-set parameter at the render route (`lolly-work/server/src/render/pipeline.ts`). The refusal carries the same `by` and `reason` the shell shows, so the overlay is enforcement and not presentation.

**2. Authored rules, travelling with the tool.** `packages/core/src/design-tool-v1.ts` defines `DesignInputV1.approved` as an approved value list, `fixedInputs` on each `DesignChoiceV1` option as the inputs that option owns, and `DesignTextRuleV1` and `DesignImageRuleV1` as per-property rules. The same module reports an `ownership` finding when an option and a reader input both write one property, which is the one-writer-per-property rule. Catalog and material locks belong to this layer too: `brandLock` on a tokens asset in `schemas/asset.schema.json` makes a brand authoritative and disables brand customisation. A hosted design system carries the material form of the same lock. `DesignSystemRecord.locked` in `shells/web/src/lib/design-system/registry.ts` is set from the catalog's `brandLock`, and it is what makes hosted colours, type and logos read-only. That lock is why "Make an editable copy" is a separate act rather than an edit.

**3. Local decisions.** A person's recorded waivers and exceptions. `engine/src/session-record.ts` already carries `rightsDecisions` on the instance at format 4, and `packages/core/src/rights-v1.ts` defines the decision it holds.

A layer must never be read as a precedence order on its own (C4). The order in which rules are composed is specified next, and authority comes first.

## The resolution order

Effective policy resolves in four steps, in this order, and a host must never reorder them (R6, C4):

1. **Authority.** Decide who holds acceptance authority for this execution. In governed execution it is the Lolly Work administrator for the brand. Otherwise it is the local person using the client (D12).
2. **Exceptions.** Collect the exceptions that authority permits, including any recorded local waiver whose facts still match.
3. **Active set.** Compose the active rule set from the rule-bearing layers, the instance overlay and the authored rules, then deactivate each rule a permitted exception names. The local-decision layer contributes no rules of its own: it acts here, through the exceptions collected in step 2.
4. **Evaluate.** Evaluate the active rules and report the findings.

Composing first and consulting the person afterwards was the fault the review named (C4). A recorded rejection that never reaches the active set is a receipt entry and nothing more, which contradicts D7.

## Local waivers in unmanaged execution

In unmanaged execution an authorised local waiver must deactivate the named waivable creative rule, for the named instance and for the fingerprinted facts (R6, C4). The original rule must be preserved in the definition, and the waiver must be recorded on the instance.

The recording pattern already exists. `packages/core/src/rights-v1.ts` defines `RightsDecisionV1` with a `fingerprint` field, and `RightsEvaluationV1` carries a `situation` hash taken over the same facts with the decisions left out. A decision applies only while the facts still hash to that value. A changed source or format retires the choice rather than letting it answer for something it was never about. `engine/src/runtime.ts` exposes `setRightsDecision` and `setRightsDecisions`, and `engine/src/session-record.ts` persists the list.

A local waiver must follow the same three rules (R6):

- it states one rule id and one instance, and never a class of rules or a blanket setting;
- it carries the fingerprint of the facts it was made about, and a changed fact requires a fresh decision;
- it is recorded where the instance is recorded, so it survives a reload the way `rightsDecisions` does.

Measured conformance to the unmodified rule must read failed or excepted, never passed (R6, C4). The receipt must list the rules a run bypassed (R6), among the fields R15 requires of it. A waiver changes what this evaluation enforced, and it never changes what a suite measured.

A local waiver must never deactivate a structural rule or grant a device capability (R6). Device capabilities stay in the `capabilities` list of `schemas/tool.schema.json` and are granted by the host, not by a rule decision.

## Governed exceptions

In governed execution only overlay-permitted exceptions apply, and the document must never grant itself one (R6). A rule that arrives with the tool must never authorise its own bypass. A person editing under an overlay that forbids an exception must never be granted one.

Where the overlay carries an approval chain, the exception is a request rather than a decision. `lolly-work/server/src/approvals/engine.ts` defines a chain as an ordered list of steps. Each step has an eligible group and a step rule of `any`, a quorum or `all`. Each act is evaluated with the actor's identity, so the submitter can never clear their own request. An approval state moves through `submitted`, `in_review` and then one of `approved`, `rejected` or `withdrawn`. An exception granted this way records the approval it came from.

## Conflicts stop the operation

When two active required predicates conflict, the affected operation must stop, and the report must carry both rule ids and the affected values (R6). A host must never choose one of the two silently, and it must never invent a repair to reconcile them.

This is the case the class table does not cover, because neither rule is waivable and neither is advisory. Stopping is the outcome, and the outcome carries a `blocked` termination as specified in [Operations and outcomes](operations.html).

## The context table

| Context | Behaviour |
|---|---|
| Local person accepts the constraints | Evaluate against them and expose the findings. |
| Local person rejects or relaxes a constraint | Deactivate the named waivable creative rule for this instance and these facts. Keep the original definition. Record the waiver against the rule id and the fingerprint on the instance. A changed fact needs a fresh decision. The receipt lists the bypassed rules. |
| Governed execution | Apply the authenticated overlay and the exceptions it permits. The document must never grant itself an exemption. |
| Required rules conflict | Report both rule ids, the affected values and the conflict. Stop the affected operation. |
| Governed client offline | Keep enforcing the policy the client holds. Report the four facts below separately. Apply any explicit freshness rule the policy carries. Keep cached work usable. |

## A governed client that loses its connection

A governed client that loses its connection must keep enforcing the policy it holds, and nothing relaxes (R7). The review found the plan describing offline behaviour the design system code does not have, so the four facts below are stated as four separate answers rather than one status (C5).

| Fact | What it answers | Where the tree answers it today |
|---|---|---|
| Refresh due | Has the check interval lapsed | `ORG_CONFIG_TTL_MS` in `shells/web/src/org/index.ts` for the organisation policy, against the `policyVersion` ETag (`lolly-work/server/src/policy/org-config.ts`); `HOSTED_CHECK_INTERVAL_MS` in `shells/web/src/lib/design-system/hosted.ts` for a hosted design system |
| Update known | Was a change detected that could not be brought down | The `stale` outcome of `refreshHostedDesignSystem` |
| Validity | Is the held policy still valid on its own terms | Represented today only as a cache horizon, and the wrong way round: `ORG_CONFIG_TTL_MS` (24 hours) in `shells/web/src/org/index.ts` makes `readCachedOrgConfig` evict a held copy past that age, after which the boot path fails closed. This chapter's rule replaces that horizon with an explicit validity rule. |
| Attestation | When was the policy last attested by its issuer | Not represented today; `policyVersion` identifies the policy, not its attestation |

`refreshHostedDesignSystem` in `shells/web/src/lib/design-system/hosted.ts` returns `unreachable` when the host cannot be reached, and it returns `stale` only after a detected change failed to import. `checkHostedDesignSystems` skips the sweep when the browser reports itself offline. A refresh interval that has lapsed must never be read as an expired policy credential (C5).

Today the shell does not meet this rule. `shells/web/src/org/index.ts` serves a cached organisation policy only inside `ORG_CONFIG_TTL_MS`. Past 24 hours it drops the copy, sets no policy at all and clamps the export and input seams closed. Enforcing the held policy instead, and reporting the four facts, is a change this model requires. Plan section 17's 25-hour offline case is where it is measured.

A freshness deadline for a governed-claim export must be an explicit policy rule, with an issuer, a validity interval and a stated behaviour when freshness cannot be established (R7). With no such rule, the held policy must be enforced, and the receipt must say which policy version was evaluated and when it was last attested (R15 for the policy version, Q3's default for the attestation).

Cached material must stay usable (R7). A hosted record keeps its core material on the device and records `lastSyncedAt` (`shells/web/src/lib/design-system/hosted.ts`). The device keeps working when the host has gone away, and the row reports how long ago it last synced. A receipt must never describe a held policy as current online approval (C5).

## Leave and Make an editable copy

Leave and "Make an editable copy" are two actions with different results, and this model must never merge them (R7, C5).

`leaveInstance` in `shells/web/src/lib/instance-leave.ts` removes what the organisation supplied: its cached configuration, its pack and the tools that pack installed, the install identity this device spoke while enrolled and the native shell session. For a hosted design system the same act is scoped to the record: plan 186 section 3.6 defines Leave there as "Remove this design system", running this sweep plus the namespace delete. What the person made stays: their sessions, images, preferences and any tool they sideloaded themselves. `countSessionsUsingInstanceTools` in the same module reports how many saved sessions belong to a tool the pack installed, so the exit dialog can say those sessions will not open until the device reconnects. Leave must never be turned into a copy operation (C5).

"Make an editable copy" is a separate, explicit action. `createDesignSystem` in `shells/web/src/lib/design-system/manage.ts` writes a `local` record, and `shells/web/src/lib/design-system/registry.ts` defines that source union. Where the copy was made from a hosted or local system, the record points at it in `forkedFrom`, with a version where the source carried one. A copy of the shipped system records no source today, and this model requires one. A copy made this way must state its dependency set, and it must carry no inherited governance claim (R7). The copy is the person's material from that moment, and the organisation's rules no longer travel with it.

## Repair

Repair is validate first, then propose (R6). A host must validate, then propose an explicit patch, and never mutate authored content to satisfy a rule without saying so.

- Applying a repair must require the authority specified for that operation (R6, D12).
- Automatic repair must have a declared rule behind it, and the applied repair must appear in the effective result (R6).
- A repair proposal must be a patch against a stated base revision, as specified in [Source rows, payloads and patches](source-and-patches.html).

A conflict between two required rules must never produce an invented repair (R6). The operation stops instead, and a person decides.

## Measured conformance and contextual acceptance

Two answers must stay separate, always (R8):

1. **Measured conformance.** The suite, its released version, the reference environment, the comparator version and the per-feature results.
2. **Contextual acceptance.** Whether the relevant authority accepts that result, with each exception named.

An authority may select a suite, require stricter checks, approve references or accept an exception (R8). None of those decisions may change the meaning of a suite version already published under another identity. A local waiver is an acceptance decision and never a measurement, which is why measured conformance to the waived rule still reads failed or excepted (R6, C4).

Lolly Work's planned effective-schema projection (Work plan 42, not built) and the engine's `documentSchema` (`engine/src/document-api.ts`) are the same projection of policy onto a schema. The model must specify one function for both (plan section 10.2), so that a locked input reads the same way in the shell, the command line and the MCP surface.

## Open points

- **Q2. The granularity and persistence of local rejection.** Default from plan section 16: per rule, instance-scoped, recorded on the session record with a fingerprint, following the `rightsDecisions` pattern (R6). A derived tool revision is a Design tool export and is not part of 0.1. Evidence that would change it: a need to share a rejected state as a reusable tool.
- **Q3. What freshness a governed-claim export needs, and who states it.** Default from plan section 16: freshness is a policy rule the instance issues, with a validity interval and a stated behaviour when it cannot be established. With no such rule the held policy is enforced, and the receipt says which policy version was evaluated and when it was last attested. Leave and "Make an editable copy" keep their current meanings (R7). Evidence that would change it: an organisation that needs a hard deadline, or a fully offline site.

The other open questions are carried, with their plan section 16 defaults, in other chapters: Q1 and Q5 in [Conformance and fidelity](conformance.html), Q4 in [Operations and outcomes](operations.html) and Q6 in [Status and open points](status.html). All six remain Andy's to answer. A default is what drafting proceeds on, not an answer.

## Precedents

In this repository:

- `docs/constraints.md`
- `packages/core/src/design-tool-v1.ts`
- `packages/core/src/rights-v1.ts`
- `engine/src/session-record.ts`
- `engine/src/runtime.ts`
- `engine/src/document-api.ts`
- `schemas/asset.schema.json`
- `schemas/tool.schema.json`
- `shells/web/src/lib/design-system/hosted.ts`
- `shells/web/src/lib/design-system/manage.ts`
- `shells/web/src/lib/design-system/registry.ts`
- `shells/web/src/lib/instance-leave.ts`
- `shells/web/src/org/index.ts`

In Lolly Work, which is a separate repository and not part of this tree:

- `lolly-work/server/src/policy/overlay.ts`
- `lolly-work/server/src/policy/org-config.ts`
- `lolly-work/server/src/approvals/engine.ts`
- `lolly-work/server/src/render/pipeline.ts`
