# Values, expressions, code and time

> This chapter is a draft for review, dated 2026-09-24.  

A property holds a value. This chapter specifies what kinds of value a property may hold, which of them a host may evaluate, how imperative code reaches the same properties, what powers that code runs with and which clocks a run may read. It states resolutions R2 and R3 and the correction the review recorded as C6 in normative form.

The records these values live in are specified in [Records and identity](records.html), and the rows and payloads that hold them in [Source rows, payloads and patches](source-and-patches.html). The pipeline that runs an evaluation is specified in [Evaluation and receipts](evaluation.html), and the rules that decide whether a value is permitted at all in [Constraints, authority and local choice](policy.html).

## Typed values and property permissions

A property must declare its type, and permissions must be stated per property rather than per document (R2, plan invariant 8). A property of type `T` may permit literals, token references, data bindings, conditionals, expressions and timed values, in any combination its declaration names.

Permission is never implied by another permission. Allowing a font token on a text property must never imply allowing a structural change during a layout pass (invariant 8). A property that permits a literal must never therefore permit an expression.

One writer owns one property, and explicit composition must be declared where several writers are supported (invariant 8). `validateDesignTool` already refuses two controls on one property, and a choice owns several properties at once as one atomic value (`packages/core/src/design-tool-v1.ts`).

A structured value must travel as a typed payload record referenced from its row by id, and must never be spread across scalar fields or hidden in an ad hoc string (R1, R14, C1). The collaboration row permits nothing but strings, numbers, booleans and null (`packages/core/src/canvas-op-v1.ts`, `schemas/canvas-op.schema.json`). [Source rows, payloads and patches](source-and-patches.html) specifies the payload rule; this chapter states only that a value's type decides where it lives.

```text
draft shape

  PropertyDeclarationV1
    id            the property id, permanent
    type          the value type
    permits       which of literal, token, binding, conditional, expression, timed
    facts         the facts an expression on this property may read
    clocks        the clocks a timed value on this property may read
    writer        the one authoritative writer, or a declared composition
```

This is a draft shape for review, not a type. No shared type is frozen until the counterexamples in [Proof cases](proof-cases.html) pass, so nothing is added to `packages/core` or `schemas/` in this wave (plan status, review recommendation).

## ExpressionV1

`ExpressionV1` is a proposed contract from plan 194 and nothing in this repository implements it yet. The only part of it that ships is the `showIf` subset in the next section. The rules below state what an implementation would have to hold to.

Declarative logic is a JSON abstract syntax tree and never source text (R2, plan 194). A host must never evaluate a document expression with `eval` or with a function constructor. The tree is data, so a host can read it, cost it and refuse it before anything runs, which is what invariant 2 requires.

The operator set is closed (R2). It covers boolean logic, equality and order, presence, string length, numeric arithmetic, finite membership and bounded aggregate counts. A namespace may not widen it, because a wider operator set is a different language with a different cost model. This is proposed, not resolved: R2 closes the set and D10 opens namespace publication, and no resolution yet says which wins.

Leaf reads are limited to declared facts (R2). The facts are the declared input ids, the canvas size and aspect, the explicit locale and direction, dataset counts and component parameters. An expression must never read the network, the clock, the locale of the machine, a random source, ambient JavaScript or geometry it has already influenced.

Every expression must carry a static cost estimate produced at validation, and an estimate over the declared limit must be refused at authoring time with its reason (R2). Every evaluation must run under a runtime budget, and an evaluation that exceeds it must stop and record a finding rather than continue.

A static estimate is meaningful only over bounded inputs, so the bounds are part of the contract (R2, review gate 4). The declaration must bound string lengths, list and map sizes, expanded component counts and the total evaluation work one operation may spend. Cancellation and invalidation behaviour must be defined for a budget that runs out, and the finding must say which bound was reached.

