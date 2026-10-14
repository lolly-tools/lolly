# CI qualification and rapid UI updates

One CI run produces two levels of evidence. The complete suite continues for
every change. The `qualification` check chooses the required level from a
conservative source classification. Deployment still requires an independent
source compatibility check and fresh provider evidence.

| Check | Scope | Required results |
|---|---|---|
| `public-ready` | Eligible web UI source and canonical UI token changes | Secret history, typecheck, production build and bundle budget, contracts, security, catalog validation, all-tool render smoke, custom static security rules, deployment scope and focused UI tests |
| `release-ready` | Every change | All public-ready checks plus engine/web/tool units, all four browser shards and their execution gate, Tauri, conformance, regression fuzzing, API bundle drift, rendering action and dependency audit |
| `qualification` | Every change | The selected successful aggregate and a fresh scan of every job in the same attempt |

`test (public-ready UI)` always runs. It executes the five files in
`scripts/run-public-ready-ui.ts`, including canonical token generation drift,
shared UI primitives, edge docking and navigator behavior. A skipped test fails
this focused check. Run the same set locally with the repository's pinned Node:

```sh
node scripts/run-public-ready-ui.ts
node --test tests/ci-qualification-contract.test.ts tests/workflow-pins.test.ts
```

The fast scope permits regular files in web components, styles and views,
selected docking/token helpers, their focused tests and the two canonical UI
token documents. Auth, account, session, profile, identity, instance, policy and related protected filenames
are excluded even within those directories. A substantive UI change is required.
Startup, bridges, catalog code, engine, backend, dependencies, workflows, CI
policy, unknown paths, executable files and symlinks require the full tier.
The exact allowlist lives in `scripts/ci-qualification.ts`; a documentation
description never grants additional scope.

For PRs the checked source can be GitHub's merge commit; `headSha` separately
records the provider's PR head. Scope and qualification policy are executed from
the exact event base commit. Candidate changes cannot relax that base policy.
When the base has no policy, the bootstrap scope is full-only. Every policy or
workflow edit also requires release-ready.

## Artifact handoff

Successful tier jobs upload `public-ready-<runId>-<runAttempt>` or
`release-ready-<runId>-<runAttempt>`. The stable aggregate uploads
`qualification-<runId>-<runAttempt>`. Each contains `qualification.json`,
`scope.json`, unchanged `run.original.json` and all
`jobs-<page>.original.json` provider pages. Poll snapshots preserve the original
observations. Artifacts remain available for 14 days; the private operator must
retain the evidence required by its release record before expiry.

The version 1 qualification record contains:

- `status: CI_QUALIFIED`, `qualificationTier` and `fullSuiteQualified`.
- Exact `source`, `tree`, `base`, provider `headSha`, repository name and numeric
  ID, head repository and branch, event, run ID, attempt and workflow path.
- `scope.publicReadyEligible`, `policyCommit`, `policySha256` and
  `changedPathsSha256`. The policy digest is null only for full-only bootstrap.
- `requiredJobs`, each with provider job ID, exact name and success conclusion.
- `provider.run` and `provider.jobs`, each with a relative path and SHA-256 of
  the original bytes, plus `capturedAt`.
- `publicationEligible`, `knownFailuresRejected: true`,
  `lateFailureCheckRequired: true` and `productionMutation: false`.

Only a same-repository main push with `source === headSha` is publication
eligible. PR artifacts cannot authorize publication. A complete, unambiguous
job inventory is required. Failed, cancelled, timed out or unexpectedly skipped
jobs prevent qualification, including jobs outside the selected tier. The only
expected skips are `verified instance shell`, and `public-ready` when the
trusted scope requires release-ready.

An early green result cannot predict later failures. Before publication the
consumer must fetch the same run and attempt again, inspect every current job,
verify the required successful aggregate and ensure the candidate is still
current main. Any known failure blocks publication. The artifact is CI evidence;
private catalog signatures, shell compatibility, build custody and production
readiness remain separate checks.

## Activation and the private deployment boundary

The existing `main-web-preparation.yml` full image workflow still waits for
completed CI. The early tier artifact supports the separate Work preparation
workflow without starting another Lolly CI pipeline or publishing from this
public repository.

After activation, request the current main commit from Lolly's Actions page or
the same manual workflow through the CLI. Set `SOURCE_SHA` to the exact main
commit and `CI_RUN_ID` to its qualified CI run:

```sh
gh workflow run shell-deployment-request.yml --repo lolly-tools/lolly --ref main \
  -f source="$SOURCE_SHA" -f ci_run="$CI_RUN_ID" -f ci_attempt=1 \
  -f tier=public-ready
```

Use `release-ready` for the full tier. The wrapper pins the Work reusable
workflow and its operator checkout to the same immutable commit. Its token can
read Lolly's CI artifacts; neither workflow has production credentials. The
resulting `shell-request-<runId>-<runAttempt>` artifact is input to the private
operator, which repeats qualification before publication. This request does not
build private brand content or change production.

Activate the stable `qualification` branch-protection requirement only after
this workflow change completes genuine full CI and its policy is reviewed.
Existing individual required checks remain in force until that explicit
protection update. Requiring the old exhaustive checks alongside the new
aggregate still waits for the full suite.

This initial policy/workflow/helper change is release-ready. The private shell
producer compares its accepted engine baseline with the candidate, so these
new non-runtime files can still require a compatibility policy update or a new
matched baseline. Any private exception must name the reviewed CI/test/docs
paths, require full-tier evidence for the transition and preserve every protected
runtime input. Fast CI eligibility alone does not permit engine reuse. Root
package and lock files are unchanged by this activation.

## Measurements and remaining work

On the 2026-10-14 main run `38553705860`, the original eight fast checks passed
in 8 minutes 57 seconds; the complete suite took 38 minutes 43 seconds. The
focused UI set ran 175 checks in 10.23 seconds locally. Hosted queue/install time
still affects the new focused job, so these measurements are evidence for the
split, not a promised deployment duration.

The same deployment's frontend producer took 368.95 seconds: Vite used 10.78
seconds and retention plus manifest work used 238.92 seconds. The next useful
optimizations are reusable verified manifests, bounded static deltas and fewer
remote round trips. Reusing a verified generation under unchanged custody
already reduced one validation from 139.15 seconds to 4.31 seconds. Content
integrity and current/rollback retention must remain checked when introducing
those optimizations.
