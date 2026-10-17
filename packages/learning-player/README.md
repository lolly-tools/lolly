# Learning player

The browser runtime for portable learning modules. The engine owns module validation,
completion rules and content compilation. This directory owns DOM presentation, LMS
adapters and package assembly. It is imported by the web and CLI shells; it does not
add DOM or LMS dependencies to the engine.

`src/bundle.ts` serializes self-contained functions into the exported player. A test
builds the production-minified factory and executes its emitted JavaScript, so closed
over bundler bindings cannot silently break downloaded packages. Progress encoding,
decoding and reduction use the engine functions in author preview and LMS launches.

Targets are explicit: `static`, `scorm12`, `scorm2004`, `tincan`, `cmi5`. One module is one SCO
or AU. All required lessons need acknowledgement followed by Finish. No scores or
success status are invented. Preview uses an in-memory adapter and sends no records. Schema 2 adds semantic rich text and practice quizzes, with submitted choices in the compact bookmark. The player builds native text and quiz controls using the frozen design-system presentation. Practice feedback never sets a grade or gates lesson acknowledgement. Schema 1 remains supported.

Static delivery uses IndexedDB with a course, release and URL path key, optimistic
transaction conflict detection and a visible in-memory fallback if storage cannot
open. The v1 `lolly:learning-progress` event observes successful saves; it carries
no identity and performs no server delivery. See [the integration contract](../../docs/learning-integration.md).

SCORM uses parent/opener API discovery, checked reads/writes/commits, compact
suspend data, bookmarks, session time and idempotent termination. Tin Can uses its
launch parameters; cmi5 fetches a launch token and reads `LMS.LaunchData`. xAPI state
uses the launch actor, activity and registration with conditional ETag writes.
Statement retries retain their original ID and timestamp. Credentials are read at
launch, held in memory, and excluded from package content.

Unsent xAPI statements and progress are kept in IndexedDB under the attempt: LRS
endpoint, activity, learner and registration. The record never holds the
authorization, the launch URL or the cmi5 fetch URL. A later launch of the same
attempt replays the record only after its own authorization succeeds, statements
first and in their original order. cmi5 statements replay only in the session that
made them; another session's are dropped rather than relabelled, and a session that
had already queued `terminated` delivers it and refuses to continue. Recovered
progress replaces the LRS document only when that document is unchanged since the
copy was made, so newer progress from another device wins. Review and browse
launches keep that progress for a later normal launch. A statement the LRS refuses
outright is dropped rather than retried at every launch; an authorization failure
keeps the record for a later launch. Without storage, retries last only while the
page stays open.

The xAPI targets are experimental. There is no automatic credential renewal or
standalone hosted xAPI delivery. The browser record is a recovery aid for one
browser profile, not a learner record store. Browser unload cannot guarantee a
network write; Save and exit is the supported reliable exit.
Actual Litmos, Moodle and partner acceptance, and full cmi5 conformance testing,
remain release gates. Local adapter and browser tests are not LMS certification.

Specification references: [cmi5 Quartz](https://github.com/AICC/CMI-5_Spec_Current/blob/quartz/cmi5_spec.md),
[Tin Can launch convention](https://github.com/RusticiSoftware/launch/blob/master/lms_lrs.md).

Run the deterministic module, package and adapter tests with:

```sh
node --import ./tests/css-stub.mjs --test tests/learning.test.ts tests/learning-authoring.test.ts tests/learning-xapi-recovery.test.ts
```

Creator instructions: [training-creators.md](../../docs/training-creators.md).
