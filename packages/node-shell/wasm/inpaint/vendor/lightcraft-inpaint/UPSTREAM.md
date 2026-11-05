# LightCraft inpaint

Source: https://github.com/storytold/lightcraft/tree/07301cbd1e1cab5c152228891d9c9ed87e263003/crates/inpaint
Commit: 07301cbd1e1cab5c152228891d9c9ed87e263003
Licence: MIT OR Apache-2.0. The upstream licence files and the relevant part of the NOTICE are retained here.

What it is: content-aware hole filling. `complete` is the multi-scale patch completion of Wexler, Shechtman and Irani (2007) with the nearest-neighbour field found by PatchMatch (Barnes et al., 2009). `membrane_fill` is a smooth harmonic fill that seeds the coarsest level.

Provenance as the upstream states it: the crate ports PhotoCraft's `crates/algo/src/inpaint.rs` and `poisson.rs` (MIT OR Apache-2.0, same organisation) and says each ported file was modified. The upstream does not claim a clean-room origin and none is claimed here. The algorithms are published; the code is a Rust implementation of them.

Modifications by Lolly:
- Cargo.toml is standalone: the workspace version, edition, licence and lint inheritance are replaced by plain fields, and the `rayon` dependency is removed.
- src/patchmatch.rs and src/membrane.rs: the `cfg(not(target_arch = "wasm32"))` thread-pool branches and the `PAR_MIN` constant are deleted, so one code path runs everywhere. Results do not depend on the thread count upstream, so the output is unchanged.
- src/patchmatch.rs: a dangling doc comment (two lines for a "proximity match" function that is not in this crate) before the test module is removed.
All other source is unchanged. The crate's own tests are kept and run with `cargo test --workspace` in the parent directory.

Limits worth knowing: the algorithm copies existing texture and invents nothing, so it cannot rebuild structure that appears nowhere else in the picture. It runs single-threaded in WebAssembly.
