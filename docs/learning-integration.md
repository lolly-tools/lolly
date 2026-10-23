# Learning integration

This page is for developers who host Lolly courses, connect them to another platform or build course packages from a script. It sets out what a course package contains, how website progress is stored and reported, the versioned browser event a host page can listen for and the command-line build. Course creators start with [Build a course](/info/training-creators.html) and [Deliver and update a course](/info/training-delivery.html).

A learning module is a versioned course document. The engine validates it and compiles finished content through renderers and asset resolution the shell supplies. The player runs that compiled content in the preview, in static website packages, in SCORM 1.2 and SCORM 2004 4th Edition packages and in the experimental Tin Can and cmi5 packages.

Course packaging belongs to the module, not to each tool. Tools expose the media formats they support, and the shell derives the available course renditions from those formats, the device's codecs and the export policy, so no tool implements an LMS runtime. Folder and selection export first accounts for every candidate and asks for an explicit teaching order. The compiler never leaves out an unavailable required source.

## Website delivery today

Serve every extracted package file from the same static HTTP(S) directory. `index.html` loads the local player and media without a Lolly service. All paths are relative. A normal link or an iframe can launch the course. Serve HTML, JavaScript, CSS and media with their normal content types. No service worker or offline installation is included.

The static adapter stores progress in IndexedDB. Its key includes the current origin's URL path, module activity and release. Browser profile isolation, site-data deletion, private browsing and third-party iframe restrictions apply. Simultaneous writes from another tab cause an explicit conflict rather than silently overwriting a newer attempt. An inability to open storage produces a visible session-only fallback. A later failed write stays a visible failure with a retry; it does not claim a durable save.

The host platform controls access to the files. This release supplies no learner identity, accounts, enrolment, grades, analytics endpoint or server progress record. It does not ask the creator for LRS credentials. Use an LMS target when the receiving LMS owns those responsibilities.

## Rich text and practice questions

Learning document schema 2 adds `richText` to text blocks and the `quiz` block kind. Schema 1 remains supported. `packages/core/schema/learning-module-v2.schema.json` describes the new document, and `parseLearningModule` also checks identifier uniqueness, section references, document size and tree limits. The current completion policy is unchanged.

Rich text is a bounded semantic document: paragraphs, two heading levels, lists, quotes, line breaks and inline emphasis or links. The player builds native elements from this tree without treating author text as HTML. Styling comes from the frozen presentation, not inline author CSS. The `text` field remains a plain text fallback; `richText` is authoritative when present.

A quiz supplies a prompt, `single`, `multiple` or `true-false` mode, two to eight choices with stable local identifiers and `correct` flags, and feedback. Quiz blocks have no media source. Submitted choices are kept in `LearningAttempt.quizAnswers` under the block identifier. They are practice records, not grades; the player does not emit SCORM score fields or xAPI scored interaction statements.

Successful static saves include quiz choices in IndexedDB, while the public progress event keeps its completion-only fields.

::: details How quiz answers fit the attempt tuple
The compact v1 attempt tuple accepts an optional sixth field holding two hexadecimal digits per quiz, in compiled order. Each bit marks a selected option, and `00` means no submitted answer. The largest document, 1000 blocks, fits within the existing 4096-character suspend limit. Old tuples stay readable, and bookmarks from another release are discarded.
:::

## Browser progress event, version 1

After a successful static progress save, the player dispatches a DOM `CustomEvent` named `lolly:learning-progress` on its own `window`.

