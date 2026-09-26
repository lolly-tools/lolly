# Build the web container and Helm chart

Build the web image and deploy the chart with optional services.

Part of [Build Guide](/info/build-guide.html).

<!--lb:kubernetes helm-->

## Web shell on Kubernetes (Helm)

The web shell is a **static site** - `pnpm run build:web` produces a `dist/` folder of HTML, CSS, JS, the service worker, the HarfBuzz WASM, fonts, the bundled tool catalog and the `/info` site. Anything that can serve static files can host it (which is why the production site runs behind a CDN). To run it **inside your own Kubernetes cluster** - air-gapped, on-prem or alongside the rest of your platform - the artefacts ship in this repo: `deploy/docker/` bakes `dist/` into an <!--l:nginx-->nginx image, and `deploy/helm/` deploys it. This section is what those files do and how to adapt them; [Deployment](/info/deployment.html) is where each piece runs.

Nothing in the chart is specific to one cluster: it is plain Kubernetes, so it deploys on any conformant distribution - including SUSE's own RKE2 and <!--l:k3s-->k3s - and on any managed service.

> **The chart is shipped, the images are yours to build.** `deploy/helm/` is a real chart with three components - `web` (the PWA, on by default), `mcp` and `ca` (both opt-in) - one `values.yaml` you edit and secure defaults on every pod. What it cannot do is invent an image: build and push the three `deploy/docker/` images to a registry your cluster can reach, then pin the tags you verified. There is no hosted Lolly chart repository, so you install from a checkout of this repo, and the SUSE Application Collection carries no Lolly chart of its own. Where a curated image or chart *does* exist there - the nginx runtime base, cert-manager - this section prefers it.

### Why the SUSE Application Collection

