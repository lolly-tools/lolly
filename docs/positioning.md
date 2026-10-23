# How Lolly compares

Lolly is two parts of one open-source project. **Lolly** is the engine, apps and tools for making, editing, converting and exporting on your device, with no account. **Lolly Work** is the organisation server, run on your own infrastructure, for sign-in, shared projects, approvals and server rendering. Both are MPL-2.0. This page compares the pair with the other ways people design, govern and produce files.

## Today's tools

Each ring scores how completely a product class delivers a capability, with every class scored on its best representative. The Lolly column covers Lolly and Lolly Work together, and each row says which part provides what. Open a row name for the reasoning behind its score. Columns are sorted by the Overall completeness row at the top: the mean of the scored rows, with the spend row excluded.

::: figure positioning-comparison
Capability comparison: competitor research and scores from August 2026; Lolly + Lolly Work coverage reviewed 28 September 2026. Scoring: 0 absent, 25 workaround-grade, 50 real but gated or partial, 75 strong with caveats, 100 core competency.
:::

::: details Scoring notes
Available features and production maturity are separate. Lolly is released: version 1.0 shipped as open source on 30 August 2026, its security has not yet had an independent audit and its adoption evidence is a few months old ([Adoption & Governance](/info/adoption-governance.html#status) has the current state). Having single sign-on, approvals or server rendering does not establish a production track record, so the maturity score reflects that. Competitor scores keep their dated August review.

One rule governs the board. Full marks (100), on rows that touch your content or identity, need a capability you can use with no account and no cloud precondition; rows about the product itself, such as maturity and ease of use, are exempt. That rule costs Adobe on Content Credentials: the broadest shipped implementation (Photoshop, Lightroom, Premiere, Firefly) signs locally and in the cloud, but never without an Adobe account and identity, so 75. It caps the rendering APIs on mass generation and automation for the same reason.

Canva is scored on its best family member per row, since it owns Affinity and Cavalry (both given away in October 2025). Offline and on-device rendering score 75 through Affinity, a desktop suite that still needs a verified account and carries telemetry, the deduction Adobe also takes; Canva's own offline mode edits only pre-synced designs, on one device, for a limited window. Autofill scores 50: real but Enterprise-gated, asynchronous, and text and image only. Figma's mass generation rose from 25 to 50 when Buzz shipped spreadsheet fill (a free beta, August 2026).

Lolly's Content Credentials score of 75 covers on-device signing and Lolly Work's server signing with a configured organisation identity; a verifier must still trust the signer ([Content Credentials Identity](/info/content-credentials-identity.html)). Penpot scores 90 on on-device rendering: a browser canvas with a save target on its server, which can be self-hosted. Cloudinary gets its own column for its asset library, transform API and CDN; the August review scored its delivery signing at 50.

Lolly's live collaboration includes direct two-device private collabs and authenticated work collabs through Lolly Work, with shared edits, cursors and saved team sessions. The Partial score reflects the current single-node work deployment and short operating history, not an absence of team editing. Price estimates are dated list-price arithmetic for scale, not procurement.
:::

## When to reach for Lolly

::: cols
## Reach for Lolly when

- The same kind of file is needed again and again: event tiles, badges, certificates, alerts, social cards
- Many files come from one template and a table of values, in [Batch](/info/using.html#batch-pro-mode) or the CLI
- The colours, type and assets must stay inside the design system, even on an open canvas
- A finished Figma, Penpot, Illustrator, InDesign or PDF design should become editable and repeatable ([Import a design](/info/design-import.html))
- The files must be made on your own devices or servers

## Reach for something else when

- The work is detailed photo retouching or illustration
- You are designing and prototyping an application interface
- You need a large stock and template library ready on day one
- You need a managed service with a long track record at scale
:::

Imported designs and shared design tokens let a team combine Lolly with specialist applications, while Lolly Work governs shared assets, review and delivery.

A whole slide deck shows the ceiling: in **Markdown Slides** a deck is declared as data, laid out live and exported as a native, editable PowerPoint file.

![Markdown Slides in the split view: the deck's slides listed as blocks on the left, the laid-out deck rendering on the right](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

## The rules live in the tool

Lolly puts reusable brand rules in the tool: colours, fonts, bleed margins, spacing and permitted inputs. The template fixes the parts a recipient must not change. Lolly Work adds group access and input policies around that template, with approval chains for catalogue submissions and delivery.

Checking a tool once makes repeatable production easier, because each output inherits its layout rules. Copy, uploaded imagery and usage rights can still need checking, and Lolly Work supplies shared catalogues and approval steps for that. For the creative team the tool is a guard-rail: you still bring the data, the copy and the image, and the tool keeps every result on-brand.

![The producer's whole job: type the words. Type, colour and spacing were settled when the tool was made](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Three more things set this approach apart:

- **The final file, from inputs.** Input in, finished file out, with no "now save it from your design tool and fix it up".
- **Tools compose tools.** One tool can embed another tool's render in a single finished file, with no code coupling between them.
- **Open all the way down.** The engine is open source, and tools, assets and design tokens are files you can keep in version control or manage in Lolly Work, not rows in someone else's database.

Adventurous design survives the guard-rails. This poster-grade city map is true vector road and water paths, from a dropdown and two colour fields that cannot be pointed outside the design system:

![Amsterdam's canal rings and road network drawn edge to edge in the design system's own ink, every stroke placed by the template rather than by hand](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Innovate probabilistically, scale deterministically

Most "AI creative" pitches put the model on the wrong side of an old line. Scribes and illuminators settled where it falls. You work loose on the sketch, where anything can be tried and nothing is committed. Then you go to the printing press, which commits. The sketches were where the art was, and the press was how it travelled, and the printed work could be trusted because the press kept its promise on every pull.

Lolly is the press. Bring whatever you like to the ideas, a model, a designer or a rough drawing, but the moment an idea has to become many files it goes through something that renders the same way every time, from inputs anyone can read back. The comparison above is really about who makes that committed step repeatable.

> Trust the creative process, scale with rigour.

## Free forever

**If it renders on your device, it is free forever.** The engine, the shells, the tools and the formats are open source, and a released version cannot be taken back. Lolly Work is open source too. An organisation pays for the infrastructure and operation it chooses, with no per-seat or per-render software licence charge for self-hosting. [Questions & answers](/info/faq.html) tells the story behind the promise.

## Where your content lives

Lolly's creative work can run on hardware you own, and its design tokens, fonts, logos and tools are files you can keep. With Lolly Work, shared projects, assets, policy and audit records live in storage your organisation configures. [Trust](/info/trust.html) explains why that matters, and the [Privacy Policy](/info/privacy.html) and [Verify It Yourself](/info/verify-yourself.html) let you check the claim rather than take our word.

## Tool by tool

[Lolly compared, tool by tool](/info/compare.html) compares Lolly with Canva, Adobe, Figma, Penpot, brand portals, rendering APIs and online converters, one page each, and sets out [what runs where](/info/compare.html#what-runs-where).
