# Delivery deployment

Lolly works with a same-origin web server and no third-party CDN. This guide
covers public files, catalog updates, model downloads and private workspace
responses. Use it alongside [Deployment](/info/deployment.html), the
[web container and Helm guide](/info/build-kubernetes.html), and your instance's
privacy policy. The rules apply on premises and on sovereign or public clouds.
K3s, RKE2 and a standalone server use the same application contract.

The reference lolly.tools and lolly.ing applications run on UpCloud in Frankfurt.
The separate lolli.li release and model host uses UpCloud Managed Object Storage
in europe-2, also Frankfurt. That inventory is verified independently of the VM;
an external model host's location must not be inferred from the application host.
No new CDN is activated by the delivery changes described here.
Source tests and reference configuration do not establish that a particular
deployment has passed the checks below.

## Choose the boundary

Serve the shell, public catalog and tools through the instance's own origin.
Keep private Work APIs behind their normal authentication and permission checks.
A hashed filename does not make a private file public: only the route that
resolves the caller and current access can choose a delivery class.

Web model downloads default to `/models/` on that origin. A build can set
`VITE_MODELS_BASE` to a separate model host. Packaged applications can use
lolli.li; a private instance can use its own static server or object store.
Include a chosen host in the browser policy and publish its processor disclosure
before using the provider. An air-gapped installation must supply the models locally.

For a managed edge, restrict origin access to that edge's maintained network
allowlist and require a private origin credential or mTLS. Replace untrusted
forwarding headers at the first trusted proxy. A client-supplied forwarded IP,
cache tag or edge name is not proof that a request came through your edge.

## Preserve the response policy

`packages/core/src/delivery-v1.ts` defines the headers shared by the application
and its adapters. The status is part of the decision: errors must not inherit a
public file's caching policy.

| Class | Browser and shared-cache behaviour | Examples |
|---|---|---|
| Public immutable | One year, `immutable, no-transform`; actual bytes never change at that address | Hashed assets, signed tool directories, model directories and previews |
| Public revalidate | `max-age=0, must-revalidate, no-transform` | HTML, the mutable catalog envelope and legacy file aliases |
| Public bounded | Default: one hour in the browser, one day at an edge, up to seven days stale while revalidating | Public unsigned `/tool/` renders. Image proxy responses use the upstream's permitted age, capped at one hour |
| Instance private | Browser revalidation by default, or an explicit lifetime of at most 300 seconds; shared caches must not store the response | Authorised catalogs and instance files where reuse is permitted |
| Person private | `private, no-store, max-age=0, no-transform`; shared caches also receive `no-store` | Personal results, refusals and errors |
| Link | Private, at most 300 seconds, never shared-cached; token-bearing requests use `no-referrer` | Optional principal-bound download links, held in this release |

The service worker is separately revalidated and never shared-cached. Public
validators describe the exact representation: compressed and identity responses
have separate strong ETags. Signed dynamic output uses a weak validator when a
fresh signature can change the bytes. A range request needs a strong validator;
an invalid or weak `If-Range` must return the full representation instead.

