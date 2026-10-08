# Geometry kernel pilot

This dependency-free Rust crate ports the nearest-point solver from
[`engine/src/geom/bezier.ts`](../../../../engine/src/geom/bezier.ts), ordered
curve-proximity candidates, `cubicRoots01` from `geom/intersect.ts` and the complete
ordered cast from `geom/ray-cast.ts` and independent adaptive offset verification
from `geom/offset-error.ts`. All controls,
polynomial coefficients, root tests and results use float64. The port preserves
the current arithmetic order, root isolation, thresholds, original cubic
parameters and first-curve tie order. Curves are never flattened into polygons.

The pilot is available through `@lolly-tools/node-shell/geometry-kernel` and its
Node byte loader, `@lolly-tools/node-shell/geometry-kernel-node`. Shells supply
WASM bytes; the engine does not fetch or instantiate the module. Instantiation
is asynchronous, followed by synchronous queries on prepared paths. This pilot
does not replace the live TypeScript solver or change HostV1.

```ts
const kernel = await loadGeometryKernel();
const path = kernel.prepare(curves);
try {
  const result = path.nearest(x, y);
  const batch = path.nearestBatch([[x, y], [otherX, otherY]]);
  const candidates = path.nearPairs(weld);
} finally {
  path.dispose();
}
```

Preparation takes an immutable snapshot of the eight controls per cubic. A
query returns an owned object containing the zero-based curve index, original
`t`, point and distance. It cannot recover SVG contour addresses by itself:
the importing shell must retain that mapping. Process-local handles are never
authored or persisted. Disposal is idempotent; disposed paths reject queries.

## Admission and ownership

| Resource | Limit |
| --- | --- |
| Curves per path | 16,000 |
| Resident paths / total curves | 8 / 32,000 per instance |
| Points per batch / curve-point work | 64 / 262,144 |
| Coordinate magnitude | 1e9, finite |
| Owned byte buffers | 32, each at most 2 MiB, 4 MiB aggregate |
| WASM linear memory | 16 MiB, including the 1 MiB stack |
| Proximity curves / emitted pairs / bucket visits | 8,000 / 65,536 / 4,000,000 |
| Cubic polynomials per batch / coefficient magnitude | 4,096 / 1e100, finite |
| Twin-bundle ranges per cast / caller work magnitude | 4,096 / 200,000,000, integer |
| Fitted curves per offset verification | 1-32 |
| Offset verification base spans / refinement depth / refinement visits | 12 / 20 / 512 |

The raw ABI admits only registered, exact-start byte buffers. Inputs are
little-endian float64 control records or point pairs; outputs are five-number
records `[curveIndex, t, x, y, distance]`. Preparation copies controls into a
separate owned path. Path handles increase monotonically and are never reused
within an instance. All batch input and output shapes are validated before
writing a result, so a refused batch leaves output bytes unchanged.

The additional proximity pilot emits each candidate pair once in the established
start/midpoint/end cell order, preserving negative-half rounding and zero-sign
identity from JavaScript. It uses numeric hash keys; output order comes from the
curve/cell/neighbor traversal, never hash iteration. These are candidates for the
existing geometric trace tests, not confirmed intersections or coincident curves.
`nearPairs(weld, maxPairs?)` returns owned index pairs; an oversized/dense pass
fails explicitly. Its pair ceiling differs from live boolean work budgets. The
live TypeScript visitor can stop early as callers exhaust their budgets; the
batch pilot collects a complete admitted list before returning.

`geom_path_create` returns a positive handle, `-1` for malformed input or `-2`
for admission/allocation failure. `geom_nearest_batch` returns `0` on success,
`1` for an unknown handle/buffer or aliased query/output buffer, `2` for invalid
coordinates/shapes and `3` for a work limit. The TypeScript adapter translates
these into explicit errors, validates inputs first and releases temporary
source buffers even on failure. It reuses query buffers for equal-size batches.

`geom_near_pairs(handle, weld, output)` returns the emitted pair count, `-1` for
an unknown path/buffer, `-2` for invalid radius/output shape or `-3` for admission,
work or allocation refusal. Registered output capacity sets the pair ceiling,
up to 65,536 records. Each record is two little-endian uint32 indices. Refusal
leaves the entire output untouched. Temporary hash/cell/pair storage is released
at return; the adapter retains only its bounded output buffer until resize or
path disposal. Registered-buffer statistics do not measure those temporaries.

