# Delivery deployment

This page is for an operator who puts a proxy, CDN or object store in front of Lolly. Done right, signatures still verify, caches serve the right bytes to the right people and nothing private ends up in a shared cache. Lolly needs no third-party CDN; a same-origin web server is enough, on premises or on a sovereign or public cloud, and K3s, RKE2 and a standalone server follow the same rules.

Read it beside [Choose a deployment](/info/deployment.html), [Run on Kubernetes](/info/build-kubernetes.html) and your instance's privacy policy. Source tests and reference configuration do not establish that a particular deployment has passed the checks below.

## Choose the boundary

Serve the shell, the public catalog and the tools through the instance's own origin. Keep private Lolly Work APIs behind their normal authentication and permission checks. A hashed filename does not make a private file public: only the route that resolves the caller and their current access can choose a delivery class.

Web model downloads default to `/models/` on that origin. A build can set `VITE_MODELS_BASE` to a separate model host. Packaged apps can use lolli.li, and a private instance can use its own static server or object store. Before using a chosen host, add it to the browser policy and publish its processor disclosure. An air-gapped installation must supply the models locally.

For a managed edge, limit origin access to that edge's maintained network allowlist and require a private origin credential or mTLS. Replace untrusted forwarding headers at the first trusted proxy. A forwarded IP, cache tag or edge name supplied by a client is not proof that a request came through your edge.

## Preserve the response policy

`packages/core/src/delivery-v1.ts` defines the headers the app and its adapters share. The status is part of the decision: an error must never inherit a public file's caching policy.

| Class | Browser and shared-cache behaviour | Examples |
|---|---|---|
| Public immutable | One year, `immutable, no-transform`; the bytes at that address never change | Hashed assets, signed tool directories, model directories and previews |
| Public revalidate | `max-age=0, must-revalidate, no-transform` | HTML, the mutable catalog envelope and legacy file aliases |
| Public bounded | By default one hour in the browser, one day at an edge and up to seven days stale while revalidating | Public unsigned `/tool/` renders. Image proxy responses use the upstream's permitted age, capped at one hour |
| Instance private | Browser revalidation by default, or an explicit lifetime of at most 300 seconds; shared caches must not store the response | Authorised catalogs and instance files where reuse is permitted |
| Person private | `private, no-store, max-age=0, no-transform`; shared caches also get `no-store` | Personal results, refusals and errors |
| Link | Private, at most 300 seconds, never shared-cached; token-bearing requests use `no-referrer` | Optional principal-bound downloads on an operator-enabled, authenticated, single-replica MCP gateway |

The service worker is revalidated separately and never shared-cached. Public validators describe the exact representation, so compressed and identity responses have separate strong ETags. Signed dynamic output uses a weak validator when a fresh signature can change the bytes. A range request needs a strong validator, and an invalid or weak `If-Range` must return the full representation instead.

Never force storage with `proxy_ignore_headers` or a provider's "cache everything" rule. Cookies, Authorization, token queries, `Set-Cookie`, private routes and refusals bypass shared caches. Hide internal purge tags from the browser. Keep CSP, COOP, COEP, CORP and Referrer-Policy through the proxy, on 304 and error responses too. The [edge references](https://github.com/lolly-tools/lolly/tree/main/deploy/edge) show working configurations.

## Build and retain actual files

The release pass creates files such as `asset.<sha16>.webp`, signed `/tools/<id>@<sha16>/` directories and `index.<sha16>.json` copies, and rewrites only the extracted release's references. The full hashes stay in the signed envelope and the asset checksums; the suffix is an address, not proof of integrity.

A release goes out in this order:

