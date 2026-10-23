# Choose a deployment

Lolly does its work on each person's device, so deploying it is mostly about how the app reaches people, not where renders run. This page helps an IT or platform team pick one of three ways, then points to the guide for each.

::: figure deployment-three-ways
Three ways to deploy Lolly. All three use the same build, so teams can mix them.
:::

Device management such as Intune, Jamf or Munki can deliver the apps, and IT then owns their update cadence. A hosted web app updates everyone as soon as you publish. Lolly Work adds single sign-on, shared projects, approvals and governed delivery on servers you run.

Pick per team, not per organisation; a hybrid of the first two, pointed at the same tool library, is common. [Threat model](/info/threat-model.html) and [Server surface](/info/server-surface.html) set out what each way runs and what it protects.

People who use the hosted web app need a browser with WebGPU. Check [Supported environments](/info/supported-environments.html) before you roll it out.

## Hand out the app

The desktop and mobile apps wrap the same engine and web code in a native binary. Build them with the guides for [desktop](/info/build-desktop.html), [Android](/info/build-mobile.html) and [iOS](/info/ios-build.html), which cover signing, notarisation and store steps, or take the published installers from [Install Lolly](/info/install.html). Distribute the binaries through your device management like any other managed app.

## Host the web app

The web build is plain static files, which makes this the simplest and most portable path. Build it with the brand you mean to ship:

```bash
LOLLY_PROFILE=lolly-demo pnpm run build:web    # output: shells/web/dist/
```

