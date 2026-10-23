# Canto live-verify runbook (kind: `canto`)

The tenant-day checklist for the [`canto` driver](canto.md). Every endpoint path and field name
in that driver comes from Canto's public documentation and none of it has been confirmed against
a real tenant; this pass confirms the driver against your tenant. Steps 1 and 2 store nothing; step 3 writes only
into your own store. About 30 minutes.

## Before you start

- A Canto tenant you are allowed to test against: its subdomain (`acme` in
  `https://acme.canto.com`) and its regional domain (`com`, `global` or `de`).
- The sealed OAuth blob, `{"clientId":"…","clientSecret":"…","refreshToken":"…"}`. The client
  id and secret are the App ID and Secret of an API key a Canto admin creates under
  *Settings > Configuration Options > API Keys*: Lolly Work registers no Canto app (BYOT).
- A refresh token minted against that App ID, obtained by hand through Canto's own documented
  authorization-code flow: `lw providers auth` registers no consent flow for this kind. Record
  the authorize and token URLs you used; confirming them is rows 2 and 2a.
- `catalog.provider.manage` on this instance, plus `catalog.provider.credential` (owner-only)
  for the credential and `enable` in step 3.
- One asset per scheme you plan to exit that you can also open in the Canto UI, for step 3.

## Step 1: auth

```bash
export LW_BASE=https://lolly.example
lw login                                   # device sign-in; or: lw login --cookie 'lw_session=…'

lw providers preview --kind canto --options '{"tenant":"acme","domain":"com"}'
```

The credential prompt is hidden; paste the blob on one line. `health ok - canto` followed by a
`mapped sample` table means the token exchange and the first list call both worked. Exit code
`2` means health failed.

| Symptom | What it means | Fix |
|---|---|---|
| `health FAILED: oauth token refresh failed (400)` | The token endpoint read the form and rejected the request SHAPE: a different grant, the client secret wanted in an `Authorization` header, a required scope or audience param. Re-capturing the credential cannot help | Row 2a: `getAccessToken` in `providers/oauth.ts` |
| `health FAILED: oauth token refresh failed (401)` | The credential: App ID/Secret wrong, refresh token wrong, or the grant revoked | Re-capture the blob with `lw providers credential` |
| `health FAILED: oauth token refresh failed (404)` or `(405)` | The token URL is wrong | Row 2: `options.tokenUrl` |
| `health FAILED: canto api 401 for /image?limit=100&start=0` | The token minted and Canto refused the token. `403` here usually means API access is not on this contract tier: settle that before spending the session | The grant or the contract, not the code |
| `health FAILED: canto api 404 for /image?limit=100&start=0` | The REST base or the scheme list path is wrong | Rows 1 and 3 |
| `health FAILED: canto url outside allowed hosts` | An `options.baseUrl` or `options.tokenUrl` override points off the `canto.com` / `.global` / `.de` family | The override, or `ALLOWED_HOSTS` |

## Step 2: capture the shape

```bash
lw providers preview --kind canto --shape \
    --options '{"tenant":"acme","domain":"com"}' > canto-shape.txt
```

Shape mode lists no sample and returns no values: key names and types only, so that file is
sendable as it stands (the credential prompt goes to stderr). It runs only when health is ok.

```
canto  GET /api/v1/image?limit=100&start=0
  envelope: results: object[] (100) · found: number · limit: number · start: number
  record: (100 under "results", keys unioned)
    id: string · scheme: string · name: string · size: number · lastModified: string
    tag: string[] · album: string · additional: { Expiry Date: string, Campaign: string }
    thumbnailUrl: string
  MAPPED BY THIS DRIVER: results · id · name · scheme · size · lastModified · tag · album
    additional
  IN THE RESPONSE, NOT MAPPED: found · limit · start · thumbnailUrl
  EXPECTED BY THIS DRIVER, ABSENT: approvalStatus (APPROVAL_STATE_KEYS)
```

- **EXPECTED BY THIS DRIVER, ABSENT** is the answer. Each entry reads
  `key|alternatives (CONSTANT_NAME)`, so it identifies the constant to widen; `(none)` means every
  guess matched.
- **IN THE RESPONSE, NOT MAPPED** holds the replacement: an ABSENT `id (RECORD_ID_KEYS)` beside
  a NOT MAPPED `assetId` is one constant edit.
- Record keys are unioned across the page, and the folding pairs (`tag`+`keyword`,
  `album`+`folder`) pass the diff on either half, so read the `record:` block to see which half
  this tenant sends.

`--shape --remote-id <id>` answers that this driver makes no per-asset detail call: Canto's
bytes stream from a path built out of the list record, so rows 17 and 18 are settled in step 3.

## The assumption table

One row per `LIVE-VERIFY` bullet in the driver header
(`server/src/catalog/providers/canto.ts`), with the record-field bullet expanded per constant.
If a row and that header disagree, the header is right and this table is stale.

