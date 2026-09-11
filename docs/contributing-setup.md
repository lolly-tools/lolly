# Contributing Setup

> **Scope.** This page is *how to get a development checkout sized to what you're here to do*. The [Build Guide](/info/build-guide.html) covers building each artefact once you have a checkout; this page is about which parts of the repo you actually need on disk, and the commands that pull down just those.

Lolly is one repository, with one private submodule for the SUSE brand pack (the full picture is in the [Build Guide](/info/build-guide.html)). A plain clone is the simple path and always works. Most of the repo's weight is history, not working tree, so there is a lighter path too, for anyone who does not need to read old commits on day one.

---

## Why the repo is big

The working tree is modest; the weight is history: committed catalog images (tool previews, OG share cards) re-rendered over time, screenshot baselines for every docs page re-shot whenever the UI changes, and the web PWA's long history with its fonts and binary assets. Budget roughly 1.2 GB of download and 2.6 GB on disk once `node_modules` is installed.

Two things a fresh clone never downloads, whatever path you take: `brands/suse` (the private SUSE brand pack, marked `update = none` - public clones fall back to the neutral `lolly-start` profile and everything still builds) and `shells/web/public/models` (the on-device AI models are untracked local staging; the app fetches them on demand at runtime).

To build with the models bundled into your own `dist` instead of fetched at runtime, vendor them first with `pnpm run models:vendor` (~1.2 GB, opt-in - never run by install or CI). It downloads every family from its pinned upstream, verifies each file's hash before writing, and skips anything already present, so re-running only fetches what's missing (`--only=kokoro,matte` for a subset, `--list` to see the families). The files stay gitignored; nothing to commit.

---

## The full clone

The always-works path. On macOS and openSUSE, `./setup.sh` does everything after the clone - installs git and Node if missing or too old, runs `pnpm install`, selects a content profile - and it is idempotent, so re-run it freely after a `git pull` or to repair a half-finished checkout:

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
./setup.sh
```

The classic form (`git clone … && pnpm install`) works identically if you'd rather manage the toolchain yourself. See the Build Guide's "Getting the source" for the script's flags (`--suse`, `--profile`, `--skip-node`) and the SSH variant.

---

## A lighter clone

One command gets most of the download savings a slim clone used to need, with no extra setup step:

```bash
git clone --filter=blob:none https://github.com/lolly-tools/lolly.git
cd lolly
pnpm install
```

`--filter=blob:none` makes the clone a [partial clone](https://git-scm.com/docs/partial-clone): you get the full commit history but file contents download only as they are needed. The trade-off is that reading *old* file contents (`git log -p` on an old path, checking out an old commit) fetches from the network on demand, so deep history spelunking needs a connection. Day-to-day work on the current tree does not, because it is already on disk.

There is no equivalent to the old per-persona shallow submodule setup - a `--filter=blob:none` clone already fetches every directory's working tree in full; only history is deferred, uniformly, across the whole repository. If you are not going to touch the desktop or mobile apps, skip installing their separate pnpm projects (`pnpm -C shells/tauri-desktop install`, `pnpm -C shells/tauri-mobile install`) rather than trying to avoid checking them out - they are ordinary directories now, not submodules, so there is nothing to skip at clone time.

SUSE developers opt in to the private brand pack the same way they always have:

```bash
git submodule update --init --checkout brands/suse
LOLLY_PROFILE=suse pnpm run dev:web
```
