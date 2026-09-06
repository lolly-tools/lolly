# Component library: UI, UX and token audit

Date: 6 September 2026. Surface: `/#/components`.

The library now presents 143 specimens in 22 families, with a download below every specimen. It is a design reference and an inspection surface for the existing application. Production specimens keep their owning stylesheets; host-dependent designs are explicitly labelled static fixtures.

## Findings and implementation

| Area | Finding | Implemented response | Remaining verification |
| --- | --- | --- | --- |
| Hierarchy | Small captions and long refactor notes competed with the object under review. | Editorial title; dedicated type, colour and spacing foundation cards; larger component names; consistent previews; implementation details moved into disclosures. | Real viewport and large-text inspection. |
| Navigation | A long list of jump pills provided little support for finding a particular primitive. | Persistent category rail, search over names/descriptions/CSS hooks, preview filters, result count, reset, focus-aware local section navigation. | Keyboard and touch pass in a browser. |
| Preview honesty | Render-only functions were labelled live, and host-bound components showed code. | Only wired examples are labelled interactive. Thirty host-only entries have labelled design fixtures; their original source recipes remain in disclosures. | Compare fixtures against the application’s actual runtime states before using them as production fidelity references. |
| Tokens | Existing semantic tokens covered compact chrome but lacked an editorial hierarchy. | Added display, heading, lead and caption roles, section spacing and minimum action target. The generator emits the corresponding CSS; the library consumes the semantic roles. | Cross-theme visual balance and contrast. |
| Design handoff | Whole-page export could outline text or flatten an unsupported document into one image. | Dedicated native component capture, one component per page, Assets-tab component registration, editable text, native surfaces and SVG paths, applied token bindings. | Import the resulting files into a running Penpot instance. |
| Feedback | Export errors were console-only and there was no per-object action. | Download beneath each specimen, busy/disabled state, announced success/failure, retry, and notices about any conversion simplifications. | Screen-reader announcement timing. |
| Accessibility | The library’s small controls and ambiguous preview labels made inspection harder. | Minimum 44px library actions, semantic headings, labelled filters, focus-visible treatment, local navigation that moves focus, large-text token support. No new motion. | Browser layout at 320/390/768/1440px, zoom, forced colours, reduced motion and light/dark/brand themes. |

## Token implementation

The canonical sources remain `design/chrome-tokens.json` and `design/ui-semantics.json`. `scripts/gen-chrome-tokens.ts` generates `src/styles/tokens.css`; the generator drift tests guard both directions.

| Added semantic token | Default | Intended use |
| --- | --- | --- |
| `lolly.ui.type.display` | 64px | Editorial page title; fluidly reduced at narrow widths |
| `lolly.ui.type.heading` | 28px | Section hierarchy |
| `lolly.ui.type.lead` | 18px | Introductory copy and specimen names |
| `lolly.ui.type.caption` | 12px | Supporting labels and metadata |
| `lolly.ui.space.section` | 64px | Major section separation |
| `lolly.ui.size.target` | 44px | Minimum comfortable action target |

The full reference has 52 semantic roles. Type scales use the existing accessibility multiplier once. Colour, surface, radius, space, elevation and focus consume the existing semantic system. The raw-CSS ratchet decreased by one shadow declaration, one pixel radius and sixteen repeated type-size expressions.

The token JSON download contains the canonical foundation/semantic tree, with current theme colours resolved. Every component archive also has a `lolly.component.<specimen>.<layer>` group for its measured values. Matching semantic values retain aliases; local differences have local tokens. Fill, stroke colour, corner radii, text size and font family are linked through Penpot’s `appliedTokens`. The export does not mutate the active brand or project.

## Penpot architecture and limits

`component-capture.ts` reads the explicitly selected specimen roots. It preserves form values, checked controls, text runs, colour, borders, independent corners, shadows and basic SVG geometry as native objects. `component-penpot.ts` uses the existing engine archive writer and adds component main-instance records and applied token links in the web shell. The engine and host contract are unchanged.

