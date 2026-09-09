# Deployment guide

> **Scope.** This page is *where each piece runs*: the delivery models, which artefact goes to which host and what the optional services need. The [Build Guide](/info/build-guide.html) is *how each artefact is produced* - toolchain prerequisites, per-platform build and signing steps, the container image. Anything about compilers, SDKs or store submission belongs there; anything about hosting, routing and rollout belongs here.

Lolly has no single deployment - it's an engine plus several shells, and you ship the ones your organisation needs. This guide covers each target: the hosted web app, the desktop/mobile apps and the two backend services.

## Choose a delivery model

The same build serves three postures - pick per team, not per organisation:

- **Deploy, don't serve** - distribute the desktop/mobile app or the offline PWA to devices via your MDM (Intune, Jamf, Munki). Runs locally, offline, air-gapped; IT owns the update cadence.
- **Serve only** - run one hosted instance inside your network or behind a VPN; users reach it in a browser with nothing installed. Publish once, everyone updates instantly. Any static host will do, and the repo ships container images plus a Helm chart if that instance belongs on your own cluster.
- **Hybrid** - both, pointed at the same tool library.

See [Lolly for Operators](/info/operators.html) for the security rationale behind each.

## The web shell

The web shell is a static PWA built by Vite, with two *optional* serverless API functions alongside it.

```bash
pnpm install --frozen-lockfile                 # preinstall checks the submodules are present; postinstall builds the profile views
pnpm run build:web      # ONNX runtime copy, /info, per-tool + per-view OG images, then the Vite bundle
# output: shells/web/dist/
```

