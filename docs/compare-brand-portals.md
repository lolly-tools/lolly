# Lolly and brand portals

_Positioning updated: 31 October 2026. Vendor capability example checked: 28 September 2026._

If your organisation keeps its approved assets in Bynder, Frontify, Marq or Brandfolder, this page compares that with Lolly plus Lolly Work: how people find brand assets, and how they make new files from them.

## Keeping your existing portal

An existing DAM can stay the source of record. Lolly Work's catalog connectors make a selected part of its library available in Lolly, where people make new files under the organisation's rules. The DAM's supported source constraints and Lolly Work's exposure rules govern access; final output review is a separate decision.

[Use Lolly with your existing DAM](/info/use-with-dam.html) explains the responsibilities and limits. [SUSE's Brandfolder experience](/info/suse-brandfolder.html) records successful integration that supported administrator change management before a planned migration. Keeping the source connected remains a supported choice.

Lolly's purpose is [content sovereignty](/info/content-sovereignty.html), including control over production and the freedom to choose systems. Its own library and approvals support organisations that choose to operate those capabilities themselves. [Lolly for DAM vendors and implementation partners](/info/dam-partners.html) describes how the connected workflow can add value to an existing system of record.

## What an established portal does better

Established portals offer managed hosting, support and extensive asset-management workflows. For example, [Frontify's enterprise DAM](https://www.frontify.com/en/solution/enterprise-digital-asset-management) combines asset discovery, access controls, approval workflows and distribution. The Lolly stack is younger and its approval chains are sequential rather than arbitrary branching workflows. [Lolly Work status and roadmap](/info/work-status.html) records its deployment limits.

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
| A public brand page | Lolly writes a static [brand page](/info/brand-page.html), from Lolly Design System Setup or the command line: logos, colours, type, rules and examples for people, with tokens, `DESIGN.md` and skills for agents. You host the folder, or an administrator turns on [brand page hosting](/info/work-design-system-administration.html#host-a-brand-page) in Lolly Work, which is off by default. |

[Catalog and content](/info/work-catalog.html), [Approvals](/info/work-approvals.html) and [Policy and governance](/info/work-governance.html) describe these features and their configuration.

## Evaluate the combined workflow

Use [the event-card production sequence](/info/dam-production.html) to test source access, permitted edits, output review and delivery with your own library. [What runs where](/info/compare.html#what-runs-where) lists the limits every comparison shares. A source connection does not itself establish a vendor partnership or qualification for every tenant.

See [How Lolly compares](/info/positioning.html) for the capability comparison. Vendor names identify the products being compared; Lolly is not affiliated with them.
