# TUI

The **TUI** (text user interface) is Lolly's interactive **terminal shell** - the whole app driven by the keyboard, inside your terminal. Where the [CLI](/info/cli.html) is a one-shot command for scripts and pipelines, the TUI is a full-screen, keyboard-first surface for **browsing tools, filling in inputs, saving projects, editing your profile and exporting** - without leaving the terminal or opening a browser.

It runs the **same engine and the same render path** as the web shell and the CLI, so its output can never drift from the GUI.

```bash
lolly tui        # from the installed CLI (npm i -g @lolly-tools/cli)
pnpm run tui      # from a checkout
```

`lolly tui` and `lolly-tui` start the same thing: the CLI hands the terminal straight to it, so one install gives you both doors. See [Install](/info/cli.html#install) for the three ways to get the command.

It takes over the whole screen (like `vim` or `htop`) and restores your terminal on exit. It needs a real interactive terminal (a TTY); with output piped it says so and stops.

## How it relates to the CLI

The TUI is the **CLI bridge under an interactive transport**. Its host bridge reuses the CLI's implementation verbatim - same headless DOM (jsdom), same filesystem asset access, same export path. The one difference is that the TUI owns the screen, so log output goes to an in-app buffer instead of stdout.

|  | [CLI](/info/cli.html) | TUI |
|---|---|---|
| Shape | One-shot command | Interactive full-screen app |
| Best for | Scripts, CI, pipelines, batch fan-out | Exploring tools, hand-tuning inputs, quick one-offs |
| Input | `--flag=value` argv | Keyboard, in place |
| Engine / output | Same engine, same bytes | Same engine, same bytes |
| State | In-memory, ephemeral per run | Persisted on disk (`~/.lolly`) |

If you can express a job as a URL, prefer the CLI - it's reproducible and pipeable. Reach for the TUI when you want to **see and adjust** a tool the way you would in the web shell, but from a terminal.

### Provenance defaults

The **C2PA** and **Imprint** rows both open ON, the same default as the app and the CLI, and the same tool declarations opt them out: a tool that sets `render.c2pa:false`, and any on-device privacy utility, opens with both rows off and keeps them off. All three surfaces read one policy in the engine, so they cannot drift apart. The Imprint row reads `no pixels to mark` on a vector or data format, since there are no pixels to carry it. **Durable** stays off, since it is a neural encode and a model download.

Cycle either row to `off` for a barer render, or set both off for byte-reproducible output. The [CLI page](/info/cli.html#what-provenance-costs) has the measured cost of that choice, and it applies here too, because the terminal exports through the same engine path: the credential is about 2 KB and no measurable time, while the Imprint on a raster costs time that scales with pixel count and grows the file, because the mark adds detail that lossless compression cannot squeeze away. A PNG carries its Imprint browser-free, so turning it on does not pull the export into the browser tier. What you get for leaving them on is a file that can prove where it came from, plus a mark that survives a re-encode or a screenshot, which a metadata credential alone does not.

## Views

The TUI mirrors the web shell's layout, distilled to the terminal. Switch top-level views with the number keys; every view is keyboard-navigable (`hjkl` / arrows, `Enter` to open, `Esc` to go back).

- **Gallery** - a responsive card grid of every tool. `/` searches, `Enter` opens a tool, `u` opens a pasted `lolly.tools` link already configured, `i` **imports a PDF or `.ai`** from disk (it becomes a saved, fully editable Design session - IDML and Penpot stay web-only), `f`/`F` favourite and filter to favourites, `o` cycles sort and `c` cycles the category filter. Only tools needing a live device the headless browser can't open (mic/camera recording) are hidden.
- **Projects** - your saved sessions, organised into nested folders. Create folders (`n`), move sessions into them (`m`), open, delete and **batch** them: export a whole folder (`e`), tick an ad-hoc set with `Space` and batch the selection (`b`) or run a **CSV batch** (`c`) - all into one `.zip` on the Desktop.
- **Catalog** - browse every catalog asset; favourite (`f`), hide (`d`) and **export an asset** (`e`) to any format (opens the `asset-export` tool seeded with it - that tool ships with the SUSE brand pack, so the action needs a profile that mounts it).
- **Profile** - edit the details tools pre-fill from (`bindToProfile`): name, email, phone, company and the "credit me" preference. Changes persist. Two actions live here too: `b` **backs up and renders everything** - a portable data-backup zip plus a second zip of every saved project rendered out, with a live progress panel - and `v` runs an on-device **Content Credentials report** on a file. Both zips land in your Desktop folder, or your home directory if there isn't one.
- **Tool view** - a two-pane (desktop) / stacked (mobile) layout: an **Inputs** panel beside an **Export** settings panel and a preview. `Tab` switches panels; `j`/`k` move between inputs; `Enter`/`e` edits; `Space` toggles booleans; `←`/`→` cycle selects (and step number sliders). `x` **exports**, `s` saves the session, `y` prints/copies a share link and `u`/`r` undo and redo. Every input type is editable, including repeating **blocks** (drill in to add/reorder/nest rows) and **`asset`** inputs (a catalog picker on `Enter`, or type an id / `lolly.tools` URL with `e`). Export settings expose **Format · Width · Height · Unit · DPI · Filename · Folder · C2PA · Imprint · Durable · Password** with a derived output path - so the terminal carries the same provenance and lock controls as the web export panel: cycle **C2PA** for a [Content Credential](/info/exporting.html) and its certificate lifetime, **Imprint** for the pixel watermark (on by default, off per export), **Durable** for the opt-in neural credential on the raster formats and set a **Password** to lock a rendered PDF or zip.

### Batch (the "TUI way", no `/pro` grid)

Three sources, one zip: a **Projects folder** subtree (`e`), a **ticked multiselection** of saved sessions across folders (`Space` to tick, `b` to run) or a **CSV/TSV file** (`c`) - the same row format the CLI `batch` subcommand reads (a `toolId` column, optional per-row `format`/`width`/`height`/`unit`/`dpi` and a column per input). The result is one `.zip` on your Desktop, optionally password-locked.

### Preview priority

For a **designer tool** the preview is low-priority and opt-in (`p`). For a **utility** - where the output *is* the whole point - it's the primary pane, shown automatically (even on a narrow terminal):

- a **text-based / interactive** utility (`color-palette`, `text-helper`, …) has its rendered **HTML content displayed as terminal text** - the TUI walks the hydrated DOM into structured, coloured lines (headings, tabs/buttons and colour swatches shown as blocks *in their actual colour*, resolved from the tool's own CSS). The content is the point, so it's shown, not an "export me" placeholder.
- a **file-transform** (`strip-data`, `compress-pdf`) shows a **result summary** with the before→after size delta.
- **`url-shot`** shows the **capture settings** (URL, size, crop, recolor).

No wasted space on a form that barely exists.

The layout is responsive: narrow terminals collapse the two-pane tool view into a single stacked column, the same way the web shell reflows on mobile.

## Inputs it can edit

Every input type the engine models is editable from the keyboard - text, numbers, booleans, selects and repeating **`blocks`** (drill into a block → its rows → its fields; add, delete, reorder and nest). It also edits **`file`** inputs (give it a path - the bytes are read locally and handed to on-device utilities like `strip-data`) and **`asset`** inputs (a catalog id like `suse/logo/hor-pos-green`, or a pasted `lolly.tools` tool link, resolved to an embedded render).

## Inline preview

Preview is **opt-in** (`p`) and secondary - seeing inputs, files, projects and export settings matters more than pixels in a terminal. When enabled, the TUI rasterises the tool's SVG and renders it as a truecolor half-block image directly in the terminal cells (no external image protocol required).

## What it can render

Two tiers, picked automatically per format:

- **DOM-free (always available):** **SVG (and SVGZ), EMF, WMF, EPS (and EPS-CMYK), DXF, BMP, HTML, plus the data formats** (JSON, CSV, ICS, VCF, MD) render through the same headless engine path as the CLI - instant, no browser.
- **Browser tier (opt-in, on demand):** everything that needs a real layout/paint engine - **raster (PNG/JPG), PDF, video**, **live-URL capture** and **TXT** - is produced by a scoped headless **Chromium**. TXT belongs here because it is the *rendered* page serialised to plain text, so something has to lay the page out first. For an ordinary tool the TUI drives a built copy of the web shell so the bytes are *identical* to a web/desktop Download; there is no second render path to drift. The browser launches only when you first export one of these formats, never at startup. The TUI shares the CLI's renderer selection, so when a Lolly desktop app is running or installed here it renders through the app instead and needs no Chromium at all - see [What the CLI can render](/info/cli.html#what-the-cli-can-render) for the three rungs and `LOLLY_RENDERER`.

Set the browser tier up once:

```bash
pnpm run install:browser   # downloads Chromium into .browsers at the repo root
                          # (an existing services/mcp/.browsers install, or PLAYWRIGHT_BROWSERS_PATH, is reused instead;
                          #  LOLLY_BROWSER_CHANNEL=chrome uses an installed Chrome and downloads nothing)
pnpm run build:web         # a built web shell for full-fidelity raster/pdf/video
```

If Chromium (or the built shell) isn't present, those formats fail with a one-line "run `pnpm run install:browser` / `pnpm run build:web`" message, and the TUI falls back to writing HTML so every tool still exports *something*. SVG and data formats never need either.

Exports are written to your desktop (`~/Desktop`) by default, with the folder editable per export.

## URL Screenshot (`url-shot`)

`url-shot` - capture any live web page - runs fully in the TUI on the browser tier. It drives Chromium straight at the URL, so you get more than a plain shot:

- **Formats:** **PNG / JPG** (a real screenshot), **PDF** (a true *vector* print - selectable text, crisp at any zoom) and **SVG** (the high-DPI shot in a scalable container).
- **Crop:** trim in from each edge (top / right / bottom / left) as a 0–0.9 fraction.
- **Recolor:** recolour the whole page before capture - invert, grayscale, sepia, a hue shift or a **tint** that washes it in a colour of your choice.
- Plus the existing scroll-depth, settle delay and custom-CSS controls.

The crop and recolor controls are ordinary tool inputs, so they're editable from the keyboard like any other. (Recolor also applies in the web/desktop shells; crop and vector PDF/SVG are the terminal capture's own.)

## Persistence

Unlike the ephemeral CLI, the TUI keeps state on disk: saved sessions, project folders and your profile. It uses the same directory the desktop app and the CLI use, picked in this order:

1. `$LOLLY_STATE_DIR`, when you name one.
2. `$LOLLY_TUI_DIR`, the old name for the same thing. It still works and prints a one-line note saying which name replaced it.
3. The desktop app's own data directory, when the app is installed here: `~/Library/Application Support/tools.lolly.Desktop` on macOS, `$XDG_DATA_HOME/tools.lolly.Desktop` (or `~/.local/share/...`) on Linux, `%APPDATA%\tools.lolly.Desktop` on Windows.
4. `~/.lolly`.

Saved projects live in `saved-state/<slot>.json`, in the record the desktop app writes. So a project you saved in the app is in the terminal's Projects list, and a project you save here opens in the app. Each record keeps both halves of its state: the tool's serialised URL-state, which reopens through the same parser the web shell and CLI use, and the resolved input values, which is what a session saved in the app carries.

Projects the TUI saved before this move sat in `sessions/<slot>.json`. They are copied into the shared layout the first time you open Projects, with their names and dates intact. The old files are left where they were, and a marker beside the new ones stops the copy running twice.

Project folders and your profile stay terminal-only files beside them, `folders.json` and `profile.json`. The app keeps both of those in its browser database, so there is nothing on disk to share yet.

## Related

- [CLI](/info/cli.html) - the one-shot, scriptable counterpart. Same engine, same output.
- [URL Mode](/info/url-mode.html) - the parameter model both terminal shells share with the web shell.
- [Exporting & Formats](/info/exporting.html) - what each format is for and which shells produce it.
- [Overview](/info/overview.html) - how the shells sit on top of one shared engine.
