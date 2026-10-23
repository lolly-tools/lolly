# Lolly compared, tool by tool

If you already use another product, these pages say whether Lolly replaces that product, works alongside it or does not fit your work. Each one starts with what the other product does better.

_Last checked: 28 September 2026._

## Compare by product

- [Lolly and Canva](/info/compare-canva.html) - templates, everyday design and shared brand production.
- [Lolly and Adobe](/info/compare-adobe.html) - editing, conversion, professional output and Content Credentials.
- [Lolly and Figma](/info/compare-figma.html) - design, live collaboration and reusable asset production.
- [Lolly and Penpot](/info/compare-penpot.html) - open-source design, shared tokens and organisation work.
- [Lolly and brand portals](/info/compare-brand-portals.html) - approved libraries, locked templates, identity, review and reporting.
- [Lolly and rendering APIs](/info/compare-render-apis.html) - automated generation on your device, in CI or on a Lolly Work server.
- [Lolly and online file converters](/info/compare-converters.html) - format conversion on your own device.

For the capability-by-capability view, see [How Lolly compares](/info/positioning.html). Each comparison is dated; a claim that no longer matches either product needs correcting.

## What runs where

Every comparison covers two parts of one open-source project. **Lolly** is the engine, apps and tools. **Lolly Work** is the organisation server, maintained in the [lolly-work repository](https://github.com/lolly-tools/lolly-work). Both are MPL-2.0, and an organisation decides which Lolly Work services to turn on.

::: cols
## On your device: Lolly

- No account for standalone use
- Making, editing, converting and exporting
- Works offline once the tools and assets it needs are saved
- Content Credentials signed on the device
- Private collabs between two devices, with no server

## On your organisation's server: Lolly Work

- Single sign-on, SCIM provisioning, roles and policies
- Shared catalogues, team projects and work collabs
- Approvals, usage reporting and audit records
- Server rendering, recoverable jobs and approved delivery
- Server signing with the organisation's identity
:::

Standalone use keeps files on the device. Choosing shared projects, a work collab, a server render or delivery sends the data that feature needs to your organisation's server.

## What every comparison assumes

These limits apply to every page in this set, so they are stated once here:

- **Work collabs run on a single server node today.** Their scale and operating history differ from the long-established hosted products. [Work status and roadmap](/info/work-status.html) records the current limits.
- **The site at [lolly.work](https://lolly.work) is a demo sandbox.** A durable organisation deployment needs persistent storage and an operator; [Install Lolly Work](/info/work-install.html) covers both.
- **There is no per-seat software licence charge** for Lolly or a self-hosted Lolly Work. Hosting, storage and operations still cost money.
- **A signature is not a trusted signer.** A verifier must trust the certificate that signed a file before it shows the signer as trusted; [Content Credentials Identity](/info/content-credentials-identity.html) explains how.
