# Shell deployment workflow

This page is for an operator who serves the Lolly web app from a private Work instance
and wants to publish a newer, qualified build of it without rebuilding the Work image.
The accepted image, engine pin, pack and public key stay as they are; only the web app
moves forward. The deployment is resumable, so an interrupted run picks up where it
stopped without repeating a change it already made.

::: timeline
- <!--i:checklist--> **Qualify.** The exact Lolly main commit passes CI.
- <!--i:document--> **Request.** A workflow, or the local command, turns that CI attempt into a deployment request.
- <!--i:layers--> **Prepare.** Build once, assemble the private inputs and qualify the candidate.
- <!--i:upload--> **Deploy.** One resumable command stages, publishes and observes the new web app.
:::

The detailed release-engineering runbooks behind this page, for the public web app's
update lanes, release classification and model checks, live in the Lolly repository's
[scripts guide](https://github.com/lolly-tools/lolly/blob/main/scripts/README.md#hosted-web-app-releases).

## Prepare the request

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

## Prepare and deploy

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

Changing the CI policy itself needs full qualification. The producer checks the
complete source change against the retained engine baseline, so a request limited to the
web app cannot carry a dependency change, and the fast CI check does not override build
compatibility.

## Publishing without a Work restart

The [immutable shell-pointer mode](../deploy/helm/IMMUTABLE-SHELL-RELEASES.md) is a
separate opt-in server capability. Its one-time image, configuration and volume
migration still requires full backend qualification. Only after that migration
can subsequent frontend publications avoid Work Pod rollouts. Keep the current
guarded PVC path until that migration is accepted.
