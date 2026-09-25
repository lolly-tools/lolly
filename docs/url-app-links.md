# App links and deep links

Open app views and use the lolly URL scheme.

Part of [URL Mode](/info/url-mode.html).

## App links

[Tool URLs](/info/url-mode.html) address an individual tool. The rest of the app is addressable the same way: the browse views, the studio, the dashboard and the settings pages each read a few params off their own route, so a link can land someone on a particular shelf of the catalogue or a particular settings card rather than on the front door.

Two audiences use this, and they want the same thing for different reasons:

- **Sharing.** "Here, look at *this*" - a link that opens where you were looking, so the person on the other end doesn't have to be talked through four clicks.
- **Automation.** A screenshot run, an agent driving the app, a docs recipe. Every `/info` screenshot in these docs is one of these links handed to `url-shot`; the app has to arrive in a known state, deterministically, with no clicking.

Three rules hold everywhere below, and they are what make the links safe to paste:

1. **Consumed on arrival.** These params are read once, when the view mounts. They are never written back into a link the app generates for you, so a state you deep-linked into doesn't get re-shared by accident.
2. **Never persisted.** A param that overrides a saved preference - sort order, view mode, theme - does so *for that page load only*. Opening someone's link never rewrites your own settings.
3. **Unknown values are ignored.** A param naming something that doesn't exist (a retired category, a typo'd section) is dropped and the view opens normally. Links don't break; they just stop steering.

### The `lolly://` scheme

The installed apps register `lolly://` as their own URL scheme, so anything that can open a URL can open Lolly at an exact place: a launcher's "open URL" action (Raycast, Alfred, PowerToys Run), a macOS Shortcut, a `.desktop` Action, a GNOME Shell or KRunner result, a link in a note or a QR code on a slide, or a terminal:

```bash
open      "lolly://t/qr-code?url=https://suse.com"     # macOS
xdg-open  "lolly://t/qr-code?url=https://suse.com"     # Linux
start     "lolly://t/qr-code?url=https://suse.com"     # Windows
```

The grammar is the web address with the site name taken for granted: `lolly://<route>` is `https://lolly.tools/<route>`. Every tool form works (`lolly://t/<id>?…`, `lolly://tool/<id>?…`, a bare `lolly://<id>?…`, and the embed form `lolly://tool/<id>.svg?…`, whose extension becomes `format=`), with the same inputs, reserved parameters and packed `z=` links as the https form. Any app route works too (`lolly://lab`, `lolly://verify?asset=lolly/logo/primary`, `lolly://docs/build/authoring-tools`). A copied https link with `https://` swapped for `lolly://` keeps working - the `lolly.tools` host segment is dropped rather than read as a tool id.

The Share dialog can write this form for you: open **Link options** and turn on **Open in the installed app**. The field and its **Copy** and **QR** actions switch to `lolly://` while keeping the exact same state, password/packing token and behaviour flags. Turn it off and the field returns to the ordinary web link. That makes the web URL the safe default for a recipient who may not have Lolly, and the app URI an explicit choice for shortcuts and automation.

Read an app URI in three pieces; there is no second parameter vocabulary hiding behind the scheme:

| Piece | Example | Meaning |
|---|---|---|
| Scheme | `lolly://` | Ask the operating system to launch the installed Lolly app. |
| Route | `t/qr-code` | Open a tool (`t/<id>`), or another documented app route such as `lab`, `profile` or `verify`. |
| Query | `?url=https%3A%2F%2Fsuse.com&full` | The tool inputs and reserved controls from the tables on this page. Values use normal URL encoding; a presence flag such as `full` needs no `=1`. |

So `lolly://t/qr-code?url=https%3A%2F%2Fsuse.com&full` launches Lolly, opens QR Code with its `url` input filled, and uses the reserved `full` behaviour. `z=` and `zx=` are just compact or encrypted versions of the same query state; every readable flag that follows them still wins in the usual way.

