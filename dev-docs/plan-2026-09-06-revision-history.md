# Plan: revision history for creations (2026-09-06)

A saved creation should have a history: every save kept, shown as a strip of thumbnails, any of them restorable, with who made it when a control plane is present. Standalone, it is all on the device. On lolly-work, it is linked to the signed-in user and shared with the project. Same UI in both.

File references: `lolly-web` at `45ee61a`, `lolly-work` at `987ab54`, engine at `3fea3b9`.

## 1. What exists today

**Locally there is no history.** A saved creation is one IndexedDB record overwritten in place: `shells/web/src/bridge/state.ts:94-113` reads the prior record only to keep `createdAt`, then `db.put('state', record)`. Delete is a hard delete (`:139-141`). Trash is a rename to `__trash__:<slot>` (`lib/batch-slots.ts:21`) restored from `views/projects.ts:1774-1810`. The record envelope is `engine/src/session-record.ts` (`{ slot, toolId, toolVersion, label, data, thumb, updatedAt, formatVersion, engineVersion }`, `SESSION_FORMAT_VERSION = 2`); `formatVersion` is a layout version, not a revision number.

Three neighbours are worth copying rather than inventing:

- Per-asset byte history: `bridge/asset-history.ts`, a `user-asset-versions` store keyed `[assetId, version]`, snapshot of the previous bytes on every content change, 20 per asset, a 512 MB global ceiling, and the only shipped restore UI (`views/asset-versions.ts`: a text list with Download, Restore as current, Remove).
- Export history: `lib/export-history.ts`, 24 entries with a data-URL `thumb` and the `query` that reopens the state; rendered as the Dashboard's "Latest exports" deck. The closest thing to a visual timeline, but it records downloads, not saves.
- In-session undo: `views/tool-history.ts`, 100 entries, in memory only, gone on reload.

Every save already carries a thumbnail (`StateRecord.thumb`, painted by the Projects tiles at `views/projects.ts:2455-2531`). That is the single fact that makes a visual history cheap locally.

**On lolly-work, revisions exist and nobody reads them.** `session_revisions` (migration `0004_sessions.sql:34-43`, primary key `(session_id, rev)`), `SessionRevision { sessionId, rev, inputs, meta, actor, at }` and `SESSION_REVISION_LIMIT = 20` (`server/src/store/types.ts:229-241`), appended on `PUT /api/v1/sessions/:id` (`api/app.ts:5531`, `actor = user.id`), on bulk edit (`:5616`), and on collab room quiesce (`collab/persistence.ts:279-281`, `actor = 'collab'`). `GET /api/v1/sessions/:id/revisions` exists (`app.ts:5552-5560`, member plus project visibility, documented at `docs/api.md:283`). No client calls it: the shell's `org/session-source.ts` uses projects and sessions only, and the console has no history view. There is no restore route, no thumbnail on a revision, and no paging past the 20.

## 2. Product shape

One surface, "History", reachable from three places: the Projects tile menu beside Duplicate (`views/projects.ts:1588`), the tool view's Save menu, and the Share dialog's "On this instance" section when the creation lives on lolly-work.

- A horizontal strip of thumbnails, newest at the right, the current state marked. Each tile: relative time, the editor's name (lolly-work) or nothing (local), and the count of changed inputs since the previous version.
- Tap a tile: a larger preview, a list of the inputs that changed with before and after values, and two actions, Restore and Compare.
- Restore writes the chosen version as a new save. The pre-restore state is itself kept, so restore is never destructive and there is no "are you sure".
- Compare shows two thumbnails side by side with a slider, plus the input diff. It is the same component the collab conflict view could use later.
- Pin: a version can be named and pinned so retention never drops it ("v1 sent to client").
- Retention is visible: "Keeps the last 30 saves and every pinned one" with the storage line the profile already shows.

Not in scope: per-keystroke history (undo covers it in-session), branching, and merging two versions.

## 3. Local design (standalone and the on-device half of lolly-work)

### 3.1 Store

A new `state-versions` object store in `bridge/db.ts`: key `[slot, versionId]`, `versionId` a monotonically increasing integer per slot, indexes on `slot` and `savedAt`. `DB_VERSION` goes past 19 and `REQUIRED_STORES` gains the name. Record:

