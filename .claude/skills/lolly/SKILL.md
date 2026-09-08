---
name: lolly
description: >-
  Produce on-brand creative assets (PNG, SVG, PDF, PPTX, video and more) with
  Lolly, over any surface it exposes: share links and URL mode, the public render
  route, the MCP server, the CLI, the GitHub render action, and the lolly-work
  API. Use when the task is to make an image, chart, poster, deck, QR code, print
  file or on-device file transform, or to drive any Lolly tool by URL, MCP or CLI.
  Covers the three document tools whose input is structured (chart, design,
  deck-studio) and how to edit a Design document by stable layer id.
---

# Driving Lolly

Lolly generates on-brand assets from simple inputs. Tools are data (a manifest
plus a template): the same tool runs unchanged through a URL, the render route,
MCP and the CLI, because all four share one parameter contract. Learn the contract
once and you can produce anything in the catalogue.

This skill is enough on its own. The reference files carry the exhaustive detail:

- `reference/surfaces.md`: every surface, its auth and limits, and when to pick it.
- `reference/url-mode.md`: the parameter contract, compact encoding, packed and
  embed links, and ten worked URLs.
- `reference/tools.md`: every catalogue tool with its formats and purpose.
- `reference/chart.md`, `reference/design.md`, `reference/deck.md`: the three tools
  whose input is a structured document, each with a worked example.

## Which surface

| You want | Use |
|---|---|
| Bytes from a URL, no auth, a vector or PNG format | The public render route: `GET /tool/<id>.<ext>?…` |
| An agentic loop that discovers, validates and renders | The MCP server (`lolly_*` tools) |
| Files on disk, or any format including PPTX/video/print | The CLI (`lolly run …`) |
| An editable link a human will keep tweaking | `lolly_build_url` (MCP) or `--share` (CLI) |
| Renders inside a GitHub workflow | The render action (`args-json`, `rows`) |
| Durable async jobs, batching, idempotent retries | The lolly-work API |
| A file transform (strip metadata, compress, redact) | `lolly_transform` / `lolly_redact` (MCP) or the utility on the CLI |

## The workflow

1. **Discover.** Find the tool: `lolly_list_tools` (MCP), `lolly list` (CLI), or
   `reference/tools.md`. Tool ids are permanent contracts.
2. **Describe.** Read the exact input schema, formats and examples:
   `lolly_describe_tool` / `lolly describe <id>`. Set inputs by the ids and
   `urlKey` aliases it declares, and only those.
3. **Validate.** For anything beyond a couple of fields, and always for a
   structured document (chart spec, Design boxes, a deck), call `lolly_validate`
   (or `lolly validate`) and correct every error before rendering.
4. **Render, or build a link.** `lolly_render` / `lolly run` returns the bytes.
   `lolly_build_url` / `--share` returns an editable link without rendering.
5. **Share the editable link.** When the human will iterate, hand them the
   `lolly.tools` link, not just the bytes.

## Three rules an agent must not break

1. **Never invent an input id.** Name every input exactly as the manifest declares
   it (id or `urlKey`). An unknown key is silently dropped, so a typo renders
   defaults with no error and no warning. Describe or validate first.
2. **Always validate a document before rendering it.** A chart spec, a Design
   `boxes` array and a deck are documents, not fields. `lolly_validate` and
   `lolly_inspect` catch a missing id, a layer outside its artboard, or an
   unreadable chart before you spend a render.
3. **Prefer the editable link over bytes when the human will iterate.** Bytes are a
   dead end for a person who wants to nudge a colour. The `lolly.tools` link
   reopens the exact state in the app. Return bytes when the asset is final or the
   caller is a machine.

## Reproducible output

A default render embeds a fresh timestamp (Content Credentials and the pixel
imprint), so it is not byte-identical run to run. When you need deterministic
bytes (a build step, a cached asset, a diff), turn provenance off:
`--no-provenance` on the CLI, `c2pa: "off"` with `imprint: false` on
`lolly_render`, or the public render route (which never signs). Ask before
stripping provenance from a deliverable a person will publish: the credential is
what proves the file was made with Lolly.
