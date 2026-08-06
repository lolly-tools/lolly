# Lolly GA plan — "end user from anywhere"

**Status:** draft for review · **Owner:** Andy · **Last updated:** 2026-08-06

This plan defines what it takes for Lolly to be *generally available* to an adopter
who has no relationship with SUSE — someone who finds the public repo, clones it,
and wants to use it, brand it, or contribute to it. The repository split is an
engineering fact already; GA is the separate claim that a stranger can succeed
without SUSE gravity dragging on every path.

## 1. The core problem

The split is done as plumbing (`community/` public, `brands/suse/` private and
`update = none`, engine/schemas/api/scripts in the parent, licensed music leaving
the last public repo before Aug 29). But **"split done" ≠ "GA-ready."** Today the
whole product still points at SUSE, and the neutral clone is a *fallback*, not a
*front door*. The single GA gate everything else serves:

> **A clone with no `brands/suse` access must be a first-class product, not a
> graceful degradation.**

### Evidence in the repo today

1. **README advertises 59 tools; a public clone renders ~30.** The "Current tools"
   table (`README.md`, `<!-- tools-table -->`) is generated from the *SUSE* catalog.
   Without the private pack you fall back to `lolly-start` = community's 28
   brand-agnostic tools + 2 starter tools. Every headline tool in that table
   (Brand Lockup, Pose Geeko, Deck Studio, the music tools) is invisible to the
   adopter. First impression: a catalog half the advertised size with the marquee
   items missing.
2. **`default: "suse"` means the stranger lands on a fallback.** `profiles.json`
   defaults to `suse`; `scripts/use-profile.ts` silently drops to `lolly-start`
   when the private pack is absent (the `isComplete()` fallback, ~line 350). That's
   a degradation mechanism doing a product decision's job.
3. **No hosted instance for pure users; no deploy story for adopters.**
   `lolly.tools` is SUSE's branded Vercel deploy. A Tier-A user ("just let me make
   an asset") has nowhere to go. A Tier-B adopter has `scripts/ingest-brand.ts`
   (390 lines, real) but no golden path from clone → my tokens → my deployed
   instance.
4. **`ingest:brand` is the whole adoption funnel and it's undocumented in the
   open.** `docs/` is a submodule not checked out on a plain clone, so
   `authoring-tools.md` and the brand-ingest guide are absent exactly when a
   newcomer needs them.

## 2. The adoption model — three tiers

GA = each tier has a **designed, documented, tested** golden path with zero
dependency on the private `brands/suse` pack.

| Tier | Who | Golden path | GA bar |
|---|---|---|---|
| **A — User** | "I just want to make an asset" | open a neutral public hosted instance / install the PWA | a brand-neutral instance exists at a stable URL; PWA installs; renders 100% offline |
| **B — Adopter** | "I want *my* brand" | clone → `ingest:brand` my tokens → deploy my instance | one-command ingest, documented; one-command/one-click deploy; whole path never needs the private submodule |
| **C — Contributor** | "I want to add a tool" | author a community tool → PR to `lolly-tools` | authoring guide public; CI validates a community-only clone; contribution governance published |

## 3. Phased plan

### Phase 0 — Aug 29 hard gate (the only dated item)

Non-negotiable, licensing-driven. Everything else is quality-gated, not
calendar-gated.

- [ ] Licensed PremiumBeat music out of the last public repo.
- [ ] Archive retired public repos (`lolly-suse-tools`, `lolly-suse-catalog`).
- [ ] Audit: no licensed/proprietary asset reachable from any public clone
      (`git clone --recurse-submodules` as an anonymous user → grep for SUSE
      trademark assets, fonts beyond the OFL faces, PremiumBeat).
- [ ] Confirm the OFL faces (`catalog/fonts/`) and their `OFL.txt` are the only
      typefaces a public clone ships, and the "SUSE" trademark note is intact.

**Exit:** an anonymous recursive clone contains nothing SUSE-proprietary.

### Phase 1 — Make the neutral clone a real product

This is where the "fallback → front door" flip happens.

- [ ] **Front-door profile decision (see §4).** Recommendation: default the public
      product to **community-tools-only**, and reposition `lolly-start` as the
      *starter brand adopters fork*, not the accidental fallback.
