# Inspecting and reviewing design tokens

Open Start's Tokens room to inspect all retained definitions, including custom paths and inactive source sets. The browser shows authored and resolved values, the winning set, override order, direct references and token dependents. Declared brand roles and consumer slots appear separately from token dependents; declarations do not establish observed usage or a rule check. Counts cover the token document being inspected. Other documents and dynamic hooks are outside that scope.

Read-only systems offer the same inspection. The **Inspect tokens** action in a tool sidebar reads the effective render version and its captured theme choices. Trying another choice in this inspector is labelled **Preview**; **Return to render choices** restores the captured context without editing the document. Start reads the editable head. These can differ when a published version is active.

## Theme choices

Each imported theme group has its own control. Choices use source group names and source theme ids, falling back to the theme name when the source has no id. Previewing writes nothing. **Use these choices for this system** creates a review; **Apply reviewed change** commits the choices through Start's existing persistence and undo path.

Documents store choices in `$metadata.activeThemeSelection`. Render links use `_themes`, a JSON object in the reserved underscore namespace. Sessions carry `__tokenSelection`. Existing `{theme}` bridge calls retain their single-theme behavior.

```sh
lolly system inspect --file=beacon.tokens.json --_themes='{"appearance":"night","density":"roomy"}' --json
lolly qr-code --url=https://example.com --_themes='{"appearance":"night","density":"roomy"}' --output=qr.svg
```

The app's light/dark appearance and accessibility preferences remain separate from these authored design choices.

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
| Design legacy text | Font family and declared numeric size, spacing and padding fields. |
| Remaining consumers | Paragraph text formatting, whole typography/shadow/gradient composites, duration and easing need additional adapters. Resolving a composite in the inspector does not establish a direct property binding. |

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

Download the [Beacon example system](/examples/beacon.tokens.json) to try independent appearance and density choices, retained custom vocabulary and semantic aliases.
