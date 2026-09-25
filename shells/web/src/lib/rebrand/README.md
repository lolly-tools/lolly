# The renovation journey (web shell)

`#/rebrand` turns an uploaded deck into a Design document over a few stages
(ingest, census, plan, review, compile, done). This directory holds the
pieces that make that journey durable across a reload, cancellable, and
bounded on memory. Plan 274 is the source plan; `packages/core/src/rebrand-v1.ts`
carries the shared types (`RenovationProjectV1`, `CompiledDeckV1`,
`CompiledFrameV1`, `DesignBoxRowV1`, `LineageV1`, and the rest).

## project-store.ts

Holds one renovation project on this device while `#/rebrand` works on it;
`lib/jobs.ts` keeps nothing across a reload, which is why this store
exists. Every record goes through `host.state` under `__rebrand__:`: the
project record carries only the pointer to each part (`sourceDeck`,
`census`, `plan`, `compiled`), never the part itself, and `getPart` reads
one on demand. `isRebrandSlot` marks these slots so `lib/batch-slots.ts`
`isHiddenSlot` can hide them from a session list. Source bytes never go in
`host.state`; they go to the user asset store through the injected
`storeUpload`, which the store always calls with `batch: true`, and the ref's
id is recorded on `source.bytesAssetRef`. The `storeUpload` in the store
`rebrandStoreFor` hands out ignores those options: it writes the deck
verbatim as a `data` asset and opens nothing (see user-assets.ts below).

**Revision rule.** Every record carries a `revision`. `update`, `putPart`
and `checkpoint` take the revision the caller read; a mismatch refuses the
write as `stale-revision` rather than overwriting another tab's decision.
A successful write bumps the revision and the stored record is never
mutated, so a refused write costs the caller nothing. Writes for one
project id serialise inside a tab, and each write checks the token it just
stored to catch another tab having saved after us.

**Quota path.** `update`, `putPart` and `checkpoint` return
`{ ok: false, refusal: 'quota' }` on any spelling of a storage quota
error; `create` throws `ProjectQuotaError` carrying the project instead.
Neither is reported as a save: the caller keeps the in-memory value and
offers a `.lolly` download. `create` also refuses an id already on this
device (`ProjectExistsError`), since overwriting would strand the old
parts; `replace: true` removes the old project first.

**Disposable versus protected.** Protected: source bytes, the person's
decisions, the checkpoint, the design-system snapshot: what a reload must
bring back and a `.lolly` download carries out. Disposable: thumbnails,
decoded pixels, preview bitmaps, per-slide render cache: recomputable from
the parts, never held here.

**`remove`** deletes the project and part records, then collects asset
refs to release by scanning known key names (`assetRef`, `fallbackAssetRef`,
`media`, `bytesAssetRef`, `previewAssetRef`) across every stored part, not
by part shape. A catalog asset is never collected. A ref another project
points at, or `deps.referencedElsewhere` reports on, is kept; a throw from
that callback also keeps the bytes, since an unanswered question must
never delete a possible only copy.

## lifecycle.ts

Pure functions over an injected `RenovationProjectStoreV1` and an injected
stage runner: open a project, advance one stage, record one review
decision. No DOM, no clock, no network, no dependency on the worker side.

**Resume rule.** A checkpoint with no `checkpoint.at` has committed
nothing, so its own stage runs next; one with `at` set resumes at the
stage after it, or finishes at `null`. `needsSource` is read from the
stored parts, not the stage name, so a project marked complete without
its source deck stays repairable.

**Advancing a stage.** `advance` writes the stage's part, then the
checkpoint, as two store calls. Outcomes: `advanced`, `cancelled` (nothing
written), `discarded` (the runner answered for another project, stage, or
an older plan revision), `reload` (stale-revision), `held` (quota, work
kept in memory with a download offered), `uncheckpointed` (part written,
checkpoint refused; `markStageComplete` retries just that), `refused`,
`failed`. A stage never runs ahead of the resume point.

**Recording a decision.** `recordDecision` rewrites one object's plan
entry and nothing else, then moves the checkpoint's plan revision forward
once a stage is already checkpointed. The plan's `revision` increments
each time, so a stage result computed before the choice reads as stale.

