# Update the web frontend without rebuilding its image

Start with an exact qualified source commit and the instance's current accepted
release. For a compatible web TypeScript, CSS or layout change, build the new
frontend and publish a new shell claim. Keep the accepted application image,
engine, catalogue, database and infrastructure. A single-owner `Recreate`
instance has a brief reconnect window when its new owner starts.

Use this path for web application code. Backend TypeScript, the baked Work admin
console, dependencies, engine/core/schema, tools, brand or build-policy changes
need their broader release path. The
[release classifier](application-release-classification.md) checks the exact
committed changes; an allowed filename alone does not establish compatibility.

Use this guide for either a private Work instance or a public static site. A
developer supplies the immutable source and its successful CI; the operator
supplies the accepted baseline and protected instance inputs. Someone using the
instance sees the new UI after acceptance and may need to reconnect an open tab.
No cloud provisioning, Helm reinstall or database restore is part of a normal
application update.

| Change | Release path |
| --- | --- |
| Compatible web TypeScript, CSS or layout | Private shell commands below; public root and validator map must advance together. |
| Images or documentation inside unchanged signed content | Reuse those accepted bytes; there is no need to rebuild them. |
| Changed tools, catalogued assets, brand content or served documentation | Qualify a complete content release with signatures and retained addresses. Reuse the runtime only when its exact compatibility is established. |
| Backend TypeScript or the baked admin console | Qualified application image via [application updates](../deploy/helm/APP-UPDATES.md). |
| Engine, schema, native runtime or dependency changes | Matched release and its broader checks; infrastructure stays in place unless the release requires an infrastructure change. |

A new commit on `main` is the input to qualification, not an automatic live
release. Keep old claims and immutable files until the new release is accepted.

## Before the first update

An IT operator sets up the reusable inputs and records the initial accepted
baseline, then keeps the protected files available to the release operator.
The private lane requires an existing dedicated shell PVC. The public lane
requires an accepted Nginx image; its first update adds five read-only serving
mounts and a read-only whole-volume anchor. The current public
producer uses the reviewed `lolly.tools` policy. Another public instance needs
its own reviewed policy contract.

| Reusable instance inputs | What the operator reviews |
| --- | --- |
| Target and guard programs | Cluster/host identity, all protected components, mandatory preflight and actual host mount checks |
| Accepted image and runtime inputs | Engine, pack/pin or public Nginx configuration and separate model storage |
| Public verification key | Existing public-only P-256 key; no signing secret is needed for unchanged signed content |
| Helper source closure | Exact maintained scripts, imports and probe hashes; review again when helpers change |
| Private instance profile | Storage bounds, stage-name policy, runtime probes and optional approved authenticated catalogue caller |

| Fresh release inputs | Where they come from |
| --- | --- |
| Exact main commit and successful normal CI | Original source/run/job records for that immutable commit; a moving `main` name or local success label is insufficient |
| Current accepted baseline | Genuine `accepted.previous.json`, complete accepted snapshot and manifest; advance only after acceptance |
| New build custody and evidence | Accepted settings and compatibility inputs, original producer/web-gate reports and complete manifests |
| New shell claim and attempt directories | Explicit reviewed selection and unused names; outputs are exclusive |

Use Node 24+, Python 3.10+ and already installed locked dependencies in clean
isolated checkouts. The producer installs nothing. Reuse exact accepted ignored
ORT/ORT-HF cache bytes where Vite requires them. IT supplies the reviewed custody
and evidence files; these commands do not generate provider-origin proof from
handwritten JSON. Keep protected instance inputs outside the source repository.

## Private Work instance: three commands

Run from the qualified Work helper checkout. Replace the uppercase placeholders
with reviewed full commits and SHA-256 values, and `/protected/` paths with your
existing protected directory. The accepted snapshot includes retained lazy
chunks needed by already-open tabs.

