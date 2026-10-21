# Lolly and Work 1.1.1

Work 1.1.1 pairs the Work server and render worker with
[Lolly 1.1.1](https://github.com/lolly-tools/lolly/releases/tag/v1.1.1), built from
Lolly source `26cf05324f46dc4cacd65d12d6f454ada181fb5e`. It is published as
[Work v1.1.1](https://github.com/lolly-tools/lolly-work/releases/tag/v1.1.1).
Installation and production acceptance are tracked separately.

Start with the tagged [installation guide](https://github.com/lolly-tools/lolly-work/blob/v1.1.1/docs/install.md),
[deployment options](https://github.com/lolly-tools/lolly-work/blob/v1.1.1/docs/deployment.md)
and [documentation index](https://github.com/lolly-tools/lolly-work/blob/v1.1.1/docs/README.md).

## Matching components

| Component | Version or source |
|---|---|
| Lolly product version | 1.1.1 |
| Work application | 1.1.1 |
| Work Helm chart | 0.3.1; appVersion 1.1.1 |
| Lolly source | 26cf05324f46dc4cacd65d12d6f454ada181fb5e |
| Engine | 1.261.0 |
| Tool-author core | 1.4.0 |
| Lolly web archive for YunoHost | `lolly-web-1.1.1-ynh1.tar.gz`, SHA-256 `bc78012aa407983ecc818e63be98ae1b45ed7db1dcad3f4c8d4ffe0c371116c1` |

Engine and core versions describe their own contracts and are not reset to the
product version. `engine-pin.json` and `content-resolver-pin.json` record the
Lolly source above. The maintained producers generated both.

The engine version is unchanged from Work 1.1.0's final pin, but its content is
not: the Lolly source moved from `3b0edf3d6` to `26cf05324`, so the packed content
hashes changed. Audiogram 2.7.5, Captions 1.0.4 and Record 1.4.3 need engine 1.261.0
or later wherever they render, including the Work server.

## Changes since 1.1.0

- **Tool scripts and styles load from `blob:` URLs.** The shell turns verified tool
  scripts and styles into `blob:` URLs. The shell's `script-src` and `style-src` now
  allow `blob:`, in both `server/src/api/shell-headers.ts` and the YunoHost
  `deploy/yunohost/conf/shell-headers.inc`. Before this change the
  shell policy refused those loads, so tools whose libraries load this way, such as
  SUSECON Background and 3D, fell back to their reduced output.
- **The render worker serves HTTPS.** Set `LW_RENDER_TLS_CERT_FILE` and
  `LW_RENDER_TLS_KEY_FILE`, with optional `LW_RENDER_TLS_CA_FILE` and
  `LW_RENDER_TLS_SERVER_NAME`. The chart takes `renderWorker.tls.existingSecret`,
  `serverName` and `caSecret`, and generates no private key. The published 1.1.0
  worker image serves plain HTTP, so it fails this chart's HTTPS probes.
- **Optional render worker user namespace.** `renderWorker.userNamespace.enabled`
  runs the worker with `hostUsers: false` and adds `CAP_SYS_ADMIN` and
  `CAP_SYS_CHROOT` inside that namespace only. Chromium can then sandbox itself
  under the RuntimeDefault seccomp profile on clusters where no node profile can
  be installed. It needs Kubernetes 1.33+, containerd 2.0+ and kernel 6.3+. The
  worker refuses to start if the pod still shares the node's user namespace. Off
  by default.
- **Connector origins in the shell policy.** `connectorOrigins` in the instance
  configuration adds up to 32 exact HTTPS origins to the served shell's
  `connect-src` and changes nothing else. Use it where the ingress cannot replace
  response headers. See [configuration](configuration.md).
- **Enterprise sign-in.** OIDC handling is stricter, and enterprise sessions gain
  scoped provider logout with back-channel logout endpoints. See
  [enterprise identity](enterprise-identity.md).
- **Frontend releases without restarting Work.** An optional release-pointer mode
  serves immutable shell directories from one volume. It is off by default, and
  activating it on an existing instance needs a one-time reviewed rollout. See
  [IMMUTABLE-SHELL-RELEASES.md](../deploy/helm/IMMUTABLE-SHELL-RELEASES.md).
- **Deployment tooling.** Qualified shell deployment requests, resumable
  publication, bounded guard reads and validation of signed catalog resources in
  private cohorts.

## Migrations

This release adds four SQL migrations since 1.1.0:

- `0067_oidc_logout.sql`
- `0068_provisioning_scope.sql`
- `0069_fleet_attribution.sql`
- `0070_service_credential_expiry.sql`

The maintained history now has 60 files. Before upgrading, check the database
with `pnpm run migrate:status`, take a fresh verified backup and complete an
independent restore. Then apply the maintained migration runner or the chart's
migration Job, against the selected instance only.

## Prepare and qualify

The commands are the same as for 1.1.0, with `vendor/lolly` at
`26cf05324f46dc4cacd65d12d6f454ada181fb5e`:

```text
node scripts/vendor-content-resolver.ts --write
pnpm run repin-engine --apply
pnpm run verify:engine-pin
pnpm run typecheck
```

Before tagging or publishing images, the exact final Work commit needs ordinary
CI, including the native server image checks and the real Chromium worker checks
with the matched signed shell. The tagged server and worker images must come from
that same Work commit.

## YunoHost packaging

The `1.1.1~ynh1` package pairs Work 1.1.1 with the signed neutral Lolly web archive
`https://lolli.li/lolly-web-1.1.1-ynh1.tar.gz` (SHA-256 above). The Work archive is cut
with the maintained producer after this document is committed, so the archive
includes it:

```text
node scripts/yunohost-release.ts --ynh-rev 1 --shell-url https://lolli.li/lolly-web-1.1.1-ynh1.tar.gz --shell-sha256 bc78012aa407983ecc818e63be98ae1b45ed7db1dcad3f4c8d4ffe0c371116c1 --out ABS_NEW_ARTIFACT_DIRECTORY
```

Commit the generated manifest, recut into a separate directory and require full
archive byte equality, as for 1.1.0. Runtime results for this package are recorded
after its `yunohost-runtime.yml` run. Until then it is not qualified.

## Images and qualification

The release workflow builds, signs and publishes the server and render-worker
images from the `v1.1.1` tag. The verified digests are recorded here after
publication.