`createRootWorkspace()` returns a synchronous `solve(coefficients)` operation
and idempotent `dispose()`. Each polynomial has four coefficients `[a,b,c,d]`
for `a*t^3+b*t^2+c*t+d`. Results contain owned `roots` and `directions` arrays.
Directions are +1 for a rising crossing, -1 for a falling crossing and 0 for
a tangency. The port preserves derivative isolation, arithmetic order,
32-ulp value snapping, 1e-9 endpoint/merge slack and the 80-step bracketed
Newton ceiling. Endpoints retain positive zero. Equal-size calls reuse buffers;
resizing releases the old buffers. An empty input returns an empty batch.

`geom_cubic_roots_batch(input, output)` accepts registered little-endian float64
coefficient records. Each 72-byte output record contains a float64 count followed
by four `(t,direction)` pairs. Unused slots are zeroed on success. It returns 0
on success, 1 for unknown/aliased buffers, 2 for invalid shape/coefficients or 3
for admission/allocation refusal. Input validation completes before any output
write. The finite coefficient ceiling also bounds derivative-discriminant
arithmetic without changing the live engine's admission. A temporary owned
coefficient copy, at most 128 KiB, is released at return. The workspace shares
the existing buffer count/byte and linear-memory ceilings with prepared paths.
There is no scalar root bridge integration; returned directions do not mutate
any caller-supplied array.

`prepareRayIndex(index)` takes an immutable snapshot of an engine curve index:
the controls, each curve's established tight box and the aggregate box. The
importing shell retains contour/source addresses and supplies this metadata;
the pilot does not lower, normalize or close authored paths. Its `cast(...)`
method takes the same query point, unit direction, optional reference tangent,
radius, mutable work budget, completion flag and twin-bundle ranges as the
TypeScript cast. It returns owned `{far, net, ok}` counts and updates only
`budget.work` on success. Refusal leaves the caller's work unchanged.

The complete cast preserves ordered box rejection, along-ray degeneracy,
signed-distance coefficient construction, root/direction isolation, point and
tangent evaluation, look-behind handling, twin-range membership, retry bands
and endpoint rules. A scan costs one work unit before box rejection; a line
solve costs eight more. A cast may finish the current curve after exhausting
that charge, then stop before the next curve. Completing passes still obey
the work prefix. Direction selection/retries, whole-operation limits,
fitting/clipping and result construction remain with the existing engine.

The shell computes the established ray reach and `Math.hypot` line norm once
per cast and supplies those float64 values. The module keeps numerical stages
together instead of transferring coefficients or individual hits. It returns
four float64 values, including remaining work. Bundles are validated and
serialized anew, so caller edits cannot reuse stale membership. The module
orders ranges by curve and original position; the lookup retains the engine's
1e-6 parameter slack. Query/output buffers are reused, and the bundle buffer
is replaced when its range count changes. Disposal releases both the path and
all retained buffers. Linear-memory and registered-buffer ceilings are shared
with nearest, proximity and root workspaces.

`geom_ray_path_create(input)` accepts 96-byte records: eight float64 controls,
then `[box.x0,box.y0,box.x1,box.y1]`. It uses the same path/curve limits and
monotonic handles as ordinary paths. `geom_ray_cast(handle,query,bundle,output)`
requires an indexed handle. Its 96-byte query is `[px,py,ux,uy,near,reach,len,
refX,refY,hasRef,complete,work]`; flags are 0/1. Bundle 0 means no ranges,
otherwise registered records are `[curveIndex,t0,t1]`. Output is exactly
32 bytes `[far,net,ok,remainingWork]`. Status 0 is success, 1 an unknown or
aliased buffer/handle, 2 invalid shape/values and 3 admission/allocation
refusal. All raw output remains untouched on refusal. Temporary range storage
is released on return and is excluded from registered-buffer statistics.

```ts
const roots = kernel.createRootWorkspace();
try {
  const results = roots.solve([[1, -1.6, 0.73, -0.09], [0, 0, 2, -1]]);
} finally {
  roots.dispose();
}
```

`stats()` reports owned path, curve and buffer counts plus linear-memory size.
After disposal the owned counts return to zero. The allocator's linear-memory
high-water mark can remain until the instance is released. These are per-instance
limits, not whole-process accounting. A worker can be terminated to interrupt
a synchronous batch; there is no in-realm cancellation API.

## Build and qualification

`pnpm run build:geometry-kernel` uses pinned Rust 1.96.0, the locked crate and
explicit memory/stack linker limits. The small WASM artifact ships beside its
sources. Build scratch stays under the local plans directory.