```
{ slot, versionId, savedAt, toolId, toolVersion, engineVersion, label, thumb, data, sha256, pinned, note }
```

`sha256` is over canonical JSON of `data`; two consecutive saves with the same hash produce no new version (autosave loops must not fill the history). `thumb` is the same data-URL the state record carries.

### 3.2 Write path

In `createStateAPI().save()` (`bridge/state.ts:94-113`), which already reads the previous record: push the previous `{ data, thumb, updatedAt, label }` as a version before the `put`, then enforce retention. Autosave cadence decides granularity, so the tool view's save coalescing (500 ms in `tool-history.ts`) is what stops a drag from writing thirty versions; the hash check is the backstop.

Retention, applied per slot on every write:

- keep the newest 30 unpinned versions;
- keep every pinned version;
- global ceiling shared with asset history through `lib/file-history-storage.ts` (`measureFileHistory` gains `sessionVersionBytes`), 512 MB combined; when exceeded, drop the oldest unpinned versions across all slots, never pinned ones;
- deleting a creation (trash) keeps its versions until the trash is emptied; emptying trash removes them.

### 3.3 Read and restore

`bridge/state.ts` gains `versions(slot)`, `version(slot, id)`, `restore(slot, id)`, `pin(slot, id, note)`, `forget(slot, id)`. `restore` is `save(slot, version.data, version.thumb)` so the pre-restore state becomes the newest version by the same path. These land on the web `StateAPI` only, not on `HostV1`: tools never see history, and the CLI does not need it. The Tauri shells' filesystem state (`shells/tauri-shared/bridge-overrides/state-fs.ts`) gets the same five functions over a `versions/<slot>/<id>.json` layout, so iOS keeps history across a WKWebView purge; the type-only import of `WebStateAPI` already forces the two surfaces to match.

### 3.4 Diff

`lib/session-diff.ts`: given two `data` maps and the tool's input model, return `{ id, label, before, after }[]` using the manifest labels, collapsing `blocks` arrays to "3 rows changed" and assets to their names. Pure, tested against three manifests.

### 3.5 UI

`views/session-history.ts` (modal via `mountModal`, lazy import, must not land on the boot path): strip, detail, compare, pin. Thumbnails are the stored data URLs, so opening the modal costs no render. Empty state for a creation saved once. Keyboard: left and right move the selection, Enter restores, Escape closes. Coarse pointers get 44 px tiles and a swipe.

### 3.6 Backup and sync

`data-transfer.ts` (device backup) includes `state-versions`, capped by the same ceiling. The sync engine (`lib/sync-engine.ts`) does not sync versions in this phase; the record says which device wrote each version so a later merge can order them.

## 4. lolly-work design

### 4.1 Storage

`session_revisions` stays the table. Add columns via migration `0035_session_revision_thumbs.sql`: `thumb bytea null` (a 320 px JPEG, capped at 24 KB server-side), `pinned boolean default false`, `note text null`, `sha256 text null`. Raise `SESSION_REVISION_LIMIT` to 50 unpinned; pinned never trimmed; the trim runs in `appendSessionRevision` as now.

### 4.2 Routes

- `GET /api/v1/sessions/:id/revisions?before=<rev>&limit=20`: paged newest-first, each row `{ rev, at, actor: { id, name } | { kind: 'collab' } | { kind: 'guest', label }, changed: number, pinned, note, thumbUrl }`. `inputs` are not in the list; they come from the next route.
- `GET /api/v1/sessions/:id/revisions/:rev`: full `inputs` and `meta`.
- `GET /api/v1/sessions/:id/revisions/:rev/thumb`: the JPEG, private cache headers.
- `POST /api/v1/sessions/:id/revisions/:rev/restore`: CAS-writes the revision's `inputs` at the current `rev` (409 with `current` on a race, same as `PUT`), appends a new revision with `actor = user.id` and `meta.restoredFrom = rev`, audits `session.restore`. Gated on `session.edit`.
- `PATCH /api/v1/sessions/:id/revisions/:rev` `{ pinned, note }`: gated on `session.edit`.
- `PUT /api/v1/sessions/:id` accepts an optional `thumb` (data URL) the shell sends with each save; the server decodes, re-encodes to the cap, and stores it on the revision it appends.

