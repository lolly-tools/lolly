# Threat Model & Trust Boundaries

This page is for security reviewers. It lists each place where Lolly accepts something it did not make: a tool from a catalogue, a link, a file, a message from another program or a request to a server. For each one it gives the code that checks it, the test that proves the check and the risk we accept.

**The short version.** Lolly renders on your device, and the engine makes no network calls. Built-in tools are signed, and a release build refuses any tool file whose bytes do not match the signature. Tools installed from a file or loaded from another site run in a separate Worker with a short list of host functions, and are stopped when they run too long. Optional services, such as the MCP server, the certificate service and Lolly Work, receive only what you send them. Report a problem privately, as described under [Reporting](#reporting).

::: note Not a security reviewer?
[Privacy Policy](/info/privacy.html) answers "what happens to my files?" in plain words, and [How Lolly Reads Files](/info/reading-files.html) explains what happens when you open a file someone sent you.
:::

Each boundary cites a function, constant or file rather than a line number, so you can search the code for the name. Where this page and the code disagree, the code is right; please [report the difference](#reporting). The cryptography and its test coverage are on [Security & Verification](/info/security.html), every off-device component is on [Server Surface](/info/server-surface.html) and every file parser is on [Parser Inventory](/info/parser-inventory.html).

## What Lolly is, security-wise

**Rendering happens on the device.** Opening a tool, editing inputs, previewing, exporting and verifying a file all complete locally, and none of them uploads what you made. The shells do download files a feature needs on first use, such as an on-demand emoji set, a font you chose or an on-device model, and those requests carry none of your content.

**Tool code can reach the network in two ways.** A hook can call the allowlisted `host.net` fetch (card 8). A template script or a verified hook can also call `fetch` directly, as Meeting Planner's template does for its city lookup, and the Content Security Policy is the only control on those direct calls (card 15). The URL screenshot tool also loads the address you type.

**Tools are data, not bundled code.** A tool is a `tool.json` manifest, a Handlebars `template.html`, optional `styles.css` and an optional `hooks.js`, synced to the client from a catalogue. New tools ship without an app update. That is the product's central design choice and its central security consequence: catalogue provenance and a tool's trust class are security boundaries.

**Optional services add data flows.** [Server Surface](/info/server-surface.html) lists what each one receives and keeps, and [Privacy Policy](/info/privacy.html) says what that means for you. The MCP service keeps no render history, and the certificate service keeps no issuance log.

**A Lolly Work instance keeps data on purpose.** Shared saves, collaboration and server jobs send content to the instance, so local rendering does not make an organisation workflow local-only. The instance holds accounts, shared content, job outputs, audit records and configured usage telemetry. Its database, storage, identity provider and backups are further trust boundaries, covered by the Work guides linked in card 24.

::: figure threat-model-boundaries
What crosses into a Lolly device and what an optional server sees. Each number matches a card below.
:::

## Trust boundaries

Each card has four lines: what crosses the boundary, what checks it, the test that proves the check and the risk we accept. Accepted risks that need more than a line are in the [register](#residual-risk-register).

### On your device

::: details 1. Tool hooks and the page realm
- **What crosses:** a tool's `hooks.js`. `engine/src/loader.ts` fetches the hook text and gives it one of four trust classes: `builtin-verified`, `development-unsigned`, `sideloaded-consented` or `remote-untrusted`.
- **What checks it:** the web shell's `mount-runtime.ts` sends sideloaded and remote-untrusted hooks to a fresh strict Worker, whatever the manifest asks for. `hook-worker.ts` gives that Worker an allowlisted host RPC facade, strips private methods, disables network, storage, credential and native globals, and ends the Worker when a hook overruns its budget. Refusal fails closed: it never falls back to `new Function` in the page. Verified built-ins and visibly unsigned development tools keep the page-realm path, because shipping tools use DOM export hooks. Thirty built-in tools also opt into a Worker for interactive use with `isolate: true`; for those, the page realm is the fallback when a Worker cannot start, and one-shot renders such as previews and exports stay in the page realm.
- **Proof:** `shells/web/src/bridge/hook-worker.test.ts`, `shells/web/src/lib/mount-runtime.test.ts`, `tests/runtime-hooks.test.ts`.
- **What we accept:** a compromised release signing key can turn a malicious hook into `builtin-verified`, and verified hooks can reach page globals (see the register). Strict Workers refuse DOM-dependent export hooks. A browser Worker contains code without being OS process isolation, so the RPC allowlist and the CSP stay in place as defence in depth.
:::

::: details 2. Hook running time
- **What crosses:** any lifecycle hook call, through the engine runtime or the strict Worker executor.
- **What checks it:** page-realm hooks race against `HOOK_BUDGET_MS`. Strict Workers get the same deadline per hook, and the shell ends the Worker on a synchronous or asynchronous overrun.
- **Proof:** `tests/runtime-hooks.test.ts`, `shells/web/src/bridge/hook-worker.test.ts`.
- **What we accept:** a synchronous runaway verified hook cannot be stopped in the page realm (see the register). Sideloaded and remote-untrusted hooks can be stopped, because their Worker is disposable. `onFrame` and `onLevel` drop overlapping calls instead of queueing them.
:::

::: details 3. Tool and engine versions
- **What crosses:** a manifest's `engineVersion` range, synced ahead of the app.
- **What checks it:** `satisfiesRange(ENGINE_VERSION, manifest.engineVersion)` in `engine/src/loader.ts` refuses the tool before its template or hooks are fetched.
- **Proof:** `tests/semver-range.test.ts`.
- **What we accept:** a bug in the range comparator fails the wrong way in either direction. The comparator has no dependencies, so the code under test is the code that ships.
:::

::: details 4. The catalogue origin and the loader
- **What crosses:** tool files fetched from the deployment's `/tools/` and `/catalog/` paths.
- **What checks it:** `build:web:release` requires a private signing JWK and the matching public JWK, signs the catalogue, verifies the result and passes the public key into the build. `assertEnvelopeTrusted` and `assertFileIntegrity` in `engine/src/loader.ts` (with `engine/src/catalog-integrity.ts`) then authenticate every fetched file before the runtime compiles it, and a signed file that is missing is fatal. Both Tauri release builds run the same wrapper (`build:desktop:frontend:release` and `build:mobile:frontend:release`, from each shell's `beforeBuildCommand`).
- **Proof:** `tests/catalog-integrity.test.ts`, `tests/catalog-release.test.ts`.
- **What we accept:** plain development builds support an unsigned catalogue and show a label on screen, because no deployment key belongs in the repository (`scripts/build-release-web.ts`, `shells/web/src/catalog/integrity.ts`).
:::

::: details 5. A tool carried in a .lolly file
- **What crosses:** a shared `.lolly` file whose manifest carries a whole tool under `tool/`.
- **What checks it:** `provisionLollyTool` asks the recipient before installing a new carried tool and refuses module hooks. Installed tools load as `sideloaded-consented`, which forces strict Worker execution, and the carried `trust` marker cannot promote itself.
- **Proof:** `shells/web/src/lib/lolly-pack.test.ts`, `shells/web/src/lib/installed-tools.test.ts`, `shells/web/src/lib/mount-runtime.test.ts`.
- **What we accept:** consent is a social boundary. The package's SRI map proves the bytes arrived intact, and says nothing about who published them. A carried tool that needs DOM-dependent export hooks is refused rather than moved into the page realm. Only the web shell reads `.lolly` today.
:::

::: details 6. Link parameters
- **What crosses:** a shared link, a QR code, an embed or CLI `--foo=bar` arguments, parsed by `parseUrlState` in `engine/src/url-mode.ts`.
- **What checks it:** the `RESERVED` set separates engine parameters from tool inputs, the parse loop skips reserved keys and every value is coerced against the declared input model.
- **Proof:** `tests/engine.test.ts` asserts `RESERVED` against an inline copy of the documented list.
- **What we accept:** query parameters are fully attacker-controlled, and any input can be set from a URL, so a link can put a tool into any state the sidebar could. That is the feature. Treat a pasted Lolly link as untrusted content.
:::

::: details 7. Packed and private links
- **What crosses:** `z` (`PACK_PARAM`) and `zx` (`ENC_PARAM`) tokens on an untrusted link, both in `engine/src/url-pack.ts`.
- **What checks it:** `MAX_TOKEN` (64 KiB) rejects an oversized token before decoding, and `MAX_UNPACKED` (256 KiB) stops inflation. Both caps apply to the encrypted path too. `zx` is AES-256-GCM under PBKDF2-SHA256 at `PBKDF2_ITERATIONS` (210 000), stored per token so the count can rise.
- **Proof:** `tests/url-pack.test.ts`.
- **What we accept:** DEFLATE expands roughly 1000 times, so the two fixed caps are the whole defence against a decompression bomb. A `zx` link is as strong as the password the person chose.
:::

::: details 8. The host.net fetch
- **What crosses:** requests from a tool that declares `capabilities: ["network"]` and a `network.allowlist` block (`schemas/tool.schema.json`).
- **What checks it:** `createNetAPI` in `packages/node-shell/src/net.ts`, re-exported by `shells/web/src/bridge/net.ts`, rejects a non-matching URL before any I/O and caps the response at `MAX_RESPONSE_BYTES` (64 MiB) with a counting stream rather than a trusted `Content-Length`. A wildcard must follow a path separator (`matchesNetworkUrl` and the schema's pattern), so a prefix cannot match a lookalike host. The web shell's boot host has an empty allowlist, and each mount gets a clone with its own scoped list (`shells/web/src/bridge/index.ts`).
- **Proof:** `tests/net-allowlist.test.ts`.
- **What we accept:** enforcement lives in each shell, not in the engine. Every shell builds `host.net` from the one shared module, so they agree today, but a new shell could wire an unscoped `fetch` onto `host.net` and the tool would still work with no allowlist at all. Review every new shell against this card. Template scripts and verified hooks can also call `fetch` directly, outside `host.net`; Meeting Planner's geocoding lookup does. Only the CSP limits those requests (card 15).
:::

::: details 9. Untrusted files and the parsers
- **What crosses:** any file a person supplies: a drop on Verify, an `asset` or `file` input, a PDF or PowerPoint to import.
- **What checks it:** each parser's own limits, checked before it reads. `check:parser-assurance` cross-checks every row of [Parser Inventory](/info/parser-inventory.html) against the real `ALL_TARGETS` list, and any unfuzzed parser needs an owner, a reason and an unexpired waiver in `security/parser-assurance.json`.
- **Proof:** `tests/fuzz-regression.test.ts` replays saved crash inputs and seeded mutations, the weekly `fuzz-soak.yml` workflow runs every target and keeps any failing input, and `tests/parser-assurance.test.ts` proves that mapping drift and expired waivers fail.
- **What we accept:** fuzzing proves neither correct meaning nor complete state coverage. [How Lolly Reads Files](/info/reading-files.html) gives the three contracts a parser can promise, and Parser Inventory lists the current counts and the parsers not yet registered.
:::

::: details 10. Template rendering
- **What crosses:** a tool's `template.html`, filled with input values by `hydrate` in `engine/src/template.ts`.
- **What checks it:** Handlebars without logic. `{{x}}` escapes HTML, and `{{{x}}}` is the opt-in raw form. A template cannot run arbitrary JavaScript through Handlebars, and helpers treat every argument as `unknown` and narrow it at once.
- **Proof:** `tests/engine.test.ts` shows a `<script>` value coming out as `&lt;script&gt;` and the `media` helper escaping every attribute.
- **What we accept:** `{{{x}}}` and the `markdown` helper emit raw HTML on purpose. An author who sends a user input through triple braces has opted out of escaping, and only tool review catches that.
:::

::: details 11. Cryptography and signing
- **What crosses:** passwords and files on the lock and sign paths; certificates and signatures on the verify paths.
- **What checks it:** the primitives come from WebCrypto (`globalThis.crypto.subtle`) in `engine/src/pdf-crypto-r6.ts`, `zip-crypto.ts`, `x509.ts`, `seal.ts` and `c2pa.ts`. The container code is written in the engine with no npm dependency: CBOR, JUMBF, COSE_Sign1, minimal X.509, the WinZip AES counter, the ZipCrypto keystream and the DER walker. These modules never generate their own randomness: `pdf-crypto-r6` takes its keys, salts and IVs as parameters, and `zip-crypto` takes an injected `opts.rng`, so both round-trip fixed test vectors.
- **Proof:** `tests/pdf-crypto-r6.test.ts` and `tests/zip-crypto.test.ts` (both decrypt independently with `node:crypto`), `tests/c2pa*.test.ts` including the c2patool conformance suite, `tests/x509.test.ts` and `tests/ca-service.test.ts`. [Security & Verification](/info/security.html) has the full matrix.
- **What we accept:** no shipping engine module imports `node:crypto`, so a shell that injects a weak `rng` or a bad key weakens the result with no engine-side check. The default signing certificate is ephemeral and self-signed, so validators report the signer as unknown; the container and its byte binding must be correct, and the chain is not expected to verify.
:::

::: details 12. The service worker and offline cache
- **What crosses:** every same-origin request once `shells/web/public/sw.js` is installed.
- **What checks it:** a strategy per request, described in the `sw.js` header. Navigations are network-first with a cached app-shell fallback. Content-hashed build assets are cache-first, so a cached copy is never stale. `/tools/` files are network-first with a timeout. `/catalog/previews/` is stale-while-revalidate. Catalogue index files bypass the worker. `/info` goes into its own per-URL bucket (`networkFirstInfo`), and `isShellNavigation` lets only a navigation the app owns replace the cached shell. The generation cache is `CACHE`, a hand-bumped `lolly-vN` name. The buckets in `PERSISTENT_CACHES` outlive a generation bump: pinned offline tools, tools installed from a `.lolly` file, the pre-downloaded build, the ONNX runtimes, the docs, the speech models, the share-target inbox for files an operating system share sheet sent and partial model downloads.
- **Proof:** `shells/web/src/sw.test.ts` runs the real `sw.js` in a `node:vm` sandbox: the shell survives an `/info` visit, a filename path is never stored as the shell and `activate` drops the previous generation.
- **What we accept:** a service worker is a long-lived same-origin cache, and these buckets keep roughly 117 MB of ONNX runtime and a 92 MB speech model across updates. Their integrity rests on the origin's TLS and on hashed filenames never changing. Installed tools are served cache-first, so they rest on the consent and strict Worker rules of card 5. `CACHE` must be bumped by hand whenever `sw.js` changes.
:::

::: details 13. Translation strings
- **What crosses:** translation JSON under `shells/web/src/locales/`, returned by `t()`.
- **What checks it:** parameters are escaped by default. `check:locale-markup` parses every catalogue and permits only the reviewed tag and attribute shapes already in use, and each translation must keep its source string's tag sequence. Scripts, event handlers, unsafe URLs and new markup fail CI.
- **Proof:** `shells/web/src/i18n.test.ts`, `tests/locale-markup.test.ts`.
- **What we accept:** approved tags still go into `innerHTML`, so the allowlist, its three exceptional spans and its four links are review surfaces. The validator checks syntax and cannot judge misleading prose.
:::

::: details 14. The browser extension relay
- **What crosses:** a `lolly-capture/page` message from any script on a Lolly origin to the extension, whose background holds the `debugger` and `tabs` permissions. Site access is optional and granted one site at a time.
- **What checks it:** content scripts run only on Lolly origins, and the relay checks `event.source === window` and an origin allowlist. Replies go only to the validated origin, never `*`. Every request opens an **Approve once** window in the extension first.
- **Proof:** `tests/chrome-extension-relay.test.ts` runs the shipping content script and shows foreign origins and windows are ignored.
- **What we accept:** an XSS on a Lolly origin can still send the message. A nonce readable by that same code would not help, so the control is the extension's own approval window: nothing happens until the person approves.
:::

::: details 15. Script in the page and the network
- **What crosses:** any script running in a Lolly origin, whether a tool hook, a template script or an injected XSS, calling `fetch`, opening a WebSocket or adding an `<iframe>`.
- **What checks it:** the `Content-Security-Policy` header on every response. `connect-src` lists a fixed set: the app's own origin, `blob:` and `data:`, the Google Fonts hosts, the opt-in send and sync providers, the internet radio, the ICC profile registry, the open-meteo geocoding host, the model download host and the managed workspace and agent relay host. [Privacy Policy](/info/privacy.html#every-network-request-the-app-can-make) gives each host. `frame-src`, `child-src` and `worker-src` carry no scheme-wide `https:`, `object-src` and `base-uri` are `'none'`, and the same policy is defined in the repository's static-hosting configuration and in `deploy/docker/nginx.conf`.
- **Proof:** `tests/security-headers.test.ts` pins the copies together, checks that `connect-src` is neither absent nor `*`, refuses a scheme-wide `https:` on any framing directive and pins the `/any-site` policy as the base policy with only `frame-src` changed, in every configuration that serves that path.
- **What we accept:** the policy contains a running script without stopping it from running. `script-src` keeps `'unsafe-eval'`, because tool hooks use `new Function`, so the CSP backs up the hook boundary of card 1 rather than replacing that boundary. A reverse proxy that strips these headers removes the containment. **Allow pages from any site**, set per device under **Settings → Trusted sites**, reloads the web app at `/any-site/`, whose policy also admits any `https:` page and the loopback in `frame-src`. On that device, a running script could send data out in a frame's address. A link cannot opt anyone in: the first inline script in `index.html` sends a visit to `/any-site/` back to `/` unless this device made the choice, and the service worker never stores that document as the offline shell.
:::

::: details 16. The desktop webview and native features
- **What crosses:** shell code or an injected script calling Tauri commands and plugins.
- **What checks it:** both shell configurations ship a production and development CSP. Capability files limit file access to app-owned paths (`saved-state`, `pack-store` and the Lolly download and document folders). There is no generic shell or raw HTTP plugin permission. OAuth opens only through a Rust command for configured HTTPS provider hosts. Remote instances and providers use `remote_fetch`, which accepts HTTPS only, pins public DNS answers in a client with no proxy, rechecks every redirect, strips credentials across origins, refuses transport headers and caps request and response sizes.
- **Proof:** `tests/tauri-security.test.ts`, the Rust URL, address and header tests in both `remote_fetch.rs` copies, the Rust `oauth_url_validation` test and `cargo check` for both shells.
- **What we accept:** reviewed shell code in the main realm stays privileged. `remote_fetch` must accept any public HTTPS origin, because people choose their own providers and deployments; it blocks local-network and metadata addresses and does not vouch for public hosts.
:::

::: details 17. A local AI agent and the open Design document
- **What crosses:** calls from an agent's local MCP server (stdio only) to the `lolly_live_*` tools, which reach the editor through the desktop app's loopback listener (`shells/tauri-desktop/src-tauri/src/live_server.rs`) or a browser tab paired with the bridge (`services/mcp/src/live-bridge.ts`).
- **What checks it:** one session in the page (`shells/web/src/lib/live-agent.ts`) offers a fixed set of methods: `hello`, reading the document (`document.get`, `document.find` and `document.context`), applying layer operations and patches, looking, and undoing the agent's own newest step. It offers no files, export to a path, navigation, settings, network or tool hooks. Each apply is checked against the Design manifest for every row it touches and becomes one labelled history step or nothing, with at most 500 edits an apply and 30 applies in three seconds. On the desktop, nothing listens until the person turns on **Allow AI control**; the listener binds to loopback, checks the peer and needs a per-launch token in `live.json` (mode 0600), removed when the setting goes off or the app quits. In a browser, the bridge binds to 127.0.0.1, checks the page's `Origin` (lolly.tools, `LOLLY_LIVE_ORIGINS` or localhost) before reading a frame, takes a single-use code the person types, ends the pairing after three wrong codes and serves one tab at a time, with no compression and frames of at most 16 MB. The hosted `/api/mcp` endpoint refuses these tools.
- **Proof:** `shells/web/src/lib/live-agent.test.ts`, `live-agent-connect.test.ts`, `live-agent-desktop.test.ts`, `shells/web/src/views/design-live.test.ts`, `services/mcp/test/live-bridge.test.ts` (real WebSocket: wrong origin 403, second tab 409, three wrong codes, hosted calls refused) and the Rust `live_server` tests.
- **What we accept:** a connected agent can change the open document as much as the person could, and text in the document can mislead the agent. The controls are the visible pill with Disconnect, Undo and the advice to connect only an agent you trust. Another process running as the same user can read `live.json`. The served CSPs do not allow `ws://127.0.0.1` yet, so the browser path works only in development builds or a build made with `VITE_LIVE_AGENT=1` whose policy allows the loopback; widening the served policy is an open decision.
:::

::: details 18. A tool hook and your signing identity
- **What crosses:** a hook calling `host.c2pa?.sign(bytes, format, opts)`, the optional bridge API in `packages/core/src/host-v1/c2pa.ts`. Four shipping tools call it: `community/redact`, `community/claim`, `community/sign` and `community/rondocode`.
- **What checks it:** no `capabilities` permission gates this API. A tool that calls it unguarded lists `c2pa` in its generated `requires` (`community/claim` does), so a host without the API refuses to mount it, and the other three check for the method first. The web shell routes the call to `signFreshC2pa` in `shells/web/src/bridge/export.ts`, which asks `host.identity.signer()` first: an enrolled person's certificate chain goes into the manifest, and the engine's ephemeral key is the fallback. Signing happens on the device.
- **Proof:** `tests/redact.test.ts` pins the call and checks that the tool ships what `sign` returned, including the path with no identity.
- **What we accept:** a hook can put the person's verified identity on bytes it chose, and the ordinary export path's `c2pa` setting does not apply, because the caller is the file's author. Tool review is the control, as for `{{{x}}}`. The certificate's lifetime bounds the damage, and the hook can sign only in a session where the person has already enrolled.
:::

### On a server

::: details 19. Page capture on a hosted server
- **What crosses:** a hook calling `host.capture?.page({ url })` while the tool runs on a server, the MCP host in `services/mcp/src/host.ts`, rather than on the person's own machine.
- **What checks it:** `captureUrl` in `packages/node-shell/src/url-capture.ts` takes a `publicOnly` option, which the MCP host sets through `createCliBridge({ capturePublicOnly: true })`. `assertPublicHttpUrl` then refuses other schemes, embedded credentials and literal loopback, link-local, private, CGNAT, multicast and unspecified addresses in IPv4, IPv6 and IPv4-mapped forms before the browser navigates. The CLI and TUI on a person's own machine leave the option off, because capturing your own `localhost` is the point there.
- **Proof:** `tests/url-capture-guard.test.ts`.
- **What we accept:** the check reads the literal hostname. A public name that resolves to a private address, or a redirect into one, is not caught here; on a hosted worker that is the egress firewall's job, and a deployment without one should not wire `host.capture`. The standard MCP image ships no browser, so this path does nothing unless an operator adds the optional browser image (`deploy/docker/mcp-browser.Dockerfile`).
:::

::: details 20. The image proxy
- **What crosses:** a browser calling `GET /api/fetch-image` with a `url` it chose (`services/mcp/src/image-proxy.ts`). The web app needs this pass-through because its own `img-src 'self'` policy forbids fetching a remote image directly. The desktop apps fetch directly.
- **What checks it:** `proxyImage` refuses other schemes and embedded credentials, resolves the host and requires every answer to be a public address (`isPublicAddress` in `services/mcp/src/egress.ts`), and checks each redirect hop again. It returns `image/*` only, caps the body at 25 MiB with a counting stream, forwards no request credentials and applies per-address and global rate limits through the gateway's durable limiter (503 when none is configured). `LOLLY_DISABLE_IMAGE_PROXY=1` turns it off.
- **Proof:** `services/mcp/test/image-proxy.test.ts`.
- **What we accept:** the same DNS-rebinding window as card 19, because `fetch` resolves the name again after the check; on a hosted worker that is the egress firewall's job. The bytes come back under `Content-Security-Policy: sandbox` and `nosniff`, and the client sanitises an SVG before storing the file.
:::

::: details 21. An invited AI agent and one open document
- **What crosses:** an agent the person invites from **Share > Invite an agent**, calling `POST /api/mcp/agents` on the MCP gateway or the relay's `/live/rpc` and `/live/mcp` routes, while the person's editor tab joins over the `/live/editor` WebSocket (`services/mcp/src/agent-connector.ts`, `live-relay.ts`, `live-relay-broker.ts`).
- **What checks it:** the relay creates an invitation only for a request from an allowed editor origin, at most ten a minute per address, for one document with read or edit permission. Each invitation is a random 256-bit bearer token plus a separate editor token, held in the relay's memory; an unused one ends after ten minutes and a joined one after thirty minutes without activity. The relay refuses changes on a read invitation, and every call still passes through the page's live session with the methods, manifest checks and limits of card 17. The gateway connector keeps no invitation or document between calls, accepts only a public HTTPS relay on port 443, rejects private and transition addresses and pins the address it checked. `LOLLY_AGENT_RPM` limits its calls per address, and `LOLLY_DISABLE_AGENT_CONNECTOR=1` turns it off. The `/live/*` routes run only on a long-lived process.
- **Proof:** `services/mcp/test/agent-connector.test.ts`, `live-relay.test.ts`, `live-relay-idle.test.ts`, `live-http.test.ts`.
- **What we accept:** whoever holds the invitation acts as the invited agent until it ends, so the person must keep it private. Text in the document can mislead the agent. The controls are Pause and Disconnect in the editor. A relay restart ends every invitation.
:::

::: details 22. The MCP endpoint
- **What crosses:** `POST /api/mcp`, the OAuth routes, the public `GET /tool/<id>.<ext>` render route and, when an operator turns on private files, `GET /api/mcp/files/<id>`. [Server Surface](/info/server-surface.html#mcp-endpoint) lists what each one receives and keeps.
- **What checks it:** HMAC, PKCE and short lifetimes on the OAuth flow. `LOLLY_MCP_PUBLIC_ORIGIN` is the only production origin authority, and hostile `Host` or `X-Forwarded-*` headers are ignored unless an exact trusted proxy peer is configured. Request bodies, decoded transform inputs and browser outputs have byte caps. A Redis-compatible HTTPS limiter enforces budgets across instances and receives only hashed subjects, and browser jobs use a bounded queue. The browser keeps its sandbox unless `LOLLY_BROWSER_NO_SANDBOX=1`, navigates only to an exact origin allowlist and rejects DNS answers in non-public ranges. PDF passwords travel through a one-shot in-page binding, never in the render URL. Private files are off by default; when on, each result is bound to a digest of the caller's bearer token and expires after five minutes, and an anonymous endpoint never offers them.
- **Proof:** `services/mcp/test/oauth.test.ts`, `gateway.test.ts`, `browser-jobs.test.ts`, `egress.test.ts`, `rate-limit.test.ts`, `mcp.test.ts`, `render-get.test.ts`, `result-files.test.ts`, `result-links-http.test.ts`.
- **What we accept:** authorisation is a passphrase per deployment rather than an identity per person. DNS checks and request interception reduce SSRF and rebinding exposure, but resolution and connection are separate steps, so a deployment still needs an egress firewall or proxy. MCP OAuth codes can be redeemed more than once within their lifetime (see the register). The public render route can be turned off with `LOLLY_DISABLE_RENDER_GET=1`.
:::

::: details 23. The certificate service
- **What crosses:** `GET /api/ca/auth/:provider`, `GET /api/ca/callback/:provider`, `POST /api/ca/email/start` and `POST /api/ca/enroll`; in the managed `vault-pki` issuer mode also `GET /api/ca/issuer/:id/crl`, `POST /api/ca/revoke/challenge` and `POST /api/ca/revoke` (`services/ca/handler.mjs`).
- **What checks it:** the OIDC state is a signed cookie with a 600-second lifetime and a domain-separation tag (`STATE_TTL_SECONDS` and `STATE_TYP`). Bodies are capped at 64 KiB (`BODY_CAP`), origins are allowlisted and enrolment requires proof of possession of the key being certified. Enrolment tokens are HMAC-signed with `TOKEN_TTL_SECONDS = 600` (`services/ca/lib/tokens.mjs`). A Redis-compatible HTTPS limiter enforces authentication, enrolment and email budgets across instances using hashed subjects, and an outage fails closed. Forwarded addresses are accepted only from exact trusted peers. In managed mode, a separate PKI issuer signs each certificate, each enrolment token and revocation challenge is admitted once across replicas through a shared store (`services/ca/lib/enrollment-admission.mjs`), and the deployment's default certificate lifetime can be at most one day and its maximum at most seven days.
- **Proof:** `tests/ca-service.test.ts` (tokens, proof of possession, the full issue path, origin allowlist, provider gate and limiter) and `tests/ca-managed.test.ts` (managed issuance, one-use admission and revocation).
- **What we accept:** fixed-window limiting permits bursts at window edges and depends on the configured store. The service keeps no issuance log, so response and provider telemetry are the only abuse signal. In the `legacy-root` mode, enrolment tokens are not single-use and there is no revocation (see the register); in managed mode, what the PKI issuer records follows its own configuration. See [Content Credentials](/info/content-credentials-identity.html).
:::

::: details 24. A Lolly Work instance
- **What crosses:** sign-in, policy requests, shared sessions, collaboration edits, uploads, approvals, server render jobs and delivery, all between the app and the organisation's own instance.
- **What checks it:** the instance checks identity and permissions and applies policy to the server operations it governs. It runs from a separate repository with its own tests.
- **Proof:** the Work guides: [security overview](/info/work-security-platform.html), [identity](/info/work-identity.html), [audit](/info/work-audit.html) and [data lifecycle](/info/work-data-lifecycle.html).
- **What we accept:** the tests on this page cover the engine, shells and services in this repository. Passing them does not establish the security of a whole deployment, so assess the shell release and the engine version the instance pins together.
:::

## Residual risk register

Each of these is a known, accepted design choice. They are listed so a reviewer can confirm we already know, and stop escalating them as findings.

| Risk | Where disclosed today | Why accepted | Planned mitigation |
|---|---|---|---|
| Verified built-in hooks are not sandboxed. `new Function('host', …)` still runs those reviewed hooks in the page realm. | `engine/src/runtime.ts`; `shells/web/src/lib/mount-runtime.ts`; `CLAUDE.md`, "The runtime lifecycle" | Shipping tools use DOM globals and DOM-dependent export hooks. Their privilege is tied to verified catalogue provenance; sideloaded and remote-untrusted tools are never promoted to this path. | Keep moving compatible built-ins to Worker isolation. A compromise of the release signing authority remains equivalent to a compromise of shell code. |
| A synchronous runaway **verified** hook cannot be stopped. | `engine/src/runtime.ts` and `tests/runtime-hooks.test.ts` | JavaScript cannot preempt code in its own realm. Strict sideload and remote Workers are ended on deadline, so the risk is limited to reviewed built-ins and unsigned development. | Move compatible built-ins to Workers, and keep the runtime-budget tests around the remaining page-realm path. |
| MCP OAuth authorization codes are not single-use. | The `services/mcp/src/oauth.ts` header, which states this trade-off | The OAuth server keeps no client registry, code store or token store, so there is nothing to consume a code against. The standard mitigation applies instead: a 60-second lifetime (`CODE_TTL`) and mandatory PKCE. | A durable code store, or a flow bound to an identity. |
| In the `legacy-root` issuer mode, CA enrolment tokens are stateless HMAC and not single-use. | The `services/ca/lib/tokens.mjs` header and `TOKEN_TTL_SECONDS`, the ten-minute enrolment window | The legacy path keeps no admission store. The token is bound to an OIDC-verified email, can be redeemed only with proof of possession of the enrolling key and issues a short-lived certificate rather than a lasting credential. The managed `vault-pki` mode admits each token once. | Use the managed issuer mode where one-use enrolment matters. |
| The *Weak* zip lock is PKWARE ZipCrypto, which falls to a known-plaintext attack. | The `engine/src/zip-crypto.ts` header; the export UI labels it *Weak: Simple Password*; [Security & Verification](/info/security.html) calls the Weak tiers deterrents | A compatibility tier: it opens in the unzip tools built into common operating systems. The *Strong* tier (AES-256) is one click away. | None planned. Keep the tier named Weak in the UI so nobody mistakes it for confidentiality. |
| The Imprint pixel watermark relies on obscurity. The chip key ships in public source and in the on-device detector, so a motivated adversary can subtract the mark cleanly. | The `engine/src/pixel-watermark.ts` header, in those words | It complements C2PA and never replaces it: cover against casual re-encoding and screenshots after the credential has been stripped. When a credential is intact, the credential is what is trusted. | None. A keyed scheme would need a key registry, which contradicts verification on the device. |
| LSB steganalysis has stated detection limits: LSB *matching* (±1) and low-rate embedding evade it, and a smooth synthetic gradient can raise a false positive. | The `engine/src/steganalysis.ts` header, stated up front | The chi-square attack catches the naive case that appears in the wild. Callers limit it to lossless PNG-family formats and show it as an amber hint, never a verdict. | None. It must never harden into a pass or fail claim. |
| Catalogue integrity is optional in development builds. | `scripts/build-release-web.ts`; `shells/web/src/catalog/integrity.ts`; `engine/src/catalog-integrity.ts` | No private signing key can ship in the repository, and local development must work without deployment credentials. Every release build, web and both Tauri shells, goes through the signed build wrapper and fails without a matching key pair. | None planned. Development builds stay visibly labelled as unsigned. |

## What is not a boundary

These read like gaps and are intended. Escalating them is a false positive.

| Looks like a gap | Why it is intended |
|---|---|
| `host.*` is not a sandbox. | It is a portability contract: the API that lets one tool run unchanged in a browser, in Tauri and in the CLI. It was never a confinement perimeter, and the module header says as much. Card 1 is where confinement happens. |
| URL parameters can set any input. | URL mode is first-class, and the CLI is the same mechanism over arguments, which keeps the app and the CLI from drifting. A link that sets every field of a tool is the feature working. |
| The hot-link render route needs no sign-in. | It renders public catalogue tools from public catalogue data, adds no Content Credentials and can be turned off with one environment variable. |
| `{{{x}}}` emits raw HTML. | Triple braces are the documented opt-out from escaping, used by the `markdown` helper and by tools that build SVG strings in hooks. The default, `{{x}}`, escapes. |
| The default C2PA signer is self-signed and reported as untrusted. | No real credential leaves the device. What must be correct is the container and its byte binding. A verified identity is the separate, opt-in certificate service. |
| `localStorage` holds interface preferences. | Tool state never goes there. It goes through `host.state`, which uses IndexedDB, the filesystem or memory depending on the shell. `localStorage` carries theme, language, sizing and similar start-up preferences. |
| Locked inputs and locked design systems can be bypassed. | They are rules the Lolly app applies on behalf of its user. Someone running another client, or the app without the organisation's instance, is not bound by them, and anyone can make an editable copy of a locked design system. They are not access controls. A Lolly Work instance enforces locked inputs on the server operations it governs, such as server renders (card 24). |
| Biome lint findings. | Lint is a per-file ratchet in CI: a change fails only when a file gains findings over `security/lint-baseline.json`, which carries more than a thousand older entries. A lint finding is not a vulnerability report, and a clean lint run is not a precondition for anything. |

## Check the claims yourself

Everything here runs from a clone.

```bash
git clone https://github.com/lolly-tools/lolly.git && cd lolly   # one repository; no submodule step
pnpm install
pnpm test                          # the whole suite

# the boundary tests named on this page, individually
node --test tests/runtime-hooks.test.ts tests/net-allowlist.test.ts \
            tests/catalog-integrity.test.ts tests/semver-range.test.ts \
            tests/url-pack.test.ts tests/zip-crypto.test.ts tests/pdf-crypto-r6.test.ts
```

`tests/README.md` describes the test layout and the gated tests, and [Parser Inventory](/info/parser-inventory.html) gives the fuzzing commands. CI's jobs are in `.github/workflows/ci.yml`: tests, typechecks and ratchets (the Biome lint ratchet among them), catalogue validation, smoke renders, release builds and budgets, generated API bundles, render-action self-tests, dependency and licence audits, secret history scanning and SAST. The weekly fuzz soak is `.github/workflows/fuzz-soak.yml`.

## Reporting

Vulnerability reporting, safe harbour and scope are in [`SECURITY.md`](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) at the repository root. Report privately to [fitzy+security@suse.com](mailto:fitzy+security@suse.com) rather than opening a public issue.
