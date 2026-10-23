# `lw` CLI: administer Lolly Work

`lw` runs a Lolly Work instance from a terminal: people and invitations, asset sources, the
catalog, renders and delivery, audit and governance. It calls the same API as the console, so
the two stay in step, and anything an admin does in the console can go in a script. To render
artwork from a terminal, use the `lolly` command instead ([the Lolly CLI](https://lolly.tools/info/build/cli.html)).

## Install and sign in

Run `lw` from a Lolly Work checkout as `pnpm run cli <args>` or `node cli/lw.ts`. Run `npm link`
once in the checkout to get the plain `lw` the examples use. It is not in the container image or
the Helm pod, so you drive a deployment from a checkout, not from inside the deployment.

```bash
export LW_BASE=https://lolly.example.com    # or pass --base <url>
lw login                                    # device code: confirm it in a signed-in browser
lw summary
lw --json audit head                        # machine output
```

Plain `lw login` prints a short code and the instance's `/activate` URL. Open that URL in any
browser where you are already signed in, type the code and approve; the CLI collects an ordinary
session on its next poll. Codes are database rows, so any replica can answer, and the flow works
on every deployment. The session is stored at `~/.config/lolly-work/session` (mode 0600).

```bash
lw login --cookie 'lw_session=…'            # paste a browser session (works everywhere)
lw login --email admin@example.test         # the dev provider (dev.enabled only)
```

## Command map

| You want to | Commands | More |
|---|---|---|
| See who you are and what is connected | `whoami`, `summary`, `fleet`, `instance`, `preview` | [Reading](#reading) |
| Host the signed instance pack | `instance pack`, `instance pack-rm` | [Hosting the instance pack](#hosting-the-instance-pack) |
| Let people sign in | `invite add`, `invite ls`, `invite rm` | [Invitations](#invitations) |
| Give automation its own identity | `tokens` | [Service tokens](#service-tokens) |
| Render and recover renders | `renders`, `render-batches` | [Recoverable renders](#recoverable-renders) |
| Send finished files to a destination | `destinations`, `deliveries` | [Organization delivery](#organization-delivery) |
| Manage grants and policy as code | `grants`, `export`, `apply` | [Governance](#governance) |
| Provision people from an identity provider | `scim token` | [SCIM provisioning tokens](#scim-provisioning-tokens) |
| Apply retention and handle accounts | `retention run`, `users` | [Data lifecycle](#data-lifecycle) |
| Connect and leave asset sources | `providers` | [Catalog providers](#catalog-providers) |
| Add and review catalog assets | `catalog submit`, `catalog queue`, `catalog approve`, `catalog return` | [Catalog submit](#catalog-submit) |
| Send a large file | `upload` | [Resumable uploads](#resumable-uploads) |
| Edit metadata, collections and versions | `catalog fields`, `catalog meta`, `catalog collection`, `catalog versions` | [Org-defined metadata](#org-defined-metadata) |
| Post a message to members | `msg send` | [Messaging](#messaging) |
| Review design-system sources or a project | `brand`, `projects transfer-preview` | [Design-system sources](#design-system-sources-and-project-transfer) |
| Run database and signing setup | `migrate`, `audit retire-key`, `c2pa init` | [Local infrastructure](#local-infrastructure-commands) |

## Reading

```bash
lw whoami
lw summary            # telemetry rollups
lw fleet              # which shells/engines are connected (and this deploy's engine pin)
lw fleet installs     # registered installs - devices that spoke install/<id> while signed in
lw instance           # the public instance manifest - what a fresh app reads first
lw links [--all]
lw links revoke <id>
lw audit verify       # exits 2 if the chain is broken
lw audit head         # seq · hash · count · intact  (exits 2 if broken)
                      # "intact (N rows signed with a retired key before …)" after a rotation
lw preview --groups marketing,contractors   # what such a member receives
```

## Hosting the instance pack

```bash
lw instance pack dist-packs/acme.lolly   # host the signed pack (owner) - served at /connect/pack.lolly
lw instance pack-rm                      # stop hosting it
```

The pack is cut in the OSS repo (`node scripts/build-instance-pack.ts --brand <name>
--keyfile …`) with this deployment as its instance base; the upload refuses a pack that
points anywhere else. An unsigned pack is hosted but labelled dev-only - a key-pinned
app build will refuse that engine version.

Lolly Work treats the pack as a signed byte artifact, not as a second token processor.
It does not parse, rewrite or filter `tokens.json`: the shell-reserved
`lolly.foundation` and `lolly.ui` namespaces (including aliases between them) download
exactly as the OSS builder produced them.

## Invitations

```bash
lw invite add ana@example.com bo@example.com --group team --group brand   # admin or owner
lw invite add cy@partner.example --expires 2026-11-01T00:00:00Z
lw invite ls                 # open invitations: id, email, status, groups, expiry
lw invite ls --all           # revoked ones too
lw invite rm <id>            # revoke
```

`add` prints each address as one of:

- `invited`: a new invitation;
- `existing`: the address keeps its one active invitation, unchanged;
- `applied`: with `--group`, the address already belongs to an account, which joins the
  groups now;
- `refused`, with a reason: `self`, `account-disabled` or `owner-only` for an existing
  account, `invites-not-allowed` or `domain-not-allowed` for a new address that
  `policy.invites` does not allow.

It then prints the sign-in address to share. Nothing is emailed. `--group` repeats, and a
comma-separated value also works. An invited person joins the groups at their first
sign-in. Groups must already exist as local groups, and the caller needs `grant.edit` as
well. See [identity](identity.md#who-may-sign-in).

## Service tokens

```bash
lw tokens create --label ci --role admin    # owner; the secret prints once - store it now
lw tokens                                   # list (label, role, last used, revoked)
lw tokens revoke <id>
LW_TOKEN=lwt_… lw export --out governance.json    # any command, authenticated as the automation
```

A token outranks a stored session cookie when both are present - automation acts as the
automation, never as whoever last signed in on the machine. Tokens drive the action-gated
API (export/apply, providers, fleet, audit); the member-workflow commands refuse them.

## Recoverable renders

```bash
lw renders submit render.json --idempotency-key campaign-v1 --json
lw renders list --json
lw renders show <renderId> --json
lw renders output <renderId> --out artwork.svg
lw renders evidence <renderId> --out evidence.json
lw renders cancel <renderId>
lw renders retry <renderId> --idempotency-key campaign-v1-retry
```

The [render resource guide](renders.md) explains the request JSON, persisted
status, restart recovery and retained output. Retrying creates a new resource
linked to the original. Output and evidence downloads require an explicit file
path. [Execution evidence](renders.md#execution-evidence) records observed source,
context and asset digests with explicit coverage limits. For new outputs the
evidence file also holds the [render identity](renders.md#render-identity).

For multiple rows with individual recovery and output receipts:

```bash
lw render-batches submit batch.json --idempotency-key campaign-v1 --json
lw render-batches show <batchId> --json
lw render-batches manifest <batchId> --out manifest.json
lw render-batches cancel <batchId>
lw render-batches retry <batchId> --idempotency-key campaign-v1-retry --json
```

The [batch guide](renders.md#batches-with-durable-rows) defines shared inputs and
row keys. Retry creates a new parent and replaces only unsuccessful rows;
successful children keep their original output. Download each child through
`lw renders output <childRenderId> --out <file>`.

## Organization delivery

```bash
lw destinations
lw deliveries
lw deliveries show <deliveryId>
lw deliveries retry <deliveryId>
lw deliveries publish <completedRenderJobId> \
  --destination campaign-archive --name "Launch poster" \
  --idempotency-key campaign-42-poster-v1
```

`destinations` prints only the safe descriptors available to the current principal: label,
kind, formats, byte ceiling and public/private result visibility. It cannot read or edit an
endpoint, bucket, prefix or credential. `deliveries publish` sends a job id and destination id,
not the output bytes: Work consumes that principal's retained render result directly, checks
its digest and Content Credential again, and records the relationship on the receipt. An
optional `--format` is an equality assertion against the completed render, never a conversion
or override. See [outbound delivery](delivery.md).

## Governance

```bash
lw grants list
lw grants add <principal> <action> [<resource>] --effect allow|deny
lw grants rm  <principal> <action> [<resource>] --effect allow|deny

lw export [--out governance.json]           # canonical governance document
lw apply governance.json [--dry-run] [--prune]
```

`apply` prints a per-category diff (`+create ~update -delete (=unchanged)`) and the document
hash. `--dry-run` changes nothing; `--prune` also deletes store-only entries. See
[governance](governance.md).

## SCIM provisioning tokens

```bash
lw scim token create --idp keycloak   # prints the secret ONCE - paste it into the IdP connector
lw scim token list                    # metadata only; never the secret
lw scim token revoke <id>
```

Owner-only (`scim.manage`). The secret is stored only as its hash and is unrecoverable, so
the mint is the one moment you can copy the bearer. The IdP then drives `/scim/v2` with that bearer. See
[identity](identity.md#scim-provisioning).

## Data lifecycle

```bash
lw retention run            # apply the stated retention policy now (trims telemetry + audit, sweeps expired uploads)
lw users erase <id>         # erasure: delete the person's row + de-attribute their telemetry
```

Account offboarding and subject export have their own commands, all owner-only and
documented in [account lifecycle](account-lifecycle.md):

```bash
lw users erase-preview <id>       # read-only reference counts and erasure scope
lw users subject-export <id>      # one bounded page of the account's metadata (--category, --cursor, --limit)
lw users offboard-preview <id>    # direct issuance counts and what remains to review
lw users offboard <id>            # disable, end sessions, revoke direct issuance (content is kept)
```

`retention run` also runs daily on a long-lived server; on serverless, cron it with a service
token (`LW_TOKEN=… lw retention run`). It also removes unfinished project-file uploads more
than an hour past their expiry, and expired [scoped uploads](#resumable-uploads), and reports
how many as `swept`; the long-lived server does
that at boot and daily even with no retention policy. `users erase` is owner-only and answers a data-subject
request - the person's projects must be archived first, and the audit chain keeps its opaque
user id (the mapping to a person is what is removed). See [operations](operations.md).

## Catalog providers

```bash
lw providers list
lw providers preview --kind <kind> [--options '{…}'] [--mapping '{…}'] [--exposure '{…}'] [--json]
lw providers preview --kind <kind> --shape [--remote-id <id>] [--json]
lw providers add <id> --kind <kind> --label "…" \
    [--options '{…}'] [--mapping '{…}'] [--exposure '{…}']
lw providers credential <id> [--expires 2026-12-01]   # prompts, hidden - never argv; --expires states the vendor's schedule
lw providers auth <id>            # the OAuth kinds with a registered consent flow
lw providers enable|disable <id>  # owner-only
lw providers sync|health <id>
lw providers drift <id>
lw providers materialize <id> [--remote-id <id> | --section <name>]
lw providers cutover <id>         # owner-only
lw providers publish <id> --in <export-file> [--name <name>]   # owner-grantable publish-out
lw providers rm <id>
```

Every kind, what each supports and how to connect one is in
[Connect an asset source](providers/README.md), including how to read a preview. The
first-connection walkthrough is [install section 9](install.md#9-connect-a-source), and the
catalog side is in [catalog](catalog.md).

- **`preview`** builds a throwaway source from the flags, checks its health and maps up to ten
  files, then discards the record, so no id is needed or created. The credential is prompted
  hidden even for a dry run. `--json` prints the raw response, and exit code `2` means the
  health check failed.
- **`preview --shape`** returns no sample. It reports the call the driver made and the field
  labels and value types the service returned, compared with what the driver reads; never a
  value. `--remote-id <id>` adds a report on the per-file detail call.
  [Check a source on your own tenant](providers/tenant-check.md#read-the-shape-report) explains
  the report.
- **`credential --expires`** records the vendor's expiry date, so `lw providers list` warns
  from 14 days before.
- **`drift`** compares each materialized copy with the source's current change stamp. It is the
  cadence check during an exit ([Leave a DAM](offboarding.md)), and it is read-only, so it is
  safe on a schedule.

::: details Reading drift output
```bash
lw providers drift acme-canto
acme-canto: 2 drifted of 118 compared (118 materialized asset(s) in all)
  image:AB12C                  was 2026-06-01T00:00:00.000Z  now 2026-08-01T12:00:00.000Z  inst/9f2c…
  image:DE34F                  was 2026-05-04T09:11:00.000Z  now 2026-08-14T16:02:00.000Z  inst/1ab7…
never materialized (3): image:GH56I, image:JK78L, video:MN90P
remedy: lw providers materialize acme-canto --remote-id <remoteId> - idempotent per (provider, remoteId), so a re-run resumes rather than duplicates.
```

It compares the `sourceUpdatedAt` stamped on each copy with the `updatedAt` the source carries
now. A copy taken when the source carried no timestamp is compared with its `materializedAt`
instead. It stores nothing and re-materializes nothing.

`compared` counts only the copies that got a real answer. Every other copy is counted and
printed under its own reason:

```
not compared: 4 copy(ies) whose upstream record carries no change stamp the driver can read - check this kind's UPDATED_AT_KEYS against its live-verify runbook.
not compared: 2 copy(ies) whose change stamp would not parse as a date (shape NNNNNNNNNN) - drift detection is inoperative for those until the driver reads that format.
not compared: 1 copy(ies) whose remote id is no longer in the listing at all.
read with care: 3 comparison(s) used a stamp that names no timezone (shape NN/NN/NNNN NN:NN) - it was read in THIS server's timezone, so those answers can be off by its UTC offset.
```

The stamp **shapes** are printed, never the stamps: digits become `N` and letters `A`
(`NNNNNNNNNN` is an epoch integer, `NN/NN/NNNN NN:NN` a local date and time with no zone), so a
line tells a driver fix the format without leaking an upstream value.
:::

## Catalog submit

Put a local file into this instance's catalog, and work the review queue
([catalog](catalog.md#submitting-an-asset)):

```bash
lw catalog submit ./hero.png --name "Campaign Hero" [--tags campaign,hero] [--type icon] \
                             [--groups design] [--label "Q4 hero"]
lw catalog queue [--all]
lw catalog edit    inst/ab12cd34 --name "Campaign Hero 2026" --tags campaign,hero
lw catalog approve inst/ab12cd34
lw catalog return  inst/ab12cd34 --body "wrong logo lockup"
```

`submit` needs the `catalog.submit` action (the author role carries that action). With no
`policy.submit.chain` configured the asset is live on return; with one, it prints the state as
`submitted` and waits for `approve` or `return`. Identical bytes are reported as a duplicate
and nothing is stored a second time:

```
already in the catalog as inst/ab12cd34 (identical bytes; nothing stored)
```

`queue` lists what is waiting, tagged `mine` or `inbox` depending on whether it is your own
submission or one your groups may act on; `--all` includes what has already been published or
returned. `edit` corrects a pending submission's declared metadata before it goes out - name,
type, tags, description and the org's own fields, never the bytes or the exposure - and is
audited with its before and after. `approve` and `return` go through the approvals engine, so
you cannot decide your own submission.

## Resumable uploads

Send a large file in 1 MiB parts that survive a dropped connection or a restart
([resumable uploads](resumable-uploads.md)):

```bash
lw upload ./keynote.mp4 --project prj_ab12        # a shared file in a project (signed in as a person)
lw upload ./master.tif --scope catalog-submission  # an original to submit to the catalog
lw upload ./brochure.pdf --scope automation-input  # bytes for /api/v1/inspect or /api/v1/optimize
lw upload ./photo.jpg --scope file                 # a file reference you can also read back
```

`--name` sets the file name (the file's own by default) and `--content-type` its media type,
which is otherwise guessed from the extension. The command reads the file one part at a time
and keeps the upload id under `~/.config/lolly-work/uploads/` until the upload finishes. If it
stops, run the same command again: it asks which parts arrived and sends only the rest. An
upload left for more than 15 minutes expires, and the next run starts it again. A scoped
upload prints the id and checksum to name it by, for example
`POST /api/v1/catalog/submit?name=…&uploadId=…&checksum=…`. A service token (`LW_TOKEN`) may
use `--scope`; a project file needs a signed-in person. `--scope` needs an instance that turns
on `policy.uploads.enabled`; until then it answers `uploads are off`.

## Org-defined metadata

The fields an org defines for itself, on assets it already serves
([catalog](catalog.md#org-defined-metadata)):

```bash
lw catalog fields                                            # what this instance defines
lw catalog meta lolly/logo/primary --field region=EMEA --field campaign="Autumn Launch"
lw catalog meta inst/ab12cd34 --field region= --name "Campaign Hero 2026" --tags campaign,hero
```

`--field` is repeatable and takes `fieldId=value`; an empty value (`--field region=`) clears
one. `meta` needs `catalog.edit`. `--name`, `--tags` and `--label` apply to an instance-owned
`inst/*` asset only - a federated asset keeps the name its source gives it, and a pack asset is
a file on disk - while `--field` applies to any asset you can see. Defining the fields
themselves is `policy.edit` and belongs to the governance document
([governance](governance.md#policy-as-code)), not to this command.

## Collections

Named, ordered, group-visible sets of catalog assets
([catalog](catalog.md#collections)):

```bash
lw catalog collections                                       # every set, with its size and audience
lw catalog collection launch-kit --name "Launch kit" \
    --members inst/ab12cd34,ext/brandfolder/a1,lolly/logo/mono \
    --groups design,sales --label "Everything for the spring launch."
lw catalog collection launch-kit --members inst/ab12cd34      # replaces the member list whole
lw catalog collection launch-kit --rm
```

`--members` is comma-separated and **the order you type is the order the set keeps**; passing
it replaces the whole list rather than appending, so the command is idempotent. `--groups`
takes group names or `*` for everyone, and `--label` is the description. Both need
`catalog.collection.manage`, and a save is refused if it identifies an asset you cannot see.

## Versions and supersession

New bytes for an asset that is already in the catalog, and the two moves that change what it
serves ([catalog](catalog.md#versions)):

```bash
lw catalog submit ./hero-2027.png --asset inst/ab12cd34 --note "reshot in studio"
lw catalog versions inst/ab12cd34        # the history, newest first; * marks what serves
lw catalog rollback inst/ab12cd34 1      # point the head at version 1
lw catalog version-rm inst/ab12cd34 2    # delete a stored version (never the served one)
lw catalog supersede inst/ab12cd34 inst/ef56ab78    # retire in favour of another asset
lw catalog supersede inst/ab12cd34 --rm             # and undo that
```

`--asset` turns `submit` into a new version rather than a new asset, the id and URL stay
put and the prior bytes stay readable at `?v=N`. It needs `catalog.edit` (replacing published
bytes is curation, not contribution), and the descriptive flags are refused with it - use
`lw catalog meta` for those. `version-rm` answers `409` for the served version and for a held
asset. `supersede` writes `replacedBy`, which is advice to consumers and not a takedown.

## Messaging

```bash
lw msg send --title "Update by Aug 15" \
    [--body "…"] [--kind …] [--severity action] \
    [--groups marketing,legal] [--shells tauri] [--max-engine 1.52.99]
```

## Design-system sources and project transfer

```bash
lw brand                                             # design-system sources and your permissions
lw brand preview <action> <source-id> [--replacement <id>] > review.json   # review an impact as JSON
lw brand apply review.json                           # apply that reviewed revision
lw projects transfer-preview <id> [--json] [--out file.json]   # read-only project inventory
```

See [design-system administration](design-system-administration.md#review-and-apply) and
[project transfer preview](project-portability.md).

## Local infrastructure commands

These talk to something other than the API base:

```bash
lw migrate [--check]          # needs a local DATABASE_URL; --check exits 1 if pending
lw audit retire-key --reason "secret rotation 2026-10-04" [--expect-head <seq>:<hash>] [--dry-run]   # needs DATABASE_URL and LW_SESSION_SECRET
lw c2pa init [--org "Acme"] [--out ./c2pa] [--days 365]
```

`lw audit retire-key` records a retired-key boundary in the audit log after
`LW_SESSION_SECRET` was rotated, so the rows signed under the old value read as
retired rather than as a broken chain. It runs with the server's own environment: the
container image carries it as `node scripts/audit-retire-key.ts`. Pass the head you recorded
before the rotation with `--expect-head`. It refuses (exit 2, nothing written) when the rows
do not look like a key change; `--allow-interleaved` and `--no-witness` override two of those
checks, and the audit boundary records the rotation. See [audit](audit.md#rotating-the-session-secret).

`lw c2pa init` mints a self-contained signing identity (root + leaf) so exports can be signed
with zero corporate PKI, and prints exactly what to wire where. If you have a corporate CA,
skip it and use your own chain. See [c2pa](c2pa.md).

## Global flags

| Flag | Meaning |
|---|---|
| `--base <url>` / `LW_BASE` | which deploy to talk to (default `http://localhost:8787`) |
| `--token <token>` / `LW_TOKEN` | act as a [service token](#service-tokens); takes precedence over a stored session |
| `--json` | machine-readable output |

Exit codes: `1` on any API error or usage mistake (including `migrate --check` with a
pending schema), `2` specifically for a broken audit chain or a failing provider health
check - so both are usable as monitoring checks.
