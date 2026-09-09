# `_shared/` - canonical helper corpus for tool hooks

Tool `hooks.js` files ship as **data, not code**: self-contained plain JS with
no imports, so one tool runs unchanged in browser, Tauri, and CLI. That rule
used to force byte-identical helper blocks to be copy-pasted across the
filter-* tools (and logo-wall) - and to silently rot apart.

This directory is the **authoring-time** fix. Each `.js` file here is the
canonical source of one or more named regions:

```
// === lolly:shared <name> - canonical source; edit here and run pnpm run sync:shared ===
...helper code...
// === /lolly:shared <name> ===
```

Consuming `hooks.js` files carry a byte-for-byte copy of each region between
matching markers:

```
// === lolly:shared <name> - generated from community/_shared/<file>; edit there and run pnpm run sync:shared ===
...same helper code...
// === /lolly:shared <name> ===
```

## Workflow

1. Edit the region in the canonical file here - **never** inside a consumer.
2. `pnpm run sync:shared` - rewrites every marked region in `community/*/hooks.js`
   and `brands/*/tools/*/hooks.js` from the canonical source. Idempotent.
3. `pnpm run validate:catalog` - fails CI if any marked region drifts from its
   canonical source (same fail-closed style as the index-drift check).

## Rules

- Shipped `hooks.js` stay self-contained: the sync copies bytes; nothing here
  is ever imported at runtime.
- Regions must remain drop-in fragments: top-level `function`/`var` only,
  depending at most on `host` being in scope.
- Region names are global across all files here; the sync fails on duplicates,
  malformed or nested markers, and CRLF line endings.
- This is not a tool directory - underscore-prefixed directories are excluded
  from the `tools/` profile view (`scripts/use-profile.ts`) and from catalog
  validation.
- Only add a region when consumers are genuinely byte-identical **today**;
  helpers that legitimately differ per tool (e.g. the various `getImage`
  caches) stay per-tool.
