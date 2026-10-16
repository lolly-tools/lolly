# Asset modal inspector dock

Date: 2026-10-16

The asset modal's fixed sidebar inherited a full-window credential journey layout. A narrow sidebar could devote almost its entire width to the source badge, leaving descriptions and timestamps clipped. The sidebar also presented long, competing metadata and action blocks without the resizing and disclosures used in the inputs and export docks.

## Changes

- Use the shared splitter for the modal's inline-end sidebar. Drag to resize, drag inward to collapse, or use the collapse and expand controls. Arrow keys, Home, End, Enter and double click retain the splitter's existing keyboard/reset behaviour. Persist chrome geometry separately from asset data.
- Keep the asset name, Download, Inspect & verify, favourite and close controls in the inspector header. Close stays reachable in the collapsed rail and the phone header.
- Group file details, source facts, organisation metadata, export/sharing, file actions, origins/credentials, technical data, usage, audio, appearance and text analysis into the shared disclosure pattern. Remember section choices; newly requested text analysis opens when ready.
- Put the trust lamps in Checks at the end, including when asynchronous metadata or editing cards arrive.
- Make inline credential steps follow the sidebar's container width. Stack narrow steps, wrap descriptions and timestamps, retain the recorded software name with readable contrast, and remove the nested report scrollbar. Wider sidebars can show two columns. Preserve unverified evidence wording and correct the single-step label.
- Keep mobile stacked and full width even when the desktop sidebar was collapsed. Reuse the shared splitter rather than placing another global dock behind a modal.

## Isolation

Work is in `feat/asset-inspector-dock-20261016`, stacked on the curation branch and PR 316. The main checkout has unrelated edits, including a change in `valid-forensics.css`; these are preserved. The new inspector component styles its inline report locally and does not change that stylesheet. The engine, Work providers and credential validation rules are unchanged.

## Validation

The two real-browser tests passed: the actual asset modal with the real credential journey renderer using a fixture report, and the existing shared curation workflow. Coverage includes resize, drag collapse and expansion, keyboard reset, width/section persistence, 300px sidebar readability, large text, a 390px phone viewport, breakpoint changes, close availability, the actual Inspect & verify handoff, and metadata/text review operations. The repeated reports retain their unverified evidence label. A software WebGPU startup timeout interrupted one run; the subsequent complete run passed without bypassing the device gate.

The 38 focused splitter, asset rights, mobile-layout and curation tests passed. Changed-source lint, maintainability, wording gates and generated source-map checks passed. Final typecheck and branch handoff results are recorded below when complete. Desktop and mobile screenshots under `plans/318-evidence/` in this worktree were visually inspected. The browser fixture contains a deliberately long recorded source string to stress wrapping.
