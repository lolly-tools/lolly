# Run your own Lolly Work server

Choose **Lolly Work** for accounts, shared projects, collaboration, permissions,
catalog providers and server APIs. It runs on infrastructure you control. Your
users connect in their browsers or connect a Lolly client to your instance.

The [public demo](https://lolly.work) lets you explore the console with sample
data. Its passwordless accounts and temporary storage are for evaluation.

## Choose your platform

| Your platform | Start here | What you install |
|---|---|---|
| **YunoHost** | [Install Lolly Work](install.md#yunohost) | Work server, PostgreSQL, Lolly web app and sign-in with your YunoHost accounts |
| **Linux server**: Ubuntu, Debian, SLES, openSUSE or another Docker host | [Container installation](install.md#5-container-compose) | Work and PostgreSQL with Compose; add your domain, TLS and identity provider |
| **Linux without containers** | [Node and systemd](install.md#6-bare-metal-systemd) | Work on Node 24+, with your PostgreSQL service and HTTPS reverse proxy |
| **macOS**: Apple silicon or Intel | [macOS prerequisites](install.md#macos) then [local evaluation](install.md#1-local-demo) | Source on Node, or Linux containers through Docker Desktop |
| **Windows 11** | [Windows prerequisites](install.md#windows) | Linux installation inside WSL 2, or Docker Desktop with Linux containers |
| **Kubernetes, K3s, RKE2 or Rancher** | [Cluster evaluation](install.md#7a-evaluate-on-a-cluster) or [production](install.md#7b-production) | Helm chart, Work image, existing PostgreSQL, persistent assets and ingress |
| **SUSE platform / OpenPlatform** | [Platform deployment](platform-deployment.md) | Reviewed SUSE image/profile and platform storage, identity and worker settings |
| **UpCloud, evroc or another VM provider** | [Cloud deployment](cloud-deployment.md) | The Linux or Kubernetes route on a VM you operate |

The server distribution is source and Linux containers. Lolly desktop `.dmg`,
`.exe`, `.deb` and `.rpm` packages install the client application; they do not
install a Work server. Windows Server operators should use a Linux VM or their
existing Kubernetes platform.

## Downloads for 1.1.1

Use the [Work release page](https://github.com/lolly-tools/lolly-work/releases/tag/v1.1.1)
for the published files, exact source, image digests, checksums and qualification
results. A listed release target is ready to use only after its artifact has
been published and its checks recorded there.

| Package | Use it for |
|---|---|
| **Work server image**: `ghcr.io/lolly-tools/lolly-work-server:1.1.1` | Compose and Kubernetes; Linux `amd64` and `arm64` manifests |
| **Optional render worker**: `ghcr.io/lolly-tools/lolly-work-render-worker:1.1.1` | Browser-based server rendering; configure its authenticated HTTPS transport separately |
| **Helm chart**: `lolly-work-0.3.1.tgz` | Work 1.1.1 on an existing Kubernetes platform |
| **Source code** on the Work release page | Node/systemd installations, local evaluation, deployment recipes and custom image builds |
| **[Lolly Work for YunoHost](https://github.com/lolly-tools/lolly-work_ynh)** | Managed installation of the complete server with host accounts; follow the package's version-specific qualification notes |
| **[Lolly web shell 1.1.1](https://lolli.li/lolly-web-1.1.1-ynh1.tar.gz)** | Matching browser app for a Work installation; this archive alone is a static web app |

The Work YunoHost archive is an input to the YunoHost installer. It omits the demo
pack and deployment recipes, so use the source download for a manual Node or
Compose installation. YunoHost fetches both Work and the matching web archive
and verifies the checksums in its package manifest.

Keep the server, worker and web shell on the matching release. For production,
select the immutable image digests recorded in the release instead of `latest`.
An `arm64` image being available does not establish runtime qualification on
every ARM device; consult the release results for the tested architectures.

### Verify a downloaded file

Download the matching checksum file from the same Work release as the package
(`lolly-work-0.3.1.tgz.sha256` for the chart, or `SHA256SUMS` for the other assets). In the download
directory, compare the line for your file with:

```bash
# Linux or WSL
sha256sum lolly-work-0.3.1.tgz
# macOS
shasum -a 256 lolly-work-0.3.1.tgz
```

PowerShell can inspect the same download before transferring it to your server:

```powershell
Get-FileHash .\lolly-work-0.3.1.tgz -Algorithm SHA256
```

The filename and complete hash must agree. Release source/image metadata and
the keyless image signatures cover the container path; archive checksums cover
the downloaded files.

## YunoHost: choose Lolly Work

**Lolly Work is the recommended YunoHost package for a home or team server.**
It includes the Lolly web app, a persistent database, shared projects, host-account
sign-in, roles and the Work console. Select `lolly-tools/lolly-work_ynh`, and
follow [the YunoHost installation steps](install.md#yunohost).

The separate `lolly-tools/lolly_ynh` package serves the static Lolly app. Choose
that only when you want people to work on their own devices without the Work
server, database or shared-project service. Installing it does not install Work.

These are separate apps, not interchangeable upgrade targets. If you already
run static Lolly, install Work on another domain, verify sign-in and your project
transfer, and retain the original app until you are satisfied. Do not run an
in-place upgrade from `lolly_ynh` to `lolly-work_ynh`.

YunoHost package qualification is release-specific. Earlier Work 1.1.0 beta
checks do not qualify 1.1.1, and a package mirror or successful lint run does not
prove installation, upgrade or restore. Use the published release results before
upgrading a server that holds real work. The package does not provision the
optional Chromium render worker.

## Finish your first installation

The [installation guide](install.md) owns the setup commands for every platform.
For a shared instance, configure durable PostgreSQL storage, stable secrets,
real sign-in, your domain and HTTPS. A full browser workspace also needs the
matching web shell and an instance pack; the default Helm profile provides the
console/API without the editing shell.

After setup, check `/healthz` and `/readyz`, sign in as the first owner, create a
project and reopen it after a restart. Complete [Customer setup](customer-setup.md),
test the export formats your team needs, and verify backup and restore before
inviting users. Keep the previous release and a verified database backup when
[upgrading](operations.md).
