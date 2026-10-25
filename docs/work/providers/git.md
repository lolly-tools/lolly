# Git raw manifest (kind: `git`)

Keep your catalog as a JSON manifest in a git repository, and Lolly Work federates the files it
lists, read over raw HTTP from the branch you choose. Changes go through your usual review and
merge, so the repository history is the catalog's history.

## What you need from the repo host

- **A raw-content base URL** for the branch, such as
  `https://raw.githubusercontent.com/acme/brand/main`.
- **A read token** if the repository is private: a fine-grained token with *contents: read* on
  GitHub, or a read token on GitLab or Gitea. A public repository needs no credential.
- **A manifest** committed to the repository, `lolly-catalog.json` by default, listing each file
  by path:

  ```json
  { "assets": [ { "path": "logos/summit.svg", "name": "Summit Logo", "type": "vector",
                  "sections": ["Logos"], "tags": ["event"] } ] }
  ```

  Only `path` is required. A path containing `..` is dropped, and only paths the manifest lists
  can be fetched.

## Credential shape

A single token string, or none for a public repository. It is sent as
`Authorization: Bearer <token>` unless `options.authHeader` gives another header name, such as
`PRIVATE-TOKEN` for GitLab.

```bash
lw providers credential acme-git     # prompts; skip this for a public repo
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

| Option | What it does |
|---|---|
| `rawBase` (required) | The raw-content base. Every path resolves under it and is pinned to its host, so a manifest cannot send the driver to another host. |
| `manifestPath` | Default `lolly-catalog.json`. |
| `authHeader` | The header name for a token that is not sent as `Bearer`. |

## Verify

```bash
lw providers preview --kind git --options '{"rawBase":"https://raw.githubusercontent.com/acme/brand/main"}'
lw providers health acme-git
```

A `404` on the manifest means a wrong `rawBase` or `manifestPath`, or a branch with no such
file.

## Notes / limits

- **No server-side search and no expiring links.** Each file is fetched over raw HTTP and
  streamed on request, pinned to the `rawBase` host.
- **The exit works,** though a catalog kept in git is usually kept there.
