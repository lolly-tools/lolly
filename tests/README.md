# Tests

Contract + integration tests for the engine and cross-cutting behaviour (node:test, no framework). `npm test` runs this directory together with the other co-located suites — the script in the root `package.json` is:

```bash
node --test "tests/**/*.test.js" "tests/**/*.test.ts" \
  "packages/core/test/**/*.test.ts" \
  "shells/web/src/**/*.test.js" "shells/web/src/**/*.test.ts" \
  "services/mcp/test/**/*.test.ts"
```

Use quoted globs — on current Node, `node --test tests/` tries to load the directory as a module instead of discovering test files. The repo root owns the run: tests import engine modules across the workspace boundary via `../engine/src/*.ts` (native type-stripping, explicit `.ts` extensions).

The six globs collect **302 test files** today: 164 in `tests/`, 132 co-located under `shells/web/src/`, 4 in `services/mcp/test/` and 2 in `packages/core/test/`. The two `*.test.js` globs match nothing — the suite is entirely TypeScript — and are kept so a stray `.js` test can never be silently skipped.

## Layout

- `tests/*.test.ts` — the bulk of the suite (164 files, all at the top level). Mostly one file per engine module (`units`, `tokens`, `c2pa*`, `pdf-*`, `svg-*`, `tiff`, `zip-crypto`, …), plus runtime/hook semantics (`runtime-hooks`, `runtime-provenance`) and tool-level contract tests that load a real tool through the engine with a stub host (`color-block`, `connector-geometry`, `compress-pdf`, …). The original `validate`/`url-mode`/`inputs`/`template` suites were consolidated into `engine.test.ts`; the gradient/spline suites were consolidated into `color-ramp.test.ts` (rampOklab — gradient TOKENS stay in `gradient-round-trip.test.ts`).
- `tests/helpers/` — shared non-test helpers (`photo-like.ts`, the calibrated pixel-watermark content generator; `host.ts`, the minimal stub host for tool-contract suites). The glob only collects `*.test.ts`, so these are never run as tests; `tests/tsconfig.json`'s `./**/*` include still typechecks them.
- `tests/fuzz/` — the untrusted-input fuzz harness (`prng.ts`, `mutate.ts`, `targets.ts`, saved inputs in `regressions/`). `fuzz-regression.test.ts` runs in the normal suite: it replays every saved regression input plus a short seeded sweep. The long discovery soak is standalone: `FUZZ_ITERS=50000 node tests/fuzz/run.ts`.
- `shells/web/src/**/*.test.ts` — co-located tests for pure (DOM-free at import) web-shell modules, e.g. `bridge/text-svg.test.ts`, `bridge/font-registry.test.ts`, `lib/*.test.ts`.
- `packages/core/test/`, `services/mcp/test/` — tool-author SDK and MCP service suites.

## Gated / conditional tests

`npm test` must stay green on a machine with nothing extra installed; these self-skip (or run reduced):

