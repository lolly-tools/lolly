# Lolly and Work 1.1.2

Work 1.1.2 pairs the Work server and render worker with
[Lolly 1.1.2](https://github.com/lolly-tools/lolly/releases/tag/v1.1.2), built from
Lolly source `e8dc4609f60e40e6e94ca9cd9624675abc9796c6`. It is published as
[Work v1.1.2](https://github.com/lolly-tools/lolly-work/releases/tag/v1.1.2).
Installation and production acceptance are tracked separately.

Start with the tagged [installation guide](https://github.com/lolly-tools/lolly-work/blob/v1.1.2/docs/install.md),
[deployment options](https://github.com/lolly-tools/lolly-work/blob/v1.1.2/docs/deployment.md)
and [documentation index](https://github.com/lolly-tools/lolly-work/blob/v1.1.2/docs/README.md).

## Matching components

| Component | Version or source |
|---|---|
| Lolly product version | 1.1.2 |
| Work application | 1.1.2 |
| Work Helm chart | 0.3.3; appVersion 1.1.2 |
| Lolly source | e8dc4609f60e40e6e94ca9cd9624675abc9796c6 (Lolly main; the 1.1.2 release commit replaces this before the tag) |
| Engine | 1.280.0 |
| Tool-author core | 1.5.0 |
| Lolly web archive for YunoHost | No new archive. `lolly-web-1.1.1-ynh1.tar.gz` stays current, SHA-256 `bc78012aa407983ecc818e63be98ae1b45ed7db1dcad3f4c8d4ffe0c371116c1` |

Engine and core versions describe their own contracts and are not reset to the
product version. `engine-pin.json` and `content-resolver-pin.json` record the
Lolly source above. The maintained producers generated both.

Work 1.1.1 carried engine 1.261.0 and core 1.4.0. Design 1.51.0 needs engine 1.263.0
or later and Strip Hidden Data 1.4.0 needs engine 1.264.0 or later wherever they
render, so a Work 1.1.1 server refuses to load either tool.

## What Lolly 1.1.2 needs from this release

Lolly 1.1.2 lists these features as needing Lolly Work. Against a Work 1.1.1 server
they stay hidden or fail as described in the Lolly notes.

- **Shared library browsing.** `GET /api/v1/catalog/assets` takes `scope=shared`,
  up to 16 `types` and a `taxonomyKind` with `taxonomyId` (section, collection or
  folder). Answers report each source's sync status (`sources`, `complete`) and
  `capabilities.indexedFilters`; Lolly shows its **Shared library** section only when
  that capability is present, and reads 100 records a page (the server allows 500).
  Search caps `q` at 300 characters and takes `scope=shared` and `source`. Paging,
  tag, type and source filters and the paged asset index existed in 1.1.1. The paged
  index now lists sources that have not synced yet under `pendingProviders` instead of
  waiting for them, and signed and hash-addressed index requests honour `paged=1`.
  The index is bounded only for sources with more than
  `catalogServing.pagedProviderThreshold` assets (2,000 by default).
- **Reviewed search text.** `PUT /api/v1/catalog/text-index/<id>` stores up to 8,192
  characters that a member reviewed on their own device, for an `ext/*` or `inst/*`
  asset the caller can see. It needs `catalog.edit`. Longer text is refused, not cut,
  and `text: null` clears the entry. The text is bound to the source revision and
  file it was read from; once either changes, it stops matching browse and search. A
  stale revision answers `409 SOURCE_CHANGED`. Work never runs text recognition
  itself. Editing organisation metadata (`catalog.edit`) was already in 1.1.1.
- **Shared project files into the library.** `POST /api/v1/catalog/submit` with
  `projectId`, `fileId` and `checksum` submits a file from a shared project. It needs
  `catalog.submit` and current access to the project; service tokens are refused.
  `groups` sets the library audience: left out, every member of the workspace;
  otherwise only groups the submitter belongs to. Work checks the SHA-256 of every
  stored part and of the whole file, then runs the usual scan, quota and review
  steps. Listing projects and copying a file into a project use routes from 1.1.1.
- **Source review.** `POST /api/v1/approvals` accepts `subjectType: "source-review"`
  for 1 to 32 instance-owned originals, with a purpose and a target. Work reads the
  bytes again and checks them (64 MiB per file, 128 MiB in all), and an approval
  chain must exist. Version history advertises `sourceReviewCapability`
  (`frozen-instance-originals-v1`) only for instance-owned assets with no provider
  origin, so **Request source review** appears only there. Files copied in from a
  provider, and renditions, answer `409 SOURCE_UNAVAILABLE`.
- **Live shared sessions in the desktop and mobile apps.** New
  `POST /api/v1/collab/sessions/:id/socket-ticket` issues a one-use ticket for one
  room, valid for 30 seconds, which the apps send as a WebSocket subprotocol. It needs
  a signed-in member with access to the session and the `collab.join` grant. Where no
  collaboration gateway runs, such as the Vercel function, it answers
  `501 UNAVAILABLE`. Tickets are held in memory, so the ticket request and the socket
  upgrade must reach the same process.
- **App sign-in to a private Work server.** The device sign-in routes are unchanged
  from 1.1.1. Lolly 1.1.2 fixes the lost session in the apps themselves. Work 1.1.2
  keeps the `/activate?code=` code through the browser sign-in round trip.
- **Guest landing.** A browser that opens a guest edit link (`GET /l/:id?s=`) now
  gets a page without scripts that shows the inviter, the tool and the end time in
  UTC, with a name field and, when the link has one, a password field. That request
  sets no cookie and writes no audit entry. The form posts to the same address,
  checks the password with the existing lockout, sets `lw_guest`, writes one
  `guest.admit` audit entry and redirects to the tool in the web app. The server still
  limits the guest to that link's tool. A link whose guest links are turned off, or
  whose maker can no longer create them, answers `403 GUEST_LINK_UNAVAILABLE`.
  Clients that do not ask for HTML keep the JSON answers.
- **Model downloads through Work.** When Work serves the shell (`instance.shellDir`),
  `GET` and `HEAD` for `/models/<family>[@<hash>]/<file>` are answered from the shell
  directory first and otherwise streamed from `instance.modelOrigin`. The default is
  `https://lolli.li`; `null` turns the proxy off. Only an exact HTTPS origin is
  accepted, or a loopback `http://` origin for testing. Ranges and validators pass
  through, hash-addressed paths are cached as immutable, and Work keeps no copy. The
  route has no size limit, type list or sign-in check, so by default Work makes
  outbound requests to lolli.li for any visitor. Set `null`, or a mirror you run, on
  installations that restrict outbound traffic. See [configuration](configuration.md).
- **Collaboration claims for Scale and keyframes.** Work's collaboration gateway
  checks claims with the vendored core. Core 1.5.0 lets a move or scale claim cover
  an object's keyframe track and the content fields a Scale writes, and adds the
  `'scale'` preview kind. A Work 1.1.1 server, built with core 1.4.0, sees Scale
  previews as resizes.

## Other changes since 1.1.1

- **Cloudinary and Orange Logic sources.** Two new catalog provider kinds,
  `cloudinary` and `orange-logic`, configured like the other sources. Orange Logic
  serves renditions only, so a cutover from it answers `422 ORIGINALS_UNAVAILABLE`.
  Both drivers are tested against recorded fixtures, not a live tenant. See
  [providers](providers/README.md).
- **Byte ranges on `/catalog/ext`.** A single `Range` request gets `206` when the file
  is in the memory cache or the source supports ranges (Orange Logic today). Every
  part repeats the sign-in, exposure, source and lifecycle checks. Pinned local copies,
  `HEAD` and previews still return the whole file.
- **History across documents.** `GET /api/v1/history` lists versions across the
  documents a signed-in person can see, 50 at a time by default (at most 100), with
  project, tool, kind, kept, date and archive filters. Entries carry no content or
  email addresses.
- **Named and pinned versions.** `PATCH /api/v1/sessions/:id/versions/:versionId`
  sets a label or pin, guarded by `annotationRev` (`409 VERSION_CHANGED`). Each person
  can keep 20 versions and each document 100. Retention and space eviction never
  remove a named or pinned version.
- **One commit per save.** Saving a session writes its head, revision, version and
  audit event in one transaction, for single saves, bulk applies, room recovery and
  restores without a gateway. A bulk apply now also writes a `save` version for each
  session it changes. On gateway deployments, restores and room write-backs still use
  the room path.
- **Resumable uploads.** Uploads travel as checksummed 1 MiB parts. Project files
  report missing parts, and their hard ceiling rises from 256 MiB to 4 GiB (the
  default limit stays 25 MiB). New `/api/v1/uploads` routes feed catalog submissions,
  inspect and optimize. They are off by default: `policy.uploads.enabled` is false,
  with 64 MiB per file, 128 MiB per owner and 256 MiB per instance when turned on. The
  CLI gains `lw upload`. See [resumable uploads](resumable-uploads.md).
- **File references.** `/api/v1/files` keeps account-scoped handles to uploaded
  files with a digest and an expiry (`uploads.fileTtlHours`, 168 hours by default, at
  most 720). Inspect and optimize take `file:{id,checksum}`, and optimize can keep its
  result as a file reference. The routes answer 404 while uploads are off.
- **Automation discovery.** `GET /api/v1/discovery` is public and lists no tool or
  person; `/api/v1/discovery/me` and `/api/v1/discovery/tools` are private to the
  caller. `GET /api/v1/schema/:toolId` now returns the caller's effective schema:
  hidden inputs removed, locked inputs read-only, and choice inputs listed.
- **Durable callbacks.** A job's callback is stored with the job and sent by any Work
  process, up to six attempts over about 45 minutes, each with a fresh signature and
  the same `x-lolly-delivery-id`. Receivers should drop repeated ids.
- **Render identity.** New durable outputs record the facts their attempt resolved.
  The evidence route reports the identity, and a mismatch fails the attempt before any
  output is stored. Older outputs have none.
- **Blob storage.** The S3 driver writes in 8 MiB multipart parts and stores the
  whole object's SHA-256 when known. Grant `s3:AbortMultipartUpload`, and add an
  `AbortIncompleteMultipartUpload` lifecycle rule. New metrics count blob reads,
  stored bytes and origin bytes, and `GET /api/v1/alerts` (`telemetry.view`) and the
  console warn when the PostgreSQL blob store passes 10 GiB stored or 100 GiB read in
  a month. The alert is emailed once a month when a `notify` block is configured.
- **Managed AI can approve `sing`.** Approve it only for Lolly 1.1.1 or later shells;
  an older shell refuses the whole lease. AI stays off by default.
- **Console dates.** Catalog start and end dates are whole days in the admin's time
  zone. End dates saved by the old console as midnight UTC are not rewritten, so in
  zones behind UTC they show as the day before.
- **Shell files without an extension.** A path without an extension that exists as a
  file in the shell is now served as that file instead of the app page. This fixes
  the PDF viewer's licence files and the offline app download.
- **Packaged documentation.** The console's guides are now a pinned copy of the
  canonical Lolly documentation, recorded in `docs-pin.json`. Image builds verify the
  copy, so do not edit `docs/` in a build tree.

## Changes for API clients and operators

- **Credentials leave URLs.** `GET /api/v1/jobs/:id/result` takes its token in the
  `x-lw-job-token` header, and callbacks and job resources carry `resultToken`. Link
  passwords are posted as a form or JSON field and kept in an `lw_link_<id>` cookie.
  `?token=` and `?pw=` still work in this release and answer with a `Deprecation`
  header. Password links now answer `private, no-store`, and ten wrong passwords from
  one address within 15 minutes lock the link for that address (`429`).
- **Guest links in a browser.** A browser `GET` no longer admits a guest, and browsers
  ignore `?pw=` on guest links; the landing page asks for the password.
- **Socket upgrades.** A collaboration upgrade that sends `Sec-WebSocket-Protocol` is
  treated as a ticket upgrade and refused without a valid ticket. Browser upgrades
  without that header keep the Origin check.
- **Stricter automation checks.** `/compile`, `/validate`, `/package` and `/batch` rows
  refuse locked, hidden or disallowed inputs and values outside the design system's
  choices with `422 INPUT_LOCKED`, `INPUT_HIDDEN` or `INPUT_NOT_ALLOWED`. A format the
  tool does not declare is a `400`.
- **Asset inspection.** `GET /api/v1/catalog/assets/<id>` now needs a signed-in member
  who can see the asset.
- **Source review actions.** Acting on a source review must echo its
  `sourceFingerprint`, so clients older than Lolly 1.1.2 cannot act on one. Other
  approvals are unchanged.
- **PostgreSQL blob size.** The `pg` blob driver refuses blobs over 500 MiB.

## Migrations

This release adds six SQL migrations since 1.1.1:

- `0072_session_version_annotations.sql`
- `0073_instance_blob_months.sql`
- `0074_automation_callbacks.sql`
- `0075_resumable_uploads.sql`
- `0076_file_references.sql`
- `0076_session_version_history.sql`

Number 0071 is reserved by unmerged work and two files share 0076. The runner records
each full file name, sorts by name and applies both 0076 files. The maintained history
now has 66 files. `0076_session_version_history.sql` builds an ordinary index on
`session_versions`, not a concurrent one, inside the runner's 120 second statement
timeout; on a large instance, plan for that table to be locked while it runs. Before
upgrading, check the database with `pnpm run migrate:status`, take a fresh verified
backup and complete an independent restore. Then apply the maintained migration runner
or the chart's migration Job, against the selected instance only.

## Deployment

- **Container bases.** The server image uses `node:26.12.0-alpine3.24` and the render
  worker `node:26.12.0-bookworm-slim`, both pinned by digest. The SUSE BCI and
  admission images keep Node 24, and the source minimum stays Node 24.
- **Helm chart 0.3.3.** The chart passes `LW_CATALOG_SIGNING_KEY` from the
  installation Secret when present, which the 0.3.1 chart never did. It gains Artifact
  Hub annotations, a Rancher `questions.yaml`, a licence, an icon and a README. The
  default image tags follow appVersion 1.1.2. `values-official-release.yaml` still
  pins the qualified 1.1.1 images until 1.1.2 is published and qualified. Chart
  publication through `publish-helm.yml` is a separate, reviewed step.
- **Neutral VM and Dokploy package.** `deploy/marketplaces` and `deploy/dokploy` pin
  a qualified release cohort, still Work 1.1.1. In a browser, the neutral 1.1.1 shell
  refuses the installation's per-caller catalogue, so browser use of that package is
  not qualified.
- **Release workflow.** The server image builds natively on amd64 and arm64 and is
  merged and signed by index digest. A dispatch can rebuild the server or the worker
  alone for an existing tag.

## Prepare and qualify

The commands are the same as for 1.1.1, with `vendor/lolly` at the Lolly source
above:

```text
node scripts/vendor-content-resolver.ts --write
pnpm run repin-engine --apply
pnpm run verify:engine-pin
pnpm run typecheck
```

The packaged documentation comes from a Lolly commit that contains this page:

```text
node scripts/sync-docs-bundle.ts --source=/path/to/lolly --commit=<full-commit-sha>
pnpm run verify:docs-pin
```

Before tagging or publishing images, the exact final Work commit needs ordinary
CI, including the native server image checks and the real Chromium worker checks
with the matched signed shell. The tagged server and worker images must come from
that same Work commit.

## YunoHost packaging

Lolly 1.1.2 publishes no new web archive, so a Work YunoHost package for 1.1.2 keeps
the Lolly 1.1.1 web archive `https://lolli.li/lolly-web-1.1.1-ynh1.tar.gz` (SHA-256
above). That shell carries engine 1.261.0 and none of the Lolly 1.1.2 features above,
and nothing checks the pairing. Until a `1.1.2~ynh1` package is cut, published and
qualified, `1.1.1~ynh1` stays the current YunoHost package. If it is cut, use the
maintained producer on the final Work commit:

```text
node scripts/yunohost-release.ts --ynh-rev 1 --shell-url https://lolli.li/lolly-web-1.1.1-ynh1.tar.gz --shell-sha256 bc78012aa407983ecc818e63be98ae1b45ed7db1dcad3f4c8d4ffe0c371116c1 --out ABS_NEW_ARTIFACT_DIRECTORY
```

Commit the generated manifest, recut into a separate directory and require full
archive byte equality, as for 1.1.1. Runtime results are recorded after its
`yunohost-runtime.yml` run. Until then it is not qualified.

## Images and qualification

The release workflow builds, signs and publishes the server and render-worker
images from the `v1.1.2` tag. The verified digests are recorded here after
publication. The installation guides, the marketplace release cohort and the
download page keep naming the 1.1.1 downloads until 1.1.2 is published and
qualified.
