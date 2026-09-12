# Installing Lolly on a workstation

Getting a fresh clone to a running state - **macOS** and **openSUSE**. For where each
change gets committed, see [CONTRIBUTING.md](CONTRIBUTING.md); this file is just "clean
machine to `pnpm run dev:web`".

Lolly is one repository: the engine, schemas, scripts, every shell, the tool packs, the
docs and the services all live here as plain directories. The one exception is
`brands/suse`, a private git submodule holding SUSE's brand pack, opt-in and not needed
for a public build.

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
pnpm run dev:web           # web shell at http://localhost:5173
```

`./setup.sh` is **idempotent** - safe to re-run any time (after a `git pull`, to repair a
half-finished checkout, etc.). `./setup.sh --help` lists every flag.

## Prerequisites

The script installs these for you when it can; here's what it needs and how to get it by hand.

| | macOS | openSUSE |
|---|---|---|
| **Package manager** | [Homebrew](https://brew.sh) | `zypper` (built in) |
| **git** | `brew install git` (or Xcode CLT) | `sudo zypper install git` |
| **Node** ≥ 22.22 (or ≥ 24.15) | `brew install node@22` | `sudo zypper install nodejs22 npm22` |

**Why Node 22.18+?** The repo's scripts run TypeScript sources directly (`node scripts/foo.ts`),
which relies on Node's unflagged type-stripping - added in Node **22.18** (the 22 LTS line)
and **24**. `.nvmrc` pins `22`. Node 20 and early 22.x will fail `pnpm install`.

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
3. **Mounts the private brand pack** if you passed `--suse`: `git submodule update --init
   --checkout brands/suse`. Skipped by default - it needs repo access, and nothing else in
   the checkout depends on it.
4. **`pnpm install`** - installs the workspaces. At runtime, the content-pack resolver
   (`packages/node-shell/src/content-roots.ts`) picks a profile from `profiles.json`: the
   SUSE pack if it's mounted, otherwise the blank **lolly-start** brand. It never fails on
   a public clone.
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
# 1. prerequisites - git + Node 22.22+ (see the table above)

# 2. SUSE devs with access to the private brand pack, opt in (skip otherwise):
git submodule update --init --checkout brands/suse

# 3. dependencies
# Install the pinned package manager once (or use Corepack).
npm install --global pnpm@11.26.0
pnpm install

# 4. optional - pick a content profile explicitly
pnpm run profile                              # print the resolved profile + its roots
LOLLY_PROFILE=suse pnpm run dev:web           # SUSE brand pack (needs brands/suse mounted)
LOLLY_PROFILE=lolly-start pnpm run dev:web    # blank starter brand
```

## Content profiles

Which tool pack and catalog a build uses is resolved at runtime from `profiles.json` by
`packages/node-shell/src/content-roots.ts` - there is nothing to build or commit. Without
SUSE access you land on **lolly-start** (community tools + neutral tokens) and everything
builds and runs. Generate a brand pack of your own from design tokens with
`pnpm run ingest:brand` (DTCG / Tokens Studio / Penpot). More in
[CONTRIBUTING.md](CONTRIBUTING.md) and `docs/authoring-tools.md`.

## Optional extras

Not needed for `dev:web` / `cli` / `pnpm test`, so the script skips them:

- **Headless render + docs screenshots** - `pnpm run build:web` and the docs-shot pipeline
  drive a headless browser via Playwright. Fetch the browser once: `pnpm exec playwright install chromium`.
- **Desktop / mobile apps** - the Tauri shells (`shells/tauri-desktop`, `shells/tauri-mobile`)
  are separate pnpm projects with their own lockfiles, deliberately kept out of the root
  workspace, and need the Rust toolchain + Tauri system deps. They're not installed by
  default; see each shell's README.

## Verify

```bash
pnpm run cli qr-code --url=https://suse.com --output=./qr.svg   # renders a tool headlessly
pnpm run validate:catalog                                          # checks the active profile
pnpm test                                                          # engine + shell suites
```

## Troubleshooting

- **`pnpm install` fails with a syntax error in a `.ts` file** → your Node is too old for
  type-stripping. Need ≥ 22.22 or ≥ 24.15 (`node -v`; jsdom 30 raised the floor past the 22.18 type-stripping release); use nvm (above).
- **`brands/suse` won't clone** → it's private (github.com/lolly-tools/suse-lolly). Without
  access, drop `--suse`; you'll build on lolly-start and everything still works.
- **Homebrew's `node@22` isn't on PATH** → it's keg-only.
  Add `export PATH="$(brew --prefix node@22)/bin:$PATH"` to your shell profile (the script
  does this for its own run).
- **A SUSE tool edit doesn't show up** → `brands/suse` is a separate, private repository
  (`suse-lolly`), mounted as a submodule. Commit *inside* `brands/suse`, then commit the
  moved pointer here. See [CONTRIBUTING.md section 3](CONTRIBUTING.md#3-where-your-changes-go).
  Everything else in the tree is a plain directory in this repository - a normal commit here
  is enough.
