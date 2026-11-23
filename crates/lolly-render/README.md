# lolly-render

A Rust crate that draws one Lolly Design page from its drawing operations: the engine's `DesignDrawPage` (`engine/src/design-draw.ts`), after the engine has laid out and outlined the words, in a versioned JSON envelope with the page's pictures. The output is RGBA pixels or a plain PNG. The PNG finishing (Imprint, colour profile, metadata, Content Credential) stays in the Node shell.

**No default render route uses this crate.** Its Node binding (`crates/lolly-render-node`) is loaded only when `LOLLY_DESIGN_RASTER=lolly-render` asks for it, and a page the crate refuses then goes to the default route (`packages/node-shell/src/design-still.ts`). It is evidence for plan 371 (milestone M3b) until the maintainer decides otherwise.

## Faithful or refused

A page is drawn whole or refused whole, with every reason and a stable code (`REFUSAL_CODES` in `src/admit.rs`). An unknown field, kind or version, a feature this crate does not draw, and every finding the engine reports all refuse the page; nothing is dropped or approximated to make a page drawable. Every input is bounded (`MAX_*` in `src/admit.rs` and `src/picture.rs`) before any work that grows with the input. The crate never shapes text: a run the engine left as live text refuses the page.

Drawn: the frame's paint and clip (square frames), rectangles, rounded rectangles, ellipses, pen paths, colour and gradient fills, borders of every placement, outlined words with underlines and strikes, group opacity, turns and mirrors, row clips, PNG, JPEG and WebP pictures, blend modes, layer blur and shadows. Refused: rounded and elliptical frames, vector, GIF and non-sRGB pictures, and the rest of the list in `src/admit.rs`.

## The same bytes on every machine

tiny-skia is built without its `simd` feature, so every machine runs its scalar code, and with `no-std-float`, so `sin`, `cos`, `acos` and `pow` come from the `libm` crate rather than the platform. The JPEG decoder runs without its x86 and neon features. The blur is integer arithmetic. `tests/render.rs` pins the PNG bytes of eight fixtures and `tests/corpus.rs` the SHA-256 of all 48 drawn corpus pages (`tests/corpus/SHA256SUMS`, recorded on macOS arm64); the corpus pictures are read by path from the lolly-demo catalog (CC0) and checked by digest.

## Running

```bash
cargo build --release                                  # the toolchain in rust-toolchain.toml
target/release/lolly-render page.json page.png         # exit 0 drawn, 3 refused (JSON reasons on stdout), 2 usage
target/release/lolly-render --check page.json          # admission only
cargo test --release
cargo +stable fmt --check && cargo +stable clippy --all-targets -- -D warnings
```

The input envelope:

```json
{ "format": "lolly-render-input", "version": 1, "drawVersion": 0,
  "output": { "width": 640, "height": 400, "dpi": 96 },
  "page": { "the DesignDrawPage": "as the engine's JSON.stringify writes it" },
  "resources": [{ "ref": "the picture reference", "type": "image/png", "data": "base64" }] }
```

`tests/lolly-render.test.ts` at the repository root draws pages the engine compiles today through the built binary, and skips by name when the binary is not built.

Inputs reach the crate from a shell, so they are treated as untrusted. `tests/malformed.rs` holds 41 small malformed inputs (`tests/malformed/`, written by `tests/make-test-inputs.py`), each with the code it must be refused with, and `tests/fuzz.rs` sends seeded mutations of six small pictures (`tests/seeds/`) through every decoder and onto a page (`LOLLY_RENDER_FUZZ_ITERS` sets the count per seed). The repository's fuzz harness reaches the same code through the binding (`lolly-render-envelope`, `-png`, `-jpeg` and `-webp` in `tests/fuzz/targets.ts`).

## Not verified

- Bytes beyond macOS arm64, wasm32 and Linux x64: `.github/workflows/lolly-render.yml` passed on an ubuntu x64 runner; Linux arm64 and Windows are built and checked only by `.github/workflows/lolly-render-addon.yml`, which has not run yet.
- Rounded frames: refused, because the crate cannot match the browser tier's edge there inside the bands.
- Any timing claim in general: the plan 371 evidence measures this machine only, cold and warm, for the pages the crate draws.
