# Build a course

Turn the designs, slides, videos and handouts in a project folder into a training course. You set the lesson order, add short explanations and practice questions, try the course as a learner, then download a ZIP that runs on your own website or in a learning management system (LMS).

The course is built on your device. You do not need a Lolly Work account, and your learners do not need a Lolly account. The draft and every saved package version stay on your device.

::: note Turn on Training and courses
Courses are off by default. Open **Settings > Feature flags** and turn on **Training and courses** to show learning modules and course exports. Turning the feature off later keeps your saved modules and course versions; turn it on again to carry on editing.
:::

A course holds ordered lessons, formatted text, images, slides, video, audio, downloadable resources and practice quizzes. Practice questions give feedback and can be retried. A learner completes the course by acknowledging each required lesson and choosing **Finish**. Scored assessments, pass marks, branching and certificates are not part of this version.

When the course is ready, [Deliver and update a course](/info/training-delivery.html) covers choosing a format, publishing it and releasing new versions.

## Start from your project

1. Open **Projects**, then the folder that holds your course material.
2. Choose **Export course** and review the folder's content, nested folders included. Imported files, saved tool creations and batch rows appear together. Existing learning modules contribute their lessons, and **Open existing module** exports a module without copying the module.
3. Use the checkboxes to choose content and **Move up** or **Move down** to set the teaching order. Unavailable content stays listed: replace it, unselect it or choose **Exclude unavailable items**. For a long selection, **Find content** locates an item; clear the search before reordering. **Select all** and **Clear selection** apply to the whole list. Enter a course title and choose **Create course from selection**.
4. The course opens in the editor. Review the assembled outline, add explanations, adjust the required lessons or use **Add lesson** for another step. Folder names become section labels. Every imported item starts as required, so review that choice.
5. Open **Course details** to add a description, learning objectives and the content language, as a language tag such as `en`, `en-GB` or `de`. The learner controls are in English for now.

You can also select a mix of project items and choose **Export course**, or choose **Export course** in a supported tool's export controls; the tool saves its current inputs before handing them over. **Create learning module** in Projects starts an empty outline. A course started outside a folder appears with your unfiled work; reopen its **Learning module** tile to carry on editing.

Changes save after a pause in typing, when you leave a field or when you change the outline. Wait for **Saved on this device** before closing the tab, and use **Retry save** when a write fails. If another window has changed the module, keep the current window open and copy your edits before reopening the saved version. **Undo edit** reverses recent draft edits in the current session; it never deletes published versions.

![A learning module with an ordered outline, native lesson text, an image and a downloadable resource](/info/shots/training-module-outline.svg)

## Arrange the course

Each lesson holds one or more pieces of content, and the order in the outline is the order learners see. The outline shows each lesson's content count and marks optional lessons; select a lesson to edit the lesson's content. On a phone, open **Lessons** to organise the outline, and choosing a lesson folds it again so you can edit the content.

Text, questions and media appear directly on the lesson canvas. Click inside text to edit the text. **Content options**, under a visual or recording, holds its source, rendition and accessibility fields.

- Drag the grip beside a lesson to change the teaching order. **Move lesson up** and **Move lesson down** stay in the lesson header.
- Click a content header to select that content. Hold the header or drag its grip to reorder. Command-click on a Mac, or Control-click elsewhere, adds or removes items, and Shift-click selects a range. Checkboxes select content too. Editing text does not select its content block.
- Drag selected content together, or drop it onto another lesson in the outline. **Move to lesson** does the same through a destination picker. Moved content keeps its order and goes to the end of the destination.
- The selection bar duplicates or removes several items. **Clear selection** returns to editing, and **Undo edit** restores recent changes, moves and removals included.
- **Insert content below**, the plus between content items, adds text, designs, media, a quiz or a resource at that position. The buttons at the bottom add content at the end.
- **Lesson options** holds **Section (optional)** and **Required for completion**. Give related lessons the same section name and keep them together. Reference material can be optional.

With a keyboard, focus a content or lesson grip and press Space or Enter to pick it up. Arrow keys, Home or End choose a position, and Space or Enter places it; Escape cancels. The content actions menu also has **Move content up**, **Move content down** and **Remove content**, and focus stays with the item as it moves.

Keep lessons focused. A pattern that works: a short explanation, a demonstration, then instructions for the learner to try the task. The module needs at least one required lesson, and every lesson needs content.

## Format lesson text

