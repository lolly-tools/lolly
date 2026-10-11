# lolly-mcp-server

Lives at `services/mcp/` in the [`lolly`](https://github.com/lolly-tools/lolly) repository.
Before 2026-09-11 this was its own repository, `lolly-mcp-server`, mounted as a git
submodule; its history came across intact and is archived at the old URL with a redirect
notice.

Builds **within the repository** - depends on sibling workspace packages
(`@lolly/engine`) / relative paths that only exist in that layout.

## Protocol and transports

The server implements the stateless core of
[MCP 2026-07-28](https://modelcontextprotocol.io/specification/2026-07-28),
with tools, resources and prompts over stdio and Streamable HTTP. Every modern
request carries its version and client capabilities; discovery is optional:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "server/discover",
  "params": {
    "_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientCapabilities": {},
      "io.modelcontextprotocol/clientInfo": { "name": "example", "version": "1" }
    }
  }
}
```

HTTP clients POST to `/mcp` (standalone) or `/api/mcp` (hosted), with
`Content-Type: application/json`, `Accept: application/json, text/event-stream`,
the bearer token, `MCP-Protocol-Version: 2026-07-28`, and a `Mcp-Method` header
matching the method. `tools/call` and `prompts/get` also require `Mcp-Name` equal
to `params.name`; `resources/read` uses `params.uri`. Unicode, whitespace-padded
and sentinel-shaped names use the spec's UTF-8 Base64 header encoding. Header
mismatches return HTTP 400 and error `-32020`; unsupported versions return
`-32022` with the supported versions. All current tool schemas omit
`x-mcp-header`, so no custom parameter headers are required.

Successful modern results carry `resultType: "complete"` and server identity.
Discovery and list results have a 60-second private cache hint; resource reads
are immediately stale (`ttlMs: 0`). Caches must remain within the authenticated
scope. HTTP responses use `Cache-Control: no-store`. The server returns JSON;
subscriptions, tasks and client input requests are not advertised. There are no
protocol sessions or standalone GET streams. Private files use explicit handles
and the existing authenticated owner scope. HTTP responses default to
`private, no-store, max-age=0, no-transform` with `CDN-Cache-Control: no-store`;
public render/proxy responses explicitly select their delivery policy. The
origin negotiates gzip/Brotli for text over 1 KiB without changing decoded bytes.
Compressed responses weaken their ETag; they do not claim wire-byte equality
with the uncompressed representation.

### Private result downloads

`LOLLY_MCP_PRIVATE_FILES=1`, a configured `LOLLY_MCP_TOKEN`, canonical
`LOLLY_MCP_PUBLIC_ORIGIN`, and a single gateway process enable authenticated
result links. Set `LOLLY_MCP_REPLICAS=1` explicitly on container deployments.
The Helm equivalent is `mcp.privateFiles.enabled=true,mcp.replicaCount=1`.
Do not distribute these process-local handles across replicas; the chart uses
Recreate updates, and a restart invalidates every held result. The runtime
disables private files when an explicit replica count is not one. Anonymous
access and Vercel never offer result links.

Tool outputs over 1 MiB become `resource_link` blocks at
`/api/mcp/files/<uuid>?dt=...`. `files_download` creates the same link for a
private handle. GET/HEAD require the currently valid creating bearer and a
configured-host, exact-path, principal-bound HMAC token that expires at 300
seconds (no clock-skew grace). Stored bytes are integrity checked before delivery;
the route never re-renders or signs a file. Files live in a 0700 temporary
directory with 0600 permissions, bounded owner/global/count quotas and expiry
cleanup. Hold and download bytes count against the daily budget. Never persist
these temporary URLs as asset identities or provenance ingredient URLs.

### Separate gateway admission counters

`LOLLY_MCP_ADMISSION_NAMESPACE` optionally separates a gateway's rate limits and
daily CPU/egress budget on the same Redis-compatible REST store. The default is
`mcp`, preserving the existing counter keys. For a separate authenticated gateway,
use a stable distinct value such as `mcp-restricted-v1`; keep the anonymous
gateway's setting unchanged. Values must start with a lowercase ASCII letter and
contain 1-64 lowercase letters, digits, underscores or hyphens. Invalid values
refuse startup, including standalone HTTP and its final accounting flush.

This setting changes counters only. It does not grant authorization, create
caller identities, isolate backend capacity or make process-local result handles
portable. Every replica of one gateway must use the same namespace. Changing the
namespace starts a different counter set and must be an explicit operator choice,
not a way to reset an exhausted daily budget. Keep the namespace fixed across
restarts and ordinary releases; final drain accounting uses the same setting.

Existing clients can still initialize with `2025-11-25`, `2025-06-18` or
`2025-03-26`. An unsupported initialize version selects `2025-11-25`; arbitrary
versions are never echoed. Legacy requests retain their original result shape
and optional HTTP metadata headers. Modern requests use `server/discover` and
per-request metadata without an initialize handshake. Keep these paths separate
when adding protocol features.

Local HTTP binds to `127.0.0.1` by default. Set `LOLLY_MCP_BIND_HOST` explicitly
for a container listener. Configure `LOLLY_MCP_PUBLIC_ORIGIN` for hosted use;
browser requests must match that origin or an exact origin in the comma-separated
`LOLLY_MCP_ALLOWED_ORIGINS`. Requests without an Origin header are supported.
OAuth authorization responses include the canonical issuer (`iss`). Registration
accepts `application_type: "web"` or `"native"` and retains omitted values for
older clients. Dynamic registration remains for compatibility; Client ID Metadata
Documents are not advertised.

`test/protocol-2026.test.ts` exercises both protocol eras, real HTTP requests and
stdio shutdown. `scripts/check-mcp-live.ts` checks modern discovery/list results
and legacy initialization when an authenticated deployment is available.

## Authoring and rendering

For agent-authored assets, use the discover → describe → validate → render
workflow. `lolly_describe_tool` returns each tool's JSON Schema and any built-in
templates/presets. `lolly_validate` reports exact invalid paths; compile, URL
building and render enforce the same validation rather than silently accepting a
misspelt field. Design calls may pass `templateId` / `presetId` and receive the
shared artboard/layer inspection report before any pixels are drawn. After an
inspect, `layerPatches` updates text/assets by stable layer ID without copying a
template's geometry into the request.

Use `layerOperations` when the layer set itself changes. Its strict `add`,
`duplicate`, `remove`, `reparent` and `reorder` operations run in order before
`layerPatches`, so a newly created or moved layer can be patched in the same
request. Reorder and reparent may name a sibling with `beforeId` or `afterId` and
update the rendered `order`/`z`; `artboardId: null` reparents to the pasteboard.
Every duplicate takes an explicit `newId`. Duplicating a non-empty artboard also
requires a complete `childIds` map, so the result never contains opaque generated
IDs. Removing a non-empty artboard requires `cascade: true`.

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

Duplicate a complete artboard while keeping every resulting ID addressable:

```json
{
  "toolId": "design",
  "templateId": "slide-deck",
  "layerOperations": [
    {
      "op": "duplicate",
      "id": "slide1",
      "newId": "slide1-copy",
      "childIds": {
        "s1accent": "s1accent-copy",
        "s1title": "s1title-copy",
        "s1body": "s1body-copy"
      },
      "afterId": "slide1"
    }
  ]
}
```

## Hosted AI scope

Hosted MCP rendering has no member AI policy lease. Its headless host therefore
omits speech, upscaling, model-based background removal and OCR APIs. Its browser
render contexts disable the matching web shell's supported AI paths and reject
model asset requests. Work's Managed AI switch does not enable MCP AI. Ordinary
non-model rendering, file processing and the standalone CLI/TUI are unchanged.

Promote the matching updated shell and MCP code together. These application
controls do not sandbox arbitrary custom JavaScript or govern an independent CLI;
review trusted tools, endpoint controls and network access for the service scope.

`lolly_render` and `lolly_inspect` accept an explicit production still contract.
The render core checks final bytes and can try declared input alternatives using
`productionRepair`; failures retain their measurement report. See
[Production checks](../../docs/production-checks.md) for capabilities and examples.
