# Capabilities, trust and extensions

> This chapter is a draft for review, dated 2026-09-24.  

A document declares what it needs. A host declares what it can do. This chapter specifies how those two declarations meet, what an independent publisher may add to the model and what a host must do with a part it cannot read. It restates plan section 12 with resolutions R10, R11 and the review correction C7. It also carries the parts of R3 that decide where code runs. Lolly Work is a separate repository, and a `lolly-work/` path in this chapter is a file in that checkout rather than in this tree.

Independent authors may publish feature namespaces and conformance fixtures (D10). Spatial experiences, fabrication and unfamiliar media are extension checks rather than roadmap items, and they exist here to keep the boundary coherent (D5). The suites those fixtures belong to are specified in [conformance and fidelity](conformance.html). The operation that a missing extension refuses is specified in [operations and outcomes](operations.html). The execution classes named below are defined in [values, expressions, code and time](values-and-time.html).

## Capabilities are data with limits

A host must report its capabilities as data with limits rather than as booleans (plan section 14, gotcha 4, against `lolly-work/server/src/render/capabilities.ts`). A boolean answers whether a thing is possible in general. A caller needs to know whether this output target, at this size, for this duration, is possible here.

Both current precedents are too coarse. The model takes them as the starting point, not as the form to copy.

- `RenderCapabilities` in Lolly Work is `formats: string[]` plus `hookedTools: boolean` (`lolly-work/server/src/render/capabilities.ts`). It is deployment scoped and the same for every caller. One boolean covers every hooked tool, whatever that tool renders. The plan states where this grows to: `MotionCapabilitiesV1` and its still-image sibling (plan section 12). Neither is built; `MotionCapabilitiesV1` is one of the types plan 196 defines on paper (F2), so the shape below is drawn to meet it rather than to replace it.
- The manifest `capabilities` list and its host side are membership tests (`schemas/tool.schema.json`, `packages/core/src/host-v1/host.ts`). A shell declares `camera` or it does not. Neither side states a ceiling.

The tree already holds the better pattern on one path. `pickWebCodecsVideo` in `shells/web/src/bridge/video-shared.ts` probes the real encoder with width, height, bitrate and framerate. It walks a ladder of codecs and returns the one that answered, or nothing when none did. The caller in `shells/web/src/lib/video-jobs.ts` then fails the job rather than guessing, though its message gives no limit. That is a capability answered against the work being asked for.

Rules for 0.1:

- A host must report supported conformance suites and their released versions, not a single support flag (R8, plan section 12). The names and versions a host reports here are the same ones a `ConformanceReportV1` names, which [conformance and fidelity](conformance.html) specifies (R8).
- A host must report quantitative limits per output target: format, colour handling including HDR, alpha, audio, maximum geometry and maximum duration (plan section 14, gotcha 4, in the manner of `shells/web/src/bridge/video-shared.ts`).
- A capability report must never be the authority for what a run may do. Grants are bound to the operation, the phase and the attempt (R3), and [evaluation and receipts](evaluation.html) owns that boundary.
- A document must declare a minimum core `schemaVersion` and the named versioned features it uses (R11, plan section 12).

This chapter states no number. Where a limit is a number, that number belongs to a host and to a release, never to the model.

```text
draft shape

  CapabilityReportV1
    host          shell, engine version, the execution classes it can provide
    suites[]      { suite, releasedVersion, features: { core[], extended[] } }
    outputs[]     one entry per output target it can produce:
                    { format, colour, alpha, audio, maxGeometry, maxDuration, paging }
    extensions[]  { namespace, schemaVersion range, stages }
    stated        which fields are measured and which are declared by the host
```

This is a draft shape for review. Nothing is added to `packages/core` or to `schemas/` until the counterexamples in plan section 17 pass as contract fixtures (plan status line and section 18, first pull requests). The shape is drawn to meet `MotionCapabilitiesV1` and its still-image sibling, not to replace them (plan section 12, F2).

## Requiredness is scoped to the operation

A requirement is always a requirement for something. A host must scope requiredness to the affected operation and output target, never to the document as a whole (plan section 12, third compatibility gate of the review).

The consequence is the rule the review asked for. A host must inspect declarations first and refuse at the operation boundary. Missing motion support must never prevent a safe inspection, and it must never block a still export that has no motion dependency (third compatibility gate of the review, plan section 12). [Evaluation and receipts](evaluation.html) places that refusal at step 2 of the pipeline, after the operation and the output target are chosen.

