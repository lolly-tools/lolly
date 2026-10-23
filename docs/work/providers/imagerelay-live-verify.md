# Image Relay live-verify runbook (kind: `imagerelay`)

The tenant-day checklist for the [`imagerelay` driver](imagerelay.md). Every endpoint path and
field name in that driver comes from Image Relay's public v2 documentation and none of it has
been confirmed against a real tenant; this pass confirms the driver against your tenant. Steps 1 and 2 store
nothing; step 3 writes only into your own store. About 30 minutes. Canto owns the platform now,
so check the [fork matrix](../offboarding.md#canto-and-image-relay-which-driver-do-you-exit-through)
first and confirm this is the driver you exit through at all.

## Before you start

- An Image Relay tenant you are allowed to test against, and a folder id if you want step 3
  scoped to one folder.
- The sealed OAuth blob, `{"clientId":"…","clientSecret":"…","refreshToken":"…"}`, from an app
  you registered in Image Relay with read access.
- A refresh token minted against that app, obtained by hand through Image Relay's own documented
  authorization-code flow: `lw providers auth` registers no consent flow for this kind. Record
  the authorize and token URLs you used; confirming them is rows 5 and 5a.
- `catalog.provider.manage` on this instance, plus `catalog.provider.credential` (owner-only)
  for the credential and `enable` in step 3.
- One file per type you plan to exit (a photo, a PDF, a video) that you can also open in the
  Image Relay UI, for step 3.

## Step 1: auth

```bash
export LW_BASE=https://lolly.example
lw login                                   # device sign-in; or: lw login --cookie 'lw_session=…'

lw providers preview --kind imagerelay
```

The credential prompt is hidden; paste the blob on one line. `health ok - imagerelay` followed
by a `mapped sample` table means the token exchange and the first list call both worked, and
that table is where you pick the file id step 2 needs. Exit code `2` means health failed.

| Symptom | What it means | Fix |
|---|---|---|
| `health FAILED: oauth token refresh failed (400)` | The token endpoint read the form and rejected the request SHAPE: a different grant, the client secret wanted in an `Authorization` header, a required scope param. Re-capturing the credential cannot help | Row 5a: `getAccessToken` in `providers/oauth.ts` |
| `health FAILED: oauth token refresh failed (401)` | The credential: client id/secret wrong, refresh token wrong, or the grant revoked | Re-capture the blob with `lw providers credential` |
| `health FAILED: oauth token refresh failed (404)` or `(405)` | The token URL is wrong | Row 5: `options.tokenUrl` |
| `health FAILED: imagerelay api 401 for /files?per_page=100&page=1` | The token minted and Image Relay refused the token. `403` means the app's scopes do not cover the files you asked for | The app's scopes, not the code |
| `health FAILED: imagerelay api 404 for /files?per_page=100&page=1` | The REST base or the list path is wrong | Rows 1 and 2 |
| `health FAILED: imagerelay api 404 for /folders/…` with a good folder id | The folder-scoped path is wrong | Row 3 |

## Step 2: capture the shape

```bash
lw providers preview --kind imagerelay --shape --remote-id 55 > imagerelay-shape.txt
```

Shape mode lists no sample and returns no values: key names and types only, so that file is
sendable as it stands (the credential prompt goes to stderr). It runs only when health is ok.
`--remote-id` (any id from the step 1 table) adds a second report, on the call `resolveBlob`
reads: it re-reads one file and follows the link in that response, so the wrapper and the
download-link keys are guesses no list page can answer. That is rows 17 and 18. Still read-only:
JSON about one file, never its bytes.

```
imagerelay  GET /api/v2/files?per_page=100&page=1
  envelope: files: object[] (100) · meta: { next_page: null }
  record: (100 under "files", keys unioned)
    id: number · filename: string · name: string · extension: string · size: number
    updated_at: string · keywords: string[] · deleted: boolean
    folder: { id: number, name: string } · custom_fields: { Expiry Date: string }
    quick_link: string
  MAPPED BY THIS DRIVER: files · meta · id · filename · name · extension · size · updated_at
    keywords · deleted · folder · custom_fields
  IN THE RESPONSE, NOT MAPPED: quick_link
  EXPECTED BY THIS DRIVER, ABSENT: (none)

imagerelay  GET /api/v2/files/55
  envelope: file: { id: number, filename: string, size: number, download_url: string, … }
  record: (the one record this call returned, wrapped in "file")
    id: number · filename: string · size: number · download_url: string · quick_link: string
  MAPPED BY THIS DRIVER: file · download_url · size
  IN THE RESPONSE, NOT MAPPED: id · filename · quick_link
  EXPECTED BY THIS DRIVER, ABSENT: (none)
```

- **EXPECTED BY THIS DRIVER, ABSENT** is the answer. Each entry reads
  `key|alternatives (CONSTANT_NAME)`, so it identifies the constant to widen; `(none)` means every
  guess matched.
- **IN THE RESPONSE, NOT MAPPED** holds the replacement: an ABSENT `updated_at
  (UPDATED_AT_KEYS)` beside a NOT MAPPED `modified_at` is one constant edit.
- Record keys are unioned across the page, and tags fold (`keywords`+`tags`) rather than falling
  back, so read the `record:` block to see which half this tenant sends. On the detail report
  that row answers the wrapper question: a tenant wrapping under a name this driver does not try reads
  as not wrapped, with the wrapper key in NOT MAPPED and the link ABSENT.

## The assumption table

One row per `LIVE-VERIFY` bullet in the driver header
(`server/src/catalog/providers/imagerelay.ts`), with the field-names bullet expanded per
constant. If a row and that header disagree, the header is right and this table is stale.

| # | The assumption | How the report answers it | Fix it in `providers/imagerelay.ts` |
|---|---|---|---|
| 1 | The REST base is `https://api.imagerelay.com/api/v2` | Not in the diff: the report's first line prints the path it called. A wrong base fails step 1 as `imagerelay api 404` or a DNS error | `options.baseUrl`; the default is `DEFAULT_BASE` |
| 2 | Listing is `GET /files?per_page=100&page=<n>` | The first line identifies the exact call; `envelope: files: object[] (N)` says how many came back. A page param the API ignores shows as the same records on page 2 | `listPath` and `PAGE_SIZE` |
| 3 | Folder scoping is `GET /folders/<id>/files`, with `recursive=true` for descendants | Re-run step 2 with `--options '{"folderId":"1234","recursive":true}'` and compare the counts. A folder id the API does not know fails as `imagerelay api 404 for /folders/…` | `listPath` |
| 4 | Search is `GET /files?query=<text>` | Not exercised by preview: `searchAssets` is reachable only through catalog search once the provider is enabled | `searchAssets` |
| 5 | The token endpoint is the base host's `/oauth/token` | Not in the report: a wrong one fails before any API call | `options.tokenUrl`; the default is derived from `options.baseUrl` |
| 5a | The token EXCHANGE is an RFC 6749 form POST: `grant_type=refresh_token` with `client_id`/`client_secret` in the body | Not in the report either. A different grant, or the secret wanted in a header, or an extra scope param, fails step 1 with `oauth token refresh failed (400)` | `getAccessToken` in `providers/oauth.ts`, shared with every OAuth kind; an Image Relay quirk goes in its `extraParams`, not in the shared body |
| 6 | The file array rides `files`, then `data` | The `record:` line identifies the key that held it, or says no record array was found and lists `files\|data (LIST_ENVELOPE_KEYS)` under ABSENT with the real key in NOT MAPPED | `LIST_ENVELOPE_KEYS` |
| 7 | The next-page cursor is `meta.next_page` | `envelope: meta: { next_page: … }` shows both the wrapper and the key. ABSENT `meta (META_KEYS)` means the envelope calls it something else; a `meta` with a differently named cursor inside stops paging after page 1, silently | `META_KEYS` / `NEXT_PAGE_KEYS` |
| 8 | The file id is `id` (string or number, both accepted) | ABSENT `id (RECORD_ID_KEYS)`. A file with no readable id does not federate silently: it throws, naming this constant | `RECORD_ID_KEYS` |
| 9 | The filename is `filename` and the title is `name` | ABSENT `filename\|name (FILENAME_KEYS / DISPLAY_NAME_KEYS)`, with the real names in NOT MAPPED | `FILENAME_KEYS` / `DISPLAY_NAME_KEYS` |
| 10 | The format rides `extension`, then `file_type` | ABSENT `extension\|file_type (FORMAT_KEYS)`. Absent is recoverable: the driver falls back to the filename extension | `FORMAT_KEYS` |
| 11 | The byte size is `size` | ABSENT `size (SIZE_KEYS)`. Whether the number is bytes is not in the report: compare it against what Image Relay shows for the file in step 3 | `SIZE_KEYS` |
| 12 | The change stamp is `updated_at` | ABSENT `updated_at (UPDATED_AT_KEYS)`. `lw providers drift` compares this field, so a wrong guess reads as "nothing ever changes upstream" | `UPDATED_AT_KEYS` |
| 13 | Tags fold `keywords` and `tags` | These fold rather than fall back, so ABSENT `keywords\|tags (TAG_KEYS)` appears only when neither is there | `TAG_KEYS` |
| 14 | Deletion is reported positively as `deleted` | `deleted: boolean` in the `record:` block confirms the deletion flag. ABSENT `deleted (DELETED_KEYS)` means deleted files are either absent from listings or flagged some other way, and a differently named flag means deleted files federate | `DELETED_KEYS` (the driver also accepts the string `"true"`) |
| 15 | The folder is `folder`, and its name is `folder.name` | `folder: { id: number, name: string }` shows both levels. ABSENT `folder (FOLDER_KEYS)` means no section will ever be read | `FOLDER_KEYS` / `FOLDER_NAME_KEYS` |
| 16 | Custom metadata rides `custom_fields` | The report descends one level and identifies the bag and the fields inside it: `custom_fields: { Expiry Date: string, … }`. ABSENT `custom_fields (CUSTOM_FIELD_BAG_KEYS)` when it does not exist | `CUSTOM_FIELD_BAG_KEYS`; the field name inside the bag is `mapping.availabilityFields` on the entry |
| 17 | The single-file call is `GET /files/<id>`, and it wraps the record in `file` (or `data`, or nothing) | The detail report identifies the wrapper this tenant used, or says the record came back unwrapped. Left unfixed it fails in step 3 with `imagerelay file has no download url in the response to GET /files/<id> (live-verify: …)` | `DETAIL_WRAPPER_KEYS` |
| 18 | The signed link is `download_url`, and it serves the **original** bytes | The NAME is answered by the detail report: ABSENT `download_url (DOWNLOAD_URL_KEYS)` with a `quick_link` in NOT MAPPED means the driver has no link at all on this tenant. Whether that link serves the ORIGINAL is a value question no report can answer: step 3's checksum does | `DOWNLOAD_URL_KEYS` |
| 19 | Every API, token, download and quick-link host is inside `imagerelay.com` | Not in the report. A host outside it fails with `imagerelay url outside allowed hosts` - the guard covers the API base and token URL as well as the blob fetch | `ALLOWED_HOSTS`: add the host explicitly, never as a wildcard |
| 20 | The API requires a `User-Agent` and caps at 5 requests/second | Not in the report. A `429` during the step 3 walk, or a `403` naming the user agent, is the answer | `USER_AGENT` and `MIN_GAP_MS` (this kind has no `minGapMs` option; the cap is fixed) |

## Step 3: bytes

Only a blob fetch proves the export capability the exit depends on, so this step creates a real
provider record.

```bash
lw providers add acme-imagerelay --kind imagerelay --label "Acme Image Relay" \
    --options '{"folderId":"1234","recursive":true}' \
    --exposure '{"groups":["admin"]}'     # verification pass: admins only, not the whole org
lw providers credential acme-imagerelay   # same blob as step 1, prompt hidden
lw providers enable acme-imagerelay       # owner-only
lw providers sync acme-imagerelay         # federation proof: read the count and any notes
lw providers materialize acme-imagerelay --remote-id 55 --json
```

`--remote-id` filters the walk rather than skipping it, so `options.folderId` is what keeps the
pass short and inside the 5 req/s cap. Every per-asset failure prints under the summary as
`<remoteId>: <message>`, and each message identifies the assumption that broke, the constant to edit
and this page.

**The fidelity check** (true original, or a recompressed rendition?):

```bash
curl -sS -b "$(cat ~/.config/lolly-work/session)" \
    "$LW_BASE/catalog/ext/acme-imagerelay/55/download" -o /tmp/imagerelay-lolly.bin
shasum -a 256 /tmp/imagerelay-lolly.bin
file /tmp/imagerelay-lolly.bin
```

Download the same file from the Image Relay UI as the original and checksum that too. A match
means `download_url` served the true original: strike row 18. A smaller file, different pixel
dimensions or stripped EXIF/ICC means the link is a rendition or a quick link, which is row 18
and not a materialize bug: materialize checksums whatever it is given. Repeat per file type you
plan to exit, since one type may come from a different link. A driver failure on this route
surfaces as `502 PROVIDER_UNAVAILABLE`; the diagnosis is in the materialize output.

Last, `lw providers drift acme-imagerelay`. Every copy that could not be compared is counted
under its own reason, so a zero cannot read as a clean bill of health: no readable change stamp
means row 12 is wrong, and an unparsable one prints its shape (digits `N`, letters `A`) to
report.

Then take the pass down. Materialized copies are instance-owned and survive the delete:

```bash
lw providers disable acme-imagerelay
lw providers rm acme-imagerelay
```

## Step 4: sign off

**In the driver** (`server/src/catalog/providers/imagerelay.ts`): strike the `LIVE-VERIFY`
bullets this pass actually exercised and only those. A folder-scoped listing you never ran and a
file type you never fetched stay on the list. Name the date, and say whether the tenant was
still on the legacy platform or mid-migration to Canto.

**Where a guess was wrong**, widen rather than replace: add the real key and keep the old ones.
Then pin it with a fixture case in `tests/provider-shape.test.ts`, and one in
`tests/provider-live-verify.test.ts` if the failure path changed.

**In the guides**: the fixture-verified paragraph in [`providers/README.md`](README.md) and the
readiness row in [`offboarding.md`](../offboarding.md) are where the "live confirmation open"
claim lives. Both should now say what was confirmed, on what date, and what remains open. No
field name here carries over
to the [`canto` driver](canto-live-verify.md), a different API; the tenant knowledge does, and
`mapping.availabilityFields` moves across with only the field name changed.

**Send back**: `imagerelay-shape.txt`, the verbatim text of any driver error you hit, which
constants you edited and to what, and the step 3 fidelity result per file type.

See also: [the Image Relay guide](imagerelay.md) · [off-boarding](../offboarding.md) ·
[the CLI](../cli.md) · the other runbooks: [canto](canto-live-verify.md) ·
[intelligencebank](intelligencebank-live-verify.md) · [acquia-dam](acquia-dam-live-verify.md) ·
[cloudinary](cloudinary-live-verify.md) · [orange-logic](orange-logic-live-verify.md) ·
[webdav](webdav-live-verify.md).
