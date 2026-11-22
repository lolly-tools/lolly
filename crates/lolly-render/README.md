# lolly-render

Draws one Lolly Design page from its drawing operations (plan 371, milestone M3b). The input is the engine's `DesignDrawPage` (`engine/src/design-draw.ts`) after the engine has laid out and outlined the words, in a versioned JSON envelope. The output is RGBA pixels or a plain PNG. **No shell calls this crate yet: it is not a render route.**

```bash
cargo build --release                                   # pinned toolchain in rust-toolchain.toml
target/release/lolly-render page.json page.png          # exit 0 drawn, 3 refused (JSON reasons on stdout), 2 usage
target/release/lolly-render --check page.json           # admission only
cargo test --release
cargo +stable fmt --check && cargo +stable clippy --all-targets -- -D warnings
```

`tests/lolly-render.test.ts` at the repository root runs the built binary against pages the engine compiles today, and skips by name when the binary is not built.

## Input

```json
{ "format": "lolly-render-input", "version": 1, "drawVersion": 0,
  "output": { "width": 640, "height": 400, "dpi": 96 },
  "page": { "the DesignDrawPage": "as the engine's JSON.stringify writes it" } }
```

Every object is read strictly: an unknown field, kind or version refuses the page with a named reason (`REFUSAL_CODES` in `src/admit.rs`), never a guess. Every input is bounded (`MAX_*` in `src/admit.rs`) before any work that grows with the input. The words arrive as outlines; the crate never shapes text, and a run left as live text refuses the page.

## What this slice draws

The frame's paint (square corners) and its clip, rectangles, rounded rectangles, ellipses, pen paths (fills, centred strokes, dashes), colour, linear and radial gradients, inside borders, outlined words with underlines and strikes, group opacity, turns and mirrors, and a row's clip polygon. Refused for now: pictures, shadows, layer blur, blend modes, per-side and centred or outside borders, pen strokes kept to one side, per-corner radii, rounded and elliptical frames (their outer edge differs from the browser tier's), and every finding the engine reports.

## Same bytes on every machine

tiny-skia is built without its `simd` feature, so every machine runs its scalar code (its SIMD reciprocal is a different approximation on x86 and on Arm), and with `no-std-float`, so `sin`, `cos`, `acos` and `pow` come from the `libm` crate rather than the platform. The crate's own maths uses exact quarter turns, `libm` for other turns and V8's `hypot` in exactly rounded steps. `tests/render.rs` pins the PNG bytes of five engine-made fixtures.
