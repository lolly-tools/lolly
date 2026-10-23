# Lolly and rendering APIs

_Last checked: 28 September 2026._

If you generate images from templates through an API today, this page says how Lolly does the same job on your own device, in CI or on your own server.

## What hosted rendering APIs do better

[Bannerbear](https://www.bannerbear.com/) and [Placid](https://placid.app/) package rendering as managed services, with their own infrastructure, integrations and support. You send a request and someone else runs the servers.

## Where they overlap

Both turn a template plus inputs into media. Lolly takes the inputs from a [link](/info/url-mode.html), the [CLI](/info/cli.html), a batch grid or a server endpoint.

## How Lolly does the overlapping job

The same tool renders on a laptop, in a CI job or on a server, from the same inputs. Local and CI rendering need no service at all.

![Batch export settings: file name, default format, units, DPI and the number of rows to render](/info/shots/use-batch-toolbar.svg)

On a server, [Lolly Work](/info/compare.html#what-runs-where) runs the Lolly engine behind an API and applies tool visibility and input policies. Its [recoverable render service](/info/work-renders.html) supports single jobs and batches, idempotent submission, status, bounded retries, cancellation and retained outputs, and interrupted work resumes after a restart when persistent storage is configured.

The server has a fast SVG and PNG path and an optional Chromium worker for tools that need a browser. Automation signs in with service tokens, finished output can go through [approved delivery](/info/work-delivery.html) to organisation destinations, and a configured signing identity adds Content Credentials to supported output.

## Who runs the service

With Lolly, an individual renders locally, or a team runs Lolly Work on its own infrastructure. Submitting a server job sends its inputs and required assets to that instance, which is different from the on-device path. A durable service needs a persistent database and output storage, and browser-dependent tools need the Chromium worker; [Install Lolly Work](/info/work-install.html) describes both.

Bannerbear and Placid are trademarks of their owners. This page describes where the products overlap and is not affiliated with either.
