# Install the ready-made package

The ready-made package is the shortest route to a shared Lolly Work instance on one
Linux server. One command on your workstation writes a private installation
folder. Copy it to the server and run `docker compose up`. You then have Lolly Work,
PostgreSQL, the matching Lolly web app and automatic HTTPS, with email and password
sign-in for the first owner.

It suits a fresh VM, an UpCloud server, a private server or a Dokploy host. It
carries no private brand pack and no production-instance configuration.

The package pins Lolly Work 1.1.3 and the matching Lolly 1.1.3 web app. The web app has the
publisher's catalogue key built in, while Lolly Work signs each person's catalogue with a key
this installation creates. On first start, setup gives the installed web app the
installation's key instead, so a signed-in browser lists the tools. Before this step
the web app refused the catalogue and showed no tools.

Which upstream sources the package uses, which release it pins today and which
architectures have passed is in [official installation routes](official-installations.md).

**What you'll do**, in five steps:

::: steps
- <!--i:eti-checklist--> **[Prepare the server](#prepare-the-server)** A Linux host with Docker Compose, and a domain that points to the host.
- <!--i:eti-folder-plus--> **[Write the folder](#write-the-installation-folder)** One command on your workstation, then copy the folder across.
- <!--i:eti-package--> **[Start the instance](#start-the-instance)** `docker compose up`, with HTTPS once DNS works.
- <!--i:eti-user-check--> **[Sign in](#sign-in-as-the-first-owner)** The first owner, through a one-time setup link.
- <!--i:eti-badge-check--> **[Accept the instance](#accept-the-instance)** Owner, members, privacy and a restart, before anyone stores work.
:::

<!--i:eti-checklist-->
## Prepare the server

You need a Linux host that runs Docker Compose and a domain that points to it, with
TCP 80 and TCP and UDP 443 open. Keep the Lolly Work, PostgreSQL and worker ports private.
No existing Lolly production instance is a qualification target.

For UpCloud, use the [infrastructure module](../deploy/upcloud/README.md) with your
reviewed image, region, administrator keys, address ranges and measured network
settings. Check the plan before applying it through your own infrastructure process.
On an openSUSE host, follow the [openSUSE host preparation](../deploy/vm/README.md)
for Docker and host security.

The [reference qualification](../deploy/marketplaces/QUALIFICATION.md) also covers
UpCloud's public Ubuntu 24.04 amd64 image. On that image, install and start
Docker:

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-v2 ca-certificates
sudo systemctl enable --now docker
sudo docker compose version
```

Use an account allowed to run Docker, or prefix later Docker commands with `sudo`.
Configure a stateful host firewall as well as UpCloud's stateless one, and keep SSH
limited to your actual administrator networks.

**Check the host's MTU first.** Some clouds run their machines on an overlay network whose
interface MTU is below 1500. Docker's bridges default to 1500, so large TLS downloads from
inside a container stall while the same download from the host works, and the first
start's archive download hangs. Check the MTU of the host's main interface with `ip link`.

::: details When the MTU is below 1500
Give Docker the same value before the first start, in `/etc/docker/daemon.json`, merged
into any settings already there:

```json
{ "mtu": 1450, "default-network-opts": { "bridge": { "com.docker.network.driver.mtu": "1450" } } }
```

Use your interface's value in place of 1450, then run `sudo systemctl restart docker`.
The first key covers Docker's default bridge and the second covers the network
Compose creates for the instance.
:::

<!--i:eti-folder-plus-->
## Write the installation folder

Choose the owner's email. By default the package uses built-in email and password
sign-in with a setup link the host issues, so you need no external identity account
or mail service. The first policy admits that address and invitations, with explicit
privileged-role mapping; change admission and role rules later through a reviewed
configuration.

From a checkout of the Lolly Work release on your workstation, with Git, Node 24 and pnpm
as in [Install Lolly Work, section 1](install.md#1-try-it-on-your-computer):

```bash
pnpm install --frozen-lockfile
node scripts/prepare-marketplace-instance.ts \
  --out ../my-lolly-work \
  --domain work.example.com \
  --owner owner@example.com
```

For organisation single sign-on instead, register an OIDC client with the callback
`https://YOUR_DOMAIN/api/auth/callback` and add
`--auth oidc --issuer HTTPS_ISSUER --client REGISTERED_CLIENT_ID` to that command.
The provider must verify the owner's email. If the client needs a secret, provide
`LW_IDP_CLIENT_SECRET` through your workstation's secret environment, never as a
command argument.

The folder holds `compose.yaml`, a `Caddyfile`, the exact release record and a
mode-0600 `.env` with fresh database, session, link and credential secrets.

- Copy it securely to a dedicated private folder on the server, keeping the `.env`
  permissions.
- Use a durable location such as `/srv/lolly-work`. Temporary folders such as `/tmp`
  can be cleared on reboot and break the mounts.
- Keep the folder name and Compose project name the same from now on.

::: warning Never write a new `.env` over an installed instance
It holds the secrets the instance already uses. Keep the one you installed with.
:::

<!--i:eti-package-->
## Start the instance

On the server, from the installation folder:

```bash
docker compose --project-name lolly-work up -d
docker compose --project-name lolly-work ps
curl --fail https://work.example.com/healthz
```

The first start downloads a 752 MB archive, checks its full checksum, extracts the
matching web app and neutral pack to disk, creates a persistent catalogue-signing
key and gives the web app that key. The download streams to disk rather than into container
memory, and a slow one can take several minutes. Allow at least 6 GB free for
extraction, copied content and container layers, plus room for database growth,
backups and kept releases. Caddy gets its HTTPS certificate once DNS and the
challenge route work.

<!--i:eti-user-check-->
## Sign in as the first owner

For built-in sign-in, issue the owner's one-time setup link from the same folder:

```bash
docker compose --project-name lolly-work exec server \
  node scripts/password-link.ts --email owner@example.com
```

Give the link to the owner privately. They set their password before signing in.
The link works once, expires after seven days and sends no email.

::: note The link does not prove the mailbox
It is an operator-authorised account, not a check that the owner controls that mailbox.
:::
 Other members get invitations and password links through **People**. See
[identity](identity.md) for setup, recovery and optional single sign-on.

<!--i:eti-badge-check-->
## Accept the instance

A healthy API alone does not finish the job. Before anyone stores work:

::: timeline
- <!--i:usercheck--> **Owner.** Open `/admin`, sign in and confirm the owner role in **Customer setup**.
- <!--i:monitor--> **The web app.** Sign in at the instance's address and check that the gallery lists the tools.
- <!--i:folder--> **A project.** Create and save a project, then reload the page and open the project again.
- <!--i:people--> **A member.** Invite a second member and check a sample output.
- <!--i:lock--> **Privacy.** Confirm a request that is not signed in cannot fetch the gated catalogue or a private project.
- <!--i:clock--> **A restart.** Restart Lolly Work and check the saved content and both people again.
- <!--i:document--> **A record.** Write down the architecture, source and digests, host and network facts and the results.
:::

<!--i:eti-sliders-->
## What the defaults are

- No Chromium render worker, and no promise to render tools with scripts on the
  server.
- Telemetry, guest links and nearby discovery are off.
- Models load from `lolli.li` when someone uses a model feature, so this package is
  not a disconnected bundle.
- After the first start, configuration lives in the private `state` volume, and
  console changes survive restarts. The domain and identity environment values only
  seed that first configuration: on an existing instance, change the stored
  configuration rather than expecting new environment defaults to replace the stored settings.

<!--i:eti-grid-->
## Dokploy

Use the [upstream blueprint and import instructions](../deploy/dokploy/README.md).
Before deploying, set the real domain and owner in the imported environment.

- Built-in sign-in is the default. Issue the owner's setup link in Dokploy's server
  terminal with `node scripts/password-link.ts --email OWNER_EMAIL`.
- For single sign-on, set `LOLLY_AUTH_MODE=oidc` and the OIDC issuer and client, plus
  its secret if it needs one.
- Keep the generated database, session, link and credential secrets.

Dokploy supplies HTTPS and routing; the template opens no host ports and adds no
Caddy container. Run the same owner, member, privacy, persistence, upgrade and
restore checks as for a VM. Admission to Dokploy's catalogue stays pending until a
tested submission is accepted.

<!--i:eti-layers-->
## Coolify

Use the [project-owned Compose recipe](../deploy/coolify/README.md): in Coolify, add a
**Docker Compose Empty** resource and paste `deploy/coolify/lolly-work/docker-compose.yml`.

- Set the `server` component's domain to your HTTPS address and set
  `LOLLY_OWNER_EMAIL`. The recipe derives `LOLLY_DOMAIN` from that domain.
- Built-in sign-in is the default. Issue the owner's setup link in the `server`
  component's terminal with `node scripts/password-link.ts --email OWNER_EMAIL`. For
  single sign-on, set `LOLLY_AUTH_MODE=oidc` and the OIDC issuer and client.
- Coolify generates the database, session, link and credential secrets and keeps them
  across deployments. Keep them.

Coolify's proxy supplies HTTPS, routing and WebSockets; the recipe opens no host ports
and adds no Caddy container. A Coolify service is a copy of the pasted file, so a new
release reaches it only when you copy the changed image pins and release values into
its Source Compose and redeploy; never create a second service in its place.

::: note Not yet run on a live Coolify
This route has not been imported into a running Coolify, and it is not in Coolify's
one-click catalogue, which this project does not qualify for yet.
:::

<!--i:eti-history-->
## Back up, restore and update

Keep an encrypted independent copy of `.env`, the configuration, the catalogue key
volume and the release record, plus verified PostgreSQL backups. From the
installation folder, this writes new private backup files, so pick new file names
each time:

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

Copy those files, both checksum files and `.env` to independent protected storage.
To prove the backup, check the hashes and restore the dump into a new, empty database
on an isolated recovery target with PostgreSQL 17 client tools. The maintained
[`postgres-backup.sh`](../deploy/vm/postgres-backup.sh) refuses existing objects and
asks you to confirm the exact database. Check application records, signing-key
continuity and owner and member access on the restored target before you count the
backup as good. A readable archive does not prove recovery.

**To update**, take a backup and pass the independent restore first. Then:

1. Compare the newly generated Compose and release files with the installed ones.
2. Keep the existing `.env`, Compose project name and the `pgdata`, `state` and `keys`
   volumes, and keep the previous content.
3. Replace only the reviewed package files, pull the pinned images and run `up -d`
   with the same project name. Compose reruns changed content setup before it starts
   the new server.
4. Check migrations, owner and member sign-in, saved projects, the privacy refusal
   and output. Keep the previous release's image, content and configuration
   references.

A PostgreSQL major version change needs its own migration.

::: warning Never run `down --volumes` on an installed instance
It deletes the `pgdata`, `state` and `keys` volumes. Do not count on an image downgrade to reverse
database changes either.
:::

General backup coverage is in
[keep Lolly Work running](operations.md#backup-and-restore).
