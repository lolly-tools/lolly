# Build the web container and Helm chart

Build the web image and deploy the chart with optional services.

Part of [Build Guide](/info/build-guide.html).

<!--lb:kubernetes helm-->

## Web shell on Kubernetes (Helm)

The web shell is a **static site** - a build produces a `dist/` folder of HTML, CSS, JS, the service worker, the HarfBuzz WASM, fonts, the bundled tool catalog and the `/info` site. Anything that can serve static files can host it. To run it **inside your own Kubernetes cluster** - air-gapped, on-prem or alongside the rest of your platform - the artefacts ship in this repo: `deploy/docker/` bakes `dist/` into an <!--l:nginx-->nginx image, and `deploy/helm/` deploys it. This section is what those files do and how to adapt them; [Deployment](/info/deployment.html) is where each piece runs.

Nothing in the chart is specific to one cluster: it is plain Kubernetes, so it deploys on any conformant distribution - including SUSE's own RKE2 and <!--l:k3s-->k3s - and on any managed service.

> **The chart is shipped, and from Lolly 1.1.1 so are the neutral images.** `deploy/helm/` is a real chart with three components - `web` (the PWA, on by default), `mcp` and `ca` (both opt-in) - one `values.yaml` you edit and secure defaults on every pod. Its default repositories are the published `ghcr.io/lolly-tools/lolly-web`, `lolly-mcp` and `lolly-ca` images: the neutral `lolly-start` profile, `linux/amd64`, signed and attested, tagged with the release version. The [published images guide](https://github.com/lolly-tools/lolly/blob/main/deploy/docker/README.md#published-images) lists every repository and shows how to verify, mirror and pin a digest. Build your own images, as below, for another brand profile, your own signing key or another base image. There is no hosted Lolly chart repository, so you install from a checkout of this repo, and the SUSE Application Collection carries no Lolly chart of its own. Where a curated image or chart *does* exist there - the nginx runtime base, cert-manager - this section prefers it.

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

`deploy/docker/web.Dockerfile` packages a frontend that was already compiled and signed; it runs no compiler and receives no private key. The signed frontend comes from the reusable `release-frontend.yml` workflow (or your own equivalent): a protected job signs the source catalog, a separate job compiles with only the public pin, and a second protected job signs the output catalog and a receipt that binds the source commit, content profile, public key and every file. The [signed image guide](https://github.com/lolly-tools/lolly/blob/main/deploy/docker/README.md) describes key custody, the jobs and the release gate. Never put a private key in an image build argument, context or BuildKit mount.

Package an approved frontend directory with its reviewed source commit and public pin. The **build context must be the repo root**:

```bash
docker buildx build --load --no-cache-filter verify -f deploy/docker/web.Dockerfile \
  --build-context "release-frontend=/approved/frontend" \
  --build-arg "LOLLY_RELEASE_SOURCE=<reviewed-commit-sha>" \
  --build-arg LOLLY_PROFILE=lolly-start \
  --build-arg "VITE_CATALOG_PUBLIC_KEY_JWK=$VITE_CATALOG_PUBLIC_KEY_JWK" \
  -t <your-registry>/lolly-web:<release> .
docker push <your-registry>/lolly-web:<release>
```

What the two stages do:

- **verify** - `node:26-bookworm`, pinned by digest, with no network. It checks the WebGPU release gate, then verifies the receipt, every artifact file, the signed catalog and the delivery configuration against the source commit, profile and public pin you supplied. A changed, extra, missing or symbolic-link file, or a different source, profile or key, fails the build. `--no-cache-filter verify` repeats these checks on every build.
- **runtime** - `ghcr.io/nginx/nginx-unprivileged`, also digest-pinned, running as uid 101 on port **8080**. The verified frontend is copied to `/usr/share/nginx/html`, `deploy/docker/nginx.conf` becomes `conf.d/default.conf`, and `deploy/docker/security-headers.conf` and the delivery header files are copied into `/etc/nginx/`.

The content profile (`lolly-start`, or `suse` with the private `brands/suse` pack mounted when the frontend is compiled) is fixed when the frontend is compiled and signed; `--build-arg LOLLY_PROFILE` must name the same profile, and the verify stage refuses another. Nothing is read at serve time, which is why the chart needs no pack, config or volume mounted for the web app; changing brand means a new signed frontend, a new image and a rolled deployment. Model files are the exception: the image ships none, and an optional read-only volume at `/usr/share/nginx/html/models` serves them (see the published images guide for its layout).

`mcp.Dockerfile`, `mcp-browser.Dockerfile` and `ca.Dockerfile` also build from the repo root and run their entry point on Node directly as the non-root `node` user: MCP and CA on a digest-pinned `node:26-alpine`, the browser MCP image on `node:26-bookworm-slim` with a lockfile-scoped Chromium. Build them only if you enable those components and do not use the published images.

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

Create the namespace:

```bash
kubectl create namespace lolly
```

If the image (or its base) is pulled from `dp.apps.rancher.io`, create the SUSE Application Collection pull secret and name it in `imagePullSecrets`. Skip this if your image is on a public registry. Replace the two values in angle brackets with your credentials:

```bash
kubectl create secret docker-registry application-collection \
  --docker-server=dp.apps.rancher.io \
  --docker-username=<username-or-sa-username> \
  --docker-password=<access-token-or-sa-secret> \
  -n lolly
```

The minimum viable install pins the published web image by the digest listed in the release's `images.json`; for an image you built in step 1, also set `web.image.repository` to your registry. Port-forward to try it before you publish a hostname:

```bash
helm upgrade --install lolly ./deploy/helm -n lolly \
  --set web.image.digest=sha256:<digest>

kubectl port-forward -n lolly svc/lolly-web 8080:80   # → http://localhost:8080/
```

To publish it on your own hostname with TLS from cert-manager (drop the `imagePullSecrets` line if your registry is public):

```bash
helm upgrade --install lolly ./deploy/helm -n lolly \
  --set web.image.repository=<your-registry>/lolly-web \
  --set web.image.digest=sha256:<digest> \
  --set imagePullSecrets[0].name=application-collection \
  --set web.ingress.enabled=true \
  --set web.ingress.hosts[0].host=lolly.example.com \
  --set web.ingress.tls[0].secretName=lolly-web-tls \
  --set web.ingress.tls[0].hosts[0]=lolly.example.com
```

`NOTES.txt` prints the resulting URLs, which components came up and any secret still missing.

### Routine application updates

Keep the cluster, database, Secrets, storage and hostname in place for a normal
TypeScript or UI update. Build and qualify the affected application image from an
exact main commit, then promote its tested digest. The maintained workflow's
`release_scope=web` prepares the signed public web image without rebuilding the
independent CA, Penpot or MCP services. It requires that commit's successful normal
main CI and retains the frontend release gate. Main CI can request candidate
preparation; automatic production promotion is not enabled by that workflow.

The main candidate workflow has an optional changed-path filter. Leave the
repository variable `LOLLY_CLASSIFY_WEB_CANDIDATES` unset or set to `false` to
retain its existing behavior. Set it to the literal `true` only with
`LOLLY_APPLICATION_RELEASE_BASE` set to a reviewed full lowercase commit hash.
That base must be an ancestor of the exact qualified main candidate. It is a
comparison base, not a claim about the source running in production. The helper
never chooses the candidate's parent or a moving branch as a substitute.

With filtering enabled, a clean complete-history checkout must prove that the
whole range contains only regular web source changes and permitted companion
tests or the generated web source README. The candidate request and all normal
CI, release-gate, signing and image qualification checks stay in place. Identical
committed trees skip preparation; unknown or mixed paths, docs-only or test-only
ranges, invalid inputs and dirty checkouts return a result requiring manual
review. A skipped or held preparation does not authorize an artifact reuse or a
production change. Private shell, pack, engine-pin and runtime compatibility
still need their own review.

`vendor/application-release-classifier/` contains the classifier and its 45 Git
fixture tests. Both files are
byte-exact copies of the reviewed Lolly Work classifier at
`987d67135a3b0d1026e4e893d69a69b1f4c79d84`. The maintained
`scripts/data/application-release-classifier-source.json` records the source
repository, immutable Git objects and SHA-256 hashes. The preparer executes only
the checked-out copy; it never downloads or runs another repository's moving
code. To inspect a range locally with Node 24 and Git:

```sh
node vendor/application-release-classifier/scripts/classify-application-release.ts \
  --repo /absolute/clean/lolly-checkout \
  --base FULL_REVIEWED_BASE_COMMIT \
  --candidate FULL_CANDIDATE_COMMIT
```

The JSON includes both commit and tree identities, a bounded complete inventory
and advisory flags. It never grants promotion or artifact-reuse permission.

For Lolly Work, use its [application update operator](https://github.com/lolly-tools/lolly-work/blob/main/deploy/helm/APP-UPDATES.md)
to review an image-only update against the exact existing Deployment identity.
Its guarded version 2 can atomically update explicitly selected application and
copy-init images without changing storage or configuration. A private instance
with a separately mounted shell, tool pack and engine pin needs compatible
versions of all those inputs; updating the Work server image alone does not update
its UI. Retain the previous hashed lazy assets for already-open tabs and check
collaboration after promotion.

These are application release instructions for your own instance. Operators of
lolly.ing and lolly.tools must use their current production handoff and target
preflight rather than applying this install example to the live cluster.

### 6. The optional services

Both stay off until you ask for them, and both are stateless.

**MCP** (`--set mcp.enabled=true`) exposes the tool catalog to AI agents over Streamable-HTTP on port 8790. Its brand content is baked in at build time exactly like the web image. The default `lolly-mcp` image ships no Chromium: SVG/data plus resvg-PNG work without a browser, and browser-tier formats are refused. For PNG, JPEG, PDF and video through Chromium, set `mcp.image.repository=ghcr.io/lolly-tools/lolly-mcp-browser` and point it at your web shell with `--set mcp.webBase=https://lolly.example.com`. Liveness is a TCP socket check; readiness polls `/readyz`, which turns 503 while the server drains.

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
