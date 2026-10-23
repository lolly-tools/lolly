# Upload large files

Send a large file to Lolly Work in parts that survive a dropped connection or a server restart.
After an interruption you ask which parts arrived and send only the rest, so a long upload
never starts over from the beginning. Work checks every part against the checksum you declared
before storing the part.

Three kinds of upload use the same parts:

- **Project files.** Members share files inside a team project, and a session saved in a project
  keeps its images there (`user/team/<file id>`), so every member who opens it gets the same
  bytes and a render reads them through its read ticket.
- **Catalog submission.** An original for `POST /api/v1/catalog/submit`.
- **Automation input.** The bytes for `/api/v1/inspect` and `/api/v1/optimize`, as an upload or a
  readable [file reference](api.md#file-references).

![A resumable upload: begin with the size and checksums, send 1 MiB parts in any order, ask what arrived after a drop, send only the missing parts, then finalize, where every byte is checked.](/info/diagrams/work-integrations/upload-parts.svg)

## Turn scoped uploads on

Project files are on by default wherever the blob store is durable. Catalog submissions and
automation inputs use **scoped uploads**, which are off until you turn on
`policy.uploads.enabled`; upgrading leaves them off. Until then, `lw upload --scope` answers
`uploads are off`.

Scoped uploads have their own instance budget, `policy.uploads.instanceBudgetBytes` (256 MiB by
default), but they fill the same blob store as project files. Turning them on therefore raises
what the store may hold by that budget. [Configuration](configuration.md#policy) shows how to
split one total between the two instead.

## Upload with `lw`

```bash
lw upload ./keynote.mp4 --project prj_ab12        # a shared file in a project
lw upload ./master.tif --scope catalog-submission  # an original to submit to the catalog
```

`lw upload` reads the file one part at a time and keeps each unfinished upload's id under
`~/.config/lolly-work/uploads/`. If it stops, run the same command again and it carries on.
Every option and scope is on the [`lw` CLI page](cli.md#resumable-uploads).

## Upload from your own client

1. **Begin.** Declare the size, the whole file's SHA-256 and one SHA-256 per 1 MiB part. Keep the
   upload id with the file's checksum before you send a part.
2. **Send the parts,** in parallel, in any order and again after a failure.
3. **After an interruption,** ask `GET .../parts`. The answer lists the parts still `missing`,
   `receivedParts` and `receivedBytes`, the `offset` (the bytes in the unbroken run of stored
   parts from the start) and `expiresAt`. Asking does not keep an upload alive; only an accepted
   part does.
4. **Send each missing part, then finalize.** A finalize that answers `409 UPLOAD_INCOMPLETE`
   means a part is still missing: ask again. A `404` or `410` means the upload is gone or
   expired: begin again.

The routes are in the [API reference](api.md#project-files). A scoped upload finishes with an id
and a checksum to name it by, for example
`POST /api/v1/catalog/submit?name=…&uploadId=…&checksum=…`.

## Limits and expiry

| Limit | Default | Notes |
|---|---|---|
| Largest file | 25 MiB for project files, 64 MiB for scoped uploads | `policy.projectFiles.maxFileBytes` and `policy.uploads.maxFileBytes`, which can only be set lower than the 4 GiB ceiling. A catalog original is also capped at `policy.submit.maxBytes`. |
| Ceiling | 4 GiB | 4,096 parts, whose declared checksums still fit the 512 KiB begin request. |
| Unfinished uploads | 16 per person | Counted separately for project files and for scoped uploads. |
| Resume window | 15 minutes after the begin or the last accepted part | And never later than `uploadTtlHours` after the begin (24 hours by default). |
| Finished scoped upload | 24 hours (`policy.uploads.readyTtlHours`) | 168 hours for a file reference (`policy.uploads.fileTtlHours`). A project file lasts until deleted. |

The whole declared size counts toward the budgets as soon as an upload begins: the project and
instance budgets for project files, the owner and instance budgets for scoped uploads. A file
reference's `derivedFrom` and report count too, at their size as JSON. A stalled upload never
holds more than it declared, and an expired one counts for nothing.

An hour after an upload expires, the sweep removes its parts and then its record. The sweep runs
before each new begin, in `POST /api/v1/retention/run`, and daily on a long-lived server.

## Who can read what

| Upload | Who may begin | Who may send, resume and finish | Used by |
|---|---|---|---|
| Project file (and a session's staged images) | an editor of the project with `session.create` | the uploader | the project's file list and downloads, sessions saved in the project, renders through their read ticket, catalog submission by `projectId` and `fileId` |
| Catalog submission original | a person or a service token with `catalog.submit` | the owner | `POST /api/v1/catalog/submit?uploadId=…&checksum=…`, which removes the upload once the submission is stored |
| Automation input | a person or a service token with `tool.use` | the owner | `upload: { id, checksum }` in `/api/v1/inspect` and `/api/v1/optimize`, as often as the owner likes |
| [File reference](api.md#file-references) | a person or a service token with `tool.use` | the owner | `file: { id, checksum }` in the same routes, and reading it back from `/api/v1/files/:id/content` while the owner holds `tool.use` |

A scoped upload is named by reference only, and only by its owner. The reference carries the
checksum too, so an id cannot stand in for other bytes. Any reference the owner cannot use
(another owner's, another scope's, unfinished or expired) gets the same `404`, so ids reveal
nothing. Nobody downloads a catalog submission original or an automation input; a file reference
is the one kind its owner reads back.

A service token can use scoped uploads; a project file needs a signed-in person. A revoked
service token can no longer name its uploads, which then expire on schedule.

**Erasing an account** removes that person's unfinished project uploads and every scoped upload
they own. If any remains, for example because the person is still uploading, the erasure answers
`409 ERASE_UPLOADS_REMAIN` before it changes the account, and can be run again.

## Why parts, not tus

::: details The decision, recorded on 2026-10-17
Project files already used begin, parts and finalize. Two things were missing: a client that lost
its place could not ask which parts had arrived, and migration 0041 capped a project file at
256 MiB. Catalog submission and automation had no way to send a file larger than one request.

The constraints that decided the protocol:

- Request bodies are capped in front of Work: a serverless function host can cap a request at
  4.5 MB, nginx defaults to 1 MB and ingress controllers set their own limits.
- Every blob store driver stores whole objects by id (a Postgres row per blob, an S3 object per
  key). None can append, and S3 multipart parts must be at least 5 MiB except the last.
- Replicas share the database and the blob store, not memory.
- The Lolly shell already spoke the parts protocol for project files.

[tus 1.0](https://tus.io/protocols/resumable-upload) creates an upload with `POST`, reports
progress with `HEAD` and appends with `PATCH` at an offset, with extensions for expiry,
per-request checksums, termination and parallel uploads joined by concatenation. Adopting it
would have meant:

- A `PATCH` carries bytes at an offset the client chooses, and a server may keep part of a body
  when the connection drops. With whole-object drivers, Work would have to hold an incomplete
  part until the rest arrived, or refuse every `PATCH` not ending on a part boundary. Either way
  the stored unit would stop being a part checked against its declared checksum.
- The checksum extension is optional per request, and SHA-1 is the algorithm a server must
  support. Work checks SHA-256 before it stores a byte, against a checksum declared at the begin.
- Core tus sends one `PATCH` at a time; parallel parts need the concatenation extension, a second
  resource model.
- Its headers need CORS exposure and pass-through by every proxy in front of Work.
- The shell would need a second upload client.

So Work kept the parts protocol and added the resume report, taking from tus the ideas that
apply: a declared length and metadata at the begin, an offset to carry on from (`offset` is what
tus calls `Upload-Offset`), a readable expiry (`expiresAt`, like `Upload-Expires`) and
termination by `DELETE`. Only bytes that match a declared checksum are stored, the unit stored is
the unit checked, and no driver needs to append. A 1 MiB part is under every request cap above,
so one client works on a serverless host, behind nginx and on Kubernetes. Migration 0075 replaced
0041's 256 MiB check with the 4 GiB ceiling for both tables.

`server/src/uploads/parts.ts` is the shared primitive: the manifest rules, storing a verified
part, the resume report, the running checksum that spares finalize a second read, the finalize
check and the verified read. Each kind of upload keeps its own record, authorization, budget and
lifetime. A session-scoped area that expires with its session would be one more scope on the
same primitive.

What follows from the decision:

- A tus client cannot talk to Work directly. A translation layer could accept `PATCH` requests
  that end on part boundaries and store them as parts; none is built.
- The resume report reads one blob stat per part, eight at a time, so reporting on a 4 GiB
  upload costs 4,096 stats.
- Catalog submission and the document routes still read the whole file into memory to process
  it, bounded by `policy.submit.maxBytes` and `policy.uploads.maxFileBytes`. Resumable transfer
  does not make them stream.
- Parts are separate blobs, so the Postgres driver's 500 MiB limit on one blob does not limit a
  file. The default budgets stay sized for a small hosted Postgres that also holds the bytes;
  raise them only with the storage to match.

The behaviour is pinned by `tests/upload-parts.test.ts` (the primitive, including a store that
reports an ETag in place of a SHA-256), `tests/resumable-uploads.test.ts` (the resume report,
scoped routes and access rules, budgets, the off default, both consumers, erasure, the sweeps,
`lw upload` carrying on after a dropped connection, and an interrupted 500 MiB upload finishing
through a restarted server, also on Postgres with `LW_TEST_DATABASE_URL`) and
`tests/upload-store-conformance.ts` (one set of record rules for the memory and Postgres stores).
:::