```sh
pnpm update:shell:build \
  --source /clean/lolly --base ACCEPTED_SHELL_COMMIT --candidate NEW_MAIN_COMMIT \
  --previous-shell /protected/accepted-shell --public-key /protected/public.jwk.json \
  --custody /protected/build-custody.json --custody-sha256 REVIEWED_CUSTODY_SHA256 \
  --out /protected/build-NEW_MAIN_COMMIT

pnpm update:shell:prepare \
  --evidence /protected/shell-evidence.json \
  --reviewed-evidence-sha256 REVIEWED_EVIDENCE_SHA256 \
  --existing-public-pin-sha256 REVIEWED_CANONICAL_PUBLIC_JWK_SHA256 \
  --node /path/to/node24 --out-dir /protected/prepared-NEW_MAIN_COMMIT

pnpm update:shell run \
  --profile /protected/instance-profile.json --profile-sha256 REVIEWED_PROFILE_SHA256 \
  --prepared /protected/prepared-NEW_MAIN_COMMIT/shell.prepared.json \
  --prepared-sha256 REVIEWED_PREPARED_SHA256 \
  --operator-sha256 REVIEWED_UPDATE_OPERATOR_SHA256 \
  --out /protected/update-NEW_MAIN_COMMIT
```

Build and preparation are local. Review their original reports and hashes before
`run`, which captures fresh resources, stages isolated content, plans, dry-runs,
applies once and observes the new owner. It streams snapshots through the current
owner into new claims; it never mounts an active claim into a staging Pod.

The successful `run.actual.json` has status
`PRIVATE_SHELL_UPDATE_RUNTIME_ACCEPTED` and links `accepted.previous.json` and
`instance-profile.next.json`. Use that exact next profile for the next release,
keeping both profiles and their referenced snapshots/receipts. It advances the
baseline while preserving the reviewed image, pack, pin and caller policy.
Export, document-agent and signed-in reconnect checks remain separate.

See the [private quickstart](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/PRIVATE-SHELL-QUICKSTART.md)
for offline `check`/`plan`, naming and next-profile details, the
[private input contract](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/SHELL-UPDATES.md)
for custody/preparation, and the
[authenticated catalogue guide](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/PRIVATE-SHELL-CATALOG-PROBES.md)
for the reusable caller policy. Input assembly remains an operator review step.

## Public Nginx instance: choose its delivery layout

A Plan300 image has a full SHA validator map and gzip/Brotli siblings. Its root
and map must come from the same complete inventory. The old five-path producer
refuses that baseline; do not remove its hold or reuse a baked map for new
JavaScript. The maintained
[complete-root preparation helpers](../deploy/helm/PLAN300-PUBLIC-FULL-ROOT.md)
assemble current and retained content, validate every coding and derive one
guarded root-claim patch. They reuse the accepted image, configuration and
models for a compatible later frontend update.

Complete-root assembly and patch derivation are local preparation. A site's
stager, native qualifier and publisher must bind that protocol and provide real
resource, memory, HTTP, retirement and TLS acceptance before promotion. These
helpers do not make the older public facade operational on a map-bearing image.
The [complete-root runtime adapter](../deploy/helm/PUBLIC-DELIVERY-RUNTIME.md)
provides explicit prepare, isolated stage, qualified switch and observation
commands for its declared managed K3s layout. Its source controls do not replace
registration and actual native acceptance on the operator's target. The image,
configuration, models and infrastructure remain selected unchanged; only the
new qualified frontend root and its paired map advance.
The same `update:public-shell:build` command now accepts an original version 2
complete-root serving record. It verifies that record through the maintained
read-only validator and emits a version 2 `public-full-root-frontend` descriptor.
The builder keeps the accepted image, public catalog, configuration and model
recipe; it recompiles the frontend and compresses only changed entry files and
new chunks. Retained immutable identities and gzip/Brotli bytes remain exact.
It checks all encoded files and generates the validator map from the final
inventory. Complete-root assembly then consumes this descriptor in `frontend`
mode; the legacy five-path facade still refuses a map-bearing root.

