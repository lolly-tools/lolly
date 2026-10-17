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

## In the terminal and over MCP

In the TUI, press `t` in the **System** view to inspect tokens. The inspector reads the design system a terminal render uses: the active terminal system, or the content profile's tokens when no terminal system is active. Its header shows the source, a short revision digest, one choice per theme group, the effective set order and any issues. `g` picks a theme group and `o` steps its choice. The header then reads **Preview**, and nothing is written. `/` searches token paths, `x` lists only tokens with issues, and `Enter` opens a token's trace: its authored and resolved values, the winning set and override order, its issues and declared roles, then the tokens it reads and the tokens that read this one. `Enter` on a step opens that token; `Esc` goes back.

`s` reviews the previewed choices and states how many resolved values change. `y` stores them in `$metadata.activeThemeSelection` on the active terminal system, so later CLI and TUI renders use them. A content profile is read-only here. If another shell changes the system after the review starts, the review stores nothing and shows the current choices again.

Agents call `lolly_inspect_tokens` on the MCP server for the same report as JSON. It reads the server's design system, the one `lolly://design-context` describes, or a `tokens` document given with the call. `selection` takes the `_themes` object and `theme` takes one theme name. The answer holds the effective and stored choices, a `preview` flag, the diagnostics, a page of tokens and, with `token`, a trace in both directions. A trace follows up to `depth` steps (8 by default, at most 16) and lists at most 200 tokens in each direction. With the Beacon example as `tokens`, `selection: {"appearance": "night"}` and `token: "border.exampleOutline"` return the night border, which reads `color.semantic.primary` and `stroke.exampleWidth`.

Counts in the TUI and over MCP cover token references and declared roles in the inspected document. Tool hooks and other documents are outside that scope.

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

## Saved work and tools that use a token

The inspector's **Used by** list covers references inside the token document. Below that list, **Check saved work and tools** looks for the selected token in two more places on this device: saved sessions in this browser's storage, and the tool manifests of the mounted catalog. One check covers every token in the workspace, so choosing another token shows its results without a second check. The check runs only on request, can be cancelled and writes nothing.

A saved session follows a token when one of its inputs, Design layer properties, rich-text run colours or composed paragraph settings links that token. A session that keeps a custom value but remembers the link for **Restore link** is counted separately. Sessions in the Trash, project templates and discarded drafts are left out. A tool counts when the token is the default of a colour or number input or block field, or a value in one of its examples. Each count states how many sessions or tools were read. Sessions and manifests that could not be read, or that fall past the size limits, are reported as not counted rather than as zero.

Shared projects, other devices, earlier versions in History, the defaults of tools added from files and values that tool hooks compute are outside both scopes. A result describes this device at the time shown. When saved sessions change afterwards, the section notes the change and offers **Check again**. Sessions also record which design system was active when they were saved, so the result separates sessions saved with this system from sessions saved with another one.

## Published fonts

New locally published font pins include family, weight, slant and subset descriptors. Replacing or deleting a pinned face preserves its exact bytes through the existing deduplicated copy-on-write store. Web rendering uses isolated release family names for CSS and vector shaping. The Node resolver verifies pinned bytes and supplies variable weights and subset fallback faces.

Missing or changed bytes for these new font pins fail visibly. Portable snapshots retain authored family names; worker rendering uses a separate release projection. Earlier record-only pins retain their legacy behavior. This guarantee covers declared pinned local faces; it does not establish identical raster bytes across platforms or pin every platform font.

## Shared interface

The workspace uses the app's semantic colours, shared cards and disclosures, native `.field-*` editors, button styles, change summary and modal lifecycle. The reference list is paged at 100 rows, and details remain readable on narrow screens. Components contains the production workspace, captured context strip, and linked-field examples in linked, custom, unresolved, mixed and read-only states. Tool inputs use one existing three-dot menu, and Design retains its existing property groups. Applying a link change closes the input menu and returns focus to the same field's menu button. Reopening reads the current link status. Source inspection keeps Close visible while scrolling; closing the inspector returns to the input menu, and Escape closes the menu back to its button.

Download the [Beacon example system](/examples/beacon.tokens.json) to try independent appearance and density choices, retained custom vocabulary and semantic aliases. Its `border.exampleOutline` changes colour and stroke style with appearance, and width with density.
