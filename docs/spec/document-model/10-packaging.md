# Packaging, identity and migration

> This chapter is a draft for review, dated 2026-09-24.  

This chapter specifies how a document is serialised, how a package carries parts its reader does not understand, how identity holds across a version change and how a migration is written. It restates plan section 13 with the review correction C7, plus the two packaging findings F10 and F11.

The records themselves are named in [records and identity](records.html). The rows inside an instance are in [source rows, payloads and patches](source-and-patches.html). The four gates a reader applies are in [capabilities, trust and extensions](extensions.html), and this chapter does not repeat them.

## Two serialised forms

The model keeps two serialised forms and neither replaces the other.

| | `.lolly.json` | `.lolly` |
|---|---|---|
| Status | Proposed. No such file is written today | Built (`shells/web/src/lib/lolly-pack.ts`, `packages/node-shell/src/lolly-file.ts`) |
| Purpose | The plain source form, preferred for diff and review | The container for a document and its packaged dependencies |
| Carries | The records, each with its own `schemaVersion` | The same records as parts, plus the assets, fonts and tools they need |
| Gates | The record versions | `minReader` over the whole container, plus the record versions |
| Integrity | Whatever the transport provides | The SRI map over every payload part |

Both forms must carry a `schemaVersion` per record (R11). The container must keep `minReader` and the integrity map it has today (R11). A plain source form for review is a proposal in this wave, and nothing is added to `packages/core` or `schemas/` here.

## Parts under the integrity map

Extension content and opaque imports must travel as parts under the integrity map, and never as manifest keys (R10, F11).

The reason is in the writer. `buildLollyFile` in `shells/web/src/lib/lolly-pack.ts` constructs the manifest from typed input on every save, so a manifest member the writer does not know is dropped at the next save. A part named in the integrity map travels inside the file and is verified on read. Carrying it across the next save is what the retained package state below has to add, because the writer builds its zip entries from typed input too and `buildIntegrity` runs over exactly that set (`shells/web/src/lib/lolly-pack.ts`). Four payload parts already travel this way: `design-system.json`, `templates.json`, `CREDITS.txt` and `renovation/*.json`.

- A part must occupy one declared path (`shells/web/src/lib/lolly-pack.ts`).
- A reader must compare the manifest's declared path against the single path the writer would have used (`shells/web/src/lib/lolly-pack.ts`, `renovationPartPath`).
- Every retained part must be listed in the integrity map (C7). `verifyIntegrity` in `shells/web/src/lib/bundle.ts` iterates the map rather than the archive, so a part present in the zip but absent from the map is never checked.
- A reader must refuse a part that the map does not cover. The tool bundle already does this: a `tool/` path with no integrity entry, or a `tool/` path the inventory does not name, fails the read (`shells/web/src/lib/lolly-pack.ts`).
- The map is built over the payload parts before the manifest and the README are added, so it covers the payload and never itself (`shells/web/src/lib/lolly-pack.ts`).
- Integrity must be a gate rather than a report. A file whose parts do not match its map must be refused, not passed on with a warning (`packages/node-shell/src/lolly-file.ts`). The gate is as wide as the map and no wider. Both readers return early when a manifest carries no `integrity` at all, so that a file written before the map existed still opens (`verifyParts` in `packages/node-shell/src/lolly-file.ts`, `verifyIntegrity` in `shells/web/src/lib/bundle.ts`). Only the tool, project and renovation payloads refuse a missing map. The model has to choose between two answers and say which. It can refuse a map-less container once preservation-capable writers ship, or it can keep reading one and record the read as unverified.

## The retained package state

Preserving unknown fields at parse time is not a round trip (C7). `LollyFileContents.files` hands the caller every parsed part, while the builder takes typed input and rebuilds the manifest from it (`shells/web/src/lib/lolly-pack.ts`). Nothing joins the read to the next write.

A retained package state must join them (C7). It is a proposal in this wave. The [proof cases](proof-cases.html) carry its evidence as the preservation round trip: import a future optional extension, save, restart, make an unrelated permitted edit, export and compare the opaque bytes.

- The retained state must survive import, local persistence, restart, edit and save (C7).
- It must record which parts are known and which are opaque (C7).
- It must record who owns each part, so two readers cannot both claim one path (C7).
- Two owners must never hold one path (C7). A second claim on a path must be refused when the package is read, and both claimants must be recorded in the retained state rather than one silently winning. The tool inventory already refuses a repeated declared path, and the renovation reader refuses a part at a path the writer would not have used (`shells/web/src/lib/lolly-pack.ts`, `readLollyFile` and `renovationShapeProblem`).
- It must state what the integrity map covers for this package (C7).
- It must state when an unreferenced opaque part is collected (C7).

