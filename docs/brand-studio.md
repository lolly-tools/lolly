# The Brand Studio

The **Brand Studio** at `#/start` is the one place you shape your brand - its logos, colours, type, the rest of your tokens and the files it keeps. Set it here once and every tool, page and export follows it *by construction*, not by review.

Changes preview **live across the whole app** as you make them, so you can see a colour or a font land everywhere before you commit it. It's all on-device: your brand files and tokens never leave your machine (picking a Google Font fetches that one family from Google, once, after a consent dialog), and the brand travels in a single [brand pack](#move-a-brand-between-devices) file.

> **This is the editor. The dashboard is the mirror.** The **Design system** tab on the Dashboard (`#/d`) *shows* your brand read-only; you *edit* it here at `#/start`. If you want to change a colour later, come back to the Brand Studio.

## The rooms

The studio is a set of **rooms** listed in a rail down the side - not steps. Nothing is numbered, nothing is gated on anything else and arriving in any of them is legitimate:

- **Overview** - the hub. What exists right now, at a glance, with a door into each room.
- **Colours** - add colours one at a time, assign roles or generate a whole palette from one.
- **Type** - the four faces the app, the tools and every export read.
- **Logos** - your marks, in every orientation and treatment.
- **Tokens** - corner radius, spacing, shadows and the rest of the system.
- **Files** - the image, audio and motion files your brand keeps.

On a phone the same list becomes a horizontal chip strip pinned under the header. Switching room never reloads anything - the editor keeps all its panels mounted and simply shows the one you asked for.

**Deep-link a room** with `#/start?area=<key>`. The keys are `overview`, `color` *(note the US spelling in the URL)*, `type`, `logos`, `tokens`, `catalogue` (the Files room - the panel key is a permanent contract, so the URL keeps the old name) and `versions`. `?tab=` is the long-standing alias for the same thing and still resolves, so old links and bookmarks keep working; anything unrecognised opens Overview rather than dead-ending.

Pinned to the **foot of the rail** are the actions that belong to the whole design system rather than to one room:

