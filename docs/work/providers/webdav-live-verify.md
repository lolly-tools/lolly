# WebDAV live-verify runbook (kind: `webdav`)

The server-day checklist for the [`webdav` driver](webdav.md). Every URL template, property name
and multistatus assumption in that driver comes from RFC 4918 and Nextcloud's public
documentation, and none of it has been confirmed against a running server by this repo: the
driver is fixture-tested with an injected `fetch`, so building and testing it contacts nothing.
This pass confirms them. Nothing here writes to the server, and it takes about 20 minutes.

Unlike the DAM runbooks beside it, this one is short on field mapping and long on **paths**: a
WebDAV server has almost no metadata to guess at, and almost all of the risk sits in the files
root the driver builds and in how the server spells its hrefs.

## Before you start

- A WebDAV server you may test against. Run it in both flavors if you can: a Nextcloud, and one
  generic RFC 4918 server (Apache `mod_dav`, ownCloud, Sabre/DAV). The two exercise different
  URL templates, and the rest of the driver is identical.
- A read-only account on it, and for Nextcloud an **app password** from Settings > Security, never
  the account password. One sealed string, `<username>:<password>`.
- That account's **login name**, which is what the Nextcloud DAV path carries and which can differ
  from the display name (row 1).
- A folder with at least one subdirectory under it, so the recursive walk and the section mapping
  both get exercised, and at least one file with a non-ASCII character or a space in its name
  (row 7).
- On this instance: `catalog.provider.manage` for every step, plus `catalog.provider.credential`
  (owner-only) for the credential and `enable` in step 3.
- One file you can also download from the server's own web UI, for step 3.

## Step 1: auth and the files root

```bash
export LW_BASE=https://lolly.example
lw login                                   # device sign-in; or: lw login --cookie 'lw_session=…'

lw providers preview --kind webdav \
    --options '{"baseUrl":"https://cloud.example","flavor":"nextcloud","username":"lolly-federation","root":"Brand"}'
```

The credential prompt is hidden - paste `<login>:<app password>`. `preview` builds an ephemeral
provider record, asks the server and throws it away: nothing is created, stored or enabled, so a
wrong option costs a retry. `health ok` means the `PROPFIND` with `Depth: 0` against the files
root returned a multistatus, which is rows 1, 2, 3 and 6 all at once.

| Symptom | What it means | What to fix |
|---|---|---|
| `health FAILED: webdav propfind 401 - the server rejected the credential` | the credential was refused | Wrong login or password, or the account password where an app password is required. Rule it out in the server UI first. |
| `health FAILED: webdav propfind 403 - the server rejected the credential` | the credential is real, this path is not readable by it | The share or the mount permission, not the driver. |
| `health FAILED: webdav propfind 404 for /remote.php/dav/files/…` | the server answered and that path is not there | Rows 1 and 2. The printed path is exactly what the driver built, so compare it against the URL your browser shows. |
| `health FAILED: webdav propfind 405 for /…` | `PROPFIND` did not reach the server | A reverse proxy passing only `GET`, or `Dav On` missing. Row 3. |
| `health FAILED: webdav propfind 301 for /… - the server redirected, sending it to …` | the server wants a different URL | Almost always the trailing slash on a collection (row 3); the message identifies the host and path it was being sent to, so compare that against `options.baseUrl`. This driver refuses every redirect rather than following it, because following one is how a pinned host stops being pinned. |
| `health FAILED: webdav PROPFIND answered without a multistatus root element (live-verify: …)` | something answered, and not with RFC 4918 XML | Row 6, or a captive portal or proxy error page in front of the server. |
| `health FAILED: webdav credential must be "<username>:<password>" …` | the sealed string is neither documented form | No request left the process. |

Exit code `2` means health failed. `--shape` calls the server only when health is ok.

## Step 2: capture the structure

One command, one file:

