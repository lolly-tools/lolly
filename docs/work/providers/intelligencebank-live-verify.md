# IntelligenceBank live-verify runbook (kind: `intelligencebank`)

The tenant-day checklist for the [`intelligencebank` driver](intelligencebank.md). Every endpoint
path and field name in that driver comes from IntelligenceBank's public documentation and has
never been confirmed against a real tenant; this pass confirms them. Nothing here writes to the
tenant, and it takes about 30 minutes. The driver targets the v3 Graph API only - the one
v2-named call is the login handshake IntelligenceBank documents as the auth mechanism for v3.

## Before you start

- The tenant platform URL, e.g. `https://acme.intelligencebank.com`. A tenant on a custom domain
  needs its host added to the driver before anything works (row 21).
- The tenant API key for the login handshake: one sealed string, not a JSON blob.
- The workflow states your tenant treats as approved (row 14 - tenant-defined, so only your org
  knows them).
- On this instance: `catalog.provider.manage` for every step, plus `catalog.provider.credential`
  (owner-only) for the credential and `enable` in step 3. `drift` needs `catalog.provider.read`.
- One resource you can also download from the IntelligenceBank UI, for step 3.

## Step 1: auth

```bash
export LW_BASE=https://lolly.example
lw login                                   # device sign-in; or: lw login --cookie 'lw_session=…'

lw providers preview --kind intelligencebank \
    --options '{"platformUrl":"https://acme.intelligencebank.com"}'
```

The credential prompt is hidden - paste the API key. `preview` builds an ephemeral provider record,
asks the tenant and throws it away: nothing is created, stored or enabled, so a wrong option costs
a retry. `health ok` means the login handshake, the discovered v3 base and the first list call all
worked. Step 2 needs one resource id: re-run this command with `--json` and read `sample[].id`
(the last segment of `ext/preview/<id>`), because the printed table truncates that column.

| Symptom | What it means | What to fix |
|---|---|---|
| `health FAILED: intelligencebank login 401` (or `403`) | the login call was refused | The API key. |
| `health FAILED: intelligencebank login 404` | the login call reached a path that is not there | The login path and body (row 1). |
| `health FAILED: intelligencebank login returned no sid/apiV3url (live-verify: the login response field names …)` | the login succeeded and the driver could not read the response | Only the response key names are wrong: rows 2 and 3. |
| `health FAILED: intelligencebank api 401 for /resources?per_page=100&page=1` | the session was established and the v3 API refused it | The `sid`/`clientid` headers, not the login (row 4). |
| `health FAILED: intelligencebank platformUrl outside intelligencebank.com` | the host guard refused the URL you passed | A custom-domain tenant (row 21). |
| `health FAILED: intelligencebank apiV3url outside intelligencebank.com` | the login handed back a base off the family | Row 21. The guard stays on purpose: a poisoned login response must not redirect the driver. |

Exit code `2` means health failed. `--shape` calls the tenant only when health is ok.

## Step 2: capture the shape

One command, one file, using a resource id from step 1:

```bash
lw providers preview --kind intelligencebank --shape --remote-id r1 \
    --options '{"platformUrl":"https://acme.intelligencebank.com"}' > intelligencebank-shape.txt
```

The file holds two reports - the list call, then the `/resource/<id>` detail call the bytes come
from (rows 19 and 20). Both are key names and value types only: no values, no asset content, no
credential, and the prompt goes to stderr. Read the three groups in this order:

1. **EXPECTED BY THIS DRIVER, ABSENT** - the wrong guesses, and the answer this page exists for.
   Each entry reads `key|alternatives (CONSTANT_NAME)`, so it identifies the constant to widen.
   `(none)` means every guess matched.
2. **IN THE RESPONSE, NOT MAPPED** - what your tenant sent that the driver ignores. The fix for an
   absent guess is usually sitting here: ABSENT `expiry_date|review_date (AVAILABLE_UNTIL_KEYS)`
   beside NOT MAPPED `expiration` is one constant edit.
3. **MAPPED BY THIS DRIVER** - confirmed.

Read the `record:` block too. Keys are unioned across the page, so a key one resource omits does
not read as absent, and this is the governance-rich kind: a second expiry, a review cycle or a
rights window sitting in NOT MAPPED is worth reporting even though no row below asks for that field.

## The assumption table

One row per `LIVE-VERIFY` bullet in the driver header
(`server/src/catalog/providers/intelligencebank.ts`), the field-names bullet expanded per
constant. If a row and that header disagree, the header is right and this table is stale.

