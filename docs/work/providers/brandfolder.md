# Brandfolder (kind: `brandfolder`)

Connect a Brandfolder and its assets appear in the Lolly Work catalog, with Brandfolder's
approval flag and availability dates carried across. Brandfolder stays the source
of truth: Work stores references plus its own governance settings, and reads the files when
someone uses them.

## What you need from Brandfolder

- **A Brandfolder API key**, from *My Profile > Integrations > API key*. An admin-level key sees
  the whole Brandfolder. It is a bearer token, so treat it as a secret.
- **The Brandfolder id**: the `…/brandfolders/<id>` part of the admin URL, or from the v4 API.
- No app registration and no scopes. Choose what federates with Work's **exposure** settings,
  not with the key.

## Credential shape

A single bearer token string: the API key itself.

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

- `options.brandfolderId` (required) is the Brandfolder id. `options.baseUrl` is for tests only.
- `exposure.requireApproved: true` federates only assets Brandfolder marks **approved**.
- Brandfolder's `availability_start` and `availability_end` import as an
  [availability window](../catalog.md#imported-availability-windows) with no mapping. These two
  field names are not yet confirmed against a live tenant.

## Verify

```bash
lw providers preview  --kind brandfolder --options '{"brandfolderId":"…"}'   # dry run, nothing stored
lw providers health acme-bf
```

A good preview prints `health ok - brandfolder` and a mapped sample (`health.ok: true` with
`--json`). `401` or `403` means the key is wrong or lacks access. An empty sample with
`requireApproved` on means nothing is approved yet.

## Notes / limits

- **Signed, short-lived file links.** Work fetches each storage or thumbnail link again on every
  request and streams the file. No upstream link is stored, and fetches are pinned to the
  `brandfolder.com` and `bfldr.com` hosts.
- **Several files per asset.** An asset with several attachments appears as one asset with a
  file count. The preview and picker show each file's name, format, dimensions and size, and a
  chosen file keeps its own identity in the document, even when two files share an extension.
  Attachment previews use Brandfolder's thumbnail and never download the original instead. An
  attachment must still belong to the visible asset before it can be read.
- **Current variations, not history.** These are the asset's current files, not a revision
  timeline. Other DAM sources that expose several formats or renditions use the same file
  choice; historical revisions are a separate capability.

## Off-boarding

Brandfolder is a source you can leave through the exit. Its approval flag and its
availability dates are read natively, so that governance travels with the copies, although the
two availability field names still await a live check. Timing, cadence and the readiness of
each DAM: [Leave a DAM](../offboarding.md).
