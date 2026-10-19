# Official Lolly Work installations

Use packages maintained by the [Lolly project](https://github.com/lolly-tools).
Lolly Work is free open-source software under MPL-2.0. The project receives no
hosting commission or usage payment. You provide and manage hosting, domains,
identity and backups. Forks may redistribute Lolly; the source links and release
signatures identify the upstream packages.

| Route | Upstream source | Current boundary |
|---|---|---|
| Server and optional worker | Public `ghcr.io/lolly-tools/lolly-work-server` and `lolly-work-render-worker` | Signed 1.1.1 images are published for amd64/arm64. The neutral package's server passes native container qualification on amd64 and arm64 in CI. The render worker's arm64 image has no runtime qualification |
| Helm and Rancher | [Work chart](https://github.com/lolly-tools/lolly-work/tree/main/deploy/helm) | Chart 0.3.2 and HTTP publication workflow are prepared. The repository URL becomes live after its first successful publication; Artifact Hub registration/badges remain pending |
| Neutral VM / private server | [Shared distribution package](https://github.com/lolly-tools/lolly-work/tree/main/deploy/marketplaces) | Pinned 1.1.1 server, complete matched neutral shell and PostgreSQL. Fresh provider acceptance must be recorded for each target |
| UpCloud | [Infrastructure module](https://github.com/lolly-tools/lolly-work/tree/main/deploy/upcloud) plus the neutral VM package | [Ubuntu 24.04 amd64 reference](https://github.com/lolly-tools/lolly-work/blob/main/deploy/marketplaces/QUALIFICATION.md): fresh install, public HTTPS, native owner/member sign-in, checked SVG, reboot and independent application restore passed. Cross-version upgrade and second-host recovery remain open; module checks are separate |
| Evroc | [Infrastructure module](https://github.com/lolly-tools/lolly-work/tree/main/deploy/evroc) | Separate European foundation; boot/runtime acceptance remains target-specific |
| YunoHost | [Project package](https://github.com/lolly-tools/lolly-work_ynh/tree/v1.1.1-ynh1) | 1.1.1~ynh1 beta. All seven package checks passed on amd64 Bookworm, but absence from the catalogue makes the overall workflow fail. Catalogue registration and arm64 acceptance remain pending |
| Dokploy | [Upstream blueprint](https://github.com/lolly-tools/lolly-work/tree/main/deploy/dokploy) | Prepared for online import/submission; runtime target acceptance and public catalogue admission remain pending |

The [channel record](https://github.com/lolly-tools/lolly-work/blob/main/deploy/marketplaces/CHANNELS.md)
shows which release each channel carries and the result of its latest publication
attempt. A failed or pending attempt never replaces a channel's last published version.

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
This package therefore needs network access. [External services and
mirrors](#external-services-and-mirrors) lists each source it uses and how to
replace it with your own copy.

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

## External services and mirrors

The official packages download from the public services below. The general
requirements for an offline deployment are in [deployment,
air-gap](deployment.md#air-gap).

| Source | Used for | When it is contacted | Your own copy |
|---|---|---|---|
| `ghcr.io/lolly-tools` | Work server image for the neutral VM package (including UpCloud), Dokploy and Helm; optional render worker image. YunoHost uses the `lolli.li` Work archive instead | Image pull at installation and update. Kubernetes also pulls on any node that does not have the image yet | Copy each multi-platform image by digest into your registry |
| `public.ecr.aws/docker/library` | PostgreSQL 17 and Caddy images in the neutral VM package; PostgreSQL in the Dokploy blueprint | Image pull at installation and update | Copy by digest. The same digests are also published at `docker.io/library/postgres` and `docker.io/library/caddy` |
| `lolli.li`, release archives | Matched neutral web shell archive (VM, Dokploy, YunoHost); the YunoHost Work archive | First start of each release. Restarts reuse the extracted content | Serve the checksum-verified archive from your own HTTPS server and set `LW_SHELL_URL` |
| `lolli.li`, model files | On-device model files that the shell fetches in the browser | In each person's browser, on first use of a model feature | No mirror setting: the location is built into the 1.1.1 shell archive. See [model files](#model-files) |
| Public ACME certificate authorities | Caddy's automatic HTTPS in the VM package; Dokploy's proxy; cert-manager when you configure it | At first start and before every renewal. The authority must also reach the host on TCP 80 or 443 | An internal ACME server or a certificate you supply; see [certificates](#certificates-without-public-acme) |
| Your OIDC provider, when used | SSO sign-in with `LOLLY_AUTH_MODE=oidc` | Every sign-in, from the server and the browser | A provider inside your network, or built-in email/password sign-in |
| GitHub and the npm registry | Source checkout and `pnpm install` for `prepare-marketplace-instance.ts`; chart releases; the YunoHost server install | Once per preparation, on the machine that prepares the installation directory. YunoHost uses them on the host itself | Prepare on a connected workstation and copy the directory to the host |
| Optional browser services | Font picker, cloud-storage connectors, media embeds and a few public data sources that the shell's browser policy allows | Only when someone uses that feature | None; the feature does not work without access. The list is in [`shell-headers.ts`](https://github.com/lolly-tools/lolly-work/blob/main/server/src/api/shell-headers.ts) |

Beyond this list, the server connects out only for features an operator turns on,
such as catalogue sources, delivery destinations and AI providers. Pages in the
optional render worker may also reach public addresses that a tool requests.
Telemetry is off in the neutral package.

### Rate limits on public registries

ECR Public limits anonymous pulls, including the amount of data one source address
can download. The project's own CI was refused the PostgreSQL image under such a
data limit and now pulls the same digest from Docker Hub. Shared NAT addresses, CI
runners and repeated reinstallation reach these limits first. Signing in to a
registry raises its limits; a mirror removes the repeated pulls. Docker Hub and
GHCR apply their own anonymous limits. For PostgreSQL and Caddy, pulling by
digest returns the same bytes from either registry.

### Mirror the neutral VM package

Steps 1 to 3 run on a connected machine; the rest run in the installation
directory. Take the placeholder values from that directory's `release.json`:
`SERVER_DIGEST` is the digest in `serverImage`, and likewise for `postgresImage`,
`caddyImage` and, when you enable the worker, `workerImage`. `SHELL_URL` and
`SHELL_SHA256` are `shell.url` and `shell.sha256`.

1. Verify the server and worker image signatures as described in
   [release verification](#release-verification).
2. Copy each image with its whole multi-platform index, so the pinned digest
   stays valid, then check the digest your registry reports. For example, with
   skopeo:

   ```bash
   skopeo copy --all --preserve-digests \
     docker://ghcr.io/lolly-tools/lolly-work-server@sha256:SERVER_DIGEST \
     docker://registry.example.com/lolly/lolly-work-server:1.1.1
   skopeo inspect --raw docker://registry.example.com/lolly/lolly-work-server:1.1.1 \
     | sha256sum
   ```

   The printed hash must equal `SERVER_DIGEST`. Repeat for PostgreSQL, Caddy and
   the worker. A `docker pull` followed by `docker push` can keep only one platform
   and change the digest. If no connected machine can reach your registry, carry
   the images across as an OCI layout directory written and read with the same
   skopeo flags, then repeat the digest check inside.
3. Download the shell archive and check its checksum:

   ```bash
   curl --fail --output shell.tar.gz SHELL_URL
   echo "SHELL_SHA256  shell.tar.gz" | sha256sum --check
   ```

   Serve it from an HTTPS server in your network at a URL that returns the file
   directly, with one path per release. Initialisation refuses plain HTTP and
   redirects.
4. In the installation directory, add `compose.override.yaml` beside
   `compose.yaml`. The Compose commands in [Installing, section
   10](install.md#10-official-neutral-package) read it automatically:

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

   Keep `LW_SHELL_SHA256` unchanged: initialisation still checks the mirrored
   archive against the release checksum and refuses any other file. If the
   mirror's certificate comes from a private certificate authority, give the
   `content` service that authority's root certificate: add
   `NODE_EXTRA_CA_CERTS: /etc/lolly/mirror-ca.pem` to its `environment` and
   `./mirror-ca.pem:/etc/lolly/mirror-ca.pem:ro,Z` to its `volumes` in the same
   file.
5. Run `docker compose --project-name lolly-work config --images` and confirm
   that it lists only your registry. Then continue with section 10.
6. Test with outbound access blocked, except for your mirror, certificate
   authority and identity provider: first start, restart, owner and member
   sign-in, a saved project and a checked output. Record the results with the
   release digests. A mirror alone does not qualify an installation.

For each update, mirror the new release's images and archive first. Change the
override's digests and URL in the same step as the new `compose.yaml` and
`release.json`; an override left at the old digests keeps running the old
release. Keep the previous release's mirrored images and archive until you no
longer need them for [recovery](operations.md).

### Certificates without public ACME

Caddy in the VM package requests certificates from a public ACME certificate
authority, such as Let's Encrypt. The domain must resolve to the host from the
internet and the authority must reach it on TCP 80 or 443, at first start and
again before each renewal. A host that loses that access stops renewing, and
browsers reject it once the certificate expires.

To use an internal ACME server instead, add
`./acme-root.pem:/etc/caddy/acme-root.pem:ro,Z` to the `caddy` service's
`volumes` in `compose.override.yaml`, so Caddy trusts that server's root
certificate. Then edit the installation's `Caddyfile`:

```text
{$LOLLY_DOMAIN} {
  tls {
    ca https://acme.example.com/acme/directory
    ca_root /etc/caddy/acme-root.pem
  }
  reverse_proxy server:8787
}
```

To supply your own certificate, mount a directory such as
`./certs:/etc/caddy/certs:ro,Z` the same way and put
`tls /etc/caddy/certs/fullchain.pem /etc/caddy/certs/key.pem` in place of the
`tls` block. Caddy does not renew a certificate you supply: replace the files
before they expire and run `docker compose --project-name lolly-work restart caddy`.
With an internal authority, every person's device must trust its root. An update
must keep the edited `Caddyfile` when you compare the new package files.

On Kubernetes, set `ingress.tls` to a Secret you manage, or point cert-manager at
an internal issuer. Dokploy's proxy has its own certificate settings.

### Helm, Dokploy and YunoHost

- **Helm.** Set `image.repository` and `image.digest` to your registry, keeping the
  digests from
  [`values-official-release.yaml`](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/values-official-release.yaml);
  do the same for `renderWorker.image` when the worker is enabled. Add
  `imagePullSecrets` if the registry needs credentials. Copy the verified chart
  package into your own chart repository; until the first publication, package
  the reviewed `deploy/helm` source instead. The chart downloads no shell and
  includes no database: supply PostgreSQL from your registry and the verified
  shell through the chart's shell volume or `shell.image`. Because Kubernetes
  pulls on any node that lacks an image, keep the registry available while the
  cluster runs. If admission control checks image signatures, copy the
  signatures as well and test that check against your registry before relying
  on that signature check.
- **Dokploy.** The blueprint uses the same server image, PostgreSQL image and
  archive URL, so make the same replacements in its Compose editor. Dokploy's own
  installation and proxy have their own download sources.
- **YunoHost.** The package downloads both archives from `lolli.li`, installs the
  server's dependencies from the npm registry and gets Node.js through YunoHost.
  It has no mirror route; treat it as an online installation.

### Model files

The 1.1.1 shell archive was built to fetch model files from `https://lolli.li`. In
a network that cannot reach it, features that need those files do not work.
Mirroring the archive does not change this, because the model location is set
when the shell is built. A fully disconnected installation needs a shell built
with its own model location (`VITE_MODELS_BASE`, see Lolly's
[delivery guide](https://github.com/lolly-tools/lolly/blob/main/docs/deploy-delivery.md))
and the model files on that host. An empty base serves them from the instance's
own origin; a separate model host must also be allowed by the browser policy.

A shell built with an empty base asks the instance for `/models/...`. Work answers
from the shell dist when the files are there, and otherwise passes the request to
`instance.modelOrigin` (default `https://lolli.li`, see
[configuration](configuration.md)), so the browser contacts only the instance and
the Work server contacts the model host. Set `modelOrigin` to `null` when the dist
carries its models or the installation offers none.
That is a different shell release, with its own checksum and catalogue key pins
and its own acceptance. The project does not publish or qualify such a bundle yet.

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
