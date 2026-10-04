# Surfaces

Five ways to drive Lolly. They share one parameter contract (`url-mode.md`); pick
the surface by what you have and what you need back.

| Surface | Reach for it when |
|---|---|
| Public render route | You want bytes from a URL, no auth, browser-free formats. |
| MCP server | You are an agent with a tool-calling loop: discover, validate, render, verify. |
| CLI | You are in a terminal or CI and want files on disk, including browser-tier formats. |
| Render action | You want renders to happen inside a GitHub workflow. |
| lolly-work API | You are integrating a hosted service with async jobs and idempotency. |

## Public render route

A single unauthenticated GET returns a finished asset.

```
GET https://lolly.tools/tool/<id>.<ext>?<url-mode query>
```

Contract (`services/mcp/src/render-get.ts`):

- **Official and community tools only.** Anything else is a 404, with no
  existence leak.
- **Browser-free formats only**, the `TIER_A` set: `svg`, `emf`, `eps`,
  `eps-cmyk`, `dxf`, `exr`, `hdr`, `penpot`, `html`, `md`, `txt`, `json`, `csv`,
  `ics`, `vcf`. Plus `png` for SVG-native tools (a tool whose formats include
  `svg`). Any other format returns a 400 telling you to use the app or
  `lolly_render`.
- **Content Credentials are off here**, always, so the vector and PNG output is
  byte-stable run to run and cacheable (a strong `ETag`, `s-maxage=86400`,
  `stale-while-revalidate=604800`). `ics` is the one exception, since RFC 5545
  requires a fresh `DTSTAMP`. Responses are `noindex`.
- **Limits.** Query at most 4096 characters; `dpi` 1 to 1200 (default 300);
  width/height positive; a physical size must resolve to at most 10000 px per
  edge; a `png` is capped at 2048 x 2048 pixels of area. Renders are
  rate-limited per address (60/min by default) and share the host's daily
  budget. A param the render never reads is dropped with a `308` redirect, so
  build URLs with `lolly_build_url` rather than adding your own.
- **Headers.** `content-security-policy: sandbox`, `x-content-type-options:
  nosniff`, `content-disposition: inline`.
- **Themes.** `_themes` (the theme per token group as JSON, `_themes={"":"dark"}`)
  renders a tool this route can draw, such as `qr-code`, with its token colours
  in that theme; a value that is not such JSON is a 400, and a choice the design
  system does not declare draws that group's default theme with no warning. Design
  needs the browser tier, so this route refuses a Design document in any theme:
  export one per theme with `lolly run <file.lolly> --themes=light,dark` instead.
- An operator can switch the route off entirely (`LOLLY_DISABLE_RENDER_GET=1`),
  in which case every URL is a 404. The route is live on lolly.tools.

## MCP server

The agent surface. Workflow the server itself declares:
**`lolly_list_tools` -> `lolly_describe_tool` -> `lolly_validate` -> `lolly_render`**.
Its prompts repeat one instruction: validate inputs, correct every error, then
render.

- **Transports.** stdio (JSON-RPC over stdout, logs on stderr) and Streamable-HTTP
  at `POST <base>/api/mcp`.
- **Auth.** Anonymous locally. `https://lolly.tools/api/mcp` is open to anyone
  with no token (browser-free tier: vector, data, and `png` for SVG-native tools).
  Its limits: 60 calls a minute per address, a daily compute and data budget for
  the whole endpoint (`503` with `error: daily_budget_reached` and `Retry-After`
  to 00:00 UTC once spent), `png` at most 1600 x 1600 pixels of area, 4.4 MB per
  answer and decks up to 100 slides (`lolly_rebrand`, `lolly_read`,
  `lolly_check`). `https://mcp.lolly.tools/mcp` (full browser tier) requires an
  OAuth 2.1 bearer token (`Authorization: Bearer …`), with the usual discovery
  endpoints under `/.well-known/`. For HTML-layout tools
  (`design`, `chart`), large files or heavy automation, use the CLI.

### The 21 tools