Keep the original preparation, qualification and publication records, including
any explicitly verified continuation after an interrupted staging attempt.
Reading that history does not rerun old operators or erase failed journals.
New preparation holds the complete current validator source closure as well.
This avoids rebuilding an unchanged image; whole-root and HTTP qualification
still take time proportional to the retained content and are not an instant
publish operation.

For the current `lolly.tools` layout, follow its protected production handoff.

After successful complete-root observation, the publisher retains
`observe.accepted.json` and writes `accepted-release.actual.json` plus
`handoff.accepted.json`. Use that version 2 record as the next preparation's
`acceptedRelease`, with its manifest as `previousManifest` and fresh complete
target captures. The next preparation revalidates the original input/source,
dryrun, atomic switch, retirement, command streams and stable serving owner
bookends; a failed or partial observation cannot produce this handoff. Preserve
those original files and source paths. Existing registered version 1 baselines
remain readable. This records serving acceptance only; browser and native target
registration keep their separate scope. Memory admission retains this adapter's
existing current ≤ peak < configured limit and zero-OOM requirements.
Retained HTTP verification binds the complete held identity rows to a closed
count, byte total and canonical SHA-256 digest before any request. Its finite
8 GiB transfer ceiling matches complete-root assembly; it is separate from the
Pod's memory limit. Individual bodies remain capped at 2 GiB and stream in
64 KiB blocks. Native result capture, strict parsing and compact HTTP receipts
share a 32 MiB envelope including their newlines. Every response field remains
in that receipt; an oversized result refuses qualification rather than dropping
headers or rows. Existing process identity, hash, cache, Range and CORS checks
and command deadlines still apply.

Admission validates the historical preparer's original hash and reviewed source
membership independently of the current checkout. All resources and protected
fields still rederive under the current guards; original receipts are preserved
when preparation moves to another checkout.

The following five-path commands remain for an accepted legacy image without
that validator map. They cannot be substituted for complete-root publication.

### Legacy public Nginx instance: supervised phases

The public lane reuses its accepted image and signed neutral catalogue. Its
overlay contains only `_app`, `index.html`, `precache.json`, `sw.js` and
`portable/player.js`; models and the rest of the image remain unchanged. Keep
private artifacts out of this lane.

For the managed local-volume plugin, the claim source stays writable to the
kubelet while every application mount stays read-only. The first whole-volume
mount allows normal SELinux relabeling before the five serving subpaths. The
selected `OnRootMismatch` policy preserves file modes when the backing root
already has GID 101, owner/group `rwx` and setgid. The operator verifies that root
before each handoff and the separate model root before publication; a mismatch
stops the update without changing permissions. These checks currently support
the pinned `local` plugin with `rancher.io/local-path`, rather than CSI or
`hostPath` volumes.

```sh
pnpm update:public-shell:build \
  --source /clean/lolly --base ACCEPTED_SHELL_COMMIT --candidate NEW_MAIN_COMMIT \
  --previous-shell /protected/accepted-public-static --public-key /protected/public.jwk.json \
  --custody /protected/public-custody.json --custody-sha256 REVIEWED_CUSTODY_SHA256 \
  --out /protected/public-build-NEW_MAIN_COMMIT

pnpm update:public-shell:prepare \
  --evidence /protected/public-evidence.json \
  --reviewed-evidence-sha256 REVIEWED_EVIDENCE_SHA256 \
  --node /path/to/node24 --out-dir /protected/public-prepared-NEW_MAIN_COMMIT

python3 -B scripts/stage-public-shell.py check \
  --inputs /protected/public-stage.json --sha256 REVIEWED_STAGE_INPUT_SHA256 \
  --operator-sha256 REVIEWED_STAGER_SOURCE_SHA256
python3 -B scripts/stage-public-shell.py run \
  --inputs /protected/public-stage.json --sha256 REVIEWED_STAGE_INPUT_SHA256 \
  --operator-sha256 REVIEWED_STAGER_SOURCE_SHA256
```

