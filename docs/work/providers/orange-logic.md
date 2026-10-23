# Orange Logic (kind: `orange-logic`)

Connect an Orange Logic DAM so people can search it from Lolly Work and use the renditions it
already publishes, such as its `TR1` and `WebHigh` images, in their designs. Orange Logic stays
the source. Work reads through its public Search API and you decide which Work groups see which
results.

This connection works with renditions, not original files. Each file is labelled with its
rendition code, and Work refuses a cutover that would treat a rendition as the original. Moving
originals out of Orange Logic needs its separate Extract Original Document API, which this
connection does not use yet.

| You get | Not included |
|---|---|
| Search across an administrator-chosen query | Original files (`originals: false`) |
| The renditions you list, labelled as renditions | Generating missing renditions |
| Approval and dates from fields you choose | AI calls, uploads, metadata edits or new public shares |
| Byte ranges for large files | A DAM cutover |

## What you need

- **The exact HTTPS origin** of your Orange Logic environment, including a custom domain if you
  use one. Paths, credentials in the URL and wildcard origins are refused.
- **A dedicated account** allowed to use bearer authentication, the Search fields and the
  rendition formats you need. Choose an upstream subset that is right to share through Work.
- **An administrator query** and explicit Work exposure groups. A shared service account does
  not carry each member's own upstream permissions.

Use the advanced **Providers > Orange Logic** form or `lw`.

## Credential shape

JSON with `clientId` and `clientSecret` for your organisation's application account. Work
exchanges them on the configured origin, keeps the token in memory in its driver instance and
refreshes once after an HTTP 401. Alternatively, store a bearer token as plain text or as JSON
with `bearerToken`. There is no browser consent flow or refresh-token credential for this kind.

Use the write-only credential panel or `lw providers credential orange-media`, never options,
the command line or a source URL. A config-managed source gives, in `credentialRef`, the name of
an environment variable holding the credential. A token bound to an IP address needs a stable
outbound path from the Work instance.

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

Replace the example's custom fields and status values with your tenant's own. The vendor's List
Fields and Criteria tools show which exist.

::: details Options
| Option | Default | What it does |
|---|---|---|
| `baseUrl` (required) | | The exact HTTPS origin. |
| `query` | none | Always combined with members' search text or id lookups; member text is escaped. |
| `formats` | `TR1`, `WebHigh` | Up to twenty distinct rendition codes. |
| `storageOrigins` | none | Up to twenty more exact HTTPS origins for rendition files. Storage reads carry no API token and redirects are refused. Work's egress policy still applies. |
| `pageSize` | 100 | 1 to 500 per page. |
| `minGapMs` | 250 | 0 to 60,000 ms between requests within one driver instance. |
| `approvalField`, `approvedValues` | none | The field that marks approval and the values that count. A field needs an explicit value list. |
:::

**Approval and dates.** There is no built-in approval or availability field. With no approval
mapping, approval is unknown; with a field set, a record without a matching value is not
approved. Availability fields read the exact metadata keys returned, as ISO 8601 dates. This is
not a full territory, channel or agreement rights evaluator.

## Verify

```bash
lw providers preview --kind orange-logic --options '{"baseUrl":"https://dam.your-host.example","query":"ParentFolderIdentifier:APPROVED"}' --shape
lw providers add orange-media --kind orange-logic --label "Campaign renditions" --options '{"baseUrl":"https://dam.your-host.example","query":"ParentFolderIdentifier:APPROVED"}'
lw providers credential orange-media
lw providers health orange-media
lw providers sync orange-media
lw providers enable orange-media
```

Check the sample, metadata, rendition labels and group access before enabling, then run the
[Orange Logic check](tenant-check.md#orange-logic). A successful HTTP call proves neither the
file's fidelity nor an upstream rights clearance. Contributors changing the driver follow its
[maintainer runbook](orange-logic-live-verify.md) in the Lolly Work repository.

## Notes / limits

- **Not yet confirmed against a live tenant.** The endpoint is public Search v4 with JSON
  forced, numbered pages, binned assets excluded and format generation turned off. It does not
  turn on semantic search or treat a semantic result set as the full catalog.
- **Identity.** `SystemIdentifier` is the permanent id. A file reference includes a fingerprint
  of the source's edit and checksum fields and the rendition code, so a rename keeps the asset
  and a changed source needs a refresh. This is not retrieval of past revisions or proof that a
  rendition never changes.
- **Renditions only.** A record without any requested format stays searchable with no file to
  download. A document preview does not make a PDF or PowerPoint original available.
- **Substitutions refused.** Substituted or watermarked formats, and paths carrying warnings, are
  left out. Before fetching, Work checks the record and the mapped policy again; a missing,
  changed, substituted or disallowed file fails clearly.
- **Public rendition links** are refreshed on access and never stored in the catalog. That does
  not make their access private, and it cannot withdraw bytes already downloaded.
- **Byte ranges.** After the checks, a viewer's range request is forwarded to the rendition. A
  partial reply is served only when its `Content-Range` matches the request exactly and the body
  has that length; a storage origin that ignores ranges returns the whole file. See
  [Large catalogs](../catalog.md#large-catalogs).
- **Paging and caches.** Work builds each next page itself and never follows a returned next-page
  URL. Work's sync and page limits still report truncation, and cached or pinned copies need an
  agreed freshness bound.
- **Rate limits.** A `429` is passed back without retries. Request budgets, exact fields, token
  responses, proxies and storage origins all need checking on your tenant. An approval mapping
  grants no AI processing authority and is not a full rights policy.

## Off-boarding

Materialize can copy the exposed renditions, and the copies keep that limitation in their
metadata. Work refuses a DAM cutover for this source because protected originals are not
supported. Do not plan an original-preserving exit from a good preview or a rendition copy: the
protected-original API contract has to be obtained, built and tested first. Moving originals
later needs that contract and byte checks for the formats you need, including SVG, PDF and
PowerPoint. See [Leave a DAM](../offboarding.md).

Vendor references: [Search](https://developer.orangelogic.com/reference/search-api),
[fields and format limits](https://developer.orangelogic.com/reference/fields-parameter),
[authentication](https://developer.orangelogic.com/reference/authenticate).
