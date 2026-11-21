# How Lolly compares

Lolly is one open-source project in two parts, both MPL-2.0. **Lolly** is the engine, apps and tools for making, editing, converting and exporting on your device, with no account. **Lolly Work** is the organisation server on your own infrastructure, for sign-in, shared projects, approvals and server rendering.

The organising idea is [content sovereignty](/info/content-sovereignty.html): control over how content is created, governed, stored and moved across chosen systems. Creative applications can supply designs, a DAM can stay the source of record and Lolly can turn permitted inputs and approved assets into new files. [Use Lolly with your existing DAM](/info/use-with-dam.html) describes that combination.

<!--i:eti-gauge-->
## Today's tools

Each ring scores how completely a product class delivers a capability. Each class is scored on its best representative. The Lolly column covers Lolly and Lolly Work together, and each row says which part provides what. Open a row name for the reasoning behind its score. Columns are sorted by the Overall completeness row at the top, the mean of the scored rows without the spend row.

::: note How to read the scores
The scores favour control with no account or cloud requirement. They are not a neutral ranking of product completeness or an enterprise procurement score. When you evaluate a specific workflow, read the capability, deployment and evidence limits separately.

Available features and production maturity are separate. Lolly 1.0.1 shipped as open source on 30 August 2026. Its security has not yet had an independent audit, and its adoption evidence is a few months old. [Adoption & Governance](/info/adoption-governance.html#status) has the current state.
:::

::: figure positioning-comparison
Capability comparison: competitor research and scores from August 2026; Lolly + Lolly Work coverage reviewed 28 September 2026. Scoring: 0 absent, 25 workaround-grade, 50 real but gated or partial, 75 strong with caveats, 100 core competency.
:::

::: details Scoring notes
Single sign-on, approvals or server rendering do not establish a production track record, and the maturity score reflects that. Competitor scores keep their dated August review.

On rows that touch your content or identity, full marks (100) need a capability you can use with no account and no cloud precondition. Rows about the product itself, such as maturity and ease of use, are exempt. This rule limits Adobe to 75 on Content Credentials: the broadest shipped implementation (Photoshop, Lightroom, Premiere, Firefly) signs locally and in the cloud, but never without an Adobe account and identity. The same rule caps the rendering APIs on mass generation and automation.

Canva is scored on its best family member per row. Canva owns Affinity and Cavalry, both given away in October 2025. Offline and on-device rendering score 75 through Affinity, a desktop suite that still needs a verified account and carries telemetry. Adobe takes the same deduction. Canva's own offline mode edits only pre-synced designs, on one device, for a limited time. Autofill scores 50: it is Enterprise-gated and asynchronous, and it fills only text and images. Figma's mass generation rose from 25 to 50 when Buzz shipped spreadsheet fill (a free beta, August 2026).

Lolly's Content Credentials score of 75 covers on-device signing and Lolly Work's server signing with a configured organisation identity. A verifier must still trust the signer ([Content Credentials Identity](/info/content-credentials-identity.html)). Penpot's 50 comes through Lolly's export plugin for Penpot, which uses the same engine signing, opt-in and disclosed as Lolly's. Penpot scores 90 on on-device rendering: a browser canvas that saves to its server, which can be self-hosted. Cloudinary has its own column for its asset library, transform API and CDN. The August review scored its delivery signing at 50.

Lolly's live collaboration includes direct two-device private collabs and authenticated work collabs through Lolly Work, with shared edits, cursors and saved team sessions. The Partial score reflects the current single-node work deployment and short operating history, not an absence of team editing. Price estimates are dated list-price arithmetic for scale, not procurement.
:::

<!--i:eti-hammer-->
## When to reach for Lolly

::: cols
## Reach for Lolly when

- The same kind of file is needed again and again: event tiles, badges, certificates, alerts, social cards
- Many files come from one template and a table of values, in [Lolly Batch](/info/batch.html#make-many-versions-of-one-design) or the CLI
- The colours, type and assets must stay inside the design system, even on an open canvas
- A finished Figma, Penpot, Illustrator, InDesign, Affinity or PDF design should become editable and repeatable ([Import a design](/info/design-import.html))
- The files must be made on your own devices or servers

## Reach for something else when

- The work is detailed photo retouching or illustration
- You are designing and prototyping an application interface
- You need a large stock and template library ready on day one
- You need a managed service with a long track record at scale
:::

Imported designs and shared design tokens let a team use Lolly with specialist applications. Lolly Work governs shared assets, review and delivery.

A team with a curated DAM should start by keeping that library and its administrators in place. [SUSE's Brandfolder experience](/info/suse-brandfolder.html) records how integration supported adoption and approval change management. DAM vendors and implementation partners can evaluate the same arrangement through [the partner workflow](/info/dam-partners.html).

In **Lolly Markdown Slides** a deck is declared as data, laid out live and exported as a native, editable PowerPoint file.

![Lolly Markdown Slides in the split view: the deck's slides listed as blocks on the left, the laid-out deck rendering on the right](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## The rules live in the tool

Lolly puts reusable brand rules in the tool: colours, fonts, bleed margins, spacing and permitted inputs. The template fixes the parts a recipient must not change. Lolly Work adds group access and input policies around that template, with approval chains for catalogue submissions and delivery.

A tool is checked once, and each output inherits its layout rules. Copy, uploaded imagery and usage rights can still need checking. Lolly Work supplies shared catalogues and approval steps for that. For the creative team the tool is a guard-rail: you bring the data, the copy and the image, and the tool keeps every result on-brand.

![The producer's whole job: type the words. Type, colour and spacing were settled when the tool was made](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Three more things set this approach apart:

- **The final file, from inputs.** Inputs produce the finished file. Nobody saves it from a design tool and fixes it afterwards.
- **Tools compose tools.** One tool can embed another tool's render in one finished file. The two tools share no code.
- **Open all the way down.** The engine is open source. Tools, assets and design tokens are files you can keep in version control or manage in Lolly Work, not rows in someone else's database.

Bold design still works inside the guard-rails. This city map poster is vector road and water paths, made from a dropdown and two colour fields that cannot be pointed outside the design system:

![Amsterdam's canal rings and road network drawn edge to edge in the design system's own ink, every stroke placed by the template rather than by hand](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## Innovate probabilistically, scale deterministically

Most "AI creative" pitches put the model on the wrong side of an old line. You work loose on the sketch, where anything can be tried and nothing is committed. Then the printing press commits the work. Printed work could be trusted because the press gave the same result on every pull.

Lolly is the press. An idea can come from a model, a designer or a rough drawing. When the idea must become many files, Lolly renders the files the same way every time, from inputs anyone can read back. The comparison above is about who makes that committed step repeatable.

> Trust the creative process, scale with rigour.

<!--i:eti-tag-->
## Free forever

**If it renders on your device, it is free forever.** The engine, the shells, the tools, the formats and Lolly Work are open source. A released version cannot be taken back. An organisation pays for the infrastructure and operation it chooses. Self-hosting has no per-seat or per-render software licence charge. [Questions & answers](/info/faq.html) tells the story behind the promise.

<!--i:eti-map-pin-->
## Where your content lives

Lolly's creative work can run on hardware you own. Its design tokens, fonts, logos and tools are files you can keep. With Lolly Work, shared projects, assets, policy and audit records live in storage your organisation configures. [Trust](/info/trust.html) explains why that matters. The [Privacy Policy](/info/privacy.html) and [Verify It Yourself](/info/verify-yourself.html) let you check the claim rather than take our word.

<!--i:eti-grid-->
## Tool by tool

[Lolly compared, tool by tool](/info/compare.html) has one page each for Canva, Adobe, Figma, Penpot, brand portals, rendering APIs and online converters. It also sets out [what runs where](/info/compare.html#what-runs-where).