Choose **Add text** and write on the canvas. Select text and use the formatting bar for **Bold**, **Italic**, **Underline**, bullet or numbered lists, quotes and links. **Text style** chooses a paragraph, heading or subheading. The usual editing shortcuts work, and Alt+F10 moves focus from the text to its formatting bar.

In the exported player the text stays selectable, with real headings and lists. Links take full `https://`, `http://` or `mailto:` addresses; select a linked phrase and choose **Link** to change or remove the link. Unsupported pasted formatting is removed, and lesson text has no font or colour overrides of its own.

The active design system supplies the authoring colours, fonts and controls, and the learner preview uses its resolved presentation. Saving a course version captures those styles and the fonts it needs with the content, so later profile edits never restyle a package already shared with a customer.

## Add practice quizzes

Choose **Add quiz** after an explanation or demonstration:

1. Choose **Choose one**, **Choose several** or **True or false**.
2. Write the question and answer choices. Single and multiple choice questions take two to eight answers; True or false supplies its two answer labels.
3. Mark the correct answer, or every correct answer for **Choose several**. **Add answer** and the remove control change the choices.
4. Open **Answer explanation** to describe the reasoning. The explanation appears after the learner checks an answer.
5. Use **Preview as learner** to try correct and incorrect responses. **Check answer** gives feedback, and learners can change their choices and try again.

The export check flags empty questions, missing or duplicate answer text and invalid answer keys, and **Fix item** goes straight to the content concerned. Practice answers resume with the saved attempt in a browser or LMS. They never set an LMS score, a pass mark or a completion requirement, and every portable package includes its answer key, so use these questions for learning and rehearsal.

![The course canvas with formatted teaching text and a practice question](/info/shots/training-course-quiz.svg)

## Add designs, slides and media

Choose **Add content** inside the selected lesson. The picker shows the lesson receiving the content and opens its course project when there is one. Browse projects, saved creations, the library or uploads. Each addition updates the item count; choose **Done** when you have what you need. **Create or edit** holds the photo, capture and processing shortcuts available on your device.

Content shows source names, available images, saved thumbnails and media controls on the canvas. A cached thumbnail is shown only when it predates the course capture, so use **Preview course** to check what a saved tool session actually captured. Accessibility text stays separate from the source name.

| Material | Format | How to use it |
| --- | --- | --- |
| Saved Design creation or another saved tool creation | The renditions that tool can export on this device | Pick it from Projects or saved creations. Lolly captures its current inputs. |
| Static slides or a multipage design | Still pages | Keep **Render as: Still pages**. Every exported page appears in that content block, in source order. |
| Animation or a moving design | Video | Select **Render as: Video with motion**. Lolly exports the authored sequence as video, silent animations included. |
| Imported image | PNG, JPEG or WebP; SVG is converted to PNG for the player | Pick or upload the file. |
| Finished video or audio | MP4 or WebM video; MP3, M4A, WAV, Ogg or WebM audio | Pick or upload the file. MP4 is a good starting point for video; test playback in the browsers your learners use. |
| Written teaching material | Selectable text | Choose **Add text**, so learners read real text rather than a picture of text. |
| PDF handout or plain text file | A download link, up to 50 MB locally | Choose **Add resource**. |
| PowerPoint or PDF pages you want to teach from | Still pages | Import them with Lolly's design import, review and save the result, then add that saved creation. A resource PDF is a download, not a slide import. |

The learner's browser must also support the media encoding, so convert anything it cannot play before publishing. A tool with no suitable saved output cannot be added directly: export finished recordings and file-based utility results first, then add the files. Animated GIF and APNG imports need converting to video.

Still pages carry only their visual appearance, so add equivalent explanations as lesson text and nobody has to read an image to follow the lesson. Interactive elements inside a design become part of the exported visual or video, while the learner navigation and completion buttons stay native controls.

## Edit or refresh a source

Under **Content options** for a saved tool creation, **Edit source** opens the original editor. Save there to return to the learning module, choose **Update from source** on the content block and review the update in the learner preview.

The module keeps a captured copy of a saved creation's inputs, and editing the original does not replace that copy by itself. Referenced asset bytes and the installed tool are resolved when you prepare a preview or build a version, so check the final output after changing your library or tools. Batch rows are captured as independent content: add a batch row again from Projects to take in later changes. A saved ZIP already contains its own finished files, so later edits to the project, a source creation, the asset library or the module never change a saved package.

## Make the course understandable and accessible

