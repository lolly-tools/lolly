# Lolly and brand portals

_Last checked: 28 September 2026._

If your organisation keeps its approved assets in Bynder, Frontify, Marq or Brandfolder, this page compares that with Lolly plus Lolly Work: how people find brand assets, and how they make new files from them.

## What an established portal does better

Established portals offer managed hosting, support and extensive asset-management workflows. For example, [Frontify's enterprise DAM](https://www.frontify.com/en/solution/enterprise-digital-asset-management) combines asset discovery, access controls, approval workflows and distribution. The Lolly stack is younger and its approval chains are sequential rather than arbitrary branching workflows. [Work status and roadmap](/info/work-status.html) records its deployment limits.

## Where they overlap

Both cover approved assets, locked templates, access control, review and distribution. Lolly makes the files: templates, design tokens and permitted inputs define what someone can change, and rendering can stay on their device. Lolly Work adds identity, shared storage, policy, approvals and reporting on infrastructure the organisation controls.

![The active design system in Settings, shown as a cover and pages: the colours, type and logos every tool draws with](/info/shots/dashboard-brand.svg)

## What Lolly and Lolly Work provide

| Need | Lolly + Lolly Work |
|---|---|
| Sign-in and provisioning | OIDC single sign-on, multiple identity providers, SCIM 2.0 user provisioning and group membership, and account disabling that revokes existing sessions. A SAML-only identity provider can connect through an OIDC bridge such as Keycloak. |
| Approved templates | Lolly defines the template's editable inputs; Lolly Work applies group visibility and input policies that lock values, restrict choices or hide controls. |
| Shared asset library | Instance-owned uploads, collections, custom metadata and access-controlled catalogues, plus connectors that read existing DAM and storage libraries. |
| Review | Ordered approval steps, eligible approver groups, quorum rules and separation of duties; review can govern catalogue submissions and delivery to organisation targets. |
| Asset history and availability | Versions and rollback for instance-owned assets, retention and holds, scheduled availability, expiry and revocation. Connected providers keep their own source history. |
| Licences and credits | Lolly records the licence of each source a file uses and prepares the credits it owes; [Creative rights and credits](/info/creative-rights.html) explains what it records and where credits are written. It does not clear rights. |
| Reporting | Asset-use and download counts, tool and export activity, dashboards and an audit trail. Usage attribution follows the deployment's telemetry policy; the default attribution setting requires consent. |
| Distribution | Expiring, revocable links, shared collections, guest access and delivery to configured organisation destinations. |

[Catalog and content](/info/work-catalog.html), [Approvals](/info/work-approvals.html) and [Policy and governance](/info/work-governance.html) describe these features and their configuration.

## Keeping your existing portal

An existing DAM can stay the source of truth. Lolly Work's catalogue connectors make its approved assets available in Lolly, where people make new files under the organisation's rules. That is an integration choice; Lolly's own library and approvals are there when the organisation wants to run those itself. [What runs where](/info/compare.html#what-runs-where) lists the limits every comparison shares.

See [How Lolly compares](/info/positioning.html) for the capability comparison. Vendor names identify the products being compared; Lolly is not affiliated with them.
