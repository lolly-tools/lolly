# Colourways

A colourway is a lead colour, the colour that sits on the lead and a partner colour, kept in your design system. You choose a colourway for each piece, so one poster can lead with green and the next with coral, and the design system stays as it is.

A department or a product often has its own colourway. Each person can choose one in **Settings → Appearance**, and the app and each new piece they start then use that colourway ([Make a colourway your own](#make-a-colourway-your-own)).

Lolly Demo, the design system lolly.tools opens with, has six: Spearmint, Morning, Spring, Beach, Afternoon and Midnight. Each holds colours for the light look and the dark look. You make and edit colourways in the **Colours** room of Lolly Design System Setup ([Add colourways to a design system](#add-colourways-to-a-design-system)).

::: figure colourways-looks
Lolly Demo's six colourways in the light look and the dark look: each has a lead, the colour on the lead and a partner.
:::

[Brand architectures](/info/brand-architectures.html#rotating-lead-colour) compares a rotating lead with other brand arrangements. [Lolly Demo in use](/info/lolly-demo-in-use.html) shows the six colourways in use.

<!--i:eti-palette-->
## Choose a colourway for one piece

In a tool, the sidebar's **Design system** section shows one dot per colourway, drawn in its lead and partner for the current look, then **Light** and **Dark**, then a list for any other theme group. In Lolly Design, the Inspector's **Canvas** tab shows the same choices, and the two always agree.

Pick a dot and the open tool redraws with no reload. Every colour linked to the design system changes, along with the colours the tool's logic read from the design system and the colour picker's swatches. The choice is saved with the session, and the app around the canvas keeps its own colours.

A group appears only when switching it changes what the tool draws. A colourway leaves the text colour alone, so a tool that draws only the text colour shows **Light** and **Dark** and no dots. A tool that reads no design-system colour shows no section. Linking a colour to the design system can make a group appear. A hidden group still keeps its choice in the link and the session.

The choice travels with the piece:

- **In a link,** with the other theme choices: `_themes={"":"dark","colourway":"beach"}` ([Reserved URL parameters](/info/url-parameters.html#design-system-language-and-emoji)).
- **On the command line,** as the same JSON in `--_themes`. On `lolly run`, `--themes=all` exports each look once, in a saved session's colourway or else the canonical one, and `--themes=Beach` exports in that colourway. A design system whose only themes are colourways exports each colourway under `all`.
- **In a batch,** per row, in the CSV's `_themes` column ([Lolly Batch](/info/batch.html#make-many-versions-of-one-design)).
- **In the exported file,** as the [design-system record](/info/exporting.html#the-design-system-record), which gives the colourway beside the tool: *Lolly Chart (Beach colourway)*.

<!--i:eti-user-check-->
## Make a colourway your own

In **Settings → Appearance**, **Your colourway** shows the design system's colourways as dots, drawn in the app's current look, with the canonical one marked as the design system default. Pick a dot and two things change:

- The app's accent, favicon and logo tint take your colourway on this device, in light and dark.
- Each new piece you start uses your colourway and stores that choice, as if you had picked the dot in the tool's sidebar. This applies to a tool opened fresh, a new Lolly Design document and a template. A piece you already started keeps its colourway when you later choose another.

The row appears only when the active design system has more than one colourway. Your profile keeps one choice per design system, and a backup or Sync carries the choices with the rest of your profile. Picking the canonical colourway stores nothing, so you follow whatever the design system makes canonical later. If the design system drops the colourway you chose, the app and new work go back to the canonical one.

Your choice never changes a piece whose colours are already set:

- a saved session, and a link or a copy that carries a colourway;
- a link with input values, since someone already made that piece. Without a colourway in the link, the piece opens in the canonical colourway;
- a scripted export (`export=`), a framed tool (`iframe`), a `full` view, a presentation and a collaboration;
- a tool whose manifest ignores colourways ([Tools that keep their own colours](#tools-that-keep-their-own-colours));
- the command line, the TUI and the MCP server, which hold no personal choice and draw the canonical colourway unless a link or `--_themes` asks for another.

An export started in your colourway records that colourway in its [design-system record](/info/exporting.html#the-design-system-record), as a sidebar pick does.

<!--i:eti-monitor-->
## The app follows your colourway

The app's accent, favicon and logo tint follow your colourway, or the canonical colourway when you have not chosen one, whatever the open piece uses. A Beach poster shows Beach on the canvas and your colourway in the app around the poster. For the app, every other theme group stays on its canonical option, whether or not it declares a kind. Light and dark follow the app's appearance setting.

The canonical colourway is the one marked `canonical`, or the first when none is marked. For Lolly Demo it is Spearmint. **Settings → Design system** lists the design system's colourways (`#/settings?dash-colourways`).

<!--i:eti-blend-->
## Tools that use every lead

Some tools that draw several colours at once use the whole family: every colourway's lead in the piece's look, canonical first, read through `host.tokens.family()` ([Host API](/info/host-api.html)).

| Where | What the family changes |
| --- | --- |
| Lolly Chart | The leads come first in the categorical palette, ahead of the design system's own spectrum or the shipped colours when it has none, so the palette never has fewer colours than with one colourway. They follow Primary and Secondary in the ordered palette and the recolour swatches. Another colourway's lead becomes the second hue of the two-hue sequential and diverging ramps. When chosen, the **Design system - colour roles first** palette leads with the design system's [colour roles](/info/brand-studio.html#colour-roles-what-the-colours-are-called) in the piece's colourway instead. A 3-D chart's stage also takes the colourway: the studio floor and wall are the background colour, the night stage is the design system's deepest colour, and the lights and reflections are tinted with the secondary and the primary. A palette colour too close to the stage is left out, so a dark colourway leads with its brighter hues. |
| Audiogram | The other colourways' leads follow the background in the visualiser's colours. |
| Mesh Gradient | **Shuffle colours** draws on the leads before the rest of the design system. |
| The visualiser's colour schemes | One scheme per colourway, in the design system's order, named after the colourway, with the partner as the counterpoint. When a lead is too dark or too grey, the partner fills the field instead. |
| Audio and text covers in Assets and the picker | The leads come first in the colours the covers are drawn from. |
| Icon colours and photo washes in Assets and the picker | One choice per colourway, after **Original**, named after the colourway. A two-colour icon takes the colourway's lighter lead as its accent and the deeper lead as its base when the deeper lead holds as an outline on the surface; otherwise the more vivid lead and the colourway's text colour. A photo takes a gradient map from a dark tone through the lead to a pale tint of the lead. A design system with no colourways offers neither strip. |
| Icons set to Auto | The piece's own colourway, in its pairing for the ground under the icon: the light pairing above on a light ground, and on a dark ground or a photograph the dark look's lead as the outline with the colourway's partner or text colour as the accent. |
| Certificate | Celebration's printed confetti and the falling pieces of the **Confetti** motion use the piece's accent and partner, then the other colourways' leads. |

When a piece's colourway or look changes, Lolly Chart, Mesh Gradient and Lolly Filter read their design-system colours again as the tool redraws, and every input keeps its value. Covers belong to the app: they list the same leads whatever colourway a piece uses, in the app's own light or dark appearance.

The family holds one colour per colourway. On a design system with [colour roles](/info/brand-studio.html#colour-roles-what-the-colours-are-called), each member is the role read as the lead colour in that colourway. A role read by name only never joins the family, so no tool draws the role until someone chooses the role in a colour field or picks Lolly Chart's colour roles palette.

A design system with one colourway, or none, has no family, and these tools draw unchanged. Tool authors reach the family through the canvas variables `--brand-lead-1` onwards and a colour input's `"palette": "colourway-leads"` option; [Templates and rendering](/info/tool-rendering.html#design-system-colours-in-templates-and-styles) and [Tool inputs](/info/tool-inputs.html) cover both.

<!--i:eti-lock-->
## Tools that keep their own colours

A tool whose colours are its content, such as a tonal ramp, can declare `"tokenAxes": { "colourway": "ignore" }` in its manifest ([Tool manifests](/info/tool-manifest.html#colours-that-are-the-content) has the format). That tool renders in the canonical colourway whatever a link, a saved session or the design system's stored choice asks for, and its sidebar offers no colourway. Other kinds work the same way, such as `mode` for a print piece always drawn in the canonical look.

When a link or `--_themes` asks such a tool for another option, `lolly run` prints a `THEME_CHOICE_IGNORED` warning, which `--strict` turns into a failure. An MCP render adds the same sentence to its warnings.

<!--i:eti-repeat-->
## Rules for a series

A series of pieces, such as a week of social posts or the speakers at an event, can take its colourways from a rule. The engine's `pickColourway` function applies five rules.

::: note Rules are for scripts for now
No series or batch flow in the app applies them yet. They are for scripts and tools that call the engine. Meanwhile, give each row its colourway in a batch CSV's `_themes` column ([Lolly Batch](/info/batch.html#colourways-and-themes-per-row)), or export one piece in several colourways from the command line with `--themes=Spearmint,Beach` ([One document, every theme](/info/cli-decks.html#one-document-every-theme)).
:::

::: figure colourways-series
Eight pieces from Lolly Demo under each rule, picked by the engine.
:::

| Rule | Picks |
| --- | --- |
| `canonical` | The canonical colourway, every time |
| `cycle` | The next colourway in order for each piece, canonical first |
| `by-key` | A fixed colourway for each value of a field, such as a speaker or a product, from a hash of the value |
| `shuffle` | A seeded random order that uses every colourway once before any repeats |
| `by-date` | The colourway whose date window contains the date, else the canonical one |

A rule runs when each piece is made, and the piece stores the colourway it got, never the rule. Adding a colourway later changes what a rule picks for new work only. The same seed, key, date and position pick the same colourway on every computer, because the engine has no clock and no random source of its own.

<!--i:eti-file-plus-->
## Add colourways to a design system

<a id="in-design-system-setup"></a>
### In Lolly Design System Setup

In the **Colours** room, open **Colour roles**. The **Colourways** row at the top shows one chip per colourway in its lead colour, with **Default** on the canonical one. The table under the row shows each [colour role](/info/brand-studio.html#colour-roles-what-the-colours-are-called) for the chosen colourway, with light and dark side by side.

1. Press **+ Add** and choose one of the palette's colours. The new colourway takes that colour as its lead. Lolly works out the colour that sits on the lead and the partner, for light and for dark, with the same values a design system derived from that colour would use. The surface, the text and the ramps stay the design system's own. On a design system with colour roles, the lead and partner go to the roles read as those colours, and every other role starts with the canonical colourway's colour, marked **Copied** until you choose one. On a design system with one lead colour, the first **+ Add** makes the current lead the canonical colourway, named after its colour, and nothing it draws changes.
2. Choose a chip to edit that colourway. The table, strip, palette and previews then read and write that colourway. The **Light** and **Dark** switch beside **In context** chooses which look the preview and palette show.
3. With a colourway chosen, type a new name in the name field, or press **Duplicate**, **Make default** or **Remove**. The canonical colourway cannot be removed.

Each edit goes through the room's undo and saving. Lolly refuses an edit that would change how any other colourway or look draws. A managed design system opens read-only: its page shows the colourways as a chooser and the colour roles for the chosen one, with no editing controls. On a Lolly Work instance that lets you edit its design system, **Edit for** the instance opens an editing copy, and **Send to** the instance sends the colourways and colour roles back ([Edit this instance from the studio](/info/work-design-system-administration.html#edit-this-instance-from-the-studio)). When a token file encodes its colourways in a way the studio cannot edit, the row gives the reason, and choosing a colourway in a tool still works.

Three things are not in the room yet and are written in the token file: the order of the colourways, a date window on a colourway and a rotation rule for the group.

### In the token file

A colourway can also be written by hand, by a script or with the engine's colourway functions, and imported like any other token file.

A colourway is a theme group of kind `colourway` ([Design Tokens](/info/design-tokens.html#what-a-theme-group-means) covers kinds). It cannot override `color.semantic.primary`: token sets apply in set order, not group by group, so a colourway set placed after the light and dark sets would give both looks the same primary. Instead each colourway holds its colours per look, and the light and dark sets link the role slots to those colours. Lolly Demo's file, trimmed to two colourways:

```json
{
  "light": { "color": { "$type": "color", "semantic": {
    "primary":    { "$value": "{color.colourway.light.primary}" },
    "on-primary": { "$value": "{color.colourway.light.on-primary}" },
    "secondary":  { "$value": "{color.colourway.light.secondary}" },
    "text":       { "$value": "{color.brand.liquorice}" } } } },
  "dark": { "...": "the same links, through color.colourway.dark" },
  "colourway/spearmint": { "color": { "$type": "color", "colourway": {
    "light": { "primary": { "$value": "{color.brand.spearmint}" }, "on-primary": { "$value": "{color.brand.sugar}" }, "secondary": { "$value": "{color.brand.bunyapine}" } },
    "dark":  { "primary": { "$value": "{color.brand.green-apple}" }, "on-primary": { "$value": "{color.brand.liquorice}" }, "secondary": { "$value": "{color.brand.bunyapine}" } } } } },
  "colourway/beach": { "color": { "$type": "color", "colourway": {
    "light": { "primary": { "$value": "{color.brand.lagoon}" }, "on-primary": { "$value": "{color.brand.liquorice}" }, "secondary": { "$value": "{color.brand.bark}" } },
    "dark":  { "primary": { "$value": "{color.brand.reef}" }, "on-primary": { "$value": "{color.brand.liquorice}" }, "secondary": { "$value": "{color.brand.pancake}" } } } } },
  "$themes": [
    { "name": "light", "selectedTokenSets": { "base": "enabled", "light": "enabled" }, "$extensions": { "com.suse.lolly": { "axis": { "kind": "mode" } } } },
    { "name": "dark", "selectedTokenSets": { "base": "enabled", "dark": "enabled" }, "$extensions": { "com.suse.lolly": { "axis": { "kind": "mode" } } } },
    { "id": "spearmint", "name": "Spearmint", "group": "colourway", "selectedTokenSets": { "colourway/spearmint": "enabled" }, "$extensions": { "com.suse.lolly": { "axis": { "kind": "colourway", "canonical": true } } } },
    { "id": "beach", "name": "Beach", "group": "colourway", "selectedTokenSets": { "colourway/beach": "enabled" }, "$extensions": { "com.suse.lolly": { "axis": { "kind": "colourway" } } } }
  ]
}
```

The path segment after `color.colourway` is the look's theme id (`light`, `dark`). Every colourway re-points `primary`, `on-primary` and `secondary`. A colourway can also re-point `surface` for a tinted background; then every look links its surface the same way, and the other colourways keep their own. Slots no colourway re-points, such as `text`, `muted` and `edge`, stay ordinary values in the light and dark sets. A design system with colour roles holds each role's colour per colourway in the same sets ([Colour roles in each colourway](#colour-roles-in-each-colourway)). `com.suse.lolly` is Lolly's vendor extension key, written in the reverse-domain form DTCG asks for. Token files already carry the key, so the key does not change.

::: details Naming rules for colourways
A colourway id may not repeat any other theme id in the file, so `light` and `dark` are never colourway ids. A colourway name may not repeat any other theme's id or name, in any case, and has at most 80 characters (`MAX_COLOURWAY_NAME`), because a theme request matches by name: a colourway called Light would answer every request for the light look. The same rules apply to the canonical colourway that `liftToColourways` creates.

A group can carry a `rotation` rule and each option a date `window` (`{ "from": "2026-12-01", "to": "2026-12-31" }`, inclusive ISO dates, read by `by-date`). [Design Tokens](/info/design-tokens.html#what-a-theme-group-means) lists every field.
:::

Imported files often encode colourways another way, such as overriding the semantic slots in each colourway set. Choosing a colourway still works on such files, and so do the colourway helpers, which read the slots through the resolver. Only the shape above can be converted and edited by the engine's colourway functions.

::: details For tool and script authors: the engine's colourway functions
`engine/src/colourway.ts` holds the pure helpers. `liftToColourways` converts a single-lead system into one with a canonical colourway, and refuses the edit unless every token in every look resolves exactly as before. `addColourway` adds one. `colourwayFamily` lists every colourway's colour for a role, canonical first. `pickColourway` applies a rule, and `withColourway` merges a pick into a theme selection. `deriveColourwaySlots` in `engine/src/brand-derive.ts` gives a new lead's primary, on-primary and secondary for one look, with the same values a design system derived from that colour would use.

Five more functions edit the colourways a file already has. `renameColourway` changes a colourway's display name and never its id, because pieces store the id. `reorderColourways` puts them in a new order with the canonical one first. `setCanonicalColourway` makes another colourway canonical and moves it first. `duplicateColourway` copies one under a new id and name. `removeColourway` removes any colourway except the canonical one, and clears any stored choice of that colourway.

Each function works on a copy, resolves every token under every choice of look and colourway before and after, and refuses the edit with reasons when a remaining choice would draw something different. Two changes are intended: after `setCanonicalColourway`, a piece that chose no colourway draws the new canonical one, and after `removeColourway`, a piece that stored the removed colourway draws the canonical one. `colourwaysEditable` says whether a file's colourways can be edited this way, and why not. The Colours room's colourway controls call these functions, and Lolly Design System Setup's **Rebuild palette** keeps every colourway ([Lolly Design System Setup](/info/brand-studio.html#committing-a-generated-palette)).
:::

### Colour roles in each colourway

A design system with [colour roles](/info/brand-studio.html#colour-roles-what-the-colours-are-called) holds every role's colour in every colourway, for each look, beside the slots. The record at `$extensions["com.suse.lolly"].brandSystem` lists the roles with `"group": "colourway"` in the brand's order, and its bindings say which slot each role fills. The example is Wefthouse, an invented textile brand, trimmed to one colourway and its light look.

::: details The Wefthouse token file
```json
{
  "$extensions": { "com.suse.lolly": { "brandSystem": {
    "schemaVersion": 1, "id": "wefthouse", "label": "Wefthouse", "rules": [],
    "roles": [
      { "id": "main", "label": "Main", "description": "The cloth's ground colour", "group": "colourway",
        "resources": [{ "type": "token", "path": "color.semantic.main" }] },
      { "id": "accent", "label": "Accent", "group": "colourway",
        "resources": [{ "type": "token", "path": "color.semantic.accent" }] },
      { "id": "supporting", "label": "Supporting", "group": "colourway",
        "resources": [{ "type": "token", "path": "color.semantic.supporting" }] }
    ],
    "bindings": [
      { "id": "lead", "roleId": "main", "consumer": { "slot": "primary" } },
      { "id": "partner", "roleId": "accent", "consumer": { "slot": "secondary" } }
    ] } } },
  "light": { "color": { "$type": "color", "semantic": {
    "primary":    { "$value": "{color.colourway.light.primary}" },
    "main":       { "$value": "{color.colourway.light.main}" },
    "on-main":    { "$value": "{color.colourway.light.on-main}" },
    "supporting": { "$value": "{color.colourway.light.supporting}" } } } },
  "colourway/indigo": { "color": { "$type": "color", "colourway": { "light": {
    "primary":    { "$value": "{color.colourway.light.main}" },
    "on-primary": { "$value": "{color.colourway.light.on-main}" },
    "secondary":  { "$value": "{color.colourway.light.accent}" },
    "main":       { "$value": "#1b2a6b" },
    "on-main":    { "$value": "oklch(100% 0 0)", "$extensions": { "com.suse.lolly": { "colourRole": { "derived": true } } } },
    "accent":     { "$value": "#b23a48" },
    "supporting": { "$value": "#6c7a89" } } } } }
}
```
:::

- **Values.** A role's colour lives at `color.colourway.<look>.<id>` in each colourway's set, and `color.semantic.<id>` in each look links to that colour. So `{color.semantic.main}` in a colour field and `--brand-main` on a canvas follow the piece's colourway and look, as the lead colour does.
- **Bindings.** A slot a role fills is an alias to that role inside every colourway's set: here `primary` reads Main and `secondary` reads Accent. Everything that reads a slot works unchanged. Moving a binding rewrites those aliases and never a value. A role whose id is a slot's own name, such as `primary`, is that slot and needs no alias.
- **On-colours.** Lolly works out the colour that sits on each role, per look and colourway, by the rule it uses for the colour on the lead, and marks it `colourRole.derived`. An on-colour the file states with no mark wins and stays.
- **Nothing missing.** Every colourway holds a colour for every role. Adding a colourway, or duplicating one that lacks a role, copies the role's colour from the canonical colourway, and adding a role with no colours of its own copies the partner colour. Each copy is marked `colourRole.seeded` until someone chooses, and Lolly Design System Setup shows such a value as **Copied**. A dark value can follow the light one with an alias such as `{color.colourway.light.supporting}`, which the room shows as **Same as light**.

A design system that declares no colour roles holds none of this, and every colourway function writes its file with no role data. Exported files record the design system, its version and the theme choices, and nothing about roles.

<!--i:eti-folder-move-->
## Colourways in Penpot

A `.penpot` export keeps the colourway group and its sets, and opens with the canonical colourway turned on so the links resolve. Penpot's theme record has no field for the kind, so the group goes to Penpot and back as a plain theme group. A design system with colour roles gets the kind back on import, from the group's name, `colourway`, along with its roles' words. [Colour roles in other formats](/info/design-tokens.html#colour-roles-in-other-formats) lists what each format keeps.
