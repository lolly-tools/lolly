# First layout experiment results

Measured locally on 29 September 2026, using the existing staged models. These
are results on the lab's authored examples, not production accuracy claims.

## CPU comparison

Apple M4, macOS arm64, Node 24.21.0, native ONNX CPU execution with two intra-op
threads. All methods received the same eligible layouts. Seventeen briefs have
provisional acceptable-layout labels; an eighteenth deliberately overflows and
is refused before inference. Every labelled brief retained at least one
acceptable layout in its candidate set.

| Method | Valid recommendations | Acceptable first choice | Acceptable choice among first three | Median inference | P95 inference |
| --- | ---: | ---: | ---: | ---: | ---: |
| Structural rules | 17/17 | 5/17 | 6/17 | Not timed | Not timed |
| MiniLM similarity | 17/17 | 14/17 | 16/17 | 4 ms | 14 ms |
| SmolLM constrained choice | 17/17 | 5/17 | 10/17 | 1,488 ms | 1,856 ms |
| SmolLM prompted JSON | 0/17 | 0/17 | 0/17 | 2,746 ms | 5,119 ms |

Timings exclude model loading, candidate preparation and rendering. They include
the time spent producing invalid JSON. MiniLM caches candidate descriptions
after their first use. The rule report records zero because it does not time the
candidate preparation that performs the structural scoring.

Rotating the candidate order by two positions left MiniLM's first choice
unchanged on all 17 briefs. SmolLM's first choice changed on 15 of 17, and its
acceptable first choices fell from 5 to 4. This is evidence of substantial option
order sensitivity in this prompt and model configuration.

The JSON responses reproduced numbered options instead of the requested object.
This is a failure of prompt-only JSON generation with this model and token
budget. It does not evaluate grammar-constrained generation or json-render's
renderer and validation.

## Browser check

A separate Playwright Chromium 153 run used WASM on the same machine, with four
runtime threads and cross-origin isolation. On the first onboarding brief:

| Method | Local model load | Inference | Outcome |
| --- | ---: | ---: | --- |
| MiniLM | 428 ms | 95 ms | Selected the labelled three-step layout |
| SmolLM choice | 1,414 ms | 2,382 ms | Valid choice, outside the provisional acceptable set |
| SmolLM JSON | Already loaded | 14,641 ms | Invalid JSON |

These are single-case observations, not browser latency percentiles. Model bytes
were already on disk and served over loopback. No download from a model host was
timed, and no constrained-device memory benchmark was performed.

The browser check also passed apply/undo, Design input export, cancellation when
switching artboards, request editing, mobile-width layout and request-origin
checks. No page errors or external network requests were observed.

## What this supports

MiniLM is the best candidate from this run for a small, local recommendation
pilot: Lolly prepares layouts that preserve the content and pass the fit
estimate, then similarity ranks a few previews. The current 360M generative
model adds latency without improving the choices in these experiments.

The evidence is limited. Explicit layout language in several requests favours
description matching. MiniLM missed both briefs whose relationship was implicit
in their content, plus the quoted-instruction case, as a first choice. Its query
uses the request, title and headings, not body paragraphs. The provisional labels
need independent review. The rules baseline uses synthesized features, so its
score does not measure the complete Rebrand pipeline.

The next useful experiment is an independently labelled set of real artboards,
including vague requests, tested with actual font shaping and brand masters.
That should determine whether richer embeddings or a stronger local model add
enough value. A separate json-render adapter experiment can then test generated
Ask controls against a restricted component catalog; this lab does not yet
establish that integration's value.

## Reproduce

Commands and model requirements are in [README.md](README.md). Full reports from
this run, including raw responses and individual timings, are local ignored
artifacts:

- `plans/scratch/layout-lab/node-report.json`
- `plans/scratch/layout-lab/rotated-report.json`
- `plans/scratch/layout-lab/browser-report.json`
- `plans/scratch/layout-lab/browser-check.json`

The report timestamps use UTC, so this UK run is recorded as 28 September there.

## Real corpus run

Later on 29 September, a local set of nine PPTX files and two PDFs supplied 227
slides/pages. All were read through the Rebrand Node reader and received local
reference previews. Private source content and extracted evidence stay in the
ignored corpus directory, not in these experiment sources.

| Observation | Count |
| --- | ---: |
| Source slides/pages | 227 |
| Full-slide pictures identified as flattened | 19 |
| Flattened slides where PP-OCRv5 found some text | 19 |
| Recovered text objects across those slides | 84 |
| Slides inside the first layout contract | 59 |
| Slides retained for inspection | 168 |
| Eligible slides with more than one layout candidate | 54 |

OCR reconstruction took a median 1,483 ms per flattened slide on this machine,
with a 66 to 2,417 ms range. This includes decoding and reconstruction around the
recogniser; it is not just model inference. Results are cached for subsequent
imports. Finding text is not a transcription accuracy measure. Visual spot checks
found useful table and card text, plus an AI/Al letter confusion. There is no
verified transcript for the whole set. OCR of embedded screenshots and outlined
vector chart labels has not been evaluated by this pass.

