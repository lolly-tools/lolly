# Sovereign creative production

Sovereign creative production means the making of a file happens on hardware you control, under software you can read, with no third party in the path: the render, the export, the signature and the verification all execute on the device holding the file.

Two different things currently get called sovereignty, and the distinction decides which questions you still have to ask. One is contractual: a hosting arrangement with commitments about where data rests, who may access it and under what conditions. That answers a real question, and it is a clause someone else honours on your behalf. The other is architectural: the content never leaves the device, so residency, retention and third-party access do not arise for it, because there is no copy on anyone's disk to locate, retain or hand over. This page is about the second kind, and only in the parts that are checkable today. It is the operator's reading of the landing page's plainest line, "[yours to make, yours to keep](/info/index.html)".

## The render path has no server

A Lolly deployment is a **static web application** plus **two optional server components**. Opening a tool, editing, previewing, exporting and verifying a file all complete with no request to either, and a deployment that omits both is a fully working Lolly. The complete inventory - every route, what it does, what it holds and what happens when you turn it off - is [Server Surface](/info/server-surface.html), which carries a standing rule: an endpoint not on that page is not part of Lolly.

Three absences on that page are the ones an operator asks about first. There is **no render server**: the app never uploads your inputs or assets to produce an export. There is **no verification server**: dropping a file on Verify parses and checks it locally. And there is **no telemetry backend** - no endpoint receives usage data, which `tests/no-trackers.test.ts` enforces by failing the build if any analytics or tracking SDK appears anywhere in the shipped source it scans.

## Every network crossing is a user act

