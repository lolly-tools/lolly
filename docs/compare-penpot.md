# Lolly and Penpot

_Last checked: 28 September 2026._

If your team designs in Penpot, Lolly works alongside Penpot: both are open source and both read the same design tokens. This page says which job each one is for.

## What Penpot does better

[Penpot](https://penpot.app/) provides interface design, components, flexible layouts, interactive prototypes and developer inspection, with real-time editing and live cursors. It offers hosted and self-hosted deployments, with [Docker and Kubernetes installation options](https://help.penpot.app/technical-guide/getting-started/). For designing an application, Penpot is the tool.

## Where they overlap

[Penpot's design tokens](https://help.penpot.app/user-guide/design-systems/design-tokens/) use the DTCG format, which Lolly also reads, so colours, type and other token values move between the two. Lolly's [Import a design](/info/design-import.html) opens a `.penpot` export as an editable layout, and **Send to Penpot** in Lolly sends a design back as a `.penpot` archive. Lolly also maintains the [Lolly Export plugin for Penpot](https://github.com/lolly-tools/lolly-plugins-penpot-export), which uses Lolly's engine to add opt-in Content Credentials on the device.

## How Lolly does the overlapping job

Lolly's Design canvas makes editable assets and can turn a layout into a [tool with rules](/info/create-a-tool.html). The same tool renders in the browser, the desktop app or the CLI and makes variants from data. Standalone Lolly renders and signs on the device, without an account or a server. A [private collab](/info/collaborate.html) pairs two devices directly.

## With an organisation

Lolly Work adds single sign-on, SCIM provisioning, shared catalogues and projects, roles, approvals, audit records, work collabs and server rendering. Both repositories are MPL-2.0 and an organisation can run both. [What runs where](/info/compare.html#what-runs-where) sets the two parts side by side.

You can use both: Penpot for interface design and prototyping, Lolly for repeatable files, joined by shared tokens and imported designs.

Penpot is a trademark of its owner. This page describes where the two products overlap and is not affiliated with Penpot.
