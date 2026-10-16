# UpCloud, Evroc and fewer hosting services

Lolly Work already runs as a Node server, PostgreSQL and a reverse proxy. Its
render worker is a separate container with its own bounded resources and render
credential. The modules in `deploy/upcloud/` and `deploy/evroc/` make provider
resources repeatable with OpenTofu or Terraform. Their application release and
recovery contracts are shared. A separate optional PostgreSQL override supports
a local database. These additions do not move an existing deployment.

## Supported foundation

| Component | Current support | Qualification still needed before a new deployment |
|---|---|---|
| UpCloud VM and firewall | Provider-pinned module; mocked plans under both CLIs | Qualified image, zone/plan availability, boot and capacity |
| Evroc VM, disk, public IP and security group | Official provider-pinned module; mocked plans under both CLIs | Qualified image and SSH user, project/region/profile availability, boot and capacity |
| Private Lolly Work | Compose, openSUSE provisioning, signed shell mount, WebSockets | Instance configuration, owner sign-in, provider access and shared editing |
| PostgreSQL | External connection by default; opt-in Compose database | Restore rehearsal, maintenance cutover and independent backups |
| Render worker | In-repo image, isolated secret and resources | Real document render through the chosen shell origin |
| Public Lolly APIs | Existing standalone CA and MCP in the Lolly repository | Complete route parity with the public hosted shell, including Penpot |
| YunoHost | In-repo package, SSO/LDAP contracts and backup/restore scripts | Real Linux package_check, release artifact pins and architecture checks |

Use the [UpCloud runbook](../deploy/upcloud/README.md) or
[Evroc runbook](../deploy/evroc/README.md) for credential-free validation and reviewed
VM creation. Use the [VM runbook](../deploy/vm/README.md) for the
application release. Public APIs and private workspace records remain separate:
moving a public host must not publish private packs, uploaded assets or member cookies.

## SUSE Kubernetes and dependency images

The [platform deployment guide](platform-deployment.md) provides separate
starting points for readers, IT operators and release developers, including
on-premises and other cloud foundations, host readiness, Ansible/Salt and
rootless Podman image builds.

The optional [SUSE deployment runbook](../deploy/suse/README.md) covers a small
K3s profile, RKE2 for larger operational requirements, provider CSI storage and
Longhorn for qualified multi-node storage. Both cloud foundations can host these
choices; Kubernetes still consumes the underlying VM or bare-metal capacity.
Sharing services on a cluster reduces separate guest and service overhead, but
does not remove the cloud's compute charges.

The Work chart includes `values-small-suse.yaml`, immutable application digest
references, inherited worker registry credentials, worker placement and bounded
scratch/artifact copies. The public Lolly chart has its own `profiles/lean.yaml`;
that chart installs only the static shell and optional CA/MCP services. These
profiles preserve the existing deployment defaults until explicitly selected.
Use Application Collection PostgreSQL as a separately managed dependency when
appropriate. Lolly Work uses PostgreSQL for durable jobs and does not need Redis.

## Provider boundaries

| Contract | UpCloud | Evroc |
|---|---|---|
| Authentication | Provider environment, such as `UPCLOUD_TOKEN` | Existing SDK login configuration or service-account environment |
| Operating-system image | Explicit template UUID; existing bootstrap kit is UpCloud-specific | Explicit disk image; project inventory and cloud-init must be qualified |
| Host preparation | Existing openSUSE provisioning kit | Same kit only for a qualified openSUSE image; another OS needs equivalent host preparation |
| Public network | One public IPv4 interface; cloud firewall | Separate public IPv4 plus dual-stack VM; custom security group only |
| SSH | Key-only image account and administrator CIDRs | Complete non-root key-only user data and administrator CIDRs; no broad default SSH group |
| Root disk | 80 GB default, encrypted storage flag, protected VM | 80 GB default, protected disk/VM/address; no encryption field in the provider schema |
| Database | Managed PostgreSQL is available; local database is opt-in | Reviewed external PostgreSQL or opt-in local database; no managed product assumed |
| Object storage | Qualify bucket access, recovery and endpoint behavior | Qualify documented S3 feature compatibility, bucket access and recovery |
| Application release | Signed shell, configured Work/worker/relay, database migrations, smoke checks | Same artifact, configuration, migration and acceptance contracts |

Both targets require real boot, SSH/reboot, host security, capacity and recovery
checks before production. A provider mock validates configuration against the
schema; it cannot establish an available image, quota, compliance or performance.
The openSUSE `provision.sh` does not support Ubuntu. See the target runbook before
choosing an image. Public APIs and private data retain the same boundaries on
either provider; public CA/MCP/Penpot containers receive no private Work secrets.

## Public documentation on both deployment types

