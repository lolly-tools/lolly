# Leave a DAM

Leaving is an optional stage of a connected workflow. A DAM can remain the source of record for as long as the organisation chooses. Start with [Use Lolly with your existing DAM](/info/use-with-dam.html) if you are connecting a library; use [Plan a DAM transition](/info/dam-transition.html) to agree responsibilities, acceptance and recovery before running the commands below.

Choose where the library should live before planning the copy. Prefer open-source services
your organisation can operate, with control over the hosting location, access, keys and
recovery. Lolly Work can manage the replacement library, or connect to files you have moved
to another supported source. Start early enough to verify the result before retiring the DAM.

<!--i:eti-map-pin-->
## Choose your offboarding path

::: figure work-offboarding-paths
Choose an offboarding destination. Open a path for its steps: self-host Lolly Work, use Nextcloud or Git, or upload to an existing hosted drive.
:::

The first path supports Lolly Work's materialize and cutover commands for qualified sources. The
other paths use a separate vendor export and file transfer, followed by a read-only Lolly Work
connection. Their new source identities do not automatically inherit the old DAM's addresses.

::: details Compare transfer methods
| Destination | How files get there | Continue with |
|---|---|---|
| Self-hosted Lolly Work with PostgreSQL or S3-compatible storage | Lolly Work materializes files into its own blob store; supported cutover creates aliases for copied assets | [Library managed by Lolly Work](#self-host-lolly-work-with-s3-storage) |
| Nextcloud or another WebDAV server you run | Export and copy with your own file tools, then connect Lolly Work read-only | [Nextcloud library](#move-to-nextcloud-or-another-webdav-server) |
| Git on a self-hosted forge | Export, review and commit files plus a manifest, then connect Lolly Work read-only | [Git catalog](#keep-a-catalog-in-git) |
| Google Drive, OneDrive / SharePoint or Dropbox | Export and upload with the drive's tools, then connect Lolly Work read-only | [Hosted drive](#move-to-a-hosted-drive) |
:::

For a supported exit into Lolly Work, the sequence is:

::: timeline
- <!--i:link--> **Federate.** Connect the DAM as a read-only provider and confirm that `lw providers sync` returns what you expect.
- <!--i:download--> **Pin.** Copy the files into your own store with `lw providers materialize`. Assets keep their `ext/*` identity; only where the bytes come from changes.
- <!--i:clock--> **Re-run on a cadence.** `lw providers drift` shows which copies the upstream has changed since. Re-run the copy until the upstream goes quiet.
- <!--i:lock--> **Cut over.** `lw providers cutover` moves identities from `ext/*` to `inst/*`, writes aliases for every old address and turns the provider off.
:::

Connecting each kind is in [the provider guides](providers/README.md), one per kind.

<!--i:eti-home-->
## Self-host Lolly Work with S3 storage

A practical destination is Lolly for creating content, a self-hosted Lolly Work instance for
sign-in, catalog metadata, shared projects and governance, and a private S3-compatible store for
the instance's files. Choose a [Lolly Work installation path](self-host.md) with durable PostgreSQL,
your own address and sign-in. The public demo's memory storage is not a migration destination.

::: warning Choose the blob store before the first copy
Choose where the bytes will live before the first materialize. Changing `blobs.driver` later does
not transfer existing blobs; plan an explicit storage migration if the instance already holds files.
:::

PostgreSQL is the default blob
store and needs no separate object-storage service. For larger libraries, Ceph RGW or MinIO
lets the organisation run the object store too. A hosted S3-compatible service, including
AWS S3, is another option. Set this block in the destination instance's configuration:

```json
{
  "blobs": {
    "driver": "s3",
    "s3": {
      "bucket": "lolly-assets",
      "region": "us-east-1",
      "endpoint": "https://objects.your-host.example",
      "prefix": "inst"
    }
  }
}
```

Use your store's region and endpoint; omit `endpoint` for AWS S3. Supply the separate
`LW_BLOBS_S3_CREDENTIAL` environment secret as `<accessKeyId>:<secretAccessKey>` through your
deployment's secret mechanism. Follow the [blob permissions, limits and integrity
settings](configuration.md#blob-limits-and-integrity), including multipart upload permissions
and cleanup. This is a configuration fragment, not a complete instance configuration.

Three S3 connections serve different purposes:

| Connection | Purpose in a transition |
|---|---|
| Lolly Work's `blobs.driver: "s3"` | Writable instance storage receiving materialized assets; Lolly Work keeps their metadata and aliases in PostgreSQL |
| The [S3 catalog source](providers/s3.md) | Read-only access to files already in a bucket; adding this source does not choose the destination for materialize |
| An [S3 delivery destination](delivery.md) | Explicitly sends finished exports to a bucket; it does not move the source library |

Keep the DAM connected while you rehearse a small, permitted copy into that store. Check
original checksums, every required attachment, mapped approval and availability, and member
access. Inventory unmapped metadata, taxonomy, rights evidence, history and publishing links;
obtain separate exports or replacement processes for the records the connector does not carry.
The [per-DAM readiness table](#exit-readiness-by-kind) determines whether cutover is supported.

Back up PostgreSQL, the object store, configuration and the secrets needed for recovery together,
then rehearse a restore with the [backup and restore guide](operations.md#backup-and-restore).
A bucket alone cannot reconstruct the catalog, grants or old-address aliases.

Agree a final source freeze, re-run materialize and inspect drift alongside direct file checks.
Drift is limited by the source timestamps it receives, so a quiet report alone is insufficient.
Run the supported cutover only after acceptance, then test old references and everyday review
and delivery work. Keep the source and recovery evidence until the organisation accepts the
result. [Plan a DAM transition](/info/dam-transition.html) covers ownership and team adoption.

<!--i:eti-folder-shared-->
## Move to Nextcloud or another WebDAV server

Choose this path when people should manage ordinary folders in a file service your organisation
runs. Nextcloud is an open-source option. Lolly Work can read the resulting library through its
[WebDAV / Nextcloud source](providers/webdav.md).

1. Obtain a permitted export of the DAM originals and the metadata, rights and history records
   you need. Keep a mapping from old asset and attachment ids to the exported files.
2. Copy those files into the selected folder with Nextcloud's upload or sync tools, or a
   [WebDAV client](https://docs.nextcloud.com/server/latest/user_manual/en/files/access_webdav.html).
   Compare checksums and set folder permissions on the destination.
3. Connect a narrow root through the WebDAV guide, test an original and allowed and refused
   Lolly Work members, and check the complete inventory within the connector's walk limits.
4. Plan replacement links and governance explicitly. Lolly Work's WebDAV source is read-only;
   materialize writes to Lolly Work's own blob store and cannot send a DAM library to this folder.

Keep metadata exports beside the files where appropriate, but verify which fields Lolly Work actually
maps. A folder copy does not reconstruct approval history or rights evidence. Back up the file
service and test recovery before retiring the DAM.

<!--i:eti-code-->
## Keep a catalog in Git

A self-hosted forge such as Gitea can suit a small, curated set of logos, fonts and other files
reviewed with a catalog manifest. Export the permitted files, commit them and the manifest, then
follow the [Git source guide](providers/git.md) to connect the raw-content endpoint.

This is a separate export and repository workflow; Lolly Work does not push into Git. Agree file-size
limits, repository access, metadata mappings and replacement references. Lolly Work reads the selected
branch, so Git history alone does not pin an existing design to a historical revision.

<!--i:eti-globe-->
## Move to a hosted drive

Google Drive, OneDrive / SharePoint and Dropbox are optional destinations when the organisation
already uses those vendor-operated services. The self-hosted paths above offer control over
the service operator as well as the files. For a hosted drive, review account ownership, hosting
region, access, retention and the ability to export again before choosing the destination.

Export permitted DAM originals and supporting records first. Upload with the drive's own tools,
then connect the new folder to Lolly Work using its provider guide. Lolly Work's drive connectors are
read-only: there is no direct DAM-to-drive materialize, publishing or cutover writer.

| Destination | Lolly Work connection and listing limits | Upload guidance |
|---|---|---|
| [Google Drive](providers/gdrive.md#use-as-an-offboarding-destination) | One folder, and its subfolders when `recursive` is on; native Docs, Sheets and Slides are skipped; no imported approval or availability dates | [Upload files and folders](https://support.google.com/drive/answer/2424368) |
| [OneDrive / SharePoint](providers/o365.md#use-as-an-offboarding-destination) | One folder level; subfolders are not walked; search covers the whole drive, so test exposure carefully | [Upload to a drive or library](https://support.microsoft.com/en-us/sharepoint/documents-and-library/upload-files-and-folders-to-a-library) |
| [Dropbox](providers/dropbox.md#use-as-an-offboarding-destination) | Recursive listing includes subfolders; file ids survive renames and moves | Use the service's upload or sync tools, then follow the provider guide |

Compare downloaded destination bytes with the exported originals. Keep ordinary files rather
than converting originals to cloud-native documents if Lolly must use the same bytes. Rebuild
access and required approval or expiry controls, keep unmapped metadata and historical records
separately, and update saved designs and published links for the new source identities. The
Lolly Work cutover's old-address aliases do not apply to this separate transfer.

<!--i:eti-clock-->
## When to start

Copy the files as soon as federation works:

- **Pin as soon as `lw providers sync` returns what you expect.** Bytes in your own store survive
  vendor migrations, tenant renames, plan downgrades and API sunsets.
- **Do not rely on holds to keep originals.** A hold on a federated asset copies its bytes while
  the identity stays `ext/*`, but if the provider is already disabled or the upstream is down,
  the hold still applies and the lifecycle row reads `pinned: false`
  ([holds](catalog.md#holds)).
- **Re-run the copy on a cadence.** It is idempotent per provider and remote id: the instance id
  is deterministic and blobs overwrite, so a re-run resumes rather than duplicates. An asset
  that failed once (an upstream hiccup, a format served by redirect) is reported on its own
  without stopping the batch.
- **Use `lw providers drift <id>` as the signal.** It compares each copy's stored
  `sourceUpdatedAt` with today's upstream `updatedAt` and suggests the remedy without running
  that remedy. Drifted copies are worth a re-run. A provider whose assets have stopped drifting has gone
  quiet within those timestamp limits. Confirm the final copy and acceptance checks before
  cutover. Weekly suits an active exit.
- **If `lw providers health` starts failing for the whole tenant, copy everything at once.**
  That is the deadline arriving, not the moment to start planning.

Set `blobs.driver` before the first copy, not after: `pg` by default, or `s3` for MinIO, Ceph or
any S3-compatible store ([where instance bytes live](catalog.md#where-instance-bytes-live)).

<!--i:eti-help-->
## Canto and Image Relay: which driver do you exit through?

Image Relay tenants may be moved to Canto, so one set of customers can sit across two APIs.
Check which API serves your tenant before you plan: the exit driver follows the tenant, not the
logo.

| Where the tenant lives today | Exit driver | Notes |
|---|---|---|
| **Image Relay** (api.imagerelay.com still serves the tenant) | `imagerelay` | Exit before a move to Canto adds a second hop |
| **Moved to Canto** (the tenant is `<name>.canto.com`) | `canto` | The same motion with a new driver. Folders arrive as Canto albums, and a custom expiry field carried into a Canto custom field just renames the `mapping.availabilityFields` entry |
| **Part-way through a move** (both alive) | both, `imagerelay` first | Inventory both and use `canto` for assets created after the move. Copying is idempotent per provider and remote id, but does not deduplicate overlapping assets across providers |
| **Native Canto customer** (never Image Relay) | `canto` | The ordinary exit, at contract end |

Exposure slices, approval gating and the availability-field mapping are Lolly-side settings, so
pointing them at a new provider entry is an edit, not a rebuild.

<!--i:eti-checklist-->
## Exit readiness by kind

One row per DAM kind Lolly Work ships. "What imports" is the governance a driver reads off the source:
where its availability window comes from ([imported availability
windows](catalog.md#imported-availability-windows)) and how approval maps. Everything after that
(the lifecycle fold, holds, exposure and provenance) is Lolly-side and identical for every kind.

Every driver here is built from public documentation and tested against recorded fixtures.
"Live confirmation open" means the field names have not been checked against a real tenant,
which happens on your own tenant under your own contract. [Check a source on your own
tenant](providers/tenant-check.md) says how to run that check; do it before you commit to an
exit schedule.

**The verdicts in short:** `brandfolder`, `imagerelay`, `canto`, `acquia-dam` and
`intelligencebank` are exit targets, and `cloudinary` is a conditional one.

::: warning Optimizely CMP and Orange Logic are not exits
`optimizely-cmp` is not an exit target: the CMS owns these assets, so do not run `cutover`
against that provider. `orange-logic` refuses cutover, because copied renditions do not preserve originals.
:::

| Kind | Driver | What imports | Original bytes out | Exit verdict |
|---|---|---|---|---|
| `brandfolder` | Public v4 API, bearer key | Native window (`availability_start`, `availability_end`) and a native `approved` boolean; Brandfolder sections become sections | Yes. The attachment's signed storage URL is fetched again per request and streamed, limited to `brandfolder.com` and `bfldr.com` | **Exit target.** Live confirmation of the availability field names open |
| `imagerelay` | Public v2 API, OAuth2 (bring your own token) | No native window: availability comes from `mapping.availabilityFields` custom-metadata keys. No approval signal, so approval stays a Lolly-side decision. Folders become sections; deletions are reported and dropped | Yes. `download_url` is fetched again, signed, per request and limited to `imagerelay.com`; the driver caps itself at 5 requests a second | **Exit target.** Check the table above first, because your tenant may already have moved to Canto. Live confirmation of the endpoint paths and field names open |
| `canto` | REST v1, OAuth2 (bring your own token; App ID and Secret issued by Canto to the tenant owner) | Availability from `mapping.availabilityFields`, read off the record's custom fields; approval states map to approved through `options.approvedStates` (default `["approved"]`); albums and folders become sections | Expected yes: `api_binary` streams the original per scheme, limited to the Canto family of hosts. Whether it returns the true original rather than a rendition has not been confirmed on a real tenant | **Exit target.** Nothing in this driver has been confirmed against a Canto tenant yet, so run the tenant check before committing to a schedule |
| `acquia-dam` | Widen v2 API, bearer token | Native window (`release_date` gives available from, `expiration_date` gives available until); asset `status` maps to approved through `options.approvedStatuses` (default `["active"]`); categories become sections | Yes. The `embeds.original` URL, or the download link, is fetched again per request, limited to `widencollective.com` and `widencdn.net` | **Exit target**, and the least mapping work of the set: governance arrives native, so no custom-field wiring. Live confirmation of the field names open |
| `intelligencebank` | v3 Graph API only; login handshake, single sealed credential | Native window (`publish_date` gives available from, `expiry_date` or `review_date` gives available until); workflow state maps to approved through `options.approvedStates` (absent leaves approval unfiltered); folders and categories become sections | Yes. The resource `download_url` is fetched again per request, limited to the `intelligencebank.com` family (a tenant on a custom domain needs its host added) | **Exit target.** Governance-rich, so an exit keeps most of what the DAM knew. Live confirmation of the login response and field names open |
| `optimizely-cmp` | CMP DAM API v3, OAuth2 (bring your own token); the only kind with publish-out, opt-in per provider (`options.publish`) | `expires_at` gives available until (CMP models expiry but no release date); `is_public` and not `is_archived` give approved; folders and labels become sections | The signed `download_url` streams per request, so the copy would run | **Not an exit target.** The CMS owns these assets: read-only federation in, plus publishing Lolly exports out. Do not run `cutover` against it |
| `cloudinary` | Search and Admin APIs and signed download by asset ID; sealed API key and secret | An optional configured approval tag and metadata dates; dynamic asset folders | Original download by asset ID, with a check of the selected version first and no transformation | **Conditional exit target.** Prove original checksums, and export any rights, proof or history data you need separately, before scheduling a move |
| `orange-logic` | Search v4; client credentials or bearer token | Configured approval and dates, folders and tags; explicit rendition file roles | **Unsupported.** Public renditions only; the protected original contract is unavailable | **Cutover refused.** Copied renditions do not make an exit that preserves originals |

The other kinds (`webdav`, `s3`, `git`, `dropbox`, `gdrive`, `o365`, `penpot`) are storage and
design sources, not brand libraries held under someone else's contract, so the table leaves
them out. `webdav` is worth one more line: a Nextcloud or an Apache `mod_dav` server is one your
organisation runs itself, so there is no vendor to leave, and it is far more often **where an
exit goes** than where one starts. The copy works against it like any other source.

<!--i:eti-folder-move-->
## Run the exit

These commands copy into Lolly Work's own blob store. For Nextcloud, Git or hosted drives, use the
separate export and transfer steps in your [chosen path](#choose-your-offboarding-path).

```bash
lw providers add acme-ir --kind imagerelay --label "Image Relay" --options '{"folderId":"…"}'
lw providers credential acme-ir    # prompts: an API key, or the sealed OAuth blob for the OAuth kinds
lw providers enable acme-ir        # owner-only
lw providers sync acme-ir          # federate: confirm what arrives before copying anything
lw providers health acme-ir        # and keep watching this one for the rest of the exit

lw providers materialize acme-ir                     # pin everything, early
lw providers materialize acme-ir --section "Logos"   # or one section
lw providers materialize acme-ir --remote-id 12345   # or one asset
lw providers drift acme-ir                           # which copies the upstream has changed since

lw providers cutover acme-ir       # when the upstream has gone quiet
```

::: warning Cut over only after acceptance
Cutover moves identities and turns the provider off. Run it only after the acceptance checks in
[Plan a DAM transition](/info/dam-transition.html), and keep the source and its recovery evidence
until the organisation accepts the result.
:::

**Materialize** needs `catalog.provider.manage` (admin). It streams every format's bytes into
the instance's BlobStore, checksums them, checks each one for an embedded [Content
Credential](c2pa.md), and creates an **instance asset** (`inst/<id>`) with a permanent `origin`:
provider, provider kind, remote id, filename, `sourceUpdatedAt` and `materializedAt`. Provenance
stays accurate after the DAM is gone. The command reports how many assets were copied, how many
the exposure slice skipped, how many carry an embedded credential and any per-asset failures.
A copied asset keeps its `ext/*` identity and its federated entry; only the bytes change hands,
served from the local copy. To copy a single asset, use
`POST /api/v1/catalog/providers/:id/import`, or the provider's asset list in the console.

**Cutover** is owner-only (`catalog.provider.credential`). It moves the identity from `ext/*` to
`inst/*`, so the instance entry replaces the federated one and nothing appears twice. It moves
the lifecycle row (holds included), the credential detection and any asset-specific grants, and
writes **aliases** so every old `/catalog/ext/…` address (in rendered SVGs, signed links and live
sessions) keeps resolving. It then disables a provider stored in the database; a config-managed
one is turned off by removing it from `instance.json`. Deleting the provider afterwards deletes
nothing, because the copies are instance-owned.

After cutover, every format of a copied `inst/*` entry carries a **checksum and size**, so
migrated assets gain the integrity checks and offline pinning that a federated `ext/*` entry
cannot have while its bytes live upstream.

<!--i:eti-link-->
## Related

- Per-platform setup, one guide per kind: [the provider guides](providers/README.md)
- Who may copy, cut over and delete: [Roles and grants](permissions.md#owner-only-powers)
- Pointing instance storage at S3 or MinIO: [where instance bytes
  live](catalog.md#where-instance-bytes-live)
