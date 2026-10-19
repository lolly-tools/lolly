# Deployment shapes

For managed SSO, use [Enterprise identity deployment](enterprise-identity.md): provider
registration, admission, optional MFA, SCIM/offboarding, logout and upgrade checks.

The deployment paths below run the same application code. They differ in how
configuration and secrets arrive, who applies migrations, and whether the pack,
shell, collaboration gateway and Chromium worker are present. UpCloud and Evroc
provide repeatable VM foundations for the shared application deployment.

## Current hosted production

Since 7 October 2026, **lolly.ing** and **lolly.tools**, including their `www`
aliases, run on the same UpCloud host with openSUSE Leap 16.0 and K3s. Work,
the render worker and live relay are separate Kubernetes workloads. PostgreSQL
18.6 runs on that host; the public shell, APIs and managed HTTPS edge also run
there. These two domains no longer use Vercel or Neon for their live runtime.
Read the [SUSE deployment guide](../deploy/suse/README.md) and
[small Kubernetes profile](../deploy/helm/SMALL-SUSE.md) for the reusable kits.
The reviewed instance deployment handoff defines the actual host, cluster,
secrets, persistent volumes and pinned release; a generic example is not that handoff.

The former lolly.ing Compose services remain stopped and their database access
is fenced. That host is retained for SSH access and verified HTTPS forwarding
to the current host. Do not replay its Compose, Neon or Vercel rollback commands,
restore its database access, or point production DNS at those old targets.

The **lolly.work** evaluation demo also runs on that UpCloud host, in its own
namespace with ephemeral sample data, separate keys and network isolation from
private workspaces. Its automatic Vercel deployment from this repository's CI has
been retired. Optional generic Vercel adapters remain qualified in CI for
operators who choose that target.

| Shape | Where used | Schema owner | Pack / shell |
|---|---|---|---|
| Local (`node server/src/main.ts`) | development, evaluation | boot auto-migrate | local paths |
| Compose (`deploy/compose/`) | single VM, small org | boot auto-migrate | bind mounts |
| Helm (`deploy/helm/`) | Kubernetes / Rancher, one collaboration owner | pre-install/upgrade Job | volumes you mount |
| YunoHost (`deploy/yunohost/`) | a self-hosting box, sign-in with its accounts | boot auto-migrate | seeded from the shell into the app's data directory |
| Vercel (`vercel.json` + `scripts/build-vercel-fn.mjs`) | trial / pilot / public demo | Neon + external migrate | demo pack bundled; shell not served |
| Single VM with Caddy (`deploy/vm/`) | one small team on its own domain, with live co-editing | boot auto-migrate over the direct URL | pack mounted read-only; a signed shell served natively when configured, otherwise proxied through Caddy |
| Vercel private instance (the same build with `LW_SHELL_ORIGIN`, `LW_PACK_DIR`) | a small, sign-in gated team on its own domain | Neon, migrated at cold start | pack from `scripts/build-instance-pack.ts` bundled; a public shell proxied onto the same origin, catalog signed per caller with `LW_CATALOG_SIGNING_KEY`; no live co-editing. See `deploy/vercel/README.md`, section 6 |

## Render topologies - the default is Chromium-free

Each deployment selects one of **two render topologies**. The
switch is simply whether the worker pair is configured (`config.render.worker.url` +
`LW_RENDER_WORKER_SECRET`):

