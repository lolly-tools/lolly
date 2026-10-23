# Token workflows

Once your design system is in Lolly, the everyday questions change. Where does this colour come from? What moves if I change that colour? Can this one poster be dark, in the Beach colourway, without changing the system? This page is for the person who looks after a design system, and it answers those questions in the app, in the terminal and over MCP.

Start in the Tokens room of Design System Setup (`#/start?area=tokens`). Pick any token to see its value as written and as resolved, which set it came from and every token that reads the value. Opening a token changes nothing. Changes go through a review you apply, and you can undo them.

To follow along, download the [Beacon example system](/examples/beacon.tokens.json). It has independent appearance and density choices, custom vocabulary and semantic aliases. Its `border.exampleOutline` changes colour and stroke style with appearance, and width with density.

## Inspect a token

The Tokens room lists every definition the design system keeps, including custom paths and source sets that are not active. For each token it shows:

- the authored value and the resolved value;
- the set that won and the order the sets overrode one another;
- the tokens it reads directly, and the tokens that read this one.

Declared brand roles and consumer slots appear apart from those dependents, because a declaration is not proof that anything uses the token, and not a rule check. A read-only system offers the same inspection.

Design System Setup reads the editable head. A document reads its render version, which can differ from the head when a published version is active.

### In Design

In Design, open the inspector's **Canvas** tab. Its **Style & look** section shows a context strip above the theme rows: **Mode** for light and dark, **Colourway** when the design system has colourways, and a row for any other theme group. The strip says which design system and render version the document draws with, and where the system came from. It reads **Chosen for this document** when the document made its own theme choices, and **Follows the design system** when it has none.

**Source and fallbacks** lists every theme choice, marks a read-only system and lists any choice this design system does not offer, with the default used in its place. **Inspect tokens** opens the render version with the document's choices. Trying another choice there is labelled **Preview**, and **Return to render choices** restores the captured ones; the inspector edits neither the document nor the design system. **Follow the design system** removes the document's own choices, so its linked values follow the design system's stored choices again.

The same strip labels each side of a comparison and the version a release records. A token review's before and after renders are labelled **Editable head** and **Candidate**, each with its theme choices, and **Publish a version** in the Versions room shows the editable head that publishing records. Tool sidebars do not show the strip; token details stay in each field's **Input actions** menu.

### In the terminal and over MCP

In the TUI, press `t` in the **System** view. The inspector reads the design system a terminal render uses: the active terminal system, or the content profile's tokens when none is active. Its header shows the source, a short revision digest, one choice per theme group, the set order in effect and any issues.

| Key | What it does |
| --- | --- |
| `g`, then `o` | Pick a theme group, then step its choice. The header reads **Preview**, and nothing is written. |
| `/` | Search token paths. |
| `x` | List only tokens with issues. |
| `Enter` | Open a token's trace: its values, winning set and override order, issues and declared roles, then what it reads and what reads this token. `Enter` on a step opens that token; `Esc` goes back. |
| `s`, then `y` | Review the previewed choices, with a count of the resolved values that change, then store them in `$metadata.activeThemeSelection` on the active terminal system. |

A content profile is read-only here. If another shell changes the system after the review starts, the review stores nothing and shows the current choices again.

Agents call `lolly_inspect_tokens` on the MCP server for the same report as JSON. It reads the server's design system (the one `lolly://design-context` describes), or a `tokens` document given with the call. `selection` takes the `_themes` object and `theme` takes one theme name. The answer holds the effective and stored choices, a `preview` flag, the diagnostics, a page of tokens and, with `token`, a trace in both directions: up to `depth` steps (8 by default, at most 16) and at most 200 tokens each way. With Beacon as `tokens`, `selection: {"appearance": "night"}` and `token: "border.exampleOutline"` return the night border, which reads `color.semantic.primary` and `stroke.exampleWidth`.

