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

Scope and the focused UI job start ahead of the long matrix. Contracts and
security have their own fast matrix, sharing the exact installation, test and
skip-report steps with the exhaustive matrix. The long matrix waits for the
initial scope/UI jobs but still runs when they fail. Qualification jobs allocate
a runner only after fast checks finish. Full-tier qualification then waits for
release-ready; the full suite and its required checks are preserved.

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
`package.json` and `pnpm-lock.yaml` are unchanged by this activation.

The bootstrap also requires the security patch from `rustls` 0.23.45 to 0.23.46
in the desktop, mobile and isolated-capture Cargo locks, with regenerated license
and SBOM records. These Tauri dependency locks are protected runtime inputs.
The first deployment after this rollout therefore needs a matched full release
baseline. A CI/test/docs metadata exception cannot authorize reuse across those
dependency changes.

## Measurements and remaining work

Browser files are assigned by measured duration, longest first onto the runner
with the least assigned time. The four runners remain serial within their own
partition. The checked-in `scripts/data/browser-test-durations.json` contains
median file durations from three complete CI runs and records their run IDs,
attempts and source commits. New files receive a ten-second estimate; removed
files are ignored. The discovered inventory, never the timing profile, selects
which tests run. Equal durations and loads use deterministic ties.

The runner and coverage gate use the same assignment function. The gate still
requires every discovered file to finish exactly once at the checked-out source,
all four complete reports, and the exact reviewed skips. A timing estimate cannot
excuse a missing, failed or cancelled test.

The 2026-10-14 merge batch exposed a large imbalance in alphabetical round-robin
assignment. Replaying the recorded file durations with the median profile gives:

| CI run | Old longest file total | Balanced replay | Reduction |
|---|---:|---:|---:|
| `38597990477` | 1,613 s | 1,157 s | 28.3% |
| `38603007081` | 1,124 s | 1,085 s | 3.5% |
| `38611784722` | 1,688 s | 1,118 s | 33.7% |

These are replay estimates, excluding queue time, setup and process overhead,
not measured improvement from a new hosted run. Preserve fresh hosted evidence
before claiming a wall-clock saving. Refresh the profile from complete successful
`browser-coverage.json` artifact sets, taking the median `summaries[].durationMs`
per file and recording the contributing source/run identities. Stale estimates
may reduce balance but cannot reduce coverage.

Two other measured targets remain separate from browser scheduling. Generated
source-map drift failed the main run `38601444707` after TypeScript had finished;
the same generated tables conflicted when integrating independent PRs. A cheap
generated-file preflight should report that before expensive checks begin.
Also, failed-job reruns of `38602962399` and `38602986096` lacked scope artifacts
for their new attempt. The current exact-attempt policy requires a complete
rerun; a future retry workflow must reconstruct that provenance explicitly.

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
