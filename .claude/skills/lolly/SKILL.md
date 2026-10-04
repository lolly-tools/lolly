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
  whose input is a structured document, each with a worked example. `design.md`
  also holds the authoring keys and the spec `lolly compose` lays slides out from.
- `reference/motion.md`: timed Design work, with editable recipes for kinetic
  type, a product demonstration and a quiet explainer. Read before authoring motion.
- `reference/rebrand.md`: renovating someone else's PowerPoint deck into the
  active design system - the plan/compile/inspect stages, the object classes
  and their evidence, and the MCP tool.
- `reference/recreate.md`: rebuilding someone else's deck on brand in Design,
  light and dark, as one `.lolly` and a `.pptx` per theme - the loop with its
  commands (compose from the slide master, then package, check and export every
  theme), the traps a literal copy
  falls into and their check codes, `edits.json`, and the hand-over checklist an
  evaluator grades.

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
| Rebuilding a deck in Design from its content | `lolly://design-context` / `lolly system context` for the brief, `lolly_read` / `lolly read` for the source, `lolly_compose` / `lolly compose` for the slides, `lolly_check` / `lolly check` for the result - see `reference/recreate.md` |
| Slides laid out from the brand's slide master, with its furniture and real PowerPoint placeholders | `lolly_compose` (MCP) or `lolly compose <spec.json>` (CLI) - see `reference/design.md` |
| Checking a Design document, `.lolly` or export before handing it over | `lolly_check` (MCP) or `lolly check` (CLI) |
| Writing a Design document in artboard coordinates, by text style or with layouts | The authoring keys (`$in`, `$style`, `$stack`, …) - see `reference/design.md` |
| Knowing where a text box's lines break before drawing it | `lolly_measure_text` (MCP) or `lolly measure --text` (CLI) |
| A `.lolly` file a person opens in the app, pictures included | `lolly_package` (MCP) or `lolly package <design.json> --output=<file.lolly>` (CLI) |
| One Design document in every theme: colours, logos, icons and photo looks that follow it | Token references, `<id>?theme=auto` and `?treatment=<look>` (see `reference/design.md`), then `lolly run <file> --themes=light,dark --output=<file>` and `lolly check --themes` (CLI), `_themes` in URL mode |

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
5. **Look before you hand over a layout.** `lolly_look` (MCP) or `lolly look`
   (CLI) draws the render with a grid in the document's own coordinates. Read positions off it rather
   than guessing from a small picture, and fix what you see with `layerPatches`.
6. **Check before you hand over.** `lolly_check` (MCP) or `lolly check` (CLI)
   runs every check in one findings list: structure, the painted page, brand and
   house rules, Verify layout clues and, given the source, fidelity to it. Fix each
   finding at its `layerId`, then check again; `exitCode` `0` is clean.
7. **Share the editable link.** When the human will iterate, hand them the
   `lolly.tools` link, not just the bytes.

## Looking at your work (MCP and CLI)

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

On the CLI the same three are `lolly look`, `lolly sample` and `lolly trace`,
over the same code. They take a picture file, or `-` to read a render piped in:
`lolly design --z=… --export=svg | lolly look - --output=look.png`. `lolly sample`
names colours against the content profile's design system (`LOLLY_PROFILE`); it
reads no `--file` system.

These tools never export, stamp or link anything. Their pictures are for you.

## Rebuilding a deck in Design

When the task is to recreate someone else's deck in the design system (rather than
renovate it in place with `lolly_rebrand`), work from facts, not from a picture of
the deck. `reference/recreate.md` holds the whole loop with its commands, the traps
a literal copy falls into and the hand-over checklist; in short:

1. **Brief yourself.** Read `lolly://design-context` (or run `lolly system context
   --json`): approved colour pairings, type per role (`type.styles` holds the sizes
   a `$style` writes), logos per surface, icons and their themes, the slide
   master's archetypes and the house rules. Compose with
   token names and catalog ids from it, never invented values.
2. **Read the source.** `lolly_read` (or `lolly read <deck> --json --media=<dir>`)
   gives each slide's text in reading order with its role, the speaker notes with
   their paragraphs and line breaks, the pictures by hash, tables and charts, and
   the class of every object. Content classes are what to carry over; decoration
   and page furniture are what the design system replaces.
3. **Compose from the slide master.** `lolly_compose` (or `lolly compose
   <spec.json> --source=<deck>`) lays each slide out from an archetype of the
   brief's master: you name the archetype and fill its slots, by text or by `from`
   an inventory object, and the master supplies margins, type, colour bars, page
   numbers and logo, with the bindings that give the `.pptx` real placeholders.
   `mode: "suggest"` (`--suggest`) drafts the spec from the deck; `lolly compose
   --help` and `reference/design.md` give its keys. What no archetype holds you
   write with the authoring keys, in a slide's `under` and `over` or as slides of
   your own: layers relative to the artboard with `$in`, text by style with
   `$style` (the brief's roles, or your own `$styles`), paths with `$points` or
   `$d`, and repeated rows with `$stack`, `$grid` and `$table`. They lower to plain
   layers, so do not restate defaults or add offsets by hand. Before you settle a
   text box, `lolly_measure_text` (or `lolly measure --text`) says where its lines
   break.
4. **Check the result.** `lolly_check` with `inventory` set to what `lolly_read`
   returned (or `lolly check <file> --source=<inventory.json>`) lists every source
   string missing from the result, every edited string, every speaker note not
   carried over and any change in slide count or order, beside the structure,
   brand, house-rule and Verify findings. A deliberate edit stays in the list, for
   the person to review; do not hide one.
5. **Hand over a file.** `lolly_package` (or `lolly package <file>
   --output=<name>.lolly --source=<deck> --asset=<key>=<picture>`) writes a `.lolly`
   the app reopens as the same document, with its pictures and its name (`label`);
   `--source` gives it the deck's own pictures. `lolly run <name>.lolly
   --export=pptx` exports it with the app's own exporter, which needs the web shell
   (`reference/recreate.md` says how to run one). One document serves light and
   dark when its colours are token references and its logos `?theme=auto`:
   `lolly run <name>.lolly --themes=light,dark --export=pptx --output=<name>.pptx`
   writes `<name>-light.pptx` and `<name>-dark.pptx`, and `lolly check --themes`
   checks it in each theme. A `.lolly` carries no design system, so when a
   `--file` system styled it, pass the same `--file` to `lolly run` and `lolly
   check`, and name that system at hand-over: the app opens the file in its own
   active system.

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