- **Add from…** - the source picker, for bringing a brand in from a file, a PDF, an image, a font or a website. See [Bring a brand in](#bring-a-brand-in) below.
- **Tray** - the candidates a scan turned up but hasn't committed. It stays hidden until a scan actually keeps something, and carries a count when it does; nothing in it changes your brand until you press Add on that row.
- **Export** - writes the whole design system as one `LollyBrand-….lolly`.
- **Tokens (.json)** - the plain design-tokens document on its own, for a repo, a build step or another tokens tool.
- **Restore brand settings** - return to a checkpoint saved before an import or a replacement of brand settings.
- **Versions** - publish, activate and restore named copies of the design system. Hidden until there's something of your own to publish (or a `?area=versions` link asks for it by name).

![The studio room rail - Overview, Colours, Type, Logos, Tokens and Files](/t/url-shot?url=%2F%23%2Fstart&width=1440&height=900&dpi=192&waitMs=1600&cropSelector=.ds-rail&waitSelector=.ds-rail&format=svg&walker=1&localize=1&dark=1&filename=brand-studio&try=1)

## Overview

Overview is the first room, and it has two faces.

With **nothing chosen yet** it says **Make it yours**. **Start from a reference** opens the source picker for a logo, screenshot, web page or design file. **Pick a colour**, **Choose a face** and **Add a logo** open their existing controls directly. Each route starts with a choice; opening one writes nothing. **Explore the tools** is available immediately.

Once anything is your own, the same room shows **what you have**, with the counts you made leading. Colours reads the number of colours the design system carries, and adds a muted `· N starter` only where there are inherited colours on show; the strip beside it puts the colours you chose first, then a hairline and the faded starter ones. Type reads by role (*Inter for headings*, with *Starter for the rest · SUSE, SUSE Mono* under it). Logos reads how many slots are filled, or **Not set**. Tokens carries the corner radius, tagged *starter* until you move it. Files says **Nothing yet** while the library is empty. Every block is a door into its room. There are counts here, never a progress bar and never a finish card - nothing in this studio is owed.

## Logos

Start by emptying your folder of marks into the drop zone at the top: **"Drop marks here, or choose several at once"** takes as many files as you have in one go. Each file is read for its shape and its ink, then queued under **Waiting for a slot** as a chip that says what it thinks - *"Looks like the Horizontal primary"*, with the measurement it went on, and a **Place** button (**Replace**, where that slot is already filled). Where it isn't sure the chip says so plainly and offers **Change slot** instead, which lists all eight. Nothing is placed until you press something.

Two things happen around that queue. A mark with surplus empty margin gets a **trim offer** first - answer it or press Escape and the original file goes in untouched. And where a mark can furnish an empty sibling slot, the room offers the derived **mono** or **reverse** version as its own chip, marked *Generated*, which disappears again if you fill that slot another way.

Below that sits the grid every mark ends up in - **orientation × treatment** slots:

- **Orientations:** Horizontal (wordmark + symbol in a row) and Vertical (stacked, for square and tall spaces).
- **Treatments:** Primary, Primary reverse (for dark backgrounds), Mono (one colour) and Mono reverse.

That's eight optional slots. Click a slot to add a PNG, SVG, JPEG or WebP; click a filled slot to replace it. Every slot is optional and everything stays on this device.

![The logo matrix - each orientation across the top, each treatment as its own dashed slot, all of them optional](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dlogos&width=1440&height=1600&dpi=192&waitMs=1600&cropSelector=.be-logo-grid&format=svg&walker=1&dark=1&filename=bs-logo-slots)

- **Custom marks** - add marks your brand names its own way (an icon, a crest, a favicon) under **Custom marks**; name it and choose a file.
- **More identities** - a sub-brand, product or event can have its own full set of logos. Use **+ Add another logo** and name it; your main set is simply "Your logo".
- **Upload an SVG and Lolly reads its colours.** On a brand-new install it quietly sets your primary colour from the logo and says so. On an existing brand it offers the colour as a suggestion instead - *"Found in the logo: #…"* with a **Use as primary** button beside it - over in the Colours room, where you can take it or dismiss it.

## Colours

The room grows with the design system. Nothing you have not needed yet is on the page, so a first visit is one decision and the rest arrives as the palette does.

### The first colour

A design system with no colours of its own opens on one centred column: **Start with one colour**, a large live chip, a field, and a quiet line saying that roles, shades and print settings arrive as the system grows.

- **The chip is the picker.** Press it and the studio's own OKLCH card opens on the chip, seeded with whatever the field is holding: a name, the wheel, the four dials, alpha and **Stored as**, with **Cancel** and **Add colour** at the foot. Dragging a dial paints the chip and rewrites the field as you go, and nothing reaches the design system until you press **Add colour**.
- **The field takes any notation** - `#e0452b`, `rgb(224 69 43)`, `oklch(58% .19 32)` or a plain colour name - and a whole *list* of colours becomes a row of chips you add one at a time.
- **Two more doors sit beside it.** The eyedropper (on a browser that has one) takes a colour off the screen, and **From an image** reads a screenshot or a photo on this device and offers the colours it finds.
- **Add is never disabled.** With nothing readable in the field it opens the picker, which is what an empty press usually means; text it cannot parse gets a line under the field saying so, rather than a dead button.

The first colour becomes the **primary**, and the chip that answers the add says so - *"Primary is now Vivid Violet"* - with **Fine-tune** beside it.

![The Colours room with nothing chosen yet - one big live chip, one field and one line about what arrives later](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&localize=1&dark=1&filename=brand-colours)

### Starter

**Starter** is the word for anything that came with the app instead of being chosen. A fresh install carries no colour at all: what it has is one neutral ramp, ink through paper, so surfaces, text and hairlines render before anybody has decided anything. Those neutrals are scaffolding, so they are not counted as colours and they are not drawn in the palette pane. They live in the [Tokens](#tokens) room as **Neutrals · starter · 9**, with an **Open** that shows them in the Colours pane as one folded, tagged group (`#/start?area=color&group=neutral`).

The same word carries through every room: a role standing on a starter colour reads *"Starter Paper stands in"* and its picker offers **Choose…**; a starter face wears a **Starter** tag and no tint; a starter corner radius is tagged on the Overview. Inherited material is never drawn with a dashed border, because a dashed border means a drop target here.

### As the palette grows

Your colours stay beside an **In context** preview on a wide screen and stack above it on smaller screens. The preview can show a poster, chart or interface card using your palette. Starter colours stay in their own foldable group, separate from colours you add.

Add individual colours or a set of shades, assign their roles, and open the advanced sections when you need them. The colour chart, gradients and download controls stay with the palette.

![The Colours room after adding one colour, with its palette and a live composition preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dpick&width=1440&height=840&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-editor-add%5D%3Bwait%3A900&format=svg&walker=1&dark=1&filename=bs-colour-first)

### Roles - what tools read

**Roles** are the layer over the swatches: which colour plays each part in every tool and export. Roles are optional (a design system of three loose colours and no roles is a perfectly good one), any swatch can take one and the contrast readout is measured against the surface, APCA first.

A row reads in one of three registers, so the strip never claims a decision nobody made:

- an own colour serving the role, at full strength;
- **Starter *Paper* stands in** - muted, with **Choose…** on its picker;
- **↳ follows Primary** - the role resolves through the primary rather than to a colour of its own.

Once the palette has shades, the strip grows to all seven slots a tool can read: Primary, Secondary, Surface, Text, Muted, Edge and On primary. On primary is derived from the primary, reads as **Derived** and carries no picker.

**The app's own accent is a preference, not a token.** By default the interface follows the design system and the chrome accent takes the primary colour. That is an Appearance setting on [your profile](/info/profile.html) - **Interface follows the design system** - and turning it off leaves the chrome neutral. Tools, canvases and exports are unaffected either way, and the fonts and the corner radius follow the design system whether the setting is on or off.

### The expert wings

Four folded sections sit below the composition preview and colour roles. Open the one you want; each is deep-linkable as `#/start?area=color&focus=<wing>`, which opens it whatever the room is otherwise showing:

- **Explore shades & harmonies** (`focus=generate`) - one colour into a full set of shades. Described below.
- **Shade curves** (`focus=curves`) - reshape a ramp point by point. Lightness, chroma and hue each get their own curve, switched with L / C / H, and the shades below rebake live as you drag.
- **Contrast** (`focus=contrast`) - **Contrast-lock** retones a ramp to hit APCA targets against a background you pick, each step keeping its own hue and chroma; **Rotate hue** turns the whole ramp bodily around the wheel, every shade keeping its lightness and chroma.
- **Print** (`focus=print`) - what the primary becomes on press: its automatic screen value, or a pinned CMYK build or a named spot ink instead.

### One colour, a whole palette

Inside **Explore shades & harmonies**, choose a **Starting colour**. Lolly suggests matching shades using the same perceptual colour maths (OKLCH) the engine uses elsewhere. Tune the suggestions:

- **Scheme** - Mono, Complement, Analogous or Triad - sets how the secondary colour relates to the primary.
- **Shades** - a slider from 3 to 20 (default 5) controls how many steps each ramp generates.
- **Fine-tune** (folded) - **UI intensity** (Muted / Deep), **Contrast** (Comfort / High) and **Text on brand** (Auto / Light / Dark).

Changing the starting colour and controls only changes the suggestions. Click a shade to add that colour, or **Add 5 shades** to add a group (the count follows your Shades setting). Existing colours and roles stay in place. Undo removes the addition.

The **Primary**, **Neutral** and **Secondary** rows show the suggested shades. Open **Theme preview** to inspect light and dark examples and their contrast readings. Choose a Neutral or Secondary step there to adjust the proposed theme anchors. Rebuilding the full palette remains a separate, reviewed action below.

![Three suggested shade groups, with individual add controls and a separate Theme preview](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1400&dpi=192&waitMs=1800&css=.start-head%7Bdisplay%3Anone%7D&cropSelector=.be-preview&format=svg&walker=1&dark=1&filename=bs-colour-ramps)

### Build the palette (harmony generator)

In **Find matching colours**, the harmony generator suggests matching accent colours from the primary. Pick a **Harmony** - **Complementary**, **Adjacent**, **Triad**, **Tetrad** or **Analogous** (which brings its own **Accents** count, 2 to 5, and a hue **Angle** from 10° to 45°) - and each candidate arrives with an auto-generated human-readable name and a **+ Add** button. Adding one puts that colour in the palette immediately, one press to one token. **In context** previews your added colours on sample compositions.

![Generated accents, each with a swatch, an auto-generated name, its hex and an Add button](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=1800&css=.start-head%2C.be-colour%7Bdisplay%3Anone%7D&drive=click%3A.be-generate-detail%3Anot%28%5Bdata-be-rebuild%5D%29%20%3E%20summary%3Bwait%3A500&cropSelector=.be-candidates&walker=1&format=svg&dark=1&filename=bs-harmony-candidates)

### Committing a generated palette

Adding a suggested colour or shade group keeps the rest of your palette. For a complete replacement, open **Rebuild the whole palette…** and press **Preview full rebuild**. The review explains the changes: how many roles stay as you assigned them, how many colours you added yourself are kept, how many shade curves get re-anchored, how many print locks re-pinned, how many hidden shades stay hidden, how many gradient stops keep their colour.

**Apply rebuilt palette** on that card commits it; **Cancel** walks away and changes nothing. Once it has run, the card offers **Undo** with focus already on it - and a checkpoint of the whole design system is taken *before* the swap, so "put it back the way it was" is a restore rather than a lost afternoon.

### The palette, the chart and each swatch

The palette lists the design system’s colours in foldable groups, each with its own **+ Add** control. Create and rename groups to organise your work. A role never makes a second tile: one token is one tile, and a tile a role points at wears a small corner mark instead (**P**, **S**, **Su**, **T**). Below the tiles, **Colour chart** folds open on two views of the same swatches: the **Wheel** (the OKLCH wheel - drag a dot to recolour it, click a dot to edit it or click empty space to drop a new swatch) and the **Gamut** chart, which shows where the displayable range actually ends. `#/start?area=color&focus=chart` opens the card directly, as `?wheel` always has.

![The palette pane, every group foldable, with the download pill parked at its bottom edge](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=1000&dpi=192&waitMs=1800&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200&cropSelector=.be-split-side&walker=1&format=svg&dark=1&filename=bs-palette-pane)

![The OKLCH wheel - angle is hue, distance out is chroma and the greys ride a lightness rail down the side](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dcolor%26focus%3Dgenerate%26seed%3D%2523e0452b&width=1440&height=900&dpi=192&waitMs=2400&css=.start-head%2C.be-pal%2C.be-gradients%7Bdisplay%3Anone%7D&drive=click%3A%5Bdata-be-add-ramp%3D%22primary%22%5D%3Bwait%3A1200%3Bclick%3A%5Bdata-be-chart%5D%20summary%3Bwait%3A900&cropSelector=.be-pal-wheel&walker=1&format=svg&dark=1&filename=bs-colour-wheel)

Click any swatch to open its editor:

- **Rename** it.
- **Set the colour** - the picker opens on perceptual **OKLCH** sliders, with modes for **Hex**, **HSL**, **RGB** and **CMYK**; the value field reads *and* writes in whichever space is active, so you can paste a hex or type ink percentages. Note that entering CMYK sets the *screen* colour by conversion - to pin exact inks, use the print lock below.
- **Stored as** - choose how the swatch is persisted: **LCH** (the default - perceptual, wide-gamut, the best choice for editing), Hex, RGB or HSL. Override it when you need to pin an exact legacy hex or match an sRGB value.
- **Use as** - hand this swatch one of the brand roles directly, without going back to the Roles panel. (A role's own tile doesn't offer it - a role can't take a role.)
- **Print substitutes** (folded) - lock the colour's print behaviour:
  - **CMYK** - switch it from **Auto** to **Locked** to override the automatic sRGB→CMYK conversion with exact ink values (C/M/Y/K, 0–100).
  - **Spot colour** - switch it from **None** to **Set** to lock the swatch to a spot colour; give it a **Name** (e.g. `PANTONE 186 C`), an optional **Book** and an optional **Finish** (Ordinary ink by default) for when the ink is not an ink at all - a foil, an emboss or deboss, a spot varnish, a soft touch or a die cut, crease or perforation.
- **In other spaces** (folded) - the same idea widened: each row is a space this swatch can be expressed in, either derived from the canonical value or authored by you, and an authored one wins at export.

These print locks are what a press uses when you export a CMYK PDF or TIFF - see [Exporting](/info/exporting.html#colour-profiles).

**Deleting a swatch** is safe: derived ramp steps and theme roles are *hidden* (the underlying token keeps resolving, so nothing downstream breaks), while colours you added yourself are removed outright.

### Working with many swatches

Each swatch has a separate drag handle. Drag it to reorder colours within its group, or focus it, press Space, use the arrow keys, and press Space again to drop. Escape cancels. Order survives reopening the studio and can be undone. To move colours between groups, use the swatch editor’s **Group** control or select several colours and use **Move**. Token names and role references stay intact.

Selection in the palette pane is a gesture, not a mode. There is no button to press first, and the bar arrives with the first selected tile and leaves with the last.

- **Drag on the pane's empty space** to draw a rectangle: every tile it touches joins the selection, across group boundaries. A folded section contributes nothing, and a drag that never moves clears the selection.
- **Shift-click** takes the range in reading order; **Cmd/Ctrl-click** toggles one tile; a plain click still opens that tile's editor.
- Every group header carries **Select all**, and **Cmd-A** with a tile focused takes every colour the design system owns - never a starter one.
- The grid has one tab stop. Arrows walk it, Shift-arrows extend the selection, Space toggles a tile, Delete removes the selection and Escape clears it. (Arrows only move the focus: to nudge a channel, press `l`, `c` or `h` first, as the readout says.)
- On a touch screen there is no rectangle. Press and hold a tile to start a selection, then tap to add; per-group **Select all** carries the rest.

The bar itself reads **{n} selected**, then **Move to** (an existing group, or a new one you name inside the menu), **Give a role** (each selected colour takes the next role in turn, so four tiles fill all four roles in one press), **Download** (the selection in any of the six palette formats), **Copy values** (one line per colour in its stored notation) and **Delete**. Move to and Give a role appear once the palette has shades to move around. One Ctrl/Cmd-Z undoes a whole bulk action - a move of forty, a role walk, a delete - and a delete says what it kept, because a selection reaches tiles this room does not remove.

### Gradients

An optional **Gradients** panel builds blend tokens from the palette for backgrounds and accents. Skip it entirely if the design system doesn't do gradients. Each gradient has a preview, named stops (2–8) and an angle. The key behaviour: **a stop references a swatch**, so recolour that swatch and the gradient follows. Interpolation runs in OKLCH for clean blends. Delete a stop to trim the run.

### Take the palette elsewhere

The floating pill parked at the bottom edge of the palette pane downloads the whole palette as **Design tokens (JSON)**, **CSS variables**, **CSS classes**, **SCSS variables**, a **GIMP palette (.gpl)** or an **Adobe Swatch Exchange (.ase)** - so the design system drops straight into Illustrator, Figma, GIMP or a stylesheet. It sits outside the pane's scroller, so it keeps its seat however far the palette scrolls, and it appears once the palette has shades. (You can also download the palette from the [Catalogue](/info/using.html) view.)

## Type

This room grows the same way. With no face of its own it is one card and one decision: **Primary**, set at reading size in the face serving it today, a **Starter** tag beside the name, a filled **Choose a face** and the line *"Nothing installs until you choose one."* Under the card sits *"Headings, code and italic follow the primary until you choose them"*, with **Choose them separately** revealing the other three cards for the rest of the visit.

![The Type room with no face chosen yet - one card at reading size, a Starter tag on it, and one filled Choose a face](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=brand-type)

Choose one face and the room opens out into **four role cards**, the Fonts list and the live specimen. The four faces are the ones the app, the tools and every export actually read:

- **Primary** - body copy, buttons and every tool.
- **Headings** - the display face for `h1`/`h2`.
- **Code** - a monospace face for code and data.
- **Italic** - a true italic companion for emphasis, quotations and asides.

Headings, code and italic each fall back to the primary until you assign them, so a one-face design system needs no decisions here at all.

**A tint means you chose it.** A card is tinted only where you installed that face. A starter face carries the same **Starter** tag the palette's inherited groups wear, in the muted register and with no tint, and a role nobody has chosen reads **↳ follows Primary** rather than repeating the primary's name as though it had been picked. The button says **Change** on a face of your own and **Choose a face** everywhere else. Nothing on a card commits anything: the button opens the **compare stage** scoped to that role.

![The four role cards revealed - each set in the face that serves it, with a Starter tag where nobody chose one and Italic following the primary](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtype&width=1440&height=1000&dpi=192&waitMs=2600&drive=click%3A%5Bdata-be-typemore-toggle%5D%3Bwait%3A600&cropSelector=.be-typecard-grid&walker=1&format=svg&dark=1&filename=bs-type-specimen)

### The compare stage

![The compare stage open under its card, with the search row, the pinned families and the cards folded to a one-line strip](/t/url-shot?url=%2F%23%2Fstart%3Farea%3Dtype%26focus%3Dstage&width=1440&height=740&dpi=192&waitMs=1800&format=svg&walker=1&dark=1&filename=bs-type-stage)

The stage opens **inline in the room**, not in a dialog, and directly under the card you pressed. While it is up the cards fold to a one-line strip of role and face, so the stage is on the first screen even on a phone. Escape cancels and hands the keyboard back to the card you opened it from.

Choosing a face is three presses:

1. **Choose a face** on the card.
2. Type a family name and press **Preview** - or press one of the six **Pinned** families under the field, one press each. The card appears already loading, with a skeleton bar where the specimen will be instead of the interface face standing in for a face you have not seen yet.
3. **Use this face**.

**Consent is asked once, on the press you made.** The first time a preview reaches Google Fonts, a dialog says what happens: *Google learns the family name and your IP address. The file is then kept on this device and used offline. This is the one step in the studio that reaches a third party.* **Fetch from Google** goes ahead and is remembered. **Cancel** leaves the card saying *"Not fetched. Nothing was sent to Google."* with its own live **Fetch from Google**, so changing your mind is one press on the card itself. No card ever shows a dead button: whatever state it is in, its one primary names the next step.

**Drop a font file on the stage** and it previews at once - **TTF**, **OTF** or **WOFF** off your own machine, which is the path for a licensed corporate typeface you already own. That drop zone is the only file door in the room.

Either way the face stays on this device, renders in the app, in the tools and in every export, offline forever, and travels in the design system file - nothing is fetched at render time. Everything on Google Fonts ships under an open licence (OFL/Apache/UFL).

### Fonts on this device

The **Fonts** panel lists every face this device holds and the role it serves. Faces you added lead under **In the design system**, each with its roles and a delete, and the one serving Primary carries the badge. The starter faces follow in one folded row - *Starter · SUSE, SUSE Mono · serving Primary and Code until you choose* - muted, with no delete and nothing to promote, because neither is a decision anybody made. **Add a face** opens the same compare stage unscoped.

The **Type roles** panel at the foot shows a live specimen of each role - body and UI in the primary, an optional display face for the top headings, an italic for emphasis, a mono for code and data - with the family and its state beside each one (*Inter*, *SUSE · starter*, *SUSE · follows Primary*), so the whole set can be read at once.

## Tokens

The rest of the design system, editable without touching code:

![The Tokens room - a corner-radius slider plus spacing, sizing, shadows and the rest of the system](/t/url-shot?url=%2F%23%2Fstart%3Ftab%3Dtokens&width=1440&height=740&dpi=192&waitMs=1600&format=svg&walker=1&dark=1&filename=brand-tokens)

- **Rounded corners** - a single radius slider (0–1.5rem) that cards, buttons and panels across the app follow.
- **Neutrals** - the ink-through-paper ramp a fresh install ships with, listed as **Neutrals · starter · 9** with its nine steps and an **Open** into the Colours pane. It is the one place the starter neutrals are managed, and the *starter* tag goes the moment the ramp is generated rather than inherited.
- **More tokens** - add and edit **spacing**, **sizing**, **stroke width**, **opacity**, **rotation**, plain **numbers** and **shadows**. Pick a type, name it (*Gutter, Card shadow…*) and set its value. These are stored as standard [design tokens](/info/design-tokens.html) (DTCG) and travel with the design system.

## Files

Drop the files your brand keeps - logos aside - here: **vector**, **image**, **audio** and **motion** (video, Lottie, animated) assets. They land in your [Catalogue](/info/using.html), sorted into sections and ready in every tool's asset picker. Everything stays on this device. (The rail labels the room **Files**; the URL key stays `catalogue`, because a panel key is a permanent contract.)

## Bring a brand in

**Add from…** at the foot of the rail opens a two-stage picker. The first stage asks what you *have*, not what format it is:

- **Design tokens or a design file** - DTCG or Tokens Studio JSON, a Penpot project, a **zip of token sets**, a Lolly design system pack or an SVG.
- **PDF** - a deck or a guidelines file, read on this device for its colours, its marks and its embedded typefaces.
- **Logo or screenshot** - an image becomes a suggested palette, read on this device. Nothing is uploaded. This reads colours, not the typeface or layout in the picture.
- **Saved web page** - choose one HTML file and its CSS files, or paste HTML or CSS. Up to 20 files and 2 MB in total. Only supplied text is read; linked resources are not fetched and scripts do not run. This path also works without the extension or desktop app.
- **Font file** - TTF, OTF or WOFF. Opens the Type room, where the face installs.
- **Website** - one page, read for its colours and type. This tile only appears on a device that can actually read a page, because a disabled tile advertising something nobody can press is worse than no tile at all. Where it does appear it names its reader plainly: fetched by the app on this device, or read through the browser extension in a background tab, signed in as you. Naming a URL only *prefills* the field - the fetch button is the consent, so a link somebody sends you can never start a read.

Pick the design-file source and the second stage is the card below: the accepted formats lead as icon tiles in preference order, and the whole card is one drop target - click anywhere on it or drag a file onto it. You can also drop a file straight onto the studio.

![The import card - the accepted formats lead as icon tiles, and the whole card is one drop target](/t/url-shot?url=%2F%23%2Fstart%3Fsource%3Dfile&width=1440&height=900&dpi=192&waitMs=1600&css=.start-import-modal%20.modal-msg%2C.start-import-modal%20.modal-title%7Bdisplay%3Anone%7D&cropSelector=.start-import-drop&walker=1&format=svg&dark=1&filename=bs-brand-import-formats)

What each design file gives you:

- a **Lolly design-system pack** (`.lolly`; legacy `.zip` is still accepted) - installs in one step;
- a **Penpot** export (`.penpot`) - pulls in its design tokens;
- a **Design Tokens** file (`.json`) - W3C DTCG;
- a **Tokens Studio** file (`.json`) - Tokens Studio;
- a **plain SVG** (`.svg`) - Lolly scans its colours and lets you pick which to keep, the first becoming your primary.

A logo/screenshot, website or saved page opens **Your suggested design system**. See an example using the proposed colours, choose a different **Main colour** if needed, and name the system. **Use this design system** applies the generated light and dark palettes and returns to Overview. Existing fonts stay in place. This replaces the active system's colours and other token settings. A checkpoint must succeed first; **Restore brand settings** recovers the previous settings.

**Source details and individual choices** shows what was read, detected font names and the preview's text/action contrast. It also offers **Choose individual items in the tray** and **Download design context**. The JSON report carries observations, proposed tokens and source information; saved HTML/CSS includes a SHA-256 of the supplied text. It contains no raw page text and is not a signed Content Credential. Font names are suggestions: Type remains the place to choose and install fonts.

PDF and other design-file imports keep their existing review controls. Items kept in the **Tray** change nothing until added through the room that owns that kind of material.

`#/start?source=<kind>` opens the picker on a given source (`file`, `pdf`, `image`, `font`, `url`, `page`), and `?import` opens it on the plain list.

## Move a brand between devices

**Export** at the foot of the rail writes a single **`LollyBrand-….lolly`** - your tokens, fonts, logos and theme preference, with an integrity manifest it verifies on the way back in. Web releases before 1.0.7 named the same payload `.zip`; that legacy spelling is still accepted. Beside it, **Tokens (.json)** writes the plain design-tokens document on its own: no fonts, no logos, just the tokens, which is what a repo, a CI step or another tokens tool actually reads.

Bringing one back is **Add from… → Design tokens or a design file** (above), or a drag-and-drop onto the studio. This is how a colleague hands you a brand, or how you carry one to a second install - no account, no cloud. To bring in a brand from the command line instead, see [`ingest:brand`](/info/configuration.html#brand-packs).

## Restore earlier settings

Choose **Restore brand settings** at the foot of the rail, select a dated checkpoint, then press **Restore**. It restores colours, type settings and other brand tokens for the active brand. Font and image files stay as they are.

Lolly saves your current settings as **Before restore** before applying the checkpoint. Choose that checkpoint to reverse the restore, including after closing and reopening the browser. The latest 20 checkpoints are kept on this device. If storage cannot be read or the current settings cannot be saved, the dialog reports the problem so you can retry.

## Versions

**Versions** at the foot of the rail is where a design system stops being a moving target. Publish one and you get a **permanent, named copy** kept on this device: it never changes afterwards, so a tool that pins it keeps drawing the same thing. The panel stays hidden until there's something of your own to publish, so a studio that never publishes never sees the controls.

Three things to know before you press anything, and the panel says all three before the press rather than after:

- **A version is permanent.** There's no delete yet, so the panel states what has been kept and that it stays kept rather than offering a button that lies.
- **Removals lead the compatibility card.** Added and changed tokens are news; a *removed* one is the thing that breaks a tool, so it's named first and called what it is.
- **Publishing can't be undone; restoring can.** *Restore latest from this version* is an ordinary edit to the head, so it goes onto the studio's undo stack and the panel offers you the **Undo** straight away.

You can **Publish only**, or **Publish and make active** - the difference being whether tools and the app follow that version from now on or keep following your latest edit. **Follow the latest again** puts every edit live the moment it's made. `#/start?area=versions` opens the panel directly.

## When the brand is fixed

Some builds ship a **locked design system**, such as the SUSE Brand. Opening it shows a read-only note with **Make an editable copy** and **Switch**. Its original colours, fonts and tokens stay intact. Your own local systems remain editable, even when the locked system was the first one on the device. In Profile, **Open** selects a system and opens its studio; **Make a new one** creates a local system and opens it at `#/start` with its name field focused.

## Where to go next

- **[Using Lolly](/info/using.html)** - the canvas, saving, projects and the catalogue.
- **[Design Tokens](/info/design-tokens.html)** - the token model your brand is expressed in.
- **[Exporting & formats](/info/exporting.html)** - print units, CMYK and the formats your brand renders into.


## Find and compare a look

Open **Find a look** from Overview or the design-system list on Profile. Browse systems saved on this device and a few reusable Lolly examples. Search by name, colour tag or declared font. **Closest to my current palette** sorts by measured colour similarity, with matching font families breaking ties; it is not a quality score.

Select one look to review it, or two to compare. The review button stays available on a small screen. Selecting a look changes nothing. **Use this saved system** switches through the existing design-system registry. **Use these colours** applies an example through the normal checkpoint and install flow, preserving the current fonts. **Restore brand settings** can recover the previous look.

Under **Details and design context**, saved systems have editable **Search tags** and a context download. Examples use original Lolly colour recipes; there is no remotely scraped inspiration collection or required account.

![Compare Sunroom and Orchard side by side before applying either colour system.](/t/url-shot?url=%2F%23%2Fstart&width=1280&height=900&dpi=96&waitMs=3000&format=svg&filename=brand-compare-looks&try=1&drive=click%3A%5Bdata-ds-door%3D%22looks%22%5D%3Bwait%3A500%3Bclick%3A%5Bdata-look-select%3D%22example%3Asunroom%22%5D%3Bclick%3A%5Bdata-look-select%3D%22example%3Aorchard%22%5D%3Bclick%3A%5Bdata-looks-review%5D%3Bwait%3A500&cropSelector=.ds-looks-comparison&waitSelector=%5Bdata-ds-door%3D%22looks%22%5D&walker=1&rasterDpi=96)

The comparison keeps both palettes visible together. Reviewing a look changes nothing until you choose **Use these colours** or **Use this saved system**.

## Read source evidence

The source review's optional details show typography, gaps, padding and corner values where observed. Saved HTML/CSS and native website reads report declarations, which may not be used by the rendered page. The browser extension can report measured styles from a bounded sample of visible elements, with its viewport and browser colour preference. Older extensions still work with declared styles. Missing fields say **Not observed**.

These are observations, not automatic style settings. Font files are not fetched or installed by a reference scan, and source spacing does not silently replace your own. Counts describe occurrences in the sample, not confidence or quality.

## Check a composition against the design system

In Design, open **Export**, then **Before you export**. The check uses the same effective design-system version as the render. It compares authored colours, token aliases, font choices and image asset IDs. Custom values may be intentional; an image outside the declared brand assets is a review item, not a prohibited image.

Where a concrete colour or font suggestion is available, its button changes that one layer. The normal **Undo** restores the original value. Locked or changed layers are not overwritten by an old suggestion. Missing source evidence stays separate from a match. Rendered contrast and text layout are checked by the existing mounted checks. Gradients, effects, nested tool content, rights and subjective quality are not assessed by the brand comparison. Checks do not block Download.

## Use design context locally

**Download design context** includes the token document, resolved colours, declared font families, asset IDs, source evidence where recorded, coverage and explicit rules. It does not include font files or proof of ownership. The reference review also includes its proposed tokens and observations.

The CLI can read either download without a server:

```bash
lolly system import ./lolly-design-context.json
lolly system context --output=design-context.json
lolly system check ./design-inputs.json --file=design-context.json
```

`system check` accepts Design inputs with a `boxes` array or a compiled Design document. It reports proposed fixes without modifying the composition. It cannot measure browser layout or rendered contrast. The existing MCP resource **lolly://design-context** exposes the effective system's context through the configured local MCP process; no new hosted service or API key is needed.
