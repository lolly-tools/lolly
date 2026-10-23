# Sovereign creative production

Sovereign creative production means the making of a file happens on hardware you control, under software you can read, with no third party in the path: the render, the export, the signature and the verification all run on the device holding the file. This page is for a security reviewer or public-sector buyer asking whether Lolly can work that way, and every claim on it can be checked in an afternoon.

Two different things get called sovereignty, and the difference decides which questions you still have to ask.

::: cols
## Contractual sovereignty

- A hosting arrangement with commitments about where data rests, who may access it and under what conditions.
- It answers a real question.
- It is a clause someone else honours on your behalf.

## Architectural sovereignty

- The content never leaves the device.
- Residency, retention and third-party access do not arise for that content.
- There is no copy on anyone's disk to locate, retain or hand over.
:::

This page is about the second kind, and only the parts that are checkable today. It is the operator's reading of the landing page's plainest line, "[yours to make, yours to keep](/info/index.html)".

## Local rendering needs no server

A standalone Lolly deployment can be a static web app. Editing, rendering, downloading and the app's Verify view run on the device once their tools and assets are there. [Server surface](/info/server-surface.html) inventories the optional services.

An organisation can add **Lolly Work** on infrastructure it controls, for single sign-on, policy, shared projects and assets, work collabs, approvals and delivery. That is still self-hosted Lolly, but its shared content and records live on servers, and its optional render jobs run there too. Decide which workflows need local-only processing and which may use organisation infrastructure, because the choice changes retention, access and backup responsibilities.

Standalone Lolly has no usage-reporting backend. Lolly Work offers configurable telemetry and a separate audit log. `tests/no-trackers.test.ts` checks for third-party tracking SDKs; it does not forbid an organisation's own reporting. See [Privacy](/info/privacy.html#organisation-services-with-lolly-work) and Lolly Work's [security overview](/info/work-security-platform.html).

## Choose the network services your workflow needs