A link for a route the app does not own is refused, not guessed at: the OS hands the app an untrusted string, so the mapper only ever opens a tool id that parses or a word from the app's frozen route vocabulary. Pasting a `lolly://` link anywhere the app already accepts a Lolly link (the asset picker, the pasted-link paths, the CLI's `Lolly <link>` form) works the same way.

Where it is registered: the macOS and Windows installers and the Linux `.desktop` entries all declare the scheme, as do the Android and iOS apps. A `tauri dev` build registers itself on Windows and Linux at launch; on macOS only the installed `.app` can receive the scheme. Spotlight itself opens web addresses, not custom schemes - on a Mac, reach the scheme through `open`, a Shortcut or a launcher. The MCP server's resource URIs (`lolly://catalog`, `lolly://tool/{id}`) share the prefix but are a different namespace: resources an agent reads, not routes the app opens.

### App-wide

| Param | Description |
|---|---|
| `lang` | UI language for this session, on any route (`#/c?lang=ja`, `/#/profile?lang=ar`). Same value set as the [tool-route `lang`](/info/url-parameters.html); same "session only, saved preference untouched" rule. |
| `theme` | `light`, `dark` or `brand` - pins the app's look for this page load. Deliberately **not** saved to the profile or to `localStorage`: a link you paste must not permanently flip someone's theme. Mostly for screenshots and for "here's how it looks in dark" links. **App views only** - on a tool link (`/t/<id>`, `#/tool/<id>`, `/design`) it is left alone, because `theme` is a declared input in a dozen tools where it already means "draw the artwork dark". |

### Gallery (`#/`, and `#/u` for utilities)

| Param | Description |
|---|---|
| `q` | Seeds the search field. |
| `cat` | Category pill to open on - `all`, `favourites`, or a category key the pills actually show on that install (feature flags and the Utilities view already narrow that set). |
| `sort` | `recent`, `az`, `za`, `format` or `category`. Overrides the saved sort for this visit only. |
| `dir` | `asc` or `desc`. |
| `tool=<id>` | Opens that tool card's info dialog on top of the gallery. |
| `history` \| `history=<id>` | Opens a tool's saved-sessions dialog instead of the info one. |
| `welcome` | Presence flag - forces the first-run welcome dialog open even if it has been dismissed, so it can be captured deterministically. Ignored on branded and brand-locked installs: a link can't nag someone who already has a design system. |

### Catalogue (`#/c`)

| Param | Description |
|---|---|
| `asset=<id>` | Scrolls to and highlights that asset. |
| `section=<key>[,<key>…]` | Opens with those sections expanded (over the collapsed default) and scrolls the first into view. |
| `q` | Seeds the search field. |
| `type` | Filetype filter: `all`, `image`, `vector`, `motion`, `audio`, `text`. Falls back to `all` if that bucket is empty on this install. |
| `hidden` | Presence flag - opens with hidden assets revealed. |

### Projects (`#/p`, `#/p/<folderId>`)

| Param | Description |
|---|---|
| `q` | Enters the explicit results mode with that search. |
| `tools` | Narrows to sessions belonging to those tools. |
| `view` | `preview` (tile grid) or `list`. |
| `sort` | `modified`, `added`, `name`, `tool` or `size`. |
| `rev` | Presence flag - reverses whichever sort is active. |

`view`, `sort` and `rev` override both the device-wide and the per-folder saved preference for that visit, and neither is rewritten.

### Batch (`#/batch`)

`#/batch?s=<slot>,<slot>` opens those saved sessions as rows in the grid - what **Edit as sheet** builds. `#/pro` was the route's name before 2026-08-20 and still redirects here with its query intact, as does the `/pro` path form.

### Multi-edit (`#/multi`)

`#/multi?s=<slot>,<slot>` opens those sessions side by side.

### Design system studio (`#/start`)

