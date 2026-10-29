# Contributing to Lolly

This file is a **router**. It tells you where things live and which command to run before you open a pull request. The concepts themselves are explained elsewhere and linked from here rather than repeated.

Start with [`README.md`](README.md) for what Lolly is, and [`docs/`](docs/) for the architecture and authoring guides.

**Contributing one tool? You can skip the clone.** A tool is a folder: `tool.json`, `template.html`, and whatever else it needs. Write one, zip the folder, drop the zip on [lolly.tools](https://lolly.tools) or any Lolly instance, and choose **Install this tool** to run it on that device. When it works, open a pull request against [`lolly`](https://github.com/lolly-tools/lolly) with your tool under `community/<id>/`. The steps and the consent prompt are in [Try it without cloning](docs/authoring-tools.md#try-it-without-the-monorepo). Everything below is for changing the platform itself.

**History before 2026-09-11.** Until that date the shells, docs, services and the community tool pack each lived in their own repository under `github.com/lolly-tools`, mounted here as git submodules. They were folded into this one repository with `git subtree add`, which carries over every commit, author and message but not path continuity: a plain `git log -- shells/web/src/main.ts` stops at the fold. Use `git log --follow` to cross it, and `git blame --follow` for line history that predates the fold. The ten former repositories are archived on GitHub, each with a redirect note naming the commit it was folded at, and pre-fold bundles are kept for anyone who needs a clone of just one shell's history.

## 1. Clone, then install

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly

# Install the pinned package manager once (or use Corepack).
npm install --global pnpm@11.1.2
pnpm install
```

Use the pinned pnpm version in `packageManager`. Commit `pnpm-lock.yaml` when dependencies change; CI and deployments use `pnpm install --frozen-lockfile`. Workspace dependencies use `workspace:*` so published packages cannot silently replace local code. Pass script arguments directly, for example `pnpm run profile lolly-start`.

Tauri desktop and mobile are separate pnpm projects with their own lockfiles, deliberately kept out of the root workspace; run `pnpm -C shells/tauri-desktop install` or `pnpm -C shells/tauri-mobile install` before building them.

After dependency changes, run `pnpm run update:npm-licenses`, `pnpm run build:sbom` and `pnpm run build:licenses`, and commit the generated license cache and notices. The cache records registry license metadata for exact versions, including optional packages for other operating systems.

## 2. The one private pack, and why it does not block you

`brands/suse` is a private submodule holding SUSE's tool and asset pack, including licensed fonts and PremiumBeat music. It is declared `update = none` in [`.gitmodules`](.gitmodules), so a plain clone or `git submodule update --init --recursive` never fetches it and no credential prompt appears.

Tool and asset content is otherwise mounted as packs, resolved at build and run time from [`profiles.json`](profiles.json) by `packages/node-shell/src/content-roots.ts` - there is no repo-root `tools/`/`catalog/` view written to disk:

| Profile | Tool roots | Catalog |
|---|---|---|
| `suse` (the declared default) | `community` + `brands/suse/tools` | `brands/suse/catalog` |
| `lolly-start` | `community` + `brands/lolly-start/tools` | `brands/lolly-start/catalog` |

Without `brands/suse` mounted, the default `suse` profile is incomplete on your machine, which the resolver handles deliberately: it checks `LOLLY_PROFILE`, then the sticky choice from your last explicit pick, then the default, and if the default's packs are not all present on disk it falls back to the first profile whose packs are complete. In a public clone that is `lolly-start`, the blank starter brand. Everything builds, renders and tests from there.

Switch explicitly at any time:

```bash
pnpm run profile              # print the resolved profile and its roots
LOLLY_PROFILE=lolly-start pnpm run dev:web    # blank starter brand, community tools only
LOLLY_PROFILE=suse pnpm run dev:web           # needs: git submodule update --init --checkout brands/suse
```

## 3. Where your changes go

Keep local validation output under the ignored `plans/` directory: exported
movies and PDFs, review screenshots, experiment corpora, machine-specific reports
and scratch scripts. Reusable tests, fixtures, recipes and their generators belong
in the maintained source tree. Generated files required by a plain clone or deploy
(catalog indexes, tool hooks and API bundles) stay committed. Dependency caches,
build directories and local service configuration keep their standard locations.

Almost everywhere, a change is one commit in this repository: `engine/`, `schemas/`, `scripts/`, `tests/`, `api/`, root files, `community/`, `brands/lolly-start/`, `profiles.json`, `docs/`, `services/mcp`, `services/ca`, and every `shells/*`.

The one exception is `brands/suse`: it is a separate, private repository (`suse-lolly`), mounted as a submodule. A change there is a commit inside `brands/suse`, then a second commit here recording the new pointer. Committing from the repo root does **not** capture edits made *inside* the submodule - git only sees the pointer.

One case still deserves care even though it is no longer a cross-repo edit. `catalog/tools/index.json` is generated **per brand**, and every brand's index lists the community tools - so editing a community `tool.json` leaves the SUSE profile's index stale even though both live in the same repository now, and the single-profile `pnpm run build:catalog` can't see the drift because it only looks at the active profile. After any community tool change:

```bash
pnpm run build:catalog:all      # rebuild every mounted profile, then restore the active one
pnpm run validate:catalog:all   # validate every mounted profile; exits 1 on drift (the CI guard)
```

A profile whose packs are not mounted is skipped rather than failed, so `brands/suse` being absent is fine.

## 4. Commands to run before you open a PR

Enable the local push checks once with `git config core.hooksPath scripts/git-hooks`
and use the Node version in `.nvmrc` (`nvm use`). The hook invokes Node directly;
`LOLLY_NODE` can name that executable when a Git client has a different PATH.
The hook does not invoke a package manager or install dependencies.

The hook first refuses new commits that add or change a file under `plans/`.
That folder is gitignored and private to one machine, and `git add -f` is the
only way a file there gets committed. Deleting a tracked `plans/` file passes.
Check a branch with `node scripts/check-pushed-plans.ts HEAD`.

Before the wording checks, the hook builds the web source map and engine module
table in each distinct commit tip being pushed. Branch creation, forced updates,
multiple refs and annotated tags use Git's supplied object IDs. Deletions skip
source checks. Intermediate commits are not checked when a later tip repairs
them. The check reads raw Git blobs into a temporary directory, runs that commit's
generators with `--check --allow-drift`, and removes the snapshot. Staged changes,
unstaged changes and untracked files cannot change the result and remain
untouched.

Stale counts never refuse a push and never fail a pull request. Every merge moves
the generated counts in `shells/web/src/README.md` and `engine/README.md`, so a
pull request that committed its own copy conflicted with every other open pull
request. Pull requests leave those files alone; CI reports drift as a warning,
and `.github/workflows/generated-readmes.yml` regenerates both after each push to
main and proposes them as one bot pull request, "chore: regenerate generated
READMEs". The hook and CI still refuse a map that cannot be built: a missing
generator, missing or misordered markers, or a generator error.

To check a particular commit or branch before pushing:

```sh
node scripts/check-pushed-generated.ts HEAD
```

To see the regenerated maps locally (you do not need to commit them; the bot
pull request carries them after the merge):

```sh
node scripts/gen-web-src-readme.ts
node scripts/gen-engine-modules.ts
```

The existing wording checks still inspect the working tree. A local pass does not
qualify a release.

The bot pull request is opened and refreshed with the lolly-automation GitHub
App's token, so CI and the required `qualification` check run on it like on any
other pull request, and auto-merge lands it once they pass. Nobody needs to close
and reopen it. It changes only the generated READMEs and the `api/` bundles, so it
qualifies in the lane its changed paths select. Each later push to main rebuilds
its branch from the newest main, so it never conflicts. When main already matches,
the workflow closes it.

```bash
pnpm test          # the full suite: tests/ plus the co-located suites
pnpm run typecheck # tsc -p across every project
```

`pnpm test` uses quoted globs on purpose. If you want to run a subset by hand, quote them yourself:

```bash
node --test "tests/**/*.test.ts"
```

An unquoted directory (`node --test tests/`) makes current Node try to load `tests` as a module instead of discovering test files. Layout, gated tests and the conventions the suite holds itself to are in [`tests/README.md`](tests/README.md).

**If you touched any `tool.json` or a catalog asset:** see section 3 above, `pnpm run build:catalog:all` and `pnpm run validate:catalog:all`, not the singular forms.

**Linting is advisory.** `pnpm run lint` is Biome, and the baseline carries thousands of pre-existing findings. It is not a CI gate, a clean run is not a precondition for merging, and you should not spend your PR fixing the backlog. Keep the files you touched tidy and move on.

## 5. Where does this code live

| Path | What it is |
|---|---|
| `engine/` | The platform-agnostic core. No DOM, no storage, no networking, no brand knowledge. |
| `schemas/` | JSON Schemas for `tool.json`, assets, asset refs, tokens and canonical inputs. |
| `shells/web/` | The Vite PWA and its capability-bridge implementations. See [`shells/web/README.md`](shells/web/README.md). Other hosts sit alongside it: [`cli`](shells/cli/README.md), [`tui`](shells/tui/README.md), [`tauri-desktop`](shells/tauri-desktop/README.md), [`tauri-mobile`](shells/tauri-mobile/README.md), [`chrome-extension`](shells/chrome-extension/README.md). |
| `community/` | Brand-agnostic tool definitions: manifest, template, optional hooks. Data, not code. See [`community/README.md`](community/README.md). |
| `brands/` | Brand packs. [`brands/lolly-start/`](brands/lolly-start/README.md) is the blank starter, owned here; [`brands/suse/`](brands/suse/README.md) is the private SUSE pack, a submodule. |
| `packages/core` | `@lolly-tools/core`, the tool-author SDK and the canonical `HostV1` contract. See [`packages/core/README.md`](packages/core/README.md). `packages/node-shell` holds the [shared Node host pieces](packages/node-shell/README.md), including the content-pack resolver (`src/content-roots.ts`). |
| `services/` | The optional hosted components: the [MCP server](services/mcp/README.md) and the [device-credential CA](services/ca/README.md). |
| `scripts/` | Catalog build and validation, brand ingest, and deploy. See [`scripts/README.md`](scripts/README.md). |
| `tests/` | Engine and contract tests, plus the fuzz harness under `tests/fuzz/`. See [`tests/README.md`](tests/README.md). |
| `docs/` | Architecture, authoring guides, positioning, and the generator for the `/info` site. See [`docs/README.md`](docs/README.md). |

Two rules hold this shape together. Tools never import from the engine and never touch the DOM, filesystem or network directly, they call `host.*`. The engine never learns about a brand, a shell or a platform. A pull request that crosses either line will be asked to move the code.

## 6. Security

Report vulnerabilities privately. The policy, scope and safe-harbour statement are in [`SECURITY.md`](SECURITY.md). The standing posture, the cryptographic primitives, and the design boundaries the project is explicit about, including the fact that tool hooks are not a security sandbox, are documented in [`docs/security-verification.md`](docs/security-verification.md).

Before you change code on either side of a trust boundary, read [`docs/threat-model.md`](docs/threat-model.md). It maps every boundary to the code that enforces it and to the test that covers it, records the residual risks the project accepts, and is explicit about what is *not* a boundary. If the thing you are touching reads bytes somebody else produced, find it in [`docs/parser-inventory.md`](docs/parser-inventory.md) first: that lists each untrusted-input parser with its bound constants, its tests and whether it is fuzzed, so you can see what the existing limits are before you add another.

If your change touches a parser that eats untrusted bytes, or a crypto module, **add or extend a fuzz target**. The harness lives in `tests/fuzz/` (`prng.ts`, `mutate.ts`, `targets.ts`, with saved inputs in `tests/fuzz/regressions/`). Each target pairs a small seed corpus of valid inputs with an `invoke()` that feeds one mutated buffer through the parser, and `invoke()` must not swallow errors, because the runner classifies them: a thrown validation error is the desired behaviour, a hang or an allocation blow-up is a finding. `tests/fuzz-regression.test.ts` replays every saved regression plus a short seeded sweep as part of the normal suite, and the long discovery soak is standalone:

```bash
FUZZ_ITERS=50000 node tests/fuzz/run.ts
```

Targets already covered include `c2pa-verify`, `cbor`, `media-sniff`, `pdf-map`, `x509`, `file-metadata`, `strip-metadata`, `video-meta`, `data-import`, `pptx-read`, `pptx-patch`, `icc`, and the web shell's `pptx` bridge. Use the closest one as your template.

## 7. How CI qualifies a change

This section moved here from the public docs site, because it describes how this
repository's own CI and release preparation work rather than how to use Lolly.

One CI run produces up to three levels of evidence. Every main push runs the
complete suite, and so does every pull request outside the docs-and-tests lane
below. The `qualification` check picks the required level from a conservative
source classification. Deployment still needs an independent source
compatibility check and fresh provider evidence.

| Check | Scope | Required results |
|---|---|---|
| `public-ready` | Eligible web UI source and canonical UI token changes | Secret history, typecheck, production build and bundle budget, contracts, security, catalog validation, all-tool render check, custom static security rules, deployment scope and focused UI tests |
| `release-ready` | Every change except a docs-and-tests pull request | All public-ready checks plus engine, web and tool units, all eight browser shards and their execution gate, Tauri, conformance, regression fuzzing, API bundle drift, the rendering action and the dependency audit |
| docs-and-tests (a tier of `qualification`, with no job of its own) | A pull request whose every change is under `docs/`, a test, a reviewed baseline or one of the two generated READMEs | All release-ready checks except the eight browser shards, their execution gate, Tauri, conformance and regression fuzzing |
| `qualification` | Every change | Needs every other CI job, then requires the selected tier and a fresh scan of every job in the same attempt |

### The fast UI tier

`test (public-ready UI)` always runs. It executes the five files listed in
`scripts/run-public-ready-ui.ts`, including canonical token generation drift,
shared UI primitives, edge docking and navigator behaviour. A skipped test fails
this check. Run the same set locally with the repository's pinned Node:

```sh
node scripts/run-public-ready-ui.ts
node --test tests/ci-qualification-contract.test.ts tests/workflow-pins.test.ts
```

The fast scope admits regular files in web components, styles and views,
selected docking and token helpers, their focused tests and the two canonical UI
token documents. Auth, account, session, profile, identity, instance, policy and
related protected filenames are excluded even inside those directories, and a
substantive UI change is required. Startup, bridges, catalog code, the engine,
backend, dependencies, workflows, CI policy, unknown paths, executable files and
symlinks all need the full tier. The exact allowlist lives in
`scripts/ci-qualification.ts`; a description here never grants extra scope.

Scope and the focused UI job start ahead of the long matrix. Contracts and
security have their own fast matrix, sharing the installation, test and
skip-report steps with the exhaustive matrix. The long matrix waits for the
first scope and UI jobs but still runs when they fail. Every aggregator lists the
jobs it requires in `needs:`, so it starts only after they finish and no runner
sits waiting: `public-ready` after the fast checks, `release-ready` after the
whole suite and `qualification` after every other job, the two tier jobs
included. Each reads the provider's record of its run attempt once, with a retry
window of a few minutes while the API catches up, and refuses any failed,
cancelled or unreviewed skipped job. An eligible UI pull request therefore waits
for the whole run before `qualification` passes, while `public-ready` reports as
soon as the fast checks pass.

### The docs-and-tests lane

A pull request whose every change is under `docs/` (pages, translations, shots,
figures and the `/info` builder), a test, a fixture, one of the reviewed ratchet
baselines or one of the two generated READMEs (`engine/README.md`,
`shells/web/src/README.md`) skips the heavy tier: the four WebGPU browser partitions and
their execution gate, Tauri, conformance (qpdf and c2patool) and regression
fuzzing. Everything else still runs: secret history, custom static security
rules, workflow pins, typecheck and its ratchets, catalog validation, the render
check, the production build, contracts, security, the engine, web and tool unit
shards, API bundle drift, the rendering action and the dependency audit job.

A test that the heavy shards run, recognised by name or by the runtime markers
that `scripts/run-test-suite.ts` uses, keeps the full suite, as do
`tests/expected-skips.json`, any manifest or lockfile, executable files and
symlinks. The lane comes from the same trusted base classifier, so a pull request
cannot change its own lane, and an unknown or missing lane runs every shard. The
main push after the merge always runs the complete suite. The scope job leaves
the heavy entries out of the test matrix rather than skipping a matrix job, so
every reported job name stays exact; `test (browser)` and `release-ready` report
as skipped.

### Fast deploy lanes for the lolly.tools preview

The lanes above decide what CI runs on a pull request. Two deploy lanes decide
something narrower: how soon the lolly.tools preview may ship a commit that is
already on `main`, before that commit's own full `ci.yml` run has finished.
They never apply to a release, and `deployment-suse.yml` and the release
workflows keep their exact-commit check.

The base is the newest first-parent ancestor whose full `ci.yml` push run on
`main` passed. Every path that differs between the base and the commit decides
the lane, computed from Git by each enforcer:

- **docs**: every change is under `docs/` (pages, translations, shots, figures,
  the registry and the `/info` builder) or is one of the two pages rendered from
  outside it (`README.md`, `engine/text-composition.md`). It needs the
  `docs lane` job of `.github/workflows/fast-lanes.yml`: the tests that read the
  docs, the docs nav and wording gates and the `/info` build.
- **web**: every change is under `docs/` or `shells/web/`, apart from the
  exclusions below. It needs the `web lane` job, which needs the docs lane as
  well as the web typecheck, the changed-file lint, the UI copy, comment, house
  rules, locale and maintainability gates, the `unit:web` shard in two parts,
  the production build with both budgets, the security shard and one real
  Chromium run that opens the gallery, opens the QR code tool and exports a PNG.
- Everything else waits for the full run, as before.

The web lane leaves out, and so sends to the full run: dependency manifests and
lockfiles; the web build inputs (`vite.config.js`, the tsconfigs, `build/`,
`index.html`, the models manifest and the RPM files); everything in
`shells/web/public/` except static images, fonts, audio and video, so the service
worker, its pages, scripts and `.well-known/`; `main.ts`; the bridge (stored
formats, the export path the CLI and MCP drive, the Tauri shells' base);
`capture/`, `catalog/`, `collab/`, `org/`, `ext/`, `vendor/`, `ca-root.ts` and
the personal sync modules; and any file whose name carries a security word
(the public-ready list plus signing, provenance, migration, CSP, OAuth and the
service worker). `docs/supported-environments.md` and `docs/parser-inventory.md`
always need the full run, because release and security gates read them. Test
files never ship, so they take the lane of the changes beside them.

A lane never overrides a full run that has already failed on the commit.
`preview-web.yml` enforces the lane with the copy of `scripts/deploy-lane.ts`
from the base commit, and the preview deploy tool in lolly-work carries a
Python port tested against the same cases in
`tests/fixtures/deploy-lane/cases.json`; a deploy needs both to agree. To see
the lane of a commit, run
`node scripts/deploy-lane.ts classify <base> <commit>`.

### Dependency advisories and cooldown

The `npm audit (high+critical)` job inventories every lockfile and checks the
SBOM, third-party notices and Cargo licence map on every run. Its npm, pnpm and
RustSec advisory lookup runs on every main push and on a pull request whose
trusted scope changes a manifest, lockfile, resolver setting or the audit
policy. Other pull requests skip only that lookup, so an advisory published
upstream does not turn unrelated pull requests red.
`.github/workflows/dependency-audit.yml` runs the same lookup nightly, on every
release tag and on demand; a red result there blocks the next release.
`cargo-audit` is a checksum-pinned release binary rather than a source build.

New dependency versions wait three days after publication:
`minimumReleaseAge: 4320` in the three pnpm workspace files, and `cooldown` in
`.github/dependabot.yml`. pnpm 11 enforces the age on every install, including
`pnpm install --frozen-lockfile`, so a lockfile entry younger than three days
fails CI. To take an urgent fix sooner, allow that exact version with
`minimumReleaseAgeExclude`.

### Concurrency and trusted policy

A newer push to a pull request cancels its run in progress. A main push is never
cancelled once it has started, so every started main run reports a complete
result for its exact commit. A queued main run that has not started is replaced
by the newer one.

For pull requests the checked source can be GitHub's merge commit; `headSha`
separately records the provider's PR head. Scope and qualification policy run
from the exact event base commit, so candidate changes cannot relax that policy.
When the base has no policy, the bootstrap scope is full-only. Every policy or
workflow edit also requires release-ready.

### Browser shard balance

Browser test files are assigned to the eight runners by measured duration,
longest first onto the runner with the least assigned time; each runner stays
serial within its own partition. `scripts/data/browser-test-durations.json`
holds median file durations from complete CI runs and records their run IDs,
attempts and source commits. Its `partitionDutyMs` holds the measured time of
the conformance steps that only one runner takes on (geometry on runner 1,
Firefox and WebKit geometry on runner 2, drawing fidelity on runner 3); those
runners start with that time already assigned, so they take fewer files and
all eight finish together. A file with a case that runs only when Playwright's
own Firefox or WebKit build is installed (`BROWSER_ENGINE_FILES`) always goes
to runner 2, the one that installs those builds. New files get a ten-second estimate and removed
files are ignored. The discovered inventory, never the timing profile, decides
which tests run, and the coverage gate uses the same assignment function, so a
stale estimate can reduce balance but never coverage. Refresh the profile from
complete successful `browser-coverage.json` artifact sets, taking the median
`summaries[].durationMs` per file and the median duration of each conformance
step, and recording the contributing runs.

The runner count lives in `scripts/browser-partitions.ts` and, for the job names,
in `scripts/ci-qualification.ts`, which accepts the previous count's job names as
well. A pull request and the main push that merges it are qualified by their
base's policy, so a new count has to be accepted there and merged before the
workflow uses the new count. `tests/ci-qualification-contract.test.ts` keeps the two counts
and `.github/workflows/ci.yml` in step.

The coverage gate still requires every discovered file to finish exactly once at the
checked-out source, all eight complete reports and the exact reviewed skips, so a
timing estimate cannot excuse a missing, failed or cancelled test. Each runner warms
the source and production Design shells and checks its WebGPU adapter. Within a
partition the entry checks listed in `scripts/browser-partitions.ts` (the theme,
motion-sample export and open-route files) run first and the rest follow
alphabetically, one isolated process per file. A failure is reported from the
required shard while its remaining files keep running.

### The qualification artifact

Successful tier jobs upload `public-ready-<runId>-<runAttempt>` or
`release-ready-<runId>-<runAttempt>`, and the stable aggregate uploads
`qualification-<runId>-<runAttempt>`. Inputs that jobs pass to each other inside
a run are named by run only (`ci-scope-<runId>`, `test-skips-<shard>-<runId>`),
and a download takes the newest upload of each name, so after "Re-run failed
jobs" the new attempt finds the files that carried-over jobs uploaded earlier.
A carried-over scope job's receipt names the attempt that ran the job, so the
policy accepts a scope receipt from an earlier attempt of the same run. The run
ID, repository, branch, event and every commit (base, source, tree and head)
must still match exactly, the attempt may be earlier but never later, and the
scope is still derived again from Git. The aggregators run the base commit's
copy of the policy, so a pull request benefits once its base includes this rule.
Each receipt contains `qualification.json`, `scope.json`, the unchanged
`run.original.json` and every `jobs-<page>.original.json` provider page. Artifacts
stay available for 14 days; a private operator must keep the evidence its release
record needs before they expire.

The version 1 qualification record contains:

- `status: CI_QUALIFIED`, `qualificationTier` and `fullSuiteQualified`;
- the exact `source`, `tree`, `base`, provider `headSha`, repository name and
  numeric ID, head repository and branch, event, run ID, attempt and workflow path;
- `scope.runAttempt` (the attempt whose scope job classified the change, which
  is earlier than `runAttempt` after a failed-only rerun),
  `scope.publicReadyEligible`, `lane` (`public-ready`, `docs-and-tests` or
  `full`), `dependencyChange`, `policyCommit`, `policySha256` and
  `changedPathsSha256` (the policy digest is null only for full-only bootstrap);
- `requiredJobs`, each with its provider job ID, exact name and success conclusion;
- `provider.run` and `provider.jobs`, each with a relative path and SHA-256 of the
  original bytes, plus `capturedAt`;
- `publicationEligible`, `knownFailuresRejected: true`,
  `lateFailureCheckRequired: true` and `productionMutation: false`.

Only a same-repository main push with `source === headSha` is eligible for
publication; a pull request's artifact cannot authorise publication. A complete,
unambiguous job inventory is required. Failed, cancelled, timed-out or
unexpectedly skipped jobs prevent qualification, including jobs outside the
selected tier. The only expected skips are `verified instance shell`,
`public-ready` when the trusted scope needs release-ready, and `test (browser)`
and `release-ready` on a docs-and-tests pull request.

An early green result cannot predict later failures. Before publication the
consumer must fetch the same run and attempt again, inspect every current job,
check the required successful aggregate and confirm the candidate is still
current main. Any known failure blocks publication. The artifact is CI evidence
only: private catalog signatures, shell compatibility, build custody and
production readiness stay separate checks, and fast-tier eligibility alone never
permits reusing an engine baseline.

### Request a shell deployment

The existing `main-web-preparation.yml` full image workflow still waits for
completed CI. The tier artifact lets a separate Lolly Work preparation workflow
start without another Lolly CI pipeline, and without publishing from this public
repository. Request the current main commit from the Actions page, or from the
command line with `SOURCE_SHA` set to the exact main commit and `CI_RUN_ID` to its
qualified CI run:

```sh
gh workflow run shell-deployment-request.yml --repo lolly-tools/lolly --ref main \
  -f source="$SOURCE_SHA" -f ci_run="$CI_RUN_ID" -f ci_attempt=1 \
  -f tier=public-ready
```

Use `release-ready` for the full tier. The wrapper pins the Lolly Work reusable
workflow and its operator checkout to the same immutable commit. Its token can
read this repository's CI artifacts, and neither workflow has production
credentials. The resulting `shell-request-<runId>-<runAttempt>` artifact is input
to the private operator, which repeats qualification before publication. The
request builds no private brand content and changes nothing in production.

### Prepare a web release candidate

`deployment-suse.yml` with `release_scope=web` prepares the signed public web
image without rebuilding the independent CA, Penpot or MCP services. It needs
that commit's successful normal main CI and keeps the frontend release gate. Main
CI can request candidate preparation; that workflow does not promote anything to
production automatically.

`main-web-preparation.yml` has an optional changed-path filter. Leave the
repository variable `LOLLY_CLASSIFY_WEB_CANDIDATES` unset or `false` to keep the
existing behaviour. Set it to the literal `true` only together with
`LOLLY_APPLICATION_RELEASE_BASE`, a reviewed full lowercase commit hash that is an
ancestor of the exact qualified main candidate. That base is a comparison point,
not a claim about what runs in production, and the helper never substitutes the
candidate's parent or a moving branch for it.

With filtering on, a clean complete-history checkout must prove that the whole
range contains only regular web source changes plus permitted companion tests or
the generated web source README. The candidate request and every normal CI,
release-gate, signing and image qualification check stay in place. Identical
committed trees skip preparation. Unknown or mixed paths, docs-only or test-only
ranges, invalid inputs and dirty checkouts return a result that needs manual
review. A skipped or held preparation does not authorise artifact reuse or a
production change, and private shell, pack, engine-pin and runtime compatibility
still need their own review.

`vendor/application-release-classifier/` holds the classifier and its 45 Git
fixture tests, byte-exact copies of the reviewed Lolly Work classifier at
`987d67135a3b0d1026e4e893d69a69b1f4c79d84`.
`scripts/data/application-release-classifier-source.json` records the source
repository, immutable Git objects and SHA-256 hashes. The preparer runs only the
checked-out copy and never downloads or runs another repository's moving code. To
inspect a range locally with Node 24 and Git:

```sh
node vendor/application-release-classifier/scripts/classify-application-release.ts \
  --repo /absolute/clean/lolly-checkout \
  --base FULL_REVIEWED_BASE_COMMIT \
  --candidate FULL_CANDIDATE_COMMIT
```

The JSON gives both commit and tree identities, a bounded complete inventory and
advisory flags. It never grants promotion or artifact-reuse permission.
