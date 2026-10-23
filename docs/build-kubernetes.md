# Run on Kubernetes

This page is for a platform engineer who wants Lolly's web app on their own cluster: air-gapped, on premises or beside the rest of a platform. At the end, the web app answers on your hostname with TLS, and the optional MCP and CA services are one setting away.

The chart is plain Kubernetes, so it deploys on any conformant distribution, including RKE2 and <!--l:k3s-->k3s, and on any managed service. Any static web server can host the web build too; [Choose a deployment](/info/deployment.html#host-the-web-app) covers that path and the routes and headers every host needs. The image described here already sends those headers.

<!--lb:kubernetes helm-->

## Use the published images

From Lolly 1.1.1, every release publishes signed, attested `linux/amd64` images at `ghcr.io/lolly-tools/`, tagged with the release version:

| Image | What it runs |
|---|---|
| `lolly-web` | The web app, on <!--l:nginx-->nginx |
| `lolly-mcp` | The MCP server, for SVG, data and PNG renders without a browser |
| `lolly-mcp-browser` | The MCP server with Chromium, for the browser formats |
| `lolly-ca` | The Content Credentials identity service |
| `lolly-penpot` | The Penpot pass-through |

They carry the profile lolly.tools ships: [Lolly Demo](/info/lolly-demo.html) (`lolly-demo`) from 1.1.2, and the neutral `lolly-start` in 1.1.1. Each release lists every image's digest in its `images.json`. The [published images guide](https://github.com/lolly-tools/lolly/blob/main/deploy/docker/README.md#published-images) shows how to verify them with cosign, mirror them and pin a digest.

Build your own image instead (see [Build your own image](#build-your-own-image)) for another brand profile, your own signing key or another base image.

## Install the chart

`deploy/helm/` is the chart. There is no hosted chart repository, so install from a checkout of this repository.

::: timeline
- <!--i:folder--> **Create a namespace:** `kubectl create namespace lolly`.
- <!--i:lock--> **Add a pull secret, only for a private registry**, and name it in `imagePullSecrets`. Skip this step for the published images.
- <!--i:download--> **Install, pinned by digest.** Take the web image's digest from the release's `images.json`. For an image you built, also set `web.image.repository`.
- <!--i:monitor--> **Try it** with a port-forward before you publish a hostname.
- <!--i:globe--> **Publish it** on your hostname with TLS.
:::

```bash
helm upgrade --install lolly ./deploy/helm -n lolly \
  --set web.image.digest=sha256:<digest>

kubectl port-forward -n lolly svc/lolly-web 8080:80   # then open http://localhost:8080/
```

To publish on your own hostname with a TLS certificate from cert-manager:

```bash
helm upgrade --install lolly ./deploy/helm -n lolly \
  --set web.image.digest=sha256:<digest> \
  --set web.ingress.enabled=true \
  --set web.ingress.hosts[0].host=lolly.example.com \
  --set web.ingress.tls[0].secretName=lolly-web-tls \
  --set web.ingress.tls[0].hosts[0]=lolly.example.com
```

`NOTES.txt` prints the resulting addresses, which components came up and any secret still missing.

### What the chart deploys

`web` is on by default: two stateless replicas behind a ClusterIP service, a TLS-ready ingress you turn on with a hostname and `/healthz` liveness and readiness probes. The web app holds no state on the server (everything lives in each browser's IndexedDB), so replicas are interchangeable and you can raise the count freely. `mcp` and `ca` stay off until you turn them on.

Every pod gets the same secure defaults:

- runs as non-root under `RuntimeDefault` seccomp, with all capabilities dropped and no privilege escalation;
- a read-only root filesystem, with writable `emptyDir` volumes only where nginx needs them;
- no ServiceAccount token mounted, because none of the components talk to the Kubernetes API;
- soft pod anti-affinity, which spreads replicas without blocking a single-node cluster;
- an optional NetworkPolicy, off by default, that limits ingress to each component's port.

The values you are most likely to change:

```yaml
web:
  enabled: true
  replicaCount: 2
  image:
    repository: ghcr.io/lolly-tools/lolly-web   # or your registry
    tag: ""                                     # empty means the chart's appVersion
  service:
    port: 80
    targetPort: 8080        # what nginx-unprivileged listens on
  ingress:
    enabled: false
    hosts:
      - host: lolly.example.com
        paths: [{ path: /, pathType: Prefix }]

imagePullSecrets: []        # for a private registry
```

Read `values.yaml` top to bottom before a production install. It is written to be read, and its `mcp` and `ca` sections say what each service needs.

::: details The chart's files
```
deploy/helm/
├── Chart.yaml
├── values.yaml               ← the one file you edit
├── values.schema.json
├── README.md
├── profiles/
│   ├── lean.yaml             small-cluster resource profile
│   └── sovereign/            separate single-node chart (see its README)
└── templates/
    ├── _helpers.tpl          names, labels, image references
    ├── _ca-managed.tpl       checks for the managed CA mode
    ├── web-deployment.yaml   the web app (on by default)
    ├── web-service.yaml
    ├── mcp-deployment.yaml   MCP server (opt-in)
    ├── mcp-service.yaml
    ├── ca-deployment.yaml    credential authority (opt-in)
    ├── ca-service.yaml
    ├── ca-secret.yaml        chart-managed secret only
    ├── ca-vault-networkpolicy.yaml  managed CA mode only
    ├── ingress.yaml          one Ingress per enabled component
    ├── networkpolicy.yaml    off by default
    ├── serviceaccount.yaml
    └── NOTES.txt
```
:::

## Turn on MCP or CA

Both stay off until you ask for them, and both are stateless by default.

**MCP** (`--set mcp.enabled=true`) offers the tool catalog to AI agents over Streamable HTTP on port 8790. Its brand content is fixed when its image is built, exactly like the web image. The default `lolly-mcp` image ships no Chromium: SVG, data and resvg PNG work without a browser, and browser-tier formats are refused. For PNG, JPEG, PDF and video through Chromium, set `mcp.image.repository=ghcr.io/lolly-tools/lolly-mcp-browser` and point it at your web app with `--set mcp.webBase=https://lolly.example.com`. Liveness is a TCP socket check; readiness polls `/readyz`, which turns 503 while the server drains. The optional private result files (`mcp.privateFiles.enabled`) live in one process and expire on restart, so that mode needs `mcp.replicaCount: 1`.

**CA** (`--set ca.enabled=true`) issues short-lived certificates for on-device C2PA signing on port 8787, under `/api/ca`. Set `ca.config.allowedOrigins` to your web host, or enrolment tokens are rejected. It has two issuer modes:

- **The default, `ca.config.issuerMode: legacy-root`,** needs a root key and certificate, made once with `node services/ca/scripts/gen-root.mjs`, plus a service secret (`openssl rand -hex 32`). Fill in `ca.secrets` and let the chart create the Secret, or, the production choice, set `ca.existingSecret` to one your platform's secret store manages and leave `ca.secrets` empty. The chart refuses to render a CA with a missing root.
- **The managed mode, `ca.config.issuerMode: vault-pki`,** issues from a Vault PKI mount configured under `ca.config.managed`. The root key stays in Vault, the chart refuses root key or certificate values and a NetworkPolicy limits the CA's egress to the peers you list. With Vault's Kubernetes sign-in, the CA pod is the one exception to the no-token rule: it gets a ten-minute service-account token whose audience is Vault, not the Kubernetes API.

## Build your own image

`deploy/docker/web.Dockerfile` packages a frontend that was already compiled and signed. The image build runs no compiler and never receives a private key.

::: figure build-kubernetes-signed-image
From a reviewed commit to running pods. Signing happens before the image build, and the image build only checks and packages.
:::

The signed frontend comes from the reusable `release-frontend.yml` workflow, or your own equivalent: a protected job signs the source catalog, a separate job compiles with only the public pin and a second protected job signs the output catalog and a receipt binding the source commit, content profile, public key and every file. The [signed image guide](https://github.com/lolly-tools/lolly/blob/main/deploy/docker/README.md) covers key custody, the jobs and the release gate. Never put a private key in an image build argument, context or BuildKit mount.

Package an approved frontend directory with its reviewed source commit and public pin. The **build context must be the repository root**:

```bash
docker buildx build --load --no-cache-filter verify -f deploy/docker/web.Dockerfile \
  --build-context "release-frontend=/approved/frontend" \
  --build-arg "LOLLY_RELEASE_SOURCE=<reviewed-commit-sha>" \
  --build-arg LOLLY_PROFILE=lolly-start \
  --build-arg "VITE_CATALOG_PUBLIC_KEY_JWK=$VITE_CATALOG_PUBLIC_KEY_JWK" \
  -t <your-registry>/lolly-web:<release> .
docker push <your-registry>/lolly-web:<release>
```

The Dockerfile has two stages:

- **verify:** `node:26-bookworm`, pinned by digest, with no network. It checks the WebGPU release gate, then verifies the receipt, every file, the signed catalog and the delivery configuration against the source commit, profile and public pin you supplied. A changed, extra, missing or symbolic-link file, or a different source, profile or key, fails the build. `--no-cache-filter verify` repeats these checks on every build.
- **runtime:** `ghcr.io/nginx/nginx-unprivileged`, also pinned by digest, running as uid 101 on port **8080**. The verified frontend goes to `/usr/share/nginx/html`, `deploy/docker/nginx.conf` becomes `conf.d/default.conf`, and `security-headers.conf` and the delivery header files go into `/etc/nginx/`.

The content profile (`lolly-demo`, `lolly-start` or `suse` with the private pack mounted at compile time) is fixed when the frontend is compiled and signed. `--build-arg LOLLY_PROFILE` must name the same profile, and the verify stage refuses another. Nothing is read at serve time, which is why the chart mounts no pack, configuration or secret for the web app; changing brand means a new signed frontend, a new image and a rolled deployment. Model files are the exception: the image ships none, and an optional read-only volume at `/usr/share/nginx/html/models` serves them (the published images guide gives its layout).

`mcp.Dockerfile`, `mcp-browser.Dockerfile`, `ca.Dockerfile` and `penpot.Dockerfile` also build from the repository root and run their entry point on Node as the non-root `node` user: MCP, CA and Penpot on a digest-pinned `node:26-alpine`, and the browser MCP image on `node:26-bookworm-slim` with a lockfile-scoped Chromium. Build them only if you turn those components on and do not use the published images.

### What the nginx config already handles

The web app is a single-page app, so the server has real work to do. Link deep links (`/?tool=qr-code`) must fall back to `index.html`, the service worker must never be cached, hashed files should be immutable, the HarfBuzz `.wasm` and the `.webmanifest` need correct MIME types, and the security headers belong on every response. `deploy/docker/nginx.conf` does all of that, and `tests/security-headers.test.ts` pins its CSP against the other shipped copies, so edit the file rather than writing a fresh one.

- **Two servers.** The public server listens on port 8080 and proxies to an internal static server on `127.0.0.1:8081`, setting the content ETag that browsers revalidate against.
- **Real files, then the app.** The internal server serves `/usr/share/nginx/html`. `/info/`, `/t/`, `/view/`, `/tools/` and `/catalog/` serve real files and return 404 when one is missing. `/api/`, `/live/` and `/tool/` return 404, because separate services own them. Everything else tries the file, its `.html` twin and a directory index before falling back to `index.html`.
- **Headers on every location.** Each location includes `/etc/nginx/security-headers.conf`, which sends the security headers and the cache policy. The policy comes from `delivery-maps.conf`, generated by `scripts/build-delivery.ts` and keyed on status and path: `no-cache` for `sw.js`, long `immutable` caching for hashed `/_app/` files and other content-hashed paths, and revalidation for other successful responses.

The repeated `include` is needed because nginx drops inherited `add_header` lines inside any location that declares its own; [Choose a deployment](/info/deployment.html#the-headers-you-must-serve) explains the trap. Keep the include when you add a location. The file also carries an unauthenticated `/healthz` for the chart's probes, explicit `types` for `.wasm`, `.avif` and `.webmanifest`, read-only CORS for `/models/` and the short clean-route aliases (`/d`, `/v`, `/a`, `/start`, `/batch` and the rest) that mirror the other shipped web server configurations. Mirror every clean route when you write your own.

::: details Use a SUSE nginx base image
The runtime stage uses the upstream unprivileged nginx image so a plain `docker build` works with no registry credentials. To use a curated SUSE base instead, replace that one `FROM` line and leave the `COPY` lines alone. Two free and paid sources exist:

- <!--l:suse-->**SUSE BCI**, free with no login: `FROM registry.suse.com/suse/nginx:<tag>`, with a current tag. Its default document root is `/srv/www/htdocs/`, but the shipped `nginx.conf` sets `root` explicitly, which wins whatever the base's default.
- **The [SUSE Application Collection](https://apps.rancher.io)**, a curated, signed, continuously rebuilt catalog of images and Helm charts based on SUSE Linux Enterprise Base Container Images: `FROM dp.apps.rancher.io/containers/nginx:<tag>`, with the current tag from its nginx page.

Check two things against whichever base you pick. The frontend must be copied where the `root` directive points, or change the directive. And the server listens on 8080 because non-root nginx cannot bind below 1024; if your base runs as root and you switch to 80, change `web.service.targetPort` in the chart to match.
:::

::: details Pull from the SUSE Application Collection
The Collection's OCI registry is `dp.apps.rancher.io` (images under `/containers/<name>`, charts under `/charts/<name>`); `apps.rancher.io` is the catalog where you create credentials, and `docs.apps.rancher.io` holds its documentation. Pulls are never anonymous. You need a SUSE Customer Center account (`scc.suse.com`), then a personal **access token** (Settings, Access tokens) or an organisation **service account** (Settings, Service accounts).

The free tier limits pulls, and its terms differ between personal tokens and service accounts, so unattended in-cluster pulls may need a paid organisation subscription. The terms can change; check the current ones on `apps.rancher.io`. If a subscription is not an option, use the free SUSE BCI image above.

A user account logs in with its username and an access token; a service account uses its own username and a secret, never your account password:

```bash
helm registry login dp.apps.rancher.io -u <username-or-sa-username> -p <access-token-or-sa-secret>
docker login        dp.apps.rancher.io -u <username-or-sa-username> -p <access-token-or-sa-secret>
```

For in-cluster pulls, create a pull secret and name it in the chart's `imagePullSecrets` (`--set imagePullSecrets[0].name=application-collection`):

```bash
kubectl create secret docker-registry application-collection \
  --docker-server=dp.apps.rancher.io \
  --docker-username=<username-or-sa-username> \
  --docker-password=<access-token-or-sa-secret> \
  -n lolly
```

The Collection carries charts for stateful services such as redis, postgresql, prometheus and cert-manager, but neither a generic static web server chart nor a Lolly chart: nginx is there as an image only. For the current registry paths, tags, chart versions and value keys, see the [Application Collection docs](https://docs.apps.rancher.io) and run `helm show values oci://dp.apps.rancher.io/charts/<chart>` before relying on any default.
:::

## TLS with cert-manager

Let cert-manager issue the Ingress certificate. Install it from wherever your platform takes charts. The Application Collection carries it as a real chart, installed with the pull secret from the section above:

```bash
helm install cert-manager oci://dp.apps.rancher.io/charts/cert-manager \
  -n cert-manager --create-namespace \
  --set crds.enabled=true \
  --set 'global.imagePullSecrets={application-collection}'
```

Then add a `ClusterIssuer` (for example Let's Encrypt), point `web.ingress.tls[0]` at a secret name, and annotate the Ingress through `web.ingress.annotations` (`cert-manager.io/cluster-issuer: letsencrypt-prod`). `mcp` and `ca` take the same three keys under their own sections. Every Application Collection chart accepts the same `global.imagePullSecrets` setting.

## Small clusters: the lean profile

`deploy/helm/profiles/lean.yaml` is a small-cluster candidate: one pod per enabled public component, bounded CPU and memory and disk-backed temporary volumes. MCP and CA stay opt-in. Merge the profile before your instance settings:

```sh
helm template lolly deploy/helm \
  -f deploy/helm/profiles/lean.yaml -f instance-values.yaml
```

Pin each component's `image.digest` to the complete Lolly image you publish; it replaces the tag. Top-level `imagePullSecrets` reaches all three services. `tmp.sizeLimit` bounds each service's temporary volume and `web.cache.sizeLimit` bounds nginx's cache, and the profile sets container `ephemeral-storage` budgets too.

With all three components on, requests total 100 millicores, 224 MiB of memory and 224 MiB of ephemeral disk. Cluster services, ingress, image caches, browser workloads and external dependencies need capacity of their own. These are scheduling reservations, not a measured traffic limit or a high-availability claim.

K3s and RKE2 can share qualified node capacity between services. Cloud worker nodes may still be VMs, and containers do not remove their compute charges. The [Lolly Work SUSE deployment runbook](https://github.com/lolly-tools/lolly-work/blob/main/deploy/suse/README.md) covers operating-system support, resource profiles, UpCloud and Evroc storage drivers and Longhorn. Durable PostgreSQL storage and independently tested backups have a different lifecycle from reproducible shell and pack copies.

::: details Base images and dependencies for a K3s or RKE2 platform
Prefer `registry.suse.com` BCI bases and [Application Collection](https://apps.rancher.io) dependencies when their versions meet the release requirements. Collection content comes from `dp.apps.rancher.io` and needs registry authentication and the account's entitlements. Build Lolly into the chosen base and test each architecture; a Node or nginx base alone does not contain the application. The optional Lolly Work BCI Node 24 Dockerfile is a candidate with its own build and boot checks. The public web, MCP and CA images keep their existing bases until another variant is qualified.

Following the Collection's Penpot dependency model, Lolly Work can use a separately managed Collection PostgreSQL 18 release once it passes schema, version-compatibility and backup-and-restore checks. Its durable jobs already use PostgreSQL, so this adds no Redis requirement. A Redis TCP endpoint also cannot replace the public services' current REST admission adapter without an integration change.

The original public chart does not install Lolly Work, its relay, Penpot or model hosting. The sovereign profile below adds the public routes and edge while leaving the private services to their own owners. Qualify every existing API route, authentication, shared editing, recovery and capacity before a public or private production cutover.
:::

## One node, public and private routes: the sovereign profile

The optional [sovereign profile](https://github.com/lolly-tools/lolly/blob/main/deploy/helm/profiles/sovereign/README.md) is a separate chart at `deploy/helm/profiles/sovereign/`. It runs the public web app, MCP with its single public live relay, the CA and the Penpot adapter behind one Caddy edge. The edge has separate public and private host configuration: private sign-in, API, catalog, admin and collaboration routes reach an existing Lolly Work service, and private `/live/*` reaches its separate qualified relay. The profile does not replace Lolly Work, its database, worker or private relay, and it mounts no private content in public pods.

For the same public route contract without Kubernetes, use the [public VM recipe](https://github.com/lolly-tools/lolly/blob/main/deploy/docker/public-vm.md). Both include docs and discovery routes, reserved-path 404s, MIME and cache policy, model HEAD and Range requests, MCP and OAuth, CA, Penpot streaming, image fetch and live editing. Models come from a verified immutable release mounted read-only in the web container; the [model release guide](https://github.com/lolly-tools/lolly/blob/main/deploy/models-host/README.md) has the preparation and verification commands.

UpCloud and Evroc remain first-class provider foundations. Choose the right storage driver or existing volume, and qualify real node boot and routing on each provider. Keep Traefik and ServiceLB turned off for this profile: the single non-root Caddy binds host ports 80 and 443 directly, in its own edge namespace, with a constrained admission exception. Public and private application namespaces keep restricted Pod Security. Provider and host firewalls must deny public access to Kubernetes, the kubelet, the database and VXLAN. Measure the actual edge-to-Service peer before setting proxy trust; an outgoing source-address setting alone does not prove the observed peer.

::: details Certificates, capacity and what to qualify
The default certificate mode uses Caddy's automatic ACME issuance and renewal with a persistent edge volume. Before DNS changes, use the file-certificate mode with a trusted internal CA or a pinned certificate, and test with candidate-address requests. After the domain cutover, qualify provider callbacks and ACME renewal.

The profile starts at 352 MiB of memory requests and 1600 MiB of memory limits for the public services plus the edge. Lolly Work, PostgreSQL 18, the worker, the private relay and cluster overhead need separate capacity. These are starting bounds and single-process ownership, not a high-availability or load result.

The original chart and this chart keep separate defaults. The sovereign profile needs qualified image digests, distinct MCP and CA Secrets, measured exact proxy peers, reviewed admission and an existing model volume. It keeps the current durable REST rate limiter and CA email adapters until replacements are qualified. Before publishing, run real HTTPS routes, signed-catalog verification, admission refusal, cookie and authorisation custody, shared editing and invited-agent checks; schema validation alone does not qualify a cloud cutover.
:::

## Browser exports and the Chromium sandbox

For browser-only public exports, the optional `mcp-browser.Dockerfile` and `browser.values.yaml` add Chromium with a bounded queue and larger resource budgets. The ordinary image stays browser-free. Set the exact public HTTPS web base and qualify sandbox startup and real exports. Keep the deployment's reviewed anonymous or bearer policy. Turning the browser on never grants access to private Lolly Work files or workspace documents.

The optional [namespace sandbox profile](https://github.com/lolly-tools/lolly/blob/main/deploy/docker/seccomp/README.md) keeps Chromium's own sandbox on under the container's dropped capabilities. Install and verify its exact hash on the chosen node first, then opt MCP into its Localhost seccomp profile; the other services keep `RuntimeDefault`. Qualify the namespace and seccomp diagnostics and real SVG, PNG and PDF exports after each browser or runtime change. The chart neither installs a host profile nor substitutes a sandbox bypass.

## Update the application

For a normal update, keep the cluster, database, Secrets, storage and hostname in place. Build and qualify the affected image from an exact reviewed commit, then promote its tested digest with `helm upgrade`. Keep the previous release's hashed files available for tabs that are already open (see [Delivery deployment](/info/deploy-delivery.html#build-and-retain-actual-files)).

For Lolly Work, use its [application update operator](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/APP-UPDATES.md) to review an image-only update against the exact existing Deployment. Its guarded version 2 can update chosen application and copy-init images together without changing storage or configuration. A private instance with a separately mounted shell, tool pack and engine pin needs compatible versions of all of them; updating the Lolly Work server image alone does not update its interface. Check collaboration after promotion.
