# lolly-mcp-server

Extracted from the [`lolly`](https://github.com/lolly-tools/lolly) monorepo and
consumed there as a git submodule at `services/mcp/`.

Builds **within the monorepo** - depends on sibling workspace packages
(`@lolly/engine`) / relative paths that only exist in that layout.

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
