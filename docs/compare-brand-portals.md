# Lolly and brand portals

_Last checked: 28 September 2026._

Lolly and [lolly.work](https://lolly.work) together cover the creation and governance workflows teams use brand portals for: approved assets, locked templates, access control, review and distribution. Compare that combined solution with Bynder, Frontify, Marq or Brandfolder when choosing how people find brand assets and make new ones.

## Creation and organisation services

Lolly's engine and apps make the files. Templates, design tokens and permitted inputs define what someone can change, and rendering can stay on their device. Standalone Lolly needs no account.

lolly.work is the organisation service in the same project, maintained in a [separate repository](https://github.com/lolly-tools/lolly-work) and deployed alongside Lolly. It adds identity, shared storage, policy, approvals and reporting. Both parts are open source under MPL-2.0. The separation lets an individual use Lolly independently and an organisation run the combined solution on infrastructure it controls.

## What the combined solution provides

| Need | Lolly + lolly.work |
|---|---|
| Sign-in and provisioning | OIDC single sign-on, multiple identity providers, SCIM 2.0 user provisioning and group membership, and account disabling that revokes existing sessions. A SAML-only identity provider can connect through an OIDC bridge such as Keycloak. |
| Approved templates | Lolly defines the template's editable inputs; lolly.work applies group visibility and input policies that lock values, restrict choices or hide controls. |
| Shared asset library | Instance-owned uploads, collections, custom metadata and access-controlled catalogues, plus connectors that read existing DAM and storage libraries. |
| Review | Ordered approval steps, eligible approver groups, quorum rules and separation of duties; review can govern catalogue submissions and delivery to organisation targets. |
| Asset history and availability | Versions and rollback for instance-owned assets, retention and holds, scheduled availability, expiry and revocation. Connected providers retain their own source history. |
| Reporting | Asset-use and download counts, tool and export activity, dashboards and an audit trail. Usage attribution follows the deployment's telemetry policy; the default attribution setting requires consent. |
| Distribution | Expiring, revocable links, shared collections, guest access and delivery to configured organisation destinations. |

The [lolly.work operator guides](https://github.com/lolly-tools/lolly-work/tree/main/docs) describe these features and their configuration. They are available capabilities, rather than features that require building another system around Lolly.

## Choosing a portal workflow

Established portals offer managed hosting, support and extensive DAM workflows. For example, [Frontify's enterprise DAM](https://www.frontify.com/en/solution/enterprise-digital-asset-management) combines asset discovery, access controls, approval workflows and distribution. Compare the exact review and rights workflow you need: Lolly provides metadata, access and availability controls, while legal clearance and licence obligations still need an organisation's process. Its approval chains are sequential; they do not model arbitrary branching workflows.

The Lolly stack is younger, and the [lolly.work status page](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) records its deployment limits. In particular, the public lolly.work site is an evaluation sandbox. A durable organisation deployment needs persistent storage and an operator. There is no per-seat software licence charge for self-hosting; infrastructure and administration still cost money.

An existing DAM can also stay the source of truth. lolly.work's catalogue connectors make its approved assets available in Lolly, where people create new files under the organisation's rules. That is an integration choice; Lolly's own library and approvals are available when the organisation wants to manage those workflows itself.

See [How Lolly compares](/info/positioning.html) for the capability comparison and [Lolly compared, tool by tool](/info/compare.html) for the rest of this set. Vendor names identify the products being compared; Lolly is not affiliated with them.
