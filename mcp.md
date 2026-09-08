# The Lolly MCP server

Lolly ships a native **[Model Context Protocol](https://modelcontextprotocol.io) server** - a single endpoint any MCP client (an agent runtime, an IDE, a CLI, a hosted assistant) connects to directly. It exposes the tool catalogue and the render path as callable tools, so an agent can discover a tool, fill its declared inputs and get back a finished file plus an editable `lolly.tools` link. Because tools sync to the server as **data**, new tools appear with no server update.

It is the programmatic sibling of [driving Lolly from a URL](/info/ai-agents.html): same render path, same reproducible output - just reached over MCP instead of a hand-built link.

**Asking what Lolly converts.** An agent that wants to know whether Lolly reads or writes a given format does not have to scrape a page. Call `lolly_list_tools` (it filters by format and capability), or fetch the static [`/info/capabilities.json`](/info/capabilities.json) - a machine-readable list of every format, whether Lolly opens it, makes it, or both, and the features each one carries. There is also a plain-language page for every format at `/info/formats/<token>/` and one for each common conversion at `/info/convert/<in>-to-<out>/`.

## Two hosted endpoints

The render path has two tiers, so there are two endpoints. **They share the same access token** and the same tools - the only difference is which output formats each can produce.

| Endpoint | Tier | Produces |
|---|---|---|
| `https://mcp.lolly.tools/mcp` | **Full** (headless browser) | **Everything** - vector, all raster (`png`/`jpg`/`webp`/…), print PDF (incl. CMYK + crop marks) and animation/video (`gif`/`apng`/`webm`/`mp4`). |
| `https://lolly.tools/api/mcp` | **Lightweight** (serverless, no browser) | Vector (`svg`/`emf`/`eps`/`eps-cmyk`/`dxf`), data/text formats (`html`/`md`/`txt`/`json`/`csv`/`ics`/`vcf`) and `png` for SVG-native tools. (Print PDF needs the full endpoint's browser.) |

Use the **full** endpoint (`mcp.lolly.tools`) unless you have a reason not to - it is a superset. The lightweight endpoint runs browser-free on the same infrastructure as `lolly.tools`, and is handy for quick vector/data work.

> A render on either endpoint runs **the same render path a user's export runs** - the server honours the full parameter contract (width/height/unit/dpi/colour profile/PDF password, and for the motion formats `fps`/`seconds`/`wait`/`codec`/`vq`), and never watermarks or embeds anything a user's own download wouldn't. Same path and same settings does not mean the same bytes for every format; see [Reproducibility](#reproducibility-what-is-and-is-not-byte-stable).

## Hot-linkable render URLs (no auth)

Alongside the authenticated MCP endpoints, a deployment can answer the canonical embed URL directly:

```
GET https://<host>/tool/<tool-id>.<ext>?<inputs>
```

> **Where this is live.** The route is per-deployment. It is **switched off on
> lolly.tools** (`LOLLY_DISABLE_RENDER_GET=1` - every such URL returns 404) until that
> service moves to organisation-owned hosting, because a GET's query string ends up in
> the host's access logs and a link's inputs can carry personal data. It is
> deliberately **live on lolly.art**, the public demo instance. The
> [privacy policy](/info/privacy.html) explains the reasoning.

This is the same "raw render URL" `lolly_build_url` returns - drop it into a README, wiki, Notion page or dashboard as an `<img src=…>` and it serves real bytes, no token needed. Its scope is deliberately narrow:

- **No auth, no accounts, no state.** It renders public tool + catalog data only; the inputs are whatever the URL says, and nothing is stored per request. Fetching one of these URLs sends the server nothing but what's written in the URL itself - your on-device documents, sessions and uploads can never appear in one. The inputs are public by construction, so don't put secrets in a shared link. (The [privacy policy](/info/privacy.html) covers this surface in its own words.)
- **Official and community tools only** - anything else is a 404.
- **Browser-free formats only**: the vector, float-raster and data set - `svg`, `emf`, `eps`, `eps-cmyk`, `dxf`, `exr`, `hdr`, `penpot`, `html`, `md`, `txt`, `json`, `csv`, `ics`, `vcf` - plus `png` for SVG-native tools such as `qr-code`. Formats that need the browser tier return an honest `400` - use `lolly_render` or the app for those.
- **Content Credentials are off here**, because a credential is signed with a fresh timestamp and nothing signed is cacheable. With them off, the vector and PNG formats this route serves are byte-stable run to run, which is what makes responses cacheable (a day at the CDN, `ETag` revalidation after that). `ics` is the exception in the list below: RFC 5545 requires a `DTSTAMP`, so an `.ics` differs between any two requests a second apart. A credentialed render is one `lolly_render` call away.
- Renders are **rate-limited per address**; heavy automation belongs on the MCP endpoints.
- Responses are marked **`noindex`**, so search engines don't index your renders.

Operators who don't want a public render surface switch the route off entirely with `LOLLY_DISABLE_RENDER_GET=1` - every `/tool/<id>.<ext>` URL then returns 404. That is what lolly.tools itself currently does.

The route's parameters, refusals and headers are described in OpenAPI 3.1 at [`/openapi.json`](/openapi.json); the other machine-readable entry points (the discovery record, `llms.txt`, `llms-full.txt`, `agents.md`) are listed on [AI Agents](/info/ai-agents.html).

## The parameter contract is the URL

Every tool input and every export control an agent can set is a URL query parameter, and the one table that defines them is [URL mode](/info/url-mode.html): inputs by id (or `urlKey`), and the reserved export names - `format`, `width`/`height`/`unit`/`dpi`, `profile`, `password`, `bleed`/`marks`, `c2pa`/`imprint`/`durable`/`meta`, `hdr`/`depth`, `cuts`, `s`, `lang`, and for the motion formats `fps`, `seconds`, `wait`, `codec` and `vq`. The MCP `query` argument, a share link, the CLI's `--flag=value` pairs and the hot-linkable render URL are that one contract under four transports, so an agent that has learnt the table has learnt all four; `lolly_list_tools` and `lolly_describe_tool` return each tool's inputs in the same vocabulary. Nothing here is a second API to memorise.

## The thirteen tools

**Discover and describe:**

| Tool | Does |
|---|---|
| `lolly_list_tools` | List / search the catalogue (by text, status, category, format, capability). |
| `lolly_describe_tool` | One tool's full input JSON Schema, supported formats, canvas size and examples. |

**Validate and inspect a document before you spend a render:**

| Tool | Does |
|---|---|
| `lolly_validate` | Validate tool inputs (and Design structure) before compile or render - path-specific errors and warnings, no drawing. |
| `lolly_compile` | Compile a hydrated document without rasterising it. |
| `lolly_inspect` | Inspect a document (or a file you supply) without rasterising: its semantic read model. |
| `lolly_measure` | Measure a document without rasterising - sizes, counts, duration. |
| `lolly_diff` | Semantically diff two compiled documents or recipe query strings. |
| `lolly_package` | Package a compiled document into portable `.lolly` bytes. |

**Build a link or render:**

| Tool | Does |
|---|---|
| `lolly_build_url` | Build a shareable, editable link + raw render URL - **without** rendering. |
| `lolly_render` | Render a tool to a file - returns the bytes plus the editable link. |

**On-device file utilities (bytes in, bytes out):**

| Tool | Does |
|---|---|
| `lolly_transform` | Run an on-device file utility (`strip-data`, `compress-pdf`) on a file you supply. |
| `lolly_redact` | Destroy regions of an image, SVG or PDF you supply. Takes the same instruction string a share link carries (`bars=1,40,60,200,24~…`), so one string can be applied to every file of an identical layout. The tool rebuilds the file and re-checks its own output; a failed check returns an error with no file attached. |
| `lolly_verify` | Verify a file's Content Credentials (C2PA): was it genuinely made with Lolly, who signed it and has it changed since export. Returns the verdict, signer identity, edit history and embedded metadata (including any AI-generated declaration and appended-data flags) - the same C2PA verifier as the CLI's `lolly validate`. (The web verify page's pixel-level reads - the Lolly Imprint, SEAL, the opt-in deep scan - are interactive, web-only.) The file is checked in-process and never stored. |

The intended flow is `lolly_list_tools` → `lolly_describe_tool` (read the exact input schema) → `lolly_validate` (correct every error) → `lolly_render`, which is exactly what the server's own prompts walk you through; `lolly_verify` closes the loop when an agent needs to prove a file it holds is an untouched Lolly export. On an authenticated connection with a file scope, five more `files_*` tools appear for importing a private file once and operating on its handle: `files_import`, `files_list`, `files_convert`, `files_report` and `files_delete`.

### One vocabulary across both machine surfaces

`lolly_verify` and the CLI's `lolly validate --json` answer the same question, so they answer it in the same words. Both report a `verdict` slug from one shared table - `made-with-lolly`, `delivered-by-lolly`, `likely-made-with-lolly`, `credential-expired`, `credential-intact`, `credential-broken`, `no-credential` - alongside `resolved` (the engine's semantic verdict) and the full verifier `report`. The slugs are frozen: an existing one is never re-pointed, and a new engine state adds a new slug, so a consumer needs a default branch and nothing else.

The same rule governs when a call escalates to the browser tier: one predicate, shared by the CLI, the TUI and this server, keyed on a typed `NEEDS_BROWSER` marker rather than on the wording of a tool's error. The lightweight endpoint's "that needs the browser tier" refusal and the CLI's exit `3` are therefore the same judgement, not two guesses that happen to agree.

### Redaction needs the full endpoint

`lolly_redact` rebuilds real pixels (a canvas for images, a page render for PDFs), which the browser-free tier cannot do. On the **full** endpoint it runs in the same browser path a person clicks in the app, including the tool's own export gate. On the **lightweight** endpoint it returns an error saying the browser tier is not available there rather than handing back a file that was never redacted. `lolly_transform` behaves the same way for any utility that rebuilds pixels; the metadata-only utilities (`strip-data`, `compress-pdf`) still run browser-free.

## Any format, transparently

`lolly_render` returns whatever format the tool declares - the server decides how to produce it, and the agent never has to know which engine ran:

- **Vector** - `svg`, `pdf`, `pdf-cmyk`, `eps`, `emf`, `dxf` (cut file)
- **Raster** - `png`, `jpg`, `webp`, `avif`, `tiff`, `cmyk-tiff`, `ico`
- **Animation / video** - `gif`, `apng`, `webp-anim`, `svg-anim` (vector), `webm`, `mp4`
- **Documents & data** - `pptx` (PowerPoint), `html`, `md`, `txt`, `json`, `csv`, `ics`, `vcf`, `zip`

Formats are **per-tool** - you can only request one a tool declares (`lolly_describe_tool` lists them). Ask a QR tool for `svg` and you get vector; ask an animated-ad tool for `mp4` and you get video - the call shape is identical either way. Animation, print PDF and HTML-layout raster require the **full** endpoint.

## Resources - brand context without a render

Agents shouldn't guess asset ids or brand colours. Alongside the callable tools, the server exposes read-only **MCP resources**:

| Resource | Contents |
|---|---|
| `lolly://catalog` | The full generated tool index. |
| `lolly://assets` | Every catalog asset id with its type, name, tags and formats - enumerate here first, so you never hallucinate an id. |
| `lolly://tokens` | The brand's design tokens (DTCG): named colour swatches with CMYK. |
| `lolly://tool/{id}` | One tool's manifest summary + input JSON Schema + examples. |
| `lolly://tool/{id}/preview` | The tool's committed catalog preview (SVG), where one exists. |
| `lolly://asset/{id}` | A catalog asset (logo, palette, font) resolved to bytes. |

The intended pairing: read `lolly://assets` once, then pass a real id to any `asset`-typed input in `lolly_render`.

## Prompts - guided invocations

The server also publishes **MCP prompts**, for clients that surface them as slash-commands or quick actions:

- **`create-branded-asset`** - the generic guided workflow: give it a plain-language `brief` (and optionally a `format`) and it walks the agent through pick a tool → read its schema → render → share the editable link.
- **One prompt per featured tool**, named by tool id and derived from the live catalog at request time: its arguments are the tool's inputs (required ones first), its description the tool's blurb and its message includes the tool's example looks. Nothing is hardcoded, so a newly featured tool gets a prompt for free - and a pinned prompt keeps resolving even if the tool later leaves the featured set (only the *listing* is curated).

## Connect a client

Both endpoints authenticate against the same shared access token, which your Lolly operator holds. It is never printed in a link or a log.

### A custom connector (OAuth)

The endpoint is a stateless **OAuth 2.1** authorization server, so it drops straight into any MCP client that supports custom connectors:

1. In your client's connector settings, add a custom connector pointing at `https://mcp.lolly.tools/mcp`. (Hosted assistants usually expose this under a *Connectors* or *Integrations* panel; on team/enterprise plans an admin typically adds it once for everyone.)
2. Leave the OAuth Client ID / Secret blank - the server registers your client automatically (dynamic client registration).
3. The client auto-discovers the OAuth server and opens a consent page. Paste the access token and approve - done.

Then ask the agent to *"list the Lolly tools"* or *"render the color-block tool as a PNG."*

### A bearer token (CLI / any HTTP client)

The endpoint also accepts the raw token directly, so scripted clients skip the OAuth dance. Most MCP clients take a config entry like:

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

A quick check with `curl` (expect a JSON list of the thirteen tools, plus the `files_*` tools when the connection is scoped; no token returns `401`):

```bash
curl -s -X POST https://mcp.lolly.tools/mcp \
  -H "authorization: Bearer <your-access-token>" \
  -H "content-type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

During local development you can also run the server over **stdio** - no token needed. See the [Build Guide](/info/build-guide.html).

## Authentication & security

- **Fail-closed.** With no token configured the endpoint returns `401` - it never silently becomes an open server.
- **Stateless OAuth 2.1.** The client registration, authorization code and access/refresh tokens are all short-lived **signed values** verified with a shared secret on each call - nothing is stored server-side. PKCE (S256) protects the flow, so a captured link can't be replayed.
- **The token stays out of band.** It is the bearer for scripted clients and the passphrase on the consent page; it never appears in a render URL or a log line.

## Reproducibility: what is and is not byte-stable

Every render is reproducible in the sense that matters for design work: the inputs are the whole state, they travel as a link and re-rendering them gives the same picture. Byte-for-byte equality is a narrower promise, and it is the same one the [CLI](/info/cli.html#how-far-the-same-goes-byte-for-byte) documents, because both surfaces drive the same engine:

- **Byte-stable**: `svg`, `emf`, `eps`, `dxf`, the data formats `json`/`csv`/`vcf`/`md`/`txt` and `png` from an SVG-native tool.
- **Not byte-stable**: `ics` (a required `DTSTAMP`), `pdf` (`/CreationDate` and `/ModDate` in every file) and everything the headless-browser tier paints and encodes - `jpg`, `webp`, HTML-layout `png`, `gif`/`apng`/`webm`/`mp4`. Anything carrying Content Credentials is signed with a fresh timestamp by design.

So do not build a cache key or a CI gate on the digest of a PDF or a browser-tier raster. Compare those by re-rendering and inspecting.

## Self-host it

The full endpoint is the one part of Lolly that is a **server-side add-on**, not an on-device component - producing the full format range means driving a **headless browser against a built web shell**, which runs as a hosted service (a container or worker), not offline or at the edge. The on-device shells - [web PWA](/info/using.html), desktop, mobile and [CLI](/info/cli.html) - remain the offline / air-gapped path.

You can run the full server yourself - including fully air-gapped - as a container that ships the scoped Chromium and a prebuilt web shell. See the [Build Guide](/info/build-guide.html) and the deployment notes in `services/mcp/`.

## Why this beats prompting an image model

- **Quality doesn't drift.** Layout, type, colour and spacing are structural - hard-coded by the tool author, not prompted. A lazy model can't degrade them.
- **Cheap.** A tool call is a handful of tokens versus thousands for a brief + generation - and the result is production-grade.
- **Reproducible & auditable.** The same inputs give the same design every time, and the inputs travel with it as a link anyone can re-open and re-render. (Byte-for-byte is a narrower promise - see below.)
- **One design, many outputs.** Change `format`/`unit`/`width` to emit the same design as SVG, print PDF and a social MP4 from one set of inputs.