Value dependencies must be acyclic by default (R2). There is no general fixed-point solver in this model, and a later suite that wants one must specify its convergence and its failure behaviour first.

An expression must serialise canonically, sorted and byte-stable, so it can be hashed into an evaluation receipt (R2, R15). Two documents that differ only in key order must produce one digest.

Evaluation returns the value and a trace of the facts it read, the rule it matched and the outcome it set (R2). The trace is what makes a semantic diff able to explain a changed decision rather than only report a changed pixel.

## showIf is the shipped subset

`showIf` is the v0 of this language and must keep its current meaning when it is read as an expression (R2). It ships today in `engine/src/inputs.ts` as `matchesShowIf`, and `schemas/tool.schema.json` declares it.

One object is an AND: every `{ inputId: value }` pair must match. A value that is a list is membership, so `{ chartType: ["bar", "line"] }` matches either. An array of objects is an OR. It states a condition an ANDed map cannot.

`showIf` is a visibility overlay and nothing more. URL parameters, hooks and validation must see the input either way (`schemas/tool.schema.json`). A select option carries the same shape, and the option currently selected must stay offered whatever the condition says, so a saved session or a shared link never changes meaning.

Two rules follow. A host must never extend `showIf` with source text, arithmetic or a fact outside the declared inputs, because that would make the v0 subset a second language (R2). An expression that replaces a `showIf` must produce the same visibility for the same model, or the migration is not a migration.

## Hooks are eight named protocols

Imperative logic stays in `hooks.js` and is specified as protocol contracts over the existing hook names, never as a new module system (R3, D4). There are eight names, and they are already the lifecycle the engine drives (`engine/src/runtime.ts`).

Each protocol must state six things: the typed context it receives, the patch it may return, the optional host APIs it calls, its authored effect envelope, its time budget and the execution classes it may run in (R3). The table below states the context, the patch and the budget for each name, and whether the protocol is bound to the shell realm. The host APIs a protocol may call, its authored effect envelope and its class list are owed, because no manifest declares an envelope today.

Patch semantics are unchanged and are the same for every patch-returning protocol (`engine/src/runtime.ts`). A returned key that matches a declared input id updates that input. A key with no matching input goes into `extras`, a parallel store the template may read without the value being a user-facing input.

| Protocol | Context it receives | What it returns | Budgeted | Runs off the shell realm |
|---|---|---|---|---|
| `onInit` | input model, language, host, an optional intermediate report | input ids and extras | yes | yes |
| `onInput` | the above plus the changed input id and value | input ids and extras | yes | yes |
| `onFrame` | the `onInit` context plus one camera frame | input ids and extras | no | yes |
| `onLevel` | the `onInit` context plus one audio level | input ids and extras | no | yes |
| `beforeExport` | model, language, the live node, format, export options, host | mutates the node | yes | no |
| `afterExport` | the same context, run in export's `finally` | restores the node | yes | no |
| `exportFile` | model, language, host, caller options | bytes out | yes | yes |
| `exportStill` | the `beforeExport` context | bytes out, or null | yes | no |

The budgets live in `HOOK_BUDGET_MS` in `engine/src/runtime.ts`, one entry for each of the six budgeted protocols. The specification points at that constant rather than restating its values, so a tuned budget never contradicts a published number.

Three protocols are bound to the shell realm because they carry a live DOM node. `IN_REALM_ONLY_HOOK_NAMES` in `engine/src/hook-worker-core.ts` lists `beforeExport`, `afterExport` and `exportStill`, and a worker executor must refuse them rather than pretend.

A budget bounds the wait and never the code (`engine/src/runtime.ts`). A raced-out asynchronous hook keeps running, and a synchronous overrun cannot be preempted at all. A raced-out `onInit` or `onInput` may apply its patch late, and only while no newer run of either has started. An export protocol must never apply late, because a late patch after a written file describes a file that was never produced.

