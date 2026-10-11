# Modern Penpot layout kernel

This crate extracts the flex and grid routines from Penpot's newer Rust renderer,
pinned to [`10955f17e27943429a10e90360d0404e3f56e27c`](https://github.com/penpot/penpot/tree/10955f17e27943429a10e90360d0404e3f56e27c/render-wasm/src/shapes/modifiers).
The original source hashes, destinations and adaptations are recorded in
[upstream.json](upstream.json). The MPL 2.0 license and upstream copyright notices
are retained. The older Clojure layout solver and web code generation are absent.

The kernel evaluates one container and its direct children. The engine owns
stable layer IDs, ownership validation, implicit grid placement, intrinsic text
measurement, nested evaluation and caching. It supplies four world-space corners
for each shape, rather than axis-aligned screen rectangles. Results are
immutable derived geometry and never a patch to authored input rows.

## Extraction boundary

The modern `layouts.rs`, `flex_layout.rs`, `grid_layout.rs` and `constraints.rs`
retain their original numerical steps. The flex and grid redistribution loops
have one safety adaptation: a stalled f32 allocation or excessive allocation
work refuses the whole request. Those guards do not change a successful
allocation's arithmetic. The source test removes the guards and checks the
original SHA-256 hashes.

`math.rs` retains the modern bounds, ray and resize routines. Skia type aliases
are replaced with a small f32 point, vector, affine matrix and rectangle adapter;
the unrelated boolean module and original Skia-dependent tests are omitted.
Only the bounds lookup trait is retained from `modifiers/common.rs`. The renderer's
shape pool and modifier queues are replaced with request-local plain structures.
Pre-concatenation is `M * other`, post-concatenation is `other * M`, following
[SkMatrix's documented order](https://api.skia.org/classSkMatrix.html).
The matrix, inversion, vector and rectangle conventions have independent native
tests, and rotated parent/child geometry has explicit fixtures.

A grid result includes `columns` and `rows` arrays of
`[startX, startY, endX, endY, size]`. These anchors come from the modern
`calculate_tracks` routine using the same request as reflow. Canvas overlays do
not need another grid geometry algorithm.

## Admission and ownership

| Resource | Limit |
| --- | --- |
| Items per container | 20,000 |
| Tracks per axis | 1,024 |
| Grid row and column product | 65,536 |
| Aggregate active row and column spans | 262,144 |
| Redistribution visits per request | 262,144 |
| JSON input and output | 8 MiB each |
| Input buffers retained by an instance | One |
| WASM linear memory | 32 MiB, including a 1 MiB stack |
| Authored coordinates, gaps and track values | Finite, magnitude at most 1e7 |

Unknown fields and unsupported enums are refused. Grid cells must use positive
one-based coordinates and spans inside the supplied tracks. Fractional track
weights must be positive. Size limits must be nonnegative and ordered. Any
nonfinite output refuses the whole request. There is no partial geometry result
or alternate solver on failure.

`layout_alloc(length)` returns an owned input pointer, or zero on refusal.
`layout_solve(pointer,length)` accepts only that exact pointer and byte count,
and returns a pointer to JSON success or an error object. `layout_output_len()`
returns its byte count. `layout_free(pointer,length)` releases only the matching
input; wrong pointers, wrong byte counts and repeated frees are harmless. The
next solve replaces the retained output. Thread-local Rust ownership replaces
mutable static references. The synchronous TypeScript facade always frees input
in `finally` and decodes a fresh owned result before returning.

## Rebuilding and qualification

From the repository root, `pnpm run build:layout-kernel` builds the import-free
WASM artifact with pinned Rust 1.96.0, locked dependencies, release settings and
an explicit memory ceiling. `node --test tests/layout-kernel.test.ts` exercises
the checked-in artifact, admission, recovery and upstream source hashes.

From this crate's directory, `cargo test --locked` tests the native extraction,
including every recorded reference case. `cargo run --release --locked --bin
layout-reference` accepts one JSON request per stdin line and emits one answer
per line. It can be used to regenerate the reference answers in
[fixtures/modern-layout.json](fixtures/modern-layout.json).

The fixture contains 28 finite modern layout cases and three refusal cases,
including rotated parents, rotated child fill, margins, wrapping, reverse flow,
size limits, grid spans, fixed/auto/fr/percent tracks, hug containers, hidden and
absolute children, empty layouts and an f32 redistribution stall. Native and
WASM outputs must agree exactly for these captured requests. Independent tests
also check simple anchors and rotated grid fill extents, without using captured
answers as those assertions.

The oracle is the native extraction of the pinned modern routines, with the
scalar adapter described above. These checks do not claim parity with a complete
Penpot renderer build or every Skia numerical optimization. The fixed artifact
supplies the same import-free solver in each JavaScript host; full canvas,
export and cross-shell checks belong to the integration suite.
