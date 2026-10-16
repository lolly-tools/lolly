# Acquia DAM / Widen live-verify runbook (kind: `acquia-dam`)

The tenant-day checklist for the [`acquia-dam` driver](acquia-dam.md). Every endpoint path and
field name in that driver comes from Widen's public v2 documentation and has never been confirmed
against a real collective; this pass confirms them. Nothing here writes to the collective, and it
takes about 30 minutes. This kind has the least mapping work and the most to check about bytes:
Widen serves conversions ("embeds") beside the original, so step 3 carries more weight here than
in the other runbooks.

## Before you start

- A Widen collective you may test against, and optionally a search query to scope the pass.
- A Widen API token (a personal access token) with read access: one sealed bearer string, not a
  JSON blob. It carries the permissions of the user behind that token, and there is no anonymous mode.
- The asset statuses your collective treats as approved (row 10 - the `["active"]` default is a
  guess about your workflow, not about the API).
- On this instance: `catalog.provider.manage` for every step, plus `catalog.provider.credential`
  (owner-only) for the credential and `enable` in step 3. `drift` needs `catalog.provider.read`.
- One asset you can also download from the Widen UI as the original, for step 3.

## Step 1: auth

```bash
export LW_BASE=https://lolly.example
lw login --email you@acme.example          # or: lw login --cookie 'lw_session=…'

lw providers preview --kind acquia-dam --options '{"query":"ft:(png OR svg)"}'
```

The credential prompt is hidden - paste the bearer token. `preview` builds an ephemeral provider
record, asks the collective and throws it away: nothing is created, stored or enabled, so a wrong
option costs a retry. `health ok` means the token and the first list call both worked. Step 2
needs one asset id: re-run this command with `--json` and read `sample[].id` (the last segment of
`ext/preview/<id>`), because the printed table truncates that column.

| Symptom | What it means | What to fix |
|---|---|---|
| `health FAILED: acquia-dam api 401 for /assets?limit=100&offset=0&expand=…` | the token was refused | Wrong, expired or revoked. |
| `health FAILED: acquia-dam api 403 for /assets?…` | the token is real, its owner cannot read these assets | Check what that user sees in the Widen UI. |
| `health FAILED: acquia-dam api 404 for /assets?…` | the token got through and the path is not there | The base or the list path (rows 1 and 2). |
| `health FAILED: acquia-dam api 400 for /assets?…` | Widen rejected the request itself | The `expand=` list or the search query (rows 2 and 3). Re-run without `--options` to rule the query out. |
| `health FAILED: acquia-dam provider has no credential` | you pressed enter at the prompt | This kind has no anonymous mode. |

Exit code `2` means health failed. `--shape` calls the collective only when health is ok.

## Step 2: capture the shape

One command, one file, using an asset id from step 1:

```bash
lw providers preview --kind acquia-dam --shape --remote-id a1b2c3 \
    --options '{"query":"ft:(png OR svg)"}' > acquia-dam-shape.txt
```

The file holds two reports - the list call, then the `/assets/<id>?expand=embeds` detail call the
bytes come from (row 18). Both are key names and value types only: no values, no asset content, no
credential, and the prompt goes to stderr. Read the three groups in this order:

1. **EXPECTED BY THIS DRIVER, ABSENT** - the wrong guesses, and the answer this page exists for.
   Each entry reads `key|alternatives (CONSTANT_NAME)`, so it identifies the constant to widen.
   `(none)` means every guess matched.
2. **IN THE RESPONSE, NOT MAPPED** - what your collective sent that the driver ignores. The fix for
   an absent guess is usually sitting here: ABSENT `expiration_date (AVAILABLE_UNTIL_KEYS)` beside
   NOT MAPPED `expiry` is one constant edit.
3. **MAPPED BY THIS DRIVER** - confirmed.

`file_properties`, `embeds` and `thumbnails` exist in the response only because the request asked
for them, so check the `expand=` list on the report's first line before editing a constant: an
ABSENT one may be row 2 rather than row 14 or 18. Keys in the `record:` block are unioned across
the page, so a key one asset omits does not read as absent.

## The assumption table

One row per `LIVE-VERIFY` bullet in the driver header
(`server/src/catalog/providers/acquia-dam.ts`), the field-names bullet expanded per constant. If a
row and that header disagree, the header is right and this table is stale.

