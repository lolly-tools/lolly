# How Lolly compares

Compare Lolly's creative tools and lolly.work's organisation services with other ways to design, govern and produce assets.

For individual comparisons with Canva, Adobe, Figma, Penpot, brand portals, rendering APIs and online converters, see [Lolly compared, tool by tool](/info/compare.html). Each page covers the combined solution and identifies which part provides each capability.

## Lolly and lolly.work

**Lolly** provides the engine, apps and tools for creating, editing, converting and exporting on your device. **[lolly.work](https://lolly.work)** is the same project's separately deployed organisation service: SSO, SCIM provisioning, roles and input policies, shared catalogues and projects, approvals, work collaboration, usage reporting, audit records and server rendering. Both are MPL-2.0 open source; lolly.work is maintained in its [own repository](https://github.com/lolly-tools/lolly-work).

An individual can use Lolly without an account or server. An organisation can operate both parts on its own infrastructure. Local rendering remains on the device; shared projects, work collabs, server jobs and delivery use the configured services. The public lolly.work site is an evaluation sandbox. Its [operator documentation](https://github.com/lolly-tools/lolly-work/tree/main/docs) covers durable deployments and current limits.

> **Pilot status:** Lolly is a closed-pilot prototype, not a finished product, and its security is currently undergoing SUSE's strict infrastructure hardening, preparing for enterprise scale. The [Adoption & Governance](/info/adoption-governance.html#status) page covers the current state.

## Today's tools

Each ring below scores how completely a product class delivers a capability, with every class scored on its best representative. The Lolly column covers both Lolly and lolly.work; each row distinguishes local and organisation features. Open a row name for the reasoning behind its score. Columns are sorted by the Overall completeness row at the top - the mean of the scored rows, with the spend row excluded.

::: figure positioning-comparison
Capability comparison: competitor research and scores from August 2026; Lolly + lolly.work coverage reviewed 28 September 2026. Scoring: 0 absent, 25 workaround-grade, 50 real but gated or partial, 75 strong with caveats, 100 core competency.
:::

**Scoring notes.** Available features and production maturity are separate considerations. Lolly's maturity score reflects its pilot status and security hardening; the presence of SSO, approvals or server rendering does not establish a production track record. The feature descriptions below include lolly.work, while competitor scores retain their dated August review.

Canva is scored on its best family member per row, since it owns Affinity and Cavalry (both given away October 2025). Offline and on-device rendering score 75 through Affinity - a desktop suite that still needs a verified account and carries telemetry, the deduction Adobe also takes - while Canva's own offline mode edits only pre-synced designs, one device, limited window. Autofill scores 50: real but Enterprise-gated, async, text and image only. Figma's mass generation rose 25 to 50 when Buzz shipped spreadsheet fill (free beta, August 2026).

One rule governs the board: Full (100), on rows that touch your content or identity, needs a capability you can use with no account and no cloud precondition; rows describing the product itself (maturity, ease of use) are exempt. It costs Adobe on provenance: the broadest shipped C2PA (Photoshop, Lightroom, Premiere, Firefly) signs locally and in the cloud, but never without an Adobe account and identity, so 75. It caps the render APIs on mass generation and automation for the same reason.

Lolly's provenance 75 includes optional on-device signing and lolly.work's server signing with a configured organisation identity. Signature integrity and signer trust are separate: a verifier must trust the certificate's root to identify the signer as trusted. Penpot's 50 arrives through the Lolly Export plugin: the same engine signing, opt-in, disclosed as Lolly's own. Penpot scores 90 on on-device rendering: browser canvas with a save target on its server, which can be self-hosted. Cloudinary gets its own column for its DAM, transform API and CDN; the August review scored its delivery signing at 50.

Lolly's live collaboration includes direct two-device private collabs and authenticated work collabs through lolly.work, with shared edits, cursors and saved team sessions. The Partial score reflects the current single-node work deployment and limited operating history, rather than an absence of team editing. Price estimates are dated list-price arithmetic for scale, not procurement. Lolly and lolly.work carry no per-seat software licence charge; organisation hosting, storage and operations still have costs.

Lolly combines an on-device creative path with optional organisation services. **Design**, its direct-manipulation canvas, can use a design system's colours, type and assets. A finished layout can become a reusable tool whose declared inputs control the changes a recipient can make.

A team can author in Design or bring existing work across: [Import a design](/info/design-import.html) opens supported Figma, Penpot, Illustrator, InDesign and PDF files as editable layouts. Specialist editing and prototyping needs can still determine which authoring tool a designer chooses.

![Design's free canvas, where the colours, faces and assets on offer are the brand's own](/t/url-shot?url=%2F%23%2Ftool%2Fdesign%3Ftemplate%3D__blank__&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&dark=1&filename=aud-open-canvas)

## Use it for

- Rapid generation of operationalised creative assets (event tiles, badges, signatures, alerts)
- Free-form arrangement on the open canvas (Design) when the pieces - colours, type, icons, images - must stay conformed to the brand globals
- Landing a finished Figma, Penpot, Illustrator, InDesign or PDF design (the Design tool's Import a design) so it can be edited, governed and re-rendered deterministically in every Lolly format
- One-to-many "fill in three fields, get the finished asset" flows - including bulk runs from a spreadsheet/CSV in the `/pro` batch grid (paste or import rows, one finished asset per row, download as a zip)
- Always-on, recurring branded outputs
- Things where central control of brand expression matters more than expressive flexibility

Deck Studio is a good measure of the ceiling here: a whole slide deck declared as data, laid out live on the canvas and exported as a native editable PowerPoint.

![Deck Studio in the split view - the deck's slides listed as blocks on the left, the laid-out deck rendering on the right](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## Choosing an authoring workflow

Choose the editor by the operations your design needs: illustration, detailed retouching, prototyping or video production. Lolly's canvas and tools can create original work as well as repeatable assets. Imported designs and shared tokens let a team combine Lolly with specialist applications, while lolly.work governs shared assets, review and delivery.

## Innovate probabilistically, scale deterministically

Most "AI creative" pitches put the model on the wrong side of an old line. Scribes and illuminators already settled where it falls: you work loose on the sketch, where anything can be tried and nothing is committed, and then you go to the printing press, which is intimidating exactly because it commits. The sketches were where the art was. The press was how it travelled. Two instruments, two jobs, each inventive in its own way, and the printed work could be trusted because the press kept its promise on every pull.

Lolly is the press, not the sketch. Bring whatever you like to the ideation - a model, a designer, a napkin - but the moment an idea has to become many assets it goes through something that renders the same way every time, from inputs anyone can read back. That is what the comparison above is really about: not who has the better generator, but who makes the committed step reproducible.

> Trust the creative process, scale with rigour.

## The rules live in the tool and its templates

Lolly puts reusable brand rules in the tool: colours, fonts, bleed margins, spacing and permitted inputs. The template fixes the parts a recipient must not change. lolly.work adds group access and input policies around that template, with approval chains available for catalogue submissions and governed delivery.

Reviewing a tool once makes repeatable production easier: each output inherits its layout rules. Copy, uploaded imagery and usage rights can still need review, and lolly.work supplies shared catalogues and approval workflows for that process.

This is the change the deterministic engine actually delivers. For the creative team it's a guard-rail, not a replacement - you still throw the ball (the data, the copy, the image) and the code is the bumper lane that keeps every throw out of the gutter.

![The producer's whole job: type the words. Type, colour and spacing were settled when the tool was made](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-rules-in-the-tool)

## What this uniquely provides

- **Wild design potential delivered safely in context.** Tools can express adventurous design ideas inside hard coded guard-rails.

- **Software-defined content automation that returns the final asset.** Input → final file. No "now save it from your design tool and post-process it."
- **Tools compose tools.** One tool can embed another tool's render and return it as part of a single finished asset, with no tool-to-tool code coupling - a primitive no open-canvas or DAM-templating product on the board offers.
- **Vendor neutrality.** Full feature and cost control. Open-source engine. Tools and assets are git-tracked content, not locked in a SaaS database.

The first of those is the one people underestimate. A poster-grade city map, drawn as true vector road and water paths, from a dropdown and two colour fields that cannot be pointed outside the brand:

![Amsterdam's canal rings and road network drawn edge to edge in the brand's own ink, every stroke placed by the template rather than by hand](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Content sovereignty

Lolly's creative pipeline can run on hardware you own. Design tokens, fonts, logos and tool definitions are files you can hold in version control. Standalone rendering stays on the device. With lolly.work, shared projects, instance assets, policy and audit records live in the organisation's configured storage, and server rendering runs on its infrastructure. Both parts are open source and inspectable; existing third-party libraries remain optional integrations.

This matters to anyone whose work should outlive a subscription: the parent whose photo book lives on that laptop as much as the public body whose brand library sits under procurement rules. For organisations - public bodies, regulated industries, anyone whose brand is a strategic asset rather than a decoration - "where does our content live and who can turn it off" is a governance question, not a preference. Sovereignty here is a property of the architecture rather than a hosting feature added for compliance, and the [Privacy Policy](/info/privacy.html) and [Verify It Yourself](/info/verify-yourself.html) pages exist so you can check that claim rather than take it.

Underneath it all is one promise, stated as a commitment rather than a feature: **if it renders on your device, it is free forever.** The engine, the shells, the tools and the formats are open source. [lolly.work](https://lolly.work) is open source as well: the same project's separately deployed service for coordinating people, policy, shared work and server production. An organisation pays for the infrastructure and operation it chooses, with no per-seat or per-render software licence charge for self-hosting.
