# Invite an agent to a document or project

You can let an AI agent read or edit a shared Design document, or a whole shared project, on
your behalf. The agent works with your permissions for a period you choose, from one hour to
seven days, and you can revoke it at any time. It never gets an account of its own.

Everyone in the document sees the agent's name next to yours, and Lolly Work records every call
it makes. Admins can review all agent activity under **Agents** in the console.

::: cols
## An agent can

- Read the document or project you invited it to.
- Edit alongside your collaborators, if you gave it editor access.
- With editor access to a project, create sessions, upload files and sort outputs into folders.
- Act only within your current permissions, which it can never exceed.

## An agent cannot

- Reach other projects, administrator tools or provider credentials.
- Replace a whole session, change membership, or rename or delete project contents.
- Keep working after expiry, revocation, your loss of access or a disabled account.
- Get an account or a project membership of its own.
:::

![An agent invitation: you choose Invite agent, a connection key is shown once, the agent's MCP client keeps it in private settings, the agent works in the document or project with no more than your access, and the audit trail records every call.](/info/diagrams/work-integrations/agent-invite.svg)

## Invite an agent to a document

1. In a shared Design document, open **Collaboration settings** (the sliders button in the live
   room bar) and choose **Invite agent**. **People** has the same button.
2. Give the agent a name, choose **Viewer** (reads the document) or **Editor** (makes changes
   alongside its collaborators), and pick when it expires: 1 hour, 24 hours or 7 days.
3. Choose **Create invitation**. The dialog shows the MCP endpoint and a connection key. Choose
   **Copy MCP configuration**, or **Copy instructions** for a ready-made message, and paste it
   into the agent's private MCP settings.

MCP (Model Context Protocol) is the standard way AI clients connect to tools. This endpoint
belongs to your Work instance; Lolly's public [MCP server](https://lolly.tools/info/build/mcp.html)
for rendering is a different service.

The key is shown only once, and closing the dialog clears it from the page. **Agents with
access** lists every invitation, and you or a project manager can revoke one there. An editor
invitation can never exceed your own current permissions.

## Invite an agent to a project

1. Open a shared project in Lolly and choose the **Agents** tab.
2. Enter an agent name, choose **Can edit** or **Can view**, and pick when the invitation
   expires: one hour, one day or seven days.
3. Choose **Create agent invitation**, then **Copy agent instructions** and send them privately
   to your agent. The connection key is shown only now.

A project invitation covers the project and all its subfolders. A viewer browses sessions and
verified asset files. An editor can also create sessions, edit shared Design documents, upload
files and organise outputs in folders. Each invitation acts under its inviter's current
account, project access and permissions, and it cannot change membership or reach another
project.

The list shows each invitation's inviter, expiry and whether any document connection is live.
The inviter or a project manager can revoke an invitation, which also closes its document
connections. An archived project allows reads only. One person can hold at most 16 active
document and project invitations combined.

## Activity attribution

Collaborators see the agent's name and its inviter in the room. The audit trail records the
invitation and revocation by the member, the agent's connections and disconnections, and every
authenticated tool call, including reads, refused calls and partly accepted edit batches.

Agent events carry `agentId`, `agentLabel`, `invitedBy` (`user:<id>`), `actingFor`, and the
project or document scope from the server's invitation record. Tool-call events add the tool
name, the outcome and operation counts where available. Credentials and document arguments are
never copied into them. Project operations made through REST keep the same attribution.

In the console's Activity timeline, agents stay distinct from people. Each delegated action
identifies the agent and links its inviter to People. You can filter by one agent, and filtering
by a person or group also includes their invited agents. An invitation or revocation stays
attributed to the person who made that change. Older agent events that already identify the inviter are
shown as agent activity without rewriting the audit chain; where the inviter is unknown, the
attribution is left blank.

The record shows who created the invitation. It cannot show which local process launched an
agent, or who later used a forwarded connection key.

## Connect the agent

This part is for whoever sets up the agent's MCP client.

- **Endpoint.** Streamable HTTP MCP at `/api/workspace/mcp`, answering with JSON and offering no
  SSE stream. It accepts MCP protocol versions 2025-03-26, 2025-06-18 and 2025-11-25.
- **Authentication.** Each request sends `Authorization: Bearer <connection key>`. Cookies alone
  do not admit an agent. The endpoint checks any `Origin` header and limits request size and
  rate.
- **The key.** Work stores only a SHA-256 hash of the random key; the plaintext is returned once
  and never listed again. HTTP `DELETE` on the endpoint disconnects the agent's live room
  connection; revoking the invitation invalidates the key.
- **Idle connections.** An idle agent leaves the room after two minutes, and its key stays
  usable until expiry or revocation. Connection checks run only while agents are connected.

## Tools for documents

`read_document` joins the same live room as the human collaborators and returns the durable
revision, the document state and the current editing claims. `apply_document_ops` accepts a
small batch of the existing CanvasOp operations.

- Send `expectedRevision` from the read and a unique `batchId`. Repeat an uncertain batch
  unchanged with the same id; a changed batch needs a new id.
- A revision conflict means read again.
- Check the accepted and rejected ids before claiming an edit succeeded.

Agent edits go through the room's serialized durable queue. The server sets each operation's
origin and checks project permissions, input locks, room limits and human editing claims inside
that queue. Agent edits have their own `agent:<id>` revision actor, while the inviter stays the
accountable user for permissions and session ownership.

## Tools for projects

Start with `read_project`. Sessions and ready assets come in pages with `offset` and `limit`
(default 50, at most 100). Folders include their item references. `unfinishedUploads` lists only
the inviter's active uploads in this project, so an agent can recover a reservation after an
uncertain response, and `fileLimits` reports the upload allowance. Asset entries include
`assetId` and `partCount`.

- **Sessions.** `create_session` takes a name, a tool id, initial inputs and a unique
  `requestId`. Retry with the same arguments: creation and its receipt commit together, so a
  retry returns the original session id without replacing later edits, and changed arguments
  with that id are refused. Each invitation can create at most 1,000 sessions. `read_session`
  returns the saved state. For Design, pass `sessionId` to `read_document` and
  `apply_document_ops`; the same room, locks, claims and receipts apply.
- **Folders.** `create_folder` and `move_project_item` organise sessions and finished files. A
  null `folderId` returns an item to the project root. These tools cannot rename, delete or move
  another project's contents. Folder creation has no retry receipt, so read the project before
  repeating an uncertain one.
- **Files.** These use the project-file service and need durable storage with project files
  turned on. `begin_asset_upload` declares the file, its total checksum and each part's size and
  SHA-256. Send each part with `upload_asset_part` in standard base64, at most 1 MiB decoded,
  then `finish_asset_upload` verifies every byte and returns the asset id. Only the uploader can
  finish. Keep the reservation's file id, and read `unfinishedUploads` before repeating an
  uncertain reservation. `read_asset_part` returns verified bytes from a ready file within a
  daily allowance per inviter. Quotas, pending limits, expiry and folder rules are the same as
  for people ([Upload large files](resumable-uploads.md)).

Project and file tools work on hosts without a live collaboration gateway; editing a shared
Design document needs the gateway. Document invitations made before project invitations keep
their original scope and gain no project tools. The project routes need database migration
`0050_project_agents.sql`.

## Admin visibility

Admins and owners with `audit.export` can open **Agents** in the console (`/admin#/agents`), and
the Overview shows a 14-day agent summary. The Agents view offers 7-, 30- and 90-day windows and
shows each invitation's inviter, project or document scope, role, expiry and status, last use and
tool calls. Recent activity separates succeeded, rejected and partly accepted calls, with durable
operation counts.

Document room presence is a snapshot of the current host. Project-only MCP requests do not
occupy a document room, and hosts without a room bridge report presence as unavailable.

The view reads at most 10,001 agent audit events for the chosen period, reports the newest
10,000, inspects at most 500 agents and shows 100 recent events. Both coverage limits are stated
in the view; shorten the period or use the audit log when one is reached. It refreshes every 15
seconds while visible, keeps a table you are searching or have focused, and stops after you
navigate away or lose permission. The same data comes from
[`GET /api/v1/agents/activity`](api.md#agent-activity), with no credentials, tool arguments or
document contents.

## Reported agent client and model

The Agents inventory shows the last client report in the selected period. Unknown clients keep
the application name they sent; older or unnamed connections show **Not reported**. Search and
CSV export include the client, its version and any model the client reported. Activity badges
belong only to requests carrying that report, so older tool calls are not labelled after the
fact.

::: details Recognised clients and models
Recognisable marks: Claude, Codex, Gemini, Qwen, GLM, DeepSeek, Jev, Laya, Kolibri and Mistral
(including Vibe). Clients with their own names and marks: Cursor, GitHub Copilot, OpenCode,
Cline, Roo Code, Windsurf, OpenClaw, Goose, Continue, Aider, Amazon Q, Factory Droid and VS Code.
Kimi, Grok and Llama are recognised when explicitly reported.

Reported models show their recognised family next to the exact model id, including namespaced
ids such as `Aleph-Alpha/Kolibri-1`, `NandhaKishorM/Laya-1` and `mistralai/devstral-small`.
Recognising a client never implies its model family: OpenCode using Kolibri remains an OpenCode
client.
:::

Lolly reads the standard MCP `initialize.params.clientInfo` fields `name`, `title` and
`version`. A client can also send request-local metadata in
`params._meta["io.modelcontextprotocol/clientInfo"]`. To report the model it is using, a client
sends the optional Lolly extension:

```json
{
  "_meta": {
    "tools.lolly/agent": { "model": "your-exact-model-id", "provider": "provider-name" }
  }
}
```

This is display-only information the client reports, not verified identity or an access
signal. The [MCP initialization spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
identifies the client application, not necessarily its model: Cursor can report a Claude model
while remaining a Cursor client, and a plain Claude Code or Codex client name implies no exact
model.

Only bounded display fields enter the audit metadata; client icons, website URLs and other
implementation fields are discarded. A reconnect without client information clears the earlier
report. Nothing caches a "last client" against a reusable key, so calls from another client never
inherit an earlier client's identity.
