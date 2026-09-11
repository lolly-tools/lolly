# Figure bank

Banked, signed in-page figures: `<page-slug>-<name>.svg` (or `.html`, a markup+script *fragment*), each
with a REQUIRED sibling `<page-slug>-<name>.meta.json` in the same shape the mastheads use - see
`../mastheads/README.md` - because provenance is not optional: `node scripts/sign-docs-art.ts` refuses an
artifact with no meta, lints every file (no network, no storage, no dynamic code, no external URLs, viewBox
required, guarded motion, ≤ 128 KB of source) and signs only what changed. A figure is referenced from one
page's `::: figure <id>` fence, must render a complete static state with JS disabled, and its words are
content - so a localized variant is its own banked, signed `<id>.<lang>` artifact, never a build-time swap.