`onFrame` and `onLevel` run once per frame or per sample and are not budgeted. The runtime must drop an overlapping frame rather than queue it, so a slow per-frame render throttles itself (`engine/src/runtime.ts`).

A hook must never be disguised as an expression language, and a hook must never be migrated to declarative rules unless its behaviour is exactly representable (R3).

## The authored effect envelope

The effect envelope is a proposed contract and no manifest declares one today. It is authored and enforced, never generated (R3, C6). An effect is a host action a protocol may commit: a write, a download, a network call, a delivery to a destination.

A generated inventory is lint and must never be authority (C6). `analyseRequires` in `scripts/tool-requires.ts` is a regular expression over `host.<api>` followed by a member access. It reports `text` for `host.text.toPath` and nothing for `host["text"]` or for a local alias assigned first. A pattern that a rename evades cannot decide what code may do.

The public `requires` field keeps its present meaning and must never be repurposed (R11, review gate 1). It lists the optional host APIs the hooks call unguarded. The runtime refuses a mount when the host lacks one. `HOST_V1_OPTIONAL_APIS` in `packages/core/src/host-v1/apis.ts` is the enumerable list. One internal evaluator may normalise the four gates of engine range, host APIs, extensions and reader version, without changing what the manifest field says.

```text
draft shape

  EffectEnvelopeV1
    protocol      one of the eight names
    apis[]        the optional host APIs this protocol may call
    effects[]     { kind, destination, trigger } the author declares
    classes[]     the execution classes this protocol may run in
    delegates?    the powers a composed child may receive, named one by one
```

Grants are bound to the operation, the phase and the attempt (R3, C6). Four rules follow. The first three are proof case 20 in [Proof cases](proof-cases.html). The delegation rule has no fixture yet and is stated here as a rule to argue with:

- An undeclared effect must fail in a strict execution class.
- Passive inspection must never write through a hook, whatever the envelope says.
- A strict attempt that was cancelled or that ran past its budget must keep no usable write grant, even while its code is still running in the realm.
- A composed child must receive delegated powers explicitly and must never inherit a power because its parent holds one.

Observed effects must be recorded when the recording policy permits (R3). Attempted host actions are listed in `OutcomeV1.effects[]`, specified in [Operations and outcomes](operations.html) (R5). A retained receipt records the execution class the run used (R15).

## The five execution classes

An execution class is the trust and enforcement context code runs in. The class a run used must be recorded in its receipt (R15), because a portable API contract is not proof of isolation (plan section 12.2, `docs/constraints.md`).

![The five execution classes of the document model and what each one enforces, from trusted in-realm injection to the reserved interpreter class.](/info/diagrams/document-model/execution-classes.svg)

| Class | What it is today | What it enforces |
|---|---|---|
| `trusted-realm` | First-party catalog hooks loaded with `new Function('host', body)` in the shell's realm (`engine/src/runtime.ts`). | Closure-scope injection of the host bridge. Not a boundary: in a browser the code can reach page globals (`docs/constraints.md`). |
| `isolated-worker` | A tool with `isolate: true`, run through the Worker executor with in-realm fallback (`shells/web/src/bridge/hook-worker.ts`). | A separate realm, a proxied host and the seeded feature detects of `engine/src/hook-worker-core.ts`. Fallback keeps compatibility, so the claim is weaker. |
| `strict-worker` | Sideloaded and remote tools, with fallback disabled (`docs/constraints.md`). | The same worker policy plus global lockdown, with refusal of the mount when the worker cannot start. `STRICT_AMBIENT_GLOBALS` in `engine/src/hook-worker-core.ts` lists what is removed before the hooks compile. |
| `node-worker` | The CLI executor under `worker_threads` (`packages/node-shell/src/hook-worker.ts`). | The same protocol and host proxy on Node, with no DOM at all. |
| `vm` | Reserved. An interpreter in WebAssembly or a hardened compartment. | Nothing yet. It is named so a future class does not arrive without a contract. |

