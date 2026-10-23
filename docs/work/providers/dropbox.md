# Dropbox (kind: `dropbox`)

Connect a Dropbox folder of approved files and its contents appear in the Lolly Work catalog
for the groups you choose. Work reads the folder through a Dropbox app you register, and never
writes to the folder.

## What you need from Dropbox

- **A Dropbox app** you register in the App Console, with the **`files.content.read`** and
  **`files.metadata.read`** scopes. There is no offline-access box to tick: the consent flow
  asks for a refresh token itself (`token_access_type=offline`). A scoped app limited to one
  folder is ideal.
- The app's key and secret are yours; `lw providers auth` captures the refresh token.

## Credential shape

The OAuth credential, captured rather than typed. A public (PKCE) app leaves out
`clientSecret`.

```json
{ "clientId": "…", "clientSecret": "…", "refreshToken": "…" }
```

```bash
lw providers auth acme-dropbox     # one-time loopback PKCE consent
```

[OAuth sources](README.md#kinds-with-a-registered-consent-flow-dropbox-gdrive-o365) explains the
consent step.

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

- `options.path` is the folder to federate; the default is the app folder's root.

## Verify

```bash
lw providers auth acme-dropbox
lw providers health acme-dropbox
```

A token-refresh failure means the grant was revoked; run `lw providers auth` again.

## Notes / limits

- **Subfolders included.** The folder is walked recursively, and the first subfolder under it
  becomes each file's **section**.
- **Renames keep identity.** The catalog id is Dropbox's own file id, which survives a rename
  or a move.
- **Search matches file names, not contents.**
- **Fresh downloads.** Each download is a new authenticated request to Dropbox
  (`files/download`), streamed through Work and pinned to Dropbox's hosts. Nothing is stored.
