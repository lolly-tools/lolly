# AI evidence in Verify

The Verify view can inspect text and visible layout patterns alongside Content Credentials, integrity, rights and production checks. Available checks start automatically after opening a file or pasting text. The floating toolbar follows the file you are reading and keeps file, text, URL, inspection and report actions together. On a phone, additional actions are under **More**. Inspection runs on the device in the web shell and CLI. An MCP request sends the explicitly supplied file bytes to the MCP server.

## Reading an assessment

| Reading | Meaning |
|---|---|
| Evidence strength | A heuristic index of observed clue families. Repeated occurrences of one pattern count together. This is not an authorship probability. |
| Pattern confidence | Confidence in recognizing or locating the particular pattern, with an observed or heuristic basis. |
| Estimated AI involvement | A probability for a declared reference population, available only with a matching released calibration. Currently **Unestimated** in the view and **Not estimable** in reports. |
| Declared origin | Credential declarations, unsigned metadata and container hints, with their integrity and scope kept separate from inference. |

A rounded card with a coloured edge, an eyebrow heading or padded labels in a short list can occur in human work. Useful categories, ordered procedures, quoted examples and brand requirements can explain these patterns. Missing metadata, unavailable models and unread text do not increase evidence strength. No finding establishes human authorship through absence.

Text pasted from a chat assistant often keeps the answer's layout: several "Label: sentence" lines, headings such as Strengths and Weaknesses, numbered section titles beside them and question headings. **Chat-answer layout** counts these together as one weak clue family, and **Dense three-part lists** counts runs of "X, Y, and Z" lists as another. Both were kept only where human READMEs, reviews, news, Q&A answers and essays by English learners rarely show them, and both mark the exact labels, headings and lists they matched.

Eyebrows count as weak clues whether or not their wording repeats the heading. Explanatory examples remain excluded. Select a finding to see its text spans or page regions, measurements, method and alternative explanations. Repeated occurrences retain their individual locations and measurements. Page navigation and zoom keep region overlays aligned. Filters leave the assessment unchanged.

## Reading the heat view

The text and the page preview carry the evidence as layers, so you can see the location of each observation before reading a list of findings. Toggle the layers beside the page selector.

| Layer | What it shows |
|---|---|
| Heat | Each sentence, and each located region of a page, shaded from amber to red by the findings that touch that sentence or region. A specific artifact counts at full strength, a style clue at a little over half, and an excluded match adds nothing. Heat is a reading aid and never a probability. |
| Matched words | The exact characters each finding matched: red for a specific artifact, amber for a style clue, an underline for a match excluded as quoted or discussed. |
| Classifier chunks | Shown only when the local classifier ran. The text is split into sentence groups of at least 55 words, and each group's raw score is drawn in its own column beside the heat. Scores below 0.85 are not drawn, because they are common on human writing; a group at or above the sentence threshold (0.93 for the current model) is also underlined. Short passages score more widely than whole documents, so this threshold is higher than the document one, and these scores never change the evidence index. On the current development corpus, 1 of 751 human documents had a group at or over 0.93, and the model rarely reaches that level on plain-text chat answers. |

The narrow columns at the left of the text are a map of the whole document, one cell per sentence. Select any lit sentence, a cell in the map or a region on the page to open the inspector. It lists every signal there with its guidance level and strength, the classifier's raw score for that sentence group against its threshold, and a link to each full finding. **Previous** and **Next** step through the sentences that carry something. Signals that describe the whole text, such as even sentence rhythm or the aggregate classifier reading, are listed above the text instead of shading any one sentence.

Review annotations record a required brand pattern, quoted example or misdetected region. An annotation retains the original assessment. Retrying keeps recent assessments and their notes in the JSON export. JSON and readable exports contain recovered text, locations, coverage, versions and file/report SHA-256 digests. Reload checks the report digest against the original file; those hashes establish binding and integrity, not the truth of imported conclusions. Imported probability claims require an installed calibration and are currently refused.

## Coverage

| Format | Available inspection |
|---|---|
| Text and Markdown | Original characters, contextual findings, short numbering sequences and local classifier windows. No pixel geometry. |
| PNG, JPEG and WebP | Bounded pixel segmentation and optional local OCR with estimated line boxes. OCR may miss text and remains partial coverage. |
| SVG | Passive supported shapes and text, with a resource-blocked preview and pixel fallback. Scripts, external resources, unsupported CSS, filters and masks are excluded. |
| PDF | Native page text and estimated line geometry, supported page rendering and OCR for scans. Font substitutions and renderer limits remain explicit. |
| PPTX | Browser slide rendering, native text and supported shapes. The Node adapter currently reports native text with layout unavailable. |
| DOCX | Available text extraction. Rendered page geometry is unavailable. |
| Video and audio | Existing verification remains available; temporal authorship assessment is unsupported. |

The initial browser read covers up to six pages. Inspect more pages to expand the read, within the 100-page session limit. Each page records completed, partial, skipped, unavailable, unsupported, failed or cancelled collectors. A cancelled job retains collected evidence. File replacement and view teardown stop updates to the previous panel.

