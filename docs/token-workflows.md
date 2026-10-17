# Inspecting and reviewing design tokens

Open Start's Tokens room to inspect all retained definitions, including custom paths and inactive source sets. The browser shows authored and resolved values, the winning set, override order, direct references and token dependents. Declared brand roles and consumer slots appear separately from token dependents; declarations do not establish observed usage or a rule check. Counts cover the token document being inspected. Other documents and dynamic hooks are outside that scope.

Read-only systems offer the same inspection. The **Inspect tokens** action in a tool sidebar reads the effective render version and its captured theme choices. Trying another choice in this inspector is labelled **Preview**; **Return to render choices** restores the captured context without editing the document. Start reads the editable head. These can differ when a published version is active.

## Theme choices

Each imported theme group has its own control. Choices use source group names and source theme ids, falling back to the theme name when the source has no id. Previewing writes nothing. **Use these choices for this system** creates a review; **Apply reviewed change** commits the choices through Start's existing persistence and undo path.

Documents store choices in `$metadata.activeThemeSelection`. Render links use `_themes`, a JSON object in the reserved underscore namespace. Sessions carry `__tokenSelection`.

A tool can still ask for one theme by name, as in `host.tokens.colors({ theme: 'light' })`. That request picks the theme in the group that declares it, and every other group keeps its choice: an explicit `selection`, then the document's stored choice, then `activeThemes`, then the group's first option. A hook that asks for light therefore still draws the artefact's colourway. Engine versions before 1.262 reset every other group to its first option on such a request. A theme name that no group declares is reported and changes nothing else.

```sh
lolly system inspect --file=beacon.tokens.json --_themes='{"appearance":"night","density":"roomy"}' --json
lolly qr-code --url=https://example.com --_themes='{"appearance":"night","density":"roomy"}' --output=qr.svg
```

The app's light/dark appearance and accessibility preferences remain separate from these authored design choices.

## What a theme group means

A Tokens Studio `$themes` group is only a name. A design system can also say what choosing between the group's options changes, so Lolly can treat light and dark differently from a choice of lead colour. The statement goes on each entry of the group, under the `com.suse.lolly` extension key:

```json
{ "name": "Persimmon", "group": "colourway", "selectedTokenSets": { "colourway/persimmon": "enabled" },
  "$extensions": { "com.suse.lolly": { "axis": { "kind": "colourway" } } } }
```

