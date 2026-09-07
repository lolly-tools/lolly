# Colour studio review — 7 September 2026

The palette is the workspace. Controls and previews help people choose, organise and use colours without requiring them to learn the token architecture first.

## Research and decisions

- [Adobe’s colour libraries](https://helpx.adobe.com/illustrator/using/creative-cloud-libraries-sync-share-assets.html) put adding, editing, renaming and deleting beside the colours. Lolly now has visible Add swatch and Add group actions, named cards, and a group picker in each swatch editor. Return saves and closes the name field.
- [Coolors’ collection management](https://coolors-help.zendesk.com/hc/en-us/articles/360010537880-Create-and-manage-projects-and-collections) makes creating a collection a direct action. Empty groups now exist as document data and survive reload and shade generation. Rename and Ungroup preserve token keys and role references.
- [NN/G’s recognition guidance](https://www.nngroup.com/articles/recognition-and-recall/) supports visible actions instead of remembered gestures. Checkboxes expose selection to pointer, keyboard and touch; modifier clicks, ranges and marquee selection remain available. Move to works from the first selection, including starter colours.
- [NN/G’s minimalist-design guidance](https://www.nngroup.com/articles/aesthetic-minimalist-design/) supports prioritising the content. Custom groups and individually chosen colours lead; generated ramps follow. Repeated introductions, panel borders and the competing generation offer are removed. Advanced controls remain in quiet disclosures.
- [NN/G’s user-control guidance](https://www.nngroup.com/articles/user-control-and-freedom/) supports reversible exploration. Adding opens a cancellable picker without installing a grey placeholder. Starter colours can be hidden/restored, with visible Undo for group/delete actions. Shade generation retains its review-before-apply step.

## Preview scenes

A poster, analytics card and product card replace the placeholder graphics. All use a consistent 4:3 frame, actual typography, and the engine’s contrast calculation for small text. One large scene is shown with a switcher.

Checked swatches drive the preview; otherwise it uses committed colours, prioritising the committed primary and individually chosen accents. Generator drafts do not silently change it. An empty palette shows an empty state. The scenes remain self-contained vector SVGs shared by Components and its export path; a Penpot-editor import comparison was not repeated in this change.

## Save failure found in Safari

Normal palette autosaves had filled a generic 20-snapshot file-history limit, preventing further edits from persisting. Continuously edited design-system heads now use the studio’s undo/checkpoint/published-version workflow rather than adding generic file snapshots on every autosave. Existing snapshots are retained. Imported versions, published-version assets and ordinary files retain their collision and history limits. Save status/errors are visible, and overlapping saves are queued in order.

## Verification

Real Safari checks covered creating an empty group, seeing Saved, retaining it after reload, adding directly to the group, renaming and closing with Return, and removing the temporary review data. The 390 × 844 responsive view exposed an old tiny-swatch rule and a download bar that covered colours; both were corrected. The mobile palette mirror stays out of the way while the real palette is visible; selection offers a Preview shortcut to reach the scenes.

Regression coverage includes group persistence/rename/ungroup/rebuild, starter hide/restore without broken aliases, direct moves, Enter, cancellation, selection previews, readable text, SVG sanitisation, continuous saves with 20 existing snapshots, preserved file-history/import limits, and the component gallery/export path.
