# Installing Lolly on a workstation

Getting a fresh clone to a running state — **macOS** and **openSUSE**. For the day-to-day
submodule workflow (where each change gets committed), see
[CONTRIBUTING.md](CONTRIBUTING.md); this file is just "clean machine → `npm run dev:web`".

Lolly is an **umbrella repo**: the engine, schemas and scripts live here, and every
shippable unit (each shell, the tool packs, the docs, the services) is a **git submodule**.
The eight npm workspaces live *inside* those submodules, so the submodules have to be
checked out **before** `npm install`. The script below does that for you.

## Quick start

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
./setup.sh                # public setup: community tools + the blank "lolly-start" brand
```

SUSE developers (need access to the private brand pack):

```bash
./setup.sh --suse         # also mounts brands/suse and selects the SUSE profile
```

Then:

```bash
npm run dev:web           # web shell at http://localhost:5173
```

`./setup.sh` is **idempotent** — safe to re-run any time (after a `git pull`, to repair a
half-finished checkout, etc.). `./setup.sh --help` lists every flag.

## Prerequisites

The script installs these for you when it can; here's what it needs and how to get it by hand.

| | macOS | openSUSE |
|---|---|---|
| **Package manager** | [Homebrew](https://brew.sh) | `zypper` (built in) |
| **git** | `brew install git` (or Xcode CLT) | `sudo zypper install git` |
| **Node** ≥ 22.18 (or ≥ 24) | `brew install node@22` | `sudo zypper install nodejs22 npm22` |

**Why Node 22.18+?** The repo's scripts run TypeScript sources directly (`node scripts/foo.ts`),
which relies on Node's unflagged type-stripping — added in Node **22.18** (the 22 LTS line)
and **24**. `.nvmrc` pins `22`. Node 20 and early 22.x will fail `npm install`.

If your distro's packaged Node is older than 22.18, use [**nvm**](https://github.com/nvm-sh/nvm),
which honours `.nvmrc`:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# reopen your shell, then in the repo:
nvm install                # reads .nvmrc → installs + selects Node 22
./setup.sh --skip-node     # setup, leaving Node to nvm
```

## What `./setup.sh` does

1. **Detects** your OS + package manager (macOS/Homebrew or openSUSE/zypper).
2. **Installs git and Node** if missing or too old (skippable with `--skip-node`).
3. **Initialises the public submodules**: `git submodule update --init --recursive`
   (shells, `community/` tools, `docs/`, `services/*`). The private `brands/suse` pack is
   `update = none`, so it's **skipped automatically** unless you pass `--suse`.
4. **`npm install`** — installs all eight workspaces. Its `postinstall`
   (`scripts/use-profile.ts --auto`) builds the `tools/` + `catalog/` views for a content
   profile: the SUSE pack if it's mounted, otherwise the blank **lolly-start** brand. It
   never fails on a public clone.
5. **Optionally forces a profile** with `--profile suse|lolly-start`.

### Flags

```
--suse                  also mount the private SUSE brand pack (needs repo access)
--profile <name>        force a content profile after install (suse | lolly-start)
--skip-node             don't touch Node (you manage it yourself, e.g. via nvm)
--help
```

## Manual setup

If you'd rather not run the script, or you're on a distro it doesn't cover:

```bash
# 1. prerequisites — git + Node 22.18+ (see the table above)

# 2. submodules (BEFORE npm install — the workspaces need every submodule's package.json)
git submodule update --init --recursive
#   SUSE devs also:
git submodule update --init --checkout brands/suse

# 3. dependencies + profile views (postinstall picks a profile automatically)
npm install

# 4. optional — pick a content profile explicitly
npm run profile          # show the active profile + what's available
npm run profile:suse     # SUSE brand pack (needs brands/suse mounted)
npm run profile:start    # blank starter brand
```

## Content profiles

`tools/` and `catalog/` at the repo root are gitignored **views** assembled from the mounted
packs (`profiles.json`) — never commit them. Without SUSE access you land on **lolly-start**
(community tools + neutral tokens) and everything builds and runs. Generate a brand pack of
your own from design tokens with `npm run ingest:brand` (DTCG / Tokens Studio / Penpot). More
in [CONTRIBUTING.md](CONTRIBUTING.md) and `docs/authoring-tools.md`.

## Optional extras

Not needed for `dev:web` / `cli` / `npm test`, so the script skips them:

- **Headless render + docs screenshots** — `npm run build:web` and the docs-shot pipeline
  drive a headless browser via Playwright. Fetch the browser once: `npx playwright install chromium`.
- **Desktop / mobile apps** — the Tauri shells (`shells/tauri-desktop`, `shells/tauri-mobile`)
  are submodules but *not* npm workspaces and need the Rust toolchain + Tauri system deps.
  They're not initialised by default; see each submodule's README.
- **`loldev`** — the one-command multi-repo helper (build → commit/push every changed
  submodule → record the umbrella pointer). Put it on your PATH:
  `ln -sf "$PWD/scripts/subrepo/loldev" /usr/local/bin/loldev`. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Verify

```bash
npm run cli -- qr-code --url=https://suse.com --output=./qr.svg   # renders a tool headlessly
npm run validate:catalog                                          # checks the active profile
npm test                                                          # engine + shell suites
```

## Troubleshooting

- **`npm install` fails with a syntax error in a `.ts` file** → your Node is too old for
  type-stripping. Need ≥ 22.18 or ≥ 24 (`node -v`); use nvm (above).
- **`Cannot find module '@lolly-tools/…'` / a workspace package.json is missing** → the
  submodules weren't checked out before `npm install`. Run
  `git submodule update --init --recursive`, then `npm install` again.
- **`brands/suse` won't clone** → it's private (github.com/lolly-tools/suse-lolly). Without
  access, drop `--suse`; you'll build on lolly-start and everything still works.
- **Homebrew's `node@22` isn't on PATH** → it's keg-only.
  Add `export PATH="$(brew --prefix node@22)/bin:$PATH"` to your shell profile (the script
  does this for its own run).
- **Editing a tool doesn't show up / lands in the wrong repo** → the `tools/`/`catalog/`
  views are symlinks into the packs; edits flow to the pack checkout. Commit *inside* the
  owning submodule (or use `loldev`) — the umbrella only records pointers. See
  [CONTRIBUTING.md §4](CONTRIBUTING.md#4-where-your-changes-go).