`build:web` is a chain: `build:ort` (copies onnxruntime-web's WASM and loader files into `shells/web/public/ort/`, which are gitignored and regenerated at build time), then `build:info` (the `/info` docs site), then the two OG image generators, then the shell bundle - so a plain `vite build` inside `shells/web` is *not* enough on its own.

### Any static host - including air-gapped

The web build is plain static files, so this is the simplest and most portable path. Serve `shells/web/dist/` from any static host, CDN or an internal file server, with a single catch-all rewrite to `index.html` for client-side routing. Once loaded the PWA keeps working offline, and **Profile → Available offline** turns that from best-effort caching into a guarantee: users download the whole app, their tools, the catalogue (whole or by tag) and the docs ahead of a disconnection, with a progress bar and per-part sizes. That makes this the air-gapped path too: drop the static bundle behind your firewall (or into an MDM-delivered app) and nothing phones home. The build emits `dist/precache.json` (the app's own file inventory) and `/info/manifest.json` (the docs site's) - the download manager reads both, so keep them in the deployed bundle. If you don't need the optional services below, the catch-all and the headers in the next block are all you need.

**Clean routes keep their own rewrites.** Alongside the catch-all, point each clean route at the prerendered per-view HTML the build emits, so a shared link carries real OG tags instead of the generic shell: `/d` → `/view/d.html`, `/t/:id` → `/t/:id.html` and the rest of the clean routes. Two reference implementations of the same rules ship in the repo - the `rewrites` array in `vercel.json` and the `location =` blocks in `deploy/docker/nginx.conf` - and between them they carry the full current set, so copy from one of those rather than a list here. (The nginx config gets most of it from a single `try_files $uri $uri.html …` fallback; only the routes whose file name differs need naming.)

**Headers you must serve.** A static host serves the headers you configure and no others, so these four are yours to add. Every reference deployment in the repo sends them on *every* response, and a proxy that terminates TLS and drops them loses the protection they give:

- `Content-Security-Policy` - the policy string in the `$lolly_csp` map at the top of `deploy/docker/nginx.conf`
- `Referrer-Policy: no-referrer`
- `X-Content-Type-Options: nosniff`
- `Permissions-Policy: camera=(self), microphone=(self), display-capture=(self), geolocation=()`

The CSP is the one that matters most, and not for the reason you might expect. Tool hooks run through `new Function` by design, so `script-src` keeps `'unsafe-eval'` and removing it would break shipping tools - that is a documented, accepted residual. The directive doing the actual work is `connect-src`: script that *can* execute still cannot exfiltrate to a host outside a fixed allowlist. `tests/security-headers.test.ts` pins the policy across all three copies of it in the repo and fails the build if they drift; [Threat Model](/info/threat-model.html) sets out what it does and does not contain.

`deploy/docker/security-headers.conf` is the copyable form - four `add_header … always` lines, ready to translate into whatever your host uses. If you are serving with nginx, take the whole file rather than retyping it: nginx drops **all** inherited `add_header` directives inside any location that declares one of its own, so a location that sets `Cache-Control` silently ships with no security headers unless it re-`include`s them.

**Profile views as real copies.** Any build that leaves your machine - a hosted deploy, a container image, a function bundle - should materialise the `tools/` and `catalog/` profile views as real copies rather than symlinks, since symlinks rarely survive a bundler. Pass `--copy` to the profile build (`node scripts/use-profile.ts <profile> --copy`); it also switches itself on when the build environment sets `VERCEL`. See [Configuration](/info/configuration.html) for the profile-view mechanics.

### With the optional services

To add the AI-agent (MCP) or verified-identity (CA) endpoints, deploy the two functions under `api/` (`api/mcp/**`, `api/ca/**`) to any serverless platform, or self-host the `services/mcp` / `services/ca` submodules as long-running processes. Route the app's `/api/mcp` and `/api/ca` paths to them, and keep the SPA catch-all for everything else - written to **exclude the API prefix** and listed last (`/((?!api/).*)` → `/index.html` in `vercel.json`), so it can't swallow the function routes. MCP also serves the two `/.well-known/oauth-*` discovery paths and a public `GET /tool/<id>.<ext>` render route; route those to the same function.

### Container & Kubernetes

The container images and the Helm chart ship in this repo, so running Lolly on your own cluster is a supported delivery model rather than a recipe to reconstruct.

`deploy/docker/` holds three Dockerfiles - `web.Dockerfile`, `mcp.Dockerfile`, `ca.Dockerfile` - each built with the **repo root** as context. The web image is multi-stage: a Node stage runs the real `pnpm run build:web`, then an `nginx-unprivileged` runtime stage (non-root, listening on 8080) serves the resulting `dist/` with the `nginx.conf` and `security-headers.conf` described above. One brand profile is baked in at build time (`--build-arg LOLLY_PROFILE=suse|lolly-start`), so the running container reads nothing at serve time - no pack to mount, no runtime config, no secret. The default is `suse`, which needs the private brand pack; a public self-hoster without it should build with `--build-arg LOLLY_PROFILE=lolly-start` (or their own pack) or the image ships an empty catalogue. The two service images install the workspace and run their entry point on Node directly. All three need the content submodules checked out in the build context, or you get a shell with an empty catalogue.

`deploy/helm/` is the chart, and one values file covers all three components. `web` is on by default: 2 stateless replicas for HA behind a ClusterIP service, a TLS-ready ingress you enable with a hostname and `/healthz` liveness/readiness probes. `mcp` and `ca` are opt-in and disabled by default. The defaults are the secure ones - every pod runs non-root under `RuntimeDefault` seccomp with all capabilities dropped, no privilege escalation and a read-only root filesystem (writable `emptyDir`s exactly where nginx needs them), soft pod anti-affinity to spread replicas, an optional NetworkPolicy and no ServiceAccount token mounted since none of the components talk to the Kubernetes API. The CA's root key, certificate and service secret come either from a chart-managed Secret or, for production, from one you manage yourself (`ca.existingSecret`). A minimal install is one flag:

```bash
helm install lolly deploy/helm --set web.image.repository=<registry>/lolly-web
```

The [Build Guide](/info/build-guide.html) covers building and pushing the images, the SUSE Application Collection base-image option and how to adapt the chart.

### YunoHost

For a self-hosting box rather than a cluster, Lolly ships as a [YunoHost](https://yunohost.org) app: `sudo yunohost app install https://github.com/lolly-tools/lolly_ynh`. The package is the `deploy/yunohost/` directory of this repo, mirrored to that app repository at each release, so the two never differ.

It is the static delivery model above, done for you: the package downloads a prebuilt web build from the release host, unpacks it into the app directory and serves it with the domain's nginx, with the same security headers as lolly.tools. There is no service and no database, nothing is stored on the server, and access is the ordinary YunoHost permission on the app - public by default, or limited to a group. Two things follow from the build it installs. It takes a **whole domain**, because the web build resolves its assets, service worker and clean routes from the domain root. And the on-device ML models are fetched on first use from `lolli.li`, the project's release host, rather than bundled, the same way the desktop app does it; without that the download would be over two gigabytes, and a YunoHost host is often a small machine.

The governed, multi-user deployment with YunoHost sign-in is the separate **Lolly Work** package, which serves this same web build behind its control plane.

## Desktop & mobile apps

The Tauri shells wrap the same engine and web assets in a native binary.

```bash
pnpm run build:desktop   # macOS / Windows / Linux (shells/tauri-desktop)
pnpm run build:android   # APK + AAB (shells/tauri-mobile)
pnpm run build:ios       # .ipa    (shells/tauri-mobile)
```

Signing, notarisation and store submission are platform-specific - the [Build Guide](/info/build-guide.html) covers the prerequisites (Rust toolchain, Xcode, Android SDK) and the per-store steps. Distribute the resulting binaries through your MDM like any other managed app.

## The backend services (optional)

Two small services back optional features. Neither is required to render or export - the app is fully functional without them.

| Service | What it powers | Build | Hosting |
|---|---|---|---|
| **MCP server** (`services/mcp`, `api/mcp`) | The AI-agent endpoint - lets a model discover and run tools over MCP | `pnpm run build:mcp-fn` | A serverless function on any platform, or self-host the `services/mcp` submodule |
| **CA service** (`services/ca`, `api/ca`) | Content-Credentials **identity** - issues short-lived signing certificates for verified C2PA | `pnpm run build:ca-fn` | A serverless function on any platform, or self-host; needs `services/ca/.env` |

The CA service holds policy server-side (certificate-day limits, allowed providers) and never sees a signing key - those are generated and kept on the user's device. See [Content Credentials Identity](/info/content-credentials-identity.html) for the operator runbook (root of trust, provider setup) and [MCP Server](/info/mcp.html) for the endpoint and auth model.

## Publishing tools

Tools are **data, not code** - a manifest, a template and optional hooks in a directory. You never redeploy the app to ship a tool.

In the open app, the everyday path needs no build step at all. Someone works in a tool, saves the result as a **session** and shares it - as a share link (URL mode carries the whole state), inside a backup or over a collab session. Ingesting creative files into the catalogue is on-device the same way. Nobody needs git, an account or a deployment to do any of that.

Whoever controls the deployment can then lock a shared session in as a **template**: open the link, record its values as a `templates[]` entry on that tool's manifest in the brand pack and commit. The entry shows up in that tool's "New from template" chooser and is deep-linkable as `?template=<id>`. Git is the admin's locking step, used exactly once per template - never the creator's.

For a **shared catalog** that many people sync, merge the tool into the directory your instance reads and run the catalog build; clients pick it up on next sync:

```bash
pnpm run build:catalog     # regenerate catalog/tools/index.json, asset checksums, and the preview bundle
pnpm run validate:catalog  # enforce schema + invariants (fails CI on drift)
```

If you want change control, manage that directory as a Git repository so tool changes get pull-request review and a full audit trail - an option, not a requirement. Which tools a given instance exposes is a [Configuration](/info/configuration.html) concern (profiles + brand packs), not a code change.
