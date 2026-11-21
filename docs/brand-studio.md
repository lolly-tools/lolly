# Lolly Design System Setup

<a id="design-system-setup"></a>

**Lolly Design System Setup**, at `#/start`, has your logo, colours and typefaces. Every tool, page and export draws with them.

Drop in a logo and Lolly reads its colours. Choose a typeface, or drop the font file your company licenses. Each change shows across the app at once. Your logo, fonts and tokens stay on this device. Only picking a Google Font reaches out: Lolly asks first, then fetches the family once.

Name the design system and press **Export** to get one `.lolly` file. Keep the file, open it on another device or hand it to a colleague. [Lolly Settings](/info/dashboard.html#design-system) shows the active system read-only; its cover links back here for editing.

<!--i:eti-clock-->
## Make it yours in five minutes

::: timeline
- <!--i:upload--> **Drop your logo** on the drop zone in **Logos**. Lolly reads its shape and its colours.
- <!--i:palette--> **Use these colours.** The logo's main colour becomes your primary, and a dark neutral from the logo becomes your text colour.
- <!--i:font--> **Choose a face** in **Type**: a Google Font, or a font file you own.
- <!--i:pentool--> **Name the system.** Your first edit makes a design system of your own, and Lolly asks once for its name.
- <!--i:download--> **Export** writes the whole system as one `LollyBrand-….lolly` file.
:::

The bar at the top of the studio shows the design system's name as an editable field. **Enter** keeps a new name and **Escape** puts the old one back. When your first edit asks **What is this design system called?**, Lolly fills in the words from your logo, if the logo spells them out. **Save name** keeps the name; **Not now** keeps a placeholder until you type one in the bar. The name labels the system in Settings and when you switch, and is the name of the file **Export** writes.

<!--i:eti-grid-->
## The rooms

The studio is a set of rooms in no fixed order. No room waits on another. On a desk the rooms sit in one strip under the bar. On a phone they move to a bar along the bottom edge, with the open room scrolled into view. The palette sheet and the tray rise above that bar, and the bar moves aside while you type. With a keyboard, Tab reaches the strip once, and the arrow keys, Home and End move between rooms.

![The studio's bar and its rooms: Board, Colours, Type, Logos, Tokens, Files, Sound, Rules and Skills](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-top&waitSelector=.ds-room-nav&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

| Room | What you do there | Link key |
|---|---|---|
| **Board** | See what the system holds, with a door into each room | `overview` |
| **Colours** | Add colours, give them roles, build shades and a palette | `color` |
| **Type** | Choose the four faces the app, the tools and every export read | `type` |
| **Logos** | Place your marks in every orientation and treatment | `logos` |
| **Tokens** | Corners, spacing, shadows and every other named value | `tokens` |
| **Files** | The images, audio and motion files your brand keeps | `catalogue` |
| **Sound** | Shape sonic identity, music for different uses and the voice relationship | `sound` |
| **Rules** | The rules your brand applies, checked on real examples | `usage` |
| **Skills** | The brand's written standards for people and agents, to read and download | `skills` |

Link to a room with `#/start?area=<key>`. Room keys are permanent, so Files keeps `catalogue`, the Board keeps `overview` and Rules keeps `usage`. `?tab=` still works as an older alias. An unknown key opens the Board.

The **bar** holds actions for the whole system. **Add from…** brings a brand in ([Bring a brand in](#bring-a-brand-in)). The **Tray** holds what a scan found that you have not added yet. **Export** writes the system as one file. **More** holds **Tokens (.json)**, **Fonts for Linux (.rpm)**, **Versions & publishing**, **Restore brand settings** and **Design systems**, which opens the list in Settings where you switch ([Keep and move your design system](#keep-and-move-your-design-system)). Each action appears once it has something to act on. On a phone, **Add from…** moves into **More** and **Export** shows as its icon.

While the design system is the one that came with the app, the bar leads with **Make it yours**, a menu of **Find a look**, **Add from…** and **Pick a colour**. Once the system is your own, **Export** takes that place again.

<!--i:eti-clipboard-->
## Board

With nothing chosen yet, the Board offers four ways to start. **Start from a reference** opens the source picker for a logo, screenshot, web page or design file. **Pick a colour**, **Choose a face** and **Add a logo** open those controls. Opening one writes nothing. Below them, **Find a look** offers ready-made colours and type to try, and **Explore the tools** is there from the start.

Once anything is your own, the Board shows what you have, your own counts first. Colours gives the number of colours, with a muted `· N starter` for inherited ones. Its strip shows your colours, then a hairline, then the faded starter colours. Colourways shows each colourway as a small tile in its lead colour. Type lists each role and sets each family in its own face (*Inter for headings*, with *Starter for the rest* on the line below). Logos says how many slots are filled (or **Not set**), Tokens shows the corner radius and Files says **Nothing yet** while the library is empty. Every block opens its room.

An editable design system that came with the app, such as Lolly Demo, shows its colours, colourways, faces and marks on the Board from the start, with a **Came with this app** tag beside the heading. Above them, **Start here** offers **Find a look**, **Add from…** and **Pick a colour**.

### Starter and yours

In every room, **Starter** marks anything that came with the app and that nobody chose. A fresh install carries no colour, only one neutral ramp from ink to paper, so surfaces, text and hairlines can render before anyone chooses.

::: cols
## Starter

- Came with the app: the ink-to-paper neutrals, the starter faces, the default corner radius.
- Muted, with a **Starter** tag and no tint.
- Not counted as your colours. The neutrals live in **Tokens** as **Neutrals · starter · 9**, and **Open** shows them in Colours as one folded group (`#/start?area=color&group=neutral`).
- A role standing on a starter colour reads *"Starter Paper stands in"*, with **Choose…** on its picker.

## Yours

- Chosen or installed by you.
- Full strength, and a tinted card where you installed a face.
- Counted on the Board and in Tokens.
- A role that follows another reads **↳ follows Primary**.
:::

Inherited material never has a dashed border. A dashed border means a drop target.

<!--i:eti-shapes-->
## Logos

The drop zone at the top, **"Drop marks here, or choose several at once"**, takes as many files as you have. Lolly reads each file for its shape and its ink. The file then waits under **Waiting for a slot** as a chip that says what it looks like, such as *"Looks like the Horizontal primary"*, with the measurement it used and a **Place** button (**Replace** where the slot is filled). Where Lolly is unsure, the chip says so and offers **Change slot**, listing all eight. Nothing is placed until you press a button.

A mark with surplus empty margin gets a trim offer first. Answer the offer, or press Escape to place the original untouched. Where a mark can fill an empty sibling slot, the room offers the derived **mono** or **reverse** version as a chip marked *Generated*.

Every mark goes into a grid of eight optional slots, one per **orientation** and **treatment**:

- **Orientations:** Horizontal (wordmark and symbol in a row) and Vertical (stacked, for square and tall spaces).
- **Treatments:** Primary, Primary reverse (for dark backgrounds), Mono (one colour) and Mono reverse.

A group with no marks folds to one line; open the group to see its slots. Click a slot to add a PNG, SVG, JPEG or WebP, or click a filled slot to replace the mark. An empty slot also takes a dropped file. Horizontal marks sit in wide tiles and vertical ones in squares, each on the surface it was made for, with clear space a quarter of its height. Everything stays on this device.

![The logo slots with Horizontal and Vertical opened: each treatment is a slot of its own, and every slot is optional](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&system=new-design-system&width=1440&height=1600&dpi=192&waitMs=1600&drive=click%3A.be-logo-identity%3Edetails.be-logo-group--fold%3Anot%28.be-logo-group--custom%29%3Esummary%3Bwait%3A600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** are marks your brand calls by its own name, such as an icon, a crest or a favicon.
- **More identities.** A sub-brand, product or event can have its own full set: press **+ Add another logo** and name the set. Your main set is "Your logo". [Brand architectures](/info/brand-architectures.html) shows when to use a logo identity.
- **Lolly reads the logo's colours.** A card under the drop zone, and at the top of Colours, lists the logo's colours and asks **Which is the main colour?**. The strongest colour is selected, never the white the logo was exported on. **Use these colours** adds them to your palette and makes the main colour your primary. When the logo has a dark neutral that reads on paper, that neutral becomes the text colour. **Not now** leaves them in the Tray. On a brand-new install Lolly applies the likeliest answer at once, and the card offers **Undo** or another main colour. An SVG gives exact colours; a PNG, JPEG or WebP gives the colours that cover a significant share of the mark.

<!--i:eti-palette-->
## Colours

The room grows with the design system. A first visit asks for one decision; more controls appear as the palette grows.

### The first colour

A system with no colours of its own shows the starter's neutrals in their own open group. At the top of the room is a dashed paste and drop field: one large chip and one field. Drop an image or a list of colours anywhere on the field, and Lolly reads the colours.

- **The chip is the picker.** **Pick a colour** opens the studio's OKLCH card, seeded with what the field holds. The card shows the colour's name and hex first. The colour spaces, the wheel, the four dials and alpha are under **Fine-tune**, and **Cancel** and **Add colour** are at the foot. Nothing reaches the system until you press **Add colour**.
- **The field takes any notation**: `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` or a colour name. A pasted list becomes a row of chips to add one at a time or with **Add all**.
- **Two more ways in.** **Pick a colour from the screen** uses the eyedropper where the browser has one, and **Take colours from an image** reads a screenshot or photo on this device.
- **Add is never disabled.** With nothing in the field it opens the picker; text it cannot read gets a line under the field saying so.

Your first colour becomes the **primary**. A chip confirms the change, such as *"Primary is now Vivid Violet"*, with **Fine-tune** to adjust the colour.


### As the palette grows

Your colours sit beside an **In context** preview on a wide screen, and above the preview on a smaller one. The preview shows a poster, chart or interface card in your palette. Starter colours have their own group, which folds once the system has colours of its own. The paste and drop field becomes one compact row. The room's head has no export; use the bar's **Export** or the Tokens room.

![The Colours room on Lolly Demo: the role chips and the paste and drop field at the top, then the palette in folding groups, each colour with its name and hex](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

![The Colours room on Lolly Demo after adding one colour: the Colour roles table, then the new colour's chip offering Use as Lead? and Fine-tune, beside a live composition preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Colour roles: what the colours are called

The design system gives its colours names and says what each is for, and Lolly reads both. **Colour roles** sits at the head of the Colours room. **In context** shows each change at once.

![The Colour roles table on Wefthouse, an invented textile brand, in its own words: the colourway chips Indigo, Madder and Weld, then Main, Accent, Supporting and Tertiary, each with its light and dark colour, read as the lead colour, the partner colour and by name only, and Background, Text, Quiet text and Hairlines listed under the table as the readings no role fills](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&system=wefthouse&width=2720&height=2000&dpi=192&waitMs=1800&cropSelector=%5Bdata-be-roles-fold%5D&format=svg&walker=1&dark=1&filename=bs-colour-roles)

The table has four columns. On a phone each row becomes a card with light and dark side by side:

| Column | What it holds |
|---|---|
| **Role** | The design system's own word, which you can edit in place, and a line saying what the colour is for |
| **Light** and **Dark** | The colour in that look for the chosen colourway, with its name or value, and its contrast |
| **Lolly reads this as** | What a tool does with the role, in Lolly's own words |

**How Lolly reads a role.** Each reading takes one role. Choosing a reading that another role holds moves the reading to this role. Lolly never reads meaning from a word.

| Reading | What follows from it |
|---|---|
| **Lead colour** | Big shapes, buttons, the colour a tool leads with |
| **Partner colour** | The second colour a tool reaches for |
| **Background** | Sits behind everything else |
| **Text** | Headings and body text |
| **Quiet text** | Captions and small print |
| **Hairlines** | Rules, borders and dividers |
| **By name only** | No tool picks the role by itself. It is offered in every colour field and in Design, where a pick stays linked, so it follows the colourway |

A reading no role fills keeps the design system's definition, and the room lists those readings under the table. A role that shares a reading's own id, such as a role called Primary, is that reading and cannot be moved.

**In a chart.** Lolly Chart's **Design system - colour roles first** palette gives the series the design system's colour roles in its own order, then the rest of its palette. A role read as the background, text, quiet text or hairlines is left out, because the chart draws its ground and its words in those colours. Nothing changes until you choose that palette. A design system with no colour roles draws the palette as **Design system - ordered**.

**Values.** Press a value to choose that role's colour for that look and the chosen colourway. **Same as light** makes the dark value follow the light one until you choose a dark colour. The **Aa** chip shows the text Lolly picks to sit on the colour. The line under the value says how that text reads in each look: **Text reads well**, **Large text only** or **Hard to read as text**. The rating is about text on the colour only; the colour can still work for shapes and large areas. A role read by name only shows the same words without the warning colour, because no tool puts text on that role by itself. The tooltip and the picker show the figures, APCA first and WCAG second. **Own text colour** marks a value whose file states the text colour; that text colour stays. **Copied** marks a value from another colourway or from the partner colour that nobody has chosen yet; **Keep this colour** in the picker settles the value.

**Starting points.** A design system with no roles of its own shows the current words: Primary, Secondary, Surface and Text. Nothing is written until you change one. **+ Add a role** suggests **Primary, Secondary** or **Main, Accent, Supporting, Tertiary**, or takes any words you type, and shows the reading each would get. The first two words become the lead colour and the partner colour. Tools keep drawing the same colours. On a system with one lead colour, the first colourway takes that colour's name.

**Renaming, reordering, removing.** A rename changes only the word; everything that uses the role keeps working. Drag a role by its handle, or press Space on the handle, use the arrow keys and press Space to drop. **Remove** says what still uses the role. When tools read the role, **Remove and keep those colours** leaves each reading with its current colour. A house rule, a guide group, a tool field or another token that uses the role holds the role until that use changes. A saved Design document can also use a role by name, and Lolly cannot see that from the token file. Such a document reports the colour as unresolved.

::: details Roles in a hand-written token file
**A hand-written file.** Colours in a token file that no role declares are listed under **In this file, with no role yet**, each with a field for a word and **Make a role**. They keep working by name either way. A token with digits in its name cannot be a role; it stays in the file and keeps working by its path. If a record in the file does not validate, the table shows with no controls and says why.
:::

**The rest of the room speaks the same words.** The chips, the swatch's **Use as** row and the palette's **Colour roles** group all use the design system's words. A colour role's tile opens its value. Exported files record nothing new about roles; a render's colours change because the tokens changed.

**Where the words go.** The words and descriptions travel with the design system. Agents read them in the design brief, `lolly://tokens` and a brand page's `AGENTS.md`. The terminal shows them in `lolly system status`. A brand page lists them in `brand.json` and measures a contrast pair for each role. DTCG and Tokens Studio files keep everything, `DESIGN.md` keeps the words and the readings, and a PowerPoint theme keeps only the brand's order. [Colour roles in other formats](/info/design-tokens.html#colour-roles-in-other-formats) has the full list. Words are always quoted as the design system's data, never read as instructions.

**Where a colour is chosen.** Every colour field in a tool and in Lolly Design lists the design system's roles first, in its own order, with each word and its purpose. **Aa** beside a role picks the colour that sits on that role. The other colours follow under **Other colours**, without a colourway's own copies, the on-colours and any reading a role already fills. A pick stays linked to the role and follows the colourway. The field shows the word in every colourway, and Settings and Tokens use the word too. A design system with no roles keeps its grid of swatches.

### Every colour a tool reads

With **Colour roles** closed, the room leads with chips for the first decisions. Each chip shows the role's colour and its name. On a system with no words of its own these are **Primary**, **Secondary**, **Surface** and **Text**. Press a chip to choose its colour from the palette's swatches. **Every colour a tool reads**, at the foot of **Colour roles**, has the full strip.

The strip shows the seven colours a tool can read: Primary, Secondary, Surface, Text, Muted, Edge and On primary, in the design system's own words where it has them. Each plays the same part in every tool and export. None has to be set, and any colour can fill one. Three loose colours make a good system. The readout says how text reads against the surface, APCA first. Each row shows your own colour at full strength, a starter colour standing in, or **↳ follows Primary**.

On primary is derived from the primary, reads **Derived** and has no picker. The **Light** and **Dark** switch beside On primary, and the one beside **In context**, choose which look the strip, the palette and the preview show.

The app's own accent follows the design system by default, through the **Interface follows the design system** setting in **Settings → Appearance**. With the setting off, the app's chrome stays neutral. Tools, canvases and exports follow the design system either way.

**Colourways.** A design system can hold several lead colours, chosen per piece. The **Colourways** row at the head of **Colour roles** shows one chip per colourway, with **Default** on the canonical one. **+ Add** starts a new colourway from a palette colour. Choose a chip, and the table, the strip, the palette and the previews show that colourway. You can rename, duplicate, remove or make default the chosen colourway. On a system with colourways, every colourway needs its own primary and secondary, and its own surface when the colourways tint the background. Those roles stay set in the swatch editor. [Add colourways to a design system](/info/colourways.html#add-colourways-to-a-design-system) has the steps and the token format, and [Lolly Demo in use](/info/lolly-demo-in-use.html#colourways-on-real-work) shows colourways on real work. Each person can take a colourway as their own in **Settings → Appearance** ([Make a colourway your own](/info/colourways.html#make-a-colourway-your-own)).

### Find more colours

Three tools build on your primary. The first two only suggest; the third replaces the palette.

::: cols
## Explore shades & harmonies

Choose a **Starting colour**, a **Scheme** (Mono, Complement, Analogous or Triad) and how many **Shades** (3 to 20, default 5). **Fine-tune** sets UI intensity, contrast and text on brand. Click a shade to add it, or **Add 5 shades** for a group. Your colours and roles stay.

## Find matching colours

Pick a **Harmony**: Complementary, Adjacent, Triad, Tetrad or Analogous (with **Accents** from 2 to 5 and an **Angle** from 10° to 45°). Each candidate has a generated name and **+ Add**, one press per colour.

## Rebuild the whole palette

Replaces the palette from one starting colour, after a review of what changes and what stays.
:::

All three use the same perceptual colour maths (OKLCH) as the engine. In **Explore shades & harmonies**, the **Primary**, **Neutral** and **Secondary** rows show the suggested shades, and **Theme preview** shows light and dark examples with their contrast readings.

![Three suggested shade groups, with individual add controls and a separate Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

![Generated accents, each with a swatch, an auto-generated name, its hex and an Add button](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Committing a generated palette

Open **Rebuild the whole palette…** and press **Preview full rebuild**. The review counts how many roles stay as you assigned them, how many of your own colours are kept and how many shade curves, print locks, hidden shades and gradient stops are re-anchored or kept. **Apply rebuilt palette** commits; **Cancel** changes nothing. Afterwards the card offers **Undo**, already focused, and the checkpoint taken before the swap restores the whole system.

A system with colourways keeps every colourway through a rebuild. The canonical colourway follows the new starting colour, and every other colourway keeps its own colours, name, order and settings. The review lists which colourway follows and which keep their colours. Lolly does not rebuild a system that encodes its colourways in a way it cannot edit; the card says why, and nothing changes.

### The expert sections

Four folded sections sit below the preview and the roles. Each opens with `#/start?area=color&focus=<name>`:

- **Explore shades & harmonies** (`focus=generate`).
- **Shade curves** (`focus=curves`) reshape a ramp point by point, with separate lightness, chroma and hue curves (L / C / H) and the shades redrawing as you drag.
- **Contrast** (`focus=contrast`): **Contrast-lock** retones a ramp to hit APCA targets against a background you pick, and **Rotate hue** turns the whole ramp around the wheel.
- **Print** (`focus=print`) sets what the primary becomes on press: its automatic value, a pinned CMYK build or a named spot ink.

### The palette and each swatch

The palette lists your colours in folding groups, each with its own **+ Add**. You can create and rename groups. A role never makes a second tile; the tile a role points at shows the role's name, such as **Primary**. **Colour chart** below the tiles shows the same colours on the OKLCH **Wheel** (drag a dot to recolour, click empty space to add a swatch) and the **Gamut** chart, which shows where the displayable range ends. `#/start?area=color&focus=chart` opens the chart.

![The palette pane, every group foldable](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-roles-fold%5D%3Esummary%3Bwait%3A500%3Bclick%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![The OKLCH wheel - angle is hue, distance out is chroma and the greys ride a lightness rail down the side](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Click a swatch to open its editor:

- **Rename** the swatch.
- **Set the colour** on OKLCH sliders, or in **Hex**, **HSL**, **RGB** or **CMYK**. The value field reads and writes in the active space. CMYK here sets the screen colour by conversion; to pin exact inks, use **Print substitutes**.
- **Stored as** chooses how the swatch is saved: **LCH** (the default, perceptual and wide-gamut), Hex, RGB or HSL.
- **Use as** gives the swatch a role, in the design system's own words where it has them. Press a highlighted role again to clear the role.
- **Print substitutes** (folded): lock **CMYK** from **Auto** to exact ink values, or set a **Spot colour** with a **Name** (such as `PANTONE 186 C`), an optional **Book** and a **Finish** for foil, emboss, deboss, spot varnish, soft touch or a die cut, crease or perforation. A press uses these locks when you export a CMYK PDF or TIFF; see [Colour profiles](/info/exporting.html#colour-profiles). A spot ink prints on its own plate in a Print PDF; to print every spot ink in process for one export, see [Spot inks as process](/info/exporting.html#spot-inks-as-process).
- **In other spaces** (folded): a value per colour space, derived or authored by you, and an authored one wins at export.

**Deleting a swatch** is safe. Derived shades and theme roles are hidden, so nothing that reads them breaks. Colours you added are removed.

::: details Working with many swatches
At rest a swatch shows its colour, name and hex. Select shows each swatch's checkbox and drag handle on any screen, and a tile with keyboard focus shows its handle too. Drag a handle to reorder within a group, or focus the handle, press Space, use the arrow keys and press Space again to drop; Escape cancels. On a phone the palette shows four colours a row. To move colours between groups, use the editor's **Group** control or select several and use **Move to**.

Selection needs no separate switch: the bar and the checkboxes appear with the first selected tile and leave with the last.

- **Drag on empty space** to draw a rectangle; every tile it touches joins the selection, across groups. A folded section adds nothing.
- **Shift-click** takes a range in reading order, **Cmd/Ctrl-click** toggles one tile, and a plain click opens the editor.
- Each group header has **Select all**, and **Cmd-A** with a tile focused takes every colour you own, never a starter one.
- The grid has one tab stop: arrows move, Shift-arrows extend, Space toggles, Delete removes and Escape clears. To nudge a channel, press `l`, `c` or `h` first.
- On a touch screen, press and hold a tile to start a selection, then tap to add.

The bar reads **{n} selected**, then **Move to**, **Give a role** (each colour takes the next role in turn), **Download** (the selection in any of the six palette formats), **Duplicate** (a copy of each, placed after the original), **Copy values** and **Delete**. One copy opens in the editor; several stay selected. One Cmd/Ctrl-Z undoes a bulk action.
:::

### Gradients

The optional **Gradients** panel builds blend tokens from the palette. Each gradient has a preview, 2 to 8 named stops and an angle. A stop points at a swatch, so recolour the swatch and the gradient follows. Blends run in OKLCH.

The palette downloads (design tokens, CSS, SCSS, GIMP and Adobe Swatch Exchange) sit in the palette's head. [Take your palette and fonts anywhere](/info/using.html#take-your-palette-and-fonts-anywhere) describes each format.

<!--i:eti-type-->
## Type

With no face of its own, the room shows one card: **Primary**, set at reading size in its current face, with a **Starter** tag, a **Choose for Primary** button and the line *"Nothing installs until you choose one."* Headings, code and italic follow the primary until you choose them; **Choose them separately** shows their cards.

![The Type room with no face chosen yet - one card at reading size, a Starter tag on it, and one filled Choose for Primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Choose one face and the room opens into four role cards, the Fonts list and a live specimen:

- **Primary**: body copy, buttons and every tool.
- **Headings**: the display face for `h1` and `h2`.
- **Code**: a monospace face for code and data.
- **Italic**: a true italic for emphasis, quotations and asides.

A card is tinted only where you installed that face. Its button shows the role: **Change Headings** on a face of your own and **Choose for Headings** everywhere else. The sample line wraps. Nothing on a card commits a change; the button opens the compare stage for that role.

![The four role cards revealed - each set in the face that serves it, with a Starter tag where nobody chose one and Italic following the primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&system=new-design-system&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### The compare stage

The stage opens under the card you pressed. The cards fold to a one-line strip so the stage shows on a phone's first screen. Escape cancels and returns focus to the card.

1. Press **Choose for** and the role on the card.
2. Type a family name and press **Preview**, or press one of the six **Pinned** families under the field.
3. Press **Use this face**.

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

**Consent is asked once.** The first time a preview reaches Google Fonts, a dialog explains: *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** goes ahead and is remembered. **Cancel** leaves the card reading *"Not fetched. Nothing was sent to Google."*, with its own **Fetch from Google**.

**Drop a font file on the stage** (TTF, OTF or WOFF) to preview a licensed typeface you own. Either way the face stays on this device, renders offline in the app, the tools and every export, and travels in the design system file. Everything on Google Fonts ships under an open licence (OFL, Apache or UFL).

### Fonts on this device

The **Fonts** panel lists every face on this device and the role it serves. Faces you added come first, under **In the design system**, each with its roles and a delete. The starter faces follow in one muted, folded row. **Add a face** opens the compare stage for any role. The **Type roles** panel shows a live specimen of each role with its family and state, such as *Inter* or *Inter · follows Primary*.

<!--i:eti-tag-->
## Tokens

Tokens are the named values behind the design system: colours, typefaces, logos, corners and spacing. Tools read them by name, so a change here reaches every tool at once.

![The Tokens room: the head with an example from the system and the file actions, tiles counting each kind of token, then the colour pairs with their contrast readouts](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **The head** gives an example from your own system (*Primary is Spearmint, #033633*) and the file actions: **Download** (the system as design tokens, or the palette in five other formats), **Copy CSS** and **Add from…** to read a JSON file back in.
- **Tiles** count each kind of token and jump to its section: Colours, Type, Logos, Shape and spacing, More and All tokens. A section holding only what came with the blank starter wears a **Starter** tag; a system that came with the app counts its own material without the tag. On a phone the tiles wrap to two rows of three.
- **Colours** starts with the pairs tools put together (text on surface, on primary, muted on surface) with an APCA readout in light and dark, and flags **Weak contrast** where a pair falls short. Then every colour group: a ramp as one row of chips, other colours with their value and the reference tools use, such as `{color.brand.spearmint}`. Press a reference to copy the reference. **Edit in Colours** opens a group in the Colours room. On a design system with [colour roles](#colour-roles-what-the-colours-are-called), **Colour roles** comes first, with each role once in the system's own words and order. A role keeps a colour for every colourway and look. Those colours are listed with the role, not as separate colours; change them in the Colour roles table.
- **Type** and **Logos** list the face for each role and each logo slot, with **Edit in Type** and **Edit in Logos** once you have your own.
- **Shape and spacing** holds **Rounded corners** (`shape.radius`) and **Spacing rhythm** (`space.base`). Each reads *Lolly default* until you move the slider and *Yours* after, saves at once and can be undone.
- **More tokens** adds spacing, sizing, stroke width, opacity, rotation, plain numbers and shadows, stored as standard [design tokens](/info/design-tokens.html).
- **App appearance (advanced)** lists the colours, sizes and shadows Lolly's own screens use, and **Inspect every token (advanced)** searches and edits any stored value and shows each change for review first. There, a colour role's values in each colourway are listed with the role: choose the role's token to see one row per colourway, light and dark side by side. The count line says how many values the roles hold. A read-only design system shows the same list.

An empty section offers **Pick a colour**, **Choose a face** or **Add a logo**.

<!--i:eti-images-->
## Files

Drop the files your brand keeps, apart from logos: **vector**, **image**, **audio** and **motion** files (video, Lottie and animations). They appear in [Assets](/info/using.html#assets-your-library), sorted into sections, and in every tool's asset picker. They stay on this device.

## Sound

**Sound** is chosen by listening. The room opens on three starting sounds, **Calm**, **Steady** and **Bright**, each a card in its genre's colours with a play button. Play one to hear a short excerpt; starting another stops the first. **Choose** makes that sound the sound of every use. The fourth card, **Mixed**, gives each use its own sound: Calm for Explain, Steady for Demonstrate and Bright for Play. Its play button plays the three in turn. Nothing is saved until you choose **Save sound**. The sound then becomes part of this design system, with a checkpoint in the same history the other rooms use. A design system without a sound keeps working as before.

A use is a moment the sound plays in: **Explain**, **Demonstrate** and **Play** to start with. Each use is a chip with its own play button. **Music** or **With narration** above the chips sets whether a chip plays the music alone or under a voice. The use you pick shows its purpose and its music in plain words, for example "Warm · 84 bpm · Rhodes, rolling bass, dusty kit". Every use takes the chosen sound's genre, tempo and instruments (or, with Mixed, its own). Each use keeps its own tune and its own balance: Explain keeps the melody out of a voice's way, and Play lets the melody lead. Moving between Mixed and a single sound keeps both. A use you added yourself keeps the sound it has under Mixed. The design system records which you chose. **Add a use** adds one and lets you type its name in place. **Make main** chooses the use played when nothing else is asked for. **Another tune** plays a new composition with the same settings.

**Edit in the music generator** opens the [music generator](/info/generated-music.html#the-music-generator) on that use's settings, with a line at the top saying whose sound you are editing. **Save to this use** brings the settings back to the room; **Cancel** returns with nothing changed. Unsaved choices in the room wait while you are away. If someone saves the sound in another tab meanwhile, the newer save stands and your edit is left out.

**Voice** picks a voice for the use, the speaking speed and how loud the music sits under the voice; **Hear the voice with the music** plays both. Under **More** are the dip while the voice speaks, the words to try (they stay in the room), pronunciation notes (one per line, as written = spoken) and notes on the voice. Previews use the local speech model and the same mixing as a sequence export. A preview fades out; it is not a composed ending.

**Notes and signature** holds what to listen for in a use and a sound signature: a fixed opening or ending kept as its own audio file. Place the signature in your sequence; generated music never includes the signature. A requirement this version of Lolly cannot check stops new music for that use.

**Details** holds the brand's character (how the sound should feel, what stays the same and what to avoid) and the listening review. **Record a listening review** keeps the reviewer's name, the date and their notes against the saved version of the sound. Any change makes the sound a draft again. A review covers that version, not every tune made from the sound later: listen to each new piece before it goes out.

**Make a music project** opens the use in the music generator as a project that keeps the use, the version of the sound and the exact settings. **New tune** there draws a new composition and keeps the sound. If you change the settings, **Put the sound back** returns to the sound, and **Keep as my own** carries on with an independent tune. Until you choose, the project cannot be saved or downloaded as made from the sound. Share links carry the music settings only. The project and a saved tune also keep the sound's notes, which stay out of share links and out of the audio file's public credentials. Keep a rendered recording when the exact audio has to survive future versions of the generator.

<!--i:eti-checklist-->
## Rules

**Rules** sets what people can change, what stays fixed and what Lolly can check.

![Rules on Lolly Demo: four house rules, each marked Checked in Design and Required or Advisory, then Try your design system in use with its examples ready to render](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dusage&width=1440&height=1200&dpi=192&waitMs=2400&cropSelector=%23start-panel-usage&format=svg&walker=1&dark=1&filename=bs-usage-rules)

**Brand rules** lists your rules. **Add rule** (or **Add your first rule**) opens a short form:

- a **Rule name** in your own words, such as *Beacon accents*;
- the **Check**: **Colour choices**, **Font choices**, **Fixed artwork** or **Text length**, with the brand role it uses, under your own name for the role;
- the **Example** it applies to (Poster, Title slide, Content slide or Lolly Chart), the **Mode** and whether it is **Required** or **Advisory**;
- **Reviewed by**, then **Save draft** or **Approve & save**.

Approval records your own decision on this device. Approved required rules constrain the reusable poster, and checks cover the example PNGs only; they change no other tool.

Rules in a design system's token file, such as approved colour pairings, text weight and alignment or a logo per surface, are listed here as **Checked in Design**. Lolly Design checks them layer by layer in the export panel's **Before you export** card, and `lolly check` does the same for a saved Lolly Design document ([Before you export](/info/design.html#before-you-export)). A rule this build has no checker for is kept as supplied and marked **Unchecked**.

Lolly Demo brings four approved house rules. Headlines are never set in capitals: that rule is required, so `lolly check` reports a headline in capitals as an error. The other three are advisory. Body text is left-aligned. Primary marks sit on light surfaces and reverse marks on dark ones. Dashed lines mean drop here.

**Try your design system in use** renders four examples from the current revision with **Render & check examples**. Choose a **Mode** and **Try your own text** for the heading, supporting text and slide text. Each example reports what was measured, with **See checks & sources** and **Download check report**. **Make reusable poster** downloads a `.lolly` that has its fixed layout and approved input choices. Examples are local: running a check publishes and approves nothing.

A build that ships with a fixed brand shows the same rules and examples read-only, under *This brand is set*.

<!--i:eti-graduation-cap-->
## Skills

**Skills** lists the active design system's [brand skills](/info/brand-skills.html): the brand's written standards, one per discipline, for people and AI agents. Each row gives the discipline, the brand's own status (**Draft** or **Approved**), whether the skill is public or internal and its revision. Choose a row to read the skill with its coverage, which compares the skill's lines with your tokens: what Lolly checks, what conflicts, what agrees and what is guidance only.

**Download skill (.zip)** writes the skill as an Agent Skills folder for an agent tool, with catalog links pointing at this Lolly. **Copy as one file** puts the same text on the clipboard for a chat window. A design system without skills of its own lists a baseline that Lolly writes from its tokens and house rules each time the baseline is read. The room reads skills and never edits them.

<!--i:eti-upload-->
## Bring a brand in

**Add from…** in the bar opens a picker that asks what you have, not what format it is:

- **Design tokens or a design file**: DTCG or Tokens Studio JSON, a Penpot project, a zip of token sets, a Lolly design system pack, an SVG, a `DESIGN.md` or a brand page folder.
- **PDF**: a deck or a guidelines file, read on this device for its colours, marks and embedded typefaces.
- **Logo or screenshot**: an image becomes a suggested palette, read on this device. It reads colours, not the typeface or layout.
- **Saved web page**: one HTML file and its CSS files, or pasted HTML or CSS, up to 20 files and 2 MB. Only the text you supply is read: linked resources are not fetched and scripts do not run.
- **Font file**: TTF, OTF or WOFF. Opens the Type room, where the face installs.
- **Website**: one page, read for its colours and type. This tile appears only on a device that can read a page, and says which reader it uses: the app on this device, or the browser extension in a background tab, signed in as you. Typing a URL only fills in the field; pressing fetch is the consent.

Choose the design-file source and the next card lists the accepted formats as icon tiles. The card is one drop target. You can also drop a file onto the studio.

![The import card - the accepted formats lead as icon tiles, and the whole card is one drop target](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

- A **Lolly design-system pack** (`.lolly`, or a legacy `.zip`) installs in one step.
- A **Penpot** export (`.penpot`) brings its design tokens.
- A **Design Tokens** (W3C DTCG) or **Tokens Studio** file (`.json`) brings its tokens. A description that asks a reader to ignore instructions, claims permissions or asks to run code is left out, and the import says where it sat.
- A **plain SVG** is scanned for colours you pick from, the first becoming your primary.
- A **`DESIGN.md`** (`.md`) goes to **Try these colours** with its tokens as written. Its prose can be kept as a draft brand skill, and the card flags lines that ask a reader to ignore instructions, claim permissions or run code. Agents and brand pages do not see a draft until you press **Keep this skill** in the Skills room, and a kept skill stays internal.
- A **brand page folder**, picked as a folder, dropped or zipped, goes to the same review. Every file is checked against the folder's `brand.json`; one file that does not match refuses the whole folder. The import adds the tokens. Logos and fonts stay in the folder.

::: warning The instruction check reads line by line
The check that leaves out instructions in a token file's descriptions reads line by line and misses other wording. Read a file from someone you don't know before you apply the tokens.
:::

Lolly reads a brand page from files you supply. It does not fetch another site's address.

### A file with its own colour words

A token file or a `DESIGN.md` can use its own words for its colours, such as main, accent, supporting and tertiary. When Lolly finds such words, the review lists each word before anything applies: the word, its colour in each look, the token it came from and Lolly's suggested reading. Lolly suggests readings from the words alone, against a short list, with no model. A word off the list arrives as the brand's own, **By name only**. You can rename any word, say what it is for, give it another reading or untick it to keep it as a named colour.

**Install with these roles** writes the roles; **Install without roles** installs the file as it came. A file with no such words skips this step. A file that states its own roles, such as one Lolly wrote, shows them as written and installs them unchanged; you can edit them later in the Colours room. The terminal has no review: `lolly system import` keeps a stated record and leaves other files' words as named colours.

### Review a reference

A logo, screenshot, website or saved page opens **Try these colours**: an example in the proposed colours, a **Main colour** you can change and a name for a new system. A box says what applying does: it **replaces** the active token settings with the generated palette and default styles, **keeps** your fonts and library files and the previous system can be **recovered**. **Apply suggested settings** takes a checkpoint, then applies the light and dark palettes. **Restore brand settings** can bring the old settings back. **Change reference** picks another source.

::: details What a reference reads, and the design context report
**Palette, source details and individual choices** shows what was read, any font names found and the preview's contrast. Font names are suggestions only; you install a face in Type. The source details can include typography, gaps, padding and corner values where observed, labelled **Not observed** otherwise. A saved page or a native website read reports declared styles, which the page may not use. The browser extension can report measured styles from a sample of visible elements. These are observations: nothing is installed, and source spacing never replaces your own. **Choose individual items in the tray** keeps single items. **Download design context** saves a JSON report of observations, proposed tokens and source information (with a SHA-256 of any supplied HTML or CSS). The report holds no raw page text and is not a signed Content Credential.
:::

PDF and design-file imports keep their own review controls. Items in the **Tray** change nothing until you add them in the room that owns that kind of material. `#/start?source=<kind>` opens the picker on a source (`file`, `pdf`, `image`, `font`, `url`, `page`), and `?import` opens the plain list.

### Find and compare a look

Open **Find a look** from the Board or from the design-system list in Settings. Browse systems saved on this device and a few reusable Lolly examples, and search by name, colour tag or declared font. **Closest to my current palette** sorts by measured colour similarity, with matching fonts breaking ties; it is not a quality score.

Click a look to preview it in context; previewing changes nothing. **Use this look** on a card applies that look. A saved system becomes the active one, which edits nothing. An example's colours go into the open design system after the usual checkpoint. The system's logos, fonts and anything else the example does not define stay as they are. **Compare looks** adds a checkbox to each card: choose two to compare side by side. **Restore brand settings** recovers the previous look. Saved systems have editable **Search tags** under **Details and design context**. The examples are original Lolly colour recipes, with no scraped collection and no account.

![Lolly Compare Sunroom and Orchard side by side before applying either colour system.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-looks-compare-toggle%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

<!--i:eti-package-->
## Keep and move your design system

### Move a brand between devices

**Export** writes one **`LollyBrand-….lolly`** file: your tokens, fonts, logos and theme preference, with an integrity manifest that is checked on import. Web releases before 1.0.7 named the file `.zip`, and Lolly still accepts that spelling. **Tokens (.json)** writes the plain design-tokens document, with no fonts or logos, for a repository, a build step or another tokens tool.

To bring one back, use **Add from… → Design tokens or a design file**, or drop the file on the studio. This is how a colleague hands you a brand or you carry one to a second install, with no account and no cloud. [Working with partners](/info/partners.html) covers what else to send when the person receiving your brand works for another organisation. To bring a brand in from the command line, see [`ingest:brand`](/info/configuration.html#brand-packs).

**Fonts for Linux (.rpm)** packages the fonts you added into an installable RPM. If you uploaded any of them yourself, Lolly asks you to confirm that you may redistribute them first.

### Restore earlier settings

Open **More** in the bar, choose **Restore brand settings**, select a dated checkpoint and press **Restore**. This restores colours, type settings and other tokens for the active brand; font and image files stay as they are. Lolly saves your current settings as **Before restore** first, so you can reverse a restore even after closing the browser. The latest 20 checkpoints are kept on this device. An edit made while the studio says **Saving…** survives a reload, and a card offers to restore changes that did not finish saving.

### Versions

A published version is a **permanent, named copy** kept on this device. It never changes, so a tool or a link that pins it (with `designv`) keeps drawing the same thing. A system with something of your own lists **Versions & publishing** in the bar's **More** menu; after your first publish **Versions** joins the rooms. `#/start?area=versions` opens Versions.

::: warning A published version is permanent
There is no delete yet, and the panel says so. Publishing cannot be undone; restoring can. *Restore latest from this version* is an ordinary edit, with **Undo** offered at once.
:::

**Removals lead the compatibility card**, because a removed token breaks a tool.

**Publish only** keeps a version without changing what tools follow; **Publish and make active** makes tools and the app follow that version. **Follow the latest again** puts every edit live at once.

### Publish a brand page

A [brand page](/info/brand-page.html) is one address for people and agents: a page of logos, colours, type and examples, with the same facts in files alongside. **Publish a brand page**, under Versions & publishing, shows the live page and, next to the page:

- **Goes public**: every file, grouped, with its size.
- **Held back**: what stayed out, and why. A logo with no recorded licence stays out until you tick the logo's name. A font file needs a recorded licence that allows passing it on, and the page shows an outlined specimen when the file stays out. Internal brand skills never appear.
- **What was checked**: colour pairs per colourway and mode, and the house rules. These are measurements, not a verdict.
- **In your words**: a usage statement and a contact. The page prints what you write and Lolly adds no licence or legal claim. A switch turns off the "Made with Lolly" line in the footer.
- **On exports**: a switch that [records the page's address in this design system's exports](/info/brand-page.html#lead-back-from-your-files). The switch is off until you turn it on, needs an `https` address and does not travel with a pack or a copy. A locked design system does not show the switch, because its manager decides.

**Download folder** saves the folder as a ZIP for you to host where you choose. Nothing goes public until you host the folder. In a terminal, `lolly system publish --out=<dir>` writes the same folder. An instance that serves brand pages also offers **Publish to** its address: one explicit press, through the instance's approval chain when it has one. A managed design system publishes only when its manager allows.

### Connect an agent

**Connect an agent**, in the same place, gives you text to paste and says what each option can do:

- **`AGENTS.md`** in a project: agents read the system's names and rules. It draws nothing and needs no server.
- **Lolly's public server**: draws with Lolly Demo, whichever system you have open here. It needs no key.
- **Your instance**: draws with the systems the instance holds, and reads a service token from an environment variable. The sheet gives the variable's name and never shows a token.

When no hosted server draws with your system, the sheet says so.

<!--i:eti-layers-->
## Manage your design systems

Open **Settings → Preferences → Design systems** to switch, add or remove systems. **Open** selects a system and opens it here; **Make a new one** creates a local system and opens it with its name field ready. One system is active at a time, for the whole device. [Brand architectures](/info/brand-architectures.html) helps decide when a brand needs a design system of its own.

**Where a system comes from.** The system a deployment's catalogue supplies reads **Came with this app**, or **From this instance** in an app connected to one. Expand **Catalogue source** to see who supplies it, its tokens asset and namespace and its known version or checksum; if a refresh fails, cached material is labelled.

**Managed systems are read-only.** A system reads **Managed by this instance** (or **Managed by this app** in the desktop app with no instance) when its catalogue locks the system. You can use and download a managed system. Opening one here shows a read-only note with **Make an editable copy** and **Switch**, then its colour roles and tokens with no editing controls. Your own local systems stay editable, even when the managed one came first. A build with one fixed brand opens Lolly Design System Setup on *This brand is set*, with the brand's tokens and usage rules to read.

**Every other supplied system is yours** to hide, edit and reset, including Lolly Demo and Lolly Starter on lolly.tools. Editing one keeps its name and marks the row **Edited here**. **Reset to original** in its menu discards the changes made on this device. The blank starter is the exception: a first change there starts a design system of your own, and Lolly asks once for its name. [Lolly Demo in use](/info/lolly-demo-in-use.html#switch-to-your-own) shows what your own system replaces.

### Removing a design system

Choose **Remove** from a system's menu; the confirmation says which system will be active afterwards. Saved sessions, uploads and material shared with another system stay.

Removing a supplied system only hides the system: its catalogue assets stay, **Bring back** shows it again and it returns by itself if you remove everything else. Removing an imported or edited copy does not remove the supplied system, its logos or its fonts. If the copy was active, the supplied system becomes active again. Removing an active hosted copy clears only that copy's connection; a separately chosen instance stays selected.

::: details Changing a design system a server supplies
Changing what a server supplies is an administrator's task: its operator changes the source catalogue and redeploys, or a Lolly Work administrator reviews and applies a server change. Edits here stay local, with one exception. On a Lolly Work instance that grants you `brand.edit`, a managed system also offers **Edit for** that instance, which opens an editing copy. **Send to** that instance in **Versions** sends its colours, colourways, colour roles and brand page address back. [Edit this instance from the studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio) covers what an edit can change and how the instance serves the change. See [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system) and [Configuration](/info/configuration.html#supplied-and-local-design-systems).
:::

<!--i:eti-code-->
## Use design context outside the app

**Download design context** saves the token document, resolved colours, declared font families, asset ids, source evidence where recorded, coverage and explicit rules, with no font files and no proof of ownership. The command line reads the file with no server: `lolly system import` makes it the terminal's design system and `lolly system check` checks Lolly Design inputs against the saved context. [Bring your design system](/info/cli.html#bring-your-design-system) covers the import and [Which design system a command uses](/info/cli-decks.html#which-design-system-a-command-uses) covers the check. An MCP client reads the same brief from `lolly://design-context` ([MCP Server](/info/mcp.html)).

<!--i:eti-map-pin-->
## Where to go next

- **[Using Lolly](/info/using.html)**: the tools, saving, sharing and Assets.
- **[Brand architectures](/info/brand-architectures.html)**: how divisions, products, endorsed brands, clients and seasons map onto design systems, colourways and logo identities.
- **[Working with partners](/info/partners.html)**: sharing your brand with a partner, and working in a brand you were given.
- **[Brand pages](/info/brand-page.html)**: publish your design system at one address, as a press kit and an agent kit.
- **[Design Tokens](/info/design-tokens.html)**: the token model your brand is written in.
- **[Export a file](/info/exporting.html)**: print units, CMYK and the formats your brand renders into.