- **Default (light).** No Chromium anywhere - not in the server image, not in Compose (the
  worker isn't even in that stack). SVG renders in-process (jsdom) and PNG in-process
  (resvg); hooked/HTML-heavy tools answer `501`, formats beyond the tier answer `400`, and
  connected shells are told the capability set upfront via org_config's `render` block, so
  they don't offer exports this deployment can't produce. Qualify memory with the
  actual pack and traffic; this topology has no browser process.
- **Worker-attached.** A separately scaled Chromium pod (`workers/render/`, Helm
  `renderWorker.enabled`) renders hooked tools, rasterises via the shell's own export
  path, and **widens the export tier to `svg, png, jpg, pdf`** - advertised to
  shells through org_config's `render.formats`, C2PA-signed plane-side in every container.
  The worker holds no DB connection and no secrets beyond the shared HMAC
  key; per-pod concurrency is capped (`LW_RENDER_MAX_CONCURRENT`), a saturated pod answers
  `503 RENDER_BUSY` + `Retry-After` and drops out of readiness, and the HPA scales the tier.

Capacity depends on the pack, active collaborators, database and render workload.
Measure CPU, memory, disk growth and latency on the chosen UpCloud or Evroc profile
before increasing concurrency or adding replicas. Work persists durable jobs in
PostgreSQL; render-worker saturation returns a bounded `503` response. Replica
rollout still needs room affinity, migration ownership and shared-limit checks.

## Hosting and operating-system choices

Lolly Work can run on a SUSE stack using SLES and Rancher Prime, or openSUSE Leap
and Rancher Community. Helm keeps the application and render worker in the chosen
cluster; Compose and systemd provide smaller deployment shapes. UpCloud and Evroc
are supported infrastructure foundations for these operator-managed releases.

Select jurisdiction, support lifecycle, images, dependencies and recovery policy
according to the deployment's requirements. Provider or operating-system branding
does not by itself qualify an instance's compliance or reproducibility. The engine
is vendored and hash-checked, and the console self-hosts its assets. Optional DAM,
identity, email, model and proxy integrations may still reach external services.
Inventory those paths before making a sovereignty or offline-operation claim.

See the [cloud deployment guide](cloud-deployment.md) for provider differences and
real boot, capacity and restore gates. The existing host provisioner supports
openSUSE; another OS needs equivalent host preparation. Rancher/Helm retains the
same application configuration and release checks on either cloud.

## Rancher: RKE2 and k3s - both supported

![Rancher](img/rancher-icon.svg) ![k3s](img/k3s-icon-color.svg) ![Helm](img/helm-icon-color.svg)

The chart targets **any conformant Kubernetes** and is exercised against both
Rancher-managed distributions: **RKE2** (datacenter - etcd, ingress-nginx, CIS/FIPS
posture) and **k3s** (edge - verified live 2026-08-11 on k3s v1.35: install, Traefik
ingress via the cluster default class, sign-in gate, catalog, renders). There is **no
k3s API ceiling** for this workload - k3s is CNCF-conformant, and the chart uses only
core primitives (Deployment, Service, Ingress, Job, HPA). The honest k3s boundaries are
operational, not functional:

- **Datastore:** k3s defaults to SQLite - fine for a single server node; a multi-server
  HA control plane needs k3s's embedded etcd (a provisioning choice Rancher makes for
  you), same as RKE2 always does.
- **Ingress:** an empty `ingress.className` uses the cluster's configured default.
  Verify the controller and TLS configuration on your selected K3s/RKE2 platform.
  Keep one writable collaboration owner on every supported cluster. The reserved
  multi-replica affinity settings do not enable room routing, and installing a
  different ingress controller does not bypass the chart's single-owner limit.
- **Edge headroom:** the light topology (no Chromium) is the edge default - the eval
  install below requests 100m/192Mi. The render worker wants ~2 GB per pod; on small
  boxes leave it off (hooked tools answer 501 and shells are told upfront) or point
  `render.worker.url` at a worker running on beefier hardware.
- **ARM nodes:** release images are multi-arch (amd64 + arm64) from v0.2.0.

### Evaluation in one command (no Postgres, no IdP, no pack mount)