Two rules hold across all five (R3, plan section 12.2). Trusted compatibility execution must be classified as trusted and must never inherit a strict claim, whatever the tool's manifest says. A strict class must enforce the powers it claims and must refuse an unsafe fallback rather than downgrade quietly.

A tool does not assert its own class. `isolate: true` is written from evidence by `scripts/tool-isolation.ts`, which requires hooks free of realm-bound globals and a byte-identical render in-realm against the worker before it sets the flag (R3). A manifest claim with no such evidence is a declaration, not a classification.

## Invalidation and layout

State can affect layout and layout can affect text flow. This model defines a dependency model and invalidation rules, and it must never promise that every stage runs exactly once (R2, invariant 6).

Undeclared feedback is prohibited for the first version (R2, invariant 6). A declaration must state which measurement or state change restarts which stage. An explicit measurement output must feed a named later stage, rather than an expression reading geometry and rewriting it.

A stale asynchronous result must be discarded rather than applied over a newer one. The runtime already holds that rule for `onInit` and `onInput` through its run sequence (`engine/src/runtime.ts`), and the model states it as the general case.

An unresolved required value or a failed fit must block output at the affected operation rather than produce a silent substitute. The precedent is the `NEEDS_BROWSER` error code, which fails an export that needs a text layout check the host cannot perform (`engine/src/runtime.ts`, `shells/cli/src/exit-codes.ts`). A cycle must never be hidden behind implementation-dependent iteration.

An edit must invalidate its actual dependants (R2). Baseline measurements must precede any claim about responsive editing (review gate 5). They cover load, a one-property edit, a chart-data edit, patch validation and export, taken at declared document limits. They run on the web shell and on a native or CLI shell, and they record memory as well as elapsed time. This draft states no latency target, because the current evidence supports none.

## Units, coordinate domains and colour

The type system needs dimensions, physical units, angles, durations, frames, colours with colour-space metadata, vectors, matrices and typed resource references (R2, `engine/src/units.ts`).

Unit conversion must happen at one site. That site is `engine/src/units.ts`, which parses a dimension, holds inches as the canonical intermediate and converts to pixels, points or a CSS length. A shell's export bridge applies it per format and must never reimplement it. `CSS_DPI` in that module is 96, the pixels-per-inch the design canvas's own geometry is measured in. The three conventions below are separate resolutions, and the table gives the constant that holds each.

Three DPI conventions exist today, and the model keeps all three rather than collapsing them (R15, `engine/src/units.ts`):

| Convention | Value | Where it lives |
|---|---|---|
| Export default for physical units | 300 | The `dpi` URL parameter in `engine/src/url-mode.ts`, applied by each shell's export bridge |
| Rebrand reference space | 96 | `REBRAND_REFERENCE_DPI` in `packages/core/src/rebrand-v1.ts`, the space every source adapter normalises to |
| Per-document resolution | authored | The `documentDpi` input in `community/design/tool.json`, used when the document exports in a physical unit |

Every conversion a run applied must be recorded in its receipt (R15, gotcha 2). A fidelity claim about a physical output is unreadable without the DPI that produced it.

The output target owns colour handling, and the model must never treat colour as a document-wide setting (the **output target** definition in [the constitution](constitution.html), `engine/src/preflight.ts`). An output target states its colour space: sRGB, an HDR target, `pdf-cmyk` or `cmyk-tiff` with an ICC press condition, EXR or Radiance. `engine/src/preflight.ts` already separates the formats that build a process separation from the one format that emits a real spot plate.

A comparator must compare in the output's own colour space and must never convert both sides to sRGB first (R9). [Conformance and fidelity](conformance.html) specifies the comparator.

