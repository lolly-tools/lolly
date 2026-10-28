# How a Lolly Work deployment fits together

This page is for whoever runs Lolly Work once it is installed. It explains the
parts and which ones you can leave out. It also shows what changes between Compose,
systemd, YunoHost and Kubernetes. The commands are in the install guides; start at
[Run Lolly Work](self-host.md).

Every deployment runs the same server. It answers the console at `/admin`, the API
and share links, and, when you mount one, the Lolly web app at `/`. One server
process owns live collaboration, so you run one application replica. PostgreSQL
keeps everything that must survive a restart.

Two parts are optional. A Chromium render worker adds JPG and PDF exports and tools
with scripts; without it, the server still renders SVG and PNG itself and tells
connected apps which formats it can make. A design-system pack and the web app turn
the console into a full workspace; leave them out for an instance that serves only
the console and API.

::: figure work-deployment-parts
One server and one database, with optional parts around them. Every install shape below arranges the same pieces.
:::

## The install shapes

The shapes run the same application code. They differ in three ways: how
configuration and secrets arrive, who applies database migrations and whether the
pack, web app, collaboration gateway and render worker are present.

| Shape | Use it for | Who applies migrations | Pack and web app |
|---|---|---|---|
| Local (`node server/src/main.ts`) | development, evaluation | the server, at startup | local paths |
| Compose (`deploy/compose/`) | one VM, a small organisation | the server, at startup | mounted from the checkout |
| Single VM with Caddy (`deploy/vm/`) | one small team on its own domain, with live co-editing | the server, at startup, over the direct database URL | pack mounted read-only; a signed web app served by Work when configured, otherwise proxied through Caddy |
| YunoHost (`deploy/yunohost/`) | a self-hosting box, signing in with its accounts | the server, at startup | copied from the web app into the app's data folder |
| Helm (`deploy/helm/`) | Kubernetes or Rancher, one collaboration owner | a pre-install and pre-upgrade Job | volumes you mount |

The Work repository also keeps an optional serverless function adapter, qualified in
CI, for operators who choose that kind of target. It bundles its pack and has no
live co-editing and no Chromium worker; its runbook is `deploy/vercel/README.md` in
that repository.

## One process owns live collaboration

The server handles HTTP and WebSocket traffic in one process, and that process is
the one writable owner of every live editing room. Keep one application replica.
The chart refuses any `replicaCount` other than one until room routing and operation
ordering are supported. PostgreSQL persistence, a multi-node cluster, ingress
affinity or a different ingress controller does not make writable replicas
interchangeable or give the application high availability. The reserved
multi-replica affinity settings do not turn room routing on.