`pnpm run test:geometry` runs the unchanged TypeScript nearest-point corpus
against both solvers, ordered spatial-reference and root/direction cases, complete
ray counts/work prefixes, complete bridge outputs and admission/ownership tests
and browser/worker comparisons.
It also substitutes the complete WASM cast throughout the existing geometry
test corpus, preserving fixture locations and releasing ownership after each
test. The substitution is confined to a local comparison bundle.
It fails if the Chromium browser is unavailable; `LOLLY_BROWSER_CHANNEL` chooses
an installed channel. Geometry does not require a graphics adapter. The general
test suite may skip missing external browser facilities. No timing assertion
is part of numerical conformance.

`pnpm run bench:geometry` records module loading, path preparation, 31 paired
warm TypeScript/WASM queries after five warmups, exact-result assertions and
the current SVG bridge cost. It alternates the solver order and retains raw
samples with machine information. The workload controls are deterministically
rounded to six decimal places so the 4,096-curve SVG fits existing admission.

The initial Apple M4 run found comparable prepared solver times on large paths:
about 1.8 ms at 4,096 curves for either language. Repeated SVG parsing cost much
more. The live bridge therefore gained a bounded private nearest-query parse
cache while retaining its TypeScript solver. This cache applies to repeated
`host.geom.nearest` SVG queries; editor pen queries already use structured
curves. Further Rust activation requires a measured workflow gain and the
existing numerical/error contracts. Intersection, booleans, offsets and fitting
are separate future ports.

`pnpm run bench:geometry:workflows` measures intersections, booleans, offsets and
strokes with parse/solve/serialization costs separated. `bench:geometry:spatial`
compiles the same engine twice, substituting only the historical string-key
traversal in one variant, then runs paired complete bridge comparisons. Separate
paired spatial cases include collection/decoding costs and compare historical
TypeScript, numeric TypeScript and WASM. `--spatial-only` limits that command to
the kernel comparison. Raw samples and output hashes stay in small local reports.

The measured live improvement replaces string cell keys and repeated quantization
with a per-pass numeric TypeScript index. It preserves candidate order and caller
early stopping, so existing boolean tolerances, classification and work-budget
decisions are unchanged. The Rust spatial pilot agrees on candidates and remains
a comparison backend while optimized TypeScript performs better on the measured
workloads. Further activation requires a complete-operation gain.

`pnpm run bench:geometry:roots` captures the existing root coefficients from
complete boolean, offset and stroke operations. It compares paired complete SVG
bridge runs with TypeScript roots versus a benchmark-only scalar WASM substitution.
It separately replays captured coefficients in batches, including admission,
input copying and owned output decoding. The coefficient corpus is reproducible
from the maintained recipe; reports retain its hash and all timing samples.
Replaying roots excludes the other stages of the original operation.

The first local Apple M4 measurement found lower root-replay medians for batched
WASM, but higher complete-operation medians when crossing into WASM per polynomial.
The live engine retains TypeScript roots. Further work should retain a complete
line-query/winding stage in the kernel, then compare the same workflow with its
existing parameter, direction and budget contracts. Replay timings alone cannot
justify selecting a live backend.

`pnpm run bench:geometry:ray` now performs that complete-operation comparison.
Each WASM sample includes a fresh bounded per-operation cache, first-use control
and box import, query/range preparation and disposal. The cache retains at most
eight immutable indexes and 32,000 curves; eviction obeys both bounds. It returns
exact complete SVG bridge result objects in paired comparisons. No hook is present in production:
the maintained comparison builder injects a test-only whole-cast substitution.

Two M4 runs found near parity on the measured boolean workloads, a slightly
higher offset median and about a 3-4% lower stroke median. These measurements do
not justify broad activation. The live engine keeps TypeScript cast selection; the
Rust stage remains a qualified comparison backend. Fitting/clipping and wider
target measurements remain open.

`bench:geometry:stages` measures warmed complete SVG workflows and labeled
single-piece/pair operations on the live engine. `profile:geometry` collects CPU
traces in a separate invocation, after imports and warmups. Both use the same
maintained circle, wiggle, cusp and self-crossing regressions plus tight-tolerance
variants. Reports retain exact input/output hashes and clipping/overrun counters;
work ceilings remain unchanged. `--reverse` reverses case order for a second run.
Profiles partition fitting, independent offset verification, pair intersection
and winding scopes. Inclusive frame percentages overlap and cannot be added or
read as potential speedup. These fixtures do not represent a captured editor
session or cross-device qualification.

`bench:geometry:verification` builds the same engine with repeated bounds and with
once-per-verification bounds, then alternates variant order over 31 paired warm
samples. Preparation is included in each complete operation; exact results and
clipping counters are checked outside timing. The builder recognizes the live
prepared form and can reverse only that seam for the comparison. No comparison
hook ships in the engine.

