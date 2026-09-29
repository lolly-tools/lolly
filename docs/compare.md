# Lolly compared, tool by tool

Lolly covers creative work from a single on-device conversion to a governed organisation's asset production. These pages compare the workflows each product supports, the way it is deployed and the limits that matter when choosing a solution.

_Last checked: 28 September 2026._

## One project, two separately deployed parts

**Lolly** is the engine, apps and tools for creating, editing, converting and exporting. It runs on your device, works offline once the required assets are available, and needs no account for standalone use.

**[lolly.work](https://lolly.work)** is the project's organisation service, maintained in the [lolly-work repository](https://github.com/lolly-tools/lolly-work). It provides SSO, SCIM provisioning, roles and policies, shared catalogues and projects, approvals, work collaboration, usage reporting, audit records and server rendering. Both parts are MPL-2.0 open source. An organisation hosts lolly.work alongside Lolly and decides which services to enable.

The comparisons cover **Lolly + lolly.work**. Features that need the organisation service are identified explicitly. Standalone use keeps files on the device; choosing shared projects, work collaboration, server rendering or delivery sends the relevant data to the configured services. The public lolly.work site is a sandbox; see the [deployment guide](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) and [current status](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) for an organisation deployment.

## Compare by workflow

- [Lolly and Canva](/info/compare-canva.html) - templates, everyday design and shared brand production.
- [Lolly and Adobe](/info/compare-adobe.html) - editing, conversion, professional output and Content Credentials.
- [Lolly and Figma](/info/compare-figma.html) - design, live collaboration and reusable asset production.
- [Lolly and Penpot](/info/compare-penpot.html) - open-source design, shared tokens and organisation workflows.
- [Lolly and brand portals](/info/compare-brand-portals.html) - approved libraries, locked templates, identity, review and reporting.
- [Lolly and rendering APIs](/info/compare-render-apis.html) - automated generation on your device, in CI or through lolly.work.
- [Lolly and online file converters](/info/compare-converters.html) - format conversion on your own device.

For the capability-by-capability view, see [How Lolly compares](/info/positioning.html). Each comparison is dated; a claim that no longer matches either product needs correcting.
