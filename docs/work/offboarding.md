# Off-boarding a DAM

Leaving a DAM is a provider-level motion, not a per-asset rescue: **federate → pin →
materialize → cutover**. This page is the playbook for every DAM kind this deploy can
federate, plus the per-vendor readiness table. Per-platform setup is one guide per kind, in
[the provider guides](providers/README.md); the mechanism is documented in
[catalog.md](catalog.md#the-exit---materialize-a-source-into-your-own-store).

## What the exit is

[**The exit**](catalog.md#the-exit---materialize-a-source-into-your-own-store) streams a
federated source's bytes into the instance's own [BlobStore](catalog.md#where-instance-bytes-live),
checksums every format, sniffs each one for an embedded Content Credential, and mints an
**instance asset** (`inst/<id>`) stamped with its origin (provider, providerKind, remoteId, filename,
`sourceUpdatedAt`, `materializedAt`). Afterwards the bytes sit in a store you own and every
format carries a **checksum and size** - the integrity verification and offline-pin parity a
federated `ext/*` entry cannot have while its bytes still live upstream. It runs off the
driver interface, so every kind below uses the same two commands.

Bytes land in `blobs.driver` (`pg` by default, zero moving parts; `s3` for MinIO/Ceph/S3).
Set it before the first materialize, not after.

## Pin early, cut over when ready

Materialize is the **first** thing to do once federation works, not the last step of an exit
project:

- **Pin as soon as `lw providers sync` returns what you expect.** Bytes in your own store
  survive vendor migrations, tenant renames, plan downgrades and API sunsets.
- **A hold implies a pin, best-effort.** A hold on a federated asset materializes its bytes
  while the identity stays `ext/*`. If the provider is already disabled or the upstream is
  down the hold still applies and the lifecycle row reads `pinned: false`, so pin early
  rather than relying on the hold to preserve originals.
- **Re-run it on a cadence.** Materialize is idempotent per (provider, remoteId): the instance
  id is deterministic and blobs overwrite, so a re-run resumes rather than duplicates, and an
  asset that failed once (an upstream hiccup, a redirect-served format) is reported per asset
  without aborting the batch.
- **`lw providers drift <id>` is the cadence signal.** It compares each copy's stored
  `sourceUpdatedAt` against today's upstream `updatedAt`, and identifies the remedy without running
  that remedy. Drifted copies are worth a re-run; a provider whose assets have stopped drifting has
  gone quiet, and a quiet upstream is when cutover is safe. Weekly during an active exit.
- **If `lw providers health` starts failing tenant-wide, materialize immediately** - that
  is the deadline arriving, not the moment to start planning.

## Canto and Image Relay: which driver do you exit through?

Canto acquired Image Relay in September 2024 and is moving that customer base onto its own
platform, which splits one set of customers across two APIs. The exit driver follows the
tenant, not the logo:

| Where the tenant lives today | Exit driver | Notes |
|---|---|---|
| **Legacy Image Relay** (api.imagerelay.com still serves the tenant) | `imagerelay` | Exit now, before the vendor's migration adds a second hop |
| **Migrated to Canto** (tenant is `<name>.canto.com`) | `canto` | Same motion, new driver. Folder structure arrives as Canto albums; a custom expiry field carried into a Canto custom field just renames the `mapping.availabilityFields` entry |
| **Mid-migration** (both alive) | both, `imagerelay` first | The legacy tenant holds the copy your organization curated; use `canto` for assets born after the migration. The exit is idempotent per (provider, remoteId), so running both is safe |
| **Native Canto customer** (never Image Relay) | `canto` | The ordinary legacy-DAM motion, at contract end |

Exposure slices, approval gating and the availability-field mapping are lolly-side, so
re-pointing them at a new provider entry is an edit, not a rebuild.

## Exit readiness by kind

One row per DAM kind this repo ships. "What imports" is the governance a driver reads off the
source (availability window origin per [imported availability windows](catalog.md#imported-availability-windows),
plus how approval maps); everything downstream - lifecycle fold, holds, exposure, provenance -
is lolly-side and identical for every kind.

Every driver here is built from public documentation and fixture-tested with an injected
fetch. "Live confirmation open" means the field names have not been checked against a real
tenant, which happens on a customer's own tenant under their own contract. Four kinds carry a
**live-verify runbook** for that pass, each with a table saying which constant to edit when a
guess turns out wrong: [canto](providers/canto-live-verify.md),
[imagerelay](providers/imagerelay-live-verify.md),
[intelligencebank](providers/intelligencebank-live-verify.md),
[acquia-dam](providers/acquia-dam-live-verify.md). The additional passes are
[Cloudinary](providers/cloudinary-live-verify.md) and
[Orange Logic](providers/orange-logic-live-verify.md). Run the relevant pass before committing an exit schedule.

| Kind | Driver | What imports | Original bytes out | Exit verdict |
|---|---|---|---|---|
| `brandfolder` | Public v4 API, bearer key | Native window (`availability_start` / `availability_end`) and a native `approved` boolean; Brandfolder sections → sections | Yes. The attachment's signed storage URL is re-fetched per request and streamed, host-pinned to `brandfolder.com` / `bfldr.com` | **Exit target**, one of the two priority off-boarding paths of record. Live confirmation of the availability field names open |
| `imagerelay` | Public v2 API, OAuth2 (BYOT) | No native window: availability comes from `mapping.availabilityFields` naming custom-metadata keys. No approval signal at all, so approval stays a lolly-side decision. Folder → section; deletions are reported positively and dropped | Yes. `download_url` re-fetched signed per request, host-pinned to `imagerelay.com`; the driver self-caps at 5 req/s | **Exit target, the urgent one.** Canto owns the platform now - check the fork matrix above first, because your tenant may already be on the other side of the migration. Live confirmation of the endpoint paths and field names open |
| `canto` | REST v1, OAuth2 (BYOT, App ID + Secret issued by Canto to the tenant owner) | Availability from `mapping.availabilityFields` read off the record's custom-field bag; approval states → approved via `options.approvedStates` (default `["approved"]`); albums and folders → sections | Expected yes: `api_binary` streams the original per scheme, host-pinned to the canto family. Whether it returns the true original rather than a rendition is on the driver's `LIVE-VERIFY` checklist | **Exit target.** Nothing in this driver has been confirmed against a Canto tenant yet, so run the runbook before committing a schedule |
| `acquia-dam` | Widen v2 API, bearer token | Native window (`release_date` → available from, `expiration_date` → available until); asset `status` → approved via `options.approvedStatuses` (default `["active"]`); categories → sections | Yes. The `embeds.original` URL (or the download link) re-fetched per request, host-pinned to `widencollective.com` / `widencdn.net` | **Exit target**, and the least mapping work of the set - governance arrives native, so no custom-field wiring. Live confirmation of the field names open |
| `intelligencebank` | v3 Graph API only. Login handshake, single sealed credential | Native window (`publish_date` → available from, `expiry_date` or `review_date` → available until); workflow state → approved via `options.approvedStates` (absent leaves approval unfiltered); folder and category → sections | Yes. The resource `download_url` re-fetched per request, host-pinned to the `intelligencebank.com` family (a custom-domain tenant needs its host added) | **Exit target.** Governance-rich, so an exit keeps most of what the DAM knew. Live confirmation of the login response and field names open |
| `optimizely-cmp` | CMP DAM API v3, OAuth2 (BYOT); the only kind with a publish-out arm, opt-in per provider (`options.publish`) | `expires_at` → available until (CMP models expiry, no release date); `is_public` and not `is_archived` → approved; folder and labels → sections | The signed `download_url` streams per request, so the exit path would run | **Not an exit target.** The CMS owns these assets: read-only federate-in plus publish-out of lolly-generated exports. Do not run `cutover` against it |
| `cloudinary` | Search/Admin and signed asset-ID download; sealed API key/secret | Optional configured approval tag and metadata dates; dynamic asset folder | Original download by asset ID, with selected-version preflight and no transform | **Conditional exit target.** Prove original checksums and separately export required rights/proof/history data before scheduling migration |
| `orange-logic` | Search v4; client credentials or bearer | Configured approval/dates, folders and tags; explicit rendition file roles | **Unsupported.** Public renditions only; protected original contract unavailable | **Cutover refused.** Materialised renditions do not establish an original-preserving exit |

The non-DAM kinds (`webdav`, `s3`, `git`, `dropbox`, `gdrive`, `o365`, `penpot`) are storage and
design sources, not brand libraries held under someone else's contract. They have no
off-boarding story and are absent from the table deliberately. `webdav` earns its own note:
a Nextcloud or an Apache `mod_dav` mount is a server the organization runs itself, so there is
no vendor to leave, and it is far more often **the destination of an exit** than the start of one.
Materialize works against it like any other source, and its driver is fixture-verified with its
own server-day pass in [providers/webdav-live-verify.md](providers/webdav-live-verify.md).

## Running an exit

```bash
lw providers add acme-ir --kind imagerelay --label "Image Relay" --options '{"folderId":"…"}'
lw providers credential acme-ir    # prompts: an API key, or the sealed OAuth blob for the OAuth kinds
lw providers enable acme-ir        # owner-only
lw providers sync acme-ir          # federate: confirm what arrives before copying anything
lw providers health acme-ir        # and keep watching this one for the rest of the exit

lw providers materialize acme-ir                     # pin everything, early
lw providers materialize acme-ir --section "Logos"   # or one section
lw providers materialize acme-ir --remote-id 12345   # or one asset

lw providers cutover acme-ir       # when the upstream has gone quiet
```

`materialize` needs `catalog.provider.manage` (admin) and reports how many assets were
copied, how many the exposure slice skipped, how many carry an embedded credential, and any
per-asset failures. A materialized asset keeps its `ext/*` identity and its federated entry:
only the bytes change hands, served from the local copy. The identity moves at `cutover`.

`cutover` is owner-gated (`catalog.provider.credential`). It moves the identity from `ext/*`
to `inst/*`, migrates the lifecycle row (holds included), the credential detection and any
asset-specific grants, and writes **aliases** so every old `/catalog/ext/…` URL - the ones
baked into already-rendered SVGs, signed links and live sessions - keeps resolving. It then
disables a db-managed provider; a config-managed one is turned off by removing it from
`instance.json`. Deleting the provider afterwards deletes nothing, because the copies are
instance-owned now.

## Related

- The mechanism, in detail: [catalog](catalog.md#the-exit---materialize-a-source-into-your-own-store)
- Per-platform setup, one guide per kind: [the provider guides](providers/README.md)
- Who may materialize, cut over and delete: [permissions](permissions.md)
- Where instance bytes live and how to point them at S3/MinIO:
  [catalog](catalog.md#where-instance-bytes-live)
