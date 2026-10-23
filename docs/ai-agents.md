# AI agents

An AI agent is good at deciding what a file should say. Lolly is good at making that file look right, in your design system, the same way every time. The agent fills in a tool's inputs and Lolly draws the result, so layout, type and colour come from the tool and never drift.

No image model is involved. A finished QR code, badge, chart or slide deck comes back as a real file, with an editable link a person can open to adjust it by hand.

There are four ways to connect an agent to Lolly, and you can mix them:

::: cols
## A link

Every tool's settings fit in a URL. The agent writes the link and a person opens it to see the finished design, ready to export or edit. Nothing needs installing. See [URL Mode](/info/url-mode.html).

## The CLI

The same settings as `--name=value` flags, with the file written to disk. It runs on your own machine, so nothing leaves the device. See [the CLI](/info/cli.html).

## The MCP server

The agent calls Lolly's tools itself and gets the file back with an editable link: from the open endpoint on lolly.tools, from a full endpoint with a token, or from a server on your own machine. See [MCP Server](/info/mcp.html).

## An open document

The agent joins a document a person already has open and edits it alongside them, with each change shown in People and kept as an undo step. See [Agents in an open document](/info/open-document-agents.html).
:::

Start with the MCP server if your agent speaks MCP, and with a link if it can only write text.

## Your first render

In Claude Code, connect the open endpoint. It needs no account:

```bash
claude mcp add --transport http lolly https://lolly.tools/api/mcp
```

Then ask: "Use Lolly to make a QR code for https://example.com as an SVG." The agent lists the tools, reads the QR tool's inputs, renders it and hands back the SVG plus a link that opens the same design in Lolly. [Connect a client](/info/mcp.html#connect-a-client) has the setup for other clients and for the full endpoint.

An agent that can only write text does the same job with a link. This one opens the QR tool with the address already filled in:

```
https://lolly.tools/t/qr-code?url=https://example.com
```

