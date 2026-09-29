# Lolly and Penpot

_Last checked: 28 September 2026._

Lolly and Penpot both offer open-source design tools, shared design tokens and live collaboration. Lolly combines on-device creation with [lolly.work](https://lolly.work), its separately deployed organisation service.

## Shared design foundations

[Penpot's design tokens](https://help.penpot.app/user-guide/design-systems/design-tokens/) use the DTCG format, which Lolly also reads. Colours, type and other token values can be shared across the two workflows. Lolly's [Import a design](/info/design-import.html) opens a `.penpot` export as an editable layout.

The Lolly Export plugin for Penpot is maintained by Lolly. It uses Lolly's engine for opt-in C2PA Content Credentials on the device. Signature integrity and trust in the signer are separate: a verifier needs an identity it trusts, as described in [Content Credentials Identity](/info/content-credentials-identity.html).

## Design and team workflows

[Penpot](https://penpot.app/) provides interface design, components, flexible layouts, interactive prototypes and developer inspection. It offers hosted and self-hosted deployments, with [Docker and Kubernetes installation options](https://help.penpot.app/technical-guide/getting-started/).

Lolly's Design canvas creates editable assets and can turn a layout into a [tool with rules](/info/create-a-tool.html). The same tool renders in the browser, desktop app or CLI and can generate variants from data. For teamwork, Lolly has both direct two-device [private collabs](/info/collaborate.html) and work collabs through lolly.work, with shared edits, cursors and saved team sessions.

## How the deployments differ

Standalone Lolly renders and signs on the device without an account or server. lolly.work adds SSO, SCIM provisioning, shared catalogues and projects, roles, approvals, audit records and server rendering. Both repositories are MPL-2.0 open source and can be operated by the organisation. Shared work uses the configured instance; local creation remains available independently.

The choice depends on the work: Penpot's interface-design and prototyping workflow, Lolly's repeatable asset production, or a combination using shared tokens and imported designs. Lolly's work collaboration currently runs on a single server node, and its [deployment status](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) should be part of an organisation's evaluation.

Penpot is a trademark of its owner. The plugin above is Lolly's. See [How Lolly compares](/info/positioning.html) and the [combined-solution overview](/info/compare.html) for the wider comparison.
