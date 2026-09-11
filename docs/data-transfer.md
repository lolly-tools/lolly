# Data Transfer - the `lolly-backup` bundle

Everything a Lolly user accumulates lives **on their device** - no account, no cloud. The data-transfer bundle is how that value moves: export it on one install, carry the file by any means (USB, AirDrop, email-to-self, a network share) and import it on another. The file *is* the transport. The target can be offline or online. It makes no difference, because nothing ever talks to a server.

![The two buttons that move a whole install: Export my data writes one zip, Import data reads it back](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1800&dpi=192&waitMs=2400&css=.store-manages%7Bdisplay%3Anone%7D&walker=1&format=svg&cropSelector=.storage-subsection&dark=1&filename=pd-transfer-controls)

This page is the format spec. For the end-user walkthrough see [Using Lolly → Moving to another device](/info/using.html). The implementation is [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts), and [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) pins the round-trip contract.

> **Scope.** A bundle carries *user data*, not tools. Tools and catalog assets are synced separately and are assumed to already be present on the target (worst case at a higher version). Importing never installs or upgrades a tool.

## Goals

- <!--i:box--> **One format, every shell.** The web PWA, Tauri desktop/mobile apps and future shells share the same envelope and supported part schemas. Optional parts depend on each shell's capabilities; unsupported parts are reported. Each capability bridge supplies its storage adapter.
- <!--i:shieldcheck--> **Survives the trip.** A bundle mangled or truncated in transit fails loudly on import, never half-restores.
- <!--i:clock--> **Outlives this version.** An older app can still import a newer bundle's recognised parts. A genuinely breaking format is refused cleanly.
- <!--i:check--> **Safe to merge.** Importing onto an install that is already in use never wipes anything that was not in the bundle.

## The envelope

A bundle is a plain `.zip`. The download is named for the person it belongs to - `LollyTools-<First>-<Last>-<YYYY-MM-DD>-<n>.zip` (for example `LollyTools-Ada-Lovelace-2026-06-26-1.zip`) - so a Downloads folder of backups stays legible. The first and last parts come from the profile and are omitted when unset. No profile gives `LollyTools-2026-06-26-1.zip`, and a first name alone gives `LollyTools-Ada-2026-06-26-1.zip`. Each part is sanitised to a filename-safe token (Unicode letters/digits kept, spaces/punctuation stripped, capped at 32 chars). `<n>` is a per-day, per-device sequence, so repeat exports on the same day do not collide and stay in order. `backupFilename()` in [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) builds the name. The zip's contents are identical regardless of name. Inside:

| Path | Required | Contents |
|---|---|---|
| `manifest.json` | yes | Format id, versions, counts and per-part integrity. The first thing a reader looks at. |
| `profile.json` | when set | The user's `me` record (name, contact, headshot ref, flags). Read via `host.profile`. |
| `sessions.json` | yes | Every saved session: slot, tool id/version, label, thumbnail (data-URL) and full input data. Read via `host.state`. |
| `assets.json` | yes | Metadata for each uploaded asset (images, fonts, brand tokens), each pointing at its bytes under `assets/blobs/`. |
| `assets/blobs/<n>.<ext>` | per asset | The raw asset bytes (image and font files). Stored uncompressed (already-compressed formats). The extension is cosmetic. The MIME in `assets.json` is authoritative. |
| `assets/blobs/<n>.c2pa` | when present | Extracted Content Credentials as exact binary bytes, referenced by `_credentialFile` in the asset record. These are not device signing keys. |
| `file-history.json` | optional | Versioned asset snapshots, terminal file-operation reports and complete batch manifests. The history part has its own version; provided by the shell's internal `fileHistory` backup adapter. |
| `revision-history.json` | optional, manual backups | Stable creation IDs, retained checkpoints, thumbnails and rolling recovery drafts. Provided by `host.state.history.backup` where supported. |
| `file-history/versions/` | per snapshot | Previous asset bytes and extracted credentials, independent of whether the current asset still exists. |
| `file-history/results/` | per completed operation | Exact output bytes. No original selected-for-conversion file is retained or included. |
| `prefs.json` | yes | User-owned local preferences: `theme`, `sidebarWidth` and the `ct-metrics` activity tally. |
| `lolly.txt` | yes | A human-readable summary of the bundle (counts, profile, filename) for anyone who opens the zip without Lolly. Regenerated on every export and recognised on import, so it never counts as a skipped part. It is written *after* the integrity map, so it stays outside it. |

