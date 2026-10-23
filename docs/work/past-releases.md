# Past releases

These are the records of earlier Lolly and Work releases: what each paired, what it
changed, its migrations and its image digests. For the current release, read
[Release 1.1.2](release-1-1-2.md). Each release's own tagged documentation stays on
GitHub, linked from its section.

## 1.1.1

Work 1.1.1 paired the Work server and render worker with
[Lolly 1.1.1](https://github.com/lolly-tools/lolly/releases/tag/v1.1.1), built from Lolly
source `26cf05324f46dc4cacd65d12d6f454ada181fb5e`, and is published as
[Work v1.1.1](https://github.com/lolly-tools/lolly-work/releases/tag/v1.1.1). Its tagged
[installation guide](https://github.com/lolly-tools/lolly-work/blob/v1.1.1/docs/install.md),
[deployment options](https://github.com/lolly-tools/lolly-work/blob/v1.1.1/docs/deployment.md)
and [documentation index](https://github.com/lolly-tools/lolly-work/blob/v1.1.1/docs/README.md)
describe it as released.

| Component | Version or source |
|---|---|
| Lolly product version | 1.1.1 |
| Work application | 1.1.1 |
| Work Helm chart | 0.3.1; appVersion 1.1.1 |
| Lolly source | 26cf05324f46dc4cacd65d12d6f454ada181fb5e |
| Engine | 1.261.0 |
| Tool-author core | 1.4.0 |
| Lolly web archive for YunoHost | `lolly-web-1.1.1-ynh1.tar.gz`, SHA-256 `bc78012aa407983ecc818e63be98ae1b45ed7db1dcad3f4c8d4ffe0c371116c1` |

The engine version did not change from Work 1.1.0's final pin, but its content did: the
Lolly source moved from `3b0edf3d6` to `26cf05324`, so the packed content hashes changed.
Audiogram 2.7.5, Captions 1.0.4 and Record 1.4.3 need engine 1.261.0 or later wherever
they render, including the Work server.

### What 1.1.1 changed

- **Tool scripts and styles load from `blob:` addresses.** The web app turns verified tool
  scripts and styles into `blob:` addresses, and its `script-src` and `style-src` now allow
  `blob:`, both in `server/src/api/shell-headers.ts` and in the YunoHost
  `deploy/yunohost/conf/shell-headers.inc`. Before this change the policy refused those
  loads, so tools whose libraries load this way, such as 3D, fell back to reduced output.
- **The render worker serves HTTPS.** Set `LW_RENDER_TLS_CERT_FILE` and
  `LW_RENDER_TLS_KEY_FILE`, with optional `LW_RENDER_TLS_CA_FILE` and
  `LW_RENDER_TLS_SERVER_NAME`. The chart takes `renderWorker.tls.existingSecret`,
  `serverName` and `caSecret`, and generates no private key. The published 1.1.0 worker
  image serves plain HTTP, so it fails this chart's HTTPS probes.
- **An optional user namespace for the render worker.**
  `renderWorker.userNamespace.enabled` runs the worker with `hostUsers: false` and adds
  `CAP_SYS_ADMIN` and `CAP_SYS_CHROOT` inside that namespace only, so Chromium can sandbox
  itself under the RuntimeDefault seccomp profile on clusters where no node profile can be
  installed. It needs Kubernetes 1.33 or later, containerd 2.0 or later and kernel 6.3 or
  later, and the worker refuses to start if the pod still shares the node's user namespace.
  Off by default.
- **Connector origins in the web app's policy.** `connectorOrigins` in the instance
  configuration adds up to 32 exact HTTPS origins to the served web app's `connect-src` and
  changes nothing else. Use it where the ingress cannot replace response headers; see
  [configuration](configuration.md).
- **Enterprise sign-in.** OIDC handling is stricter, and enterprise sessions gain scoped
  provider logout with back-channel logout endpoints; see
  [enterprise identity](enterprise-identity.md).
- **Web app releases without restarting Work.** An optional release-pointer mode serves
  immutable web app folders from one volume. It is off by default, and turning it on for an
  existing instance needs a one-time reviewed rollout; see
  [IMMUTABLE-SHELL-RELEASES.md](../deploy/helm/IMMUTABLE-SHELL-RELEASES.md).
- **Deployment tooling.** Qualified web app deployment requests, resumable publication,
  bounded guard reads and validation of signed catalog resources in private cohorts.

### 1.1.1 migrations

Four SQL migrations since 1.1.0, bringing the maintained history to 60 files:

- `0067_oidc_logout.sql`
- `0068_provisioning_scope.sql`
- `0069_fleet_attribution.sql`
- `0070_service_credential_expiry.sql`

### 1.1.1 images

The release workflow built, signed and published both images from tagged source
`9fddbf2f`. The render worker came from the `v1.1.1` tag push. The server came from a
server-only run on `main` after its emulated arm64 build failed twice, so its signing
identity ends in `refs/heads/main`. The release's `release-source-images.json` records
the verified digests:

| Image | Digest | Signing identity |
|---|---|---|
| `ghcr.io/lolly-tools/lolly-work-server:1.1.1` | `sha256:5fa8b86328bf453635791fc104f4cf6179fc3d3c02a1516da4dea07bd6ae1e55` | `https://github.com/lolly-tools/lolly-work/.github/workflows/release.yml@refs/heads/main` |
| `ghcr.io/lolly-tools/lolly-work-render-worker:1.1.1` | `sha256:e15db945956db805a991e73e1c7f1d5ce59cdf0787bd93f2aee023d6fee25b6e` | `https://github.com/lolly-tools/lolly-work/.github/workflows/release.yml@refs/tags/v1.1.1` |

Both are multi-platform indexes for linux/amd64 and linux/arm64. The record does not
claim native arm64 runtime qualification.

::: details Preparing 1.1.1 and its YunoHost package
The preparation commands are the same as for 1.1.0, with `vendor/lolly` at
`26cf05324f46dc4cacd65d12d6f454ada181fb5e`:

```text
node scripts/vendor-content-resolver.ts --write
pnpm run repin-engine --apply
pnpm run verify:engine-pin
pnpm run typecheck
```

Before tagging or publishing images, the exact final Work commit needs ordinary CI,
including the native server image checks and the real Chromium worker checks with the
matched signed web app. The tagged server and worker images must come from that same
Work commit.

The `1.1.1~ynh1` package pairs Work 1.1.1 with the signed neutral Lolly web archive
`https://lolli.li/lolly-web-1.1.1-ynh1.tar.gz` (SHA-256 above). The Work archive is cut
with the maintained producer after the release notes are committed, so the archive
includes them:

```text
node scripts/yunohost-release.ts --ynh-rev 1 --shell-url https://lolli.li/lolly-web-1.1.1-ynh1.tar.gz --shell-sha256 bc78012aa407983ecc818e63be98ae1b45ed7db1dcad3f4c8d4ffe0c371116c1 --out ABS_NEW_ARTIFACT_DIRECTORY
```

Commit the generated manifest, cut again into a separate folder and require full archive
byte equality, as for 1.1.0. Runtime results are recorded after the package's
`yunohost-runtime.yml` run. [Official installation routes](official-installations.md)
records the current state of that package.
:::

## 1.1.0

The shared release is published as
[Work v1.1.0](https://github.com/lolly-tools/lolly-work/releases/tag/v1.1.0) and
[Lolly web-v1.1.0](https://github.com/lolly-tools/lolly/releases/tag/web-v1.1.0). Work's tag
is `b17800561df9a1e39cc4befce986a20fa1c7f661` and the Lolly web tag is
`0359d8106bccbd1da56b5552605199f0bf705472`. Lolly's desktop and mobile releases were held.
Its tagged [installation guide](https://github.com/lolly-tools/lolly-work/blob/v1.1.0/docs/install.md),
[deployment options](https://github.com/lolly-tools/lolly-work/blob/v1.1.0/docs/deployment.md)
and [documentation index](https://github.com/lolly-tools/lolly-work/blob/v1.1.0/docs/README.md)
describe it as released.

| Component | Version or source |
|---|---|
| Lolly desktop product version | 1.1.0, from the Tauri configuration; native release held |
| Work application | 1.1.0 |
| Published Work tag source | b17800561df9a1e39cc4befce986a20fa1c7f661 |
| Work Helm chart | 0.3.0; appVersion 1.1.0 |
| Lolly source | 0359d8106bccbd1da56b5552605199f0bf705472 |
| Qualified Work runtime source | 464ac88d4498b00985dfbcdb47dd96655425f426 |
| Engine | 1.259.0 |
| Tool-author core | 1.2.0 |

Engine and core versions describe their own contracts and are not reset to the product
version, and Lolly's private workspace package version is separate from the desktop
product version. `engine-pin.json` carries the exact Lolly origin, packed content hashes
and schema hashes; `content-resolver-pin.json` carries the same resolver origin. The
maintained producers generate both.

The Work server uses that unmodified engine and core. The Chromium worker is a separate
image, qualified with the same signed Lolly web app and catalog, and stays optional and
off by default. The release workflow published both server and worker tags as 1.1.0, and
the chart uses that application version for both default image tags and the migration
Job; production installations should select the qualified immutable digests.

### What 1.1.0 carried

The matched Lolly source includes the Design hierarchy and presentation work, responsive
editor fixes, provider-reference catalog admission, export-error propagation, complete
delivery validators, transition token bindings, the reviewed Strip Data 1.3 metadata
cleanup, and the reviewed source navigation, emoji popover and number field styling. Work
keeps its signed per-caller catalog, content coding verification, publication readiness,
governed providers, collaboration and public delivery update helpers. The shared version
records a matched application release: it does not turn on a new deployment, extra
writable collaboration owners or an anonymous private-file service.

### 1.1.0 migrations

1.1.0 adds no SQL migration. The maintained history holds 56 files, through
`0066_catalog_delivery_sequence.sql`. Keep the generation and sequence tables, and do not
reset their rows to make an old catalog look current.

### 1.1.0 images

The tagged Work source passed
[all five ordinary CI jobs](https://github.com/lolly-tools/lolly-work/actions/runs/38284012710),
including native server and real Chromium worker qualification on Linux amd64, and the
Helm and deployment checks passed.
[Release workflow attempt 2](https://github.com/lolly-tools/lolly-work/actions/runs/38289495755/attempts/2)
published and signed both multi-architecture images from the exact tag. Its workflow
source was `78e22f33dc8c3ba678133cbbfdeda6cbd771c3d6`, separate from the tagged application
source; the original failed attempts and the inherited source-artifact receipt are kept.

```text
ghcr.io/lolly-tools/lolly-work-server@sha256:db96f0d0f84b81ec609a3816031bd7f78bbb2af87d36f49a6fef8a76c8a656ae
ghcr.io/lolly-tools/lolly-work-render-worker@sha256:8dbe45a9586f426c72cb87eb121da393e18c1074ff3ea5d886a39dceefdfbd5f
```

Anonymous access to the manifests, configuration and layer metadata, and both keyless
signatures, were checked independently. The certificate issuer is
`https://token.actions.githubusercontent.com` and the identity is
`https://github.com/lolly-tools/lolly-work/.github/workflows/release.yml@refs/heads/main`.
The release's source and image record lists the platform digests. Linux amd64 and arm64
images are published; native arm64 runtime qualification is open. Both GHCR packages are
public.

::: details Preparing 1.1.0 and its rollback rules
Use clean, isolated source checkouts, and keep the existing deployment's data,
configuration, keys, pin and rollback artifacts. From the final committed Lolly source,
refresh Work with the maintained producers:

```text
node scripts/vendor-content-resolver.ts --write
pnpm run repin-engine --apply
pnpm run verify:engine-pin
pnpm run typecheck
```

The committed `vendor/lolly` checkout must be the exact release source. Re-pinning packs
its actual engine, core and schema bytes, updates the lockfile and runs its coherence and
local test gates. Do not edit the resulting hashes or patch the bundled source, and do not
count a skipped local test as qualifying the skipped part.

Before a version tag or image publication, require ordinary CI on the exact final Work
commit and the exact Lolly source, including the native server image checks and the real
Chromium worker checks with the matched signed web app: real SVG and PNG rendering,
cancellation and egress controls. Keep the original workflow, source, archive, image and
pin receipts. The tagged server and worker must come from that same Work commit. Neither
an older qualified set nor a metadata-only rehearsal admits these images.

Generic installers stay supported for their own targets. Existing production instances
follow their current deployment handoff and guarded cohort publication route: keep the
immutable pin, pack, web app and configuration identities and full owner and storage
guards, and require real runtime acceptance before switching. Never mount an active asset
volume into a staging pod.

Before upgrading, check the actual migration history with `pnpm run migrate:status`, take
a fresh verified backup and complete an independent restore, then apply the maintained
migration runner or the reviewed chart migration Job against the selected instance only.
Keep the previously accepted server and worker digests, web app and pack roots, public key
pin, configuration generation, owning Deployment specification and recovery receipts. If a
new cohort fails acceptance, use its reviewed inverse application patch, which still needs
runtime observation. Do not delete active or rollback volumes or automatically undo
database changes; restoring a database is a separately reviewed recovery operation. The
replica and room-routing limits, permissions and instance credentials are unchanged.
:::

::: details The 1.1.0 YunoHost beta package
`1.1.0~ynh3` was the beta test candidate for the engine 1.259 cohort. It paired Work
runtime source `464ac88d4498b00985dfbcdb47dd96655425f426` with the signed neutral Lolly
build of source `0359d8106bccbd1da56b5552605199f0bf705472`.

- **Web archive:** `https://lolli.li/lolly-web-1.1.0-ynh3.tar.gz`, SHA-256
  `8bc8121a68e6fee6dda3902ed48d5e2669353bcfd101ca3822990235a2099376`, built with models
  base `https://lolli.li` and no model bodies. Its archive bytes, file hashes, signed P-256
  catalog and decoded gzip copies passed local checks, and its published HTTPS bytes were
  verified. These checks establish the file, not a YunoHost installation.
- **Work archive:** [lolly-work-1.1.0-ynh3.tar.gz](https://lolli.li/lolly-work-1.1.0-ynh3.tar.gz),
  11,889,092 bytes, SHA-256
  `e7b70e269b261bfed4bc5f7c6dce69eec84885ce2b0bf9335143a1cc3ff2efbb`, cut from clean
  packaging source `9ba7104377f6aa3102053fb26e407fa67463d336` with the maintained producer.
  That source adds release documentation and excluded deployment metadata to the
  qualified runtime source; the installed server, engine, console, lockfile and other
  runtime files are unchanged.

```text
node scripts/yunohost-release.ts --ynh-rev 3 --shell-url https://lolli.li/lolly-web-1.1.0-ynh3.tar.gz --shell-sha256 8bc8121a68e6fee6dda3902ed48d5e2669353bcfd101ca3822990235a2099376 --out ABS_NEW_ARTIFACT_DIRECTORY
```

The producer reads the held Git tree with a fixed UTC timestamp one second after the
epoch, canonical file permissions and deterministic gzip. Each packaging revision uses a
distinct archive name, and an existing output is refused. The archive's companion `.source.json`
records the commit, tree, archive size, full checksum and web app pin; it does not claim
runtime compatibility. Reproducing those archive bytes needs the original packaging
source. A new cut needs a new revision and file name: never replace the published `ynh3`
archives or edit their pins by hand.

After both archives were published and the package folder mirrored,
`.github/workflows/yunohost-runtime.yml` ran with the reviewed full 40-character mirror
commit and exact version `1.1.0~ynh3`, as the
[package README](../deploy/yunohost/README.md) documents. It uses a fresh Ubuntu runner
and the official Incus checker on amd64 Debian Bookworm, and requires root and
multiple-instance installation, upgrade, backup and restore, and URL-change results. The
package also tests upgrading from mirror commit
`db60f651fbeb561e4b330a1dd44bd4aaf463e635` (`0.2.0~ynh1`).

The [runtime run](https://github.com/lolly-tools/lolly-work/actions/runs/38284099878) used
mirror commit `583cdc4af5322e683991a548428859b79084db2d` on amd64 Debian Bookworm with
YunoHost 12.1.41.2. Six checks on the current package passed: root installation and
reinstall, multiple instances, backup and restore, same-version upgrade, URL change and
package lint. The full seven-check run failed while preparing the historical
`0.2.0~ynh1` baseline, whose unsupported `full_domain` field stopped installation before
the upgrade began. The historical web app address also advertises checksum metadata that
differs from its old manifest, and those old bytes were not qualified again. Upgrading
from 0.2 and arm64 installation stay unqualified, there was no stable YunoHost tag or
catalogue promotion, and the earlier `ynh1` and `ynh2` pins are historical.

For a fresh beta install of that revision:

```bash
sudo yunohost app install https://github.com/lolly-tools/lolly-work_ynh/tree/583cdc4af5322e683991a548428859b79084db2d
```

Keep a verified backup and complete an independent restore before upgrading an existing
instance. The six passing checks do not qualify the historical upgrade path or every
deployment platform.
:::
