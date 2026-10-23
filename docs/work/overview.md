# Lolly Work architecture

Lolly Work is for an organisation that wants its people to share one sign-in, one governed
library and one set of rules, while each person keeps making things on their own device.
Lolly still renders on the device. Every service that has to be hosted lives in Work:
identity, provisioning, governance, the shared catalog, server renders and links, telemetry
and audit. Work serves the Lolly web shell, the governed catalog and the admin console from
one origin.

::: figure work-overview-two-halves
What stays on a person's device, what Work holds and what crosses the network between them.
:::

The idea behind the split: open source gives an individual freedom, and open source with a
control plane gives an organisation the same freedom.

![The admin console overview: 14-day activity, what needs attention, top tools and fleet](shots/overview-dashboard.svg)

Each screenshot in these docs is itself a signed Lolly export: the console rendered to a
vector SVG and signed with a C2PA Content Credential by the deployment's own signing
identity. Hover the imprint in a shot's corner to read what its file claims, then choose
**Check it yourself** to verify the exact bytes on your machine.

## Two codebases, one deployment

| | Lolly (open source, MPL-2.0) | Lolly Work (open source, MPL-2.0) |
|---|---|---|
| What | Engine, tool catalog, shells (web, desktop, mobile, CLI, TUI, extension) | Server, admin console, render worker |
| Docs | `/info/` on any Lolly deployment | the Work guides, also in the console at `/admin#/docs` |
| Runs | On the person's device | On your infrastructure |

Work consumes the open-source engine pinned and unmodified (`vendor/@lolly/engine`,
`vendor/@lolly-tools/core`, with the pin recorded in `engine-pin.json`). The parts of a shell
that talk to Work are additive and dormant by default: a shell with no Work server configured
behaves exactly as it does on its own.

## What Work serves

| Surface | Path | Who |
|---|---|---|
| Lolly web shell | `/` (when `instance.shellDir` is set) | members, and guests on a link |
| Admin console | `/admin` | signed-in members; each view needs its own action |
| Governed catalog | `/catalog/*`, `/api/v1/catalog/*` | per access mode and exposure policy |
| Server renders | `/render/:spec` | holders of `export.server` |
| Signed links | `/l/:id` | anyone holding the link, until it expires or is revoked |
| Org config | `/api/v1/org-config` | connected shells, polled |
| Health and metrics | `/healthz`, `/metrics` | monitoring (metrics needs a token or a loopback caller) |
| SCIM provisioning | `/scim/v2/*` | your identity provider, with a SCIM token ([machine credentials](enterprise-identity.md#scim-provisioning)) |
| Device sign-in | `/activate` | a signed-in member approving a sign-in from the CLI or a native app ([device-code sign-in](identity.md#device-code-sign-in)) |
| Agent connections (MCP) | `/api/workspace/mcp` | document and project agents, with a connection key ([document agents](document-agents.md)) |
| Instance pack download | `/connect/pack.lolly` | anyone on an `open` instance, otherwise members; `404` when no pack is hosted |

A connected shell polls one document, `/api/v1/org-config`. It says who the person is, which
tools they see, which inputs are locked, which profile fields are managed and which feature
flags apply. It is filtered for the caller's groups and carries an `ETag` tied to the policy
version, so a quiet poll answers `304`. [Checking your work](permissions.md#checking-your-work)
shows how to preview it for any set of groups.

<a id="the-trust-model-honestly"></a>

## The trust model

- **Renders happen where the content is trusted.** The in-process (jsdom) fast path never
  runs a tool's `hooks.js` unless an operator turns on `render.allowHooksInFastPath` for a
  pack whose every tool they curate. It is one instance-wide setting, and the server warns at
  boot when it is on for any pack but the demo. Hooked and HTML-heavy tools go to the
  isolated Chromium worker, or are refused with `501 HOOKED_TOOL_NEEDS_CHROMIUM`.
- **Policy is enforced on the server, before rendering.** A locked input is a
  `422 INPUT_LOCKED`, not a hidden field.
- **Sessions are signed tokens with separate domains.** A session token cannot be replayed as
  a guest token, a link signature or an OAuth state. Every member request reads the live
  account, so disabling someone ends their sessions at once. [Offboarding, disable and
  revocation](identity.md#offboarding-disable-and-revocation) covers every way a session
  ends.
- **Telemetry never carries input values.** Below `standard`, or without consent when
  attribution is opt-in, it never carries a user id either.
- **The audit log is hash-chained**, so edits and truncation are detectable, provided you keep
  a copy of the head outside the deployment.

## Where to go next

- Get it running: [install](install.md), then [deployment](deployment.md).
- Set it up: [configuration](configuration.md) and [sign-in](identity.md).
- Decide who can do what: [roles and grants](permissions.md) and [governance](governance.md).
- Keep it running: [operations](operations.md) and the [audit log](audit.md).
- See what is built today: [What Lolly Work does today](status.md).