| # | The assumption | How the report answers it | Fix it in `providers/intelligencebank.ts` |
|---|---|---|---|
| 1 | The login call is `POST <platformUrl>/webapp/1.0/api/authenticate` with body `{"apikey": "…"}` | Not in the report: a wrong path or body fails step 1 as `intelligencebank login 404` before there is anything to report | The `fetchImpl` call inside `session()` - path and body together |
| 2 | The login response carries the session id as `sid`, then `session` | Not in the report - it is the handshake, not a list. A 200 the driver cannot read is step 1's third row, which identifies this constant | `SESSION_ID_KEYS` |
| 3 | The login response carries the v3 base as `apiV3url` | Same as row 2, same message | `API_BASE_KEYS` |
| 4 | The login response carries `clientid` (a header on every v3 call) and `expires_in` (the session TTL) | Not in the report. A missing `clientid` omits the header, so it shows as a `401` on the first v3 call; a missing `expires_in` falls back to a 30 minute session | `CLIENT_ID_KEYS` / `SESSION_TTL_KEYS` |
| 5 | Listing is `GET <apiV3url>/resources?per_page=100&page=<n>`, plus `folderid=<id>` when scoped | The first report line identifies the exact call; `envelope: resources: object[] (N)` says how many came back | `listPath` and `PAGE_SIZE` |
| 6 | The resource array rides `resources`, then `response` | The `record:` line identifies the key that held it, or says no record array was found and lists `resources\|response (LIST_ENVELOPE_KEYS)` under ABSENT with the real key in NOT MAPPED | `LIST_ENVELOPE_KEYS` |
| 7 | The next-page cursor is `meta.next_page` | `envelope: meta: { next_page: … }` shows both levels. ABSENT `meta (META_KEYS)` means the envelope calls it something else; a `meta` with a differently named cursor inside stops paging after page 1, silently | `META_KEYS` / `NEXT_PAGE_KEYS` |
| 8 | The resource id is `resourceid`, then `id` | ABSENT `resourceid\|id (RECORD_ID_KEYS)`. A resource with no readable id throws rather than federating silently | `RECORD_ID_KEYS` |
| 9 | The filename is `filename` and the title is `name` | ABSENT `filename\|name (FILENAME_KEYS / DISPLAY_NAME_KEYS)`, with the real names in NOT MAPPED | `FILENAME_KEYS` / `DISPLAY_NAME_KEYS` |
| 10 | The format is `extension` | ABSENT `extension (FORMAT_KEYS)`. Recoverable: the driver falls back to the filename extension | `FORMAT_KEYS` |
| 11 | The byte size is `size` | ABSENT `size (SIZE_KEYS)`. Whether the number is bytes is a value question - compare it against the UI in step 3 | `SIZE_KEYS` |
| 12 | The change stamp is `updated`, then `updated_date` | ABSENT `updated\|updated_date (UPDATED_AT_KEYS)`. `lw providers drift` compares this field, so a wrong guess reads as "nothing ever changes upstream" | `UPDATED_AT_KEYS` |
| 13 | Approval is a workflow state under `workflow_state`, then `status` | ABSENT `workflow_state\|status (WORKFLOW_STATE_KEYS)` | `WORKFLOW_STATE_KEYS` |
| 14 | The approved states are whatever `options.approvedStates` names; absent, approval is unfiltered | Not in the report - these are values. Set `approvedStates` and re-run step 1 (or `sync`): a page nothing matched prints `intelligencebank treated all N resource(s) on this page as not approved (live-verify: the workflow-state VALUES …)` | `options.approvedStates` on the provider entry, not a constant. Only your org can answer this row |
| 15 | Availability starts at `publish_date` | ABSENT `publish_date (AVAILABLE_FROM_KEYS)`, with the real name in NOT MAPPED | `AVAILABLE_FROM_KEYS` |
| 16 | Availability ends at `expiry_date`, then `review_date` | ABSENT `expiry_date\|review_date (AVAILABLE_UNTIL_KEYS)`. Check the order: the driver takes the first it finds, report cases where your tenant carries both and means different things by them | `AVAILABLE_UNTIL_KEYS` |
| 17 | The folder is `folder`, and its name is `folder.name` | `folder: { id: string, name: string }` in the `record:` block shows both levels. ABSENT `folder (FOLDER_KEYS)` means no folder section is ever read | `FOLDER_KEYS` / `FOLDER_NAME_KEYS` |
| 18 | Categories ride `category`, and fold into sections beside the folder name | ABSENT `category (CATEGORY_KEYS)`. A string or an array of strings both work | `CATEGORY_KEYS` |
| 19 | The single-resource call is `GET <apiV3url>/resource/<id>`, wrapping the record in `resource` (or nothing) | The detail report identifies the wrapper the tenant used, or says the record came back unwrapped. Left unfixed it fails in step 3 with `intelligencebank resource has no download url in the response to GET /resource/<id> (live-verify: …)` | `DETAIL_WRAPPER_KEYS`, and the `path` in `resolveBlob` |
| 20 | The signed link is `download_url`, and it serves the original bytes | The name is in the detail report: ABSENT `download_url (DOWNLOAD_URL_KEYS)` with the real name in NOT MAPPED. Whether it serves the original is a value question - step 3's checksum answers it | `DOWNLOAD_URL_KEYS` |
| 21 | Every host - platform, discovered v3 base and CDN - is inside the `intelligencebank.com` family | Not in the report. Each guard has its own message: `platformUrl outside`, `apiV3url outside`, or `url outside allowed hosts` on the blob fetch | `ALLOWED_HOSTS` - add the custom domain explicitly, never as a wildcard |