The bundle is a plain zip on purpose: it survives any transport intact, and any unzip tool can inspect it.

`profile.json` is the smallest part and the one a reader sees first in the app: the details a producer fills in once, plus the opt-in that lets tools use them.

![The Profile details form that becomes profile.json - name, contact, headshot and the opt-in beside them](/t/url-shot?url=%2F%23%2Fprofile&width=1440&height=900&dpi=192&waitMs=1800&format=svg&cropSelector=.profile-details-grid&walker=1&dark=1&filename=ce-profile-record)

## `manifest.json`

```json
{
  "format": "lolly-backup",
  "formatVersion": 3,
  "minReader": 1,
  "app": "lolly",
  "exportedAt": "2026-06-22T09:30:00.000Z",
  "counts": { "profile": true, "sessions": 2, "userAssets": 4, "prefs": 3, "assetVersions": 1, "fileOperations": 1 },
  "integrity": {
    "profile.json": "sha256-…",
    "sessions.json": "sha256-…",
    "assets.json": "sha256-…",
    "assets/blobs/0.bin": "sha256-…",
    "file-history.json": "sha256-…",
    "file-history/versions/0.bin": "sha256-…",
    "file-history/results/0.bin": "sha256-…",
    "prefs.json": "sha256-…"
  }
}
```

| Field | Meaning |
|---|---|
| `format` | Always `lolly-backup`. A file without it is rejected as "not a Lolly backup". |
| `formatVersion` | The layout this bundle was **written** with. Bumped on any change to the part set or shapes. Readers do **not** gate on it. |
| `minReader` | The minimum reader version required to import this bundle **safely**. This is the field readers gate on. |
| `app` | Producing app id, for diagnostics. |
| `exportedAt` | ISO timestamp the bundle was created. |
| `counts` | What the writer put in, for display and sanity-checking. |
| `integrity` | Optional. Maps every part except `manifest.json` to an SRI-style `sha256-<base64>` digest of its **uncompressed** bytes. |

## Version policy (forward compatibility)

The split between `formatVersion` and `minReader` is what lets the format grow without orphaning older installs:

- A reader imports a bundle when `manifest.minReader ≤` its own reader version. It refuses (with "needs a newer version of the app") only when the bundle explicitly demands a newer reader.
- An **additive** change - a new *optional* part, or a new optional manifest field - bumps `formatVersion` but leaves `minReader` unchanged. Older apps still import every part they recognise. Parts they do not recognise are skipped (see below), not dropped silently.
- A **breaking** change - one where a wrong import of a part corrupts data, or where a previously optional part becomes mandatory - raises `minReader`. Older apps then refuse cleanly instead of importing something they cannot handle.
- If a future bundle sets `formatVersion` but omits `minReader`, readers conservatively fall back to gating on `formatVersion` (treat the change as breaking).

> **Rule of thumb for authors:** if every existing reader would still do the right thing by ignoring your addition, it is additive - bump `formatVersion`, leave `minReader`. Otherwise raise `minReader`.

## Integrity

When `manifest.integrity` is present, a reader verifies each listed part's SHA-256 **before writing anything**. A mismatch ("failed its integrity check") or a missing part ("incomplete") aborts the whole import - there is no partial restore. This catches the corruption a file transport can introduce (a truncated AirDrop, an email gateway that re-encoded the attachment, a bad USB sector).

