# Design tool contract

Design-generated tools are ordinary manifest/template/hook bundles. The pure compiler is `engine/src/design-tool/compiler.ts`; the versioned declarations and evaluator live in `packages/core/src/design-tool-v1.ts`.

The web shell owns file imports, font and asset resolution, measurements, persistence and the Rules interface. The engine owns input validation, declarative property evaluation and export permissions. No brand or browser service is added to the engine.

## Authoring and compilation

A `DesignToolDraftV1` contains stable input ids, ordered fields, artboards, exact property targets, common input meanings, named choices and bounded text recipes. Its saved-session metadata is `__designTool`. An imported source PDF is separate `__designToolSource` metadata and never travels in the generated tool. That author-only record also holds selected source pages, conversion findings and whether the author reviewed them. Replacing a source clears its review. Share preparation checks review findings before resolving dependencies; the independent font, image and layout checks still apply.

A resolved `DesignToolDefinitionV1` adds a compiler version, renderer digest, scoped CSS and dependency digests. The shell resolves original fonts and images before invoking the compiler. The compiler produces `tool.json`, `template.html`, `styles.css`, `hooks.js`, `compilation.json` and dependency files. Inputs are explicit; private object arrays are never declared as reader inputs.

`community/_shared/design-renderer.js` contains shared renderer regions. `scripts/build-design-tool-renderer.ts` joins the ordered canonical regions with the declarative evaluator. Run `pnpm run build:design-renderer` after changing either source and `pnpm run check:design-renderer` to check drift. Ordinary Design and generated tools use the same compute helpers.

Generated hooks run with the existing strict sideload worker. They rebuild a variant from its immutable definition, then apply one atomic choice and input evaluation. There is no privileged in-realm fallback. Text inputs are literal; a text recipe joins declared text inputs and literal separators without evaluating code.

Dynamic variants retain authored boxes and an optional `layoutTracks` collection. The compiler validates ownership and track records and uses the same modern Rust solver through `host.layout`. Content controls can change intrinsic text and image sizes without replacing authored geometry. Computed positions are disposable, and export receipts bind the painted layout to the current input values.

## Tools derived from saved sessions

Engine 1.201 adds optional `sourceTool` provenance to the existing rules policy: source id, source version and a mapping from public input ids to original input ids. `engine/src/design-tool/session-compiler.ts` compiles a captured original manifest, template, styles and hooks. The shell prepares the source bundle, resolves assets, embeds fonts and pins token values. Fixed values are private renderer data; only public aliases are declared as inputs.

The source callbacks run inside the strict worker with their original full input model. Public edits map back to the original ids. Dependency and render failures block export. Source limits may tighten but cannot broaden; numeric steps must align. Pure background export settings are captured, while DOM-dependent export hooks, live callbacks, custom file exporters, module hooks and composition require repair. Profile/state/network reads are not silently redirected to the recipient's data. Source dependencies must be included, and generic text is checked for embedded font coverage before export.

The source copy handoff removes saved-session and publication identity while retaining artwork and export metadata. Saving an authoring session retains its rules under `__designTool`; Projects and Templates never overwrite the source during conversion. Publication, integrity, trust, immutable revision storage and recipient controls use the same path as Design-generated tools.

`tests/session-tool.test.ts` covers strict-worker rendering, private input rejection, bounds, captured export settings, error recovery and copy identity. `tests/session-tool.browser.test.ts` exercises saved sessions and templates through the actual menus, responsive rule authoring and a clean recipient's exports.

## Ownership and constraints

Each property has one writer. Choices can own several properties or select one authored artboard. Explicit `fixedInputs` block reader overrides for that option. Defaults apply only when the reader has not supplied a value; dirty reader content survives choice changes. Independent choices must not contend for a property.

Raw values are validated before normalization can truncate them. Number and percentage ranges include positive steps. Approved lists are enforced by the runtime, independent of the form. A failed change leaves the typed value available for correction and blocks export until corrected. Hosts that cannot measure bounded text report `NEEDS_BROWSER`; they must not export a guessed fit.

The public `designTool` manifest policy carries the ordered rules, choice declarations, dimensions and allowed formats. It does not expose the master object array. Derived formats are not automatically added. Output sizes preserve the selected artboard's proportions. This is a supported editing contract, not encryption or DRM: someone deliberately editing the package can inspect its implementation.

## Package and revisions

`lolly-share` adds `kind: "tool"` with `minReader: 2`. It requires a complete, integrity-covered bundled tool and excludes `session.json`, saved templates and a design-system import. Static session writers remain on reader version 1. Files containing dynamic layout rules require reader version 6; generated tools with those rules also require `host.layout` and engine 1.249. Both the web and Node readers check identity, inventory, paths and digests before installation or use.

Installed Design tools use immutable cache paths under `/tools/<id>/.revisions/<digest>/`. A metadata transaction publishes the revision and current discovery pointer after its files are staged. The same version with different bytes is refused. Saved tool sessions carry `__toolArtifact`; batch and folder rows carry `artifactDigest`. Loading and resharing resolve those exact bytes, not the latest pointer.

The CLI accepts `lolly run <file.lolly> --trust-tool`. It verifies the file, checks public inputs, imports it into a temporary browser context and uses the normal web export route. It does not install it into the person's persistent browser profile.

## Verification and limits

`shells/web/src/lib/pdf-design-nodes.test.ts`, `pdf-font-metrics.test.ts` and `design-tool-source.test.ts` cover clipped paint, character advances and review persistence. `tests/pdf-text-advances.test.ts` covers compatible fragments, CID widths, spacing and separate styles/columns. `tests/design-tool.test.ts` checks compiler/runtime/package contracts. `tests/design-tool.browser.test.ts` exercises authoring, keyboard order, joined names, On-canvas access, clean installation, immutable revisions and offline PNG/SVG/PDF export. Run the browser suite against a current dev or built web shell with `LOLLY_DESIGN_TOOL_TEST_URL`.

The first delivery is still artwork. Motion, custom CSS, incomplete font subsets and SVG images with live text or external content need repair before sharing. PDF and Illustrator conversion still depend on the source file: an original-file comparison and representative designer review are required for a fidelity claim. Automated tests do not establish the plan's five-person usability targets.

## Authoring continuity and optional limits

Engine 1.199 adds optional `DesignTextRuleV1.sharedSize` and `DesignInputV1.image` constraints (`minWidth`, `minHeight`, `formats`). Shared fitting measures each visible target and uses the smallest fitting size across the group, rejecting a result below any target minimum. Raster dimensions and actual image formats are checked by the layout bridge; SVG remains resolution independent. Generated framing markers connect declared vector controls to the shared bounded gesture overlay.

Common inputs support `organization` text and `headshot` images, with `person`, `recipient` and `presenter` subjects. Batch keys include both subject and meaning. Profile prefill remains an explicit choice for first name, last name and email.

Preview samples have separate undo history. The master records a publication digest alongside its rules so unchanged compiled files retain their version after saving and reopening. Source replacement requires an explicit object mapping and preserves public input ids.