**The command lives in [install section 7a](install.md#7a-evaluate-on-a-cluster)**, with the
verification ladder and the persona addresses alongside that ladder. This page
describes what that install *is*.

What you get: in-memory store (a restart is a factory reset - a feature for demos),
passwordless dev personas through the real sign-in gate (including an `owner`, so the
owner-only actions are reachable), the demo pack served from inside the image, renders
working, console at `/admin`. Every choice in `values-eval.yaml` is commented with what it
trades, including `config.instance.baseUrl`, which must match the URL a browser actually
uses or the session cookie's `Secure` flag will be wrong.

For a real team, prepare a separate production release from the chart defaults
and reviewed environment values. Adding PostgreSQL does not transfer existing
memory records or replace evaluation sign-in, known keys and evaluation mode.
Do not merge `values-eval.yaml` into that production release. Follow
[the transition checklist](install.md#moving-from-evaluation-to-production) and
[production installation](install.md#7b-production). Keep one writable application
replica until room routing and operation ordering are qualified. Independent
render workers can scale after capacity testing.

The official 1.1.1 GHCR images are public. An operator-owned private mirror needs
`imagePullSecrets`; a disconnected cluster needs verified image transport, such as
`docker save` with `k3d image import` or `ctr images import` on the node.

<a id="kubernetes-helm---the-production-path"></a>

## Kubernetes (Helm) - the production path

`deploy/helm/values.yaml` is the one file you edit; it is heavily commented and is the
authority if it disagrees with this page.

For an employee-only first release, the source checkout includes the optional
`deploy/helm/values-internal.yaml` policy overlay and instructions in
`deploy/helm/INTERNAL-RELEASE.md`. Merge it with the existing environment configuration
and collect evidence from staging before production promotion.

**The install commands live in [install section 7b](install.md#7b-production)** - secret creation,
`helm install` with the image override, and the verification. One copy, there. This page is
the values reference and the list of things to know before you run the chart.

What the chart gives you: one application replica by default, non-root/read-only-rootfs/dropped-caps
pod defaults, `/healthz` liveness and `/readyz` readiness, an Ingress template, an optional
ServiceMonitor, an optional NetworkPolicy, a pack volume, a shell volume, an optional
Chromium render-worker tier, and a migrate Job that owns the schema.

Things to know before you install:

- **Official release images are public.** The `lolly-tools` server and worker
  packages need no GHCR credentials. Select qualified immutable digests from the
  release record; use credentials only for an operator-owned private mirror.
  See [official installation routes](official-installations.md) for publication
  and architecture limits.
- **`instance.baseUrl` must match the URL the deploy answers on.** It drives OIDC redirect
  URIs and the `Secure` cookie flag.
- **Secrets are never auto-generated.** Every replica must sign and verify with the *same*
  `LW_SESSION_SECRET` and `LW_LINK_SECRET`, and they must survive rollouts. Generate once,
  store safely, rotate deliberately.
- **Schema ownership:** with `migrate.enabled=true`, the app runs with
  `LW_AUTO_MIGRATE=false`. The pre-install/pre-upgrade Job applies migrations and
  must succeed before the application starts; boot refuses a pending schema.
  The singleton deployment uses `Recreate` and a 60-second drain to avoid
  competing writable collaboration owners during rollout.
- **`pack.type` defaults to `none`** - `config.instance.pack` points at `/app/packs/demo`,
  the small demo pack baked into the server image, so an unmounted install still serves a
  catalog. Mount your own pack and point `config.instance.pack` at that pack. Simplest
  delivery: bake the pack into an image (`COPY packs/ /pack/` on a busybox base), set
  `pack.image` to its ref and `pack.type: emptyDir` - an initContainer copies it into the
  pack volume before the server starts. The same `pack.image` also works with
  `pvc`/`existingClaim` if you'd rather populate a persistent volume.
- **`shell.enabled` defaults to `false`** - `/admin` and the API only. Mount a built
  `shells/web/dist` and set `config.instance.shellDir` to serve Lolly at `/`. Under a
  non-`open` access mode a missing or pre-governance dist **stops boot** (escape hatch:
  `LW_ALLOW_STALE_SHELL=1`), because a stale shell would quietly un-govern every employee.
  `shell.image` delivers the dist the same way as `pack.image` (`COPY shells/web/dist/
  /shell/`, then `shell.type: emptyDir`) - and since each rollout re-copies from the image
  you pin, the dist can't silently age in a PVC.
- **`renderWorker.enabled` defaults to `false`** - hooked/HTML-heavy tools `501` until the
  worker exists. When you enable it, also set `config.render.worker.url` to the worker
  Service and `renderWorker.webBase` to the canonical HTTPS web shell with trusted
  TLS, and prefer a sandboxed
  `runtimeClassName` (gVisor/Kata) - that tier renders the least-trusted content.
  The browser needs a [secure context](https://www.w3.org/TR/secure-contexts/)
  for Web Crypto. A HTTP cluster Service URL is suitable for the HMAC worker API,
  but fails as the browser's shell base. HTTP shell bases are accepted only for
  explicit `localhost`, `127.0.0.1` or `[::1]` development. Provide a URL without
  credentials, query strings or fragments; an optional base path is supported.
  Keep certificate validation enabled and arrange certificate renewal at the edge.
  For a public HTTPS origin, allow DNS and public TCP 443 egress. A private HTTPS
  edge needs both a declared origin and a narrowly scoped egress rule for its real
  address and port. Verify a complete authenticated Work render, poll its durable
  status and compare the downloaded output's size and SHA-256; a direct raster
  request or healthy worker probe does not exercise shell export or read tickets.
- **Behind an ingress, set `config.rateLimit.trustedProxyHops: 1`**, or per-IP limits see
  only the ingress IP.

### Small SUSE cluster profile

`deploy/helm/values-small-suse.yaml` adds explicit CPU, memory and ephemeral disk
budgets for a small K3s or RKE2 candidate. It retains one application owner and
leaves the render worker, OCI pack and signed shell opt-in. Merge the profile
before your reviewed instance values:

```sh
helm template lolly-work deploy/helm \
  -f deploy/helm/values-small-suse.yaml -f instance-values.yaml
```

Use the rendered output for review before applying the production installation
procedure. Supply the same existing application and database Secrets, instance
configuration and ingress as any other production install. This overlay does not
create a cluster, database, shared collaboration relay or backup service.

Pin `image.digest` and `renderWorker.image.digest` to the SHA-256 digest of the
complete application images you publish. The digest replaces `image.tag`; an
empty digest retains the previous tag behavior. The app and migration Job share
one image reference. `imagePullSecrets` now also reaches render workers; set
`renderWorker.imagePullSecrets` only when that tier needs different credentials
(`null` inherits, `[]` opts out). Worker `nodeSelector`, `tolerations`, `affinity`
and `topologySpreadConstraints` let larger clusters separate browser workloads.

The profile bounds `/tmp`, OCI pack and shell `emptyDir` copies and their init
containers. Set `tmp.sizeLimit`, `pack.emptyDir.sizeLimit`,
`shell.emptyDir.sizeLimit` and `renderWorker.tmp.sizeLimit` for your actual release
sizes; default empty values preserve existing behavior. Container
`ephemeral-storage` budgets also cover writable layers and logs. Image-cache
space, database growth and rollback releases need separate node-disk headroom.
Pack and shell copies are reproducible artifacts; durable records and uploaded
asset bytes belong in PostgreSQL or the configured object store.

For browser exports, enable the worker explicitly, supply its matching secret
and shell origin, and set `config.render.worker.url` to its Service. The small
profile starts with one worker and one concurrent render. Its HPA remains off;
enabling HPA scales pods and requires existing node capacity and metrics.
Measure shared editing, renders and recovery on the chosen host before cutover.

See the [SUSE deployment runbook](../deploy/suse/README.md) for cluster and storage
choices, preferred image sources and Application Collection dependencies.

### Environment dependencies

Pull from the [Rancher Application Collection](https://apps.rancher.io/applications) where
you can:

| Component | Required? | Notes |
|---|---|---|
| PostgreSQL 16/17 | **yes** | the only hard external service |
| Ingress (nginx) | practically | chart ships the Ingress template |
| cert-manager | practically | TLS; annotation example is in `values.yaml` |
| Keycloak or any OIDC IdP | yes for SSO | fully IdP-agnostic; `idp.displayName` identifies it in the UI |
| kube-prometheus-stack | optional | ServiceMonitor template included; `/metrics` is token-gated |
| Node.js base image | yes | default Node 26 Alpine; SUSE BCI `bci/nodejs:24-base` is the separately qualified alternative |
| S3-compatible object store | optional | only for the S3 catalog provider |
| Chromium worker image | optional | built in-repo from `workers/render` |

Everything else is deliberately in-tree: no CDN assets (the console is air-gap-safe, fonts
self-hosted), no Redis/queue/cache tier, no external SaaS in the serving path.

## Single VM (Compose)

**The commands live in [install section 5](install.md#5-container-compose)**, including the `.env`
recipe (three variables, not two - `PG_PASSWORD` has a default nobody chose) and the TLS /
`baseUrl` / `trustedProxyHops` work this shape still needs. One copy, there.

Two constraints that shape those commands. The compose file uses the fail-if-unset form for
both `LW_` secrets, so `up` aborts without `.env`; and Docker creates a *directory* at a
missing bind source, so a missing repo-root `instance.json` makes the server read a
directory as its config. The mounted `instance.json` is the one you authored at
[install section 2](install.md#2-your-first-real-instance), not a fresh copy of the example.

`instance.json` and `packs/` are bind-mounted read-only from the repo root;
`LW_AUTO_MIGRATE` stays at its
default (`true`), so this single-node path applies pending migrations at boot with no
separate step. The server waits on the database's `pg_isready` healthcheck before it boots,
because its migration step connects once with no retry.

The shell is not mounted by default (console + API only). A commented-out mount in
`docker-compose.yml` shows how: bind a built `shells/web/dist` and point
`instance.shellDir` at that build. The same boot guard as Helm applies - under a non-`open`
access mode, `instance.shellDir` with a missing or stale dist stops boot
(`LW_ALLOW_STALE_SHELL=1` to override).

## Single VM with Caddy

This kit remains available for new instances. Its lolly.ing example records the
former Compose deployment; the current hosted production uses K3s as described
above. Do not use the old example to update either production domain.

For repeatable VM creation, the [UpCloud and Evroc guide](cloud-deployment.md) covers
the OpenTofu/Terraform modules, credential-free qualification and the optional
local PostgreSQL deployment. The default VM deployment retains its external
database and existing public API proxy.

`deploy/vm/` runs a private instance on one server: Caddy for TLS and routing, the
lolly-work server built from `deploy/compose/Dockerfile` (it runs the live co-editing gateway
in process), and a configured Postgres database holding the records
and the blobs. With `instance.shellDir`, Caddy sends static shell requests to the
Work server for native signed-shell serving. Otherwise it proxies the public shell
with the session cookie removed. Public OSS API functions continue through the
public API proxy until standalone parity is qualified. Control-plane paths and
`/ws/collab/<session>` go to the Work server. `node scripts/build-caddyfile.ts` writes `deploy/vm/Caddyfile`;
`tests/vercel-routes.test.ts` checks both tables agree on every path but the WebSocket.

The kit: `bootstrap-opensuse.sh` (puts openSUSE Leap 16.0 on an UpCloud server, which has
no openSUSE template, by way of a Debian one), `provision.sh` (Leap 16 as `sles` through
sudo: Docker, firewalld, SELinux enforcing with labelled bind mounts, automatic security
updates, keys-only ssh),
`secrets.sh` (the env file over ssh, mode 0600, no value printed), `push.sh` (a clean
source export, the pack and the configuration, then build, restart and reload), and
`smoke.sh` (checks by IP with `curl --resolve`, before and after the DNS cut). The runbook,
including historical migration details, is `deploy/vm/README.md`.

Two settings matter on a database that scales to zero. `LW_BACKGROUND_POLL_MS=0` stops the
render and automation runners from polling every second (work still runs at boot, on
submission and after each finished item), and the container health check is a TCP connect,
because every HTTP request reads from the database. With `0`, a pending job callback still
sets a single timer for its next attempt, so the database may be woken for up to about 45
minutes after a job with a callback settles. Nothing runs on a clock while no callback is
pending and the database answers. Migrations run over
`DATABASE_URL_UNPOOLED` when it is set and take a transaction-level lock, so a connection
pooler cannot keep the lock after the runner leaves.

## Vercel (trial / public demo)

Vercel hosts a public evaluation path with the limitations below. It is optional
for self-hosted Work. Moving a public host to UpCloud or Evroc requires complete
API parity and an accepted candidate release, as described in the
[cloud deployment guide](cloud-deployment.md#public-shell-cutover).

`vercel.json` runs `scripts/build-vercel-fn.mjs` as the build command: it esbuild-bundles the
whole app + the vendored engine into one plain-JS function (Build Output API) - necessary
because Vercel's per-file transpile can't resolve this repo's `.ts`-native imports, and Node
won't type-strip the engine under `node_modules`. Config arrives as one JSON string in
`LW_CONFIG_JSON`; persistence needs a Neon Postgres (EU region) via the Marketplace, else the
in-memory store (ephemeral). On the public demo (no `DATABASE_URL`, `dev.enabled`), that
in-memory store is **fully seeded on every cold start** - governance fixture, plus 14 days of
usage telemetry, a mixed fleet, shared links, approvals across every state, and a synthetic
live-room registry - so a signed-in visitor arrives at populated dashboards, not empty states
(`scripts/demo.ts` `seedStore`/`seedActivity`/`demoRooms`; details in `deploy/vercel/README.md` section 5).

Auth, org-config, RBAC, overlays, links, telemetry, inbox, audit, fleet, console, CLI **and
`/render/*`** all work - the small `packs/demo` (qr-code, mesh-gradient, colour-palette) is
bundled into the function, so Tier-A (SVG + resvg PNG) renders in-process. What's still
absent: no large real pack mount, no Chromium (Tier-B jpg/pdf), the 1.9 GB Lolly
web shell is not served (the demo landing at `/` stands in), and **no real WebSocket collab**
(the Rooms panel shows mock rooms; live editing is the sovereign Helm deploy's ws gateway -
see `deploy/vercel/WS-SPIKE.md`). This adapter is optional; the hosted **lolly.work**
evaluation now uses the isolated UpCloud/K3s workload described above. Adapter
runbook: `deploy/vercel/README.md`.

## Verifying the images

Release images (`v*` tags) are signed keylessly in CI and carry SBOM + provenance
attestations. Verification needs no key of ours - the signature binds to the release
workflow's own identity:

```bash
cosign verify ghcr.io/lolly-tools/lolly-work-server:<version> \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  --certificate-identity-regexp 'github.com/.+/lolly-work/\.github/workflows/release\.yml@.*'
```

The same recipe covers `lolly-work-render-worker`. A cluster can enforce this at admission
(Kyverno/Sigstore policy controller) so an unsigned or re-tagged image never schedules.
The source SBOM (`sbom.cdx.json`) stays in the repo beside the per-image attestations.

## Air-gap

An offline deployment needs an explicit inventory and qualification of every
external path: DAMs, OIDC, SMTP, public API proxies, model downloads, certificate
enrollment and ACME. The console self-hosts its assets and fonts; packs and the
engine can be local. Stage and verify container images, charts, signed shells,
models and certificates before isolating the network. Test the required user and
agent flows with egress denied rather than inferring air-gap support from the
application packaging.

## Related

- Every key you can set: [configuration](configuration.md)
- Day-two work (migrations, backup, metrics, upgrades): [operations](operations.md)
- What is not production-ready yet: [status](status.md)