When the refusal comes, it must name what is missing. A blocked termination in [operations and outcomes](operations.html) carries the unmet requirement, so a caller can tell an unmet extension from an error.

## Where a document declares its extensions

A document declares its extensions in one place. An `extensions` map keyed by namespace holds each extension's own record with its `schemaVersion` (R10). Two lists name what the document uses and what it cannot do without: `extensionsUsed` and `extensionsRequired` (R10, and glTF's precedent below). The root manifest stays closed, because `tool.json` refuses unknown keys and that is right for a definition (plan section 14, gotcha 14). An extension adds nothing to the root.

## What an extension declares

An extension must identify itself completely before a host decides anything about it (R10, plan section 12).

```text
draft shape

  ExtensionDeclarationV1
    namespace       permanent and publisher owned; never renamed, never reused
    publisher       who published it, for attribution and never for trust
    version         immutable; a released version is never re-cut
    schemas[]       the records and fields it adds, each with its own schemaVersion
    dependencies    the complete scope it reads; see the next section
    stages[]        which evaluation steps it takes part in
    execution       the execution classes its code may run in, when it has code
    powers[]        the effects its code asks to commit, authored not generated
    outputs[]       what it adds to an output target, and what that addition means
    compatibility   the reader and engine versions that can read it
```

The `outputs[]` entry is where the fabrication thought experiment is answered. A manufacturability check is an output-target validator contributed by an extension, not a new operation (plan section 14, gotchas 9 and 11). That is the test of whether the boundary holds for a medium nobody here has built (D5).

Publication, a signature and a passing fixture grant no code trust and no host authority (D10, plan section 12). A signature says who published the bytes. It never says what those bytes may do. Validators and comparators that execute code are themselves subject to an execution class, because a comparator is code like any other (R3, plan section 12).

The chrome slot contract is the nearest in-tree model for the identity half of this. `packages/core/src/extension-v1.ts` gives a slot a permanent id and requires a namespaced extension id. It carries a channel that is recorded for governance and for a provenance chip, and never as a security boundary. Its own header makes control-plane extensions org-trusted and community ones opt-in at the deployer's risk, and it states that a hydrated component runs in the shell realm with no sandbox either way. Ordering inside a channel is a tiebreak under the channel governance rank, so an author cannot place a community component ahead of a control-plane one. Its namespace and channel model is reused here. Its runtime is not (plan section 13).

A namespace must never reach into a reserved name. `RESERVED` in `engine/src/url-mode.ts` is the closed set of URL parameters that are not inputs, and two prefixes are reserved: any name starting with `_`, which is where future reserved params are minted from, and any name starting with `pkg.`, an in-use namespace for Linux-package export metadata. This chapter adds one rule that the plan does not state, for the [status chapter](status.html) to confirm: an extension that needs a URL parameter takes it from its own namespace, never from either reserved prefix and never from the reserved set itself.

## Dependency scopes, and what a host without the extension must do

Preserving bytes does not preserve meaning (R10). A host that carries an unknown part through a save has kept the bytes. It has not kept the part correct, because an edit elsewhere in the document can invalidate what those bytes describe.

An extension must therefore declare a complete dependency scope (R10, C7). Three kinds of scope exist, and a declaration that lists only the first is incomplete.

| Scope kind | What it covers | Which edits break it |
|---|---|---|
| Rows and values | The rows the extension reads and the fields it reads on them | Changing a value, deleting a row or replacing a typed payload record |
| Collection membership and order | The collections whose membership or order the extension depends on | Adding a row, removing a row or reordering a collection |
| Global settings | Document-wide settings such as units, DPI and colour handling | One edit at the document level, touching no row the extension named |

A list of currently read row ids alone cannot protect the second and third kinds (C7). That is why the declaration is scoped rather than enumerated.

A host that lacks an extension must do all of the following (R10, C7):

- It must preserve the extension's bytes through import, local persistence, restart, edit and save. [Packaging, identity and migration](packaging.html) specifies the retained package state that carries them.
- It must protect the declared scope. It must refuse an edit that touches the scope, or it must offer an explicit lossy copy before any data changes.
- It must never label a loss after the loss happened. Labelling after the fact is not protection (C7).
- Where a scope is incomplete or absent, it must protect the whole relevant document rather than guess.
- It may still inspect safely where inspection is feasible, because inspection changes nothing.
- It must never claim to have rendered a feature it does not support (R10).
- It must refuse the affected operation by name when a required extension is missing (R10).

