# Lolly Batch and Lolly Multi-edit

<a id="batch-and-multi-edit"></a>

**Lolly Batch** makes many versions of one design, such as a card in a dozen languages or every size of a banner. **Lolly Multi-edit** makes one change, such as a new date or headline, across several different saved designs.

Both run on your device and export through the same render path as the tools.

::: cols
## Batch

- One template, many rows. Each row is one set of inputs and makes one file.
- Fill the rows by typing, pasting from a spreadsheet or importing a CSV.
- No limit on rows; 50 show per page.
- Opens from **Lolly Batch** in the Projects header (`#/batch`).

<a id="multi-edit"></a>
## Lolly Multi-edit

- Two to eight different saved designs, side by side as live cards.
- One sidebar edits the inputs they share, then each card's own.
- Each design saves back to where it came from.
- Opens from **Edit together** in the Projects selection bar.
:::

<!--i:eti-table-->
## Make many versions of one design

Open the **Projects** view and press **Batch** in its header. The grid starts with one row. Choose a template in that row, then duplicate the row or paste data from a spreadsheet. Opened from inside a folder, Batch returns you to that folder.

![Batch on a new grid: the file name and the row tools across the top, and the first row's template list open on the tools you can choose](/t/url-shot?url=%2F%23%2Fbatch&width=1440&height=900&dpi=192&waitMs=3500&walker=1&format=svg&dark=1&filename=use-batch-toolbar)

**Fill the rows.** Type into a cell or paste a block from Excel, Google Sheets or another spreadsheet. **Import CSV** adds rows or replaces the batch. When you paste into a cell that holds export settings, Lolly asks which input each pasted column fills. **Export CSV** writes the grid out. Open **Columns** below the grid to show more inputs, or per-row width, height, unit and DPI. A number, text or choice column's **Fill** popover also has a **Design token** section that links one token across the column's rows ([Link many documents at once](/info/token-workflows.html#link-many-documents-at-once)).

**Set the output.** The toolbar sets the zip's file name, the **Default format**, units and DPI for every row. The format menu is the export panel's grouped list of the formats the catalogue offers and your browser supports. A row with its own format, size or file name keeps its own setting.

**Render.** **Render all** exports every row into one `.zip`. With rows selected, **Render selected**, **Export selected CSV** and **Print selected rows** act on those rows only. Clear the selection to work on the whole batch again. **Print sheet** lays the rows out on a printable sheet. **Batch activity** reports each import and render, and folds away.

**Keep the batch.** **Sessions** saves every row of the grid as a named batch session, whatever is selected. The session reopens from Projects. **Folders…** in the same menu opens a Projects folder as rows, one per saved session; each file name carries its folder path.

::: details Selecting rows and cells
Select rows with their checkboxes, or Shift-click a checkbox for a range. The header checkbox selects the current page, and **Select all *N* rows** takes the rows on other pages too. Selections stay as you move between pages. **Edit input**, **Duplicate** and **Remove** act on the selected rows, and **Undo remove** restores the rows removed last. From a focused cell, Shift+Space selects that row and Escape clears the selection.

Drag across cells, Shift-click a cell or use Shift+Arrow keys to select a rectangle. **Copy cells**, or Ctrl+C / Command+C, copies the values for a spreadsheet. Ctrl+A / Command+A from a focused cell selects every visible column on every page; from a row checkbox, the same shortcut selects every row. Selecting cells leaves checked rows checked. Double-click a cell or press Enter to edit its text. Paste a rectangle from the clipboard, or paste one value to fill every selected cell; blank cells and multiline text keep their positions.
:::

### Colourways and themes per row

Each row keeps its own theme choices: light or dark, and a colourway when the design system has them. A row opened from Projects, a folder or a saved batch renders and previews in the choices its session was saved with. The print sheet, a duplicated row and a filled row keep them.

A CSV carries the choices in a `_themes` column after the size columns. The column has the same JSON as the `_themes` link parameter, for example `{"":"dark","colourway":"beach"}`. A blank cell, or `{}`, means the design system's defaults. The column is written only when some row has choices. On import, a cell that is not valid theme choices is listed as an issue and its row renders in the defaults.

::: note Set a row's choices in the CSV
The grid has no control for changing a row's choices yet, so set them in the CSV or in the saved session.
:::

### A language for each row

A tool that prints its own wording, such as Certificate, can take a `language` column with a short language code such as `de`, `ja` or `ar`. Each row then prints its wording and date in that language. Arabic and Urdu rows are laid out right to left. A blank cell follows the app's language. A language Lolly has no translation for yet prints in English, date included, so a certificate is never half translated.

### Batch, or Render folder

To re-render sessions you have already saved, select them in Projects and use **Render selection**, or **Render folder** for a whole folder. [Find and recover your work](/info/find-your-work.html#find-something-you-saved) covers both.

<!--i:eti-layers-->
## Edit several saved designs together

Tick between two and eight saved sessions in **Projects** and choose **Edit together** from the selection bar. They open side by side as live cards at `#/multi?s=<slot>,<slot>…`. Each card is a real render of its session and shows what will export.

One sidebar drives them all:

- <!--i:sliders--> **Shared** comes first: every input that two or more of the sessions declare the same way (same id, type and constraints, the rule the batch grid uses for its columns). A change to a shared control reaches every session that declares the input, live on every card. Two sessions of the same tool share everything; two different tools share only their common inputs. The Shared card's **Input actions** menu links a design token in every session that declares the input.
- <!--i:document--> Below the Shared card, **one folded card per session** holds all of that session's own inputs, as in the tool's own sidebar, with a compact export block: **Format**, **W** / **H**, **Unit**, **DPI** and **Download**. That Download saves the session first, then renders the file with the same file name, format and Content Credentials it would have from the tool.
- <!--i:search--> **Filter inputs…** at the top narrows the controls on every card at once.

Click any card (or press Enter on the card) to open that session's sidebar card. **Save all** writes every session back to its own slot. **Download all** saves first, then renders the set into one zip, as **Render selection** does in Projects, and offers the optional password lock.

Each card draws in its own session's theme choices, including a tool placed inside the design. The app around the cards keeps its own colours. **Save all**, the downloads, **Batch grid** and **Send to Print Sheet** keep each session's choices.

### Limits

- **Eight at most.** Every card mounts its own live runtime, and eight cards stay responsive. A link that asks for more, or for a session that no longer exists, says so and does not half-load.
- **The link is local.** It names your own saved slots and reopens that set on this device. It is not a share link.
- **For anything bigger,** choose **Edit as sheet** in the same selection bar. It opens the selection as rows in the batch grid (`#/batch?s=…`), with no size limit and no same-tool rule. Folders stay out of both: open a folder in the grid with **Sessions → Folders…**, or render one with **Render folder** in Projects.
- **Search does not reach Lolly Multi-edit.** It is the only view the search bar does not cover.

<!--i:eti-map-pin-->
## Where to go next

- **[Export a file](/info/exporting.html)**: the formats, sizes and print settings each row can use.
- **[Templates](/info/templates.html)**: starting points that make a good first row.
- **[Find and recover your work](/info/find-your-work.html)**: Projects, folders and rendering what you saved.