::: note What the counts cover
Counts in the Tokens room, the TUI and MCP cover token references and declared roles inside the token document. Tool hooks and other documents are outside that scope; [Find what uses a token](#find-what-uses-a-token) looks further, on request.
:::

## Choose themes for one document

Each imported theme group has its own control, using the source's group names and theme ids, or the theme name when the source has no id. A choice can belong to the design system or to one document.

- **For the design system.** Preview a choice in the Tokens room; previewing writes nothing. **Use these choices for this system** creates a review, and **Apply reviewed change** commits the choices through Design System Setup's usual saving and undo.
- **For one document.** A Design document's theme rows change only that document. The choice is saved with it as `__tokenSelection`, travels in its link as `_themes` and comes back when it reopens. The design system's stored choices stay as they were, and other documents keep their own.

A session's choices go wherever the session is drawn: a [multi-edit](/info/using.html#editing-side-by-side-multi-edit) card, a [batch](/info/using.html#batch-pro-mode) row and the batch CSV's `_themes` column, a Design document export, and every tool link [composed](/info/url-mode.html#tool-composition-portable-embed-url) inside the document. [Colourways](/info/colourways.html) covers choosing a lead colour for a piece.

```sh
lolly system inspect --file=beacon.tokens.json --_themes='{"appearance":"night","density":"roomy"}' --json
lolly qr-code --url=https://example.com --_themes='{"appearance":"night","density":"roomy"}' --output=qr.svg
```

The app's own light or dark appearance and your accessibility preferences stay separate from these design choices.

::: details When a tool asks for one theme by name
A tool can still ask for one theme by name, as in `host.tokens.colors({ theme: 'light' })`. That request picks the theme in the group that declares it, and every other group keeps its choice. For each of those groups the order is: its entry in an explicit `selection` when one is given (a given selection replaces the document's stored choices whole), otherwise the document's stored choice; then `activeThemes`; then the group's canonical option. A hook that asks for light therefore still draws the piece's colourway. Engine versions before 1.265 reset every other group to its first option on such a request. A theme name that no group declares is reported and changes nothing else.

Documents store the design system's choices in `$metadata.activeThemeSelection`, render links use `_themes` (a JSON object in the reserved underscore namespace) and sessions carry `__tokenSelection`.
:::

## Link a field to a token

A field linked to a token follows the token: change the token, or switch the theme, and every linked field redraws. Open the three-dot **Input actions** menu beside a field's label to find its **Design token** status, a picker of compatible tokens and the link actions, beside **Use as a tool input** (or **Reset this input** in a generated tool). Number, text and font-family select controls can link compatible tokens, and token details stay in this menu so ordinary rows stay clean.

Two actions come back throughout this page:

- **Make custom** gives the field a local value of its own and remembers the link.
- **Restore link** checks the remembered token again and follows it, including after saving and reopening.

Undo and redo keep the right remembered link for each custom value. **Edit source value**, in the inspector, makes a separate reviewed change to the token itself. A missing or incompatible link keeps a labelled cached value where one exists. Hooks and templates always receive resolved values.

A number field accepts number tokens and absolute dimensions converted at CSS 96 DPI; relative units need a reference size, so this adapter refuses them. Select controls keep their own list of allowed choices.

**In Design,** select a layer and expand **Token links** inside its property group. Choose a property, then **Link a token**. The usual number, colour or font editor stays the place to adjust the value, and editing a linked value makes a local override. Opening or filtering a picker changes nothing, and each link or custom action has its own undo step.

For several selected layers, common paint and compatible text groups offer the same actions. Linking applies one chosen value to the whole selection. **Make custom** keeps each layer's own value, and **Restore link** appears when every selected layer remembers the same token. Geometry follows the inspector's single-layer rules.

| Consumer | What can link today |
| --- | --- |
| Tool inputs | Number, text, long text and compatible select or font-family inputs. Colour controls keep their own picker. |
| Design geometry | Declared position, size and rotation in a single-layer selection. |
| Design paint and effects | Colour, opacity, corner radius, stroke width and each number in a shadow. Colour links use the document's SDR or wide-gamut colour face. |
| Design text | Font family and declared size, spacing and padding. **Whole typography** sets family, size, weight, tracking and line height in one undo step. |
| Design composites | One shadow with zero spread and no inset; a gradient of 2 to 12 resolved sRGB stops, written as a rightward linear gradient. Layered shadows and unsupported gradients are refused. |
| Design borders | Whole borders: colour, absolute width and solid, dashed or dotted style in one undo step. Custom stroke styles and relative widths are refused. |
| Design motion | Duration tokens convert to the field's seconds or milliseconds; easing tokens become checked cubic Bezier curves. A zero-delay transition links Enter duration and easing for one layer that is not a frame. |
| Composed paragraphs | Line height, space before and after, and start, end and first-line indents, at the caret, range or story. **Whole typography** sets font, size, weight, tracking and line height together. |
| Not yet | Transition delay, Exit, and frame or deck consumers. |

::: details Linking typography, borders and motion in Design
**Composites keep separate links.** A whole composite keeps its own reference and adapter on each property, so editing one property keeps the other links. A missing or incompatible source value keeps its last value. Composed paragraphs store their links with the paragraph settings, and linking across paragraphs keeps their other links.

**Whole typography on composed text records the exact face.** Linking finds an installed face for the token's family at its exact weight, and an italic face too when the text has italic runs, then stores those faces with the text by their content digest. When a design version with published fonts is active, the faces come from that version's pinned files. A nearer weight or another family is never substituted, even for a brand font that ships one file per weight: the link is refused and the field says which face is missing.

Linking clears size, weight, tracking and font overrides inside the linked paragraphs, so they cannot hide the link; other formatting stays, and undo restores the overrides in the same step. Italic runs take the italic face. A theme change refreshes the text only when every face the new values need was pinned for this link earlier; otherwise the text keeps its last values and the field reports the missing face, and linking the token again in that theme pins the missing face. Changing the size, weight, tracking or font of a whole linked paragraph, or its line height, makes the link custom; formatting one word inside it does not. A named character style that sets its own size, weight, tracking or font, such as a code style, keeps that value without making the link custom.

**Borders.** Border and stroke-style links clear an authored dash array and custom dash and gap lengths in the same step, so the linked style reaches the renderer. Editing any dash setting makes the style custom while colour and width still follow their tokens. **Make custom** keeps the rendered values. **Restore link** checks the source again and clears the local dash overrides; undo restores them together. An incompatible border refresh keeps every active property from its last usable source.

**Motion.** In a layer's **Motion** group, choose **Enter transition** inside **Token links**, pick a candidate and check its status, then **Link token** applies duration and easing in one undo step. The transition needs zero delay, a duration within the Enter field's 100 to 3000 ms and a valid cubic Bezier curve. Candidates that do not qualify stay visible with the reason and a disabled Link action, and selecting one changes nothing. The curve governs the Enter preset's geometry; opacity keeps the preset's own behaviour, and timeline placement stays separate. Editing one linked field makes that field custom, and a valid easing link can still refresh while duration stays custom. If any active part is incompatible or unresolved, every active property keeps its cached value. **Restore link** for the whole transition checks both fields and applies them together; an unsupported source leaves the layer unchanged.

**Where links are kept.** Design keeps links in an appended metadata field beside the ordinary properties. Links, custom values and remembered links survive saved URLs, sessions and portable document snapshots. Opening through the engine refreshes linked properties and keeps intentional overrides and cached values.

**Token formats.** Typography, shadow, border, transition and gradient composites accept bounded nested aliases in the [supported composite fields](https://www.designtokens.org/tr/2025.10/format/#composite-types). An incompatible reference type stays visible in the inspector. Unknown token types, `$ref` and `$extends` are kept as source data and reported where unsupported.
:::

**In links,** typed references travel as `_ref.<inputId>` with a plain companion value for older hosts, and literal text such as `{title}` stays literal. Colour links keep their own form ([Design Tokens](/info/design-tokens.html#the-value-model-reference-cached-value)). A custom value keeps its remembered link in `_restore.<inputId>` and in the saved session.

## Link many documents at once

Batch and Multi-edit can link one token across many rows or sessions. In Batch, open a column's **Fill** popover; number, text and choice columns have a **Design token** section beside the fill value. In Multi-edit, each session card has the same **Input actions** menu as a tool sidebar and acts on that session only, and the **Shared** card's menu reaches every session that declares the input.

Choosing a token opens a review before anything changes. Each row or session shows its current value and the value it would get, resolved in that document's own theme choices and checked against its own input.

- Plain values start selected.
- A custom value that replaced a link, or a link to another token, stays as it is unless you select that document.
- A document that cannot take the token, or whose input is read-only, stays in the list with the reason.

**Apply** writes only the selected documents, and **Cancel** writes nothing. **Make custom** and **Restore link** work across the selection, and the Restore review selects the documents that remember the same link.

In the Batch grid, a linked cell is shaded and its accessible name includes the token path. Typing, picking, pasting or filling over a linked cell makes a custom value that remembers the link, as in a tool sidebar. Cell copy and CSV export carry the value shown, not the link. Rows opened from saved sessions keep the session's theme choices and links, and render with those choices.

## Review a change

::: timeline
- <!--i:pentool--> **Make the change.** Edit a token, generate a scale from a recipe, or bring in an updated file from upstream.
- <!--i:search--> **Read the review.** It lists what you changed and every resolved value that moves because of it, and can render a real piece before and after.
- <!--i:check--> **Apply or discard.** **Apply reviewed change** commits it through the usual saving and undo. **Discard preview** writes nothing.
:::

Source edits, generated scales and upstream comparisons capture the document as it is. The review shows the changes you wrote and the resolved values that change because of them. A token edit, a system switch or a change to a referenced resource in the meantime makes **Apply** unavailable.

When a production host is available, the review can render one existing poster, title slide, content slide or Chart before and after. Renders run one at a time, with a cancel and a deadline, and the shared comparison controls handle alignment and the noise threshold. A result describes those two outputs, not every theme combination or every document.

Registered recipes generate colour ramps, pixel spacing scales and modular type scales. A recipe's settings, version, outputs and overrides travel in the Lolly extension, and its outputs stay ordinary DTCG tokens that older readers can use. Regenerating keeps recorded local overrides and refuses to overwrite a hand-made token.

```sh
lolly system diff incoming.tokens.json --file=local.tokens.json --json
lolly system generate --recipe=recipe.json --file=local.tokens.json --output=candidate.tokens.json
lolly system sync incoming.tokens.json --base=earlier.tokens.json --revision=release-42 --json
```

`sync` compares base, local and incoming, and records the source revision and digests. By default it only reviews. `--apply` updates the active terminal system after a revision check, conflicts need `--keep-local`, and external files take `--output`. The web review accepts exact earlier and incoming JSON files; each conflict shows the earlier, local and incoming definitions and needs **Keep local** or **Use incoming** before **Apply**.

::: details Fonts in a published version
New font pins made when you publish a version locally record family, weight, slant and subset. Replacing or deleting a pinned face keeps its exact bytes in the existing copy-on-write store. Web rendering uses separate release family names for CSS and vector shaping, and the Node resolver checks the pinned bytes and supplies variable weights and subset fallback faces.

Missing or changed bytes for these pins fail visibly. Portable snapshots keep the family names as authored, and worker rendering uses a separate release projection. Earlier pins that only recorded names keep their old behaviour. The guarantee covers declared local faces you pinned; it does not promise identical raster bytes across platforms or pin every platform font.
:::

## Find what uses a token

The inspector's **Used by** list covers references inside the token document. Below the list, **Check saved work and tools** looks for the selected token in two more places on this device: saved sessions in this browser, and the tool manifests in the mounted catalog. One check covers every token in the workspace, so choosing another token shows its results without checking again. The check runs only when you ask, can be cancelled and writes nothing.

- **A saved session counts** when one of its inputs, Design layer properties, rich-text run colours or composed paragraph settings links the token. A session that keeps a custom value but remembers the link is counted separately. Sessions in the Trash, project templates and discarded drafts are left out.
- **A tool counts** when the token is the default of a colour or number input or block field, or a value in one of its examples.

Counts cover direct links only: a session that links another token which reads the selected one is counted under that other token, which **Used by** shows. Each count says how many sessions or tools were read, and anything that could not be read, or fell past the size limits, is reported as not counted rather than as zero.

Shared projects, other devices, earlier versions in History, the defaults of tools added from files and values that hooks compute are outside the check. A result describes this device at the time shown. When saved sessions change afterwards, the section notes the change and offers **Check again**. Sessions also record which design system was active when they were saved, so the result separates sessions saved with this system from those saved with another.

[Components](/#/components) shows the workspace, the context strip and linked fields in their linked, custom, unresolved, mixed and read-only states.
