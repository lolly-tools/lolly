# Orange Logic (kind: `orange-logic`)

Read-only discovery and permitted rendition access through Orange Logic's public Search API.
This connection reports `originals: false`: protected-original support awaits the separate
Extract Original Document API contract. TR1 and TRX must not be presented as original files.

## What you need

- The exact HTTPS origin of your organisation's Orange Logic environment, including a custom
  domain if applicable. Paths, URL credentials and wildcard origins are refused.
- A dedicated account allowed to use bearer authentication and the required Search fields and
  rendition formats. Choose an upstream subset appropriate for sharing through Work.
- An administrator query and explicit Work exposure groups. Shared service access does not
  reproduce each member's personal upstream permissions.

Use **Providers > Orange Logic** for the advanced setup form, or the existing provider CLI.
Missing formats are never generated. The connector makes no AI, upload, metadata-edit or
public-share creation calls.

## Credential shape

Use JSON with `clientId` and `clientSecret`, obtained for the organisation's application account.
The connector exchanges them on the configured origin, caches the token in its driver instance,
and refreshes once after an HTTP 401. Alternatively store a bearer token as plain text or JSON
with `bearerToken`. No browser consent flow or refresh-token blob is implemented for this kind.

Use the write-only credential panel or `lw providers credential orange-media`. Never put a
credential in options, argv or a source URL. A config-managed source uses `credentialRef` to name
an environment variable. An IP-bound token needs a stable outbound path for that Work instance.

## instance.json

```json
{
  "id": "orange-media",
  "kind": "orange-logic",
  "label": "Campaign renditions",
  "options": {
    "baseUrl": "https://dam.your-host.example",
    "query": "ParentFolderIdentifier:APPROVED",
    "formats": ["TR1", "WebHigh"],
    "storageOrigins": ["https://media.your-host.example"],
    "pageSize": 100,
    "minGapMs": 250,
    "approvalField": "Marketing.Status",
    "approvedValues": ["Published"]
  },
  "credentialRef": "ORANGE_LOGIC_READ_CREDENTIAL",
  "exposure": { "groups": ["design"], "requireApproved": true },
  "mapping": { "availabilityFields": { "from": "Marketing.Release", "until": "Marketing.Expiry" } },
  "sync": { "ttlSeconds": 300, "maxAssets": 100000 }
}
```

The example's custom fields and status values must be replaced with your tenant's actual
identifiers. With no approval mapping, approval is unknown. A configured approval field with
no matching value is false. Availability fields read exact returned metadata keys; use ISO
8601 dates. This is not a complete territory/channel/agreement rights evaluator.

## Verify

```bash
lw providers preview --kind orange-logic --options '{"baseUrl":"https://dam.your-host.example","query":"ParentFolderIdentifier:APPROVED"}' --shape
lw providers add orange-media --kind orange-logic --label "Campaign renditions" --options '{"baseUrl":"https://dam.your-host.example","query":"ParentFolderIdentifier:APPROVED"}'
lw providers credential orange-media
lw providers health orange-media
lw providers sync orange-media
lw providers enable orange-media
```

Inspect the sample, metadata, rendition labels and group access before enabling. Complete the
[tenant verification](orange-logic-live-verify.md). An HTTP success does not prove the selected
file's fidelity or an upstream rights clearance.

## Options

`baseUrl` is required. `query` is always combined with ordinary member text or ID lookups;
member text is escaped. `formats` defaults to `TR1` and `WebHigh`, at most twenty distinct proxy
codes. `storageOrigins` adds at most twenty exact HTTPS origins to the configured API origin;
storage reads carry no API bearer token and redirects are refused. It does not grant access
to arbitrary storage hosts. Existing Work egress policy also applies.

`pageSize` is 1-500, default 100. `minGapMs` is 0-60000, default 250, within one driver instance.
`approvalField` requires an explicit `approvedValues` list. There is no built-in approval or
availability field assumption. Use the vendor's List Fields/Criteria tools to establish mapping.

## Notes / limits

- Fixture-verified only. The endpoint is public Search v4 with forced JSON, numeric pages,
  binned assets excluded and format generation disabled. It does not enable semantic search
  or assume that an optional semantic result set is a full catalog.
- `SystemIdentifier` is the permanent remote key for this source. Returned file references
  include a fingerprint of the observed source edit/checksum fields and proxy code. A rename
  keeps asset identity; a changed selected source requires refresh. This is not historical
  revision retrieval or proof of an immutable proxy.
- Files are labelled with their rendition code and `role: rendition`. Records without an
  available requested format remain discoverable with no downloadable file. A representative
  document preview does not make a PDF or PowerPoint original available.
- Substituted/watermarked formats or paths carrying warnings are omitted. Resolution rechecks
  the record and current mapped policy before fetching its selected rendition. A missing,
  changed, substituted or disallowed file fails clearly.
- Public rendition paths are refreshed on access and never persisted in the feed. This does
  not make their bearer-link access model private or retract already downloaded bytes.
- A viewer's byte range is forwarded to the rendition read after the record and policy are
  checked again. A partial reply is served only when its `Content-Range` matches the request
  exactly and the body has that length; a storage origin that ignores ranges returns the whole
  file. See [byte ranges](../catalog.md) in the catalog guide.
- Pagination can continue without privileged totals. The connector constructs the next page
  itself, never follows a returned next-page URL. Work's sync/page caps still report truncation.
  Existing Work caches/pinned copies require an agreed source-change freshness bound.
- A 429 is returned without retrying. Aggregate request budgets, exact fields, token responses,
  proxies and storage origins need tenant qualification. Approval mappings do not imply AI
  processing authority or a complete rights policy.

## Off-boarding

Materialisation can copy the exposed renditions, with that limitation retained in metadata.
Work refuses DAM cutover for this source because protected originals are unsupported. Do not
schedule an original-preserving exit from a successful preview or rendition copy. Obtain the
protected API contract and implement/test original access first. See [offboarding](../offboarding.md).

Public contracts: [Search](https://developer.orangelogic.com/reference/search-api),
[fields and format limits](https://developer.orangelogic.com/reference/fields-parameter),
[authentication](https://developer.orangelogic.com/reference/authenticate).