Integrity is best-effort by design: it is written only where Web Crypto is available (every secure browser context and modern Node), and verified only when both the map and Web Crypto are present. A bundle without the map - for example one from before integrity existed - imports unchanged. "Cannot verify" is never treated as "corrupt".

The manifest lists neither itself nor the regenerated `lolly.txt` README. The digests cover the parts the manifest vouches for.

## Import semantics

Import is **merge-overwrite**, never replace-all:

- Existing data on the target is left in place.
- Any key that collides - the profile, a session slot, an uploaded image id - is replaced by the imported copy.
- Historical asset versions and operation IDs are immutable exceptions: a repeat import is idempotent, and an ID already naming different bytes/history is refused, not overwritten. Re-importing an identical current asset preserves its version. A changed current asset must carry a different version.
- Creation history is also an exception: a conflicting current document or revision identity aborts its restore before profile, asset or preference changes. An identical repeat import adds no storage. Restore a conflicting archive on a separate install to inspect and copy its creations.
- Nothing that was not in the bundle is touched. A session the target had but the bundle did not survives the import.

Saved sessions re-link to their images automatically: asset references are kept by id, and the bridge re-resolves them after the uploaded images are restored (it must anyway, because `blob:` URLs do not survive a reload).

The import summary reports `{ profile, sessions, userAssets, prefs, skipped, failedAssets }`. `failedAssets` counts uploaded assets that could not be restored (device storage full, say). It is distinct from `skipped`, which counts parts from a forward-compatible newer writer that this build did not recognise. The UI surfaces `skipped` ("… · N newer items skipped"), so the restore is honest about what it left behind.

When file history is present, the summary also carries `assetVersions`, `fileOperations` and `failedHistory`. Storage exhaustion or immutable-ID conflicts can cause a partial restore; the UI tells the user to retain the source backup. Cloud sync does **not** advance its applied revision after a partial or unsupported restore, so the snapshot remains available for retry. Restore is not a single transaction across all profile/session/asset/history stores.

## Creation history (v3)

Manual backups from a history-capable web host include `revision-history.json` with its own `{ version: 1, documents, revisions, recoveries }` schema. It carries the retained IDs, canonical input snapshots, version stamps, raster previews and separate writer drafts. The history adapter captures current sessions and their heads in one read transaction; `sessions.json` uses those same current snapshots for older readers.

Restore checks payload SHA-256 and byte counts, unique identities, document/head relationships, ancestry, timestamps, preview types and limits before committing the archive in one transaction. Compacted parent references may be absent. Existing current work must match the imported document; conflicts are refused rather than silently replacing it. The archive's 384 MiB transfer limit is checked explicitly, and storage limits are enforced without truncating retained checkpoints. The overall backup still uses an in-memory ZIP implementation and is not a streaming archive.

The summary adds `revisions` and `recoveryDrafts`. A shell without this capability restores ordinary sessions and reports the history part as skipped. Native filesystem history remains unsupported until its adapter supplies durable history transactions. P2P guest state has no durable history or recovery archive.

Personal snapshot sync explicitly excludes creation history. Applying a snapshot to a history-bearing local document preserves its previous working state as a separate recovery draft and invalidates any open editor's write token. Its immutable checkpoints remain on the device. This protects local history during snapshot replacement; it does not merge concurrent device histories.

Historical asset references are retained, while rendering still resolves assets through the destination's existing library. This archive does not yet guarantee exact old asset bytes or old tool renders. Asset-version and file-result bytes continue to travel through their existing separate backup part.

## Saved versions and file results (v2)

The optional history part contains `{ version: 2, assetVersions: [...], operations: [...], batches: [...] }`; readers also accept the earlier history-v1 shape without batches. Each snapshot identifies the stable asset ID and exact version, its save time, byte length and hex SHA-256, plus an asset record whose `_file` and optional `_credentialFile` point to binary parts. Operations carry the original file facts, request, report, timestamps and optional result `_file`; storage backend names, OPFS handles and execution leases do not travel. Older history-v1-only readers refuse the new history version before importing, rather than silently dropping batch membership.

