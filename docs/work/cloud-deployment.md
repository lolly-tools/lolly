# Run Lolly Work on UpCloud or Evroc

UpCloud and Evroc are the two European clouds the Work repository has infrastructure
modules for. The modules in `deploy/upcloud/` and `deploy/evroc/` create the virtual
machine, disk, address and firewall with OpenTofu or Terraform, so a new host is
repeatable. They create no database and do not move an existing deployment.

Once the machine exists, Work runs on it the same way it runs anywhere: a Node server,
PostgreSQL and a reverse proxy, with the render worker as a separate container that has
its own resources and render credential. Pick the install path at
[Run Lolly Work](self-host.md); the [ready-made package](ready-made-package.md) has an
UpCloud reference qualification.

## What the modules give you

| Part | Supported today | Still to qualify before a new deployment |
|---|---|---|
| UpCloud VM and firewall | A module pinned to the provider version; mocked plans under both tools | A qualified image, zone and plan availability, boot and capacity |
| Evroc VM, disk, public address and security group | The official provider, pinned; mocked plans under both tools | A qualified image and SSH user, project, region and profile availability, boot and capacity |
| Private Lolly Work | Compose, openSUSE provisioning, a signed web app mount, WebSockets | Instance configuration, owner sign-in, source access and shared editing |
| PostgreSQL | An outside connection by default; an opt-in Compose database | A restore rehearsal, a maintenance cutover and independent backups |
| Render worker | An image built in the repository, with its own secret and resources | A real document render through the chosen web app address |

Use the [UpCloud runbook](../deploy/upcloud/README.md) or
[Evroc runbook](../deploy/evroc/README.md) to validate without credentials and create
the VM, then the [VM runbook](../deploy/vm/README.md) for the application release.
YunoHost's package status is in [official installation routes](official-installations.md).

Kubernetes works on either cloud too: [Install on Kubernetes](platform-deployment.md)
covers K3s and RKE2, and the
[SUSE deployment runbook](../deploy/suse/README.md) covers a small K3s profile, RKE2 for
larger needs, provider storage and Longhorn for qualified multi-node storage. A cluster
still uses the underlying VM or bare-metal capacity: sharing services on it reduces
separate guest and service overhead, but not the cloud's compute charges.

## How the two providers differ

| Contract | UpCloud | Evroc |
|---|---|---|
| Authentication | Provider environment, such as `UPCLOUD_TOKEN` | Existing SDK login configuration or a service-account environment |
| Operating-system image | An explicit template UUID; the existing bootstrap kit is UpCloud-specific | An explicit disk image; the project inventory and cloud-init must be qualified |
| Host preparation | The existing openSUSE provisioning kit | The same kit, only for a qualified openSUSE image; another OS needs equivalent preparation |
| Public network | One public IPv4 interface; cloud firewall | A separate public IPv4 plus a dual-stack VM; a custom security group only |
| SSH | Key-only image account and administrator address ranges | Complete non-root, key-only user data and administrator address ranges; no broad default SSH group |
| Root disk | 80 GB by default, encrypted storage flag, protected VM | 80 GB by default, protected disk, VM and address; no encryption field in the provider schema |
| Database | Managed PostgreSQL is available; a local database is opt-in | A reviewed outside PostgreSQL or the opt-in local database; no managed product assumed |
| Object storage | Qualify bucket access, recovery and endpoint behaviour | Qualify the documented S3 feature compatibility, bucket access and recovery |
| Application release | Signed web app, configured Work, worker and relay, database migrations, smoke checks | The same files, configuration, migration and acceptance contracts |

A provider mock checks configuration against the schema; it cannot prove an image is
available, or quota, compliance or performance. Both targets need real boot, SSH and
reboot, host security, capacity and recovery checks before production. The openSUSE
`provision.sh` does not support Ubuntu, so read the target runbook before choosing an
image.

Keep public and private apart on either provider. Public APIs must not publish private
packs, uploaded assets or member cookies, and the public CA, MCP and Penpot containers
receive no private Work secrets.

## Custom instance domain

