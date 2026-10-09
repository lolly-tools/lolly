# Signed web images

The web image uses `pnpm run build:web:release`: it signs the selected profile's
catalog and embeds the matching public verification key and verified trust mode
in the client. Unsigned `build:web` output is for development and previews.

Use a checkout that carries the content the profile needs. The community tools and
the `lolly-start` brand are directories in this repository; for SUSE, mount the private
`brands/suse` submodule and select `LOLLY_PROFILE=suse`. Build a reviewed release from a
clean checkout and record its source commit, the `brands/suse` pointer if one was used,
and the image digest.

Provision the deployment's P-256 signing key through the approved secret store.
`LOLLY_CATALOG_SIGNING_KEY` holds PKCS8 PEM or private JWK JSON;
`VITE_CATALOG_PUBLIC_KEY_JWK` holds the matching **public** JWK JSON.
With those environment variables supplied by the build runner:

```sh
docker buildx build --load --no-cache-filter build \
  -f deploy/docker/web.Dockerfile \
  --build-arg LOLLY_PROFILE=suse \
  --build-arg VITE_REQUIRE_AI_POLICY=true \
  --secret id=LOLLY_CATALOG_SIGNING_KEY,env=LOLLY_CATALOG_SIGNING_KEY \
  --secret id=VITE_CATALOG_PUBLIC_KEY_JWK,env=VITE_CATALOG_PUBLIC_KEY_JWK \
  -t <registry>/lolly-web:<release> .
```

For file-based secret injection, replace `env=...` with `src=/secure/path/to/file`
on the corresponding `--secret` argument. Never pass the private key as a build
argument, add it with `COPY`, or commit it. The Docker context excludes `keys/`,
PEM/key files and dotenv files. The public key is deliberately present in the
served JavaScript; the private key must remain confined to the trusted builder.

The internal example requires a fresh Work AI policy before supported AI paths
can run, including the first boot without a reachable control plane. Keep Work's
`policy.ai.enabled=false` for the proposed first production release. This Vite
setting is compiled into the shell; setting an environment variable on running
nginx does not retrofit it. Public standalone builds may leave it false. Promote
the matching updated shell and Work together and retire old client artifacts.

