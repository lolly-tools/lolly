# Provider onboarding guides

Per-platform setup for each catalog **provider** kind - written for the owner of the source
platform. Each guide follows the same skeleton: *what you need from the platform* → *the
credential shape* → *a copy-pasteable `instance.json` example* → *verify* → *notes/limits*.

The lolly side of providers (exposure, lifecycle, the exit, publish-out) lives in
[catalog.md](../catalog.md); who may do what is in [permissions.md](../permissions.md);
leaving one of these platforms is [offboarding.md](../offboarding.md).

The app offers a [guided WebDAV / Nextcloud connection](webdav.md#guided-connection-in-the-app)
and [guided Google Drive connection](gdrive.md#guided-connection-in-the-app), with typed
configuration, a paged preview, one original-file checksum, sealed credential storage and
reviewed activation. Google Drive captures consent in the browser using your registered web
client. The other kinds currently use their advanced forms or CLI consent flows below.

Open and sovereign sources lead the table: a server you run yourself is the first thing to reach
for, and the vendor platforms below that table are mostly sources you are federating in order to leave.

| Kind | Auth | Guide |
|---|---|---|
| `webdav` | `user:app password` (Basic) or bearer; Nextcloud, ownCloud, mod_dav | [webdav.md](webdav.md) |
| `brandfolder` | bearer API key | [brandfolder.md](brandfolder.md) |
| `s3` | `key:secret` (SigV4) | [s3.md](s3.md) |
| `optimizely-cmp` | OAuth2 (federate-in **and** publish-out) | [optimizely-cmp.md](optimizely-cmp.md) |
| `git` | token (or public) | [git.md](git.md) |
| `dropbox` | OAuth2 (BYOT) | [dropbox.md](dropbox.md) |
| `gdrive` | OAuth2 (BYOT) | [gdrive.md](gdrive.md) |
| `o365` | OAuth2 (BYOT) | [o365.md](o365.md) |
| `penpot` | personal access token (self-hosted); design-system source | [penpot.md](penpot.md) |
| `imagerelay` | OAuth2 (BYOT); off-boarding source | [imagerelay.md](imagerelay.md) |
| `canto` | OAuth2 (BYOT); off-boarding source | [canto.md](canto.md) |
| `acquia-dam` | bearer token (Widen v2); native availability | [acquia-dam.md](acquia-dam.md) |
| `intelligencebank` | login handshake (v3 Graph API); native governance | [intelligencebank.md](intelligencebank.md) |
| `cloudinary` | sealed API key/secret; original files by immutable asset ID | [cloudinary.md](cloudinary.md) |
| `orange-logic` | client credentials or bearer; permitted renditions only | [orange-logic.md](orange-logic.md) |

`mock` is a test/demo driver and has no onboarding guide.

## The live-verify runbooks

Seven drivers ship **fixture-verified**: their endpoint paths and field names come from public
documentation and have not been confirmed against a real server, because this repo signs no
vendor EULA to obtain a tenant and runs no reference installation. Each carries a `LIVE-VERIFY`
checklist in its source header and a runbook beside its guide that discharges it in one ordered
pass - `lw providers preview --shape` for the record structure the server returns, an assumption
table mapping each guess to the constant that holds it, and a blob fetch to prove the bytes are
the original rather than a rendition:

| Kind | Runbook |
|---|---|
| `webdav` | [webdav-live-verify.md](webdav-live-verify.md) |
| `canto` | [canto-live-verify.md](canto-live-verify.md) |
| `imagerelay` | [imagerelay-live-verify.md](imagerelay-live-verify.md) |
| `intelligencebank` | [intelligencebank-live-verify.md](intelligencebank-live-verify.md) |
| `acquia-dam` | [acquia-dam-live-verify.md](acquia-dam-live-verify.md) |
| `cloudinary` | [cloudinary-live-verify.md](cloudinary-live-verify.md) |
| `orange-logic` | [orange-logic-live-verify.md](orange-logic-live-verify.md) |

The six DAM runbooks are written for the platform team running the pass on a customer's tenant;
the `webdav` one is written for whoever administers the server, since with this kind that is
usually the same organization. All of them name file paths and constants.

Universal rules across every kind: credentials are **write-only** (sealed at rest, only a
fingerprint is ever returned), providers are **read-only** federation (deleting one never
touches remote content), fetches are **host-pinned** (never an open proxy), and exposure -
not the platform credential - decides what federates. Bring your own tokens/apps; none ship
in this repo.

## Identity and authority qualification

Qualify the selected file, its original/preview distinction and the source's revision behaviour
for the intended task. The federated metadata version is a cache change token; exact historical
bytes require a qualified revision or permitted retained copy and a verified digest. See
[cache versions and exact source references](../catalog.md#cache-versions-and-exact-source-references).

Record whether the connection exposes an administrator-selected subset through a shared
service credential or delegates each member's upstream identity. A shared credential does
not automatically preserve personal upstream permissions. Exposure and lifecycle gates must
cover previews, originals, search, counts and any future recipe/history projection.

Source access, outbound delivery and model processing require separate authority even when
the same vendor supplies them. An upstream approved flag describes the mapped source state;
review scope and territory/channel eligibility need their own evidence. These qualifications
do not add a new provider, delegated-authentication mode or historical resolver.

For a proposed integration, keep a task-specific contract sheet with the following evidence.
Documentation and fixture results are distinct from a tenant observation or release qualification.

| Area | Evidence to qualify |
|---|---|
| API and identity | Product/module, API revision, tenant/workspace, service or delegated mode, scopes and live permission/revocation behaviour. |
| Content and attributes | Selected original/file/version and observed digest; historical-byte retrieval separately from historical metadata, policy and review snapshots. |
| Search | Allowed combinations per mode, required exact filters, paging/order, result caps, count/facet completeness and unavailable-source reporting. |
| Readiness | The exact action/representation that can proceed; accepted transfer, pending processing, preview, original, review and publication are separate observations. |
| Review | Subject, purpose/activation target, revision, origin and whether a person or an automated rule decided. A flag alone is incomplete evidence. |
| Side effects | Explicit bounded targets, create/new-version/replace and conflict policy, destination authority, budget and reconciliation after uncertain completion. |
| Portability | Content schema/revision/locale mappings where needed, retained evidence and a demonstrated exit with unsupported fields listed. |

A viewer's current context must not silently become a batch's action targets or destination.
Preview those targets, keep stable item identity through retries, and qualify per-item authority
at admission and commit. This is an onboarding requirement for future operations; existing
provider booleans and read-only guides do not implement the richer action contract.

## OAuth kinds

Every OAuth kind here is BYOT: you register **your own** app on the platform - no client ids
ship in this repo - and the sealed credential is the same one JSON blob either way:

```json
{ "clientId": "…", "clientSecret": "…", "refreshToken": "…" }
```

What differs is only **how that blob is captured**, and that splits the kinds in two.

### Kinds with a registered consent flow (dropbox, gdrive, o365)

Google Drive also supports the [browser journey](gdrive.md#guided-connection-in-the-app)
for DB-managed sources with guided settings. Its web-client redirect URI is shown in the
app; the CLI's loopback registration below remains a separate route.

`lw providers auth` runs the whole capture for these three:

```bash
lw providers add acme-x --kind <dropbox|gdrive|o365> --label "…" --options '{…}'
lw providers auth acme-x        # prompts for client id/secret, runs a loopback PKCE consent
lw providers enable acme-x      # owner-only
```

`lw providers auth`:

1. Prompts for **your** app's client id and (unless it's a public/PKCE-only app) client
   secret - never argv, never shell history.
2. Runs a **PKCE loopback** consent: opens the platform's consent screen, receives the code
   on `http://127.0.0.1:<port>`, exchanges it for a **refresh token**.
3. Stores `{clientId, clientSecret?, refreshToken}` through the same write-only credential
   endpoint as any API key. Access tokens are never persisted - they're minted per process
   from the refresh token and cached in memory.

Grant the app **read-only** scopes plus offline access (see each guide). Revoking the grant
on the platform makes the next refresh fail - re-run `lw providers auth` to re-consent.

### Kinds whose consent flow is not registered (canto, imagerelay, optimizely-cmp)

Their authorize endpoint is among the details **not confirmed against a real tenant**, so
`oauthFlowFor` registers no consent flow and `lw providers auth` refuses these kinds, naming
the remedy. The blob goes in through `lw providers credential`, which works for any kind:

```bash
lw providers add acme-canto --kind canto --label "…" --options '{…}'
lw providers credential acme-canto   # prompts for the blob; never argv, never shell history
lw providers enable acme-canto       # owner-only
```

**Where the refresh token comes from.** The vendor's own documented OAuth2
authorization-code flow, run once by hand against the app you registered:

1. Register an app under your own contract in the vendor's console (Canto issues its App ID +
   Secret through support) and allow a redirect URI you control.
2. Run the vendor's documented authorize/consent step for that app, asking for read scopes
   plus offline access, and collect the authorization code it returns.
3. Exchange that code for a **refresh token** at the vendor's documented token endpoint.
4. Paste `clientId` / `clientSecret` / `refreshToken` into `lw providers credential <id>`.

The vendor's own API documentation is the source of record for steps 2 and 3: **this repo
prints no authorize URL for these kinds**, because it has confirmed none. Once the blob is in,
everything downstream is identical to the flow kinds - write-only at rest, and access tokens
minted per process from the refresh token, never persisted. A tenant pass that confirms a
kind's authorize and token endpoints moves it up a section and grows it a consent flow.

## Instance-level config the providers depend on

Two features in the provider layer need instance config beyond the provider entry itself:

- **The exit** (materialize a source into your own store) writes bytes to the
  [BlobStore](../catalog.md#where-instance-bytes-live). `blobs.driver` is `pg` by default
  (zero moving parts); for `s3`, set `blobs.s3.bucket` (and `endpoint` for MinIO/Ceph) and
  the env-only credential `LW_BLOBS_S3_CREDENTIAL=<accessKeyId>:<secretAccessKey>`. See the
  `blobs` block in [`instance.example.json`](../../instance.example.json).
- **Publish-out** signs nothing itself - it *verifies* the export already carries lolly's
  C2PA export assertion, which means an instance **signer** must be configured
  ([c2pa.md](../c2pa.md), `render.c2pa` + `LW_C2PA_SIGNING_KEY`). Without a signer, exports
  are unsigned and the publish route refuses them.

## Keeping these guides honest

`tests/provider-config-contract.test.ts` makes these pages a checked contract, so a driver
change that outruns its guide fails CI. It asserts that:

- every shipped kind has a guide with the required headings, whose `instance.json` example
  parses through `parseConfig` and whose `options` keys match the driver;
- a guide carries a `## Publishing` section only for the one kind whose driver can publish out;
- every DAM kind carries an `## Off-boarding` section and a row in
  [offboarding.md](../offboarding.md);
- every `lw …` command any page under `docs/` instructs - fenced block or sentence - resolves
  against the switches in `cli/lw.ts`, with `lw providers auth <id>` allowed only for a kind
  `oauthFlowFor` registers a consent flow for;
- every driver hardened for tenant day has the live-verify runbook its error messages point at.
