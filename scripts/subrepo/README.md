# `scripts/subrepo/` — monorepo → `lolly-tools` split toolkit

Tooling to split the `lolly` monorepo into ten `github.com/lolly-tools/*` repos,
wired back as **git submodules**, and to work with that layout day-to-day.
Strategy + rationale live in `plans/linked-juggling-sky.md`.

All scripts source `config.sh` (the repo map + helpers). Edit `config.sh` — not
the individual scripts — to change names, the org, or per-repo `.gitignore`s.

## The repos

| Path (submodule mount) | Repo | Notes |
|---|---|---|
| `community/` | `lolly-tools` | public, MPL-2.0 — brand-agnostic tools (utilities, qr-code, street-map, filter-*) |
| `brands/suse/` | `suse-lolly` | **PRIVATE** — SUSE tools + full catalog (music INCLUDED); `update = none` so public clones skip it |
| `services/mcp/` | `lolly-mcp-server` | workspace; needs `@lolly/engine` |
| `services/ca/` | `lolly-ca` | workspace; ships `*.pem` gitignore (root-key safety) |
| `shells/web/` | `lolly-web` | workspace; needs `@lolly/engine` |
| `shells/cli/` | `lolly-cli` | workspace |
| `shells/tui/` | `lolly-tui` | workspace |
| `shells/tauri-desktop/` | `lolly-desktop` | build resolves `../web` |
| `shells/tauri-mobile/` | `lolly-mobile` | wraps the web build |
| `shells/chrome-extension/` | `lolly-chrome-extension` | standalone |

`engine/`, `schemas/`, `api/`, `scripts/`, `tests/`, `brands/lolly-start/` (the
blank starter brand) and `profiles.json` stay in the parent.

**Profile views (2026-07-08 split):** the repo-root `tools/` and `catalog/`
paths are no longer submodules — they are gitignored VIEWS of the active
content profile, built by `scripts/use-profile.ts` (symlink farm locally, real
copies on Vercel). `loldev profile suse|lolly-start` switches; `npm install`'s
postinstall picks one automatically (falling back to `lolly-start` when the
private SUSE pack isn't mounted). The old public `lolly-suse-tools` /
`lolly-suse-catalog` repos are retired — archive them (and scrub/remove the
music from `lolly-suse-catalog` before 2026-08-29).

## One-time split — `migrate.sh`

```bash
scripts/subrepo/migrate.sh                 # dry run (default) — prints every action
scripts/subrepo/migrate.sh --extract-only  # stage all repos locally to inspect; no GitHub, no repo changes
scripts/subrepo/migrate.sh --run           # create+push repos, convert to submodules, stage the parent commit
scripts/subrepo/migrate.sh --run --only services/mcp   # one path at a time
```

- `--run` **requires a clean working tree** and carves every subrepo from the
  current `HEAD`, so first merge your other-machine edits in and commit.
- Extraction uses `git archive HEAD` → only git-tracked files (no
  `node_modules`, `.browsers`, `.DS_Store`). Catalog music is dropped.
- It **stages** the parent commit (`.gitmodules` + gitlinks) but never commits
  or pushes the parent — you push `~/Build/lolly` your own way.
- Idempotent-ish: existing repos are pushed to, not recreated.

## Verify — `verify.sh`

```bash
scripts/subrepo/verify.sh          # init + install + catalog + typecheck + build:web + CLI render + music check
scripts/subrepo/verify.sh --clone  # also fresh --recurse-submodules clone build (slow)
```

Run after `--run`, before pushing the parent.

## Day-to-day — `sync.sh`

After editing tools / catalog / a shell / a service:

```bash
scripts/subrepo/sync.sh -m "tweak record tool copy"            # build catalog, push changed submodules, STAGE parent bump
scripts/subrepo/sync.sh -m "new previews" --previews           # also regenerate look thumbnails (slow, Playwright)
scripts/subrepo/sync.sh -m "wip" --dry-run                     # preview actions
scripts/subrepo/sync.sh -m "cli fix" shells/cli                # restrict to specific submodules
scripts/subrepo/sync.sh -m "release" --push-parent             # also commit + push the parent
```

Editing a tool usually changes **two** submodules — `tools/` (manifest) and
`catalog/` (regenerated `index.json` + preview bundle). `sync.sh` rebuilds the
catalog first so both get committed and pushed, then points the parent at both.

## Status — `status.sh`

```bash
scripts/subrepo/status.sh   # parent + every submodule: branch, dirty, ahead/behind origin
```

## Cloning after the split

```bash
git clone --recurse-submodules git@github.com:lolly-tools/lolly.git
# or, in an existing clone:
git submodule update --init --recursive     # BEFORE npm install — workspaces need every package.json present
```

## Notes

- Submodule remotes use SSH (`git@github.com:lolly-tools/…`). The **parent
  remote is left untouched** — the local `origin` is a stale placeholder; push
  the parent your usual way.
- The PremiumBeat music is tracked in the **private** `suse-lolly` pack
  (`brands/suse/catalog/assets/suse/music/`) — never push it to a public repo.
  `verify.sh` asserts it is absent from the public `community` pack. (It also
  remains in the parent `lolly` repo's pre-split history and in the retired
  `lolly-suse-catalog` — scrub/archive those before 2026-08-29.)
- `mcp-server` / `shell-*` do not build as standalone clones (they need
  `@lolly/engine` / `../web`); they are meant to be consumed within the monorepo.
