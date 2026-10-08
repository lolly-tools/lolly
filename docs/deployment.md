# Deployment guide

> **Scope.** This page is *where each piece runs*: the delivery models, which artefact goes to which host and what the optional services need. The [Build Guide](/info/build-guide.html) is *how each artefact is produced* - toolchain prerequisites, per-platform build and signing steps, the container image. Anything about compilers, SDKs or store submission belongs there; anything about hosting, routing and rollout belongs here.

Lolly has no single deployment - it's an engine plus several shells, and you ship the ones your organisation needs. This guide covers each target: the hosted web app, the desktop/mobile apps, optional integrations and the separately deployed lolly.work organisation service.

## Choose a delivery model

The same build serves three postures - pick per team, not per organisation:

- **Deploy, don't serve** - distribute the desktop/mobile app or the offline PWA to devices via your MDM (Intune, Jamf, Munki). Runs locally, offline, air-gapped; IT owns the update cadence.
- **Serve only** - run one hosted instance inside your network or behind a VPN; users reach it in a browser with nothing installed. Publish once, everyone updates instantly. Any static host will do, and the repo ships container images plus a Helm chart if that instance belongs on your own cluster.
- **Hybrid** - both, pointed at the same tool library.

See [Lolly for Operators](/info/operators.html) for the security rationale behind each.

## Organisation services with lolly.work

