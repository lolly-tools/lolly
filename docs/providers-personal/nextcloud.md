# Nextcloud / WebDAV (kind: `webdav`)

No app registration and no Lolly-side config: the USER brings their own
server in /profile → Connected services. Built for Nextcloud (ownCloud and
plain WebDAV servers work the same way); the sovereignty fit is the point -
this is the provider for people who host their own files.

## What the user sets up (once)

1. An **app password**, never the account password - Nextcloud: Settings →
   Security → Devices & sessions → "Create new app password" (name it Lolly).
   Revoking it there kills the connection server-side any time.
2. The /profile form: server URL (`https://cloud.example.org`), username, the
   app password, and an optional folder (created on first send). Everything
   stays on the device - never in backups, wiped by Disconnect and Clear-all.

**Save & test** runs a `PROPFIND` on the folder: 401 = wrong username/app
password; a missing folder is fine (created on first send).

## The CORS reality, stated plainly

Browsers require the SERVER's CORS blessing for cross-origin WebDAV, and
Nextcloud does not send CORS headers by default. Three working shapes:

- **Same-origin / reverse-proxied**: the Lolly deploy and the Nextcloud live
  behind the same origin (or the proxy adds the CORS headers) - just works.
- **Self-hosted Lolly**: the instance owner allows their own cloud host in
  both the Nextcloud CORS config and the deploy's `connect-src` CSP.
- **Desktop shell (plans/129 WP4)**: native fetch - neither CORS nor CSP
  applies. The everywhere-answer.

The in-app error names this exact situation when the server is unreachable.

Uploads land at `remote.php/dav/files/<user>/<folder>/<name>` with the file's
real MIME type, and the outcome link opens the folder in the Nextcloud Files
app.