Two local runs found about 5-8% lower medians for the tight-tolerance stroke and
5-10% for the standalone smooth offset piece. Other cases were near parity. The
live engine now reuses immutable fitted-curve bounds within one private verification
call. Nearest solving, both error metrics, subdivision and work ceilings stay the
same. The next Rust comparison should retain source-specific adaptive offset
fitting and independent verification together, avoiding a boundary crossing for
each source sample. Complete clipping, including its overrun search, remains a
separate later stage.

`createOffsetErrorWorkspace()` returns synchronous `verify(src, fitted, distance,
tolerance)` and idempotent `dispose()`. This is the independent source-to-fit
measurement, returning owned `{error, t}` values. Candidate fitting, its separate
error metric, subdivision, joins and clipping remain in TypeScript. The shell
prepares the established tight bounds and refreshes every control/box record on
each call. Equal-sized buffers are reused; resize releases the old buffers.
Caller mutation between calls changes the next measurement. No curve identity
cache survives a call.

`geom_offset_error(query, fitted, output)` accepts three distinct registered
exact-start buffers. The 80-byte query is eight source coordinates, distance and
positive tolerance. Each 96-byte fitted record contains eight controls followed
by `[x0,y0,x1,y1]`. The 16-byte result is `[maximumError,sourceParameter]`.
Coordinates, boxes, distance and tolerance are finite and bounded by magnitude
1e9. There are 1-32 fitted records; boxes must be ordered. Status is 0 on success,
1 for missing/aliased buffers, 2 for malformed/non-finite inputs or shapes and 3
for the curve ceiling. All records are validated before writing output. The
adapter releases partial allocations on refusal. Maximum transport retention is
3,168 bytes, within the existing shared buffer/memory limits; fixed temporary
curve/box arrays on the stack are separate from registered-buffer statistics.

