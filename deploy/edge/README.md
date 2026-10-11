# Optional same-origin edges

Lolly works without a third-party CDN. The public static host and MCP origin set
their own delivery policy; Work decides privacy after resolving the caller and
current access. A path that is public on an OSS host can be private on Work.

`nginx-render-cache.conf` is an opt-in public-render cache, not a workspace cache.
Substitute an immutable release id and an upstream restricted to this proxy.
Changing the release id invalidates render keys. Preserve origin `Cache-Control`,
`Set-Cookie` and `Vary`; never use `proxy_ignore_headers` to force storage.
Cookies, Authorization, token queries and encoded query names bypass this cache.
An origin response must explicitly declare a public policy before storage. All
four supported purge-tag headers are hidden from the browser.
Its cache directory holds public unsigned renders only. Do not enable that cache
on private catalog, export, project, session or document-agent routes.

`Caddyfile` is a conservative same-origin file and MCP reference. Its static
policy revalidates all files, keeps the service worker out of shared caches and
returns missing or internal files as private 404 responses. Its native file
validators describe file metadata, rather than the full SHA-256 of each wire
representation. Direct Caddy file serving is therefore a compatibility option,
not qualification for Plan 300's full-SHA validator contract. Put Caddy in front
of the qualified static origin when that contract is required. Use the generated
Nginx maps and origin configuration for the full immutable tier.
Precompressed siblings preserve the decoded bytes;
there is no edge image optimization, transcoding, recompression or re-signing.
Integrate the web image's CSP and isolation headers before serving an application.

Use the applications' explicit trusted-proxy allowlist. At an untrusted boundary,
replace client-supplied forwarding headers. With a managed edge, restrict the
origin network to that edge's maintained egress list **and** require its private
origin credential or mTLS. An arbitrary `X-Forwarded-For`, cache tag or edge-name
header does not authenticate a proxy. Work's default same-origin mode requires no
new provider credential.

Qualify a proposed edge with `scripts/edge-probe.ts`: errors must be private;
identity and encoded responses must decode to the signed hash; private requests
must not share cached bodies; public image proxy responses must follow the
upstream policy. Recheck after configuration and release changes. The production
handoff and identity preflight take precedence over this generic reference.

`tests/reference-edge-http.test.ts` starts temporary local Nginx and Caddy
processes. It checks real public cache reuse, separate private cookie readers,
Authorization and token bypass, two proxy hops with spoofed forwarding headers,
hidden purge tags, compressed-byte preservation, service-worker policy and real
missing-file responses. The Caddy fixture also checks native conditional and
range responses while recording the full-SHA exception above. Set
`LOLLY_TEST_NGINX` or `LOLLY_TEST_CADDY` to select the installed binaries. Tests
skip explicitly when a binary is absent. These fixtures do not qualify a live
hostname, its TLS settings, its application CSP or a deployment's proxy allowlist.
