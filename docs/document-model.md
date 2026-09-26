# Document model draft

A Lolly document represents a complete tool: its typed interface, authored content, dependencies, rules, behaviour and available operations (D1). The [glossary](/info/glossary.html) already defines a tool as a directory holding a manifest, a template and optional hooks. A document is that material plus the state a person authored and the results of running it. Four records carry it: a definition, an instance, an evaluation and an artifact (R4). Every record must carry its own schema version, and a reader may upgrade a record on read (R11). All four already exist in this repository under other names. [Records and identity](/info/spec/document-model/records.html) sets out the contract that holds each one.

An operation is what a tool can do. An operation may render, transform, extract, inspect, present or perform an authorised action (D11). One tool may expose several. The operation is the shared interface, whatever produces the result underneath. A valid tool never needs a canvas (D11). The on-device utilities take a file in and hand bytes out. Unpack, Prepare, Batch, Verify and the Rebrand review are web shell routes rather than manifest tools. Each gets a typed operation adapter with a typed outcome, and none of them needs a drawing surface (R13).

Compositions, timelines and recorded sessions are optional. An authored instance and one evaluation of it keep separate identities, so a new organisation policy never rewrites the authored instance (R6). Rules travel with a tool and may also arrive from a Lolly Work instance (D6). Governance supplies the applicable rules and the acceptance authority (D6, D12). It never fixes what a render or an operation means, because that meaning belongs to the definition (D1). Outside a governed instance the person at the keyboard holds the acceptance authority (D7).

![The four records: definition, instance, evaluation and artifact, each named with the contract that holds it today](/info/diagrams/document-model/four-records.svg)

## Status

This is a draft for review, dated 2026-09-24. Nothing in it is normative until the status chapter records that the review happened.

| State | What it covers |
|---|---|
| Decided | Thirteen confirmed directions (D1 to D13) and fifteen resolutions from evidence (R1 to R15). Nine corrections from the final review (C1 to C9) are folded in. |
| Open | Six open questions (Q1 to Q6). Each carries a recommended default, and the draft reads on that default until the question is answered. |
| Not built | Every type, every schema and every fixture. This draft adds nothing to `packages/core` and nothing to `schemas/`. |

A D id is a confirmed direction. An R id is a resolution proposed from evidence; it stands unless the review overturns it. A C id is a correction the final review made before drafting started.

## Where to read it

The specification is its own web document, twelve chapters long. [Read it in the app](/#/document-model), with the chapter list, the headings and a search field beside the text. The same chapters are on this site:

- [Constitution](/info/spec/document-model/constitution.html) - the thesis, the four records named, the vocabulary and the thirteen invariants.
- [Records and identity](/info/spec/document-model/records.html) - which contract holds each record today, with its file path.
- [Source rows, payloads and patches](/info/spec/document-model/source-and-patches.html) - flat rows, one owner pointer, typed payload records and the patch envelope (R1).
- [Operations and outcomes](/info/spec/document-model/operations.html) - the six operation shapes, one outcome vocabulary and the output target a render satisfies (R5).
- [Values, expressions, code and time](/info/spec/document-model/values-and-time.html) - typed values, the expression language, the eight hook protocols, the execution classes and the five clocks (R2, R3).
- [Evaluation and receipts](/info/spec/document-model/evaluation.html) - the pipeline, the three recording axes and what a receipt records about one run (R15).
- [Constraints, authority and local choice](/info/spec/document-model/policy.html) - rule classes, the three attributed layers and the effective policy an evaluation ran under (R6, R7).
- [Conformance and fidelity](/info/spec/document-model/conformance.html) - conformance suites, core and extended features, the three-check comparator and acceptance (R8, R9).
- [Capabilities, trust and extensions](/info/spec/document-model/extensions.html) - capability limits, extension declaration, dependency scopes and refusal by name (R10).
- [Packaging, identity and migration](/info/spec/document-model/packaging.html) - the container, retained package state, migrations and the frozen wire order (R11).
- [Proof cases](/info/spec/document-model/proof-cases.html) - every counterexample the model has to answer, each to be built after review.
- [Status and open points](/info/spec/document-model/status.html) - decided, corrected, open and not built, with a dated change log.

The twelve chapters are also written out in order as one file, [document-model.md](/info/spec/document-model/document-model.md), for reading offline or handing to an agent.

## How to review it

Read a chapter, then send what you found, quoting the chapter and heading. Open an issue on [the repository](https://github.com/lolly-tools/lolly/issues).

## What this draft does not claim

- No conformance for any shell. A conformance suite produces a measured report and an authority records an acceptance; the two are never merged (R8).
- No threshold. The comparator probe in the conformance chapter shows only that one whole-image number cannot separate a lost caption from a half-pixel shift. Calibration comes after review (R9).
- No frozen type. The counterexamples in the proof cases must pass as contract fixtures before anything is added to `packages/core` or `schemas/`.
- No determinism or reproducibility claim beyond the ones [Determinism](/info/determinism.html) and [Reproducibility](/info/reproducibility.html) already make.
- No cloud dependency. The core evaluates on the device. A governed client that loses its connection must keep enforcing the policy it holds (R7). The web shell does not do that yet: once its cached copy is 24 hours old and the server cannot be reached, it fails closed ([policy chapter](/info/spec/document-model/policy.html)).
- Nothing about spatial output or fabrication beyond an extension boundary. Both stay written explorations. This draft commits to building neither (D5).