draft shape

```text
    RetainedPackageStateV1
      parts[]         { path, owner: reader | extension | opaque, integrity, seenAtRevision }
      manifestExtras  the manifest members this reader did not interpret, kept verbatim
      collisions[]    { path, claimant, resolution } for a path claimed twice
      released[]      { path, revision } for each opaque part collected, and when
```

An opaque part may be collected only when no retained record references it and the release is recorded (C7). A host must never treat its own inability to read a part as grounds for collecting it (R10). [Capabilities, trust and extensions](extensions.html) states what else a host owes an extension it lacks.

## Envelope fields: recomputed and carried verbatim

The writer recomputes part of the manifest on every save. A reader must never treat a recomputed field as carried content (C7).

| Envelope field | On every save | Why |
|---|---|---|
| `counts` | Recomputed | Derived from the assets this save actually wrote |
| `exportedAt` | Recomputed | The wall clock of this save, one of the four clocks named in [values and time](values-and-time.html) |
| `integrity` | Recomputed | Built over the payload parts of this save |
| `app` | Recomputed | The application that wrote this save |
| `engineVersion`, `fonts` | Supplied fresh by the writing app | They describe this save's engine and the faces this render resolved, the way `app` does |
| `format`, `formatVersion`, `minReader` | Recomputed | The writer sets the gate from the kind and the parts present |
| Everything else | Carried verbatim | The writer did not compute it, so the sender's value is the only copy (C7) |

Everything the table does not name must be carried verbatim through the retained package state, and not only through the parsed object (C7). That includes the members a reader did not interpret.

`assets` is the mixed case and needs its own rule. Each row keeps the sender's identity, and a row that carries bytes takes its `checksum` from the integrity map of this save. A by-reference row has no path and no checksum to take (`shells/web/src/lib/lolly-pack.ts`). A row must keep its `kind`, its id and its source across a save, and where it carries bytes the checksum must be recomputed with the map (C7).

## Revision-scoped receipts

A receipt, a signature or an acceptance must describe exactly the revision it was made against (C7). When that revision changes, the record must stay as history, and it must never describe the new revision as previously accepted (C7). What a revision covers is in [source rows, payloads and patches](source-and-patches.html), and the receipt itself is in [evaluation and receipts](evaluation.html).

The container already carries evaluation facts beside the payload: `engineVersion`, `app`, `exportedAt` and the fonts by sha256 (`shells/web/src/lib/lolly-pack.ts`). All four describe the save that wrote them, because the writer takes each one from this save rather than from the file it read. A retained receipt must never be re-dated the same way. A save that carries a receipt forward must carry it as a record of an earlier revision (C7).

A font digest is taken over the whole source font file and never over the subset an export embedded (`packages/node-shell/src/lolly-file.ts`). A receipt that identifies a font by digest therefore points at the file a reader could fetch again.

## Migration as a versioned transform

Every migration must be a versioned transform that returns findings, and no import may rewrite content invisibly (R11). The findings half has no working precedent in this tree, which the paragraph below states. The version rules are OpenTimelineIO's, adopted as written (R11).

- Each record must carry its own `schemaVersion` (R11). The shipped stamps already play that role under another name: the session record's `formatVersion` (`engine/src/session-record.ts`) and the container's `formatVersion` (`shells/web/src/lib/lolly-pack.ts`). `schemaVersion` is the model's name for that role, not a second field beside them, and no record gains a version stamp in this wave.
- A reader must upgrade on read (R11).
- A writer may downgrade on write, and the downgrade path must have no gaps (R11).
- A field added with a correct default needs no migration function (R11).
- A container must carry `minReader`, and a definition must carry `engineVersion` (R11).

`migrateSessionRecord` in `engine/src/session-record.ts` is the working precedent for the read side. The record layout is at format 4. A record with no `formatVersion` is treated as version 0. The four steps so far are additive, so each is a no-op on the data, and the branch exists for the first step that is not. A record written by a newer application is read as it stands and reported, rather than discarded, because losing a saved session is worse than reading it optimistically.

Two limits of that precedent are stated rather than hidden. It is a read-side migration only, so the optional downgrade path R11 allows has no implementation yet. It returns no findings, so an import cannot yet report what a migration changed (plan section 13).

## Old-client gates before new parts

A preservation-capable reader and writer must ship before any new part is emitted (R11, C7). The emission must sit behind an effective reader gate for earlier clients (C7). An additive field is never safe merely because an old reader ignores it (C7).

The test is what an older reader would do with the file, not what it would miss.