The public Lolly shell and a private Work instance serving a signed shell must
both expose the shell's public documentation before the app fallback. This
contract is the same on UpCloud and Evroc. It covers `/info/`, literal `/info/`
articles, `/docs` aliases, `/robots.txt` and the sitemap. Native Work also offers
extensionless `/info/` article URLs; the public hosted shell does not currently
provide that convenience. Native serving resolves only files inside the signed
shell release. Missing articles return 404 rather than an app page with a
successful status.

GET serves the signed document bytes unchanged. HEAD returns the same public
document headers and file size without reading or sending its body. The root
`/robots.txt` uses the release's `robots-lolly-tools.txt`; `/sitemap.xml` redirects
to `/info/sitemap.xml`, which is served as XML. Preserve the common docs'
canonical `https://lolly.tools` URLs, search index and sitemap. Mirroring those
docs does not create a second canonical site or publish tenant documentation.

Public shell docs require no workspace sign-in. The separate Work markdown API,
`/api/v1/docs`, stays member-only on a governed instance, as do private catalogs,
uploads, projects and render routes. Robots instructions are discovery hints;
authentication and route policy enforce the private boundary.

Before accepting a release on either provider, check unauthenticated GET and
HEAD at the candidate origin. Confirm that `/info/` and
`/docs/operate/deployment` contain the documentation titles and their existing
canonical links, rather than the app shell. Check the root robots and sitemap
redirect, XML content type, empty HEAD bodies, missing-document 404 responses
and private API/catalog refusals. The native server's HTTP tests exercise these
boundaries. A static shell host needs equivalent aliases and discovery routing;
a generic SPA fallback alone does not meet this contract. Use the maintained
[UpCloud](../deploy/upcloud/README.md), [Evroc](../deploy/evroc/README.md) and
[application VM](../deploy/vm/README.md) runbooks together with these checks.

## Custom instance domain