A coordinate domain must be declared and must never be inferred (R1). The `3d` layer kind carries a scene as a URL-encoded string inside a two-dimensional row, which is a second domain smuggled in as text (R14, `schemas/blocks-wire-order.json`). It must gain a typed payload record referenced from the row, appended beside the existing string, so the frozen wire order stays frozen and an existing link keeps working. A versioned migration with findings must then name the typed record authoritative once both are present ([Packaging, identity and migration](packaging.html), invariant 13).

## The five clocks

Clocks must be explicit and separate (R15, `docs/agenda.md`). A run may read more than one, and a receipt must name which clocks fed it and with what values.

| Clock | What it answers | Precedent |
|---|---|---|
| Event time | What is happening. | Agenda's event clock decides which sessions are current, in the event's own time zone, or in floating event time on the display device's clock when no zone is set (`docs/agenda.md`). |
| Presentation time | Which scene and which title position to show. | Agenda's presentation clock (`docs/agenda.md`). |
| Reference time | A frozen moment for review or export. | Agenda's reference time and its snapshot, evergreen and rehearsal video policies (`docs/agenda.md`). |
| Media time | Position inside one clip. | The Sequence clock that drives the light Lottie player (`engine/lottie.md`). |
| Wall time | When the export ran. | The ICS `DTSTAMP` and the PDF creation date, which `docs/determinism.md` records as the reason those formats are not byte-identical. |

Agenda is the precedent for the first three because it already separates them and already exports under three named time policies (D2, `docs/agenda.md`). Snapshot holds the reference moment or the moment export began. Evergreen shows a programme without claiming it is live. Rehearsal advances from an explicit reference time.

Deterministic motion frames come from a declared frame clock rather than from the machine clock. `shells/web/src/bridge/frame-clock.ts` drives a registered canvas at a normalised loop time. It freezes the tool's own animation loop for the capture. It passes the clip length and the target size, so a tool never guesses either. It is keyed per canvas and never a global, so one tool's clock cannot reach another.

Plan 196's `TimelineV1` is not built, and motion sampling is staged behind it (R12). Until then a timed value must name the clock it reads, and a static preview must choose a declared state and a declared time sample (R12, R15).

Interaction distinguishes four things that are often conflated: user intent, device input, state transition and effect (invariant 11). An activation may declare pointer, keyboard or another input alternative, and a declared alternative is what makes the intent reachable rather than the device.

## Open points

- **Q4. What "non-recordable" means for the first two cases, a local utility and a live-input tool.** Default from plan section 16: for a utility, capture off, retention none and replay semantic from pinned inputs. For a live-input tool, capture unsupported unless the person turns it on, retention for the session and no replay. It touches the `onFrame` and `onLevel` protocols above, which are the live-input path. Evidence that would change it: a regulated workflow that needs durable receipts for utilities.

The other open questions are carried elsewhere, each on its recommended default and each still open. Q1 and Q5 are in [Conformance and fidelity](conformance.html), Q2 and Q3 in [Constraints, authority and local choice](policy.html), Q6 in [Status and open points](status.html).

## Precedents

- `engine/src/inputs.ts`
- `engine/src/runtime.ts`
- `engine/src/hook-worker-core.ts`
- `engine/src/units.ts`
- `engine/src/url-mode.ts`
- `engine/src/preflight.ts`
- `engine/lottie.md`
- `packages/core/src/host-v1/apis.ts`
- `packages/core/src/design-tool-v1.ts`
- `packages/core/src/canvas-op-v1.ts`
- `packages/core/src/rebrand-v1.ts`
- `packages/node-shell/src/hook-worker.ts`
- `scripts/tool-isolation.ts`
- `scripts/tool-requires.ts`
- `schemas/tool.schema.json`
- `schemas/canvas-op.schema.json`
- `schemas/blocks-wire-order.json`
- `shells/web/src/bridge/frame-clock.ts`
- `shells/web/src/bridge/hook-worker.ts`
- `shells/cli/src/exit-codes.ts`
- `community/design/tool.json`
- `docs/agenda.md`
- `docs/constraints.md`
- `docs/determinism.md`
