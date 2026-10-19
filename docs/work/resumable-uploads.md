# Resumable uploads

Decision record, 2026-10-17. It chooses the protocol for every upload into Lolly
Work that may be larger than one request, and defines the shared primitive that project
files, catalog submission, session staging and automation share. The routes are in
the [API reference](api.md#project-files) and the limits in
[configuration](configuration.md#policy).

## Context

Work takes files in from four places:

- **Project files.** Members share files inside a team project. They are also how a
  session stages its images: a session saved in a project identifies each image as a
  project file (`user/team/<file id>`), so every member who opens it gets the same
  bytes, and a render reads them through its read ticket. An earlier design for a
  separate per-session relay was never built; project files took its place.
- **Catalog submission.** `POST /api/v1/catalog/submit` took the file as one request
  body, up to `policy.submit.maxBytes`, or a finished project file by reference.
- **Automation.** `/api/v1/inspect` and `/api/v1/optimize` took the bytes as base64
  inside a JSON body (`bytesBase64`), or a provider `source`.

Project files already used a parts protocol: the begin declares the size, the whole
file's sha256 and one sha256 per 1 MiB part; parts arrive in any order; finalize
checks everything. Two things were missing. A client that lost its place could not
ask which parts had arrived, so an interrupted upload started over. And migration
0041 capped a project file at 256 MiB. Catalog submission and automation had no way
to send a file larger than one request at all.

The constraints that decide the protocol:

- Request bodies are capped in front of Work. A Vercel function takes at most 4.5 MB,
  nginx defaults to 1 MB and ingress controllers set their own limits.
- Every BlobStore driver stores whole objects by id: a Postgres row per blob, an S3
  object per key. None can append to an existing blob, and S3 multipart parts must be
  at least 5 MiB except the last.
- Replicas share the database and the blob store, not memory.
- The Lolly shell already speaks the parts protocol for project files.

## Options

### A tus 1.0 subset

[tus](https://tus.io/protocols/resumable-upload) creates an upload with `POST`
(`Upload-Length`, `Upload-Metadata`), reports progress with `HEAD`
(`Upload-Offset`), and appends with `PATCH` at that offset. Extensions add expiry
(`Upload-Expires`), per-request checksums (`Upload-Checksum`), termination
(`DELETE`) and parallel partial uploads joined by concatenation.

Adopting it here would mean:

- A `PATCH` carries bytes at an offset of the client's choosing, and a server may keep
  part of a body when the connection drops. With whole-object drivers, Work would
  have to hold an incomplete part somewhere until the rest arrives, or refuse every
  `PATCH` that does not end on a part boundary. Either way the stored unit would stop
  being a part checked against its declared digest.
- The checksum extension is optional per request, and sha1 is the algorithm a server
  must support. Work checks sha256 before it stores a byte and binds every part to a
  digest declared at the begin.
- Core tus sends one `PATCH` at a time at the current offset. Parallel parts need the
  concatenation extension, a second resource model.
- Its headers (`Tus-Resumable`, `Upload-Offset`, `Upload-Length`, `Upload-Metadata`)
  need CORS exposure and pass-through by every proxy in front of Work.
- The shell would need a second upload client beside the one it has.

### The parts protocol with a resume report

Keep begin, parts and finalize, and add a report of which parts are stored. Take
from tus the ideas that apply: a declared length and metadata at the begin, an
offset to carry on from, an expiry the client can read, and termination by `DELETE`.

## Decision

Work keeps the parts protocol and adds the resume report. It does not adopt tus.

- Only bytes that match a declared digest are ever stored, and the unit stored is the
  unit checked. No driver needs to append.
- A part is 1 MiB, under every request cap above, so the same client works on Vercel,
  behind nginx and on Kubernetes.
- Parts can be sent in parallel, in any order and again after a failure, with no
  extra resource model.
- The shell keeps its existing client; resuming is one extra request.

The resume report answers `GET .../parts` with the parts still `missing`, the
`receivedParts` and `receivedBytes`, and `offset`: the bytes in the run of stored
parts from the start, which is what tus calls `Upload-Offset`. It also gives
`expiresAt`, the equivalent of `Upload-Expires`. Asking does not keep an upload
alive; only an accepted part does.

## One primitive, four scopes

`server/src/uploads/parts.ts` is the shared primitive: the manifest rules, storing a
verified part, the resume report, the running digest that spares finalize a second
read, the finalize check and the verified read. Each scope keeps its own record,
authorization, budget and lifetime for the shared upload process.

| Scope | Record | Who may begin | Who may send, resume and finish | Lifetime | Used by |
|---|---|---|---|---|---|
| Project file, and so a session's staged images | `project_files` | an editor of the project with `session.create` | the uploader | until deleted | the project's file list and downloads, sessions saved in the project, renders through their read ticket, catalog submission by `projectId` and `fileId` |
| Catalog submission original | `uploads`, scope `catalog-submission` | a person or a service token with `catalog.submit` | the owner | `policy.uploads.readyTtlHours` after it finished | `POST /api/v1/catalog/submit?uploadId=…&checksum=…`, which removes it once the submission is stored |
| Automation input | `uploads`, scope `automation-input` | a person or a service token with `tool.use` | the owner | `policy.uploads.readyTtlHours` after it finished | `upload: { id, checksum }` in `/api/v1/inspect` and `/api/v1/optimize`, as often as the owner likes |
| [File reference](api.md#file-references) | `uploads`, scope `file` | a person or a service token with `tool.use` | the owner | `policy.uploads.fileTtlHours` after it finished | `file: { id, checksum }` in `/api/v1/inspect` and `/api/v1/optimize`, and reading it back from `/api/v1/files/:id/content`, by the owner while they hold `tool.use` |

A scoped upload is named by reference only, and only by its owner. A reference
carries the checksum too, so an id cannot stand in for other bytes. Any reference
its owner cannot use (another owner's, another scope's, an unfinished or expired
one) gets the same `404`, so ids reveal nothing. Nobody downloads a catalog
submission original or an automation input; a file reference is the one scope its
owner reads back.

A session-scoped area that expires with its session, if one is wanted, would be one
more scope on the `uploads` table over the same primitive.

## Limits, budgets and expiry

- **Off until turned on.** Scoped uploads need `policy.uploads.enabled`, which is
  `false` by default, and upgrading leaves it off. Their instance budget is separate
  from the project files' one but fills the same blob store, so turning them on raises
  what the store may hold by `policy.uploads.instanceBudgetBytes` (256 MiB by default).
  [Configuration](configuration.md#policy) shows how to split one total between the
  two instead. Project files keep their own setting, on by default where the store is
  durable.
- **Ceiling.** Migration 0075 replaces 0041's 256 MiB size check with 4 GiB for both
  tables: 4096 parts, whose declared digests still fit the 512 KiB begin body. The
  configured caps can only be lower and keep their small defaults:
  `policy.projectFiles.maxFileBytes` (25 MiB) and `policy.uploads.maxFileBytes`
  (64 MiB). A catalog original is also capped at `policy.submit.maxBytes`.
- **Reserved at the begin.** The whole declared size counts toward the budgets the
  moment an upload begins: the project and instance budgets for project files, the
  owner and instance budgets for scoped uploads. A file reference's `derivedFrom` and
  report count too, at their size as JSON. Nobody holds more than 16 unfinished
  uploads at once. A stalled upload therefore never holds more than it declared, and
  an expired one counts for nothing.
- **Resume window.** An unfinished upload stays resumable until 15 minutes after its
  last accepted part, and never later than `uploadTtlHours` after its begin (24 hours
  by default for both scopes). After that the client starts again. An hour past
  expiry the sweep removes the parts, then the row: before each new begin, in
  `POST /api/v1/retention/run`, and daily on the long-lived server.
- **Erasure.** Erasing an account removes the person's unfinished project uploads and
  every scoped upload they own, however many there are. The `uploads` table has no
  foreign key to the account, so if any upload remains, for example because the person
  is still uploading, the erasure answers `409 ERASE_UPLOADS_REMAIN` before it changes
  the account and can be run again. A revoked service token can no longer name its
  uploads, which expire on schedule.

## Resuming from a client

1. Before sending a part, keep the upload id with the file's digest.
2. After an interruption, ask `GET .../parts`.
3. Send each part in `missing`, then finalize. A finalize that answers
   `409 UPLOAD_INCOMPLETE` means a part is still missing: ask again.
4. On `404` or `410` the upload is gone or expired: begin again.

`lw upload <file> --project <id>` or `--scope catalog-submission|automation-input`
does this. It reads the file one part at a time and keeps each unfinished upload's id
under `~/.config/lolly-work/uploads/`; running the same command again carries on.

## Consequences

- A tus client cannot talk to Work directly. If one is needed, a translation layer
  could accept `PATCH` requests that end on part boundaries and store them as parts.
  None is built.
- The resume report reads one blob stat per part, eight at a time, so a 4 GiB upload
  costs 4096 stats to report on.
- Catalog submission and the document verbs still read the whole file into memory to
  process it, bounded by `policy.submit.maxBytes` and `policy.uploads.maxFileBytes`.
  Resumable transfer does not make those consumers stream.
- Parts are separate blobs, so the Postgres driver's 500 MiB limit on one blob does
  not limit a file. The default budgets stay sized for a small hosted Postgres that
  also holds the bytes; raise them only with the storage to match.

## Verification

- `tests/upload-parts.test.ts`: the primitive on its own, including a store that
  reports an ETag in place of a sha256.
- `tests/resumable-uploads.test.ts`: the resume report on project files, the scoped
  routes and their access rules, budgets, the default that leaves them off, both
  consumers, erasure past one batch and its refusal while uploads remain, the sweeps, the
  `lw upload` client carrying on after a dropped connection, and an interrupted
  500 MiB upload that finishes after the per-file cap is lifted, through a restarted
  server that reads every part back. With `LW_TEST_DATABASE_URL` it also runs the
  record rules, the new size checks and a resumed upload on Postgres.
- `tests/upload-store-conformance.ts`: one set of record rules for the memory and
  Postgres stores.
