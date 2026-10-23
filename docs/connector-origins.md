# Configure connector origins

This page is for an operator who needs Lolly to reach the organisation's own storage or services, such as a SharePoint tenant, an S3 bucket or a WebDAV server. The job is short: list the exact origins, rebuild the frontend and deploy the web server header that carries them.

## What is allowed by default

The default policy permits the fixed public Google, Microsoft Graph, Dropbox and reference APIs listed in `packages/core/src/connector-origins.ts`. Everything else needs configuring: SharePoint and other storage upload and download hosts, S3, WebDAV, Mastodon, Bluesky, Discord and any additional connector endpoint. No tenant endpoints are configured by default.

When a request is denied, existing connections stay on the device, forms and export bytes are not cleared and the app does not reload by itself.

## Add your origins

Set the public build variable `VITE_CONNECTOR_ORIGINS` to a space-separated list of exact HTTPS origins:

```bash
VITE_CONNECTOR_ORIGINS="https://storage.example.com https://tenant.sharepoint.com"
```

- **Exact origins only.** Paths, wildcards, credentials, queries, fragments, IP literals and scheme-only grants are refused.
- **Host and port.** Origins are normalised by host and port, and an omitted port means 443.
- **Every origin a provider uses.** Include every upload and download origin, preauthenticated storage addresses too.
- **No secrets.** Never paste a token or a signed URL into this setting.

Choosing an endpoint in Settings does not approve its origin; only this list does.

## Apply it to your deployment

::: timeline
- <!--i:sliders--> **Set the variable** on the frontend build.
- <!--i:box--> **Rebuild and sign the frontend.** Native builds carry the list inside the app, so a native policy change needs a newly built and signed frontend; it never changes an installed app's permissions at runtime.
- <!--i:document--> **Render the web server's header file.** Run `node scripts/configure-connector-origins.ts INPUT OUTPUT` with the variable set. It accepts any configuration file that declares a `connect-src` policy and changes only `connect-src`. Review the rendered file.
- <!--i:server--> **Deploy the rendered file and reload the server.** Setting the build variable alone does not change the headers a host sends. Validate the configuration before reloading. The app's files and their signed receipt stay unchanged.
- <!--i:globe--> **Save local work and reopen the app,** because a browser keeps the policy it loaded with the page.
:::

Each deployment shape takes the list its own way:

- **Web container:** pass `VITE_CONNECTOR_ORIGINS` as a public build argument; the image renders nginx in its isolated verification stage.
- **Sovereign Helm profile:** set `connectorOrigins`, an array of exact HTTPS DNS origins. The rendered policy is part of the workload configuration checksum.
- **YunoHost:** use the existing `csp_extra_connect_src` setting. The package validates before reloading and keeps the setting through upgrades.
- **RPM or public VM:** install the rendered nginx file through the deployment's normal configuration process, and validate nginx before reloading.
- **Development servers** apply the same connection policy plus their exact development WebSocket origin.

The reusable frontend workflow takes a public `connector_origins` input, and its callers pass `vars.VITE_CONNECTOR_ORIGINS`. Compilation receives no catalog, native signing or CA private keys. Enrolment trust is pinned separately, through `VITE_CA_ENROLLMENT_TRUST_JSON`.

## How the app checks a request

::: cols
## Web

- Before a custom connector request, the app reads the enforced CSP header of its own same-origin response.
- Every enforced policy must list the origin explicitly. A missing header or a broad grant does not approve a connector.
- The browser separately enforces the policy it loaded with the page.
- Connector redirects fail closed, so configure a canonical endpoint that does not redirect.
- The destination must also allow CORS.

## Native

- The shared connector transport passes the exact approved list to Rust.
- Rust checks the first destination and every redirect before making the next request.
- Other native instance requests keep their own public-network checks.
- A resource reader can set lower response byte limits, and a timeout that covers the whole native request before the response is buffered across to the app.
:::

## Limits

Exact origins do not tell tenants or accounts apart on the Google and Microsoft Graph APIs, so this list is not a complete data-egress boundary. Other resource directives, external sign-in windows and native capabilities have their own policies, and provider permissions and organisation controls must still approve the account and the operation. [Threat model](/info/threat-model.html) covers the wider boundary.

Before turning a connection on in a deployment, qualify the real endpoint, its CORS, its upload and download origins, its redirect behaviour and each native platform.
