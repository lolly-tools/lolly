# Shell deployment workflow

Use Lolly's **Prepare shell deployment request** GitHub workflow after its exact
main commit has qualified. Select `public-ready` for an eligible UI change or
`release-ready` after the full suite. Supply the Lolly commit, CI run and attempt.
The workflow verifies the provider artifact digest, same-repository main-push
provenance, every required check and the current main head. A newly failed test
refuses the request even if an earlier public-ready artifact exists.

Qualification binds one exact CI attempt. To retry CI, rerun the entire workflow
with GitHub's **Re-run all jobs**, then prepare a request for that new attempt.
Re-running only failed jobs leaves results from different attempts and cannot
qualify publication. Mixed-attempt results and pull-request artifacts cannot
authorize publication.

The workflow carries public provenance only. Private packs, credentials, signed
catalogues and deployment profiles stay with the private operator. GitHub-hosted
runners do not have production access. This workflow prepares a request; a green
workflow does not mean the site was published.

The caller lives in Lolly so its temporary read token can read Lolly's CI artifact.
It calls Work's reusable workflow and checks out the helper at the same pinned
Work commit. This avoids adding a cross-repository personal access token. Keep
both Work commit references together when updating the caller.

For a local equivalent with an authenticated GitHub CLI:

```sh
python3 -B scripts/verify-shell-qualification.py \
  --source "$LOLLY_SOURCE" --run-id "$LOLLY_CI_RUN" --attempt "$LOLLY_CI_ATTEMPT" \
  --tier public-ready --out "$PRIVATE_RELEASE/request"
```

Build once with `prepare-shell-update.ts`, assemble with
`assemble-private-shell-input.py`, and qualify with `prepare-private-shell.py`.
These maintained commands retain the accepted image, engine pin, pack and public
key. Their output remains bound to the complete manifest and source custody.
If the source is unchanged, an already prepared artifact can be reused after a
full-workflow CI retry without another build; the publication request must bind
the newly qualified attempt. Do not replace the candidate, its receipt, source
checkout or helper files while deploying.

The resumable command starts at that prepared artifact. Its reviewed JSON config
has this shape; every path is absolute and every digest is the SHA256 of the
referenced file's actual bytes:

```json
{
  "version": 1,
  "profile": {"path": "/private/release/instance-profile.json", "sha256": "REVIEWED_FILE_SHA256"},
  "prepared": {"path": "/private/release/shell.prepared.json", "sha256": "REVIEWED_FILE_SHA256"},
  "request": {"path": "/private/release/request/request.json", "sha256": "REVIEWED_FILE_SHA256"},
  "operatorSha256": "DEPLOY_PRIVATE_SHELL_PY_SHA256",
  "qualificationVerifierSha256": "VERIFY_SHELL_QUALIFICATION_PY_SHA256",
  "minimumLocalFreeBytes": 1073741824,
  "lockDirectory": "/private/deployment-locks"
}
```

Create the lock directory with mode `0700`. All operators for the same cluster
and Work Deployment must use the same directory. The lock identity uses the
cluster UID, namespace and Deployment UID, so changing profile files cannot
create a second publication owner. The lock is released automatically when the
process exits; an interrupted process does not leave a stale PID lock. This is a
host-local lock. A second operator host needs external publication coordination;
it does not participate in this filesystem lock.

```sh
python3 -B scripts/deploy-private-shell.py \
  --config "$PRIVATE_RELEASE/deploy.json" --config-sha256 "$DEPLOY_CONFIG_SHA256" \
  --journal "$PRIVATE_RELEASE/deployment"
```

The command checks local and host capacity before staging, then uses the existing
stage and publication guards. Normal target checks still run before each
production mutation. CI is read again after the apply guards and immediately
before the final normal target preflight and patch. If main has
advanced, prepare the newer request; the older candidate is not silently shipped.

Run the identical command to resume. Successful original stage phases are reused;
completed copy, qualification and retirement phases are not repeated. Read-only
preparation can retry in a new evidence directory. A started mutation without its
original accepted result, or any uncertain mutation, refuses automatic replay.
Reconcile that original operation before attempting a separate recovery. Changing
the config or helpers also refuses reuse of the old journal.

After a committed apply, resume completes observation even if a newer main commit
has arrived. It never applies the old candidate again. The accepted receipt gives
the next instance profile and distinguishes runtime acceptance from the remaining
authenticated export, document-agent, reconnect and visual checks. Preserve the
current and immediate rollback artifacts until the normal retention review.

## Qualification policy

Public-ready requires the focused UI suite, scope classification, build and bundle
budget, typecheck, contract and security tests, catalogue validation, render smoke,
secret scan and custom security scan. Full CI continues in the same run. Backend,
engine, authentication, database, dependency, unknown-path and CI policy changes
require release-ready. A public-ready receipt never claims full-suite success.

Changing the CI policy itself needs full qualification. This initial rollout also
includes a Rustls Cargo dependency patch, so the first subsequent production
release needs the matched release path with full qualification to establish a
new baseline. The existing producer checks the complete source delta against the
retained engine baseline; a UI-only request cannot carry that dependency change.
The CI fast check does not override build compatibility.

## Timing and rollout

The previous deployment spent roughly 369 seconds preparing the local shell even
though Vite took about 11 seconds. Copying and repeated content hashes also cost
several minutes. Guard batching reduces network round trips while keeping each
fresh response, and this command avoids rebuilding accepted artifacts or replaying
successful stages. The journal records preparation durations and preserves the
existing operators' per-command timings.

Local delta validation indexes candidate paths once before checking every
protected resource. This avoids scanning the entire candidate for each accepted
file while retaining the exact path, size and content-hash comparisons. Asset
hashing, clone custody, source checks and publication guards still run normally.
To compare the former scan and indexed lookup on saved manifests:

```sh
node scripts/benchmark-shell-update-delta.ts \
  "$PRIVATE_RELEASE/previous-shell.manifest.json" \
  "$PRIVATE_RELEASE/candidate-shell.manifest.json"
```

The read-only benchmark reports three samples for each implementation and checks
that their complete deltas match. It measures in-memory manifest comparisons;
JSON parsing, asset hashing, building, retention and publication are excluded.

Fresh file hashes use a zeroed read buffer capped to the file size and 1 MiB.
Empty files keep a one-byte buffer so the EOF read still detects concurrent
growth. Every descriptor, path, stamp and directory check remains in place;
each inventory still reads and hashes every byte. To measure a complete saved
tree, checking the resulting manifest bytes and reporting its shell ID:

```sh
node scripts/benchmark-shell-manifest.ts \
  "$PRIVATE_RELEASE/prepared-shell" \
  "$PRIVATE_RELEASE/prepared-shell.manifest.json"
```

An optional third argument selects a saved `shell-update-files.ts` helper for
before-and-after measurements. Alternate the order on the same immutable tree
and preserve all samples. The benchmark measures one fresh inventory; it does
not measure cloning, complete retention, building or publication. Filesystem
caches and host load affect the result.

The [immutable shell-pointer mode](../deploy/helm/IMMUTABLE-SHELL-RELEASES.md) is a
separate opt-in server capability. Its one-time image, configuration and volume
migration still requires full backend qualification. Only after that migration
can subsequent frontend publications avoid Work Pod rollouts. Keep the current
guarded PVC path until that migration is accepted.
