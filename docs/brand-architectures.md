# Brand architectures

Organisations arrange their brands in different ways. One company shows a single masterbrand everywhere and gives each division a colour. Another puts its name above every product. A third endorses a brand it bought for a year or two, and a fourth keeps each brand entirely apart. Brand architecture is the name for that arrangement.

Lolly does not ask you which arrangement you have. It gives you a few building blocks, and each arrangement uses them in its own way. This page lists the blocks, then walks through each arrangement: what it looks like, how to set it up in Lolly today, and what Lolly cannot do for it yet. The examples use invented organisations.

## The building blocks

| Block | What it holds | Where |
| --- | --- | --- |
| **Design system** | Colours, type, logos, the rest of the tokens, and versions. Tools, pages and exports follow the active one. | [The Brand Studio](/info/brand-studio.html), and **Settings → Design systems** to switch or remove |
| **Looks** | Light and dark. Every artefact can be drawn in either. | Built in; the studio derives both |
| **Colourways** | Several lead colours in one design system, each with the colour that sits on it and a partner colour, chosen per artefact. One is canonical, and the app's own colours always use the canonical one. | The token file today; see [Colourways](/info/token-workflows.html#colourways) |
| **Logo identities** | Several named sets of logos in one design system. The main set is "Your logo". | **Logos** room, **+ Add another logo** |
| **Custom marks** | Marks under your own names: a crest, a favicon, a finished lockup. | **Logos** room, **Custom marks** |
| **House rules** | Approved colour pairings, type per role and other rules a composition is checked against. | The design system's rules; see [Check a composition](/info/brand-studio.html#check-a-composition-against-the-design-system) |
| **Versions** | Permanent named copies of a design system. A link can pin one with `designv`. | **Versions** at the foot of the studio rail |
| **Several design systems** | Any number on one device, one active at a time. A design system travels as a single brand pack file. | **Settings → Design systems**; [Move a brand between devices](/info/brand-studio.html#move-a-brand-between-devices) |
| **Theme groups of other kinds** | A design system can declare groups such as `campaign`, `brand` or `expression`. Lolly keeps them and resolves them as plain theme choices today. | The token file; see [What a theme group means](/info/token-workflows.html#what-a-theme-group-means) |

## Arrangements at a glance

A common way to group arrangements is by how much of the parent brand the audience sees: the parent **unifies** everything, **subsets** into tailored businesses, **endorses** a brand of its own, or **detaches** from the parent altogether. Three more needs cut across the groups: co-branding, white label, and seasons.

| Group | Arrangement | What the audience sees | Use in Lolly today | Not yet |
| --- | --- | --- | --- | --- |
| Unify | Monolithic | One masterbrand, a descriptor and a division colour | One design system, a colourway per division | Picking a colourway from the studio or a tool |
| Unify | Expanded | The masterbrand above each product, each with its own colour and mark | One design system, a colourway and a logo identity per product | A colourway choosing its logo identity; tools drawing a product's logo |
| Unify | Rotating lead colour | One brand whose lead colour changes from piece to piece | One design system with colourways | A series that picks colourways by a rule |
| Subset | Driven | The parent's logo with each business's name, tailored by audience | One design system, or a copy per business | A business design system that stays linked to the parent |
| Endorse | Appended | A brand's own mark with "by" the parent, for a limited time | A design system for the brand, the endorsed lockup as a custom mark | Generated endorsement lockups; an end date |
| Endorse | Apparent | Distinct marks that share type, grid and motion | A design system per brand, copied from a shared start | A shared core the brands keep in step with |
| Detach | Shadow | Related brands that each define themselves | A design system per brand | A record of how they relate |
| Detach | Discrete | Brands with no visible relationship | A design system per brand, switched per job | One artefact per brand open side by side |
| Across | Co-branding | A partner's mark on your artwork | The partner's logo placed as an image | The partner's own rules: clear space, minimum size |
| Across | White label | One asset re-skinned for each client | A design system per client | Keeping clients apart automatically |
| Across | Seasons and campaigns | A seasonal skin over the core, for a set time | A theme group of kind `campaign` with a date window | Choosing it from a picker; scheduling |

## Unify: one brand, many parts

### Monolithic

Northwind is one brand. Northwind Freight is teal and Northwind Air is coral, and both use the same logo, type and templates.

- Make **one design system** for Northwind.
- Give each division a **colourway**, so a Freight poster and an Air poster use the same templates with a different lead colour. The app around them stays on the canonical colourway.
- Write each descriptor as text in the template, or add the finished descriptor lockup as a **custom mark** per division.
- Use **house rules** to approve the division colours.

Not yet: the studio cannot author colourways, and tools have no colourway control, so a colourway is written into the token file today ([the format](/info/token-workflows.html#colourways)).

### Expanded

Northwind Atlas, Northwind Pulse and Northwind Vault each have a colour and a mark, with Northwind above every product name.

- Keep **one design system** and give each product a **colourway**.
- Add a **logo identity** per product with **+ Add another logo**.
- Use the shared templates for every product.

Not yet: a colourway cannot choose its logo identity, and tools draw the main logo set, so a product's own logo is placed by hand. The masterbrand-above-product lockup is not generated; add a finished one as a custom mark.

### Rotating lead colour

Some brands keep their logo, type and layout fixed and change the lead colour from piece to piece, or across a series.

- Make **one design system** with a **colourway** for each lead colour. Each colourway carries its own lead, the colour that sits on it, and a partner, in both light and dark.
- Mark one colourway canonical. An artefact that chooses none uses it, and so does the app.

Not yet: no series, batch or copy flow picks colourways by a rule. The engine's rules (cycle, by key, shuffle, by date) exist for scripts; see [Colourways](/info/token-workflows.html#colourways).

## Subset: a parent with tailored businesses

### Driven

Halcyon shows its own logo with each business's name, and each business tailors the material to its audience.

- Use **one design system** and write the business name as text, when the businesses share everything else.
- Or make a **design system per business**, when each business needs its own material: export the parent's brand pack and bring it in again for each business ([Move a brand between devices](/info/brand-studio.html#move-a-brand-between-devices)).

Not yet: a copy does not stay linked to the parent, so a change to the parent does not reach the businesses. Tailoring by audience beyond colour is not built.

## Endorse: the parent stands behind a brand of its own

### Appended

Ferro keeps its own mark and adds "by Halcyon" for its first two years after the acquisition.

- Make a **design system for Ferro**.
- Add the finished endorsed lockup as a **custom mark**.
- **Publish a version** while the endorsement runs. A link that pins the version with `designv` keeps drawing the endorsed lockup after the endorsement ends.

Not yet: Lolly does not generate an endorsement lockup from the two marks, and a design system cannot carry the date an endorsement ends.

### Apparent

Halcyon Tidal and Halcyon Bloom have distinct marks and colours but share type, grid and motion, and the parent is well known without being shown.

- Make the shared start once, export its **brand pack**, and bring the pack in again as each brand's own design system.

Not yet: copies drift apart. Nothing keeps the shared type, grid and motion in step across the brands.

## Detach: brands that stand alone

### Shadow

Brands that are related behind the scenes but each define themselves for their audience.

- Make a **design system per brand**. Lolly keeps each one's tokens, fonts, logos and versions apart.

Not yet: Lolly does not record that the brands are related.

### Discrete

Brands with no visible relationship at all, often worked on by the same people.

- Make a **design system per brand** on the same device and switch per job in **Settings → Design systems**.
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

Not yet: nothing keeps one client's material out of another client's work automatically. Switching is by hand.

### Seasons and campaigns

A holiday skin, a launch, a yearly conference theme: an overlay on the core for a set time.

- Declare a theme group of kind `campaign` in the token file, with a date window on each option ([the format](/info/token-workflows.html#what-a-theme-group-means)).
- Publish a **version** to keep a record of the design system as it was.

Not yet: no picker offers the campaign, and nothing applies the window to new work or schedules a campaign.

## A colourway, a logo identity, or a design system of its own

Choose the smallest block that holds the difference.

1. **Only the colour differs:** a **colourway**.
2. **The colour differs and the part has its own logo:** a **colourway** and a **logo identity** in the same design system.
3. **The part has its own assets, its own tools or its own rules:** a **design system of its own**.

A part can move down this list as it grows. Moving down means copying material into a new design system; Lolly does not move it for you.

## Where to go next

- **[Token workflows](/info/token-workflows.html#colourways)**: the colourway format and how a colourway is chosen.
- **[The Brand Studio](/info/brand-studio.html)**: logos, colours, versions and copies.
- **[Design Tokens](/info/design-tokens.html)**: the token model every design system is written in.
