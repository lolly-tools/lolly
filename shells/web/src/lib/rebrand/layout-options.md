# Layout suggestions in Rebrand

Rebrand starts on the first slide with Original and Proposed side by side on a
wide screen. **Choose layout** stays above the object and style controls. Opening
that chooser generates previews for the selected slide. Select a preview, then
choose **Apply**. Closing the chooser leaves the plan unchanged. **Review changes**
opens the deck-wide review list; selecting an object opens its controls, with
**Back to slide** returning to the slide controls.

**Browse all layouts and arrangement options** reveals the existing library,
auto-match and bulk controls. **Restyle existing positions** describes the old
"Original arrangement" action: the objects stay in place but receive the brand's
style. The Original comparison is separate: recovery pictures remain untouched,
with transparent selection boxes on top. Stored chart artwork is used in that
comparison even after OCR has made its labels editable in the proposed slide.
Native slides without a stored page picture still use the importer's approximate
preview; this is not a PowerPoint rendering service.

Under **Refine layouts**, an optional request and **Download local matching**
install/use Ask's MiniLM q8 model, approximately 23 MB. Matching runs locally in a
WASM worker. No slide text is sent to a service. Without the model, or if inference
fails, geometry and compilation checks still work. Service policy controls the
embedding capability, including cancellation when that policy changes.

## Content and performance

The engine's internal `rebrand-layout-options.ts` module takes exactly one source
slide and its plan row. The web shell supplies the same preview plan as Rebrand,
including pending locked decisions. Existing object decisions, corrected text,
colours, theme and typography are carried into the compile.

The catalog is bounded to 96 supplied layouts; at most 16 candidates are compiled.
`slide-layout-components.ts` also generates layouts sized for 2 to 12 text groups.
Headings and nearby bullets form one group independently of the target columns.
Ruled cards and open text grids derive their capacity, spacing and type size from
the group count and brand master. A short final row is centred; an isolated last
card is not suggested. These are geometry recipes generated for the content, not
additional fixed entries in the brand catalog.

Recipes use bounded `flow-cards-N-C` / `flow-columns-N-C` references. They replay
through the same compiler after saving, reopening, undoing or exporting. The
master itself is not mutated. `seedFrame`, `archetypeSlots` and `applyArchetype`
recognise those references too. If content-sized choices pass the audit, the
chooser shows those choices without padding the list with unrelated templates.
Current and structural choices are reserved, with local matching able to bring
other library layouts into the shortlist. Only the most compact passing choices
are offered; the list can contain fewer than three rather than add unnecessary
continuation slides.
Content-sized choices take priority. Among authored layouts, a clear structural
match takes priority over semantic similarity unless the person supplies an intent. Scores are similarities, never probabilities.

The `rebrand.layout-options` stage compiles candidates sequentially in a worker,
yielding between candidates for cancellation. Only the best three compiled
results are retained. Checks reject:

- Kept objects whose lineage does not reach their output layers.
- Missing words or repeated values in kept text and native tables.
- Content left in the tray, unresolved objects and authored stand-ins.
- Reported text overflow, unreadable size and overlap with furniture.
- Reported source caps, skipped media and omitted vector items.

An unread whole-slide picture must go through Rebrand's **Read the text** action
before editable layouts can be suggested. Recovered slides remind the person to
check recognised text against the original. OCR spelling and reading order still
need review. The checks validate what the reader recovered, not the original
author's meaning. Font fit uses the existing compiler estimates; visual review
remains necessary. A chart preserved as vector artwork or a picture does not
become editable chart data just because its surrounding layout changes.

When no choice passes, the chooser explains the limiting condition and points
to the arrangement options. The existing **Keep as a picture** choice is also
available. No layout is applied automatically.

Closing the chooser, changing selection, changing the source or plan, or changing
the design system invalidates the run. An embedding session owns its worker;
stopping Rebrand does not cancel Ask. Embedding requests time out after 60 seconds;
the stage runner provides its existing cancellation and stalled-worker limits.

## Why there is no json-render dependency

The model ranks known components; Lolly creates and checks their geometry. Rebrand already renders
that catalog through the engine and writes normal Design layers, so another
renderer would duplicate that path. No model-generated JSON, code, coordinates or
rewritten slide content enters the plan. This contract can later support another
catalog renderer without changing the authored document format.

## Reuse in the deck builder

The shared component generator accepts a brand master and a bounded recipe, so
an authoring shell can group Markdown headings and bullets into cells before
seeding the same layouts. The current SUSE deck-builder hook still uses its own
Markdown and HTML layout path. It has not been wired to these helpers. That
integration should use the capability bridge or an authoring-shell adapter;
tool hooks must not import the engine.

This pass adds text-group grids and ruled cards. Image cards, comparisons,
metrics, processes and mixed media still use the authored library. More component
families need their own grouping and visual checks. Passing the automated audit
is not an aesthetic-quality score. The nine-group fixture is a visual and content
regression case, not proof that all imported diagrams can be rearranged well.

## Verification

`tests/rebrand-layout-options.test.ts` checks compilation, text preservation,
corrections, removal, catalog bounds, structural priority and cancellation.
`layout-options-ui.test.ts` checks explicit application and late-result disposal.
`ask/embed-session.test.ts` checks independent worker ownership and invalid replies.
`tests/slide-layout-components.test.ts` checks a nine-group slide across brands,
heading/bullet relationships, recipe replay and unchanged chart artwork. The
existing chooser suite covers application and preview behaviour.

With a running web shell, `node scripts/layout-lab/browser-rebrand-check.ts <url>`
exercises real model download, inference, stage workers, hover preview, apply,
undo, cancellation and the phone layout. The private OCR check accepts the corpus
deck path: `node scripts/layout-lab/browser-rebrand-ocr-check.ts <file> <url>`.

The corpus evaluation uses the actual production compiler:

```sh
node scripts/layout-lab/eval-rebrand.ts .scratch/layout-lab/real lolly-start
node scripts/layout-lab/eval-rebrand.ts .scratch/layout-lab/real lolly-start --model
```

Reports and slide content stay under the ignored `.scratch/layout-lab/` folder.
See `scripts/layout-lab/RESULTS.md` for the measured coverage and its limits.
Stage the runtime with `node scripts/copy-transformers-ort.ts` after changing
installed dependencies: the WASM files must match Transformers' installed
transitive ONNX runtime. Reusing files from another version causes local matching
to fall back to structural choices.