IT assembles the stage input from the original preparation and fresh complete
captures. After successful isolated qualification and exact writer/qualifier
retirement, assemble and review the publication input from those actual receipts.
Run each command separately, inspecting the previous result before proceeding:

```sh
python3 -B scripts/publish-public-shell.py check \
  --inputs /protected/publication.json --sha256 REVIEWED_PUBLICATION_INPUT_SHA256 \
  --operator-sha256 REVIEWED_PUBLISHER_SOURCE_SHA256
python3 -B scripts/publish-public-shell.py dryrun \
  --inputs /protected/publication.json --sha256 REVIEWED_PUBLICATION_INPUT_SHA256 \
  --operator-sha256 REVIEWED_PUBLISHER_SOURCE_SHA256
python3 -B scripts/publish-public-shell.py apply \
  --inputs /protected/publication.json --sha256 REVIEWED_PUBLICATION_INPUT_SHA256 \
  --operator-sha256 REVIEWED_PUBLISHER_SOURCE_SHA256
python3 -B scripts/publish-public-shell.py observe \
  --inputs /protected/publication.json --sha256 REVIEWED_PUBLICATION_INPUT_SHA256 \
  --operator-sha256 REVIEWED_PUBLISHER_SOURCE_SHA256
```

There is no public one-command facade. `observe` emits
`observe.acceptance.original.json` with `PUBLIC_SHELL_RUNTIME_AND_HTTPS_ACCEPTED`
and a genuine `accepted.previous.json` for the next preparation. Keep the original
image expectation, new effective-static/overlay manifests and original receipts.
Browser, presentation and native checks retain their separate scope.

The [public preparation guide](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/PUBLIC-SHELL-UPDATES.md)
defines custody and baseline fields; the
[public promotion guide](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/PUBLIC-SHELL-PROMOTION.md)
defines stage/publication inputs, exact guards and phases.

## Results, timing and refusals

Full file hashes, sizes, modes, signed catalogue and storage/owner identity remain
mandatory. Public snapshots are single-member gzip tar streams: CRC, trailer,
complete file inventory and tar end blocks must pass before extraction. A command
exit code of zero alone does not establish complete transport.

Read measured phase receipts rather than treating Vite time as deployment time.
The private facade records `elapsedSecondsByPhase`; neither lane promises a fixed
end-to-end duration or enables unattended following of main. A local build,
offline plan or synthetic fixture is not live acceptance. Normal CI and the
explicit web release gate remain required; native/device holds remain separate.

Serialize updates sharing a target. Every mutation needs its mandatory site
preflight last, plus fresh exact resource guards. If a phase refuses, preserve
the exclusive attempt directory and `*.uncertain.json` with its original
responses. Inspect the current state read-only; do not repeat apply, replay an
intent or relabel a failure as success. A forward fix or rollback needs a new
reviewed intent against the current state. Retain old qualified claims until
acceptance, and preserve current user data.

For `lolly.ing` and `lolly.tools`, use the production handoff in
`lolly-private/production/README.md` and its `check-target.py`. Historical
`candidate` names identify the current UpCloud K3s production host.


### Public qualification costs

Avoiding an image build does not make the full public release immediate. The full-root
qualifier still verifies the complete static root, models, native HTTP behaviour and
normal-TLS responses before publication. At each of its three model checkpoints it now
uses one complete physical scan for both the owner assertion and inode/hash comparison;
this removes three duplicate scans without reusing an older checkpoint or skipping a
byte check across either HTTP boundary. The accepted receipt format is unchanged.

