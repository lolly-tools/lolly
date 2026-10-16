# Image Relay (kind: `imagerelay`)

Federate an Image Relay DAM **read-only**. Canto acquired Image Relay in September 2024 and is
moving that customer base onto its own platform, so read [Off-boarding](#off-boarding) before
you plan anything else here. OAuth2 (BYOT) - see the
[shared OAuth onboarding](README.md#kinds-whose-consent-flow-is-not-registered-canto-imagerelay-optimizely-cmp).

## What you need from Image Relay

- **An OAuth2 app** you register in Image Relay, granting **read** access to the files/folders
  you want to federate. BYOT: the client id/secret are yours, and so is the refresh token your
  tenant's OAuth grant issues against them.
- Optionally, **a folder id** to scope federation to one folder (with `recursive` for its
  descendants).
- If you model asset expiry in Image Relay, **which custom-metadata field** holds the date -
  Image Relay has no native availability field, so you map it (below).

## Credential shape

One sealed OAuth JSON blob - the client id/secret of the app you registered, and the refresh
token your grant against it issued:

```json
{ "clientId": "…", "clientSecret": "…", "refreshToken": "…" }
```

```bash
lw providers credential acme-imagerelay   # prompts for the blob; never argv, never shell history
```

Capture that refresh token by running **Image Relay's own documented OAuth2
authorization-code flow** once by hand against the app you registered. No consent flow is
registered for this kind, so `lw providers auth` refuses it: see the
[shared OAuth onboarding](README.md#kinds-whose-consent-flow-is-not-registered-canto-imagerelay-optimizely-cmp).

## instance.json / `lw providers add`

```json
{
  "id": "acme-imagerelay",
  "kind": "imagerelay",
  "label": "Acme Image Relay",
  "options": { "folderId": "1234", "recursive": true },
  "mapping": { "availabilityFields": { "until": "Expiry Date" } },
  "exposure": { "groups": ["marketing"] }
}
```

- `options.folderId` / `options.recursive` scope federation; `options.baseUrl`/`tokenUrl`
  override the defaults (`api.imagerelay.com/api/v2`, and that host's `/oauth/token`).
- **`mapping.availabilityFields`** is how expiry gets imported: name the custom-metadata field
  that holds the date (here `"Expiry Date"` → an
  [availability window](../catalog.md#imported-availability-windows) `availableUntil`). Omit
  it and the manual `catalog.expire` arm is the whole story.
- Image Relay sends **no approval signal**, so leave `exposure.requireApproved` off: with it
  on, nothing federates.

## Verify

```bash
lw providers preview --kind imagerelay --options '{"folderId":"1234"}'   # dry run, nothing stored
lw providers credential acme-imagerelay
lw providers health acme-imagerelay
```

| Error | Meaning |
|---|---|
| `oauth token refresh failed (401)` | client id/secret or refresh token wrong, or the grant revoked - re-capture the credential |
| `oauth token refresh failed (400)` | the token endpoint rejects the **request shape**; re-capturing cannot fix it - the runbook's row 5a says what to edit |
| `imagerelay api 401` | token exchange worked, tenant rejected the access token |
| `imagerelay url outside allowed hosts` | a `baseUrl`/`tokenUrl` override or download link points off `imagerelay.com` (API, token and download hosts are all pinned to that family) |

With a real tenant in hand, run the
[Image Relay live-verify runbook](imagerelay-live-verify.md): the ordered pass that confirms
every guessed endpoint and field name, and which constant to edit when one is wrong.

## Notes / limits

- Download links are signed + short-lived (`expiringUrls`) - fetched per request, streamed,
  host-pinned to `imagerelay.com`. The driver sends a mandatory `User-Agent` and self-caps at
  **5 requests/second**.
- A file Image Relay reports as **deleted** is dropped from federation (a positive signal, not
  an inference).
- Does **not** accept published exports.

## Off-boarding

**An exit target, the urgent one.** Canto owns the platform now, so run the vendor's migration
once, into a store you own.

Kind-specific: which driver you exit through depends on where the vendor has put your tenant -
a legacy tenant exits through this driver, a migrated `<name>.canto.com` tenant through
[`canto`](canto.md), and a tenant with both alive runs `imagerelay` first. The fork matrix in
the playbook covers all four cases. Expiry rides `mapping.availabilityFields` (above), and that
mapping carries over to `canto` with only the field name changed.

Motion, cadence and the per-DAM readiness table: [off-boarding](../offboarding.md).

See also: [OAuth onboarding](README.md#kinds-whose-consent-flow-is-not-registered-canto-imagerelay-optimizely-cmp) · [catalog](../catalog.md) · [permissions](../permissions.md).