| Tool | Required | Does |
|---|---|---|
| `lolly_list_tools` | - | List/search the catalogue (`q`, `status`, `category`, `format`, `capability`). |
| `lolly_describe_tool` | `toolId` | One tool's full input JSON Schema, templates/presets, formats, canvas size, examples. |
| `lolly_validate` | `toolId` | Validate inputs before compile or render: path-specific errors, warnings, Design checks. |
| `lolly_compile` | - | Compile a document without rasterising (needs `toolId` or `document`). |
| `lolly_inspect` | - | Inspect a document without rasterising; accepts a `file`. |
| `lolly_measure` | - | Measure a document without rasterising. |
| `lolly_diff` | `a`, `b` | Semantically diff two compiled documents or recipe query strings. |
| `lolly_package` | `document`, or `toolId: "design"` | A Design document as a `.lolly` the app reopens as the same document, with its pictures and its name: `assets` carries the bytes of each placeholder picture (base64, by the `image` value that draws it), `source` a deck whose pictures resolve `user/media/<sha256>` refs and the `photo:<12 hex>` keys `lolly_compose` suggests, `label` the name. Every other picture must be a catalog id; anything unresolved is refused unless `allowMissingMedia`. Returns the file and a report of what was carried and read back. A compiled document of another tool is packaged as before (`legacy: true`). |
| `lolly_build_url` | `toolId` | Build a shareable, editable link plus a raw render URL, without rendering. |
| `lolly_render` | `toolId` | Render to an asset (PNG/SVG/PDF/…). Returns the image plus an editable link. |
| `lolly_transform` | `toolId`, `file` | Run an on-device file utility (`strip-data`, `compress-pdf`). Never watermarked. |
| `lolly_rebrand` | `stage` | Renovate a `.pptx` deck into the design system in stages: `capabilities`, `plan`, `compile` (to a `.lolly`, optionally a `.pptx`) and `inspect`. A hosted server receives the file. |
| `lolly_read` | `file` | What a deck says (`.pptx`, PDF, `.psd`), slide by slide: text in reading order with role and runs, notes with paragraphs and line breaks kept apart, pictures by hash with placement and crop, tables, charts, the class of every object. `media: "inline"` adds the picture bytes. A hosted server receives the file. |
| `lolly_check` | `file`, `toolId` or `document` | Every check in one findings list: `structure`, `render`, `brand` (with house rules), `verify`, and `fidelity` with `source` or `inventory`. Each finding: stable `code`, `severity`, `layerId`, the app's message, a safe `fix`. `theme` checks one token theme; `themes` (a list, or `"all"`) runs the render, brand and Verify families in each theme (structure and fidelity once), and each of those findings names its `theme`. `exitCode` as `lolly check`. |
| `lolly_measure_text` | `text` and `width`, or `document` | Where a plain Design text layer's lines break and how tall it is, before it is drawn: lines with widths and a `nearEdge` flag, `height`, the `scrollHeight` the canvas reports, and with `height` whether the box clips it. `style` sets the box up as an authored row, sized for `artboardWidth` (default 1920). The same measure as `lolly measure --text --json`. |
| `lolly_compose` | `spec`, or `mode` | Slides laid out from the slide master's archetypes as a Design document with the master's furniture and bindings: `spec.slides[]` gives an `archetype` per slide and its `slots` (a role or `role#n`: text, `null` to drop, or `{from: "<inventory object id>"}`, with `join: ": "` to run its lines into one; `from` may list several text objects and `para` several paragraphs, and a table slot takes `{$table: {...}}`), with `inventory` or `source` for the deck's text and notes; `furniture`, `emphasis` and `case` on the spec are deck defaults a slide's own merge over, and `themes: ["light", "dark"]` writes logo furniture as `<id>?theme=auto`. Returns the document, a report (archetype, filled, dropped, which text slots clip; `fit: "shrink"` steps them down), the source wording changed as `edits` for `lolly_check`, and the pictures named. `mode: "list"` gives the archetypes; `mode: "suggest"` a first spec for a deck. The same composer as `lolly compose --json`. |
| `lolly_redact` | `file` | Destroy regions of an image/SVG/PDF. Rebuilds and re-checks; a failed check returns no file. |
| `lolly_verify` | `file` | Verify a file's Content Credentials: made with Lolly, who signed, changed since export. |
| `lolly_look` | `toolId` or `file` | The render with a labelled grid in document units, or one `region` enlarged. For looking; not an export. |
| `lolly_sample_color` | `points` | Colours at points, each with the nearest design-system colour and its ΔE (0.02 is just noticeable). |
| `lolly_trace_edges` | `toolId` or `file` | Edges as polylines in document units, longest first; `asDesignLayers` adds a ready Design path layer per line. |