Choose **Lolly + lolly.work** when a deployment needs organisation SSO, SCIM provisioning, access policies, a shared catalog and projects, work collabs, approvals or governed delivery. lolly.work is part of the core Lolly project, in a [separate repository](https://github.com/lolly-tools/lolly-work), with its own service and admin console. It serves the same web app and can be used by connected desktop and mobile apps; local rendering remains available.

Deploy its service alongside the Lolly web build, configure the identity provider and permissions, and supply persistent database and blob storage for shared work. Server renders and batches use the same engine; browser-dependent formats need its optional render worker. The static web/MCP/CA Helm chart in this repository does not install lolly.work.

Use lolly.work's [installation guide](https://github.com/lolly-tools/lolly-work/blob/main/docs/install.md) for Compose, systemd, YunoHost and Helm, and its [deployment guide](https://github.com/lolly-tools/lolly-work/blob/main/docs/deployment.md) for production topology, storage and backups. Review [current status](https://github.com/lolly-tools/lolly-work/blob/main/docs/status.md) and [production readiness](https://github.com/lolly-tools/lolly-work/blob/main/docs/production-readiness.md) against the release you deploy. The public lolly.work site is a memory-only demonstration sandbox, not a persistent organisation deployment.

For users, link to [Use Lolly at your organisation](/info/organisation.html). For the change in data handling, read [Server Surface](/info/server-surface.html#organisation-services-with-lolly-work) and [Privacy](/info/privacy.html#organisation-services-with-lolly-work).

### UpCloud and Evroc

Both providers have OpenTofu and Terraform foundations for an operator-managed VM.
Start with the maintained [cloud deployment guide](https://github.com/lolly-tools/lolly-work/blob/main/docs/cloud-deployment.md),
then use the [UpCloud runbook](https://github.com/lolly-tools/lolly-work/blob/main/deploy/upcloud/README.md)
or [Evroc runbook](https://github.com/lolly-tools/lolly-work/blob/main/deploy/evroc/README.md)
for that provider's image, network, SSH and credential requirements. The shared
[VM runbook](https://github.com/lolly-tools/lolly-work/blob/main/deploy/vm/README.md)
covers the application release, signed shell, configuration and rollback.

Credential-free provider plans check the resource schema. An isolated PostgreSQL
restore rehearsal checks the database recovery path. Neither proves that a chosen
cloud image boots, that the account has capacity, or that the deployed application
works. Before production, qualify real boot and reboot, host security, backups,
capacity, owner sign-in, shared editing and document exports. The existing host
provisioner supports openSUSE; another operating system needs equivalent host
preparation. Moving the public shell also requires its complete API and route
checks; a working private Work instance does not qualify that public cutover.

## The web shell

The web shell is a static PWA built by Vite. Optional API services can run alongside it; [Server Surface](/info/server-surface.html) lists them and the separate lolly.work service.

```bash
pnpm install --frozen-lockfile                 # preinstall checks at least one content profile is complete on disk
pnpm run build:web      # ONNX runtime copy, /info, per-tool + per-view OG images, then the Vite bundle
# output: shells/web/dist/
```

`build:web` is a chain: `build:ort` (copies onnxruntime-web's WASM and loader files into `shells/web/public/ort/`, which are gitignored and regenerated at build time), then `build:info` (the `/info` docs site), then the two OG image generators, then the shell bundle - so a plain `vite build` inside `shells/web` is *not* enough on its own.

### Any static host - including air-gapped

The web build is plain static files, so this is the simplest and most portable path. Serve `shells/web/dist/` from any static host, CDN or an internal file server, with a single catch-all rewrite to `index.html` for client-side routing. Once loaded the PWA keeps working offline, and **Profile → Available offline** turns that from best-effort caching into a guarantee: users download the whole app, their tools, the catalogue (whole or by tag) and the docs ahead of a disconnection, with a progress bar and per-part sizes. That makes this the air-gapped path too: drop the static bundle behind your firewall (or into an MDM-delivered app) and nothing phones home. The build emits `dist/precache.json` (the app's own file inventory) and `/info/manifest.json` (the docs site's) - the download manager reads both, so keep them in the deployed bundle. If you don't need the optional services below, the catch-all and the headers in the next block are all you need.

**Clean routes keep their own rewrites.** Alongside the catch-all, point each clean route at the prerendered per-view HTML the build emits, so a shared link carries real OG tags instead of the generic shell: `/d` → `/view/d.html`, `/t/:id` → `/t/:id.html` and the rest of the clean routes. Two reference implementations of the same rules ship in the repo - the `rewrites` array in `vercel.json` and the `location =` blocks in `deploy/docker/nginx.conf` - and between them they carry the full current set, so copy from one of those rather than a list here. (The nginx config gets most of it from a single `try_files $uri $uri.html …` fallback; only the routes whose file name differs need naming.)

**Documentation routes come before the app fallback.** Both a public static host
and a private Work instance serving a signed shell need the complete built
`/info/` tree. Resolve `/info/` to its `index.html`, directory pages to their own
index, and article HTML and Markdown twins to the real files. Keep the manifest,
search indexes, styles, scripts, fonts and other documentation assets together.
Missing documentation files must return 404 rather than the app's `index.html`.

Preserve the `/docs` aliases and machine-readable discovery routes declared in
`vercel.json` when configuring another host. Map `/robots.txt` to the chosen
deployment's crawl policy and `/sitemap.xml` to `/info/sitemap.xml`; serve the
Markdown and discovery files with their correct content types. Check these routes
at the candidate origin before publishing either deployment shape. Documentation
availability does not change authentication for workspace records, uploads or
private APIs. The built pages retain their public documentation canonical URLs.

**Headers you must serve.** A static host serves the headers you configure and no others, so these four are yours to add. Every reference deployment in the repo sends them on *every* response, and a proxy that terminates TLS and drops them loses the protection they give:

- `Content-Security-Policy` - the policy string in the `$lolly_csp` map at the top of `deploy/docker/nginx.conf`
- `Referrer-Policy: no-referrer`
- `X-Content-Type-Options: nosniff`
- `Permissions-Policy: camera=(self), microphone=(self), display-capture=(self), geolocation=()`

The CSP is the one that matters most, and not for the reason you might expect. Tool hooks run through `new Function` by design, so `script-src` keeps `'unsafe-eval'` and removing it would break shipping tools - that is a documented, accepted residual. The directive doing the actual work is `connect-src`: script that *can* execute still cannot exfiltrate to a host outside a fixed allowlist. `tests/security-headers.test.ts` pins the policy across all three copies of it in the repo and fails the build if they drift; [Threat Model](/info/threat-model.html) sets out what it does and does not contain.

**One path gets a second policy.** `/any-site/` serves the app shell under the same policy with one change: `frame-src` admits any `https:` page and the loopback. This is what a person's own **Allow pages from any site** setting (Profile, Trusted sites) reloads into, so Design can show pages beyond the few video and map players the base policy names. The reference deployments express the pair as two complementary rules in `vercel.json`, a second entry in the `$lolly_csp` map keyed on `$request_uri`, and `conf/any-site-headers.inc` with its own location in the YunoHost package. Serve the pair together. To withdraw the option, give `/any-site/` the base policy: the app reads the policy that path really carries, and offers the setting only where `frame-src` admits `https:`. Never leave `/any-site/` with no policy at all, because a path with no Content-Security-Policy restricts nothing and the app treats it as offered.

`deploy/docker/security-headers.conf` is the copyable form - four `add_header … always` lines, ready to translate into whatever your host uses. If you are serving with nginx, take the whole file rather than retyping it: nginx drops **all** inherited `add_header` directives inside any location that declares one of its own, so a location that sets `Cache-Control` silently ships with no security headers unless it re-`include`s them.

**Which brand ships, and where the content comes from.** Set `LOLLY_PROFILE=<name>` on the build so the deploy carries the brand you mean rather than whichever profile the resolver would pick; a private pack that is not in the clone can never be it. `pnpm run build:web` writes a real `tools/` + `catalog/` tree into `dist/` from that profile, so the deployed site serves both paths as plain files and nothing has to resolve a profile to answer a page request. A function that *does* read tool source at request time (the `/tool/<id>.<ext>` render route below) needs the packs in its bundle and the same `LOLLY_PROFILE` in its **runtime** environment, not only in the build. See [Configuration](/info/configuration.html) for the resolver and its precedence.

### Removing a catalogue design system

**Settings → Design systems** labels the deployment's default system **Managed by this instance**. Expand **Catalogue source** to see the instance address, tokens asset and asset namespace. An app using its bundled catalogue labels the system **Bundled with this app**.

A system imported into the browser is a separate local copy. Removing that copy cannot delete files on a static host. If the copy was active, the supplied system becomes active again; the removal dialog tells you which system before you confirm. Its colours, type and logos can therefore remain visible after the local copy has gone.

To change or remove a server-installed brand:

1. Update the source content profile in `profiles.json` and its brand pack. For a neutral instance, select `lolly-start`. For a custom catalogue, remove the unwanted asset entries and files from that pack and replace any token or tool references that still need them. Keep permanent asset IDs assigned to their original assets.
2. Run `pnpm run build:catalog:all` and `pnpm run validate:catalog:all` to check every mounted profile.
3. Rebuild with the intended `LOLLY_PROFILE` and deploy the complete output, including the catalogue. Replace the old deployment files so removed assets are no longer served; editing only a browser's design system does not change the deployment.
4. Purge any host or CDN cache for the changed catalogue files, then reload Lolly while online so it fetches the updated catalogue. Check the supplied system's name and **Catalogue source** again. Refresh any downloaded offline copy before testing offline. Assets referenced by saved sessions can remain cached for those sessions.

An instance's administrator controls these files. The browser's **Remove** action only manages local design-system copies.

### With the optional services

To add the AI-agent (MCP) or verified-identity (CA) endpoints, deploy the two functions under `api/` (`api/mcp/**`, `api/ca/**`) to any serverless platform, or self-host `services/mcp` / `services/ca` as long-running processes. Route the app's `/api/mcp` and `/api/ca` paths to them, and keep the SPA catch-all for everything else - written to **exclude the API prefix** and listed last (`/((?!api/).*)` → `/index.html` in `vercel.json`), so it can't swallow the function routes. MCP also serves the two `/.well-known/oauth-*` discovery paths and a public `GET /tool/<id>.<ext>` render route; route those to the same function.

### Container & Kubernetes

The container images and the Helm chart ship in this repo, so running Lolly on your own cluster is a supported delivery model rather than a recipe to reconstruct.

`deploy/docker/` holds four Dockerfiles - `web.Dockerfile`, `mcp.Dockerfile`, `ca.Dockerfile` and `penpot.Dockerfile` - each built with the **repo root** as context. The web image is multi-stage: a Node stage runs the signed `pnpm run build:web:release`, then an `nginx-unprivileged` runtime stage (non-root, listening on 8080) serves the resulting `dist/` with the `nginx.conf` and `security-headers.conf` described above. One brand profile is baked in at build time (`--build-arg LOLLY_PROFILE=suse|lolly-start`), so the running container reads nothing at serve time - no pack to mount, no runtime config, no secret. The default is `lolly-start`, which ships no private SUSE pack. A SUSE-profile build requires its private pack in the build context; an unavailable profile fails the build. Release builds also require matching catalog-signing and public-pin BuildKit secrets, as described in the [Docker runbook](https://github.com/lolly-tools/lolly/blob/main/deploy/docker/README.md). MCP installs its runtime workspace; CA and the Penpot adapter carry their own service source and run directly on Node. A plain clone already carries `community/` and `brands/lolly-start/`, so nothing extra is needed for those; a `suse`-profile build needs the private pack mounted in the build context first, and the release checks refuse missing content.

`deploy/helm/` is the chart, and one values file covers all three components. `web` is on by default: 2 stateless replicas behind a ClusterIP service, a TLS-ready ingress you enable with a hostname and `/healthz` liveness/readiness probes. `mcp` and `ca` are opt-in and disabled by default. The defaults are the secure ones - every pod runs non-root under `RuntimeDefault` seccomp with all capabilities dropped, no privilege escalation and a read-only root filesystem (writable `emptyDir`s exactly where nginx needs them), soft pod anti-affinity to spread replicas, an optional NetworkPolicy and no ServiceAccount token mounted since none of the components talk to the Kubernetes API. The CA's root key, certificate and service secret come either from a chart-managed Secret or, for production, from one you manage yourself (`ca.existingSecret`). A minimal install is one flag:

```bash
helm install lolly deploy/helm --set web.image.repository=<registry>/lolly-web
```

The [Build Guide](/info/build-guide.html) covers building and pushing the images, the SUSE Application Collection base-image option and how to adapt the chart.

### K3s, RKE2 and SUSE dependency images

Use `deploy/helm/profiles/lean.yaml` for a small cluster candidate with one pod
per enabled public component, bounded CPU/memory and disk-backed temporary
volumes. MCP and CA remain opt-in. Merge the profile before instance settings:

```sh
helm template lolly deploy/helm \
  -f deploy/helm/profiles/lean.yaml -f instance-values.yaml
```

Pin each component's `image.digest` to the complete Lolly image you publish;
this replaces its tag. Top-level `imagePullSecrets` reaches all three services.
`tmp.sizeLimit` bounds each service's temporary volume, and `web.cache.sizeLimit`
bounds nginx's cache. The lean profile includes container `ephemeral-storage`
budgets too. With all three components enabled, requests total 100 millicores,
224 MiB memory and 224 MiB ephemeral disk. Cluster services, ingress, image
caches, browser workloads and external dependencies require additional capacity.
These are scheduling reservations, not a measured traffic limit or an HA claim.

K3s and RKE2 can share qualified node capacity between services. Cloud worker
nodes may still be VMs; containers do not remove their compute charges. Use the
[Work SUSE deployment runbook](https://github.com/lolly-tools/lolly-work/blob/main/deploy/suse/README.md)
for operating-system support, resource profiles, UpCloud/Evroc CSI and Longhorn
choices. Durable PostgreSQL storage and independently tested backups have a
different lifecycle from reproducible shell and pack copies.

Prefer `registry.suse.com` BCI bases and
[Application Collection](https://apps.rancher.io) dependencies when their versions
meet the release requirements. Collection OCI content comes from
`dp.apps.rancher.io` and requires registry authentication and the account's
entitlements. Build Lolly into the chosen base and test each architecture; a
Node or nginx base alone does not contain the application. The optional Work
BCI Node 24 Dockerfile is a candidate with its own build and boot checks. Public
web/MCP/CA retain their existing bases until another variant is qualified.

Following the Collection Penpot dependency model, Work can use a separately
managed Collection PostgreSQL 18 release after its schema, backup/restore and
version compatibility checks pass. Its durable jobs already use PostgreSQL,
so this adds no Redis requirement. A Redis TCP endpoint also cannot replace the
public services' current REST admission adapter without an integration change.
The original public chart does not install Work, relay, Penpot or model hosting;
the optional complete profile below adds the public routes and edge while
retaining the private services as separate owners. Qualify
all existing API routes, authentication, shared editing, recovery and capacity
before a public or private production cutover.

### Complete public and private routing on K3s

The optional [sovereign profile](https://github.com/lolly-tools/lolly/blob/main/deploy/helm/profiles/sovereign/README.md)
is a separate chart at `deploy/helm/profiles/sovereign/`. It combines the public
web shell, MCP with its singleton public live relay, CA and Penpot adapter with
one Caddy edge. The same edge has separate public and private host configuration;
private login, API, catalog, admin and collaboration routes reach the existing
Work Service, and private `/live/*` reaches its separate qualified relay. The
profile does not replace Work, its database, worker or private relay and does not
mount private content in public pods.

Use the [public VM recipe](https://github.com/lolly-tools/lolly/blob/main/deploy/docker/public-vm.md)
for the same public route contract without Kubernetes. Both recipes include docs
and discovery routes, reserved-path 404s, MIME/cache policy, model HEAD and Range,
MCP and OAuth, CA, Penpot streaming, image fetch and live editing. Models use a
verified immutable release mounted read-only in the web container. The
[model release guide](https://github.com/lolly-tools/lolly/blob/main/deploy/models-host/README.md)
provides the preparation and verification commands.

UpCloud and Evroc remain first-class provider foundations. Select the appropriate
CSI or existing-volume storage and qualify actual node boot and routing on each
provider. Keep Traefik and ServiceLB disabled for this profile: the single
non-root Caddy owner binds host 80/443 directly in a separate edge namespace,
with a constrained admission exception. Public and private application namespaces
retain restricted Pod Security. Provider and host firewalls must deny public
Kubernetes, kubelet, database and VXLAN access. Measure the actual edge-to-Service
peer before setting proxy trust; an outgoing source-address setting alone does
not prove the observed peer.

The default certificate mode uses Caddy's automatic ACME issuance and renewal
with a persistent edge PVC. Before DNS changes, use the file-certificate mode
with a trusted internal CA or pinned certificate and candidate-address requests.
After domain cutover, qualify provider callbacks and ACME renewal. The profile
starts at 352 MiB memory requests and 1600 MiB memory limits for public services
plus edge; Work, PostgreSQL 18, worker, private relay and cluster overhead need
separate capacity. These are starting bounds and single-process ownership, not
an HA or load result.

The original chart and this optional chart retain separate defaults. The complete
profile requires qualified image digests, distinct MCP/CA Secrets, measured exact
proxy peers, reviewed admission and an existing model volume. It keeps the
current durable REST rate limiter and CA email adapters until replacements are
qualified. Before publishing, run real HTTPS routes, signed-catalog verification,
admission refusal, cookie/auth custody, shared editing and invited-agent checks;
schema validation alone does not qualify a cloud cutover.

For browser-only public exports, the optional `mcp-browser.Dockerfile` and
`browser.values.yaml` add Chromium with a bounded queue and larger resource
budgets. The ordinary image remains browser-free. Set the exact public HTTPS web
base, qualify sandbox startup and real exports, and preserve the deployment's
reviewed anonymous or bearer policy. Browser enablement never grants access to
private Work files or workspace documents.

The optional [namespace sandbox profile](https://github.com/lolly-tools/lolly/blob/main/deploy/docker/seccomp/README.md)
keeps Chromium's sandbox enabled under the container's dropped capabilities.
Install and verify its exact hash on the selected node first, then opt MCP into
its Localhost profile; other services retain RuntimeDefault. Qualify actual
namespace/seccomp diagnostics and SVG/PNG/PDF exports after each browser or
runtime change. The chart neither installs a host profile nor substitutes a
sandbox bypass.

### YunoHost

For a self-hosting box rather than a cluster, Lolly ships as a [YunoHost](https://yunohost.org) app: `sudo yunohost app install https://github.com/lolly-tools/lolly_ynh`. The package is the `deploy/yunohost/` directory of this repo, mirrored to that app repository at each release, so the two never differ.

It is the static delivery model above, done for you: the package downloads a prebuilt web build from the release host, unpacks it into the app directory and serves it with the domain's nginx, with the same security headers as lolly.tools. There is no service and no database, nothing is stored on the server, and access is the ordinary YunoHost permission on the app - public by default, or limited to a group. Two things follow from the build it installs. It takes a **whole domain**, because the web build resolves its assets, service worker and clean routes from the domain root. And the on-device ML models are fetched on first use from `lolli.li`, the project's release host, rather than bundled, the same way the desktop app does it; without that the download would be over two gigabytes, and a YunoHost host is often a small machine.

The governed, multi-user deployment with YunoHost sign-in is the separate **[lolly.work](#organisation-services-with-lolly-work)** package, which serves this same web build behind its organisation service.

## Desktop & mobile apps

The Tauri shells wrap the same engine and web assets in a native binary.

```bash
pnpm run build:desktop   # macOS / Windows / Linux (shells/tauri-desktop)
pnpm run build:android   # APK + AAB (shells/tauri-mobile)
pnpm run build:ios       # .ipa    (shells/tauri-mobile)
```

Signing, notarisation and store submission are platform-specific - the [Build Guide](/info/build-guide.html) covers the prerequisites (Rust toolchain, Xcode, Android SDK) and the per-store steps. Distribute the resulting binaries through your MDM like any other managed app.

## The backend services (optional)

The MCP and CA services below are independently deployable. lolly.work has its own deployment described above, and the complete inventory, including network pass-throughs, is on [Server Surface](/info/server-surface.html). None is required for an ordinary local render or download.

| Service | What it powers | Build | Hosting |
|---|---|---|---|
| **MCP server** (`services/mcp`, `api/mcp`) | The AI-agent endpoint - lets a model discover and run tools over MCP | `pnpm run build:mcp-fn` | A serverless function on any platform, or self-host `services/mcp` |
| **CA service** (`services/ca`, `api/ca`) | Content-Credentials **identity** - issues short-lived signing certificates for verified C2PA | `pnpm run build:ca-fn` | A serverless function on any platform, or self-host; needs `services/ca/.env` |

The CA service holds policy server-side (certificate-day limits, allowed providers) and never sees a signing key - those are generated and kept on the user's device. See [Content Credentials Identity](/info/content-credentials-identity.html) for the operator runbook (root of trust, provider setup) and [MCP Server](/info/mcp.html) for the endpoint and auth model.

## Publishing tools

Tools are **data, not code** - a manifest, a template and optional hooks in a directory. You never redeploy the app to ship a tool.

In the open app, the everyday path needs no build step at all. Someone works in a tool, saves the result as a **session** and shares it - as a share link (URL mode carries the whole state), inside a backup or over a collab session. Ingesting creative files into Assets is on-device the same way. Nobody needs git, an account or a deployment to do any of that.

Whoever controls the deployment can then lock a shared session in as a **template**: open the link, record its values as a `templates[]` entry on that tool's manifest in the brand pack and commit. The entry shows up in that tool's "New from template" chooser and is deep-linkable as `?template=<id>`. Git is the admin's locking step, used exactly once per template - never the creator's.

For a **shared catalog** that many people sync, merge the tool into the directory your instance reads and run the catalog build; clients pick it up on next sync:

```bash
pnpm run build:catalog     # regenerate catalog/tools/index.json, asset checksums, and the preview bundle
pnpm run validate:catalog  # enforce schema + invariants (fails CI on drift)
```

If you want change control, manage that directory as a Git repository so tool changes get pull-request review and a full audit trail - an option, not a requirement. Which tools a given instance exposes is a [Configuration](/info/configuration.html) concern (profiles + brand packs), not a code change.
