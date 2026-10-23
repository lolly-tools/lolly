# Brand architectures

Organisations arrange their brands in different ways. One company shows a single masterbrand everywhere and gives each division a colour. Another puts its name above every product. A third endorses a brand it bought for a year or two, and a fourth keeps each brand entirely apart. Brand architecture is the name for that arrangement.

Lolly does not ask you which arrangement you have. It gives you a few building blocks, and each arrangement uses them in its own way: below, each one shows how it looks in the wild, how to set it up in Lolly today and what Lolly cannot do for it yet. The logos show well-known organisations that use each arrangement; the step-by-step examples use invented organisations.

::: figure brand-architectures-spectrum
From a branded house, in which the parent is the brand, to a house of brands, in which each brand stands alone. Choose a column to go to its section.
:::

## The building blocks

| Block | What it holds | Where |
| --- | --- | --- |
| **Design system** | Colours, type, logos, the rest of the tokens, and versions. Tools, pages and exports follow the active one. | [Design System Setup](/info/brand-studio.html), and **Settings → Preferences → Design systems** to switch or remove |
| **Looks** | Light and dark. Every artefact can be drawn in either. | Built in; the studio derives both. A tool's **Design system** section switches the look when the look changes that tool, and the open tool redraws with no reload |
| **Colourways** | Several lead colours in one design system, each with the colour that sits on it and a partner colour, chosen per artefact. One is canonical, and the app's own colours always use the canonical one. Tools that draw several colours at once, such as Chart and Mesh Gradient, draw on every lead together. | Written in the token file; chosen per artefact in a tool's **Design system** section, which redraws the open tool with no reload. Rebuilding the palette in the studio keeps every colourway. See [Colourways](/info/token-workflows.html#colourways) |
| **Logo identities** | Several named sets of logos in one design system. The main set is "Your logo". | **Logos** room, **+ Add another logo** |
| **Custom marks** | Marks under your own names: a crest, a favicon, a finished lockup. | **Logos** room, **Custom marks** |
| **House rules** | Approved colour pairings, type per role and other rules a composition is checked against. | Written in the token file and listed in the studio's **Usage & rules** room, where **Add rule** adds rules for the example pieces. `lolly check` checks house rules on a saved Design document; see [Usage & rules](/info/brand-studio.html#usage-rules) |
| **Versions** | Permanent named copies of a design system. A link can pin one with `designv`. | **Versions** at the foot of the studio rail |
| **Several design systems** | Any number on one device, one active at a time. A design system travels as a single brand pack file. | **Settings → Preferences → Design systems**; [Move a brand between devices](/info/brand-studio.html#move-a-brand-between-devices) |
| **Theme groups of other kinds** | A design system can declare groups such as `campaign`, `brand` or `expression`. Lolly keeps them and resolves them as plain theme choices today. | The token file; chosen from a list in a tool's **Design system** section. See [What a theme group means](/info/token-workflows.html#what-a-theme-group-means) |

## Arrangements at a glance

A common way to group arrangements is by how much of the parent brand the audience sees: the parent **unifies** everything, **subsets** into tailored businesses, **endorses** a brand of its own, or **detaches** from the parent altogether. Three more needs cut across the groups: co-branding, white label, and seasons.

| Group | Arrangement | What the audience sees | Use in Lolly today | Not yet |
| --- | --- | --- | --- | --- |
| Unify | Monolithic | One masterbrand, a descriptor and a division colour | One design system, a colourway per division, picked per artefact in the tool | Authoring colourways in the studio |
| Unify | Expanded | The masterbrand above each product, each with its own colour and mark | One design system, a colourway and a logo identity per product | A colourway choosing its logo identity; tools drawing a product's logo |
| Unify | Rotating lead colour | One brand whose lead colour changes from piece to piece, or shows every lead at once | One design system with colourways, chosen per row in a batch CSV; charts, gradients and covers draw on every lead | A series that picks colourways by a rule |
| Subset | Driven | The parent's logo with each business's name, tailored by audience | One design system, or a copy per business | A business design system that stays linked to the parent |
| Endorse | Appended | A brand's own mark with "by" the parent, for a limited time | A design system for the brand, the endorsed lockup as a custom mark | Generated endorsement lockups; an end date |
| Endorse | Apparent | Distinct marks that share type, grid and motion | A design system per brand, copied from a shared start | A shared core the brands keep in step with |
| Detach | Shadow | Related brands that each define themselves | A design system per brand | A record of how they relate |
| Detach | Discrete | Brands with no visible relationship | A design system per brand, switched per job | One artefact per brand open side by side |
| Across | Co-branding | A partner's mark on your artwork | The partner's logo placed as an image | The partner's own rules: clear space, minimum size |
| Across | White label | One asset re-skinned for each client | A design system per client | Keeping clients apart automatically |
| Across | Seasons and campaigns | A seasonal skin over the core, for a set time | A theme group of kind `campaign` with a date window, chosen in the tool | Applying the window to new work; scheduling |

## Unify: one brand, many parts

Every part of the business feeds one brand. This suits an organisation that wants the most awareness from every piece it makes, and it gives new products the parent's reputation from the first day.

### Monolithic

One masterbrand goes on everything. A descriptor says which business you are dealing with, and sometimes a colour does too.

::: figure brand-architectures-monolithic
Monolithic brands in the wild: FedEx, GE, Intel and Apple.
:::

**In Lolly:** Northwind is one brand. Northwind Freight is teal and Northwind Air is coral, and both use the same logo, type and templates.

- Make **one design system** for Northwind.
- Give each division a **colourway**, so a Freight poster and an Air poster use the same templates with a different lead colour. The app around them stays on the canonical colourway.
- Pick the division's colourway per piece in the tool's **Design system** section, which shows the colourway dots in every tool that draws the lead colour.
- Write each descriptor as text in the template, or add the finished descriptor lockup as a **custom mark** per division.
- Use **house rules** to approve the division colours.
- With the export panel's **Design system** card ticked, an export records the colourway that drew the file, and its description gives the colourway beside the tool, as in *Poster (Freight colourway)*. See [The design-system record](/info/exporting.html#the-design-system-record).

Not yet: the studio cannot author colourways, so a colourway is written into the token file today ([the format](/info/token-workflows.html#colourways)).

### Expanded

The masterbrand stays above each product, and every product adds a mark and a colour of its own. Software companies often work this way, because a buyer who trusts one product can find the next one under the same name.

::: figure brand-architectures-expanded
Expanded brands in the wild: Atlassian, Adobe and Google.
:::

**In Lolly:** Northwind Atlas, Northwind Pulse and Northwind Vault each have a colour and a mark, with Northwind above every product name.

- Keep **one design system** and give each product a **colourway**.
- Add a **logo identity** per product with **+ Add another logo**.
- Use the shared templates for every product.

Not yet: a colourway cannot choose its logo identity, and tools draw the main logo set, so a product's own logo is placed by hand. The masterbrand-above-product lockup is not generated; add a finished one as a custom mark.

### Rotating lead colour

Some brands keep their logo, type and layout fixed and change the lead colour from piece to piece, or across a series.

::: figure brand-architectures-rotating
Lolly Demo, Lolly's own demonstration design system, has six colourways. Spearmint is the canonical one.
:::

**In Lolly:**

- Make **one design system** with a **colourway** for each lead colour. Each colourway carries its own lead, the colour that sits on it, and a partner, in both light and dark.
- Mark one colourway canonical. An artefact that chooses none uses it, and so does the app.
- Pieces that show the whole family at once draw on every lead, canonical first: Chart's series and palettes, Mesh Gradient's shuffle, the Audiogram visualiser's colours and the audio and text covers in Assets. Template authors reach the same leads as `--brand-lead-1` onwards ([Authoring tools](/info/authoring-tools.html#design-system-colours-in-templates-and-styles)).
- For a series, give each [batch](/info/batch.html#make-many-versions-of-one-design) row its colourway in the CSV's `_themes` column. Each row renders in its own colourway, and so does a tool placed inside it, such as a QR code. A saved session keeps its colourway in multi-edit, in a batch and in a Design document export.
- [Verify](/verify) reads back which colourway drew each piece, from the record an export carries while its **Design system** card is ticked.

Not yet: no series, batch or copy flow picks colourways by a rule, and the batch grid has no control for a row's colourway. The engine's rules (cycle, by key, shuffle, by date) exist for scripts; see [Colourways](/info/token-workflows.html#colourways).

## Subset: a parent with tailored businesses

The parent's name leads, and each business tailors its material to its own audience. This suits a group that works in several industries at once.

### Driven

::: figure brand-architectures-driven
Driven brands in the wild: Tata, Virgin and Mitsubishi.
:::

**In Lolly:** Halcyon shows its own logo with each business's name, and each business tailors the material to its audience.

- Use **one design system** and write the business name as text, when the businesses share everything else.
- Or make a **design system per business**, when each business needs its own material: export the parent's brand pack and bring it in again for each business ([Move a brand between devices](/info/brand-studio.html#move-a-brand-between-devices)).

Not yet: a copy does not stay linked to the parent, so a change to the parent does not reach the businesses. Tailoring by audience beyond colour is not built.

## Endorse: the parent stands behind a brand of its own

### Appended

A brand keeps its own mark and adds the parent's endorsement. After an acquisition this is usually a stage of one to three years, before the brand moves fully into the parent or goes its own way.

::: figure brand-architectures-appended
Appended brands in the wild: Broadcom and Meta.
:::

**In Lolly:** Ferro keeps its own mark and adds "by Halcyon" for its first two years after the acquisition.

- Make a **design system for Ferro**.
- Add the finished endorsed lockup as a **custom mark**.
- **Publish a version** while the endorsement runs. A link that pins the version with `designv` keeps drawing the endorsed lockup after the endorsement ends.
- An export drawn from a published version records that version, and *Recreate with these settings* in [Verify](/verify) reopens the tool in the same version.

Not yet: Lolly does not generate an endorsement lockup from the two marks, and a design system cannot carry the date an endorsement ends.

### Apparent

Distinct brands whose parent is so widely known that it does not need to appear. This only works when almost everyone in the audience already knows the parent.

::: figure brand-architectures-apparent
Apparent brands in the wild: Microsoft and Sony.
:::

**In Lolly:** Halcyon Tidal and Halcyon Bloom have distinct marks and colours but share type, grid and motion, and the parent is well known without being shown.

- Make the shared start once, export its **brand pack**, and bring the pack in again as each brand's own design system.

Not yet: copies drift apart. Nothing keeps the shared type, grid and motion in step across the brands.

## Detach: brands that stand alone

Each brand defines itself, and the parent stays out of sight. This suits consumer markets, where shoppers choose the brand on the shelf. It rarely suits selling to businesses, where buyers want to know which company stands behind a product.

### Shadow

Brands that are related behind the scenes but each define themselves for their audience.

::: figure brand-architectures-shadow
Shadow brands in the wild: the Volkswagen Group, and the luxury lines of Honda and Nissan.
:::

**In Lolly:**

- Make a **design system per brand**. Lolly keeps each one's tokens, fonts, logos and versions apart.

Not yet: Lolly does not record that the brands are related.

### Discrete

Brands with no visible relationship at all, often worked on by the same people.

::: figure brand-architectures-discrete
Discrete brands in the wild: Unilever and Procter & Gamble.
:::

**In Lolly:**

- Make a **design system per brand** on the same device and switch per job in **Settings → Preferences → Design systems**.
- One active design system applies to the whole device. A link that carries `ds=` switches the device to that design system.
- A Lolly workspace supplies one design system to everyone who joins it, so each brand that needs a workspace has its own.

Not yet: an artefact does not own its design system, so two brands cannot be open side by side, and a workspace cannot supply a different design system to different groups of people.

## Across the groups

### Co-branding

A sponsor's or partner's mark on your event poster.

- Place the partner's logo as an image in Design.
- Record where the logo came from and its licence with [creative rights](/info/creative-rights.html).

Not yet: Lolly does not hold the partner's rules (clear space, minimum size, allowed treatments), and the partner's mark is not a design system of its own inside the artwork.

### White label

One set of assets re-skinned for each client, where no client may see another client's name or mark.

- Make a **design system per client** and switch per job.
- Give each client their own brand pack, or the artefacts made in their design system.
- Check what an export says about how it was made before you send the file. See [Exporting](/info/exporting.html).
- An export from a tool records the name of the client's design system. The export panel's **Design system** card shows that name before the file is written; untick the card when a file must not carry the name. Batch and folder exports show no card, so their files carry no name.

Not yet: nothing keeps one client's material out of another client's work automatically. Switching is by hand.

### Seasons and campaigns

A holiday skin, a launch, a yearly conference theme: an overlay on the core for a set time.

- Declare a theme group of kind `campaign` in the token file, with a date window on each option ([the format](/info/token-workflows.html#what-a-theme-group-means)).
- Choose the campaign per artefact from the list in the tool's **Design system** section, in every tool the campaign changes.
- Publish a **version** to keep a record of the design system as it was.
- An export records the campaign option that drew the file, as it records a colourway.

Not yet: nothing applies the window to new work or schedules a campaign.

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

1. **Only the colour differs:** a **colourway**.
2. **The colour differs and the part has its own logo:** a **colourway** and a **logo identity** in the same design system.
3. **The part has its own assets, its own tools or its own rules:** a **design system of its own**.

A part can move down this list as it grows. Moving down means copying material into a new design system; Lolly does not move it for you.

## About the logos

The logos on this page are trademarks of their owners. They appear only to show how real organisations arrange their brands, and none of the owners is connected with Lolly. A product name beside a mark is set in this page's type rather than the owner's. The drawings come from [Simple Icons](https://simpleicons.org) and [gilbarbara/logos](https://github.com/gilbarbara/logos), both CC0, and from public-domain files on [Wikimedia Commons](https://commons.wikimedia.org). Each figure's source lists the file behind every logo.

## Where to go next

- **[Token workflows](/info/token-workflows.html#colourways)**: the colourway format and how a colourway is chosen.
- **[Design System Setup](/info/brand-studio.html)**: logos, colours, versions and copies.
- **[Design Tokens](/info/design-tokens.html)**: the token model every design system is written in.