Every route: member, `canSeeProject`, and a `410` for a tombstoned session on the write routes only (the read routes keep answering, as the existing revisions route does, so history survives a delete until purge).

### 4.3 Actor resolution

`actor` stays free text in the table. The response resolves it: a user id to `{ id, name }` through the user store, `'collab'` to `{ kind: 'collab' }` shown as "Shared editing session", a guest actor to `{ kind: 'guest', label }`. Erasure (`server/src/privacy`, the scrub path that already covers attribution) must scrub `actor` on revisions too.

### 4.4 Collab

A live room writes at most one revision per quiesce (`collab/persistence.ts:349-350`, `SNAPSHOT_EVERY_BATCHES = 20`). That is the right granularity for history; the CRDT op log stays unpersisted. Two consequences to state in the UI: a co-edited creation's history is a history of sessions, not gestures; and restoring while a room is live must go through the room (apply the revision's inputs as ops) rather than the HTTP route, or the room's next quiesce overwrites it. Phase 3 below.

### 4.5 Shell seam

`lib/session-source.ts` (`SessionSource`: `label`, `listProjects`, `listSessions`, `fetchSession`) gains `listRevisions(sessionId, cursor?)`, `fetchRevision(sessionId, rev)`, `restoreRevision(sessionId, rev)`, `pinRevision(sessionId, rev, pinned, note)`. The local source implements them over `state-versions`; `org/session-source.ts` over the routes. `views/session-history.ts` takes a `SessionSource`, so it is one component for both worlds, which is the whole point of the seam.

### 4.6 Console

`console/app.js` gains a History panel on the session detail row: the same strip, read-only for admins without `session.edit`, with the actor and restore audit visible. The console is where an admin answers "who changed the pricing on this deck".

## 5. Phases

1. **Local history** (M). Store, write path, retention, the five API functions, `session-diff`, the modal, three entry points, backup. Ships standalone value and the shared component.
2. **lolly-work read and restore** (M). Migration, the five routes, thumbnails on save, actor resolution, erasure scrub, the org session source, the console panel. Local and org share the modal.
3. **Collab-aware restore and sync** (M). Restore through a live room, version ordering across devices in the sync engine, and the Share dialog entry.

Each phase is its own PR set: `lolly-web` for 1, `lolly-work` plus `lolly-web` for 2, both for 3.

## 6. Tests

- `bridge/state.test.ts`: version on save, hash dedupe, retention counts, pinned survives trim, global ceiling drops oldest unpinned across slots, restore ordering, trash and empty-trash behaviour.
- `lib/session-diff.test.ts`: scalar, blocks, asset diffs against real manifests.
- `views/session-history.test.ts`: DOM contract, keyboard, empty state.
- `shells/tauri-shared/bridge-overrides/state-fs.test.ts`: the same five functions over the fs adapter, and the `WebStateAPI` return type keeps them in step.
- lolly-work `tests/sessions.test.ts`: paging, restore CAS race, restore audit row, pin, thumb cap, tombstone behaviour, actor resolution, erasure scrub; `tests/collab/*`: a quiesce still writes one revision and a restore through the room round-trips.
- A cross-source contract test in `lib/session-source.test.ts` runs the same scenario against the local and org sources.

## 7. Risks and decisions to make early

- Storage growth: a design document with large `blocks` arrays is tens of KB per save; 30 versions times hundreds of creations is what the ceiling is for. Measure with the storage screen before choosing 30.
- Thumbnail privacy on lolly-work: a thumbnail is a render of possibly locked or hidden inputs. Serve it under the same visibility as the session and never in the list payload of a project.
- The 20-revision floor today means active sessions on existing instances already lost history; the raise to 50 only helps from the migration on. Say so in the release note.
- Restore semantics with locked inputs (`INPUT_LOCKED`, `policy/overlay.ts`): a restore must bake the current policy's locked values over the revision's inputs, exactly as a `PUT` does, or an old revision could reintroduce a value policy has since locked.