**The plan transaction.** `commitPlan(store, project, plan)` is what every
controller edit writes through: it checks the stored revision, writes the
plan one revision past both its own and the checkpointed one, then
checkpoints review at that revision. Outcomes: `committed`, `reload`,
`held`, `uncheckpointed`, `refused`.

**Stepping back.** `rewindTo(store, project, stage)` moves the checkpoint
to an earlier stage (compile back to review, say) and keeps the compiled
part and the plan revision. It refuses a forward move, an uncommitted
project and a missing earlier record, and asks for a reload on a stale
handle.

## readiness.ts

Two read-only questions, neither downloading anything: `readinessFor()`
(what a deck is missing: OCR model, layout model, slide master, logo
variants, and what the person can do about it) and `capabilitiesFor()`
(what this surface can do, as `RebrandCapabilitiesV1`). A probe that
throws reads as `unknown`, never `missing`. `host.assets.isAvailable`
answers "available to this project right now," not "the bytes are on the
device." `REBRAND_MAX_SOURCE_BYTES` (100 MiB) and
`REBRAND_MAX_DECODED_PIXELS` (a starting goal, not a measurement) are the
limits `capabilitiesFor` reports. The OCR row's size is
`modelPartInfo("ocr").bytes` (`lib/model-parts.ts`), the download the
in-place offer starts, with the roster's size as the fallback; a part the
offline records call downloaded reads as ready. The row's Download button
calls `ensureModel("ocr", ...)` in place (`lib/model-offer.ts`); nothing sends
the person to Settings.

## stage-core.ts, stages.ts, stage-worker.ts, stage-runner.ts

Split into four files on purpose. `stage-core.ts` holds what both realms
need: the named errors, the stage registry, the worker message protocol,
and the worker-side message loop. It registers no stage of its own.

`stages.ts` is the only file that calls `registerStage` for a real stage;
it registers the four renovation stages from `stage-rebrand.ts` and the
`ECHO_STAGE` the runner's tests call, and a new stage adds one import and
one registration there. `stage-worker.ts`
loads it at the top of the worker realm, and `stage-runner.ts` reaches it
through a dynamic import only for the in-realm fallback. **`stage-runner.ts`
never imports the worker entry.**

`stage-worker.ts` is the worker entry and nothing else; nothing on the
main thread imports it (`stage-runner.ts` only names its URL for the
`Worker` constructor), so a registration on one side never leaks to the
other's module graph.

`stage-runner.ts` runs a registered stage in a shell-owned worker (one
disposable worker per run) or, with no `Worker`, in place with the same
envelope and cancellation rules. Cancellation gives the stage
`CANCEL_GRACE.ms` (200ms) to acknowledge before its worker is terminated;
a worker silent for `REPLY_BUDGET.ms` (120s) is ended as stalled; a
terminal reply for another project or revision fails the run rather than
hanging onto the heavy slot.

**Heavy-slot rule.** A rebrand job holding the shared heavy-work slot must
never await a child job needing the same slot (a deadlock against
`lib/jobs.ts`, which has no timeout). `withHeavySlot` claims the slot once
and hands every `runStage` underneath it a token; a call carrying that
token runs at once. A call made with no token while a slot is held
elsewhere adopts that slot rather than queueing behind it; a call with no
slot held anywhere claims its own. Pinned by `stage-runner.test.ts`.

## budget.ts

Pure decoded-pixel budgets and a resolution ladder. Budgets are keyed by
decoded pixels, not file bytes: forty source slides beside forty proposed
1920x1080 RGBA buffers is roughly 633 MiB. `DECODE_BUDGETS` is a pinned
table of three device classes (`desktop`, `laptop`, `phone`), each a whole
record (`maxDecodedPixels`, `maxCacheBytes`, `thumbnailLongEdge`,
`previewLongEdge`, `ocrConcurrency`, `decodeConcurrency`) rather than a
computed formula; the numbers are starting engineering goals, not
measurements. `classifyDevice` picks a class from device-memory/core/
mobile hints, defaulting to `laptop`; `decodeBudgetFor` falls back to
`laptop` for a name it does not recognise too, so nothing downstream
becomes `NaN`.

**The ladder.** `resolutionLadder(budget, slideCount)` sets aside half the
cache ceiling for two thumbnails per slide and splits the rest across a
six-picture preview working set (selected slide plus one neighbour each
side, source and proposal). Sizes are quantised to a multiple of 16 and
clamped to a floor and the budget's ceiling. `slidesThatFitThumbnails`
and `filmstripMustWindow` say when a deck is too long for a thumbnail per
slide, so the filmstrip must window. Export always renders at the
authored size; only the review surface is budgeted.