The counterexample is stated in the plan: glTF declares `extensionsUsed` and `extensionsRequired`, and some loaders only warn on an unmet required extension rather than refusing (R10). One import path in this tree does part of what this model asks for. `shells/web/src/lib/studio3d/source.ts` reads `extensionsRequired` out of a GLB manifest and refuses the import when the model requires Draco, Meshopt or KTX2 compression. That refusal comes at the import boundary rather than later in the decode. It reports the three compression formats rather than the extension that triggered it, so it is a precedent for refusing early and only a partial one for naming the unmet item. It also tests a fixed list, so a required extension outside that list is not refused. The rule here is the general case that list is a start on.

An extension's content travels as package parts under the integrity map, never as manifest keys (R10). The reason is in `shells/web/src/lib/lolly-pack.ts`: the writer rebuilds the manifest from typed fields on every save, so an unknown manifest key is dropped. A part is the safer carrier because the integrity map already covers and verifies it. The carry itself does not exist yet: `LollyBuildInput` takes only typed fields, so a part a reader did not interpret is not written back today. [Packaging, identity and migration](packaging.html) specifies the collision, ownership and collection rules for those parts, and the retained package state that has to join the read to the next write (C7).

## The four gates

Four independent gates decide whether a document can be read and run here. Each already exists or is proposed, and each refuses at its own boundary.

| Gate | What it compares | Where it runs today | What it does when unmet |
|---|---|---|---|
| Engine range | The manifest `engineVersion` range against the running engine | `engine/src/loader.ts` with `engine/src/semver-range.ts` | Refuses to load the tool. A range it cannot parse is treated as unsatisfiable, so an unrecognised range fails closed |
| Host APIs | The manifest `requires` list against the optional APIs the host provides | `engine/src/runtime.ts` with `packages/core/src/host-v1/apis.ts` | Refuses the mount before any hook runs. An unknown name counts as missing, so a typo fails loudly |
| Extensions | `extensionsRequired` against what the host implements | Proposed. The nearest precedent is the GLB import in `shells/web/src/lib/studio3d/source.ts` | Refuses the affected operation by name, at the operation boundary |
| Reader version | The container `minReader` against the reader's own version | `packages/node-shell/src/lolly-file.ts` | Refuses to open the package and says a newer reader is needed |

The public `requires` field keeps exactly the meaning it has now: the optional `HostV1` APIs a tool's hooks call without feature-detecting them (`schemas/tool.schema.json`). It must never be repurposed to carry engine, reader or extension requirements (R11, first compatibility gate of the review). One internal evaluator may normalise the four gates so their diagnostics read the same way. The four fields stay separate on the wire.

`missingRequires` in `packages/core/src/host-v1/apis.ts` is the current implementation of the second gate, and `HOST_V1_OPTIONAL_APIS` is the enumerable list it compares against. A tool that guards an API (`host.text?.`) must not list it, and `scripts/tool-requires.ts` computes the list from the hooks, so a manifest that disagrees with what the analyser can see fails `validate:catalog`. The analyser is a regular expression and not a program analysis, so agreement with it is not proof: the limits are stated under the legacy execution boundary below (C6).

Each record carries its own `schemaVersion` (R11). A reader upgrades on read and may downgrade on write. A container carries `minReader`, and a definition carries `engineVersion`. Preservation-capable readers and writers must ship before any new part is emitted, behind an effective reader gate for earlier clients. An additive field is not safe merely because an old reader ignores it (C7).

These versions move independently and their relationships are written down rather than assumed (R11). The practice already exists: `lolly-work/engine-pin.json` records the engine and SDK versions that checkout vendors, with a content hash per pinned package and per schema file. The document model version and the suite versions join that same pin file rather than gaining a mechanism of their own (plan section 13, adoption sequence).

## The legacy execution boundary

`HostV1` is the portable API contract (`packages/core/src/host-v1/host.ts`). It is not a proof of isolation (plan section 12.2).

