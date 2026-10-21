# Document agent invitations

Members can invite a named agent from a shared Design document. An invitation delegates the member's identity, with viewer or editor access to that document for one hour to seven days. It creates no account or project membership. An editor invitation cannot exceed the member's current permissions. Project access removal, account disablement, expiry and revocation stop access.

The server stores only the SHA-256 hash of the random connection key. The plaintext key is returned once. Keep it in the agent's private MCP configuration. The invitation list never returns the key. The inviter or a project manager can revoke an invitation. HTTP DELETE on the MCP endpoint disconnects the agent's live room connection; revoking the invitation invalidates the key.

The Streamable HTTP MCP endpoint is `/api/workspace/mcp`. Each request uses `Authorization: Bearer <connection key>`. Cookies alone do not admit an agent. The endpoint validates any supplied Origin header, bounds request size and rate, and accepts MCP protocol versions 2025-03-26, 2025-06-18 and 2025-11-25. It returns JSON and does not offer an SSE stream.

`read_document` joins the same live room as human collaborators and returns its durable revision, document state and editing claims. `apply_document_ops` accepts a small batch of the existing CanvasOp operations. Supply `expectedRevision` from the read and a unique `batchId`. Repeat an identical uncertain batch with the same ID; a changed batch needs a new ID. A revision conflict requires another read. Inspect accepted and rejected IDs before claiming an edit succeeded.

Agents commit through the room's serialized durable queue. The server assigns operation origins and checks current project permissions, input locks, room limits and human editing claims inside that queue. Agent edits have their own `agent:<id>` revision actor, while the inviter remains the accountable user for permissions and session ownership. Collaborators see the agent name and inviter in the room. Idle connections leave after two minutes; keys remain usable until expiry or revocation. Connection checks run only while agent connections exist.

An invitation does not expose other projects, administrator tools or arbitrary session replacement. Provider account credentials stay on the server.


## Project agent invitations

Open a shared project in Lolly and choose Agents to invite a named agent across that project and all its subfolders. Viewer invitations browse sessions and verified asset bytes. Editor invitations can also create sessions, edit shared Design documents, upload files and organize outputs in folders. Each invitation acts under its inviter's current account, project access and action permissions. It cannot change membership or reach another project.

The connection key uses the same MCP endpoint and one-time display as document invitations. Lists show the inviter, expiry and whether any document connection is live. The inviter or a project manager can revoke the key and close all its document connections. Expiry, account disablement and lost project access stop subsequent requests. An archived project permits reads only. A person can hold at most 16 active document and project invitations combined.

Start with `read_project`. Sessions and ready assets are paged with `offset` and `limit` (default 50, maximum 100). Folders include their item references. `unfinishedUploads` includes only the inviter's active uploads within this project, so an agent can recover a reservation after an uncertain response. `fileLimits` reports the existing workspace upload allowance. Asset list entries include `assetId` and `partCount`.

Use `create_session` with a name, tool ID, initial inputs and a unique `requestId`. Keep the same arguments when retrying. Creation and its receipt commit together; a retry returns the original session ID without replacing later edits. Changing arguments with that ID is refused. Each invitation can create at most 1000 sessions. `read_session` returns the saved state. For Design, supply `sessionId` to `read_document` and `apply_document_ops`; the same live room, locks, claims and durable receipts apply.

Use `create_folder` and `move_project_item` to organize sessions and finished files. A null `folderId` returns an item to the project root. These tools cannot rename, delete or move another project's contents. Folder creation has no retry receipt: read the project before repeating an uncertain creation.

Files use the existing project-file service and require durable storage with project files enabled. `begin_asset_upload` declares the file metadata, total checksum and each part's size and SHA-256 checksum. Upload each part with `upload_asset_part` using standard base64, at most 1 MiB decoded. `finish_asset_upload` verifies all bytes and returns the asset ID. The uploader alone can complete an upload. Preserve the reservation's file ID; do not repeat an uncertain reservation before reading `unfinishedUploads`. `read_asset_part` returns verified bytes for a ready file and applies a bounded daily allowance per inviter. Upload quotas, pending limits, expiry and folder rules are the same as for people.

Project creation and file tools work on hosts without a live collaboration gateway. Shared Design editing requires the gateway. Existing document invitations keep their original scope and do not gain project tools. Apply migration `0050_project_agents.sql` before serving the new project routes.

