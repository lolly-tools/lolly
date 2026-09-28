# Snippet

Present code or plain text in a desktop window. The default scene is a still
image, so existing sessions retain their appearance.

## Starting templates

Open **New from template** to choose a starting point:

- **Light code**, **Dark code** and **Light note** provide still compositions.
- **Tilted light** and **Tilted dark** add perspective and rotation.
- **Open, type and close**, **Accept a suggestion**, **Select and replace**,
  **Terminal walkthrough** and **Scrolling document** provide timed scenes.

Variant chips offer quieter angles, light themes, shorter timing, longer
replacements and different endings. Animated templates open on a readable
still frame; use **Play** below the window to preview the interaction.
Every sample is editable through the normal inputs. The terminal walkthrough
uses authored text and scene steps.

## Scenes

Choose a scene in **Interaction**:

- **Type and hold** clicks into an open window, types the text and leaves it visible.
- **Open, type and close** opens the window, clicks the text, types, pauses for
  reading and clicks the matching desktop close button.
- **Accept a suggestion** types a chosen percentage of the text, shows the
  remaining text as an authored suggestion and accepts the suggestion.
- **Select and replace** starts with the text visible, selects the first exact
  match and replaces that range. An empty replacement deletes the selection.
- **Custom steps** runs up to 24 actions in their listed order. Each action has
  a duration in seconds. Empty Type text uses the main Text input; Select finds
  the first exact match; Replace needs an existing selection. A suggestion
  inserts its authored text at the caret. Click moves the caret to the end.

Typing can arrive as natural or steady keystrokes, words, lines, or one paste.
Text boundaries preserve joined emoji and combining marks. Prepared emoji
artwork remains in the document as scenes reveal and hide whole glyphs.
Animated scenes keep comments inline; still scenes retain comment callouts.

Use **Text > Long text > Scroll with the caret** to preserve a readable text
size for long passages. **Wrap long lines** also works for stills. Window size
and type size stay fixed during playback. Fit mode keeps every line in the
window and suggests scrolling when the text becomes very small. Line numbers
keep their width and scroll with the text. **Cursor size** scales the mouse
pointer and its text-selection shape from 50% to 250%; the caret follows the
text size. **Window pose** controls rotation
and horizontal or vertical tilt, with space reserved for the projected window.

The preview starts on a still frame. Play starts the scene; the time slider
seeks in either direction. Playback does not start automatically.

## Export

MP4, WebM, GIF and animated WebP use the shell's frame clock. The scene supplies
its natural duration. Changing Duration in the export panel retimes the whole
scene to that length. A still export uses the finished text before closing,
or the exact time chosen with **Still frame (seconds)**. A value of -1 selects
the automatic finished frame. Preview controls never appear in exports.

HTML exports a standalone player with embedded fonts and images, a central Play button, a slim seek bar, replay and fullscreen. Playback starts paused on the authored still frame. Space or K toggles playback, arrows seek, and F opens fullscreen. The same player controls serve Design animations. Snippet has no soundtrack, so its player hides sound controls. The file works offline and uses the same scene evaluator as the preview.

The preview's time and playback state are restored after export. Invalid
selection or replacement steps show a message and refuse a motion export.
Perspective follows the shell's existing export policy: tilted content can
be embedded as a raster inside vector formats.

## Implementation and checks

`hooks.js` compiles serializable document states and timed events. The declared `presentation.js` runtime
evaluates those events directly at a requested time and measures text ranges
for carets, selections and pointer targets. Fit mode sizes the text from the
measured glyph box rather than `scrollWidth`, so every line and the caret stay
inside the code padding with any platform font. Content transforms carry scrolling
into serialized export frames, keeping the text and line numbers aligned.
Export hooks read the mounted
controller, so interactive hooks can continue running in a Worker.

`steps` fields are pinned in `schemas/blocks-wire-order.json`. Input ids and
their URL meanings remain stable. Run:

```sh
node --test tests/snippet-motion.test.ts tests/snippet-motion.browser.test.ts tests/snippet-lengths.browser.test.ts
pnpm run build:catalog:all
pnpm run validate:catalog:all
```
