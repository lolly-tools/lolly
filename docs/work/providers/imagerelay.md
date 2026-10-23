# Image Relay (kind: `imagerelay`)

Connect an Image Relay DAM and its files appear in the Lolly Work catalog for the groups you
choose, with an expiry date if you keep one in a custom field. Image Relay stays the source:
Work reads through an app you register and never writes back.

Canto acquired Image Relay in September 2024. If your tenant has moved to Canto, use the
[Canto source](canto.md). If you are not sure which applies, read [Off-boarding](#off-boarding)
first.

## What you need from Image Relay

- **An OAuth2 app** you register in Image Relay, with **read** access to the files and folders
  you want to federate. The client id, secret and the refresh token your tenant issues against
  them are yours.
- Optionally, **a folder id** to federate one folder, with `recursive` for its subfolders.
- If you keep expiry dates, **the custom-metadata field** that holds them. Image Relay has no
  native availability field, so you map one.

## Credential shape

One sealed OAuth credential, pasted rather than captured:

```json
{ "clientId": "…", "clientSecret": "…", "refreshToken": "…" }
```

```bash
lw providers credential acme-imagerelay   # prompts for the JSON; never argv, never shell history
```

Get the refresh token by running **Image Relay's own documented OAuth2 authorization-code flow**
once by hand against your app. `lw providers auth` refuses this kind; see
[OAuth sources](README.md#kinds-whose-consent-flow-is-not-registered-canto-imagerelay-optimizely-cmp).

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

- `options.folderId` and `options.recursive` scope federation. `options.baseUrl` and
  `options.tokenUrl` override the defaults (`api.imagerelay.com/api/v2` and that host's
  `/oauth/token`).
- **`mapping.availabilityFields`** imports expiry: name the custom field that holds the date
  (here `"Expiry Date"`, which becomes an
  [availability window](../catalog.md#imported-availability-windows) `availableUntil`). Without
  it, the manual `catalog.expire` control is the only expiry.
- Image Relay sends **no approval signal**, so leave `exposure.requireApproved` off. With it on,
  nothing federates.

## Verify

```bash
lw providers preview --kind imagerelay --options '{"folderId":"1234"}'   # dry run, nothing stored
lw providers health acme-imagerelay
```

| Error | Meaning |
|---|---|
| `oauth token refresh failed (401)` | The client id, secret or refresh token is wrong, or the grant was revoked. Capture the credential again. |
| `oauth token refresh failed (400)` | The token endpoint refuses the request format. A new credential cannot fix this; report it with the [tenant check](tenant-check.md#image-relay). |
| `imagerelay api 401` | The token exchange worked; the tenant refused the access token. |
| `imagerelay url outside allowed hosts` | A `baseUrl` or `tokenUrl` override, or a download link, points outside `imagerelay.com`. |

## Notes / limits

- **Not yet confirmed against a live tenant.** The endpoints and field names come from Image
  Relay's documentation. [Check a source on your own tenant](tenant-check.md#image-relay) lists
  what to look at. Contributors changing the driver follow its
  [maintainer runbook](imagerelay-live-verify.md) in the Lolly Work repository.
- **Signed, short-lived download links,** fetched on each request and pinned to `imagerelay.com`.
  The driver sends the `User-Agent` Image Relay requires and keeps to **5 requests a second**.
- **Deleted files leave the catalog.** A file Image Relay reports as deleted is dropped.

## Off-boarding

Image Relay can be left through the exit. Which driver you leave through depends on where
your tenant now lives: a legacy tenant through this one, a migrated `<name>.canto.com` tenant
through [`canto`](canto.md), and a tenant with both alive through `imagerelay` first.
[Leave a DAM](../offboarding.md) covers all four cases, with timing and cadence. The expiry
mapping carries over to `canto` with only the field name changed.