| Field | Describes | Meaning |
| --- | --- | --- |
| `kind` | the group | `mode` (light, dark and similar looks), `colourway` (which lead colour fills the primary role), or one of `expression`, `medium`, `contrast`, `density`, `campaign`, `brand` |
| `rotation` | the group | The default way a series picks an option: `canonical`, `cycle`, `by-key`, `shuffle` or `by-date` (see [Colourways](#colourways)) |
| `canonical` | one option | `true` on the option an artefact uses when it chooses none. Without it, the first option is canonical |
| `window` | one option | `{ "from": "2026-12-01", "to": "2026-12-31" }`, inclusive ISO dates, read by `by-date` |

Every entry that states `kind` or `rotation` must agree; a disagreement is reported and the first statement is used. A file whose theme entries cannot carry extensions can state the group facts once at the document root instead, as `"$extensions": { "com.suse.lolly": { "themeAxes": { "colourway": { "kind": "colourway", "canonical": "pine" } } } }`. An entry's own statement wins over the root. Lolly gives behaviour to `mode` and `colourway` today. The other kinds are kept, shown and resolved as plain theme choices. A group with no kind, or a kind this version does not know, resolves exactly as it did before kinds existed, and the inspector reports an unknown kind.

`lolly system inspect --json` and `host.tokens.inspect()` list each group with its `kind` and `canonical` option. `host.tokens.themes()` gives each theme its `id`, when the file has one, and its group's `kind`.

## Colourways

Some organisations rotate several lead colours: one poster leads with Pine, the next with Persimmon. A colourway is one of those leads, together with the colour that sits on it and a partner colour. It is a theme group of kind `colourway`, and it combines with light and dark: any colourway can be drawn in any look.

A colourway cannot simply override `color.semantic.primary`. Token sets apply in set order, not group by group, so a Persimmon set placed after the light and dark sets would give the same primary to both looks. Instead each colourway holds its colours per look, and the light and dark sets link the role slots to them:

```json
{
  "light": { "color": { "$type": "color", "semantic": {
    "primary":    { "$value": "{color.colourway.light.primary}" },
    "on-primary": { "$value": "{color.colourway.light.on-primary}" },
    "secondary":  { "$value": "{color.colourway.light.secondary}" },
    "text":       { "$value": "{color.brand.ink}" } } } },
  "dark": { "...": "the same links, through color.colourway.dark" },
  "colourway/pine": { "color": { "$type": "color", "colourway": {
    "light": { "primary": { "$value": "{color.brand.pine}" }, "on-primary": { "$value": "#ffffff" }, "secondary": { "$value": "{color.brand.jungle}" } },
    "dark":  { "primary": { "$value": "{color.brand.jungle}" }, "on-primary": { "$value": "#000000" }, "secondary": { "$value": "{color.brand.mint}" } } } } },
  "colourway/persimmon": { "color": { "$type": "color", "colourway": {
    "light": { "primary": { "$value": "#c2410c" }, "on-primary": { "$value": "#ffffff" }, "secondary": { "$value": "#7c2d12" } },
    "dark":  { "primary": { "$value": "#fb923c" }, "on-primary": { "$value": "#111111" }, "secondary": { "$value": "#fed7aa" } } } } },
  "$themes": [
    { "name": "light", "selectedTokenSets": { "base": "enabled", "light": "enabled" }, "$extensions": { "com.suse.lolly": { "axis": { "kind": "mode" } } } },
    { "name": "dark", "selectedTokenSets": { "base": "enabled", "dark": "enabled" }, "$extensions": { "com.suse.lolly": { "axis": { "kind": "mode" } } } },
    { "id": "pine", "name": "Pine", "group": "colourway", "selectedTokenSets": { "colourway/pine": "enabled" }, "$extensions": { "com.suse.lolly": { "axis": { "kind": "colourway", "canonical": true } } } },
    { "id": "persimmon", "name": "Persimmon", "group": "colourway", "selectedTokenSets": { "colourway/persimmon": "enabled" }, "$extensions": { "com.suse.lolly": { "axis": { "kind": "colourway" } } } }
  ]
}
```

The path segment after `color.colourway` is the look's theme id (`light`, `dark`). Every colourway re-points `primary`, `on-primary` and `secondary`. A colourway can also re-point `surface` for a tinted background, in which case every look links its surface the same way and the other colourways keep their own. Slots no colourway re-points, such as `text`, `muted` and `edge`, stay ordinary values in the light and dark sets. A colourway id may not repeat any other theme id in the file, so `light` and `dark` are never colourway ids.

Imported files often encode colourways their own way, for example by overriding the semantic slots in each colourway set. Selection still works on such files. The colourway helpers described below read the slots through the resolver, so they work on these files too, but only the shape above can be converted and edited by the engine's colourway functions.

**Choosing a colourway.** A link carries the choice with the other theme choices: `_themes={"":"dark","colourway":"persimmon"}`. The CLI takes the same JSON in `--_themes`. On `lolly run`, `--themes=all` exports each look once in the canonical colourway, and naming a colourway, as in `--themes=Persimmon`, exports in that colourway.

**Series.** A series of artefacts can pick its colourways by a rule. The rule is applied when each artefact is made, and the artefact stores the colourway it got, never the rule, so adding a colourway later changes what a rule picks for new work and leaves every existing artefact as it was.

| Rule | Picks |
| --- | --- |
| `canonical` | The canonical colourway, every time |
| `cycle` | The next colourway in order for each artefact, canonical first |
| `by-key` | A fixed colourway for each value of a field, such as a speaker or a product, from a hash of the value |
| `shuffle` | A seeded random order that uses every colourway once before any repeats |
| `by-date` | The colourway whose `window` contains the date, else the canonical one |

The same seed, key, date and position pick the same colourway on every computer, because the engine supplies no clock and no random source of its own.

**Penpot.** A `.penpot` export keeps the colourway group and its sets, and opens with the canonical colourway turned on so the links resolve. Penpot's theme record has no field for the `kind`, so the group arrives in Penpot, and comes back from Penpot, as a plain theme group.

**Engine functions.** `engine/src/colourway.ts` holds the pure helpers: `liftToColourways` converts a single-lead system into one with a canonical colourway and refuses the edit unless every token in every look resolves exactly as before; `addColourway` adds one; `colourwayFamily` lists every colourway's colour for a role, canonical first; `pickColourway` applies a rule; `withColourway` merges a pick into a theme selection. `deriveColourwaySlots` in `engine/src/brand-derive.ts` gives a new lead's primary, on-primary and secondary for one look, the same values a whole design system derived from that colour would use. Brand Studio does not author colourways yet, and tools do not show a colourway control yet; for now a colourway file is written by hand, by a script, or with these functions.

## Linked values

Open the three-dot **Input actions** menu beside a field label to find its **Design token** status, compatible-token picker and link actions alongside **Use as a tool input** (or **Reset this input** in a generated tool). Numeric, text and font-family select controls can link compatible tokens. Token details stay inside this menu so ordinary data-entry rows remain clean. A number consumer accepts number tokens and absolute dimensions converted at CSS 96 DPI. Relative units need a reference context and are rejected by this adapter. Select controls keep their allowed-choice validation.

**Make custom** changes the input's local value. **Restore link** rechecks the previous reference, including after saving or reopening. Undo and redo retain the appropriate previous link for each custom value. **Edit source value**, in the inspector, creates a separate reviewed source change. Missing or incompatible links retain a labelled cached fallback where available. URLs keep typed references in `_ref.<inputId>` with a scalar companion for older hosts; literal text such as `{title}` stays literal. Colour links retain their existing URL form. Custom scalar values retain their previous reference through `_restore.<inputId>` and saved session metadata. Hooks and templates receive resolved scalars.

In Design, select a layer and expand **Token links** inside its existing property group. Choose a property, then **Link a token**. The ordinary numeric, colour or font editor remains the place to adjust the value. Editing a linked value makes a local override; opening or filtering a picker changes nothing. Each link or custom action has its own undo step.

For a selection of several layers, common paint and compatible text groups offer the same actions. Linking applies one chosen value to the captured selection. **Make custom** preserves each layer's own value. **Restore link** appears when every selected layer records the same previous reference. Geometry follows the inspector's existing single-layer editing rules.

| Consumer | Current direct-link support |
| --- | --- |
| Tool inputs | Numeric inputs, text, long text and compatible select/font-family inputs; existing colour controls retain their own picker. |
| Design geometry | Declared numeric position, size and rotation properties in a single-layer selection. |
| Design paint and effects | Colour, opacity, corner radius, stroke width, and individual numeric shadow properties in the existing groups. Colour links use the document's SDR or wide-gamut colour face. |
| Design legacy text | Font family and declared numeric size, spacing and padding fields; whole typography projects family, size, weight, tracking and line height in one undo step. |
| Design composites | A single shadow with zero spread and no inset; a gradient with 2 to 12 resolved sRGB stops, written as a rightward linear gradient. Layered shadows and unsupported gradient values are refused. |
| Design borders | Whole borders project colour, absolute width and solid, dashed or dotted style in one undo step. Custom stroke styles and relative widths are refused. |
| Design motion | Duration tokens convert to the field's seconds or milliseconds; easing tokens become validated CSS cubic Bezier controls. A zero-delay transition links Enter duration and geometry easing for one non-frame layer. |
| Composed paragraphs | Line height, spacing before/after and start/end/first-line indents, following the existing caret, range or story scope. |
| Remaining consumers | Whole typography on composed text needs pinned font-resource integration. Transition delay, Exit and frame/deck consumers remain follow-ups. |

Whole composite actions retain a separate reference and adapter on each property. Editing one property preserves the other links. Missing or incompatible source values retain their last literal. Composed paragraphs store their links with paragraph settings; applying a link across paragraphs preserves their other links.

Border and stroke-style links clear an authored dash array and custom dash/gap lengths in the same transaction, so the linked style reaches the renderer. Editing any of these dash settings makes the style consumer custom while colour and width can still follow their tokens. **Make custom** retains the rendered values. **Restore link** rechecks the source and clears the local dash overrides; undo restores those overrides together. An incompatible border refresh retains all active properties from its last usable source.

In a layer's **Motion** group, choose **Enter transition** inside **Token links**.
Choose a candidate, review its status, then use **Link token** to apply duration and
easing in one undo step. A transition must have zero delay, a duration within the
Enter field's 100 to 3000 ms range, and a valid cubic Bezier curve. Unsupported
candidates remain visible with an explanation and a disabled Link action. Selecting
a candidate changes nothing. The curve governs the Enter preset's geometry;
opacity keeps the preset's existing behavior. Timeline placement stays separate.

Editing one linked field makes that field custom. A valid active easing link can
still refresh while duration remains custom. If any active transition projection
is incompatible or unresolved, all active properties keep their cached values.
**Restore link** for the whole transition rechecks both fields and applies them
together; an unsupported source leaves the layer unchanged. Links, custom values
and Restore metadata survive saved URLs and sessions.

Design keeps links in an appended metadata field alongside ordinary scalar properties. URLs, saved sessions and portable document snapshots retain that field. Opening through the engine refreshes linked properties and preserves intentional overrides and cached fallbacks.

Typography, shadow, border, transition and gradient token composites support bounded nested aliases in the [supported composite fields](https://www.designtokens.org/tr/2025.10/format/#composite-types). Incompatible reference types stay visible in the inspector. Unknown token types, `$ref` and `$extends` remain retained source data and are reported where unsupported.

## Reviewing changes

Source edits, generated scales and upstream comparisons capture the current document. The review includes authored changes and indirect resolved changes. An intervening token edit, system switch or referenced resource change invalidates Apply.

When a production host is available, the review can render a selected existing poster, title slide, content slide or Chart before and after. Rendering runs sequentially with cancellation and a deadline. The shared visual comparison controls handle alignment and noise threshold. Results describe two captured outputs, not every theme combination or every document.

Registered recipes generate colour ramps, pixel spacing scales and modular type scales. Recipe metadata, version, outputs and overrides travel in the Lolly extension; ordinary DTCG outputs remain usable by older readers. Regeneration retains recorded local overrides. Manual token collisions are refused.

```sh
lolly system diff incoming.tokens.json --file=local.tokens.json --json
lolly system generate --recipe=recipe.json --file=local.tokens.json --output=candidate.tokens.json
lolly system sync incoming.tokens.json --base=earlier.tokens.json --revision=release-42 --json
```

`sync` performs a base/local/incoming comparison and records source revision and digests. Its default is review only. `--apply` updates the active terminal system after a revision check; conflicts require `--keep-local`. External files use `--output`. The web review accepts exact earlier and incoming JSON files. Each conflict shows earlier, local and incoming definitions and needs a Keep local or Use incoming decision before Apply.

## Published fonts

New locally published font pins include family, weight, slant and subset descriptors. Replacing or deleting a pinned face preserves its exact bytes through the existing deduplicated copy-on-write store. Web rendering uses isolated release family names for CSS and vector shaping. The Node resolver verifies pinned bytes and supplies variable weights and subset fallback faces.

Missing or changed bytes for these new font pins fail visibly. Portable snapshots retain authored family names; worker rendering uses a separate release projection. Earlier record-only pins retain their legacy behavior. This guarantee covers declared pinned local faces; it does not establish identical raster bytes across platforms or pin every platform font.

## Shared interface

The workspace uses the app's semantic colours, shared cards and disclosures, native `.field-*` editors, button styles, change summary and modal lifecycle. The reference list is paged at 100 rows, and details remain readable on narrow screens. Components contains the production workspace, captured context strip, and linked-field examples in linked, custom, unresolved, mixed and read-only states. Tool inputs use one existing three-dot menu, and Design retains its existing property groups. Applying a link change closes the input menu and returns focus to the same field's menu button. Reopening reads the current link status. Source inspection keeps Close visible while scrolling; closing the inspector returns to the input menu, and Escape closes the menu back to its button.

Download the [Beacon example system](/examples/beacon.tokens.json) to try independent appearance and density choices, retained custom vocabulary and semantic aliases. Its `border.exampleOutline` changes colour and stroke style with appearance, and width with density.
