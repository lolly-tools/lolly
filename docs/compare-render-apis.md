# Lolly and rendering APIs

_Last checked: 5 November 2026._

If you generate images from templates through an API today, this page says what changes if you run that production yourself: on your own device, in CI or on a server you control. [Move from a hosted render API](/info/work-move-from-render-api.html) is the how.

<!--i:eti-award-->
## What hosted rendering APIs do better

[Bannerbear](https://www.bannerbear.com/) and [Placid](https://placid.app/) are managed services: you send a request and someone else runs the servers.

- **Nothing to operate.** No server, database, storage, updates or capacity planning.
- **A hosted template editor** with templates ready to adapt.
- **More output kinds from one API.** Both publish video and PDF endpoints, and Bannerbear also documents animated output, WebP and AVIF, screenshots and AI background removal.
- **Their own integrations and support.**

If that is the arrangement you want, those services are a sound choice.

<!--i:eti-home-->
## What self-hosting gives you

- **Your content stays on your systems.** Inputs, assets and outputs live on infrastructure you chose. Rendering on a device or in CI needs no service at all.
- **The rules live in the tool.** Colours, type, logos and locked inputs come from your [design system](/info/brand-studio.html), so a caller can only change what you allow. [Lolly Work](/info/compare.html#what-runs-where) applies tool visibility and input policies to every request.
- **The same tool everywhere.** A tool renders on a laptop, in a CI job or on a server from the same inputs, and people can edit the same tool in the app.
- **Records you hold.** [Render receipts](/info/work-renders.html#evidence-and-identity), an audit trail, and Content Credentials where you configure a signing identity.
- **Open source and no meter.** You run the code, and what you pay for is your own infrastructure.

You take on the work those services do for you. A durable server needs a persistent database and output storage, and tools that need a browser need the Chromium worker. [Install Lolly Work](/info/work-install.html) describes both.

<!--i:eti-table-->
## How the jobs line up

| Job | Hosted rendering API | Lolly |
|---|---|---|
| Fill a template from data | API request naming a template and its layers | [URL](/info/url-mode.html), [CLI](/info/cli.html) or [server API](/info/work-automation-api.html) naming a tool and its inputs |
| Many files from a table | Batches and collections | [Batch](/info/batch.html) on your device, or [render batches](/info/work-renders.html#batches-with-durable-rows) on a server |
| Wait or poll for a result | Polling, or a synchronous option | Durable renders you poll, or an immediate render |
| Call a webhook when finished | Yes | [Signed callbacks](/info/work-renders.html) to origins you allow |
| Dynamic image URL | Yes | [Share links and `/render` URLs](/info/url-mode.html) |
| Edit a template | Hosted editor | [Design](/info/using.html), on your device |
| Agents | Both publish an MCP server | [MCP](/info/mcp.html), with an organisation endpoint under a token's policy on Lolly Work |

Lolly's own output kinds are listed in [Exporting](/info/exporting.html). On a Work server today, durable renders make SVG, PNG, JPG and PDF, and [video stays on the device, CLI and MCP](/info/work-renders.html#production-still-checks-and-permitted-repairs).

<!--i:eti-folder-move-->
## What carries across, and what does not

| | Bannerbear V5 | Bannerbear V2 | Placid |
|---|---|---|---|
| Your requests | Work's migration API takes the same shape | Same | Same |
| Your templates | **Import** as editable documents, except layer types with no confirmed schema | Field names and a preview only. Rebuild each one | Field names and a preview only. Rebuild each one |
| Existing dynamic URLs | Not supported | Not supported | Signed URLs keep working after a host change, with your old private token |
| Webhooks | Registered webhooks are not supported | `webhook_url` works | `webhook_success` works |
| WebP and AVIF output | Refused by name | Not offered | WebP refused by name |
| Animations, videos, collections, screenshots | Not on the migration API | Not on the migration API | Not on the migration API |

::: note Built from public documentation
All of this was built from each vendor's public documentation and has not been run against a live account. [The move guide](/info/work-move-from-render-api.html#check-it-on-your-own-account) has a short check list if you hold one.
:::

Moving is not all or nothing. You can move one template and keep the rest where they are, and [leaving Lolly](/info/work-move-from-render-api.html#leave-lolly-too) stays just as open: tools are plain files and the CLI renders them with no server.

<!--i:eti-building-->
## Who runs the service

With Lolly, an individual renders locally, or a team runs Lolly Work on its own infrastructure. Submitting a server job sends its inputs and required assets to that instance, which is different from the on-device path.

Bannerbear and Placid are trademarks of their owners. This page describes where the products overlap, from their public documentation, and is not affiliated with either.
