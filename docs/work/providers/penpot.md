# Penpot (kind: `penpot`)

Connect a Penpot instance you host, and its design tokens flow into a Lolly Work design system
while your designers keep working in Penpot. Boards stay in Penpot until a curator picks the
ones worth keeping. Penpot remains the source of truth, and Work never writes to Penpot.

![Penpot files split into two lanes: token sets federate on each sync into a design system that inherits them read-only, while boards are found by search and imported as catalog assets.](/info/diagrams/work-integrations/penpot-lanes.svg)

- **Tokens arrive on every sync.** Each file's tokens federate as one `tokens` asset (DTCG
  JSON). The console's **Design system** tab lists them as token sets that the design system
  inherits read-only, `$themes` included.
- **Boards arrive only when chosen.** They appear in the **Search & import** panel on the
  console's **Providers** page; a search matches file names and returns those files' boards.
  Importing one saves the board, rendered by Penpot's exporter, as an instance-owned catalog
  asset. Drafts stay in Penpot.

[Design-system administration](../design-system-administration.md#sources-and-storage) covers
how token sources combine with the active design system.

## What you need from Penpot

- **Your instance URL**, such as `https://design.your-host.example` (the `baseUrl` option). The
  connector is written for self-hosted instances and has not been tried against Penpot's hosted
  service.
- **The `access-tokens` flag** on that instance: add `access-tokens` to `PENPOT_FLAGS` so
  *Your account > Access tokens* is available.
- **A personal access token** from that page, with access to the teams and projects whose tokens
  you want.
- Optionally, a **team**, a **project** or explicit **file ids** to limit which files are read.

## Credential shape

A single sealed string: the Penpot personal access token, sent as `Authorization: Token …`.

```bash
lw providers credential design-penpot     # prompts; never argv, never shell history
```

## instance.json / `lw providers add`

```json
{
  "id": "design-penpot",
  "kind": "penpot",
  "label": "Design Penpot",
  "options": { "baseUrl": "https://design.your-host.example", "teamId": "…", "format": "png", "scale": 2 },
  "mapping": { "typeMap": { "tokens": "tokens", "board": "image" }, "defaultType": "image" },
  "exposure": { "groups": ["design"], "tier": "reference" }
}
```

| Setting | What it does |
|---|---|
| `options.baseUrl` (required) | Your Penpot origin. Every call is pinned to this origin. |
| `options.teamId`, `options.projectId` | Limit which teams and projects are searched for files. |
| `options.fileIds` | Read exactly these files and skip the search. |
| `options.format` | How imported boards render: `png` (default), `svg`, `jpeg` or `webp`. |
| `options.scale` | The render scale for imported boards, default `1`. |
| `options.exporterUrl` | The exporter's origin, when it differs from `baseUrl`. |
| `mapping.typeMap` (required) | Maps Penpot's two types into the catalog: `tokens` to `tokens` (the design-system feed) and `board` to `image` (imported media). The console's Penpot card fills this in. |

## Verify

```bash
lw providers preview --kind penpot --options '{"baseUrl":"https://design.your-host.example"}'
lw providers health design-penpot
```

A `penpot rpc get-profile <status>` error means the instance URL or token is wrong, or the
`access-tokens` flag is off. The RPC command and field names come from Penpot's documentation and
are not yet confirmed against a live instance; a failed call reports the command
(`penpot rpc <cmd> <status>`).

## Notes / limits

- **Self-hosted.** The connector uses Penpot's token-authenticated RPC against an origin you run.
  Penpot is published under MPL-2.0, so no vendor terms of service apply to the connector.
- **Up to 200 files.** One sync or search reads at most 200 files, so a very large instance
  cannot stall a request.
- **Board renders need the exporter.** Penpot's exporter must be reachable at `exporterUrl`, or
  at `baseUrl` when that is not set.
- **Pinned to your origin.** Every call goes only to the configured origin.
