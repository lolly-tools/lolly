# Git raw manifest (kind: `git`)

Federate a catalog that lives as a **manifest file in a git repo**, served over raw HTTP.
The simplest, most GitOps-native source: your catalog is a JSON file under version control.

## What you need from the repo host

- **A raw-content base URL** for the branch, e.g.
  `https://raw.githubusercontent.com/acme/brand/main`.
- **A read token** if the repo is private (a fine-grained PAT with *contents: read* on
  GitHub; a read token on GitLab/Gitea). Public repos need no credential.
- A **manifest** committed to the repo (default `lolly-catalog.json`) listing assets by path.

## Credential shape

A single token string (optional for public repos). Sent as `Authorization: Bearer <token>`
by default; override the header name with `options.authHeader` (e.g. `PRIVATE-TOKEN` for
GitLab).

```bash
lw providers credential acme-git     # prompts; omit entirely for a public repo
```

## instance.json / `lw providers add`

```json
{
  "id": "acme-git",
  "kind": "git",
  "label": "Acme Brand (git)",
  "options": { "rawBase": "https://raw.githubusercontent.com/acme/brand/main", "manifestPath": "lolly-catalog.json" },
  "exposure": { "groups": ["engineering"] }
}
```

- `options.rawBase` (required) - the raw-content base; every asset path resolves under it and
  is **host-pinned** to that host (a manifest can't point the driver off-host).
- `options.manifestPath` (default `lolly-catalog.json`); `options.authHeader` for non-Bearer
  schemes.

## Verify

```bash
lw providers preview --kind git --options '{"rawBase":"https://raw.githubusercontent.com/acme/brand/main"}'
lw providers health acme-git
```

`404` on the manifest → wrong `rawBase`/`manifestPath` or the branch has no such file.

## Notes / limits

- No server-side search; no expiring URLs (raw HTTP is fetched and streamed per request,
  host-pinned).
- Supports the **exit** (materialize → cutover), though a git-hosted catalog is usually kept.
- Does **not** accept published exports.

See also: [catalog](../catalog.md) · [permissions](../permissions.md).
