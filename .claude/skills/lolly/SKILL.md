---
name: lolly
description: >-
  Produce on-brand creative assets (PNG, SVG, PDF, PPTX, video and more) with
  Lolly, over any surface it exposes: share links and URL mode, the public render
  route, the MCP server, the CLI, the GitHub render action, and the lolly-work
  API. Use when the task is to make an image, chart, poster, deck, QR code, print
  file, motion piece or on-device file transform, or to drive a Lolly tool by URL,
  MCP or CLI.
  Covers the three document tools whose input is structured (chart, design,
  deck-studio) and how to edit a Design document by stable layer id.
---

# Driving Lolly

Lolly generates on-brand assets from simple inputs. Tools are data (a manifest
plus a template): the same tool runs unchanged through a URL, the render route,
MCP and the CLI, because all four share one parameter contract. Learn the contract
once and you can produce anything in the catalogue.

Read the references needed for the chosen tool and surface:

- `reference/surfaces.md`: every surface, its auth and limits, and when to pick it.
- `reference/url-mode.md`: the parameter contract, compact encoding, packed and
  embed links, and ten worked URLs.
- `reference/tools.md`: every catalogue tool with its formats and purpose.
- `reference/chart.md`, `reference/design.md`, `reference/deck.md`: the three tools
  whose input is a structured document, each with a worked example.
- `reference/motion.md`: timed Design work, with editable recipes for kinetic
  type, a product demonstration and a quiet explainer. Read before authoring motion.
- `reference/rebrand.md`: renovating someone else's PowerPoint deck into the
  active design system - the plan/compile/inspect stages, the object classes
  and their evidence, and the MCP tool.

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
| Renovating an old deck into the design system | `lolly_rebrand` (MCP) or `lolly rebrand plan\|compile\|inspect` (CLI) - see `reference/rebrand.md` |

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
5. **Look before you hand over a layout.** `lolly_look` (MCP) draws the render
   with a grid in the document's own coordinates. Read positions off it rather
   than guessing from a small picture, and fix what you see with `layerPatches`.
6. **Share the editable link.** When the human will iterate, hand them the
   `lolly.tools` link, not just the bytes.

## Looking at your work (MCP)

A small picture of a render hides overlaps, clipped text and off-brand colour.
Three MCP tools let you check a render, or an image you were given, in the
document's own coordinates. For Design those are the artboard pixels that a
layer's `x`, `y`, `w` and `h` use.

- `lolly_look`: the render with a labelled grid, or one `region` enlarged to read
  small type. Use it before nudging a layer and before handing over a layout.
- `lolly_sample_color`: the colours at points, each named against the design
  system with its distance. A ΔE of about 0.02 is just noticeable, so "match"
  means a person would see the brand colour. Use it to check a colour, or to
  pick one from a supplied photo.
- `lolly_trace_edges`: a subject's edges as polylines. With `asDesignLayers`,
  each line is a Design path layer ready for `layerOperations` once you give it an
  id, so an outline can follow where the subject really is.

These tools never export, stamp or link anything. Their pictures are for you.

## Authoring a motion piece

For a new animation, establish the message, audience, destination, duration and
design system before placing layers. Use the active catalog and design tokens;
take factual claims from the brief or supplied sources. Treat references as
evidence for techniques and pacing. State when a reference could not be viewed.

Write a short shot table: time window, purpose, on-screen copy, entrance, reading
hold, exit and sound cue. Respect the requested duration, quiet passages and any
supplied soundtrack. Music and continuous movement are creative choices. Give a
reading hold enough time after the last staggered word arrives.

Author through Design's existing layers and motion fields, then validate the
document. Review representative stills and transition boundaries for clipping,
legibility and unintended gaps; review a short draft with sound when sound is
part of the brief. Use the preview surfaces described in `reference/motion.md`.
A structural validation result does not establish visual or audio quality.

Deliver the requested file and editable source, noting the checks actually run
and any unresolved limitations. A share link does not transport local uploads;
use a `.lolly` package when the recipient needs those assets. For a small edit to
an existing piece, review the affected interval rather than repeating the brief.

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

## Handing over a set of documents

When the work is several documents a person will keep editing (a chart per survey
question plus the deck that shows them), hand it over as one **project `.lolly`**:
a folder of saved sessions that opens back into Projects. Write a spec of tool ids,
labels and input values, then run
`node scripts/pack-project.ts project.json --output=name.lolly`; it warns about any
tool or input id the active profile does not declare. In the app, a folder's menu
offers the same file as **Download project (.lolly)**. To put one tool's render on a
slide, give the slide's media slot the tool's embed link
(`{ "id": "https://lolly.tools/tool/chart.svg?..." }`); it re-renders on open.

## Reproducible output

A default render embeds a fresh timestamp (Content Credentials and the pixel
imprint), so it is not byte-identical run to run. When you need deterministic
bytes (a build step, a cached asset, a diff), turn provenance off:
`--no-provenance` on the CLI, `c2pa: "off"` with `imprint: false` on
`lolly_render`, or the public render route (which never signs). Ask before
stripping provenance from a deliverable a person will publish: the credential is
what proves the file was made with Lolly.
