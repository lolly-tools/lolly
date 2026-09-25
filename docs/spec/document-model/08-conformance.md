# Conformance and fidelity

> This chapter is a draft for review, dated 2026-09-24.  

Conformance is what a suite measured. Acceptance is what an authority decided about that measurement. The two answers must never be merged into one verdict (R8, D12).

This chapter specifies conformance suites, their features and the report a run emits. It then specifies the acceptance record an authority writes, the three checks that test a still-image claim, the motion checks, the editable round trips and the conformance of operations that draw nothing. It restates plan section 11 in normative form, with the corrections the review recorded as C8. The operations being measured are specified in [Operations and outcomes](operations.html). The authority that accepts a result is specified in [Constraints, authority and local choice](policy.html).

## Two separate answers

A measured result and an accepted result answer different questions, so this specification keeps them in separate records (R8).

**Measured conformance** states the suite name and its released version, the implementation identity, the reference environment, the fixture, reference and comparator digests and the per-feature results (R8, C8). It is a fact about one run on one machine.

**Contextual acceptance** states the authority, the suite reference it judged and each exception it granted (R8, D12). It is a decision, and a different authority may decide otherwise about the same report.

An authority may select a suite, require stricter checks, approve references or accept an exception (R8). None of those decisions may change the meaning of a suite version already published under another identity (R8). A local waiver of a creative rule must leave measured conformance to the unmodified rule reading failed, never passed (R6, C4). The waiver is recorded as an exception on the acceptance, never on the report (R8).

![A conformance suite producing a report on one side and an authority producing an acceptance on the other, with no arrow that merges the two into a single verdict.](/info/diagrams/document-model/conformance-vs-acceptance.svg)

## Suites and features

A conformance suite is an immutable versioned set of fixtures, references, a comparator and a reference environment (plan section 3). A suite must be released under a version, and a report must never name a branch or a commit in its place (R8).

Each suite declares named features, and each feature is marked core or extended (R8). A core feature must never be skipped (R8). An extended feature may be unsupported, and the report must list it as unsupported rather than silently omit it (R8).

Requiredness is scoped to the affected operation or output (R11). Missing motion support must never block inspection or a still export that has no motion dependency (R11), which is the rule the four gates in `packages/core/src/host-v1/apis.ts` and `schemas/tool.schema.json` already follow.

Independent authors, Work instances and local people may publish suites and feature namespaces under their own namespace and version (D10, plan section 10.2). A suite namespace carries publisher identity. What names they take, and who may publish under `lolly/*`, is open as Q5 below, with its default recorded there.

### Fixtures

A fixture must identify its inputs, its immutable dependencies, the reference environment, the features it claims, the expected artifact or typed result and the comparison rules (D3, `tests/docs-shots-vector.test.ts`).

Expected trees and traces may supplement output checks (D3). They must never replace them, because a valid JSON tree is not evidence of a rendered result (D3).

A fixture must declare its comparison regions itself (R9, C8). A region discovered from the difference between a candidate and its reference is exploratory evidence, never a region a fixture may declare.

## ConformanceReportV1

The report shape follows Gateway API's conformance report, which the plan consulted as outside practice (R8, plan section 15).

```text
draft shape

  ConformanceReportV1
    suite           { name, version }  a released version, never a branch or a commit
    implementation  { project, version, shell, mode, contact }
    date
    features
      core          { result: passed | failed, statistics, failedTests[] }
      extended      { result, statistics, supportedFeatures[], unsupportedFeatures[], skippedTests[] }
    environment     { fonts, shapingEngine, rasteriser, codecs, gpu, os }
    digests         { fixture, reference, comparator }
```

This is a draft shape, not a frozen type. Nothing is added to `packages/core` or `schemas/` in this wave, and the plan's section 18 orders the counterexample fixtures in [Proof cases](proof-cases.html) before any of it is frozen.

A skipped test must never be recorded as a pass (R8). A report whose suite version does not match the fixtures it ran is invalid (R8). A report must bind to the fixture, reference and comparator digests as well as the suite name and version (C8). Reports are data, and publishing one grants no trust (R8).