| # | The assumption | How the report answers it | Fix it in `providers/canto.ts` |
|---|---|---|---|
| 1 | The REST base is `https://<tenant>.canto.<domain>/api/v1` | Not in the diff: the report's first line prints the path it called. A wrong base fails step 1 as `canto api 404` or a DNS error | `options.baseUrl`; the default is built in `createCantoProvider` |
| 2 | The token endpoint is `https://oauth.canto.<domain>/oauth/api/oauth2/token` | Not in the report: a wrong one fails before any API call | `options.tokenUrl`; the host stays pinned to the canto family either way |
| 2a | The token EXCHANGE is an RFC 6749 form POST: `grant_type=refresh_token` with `client_id`/`client_secret` in the body | Not in the report either. A different grant, or the secret wanted in a header, or an extra scope param, fails step 1 with `oauth token refresh failed (400)` | `getAccessToken` in `providers/oauth.ts`, shared with every OAuth kind; a Canto-only quirk goes in its `extraParams`, not in the shared body |
| 3 | Canto lists by scheme (`image`, `video`, `audio`, `document`, `presentation`, `other`) with `limit`/`start` paging | The first line identifies the exact call; `envelope: results: object[] (N)` says how many came back. A scheme Canto does not have fails as an api error; a paging param it ignores shows as an N you did not ask for | `SCHEMES` and `PAGE_SIZE` |
| 4 | Album scoping is `/album/<id>?limit&start`; search is `/search?keyword=` | Re-run step 2 with `--options '{"tenant":"acme","albumId":"AB12C"}'` and the report identifies the album path. Search is not exercised by preview | `listPath` for the album arm, `searchAssets` for the keyword param |
| 5 | The record array rides `results`, then `assets`, `data` | The `record:` line identifies the key that held it, or says no record array was found and lists `results\|assets\|data (LIST_ENVELOPE_KEYS)` under ABSENT with the real key in NOT MAPPED | `LIST_ENVELOPE_KEYS` |
| 6 | The id is `id`, and ids stay inside `[A-Za-z0-9._-]` | ABSENT `id (RECORD_ID_KEYS)` when the name is wrong. The charset is a value, so it never reaches the report: it shows in step 1 as `N record(s) SKIPPED` | `RECORD_ID_KEYS`; the charset lives in the `REMOTE_ID` regex |
| 7 | Every record carries its own `scheme`, search hits and album records included | ABSENT `scheme (SCHEME_KEYS)`. Album records carrying no scheme are dropped rather than falling back on the walked one, so re-run step 1 with `albumId` set and watch `SKIPPED` | `SCHEME_KEYS`; the walked-scheme fallback is in `toAsset` |
| 8 | The filename is `name` and the title is `displayName` | ABSENT `name\|displayName (FILENAME_KEYS / DISPLAY_NAME_KEYS)`, with the real names in NOT MAPPED | `FILENAME_KEYS` / `DISPLAY_NAME_KEYS` |
| 9 | The byte size is `size` | ABSENT `size (SIZE_KEYS)`. Whether the number is bytes is not in the report: compare it against what Canto shows for the file in step 3 | `SIZE_KEYS` |
| 10 | The change stamp is `lastModified`, then `lastUploaded`, `time` | ABSENT `lastModified\|lastUploaded\|time (UPDATED_AT_KEYS)`. `lw providers drift` compares this field, so a wrong guess reads as "nothing ever changes upstream" | `UPDATED_AT_KEYS` |
| 11 | Approval rides `approvalStatus` | ABSENT `approvalStatus (APPROVAL_STATE_KEYS)` | `APPROVAL_STATE_KEYS` |
| 12 | Tags fold `tag` and `keyword` | These fold rather than fall back, so ABSENT `tag\|keyword (TAG_KEYS)` appears only when neither is there | `TAG_KEYS` |
| 13 | Sections fold `album` and `folder` | Same folding rule as row 12: ABSENT `album\|folder (SECTION_KEYS)` only when neither exists | `SECTION_KEYS` |
| 14 | The approved states are `approved`, against `pending` / `restricted` | Not in the report: these are values. Step 1 prints the note `canto treated all N asset(s) on this page as not approved (live-verify: the approval-state VALUES …)` when nothing matched | `options.approvedStates`; `APPROVAL_STATE_KEYS` only if the key is wrong too |
| 15 | Custom fields ride `additional`, then `customFields` | The report descends one level and identifies the bag and the fields inside it: `additional: { Expiry Date: string, … }`. ABSENT `additional\|customFields (CUSTOM_FIELD_BAG_KEYS)` when neither exists | `CUSTOM_FIELD_BAG_KEYS`; the field name inside the bag is `mapping.availabilityFields` on the entry |
| 16 | Canto exposes no native scheduled-expiry field, so availability is mapped by hand | The `record:` block answers it: a native expiry or release date would show in NOT MAPPED. Report one if it is there | Report first. The pattern to copy is `AVAILABLE_UNTIL_KEYS` in `intelligencebank.ts` |
| 17 | Original bytes stream from `/api_binary/v1/<scheme>/<id>`, and they are the true original for that scheme rather than a rendition | Not in the report, which lists and never fetches: it prints that path as a note. Step 3 answers it | `BINARY_PATH` |
| 18 | Previews and downloads never ride a host outside the `canto.com` / `.global` / `.de` family | Not in the report. A CDN host outside it fails a blob fetch with `canto url outside allowed hosts` | `ALLOWED_HOSTS`: add the host explicitly, never as a wildcard |
| 19 | Trashed records either stay out of listings or carry a positive marker | Look for a `deleted` / `trashed` / `status` key in NOT MAPPED. Nothing in this driver drops trashed records today | Add a `DELETED_KEYS` constant and the positive drop, copying `DELETED_KEYS` in `imagerelay.ts` |
| 20 | About 3 requests/second stays under Canto's unpublished rate limit | Not in the report. A `429` during the step 3 walk is the answer | `options.minGapMs` (default `DEFAULT_GAP_MS`, 350ms) |

