# Connect an asset source

Your logos, photos and approved files probably live somewhere already: a Nextcloud server, a
bucket, a Google Drive folder or a DAM. Connect that place to Lolly Work as a **source**, and
its files appear in the Work catalog, ready to pick inside Lolly tools without downloading and
uploading them again.

The source stays in charge. Work reads from it and never edits it, and you decide which groups
see which files. Optimizely CMP is the one source that can also receive finished exports, and
only when you turn that on. Penpot is a design-system source: its tokens feed a design system.

When you want the files in Work's own storage, the same connection copies them across and
checks every file. That is the exit, covered in [Leave a DAM](../offboarding.md).

![A source feeds the Work catalog as read-only references. Exposure decides which groups see each file in Lolly tools, and materializing copies the files into your own store.](/info/diagrams/work-integrations/source-flow.svg)

## Choose a source

WebDAV / Nextcloud and Google Drive have a guided setup in the console. Every other source uses
the advanced form or the `lw` command line, following its own guide. Open sources lead the
table, then the cloud drives, then the DAMs.

| Source | Kind | Credential | Setup | Search | Approval | Availability dates | Exit | Unconfirmed live |
|---|---|---|---|---|---|---|---|---|
| [WebDAV / Nextcloud](webdav.md) | `webdav` | login and app password, or bearer | guided | no | none | a custom property you name | yes | paths and property names |
| [S3-compatible](s3.md) | `s3` | access key and secret | form or `lw` | no | none | none | yes | none listed |
| [Git manifest](git.md) | `git` | read token, none if public | form or `lw` | no | none | none | yes | none listed |
| [Penpot](penpot.md) | `penpot` | personal access token | form or `lw` | boards | none | none | design-system source | RPC names |
| [Dropbox](dropbox.md) | `dropbox` | OAuth, `lw providers auth` | `lw` | file names | none | none | yes | none listed |
| [Google Drive](gdrive.md) | `gdrive` | OAuth, browser or `lw` | guided | file names | none | none | yes | none listed |
| [Microsoft 365](o365.md) | `o365` | OAuth, `lw providers auth` | `lw` | whole drive | none | none | yes | none listed |
| [Brandfolder](brandfolder.md) | `brandfolder` | API key | form or `lw` | yes | native | native | yes | availability field names |
| [Optimizely CMP](optimizely-cmp.md) | `optimizely-cmp` | OAuth, pasted | form or `lw` | yes | native | native | keep: publishes out | endpoints and fields |
| [Image Relay](imagerelay.md) | `imagerelay` | OAuth, pasted | form or `lw` | yes | none | a field you map | yes | endpoints and fields |
| [Canto](canto.md) | `canto` | OAuth, pasted | form or `lw` | yes | native states | a field you map | yes | endpoints and fields |
| [Acquia DAM / Widen](acquia-dam.md) | `acquia-dam` | API token | form or `lw` | yes | native statuses | native | yes | endpoints and fields |
| [IntelligenceBank](intelligencebank.md) | `intelligencebank` | API key | form or `lw` | yes | native workflow states | native | yes | endpoints and fields |
| [Cloudinary](cloudinary.md) | `cloudinary` | API key and secret | form or `lw` | yes | a tag you choose | fields you map | yes | access, metadata and fidelity |
| [Orange Logic](orange-logic.md) | `orange-logic` | client credentials or bearer | form or `lw` | yes | a field you choose | fields you map | renditions only | fields, auth and storage hosts |

How to read the columns:

- **Approval** is what `exposure.requireApproved` can gate on. With no signal, curate a folder
  of approved files instead; turning the gate on would federate nothing.
- **Exit** means [materialize, then cut over](../offboarding.md). Orange Logic copies its
  renditions but refuses a cutover, because it has no access to protected originals.
- **Unconfirmed live** lists what still comes from vendor documentation rather than from a live
  service. Nine drivers carry such a checklist; Brandfolder's two availability field names are
  also unconfirmed. Before you rely on one of those sources,
  [check it on your own tenant](tenant-check.md).

`mock` is a synthetic source for local development and has no guide.

## Connect a source in four steps

Open **Assets & tools > Providers** at `/admin#/providers` and choose **Connect a source**.
The WebDAV and Google Drive cards open a guided connection, whose guide walks through its own
buttons. Every other card opens the advanced form, which follows the four steps below. The same
steps run through the `lw` command line.

::: timeline
- **Try it first.** **Test connection** (or `lw providers preview`) checks the credential and
  maps a sample of files. Nothing is saved.
- **Create the source, disabled.** **Create source** (or `lw providers add`) saves the settings.
  Nothing reaches the catalog yet.