```bash
lw providers preview --kind webdav --shape \
    --options '{"baseUrl":"https://cloud.example","flavor":"nextcloud","username":"lolly-federation","root":"Brand"}' \
    > webdav-shape.txt
```

The file holds one report for a `PROPFIND` with `Depth: 1` on the files root, asked with
`<d:propname/>`: property identifiers only, no values, no file content, no hrefs - a request that named
properties would get back only what it named (RFC 4918 section 9.1) and could never say what
the server calls a property instead. The Nextcloud endpoint line prints
`/remote.php/dav/files/<username>/` with the real login masked (it is half the Basic
credential). The prompt goes to stderr. Read the three groups in this order:

1. **EXPECTED BY THIS DRIVER, ABSENT** - the wrong guesses, and the answer this page exists for.
   Each entry reads `key|alternatives (CONSTANT_NAME)`, so it identifies the constant to widen.
   `(none)` means every guess matched.
2. **IN THE RESPONSE, NOT MAPPED** - every other property your server carries on these resources.
   This is where a custom property carrying a date will show up, and it is the fix for an absent
   guess: ABSENT `getcontentlength (PROP_SIZE_KEYS)` beside NOT MAPPED `contentlength` is one
   constant edit.
3. **MAPPED BY THIS DRIVER** - confirmed. `oc:tags` proves itself here, or falls into ABSENT (row 5).

If your server refuses `<d:propname/>` the report still comes back, from the mapping request
instead, and says so in a note - NOT MAPPED is then empty by construction, and the note carries the
`curl` to run by hand for the real names.

Property names in the `record:` block are unioned across every resource on the page, and the page
includes the directory describing itself, so a property only files carry does not read as absent.

## The assumption table

One row per `LIVE-VERIFY` bullet in the driver header (`server/src/catalog/providers/webdav.ts`),
the property-names bullet expanded per constant. If a row and that header disagree, the header is
right and this table is stale.

