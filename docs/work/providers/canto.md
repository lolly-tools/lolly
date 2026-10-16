# Canto (kind: `canto`)

Federate a Canto DAM **read-only**. Canto acquired Image Relay in September 2024, so this kind
serves two populations: native Canto tenants leaving at contract end, and Image Relay tenants
the vendor migration has already carried across. Either way the destination is your own store
([Off-boarding](#off-boarding)). OAuth2 (BYOT) - see the
[shared OAuth onboarding](README.md#kinds-whose-consent-flow-is-not-registered-canto-imagerelay-optimizely-cmp).

## What you need from Canto

- **An API key (App ID + Secret)**, requested from **Canto support under your own contract**.
  BYOT: lolly holds no Canto agreement and registers no Canto app, so the connector terms are
  between you and Canto, as for every DAM connector here.
- **Confirmation that API access is included on your contract tier.** A tenant without API
  access cannot be federated, or drained, through this driver at all.
- **Your regional domain** - `com`, `global`, or `de`, the one in your tenant URL
  (`https://acme.canto.com` → `"domain": "com"`). It selects the REST base and the regional
  OAuth server together.
- Optionally, **an album id** to scope federation to one album.
- If you model asset expiry in Canto, **which custom field** holds the date - the driver reads
  it through `mapping.availabilityFields` (below).

## Credential shape

One sealed OAuth JSON blob. `clientId`/`clientSecret` are the App ID and Secret Canto support
issued you, and `refreshToken` is the grant against them:

```json
{ "clientId": "…", "clientSecret": "…", "refreshToken": "…" }
```

```bash
lw providers credential acme-canto     # prompts for the blob; never argv, never shell history
```

Capture that refresh token by running **Canto's own documented OAuth2 authorization-code
flow** once by hand against the App ID/Secret support issued you. No consent flow is
registered for this kind, so `lw providers auth` refuses it: see the
[shared OAuth onboarding](README.md#kinds-whose-consent-flow-is-not-registered-canto-imagerelay-optimizely-cmp).

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

- `options.tenant` (required) is the subdomain of your tenant URL; with `options.domain` it
  resolves the REST base `https://<tenant>.canto.<domain>/api/v1` and the token endpoint
  `https://oauth.canto.<domain>/oauth/api/oauth2/token`. `options.baseUrl` / `options.tokenUrl`
  override either, and both stay host-pinned to the Canto family.
- `options.albumId` scopes federation to one album (the Image Relay `folderId` equivalent).
- `options.approvedStates` - the Canto approval states that map to **approved**, default
  `["approved"]`. A record carrying no state at all federates as approved;
  `exposure.requireApproved` is what actually gates.
- `options.minGapMs` tunes the gap between calls (default `350`, about 3 requests/second).
- **`mapping.availabilityFields`** is how expiry gets imported: name the custom field that
  holds the date (here `"Expiry Date"` → an
  [availability window](../catalog.md#imported-availability-windows) `availableUntil`). Omit it
  and the manual `catalog.expire` arm is the whole story. An Image Relay tenant that already
  configured this keeps its config - only the field name changes.

## Verify

```bash
lw providers preview --kind canto --options '{"tenant":"acme"}'   # dry run, nothing stored
lw providers credential acme-canto
lw providers health acme-canto
```

| Error | Meaning |
|---|---|
| `oauth token refresh failed (401)` | App ID/Secret or refresh token wrong, or the grant revoked - re-capture the credential |
| `oauth token refresh failed (400)` | the token endpoint rejects the **request shape**; re-capturing cannot fix it - the runbook's row 2a says what to edit |
| `canto api 401` | token exchange worked, tenant rejected the access token |
| `canto api 403` | tenant refused the call - most often API access is not on the contract tier |
| `canto url outside allowed hosts` | a `baseUrl` or `tokenUrl` override points off the Canto family |

With a real tenant in hand, run the
[Canto live-verify runbook](canto-live-verify.md): the ordered pass that confirms every guessed
endpoint and field name, and which constant to edit when one is wrong.

## Notes / limits

- **This driver is fixture-verified only.** Its endpoint paths and record field names come from
  Canto's public documentation and have not been confirmed against a live tenant; lolly holds
  no Canto account, so that pass runs on a customer's own tenant under their contract. Read the
  first sync as the verification and report anything that does not match.
- **Listing walks schemes.** Canto lists per scheme (image, video, audio, document,
  presentation, other), so a federated id carries its scheme (`image:AB12C`). An album-scoped
  sync pages the album once instead.
- Original bytes are fetched **per request**, streamed, host-pinned to the
  `canto.com`/`canto.global`/`canto.de` family, and never persisted (`expiringUrls`). The
  driver identifies itself with a `User-Agent` and self-caps at about 3 requests/second, which
  is a conservative default rather than a published limit.
- Does **not** accept published exports: Canto is a source being exited, never a publish
  destination.

## Off-boarding

**An exit target** - the acquisition-tier one.

Kind-specific: expiry rides `mapping.availabilityFields` (above) and approval rides
`options.approvedStates`, so both are lolly-side config that survives a re-point. Coming from
Image Relay, which driver you exit through depends on where the vendor migration has put your
tenant - the fork matrix in the playbook covers all four cases. The driver is fixture-verified,
so read the first materialize as verification: it checksums every format, and a truncated or
substituted stream fails loudly rather than landing quietly.

Motion, cadence and the per-DAM readiness table: [off-boarding](../offboarding.md).

See also: [OAuth onboarding](README.md#kinds-whose-consent-flow-is-not-registered-canto-imagerelay-optimizely-cmp) · [catalog](../catalog.md) · [permissions](../permissions.md).
