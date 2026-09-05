# Tests

Contract + integration tests for the engine and cross-cutting behaviour (node:test, no framework). `npm test` discovers this directory together with every co-located suite through `scripts/run-test-suite.ts`. Discovery is deterministic, and `tests/test-shards.test.ts` proves every test file belongs to exactly one non-empty shard.

```bash
npm test
npm run test:shards       # inventory and file counts
npm run test:unit:engine
npm run test:unit:web
npm run test:contracts
npm run test:security
npm run test:tools
npm run test:browser
npm run test:tauri
npm run test:conformance
npm run test:fuzz:regression
```

Do not replace the runner with `node --test tests/`: on current Node the bare directory is loaded as a module rather than discovered recursively. The repo root owns the run, including package, web, TUI and MCP tests. The CI matrix runs all nine shards in parallel; target-specific browser and Tauri concerns stay in their own shards rather than being forced onto CLI.

CI also sets `LOLLY_SKIP_REPORT` so the custom reporter writes each skipped test's file, full parent-chain name, reason, capability and owner. `tests/expected-skips.json` is the exact reviewed Ubuntu baseline. Any new/replacement skip fails, and any expected skip that starts running also fails until its stale entry is removed. To refresh after a reviewed environment change, download all `test-skips-*` artifacts and pass every JSON file as a repeated argument: `npm run check:skip-identities -- --report=<one> --report=<two> … --write`.

## Experience scorecard

The codebase has many correctness gates; these are the small set that protect the
product promises most likely to regress while features are added. Run them together
when changing first-use, Design, export, or sequencing behaviour:

| Promise | Gate |
|---|---|
| A constrained mobile visitor gets a usable first render | `npm run check:first-load -- <preview-url>` (Lighthouse mobile smoke; run on a deploy, not every local test) |
| A first export completes and keeps its export options truthful | `node --import ./tests/css-stub.mjs --test shells/web/src/views/tool-actions.test.ts` |
| A saved/downloaded creation can be reopened exactly | `shells/web/src/views/tool-actions.test.ts` and `shells/web/src/lib/export-history.ts` (Dashboard’s Latest exports links carry the serialized URL state) |
| Design physical sizes survive the editor/export boundary | `node --import ./tests/css-stub.mjs --test shells/web/src/views/design-units-contract.test.ts` |
| A deck presents and exports as the same ordered sequence | `node --import ./tests/css-stub.mjs --test shells/web/src/lib/deck-as-sequence.test.ts tests/design-pptx.test.ts shells/web/src/views/design-topbar.test.ts` |

These are deliberately stable outcome checks, not a wall-clock test suite. The
Lighthouse gate owns real first-load timing; the local contracts own deterministic
state, units, and export parity.

## Layout

- `tests/*.test.ts` - the bulk of the suite. Mostly one file per engine module (`units`, `tokens`, `c2pa*`, `pdf-*`, `svg-*`, `tiff`, `zip-crypto`, …), plus runtime/hook semantics (`runtime-hooks`, `runtime-provenance`) and tool-level contract tests that load a real tool through the engine with a stub host (`color-block`, `connector-geometry`, `compress-pdf`, …).
- `tests/helpers/` - shared non-test helpers (`photo-like.ts`, the calibrated pixel-watermark content generator; `host.ts`, the minimal stub host for tool-contract suites). The glob only collects `*.test.ts`, so these are never run as tests; `tests/tsconfig.json`'s `./**/*` include still typechecks them.
- `tests/fuzz/` - the untrusted-input fuzz harness (`prng.ts`, `mutate.ts`, `targets.ts`, saved inputs in `regressions/`). `fuzz-regression.test.ts` runs in the normal suite: it replays every saved regression input plus a short seeded sweep. The long discovery soak is standalone: `FUZZ_ITERS=50000 node tests/fuzz/run.ts`.
- `shells/web/src/**/*.test.ts` - co-located tests for pure (DOM-free at import) web-shell modules, e.g. `bridge/text-svg.test.ts`, `bridge/font-registry.test.ts`, `lib/*.test.ts`.
- `shells/tui/src/**/*.test.ts` - co-located tests for the TUI shell's pure, Ink-free modules (`lib/block-tree.ts`, `lib/table-edit.ts`, `folders.ts`, `trust-anchors.ts`, `batch-export.ts`'s `planFolderRefs`). The run uses Node's native type-stripping, which does NOT transform JSX, so these suites must never import a `.tsx` view; anything a view needs tested lives in a `.ts` module beside it.
- `packages/core/test/`, `packages/node-shell/test/`, `packages/docs-render/test/`, `services/mcp/test/` - SDK/shared-shell/docs-render and MCP service suites.

