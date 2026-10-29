# Release 1.1.3: Lolly and Work

This is the current release. Work 1.1.3 pairs the Work server and render worker with
[Lolly 1.1.3](https://github.com/lolly-tools/lolly/releases/tag/v1.1.3), built from
Lolly source `e3a35cc883a9f240bacfb1854fd47b12044dfa71`. It is published as
[Work v1.1.3](https://github.com/lolly-tools/lolly-work/releases/tag/v1.1.3).
Installation and production acceptance are tracked separately.

Start with the tagged [installation guide](https://github.com/lolly-tools/lolly-work/blob/v1.1.3/docs/install.md),
[deployment options](https://github.com/lolly-tools/lolly-work/blob/v1.1.3/docs/deployment.md)
and [documentation index](https://github.com/lolly-tools/lolly-work/blob/v1.1.3/docs/README.md).

1.1.3 is the first release where everything people install carries the same number: the
Work server and render worker images, the admission adapter, the Helm chart, the YunoHost
package, the appliance image and the ready-made package all follow the Lolly release.

## Matching components

| Component | Version or source |
|---|---|
| Lolly product version | 1.1.3 |
| Work application | 1.1.3 |
| Render worker and admission adapter | 1.1.3 |
| Work Helm chart | 1.1.3, with appVersion 1.1.3. The first published chart |
| Lolly source | e3a35cc883a9f240bacfb1854fd47b12044dfa71 |
| Engine | 1.285.0 |
| Tool-author core | 1.5.0 |
| Lolly web archive for YunoHost | `lolly-web-1.1.3-ynh1.tar.gz`, 752,098,780 bytes, SHA-256 `1ff9a26889d10984ce377e6890283859a9ba7bca2981d8df1e49e572e792925d` |

Engine and core versions describe their own contracts and are not reset to the
product version. `engine-pin.json` and `content-resolver-pin.json` record the
Lolly source above. The maintained producers generated both.

Work 1.1.2 carried engine 1.281.0. Engine 1.285.0 adds brand skills, creation
feedback and the house-rule fixes described in the Lolly 1.1.3 notes; no Work route
needed a change for them.

## What Lolly 1.1.3 needs from this release

| Lolly 1.1.3 feature | What Work 1.1.3 adds |
|---|---|
| A published web app served by Work shows its tools | `GET /api/v1/catalog/public-key`, the installation's catalogue key, which the web app accepts from the same origin only |
| Shared originals sent to organisation delivery targets | Brandfolder and Cloudinary write adapters, with provider progress kept across retries |

**The API detail behind each feature**

- **The installation's catalogue key.** A release web app pins the publisher's catalogue
  key, while Work signs each person's catalogue with the installation's own key
  (`LW_CATALOG_SIGNING_KEY`). Work now answers `GET /api/v1/catalog/public-key` with
  `{ version: 1, alg, keyId, publicKey }`. Lolly 1.1.3 asks for this key only when a
  catalogue envelope was signed with a key other than the pinned one, only from the origin that
  served the web app, and only to verify an envelope signed with that key. A Work
  server without signing answers 404, and the web app keeps the pinned key alone.
- **Shared-original deliveries.** A shared project's original can go to a Brandfolder
  or Cloudinary destination that opts in. Each delivery keeps its source provenance and
  checkpoints the provider's progress, then checks access again before the provider
  write. A send whose outcome is uncertain is held for review, so a retry cannot
  duplicate the provider's asset.

## Other changes since 1.1.2

- **Watermark `never`.** A tool overlay that sets `enforce.watermark: 'never'` now turns
  the preview mark off. In 1.1.2 it behaved like no rule.
- **Driver cards.** The git and Microsoft 365 provider cards prefill `rawBase` and
  `itemPath`.
- **Faster collaboration commits.** The PostgreSQL store writes a collaboration batch's
  receipts in one statement instead of one per operation.
- **S3 stores that drop metadata.** At startup the driver checks the store once. On a
  store that drops content types and `x-amz-meta-*`, Work keeps that metadata itself, so
  uploads keep their types and checksums.
- **Readiness.** `/readyz` says which check failed.
- **Service tokens.** A member service token (`Authorization: Bearer lwt_…`) can read
  `/catalog/*` and name itself, so an unattended check needs no session cookie.
- **Feature flags.** Optional per-group flag rules, and an OpenFeature (OFREP) flag
  service as a resolver. Both are off unless configured.
- **OpenTelemetry.** Work can export traces, metrics and logs over OTLP/HTTP to your own
  collector. Export is off unless an OTLP endpoint is set.
- **Render dispatch.** An opt-in pull dispatch for render workers
  (`render.worker.dispatch: "pull"`), with queue metrics on `/metrics`. Push stays the
  default.
- **Console.** The two-step confirm keeps its label and announcements accurate.

## Changes for API clients and operators

- **New route.** `GET /api/v1/catalog/public-key`, described above.
- **Service tokens on the catalogue.** `/catalog/*` (GET and HEAD) accepts a member
  service token.
- **Migration expectations.** `pnpm run migrate:classify` classifies each migration, and
  the runner can refuse an unexpected class through `LW_MIGRATE_EXPECT`. An install that
  leaves `LW_MIGRATE_EXPECT` unset sees no change.

## Migrations

This release adds one SQL migration since 1.1.2:

- `0071_dam_delivery.sql` adds the `project_source` and `provider_progress` columns to
  `deliveries`.

Before upgrading, check the database with `pnpm run migrate:status`, take a fresh verified
backup and complete an independent restore. Then apply the maintained migration runner or
the chart's migration Job, against the selected instance only. The maintained history now
has 67 files.

## Deployment

- **Helm chart 1.1.3.** The chart's version is the release version. It gains an optional
  PrometheusRule of suggested alerts and a Grafana dashboard, both off by default, and
  its migrate hook works under Helm 4. The chart is published through
  `publish-helm.yml` from the release commit, as its first publication.
- **Admission policy.** A Kubewarden policy set and its requirements file are in
  `deploy/kubewarden`.
- **K3s on transactional hosts.** The K3s kit installs on openSUSE Leap 16.1 Immutable
  and other transactional hosts, with an arm64 lock.
- **The appliance.** A Leap 16.1 Immutable appliance image with a k3s or podman profile,
  `lolly-update` for signed updates and host rollback through health-checker. Its image
  name carries the release version.
- **AppArmor hosts.** An opt-in AppArmor companion for the render worker's Chromium
  sandbox. SELinux hosts need nothing new.
- **The ready-made package.** The content service gives the installed web app the
  installation's catalogue key, and a browser lists the package's tools. Its pins
  move to the 1.1.3 pair after this release is published.
- **Container bases.** The server and render worker images use Node 26.12.1.

## Prepare and qualify

This section is for Work maintainers cutting the release.

**Maintainer commands**

The commands are the same as for 1.1.2, with `vendor/lolly` at the Lolly source
above:

```text
node scripts/vendor-content-resolver.ts --write
pnpm run repin-engine --apply
pnpm run verify:engine-pin
pnpm run typecheck
```

The packaged documentation comes from a Lolly commit that contains this page:

```text
node scripts/sync-docs-bundle.ts --source=/path/to/lolly --commit=<full-commit-sha>
pnpm run verify:docs-pin
```

Before tagging or publishing images, the exact final Work commit needs ordinary
CI, including the native server image checks and the real Chromium worker checks
with the matched signed shell. The tagged server and worker images must come from
that same Work commit.

## YunoHost packaging

Lolly 1.1.3 publishes a new web archive, and the Work YunoHost package pins the
`lolly-web-1.1.3-ynh1.tar.gz` archive above. The maintained producer cuts the package on
the final Work commit:

```text
node scripts/yunohost-release.ts --ynh-rev 1 --shell-url https://lolli.li/lolly-web-1.1.3-ynh1.tar.gz --shell-sha256 1ff9a26889d10984ce377e6890283859a9ba7bca2981d8df1e49e572e792925d --out ABS_NEW_ARTIFACT_DIRECTORY
```

Commit the generated manifest, recut into a separate directory and require full
archive byte equality, as for 1.1.2. The package is mirrored to `lolly-work_ynh` and
qualified with a `yunohost-runtime.yml` run after publication. Until then it is not
qualified.

## Images and qualification

The release workflow builds, signs and publishes the server and render-worker images
from the `v1.1.3` tag push. The release's `release-source-images.json` records their
verified digests. Both are signed keylessly with identity
`https://github.com/lolly-tools/lolly-work/.github/workflows/release.yml@refs/tags/v1.1.3`,
the identity `lolly-update` accepts.
