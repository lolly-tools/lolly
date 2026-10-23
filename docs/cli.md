# lolly CLI: create and process files

Use `lolly` when you want a Lolly file without opening the app: in a build script, a CI job, a folder of files to process or an agent's tool call. It runs the same engine as the app, so the file matches the one the export panel would make.

From the terminal you can:

- make a file with any tool, giving its inputs as flags;
- find tools, their inputs and the catalog's logos and icons;
- set up your design system for the terminal;
- check, clean or convert files you already have.

Every flag is a URL parameter by another name. `--url=https://example.com` is `?url=https://example.com` in a share link, which is why a link copied from the app renders the same here ([URL Mode](/info/url-mode.html)). To browse with the keyboard instead, run `lolly tui` ([TUI](/info/tui.html)).

## Install

There are two routes to the same program.

**The desktop app.** Lolly for macOS, Windows and Linux carries its own tools, catalog and this CLI, so installing the app is enough. On macOS the command is the app's own executable, `Lolly.app/Contents/MacOS/lolly-desktop`, with the same arguments. `run` uses the app's native off-screen WebView; the other verbs go to the bundled Node package.

**A checkout.** In a clone of the Lolly source ([github.com/lolly-tools/lolly](https://github.com/lolly-tools/lolly)) the CLI is a package script.

::: note Before you start
You need Node.js 22.18 or later and pnpm; if `pnpm --version` fails, run `npm install --global pnpm` ([Prerequisites](/info/build-guide.html#prerequisites-all-targets)). Run `pnpm install` once at the repository root ([Getting the source](/info/build-guide.html#getting-the-source)), then run every command from that root. Arguments go straight after the tool id, with no `--` in between.
:::

In a checkout, `pnpm run cli` takes the place of `lolly`. Examples on these pages that start with `lolly` run as `pnpm run cli` followed by the same arguments.

### A standalone CLI carries no tools and no catalog

Tools and brand assets are content, not code, and the public set alone runs to hundreds of megabytes. A standalone `lolly` (the packaged CLI, see [Build the CLI and TUI](/info/build-terminal.html#standalone-binary)) carries none of it, so point it at a root:

```bash
LOLLY_ROOT=/path/to/lolly lolly list
```

Two kinds of directory work:

- a **checkout** of this repository, which holds `profiles.json` and the packs under `community/` and `brands/`;
- a **materialized** root: a `tools/` directory of tool folders and a built `catalog/` with its generated index, which is what a `dist/` build, an RPM payload or a container image carries.

A `LOLLY_ROOT` that holds neither is ignored, and the CLI falls back to looking upward from itself, then in the working directory. Build any pack's `tools/` and `catalog/` this way and every command (render, batch, smoke, assets) runs against it with no code change. The desktop app brings its own root, so it needs no pointing.

`lolly system import <pack.lolly>` is a different thing: it imports **your design system**, and it adds no tools, so it needs a root as well. Run a command that needs content without any, and the CLI lists these routes and exits `3`. It never downloads anything on its own.

## Make your first file

```bash wrap
lolly qr-code --url=https://example.com --output=qr.svg
```

The CLI says which design system it recorded in the file, then ends with a line that starts `✓ Wrote`:

```text
Recorded the design system: Lolly Starter. Pass --no-madewith to leave the record out.
✓ Wrote 20381 bytes to qr.svg
```

In a checkout, a note that the catalog is unsigned comes first. That is expected for a local catalog.

`qr.svg` is written to the current directory, replacing any file of that name. If your own address contains `?` or `&`, put it in quotes.

The general form is `lolly <tool-id> [--input=value ...] [--export=fmt] [--output=file]`. With `--output`, the file is written and the byte count goes to stderr. Without it, the bytes go to **stdout**, so you can pipe them:

```bash
pnpm --silent run cli qr-code --url=https://example.com --export=png > qr.png
```

::: warning Redirecting from a checkout
Use `pnpm --silent run cli` whenever you redirect or pipe. pnpm can print a warning or a run banner on stdout before the CLI starts, and that line would end up inside your PNG. An installed `lolly` binary never prints them.
:::

The `--output` extension asks for a format, so a tool that cannot write it stops instead of writing other bytes under your name. [Render with the CLI](/info/cli-rendering.html#the-output-extension-is-a-format-request) explains that check, along with sizes, print options and video.

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

`describe` lists a tool's essential inputs with their defaults and a usage line; `--all` shows every input. Inputs that are not a plain value (`asset`, `blocks`, `vector`, `file`, `color`) get a `↳` line showing how to write one.

`list --q=<words>` matches tool ids, names, descriptions, categories and formats, and `--limit=1..100` keeps an agent's answer short. With `--json`, either option adds `query`, `limit` and `total` to the result. `assets --type=` is checked against the catalog, so a typo is an error that lists the real types rather than an empty list:

```text
$ lolly assets --type=rastor
Error: No catalog asset has type "rastor". This catalog has: audio, data, lut, model, palette, raster, tokens, vector.
```

Any asset id can fill an `asset` input, and so can a `lolly.tools` tool URL, which places that tool's render. To write a bare asset straight to a file, use the `asset-export` tool:

```bash
lolly asset-export --src=lolly/logo/primary --export=svg --output=logo.svg
lolly asset-export --src='https://lolly.tools/tool/qr-code.svg?url=x' --output=qr.svg
```

`lolly --help` prints every command, flag and exit code, and each document verb has its own help, such as `lolly check --help`.

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

A terminal design system is the colours, type and logos every render then uses. Build one from a single colour with `system init`, or bring one in with `system import`: a `.lolly` pack, a tokens file, a Penpot file, a token zip or an SVG. `system add` keeps fonts, logos and other source material with the system. `system status` shows which system is active, `system use <id>` switches and `system export` writes the active one as a portable `.lolly` pack.

The CLI and the TUI share one store, so a system set up in one is active in the other. [Where saved sessions live](/info/cli-reference.html#where-saved-sessions-live) says which directory holds the store. [Token workflows](/info/token-workflows.html) covers `system inspect`, `diff`, `generate` and `sync`.

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

## Every command

The first argument is either a **verb** or a **tool id**, and verbs win. `lolly run <tool-id>` and `lolly describe <tool-id>` are the unambiguous spellings; a bare `lolly <tool-id>` renders when flags follow and describes when none do. A pasted `lolly.tools` link can be the first argument too ([Run a share link](/info/cli-rendering.html#run-a-share-link)).

::: details Every verb, grouped
| Group | Verbs |
| --- | --- |
| Make files | `run`, `batch`, `smoke`, `preflight`, `install-browser` |
| Find things | `list`, `describe`, `assets`, `start`, `help`, `version`, `completion`, `tui` |
| Design systems | `system` (`init`, `import`, `add`, `use`, `list`, `status`, `export`, `context`, `check`, `inspect`, `diff`, `generate`, `sync`) |
| Decks | `rebrand`, `read`, `check`, `compose`, `measure`, `package` ([Rebuild a deck from the terminal](/info/cli-decks.html)) |
| Documents and pictures | `schema`, `compile`, `validate`, `inspect`, `diff`, `optimize`, `look`, `sample`, `trace` ([CLI reference](/info/cli-reference.html#document-verbs)) |
| Your own files | `prepare`, `files`, `adobe` ([CLI file and media utilities](/info/cli-files.html), [Import a design](/info/design-import.html)) |
| Sound and on-device models | `speak`, `transcribe`, `mix`, `models`, `upscale`, `matte`, `ocr`, `detect-ai`, `reword`, `depth` |
| Courses | `learning` ([Training courses](/info/training-creators.html)) |
| Linux packaging | `icons` (a hicolor icon RPM), `pack` (a font RPM) |

These words are reserved: a tool id may never take one. Otherwise a brand pack shipping a tool called `batch` could never be reached.
:::
