# Acquia DAM / Widen (kind: `acquia-dam`)

Connect an Acquia DAM (Widen) collective and its assets appear in the Lolly Work catalog, with
Widen's own release and expiry dates and approval statuses carried across. No
custom-field mapping is needed. Widen stays the source: Work reads with your token and never
writes back.

## What you need from Widen

- **A Widen API token** (a user access token) with read access to the assets and categories you
  want to federate. An Acquia DAM administrator creates one under
  *Admin > Global settings > API setup*: register an integration, then choose
  **Generate User Access Token**. It is a bearer token, so treat it as a secret.
- Optionally, **a search query** to limit what federates. Without one, the whole collective
  federates.
- No app registration or OAuth flow. Choose what federates with Work's **exposure** settings,
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

Widen can be left through the exit with the least mapping work of the DAMs here: its dates and
statuses come across as they are, so nothing has to be entered again by hand. Files come out
through `embeds.original`, falling back to the `_links.download` link. Timing, cadence and the
readiness of each DAM: [Leave a DAM](../offboarding.md).