| # | The assumption | How the report answers it | Fix it in `providers/acquia-dam.ts` |
|---|---|---|---|
| 1 | The REST base is `https://api.widencollective.com/v2` | Not in the diff: the report's first line prints the path it called. A wrong base fails step 1 as `acquia-dam api 404` or a DNS error | `options.baseUrl` on the provider entry; the default is `DEFAULT_BASE` |
| 2 | Listing is `GET /assets?limit=100&offset=<n>&expand=file_properties,embeds,thumbnails` | The first line identifies the exact call, `expand=` list included; `envelope: items: object[] (N)` says how many came back. A `400` here is usually an `expand` name Widen does not know | `listPath` and `PAGE_SIZE` |
| 3 | A collective is scoped with `&search=<query>`, in Widen's own query syntax | Re-run step 1 with and without `--options '{"query":"…"}'` and compare the sample totals; shape mode reports the query only as the path it called. A query the API rejects fails as a `400`, not as an empty page | `listPath`; the query itself is `options.query` on the entry |
| 4 | Auth is `Authorization: Bearer <token>` on every call | Not in the report: a wrong scheme fails as a `401`, the same symptom as a wrong token, so rule the token out in the Widen UI first | The `api` helper's headers |
| 5 | The asset array rides `items` | The `record:` line identifies the key that held it, or says no record array was found and lists `items (LIST_ENVELOPE_KEYS)` under ABSENT with the real key in NOT MAPPED | `LIST_ENVELOPE_KEYS` |
| 6 | The envelope carries `total_count` | `envelope: total_count: number` confirms the total count. Nothing breaks if it is absent: this driver pages by "was the page full", never by the total | `TOTAL_COUNT_KEYS` |
| 7 | The asset id is `id`, then `external_id` | ABSENT `id\|external_id (RECORD_ID_KEYS)`. An asset with no readable id throws rather than federating silently | `RECORD_ID_KEYS` |
| 8 | The filename is `filename` | ABSENT `filename (FILENAME_KEYS)`, with the real name in NOT MAPPED. Recoverable: the id becomes the name | `FILENAME_KEYS` |
| 9 | Approval rides `status` | ABSENT `status (STATUS_KEYS)`. An absent status is treated as approved, so a wrong key here fails open - catch it by reading the report, not by symptom | `STATUS_KEYS` |
| 10 | The approved statuses are `["active"]` | Not in the report - these are values. Step 1 and `sync` print the note instead: `acquia-dam treated all N asset(s) on this page as not approved (live-verify: the asset status VALUES …)` | `options.approvedStatuses` on the provider entry, not a constant |
| 11 | Availability starts at `release_date` | ABSENT `release_date (AVAILABLE_FROM_KEYS)`, with the real name in NOT MAPPED | `AVAILABLE_FROM_KEYS` |
| 12 | Availability ends at `expiration_date` | ABSENT `expiration_date (AVAILABLE_UNTIL_KEYS)`. This is the field an exit most wants right: it carries a licence end date across the move | `AVAILABLE_UNTIL_KEYS` |
| 13 | The change stamp is `last_update_date` | ABSENT `last_update_date (UPDATED_AT_KEYS)`. `lw providers drift` compares this field, so a wrong guess reads as "nothing ever changes upstream" | `UPDATED_AT_KEYS` |
| 14 | Format and size ride a nested `file_properties` bag | `file_properties: { format: string, size_in_kbytes: number }` in the `record:` block shows the bag and its contents. ABSENT `file_properties (FILE_PROPERTIES_KEYS)` may be the `expand` list rather than a wrong key | `FILE_PROPERTIES_KEYS` |
| 15 | Inside that bag, the format is `format`, then `format_type` | Read the nested types in the `record:` block - the diff checks the bag itself, not the keys inside it | `FORMAT_KEYS` |
| 16 | Inside that bag, size is `size_bytes`, or `size_in_kbytes` (multiplied by 1024) | Same as row 15: read the nested block. A wrong guess misreports every size by a factor of 1024, so check one asset's number against the UI in step 3 | `SIZE_BYTES_KEYS` / `SIZE_KBYTES_KEYS` |
| 17 | Categories ride `categories`, each entry a name string or an object with `name` | `categories: object[]` (or `string[]`) in the block. ABSENT `categories (CATEGORY_KEYS)` means no section is ever read | `CATEGORY_KEYS` / `CATEGORY_NAME_KEYS` |
| 18 | Original bytes come from `embeds.original.url`, falling back to `_links.download.href`, read from `GET /assets/<id>?expand=embeds` | The detail report descends two levels and prints that exact call, so `embeds: { original: { url: string } }` confirms the whole path and a differently named embed shows in its place. Left unfixed it fails in step 3 with `acquia-dam asset has no download url in the response to GET /assets/<id>?expand=embeds (live-verify: …)`. Which embed carries the original rather than a conversion is a value question - step 3's checksum answers it | `EMBED_KEYS` / `EMBED_ORIGINAL_KEYS` / `LINKS_KEYS` / `LINK_DOWNLOAD_KEYS` / `DOWNLOAD_URL_KEYS` |
| 19 | Every download host is inside `widencollective.com` or `widencdn.net` | Not in the report. A CDN host outside both fails the blob fetch with `acquia-dam url outside allowed hosts` | `ALLOWED_HOSTS` - add the host explicitly, never as a wildcard |