Batch manifests record every selected source before processing, including files never read, cancelled members, failures to reserve result space and interrupted work. Each member has a stable operation ID, source reference/facts, requested output name and terminal report. An unread source has declared facts, not an invented digest. Import validates member identity and consistency with any carried operation report. Batch reports remain available when individual results have been explicitly removed, but a receipt does not imply that its output bytes are still stored.

- Every known history record, report and referenced file is validated before any profile or asset import writes. Missing bytes and mismatched SHA-256 fail even if the envelope has no integrity map. Extracted credentials remain byte arrays, including imports from older writers that JSON-serialized them as numeric-key objects.
- Running operations become interrupted records in the backup, with an explanatory failure report and no result. Restoring never restarts background work or imports an active lease. Retrying requires selecting the original file, checked against its recorded SHA-256 when available.
- Restored results commit their bytes and metadata together in IndexedDB. Ordinary new results use OPFS where available, with an IndexedDB fallback. An existing live operation is never replaced by an import.
- History ZIP assembly is still in memory: the current limit is **256 MiB of history payload**, **4 MiB of history metadata**, at most **100 operations**, **100 batches** and **2,000 snapshots**. Export refuses oversized or incomplete history explicitly; it never silently omits it. Download important versions/results individually before removing older local copies. These limits are not a measured peak-memory guarantee for phones.
- Local result history has a 512 MiB budget and 100-record cap. Asset snapshots have a separate 512 MiB budget and at most 20 historical versions per asset; extracted credential bytes count toward that snapshot budget. Restore respects these limits and never silently evicts existing user data.
- Local batch metadata has a separate 4 MiB budget, at most 100 manifests and 20 members per batch. Pending members reserve metadata capacity, with a 32 KiB per-member report ceiling. This is a logical budget, not a browser disk-space guarantee; a real quota failure is surfaced and the in-memory report remains downloadable. Retrying a batch member creates a new batch without overwriting the old report. Removing a batch record does not remove individual result bytes or library assets.
- Converted results can be explicitly added to the library without normalization or re-encoding. Source/output hashes and the operation relation accompany the asset. Repeated adds reuse an unchanged copy; an edited copy is never overwritten. Raster images can start a new Design document. That document uses the current library asset ID: enforcing exact version pins throughout Design's runtime and URL path is still separate work. SVG/HTML/PDF/ZIP results are kept as opaque file assets by this handoff, not promoted to trusted interactive/vector content.
- **Convert → Recent file operations** exposes history usage, reports, downloads and the version manager. The manager also finds earlier versions of deleted library assets. Restoring a snapshot creates a new current version while keeping the selected snapshot intact. **Profile → Storage** accounts for results and versions separately from disposable caches.
- Explicit temporary-file cleanup removes only operation-owned, unreferenced bytes. Current records protect their files; recent OPFS files have a one-hour grace period. Saved results and asset snapshots are not automatically cleared.

Older readers still accept the v2 envelope (`minReader: 1`) and restore familiar parts, counting unsupported history parts as skipped. Full history recovery requires a shell with the `fileHistory` adapter; this is a shell-internal seam, not a new tool-facing `HostV1` capability. Real two-device restore is covered by the local Chromium gate; installed Tauri/iOS/Android recovery acceptance remains separate.

## What does not travel

- **Catalog caches** (downloaded asset metadata and blobs, the tool index) - re-synced for free on the target.
- **Tools and brand assets** - out of scope, and assumed already present on the target.
- **`blob:` / object URLs** - regenerated by the bridge on load.
- **Conversion originals, live execution leases and machine-local access/signing secrets** - not portable history payload. A saved result is a copy, not a promise that the original source was backed up.
- **The export sequence counter** - the per-day download-naming counter (`localStorage` key `lolly-export-seq`) is a local naming convenience. It is kept out of `PREF_KEYS`, so it never rides in a bundle.

