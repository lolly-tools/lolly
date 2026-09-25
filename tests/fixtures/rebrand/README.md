# Rebrand fixtures (plan 274 section 9, plan 275)

Six synthetic files and their labels, built by `scripts/build-rebrand-fixtures.ts`
(`pnpm run build:rebrand-fixtures`) and committed. They are what the rebrand
census, plan, compile and report tests read, so those tests run on every machine
with nothing extra installed.

```bash
pnpm run build:rebrand-fixtures            # rewrite the files in place
node --test "tests/rebrand-fixtures.test.ts"
```

The builder is reproducible on purpose: fixed zip modification time and part
order, stored entries rather than deflated ones, a fixed `now` for the pptx
writer, and seeded picture generation with no font file or canvas anywhere. The
one compressed payload in the set, the pdf's page image streams, goes through the
in-repo `zlibCompress` (`engine/src/deflate.ts`) rather than a dependency's
deflate, so no committed byte can move under a version bump.
`tests/rebrand-fixtures.test.ts` rebuilds every file into a scratch directory and
compares the bytes, so a change to the builder that is not regenerated fails.
Each file stays under 400 KB.

## The files

| File | What it holds |
|---|---|
| `simple.pptx` | Three 16:9 slides on one real layout: a title and a bulleted body placeholder bound to it, a page-number placeholder, the same full-width band near the top of each slide, the deck owner's mark placed once by the **layout** so every slide shows it, and one photo-like picture on slide 2. |
| `adversarial.pptx` | The failures the journey has to survive. See the list below. |
| `palette.pptx` | One hex (`#1F4E79`) as body ink, as the ground of slide 1, as the first chart series and as the `accent1` theme slot; six shapes filled by `schemeClr accent1..6`; a chart with eight series in eight distinct literal colours, which is more than a neutral master has usable swatches. |
| `flattened.pdf` | Three pages, each one full-page image of a rendered slide and nothing else. A hand-written pdf: a library that stamps a creation date or a file id would defeat the rebuild check, and a real text renderer would make the bytes depend on the machine. The page titles are painted with a five by seven bitmap face declared in the builder, and each label carries the title as `text` so a recovery test reads its expectation as data. |
| `formatting.pptx` | Plan 275 section 7: the run and paragraph formatting a renovation carries to Design. Three slides on one content layout whose master body style gives bullets on three levels. See below. |
| `structures.pptx` | Plan 275 section 3: one slide per structure the layout matcher names, each labelled with its library id, the band a correct matcher reaches and its units. See below. |

Each file has a sibling `<name>.labels.json`: the hand-authored ground truth for
every object the builder wrote. Per object it states the id, the authored name,
the origin (`slide`, `layout`, `master`, `pdf-artifact`), the source object kind,
the class from `OBJECT_CLASSES` in `packages/core/src/rebrand-v1.ts`, a `FidelityV1`
record (state, reason, and for a carried fallback its source and asset ref), the
expected box in reference px at 96 dpi (composed through group transforms, so a
group child states the box a correct composition reaches), the group ancestry, and
`mustKeep` for the objects a default plan must not remove. `palette.labels.json`
also lists the colour uses by role, with the theme slot a use named and the
distinction set a series belongs to.

Object ids read `<slide part base name>.<p:cNvPr id>`, for example `slide3.75`;
an object the master or a layout declares reads `slideMaster1.<id>` or
`slideLayout1.<id>`. The pdf uses `page<N>.Im0` and says so in its own
`objectIdForm`. Ids are stable as long as the builder is not reordered, and the
test checks that every object a package addresses has a label and that no label
names an object no package holds.

The labels of `formatting.pptx` and `structures.pptx` add fields; every one is
optional, so an older label still reads and an older reader of labels ignores
them. The builder exports their types (`ObjectLabel275`, `ParaLabel275`,
`SlideLabel275`, `StructureLabel275`, `FixtureLabels275`), because
`tests/helpers/rebrand-fixtures.ts` states the plan 274 shape and lists the plan
274 files only (`SYNTHETIC_FIXTURES`); the builder's `PLAN_275_FIXTURES` lists
the two new ones.

- `objects[].paras` (formatting.pptx, on every title and body): each paragraph as
  a correct reading returns it, in the contract's own shape (`SourceParaV1`, its
  runs `SourceRunV1`, colours as `#RRGGBB`), plus two fields of the label's own:
  `bulletSource` (`slide`, `layout` or `master`, the part the marker or its
  explicit absence comes from after the cascade) and `number` (the ordinal a
  numbered paragraph draws). `lvl` is stated only above level 0. A run names
  `font` only where the slide states a face literally; the theme face every
  other run inherits through `+mj-lt` or `+mn-lt` is left out.
- `objects[].role` (structures.pptx): the part an object plays in its slide's
  structure, one of `ARCHETYPE_ROLES` or `container` for a card panel.
