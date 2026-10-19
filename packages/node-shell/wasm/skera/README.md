# Skera byte adapter

The upstream `skera` 0.7.0 crate and transitive versions are pinned in Cargo.lock. No upstream source is patched. The adapter exports three prefixed allocation/subsetting functions; it has no JavaScript runtime dependencies. See LICENSES.txt for upstream notices.

From the Lolly root: `node scripts/build-skera.ts`. Rust 1.96.0 and the wasm32-unknown-unknown target are required. The committed `skera.wasm` is the browser asset. Browser users do not install Rust. Release settings and the 128 MiB memory ceiling are in Cargo.toml and the build script.

The worker terminates after each subset or on abort/timeout, releasing its linear memory. The client serializes work, admits at most eight requests / 64 MiB input, and retains at most 16 subsets / 4 MiB accounted output and keys. Fonts over 32 MiB are declined.

Policy: retain glyph IDs, retain the missing-glyph outline, all layout scripts/features and names, no variation instantiation. The PDF writer uses original glyph IDs through Identity-H. Changing any selection/version requires a new SKERA_POLICY key. `subsetWithSkera` refuses a readable font whose outlines are not TrueType (this build drops CFF tables it does not subset) or whose `OS/2.fsType` says restricted licence embedding, no subsetting or bitmap embedding only, or that has no OS/2 table, before any allocation and whoever the caller is (engine/src/font-subset-policy.ts). The PDF embedding boundary and `host.fonts` check the same rule first. This adapter is not a rights grant.

`host.fonts` (engine/src/font-inspect.ts) maps chosen text to glyph IDs, runs this adapter in the browser worker or in Node (packages/node-shell/src/fonts.ts, a fresh instance per subset) and checks the output bytes before returning them.

Verification: `node --test shells/web/src/bridge/font-subset.test.ts tests/font-inspect.test.ts`; `node scripts/verify-skera-pdf.ts` additionally requires Poppler's pdftoppm/pdftotext. Source fonts remain authoritative for subsequent edits.