Rollouts replace the owner rather than overlapping two. The Kubernetes deployment
uses the `Recreate` strategy with a 60-second grace period, so the old owner drains
its sockets and releases its room leases first. People see a short reconnect window;
[keep Lolly Work running](operations.md#collaboration-ownership-and-replacement)
covers what happens to edits during that window.

Separate render workers can scale once you have tested the workload. Work keeps
durable jobs in PostgreSQL, and a saturated render worker answers with a bounded
`503`.

## Two ways to render

Each deployment picks one of two render setups. The switch is whether the worker
pair is configured: `config.render.worker.url` plus `LW_RENDER_WORKER_SECRET`.

::: cols
## Light (the default)

No Chromium anywhere: not in the server image, and not in Compose, where the worker
is not even part of the stack.

- SVG renders in process with jsdom, and PNG with resvg.
- Tools with scripts or heavy HTML answer `501`, and formats beyond this tier answer
  `400`.
- Connected apps learn the formats up front from the `render` block in
  `org_config`, so they never offer an export this deployment cannot make.

Measure memory with your actual pack and traffic.

## With a render worker

A separately scaled Chromium pod (`workers/render/`, Helm `renderWorker.enabled`).

- Renders tools with scripts and rasterises through the web app's own export path.
- Widens the formats to **`svg, png, jpg, pdf`**, advertised through
  `render.formats`, with a Content Credential signed on the server side in every
  container format.
- Holds no database connection and no secret beyond the shared HMAC key.
- Caps renders per pod with `LW_RENDER_MAX_CONCURRENT`. A busy pod answers
  `503 RENDER_BUSY` with `Retry-After` and leaves readiness, and the autoscaler adds
  pods.
:::

Capacity depends on the pack, how many people edit at once, the database and the
render workload. Measure CPU, memory, disk growth and latency on your chosen host
before you raise concurrency or add replicas. Adding replicas still needs room
affinity, migration ownership and shared-limit checks.

## Helm values to know

`deploy/helm/values.yaml` is the one file you edit. It is heavily commented, and it
wins if it disagrees with this page. The install commands are in
[Install on Kubernetes](platform-deployment.md#install-for-production).

Out of the box the chart gives you one application replica; non-root, read-only
root filesystem pods with dropped capabilities; `/healthz` liveness and `/readyz`
readiness; an Ingress template; an optional ServiceMonitor and NetworkPolicy; a pack
volume, a web app volume, an optional Chromium render-worker tier; and a migrate Job
that owns the schema.

- **Official release images are public.** The `lolly-tools` server and worker
  packages need no GHCR credentials. Select qualified immutable digests from the
  release record, and use credentials only for a private mirror you run. A
  disconnected cluster needs verified image transport, such as `docker save` then
  `k3d image import` or `ctr images import` on the node.
- **`instance.baseUrl` must match the address the instance answers on.** It drives
  the OIDC redirect address and the `Secure` cookie flag.
- **Secrets are never generated for you.** Every replica must sign and verify with
  the *same* `LW_SESSION_SECRET` and `LW_LINK_SECRET`, and both must survive rollouts.
  Generate them once, store them safely and rotate them only as planned.
- **The migrate Job owns the schema.** With `migrate.enabled=true` the application
  runs with `LW_AUTO_MIGRATE=false`. The pre-install and pre-upgrade Job applies
  migrations and must succeed before the application starts; startup refuses a
  pending schema.
- **`pack.type` defaults to `none`.** `config.instance.pack` then points at
  `/app/packs/demo`, the small demo pack inside the server image, so an install with
  nothing mounted still serves a catalog. To use your own pack, bake it into an image
  (`COPY packs/ /pack/` on a busybox base), set `pack.image` to it and
  `pack.type: emptyDir`; an init container copies it into the pack volume before the
  server starts. The same `pack.image` works with `pvc` or `existingClaim` to fill a
  persistent volume. Point `config.instance.pack` at the mounted pack.
- **`shell.enabled` defaults to `false`**, so only `/admin` and the API answer. Mount
  a built `shells/web/dist` and set `config.instance.shellDir` to serve Lolly at `/`.
  Under any access mode except `open`, a missing web app, or one too old to apply
  policy, **stops startup**, because it would quietly drop policy for every
  employee. `LW_ALLOW_STALE_SHELL=1` overrides that. `shell.image` delivers the web
  app like `pack.image` does (`COPY shells/web/dist/ /shell/`, then
  `shell.type: emptyDir`), and since each rollout copies again from the image you
  pin, the web app cannot quietly age in a volume.
- **`renderWorker.enabled` defaults to `false`**, so tools with scripts answer `501`
  until a worker exists. The details for turning it on are below.
- **Behind an ingress, set `config.rateLimit.trustedProxyHops: 1`**, or per-address
  limits see only the ingress.
- **Alerts and a dashboard are optional.** `metrics.prometheusRule.enabled` installs
  suggested alerts as a `PrometheusRule`, and `metrics.grafanaDashboard.enabled` a
  Grafana dashboard for the sidecar. Both are off by default and read only what
  `/metrics` exports ([metrics and alerts](metrics.md)). For admission policy, the
  repository carries a [Kubewarden policy set](admission-policy.md) that you apply
  separately.

::: details Turning on the render worker
When you enable the worker, also set `config.render.worker.url` to the worker Service
and `renderWorker.webBase` to the canonical HTTPS web app address with trusted TLS.
Prefer a sandboxed `runtimeClassName` such as gVisor or Kata: that tier renders the
least-trusted content.

The browser inside the worker needs a [secure context](https://www.w3.org/TR/secure-contexts/)
for Web Crypto. A plain HTTP cluster Service address is fine for the HMAC worker API,
but fails as the browser's web app address. HTTP addresses are accepted only for
explicit `localhost`, `127.0.0.1` or `[::1]` development. Give an address without
credentials, query strings or fragments; a base path is supported. Keep certificate
checks on and renew certificates at the edge.

For a public HTTPS origin, allow DNS and public TCP 443 egress. A private HTTPS edge
needs a declared origin and a narrow egress rule for its real address and port.

To prove it, run a complete signed-in Work render and follow its durable status.
Then compare the downloaded output's size and SHA-256. A direct raster request or a
healthy worker probe does not exercise the web app's export or read tickets.
:::

::: details An employee-only first release
The source checkout includes an optional `deploy/helm/values-internal.yaml` policy
overlay, with instructions in `deploy/helm/INTERNAL-RELEASE.md`. Merge it with your
existing environment configuration, and collect evidence from staging before you
promote to production.
:::

### A small K3s or RKE2 cluster

`deploy/helm/values-small-suse.yaml` sets explicit CPU, memory and temporary disk
budgets for a small K3s or RKE2 candidate. It keeps one application owner and leaves
the render worker, the pack image and the signed web app as opt-ins. Merge it before
your reviewed instance values, and review the rendered output before you install:

```sh
helm template lolly-work deploy/helm \
  -f deploy/helm/values-small-suse.yaml -f instance-values.yaml
```

Supply the same application and database Secrets, instance configuration and ingress
as any production install. The profile does not create a cluster, database, shared
collaboration relay or backup service.

::: details Image digests, placement and temporary storage
Pin `image.digest` and `renderWorker.image.digest` to the SHA-256 digests of the
application images you publish. A digest replaces `image.tag`; an empty digest keeps
the tag. The application and the migration Job share one image reference.
`imagePullSecrets` also reaches render workers. Set `renderWorker.imagePullSecrets`
only when that tier needs different credentials (`null` inherits, `[]` opts out).
Worker `nodeSelector`, `tolerations`, `affinity` and `topologySpreadConstraints` let
larger clusters keep browser workloads apart.

The profile bounds `/tmp`, the pack and web app `emptyDir` copies and their init
containers. Set `tmp.sizeLimit`, `pack.emptyDir.sizeLimit`, `shell.emptyDir.sizeLimit`
and `renderWorker.tmp.sizeLimit` for your actual release sizes; empty values keep the
existing behaviour. Container `ephemeral-storage` budgets also cover writable layers
and logs. Image cache, database growth and rollback releases need separate node disk
space. Pack and web app copies can be reproduced; durable records and uploaded asset
bytes belong in PostgreSQL or the configured object store.

For browser exports, enable the worker and supply its matching secret and web app
address. Then point `config.render.worker.url` at its Service. The small profile
starts with one worker and one render at a time, and its autoscaler is off. Turning
the autoscaler on needs spare node capacity and metrics. Measure shared editing,
renders and recovery on the chosen host before you switch over.
:::

::: details What the cluster must provide
Pull from the [Rancher Application Collection](https://apps.rancher.io/applications)
where you can.

| Component | Required? | Notes |
|---|---|---|
| PostgreSQL 17 or 18 | **yes** | the only hard outside service; CI and Compose use 17, the SUSE profile pins 18.6 |
| Ingress (nginx) | in practice | the chart ships the Ingress template |
| cert-manager | in practice | TLS; an annotation example is in `values.yaml` |
| Keycloak or any OIDC provider | yes, for single sign-on | any OIDC provider works; `idp.displayName` is the label people see |
| kube-prometheus-stack | optional | ServiceMonitor template included; `/metrics` needs a token |
| OpenTelemetry Collector | optional | `otel` values send traces, metrics and logs over OTLP/HTTP; off by default ([details](operations.md#opentelemetry-export)) |
| Node.js base image | yes | default Node 26 Alpine; SUSE BCI `bci/nodejs:24-base` is the separately qualified alternative |
| S3-compatible object store | optional | only for the S3 catalog provider |
| Chromium worker image | optional | built in the repository from `workers/render` |

Everything else ships inside the server. There are no CDN assets (the console works
air-gapped, with its fonts included) and no Redis, queue or cache tier. No outside
service sits in the serving path.
:::

The [SUSE deployment runbook](../deploy/suse/README.md) covers cluster and storage
choices, preferred image sources and Application Collection dependencies.

## RKE2 and K3s

![Rancher](img/rancher-icon.svg) ![k3s](img/k3s-icon-color.svg) ![Helm](img/helm-icon-color.svg)

The chart uses only core Kubernetes objects (Deployment, Service, Ingress, Job and
HorizontalPodAutoscaler), so it runs on any conformant cluster and is exercised on
both Rancher-managed distributions: **RKE2** for the datacenter (etcd, ingress-nginx,
CIS and FIPS posture) and **K3s** for the edge. An install, Traefik ingress through
the cluster's default class, the sign-in gate, the catalog and renders were checked
live on K3s v1.35 in August 2026; the pinned K3s operator path in
`deploy/suse/k3s.lock.json` (amd64) and `deploy/suse/k3s.arm64.lock.json` (arm64) uses
v1.34.12+k3s1. The operator path also installs on transactional hosts such as openSUSE
Leap 16.1 Immutable: its first run stages SUSE's `k3s-selinux` policy in a new snapshot
and asks for a reboot, and its second run installs K3s. K3s puts no API ceiling on this
workload. Its limits are operational:

- **Datastore.** K3s defaults to SQLite, which suits a single server node. A
  multi-server control plane needs K3s's embedded etcd, a choice Rancher makes for
  you when it provisions one, as RKE2 always does.
- **Ingress.** An empty `ingress.className` uses the cluster's default. Check the
  controller and TLS configuration on your platform.
- **Small machines.** The light render setup is the edge default, and the evaluation
  requests 100m of CPU and 192 MiB. The render worker wants about 2 GB per pod: on
  small machines leave it off, or point `render.worker.url` at a worker on larger
  hardware.
- **ARM nodes.** Release images are multi-architecture (amd64 and arm64) from v0.2.0.

## Hosting and operating-system choices

On a SUSE stack, Lolly Work runs on SLES with Rancher Prime or on openSUSE Leap with
Rancher Community. Any conformant cluster works too.
Helm keeps the application and render worker in your chosen cluster; Compose and
systemd are the smaller shapes. UpCloud and Evroc are supported foundations for these
operator-managed releases, and
[Run Work on UpCloud or Evroc](cloud-deployment.md) covers their differences, boot,
capacity and restore checks. The existing host provisioner supports openSUSE; another
operating system needs equivalent host preparation.

Choose jurisdiction, support lifecycle, images, dependencies and recovery policy for
your own requirements. A provider's or an operating system's brand does not by itself
make an instance compliant or reproducible. The engine is bundled and hash-checked,
and the console serves its own assets. Optional DAM, identity, email, model and proxy
integrations can still reach outside services, so list those paths before you claim
sovereign or offline operation.

## Single server with Compose

The commands are in [Install Lolly Work, section 5](install.md#5-container-compose).
Two constraints shape them:

- The Compose file uses the fail-if-unset form for both `LW_` secrets, so `up` stops
  without `.env`.
- Docker creates a *folder* at a missing mount source, so a missing `instance.json`
  in the repository root makes the server read a folder as its configuration. The
  mounted file is the one you wrote in
  [section 2](install.md#2-your-first-real-instance).

`instance.json` and `packs/` are mounted read-only from the repository root.
`LW_AUTO_MIGRATE` keeps its default (`true`), so this single-node shape applies
pending migrations at startup. The server waits for the database's `pg_isready`
health check first, because its migration step connects once with no retry.

The web app is not mounted by default, so only the console and API answer. A
commented-out mount in `docker-compose.yml` shows how to bind a built
`shells/web/dist` and point `instance.shellDir` at that build. The same startup guard as Helm
applies.

## Single VM with Caddy

`deploy/vm/` runs a private instance on one server. Caddy handles TLS and routing.
The Work server, built from `deploy/compose/Dockerfile`, runs the live co-editing
gateway in its own process, and a PostgreSQL database holds the records and the
asset bytes. For repeatable VM creation, use the
[UpCloud and Evroc modules](cloud-deployment.md); the default VM deployment keeps an
external database and the existing public API proxy.

- With `instance.shellDir` set, Caddy sends web app requests to the Work server, which
  serves the signed web app itself. Otherwise Caddy proxies the public web app with
  the session cookie removed.
- Public open-source API functions continue through the public API proxy until a
  standalone replacement is qualified. Control-plane paths and `/ws/collab/<session>`
  go to the Work server.
- `node scripts/build-caddyfile.ts` writes `deploy/vm/Caddyfile`, and a repository
  test checks that the Caddyfile and the serverless adapter's route table agree on
  every path except the WebSocket.

The kit's scripts create the host, harden it, write secrets, push a release and run
smoke checks; the runbook, `deploy/vm/README.md`, lists them with their history. The
kit's lolly.ing example records a former deployment; do not use it to update a
production domain.

**On a database that scales to zero**, two settings matter. `LW_BACKGROUND_POLL_MS=0`
stops the render and automation runners checking for work every second; work still
runs at startup, on submission and after each finished item. With `0`, a pending job
callback still sets one timer for its next attempt, so the database may wake for up
to about 45 minutes after a job with a callback settles. Use a TCP connect as the
container health check, because every HTTP request reads the database. Migrations run
over `DATABASE_URL_UNPOOLED` when it is set and take a transaction-level lock, so a
connection pooler cannot keep the lock after the runner leaves.

## Verifying the images

Release images (`v*` tags) are signed keylessly in CI and carry SBOM and provenance
attestations. Checking them needs no key from the project: the signature binds to the
release workflow's own identity.

```bash
cosign verify ghcr.io/lolly-tools/lolly-work-server:<version> \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp 'github.com/.+/lolly-work/\.github/workflows/release\.yml@.*'
```

The same check covers `lolly-work-render-worker`. A cluster can enforce it at
admission with Kyverno or the Sigstore policy controller, so an unsigned or re-tagged
image never schedules. The source SBOM (`sbom.cdx.json`) stays in the repository
beside the per-image attestations. The exact identity of each release is in
[official installation routes](official-installations.md#release-verification).

## Air-gap

An offline deployment needs every outside path listed and tested: DAMs, OIDC, SMTP,
public API proxies, model downloads, certificate enrolment and ACME. The console
serves its own assets and fonts, and packs and the engine can be local. Stage and
check container images, charts, signed web apps, models and certificates before you
cut the network. Then test the flows people and agents need with egress denied,
rather than assuming air-gap support from how the software is packaged. Mirroring
each project download is described in
[official installation routes](official-installations.md#external-services-and-mirrors).

## Related

- Every key you can set: [configuration](configuration.md)
- Upgrades, backups and monitoring: [keep Lolly Work running](operations.md)
- What is not production-ready yet: [status](status.md)
