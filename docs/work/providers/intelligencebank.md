# IntelligenceBank integration with Lolly (kind: `intelligencebank`)

Connect an IntelligenceBank DAM and its assets appear in the Lolly Work catalog, with its own
expiry and review dates and workflow states carried across. No custom-field mapping is
needed. IntelligenceBank stays the source: Work reads through the current v3 Graph API and
never writes back.

## Onboarding

1. Choose the supported platform URL, folder and Work groups. Explicitly configure the workflow states that should count as approved; without that list every asset federates as approved.
2. Obtain the tenant API key described below and follow the [four-step connection](README.md#connect-a-source-in-four-steps). The driver discovers its v3 API address through the login handshake.
3. Run the [IntelligenceBank tenant check](tenant-check.md#intelligencebank). Verify the login response, download bytes, publish, expiry and review dates, then test member access and a real production task before broadening the source.

## What you need from IntelligenceBank

- **Your platform URL**: your tenant's address, such as `https://acme.intelligencebank.com`
  (the `platformUrl` option). It must be on `intelligencebank.com`; tenants on a custom domain
  are not supported yet.
- **An API key** for that tenant with read access to what you want to federate. The driver logs
  in with it through IntelligenceBank's documented handshake and finds the tenant's v3 API
  address itself, so you never configure that address.
- **Which workflow states count as approved** in your tenant, for `approvedStates`. They differ
  per tenant.

## Credential shape

A single sealed string: the tenant API key used for the login.

```bash
lw providers credential acme-ib     # prompts; never argv, never shell history
```

## instance.json / `lw providers add`

```json
{
  "id": "acme-ib",
  "kind": "intelligencebank",
  "label": "Acme IntelligenceBank",
  "options": { "platformUrl": "https://acme.intelligencebank.com", "approvedStates": ["Approved", "Published"] },
  "exposure": { "groups": ["brand"], "requireApproved": true, "tier": "reference" }
}
```

- `options.platformUrl` (required) is your tenant URL, where the login happens.
- `options.approvedStates` lists the workflow states that count as **approved**. Without it,
  every asset federates as approved.
- `options.folderId` federates one folder.
- IntelligenceBank's own publish, expiry and review dates import as an
  [availability window](../catalog.md#imported-availability-windows) with no mapping.

## Verify

```bash
lw providers preview --kind intelligencebank --options '{"platformUrl":"https://acme.intelligencebank.com"}'
lw providers health acme-ib
```

A `login <status>` error means the platform URL or the API key is wrong.

## Notes / limits

- **Not yet confirmed against a live tenant.** The login response, field names and download
  link come from IntelligenceBank's documentation.
  [Check a source on your own tenant](tenant-check.md#intelligencebank) lists what to look at.
  Contributors changing the driver follow its
  [maintainer runbook](https://github.com/lolly-tools/lolly-work/blob/main/server/src/catalog/providers/live-verify/intelligencebank.md) in the Lolly Work repository.
- **v3 Graph API only.** Nothing uses the deprecated v2 resource endpoints. The one v2-named call
  is the login, which IntelligenceBank defines as the way to sign in to v3.
- **Pinned hosts.** The discovered v3 address and every download are pinned to the
  `intelligencebank.com` hosts; a `platformUrl` elsewhere is refused.

## Off-boarding

IntelligenceBank supports the exit sequence after its [tenant check](tenant-check.md#intelligencebank). Qualify `publish_date`, `expiry_date`, `review_date` and the configured approved workflow states; those mappings do not recreate the vendor's review history or complete rights records.

Prepare the destination with the [self-hosting strategy with S3 storage](../offboarding.md#self-host-lolly-work-with-s3-storage), then use [Leave a DAM](../offboarding.md) for materialize, drift and cutover. Compare originals, inspect mapped governance on the copies and separately retain required history and unmapped metadata before retiring the tenant.

Compare [offboarding destinations](../offboarding.md#choose-your-offboarding-path), starting with open-source services you can run. Each route remains subject to this source's limits.
