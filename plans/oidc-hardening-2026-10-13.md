# OIDC hardening across Lolly and Lolly Work

Status: implemented and locally verified, 2026-10-13; production qualification remains an operator rollout step.

## Objective and boundaries

Harden the existing relying-party flows and make identity lifecycle policy explicit. Keep authentication in server and shell code, outside the engine. Preserve the standalone MCP shared-secret model. Production rollout is a separate reviewed operation.

Work is isolated on `fix/oidc-hardening-20261013` in each repository. Both main checkouts have existing changes owned by other work. This is the canonical cross-repository plan; implementation evidence will be recorded here and in the Work companion plan.

## Delivery

- [x] Replace hand-written JWT verification in both services with maintained JOSE verification and aligned OIDC policy. Require issuer, subject, audience, expiry and issue time; restrict algorithms and trusted audiences; validate nonce and provider-specific authorized-party rules.
- [x] Validate discovery before any endpoint is used: configured issuer binding, HTTPS, bounded requests and metadata shape checks.
- [x] Fix CA key rotation and email trust: refresh on an unknown key, require verified email by default, and make an enterprise trust exception explicit. Remove the GitHub profile-email fallback that carries no verification evidence.
- [x] Support explicit token endpoint authentication configuration and document the supported algorithm set.
- [x] Add optional per-provider assurance and freshness requirements. Verify returned claims rather than relying on authorization-request hints.
- [x] Add explicit IdP sign-out and verified back-channel logout with durable replay protection and revocation across replicas.
- [x] Apply the agreed linked-identity standing policy and enforce expiry on active sessions. Preserve immediate SCIM/admin revocation.
- [x] Add regression coverage, run affected typechecks and wording/lint gates, review diffs, and commit and push both branches.
- [x] Record provider configuration and acceptance tests needed before rollout. Local tests do not establish live interoperability.

## Governance decisions

The user selected these policies during implementation:

1. Ordinary logout remains local, with a separate explicit IdP sign-out action.
2. Linked-identity standing remains 30 days, with SCIM/admin revocation.
3. Authentication assurance requirements are optional and configured per provider.
4. Back-channel logout ends only the named IdP session and its local descendants;
   other sign-ins remain active. Providers must send `sid`; subject-only logout
   notifications are refused rather than broadening the requested scope.
5. CA email verification is strict by default, with an explicit managed-issuer
   exception for an omitted claim. False and malformed claims remain refused.

## Acceptance evidence

Use generated signing keys and stub IdP endpoints for valid tokens, missing/mistyped claims, unrelated audiences, issuer/nonce mismatch, expired/future tokens, key rotation, malformed discovery, supported client authentication, assurance failures, logout replay and revocation. Existing multi-provider, identity linking, admission, SCIM, session and CA enrollment tests must pass. Correct old fixtures omitting mandatory OIDC claims rather than weakening validation.

## Findings and implementation choices

The review demonstrated missing `iat` and unrelated additional-audience acceptance in Work. Current OIDC Core errata treats `azp` as extension-specific: a different `azp` alone is not a universal Core violation. The supported provider profile must state its policy. The CA uses the discovered issuer as its own expectation and lacks early key rotation refresh. Normal Work logout clears browser cookies only. Linked identity groups can carry across sign-ins for 30 days.

Use the same maintained upstream JOSE implementation in both repositories. Avoid a cross-repository runtime source dependency or any engine authentication dependency. Include lockfiles, license inventories and server packaging in validation.

## Verification and deployment handoff

- Lolly: 53 affected CA, profile/account and documentation tests passed, including
  scans of the built documentation. Web, web-test and root-test TypeScript checks
  passed. Changed-source lint, code-comment and UI-copy gates passed.
- Work: 114 identity/admission/linking/session/SCIM regressions passed with an
  isolated PostgreSQL database, including concurrent durable logout replay checks.
  Six rate-limit tests and the HTTP lifecycle test also passed after adding logout
  throttling. Typecheck, documentation/comment gates and console revision checks passed.
- Work full suite: 2,409 tests, 2,323 passed, 79 skipped, seven failed. Six failures
  reproduced on unchanged base 26aa9c0: five filesystem-clone cases hit the host's
  less-than-2-GiB free-space guard and one demo-brand token-render fixture failed.
  The engine-manifest case passed on the base and on an isolated rerun of this branch.
  These failures are recorded, not hidden by changes to unrelated code or test gates.
- Both dependency locks and license inventories are updated; Work's CycloneDX SBOM
  and console revision are regenerated. Lolly's CA serverless artifact is regenerated.
  The CA Docker manifest-only frozen production install selected jose 6.2.12 as
  expected. A container build was not possible without a running Docker daemon.
- The disposable PostgreSQL server was stopped. Generated test/build files were
  removed where practical to recover space; shared main checkout changes were untouched.
- Managed installation and lifecycle instructions are in Lolly's deployment guide,
  CA README and Docker/Helm guides, and Work's enterprise-identity runbook linked from
  its installation, deployment, configuration, operations and Helm guides.
- Live-provider acceptance remains required: discovery/claims, explicit logout
  without an ID-token hint, sid-specific notification delivery, SCIM offboarding,
  real signing-key rollover and ingress behavior. No production change was made.

Session-specific logout requires sid in ID and logout tokens. Newer issue times do
not revive that sid. Revocation targets are retained beyond Work's maximum session
chain; the deployment runbook explains legacy-cookie cutover, migration 0067 and
why rolling back to older server code weakens enforcement.

## CI follow-up

Lolly CI passed every test shard, build/bundle checks, API bundle drift, catalog
checks and static security scanning. The jobs named typecheck and npm audit
stopped on stale generated metadata: web source README statistics and the root
CycloneDX SBOM. Regenerated both and verified the README check and repeat SBOM
generation locally. CI is rerunning on the corrected generated files.

Work CI built and booted its BCI image, built both service containers, and passed
its typecheck, audit, Helm and database restore checks. Its sole test failure was
the missing console registry entry for the new guide; the companion PR corrects
that entry and passes the affected documentation tests locally.
