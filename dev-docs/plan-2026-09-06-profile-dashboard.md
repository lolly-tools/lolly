# Plan: one profile view (2026-09-06)

Merge `#/d` (the dashboard) into `#/profile`, and make the brand hero's ink readable on any brand.

File references: `lolly-web` at `45ee61a`.

## 1. What exists

`views/dashboard.ts` (1517 lines) is documented as a read-only mirror of Profile (`:1-35`, "a mirror, not a move"): tabs device, brand, caps, activity from `views/dashboard-registry.ts`; the brand hero, palette instruments, token chips, print reference, this-device readout, capability map, activity and storage. `views/profile.ts` (3361 lines, a maintainability hotspot at 2438 logical lines) is the managing surface: thirteen collapsible sections from `:247-266`. Overlap: activity (both call `renderActivity`), storage (the dashboard links out to the profile to manage it, `:707`), the design system (hero in the dashboard, card in the profile). Routes: `#/profile` (`main.ts:1727`), `#/d` and `#/dashboard` (`:1728`), `/platform` and `/capabilities` (`:1829-1833`), `#/b` and `#/brand` (`:1734,1741,1890`).

The hero ("The brand in force", "Adjust your brand", `dashboard.ts:196-227`) paints `--brand-surface` and `--brand-text` straight from `applyBrandVars` (`brand-vars.ts:1002-1019`) with shell-token fallbacks (`styles/parts/dashboard.css:201-261`). Text is the brand's own `text` and `on-primary` slots, never derived, so a brand with a pale surface and pale text is unreadable. No APCA or contrast code touches the hero; the engine has `apcaContrast` and `apcaUse` (`engine/src/color-tools.ts:143,212`) and `contrastRatio` (`brand-derive.ts:403`). A stale comment at `brand-vars.ts:268` says the profile gates the card.

## 2. Design

### 2.1 Structure

`#/profile` with four tabs, the dashboard's, holding the profile's cards:

- **Brand**: the hero and instruments, then Design systems.
- **You**: Your details, Content Credentials, Appearance, Accessibility, Connected services.
- **Device**: This device, Storage (the managing version), Available offline, Hot folder, Capabilities.
- **Activity**: the summary, Your renders, Feature flags, Lolly instance.

`?tab=` selects a tab; `?focus=<section>` still opens and scrolls to a card. Every old route redirects to the right tab. The home FAB and back pill mount once.

### 2.2 Code

One module per tab under `views/profile/` (`brand.ts`, `you.ts`, `device.ts`, `activity.ts`), a thin `views/profile.ts` that owns routing, tabs and the section registry, and `views/dashboard.ts` deleted. The registries in `dashboard-registry.ts` and `profile.ts:247-266` merge into one list with a `tab` per entry. Lazy bodies stay lazy. This is the seam the maintainability budget has been asking for: `profile.ts` must end below its 2438 baseline, and the four tab modules stay under the 1500 soft line limit.

### 2.3 The hero's ink

After `applyBrandVars` runs (`dashboard.ts:1044-1056`), read the resolved surface and primary, compute `apcaContrast('#000', bg)` and `apcaContrast('#fff', bg)`, and set `--brand-hero-ink` and `--brand-hero-on-primary` to whichever has the larger absolute Lc. Keep the brand's own `on-primary` when its Lc against the primary clears the body-text band (`apcaUse`); otherwise override. The CSS uses the two new properties with the brand slots as last fallback. Same rule for the Design systems card summary. Land this first on the dashboard, one small PR, then carry it into the merged view.

### 2.4 Docs

`lolly-docs` pages that name the dashboard and the two docs shots move to the profile; recapture with `scripts/build-docs-shots.ts --only=…` after `scripts/propagate-shot-recipes.ts`.

## 3. Tests

- Route redirects in `main.test.ts` (every old route to its tab), `?focus` still scrolls.
- The merged registry: every former section is present exactly once and on the tab the table above names.
- Hero ink: three token sets (pale, dark, and a brand whose own on-primary reads) in `views/profile/brand.test.ts`.
- `check:maintainability` passes with `profile.ts` lower than the baseline.

## 4. Order and size

1. Hero ink on the dashboard (S). 2. The merge (M): registries, tab modules, redirects. 3. Docs and shots (S). Repos: `lolly-web`, `lolly-docs`.