## bitmap-cache.ts

A byte-bounded LRU for decoded slide pictures, bounded in bytes rather
than entry count, since a thumbnail and a full preview are worlds apart
in size. It owns release, not decode: eviction, replacement, delete and
clear each call `bitmap.close()` and revoke the object URL once. An entry
over the ceiling, or not finite, is refused (`set()` returns `false`);
whatever was already at that key is untouched.

The key is `(assetRef, longEdge, planRevision?)`. The plan revision is set
only for a proposed picture, so a decision change evicts just the stale
proposals (`deleteStaleRevisions`) and never the source pictures, which
carry no revision. `deleteAsset` releases every entry for one asset ref.
`stats()` tracks a high-water mark for both bytes and entry count.

## stage-rebrand.ts

The four stages the worker runs, registered in `stages.ts` under the names
`RebrandStageNameV1` lists: `rebrand.census` (`censusDeck`), `rebrand.plan`
(`resolveRebrandDesignSystem`, then `firstPass` with the reader the source
names and `CENSUS_RULES`/`PLAN_RULES`, the preset, the previous plan and the
seed passed through), `rebrand.compile` (`compileRenovated`, with
`applyUnreviewed` and `applyNeedsAttention` from the input: both on for the
Proposed pane, both off for Open in Design, which the controller refuses while
`openPendingIds` names a row) and `rebrand.faithful` (`compileFaithful`).
Each is a pure call into the engine over plain JSON, with
`ctx.throwIfCancelled()` between steps. The design system arrives as
`RebrandDesignSystemInputV1` and is resolved on the side that runs the stage,
because the resolved form holds a token resolver that cannot cross a message.
The engine comes in by deep path, so the worker chunk carries these stages and
not the whole engine.

## design-system.ts

The active design system, read once: the slide master (`readMasterAsset`
over `host.assets` with `MASTER_ASSET_TAGS`), the logo asset per background
(`resolveLogos`), the colour tokens (`readColors`) and the brand and mono
faces (`readFonts`, from `font.brand` and `font.mono`). Design's slide-master
menus (`views/free-canvas/slide-masters.ts`) import the same readers, so a
pack answers both surfaces the same way. `resolveActiveDesignSystem` builds
the plain-JSON input the worker takes and the summary the view shows
(archetypes in the master's order, colours, faces, `hasLogo`,
`neutralMaster`). A pack with no master, or one this build cannot read, gets
the engine's `neutralSlideMaster()` with `neutralMaster: true`.
`readActiveDesignSystem` also returns the readiness needs (the master's asset
id, one tag per logo side) from the same pass. Null only when the host has
neither an asset API nor a token API.

## ingest.ts

Stage 1 on the main thread, since it needs `DOMParser` and the user asset
store. `ingestPptx(host, input, deps?)` refuses before storing anything
(`source.too-large`, `source.encrypted`, `source.unreadable`,
`unsupported-file`, each a `RebrandIngestError` carrying `code`), hashes the
bytes, inflates them with the capped fflate path `bridge/pptx.ts` uses,
creates the project with the source bytes retained, and reads the deck with
`sourceDeckFromPptx`. Each distinct picture is stored once through the
picker's `storeUserUpload` with `batch: true` and the `rebrand` source hint,
which the view hands in through `setRebrandPictureUpload` (see
user-assets.ts). A picture the picker would stop to ask about (over 40 MB, or
a long edge past 7680 px, read from the PNG or JPEG header) is written
verbatim instead, since that question is a modal; so is one the picker cannot
take, and a full device fails the deck. Whether a picture is this read's own
is read from the id the picker minted or, for one it converted and renamed,
from the record's provenance (the `rebrand` hint and an import time after the
read began). Progress is per slide, the reader hands the host a turn every
few milliseconds so a cancel takes effect and progress paints, and a cancel rejects
with `IngestCancelledError` (a `StageCancelledError` with `code: 'cancelled'`).
Then the source deck is written as a part, the source facts the read settled
are restated, and `ingest` is checkpointed. A failure or a cancel after the
project exists removes it and releases the pictures this read stored fresh,
except one the store kept, one another read in this tab is using, and one
another stored deck names; a picture the library already held is never
released. A newer version of a deck passes `lineageId`: the project and the
source deck take that lineage instead of their own hash, so the versions of
one deck are listed together and the plan's carry-forward knows where its
decisions came from.

