# Work storage and data lifecycle

This page is for whoever runs a Lolly Work instance and has to answer two questions: what does the service hold about people, and what happens when someone leaves or asks for their data to be removed?

Lolly Work keeps shared work, uploaded files, comments, saved versions, audit records and optional usage events in its database and file storage. Each kind has its own retention rule, listed below. One command, `lw users erase`, removes a person's account and the records linked to the account. It never deletes shared work to make that possible, and it cannot reach copies on people's devices, in downloads or in backups, so plan for those separately.

Start with [Account data controls](account-lifecycle.md) for the export, offboard and erase commands, then use the inventory below to check each store your deployment turns on.

The inventory describes the product, not one deployment: confirm the database, storage regions, receivers, backup service and retention settings of the server you run. It feeds your organisation's processing record and rights workflow, and it is not a finished privacy assessment. It was first written against the Lolly Work source on 2026-09-11 and has been extended since, so check any newer table in your database against this list.

## What erasing an account changes

`lw users erase USER_ID` runs in one database transaction, and a blocking reference or a failed telemetry update rolls the whole thing back.

| | What it covers |
|---|---|
| **Removed** | The account row and its linked sign-ins, passkeys, access requests and project memberships; the password credentials its sign-ins name; invitations, access requests, passwords and password links for its email address, unless another account still carries that address; the AI agent credentials it created; its pinned and hidden project choices; its comment read state, the notices it received and its mention sends, plus the notices it caused in other people's inboxes; its unfinished project-file uploads and every scoped upload it owns; the user id on its telemetry events; and the fleet last-user association |
| **Must be resolved first** | Projects the account owns (archived ones too), its sessions, links, approvals, message acknowledgements and finished project files. Erasure refuses while any remain, and never deletes them for you |
| **Kept** | Shared history and saved versions, with the ids they hold; comment threads, with authors' and mentioned people's names; collaboration receipts and folder creators, by id; share groups, with the owner cleared; audit rows; and telemetry event payloads, without the user id |
| **Out of reach** | Copies on people's devices, downloads, external recipients, configured providers and backups |