The largest restrictions were more than six body objects (59 slides), multiple
content pictures (51), and chart/table/vector/unknown content (48). Another 34
slides had no candidate that passed the fit estimate. These categories overlap.
Some exclusions also arise from meaningful shapes, missing source content or
unreadable text. All remain browsable with the original reference, object text,
census classifications and Rebrand's structure proposal.

Rules and MiniLM produced valid choices for all 59 eligible slides. MiniLM's CPU
inference median was 2 ms and P95 was 6 ms, excluding model loading and candidate
preparation. The methods agreed on the first choice on 21 of 59 slides. Agreement
is not correctness: there are no independent layout labels, and all accuracy
fields are null. These figures describe the simpler eligible subset, not the
whole corpus. The browser check also ran MiniLM in WASM on a recovered slide and
verified that a chart case stays inspectable without a lossy recommendation.

The production integration below now uses the full Rebrand content contract.
Extraction and layout labels still need separate review. The source material
does not justify carrying over the synthetic set's 14/17 result as an expected
real-slide success rate.

Local evidence:

- `plans/scratch/layout-lab/real/index.json` and `summary.json`
- `plans/scratch/layout-lab/real/cases/` for each slide's extraction and OCR evidence
- `plans/scratch/layout-lab/real-ranking.json` for the 59-case comparison
- `plans/scratch/layout-lab/browser-corpus-report.json` and `browser-corpus-check.json`

## Integrated Rebrand workflow

The production chooser uses the existing one-slide Rebrand compile, with its
native tables, grouped content, charts, pictures and vectors. Each candidate must
pass lineage, text and compiler-report checks before being shown. At most 16
layouts are compiled in a worker and up to three previews are returned. MiniLM ranks
catalog descriptions; the model never writes content or geometry.

On the same 227-page corpus, the starter design system produced checked choices
for 161 slides using structural choices, and 165 with MiniLM. Six of the 19
OCR-reconstructed slides had passing choices. The remaining slides were withheld
because of missing or unused content, reader omissions, unresolved objects or
fit failures. These are coverage figures, not human assessments of design quality
or OCR accuracy. A safe fallback can be preferable to a suggested rearrangement.

The final CPU MiniLM evaluation including candidate compilation had a 49 ms median and
411 ms P95, excluding initial model loading and catalog embedding. These are local
observations, not device-wide performance guarantees. A real production browser
run on the sample deck took approximately 1.5 seconds for local matching and
checks, including loading the cached model into a fresh WASM worker.

Both the development and production browser checks exercised actual model
download, inference, stage workers, compiled previews, application, undo,
cancellation and a 390 px viewport. The checked requests stayed on the local
origin, with no page errors. The broader Rebrand test run passed 1,142 tests;
11 gated cases were skipped. The production web build passed.

The full browser OCR path was also checked on `Lolly_Strategic_Vision.pptx`: all
15 slides were rebuilt, the first slide's editable text and retained artwork
were visually inspected, and a checked layout was applied and undone. This used
the normal 20 MB OCR download offer. No external requests or page errors were
observed. The final chooser offers only the most compact passing choices, so a
layout that moves artwork onto an extra slide is withheld when a one-slide
choice already passes.

Rebrand's layout suggestions are available through **Change layout**, or **L**,
then **Suggest layouts**. Missing local matching is offered as an optional 23 MB
download. The existing OCR action remains the entry point for whole-slide
pictures. Read [the implementation guide](../../shells/web/src/lib/rebrand/layout-options.md)
for the checks and remaining limitations.

Local evidence:

- `real/recommendations-lolly-start.json` and `real/recommendations-lolly-start-embed.json`
- `browser-rebrand-report.json`, `browser-rebrand-production.log` and screenshots
- `browser-rebrand-ocr-report.json` and `rebrand-ocr.png`
- `rebrand-tests.log`, `build-web.log`, `lint.log` and the typecheck reports

These paths are relative to `plans/scratch/layout-lab/` and are not committed.

## Rebrand workflow revision

The slide-first workflow now separates preview from Apply and puts the full
library behind a disclosure. Content-sized text grids and ruled cards are built
for 2 to 12 groups. A nine-heading fixture with separate bullet objects compiles
to one 3-by-3 slide under both starter and SUSE masters, retains every word and
keeps each heading above its own bullets. Visual inspection removed a four-column
alternative that stranded the ninth group. When generated choices pass, unrelated
authored templates do not fill the remaining recommendation slots.

The SUSE rules-only corpus rerun still returned passing choices on 161 of 227
slides, including 6 of 19 recovered slides. Median candidate compile time was
14 ms, P95 144 ms on this machine. These are coverage and timing observations,
not aesthetic ratings. Native slides without source page pictures still use the
importer's approximate preview. Whole-slide recovery pictures and stored chart
artwork are kept intact in Original while selection boxes remain interactive.

The shared generator can seed and reset Design frames; wiring the SUSE deck
builder's Markdown input to the same components remains a separate integration.
