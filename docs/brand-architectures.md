# Brand architectures

Organisations arrange their brands in different ways. One company shows a single masterbrand everywhere and gives each division a colour. Another puts its name above every product. A third endorses a brand it bought for a year or two, and a fourth keeps each brand entirely apart. Brand architecture is the name for that arrangement.

Lolly does not ask you which arrangement you have. It gives you a few building blocks, and each arrangement uses them in its own way. Below, each arrangement shows how it looks in the wild, what to do in Lolly today, step by step, and what Lolly cannot do for it yet, with the way to work until then. The logos show well-known organisations that use each arrangement; the step-by-step examples use invented organisations.

::: figure brand-architectures-spectrum
From a branded house, in which the parent is the brand, to a house of brands, in which each brand stands alone. Choose a column to go to its section.
:::

## Which arrangement are you?

Start from the line that sounds most like your work. Most organisations match more than one line: an agency works in white label for its clients and in co-branding at an event, so start from the job in front of you.

| If this sounds like you | Start with |
| --- | --- |
| One name on everything, with teams or divisions that differ by colour or by a descriptor. A public body whose departments share one crest often works this way, and so does a small team or one person with one brand. | [Monolithic](#monolithic) |
| One name above several products, each with its own colour and mark | [Expanded](#expanded) |
| One brand whose lead colour changes from piece to piece, or across a series | [Rotating lead colour](#rotating-lead-colour) |
| A parent with businesses, faculties, chapters or branches that show the parent's name, as many universities, federations of charities and membership bodies do | [Driven](#driven) |
| A brand you bought or launched that shows "by" the parent for a while | [Appended](#appended) |
| Brands with marks of their own that share type, grid and motion | [Apparent](#apparent) |
| Brands that stand alone, related behind the scenes or not at all | [Shadow](#shadow) or [Discrete](#discrete) |
| An agency, studio or freelancer making work for several clients | [White label](#white-label) |
| An event with sponsors, a joint campaign or a reseller programme | [Co-branding](#co-branding), then [Working with partners](/info/partners.html) |
| A partner, reseller or supplier who was sent another organisation's brand | [Working with partners](/info/partners.html#work-in-a-brand-you-were-given) |
| A holiday look, a launch or a yearly conference theme | [Seasons and campaigns](#seasons-and-campaigns) |

Not sure? Start with one design system. [A colourway, a logo identity, or a design system of its own](#a-colourway-a-logo-identity-or-a-design-system-of-its-own) helps you choose the smallest block, and a part can move to a design system of its own later.

## The building blocks

| Block | What it holds | Where |
| --- | --- | --- |
| **Design system** | Colours, type, logos, the rest of the tokens, and versions. Tools, pages and exports follow the active one. | [Design System Setup](/info/brand-studio.html), and **Settings → Preferences → Design systems** to switch or remove |
| **Looks** | Light and dark. Every artefact can be drawn in either. | Built in; the studio derives both. A tool's **Design system** section switches the look when the look changes that tool, and the open tool redraws with no reload |
| **Colourways** | Several lead colours in one design system, each with the colour that sits on it and a partner colour, chosen per artefact. One is canonical. Each person can take a colourway as their own, which colours the app around them and starts their new work in that colourway; without a choice the app uses the canonical one. Tools that draw several colours at once, such as Chart and Mesh Gradient, draw on every lead together. | Made and edited in the **Colours** room: open **Colour roles**, then the **Colourways** row. Chosen per artefact in a tool's **Design system** section, which redraws the open tool with no reload, and taken as your own in **Settings → Appearance**. Rebuilding the palette keeps every colourway. See [Colourways](/info/colourways.html) |
| **Logo identities** | Several named sets of logos in one design system. The main set is "Your logo". | **Logos** room, **+ Add another logo** |
| **Custom marks** | Marks under your own names: a crest, a favicon, a finished lockup, a partner's logo you use often. They belong to the design system and travel in its file. | **Logos** room, **Custom marks** |
| **House rules** | Approved colour pairings, type per role and other rules a composition is checked against. | Written in the token file and listed in the studio's **Rules** room, where **Add rule** adds rules for the example pieces. `lolly check` checks house rules on a saved Design document; see [Rules](/info/brand-studio.html#rules) |
| **Brand skills** | The brand's written standards, one skill per discipline (overall brand, photography, motion and others), for people and AI agents to read. Guidance, not checks: house rules are what Lolly checks. Each design system keeps its own skills under its own name, and colourways share them. A design system without skills of its own has a baseline that Lolly writes from its tokens and house rules. | The **Skills** room in Design System Setup, which reads each skill and downloads it for an agent; `lolly system skills` and Lolly's MCP server list them too. See [Brand skills](/info/brand-skills.html) |
| **Versions** | Permanent named copies of a design system. A link can pin one with `designv`. | **Versions** at the foot of the studio rail |
| **Several design systems** | Any number on one device, one active at a time. A design system travels as a single file. An organisation that runs its own Lolly can supply one to everyone. | **Settings → Preferences → Design systems**; [Move a brand between devices](/info/brand-studio.html#move-a-brand-between-devices) |
| **Reusable tools** | A finished Design document turned into a tool with the inputs you choose. The `.lolly` file carries the resolved colours, fonts and images, so another person's active design system cannot restyle the fixed artwork. | In Design, **Share with rules**; see [Share a design with rules](/info/create-a-tool.html) |
| **Theme groups of other kinds** | A design system can declare groups such as `campaign`, `brand` or `expression`. Lolly keeps them and resolves them as plain theme choices today. | The token file; chosen from a list in a tool's **Design system** section. See [What a theme group means](/info/design-tokens.html#what-a-theme-group-means) |

## Arrangements at a glance

A common way to group arrangements is by how much of the parent brand the audience sees: the parent **unifies** everything, **subsets** into tailored businesses, **endorses** a brand of its own, or **detaches** from the parent altogether. Three more needs cut across the groups: co-branding, white label, and seasons.

| Group | Arrangement | What the audience sees | Use in Lolly today | Not yet |
| --- | --- | --- | --- | --- |
| Unify | Monolithic | One masterbrand, a descriptor and a division colour | One design system with a colourway per division, made in the Colours room and picked per artefact; each person takes their division's colourway as their own in Settings | An organisation setting a division's colourway for its people |
| Unify | Expanded | The masterbrand above each product, each with its own colour and mark | One design system, a colourway and a logo identity per product; each product team takes its colourway as its own in Settings; a template per product with its logo placed | A colourway choosing its logo identity; tools drawing a product's logo; generated product lockups |
| Unify | Rotating lead colour | One brand whose lead colour changes from piece to piece, or shows every lead at once | One design system with colourways, chosen per row in a batch CSV or per file with `--themes` on the command line; charts, gradients and covers draw on every lead | A series that picks colourways by a rule; a colourway control in the batch grid |
| Subset | Driven | The parent's logo with each business's name, tailored by audience | One design system, or a copy per business kept in step with **Review an upstream update** | A business design system that stays linked to the parent |
| Endorse | Appended | A brand's own mark with "by" the parent, for a limited time | A design system for the brand, the endorsed lockup as a custom mark, a published version for the endorsement | Generated endorsement lockups; an end date |
| Endorse | Apparent | Distinct marks that share type, grid and motion | A design system per brand, copied from a shared start and kept in step with **Review an upstream update** | A shared core the brands follow as it changes |
| Detach | Shadow | Related brands that each define themselves | A design system per brand | A record of how they relate |
| Detach | Discrete | Brands with no visible relationship | A design system per brand, switched per job; a saved piece offers to switch back to the design system it was made with | One artefact per brand open side by side |
| Across | Co-branding | A partner's mark on your artwork | The lead brand's design system; the partner's logo placed as an image or a custom mark; Logo Wall for sponsor walls; each brand's skills given to an agent under their own names | The partner's own rules: clear space, minimum size |
| Across | White label | One asset re-skinned for each client | A design system per client, switched per job; a reusable tool per client | Keeping clients apart automatically |
| Across | Seasons and campaigns | A seasonal skin over the core, for a set time | A colourway for a season that changes only the lead colour; a theme group of kind `campaign` with a date window for more, chosen in the tool | Applying the window to new work; scheduling |

## Unify: one brand, many parts

Every part of the business feeds one brand. This suits an organisation that wants the most awareness from every piece it makes, and it gives new products the parent's reputation from the first day.

### Monolithic

One masterbrand goes on everything. A descriptor says which business you are dealing with, and sometimes a colour does too.

::: figure brand-architectures-monolithic
Monolithic brands in the wild: FedEx, GE, Intel and Apple.
:::

**In Lolly:** Northwind is one brand. Northwind Freight is teal and Northwind Air is coral, and both use the same logo, type and templates.

**What to do today:**

1. Make **one design system** for Northwind in [Design System Setup](/info/brand-studio.html).
2. Give each division a **colourway**. In the **Colours** room, open **Colour roles**, press **+ Add** in the **Colourways** row and choose the division's colour from the palette's colours. Choose a colourway's chip to set its roles, and press **Make default** on the colourway most work should start in.
3. People in Freight take the Freight colourway as their own under **Settings → Appearance**. The app they work in takes on the Freight teal, and every piece they start begins in Freight. One design system still serves every division ([Make a colourway your own](/info/colourways.html#make-a-colourway-your-own)).
4. For one piece in another division's colour, pick that colourway's dot in the tool's **Design system** section, which shows the colourway dots in every tool that draws the lead colour.
5. Write each descriptor as text in the template, or add the finished descriptor lockup as a **custom mark** per division.
6. Use **house rules** to approve the division colours.

With the export panel's **Design system** card ticked, an export records the colourway that drew the file, and its description gives the colourway beside the tool, as in *Poster (Freight colourway)*. See [The design-system record](/info/exporting.html#the-design-system-record).

**Not yet:** an organisation cannot set a division's colourway for the people in the division. **Until then:** tell each division which colourway is theirs. One choice in **Settings → Appearance** sets the colourway for each person, and [Sync](/info/sync.html) carries the choice to their other devices.

### Expanded

The masterbrand stays above each product, and every product adds a mark and a colour of its own. Software companies often work this way, because a buyer who trusts one product can find the next one under the same name.

::: figure brand-architectures-expanded
Expanded brands in the wild: Atlassian, Adobe and Google.
:::

**In Lolly:** Northwind Atlas, Northwind Pulse and Northwind Vault each have a colour and a mark, with Northwind above every product name.

**What to do today:**

1. Keep **one design system** and add a **colourway** per product in the **Colours** room.
2. Add a **logo identity** per product in the **Logos** room with **+ Add another logo**, and fill its slots.
3. Add each product's finished masterbrand-above-product lockup as a **custom mark** in that product's identity.
4. Each product team takes its colourway as its own in **Settings → Appearance**, so the app and each new piece start in the product's colour.
5. Use the shared templates for every product.

**Not yet:** a colourway cannot choose its logo identity, and tools draw the main logo set. Lolly does not generate the masterbrand-above-product lockup. **Until then:** place a product's own logo or lockup by hand, then keep that piece as the product's template with **Save as** and **Save as a template** ([Templates](/info/templates.html#save-one-from-a-tool)). Each new piece from the template starts with the product's logo in place, in the product's colourway.

### Rotating lead colour

Some brands keep their logo, type and layout fixed and change the lead colour from piece to piece, or across a series.

::: figure brand-architectures-rotating
Lolly Demo, Lolly's own demonstration design system, has six colourways. Spearmint is the canonical one.
:::

**What to do today:**

1. Make **one design system** with a **colourway** for each lead colour, in the **Colours** room. Each colourway carries its own lead, the colour that sits on it, and a partner, in both light and dark; the room's **Light** and **Dark** switch chooses which look you edit.
2. Mark one colourway canonical with **Make default**. An artefact that chooses none uses the canonical colourway, and so does the app, until a person takes another colourway as their own in **Settings → Appearance**.
3. For a series, give each [batch](/info/batch.html#colourways-and-themes-per-row) row its colourway in the CSV's `_themes` column, such as `{"colourway":"beach"}`. Each row renders in its own colourway, and so does a tool placed inside it, such as a QR code. A saved session keeps its colourway in multi-edit, in a batch and in a Design document export.
4. To export one piece in several colourways from the command line, list them on a `lolly run` command: `--themes=Spearmint,Beach --output=post.png` writes `post-Spearmint.png` and `post-Beach.png` ([One document, every theme](/info/cli-decks.html#one-document-every-theme)).

Pieces that show the whole family at once draw on every lead, canonical first: Chart's series and palettes, Mesh Gradient's shuffle, the Audiogram visualiser's colours and the audio and text covers in Assets. Template authors reach the same leads as `--brand-lead-1` onwards ([Templates and rendering](/info/tool-rendering.html#design-system-colours-in-templates-and-styles)). [Verify](/verify) reads back which colourway drew each piece, from the record an export carries while its **Design system** card is ticked.

**Not yet:** no series, batch or copy flow picks colourways by a rule, and the batch grid has no control for a row's colourway. **Until then:** write each row's colourway into the CSV yourself, in turn or by speaker or product. The engine's rules (cycle, by key, shuffle, by date) exist for scripts; see [Rules for a series](/info/colourways.html#rules-for-a-series).

## Subset: a parent with tailored businesses

The parent's name leads, and each business tailors its material to its own audience. This suits a group that works in several industries at once. Universities with faculties, federations of local charities and membership bodies with branches often work the same way.

### Driven

::: figure brand-architectures-driven
Driven brands in the wild: Tata, Virgin and Mitsubishi.
:::

**In Lolly:** Halcyon shows its own logo with each business's name, and each business tailors the material to its audience.

**What to do today:**

1. When the businesses share everything but the name, use **one design system** and write the business name as text, or add each name lockup as a **custom mark**.
2. When a business needs its own material, give it a **design system of its own**. **Export** the parent's design system from the foot of Design System Setup's rail; the business opens the file with **Add from…**, renames the design system in the studio's header and adds its own logos, colours and files ([Move a brand between devices](/info/brand-studio.html#move-a-brand-between-devices)).
3. Keep the parent's tokens as a file too, with **Tokens (.json)** at the foot of the rail.
4. An organisation that runs its own Lolly can supply the parent's design system to everyone. When its catalogue is not locked, it can also offer each business's design system beside the parent's, and each arrives as an editable copy ([Configuration](/info/configuration.html#supplied-and-local-design-systems)).

**Not yet:** a copy does not stay linked to the parent, so a change to the parent does not reach the businesses by itself. Tailoring by audience beyond colour is not built. **Until then:** when the parent changes, send each business the new **Tokens (.json)** file. In **Tokens → Inspect every token (advanced) → Review an upstream update**, the business gives the earlier file and the new one, reviews what moves and applies. A value the business changed itself comes up as a conflict, with **Keep local** or **Use incoming** to choose, and nothing changes until the business applies ([Review a change](/info/token-workflows.html#review-a-change)). `lolly system sync` does the same in a terminal.

## Endorse: the parent stands behind a brand of its own

### Appended

A brand keeps its own mark and adds the parent's endorsement. After an acquisition this is usually a stage of one to three years, before the brand moves fully into the parent or goes its own way.

::: figure brand-architectures-appended
Appended brands in the wild: Broadcom and Meta.
:::

**In Lolly:** Ferro keeps its own mark and adds "by Halcyon" for its first two years after the acquisition.

**What to do today:**

1. Make a **design system for Ferro**.
2. Make the endorsed lockup from both marks in your drawing tool, and add the lockup as a **custom mark** in the **Logos** room.
3. **Publish a version** while the endorsement runs, and give the version the period in its name, such as *Ferro by Halcyon, 2026 to 2027*.
4. When the endorsement ends, replace the custom mark and publish a new version.

An export drawn from a published version records that version, and *Recreate with these settings* in [Verify](/verify) reopens the tool in the same version. A link that you write with `designv` draws in that version on a device that holds the version; Lolly never writes `designv` into a share link ([Reserved URL parameters](/info/url-parameters.html#design-system-language-and-emoji)).

**Not yet:** Lolly does not generate an endorsement lockup from the two marks, and a design system cannot carry the date an endorsement ends. **Until then:** the version's name records the period, and replacing the custom mark ends the endorsement for new work.

### Apparent

Distinct brands whose parent is so widely known that it does not need to appear. This only works when almost everyone in the audience already knows the parent.

::: figure brand-architectures-apparent
Apparent brands in the wild: Microsoft and Sony.
:::

**In Lolly:** Halcyon Tidal and Halcyon Bloom have distinct marks and colours but share type, grid and motion, and the parent is well known without being shown.

**What to do today:**

1. Make the shared start once: type, spacing, corners and the other tokens every brand shares.
2. **Export** its design system, and bring the file in again as each brand's own design system. Rename each in the studio's header and give each its own marks and colours.
3. Keep the shared start's **Tokens (.json)** file for the next step.

**Not yet:** copies drift apart. Nothing keeps the shared type, grid and motion in step across the brands as the shared start changes. **Until then:** after each change to the shared start, each brand runs **Review an upstream update** with the earlier file and the new one, as in [Driven](#driven).

## Detach: brands that stand alone

Each brand defines itself, and the parent stays out of sight. This suits consumer markets, where shoppers choose the brand on the shelf. It rarely suits selling to businesses, where buyers want to know which company stands behind a product.

### Shadow

Brands that are related behind the scenes but each define themselves for their audience.

::: figure brand-architectures-shadow
Shadow brands in the wild: the Volkswagen Group, and the luxury lines of Honda and Nissan.
:::

**What to do today:**

- Make a **design system per brand**. Lolly keeps each one's tokens, fonts, logos and versions apart.
- Name each design system after its brand, so the list in **Settings → Preferences → Design systems** reads clearly when you switch.

**Not yet:** Lolly does not record that the brands are related. **Until then:** keep the relationship in your own records; nothing the audience sees needs the record.

### Discrete

Brands with no visible relationship at all, often worked on by the same people.

::: figure brand-architectures-discrete
Discrete brands in the wild: Unilever and Procter & Gamble.
:::

**What to do today:**

1. Make a **design system per brand** on the same device: **Make a new one** in **Settings → Preferences → Design systems**, or open each brand's file.
2. Switch per job in **Settings → Preferences → Design systems**, or from the strip of covers in **Settings → Design system**. One active design system applies to the whole device. A link that carries `ds=` switches the device to that design system.
3. Keep each brand's work in a folder of its own in **Projects**.
4. Open a saved piece while another design system is active, and a notice at the top of the tool gives the design system the piece was made with, with a button to switch to it when it is on the device.
5. A Lolly workspace supplies one design system to everyone who joins it, so each brand that needs a workspace has its own.

**Not yet:** an artefact does not own its design system, so two brands cannot be open side by side, and a workspace cannot supply a different design system to different groups of people. **Until then:** finish one brand's piece, then switch. In a terminal, each command takes one design system: `lolly system use <id>` switches the terminal, and `--file=<tokens.json>` holds a design system for one Design run ([Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses)).

## Across the groups

### Co-branding

A sponsor's or partner's mark on your event poster, a reseller's offer under the maker's name or a joint announcement. The **lead brand** is the brand whose design system the piece is made in, and the **partner** is the other brand on the piece.

**What to do today:**

1. Make the piece in the lead brand's design system.
2. Put the partner's logo in **Assets**, then choose it in the tool's image field, or in Design with **Image** from the rail's add menu. For a partner you work with often, add the logo as a **custom mark**, so the logo travels with your design system.
3. For a sponsor or partner wall, use the [Logo Wall](/#/tool/logo-wall) tool. Give each logo a tier, such as "Gold partners", and each tier gets its own rows under its own heading. The CLI builds the wall from a folder of pictures or a CSV ([A sponsor wall with tiers](/info/cli-rendering.html#a-sponsor-wall-with-tiers)).
4. When an agent does the work, give the agent each brand's [brand skills](/info/brand-skills.html) as they are, and say which brand leads. Each brand's skills keep their own names and ids. Lolly does not merge two brands' skills or decide which brand wins.

[Working with partners](/info/partners.html) has the steps for both sides: sharing your brand with a partner, working in a brand you were given, placing a partner's mark and building a logo wall.

**Not yet:** Lolly does not hold the partner's rules (clear space, minimum size, allowed treatments), and the partner's mark is a picture inside the artwork, not a design system of its own. There is no partner kit yet: a light pack that would hold a partner's logos, colours and rules for use inside another brand's work. **Until then:** check the partner's mark against the partner's own guidelines before you export, and leave the clear space their guidelines ask for around the frame you place the mark in.

### White label

One set of assets re-skinned for each client, where no client may see another client's name or mark.

**What to do today:**

1. Make a **design system per client** and switch per job, as in [Discrete](#discrete).
2. Add each client's logos and fonts in that client's design system, in the **Logos** and **Type** rooms, where they stay with that design system. Files you upload to **Assets** belong to the device and are offered whichever design system is active, so a client's marks belong in the Logos room rather than in Assets.
3. Keep each client's work in a Projects folder of its own.
4. Give each client their own design-system file, or a reusable tool made with [Share with rules](/info/create-a-tool.html), which carries the client's resolved colours, fonts and images.
5. Check what an export says about how it was made before you send the file ([Exporting](/info/exporting.html)). An export from a tool records the name of the client's design system: the export panel's **Design system** card shows that name before the file is written; untick the card when a file must not carry the name. Batch and folder exports show no card, so their files carry no name.

**Not yet:** nothing keeps one client's material out of another client's work automatically. Lolly runs on your device, so the gap is a guardrail against mixing material, not access control: anyone at the device can switch. **Until then:** for complete separation, give each client a browser profile of its own, or a separate user account on the computer for the desktop app. Each one holds its own design systems, uploads and saved work.

### Seasons and campaigns

A holiday skin, a launch, a yearly conference theme: an overlay on the core for a set time.

**What to do today:**

- When the season changes only the lead colour, add it as a **colourway** in the **Colours** room, such as *Winter*.
- When it changes more than the lead colour, declare a theme group of kind `campaign` in the token file, with a date window on each option ([the format](/info/design-tokens.html#what-a-theme-group-means)), and bring the file in with **Add from…**.
- Choose the season per artefact in the tool's **Design system** section: a colourway's dot, or the campaign from the list in every tool the campaign changes.
- Publish a **version** to keep a record of the design system as it was.
- An export records the colourway or the campaign option that drew the file.

**Not yet:** nothing applies the window to new work or schedules a campaign. **Until then:** when a seasonal colourway starts, the people working on the season take the colourway as their own in **Settings → Appearance**, so their new work starts in the season's colours, and choose their usual colourway again when the season ends.

## Product architecture

Product architecture is how an organisation builds its product names. Under one masterbrand, a product's name has up to four parts, always in the same order. Each part narrows the one before.

::: figure brand-architectures-name-builder
A product name built up part by part, from a product line to a variant, with a descriptive word or an invented term as the descriptor.
:::

- **Company** is the masterbrand. In a monolithic brand, the logo carries the company name.
- **Domain** is the area of business, such as Freight or Air. Company and domain together make a product line.
- **Descriptor** says what the product is, such as Tracker. Add it to make a product. A descriptor can end in optional parts: a version, such as 3 or 2025, and an edition or tier, such as Pro, Lite or Enterprise.
- **Context** makes a variant. It starts with a small word that says what kind of context follows: **for** a purpose, **with** a feature, or **on** a platform or architecture.

Real names often leave a part out. Microsoft SQL Server 2022 Enterprise goes from the company straight to the descriptor, with no domain. Sony Interactive Entertainment sells its pro controller as PlayStation DualSense Edge, with no company name in front. PlayStation is the domain, like Walkman for Sony's portable players, DualSense is the invented descriptor and Edge is its edition.

The descriptor comes in two styles. Brands that sell to businesses tend to use a descriptive word, such as Tracker or SQL Server, so a buyer can tell at once what the product does. Consumer brands tend to use an invented term, such as Ondaro or DualSense, which can be registered as a trademark where a plain description is hard to protect.

An invented term also travels when a product line changes owner, which matters to a group with a [detach](#detach-brands-that-stand-alone) strategy. A descriptive name leans on the company name, which stays with the seller; an invented term is the part buyers know. IBM introduced ThinkPad in 1992 and sold its PC business to Lenovo in 2005, and Lenovo still sells ThinkPad laptops.

::: figure brand-architectures-portable-name
When a product line changes owner, the company part of its name usually changes. A descriptive name then loses the part buyers knew, and an invented term moves with the product. ThinkPad moved from IBM to Lenovo in 2005.
:::

**In Lolly:** keep the company logo in the design system and write the rest of the name as text in the template, so every piece sets the name in the same type. Add a finished lockup of logo and name as a **custom mark** when a piece needs the name as artwork. A product with an invented name and a mark of its own can have a **logo identity** in the parent's design system. Tools draw the main logo set, so place a product's own logo by hand, as in [Expanded](#expanded). When the product line may move to another owner, give it a **design system of its own**, which travels as one brand pack file ([Move a brand between devices](/info/brand-studio.html#move-a-brand-between-devices)).

## A colourway, a logo identity, or a design system of its own

Choose the smallest block that holds the difference.

1. **Only the colour differs:** a **colourway**. A colourway shares the design system's brand skills, and the team takes the colourway as its own in **Settings → Appearance**.
2. **The colour differs and the part has its own logo:** a **colourway** and a **logo identity** in the same design system.
3. **The part has its own assets, its own tools, its own rules or its own written standards:** a **design system of its own**, which carries its own brand skills.

A part can move down this list as it grows. Moving down means copying material into a new design system; Lolly does not move it for you.

## About the logos

The logos on this page are trademarks of their owners. They appear only to show how real organisations arrange their brands, and none of the owners is connected with Lolly. A product name beside a mark is set in this page's type rather than the owner's. The drawings come from [Simple Icons](https://simpleicons.org) and [gilbarbara/logos](https://github.com/gilbarbara/logos), both CC0, and from public-domain files on [Wikimedia Commons](https://commons.wikimedia.org). Each figure's source lists the file behind every logo.

## Where to go next

- **[Working with partners](/info/partners.html)**: sharing your brand with a partner, working in a brand you were given and sponsor walls.
- **[Colourways](/info/colourways.html)**: how a colourway is chosen and how to add colourways to a design system.
- **[Design System Setup](/info/brand-studio.html)**: logos, colours, versions and copies.
- **[Design Tokens](/info/design-tokens.html)**: the token model every design system is written in.