The complete list of what the app can fetch or send lives in the [privacy policy's network table](/info/privacy.html#when-the-app-talks-to-a-network-in-full). It is a table because each row carries four facts: what it is, what actually leaves the device, the act that triggers it and what happens when an operator blocks it. The rows cover catalogue sync, a tool that needs live data, Google Fonts, ICC press profiles, internet radio, a URL you ask a tool to capture, the SEAL signature check, deep-scan detector models and a remote instance you point the shell at. Read the table rather than a summary of it - the specifics are the point, and each row names its host.

Two properties of that table matter more than any single row. Every fixed host in it is also the app's Content-Security-Policy allowlist, which the browser enforces, so the list is the boundary the app is held to rather than a description of current behaviour. And `tests/security-headers.test.ts` pins that policy across both places it is expressed in the repo - `vercel.json` and `deploy/docker/nginx.conf` - so one copy cannot silently lose a directive. There were three until 2026-08; the third, `shells/web/vercel.json`, was a config nothing deployed from, which is how it managed to ship a stale CSP for months, and the test now pins it deleted rather than trusting the next reader to know it was dead.

Tools are held to the same shape from the other side. `host.net` is the only way a tool reaches a network, it is gated by an allowlist the tool's own manifest declares, and it is fail-closed: no capability or no allowlist means every fetch rejects before any I/O. `tests/net-allowlist-conformance.test.ts` proves that against the shared module every shell uses.

## Air-gapped deployment, and how updates arrive

The web build is plain static files, so the air-gapped path is the simple one rather than a special edition. Serve `shells/web/dist/` from any static host, CDN or internal file server with a catch-all rewrite to `index.html`, and add the four security headers [Deployment](/info/deployment.html) lists. Once loaded, the PWA keeps working offline, and **Profile → Available offline** turns best-effort caching into a guarantee: the app, the tools, the catalogue and the docs are downloaded ahead of a disconnection, with a progress bar and per-part sizes.

For a cluster, the repository ships three Dockerfiles and a Helm chart. One brand profile is baked into the web image at build time (`--build-arg LOLLY_PROFILE=…`), so the running container reads nothing at serve time - no pack to mount, no runtime configuration, no secret. Pods run non-root with capabilities dropped and a read-only root filesystem by default, and the MCP and CA components are off unless you enable them.

Updates in that model arrive the way any other controlled artefact does, and they split in two:

- **The app** is rebuilt and redistributed on your cadence - a new static bundle to the internal host, or a new binary through your MDM. Nothing self-updates across the gap.
- **The tools** are data, so shipping one never redeploys the app. Merge the tool directory into the catalogue your instance serves, run `pnpm run build:catalog` and `pnpm run validate:catalog`, and clients pick it up on their next sync. Manage that directory as a Git repository if you want review and an audit trail, which is an option rather than a requirement.

## Signing happens on the device

Exports carry Content Credentials by default, and the signing key never transits a service. The default signer is an anonymous keypair minted per export inside the page, used once and dropped. An enrolled identity's device key is generated **non-extractable** and kept in IndexedDB, so the code can ask it to sign but never read it, and the optional CA issues a short-lived certificate binding that public key to a verified identity. Turn the CA off and exports still sign, anonymously, which is the default anyway.

An organisation that wants to be its own root of trust has three supported routes, set out in [Signing from the terminal](/info/cli-signing.html):

- **Your existing enterprise CA.** Content Credentials are ES256, so ask for the ordinary S/MIME-shaped certificate: EC P-256, `keyUsage: digitalSignature`, `extendedKeyUsage: emailProtection`, address in the subjectAltName. That is the C2PA certificate profile, and it is a shape most enterprise CAs already issue.
- **Your own instance of the Lolly CA.** `services/ca` is a small Node service you can run yourself; the root private key is a deployment secret you hold, and the chart takes an existing Kubernetes Secret so it never has to be chart-managed.
- **Self-signed**, for closed loops where you distribute your own root.

Verification is pinned the same way. `--trust-anchor=./corp-root.pem` and `$LOLLY_TRUST_ANCHOR` pin your roots, `--no-default-anchors` drops the built-in sets so only your pins count, and every verdict prints the anchor set that produced it. The engineering detail is in [Content Credentials - Engineering](/info/content-credentials-engineering.html).

## The tools and the brand are files you hold

A tool is a directory: a manifest, a template, optional styles, optional hooks. A brand pack is a directory of assets with permanent ids and a design-tokens document. Neither is a database row in a service, and both are ordinary version-controlled content, so what ships is what was reviewed. Which tools a given instance exposes is configuration - profiles and brand packs - rather than a code change.

Exports are ordinary files too. PNG, SVG, PDF, WebP, TIFF and the rest open in software with no connection to this project and keep working if the project stops existing.

## Check it in an afternoon

None of the above asks for trust. [Verify It Yourself](/info/verify-yourself.html) is the full procedure list, with the exact commands and the output you should see; three of them speak directly to this page.

1. **Watch the network.** Open the app with DevTools on the Network tab and use a tool - type a URL into QR Code, change colours, export a PNG. What you type appears in no request at all.
2. **Pull the plug.** Load the app, open a tool or two, then go offline and reload. Rendering and export keep working. An app that needs a server to do the work fails this check on the first render.
3. **Enumerate the server surface.** `curl` the routes on [Server Surface](/info/server-surface.html). There is nothing else to find, and the source you can clone builds the deployment you just probed.

A fourth one is worth running if you are evaluating for an air-gapped site: turn on **Profile → Available offline**, disconnect the machine entirely and do a full day's work on it.

## What a security review usually asks

| The question | Where the answer lives |
|---|---|
| What runs server-side? | [Server Surface](/info/server-surface.html) - two optional components, both removable |
| What leaves the device, and when? | the [privacy policy's network table](/info/privacy.html#when-the-app-talks-to-a-network-in-full) |
| What is the trust boundary, and what is out of scope? | [Threat Model](/info/threat-model.html) |
| Which cryptography, and how is it tested? | [Security & Verification](/info/security.html) |
| How do we host it ourselves, or without a network? | [Deployment](/info/deployment.html) |
| Who signs, and can we be our own root? | [Signing from the terminal](/info/cli-signing.html) |
| What is the project's actual maturity? | [Adoption & Governance](/info/adoption-governance.html) |

## Origin

Lolly is built inside SUSE, a European infrastructure company with more than three decades of security technology and services for large enterprises, and the engine, the shells, the schemas and the docs are released open source under MPL-2.0.

## Limits

- **The security has not been externally audited.** The cryptography and file parsers are undergoing SUSE's infrastructure hardening and are not certified by an independent party; [Adoption & Governance](/info/adoption-governance.html) states that status, along with the fact that this is a closed-pilot prototype. Where a contract calls for certified assurance, deploy Lolly as one layer of defence in depth.
- **The supply chain today is ordinary.** The build is npm and your own CI. Building through the Open Build Service, with artifacts delivered by the SUSE Application Collection, is stated as an aim on the [FAQ](/info/index.html) and is not a property of what ships now.
- **The hosted MCP endpoint is server-side, and optional.** Full-format rendering for AI agents drives a headless browser, so that endpoint runs as a hosted service and is not an offline component. It stores nothing persistent, requires OAuth 2.1 or an operator-held token, and removing it leaves the app unaffected. The public hot-link render route that ships inside the same function is disabled on lolly.tools (`LOLLY_DISABLE_RENDER_GET=1`, returning 404); an operator's own instance can leave it on. The on-device shells stay the air-gapped path.
- **Hooks are trusted code.** A tool's optional `hooks.js` runs with the host bridge injected but, in a browser shell, in the page's own realm - closure-scope injection rather than isolation, as `engine/src/runtime.ts` says at the site. A manifest can opt into a Worker with `isolate: true`. Run tools you have reviewed, and gate a shared catalogue through review.
- **Content Credentials are tamper-evident.** They detect alteration cryptographically and offline. They do not prevent it, and that is exactly what makes fully offline verification possible.
- **An operator owns its own logs.** Any server that answers a request can log the request - IP, path, timestamp. If you run the static host or either optional service, you are the operator of record for that logging. It is also the reason the architecture keeps content off the wire at all: what never leaves a device cannot be logged by anyone.

## Related

- [Constraints](/info/constraints.html) - the brand rules living in the tool rather than in a review queue.
- [Determinism](/info/determinism.html) - the same render on your own hardware as in anyone else's browser.
- [Reproducibility](/info/reproducibility.html) - the inputs travelling as text you keep.
- [Server Surface](/info/server-surface.html), [Deployment](/info/deployment.html) and [Verify It Yourself](/info/verify-yourself.html) - the inventory, the runbook and the procedures to check all of it.
