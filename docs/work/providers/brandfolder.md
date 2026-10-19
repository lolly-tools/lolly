# Brandfolder (kind: `brandfolder`)

Federate a Brandfolder as a **read-only** catalog source. Brandfolder stays the source of
truth; lolly stores references plus its own governance overlays.

## What you need from Brandfolder

- **A Brandfolder API key.** In Brandfolder: *My Profile → Integrations → API key* (an
  admin-level key sees the whole Brandfolder). It is a bearer token - treat it as a secret.
- **The Brandfolder id.** The `…/brandfolders/<id>` segment in the admin URL, or from the
  v4 API. This is the `brandfolderId` option.
- No app registration and no scopes to configure - scope what federates with lolly-side
  **exposure** (below), not the key.

## Credential shape

A single bearer token string - the API key itself. Store it write-only:

```bash
lw providers credential acme-bf     # prompts; never argv, never shell history
```

## instance.json / `lw providers add`

```json
{
  "id": "acme-bf",
  "kind": "brandfolder",
  "label": "Acme Brandfolder",
  "options": { "brandfolderId": "tc3wvjm7jnpppp62k57qhrp" },
  "exposure": { "groups": ["marketing"], "requireApproved": true, "tier": "reference" }
}
```

- `options.brandfolderId` (required) - the Brandfolder id. `options.baseUrl` is for tests only.
- `exposure.requireApproved: true` federates only assets Brandfolder marks **approved**.
- Brandfolder's `availability_start`/`availability_end` import automatically as an
  [availability window](../catalog.md#imported-availability-windows).

## Verify

```bash
lw providers preview  --kind brandfolder --options '{"brandfolderId":"…"}'   # dry run, nothing stored
lw providers health acme-bf
```

A good preview returns `health.ok: true` and a mapped sample. `401`/`403` means the key is
wrong or lacks access; an empty sample under `requireApproved` means nothing is approved yet.

## Notes / limits

- Storage/thumbnail URLs are signed + short-lived - the driver re-fetches per request and
  streams; no upstream URL is ever persisted, and fetches are pinned to `brandfolder.com` /
  `bfldr.com` hosts (no open proxy).
- Does **not** accept published exports (publish-out is Optimizely CMP only).

## Off-boarding

**A primary exit target** - one of the two off-boarding paths of record.

Kind-specific: Brandfolder's `availability_start`/`availability_end` and its `approved` flag
import natively, so the governance travels with the assets and no `mapping.availabilityFields`
wiring is needed.

Motion, cadence and the per-DAM readiness table: [off-boarding](../offboarding.md).

See also: [catalog](../catalog.md) · [permissions](../permissions.md).

## Files and variations

An asset with several attachments appears as one asset with a file count. The preview and picker show each file’s name, format, dimensions and size. Selecting a file keeps its own identity in the document, including when two files share an extension. Attachment previews use the provider’s thumbnail; they never fall back to downloading the original. An attachment must still belong to the visible asset before it can be read.

These are current file variations, not a revision timeline. Other DAM providers use the same file-choice model when they expose multiple formats or renditions. Historical revisions remain a separate provider capability.