- **External binaries:** all three of `c2pa-c2patool-conformance.test.ts`'s cases skip unless `c2patool` is on PATH (`brew install c2patool` to exercise them); inside `c2pa.test.ts`, a `qpdf --check` case skips without `qpdf` and a `c2patool parses the manifest store` case skips without `c2patool`; `c2pa-formats.test.ts`'s `c2patool validates the mp4 BMFF binding end-to-end` case skips without `c2patool` too. `qpdf` gates exactly one case in the whole suite. The OTHER direction — `c2pa-foreign-fixture.test.ts`, proving Lolly's *reader* parses a manifest it never wrote — is NOT gated: it reads a committed fixture (`tests/fixtures/c2patool-signed.png`, a c2patool/c2pa-rs-signed PNG) instead of shelling out, so it runs unconditionally.
- **sharp (optional native codec):** `pixel-watermark-robustness.test.ts`, `watermark-search.test.ts`, and `pptx-imprint-read.test.ts` need real JPEG/crop/resize, so they skip cleanly if `sharp` (a repo devDependency) can't load on the platform. Each does a bare `await import('sharp')` in a `try`/`catch` and turns the failure into a whole-file skip reason — those three files are the only `sharp` consumers in the suite.
- **A headless browser:** `sequence-render.browser.test.ts` is the browser tier of sequence export (WebCodecs, canvas compositing, mediabunny decode and the muxers exist nowhere else). `browserGate()` in `tests/helpers/sequence-browser.ts` skips the whole `describe` when no browser is installed, naming the fix (`npm run install:browser` in `shells/cli`, or `LOLLY_BROWSER_CHANNEL=chrome`). Because a bundled Chromium carries no guaranteed proprietary codecs, every mp4/H.264/AAC assertion is additionally gated on an in-page `VideoEncoder.isConfigSupported` probe; `LOLLY_BROWSER_PATH`/`LOLLY_BROWSER_CHANNEL` point the run at a real Chrome or Edge. VP8/VP9/Opus/WebM carry the bulk of the suite and run on any build.
- **Real ICC profiles:** none ship in the repo (a real registry file is 2–8 MB). `icc-real-profiles.test.ts` reads its fixtures from `ICC_PROFILE_DIR` (default `~/Desktop/profiles`) and skips per test, naming the missing path; a fixture that is present but does not parse FAILS rather than skipping. In `icc.test.ts`, one case reads `LOLLY_ICC_TARG` (a path to a `.icc` carrying a `targ` tag) and skips without it, optionally asserting `LOLLY_ICC_TARG_EXPECT`.
- **Private brand content:** suites that read SUSE tools gate on the SOURCE pack, not the gitignored `tools/` profile view: they skip cleanly when `brands/suse/tools` isn't mounted (public CI / lolly-start checkouts), but with the pack mounted a missing tool dir FAILS the suite — a renamed/deleted tool can't silently turn the tests green (`color-block`, `connector-geometry`, `export-size`, and the SUSE half of `parity-constants`). Community and `brands/lolly-start` tools are always present in a full checkout, so those suites (`deck-builder-freeform`, `deck-builder-markdown`, `rebrand-deck-tool`, the lolly-start half of `parity-constants`) assert existence unconditionally. (`deck-builder-style.test.ts` still gates on the `tools/` view being built.)
- **`WATERMARK_FULL=1`:** the false-positive battery in `watermark-search.test.ts` runs reduced by default (one photo-like base + one JPEG derivative, still through the full search grid); set `WATERMARK_FULL=1` to run the full 16-trial battery (~25s — most of the suite's wall time).
- **`BENCH=1`:** the wall-clock benchmark tests in `color-ramp.test.ts` skip by default (timing assertions flake under CI/laptop load); set `BENCH=1` to run and log them.
- **Fuzz env vars:** `FUZZ_ITERS` (soak length, default 300 in `fuzz-regression.test.ts` and 2500 for a standalone `tests/fuzz/run.ts`), `FUZZ_SCRATCH` (where in-flight inputs are written) and `FUZZ_KEEP` (keep the numbered scratch inputs instead of clearing them) tune the fuzz harness; defaults keep the in-suite regression pass fast.

## Where to look next

Two documents map this suite onto the things it is meant to prove:

- **[`docs/parser-inventory.md`](../docs/parser-inventory.md)** — every untrusted-input parser with its bound constants, its tests, and whether it has a fuzz target. Read it before adding a parser, and to find which of `tests/fuzz/targets.ts` covers what.
- **[`docs/threat-model.md`](../docs/threat-model.md)** — the trust-boundary table and residual-risk register, with the specific tests that hold each boundary (and the "what is not a boundary" list, so nothing here is read as proving more than it does). Its "Verify these claims yourself" section is the copy-pasteable command set.

## Conventions

- **Contract over internals.** Tests guard the public surface; internal refactors shouldn't break them, contract changes must — that's the point.
- **Test the real module.** Import the code under test (`../engine/src/...`, `../shells/web/src/...`). A test that re-implements or mocks the module it claims to cover verifies nothing.
- **ASCII-first console output.** The first bytes of every `console.log` line in a test file must be ASCII — a byte ≥ 0x80 near the start of a raw write can intermittently crash the `node --test` parent's frame parser. Full explanation in `font-upload-edge-cases.test.ts`'s header.