## user-assets.ts

A leaf both `deps.ts` and `ingest.ts` import, so neither imports the other at
module scope: the provenance hint, the verbatim write, the release rule and
`rebrandStoreFor`. lib/ takes no runtime import from views/ (this file names
the picker's host type, a type-only import), so the picker's
`storeUserUpload` arrives from `views/rebrand.ts` at mount through
`setRebrandPictureUpload`. Before that, a host with its own user asset store
writes pictures verbatim. `deps.ts` re-exports every name here. Two rules
live here:

- **One store per host** (`rebrandStoreFor`), so the ingest, the controller
  and the reopen list share one write chain.
- **The deck is stored verbatim as a `data` asset**, not through
  `storeUserUpload`, which sorts an unknown file onto the raster path. The
  store's `storeUpload` ignores the options it is called with. Every asset
  the journey stores carries the provenance hint `rebrand`, and a release
  only ever takes bytes carrying it that no saved session names. A picture
  that matched an upload the person made earlier stays.

## deps.ts

`createRebrandDeps(host, extra)` assembles `RebrandControllerDepsV1` from the
real pieces. The ingest and the `.lolly` writer load by dynamic import, so
the view's chunk carries neither. The store pieces live in user-assets.ts and
are re-exported here. Two rules live here:

- **The stage adapter** (`stageRunnerFor`) names the registered stage, maps
  it to its `ProjectStageV1` (the faithful pass reports as `compile`), takes
  its version from the engine constants, titles the job, unwraps the envelope
  and refuses one for another project, plan revision or stage with
  `StaleReplyError`. The decode budget comes from `classifyDevice` over what
  the device says about itself.
- **A heavy job owns the slot its stages run under.** `runJob` here is
  `runJobOverHeavySlot`: a heavy job claims the slot through `withHeavySlot`,
  so a stage run inside it adopts that slot rather than queueing behind it,
  which with plain `runJob` would never return. Work that finished is
  returned even when a cancel reached the slot after it: a cancel in time is
  the work's own signal check, which throws.

Readiness lists only rows that are not ready (the master, the logo sides).
Text recognition is not asked for yet: no web stage runs it, so the download
would change nothing; `OCR_STAGE_READY` brings the row back with that stage. A picture URL is a Blob
URL over the user asset store, and the release revokes only URLs this module
made. `packProject(project, parts?)` builds the `.lolly` file from the stored
parts, with each part the controller passes (its in-memory copy while the
store holds less) taking the stored one's place. `presets` lists the design
system's presets and the personal ones (`presets.ts`) and writes the
personal layer; `holdOffers` is `holdModelOffers`, so no model download
sheet opens over the read of the deck the person is watching.

## controller-api.ts, controller.ts

The contract between the view and the project, and its implementation. The
controller owns an open project: it reads the deck, runs the stages, writes
every edit as one transaction through the store's revision rule, keeps undo,
and hands a compiled deck to Design. It touches no DOM. `rebrandControllerFor`
keeps one controller per key for the life of the page, so leaving the view
does not stop a running stage.

- A stage part the store refuses for quota switches the project's session to
  memory only: nothing more is written, and the `.lolly` download is packed
  from the parts in memory, as it is while an edit is held.
- Open in Design writes a held plan first; if the device is still full it
  opens Design from memory and writes no checkpoint or compiled part.
- A stored plan made against another token pack or slide master is made
  again on open, with `previous` carrying the object decisions and the
  controller carrying the slides included, their order, a layout the new
  master still offers, a locked colour whose token it still has and a chosen
  face it still lists.
- One preview compile runs at a time; an edit during it asks for one more,
  for the plan current when it starts. A preview is ordered by plan revision
  within one load of the plan, so a reload lets the next one through.
- The pending rule is the engine's `openPendingIds` and Accept all is the
  engine's `acceptSuggestions` with `scope: 'all'` and `includedOnly`, so the
  footer, the refusal and the answer all name the same rows.
- A second Open in Design opens a new Design document beside the first (named
  with its revision, counted in memory too when the store refused to record a
  session) and sets `compileDiff` from the last compile that opened (a compile
  whose handoff failed is no baseline), compared frame by frame so a slide left
  out or moved reads as a move (`compile-diff.ts`). A new project, or the same
  one opened again, starts with no `compileDiff` and no `versions`. The
  three-way merge of edits made in Design is not done.
- `openNewerVersion(file)` reads a new project into the open deck's lineage
  with the open plan as `previous`, and `carryIntoNewerVersion` brings across
  the slides left out, the layouts, locked colours and faces on the slides the
  engine matched; `versions` lists the other stored versions, and
  `lineageQueueItems` adds the objects that changed (to review) and "Carried
  from the last version" (settled, shown as a note) to the queue.
- `applyPreset(id)` runs the first pass again with a preset as one undo step
  that restores the whole plan, and runs it again for the same id once the
  preset was saved anew; `savePreset(name)` writes the personal layer, counting
  only classes whose proposals the person changed (never what Accept all
  wrote); `choosePreset(id)` sets the preset the next read applies.
- `startMany(files)` reads several decks one after another, each under a job
  of its own: the first through the session, so it opens for review, the rest
  into projects of their own in the background (census and plan checkpointed,
  nothing drawn); `batch` lists them. The heavy slot is free between decks, so
  Open in Design waits for one deck at most. No job is started inside another,
  since a nested heavy job would wait for the slot its parent holds. `cancel`
  stops the open deck's step; `cancelBatch` stops the decks not read yet.
- Automatic for a colour runs the solve again for that use; a use the solve
  cannot map takes the nearest design system colour, so the compile never
  falls back to the source colour.

## presets.ts

Renovation presets: the design system's preset files (data assets tagged
`slides` and `rebrand-preset`, the same files the CLI reads) and the personal
layer, kept as user template records on the profile (`toolId: "rebrand"`,
`scope: "look"`, so no template chooser offers one). A pack preset shadows a
personal one with the same id. `presetOf` checks every field the engine reads
and drops a preset that would not validate. `presetFromPlan` turns the
person's own decisions into a preset: a class the person decided one way
every time, a layout per source layout chosen consistently, the fallback and
the logo policy. Publishing a preset into a pack is a design system studio
action, not done here.

