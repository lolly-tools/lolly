# Dropbox (kind: `dropbox`)

Federate a Dropbox folder as a **read-only** catalog source. OAuth2 (BYOT) - see the
[shared OAuth onboarding](README.md#kinds-with-a-registered-consent-flow-dropbox-gdrive-o365) for the app-registration
and consent flow common to all OAuth kinds.

## What you need from Dropbox

- **A Dropbox app** you register (App Console), with **`files.content.read`** and
  **`files.metadata.read`** scopes, and offline access for the refresh token - there is no
  scope to tick: the consent flow requests `token_access_type=offline` itself. A
  scoped-access app restricted to one folder is ideal.
- BYOT: the app's key/secret are yours; the refresh token is captured by `lw providers auth`.

## Credential shape

The OAuth JSON blob - captured, not typed:

```json
{ "clientId": "…", "clientSecret": "…", "refreshToken": "…" }
```

Dropbox supports public (PKCE) apps too - then `clientSecret` is omitted.

```bash
lw providers auth acme-dropbox
```

## instance.json / `lw providers add`

```json
{
  "id": "acme-dropbox",
  "kind": "dropbox",
  "label": "Acme Dropbox",
  "options": { "path": "/Brand Assets" },
  "exposure": { "groups": ["marketing"] }
}
```

- `options.path` - the folder to federate (default the app-folder root).

## Verify

```bash
lw providers auth acme-dropbox     # one-time consent (loopback PKCE)
lw providers health acme-dropbox
```

A token-refresh failure means the grant was revoked - re-run `lw providers auth`.

## Notes / limits

- Temporary download links are short-lived (`expiringUrls`) - fetched per request, streamed,
  host-pinned; nothing persisted.
- Supports the **exit** (materialize → cutover). Does **not** accept published exports.

See also: [OAuth onboarding](README.md#kinds-with-a-registered-consent-flow-dropbox-gdrive-o365) · [catalog](../catalog.md) · [permissions](../permissions.md).
