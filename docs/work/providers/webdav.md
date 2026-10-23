# WebDAV / Nextcloud (kind: `webdav`)

Share one folder from a file server you run, such as Nextcloud, and its files appear in the
Lolly Work catalog for the groups you choose. Work reads the folder and never writes to it, so
the server stays the place where files are added and approved.

The kind is the protocol, not a vendor. Nextcloud is the documented path; ownCloud, Apache
`mod_dav`, Sabre/DAV and any other server that answers RFC 4918 `PROPFIND` use the same kind
with `flavor: "generic"`.

## What you need from the server

::: cols
## Nextcloud

1. **A dedicated read-only account**, such as `lolly-federation`, rather than a person's. Share
   the folder or Group folder with it as **Read only**, or keep the files in its own Files
   tree. A share appears in that account's Files root under the share name, which is what
   `options.root` points at.
2. **An app password for that account**, from **Settings > Security > Devices and sessions >
   Create new app password**. Nextcloud shows it once. Never use the account password: an
   account with two-factor sign-in rejects it at the DAV endpoint, and an app password can be
   revoked on its own.
3. **The account's login name.** The DAV path carries the login, which can differ from the
   display name; **Settings > Personal info** shows both, and the login is the last part of
   the Files URL. That is `options.username`.
4. **The server root** as `options.baseUrl`, such as `https://cloud.example`, including any
   subpath (`https://example.org/nextcloud`). The files root becomes
   `<baseUrl>/remote.php/dav/files/<username>/<root>`.

## Generic WebDAV

- **The URL your server mounts DAV at**, as `options.baseUrl`: `https://dav.example/store` for
  an Apache `Alias` with `Dav On`, or
  `https://cloud.example/remote.php/dav/files/<login>` for ownCloud. The driver appends
  `options.root` and nothing else.
- **A read-only account** over HTTP Basic, on a read-only mount or with no write permission.
  The driver sends only `PROPFIND` and `GET`.
- **`PROPFIND` with `Depth: 1` must reach the server.** A reverse proxy that passes only `GET`
  shows up as a `405` on the first health check.
- **HTTPS.** The credential is HTTP Basic, so a plain HTTP hop hands the password to the
  network.
:::

## Guided connection in the app

1. Open **Assets & tools > Providers** at `/admin#/providers` and choose **Guided connection**
   on the WebDAV storage card.
2. Enter the server type and URL, the folder to expose, the catalog mapping and the member
   groups. Group and section fields take one exact name per line; a comma stays part of the
   name. An empty folder exposes the whole files root and empty groups expose the files to
   every member, so check both.

   ![Guided Nextcloud location, catalog mapping, exact member groups and refresh settings](../shots/provider-webdav-setup.svg)

   The example exposes one curated folder to two exact groups; `Marketing, EMEA` is one group
   name.
3. Enter the read-only account's username and app password, or choose a bearer token. A
   Nextcloud bearer token also needs **Files login**, so the files URL can be built. The
   credential is used only for the test until you save, and is cleared when sealed, discarded
   or when the panel closes. Nothing goes into browser storage.
4. Choose **Test files and original**. The preview lists a sample of the folder and reads one
   original, showing its byte count, content type and SHA-256. Compare that checksum with a
   copy of the same file you trust. The preview's limits are under [Verify](#verify).
5. An owner chooses **Save source and seal credential**. This creates a disabled source and
   checks the credential again before sealing the credential; the server needs
   `LW_CREDENTIAL_SECRET` set first. If sealing fails, the panel keeps the disabled source and
   offers **Retry credential**. Closing the panel leaves the saved source disabled; carry on
   from its row. After a lost response or a reload, check that row before creating the same id
   again.
6. Choose **Sync and enable source** when the folder and groups are right. Work runs a full
   sync first and leaves the source disabled if listing fails or finds no exposed files. Then
   it checks health again and enables the source.

An admin can save a disabled source and hand the credential and the enable to an owner.
Disabling the source from its row stops federation. A config-managed source stays read-only
here: change your deployment and redeploy.

## Credential shape

One string: the login and the app password joined by a colon, or a bearer token for a server
behind a token-issuing proxy. The driver accepts nothing else and refuses before sending a
request.

```
"<username>:<app password>"
"bearer:<token>"
```

```bash
lw providers credential acme-nextcloud   # hidden prompt; never argv, never shell history
```

To rotate, run the same command with a new app password, then revoke the old one in Nextcloud.

## instance.json / `lw providers add`

Nextcloud:

```json
{
  "id": "acme-nextcloud",
  "kind": "webdav",
  "label": "Acme Nextcloud",
  "options": { "baseUrl": "https://cloud.example", "flavor": "nextcloud", "username": "lolly-federation", "root": "Brand", "recursive": true },
  "exposure": { "groups": ["design"], "tier": "reference" }
}
```

