# AI evidence in Verify

Someone sends you an article, a report or a slide deck, and you wonder whether a model wrote the words. Drop the file on [Verify](/#/verify), or paste the text. Lolly marks the places where the words or the layout look like typical generated work: the exact phrases, headings and page regions, why each one counts and what else could explain the pattern.

You get evidence, not a verdict. The checks run on your device, in the app and in the command line, and start on their own when you open a file or paste text. Nothing is uploaded unless you send a file to the MCP server yourself.

::: cols
## What you get

- Each clue located in the text or on the page, with its measurement and method.
- The innocent explanations that could produce the same pattern.
- How much of the file was actually read, and what was skipped.
- A signed report you can keep, with your own review notes.

## What you never get

- An AI percentage. No released calibration supports one yet, so the view says **Unestimated**.
- A verdict of human authorship. Missing metadata, unavailable models and unread text never count either way.
- A guess at which model did the writing. Invisible characters and product names in the text do not identify a generator.
:::

Careful human writing can trip the same patterns. Useful categories, ordered procedures, quoted examples and brand requirements explain many of them, and the view lists those alternatives beside each finding.

Text that Lolly's own reword model wrote is different: it carries a public watermark that Verify can detect. See [What Verify checks](/info/what-verify-checks.html#text-reworded-by-lolly).

## Reading an assessment

| Reading | What it means |
|---|---|
| Evidence strength | A heuristic index of the families of clues observed. Repeats of one pattern count together. This is not an authorship probability. |
| Pattern confidence | How sure Lolly is that it recognised or located the particular pattern, with an observed or heuristic basis. |
| Estimated AI involvement | A probability for a declared reference population, available only with a matching released calibration. Currently **Unestimated** in the view and **Not estimable** in reports. |
| Declared origin | Credential declarations, unsigned metadata and container hints, with their integrity and scope kept separate from inference. |

Some of the patterns Lolly looks for:

- **Chat-answer layout.** Text pasted from a chat assistant often keeps the answer's shape: several "Label: sentence" lines, headings such as Strengths and Weaknesses, numbered section titles beside them and question headings. These count together as one weak family of clues.
- **Dense three-part lists.** Runs of "X, Y, and Z" lists count as another. Both patterns were kept only where human READMEs, reviews, news, Q&A answers and essays by English learners rarely show them, and both mark the exact labels, headings and lists they matched.
- **Visual motifs.** A rounded card with a coloured edge, an eyebrow heading or padded labels in a short list can all occur in human work. Eyebrows count as weak clues whether or not their wording repeats the heading. Explanatory examples stay excluded.
- **Hidden characters.** Hidden Unicode inspection keeps recognised emoji flag tags, CJK variants and script-shaping joiners. Unexpected invisible characters remain artifacts with possible human explanations; they do not identify a model.
- **Generator hints.** A PNG's Creator field and structured generation parameters can supply unsigned hints. A narrative mention of an AI product does not establish a generator.

Select a finding to see its text spans or page regions, measurements, method and alternative explanations. Repeated occurrences keep their own locations and measurements. Page navigation and zoom keep the region overlays aligned, and filters leave the assessment unchanged. Rules version `forensic-ai/2` invalidates calibrations from earlier rules.

## Seeing where: the heat view

The text and the page preview carry the evidence as layers, so you can see the location of each observation before you read a list of findings. Toggle the layers beside the page selector.

| Layer | What it shows |
|---|---|
| Heat | Each sentence, and each located region of a page, shaded from amber to red by the findings that touch each one. A specific artifact counts at full strength, a style clue at a little over half, and an excluded match adds nothing. Heat is a reading aid, never a probability. |
| Matched words | The exact characters each finding matched: red for a specific artifact, amber for a style clue, and an underline for a match excluded as quoted or discussed. |
| Classifier chunks | Shown only when the local classifier ran. The text is split into groups of sentences of at least 55 words, and each group's raw score is drawn in its own column beside the heat. Scores below 0.85 are not drawn, because they are common on human writing. A group at or above the sentence threshold (0.93 for the current model) is also underlined. |

Short passages score more widely than whole documents, so the chunk threshold is higher than the document one, and chunk scores never change the evidence index. On the current development corpus, 1 of 751 human documents had a group at or over 0.93, and the model rarely reaches that level on plain-text chat answers.

The narrow columns at the left of the text map the whole document, one cell per sentence. Select any lit sentence, a cell in the map or a region on the page to open the inspector. It lists every signal there with its guidance level and strength, the classifier's raw score for that group against its threshold, and a link to each full finding. **Previous** and **Next** step through the sentences that carry something. Signals about the whole text, such as even sentence rhythm or the overall classifier reading, are listed above the text rather than shading one sentence.

## Recording your review

Annotations record a required brand pattern, a quoted example or a misdetected region, and each one keeps the original assessment alongside the note. Retrying keeps recent assessments and their notes in the JSON export.

JSON and readable exports contain the recovered text, locations, coverage, versions and SHA-256 digests of the file and the report. Reload checks the report digest against the original file. Those hashes establish binding and integrity, not that the imported conclusions are true. Imported probability claims need an installed calibration, and are refused today.

## What each format covers

| Format | Available inspection |
|---|---|
| Text and Markdown | Original characters, contextual findings, short numbering sequences and local classifier windows. No pixel geometry. |
| PNG, JPEG and WebP | Bounded pixel segmentation and optional local OCR with estimated line boxes. OCR may miss text, so coverage stays partial. |
| SVG | Passive supported shapes and text, with a resource-blocked preview and a pixel fallback. Scripts, external resources, unsupported CSS, filters and masks are excluded. |
| PDF | Native page text and estimated line geometry, supported page rendering and OCR for scans. Font substitutions and renderer limits stay explicit. |
| PPTX | Browser slide rendering, native text and supported shapes. The Node adapter currently reports native text with layout unavailable. |
| DOCX | Available text extraction. Rendered page geometry is unavailable. |
| Video and audio | Existing verification stays available; judging authorship over time is not supported. |

Local OCR and the text classifier run when they are cached. **OCR**, under **More**, uses the usual model download offer. Eligible text without a cached classifier gets **Download** and **Skip** in the toolbar: Download opens the standard consent and size offer, and Skip keeps the assessment with that check marked unavailable. Inspection adds no file upload and keeps no file automatically.

The floating toolbar follows the file you are reading and keeps the file, text, URL, inspection and report actions together. On a phone, more actions are under **More**.

::: details Limits of the read
The first browser read covers up to six pages. Inspect more pages to widen it, within the 100-page session limit. Each page records which collectors completed, ran partially, were skipped, unavailable, unsupported, failed or cancelled. A cancelled job keeps the evidence it collected. Replacing the file or leaving the view stops updates to the previous panel.

Image decoding admits at most 40 megapixels and uses a preview edge no larger than 1800 pixels. Accent-card segmentation looks for rounded neutral panels with a thin saturated edge; white-on-white panels and other treatments may be missed. Source text is bounded at 65,536 characters per page. Classifier windows use measured token counts, keep context near the end of the document and record every inspected range. A bounded sample of a long document reports gaps rather than claiming a complete read. The classifier's gate is conservative eligibility for English prose, not a general language detector.
:::

## Reports

Choose **Report** in the toolbar, or under **More** on a phone, for a paginated PDF. It includes the current file preview, metadata, the recorded EXIF map, credential observations, completed production checks and, for each inspected page, a preview with the located findings. Pattern-confidence rings describe how well a feature was detected; per-page AI probabilities stay unestimated. Pages beyond the current inspection are marked as unread.

The PDF carries the detailed evidence and production JSON as attached data files. Lolly adds Content Credentials and verifies the signature before offering the download. An enrolled device signs with its enrolled identity; otherwise Lolly uses a local self-signed key, and the report says which. The signature protects the report. It does not authenticate the source file or its authorship. If signing fails, you get an error rather than a silently unsigned PDF.

**Policy**, under **More**, opens the otherwise hidden **Production policy** controls. They compare explicit delivery requirements and do not add to AI confidence. See [Production checks](/info/production-checks.html) for requirements and review records.

## From the command line and MCP

```sh
lolly inspect file.svg --forensic
lolly inspect document.pdf --forensic --page-cap=12
lolly detect-ai --in=article.txt --json
```

`detect-ai` keeps its existing estimate fields and adds window ranges, token counts and completeness. `probAi` is the older field name for a raw classifier score; the readable output labels that score plainly.

`lolly_inspect` accepts `forensic: true`, a named `file` and an optional `forensicPageCap` from 1 to 100. Forensic, production and motion inspection use separate requests. Every surface uses the same engine evidence rules and report contract, and a collector missing on one shell stays visible as missing.

::: details Calibration status
The development pilot downloaded 1,400 labelled clean scientific abstracts from the [RAID dataset](https://huggingface.co/datasets/liamdugan/raid), pinned to revision `865cac74188466cb0c3b7574a10204007b57a459`. The dataset card declares MIT; the licences of the upstream human sources still apply. Source groups were kept together across development, calibration and holdout. This sample does not establish independence of creator, generator family or domain, and exposure during pretraining is unknown.

The original CPU-runtime pilot used full graph optimisation. Its held-out eligible sample contains 38 human and 164 generated documents. At the operating point chosen from calibration for a nominal 1% human false-positive rate, both the old prefix classifier and the revised windows recalled 150 of 164 generated documents, with no observed human false positives. The 95% upper bound on false positives is still about 9.2%. The candidate fusion's empirical calibration error is 0.0906, above the frozen 0.05 gate. These results support continued evaluation and explicit coverage. They do not qualify a probability release or show a broad accuracy improvement.

A later comparison between browser and Node exposed a discrepancy in quantised CPU graph optimisation. Both runners now use basic optimisation, and reports distinguish the CPU and WebAssembly method versions. The earlier pilot does not calibrate this corrected runtime. A separate development comparison keeps the previous prefix runner as its baseline; a fresh, independent holdout qualification is still required.

Pattern fixtures carry geometry labels, not inferred authorship labels. Calibrating visual authorship needs reviewed creation history, matched designs with and without the motifs, human templates and generated designs without those motifs. Current-generator, mixed, translated, OCR and broader document populations remain unqualified. Visual clues stay available for review without a numeric authorship claim.
:::

::: details For maintainers: measuring rule changes
Rule changes are measured with `node scripts/prepare-forensic-corpus-v4.ts`, which assembles a wider local corpus (RAID across eight domains, HC3 human and ChatGPT answers, learner essays, presumed-human READMEs and current chat answers, split by source group into development and holdout), and `node scripts/evaluate-forensic-rules.ts --compare=<earlier run>`, which reports each rule's firing rate on human and AI documents with an upper bound and the movement of evidence bands. Tune on the development split only.

To reproduce the public development corpus, run `node scripts/prepare-forensic-corpus.ts`, then `node scripts/evaluate-forensic-ai.ts` for the baseline, freeze `preregistration.json`, and run the evaluation with `--holdout`. A frozen evaluation cannot be overwritten by another development run. `node scripts/export-forensic-calibration.ts` exports the unreleased candidate from those frozen records without refitting.

`node scripts/prepare-forensic-design-review.ts` creates a review worksheet, a provenance manifest and matched SVG, PNG, PDF and native PowerPoint controls. These synthetic controls test localisation and exclusions; they are not independent examples of authorship. Run `node scripts/check-verify-forensic-browser.ts <local-web-origin>` against a built web shell to exercise the inspection flow, review export, reload validation, cancellation and mobile layout. Downloads, raw material, private review examples and machine reports stay in a local, gitignored folder. None of these workflows installs a calibration artifact.
:::