<!--l:suse-->[The SUSE Application Collection](https://apps.rancher.io) is a curated, signed, continuously-rebuilt catalog of open-source container images and Helm charts, all based on SUSE Linux Enterprise Base Container Images (BCI). Pulling the nginx runtime from it - rather than an arbitrary upstream tag - gets you a hardened, attested base with a known CVE posture.

| Host | Role |
|---|---|
| `apps.rancher.io` | Browse / catalog UI (and where you mint credentials) |
| `docs.apps.rancher.io` | Documentation |
| `dp.apps.rancher.io` | **OCI distribution registry you pull from** - images under `/containers/<name>`, Helm charts under `/charts/<name>` |

Access needs a free **SUSE Customer Center** account (`scc.suse.com`); sign in to `apps.rancher.io` and create either a personal **access token** (Settings → Access tokens) or an organization **service account** (Settings → Service accounts). Pulls are never anonymous.

> **Free-tier gotcha for clusters.** A *user* access token on the Free tier allows pulls (≈100/24h), but a Free **service account is allowed 0 pulls** - so unattended in-cluster pulls through a service-account `imagePullSecret` realistically need a paid (Prime or higher) organization subscription. For builds on your own laptop a personal token on the Free tier is fine. If you can't subscribe, use the SUSE BCI nginx image from `registry.suse.com` instead (see the *Fallback* note under step 2) - it's free and needs no login.

Log in - the same host for every client. The username/password pairing differs by credential type: a **user account** uses your username + an **access token**; a **service account** uses its username + a **secret** (never your account password):

```bash
helm registry login dp.apps.rancher.io -u <username-or-sa-username> -p <access-token-or-sa-secret>
docker login        dp.apps.rancher.io -u <username-or-sa-username> -p <access-token-or-sa-secret>
```

### 1. Build the image

`deploy/docker/web.Dockerfile` does the static build *and* the packaging in one multi-stage build, so there is no separate "run npm, then copy `dist/`" step to perform by hand. The one thing it needs from you: the **build context must be the repo root**. A plain clone already has `community/` and `brands/lolly-start/` checked out, so a `LOLLY_PROFILE=lolly-start` build needs nothing further; building the `suse` profile needs `brands/suse` mounted first (`git submodule update --init --checkout brands/suse`).

```bash
docker build -f deploy/docker/web.Dockerfile \
  --build-arg LOLLY_PROFILE=lolly-start \
  -t <your-registry>/lolly-web:0.1.0 .
docker push <your-registry>/lolly-web:0.1.0
```

What the two stages do:

- **build** - `node:26-bookworm`, pinned by digest, runs `pnpm install --frozen-lockfile` then the real `pnpm run build:web`. Deliberately not the slim variant: the optional native dependencies (sharp, onnxruntime, resvg, playwright) need build tooling slim doesn't carry.
- **runtime** - `nginxinc/nginx-unprivileged`, also digest-pinned, running as uid 101 on port **8080**. `dist/` is copied to `/usr/share/nginx/html`, `deploy/docker/nginx.conf` becomes `conf.d/default.conf` and `deploy/docker/security-headers.conf` is copied beside it.

`--build-arg LOLLY_PROFILE=suse|lolly-start` bakes one brand into the static output - theme colour, PWA chrome and the resolved tool and catalog content. Nothing is read at serve time, which is why the chart needs no pack, config or volume mounted for the web app; changing brand means rebuilding the image and rolling the deployment.

`mcp.Dockerfile` and `ca.Dockerfile` follow the same pattern (repo-root context, digest-pinned `node:26-bookworm-slim`, non-root `node` user) and run their entry point on Node directly. Build them only if you enable those components.

### 2. Swapping in a SUSE nginx base (optional)

The shipped runtime stage uses the upstream unprivileged nginx image so a plain `docker build` works with no registry credentials. To take the Application Collection's curated build instead, replace that one `FROM` line and keep the `COPY` lines untouched:

```dockerfile
# ---- runtime stage: SUSE Application Collection nginx ----
# Pin the current tag from https://apps.rancher.io/applications/nginx
FROM dp.apps.rancher.io/containers/nginx:1.29.4
```

Two things to check against whichever base you pick. The shipped `nginx.conf` sets `root` explicitly, so the base image's default document root doesn't matter - but `dist/` has to be copied where that `root` points (or change the directive). And it listens on 8080 because non-root nginx cannot bind below 1024; if your base runs as root and you switch to 80, change `web.service.targetPort` in the chart to match.

> **Fallback without an Application Collection subscription:** use the free SUSE BCI image `FROM registry.suse.com/suse/nginx:1.27` (no login required). Its default document root is `/srv/www/htdocs/` - copy there instead, or just keep the `root` directive from the shipped `nginx.conf`, which wins regardless of the base image's default.

### 3. What the nginx config already handles

Lolly is a single-page PWA, so the server has real work to do: URL-mode deep links (`/?tool=qr-code`) must fall back to `index.html`, the service worker must never be cached, hashed assets should be immutable, the HarfBuzz `.wasm` and the `.webmanifest` need correct MIME types and the security headers have to be on every response. `deploy/docker/nginx.conf` does all of it - `tests/security-headers.test.ts` pins its CSP against the other two copies in the repo, so edit it rather than writing a fresh one. The parts that matter, quoted from the shipped file:

```nginx
server {
    # nginx-unprivileged cannot bind <1024; 8080 is the image default.
    listen       8080;
    root   /usr/share/nginx/html;
    index  index.html;

    # Security headers on every response (see the $lolly_csp map above).
    include /etc/nginx/security-headers.conf;

    # ── Service worker: MUST never be cached, and may control the whole scope.
    location = /sw.js {
        add_header Cache-Control "no-cache, no-store, must-revalidate";
        add_header Service-Worker-Allowed "/";
        include /etc/nginx/security-headers.conf;
    }

    # ── Content-hashed build output: safe to cache forever (immutable).
    location /_app/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        include /etc/nginx/security-headers.conf;
        try_files $uri =404;
    }

    # ── Everything else: serve the file, then its .html twin, then a directory
    # index, then fall back to the SPA shell. Covers /t/<id> → /t/<id>.html and
    # /info/* real pages while keeping client-routed paths on index.html.
    location / {
        try_files $uri $uri.html $uri/index.html /index.html;
    }
}
```

That repeated `include` is not redundancy: nginx drops **every** inherited `add_header` inside a location that declares one of its own, so any location setting `Cache-Control` would otherwise ship with no security headers at all. Keep the include when you add a location. The file also carries a cheap unauthenticated `/healthz` for the chart's probes, explicit `types` for `.wasm`/`.avif`/`.webmanifest`, long-cache rules for `/ort/`, `/models/` and `/fonts/` and the short URL aliases (`/d`, `/v`, `/a`, `/assets`, `/c`, `/p`, `/profile`) that mirror the hosted deployment's rewrites.

### 4. The chart

The Application Collection ships charts for stateful services (redis, postgresql, prometheus, cert-manager, …) but **not** a generic static-web-server chart - nginx lives there as a *container image only*. Lolly's own chart is `deploy/helm/`:

```
deploy/helm/
├── Chart.yaml
├── values.yaml               ← the one file you edit
└── templates/
    ├── _helpers.tpl          names, labels, image references
    ├── web-deployment.yaml   the PWA (on by default)
    ├── web-service.yaml
    ├── mcp-deployment.yaml   MCP server (opt-in)
    ├── mcp-service.yaml
    ├── ca-deployment.yaml    credential authority (opt-in)
    ├── ca-service.yaml
    ├── ca-secret.yaml        chart-managed mode only
    ├── ingress.yaml          one Ingress per enabled component
    ├── networkpolicy.yaml    off by default
    ├── serviceaccount.yaml
    └── NOTES.txt
```

`web` is enabled by default at 2 replicas - the PWA holds no server-side state (everything lives in the browser's IndexedDB), so replicas are interchangeable and you can raise the count freely. `mcp` and `ca` are `enabled: false` until you turn them on. The security posture is shared and applied to every component: `runAsNonRoot`, `RuntimeDefault` seccomp, all capabilities dropped, no privilege escalation, a read-only root filesystem with `emptyDir`s mounted exactly where nginx needs to write, no ServiceAccount token mounted (none of the components talk to the Kubernetes API), soft pod anti-affinity so replicas spread across nodes without blocking a single-node cluster and an off-by-default NetworkPolicy that restricts ingress to each component's port.

The values you are most likely to touch:

```yaml
web:
  enabled: true
  replicaCount: 2
  image:
    repository: ghcr.io/lolly-tools/lolly-web   # ← your registry
    tag: ""                                     # empty ⇒ the chart's appVersion
  service:
    port: 80
    targetPort: 8080        # what nginx-unprivileged listens on
  ingress:
    enabled: false
    hosts:
      - host: lolly.example.com
        paths: [{ path: /, pathType: Prefix }]

# Private registry (see step 5). e.g. [{ name: application-collection }]
imagePullSecrets: []
```

Read `values.yaml` top to bottom before a production install - it is written to be read, and the `mcp` and `ca` sections document what each service needs.

### 5. Install

If the image (or its base) is pulled from `dp.apps.rancher.io`, create the pull secret first and name it in `imagePullSecrets`:

```bash
kubectl create namespace lolly

# the SUSE Application Collection pull secret (skip if your image is on a public registry)
kubectl create secret docker-registry application-collection \
  --docker-server=dp.apps.rancher.io \
  --docker-username=<username-or-sa-username> \
  --docker-password=<access-token-or-sa-secret> \
  -n lolly
```

The minimum viable install is one flag - the image you built in step 1. Port-forward to try it before you publish a hostname:

```bash
helm upgrade --install lolly ./deploy/helm -n lolly \
  --set web.image.repository=<your-registry>/lolly-web \
  --set web.image.tag=0.1.0

kubectl port-forward -n lolly svc/lolly-web 8080:80   # → http://localhost:8080/
```

To publish it on your own hostname with TLS from cert-manager (drop the `imagePullSecrets` line if your registry is public):

```bash
helm upgrade --install lolly ./deploy/helm -n lolly \
  --set web.image.repository=<your-registry>/lolly-web \
  --set web.image.tag=0.1.0 \
  --set imagePullSecrets[0].name=application-collection \
  --set web.ingress.enabled=true \
  --set web.ingress.hosts[0].host=lolly.example.com \
  --set web.ingress.tls[0].secretName=lolly-web-tls \
  --set web.ingress.tls[0].hosts[0]=lolly.example.com
```

`NOTES.txt` prints the resulting URLs, which components came up and any secret still missing.

### 6. The optional services

Both stay off until you ask for them, and both are stateless.

**MCP** (`--set mcp.enabled=true`) exposes the tool catalog to AI agents over Streamable-HTTP on port 8790. Its brand content is baked in at build time exactly like the web image. Browser-tier render formats are disabled unless you point it at a renderer - `--set mcp.webBase=https://lolly.example.com` - and SVG/data plus resvg-PNG work without one, which is why the image ships no Chromium. Probes are TCP socket checks: there is no unauthenticated health route to poll.

**CA** (`--set ca.enabled=true`) issues short-lived certificates for on-device C2PA signing on port 8787, under `/api/ca`. It needs a root key and certificate, generated once with `node services/ca/scripts/gen-root.mjs`, plus a service secret (`openssl rand -hex 32`). Two ways to supply them: fill in `ca.secrets` and let the chart create the Secret, or - the production choice - set `ca.existingSecret` to one your platform's secret store manages and leave `ca.secrets` empty. The chart refuses to render rather than deploy a CA with a missing root. Set `ca.config.allowedOrigins` to your web host, or enrollment tokens are rejected.

### TLS, the SUSE-curated way (optional)

For HTTPS, pull **cert-manager** - which *is* a real chart in the Application Collection - and let it issue the Ingress certificate:

```bash
helm install cert-manager oci://dp.apps.rancher.io/charts/cert-manager \
  -n cert-manager --create-namespace \
  --set crds.enabled=true \
  --set 'global.imagePullSecrets={application-collection}'
```

Then add a `ClusterIssuer` (e.g. Let's Encrypt), point the chart's `web.ingress.tls[0]` at a secret name and annotate the Ingress for cert-manager through `web.ingress.annotations` (`cert-manager.io/cluster-issuer: letsencrypt-prod`); `mcp` and `ca` take the same three keys under their own sections. Every Application Collection chart accepts the same `--set 'global.imagePullSecrets={application-collection}'`, so the pattern carries across redis, postgresql, prometheus and the rest if Lolly ever grows backing services.

> For the authoritative, current registry paths, tags, chart versions and value keys, see the [SUSE Application Collection docs](https://docs.apps.rancher.io) and run `helm show values oci://dp.apps.rancher.io/charts/<chart>` before relying on any default.

---

[Back to Build Guide](/info/build-guide.html).