## AcceptanceV1

```text
draft shape

  AcceptanceV1
    authority   { kind: work-administrator | local-person, instance, id, name }
    subject     { definition, instance, revision, operation }
    report      { suite, version, reportDigest }
    decision    accepted | accepted-with-exceptions | rejected
    exceptions[]  { target: ruleId | featureName, reason, by, date, scope }
    date
```

An acceptance must name the report it judged by digest (R8, C8). An acceptance describes exactly the revision named in its subject. When that revision changes the acceptance stays as history and must never describe the new revision as previously accepted (C7). [Packaging, identity and migration](packaging.html) states the same rule for receipts and signatures. An exception must name its target, its reason and the authority that granted it (R6, R8). An acceptance must never restate a measured result as passed when the report said otherwise (R8).

The governed authority is the Work administrator for the brand, recorded with the instance they administer (D12). Otherwise it is the local person using the client (D12).

## The native 0.1 suites

| Suite | Scope | State in this draft |
|---|---|---|
| `still-2d/1` | PNG, SVG and PDF, including print marks, bleed and CMYK output targets. | The one native suite for 0.1 (R12). |
| `motion-2d/1` | Timed appearance and duration for motion output targets. | Staged after plan 196's `TimelineV1` exists (R12). |
| `present/1` | Interactive presentation and its state transitions. | Stays an adapter until Agenda's portable runtime contract is typed (R12). |

The evidence folder records 25 raw manifest rows declaring video and one declaring `render.portable`, raw directory counts taken before content profile resolution (C9), while the frame clock exists and `TimelineV1` does not (R12).

## Still-image fidelity

D8 allows a very low pixel difference, difficult to notice without close inspection. The plan reads that intent as no visible loss on close inspection (plan section 2) and keeps it, tested by three checks rather than by one number (R9).

Each fixture declares the parameters of all three checks, its fuzz band, its regions and the facts to read back from the artifact, and a claim must pass all three (R9). A fixture that cannot state one of them must say why in the fixture, and a report that rests on it must name the check that did not run (C8).

1. **Whole-image fuzz band.** A per-channel maximum difference and a maximum count of differing pixels, each with a lower and an upper bound, in the form web-platform-tests uses (R9). A tolerance that must accept identical output has a lower bound of zero. This catches gross drift and admits anti-aliasing.
2. **Region-scoped structural checks.** Regions the fixture declares, such as a legal line, a logo or chart labels, compared by ink ratio and structural similarity inside the region (R9). The fixture declares the region (R9). The comparator must never derive it from the difference it is measuring (C8).
3. **Semantic checks on the produced artifact.** Text content, page count, chart data and layer inventory, read from the artifact or from an independently extracted representation, compared through `compareSources` in `engine/src/compare.ts`, which dispatches by mode to `compareText` in `engine/src/compare-text.ts` and `compareStructure` in `engine/src/compare-structure.ts` (R9). Comparing authored text with the same authored text would miss a broken exporter, so the comparison must read the output (C8).

Pixel counts alone must never decide a still-image claim (R9).

![Three boxes, a whole-image fuzz band, region checks and semantic checks, each with its own arrow into a single result box, labelled whole image, ink and SSIM, and text and pages.](/info/diagrams/document-model/comparator-three-checks.svg)

### The evidence and what it does not settle

A comparator probe rendered a QR code with a caption through the CLI shell as render A, then derived three variants from it. B removed the caption glyphs and left every box unchanged. C shifted the image by half a pixel. D rasterised at 1023 px and resampled to 1024 px. The caption region is 6.09% of the canvas. The probe is exploratory evidence and is not published with this specification.

| Pair | Changed pixels, whole image | SSIM, whole image | Changed pixels in the caption region | Ink ratio in the region | SSIM in the region |
|---|---|---|---|---|---|
| A vs B, caption gone | 1.46% | 0.969 | 24% | 0.00 | 0.43 |
| A vs C, half-pixel shift | 1.25% | 0.968 | 8.8% | 1.00 | 0.89 |
| A vs D, resampled | 1.29% | 0.968 | 6.9% | 1.00 | 0.95 |

