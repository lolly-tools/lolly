# Official installation routes

These are the packages the [Lolly project](https://github.com/lolly-tools) maintains
upstream, with what each one has passed so far. Use this page to check a route before
you rely on it, to verify what you downloaded, and to mirror every download for a
restricted network. To choose a route, start at [Run Lolly Work](self-host.md).

Lolly Work is free open-source software under MPL-2.0. The project takes no hosting
commission or usage payment. You provide and run the hosting, domains, identity and
backups. Forks may redistribute Lolly; the source links and release signatures
identify the upstream packages.

## What each route has passed

| Route | Upstream source | Current state |
|---|---|---|
| Server and optional worker | Public `ghcr.io/lolly-tools/lolly-work-server` and `lolly-work-render-worker` | Signed 1.1.2 images (current) and 1.1.1 images are published for amd64 and arm64. The ready-made package's 1.1.1 server passes container qualification in CI on amd64 and arm64. The render worker's arm64 image has no runtime qualification |
| Helm and Rancher | [Work chart](https://github.com/lolly-tools/lolly-work/tree/main/deploy/helm) | Chart 0.3.3 and its HTTP publication workflow are prepared. The repository address goes live after its first successful publication; Artifact Hub registration and badges are pending |
| Ready-made package (VM or private server) | [Shared distribution package](https://github.com/lolly-tools/lolly-work/tree/main/deploy/marketplaces) | Pins the 1.1.1 server, the complete matching neutral web app and PostgreSQL. Record a fresh acceptance for each target. Browser use is not qualified: the 1.1.1 web app refuses the catalogue the installation signs for each person, so it shows no tools ([details](ready-made-package.md)) |
| UpCloud | [Infrastructure module](https://github.com/lolly-tools/lolly-work/tree/main/deploy/upcloud) plus the ready-made package | [Ubuntu 24.04 amd64 reference](https://github.com/lolly-tools/lolly-work/blob/main/deploy/marketplaces/QUALIFICATION.md): fresh install, public HTTPS, built-in owner and member sign-in, a checked SVG, reboot and an independent application restore passed. An upgrade across versions and recovery on a second host are open; the module's own checks are separate |
| Evroc | [Infrastructure module](https://github.com/lolly-tools/lolly-work/tree/main/deploy/evroc) | A separate European foundation; boot and runtime acceptance stay specific to each target |
| YunoHost | [Project package](https://github.com/lolly-tools/lolly-work_ynh/tree/v1.1.1-ynh1) | 1.1.1~ynh1 beta. All seven package checks passed on amd64 Bookworm, but the overall run fails because the package is not in YunoHost's catalogue. Catalogue registration and arm64 acceptance are pending. The 1.1.2~ynh1 package and its Work archive are published with the v1.1.2 release, but not yet mirrored to `lolly-work_ynh` or run through package_check |
| Dokploy | [Upstream blueprint](https://github.com/lolly-tools/lolly-work/tree/main/deploy/dokploy) | Ready for online import and submission; runtime acceptance on a target and admission to the public catalogue are pending |

The [channel record](https://github.com/lolly-tools/lolly-work/blob/main/deploy/marketplaces/CHANNELS.md)
shows which release each channel carries and how its latest publication attempt went.
A failed or pending attempt never replaces a channel's last published version. The
[distribution maintainer guide](https://github.com/lolly-tools/lolly-work/blob/main/deploy/marketplaces/README.md)
records publication, account custody and update requirements; prepared channels stay
marked pending until real publication and acceptance receipts exist.

**The Helm chart repository** will live at
`https://github.com/lolly-tools/lolly-work/releases/download/helm-index`. Its
immutable packages use separate `chart-v*` releases with Sigstore bundles. Before you
use it, confirm that `index.yaml` is public and lists the reviewed chart. Adding the
repository to Rancher is separate from inclusion in a built-in catalogue, and Artifact
Hub's Verified publisher and Official labels are claimed only once actually granted.
[Install on Kubernetes](platform-deployment.md#install-from-the-chart-repository-or-rancher)
has the commands.

### YunoHost package checks

The package is built in `deploy/yunohost/` and mirrored at release time.
`scripts/yunohost-release.ts` generates the release source addresses and checksums;
do not edit them by hand. Repository tests cover rendered configuration, sign-in and
role mapping, the web app's headers, script syntax and package contracts.

Before claiming a qualified YunoHost release:

1. Run the official [package linter](https://github.com/YunoHost/package_linter) for
   static packaging checks.
2. Run [package_check](https://github.com/YunoHost/package_check) on a throwaway Linux
   host with Incus or LXD. That run covers real installation, several instances,
   upgrade, backup and restore, and URL changes, which the repository tests do not.
3. Keep the real test logs and archive checksums.

The repository workflow blocks static code errors and reports catalogue registration
and working-state metadata separately. Those publication checks stay pending until the
mirrored package is registered and qualified.

## Release verification

Each Work release publishes receipts for its images, source and signatures: the current
[Work 1.1.2 release](https://github.com/lolly-tools/lolly-work/releases/tag/v1.1.2)
and the previous [Work 1.1.1 release](https://github.com/lolly-tools/lolly-work/releases/tag/v1.1.1).
The ready-made package reuses the 1.1.1 release and its checksum-verified, signed Lolly
web archive. It downloads that archive from `lolli.li` on first installation and fetches
models from the same place when someone uses them, so it needs network access;
[external services and mirrors](#external-services-and-mirrors) shows how to replace
each source with your own copy.

**Container images.** Verify by digest with `cosign verify`, using the issuer
`https://token.actions.githubusercontent.com` and the exact identity in the release's
`release-source-images.json`:

| Release | Image | Signing identity |
|---|---|---|
| 1.1.2 | server and worker | `https://github.com/lolly-tools/lolly-work/.github/workflows/release.yml@refs/tags/v1.1.2` |
| 1.1.1 | server | the same workflow at `refs/heads/main` |
| 1.1.1 | worker | the same workflow at `refs/tags/v1.1.1` |

A successful build or multi-architecture manifest does not make every device
qualified.

**The Helm chart**, once published: download its `.tgz`, `SHA256SUMS`,
`chart-release.json` and `.tgz.sigstore.json` from the exact chart release. Check the
sums, then verify the archive with `cosign verify-blob`, its bundle, the same OIDC issuer
and the identity
`https://github.com/lolly-tools/lolly-work/.github/workflows/publish-helm.yml@refs/heads/main`.
The source record gives the exact chart commit; chart and application versions are
independent.

**Where your data lives.** Work keeps accounts, projects, uploaded content, password
hashes and its audit history in your PostgreSQL database, and the ready-made package
starts with telemetry off. Loading a model contacts `lolli.li`, but that is not where
Work stores projects. [Server surface](/info/trust/server-surface.html) lists what each
server receives and keeps.

## External services and mirrors

The official packages download from the public services below. The general
requirements for an offline deployment are in
[deployment, air-gap](deployment.md#air-gap).

| Source | Used for | When it is contacted | Your own copy |
|---|---|---|---|
| `ghcr.io/lolly-tools` | The Work server image for the ready-made package (including UpCloud), Dokploy and Helm; the optional render worker image. YunoHost uses the `lolli.li` Work archive instead | Image pull at installation and update. Kubernetes also pulls on any node without the image | Copy each multi-platform image by digest into your registry |
| `docker.io/library` (Docker Hub) | PostgreSQL 17 and Caddy images in the ready-made package; PostgreSQL in the Dokploy blueprint | Image pull at installation and update | Copy by digest. The same digests are also at `public.ecr.aws/docker/library/postgres` and `public.ecr.aws/docker/library/caddy` |
| `lolli.li`, release archives | The matching neutral web app archive (ready-made package, Dokploy, YunoHost); the YunoHost Work archive | First start of each release; restarts reuse the extracted content | Serve the checksum-verified archive from your own HTTPS server and set `LW_SHELL_URL` |
| `lolli.li`, model files | On-device model files the web app fetches in the browser | In each person's browser, the first time they use a model feature | No mirror setting: the address is built into the 1.1.1 web app archive. See [model files](#model-files) |
| Public ACME certificate authorities | Caddy's automatic HTTPS in the ready-made package; Dokploy's proxy; cert-manager when you configure it | At first start and before every renewal. The authority must also reach the host on TCP 80 or 443 | An internal ACME server or a certificate you supply; see [certificates](#certificates-without-public-acme) |
| Your OIDC provider, when used | Single sign-on with `LOLLY_AUTH_MODE=oidc` | Every sign-in, from the server and the browser | A provider inside your network, or built-in email and password sign-in |
| GitHub and the npm registry | Source checkout and `pnpm install` for `prepare-marketplace-instance.ts`; chart releases; the YunoHost server install | Once per preparation, on the machine that writes the installation folder. YunoHost uses them on the host itself | Prepare on a connected workstation and copy the folder to the host |
| Optional browser services | Font picker, cloud-storage connectors, media embeds and a few public data sources the web app's browser policy allows | Only when someone uses that feature | None; the feature does not work without access. The list is in [`shell-headers.ts`](https://github.com/lolly-tools/lolly-work/blob/main/server/src/api/shell-headers.ts) |

Beyond this list, the server connects out only for features an operator turns on, such
as catalogue sources, delivery destinations and AI providers. Pages in the optional
render worker may also reach public addresses that a tool requests. Telemetry is off in
the ready-made package.

**Rate limits on public registries.** Docker Hub, GHCR and ECR Public each limit
anonymous pulls, and ECR Public also limits how much one address can download. Shared
NAT addresses, CI runners and repeated reinstalls reach these limits first. Signing in to
a registry raises its limits; a mirror removes the repeated pulls. For PostgreSQL and
Caddy, pulling by digest returns the same bytes from Docker Hub or ECR Public.

::: details Mirror the ready-made package
Steps 1 to 3 run on a connected machine; the rest run in the installation folder. Take
the placeholder values from that folder's `release.json`: `SERVER_DIGEST` is the digest
in `serverImage`, and likewise for `postgresImage`, `caddyImage` and, when you turn the
worker on, `workerImage`. `SHELL_URL` and `SHELL_SHA256` are `shell.url` and
`shell.sha256`.

1. Verify the server and worker image signatures as in
   [release verification](#release-verification).
2. Copy each image with its whole multi-platform index, so the pinned digest stays
   valid, then check the digest your registry reports. For example, with skopeo:

   ```bash
   skopeo copy --all --preserve-digests \
     docker://ghcr.io/lolly-tools/lolly-work-server@sha256:SERVER_DIGEST \
     docker://registry.example.com/lolly/lolly-work-server:1.1.1
   skopeo inspect --raw docker://registry.example.com/lolly/lolly-work-server:1.1.1 \
     | sha256sum
   ```

   The printed hash must equal `SERVER_DIGEST`. Repeat for PostgreSQL, Caddy and the
   worker. A `docker pull` followed by `docker push` can keep only one platform and
   change the digest. If no connected machine can reach your registry, carry the images
   across as an OCI layout folder written and read with the same skopeo flags, then
   repeat the digest check inside.
3. Download the web app archive and check it:

   ```bash
   curl --fail --output shell.tar.gz SHELL_URL
   echo "SHELL_SHA256  shell.tar.gz" | sha256sum --check
   ```

   Serve it from an HTTPS server in your network, at an address that returns the file
   directly, with one path per release. Setup refuses plain HTTP and redirects.
4. In the installation folder, add `compose.override.yaml` beside `compose.yaml`. The
   package's Compose commands read it automatically:

   ```yaml
   services:
     content:
       image: registry.example.com/lolly/lolly-work-server@sha256:SERVER_DIGEST
       environment:
         LW_SHELL_URL: https://mirror.example.com/lolly/1.1.1/shell.tar.gz
     server:
       image: registry.example.com/lolly/lolly-work-server@sha256:SERVER_DIGEST
     db:
       image: registry.example.com/lolly/postgres@sha256:POSTGRES_DIGEST
     caddy:
       image: registry.example.com/lolly/caddy@sha256:CADDY_DIGEST
   ```

   Keep `LW_SHELL_SHA256` unchanged: setup still checks the mirrored archive against
   the release checksum and refuses any other file. If the mirror's certificate comes
   from a private certificate authority, give the `content` service that authority's
   root certificate: add `NODE_EXTRA_CA_CERTS: /etc/lolly/mirror-ca.pem` to its
   `environment` and `./mirror-ca.pem:/etc/lolly/mirror-ca.pem:ro,Z` to its `volumes`
   in the same file.
5. Run `docker compose --project-name lolly-work config --images` and confirm it lists
   only your registry. Then continue with the
   [ready-made package](ready-made-package.md#start-the-instance).
6. Test with outbound access blocked, except for your mirror, certificate authority and
   identity provider: first start, restart, owner and member sign-in, a saved project
   and a checked output. Record the results with the release digests. A mirror alone
   does not qualify an installation.

For each update, mirror the new release's images and archive first. Change the
override's digests and address in the same step as the new `compose.yaml` and
`release.json`: an override left at the old digests keeps running the old release. Keep
the previous release's mirrored images and archive until you no longer need them for
[recovery](operations.md#backup-and-restore).
:::

::: details Certificates without public ACME
Caddy in the ready-made package asks a public ACME certificate authority, such as
Let's Encrypt, for its certificate. The host name must resolve to the host from the
internet, and the authority must reach it on TCP 80 or 443 at first start and again
before each renewal. A host that loses that access stops renewing, and browsers reject
it once the certificate expires.

To use an internal ACME server instead, add
`./acme-root.pem:/etc/caddy/acme-root.pem:ro,Z` to the `caddy` service's `volumes` in
`compose.override.yaml`, so Caddy trusts that server's root certificate. Then edit the
installation's `Caddyfile`:

```text
{$LOLLY_DOMAIN} {
  tls {
    ca https://acme.example.com/acme/directory
    ca_root /etc/caddy/acme-root.pem
  }
  reverse_proxy server:8787
}
```

To supply your own certificate, mount a folder such as `./certs:/etc/caddy/certs:ro,Z`
the same way and put `tls /etc/caddy/certs/fullchain.pem /etc/caddy/certs/key.pem` in
place of the `tls` block. Caddy does not renew a certificate you supply: replace the
files before they expire and run
`docker compose --project-name lolly-work restart caddy`. With an internal authority,
every person's device must trust its root. An update must keep the edited `Caddyfile`
when you compare the new package files.

On Kubernetes, set `ingress.tls` to a Secret you manage, or point cert-manager at an
internal issuer. Dokploy's proxy has its own certificate settings.
:::

::: details Mirrors for Helm, Dokploy and YunoHost
- **Helm.** Set `image.repository` and `image.digest` to your registry, keeping the
  digests from
  [`values-official-release.yaml`](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/values-official-release.yaml),
  and do the same for `renderWorker.image` when the worker is on. Add
  `imagePullSecrets` if the registry needs credentials. Copy the verified chart package
  into your own chart repository; until the first publication, package the reviewed
  `deploy/helm` source instead. The chart downloads no web app and includes no
  database: supply PostgreSQL from your registry, and the verified web app through the
  chart's web app volume or `shell.image`. Kubernetes pulls on any node that lacks an
  image, so keep the registry available while the cluster runs. If admission control
  checks image signatures, copy the signatures too and test that check against your
  registry before relying on that check.
- **Dokploy.** The blueprint uses the same server image, PostgreSQL image and archive
  address, so make the same replacements in its Compose editor. Dokploy's own
  installation and proxy have their own download sources.
- **YunoHost.** The package downloads both archives from `lolli.li`, installs the
  server's dependencies from the npm registry and gets Node.js through YunoHost. It has
  no mirror route, so treat it as an online installation.
:::

### Model files

The 1.1.1 web app archive was built to fetch model files from `https://lolli.li`. On a
network that cannot reach it, features that need those files do not work, and mirroring
the archive does not change that, because the model address is set when the web app is
built.

A fully disconnected installation needs a web app built with its own model address
(`VITE_MODELS_BASE`, see Lolly's
[delivery guide](https://github.com/lolly-tools/lolly/blob/main/docs/deploy-delivery.md))
and the model files on that host. An empty base serves them from the instance's own
address; a separate model host must also be allowed by the browser policy. Such a web
app is a different release, with its own checksum, catalogue key pins and acceptance.
The project does not publish or qualify such a bundle yet.

A web app built with an empty base asks the instance for `/models/...`. Work 1.1.2
answers from the web app folder when the files are there, and otherwise passes the
request to `instance.modelOrigin` (default `https://lolli.li`, see
[configuration](configuration.md)). The browser then talks only to the instance, and
the Work server talks to the model host. Set `modelOrigin` to `null` when the web app
carries its own models or the installation offers none.

## Operation and support

The packages share the single collaboration owner every Work deployment has; more
Kubernetes capacity, a redundant database or a marketplace listing does not add
application high availability ([why](deployment.md#one-process-owns-live-collaboration)).
The default package has no Chromium worker, so advertise only the formats the configured
instance can actually make.

Keep the instance environment and signing keys stable, keep the PostgreSQL data, and
check an independent restore before an upgrade. Follow
[keep Lolly Work running](operations.md) and keep the previous server, content and
configuration together. Recovering from a migration may need a restored database or a
forward repair; an image downgrade alone is not a recovery procedure.

Support is through [upstream issues](https://github.com/lolly-tools/lolly-work/issues),
with best-effort community maintenance. Report vulnerabilities through the
repository's `SECURITY.md` route. A provider's certification applies only to its own
qualified offering, and a listing does not certify Lolly for regulated workloads. These
packages come with no support contract or certification.
