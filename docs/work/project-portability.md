# Preview a project transfer

See everything a move would involve, without changing anything. This page is for the project
manager preparing to move a project to another Lolly Work instance. The preview lists the
project's folders, current sessions, ready shared files and explicit memberships, and makes no
changes to the project or its collaborators.

Export, import and moving a project are not built. A saved preview cannot restore a project or
grant access on another instance. To prepare the destination, use the [platform deployment
guide](platform-deployment.md), and for backup and recovery, the [operations
guide](operations.md).

## Inspect a project

Sign in with a person's account that manages the project and holds `project.manage`. An explicit
deny grant still applies. Agent invitations and service tokens cannot request this preview, even
when a request also carries a person's session cookie.

In the admin console:

::: timeline
- <!--i:folder--> Open **Projects** (`#/projects`) and select the project.
- <!--i:search--> Find **Prepare to move this project** in its detail view and choose **Preview transfer**. Nothing is requested until you do.
- <!--i:clock--> Choose **Refresh preview** to replace the observation. A failed refresh clears the earlier result.
- <!--i:download--> Choose **Download inventory JSON** to save a successful preview's private metadata. It does not copy documents or files, change access or move the project.
:::

You can also use the CLI:

```sh
lw login --base https://work.example.com
lw projects transfer-preview prj_example --base https://work.example.com
lw projects transfer-preview prj_example --base https://work.example.com --json
lw projects transfer-preview prj_example --base https://work.example.com --out project-preview.json
```

`lw login` opens the device sign-in flow. If your terminal has `LW_TOKEN` set, remove it for this
human workflow: an explicit token takes precedence over the saved session, and it is refused
rather than retried as another identity. The command calls
`GET /api/v1/projects/:id/transfer-inventory`, which needs the same project standing and
permissions. It respects a session's `session.view` denial: denied sessions are left out and
counted.

The normal output gives a short summary and the limits that still need review. `--json` returns
the inventory object. `--out` creates a new JSON file with mode `0600`, and refuses existing files
and symbolic links, so choose a new path for each observation. Preview files contain project and
access metadata, so keep them with your other private operational records.

## What the preview covers

| Area | Included | Still needed for a transfer |
|---|---|---|
| Project | identity, name and archived state | choose a destination and who will own the moved project |
| Folders | shared hierarchy and item references | check references against a consistent transfer snapshot |
| Sessions | visible current IDs, tools, tool versions and observed durable revisions | export document content and check tool compatibility at the destination |
| Collaboration | the observed active lease for each visible session | arrange a migration window; a preview does not stop editors or move live rooms |
| History | a bounded sample of session-version summaries and the earlier revision retention limit | collect and check the retained history chosen for transfer |
| Files | ready shared-file metadata, declared digests and declared byte totals | read and independently verify bytes, and include every dependency |
| Access | owner and member IDs, roles, expiry and configured group and audience access | map identities and groups explicitly under the destination's policy |

No document inputs, comment bodies, file bytes, credentials, invitation links or agent tokens are
returned. The preview does not resolve DAM assets, open remote URLs, inspect arbitrary session
inputs or check that asset dependencies are complete. Personal device assets, pack assets, catalog
versions, provider permissions and external resources need their own review.

::: note A preview is an observation, not a snapshot or a byte check
The preview reads the project at one moment without a transaction, so edits, uploads, folder moves
and access changes can happen between reads. Declared file sizes and SHA-256 values describe the
upload records; the request does not fetch parts or hash them again, so a matching record is not
evidence that every stored byte is present and intact.
:::

History has two separate stores. Earlier `session_revisions` keeps the newest 20 revisions. Saved
session versions have their own paged history, retention rules and space limits, and the preview
samples at most 100 version summaries per visible session, so a full sample may have more rows
than it shows. Live collaboration also keeps a compacted checkpoint and recovery journal, which is not
a complete edit history. The preview transfers none of these stores.

## Limits and interpretation

The response uses `schema: "lolly-project-transfer-inventory-v1"` and `mode: "preview"`, and always
reports `readOnly: true`, `snapshotConsistent: false`, `complete: false` and
`importReady: false`. `observedAt` records when the observation was made, not a transaction
boundary. `observationSha256` identifies the returned metadata; it does not verify document or file
bytes or authorize a transfer.

The route supports at most 200 current sessions, 2,000 ready files, 1,000 folders and 2,000
explicit members per project. A larger project is refused with `413 INVENTORY_LIMIT`, never
presented as a smaller complete one. These bounds apply to the preview only and do not change
project creation or storage limits.

`counts.omittedSessions` records current sessions the caller's access policy excludes, without
their IDs or content. Archived projects can be inspected. Deleted sessions, unfinished uploads,
revoked links, pending invitations, audit records, personal view preferences and other instance
data are outside the inventory.

Warnings such as `NON_SNAPSHOT`, `ASSET_DEPENDENCIES_NOT_INSPECTED`, `HISTORY_INCOMPLETE`,
`IDENTITIES_REQUIRE_MAPPING` and `FILE_BYTES_NOT_VERIFIED` describe work still required.
`LIVE_COLLABORATION` and `SESSION_ACCESS_OMITTED` report conditions the preview observed. Even a
preview with no active lease needs a coordinated migration: presence, editing claims and
uncommitted gestures do not become transferable records.

Before a move, decide who will own the moved project and how you would undo the move, and test the
destination's own recovery. Related contracts are in [Team projects](team-projects.md),
[Roles and grants](permissions.md), [data lifecycle](data-lifecycle.md) and
[deployment](deployment.md).