[Build Guide](/info/build-guide.html#build-the-web-app) explains what `build:web` runs. Then serve `shells/web/dist/` from any static host, CDN or internal file server, with three things in place: the routes, the headers and the brand. Without the optional services, those three are all the host needs.

### Any static host, including air-gapped

Once loaded, the web app keeps working offline. **Settings → Available offline** turns that best-effort caching into a guarantee: people download the whole app, their tools, the catalogue (whole or by tag) and the docs ahead of a disconnection, with a progress bar and per-part sizes.

That makes this the air-gapped path too. Put the static bundle behind your firewall, or into an app your device management delivers, and nothing phones home. The build writes `dist/precache.json`, the app's own file list, and `/info/manifest.json`, the docs site's. The download manager reads both, so keep them in the deployed bundle.

### The routes

One origin serves several kinds of address, and each kind needs its own handling.

::: figure deployment-route-map
How one origin answers each kind of address. Real files 404 when missing; only app routes fall back to the app.
:::

- **The app.** A single catch-all rewrite sends unknown paths to `index.html`, so client-side routes and link deep links work.
- **Clean routes keep their own pages.** Point each clean route at the prerendered per-view HTML the build writes, so a shared link carries real share-card tags instead of the generic shell: `/d` to `/view/d.html`, `/t/:id` to `/t/:id.html` and the rest. `deploy/docker/public.nginx.conf`, the public VM recipe, carries the full current set, and `tests/deployment-public-vm.test.ts` fails when one goes missing, so copy from that file rather than from a list here. In nginx, a single `try_files $uri $uri.html …` fallback covers most of them; only the routes whose file name differs need naming.
- **Documentation routes come before the app fallback.** Both a public static host and a private Lolly Work instance serving a signed shell need the complete built `/info/` tree. Resolve `/info/` to its `index.html`, directory pages to their own index and article HTML and Markdown twins to the real files. Keep the manifest, search indexes, styles, scripts and fonts together. A missing documentation file must return 404, not the app's `index.html`.
- **Discovery routes.** Keep the `/docs` aliases and machine-readable discovery routes that `public.nginx.conf` declares. Map `/robots.txt` to your crawl policy and `/sitemap.xml` to `/info/sitemap.xml`, and serve Markdown and discovery files with their correct content types. Check these at the candidate origin before you publish. Documentation being reachable does not change authentication for workspace records, uploads or private APIs, and the built pages keep their public documentation canonical URLs.

### The headers you must serve

A static host sends only the headers you configure, so these six are yours to add. Every reference deployment in the repository sends them on every response, and a proxy that terminates TLS and drops them loses their protection:

- `Content-Security-Policy`: the policy string in the `$lolly_csp` map at the top of `deploy/docker/nginx.conf`
- `Referrer-Policy: no-referrer`
- `X-Content-Type-Options: nosniff`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Embedder-Policy: credentialless`
- `Permissions-Policy: camera=(self), microphone=(self), display-capture=(self), geolocation=()`

The two `Cross-Origin-*` headers keep the app cross-origin isolated. Browsers give shared memory (`SharedArrayBuffer`) only to an isolated page, and some of the app's on-device models use that memory to run WebAssembly on several threads. The app still loads without the pair, so check for both headers explicitly.

The CSP matters most, and not for the reason you might expect. Tool hooks run through `new Function` by design, so `script-src` keeps `'unsafe-eval'`; removing it would break shipping tools, and that is a documented, accepted residual. The directive doing the work is `connect-src`: script that can run still cannot send data to a host outside a fixed allowlist. `tests/security-headers.test.ts` pins the policy across every shipped copy of the configuration and fails the build if they drift. [Threat model](/info/threat-model.html) sets out what the policy does and does not contain.

`deploy/docker/security-headers.conf` is the copyable form: six `add_header … always` lines plus an `include` of the cache headers in `deploy/docker/delivery-headers.conf`, ready to translate into whatever your host uses. With nginx, take the whole file rather than retyping the lines. nginx drops **all** inherited `add_header` directives inside any location that declares one of its own, so a location that sets `Cache-Control` ships with no security headers unless it `include`s them again.

**One path gets a second policy.** `/any-site/` serves the app under the same policy with one change: `frame-src` admits any `https:` page and the loopback. A person's **Allow pages from any site** setting (Settings, Trusted sites) reloads the app at that path, so Design can show pages beyond the few video and map players the base policy allows. The reference nginx configurations express this as a second entry in the `$lolly_csp` map keyed on `$request_uri`; the YunoHost package uses `conf/any-site-headers.inc` with its own location.

Serve the pair together. To withdraw the option, give `/any-site/` the base policy: the app reads the policy that path really carries and offers the setting only where `frame-src` admits `https:`. Never leave `/any-site/` with no policy at all, because a path with no Content-Security-Policy restricts nothing and the app treats the option as offered.

To let the app reach your own storage, such as SharePoint or S3, add those origins to the policy with [Configure connector origins](/info/connector-origins.html).

### Which brand ships

Set `LOLLY_PROFILE=<name>` on the build so the deployment carries the brand you mean, not whichever profile the resolver would pick; a private pack that is not in the clone can never ship. `pnpm run build:web` writes a real `tools/` and `catalog/` tree into `dist/` from that profile, so the deployed site serves both as plain files and nothing resolves a profile to answer a request.

A service that does read tool source at request time, such as the MCP service's `/tool/<id>.<ext>` render route, needs the packs in its image and the same `LOLLY_PROFILE` in its runtime environment, not only at build time. [Profiles, brands and tool configuration](/info/configuration.html) covers the resolver, and how to change or remove a design system the deployment supplies (see [Removing a catalogue design system](/info/configuration.html#removing-a-catalogue-design-system)).

## Run it on Kubernetes

The repository ships signed container images and a Helm chart, so running Lolly on your own cluster is a supported way to host the web app, not a recipe to rebuild. A minimal install pins the published web image by digest:

```bash
helm install lolly deploy/helm --set web.image.digest=sha256:<digest>
```

[Run on Kubernetes](/info/build-kubernetes.html) covers the published images, the chart's secure defaults, the optional MCP and CA components, small-cluster and single-node profiles and building your own image.

## Add the optional services

None of these is needed for an ordinary local render or download. [Server surface](/info/server-surface.html) is the complete inventory, network pass-throughs included.

| Service | What it powers | How to run it |
|---|---|---|
| **MCP server** (`services/mcp`) | The AI-agent endpoint, which lets a model find and run tools over MCP, plus the public render route and the image pass-through behind **Add from URL** | The published `lolly-mcp` image (or `lolly-mcp-browser` for browser formats), or `services/mcp` as a Node process |
| **CA service** (`services/ca`) | Content Credentials **identity**: short-lived signing certificates for verified C2PA | The published `lolly-ca` image, or `services/ca` as a Node process with `services/ca/.env` |
| **Penpot pass-through** (`services/penpot`) | **Send to Penpot**, which forwards two Penpot API calls the browser cannot make itself | The published `lolly-penpot` image, or `services/penpot` as a Node process |

Route the app's `/api/mcp`, `/api/ca` and `/api/penpot` paths to them. MCP also answers the two `/.well-known/oauth-*` discovery paths, `/api/fetch-image` and the public `GET /tool/<id>.<ext>` render route, so route those to the same service. Keep the app's catch-all for everything else, written to **exclude the API prefix** and listed last so it cannot swallow the service routes. `deploy/docker/public.caddy` routes all of these and is a working example.

The CA holds policy on the server (certificate-day limits, allowed providers) and never sees a signing key; keys are made and kept on each person's device. [Content Credentials identity](/info/content-credentials-identity.html) covers running the CA, and [MCP server](/info/mcp.html) covers the endpoint and its access rules.

## Organisation services with Lolly Work

Choose Lolly Work when a deployment needs organisation single sign-on, SCIM provisioning, access policies, a shared catalog and projects, work collabs, approvals or governed delivery. It is part of the Lolly project, in a [separate repository](https://github.com/lolly-tools/lolly-work), with its own service and admin console. It serves the same web app and works with connected desktop and mobile apps, and local rendering stays available. It needs a persistent database and blob storage for shared work; its server renders and batches use the same engine, and browser formats need its optional render worker. The Helm chart in this repository does not install Lolly Work.

- [Install Lolly Work](/info/work-install.html): Compose, systemd, YunoHost and Helm.
- [Lolly Work deployment options](/info/work-deployment.html): production topology, storage and backups.
- [Set up enterprise identity](/info/work-enterprise-identity.html): identity provider registration, SCIM, sign-out and credential rotation. Serve the Lolly shell and Lolly Work on the same HTTPS origin, and keep the sign-in routes ahead of any app fallback.
- [UpCloud, Evroc and fewer hosting services](/info/work-cloud-deployment.html): provider foundations and what to qualify before production.

Review [current status](/info/work-status.html) and [production evidence](/info/work-production-readiness.html) against the release you deploy. The public demo at lolly.work keeps everything in memory; it is a sandbox to try, not a persistent organisation deployment. A static Lolly image has no organisation identity service of its own, and the standalone MCP service's shared-secret OAuth adapter does not give per-person Lolly Work sign-in.

For the people you serve, link to [Use Lolly at your organisation](/info/organisation.html). For what changes in data handling, read [Server surface](/info/server-surface.html#organisation-services-with-lolly-work) and [Privacy](/info/privacy.html#organisation-services-with-lolly-work).

## YunoHost

**For a home or team server, install [Lolly Work for YunoHost](https://github.com/lolly-tools/lolly-work_ynh).** It includes this same web app plus the Lolly Work server, PostgreSQL, shared projects, permissions and sign-in with your YunoHost accounts. Start with [Install Lolly Work](/info/work-install.html), and use the exact package revision and qualification results linked from the [Lolly Work release](https://github.com/lolly-tools/lolly-work/releases).

| Package | Choose it when |
|---|---|
| **Lolly Work** (`lolly-work_ynh`) | You want server features, sign-in with host accounts and shared projects. Recommended for most self-hosters. |
| **Static Lolly** (`lolly_ynh`) | You only want to serve the app; people work on their own devices with no Lolly Work service or database. |

The static package lives in this repository at `deploy/yunohost/` and is mirrored to [lolly-tools/lolly_ynh](https://github.com/lolly-tools/lolly_ynh). It downloads a prebuilt web archive, serves it through nginx and uses the normal YunoHost app permission. It is public by default and takes a whole domain, and on-device models load from `lolli.li` when first used. Install it only if that static setup is what you need:

```bash
sudo yunohost app install https://github.com/lolly-tools/lolly_ynh
```

The two are separate apps, not upgrade targets for each other. To move from static Lolly to Lolly Work, install Lolly Work on another domain and check sign-in and project transfer before you retire the static app. Do not upgrade `lolly_ynh` in place with a `lolly-work_ynh` package address.

## Ship new tools without redeploying

Tools are data, not code: a manifest, a template and optional hooks in a directory. Shipping a tool never redeploys the app. Merge it into the directory your instance reads, rebuild the catalog with the `:all` commands in [Publish and localize a tool](/info/tool-publishing.html), and clients pick it up on their next sync.

Most people never need that step: they save their work as a session and share it as a link, a backup or a collab. Which tools an instance exposes is [configuration](/info/configuration.html), and how a team decides what becomes a shared template is in [Adoption and governance](/info/adoption-governance.html#governance-when-a-team-wants-a-process).
