# Run Lolly Work

Lolly works on its own, on each person's device. Lolly Work is the server you add
when a team needs to share: one sign-in, shared projects with live editing, a
governed asset library, approvals and exports made on the server. You run it on
infrastructure you control.

Pick the path that matches what you have today. Each card opens the page with the
commands.

::: figure work-self-host-chooser
One question decides most of the choice: will other people use this instance? Trials need no database. Team installs all finish with the same three steps.
:::

## The paths in brief

- **Just looking?** Open the public demo at [lolly.work](https://lolly.work). Sign
  in with one click as a sample admin, brand lead, marketer or contractor. Browse
  the console at `/admin` or render a tool from a plain link such as
  `/render/qr-code.svg?url=https://example.com`. It keeps everything in memory and
  forgets it when it restarts. The demo runs on UpCloud in Frankfurt, on openSUSE
  Leap and K3s, in an isolated namespace; its people, assets and room activity are
  sample data.
- **Trying it on your computer?** The [local demo](install.md#1-try-it-on-your-computer)
  runs from source on Node 24 in about two minutes.
- **Trying it on a cluster?** The [cluster evaluation](platform-deployment.md#evaluate-on-a-cluster)
  is one Helm command, with sample people and memory storage.
- **One Linux server for a small team?** The [ready-made package](ready-made-package.md)
  brings Work, PostgreSQL, the matching web app and automatic HTTPS, with email and
  password sign-in. If you would rather write your own configuration, run
  [Compose from source](install.md#5-container-compose) or
  [Node and systemd](install.md#6-bare-metal-systemd).
- **Already run YunoHost?** [Install the Lolly Work app](install.md#7-yunohost)
  and sign in with your YunoHost accounts.
- **Have a Kubernetes platform?** [Install on Kubernetes](platform-deployment.md)
  with the Helm chart, your own PostgreSQL and your identity provider.
- **Starting from bare VMs on UpCloud or Evroc?** The
  [cloud modules](cloud-deployment.md) create the machine; then follow one of the
  server paths above.

Every team install ends the same way. The first owner signs in,
[Customer setup](customer-setup.md) checks the configuration and you download a
checked sample. After that, connect your
[identity provider](enterprise-identity.md) if you use one, and read
[Keep Lolly Work running](operations.md) before you invite people.

## What runs where

The server ships as source code and Linux container images. The Lolly desktop
`.dmg`, `.exe`, `.deb` and `.rpm` packages install the app people use, not a Work
server.

- **Linux** runs every path.
- **macOS** runs the local demo from source, or Linux containers through Docker
  Desktop. See the [macOS steps](install.md#macos).
- **Windows 11** runs the Linux steps inside WSL 2, or Docker Desktop with Linux
  containers. See the [Windows steps](install.md#windows). On Windows Server, use a
  Linux VM or your existing Kubernetes platform.

The Lolly web app that Work can serve at `/` needs a secure address (HTTPS, or
`localhost` while testing) and a browser with WebGPU. See
[supported environments](/info/start/supported-environments.html).

## YunoHost: choose Lolly Work

There are two Lolly packages for YunoHost, and they are not interchangeable.

- **`lolly-tools/lolly-work_ynh`** is Lolly Work. It includes the Lolly web app, a
  PostgreSQL database, shared projects, sign-in with your host accounts, roles and
  the Work console. Choose this one for a home or team server.
- **`lolly-tools/lolly_ynh`** serves the static Lolly app only. People work on
  their own devices, with no server, database or shared projects. Installing it
  does not install Work.

There is no in-place upgrade from `lolly_ynh` to `lolly-work_ynh`. If you already
run static Lolly, install Work on another domain and check sign-in and moving your
projects across. Keep the original app until you are satisfied.

Which package versions have passed their checks is recorded in
[official installation routes](official-installations.md).

::: details Downloads for %work{version}
The [Work release page](https://github.com/lolly-tools/lolly-work/releases/tag/v%work{version})
has the published files, exact source, image digests, checksums and qualification
results. Treat a release target as ready only when its file is published there and
its checks are recorded.

| Package | Use it for |
|---|---|
| **Work server image**: `ghcr.io/lolly-tools/lolly-work-server:%work{version}` | Compose and Kubernetes; Linux `amd64` and `arm64` manifests |
| **Optional render worker**: `ghcr.io/lolly-tools/lolly-work-render-worker:%work{version}` | Browser-based server rendering; configure its authenticated HTTPS transport separately |
| **Helm chart** %work{chart}: `deploy/helm` in the source code, and the published chart | Work %work{version} on an existing Kubernetes platform. The chart carries the release version; 1.1.3 is its first publication |
| **Source code** on the Work release page | Node and systemd installs, local evaluation, deployment recipes and custom image builds |
| **[Lolly Work for YunoHost](https://github.com/lolly-tools/lolly-work_ynh)** | The complete server with host accounts; follow the package's version notes |
| **[Lolly web app 1.1.3](https://lolli.li/lolly-web-1.1.3-ynh1.tar.gz)** | The browser app that matches a Work installation. Served by Work 1.1.3, it takes the installation's catalogue key and shows its tools. On its own, this archive is a static web app |

The Work YunoHost archive is an input to the YunoHost installer. It leaves out the
demo pack and the deployment recipes, so use the source download for a manual
Node or Compose install. YunoHost fetches both the Work archive and the matching
web archive, and checks them against the checksums in its package manifest.

Keep the server, worker and web app on the same release. For production, select
the immutable image digests recorded in the release rather than `latest`. An
`arm64` image does not mean every ARM device is qualified; the release results
list the tested architectures.

**Check a downloaded file.** Download `SHA256SUMS` from the same Work release, then
compare the line for your file:

```bash
# Linux or WSL
sha256sum lolly-web-1.1.1-ynh1.tar.gz
# macOS
shasum -a 256 lolly-web-1.1.1-ynh1.tar.gz
```

PowerShell can check the file before you copy it to your server:

```powershell
Get-FileHash .\lolly-web-1.1.1-ynh1.tar.gz -Algorithm SHA256
```

The file name and the whole hash must match. Archive checksums cover the
downloaded files; for container images, the keyless signatures and the release's
source and image record do that job, as
[official installation routes](official-installations.md#release-verification)
explains.
:::