Both inputs are required on an uncached build. Malformed/private public pins and
mismatched key pairs are rejected by the release builder/signer. BuildKit secrets
are exposed only during the release step, after dependency installation. The
Dockerfile uses secret environment mounts, supported by frontend 1.10 or newer.
See the [Docker secret mount reference](https://docs.docker.com/reference/dockerfile/#run---mounttypesecret).

Keep `--no-cache-filter build` for release builds: secret contents do not invalidate
BuildKit's cache, so a key rotation must rerun signing and compilation. Protect the
builder and its cache as release infrastructure. Use `--push` instead of `--load`
only in the authorised publishing workflow, and promote the tested image digest.

The `deps` stage copies only `package.json`, `pnpm-lock.yaml` and
`pnpm-workspace.yaml`, then uses [pnpm fetch](https://pnpm.io/cli/fetch) to populate
the locked dependency store. It carries no profile, tool files or signing secrets.
The `build` stage copies the full checkout and runs the normal bootstrap check,
workspace linking and `pnpm install --offline --frozen-lockfile --prod=false`
before compiling and signing. Native dependency install scripts can still download
their own inputs; this is not a claim that the entire build needs no network.
An incomplete or invalid store does not waive lockfile integrity or bootstrap.

After a build, verify the signature on `catalog/tools/index.sig.json` against the
intended public pin and the actual index/tool bytes, and exercise a signed tool in
the served client. A signed catalog protects tool integrity; SUSE application
access still needs the approved Work/identity/ingress configuration. When a new
image replaces the staging candidate, refresh the relevant test evidence before CAB.

The release command verifies the built catalog before succeeding. To repeat the
check on `catalog/tools` and `tools` extracted from the final runtime image:

```sh
node scripts/verify-release-catalog.ts --root /path/to/extracted-dist \
  --public-key /path/to/expected-public.jwk.json
```

This checks every signed tool file and refuses paths or symlinks escaping the
extracted root. It does not verify application access or the image's provenance.

## Optional service images

CA, MCP and Penpot use the pinned Node Alpine base and explicit OpenSSL updates used
by Work. CA carries only its dependency-free handler and certificate helpers;
it does not need the tool packs or browser model files. Its health route is active
only when the CA is configured. Successful liveness does not verify the issuer,
root-key custody or enrollment flow.

MCP carries its required source, schemas, dependencies, fonts and materialised
selected profile content. Build-directory symlinks must not survive packaging.
Hosted model APIs and their unused native inference packages are omitted. This
image supports headless SVG/data and resvg PNG rendering; it has no Chromium.
Setting `LOLLY_WEB_BASE` alone cannot enable working browser formats. Use a
separately reviewed browser-enabled MCP deployment if those formats are needed.
The optional [public browser image and bounded overlays](public-vm.md#optional-public-browser-exports)
install lockfile-scoped Chromium on a pinned Debian base. They retain sandbox and
authentication defaults and require actual target export acceptance.

The maintained `deployment-suse.yml` workflow has opt-in native amd64 image
jobs. Dispatch its exact reviewed ref with `build_images=true`, matching
`expected_source`, the exact successful normal main CI run's `ci_run`, and the
existing published `public_key_jwk`. The source prerequisite requires completed
successful `ci.yml` push/main CI from this repository at that SHA, with its complete
job inventory from that exact attempt. It permits only the existing
`verified instance shell` skip on main; unfinished or failed checks refuse.
The checkout must match the dispatched SHA and belong to main. The public pin
must match `LOLLY_RELEASE_PUBLIC_KEY_JWK` in the repository's variables; passing a
new key through dispatch cannot rotate trust. Choose
`release_scope=web` for a TypeScript/UI web-image update. This runs chart and route
checks plus the existing frontend release gate and signed web-image qualification;
it does not build CA, Penpot, the MCP browser/probe shell or the separate docs
artifact. `release_scope=services-docs` prepares those independent services and
docs without running the frontend gate or web-image build. The default `full`
preserves the existing set. An unknown scope refuses. `build_images=false`
continues to run checks without publishing images.

Chart and route checks run first. The web shell image and the service images then qualify in
separate jobs, because only the web shell release waits for the physical
frontend environment table (plan 295):

- **Web image** (`web-image`). It runs only when the WebGPU release gate
  (`scripts/webgpu-release-gate.ts`) allows it, and refuses again before its
  build. The repository's `LOLLY_CATALOG_SIGNING_KEY` secret reaches only its
  BuildKit signing step; the release builder verifies that its public key matches
  the supplied pin, and the job verifies the image catalog against that pin.
  While `docs/supported-environments.md` is unpublished the gate withholds this
  image, the run still succeeds, and a warning says so.
- **CA and Penpot images** (`service-images`). They never ask the gate and
  wait for no web shell. The job boots both under their restricted bounds and
  publishes them.
- **MCP browser image** (`mcp-browser-image`). It never asks the gate and never
  waits for the web image. The job checks authentication and
  unavailable-admission refusal, and requires actual sandboxed Chromium
  SVG/PNG/PDF exports. Those exports drive the ordinary unsigned web shell built
  from the same source (`probe-web-shell`), using software WebGPU through
  Chromium's SwiftShader adapter. This qualifies container rendering without
  qualifying physical browsers or packaged webviews. The shell is kept for one
  day as the probe's input and never published. The MCP image must carry every
  tool file that shell carries, with identical bytes. Only this job waits for that shell, so a
  failed web build cannot withhold CA, Penpot or the docs.
- **Pairing with the production web shell.** In production the MCP drives the
  shell at its `webBase`, which stays on an older release while the web image is
  gated, so a tool or input that is new on main can fail a Tier-B render there.
  Dispatch with `paired_web_base` (that shell's HTTPS origin) and the MCP job
  compares its tools with the shell's signed file list
  (`deploy/docker/web-pairing.ts`). It records tools missing from the shell,
  tools whose signed files changed and tools only in the shell in
  `web-pairing.json`, with a warning when any differ. The report never blocks
  publication, and it compares file lists without verifying the shell's
  signature.
- **/info docs** (`info-docs`). The docs site is built from the same source,
  held to its size budget and kept as the `public-info-docs` artifact
  (`info.tar.gz`, `source.json`, `SHA256SUMS`), independent of the web image.
  Nothing serves that artifact yet: a deployment serves the `/info` baked into
  its web image until a deploy step serves the artifact instead (for Compose, a
  read-only bind mount of the extracted archive over `/usr/share/nginx/html/info`
  would do). That step is an open follow-up.

Each image job publishes source-labelled digests to GHCR and retains small
receipts: `public-candidate-web-receipts-attempt-N`,
`public-candidate-mcp-browser-receipts-attempt-N`, and
`public-candidate-service-receipts` (CA and Penpot). Here `N` is the candidate
workflow's positive run attempt. Web/MCP `release.json` records its exact numeric
`runAttempt` alongside `runId` and source. The unsigned MCP probe uses
`unsigned-probe-web-shell-attempt-N`, and the MCP job verifies that same attempt
in its source receipt. The normal-CI proof uses
`normal-main-ci-source-attempt-N`; its `ciRun` and `ciAttempt` identify the separate
normal CI run that qualified the source. Independent service/docs artifact
contracts remain unchanged. The candidate receipt artifacts replace the
single `public-candidate-image-receipts` artifact, and each `release.json` lists
only its own job's images, so a consumer of the old artifact name or of
`images.web` beside the service images needs updating. The offline export
(`archive_run`) judges each exported image by the job that qualified it, so it
can carry only the web image from a web-only run, only the MCP browser image,
or both. It requires the complete job inventory and successful source/chart/route
prerequisites, then downloads receipts only for successful image jobs. The web
image still needs its passing gate, and MCP needs its passing exact-source probe
shell. The archive captures the initially verified positive `run_attempt`, reads
jobs through `/attempts/N/jobs`, downloads only artifacts with that exact suffix,
and requires every web/MCP release receipt's `runAttempt` to match. It refuses
missing or cross-attempt identity instead of falling back to older unbound
artifacts. A partial rerun cannot borrow missing prerequisite jobs from another
attempt. The archive artifact is
`qualified-public-image-archives-attempt-M`, where `M` is the archive workflow's
own attempt; `transport.json` records the original `qualificationRun` and
`qualificationAttempt`. Its `transport.json` lists `web` under `withheld` when a completed gate
held it back, records intentionally omitted images under `notSelected`, and
records failed/cancelled image jobs under `notQualified`. A failed prerequisite
that skipped an image is not an intentional omission. A run with neither image
qualified refuses. Every selected receipt, source label, registry manifest and
OCI blob still must match; CA/Penpot remain available through their qualified
registry digests and the docs through their separate artifact.
These checks do not replace candidate HTTPS, CA enrollment, proxy peer,
invited-agent or Kubernetes runtime acceptance. A sandbox startup failure is a
failed qualification; the workflow does not retry with a bypass.

The public web job uses a digest-pinned BuildKit container builder to export and
reuse only the `deps` target in GHCR. Its cache reference is
`lolly-web-deps-cache:neutral-node26-pnpm11-amd64-<input-hash>` under the repository
owner. The hash covers the three dependency inputs and `web.Dockerfile`, so base,
package-manager and configuration changes select a new cache. Only the trusted
dispatch job can write it with its existing registry credential. The final image
imports that dependency cache, uses `--no-cache-filter build`, and exports no build
cache. Signing, full-source compilation, signature verification, boot qualification
and final image digest checks remain fresh. `dependency-cache.json` records the
inputs and scope. Services and the MCP browser image retain `--no-cache`.
Private profile bytes and signing material must never enter public cache or
artifact storage; the public cache recipe is not a private Work release recipe.
No qualified build timing has been measured for this change.

[`main-web-preparation.yml`](../../.github/workflows/main-web-preparation.yml)
prepares a web-only candidate after successful normal main CI, using
[`main-web-preparation.ts`](../../scripts/main-web-preparation.ts) to verify the
completed run and current main SHA before requesting the dispatch. It uses the
existing repository public pin and holds before dispatch while the plan 295
frontend release gate is closed. A requested dispatch is not proof that its image
qualified or that a deployment changed. No production credentials or automatic
promotion are involved. This workflow does not update a running instance.
The site's application-only updater can promote the reviewed public image; a
private Work instance's mounted signed shell, tool pack and engine pin remain
separate release inputs. Preserve the previous qualified lazy asset graph for
open tabs and review the matching shell/pack/backend contract before promotion.
No full infrastructure reinstall is introduced here.

Production MCP needs its approved token/signing-secret references and canonical
`LOLLY_MCP_PUBLIC_ORIGIN`, plus `LOLLY_RATE_LIMIT_REST_URL` and the matching
`LOLLY_RATE_LIMIT_REST_TOKEN` secret reference for its Redis-compatible HTTPS
REST limiter. CA needs its approved keys/issuer and `CA_RATE_LIMIT_REST_URL` /
`CA_RATE_LIMIT_REST_TOKEN` (or the shared `LOLLY_RATE_LIMIT_REST_*` pair).
Without a durable limiter, hosted admission fails closed unless an operator
explicitly accepts the weaker per-instance fallback. Do not use that fallback
to stand in for the approved production control. TCP/HTTP health checks do not
establish these controls.
Keep unused services out of the deployed scope. The existing private-content
access boundary still applies to every public render route and direct asset URL.

Standalone MCP and CA images support an [observable operator drain](../../services/shared/README.md)
for application updates and accounting-store migration. Configure a separate
runtime Secret for the loopback control listener, qualify the new readiness
probe, and require a settled receipt before replacing an active writer.

Penpot has a dependency-free standalone listener and optional hardened Compose
service. The [public Penpot VM recipe](public-penpot.md) supplies the Caddy mount,
two-command RPC boundary and staged qualification checklist for UpCloud or Evroc.
The recipe preserves opaque user tokens and streamed import progress. It does
not establish parity for the complete public host or authorize a DNS cutover.