- `slides[].structure` (structures.pptx): `id` (the layout library id, one of the
  first slice), `read` (the matcher rule that names it, such as `stack-4` or
  `image-row-3`), `band` (`LayoutMatchV1.band`: `clear`, `likely` or `none`),
  `units` (each unit as its member object ids, in reading order) and `evidence`
  (why, in plain words). Every object but the title and the page number belongs
  to exactly one unit and carries a role.

**Group ancestry is stated the way the reader reports it.** `groupPath` holds each
ancestor group's `p:cNvPr` id (`["70"]`), which is the identifier space `readPptx`
emits; `groupNames` carries the readable name (`["group-phase"]`) beside it, so an
assertion can compare directly and still read plainly when it fails.

## What adversarial.pptx carries

- A "Confidential" text box on the **slide master**, so it is on every slide and
  in no slide part. The engine reader returns it in `slide.inherited`.
- A partner mark, the same bytes, pasted on all three slides. It is the control
  for `simple.pptx`'s owner mark: same class, same size, same corner, same bytes
  repeated, and the opposite `mustKeep` answer. The only fact that separates them
  is structural, and it is in the files: a template places the owner's mark (the
  layout), a person pastes the partner's (the slides).
- A citation footer that repeats with the year changed (2021, 2022, 2023), so a
  digit-normalised repeat rule cannot read it as furniture to drop.
- A chart legend key repeated on two slides.
- A unit note at seven point, at the same box on all three slides. The decoration
  rule fires on repetition AND small text together, so a line that is only small
  never reaches it; this one meets every clause and must still survive.
- A `p:grpSp` whose child extent is twice its extent: both children are authored
  at full size and the labels state the halved composed box.
- Two native charts, kept apart because their fidelity answers differ:
  - `chart-no-fallback` (`ppt/charts/chart1.xml`) has no picture anywhere in the
    file. Nothing in this path draws a native chart, so it is `unavailable` with
    reason `native-chart-no-fallback` and reaches Design as a labelled placeholder,
    never as a picture of the source.
  - `chart-with-fallback` (`ppt/charts/chart2.xml`) is wrapped in
    `mc:AlternateContent` whose `mc:Fallback` is a real `p:pic`. It is
    `raster-preserved` with `fallbackSource: "embedded"` and a `fallbackAssetRef`
    naming the media part, and it carries no fidelity reason at all, because
    nothing about it is missing.

  **Fidelity says what can be SHOWN, never what data survives.** Both chart parts
  state complete caches, and the reader hands back categories, series names, values
  and the literal series colours for each. Those travel on the source object's own
  `chartData`, which `SourceObjectV1` keeps apart from `fidelity`, so `unavailable`
  is never licence to discard them - it is what gates the opt-in Chart rebuild
  offer in plan 274 section 8. `tests/rebrand-fixtures.test.ts` pins the numbers
  coming back, so the two facts cannot drift apart.
- A body text with more words than its box holds at eighteen point.
- A long URL in a run carrying `a:hlinkClick` to an external target.
- A native `a:tbl` table.
- A right-to-left Arabic paragraph and a Japanese paragraph.

## What formatting.pptx carries

The source is `scripts/build-rebrand-fixtures.ts`, which writes this file byte for
byte. It follows a sketch kept in the maintainer's local plans folder
(`plans/275-rebrand-ux-evidence/formatting-fixture.pptx`, `simple.pptx` with two text
bodies rewritten), which a clone does not carry and does not need. The master's body style states a bullet glyph and
a hanging indent on levels one to three, which is how real templates supply
bullets. The writer has no model for `baseline`, `cap` or an external link, so
the title and body shapes are authored by the builder in the writer's own shape
form.

- Slide 1: a body whose two paragraphs have no `a:pPr` at all. Their bullets come
  only from the master body style, so a reader has to resolve them through the
  cascade rather than read them off the slide.
- Slide 2, the specification: a centred title of seven runs (plain, bold,
  italic, underline, strike, red `#C00000`, and a 20 point run in a 36 point
  line); a body holding a bullet with a bold run inside (150% line spacing, 12
  points before), a nested level-1 bullet with its own glyph, two auto-numbered
  items, a right-aligned `buNone` line with superscript, subscript and an all-caps
  run, and a justified `buNone` line with an external link to
  `https://lolly.tools/` and a literal Georgia face.
- Slide 3, what plan 275 WP3 asserts beyond that: two bold lead-ins, a second and
  a third level whose glyphs and indents all come from the master, an italic
  citation whose explicit `a:buNone` stops the inherited bullet but keeps the
  indent, and a two-item numbered list.

`tests/rebrand-fixtures.test.ts` checks the labelled paragraphs against what
`readPptx` returns today (paragraph and run text, level, bold, italic,
underline, size, link and literal face) and pins the rest (strike, baseline,
case, bullets, alignment, spacing) in the package XML until the reader resolves
them.

