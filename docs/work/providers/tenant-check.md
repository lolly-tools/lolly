# Check a source on your own tenant

Several Lolly Work sources were built from public documentation, without a live account to test
against. Before you rely on one, run a short check on your own tenant. It confirms that Work
reads the fields it expects, that the files it serves are the real originals, and that only the
right people see them. Nothing in the check writes to the source. Allow about half an hour.

## Which sources need a check

| Source | What is not yet confirmed | Shape report |
|---|---|---|
| [WebDAV / Nextcloud](webdav.md) | URL templates, property names and the response layout | yes |
| [Canto](canto.md) | Endpoints, field names, the token request and original downloads per scheme | yes |
| [Image Relay](imagerelay.md) | Endpoints, field names, the token request and the download link | yes, with detail |
| [IntelligenceBank](intelligencebank.md) | The login response, field names and the download link | yes, with detail |
| [Acquia DAM / Widen](acquia-dam.md) | Endpoints, field names and which embed is the original | yes, with detail |
| [Cloudinary](cloudinary.md) | Regional access, entitlements, metadata, private and raw files, byte fidelity | yes, with detail |
| [Orange Logic](orange-logic.md) | Fields, authentication, paging, substituted formats and storage hosts | yes, with detail |
| [Optimizely CMP](optimizely-cmp.md) | Endpoints, field names, the token endpoint, the download host and publishing | no |
| [Penpot](penpot.md) | RPC command and field names, and the exporter call | no |
| [Brandfolder](brandfolder.md) | The two availability field names | no |

[Google Drive](gdrive.md) has no open checklist in its driver, but it has its own
[acceptance check](#google-drive) to run before go-live. The other sources (S3, git, Dropbox and
Microsoft 365) carry no checklist in their drivers.

## Before you start

- A tenant you are allowed to test against, under your own contract, and its credential.
- A few files you can also download from the source's own interface, one per file type you
  plan to use.
- On the Work instance: `catalog.provider.manage` for most steps, `catalog.provider.credential`
  (owners) to seal the credential and enable the source, and `catalog.provider.read` for drift.

## How a check works

::: timeline
- **Sign in.** `lw login` prints a short code; approve it in a browser where you are signed in
  to Work.
- **Dry run.** `lw providers preview` checks health and maps a sample without saving anything.
  Exit code `2` means health failed; the guide's error table says why.
- **Shape report.** Add `--shape`, and `--remote-id <id>` for kinds with a detail call, and save
  the output. It lists field names and types, never values.
- **A real source for admins only.** Add the source with `"groups":["admin"]`, seal the
  credential, enable and sync. Read the count, the sections and every note.
- **Check the bytes.** Materialize one file, fetch it through Work and compare its checksum with
  the same file downloaded from the source.
- **Check access and change.** Look at the source as two members in different groups, then
  rename, move and remove a file upstream and run `lw providers drift`.
- **Take it down and report.** Disable and remove the source. The materialized copies stay.
:::

```bash
export LW_BASE=https://lolly.example
lw login

lw providers preview --kind canto --options '{"tenant":"acme","domain":"com"}'
lw providers preview --kind canto --shape --options '{"tenant":"acme","domain":"com"}' > canto-shape.txt

lw providers add acme-canto --kind canto --label "Acme Canto" \
    --options '{"tenant":"acme","domain":"com","albumId":"AB12C"}' \
    --exposure '{"groups":["admin"]}'
lw providers credential acme-canto      # hidden prompt
lw providers enable acme-canto          # owner-only
lw providers sync acme-canto
lw providers materialize acme-canto --remote-id image:AB12C --json
```

### Read the shape report

Read its three groups in this order:

1. **EXPECTED BY THIS DRIVER, ABSENT**: the guesses that did not match. Each entry reads
   `key|alternatives (CONSTANT_NAME)`. `(none)` means every guess matched.
2. **IN THE RESPONSE, NOT MAPPED**: every other field your tenant returned. The right name for an
   absent guess usually appears here, and so does any custom field carrying a date.
3. **MAPPED BY THIS DRIVER**: confirmed.