## Step 3: bytes

Only a blob fetch proves the export capability the exit depends on, so this step creates a real
provider record.

```bash
lw providers add acme-ib --kind intelligencebank --label "Acme IntelligenceBank" \
    --options '{"platformUrl":"https://acme.intelligencebank.com","folderId":"f1","approvedStates":["Approved","Published"]}' \
    --exposure '{"groups":["admin"]}'    # verification pass: admins only, not the whole org
lw providers credential acme-ib          # hidden prompt, same API key as step 1
lw providers enable acme-ib              # owner-only
lw providers sync acme-ib                # federate: confirm the count, read any notes
lw providers materialize acme-ib --remote-id r1 --json
```

`--remote-id` filters the walk rather than skipping it, so keep `options.folderId` narrow. Every
per-asset failure prints under the summary as `<remoteId>: <message>`, and each message identifies the
assumption, the constant and this page. A materialize that fails partway through and then works on
a re-run is the session TTL (row 4).

Fidelity - the true original, or a rendition?

```bash
curl -sS -b "$(cat ~/.config/lolly-work/session)" \
    "$LW_BASE/catalog/ext/acme-ib/r1/download" -o /tmp/ib-lolly.bin
shasum -a 256 /tmp/ib-lolly.bin
file /tmp/ib-lolly.bin
```

Download the same resource from the IntelligenceBank UI as the original and checksum that too.
A matching checksum strikes row 20. A different one means the link is a rendition or a preview -
compare sizes, pixel dimensions and EXIF/ICC metadata, and report it as row 20 rather than a
materialize bug (materialize checksums whatever it is given, so a rendition arrives silently as the
wrong bytes). Repeat per file type you plan to exit: a governance-rich DAM often serves office and
design files through a different link than images. A failure on the blob route surfaces as
`502 PROVIDER_UNAVAILABLE`; the diagnosis is in the materialize output, not there.

Last, the stamp the exit cadence depends on:

```bash
lw providers drift acme-ib
```

`compared` counts only the copies that got a real answer; every other copy prints under its own
reason. `not compared: … carries no change stamp the driver can read` and `… would not parse as a
date (shape …)` are both row 12 - send the shape it prints. `… no longer in the listing at all`
means those resources left the scope you federated. `read with care: … names no timezone` did
compare, in this server's timezone, so those answers can be off by its UTC offset.

Then take the pass down. Materialized copies are instance-owned and survive the delete:

```bash
lw providers disable acme-ib
lw providers rm acme-ib
```

## Step 4: sign off

- **In `server/src/catalog/providers/intelligencebank.ts`**: strike the `LIVE-VERIFY` bullets this
  pass exercised and only those: the login response holds three separate assumptions (rows 2 to 4),
  so confirm them one at a time. This is where "confirmed against a live tenant on `<date>`" becomes
  true and may be written, naming the date and whether the tenant was on `*.intelligencebank.com`
  or a custom domain.
- **Where a guess was wrong**, widen rather than replace - `UPDATED_AT_KEYS = ['updated',
  'updated_date']` exists because the next tenant may answer differently. Then pin it: a fixture
  case in `tests/provider-shape.test.ts` for the key set, and one in
  `tests/provider-live-verify.test.ts` if a failure path changed.
- **In the guides**: the fixture-verified paragraph in [`providers/README.md`](README.md) and the
  readiness row in [`offboarding.md`](../offboarding.md) are where the "live confirmation open"
  claim lives. Both should now say what was confirmed, on what date, and what remains open.
- **Send back**: `intelligencebank-shape.txt`; the verbatim text of any driver error you hit; which
  constants you edited and to what, including the workflow-state values from row 14; the step 3
  fidelity result per file type; and any governance field your tenant carries that the driver does
  not read.

See also: [the IntelligenceBank guide](intelligencebank.md) · [off-boarding](../offboarding.md) ·
[the CLI](../cli.md) · the other runbooks: [canto](canto-live-verify.md) ·
[imagerelay](imagerelay-live-verify.md) · [acquia-dam](acquia-dam-live-verify.md) ·
[cloudinary](cloudinary-live-verify.md) · [orange-logic](orange-logic-live-verify.md) ·
[webdav](webdav-live-verify.md).
