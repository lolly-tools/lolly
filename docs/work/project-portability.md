# Project transfer preview

A project manager can inspect the work and access arrangements that would need
review before moving a project to another Lolly Work instance. The preview lists
folders, current sessions, ready shared files and explicit memberships. It makes
no changes to the project or its collaborators.

This release provides an inventory preview. Project export, import and relocation
are not implemented. A saved preview cannot restore a project or authorize access
on another instance. Use the [platform deployment guide](platform-deployment.md)
to prepare an instance and the [operations guide](operations.md) for backup and
recovery procedures.

## Inspect a project

Sign in with a person's account that manages the project and has the
`project.manage` permission. An explicit deny grant still applies. Agent
invitations and service tokens cannot request this preview, including when a
request also carries a person's session cookie.

In the admin console, open **Projects** (`#/projects`), select the project and
find **Prepare to move this project** in its detail view. Choose **Preview
transfer** to load the inventory. Nothing is requested until you choose that
action. **Refresh preview** replaces the observation; a failed refresh clears
the earlier result. **Download inventory JSON** is offered only for a successful
preview and saves its private metadata. It does not copy documents or files,
change access or move the project.

You can also use the CLI:

```sh
lw login --base https://work.example.com
lw projects transfer-preview prj_example --base https://work.example.com
lw projects transfer-preview prj_example --base https://work.example.com --json
lw projects transfer-preview prj_example --base https://work.example.com --out project-preview.json
```

`lw login` opens the device sign-in flow. If your terminal environment has
`LW_TOKEN` set, remove it for this human workflow; an explicit token takes
precedence over the saved session and is refused rather than retried as another
identity. The preview command calls
`GET /api/v1/projects/:id/transfer-inventory`. The route requires the same project
standing and capabilities as the CLI. It does not bypass a session's
`session.view` denial: denied sessions are omitted and counted.

The normal output gives a short summary and the limits that still need review.
`--json` returns the inventory object. `--out` creates a new JSON file with mode
`0600`; it refuses existing files and symbolic links. Choose a new path when
saving another observation. Preview files contain project and access metadata,
so keep them with your other private operational records.

## What the preview establishes

| Area | Included | Further work for a transfer |
|---|---|---|
| Project | Identity, name and archived state | Choose a destination and ownership policy |
| Folders | Shared hierarchy and item references | Validate references against a consistent transfer snapshot |
| Sessions | Visible current IDs, tools, tool versions and observed durable revisions | Export document content and verify destination tool compatibility |
| Collaboration | Observed active lease for each visible session | Arrange a migration window; a preview does not stop editors or move live rooms |
| History | A bounded sample of session-version summaries and the legacy revision retention limit | Collect and validate the retained history selected for transfer |
| Files | Ready shared-file metadata, declared digests and declared byte totals | Read and independently verify bytes and ensure every dependency is included |
| Access | Owner and member IDs, roles, expiry and configured group/audience access | Map identities and groups explicitly under destination policy |

No document inputs, comment bodies, file bytes, credentials, invitation links or
agent tokens are returned. The preview does not resolve DAM assets, open remote
URLs, inspect arbitrary session inputs or verify the completeness of asset
dependencies. Personal device assets, pack assets, catalog versions, provider
permissions and external resources need their own review.

Declared file sizes and SHA-256 values describe upload records. This request does
not fetch parts or independently rehash them. A matching record is not evidence
that every stored byte is present and intact.

History has two separate storage paths. Legacy `session_revisions` keeps the
newest 20 revisions. Saved session versions have a separate paginated history,
retention rules and space limits; the preview samples at most 100 version
summaries per visible session. A full sample may have more rows behind the preview. Live
collaboration also has a compacted checkpoint and recovery journal, which is not
a complete edit history. The preview does not transfer any of these stores.

## Limits and interpretation

The response uses `schema: "lolly-project-transfer-inventory-v1"` and
`mode: "preview"`. It always reports `readOnly: true`,
`snapshotConsistent: false`, `complete: false` and `importReady: false`.
`observedAt` records an observation time, not a transaction boundary. Concurrent
edits, uploads, folder moves and access changes can occur between reads.
`observationSha256` identifies the returned metadata observation. It does not
verify document or file bytes, establish a consistent snapshot or authorize a
transfer.

The route supports at most 200 current sessions, 2,000 ready files, 1,000 folders
and 2,000 explicit members per project. A project beyond a supported bound is
refused with HTTP `413 INVENTORY_LIMIT`; it is not silently presented as a
complete smaller project. The bounds constrain this first preview and do not
change project creation or storage limits.

`counts.omittedSessions` records current sessions excluded by the caller's access
policy. The response does not disclose their IDs or content. Archived projects
can be inspected; deleted sessions, unfinished uploads, revoked links, pending
invitations, audit records, personal view preferences and other instance data are
outside this inventory.

Warnings such as `NON_SNAPSHOT`, `ASSET_DEPENDENCIES_NOT_INSPECTED`,
`HISTORY_INCOMPLETE`, `IDENTITIES_REQUIRE_MAPPING` and
`FILE_BYTES_NOT_VERIFIED` describe work still required. `LIVE_COLLABORATION` and
`SESSION_ACCESS_OMITTED` identify observed conditions, when present. A preview
with no active lease still needs a coordinated migration procedure: presence,
editing claims and uncommitted gestures do not become transferable records.

## Prepare a future transfer

Before implementing or running a transfer, agree the source and destination,
business ownership, identity and group mapping, asset scope, retained history,
required approvals and rollback procedure. Test a destination instance with its
own credentials and verify database and blob recovery independently.

A future transfer needs a consistent content snapshot, bounded and authenticated
download, integrity verification, destination capability checks, collision-safe
IDs, reviewed access mapping and a durable apply receipt. It must preserve
attribution without copying authentication credentials or assuming that the same
email address grants the same rights elsewhere. These requirements apply on
premises, sovereign clouds, public clouds and home installations alike.

See [sharing](sharing.md), [permissions](permissions.md),
[data lifecycle](data-lifecycle.md) and [deployment](deployment.md) for the current
access, retention and infrastructure contracts.