Image decoding admits at most 40 megapixels and uses a preview edge no larger than 1800 pixels. Accent-card segmentation targets rounded neutral panels with a thin saturated edge; white-on-white panels and other treatments may be missed. Source text is bounded to 65,536 characters per page. Classifier windows use measured token counts, retain context near the document tail and record every inspected range. A bounded sample of a long document reports gaps rather than claiming a complete read. The classifier gate is conservative English prose eligibility, not a general language detector.

Local OCR and the text classifier run when cached. **OCR** in More uses the existing model download offer. Eligible text without a cached classifier gets **Download** and **Skip** in the toolbar. Download opens the standard consent and size offer; Skip retains the assessment with that check marked unavailable. Inspection introduces no file upload or automatic file retention.

## PDF reports

Choose **Report** in the toolbar, or in **More** on a phone, for a paginated PDF.
The report includes the current file preview, metadata, recorded EXIF map,
credential observations, completed production checks, and a preview with located
findings for each inspected page. Pattern-confidence rings describe detection of
features; per-page AI probabilities remain unestimated. Pages beyond the current
inspection scope are identified as unread.

The PDF includes the detailed evidence and production JSON as associated data
files. Lolly adds Content Credentials and verifies the signature before offering
the download. An enrolled device uses its enrolled signing identity; otherwise
Lolly uses a local self-signed key. The report states which applies. The signature
protects the report and does not authenticate the source file or its authorship.
A signing failure produces an error instead of silently saving an unsigned PDF.

**Policy** in More opens the otherwise hidden **Production policy** controls.
These compare explicit delivery requirements; they do not contribute to AI
confidence. See [Production checks](production-checks.md) for requirements and
review records.

## Calibration status

The development pilot downloaded 1,400 labelled clean scientific abstracts from the [RAID dataset](https://huggingface.co/datasets/liamdugan/raid), pinned to revision `865cac74188466cb0c3b7574a10204007b57a459`. The dataset card declares MIT; upstream human-source licences remain applicable. Source groups were kept together across development, calibration and holdout. This sample does not establish creator, generator-family or domain independence, and pretrained exposure is unknown.

The original CPU-runtime pilot used full graph optimization. Its held-out eligible sample contains 38 human and 164 generated documents. At the operating point selected from calibration for a nominal 1% human false-positive rate, both the old prefix classifier and the revised windows recalled 150 of 164 generated documents, with zero observed human false positives. The 95% upper false-positive bound is still about 9.2%. The candidate fusion's empirical calibration error is 0.0906, above the frozen 0.05 gate. These results support continued evaluation and explicit coverage; they do not qualify a probability release or demonstrate a broad accuracy improvement.

A later browser/Node comparison exposed a quantized CPU graph-optimization discrepancy. Both runners now use basic optimization, and reports distinguish CPU and WebAssembly method versions. The earlier pilot does not calibrate this corrected runtime. A separate development comparison retains the previous prefix runner as its baseline; fresh independent holdout qualification is still required.

Pattern fixtures have geometry labels, not inferred authorship labels. Visual authorship calibration needs reviewed creation history, matched designs with and without the motifs, human templates and generated designs without those motifs. Current-generator, mixed, translated, OCR and broader document populations remain unqualified. Visual clues stay available for review without a numeric authorship claim.

## CLI and MCP

```sh
lolly inspect file.svg --forensic
lolly inspect document.pdf --forensic --page-cap=12
lolly detect-ai --in=article.txt --json
```

`detect-ai` retains its existing estimate fields and adds window ranges, token counts and completeness. `probAi` is the legacy field name for a raw classifier score. The human-readable output labels that score explicitly.

`lolly_inspect` accepts `forensic: true`, a named `file` and optional `forensicPageCap` from 1 to 100. Forensic, production and motion inspection use separate requests. All surfaces use the same engine evidence rules and report contract; shell-specific missing collectors remain visible.

Rule changes are measured with `node scripts/prepare-forensic-corpus-v4.ts`, which assembles a wider local corpus (RAID across eight domains, HC3 human and ChatGPT answers, learner essays, presumed-human READMEs and current chat answers, split by source group into development and holdout), and `node scripts/evaluate-forensic-rules.ts --compare=<earlier run>`, which reports each rule's firing rate on human and AI documents with an upper bound and the movement of evidence bands. Tune on the development split only.

Maintainers can reproduce the public development corpus with `node scripts/prepare-forensic-corpus.ts`, run `node scripts/evaluate-forensic-ai.ts` for the baseline, freeze `preregistration.json`, then run the evaluation with `--holdout`. A frozen evaluation cannot be overwritten by another development run. `node scripts/export-forensic-calibration.ts` exports the unreleased candidate from those frozen records without refitting.

`node scripts/prepare-forensic-design-review.ts` creates a review worksheet, provenance manifest and matched SVG, PNG, PDF and native PowerPoint controls. These synthetic controls test localization and exclusions; they are not independent authorship examples. Run `node scripts/check-verify-forensic-browser.ts <local-web-origin>` against a built web shell to exercise the inspection flow, review export, reload validation, cancellation and mobile layout. Downloads, raw material, private review examples and machine reports stay under `plans/`. No calibration artifact is installed by these workflows.
