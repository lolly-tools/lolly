# Diagrams

New diagrams start in Minimal. Editorial adds focal emphasis, Soft depth raises the cards, Flow adds colour transitions, and Studio combines these with shallow highlights. All five use the current design system. Legacy preserves the previous layout and appearance for existing links and saved diagrams.

Choose connection shape independently of direction markers. Rounded elbows can be headless or directed. The new open head has a 90-degree included angle, wings at 45 degrees to the shaft, rounded tips and a rounded join. Automatic sizing follows line weight. Ribbons have constant width and do not encode quantities.

## Editing the diagram

Start with the content controls, then choose Style, Arrow defaults or Layout. Advanced holds reference IDs and named gradient tokens. Controls follow the source and diagram type: fixed-position sources keep their authored geometry, and card-only settings stay out of Gantt and pyramid controls.

Click a card, connection or group band to open its settings in the left panel. Imported objects open their source editor. Right-click (including a trackpad secondary click) opens that object's settings menu; touch and hold does the same on a touch screen. Enter opens the focused object's sidebar control, and Shift+F10 opens its menu. Menu changes use the same input model, undo and save path as the sidebar.

Use **Focal emphasis** for the leading card, or set **Emphasis** on an individual visual card. Studio exposes **Surface highlight**. Card depth and line depth can be adjusted independently, and gradient options appear when the connection paint uses a gradient. **Cards per row** wraps a layer diagram without shrinking its labels. Disconnected process flows retain their own alignment.

Blank global colours inherit from the design system. Explicit card, line and imported colours remain authored overrides. Clear a global connector colour to allow the selected brand gradient. Imported colours can also be deliberately replaced using **Use design system**. Corner radius can remain linked to the design system or use a custom value. **Reset look** restores the coordinated defaults without changing the diagram's content.

Fonts, semantic colours, spacing, radius, gradient stops and a recognised card shadow are resolved at render time. Incomplete systems use neutral fallbacks. A sole gradient token is automatic; multiple gradients require a token path. For shadows, `shadow.card`, `shadow.medium`, or a sole shadow token supplies bounded offset, blur and colour. Functional labels are measured through the text bridge. Missing glyphs, fixed source boxes that cannot fit their text, and routes that cannot clear nearby cards produce visible notices.

## Sources and layout

All existing source modes and diagram types remain supported. Imported direction and explicit arrowheads retain their meaning. ASCII and Pikchr retain authored positions. Process ranks handle strongly connected components and return links. Org charts draw shared trunks once; mind maps balance subtree footprints. Dated Gantt keeps its existing time geometry.

Modern rendering admits up to 300 cards and 900 connections. Labels/details are bounded to 1600 characters and 12 displayed lines, with an overflow notice. Routes use at most 24 nearby corridors per axis plus outer alternatives; curves use bounded sampling. These are deliberate geometry budgets, not a machine-speed-dependent change of look.

## Export behaviour

| Format | Behaviour |
| --- | --- |
| SVG | Vector cards, paths and text; sampled vector colour transitions and shadow bands |
| PNG, JPG, WebP, AVIF | Raster artwork at the requested output dimensions |
| PDF, PDF-CMYK | Vector geometry and outlined text through the current web export path |
| Penpot | Individual editable path/text objects where supported by the existing importer; no native graph semantics |
| PPTX | Placed artwork, not native editable diagram connectors; experimental exports retain their DRAFT mark |
| EMF | Outlined round geometry; alpha is flattened against the export background |
| DXF | Technical path geometry; presentation fills, gradients and soft depth do not retain their appearance |

Use SVG, PNG or PDF when material appearance matters. A transparent diagram still needs a suitable backing surface for text and thin connections. The exporter cannot infer the colour of a document into which it will later be placed.

## Maintenance

The original renderer and parsers remain in `hooks.js`. Modern appearance, text, routing and paint live in `source/*.js`. The source exports identify reusable functions for linting; the generator strips those declarations and appends the helpers as one self-contained tool-data script. No runtime import or extra network request is required.

After editing a helper:

```sh
pnpm run build:diagram-hooks
node scripts/build-diagram-hooks.ts --check
node --test tests/diagram-builder-visual.test.ts tests/diagram-builder-import.test.ts tests/diagram-builder-gantt.test.ts
```

The assembly test rejects stale generated code. Changes to block field order must remain append-only and update `schemas/blocks-wire-order.json`. After manifest/template changes, rebuild and validate all mounted catalogs.

A fresh mount is distinguished by the input model's supplied-value flags. Fresh mounts seed Minimal; supplied historical inputs without `look` retain Legacy. New templates and saved modern documents carry `look`. Recipes seed unspecified controls on initial load; subsequent custom changes persist. Changing Look reapplies its geometric recipe while keeping authored colours; Reset look also clears global colour overrides.

The document-model figures are generated with `node scripts/build-spec-diagrams.ts`. The same inputs produce the SVGs and their editable docs links. Each file carries Content Credentials covering the artwork and embedded recipe. Unchanged artwork retains its signature; `--check` verifies the file binding and compares the source render. The docs footer opens the verifier or restores the figure in Diagram Builder using the current brand.