The three pairs sit within a quarter of a point of each other on changed pixels and within 0.002 on SSIM. A real content loss and two harmless changes are therefore indistinguishable by a whole-image number. The region-scoped measures separate them at once. A text-presence check on the artifact would separate them with no pixels at all, by construction rather than by measurement: B was made by removing the caption glyphs from the source, and the probe ran no such check.

The probe establishes the need for complementary checks. It sets no threshold (R9, C8).

It also does not establish a validated combined comparator or cross-shell conformance (C8). Its region was discovered from the A and B difference, which a fixture must never do (C8). Its fonts were whatever the rasteriser found on one machine, and resvg-js does not report which files it resolved. The raster was composited onto white. The structural similarity is one small implementation. Nobody decoded the QR afterwards, so "nothing lost" in C and D describes the source edit only.

Thresholds must be calibrated on accepted and rejected examples before any number enters this specification (R9). Masks must be explicit and justified, and human review sets and reviews the bands and must never replace the comparator (R9, plan section 11.2).

### The output-validation boundary

An output-validation boundary sits after rendering and before delivery of any artifact that claims acceptance (C8). An artifact that has not passed that boundary must never be delivered with an acceptance claim attached.

Comparison for a claim must run at native raster scale with pinned fonts and rasteriser, with declared colour handling and alpha treatment (R9, C8). The preview-grade comparison in `engine/src/compare-visual.ts` samples at most 768 px per edge with nearest-neighbour sampling on white, and it states that limit in its own result. It stays a preview tool and must never decide a conformance claim.

An `undetermined` result must never be a pass (R9, C8). `compareSources` in `engine/src/compare.ts` returns `undetermined` when a budget cut the comparison short, and `engine/src/compare-budget.ts` is where that budget is spent. Harmless truncation of displayed detail must be distinguished from incomplete comparison coverage (C8).

PNG alpha, PDF page boxes and colour intent must each have their own checks (C8). A white RGB fixture says nothing about CMYK print conformance, and a suite must never generalise from one to the other (C8).

A run whose text stayed a live `<text>` element rather than an outline must record that in its receipt, and it must never claim font-independent fidelity (R15). [Evaluation and receipts](evaluation.html) specifies the receipt.

## Motion fidelity

Appearance is compared at normalised progress points, and total duration and the time mapping are compared separately (D9, plan section 11.3).

Sampling must include the start, the end, scene and transition boundaries, authored events and samples immediately around discontinuities (D9). Each suite must bound its sampling interval, with denser checks for fast motion (D9).

Loop behaviour and audio timing must be tested where they are claimed (D9).

Sampling is evidence at the tested points. It does not prove the absence of a defect between them, and the suite must state that limit (D9).

## Editable round trips

Visual similarity is necessary and insufficient for an interchange claim (R14). A raster fallback may claim appearance and must never claim editable-vector preservation (R14).

Each route must declare preservation separately for six dimensions: appearance, editable objects, semantic data, interactions, timing and constraints (R14, `engine/src/penpot-file.ts`).

A route is tested by a meaningful edit after import, followed by an export, followed by a comparison across all six dimensions (R14). The required edits are moving a layer, changing a text run and swapping a token.

The first routes are proposed, not settled. They are Q1 below, and the table states them as the recommended default.

| Pilot | Proposed route | What exists today |
|---|---|---|
| Design | To and from Penpot. | The `.penpot` writer in `engine/src/penpot-file.ts`; the editable import is `parsePenpotBinfile` in `shells/web/src/views/design-import.ts` over the pure mapper `engine/src/design-map.ts` (the Unpack reader in `shells/web/src/views/penpot-import.ts` extracts, it does not round trip). |
| Design | To native PPTX and back. | The deck reader `readPptx` in `engine/src/pptx-read.ts`, reached by the Rebrand source path in `packages/node-shell/src/pptx.ts`. |
| Chart | To and from CSV and JSON data, plus the SVG semantic overlay. | The portable chart contract in `packages/core/src/chart-v1.ts`. |
| Agenda | To ICS, portable HTML and PPTX. | The outputs listed in `docs/agenda.md`. |

