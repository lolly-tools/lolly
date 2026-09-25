# Rebrand: renovate an old deck

Rebrand turns a `.pptx` someone else made into the active design system's own:
its colours, fonts, logo and layout, with decoration and page furniture pulled
out. It never touches the source deck. The whole pipeline is one TypeScript
contract (`packages/core/src/rebrand-v1.ts`), mirrored to six JSON schemas
under `schemas/rebrand-*-v1.schema.json`, and one set of stages, so a plan
made on one surface compiles on any other, as long as both read the same
content profile (`LOLLY_PROFILE`).

## Plans are edited, not regenerated

**A plan is edited, never regenerated, between passes.** The first pass
(census plus rules) proposes; a person, a preset or an agent decides; a
proposal and a decision are two separate fields on every object row
(`proposal`/`proposalReplacement` versus `decision`/`decisionReplacement`), so
"what the machine suggested" is never overwritten by "what someone chose" -
the effective action is `decision ?? proposal`. Compile always takes the plan
that was handed to it. There is no step that reruns the first pass over an
edited plan and no step that discards a decision because the source read
differently the second time.

A plan carries the source's `sha256:` hash and its own revision counter.
Compiling a plan against different bytes is refused with `plan.hash-mismatch`,
not silently reconciled.

## Three stages, plus inspect

| Stage | Reads | Writes |
|---|---|---|
| `plan` | the `.pptx` | the source facts, the census, the first-pass plan and its report |
| `compile` | the plan plus the same `.pptx` | a Design document (`.lolly`), a native `.pptx` with `export: pptx`, and the report |
| `inspect` | a plan, optionally the deck (the CLI requires `--source=<deck.pptx>` with a plan file; MCP accepts a plan alone) | a summary, the review queue, per-slide states, or one slide's objects, paged |
| `capabilities` (MCP only) | nothing | what this server can do and where the file goes |

Under the hood `plan` and `compile` are `readDeck`, `planDeck`, `compileDeck`,
`outcomeOf`/`outcomeCounts` and `checkPlanFits` from
`@lolly-tools/node-shell/rebrand` - functions shared by the CLI and the MCP
server. The web shell shares only the source reader
(`sourceDeckFromPptx`, from `@lolly-tools/node-shell/rebrand/source-pptx`) and
the engine modules; it does not call the pipeline functions above.
`resolveProfileDesignSystem` resolves the active content profile's slide
master, palette and fonts once; a profile with no slide master renovates
against a neutral master and says so in the design-system facts
(`designSystem.neutralMaster`).

## The object classes and their evidence

Every source object gets a class hypothesis from `engine/src/deck-census.ts`,
one of (`packages/core/src/rebrand-v1.ts`, `OBJECT_CLASSES`):

```
template-furniture  decoration       logo-candidate   known-logo
recurring-text       page-number      footer           date
title                subtitle         body
chart                screenshot       photo            table          diagram
unknown
```

The hypothesis carries `evidence`: an array of `{signal, value, weight, sentence}`
rows, one per signal that fed the call (`origin`, `repeat-count`,
`area-share`, `dhash-group`, `native-tag`, `ocr-density`, and the rest of
`EVIDENCE_SIGNALS`). `sentence` is the one plain sentence a review surface
shows, with the numbers already in it - never show a raw signal name or a bare
weight to a person. An object repeated across slides (the same logo, the same
page number) is verified into an `ObjectGroupV1` before anything acts on the
group, so a false match by hash alone never becomes a bulk decision.

## Reading a plan

A `RenovationPlanV1` (`schemas/rebrand-plan-v1.schema.json`) is slides of
object rows plus the colour, font and logo mappings and a `decisions` list
(the carry-forward memory, keyed by object fingerprint and slide lineage, not
by id, so a revised deck matches what it can). Per object row
(`ObjectPlanV1`):

- `proposal` / `proposalReplacement` - what the first pass or a preset said:
  one of `keep`, `replace`, `remove` (`PLAN_ACTIONS`), with a `ReplacementV1`
  when it is `replace` (`brand-logo`, `placeholder`, `asset`, `supplied-picture`,
  `tool`, or `filter`).
- `decision` / `decisionReplacement` - what a person or an agent chose. Unset
  until something decides it.
