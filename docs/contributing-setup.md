# Get the source

This page is for anyone who wants Lolly running from its source code, to build, test or change the code. At the end you have a checkout with its dependencies installed and the web app open at `http://localhost:5173`.

Everything you need is public. Lolly is one repository, and a plain clone builds every app, the docs and the services.

## What you need first

- **Node.js 22.18 or later, or 24 or later.** The repository's scripts run TypeScript directly (`node scripts/foo.ts`), which needs Node's built-in type stripping. Node 20 and early 22 releases fail at `pnpm install`. `.nvmrc` pins Node `26`, so `nvm install` in the checkout picks the right one.
- **pnpm.** `npm install --global pnpm` installs it, and `package.json` pins the exact version the repository uses.
- **git.**

On macOS and openSUSE the setup script below installs git and Node for you if they are missing or too old.

## Clone and set up

Pick one of two clone commands. Both give you a complete working tree that builds; they differ only in how much history arrives up front.

```bash
git clone https://github.com/lolly-tools/lolly.git                       # full clone
git clone --filter=blob:none https://github.com/lolly-tools/lolly.git    # partial clone
```

::: cols
## Full clone

- Downloads every file in every commit.
- Old history reads offline.
- The simple path, and always works.

## Partial clone

- Downloads the full commit list, but old file contents only when you ask for them.
- Reading an old commit (`git log -p` on an old path, or checking one out) needs a connection.
- Day-to-day work on the current tree is fully offline.
:::

Then, from the new `lolly` directory:

```bash
./setup.sh           # macOS and openSUSE: installs git and Node if needed, then pnpm install
pnpm run dev:web     # the web app at http://localhost:5173
```

`./setup.sh` detects your package manager (<!--l:homebrew-->Homebrew or zypper) and reports the content profile it resolved. It is safe to run again at any time, after a `git pull` or to repair a half-finished checkout. Its flags:

- `--profile <name>` sets this checkout's default content profile by writing `.lolly-profile`. Any profile in `profiles.json` works, such as `lolly-start` or `lolly-demo`.
- `--skip-node` leaves Node to you. With nvm, run `nvm install` in the checkout (it reads `.nvmrc`), then `./setup.sh --skip-node`.
- `--suse` also mounts the private SUSE pack (see [the private pack](#the-private-suse-pack) below).
- `--help` lists everything.

On another system, or if you would rather run the steps yourself, `pnpm install` after the clone does the same job. Its preinstall check confirms that at least one content profile is complete on disk.

::: details Clone over SSH so push access needs no change later
```bash
git -c url."git@github.com:".insteadOf=https://github.com/ \
    clone git@github.com:lolly-tools/lolly.git && \
cd lolly && \
git config url."git@github.com:".insteadOf https://github.com/ && \
pnpm install
```

`url.insteadOf` rewrites the HTTPS address to SSH. It is safe for everyone because the repository is public, and the day you get push access nothing else needs to change. Drop both `git config` parts to authenticate over HTTPS instead. Write access is enforced by the host when you push, not by the checkout, so maintainers and readers set up the same way.
:::

## Check the result

```bash
pnpm run profile   # which content profile this checkout resolves to, and why
pnpm run cli       # the tools that profile can see
pnpm run doctor    # a read-only readiness report, with the repair command for anything missing
```

A public clone resolves to `lolly-start`, the blank brand, which is also the profile CI builds against. lolly.tools ships `lolly-demo`. [Profiles, brands and tool configuration](/info/configuration.html) explains how the profile is chosen.

You do not need the desktop or mobile apps' own dependencies unless you work on those apps. They are separate pnpm projects (`pnpm -C shells/tauri-desktop install`, `pnpm -C shells/tauri-mobile install`), so skip them until you need them.

## What a clone leaves out

Two things never download with a clone, whichever command you use:

- **`brands/suse`**, the private SUSE brand pack. It is marked `update = none`, so a public clone falls back to `lolly-start` and everything still builds.
- **`shells/web/public/models`**, the on-device AI models. The app fetches them when they are first used.

To bundle the models into your own build instead, run `pnpm run models:vendor` first. It is opt-in and never run by install or CI. It downloads about 1.2 GB from each model family's pinned upstream, checks every file's hash before writing and skips files already present, so a second run fetches only what is missing. The singing models (about 2.8 GB more) come only when you ask for them with `--only=sing`. `--only=kokoro,matte` fetches a subset and `--list` shows the families. The files stay gitignored.

::: details Why the repository is large
Most of the weight is history, not the working tree: catalog images such as tool previews and share cards re-rendered over time, the docs screenshots re-shot whenever the interface changes and the web app's fonts and binary assets. In October 2026, budget roughly 1.2 GB of download and 2.6 GB on disk once `node_modules` is installed. Both grow with the history, which is why the partial clone saves the most.
:::

## If something fails

- **`pnpm install` stops with a syntax error in a `.ts` file.** Your Node is too old for type stripping. Check `node -v` against 22.18 or 24. With Homebrew, `node@22` is keg-only: add `export PATH="$(brew --prefix node@22)/bin:$PATH"` to your shell profile.
- **`brands/suse` will not clone.** The pack is private. Drop `--suse`; you land on `lolly-start` and everything still builds and runs.
- **A SUSE tool edit does not show up.** `brands/suse` is a separate repository, so the edit needs a commit inside it and a pointer commit here (see [the private pack](#the-private-suse-pack)). A community tool is a plain directory in this repository and needs one commit.
- **Anything else.** Run `pnpm run doctor`. It checks the checkout without changing it and prints the exact command for each repair.

After you edit a community tool's `tool.json`, rebuild every profile's catalog with the `:all` commands in [Publish and localize a tool](/info/tool-publishing.html).

## The private SUSE pack

`brands/suse` holds the SUSE tools and catalog, including licensed fonts and music, so it lives in a private repository mounted as a git submodule. With access, opt in:

```bash
git submodule update --init --checkout brands/suse
LOLLY_PROFILE=suse pnpm run dev:web
```

`./setup.sh --suse` mounts it in the same run. `suse` is the `default` in `profiles.json`, so a checkout with the pack resolves to `suse`.

A change inside `brands/suse` needs two commits: one inside the submodule, then one here that moves the recorded pointer. Push the submodule first, or this repository points at a commit nobody else can fetch. Every other directory takes a plain commit.