- [ ] Change `profiles.json` `default` (or the public deploy's `LOLLY_PROFILE`) so
      the public front door is a *chosen* profile, and the private-pack absence
      path is an explicit adopter branch, not a silent warning.
- [ ] Generate the README tools table **per profile** so a public reader sees the
      ~30 tools they actually get; present SUSE as *one example brand pack*, not
      the headline catalog. (`npm run build:readme-tools` already reads the active
      profile — wire it to emit the public profile for the public README.)
- [ ] Publish `docs/` so `authoring-tools.md` and the brand-ingest guide are
      visible on a plain clone (check-out policy or a mirrored copy in the parent).
- [ ] Rewrite the README top-of-fold from SUSE-voiced to platform-voiced: "bring
      your own brand" is the *product*, SUSE is *a* reference implementation.

**Exit:** a fresh public clone builds, runs, and *reads* as its own complete
product with an accurate tool count and visible authoring docs.

### Phase 2 — The two deploy stories

- [ ] **Tier A — neutral hosted instance.** Stand up a public instance on a stable
      URL, as a Vercel project separate from `lolly.tools`, pinned to the
      community/starter profile (`LOLLY_PROFILE` set explicitly so a git build can
      never silently ship the wrong brand — the `use-profile.ts` VERCEL guard
      already refuses a silent fallback).
- [ ] **Tier B — "deploy your brand."** A documented `ingest → build → deploy`
      path that never touches `brands/suse`. Target one-command (`loldev`-style)
      or one-click (Deploy-to-Vercel button) with `ingest:brand` as step one.
- [ ] Adopter smoke test: from a clean machine, `ingest` a sample DTCG token set →
      build catalog → run web → export an asset in the new brand. Scripted, in CI.

**Exit:** a stranger can either *use* a hosted Lolly or *deploy their own branded*
Lolly, each from a single documented command/click.

### Phase 3 — Governance & versioning for a real OSS project

- [ ] **Platform "1.0 GA" tag** on the umbrella, pinning a known-good submodule
      combination. (Engine is already at **1.92** per the latest commit — the
      1.77 in CLAUDE.md is stale; versioning discipline is itself a GA task.)
- [ ] Naming / trademark: settle "Lolly" vs "SUSE" ownership of `lolly-tools`, the
      trademark boundary (SUSE marks stay in the private pack), and the public
      project's identity.
- [ ] `CONTRIBUTING.md` governance for community-tool PRs: review authority, the
      `status: official | community | experimental` maturity ladder, what bar a
      new community tool must clear.
- [ ] `SECURITY.md` disclosure path confirmed for external reporters; threat-model
      / parser-inventory docs public.

**Exit:** an external contributor and an external security reporter each have a
published, working path.

### Phase 4 — Adoption-quality polish (ongoing)

- [ ] **CI matrix leg: community-only clone as first-class.** Build + `npm test` +
      `validate:catalog:all` against a clone with the private pack absent, so
      SUSE-gravity regressions (a community tool that assumes a SUSE asset, a doc
      link into the private pack) fail the build.
- [ ] Release cadence + changelog per submodule; umbrella changelog for the pinned
      combo.
- [ ] Adopter-facing "getting started in 5 minutes" that a real newcomer has
      walked through end-to-end.

## 4. The one open decision — the public front door

Everything in Phase 1 hangs off this. Two options:

**Option A — community-tools-only default (recommended).** Honest and minimal:
"here's the engine + neutral tools, bring everything else." Lowest maintenance, no
starter brand to keep fresh, the tool count in the README is exactly what ships.
`lolly-start` becomes the documented *fork-me* starter brand rather than the
default.

**Option B — a designed starter brand richer than today's 2-tool `lolly-start`.**
More impressive first run, but a second brand to design and maintain, and it blurs
the "bring your own brand" message with a curated one.

Recommendation: **A**, with `lolly-start` repositioned and lightly polished as the
adopter's fork target. Revisit if first-run impressiveness proves to be the
adoption blocker.

## 5. GA definition of done

Lolly is GA when, with **no SUSE access**, a stranger can:

1. **Use** it — open a hosted neutral instance or install the PWA, make and export
   an asset, offline.
2. **Brand** it — `ingest:brand` their own tokens and deploy their own instance
   from one documented command/click.
3. **Extend** it — author a community tool and open a PR that CI validates on a
   community-only clone.

…and the public README, tool count, and docs describe *that* product — not SUSE's.

## 6. Open questions to resolve next

- Front-door profile (§4) — needs a decision to unblock Phase 1.
- Who owns the public hosted Tier-A instance (cost, domain, ownership)?
- Is one-click Deploy-to-Vercel the Tier-B target, or CLI-only for GA?
- Naming/trademark sign-off — does this need SUSE legal, and on what timeline?
