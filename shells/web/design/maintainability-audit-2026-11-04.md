# Maintainability and component staging audit

4 November 2026. Starting revision: `2fd3b26c8`.

## Scope and method

Reviewed 3,774 tracked TypeScript and JavaScript files under `engine`, `packages`,
`shells`, `services`, `scripts` and `community`. An AST scan compared exact
function-body tokens, excluding comments and whitespace, with a minimum of 90
tokens. Tests, declarations, known vendor paths, minified files and locale data
were excluded. Private brand content was outside this scan.

The scan found 333 duplicate-body groups. After removing community tool data and
public bundles from the comparison, 86 groups remained for review. These are
candidates, not 86 confirmed defects: nested functions can overlap, and equal
bodies do not establish equal contracts. Similar implementations with different
identifiers are outside this exact-match scan.

Many large tool copies already have canonical sources in `community/_shared`
and are distributed through `scripts/sync-shared-hooks.ts`. Their self-contained
form is required by the tool loading contract. Keep editing their sources and
checking generated-region drift; introducing runtime imports would break that
contract. The diagram tool also has source assembly files. Generated copies
should be classified before deciding what to consolidate.

The existing web maintainability gate passed at the starting revision:
14 concentrated modules, 13 recorded cycles, 26 upward runtime imports and 778
type escapes across 205 modules. Its scope is `shells/web/src`; a pass does not
assess engine, Node shell or script complexity. Some recorded cycles are single
module references and need individual review before treating them as a fault.

Before committing, local `main` was fast-forwarded to `2a536e135`, incorporating
25 upstream commits without overlapping these edits. The combined gate passes
with 15 concentrated modules. It reports an upstream soft-limit warning for
`views/present-mode.ts` at 1,517 logical lines; this change does not widen the
baseline. The ranked measurements below retain the starting revision's scope.

## Ranked follow-up work

| Priority | Evidence | Recommended boundary |
| --- | --- | --- |
| High | `views/projects.ts`: 2,913 physical lines, with a 2,691-line mount function. `views/color-lab.ts`: 3,624 lines, with a 2,575-line function. `lib/rebrand/controller.ts`: 3,009 lines, with a 2,424-line function. | Use the existing context and feature-module pattern. Split by state ownership, keep lifecycle wiring in the orchestrator and avoid cross-imports between feature modules. These are the next large refactors, with browser checks in their owning views. |
| High | `bridge/index.ts -> views/picker.ts`, plus multiple imports into `views/pdf-import.ts`, participate in a ten-module cycle covering the bridge, importers, picker and render/export code. | Move shared import and chooser contracts below views, inject UI callbacks at the shell composition point, then remove individual upward imports. Do not move DOM work into the engine. |
| Medium | `packages/node-shell/src/sequence-audio.ts:bedDuckEnvelope` and `shells/web/src/bridge/audio-envelope.ts:bedDuckEnvelope` have identical bodies. | Share the pure envelope calculation in the engine; keep decoding, mixing buffers and device APIs in each shell. First compare silence, absent rhythm, overlapping voice and boundary cases across shells. |
| Medium | `packages/node-shell/src/pdf-read.ts:pdfFontWidths` and `shells/web/src/lib/pdf-font-metrics.ts:pdfFontMetrics` have identical bodies. Three font-weight inference helpers also match across Node and TUI. | Share pure PDF metric and font-name interpretation with explicit input types. Keep PDF.js, font loading and raster fallbacks in their existing adapters. |
| Medium | Exact duplicates remain in OPC relationship resolution across DOCX/PPTX/XLSX, affine matrix multiplication across four engine readers, and package content hashing across three packing scripts. | Consolidate one contract at a time. Check path normalization, matrix order and hash file ordering before extracting helpers. Small format-specific wrappers can remain. |
| Medium | The web-only budget misses `engine/src/deck-compile.ts` (5,326 physical lines, largest function 2,416) and `engine/src/runtime.ts` (3,111 lines, largest function 1,879). | Extend measurement to other production roots using a reviewed starting baseline. Keep physical spans separate from the gate's logical-line metric. Do not widen the current web budget. |

Function spans include nested callbacks; they measure concentrated ownership,
not cyclomatic complexity. Counts describe the starting revision and are not a
percentage of removable code.

## Changes completed

- Removed the duplicate guided-collection implementation from picker feedback.
  The existing `picker-guided.ts` owns the workflow; the feedback module preserves
  its public exports for current callers.
- Replaced component-preview context inferred from source filenames with an
  explicit `Specimen.context` contract. Saved rows receive the profile ancestor,
  catalog groups receive the catalog ancestor, and studio navigation receives
  its studio ancestor. Library-only layout rules contain full-page geometry.
- Loaded the actual assets and studio-navigation styles. Gave container-query
  specimens a real width, swatches a grid and ramp context, and the zoom HUD
  sufficient space on phones. Reused production field classes in old samples.
- Replaced empty icon SVGs with real artwork. The fallback respects the app's
  reduced-motion behaviour.
- Made preview renderers and disposers local to each library mount. An old
  cleanup cannot destroy the new editor or close its popovers. Zoom HUD listeners
  are disposed. A view abandoned during palette loading cannot overwrite a
  later route. The loading trigger is correctly labelled interactive.
- Updated the library's audit notes and added regression coverage for production
  style context, overflow, themes, popovers, zoom and repeated mounts.
- Added the production document colourway control as an interactive specimen,
  with choices confined to its own fixture. Tool cards now use `cardMarkup`
  rather than a stale handwritten approximation.

## Verification

The library now has 153 specimens, including the shared document theme choices. Browser checks cover 1440px desktop and
390px phone layouts in light, dark and brand appearances, including every stage's
overflow and render-error state. Representative specimens are visually inspected
in each appearance. All 98 focused unit and primitive checks passed, including
filtering, native Penpot downloads, image fallback, cleanup isolation and picker
workflows. All 13 browser layout checks passed, including the existing application
checks. Web and test TypeScript projects, changed-file lint, maintainability,
code-comment and UI-copy gates passed. Branch hygiene ran in reporting mode.

Host-dependent fixtures remain labelled fixtures. This audit does not certify
their camera, storage or media workflows, nor the native import behaviour of an
exported Penpot file.