This is already written down where the code lives. `docs/constraints.md` states that trusted compatibility hooks run through `new Function('host', ...)` in the shell's realm, and `engine/src/runtime.ts` says the same at the site (plan E8). That is closure-scope injection and not a security sandbox, so a hook in a browser shell can still reach `window`, `document` and `fetch`. `packages/core/src/extension-v1.ts` says the same about a hydrated chrome component. The model does not correct either statement. It records which context actually enforced a run.

Rules:

- The evaluation receipt must state the execution class the run used (R15, plan section 12.2). The class in the receipt states what actually enforced that run.
- An adapter may keep trusted compatibility execution, and it must be classified as such (R3, plan section 12.2). Adoption of this model must never retroactively make an existing hook strict.
- A strict class must enforce the powers it claims and must refuse an unsafe fallback (R3, plan section 12.2). The sideloaded and remote path in `shells/web/src/bridge/hook-worker.ts` already rejects the mount when isolation cannot start, rather than falling back into the realm.
- Effects are declared by the author and enforced by the execution class (R3, C6). A generated inventory assists declaration and linting. It is never the authority.

The last rule has evidence behind it. `analyseRequires` in `scripts/tool-requires.ts` is a regular expression over `host.<api>` member access. The review probed it: `host.text.toPath()` is detected, `host["text"].toPath()` is not, and a local alias assigned from `host.text` is not (C6). A generated list is therefore lint, and an authored effect envelope is the contract.

The enforcement pattern a strict class needs already exists. `strictHostShape` in `shells/web/src/bridge/hook-worker.ts` reduces an untrusted mount's host proxy to the capabilities the manifest declared, and it omits a namespace entirely rather than exposing a stub that rejects after sensitive arguments have crossed the channel. Its own comment states the rule as absence being the policy. `engine/src/hook-worker-core.ts` carries the wire protocol both worker executors share, and it lists `beforeExport`, `afterExport` and `exportStill` as the hooks that stay in the realm. `shells/web/src/bridge/hook-worker.ts` states the reason: they receive a live DOM element, which cannot cross the worker boundary.

Which tools run isolated is decided from evidence rather than from an author's assertion. `scripts/tool-isolation.ts` sets the manifest `isolate` flag only when a static read finds no realm-bound global and a render at defaults is byte-identical in-realm and in a worker. The model keeps that arrangement (R3). A manifest hint is a request. The receiving shell assigns trust independently, and `schemas/tool.schema.json` already says so.

## Open points

- **Q5, who may publish a suite under the `lolly` namespace, and how a local or Work suite is named.** Default from plan section 16: `lolly/*` suites are published from this repository's CI only. A Work instance publishes under `work:<instance>/*` and a local person publishes under `local/*`. An acceptance record always says which suite it judged. The same namespace discipline governs an extension namespace, which is why the question touches this chapter as well as [conformance and fidelity](conformance.html). Evidence that would change it: a partner programme that needs a shared namespace.
- **Q6, whether the specification is public from the first draft.** Default from plan section 16: yes, published under `/info/` with the draft notice at the head of every chapter. An open extension model that independent publishers are invited into is hard to review in private. Evidence that would change it: a reason to keep the drafts private until the pilots pass. The [status chapter](status.html) records the answer.

Q1 is carried in [conformance and fidelity](conformance.html). Q2 and Q3 are carried in [constraints, authority and local choice](policy.html). Q4 is carried in [operations and outcomes](operations.html).

## Precedents

- `docs/constraints.md`
- `packages/core/src/extension-v1.ts`
- `packages/core/src/host-v1/apis.ts`
- `packages/core/src/host-v1/host.ts`
- `schemas/tool.schema.json`
- `engine/src/url-mode.ts`
- `engine/src/loader.ts`
- `engine/src/semver-range.ts`
- `engine/src/runtime.ts`
- `engine/src/hook-worker-core.ts`
- `scripts/tool-requires.ts`
- `scripts/tool-isolation.ts`
- `shells/web/src/bridge/hook-worker.ts`
- `shells/web/src/bridge/video-shared.ts`
- `shells/web/src/lib/video-jobs.ts`
- `shells/web/src/lib/studio3d/source.ts`
- `shells/web/src/lib/lolly-pack.ts`
- `packages/node-shell/src/lolly-file.ts`
- `lolly-work/server/src/render/capabilities.ts`
- `lolly-work/engine-pin.json`