The three looking tools take a source the way `lolly_render` does (`toolId`,
`inputs`, `templateId`, `layerOperations`, `layerPatches`) or a `file` (PNG, JPEG,
GIF, WebP or SVG). Document units are the render's own SVG viewBox: for Design,
the artboard pixels a layer's `x`, `y`, `w` and `h` use, so a position read off
the grid can go straight into a `layerPatches` entry. A raster file is measured in
its own pixels. Design and Chart draw their SVG in the browser tier, so looking at
them needs the full endpoint, as rendering them does.

To rebuild a deck in Design: read `lolly://design-context`, call `lolly_read` on the
source deck, call `lolly_compose` with `mode: "suggest"` and the `inventory` for a
first spec, edit it, compose with `lolly_compose` (`spec` and `inventory`), package
with `lolly_package`, then call `lolly_check` with the result, the inventory
`lolly_read` returned (`inventory`) and the `edits` compose returned, each with a
reason of your own. The spec is described in `design.md`. `lolly_check` takes exactly one of `file` (a
Design document, `.lolly` or export), `toolId: "design"` with `inputs`,
`templateId`, `layerOperations` and `layerPatches`, or a compiled `document`.
`exitCode` is `0` clean, `5` to review, `4` an error finding (or any warning with
`strict`), `3` no browser under `browser: "require"`, `1` a family failed. The
render family needs the browser tier, so on the open endpoint it is `unavailable`
and the rest still run. Verify never runs text recognition here. Fix each finding
at its `layerId` with `layerPatches`, then check again.

While composing, `lolly_measure_text` says where a text box's lines break before
you place the box. To hand the person a file, `lolly_package` writes a `.lolly` the app
reopens with the pictures and the name. On the open endpoint the pictures and the
source travel in one request and the `.lolly` comes back in one answer of at most
4.4 MB, so package a large deck on the CLI.

