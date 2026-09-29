# Lolly and rendering APIs

_Last checked: 28 September 2026._

Lolly generates assets from templates and data on your device, in CI or through [lolly.work](https://lolly.work)'s server API. The combined solution covers automated rendering as well as the identity, policy and delivery around an organisation's production jobs.

## Where they overlap

[Bannerbear](https://www.bannerbear.com/) and [Placid](https://placid.app/) generate images and other media from templates through APIs and integrations. Lolly uses the same approach of a template plus inputs, with [URL mode](/info/url-mode.html), the [CLI](/info/cli.html), a batch grid and server endpoints as ways to submit work.

## What lolly.work provides

lolly.work is the separately deployed organisation service in the Lolly project. It runs the Lolly engine behind an API, applies tool visibility and input policies, and serves rendered files and signed sharing links. Its [recoverable render service](https://github.com/lolly-tools/lolly-work/blob/main/docs/renders.md) supports individual jobs and batches, idempotent submission, status, bounded retries, cancellation and retained outputs. Interrupted work can resume after a server restart when persistent storage is configured.

The server uses a fast SVG/PNG render path and an optional Chromium worker for tools that need a browser. Automation authenticates with service tokens, and completed output can be sent through [governed delivery](https://github.com/lolly-tools/lolly-work/blob/main/docs/delivery.md) to organisation destinations. A configured signing identity enables C2PA signing on supported server output.

## Who runs the service

Bannerbear and Placid package rendering as managed services with their own infrastructure and integrations. With Lolly, an individual can render locally or a team can operate lolly.work on its own infrastructure. Both Lolly repositories are MPL-2.0 open source; self-hosting has no per-render software licence charge, while compute, storage and operations remain costs to plan for.

The public lolly.work site is an evaluation sandbox, not a production hosting commitment. A durable service needs persistent database and output storage; browser-dependent tools need the Chromium worker. The [installation guide](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) and [status page](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) describe those requirements and current limits.

Local and CI rendering remain available without the organisation service. Submitting a server job sends its inputs and required assets to that instance; this is distinct from the on-device path. See the [combined-solution overview](/info/compare.html).

Bannerbear and Placid are trademarks of their owners. This page describes where the solutions overlap and is not affiliated with either.
