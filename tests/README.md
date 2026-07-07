# Engine Tests

Contract tests for the engine. Run with `npm test` (or `node --test tests/`).

These tests guard the public surface only — internal refactors should not break them, but contract changes must.

## Coverage areas

- **`validate.test.ts`** — schema validation accepts well-formed manifests and rejects malformed ones
- **`url-mode.test.ts`** — URL params round-trip through inputs cleanly; reserved names ignored; unknown params ignored (forward-compat)
- **`inputs.test.ts`** — input model resolves defaults, applies profile bindings, enforces constraints
- **`template.test.ts`** — Handlebars hydration escapes by default; asset helper produces URLs; missing values render falsy paths
- **`color-block.test.ts`** — tool-level contract: loads the real color-block tool (manifest + template + hooks) and drives it through the engine with a stub host. Covers the logo-block variant matrix (orientation × mono/green × background polarity), per-block colour fallback/contrast, the unified `--scale` knob, one-cell-per-block structure, click-to-focus markers, and the two consistency guarantees — pure render (identical inputs → byte-identical DOM, so every export format agrees) and lossless URL round-trip (CLI ⇄ web parity).

If you change the bridge contract or any schema, expect tests here to need updating — that's the point.