The file structure and component/token fields follow the [Penpot file format documentation](https://help.penpot.app/technical-guide/developer/data-model/penpot-file-format/) and Penpot’s upstream shape/component/token schemas. Tests also compare assumptions with the repository’s real Penpot fixture.

Downloads are editable design states. They do not recreate CSS flex/grid responsiveness or application event handling as Penpot prototypes. Text is captured by visual line. Complex SVG illustrations may remain embedded, CSS background textures are simplified, transformed elements use their visible bounds, and canvas animation has no native geometry. Simplifications are shown in the download status. Custom fonts need to be available in Penpot. No live server import was performed.

## Component coverage

| Family | Specimens |
| --- | ---: |
| Primitives | 22 |
| Buttons | 4 |
| Segmented controls & tab bars | 5 |
| Chips / badges / pills | 6 |
| Cards / panels / surfaces | 6 |
| Inputs / fields / sliders | 7 |
| Dialogs / modals & toasts | 6 |
| Toggles & switches | 5 |
| Tooltips, notes & callouts | 5 |
| Colour tools | 6 |
| Navigation, chrome & media | 9 |
| Gallery | 5 |
| Catalog | 5 |
| Dashboard & Brand studio | 13 |
| Tool sidebar & inputs | 5 |
| Design workspace | 4 |
| Export panel | 5 |
| Pro / batch | 4 |
| Multi-edit | 2 |
| Projects / folders | 4 |
| Profile | 7 |
| Verify (/valid) | 4 |

## Verification

- DOM integration mounts all 143 specimens without a broken preview; verifies search, reset, local focus navigation, token filtering and the actual per-component download flow.
- Native-capture tests verify text, input values, check/range state, SVG paths, coordinate normalization, hidden-node exclusion and disconnected-root errors. jsdom measurements are supplied fixtures, not browser layout measurements.
- Archive tests unzip generated files and inspect component ownership, native text, non-flattening, per-component token namespaces, every applied token resolving, semantic aliases and non-mutation.
- Chrome-token generation, existing Penpot writer, primitive guards and accessibility contracts are included in the focused suite.
- Web and web-test TypeScript projects pass. The Vite production build passes with existing missing-WASM/chunk-size warnings.
- Native Chrome later exposed the updated library and provided a screenshot of the redesigned Profile cards. Live Penpot import and exhaustive browser gesture checks remain unverified; the page explicitly leaves those checks open.

Follow-ups in production remain the legacy button-family migration and the Projects view-options popover. These are documented rather than silently included in the library redesign.


## Colour controls: consolidation and fixes

The named Persimmon rows, small toolbar dots and swatch popover already originate in `components/color-field.ts`. Their differences were presentation and capability gaps, so the shared component owns these fixes:

- Colour names now precede their swatches, keeping named-row dots on a common right edge. Narrow and unnamed fields centre the dot independently of input padding.
- The palette has a bounded vertical scroll region, keyboard focus, touch panning and overscroll containment. Its own scroll events no longer dismiss the surrounding popover. All floating, sidebar and block pickers share a usable minimum width and viewport bounds; short screens can scroll the whole panel.
- Fine-tune exposes HSL and OKLCH with HSL as default. Switching spaces does not emit an edit, change opacity or flatten a wide-gamut canonical colour. Compact inputs retain editable hex text. Dedicated advanced editors retain the full space registry.
- Screen eyedropper support is detected at runtime. Unsupported browsers retain a visible, accurately labelled system-picker action. Both sampling paths preserve existing opacity. Cancellation makes no edit.
- The library now separately demonstrates the full swatch palette, named/compact triggers, expanded HSL/OKLCH controls and advanced editor. Each participates in the existing Penpot component/token export.

| Candidate | Consolidation boundary | State |
| --- | --- | --- |
| Named colour rows, compact colour buttons, palette, fine-tuning | One field implementation, one canonical colour and one change contract; explicit presentation variants. | Implemented in this update. |
| Legacy button families, especially export actions | Shared button variants and semantic colour, radius, size and focus roles; keep action ownership in the host. | Recommended next. |
| Segmented selectors and tab strips | Share segment geometry and selection tokens; use the tab keyboard primitive only for actual tab panels. Theme choices retain radio semantics. | Partly shared; continue by host. |
| Projects view-options and other anchored menus | Shared body-popover lifecycle for dismissal, positioning and focus; host supplies content. | Projects view-options remains separate. |
| Swatch tiles and colour information cards | Share PaletteEntry data, token resolution and colour naming. Keep editable tiles distinct from read-only cards with metadata. | Existing shared tile renderer; no forced merge. |
| Sidebar and batch input factories | Share field primitives; retain each shell layout and the engine input model as the source of semantics. | Larger follow-up; avoid duplicating picker logic. |

Verification added: internal versus outside scroll dismissal, compact popover viewport bounds, HSL/OKLCH value preservation, palette hydration, trigger DOM order, native fallback, eyedropper success/cancellation and library coverage. Existing canonical-colour, token, gamut and dial suites also run. Native Chrome exposed the updated 142-specimen page and its new colour entries; the connection then lost its window before screenshot/gesture verification completed. Safari/OS picker and final visual checks remain manual.


## Design-system switcher and portable brands

- Replaced list rows with responsive cards showing each brand’s own type, palette, colour count and size. Open and Download share an aligned footer; secondary actions remain available from the existing overflow control.
- The preview uses the vertical primary reverse logo on dark surfaces and vertical primary on light surfaces. Missing or failed logo images reveal the two-circle fallback. Referenced catalogue logos are embedded and token ids rewritten in a targeted brand export.
- Added a real `.lolly` download dialog: Brand only by default, or explicit selections of saved sessions, catalogue items/uploads and tools. Content search and per-group selection preserve selections across filters and mode changes. Listing catalogue choices reads metadata, not full files.
- Collections are format 4 with reader 2 required. Existing brand intake verifies all nested payloads before writes, restores assets with the existing sanitisation/rekey path, saves each session to a new slot and retains the existing tool trust decision. Duplicate dependencies travel once. Unavailable/licensed session dependencies are reported as references; explicitly selected files must carry bytes or the download fails.
- Tool bundles include complete installed-tool cache contents, signed catalog file inventories, or loader files plus recursively discovered literal tool-local assets in unsigned builds. Dynamically computed asset paths in unsigned, non-installed tools remain a limitation, as with offline pinning.
- Verification: real archive round trips cover brand isolation, catalogue logo portability, selection exclusion, asset deduplication/rekey, tool decisions, corruption refusal and session-write rollback. DOM tests cover the download dialog, escaped device labels, filtering, modes, duplicate-click prevention, cancellation and logo fallback. Web/test TypeScript checks and the Vite build pass.