Names are combined across every record on the page, so a field that only some records carry
does not read as absent. `--remote-id` adds a second report on the per-file detail call, the one
that carries the download link; it fetches information about one file, never its bytes.

### Check the bytes

`lw providers materialize <id> --remote-id <remoteId> --json` copies files through the same path
an exit uses and records a checksum for each. Every failure prints as `<remoteId>: <message>`.
`--remote-id` filters the walk rather than skipping it, so keep the source's folder or query
narrow. Then fetch the same file through Work:

```bash
curl -sS -b "$(cat ~/.config/lolly-work/session)" \
    "$LW_BASE/catalog/ext/<source id>/<remoteId>/<format>" -o /tmp/work-copy.bin
shasum -a 256 /tmp/work-copy.bin
```

Download the same file from the source's own interface as the original and checksum that too.
A match means Work serves the true original. A smaller file, other pixel dimensions or missing
EXIF or ICC data means the link served a rendition: report it, because materialize stores
whatever it is given. A failure on this route shows as `502 PROVIDER_UNAVAILABLE`; the reason is
in the materialize output.

### Read drift

`lw providers drift <id>` compares each copy with the source's current change stamp. It counts
only the copies that got a real answer and lists every other copy under its own reason:

- **no change stamp the driver can read**: the source spells its modified field differently.
  Send the shape report.
- **would not parse as a date (shape …)**: the stamp is in a format the driver does not read. The
  shape (digits as `N`, letters as `A`) is what to send.
- **no longer in the listing**: those files left the scope you federated.
- **read with care**: compared, but the stamp gave no timezone, so the answer can be off by the
  server's UTC offset.

### Take it down and report

```bash
lw providers disable acme-canto
lw providers rm acme-canto
```

