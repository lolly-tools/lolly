# Official Lolly Work installations

Use packages maintained by the [Lolly project](https://github.com/lolly-tools).
Lolly Work is free open-source software under MPL-2.0. The project receives no
hosting commission or usage payment. You provide and manage hosting, domains,
identity and backups. Forks may redistribute Lolly; the source links and release
signatures identify the upstream packages.

| Route | Upstream source | Current boundary |
|---|---|---|
| Server and optional worker | Public `ghcr.io/lolly-tools/lolly-work-server` and `lolly-work-render-worker` | Signed 1.1.1 images are published for amd64/arm64. Native runtime qualification is amd64; arm64 remains open |
| Helm and Rancher | [Work chart](https://github.com/lolly-tools/lolly-work/tree/main/deploy/helm) | Chart 0.3.2 and HTTP publication workflow are prepared. The repository URL becomes live after its first successful publication; Artifact Hub registration/badges remain pending |
| Neutral VM / private server | [Shared distribution package](https://github.com/lolly-tools/lolly-work/tree/main/deploy/marketplaces) | Pinned 1.1.1 server, complete matched neutral shell and PostgreSQL. Fresh provider acceptance must be recorded for each target |
| UpCloud | [Infrastructure module](https://github.com/lolly-tools/lolly-work/tree/main/deploy/upcloud) plus the neutral VM package | [Ubuntu 24.04 amd64 reference](https://github.com/lolly-tools/lolly-work/blob/main/deploy/marketplaces/QUALIFICATION.md): fresh install, public HTTPS, native owner/member sign-in, checked SVG, reboot and independent application restore passed. Cross-version upgrade and second-host recovery remain open; module checks are separate |
| Evroc | [Infrastructure module](https://github.com/lolly-tools/lolly-work/tree/main/deploy/evroc) | Separate European foundation; boot/runtime acceptance remains target-specific |
| YunoHost | [Project package](https://github.com/lolly-tools/lolly-work_ynh/tree/v1.1.1-ynh1) | 1.1.1~ynh1 beta. All seven package checks passed on amd64 Bookworm, but absence from the catalogue makes the overall workflow fail. Catalogue registration and arm64 acceptance remain pending |
| Dokploy | [Upstream blueprint](https://github.com/lolly-tools/lolly-work/tree/main/deploy/dokploy) | Prepared for online import/submission; runtime target acceptance and public catalogue admission remain pending |

The intended HTTP chart repository is
`https://github.com/lolly-tools/lolly-work/releases/download/helm-index`.
Its immutable packages use separate `chart-v*` releases and Sigstore bundles.
Before using it, confirm `index.yaml` is public and lists the reviewed chart.
Adding this repository to Rancher is separate from inclusion in a built-in
catalogue. Artifact Hub's Verified publisher and Official labels are claimed
only once actually granted.

Follow [Installing, section 10](install.md#10-official-neutral-package) for the
neutral VM/UpCloud and Dokploy paths, and [section 7](install.md#7-kubernetes-helm)
for Helm. [Deployment shapes](deployment.md) explains capacity and platform
choices; [enterprise identity](enterprise-identity.md) covers provider setup.

## Release verification

The [Work 1.1.1 release](https://github.com/lolly-tools/lolly-work/releases/tag/v1.1.1)
publishes image/source/signature receipts. The neutral package reuses that release
and its checksum-verified signed Lolly web archive. It downloads the archive from
`lolli.li` on first installation and fetches models from the same origin on use.
This package therefore needs network access; disconnected installation requires
separately prepared and verified mirrors/content.

Work stores accounts, projects, uploaded content and its audit history in the
operator's PostgreSQL database. The neutral package defaults to built-in
email/password sign-in with a private, host-issued first-owner link; an external
OIDC provider is optional. Native password hashes also stay in PostgreSQL. The
operator controls backups and any later enabled connectors. Initial package
telemetry is off. Loading a model contacts `lolli.li`; it does not make that origin
the storage location for Work projects.

Verify container images by digest with `cosign verify`, using issuer
`https://token.actions.githubusercontent.com` and the exact identity in the
release's `release-source-images.json`. Server 1.1.1 uses
`https://github.com/lolly-tools/lolly-work/.github/workflows/release.yml@refs/heads/main`;
its worker uses the same path at `refs/tags/v1.1.1`. A successful build or multiarch
manifest does not establish runtime qualification on every device.

After chart publication, download its `.tgz`, `SHA256SUMS`,
`chart-release.json` and `.tgz.sigstore.json` from the exact chart release. Check
the sums, then verify the archive with `cosign verify-blob`, its bundle, the same
OIDC issuer and identity
`https://github.com/lolly-tools/lolly-work/.github/workflows/publish-helm.yml@refs/heads/main`.
The source record identifies the exact chart commit; chart and application versions
are independent.

## Operation and support

One Work process owns collaboration. Kubernetes capacity, a redundant database or
a marketplace listing does not add application high availability. The default
package has no Chromium worker; only the formats actually available to the
configured instance should be advertised.

Keep the instance environment and signing keys stable, preserve PostgreSQL data,
and verify an independent restore before an upgrade. Follow [operations](operations.md)
and retain the prior server/content/configuration tuple. Migration recovery may
need a restored database or forward repair. An image downgrade alone is not a
recovery procedure.

Support is through [upstream issues](https://github.com/lolly-tools/lolly-work/issues),
with best-effort community maintenance. Use the repository's `SECURITY.md` route
for vulnerabilities. Provider certification applies only to its qualified offering;
a listing does not certify Lolly for regulated workloads. No support contract or
certification is included with these packages.

The [distribution maintainer guide](https://github.com/lolly-tools/lolly-work/blob/main/deploy/marketplaces/README.md)
records publication, account custody and update requirements. Prepared channels
stay labelled pending until their actual publication and acceptance receipts exist.
