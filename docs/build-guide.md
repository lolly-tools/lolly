# Build Guide

> **Scope.** This page is *how each artefact is produced*: getting the source, toolchain prerequisites and the per-platform build, signing and packaging steps. The [Deployment guide](/info/deployment.html) is *where each artefact runs* - delivery models, hosting and routing for the web shell and what the optional MCP and CA services need. Compilers, SDKs and store submission here; hosts, rewrites and rollout there.

How to build Lolly for each distribution target: standalone CLI binary, desktop app (macOS / Windows / Linux), mobile apps (iOS / Android) and the web shell as a container image for Kubernetes.

The current main web shell requires WebGPU. Check the dated
[supported environments](/info/supported-environments.html) before publishing the web shell.
Qualified web-only artifacts have a separate explicit gate; native releases
retain the full qualification hold. Ordinary development builds remain available
for testing and do not qualify a release.

---


## Choose a guide

| Task | Guide |
| --- | --- |
| Run the terminal shells from source or package the CLI binary. | [Build the CLI and TUI](/info/build-terminal.html) |
| Set up and package the Tauri desktop shell. | [Build the desktop app](/info/build-desktop.html) |
| Set up, develop and package Android and iOS shells. | [Build the mobile apps](/info/build-mobile.html) |
| Plan OBS recipes for Lolly artifacts and their dependencies. | [Build with Open Build Service](/info/build-obs.html) |
| Build the web image and deploy the chart with optional services. | [Build the web container and Helm chart](/info/build-kubernetes.html) |

## Prerequisites (all targets)

- <!--l:node-->**Node.js ≥ 22.18** **or ≥ 24**, and **pnpm**. `npm install --global pnpm` installs it, and the repository pins the version it uses in `package.json`. The repo's scripts run TypeScript sources directly (`node scripts/foo.ts`), which relies on Node's unflagged type-stripping - added in Node 22.18 and 24. Node 20 and early 22.x fail at `pnpm install`. `.nvmrc` pins `24`, so nvm users can just run `nvm install` in the repo.
- The repo checked out, dependencies installed - see below

---

## Getting the source

Lolly is one repository. `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `docs/`, `community/`, `brands/lolly-start/`, every `shells/*` and both services live here as plain directories. The one exception is `brands/suse`, a **private** git submodule holding the SUSE tool pack and catalog - licensed fonts and music included, which is why it stays out of the public tree.

Everything except `brands/suse` is public, so a read-only contributor gets a complete, buildable checkout with the script (or single command) below. Write access is enforced by the host at push time, not by the checkout, so the setup is identical whether you're a maintainer or just reading it.

### The setup script

On macOS and openSUSE, one script takes a fresh clone to a running state - it detects your package manager (<!--l:homebrew-->Homebrew or zypper), installs git and Node if they are missing or too old, runs `pnpm install` and selects a content profile:

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
./setup.sh                # public setup: community tools + the blank "lolly-start" brand
pnpm run dev:web           # web shell at http://localhost:5173
```

`./setup.sh` is idempotent - safe to re-run any time: after a `git pull`, or to repair a half-finished checkout. Flags:

- `--suse` also mounts the private SUSE brand pack and selects the SUSE profile (needs repo access)
- `--profile <suse|lolly-start>` forces a content profile after install
- `--skip-node` leaves Node entirely to you - the nvm path: `nvm install` in the repo (it reads `.nvmrc`), then `./setup.sh --skip-node`
- `--help` lists everything

### By hand

If you'd rather run the steps yourself, or are on a distro the script doesn't cover:

```bash
git -c url."git@github.com:".insteadOf=https://github.com/ \
    clone git@github.com:lolly-tools/lolly.git && \
cd lolly && \
git config url."git@github.com:".insteadOf https://github.com/ && \
pnpm install
```

`url.insteadOf` rewrites the HTTPS URL to SSH, which is safe for everyone since this is a public repo, and means the moment you get push access nothing else needs to change. Drop both `git config` lines if you'd rather authenticate over HTTPS.

`pnpm install`'s preinstall check confirms at least one content profile is complete on disk; a content-pack resolver (`packages/node-shell/src/content-roots.ts`) then picks a profile from `profiles.json` the first time anything reads tool or catalog content - see [Configuration](/info/configuration.html).

Verify the result with `pnpm run profile` (shows the resolved profile) and `pnpm run cli` (lists the tools it can see).

### The private SUSE brand pack

`brands/suse` holds the SUSE tool pack and its catalog, including licensed fonts and music, so it lives in a private repository, mounted as a submodule. If you have access, opt in explicitly:

```bash
git submodule update --init --checkout brands/suse
LOLLY_PROFILE=suse pnpm run dev:web
```

(`./setup.sh --suse` mounts it and selects the profile in one go.) Without it, `pnpm run profile` reports `lolly-start` as active - the blank brand, which is the correct default for anyone not doing SUSE-specific work, and the profile the public site and CI build against.

### If something fails

- **`pnpm install` dies with a syntax error in a `.ts` file** - your Node is too old for type-stripping; you need ≥ 22.18 or ≥ 24 (`node -v`). With Homebrew, note `node@22` is keg-only: add `export PATH="$(brew --prefix node@22)/bin:$PATH"` to your shell profile.
- **`brands/suse` won't clone** - it's private. Drop `--suse`; you land on `lolly-start` and everything still builds and runs.
- **A SUSE tool edit doesn't show up** - `brands/suse` is a separate, private repository (`suse-lolly`) mounted as a submodule. Commit *inside* it, then commit the moved pointer here - see the next section. A community tool has no such indirection: it is a plain directory in this repository, and a normal commit is enough.

### The one thing that still touches two repositories

A change inside `brands/suse` needs **two commits**: one in that submodule, and one that moves the recorded pointer in this repository. Push the submodule first, or this repository will point at a commit nobody else can fetch. Every other directory in the tree takes a plain commit, no pointer involved.

One case deserves care even though it is not cross-repository. `catalog/tools/index.json` is generated **per brand**, and every brand's index lists the community tools - so editing a community `tool.json` leaves the SUSE profile's index stale, and the single-profile `pnpm run build:catalog` can't see the drift because it only ever looks at the active profile. After any community tool change, run the all-profiles variants instead:

```bash
pnpm run build:catalog:all      # rebuild every mounted profile, then restore the active one
pnpm run validate:catalog:all   # validate every mounted profile; exits 1 on drift (the CI guard)
```

---

## How the Tauri shells relate to the web shell

Both Tauri shells share the web shell's source (`shells/web/src/`). They build it with a Vite alias that swaps `bridge/state.ts` for a Tauri filesystem implementation at build time. Everything else - the engine, tools, templates, export logic - is identical to the web build. One render path, three delivery targets.

```
shells/web/src/         ← canonical source
    └── bridge/
        └── state.ts    ← IndexedDB (web build)

shells/tauri-desktop/
shells/tauri-mobile/
    └── bridge-overrides/
        └── state.ts    ← filesystem via tauri-plugin-fs (Tauri builds)
```

The Tauri-built frontend is written to `shells/tauri-{desktop,mobile}/dist/`, which `tauri.conf.json` references as `frontendDist`. The web shell's own `dist/` is unaffected.