Keep a record outside your code repositories: the test date, the product and version, the
region or tenant class, the redacted shape report, the checksums, the access results and anything
left unresolved. Never keep credentials, signed URLs or file contents. To get a driver
corrected, open an issue on the
[Lolly Work repository](https://github.com/lolly-tools/lolly-work/issues) with the shape report,
the exact text of any error and the product version.

## What to check for each source

::: details WebDAV / Nextcloud
- Use a folder with at least one subfolder, and a file with a space or a non-ASCII character in
  its name. Run both flavours if you have them: Nextcloud and one generic server use different
  URL templates.
- `health ok` proves the files root URL and the credential together. On a `404`, compare the
  printed path with the URL your browser shows for the folder.
- The shape report asks with `<d:propname/>`, so it lists every property the server holds. If
  the server refuses that request, a note in the report gives the error and the NOT MAPPED group
  is empty.
- After the sync, the sections should be the subfolders, one level each. A note about
  `MAX_DIRS` means the tree is bigger than one walk: narrow `root`. A `skipped` count with no
  note means some responses fell outside the files root or described nothing readable.
- The byte path's format segment is `file`. WebDAV serves no renditions, so any checksum
  mismatch is a real defect.
:::

::: details Canto
- Confirm API access on your contract tier first: `canto api 403` usually means it is missing.
- Write down the authorize and token URLs you used to get the refresh token.
  `oauth token refresh failed (400)` means the token endpoint wants a different request, which a
  new credential cannot fix.
- Check one file per scheme you plan to use (image, video, document and so on): originals are
  fetched per scheme. The format segment is `download`.
- A sync note saying every asset on the page was treated as not approved means
  `approvedStates` does not match your workflow.
- Look in NOT MAPPED for a `deleted`, `trashed` or `status` field. The driver drops no trashed
  records today, so report such a field if you find one.
- A `429` during the sync means the default of about three requests a second is too fast for
  your tenant: raise `minGapMs`.
:::

::: details Image Relay
- Confirm first that Image Relay is the driver to use: a tenant moved to Canto uses `canto`
  ([Leave a DAM](../offboarding.md#canto-and-image-relay-which-driver-do-you-exit-through)).
- Write down the authorize and token URLs you used. `oauth token refresh failed (400)` means the
  token endpoint wants a different request.
- Run the detail report with `--remote-id`. It shows which field carries the download link and
  how the single-file response is wrapped.
- The format segment is `download`. Repeat the byte check per file type, since one type may come
  from a different link.
- A `429`, or a `403` mentioning the user agent, during the sync is the 5-requests-a-second cap.
- `deleted: boolean` in the record confirms how deleted files are flagged.
:::

::: details IntelligenceBank
- The tenant must be on `intelligencebank.com`; a custom domain is refused.
- `login 401` or `403` is the API key; `login 404` is the login path; `login returned no
  sid/apiV3url` means the login worked but its response used other field names.
- For `--remote-id`, take a resource id from `lw providers preview … --json` (`sample[].id`,
  the last part of `ext/preview/<id>`); the printed table shortens that column.
- A materialize that fails partway and then works on a second run points at the session
  lifetime.
- The format segment is `download`. Repeat the byte check per file type: office and design files
  often come through a different link from images.
- If a resource carries both an expiry date and a review date, report it: the driver takes the
  first it finds.
:::

::: details Acquia DAM / Widen
- The token carries the permissions of the user it belongs to; there is no anonymous mode.
- A missing status is treated as approved, so a wrong status field fails open. Read the report
  for `status` rather than waiting for a symptom.
- Sizes may arrive in kilobytes and be multiplied by 1,024. Compare one asset's size with the
  Widen interface.
- The format segment is `original`. Widen serves conversions ("embeds") beside the original, so
  this check matters most here: if checksums differ, compare size, dimensions and metadata, and
  report whether the `_links.download` link did better. Repeat per file type.
:::

::: details Cloudinary
- Confirm the cloud name, the regional API host, Search and Admin access and downloads by asset
  ID. Build a test folder with ordinary images, SVG, PDF, PowerPoint, audio and video, plus
  private and authenticated files. Agree a spending ceiling before you start.
- In the shape report, look at `resources`, `asset_id`, `version`, `format`, `resource_type`,
  `type`, `asset_folder`, `tags` and `context`. Do not broaden access just to get a convenient
  count.
- Save the source disabled, seal the credential, sync and check groups and exposure before
  enabling. A file with no approval metadata must not appear as approved. Test date boundaries
  and timezones.
- Fetch an original through Work and compare SHA-256 and byte count with Cloudinary's original,
  for private, authenticated and raw files too. Inspect any credentials in the bytes yourself.
- Rename and move an asset: its id must stay the same, and moving it out of the configured
  folder must stop new reads. Overwrite a file and check that the old selected version fails
  clearly. Test removal and credential revocation.
- Use two members in different groups and compare cards, results, counts, thumbnails and
  originals. A service credential's wider view must never become member access.
- Exercise paging, a rate limit, an outage and recovery. Record real request and credit use,
  cache freshness and limits for several callers, and whether structured metadata appears in
  both the list and the detail call.
- Materialize a sample and check checksums and kept metadata before planning an exit. Note which
  proof, rights or history data needs a separate export.
- A `401` is authentication, a `403` a permission or entitlement, a `429` the shared request
  budget. Rerun the affected checks after any source change.
:::

::: details Orange Logic
- Confirm the exact tenant origin, the bearer-enabled application account, the approved query,
  the Search v4 entitlement and the field and format permissions. Record the installed release.
- In the shape report, look at `APIResponse.Items`, `SystemIdentifier`, the edit and checksum
  fields, folder fields, `Keywords` and the configured `Path_` objects.
- Repeat with `--remote-id` for a known record and confirm the same query scope applies. Try an
  id that does not exist, one outside the scope and one you cannot access. Do not ask for broad
  search rights just to read `GlobalInfo.TotalCount`.
- Check client credentials, token lifetime, IP binding and one expired-token recovery. Failures
  must not reveal source values or credentials. Agree a shared request budget, including
  parallel callers and retries outside the driver.
- Test an image, a document, audio, video and a metadata-only record. Compare the Work bytes with
  the exact rendition: format, dimensions and any watermark. A missing rendition must not be
  generated, and a substitute must not be accepted. Request one byte range of a large document
  and compare it; note whether the storage host answers `206` or ignores ranges.
- If renditions come from another host, add only that exact HTTPS origin to `storageOrigins`.
  Redirects, even to the same origin, are refused: use the documented origin rather than
  weakening the guard.
- Set real approval and date fields and test missing values, refusal, expiry and a future
  release. Check that labels still say these are renditions, across two Work groups.
- Change a record, revoke access and remove a record. Test stale references, fresh lookups and
  caching delay, and agree the freshness bound. A public link received elsewhere is not
  withdrawn by Work.
- Materialize a rendition sample and check the metadata. A cutover attempt must fail before any
  identity, grant, alias or activation changes.
:::

::: details Google Drive
- Put a known ordinary image or vector file directly in the folder. Compare the console's
  checksum and byte count with that original; folders and native Docs, Sheets and Slides are
  skipped.
- Enable only after reviewing the sample and the full sync count. Sign in as a member of an
  allowed group, find the file in the catalog and fetch its original. Repeat as a member outside
  those groups and confirm both the asset and the original are refused.
- Disable the source and confirm its entries disappear and an earlier file URL no longer serves.
  Reconnect, then test a revoked grant to rehearse recovery.
- Record the source and account, folder, installed version, group results, checksum and consent
  audience. Run this against the Workspace you will actually connect.
:::

::: details Optimizely CMP, Penpot and Brandfolder
- **Optimizely CMP** has no shape report. Run a preview and a sync on your own tenant, compare one
  file's checksum and report any error text. Publish one test export before relying on
  publishing.
- **Penpot** has no shape report either. Run a preview and a sync, confirm the token sets appear
  on the console's **Design system** tab, and import one board through **Search & import**.
- **Brandfolder**: give one asset availability dates in Brandfolder and confirm an availability
  window appears for it in Work.
:::

## Qualifying a source for a new kind of task

The check above covers reading files. Using a source for something new, such as exact historical
versions, delegated sign-in or actions that change the source, needs its own evidence.

::: details What to record before relying on a source for a new task
- **Files and versions.** Qualify the selected file, the difference between its original and its
  previews, and how the source handles revisions. The federated metadata version is only a cache
  change token: exact past bytes need a qualified revision or a permitted retained copy, with a
  verified checksum. See [cache versions and exact source references](../catalog.md#cache-versions-and-exact-source-references).
- **Identity.** Record whether the connection exposes an administrator-chosen subset through a
  shared service credential or uses each member's own upstream identity. A shared credential does
  not keep personal upstream permissions, so exposure and lifecycle gates must cover previews,
  originals, search, counts and any later history view.
- **Separate authority.** Reading from a source, delivering to it and processing its files with a
  model each need their own permission, even from one vendor. An upstream approved flag describes
  the source's state; review scope and territory or channel eligibility need their own evidence.
- **Batches.** A viewer's current context must never silently become a batch's targets or
  destination. Preview the targets, keep each item's identity through retries, and check each
  item's authority when it is admitted and again when it is committed.

| Area | Evidence to collect |
|---|---|
| API and identity | Product or module, API revision, tenant or workspace, service or delegated mode, scopes and how permissions and revocation behave live. |
| Content | The selected original, file and version with its observed checksum; past bytes checked separately from past metadata, policy and review snapshots. |
| Search | Allowed combinations per mode, required exact filters, paging and order, result caps, whether counts and facets are complete, and how an unavailable source is reported. |
| Readiness | Exactly which action or representation can proceed. Accepted upload, pending processing, preview, original, review and publication are separate observations. |
| Review | The subject, purpose or target, revision and origin, and whether a person or a rule decided. A flag alone is incomplete evidence. |
| Side effects | Explicit bounded targets, create or replace and conflict rules, destination authority and budget, and reconciliation after an uncertain result. |
| Portability | Schema, revision and locale mappings where needed, retained evidence and a demonstrated exit listing the fields it cannot carry. |

Documentation and fixture results are not the same as a tenant observation or a release
qualification. None of this adds a new source kind, a delegated sign-in mode or a resolver for
past versions: today's sources are read-only and do not implement this richer action contract.
:::
