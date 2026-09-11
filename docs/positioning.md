# How Lolly compares

What Lolly does that today's creative tools do not, and what it deliberately leaves to them.

For the tool-by-tool version, one page each for Canva, Adobe, Figma, rendering APIs and online converters, see [Lolly compared, tool by tool](/info/compare.html). Each page states what the other tool does better and what Lolly does instead.

> **Pilot status:** Lolly is a closed-pilot prototype, not a finished product, and its security is currently undergoing SUSE's strict infrastructure hardening, preparing for enterprise scale. The [Adoption & Governance](/info/adoption-governance.html#status) page covers the current state.

## Today's tools

Each ring below scores how completely a product class delivers a capability **as shipped today** - not as marketed - with every class scored on its best representative. Lolly is scored with the same knife: it takes the only red ring on the board, for maturity. Open a row name for the reasoning behind its scores. Columns are sorted by the Overall completeness row at the top - the mean of the scored rows, with the spend row excluded.

::: figure positioning-comparison
Capability completeness across today's creative tools, researched August 2026. Scoring: 0 absent, 25 workaround-grade, 50 real but gated or partial, 75 strong with caveats, 100 core competency.
:::

**Scoring notes.** Lolly's scores assume its published claims hold, which is why maturity is its one red ring: closed pilot, security hardening in progress, nothing audited yet. Research moved several cells.

Canva is scored on its best family member per row, since it owns Affinity and Cavalry (both given away October 2025). Offline and on-device rendering score 75 through Affinity - a desktop suite that still needs a verified account and carries telemetry, the deduction Adobe also takes - while Canva's own offline mode edits only pre-synced designs, one device, limited window. Autofill scores 50: real but Enterprise-gated, async, text and image only. Figma's mass generation rose 25 to 50 when Buzz shipped spreadsheet fill (free beta, August 2026).

One rule governs the board: Full (100), on rows that touch your content or identity, needs a capability you can use with no account and no cloud precondition; rows describing the product itself (maturity, ease of use) are exempt. It costs Adobe on provenance: the broadest shipped C2PA (Photoshop, Lightroom, Premiere, Firefly) signs locally and in the cloud, but never without an Adobe account and identity, so 75. It caps the render APIs on mass generation and automation for the same reason.

Lolly's provenance 75 reflects on-device offline signing: architecturally stronger but unaudited, and a device key reads as unverified in stock validators until an identity or an organization's own CA vouches for it. Penpot's 50 arrives through the official Lolly Export plugin: the same engine signing, opt-in, disclosed as Lolly's own. Penpot also takes the board's only off-scale ring, 90 on on-device rendering - browser canvas, save to your own sovereign cloud (even a laptop), private export; only the server hop separates it from Lolly. Cloudinary gets its own column: a media pipeline (DAM, transform API, CDN), and the only cloud column shipping C2PA (50, because fl_c2pa signs on delivery, attesting delivered-by-Cloudinary, not made-by-you).

Live collaboration runs the other way: Figma sets the scale benchmark (200 editors) and Lolly's pairwise, air-gapped P2P scores Partial. Price is a guess, labelled as such: list-price arithmetic on realistic seat mixes, wide on purpose, for scale not procurement. Render APIs take 75 on constraints: templates locked, no brand-governance layer.

The gap: nothing shipping today is constraints-first and offline with no account and no server in the render path, and no one has copied the account clause. Lolly now ships its own open canvas - **Design**, a direct-manipulation free canvas - but colours, type and assets on it conform to the brand globals, so even free arrangement stays constraints-first.

What Lolly still is **not** is an unconstrained design suite; designers will continue to use Illustrator and Figma for bespoke work - and when that work needs to become a governed, reproducible asset, the Design tool's [Import a design](/info/design-import.html) brings the finished Figma, Penpot, Illustrator, InDesign or PDF file onto the canvas as editable, brand-conformed boxes.

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

## Do not use it for

- Bespoke or flagship hero content (billboards, major videos)
- Unique campaign work that genuinely needs a designer
- Ideation that needs to escape the brand system entirely - Lolly's open canvas still conforms colours, type and assets to the brand globals, and that's the point

## Innovate probabilistically, scale deterministically

Most "AI creative" pitches put the model on the wrong side of an old line. Scribes and illuminators already settled where it falls: you work loose on the sketch, where anything can be tried and nothing is committed, and then you go to the printing press, which is intimidating exactly because it commits. The sketches were where the art was. The press was how it travelled. Two instruments, two jobs, each inventive in its own way, and the printed work could be trusted because the press kept its promise on every pull.

