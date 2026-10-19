# IntelligenceBank (kind: `intelligencebank`)

Federate an IntelligenceBank DAM **read-only**. Targets the current **v3 Graph API** only.
IntelligenceBank is governance-rich - native expiry/review dates and workflow states - so it
brings availability and approval without custom-field mapping. It is also an exit target
([Off-boarding](#off-boarding)).

## What you need from IntelligenceBank

- **Your platform URL** - your tenant's IntelligenceBank instance, e.g.
  `https://acme.intelligencebank.com` (the `platformUrl` option).
- **An API credential** for that tenant (an API key with read access to the resources you want
  to federate). The driver performs IntelligenceBank's documented login handshake with it and
  discovers the per-tenant v3 API URL automatically - you never configure that URL.
- Note which **workflow states** count as "approved/released" in your tenant (they're
  tenant-specific), so you can set `approvedStates`.

## Credential shape

A single sealed string - the tenant API key used for the login handshake:

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

- `options.platformUrl` (required) - your tenant URL (the login endpoint). The v3 API base is
  discovered at login, not configured.
- `options.approvedStates` - the workflow states that map to **approved**; omit it and every
  asset federates as approved.
- `options.folderId` scopes federation to one folder.
- Native **expiry/review dates** import as an
  [availability window](../catalog.md#imported-availability-windows) - no
  `mapping.availabilityFields` needed.

## Verify

```bash
lw providers preview --kind intelligencebank --options '{"platformUrl":"https://acme.intelligencebank.com"}'
lw providers health acme-ib
```

`login <status>` errors mean the platform URL or API key is wrong.

With a real tenant in hand, run the
[IntelligenceBank live-verify runbook](intelligencebank-live-verify.md): the ordered pass that
confirms the login response, every guessed field name and the download href, and which
constant to edit when one is wrong.

## Notes / limits

- **v3 Graph API only** - no work against the deprecated v2 resource endpoints; the one
  v2-named call used is the login handshake, which IntelligenceBank defines as the auth
  mechanism *for* v3.
- The discovered per-tenant `apiV3url` and all downloads are host-pinned to the
  `intelligencebank.com` family (no open proxy); a custom-domain tenant needs that host added
  at ship time.
- Does **not** accept published exports.

## Off-boarding

**An exit target**, and the governance-richest of them: an exit keeps most of what the DAM
knew.

Kind-specific: `publish_date` and `expiry_date`/`review_date` become
[availability windows](../catalog.md#imported-availability-windows), and the tenant's workflow
states map onto approval through `approvedStates`.

Motion, cadence and the per-DAM readiness table: [off-boarding](../offboarding.md).

See also: [catalog](../catalog.md) · [permissions](../permissions.md).
