# Get the source

This page is for anyone who wants Lolly running from its source code, to build, test or change the code. At the end you have a checkout with its dependencies installed and the web app open at `http://localhost:5173`.

Everything you need is public. Lolly is one repository, and a plain clone builds every app, the docs and the services.

**What you'll do**, in three steps:

::: steps
- <!--i:eti-checklist--> **[Check the tools](#what-you-need-first)** Node.js 22.18 or later, or 24 or later, with pnpm and git.
- <!--i:eti-download--> **[Clone and set up](#clone-and-set-up)** One clone command, then `./setup.sh` or `pnpm install`.
- <!--i:eti-badge-check--> **[Check the result](#check-the-result)** The profile this checkout resolves to, the tools it sees and a readiness report.
:::

<!--i:eti-checklist-->
## What you need first

- **Node.js 22.18 or later, or 24 or later.** The repository's scripts run TypeScript directly (`node scripts/foo.ts`), which needs Node's built-in type stripping. Node 20 and early 22 releases fail at `pnpm install`. `.nvmrc` pins Node `26`, so `nvm install` in the checkout picks the right one.
- **pnpm.** `npm install --global pnpm` installs it, and `package.json` pins the exact version the repository uses.
- **git.**

On macOS and openSUSE the setup script below installs git and Node for you if they are missing or too old.

<!--i:eti-download-->
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

<!--i:eti-badge-check-->
## Check the result

```bash
pnpm run profile   # which content profile this checkout resolves to, and why
pnpm run cli       # the tools that profile can see
pnpm run doctor    # a read-only readiness report, with the repair command for anything missing
```

::: check A public clone resolves to `lolly-start`
That is the blank brand, which is also the profile CI builds against. lolly.tools ships `lolly-demo`. [Profiles, brands and tool configuration](/info/configuration.html) explains how the profile is chosen.
:::

Before you push a change, `pnpm run ci:local` runs the checks CI runs for a pull request, in the same order. `--changed` keeps to the lanes your diff against `origin/main` touches, and `--list` prints the lanes without running them.

The desktop and mobile apps are separate pnpm projects (`pnpm -C shells/tauri-desktop install`, `pnpm -C shells/tauri-mobile install`). Install their dependencies only when you work on those apps.

<!--i:eti-layers-->
## Check the print plates

Print PDF is the one export where a wrong ink reaches paper, so a local check separates the finished file into plates and measures them. It never runs in hosted CI. It needs [Ghostscript](https://www.ghostscript.com) (`brew install ghostscript`, or your package manager) and a built web shell, because `pdf-cmyk` always takes the CLI's browser route:

```bash
pnpm --filter ./shells/web run build   # once, plus: pnpm run build:ort
pnpm run cli install-browser          # once, or set LOLLY_BROWSER_CHANNEL=chrome
pnpm run test:plates                   # the plate scenes only
pnpm run test:oracles                  # the PDF oracles and the plate scenes
```

Each scene in `tests/fixtures/plate-scenes/` is a small Lolly Design document, exported through `lolly run design --export=pdf-cmyk` and separated with `gs -sDEVICE=tiffsep`. The scene lists regions of the page and the ink each plate must carry there, such as black text on the K plate alone, a brand swatch's measured CMYK, a spot colour on its own named plate, or the inks FOGRA39 gives a gradient stop. A scene with two passes also runs the file with `-dMaxSpots=0`, which makes the RIP flatten spots to their process alternate. A scene can add flags to the render in `args`, such as `--spots=process` or `--file=<tokens.json>`, and a pass can list the exact set of plates the separation must write in `plates` and the plates that must carry ink in `inked`.

A missing tool is a declared skip that says which tool is missing. Set `LOLLY_ORACLES_REQUIRED=1` to make a missing tool a failure, and `LOLLY_PLATES_REPORT=out.json` to write every sampled number. A scene marked `knownFailing` states the reason and is expected to fail until the exporter is fixed, at which point it turns red until you remove the marker. Ghostscript is AGPL software. Lolly runs it only as an external program and never bundles or links the program.

<!--i:eti-eye-off-->
## What a clone leaves out

Two things never download with a clone, whichever command you use:

- **`brands/suse`**, the private SUSE brand pack. It is marked `update = none`, so a public clone falls back to `lolly-start` and everything still builds.
- **`shells/web/public/models`**, the on-device AI models. The app fetches them when they are first used.

To bundle the models into your own build instead, run `pnpm run models:vendor` first. It is opt-in and never run by install or CI. It downloads about 1.2 GB from each model family's pinned upstream, checks every file's hash before writing and skips files already present, so a second run fetches only what is missing. The singing models (about 2.8 GB more) come only when you ask for them with `--only=sing`. `--only=kokoro,matte` fetches a subset and `--list` shows the families. The files stay gitignored.

::: details Why the repository is large
Most of the weight is history, not the working tree: catalog images such as tool previews and share cards re-rendered over time, the docs screenshots re-shot whenever the interface changes and the web app's fonts and binary assets. In October 2026, budget roughly 1.2 GB of download and 2.6 GB on disk once `node_modules` is installed. Both grow with the history, which is why the partial clone saves the most.
:::

<!--i:eti-globe-->
## Write plural strings

A string that shows a count needs one form per plural category, because Russian, Polish, Arabic and other languages change the noun by the number. Lolly uses the Unicode CLDR categories (`zero`, `one`, `two`, `few`, `many`, `other`) and picks the category for the active language with the platform's `Intl.PluralRules`.

In source, write both English forms as literals and pass the count:

```ts
import { tn } from '../i18n.ts';

label.textContent = tn('1 file', '{n} files', { n: files.length });
```

- The second form, `other`, is the catalog key. The first form, `one`, is the English text for a count of exactly 1.
- The count is `n`, else `count`, else `total`. Use `tnRaw` where you would use `tRaw`.
- English output stays what a reader expects: `one` for 1, `other` for everything else, including 0.
- Do not build the sentence from pieces. Keep the whole sentence in each form, so a translator can reorder the words.
- A string that reads the same for every count in English, such as `{n} selected`, still takes both forms with the same text, so other languages can differ.
- A label followed by a count, as in `Assets: 14`, needs no plural form.

In a locale catalog (`shells/web/src/locales/<lang>.json`), the value for the `other` key is either a plain string, used for every count, or an object with exactly the categories that language uses:

```json
"{n} files": { "one": "{n} файл", "few": "{n} файла", "many": "{n} файлов", "other": "{n} файла" }
```

`shells/web/src/locales.test.ts` fails a catalog whose object lacks a category, adds one the language does not use, empties a form or uses a placeholder the English key does not have. A form for a category that only ever means the number 1 may leave out `{n}`. Until a language has an object for a key, its existing single translation is used for every count, and a count of 1 keeps the singular translation the language already had.

`node scripts/plural-work.ts` writes `plans/plural-strings/translation-work.json`, which lists each plural key, its English forms and the categories every language needs. Notes for translators and the generation prompt are in `scripts/i18n/PLURALS.md`.

<!--i:eti-help-->
## If something fails

- **`pnpm install` stops with a syntax error in a `.ts` file.** Your Node is too old for type stripping. Check `node -v` against 22.18 or 24. With Homebrew, `node@22` is keg-only: add `export PATH="$(brew --prefix node@22)/bin:$PATH"` to your shell profile.
- **`brands/suse` will not clone.** The pack is private. Drop `--suse`; you land on `lolly-start` and everything still builds and runs.
- **A SUSE tool edit does not show up.** `brands/suse` is a separate repository, so the edit needs a commit inside it and a pointer commit here (see [the private pack](#the-private-suse-pack)).
- **Anything else.** Run `pnpm run doctor`. It checks the checkout without changing it and prints the exact command for each repair.

After you edit a community tool's `tool.json`, rebuild every profile's catalog with the `:all` commands in [Publish and localize a tool](/info/tool-publishing.html).

<!--i:eti-lock-->
## The private SUSE pack

`brands/suse` holds the SUSE tools and catalog, including licensed fonts and music, so it lives in a private repository mounted as a git submodule. With access, opt in:

```bash
git submodule update --init --checkout brands/suse
LOLLY_PROFILE=suse pnpm run dev:web
```

`./setup.sh --suse` mounts it in the same run. `suse` is the `default` in `profiles.json`, so a checkout with the pack resolves to `suse`.

A change inside `brands/suse` needs two commits: one inside the submodule, then one here that moves the recorded pointer.

::: warning Push the submodule first
Otherwise this repository points at a commit nobody else can fetch.
:::

Every other directory takes a plain commit.
