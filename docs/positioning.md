# How Lolly compares

Lolly makes on-brand files on your own device, with no account. **Lolly Work** is the server for teams: sign-in, shared projects, approvals and server rendering, on machines your organisation runs. Both are open source under MPL-2.0.

Most teams keep the tools they have. A design app supplies the designs, a DAM stays the source of record, and Lolly turns approved inputs into finished files. [Use Lolly with your existing DAM](/info/use-with-dam.html) describes that combination. The idea behind the combination is [content sovereignty](/info/content-sovereignty.html).

<!--i:eti-gauge-->
## Today's tools

Each ring shows how completely a class of product meets one need. Press a **?** beside a row to see the evidence, and the **?** beside the legend to see how the scores work.

::: figure positioning-comparison
Capability comparison. Competitor research from vendor documents, August to 21 November 2026. Lolly and Lolly Work reviewed 21 November 2026. Scoring: 0 absent, 25 workaround, 50 real but gated or partial, 75 strong with caveats, 100 core competency.
:::

::: details Sources for the scores that changed in November 2026
- Canva: [API changelog](https://www.canva.dev/docs/apps/rest-apis/changelog/), [service apps](https://www.canva.dev/blog/developers/canva-service-accounts/), [Brand Controls help](https://www.canva.com/help/brand-control/)
- Adobe: [InDesign API changelog](https://developer.adobe.com/firefly-services/docs/indesign-apis/getting-started/changelog/), [Adobe Express pricing](https://www.adobe.com/express/pricing)
- Figma: [agent and AI credits](https://help.figma.com/hc/en-us/articles/42614902212887), [MCP server](https://developers.figma.com/docs/figma-mcp-server/)
- Frontify and Bynder: [Frontify October 2026 release note](https://news.frontify.com/163371-what-s-new-in-october-2026), [Frontify MCP](https://help.frontify.com/en/articles/14787214-frontify-mcp-beta)
- Bannerbear and Placid: [Bannerbear pricing](https://www.bannerbear.com/pricing/), [Bannerbear changelog](https://www.bannerbear.com/changelog/), [Placid pricing](https://placid.app/pricing)
- Penpot: [self-host pricing](https://penpot.app/pricing/self-host), [releases](https://github.com/penpot/penpot/releases)
- Cloudinary: [content provenance](https://cloudinary.com/documentation/content_provenance_and_authenticity), [pricing](https://cloudinary.com/pricing)
:::

Features and track record are separate rows. Lolly's first public release was 1.0.1 on 30 August 2026, its security has had no independent audit yet and its adoption evidence is a few months old. [Adoption & Governance](/info/adoption-governance.html#status) has the current state.

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

Imported designs and shared design tokens let a team combine Lolly with specialist applications, while Lolly Work governs shared assets, review and delivery.

For teams with a curated DAM, start by keeping that library and its administrators in place. [SUSE's Brandfolder experience](/info/suse-brandfolder.html) records how integration supported adoption and approval change management. DAM vendors and implementation partners can evaluate the same arrangement through [the partner workflow](/info/dam-partners.html).

In **Lolly Markdown Slides** a whole deck is written as data, laid out live and exported as a native, editable PowerPoint file.

![Lolly Markdown Slides in the split view: the deck's slides listed as blocks on the left, the laid-out deck rendering on the right](/t/url-shot?url=%2F%23%2Ftool%2Fdeck-studio&width=1440&height=900&dpi=192&waitMs=2600&walker=1&format=svg&dark=1&filename=ov2-deck-studio-output)

<!--i:eti-shield-check-->
## The rules live in the tool

Lolly puts reusable brand rules in the tool: colours, fonts, bleed margins, spacing and permitted inputs. The template fixes the parts a recipient must not change. Lolly Work adds group access and input policies around that template, with approval chains for catalogue submissions and delivery.

Checking a tool once makes repeatable production easier, because each output inherits its layout rules. Copy, uploaded imagery and usage rights can still need checking, and Lolly Work supplies shared catalogues and approval steps for that. For the creative team the tool is a guard-rail: you still bring the data, the copy and the image, and the tool keeps every result on-brand.

![The producer's whole job: type the words. Type, colour and spacing were settled when the tool was made](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DHello&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&filename=aud-rules-in-the-tool)

Three more differences:

- **The final file, from inputs.** Input in, finished file out, with no "now save it from your design tool and fix it up".
- **Tools compose tools.** One tool can embed another tool's render in a single finished file, with no code coupling between them.
- **Open source.** The engine is open source, and tools, assets and design tokens are files you can keep in version control or manage in Lolly Work, not rows in someone else's database.

Adventurous design survives the guard-rails. This poster-grade city map is true vector road and water paths, from a dropdown and two colour fields that cannot be pointed outside the design system:

![Amsterdam's canal rings and road network drawn edge to edge in the design system's own ink, every stroke placed by the template rather than by hand](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

<!--i:eti-stamp-->
## Innovate probabilistically, scale deterministically

Most "AI creative" pitches put the model on the wrong side of an old line. Scribes and illuminators settled where it falls. You work loose on the sketch, where anything can be tried and nothing is committed. Then you go to the printing press, which commits. The sketches were where the art was, and the press was how it travelled, and the printed work could be trusted because the press kept its promise on every pull.

Lolly is the press. Bring whatever you like to the ideas, a model, a designer or a rough drawing, but the moment an idea has to become many files it goes through something that renders the same way every time, from inputs anyone can read back. The comparison above is really about who makes that committed step repeatable.

> Trust the creative process, scale with rigour.

<!--i:eti-tag-->
## Free forever

**If it renders on your device, it is free forever.** The engine, the shells, the tools and the formats are open source, and a released version cannot be taken back. Lolly Work is open source too. An organisation pays for the infrastructure and operation it chooses, with no per-seat or per-render software licence charge for self-hosting. [Questions & answers](/info/faq.html) tells the story behind the promise.

<!--i:eti-map-pin-->
## Where your content lives

Lolly's creative work can run on hardware you own, and its design tokens, fonts, logos and tools are files you can keep. With Lolly Work, shared projects, assets, policy and audit records live in storage your organisation configures. [Trust](/info/trust.html) explains why that matters, and the [Privacy Policy](/info/privacy.html) and [Verify It Yourself](/info/verify-yourself.html) let you check the claim rather than take our word.

<!--i:eti-grid-->
## Tool by tool

[Lolly compared, tool by tool](/info/compare.html) compares Lolly with Canva, Adobe, Figma, Penpot, brand portals, rendering APIs and online converters, one page each, and sets out [what runs where](/info/compare.html#what-runs-where).