![What /t/qr-code?url=https://example.com renders: the bare canvas, no chrome, straight from the parameters in the link](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Fexample.com%26full&width=1440&height=900&dpi=192&waitMs=2200&format=svg&cropSelector=%23tool-canvas&walker=1&filename=auth-url-render&try=1)

Add `&format=svg&export` and the file downloads as soon as the page opens:

```
https://lolly.tools/t/qr-code?url=https://example.com&format=svg&export
```

The same inputs work as CLI flags, which write the file instead of opening a page:

```bash
pnpm run cli qr-code --url=https://example.com/event --color=0c322c \
  --export=svg --output=./qr.svg
```

The CLI writes vector, data and PNG files from SVG-native tools with no browser. JPG, WebP, PPTX, video and most PDF go through the Lolly desktop app or the CLI's own headless Chromium; [Render with the CLI](/info/cli-rendering.html#what-the-cli-can-render) shows which needs which.

## Read a tool's inputs before you fill them

Do not guess parameter names. Each tool's manifest lists every input id, type and default, and it is served at `/tools/<id>/tool.json`. On the MCP server, `lolly_describe_tool` returns the same thing as a JSON Schema. On the CLI:

```bash
pnpm run cli qr-code   # prints inputs, defaults and supported formats
pnpm run cli           # lists every available tool
```

Feed that schema to the model so it only writes valid inputs. Anything that is not an input is a reserved parameter, such as `format`, `width` and `height`, or `export`. [Reserved URL parameters](/info/url-parameters.html) lists them all. Any name that starts with `_` is reserved too.

## Rules that save a round trip

Use the smallest path that answers the task:

1. Read the instance's discovery record, then ask only for the tool or format you need.
2. Describe the chosen tool or template and fill its declared inputs.
3. Render. `lolly_render` checks the inputs itself, so call `lolly_validate` separately only before you hand out a URL you built by hand.
4. Return the file, the editable link, the checks that ran and one next step.

For a known recipe, skip listing the whole catalog. For a revision, send the changed inputs or stable layer patches, not the whole document.

A result is complete when its declared checks pass. Ask a person to review only when the task names something this instance cannot measure, such as how a print looks on paper or whether someone approves. Otherwise report the result and carry on.

Report each result with one of six words: `complete`, `partial`, `approximate`, `blocked`, `failed` or `unknown`. Say what changed, what was kept, what was checked and what is still unknown. Never describe an unchecked property as passed.

A few more habits help:

- **Validate links you build yourself.** MCP compile, build and render calls refuse unknown fields and bad values with exact paths. A hand-written URL is read leniently for older links, so check one with `lolly_validate` before you share the link.
- **`_v` records a version; it does not pin one.** A newer tool still renders the link, and the CLI warns that it ignores `_v`. To catch a change from a tool update, render the same inputs again and compare.
- **Use catalog assets, not uploads.** A picture someone uploaded lives on their device and cannot travel in a link. Reference catalog assets by id; the MCP resource `lolly://assets` lists them.
- **One design, many outputs.** Change `format`, `unit` or `width` to get the same design as an SVG, a print PDF and a social MP4.
- **Short links.** Some tools define short `urlKey` aliases and tilde-separated lists; see [Inputs in URLs](/info/url-inputs.html).
- **Embed a render as an image.** `https://lolly.tools/tool/<id>.<ext>?<inputs>` with an image extension (`png`, `jpg`, `jpeg`, `webp`, `svg`, or animated `gif` and `apng`) drops into HTML as an `<img src>`. Inside the web app it renders on the device. On the open web, deployments that leave [hot-link render URLs](/info/mcp.html#hot-link-render-urls) switched on serve the browser-free formats for real, so the link works in a README or a wiki.

## When a tool will not hand back a file

- **Utilities that show rather than export.** `countdown-timer`, `strip-data`, `text-helper` and `compress-pdf` set `render.export: false`, so `&export` and `&copy` do nothing. `color-palette` is not one of them: the community Palette Lab exports images, PDF, palette files and data. A brand pack can narrow any community tool's formats, so read the manifest or `lolly_describe_tool` rather than assuming.
- **Experimental tools** (`status: "experimental"` in the manifest) watermark their exports by default until they are promoted. On-device utilities are exempt.
- **Tools that take your own file**, such as `strip-data`, transform bytes in memory. A file cannot travel in a URL, so use `lolly_transform` on the MCP server or the CLI.

## Why a tool beats an image model

| | Prompting an image model | Calling a Lolly tool |
|---|---|---|
| Quality | Layout, type and colour change from one attempt to the next | Fixed by the tool's author; a careless prompt cannot degrade them |
| Cost | A brief and a generation run to thousands of tokens | A tool call or a link is a handful of tokens |
| Repeatable | No two runs match | The same inputs give the same design; how far bytes match depends on the format ([byte-identical output](/info/cli-automation.html#how-far-byte-identical-output-goes)) |
| Privacy | The brief goes to the model's provider | A link or the CLI runs on the device; a hosted MCP endpoint receives what you send it |

## For machine readers

Each deployment publishes the same set of files for agents, at the site root and under `/info/`. An agent pointed at a self-hosted instance finds that instance's own endpoints in its own discovery record. Start with these rather than scraping pages.

::: details Machine-readable entry points
| File | What it is for |
|---|---|
| [`/agents.md`](/agents.md) | The short version of this page for a machine reader: entry points, the URL grammar, how to get bytes and the rules that save a round trip. |
| [`/llms.txt`](/llms.txt) | The docs index in the [llms.txt](https://llmstxt.org) convention: one line per page, linking its markdown twin. |
| [`/llms-full.txt`](/llms-full.txt) | Every docs page in one file, in the index's order. |
| [`/.well-known/lolly.json`](/.well-known/lolly.json) | The discovery record: where the catalog, the manifests, the render route, the MCP endpoints and the files above live on this deployment. |
| [`/openapi.json`](/openapi.json) | The HTTP surface in OpenAPI 3.1: the hot-link render route with its refusals, the catalog and manifest reads and the MCP endpoint's transport. |
| [`/info/capabilities.json`](/info/capabilities.json) | What Lolly reads and writes per format, and what each format's own metadata carries. |
| [`/catalog/tools/index.json`](/catalog/tools/index.json) | The generated tool index; `/tools/<id>/tool.json` is one tool's manifest with every input, default and format. |
| [`/info/skills/lolly/SKILL.md`](/info/skills/lolly/SKILL.md) | The agent skill: one page an agent loads to drive Lolly on every surface, with references for URL mode, the surfaces, the whole catalogue, the three document tools (chart, design, deck) and Rebrand. |

The docs build generates each file from the same sources as the pages people read.
:::