::: timeline
- <!--i:upload--> **Publish every immutable file first.** Nothing points at them yet, so nothing changes for readers.
- <!--i:document--> **Switch the mutable HTML and the catalog envelope.** The envelope's sequence must advance from the verified predecessor; do not reset it when starting from a fresh build directory.
- <!--i:folder--> **Keep the previous release's files.** Its hash families and legacy aliases stay available for tabs that are already open. Deleting old files needs an explicit client-support and retention decision.
- <!--i:trash--> **Expire the bounded renders.** Purge their tags on a managed CDN, or start a fresh render-cache key on your own proxy (see [Release staleness and purge](#release-staleness-and-purge)).
- <!--i:checklist--> **Probe the result** with the read-only edge probe (see [Disclose and qualify](#disclose-and-qualify-before-enabling-an-edge)).
:::

Lolly Work also keeps scoped catalog snapshots for at least one hour, and checks current access again before serving historical private bytes.

For an extracted build, the release integration runs:

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

Use your approved signing configuration and pinned key, and never put a private key in these paths or arguments; the normal release wrapper supplies those inputs. The final delivery pass adds compressed siblings and exact ETags without changing the decoded bytes. nginx can serve gzip siblings with `gzip_static`, while Brotli needs a suitable module; Caddy and Lolly Work can negotiate both precompressed forms. Never apply the public static maps to private Lolly Work routes just because their paths look alike.

## Release staleness and purge

Immutable files need no purge, and mutable files revalidate. Public bounded renders can be 86,400 seconds old at an edge after an engine or catalog release, plus a further 604,800 seconds while the edge serves stale responses during revalidation. Changing the release ID in the reference nginx render-cache key starts a fresh key space; alternatively, clear that public render cache during the release.

For a managed CDN, purge the affected release, engine and catalog tags (`r_`, `e_`, `c_`) after the new files are published. The operator or release pipeline runs that step; the open-source project runs no purge service. Never purge retained immutable files to simulate an update. Preview, share-card and documentation image references use hashed files inside revalidated documents, so they need no bounded-render purge.

## Keep credentials and originals intact

Turn off edge resizing, transcoding, metadata stripping and re-signing. Also turn off script injection, analytics, tag managers, script deferral, email obfuscation, bot challenges that replace app responses, crawler hinting and cached-copy fallback when the origin is down. Compression must decode to the original signed bytes. Compare HTML and images through the edge with their origin copies.

Display renditions are generated and signed once. Each keeps its credits and an original parent or source hash, and has its own catalog checksums. Selection, placement and export use the original formats. See [Authoring assets](/info/authoring-assets.html#delivery-addresses-and-display-renditions).

Model manifests carry every file's full SHA-256 and a directory hash. Install a model only after all decoded bytes match the expected length and full hash. An interrupted download can keep a partial copy, but resuming must check its range and the final whole-file hash before the model is available offline. A 16-character address suffix, a response header or a finished progress bar cannot replace that check.

::: details Model downloads through an object store: CORS rules
Public model responses use a constant `Access-Control-Allow-Origin: *`, including for requests with no `Origin` header, and never send `Access-Control-Allow-Credentials` or `Set-Cookie`. That keeps the public cache key independent of the reader's origin; only `Accept-Encoding` may vary. Configure the object store to allow anonymous GET and HEAD requests and to expose `ETag`, `Content-Range` and `Accept-Ranges`, so browsers can validate resumed downloads.

The publisher and the delivery probe send no credentials and refuse redirects. Their origin matrix covers packaged apps (`Origin: null`), lolly.tools, lolly.ing, an unrelated web origin and a request with no `Origin`. Small files are hashed from every variant. Large files are hashed once, and the other variants check the same strong ETag and declared size with HEAD; those metadata checks do not claim a second whole-file hash.

S3-compatible CORS can reflect the requested origin. That permits anonymous access when it matches, but a changing CORS response needs `Vary: Origin` under the [Fetch cache guidance](https://fetch.spec.whatwg.org/#cors-protocol-and-http-caches), and it fails this deployment's constant, path-only public cache policy even with that extra `Vary`. Publish through a boundary that returns the constant wildcard, and qualify its real responses before activating new model addresses. Changing a bucket's allowed origins alone does not prove that its delivered headers meet this requirement. Keep existing aliases and additive objects.
:::

::: details Private MCP result downloads
Principal-bound MCP result downloads are optional and off by default. An operator turns them on with `LOLLY_MCP_PRIVATE_FILES=1`, configures an authenticated gateway and its fixed `LOLLY_MCP_PUBLIC_ORIGIN`, and runs one replica (`LOLLY_MCP_REPLICAS=1`, or Helm's `mcp.privateFiles.enabled: true` with `mcp.replicaCount: 1`). Use a Recreate update: ownership and result lookup belong to that one process, and a restart invalidates its existing links. Publish the gateway's hostname and data handling before turning it on, and keep the existing anonymous gateway's inline response mode.

Qualification must show that a result link is bound to the same validated bearer used for its render, refuses another bearer and expires within 300 seconds. Output bytes use private temporary files, with expiry pruning and removal on clean shutdown; the lookup and ownership state stay in memory. Check per-bearer and gateway holding limits, daily CPU and decoded-byte accounting for holds and downloads, restart invalidation and private refusals, as well as successful responses. Require `private, no-store` and `Referrer-Policy: no-referrer`, and do not turn this into an anonymous output cache. Private workspace editing and invited document agents are separate services.
:::

## Check the signed catalog in a browser

**Load the envelope before its indexes.** In DevTools, watch the catalog envelope load before `index.<sha16>.json`. The envelope must cover the exact tool, asset and slim index bytes. Repeat the sync: unchanged responses can return 304, but the saved bytes must still pass their full hashes. In IndexedDB's profile store, `catalog-trust-v1:` records hold the accepted snapshot and its sequence together. A changed index, a forged higher sequence or an older signed envelope must show a refusal and leave that record unchanged. Run those negative cases against a test instance, not a shared production catalog.

**Verify offline.** Accept a verified catalog, go offline, reload and use a cached tool. The catalog reports its offline verification state. A plain-HTTP context without WebCrypto must say that verification is unavailable rather than claim it verified the signature.

## Disclose and qualify before enabling an edge

For every browser-facing or server-side delivery hostname, record the processor, its function, the hosting region, the legal jurisdictions, the metadata it receives, its log retention and the transfer arrangements that apply. A same-origin reverse proxy can still be a processor, because it terminates TLS. Regions can differ by hostname and by identity or asset provider, so do not infer a whole deployment's jurisdiction from its VM. Publish those choices in the instance's privacy policy before activation.

Run the read-only probe against a reviewed sample list. Keep credentials in the environment variables that `credentialEnv` gives, never in addresses or receipt files:

```bash
node scripts/edge-probe.ts --samples /path/to/samples.json --out /path/to/private-receipt.json
```

Each sample in the list gives the expected full hash, taken from the release manifest or asset index, and the checks to run:

```json
[
  {
    "origin": "https://your-instance.example",
    "path": "/catalog/assets/example.0123456789abcdef.svg",
    "cls": "public-immutable",
    "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "checkConditional": true,
    "checkRange": true,
    "requireStrongETag": true,
    "compress": true
  }
]
```

Replace the illustrative path and hash with the real release values. For private resources, add samples for two readers with separate `credentialEnv` names and `credentialType: "cookie"` or `"bearer"`, using resources expected to differ between them, so a response shared by mistake shows up. Keep the credentials in the environment, never in the sample URL.

For a public catalog, `--catalog` derives samples from the live signed index instead of a hand-written list. Pin the catalog public key in the environment and pass your own shell samples:

```bash
DELIVERY_CATALOG_PUBLIC_KEY_JWK="$(cat catalog-public.jwk)" \
  node scripts/edge-probe.ts --samples /path/to/your-shell-samples.json \
  --catalog --catalog-origins https://your-host.example --out /path/to/receipt.json
```

Without `--samples`, the probe also checks its built-in shell samples for lolly.tools and lolly.ing. Your receipt would then depend on those hosts, and they would receive your probe's address. A file holding `[]` runs the catalog checks alone.

The probe verifies the signature first and takes every expected hash from the signed index. It checks the hashed indexes, a daily rotation of hashed tool, preview and asset files with the legacy names they replace, a warm 304 for each and one missing address per hashed family, which must answer 404 without being stored. Requests carry no cookies or bearer tokens. A derived sample replaces one from your list at the same address only when it checks everything that sample does, so a reviewed credential, range, C2PA, CORS or age check still runs. A catalog that refuses anonymous readers or carries an instance scope yields no samples, so private catalogs still need a reviewed sample list.

Include identity and compressed bytes, cold 200 and warm 304 requests, ranges, model hashes, signed images, anonymous refusals and two different authorised readers of private resources. A failed check blocks qualification, and `--observe` records gaps without qualifying the deployment. Repeat after every release and proxy configuration change, and keep a working rollback release. Follow your own production handoff and identity checks before any change to a live deployment.

::: note The reference instance
The maintained lolly.tools and lolly.ing apps run on UpCloud in Frankfurt, on K3s; the [sovereign profile](/info/build-kubernetes.html#one-node-public-and-private-routes-the-sovereign-profile) is the recipe for that kind of deployment. The separate lolli.li release and model host uses UpCloud Managed Object Storage in europe-2, also Frankfurt, and that inventory is verified independently of the app's host. The [reference privacy policy](/info/privacy.html#delivery-hosts-and-processors) lists these hosts without claiming an unverified log-retention period. No new CDN is turned on by the delivery rules on this page.

Two items are still open. A restricted MCP hostname, `mcp.lolly.tools` on the same UpCloud processor, is planned and not yet active. And on 2026-10-11 the lolli.li object-storage responses reflected the tested origins without `Vary: Origin`, which the model CORS rules above do not allow; that is a recorded qualification gap, not an approved exception.
:::
