# Orange Logic tenant verification

Qualify the [rendition source](orange-logic.md) against your actual tenant. Protected-original
support is pending its API contract; this pass cannot establish original-preserving migration.

1. Confirm the exact tenant origin, bearer-enabled application account, approved source query,
   public Search v4 entitlement and required field/format permissions. Record the installed release.
2. Run `lw providers preview --kind orange-logic --shape --options '{"baseUrl":"https://dam.your-host.example","query":"ParentFolderIdentifier:APPROVED"}'`.
   Inspect `APIResponse.Items`, `SystemIdentifier`, source edit/checksum fields, folder fields,
   `Keywords` and the configured `Path_` objects. Driver mapping is in
   `server/src/catalog/providers/orange-logic.ts`, including `SEARCH_FIELDS` and configured fields.
3. Repeat with `--remote-id` for a known record. Confirm the same query scope applies to detail.
   Test an absent, outside-scope and inaccessible ID. Do not request broad search authority just
   to obtain `GlobalInfo.TotalCount`.
4. Verify client credentials, token lifetime, IP affinity and one expired-token recovery.
   Confirm that failures disclose neither source values nor credentials. Establish a shared
   request budget, including parallel callers and retries outside the driver.
5. Test an image, document, audio, video and metadata-only record. Compare downloaded Work bytes
   with the exact permitted rendition, including format, dimensions and any watermark. Check
   that missing proxies do not trigger generation and substitutes are not silently accepted.
   Request one byte range of a large document through Work and compare it with the same range
   of the rendition. Record whether the storage origin answers `206` or ignores ranges.
6. If storage uses another origin, review and add only that exact HTTPS origin to `storageOrigins`.
   Keep API credentials on the tenant API. Redirects, including same-origin redirects, are refused;
   use a canonical documented origin rather than weakening the guard.
7. Configure real approval/availability fields and test absent values, denied approval, expiry
   and future release. Verify that the source descriptions and file labels still state the
   rendition limitation. Test two Work groups across browse, search, previews and file access.
8. Change a source, revoke access and remove a record. Test stale file references, fresh lookup,
   sync/caching delay and outage recovery. Agree that freshness bound explicitly. Do not claim
   that a public link already received elsewhere is immediately revoked by Work.
9. Materialise a rendition sample and confirm the metadata remains explicit. Attempting cutover
   must fail before identity, grants, aliases or provider activation state change.

Retain test date/release, redacted shape, proxy codes, sample hashes, access results and unresolved
assumptions outside the repository. Do not retain signed URLs, customer bytes or tokens. A future
original adapter needs the actual Extract Original Document API contract and byte checks for
the required formats, including SVG, PDF and PowerPoint, before changing the declared capability.
