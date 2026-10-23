<!--
Two facts on this page are separate and must not be merged into one sentence.
(1) A SESSION is one document you come back to; a TEMPLATE starts new ones.
(2) OWNERSHIP decides hide-versus-delete, not whether a design system is locked.
A shipped template is a file in the tool's own folder that re-syncs from the
catalogue, so the only thing a device can keep is a per-profile cover over it -
which is what "Hidden" means here. Never describe hiding as deleting.
User templates and choices about shipped templates ride the profile record.
A profile backup carries those records; individual templates also have the
export and sharing routes described below.
-->

# Templates

A template is a saved starting point for a tool. Open the tool on one and every control arrives already filled in, ready for you to change a few words. Some templates ship with the tool; the rest are ones you saved yourself, out of a design you had already got right.

::: cols
## A saved session

One document you come back to: reopen it, change the date, save it again. It lives in [Projects](/info/find-your-work.html#find-something-you-saved).

## A template

Starts new documents, as many as you want, and stays as it was while each of them goes its own way. It appears inside the tool it belongs to.

## A .lolly file

A file you hand to someone else ([Sharing your work](/info/using.html#sharing-your-work)). A template can become one, and one can carry a template.
:::

Your saved templates, and your choices about shipped ones, are kept on your [profile](/info/profile.html), the same on-device record as your name and your starred tools. A profile backup carries them to another device, and [Passing one on](#passing-one-on) covers sharing a single template.

## Save one from a tool

::: timeline
- <!--i:check--> Press **Save as**, beside **Download** in the export panel. In **Design**, **Save as a template…** in the Lolly menu opens the dialog with the template card ready.
- <!--i:document--> Of the two cards, **Save to a project** keeps this one document and **Save as a template** keeps a starting point for new ones.
- <!--i:pentool--> Name it, add a line of description if that will help you recognise it in six months and save.
:::

The template card also carries a checkbox labelled with the tool you are in, such as **Start new Chart documents with this**. Tick it and every blank open of that tool begins from this template instead of asking; [Start with](#start-with) has the details.

The quick **Save**, the tick beside **Export** on the render pill, stores the session you are working in with one click and no dialog. **Save as** is the one that asks which kind of save you meant.

**What a template keeps:** every setting you touched, plus the export size and format you chose, so a poster template opens back at A4 and 300 dpi rather than at the tool's default size. Pictures are kept as references to the asset in your library, not as copies.

**What it never keeps:** a file you dropped into a **file** input, which you handed the tool for one job; and the document's own name, because each new document gets its own.

A tool with nothing to fill in, such as a file converter, shows no template card.

## Save one from Projects

You do not have to open the tool. In **Projects**, right-click any saved session and choose **Save as a template…**. Tick several tiles first and the same item makes one template out of each, named after each session.

The sessions themselves are untouched, and stay where they were.

## Start with

Each tool remembers one of three answers for a blank open:

- **Ask me every time** - the chooser opens with every template that tool has. This is the answer until you choose another.
- **Blank canvas** (**Blank** in Projects) - the tool opens on its own defaults, no chooser.
- **A template** - the tool opens on that one, no chooser.

Four places set it: the checkbox in the save dialog, the tile menu in the chooser, the Templates collection in Projects, and the tool card's info dialog.

Three things it never changes:

- **+ New** on a tool card always asks. It is the way back to the chooser when you have set a template and want something else this once.
- A link somebody sends you opens what the link says, and so does a command you type at the terminal. Your own starting point is a preference on this device; it never rewrites what a shared link renders on anyone else's.
- If the template is deleted or hidden later, the tool quietly goes back to asking. Nothing breaks, and nothing opens on something that is no longer there.

## Managing them

### In the chooser

The chooser opens on a blank open when the answer is **Ask me every time**, and from inside a tool whenever you want it: Design's **Lolly** menu has **New from template**, and every other tool has a **Templates** button above the controls.

Every tile carries a menu, on right-click, long-press, or the **…** that appears when you point at it:

- **Use** it, the same as clicking the tile.
- **Share with rules**, described under [Share a constrained tool](#share-a-constrained-tool).
- **Start Chart with this** (again naming the tool you are in), or **Ask me every time** if this one is already the starting point.
- **Rename** and **Edit description**, on one of yours.
- **Update from this document**, on one of yours, when you opened the chooser from inside a tool. The template takes the settings of the document you are working on.
- **Make a copy**, on one that shipped, so you have your own version to change.
- **Export as file (.json)**, on one of yours, for passing one on.
- **Hide**, on one that shipped, or **Delete**, on one of yours.

### The Templates collection

Open **Projects** and choose the **Templates** tile. Inside a folder, the **Templates** chip in the rail opens the same collection. It lists templates across every tool in three groups: **Yours**, **Shipped with** each tool, and **Hidden**. There is a chip per tool to narrow it down, the search box works here as it does everywhere else in Projects, and every tile has the chooser's menu, with **Share template (.lolly)** added on one of yours and without **Update from this document**.

It is a view, not a folder: nothing can be dragged into it, and it has no rename or delete of its own.

![The Templates collection filtered to QR event starting points](/t/url-shot?url=%2F%23%2Fp%2F__templates__%3Ftool%3Dqr-code%26q%3Devent&width=1440&height=1000&dpi=192&waitMs=1600&waitSelector=.tpl-sec%3Anot%28%3Ahas%28img%5Bdata-tpl-preview%5D%3Anot%28%5Bdata-preview-state%3D%22ready%22%5D%29%29%29&walker=1&format=svg&dark=1&filename=templates-collection)

### Start from New asset

**New asset** in the Projects header opens the shared picker, at the root or inside a folder. Choose its **Templates** tab to browse your starting points first, followed by those shipped with tools. Hidden templates stay out of this picker. Search by template name, description or tool.

- **Open a template** to edit a new creation. Its first save files it in the folder you came from and returns you there. Starting from the Projects root saves it directly at the root.
- **+ Add** saves a new creation with the template's settings immediately and keeps the picker open, so you can add another.

Both actions leave the template unchanged. To rename, hide or delete a template, open the Templates collection instead. Images need a real folder when added through this picker; tool and template creations can also be saved at the root.

Template cards load previews as they come into view, using your current brand. An unavailable preview keeps the template's name and a **Preview unavailable** label. If your saved templates cannot be loaded, **Try again** retries the list while keeping available choices visible.

![The New asset picker with rendered QR templates and their Add actions](/t/url-shot?url=%2F%23%2Fp&width=1440&height=850&dpi=192&waitMs=1600&drive=click%3A%5Bdata-create-btn%3D%22tool%22%5D%3Bclick%3A%5Bdata-tab%3D%22templates%22%5D%3Bpress%3AQ%7Con%3D.asset-picker-search%3Bpress%3AR%3Bhover%3A.asset-picker-toolcell%3Alast-child+img%5Bdata-preview-state%3D%22ready%22%5D&cropSelector=.asset-picker-panel&walker=1&format=svg&dark=1&filename=templates-picker)

### Hide or delete, depending on the author

What you made, you **delete**, and it is gone from this device.

What shipped with a tool, you **hide**. A shipped template is a file that comes down with the tool and arrives again on the next sync, so hiding it puts a cover over it for your profile rather than pretending to erase the file. That is the better bargain: a starter can never be lost by accident. A **Hidden (N)** entry counts what you have put away, and restores any template from that list.

To change a shipped starter rather than lose it, use **Make a copy**. The copy is yours to rename, edit and delete, and you can hide the original afterwards so only your version shows.

A design system can arrive with some of its starters hidden already, so a team sees a curated set on day one. Nothing is missing, and **Hidden (N)** brings any of them back for you.

### Passing one on

- **Export as file (.json)** writes the template out in the same file format a tool's own shipped templates use. Drop it into a tool's `templates/` folder, or send it to whoever maintains that tool, and it can ship for everybody.
- **Share template (.lolly)**, in the Templates collection, wraps it as a file you can send. Opening it on the other device adds it there as a template.

## Presets

A template that shipped with a tool can carry **presets**: named variants inside the one template, like a poster in three layouts. Each preset is a button on the template's tile in the chooser; pick the one you want.

You cannot make a preset in the app. A saved template is how you keep a variant of your own: save the second layout as its own template, name it for what it is, and it appears in the chooser beside the first.

## Share a constrained tool

A saved template is a starting point in its original tool. To give recipients only selected inputs, choose **Share with rules** from a template's menu, or from a saved tool session in Projects. This opens a separate authoring copy and leaves the source intact. Design offers object rules; other supported still tools offer an ordered list of editable inputs over their existing renderer. The resulting `.lolly` installs a separate tool with fixed settings and explicit controls. [Share a design with rules](/info/create-a-tool.html) covers the supported inputs and the preview and checking steps.

---

**Related:** [Using Lolly](/info/using.html) for sessions, Projects and sharing. [Your favourites](/info/favourites.html) for the other way of keeping something to hand. [Profiles](/info/profile.html) for the on-device record all of this is written onto.
