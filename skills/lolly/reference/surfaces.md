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
  edge. Renders are rate-limited per address (60/min by default).
- **Headers.** `content-security-policy: sandbox`, `x-content-type-options:
  nosniff`, `content-disposition: inline`.
- An operator can switch the route off entirely (`LOLLY_DISABLE_RENDER_GET=1`),
  in which case every URL is a 404. lolly.tools itself currently runs it off, so
  treat the route as available on self-hosted instances and use the MCP or CLI
  against the public host.

## MCP server

The agent surface. Workflow the server itself declares:
**`lolly_list_tools` -> `lolly_describe_tool` -> `lolly_validate` -> `lolly_render`**.
Its prompts repeat one instruction: validate inputs, correct every error, then
render.

- **Transports.** stdio (JSON-RPC over stdout, logs on stderr) and Streamable-HTTP
  at `POST <base>/api/mcp`.
- **Auth.** Anonymous locally; hosted mode requires an OAuth 2.1 bearer token
  (`Authorization: Bearer …`). The protected resource is `<base>/api/mcp` with the
  usual discovery endpoints under `/.well-known/`.

### The 13 tools

| Tool | Required | Does |
|---|---|---|
| `lolly_list_tools` | - | List/search the catalogue (`q`, `status`, `category`, `format`, `capability`). |
| `lolly_describe_tool` | `toolId` | One tool's full input JSON Schema, templates/presets, formats, canvas size, examples. |
| `lolly_validate` | `toolId` | Validate inputs before compile or render: path-specific errors, warnings, Design checks. |
| `lolly_compile` | - | Compile a document without rasterising (needs `toolId` or `document`). |
| `lolly_inspect` | - | Inspect a document without rasterising; accepts a `file`. |
| `lolly_measure` | - | Measure a document without rasterising. |
| `lolly_diff` | `a`, `b` | Semantically diff two compiled documents or recipe query strings. |
| `lolly_package` | `document` | Package a compiled document into portable `.lolly` bytes. |
| `lolly_build_url` | `toolId` | Build a shareable, editable link plus a raw render URL, without rendering. |
| `lolly_render` | `toolId` | Render to an asset (PNG/SVG/PDF/…). Returns the image plus an editable link. |
| `lolly_transform` | `toolId`, `file` | Run an on-device file utility (`strip-data`, `compress-pdf`). Never watermarked. |
| `lolly_redact` | `file` | Destroy regions of an image/SVG/PDF. Rebuilds and re-checks; a failed check returns no file. |
| `lolly_verify` | `file` | Verify a file's Content Credentials: made with Lolly, who signed, changed since export. |

Shared argument shapes: `RENDER_ARGS` are `toolId`, `inputs` (an object of the
tool's inputs), `format`, `width`, `height`, `unit`, `dpi`; `TEMPLATE_ARGS` are
`templateId`, `presetId`; `EXPORT_ARGS` cover `depth`, `hdr`, `bleed`, `marks`,
`cuts`, `imprint`, `durable`. `lolly_render` adds `transparentBg`, `convertPaths`,
`background`, `colorProfile`, `c2pa` (`off`/`7`/`30`/`90`/`365`), `password` and
`link` (default true).

**Design documents** are edited through `layerOperations` and `layerPatches`,
accepted by `lolly_compile`, `lolly_inspect`, `lolly_measure`, `lolly_validate`,
`lolly_build_url` and `lolly_render`:

- `layerOperations`: an ordered array of `add` / `duplicate` / `remove` /
  `reparent` / `reorder`, each addressing a layer by its stable id.
- `layerPatches`: an array of `{ id, set }` that merges fields into one layer.

See `design.md` for the worked example.

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
`batch <rows.csv>`, `smoke`, `assets`, `preflight`. A bare `lolly <id>` with flags
is sugar for `run`; with no flags it is `describe`. A pasted
`https://lolly.tools/#/tool/…` URL runs that tool, and later `--flags` override the
link.

Export flags:

- `--export=<fmt>` sets the format (an explicit value wins over a URL's own
  `format`); `--output=<path>` writes there (`-` is stdout, extension can pick the
  format); `--filename=<name>` names the file in the working directory.
- `--width` / `--height` / `--unit` / `--dpi` size the output, exactly as the URL
  params.
- `--c2pa` and `--imprint` are on by default. **`--no-provenance` is the
  deterministic-bytes switch**: no credential, no imprint, no durable mark, so the
  render is byte-identical run to run (both marks embed a fresh timestamp
  otherwise). Reach for it whenever you need reproducible output.
- Print prep is `--bleed`, `--marks`, `--press-profile`; motion is `--fps`,
  `--seconds`, `--wait`, `--codec`, `--vq`.

Exit codes are meaningful: `0` ok, `2` usage, `3` unavailable in this install (no
browser tier here, retry elsewhere), `4` refused by a protective check, `5` a
legitimate negative (no credential present), `6` auth.

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
it. The `TIER_A` formats, the data formats and PNG of SVG-native tools all render
browser-free.

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