| Param | Description |
|---|---|
| `area` | Which room: `overview`, `color`, `type`, `logos`, `tokens`, `catalogue`, or `versions`. |
| `focus` | A wing of the colour room: `generate`, `curves`, `contrast`, `print`, `chart`. |
| `seed=<hex>` | Primes the Generate wing's primary colour before it opens. |
| `wheel` | Presence flag - opens the OKLCH colour chart (the same target as `focus=chart`). |
| `import` | Presence flag - opens the source picker on arrival (`import=0` means shut). |
| `source` | Which source the picker opens on: `file`, `image`, `font`, `pdf`, `url`. Naming one implies the picker opens. It is a signpost, never an action - nothing is fetched or read on your behalf. |

Everything except `area` is one-shot: it acts on arrival and is dropped from the address bar as soon as you move between rooms. That is deliberate, so a link copied mid-session says which room you're in rather than re-firing a modal for the next person.

### Dashboard (`#/d`)

`#/d?tab=<tab>` opens a primary tab - `device`, `brand`, `caps`, `activity`. `#/d?<section-id>` scrolls to and opens one section directly (`#/d?dash-storage`, `#/d?cap-formats`); the section ids are the `DASH_SECTIONS` rows in `shells/web/src/views/dashboard-registry.ts`. `#/b` and `#/brand` are shortlinks to the Design system tab.

### Profile (`#/profile`)

`#/profile?focus=<section>` opens and scrolls to one settings card. The sections are `details-section`, `identity-section`, `appearance-section`, `a11y-section`, `connections-section`, `renders-section`, `storage-section`, `offline-section`, `activity-section`, `feature-flags-section` and `instance-section`.

### The remaining views

| Route | Params |
|---|---|
| `#/verify` | `src=<path>` checks a file **served by this site** (an absolute same-origin path - anything else is refused, because the page's promise is that it fetches nothing on your behalf). `check=1` alongside it also resolves the credential reference the page names, without the second "Fetch and check" click. |
| `#/docs/<slug>` | Renders in the app's current language; `#/docs/<lang>/<slug>` pins one, and `?lang=` does the same thing. `?h=<heading>` jumps to a heading. |
| `#/ask` | `?q=<question>` seeds the question box. |
| `#/lab` | `?c=<any CSS colour>` opens the Colour Lab on that colour. |

### On a tool route

For completeness, the app-state flags that live on a tool link rather than on a view. All but one are in the [reserved-parameter table](/info/url-parameters.html): `options` (open on the export panel), `full` (fullscreen, no chrome), `template=<id>` (start from that template, skipping the chooser - a bare `?template=` opens the chooser itself, which is what the gallery's **+New** chip links to), `present` + `s=` + `kiosk` (presentation mode), `slot=` (resume a saved session). The exception is `share`, a presence flag read by the tool view rather than by the engine: it opens the Share dialog on load, so a click-only surface has an address.

A few more, on the canvas editors only, set EDITOR state rather than the document and are one-shot (read on load, dropped from the address on the first edit): `_sel=<id>,<id>` selects those boxes, `_t=<seconds>` opens the timeline with the playhead parked there, and `_panel=choreograph` opens the Choreograph picker over the selection. The object form `_ui=` carries the same state as one param - base64url JSON of `{ "v": 1, "sel": ["a", "b"], "t": 2.5, "panel": "choreograph" }` - for links built by other apps; every key is optional, unknown keys are ignored so the object can grow, and the three shorthands stay first-class and win on conflict. They all live in the `_` namespace, which the engine reserves outright (no tool input can ever be named that way), so they need no row in the [reserved-parameter table](/info/url-parameters.html). They exist so a link can open on a state - a documentation screenshot, a bug report, a "look at this frame" message - without a script of clicks. The same object drives a runtime channel while a canvas editor is mounted: `window.lolly.ui` exposes `getState()` (the object a link to the current view would carry) and `apply(state)`, and an embedding page can `postMessage({ type: 'lolly:ui', state })` to the same effect.

[Back to URL Mode](/info/url-mode.html).