| # | The assumption | How the report answers it | Fix it in `providers/webdav.ts` |
|---|---|---|---|
| 1 | The Nextcloud files root is `<baseUrl>/remote.php/dav/files/<username>/<root>`, and the `<username>` in it is the **login** name | Not in the diff: the report's first line prints the path it called, with the login masked. A wrong one fails step 1 as a `404`, or reaches a real path that holds nothing you recognise | `NEXTCLOUD_FILES_PATH`; the login itself is `options.username` on the entry, which defaults to the credential's username |
| 2 | The generic files root is `<baseUrl>/<root>` and nothing else | Same: the first line is the path. A generic server mounting DAV somewhere else needs that whole path as `options.baseUrl` | `options.baseUrl` / `options.root` on the entry - the generic arm builds no template of its own |
| 3 | `PROPFIND` with `Depth: 1`, the body from `propfindBody()`, and a trailing slash on a collection URL, are what the server wants | Step 1 is the answer: a `405` is the method, a `400` is the body, a `301`/`302` is usually the slash. This driver passes `redirect: 'manual'` and treats a `3xx` as a failure naming the host it was being sent to, so a redirect is a failure, not a detour | `propfind` and `urlFor`; the body is `propfindBody`, the refusal is in `request` |
| 4 | Sizes ride `getcontentlength`, stamps `getlastmodified`, content types `getcontenttype`, and a directory is a `resourcetype` carrying a `collection` child | ABSENT `getcontentlength (PROP_SIZE_KEYS)` and friends, with the real names in NOT MAPPED. A file with no size and no stamp on any resource also prints a sync note naming both constants | `PROP_SIZE_KEYS` / `PROP_MODIFIED_KEYS` / `PROP_CONTENT_TYPE_KEYS` / `PROP_RESOURCETYPE_KEYS` / `COLLECTION_ELEMENT` |
| 5 | Nextcloud returns `oc:tags` on a plain `PROPFIND`, with its values as child elements | ABSENT `tags (PROP_TAGS_KEYS)` means the server did not return it, which is recoverable: tags are optional and nothing else depends on them. Values riding as text rather than children shows as one comma-joined string in the record block | `PROP_TAGS_KEYS`, and the `childTexts` read in `toAsset`. `oc:fileid` is not requested - it cannot address bytes, so a rename federates as a new asset either way |
| 6 | The multistatus layout: `multistatus` > `response` > `href` plus one `propstat` per status, readable properties under the `200` one | The two hard failures name themselves - `PROPFIND answered without a multistatus root element` and `the multistatus body carried no response element`. A wrong `propstat` or `status` name reads instead as every property absent at once | `MULTISTATUS_ELEMENT` / `RESPONSE_ELEMENT` / `HREF_ELEMENT` / `PROPSTAT_ELEMENT` / `PROP_ELEMENT` / `STATUS_ELEMENT` |
| 7 | Hrefs come back either absolute-path or as a full URL, percent-encoded the way `decodeURIComponent` reads | The failure is loud: `none of the N resource(s) PROPFIND returned sit under the files root this driver built`, naming the root it built. A single file whose href will not read is counted in `skipped` on the sync instead. This is why step 1 wants a filename with a space or a non-ASCII character in it | `hrefPath` and `relFromRoot`. An href naming another host is refused outright (`webdav href points at <host>, not the configured host <host>`), which is the host pin and is not a bug to fix |
| 8 | About 4 requests a second is polite | Not in the report - WebDAV publishes no rate limit at all, so this is caution rather than a documented ceiling. A small self-hosted box may want less | `DEFAULT_GAP_MS`, or `options.minGapMs` per entry, which is the one to reach for |
| 9 | The body parser handles the multistatus layout only | Known limitation: a `>` inside an attribute value is not handled. No server has been observed doing it, and an unclosed element fails loudly (`could not read the PROPFIND body: <x> … is never closed`) rather than federating half a directory as if it were all of it | `elements` / `findClose` |
| 10 | `<d:propname/>` is accepted, which is what step 2's report asks with | The report says which body it got: the propname note, or the fallback note naming the error the server answered with. A fallback means NOT MAPPED is empty by construction, not that your server carries nothing else | `propnameBody`, and the `try`/`catch` in `sampleShape` |
| 11 | `<d:allprop/>` with `<d:include>` is accepted, and a custom **dead** property carrying a date comes back under it | Only asked for when `mapping.availabilityFields` is set on the entry. A `400` on the first sync after setting it is this row; a sync note naming `mapping.availabilityFields` means the request went out and the name did not match | `propfindBody`'s `allprop` arm |

Nothing in this table is about availability, approval or renditions, because plain WebDAV models
none of them. If your server exposes a **custom property** carrying a date, it will be sitting in
the report's NOT MAPPED group: name it in `mapping.availabilityFields` on the entry - the **local**
name, prefix dropped - and re-run. Setting it switches the sync's `PROPFIND` from the five named
properties to `<d:allprop/>`, because a named list returns only what it names and that custom
property is not on it (row 11). A configured field that matches nothing prints its own sync note
naming `mapping.availabilityFields`.

## Step 3: bytes, sections and the walk

Only a real provider record exercises the walk and the byte path, so this step creates one.

```bash
lw providers add acme-nextcloud --kind webdav --label "Acme Nextcloud" \
    --options '{"baseUrl":"https://cloud.example","flavor":"nextcloud","username":"lolly-federation","root":"Brand","recursive":true}' \
    --exposure '{"groups":["admin"]}'      # verification pass: admins only, not the whole org
lw providers credential acme-nextcloud     # hidden prompt, the same string as step 1
lw providers enable acme-nextcloud         # owner-only
lw providers sync acme-nextcloud           # federate: confirm the count, read every note
```

