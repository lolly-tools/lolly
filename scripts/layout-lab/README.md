# Layout recommendation experiments

An isolated lab for recommending a layout for one artboard. The lab uses existing
Lolly slide masters, frame seeding, archetype scoring, fit estimates and SVG
previews. All model files come from the local models directory.

See [RESULTS.md](RESULTS.md) for the first measured comparison and its limits.

The resulting workflow is now integrated into Rebrand's **Change layout** chooser.
See [the implementation guide](../../shells/web/src/lib/rebrand/layout-options.md)
for use, checks, model downloads and cancellation. The original lab remains a
separate experiment; its limited brief format is not the production contract.

Start the browser lab from the repository root:

```sh
node scripts/layout-lab.ts --serve
```

Open <http://127.0.0.1:4317>. Select a brief, edit the request and choose **Compare
this slide**. Each method ranks the same content-preserving candidates. Selecting
a recommendation previews the artboard. **Use in lab** and **Undo** affect only
the lab. **Export Design inputs** saves a `toolId` and an `inputs.boxes` array;
the output is an input record, not a `.lolly` archive. Pictures are stand-ins with
source IDs, so their bytes are not included in this export.

**Run all 18 briefs** processes one artboard and one method at a time. **Cancel
and release model** terminates the worker. Changing the artboard or editing the
request also cancels outstanding work. Reports are downloaded only on request;
the lab writes no browser storage.

## Real slide corpus

Import a local folder of PPTX and PDF files through Rebrand's Node reader. The
optional OCR pass uses the same `reconstructFlattenedSlide` and installed
PP-OCRv5 model as Rebrand. Source documents are read only. All extracted content,
media, OCR evidence and previews go under the ignored `.scratch` directory.

```sh
node scripts/layout-lab/import-corpus.ts /path/to/slides --ocr --render
node scripts/layout-lab.ts --serve --corpus=.scratch/layout-lab/real
node scripts/layout-lab.ts --corpus=.scratch/layout-lab/real \
  --methods=rules,embed --out=.scratch/layout-lab/real-ranking.json

# With the corpus server running:
node scripts/layout-lab/browser-corpus-check.ts
```

`--render` requires local LibreOffice, `pdfinfo` and `pdftoppm`. It renders
references at 1100 pixels on the long side. PPTX references may differ from
PowerPoint, especially where fonts or effects differ. Page counts must agree
before references are attached. `--references=/path/to/pdf-copies` can reuse
matching PDF copies of the current PPTX files, named with the same stem.

Choose a deck under **Test set**, then a slide. Filters show OCR cases, charts
and tables, and slides inside or outside the initial layout contract. The server
loads only the selected case and its images into the page. `?case=<case-id>`
opens a particular source slide. The synthetic batch button is disabled for the
real corpus; real-file CLI runs process eligible slides sequentially.

The extraction details retain all object texts, including those the census
classifies as furniture or logos and excludes from the recommendation brief.
These classifications are hypotheses, not approved deletions. Original source
objects, their grouping and media stay in the local cache. Complex content stays
available for inspection rather than being silently omitted from a brief.

Imported cases use actual census features for structural scoring and a neutral
request, with no invented layout labels. The full Rebrand structure proposal is
also shown separately. Real cases have no accuracy labels: reports use null for
accuracy fields, and coverage must not be described as recommendation accuracy.
Native charts, multiple content pictures, vectors, meaningful shapes and more
than six body objects currently fall outside this lab's recommendation contract.
The available subset therefore favours simpler slides. Font fit remains estimated.

OCR evidence records model, calls, elapsed time and before/after text-object
counts. Finding some text is not proof of a complete or correct transcription.
The pass rebuilds whole-slide pictures identified as flattened by Rebrand; it
does not OCR every embedded screenshot or recover outlined chart labels. The
first corpus import caches results by source hash and engine version. Repeating
the import reuses them; remove a deck's `ocr-<engine>.json` cache to rerun OCR.

The server exposes the corpus only when `--corpus` is supplied, and serves only
indexed case JSON, reference PNGs and supported picture bytes. Native text and
model prompts remain local. A pictured asset is visible in its recommendation
preview, but **Export Design inputs** still exports IDs without image bytes.

## Experiments

