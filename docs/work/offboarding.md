# Leave a DAM

This page is for the brand operations lead who plans to leave a DAM vendor without losing
assets or breaking links. Lolly Work copies the files into a store you own, then moves each
asset's identity over, and every old address keeps resolving. Start early: the copy is the
first thing to do once a source works, not the last step of an exit project.

::: timeline
- <!--i:link--> **Federate.** Connect the DAM as a read-only provider and confirm that `lw providers sync` returns what you expect.
- <!--i:download--> **Pin.** Copy the files into your own store with `lw providers materialize`. Assets keep their `ext/*` identity; only where the bytes come from changes.
- <!--i:clock--> **Re-run on a cadence.** `lw providers drift` shows which copies the upstream has changed since. Re-run the copy until the upstream goes quiet.
- <!--i:lock--> **Cut over.** `lw providers cutover` moves identities from `ext/*` to `inst/*`, writes aliases for every old address and turns the provider off.
:::

Connecting each kind is in [the provider guides](providers/README.md), one per kind.

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
  quiet, and a quiet upstream is when cutover is safe. Weekly suits an active exit.
- **If `lw providers health` starts failing for the whole tenant, copy everything at once.**
  That is the deadline arriving, not the moment to start planning.

Set `blobs.driver` before the first copy, not after: `pg` by default, or `s3` for MinIO, Ceph or
any S3-compatible store ([where instance bytes live](catalog.md#where-instance-bytes-live)).

## Canto and Image Relay: which driver do you exit through?

Image Relay tenants may be moved to Canto, so one set of customers can sit across two APIs.
Check which API serves your tenant before you plan: the exit driver follows the tenant, not the
logo.

| Where the tenant lives today | Exit driver | Notes |
|---|---|---|
| **Image Relay** (api.imagerelay.com still serves the tenant) | `imagerelay` | Exit before a move to Canto adds a second hop |
| **Moved to Canto** (the tenant is `<name>.canto.com`) | `canto` | The same motion with a new driver. Folders arrive as Canto albums, and a custom expiry field carried into a Canto custom field just renames the `mapping.availabilityFields` entry |
| **Part-way through a move** (both alive) | both, `imagerelay` first | The Image Relay tenant holds the copy your organisation curated; use `canto` for assets created after the move. The copy is idempotent per provider and remote id, so running both is safe |
| **Native Canto customer** (never Image Relay) | `canto` | The ordinary exit, at contract end |

Exposure slices, approval gating and the availability-field mapping are Lolly-side settings, so
pointing them at a new provider entry is an edit, not a rebuild.

## Exit readiness by kind

One row per DAM kind Work ships. "What imports" is the governance a driver reads off the source:
where its availability window comes from ([imported availability
windows](catalog.md#imported-availability-windows)) and how approval maps. Everything after that
(the lifecycle fold, holds, exposure and provenance) is Lolly-side and identical for every kind.

Every driver here is built from public documentation and tested against recorded fixtures.
"Live confirmation open" means the field names have not been checked against a real tenant,
which happens on your own tenant under your own contract. Each provider guide says how to run
that check; do it before you commit to an exit schedule.

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

## Run the exit

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

## Related

- Per-platform setup, one guide per kind: [the provider guides](providers/README.md)
- Who may copy, cut over and delete: [Roles and grants](permissions.md#owner-only-powers)
- Pointing instance storage at S3 or MinIO: [where instance bytes
  live](catalog.md#where-instance-bytes-live)