## What structures.pptx carries

Eight slides on one layout named `Headline` that holds a title and a page number
only, because a layout name is a prior for the matcher, never its answer. The
geometry is placed by hand and is a little uneven where a rule has a tolerance,
so "about the same width" is tested rather than "exactly the same width".

| Slide | Structure | Read | Band | What is on it |
|---|---|---|---|---|
| 1 | `columns-3` | `columns-3` | clear | Three columns, each a heading box over a paragraph box, widths and tops a few per cent apart |
| 2 | `columns-4` | `columns-4` | clear | Four filled card panels, each holding one text box of a label and a line; the panel is a container even when a plan removes it as decoration |
| 3 | `grid-2x2` | `grid-2x2` | clear | Four text boxes in two rows of two |
| 4 | `stats-3` | `stats-3` | clear | Three figures at 54 points, a caption under each |
| 5 | `images-3` | `image-row-3` | clear | Three pictures side by side, each its own seeded bytes so the census never reads them as one repeated mark |
| 6 | `table` | `table` | clear | Twenty text boxes in five rows and four columns whose left edges line up exactly and whose widths differ, so the cells do not also read as a grid of equal boxes |
| 7 | `text-and-image` | `text-and-image` | likely | A full-width body with a picture laid over its right half; the overlap costs the read its apply band |
| 8 | `numbered-rows` | `stack-4` | clear | The MEDDPICC slide 3 case: four rows, each a one-letter label box beside a longer line, far enough apart that the letters do not merge; the letters are `mustKeep` |

Run through the plan 275 prototype (`plans/275-rebrand-ux-evidence/layout-detect.ts`)
on 2026-09-24, every slide read as its `read` above, the seven clear slides at
0.84 or over with full coverage and slide 7 at 0.6. The prototype reached slide 8
only because the census proposed the four letters for removal; with the letters
kept it read `text`, which is the failure plan 275 section 3.2's labelled-stack
rule exists to fix.

## What a correct reading produces

The reader in this tree composes group child offsets (`chOff`/`chExt`) and walks
`mc:AlternateContent`, so the labels state the answer and the two are compared
rather than described. `tests/rebrand-fixtures.test.ts` reads every pptx fixture
with `readPptx` and checks each labelled object's `boxPx` and `groupPath` against
the node the reader returns, in document order.

An `mc:AlternateContent` pair surfaces as **one** object: the choice half's node
carries `fallbackMedia` naming the fallback picture's part. Both halves keep a
label, so the id cross-check balances and the pairing is legible through
`pairedWith`, but only the choice half carries `mustKeep`. Content accounting runs
over `mustKeep`, and listing the fallback half there would ask a correct
implementation to account for an object no correct reading ever produces.

## Coverage this corpus does not have yet

Stated so a later package does not read silence as coverage:

- `structures.pptx` has no slide in the `none` band, no structure the master lacks,
  no `columns-N` with connector marks between the columns, no `timeline` rule and
  no flattened page. `formatting.pptx` has no numbering restart after an
  interruption, no `startAt`, no small caps and no underline style other than a
  single line.

- Of the ten `FIDELITY_REASONS`, one appears here: `native-chart-no-fallback`.
  Nothing exercises `cap-reached`, `media-too-large`, `media-missing`,
  `unsupported-media-format`, `smartart-no-fallback`, `ole-no-fallback`,
  `reader-approximation`, `geometry-approximation` or `ocr-estimate`.
- No object here is unavailable because there was nothing to recover: every
  `unavailable` chart in the corpus has complete caches, and the "no plot the
  reader models, no cached point" case has no fixture. Adding one is a third chart
  part plus a count update in `tests/pptx-read-274.test.ts` and
  `tests/rebrand-fidelity-spike.test.ts`, which both assert the current counts.
- The OCR recoverability of the five by seven bitmap face in `flattened.pdf` has
  not been measured. Plan 274 section 9 asks for recovered titles to match by
  trigram containment above 0.9; until one pass over a rendered page records a
  number here, the flattened fixture is a shape to test against, not evidence that
  the bar is reachable.

## The private corpus

The maintainer's own decks never enter this repository. A test reaches them
through `privateCorpus()` in `tests/helpers/rebrand-fixtures.ts`, which reads
`LOLLY_REBRAND_FIXTURES` (a directory such as `~/Desktop/examples`, with its
`slides-to-test/` subdirectory) and returns null when it is unset or absent. A
test that needs them skips by name with `skipReason()`, its skip identity is in
`tests/expected-skips.json`, and a skipped private-corpus test counts as
unexercised coverage rather than a pass.

`samples/` beside this file is not built here: it belongs to the rebrand contract
schemas.