## Step 3: bytes

Only a blob fetch proves the export capability the exit depends on, so this step creates a real
provider record.

```bash
lw providers add acme-canto --kind canto --label "Acme Canto" \
    --options '{"tenant":"acme","domain":"com","albumId":"AB12C"}' \
    --exposure '{"groups":["admin"]}'   # verification pass: admins only, not the whole org
lw providers credential acme-canto      # same blob as step 1, prompt hidden
lw providers enable acme-canto          # owner-only
lw providers sync acme-canto            # federation proof: read the count and any notes
lw providers materialize acme-canto --remote-id image:AB12C --json
```

`--remote-id` filters the walk rather than skipping it, so `options.albumId` is what keeps the
pass short. Every per-asset failure prints under the summary as `<remoteId>: <message>`, and
each message identifies the assumption that broke, the constant to edit and this page.

**The fidelity check** (true original, or a recompressed rendition?):

```bash
curl -sS -b "$(cat ~/.config/lolly-work/session)" \
    "$LW_BASE/catalog/ext/acme-canto/image:AB12C/download" -o /tmp/canto-lolly.bin
shasum -a 256 /tmp/canto-lolly.bin
file /tmp/canto-lolly.bin
```

Download the same asset from the Canto UI as the original and checksum that too. A match means
`api_binary` served the true original for that scheme: strike row 17 for that scheme. A smaller file,
different pixel dimensions or stripped EXIF/ICC means the path served a rendition, which is row
17 and not a materialize bug: materialize checksums whatever it is given. The path is
scheme-scoped, so repeat this per scheme you plan to exit. A driver failure on this route
surfaces as `502 PROVIDER_UNAVAILABLE`; the diagnosis is in the materialize output.

Last, `lw providers drift acme-canto`. Every copy that could not be compared is counted under
its own reason, so a zero cannot read as a clean bill of health: no readable change stamp means
row 10 is wrong, and an unparsable one prints its shape (digits `N`, letters `A`) to report.

Then take the pass down. Materialized copies are instance-owned and survive the delete:

```bash
lw providers disable acme-canto
lw providers rm acme-canto
```

## Step 4: sign off

**In the driver** (`server/src/catalog/providers/canto.ts`): strike the `LIVE-VERIFY` bullets
this pass actually exercised and only those. An album arm you never ran and a scheme you never
fetched stay on the list. Name the date and the tenant class (native Canto, or an Image Relay
tenant the vendor migration carried across).

**Where a guess was wrong**, widen rather than replace: add the real key and keep the old ones.
Then pin it with a fixture case in `tests/provider-shape.test.ts`, and one in
`tests/provider-live-verify.test.ts` if the failure path changed.

**In the guides**: the *Notes / limits* caveat in [`canto.md`](canto.md), the fixture-verified
paragraph in [`providers/README.md`](README.md) and the readiness row in
[`offboarding.md`](../offboarding.md) all say this driver is fixture-verified only. All three
should now say what was confirmed, on what date, and what remains open.

**Send back**: `canto-shape.txt`, the verbatim text of any driver error you hit, which constants
you edited and to what, and the step 3 fidelity result per scheme.

See also: [the Canto guide](canto.md) · [off-boarding](../offboarding.md) ·
[the CLI](../cli.md) · the other runbooks:
[imagerelay](imagerelay-live-verify.md) · [intelligencebank](intelligencebank-live-verify.md) ·
[acquia-dam](acquia-dam-live-verify.md) · [cloudinary](cloudinary-live-verify.md) ·
[orange-logic](orange-logic-live-verify.md) · [webdav](webdav-live-verify.md).
