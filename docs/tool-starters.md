# Tool templates and presets

Provide curated starting points, saved templates and Design motion.

Part of [Authoring Tools](/info/authoring-tools.html).

## Templates & presets (`templates/`)

A tool's curated starting points live as one file per template in `tools/<id>/templates/`:

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

- **`id` must equal the file basename** (`poster.json` → `"id": "poster"`) - it is the
  stable address the `?template=` launcher and the chooser use. Ids are permanent, like
  tool ids.
- **`values` is a full input seed**: input ids from your manifest mapped to values of the
  right type. It is what a fresh session opens with when the person picks this template.
- **`presets` are variants inside the template** - each one a values overlay merged over
  the template's base (shallow, per input id, preset wins). A size variant of a blocks
  composition therefore carries the FULL replacement array, not a fragment. Deep-link a
  preset as `?template=<tid>&preset=<pid>`.
- The synced catalog index carries **metadata only** (names, categories, descriptions -
  never `values`), so templates cost nothing at rest however large the seed grows; the
  values file is fetched when picked. Run `pnpm run build:catalog` after adding or editing
  one, and `pnpm run validate:catalog` checks the shape (ids, uniqueness, object values).
- With at least one template, a blank fresh open of your tool presents the **Start
  chooser** (search, category chips, live-rendered tiles, preset chips); the tools view
  shows the count on your card, lists every template in the About dialog, and finds the
  tool by its template and preset names in search. In the editor layouts, "New from
  template" in the Lolly menu reopens the chooser mid-session.
- Keep names and descriptions short and plain - they are user-facing copy and will be
  localized.

### The gallery cover

Set `"galleryCover": true` on one template to make it the tool's first gallery preview.
The preview opens that same editable template. Other templates remain available in their
usual order; a tool without a nominated cover keeps its first template or default output.
Catalog validation rejects overlapping covers for the same gallery theme.

Choose a simple composition that reads at card size. Use brand tokens for colours,
prefer transparency for standalone graphics, and keep backgrounds that belong to the
output, such as a poster or document. A chart can lead with the visual alone and offer
labels through a preset. Use actual tool output, with real sample inputs where needed.
Tools that only export non-image formats use an icon card.

For tools that need a person's media or a recording before they can produce a useful image, set `galleryArt: "icon"` on the tool manifest. The gallery then uses the tool's icon without running a capture, downloading a model or showing an empty editor as artwork. Tools with no image export format also use their icon.

For transparent lettering and logos, templates can declare `galleryTheme: "light"` or `galleryTheme: "dark"`. The dark variant also serves the brand theme. Each is a real editable template, and its gallery link opens that exact variant. Omit the field when the artwork suits every theme. A tool can nominate one cover per theme; a cover without a theme applies to both.

After changing a shared template, rebuild and validate every mounted profile with
`pnpm run build:catalog:all` and `pnpm run validate:catalog:all`.

### Templates people save

Someone using your tool can save what they have as a template of their own, from the
editor's Save dialog or from a session tile in Projects. A saved template carries the
same fields as one you ship: an id, a name, an optional description, and a `values` seed
keyed by input id. It lives on that person's profile, never in the catalog, and it joins
yours in the same chooser, grouped under "Yours".

Two things follow for a tool author:

- **The seed is the session, minus what cannot travel.** It keeps the export settings the
  session had (format, size, unit, dpi) and drops every `file` input, whose bytes are the
  person's own file rather than a value. A tool whose inputs are all `file` inputs
  therefore cannot be saved as a template, and the app does not offer it.
- **A saved template can become a shipped one.** "Export as file" writes
  `{ id, name, description, values }` in exactly the file format above. Put that file in
  `tools/<id>/templates/`, run `pnpm run build:catalog`, and it is a starter like the
  rest. That is the route from something one person made to something the tool ships, and
  what a pull request against `lolly-tools/lolly` should carry.

What can be done to a template follows from who owns it. A template someone saved is
theirs to delete. A template you ship can be hidden and restored, never deleted, whether
or not the brand is locked.

### Hiding a starter by default

A brand pack can decide that some of your starters are not for it. It lists them at the
top level of its own `catalog/assets/index.json`, beside `defaultHiddenTools`:

```json
"defaultHiddenTemplates": ["chart:candlestick-series", "design:poster"]
```

Each entry is `"<toolId>:<templateId>"` - the tool's id, then the template file's
basename. `pnpm run validate:catalog` resolves both halves against that profile's own
view and fails on an entry naming a tool the profile does not mount or a template file
that is not there, so a typo cannot ship as a rule that hides nothing. For the same
reason no tool may take the id `user`: that word is the prefix a person's own templates
use in the same ref.

The list seeds a fresh profile and then steps aside. As soon as someone hides or restores
a template themselves, their set is the one that counts and the brand's list is no longer
merged in - the rule `defaultHiddenTools` already follows. Hidden is not deleted: the
template stays in the catalog, a `?template=` link still opens it, and the person can
bring it back from the chooser's Hidden group.

Every brand pack ships the key with an empty list, so there is an obvious place to add
one. Editing it takes the usual catalog ritual: `pnpm run build:catalog:all`, then
`pnpm run validate:catalog:all`.

### Curated Design motion

Design templates can carry optional `motion` metadata beside `values`:

```json
"motion": {
  "collection": "Launch",
  "recipe": "assemble-loop",
  "durationMs": 6000,
  "posterMs": 3300,
  "beats": ["Assemble", "Settle", "Hold", "Unwind"]
}
```

The catalog carries this small description; the animation itself stays in the
ordinary `boxes` keyframes and clips. The gallery and template chooser render the
poster at `posterMs` and offer a live preview using the same sequence clock as
export. Reduced-motion users see the poster until they explicitly play it. Picking
an example opens an editable document at its readable poster; pace presets scale
that opening position with their duration. An explicit `_t=` link still wins.

Use semantic brand colours and font roles, allow enough reading time after the
last entrance, and keep every part of a compound card aligned throughout its move.
The four Launch templates include 6-second base, 7.5-second Calm and 4.2-second
Brisk treatments. Their Choreograph recipes expand to ordinary editable tracks.
Motion metadata currently enables live discovery previews for Design. Durations
must be 800–30000 ms, with a poster inside that interval and one to eight short
beat descriptions. Run `build:catalog:all` and `validate:catalog:all` after changing
a community template so every mounted brand receives the new metadata.

[Back to Authoring Tools](/info/authoring-tools.html).