The complete list of what the app can fetch or send is the [privacy policy's network table](/info/privacy.html#every-network-request-the-app-can-make). It is a table because each row carries four facts: what it is, what actually leaves the device, the act that triggers the request and what happens when an operator blocks the request. The rows cover catalogue sync, a tool that needs live data, Google Fonts, ICC press profiles, internet radio, a web address you ask a tool to capture, the SEAL signature check, deep-scan detector models and a remote instance you point the app at. Read the table rather than a summary; each row gives its host.

Two properties of that table matter more than any single row:

- **The list is the boundary.** Every fixed host in it is also the app's Content-Security-Policy allowlist, which the browser enforces, so the list is what the app is held to, not a description of what it happens to do today.
- **Every copy is pinned.** Tests pin that policy across every copy the repository ships (`tests/security-headers.test.ts` for the hosted configuration and the container and RPM nginx files, `tests/yunohost-package.test.ts` for the YunoHost package), so one copy cannot quietly lose a directive.

Tools are held to the same rule from the other side. `host.net` is the only way a tool reaches a network. It is gated by an allowlist in the tool's own manifest, and it fails closed: with no capability or no allowlist, every fetch is refused before any I/O. `tests/net-allowlist-conformance.test.ts` proves that against the shared module every shell uses.

Connecting to a Lolly Work instance also turns on its sign-in, policy refresh and chosen shared services, and telemetry events and collaboration updates can travel during use without a click for each request. Keep the instance and any identity, storage or asset providers inside the boundary your deployment needs; offline local rendering does not make those services work without a connection.

## Air-gapped deployment, and how updates arrive

The web build is plain static files, so the air-gapped path is the simple one, not a special edition: serve it from an internal host with the six security headers, as [Choose a deployment](/info/deployment.html#any-static-host-including-air-gapped) sets out. Once loaded, **Settings → Available offline** turns best-effort caching into a guarantee, downloading the app, the tools, the catalogue and the docs ahead of a disconnection.

For a cluster, the repository ships signed container images and a Helm chart ([Run on Kubernetes](/info/build-kubernetes.html)). One brand profile is fixed in the web image when it is built, so the running container reads nothing at serve time: no pack to mount, no runtime configuration, no secret. Pods run as non-root with capabilities dropped and a read-only root filesystem by default, and MCP and CA stay off unless you turn them on.

Updates arrive the way any other controlled artefact does, in two separate streams:

- **The app** is rebuilt and redistributed on your schedule: a new static bundle to the internal host, or a new binary through your device management. Nothing updates itself across the gap.
- **The tools** are data, so shipping one never redeploys the app. Merge the tool directory into the catalogue your instance serves, rebuild the catalog ([Publish and localize a tool](/info/tool-publishing.html)), and clients pick it up on their next sync. Keep that directory in Git if you want review and an audit trail; it is an option, not a requirement.

For organisation services inside a restricted network, deploy Lolly Work with reachable internal identity, storage and asset providers; its [deployment guide](/info/work-deployment.html) covers that topology. Work collabs and shared saves need the service connection even when local tools are ready for offline use.

## Signing happens on the device

Exports carry Content Credentials by default, and the signing key never passes through a service. The default signer is an anonymous key pair made per export inside the page, used once and dropped. An enrolled identity's device key is generated **non-extractable** and kept in IndexedDB, so code can ask it to sign but never read it, and the optional CA issues a short-lived certificate binding that public key to a verified identity. Turn the CA off and exports still sign, anonymously, which is the default anyway.

An organisation that wants to be its own root of trust has three supported routes, set out in [Signing from the terminal](/info/cli-signing.html):

- **Your existing enterprise CA.** Content Credentials are ES256, so ask for the ordinary S/MIME-shaped certificate: EC P-256, `keyUsage: digitalSignature`, `extendedKeyUsage: emailProtection`, and the address in the subjectAltName. That is the C2PA certificate profile, and most enterprise CAs already issue that kind of certificate.
- **Your own instance of the Lolly CA.** `services/ca` is a small Node service you can run yourself. The root private key is a deployment secret you hold, and the chart takes an existing Kubernetes Secret, so the chart never has to manage the key.
- **Self-signed,** for closed loops where you distribute your own root.

Verification is pinned the same way. `--trust-anchor=./corp-root.pem` and `$LOLLY_TRUST_ANCHOR` pin your roots, and `--no-default-anchors` drops the built-in sets so only your pins count. Every verdict prints the anchor set behind the verdict. [Content Credentials engineering](/info/content-credentials-engineering.html) has the detail.

Server renders in Lolly Work use the service's configured signing identity when one is available, not the person's on-device key. Its operator owns that key and certificate chain, and verification must trust the relevant root. See Lolly Work's [Content Credentials guide](/info/work-c2pa.html).

## The tools and the brand are files you hold

A tool is a directory: a manifest, a template, optional styles and optional hooks. A brand pack is a directory of assets with permanent ids and a design-tokens document. Neither is a database row in a service, and both are ordinary version-controlled content, so what ships is what was reviewed. Which tools an instance offers is [configuration](/info/configuration.html), profiles and brand packs, not a code change.

Exports are ordinary files too. PNG, SVG, PDF, WebP, TIFF and the rest open in software with no connection to this project, and keep working if the project stops existing.

## Check it in an afternoon

None of the above asks for trust. [Verify It Yourself](/info/verify-yourself.html) is the full list of procedures, with the exact commands and the output you should see. Four speak directly to this page:

::: timeline
- <!--i:globe--> **Watch the network.** Open the app with DevTools on the Network tab and use a tool: type an address into QR Code, change colours, export a PNG. What you type appears in no request at all.
- <!--i:pause--> **Pull the plug.** Load the app, open a tool or two, then go offline and reload. Rendering and export keep working. An app that needs a server to do the work fails this check on the first render.
- <!--i:server--> **Enumerate the server surface.** Compare the services you run with [Server surface](/info/server-surface.html) and, where deployed, Lolly Work's API and configuration, including its database, asset providers and render worker.
- <!--i:clock--> **Work a day offline.** For an air-gapped site, turn on **Settings → Available offline**, disconnect the machine entirely and do a full day's work.
:::

## What a security review usually asks

| The question | Where the answer lives |
|---|---|
| What runs server-side? | [Server surface](/info/server-surface.html): optional integrations and the separately deployed Lolly Work service |
| What leaves the device, and when? | The [privacy policy's network table](/info/privacy.html#every-network-request-the-app-can-make) |
| What is the trust boundary, and what is out of scope? | [Threat model](/info/threat-model.html) |
| Which cryptography, and how is it tested? | [Security & Verification](/info/security.html) |
| How do we host it ourselves, or without a network? | [Choose a deployment](/info/deployment.html) |
| Who signs, and can we be our own root? | [Signing from the terminal](/info/cli-signing.html) |
| What is the project's actual maturity? | [Adoption & Governance](/info/adoption-governance.html#status) |

## Origin

Lolly is built inside SUSE, a European infrastructure company with more than three decades of security technology and services for large enterprises, and the engine, the shells, the schemas and the docs are released open source under MPL-2.0.

## Limits

- **The security has not been externally audited.** No independent party has certified the cryptography or the file parsers; [Adoption & Governance](/info/adoption-governance.html#status) gives the status. Where a contract calls for certified assurance, deploy Lolly as one layer of defence in depth.
- **The supply chain today is conventional.** The build installs npm packages, and you can run it in your own CI. Release images are signed with cosign and carry SBOM and SLSA provenance attestations you can check by digest ([published images guide](https://github.com/lolly-tools/lolly/blob/main/deploy/docker/README.md#published-images)), and the repository commits a CycloneDX SBOM (`sbom.cdx.json`). Building through the Open Build Service, with artifacts delivered by the SUSE Application Collection, is an aim stated on the [FAQ](/info/faq.html), not a property of what ships now ([Linux packages](/info/build-obs.html) has the current recipes).
- **The hosted MCP endpoint is server-side, and optional.** Full-format rendering for AI agents drives a headless browser, so that endpoint runs as a hosted service, not an offline component. It stores nothing persistent, and removing it leaves the app unaffected. An operator can require OAuth 2.1 or an operator-held token; the public endpoint on lolly.tools is open with no token, and its calls are limited per address and per day. The public render route in the same service is live on lolly.tools, and an operator's own instance can switch it off (`LOLLY_DISABLE_RENDER_GET=1`, which returns 404). The on-device apps stay the air-gapped path.
- **Hooks are trusted code.** A tool's optional `hooks.js` runs with the host bridge injected but, in a browser, in the page's own realm: closure-scope injection rather than isolation, as `engine/src/runtime.ts` says at the site. A manifest can opt into a Worker with `isolate: true`. Run tools you have reviewed, and put a shared catalogue through review. [Threat model](/info/threat-model.html) owns the detail.
- **Content Credentials are tamper-evident.** They detect alteration cryptographically and offline. They do not prevent it, and that is exactly what makes fully offline verification possible.
- **An operator owns its server records.** Hosting access logs can include IP, path and timestamp. A Lolly Work deployment also holds the content and records of its enabled shared services, including audit history. Set retention and backup policies for those copies; the device's **Clear all my data** control does not erase them.

## Related

- [Constraints](/info/constraints.html): the brand rules live in the tool rather than in each file.
- [Determinism](/info/determinism.html): the same render on your own hardware as in anyone else's browser.
- [Reproducibility](/info/reproducibility.html): the inputs travel as text you keep.
- [Server surface](/info/server-surface.html), [Choose a deployment](/info/deployment.html) and [Verify It Yourself](/info/verify-yourself.html): the inventory, the deployment guide and the procedures that check each claim.
