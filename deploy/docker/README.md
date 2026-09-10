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
  --secret id=LOLLY_CATALOG_SIGNING_KEY,env=LOLLY_CATALOG_SIGNING_KEY \
  --secret id=VITE_CATALOG_PUBLIC_KEY_JWK,env=VITE_CATALOG_PUBLIC_KEY_JWK \
  -t <registry>/lolly-web:<release> .
```

For file-based secret injection, replace `env=...` with `src=/secure/path/to/file`
on the corresponding `--secret` argument. Never pass the private key as a build
argument, add it with `COPY`, or commit it. The Docker context excludes `keys/`,
PEM/key files and dotenv files. The public key is deliberately present in the
served JavaScript; the private key must remain confined to the trusted builder.

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
