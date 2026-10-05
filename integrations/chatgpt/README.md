# Lolly plugin

The stable MCP connection is `https://lolly.tools/api/mcp/agents`. It accepts document invitations from any public HTTPS Lolly relay on port 443. It has no account-wide token and stores no active document between calls. Every tool requires the invitation. Each relay enforces the selected document, permission, expiry and editor connection.

In ChatGPT, create a custom MCP server with this URL and No authentication, then install and enable Lolly. Copy a fresh invitation from Share after setup. See the [live installation guide](https://lolly.tools/info/build/mcp.html#install-lolly-in-chatgpt).

This directory contains the Codex-format package for OpenAI's universal plugin directory. Build a submission ZIP with `node scripts/build-agent-plugin.ts`. The output defaults to the local `plans/` directory. No invitations or credentials belong in this package.

Directory submission requires a verified publishing identity, the domain challenge issued by the portal, a successful tool scan, five positive and three negative test cases run through the installed plugin, a public video walkthrough, and the publisher's policy attestations. The package is a draft until those requirements are met. Add review materials to `extensions.com.openai.review` in the manifest when the installed-plugin evaluation and recording are complete. Do not claim publication before the portal approves and publishes the plugin.
