# Agents in an open document

An AI agent can work inside a document you already have open. It reads the document, makes alternatives and edits alongside you and any other collaborators. You watch each change as it happens, the agent appears in People with its own name, and every edit it makes is one step in your history.

::: note Lolly Work has its own agent invitations
This page covers Lolly's open-source agent relay, which any Lolly deployment can run. A Lolly Work instance invites agents under your Work identity instead, with its own expiry, audit and revocation; see [Invite an agent to a document](/info/work-document-agents.html).
:::

There are four ways in:

| Way in | Where it works | What the agent needs |
|---|---|---|
| [An invitation from Share](#invite-an-agent-from-share) | Any tool, on an instance with an agent relay | The Lolly plugin in ChatGPT, a remote MCP client or Lolly's local MCP server |
| [The desktop app](#in-the-desktop-app) | Design, in the Lolly desktop app on the same computer | Lolly's local MCP server |
| [A pairing code](#in-a-browser-with-a-pairing-code) | Design, in a development build or a self-hosted build that allows it | Lolly's local MCP server |
| [Site tools in the browser](#site-tools-in-the-browser-webmcp) | The page itself, in a browser that supports site tools | The browser's own agent |

## Invite an agent from Share

On an instance with an agent relay, the person who has the document open hands the agent an invitation:

::: timeline
- <!--i:people--> **Open Share > Invite an agent.** Choose **Can edit** or **Can read**, and give the agent a name if you like; People shows that name when the agent joins. **Can edit** appears only when you can edit the document yourself.
- <!--i:link--> **Choose Copy agent instructions.** The instructions carry the invitation, the tool's guidance and the setup steps for each kind of agent.
- <!--i:sparkle--> **Paste them to your agent.** The agent calls `lolly_live_connect` with the `invitation` and its `client` name, and joins this document, even when several documents and agents use the same relay.
- <!--i:check--> **Watch it work.** The agent appears in People, and each change it makes arrives as one undo step labelled with its name.
:::

The invitation works for ten minutes before an agent joins. A joined connection closes after thirty minutes without a request, and ends when the inviting editor closes. A new invitation starts another connection, and **End agent invitations** in Share ends them all.

How the agent connects depends on what it runs in:

- **ChatGPT** needs the Lolly plugin installed first, because pasting instructions into a chat cannot install tools. [Install Lolly in ChatGPT](/info/mcp.html#install-lolly-in-chatgpt) has the steps. The installed plugin then passes the same `invitation` on every call.
- **A client that takes a remote MCP URL with bearer headers** can use the relay's `/live/mcp` endpoint directly, with the invitation token as its bearer credential, and call `lolly_live_connect` with `client` only. That endpoint lists only the nine document tools. It has no access to server files, server tokens or rendering outside the invited document.
- **Lolly's local MCP server** calls `lolly_live_connect` with the invitation once, and later calls use that local connection.

On an instance with no relay, Share offers **Agent instructions** instead: the Lolly skill, the tool's guidance and a link that carries the current inputs. That handoff gives the agent no access to the open document; it works from the link.

## In the desktop app

Open Design, choose **Connect an AI agent** in the Lolly menu and turn on **Allow AI control on this device**. The setting is off until you turn it on. While it is on, the app listens on this computer only, and an agent using Lolly's local MCP server finds the app with no code: `lolly_live_connect` connects at once.

## In a browser with a pairing code

An agent using Lolly's local MCP server can pair with Design in a browser. `lolly_live_connect` returns a code such as `52817-K7QF-9XMB`. The person opens Design, chooses **Connect an AI agent** and types the code. The code works once, and three wrong codes end the pairing.

The page then connects to the agent's server on `127.0.0.1`, which accepts pages from lolly.tools, from the sites listed in `LOLLY_LIVE_ORIGINS` and from localhost. The content security policy of the served builds does not allow that connection yet, so this path works in a development build, or in a self-hosted build made with `VITE_LIVE_AGENT=1` whose policy allows `ws://127.0.0.1:*`. On an instance with a relay, **Connect an AI agent** opens Share to make an invitation instead.

## What the agent can do

The nine document tools are the same whichever way the agent joined:

| Tool | Does |
|---|---|
| `lolly_live_connect` | Joins the document the `invitation` selects. Without one, connects to the desktop app when Allow AI control is on, or opens a local browser pairing. `client` gives the agent's name in People. |
| `lolly_live_status` | Says whether an editor is connected. With `wait`, waits up to 120 seconds for the person to type the code. |
| `lolly_live_context` | The open tool's input schema, safe current values, permissions, design brief and current design system. In Design it adds the exact layer fields and authoring guidance. Read it before editing. |
| `lolly_live_find` | Compact matches by text, name, kind or stable id. `limit` and `offset` page the results. |
| `lolly_live_document` | The open tool, its capabilities, inputs, canvas size and revision. In Design it adds rows with stable ids and the selection; `ids`, `artboardId`, `selection` and `fields` read only the part you need. Uploaded file bytes are left out. |
| `lolly_live_apply` | One edit: `inputValues` for the tool's declared inputs, or `layerOperations` and `layerPatches` in Design, as `lolly_render` takes them. Pass `documentId`, `ifRevision` and `transactionId`. The edit is one undo step labelled with the agent's name and your `label`. A retry with the same transaction id and arguments returns its original receipt without another history entry. |
| `lolly_live_look` | The document as it draws now, with the same labelled grid as `lolly_look`, or one region enlarged. Nothing is exported. |
| `lolly_live_undo` | Undoes the agent's own newest edit. When the newest change is the person's, the call is refused and nothing changes. |
| `lolly_live_disconnect` | Ends the connection. The person can also end it from the editor at any time. |

In Design the agent edits layers. In any other tool it edits the tool's declared inputs with plain JSON values; files and uploaded pictures cannot be supplied that way. `lolly_live_context` and `lolly_live_document` list the inputs the agent can change (`editableInputIds`) and the ones left out (`omittedInputs`).

A few Design patterns cover most requests:

- **A slide alternative.** Find the source artboard, read its children, then use a `duplicate` operation with a new artboard id and a complete `childIds` map. Patch the new title and positions in the same apply.
- **New content in a frame.** Add a `text` or `image` layer with `$in` set to that artboard's id; the coordinates are relative to that frame. An agent can supply its own picture as an inline data image in the `image` field, within the request's 4 MB limit.
- **Text in the house style.** `$style` resolves against the editor's current design brief.
- **A check before you finish.** Look at the result with `lolly_live_look`.

::: details Receipts, retries and limits
Successful reads, context and apply calls include `structuredContent`. An apply receipt includes the document, transaction, changed ids and the admitted revision; `currentRevision` also reports the document when the reply is sent, including changes made while rendering finished. Each changed row is checked against the tool's manifest before it is admitted. The renderer and hooks still follow the normal tool lifecycle.

The connection keeps its latest 128 receipts. Older transaction ids are refused, so retrying an expired receipt cannot repeat its edit. A connection admits up to 4096 named transactions before another invitation is needed.
:::

## What you see while it works

The agent appears beside people in **People**, with an **AI agent** tag, its own colour and its current activity. Changed layers carry temporary outlines and a note naming the agent. These cues stay outside the artwork and exports.

You stay in charge of the session:

- **Pause agent** in People lets the agent read and refuses its writes, including requests waiting in the editor's queue. **Resume agent** lets it edit again.
- **Disconnect agent** in People ends the connection, and **End agent invitations** in Share ends every invitation you made.
- Agent edits use the ordinary collaboration and history path: other people keep editing, and the agent cannot undo a newer history entry of yours.

Agent presence travels on the inviter's own collaboration connection. Lolly Work 1.1.0 and later keep the agent roster in presence. Older Work servers drop that roster, so other people on those servers see the agent's edits without its name in People or the change cues. Agent edit labels name the agent; the inviting member remains the collaboration author.

## Site tools in the browser (WebMCP)

In a browser that supports site tools (`document.modelContext`), Lolly registers actions that the browser's agent can call on the open page. They use the page's signed-in workspace session, follow the current view and end when the page closes. OpenAI's [Site tools guide](https://learn.chatgpt.com/docs/webmcp) describes compatible clients. Registration runs in the top-level app; embedded tool pages register nothing. Browsers without site tools keep the normal interface.

Start with `lolly_read_context` to learn the active project, tool, design system, inspected asset and available document actions. Use `lolly_search_tools` and `lolly_describe_tool` to find tool ids and exact engine input definitions. Search results include device availability, formats and links; describing the mounted tool includes its current values, and other tools show their engine defaults.

In a mounted Design editor, `lolly_read_document` and `lolly_find_layers` return stable layer ids, selection, canvas size and revision, and `lolly_read_document_context` gives the exact layer field definitions and supported authoring operations. `lolly_apply_document_changes` requires `documentId`, `ifRevision`, `transactionId` and a history `label`; keep the same transaction id and arguments when retrying. Changes use the live editor's validation and become one undo step. `lolly_preview_document` returns the rendered SVG, and `lolly_undo_document_changes` takes back only the browser agent's newest step.

The browser agent appears in People on its first document action, where the person can pause or disconnect the agent. A paused agent can read and cannot edit. Leaving the document closes its agent session, and late requests cannot act in the next view. Other tools support discovery and inspection through these site tools; their inputs stay editable through the ordinary interface.

::: details Projects and assets through site tools
`lolly_read_project` returns paged folders, session summaries and asset ids for the current project. At the Projects root it lists local project folders. `lolly_search_assets` and `lolly_describe_asset` need an explicit `scope`: `project`, `uploads` or `catalog`. Project scope includes local subfolders or the current shared project's ready files. Shared project caches do not appear in uploads scope. Describing a shared file verifies its checksum and prepares the ordinary local asset reference for placement.

Asset results include dimensions, formats, rights, attribution, AI disclosures and author declarations. An author declaration remains the person's own assertion. Credential verification is reported as `not-checked`: discovery does not certify a file. Metadata discovery leaves out original file contents and keeps responses bounded.
:::

The MCP server and project invitations keep working for agents that work independently of an open page.

## Run a document relay

An operator who wants Share invitations on a self-hosted instance runs the relay alongside the web shell.

**The service.** Run the long-lived MCP service with `pnpm run mcp:http`. Its `/live/invitations`, `/live/editor`, `/live/rpc` and `/live/mcp` routes provide invitations, outbound browser WebSockets and scoped document calls. For a relay-only process, run `node services/mcp/src/live-http.ts`, which exposes the invitation routes and `/healthz`; the public rendering gateway stays separate.

**One process.** Keep one relay process: invitation grants and their editor sockets share its memory, and restarting the process ends existing invitations. A gateway deployed as stateless serverless functions cannot own these sockets.

**The web shell.** Build it with `VITE_LIVE_RELAY=https://your-relay.example/live`. Allow the exact HTTPS and WSS relay origins in the shell's `connect-src` policy, and add the shell's origin to the relay's `LOLLY_LIVE_ORIGINS`. Proxy the routes to the long-lived process with WebSocket upgrade support. Production builds offer the Share invitation only when `VITE_LIVE_RELAY` is set, and the discovery record reports the same setting. Development builds use `/live` through Vite's proxy to port 8790.

::: details Beside a Lolly Work deployment
The VM sidecar recipe is `deploy/docker/live-relay.compose.yml`. Apply it beside the Work compose file, with the clean open-source release in `agent-relay-src`, and generate the Work Caddyfile with `--serve-shell --live-relay-upstream live-relay:8790`.
:::

::: details How the relay keeps credentials apart
The browser sends its attachment secret in the first socket frame; agent credentials travel in Authorization headers. A copied invitation keeps the agent secret in its URL fragment. Each grant has separate browser and agent credentials and is bound to one document and one originating editor site. The first agent to join identifies itself on the connection; another agent needs its own invitation.
:::
