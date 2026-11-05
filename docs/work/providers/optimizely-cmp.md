# Optimizely CMP integration with Lolly (kind: `optimizely-cmp`)

Connect the Optimizely CMP web DAM your website already uses, and its assets appear in the
Lolly Work catalog. Optimizely stays the owner of those assets. If you turn on publishing,
finished Lolly exports can also go the other way: into CMP, carrying their Content Credentials
onto the website.

## Onboarding

1. Identify the website workflow, folders or labels and Lolly Work groups. Keep CMP authoritative for its web assets. Start read-only; enable `publish` only when the outbound workflow has been separately agreed.
2. Register your app, obtain the sealed OAuth credential described below and follow the [four-step connection](README.md#connect-a-source-in-four-steps). Inspect public, archived and expired samples before enabling the source.
3. Confirm the documented endpoints, fields and download bytes on your tenant using [Lolly Verify](#verify) and the [tenant-check process](tenant-check.md). Test member access in one Lolly task. If publishing is needed, separately qualify the signer, grant and upload behaviour in [Publishing](#publishing-lolly-exports-out).

## What you need from Optimizely CMP

- **An OAuth2 app** registered in your CMP instance (one app per instance) with a refreshable
  token. Grant it read access to the DAM, plus upload and create only if you will publish out.
- The client id, client secret and the refresh token your instance issues against them are
  yours. Nothing ships with Lolly Work.

## Credential shape

One sealed OAuth credential, pasted rather than captured:

```json
{ "clientId": "…", "clientSecret": "…", "refreshToken": "…" }
```

```bash
lw providers credential acme-cmp     # prompts for the JSON; never argv, never shell history
```

Get the refresh token by running **CMP's own documented OAuth2 authorization-code flow** once by
hand against your app. `lw providers auth` refuses this kind; see
[OAuth sources](README.md#kinds-whose-consent-flow-is-not-registered-canto-imagerelay-optimizely-cmp).

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

- `options.publish: true` turns on publishing out. It is off by default, and a source without
  it is read-only.
- `options.baseUrl` and `options.tokenUrl` override the default hosts; older tenants use
  `api.welcomesoftware.com`.
- `exposure.requireApproved: true` treats CMP assets that are `is_public` and not `is_archived`
  as approved. CMP's `expires_at` imports as an
  [availability window](../catalog.md#imported-availability-windows).
- A folder name or a label can scope an `includeSections` slice.

## Verify
```bash
lw providers preview --kind optimizely-cmp --options '{}'   # dry run, nothing stored
lw providers health acme-cmp
```

`oauth token refresh failed (401)` means the client id, secret or refresh token is wrong, or the
grant was revoked: capture the credential again. `optimizely-cmp api 401` means the token
exchange worked but the instance refused the access token.

The CMP endpoint paths, asset field names, token endpoint and download host come from CMP's
documentation and are not yet confirmed against a live tenant. Confirm them with a preview on
your own tenant before you rely on this source.

## Publishing Lolly exports out

With `publish: true` and an owner grant of `catalog.provider.publish`:

```bash
lw providers publish acme-cmp --in ./summit-badge.png --name "Summit Badge"
```

Only exports Lolly made can be published. The server checks that the file's Content Credential
carries Lolly's export assertion, so a federated or catalog asset can never be pushed out, and
the instance needs an export signer ([c2pa](../c2pa.md)). Each publish is audited with the export's
provenance chain. The upload request and response formats are modelled on CMP's documentation
and are not yet confirmed against a live tenant.

## Notes / limits

- **Signed, short-lived download links,** fetched on each request and pinned to the CMP and
  Welcome hosts.
- **The only source that accepts published exports.**

## Off-boarding

**Not an exit target.** This integration keeps CMP as the source for the website's assets and optionally publishes Lolly exports back. Do not run `cutover` against this source; keep its `ext/*` identities and the website's dependencies under CMP's authority.

You can [self-host Lolly Work with S3 storage](../offboarding.md#self-host-lolly-work-with-s3-storage) while retaining the CMP connection. That deployment choice does not migrate CMP or replace its web delivery. If retiring CMP is a separate project, obtain and verify a vendor export and plan the website's links and publishing changes separately. [Leave a DAM](../offboarding.md) records the connector limits and the supported exit paths for other sources.

Compare [offboarding destinations](../offboarding.md#choose-your-offboarding-path), starting with open-source services you can run. Each route remains subject to this source's limits.
