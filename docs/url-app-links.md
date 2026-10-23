# App links and deep links

Tool links open a tool. The rest of the app answers to links too: a shelf of Assets, a Projects folder, a room of Design System Setup or one card in Settings. Use these links in a launcher, a bookmark, a bug report or an automation that has to find the app in a known state with no clicking. Every screenshot in these docs is a Lolly link handed to `url-shot`.

## The `lolly://` scheme

The installed apps register `lolly://` as their own URL scheme, so anything that can open a URL can open Lolly at an exact place. That includes a launcher's "open URL" action (Raycast, Alfred, PowerToys Run), a macOS Shortcut, a `.desktop` Action, a GNOME Shell or KRunner result, a link in a note, a QR code on a slide and a terminal.

::: cols
## On the web

```
https://lolly.tools/t/qr-code?url=https%3A%2F%2Fexample.com&full
```

Opens in a browser, for anyone.

## In the installed app

```
lolly://t/qr-code?url=https%3A%2F%2Fexample.com&full
```

Launches Lolly, opens QR Code with its `url` filled in and hides the sidebar.
:::

The grammar is the web address with the site taken for granted: `lolly://<route>` is `https://lolly.tools/<route>`. There is no second vocabulary behind the scheme. The query holds the same tool inputs and reserved words as the web form, presence flags such as `full` need no `=1`, and `z=` and `zx=` are the same packed and encrypted state. Readable flags after them still win in the usual way.

```bash
open      "lolly://t/qr-code?url=https://example.com"     # macOS
xdg-open  "lolly://t/qr-code?url=https://example.com"     # Linux
start     "lolly://t/qr-code?url=https://example.com"     # Windows
```

Every tool form works: `lolly://t/<id>?…`, `lolly://tool/<id>?…`, a bare `lolly://<id>?…` and the embed form `lolly://tool/<id>.svg?…`, whose extension becomes `format=`. So does any app route, such as `lolly://lab`, `lolly://verify?asset=lolly/logo/primary` or `lolly://docs/build/authoring-tools`. A copied web link with `https://` swapped for `lolly://` keeps working, because the `lolly.tools` host part is dropped rather than read as a tool id.

**The Share dialog writes this form for you.** Open **Link options** and turn on **Open in the installed app**. The field and its **Copy** and **QR** actions switch to `lolly://`, keeping the same state, password or packing and behaviour flags. Turn the option off and the field returns to the web link. The web link stays the safe default for a recipient who may not have Lolly, and the app link is a choice you make for shortcuts and automation.

A link for a route the app does not own is refused, not guessed at. The operating system hands the app an untrusted string, so the app opens only a tool id that parses or a word from its fixed list of routes. A `lolly://` link also works anywhere the app already accepts a Lolly link: the asset picker, the pasted-link paths and the CLI's `lolly <link>` form.

::: details Where the scheme is registered
The macOS and Windows installers and the Linux `.desktop` entries declare the scheme, as do the Android and iOS apps. A `tauri dev` build registers itself on Windows and Linux at launch; on macOS only the installed `.app` can receive the scheme. Spotlight opens web addresses, not custom schemes, so on a Mac reach the scheme through `open`, a Shortcut or a launcher.

The MCP server's resource URIs (`lolly://catalog`, `lolly://tool/{id}`) share the prefix but are a different namespace: resources an agent reads, not routes the app opens.
:::

## What a link carries

The address bar and **Share** make two different links.

- **The address bar** is a bookmark of your workspace. The web app writes your inputs, result settings and supported view state to it as you work: filters, panels and the editor selection included.
- **Share** builds a content link: the tool's inputs, the document's choices and the result settings. It leaves out your filters, editor selection, viewport, open panels and local session pointer. Link options can add a behaviour for the recipient, such as downloading on arrival.

Either way, an explicit off value or a cleared field reopens as you left it, and long text is kept rather than cut short.

::: cols
## Travels in a shared link

- Every input value you set, unless it is personal
- Token references, which redraw in the recipient's design system
- Theme and colourway choices (`_themes`), emoji set and licence
- Result settings and the link options you tick

## Stays on your device

- Personal values you did not choose to include
- Images you uploaded (`user/…` ids) and files held in memory
- Saved-session names (`slot`), which reopen only where the session exists
- Your design system choice (`ds`, `designv`), drafts in Settings forms, file-picker selections and live camera or microphone streams
:::

**Personal values need your say.** A generated link leaves out inputs bound to your profile and inputs a tool declares with `sharePrivacy: "personal"`, such as recorded speech and caption text. The Share dialog shows those values on your device and asks you to include each one separately. The address bar leaves them out as well. A shortened link still holds its values in readable form once unpacked; password protection is a separate choice.

These rules change only what a generated link holds. A link that sets a personal input explicitly still loads it, the CLI still accepts every input, and your own saved sessions keep the original values.

