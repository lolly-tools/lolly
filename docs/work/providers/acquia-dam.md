# Acquia DAM / Widen integration with Lolly (kind: `acquia-dam`)

Connect an Acquia DAM (Widen) collective and its assets appear in the Lolly Work catalog, with
Widen's own release and expiry dates and approval statuses carried across. No
custom-field mapping is needed. Widen stays the source: Lolly Work reads with your token and never
writes back.

## Onboarding

1. Choose a narrow search query, categories and Lolly Work groups. Agree which Widen statuses count as approved and whether the workflow needs release and expiry gates.
2. Obtain the read token described below and follow the [four-step connection](README.md#connect-a-source-in-four-steps). Inspect the listing before an owner enables the source.
3. Run the [Acquia DAM / Widen tenant check](tenant-check.md#acquia-dam-widen). Confirm native date and status fields, compare originals and test allowed and refused member access in one real Lolly task before widening the query.

## What you need from Widen

- **A Widen API token** (a user access token) with read access to the assets and categories you
  want to federate. An Acquia DAM administrator creates one under
  *Admin > Global settings > API setup*: register an integration, then choose
  **Generate User Access Token**. It is a bearer token, so treat it as a secret.
- Optionally, **a search query** to limit what federates. Without one, the whole collective
  federates.
- No app registration or OAuth flow. Choose what federates with Lolly Work's **exposure** settings,
  not with the token.

## Credential shape

A single bearer token string: the Widen API token.

```bash
lw providers credential acme-widen     # prompts; never argv, never shell history
```

## instance.json / `lw providers add`

```json
{
  "id": "acme-widen",
  "kind": "acquia-dam",
  "label": "Acme Widen",
  "options": { "query": "ft:(png OR svg)", "approvedStatuses": ["active"] },
  "exposure": { "groups": ["brand"], "requireApproved": true, "tier": "reference" }
}
```

- `options.query` limits federation with a Widen search query.
- `options.approvedStatuses` (default `["active"]`) lists the asset statuses that count as
  **approved**. `exposure.requireApproved: true` federates only those.
- Widen's **`release_date`** and **`expiration_date`** import as an
  [availability window](../catalog.md#imported-availability-windows) with no mapping.
- Categories become sections for `includeSections`.

## Verify
```bash
lw providers preview --kind acquia-dam --options '{}'
lw providers health acme-widen
```

`401` or `403` means the token is wrong or lacks access. An empty sample with `requireApproved`
on means nothing matches `approvedStatuses`.

## Notes / limits

- **Not yet confirmed against a live collective.** The endpoints and field names come from
  Widen's documentation. [Check a source on your own tenant](tenant-check.md#acquia-dam-widen)
  lists what to look at. Contributors changing the driver follow its
  [maintainer runbook](https://github.com/lolly-tools/lolly-work/blob/main/server/src/catalog/providers/live-verify/acquia-dam.md) in the Lolly Work repository.
- **Signed, short-lived download links,** fetched on each request and pinned to
  `widencollective.com` and `widencdn.net`.

## Off-boarding

Acquia DAM / Widen supports the exit sequence, subject to the [tenant check](tenant-check.md#acquia-dam-widen) for endpoints, original downloads and native date and status fields. The driver reads `embeds.original`, falling back to the download link; compare required files with direct source downloads.

Use the [self-hosting strategy with S3 storage](../offboarding.md#self-host-lolly-work-with-s3-storage) to prepare Lolly Work and its durable store, then follow [Leave a DAM](../offboarding.md) for materialize, drift and cutover. Check release, expiry and approval on copied assets. Keep any required metadata, rights evidence and historical records that the driver does not map through a separate export.

Compare [offboarding destinations](../offboarding.md#choose-your-offboarding-path), starting with open-source services you can run. Each route remains subject to this source's limits.
