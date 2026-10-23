# MCP Server

Connect an AI assistant or an agent runtime to Lolly and it can make finished, on-brand files for you: a QR code, a badge, a chart or a slide deck, as SVG, PNG, PDF and more. Every answer comes with an editable link, so you can open the result in Lolly and adjust it by hand.

The quickest start needs no account. In Claude Code, run:

```bash
claude mcp add --transport http lolly https://lolly.tools/api/mcp
```

Then ask: "Use Lolly to make a QR code for https://example.com as an SVG."

Behind that request the agent lists the tools, reads one tool's inputs, renders it and hands you the file. Tools are data, so a new tool reaches a server as a catalog update, with no change to the server's code.

Each server draws with the design system of its own content profile. The public server on lolly.tools uses Lolly Demo. Read the `lolly://design-context` resource to see which design system a server uses, with its colours, type, logos and house rules.

[AI agents](/info/ai-agents.html) compares this server with the other ways an agent can drive Lolly. This page is the reference for the server itself.

## Choose an endpoint

Every endpoint offers the same twenty-two tools. They differ in who can connect and which formats they can make, because only some run a headless browser.

| Endpoint | Who can connect | What it makes |
|---|---|---|
| `https://lolly.tools/api/mcp`, the **open** endpoint | Anyone. No token and no sign-in; calls are limited per address and per day (see [Limits on the open endpoint](#limits-on-the-open-endpoint)). | Vector (`svg`, `emf`, `eps`, `eps-cmyk`, `dxf`, `penpot`), data and text (`html`, `md`, `txt`, `json`, `csv`, `ics`, `vcf`) and, for SVG-native tools, `png` plus the float formats `exr` and `hdr` (with `hdr` set). |
| `https://mcp.lolly.tools/mcp`, the **full** endpoint | Whoever holds the access token from the operator, by OAuth or bearer. | Everything a tool declares: vector, every raster format, print PDF (CMYK and crop marks included) and animation and video (`gif`, `apng`, `webm`, `mp4`). |
| **Your own machine**, over stdio or local HTTP | You. No token is needed over stdio. | Every format, once the scoped browser is installed with `pnpm run mcp:install-browser`. In a checkout, the server builds the web shell it renders through on first use. |

Start with the open endpoint: it needs no setup and covers every SVG-native tool. Tools laid out in HTML, such as `design` and `chart`, draw in the browser tier, so rendering or looking at them needs the full endpoint or your own machine. So does print PDF. Large files and heavy automation also belong on your own machine.

::: details Limits on the open endpoint
`lolly.tools/api/mcp` is free to use and has a known daily cost, so these limits apply to it:

- **60 calls a minute per address.** A `429` carries `Retry-After`.
- **A daily budget for the whole endpoint**, shared by every caller: a fixed amount of compute and data transfer per UTC day. When the budget is spent, every call returns `503` with `error: daily_budget_reached` and a `Retry-After` that counts down to 00:00 UTC.
- **PNG up to 1600 x 1600 pixels of area** (enough for 1920 x 1080). A larger request is scaled down to fit, and the render result says so. Ask for `svg` for a file that scales to any size.
- **Response limits where the platform sets them.** A deployment that runs as serverless functions refuses an answer over 4.4 MB with a tool error. lolly.tools runs the endpoint as a long-lived service, which has no such cap. Anonymous calls never receive a server-held download link.
- **Decks up to 100 slides** per call, for `lolly_rebrand`, `lolly_read`, `lolly_check` and `lolly_compose`. A PDF counts its pages, and a source deck or inventory given to `lolly_check` or `lolly_compose` is held to the same limit.
- **Up to 262,144 characters of slide text measured** per `lolly_compose` call, counting each extra measure that `fit: "shrink"` makes. A text slot past that comes back unmeasured with a `compose.fit.unmeasured` note, and the result says how many slots were not measured.
- **Files up to 24 MiB** each for the tools that take a file, in one request of at most 32 MiB including the base64 encoding. A serverless deployment takes about 3.2 MiB, so that a file and its encoding fit its 4.5 MB request limit. A refusal gives the endpoint's exact figure in bytes.

Lolly on your own machine lifts these limits, except that a file can still be at most 24 MiB.
:::

A render on any endpoint runs **the same render path a person's export runs**. The server honours the full parameter contract (width, height, unit, dpi, colour profile, PDF password and, for the motion formats, `fps`, `seconds`, `wait`, `codec` and `vq`), and it never watermarks or embeds anything a person's own download would not. The same path and settings do not mean the same bytes for every format; see [how far byte-identical output goes](/info/cli-automation.html#how-far-byte-identical-output-goes).

## Connect a client

### The open endpoint (no token)

Point any MCP client that speaks Streamable HTTP at `https://lolly.tools/api/mcp`. There is nothing to sign in to:

```json
{
  "mcpServers": {
    "lolly": { "type": "http", "url": "https://lolly.tools/api/mcp" }
  }
}
```

In Claude Code the same connection is one command:

```bash
claude mcp add --transport http lolly https://lolly.tools/api/mcp
```

In a hosted assistant, add a custom connector with that URL and leave the OAuth fields blank. A quick check with `curl` (expect a JSON list of the twenty-two tools):

```bash
curl -s -X POST https://lolly.tools/api/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### The full endpoint (access token)

`mcp.lolly.tools` authenticates against a shared access token, which your Lolly operator holds. The token is never printed in a link or a log.

**As a custom connector (OAuth).** The full endpoint is a stateless **OAuth 2.1** authorization server, so it works with any MCP client that supports custom connectors:

::: timeline
- In your client's connector settings, add a custom connector pointing at `https://mcp.lolly.tools/mcp`. Hosted assistants usually put this under a *Connectors* or *Integrations* panel.
- Leave the OAuth Client ID and Secret blank. The server registers your client itself (dynamic client registration).
- The client finds the OAuth server and opens a consent page. Paste the access token and approve.
:::

Then ask the agent to *"list the Lolly tools"* or *"render the wordmark tool as a PNG."*

**With a bearer token (CLI or any HTTP client).** The full endpoint also accepts the raw token, so scripted clients skip the OAuth steps. Most MCP clients take a config entry like:

```json
{
  "mcpServers": {
    "lolly": {
      "type": "http",
      "url": "https://mcp.lolly.tools/mcp",
      "headers": { "Authorization": "Bearer <your-access-token>" }
    }
  }
}
```

A quick check with `curl` (expect a JSON list of the twenty-two tools, plus the `files_*` tools when the connection is scoped; no token returns `401`):

```bash
curl -s -X POST https://mcp.lolly.tools/mcp \
  -H "authorization: Bearer <your-access-token>" \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### Install Lolly in ChatGPT

ChatGPT connects to Lolly through a plugin, which lets it join a document someone invites it into. Pasting an invitation into a chat cannot install tools, so install the plugin first.

Open **Plugins** in ChatGPT, choose **Create custom MCP server**, name the plugin **Lolly** and set the server URL to `https://lolly.tools/api/mcp/agents`. Choose **No authentication**, review the connection notice and create the plugin. Install the resulting plugin, then enable Lolly in your conversation. Account and workspace policies decide whether custom MCP connections are available. See [OpenAI's connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt).

Then copy a fresh invitation from **Share** in the open document and give it to ChatGPT. [Agents in an open document](/info/open-document-agents.html) covers the invitation, what the agent can do and how to pause or disconnect the agent.

The installed plugin has no account-wide credential: each invitation selects its instance, document and permissions. It works with public HTTPS Lolly relays on any domain, including lolly.ing. Calls to private networks and local addresses need the local MCP server instead. Directory publication is separate from installing a custom MCP server: Lolly's stable plugin identity is on lolly.tools, and a document invitation selects the instance where the work happens.

::: details How the hosted connector handles a call
The hosted connector keeps no active document or invitation between calls, so the agent passes the same `invitation` on every call. The relay keeps the connection while the editor stays open. Editing requires `documentId`, `ifRevision` and `transactionId`; retry with the same arguments. An ended invitation grants no access.

The connector uses the public gateway's durable request limits and usage budget, and refuses requests when admission is unavailable. Outbound calls pin a checked public DNS address, verify TLS for the original hostname, refuse redirects and carry only the document bearer capability. Operators can switch the connector off with `LOLLY_DISABLE_AGENT_CONNECTOR=1`.
:::

::: details Plugin use
Lolly's software uses the [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/), including its permissions, conditions, warranty disclaimer and limits of liability. Documentation uses [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Assets have their own licenses. Using the plugin does not change your rights in your content or grant rights in somebody else's assets. Check agent edits before sharing them. Your agent provider and a private instance's operator may have their own terms.

Installing the plugin grants no account-wide access. Keep invitations private. Document data passes through the connector and invitation relay to your agent provider; see the [privacy policy](/info/privacy.html). Report setup problems through [Lolly's issue tracker](https://github.com/lolly-tools/lolly/issues), and leave private invitations and document content out of public reports.
:::

### On your own machine

From a checkout, `pnpm run mcp` starts the server over stdio, with no token. The local server lists the twenty-two tools, the six `files_*` tools and the nine live tools that join an open document ([Agents in an open document](/info/open-document-agents.html)). `pnpm run mcp:http` runs the long-lived HTTP service instead. [Run the server yourself](#run-the-server-yourself) covers hosting one for other people.

## How an agent uses the server

The server's own prompts walk an agent through the same order:

::: timeline
- <!--i:search--> **Find a tool.** `lolly_list_tools`, usually with a focused `q` and a small `limit`.
- <!--i:document--> **Read its inputs.** `lolly_describe_tool` returns the exact input schema, formats, templates and examples.
- <!--i:check--> **Check, when needed.** `lolly_validate` before you hand out a URL you built yourself. `lolly_render` checks inputs on its own.
- <!--i:download--> **Render.** `lolly_render` returns the file and the editable link.
- <!--i:seal--> **Prove it, when asked.** `lolly_verify` shows that a file the agent holds is an untouched Lolly export.
:::

Every input and export control is a URL parameter, defined by [URL mode](/info/url-mode.html) and [Reserved URL parameters](/info/url-parameters.html). The MCP `query` argument, a share link, the CLI's `--flag=value` pairs and the hot-link render URL are one contract under four transports, so an agent that has learnt the table has learnt all four. The reserved parameters an agent reaches for most are `format`, `width`, `height`, `unit` and `dpi`, `profile`, `password`, `bleed` and `marks`, the provenance switches (`c2pa`, `imprint`, `durable`, `meta`), `_madewith` (the [design-system record](/info/exporting.html#the-design-system-record), on unless `_madewith=0`), `hdr` and `depth`, `cuts`, `s`, `lang`, `emoji` and `emojifx`, plus `fps`, `seconds`, `wait`, `codec` and `vq` for the motion formats.

Formats are per tool: you can only ask for one the tool declares, and `lolly_describe_tool` lists them. The call is the same whether you ask a QR tool for `svg` or an animated tool for `mp4`; the server decides how to produce the file. [Every format Lolly can open and make](/info/formats.html) lists them all. To ask whether Lolly reads or writes a format, call `lolly_list_tools` with a format filter, or fetch [`/info/capabilities.json`](/info/capabilities.json). There is also a page for every format at `/info/formats/<token>/` and one for each common conversion at `/info/convert/<in>-to-<out>/`.

::: details One vocabulary across the CLI and this server
`lolly_verify` and the CLI's `lolly validate --json` answer the same question in the same words. Both report a `verdict` slug from one shared table (`made-with-lolly`, `delivered-by-lolly`, `likely-made-with-lolly`, `credential-expired`, `credential-intact`, `credential-broken`, `no-credential`) alongside `resolved` (the engine's semantic verdict) and the full verifier `report`. The slugs are frozen: an existing one is never re-pointed, and a new engine state adds a new slug, so a consumer needs a default branch and nothing else.

One predicate decides when a call needs the browser tier, shared by the CLI, the TUI and this server, keyed on a typed `NEEDS_BROWSER` marker rather than on the wording of an error. The open endpoint's "that needs the browser tier" refusal and the CLI's exit `3` are the same judgement.
:::

## The twenty-two tools

**Discover and describe:**

| Tool | Does |
|---|---|
| `lolly_list_tools` | List or search the catalogue by text, status, category, format or capability. `limit` keeps the matches small. |
| `lolly_describe_tool` | One tool's input JSON Schema, formats, canvas size and examples, plus `emojiSets`, the emoji sets this deployment registers. |

**Check and inspect a document before you spend a render:**

| Tool | Does |
|---|---|
| `lolly_validate` | Check tool inputs, and Design structure, with path-specific errors and warnings. Draws nothing. |
| `lolly_compile` | Compile a hydrated document without rasterising. |
| `lolly_inspect` | The semantic read model of a document, or of a file you supply, without rasterising. |
| `lolly_measure` | Sizes, counts and duration of a document, without rasterising. |
| `lolly_diff` | A semantic diff of two compiled documents or recipe query strings. |
| `lolly_package` | A Design document as a `.lolly` the app reopens as the same document, with its pictures and name. |
| `lolly_measure_text` | Where a plain Design text layer's lines break and how tall it is, before it is drawn. Works on the open endpoint. |
| `lolly_compose` | Slides laid out from the slide master's archetypes, as a Design document. |

**Explain the design system:**

| Tool | Does |
|---|---|
| `lolly_inspect_tokens` | Why a design token has its value, without rendering. Writes nothing. |

**Build a link or render:**

| Tool | Does |
|---|---|
| `lolly_build_url` | A shareable, editable link and a raw render URL, without rendering. |
| `lolly_render` | Render a tool to a file. Returns the bytes and the editable link. |

**Look at a render in its own coordinates:**

| Tool | Does |
|---|---|
| `lolly_look` | The render with a labelled grid, or one region enlarged to read small type. For looking only, never an export. |
| `lolly_sample_color` | The colours at points, each compared with the active design system. |
| `lolly_trace_edges` | The edges in a render or image as polylines in document units, longest first. |

**On-device file utilities (bytes in, bytes out):**

| Tool | Does |
|---|---|
| `lolly_transform` | Run an on-device file utility (`strip-data`, `compress-pdf`) on a file you supply. |
| `lolly_redact` | Destroy regions of an image, SVG or PDF you supply. |
| `lolly_verify` | Verify a file's Content Credentials (C2PA). |
| `lolly_rebrand` | Renovate a PowerPoint deck you supply into this server's design system, in stages. |
| `lolly_read` | Read what a deck you supply says (`.pptx`, PDF or Photoshop `.psd`), slide by slide. |
| `lolly_check` | Check a Design document, a `.lolly` or an export with every check Lolly has, in one findings list. |

On an authenticated connection with a file scope, six more tools appear for importing a private file once and working on its handle: `files_import`, `files_list`, `files_download`, `files_convert`, `files_report` and `files_delete`.

::: details What the tool arguments take
- **`lolly_measure_text`** returns each line with its width and a `nearEdge` flag, the height, the `scrollHeight` the canvas reports and, with `height`, whether the box clips the text. Pass `text` and `width` (plus any of the layer's fields, or a `style` id to measure it as an authored layer), or a `document` to measure every plain text layer. The same measure as `lolly measure --text --json`. It reads no file.
- **`lolly_package`** takes `document` (a boxes array, `{boxes}` or `{values: {boxes}}`) or `toolId: "design"` with `inputs`. `assets` carries the bytes of each placeholder picture, base64, by the `image` value that draws the picture. `source` is a deck whose pictures resolve `user/media/<sha256>` references and the `photo:<12 hex>` keys `lolly_compose` suggests; `label` is the name. Every other picture must be a catalog id of the server's profile, and anything unresolved is refused unless `allowMissingMedia`. It returns the file and a report of what was carried and read back, the same report as `lolly package --json`. A compiled document of another tool is packaged as before and answers `{legacy: true, manifest}`.
- **`lolly_compose`** takes a `spec` (`slides`, each with an `archetype` and its `slots`) and, for `from` references and notes, the deck's `inventory` or the deck itself as `source`. It returns the document, a report of what each slide filled and dropped and which text slots clip (`fit: "shrink"` steps them down), the source wording the slides change as `edits` for `lolly_check`, and the pictures named. `mode: "list"` returns the archetypes; `mode: "suggest"` a first spec for a deck. The same composer as `lolly compose --json`.
- **`lolly_inspect_tokens`** reports the effective theme choices (one per group, which fell to a default and the set order). It also lists issues such as missing references, cycles and unknown choices, plus a page of tokens with resolved values (`query`, `type`, `set`, `issuesOnly`, `offset`, `limit`). With `token`, it adds the authored and resolved value, the winning set and override order, the roles the document declares and a bounded trace of the tokens it reads and the tokens that read this one (`depth`, 8 by default). It reads this server's design system, the one `lolly://design-context` describes, or a `tokens` document you pass; `selection` takes a render link's `_themes` object and `theme` one theme name. Choices are a preview. The same report as the TUI's token inspector.
- **`lolly_look`** numbers its grid in document units: for Design, the artboard pixels a layer's `x`, `y`, `w` and `h` use, so a position read off the picture can go straight into `layerPatches`.
- **`lolly_sample_color`** averages each point over a small disc and gives the nearest colour token, its distance in OKLab (ΔE; about 0.02 is just noticeable) and whether that is a match.
- **`lolly_trace_edges`** with `asDesignLayers` also returns each line as a Design path layer, ready for `layerOperations` once it has an id.
- The three looking tools take a source the way `lolly_render` does, or a file you supply (PNG, JPEG, GIF, WebP or SVG, measured in its own pixels). A supplied SVG may only carry images inside itself: a reference to any other file is dropped before drawing.
- **`lolly_redact`** takes the same instruction string a share link carries (`bars=1,40,60,200,24~…`), so one string can be applied to every file of an identical layout. The tool rebuilds the file and re-checks its own output; a failed check returns an error with no file attached.
- **`lolly_verify`** returns the verdict, signer identity, edit history and embedded metadata, including any AI-generated declaration and appended-data flags. It is the same C2PA verifier as the CLI's `lolly validate`. The web Verify page's pixel-level reads (the Lolly Imprint, SEAL, the opt-in deep scan) are interactive and web-only. The file is checked in the server process and never stored.
:::

## Recipes

### Edit a Design document by layer id

For Design, start from `templateId` plus an optional `presetId` and a small set of input overrides; `lolly_describe_tool` lists those starting points. The same arguments work with validate, compile, inspect, measure, URL building and render. Inspect the template once to find its stable layer ids, then send `layerPatches: [{ "id": "s1title", "set": { "text": "Your title" } }]` to replace content without resending layer geometry. An agent can start from a slide deck or a square poster without inventing raw coordinates.

Use `layerOperations` to change the layer set itself. It supports strict stable-id `add`, `duplicate`, `remove`, `reparent` and `reorder` operations. Reorder anchors must be siblings. Reparent keeps the layer's geometry and accepts a destination `artboardId` (`null` means the pasteboard), plus an optional destination sibling anchor. Every duplicate takes an explicit `newId`; duplicating a non-empty artboard also needs a complete `childIds` map. Removing a non-empty artboard needs `cascade: true`. Operations run before `layerPatches`, so a newly created or moved layer can be patched in the same call:

```json
{
  "toolId": "design",
  "templateId": "slide-deck",
  "layerOperations": [
    {
      "op": "add",
      "layer": { "id": "s1-kicker", "kind": "text", "frame": "slide1", "text": "Draft" },
      "afterId": "s1title"
    }
  ],
  "layerPatches": [
    { "id": "s1-kicker", "set": { "text": "Agent-added context" } }
  ]
}
```

### Rebrand: renovate a deck, in stages

`lolly_rebrand` reads a `.pptx` you supply and turns it into this server's design system: colours, fonts and logo snapped to the system, decoration and page furniture pulled out. It runs the same node pipeline as `lolly rebrand` on the CLI, so a plan made on one compiles on the other, as long as both read the same design system; otherwise compile refuses it with `plan.design-system-mismatch`. It runs no browser and needs neither endpoint's browser tier, so it is available wherever the MCP server runs.

**On `mcp.lolly.tools` and `lolly.tools/api/mcp`, calling `lolly_rebrand` uploads your deck to Lolly's server.** It is processed in memory for that call only and not kept. Each endpoint takes a deck of up to 24 MiB, or about 3.2 MiB on a serverless deployment, where the deck and its base64 encoding must fit one request. For a larger deck, run `lolly rebrand` on the CLI. `lolly_read`, `lolly_check` and `lolly_compose` also send a deck you pass them to the server.

::: timeline
- **`{stage: 'capabilities'}`** first, on a server you have not used. It states in a plain sentence where the file goes. A local server (stdio, or an HTTP server on a developer's own machine) keeps it in that process. A hosted server says that calling the tool sends the file there, processed in memory for that call with nothing kept, and gives its byte and slide limits and, on a serverless deployment, the platform's request-size ceiling. `ocr` is `false` on every server: this pipeline reads no text out of pictures.
- **`{stage: 'plan', file}`** returns the review queue, the counts and the plan itself (as a JSON resource when it is too large to inline). Edit that plan rather than making a new one.
- **`{stage: 'compile', file, plan}`** turns it into a Design document (`.lolly`) and, with `export: 'pptx'`, a native PowerPoint file. A plan compiled against different bytes than it was made from is refused (`plan.hash-mismatch`), not reconciled.
- **`{stage: 'inspect', plan}`** pages through a large plan's queue and slides without pulling the whole plan back.
:::

The agent skill's [Rebrand reference](/info/skills/lolly/reference/rebrand.md) walks an agent through the stages and the plan's fields.

### Read a deck, check a recreation

When an agent rebuilds a deck in Design rather than renovating it with `lolly_rebrand`, three calls carry the work:

::: timeline
- <!--i:document--> **Read `lolly://design-context`.** The design brief: approved colour pairings, type per role, logos per surface, icons, the slide master and the brand's house rules.
- <!--i:search--> **Read the source.** `lolly_read` gives the source deck's content.
- <!--i:palette--> **Write the document.** Compose, measure and package it (next section).
- <!--i:check--> **Check the result.** `lolly_check` against the source or its inventory.
:::

`lolly_read` takes `{file}` and returns the content inventory (schema `content-inventory-v1`) with counts per kind: text in reading order with roles and runs, speaker notes with paragraphs and line breaks kept apart, pictures by content hash with placement and crop, tables and charts as data, plus the class of every object. An inventory over 128 KB comes back as an embedded JSON resource instead of inside the structured result. Pictures come back as facts (hash, type, size, placement); `media: "inline"` also returns the bytes of each distinct picture, one embedded resource each. No text recognition runs, so a slide that is one picture of a slide reads as a picture (`ocr` is `false`). The same reader as `lolly read --json`.

`lolly_check` returns the same report `lolly check --json` writes (schema `check-report-v1`): five families (`structure`, `render`, `brand`, `verify`, `fidelity`), each `ran`, `skipped`, `unavailable` or `failed` with a reason, and one findings list. Each finding has a stable `code`, a `severity`, the `layerId` where there is one, the message the app shows and a `fix` where one is safe. Findings are data, so the call is a tool error only when the request or the file cannot be read.

The render family (clipped text, contrast and font coverage on the painted page, with the document's pictures painted) needs the browser tier. On `lolly.tools/api/mcp` it reports `unavailable` and the other families still run. Verify runs with text recognition off on every server. On a hosted server the file and the source travel in one request, so pass the `lolly_read` inventory rather than the source deck there.

::: details What lolly_check takes and the exit codes it reports
`lolly_check` takes exactly one of `file` (a Design document, a `.lolly` or an export), `toolId: "design"` with `inputs`, `templateId`, `layerOperations` and `layerPatches` as `lolly_render` takes them, or a compiled `document`.

Add `source` (a deck) or `inventory` (what `lolly_read` returned, or the whole `lolly_read` result it came in) to check fidelity. With either, `edits` (a list of `{ source, result, reason }`) records wording you meant to change: those findings stay in the report as `info`, marked excepted, and are listed under `fidelity.excepted`, never as passed.

`theme` checks the document in one token theme, its linked colours resolved there. `themes` (a list of theme names, or `"all"`) checks it in each in one report: the render, brand and Verify families run in each theme and their findings carry the `theme` they were found in, while structure and fidelity run once. A link that does not resolve in a theme is a `brand.token-link.unresolved` warning. Give one of `theme` and `themes`, not both.

`exitCode` is the code the CLI would exit with:

| Code | Means |
|---|---|
| `0` | Clean |
| `5` | Findings to review |
| `4` | An error finding, or any warning with `strict` |
| `3` | `browser: "require"` and no browser is available to render the document. An export has no render family, so the requirement does not apply to an export |
| `1` | A family that failed, or an export with no page that could be decoded |
:::

### Compose, measure and package a Design document

Between the read and the check, the agent writes the Design document. For slides, start with `lolly_compose`: it lays each slide out from an archetype of the design system's slide master, with the master's margins, type, furniture and bindings. Because composed slides keep their master bindings, `lolly_check` judges them by the master's house rules, and their PowerPoint export has real slide layouts and placeholders.

::: timeline
- **`mode: "list"`** returns the archetypes and their slots.
- **`mode: "suggest"`** with the `inventory` (or the deck as `source`) drafts a first spec.
- **The edited `spec`** with the same `inventory` composes the document.
:::

A spec gives an `archetype` per slide and fills its `slots`, by text or by `from` an inventory object. `source` on a slide carries that slide's notes. `join` on a slot (`{from, join: ": "}`) runs a heading's lines into one. `cells`, `ground`, `furniture`, `emphasis`, `case`, `under` and `over` cover the rest. `themes: ["light", "dark"]` on the spec makes one document that serves both themes: logo furniture as `<id>?theme=auto`, and the master's token colours and the `under` and `over` token references stored as literals plus links. `furniture`, `emphasis` and `case` at the top of the spec are deck defaults that each slide merges over. The schema is `https://lolly.tools/schemas/design-compose-v1.schema.json`, described in the agent skill's Design reference.

The result is the document, a report of what each slide filled, dropped and clipped, the `edits` to give `lolly_check` (each with a generic reason to replace) and the pictures it names. A hosted server receives a deck passed as `source`; pass the `lolly_read` inventory there instead.

For what no archetype holds (a slide's `under` and `over` rows) and for slides written by hand, rows may carry **authoring keys**, which all start with `$`: `$in` gives a layer's position relative to its artboard, `$style` sets its text by a style from the design brief (`title`, `subtitle`, `body`, `caption`, `label`, `quote`, `number`, `attribution`) or from `$styles` beside `boxes`, `$points` and `$d` draw a path in px, and `$stack`, `$grid` and `$table` lay out repeated rows. Every tool that takes a Design source lowers them first, to ordinary layers in global canvas coordinates with every text field written out: in `inputs.boxes`, in an `add` operation's `layer` and in a patch's `set`. They are never stored. A key that cannot be lowered is an error with the JSON pointer of the key, and `lolly_check` reports it as a `design.authoring.invalid` finding. `lolly_compile` and `lolly_validate` return any notes the lowering made under `authoring`. The keys are described in the agent skill's [Design reference](/info/skills/lolly/reference/design.md), and their schema is `https://lolly.tools/schemas/design-authoring-v1.schema.json`.

`lolly_measure_text` answers where a text box's lines break before it is placed, with the faces the canvas loads. A line marked `nearEdge` is within a few px of breaking another way, so widen that box rather than trust the fit. `lolly_package` then writes the `.lolly` a person opens in the app. On a hosted server the pictures and the source travel in one request, and the `.lolly` comes back in one answer (at most 4.4 MB on a serverless deployment), so package a large deck with `lolly package` on the CLI.

### Redaction needs the full endpoint

`lolly_redact` rebuilds real pixels (a canvas for images, a page render for PDFs), which the browser-free tier cannot do. On the **full** endpoint it runs in the same browser path a person clicks in the app, including the tool's own export gate. On the **open** endpoint it returns an error saying the browser tier is not available there, rather than handing back a file that was never redacted. `lolly_transform` behaves the same way for any utility that rebuilds pixels; the metadata-only utilities (`strip-data`, `compress-pdf`) still run browser-free.

## What a render records

**The design system and colourway.** A render records the [design system and colourway](/info/exporting.html#the-design-system-record) that drew the file, in its metadata and its Content Credential, as an export from the app does. The result reads the delivered bytes back and prints the words the file carries, such as `Recorded the design system: Lolly Demo · Colourway: Beach.` Pass `madeWith: false` to `lolly_render` or `lolly_build_url` to leave the record out; the link then carries `_madewith=0`, so the file and the link agree.

**Songs.** A video or audio file that plays a rondocode song records each song in its Content Credentials: its name, a hash of its source and how Lolly's sandbox rendered the song. The result reads the delivered bytes back and states, on a `Songs:` line, which songs the credential records and any it does not. `lolly_transform` adds no credential, so its result says the file records none of its songs.

### Emoji: name the set you want drawn

Emoji in a render are drawn from a set somebody chose, never from the machine the server happens to run on. `lolly_render` and `lolly_build_url` both take two optional arguments for that choice and read them the same way, so a link and the file it renders agree:

| Argument | Takes |
|---|---|
| `emoji` | The set: `<id>@<version>` (`community/emoji/twemoji/color@17.0.3`), its last two segments (`twemoji/color@17.0.3`), or a bare id when exactly one version is registered. |
| `emojifx` | The brand treatment for that artwork: `original`, `snap`, `mono`, `duotone` or `influence:<1-9999>` basis points, with an optional `,unprotected` to treat skin tones, flags and custom symbols too. The convenience form reads the current brand; generated links also pin the exact palette in `emojistyle`. |

`emojistyle` adds the exact style snapshot, including checksums, ordered fallbacks and palette. All three use the reserved URL parameters of the same name, so the same strings work in a share link, as `lolly --emoji=… --emojifx=…` on the CLI and here. They travel in the link either call returns, so a person who opens the link sees the artwork the agent rendered.

Call `lolly_describe_tool` first and read **`emojiSets`**: one row per registered set with its `id@version`, label, glyph count and licence. Choosing a set is choosing a licence, which is why the licence is in the list. A set nobody registers comes back as a usage error listing the ones that are, rather than a picture that arrives without the artwork you asked for.

- **With no `emoji` argument, every emoji draws as a neutral placeholder.** Nothing falls back to the operating system's emoji font, on any surface.
- **Simple SVG text uses shaped outlines and pack artwork.** Unsupported positioning, bidi or missing fonts produce a neutral placeholder with a layout diagnostic. `emojifx` with no `emoji` picks a treatment with no artwork to treat, and is reported as a warning.
- **The sources are recorded.** A render that placed pack artwork reports the pack's credit and licence in its `Rights:` line, and writes one Content Credential source per distinct glyph where the format can carry one. A browser-tier render establishes the same census on the server, so a PDF or an MP4 records its sources too.

## Resources and prompts

Agents should not guess asset ids or brand colours. Alongside the tools, the server exposes read-only **MCP resources**. Read `lolly://skill` first:

| Resource | Contents |
|---|---|
| `lolly://skill` | The Lolly agent skill (Markdown): the shared workflows and design-system setup. |
| `lolly://skill/{path}` | One reference or example file from that skill, such as `reference/design.md`. |
| `lolly://tool/{id}/skill` | Guidance for one tool, matched to the tool revision this server runs, with its references and version. |
| `lolly://design-context` | The design brief for this server's design system: resolved tokens, source evidence, coverage and brand rules, plus approved colour pairings, type per role, logos per surface, icons and their themes, media families, the slide master and machine-checkable house rules. The same brief `lolly system context --json` prints, with `origin` giving where its tokens came from: always the server's content profile and its head tokens asset, the design system `lolly_check` checks against. The CLI tries `--file` and the terminal's active system before the profile; the server reads neither. Read it before composing, and before `lolly_check`. |
| `lolly://catalog` | The full generated tool index. |
| `lolly://assets` | Every catalog asset id with its type, name, tags and formats. Enumerate here first, so you never invent an id. |
| `lolly://tokens` | The brand's design tokens (DTCG): named colour swatches with CMYK. |
| `lolly://tool/{id}` | One tool's manifest summary, input JSON Schema and examples. |
| `lolly://tool/{id}/preview` | The tool's committed catalog preview (SVG), where one exists. |
| `lolly://asset/{id}` | A catalog asset (logo, palette, font) resolved to bytes. |

The intended pairing: read `lolly://assets` once, then pass a real id to any `asset`-typed input in `lolly_render`.

The server also publishes **MCP prompts**, for clients that show them as slash commands or quick actions:

- **`create-branded-asset`**, the generic guided workflow: give it a plain-language `brief` (and optionally a `format`) and it walks the agent through picking a tool, reading its schema, rendering and sharing the editable link.
- **One prompt per featured tool**, named by tool id and built from the live catalog at request time. Its arguments are the tool's inputs (required ones first), its description is the tool's blurb and its message includes the tool's example looks. Nothing is hardcoded, so a newly featured tool gets a prompt automatically, and a pinned prompt keeps working even if the tool later leaves the featured set (only the listing is curated).

## Hot-link render URLs

Alongside the MCP endpoints, a deployment can answer the canonical embed URL directly:

```
GET https://<host>/tool/<tool-id>.<ext>?<inputs>
```

This is the raw render URL `lolly_build_url` returns. Drop it into a README, a wiki, a Notion page or a dashboard as an `<img src>` and it serves real bytes, with no token. The route is per deployment, and it is **live on lolly.tools**.

A GET's query string ends up in the host's access logs, and a link's inputs can carry personal data, so give a hot-link URL only what you would put on a public page. Fetching one sends the server nothing but what is written in the URL: your on-device documents, sessions and uploads can never appear in one. The [privacy policy](/info/privacy.html) says what the host keeps.

Its scope is narrow:

- **No auth, no accounts, no state.** It renders public tool and catalog data only, and nothing is stored per request.
- **Official and community tools only.** Anything else is a 404.
- **Browser-free formats only**: `svg`, `emf`, `eps`, `eps-cmyk`, `dxf`, `exr`, `hdr`, `penpot`, `html`, `md`, `txt`, `json`, `csv`, `ics`, `vcf`, plus `png` for SVG-native tools such as `qr-code`. A format that needs the browser tier returns a `400`; use `lolly_render` or the app for those.
- **Content Credentials are off here**, because each signing changes the bytes. Public calendar files use the catalog's build time for `DTSTAMP`, and an empty Calendar start date uses that build's date at 09:00, so set the event date explicitly when sharing a calendar link. Authenticated `lolly_render` and local exports keep their usual export behaviour.
- **Rate-limited per address**, against the same daily budget as the open MCP endpoint. A `png` is capped at 2048 x 2048 pixels of area.
- **Themes.** `_themes`, the theme per token group as JSON (`_themes={"":"dark"}`), renders a tool this route can draw, such as `qr-code`, with its token colours in that theme. A value that is not such JSON is a `400`, and a choice the design system does not declare draws that group's default theme with no warning. Design needs the browser tier, so this route refuses a Design document in any theme; export one in each theme with `lolly run <file.lolly> --themes=light,dark` on the CLI.
- **Canonical URLs.** Parameters are sorted and unused transport parameters are removed with a `308` redirect. A packed `z=` stays packed with its original encoded bytes; the redirect never expands a large document into the URL.
- **`noindex`.** Search engines do not index your renders.

The route's parameters, refusals and headers are described in OpenAPI 3.1 at [`/openapi.json`](/openapi.json). An operator switches the route off with `LOLLY_DISABLE_RENDER_GET=1`, and every such URL then returns 404.

## Authentication and security

- **Open only when an operator chooses.** With no token configured the endpoint returns `401`, so a missing setting never opens a server by accident. An operator opens one by setting `LOLLY_MCP_ALLOW_ANONYMOUS=1`, as lolly.tools does for `lolly.tools/api/mcp`. An open endpoint serves no OAuth routes, and it limits calls by the caller's address, so an invented `Authorization` header buys no extra calls.
- **A known worst case.** A hosted endpoint counts the CPU time it uses and the bytes it sends per UTC day, and refuses work once either total reaches its ceiling. [Budgets and rate limits](#budgets-and-rate-limits) has the settings.
- **Stateless OAuth 2.1.** The client registration, authorization code and access and refresh tokens are all short-lived **signed values**, verified with a shared secret on each call; nothing is stored on the server. PKCE (S256) protects the flow, so a captured link cannot be replayed.
- **The token stays out of band.** It is the bearer for scripted clients and the passphrase on the consent page. It never appears in a render URL or a log line.

The MCP server has no persistent render history. For retained render jobs and batches, retry and cancellation, governed delivery and audit records, an organisation can run Lolly Work, which has its own `lw` client, HTTP API, authentication and permissions; see [Organisation jobs](/info/cli-automation.html#organisation-jobs-with-lolly-work). Connecting an agent to this server does not grant access to a Lolly Work catalog or apply that organisation's policy.

## Run the server yourself

The full endpoint is the one part of Lolly that runs as a **server-side add-on** rather than on the device. Producing the full format range means driving a headless browser against a built web shell, so it runs as a hosted service (a container or a worker), not offline or at the edge. The on-device shells, the [web app](/info/using.html), desktop, mobile and the [CLI](/info/cli.html), remain the offline and air-gapped path.

You can still run the full server yourself, fully air-gapped included, as a container that ships the scoped Chromium and a prebuilt web shell. See the [Build Guide](/info/build-guide.html) and the deployment notes in `services/mcp/`. `pnpm run mcp:http` runs the long-lived HTTP service from a checkout.

### Private download links for large results

On a self-hosted, authenticated HTTP gateway, an operator can return large files as private download links instead of inline base64. Files over 1 MiB that a tool returns become MCP `resource_link` blocks. Download the link with the **same MCP bearer** used for the tool request. The link expires after **five minutes**, and a process restart discards the download. A copied link without that bearer grants no access. Store the downloaded file, and keep temporary `dt=` URLs out of documents, packs and asset references.

::: details Turn on private download links
Set `LOLLY_MCP_PRIVATE_FILES=1`, configure `LOLLY_MCP_TOKEN` and `LOLLY_MCP_PUBLIC_ORIGIN`, and run a single replica (`LOLLY_MCP_REPLICAS=1`). With Helm, use `mcp.privateFiles.enabled: true` and `mcp.replicaCount: 1`. The chart refuses multiple replicas and uses a Recreate update, because files belong to one process. The feature is off by default, unavailable on a serverless deployment and never enabled for anonymous callers.

Private file tools also offer `files_download` for an imported or converted handle. `resources/read` keeps its 4 MiB inline limit; the download tool can return a larger result without embedding it in JSON. Handle ownership and integrity checks still apply.

Held results are limited to 64 MiB per bearer, 256 MiB across the gateway and 200 pending or held files. Temporary files use a private directory and are removed after expiry or shutdown. The daily budget counts bytes when held and when downloaded, using decoded sizes so compression cannot bypass the ceiling. Downloads have `private, no-store`, a byte digest ETag, `no-transform` and `Referrer-Policy: no-referrer`. Signed files are delivered unchanged.
:::

### Budgets and rate limits

::: details The settings
- **Daily budget.** `LOLLY_BUDGET_CPU_SECONDS_PER_DAY` and `LOLLY_BUDGET_EGRESS_MB_PER_DAY` set the ceilings. On a hosted server (`NODE_ENV=production` or `LOLLY_MCP_HOSTED=1`) they default to 240 seconds of CPU and 1,024 MB of data sent per UTC day. Elsewhere they are off until you set them, and `0` turns a ceiling off.
- **Rate.** `LOLLY_MCP_RPM` sets the calls a minute per caller: 60 on an open endpoint and 120 with a token, by default.
- **PNG area.** `LOLLY_MCP_MAX_RASTER_PIXELS` sets the PNG area cap.
- **Store.** The budget and the rate limits share one store: any Redis-compatible HTTPS REST store, set with `LOLLY_RATE_LIMIT_REST_URL` and `LOLLY_RATE_LIMIT_REST_TOKEN`.
:::

### Caching

::: details Cache rules for public renders and the image proxy
A shared cache may hold public renders for one day, then serve them stale for up to seven more days while refreshing. Operators who need an immediate update use a release-specific cache key or purge the render's tool, engine and catalog tags. Intermediaries must keep decoded bytes intact. The origin compresses text over 1 KiB when the client accepts gzip or Brotli; compressed responses use weak ETags over the decoded representation.

The image proxy follows its upstream's cache rules, capped at one hour. Private responses, cookies, signature-like URL parameters and private redirect hops prevent shared caching. A source that gives no usable freshness is revalidated rather than assigned a new cache lifetime.
:::

The agent relay that lets an agent join an open document runs from the same service; [Run a document relay](/info/open-document-agents.html#run-a-document-relay) covers its setup.