| Part | Gate today | Why |
|---|---|---|
| `design-system.json`, `templates.json`, `CREDITS.txt` | Additive at reader 1 | A reader that predates the part never looks for it, and the file still opens as the session in `session.json` |
| `tool/*` bundle | `minReader: 2` | A file of the tool kind carries no `session.json`, so an earlier reader has no document to open |
| `sessions/<key>.json` project tree | `minReader: 3` | An earlier reader would open the first session and drop the rest |
| `renovation/*.json` | `minReader: 4` | A renovation-only file carries no `session.json`, so an earlier reader opens an empty document under the renovation's tool id and silently drops the project |

Each gate is in `shells/web/src/lib/lolly-pack.ts`. A gate must fail closed on a missing field, because an absent number is not a pass (C7, R11). One of the four does this today: the renovation check rejects a manifest whose `minReader` is absent as well as one whose value is too low. The project and tool checks compare with `<` against a possibly absent field, where `undefined < 3` is false, so a manifest with the field deleted passes them. That is the work the rule names, not a description of the file.

## Stable ids, revisions and digests

A stable id must never be renamed to express a version (invariant 7). Resource identity must be a stable logical id plus an immutable revision or digest for one evaluation (invariant 7). A tool id and an asset id are permanent contracts (`docs/glossary.md`).

`installDesignRevision` in `shells/web/src/lib/installed-tools.ts` shows the rule at work. The artifact digest is a SHA-256 over the sorted list of path and file-hash pairs, so it covers the whole file set, paths included, rather than the version string a designer typed. Files are staged under `/tools/<id>/.revisions/<digest>/` before the discovery pointer is published. The same version with different bytes is refused, and the message asks the designer for a new revision.

Inside a container an asset row is either an `asset` that carries bytes at a path or an `asset-ref` the recipient resolves locally (`shells/web/src/lib/lolly-pack.ts`). Both name the sender's base asset id, and import matches that id to a receiver-local one. A reader must never treat the path as the identity (invariant 7, `shells/web/src/lib/lolly-pack.ts`).

## The source-aware diff

A semantic diff must run over the authored rows with stable-id alignment, and it must define its input and result semantics (R1). It must never take identity from a lowered render (R1, `engine/src/document-api.ts`).

`diffDocuments` in `engine/src/document-api.ts` compares boxes today by matching `id=` attributes with a regular expression over the hydrated markup. That markup is produced after the runtime has run, so a lowered graph is acting as a second source of authored content (F10). The source rule forbids it (R1), and [records and identity](records.html) points the replacement at this chapter.

The alignment already exists. `compareStructure` with `arrayAlignment: 'id'` in `engine/src/compare-structure.ts` aligns two arrays of rows by `id` and keeps the longest common order, so inserting one row reports one insertion rather than moving every row after it. `compareSources` reports that alignment as `stable-id` (`engine/src/compare.ts`).

Three rules follow.

- A comparison that ran past its budget or was cut short must never read as equal. `compareSources` returns `undetermined` when the result is partial (`engine/src/compare.ts`), and the diff path must keep that answer distinct from equality (C8).
- The compiled path must stay available for template tools and for compiled documents with no source rows, and it must be named as compiled (R1, `engine/src/document-api.ts`). `compileDocument` builds its values after the runtime has run, so repointing a diff at those values does not by itself produce an authored snapshot (`engine/src/document-api.ts`).
- URL state must be decoded through the manifest before comparison, including the compact `z` token, and must never be compared byte for byte (R1, `engine/src/url-mode.ts`). Today the string path of `diffDocuments` compares raw query parameters. `z` is raw DEFLATE over the whole readable query, expanded by `expandQuery` at the load boundary (`engine/src/url-pack.ts`, `engine/src/url-mode.ts`), so one field edit changes the entire token and a byte comparison reports the whole document as changed.

The input and the result are stated here. The input is the instance's authored rows. Each blocks input's row list is taken after URL state has been expanded through the manifest, with every typed payload record resolved by its id. A compiled document is never the input. The result is given per blocks input: the added, removed and changed row ids under `arrayAlignment: 'id'`, a separate reorder set for a row whose order key alone moved, a per-field change list for a changed row and one atomic change for a payload record. The whole comparison also carries one answer, drawn from `identical-bytes`, `equivalent-content`, `different` and `undetermined` (`engine/src/compare.ts`).

## The frozen wire order

The field order of every blocks input is a permanent wire contract and must stay append-only (`schemas/blocks-wire-order.json`). The compact blocks URL form is positional, so reordering, renaming or removing a field scrambles every link already shared. `validate:catalog` fails any change that is not a pure append, and it fails an append too until the pin file ratchets forward in the same change (`scripts/validate-catalog.ts`).

A typed payload record referenced from the row is the migration that respects that order (plan section 13, R1). The pointer field is appended at the end of the input's field list, beside the opaque string it will replace, and never in place of it.

