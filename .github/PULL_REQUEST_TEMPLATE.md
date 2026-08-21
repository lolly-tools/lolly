<!--
Lolly is an umbrella repo of git submodules, so the first question below is the
one that most often goes wrong. See CONTRIBUTING.md for the full routing table.
-->

## What this changes

<!-- One or two sentences. Link an issue if there is one. -->

## Which repo owns each changed file?

<!--
Committing from the umbrella root does NOT capture edits made inside a
submodule: git only sees the pointer. List the repos this PR spans.
CONTRIBUTING.md section 4 has the path-to-repo table.
-->

- [ ] Umbrella (`lolly`): `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, `brands/lolly-start/`, root files
- [ ] A submodule (name it): …
- [ ] Submodule pointer bumps are included where needed

## Checks

- [ ] `npm test` passes
- [ ] `npm run typecheck` passes
- [ ] Touched a `tool.json` or a catalog asset? Ran `npm run build:catalog:all` **and** `npm run validate:catalog:all` (not the singular forms: the catalog index is generated per brand, so a community tool edit leaves other brands stale)
- [ ] Added or updated a module under `engine/src/`? `npm run check:engine-modules` is clean (regenerate with `npm run build:engine-modules`)

## Security

<!--
Trust boundaries are mapped in docs/threat-model.md, and every untrusted-input
parser with its enforced bounds is listed in docs/parser-inventory.md.
-->

- [ ] This change does **not** touch a trust boundary listed in `docs/threat-model.md`
- [ ] …or it does, and the PR says which one and what still enforces it
- [ ] Touched a parser that reads untrusted bytes, or a crypto module? Added or extended a fuzz target in `tests/fuzz/targets.ts`, and declared any new bound as a named constant
- [ ] No secret, token or personal data is logged, committed, or added to an error message

## Notes for the reviewer

<!-- Anything surprising, deliberately deferred, or worth arguing about. -->