Never force storage with `proxy_ignore_headers` or a provider's "cache everything"
rule. Cookies, Authorization, token queries, `Set-Cookie`, private routes and
refusals bypass shared caches. Hide internal purge tags at the browser boundary.
Keep CSP, COOP, COEP, CORP and Referrer-Policy through the proxy, including 304 and
error responses. See the [edge references](https://github.com/lolly-tools/lolly/tree/main/deploy/edge).

## Build and retain actual files

The release pass creates files such as `asset.<sha16>.webp`, signed
`/tools/<id>@<sha16>/` directories and `index.<sha16>.json` copies. It rewrites
only the extracted release's references. The full hashes remain in the signed
envelope and asset checksums. The suffix is an address, not sufficient evidence
of integrity.

Publish all immutable files before switching mutable HTML and the catalog
envelope. The envelope's sequence must advance from the verified predecessor;
do not reset it when starting from a fresh build directory. Keep the preceding
release's hash families and legacy aliases available for older open tabs.
Deleting old files requires an explicit client-support and retention decision.
Work also retains scoped catalog snapshots for at least one hour and checks
current access again before serving historical private bytes.

For an extracted build, the release integration uses these steps:

```bash
node scripts/build-catalog-renditions.ts --root /path/to/release
node scripts/sign-catalog.ts \
  --tools /path/to/release/tools \
  --index /path/to/release/catalog/tools/index.json \
  --out /path/to/release/catalog/tools/index.sig.json \
  --previous-envelope /path/to/verified-previous/catalog/tools/index.sig.json \
  --retain /path/to/verified-previous \
  --materialize
node scripts/build-delivery.ts --root /path/to/release --previous /path/to/verified-previous
node scripts/verify-release-catalog.ts --root /path/to/release
```

Use your approved signing configuration and pinned key; do not put private keys
in these paths or command arguments. The normal release wrapper supplies those
inputs. The final delivery pass adds compression siblings and exact ETags without
changing decoded bytes. Nginx can serve gzip siblings with `gzip_static`; Brotli
requires a suitable module. Caddy and Work can negotiate both precompressed
representations. The public static maps must never be applied to private Work
routes merely because they have similar path names.

## Release staleness and purge

Immutable files need no purge. Mutable files revalidate. Public bounded renders
can be 86,400 seconds old at an edge after an engine or catalog release, plus a
further 604,800 seconds while an edge serves stale responses during revalidation.
Changing the release ID in the reference Nginx render-cache key starts a fresh
key space. Alternatively, clear that public render cache during the release.

For a managed CDN, purge the affected release, engine and catalog tags (`r_`,
`e_`, `c_`) after the new files are published. The operator or release pipeline
runs that step; the OSS runs no purge service. Never purge retained immutable
files to simulate an update. Preview, OG and documentation image references use
hashed files in revalidated documents and need no bounded-render purge.

## Keep credentials and originals intact

Turn off edge resizing, transcoding, metadata stripping and re-signing. Also
disable script injection, analytics, tag managers, script deferral, email
obfuscation, bot challenges that replace application responses, Crawler Hints
and Always Online. Compression must decode to the original signed bytes.
Compare HTML and images through the edge with their origin copies.

Display renditions are generated and signed once, retain credits and an original
parent or source hash, and have their own catalog checksums. Selection, placement
and export use original formats. See [Authoring assets](/info/authoring-assets.html#delivery-addresses-and-display-renditions).

Model manifests contain every file's full SHA-256 and a directory hash. Install
only after all decoded bytes match the expected length and full hash. An
interrupted download can retain a partial copy, but resume must validate its
range and final whole-file hash before making it available offline. A 16-character
URL suffix, response header or completed progress bar cannot replace that check.

Public model responses use constant `Access-Control-Allow-Origin: *`, including
requests without an `Origin` header, and never send `Access-Control-Allow-Credentials`
or `Set-Cookie`. This keeps the public cache key independent of the reader's
origin; only `Accept-Encoding` may vary. Configure the object store to allow
anonymous GET and HEAD requests and expose `ETag`, `Content-Range` and
`Accept-Ranges` so browsers can validate resumed downloads. The publisher and
delivery probe explicitly omit credentials and refuse redirects. Their origin
matrix includes packaged applications (`Origin: null`), lolly.tools, lolly.ing,
an unrelated web origin and a request with no `Origin`. Small files are hashed
from every variant. Large files are hashed once; the other variants check the
same strong ETag and declared size with HEAD. Those metadata observations do not
claim an additional whole-file hash.

S3-compatible CORS can reflect the requested origin. That permits anonymous
access when it matches, but a changing CORS response needs `Vary: Origin` under
the [Fetch cache guidance](https://fetch.spec.whatwg.org/#cors-protocol-and-http-caches).
It fails this deployment's constant, path-only public cache policy even with
that extra `Vary`. On 2026-10-11, the lolli.li object-storage responses reflected
the tested origins without `Vary: Origin`; this is a recorded qualification gap,
not an approved exception. Publish through a boundary that returns the constant
wildcard, and qualify its actual responses before activating new model URLs.
Changing a bucket's allowed origins alone does not prove that its delivered
headers satisfy this requirement. Keep existing aliases and additive objects.

Principal-bound MCP result downloads remain held pending qualification. Do not
enable them as an anonymous output cache. A qualified deployment must bind the
token to the authenticated caller and require that caller's bearer on download,
expire held memory within 300 seconds and use a single gateway replica or session
affinity. Private workspace editing and invited document agents are separate
services.

## Disclose and qualify before enabling an edge

For every browser-facing or server-side delivery hostname, record the processor,
function, hosting region, legal jurisdictions, metadata received, log retention
and applicable transfer arrangements. A same-origin reverse proxy can still be
a processor because it terminates TLS. Regions can differ by hostname and by
identity or asset provider; do not infer the whole deployment's jurisdiction from
its VM. Publish those choices in the instance's privacy policy before activation.
The [reference policy](/info/privacy.html#delivery-hosts-and-processors) lists the
current UpCloud hosts without claiming an unverified log-retention duration.

Run the read-only probe against a reviewed sample list. Keep credentials in
environment variables named by `credentialEnv`, never URLs or receipt files:

```bash
node scripts/edge-probe.ts --samples /path/to/samples.json --out /path/to/private-receipt.json
```

Include identity and compressed bytes, cold 200 and warm 304 requests, ranges,
model hashes, signed images, anonymous refusals and two different authorised
readers of private resources. A failed check blocks qualification. `--observe`
records gaps without qualifying the deployment. Repeat after releases and proxy
configuration changes, and keep a working rollback release. Follow your
production handoff and identity preflight before any live mutation.