Today's `composes` and `compose.renderUrl` paths produce a flattened image (R14). That image may pass an appearance check and must fail an editable round trip (R14). [Proof cases](proof-cases.html) carries it as a failing case, not as a pilot.

## Conformance without a picture

An operation that draws nothing is still measurable (D11, R13). The three paragraphs below state what its suite tests.

For Rebrand, compare the approved changes against the rebrand plan, the protected content against the source and the output against a reference for that rebrand plan (R13). Partial completion is read through `OutcomeV1` as [Operations and outcomes](operations.html) specifies.

For Unpack and the other route operations, compare typed results, resource inventories, declared effects and failure behaviour (plan section 11.5, R13). A fabricated preview must never stand in for the real outcome (R13).

For interactive Agenda, test search, navigation, calendar output, state transitions and accessibility (plan section 11.5).

## Material that exists today

None of this is a suite yet. These are the parts a suite would be assembled from, and each states its own limit.

| Piece | What it establishes | Where |
|---|---|---|
| `lolly smoke` | Every tool in the active content profile renders at its defaults to its first Node-native format. A skip is never counted as a pass. | `shells/cli/src/smoke.ts` |
| Export characterisation | A fixed matrix of nine tools, chosen so every export branch is exercised, is rendered twice through the real web export path and classified as hashed or size-banded. Same machine only. | `scripts/characterize-export.ts` |
| Comparison modules | Bounded text and structure comparison with stable-id moves, an explicit `undetermined` result and a preview-grade visual mode that states its limits. | `engine/src/compare.ts`, `engine/src/compare-structure.ts`, `engine/src/compare-visual.ts`, `engine/src/compare-budget.ts` |
| Host conformance kit | A live host carries the members the contract declares, checked at run time rather than at compile time. | `packages/core/src/host-conformance.ts` |
| Docs shots | A vector baseline is compared exactly, and every raster baseline carries a written reason in one allowlist that fails in both directions. | `tests/docs-shots-vector.test.ts` |

When a suite exists, its first reports come from this repository's continuous integration, where the render gate, `lolly smoke` and the export characterisation script already run. A page listing each shell's results is the cheapest trust asset the suite can carry (plan sections 11.1 and 18).

This draft adds no conformance or reproducibility claim beyond the ones `docs/determinism.md` already makes, and it states no threshold and no latency target (C8).

## Open points

- **Q1. The first editable interchange routes per pilot.** Default from plan section 16: the four routes and three edits in the editable round trips section above. Evidence that would change it: a customer route that outranks them.
- **Q5. Who may publish a suite under the `lolly` namespace, and how a local or Work suite is named.** Default from plan section 16: `lolly/*` suites are published from this repository's continuous integration only, Work instances publish under `work:<instance>/*`, local people publish under `local/*` and an acceptance record always states the suite it judged. Evidence that would change it: a partner programme that needs a shared namespace.

The other open questions are carried in other chapters, each with its recommended default and none of them yet answered (plan section 16). Q2 and Q3 are in [Constraints, authority and local choice](policy.html). Q4 is in [Operations and outcomes](operations.html). Q6 is in [Status and open points](status.html).

## Precedents

- `engine/src/compare.ts`
- `engine/src/compare-structure.ts`
- `engine/src/compare-text.ts`
- `engine/src/compare-visual.ts`
- `engine/src/compare-budget.ts`
- `engine/src/penpot-file.ts`
- `engine/src/design-map.ts`
- `engine/src/pptx-read.ts`
- `packages/core/src/host-conformance.ts`
- `packages/core/src/host-v1/apis.ts`
- `packages/node-shell/src/pptx.ts`
- `packages/core/src/chart-v1.ts`
- `schemas/tool.schema.json`
- `shells/cli/src/smoke.ts`
- `shells/web/src/views/design-import.ts`
- `shells/web/src/views/penpot-import.ts`
- `scripts/characterize-export.ts`
- `tests/docs-shots-vector.test.ts`
- `docs/determinism.md`
- `docs/agenda.md`