- **Seal the credential.** An owner chooses **Set key** (or `lw providers credential`). The
  secret is sealed at rest and only its fingerprint is ever shown again.
- **Sync, check, then enable.** **Sync** (or `lw providers sync`) fetches the listing. Check the
  count and the notes, then an owner chooses **Enable** (or `lw providers enable`).
:::

```bash
lw providers preview --kind s3 --options '{"bucket":"acme-brand"}'   # dry run, nothing stored
lw providers add acme-s3 --kind s3 --label "Acme bucket" --options '{"bucket":"acme-brand"}'
lw providers credential acme-s3   # hidden prompt; never argv, never shell history
lw providers sync acme-s3
lw providers enable acme-s3       # owner-only
```

Creating, syncing and deleting a source needs `catalog.provider.manage`. Setting a credential
and enabling a source need `catalog.provider.credential`, which owners hold. An admin can
prepare and sync a source, then hand the credential and the enable to an owner.

The [`lw` CLI page](../cli.md#catalog-providers) lists every `lw providers` command.

### Read a preview

A preview builds a throwaway source from your flags, checks its health and maps up to ten
files from the first page. Then it throws the record away: no source is created, so a wrong
option costs you a retry. The credential is prompted hidden, even for a dry run. Press enter
for a source that needs none, such as a public `git` manifest.

```
health ok - canto
mapped sample: 10 of 100 on the first page
  id                                name                        type      tags                              formats
  ext/preview/image:AB12C           Summit Keynote Background   image     provider:preview Backgrounds la…  png
```

- The `id` is the catalog id this source would create. `type` is what `mapping.typeMap` or
  `defaultType` resolved to. Sections arrive as tags unless you set `mapping.sectionTags: false`.
- The sample passes the same exposure settings a real sync applies. What they removed is
  counted on the same line (`, N EXCLUDED by the exposure slice`), so an empty sample tells you
  whether the cause was exposure or the source options.
- `--json` prints the raw response. Exit code `2` means the health check failed.

`--shape` answers a different question and returns no sample. It reports the call the driver
made and the field labels and value types the service returned, compared with the labels the
driver reads. It never prints a value, so you can send the output to someone else. The seven
drivers whose field names still come from vendor documentation support it: `webdav`, `canto`,
`imagerelay`, `intelligencebank`, `acquia-dam`, `cloudinary` and `orange-logic`. Add
`--remote-id <id>` for a second report on the per-file detail call, which carries the download
link; `imagerelay`, `intelligencebank`, `acquia-dam`, `cloudinary` and `orange-logic` make that
call. [Check a source on your own tenant](tenant-check.md) explains how to read the report.

## Rules every connection follows

- **Credentials are write-only.** They are sealed at rest, and only a fingerprint is ever
  returned.
- **Sources are read-only.** Deleting a source never touches the files at the source.
- **Fetches are host-pinned.** Each driver talks only to its own service's hosts, so Work is
  never an open proxy.
- **Exposure decides what federates,** not the reach of the platform credential.
- **You bring the tokens and apps.** No client ids or keys ship with Lolly Work.

A shared service credential does not carry each member's own upstream permissions. Set the
exposure groups for the people who should see the files.

## Settings every source shares

Each guide shows its own `options`. These blocks work the same way for every kind:

| Setting | What it does |
|---|---|
| `exposure.groups` | Member groups that see the files. Absent or `*` means every member. |
| `exposure.requireApproved` | Federate only files the source marks approved (see the Approval column). |
| `exposure.includeSections`, `exposure.excludeTags` | Keep only these sections; drop files carrying these tags. |
| `exposure.tier` | The catalog tier stamped on each file. |
| `mapping.typeMap`, `mapping.defaultType` | Map the source's own types to catalog types. |
| `mapping.sectionTags` | Fold sections and folders into tags (default `true`). |
| `mapping.hiddenTags` | Labels these files never show, as exact tags or `prefix*` patterns. The files stay in the catalog. |
| `mapping.availabilityFields` | The source fields an availability window reads, for sources that keep dates in custom fields. |
| `sync.ttlSeconds` | How long a synced listing is served before a background refresh (default 300). |
| `sync.maxAssets` | The most files one sync federates (default: the instance limit, 100,000). A sync that stops there is marked as truncated, with a note. |

A source written into `instance.json` under `catalogProviders` is **config-managed**. Work
creates it at boot and the console shows it read-only ("via instance.json"). Its credential
comes from the environment variable its `credentialRef` gives. Change it in your deployment and
redeploy.

When a vendor credential expires on a schedule, record the date:
`lw providers credential <id> --expires 2026-12-01`. From 14 days before that date,
`lw providers list` and the console's source row show how many days remain.

## OAuth sources

Every OAuth source here uses an app **you** register on the platform. Lolly Work ships no
client ids. The sealed credential is the same JSON for every OAuth kind:

```json
{ "clientId": "…", "clientSecret": "…", "refreshToken": "…" }
```

Only the way you capture the refresh token differs, and that splits the kinds in two.

### Kinds with a registered consent flow (dropbox, gdrive, o365)

`lw providers auth` captures the whole credential for these three:

```bash
lw providers add acme-x --kind <dropbox|gdrive|o365> --label "…" --options '{…}'
lw providers auth acme-x        # prompts for client id and secret, runs a loopback PKCE consent
lw providers enable acme-x      # owner-only
```

1. It prompts for **your** app's client id and, unless the app is public (PKCE only), its
   client secret. Neither goes on the command line or into shell history.
2. It prints the platform's consent URL. Open it in a browser and approve; the code comes back
   to `http://127.0.0.1:<port>` and is exchanged for a **refresh token**.
3. It stores `{clientId, clientSecret?, refreshToken}` through the same write-only credential
   endpoint as an API key. Access tokens are never stored: each process mints them from the
   refresh token and keeps them in memory.

Grant the app read-only scopes plus offline access, as each guide lists. Revoking the grant on
the platform makes the next refresh fail; run `lw providers auth` again to re-consent.

Google Drive also has a [browser consent journey](gdrive.md#guided-connection-in-the-app) for sources
created through the guided setup. Its redirect URI is shown in the console and is separate from
the CLI's loopback route.

### Kinds whose consent flow is not registered (canto, imagerelay, optimizely-cmp)

Their authorize endpoints are not yet confirmed against a real tenant, so Lolly Work registers
no consent flow for them and `lw providers auth` refuses these kinds with the remedy. Put the
credential in with `lw providers credential`, which works for every kind:

```bash
lw providers add acme-canto --kind canto --label "…" --options '{…}'
lw providers credential acme-canto   # prompts for the JSON; never argv, never shell history
lw providers enable acme-canto       # owner-only
```

The refresh token comes from the vendor's own documented OAuth2 authorization-code flow, run
once by hand against the app you registered:

1. Register an app under your own contract in the vendor's console, with a redirect URI you
   control. In Canto, an admin creates the App ID and Secret under
   *Settings > Configuration Options > API Keys*.
2. Run the vendor's documented authorize step for that app, asking for read scopes plus offline
   access, and collect the authorization code.
3. Exchange that code for a **refresh token** at the vendor's documented token endpoint.
4. Paste `clientId`, `clientSecret` and `refreshToken` into `lw providers credential <id>`.

The vendor's API documentation is the source of record for steps 2 and 3, because Lolly Work
has confirmed no authorize URL for these kinds. From then on everything works as for the flow
kinds: write-only at rest, with access tokens minted per process. A tenant check that confirms
a kind's authorize and token endpoints moves the kind into the section above.

## Instance settings two features need

- **The exit** writes copies into the instance's own
  [blob store](../catalog.md#where-instance-bytes-live). That is Postgres by default
  (`blobs.driver: "pg"`). For S3, set `blobs.s3.bucket` (and `endpoint` for MinIO or Ceph) and
  the environment-only credential `LW_BLOBS_S3_CREDENTIAL` before you materialize.
- **Publish-out** to Optimizely CMP signs nothing itself. It checks that the export already
  carries Lolly's export assertion, so the instance needs an export signer (`render.c2pa` and
  `LW_C2PA_SIGNING_KEY`, see [c2pa](../c2pa.md)). Without one, exports are unsigned and the
  publish route refuses them.

## Leave a platform, or check one first

- [Leave a DAM](../offboarding.md): when to pin, how the cutover moves each file's identity, and
  what each DAM carries across.
- [Check a source on your own tenant](tenant-check.md): confirm the unconfirmed endpoints, field
  names and file fidelity before you rely on a source.

::: details For contributors: how these guides are checked
The Lolly Work repository's `tests/provider-config-contract.test.ts` treats these pages as a
contract, so a driver change that outruns its guide fails CI there. It checks that:

- every shipped kind has a guide with the required headings, whose `instance.json` example
  parses through `parseConfig` and whose `options` keys match the driver;
- only the one kind that can publish out has a `## Publishing` section;
- every DAM kind has an `## Off-boarding` section and a row in [Leave a DAM](../offboarding.md);
- every `lw` command on any page exists in `cli/lw.ts`, with `lw providers auth <id>` allowed
  only for a kind `oauthFlowFor` registers a consent flow for;
- every driver hardened for a tenant check has the maintainer runbook its error messages name.
:::
