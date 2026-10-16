# Data inventory and account erasure

This inventory describes the local source reviewed on 2026-09-11. The actual SUSE
database, storage regions, receivers, backup service and retention schedule need
confirmation from the deployed environment and service owner. It is an input to
the processing record and rights workflow, not a completed privacy assessment.

| Store / source | Data and purpose | Lifecycle route and limits |
|---|---|---|
| `users`, directory/SCIM and local group membership | Subject/email/name/title, groups, roles, consent and access state | IdP/SCIM is authoritative for managed identity; disable/revoke first. Account erasure removes the local identity row only when references permit. Directory access must also be removed to prevent re-provisioning. |
| `grants`, API/SCIM tokens, device sign-in codes | Authorization principals, credential digests, short-lived sign-in payloads | Revoke/rotate through the identity/token procedures. Review principal references and directory copies separately. Never include live tokens in an access report. |
| `projects`, `sessions`, `session_revisions`, `collab_room_snapshots` | Shared work, arbitrary inputs and metadata, authorship and collaboration history | Transfer business ownership where appropriate. Archiving or session tombstoning retains records and references; it is not erasure. Review shared rights, history and holds before deletion. |
| `session_versions`, `session_version_contents`, `session_version_totals` (plan 76 milestone 4) | Saved versions of a document: its inputs and metadata at that point (stored once per document and content), a kind (automatic, closing, saved, named, restore or the state a restore replaced), an optional name, who created it, and the ids and edit counts of the people and agents who edited since the previous version. Guests are counted together, with no link id | Removed by the retention rules and by a project manager, and all at once when the document is deleted. See [Session versions](#session-versions). Shared records: erasing an account leaves them, and the ids they hold, in place. |
| `project_files` and their parts (`project-file/<id>/<n>` in the blob store) | Files members upload into a team project (often images, possibly personal content and embedded metadata), their names, declared digests, the shell's asset description (kind, format, size in pixels and name) and the uploader | A finished file stays until its uploader or a project manager deletes it; deleting removes the parts, then the row. An unfinished upload expires 15 minutes after its last accepted part, and at the latest after `policy.projectFiles.uploadTtlHours` (24 by default). Once it is an hour past expiry it is removed, parts first, at the next upload or retention run, and by the long-lived server's sweep at boot and daily. A finished file blocks account erasure of its uploader; unfinished uploads are removed by the erasure. Copies already downloaded to members' devices stay there. |
| `canvas_comment_reads`, `canvas_comment_read_floors` (plan 76 milestone 4) | Per person: when they last read each comment thread, and when they first listed a session's comments (older messages count as read). Shown to nobody else | Deleted with the account, the thread or the session row. Never blocks account erasure. |
| `comment_notices` | One inbox notice per person per thread: the ids of the person, thread, session, project, the person who caused the newest event and that message, a kind (mention or reply), a count and the time of the newest event. No comment text and no names: the inbox builds those when it is read | Deleted when the person dismisses it or reads the thread, and when the inbox finds the session deleted or the project out of the person's reach. One hidden by a grant or a policy is kept until it is 30 days old. Notices older than 30 days are removed the next time the person's inbox is read (Lolly checks it once a minute while it is open) or a notice is written for them, and every notice written also removes all but the person's newest 200. Deleted with the account, the thread, the session or the project row. Erasing an account also deletes the notices it caused in other people's inboxes. Never blocks erasure. |
| `comment_mention_sends` | Who was told about a mention in which message (thread, message, person, time), so an edit never notifies anyone twice | Removed again at once when the notice it stood for was not written (over a limit, or a failure), so a later edit can still tell the person. Deleted with the thread and with the person's account. The mention itself is part of the shared thread: a message stores each mentioned person's id and name, as it stores its author's, and erasing an account does not change shared threads. |
| Instance assets, versions, metadata, collections, providers and lifecycle records | Uploaded media, possibly personal content and embedded metadata; publication/approval state | Catalog lifecycle and version retention apply. A hold protects retained assets from version pruning. Neither account removal nor version trimming is a complete content-erasure workflow. |
| `instance_blobs` or configured S3-compatible storage | Asset, render and other stored bytes | Confirm the active blob driver, region, versioning and provider retention. A database-only recovery is insufficient for S3 deployments. Review old object versions and orphaned data. |
| `links`, `approvals`, messages and acknowledgements | Shared targets, review titles/state, communications and identity references | Revoke access and resolve retained records under their approved lifecycle. These can prevent identity-row deletion. External recipients may retain copies. |
| Renders, batches, automation jobs and deliveries | Queries, inputs, outputs, manifests, idempotency/execution records and destination receipts | Review job/output retention, business purpose, blobs and external destinations. Account erasure does not sweep these records. |
| `telemetry_events`, rollups | Optional usage events, whitelisted attributes and optional attribution | First internal profile is off. Disabling collection does not delete old data. Configured telemetry retention trims events; account erasure removes their user-id attribution, not their event payload. |
| Audit log/anchor, SIEM receiver and infrastructure logs | Security/admin activity, actors, subjects, metadata, times, chain evidence and possibly network identifiers | Preserve chain integrity and approved retention/holds. Opaque actor IDs can remain linkable through other records. Off-box copies follow the receiver's approved lifecycle. |
| Fleet clients/installs | Versions/platform, install identifiers, operator labels and last-seen account reference | Inspect and forget installs where appropriate; optional analytics being off does not mean this registry or security logging is off. |
| Browser IndexedDB, Cache Storage, local preferences | Profile/state, uploads and versions, previews, derived media, model files, exports, packs, queued file operations and local identity | Device profile has export and storage-removal controls. Device data, sync history and downloads require their own scope review; server erasure and AI disablement cannot remotely erase every copy. |
| Native shells, local exports, downloads, external delivery recipients | Independent local work and copies outside the service | Confirm whether these clients/flows are allowed in the initial service. Handle through approved endpoint and recipient procedures. |
| Optional CA and MCP services | Enrollment/identity claims, certificates, OAuth state and MCP private file handles | Confirm which services are in scope and their configured stores. MCP file handles use a one-hour access TTL with cleanup on subsequent operations or shutdown; that is not a guarantee of physical deletion at the exact expiry time. Review temporary files, credentials, issued certificates, logs and receivers separately from Work. |
| Backups, snapshots, restore destinations and exported evidence | Recoverable copies of the preceding stores | Agree access, location, retention, holds and restoration restrictions. Record completed erasures outside the restored dataset and reapply them before a recovered service accepts traffic. |

Source anchors: `migrations/0001_init.sql` through
`migrations/0034_audit_mac_and_append_guard.sql`, `migrations/0041_project_files.sql`,
`migrations/0051_canvas_comment_reads.sql`, `migrations/0052_comment_notices.sql`,
`server/src/comments/notices.ts`, `server/src/inbox/comment-notices.ts`,
`server/src/projects/files.ts`, `server/src/store/types.ts`,
`server/src/store/postgres.ts`, the blob/render/delivery modules, and the matching
Lolly shell's `src/bridge/db.ts` and `src/lib/offline-manager.ts`.

## Read-only preview

An owner, or an explicitly authorized `instance.config` principal, can run:

```sh
lw users erase-preview USER_ID --json
```

This calls `GET /api/v1/users/:id/erasure-preview`. It returns counts for projects
(including archived ones), sessions (including tombstones), links (including
expired/revoked ones), approvals, message acknowledgements and finished project files
(`projectFiles`), plus attributed telemetry. It contains no session inputs, messages, prompts, media or credentials.
Comment read state, comment notices and mention sends are not counted: they never block
the removal.
It does not change the account or approve erasure. The response identifies its
scope as `account-identity-and-telemetry-attribution` and explicitly marks
`completePersonalDataErasure=false`.

The preview reflects one read; a concurrent reference may still block a later
deletion. The database enforces that block when deletion is attempted.

## Account removal and rights requests

`lw users erase USER_ID` removes the identity row, de-attributes telemetry and
clears the fleet install rows naming that account in one database transaction.
Migration `0069_fleet_attribution.sql` also clears existing fleet associations whose
account row has already been removed. A reference or a failed telemetry update rolls back the
whole operation. Shared content is never cascaded away to make removal succeed.
The account's unfinished project-file uploads are removed (parts, then rows)
before the identity row goes; its finished project files block the removal like
its sessions do. Its comment read state, the comment notices it received and its
mention sends go with the identity row, and the notices it caused in other people's
inboxes are deleted in the same transaction. The memory store enforces the same reference rules as PostgreSQL. An archived
project still references its owner: transfer the owner or resolve the record's
approved lifecycle; archiving alone does not unblock erasure.

A rights request needs a case record before changing data: verify the requester
and scope, identify sources/recipients, distinguish personal content from shared
business records, assess applicable holds and retention, and obtain the necessary
Privacy decision. Retrieve only the in-scope records for review/redaction and
secure delivery. Use the existing correction, ownership-transfer, access-revocation
and account operations only where they fulfil the approved request.

The current product does not automate a complete subject export, content-wide
erasure, subject-wide legal hold or restore suppression. Define and approve the
manual procedure for the initial data scope, or implement the required additional
controls before permitting that scope. Do not treat a successful account-removal
response as completion of the case. Record remaining exceptions, external recipient
actions and backup handling, then test recovery without resurrecting erased data
before closing the request.

Apart from removing expired unfinished project-file uploads, no new retention
durations or automatic content deletion were introduced. The
service owner and Privacy must approve the schedule, processing record, assessment
outcomes and the treatment of employee data.

## Session versions

A document's history keeps two things. `session_revisions` holds the newest 20
whole-document revisions that older shells read. `session_versions` holds the
versions people see in History: written 2 minutes after live editing pauses (or
every 10 minutes while it continues), when a live document closes, on every save
over the API, when someone saves a named version, and twice for each restore (the
state it replaced, which Undo restores, and the state it produced). A version's
content is stored once per document and content (`session_version_contents`), so
repeated states cost no extra bytes, and an automatic version whose content equals
the newest version is not written at all. `session_version_totals` is one row with
the instance's total of that content, which the instance cap reads; it holds no
document data.

Retention, applied whenever a version is written:

- automatic, closing and saved versions: the newest 50 are kept, plus the newest
  one of each day for the previous 30 days, and none older than 365 days;
- restores: the newest 200 are kept, each with the version it replaced. A replaced
  version whose restore row could not be written (history full, or the server
  stopped) counts as one of those 200 on its own. A restore never removes the
  version it restores from;
- named versions: up to 20 per person and 100 per document, kept until a project
  manager deletes them;
- space: one document's versions may hold at most 100 MiB of distinct content and
  the instance's at most `policy.versions.maxBytes` (1 GiB by default). When a new
  version would pass either cap the oldest automatic versions go first; if that is
  not enough, a named save or a restore is refused (`409 VERSION_SPACE`) and an
  automatic version is skipped.

Content no version uses any more is deleted with the last version that used that content.
Deleting a document deletes all its versions and their content in the same
request, because a deleted document cannot be restored. A project manager can
delete one version (and its restore pair) at any time; the deletion is audited
with the version's id and kind.

Versions hold no email address: the API names people with their first and last
name (or the part of their email before the `@`), agents with their label and
guests as "Guest". Audit entries for saves, restores and deletions hold ids and
counts only, never inputs or names.

Source anchors: `migrations/0053_session_versions.sql`, `server/src/versions/`,
`server/src/collab/rooms.ts` and the version blocks of `server/src/store/types.ts`.

## Activity and new audit data

`policy.activity.mode` controls the activity feed and the agent dashboard:
`off`, `owner-only` or `delegated`. The default remains `delegated`; an employee-only
Helm overlay selects `off` and `activity.auditSessionUpdates: false`. Successful feed
reads are audited with the reader id and the names of requested filters. Filter values
and search text are omitted. Security audit access, fleet views, account access times,
live collaboration and document authorship retain their existing permissions and
records. These switches do not remove every source of individual activity.

New audit entries replace email fields, addresses in actor or subject references,
addresses in other text, and address-shaped payload keys before hashing. A deployment
with an audit MAC key records stable keyed tokens; an unkeyed store omits the addresses.
The tokens change when the deployment key rotates. New rows and forwarded SIEM batches
keep their original chain hashes and MACs. Existing audit rows are retained unchanged,
including any addresses they already contain, and SIEM forwarding does not rewrite
those rows. Their retention and external recipient handling need an approved operator
action. Existing hash-chain and key-retirement procedures still apply.

## Offboarding procedure

1. Remove admission and sign-in access at the authoritative identity provider. Disable
   the local account, revoke sessions, and revoke any separate service or provisioning
   credentials under the existing owner controls.
2. Review the erasure preview and any holds. Transfer shared project ownership where
   approved. Resolve retained sessions, links, approvals, message acknowledgements and
   finished files through their own lifecycle controls; archiving does not erase them.
3. Run `lw users erase-preview USER_ID --json`, then `lw users erase USER_ID` only after
   the approved references have been resolved. A refusal leaves the identity and fleet
   association in place. Success removes the local account, its private credentials and
   ancillary identity rows, telemetry attribution and fleet last-user association.
4. Record remaining audit history, shared content, device caches, recipients and backup
   exceptions in the case. Carry the approved removal record into restore procedures
   before traffic is admitted again.

For a subject access request, gather the approved identity and reference inventory,
shared records in scope and external recipient information through existing authorized
reads. Review and securely deliver that collection under the operator's case process.
There is no complete automatic subject export or content-wide erasure. A successful
account erasure does not complete the wider request.

Retention durations remain unchanged. The deployment owner must supply approved
`policy.retention.auditDays` and `telemetryDays`; the internal overlay leaves those
values unset instead of selecting an unapproved duration.