**When the bytes must travel, send a file.** Share reports the local dependencies a link leaves out. A `.lolly` file carries the saved design to another device, with the files Lolly can include, such as your uploaded images. It carries the design separately from the generated link, so review the file before you send it on.

## Three rules for every app link

1. **The address is live.** A view reads its parameters when it opens and writes them as they change. Input edits and filters replace the current history entry; moving between views adds a Back stop. Pasting another query for the same view applies that query too.
2. **A link does not change your preferences.** A link's sort order, view mode, open cards or appearance applies to that visit only. Opening the link does not save the choice; changing a control yourself still can.
3. **Unknown values are ignored.** A parameter that points at nothing, such as a retired category or a mistyped section, is dropped and the view opens as usual. Links do not break; they stop steering.

## App views

### App-wide

| Param | Description |
|---|---|
| `lang` | Interface language for this session, on any route (`#/a?lang=ja`, `#/settings?lang=ar`). The same values and the same "this session only" rule as the [tool-route `lang`](/info/url-parameters.html#design-system-language-and-emoji). |
| `theme` | `light`, `dark` or `brand` for this page load only, never saved to the profile or the browser, so a link cannot permanently change someone's theme. App views only: on a tool link (`/t/<id>`, `#/tool/<id>`, `/design`) it is left alone, because several tools have a `theme` input of their own. |
| `_appearance` | The app's appearance, tool routes included. Takes the same values as `theme` and wins over `theme`. Written by the appearance control and left out of a content Share link. |
| `_open=<id>,<id>` | Open disclosure cards in Settings, Components and Design System Setup. An empty `_open=` closes every addressable card. |

### Gallery (`#/`, and `#/u` for utilities)

| Param | Description |
|---|---|
| `q` | Fills in the search field. |
| `cat` | The category pill to open on: `all`, `favourites` or a category key the pills show on that install. Feature flags and the Utilities view already narrow that set. |
| `sort` | `recent`, `az`, `za`, `format` or `category`, for this visit only. |
| `dir` | `asc` or `desc`. |
| `tool=<id>` | Opens that tool card's info dialog over the gallery. |
| `history` \| `history=<id>` | Opens a tool's saved-sessions dialog instead of the info dialog. |
| `welcome` | Presence flag: opens the first-run welcome dialog even if it was dismissed, so it can be captured. Ignored on branded and brand-locked installs, which already have a design system. |

### Assets (`#/a`)

The server paths `/a` and `/assets` open the same view. The earlier addresses, `#/c`, `#/catalog` and `/c`, still forward here with their query, so an old `#/c?asset=<id>` link still opens that asset.

| Param | Description |
|---|---|
| `asset=<id>` | Scrolls to and highlights that asset. |
| `section=<key>[,<key>…]` | Opens with those sections expanded and scrolls the first into view. An empty `section=` closes every section. |
| `q` | Fills in the search field. |
| `type` | Filetype filter: `all`, `image`, `vector`, `motion`, `audio` or `text`. Falls back to `all` when that group is empty on this install. |
| `hidden` | Presence flag: shows hidden assets. |
| `sort`, `rev` | Sort key and direction (`rev=1` reverses, `rev=0` keeps the usual direction). |
| `view`, `favourites` | The preview strip mode and whether the favourites strip is open. |

Search, type, sorting, asset focus and sections keep one another in the address.

### Projects (`#/p`, `#/p/<folderId>`)

| Param | Description |
|---|---|
| `q` | Shows results for that search. |
| `tools` | Narrows to sessions of those tools. |
| `view` | `preview` (tile grid) or `list`. |
| `sort` | `modified`, `added`, `name`, `tool` or `size`. |
| `rev` | Reverses the sort; `rev=0` keeps the usual direction. |

`view`, `sort` and `rev` override both the device-wide and the per-folder saved preference on arrival. Changing the controls updates the address.

### Batch and Multi-edit

`#/batch?s=<slot>,<slot>` opens those saved sessions as rows in the grid, which is what **Edit as sheet** builds. `#/pro` was the route's name before 2026-08-20 and still redirects here with its query, as does the `/pro` path.

`#/multi?s=<slot>,<slot>` opens those sessions side by side, and `_active=<slot>` records the active cell. These session ids resolve through this device's storage.

### Design System Setup (`#/start`)

| Param | Description |
|---|---|
| `area` | Which room: `overview`, `color`, `type`, `logos`, `tokens`, `catalogue` (labelled **Files**), `usage` (**Usage & rules**) or `versions`. |
| `focus` | A wing of the colour room: `generate`, `curves`, `contrast`, `print` or `chart`. Three more open a first decision: `pick` (the Colours room's colour picker), `stage` (the Type room's face stage) and `looks` (**Find a look**, ready-made colours and type). |
| `seed=<hex>` | Sets the Generate wing's primary colour before it opens. |
| `wheel` | Presence flag: opens the OKLCH colour chart, the same as `focus=chart`. |
| `import` | Presence flag: opens the source picker on arrival (`import=0` keeps it shut). |
| `source` | Which source the picker opens on: `file`, `image`, `font`, `pdf`, `page` or `url`. Naming one opens the picker. Nothing is fetched or read on your behalf. |

Room, wing and source-picker changes update the address. `seed` and `wheel` act once, on arrival. Opening a source link never restores an unsaved file selection or starts a read.

### Settings (`#/settings`)

`#/settings?tab=<tab>` opens one tab: `device` (This device), `brand` (Design system), `caps` (Capabilities) or `activity` (Activity & stats). With no tab, Settings opens on Preferences. `#/b` and `#/brand` are shortlinks to the Design system tab. The older `#/d` route reads `tab` and the section ids below, and the older `#/profile` route reads `focus`.

- **A tab section.** `#/settings?<section-id>` scrolls to and opens one section, as in `#/settings?dash-storage`, `#/settings?dash-colourways` or `#/settings?cap-formats`. The section ids are the `DASH_SECTIONS` rows in `shells/web/src/lib/dashboard-registry.ts`.
- **A Preferences card.** `#/settings?focus=<section>` opens Preferences and scrolls to one card: `details-section`, `identity-section`, `design-systems-section`, `appearance-section`, `emoji-pref-section`, `a11y-section`, `connections-section`, `trusted-sites-section`, `renders-section`, `storage-section`, `offline-section`, `hotfolder-section` (installed apps only), `activity-section`, `feature-flags-section` or `instance-section`. `sync-section` still works and opens `connections-section`, where Sync across devices now sits.

Settings navigation writes `focus`, card toggles write `_open` and the settings search writes `q`. Moving between tabs adds browser history entries.

### The remaining views

::: details Routes and their parameters
| Route | Params |
|---|---|
| `#/verify` | `src=<path>` checks a file served by this site: an absolute same-origin path, and anything else is refused, because the page fetches nothing on your behalf. `check=1` with `src` also resolves the credential reference the page shows, without the second **Fetch and check** click. |
| `#/open` | `lolly=<path>` opens a `.lolly` served by this site (an absolute same-origin path starting with a single `/`) or a `blob:` URL the same page made. `data:`, `javascript:`, `//host` and every other origin are refused before anything is fetched. The address becomes a bare `#/open` before the fetch, so a reload never imports the file twice. A plain saved design opens straight into the editor; a file that carries a tool, a design system, templates, a renovation or a project still asks first, as a drop does, and nothing in the link grants trust. The route is for automation (`lolly run <file.lolly> --export=…` uses it) and is not a `lolly://` route. |
| `#/docs/<slug>` | Renders in the app's current language; `#/docs/<lang>/<slug>` or `?lang=` picks one. `?h=<heading>` jumps to a heading. |
| `#/ask` | `?q=<question>` fills in the question box. |
| `#/lab` | `?c=<any CSS colour>` opens the Colour Lab on that colour. |
| `#/components` | `q`, `mode` and `section` restore its search, mode filter and section focus. |
| `#/history` | Filter keys keep their current values; `_detail=<slot>` opens the versions sheet for that local session. |
| `#/learning` | `slot` opens a local learning module; `_lesson` and `_blocks` restore the selected lesson and blocks. |
:::

### On a tool route

Most of the flags that live on a tool link are in [Reserved URL parameters](/info/url-parameters.html#what-happens-on-open): `options`, `full`, `template=<id>`, `slot=` and `present` with `s=` and `kiosk`. A bare `?template=` opens the template chooser itself, which is what the gallery's **+New** chip links to. The one exception is `share`, a presence flag read by the tool view rather than the engine: it opens the Share dialog on load, so a click-only control has an address.

Canvas editors keep EDITOR state in `_sel=<id>,<id>`, `_t=<seconds>`, `_panel=choreograph` or `_ui=`. The first three select boxes, seek the timeline and open Choreograph. The object form is base64url UTF-8 JSON, for example `{ "v": 1, "sel": ["a", "b"], "t": 2.5, "page": "page-1", "timeline": true }`. Fields are optional; unknown keys are ignored and shorthands win on conflict. Selection, page, playhead and timeline visibility update the address through `_ui`; an empty selection and `timeline:false` are explicit state. `window.lolly.ui.getState()` and `apply(state)` use the same object, as does a trusted embedding page's `postMessage({ type: 'lolly:ui', state })`.

The shell also writes three more workspace keys: `_view` for the stage viewport, `_dialog=share` while the Share dialog is open and `_nav` with `_inspector` for Design's columns. These workspace keys stay outside packed content, so a delayed pack cannot overwrite newer view state, and they never enter a content Share link. `share` remains an arrival alias for opening that dialog. The engine reserves the `_` namespace, so tool inputs cannot collide with these keys.