The storage meter itemises the same split. Saved sessions, My images and File results & versions ride in a bundle. The asset cache, tool previews and offline pins below them are all re-derivable, so they stay behind.

![The storage meter breaking this device's data into named categories, with Saved sessions and My images tracked separately from the Asset cache, here on a fresh install where every category is still empty](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Dstorage-section&width=1440&height=1600&dpi=192&waitMs=2600&format=svg&css=.store-manages%2C.storage-subsection%2C.store-selbar%7Bdisplay%3Anone%7D&cropSelector=.store-meter&walker=1&dark=1&filename=ce-storage-categories)

## Cross-shell guarantee

`data-transfer.ts` reads and writes exclusively through the capability bridge (`host.profile`, `host.state`, `host.assets`) and the shared `localStorage` prefs. The same module reads and writes the common envelope on web and Tauri, over IndexedDB or filesystem storage. Optional history parts appear only where the corresponding adapter is available; an unsupported part is reported as skipped on import. The headless suite exercises the common parts against an in-memory bridge, while history transactions also have real-browser tests.

Two shells sit outside that guarantee, for different reasons:

- The **one-shot CLI** has nothing to carry - its state is in-memory and ephemeral per invocation.
- The **TUI** does persist state (`~/.lolly`: sessions, folders, profile) and its Profile view can back it up, but it writes a *simpler* archive of its own: `sessions/<slot>.json` per session plus `profile.json` and `folders.json`, with no manifest, no `formatVersion`/`minReader` and no integrity map. It is **not** importable by this format - a reader rejects it as "not a Lolly backup" - and confusingly it uses a similar name (`lolly-backup-<stamp>.zip`). Unifying the two is a known gap.

## Reserved extension points

The envelope is a manifest plus a set of named parts by design, so new kinds of portable data can ride it later **without a breaking change**. They slot in as additive parts (new `formatVersion`, same `minReader`), and today's reader skips what it does not recognise. These are on the [roadmap](/info/overview.html#roadmap), not yet implemented. The names are reserved here so the format stays coherent when they land.

- **`tokens.json` - design tokens.** A [W3C DTCG](https://tr.designtokens.org/format/) design-tokens document (the format [Penpot imports and exports](https://help.penpot.app/user-guide/design-systems/design-tokens/) - tokens with `$value`/`$type`/`$description`, organised into groups, sets and themes). A token set in the bundle lets a user move their brand primitives between installs alongside their sessions. Longer term, an ingested token set becomes a first-class source that tools and palette assets resolve against.
- **`penpot/` - ingested Penpot files.** A reserved directory for a Penpot file (or its extracted, Lolly-relevant subset) imported and surfaced *as a tool*. The bundle will carry the ingested definition, so it travels with the rest of the user's data.

Anything outside these reserved names and the parts above is, to a reader, an unknown part: left untouched and counted in `skipped`.

## Reference

- Module: [`shells/web/src/data-transfer.ts`](../shells/web/src/data-transfer.ts) (`exportBackup`, `importBackup`, `BACKUP_FORMAT`, `BACKUP_FORMAT_VERSION`, `BACKUP_READER_VERSION` - the `backupFilename()` namer is internal).
- Contract test: [`tests/data-transfer.test.ts`](../tests/data-transfer.test.ts) - round-trip, merge, integrity, forward-compat and reader-gate cases.
- History contract tests: [`tests/file-history-backup.test.ts`](../tests/file-history-backup.test.ts), [`tests/file-batch-history.test.ts`](../tests/file-batch-history.test.ts) and [`tests/file-result-library.test.ts`](../tests/file-result-library.test.ts). Browser acceptance: [`tests/file-history.browser.test.ts`](../tests/file-history.browser.test.ts), [`tests/file-batch-history.browser.test.ts`](../tests/file-batch-history.browser.test.ts) and [`tests/file-result-reuse.browser.test.ts`](../tests/file-result-reuse.browser.test.ts).
- Bridge surface used: `host.profile`, `host.state`, `host.assets` - see [Host API](/info/host-api.html).
