# TUI

The TUI (text user interface) is Lolly in your terminal. You browse tools, fill in inputs, save projects, edit your profile and export finished files, all from the keyboard and without opening a browser. It runs the same engine and the same render path as the web app and the CLI, so its files match theirs.

From a checkout:

```bash
pnpm run tui
```

With a standalone `lolly` binary, `lolly tui` and `lolly-tui` start the same thing. See [Install](/info/cli.html#install) for the two ways to get the command.

The TUI takes over the whole screen, like `vim` or `htop`, and restores your terminal when you quit. It needs a real interactive terminal (a TTY); with its output piped, it says so and stops.

::: figure tui-start
The first time it runs, the TUI opens on Start. Every later session opens on Tools, with the five views on the number keys.
:::

The first time it runs, the TUI opens on a **Start** screen with five choices: **Make a QR code**, **One colour**, **Bring a file**, **Mix resources** and **Explore tools first**. Pick one with its number or `Enter`. None of them is a required step, and once you have chosen, later runs open on Tools.

## A first session

::: timeline
- <!--i:search--> **Find a tool.** On Tools, press `/` and type part of its name.
- <!--i:document--> **Open the tool.** `Enter` opens the tool view, with an **Inputs** panel beside an **Export** panel.
- <!--i:pentool--> **Fill it in.** `j` and `k` move between inputs, and `Enter` or `e` edits one.
- <!--i:sliders--> **Choose the file.** `Tab` switches to the Export panel, where you set the format, size and folder.
- <!--i:download--> **Export.** `x` writes the file, to your Desktop by default. `s` saves the session to Projects.
:::

Every view moves with `hjkl` or the arrow keys, opens with `Enter` and goes back with `Esc`.

## The five views

Switch views with the number keys: **1** Tools, **2** Projects, **3** Profile, **4** Assets and **5** System. The layout follows the web app's, fitted to a terminal: a narrow terminal stacks the two-pane tool view into one column, as the web app does on a phone.

**Tools** (`1`) is a card grid of every tool, with search, favourites, sorting and category filters. You can also open a pasted `lolly.tools` link already configured, or import a PDF or `.ai` file from disk, which becomes a saved, fully editable Design session (IDML and Penpot import stay in the web app). The TUI hides only the tools that need a live device the headless browser cannot open, such as microphone and camera recording.

**Projects** (`2`) holds your saved sessions in nested folders. Create folders, move sessions into them, open and delete them, and [batch](#batch) them into one `.zip`.

**Profile** (`3`) edits the details tools fill in for you (`bindToProfile`): name, email, phone and company. It also holds **Embed my details in exports**, the opt-in that puts your name and contact details into an export's provenance, and **Trust anchors**, the PEM certificate files the Content Credentials report trusts. Two actions live here as well: back up and render everything, and check a file's Content Credentials on the device.

**Assets** (`4`) browses every asset. Favourite or hide one, or export it to any format through the `asset-export` tool.

**System** (`5`) is the terminal's design system: start from one colour, bring a token file or `.lolly`, add resources, export a `.lolly` and switch systems. Its token inspector shows one choice per theme group, the issues, a searchable token list and, for one token, its trace through the tokens it reads and the tokens that read it back. See [Inspecting and reviewing design tokens](/info/token-workflows.html).

::: details Keys in each view
| View | Key | Does |
|---|---|---|
| Tools | `/` | Search |
| Tools | `Enter` | Open the selected tool |
| Tools | `u` | Open a pasted `lolly.tools` link, already configured |
| Tools | `i` | Import a PDF or `.ai` as a Design session |
| Tools | `f` / `F` | Favourite a tool / show only favourites |
| Tools | `o` / `c` | Cycle the sort / the category filter |
| Tools | `p` / `r` | Open Prepare for sharing / Rebrand |
| Projects | `n` / `m` | New folder / move a session into a folder |
| Projects | `e` | Export a whole folder |
| Projects | `Space`, then `b` | Tick sessions, then batch the selection |
| Projects | `c` | Run a CSV batch |
| Profile | `b` | Back up and render everything |
| Profile | `v` | Check a file's Content Credentials |
| Assets | `f` / `d` / `e` | Favourite / hide / export an asset |
| System | `c` / `i` / `a` | Start from one colour / bring a token file or `.lolly` / add resources |
| System | `e` / `u` | Export a `.lolly` / switch systems |
| System | `t` | Inspect tokens: `g` picks a group, `o` steps its choice as a preview, `Enter` traces a token |
| System | `s` / `y` | Review the previewed choices / store them on the active terminal system |
:::

### The tool view

The tool view puts an **Inputs** panel beside an **Export** panel and a preview. Every input type the engine models is editable from the keyboard: text, numbers, booleans and selects; repeating **`blocks`** (drill into a block, its rows and its fields to add, delete, reorder and nest); **`file`** inputs, where you give a path and the bytes are read locally for on-device utilities such as `strip-data`; and **`asset`** inputs, with a catalog picker on `Enter` or a typed id such as `lolly/logo/primary` or a pasted `lolly.tools` tool link, resolved to an embedded render.

::: details Keys in the tool view
| Key | Does |
|---|---|
| `Tab` | Switch between the Inputs and Export panels |
| `j` / `k` | Move between inputs |
| `Enter` / `e` | Edit the selected input |
| `Space` | Toggle a boolean |
| `←` / `→` | Cycle a select, or step a number slider |
| `x` | Export |
| `s` | Save the session |
| `y` | Print or copy a share link |
| `u` / `r` | Undo / redo |
| `p` | Show or hide the preview |
:::

**The preview.** For a design tool the preview is opt-in (`p`): the TUI rasterises the tool's SVG and draws it as a truecolor half-block image in the terminal cells, with no external image protocol. For a utility, where the output is the point, the preview is the main pane and appears by itself, even on a narrow terminal:

- a **text or interactive** utility (`color-palette`, `text-helper`, …) shows its rendered content as terminal text. The TUI walks the rendered page into structured, coloured lines, with headings, tabs, buttons and colour swatches drawn as blocks in their actual colour, read from the tool's own CSS;
- a **file transform** (`strip-data`, `compress-pdf`) shows a result summary with the size before and after;
- **`url-shot`** shows its capture settings: URL, size, crop and recolour.

## Prepare, Rebrand and import

Two more screens open from Tools. `p` opens **Prepare for sharing**, which inspects files for hidden data and personal values, lets you choose replacements and saves cleaned copies, all on the device (see [Utilities](/info/utilities.html)). `r` opens **Rebrand**, which reads a `.pptx` or `.pdf` deck, shows the plan as a checklist where you keep, replace or remove each item, then compiles the result to a folder (see [Rebrand a deck](/info/rebrand.html)).

## Export

The Export panel has **Format · Width · Height · Unit · DPI · Filename · Folder · Design system · C2PA · Imprint · Durable · Password**, with the output path worked out for you. Exports go to `~/Desktop` by default, and the folder is editable per export.

- **Design system** shows the exact words the export will record about its [design system and colourway](/info/exporting.html#the-design-system-record) in the chosen format, or says when the format carries no metadata. Cycle it to `off` to leave the record out.
- **C2PA** adds a [Content Credential](/info/exporting.html) and sets its certificate lifetime.
- **Imprint** adds the pixel watermark; it reads `no pixels to mark` on a vector or data format.
- **Durable** adds the opt-in neural credential on the raster formats.
- **Password** locks a rendered PDF or zip.

**C2PA** and **Imprint** start on, as they do in the app and the CLI, and the same tool declarations turn them off: a tool that sets `render.c2pa:false`, and any on-device privacy utility, opens with both off and keeps them off. All three surfaces read one policy in the engine. **Durable** starts off, because it is a neural encode and a model download. Turn both C2PA and Imprint off for byte-reproducible output; [what provenance costs](/info/cli-automation.html#what-provenance-costs) has the measured cost of leaving them on, which applies here because the terminal exports through the same engine path.

### What it can render

The TUI picks one of two tiers per format, and shares the CLI's renderer selection, so [What the CLI can render](/info/cli-rendering.html#what-the-cli-can-render) is the full list:

- **No browser needed:** SVG and the other vector formats, the data formats, a Design document's Lottie, IDML and Premiere XML exports, and a PNG or JPEG XL from a tool that draws in SVG, which the TUI rasterises with resvg, Imprint included. A PNG that asks for the Durable mark, bleed or printer's marks still goes to the browser tier.
- **The browser tier**, on demand: the other raster formats, PDF, video, live-URL capture and TXT, which is the rendered page serialised to plain text, so the page has to be laid out first. A scoped headless Chromium drives a built copy of the web app, so the bytes match a download from the app. The browser launches only when you first export one of these formats. When a Lolly desktop app is running or installed, the TUI renders through the app instead and needs no Chromium.

Set the browser tier up once:

```bash
pnpm run install:browser   # downloads Chromium into .browsers at the repo root
                          # (an existing services/mcp/.browsers install, or PLAYWRIGHT_BROWSERS_PATH, is reused instead;
                          #  LOLLY_BROWSER_CHANNEL=chrome uses an installed Chrome and downloads nothing)
pnpm run build:web         # a built web shell for full-fidelity raster/pdf/video
```

Without Chromium or the built shell, those formats fail with a one-line message that gives the command to run, and the TUI falls back to writing HTML, so every tool still exports something. SVG and the data formats never need either.

::: details URL Screenshot (`url-shot`) in the terminal
`url-shot` captures a live web page on the browser tier. It drives Chromium straight at the URL:

- **Formats:** **PNG / JPG** (a real screenshot), **PDF** (a true vector print, with selectable text and crisp at any zoom) and **SVG** (the high-DPI shot in a scalable container).
- **Crop:** trim in from each edge (top, right, bottom, left) as a 0–0.9 fraction.
- **Recolour:** recolour the whole page before capture: invert, grayscale, sepia, a hue shift or a **tint** in a colour of your choice.
- The scroll-depth, settle-delay and custom-CSS controls.

The crop and recolour controls are ordinary tool inputs, so you edit them from the keyboard like any other. The desktop app's capture also crops and recolours, and its vector capture produces a true vector SVG.
:::

## Batch

There is no `#/batch` grid in the terminal. Instead, three sources make one zip on your Desktop, optionally password-locked:

- a **Projects folder** and everything under it (`e`);
- a **ticked selection** of saved sessions across folders (`Space` to tick, `b` to run);
- a **CSV or TSV file** (`c`), in the same row format the CLI's `batch` subcommand reads: a `toolId` column, optional per-row `format`, `width`, `height`, `unit` and `dpi`, plus a column per input.

A batch shows no **Design system** row, so its files carry no [design-system record](/info/exporting.html#the-design-system-record), and neither does the Profile view's render-everything zip. Export one file from the tool view to record the design system with the file.

The Profile view's **back up and render everything** (`b`) writes two zips with a live progress panel: a portable data backup, and every saved project rendered out. Both land on your Desktop, or in your home directory if there is no Desktop folder.

## Where your work is saved

Unlike the CLI, which saves no sessions, the TUI keeps saved sessions, project folders and your profile on disk. It uses the same directory as the desktop app and the CLI, chosen in this order:

1. `$LOLLY_STATE_DIR`, when you set one.
2. `$LOLLY_TUI_DIR`, the old name for the same thing. It still works, and prints a one-line note pointing you to `LOLLY_STATE_DIR`.
3. The desktop app's own data directory, when the app is installed: `~/Library/Application Support/tools.lolly.Desktop` on macOS, `$XDG_DATA_HOME/tools.lolly.Desktop` (or `~/.local/share/...`) on Linux and `%APPDATA%\tools.lolly.Desktop` on Windows.
4. `~/.lolly`.

Saved projects live in `saved-state/<slot>.json`, in the record the desktop app writes, so a project you saved in the app is in the terminal's Projects list, and a project you save here opens in the app. Each record keeps both halves of its state: the tool's serialised URL state, which reopens through the same parser the web app and the CLI use, and the resolved input values, which is what a session saved in the app carries.

Projects the TUI saved before this layout sat in `sessions/<slot>.json`. They are copied into the shared layout the first time you open Projects, with their names and dates intact. The old files stay where they were, and a marker beside the new ones stops the copy running twice.

Project folders and your profile stay in terminal-only files beside them, `folders.json` and `profile.json`. The app keeps both in its browser database, so there is nothing on disk to share yet.

## TUI or CLI?

The TUI is the CLI's host under an interactive transport. It reuses the CLI's implementation as is: the same headless DOM (jsdom), the same filesystem asset access and the same export path. The one difference is that the TUI owns the screen, so log output goes to an in-app buffer instead of stdout.

|  | [CLI](/info/cli.html) | TUI |
|---|---|---|
| Shape | One-shot command | Interactive full-screen app |
| Best for | Scripts, CI, pipelines, batch fan-out | Exploring tools, hand-tuning inputs, quick one-offs |
| Input | `--flag=value` arguments | Keyboard, in place |
| Engine and output | Same engine, same bytes | Same engine, same bytes |
| State | No saved sessions; design systems on disk, shared with the TUI | Sessions, folders, profile and design systems on disk (see [Where your work is saved](#where-your-work-is-saved)) |

If you can express a job as a URL, prefer the CLI: it is reproducible and pipeable. Reach for the TUI when you want to see and adjust a tool the way you would in the web app, from a terminal.

## Related

- [CLI](/info/cli.html): the one-shot, scriptable counterpart. Same engine, same output.
- [URL Mode](/info/url-mode.html): the parameter model both terminal shells share with the web app.
- [Exporting & Formats](/info/exporting.html): what each format is for and which shells produce each one.
- [Lolly architecture](/info/overview.html): how the shells sit on top of one shared engine.
