# Configure connector origins

Custom connector requests require exact operator approved HTTPS origins. The
default policy permits the fixed public Google, Microsoft Graph, Dropbox and
reference APIs listed in `packages/core/src/connector-origins.ts`. SharePoint
and other storage upload/download hosts, S3, WebDAV, Mastodon, Bluesky, Discord
and additional connector endpoints require configuration. Existing connections
remain on the device when a request is denied; forms and export bytes are not
cleared, and the application does not reload automatically.

Set the public build variable `VITE_CONNECTOR_ORIGINS` to a space-separated list
such as `https://storage.example.com https://tenant.sharepoint.com`. Paths,
wildcards, credentials, queries, fragments, IP literals and scheme-only grants
are refused. Origins are normalized by host and port; an omitted port means
443. Configure every upload/download origin used by a provider, including
preauthenticated storage URLs. Never paste a token or a signed URL into this
setting. Selecting an endpoint in Profile does not approve its origin.

Native builds include these values in the application policy. The shared
connector transport forwards the exact approved list to Rust, which checks the
initial destination and each redirect before making the next request. Generic
native instance requests retain their separate public-network checks. Shell resource readers can set lower response byte limits
and a timeout covering the entire native request before IPC buffering. A native
policy update requires a newly built and signed frontend; it does not change
the installed application's permissions at runtime.

Web builds consult the same-origin application response's enforced CSP header
before sending custom connector requests. Every enforced policy must explicitly
list the origin. Missing headers and broad grants do not approve a connector.
The browser independently enforces the policy loaded with the document. After
an operator updates headers, save your local work and reopen the application.
Browser connector redirects fail closed; configure a canonical endpoint that
does not redirect. The destination must also permit CORS.

Use `node scripts/configure-connector-origins.ts INPUT OUTPUT` with the public
variable set to render a Vercel JSON or nginx configuration. Only `connect-src`
changes. Review the rendered file before deployment. For Vercel, provide the
rendered configuration through `vercel --local-config OUTPUT`; setting a build
environment variable alone does not update Vercel response headers. For an RPM
or public VM, install the rendered nginx file through the deployment's normal
configuration process and validate nginx before reloading. Application artifact
bytes and their signed receipt remain unchanged.

The web container accepts `VITE_CONNECTOR_ORIGINS` as a public build argument
and renders nginx in its isolated verification stage. The sovereign Helm
profile accepts `connectorOrigins`, an array of exact HTTPS DNS origins; the
rendered policy is included in the workload configuration checksum. YunoHost
uses its existing `csp_extra_connect_src` setting, validates before reloading,
and retains the setting through upgrades. Development servers apply the same
connection policy plus their exact development WebSocket origin.

The reusable frontend workflow exposes a public `connector_origins` input.
Its callers use `vars.VITE_CONNECTOR_ORIGINS`; compilation receives no catalog,
native signing or CA private keys. Enrollment trust remains separately pinned
through `VITE_CA_ENROLLMENT_TRUST_JSON`.

Exact connection origins do not distinguish tenants or accounts on Google and
Microsoft Graph APIs. They are not a complete data-egress boundary. Other
resource directives, external authorization windows and native capabilities
have separate policies. Provider permissions and organisation controls must
still approve the account and operation. No tenant endpoints are configured by
default. Qualify the actual endpoint, CORS, upload/download origins, redirect
behavior and native platforms before enabling a connection in a deployment.
