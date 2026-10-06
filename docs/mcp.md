# The Lolly MCP server

Lolly ships a native **[Model Context Protocol](https://modelcontextprotocol.io) server** - a single endpoint any MCP client (an agent runtime, an IDE, a CLI, a hosted assistant) connects to directly. It exposes the tool catalogue and the render path as callable tools, so an agent can discover a tool, fill its declared inputs and get back a finished file plus an editable `lolly.tools` link. Because tools sync to the server as **data**, new tools appear with no server update.

It is the programmatic sibling of [driving Lolly from a URL](/info/ai-agents.html): same render path, same reproducible output - just reached over MCP instead of a hand-built link.

**Asking what Lolly converts.** An agent that wants to know whether Lolly reads or writes a given format does not have to scrape a page. Call `lolly_list_tools` (it filters by format and capability), or fetch the static [`/info/capabilities.json`](/info/capabilities.json) - a machine-readable list of every format, whether Lolly opens it, makes it, or both, and the features each one carries. There is also a plain-language page for every format at `/info/formats/<token>/` and one for each common conversion at `/info/convert/<in>-to-<out>/`.

## Two hosted endpoints

The render path has two tiers, so there are two endpoints with the same tools. They differ in two ways: which output formats each can produce, and who can connect.

| Endpoint | Tier | Access | Produces |
|---|---|---|---|
| `https://lolly.tools/api/mcp` | **Lightweight** (serverless, no browser) | **Open to anyone.** No token and no sign-in; calls are limited per address and per day (see [Limits on the open endpoint](#limits-on-the-open-endpoint)). | Vector (`svg`/`emf`/`eps`/`eps-cmyk`/`dxf`), data/text formats (`html`/`md`/`txt`/`json`/`csv`/`ics`/`vcf`) and `png` for SVG-native tools. (Print PDF needs the full endpoint's browser.) |
| `https://mcp.lolly.tools/mcp` | **Full** (headless browser) | An access token from the operator (OAuth or bearer). | **Everything** - vector, all raster (`png`/`jpg`/`webp`/…), print PDF (incl. CMYK + crop marks) and animation/video (`gif`/`apng`/`webm`/`mp4`). |

Start with the **open** endpoint: it needs no setup and covers every SVG-native tool. The full endpoint is a superset for operators who hold a token. For HTML-layout tools such as `design` and `chart`, for large files and for heavy automation, run Lolly yourself: the [CLI](/info/cli.html) renders every format on your own machine, and the same MCP server runs locally over stdio (see [Connect a client](#connect-a-client)).

## Limits on the open endpoint

`lolly.tools/api/mcp` is free to use and has a known daily cost, so these limits apply to it:

- **60 calls a minute per address.** A `429` carries `Retry-After`.
- **A daily budget for the whole endpoint**, shared by every caller: a fixed amount of compute and data transfer per UTC day. When the budget is spent, every call returns `503` with `error: daily_budget_reached` and a `Retry-After` that counts down to 00:00 UTC.
- **PNG up to 1600 x 1600 pixels of area** (enough for 1920 x 1080). A larger request is scaled down to fit, and the render result says so. Ask for `svg` for a file that scales to any size.
- **4.4 MB per answer**, the platform's response limit less the envelope. A larger result comes back as a tool error that says so, not as a broken response.
- **Decks up to 100 slides** per call, for `lolly_rebrand`, `lolly_read`, `lolly_check` and `lolly_compose`. A PDF counts its pages, and a source deck or inventory given to `lolly_check` or `lolly_compose` is held to the same limit.
- **Up to 262,144 characters of slide text measured** per `lolly_compose` call, counting each extra measure that `fit: "shrink"` makes. A text slot past that comes back unmeasured with a `compose.fit.unmeasured` note, and the result says how many slots were not measured.
- **Files up to about 3.2 MiB** each for the tools that take a file, so that a file and its base64 encoding fit in one request. The tool descriptions give the local limit; a refusal here gives this endpoint's exact figure in bytes.

None of these apply to Lolly on your own machine.

> A render on either endpoint runs **the same render path a user's export runs** - the server honours the full parameter contract (width/height/unit/dpi/colour profile/PDF password, and for the motion formats `fps`/`seconds`/`wait`/`codec`/`vq`), and never watermarks or embeds anything a user's own download wouldn't. Same path and same settings does not mean the same bytes for every format; see [Reproducibility](#reproducibility-what-is-and-is-not-byte-stable).

## Hot-linkable render URLs (no auth)

Alongside the MCP endpoints, a deployment can answer the canonical embed URL directly:

```
GET https://<host>/tool/<tool-id>.<ext>?<inputs>
```

> **Where this is live.** The route is per-deployment, and it is **live on
> lolly.tools**. A GET's query string ends up in the host's access logs and a
> link's inputs can carry personal data, so give a hot-link URL only what you
> would put on a public page; the [privacy policy](/info/privacy.html) says
> what the host keeps. An operator switches the route off with
> `LOLLY_DISABLE_RENDER_GET=1` (every such URL then returns 404).

This is the same "raw render URL" `lolly_build_url` returns - drop it into a README, wiki, Notion page or dashboard as an `<img src=…>` and it serves real bytes, no token needed. Its scope is deliberately narrow:

- **No auth, no accounts, no state.** It renders public tool + catalog data only; the inputs are whatever the URL says, and nothing is stored per request. Fetching one of these URLs sends the server nothing but what's written in the URL itself - your on-device documents, sessions and uploads can never appear in one. The inputs are public by construction, so don't put secrets in a shared link. (The [privacy policy](/info/privacy.html) covers this surface in its own words.)
- **Official and community tools only** - anything else is a 404.
- **Browser-free formats only**: the vector, float-raster and data set - `svg`, `emf`, `eps`, `eps-cmyk`, `dxf`, `exr`, `hdr`, `penpot`, `html`, `md`, `txt`, `json`, `csv`, `ics`, `vcf` - plus `png` for SVG-native tools such as `qr-code`. Formats that need the browser tier return an honest `400` - use `lolly_render` or the app for those.
- **Content Credentials are off here**, because a credential is signed with a fresh timestamp and nothing signed is cacheable. With them off, the vector and PNG formats this route serves are byte-stable run to run, which is what makes responses cacheable (a day at the CDN, `ETag` revalidation after that). `ics` is the exception in the list below: RFC 5545 requires a `DTSTAMP`, so an `.ics` differs between any two requests a second apart. A credentialed render is one `lolly_render` call away.
- Renders are **rate-limited per address** and count against the same daily budget as the open MCP endpoint. A `png` is capped at 2048 x 2048 pixels of area.
- **Themes.** `_themes`, the theme per token group as JSON (`_themes={"":"dark"}`), renders a tool this route can draw, such as `qr-code`, with its token colours in that theme. A value that is not such JSON is a `400`, and a choice the design system does not declare draws that group's default theme with no warning. Design needs the browser tier, so this route refuses a Design document in any theme; export one in each theme with `lolly run <file.lolly> --themes=light,dark` on the CLI.
- **One URL per image.** A parameter the render never reads (an unknown name, or a reserved one such as `export` or `c2pa` that this route ignores) is removed with a `308` redirect, so the CDN caches one URL for each image.
- Responses are marked **`noindex`**, so search engines don't index your renders.

Operators who don't want a public render surface switch the route off entirely with `LOLLY_DISABLE_RENDER_GET=1` - every `/tool/<id>.<ext>` URL then returns 404.

The route's parameters, refusals and headers are described in OpenAPI 3.1 at [`/openapi.json`](/openapi.json); the other machine-readable entry points (the discovery record, `llms.txt`, `llms-full.txt`, `agents.md`) are listed on [AI Agents](/info/ai-agents.html).

## Browser site tools (WebMCP)

Lolly also registers site tools in browsers that support `document.modelContext`. These actions use the open page and its signed-in workspace session. They follow the current view and end when the page closes. OpenAI's [Site tools guide](https://learn.chatgpt.com/docs/webmcp) describes compatible clients. Registration runs in the top-level shell; embedded tool pages do not register actions.

Start with `lolly_read_context` to learn the active project, tool, design system, inspected asset and available document actions. Use `lolly_search_tools` and `lolly_describe_tool` to discover tool ids and exact engine input definitions. Search results include device availability, formats and links; descriptions of the mounted tool include current values. Other tools use their engine defaults.

`lolly_read_project` returns paged folders, session summaries and asset ids for the current project. At the Projects root it lists local project folders. `lolly_search_assets` and `lolly_describe_asset` require an explicit `scope`: `project`, `uploads` or `catalog`. Project scope includes local subfolders or the current shared project's ready files. Shared project caches do not appear in uploads scope. Describing a shared file verifies its checksum and prepares the ordinary local asset reference for placement.

Asset results include dimensions, formats, rights, attribution, AI disclosures and author declarations. An author declaration remains a user assertion. Credential verification is reported as `not-checked`; discovery does not certify a file. Metadata discovery omits original file contents and uses bounded responses.

In a mounted Design editor, `lolly_read_document` and `lolly_find_layers` return stable layer ids, selection, canvas size and revision. `lolly_read_document_context` provides the exact layer field definitions and supported authoring operations. `lolly_apply_document_changes` requires `documentId`, `ifRevision`, `transactionId` and a history `label`. Keep the same transaction id and arguments when retrying. Changes use the live editor's validation and become one undo step. `lolly_preview_document` returns the rendered SVG; `lolly_undo_document_changes` takes back only the browser agent's newest step.

The browser agent appears in People on its first document action. The person can pause or disconnect the agent there. Paused agents can read, and cannot edit. Leaving the document closes its agent session; late requests cannot act in the next view. Other tools support discovery and inspection through this adapter. Their inputs remain editable through the ordinary UI.

Browsers without site tools keep the normal interface. The existing MCP server and project invitations continue to support agents working independently of an open page.

## The parameter contract is the URL

Every tool input and every export control an agent can set is a URL query parameter, and the one table that defines them is [URL mode](/info/url-mode.html): inputs by id (or `urlKey`), and the reserved export names - `format`, `width`/`height`/`unit`/`dpi`, `profile`, `password`, `bleed`/`marks`, `c2pa`/`imprint`/`durable`/`meta`, `hdr`/`depth`, `cuts`, `s`, `lang`, `emoji`/`emojifx`, and for the motion formats `fps`, `seconds`, `wait`, `codec` and `vq`. The MCP `query` argument, a share link, the CLI's `--flag=value` pairs and the hot-linkable render URL are that one contract under four transports, so an agent that has learnt the table has learnt all four; `lolly_list_tools` and `lolly_describe_tool` return each tool's inputs in the same vocabulary. Nothing here is a second API to memorise.

## The twenty-one tools

**Discover and describe:**

| Tool | Does |
|---|---|
| `lolly_list_tools` | List / search the catalogue (by text, status, category, format or capability); use `limit` to bound the matches for a small context. |
| `lolly_describe_tool` | One tool's full input JSON Schema, supported formats, canvas size, examples - and `emojiSets`, the emoji sets this deployment registers. |

**Validate and inspect a document before you spend a render:**

| Tool | Does |
|---|---|
| `lolly_validate` | Validate tool inputs (and Design structure) before compile or render - path-specific errors and warnings, no drawing. |
| `lolly_compile` | Compile a hydrated document without rasterising it. |
| `lolly_inspect` | Inspect a document (or a file you supply) without rasterising: its semantic read model. |
| `lolly_measure` | Measure a document without rasterising - sizes, counts, duration. |
| `lolly_diff` | Semantically diff two compiled documents or recipe query strings. |
| `lolly_package` | Package a Design document as a `.lolly` the Lolly app reopens as the same document, with its pictures and its name. Give `document` (a boxes array, `{boxes}` or `{values: {boxes}}`) or `toolId: "design"` with `inputs`; `assets` carries the bytes of each placeholder picture, base64, by the `image` value that draws it; `source` is a deck whose pictures resolve `user/media/<sha256>` references and the `photo:<12 hex>` keys `lolly_compose` suggests; `label` is the name. Every other picture must be a catalog id of the server's profile, and anything unresolved is refused unless `allowMissingMedia`. Returns the file and a report of what was carried and read back, the same report as `lolly package --json`. A compiled document of another tool is packaged as before and answers `{legacy: true, manifest}`. |
| `lolly_measure_text` | Where a plain Design text layer's lines break and how tall it is, before it is drawn: each line with its width and a `nearEdge` flag, the height, the `scrollHeight` the canvas reports and, with `height`, whether the box clips the text. Pass `text` and `width` (plus any of the layer's fields, or a `style` id to measure it as an authored layer), or a `document` to measure every plain text layer. The same measure as `lolly measure --text --json`. It reads no file, so it works on the open endpoint. |
| `lolly_compose` | Slides laid out from the slide master's archetypes, as a Design document with the master's furniture, margins and bindings. Pass a `spec` (`slides`, each with an `archetype` and its `slots`) and, for `from` references and notes, the deck's `inventory` or the deck itself as `source`. It returns the document, a report of what each slide filled and dropped and which text slots clip (`fit: "shrink"` steps them down), the source wording the slides change as `edits` for `lolly_check`, and the pictures named. `mode: "list"` returns the archetypes; `mode: "suggest"` a first spec for a deck. The same composer as `lolly compose --json`. A hosted server receives a deck passed as `source`. |

**Build a link or render:**

| Tool | Does |
|---|---|
| `lolly_build_url` | Build a shareable, editable link + raw render URL - **without** rendering. |
| `lolly_render` | Render a tool to a file - returns the bytes plus the editable link. |

**Look at a render in its own coordinates:**

| Tool | Does |
|---|---|
| `lolly_look` | The render with a labelled grid, or one region of it enlarged to read small type. The grid numbers are document units: for Design, the artboard pixels a layer's `x`, `y`, `w` and `h` use, so a position read off the picture can go straight into `layerPatches`. For looking only, never an export. |
| `lolly_sample_color` | The colours at points, each averaged over a small disc and compared with the active design system: the nearest colour token, its distance in OKLab (ΔE, about 0.02 is just noticeable) and whether that is a match. |
| `lolly_trace_edges` | The edges in a render or image as polylines in document units, longest first. With `asDesignLayers`, each line also comes back as a Design path layer, ready for `layerOperations` once it has an id. |

All three take a source the way `lolly_render` does, or a file you supply (PNG, JPEG, GIF, WebP or SVG, measured in its own pixels). A supplied SVG may only carry images inside itself: a reference to any other file is dropped before drawing. Design and Chart draw their SVG in the browser tier, so looking at them needs the full endpoint, as rendering them does.

**On-device file utilities (bytes in, bytes out):**

| Tool | Does |
|---|---|
| `lolly_transform` | Run an on-device file utility (`strip-data`, `compress-pdf`) on a file you supply. |
| `lolly_redact` | Destroy regions of an image, SVG or PDF you supply. Takes the same instruction string a share link carries (`bars=1,40,60,200,24~…`), so one string can be applied to every file of an identical layout. The tool rebuilds the file and re-checks its own output; a failed check returns an error with no file attached. |
| `lolly_verify` | Verify a file's Content Credentials (C2PA): was it genuinely made with Lolly, who signed it and has it changed since export. Returns the verdict, signer identity, edit history and embedded metadata (including any AI-generated declaration and appended-data flags) - the same C2PA verifier as the CLI's `lolly validate`. (The web verify page's pixel-level reads - the Lolly Imprint, SEAL, the opt-in deep scan - are interactive, web-only.) The file is checked in-process and never stored. |
| `lolly_rebrand` | Renovate a PowerPoint deck you supply into this server's design system, in four stages: `capabilities`, `plan`, `compile` and `inspect`. On a hosted server, calling this tool uploads your deck; call `{stage: 'capabilities'}` first to see where it goes and the size limit. |
| `lolly_read` | Read what a deck you supply says (a `.pptx`, a PDF or a Photoshop `.psd`), slide by slide: text in reading order with roles and runs, speaker notes with paragraphs and line breaks kept apart, pictures by content hash with placement and crop, tables and charts as data, and the class of every object. The same reader as `lolly read --json`. On a hosted server, calling this tool uploads your deck. |
| `lolly_check` | Check a Design document, a `.lolly` or an export with every check Lolly has, in one findings list: structure, render, brand and house rules, Verify, and fidelity to a source deck or a `lolly_read` inventory. The same report as `lolly check --json`, with the exit code that command would give. |

The intended flow is `lolly_list_tools` (usually with a focused `q` and small `limit`) → `lolly_describe_tool` (read the exact input schema) → `lolly_validate` when needed → `lolly_render`, which is exactly what the server's own prompts walk you through; `lolly_verify` closes the loop when an agent needs to prove a file it holds is an untouched Lolly export. On an authenticated connection with a file scope, five more `files_*` tools appear for importing a private file once and operating on its handle: `files_import`, `files_list`, `files_convert`, `files_report` and `files_delete`.

### One vocabulary across both machine surfaces

`lolly_verify` and the CLI's `lolly validate --json` answer the same question, so they answer it in the same words. Both report a `verdict` slug from one shared table - `made-with-lolly`, `delivered-by-lolly`, `likely-made-with-lolly`, `credential-expired`, `credential-intact`, `credential-broken`, `no-credential` - alongside `resolved` (the engine's semantic verdict) and the full verifier `report`. The slugs are frozen: an existing one is never re-pointed, and a new engine state adds a new slug, so a consumer needs a default branch and nothing else.

The same rule governs when a call escalates to the browser tier: one predicate, shared by the CLI, the TUI and this server, keyed on a typed `NEEDS_BROWSER` marker rather than on the wording of a tool's error. The lightweight endpoint's "that needs the browser tier" refusal and the CLI's exit `3` are therefore the same judgement, not two guesses that happen to agree.

### Redaction needs the full endpoint

`lolly_redact` rebuilds real pixels (a canvas for images, a page render for PDFs), which the browser-free tier cannot do. On the **full** endpoint it runs in the same browser path a person clicks in the app, including the tool's own export gate. On the **lightweight** endpoint it returns an error saying the browser tier is not available there rather than handing back a file that was never redacted. `lolly_transform` behaves the same way for any utility that rebuilds pixels; the metadata-only utilities (`strip-data`, `compress-pdf`) still run browser-free.

### Rebrand: renovate a deck, in stages

`lolly_rebrand` reads a `.pptx` you supply and turns it into this server's design system - colours, fonts and logo snapped to the system, decoration and page furniture pulled out - through the same node pipeline `lolly rebrand` runs on the CLI, so a plan made on one compiles on the other, as long as both read the same design system; otherwise compile refuses it with `plan.design-system-mismatch`. It runs no browser and needs neither endpoint's browser tier; it is available wherever the MCP server itself runs.

**On `mcp.lolly.tools` and `lolly.tools/api/mcp`, calling `lolly_rebrand` uploads your deck to Lolly's server.** It is processed in memory for that call only and not kept. On `lolly.tools/api/mcp`, which runs on Vercel, a deck over about 3.4 MB cannot be sent as base64 at all; run `lolly rebrand` on the CLI instead for a larger deck, or point an agent at a local MCP server.

Call `{stage: 'capabilities'}` first on a server you have not used. It states, in a plain sentence, where the file goes: a local server (stdio, or an HTTP server on a developer's own machine) keeps it in that process; a hosted server says calling the tool sends the file there, processed in memory for that call and nothing kept, with its byte and slide limits named, and, on Vercel, the platform's own request-size ceiling. `ocr` is `false` on every server - this pipeline reads no text out of pictures. Then `{stage: 'plan', file}` returns the review queue, the counts and the plan itself (as a JSON resource when it is too large to inline); an agent edits that plan - never regenerates it - before `{stage: 'compile', file, plan}` turns it into a Design document (`.lolly`) and, with `export: 'pptx'`, a native PowerPoint file; `{stage: 'inspect', plan}` pages through a large plan's queue and slides without pulling the whole thing back. A plan compiled against different bytes than it was made from is refused (`plan.hash-mismatch`), not silently reconciled.

### Read a deck, check a recreation

When an agent rebuilds a deck in Design rather than renovating the deck with `lolly_rebrand`, three calls carry the work. Read `lolly://design-context` first: the design brief, with approved colour pairings, type per role, logos per surface, icons, the slide master and the brand's house rules. Then `lolly_read` gives the source deck's content, and `lolly_check` checks the result.

`lolly_read` takes `{file}` and returns the content inventory (schema `content-inventory-v1`) with counts per kind. An inventory over 128 KB comes back as an embedded JSON resource instead of inside the structured result. Pictures come back as facts (hash, type, size, placement); `media: "inline"` also returns the bytes of each distinct picture, one embedded resource each. No text recognition runs, so a slide that is one picture of a slide reads as a picture (`ocr` is `false`).

`lolly_check` takes exactly one of `file` (a Design document, a `.lolly` or an export), `toolId: "design"` with `inputs`, `templateId`, `layerOperations` and `layerPatches` as `lolly_render` takes them, or a compiled `document`. Add `source` (a deck) or `inventory` (what `lolly_read` returned) to check fidelity. With either, `edits` (a list of `{ source, result, reason }`) records wording changed on purpose: those findings stay in the report as `info`, marked excepted, and are listed under `fidelity.excepted`, never as passed. The result is the same report `lolly check --json` writes (schema `check-report-v1`): five families (`structure`, `render`, `brand`, `verify`, `fidelity`), each `ran`, `skipped`, `unavailable` or `failed` with a reason, and one findings list. Each finding has a stable `code`, a `severity`, the `layerId` where there is one, the message the app shows and a `fix` where one is safe. `exitCode` is the code the CLI would exit with: `0` clean, `5` to review, `4` an error finding (or any warning with `strict`), `3` `browser: "require"` when a document has no browser to render it (an export has no render family, so the requirement does not apply to an export), `1` a family that failed or an export with no page that could be decoded. `inventory` takes the inventory, or the whole `lolly_read` result it came in. `theme` checks the document in one token theme, its linked colours resolved there; `themes` (a list of theme names, or `"all"`) checks it in each in one report, where the render, brand and Verify families run in each theme and their findings carry the `theme` they were found in (structure and fidelity run once) and a link that does not resolve in a theme is a `brand.token-link.unresolved` warning. Give one of `theme` and `themes`, not both. Findings are data, so the call is a tool error only when the request or the file cannot be read.

The render family (clipped text, contrast and font coverage on the painted page, with the document's pictures painted) needs the browser tier. On `lolly.tools/api/mcp` it reports `unavailable` and the other families still run. Verify runs with text recognition off on every server. On a hosted server the file and the source travel in one request, so pass the `lolly_read` inventory rather than the source deck there.

### Compose, measure and package a Design document

Between the read and the check, the agent writes the Design document. For slides, start with `lolly_compose`: it lays each slide out from an archetype of the design system's slide master, with the master's margins, type, furniture and bindings. Call it with `mode: "list"` for the archetypes and their slots, with `mode: "suggest"` and the `inventory` (or the deck as `source`) for a first spec, then with the edited `spec` and the same `inventory` to compose. A spec gives an `archetype` per slide and fills its `slots`, by text or by `from` an inventory object; `source` on a slide carries that slide's notes; `join` on a slot (`{from, join: ": "}`) runs a heading's lines into one; `cells`, `ground`, `furniture`, `emphasis`, `case`, `under` and `over` cover the rest, `themes: ["light", "dark"]` on the spec makes one document that serves both themes (logo furniture as `<id>?theme=auto`, and the master's token colours and the `under` and `over` token references stored as literals plus links), and `furniture`, `emphasis` and `case` at the top of the spec are deck defaults each slide merges over (schema `https://lolly.tools/schemas/design-compose-v1.schema.json`, described in the agent skill's Design reference). The result is the document, a report of what each slide filled, dropped and clipped, the `edits` to give `lolly_check` (each with a generic reason to replace), and the pictures it names. Because composed slides keep their master bindings, `lolly_check` judges them by the master's house rules and their PowerPoint export has real slide layouts and placeholders. A hosted server receives a deck passed as `source`; pass the `lolly_read` inventory there instead.

For what no archetype holds (a slide's `under` and `over` rows) and for slides written by hand, rows may carry **authoring keys**, which all start with `$`: `$in` gives a layer's position relative to its artboard, `$style` sets its text by a style from the design brief (`title`, `subtitle`, `body`, `caption`, `label`, `quote`, `number`, `attribution`) or from `$styles` beside `boxes`, `$points` and `$d` draw a path in px, and `$stack`, `$grid` and `$table` lay out repeated rows. Every tool that takes a Design source lowers them first, to ordinary layers in global canvas coordinates with every text field written out: in `inputs.boxes`, in an `add` operation's `layer` and in a patch's `set`. They are never stored. A key that cannot be lowered is an error with the JSON pointer of the key, and `lolly_check` reports it as a `design.authoring.invalid` finding. `lolly_compile` and `lolly_validate` return any notes the lowering made under `authoring`. The keys are described in the agent skill's Design reference, and their schema is `https://lolly.tools/schemas/design-authoring-v1.schema.json`.

`lolly_measure_text` answers where a text box's lines break before it is placed, with the faces the canvas loads. A line marked `nearEdge` is within a few px of breaking another way, so widen that box rather than trust the fit. `lolly_package` then writes the `.lolly` a person opens in the app. On a hosted server the pictures and the source travel in one request, and the `.lolly` comes back in one answer of at most 4.4 MB, so package a large deck with `lolly package` on the CLI.

## Work in the open document

A local MCP server (stdio) has nine collaboration tools. They let an agent join the Design document a person has open, find the requested layers, create alternatives and edit alongside its other collaborators.

On an instance with an agent relay configured, open **Share > Invite an agent**, choose **Can edit** or **Can read**, and copy the instructions to your agent. The agent calls `lolly_live_connect` with the copied `invitation` and its `client` name. The connection addresses this open document, even when several documents and agents are connected to the relay. The invitation works for ten minutes before an agent joins; a joined connection lasts up to thirty minutes and ends when the inviting editor closes. A new invitation starts another connection.

### Install Lolly in ChatGPT

An invitation gives an installed agent access to one document. Pasting instructions into ChatGPT cannot install tools.

Open **Plugins** in ChatGPT, choose **Create custom MCP server**, name the plugin **Lolly**, and set the server URL to `https://lolly.tools/api/mcp/agents`. Choose **No authentication**, review the connection notice, and create the plugin. Install the resulting plugin, then enable Lolly in your conversation. Account and workspace policies determine whether custom MCP connections are available. See [OpenAI's connection guide](https://developers.openai.com/plugins/deploy/connect-chatgpt).

Complete installation before copying a fresh document invitation from Share. Call `lolly_live_connect` with `invitation` and your `client` name. Pass the same `invitation` on every hosted tool call. The installed plugin has no account-wide credential: the invitation selects its instance, document and permissions. It works with public HTTPS Lolly relays on any domain, including lolly.ing. Calls to private networks and local addresses require the local MCP server instead.

The hosted connector keeps no active document or invitation between calls. The relay retains the connection while the editor stays open. Editing requires `documentId`, `ifRevision` and `transactionId`; retry with the same arguments. An ended invitation grants no access. Operators can disable the connector with `LOLLY_DISABLE_AGENT_CONNECTOR=1`. The connector uses the public gateway's durable request limits and usage budget, and refuses requests when admission is unavailable. Outbound calls pin a checked public DNS address, verify TLS for the original hostname, refuse redirects, and carry only the document bearer capability.

Directory publication is separate from installing a custom MCP server. Lolly's stable plugin identity is on lolly.tools; a document invitation selects the instance where the work happens.

### Plugin use

Lolly's software uses the [Mozilla Public License 2.0](https://www.mozilla.org/en-US/MPL/2.0/), including its permissions, conditions, warranty disclaimer and limits of liability. Documentation uses [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/). Assets have their own licenses. Using the plugin does not change your rights in your content or grant rights in somebody else's assets. Check agent edits before sharing them. Your agent provider and a private instance's operator may have their own terms.

Installing the plugin grants no account-wide access. Keep invitations private. Document data passes through the connector and invitation relay to your agent provider; see the [privacy policy](privacy.md). Report setup problems through [Lolly's issue tracker](https://github.com/lolly-tools/lolly/issues). Leave private invitations and document content out of public reports.

The agent appears beside people in **People**, with an **AI agent** tag, its own colour, and its current activity. Changed layers carry temporary outlines and a note identifying the agent. These cues remain outside the artwork and exports. The inviter can **Pause agent**, **Resume agent** or **Disconnect agent** from People, or end their agent invitations from Share. Pausing allows reads while refusing writes, including requests waiting in the editor's queue. Agent edits use the existing collaboration and history path: other people keep editing, and a person's newer history entry cannot be undone by the agent.

| Tool | Does |
|---|---|
| `lolly_live_connect` | Joins the document selected by `invitation`. Without one, connects to the desktop app when Allow AI control is on, or opens a local browser pairing. `client` gives the invited agent's name in People. |
| `lolly_live_status` | Says whether an editor is connected. With `wait`, waits up to 120 seconds for the person to type the code. |
| `lolly_live_context` | The open editor's design brief, active design system and version, exact layer fields, selection, document id, revision and capabilities. |
| `lolly_live_find` | Compact matches by text, name, kind, artboard or selection. `limit` and `offset` page the results. |
| `lolly_live_document` | Rows with stable ids, canvas size, selection, `documentId` and `revision`. Use `ids`, `artboardId`, `selection` or `fields` to read the relevant part. |
| `lolly_live_apply` | Typed `layerOperations` and `layerPatches`, as `lolly_render` takes. The edit is one undo step labelled with the agent's name and your `label`. Pass `documentId`, `ifRevision` and `transactionId`. A retry with the same transaction id and arguments returns its original receipt without another history entry. |
| `lolly_live_look` | The document as it draws now, with the same labelled grid as `lolly_look`, or one region enlarged. |
| `lolly_live_undo` | Undoes your own newest edit. When the newest change is the person's, the call is refused and nothing changes. |
| `lolly_live_disconnect` | Ends the connection. |

**In the desktop app**, the person opens Design, chooses **Connect an AI agent** in the File menu and turns on **Allow AI control on this device**. The setting is off until they turn it on. While it is on, the app listens on this computer only and `lolly_live_connect` finds the app with no code.

**In a browser**, `lolly_live_connect` returns a code such as `52817-K7QF-9XMB`. The person opens Design, chooses **Connect an AI agent** and types the code. The code works once, and three wrong codes end the pairing. The page connects to the agent's server on `127.0.0.1`, which accepts pages from lolly.tools, from the sites named in `LOLLY_LIVE_ORIGINS` and from localhost. The content security policy of the served builds does not allow that connection yet, so the browser path works in a development build, or in a self-hosted build made with `VITE_LIVE_AGENT=1` whose policy allows `ws://127.0.0.1:*`.

To create a slide alternative, find the source artboard, read its children, then use a `duplicate` operation with a new artboard id and a complete `childIds` map. Patch the new title and positions in the same apply. To place new content in a frame, add a `text` or `image` layer with `$in` set to that artboard's id; the coordinates are relative to that frame. An agent can supply its generated image as an inline data image in the `image` field, within the request's 4 MB limit. `$style` resolves against this editor's current design brief. Check the result with `lolly_live_look`.

Successful reads, context and apply calls include `structuredContent`. An apply receipt includes the document, transaction, changed ids and the admitted revision; `currentRevision` also reports the document when the reply is sent, including changes made while rendering finished. Each changed row is checked against the Design manifest before admission. The renderer and hooks still follow the normal tool lifecycle.

The connection retains its latest 128 receipts. Older transaction ids are refused, so retrying an expired receipt cannot repeat its edit. A connection admits up to 4096 named transactions before another invitation is needed.

### Operate a document relay

Run the long-lived MCP service with `pnpm run mcp:http`. Its `/live/invitations`, `/live/editor`, `/live/rpc` and `/live/mcp` routes provide invitations, outbound browser WebSockets and scoped document calls. The browser sends its attachment secret in the first socket frame; agent credentials travel in Authorization headers. A copied invitation keeps the agent secret in its URL fragment. Each grant has separate browser and agent credentials and is bound to one document and one originating editor site. The first joining agent identifies itself on the connection; another agent needs its own invitation.

For a relay-only process, run `node services/mcp/src/live-http.ts`. This exposes the invitation routes and `/healthz`; the public rendering gateway stays separate. The VM sidecar recipe is `deploy/docker/live-relay.compose.yml`. Apply it beside the Work compose file, with the clean OSS release in `agent-relay-src`, and generate the Work Caddyfile with `--serve-shell --live-relay-upstream live-relay:8790`. Keep one relay process: invitation grants and their editor sockets share its memory. Restarting that process ends existing invitations.

Build the web shell with `VITE_LIVE_RELAY=https://your-relay.example/live`. Allow the exact HTTPS and WSS relay origins in the shell's `connect-src` policy, and add the shell origin to the relay's `LOLLY_LIVE_ORIGINS`. Proxy these routes to the long-lived process with WebSocket upgrade support. The public Vercel function remains stateless and does not own these sockets. Development builds use `/live` through Vite's proxy to port 8790. Production builds offer the Share invitation section only when `VITE_LIVE_RELAY` is configured; the discovery record reports the same setting.

An MCP client that accepts a URL and bearer headers can also use the relay's `/live/mcp` endpoint directly, with the invitation token as its bearer credential. The copied instructions include both this route and the local MCP connection. On the scoped endpoint, call `lolly_live_connect` with `client` only; the bearer credential already selects the document. That endpoint lists only the nine document tools. It has no access to server files, server tokens or rendering outside the invited document.

Agent presence is delegated by the inviter's authenticated collaboration connection. Work instances must repin the updated core SDK before deploying: its presence sanitizer preserves the bounded `agents` field. Older Work servers discard that field, so other users on those servers see the ordinary document edits without the agent roster or change cues. Agent edit labels name the agent; the authenticated collaboration author remains the inviting member.

## Any format, transparently

`lolly_render` returns whatever format the tool declares - the server decides how to produce it, and the agent never has to know which engine ran:

- **Vector** - `svg`, `pdf`, `pdf-cmyk`, `eps`, `emf`, `dxf` (cut file)
- **Raster** - `png`, `jpg`, `webp`, `avif`, `tiff`, `cmyk-tiff`, `ico`
- **Animation / video** - `gif`, `apng`, `webp-anim`, `svg-anim` (vector), `webm`, `mp4`
- **Documents & data** - `pptx` (PowerPoint), `html`, `md`, `txt`, `json`, `csv`, `ics`, `vcf`, `zip`

Formats are **per-tool** - you can only request one a tool declares (`lolly_describe_tool` lists them). Ask a QR tool for `svg` and you get vector; ask an animated-ad tool for `mp4` and you get video - the call shape is identical either way. Animation, print PDF and HTML-layout raster require the **full** endpoint.

## Emoji: name the set you want drawn

Emoji in a render are drawn from a set somebody chose, never from the machine the server happens to run on. `lolly_render` and `lolly_build_url` both take two optional arguments for that choice, and read them the same way, so a link and the file it renders agree:

| Argument | Takes |
|---|---|
| `emoji` | The set: `<id>@<version>` (`community/emoji/twemoji/color@17.0.3`), its last two segments (`twemoji/color@17.0.3`), or a bare id when exactly one version is registered. |
| `emojifx` | The brand treatment for that artwork: `original`, `snap`, `mono`, `duotone` or `influence:<1-9999>` basis points, with an optional `,unprotected` to treat skin tones, flags and custom symbols too. The convenience form reads the current brand; generated links also pin the exact palette in `emojistyle`. |

`emojistyle` adds the exact style snapshot, including checksums, ordered fallbacks and palette. All three use the reserved URL params of the same name, so the identical strings work in a share link, as `lolly --emoji=… --emojifx=…` on the CLI and here. They travel in the link either call returns, which means a person who opens it sees the artwork the agent rendered.

Call `lolly_describe_tool` first and read **`emojiSets`** - one row per registered set with its `id@version`, label, glyph count and licence. Choosing a set is choosing a licence, which is why the licence is in the list. A set nobody registers comes back as a usage error naming the ones that are, rather than a picture that quietly arrives without the artwork you asked for.

Three things follow from how the drawing works:

- **With no `emoji` argument, every emoji draws as a neutral placeholder.** Nothing falls back to the operating system's emoji font, on any surface.
- **Simple SVG text uses shaped outlines and pack artwork.** Unsupported positioning, bidi or missing fonts produces a neutral placeholder with a layout diagnostic. `emojifx` with no `emoji` picks a treatment with no artwork to treat, and is reported as a warning.
- **The sources are recorded.** A render that placed pack artwork reports the pack's credit and licence in its `Rights:` line, and writes one Content Credential source per distinct glyph where the format can carry one. A browser-tier render establishes the same census server-side, so a PDF or an MP4 records its sources too.

## Resources - brand context without a render

Agents shouldn't guess asset ids or brand colours. Alongside the callable tools, the server exposes read-only **MCP resources**:

| Resource | Contents |
|---|---|
| `lolly://catalog` | The full generated tool index. |
| `lolly://assets` | Every catalog asset id with its type, name, tags and formats - enumerate here first, so you never hallucinate an id. |
| `lolly://tokens` | The brand's design tokens (DTCG): named colour swatches with CMYK. |
| `lolly://design-context` | The design brief for this server's design system: resolved tokens, source evidence, coverage and brand rules, plus approved colour pairings, type per role, logos per surface, icons and their themes, media families, the slide master and machine-checkable house rules. The same brief `lolly system context --json` prints, with `origin` naming where its tokens came from: always the server's content profile and its head tokens asset, the design system `lolly_check` checks against. The CLI tries `--file` and the terminal's active system before the profile; the server reads neither. Read it before composing, and before `lolly_check`. |
| `lolly://tool/{id}` | One tool's manifest summary + input JSON Schema + examples. |
| `lolly://tool/{id}/preview` | The tool's committed catalog preview (SVG), where one exists. |
| `lolly://asset/{id}` | A catalog asset (logo, palette, font) resolved to bytes. |

The intended pairing: read `lolly://assets` once, then pass a real id to any `asset`-typed input in `lolly_render`.

## Prompts - guided invocations

The server also publishes **MCP prompts**, for clients that surface them as slash-commands or quick actions:

- **`create-branded-asset`** - the generic guided workflow: give it a plain-language `brief` (and optionally a `format`) and it walks the agent through pick a tool → read its schema → render → share the editable link.
- **One prompt per featured tool**, named by tool id and derived from the live catalog at request time: its arguments are the tool's inputs (required ones first), its description the tool's blurb and its message includes the tool's example looks. Nothing is hardcoded, so a newly featured tool gets a prompt for free - and a pinned prompt keeps resolving even if the tool later leaves the featured set (only the *listing* is curated).

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

In a hosted assistant, add a custom connector with that URL and leave the OAuth fields blank. A quick check with `curl` (expect a JSON list of the twenty-one tools):

```bash
curl -s -X POST https://lolly.tools/api/mcp \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

### The full endpoint (access token)

`mcp.lolly.tools` authenticates against a shared access token, which your Lolly operator holds. The token is never printed in a link or a log.

#### A custom connector (OAuth)

The full endpoint is a stateless **OAuth 2.1** authorization server, so it drops straight into any MCP client that supports custom connectors:

1. In your client's connector settings, add a custom connector pointing at `https://mcp.lolly.tools/mcp`. (Hosted assistants usually expose this under a *Connectors* or *Integrations* panel; on team/enterprise plans an admin typically adds it once for everyone.)
2. Leave the OAuth Client ID / Secret blank - the server registers your client automatically (dynamic client registration).
3. The client auto-discovers the OAuth server and opens a consent page. Paste the access token and approve - done.

Then ask the agent to *"list the Lolly tools"* or *"render the color-block tool as a PNG."*

#### A bearer token (CLI / any HTTP client)

The full endpoint also accepts the raw token directly, so scripted clients skip the OAuth dance. Most MCP clients take a config entry like:

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

A quick check with `curl` (expect a JSON list of the twenty-one tools, plus the `files_*` tools when the connection is scoped; no token returns `401`):

```bash
curl -s -X POST https://mcp.lolly.tools/mcp \
  -H "authorization: Bearer <your-access-token>" \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

During local development you can also run the server over **stdio** - no token needed. See the [Build Guide](/info/build-guide.html).

## Authentication & security

- **Open only on purpose.** With no token configured the endpoint returns `401`, so a missing setting never opens a server by accident. An operator opens one deliberately with `LOLLY_MCP_ALLOW_ANONYMOUS=1`, as lolly.tools does for `lolly.tools/api/mcp`. An open endpoint serves no OAuth routes, and it limits calls by the caller's address, so an invented `Authorization` header buys no extra calls.
- **A known worst case.** A hosted endpoint counts the CPU time it uses and the bytes it sends per UTC day, in the same store as its rate limits, and refuses work once either total reaches its ceiling (`LOLLY_BUDGET_CPU_SECONDS_PER_DAY`, default 240, and `LOLLY_BUDGET_EGRESS_MB_PER_DAY`, default 1,024, sized so a free hosting tier keeps room for the rest of the site; `0` turns a ceiling off). `LOLLY_MCP_MAX_RASTER_PIXELS` sets the PNG area cap and `LOLLY_MCP_RPM` the per-caller rate. A store connected through the Upstash integration is found by its own variable names, so there is nothing to copy.
- **Stateless OAuth 2.1.** The client registration, authorization code and access/refresh tokens are all short-lived **signed values** verified with a shared secret on each call - nothing is stored server-side. PKCE (S256) protects the flow, so a captured link can't be replayed.
- **The token stays out of band.** It is the bearer for scripted clients and the passphrase on the consent page; it never appears in a render URL or a log line.

## Reproducibility: what is and is not byte-stable

Every render is reproducible in the sense that matters for design work: the inputs are the whole state, they travel as a link and re-rendering them gives the same picture. Byte-for-byte equality is a narrower promise, and it is the same one the [CLI](/info/cli-automation.html#how-far-byte-identical-output-goes) documents, because both surfaces drive the same engine:

- **Byte-stable**: `svg`, `emf`, `eps`, `dxf`, the data formats `json`/`csv`/`vcf`/`md`/`txt` and `png` from an SVG-native tool.
- **Not byte-stable**: `ics` (a required `DTSTAMP`), `pdf` (`/CreationDate` and `/ModDate` in every file) and everything the headless-browser tier paints and encodes - `jpg`, `webp`, HTML-layout `png`, `gif`/`apng`/`webm`/`mp4`. Anything carrying Content Credentials is signed with a fresh timestamp by design.

So do not build a cache key or a CI gate on the digest of a PDF or a browser-tier raster. Compare those by re-rendering and inspecting.

## Self-host the full endpoint

The full endpoint is the one part of Lolly that is a **server-side add-on**, not an on-device component - producing the full format range means driving a **headless browser against a built web shell**, which runs as a hosted service (a container or worker), not offline or at the edge. The on-device shells - [web PWA](/info/using.html), desktop, mobile and [CLI](/info/cli.html) - remain the offline / air-gapped path.

You can run the full server yourself - including fully air-gapped - as a container that ships the scoped Chromium and a prebuilt web shell. See the [Build Guide](/info/build-guide.html) and the deployment notes in `services/mcp/`.

## Organisation automation with lolly.work

The MCP endpoint on this page handles requests without persistent render history. Optional **lolly.work**, the Lolly project's separate organisation service, adds authenticated render jobs and batches with retained outputs, retry and cancellation, plus governed delivery and audit records. Use its `lw` client or HTTP API when a workflow needs those services; see [Organisation jobs with lolly.work](/info/cli-automation.html#organisation-jobs-with-lolly-work).

The two interfaces have separate authentication and permissions. Connecting an agent to this public MCP endpoint does not grant access to a private lolly.work catalog or apply that organisation's policy. Configure the intended instance and credentials for each service.

## Why this beats prompting an image model

- **Quality doesn't drift.** Layout, type, colour and spacing are structural - hard-coded by the tool author, not prompted. A lazy model can't degrade them.
- **Cheap.** A tool call is a handful of tokens versus thousands for a brief + generation - and the result is production-grade.
- **Reproducible & auditable.** The same inputs give the same design every time, and the inputs travel with it as a link anyone can re-open and re-render. (Byte-for-byte is a narrower promise - see below.)
- **One design, many outputs.** Change `format`/`unit`/`width` to emit the same design as SVG, print PDF and a social MP4 from one set of inputs.
