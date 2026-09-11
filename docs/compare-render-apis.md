# Lolly and rendering APIs

_Last checked: August 2026._

Lolly is not a replacement for a rendering API like Bannerbear or Placid, though it does what most people need one for: generating many on-brand images from data, automatically.

## Where they overlap

Both produce an image from a template and a set of inputs, driven by a URL or a script. Lolly's [URL mode](/info/url-mode.html) and [CLI](/info/cli.html) do this with no server and no account.

## What those APIs do better today

Hosted infrastructure that scales for you, a managed render queue, and turnkey integrations with the services teams already use. The billing can be honest too: Bannerbear stops rendering at the quota rather than billing past it. If you want someone else to run and scale the renderer, a hosted API is the ready-made answer.

## What Lolly does instead

The same template runs on your own device or in your own CI, free, offline, with the state carried in the URL. None of the six hosted render APIs checked for this page offers a self-hosted version (August 2026); Lolly's renderer is the download. The cost does not disappear - it moves to your own devices and CI minutes - but there is no per-render charge, no quota and nothing leaves your infrastructure. Every output carries Content Credentials (unverified in a stranger's validator until [an identity anchors them](/info/content-credentials-identity.html)). And when a team wants this same engine run as a managed server render instead of running it themselves, that is [lolly.work](https://lolly.work)'s job.

Bannerbear and Placid are trademarks of their owners. This page describes where the tools overlap and is not affiliated with either.