Shared argument shapes: `RENDER_ARGS` are `toolId`, `inputs` (an object of the
tool's inputs), `format`, `width`, `height`, `unit`, `dpi`; `TEMPLATE_ARGS` are
`templateId`, `presetId`; `EXPORT_ARGS` cover `depth`, `hdr`, `bleed`, `marks`,
`cuts`, `sampleTimes`, `imprint`, `durable`, `fps`, `seconds`, `wait`, `codec`, `vq`.
For stills, `sampleTimes` is an array of 1-64 strictly increasing authored timeline
seconds, before the composition end. One returns one still; several return a ZIP
(or a paged PDF). Do not combine with `cuts > 1`. See `motion.md` for source limits.
Motion settings travel in both the editable link and the browser export request.
`fps` is an integer from 1 to 120, `seconds` is 0.5 to 3600, and `wait` is 0 to 30
seconds. `codec` is `h264`, `hevc`, `vp9` or `av1`; `vq` is `smaller`, `balanced`
or `best`. Omit settings to retain the tool's defaults. Invalid explicit settings
return an error. Codec availability depends on the browser tier.
`lolly_render` adds `transparentBg`, `convertPaths`,
`background`, `colorProfile`, `c2pa` (`off`/`7`/`30`/`90`/`365`), `password` and
`link` (default true).

**Design documents** are edited through `layerOperations` and `layerPatches`,
accepted by `lolly_compile`, `lolly_inspect`, `lolly_measure`, `lolly_validate`,
`lolly_build_url` and `lolly_render`:

- `layerOperations`: an ordered array of `add` / `duplicate` / `remove` /
  `reparent` / `reorder`, each addressing a layer by its stable id.
- `layerPatches`: an array of `{ id, set }` that merges fields into one layer.

Design rows, an `add` layer and a patch's `set` may carry authoring keys: `$in`
(positions relative to an artboard), `$style` (a text style from the design
brief or `$styles`), `$points` or `$d` (a path in px) and the layouts `$stack`,
`$grid` and `$table`, with `$styles` and `$theme` beside `boxes`. They are lowered
to stored layers in global canvas coordinates before anything else runs, on every
tool above and on `lolly_check` and `lolly_package`.

See `design.md` for the worked examples and the authoring keys.

### Scoped file tools

When the connection has an authenticated file scope, five more tools appear, for
importing a private file once and operating on its handle: `files_import`,
`files_list`, `files_convert`, `files_report`, `files_delete`. Bytes stay in the
scope (4 MB per file, one-hour TTL) and are read back explicitly at
`lolly://files/{id}/content`.

### Resources

Read-only context, no render:

- `lolly://catalog`: the full generated tool index.
- `lolly://assets`: the brand asset listing.
- `lolly://tokens`: the brand design tokens.
- `lolly://design-context`: the design brief, the same one `lolly system context`
  prints: resolved tokens, coverage and brand rules, plus approved colour pairings
  (which foreground on which background, text or graphics only), type per role,
  logos per surface, icons and their themes, media families, the slide master's
  archetypes and the house rules as machine-checkable records. Its `origin` is
  always the server's content profile and head tokens asset, the design system
  `lolly_check` checks against; the CLI tries `--file` and the terminal's active
  system first. Read it before composing anything on-brand.
- `lolly://tool/{id}` and `lolly://tool/{id}/preview`: one tool's schema, or its
  preview SVG.
- `lolly://asset/{id}`: one asset's bytes.

### Prompts

`create-branded-asset` (arguments `brief`, optional `format`) is a five-step
guided workflow: pick a tool, describe it, validate, render, share the editable
link. One prompt per featured tool mirrors it.

## CLI

`lolly` is URL mode under a different transport: `--foo=bar` argv pairs are the
same values the web shell reads from `?foo=bar`. One render path, so GUI and
terminal never drift.

```
lolly qr-code --url=https://suse.com --output=qr.svg
lolly run qr-code --url=https://suse.com --export=png > qr.png
lolly deck-studio --spec="$(cat deck.md)" --export=pptx --output=deck.pptx
```

Verbs that matter to an agent: `list`, `describe <id> [--all]`, `run <id>`,
`compile`, `schema <id>`, `inspect`/`measure`/`diff` (document API), `validate`,
`batch <rows.csv>`, `smoke`, `assets`, `preflight`, `read <deck>` (the content
inventory, `--media=<dir>` writes the pictures), `check <file>` (every check in one
findings list, `--source=<deck|inventory.json>` adds fidelity) and
`system context` (the design brief as JSON). For Design: `run design
--document=<file|-> [--s=<slide>]` renders a document whose rows may carry
authoring keys (a placeholder picture such as `photo:title` is drawn only once
`package --asset` has given it bytes, so preview and check the `.lolly`);
`measure --text=<text> --width=<px>` (or `measure <file> --text-layers`) measures
text before it is drawn; `compose <spec.json> [--source=<deck>] --output=<design.json>
[--edits-out=<edits.json>]` lays slides out from the slide master's archetypes
(`compose --list` lists them, `compose --suggest --source=<deck>` writes a first
spec, `compose --help` lists the spec's keys; see `design.md`); `package
<design.json> --output=<file.lolly> [--asset=KEY=PATH]… [--source=<deck>]` writes a
`.lolly` the app reopens, its `user/media/<sha256>` refs and `photo:<12 hex>` keys
resolved from the deck given as `--source`; and `run <session.lolly>
--export=pptx|pdf|png|svg|jpg|webp [--s=<slide>]` exports a saved Design
session through the web shell's own exporter (an `--output` whose folder does
not exist is refused with exit 2 before a browser starts, and `--force` is
accepted, as on `compose` and `package`, since `run` always replaces its
output). On both, `--s` is a 1-based slide
number or a frame id; a frame's name is not an address, and an `--s` that matches
no slide exits 2 before a browser starts. On both, `--themes=light,dark` (or
`all`) exports once per theme of the content profile's design system, to
`<stem>-<theme>.<ext>` beside `--output`, which it needs; `check <file>
--themes=light,dark` checks a document in each theme. That export opens the file through
the app's `#/open?lolly=<path>` route, which takes a path on the same site or a
`blob:` URL from the same page, and opens a plain saved session with no prompt
(a file that carries a tool or a design system still asks the person). A Design
render on the CLI (`run design --document`, a saved session, and the `render`
family of `check`) reaches the web shell the same way, as a saved session served
once from the same site, so a document with full-size pictures (up to 64 MB)
needs no address that holds it. A bare
`lolly <id>` with flags
is sugar for `run`; with no flags it is `describe`. A pasted
`https://lolly.tools/#/tool/…` URL runs that tool, and later `--flags` override the
link.

Export flags:

- `--export=<fmt>` sets the format (an explicit value wins over a URL's own
  `format`); `--output=<path>` writes there (`-` is stdout, extension can pick the
  format); `--filename=<name>` names the file in the working directory.
- `--width` / `--height` / `--unit` / `--dpi` size the output, exactly as the URL
  params. On `measure --text`, `--width` and `--height` are the text box in px.
- `--c2pa` and `--imprint` are on by default. **`--no-provenance` is the
  deterministic-bytes switch**: no credential, no imprint, no durable mark, so the
  render is byte-identical run to run (both marks embed a fresh timestamp
  otherwise). Reach for it whenever you need reproducible output.
- Print prep is `--bleed`, `--marks`, `--press-profile`; motion is `--fps`,
  `--seconds`, `--wait`, `--codec`, `--vq`.

Exit codes are meaningful: `0` ok, `2` usage, `3` unavailable in this install (no
browser tier here, retry elsewhere), `4` refused by a protective check (`check`: an
error finding; `package`: a picture without bytes, an unknown catalog id or an
output that exists without `--force`; `compose`: a spec it refuses, with the JSON
pointer of the key, or an output that exists), `5` a legitimate negative (no credential
present; `check` and `rebrand compile`: findings to review), `6` auth.

Batch renders one file per CSV row into a directory:

```
lolly batch rows.csv --out-dir=./out
```

The header names a `toolId` column, optional per-row output columns (`format`,
`width`, `height`, `unit`, `dpi`, `filename`), and one column per tool input. Each
row goes through the single-render path; provenance is off by default (a batch is a
build step). `--keep-going` finishes after a row fails; the exit code is the worst
row's. Print a starter grid with `lolly batch --template=<tool>`.

Browser-tier note: `pptx`, full raster of HTML-layout tools, PDF layout and video
need the Tier-B browser path. Run `lolly install-browser --with-deps` plus
`pnpm run build:web` first, or an exit `3` tells you to render on a runner that has
the browser tier. In a checkout, `LOLLY_WEB_BASE=<address>` points the CLI at a web shell you
already run (`pnpm run dev:web`, or without pnpm `node ../../node_modules/vite/bin/vite.js`
from `shells/web`) instead; start it under the same `LOLLY_PROFILE`
as the CLI, so both sides use one catalog and one slide master. With no `lolly`
on your PATH in a checkout, every verb runs as `node shells/cli/bin/lolly.ts <verb>`
from the repository root. The `TIER_A`
formats, the data formats and PNG of SVG-native tools all render browser-free.

## Render action

`lolly-tools/lolly`'s composite action renders inside a GitHub workflow. Inputs:

- `tool`: the tool id (ignored when `rows` is set).
- `args-json`: the preferred way to pass flags, a JSON array of complete argv
  strings, for example `["--url=https://example.com", "--padding=2"]`. Values are
  literal, never shell-evaluated. (`args`, a single quoted string, is the
  deprecated fallback. `export`, `format` and `output` are action-owned and
  rejected here.)
- `rows`: a workspace-relative batch CSV; when set, `tool`/`args`/`format` are
  ignored and every row renders into `out-dir`.
- `format` (default `svg`), `out-dir` (default `./lolly-out`).
- `browser`: `'true'` installs the scoped Chromium and builds the web shell for
  the Tier-B formats. Leave `'false'` unless a render fails asking for it.
- `lolly-ref` pins the render engine's git ref; `profile-root` points at a brand
  pack; `token` defaults to `github.token`.

Outputs `out-dir` (absolute) and `files` (newline-separated, relative). The action
launches the CLI with `shell: false`, so inputs are data, never shell source.

## lolly-work API

lolly-work is the hosted control plane. Its own docs (`docs/api.md`,
`docs/renders.md` in the `lolly-work` repo) are canonical; the shape an agent needs:

- A versioned REST API under `/api/v1` with document verbs, links and sessions.
- **Renders and render-batches run as async jobs**: submit, receive a job id, poll
  or await completion. Batching amortises setup across many renders.
- **Idempotency keys** make a retried submission safe: the same key returns the
  same job rather than creating a second.
- Stable error codes, so a client branches on the code, not the message.

Prefer the public render route or the CLI for one-off bytes; reach for lolly-work
when you need durable jobs, batching at scale and idempotent retries.
