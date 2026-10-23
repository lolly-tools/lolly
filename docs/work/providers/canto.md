# Canto (kind: `canto`)

Connect a Canto DAM and its files appear in the Lolly Work catalog for the groups you choose,
with Canto's approval states and an optional expiry date carried across. Canto stays the source:
Work reads through an app you register and never writes back. The same connection can copy
the files into your own store when you want them there.

Canto acquired Image Relay in September 2024, so this kind serves Canto tenants and Image Relay
tenants that have moved to Canto.

## What you need from Canto

- **An API key (App ID and Secret)**, which a Canto admin creates under
  *Settings > Configuration Options > API Keys*, under your own contract. Lolly Work holds no
  Canto agreement and registers no Canto app; the connector terms are between you and Canto, as
  for every DAM here.
- **API access on your contract tier.** A tenant without it cannot connect through this driver
  at all, for federation or for an exit.
- **Your regional domain**: `com`, `global` or `de`, the one in your tenant URL
  (`https://acme.canto.com` means `"domain": "com"`). It picks the API host and the regional
  OAuth server together.
- Optionally, **an album id** to federate one album.
- If you keep expiry dates, **the custom field** that holds them.

## Credential shape

One sealed OAuth credential, pasted rather than captured. `clientId` and `clientSecret` are the
App ID and Secret; `refreshToken` is the grant against them.

```json
{ "clientId": "…", "clientSecret": "…", "refreshToken": "…" }
```

```bash
lw providers credential acme-canto     # prompts for the JSON; never argv, never shell history
```

Get the refresh token by running **Canto's own documented OAuth2 authorization-code flow** once
by hand against your App ID and Secret. `lw providers auth` refuses this kind; see
[OAuth sources](README.md#kinds-whose-consent-flow-is-not-registered-canto-imagerelay-optimizely-cmp).

## instance.json / `lw providers add`

```json
{
  "id": "acme-canto",
  "kind": "canto",
  "label": "Acme Canto",
  "options": { "tenant": "acme", "domain": "com", "albumId": "AB12C" },
  "mapping": { "availabilityFields": { "until": "Expiry Date" } },
  "exposure": { "groups": ["marketing"], "requireApproved": true }
}
```

| Option | What it does |
|---|---|
| `tenant` (required) | The subdomain of your tenant URL. With `domain` it gives the API base `https://<tenant>.canto.<domain>/api/v1` and the token endpoint `https://oauth.canto.<domain>/oauth/api/oauth2/token`. |
| `domain` | `com`, `global` or `de`. |
| `baseUrl`, `tokenUrl` | Override either endpoint. Both stay pinned to the Canto hosts. |
| `albumId` | Federate one album (the equivalent of Image Relay's `folderId`). |
| `approvedStates` | The Canto approval states that count as **approved**, default `["approved"]`. A record with no state at all federates as approved; `exposure.requireApproved` is what gates. |
| `minGapMs` | The gap between calls, default `350` (about three a second). |

**`mapping.availabilityFields`** imports expiry: name the custom field that holds the date (here
`"Expiry Date"`, which becomes an
[availability window](../catalog.md#imported-availability-windows) `availableUntil`). Without it,
the manual `catalog.expire` control is the only expiry. An Image Relay tenant that already set
this keeps its settings; only the field name changes.

## Verify

```bash
lw providers preview --kind canto --options '{"tenant":"acme"}'   # dry run, nothing stored
lw providers health acme-canto
```

| Error | Meaning |
|---|---|
| `oauth token refresh failed (401)` | The App ID, Secret or refresh token is wrong, or the grant was revoked. Capture the credential again. |
| `oauth token refresh failed (400)` | The token endpoint refuses the request format. A new credential cannot fix this; report it with the [tenant check](tenant-check.md#canto). |
| `canto api 401` | The token exchange worked; the tenant refused the access token. |
| `canto api 403` | The tenant refused the call, most often because API access is not on the contract tier. |
| `canto url outside allowed hosts` | A `baseUrl` or `tokenUrl` override points outside the Canto hosts. |

## Notes / limits

- **Not yet confirmed against a live tenant.** The endpoint paths and field names come from
  Canto's documentation, and Lolly Work holds no Canto account, so the check runs on your own
  tenant under your contract. [Check a source on your own tenant](tenant-check.md#canto) lists
  what to look at. Contributors changing the driver follow its
  [maintainer runbook](canto-live-verify.md) in the Lolly Work repository.
- **Listing walks schemes.** Canto lists per scheme (image, video, audio, document,
  presentation, other), so each catalog id carries its scheme (`image:AB12C`). An album-scoped
  sync pages the album once instead.
- **Originals on request.** Files are fetched when used, streamed, pinned to the `canto.com`,
  `canto.global` and `canto.de` hosts, and never stored. The driver sends its own `User-Agent`
  and keeps to about three requests a second, a cautious default rather than a published limit.

## Off-boarding

Canto can be left through the exit. Expiry comes from `mapping.availabilityFields` and approval
from `approvedStates`, both settings in Work that survive a re-point. Coming from Image Relay,
which driver you leave through depends on where your tenant now lives;
[Leave a DAM](../offboarding.md) covers all four cases. Treat the first materialize as a check:
it records a checksum for every format, and a truncated or substituted stream fails rather than
arriving quietly.