Generic WebDAV:

```json
{
  "id": "acme-dav",
  "kind": "webdav",
  "label": "Acme file server",
  "options": { "baseUrl": "https://dav.example/store", "flavor": "generic", "root": "brand", "recursive": true, "minGapMs": 500 },
  "exposure": { "groups": ["marketing"] }
}
```

| Option | What it does |
|---|---|
| `baseUrl` (required) | The server URL. Its host is the pin: an `<href>` naming another host is refused, and a redirect is an error naming its target, never followed. |
| `flavor` | `"nextcloud"` or `"generic"` (default). Picks the URL template and whether Nextcloud's `oc:tags` is requested. |
| `username` | The Nextcloud login in the DAV path. Defaults to the credential's username; set it when the login differs, and always with a bearer token. |
| `root` | Federate only this folder under the files root. Point it at the shared folder rather than a whole home directory. |
| `recursive` | Walk subfolders (default `false`). Each folder level below the root becomes a **section**, so `exposure.includeSections` works on the folders you already have. |
| `minGapMs` | The gap between calls, default `250` (about four a second). WebDAV publishes no rate limit; raise it for a small server. |

**Availability dates.** WebDAV has no approval status, so curate a folder of approved files.
If your server returns a custom DAV property carrying a date, name it in
`mapping.availabilityFields` to import an
[availability window](../catalog.md#imported-availability-windows). Give the local name without
the namespace prefix (`embargo-until`, not `x:embargo-until`). Setting it switches the listing
to `<d:allprop/>` so the custom property comes back, which is a more expensive call.

## Verify

```bash
lw providers preview --kind webdav --options '{"baseUrl":"https://cloud.example","flavor":"nextcloud","username":"lolly-federation","root":"Brand"}'
lw providers credential acme-nextcloud
lw providers health acme-nextcloud
```

`health` sends a `PROPFIND` with `Depth: 0` to the files root, the cheapest call that proves
both the URL and the credential. The console's preview follows up to five directory pages,
inspects at most 1,000 files and reads one original of up to 32 MiB. Each listing is capped at
2 MiB and the whole preview at 30 seconds. A partial response, an empty original, a size
mismatch or a refused download fails the check. A sample is not a full inventory.

| Symptom | What it means |
|---|---|
| `webdav propfind 401 - the server rejected the credential` | Wrong login or password, or the account password where an app password is required. |
| `webdav propfind 403 - the server rejected the credential` | The credential works but this account may not read the folder. Check the share. |
| `webdav propfind 404 for /remote.php/dav/files/…` | The files root is wrong: usually `username` is the display name rather than the login, or `root` is a folder the account cannot see. |
| `webdav propfind 405 for /…` | The server, or a proxy in front of the server, does not allow `PROPFIND`. |
| `webdav propfind 301 for /… - the server redirected, sending it to …` | Usually a missing trailing slash or a `baseUrl` one hop off. The driver refuses every redirect, so it never streams another origin's bytes as your file. |
| `webdav credential must be "<username>:<password>" …` | The sealed string is neither accepted form. Nothing was fetched. |
| `none of the N resource(s) PROPFIND returned sit under the files root this driver built` | The server describes its files by a different path: a proxy rewriting the prefix, or the wrong login. |

To see which properties your server returns (names and value types, never values), add
`--shape`:

```bash
lw providers preview --kind webdav --shape --options '{"baseUrl":"https://cloud.example","flavor":"nextcloud","username":"lolly-federation"}'
```

## Notes / limits

- **Not yet confirmed against a running server.** The URL templates, property names and
  response layout come from RFC 4918 and Nextcloud's documentation, so treat the first sync as
  the check. [Check a source on your own tenant](tenant-check.md#webdav-nextcloud) lists what to
  look at. Contributors changing the driver follow its
  [maintainer runbook](webdav-live-verify.md) in the Lolly Work repository.
- **No search, thumbnails or expiring links.** Nextcloud's SEARCH method is not used and there
  is no rendition endpoint. Files stream through Work on each request.
- **A rename arrives as a new file.** The catalog id is the file's path under the root, so
  moving or renaming a file upstream creates a new entry. Nextcloud's `oc:fileid` survives a
  rename but cannot fetch bytes, so the driver does not use that property.
- **The walk is bounded.** One walk visits at most 500 directories (`MAX_DIRS`). A sync also
  stops at its page ceiling, one page per directory: at least 50 pages, rising with
  `sync.maxAssets` (5,000 at the default 100,000 assets), so 500 directories is usually the
  limit you meet. Either limit is reported as a note on the sync. Narrow `root` rather than
  federating a whole home directory.
- **A destination as much as a source.** You run this server yourself, so there is no vendor
  to leave. It is more often where an [exit](../offboarding.md#exit-readiness-by-kind) copies
  files to than where one starts.