- `review` - `unreviewed`, `accepted` or `needs-attention` (`REVIEW_STATES`).
- `author` - `rule`, `preset`, `user` or `agent` (`DECISION_AUTHORS`).
- `scope` - the named group the decision went through ("this object" leaves it
  unset; a group apply stamps the group id on every row it touched, and on the
  matching decision-memory rows).
- `locked` - never touched by a group apply or `acceptSuggestions`, only by a
  decision naming that object alone.
- `role` / `surplus` - which archetype slot a kept object fills, or where it
  goes when it fits none (`continuation` or the `tray`).

`reviewQueue(plan, census, source)` (`engine/src/rebrand-review.ts`) groups
these into the queue a review surface shows: `{code, params, text}` titles
built from one `REVIEW_MESSAGES` table, so every title comes from one message
table and can be translated in one place, each with its evidence sentence and
affected slide numbers. `planSummary(plan,
source, census)` is the always-visible counts line: slides included, objects
by action, review states, colours assigned versus unresolved, fonts
substituted.

## Editing a plan

`engine/src/rebrand-edit.ts` is the one set of pure edit operations every
surface calls, so a group apply means the same thing everywhere:

- `decideObjects(plan, {objectIds, action, replacement?, scope?,
  includeCorrected?, source?})` - Keep, Replace or Remove over one object or a
  verified group. A locked row is skipped; a row a person already decided
  differently is skipped unless `includeCorrected` (a single-object apply and
  "include corrected" on a group both set it; a plain group apply leaves
  corrections alone). Passing `scope` (the group id, or nothing for "this
  object only") writes it on every touched row and on the decision-memory
  entries it wrote.
- `acceptSuggestions(plan, {scope, author, source?})` - turns proposals into
  decisions. `scope: 'unreviewed'` is "Accept all suggestions" (the web
  control and the CLI's bare `--accept-suggestions`); `scope: 'all'` also
  answers rows that need attention (`--accept-suggestions=all`, and what a
  preset's first pass runs through). A row already decided, or locked, is
  left alone.
- `autoMatchLayouts(plan, source, census, {bands, slideIds?, master})` - sets
  each slide's layout from the structure it reads as (`bands`: `clear`,
  `likely` for clear and likely reads, or `all`). It never changes a slide
  whose layout a person or a preset set, a slide left out, or a slide whose
  rows are all locked; a structure the master lacks falls to its nearest
  layout. This is the web's "Auto-match layouts" and the CLI's
  `--auto-match[=clear|likely|all]` (a bare flag means `all`).
- `setSlidesIncluded`, `setSlidesLayout`, `moveSlide`, `setColorTarget`,
  `setFontTarget` - the other plan edits (include/exclude a
  slide, pick a different archetype, remap a colour or font).

Every edit returns `{plan, touched, skipped}` and never bumps
`plan.revision` itself - the caller that commits the result does that once
per transaction, so a 24-row group apply is one revision, not 24. Undo is
capture-then-restore: capture the touched rows (or slides, or colour/font
targets - the module doc says which) from the plan *before* the edit, and
restore puts them back; because every edit is pure, restoring after an edit
and re-running the same edit reproduces it.

## Outcomes and exit codes

Every deck ends in one of `FILE_OUTCOMES`: `ready`, `needs-review` or
`failed`. `needs-review` is not a success - it means the compile produced a
document but rows are still `unreviewed` or `needs-attention`, or the design
carries unresolved colours/fonts/objects. A failed deck carries a stable
code from `REBRAND_ERROR_CODES` (`source.unreadable`, `plan.hash-mismatch`,
`design-system.master-missing`, `compile.unresolved-objects`, …), plus the
CLI's own additions for filesystem concerns (`source.missing`,
`output.exists`, `output.unwritable`) and the MCP tool's own
(`request.invalid`, `design-system.missing`, `output.too-large`). `internal`
means a bug in Lolly, on both surfaces.

On the CLI the run exits with the most severe file's code:

```
source.missing, source.unsupported, plan.missing, plan.invalid          exit 2
source.unreadable, source.encrypted, source.too-large, export.failed,
output.unwritable, ocr.unavailable, storage.quota,
compile.unresolved-objects, design-system.master-missing,
design-system.logo-missing, design-system.unreadable                    exit 1
plan.hash-mismatch, plan.revision-stale,
plan.design-system-mismatch, output.exists                              exit 4
```

When every deck compiled and at least one needs review, `compile` exits `5`
(a legitimate answer, just not the one that was asked for) with `ok: false`
and the full result in the envelope. Without `--keep-going` the run stops at
the first failed deck; with it, a failure is recorded and the run goes on. A
failed deck is never counted as a success.

## CLI

```
lolly rebrand plan <deck.pptx|dir>…      read, census and first-pass a deck
lolly rebrand compile <deck.pptx|dir>…   compile a plan (or a fresh first
                                          pass without one) into a Design
                                          document, and --export=pptx for a
                                          native .pptx too
lolly rebrand inspect <plan.json|deck.pptx>
lolly rebrand presets                    list the renovation presets that
                                          resolve for the active profile
```

`plan` and `compile` share `--preset=<id|file.json>`, `--dry-run`, `--force`
(replace an existing output; never the source deck, even under `--force`),
`--keep-going`, `--recursive` (a folder's subfolders too), `--jobs=<n>`
(worker threads, at most 8 and at most the machine's core count),
`--resume` and `--offline` (accepted and changes nothing, because there is
nothing to refuse). `plan` alone takes `--plan-out=` (a directory is
required once several decks are involved). `compile` alone takes `--plan=`
(compile against an existing plan), `--out-dir=` (a directory is required
once several decks are involved), `--accept-suggestions[=all]` and
`--export=pptx`. Both take `--auto-match[=clear|likely|all]`, and each file
in the `--json` envelope then counts the slides it set as `autoMatched`
(`clear`, `likely`, `none`, `total`), one per `layout.auto-matched` report entry. Passing a compile-only flag to `plan`, or a plan-only flag
to `compile`, is a usage error. Every stage reads the active content
profile's design system and touches no network.

A folder or a multi-deck run keeps `.lolly-rebrand-run.json` beside the
outputs (`@lolly-tools/node-shell/rebrand-run-manifest`): one entry per deck
with its content hash, outcome, and last completed stage. `--resume` reruns
only decks that are pending, changed since the last run, failed with a
retryable code, or finished for the other stage (`plan` versus `compile`); a
finished deck with unchanged bytes is skipped and reported as such. An
existing output file is refused (`output.exists`) unless `--force`, except
that `--resume` may replace a file the run record already lists as that
deck's own output.

Worked example, against the repository's own fixture, from a scratch
directory:

```
$ cp tests/fixtures/rebrand/simple.pptx .
$ lolly rebrand plan simple.pptx --plan-out=plan.json
simple.pptx: needs-review; 3 of 3 slides; keep 7, replace 3, remove 6; 4 need attention, 12 unreviewed, 6 in the tray
  wrote plan.json, plan.report.json
  6 kept object(s) fit no slide and are not on the canvas; the report names them.
1 deck: 0 ready, 1 needs review, 0 failed; 0 skipped by --resume; 0 not attempted.

$ lolly rebrand compile simple.pptx --plan=plan.json --export=pptx
simple.pptx: needs-review; 3 of 3 slides; keep 7, replace 3, remove 6; 4 need attention, 12 unreviewed, 6 in the tray
  wrote simple.lolly, simple.report.json, simple.rebranded.pptx
  6 kept object(s) fit no slide and are not on the canvas; the report names them.
1 deck: 0 ready, 1 needs review, 0 failed; 0 skipped by --resume; 0 not attempted.
$ echo $?
5

$ lolly rebrand inspect plan.json --source=simple.pptx
simple.pptx: 3 of 3 slides included
  objects: keep 7, replace 3, remove 6, unresolved 0
  review: 4 need attention, 12 unreviewed, 0 accepted
  colours: 9 assigned, 0 unresolved, 0 locked; fonts: 1 substituted
...
```

An agent edits `plan.json` directly between the two calls (drop a slide, keep
a photo, remap a colour use to a design-system token) - the schema at
`schemas/rebrand-plan-v1.schema.json` is the contract to read and write
against, never the class or evidence tables above by inference.

## Renovation presets

A preset is a design system's or a person's own default decisions -
"always remove decoration, keep every photo for a person to look at, prefer
the content layout on a tie." `--preset=<id|file.json>` resolves an id from
the active profile's `data` assets tagged `slides` and `rebrand-preset`
first, then from a personal `rebrand-presets.json` in the state directory
(`@lolly-tools/node-shell/rebrand`, `resolvePreset`/`listPresets`). When both
carry the same id, the design system's preset wins and the personal one is
listed as shadowed. `lolly rebrand presets [--json]` lists what resolves. An
id that resolves to nothing, a preset that fails its field checks, or a file
that cannot be read are usage errors (`PRESET_UNKNOWN`, `PRESET_INVALID`,
`PRESET_UNREADABLE`), never a silent fallback to no preset. A preset is
recorded on both the plan and the design-system snapshot it was resolved
against.

## Folder and bulk runs

`scripts/renovate-decks.ts` is the bulk driver over the same exported
`runRebrand`: a progress line with an ETA, one report line per deck, a
summary, `--report=<file>`/`--json`. Its defaults differ from the CLI's own:
`--resume` and `--keep-going` are on by default (`--fresh` turns resume off),
and `--jobs` defaults to half the machine's cores.

## MCP: `lolly_rebrand`

One tool, four stages in its `stage` argument: `capabilities`, `plan`,
`compile`, `inspect`. It runs the identical node pipeline the CLI runs, so a
plan the CLI wrote compiles here and a plan this tool returns compiles on the
CLI, as long as both read the same content profile.

- **`{stage: 'capabilities'}`** - what this server can do and, always,
  **where the file goes**. `ocr` is `false` on every server (this pipeline
  reads no text from pictures). A local server (stdio, or an HTTP server on a
  developer machine) reports `bytes: 'local-process'` and a `transfer`
  sentence saying the file stays on the machine. A hosted server (Vercel,
  `LOLLY_MCP_HOSTED=1`, `NODE_ENV=production`, or a `LOLLY_MCP_PUBLIC_ORIGIN`
  that is not a loopback address) reports `bytes: 'configured-server'` and a
  `transfer` sentence saying calling the tool sends the file there,
  processed in memory for that call only, with its byte and slide limits
  named; on Vercel it also states the platform's request-body limit, since a
  file over roughly three-quarters of it cannot reach the server as base64.
  `maxSlides` is lower on a hosted server (200) than a local one (2000).
- **`{stage: 'plan', file: {base64, name}, preset?, seed?}`** - returns the
  source facts, the design system, the outcome, the plan summary, the first
  50 review-queue items and the plan itself. A plan at or under 128 KiB
  travels inside the structured result; a larger one comes back as an
  embedded JSON resource (the way `lolly_transform` returns file bytes),
  named in `planDelivery`.
- **`{stage: 'compile', file, plan, acceptSuggestions?, export?}`** - refuses
  a plan made from different bytes with `plan.hash-mismatch` before it reads
  the deck. Returns the Design document (`.lolly`), a native `.pptx` when
  `export: 'pptx'`, and the report; when `acceptSuggestions` answers rows, the
  answered plan comes back too, under the plan's next revision.
- **`{stage: 'inspect', plan, file?, slide?, page?, limit?}`** - pages through
  the queue and the slides, or one slide's objects with class, action,
  review, fidelity and evidence. Without `file`, fidelity reads `null` and a
  note says why.

Every result, including an error, carries `structuredContent` that validates
against the tool's own `outputSchema` - one variant per stage, plus an error
variant with `error: {code, message}`. Read `structuredContent`, not the text
block; the text block is the same JSON for a client that does not look at
structured content.

## The renovation project and Design

Outside these three surfaces, a renovation is also a `.lolly` project
(`shells/web/src/lib/rebrand/`): the source bytes as a user asset, decisions
in short transactions, checkpoints per stage, save/download at any point.
"Open in Design" compiles the accepted plan into artboards, one per kept
slide, with brand furniture in place and every layer traceable to its source
object; an unresolved object becomes a labelled stand-in layer the report
names, never a silently dropped one. `rebrand-deck` (the older, single-shot
"snap colours and fonts" utility) is deprecated in favour of the `#/rebrand`
view and stays only for a compatibility redirect.