| Method | What runs | What the result means |
| --- | --- | --- |
| Layout rules | Existing `scoreArchetypes`, over features made from the brief | A structural baseline for these synthetic briefs |
| MiniLM similarity | Existing all-MiniLM-L6-v2 q8 model | Cosine similarity between the request/title/headings and prepared layout descriptions |
| SmolLM choice | Existing SmolLM2-360M-Instruct q4 model | One next-token evaluation, restricted to offered option numbers; top three from the candidate logits |
| SmolLM JSON | The same model, greedy decoding, at most 64 new tokens | Prompt asks for `{"choices":[1,2,3]}`; strict parsing rejects prose, unknown options and repeated choices |

The choice and JSON methods share the content and candidate descriptions. Only
the output instruction and decoding constraint differ. The choice experiment
tests the discrete-decision approach; the JSON experiment tests the prerequisites
for generated component specifications. json-render is not installed by this
prototype. No model writes markup, coordinates, colours or source text.

Each source block has a stable ID. Lolly assigns its heading and body to the
selected layout deterministically. Candidate checks reject missing content and
estimated text overflow. Unknown model choices cannot become a layout. The UI
can show rules after a failed model response, but that fallback is never counted
as a model success in the report.

## Local model files

The normal `resolveModelsDir()` lookup applies, including `LOLLY_MODELS_DIR`.
These existing model directories are required for the corresponding methods:

```text
<models>/embed/                         # MiniLM, including tokenizer and q8 ONNX
<models>/reword/smollm2-360m-instruct/    # SmolLM, including tokenizer and q4 ONNX
```

The browser uses the installed Transformers.js package and its own matching ORT
WASM files, served directly from that dependency. It does not depend on staged
web build output. The server binds only to `127.0.0.1`, serves an allowlist of
paths and does not fetch missing models. Models and runtime bytes still cross
the loopback connection into the browser when loaded.

The staged SmolLM q4 graph runs on WASM in the browser. The production reword
worker also selects WASM because the pinned graph/runtime combination does not
benefit from WebGPU. Node uses the native CPU runtime with two intra-op threads.
Browser execution uses up to four WASM threads with cross-origin isolation.

## Repeatable runs

```sh
# No models required.
node scripts/layout-lab.ts --methods=rules

# Full CPU comparison, incremental report saved after each result.
node scripts/layout-lab.ts --methods=rules,embed,choice,json \
  --out=.scratch/layout-lab/node-report.json

# Rotate the option order to expose model position bias.
node scripts/layout-lab.ts --methods=embed,choice --rotate=2 \
  --out=.scratch/layout-lab/rotated-report.json

# One case; --limit bounds the number of briefs, --timeout bounds each worker call.
node scripts/layout-lab.ts --methods=choice,json --case=implicit-sequence

# With the lab server running and both models installed:
node scripts/layout-lab/browser-check.ts

node --test tests/layout-lab.test.ts
```

The CLI defaults to rules and writes `.scratch/layout-lab/report.json`. `--port`
changes the browser port. No report contains uploaded material unless the person
edits a brief to include that material.

Reports include candidate IDs, raw model output, validity, labels, candidate
recall, input revision key, backend, load time and inference time. A response that
fails strict validation has empty recommendation IDs. A layout with no fitting
candidate is refused before inference. Scores and logits are not calibrated
confidence. The JSON method is prompt-constrained only; its results do not test
a runtime with JSON grammar enforcement.

## Limits of the evidence

The 18 briefs are authored smoke tests. Seventeen have provisional acceptable
layout labels and one deliberately exceeds every candidate's capacity. Labels
are kept outside the inference request. This set has explicit prompts, implicit
relationships, dense copy, pictures and instructions quoted as slide content.
The labels have not had an independent human review, and the corpus is not a
held-out deck benchmark.

The structural baseline synthesizes geometric features from the brief. It does
not run the full PPTX/PDF ingestion, census or structure matcher. Its score must
not be reported as Rebrand's overall accuracy. The fixed candidate vocabulary is
a subset of the neutral master and currently handles text plus at most one
picture. It excludes charts, tables, brand-specific masters and general Design
documents.

Previews use `framePreviewSvg`, whose line wrapping and overflow checks use an
average glyph width. Passing these checks is not proof that text will fit with
the final fonts. Real shaping, exported-file verification, private deck samples,
independent layout preferences and constrained-device memory measurements are
follow-up experiments before production integration. CPU timings and browser
WASM timings belong in separate reports. Model load times are reported apart
from inference; neither is a model download measurement.