The [VM kit's custom-domain procedure](../deploy/vm/README.md#custom-instance-domains)
takes the host name from a validated HTTPS `instance.baseUrl`. Both providers use the
same generated Caddy configuration and application release. A custom domain gets only
the redirect aliases you ask for, and the smoke check can test a configured non-Google
sign-in provider and its callback. The managed worker's `LOLLY_WEB_BASE` is set in the
private environment and must match that address before the worker starts.

The openSUSE kit keeps its existing compatible paths, and its pack builder still selects
the SUSE profile by default, so point it at your own pack. With another operating
system, brand or extra Compose files, use the matching host preparation and the complete
list of release files. Generating a host name does not register an OIDC client or move
DNS. Keep real image, SSH, reboot, owner sign-in, shared editing and export checks as the
acceptance gates.

## Move a PostgreSQL database

Choose managed PostgreSQL when its operations, availability and recovery policy fit.
[UpCloud's managed database service](https://upcloud.com/global/products/managed-databases/)
offers PostgreSQL with backup options; price the actual database, storage and backups
before you create one. On Evroc, use a reviewed outside service or the local option;
no managed PostgreSQL product is assumed.

**The local option** is `deploy/vm/postgres.compose.yml`. It keeps PostgreSQL inside the
Compose network, in a named volume, publishes no port, and waits for readiness before
the server starts. It is not part of the default deployment. Its password must be safe
in a URL, because the connection URL is built from it: generate a random hexadecimal
password and store it as `LW_LOCAL_PG_PASSWORD` in the existing private `.env`, keeping
every other secret.

**Before a migration**, use PostgreSQL client tools at least as new as the source server.
Keep credentials in a mode-0600 libpq service and password file, never in a command
argument. For example, `~/.pg_service.conf` can define `lolly-source` and `lolly-target`
with host, port, database, user and TLS mode, and `PGPASSFILE` points at the separate
password file; PostgreSQL documents the
[password-file permissions](https://www.postgresql.org/docs/17/libpq-pgpass.html).

The move, in order:

::: timeline
- <!--i:database--> **Rehearse first.** Run the whole move against a separate database before the real one.
- <!--i:download--> **Dump.** The helper writes a custom-format dump and a matching SHA-256 file, both owner-only.
- <!--i:check--> **Check the dump.** `verify` reads the dump back, so you know the file is sound.
- <!--i:pause--> **Stop the writers.** For the final dump, stop the server and every other writer, and wait for the collaboration drain.
- <!--i:upload--> **Restore into an empty target.** The helper refuses a database that already has user schemas or objects.
- <!--i:layers--> **Migrate the target.** Run migrations against the restored database.
- <!--i:people--> **Accept.** Check people, projects, assets, sources, agents, audit and exports on the target.
- <!--i:lock--> **Keep the source.** Leave the original database in place until acceptance and a rollback rehearsal pass.
:::

```sh
PGSERVICE=lolly-source deploy/vm/postgres-backup.sh backup /private/backups/lolly.dump
deploy/vm/postgres-backup.sh verify /private/backups/lolly.dump
PGSERVICE=lolly-target deploy/vm/postgres-backup.sh restore /private/backups/lolly.dump \
  --confirm-database lollywork
```

The helper refuses an existing destination file and removes unfinished temporary files
after a failed dump. Restore checks the name of the database it is actually connected
to, refuses existing user schemas or objects, restores in one transaction and never
drops anything. The database name may contain letters, digits, underscores or hyphens.
The checksum detects corruption, so store the archive and checksum together in
protected, independent storage. This is a logical database backup, not a backup of the
host or of outside object storage. See PostgreSQL's
[dump](https://www.postgresql.org/docs/17/app-pgdump.html) and
[restore](https://www.postgresql.org/docs/17/app-pgrestore.html) documentation.

::: details Restoring into the local Compose database
Stage the override and `postgres-backup.sh` beside the existing base Compose file, then
start **only** the database, keeping the project's existing Compose name:

```sh
docker compose -f docker-compose.yml -f postgres.compose.yml up -d db
```

Keep the server on its existing database during the rehearsal. To restore, copy the
checked archive and checksum into the database container's temporary folder and run the
same helper with the container's client tools. Use the same complete Compose file list
and project name in every command:

```sh
docker compose -f docker-compose.yml -f postgres.compose.yml cp /private/backups/lolly.dump db:/tmp/lolly.dump
docker compose -f docker-compose.yml -f postgres.compose.yml cp /private/backups/lolly.dump.sha256 db:/tmp/lolly.dump.sha256
docker compose -f docker-compose.yml -f postgres.compose.yml exec -T db bash -c \
  'export PGHOST=127.0.0.1 PGDATABASE="$POSTGRES_DB" PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD"; bash -s -- restore /tmp/lolly.dump --confirm-database "$POSTGRES_DB"' \
  < postgres-backup.sh
```

The password stays inside the database container. Remove the temporary archive copies
after you record the result, and keep the independent backup.

Add the override to the complete Compose file list only for the reviewed server cutover.
Later deployments must use that same file list; the existing `push.sh` base-only path
does not manage this optional database. Keep the render and relay overlays in place.
:::

For managed PostgreSQL, use its reviewed TLS connection or a temporary tunnel you
control; never add a public PostgreSQL port for the helper.

**Accepting the target** means checking owners and project memberships, session
revisions, uploaded asset bytes on another device, sealed source credentials,
Brandfolder queries, agent grants and activity, audit continuity and real exports.
After writes resume on the target, rolling back means reconciling those writes:
changing the URL alone would throw them away.

Alongside the dump, keep `instance.json`, the governance export, the signing keys, the
session, link and credential-sealing secrets, the exact application and web app
versions, source settings and independently kept audit heads. With the default `pg`
asset driver the database includes uploaded asset bytes; with `s3`, back up the bucket
and its versions separately. See [backup and restore](operations.md#backup-and-restore).

## What your instance serves at /info

A Work instance that serves a signed web app also serves that web app's public
documentation, ahead of the app itself, on either provider. Work answers `/info/`,
literal `/info/` articles, `/docs` aliases, `/robots.txt` and the sitemap, and also
offers article addresses without the `.html` extension. It serves only files inside the
signed release, unchanged, and a missing article returns 404 rather than an app page
with a success status.

::: details What to check before accepting a release
HEAD returns the same public headers and file size as GET, without the body. The root
`/robots.txt` uses the release's `robots-lolly-tools.txt`, and `/sitemap.xml` redirects to
`/info/sitemap.xml`, served as XML. The documentation keeps its canonical
`https://lolly.tools` addresses, search index and sitemap, so mirroring it does not
create a second canonical site or publish your own documentation.

The public documentation needs no sign-in. Work's own Markdown API, `/api/v1/docs`, stays
members-only on a governed instance, as do private catalogs, uploads, projects and render
routes. Robots instructions are only hints: sign-in and route policy enforce the private
boundary.

At the candidate address, check unauthenticated GET and HEAD. Confirm that `/info/` and
`/docs/operate/deployment` return the documentation, with titles and canonical links,
rather than the app. Check the root robots file, the sitemap redirect and its XML content
type, empty HEAD bodies, 404 answers for missing documents, and refusals for private API
and catalog routes. The server's own HTTP tests exercise these boundaries.
:::

## Capacity and recovery

Leave room for the current signed web app, rollback copies, container layers, database
growth and temporary files. Reuse identical immutable files when you deploy, and remove
only generated releases that are neither active nor needed for rollback. Keep model files
and backups off the root disk where you can. Measure memory while the render worker and
live editing run before you add a local database or a public gateway to a small VM.

Use TCP liveness for frequent checks, signed-in HTTP readiness for meaningful service
checks, and bounded container logs. Collect `/metrics` with its token, along with
database and disk pressure, render queue failures, source sync health and agent
activity, without recording access tokens or document bodies. A deploy counts as
successful only after a restore and rollback rehearsal, not just healthy processes.

Before moving asset bytes to object storage, compare the provider's feature list with
the asset driver and your backup needs. Evroc documents its
[S3 compatibility](https://docs.evroc.com/products/storage/object-storage/s3compat.html),
including the features it lacks. Prove private reads, original-byte hashes, version
recovery, retention, CORS and Range and HEAD behaviour on a throwaway bucket before you
change asset or archive addresses. A backup inside the same cloud is not independent of
that cloud account or region.
