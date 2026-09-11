# Component showcase review — 7 September 2026

The `lolly-start` component library now leads with colour tools and the Design workspace, followed by the shared primitives. Foundations, token reference and audit notes remain available after the collection and through its navigation.

## Findings addressed

- Desktop content lacked a default page gutter. Preview titles and implementation notes competed with the examples. The gallery now has bounded page width, consistent token-based surfaces and spacing, titles above previews, and expandable usage references.
- Viewport-positioned navigator, timeline, export, menu and selection surfaces escaped or overlapped their cards. Their gallery containers now establish local layout and preserve production styles. Colour popovers can still open outside their cards.
- Several samples used unrelated stand-ins or stale markup. Project tiles, selection bars, context menus, the paused audio dock, editable-wheel shell, colour value field and zoom HUD now use their shared production renderers. The export sheet uses the app's actions-first order and shared format trigger. Section links open the corresponding real use case.
- Profile samples lacked their scoped ancestor, Pro samples lacked their stylesheet, table-header markup was parsed without a table, and the catalogue summary remained in a loading state. These now receive the context or sample data they need.
- Palette scenes now switch between their three real SVG examples. Interactive previews, static samples and design fixtures remain explicitly distinguished.

## Penpot handoff

Component capture reuses the existing exporter's CSS gradient conversion. Linear and radial gradients become native editable fills; conic gradients become editable paths. Rounded background boundaries and overflow clipping become masks. Checked controls include their marks, input values preserve alignment, and frosted surfaces carry background blur.

A wheel downloaded from the live page produced a native archive with 96 paths, three radial gradients, one linear gradient and four masked groups. The archive structure was inspected; it was not imported into a running Penpot editor.

Capture remains a measured state at the current viewport. Behaviour, animation and host workflows are not transferred. Tiled backgrounds, transformed elements and complex SVG effects can require simplification, reported beneath downloads. Custom fonts must also be available in Penpot.

## Validation

- Browser inspection of desktop colour, Design and audio specimens; 390 × 844 responsive layout in dark, brand and light themes; search; live wheel download.
- 27 component, capture, archive and primitive-contract tests pass.
- Web and web-test TypeScript checks pass; production Vite build passes.
- The 11 source files in this review introduce no diagnostics under the repository's lint baseline. The full-tree lint check still reports existing findings in other files.

Remaining host-dependent design fixtures are labelled as such. Further work can replace those fixtures as their owning views expose reusable renderers; camera, storage and modal lifecycles should be verified in those real views.