`lw users erase-preview USER_ID --json` shows the blocking references first, without changing anything; see [Read-only preview](#read-only-preview).

## Before you erase

Erasure is the last step of offboarding, after access is removed and the shared records are resolved. [Account data controls](account-lifecycle.md) describes each command in full.

::: timeline
- <!--i:lock--> **Remove access.** Remove admission and sign-in access at the authoritative identity provider, then run `lw users offboard-preview USER_ID --json` and `lw users offboard USER_ID --json`. Offboarding disables the local account, ends its sessions at their next check and revokes the service credentials and links the account issued directly. Revoke any other service or provisioning credentials with the existing owner controls.
- <!--i:folder--> **Resolve shared records.** Review the erasure preview and any holds, and transfer shared project ownership where that is your decision. Resolve retained sessions, links, approvals, message acknowledgements and finished files through their own lifecycle controls; archiving does not erase them.
- <!--i:trash--> **Erase the account.** Run `lw users erase-preview USER_ID --json`, then `lw users erase USER_ID` once those references are resolved. A refusal leaves the identity and fleet association in place. Success removes the local account, its private credentials and its other identity rows, its telemetry attribution and its fleet last-user association.
- <!--i:checklist--> **Record what remains.** Record the remaining audit history, shared content, device caches, recipients and backup exceptions in the case, and carry the removal record into your restore procedure before a recovered service admits traffic again.
:::

## Read-only preview

An owner, or an explicitly authorized `instance.config` principal, can run:

```sh
lw users erase-preview USER_ID --json
```

This calls `GET /api/v1/users/:id/erasure-preview`. It returns counts for projects (archived ones included), sessions (tombstones included), links (expired and revoked ones included), approvals, message acknowledgements and finished project files (`projectFiles`), plus attributed telemetry. It contains no session inputs, messages, prompts, media or credentials. Comment read state, comment notices and mention sends are not counted, because they never block the removal.

The preview does not change the account or approve erasure. Its response gives its scope as `account-identity-and-telemetry-attribution` and marks `completePersonalDataErasure=false`. It reflects one read, so a reference created afterwards can still block the deletion, which the database enforces when deletion is attempted.

## How erasure works

`lw users erase USER_ID` removes the identity row, clears the user id from telemetry and clears the fleet install rows naming that account, in one transaction. Migration `0069_fleet_attribution.sql` also cleared fleet associations whose account row had already been removed. Shared content is never deleted to make removal succeed.

Uploads go first. The account's unfinished project-file uploads are removed, parts and then rows, before the identity row, while its finished project files block the removal as its sessions do. Every scoped upload it owns, finished or not, is removed the same way. The `uploads` table has no foreign key to the account, so the route checks instead: if any upload remains, for example because the person is still uploading, the removal answers `409 ERASE_UPLOADS_REMAIN` and changes no identity or telemetry, so it can run again.

Its comment read state, the comment notices it received and its mention sends go with the identity row, and the notices it caused in other people's inboxes are deleted in the same transaction. The memory store enforces the same reference rules as PostgreSQL. An archived project still references its owner, so transfer the owner or resolve the record's lifecycle; archiving alone does not unblock erasure.

## Rights requests

A rights request needs a case record before any data changes: verify the requester and the scope, identify the sources and recipients, tell personal content apart from shared business records, assess the holds and retention that apply, and record your organisation's decision. Retrieve only the records in scope for review, redaction and secure delivery. Use the existing correction, ownership-transfer, access-revocation and account operations only where they carry out the decision.

For a subject access request, gather the identity and reference inventory (`lw users subject-export USER_ID --category <name> --json` pages through the account's direct metadata), the shared records in scope and the external recipient information, through the existing authorized reads, and deliver that collection securely under your case process.

Neither `lw users subject-export` nor `lw users offboard` completes a request. The product does not automate a complete subject export, content-wide erasure, a legal hold across everything a person touched or keeping erased data out of a restore. Your organisation defines the manual procedure for the data it keeps in Lolly Work, or adds its own controls, before relying on the service for that data. A successful account-removal response does not close the case: record the remaining exceptions, external recipient actions and backup handling, then test recovery without bringing erased data back.

## Where data lives

Open a group to see its stores. Each row gives what the store holds and how it is kept or removed. Retention timings for uploads and versions are under [Retention rules](#retention-rules) and [Session versions](#session-versions).

::: details Identity and access
| Store or source | Data and purpose | Lifecycle and limits |
|---|---|---|
| `users`, directory and SCIM, local group membership | Subject, email, name, title, groups, roles, consent and access state | The identity provider or SCIM is authoritative for managed identity; disable and revoke there first. Account erasure removes the local identity row only when references permit. Remove directory access as well, or the person can be provisioned again. |
| `grants`, API and SCIM tokens, device sign-in codes | Authorization principals, credential digests and short-lived sign-in payloads | Revoke or rotate through the identity and token procedures. Review principal references and directory copies separately. Never include live tokens in an access report. |
| `user_identities`, `password_credentials`, `password_links`, `passkeys`, `invitations`, `access_requests` | Each sign-in linked to an account (the provider's subject); one password per email address, stored as a scrypt hash and never as the password; password setup and reset links; passkey public keys; invitations naming an email address and the groups it joins, with the link version and when it was first opened; and access requests with a verified email address | Account erasure removes the account's linked sign-ins, passkeys and access requests with the identity row. It also removes the password credentials its sign-ins name, and the invitations, access requests, passwords and password links for its email address, unless another account still carries that address. |
| `project_members` | Who belongs to each team project, with their role, who added them and when | Deleted with the account or the project. |
| `document_agents`, `project_agents`, `agent_session_creations` | AI agent credentials a member creates for one document or for a project: a label, a role, a digest of the token, who created it, its expiry and revocation, and which documents a project agent created | Deleted with the member's account, or with the document or project. |
| `oidc_logout_events`, `oidc_logout_targets` | Hashed keys from identity-provider back-channel logout notices, used to refuse a replayed notice and to end the matching sessions. No raw provider identifiers | Each new logout notice deletes replay records older than ten minutes and session targets older than 31 days. |
:::

::: details Shared work, comments and versions
| Store or source | Data and purpose | Lifecycle and limits |
|---|---|---|
| `projects`, `sessions`, `session_revisions`, `collab_room_snapshots` | Shared work, any inputs and metadata, authorship and collaboration history | Transfer business ownership where appropriate. Archiving or tombstoning a session keeps records and references and is not erasure. Review shared rights, history and holds before deletion. |
| `collab_checkpoints`, `collab_journal`, `collab_receipts` | A session's latest live-collaboration checkpoint, the edit operations applied since, and a receipt for each edit with the id of the principal that sent it and a digest | Deleted with the session. Erasing an account leaves the principal ids in place. |
| `share_groups`, `users.share_groups`, `projects.sharing`, `project_members.expires_at` | Groups members create for sharing (name, description, owner, managers and creator), each person's group memberships as ids, a project's share settings and group grants, and end dates on memberships | A group is a shared record: erasing its owner's account clears the owner and keeps the group and its managers. Memberships are ids on the user row and go with that row. An expired membership gives no access; the row is kept so the people panel can offer Extend. |
| `project_user_state` | Per person and project: whether they pinned or hid a shared project in their Projects list, and when they last opened the project. Shown to nobody else | Deleted with the account or the project row. Never blocks account erasure. |
| `project_folders`, `project_folder_items` | Folder names in a team project, who created each folder, and which documents and files each folder holds | Deleted with the project. Erasing an account leaves the creator's id in place. |
| `session_versions`, `session_version_contents`, `session_version_totals` | Saved versions of a document: its inputs and metadata at that point (stored once per document and content), a kind (automatic, closing, saved, named, restore or the state a restore replaced), an optional name, whether it is pinned, who created it and who first named or pinned it, and the ids and edit counts of the people and agents who edited since the previous version. Guests are counted together, with no link id | Removed by the retention rules and by a project manager, and all at once when the document is deleted. See [Session versions](#session-versions). Shared records: erasing an account leaves them, and the ids they hold, in place. |
| `canvas_comment_threads` | Comment threads on a document: each message's text, its author's id and name, and the id and name of each person it mentions | Deleted with the session. Shared records: erasing an account does not change them. |
| `canvas_comment_reads`, `canvas_comment_read_floors` | Per person: when they last read each comment thread, and when they first listed a session's comments (older messages count as read). Shown to nobody else | Deleted with the account, the thread or the session row. Never blocks account erasure. |
| `comment_notices` | One inbox notice per person per thread: the ids of the person, thread, session, project, the person who caused the newest event and that message, a kind (mention or reply), a count and the time of the newest event. No comment text and no names; the inbox builds those when it is read | Deleted when the person dismisses it or reads the thread, and when the inbox finds the session deleted or the project out of the person's reach. One hidden by a grant or a policy is kept until it is 30 days old. Notices older than 30 days are removed the next time the person's inbox is read (Lolly checks it once a minute while it is open) or a notice is written for them, and every notice written also removes all but the person's newest 200. Deleted with the account, the thread, the session or the project row. Erasing an account also deletes the notices it caused in other people's inboxes. Never blocks erasure. |
| `comment_mention_sends` | Who was told about a mention in which message (thread, message, person, time), so an edit never notifies anyone twice | Removed again at once when the notice it stood for was not written (over a limit, or a failure), so a later edit can still tell the person. Deleted with the thread and with the person's account. |
:::

::: details Files and uploads
| Store or source | Data and purpose | Lifecycle and limits |
|---|---|---|
| `project_files` and their parts (`project-file/<id>/<n>` in the blob store) | Files members upload into a team project (often images, possibly personal content and embedded metadata), their names, declared digests, the shell's asset description (kind, format, size in pixels and name) and the uploader | A finished file stays until its uploader or a project manager deletes it; deleting removes the parts, then the row. Unfinished uploads expire and are swept as described under [Retention rules](#retention-rules). A finished file blocks erasure of its uploader's account, while unfinished uploads are removed by the erasure. Copies already downloaded to members' devices stay there. |
| `uploads` and their parts (`upload/<id>/<n>` in the blob store) | Private files a person or a service token uploads as a catalog submission original, an automation input or a file reference, when `policy.uploads.enabled` is on: the bytes, their name, media type, declared digests, scope and owner (`user:<id>` or `service:svc_<id>`). A file reference also records whether it is an output, which of the owner's references it was made from, and the operation report that made it, which lists the input and output files and their digests | Only the owner can name one, and only the owner of a file reference reads one back. Uploads expire and are swept as described under [Retention rules](#retention-rules). Account erasure removes every upload the person owns before the identity row and refuses with `409 ERASE_UPLOADS_REMAIN` if any remain. Bytes already submitted to the catalog follow the catalog lifecycle. |
| Instance assets, versions, metadata, collections, providers and lifecycle records | Uploaded media, possibly personal content and embedded metadata; publication and approval state; reviewed search text (up to 8,192 characters a member read from an asset on their own device, with that member's id and the time) | Catalog lifecycle and version retention apply. A hold protects retained assets from version pruning. Neither account removal nor version trimming is a complete content-erasure workflow. |
| `instance_blobs` or configured S3-compatible storage | Asset, render and other stored bytes | Confirm the active blob driver, region, versioning and provider retention. A database-only recovery is not enough for S3 deployments. Review old object versions and orphaned data. |
| `instance_blob_months` | One row per UTC month: the bytes read from `instance_blobs` and when each [offload alert](operations.md#blob-offload-trigger) email went out. Totals only, with no person, blob or request | Holds nothing personal, so no rights request applies. Rows stay until removed by hand; deleting one only resets that month's figure and lets its alert email be sent again. |
:::

::: details Links, approvals, jobs and delivery
| Store or source | Data and purpose | Lifecycle and limits |
|---|---|---|
| `links`, `approvals`, messages and acknowledgements | Shared targets, review titles and state, communications and identity references | Revoke access and resolve retained records under their lifecycle. These can prevent identity-row deletion. External recipients may keep copies. |
| Renders, batches, automation jobs and deliveries | Queries, inputs, outputs, manifests, idempotency and execution records and destination receipts | Review job and output retention, business purpose, blobs and external destinations. Account erasure does not sweep these records. |
| `automation_callbacks` | For an automation job with a callback: the callback URL, the principal that started the job, delivery state, attempt count and the last status or error | Deleted with its job. Account erasure does not sweep these records. |
:::

::: details Operations, audit and telemetry
| Store or source | Data and purpose | Lifecycle and limits |
|---|---|---|
| `telemetry_events`, rollups | Optional usage events, allowlisted attributes and optional attribution | Collection defaults to `policy.telemetry: "standard"` with `policy.telemetryAttribution: "opt-in"`; `"off"` stores no events. Turning collection off does not delete old data. Configured telemetry retention trims events; account erasure removes their user-id attribution, not their event payload. |
| Audit log and anchor, SIEM receiver and infrastructure logs | Security and admin activity, actors, subjects, metadata, times, chain evidence and possibly network identifiers | Preserve chain integrity and your retention and holds. Opaque actor ids can stay linkable through other records. Copies held elsewhere follow the receiver's lifecycle. |
| Fleet clients and installs | Versions, platform, install identifiers, operator labels and the last account seen | Inspect and forget installs where appropriate. Optional analytics being off does not turn this registry or security logging off. |
:::

::: details Copies outside the service
| Store or source | Data and purpose | Lifecycle and limits |
|---|---|---|
| Browser IndexedDB, Cache Storage, local preferences | Profile and state, uploads and versions, previews, derived media, model files, exports, packs, queued file operations and local identity | The device profile has export and storage-removal controls. Device data, sync history and downloads need their own scope review; server erasure and turning AI off cannot remotely erase every copy. |
| Native shells, local exports, downloads, external delivery recipients | Independent local work and copies outside the service | The server cannot reach these copies. Your organisation decides whether these clients and flows are allowed, and how copies on devices and with recipients are handled. |
| Optional certificate and MCP services | Enrolment and identity claims, certificates, OAuth state and MCP private file handles | Confirm which services are in scope and their configured stores. MCP file handles use a one-hour access lifetime with cleanup on later operations or shutdown, which does not guarantee physical deletion at the exact expiry time. Review temporary files, credentials, issued certificates, logs and receivers separately from Work. |
| Backups, snapshots, restore destinations and exported evidence | Recoverable copies of the stores above | Agree access, location, retention, holds and restore restrictions. Record completed erasures outside the restored data, and apply them again before a recovered service accepts traffic. |
:::

::: details Source anchors
`migrations/0001_init.sql` through `migrations/0034_audit_mac_and_append_guard.sql`, `0035_collab_receipts.sql`, `0036_collab_journal.sql`, `0038_invitations.sql`, `0039_user_identities.sql`, `0040_project_members.sql`, `0041_project_files.sql`, `0042_password_credentials.sql`, `0043_invitation_links.sql`, `0044_access_requests.sql`, `0045_canvas_comments.sql`, `0047_project_folders.sql`, `0048_passkeys.sql`, `0049_document_agents.sql`, `0050_project_agents.sql`, `0051_canvas_comment_reads.sql`, `0052_comment_notices.sql`, `0060_share_ladder.sql`, `0061_project_user_state.sql`, `0067_oidc_logout.sql`, `0074_automation_callbacks.sql`, `0075_resumable_uploads.sql` and `0076_file_references.sql`; `server/src/catalog/text-index.ts`, `server/src/uploads/scoped.ts`, `server/src/uploads/files.ts`, `server/src/comments/notices.ts`, `server/src/inbox/comment-notices.ts`, `server/src/projects/files.ts`, `server/src/store/types.ts`, `server/src/store/postgres.ts`, the blob, render and delivery modules, and the matching Lolly shell's `src/bridge/db.ts` and `src/lib/offline-manager.ts`.
:::

## Retention rules

Your organisation decides its own retention schedule, processing record and assessment outcomes, including how it treats its staff's data. The product's built-in durations are these.

### Uploads

Scoped uploads exist only on an instance that turns on `policy.uploads.enabled`, which is off by default. Project files are on by default (`policy.projectFiles.enabled`).

::: timeline
- <!--i:upload--> **Parts arrive.** An upload stays unfinished until its last part arrives. An unfinished upload of either kind expires 15 minutes after its last accepted part, and at the latest `policy.projectFiles.uploadTtlHours` or `policy.uploads.uploadTtlHours` (24 by default) after it began.
- <!--i:clock--> **A finished upload waits.** A finished scoped upload expires `policy.uploads.readyTtlHours` (24 by default, at most 720) after it finished, and a file reference `policy.uploads.fileTtlHours` (168 by default, at most 720). A catalog submission deletes its scoped upload as soon as the submission is stored. A finished project file has no expiry.
- <!--i:trash--> **An hour past expiry, it is swept.** An upload of either kind is deleted, parts first, once it is an hour past its expiry: before the next upload of its kind, in `POST /api/v1/retention/run`, and at start-up and daily on the long-lived server.
:::

### Audit and telemetry

`policy.retention.auditDays` and `policy.retention.telemetryDays` default to `0`, which keeps everything; Lolly Work does not pick a duration for you. Comment notices have their own fixed limits, given in the inventory above.

## Session versions

A document's history keeps two things. `session_revisions` holds the newest 20 whole-document revisions, which older shells read. `session_versions` holds the versions people see in History.

A version is written 2 minutes after live editing pauses (or every 10 minutes while it continues), when a live document closes, on every save over the API (including each session a bulk edit changes), when someone saves a named version, and twice for each restore: once for the state it replaced, which Undo restores, and once for the state it produced. A version's content is stored once per document and content (`session_version_contents`), so repeated states cost no extra bytes, and an automatic version whose content equals the newest version is not written at all. `session_version_totals` is one row with the instance's total of that content, which the instance cap reads; it holds no document data.

Retention, applied whenever a version is written:

- automatic, closing and saved versions: the newest 50 are kept, plus the newest one of each day for the previous 30 days, and none older than 365 days;
- restores: the newest 200 are kept, each with the version it replaced. A replaced version whose restore row could not be written (history full, or the server stopped) counts as one of those 200 on its own. A restore never removes the version it restores from;
- named versions: up to 20 per person and 100 per document, kept until a project manager deletes them. A version someone names or pins later is kept the same way and counts against those limits for that person, until its name and pin are removed; it then follows the rules for its kind again;
- space: one document's versions may hold at most 100 MiB of distinct content, and the instance's at most `policy.versions.maxBytes` (1 GiB by default). When a new version would pass either cap, the oldest automatic versions that nobody named or pinned go first; if that is not enough, a named save or a restore is refused (`409 VERSION_SPACE`) and an automatic version is skipped.

Content no version uses any more is deleted with the last version that used that content. Deleting a document deletes all its versions and their content in the same request, because a deleted document cannot be restored. A project manager can delete one version (and its restore pair) at any time, and the deletion is audited with the version's id and kind.

[History across documents](api.md#history-across-documents) lists one person's readable versions from many documents at once, without their content. It stores nothing new: an index on the version time (migration 0076) serves its order.

Versions hold no email address. The API names people by their first and last name (or the part of their email before the `@`), agents by their label and guests as "Guest". Audit entries for saves, name and pin changes, restores and deletions hold ids, counts and the pin, never inputs or names.

Source anchors: `migrations/0053_session_versions.sql`, `migrations/0072_session_version_annotations.sql`, `migrations/0076_session_version_history.sql`, `server/src/versions/`, `server/src/collab/rooms.ts` and the version blocks of `server/src/store/types.ts`.

## Activity and new audit data

`policy.activity.mode` controls the activity feed and the agent dashboard: `off`, `owner-only` or `delegated`. The default is `delegated`, with `activity.auditSessionUpdates: true`. To show and record less individual activity, select `off` (no activity feed or agent dashboard) and set `activity.auditSessionUpdates: false` (no `session.update` audit event for routine API document saves). Successful feed reads are audited with the reader's id and the names of the filters requested; filter values and search text are left out. Security audit access, fleet views, account access times, live collaboration and document authorship keep their existing permissions and records, so these switches do not remove every source of individual activity.

New audit entries replace email fields, addresses in actor or subject references, addresses in other text and address-shaped payload keys before hashing. A deployment with an audit MAC key records stable keyed tokens, and an unkeyed store leaves the addresses out. The tokens change when the deployment key rotates. New rows and forwarded SIEM batches keep their original chain hashes and MACs. Existing audit rows are kept unchanged, including any addresses they already contain, and SIEM forwarding does not rewrite them; their retention and external recipient handling are your decision. The existing hash-chain and key-retirement procedures still apply.