- An appended pointer field must never displace an existing field (`schemas/blocks-wire-order.json`).
- The opaque string must keep resolving for as long as the wire order carries it, so a link shared before the migration still opens (`schemas/blocks-wire-order.json`).
- A reader that finds both must state which one it read, and a writer must state which one it wrote, as a migration finding (R11, plus the findings rule this chapter's migration section states).

The `3d` layer is the open case. The `scene` field on `design:boxes` carries the 3D Studio's own settings as a link query inside a 2D row (`community/design/tool.json`). That is a coordinate domain carried as text, and [source rows, payloads and patches](source-and-patches.html) requires a typed payload record instead. The same input shows the append pattern already: `textStory` and `textFrame` were added after `scene` and `animationEdits` rather than replacing anything (`schemas/blocks-wire-order.json`). The [proof cases](proof-cases.html) carry the migration as a case to be built.

## Independent versions, one pin

`HostV1`, the document model, the conformance suites and the package reader must be versioned independently, with their relationships documented (F15, plan section 13, adoption sequence 6).

The practice exists. Lolly Work vendors engine 1.199.0 against this tree and verifies the vendored content by hash in `engine-pin.json`, a file in that separate repository. The pin carries a version and a content hash per package, plus a hash per schema file.

The document model version and the suite versions must be recorded in the same pin file (`engine-pin.json`, in the Lolly Work repository). That addition is a proposal in this wave, and [conformance and fidelity](conformance.html) owns what a suite version means.

## Current contracts

Plan section 13 lists the contracts a migration has to account for. Each row is a concern to answer, not a change already made.

| Existing contract | Migration concern |
|---|---|
| `tool.json`, templates and hook lifecycles | Map typed inputs and operations; protocol contracts over the existing hooks; no promise of arbitrary row editing for template tools |
| Design-generated tools | Reuse the compiler, the rules, strict execution and immutable revisions; `DesignToolDraftV1` becomes the component v0 |
| Saved Design `boxes` and its SDK read model | The read model stays a read model; the source adapter is the row list itself |
| `ChartSpecV1` | Preserved through nesting and lowering, as the `chart` layer kind |
| `compileDocument` and `CompiledDocument` | Kept as the transient compile result; the diff repointed at the source rows |
| `.lolly` session, tool, project and renovation payloads | Identity, inventory, integrity and reader gates preserved; the parts pattern for extensions |
| Rebrand stages and run records | Source, plan, compiled output, review and partial execution stay distinct records; their outcome vocabulary merges into one |
| Shell routes that act as tools | Unpack, Prepare, Batch, Verify and the Rebrand review get operation adapters (R13) |
| `packages/core/src/extension-v1.ts` | The chrome slot contract. Its namespace and channel model are reused for document extensions; its runtime is not |

The outcome vocabulary those run records merge into is in [operations and outcomes](operations.html). The five route adapters are in the same chapter.

## Open points

- **Q2, granularity and persistence of local rejection.** Default: per rule, instance-scoped, recorded on the session record with a fingerprint of the facts the decision was made about (R6). A derived tool revision is a Design tool export and is not part of 0.1. It touches this chapter because the session record travels inside a container verbatim, so a recorded waiver is carried with the instance and must be scoped to the revision it names (C7). [Constraints, authority and local choice](policy.html) owns the decision. Evidence that would change it: a need to share a rejected state as a reusable tool.
- **Q6, whether the specification is public from the first draft.** Default: yes. The chapters publish to `/info/build/`, since the constraints, determinism and reproducibility pages already make public promises this model has to keep. The draft notice stays at the head of every chapter until the status chapter says otherwise. The [status chapter](status.html) records the answer.

The other open questions do not touch this chapter.

## Precedents

In this repository:

- `shells/web/src/lib/lolly-pack.ts`
- `shells/web/src/lib/bundle.ts`
- `shells/web/src/lib/installed-tools.ts`
- `packages/node-shell/src/lolly-file.ts`
- `packages/node-shell/src/rebrand-run-manifest.ts`
- `packages/core/src/design-tool-v1.ts`
- `packages/core/src/chart-v1.ts`
- `packages/core/src/extension-v1.ts`
- `engine/src/session-record.ts`
- `engine/src/document-api.ts`
- `engine/src/compare.ts`
- `engine/src/compare-structure.ts`
- `engine/src/url-mode.ts`
- `engine/src/url-pack.ts`
- `schemas/blocks-wire-order.json`
- `schemas/tool.schema.json`
- `community/design/tool.json`
- `docs/glossary.md`

In Lolly Work, which is a separate repository and not part of this tree:

- `engine-pin.json`
