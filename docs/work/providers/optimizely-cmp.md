# Optimizely CMP (kind: `optimizely-cmp`)

Federate Optimizely CMP's web DAM **read-only** - a source you *keep* (the CMS owns those
assets), never one you exit. Optionally, publish lolly-generated exports back **out** to it
so lolly-made media is usable on the website and stays attributable downstream.

> The exact CMP endpoint/field names carry a live-verify note in the driver - confirm them
> against your tenant with `lw providers preview` before relying on them in production.

## What you need from Optimizely CMP

- **An OAuth2 app** registered in your CMP instance (one app per instance), with a
  **refreshable** token. Grant it read access to the DAM; grant *upload/create* only if you
  intend to publish out.
- BYOT: the app's **client id + client secret** are yours - nothing ships in this repo - and so
  is the refresh token your instance's OAuth grant issues against them.

## Credential shape

One sealed OAuth JSON blob:

```json
{ "clientId": "…", "clientSecret": "…", "refreshToken": "…" }
```

```bash
lw providers credential acme-cmp     # prompts for the blob; never argv, never shell history
```

Capture the refresh token by running **CMP's own documented OAuth2 authorization-code flow**
once by hand against the app you registered, then paste the three fields into
`lw providers credential`. No consent flow is registered for this kind, so `lw providers auth`
refuses it: see the
[shared OAuth onboarding](README.md#kinds-whose-consent-flow-is-not-registered-canto-imagerelay-optimizely-cmp).

## instance.json / `lw providers add`

```json
{
  "id": "acme-cmp",
  "kind": "optimizely-cmp",
  "label": "Acme Web DAM",
  "options": { "publish": true },
  "exposure": { "groups": ["web", "brand"], "requireApproved": true }
}
```

- `options.publish: true` opts this provider into the **publish-out** arm (off by default -
  a source is read-only unless you turn it on). `options.baseUrl`/`tokenUrl` override the
  defaults (legacy tenants: `api.welcomesoftware.com`).
- `exposure.requireApproved: true` uses CMP's `is_public` (and not-`is_archived`) as the
  approved gate; CMP `expires_at` imports as an
  [availability window](../catalog.md#imported-availability-windows).
- A folder name **or** a label can scope an `includeSections` slice.

## Verify

```bash
lw providers preview --kind optimizely-cmp --options '{}'   # dry run, nothing stored
lw providers credential acme-cmp
lw providers health acme-cmp
```

`oauth token refresh failed (401)` means the client id/secret or the refresh token in the blob
is wrong, or the grant was revoked - re-capture the credential. `optimizely-cmp api 401` means
the token exchange worked but the instance rejected the access token.

## Publishing lolly exports out

With `publish: true` and an owner grant of `catalog.provider.publish`:

```bash
lw providers publish acme-cmp --in ./summit-badge.png --name "Summit Badge"
```

Only **lolly-generated** exports may be pushed - the server verifies the bytes carry lolly's
C2PA export assertion, so a federated or pack asset can never be published out. Requires an
instance C2PA signer ([c2pa.md](../c2pa.md)); each publish is audited with the export's
provenance chain.

## Notes / limits

- Download URLs are signed + short-lived (`expiringUrls`); fetches are host-pinned to
  CMP/Welcome hosts.
- The only kind that accepts published exports.

## Off-boarding

**Not an exit target.** The CMS owns these assets, so the motion here is federate-in plus
publish-out, not a drain. Do not run `cutover` against this provider: federated CMP assets
keep their `ext/*` identity, and Optimizely stays the source of truth for them.

The traffic runs the other way instead - lolly-generated exports publish **out** to CMP
(above), reaching the website carrying their Content Credential.

Every other DAM kind here is an exit target: [off-boarding](../offboarding.md).

See also: [OAuth onboarding](README.md#kinds-whose-consent-flow-is-not-registered-canto-imagerelay-optimizely-cmp) · [catalog](../catalog.md) · [permissions](../permissions.md) · [c2pa](../c2pa.md).
