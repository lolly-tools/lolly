# Acquia DAM / Widen (kind: `acquia-dam`)

Federate an Acquia DAM (Widen) collective **read-only**. Widen is the governance-rich
enterprise DAM, so it brings **native** availability and approval - no custom-field mapping
needed. It is also an exit target ([Off-boarding](#off-boarding)).

## What you need from Widen

- **A Widen API token** (personal access token) with read access to the assets/categories you
  want to federate. In Widen: *Account → API* (or your admin issues one). It is a bearer
  token - treat it as a secret.
- Optionally, a **search query** to scope what federates (else the whole collective).
- No app registration or OAuth flow - scope what federates with lolly-side **exposure**, not
  the token.

## Credential shape

A single bearer token string - the Widen API token. Store it write-only:

```bash
lw providers credential acme-widen     # prompts; never argv, never shell history
```

## instance.json / `lw providers add`

```json
{
  "id": "acme-widen",
  "kind": "acquia-dam",
  "label": "Acme Widen",
  "options": { "query": "ft:(png OR svg)", "approvedStatuses": ["active"] },
  "exposure": { "groups": ["brand"], "requireApproved": true, "tier": "reference" }
}
```

- `options.query` scopes federation with a Widen search query; `options.approvedStatuses`
  (default `["active"]`) is the set of asset statuses that count as **approved**.
- Widen's **`release_date`** and **`expiration_date`** import natively as an
  [availability window](../catalog.md#imported-availability-windows) - no
  `mapping.availabilityFields` needed.
- `exposure.requireApproved: true` federates only assets whose status is in
  `approvedStatuses`. Categories fold into sections for `includeSections` scoping.

## Verify

```bash
lw providers preview --kind acquia-dam --options '{}'
lw providers health acme-widen
```

`401`/`403` → the token is wrong or lacks access; an empty sample under `requireApproved`
means nothing matches `approvedStatuses`.

With a real collective in hand, run the
[Acquia DAM live-verify runbook](acquia-dam-live-verify.md): the ordered pass that confirms
every guessed endpoint and field name, and which constant to edit when one is wrong.

## Notes / limits

- Download/embed URLs are signed + short-lived (`expiringUrls`) - fetched per request,
  streamed; host-pinned to `widencollective.com` / `widencdn.net` (no open proxy).
- Does **not** accept published exports.

## Off-boarding

**An exit target**, and the least mapping work of the set.

Kind-specific: `release_date`/`expiration_date` import as
[availability windows](../catalog.md#imported-availability-windows) and asset statuses map onto
approval through `approvedStatuses`, so nothing has to be re-entered by hand. Bytes come out
through `embeds.original`, falling back to the `_links.download` href.

Motion, cadence and the per-DAM readiness table: [off-boarding](../offboarding.md).

See also: [catalog](../catalog.md) · [permissions](../permissions.md).
