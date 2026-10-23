# Penpot (kind: `penpot`)

Federate an **open, self-hostable** Penpot instance as a **design-system source**. Two
asset classes, handled differently:

- **Design tokens auto-federate** into the catalog as `tokens` assets (DTCG JSON). The
  console's **Design system** tab lists them as token sets that the design system inherits
  read-only; the console parses DTCG, `$themes` included.
- **Media is search-and-import, never auto-federated.** Boards surface only through the
  **Search & import** panel on the console's **Providers** page; a curator imports the ones
  worth keeping, and each import snapshots the exporter-rendered board into an instance-owned
  copy with full rigor. Experimentation stays in Penpot; only curated boards enter the catalog.

Read-only; Penpot stays the source of truth.

## What you need from Penpot

- **Your instance URL** - your self-hosted Penpot origin, e.g.
  `https://design.your-host.example` (the `baseUrl` option). This connector is written for
  **self-hosted** instances; it has not been tried against Penpot's hosted service.
- **The `access-tokens` flag enabled** on that instance - add `access-tokens` to
  `PENPOT_FLAGS` so *Your account → Access tokens* is available.
- **A personal access token** from that page, with access to the teams/projects whose
  tokens you want to federate.
- Optionally note a **team**, **project**, or explicit **file ids** to scope which files'
  tokens are pulled in.

## Credential shape

A single sealed string - the Penpot personal access token (sent as
`Authorization: Token …`):

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

- `options.baseUrl` (required) - your self-hosted Penpot origin. Every call is pinned to
  this origin.
- `options.teamId` / `options.projectId` scope discovery; `options.fileIds` federates
  exactly those files and skips discovery.
- `options.format` (default `png`) / `options.scale` (default `1`) - the render settings
  for imported boards; `options.exporterUrl` overrides the exporter origin if it differs
  from `baseUrl`.
- `mapping.typeMap` (required) maps Penpot's two native types into the catalog: `tokens →
  tokens` (the Design-system feed) and `board → image` (imported media). The console
  connect card prefills this.

## Verify

```bash
lw providers preview --kind penpot --options '{"baseUrl":"https://design.your-host.example"}'
lw providers health design-penpot
```

`penpot rpc get-profile <status>` errors mean the instance URL or token is wrong, or the
`access-tokens` flag is off. The RPC command and field names come from Penpot's documentation
and are not yet confirmed against a live instance; a failed call reports the command
(`penpot rpc <cmd> <status>`).

## Notes / limits

- **Written for self-hosted instances** - the connector uses Penpot's token-authed RPC
  against an origin you run (Penpot is published under MPL-2.0, so there is no vendor ToS on
  the connector).
- **Tokens auto-federate; media is curated.** The DTCG token export flows into the feed
  automatically; boards never do - they are search-and-import only, so drafts don't flood
  the catalog. Board rendering needs the Penpot **exporter** reachable at
  `exporterUrl`/`baseUrl`.
- All calls are **host-pinned** to the configured origin (no open proxy).
- Does **not** accept published exports.

See also: [catalog](../catalog.md) · [permissions](../permissions.md).
