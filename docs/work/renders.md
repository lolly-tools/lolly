# Render jobs and batches

This page is for the automation builder or admin who renders through Lolly Work and needs the
result to survive a restart: submit a render or a batch, fetch the file, check the result and recover
work a crash interrupted. A render job uses your instance's tools, inputs and renderer, and each
job belongs to the person or service token that submitted the job.

For a quick render straight to bytes, with no stored job, use `GET /render` ([server
renders](sharing.md#server-renders)).

## Render once and fetch the file

Save a request as `render.json`, using a tool from your instance:

```json
{
  "toolId": "qr-code",
  "format": "svg",
  "inputs": { "url": "https://example.com" },
  "priority": 0,
  "maxAttempts": 3
}
```

```bash
lw renders submit render.json --idempotency-key campaign-qr-v1 --json
lw renders list --json
lw renders show <renderId> --json
lw renders output <renderId> --out qr.svg
lw renders evidence <renderId> --out evidence.json
lw renders cancel <renderId>
lw renders retry <renderId> --idempotency-key campaign-qr-retry --json
```

`submit` returns the job's id at once. `show` reports its state, the number of attempts and a
structured failure when one occurs. The output is available after success, and downloading it
verifies the stored bytes against the job's SHA-256 receipt.

::: figure work-renders-states
A job is queued, then running, then succeeded, failed or cancelled. A retry is a new job that points back at the one it replaces.
:::

- **Idempotency.** The same principal and idempotency key return the original job for an
  equivalent request, even when the object's keys were written in a different order. Reusing
  the key with different input values returns `409 IDEMPOTENCY_KEY_REUSED`. Keep the original
  key if an HTTP response is lost.
- **Priority and attempts.** `priority` is an integer from 0 to 9 (higher runs first).
  `maxAttempts` is 1 to 5 and defaults to 3.
- **Failures.** Transient failures retry with bounded backoff. Invalid input and policy refusals
  stop without spending the remaining attempts.
- **Retry.** A manual retry creates a new job with `retryOf` pointing at its predecessor, and
  the original history stays intact.
- **Cancel.** Cancelling keeps the job and stops an active attempt from publishing its result.

### HTTP

| Method and path | Result |
|---|---|
| `POST /api/v1/renders` | The request above; `202` for a new job, `200` for an idempotent replay |
| `GET /api/v1/renders?limit=50&offset=0` | Caller-owned jobs the caller may still see; `nextOffset` for paging; limit 1 to 100 |
| `GET /api/v1/renders/:id` | Request, state, attempts and output receipt |
| `GET /api/v1/renders/:id/output/default` | The stored bytes; `409` before success or on an integrity failure, `410` if missing |
| `GET /api/v1/renders/:id/evidence` | The execution receipt and render identity; `409` before success, on a receipt or identity integrity failure, or for an identity version this server cannot check; `404 EVIDENCE_UNAVAILABLE` for older outputs with no evidence |
| `DELETE /api/v1/renders/:id` | Cancel queued or running work; completed history is kept and returns `409` |
| `POST /api/v1/renders/:id/retry` | A new job from a failed or cancelled predecessor; accepts `Idempotency-Key` |

Authentication is required even on an open instance. Creating, running and reading a job check
current tool visibility, `tool.use` and `export.server`. Each attempt reads the current member or
service token, so disabling the member, revoking the token or removing the grant stops queued
work from running. The owner can still cancel after losing a tool grant. These routes share
`rateLimit.automation`.

## Batches with durable rows

Use `/api/v1/render-batches` when each row needs its own stored result and recovery history.
Save this as `batch.json`:

```json
{
  "toolId": "qr-code",
  "format": "svg",
  "inputs": {},
  "rows": [
    { "key": "home", "inputs": { "url": "https://example.com" } },
    { "key": "support", "inputs": { "url": "https://example.com/support" } }
  ]
}
```

```bash
lw render-batches submit batch.json --idempotency-key campaign-qr-v1 --json
lw render-batches list --json
lw render-batches show <batchId> --json
lw render-batches manifest <batchId> --out manifest.json
lw render-batches cancel <batchId>
lw render-batches retry <batchId> --idempotency-key campaign-qr-v1-retry --json
lw renders output <childRenderId> --out qr.svg
```

- **Rows.** Each row shallowly overrides the shared `inputs`; nested objects and arrays are
  replaced as whole values. Row keys are unique, case-sensitive identifiers of 1 to 80 letters,
  digits, underscores or hyphens, starting with a letter or digit, and their order is kept.
- **Limits.** A batch takes 1 to 200 rows, uses the same `priority` and `maxAttempts` for every
  row, and limits the expanded requests to 2 MB. The HTTP JSON body limit is 512 KiB. Unknown
  fields and invalid tool inputs reject the whole submission before any row is created.
- **Execution.** The parent and its child renders commit in one transaction. The render runner
  claims the children one by one, with the same concurrency, lease, policy and output checks as
  a single render. Recovery runs unfinished children; completed children keep their ids,
  attempts and output receipts.

`show` and `manifest` read a consistent snapshot of the parent and its children: counts per state,
and ordered rows with the row key, render id, request, attempt, failure and, after success, the
output URL and SHA-256 receipt. The downloadable JSON adds `manifestVersion: 1`. It is a status
snapshot, not an approved release or a ZIP archive: fetch each output through its child render
URL. Successful rows stay downloadable even when another row fails.

A batch starts `queued` and becomes `running` when any row starts or finishes. Once every row has
finished, the batch is `failed` if any row failed, otherwise `cancelled` if any row was cancelled,
otherwise `succeeded`. `progress.done` counts every finished row, including failures and
cancellations. Counts come from the child records, so they cannot drift from a saved counter.

**Cancel and retry.** Cancelling stops every unfinished child at once and keeps successful and
failed rows. A retry needs a finished batch with at least one failed or cancelled row.

::: figure work-renders-batch-retry
A batch retry makes a new parent that reuses the rows that succeeded and re-runs only the ones that did not.
:::

The retry creates a new parent with `retryOf`, reuses successful child jobs and creates new
linked renders only for the rows that did not succeed. The old manifest stays unchanged.
Retried rows use current policy and content while reused rows keep their original bytes, so a
retried batch can hold outputs from different content versions. A direct `lw renders retry`
creates an independent render; use the batch retry to get a new parent manifest with the
replacements.

| Method and path | Result |
|---|---|
| `POST /api/v1/render-batches` | The request above; `202` on creation, `200` on idempotent replay |
| `GET /api/v1/render-batches?limit=10&offset=0` | Caller-owned summaries and `nextOffset`; limit 1 to 20 |
| `GET /api/v1/render-batches/:id` | Parent and ordered child status |
| `GET /api/v1/render-batches/:id/manifest` | Download the current JSON manifest |
| `DELETE /api/v1/render-batches/:id` | Cancel unfinished rows; `409` if already finished with no cancelled rows |
| `POST /api/v1/render-batches/:id/retry` | A new parent keeping successes; accepts `Idempotency-Key` |

Batch idempotency keys are scoped to the submitting principal and separate from single-render
keys. Creating, reading and retrying check current tool grants, and the owner can still cancel
after a grant is removed. These routes also share `rateLimit.automation`. The older
`/api/v1/batch` job and ZIP contract is separate and does not create these child jobs.

## Verify the produced file

Add `"verification": "output-v1"` to a render or batch request to require a file check before
the output is published. To require particular dimensions, use an object:

```json
{
  "toolId": "card",
  "format": "png",
  "inputs": {},
  "verification": {
    "profile": "output-v1",
    "widthPx": 1200,
    "heightPx": 630
  }
}
```

Use a tool that produces those dimensions: the numbers are assertions about the delivered file
and do not resize the artwork. Each dimension is optional, and the string form and
`{ "profile": "output-v1" }` mean the same. Submit through `lw renders submit` or
`lw render-batches submit` as usual.

The `work/output-v1` profile checks the actual format, MIME type, readability and requested
dimensions after watermarking, provenance and signing. SVG is parsed as XML without running
scripts or loading linked resources, and PNG and JPEG are fully decoded with sharp. The receipt's
`inspection` records each check, its result, the measured dimensions, the final SHA-256 and the
detector version.

| Output | Evidence | Limit |
|---|---|---|
| SVG | XML root and namespace; explicit absolute viewport dimensions, with CSS units converted at 96 px/in | 2 MiB; DTDs unsupported; no rendering, linked-resource or visibility check; percentages and viewBox-only dimensions stay unknown |
| PNG, JPEG | Recognised container and a complete pixel decode; pixel dimensions | 32 MiB and 16 million pixels; one frame; decoding limited to 10 seconds |
| PDF | Container signature | No independent PDF decoder in Work; readability and dimensions stay undetermined |

A required check must return `pass`. Missing, failed and undetermined checks stop a verified
render with `OUTPUT_VERIFICATION_FAILED`; the failed record keeps `error.inspection`, and no
output is published. A mismatch stops after one attempt, and a manual retry keeps the original
requirements and creates a new record. Batch children have the same checks and keep their own
outcomes.

Draft requests without `verification` keep ordinary export behaviour, including PDF export where
a worker is configured. New durable draft receipts also carry inspection results, which may show
failed or undetermined checks; older receipts without `inspection` have unknown check coverage. A
verified request always runs fresh and never reuses a draft cache entry.

## Evidence and identity

Every new durable render, batch children included, keeps two records with its output: an
**execution receipt** of what the attempt read and produced, and a **render identity** that
fingerprints what it resolved. Download both with
`lw renders evidence <renderId> --out evidence.json`.

### Execution evidence

The output descriptor links to `/api/v1/renders/:id/evidence` and reports the receipt id and
`coverage: "partial"`.

| Fact | Receipt | Identity |
|---|---|---|
| Loaded tool version, its file digests and combined source hash, engine and document API versions | yes | tool version, source hash, engine and document API versions |
| The request: tool, format, inputs, verification and production settings | hashes of the prepared input values, and the format | the whole typed request with key order ignored, plus the resolved input values; priority and attempts left out |
| Profile and groups | hashes | profile digest and group set |
| Policy and catalog versions | yes | catalog version |
| Design-system revision and a digest of the effective policy | yes | yes |
| Format, pixel dimensions, watermark, renderer, rasterizer, signing-certificate digest | yes | yes |
| Catalog and provider assets read through Work's bridges: id, format, declared version, actual byte digest and size | yes | id, format, declared version and digest |
| For the local runtime: hashes of initialized inputs and hydrated markup, hook-error and dropped-asset counts | yes | no |
| Output SHA-256 and a digest of the whole receipt | yes | no |

The **effective policy** covers this tool's enforcement settings, the access each input resolves
to for the caller's groups after design-system rules are applied, and any managed design-system
rules. Profile values, provider credentials, asset bytes and internal storage references are
never copied into the receipt. Asset digests come from the bytes actually read, not from a
catalog checksum.

Output and evidence settle under the same worker lease, so a stale attempt cannot replace either.
Durable attempts bypass the output cache, so observations come from the attempt that produced the
stored bytes; an idempotent replay still returns the original job and its original receipt.
Ordinary render-cache keys distinguish nested input values, profiles, export dimensions,
watermark settings and loaded source content, and hooks run afresh because they can read state
outside the host.

Storage is bounded to 256 distinct asset receipts and 128 KiB of asset metadata. More
observations set `asset-observation-limit`, and a provider result whose bytes cannot be observed
sets `asset-bytes-unobserved`. Evidence lives in the existing output JSON record and needs no
extra migration. Earlier successful outputs stay downloadable but have no invented receipt, so
their evidence endpoint reports `404 EVIDENCE_UNAVAILABLE`. Evidence can be read even if the
stored output bytes later become unavailable, and reads use the same ownership and current-grant
checks as the render itself.

### Render identity

The request fingerprint used for idempotency identifies the typed request. The render identity
binds that request to what the successful attempt resolved, and the output descriptor reports
`identity.id` with `coverage: "partial"`.

- A source edit or an engine re-pin gives a new identity.
- An edit to this tool's overlay gives a new identity when it changes one of the enforcement
  settings or what this caller may do with an input. Rules for other groups, rule names and
  reasons, the overlay's version counter and overlays on other tools keep the identity.
- Output bytes, runtime hashes and inspection results are not part of the identity. Two attempts
  that resolved the same facts share an identity even when signing timestamps make their bytes
  differ, and a shared identity does not promise identical bytes, because hooks can read state
  outside the host.
- Replaying an idempotency key still compares the typed request alone, so it returns the
  original job with its original identity.
- The identity carries the receipt's limitations, except worker network budget notes, which vary
  between attempts. A worker render adds `worker-resources-outside-identity`, because the
  worker's own resource reads are not bound. The catalog version is coarse: it also moves when an
  unrelated catalog asset changes.

The evidence download recomputes the identity from the stored request and receipt, and reports
`409 EVIDENCE_INTEGRITY` when they disagree. What the `work/render-identity-v1` identity hashes is
fixed, so a later release that hashes something else uses a new `apiVersion`, and a server that
meets an identity version it cannot check reports `409 IDENTITY_VERSION_UNSUPPORTED`. A receipt for
a different tool or format fails the attempt with `RENDER_EVIDENCE_MISMATCH` before any output is
stored. Outputs made before identities existed, and outputs without a receipt, have no identity.

### What a receipt does not prove

::: note Receipts are partial evidence, not a lockfile or an approval
- **Coverage is partial.** The pinned engine does not yet emit a canonical dependency graph.
  Template and global resource reads, fonts, composition and historical replay are not fully
  attested, and every receipt carries explicit `limitations` for these boundaries.
- **A worker render is attested less.** Its receipt records the tool loaded for Work's own
  validation and the prepared context; the worker's actual engine, inputs, profile, tool, asset
  and font environment are not attested, and it has no local-runtime section.
- **An empty asset list** means no bridge reads were recorded, not that the output is proven free
  of dependencies.
- **Nothing is pinned for later attempts.** Attempts and manual retries use the current mounted
  content, profile and policy. Neither the request fingerprint nor the render identity is a
  lockfile for every font, asset, token, engine and policy version, and neither proves a
  historical reconstruction.
- **It is not a signed attestation**, cache-reuse authority or an automatic stale or current
  decision. Work does not reuse outputs by identity.
- **It is not approval.** A render identity says which bytes a render read, not whether anyone
  approved them, and a passing file check does not establish brand compliance, protected copy or
  chart preservation, correct fonts, matching appearance, accessibility, print readiness or
  publication approval. The file check is separate from the proposed `still-2d/1` visual
  conformance suite and from C2PA signing.
:::

## Hosting and recovery

The standalone server starts the runner automatically. Apply `0032_render_resources.sql` and
`0033_render_batches.sql` through the normal migrations runner. Use PostgreSQL and a persistent
BlobStore for recovery across restarts; memory mode is for evaluation and loses its data when the
process exits. Every replica must use the same database, byte store and compatible mounted
content.

- The runner polls once a second and runs up to two requests per process.
  `LW_BACKGROUND_POLL_MS` changes the poll interval in milliseconds for the render and automation
  runners, and `0` turns the timer off. The other runner defaults are not `instance.json`
  settings.
- Claims last 30 seconds and renew every 10 seconds. An attempt has a 120-second budget and keeps
  at most 32 MiB.
- A crashed worker's expired claim can be taken by another replica, spending another attempt.
  A job that runs out of attempts becomes failed.
- Only the current, unexpired lease can settle a result, and each attempt writes to its own blob
  path, so a worker finishing late cannot overwrite the winning output. Execution is at least
  once. Cancellation and timeout fence results, but a renderer that ignores cancellation can keep
  running.
- Function-only deployments refuse submission with `503 RENDER_RUNNER_UNAVAILABLE`, because a
  background promise in a short-lived request does not give reliable recovery. The `/render` and
  `/jobs` interfaces stay available under their own contracts.

**Storage.** Finished requests and outputs are kept with no automatic expiry or deletion, so
include them in storage sizing and backups. Losing attempts normally delete their unreferenced
blobs; an ambiguous database commit or a failed cleanup may leave an orphan for later collection.
Changes to jobs are audited.

**Not built yet.** Dependency snapshots, campaign reconciliation, a transactional lifecycle event
outbox and collection-wide approval and promotion. Organisation delivery accepts completed
`/jobs` render outputs ([delivering an automation
output](delivery.md#delivering-an-automation-output)); delivering one of these durable render
jobs by reference is not built, and a successful render alone publishes nothing to a destination.

## Production still checks and permitted repairs

A durable request can carry `production` beside `verification`. `output-v1` keeps its contract,
and the additional `lolly/production-still-v1` engine profile checks explicit requirements on the
final file. It can also try a bounded set of input alternatives you permit, to repair a failed
check.

The engine also offers `lolly/production-motion-v1` to Lolly's CLI and MCP. Work's governed
renderer accepts only the still profile and refuses a motion contract when it parses the request,
so updating the engine pin does not add video rendering to Work.

```json
{
  "toolId": "card",
  "format": "svg",
  "inputs": { "legalCopy": "Legal 125", "layout": "short" },
  "production": {
    "contract": {
      "profile": "lolly/production-still-v1",
      "id": "campaign-card",
      "revision": "1",
      "format": "svg",
      "width": 200,
      "height": 100,
      "pages": 1,
      "alpha": "any",
      "requirements": [
        { "id": "legal", "kind": "text", "location": "legal", "expected": "Legal 125" }
      ]
    },
    "repair": {
      "protected": ["legalCopy"],
      "permitted": { "layout": ["short", "long"] },
      "maxAttempts": 2,
      "when": [{ "findingId": "requirement.legal", "input": "layout" }]
    }
  }
}
```

- The tool must actually declare these inputs and offer those alternatives: no layout, legal
  copy or new input is invented, and each candidate runs through normal Work policy enforcement.
- Repairs bind exact input snapshots, reports and finding fingerprints. They stop when a passing
  check regresses or nothing improves, and never exceed eight attempts.
- `lw renders submit` accepts this JSON unchanged, and batch expansion and retry keep the same
  contract and repair choices.
- `evidence.production` holds final-byte measurements and their artifact, contract and report
  digests, and `productionAttempts` keeps the repair reports.
- Required failures or undetermined checks raise `PRODUCTION_VERIFICATION_FAILED` with bounded
  diagnostics on the durable record, and no output is published. The publication runner repeats
  digest, coverage and measurement validation even if another executor bypassed the normal
  render pipeline.

::: details What each kind of requirement can check
**Files.** SVG inspection parses XML without running scripts or fetching linked resources. Text
requirements address exact SVG ids, links compare href values and node requirements compare a
serialized XML element digest; text presence does not prove visible placement. PNG and JPEG use
bounded sharp decoding. Optional `pdfinfo`, `pdftotext` and `pdftoppm` enable PDF page geometry,
full extracted page text (`page:1` and so on) and one-page pixels at 96 dpi; missing programs give
unknown coverage. PDF colour, overprint and press conformance are outside this profile.

**Inputs.** An `input` requirement uses a declared input id as its location and a canonical JSON
SHA-256 as its expected value (`productionDigest(value)` in the engine). Local renders collect the
requested values from the exporting runtime. Chromium observations are matched to the downloaded
SVG and included in the signed worker response, and the client checks that every observed id was
requested. Conflicting observations, missing collectors and older web shells stay undetermined.
The report keeps hashes, within a 1 MiB combined JSON observation budget.

For Chart, protect the exact CSV `data`, field mappings, number format, units in axis titles,
`yScaleType`, `yZero` and `yMax` that the approved brief requires. Reusable Design tools use their
declared copy and data inputs. JSON types and array order are kept. A contract-protected input
cannot become a repair target even if a repair plan lists that input. These checks establish source
identity; visible labels, chart geometry and clipping need separate output checks, and shell
observations are not an attestation against hostile tool code.

**Comparison with a reference.** An optional contract `comparison` takes `referenceSha256`,
`channelTolerance`, `maxChangedFraction` and `regions` with `id`, `x`, `y`, `width`, `height`,
`minSsim` and `maxInkDelta`. Put the exact reference bytes in `production.referenceBase64`; the
request's 1 MB cap still applies. The reference digest is validated on admission and inspection.
Comparison uses native decoded 8-bit sRGB pixels, whole-image RGBA differences and region
luminance and ink measurements. It never resizes a reference or borrows a preview comparison's
success, and explicit text requirements stay independent.

**Sources and resources.** Optional source and context digest requirements, and `resource`
requirements, use actual execution observations. Local source hashes follow
`evidence.tool.sourceHash`, and context hashes use the canonical `evidence.context` object.
Resource locations are observed asset ids or worker response URLs. Conflicting digests under one
resource id are unresolved, and a required old identity that is unavailable never silently
resolves to the catalog's latest content.

**Browser renders.** Production browser renders need an upgraded worker: its signed response binds
the request and SVG digests and includes bounded observations of actual network use, and
profile-bound inputs are resolved into its render URL. These observations are partial: font
shaping, resource use, runtime profile API reads and a complete browser dependency graph are not
attested. Ordinary worker requests stay compatible with existing deployments, and worker PDF
export uses the actual SVG viewport instead of Chromium's default paper size.
:::

A successful measurement is not a human approval, permission to deliver or a claim of complete
reproducibility. Local review files cannot grant Work permissions, and destination approval
chains, current grants and delivery integrity checks keep their authority. The exact bytes and
the contract can be checked again offline. No new storage migration is needed.