## Gated / conditional tests

`npm test` must stay green on a machine with nothing extra installed; these self-skip (or run reduced):

- **External binaries:** all three of `c2pa-c2patool-conformance.test.ts`'s cases skip unless `c2patool` is on PATH (`brew install c2patool` to exercise them); inside `c2pa.test.ts`, a `qpdf --check` case skips without `qpdf` and a `c2patool parses the manifest store` case skips without `c2patool`; `c2pa-formats.test.ts`'s `c2patool validates the mp4 BMFF binding end-to-end` case skips without `c2patool` too. `qpdf` gates exactly one case in the whole suite. The OTHER direction - `c2pa-foreign-fixture.test.ts`, proving Lolly's *reader* parses a manifest it never wrote - is NOT gated: it reads a committed fixture (`tests/fixtures/c2patool-signed.png`, a c2patool/c2pa-rs-signed PNG) instead of shelling out, so it runs unconditionally.
- **sharp (optional native codec):** `pixel-watermark-robustness.test.ts`, `watermark-search.test.ts`, and `pptx-imprint-read.test.ts` need real JPEG/crop/resize, so they skip cleanly if `sharp` (a repo devDependency) can't load on the platform. Each does a bare `await import('sharp')` in a `try`/`catch` and turns the failure into a whole-file skip reason. `image-meta-carry.test.ts` is the fourth consumer, gated per test the same way: its two AVIF cases need a real AV1 encode (the item-write proof decodes the stamped file back to identical pixels), while the rest of the file runs everywhere.
- **A headless browser:** `sequence-render.browser.test.ts` is the browser tier of sequence export (WebCodecs, canvas compositing, mediabunny decode and the muxers exist nowhere else). `browserGate()` in `tests/helpers/sequence-browser.ts` skips the whole `describe` when no browser is installed, naming the fix (`npm run install:browser` in `shells/cli`, or `LOLLY_BROWSER_CHANNEL=chrome`). Because a bundled Chromium carries no guaranteed proprietary codecs, every mp4/H.264/AAC assertion is additionally gated on an in-page `VideoEncoder.isConfigSupported` probe; `LOLLY_BROWSER_PATH`/`LOLLY_BROWSER_CHANNEL` point the run at a real Chrome or Edge. VP8/VP9/Opus/WebM carry the bulk of the suite and run on any build. Four more files ride the same gate: `canvas-filter-probe.browser.test.ts` and `canvas-blur-lanes.browser.test.ts` (the `ctx.filter` verdict and the mip blur lane, plans/104 section 11), and the two plans/104 EXIT DEMOS, which are gates rather than scripts because a demo that only ever ran once is a screenshot - `depth-flythrough.browser.test.ts` (P1: camera, parallax, DOF, vector stills) and `lift-flythrough.browser.test.ts` (P3: walk a page to SVG with `layerIds`, enumerate it, lift it into a depth stack, fly a camera through it). Both take an out-dir env var (`LOLLY_P1_DEMO_OUT` / `LOLLY_P3_DEMO_OUT`) that additionally WRITES the artefacts they measure.
- **Real ICC profiles:** none ship in the repo (a real registry file is 2–8 MB). `icc-real-profiles.test.ts` reads its fixtures from `ICC_PROFILE_DIR` (default `~/Desktop/profiles`) and skips per test, naming the missing path; a fixture that is present but does not parse FAILS rather than skipping. In `icc.test.ts`, one case reads `LOLLY_ICC_TARG` (a path to a `.icc` carrying a `targ` tag) and skips without it, optionally asserting `LOLLY_ICC_TARG_EXPECT`.
- **Private brand content:** suites that read SUSE tools gate on the SOURCE pack, not the gitignored `tools/` profile view: they skip cleanly when `brands/suse/tools` isn't mounted (public CI / lolly-start checkouts), but with the pack mounted a missing tool dir FAILS the suite - a renamed/deleted tool can't silently turn the tests green (`color-block`, `connector-geometry`, `export-size`, and the SUSE half of `parity-constants`). Community and `brands/lolly-start` tools are always present in a full checkout, so those suites (`deck-builder-freeform`, `deck-builder-markdown`, `rebrand-deck-tool`, the lolly-start half of `parity-constants`) assert existence unconditionally. (`deck-builder-style.test.ts` still gates on the `tools/` view being built.)
- **On-device speech models:** `packages/node-shell/test/speech.test.ts` runs the REAL Kokoro (synthesize one sentence, check the word timings) and the REAL Whisper (transcribe the WAV that synthesis just produced) when both are staged under the resolved models dir (`LOLLY_MODELS_DIR`, else `shells/web/public/models`, else `~/.cache/lolly/models`); the two cases skip naming the model and the command that fetches it (`lolly models fetch kokoro` / `whisper`), and skip together when `@huggingface/transformers` cannot be resolved. About 12 s cold, 3 s warm. Everything else in the file - models-dir precedence, the refusal text, the null attach with the runtime absent, the resampler, and the pin-table drift guard against `scripts/fetch-{kokoro,whisper}-models.ts` - never skips.
- **`WATERMARK_FULL=1`:** the false-positive battery in `watermark-search.test.ts` runs reduced by default (one photo-like base + one JPEG derivative, still through the full search grid); set `WATERMARK_FULL=1` to run the full 16-trial battery (~25s - most of the suite's wall time).
- **`CORE_PACK=1`:** `core-pack.test.ts` runs `scripts/pack-core.ts` end to end - compile `@lolly-tools/core` to ESM + `.d.ts`, `npm pack` it, install the tarball into a scratch project and assert it both runs and type-checks there. Two `tsc` runs and two `npm install`s (~1 min, network on a cold cache), so it skips by default; set `CORE_PACK=1` to run. This is the only check that the PUBLISHED package works - the checked-in `exports` point at raw `./src/*.ts` for the workspace's no-build loop, which Node refuses to type-strip under `node_modules`.
- **`BENCH=1`:** the wall-clock benchmark tests in `color-ramp.test.ts` skip by default (timing assertions flake under CI/laptop load); set `BENCH=1` to run and log them.
- **Fuzz env vars:** `FUZZ_ITERS` (soak length, default 300 in `fuzz-regression.test.ts` and 2500 for a standalone `tests/fuzz/run.ts`), `FUZZ_SCRATCH` (where in-flight inputs are written) and `FUZZ_KEEP` (keep the numbered scratch inputs instead of clearing them) tune the fuzz harness; defaults keep the in-suite regression pass fast.

## Where to look next

Two documents map this suite onto the things it is meant to prove:

- **[`docs/parser-inventory.md`](../docs/parser-inventory.md)** - the generated view of every untrusted-input parser with its bound constants, tests, and fuzz target. Edit `security/parser-assurance.json`, then run `npm run build:parser-inventory`; CI checks both the generated view and the live `ALL_TARGETS` mapping.
- **[`docs/threat-model.md`](../docs/threat-model.md)** - the trust-boundary table and residual-risk register, with the specific tests that hold each boundary (and the "what is not a boundary" list, so nothing here is read as proving more than it does). Its "Verify these claims yourself" section is the copy-pasteable command set.

## Conventions

- **Contract over internals.** Tests guard the public surface; internal refactors shouldn't break them, contract changes must - that's the point.
- **Test the real module.** Import the code under test (`../engine/src/...`, `../shells/web/src/...`). A test that re-implements or mocks the module it claims to cover verifies nothing.
- **ASCII-first console output.** The first bytes of every `console.log` line in a test file must be ASCII - a byte ≥ 0x80 near the start of a raw write can intermittently crash the `node --test` parent's frame parser. Full explanation in `font-upload-edge-cases.test.ts`'s header.
