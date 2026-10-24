# Design tool contract

A tool made with [Share with rules](/info/create-a-tool.html) is an ordinary tool: a manifest, a template and hooks, compiled from a Design document. This page is for engineers working on that compiler, its package format or the Rules interface. It states which part owns which job, what the compiled tool guarantees and how installed revisions stay fixed.

The pure compiler is `engine/src/design-tool/compiler.ts`, and the versioned declarations and evaluator live in `packages/core/src/design-tool-v1.ts`.

::: cols
## The web shell owns

File imports, font and asset resolution, measurement, persistence and the Rules interface.

## The engine owns

Input validation, declarative property evaluation and export permissions. No brand or browser service is added to the engine.
:::

## Authoring and compilation

A `DesignToolDraftV1` contains stable input ids, ordered fields, artboards, exact property targets, common input meanings, named choices and bounded text recipes. Its saved-session metadata is `__designTool`. An imported source PDF is separate `__designToolSource` metadata and never travels in the generated tool. That author-only record also holds the selected source pages, the conversion findings and whether the author reviewed them; replacing a source clears its review. Share preparation checks review findings before resolving dependencies, and the independent font, image and layout checks still apply.

A resolved `DesignToolDefinitionV1` adds a compiler version, a renderer digest, scoped CSS and dependency digests. The shell resolves the original fonts and images before invoking the compiler, which produces `tool.json`, `template.html`, `styles.css`, `hooks.js`, `compilation.json` and the dependency files. Inputs are explicit; private object arrays are never declared as reader inputs.

`community/_shared/design-renderer.js` contains shared renderer regions, and `scripts/build-design-tool-renderer.ts` joins the ordered canonical regions with the declarative evaluator. Run `pnpm run build:design-renderer` after changing either source, and `pnpm run check:design-renderer` to check for drift. Ordinary Design and generated tools use the same compute helpers.

Generated hooks run in the existing strict sideload worker. They rebuild a variant from its immutable definition, then apply one atomic choice and input evaluation. There is no privileged fallback in the page. Text inputs are literal: a text recipe joins declared text inputs and literal separators without evaluating code.

Dynamic variants keep their authored boxes and an optional `layoutTracks` collection. The compiler validates ownership and track records and uses the same Rust layout solver through `host.layout`. Content controls can change intrinsic text and image sizes without replacing authored geometry. Computed positions are disposable, and export receipts bind the painted layout to the current input values.

::: details Hidden and timed layout members
Flex and grid layouts follow one participation rule. The engine states the rule on `inFlow` in `engine/src/design-layout.ts`, and the solver receives the same two flags for each member. A member leaves the flow in only two cases:

- **Hidden.** The member, or one of its owners, has `hidden` set. It gives up its slot and its grid cell, including a cell it names explicitly, and the other members close the gap. The solver does not place or size it, and Hug sizing leaves it out, so a hidden container keeps its stored size as a hidden group does. A hidden member still follows its owner when the owner moves or a group is resized, and it is laid out again when shown.
- **Absolute.** The member has `layoutAbsolute` set. It keeps its own position inside the container and takes no slot.

Timeline and presentation state never change participation. Start time, duration, the sequence lane, a reversible cut (`ignored`), Enter and Exit transitions, presentation build steps and keyframes apply when the page is painted, not when it is laid out. A timed member keeps its slot for the whole document: before it starts, while it enters, after it exits and before its build step is revealed. Its siblings stay where they are during playback and in presenter mode, and a still export taken at any moment uses the same layout. To let siblings close the gap, hide the member or move it out of the container instead of animating it away.

The solver never receives timing fields, and they are left out of the layout cache key, content-sized text included. Changing them does no layout work: an evaluator that has already laid out the document returns the same geometry without measuring text or calling the solver again.

`tests/design-layout-participation.test.ts` checks start, duration, lane, cut, Enter, Exit, build and keyframe states against an untimed control. It also checks hidden members in flex, grid, nested containers and Hug sizing, and the timeline, presenter and build attributes the shared renderer writes on a member whose slot stays reserved.
:::

## Tools derived from saved sessions

Engine 1.201 adds optional `sourceTool` provenance to the existing rules policy: the source id, the source version and a mapping from public input ids to original input ids. `engine/src/design-tool/session-compiler.ts` compiles a captured original manifest, template, styles and hooks. The shell prepares the source bundle, resolves assets, embeds fonts and pins token values. Fixed values are private renderer data; only public aliases are declared as inputs.

The source callbacks run inside the strict worker with their original full input model, and public edits map back to the original ids. Dependency and render failures block export. Source limits may tighten but never widen, and numeric steps must align. Pure background export settings are captured, while export hooks that depend on the page, live callbacks, custom file exporters, module hooks and composition need repair. Reads of the profile, state or network are never silently redirected to the recipient's data. Source dependencies must be included, and generic text is checked for embedded font coverage before export.

