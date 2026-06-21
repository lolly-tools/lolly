# Engine Tests

Contract tests for the engine. Run with `npm test` (or `node --test tests/`).

These tests guard the public surface only — internal refactors should not break them, but contract changes must.

## Coverage areas

- **`validate.test.js`** — schema validation accepts well-formed manifests and rejects malformed ones
- **`url-mode.test.js`** — URL params round-trip through inputs cleanly; reserved names ignored; unknown params ignored (forward-compat)
- **`inputs.test.js`** — input model resolves defaults, applies profile bindings, enforces constraints
- **`template.test.js`** — Handlebars hydration escapes by default; asset helper produces URLs; missing values render falsy paths

If you change the bridge contract or any schema, expect tests here to need updating — that's the point.
