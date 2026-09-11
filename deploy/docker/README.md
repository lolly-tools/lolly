# Signed web images

The web image uses `pnpm run build:web:release`: it signs the selected profile's
catalog and embeds the matching public verification key and verified trust mode
in the client. Unsigned `build:web` output is for development and previews.

Use a checkout with the required content submodules populated. For SUSE, include
the private `brands/suse` submodule and select `LOLLY_PROFILE=suse`. Build a reviewed
release from a clean checkout and record its source/submodule commits and image digest.

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

CA and MCP use the pinned Node 24 Alpine base and explicit OpenSSL updates used
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