The source copy handoff removes saved-session and publication identity while keeping artwork and export metadata. Saving an authoring session keeps its rules under `__designTool`, and Projects and Templates never overwrite the source during conversion. Publication, integrity, trust, immutable revision storage and recipient controls follow the same path as Design-generated tools.

## Ownership and constraints

Each property has one writer. A choice can own several properties or select one authored artboard. Explicit `fixedInputs` block reader overrides for that option. Defaults apply only when the reader has not supplied a value, and content the reader changed survives choice changes. Independent choices must not compete for a property.

Raw values are validated before normalisation can shorten them. Number and percentage ranges include positive steps. The runtime enforces approved lists, independently of the form. A failed change leaves the typed value available for correction and blocks export until corrected. Hosts that cannot measure bounded text report `NEEDS_BROWSER`; they must not export a guessed fit.

The public `designTool` manifest policy carries the ordered rules, choice declarations, dimensions and allowed formats. It does not expose the master object array. Derived formats are not added automatically, and output sizes keep the selected artboard's proportions. This is a supported editing contract, not encryption or DRM: anyone who opens the package can inspect its implementation.

## Package and revisions

A shared tool travels as a `.lolly` package and installs as a fixed revision:

::: timeline
- <!--i:box--> **Package.** `lolly-share` adds `kind: "tool"` with `minReader: 2`. It requires a complete bundled tool covered by integrity checks, and excludes `session.json`, saved templates and a design-system import.
- <!--i:shieldcheck--> **Verify.** Both the web and Node readers work out the reader version a file needs from its verified payloads, and reject a missing or downgraded gate. Tool identity, inventory, paths and digests are checked before installation or use.
- <!--i:folder--> **Install.** Installed Design tools use immutable cache paths under `/tools/<id>/.revisions/<digest>/`. A metadata transaction publishes the revision and the current discovery pointer after its files are staged. The same version with different bytes is refused.
- <!--i:hash--> **Pin.** Saved tool sessions carry `__toolArtifact`, and batch and folder rows carry `artifactDigest`. Loading and resharing resolve those exact bytes, not the latest pointer.
:::

::: details Reader versions by feature
Flat static session writers stay on reader version 1. Files with dynamic layout rules need reader version 6, and generated tools with those rules also need `host.layout` and engine 1.249. Design pages, page ownership and real nested groups need reader version 7, including values carried in projects or templates and bundled Design manifests that declare those inputs. Group opacity, blend and non-fixed sizing need reader version 8. Legacy flat group tags keep their existing reader gate.
:::

The CLI accepts `lolly run <file.lolly> --trust-tool`. It verifies the file, checks the public inputs, imports the tool into a temporary browser context and uses the normal web export route. It never installs the tool into the person's persistent browser profile.

## Verification and limits

The first delivery is still artwork. Motion, custom CSS, incomplete font subsets and SVG images with live text or external content need repair before sharing. PDF and Illustrator conversion still depend on the source file: a comparison with the original file and a review by a representative designer are needed before claiming fidelity. Automated tests do not measure usability.

::: details Tests
`shells/web/src/lib/pdf-design-nodes.test.ts`, `pdf-font-metrics.test.ts` and `design-tool-source.test.ts` cover clipped paint, character advances and review persistence. `tests/pdf-text-advances.test.ts` covers compatible fragments, CID widths, spacing and separate styles and columns. `tests/design-tool.test.ts` checks the compiler, runtime and package contracts. `tests/design-tool.browser.test.ts` exercises authoring, keyboard order, joined names, On-canvas access, clean installation, immutable revisions and offline PNG, SVG and PDF export; run it against a current dev or built web shell with `LOLLY_DESIGN_TOOL_TEST_URL`.

`tests/session-tool.test.ts` covers strict-worker rendering, private input rejection, bounds, captured export settings, error recovery and copy identity. `tests/session-tool.browser.test.ts` exercises saved sessions and templates through the real menus, responsive rule authoring and a clean recipient's exports.
:::

## Authoring continuity and optional limits

Engine 1.199 adds optional `DesignTextRuleV1.sharedSize` and `DesignInputV1.image` constraints (`minWidth`, `minHeight`, `formats`). Shared fitting measures each visible target and uses the smallest fitting size across the group, rejecting a result below any target's minimum. The layout bridge checks raster dimensions and actual image formats; SVG stays resolution independent. Generated framing markers connect declared vector controls to the shared bounded gesture overlay.

Common inputs support `organization` text and `headshot` images, with `person`, `recipient` and `presenter` subjects. Batch keys include both subject and meaning. Profile prefill stays an explicit choice for first name, last name and email.

Preview samples have their own undo history. The master records a publication digest beside its rules, so unchanged compiled files keep their version after saving and reopening. Source replacement needs an explicit object mapping and keeps public input ids.