The [VM kit's custom-domain procedure](../deploy/vm/README.md#custom-instance-domains)
derives the deployment hostname from a validated HTTPS `instance.baseUrl`. Both
providers use the same generated Caddy and application release. Custom domains
have only explicitly requested redirect aliases; smoke can check a configured
non-Google provider and its callback. The managed worker's `LOLLY_WEB_BASE` is set
in the private environment and must match that origin before it can start.

The openSUSE kit retains its existing compatible paths and SUSE pack default.
Operators with another OS, brand or additional Compose overlays must use the
corresponding host preparation and complete release file list. Keep actual
image/SSH/reboot, owner sign-in, shared editing and real exports as acceptance
gates. Generating a hostname does not register an OIDC client or move DNS.

## Database migration

Choose managed PostgreSQL when its operations, availability and recovery policy
fit the deployment. [UpCloud's managed database service](https://upcloud.com/global/products/managed-databases/)
provides PostgreSQL and backup options. Price the actual database, storage and
backup configuration before provisioning the database. On Evroc, use a reviewed external
service or the local option; no managed PostgreSQL product has been assumed.
Neither VM module creates a database.

The local option is `deploy/vm/postgres.compose.yml`. It keeps PostgreSQL inside
the Compose network, persists it in a named volume and waits for readiness before
the server starts. Its password must be URL-safe because the connection URL is
composed from that value. Generate a random hexadecimal password and store it as
`LW_LOCAL_PG_PASSWORD` in the existing private `.env`; preserve every other secret.
The database service is not part of the default deployment and no port is published.

For a migration, use PostgreSQL client tools at least as new as the source server.
Keep credentials in a mode-0600 libpq service/password file rather than a command
argument. For example, `~/.pg_service.conf` can define `lolly-source` and
`lolly-target` with host, port, database, user and TLS mode; `PGPASSFILE` identifies the
separate password file. PostgreSQL documents [password-file permissions](https://www.postgresql.org/docs/17/libpq-pgpass.html).

Rehearse on a separate database first. The helper creates a custom-format dump,
checks that it is readable and writes a SHA-256 companion file. Both files have
owner-only permissions. It refuses an existing destination and removes unfinished
temporary files after a failed dump.

```sh
PGSERVICE=lolly-source deploy/vm/postgres-backup.sh backup /private/backups/lolly.dump
deploy/vm/postgres-backup.sh verify /private/backups/lolly.dump
PGSERVICE=lolly-target deploy/vm/postgres-backup.sh restore /private/backups/lolly.dump \
  --confirm-database lollywork
```

Restore checks the actual connected database name, refuses existing user schemas
or objects, and restores in one transaction. It never drops existing objects.
The dedicated database name must contain letters, digits, underscores or hyphens.
The checksum detects corruption; store the archive and checksum together in
protected independent storage. This is a logical database backup, not a complete
backup of the host or external object storage. See [PostgreSQL's dump](https://www.postgresql.org/docs/17/app-pgdump.html)
and [restore documentation](https://www.postgresql.org/docs/17/app-pgrestore.html).

For local PostgreSQL, stage the override and `postgres-backup.sh` beside the existing base Compose file.
Start **only** the database first, preserving the project's existing Compose name:

```sh
docker compose -f docker-compose.yml -f postgres.compose.yml up -d db
```

Keep the server on its existing database during rehearsal. The database has no
public or host port. For a local restore, copy the verified archive and checksum
into its temporary directory and run the same helper with the container's client
tools. Use the same complete Compose file list and project name in each command:

```sh
docker compose -f docker-compose.yml -f postgres.compose.yml cp /private/backups/lolly.dump db:/tmp/lolly.dump
docker compose -f docker-compose.yml -f postgres.compose.yml cp /private/backups/lolly.dump.sha256 db:/tmp/lolly.dump.sha256
docker compose -f docker-compose.yml -f postgres.compose.yml exec -T db bash -c \
  'export PGHOST=127.0.0.1 PGDATABASE="$POSTGRES_DB" PGUSER="$POSTGRES_USER" PGPASSWORD="$POSTGRES_PASSWORD"; bash -s -- restore /tmp/lolly.dump --confirm-database "$POSTGRES_DB"' \
  < postgres-backup.sh
```

The password stays inside the database container. Remove its temporary archive
copies after recording the restore result; keep the independent backup.
For managed PostgreSQL use its reviewed TLS connection or a temporary
operator-controlled tunnel. Do not add a public PostgreSQL port for the helper.
Before the final dump, stop the server and every
other writer using the source database; preserve the render/relay overlays and
wait for the collaboration drain. Restore into the empty target, then run
migrations against that database. Add the override to the complete Compose file list only
for the reviewed server cutover. Subsequent deployments must use that same file
list; the existing `push.sh` base-only path does not manage this optional database.

Check owners and project memberships, session revisions, uploaded asset bytes on
another device, sealed provider credentials, Brandfolder queries, agent grants and
activity, audit continuity and real exports. Keep the original database in place
until this acceptance and a rollback rehearsal pass. After writes resume on the
target, rollback requires reconciling those writes; changing the URL alone would
discard them.

Alongside the dump, retain `instance.json`, governance export, signing keys,
session/link and credential-sealing secrets, exact application/shell versions,
provider settings and independently retained audit heads. With the default `pg`
blob driver the database includes uploaded asset bytes. With `s3`, back up the
bucket and its versions separately. See [operations](operations.md#backup-and-restore).

## Public shell cutover

Serving static files on a VM does not reproduce every hosted function. Inventory
CA, public MCP, image fetch and the Penpot RPC proxy before moving the public
domain. Keep their existing authentication, token custody, origin checks, request
limits, SSRF protection and rate-limit behavior. The Work document-agent connector
must still require the member's scoped grant even when the public catalog MCP
permits anonymous reads.

Lolly has standalone CA and MCP server entry points. The Penpot proxy currently
uses a hosted-function entry point and needs an explicit standalone mount. The
existing VM router can still proxy these APIs while the public host is qualified.
Replace that dependency only after signed catalog, discovery, MCP, CA, Penpot,
image-fetch, models, WebSocket and mobile first-load checks pass at the candidate
origin. Preserve OAuth callback URLs and trusted signing keys across the cutover.

## YunoHost qualification

The package is developed in `deploy/yunohost/` and mirrored at release time.
Release source URLs and checksums are generated by `scripts/yunohost-release.ts`;
do not hand-edit them. Repository tests exercise rendered configuration, sign-in
and role mapping, shell headers, script syntax and package contracts.

Run the official [package linter](https://github.com/YunoHost/package_linter) for
static packaging checks, then [package_check](https://github.com/YunoHost/package_check)
on a disposable Linux host with Incus or LXD. That integration run covers actual
installation, multi-instance behavior, upgrade, backup/restore and URL changes.
It is separate from the repository contract tests and is required before claiming
a qualified YunoHost release. Retain the real test logs and archive checksums.
The repository workflow blocks static code errors while reporting catalog
registration and working-state metadata separately. Those publication checks
remain pending until the mirrored package is registered and qualified.

## Capacity and recovery

On either UpCloud or Evroc, allow space for the current signed shell, rollback shells, container layers,
database growth and temporary artifacts. Reuse identical immutable files during
deployment and prune only generated releases that are neither active nor needed
for rollback. Keep model weights and backups off the root disk where possible.
Measure memory while the render worker and active editing are running before
adding a local database or public gateway to a small VM.

Use TCP liveness for frequent checks, authenticated HTTP readiness for meaningful
service checks, and bounded container logs. Collect `/metrics` with its token,
database/disk pressure, render queue failures, provider sync health and agent
activity without recording access tokens or document bodies. A successful deploy
requires a restore and rollback rehearsal as well as healthy processes.

For object-storage migration, compare the actual provider's feature matrix with
the blob driver and backup requirements. Evroc documents [S3 compatibility](https://docs.evroc.com/products/storage/object-storage/s3compat.html),
including features that are absent. Prove private reads, original-byte hashes,
version recovery, retention, CORS and Range/HEAD behavior on a disposable bucket
before changing asset or archive URLs. A cloud-local backup is not independent
of that cloud account or region.
