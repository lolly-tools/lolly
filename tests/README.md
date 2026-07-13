# Tests

Contract + integration tests for the engine and cross-cutting behaviour (node:test, no framework). `npm test` runs this directory together with the other co-located suites — the script in the root `package.json` is:

```bash
node --test "tests/**/*.test.js" "tests/**/*.test.ts" \
  "packages/core/test/**/*.test.ts" \
  "shells/web/src/**/*.test.js" "shells/web/src/**/*.test.ts" \
  "services/mcp/test/**/*.test.ts"
```

Use quoted globs — on current Node, `node --test tests/` tries to load the directory as a module instead of discovering test files. The repo root owns the run: tests import engine modules across the workspace boundary via `../engine/src/*.ts` (native type-stripping, explicit `.ts` extensions).

## Layout

- `tests/*.test.ts` — the bulk of the suite (~85 files). Mostly one file per engine module (`units`, `tokens`, `c2pa*`, `pdf-*`, `svg-*`, `tiff`, `zip-crypto`, …), plus runtime/hook semantics (`runtime-hooks`, `runtime-provenance`) and tool-level contract tests that load a real tool through the engine with a stub host (`color-block`, `connector-geometry`, `compress-pdf`, …). The original `validate`/`url-mode`/`inputs`/`template` suites were consolidated into `engine.test.ts`.
- `tests/fuzz/` — the untrusted-input fuzz harness (`prng.ts`, `mutate.ts`, `targets.ts`, saved inputs in `regressions/`). `fuzz-regression.test.ts` runs in the normal suite: it replays every saved regression input plus a short seeded sweep. The long discovery soak is standalone: `FUZZ_ITERS=50000 node tests/fuzz/run.ts`.
- `shells/web/src/**/*.test.ts` — co-located tests for pure (DOM-free at import) web-shell modules, e.g. `bridge/text-svg.test.ts`, `bridge/font-registry.test.ts`, `lib/*.test.ts`.
- `packages/core/test/`, `services/mcp/test/` — tool-author SDK and MCP service suites.

## Gated / conditional tests

`npm test` must stay green on a machine with nothing extra installed; these self-skip:

- **External binaries:** `c2pa-c2patool-conformance.test.ts` skips unless `c2patool` is on PATH (`brew install c2patool` to exercise it); a `qpdf --check` case in `c2pa.test.ts` skips without `qpdf`.
- **Private brand content:** tests that load SUSE tools (`color-block`, `connector-geometry`, `export-size`, `parity-constants`, …) compute a `SKIP_SUSE` flag from whether the tool exists in the active profile view (`tools/<id>/…`) and skip cleanly on public / lolly-start checkouts.
- **Fuzz env vars:** `FUZZ_ITERS` (soak length), `FUZZ_SCRATCH` (where in-flight inputs are written), `FUZZ_KEEP` tune the fuzz harness; defaults keep the in-suite regression pass fast.

## Conventions

- **Contract over internals.** Tests guard the public surface; internal refactors shouldn't break them, contract changes must — that's the point.
- **Test the real module.** Import the code under test (`../engine/src/...`, `../shells/web/src/...`). A test that re-implements or mocks the module it claims to cover verifies nothing.
- **ASCII-first console output.** The first bytes of every `console.log` line in a test file must be ASCII — a byte ≥ 0x80 near the start of a raw write can intermittently crash the `node --test` parent's frame parser. Full explanation in `font-upload.integration.test.ts`'s header.
