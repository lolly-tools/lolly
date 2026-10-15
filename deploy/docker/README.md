# Signed web images

For a managed organisation installation, use the
[Work enterprise identity runbook](https://github.com/lolly-tools/lolly-work/blob/main/docs/enterprise-identity.md)
with the Work deployment guide. This repository's static chart does not install
Work. For optional certificate identity, follow the
[CA deployment and lifecycle procedure](../../services/ca/README.md#deploy-and-maintain-managed-identity),
including verified-email compatibility and the installed JWT verifier dependency.

The web image consumes a prebuilt frontend signed for its exact source commit,
content profile and public verification key. The Docker build verifies every
artifact file, its catalog and the web release gate before copying the output to
nginx. It installs no frontend dependencies, runs no compiler and receives no
private signing key. Ordinary unsigned output is for development and previews.

Prepare release artifacts in separate jobs using `release-frontend.yml`:

1. A protected signer checks the reviewed source and release gate, then signs the
   source catalog using only the reviewed Node helpers.
2. A compiler job installs the locked dependencies, verifies that source catalog
   and uses `LOLLY_RELEASE_FRONTEND_PHASE=build`. It has the public pin and build
   settings, including `VITE_REQUIRE_AI_POLICY` and `VITE_LIVE_RELAY`, but no
   private signing material or signing environment.
3. A fresh protected job signs and verifies the output catalog, prepares static
   delivery files, then signs the complete frontend receipt. It runs no package
   installation or compiler. Upload the complete artifact with hidden files,
   including `.well-known` and `.delivery-etags.conf`.
4. A packaging job receives only that artifact and its public pin. Use the exact
   reviewed checkout and source SHA; the receipt binds source, target, profile
   and the complete output inventory. Record the image digest and qualification
   receipts together.

Configure `release-catalog-signing` with the approved reviewer list and source
restrictions, disable bypass, and move the catalog key into that environment.
Workflow declarations alone do not configure GitHub environment protection or
remove existing repository secrets. A single approved reviewer from the list
can approve each signing job. Signing jobs receive `LOLLY_CATALOG_SIGNING_KEY`
(PKCS8 PEM or private JWK); other jobs receive only the matching public
`VITE_CATALOG_PUBLIC_KEY_JWK`. Never put a private key in an image build argument,
context or BuildKit mount. The source context excludes local keys and dotenv
files.

With an approved artifact directory, the public pin and its reviewed source SHA:

```sh
docker buildx build --load --no-cache-filter verify \
  -f deploy/docker/web.Dockerfile \
  --build-context "release-frontend=/approved/frontend" \
  --build-arg "LOLLY_RELEASE_SOURCE=<reviewed-commit-sha>" \
  --build-arg LOLLY_PROFILE=lolly-start \
  --build-arg "VITE_CATALOG_PUBLIC_KEY_JWK=$VITE_CATALOG_PUBLIC_KEY_JWK" \
  -t <registry>/lolly-web:<release> .
```

The [named context](https://docs.docker.com/build/concepts/context/#named-contexts)
is separate from the source checkout. The verification stage rejects changed,
additional, missing or symbolic-link files, a different source/profile/key, and
an absent delivery configuration. `--no-cache-filter verify` repeats verification
on each packaging run. No source or dependency cache is exported by the image
job. Use `--push` only in the authorised publishing workflow and promote the
qualified digest.

Managed installations must compile the approved AI policy setting into their
artifact before signing; changing nginx environment variables does not alter
that setting. Promote the matching shell and Work together and retire old client
artifacts. Public standalone builds may leave the policy requirement false.

## Optional service images

CA, MCP and Penpot use the pinned Node Alpine base and explicit OpenSSL updates used
by Work. CA carries its handler, certificate helpers and the locked `jose` verifier;
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
  build. Protected source and artifact signer jobs surround an independent
  frontend compiler. The image job receives only the signed frontend and public
  pin, verifies its receipt before packaging, then verifies the extracted image
  bytes and catalog again before boot qualification and publication.
  While `docs/supported-environments.md` is unpublished the gate withholds this
  image, the run still succeeds, and a warning says so.
- **CA and Penpot images** (`service-images`). They never ask the gate and
  wait for no web shell. The job boots both under their restricted bounds and
  publishes them.
- **MCP image** (`mcp-image`). The browser-free `mcp.Dockerfile` image is the
  chart's default MCP repository. It never asks the gate and waits for no web
  shell. The job boots it under the chart's bounds (read-only root, no
  capabilities, 512 MiB, one CPU) with synthetic credentials and requires
  `/readyz`, `/healthz` and OAuth discovery to answer, a missing token to be
  refused and admission without a durable limiter to fail closed. A second
  container under the same bounds renders SVG and resvg PNG with no browser and
  confirms that PDF is refused. Only then is the digest published.
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
`public-candidate-mcp-receipts-attempt-N` (`mcp-boot.json`, `mcp-render.json`),
`public-candidate-mcp-browser-receipts-attempt-N`, and
`public-candidate-service-receipts` (CA and Penpot). Every image carries the
labels `org.opencontainers.image.title`, `.version` (the product version its
source declares), `.created` (that source's commit time in UTC, so a rebuild of
the same source keeps the same labels), `.revision`, `.source` and
`org.lolly.profile`. Here `N` is the candidate
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
or both; `archive_images=mcp` exports only the browser-free MCP image. A run
made before the MCP job existed lists no such job, and the export treats it as
not selected. It requires the complete job inventory and successful source/chart/route
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

The public web job uses a digest-pinned BuildKit container builder solely to
verify and package its prebuilt signed frontend. It exports no dependency or
source cache. The frontend compiler can use the lockfile-scoped package cache
through `setup-node`; the private key exists only in separate protected signing
jobs. Receipt verification, catalog verification, boot qualification and final
image digest checks remain fresh for every dispatch.

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

## Published images

From Lolly 1.1.1 the neutral (`lolly-start`) images are released to the GitHub
Container Registry. Each one is `linux/amd64`, built once by `deployment-suse.yml`
and released unchanged by
[`release-images.yml`](../../.github/workflows/release-images.yml). No image
contains model files or the private SUSE brand pack.

| Repository | Dockerfile | Chart |
|---|---|---|
| `ghcr.io/lolly-tools/lolly-web` | `web.Dockerfile` | `web.image` |
| `ghcr.io/lolly-tools/lolly-mcp` | `mcp.Dockerfile`, no browser: SVG, data and resvg PNG | `mcp.image`, the default |
| `ghcr.io/lolly-tools/lolly-mcp-browser` | `mcp-browser.Dockerfile`, with Chromium for PNG, JPEG, PDF and video | set `mcp.image.repository` and `mcp.webBase` |
| `ghcr.io/lolly-tools/lolly-ca` | `ca.Dockerfile` | `ca.image` |
| `ghcr.io/lolly-tools/lolly-penpot` | `penpot.Dockerfile` | not in the chart; see [public-penpot.md](public-penpot.md) |

A version tag such as `1.1.1` points at one released digest and never moves. The
chart's empty `image.tag` resolves to its `appVersion`, which is the same
version. `candidate-<40-hex source>` tags are qualified candidates that are not
signed or attested; do not deploy them. There is no `latest` tag. Deploy by
digest: set `image.digest` to the digest listed in the release's `images.json`.

### How a release is made

1. Dispatch `deployment-suse.yml` from main at the release commit with
   `build_images=true` (see above). Each image job qualifies its image and pushes
   `candidate-<source>`.
2. Within 14 days, while the receipts exist, dispatch `release-images.yml` from
   main with that run as `qualification_run`, the commit as `expected_source`,
   the product version as `version` and the images to release. Its `admit`
   job only reads (run inventories, receipts and the registry) and refuses
   unless every one of these holds:
   - the commit is on main and declares that version in `tauri.conf.json` and
     both chart `appVersion` fields;
   - the run is a completed dispatch of `deployment-suse.yml` from main for that
     commit, and the complete job inventory of its attempt shows the
     prerequisites and every job behind each requested image passing;
   - each receipt records that commit, run, attempt and the neutral profile,
     with its boot, render or browser-probe evidence (for web, the repository's
     public pin and a verified catalog);
   - the registry manifest hashes to the receipt's digest and is one
     `linux/amd64` image whose labels give that commit, title, version and
     profile;
   - the version tag is unused or already points at the same digest.
3. The `promote` job then waits for approval in the `release-images`
   environment. It is the only job with the OIDC identity and package write
   access. After approval it rebuilds the plan from the admitted files, requires
   the source to still be on main and checks each registry copy and tag again.
   For every digest it then writes an SPDX SBOM with `syft` (packages, without a
   per-file inventory), signs the digest keylessly with `cosign`, attests the
   SBOM and SLSA provenance, and verifies all three against its own identity.
   Only after every image passes does it tag each digest with `crane tag`, which
   copies the manifest bytes unchanged, then checks that the tag resolves to the
   qualified digest. `images.json` (repository, tag, digest, source, runs and
   signing identity) is kept as the `release-images-<version>-attempt-N`
   artifact for the GitHub release. The source commit can be later than the
   release's git tag; `images.json` and the release notes name the commit the
   images were built from. To retry after a failure, re-run the whole workflow,
   because the approved job reads the admission files of its own attempt.
4. New packages are private. An organisation owner makes each one public once,
   in the package's settings: **Danger Zone**, **Change visibility**, **Public**.
   The workflow token cannot change visibility.

The provenance (build type `https://github.com/lolly-tools/lolly/blob/main/deploy/docker/README.md#published-images`)
records what the qualification run did: the workflow and ref
(`deployment-suse.yml` on `refs/heads/main`), the source commit, Dockerfile,
profile and platform, the run attempt as `invocationId`, and the SHA-256 of each
receipt the release checked as `byproducts`. The certificate identifies the release
workflow, which signed after rechecking those receipts; the build job itself
holds no signing identity.

### Verify a release

The release workflow signs with cosign 3.0.6, so verify with cosign 3.0 or later.
Take the digest from `images.json`:

```sh
cosign verify ghcr.io/lolly-tools/lolly-ca@sha256:<digest> \
  --certificate-identity https://github.com/lolly-tools/lolly/.github/workflows/release-images.yml@refs/heads/main \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
for type in spdxjson slsaprovenance1; do
  cosign verify-attestation ghcr.io/lolly-tools/lolly-ca@sha256:<digest> --type "$type" \
    --certificate-identity https://github.com/lolly-tools/lolly/.github/workflows/release-images.yml@refs/heads/main \
    --certificate-oidc-issuer https://token.actions.githubusercontent.com
done
crane digest ghcr.io/lolly-tools/lolly-ca:1.1.1   # prints the same sha256:<digest>
```

### Mirror by digest

```sh
skopeo copy --all --preserve-digests \
  docker://ghcr.io/lolly-tools/lolly-ca@sha256:<digest> \
  docker://registry.example.com/lolly/lolly-ca:1.1.1
```

The mirrored image keeps its digest, so a verification against GHCR covers the
copied bytes. Signatures and attestations are separate registry artifacts that
`skopeo` does not copy. Verify against GHCR before mirroring, or copy them too
with `cosign copy ghcr.io/lolly-tools/lolly-ca@sha256:<digest> registry.example.com/lolly/lolly-ca`
and verify against your registry.

### Model files

The web image serves no models. Its client fetches content-addressed paths,
`/models/<family>@<hash16>/<file>`, where `<hash16>` is the first 16 hexadecimal
characters of the family's `directorySha256`. Each entry's `immutableUrl` in
`shells/web/models-manifest.json` at the release commit is that path. Mount a
read-only volume holding that tree at `/usr/share/nginx/html/models`:

```text
/usr/share/nginx/html/models/
  ai-detect@30f9e0352083d430/e5-small-ai-detector/config.json
  <family>@<hash16>/<file>
```

Every file must match the `size` and `sha256` its manifest entry records. The
plain `/models/<family>/<file>` paths are legacy aliases that the release client
does not fetch. `https://lolli.li/models/` serves the same tree, so a volume can
be filled from it (about 4.1 GB for 1.1.1), run from a checkout of the release
commit:

```sh
node -e 'for (const f of require("./shells/web/models-manifest.json")) console.log(f.immutableUrl, f.sha256)' |
while read -r url sha; do
  file="models-volume/${url#/models/}"
  mkdir -p "$(dirname "$file")"
  curl -fsSL --retry 3 -o "$file" "https://lolli.li$url"
  echo "$sha  $file" | sha256sum --check --quiet
done
```

`scripts/model-release.ts stage` still writes only the alias paths, so it does
not produce this layout; see [model delivery](../models-host/README.md).