![The player saves progress to the browser's IndexedDB, then dispatches lolly:learning-progress on its own window, where a same-origin host page can listen. A host on another origin cannot receive the event.](/info/diagrams/concepts/learning-progress.svg)

`detail` follows the SDK's `LearningProgressEventV1` type:

```ts
interface LearningProgressEventV1 {
  version: 1;
  moduleId: string;
  releaseId: string;
  lessonId: string;
  acknowledged: string[];
  completed: boolean;
  persistence: 'browser' | 'session';
}
```

`lessonId` is the current location. `acknowledged` contains lesson identifiers, including optional lessons when acknowledged. `completed` becomes true only through the required-lesson policy and Finish. `persistence` states whether that save used browser storage or the open page's memory.

Navigation, acknowledgement, checked practice answers, periodic saves, Finish and Save and exit can emit the event. The event contains the completion and location fields of the current attempt, so consumers must tolerate repetition. It has no guaranteed delivery, replay, initial-load event, unique event identifier or cross-device ordering. Event details are copied from player state; listeners cannot modify the player by changing them. This contract observes saves. It supplies no command to restore, reset or remotely complete an attempt.

A same-origin host can listen inside its iframe after load:

```js
const frame = document.querySelector('iframe[data-learning-course]');
frame.addEventListener('load', () => {
  frame.contentWindow.addEventListener('lolly:learning-progress', event => {
    const progress = event.detail;
    if (progress?.version !== 1) return;
    // Update local host presentation using validated progress fields.
    // Authenticated server records need a separate integration.
  });
});
```

Use a same-origin iframe without an opaque sandbox origin for this pattern. DOM events do not cross iframe boundaries automatically. There is no cross-origin `postMessage` protocol in this release. A host should not depend on the player's IndexedDB name or internal encoding; those are implementation details.

The event is untrusted client input. It establishes neither learner identity nor proof that a person paid attention. It contains no learner name, email, token or authoring inputs. A listening integration owns any further collection or transmission.

## Experimental xAPI recovery

The Tin Can and cmi5 players keep unsent statements and progress in the browser's IndexedDB where storage allows, so a later launch can still deliver what a dropped connection or a closed page left behind. The record belongs to one attempt: the LRS endpoint, activity, learner and registration. It never holds the xAPI authorization, the launch URL or the cmi5 fetch URL.

A later launch of the same attempt replays the record only once that launch is authorized, following these rules:

- **Authorization first.** The player reads the attempt's progress document to confirm the new authorization before sending anything.
- **Order is kept.** Recovered progress is written first. Older statements keep their original identifiers and timestamps and are sent in the order they were made, before the new launch's own statements.
- **Each cmi5 session sends its own statements.** Every statement records the session that made it, and only a page of that session sends it, under that session's token. With two pages of one registration open at once, each sends only its own. A new session drops statements from earlier sessions and never relabels them. A session that had already queued its terminated statement delivers that statement and refuses to continue.
- **Newer progress wins.** Progress written during an outage replaces the LRS document only when that document is unchanged since the browser copy was made, so newer progress from another device wins. Review and browse launches keep that progress for a later normal launch.
- **Refusals are handled by kind.** A statement the LRS refuses outright is dropped instead of holding back later records. A 401 on any statement means the credentials were refused, so the whole record stays for a later launch and the current launch fails. A 403 on an older statement sets that statement aside, and it is dropped only after the LRS accepts one of the new launch's own statements; if the new launch is refused as well, every record stays.
- **Completion is not lost.** A learner who completes the module after a failed exit still has the completion sent before the terminated statement.

The record is a recovery aid, not a learner record store. It stays in one browser profile, site-data deletion or private browsing can remove the record, and the LMS remains authoritative. When storage cannot open, retries last only while the page stays open.

## Build courses from the command line

The CLI uses the same module compiler and learner player as the app:

```sh
pnpm run cli learning check module.json
pnpm run cli learning build module.json --format=scorm12 --output=course.zip
pnpm run cli learning build module.json --format=static --output=website.zip
```

`--format` takes `static`, `scorm12`, `scorm2004`, `tincan` or `cmi5`. The input follows the SDK's `learning-module-v1.schema.json` for original courses, or `learning-module-v2.schema.json` for formatted text and practice quizzes; the editor upgrades a draft to schema 2 when either feature is added, and schema 1 drafts and saved packages stay readable. The build refuses to overwrite an existing output file. Use `--json` for a machine-readable result with the checksum.

Content can come from two kinds of source:

- **A saved tool session.** The CLI renders the session with the installed tool, in the block's chosen rendition. These renders carry no Content Credentials or Imprint. Still pages render each page of a paged or framed document on its own, at that page's size, and a `pageIds` list renders only the listed frames, in that order. A session saved with a different tool version renders with the installed version, and the build prints a note.
- **A local file.** Set the asset source's `url` to a relative path beside the module JSON, with its `format` matching the file. The command reads only files inside that directory, symbolic links included.

Some sessions cannot be reproduced in a terminal, and the build stops with the reason instead of packaging something different:

| Stop | What to do |
| --- | --- |
| The tool has no export for the block's content type | Choose another rendition in the editor, or export a finished file and use it as a local file source. |
| The tool's export is a format the CLI cannot package | Choose another rendition in the editor, or export a finished file and use it as a local file source. |
| The session uses a file uploaded on the device that saved it | On that device, export the content and use the exported file as a local file source. |
| The session points an image at a path on this computer | Use a local file source for that content instead. A saved session never reads a file by its path. |
| A video block, and no browser renderer is installed | Run `lolly install-browser`, or set `LOLLY_BROWSER_CHANNEL=chrome` to use an installed Chrome. You can also export the video in the editor and use the file. |
| A video from frames of different sizes | Make the frames the same size, or export the video and use the file. |

A stop exits with the CLI's usual codes: 2 when only a change to the module can fix the source, and 3 when this installation cannot render the source. The message starts with the lesson title.

A saved session can draw on work that asks for a credit, such as an emoji set under CC BY. Because these renders carry no Content Credentials, the credit is not in the file. The build still writes the package, prints a Rights block with the credit text for each such session and exits with 4. With `--json`, `ok` is `false` and `result.rightsDecisionsRequired` lists the content blocks. Add each credit where the course shows that content before you share the course.

## Future platform adapter boundary

A future custom-platform adapter can reuse the module, compiled payload, completion reducer and player. It must define authenticated launch, learner and attempt identity, release pinning, server read/write semantics, conflict handling, retries, expiry and a verified finish acknowledgement. The receiving platform owns consent and retention rules for its records. Versioned capability negotiation must be additive; static export must continue to work without that adapter.

Cross-origin hosting will need a separately versioned message protocol with an explicit allowed origin and validated messages. Do not use wildcard destinations for learner records or place permanent secrets in the package. Shared authorship, review and retained artifacts in Lolly Work are separate from learner delivery and do not require Work to become an LMS.

## Package verification

The export preflight freezes the course and prepares the actual ZIP before publication. The final compressed size is checked against the author-supplied destination limit. Changing the draft or destination invalidates readiness. A saved version stores its exact artifact and checksum. Another target uses its frozen content and media, and an existing target downloads its existing bytes.

Static browser integration tests cover resume, completion, storage conflicts, release isolation and the observation event. The LMS adapters have local lifecycle and package tests, and the xAPI recovery tests replay records across simulated page loads. Acceptance in a real LMS tenant has not been completed, and the experimental xAPI output makes no conformance claim.