For images and slides, add a **Description or equivalent explanation**. Use **Decorative image** only when an image adds nothing a learner needs. For a dense diagram, put a fuller explanation in **Add text**.

For video and audio, add a written version of the media in **Read as text**. For video captions, expand **Video captions** and paste reviewed WebVTT text into **Captions (WebVTT)**:

```text
WEBVTT

00:00:00.000 --> 00:00:03.000
Open a terminal and check the system version.
```

Lolly checks the WebVTT header; preview the timing and wording yourself. Include important sounds and relevant visual information in the written version or the lesson text.

Add any required attribution, licence information and disclosure of synthetic narration as visible lesson text. Check that you have permission to distribute the images, fonts, music, footage and other material in the customer's LMS, because a portable package includes copies of the finished media.

Use keyboard navigation in the preview, and check the reading order, descriptions, caption controls, focus visibility and small-screen layout. Automated checks find missing fields; they cannot certify that a course is accessible or that its teaching is correct.

## Preview the learner experience

Choose **Preview as learner**. Lolly prepares the content with the same compiler and player the downloadable package uses; motion takes longer to prepare than still pages.

The preview says **Test preview**. Its progress stays in that preview and is never sent to an LMS; close and reopen it to start another test. **Escape** closes the preview, even after you have used the learner controls.

Learners can move freely through the lesson list. Viewing the last lesson, seeking to the end of a video or downloading a resource does not complete the module. The learner must:

1. Select **Complete lesson and continue** for each required lesson.
2. Select **Finish** once every required lesson is acknowledged.

Optional lessons never block **Finish**. Completion is an acknowledgement, not proof of attention or a scored assessment, and the LMS receives one completion for the module rather than a gradebook item per lesson.

In an LMS launch, **Save and exit** saves the learner's place and ends the session. The player also saves during navigation and every so often while it is open. A browser shutdown or network failure can interrupt the last write, so learners should use **Save and exit** and wait for confirmation, then relaunch from the LMS to continue or review.

## Check and export the course

Choose **Export course** at the top of the course editor. The dialog walks through three steps:

::: timeline
- <!--i:globe--> **Destination.** Search the **LMS or website** list and choose a named LMS, **Website** or **Other LMS**. A named LMS selects its delivery format, and **Delivery format** still lists every standard so an administrator can pick the exact edition the platform accepts. Enter the upload limit in MB when you know it, then choose **Review course**.
- <!--i:checklist--> **Review.** Check the lesson counts, required and optional content, language and completion rule, and resolve the items marked **to fix**; **Fix item** opens the lesson or content concerned. After a repair, **Export course** returns here, and the updated content must pass a fresh check. Review accessibility findings in the learner preview.
- <!--i:box--> **Check and prepare package.** Lolly resolves sources, renders the content and measures the exact ZIP size. A missing source, an unsupported rendition or a size limit stops the check, and no content is ever dropped silently.
- <!--i:download--> **Download.** A successful check shows the exact package size. Review the handoff instructions, enter version notes and choose **Save version and download ZIP**. Lolly stores that exact checked package on this device before asking the browser to download the package.
:::

Keep the ZIP and the **Download handoff report** with your delivery record. The report holds the version, checksum, destination, LMS preset, size and any remaining review items.

The ZIP contains a launch page, the learner player and the finished content; LMS targets also contain the chosen manifest. Learners need no Lolly account, and no authoring credentials are included.

::: details Checking, cancelling and the size limits
The progress job can be cancelled. **Continue editing** closes the dialog while the check carries on, and changing the draft invalidates and cancels that check. Leaving the module cancels an unfinished check; reopen **Export course** to see a completed one. Changing the content, format or destination needs another check, and cancelling never creates a partial package.

After a version is saved, **Download ZIP again** fetches the same finished package. **Download help** has recovery controls, including choosing a save location where the browser supports it, without rendering again. A download request is not proof that the file reached the disk, so check your download location. **Saved versions**, under the editor, recovers a package after you reopen the module.

Local builds support up to 200 lessons and 512 MB of distinct prepared content. Large videos can exhaust browser memory before that size, so split a large course or shrink its finished media when needed. The destination limit is checked against the final ZIP in decimal MB.
:::

## Course materials from your own tools

Covers, badges and handouts for a course can come from a tool you made with [Share with rules](/info/create-a-tool.html#use-it-for-training-materials): teams fill in the approved inputs, and you add the rendered files to the course project.
