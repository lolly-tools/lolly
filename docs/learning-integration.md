# Learning delivery and integration

A learning module is a versioned course document. The engine validates it and compiles finished content through shell-supplied renderers and asset resolution. The player consumes that compiled content in preview, static website packages, SCORM 1.2, SCORM 2004 4th Edition, experimental Tin Can and experimental cmi5 packages.

Course packaging belongs to the module. Individual tools expose supported media formats; the shell derives the available course renditions from those formats, device codecs and export policy. Tools do not each implement an LMS runtime. Folder and selection export first accounts for every candidate and obtains an explicit teaching order. The compiler never omits an unavailable required source.

See [the creator guide](training-creators.md) for the authoring and handoff journey.

## Website delivery today

Serve every extracted package file from the same static HTTP(S) directory. `index.html` loads the local player and media without a Lolly service. All paths are relative. A normal link or an iframe can launch it. Serve HTML, JavaScript, CSS and media with their normal content types. No service worker or offline installation is included.

The static adapter stores progress in IndexedDB. Its key includes the current origin's URL path, module activity and release. Browser profile isolation, site-data deletion, private browsing and third-party iframe restrictions apply. Simultaneous writes from another tab cause an explicit conflict rather than silently overwriting a newer attempt. An inability to open storage produces a visible session-only fallback. A later failed write stays a visible failure with a retry; it does not claim a durable save.

The host platform controls access to the files. This release supplies no learner identity, accounts, enrolment, grades, analytics endpoint or server progress record. It does not ask the creator for LRS credentials. Use an LMS target when the receiving LMS owns those responsibilities.

## Rich text and practice questions

Learning document schema 2 adds `richText` to text blocks and the `quiz` block kind. Schema 1 remains supported. `packages/core/schema/learning-module-v2.schema.json` describes the new document, and `parseLearningModule` also checks identifier uniqueness, section references, document size and tree limits. The current completion policy is unchanged.

Rich text is a bounded semantic document: paragraphs, two heading levels, lists, quotes, line breaks and inline emphasis or links. The player builds native elements from this tree without treating author text as HTML. Styling comes from the frozen presentation, not inline author CSS. The `text` field remains a plain text fallback; `richText` is authoritative when present.

A quiz supplies a prompt, `single`, `multiple` or `true-false` mode, two to eight choices with stable local identifiers and `correct` flags, and feedback. Quiz blocks have no media source. Submitted choices are kept in `LearningAttempt.quizAnswers` under the block identifier. They are practice records, not grades; the player does not emit SCORM score fields or xAPI scored interaction statements.

The compact v1 attempt tuple accepts an optional sixth field containing two hexadecimal digits per quiz in compiled order. Each bit identifies a selected option; `00` means no submitted answer. The maximum 1000-block document fits within the existing 4096-character suspend limit. Old tuples remain readable, and bookmarks from another release are discarded. Successful static saves include quiz choices in IndexedDB, while the public progress event keeps its existing completion-only shape.

## Browser progress event, version 1

After a successful static progress save, the player dispatches a DOM `CustomEvent` named `lolly:learning-progress` on its own `window`. `detail` follows the SDK's `LearningProgressEventV1` type:

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

A later launch of the same attempt replays the record only after that launch is authorized. It first reads the attempt's progress document to confirm the new authorization. Statements keep their original identifiers and timestamps and are sent in the order they were made, before the new launch's own statements. cmi5 also matches the session: statements from another session are dropped and never relabelled, and a session that had already queued its terminated statement delivers that statement and refuses to continue.

Progress written during an outage replaces the LRS document only when that document is unchanged since the browser copy was made. Newer progress from another device therefore wins. Review and browse launches keep that progress for a later normal launch. A statement the LRS refuses outright is dropped instead of holding back later records. An authorization failure keeps the record for a later launch, except for an older statement that a newly authorized launch is still refused permission to send.

The record is a recovery aid, not a learner record store. It stays in one browser profile, site-data deletion or private browsing can remove the record, and the LMS remains authoritative. When storage cannot open, retries last only while the page stays open.

## Future platform adapter boundary

A future custom-platform adapter can reuse the module, compiled payload, completion reducer and player. It must define authenticated launch, learner and attempt identity, release pinning, server read/write semantics, conflict handling, retries, expiry and a verified finish acknowledgement. The receiving platform owns consent and retention rules for its records. Versioned capability negotiation must be additive; static export must continue to work without that adapter.

Cross-origin hosting will need a separately versioned message protocol with an explicit allowed origin and validated messages. Do not use wildcard destinations for learner records or place permanent secrets in the package. Shared authorship, review and retained artifacts in Lolly Work are separate from learner delivery and do not require Work to become an LMS.

## Package verification

The export preflight freezes the course and prepares the actual ZIP before publication. The final compressed size is checked against the author-supplied destination limit. Changing the draft or destination invalidates readiness. A saved version stores its exact artifact and checksum. Another target uses its frozen content and media, and an existing target downloads its existing bytes.

Static browser integration tests cover resume, completion, storage conflicts, release isolation and the observation event. The LMS adapters have local lifecycle and package tests, and the xAPI recovery tests replay records across simulated page loads. Live SUSE Litmos and partner acceptance remains required; experimental xAPI output is not a conformance claim.