Read the sync output for three things: the **count** against what that folder holds; the
**sections**, which should be the subdirectories, one level per directory; and any **note**.
Two notes are bounds rather than errors - `webdav stopped queueing directories at MAX_DIRS` and
`webdav walked MAX_DIRS (500) directories and stopped` - and both mean the tree is bigger than
one pass, so narrow `options.root`. A `skipped` count with no note is two things added together:
resources whose href sat outside the files root (row 7) and responses that carried no href or no
readable `propstat` at all, which is a server declining to describe a member. Send an example of
either. When **every** readable resource sat outside the root the sync fails loudly instead, and
the message says how many of the rest were unreadable.

Then the bytes. `lw providers materialize` runs the same fetch the exit depends on and checksums
what it gets:

```bash
lw providers materialize acme-nextcloud --json
```

Every per-asset failure prints under the summary as `<remoteId>: <message>`, and each message
identifies the assumption, the constant and this page. To check fidelity by hand, take one remote id
from that output - it is base64url of the file's path under the root - and fetch the blob:

```bash
curl -sS -b "$(cat ~/.config/lolly-work/session)" \
    "$LW_BASE/catalog/ext/acme-nextcloud/<remoteId>/file" -o /tmp/webdav-lolly.bin
shasum -a 256 /tmp/webdav-lolly.bin
```

The format segment is `file`: a WebDAV file has exactly one format, its own bytes, and the byte
path is a plain `GET` of the same URL the listing named, with no second call to describe the asset.
Download the same file from the server's web UI and checksum that too. They must match exactly -
WebDAV serves no renditions, so a mismatch is a real defect rather than a conversion, and is worth
reporting immediately. A failure on the blob route surfaces as `502 PROVIDER_UNAVAILABLE`; the
diagnosis is in the materialize output, not there.

Last, the change stamp the drift cadence reads:

```bash
lw providers drift acme-nextcloud
```

`not compared: … carries no change stamp the driver can read` is row 4: the server spells
its modified property in something other than `PROP_MODIFIED_KEYS` (an unparsable
`getlastmodified` is dropped at sync time, so it reports here too) - send the shape/names
the report prints.

Then take the pass down. Materialized copies are instance-owned and survive the delete:

```bash
lw providers disable acme-nextcloud
lw providers rm acme-nextcloud
```

If you have a generic server too, repeat steps 1 through 3 against it with
`--options '{"baseUrl":"https://dav.example/store","flavor":"generic","root":"brand"}'`. Rows 2, 3,
6 and 7 are the ones that differ; row 5 does not apply.

## Step 4: sign off

- **In `server/src/catalog/providers/webdav.ts`**: strike the `LIVE-VERIFY` bullets this pass
  exercised and only those. Bullets 1 and 5 are Nextcloud-only and bullet 2 is generic-only, so a
  pass against one flavor discharges neither the other's. This is where "confirmed against a live
  server on `<date>`" becomes true and may be written, naming the date, the server and its version.
- **Where a guess was wrong**, widen rather than replace - every property constant is an array
  because the next server may spell it differently. Then pin it: a fixture case in
  `tests/webdav-driver.test.ts` for the new spelling, and one for any failure path that changed.
- **In the guides**: the fixture-verified paragraph in [`providers/README.md`](README.md), the
  Notes section of [`providers/webdav.md`](webdav.md), and the storage-source paragraph in
  [`offboarding.md`](../offboarding.md) are where the "fixture-verified only" claim lives. All
  three should now say what was confirmed, on what date, and what remains open.
- **Send back**: `webdav-shape.txt` per flavor; the verbatim text of any driver error you hit;
  which constants you edited and to what; the step 3 checksum result; and the server product and
  version, because that is what makes the answer reusable for the next deploy.

See also: [the WebDAV guide](webdav.md) · [the CLI](../cli.md) · the DAM runbooks:
[canto](canto-live-verify.md) · [imagerelay](imagerelay-live-verify.md) ·
[intelligencebank](intelligencebank-live-verify.md) · [acquia-dam](acquia-dam-live-verify.md) ·
[cloudinary](cloudinary-live-verify.md) · [orange-logic](orange-logic-live-verify.md).