## Activity attribution

The audit trail records invitation and revocation by the member, agent connections and disconnections, and every authenticated tool call, including reads, refused calls and partially accepted edit batches. Agent events carry `agentId`, `agentLabel`, `invitedBy` (`user:<id>`), `actingFor`, and the project or document scope from the server’s invitation record. Tool-call events add the tool name, outcome and operation counts when available; credentials and document arguments are not copied into those events. Project operations routed through REST preserve the same agent attribution.

The console activity timeline identifies the agent and links its inviter to People. Agents can be filtered individually; filtering by a person or group also includes their invited agents. Older agent join, leave and project-write events that already identify the inviter are displayed as agent activity. Where the inviter is unknown, the timeline leaves that attribution absent.

This records the user who created the workspace invitation. It cannot identify which local process launched an agent or who later used a forwarded connection key.


## Admin visibility

Admins and owners with `audit.export` can open **Agents** in the control plane
(`/admin#/agents`). The Overview also shows a 14-day agent summary. Agents offers
7-, 30- and 90-day windows, the inviter, project or document scope, delegated role,
invitation expiry/status, last use and per-agent tool calls. Recent activity
separates succeeded, rejected and partially accepted calls, including durable
operation counts. Document room presence is a snapshot of the current host;
project-only MCP requests do not occupy a document room. Hosts without a room
bridge report presence as unavailable.

`GET /api/v1/agents/activity?days=30` uses the audit permission, returns private
uncacheable metadata and excludes credentials, tool arguments and document
contents. It reads at most 10,001 agent audit events for the requested 1–90 days;
reports use the newest 10,000, inspect at most 500 agents and show 100 recent
events. Both coverage limits are explicit in the response and UI. Shorten the
period or use the audit log when either limit is reached. The view refreshes
while visible every 15 seconds, preserves a table being searched or focused,
and stops refreshing after navigation or permission loss.

Agents remain distinct from human users in the Activity timeline. Each delegated
action identifies the agent and its inviter; filtering a person or group also includes
work delegated by that person. An invitation or revocation remains attributed to
the human who performed the action. Legacy agent room events are recognised without
rewriting the audit chain.

## Reported agent client and model

The Agents inventory shows the last client report in the selected period, with
recognizable marks for Claude, Codex, Gemini, Qwen, GLM, DeepSeek, Jev, Laya,
Kolibri and Mistral (including Vibe). Common clients such as Cursor, GitHub
Copilot, OpenCode, Cline, Roo Code, Windsurf, OpenClaw, Goose, Continue, Aider,
Amazon Q, Factory Droid and VS Code have their own names and marks too. Kimi,
Grok and Llama are recognized when explicitly reported. Unknown
clients keep their supplied application name; older or unnamed connections show
**Not reported**. Search and CSV export include the client, version and any
explicitly reported model. Activity badges belong only to requests carrying that
report; older tool calls are not retrospectively labelled.

Lolly reads the standard MCP `initialize.params.clientInfo` fields `name`, `title`
and `version`. A client can also send request-local implementation metadata in
`params._meta["io.modelcontextprotocol/clientInfo"]`. To explicitly report the
model it is currently using, send the optional Lolly extension:

```json
{
  "_meta": {
    "tools.lolly/agent": { "model": "your-exact-model-id", "provider": "provider-name" }
  }
}
```

This is display-only, **client-reported** information, not verified identity or
an access control signal. The [MCP initialization spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
identifies the client application, not necessarily its underlying model.
For example, Cursor can report a Claude model while remaining a Cursor client.
A plain Claude Code or Codex client name does not imply any exact model.

Only bounded scalar display fields enter the agent audit metadata. Arbitrary
client icons, website URLs and other implementation fields are discarded. A
reconnect without client information clears the prior inventory report. There
is no shared “last client” cache attached to a reusable invitation key, so tool
calls from another client do not inherit an earlier client's identity.

Reported models also show their recognized family next to the exact model ID,
including namespaced IDs such as `Aleph-Alpha/Kolibri-1`, `NandhaKishorM/Laya-1`
and `mistralai/devstral-small`. Recognizing a client never implies that it runs
that family of model: OpenCode using Kolibri remains an OpenCode client.