Lolly is the press, not the sketch. Bring whatever you like to the ideation - a model, a designer, a napkin - but the moment an idea has to become ten thousand assets it goes through something that renders the same way every time, from inputs anyone can read back. That is what the comparison above is really about: not who has the better generator, but who makes the committed step reproducible.

> Trust the creative process, scale with rigour.

## Approve the tool, not the file

Every other tool on the board produces a *file* that then has to be checked - a brand manager in a Slack thread, legal on the disclaimer, a round of changes, another review. Lolly moves the approval **one step upstream**. The brand rules - exact hex codes, licensed font files, bleed margins, spacing - are hard-coded into the tool's HTML and CSS, so the template *cannot* emit an off-brand asset. The layout itself does the enforcing.

So you stop approving outputs and start approving the **tool** that makes them. Approve it once, and every asset it ever produces is pre-approved by construction - no human in the loop, no review cycle, at any volume.

This is the change the deterministic engine actually delivers: it isn't a faster version of the old approval process, it removes the process. For the creative team it's a guard-rail, not a replacement - you still throw the ball (the data, the copy, the image) and the code is the bumper lane that keeps every throw out of the gutter.

![The producer's whole job: type the words. Type, colour and spacing were settled when the tool was approved](/t/url-shot?url=%2F%23%2Ftool%2Fwordmark%3Ftext%3DApproved&width=1440&height=900&dpi=192&waitMs=2000&walker=1&format=svg&dark=1&filename=aud-approve-the-tool)

| Approving assets the old way | Approving the tool, the Lolly way |
|---|---|
| Every finished file is checked, one at a time | The tool is checked once |
| Request → designer builds → brand review → legal check → changes → re-review | One parameter change → finished asset |
| Designer, brand manager, legal and requester all in the loop | The producer, on their own |
| Days per asset | Seconds per asset |
| 10,000 assets = 10,000 review cycles | 10,000 assets = zero (the template was already approved) |

## What this uniquely provides

- **Wild design potential delivered safely in context.** Tools can express adventurous design ideas inside hard coded guard-rails.

- **Software-defined content automation that returns the final asset.** Input → final file. No "now save it from your design tool and post-process it."
- **Tools compose tools.** One tool can embed another tool's render and return it as part of a single finished asset, with no tool-to-tool code coupling - a primitive no open-canvas or DAM-templating product on the board offers.
- **Vendor neutrality.** Full feature and cost control. Open-source engine. Tools and assets are git-tracked content, not locked in a SaaS database.

The first of those is the one people underestimate. A poster-grade city map, drawn as true vector road and water paths, from a dropdown and two colour fields that cannot be pointed outside the brand:

![Amsterdam's canal rings and road network drawn edge to edge in the brand's own ink, every stroke placed by the template rather than by hand](/t/url-shot?url=%2F%23%2Ftool%2Fstreet-map%3Fcity%3Damsterdam%26theme%3Dlight%26full&width=1440&height=900&dpi=96&waitMs=3200&walker=1&format=svg&cropSelector=%23tool-canvas&dark=1&filename=ov2-street-map-poster)

## Content sovereignty

There is a name for what the previous section adds up to: sovereignty. Your media pipeline runs on hardware you own. Your brand - the tokens, the fonts, the logos, the tools that enforce them - lives in files you hold, in version control you control, not in a vendor's database with an export button. Rendering happens on the device in front of you, so an asset never transits a third party to exist, and the whole path from input to finished file is open source and inspectable. If every SaaS design vendor disappeared tomorrow, a Lolly deployment would not notice.

This matters to anyone whose work should outlive a subscription: the parent whose photo book lives on that laptop as much as the public body whose brand library sits under procurement rules. For organisations - public bodies, regulated industries, anyone whose brand is a strategic asset rather than a decoration - "where does our content live and who can turn it off" is a governance question, not a preference. Sovereignty here is a property of the architecture rather than a hosting feature added for compliance, and the [Privacy Policy](/info/privacy.html) and [Verify It Yourself](/info/verify-yourself.html) pages exist so you can check that claim rather than take it.

Underneath it all is one promise, stated as a commitment rather than a feature: **if it renders on your device, it is free forever.** The engine, the shells, the tools, the formats - the entire on-device creative path is open source and stays that way. That promise has a mechanism: a version that has been released is licensed so it cannot be taken back, and no contributor agreement exists that could relicense the work later. The whole boundary fits in one sentence: everything that renders on your device is free and open source, forever; coordinating people and machines across a network is the job of a separate control plane, [lolly.work](https://lolly.work).
