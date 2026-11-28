# lolly CLI: create and process files

Use `lolly` to make a Lolly file without opening the app: in a build script, a CI job, a folder of files to process or an agent's tool call. The CLI runs the same engine as the app and makes the same file as the export panel.

From the terminal you can:

- make a file with any tool, giving its inputs as flags;
- find tools, their inputs and the catalog's logos and icons;
- set up your design system for the terminal;
- check, clean or convert files you already have.

Every flag is a URL parameter: `--url=https://example.com` is `?url=https://example.com` in a share link. A link copied from the app renders the same here ([URL Mode](/info/url-mode.html)). To browse with the keyboard, run `lolly tui` ([TUI](/info/tui.html)).

**Get started**, in four steps:

::: steps
- <!--i:eti-download--> **[Install](#install)** The desktop app, or a checkout that runs `pnpm run cli` in place of `lolly`.
- <!--i:eti-file-plus--> **[Make your first file](#make-your-first-file)** One command writes `qr.svg`, or streams the bytes to stdout.
- <!--i:eti-search--> **[Find tools, inputs and assets](#find-tools-inputs-and-assets)** `list`, `describe` and `assets` show what you can use.
- <!--i:eti-palette--> **[Bring your design system](#bring-your-design-system)** The colours, type and logos every render then uses.
:::

<!--i:eti-download-->
## Install

There are two routes to the same program.

**The desktop app.** Lolly for macOS, Windows and Linux carries its own tools, catalog and this CLI. On macOS the command is the app's executable, `Lolly.app/Contents/MacOS/lolly-desktop`, with the same arguments. `run` uses the app's native off-screen WebView. The other verbs go to the bundled Node package.

**A checkout.** In a clone of the Lolly source ([github.com/lolly-tools/lolly](https://github.com/lolly-tools/lolly)) the CLI is a package script.

::: note Before you start
You need pnpm and Node.js 22.23.4 or later on Node 22, 24.22.1 or later on Node 24, or 26.12.1 or later. Older releases are refused because their Brotli decoder has a flaw (CVE-2026-111497). If `pnpm --version` fails, run `npm install --global pnpm` ([What you need first](/info/contributing-setup.html#what-you-need-first)). Run `pnpm install` once at the repository root ([Clone and set up](/info/contributing-setup.html#clone-and-set-up)), then run every command from that root. Arguments go straight after the tool id, with no `--` in between.
:::

In a checkout, replace `lolly` in every example with `pnpm run cli` and keep the same arguments.

### A standalone CLI carries no tools and no catalog

Tools and brand assets are content, not code, and the public set alone is hundreds of megabytes. A standalone `lolly` (the packaged CLI, see [Build the CLI and TUI](/info/build-terminal.html#standalone-binary)) carries none of this content. Point the CLI at a root:

```bash
LOLLY_ROOT=/path/to/lolly lolly list
```

Two kinds of directory work:

- a **checkout** of this repository, which holds `profiles.json` and the packs under `community/` and `brands/`;
- a **materialized** root: a `tools/` directory of tool folders and a built `catalog/` with its generated index, which is what a `dist/` build, an RPM payload or a container image carries.

The CLI ignores a `LOLLY_ROOT` that holds neither. The CLI then looks upward from itself, then in the working directory. Build any pack's `tools/` and `catalog/` this way, and every command (render, batch, smoke, assets) runs against that pack with no code change. The desktop app brings its own root.

`lolly system import <pack.lolly>` imports **your design system** and adds no tools, so it needs a root as well. A command that needs content and finds none lists these routes and exits `3`. The CLI never downloads anything on its own.

<!--i:eti-file-plus-->
## Make your first file

```bash wrap
lolly qr-code --url=https://example.com --output=qr.svg
```

::: check The CLI reports the file it wrote
It says which design system it recorded in the file, then ends with a line that starts `✓ Wrote`:

```text
Recorded the design system: Lolly Starter. Pass --no-madewith to leave the record out.
✓ Wrote 20381 bytes to qr.svg
```

In a checkout, a note that the catalog is unsigned comes first. That is expected for a local catalog.
:::

`qr.svg` is written to the current directory and replaces any file of that name. If your own address contains `?` or `&`, put the address in quotes.

The general form is `lolly <tool-id> [--input=value ...] [--export=fmt] [--output=file]`. With `--output`, the file is written and the byte count goes to stderr. Without it, the bytes go to **stdout**, so you can pipe them:

```bash
pnpm --silent run cli qr-code --url=https://example.com --export=png > qr.png
```

::: warning Redirecting from a checkout
Use `pnpm --silent run cli` whenever you redirect or pipe. pnpm can print a warning or a run banner on stdout before the CLI starts, and that line would end up inside your PNG. An installed `lolly` binary never prints them.
:::

The `--output` extension asks for a format. A tool that cannot write that format stops instead of writing other bytes under your file name. [Render with the CLI](/info/cli-rendering.html#the-output-extension-is-a-format-request) covers that check, sizes, print options and video.

<!--i:eti-search-->
## Find tools, inputs and assets

```bash
lolly list                       # every tool: id, status, description
lolly list --json --q=chart --limit=5
lolly describe qr-code           # that tool's inputs, defaults and formats
lolly qr-code                    # the same as describe, when no flags follow
lolly assets                     # every catalog asset id: logos, icons, photos
lolly assets logo                # filter by text
lolly assets --type=raster
```

`describe` lists a tool's essential inputs with their defaults and a usage line. `--all` shows every input. Inputs that are not a plain value (`asset`, `blocks`, `vector`, `file`, `color`) get a `↳` line that shows how to write one.

`list --q=<words>` matches tool ids, names, descriptions, categories and formats. `--limit=1..100` keeps an agent's answer short. With `--json`, either option adds `query`, `limit` and `total` to the result. `assets --type=` is checked against the catalog, so a typo is an error that lists the real types:

```bash
$ lolly assets --type=rastor
Error: No catalog asset has type "rastor". This catalog has: audio, data, lut, model, palette, raster, tokens, vector.
```

An `asset` input takes any asset id or a `lolly.tools` tool URL, which places that tool's render. To write a bare asset to a file, use the `asset-export` tool:

```bash
lolly asset-export --src=lolly/logo/primary --export=svg --output=logo.svg
lolly asset-export --src='https://lolly.tools/tool/qr-code.svg?url=x' --output=qr.svg
```

`lolly --help` prints every command, flag and exit code, and each document verb has its own help, such as `lolly check --help`.

<!--i:eti-palette-->
## Bring your design system

Run `lolly` on its own in a terminal and it starts here:

```text
Lolly

Start with what you have. Setup is optional, and each source can be added later.

  One colour       lolly system init --color=#7c3aed --name="My system"
  .lolly or tokens lolly system import ./brand.lolly
  More resources   lolly system add ./logo.svg ./font.woff2
  Explore first    lolly list
  Make something   lolly qr-code --url=https://example.com --output=qr.svg

Design-system commands: lolly system status | list | use | import | add | export | inspect | diff | generate | sync
```

Piped into another program, the same bare `lolly` lists the tools instead.

A terminal design system sets the colours, type and logos every render uses. Build one from a single colour with `system init`, or bring one in with `system import`: a `.lolly` pack, a tokens file, a Penpot file, a token zip or an SVG. `system add` keeps fonts, logos and other source material with the system. `system status` shows the active system, its colour roles in its own words and what Lolly reads each role as. `system use <id>` switches systems. `system export` writes the active system as a portable `.lolly` pack.

The CLI and the TUI share one store, so a system set up in one is active in the other. [Where saved sessions live](/info/cli-reference.html#where-saved-sessions-live) says which directory holds the store. [Token workflows](/info/token-workflows.html) covers `system inspect`, `diff`, `generate` and `sync`.

<!--i:eti-map-pin-->
## Where to go next

| You want to | Read |
| --- | --- |
| Pick a format, size a print page, render video or fix a failed browser render | [Render with the CLI](/info/cli-rendering.html) |
| Clean, convert or redact your own files, or run speech and on-device models | [CLI file and media utilities](/info/cli-files.html) |
| Rebuild or renovate a slide deck from a script or an agent | [Rebuild a deck from the terminal](/info/cli-decks.html) |
| Prove a finished file meets an agreed spec | [Production checks](/info/production-checks.html) |
| Render a spreadsheet of files, gate a catalog in CI or preflight a print job | [CLI batch and automation](/info/cli-automation.html) |
| Look up exit codes, `--json`, global flags, verification or local state | [CLI reference](/info/cli-reference.html) |
| Sign files with your own name instead of an anonymous key | [Signing from the terminal](/info/cli-signing.html) |
| Work from the keyboard, full screen | [TUI](/info/tui.html) |
| Drive the same tools from an AI agent | [AI Agents](/info/ai-agents.html) and [MCP Server](/info/mcp.html) |
| Run organisation render jobs on a server | [lw CLI](/info/work-cli.html), for Lolly Work |

The **Batch** view in the app (`#/batch`) is the interactive counterpart to `lolly batch`: a spreadsheet grid with CSV round-trip and per-row output.

<!--i:eti-keyboard-->
## Every command

The first argument is either a **verb** or a **tool id**, and verbs win. `lolly run <tool-id>` and `lolly describe <tool-id>` are the unambiguous forms. A bare `lolly <tool-id>` renders when flags follow and describes the tool when none do. A pasted `lolly.tools` link can be the first argument too ([Run a share link](/info/cli-rendering.html#run-a-share-link)).

::: details Every verb, grouped
| Group | Verbs |
| --- | --- |
| Make files | `run`, `batch`, `smoke`, `preflight`, `intent`, `install-browser` ([Start from what the piece has to do](/info/cli-reference.html#start-from-what-the-piece-has-to-do)) |
| Find things | `list`, `describe`, `assets`, `start`, `help`, `version`, `completion`, `tui` |
| Design systems | `system` (`init`, `import`, `add`, `use`, `list`, `status`, `export`, `context`, `check`, `inspect`, `diff`, `generate`, `sync`) |
| Decks | `rebrand`, `read`, `check`, `compose`, `measure`, `package` ([Rebuild a deck from the terminal](/info/cli-decks.html)) |
| Documents and pictures | `schema`, `compile`, `validate`, `inspect`, `diff`, `optimize`, `look`, `sample`, `trace` ([CLI reference](/info/cli-reference.html#document-verbs)) |
| Your own files | `prepare`, `files`, `adobe`, `affinity`, `dxf`, `import` ([CLI file and media utilities](/info/cli-files.html), [Import a design](/info/design-import.html)) |
| Saved work and reports | `projects`, `reports` ([CLI batch and automation](/info/cli-automation.html#private-inputs-and-saved-projects)) |
| Sound and on-device models | `speak`, `transcribe`, `mix`, `models`, `upscale`, `matte`, `ocr`, `detect-ai`, `reword`, `depth` |
| Courses | `learning` ([Training courses](/info/training-creators.html)) |
| Linux packaging | `icons` (a hicolor icon RPM), `pack` (a font RPM) |

These words are reserved: a tool id may never use one. Otherwise a brand pack tool called `batch` could never be reached.
:::