## compile-diff.ts

What changed between two compiles of one project: frames added and removed,
source objects whose layers changed (through the lineage), added and removed,
and the colours and fonts the layers use. Compiled values only, never the
Design document, so it is the plan change and not the edits made since. Web
only: the CLI writes one compile per run.

## design-handoff.ts, design-open.ts

`design-handoff.ts` turns a compiled deck into the pages the free-canvas
import lays down as artboards, keeps every layer id (the lineage names
them), records the Design session on the project and keeps the report and
lineage where Design can read them. `design-open.ts` is its browser half:
`designOpener(host)` mints the session slot, goes to `#/tool/design?slot=`,
and lays the pages down once the canvas has mounted. Every layer is named in
words through `t()` (a master slot for its role, a kept object for its class,
furniture for what it is), never by a part path or a master id. The Not
placed artboard carries `notPlaced: true`; Design's only skip mark is
`hidden`, which would also take the objects off the canvas, so it is not set,
and Design's export and presentation still have to learn to read
`notPlaced`.

## keep-design.ts

Mode A, Keep the design: the surgical patch `rebrand-deck` has always made
(`host.pptx.inspect`, then `host.pptx.rebrand`), driven by the renovation's
design system, with a faithful preview of the patched file read back through
the stage 1 adapter.

## open.ts

Opening a renovation `.lolly` on this device: the media go through the
ordinary `.lolly` asset ingest, every asset ref in the record and its parts
is rebased onto the local ids, and only then is the project created. It
never overwrites a project already on the device and never marks a stage
complete over parts that were not written.

## Open follow-ups

- **Group apply as one transaction.** Settled in `controller.ts`: an edit
  runs the engine's `rebrand-edit.ts` function and writes the plan once.
- **Undo for advance.** Settled by `rewindTo` in `lifecycle.ts`.
- **Cross-tab atomicity limits.** The revision rule and write-token check
  are best effort against a second tab, not a lock: two writes racing
  inside the gap between the read and the save can both still believe
  they are ahead of the other.
- **Asset-ref collection gap in `remove`.** Refs are found by known field
  names only. A ref under a different name, or nested where `remove` does
  not walk, would go unreleased and unreported.
