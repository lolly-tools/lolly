# Installing

For release downloads and a platform chooser, start with [Run your own Lolly Work server](self-host.md). **YunoHost users who want server features should install Lolly Work** (`lolly-work_ynh`). The separate `lolly_ynh` package serves only the static app.

For managed SSO, use [Enterprise identity deployment](enterprise-identity.md): provider
registration, admission, optional MFA, SCIM/offboarding, logout and upgrade checks.

Choose a **shared Lolly Work instance**, a disposable evaluation, or a deployment
on your existing platform. Commands with registry, hostname or file placeholders
need your reviewed values before you run them.

After the first owner can sign in, use [Guided customer setup](customer-setup.md) or
**Customer setup** in the console for configuration files, identity checks and a checked sample.

| I want to... | Go to | Time |
|---|---|---|
| Just look, install nothing | [Hosted demo](#0-hosted-demo-zero-install) | 0 min |
| Evaluate locally | [1. Local demo](#1-local-demo) | 2 min |
| Evaluate on a cluster | [7a. Kubernetes eval](#7a-evaluate-on-a-cluster) | 5 min |
| Run a small shared instance on one host | [5. Container (Compose)](#5-container-compose) | Allow time for identity, TLS and recovery checks |
| Use an existing K3s/RKE2 or other Kubernetes platform | [7b. Kubernetes production](#7b-production) and [platform deployment](platform-deployment.md) | Depends on the existing platform |
| Prepare a new SLES/openSUSE host | [Platform deployment](platform-deployment.md) | Host and cluster qualification required |
| Use YunoHost accounts on a home or small-team box | [6. Bare metal → YunoHost](#yunohost) | Package qualification pending |
| Drive it from a terminal | [8. The CLI](#8-the-cli) | - |
| Connect a DAM or a bucket | [9. Connect a source](#9-connect-a-source) | 10 min |

Work's server runs TypeScript directly on Node. Source-based installations use
sections 2 to 4 for configuration, persistence and secrets. Container operators
do not need a host Node installation, and existing platform teams can start at
section 7b. YunoHost manages its own runtime and sign-in; no Kubernetes is needed.

A full browser workspace also needs the matching Lolly web shell and tool pack.
The default Helm profile serves the console/API, with the shell disabled. Choose
the signed shell/pack delivery in your instance values rather than assuming a
Ready server provides the editing interface. After installation, use section 9
when connecting a catalog source.

## Connecting clients

In an installed iOS, Android or desktop client, choose **Connect to a Lolly
instance** and enter your workspace address. Sign in through the system browser
and approve the displayed code, then return to Lolly. The client loads the
workspace's brand and your account's projects and shared sessions.

Web clients open the workspace at its own address so its login cookie also works
for the private catalog and collaboration sockets.

Native collaboration needs a matching Work server with
`POST /api/v1/collab/sessions/:id/socket-ticket`. Each ticket lasts 30 seconds,
works for one room and can be used once. The HTTP ticket request and WebSocket
upgrade must reach the same Work process, following the supported single
collaboration owner topology in [deployment](deployment.md).

## 0. Hosted demo (zero install)

A public, passwordless sandbox runs at **<https://lolly.work>**: one-click sign-in as any
persona (admin / brand-lead / marketer / contractor), the governed admin console at
`/admin`, and live tool renders over a plain GET (`/render/qr-code.svg?url=...`). State is
in-memory and resets on redeploy; it holds nothing real.

> The demo runs on **UpCloud in Frankfurt**, using openSUSE Leap and K3s, in an
> isolated evaluation namespace. Its personas, assets and room activity are sample
> data; private workspaces use separate storage, identity and real collaboration.
> For your own instance on UpCloud, evroc or another cloud, see section 7 and
> [deployment](deployment.md).

## Prerequisites

**Node 24+** is the server runtime. Install it on the host only for source-based
local or systemd deployment. Compose/Kubernetes images include it; YunoHost's
package supplies its runtime. The server runs `.ts` sources through Node's native
type-stripping.

### Linux

For Ubuntu or Debian, install Git, curl and certificate roots with
`sudo apt-get update` then `sudo apt-get install git curl ca-certificates`.
For SLES/openSUSE, use `sudo zypper install git curl ca-certificates`.
Install **Node 24 or later** from your distribution if available, or follow
[Node's installation instructions](https://nodejs.org/en/download) for that OS
and architecture. Check `node --version` and `npm --version` before continuing;
a distribution's unversioned `nodejs` package may be older than Work requires.

For container installations, follow [Docker Engine's platform guide](https://docs.docker.com/engine/install/)
and install the Compose v2 plugin. The container supplies Node; skip host Node
and pnpm unless you will also run Work directly from source.

### macOS

For a local source installation on Apple silicon or Intel, install Git and Node
24 with [Homebrew](https://brew.sh):

```bash
brew install git node@24
export PATH="$(brew --prefix node@24)/bin:$PATH"
node --version
npm --version
```

Keep that PATH entry in your shell profile for later sessions. Continue with
[the local demo](#1-local-demo). For Linux containers instead, install
[Docker Desktop for Mac](https://docs.docker.com/desktop/setup/install/mac-install/),
start it and check `docker compose version`, then follow section 5. The Lolly
macOS desktop app is a client, not the Work server.

### Windows

Use **WSL 2** for these Linux shell commands. In an administrator PowerShell
window, follow [Microsoft's WSL installation guide](https://learn.microsoft.com/en-us/windows/wsl/install):

```powershell
wsl --install -d Ubuntu
```

Restart if requested, open Ubuntu and create its Linux user. Keep your Work
checkout under the Linux home directory (for example `~/lolly-work`). Follow
[Linux prerequisites](#linux) and section 1 inside Ubuntu; do not paste Bash
`export`, `sudo` or `$(...)` examples into PowerShell.

For Compose, install [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/),
select Linux containers and enable WSL integration for Ubuntu. Check
`docker compose version` inside Ubuntu, then continue with section 5. Docker
Desktop is not the deployment path for Windows Server; use a Linux VM or an
existing Kubernetes platform there. Native Windows service installation has
not been qualified for this release.

**PostgreSQL** is required for durable state (section 3). Compose brings PostgreSQL
17; the optional [SUSE profile](../deploy/suse/README.md) pins Application Collection
PostgreSQL 18.6 with its own qualification and recovery requirements. Systemd and
production Helm need a separately managed database. Local and Helm evaluations
use memory by default: they bring no durable database and reset on restart.

**One more tool, only for the shape you pick.** Sections 1, 2 and 6 need nothing beyond
the above:

| Shape | Also needs | Check it with |
|---|---|---|
| Section 5 (Compose) | Docker with the **Compose v2** plugin | `docker compose version` prints a version. The older standalone `docker-compose` is not it, and `docker compose up --build` fails with `unknown flag: --build` when the plugin is missing |
| Section 7 (Kubernetes) | `kubectl` and **Helm 3**, pointed at a cluster | `kubectl cluster-info` and `helm version` |

## 1. Local demo

Use the published release tag so the server and vendored engine stay matched.
The release source ZIP is an alternative to Git; extract it and open its root
directory before running the package-manager commands.

```bash
git clone --branch v1.1.1 --depth 1 https://github.com/lolly-tools/lolly-work.git
cd lolly-work
# Install the pinned package manager once (or use Corepack).
npm install --global pnpm@11.26.0
pnpm install --frozen-lockfile
pnpm run demo            # http://localhost:8787   (PORT=8788 for another port)
```

The root `pnpm-workspace.yaml` links the pinned vendored engine and SDK without changing their source. Use the pinned pnpm version and commit `pnpm-lock.yaml` after dependency changes; deployments install with `--frozen-lockfile`. The render worker has its own lockfile: install it with `pnpm -C workers/render install`. The hoisted module layout supports the server's deployment packager. Run `pnpm run update:npm-licenses` and `pnpm run sbom` after dependency changes, then commit the license metadata cache and SBOM.


`pnpm run demo` builds its **own** config (it ignores `instance.json`) and seeds a whole
governed deployment in memory: four personas, tool overlays, an approval chain, projects,
fourteen days of usage telemetry and sixty days of audit history behind the console
charts. It prints one passwordless sign-in link per persona at boot. Open the printed URL:

- **Admin console** at `/admin` - sign in as `admin@suse.example`.
- **This documentation** at `/admin#/docs`.
- **Web shell** at `/` - only when a built Lolly web shell is present (see below).

The web shell and the in-shell governance UX (sign-in gate, locked tool inputs, locked
profile) come from the open-source Lolly repo, which this repo never builds. To get them,
clone it beside this one once:

```bash
git clone https://github.com/lolly-tools/lolly.git ../lolly
cd ../lolly && pnpm install && pnpm run build:web && cd -   # needs Node >=22.18 or >=24
```

The public clone includes the community tools and starter brand. Only the private
SUSE brand needs an opt-in submodule checkout: run
`git submodule update --init --checkout brands/suse` inside the Lolly clone when
you have access and intend to build that profile.

Then re-run `pnpm run demo`. It looks for `$LOLLY_OSS_DIR`, then `../lolly`; the boot banner
says which of the three states it found (no shell / stale shell / fresh shell). The console
and render plane work in all three.

## 2. Your first real instance

This source-based walkthrough teaches the configuration used by Compose,
systemd and Helm. Running it locally is optional for an existing platform team;
prepare the reviewed production configuration before following section 7b.

```bash
pnpm install                              # once per checkout, before anything runs
cp instance.example.json instance.json
npm start                                # http://localhost:8787
```

`instance.example.json` is a working gated instance: the dev sign-in provider on, the
committed `packs/demo` catalog, in-memory storage.

### Sign in

Open **<http://localhost:8787/admin>**. The dev provider renders a single **Work email**
box - there is no persona list, and `you@example.com` is only a placeholder. Type one of
the two addresses `instance.example.json` actually ships, then Continue:

| Address | Group | Can do |
|---|---|---|
| `owner@example.test` | `owner` | everything, including `instance.config` and provider credentials |
| `dev@example.test` | `admin` | everything except the owner-only actions below |

Any other address answers `403`: the dev provider admits only what `dev.users` lists, so
add yourself there if you want your own address to work. Or, for scripting, mint a session
cookie directly:

```bash
curl -si 'http://localhost:8787/api/auth/dev?email=owner@example.test' | grep -i set-cookie
```

### Did it work

Five checks, in order. Each one is the prerequisite for the next.

```bash
curl -s http://localhost:8787/healthz
# {"ok":true,"name":"SUSE Content Automation","accessMode":"gated"}

C=$(curl -si 'http://localhost:8787/api/auth/dev?email=owner@example.test' \
      | grep -i '^set-cookie: lw_session' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1)

curl -s -H "Cookie: $C" http://localhost:8787/api/auth/session
# ..."groups":["owner"],"role":"owner"}}          ← identity and derived role

curl -s -H "Cookie: $C" http://localhost:8787/api/v1/policy/tools
# a tools array: color-palette, mesh-gradient, qr-code   ← the pack is mounted

curl -s -o out.svg -w '%{http_code} %{content_type}\n' -H "Cookie: $C" \
  'http://localhost:8787/render/qr-code.svg?url=https://suse.com'
# 200 image/svg+xml                                ← the render plane works
```

An empty `tools` array means `instance.pack` points somewhere that does not exist; the
server warns about that at boot. A `501 HOOKED_TOOL_NEEDS_CHROMIUM` on the render means
`render.allowHooksInFastPath` is `false` - see section 4.

### The first owner

**Role is derived from groups**, using the defaults or explicit `idp.roleGroups`
mapping. A configured `idp.bootstrapOwners` email gains the owner group after
provider identity verification; it still needs to pass admission. Without an
owner, three actions are unreachable by anybody: `instance.config`,
`catalog.provider.credential` and `catalog.provider.publish` - which is everything needed
to connect a real DAM.

| Situation | How the first owner appears |
|---|---|
| Local (section 2) | `instance.example.json` ships `owner@example.test` in group `owner`. Sign in as that persona |
| Kubernetes eval (section 7a) | `deploy/helm/values-eval.yaml` ships `owner@eval.example` in group `owner`. Different addresses from section 2; the section 2 ones `403` there |
| SSO (section 4) | Create a group named exactly `owner` in your IdP, put the deploy operator in it, and make sure it arrives in the claim named by `idp.groupsClaim` (default `groups`) |
| Named OIDC bootstrap | Set `idp.bootstrapOwners` to the intended verified email and include it in admission; use an explicit owner role-group mapping |
| SSO where you cannot add that group | Any admin can mint one: `POST /api/v1/groups {"name":"owner"}` then `PUT /api/v1/users/<id>/local-groups {"groups":["owner"]}`. Both are `grant.edit`, which admin holds, and both are audited |
| GitOps / air-gap | A `LW_SEED_CONFIG` document is trusted and may grant owner-only actions to a group before any human signs in (section 8, [governance](governance.md)) |

Role changes take effect on the next API request, not on the next token mint: authorization
resolves the live user record, so the same cookie gains and loses powers immediately.

### The four settings that make it yours

| Set | To | Why |
|---|---|---|
| `instance.baseUrl` | the URL this deploy actually answers on | drives OIDC redirect URIs and the `Secure` cookie flag. Wrong value breaks SSO |
| `instance.pack` | your brand pack mount | the catalog, design tokens, console theming and tools all come from here |
| `instance.shellDir` | a built `shells/web/dist` (from section 1) | serves Lolly at `/` on one origin, so session cookies work and the in-shell governance UX activates |
| `idp.issuer` + `idp.clientId` | your OIDC issuer | real SSO ([identity](identity.md)) |

Under a non-`open` access mode the server **refuses to start** if `shellDir` points at a
missing or pre-governance dist, rather than silently serving an un-governed shell.
In evaluation, `LW_ALLOW_STALE_SHELL=1` downgrades that to a loud warning. Production
validation still refuses a stale local shell.

Full key reference: [configuration](configuration.md).

<a id="before-you-expose-it"></a>

### Before exposing the server

Setting `idp.issuer` does **not** turn the dev provider off. `/api/auth/dev` stays a live
passwordless bypass until explicitly configured. Before any instance is reachable by anyone else:

1. `"dev": { "enabled": false }` in `instance.json`. The server warns at boot if a real
   issuer and the dev provider are both configured.
2. `instance.baseUrl` set to the real URL.
3. `"deployment": { "mode": "production", "application": "web" }`, a durable
   DATABASE_URL, and both stable signing secrets set (section 4). Use `application: "api"`
   for a deliberate console/API-only installation.
4. Behind a reverse proxy or ingress, `rateLimit.trustedProxyHops: 1`, or per-IP limits
   only ever see the proxy.
5. A database password you chose. The Compose file defaults it to the literal `lolly`,
   so any instance that started without one is still using that password. Set `PG_PASSWORD` in
   `.env` ([section 5](#5-container-compose)); after first boot the `pgdata` volume keeps
   the old one, so changing it also needs `alter role`.

### Validate the selected pack and deployment

```bash
pnpm run inspect:pack /path/to/customer-pack
LW_CONFIG=./instance.json pnpm run check:setup
```

The pack inspector uses Work's installed engine and canonical source resolver. It loads
every advertised tool, checks required files and local catalog assets, and reports
configured server formats separately from other declared formats. It never executes hooks
or fetches remote assets. An optional second argument selects a source ID. With LW_CONFIG
set, the command also uses that deployment's worker and server-rendering requirements.

Work's `engine-pin.json` records the exact bundled engine and core source. Use the
matching Lolly web release and tool pack. A configured worker or a shell containing
the governance marker does not prove an exact matched client release; validate
the selected pack and representative renders before acceptance.

Production startup refuses missing durable storage, development sign-in and invalid active
packs. `/readyz` reports the actual store and removes production readiness when its checks
fail; `/healthz` remains liveness. Owners can inspect **Customer setup** in the console.
Its `not-tested` results identify integrations that still need verification. Pack checks
are cached for at most 60 seconds, so probes do not run a full inspection on every request.

## 3. Persistence

Without `DATABASE_URL` the in-memory store runs and everything resets on restart. Correct
for evaluation, never for a real deploy.

The two platforms differ in more than the package manager, so pick your block. On Linux the
server runs as an OS user named `postgres` and only that user is a database superuser; on
macOS Homebrew creates no such OS user and makes **your own account** the superuser, so the
same two commands run with no `sudo` and no `-u postgres`.

**SLES / openSUSE Leap:**

```bash
sudo zypper install postgresql-server postgresql
sudo systemctl enable --now postgresql
sudo -u postgres createuser --pwprompt lolly
sudo -u postgres createdb --owner=lolly lolly_work
```

**macOS (Homebrew):** `postgresql@17` is keg-only, so its client commands are not on `PATH`
until you put them there.

```bash
brew install postgresql@17
brew services start postgresql@17
export PATH="$(brew --prefix postgresql@17)/bin:$PATH"   # keg-only: createuser/createdb/psql live here
createuser --pwprompt lolly
createdb --owner=lolly lolly_work
```

Then, on either platform, substituting the password you just typed at the `--pwprompt`
prompt:

```bash
export DATABASE_URL=postgres://lolly:<password>@localhost/lolly_work
psql "$DATABASE_URL" -c 'select 1'   # role, database and password all correct before you go on
pnpm run migrate:status               # lists pending migrations, exits 1 if any
pnpm run migrate                      # or just start the server: migrations auto-apply at boot
```

Restart-survival needs the two secrets in section 4 as well: with a database but no
`LW_SESSION_SECRET`, data persists and every session still dies on restart.

For Helm rollouts, enable the migration Job and turn boot DDL off
(`LW_AUTO_MIGRATE=false`). Keep one writable collaboration owner; the current
chart refuses multi-owner replicas. See [operations](operations.md).

## 4. Secrets

Secrets never live in the config file. Production requires two stable random signing
secrets of at least 32 bytes. Set `deployment.mode: "production"` explicitly; existing
configs using `auto` inherit this from NODE_ENV. Explicit evaluation permits random keys
per process, so every restart logs everyone out and voids every issued link.

```bash
export NODE_ENV=production
export LW_SESSION_SECRET=$(openssl rand -hex 32)   # session/guest/state tokens
export LW_LINK_SECRET=$(openssl rand -hex 32)      # share/embed/download link signatures
```

Everything else is optional until the feature is used: `LW_IDP_CLIENT_SECRET`,
`LW_CREDENTIAL_SECRET`, `LW_METRICS_TOKEN`, `LW_RENDER_WORKER_SECRET`,
`LW_C2PA_SIGNING_KEY`, `LW_BLOBS_S3_CREDENTIAL`. See [configuration](configuration.md).

One more switch to settle before you deploy: `render.allowHooksInFastPath`. The
in-process render path refuses to run a tool's `hooks.js` unless you opt in, answering
`501 HOOKED_TOOL_NEEDS_CHROMIUM` instead. Every tool in `packs/demo` ships hooks, so
`instance.example.json` sets it `true` - that pack is curated in this repo end to end. When
you repoint `instance.pack` at a pack you do not fully control, set it back to `false` and
attach a Chromium worker (section 7) instead.

## 5. Container (Compose)

**The recommended single-host shape.** One VM, Postgres alongside, no host Node and no
system user to manage.

```bash
cd <your checkout>                              # the REPO ROOT: the mount is ../../instance.json
test -f instance.json && echo "using the instance.json you authored in section 2" \
  || cp instance.example.json instance.json     # only if you skipped section 2
```

**Do not blind-copy the example over your own file.** The compose stack mounts
`instance.json` from the **repo root** - the same file section 2 had you author. Copying the
example over it silently reverts `baseUrl`, `pack`, `idp.issuer` and `dev.enabled` to the
demo values, and no later step notices.

```bash
cd deploy/compose
printf 'LW_SESSION_SECRET=%s\nLW_LINK_SECRET=%s\nPG_PASSWORD=%s\n' \
  "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" > .env
# Use the published 1.1.1 server image; no local build is needed.
cat > release-images.yaml <<'YAML'
services:
  server:
    image: ghcr.io/lolly-tools/lolly-work-server:1.1.1
YAML
docker compose -f docker-compose.yml -f release-images.yaml pull
docker compose -f docker-compose.yml -f release-images.yaml up -d --no-build
```

Use the same two `-f` arguments for subsequent `logs`, `stop` and `up` commands.
For a custom source build instead, omit the override and run
the following command:

```bash
docker compose up --build
```

After checking the release's verified image digest,
replace the version tag in `release-images.yaml` with that digest for production.

All three lines of `.env` matter. The compose file refuses to start without the two
`LW_` secrets. `PG_PASSWORD` feeds both the server's `DATABASE_URL` and the Postgres
container; left out, both fall back to the literal `lolly` (section 2). Changing it after
first boot also needs `alter role lolly password '<new>'` inside the container (the
`pgdata` volume keeps the old one), or `docker compose down -v` (destroys data).

If `instance.json` is missing, Docker creates a **directory** at the bind source and the
server then fails to read a directory as its config - hence the `test -f` check above.

### Verify

```bash
curl -s http://localhost:8787/healthz     # "name" must be YOUR instance.name, not the example's
```

Then run the rest of the section 2 ladder against `http://localhost:8787`, signing in as an address
your own `dev.users` lists (or through your IdP if you already set `idp.issuer` and turned
the dev provider off). The image sets `NODE_ENV=production`, so a missing secret is a hard
failure rather than a silent downgrade. The pack and an optional built shell are
bind-mounted read-only; migrations auto-apply at boot.

### Before you call it done

This shape is a real deploy, so it needs the same three things section 6 needs, and nothing above
does them for you:

1. `instance.baseUrl` set to the URL this host actually answers on. It drives OIDC redirect
   URIs and the `Secure` cookie flag - leave it at `http://localhost:8787` and browser
   sign-in over a real hostname will not complete.
2. TLS in front: nginx or Caddy on the host, or termination at your load balancer, proxying
   to `:8787`. Nothing in this stack terminates TLS.
3. `rateLimit.trustedProxyHops: 1` in `instance.json` once a proxy is in front, or every
   per-IP limit only ever sees the proxy.

Shape details (bind mounts, shell mount, boot guard): [deployment](deployment.md#single-vm-compose).

## 6. Bare metal (systemd)

Same code, less orchestration, when you would rather not run containers. Install
PostgreSQL and create the role and database first (section 3) - the unit crashloops without them.

```bash
sudo useradd --system --home /opt/lolly-work --shell /usr/sbin/nologin lolly
sudo git clone https://github.com/lolly-tools/lolly-work.git /opt/lolly-work
sudo chown -R lolly:lolly /opt/lolly-work
cd /opt/lolly-work && sudo -u lolly -H pnpm install --prod
sudo -u lolly cp instance.example.json instance.json    # then edit it (section 2)
```

The secrets file the unit reads. `EnvironmentFile` does no shell expansion, so the values
must be written already resolved. `DATABASE_URL` goes in here too, not in the unit: it
carries the password you set at section 3's `createuser --pwprompt` prompt, and this file is the
one that is `0600`. Substitute that password for `<password>` below:

```bash
sudo sh -c 'printf "LW_SESSION_SECRET=%s\nLW_LINK_SECRET=%s\nDATABASE_URL=postgres://lolly:%s@localhost/lolly_work\n" \
  "$(openssl rand -hex 32)" "$(openssl rand -hex 32)" "<password>" > /etc/lolly-work.secrets'
sudo chown root:root /etc/lolly-work.secrets && sudo chmod 600 /etc/lolly-work.secrets
```

`/etc/systemd/system/lolly-work.service` (substitute the real `node` path if it is not
`/usr/bin/node` - `command -v node` under nvm prints something under `~/.nvm`, which the
`lolly` user cannot reach, so package-managed Node is the simpler choice here):

```ini
[Unit]
Description=Lolly control plane
After=network.target postgresql.service

[Service]
User=lolly
WorkingDirectory=/opt/lolly-work
Environment=NODE_ENV=production
Environment=PORT=8787
Environment=LW_CONFIG=/opt/lolly-work/instance.json
EnvironmentFile=/etc/lolly-work.secrets
ExecStart=/usr/bin/node server/src/main.ts
Restart=on-failure
# hardening
NoNewPrivileges=true
ProtectSystem=strict
PrivateTmp=yes
ReadWritePaths=/opt/lolly-work

[Install]
WantedBy=multi-user.target
```

Production mode makes the missing-secret check fatal, and `PrivateTmp=yes` is
what gives the service a writable `/tmp` under `ProtectSystem=strict`.

```bash
sudo systemctl daemon-reload && sudo systemctl enable --now lolly-work
curl -s http://localhost:8787/healthz          # "name" must be YOUR instance.name
sudo journalctl -u lolly-work -n 50            # if it did not come up
```

Then the rest of the section 2 ladder, signing in as an address **your** `dev.users` lists, or
through your IdP if you already set `idp.issuer` and turned the dev provider off. The section 2
addresses only exist in the shipped example.

Put TLS (nginx / Caddy) in front, or terminate at your load balancer, and set
`rateLimit.trustedProxyHops: 1` in `instance.json`.

### YunoHost

**Choose Lolly Work for the server features.** Its package repository is
[`lolly-tools/lolly-work_ynh`](https://github.com/lolly-tools/lolly-work_ynh).
The separate `lolly-tools/lolly_ynh` package is the static app and does not provide
Work accounts, shared projects or a database.

The same bare-metal shape, packaged: a [YunoHost](https://yunohost.org) app that
installs the service, its PostgreSQL database and the Lolly web shell on a domain of
its own, and signs members in with the host's accounts. The package is the
`deploy/yunohost/` directory of this repository, mirrored to the
`lolly-tools/lolly-work_ynh` app repository at each release.

For a fresh install, use the exact Work package revision linked from the
[published release](https://github.com/lolly-tools/lolly-work/releases/tag/v1.1.1).
In YunoHost's custom-app installer, paste that `lolly-work_ynh` URL. The equivalent
terminal command is below; replace the placeholder with the published revision:

```bash
sudo yunohost app install https://github.com/lolly-tools/lolly-work_ynh/tree/<published-package-revision>
```

Use a dedicated domain and an existing YunoHost user as the first owner. The
installer fetches the matching Work and web archives and checks both hashes.
Do not substitute the plain `lolly_ynh` URL. The two apps have separate data and
upgrade paths; moving from static Lolly means installing Work separately.

Three questions: the domain (a whole one), the **first owner** (a YunoHost user), and
the instance name. What you get is section 2's "real instance" with every setting
already made:

- `instance.baseUrl` is the domain, `instance.shellDir` is the web shell the package
  installed beside the server, and `instance.pack` starts as that shell's own tool set
  and catalog (the neutral starter brand), copied into the app's data directory so you
  can replace it with your own pack.
- Sign-in is the [reverse-proxy provider](identity.md#reverse-proxy-sign-in): the
  YunoHost portal authenticates, SSOwat attaches the identity headers, nginx adds the
  shared secret, and the server reads the member's groups and this app's role
  permissions from the host's LDAP. The dev provider is off.
- Roles are YunoHost permissions of the app (`owner`, `admin`, `approver`,
  `author`, managed in Users › Groups and permissions), the first owner holds
  `owner`, YunoHost admins start as admins, and every YunoHost group is a group
  here, so overlays and approval chains can target them at once.
- Secrets are generated at install and kept in the app's `.env`; `NODE_ENV` is
  production; `rateLimit.trustedProxyHops` is 1.

The app's config panel changes the access mode, guest links, telemetry level and
whether hooks run in the in-process renderer; the console at `/admin` does the rest.
The package keeps the API, share links, render links and the instance card
reachable for non-browser clients (the `lw` CLI, MCP, SCIM, an open-source Lolly
client connecting to this instance), because the server authenticates those itself.

Qualification is specific to the selected version and architecture. The earlier
1.1.0 beta passed fresh-install, backup/restore and same-version-upgrade checks on
amd64; those results do not qualify 1.1.1 or an upgrade from an older release.
Treat 1.1.1 as an evaluation package until its release records the actual Linux
install/upgrade/backup/restore checks. The
[YunoHost qualification guide](cloud-deployment.md#yunohost-qualification) lists
the required run. Its current package does not provision a Chromium worker;
available exports depend on the installed tool pack and renderer configuration.
Keep an independent protected copy of the YunoHost backup and test restoration,
sign-in, a shared uploaded asset and an invited edit before storing team work.

## 7. Kubernetes (Helm)

![Rancher](img/rancher-icon.svg) ![k3s](img/k3s-icon-color.svg) ![Helm](img/helm-icon-color.svg)

The production path runs on **RKE2 or k3s**, or another conformant cluster.
Work keeps one writable collaboration owner; independent render workers can
scale after workload qualification. Cluster redundancy does not itself provide
application room routing or failover.

Choose **SLES + SUSE Rancher Prime** for its commercial support path or
**openSUSE Leap + Rancher Community** for a community-operated stack. Qualify the
version matrix, infrastructure location and external integrations for your
requirements. See [hosting choices](deployment.md#hosting-and-operating-system-choices)
and the [SUSE deployment runbook](../deploy/suse/README.md).

**The image comes first.** Multi-arch images (amd64 + arm64) publish to
`ghcr.io/lolly-tools/lolly-work-server` and `...-render-worker` on reviewed `v*`
releases. The 1.1.1 packages are public and need no registry credentials. Pin their
qualified digests for production. The commands below also support an operator-owned
registry or disconnected mirror; build a custom image only when needed:

```bash
docker build -f deploy/compose/Dockerfile -t <registry>/lolly-work-server:1.1.1 .
docker push <registry>/lolly-work-server:1.1.1
```

Enabling the chart's optional `renderWorker` tier needs a second image, built the same
way from `workers/render/Dockerfile`.

### 7a. Evaluate on a cluster

**One command** - no Postgres, no IdP, no pack mount:

```bash
helm install lolly-work deploy/helm -f deploy/helm/values-eval.yaml \
  --set image.repository=ghcr.io/lolly-tools/lolly-work-server --set image.tag=1.1.1
```

The release is named `lolly-work` on purpose: Helm prefixes every object with the release
name, so this is what makes the Service `lolly-work` and lets the verification commands
below work unchanged. Name it something else and adjust them to match.

**Verify the eval install.** It is a different instance from section 2 - its own name, its own
personas - so it gets its own ladder rather than a cross-reference. `values-eval.yaml` sets
`instance.baseUrl` to `http://localhost:8787`, which is exactly what the port-forward gives
you, so browser sign-in works too:

```bash
kubectl get pods -l app.kubernetes.io/name=lolly-work        # wait for Running
kubectl port-forward svc/lolly-work 8787:80 &                # Service port is 80, container 8787

curl -s http://localhost:8787/healthz
# {"ok":true,"name":"Lolly Work - evaluation","accessMode":"gated"}

C=$(curl -si 'http://localhost:8787/api/auth/dev?email=owner@eval.example' \
      | grep -i '^set-cookie: lw_session' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1)

curl -s -H "Cookie: $C" http://localhost:8787/api/auth/session
# ..."groups":["owner"],"role":"owner"}}

curl -s -H "Cookie: $C" http://localhost:8787/api/v1/policy/tools
# color-palette, mesh-gradient, qr-code   (the demo pack rides in the image)

curl -s -o out.svg -w '%{http_code} %{content_type}\n' -H "Cookie: $C" \
  'http://localhost:8787/render/qr-code.svg?url=https://suse.com'
# 200 image/svg+xml
```

Then open <http://localhost:8787/admin> in a browser and sign in as `owner@eval.example`.

`values-eval.yaml` ships four dev personas: `owner@eval.example` (group `owner`),
`admin@eval.example`, `brand@eval.example`, `marketer@eval.example`. The addresses in section 2 do
**not** exist here; the dev provider answers `403` to anything outside its own `dev.users`.

**Reaching it over the ingress instead of the port-forward.** The eval ingress is plain
HTTP with an empty host, so `curl` works against the node or load-balancer IP directly -
but browser sign-in and links need `instance.baseUrl` to match. Point it at the real host:

```bash
helm upgrade lolly-work deploy/helm -f deploy/helm/values-eval.yaml \
  --set image.repository=<registry>/lolly-work-server --set image.tag=0.2.0 \
  --set config.instance.baseUrl=http://<node-or-lb-ip>
```

Never point `baseUrl` at an `https:` URL that is not actually served over TLS: the `Secure`
flag is derived from that string, and a browser silently drops a `Secure` cookie sent over
plain HTTP, so sign-in loops back to the gate forever while `curl` still works.

### Moving from evaluation to production

Adding `DATABASE_URL` only changes storage for future writes. It does not copy
the running memory store's projects, sessions or other records into PostgreSQL.
Do not use `values-eval.yaml` for a real team: it retains passwordless personas,
known evaluation signing secrets and evaluation mode, even with a database.

Prepare a separate production release using section 7b and fresh reviewed
environment values. Set `deployment.mode: production`, turn development sign-in
off, register the real identity provider and first owner, use new stable signing
keys from an existing Secret, and configure the durable database, migration Job,
canonical HTTPS URL, ingress/TLS and matching shell/pack. Keep one collaboration
owner. An existing evaluation namespace/release needs an explicit reviewed
transition, not a database-only upgrade or reused evaluation values. This guide
does not provide an automatic memory-to-PostgreSQL content migration.

### 7b. Production

For production, start from the chart defaults and keep your overrides in a
reviewed environment file; do not edit or merge `values-eval.yaml`. Existing
K3s/RKE2/Rancher platforms keep their normal cluster lifecycle. Select the exact
kubeconfig, context and namespace for every Helm/kubectl command below; the
examples assume you have selected that reviewed destination.

Author `instance.json` first (section 2), with `deployment.mode: production`,
`dev.enabled: false`, a real `idp.issuer` and `instance.baseUrl` matching
the ingress host - the pods refuse to start on a gated instance with neither an issuer nor
the dev provider:

```bash
kubectl create secret generic lolly-work-secrets \
  --from-literal=DATABASE_URL=postgres://... \
  --from-literal=LW_SESSION_SECRET="$(openssl rand -hex 32)" \
  --from-literal=LW_LINK_SECRET="$(openssl rand -hex 32)"

helm install lolly-work deploy/helm \
  -f /path/to/reviewed-production-values.yaml \
  --set image.repository=<registry>/lolly-work-server --set image.digest=sha256:<qualified-digest> \
  --set existingSecret=lolly-work-secrets \
  --set migrate.enabled=true \
  --set-file config=instance.json
```

Migrations run as a pre-install/upgrade Job; the pack and shell mount as volumes; a
`ServiceMonitor`, `NetworkPolicy`, ingress and an optional Chromium render-worker tier ship
in the chart. Values reference and the per-key notes:
[deployment](deployment.md#kubernetes-helm---the-production-path).

The reviewed environment file supplies ingress/TLS, image-pull credentials and
the shell/pack delivery appropriate to a full workspace or deliberate API-only
instance. Use the [small SUSE profile](../deploy/helm/SMALL-SUSE.md) for bounded
resource defaults, not as a complete identity, database or content configuration.
Use your platform's Secret provisioning for credentials; keep Secret values out
of configuration files and release records.

Verify it, remembering that this instance is **your** `instance.json`, so its name, its
personas and its sign-in provider are the ones you authored in section 2:

```bash
kubectl get pods -l app.kubernetes.io/name=lolly-work        # wait for Running
kubectl logs job/lolly-work-migrate                          # the schema Job must have succeeded
kubectl port-forward svc/lolly-work 8787:80 &                # Service port is 80, container 8787
curl -s http://localhost:8787/healthz                        # your instance.name, accessMode gated
curl -s http://localhost:8787/readyz                         # actual store/deployment readiness
```

`8787:80` is not a typo: `service.port` is `80` and `targetPort` is the container's `8787`.
`kubectl port-forward` resolves the remote number against the **Service's** ports, so
`8787:8787` fails with `Service lolly-work does not have a service port 8787`.

With `dev.enabled: false` (which section 2 told you to set before exposing anything) there is no
`/api/auth/dev` here: sign in through your IdP at `https://<your-host>/admin`. The first
owner arrives the SSO way, from the table in section 2.

Before accepting the instance, test real HTTPS sign-in, a viewer/editor invitation,
an uploaded asset on another device, editing/reconnect, delegated-agent permissions
and the exports you enable. Restore an independent backup into a separate target
and repeat those checks. See [operations](operations.md#backup-and-restore) for
backup coverage. Later image-only releases use the
[guarded application update workflow](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/APP-UPDATES.md);
database migrations and infrastructure/content changes remain separate operations.

### 7c. Published chart repository and Rancher

After the first successful chart publication, confirm the public `index.yaml` at
the URL in [official installations](official-installations.md). Add that HTTP
repository and select an exact chart version:

```bash
helm repo add lolly-work https://github.com/lolly-tools/lolly-work/releases/download/helm-index
helm repo update lolly-work
helm show chart lolly-work/lolly-work --version 0.3.2
```

In the production recipe above, replace the local `deploy/helm` chart argument
with `lolly-work/lolly-work --version 0.3.2`; keep your reviewed values, configuration
and stable Secret references. Verify the chart's Sigstore bundle and source record
as described in the installation directory before applying the package.

In Rancher, add the same HTTP URL under **Apps > Repositories**. Choose Lolly Work
and the reviewed version. The form collects connection settings; review the full
YAML for TLS, PostgreSQL, identity admission/owner mapping and shell/pack mounts.
Adding our repository does not add Lolly to a built-in Rancher catalogue.

## 8. The CLI

Every governance action the console does is scriptable. From a checkout:

```bash
pnpm run cli                                      # the command list
pnpm run cli login --email owner@example.test --base http://localhost:8787
pnpm run cli whoami --base http://localhost:8787
```

`login` first: everything else needs a session, stored at
`~/.config/lolly-work/session`. `--base` (or `LW_BASE`) identifies the instance; it defaults to
`http://localhost:8787`. On an OIDC instance plain `lw login` runs a device-code flow:
open the printed URL in any signed-in browser and confirm the short code there.
`lw login --cookie 'lw_session=...'` is the manual fallback.

To get a real `lw` command instead of `pnpm run cli --`, link the checkout once:

```bash
npm link            # puts `lw` on PATH
lw whoami
```

Useful first commands, all verified against a fresh instance:

```bash
lw export --out governance.json   # snapshot grants/overlays/chains/providers/flags
lw audit head                     # the hash-chain head, and whether it is intact
lw preview --groups admin         # exactly what a member in those groups receives
```

A fresh deploy can come up **already governed** by seeding that snapshot. The seed path is
trusted, so it can grant owner-only actions before anyone signs in:

```bash
LW_SEED_CONFIG=./governance.json npm start       # idempotent
```

Full command reference: [cli](cli.md).

## 9. Connect a source

The last leg. A deploy with no catalog source serves only what its pack ships; connecting
one is what makes it *your* instance. Every kind follows the same six steps, and the whole
sequence is **owner-only** (`catalog.provider.credential` and `catalog.provider.publish`),
so do section 2's "The first owner" before you start.

**Rehearse it once with no account anywhere.** The `mock` kind takes its assets straight
from `--options`, so these commands run against a fresh instance with no network, no
vendor and no credentials. Run them, watch each step answer, then swap the kind.

```bash
export LW_BASE=http://localhost:8787            # or your instance URL
lw login --email owner@example.test              # the owner from section 2

OPTS='{"assets":[
  {"remoteId":"a1","name":"Hero banner","nativeType":"image",
   "sections":["Campaigns"],"tags":["hero"],
   "formats":[{"format":"png","remoteRef":"orig","filename":"hero.png"}]},
  {"remoteId":"a2","name":"Logo mark","nativeType":"image",
   "sections":["Brand"],"tags":["logo"],
   "formats":[{"format":"svg","remoteRef":"orig","filename":"logo.svg"}]}]}'

lw providers preview --kind mock --options "$OPTS"   # 1. dry run: nothing is stored
lw providers add rehearsal --kind mock --label "Rehearsal source" --options "$OPTS"
lw providers enable rehearsal                        # 3. owner-only
lw providers sync rehearsal                          # 4. "synced rehearsal: 2 assets"
lw providers health rehearsal                        # 5. "ok"
```

`preview` prompts for a credential before it runs. `mock` needs none, so press Enter at the
prompt. A provider is always **born disabled**: `add` prints
`created rehearsal (disabled ...)`, and enabling is its own audited action.

Step 6 is the verification, and it is the one that proves the federation actually reached
the catalog. Federated ids are namespaced `ext/<provider-id>/<remote-id>`:

```bash
C=$(curl -si "$LW_BASE/api/auth/dev?email=owner@example.test" \
      | grep -i '^set-cookie: lw_session' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1)
curl -s -H "Cookie: $C" "$LW_BASE/api/v1/catalog/search?q=hero"
# {"q":"hero","results":[{"id":"ext/rehearsal/a1","name":"Hero banner",...}]}
```

Tear the rehearsal down when you are done. Deletion refuses on an enabled provider
(`409 PROVIDER_ENABLED`), so it is two steps:

```bash
lw providers disable rehearsal && lw providers rm rehearsal
```

### Now the real one

Same six steps, two differences: the kind, and a credential between `add` and `enable`.

```bash
lw providers preview --kind <kind> --options '{...}'   # confirm the tenant answers first
lw providers add <id> --kind <kind> --label "..." --options '{...}'
lw providers credential <id>          # prompts; never passed on argv, sealed at rest
lw providers enable <id>
lw providers sync <id> && lw providers health <id>
```

**What `--options` must contain is per platform**, and so is where the credential comes
from. One guide per kind, each written for the owner of the source platform: WebDAV
(Nextcloud / ownCloud), Brandfolder, S3 / MinIO, git manifest, Optimizely CMP, Image
Relay, Canto, Acquia DAM / Widen, IntelligenceBank, Penpot, Dropbox, Google Drive,
Microsoft 365. Start at
[the provider guides](providers/README.md) and pick yours. Some OAuth kinds
(`dropbox`, `gdrive`, `o365`) replace the `credential` prompt with
`lw providers auth <id>`, a PKCE loopback consent flow.

Console equivalent of all of the above: **This Deploy → Providers**. Exposure governance
(which groups see a source, approved-only, reference vs downloadable) is a separate
decision on the same record: [catalog](catalog.md).

## 10. Official neutral package

The [official installation directory](official-installations.md) identifies the
upstream sources, publication status and qualified architectures. This package
combines the published Work server, matched neutral web shell, durable PostgreSQL
and same-origin HTTPS. It is intended for a fresh VM or private server; it includes
no private brand pack or production-instance configuration.

### Prepare a fresh VM or UpCloud reference

For UpCloud, use the [infrastructure module](../deploy/upcloud/README.md) with your
reviewed image, region, administrator keys/CIDRs and measured network settings.
Validate the plan before applying through your own infrastructure process. Follow
the [openSUSE host preparation](../deploy/vm/README.md) for Docker and host security
on an openSUSE target. The [reference qualification](../deploy/marketplaces/QUALIFICATION.md)
also covers UpCloud's public Ubuntu 24.04 amd64 image. On that image, install its
Docker packages and enable the daemon:

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 ca-certificates
sudo systemctl enable --now docker
sudo docker compose version
```

Use an account authorized to run Docker; prefix subsequent Docker commands with
`sudo` if needed. Configure a stateful host firewall as well as UpCloud's stateless
firewall, keeping SSH restricted to the actual administrator networks. The neutral
package also works on another qualified Docker Compose host. No existing Lolly
production instance is a qualification target.

Prepare a domain that points to the new host and allows TCP 80 and TCP/UDP 443.
Keep Work, PostgreSQL and worker ports private. Select the actual owner email.
The default uses built-in email/password sign-in with a host-issued setup link;
no external identity account or mail service is required. The initial
policy admits that address and invitations, with explicit privileged-role mapping.
Set other admission/role rules through an operator-reviewed configuration later.

From the source checkout on your workstation, install its dependencies and create
a new private installation directory:

```bash
pnpm install --frozen-lockfile
node scripts/prepare-marketplace-instance.ts \
  --out ../my-lolly-work \
  --domain work.example.com \
  --owner owner@example.com
```

For organisation SSO instead, register an OIDC client with callback
`https://YOUR_DOMAIN/api/auth/callback` and add `--auth oidc --issuer HTTPS_ISSUER
--client REGISTERED_CLIENT_ID` to that command. The owner email must be verified
by that provider. If the client needs a secret, provide `LW_IDP_CLIENT_SECRET`
through your workstation's secret environment; keep it out of command arguments.

The directory contains `compose.yaml`, `Caddyfile`, the exact release record and a
mode-0600 `.env` with fresh database/session/link/credential secrets. Copy it
securely to a dedicated private directory on the new host, preserving `.env`
permissions. Keep its name and Compose project name stable. Never regenerate
`.env` over an installed instance. Use a durable location such as `/srv/lolly-work`;
temporary directories such as `/tmp` can be cleared on reboot and break bind mounts.

On that host, from the prepared directory:

```bash
docker compose --project-name lolly-work up -d
docker compose --project-name lolly-work ps
curl --fail https://work.example.com/healthz
```

Initialisation downloads a 724 MB archive, verifies its full checksum, extracts the
matched shell/neutral pack to disk and creates a persistent catalogue-signing key.
Allow at least 6 GB free for extraction, copied content and container layers, plus
database growth, backups and retained releases. It streams the download to disk;
the archive is not held in container memory. Slow initial downloads can take
several minutes. Caddy obtains HTTPS only after DNS and the challenge route work.

For built-in sign-in, issue the named owner's one-time setup link from that same
directory:

```bash
docker compose --project-name lolly-work exec server \
  node scripts/password-link.ts --email owner@example.com
```

Deliver the link privately to the owner, who sets their password before signing
in. It works once, expires after seven days and sends no email. This is an
operator-authorized account; the link does not prove mailbox ownership. Other
members receive invitations and password links through **People**. See
[identity](identity.md) for setup, recovery and optional SSO.

Open `/admin`, sign in and confirm the expected owner role in **Customer setup**.
Open Lolly at `/`, create and save a project, reload it,
invite a second member and verify a checked output. Confirm an unauthenticated
request cannot fetch the gated catalogue/private project. Restart Work and verify
the saved content and both users again. A healthy API alone does not finish this
acceptance. Record architecture, source/digests, host/network facts and the results.

The default has no Chromium worker and makes no server-rendering promise for
hooked tools. Telemetry, guest links and nearby discovery are off. Models load
from `lolli.li` when needed, so this initial package is not a disconnected bundle.
Configuration is stored in the private `state` volume after first boot; console
changes survive restarts. The domain/identity environment values seed that first
configuration. For an existing instance, change its stored configuration rather
than expecting new environment defaults to replace operator settings.

### Dokploy

Use the [upstream blueprint and import instructions](../deploy/dokploy/README.md).
Before deploying, set the real domain and owner in the imported environment.
Built-in sign-in is the default; issue the owner's setup link in Dokploy's server
terminal using `node scripts/password-link.ts --email OWNER_EMAIL`. For SSO, set
`LOLLY_AUTH_MODE=oidc` and the OIDC issuer/client, plus its secret if required.
Retain the generated database/session/link/credential secrets.
Dokploy supplies HTTPS and proxy routing; the template exposes no host ports and
adds no Caddy container. Perform the same owner/member, private-access, persistence,
upgrade and restore checks as for the VM. Catalogue admission remains pending
until a tested submission is accepted.

### Backup, restore and update

Keep an encrypted independent copy of `.env`, configuration and the catalogue key volume and the
release record, plus verified PostgreSQL backups. From this package's directory,
the following creates new private backup files; choose unused filenames:

```bash
umask 077
set -o noclobber
docker compose --project-name lolly-work exec -T db \
  pg_dump -U lolly -d lollywork --format=custom --no-owner --no-privileges > work-backup.dump
docker compose --project-name lolly-work run --rm --no-deps --user 1000:1000 content \
  tar -czf - -C / keys state > work-state.tar.gz
sha256sum work-backup.dump work-state.tar.gz > work-backup.sha256
sha256sum work-backup.dump | cut -d ' ' -f1 > work-backup.dump.sha256
```

Copy those files, both checksum files and `.env` to independent protected storage. Check the hashes and
restore the dump into a newly created empty database on an isolated recovery
target with PostgreSQL 17 client tools. The maintained
[`postgres-backup.sh`](../deploy/vm/postgres-backup.sh) refuses existing objects and
requires an exact database confirmation. Verify application records, signing-key
continuity and owner/member access on the restored target before treating the
backup as accepted. Archive readability alone does not prove recovery.

For an upgrade, compare the new generated Compose/release files with the installed
ones. Keep the existing `.env`, Compose project name, `pgdata`, `state` and `keys` volumes;
retain previous content. After backup and the independent restore pass, replace
only the reviewed package files, pull pinned images and run `up -d` with the same
project name. Compose reruns changed content initialisation before starting the
new server. Verify migrations, owner/member sign-in, saved projects, private-access
denial and output. Keep the prior release's image/content/configuration references.
PostgreSQL major changes need a separate migration. Never use `down --volumes` on
an installed instance or rely on an image downgrade to reverse database changes.

## Checks

```bash
pnpm test           # node:test over tests/ (Postgres leg runs when LW_TEST_DATABASE_URL is set)
pnpm run typecheck  # tsc --noEmit
pnpm run sbom       # regenerate sbom.cdx.json
```

## What next

- **Configuration** - every key: [configuration](configuration.md)
- **Identity / SSO** - wiring your OIDC issuer: [identity](identity.md)
- **Deployment shapes** - the full matrix, RKE2/k3s, air-gap: [deployment](deployment.md)
- **Operations** - migrations, scaling, backups: [operations](operations.md)
- **Connecting a DAM** - the governance around what section 9 connected: [catalog](catalog.md)
- **Per-platform setup** - one guide per provider kind: [provider guides](providers/README.md)
