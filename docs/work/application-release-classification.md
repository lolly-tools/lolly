# Classify application changes before preparing a release

`scripts/classify-application-release.ts` inspects a clean local Lolly or Lolly
Work checkout at an exact candidate commit. It reads Git objects and never
builds, downloads, dispatches a workflow or contacts production. Node 24 and Git
are the only prerequisites. Use full lowercase commit hashes and the canonical
absolute checkout directory; the base must be an ancestor of the candidate.
Dirty tracked files, untracked files and changed submodules refuse inspection.

From a Lolly Work checkout:

```sh
node scripts/classify-application-release.ts \
  --repo /absolute/isolated/lolly-checkout \
  --base FULL_PREVIOUS_SOURCE_COMMIT \
  --candidate FULL_CANDIDATE_SOURCE_COMMIT
```

The JSON records both commits and tree hashes, every changed path and object
identity, a deterministic inventory checksum and an advisory classification:

| Classification | Meaning |
| --- | --- |
| `web-shell-only` | Only regular web source, the web entry or service worker changed, optionally accompanied by tests and the generated web source README. Shared engine/core/schema/tool/profile/brand/catalog/dependency/deployment/service inputs are unchanged. |
| `no-change` | The committed trees are identical. This does not establish whether a running deployment already matches them. |
| `full-or-paired-required` | The rule cannot establish a narrow web scope. Review the actual changes before choosing broader qualification or deciding that no application release is needed. |

Documentation-only, test-only and README-only changes do not select a web
release. Unknown or mixed paths, browser-support and release-gate changes,
symlinks and submodule pointers require manual review. Work changes also remain
in this broader category; a separate backend rule has not been qualified.
There are at most 4,096 changed paths, 1,024 bytes per path and two MiB of Git
output per command. Invalid UTF-8, unsafe filenames and ambiguous ranges refuse
the whole inspection. Renames record both the removed and added paths.

This is a preparation aid, not permission to deploy or reuse an artifact. Every
result keeps `normalCiRequired` and `privateCompatibilityReviewRequired` true,
and `artifactReuseAuthorized` and `promotionAuthorized` false. It does not
authenticate main, CI, image provenance, signatures or the production target.
Do not classify a moving main reference or derive deployment state from local
source. Ignored build output is not consumed and is not artifact evidence.

For an advisory web-only result, the existing Lolly `deployment-suse.yml` accepts
explicit `release_scope=web` with the exact reviewed source and its successful
normal push/main CI. The existing main-web preparation workflow performs its
own source and web release-gate checks before requesting a candidate. This
classifier is not connected to either workflow and cannot bypass those checks.
Native/device holds remain independent. A private web shell still needs its
own signing/profile inputs, compatible engine/pack/pin review, old lazy-asset
retention and owning-runtime/HTTPS/interaction acceptance.

Follow [the application update guide](../deploy/helm/APP-UPDATES.md) for reviewed
image plans and existing PVC custody. For compatible frontend changes, use the
[private shell quickstart](../deploy/helm/PRIVATE-SHELL-QUICKSTART.md) or the
[public shell preparation guide](../deploy/helm/PUBLIC-SHELL-UPDATES.md).
These paths reuse accepted images and preserve the existing engine and tool
catalogue. Automatic promotion of moving main remains separate work. The
classifier does not change production credentials, infrastructure, database,
DNS or release gates.

Run its disposable Git fixture tests without a cluster:

```sh
node --test tests/application-release-classification.test.ts
```
