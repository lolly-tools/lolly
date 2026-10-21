# Cloudinary tenant verification

This is the live qualification pass for the [Cloudinary source](cloudinary.md). Fixture tests
do not establish entitlement, permissions, rate limits or byte fidelity for your environment.

1. Confirm cloud name, regional API host, Search/Admin access and access to asset-ID downloads.
   Create a representative test folder with ordinary images, SVG, PDF, PowerPoint, audio and
   video, plus private/authenticated files. Set an agreed spend ceiling before reading.
2. Run `lw providers preview --kind cloudinary --shape --options '{"cloudName":"your-cloud","assetFolder":"Brand/Approved","minGapMs":7500}'`.
   Inspect `resources`, `asset_id`, `version`, `format`, `resource_type`, `type`, `asset_folder`,
   `tags` and `context`. The source constants/options live in
   `server/src/catalog/providers/cloudinary.ts`; do not broaden access to obtain a convenient count.
3. Test the same options through the normal advanced provider form or CLI. Save disabled,
   seal the credential, sync and inspect groups and exposure before activation. Missing
   approval metadata must not become approved. Verify date boundaries and timezone handling.
4. Fetch a representative original through its returned Work catalog URL using an authorised
   Work session. Compare SHA-256 and byte count with the platform original. Verify private,
   authenticated and raw files, and inspect credentials in the resulting bytes independently.
5. Rename/move the asset and repeat. Its immutable ID must remain stable; moving outside the
   configured folder must deny new upstream resolution. Overwrite the source and verify that
   the old selected version fails clearly. Test removal and credential revocation.
6. Use two Work members in different groups. Check cards, results, counts, thumbnails and
   originals. Confirm that a service credential's broader visibility never becomes member access.
7. Exercise pagination, a rate limit, outage and recovery. Record actual request/credit usage,
   inherited cache freshness and concurrent-caller limits. If using structured metadata,
   record its entitlement and whether the field appears in both list and detail.
8. Materialise a sample and inspect checksums and retained metadata before scheduling an exit.
   Record what proof/rights/history data requires a separate export.

Keep evidence outside the repository: test date, API region, account entitlements, redacted
shape report, original/output hashes, permission outcomes, request counts and unresolved gaps.
Never retain credentials, signed URLs or customer file contents in a fixture. A 401 is an
authentication failure, 403 a permission/entitlement issue, and 429 a shared request budget issue.
Source changes require rerunning affected checks before calling the connector tenant-qualified.