## Step 3: bytes

Only a blob fetch proves the export capability the exit depends on, so this step creates a real
provider record.

```bash
lw providers add acme-widen --kind acquia-dam --label "Acme Widen" \
    --options '{"query":"ft:(png OR svg)","approvedStatuses":["active"]}' \
    --exposure '{"groups":["admin"]}'    # verification pass: admins only, not the whole org
lw providers credential acme-widen       # hidden prompt, same bearer token as step 1
lw providers enable acme-widen           # owner-only
lw providers sync acme-widen             # federate: confirm the count, read any notes
lw providers materialize acme-widen --remote-id a1b2c3 --json
```

`--remote-id` filters the walk rather than skipping it, so keep `options.query` narrow. Every
per-asset failure prints under the summary as `<remoteId>: <message>`, and each message identifies the
assumption, the constant and this page.

Fidelity - the one that matters most for this kind, because a Widen embed is a conversion and
`original` is a name the driver takes on trust:

```bash
curl -sS -b "$(cat ~/.config/lolly-work/session)" \
    "$LW_BASE/catalog/ext/acme-widen/a1b2c3/original" -o /tmp/widen-lolly.bin
shasum -a 256 /tmp/widen-lolly.bin
file /tmp/widen-lolly.bin
```

The format segment is `original`, not `download`: this kind identifies its single format after the
embed it reads. Download the same asset from the Widen UI as the original, checksum both, then:

- **Checksums match** - strike row 18.
- **Checksums differ** - the embed named `original` is a conversion. Compare size, pixel
  dimensions and ICC/EXIF, report it as row 18 (not a materialize bug: materialize checksums
  whatever it is given), and say whether `_links.download.href` did better - the fallback
  order is one line to swap.
- **Repeat per file type** you plan to exit (photo, PDF, video, InDesign package): Widen's
  conversion behaviour differs by type.

A failure on the blob route surfaces as `502 PROVIDER_UNAVAILABLE`; the diagnosis is in the
materialize output, not there.

Last, the stamp the exit cadence depends on:

```bash
lw providers drift acme-widen
```

`compared` counts only the copies that got a real answer; every other copy prints under its own
reason. `not compared: … carries no change stamp the driver can read` and `… would not parse as a
date (shape …)` are both row 13 - send the shape it prints. `… no longer in the listing at all`
means those assets left the scope you federated. `read with care: … names no timezone` did compare,
in this server's timezone, so those answers can be off by its UTC offset.

Then take the pass down. Materialized copies are instance-owned and survive the delete:

```bash
lw providers disable acme-widen
lw providers rm acme-widen
```

## Step 4: sign off

- **In `server/src/catalog/providers/acquia-dam.ts`**: strike the `LIVE-VERIFY` bullets this pass
  exercised and only those. The download embed (row 18) is confirmed per file type, not once. This
  is where "confirmed against a live tenant on `<date>`" becomes true and may be written, naming
  the date and the file types you fetched.
- **Where a guess was wrong**, widen rather than replace - `RECORD_ID_KEYS = ['id', 'external_id']`
  exists because the next collective may answer differently. Then pin it: a fixture case in
  `tests/provider-shape.test.ts` for the key set, and one in `tests/provider-live-verify.test.ts`
  if a failure path changed.
- **In the guides**: the fixture-verified paragraph in [`providers/README.md`](README.md) and the
  readiness row in [`offboarding.md`](../offboarding.md) are where the "live confirmation open"
  claim lives, and that row also claims the `embeds.original` URL yields original bytes. Both
  should now say what was confirmed, on what date, and what remains open.
- **Send back**: `acquia-dam-shape.txt` (and a second one run without `options.query`, if the scoped
  one hid whole record types); the verbatim text of any driver error you hit; which constants you
  edited and to what, including the status values from row 10; and the step 3 fidelity result per
  file type.

See also: [the Acquia DAM guide](acquia-dam.md) · [off-boarding](../offboarding.md) ·
[the CLI](../cli.md) · the other runbooks: [canto](canto-live-verify.md) ·
[imagerelay](imagerelay-live-verify.md) · [intelligencebank](intelligencebank-live-verify.md).