The Rust operation retains source normals and their fallback legs, adaptive
sample order, sagitta refinement, box culling and the established nearest solver.
The 12 base spans, depth 20 and 512-refinement allowance are unchanged. The module
has no host imports. Its scaled two-coordinate norm matches the two-argument
arithmetic of the qualified V8 hosts ([upstream source](https://raw.githubusercontent.com/v8/v8/main/src/builtins/math.tq));
native libm and other browser engines are not assumed bit-identical. Exact Node,
Chromium and worker comparisons are qualification evidence for those hosts.

`bench:geometry:offset-error` compares complete SVG workflows with TypeScript or
retained WASM verification. Every WASM operation owns a fresh workspace and
includes preparation/copying, buffer reuse/resize, result decoding and disposal.
Thirty-one paired warm samples alternate variant order after ten warmups;
`--reverse` changes workflow order for a second run. A separate replay measures
captured verification calls without the other workflow stages. Capture, hashes,
counters and assertions are outside timing. Complete SVG and piece/pair rows
remain separately labeled. The corpus runner's `--offset-error` option applies
the comparison-only substitution to every existing geometry assertion, without
changing production selection.

Two M4 runs found full default workflows near parity, about 1-3% lower tight
offset/stroke medians and about 2-3% higher self-crossing offset medians. The
standalone smooth piece improved about 5-9%; that result does not justify broad
selection. TypeScript remains live. The next retained fitting operation should
keep candidate construction and verification together, then compare complete
SVG workflows with the same source mathematics, error oracles and work limits.

## Complete source-specific fitting comparison

`build:geometry:fitting` builds a separate `geometry-fit.wasm` from the same locked
crate with the `fitting` feature. The original `geometry-kernel.wasm` retains its
no-import ABI. The fitting module imports only five scalar functions from
`lolly_math`: `sin`, `cos`, `acos`, `atan2` and `cbrt`. The shell supplies its own
JavaScript maths and counts those calls. No source sample, polynomial solve or
candidate crosses back to a host callback. The engine does not load either module.

`@lolly-tools/node-shell/geometry-fitting` exposes `createGeometryFitting(bytes)`;
`geometry-fitting-node` supplies `loadGeometryFitting()`. A reusable workspace
provides synchronous `fit(source, distance, tolerance)` and idempotent `dispose()`.
It returns owned `{curve, dirStart, dirEnd}` pieces. The directions come from the
source and are null inside a fitted run, preserving the joins of folded offsets.
Inputs are refreshed on every call; returned controls and directions never alias
WASM memory. Equal-sized result buffers are reused, resizing releases the old
buffer, and failures release newly owned buffers and intermediate result handles.

The operation retains source feature/cusp clustering, offset cusp isolation,
straight translation, analytic offset sampling/derivatives, 16-point moment
quadrature, quartic/complex near-miss candidates and arm ranking. Fitting keeps
its normal-ray maximum search and high-curvature arc correspondence guard.
Independent verification retains sagitta refinement and exact nearest projection.
The 32-segment fitter allowance, depth-20 fitter guard, 20-sample grid brackets,
12 golden refinements, depth-eight outer guard and independent 512-refinement
allowance are unchanged, including the existing depth-eight delivery rule.
Generic `ParamCurveFit` callbacks remain the engine's TypeScript implementation.

Raw admission is distinct from live engine semantics. Eight controls, distance
and positive tolerance are finite and within magnitude 1e9. A request uses an
80-byte registered buffer. `geom_offset_fit_create(query)` returns a positive,
monotonic handle, -1 for invalid input, -2 for ownership/work refusal and -3 for
non-finite generated output. No partial result handle escapes on refusal.
`geom_offset_fit_len(handle)` returns the piece count, or -1 for an unknown handle.
`geom_offset_fit_read(handle, output)` writes exactly 112 bytes per piece:
eight float64 controls, `[hasStart,startX,startY,hasEnd,endX,endY]`. Flags are 0/1;
absent directions have zero payloads. Delivery returns 0 on success, 1 for an
unknown handle/buffer or 2 for a mismatched buffer shape. Refusal writes nothing.
`geom_offset_fit_free(handle)` releases the result and is idempotent.

Each result admits at most 16,384 pieces; an instance retains at most eight results
and 32,768 pieces total. Bernstein isolation has a separate 4,096-visit ceiling
per polynomial. Exhaustion refuses the whole operation rather than emitting a
shortened search result. Source feature isolation still uses its original
depth-40 and 1e-7 span rules. Registered buffers retain the existing 32-buffer,
2 MiB individual / 4 MiB aggregate limits; linear memory remains capped at 16 MiB
including the 1 MiB stack. `stats()` distinguishes result/piece/buffer ownership,
linear-memory high-water and host maths calls. Temporary fitting arrays and
allocator capacity are not registered-buffer bytes or whole-process accounting.

The complete comparison passes the unchanged geometry corpus and exact local
reference comparisons for 59 fixed and 128 seeded requests in Node, Chromium and
a worker. Chromium and its worker agree exactly. Existing Node/Chromium fitting
differs on 122 of those raw requests, with matching piece counts; scalar replay
isolates differently rounded `atan2` answers for identical inputs. The largest
observed control difference is about 1.94e-7 on this corpus. Complete serialized
SVG workflows retain their Node result, but cross-host raw bit identity is not
established. Native Rust maths supplies smoke coverage only. Portable maths and
wider host qualification remain open. No engine tolerance is relaxed.

`test:geometry` includes this module's ownership and browser/worker gates, followed
by the complete corpus with `--offset-fit` substitution. The browser gate requires
exact Rust/unchanged-TypeScript results in each host and records existing host
differences separately when `LOLLY_GEOMETRY_FIT_REPORT` names a local report file.
`bench:geometry:offset-fit` captures complete source operations and runs 31 paired
warm full workflows, including import, both retained error paths, host maths calls,
owned decoding and disposal. Replay is reported separately. Source/module/input/
output/capture hashes and clipping counters accompany the raw p50/p95 samples.
The module remains a comparison backend; live selection is TypeScript.

Both local M4 case orders show about 13-16% lower full circle-offset medians and
7-11% lower wiggle-stroke medians. Self-crossing offset is about 12% lower; cusp
stroke remains near parity. The standalone smooth piece is about 17-25% lower,
but that result excludes the rest of a bridge workflow. Exact complete outputs,
captures, source/module hashes and clipping counters agree between runs and with
the preceding workflow baseline. An untouched long intersection varies by about
7% in one run and returns near parity in the other, so these measurements do not
establish editor latency, p95 across devices or native gains. Keep TypeScript live
while portable maths compatibility is qualified, then evaluate retained clipping
with its existing initial search and overrun handoff.

## Import-free fitting comparison

This is now the only fitting artifact; see "One portable answer" below. The
history that follows is kept as the record of how it was qualified.

`pnpm run build:geometry:fitting` builds `geometry-fit-portable.wasm` with the
`fitting` feature (formerly `portable-math`). The default and five-import fitting artifacts stay
separate. `loadGeometryFitting('portable')` explicitly selects this comparison;
the loader rejects all imports and requires its owned fitting and scalar ABI.
Default host mode rejects the portable artifact. No live engine selection changes.

The pinned Rust 1.96.0 WASM implementation provides sin, cos, acos, cbrt and atan2
inside this artifact. No dependency was added. The
[Rust f64 documentation](https://doc.rust-lang.org/std/primitive.f64.html#method.sin)
does not promise portable precision for these methods. Qualification belongs to
the compiled artifact, target and toolchain, rather than every native build or
future Rust version. Native smoke tests do not establish native maths identity.

The same artifact gives exact finite scalar bits and NaN classifications for
3,712 boundary/seeded requests, plus exact complete controls and directions for
187 fitting requests, in Node, Chromium and its worker. NaN payload bits are not
a contract. Fifty-six independent scalar vectors generated with mpmath 1.3.0 at
450 and 650 decimal digits agree after binary64 rounding; the candidate stays
within two ulps of those answers. Regenerate the maintained fixture with
`node scripts/gen-geometry-math-vectors.ts`; Python/mpmath is an offline fixture
dependency, not a build or runtime dependency.

This portable candidate does not meet exact legacy compatibility. Raw controls
differ from unchanged TypeScript on 52 Node and 121 Chromium requests, with equal
piece counts and exact source directions. Seven Chromium workflows visit a
different number of clipping nodes; canonical counts agree across hosts, but
legacy per-host counts do not. Current complete SVG workflows retain their
serialized results, and all existing geometry corpus assertions pass without
wider tolerances. Ownership and failure ceilings are unchanged and separately
tested. Neither SVG equality nor a small control difference waives the legacy
compatibility gate. Both fitters remain comparison backends.

`test:geometry` now also requires portable Node/browser/worker qualification and
the original corpus with `--portable-math` substitution. Set
`LOLLY_GEOMETRY_PORTABLE_REPORT` to save exact artifact/result hashes and the
legacy raw/counter difference census; CI retains both fitting reports.
`bench:geometry:offset-fit --portable-math` compares complete Node workflows only
when their full outputs and clipping counters equal the current TypeScript
reference. Replay checks each variant against its own untimed answer and records
all legacy control differences separately. Those replay answers are not treated
as exact legacy parity. No performance result authorizes activation.

Two local M4 case orders show about 14-17% lower complete circle-offset medians
and 6-11% lower complete wiggle-stroke medians. Complete Node outputs and clipping
counters, artifact/source/input/capture hashes and canonical replay answers agree.
The first default-stroke p95 is about 3.3% higher, and improves in the reverse run;
the medians do not imply consistently better tails or gains on other devices.
These runs do not isolate an incremental improvement over the separate host-maths
measurement. Continue with retained clipping on identical controls while the
legacy numerical compatibility issue remains explicit.

## Complete retained clipping comparison

`build:geometry:clipping` builds a separate import-free `geometry-clip.wasm` using
the locked crate's `clipping` feature and pinned Rust 1.96.0. The existing kernel
and both fitting artifacts remain separate. The live engine stays TypeScript.
The comparison retains the complete ordered `intersectCubics` operation: exact
line paths, original-parameter mapping and direction presence, initial fat-line
search, whole-pair overrun handoff, shared runs, twin detection, stalled-range
grouping and sampling, contact refinement, endpoint handling and deduplication.
No sampled source point or polynomial result crosses to the host.

The shell factory `createGeometryClipping(bytes)` validates the import-free owned
ABI. `loadGeometryClipping()` provides Node-owned byte loading. A reusable
workspace's `intersect(a,b,tolerance,limits)` returns fresh owned contacts and
per-pair work metadata; disposal is idempotent. The comparison adapter applies
metadata to every original cumulative, maximum and last counter, including the
early paths that leave last counters untouched. Production calls pass the engine's
own limits on every request: `CLIP_BUDGET` (16,384 initial nodes), `OVERRUN_BUDGET`
(131,072 overrun nodes) and `SCAN_LIMITS` (65,536 stalled pairs), with the original
16,384 gap-sampling allowance and depth limits. `GEOMETRY_CLIP_LIMITS` keeps the same
16,384 initial nodes as the qualification default for direct workspace calls. Explicit raw admission also supports existing qualification overrides: up
to 10,000,000 initial nodes and 262,144 overrun nodes. Those maxima do not change
production defaults.

Raw requests are exactly twenty float64 values: both eight-coordinate cubics,
positive tolerance, initial-node limit, overrun-node limit and stalled-pair limit.
Coordinates and tolerance must be finite and bounded by 1e9 in magnitude;
budgets must be bounded nonnegative integers. The result registry admits eight
monotonic handles, each with at most 129 contacts, preserving the reference's
128-hit stopping rule. Create returns a positive handle, -1 for invalid input,
-2 for admission/allocation failure, or -3 for nonfinite generated contacts.
Read requires an exact owned buffer: six header words (reached, initial nodes,
handoff, searched, overrun nodes, ceiling), then six words per contact
(t1,t2,x,y,direction-presence,direction). Invalid delivery writes nothing.
Large stalled-range allocations reserve explicitly and refuse the whole result
on allocation failure. Linear memory retains the 16 MiB maximum; result and
buffer ownership return to zero after disposal.

`test:geometry` requires Node and real-browser/worker clipping qualification,
then the original geometry corpus with `--clipping`. Every intercepted corpus
pair is compared against the unchanged reference for exact contacts, directions
and all work counters, in addition to the original assertions. The cross-realm
corpus transports identical immutable control bits, with production, zero and
existing test budgets, both operand orders, reversed paths, seeded pairs and
adjacent pieces from the portable fitter. Complete workflows require exact
local-reference output and counter equality while retaining each host's current
fitting path. `LOLLY_GEOMETRY_CLIP_REPORT` saves the artifact and result hashes;
CI retains that report. Other browser engines and native bit identity remain
unqualified.

`bench:geometry:clipping` uses one frozen engine bundle for 31 alternating paired
samples after ten warmups. Complete timing includes workspace ownership,
transport, both retained searches and scanning, contact/counter decoding, handle
release and disposal. TypeScript fitting, joins, broad phase and serialization
stay identical. Immutable pair replay measures the same contacts separately;
every output and work counter must agree. Timing evidence does not authorize
activation or establish editor, native or cross-device performance.

Two local M4/Node case orders give 19-23% lower complete circle-offset medians,
10-12% lower ordinary wiggle-stroke medians, about 66% lower cusp-stroke medians
and 64-71% lower difficult-pair medians. The original contacts, budgets and every
work counter remain exact; the exhausted loop still visits all 131,072 overrun
nodes. Tight-stroke p95 improves in the first pass and regresses about 5% in the
reverse pass, so tail improvement is not established uniformly. Measured linear
memory reaches 3,604,480 bytes, excluding whole-process allocation; larger
qualification inputs reach 6,225,920 bytes. Shell integration and remaining
target qualification are the next step; the live engine remains TypeScript.

## Operation-scoped engine boundary

`makeGeomApi(operations)` accepts shell-supplied numerical dependencies without
loading bytes or changing the synchronous HostV1 methods. The same dependencies
reach boolean operand cleanup, pair splitting, offset fitting and cleanup, and
stroke fitting and cleanup. Omitting them retains the TypeScript implementation.
The factory snapshots dependency identity; there is no live backend toggle.

After loading the qualified modules, a shell can call
`createGeometryOperationScope({clipping, fitting})` from
`@lolly-tools/node-shell/geometry-operation-scope`. Its immutable `operations`
object can be passed to the engine factory. Workspaces are acquired lazily and
owned by that scope. Dispose the scope in the operation's `finally` block.
Disposal is idempotent and leaves other owners intact. Returned controls and
contacts are owned values. A selected kernel's refusal is surfaced through the
existing geometry error result; no alternate numerical backend is retried.

The engine supplies the existing clipping limits for every pair and merges
complete returned metadata into its existing diagnostic counters, preserving
early paths that leave last counters untouched. Invalid bridge input is refused
before numerical dispatch. Module allocation and work ceilings are unchanged.

`bench:geometry:operations` compares default TypeScript, scoped clipping and
scoped host-reference fitting plus clipping through this boundary. Fresh owner
and factory construction, source/result copies, decoding and disposal are timed;
cold module loads are separate. `test:geometry` requires the ownership/error
tests and real Chromium/worker workflow comparisons as well as the original
corpus comparisons. `LOLLY_GEOMETRY_SCOPE_REPORT` retains the browser report.
Portable fitting retains its separate legacy compatibility finding. These
dependencies are available for qualification; web, CLI, workers and embedded
shells use TypeScript by default. Embedded webview and native activation
evidence remains outstanding.

## Long-lived host integration

`createGeometryHost({clipping, fitting})` owns one synchronous API per host.
Every boolean, offset and stroke call creates a lazy operation scope and
disposes its numerical workspaces before returning, including failure paths.
Returned values are copied and no result or input buffers remain owned between
calls. Lightweight methods retain the engine's bounded host-local caches.
The private controller reports resource accounting and can refuse further
heavy calls after disposal; those controls are absent from HostV1.

`loadNodeGeometryHost(backend)` and the CLI bridge's `geometryBackend` option
load bytes before exposing the selected API. The web shell accepts the same
option in `installToolApis(host, {geometryBackend})`. Choices are `typescript`
and `wasm-portable` (see "One portable answer" below).
Selection precedes installation, stays private to that host and never enters
tool state or saved documents. Pure CLI geometry requires no graphics device.

Isolated hooks inherit the owner's selection through browser Worker options
or Node worker data. Modules finish loading before strict ambient lockdown.
The engine worker core receives a prepared synchronous API. Selected startup
and numerical failures stay visible; no compatibility fallback retries on
another backend. Default TypeScript mounts retain their existing isolation
policy.

`bench:geometry:hosts` measures long-lived APIs against the unchanged
TypeScript factory, including per-call scope/facade creation, copying,
decoding and disposal. Cold loads and host construction remain separate.
`test:geometry` requires actual web installer, CLI constructor and isolated
hook checks; `LOLLY_GEOMETRY_HOST_REPORT` retains the browser results, including
failed comparisons. `LOLLY_GEOMETRY_BROWSER=chromium|firefox|webkit` selects the
engine used by all geometry browser tests. Required checks fail on a missing
browser or numerical mismatch. Playwright WebKit is not an embedded Tauri
WKWebView qualification.

## One portable answer

JavaScript engines do not round `Math.hypot` and the transcendental functions
the same way, so the TypeScript geometry used to give different control points
and work counts in the CLI and in Safari or Firefox. The derivative `(180,600)`
from the smooth fixture gave norm bits `40839358dd22f9a4` in V8 and
`40839358dd22f9a3` in WebKit and Firefox. Earlier lanes imported each host's maths
to match its local answer; they are retired.

The engine now computes one answer everywhere (`engine/src/geom/portable-math.ts`):

- `hypot` is V8's two-argument formula in exactly rounded operations. It matches
  Node's `Math.hypot` on 10,000,000 random pairs, so V8 bits are unchanged, and it
  is the same formula as this crate's retained norm.
- `sin`, `cos`, `tan`, `acos`, `cbrt`, `log2`, `atan2` and `pow` run in the embedded,
  import-free [`portable-math`](../portable-math/README.md) module, built with the
  same pinned Rust as `geometry-fit-portable.wasm`. Both call the same compiled
  functions, so the portable fitter returns the TypeScript reference's bits on all
  187 fitting requests.

Two backends remain. `typescript` is the reference. `wasm-portable` runs clipping
(`geometry-clip.wasm`) and fitting (`geometry-fit-portable.wasm`) in the import-free
kernels for every boolean, offset and stroke call and returns the same bits, so
choosing it is a speed decision only.

`wasm-portable` is the default (G2k-2). Web tool mounts, both hook-worker kinds, the
CLI, TUI and MCP hosts, the Design editor's vector operations and Studio 3D artwork
preparation all use it. Kernels are compiled once per realm and shared; every call
owns its workspaces. The default is not strict: if the modules cannot load, the host
logs a warning and uses the reference, and if a kernel refuses one of its own buffers
the call completes on the reference, with the clipping counters restored first. Both
paths return the bits the kernels would have returned. An explicit selection
(`geometryBackend: 'wasm-portable'`) stays strict, so qualification still sees every
loading failure and refusal. `geometrySelectionIsStrict()` reports which kind a host
has, and the host's `stats().referenceCompletions` counts completions. Both loaders reject any module with a host
import. The revision identity is `GEOMETRY_REVISION` (`geom-portable-v1`) in
`src/geometry-host.ts`; a pinned digest of the complete stage workflows and their
work counters guards it.

`test:geometry:engines` requires Chromium, Firefox and WebKit, main realm and
worker, to reproduce the pinned scalar and workflow digests, then exercises the
actual installers, isolated hooks, loading refusal and per-call release with
`wasm-portable`. Reports go to `plans/295-validation/geometry-engines` or
`--output=<folder>`. On macOS, `--isolated-firefox` selects a fresh test
application-data identity whose data stays under the report folder.

`test:geometry:tauri` runs the same digests and host checks in a separate macOS
Tauri application with the desktop's pinned Tauri, Wry and Tao, packaged assets,
the shared CSP and a nonpersistent WKWebView. It qualifies that embedded runtime,
not the installed product, mobile, Windows or Linux. Build output and reports
stay under `plans/295-validation/geometry-tauri` or `--output=<folder>`.

`bench:geometry:hosts` and `bench:geometry:hosts:browser` compare `typescript`
with `wasm-portable` through long-lived host APIs, including per-call scopes,
copying, decoding and disposal; add `--reverse` for the other case order. Every
answer and counter is checked outside timing.
