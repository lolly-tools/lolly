# Lolly and Penpot

_Last checked: August 2026._

Lolly is not a replacement for Penpot, though it does what many people need Penpot for: opening a design file, holding a brand's colours and type in one place and getting a finished asset out the other end.

## Where they overlap

Both are open source and both read the same brand primitives. Penpot shipped design tokens natively in 2.6.0 (April 2025), following the W3C DTCG draft, with 17 token types and multidimensional themes; Lolly's brand is a DTCG document too, so one palette serves both. Lolly's [Import a design](/info/design-import.html) opens a `.penpot` export as an editable layout. The Lolly Export plugin for Penpot is Lolly's own work, and it signs C2PA Content Credentials with Lolly's engine, on the device and opt-in - and, like every on-device credential, it reads as unverified in a stranger's validator until [an identity vouches for it](/info/content-credentials-identity.html).

## What Penpot does better today

A full freeform design tool, real-time multiplayer with cursors and presence, plus a community Lolly does not have: 58,680 GitHub stars, 1.5 million users reported by Penpot in March 2026 and monthly releases that reached 2.17.0 in July 2026 with a WASM prototype renderer built on Skia. It is MPL-2.0 and self-hosts free through Docker Compose, an official Helm chart, Kubernetes, OpenShift or Rancher. Penpot states that "the experience stays the same, whether you use Penpot in the cloud or self-hosted", and cloud Professional is free for up to 8 team members, with $7 per user per month capped at $175 above that and $25 per user per month for Enterprise. For drawing a design with other people, Penpot is the more complete answer.

## What Lolly does instead

Cloud and self-hosted Penpot both run against a server; Lolly renders and signs in the page itself, with no server and no account. A Lolly tool is a file you keep in version control rather than a document in a database, so approving the tool once approves every asset it makes, at any volume. What comes out is the production file, in every format Lolly writes, from the browser, the desktop or the terminal.

Penpot is a trademark of its owner. The plugin named above is Lolly's, not Penpot's. See [How Lolly compares](/info/positioning.html) for the capability-by-capability picture and [Lolly compared, tool by tool](/info/compare.html) for the rest of this set.
