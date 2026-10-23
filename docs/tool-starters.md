# Tool templates and presets

A blank canvas is a slow start. Ship a few templates with your tool and people open it on a finished example they only need to adjust, such as a poster, a story-sized variant or an event card. This page covers the template files you ship, what happens when people save their own, how a brand pack hides starters it does not want and the motion details Design templates can carry.

::: note After editing a template
Templates are listed in each brand's generated catalog index. After adding, changing or hiding one, run `pnpm run build:catalog:all`, then `pnpm run validate:catalog:all`, so every mounted profile gets the change. [Publish to a catalog](/info/tool-publishing.html#publish-to-a-catalog) has the whole routine.
:::

## Templates & presets (`templates/`)

A tool's starting points live in `templates/`, one file per template:

```json
{
  "id": "poster",
  "name": "Poster",
  "category": "Poster",
  "description": "One artboard, one message.",
  "values": { "<inputId>": "<value>" },
  "presets": [
    { "id": "story", "name": "Story", "description": "9:16 for social stories.",
      "values": { "<inputId>": "<overlay value>" } }
  ]
}
```

| Field | What it does |
| --- | --- |
| `id` | Must equal the file name (`poster.json` holds `"id": "poster"`). It is the permanent address the `?template=` launcher and the chooser use, so never change it, as with tool ids. |
| `name`, `category`, `description` | Short, plain words people see in the chooser. They are translated, so keep them simple. |
| `values` | A full input seed: input ids from your manifest mapped to values of the right type. A fresh session opens with these when someone picks the template. |
| `presets` | Variants inside the template. Each is a set of values merged over the template's own, per input id, with the preset winning. A size variant of a `blocks` composition therefore carries the whole replacement array, not a fragment. Link to one with `?template=<tid>&preset=<pid>`. |

The synced catalog index carries only names, categories and descriptions, never `values`, so a large seed costs nothing until someone picks the template and its file is fetched. `pnpm run validate:catalog` checks the shape: ids, uniqueness and object values.

With at least one template, a blank fresh open of your tool shows the **Start chooser**: search, category chips, live previews and preset chips. The gallery shows the template count on your tool's card and lists every template in its About dialog, and search finds the tool by its template and preset names. In the editor layouts, **New from template** in the Lolly menu reopens the chooser during a session. Shipped templates also appear in the Templates collection in Projects, grouped under the tool they shipped with.

![The Templates collection filtered to QR event starting points](/t/url-shot?url=%2F%23%2Fp%2F__templates__%3Ftool%3Dqr-code%26q%3Devent&width=1440&height=1000&dpi=192&waitMs=1600&waitSelector=.tpl-sec%3Anot%28%3Ahas%28img%5Bdata-tpl-preview%5D%3Anot%28%5Bdata-preview-state%3D%22ready%22%5D%29%29%29&walker=1&format=svg&dark=1&filename=templates-collection)

### The gallery cover

Set `"galleryCover": true` on one template to make it the tool's first gallery preview, which opens that same editable template. The other templates keep their usual order, and a tool without a cover keeps its first template or default output. Catalog validation rejects two covers for the same gallery theme.

Choose a simple composition that reads at card size. Use brand tokens for colours, prefer transparency for standalone graphics and keep backgrounds that belong to the output, such as a poster or a document. A chart can lead with the visual alone and offer labels through a preset. Use real tool output with real sample inputs. Tools that export only non-image formats use an icon card.

For transparent lettering and logos, a template can declare `galleryTheme: "light"` or `galleryTheme: "dark"`; the dark variant also serves the brand theme. Each is a real editable template, and its gallery link opens that exact variant. Leave the field out when the artwork suits every theme. A tool can have one cover per theme, and a cover without a theme serves both.

A tool that needs a person's media or a recording before it can produce a useful image sets `galleryArt: "icon"` in its manifest. The gallery then shows the tool's icon instead of running a capture, downloading a model or showing an empty editor. Tools with no image export format use their icon too.

### Templates people save

People can save their own templates from your tool, through the editor's Save dialog or from a session tile in Projects. A saved template has the same fields as one you ship and joins yours in the chooser under **Yours**, but it lives on that person's profile, never in the catalog. [Templates](/info/templates.html) covers saving, renaming, hiding and deleting from the person's side. Two things follow for you as the author:

- **The seed is the session, minus what cannot travel.** It keeps the session's export settings (format, size, unit and DPI) and drops every `file` input, whose bytes are the person's own file rather than a value. A tool whose inputs are all `file` inputs cannot be saved as a template, and the app does not offer to.
- **A saved template can become a shipped one.** **Export as file** writes `{ id, name, description, values }` in exactly the format above. Put that file in your tool's `templates/` folder, rebuild the catalog and it is a starter like the rest. That is the route from something one person made to something the tool ships, and what a pull request against `lolly-tools/lolly` should carry.

Who owns a template decides what can be done to the template. A template someone saved is theirs to delete. A template you ship can be hidden and restored but never deleted, whether or not the brand is locked.

### Hiding a starter by default

A brand pack can decide that some of your starters do not suit its brand. It lists them at the top level of its own `catalog/assets/index.json`, beside `defaultHiddenTools`:

```json
"defaultHiddenTemplates": ["chart:candlestick-series", "design:poster"]
```

Each entry is `"<toolId>:<templateId>"`: the tool's id, then the template file's name without `.json`. `pnpm run validate:catalog` checks both halves against that profile's own tools and fails on an entry for a tool the profile does not mount or a template file that does not exist, so a typo cannot ship as a rule that hides nothing. For the same reason no tool may take the id `user`, which is the prefix a person's own templates use in the same reference.

The list seeds a fresh profile and then steps aside. Once someone hides or restores a template themselves, their own choices count and the brand's list is no longer merged in, the same rule `defaultHiddenTools` follows. Hidden is not deleted: the template stays in the catalog, a `?template=` link still opens it and the person can bring it back from the chooser's **Hidden** group. Every brand pack ships the key with an empty list, so the place to add one is already there.

### Curated Design motion

Design templates can carry optional `motion` details beside `values`:

```json
"motion": {
  "collection": "Launch",
  "recipe": "assemble-loop",
  "durationMs": 6000,
  "posterMs": 3300,
  "beats": ["Assemble", "Settle", "Hold", "Unwind"]
}
```

The catalog carries this short description, while the animation itself stays in the ordinary `boxes` keyframes and clips. The gallery and the template chooser show the poster frame at `posterMs` and offer a live preview on the same sequence clock export uses. People who prefer reduced motion see the poster until they choose to play the preview. Picking an example opens an editable document at its poster frame, and pace presets scale that opening position with their duration. An explicit `_t=` link still wins.

Durations must be 800 to 30,000 ms, with the poster inside that range and one to eight short beat descriptions. Motion details currently enable live previews for Design only. Use semantic brand colours and font roles, leave enough reading time after the last entrance and keep every part of a compound card aligned throughout its move. The four Launch templates come in a 6-second base, a 7.5-second Calm and a 4.2-second Brisk treatment, and their Choreograph recipes expand to ordinary editable tracks.