One 177-model qualification read 5.39 GB of models and transferred 10.78 GB over TLS
through ordinary and mismatching-If-Range requests. Its TLS portion took about 13 minutes;
the full qualification took about 28 minutes. These are measurements from that run,
not a promised duration or a measured result of the scan reduction. The original full path
and publication checks remain unchanged. The explicit accepted-checkpoint option and
complete operation measurements below address the separate work tracked in
[issue 115](https://github.com/lolly-tools/lolly-work/issues/115).


The maintained full-root stage and publisher write `<phase>.timing.actual.json`
with monotonic elapsed seconds, including their guard work. Model HTTPS checks
also write `models-http.timing.actual.json` during qualification and
`owning-models-tls.timing.actual.json` during observation. These record requests
started, responses completed and response-body bytes actually read, including
partial reads on failure. Bytes exclude headers and TLS framing; they are not
network-interface traffic measurements. Model time is part of its enclosing
phase time, so do not add them together. Constructor and local preparation time
are not covered by these phase sidecars.

These diagnostic files do not grant acceptance. Keep the existing accepted or
uncertain receipt and original command evidence alongside them; a completed phase
body or HTTP check alone does not prove publication succeeded. An interrupted
process may leave no timing file. This telemetry does not reduce transfers or
claim a faster release.

Reuse of model proofs must remain within the exact same verified
owner and process checkpoint. A replaced owner or process requires full
qualification, even when image and storage identities match. A Recreate rollout
necessarily changes owner, so a proof from the old serving owner cannot qualify
the new one. Cross-owner reuse remains outside the current optimization.

### Completing a failed observation under the same owner

The maintained frontend publisher now writes `observe.checkpoint.actual.json`
only after its full model TLS checks, complete physical checks on both sides of
HTTP, and final owner and native-process bookend succeed. This checkpoint is
explicitly **not release acceptance**. If a later diagnostic fails, retain the
original `observe.uncertain.json` and every command and raw stream.

`continue-public-observation.py` supports `check` and `observe` only. A reviewed
input binds the original publication proof (with its checkpoint as the observation
receipt), the original started and uncertain markers, the complete sorted original
command-reference list, and a new exclusive output directory. The continuation
operator must already belong to the original reviewed source registry. Supply the
exact input and operator hashes with `--reviewed-input-sha256` and
`--reviewed-operator-sha256`; there is no publication or rollback action.

A continuation must begin and finish within 15 minutes of the checkpoint. It
requires the same Deployment, ReplicaSet, Pod, container, native PID/start ticks,
boot, namespace, executable and root identity, together with unchanged reviewed
configuration and storage. It performs fresh complete physical model/static hashes,
health, native HTTP, memory and fixed-entry TLS checks. Every model gets fresh
cache, CORS, conditional request and range checks; range hashes must match the
original full verification. Only the two complete-body transfers for model files
larger than 64 KiB are reused. The resulting rows label those proofs `REUSED` and
retain their original values and receipt rather than describing a new download.
Smaller files still receive both complete-body requests.

Expiry, owner/process replacement, changed bytes, configuration or storage, missing
original commands, altered validators, a failed fresh check, or an already accepted
or rolled-back attempt all refuse the continuation. A new failed continuation
keeps its own uncertain journal; it never erases or retries the original attempt.
Normal publication acceptance validates both journals and the exact proof links.

This recovery path keeps full physical scans and applies only to its original
owner. No production speedup is claimed for this continuation.

### Reusing an accepted model checkpoint during the next stage

A reviewed runtime input may opt in with a held `modelReuse` request linking the
previous genuine acceptance and its full model checkpoint. Qualification requires
that exact serving owner and native process, unchanged configuration/model recipe
and claim/PV bindings, and a checkpoint no older than 24 hours at both bookends.
It retains all three full physical model scans, fresh endpoint/protocol checks
and global guards. Missing or stale explicit proof refuses; omitting the option
uses the original full-body path. Publication after Recreate still transfers all
model bodies for the new owner.

`measure-public-release.py` wraps one reviewed command at a time to retain its
actual exit/stdout/stderr and constructor-inclusive duration. Disjoint preparation,
staging and publication operation records can be totaled without double-counting
nested HTTP measurements. The runnable loopback fixture compares actual full and
reused body bytes; it does not measure production deployment speed. See
[model proof reuse and release measurements](public-model-proof-reuse.md) for the
request shapes, timing commands, measurements and limits.
