<!--
Lolly is one repository, with the private SUSE brand pack as its only submodule.
The first question below is the one that still goes wrong when a change touches
that pack. See CONTRIBUTING.md for the full routing table.
-->

## What this changes

<!-- One or two sentences. Link an issue if there is one. -->

## Which repo owns each changed file?

<!--
Almost everything lives in this repository. The exception is `brands/suse/`: a
commit from the root does NOT capture an edit made inside it, because git only
sees the pointer. CONTRIBUTING.md section 4 has the path-to-repo table.
-->

- [ ] This repository (`lolly`): everything except `brands/suse/`
- [ ] `brands/suse/` (private submodule) - committed there first
- [ ] The `brands/suse` pointer bump is included where needed

## Checks

- [ ] `pnpm test` passes
- [ ] `pnpm run typecheck` passes
- [ ] Touched a `tool.json` or a catalog asset? Ran `pnpm run build:catalog:all` **and** `pnpm run validate:catalog:all` (not the singular forms: the catalog index is generated per brand, so a community tool edit leaves other brands stale)
- [ ] Added or updated a module under `engine/src/`? `pnpm run check:engine-modules` is clean (regenerate with `pnpm run build:engine-modules`)

## Security

<!--
Trust boundaries are mapped in docs/threat-model.md, and every untrusted-input
parser with its enforced bounds is listed in docs/parser-inventory.md.
-->

- [ ] This change does **not** touch a trust boundary listed in `docs/threat-model.md`
- [ ] …or it does, and the PR says which one and what still enforces it
- [ ] Touched a parser that reads untrusted bytes, or a crypto module? Added or extended a fuzz target in `tests/fuzz/targets.ts`, declared new bounds as named constants, updated `security/parser-assurance.json`, and ran `pnpm run build:parser-inventory`
- [ ] No secret, token or personal data is logged, committed, or added to an error message

## Notes for the reviewer

<!-- Anything surprising, deliberately deferred, or worth arguing about. -->
