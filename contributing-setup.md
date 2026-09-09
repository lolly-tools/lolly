# Contributing Setup

> **Scope.** This page is *how to get a development checkout sized to what you're here to do*. The [Build Guide](/info/build-guide.html) covers building each artefact once you have a checkout; this page is about which parts of the repo you actually need on disk, and the commands that pull down just those.

Lolly is a parent repo plus a set of git submodules (the full table is in the [Build Guide](/info/build-guide.html)). A complete recursive clone is the simple path and always works, but it downloads roughly 1.2 GB of git history before `pnpm install` adds a byte. Most contributions touch a fraction of that, so there is a slim path too.

---

## Why the repo is big

The working tree is modest; the weight is history:

| Where | History | Why |
|---|---|---|
| parent repo | ~490 MB | committed catalog images (tool previews, OG share cards) re-rendered over time |
| `docs/` | ~270 MB | screenshot baselines for every docs page, re-shot whenever the UI changes |
| `shells/web` | ~335 MB | the PWA's long history, fonts and binary assets included |
| everything else | ~60 MB | ordinary code history |

The tool definitions most contributors come to edit are 12 MB of history in `community/`.

Two things a fresh clone never downloads, whatever path you take: `brands/suse` (the private SUSE brand pack, marked `update = none` - public clones fall back to the neutral `lolly-start` profile and everything still builds) and `shells/web/public/models` (the on-device AI models are untracked local staging; the app fetches them on demand at runtime).

To build with the models bundled into your own `dist` instead of fetched at runtime, vendor them first with `pnpm run models:vendor` (~1.2 GB, opt-in - never run by install or CI). It downloads every family from its pinned upstream, verifies each file's hash before writing, and skips anything already present, so re-running only fetches what's missing (`--only=kokoro,matte` for a subset, `--list` to see the families). The files stay gitignored; nothing to commit.

---

## The full clone

The always-works path. On macOS and openSUSE, `./setup.sh` does everything after the clone - initialises every public submodule, installs git and Node if missing or too old, runs `pnpm install`, selects a content profile - and it is idempotent, so re-run it freely after a `git pull` or to repair a half-finished checkout:

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
./setup.sh
```

The classic form (`git clone --recurse-submodules … && pnpm install`) works identically if you'd rather manage the toolchain yourself. See the Build Guide's "Getting the source" for the script's flags (`--suse`, `--profile`, `--skip-node`), the SSH variant and putting each submodule on a branch. Budget about 1.2 GB of download and 2.6 GB on disk once `node_modules` is installed.

---

## The slim clone

Two commands replace the recursive clone:

```bash
git clone --filter=blob:none https://github.com/lolly-tools/lolly.git
cd lolly
scripts/subrepo/loldev setup tool-author   # or: engine-dev
pnpm install
```

`--filter=blob:none` makes the *parent* clone a [partial clone](https://git-scm.com/docs/partial-clone): you get the full commit history but file contents download only as they are needed. That drops the parent from ~490 MB to ~80 MB. The trade-off is that reading *old* file contents (`git log -p` on an old path, checking out an old commit) fetches from the network on demand, so deep history spelunking in the parent needs a connection. Day-to-day work on the current tree does not.

`loldev setup <persona>` then initialises only the submodules that persona needs, shallow (`--depth 1`) wherever presence is all that is required:

| Persona | Full history | Present but shallow | Skipped |
|---|---|---|---|
| `tool-author` | `community/` | `docs/`, `shells/web`, `shells/cli`, `shells/tui`, `services/mcp`, `services/ca` | `shells/tauri-desktop`, `shells/tauri-mobile`, `shells/chrome-extension` |
| `engine-dev` | `community/`, `shells/web`, `shells/cli` | `docs/`, `shells/tui`, `services/mcp`, `services/ca` | the same three |
| `full` | everything public | - | - |

Measured on a fresh clone (2026-08, rounded):

| | git objects downloaded | on disk before `pnpm install` | after `pnpm install` |
|---|---|---|---|
| `tool-author` | ~170 MB | ~490 MB | ~1.6 GB |
| `engine-dev` | ~480 MB | ~800 MB | ~1.9 GB |
| full recursive clone | ~1.2 GB | ~1.5 GB | ~2.6 GB |

(`node_modules` is ~1.1 GB whichever way you clone; the slim paths save download and git weight, not npm weight.)

### Why shallow instead of skipped

pnpm resolves the local packages listed in `pnpm-workspace.yaml`. The repo's bootstrap guard (`scripts/check-bootstrap.ts`) refuses to install into a checkout that is missing a workspace, and also checks for `docs/` and `community/`, which the catalog and profile scripts need after install. Every persona therefore includes every workspace: packages you are not developing are checked out shallow at their recorded commit. The separate Tauri projects and Chrome extension can be skipped. Use pnpm 11.1.2, pinned in `packageManager`; install it with `npm install --global pnpm@11.1.2` if needed.

### What each persona can and cannot do

**`tool-author`** - you are writing or editing tools ([Authoring Tools](/info/authoring-tools.html)). Everything in the daily loop works: `pnpm run dev:web`, `pnpm run cli`, `pnpm test`, `pnpm run typecheck`, `pnpm run build:catalog` and `validate:catalog`, and the `/info` docs site builds (the docs *working tree* is present, only its history is shallow). `community/` has full history, so `git log` and `git blame` on a tool behave normally.

**`engine-dev`** - the same, plus full history in `shells/web` and `shells/cli`, the two shells you will be reading and bisecting when an engine change misbehaves. The engine itself (`engine/`), `packages/`, `schemas/` and `tests/` live in the parent repo, so every persona already has them.

**Neither slim persona** can build the desktop or mobile apps (no Tauri shells - `pnpm run typecheck:tauri` logs a skip, by design, rather than failing) or work on the Chrome extension. `git log`/`git blame` inside a shallow submodule see one commit until you deepen it (`git -C docs fetch --unshallow`).

**Committing from a slim clone** works normally - shallow clones can branch, commit and push. Submodules check out detached at the recorded commit, so put one on a branch before starting work in it (`git -C community checkout main`), exactly as the Build Guide describes for the full clone.

---

## Upgrading a slim clone

The personas are cumulative and re-runnable; nothing needs re-cloning:

```bash
scripts/subrepo/loldev setup engine-dev   # tool-author → engine-dev: deepens shells/web + shells/cli
scripts/subrepo/loldev setup full         # everything public, full history
```

`setup full` initialises whatever is missing and un-shallows whatever a slim setup left shallow, in place. It never moves the checked-out commit of a submodule you already have, so work in progress is safe. The parent stays a partial clone either way - that is a property of the original `git clone`, and it only shows when you read old blobs.

SUSE developers opt in to the private brand pack the same way they always have:

```bash
git submodule update --init --checkout brands/suse
pnpm run profile:suse
```

`loldev` runs in place from any checkout path (`scripts/subrepo/loldev`); set `LOLLY_ROOT` only if you keep multiple checkouts and want to point an installed copy at one of them.
