# Text in Design

Set a headline, flow a long article across frames and pages, or curve a line of type around a badge, all directly on Design's canvas. The text bar holds font, size, weight, colour, emoji and paragraph controls, and the Inspector offers the same settings. A scope caption tells you whether a change affects the selected text, its paragraphs or whole stories.

Emoji come from the chosen **Emoji set** (Twemoji, OpenMoji, Fluent, Noto or Blobmoji) rather than your computer's font, so an export draws the same picture on every device, and each export credits the glyphs it uses ([Creative rights and credits](/info/creative-rights.html)).

## Headings and paragraphs

Press **T**, then click for text that grows with its content, or drag to make a fixed frame. Double-click existing text to edit it. **Enter** starts a paragraph; **Shift+Enter** inserts a line break within the paragraph. **Done** finishes editing. Escape closes the current popover first, then cancels the text edit.

Ordinary typing, paste and the emoji picker preserve your literal text. Formatting does not replace spaces, change quotes or insert hyphens into the source. **Typography cleanup** previews optional changes before applying them. **Focus text** quietens unrelated artwork while you edit.

Number fields work as everywhere in Design; see [Layout in Design](/info/design-layout.html#precise-numbers-and-the-view).

Use **Paragraph > Composition** to choose Standard, Best paragraph or Balanced heading. Best paragraph considers line endings across the paragraph. Balanced heading prefers similar line lengths. **Avoid short last line** discourages a lone final word. Explicit line breaks and unbreakable text still take priority. If the constraints cannot fit, the text remains available and the frame shows overflow.

Try **Field notes** in the template picker's **Publishing** filter. Its article lives in one frame with two balanced columns.

![Field notes combines a large heading with one editable article in two balanced columns.](/t/url-shot?url=%2Fdesign%3Ftemplate%3Dpublishing-field-notes%26_sel%3Darticle&width=1200&height=840&dpi=96&waitMs=3000&format=svg&walker=1&chrome=1&filename=publishing-columns&try=1&waitSelector=svg%5Bdata-text-frame%3D%22article%22%5D&drive=press%3A0%3Bwait%3A600&css=.fc-toolbar-dock%7Bvisibility%3Ahidden%21important%7D)

## Flow an article through frames

A story is one continuous source with an ordered set of text frames. Select a frame and choose **Continue text**. Create a linked frame by dragging on the canvas, or choose an existing text frame from the target list. Joining two nonempty stories shows their proposed order before you apply it.

Frame options control size, insets, columns, vertical alignment, baseline grids and optional fitting. Linked frames keep fixed dimensions. Resizing one changes where the article continues. Hidden frames retain their place in the story. A locked frame keeps its geometry.

Deleting a frame keeps its text. Deleting the last frame offers **Place text**, where you can edit the whole story or place it again. **Delete story and frames** is the separate action that removes source. Copying selected frames copies their settled visible text into independent stories; **Copy entire story** includes text beyond the last frame.

To keep an article readable at a frame boundary, open **More paragraph settings** and adjust the minimum lines before and after a break, or keep the paragraph with following lines. Overflow findings point to the affected text. Enlarge the frame, continue the story, or relax the conflicting setting.

![The long read continues one article through three linked text frames across two artboards.](/t/url-shot?url=%2Fdesign%3Ftemplate%3Dpublishing-long-read%26_sel%3Dopening&width=1200&height=840&dpi=96&waitMs=3000&format=svg&walker=1&chrome=1&filename=publishing-linked-frames&cropSelector=.tool-stage&try=1&waitSelector=svg%5Bdata-text-frame%3D%22closing%22%5D&drive=press%3A0%3Bwait%3A600&css=.fc-toolbar-dock%7Bvisibility%3Ahidden%21important%7D)

Open **The long read** under **Publishing**. Add a sentence in the opening frame to see the same story reflow into the two frames on the next page.

## Text on a path

Use **Add > Text on a circle** or **Text on a path**. You can draw a guide or attach a text object to a selected path. The text owns an editable copy of that guide. Edit its points, drag the path handles, or enter precise start, end and baseline values.

Natural spacing keeps the authored type size. **Fit to path** scales it to the chosen interval. Reverse changes the guide direction, and Flip side changes the side of the baseline. Neither reverses the source text. Detaching returns ordinary text and can keep the guide as a separate shape.

A path accepts one paragraph and one continuous open path or closed contour. A closed path uses at most one traversal. Ambiguous guides and unsupported settings are refused with an explanation. Long text remains editable beyond the endpoint.

![Type in orbit keeps circular lettering and a curved closing line as editable text on separate guides.](/t/url-shot?url=%2Fdesign%3Ftemplate%3Dpublishing-type-in-orbit%26_sel%3Dcircular-type&width=1200&height=840&dpi=96&waitMs=3000&format=svg&walker=1&chrome=1&filename=publishing-text-path&try=1&waitSelector=svg%5Bdata-text-frame%3D%22circular-type%22%5D&drive=press%3A0%3Bwait%3A600&css=.fc-toolbar-dock%7Bvisibility%3Ahidden%21important%7D)

Use **Type in orbit** in **Publishing** to try both closed and open guides. Select the ring of text, open **Path options**, and adjust its start or baseline.

## Typography and wrapping

**More character settings** exposes supported font axes, named instances and OpenType alternatives. Preview an alternative before choosing it. Tracking, baseline shift and display case affect appearance while preserving source. Named paragraph and character styles can inherit from another style; changing a definition updates its uses.

**More paragraph settings** contains spacing, indents, tabs and leaders, rules, optical margins, drop capitals and language-specific hyphenation. Automatic hyphenation supports English (US and UK), French, German and Spanish. The dictionaries are bundled for offline use.

Select another object and use **Text wrap** to keep text away from its bounding box or an admitted closed contour. Wrapping applies to text frames on the same artboard. Preview the offsets, then apply them. Unsupported clipped or painted contours offer bounding-box wrapping instead.

## Convert text or emoji to editable vectors

Select a range or text object, choose **Convert to paths**, and review the preview. You can convert text, emoji or both. **Keep editable copy** retains hidden source. Whole objects become paths whose points you can edit; a converted range becomes inline vectors with fixed advances and retained source meaning. Use **Ungroup** to separate a converted object into individual paths, and **Group** to collect selected parts again. Solid glyphs and emoji pieces have their own selection bounds and ordinary fill controls. Gradients, strokes and clips retain their paint; their points remain editable. Groups whose shared opacity or clipping cannot be separated without changing the picture stay together.

For a linked frame, **Duplicate appearance** preserves the original flow. **Detach and freeze visible text** removes that settled range from the thread and recomposes the remaining text. Both are undoable. Turn off split-text animation before converting. Unsupported paint or a partially selected shaped cluster must be resolved before conversion.

A hidden source copy does not need its font to export the converted artwork. Showing that copy again checks its pinned font before it can render.

## Share and export

Saved sessions, share links, portable `.lolly` files and generated tools keep the written text and the identity of each font. User fonts follow the portable file's asset rules. A missing or changed font is reported; Lolly does not quietly swap in a different face. The editor uses the first face in a font file, so for another face in a font collection, choose a separate font file; layout and export can still use a pinned collection face.

SVG, PDF, raster exports and Sequence frames all use the same letter shapes. In PowerPoint and Penpot, composed text arrives as vector artwork rather than editable text, so keep the Lolly document for wording changes. dotLottie refuses text, audio and converted vectors with independent paint; use MP4 or WebM for those.

Export waits for the current text layout. Overflowing text needs a layout fix, or the explicit **Export visible text only** choice, which leaves clipped and unplaced text out of the picture while keeping it in the document.

::: details Collaboration, recovery and limits
Collaboration syncs the whole text document; it does not merge simultaneous edits character by character. An incomplete story or frame update pauses editing and export. **Previous text** keeps a limited number of recovery copies until the document closes. An incoming edit during input-method composition keeps the received text and offers your conflicting draft to copy or download. If a frame is hidden or removed while you compose, editing closes and the unfinished draft stays available for recovery; copy or download it before closing the document.

A story holds up to about 65,000 characters (65,536 UTF-16 units), and a document up to 128 stories, 256 named styles and 8 MB of text. Layout, path geometry and caches have further limits. If a share link grows too large, use an editable file instead. The [engine text guide](/info/build/text-composition-engine.html) has the layout contract and its limits.
:::
