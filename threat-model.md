# Threat Model & Trust Boundaries

The security reviewer's entry point. This page is an **index**, not fresh
analysis: nearly every fact below is already written down in the header comment
of the module that implements it, and each row points at the file and line where
you can read it for yourself. If a claim here and a module header disagree, the
module is right and this page is a bug.

Companion pages: [Security & Verification](/info/security.html)
(`docs/security-verification.md`) for the cryptographic standards and their test
coverage, [Server Surface](/info/server-surface.html) for the complete inventory
of anything that runs off-device, [Privacy Policy](/info/privacy.html) for what
data exists and where and `docs/parser-inventory.md` for the file-format parsers
that read attacker-controlled bytes.

Line numbers here are indicative, not exact. The engine is now `1.115.0`
(`engine/src/version.ts:16`), and the citations below were captured against an
earlier engine, so many have drifted. Grep the quoted identifier rather than
trusting the number.

## What Lolly is, security-wise

**Rendering happens on the device.** The engine has no network calls at all, and
the shells need none at render or export time, with two declared exceptions: a
tool's allowlisted `host.net` fetch (the boundary row below) and the URL-capture
tool loading the address you give it. There is no upload step in the
normal path: opening a tool, editing inputs, previewing, exporting and verifying
a file all complete locally. Two optional server components exist (an MCP
endpoint and a Content Credentials certificate authority) and both are listed,
with their data handling, in [Server Surface](/info/server-surface.html).

**Tools are data, not bundled code.** A tool is a `tool.json` manifest, a
Handlebars `template.html`, optional `styles.css` and an optional `hooks.js`,
synced to the client from a catalogue. New tools ship without an app update.
That is the product's central design choice and also its central security
consequence.

**Therefore catalogue provenance and tool trust class are security boundaries.**
Verified built-in hooks retain the compatibility path in the page realm, so
whoever signs the bytes served under `/tools/` and `/catalog/` controls code that
runs in that realm. Sideloaded and remote-untrusted hooks do not inherit that
trust: the web shell runs them in a dedicated, watchdog-terminated Worker with a
capability-shaped host RPC surface. A release build must sign its catalogue and
pin the matching public key in the shell; the loader refuses any tool file whose
bytes do not match the signed digest before the runtime compiles it
(`engine/src/catalog-integrity.ts`, plus `assertEnvelopeTrusted` at
`engine/src/loader.ts:200` and `assertFileIntegrity` at `:218`). That
enforcement is optional only for visibly labelled development builds because no
deployment key belongs in this repository (`scripts/build-release-web.ts`,
`shells/web/src/catalog/integrity.ts`).

**There is no server-side retention to attack.** The reference deployment keeps
no copy of user content, no accounts for ordinary use and no analytics. The one
piece of personal data that touches a server is an email address during optional
Content Credentials enrolment, held in request memory only
(`docs/privacy.md`, "Legal bases, retention and recipients").

## Trust boundaries

| Boundary | Entry point | Enforcement point | Test that proves it | Accepted residual risk |
|---|---|---|---|---|
| **Tool `hooks.js` → the host realm** | `engine/src/loader.ts` fetches hook text and assigns one of `builtin-verified`, `sideloaded-consented`, `remote-untrusted` or `development-unsigned` | The web shell's `mount-runtime.ts` sends sideloaded and remote-untrusted hooks to a fresh strict Worker regardless of the manifest's requested mode. `hook-worker.ts` exposes an allowlisted, capability-shaped host RPC facade, strips private methods, disables network/storage/credential/native ambient globals and terminates the Worker when a hook exceeds its budget. Refusal is fail-closed: it never falls back to `new Function` in the page. Verified built-ins and visibly unsigned development tools retain the main-realm compatibility path because shipping tools use DOM export hooks | `shells/web/src/bridge/hook-worker.test.ts`, `shells/web/src/lib/mount-runtime.test.ts`, `tests/runtime-hooks.test.ts` | A compromised release signing key can still turn a malicious hook into `builtin-verified`, and verified hooks can reach page globals. Strict Workers deliberately refuse DOM-dependent export hooks. Browser Workers are a containment boundary, not OS process isolation; the explicit RPC allowlist and CSP remain defence in depth. |
| **Hook runtime cost** | Any lifecycle hook invocation, via the engine runtime or strict Worker executor | Main-realm hooks retain `HOOK_BUDGET_MS` races. Strict Workers get the same per-hook deadline, but the shell terminates the dedicated Worker on either synchronous or asynchronous overrun | `tests/runtime-hooks.test.ts`, `shells/web/src/bridge/hook-worker.test.ts` | A synchronous runaway verified hook still cannot be preempted in the page realm. Sideloaded and remote-untrusted hooks are preemptible because their Worker is disposable. `onFrame` and `onLevel` retain overlap dropping. |
| **Tool ↔ engine version skew** | A manifest's `engineVersion` range, synced ahead of the binary | `satisfiesRange(ENGINE_VERSION, manifest.engineVersion)` at `engine/src/loader.ts:282` refuses the tool before its template or hooks are fetched | `tests/semver-range.test.ts` | A range comparator bug fails the wrong way in either direction. It is dependency-free code, so it is the thing under test rather than a vendored library. |
| **Catalogue origin → the loader** | Tool files fetched from the deployment's `/tools/` and `/catalog/` paths | `build:web:release` requires a private signing JWK and matching public JWK, signs the catalog, verifies the resulting envelope, and passes the public key into the Vite build. `assertEnvelopeTrusted` and `assertFileIntegrity` then authenticate every fetched file; a signed-but-missing file is fatal | `tests/catalog-integrity.test.ts`, `tests/catalog-release.test.ts` | Plain development builds intentionally support an unsigned, visibly labelled catalogue. Tauri packaging paths still need to be routed through the same release wrapper before they receive the same build-time guarantee. |
| **A `.lolly`'s carried tool → the device** | A shared `.lolly` file whose manifest carries a whole tool under `tool/` | `provisionLollyTool` asks the recipient before installing a new carried tool, refuses module hooks, and installed-tool load sites stamp it `sideloaded-consented`. That trust class forces strict Worker execution; the carried `trust` marker cannot promote itself to built-in trust | `shells/web/src/lib/lolly-pack.test.ts`, `shells/web/src/lib/installed-tools.test.ts`, `shells/web/src/lib/mount-runtime.test.ts` | Consent is still a social boundary and the package's SRI map proves transport integrity, not publisher identity. A sideloaded tool whose workflow requires DOM-dependent export hooks is refused instead of weakened into the page realm. Only the web shell reads `.lolly` today. |
| **URL query params → input values** | A shared link, a QR code, an embed or CLI `--foo=bar` argv, parsed by `parseUrlState` in `engine/src/url-mode.ts` | The `RESERVED` set (`engine/src/url-mode.ts:246`) separates engine params from tool inputs. The parse loop skips reserved keys at `:374`, and every value is coerced against the declared input model rather than trusted | `tests/engine.test.ts:143` asserts `RESERVED` against an inline copy of the documented list | Query params are fully attacker-controlled. Any input is expressible in a URL by design, so a link can put a tool into any state the sidebar could. That is a feature. Treat a pasted Lolly link as untrusted content. |
| **Packed / encrypted URL state** | `z` (`PACK_PARAM`, `engine/src/url-pack.ts:48`) and `zx` (`ENC_PARAM`, `:189`) tokens on an untrusted link | `MAX_TOKEN` = 64 KiB rejects an absurd token before decoding and `MAX_UNPACKED` = 256 KiB aborts inflation (`engine/src/url-pack.ts:58`–`:59`). Both caps are applied symmetrically on the encrypted path (`:228`, `:244`). `zx` is AES-256-GCM under PBKDF2-SHA256 at `PBKDF2_ITERATIONS` = 210 000 (`:191`), stored per token so it can rise | `tests/url-pack.test.ts` | DEFLATE expands roughly 1000×, so the caps are the whole defence against a decompression bomb. They are numeric constants, not adaptive. A `zx` link's strength is the user's password. |
| **`host.net` allowlisted fetch** | A tool declaring `capabilities: ["network"]` plus a `network.allowlist` block (`schemas/tool.schema.json:226`, `:234`) | `createNetAPI` in `packages/node-shell/src/net.ts:18` (re-exported by `shells/web/src/bridge/net.ts`) rejects any non-matching URL before I/O (`:21`) and caps the response body at `MAX_RESPONSE_BYTES` = 64 MiB via a counting stream, not a trusted `Content-Length` (`:16`, `:33`). The wildcard form must follow a path separator (`matches`, `:50`; schema pattern at `:247`) so a prefix cannot bleed into a lookalike host. The web shell's boot host gets a permanently **empty** allowlist and a per-mount clone carries the scoped one (`shells/web/src/bridge/index.ts:145`–`:150`) | `tests/net-allowlist.test.ts` | **Enforcement is per shell, not in the engine.** Every shell builds host.net from the one shared module, so they agree today, but nothing stops a new shell from wiring an unscoped `fetch` onto `host.net`. That is a silent-omission risk: the tool still works, the boundary is simply gone. A new shell must be reviewed against this row explicitly. |
| **`host.capture.page` on a hosted host** | A tool hook calling `host.capture?.page({ url })` while the tool runs on a server - the MCP host (`services/mcp/src/host.ts`) - rather than on the person's own machine | `captureUrl` (`packages/node-shell/src/url-capture.ts`) takes a `publicOnly` option, which the MCP host sets through `createCliBridge({ capturePublicOnly: true })`. `assertPublicHttpUrl` then refuses non-http(s) schemes, embedded credentials, and literal loopback, link-local, RFC 1918, CGNAT, multicast and unspecified addresses in IPv4, IPv6 and IPv4-mapped forms before Chromium is asked to navigate. The CLI and TUI on a person's own machine leave it off: capturing your own `localhost` is the point there | `tests/url-capture-guard.test.ts` | The check is on the literal hostname. A public name that resolves to a private address, or a redirect into one, is not caught here; on a hosted worker that is the egress firewall's job, and a deployment without one should not wire `host.capture` at all. The public deployment ships no Chromium, so the hosted path is inert there today. |
| **Tool hook → the user's signing identity** (`host.c2pa.sign`) | A tool hook calling `host.c2pa?.sign(bytes, format, opts)`, the optional v1.85 bridge API declared by `HostV1` in `packages/core/src/host-v1/host.ts` and specified in `packages/core/src/host-v1/c2pa.ts`. Two shipping tools use it: `community/redact` and `community/claim` | There is no `capabilities` gate on it - the API is optional and additive, so a tool feature-detects rather than declares it. The web shell's facade lazily routes to `signFreshC2pa` in `shells/web/src/bridge/export.ts`, which asks `host.identity.signer()` first, so an **enrolled** user's certificate chain goes into the manifest, and falls back to the engine's ephemeral self-signed key when no valid certificate is cached. Signing is local; nothing is uploaded | `tests/redact.test.ts` pins the call shape and asserts the tool ships what `sign` returned, including the no-identity path | A hook can put the user's CA-verified identity on bytes of its own choosing, and the manifest it produces is a real one - this is the ordinary export path's `c2pa` gate deliberately not applying, because the caller is the file's author. Tool review is the control, exactly as for `{{{x}}}`. The blast radius is bounded by certificate lifetime (7–365 days) and by the fact that the hook can only sign in a session the user already enrolled. |
| **Untrusted file bytes → format parsers** | Any user-supplied file: drag-and-drop on `/verify`, an `asset` or `file` input, a PDF or PPTX ingest | Per-parser bounds checks. `check:parser-assurance` cross-checks every row in `docs/parser-inventory.md` against the actual `ALL_TARGETS` list and requires each unfuzzed parser to have an owner, reason and unexpired waiver in `security/parser-assurance.json` | `tests/fuzz-regression.test.ts` replays saved crashers and seeded mutations; the weekly `fuzz-soak.yml` workflow runs all targets and retains the failing input; `tests/parser-assurance.test.ts` proves mapping drift and expired waivers fail closed | Fuzzing proves neither semantic correctness nor complete state coverage. All 47 registered parser surfaces are directly mapped to one of 37 targets; the register currently has no waivers. |
| **Template rendering → the page** | A tool's `template.html`, hydrated with input values by `hydrate` (`engine/src/template.ts:351`) | Handlebars, logic-less by design: `{{x}}` HTML-escapes, `{{{x}}}` is opt-in raw. No arbitrary JS in a template means no per-template XSS audit (`engine/src/template.ts:2`–`:15`). Helpers treat every argument as `unknown` and narrow immediately | `tests/engine.test.ts:595` (a `<script>` value comes out as `&lt;script&gt;`), `:636` (attribute-context escaping in the `media` helper) | `{{{x}}}` and the `markdown` helper emit raw HTML on purpose. A tool author who pipes a user input through triple-stache has opted out of escaping, and only tool review catches that. Tool review, not the engine, is the control. |
| **Crypto and signing** | Password and file inputs on the lock/sign paths; certificate and signature bytes on the verify paths | Primitives are delegated to WebCrypto: `globalThis.crypto.subtle` only, in `engine/src/pdf-crypto-r6.ts:32`, `engine/src/zip-crypto.ts:29`, `engine/src/x509.ts`, `engine/src/seal.ts`, `engine/src/c2pa.ts`. Deliberately hand-rolled, with no npm dependency: deterministic definite-length CBOR, the JUMBF box writer, COSE_Sign1 ES256 with a detached payload, minimal X.509 v3 certificates (`engine/src/c2pa.ts:16`–`:28`), the WinZip AES-CTR little-endian counter and PKWARE ZipCrypto keystream (`engine/src/zip-crypto.ts:16`–`:22`) and the DER walker. Randomness is **caller-supplied**, never generated inside these modules: `pdf-crypto-r6` takes the file key, four salts, the Perms tail and every per-object IV as parameters (`:9`–`:12`), and `zip-crypto` takes an injected `opts.rng` (`:13`) so both round-trip a fixed byte vector | `tests/pdf-crypto-r6.test.ts` and `tests/zip-crypto.test.ts` (both decrypt independently with `node:crypto`), `tests/c2pa*.test.ts` including `tests/c2pa-c2patool-conformance.test.ts`, `tests/x509.test.ts` for the certificate reader plus its issuance path end to end in `tests/ca-service.test.ts`. See [Security & Verification](/info/security.html) for the full matrix | There is **no `node:crypto` import anywhere in `engine/src`** (the only match is the word inside a comment at `engine/src/pdf-crypto-r6.ts:16`), so a shell that injects a weak `rng` or a bad key weakens the crypto with no engine-side check. The C2PA signing certificate is ephemeral and self-signed, so validators correctly report the signer as unknown: the container is what must be right, not the chain (`engine/src/c2pa.ts:12`). |
| **Service worker and PWA cache** | `shells/web/public/sw.js`, controlling every same-origin request once installed | Strategy is chosen per request, documented at `sw.js:1`–`:46`: navigations are network-first with a cached-shell fallback. Content-hashed build assets are cache-first, so a cached copy can never be stale. `/tools/` files are network-first with a timeout race. `/catalog/previews/` is stale-while-revalidate. The catalogue **index** files bypass the worker entirely; `/info` is network-first into its own per-URL `INFO_CACHE` bucket (`:95`, `networkFirstInfo` at `:171`), never the shell key. Only a navigation the SPA actually owns may be written to that shell key - `isShellNavigation` (`:501`) rejects any path whose last segment is a filename, so a real static document cannot displace the app shell. Generation cache is `CACHE = 'lolly-v14'` (`:56`). Seven unversioned buckets sit outside that generation in `PERSISTENT_CACHES` (`:108`) and `activate` never deletes them (`:216`): pinned offline tools (`PIN_CACHE`), the pre-downloaded build payload, the two ONNX runtimes, the docs bucket and the two Kokoro speech buckets | `shells/web/src/sw.test.ts` evaluates the real `sw.js` in a `node:vm` worker sandbox and drives navigations through the shipping fetch handler: the shell key survives an `/info` visit, `/info` is passed through rather than served, a filename path is never stored as the shell and `activate` drops the previous generation | A service worker is a persistent same-origin cache an attacker would love to poison, and seven buckets deliberately outlive cache-generation bumps - including roughly 117 MB of ONNX runtime and a ~92 MB speech model, which is a lot of long-lived same-origin bytes. Their integrity rests entirely on the origin's TLS and on the fact that hashed asset filenames are immutable. `CACHE` must be bumped by hand on any change to `sw.js`. Self-poisoning was real and shipped: until v12 every navigation was written to the shell key, so reading an `/info` page replaced the cached app with that page and the next offline load served documentation instead of the app. The fix was the rule this row now records - the docs get their own per-URL bucket, never the shell entry - and `/info` reads offline because of it. |
| **Locale files → the shell DOM** | Translation JSON under `shells/web/src/locales/`, returned by `t()` | Parameters remain escaped by default. `check:locale-markup` parses every catalogue and permits only the exact reviewed tag/attribute shapes already used; each translation must preserve its source string's tag sequence. Scripts, event handlers, unsafe URLs and novel markup fail CI | `shells/web/src/i18n.test.ts`, `tests/locale-markup.test.ts` | Approved tags still enter `innerHTML`, so the allowlist and its three exceptional spans/four links are security-sensitive review surfaces. The validator constrains syntax; it cannot judge misleading translated prose. |
| **Shell origin → browser-extension capture** | Any script executing on a Lolly origin can post a `lolly-capture/page` message to the extension relay, whose background holds `debugger` + `tabs` permissions and broad host access | Content scripts are scoped to Lolly origins, and the relay checks both `event.source === window` and an explicit origin allowlist. Pong, capture and site results are posted only to the validated request origin, never `*` | `tests/chrome-extension-relay.test.ts` evaluates the shipping content script and proves foreign origins/windows are ignored and replies retain the exact origin | Same-origin XSS can still invoke the relay. A nonce readable by code in that same realm would not change that, so the remaining mitigation must be extension-local consent/user gesture or reduced background permissions rather than a cosmetic page nonce. |
| **Script in the origin → network exfiltration** | Any script that runs in a Lolly origin, a tool hook or an injected shell XSS, can call `fetch`, open a WebSocket or append an `<iframe>` | The `Content-Security-Policy` header served on every response. `connect-src` names a fixed host set (`'self'`, `blob:`, `data:`, the two Google Fonts hosts, `www.googleapis.com` for the opt-in Send-to-Drive upload, `api.somafm.com`, `registry.color.org`, `www.color.org` and the open-meteo geocoding host), so a script that runs still cannot post data to a host outside it. `frame-src`, `child-src` and `worker-src` carry no scheme-wide `https:` grant, so the `<iframe src>` exfiltration path is closed too. `object-src` is `'none'` and `base-uri` is `'none'`. The policy is defined identically in `vercel.json` and the `$lolly_csp` map in `deploy/docker/nginx.conf:31` | `tests/security-headers.test.ts` pins the two copies together (a third, `shells/web/vercel.json`, was deleted in 2026-08 - nothing ever deployed from that root, so it drifted unnoticed; the test now asserts it stays gone), checks `connect-src` is neither absent nor `*` and rejects a scheme-wide `https:` on any framing directive | This contains an executing script. It does not prevent the script from running: `script-src` keeps `'unsafe-eval'` because tool hooks use `new Function`. The CSP is defence-in-depth over the hooks boundary above, not a replacement for Worker isolation. A deployment that terminates TLS at its own reverse proxy and strips these headers loses the containment. |
| **Tauri webview → native capabilities** | Shell code or an injected script invoking Tauri commands/plugins | Both shell configs ship a non-null production/development CSP. Capability files scope filesystem access to app-owned `saved-state`, `pack-store` and `Lolly` download/document paths rather than whole base directories. There is no generic shell or raw HTTP plugin permission. OAuth opens only through a Rust command for configured HTTPS provider hosts. Remote instances/providers use `remote_fetch`, which accepts HTTPS only, pins public DNS answers in a no-proxy client, rechecks every redirect, strips credentials across origins, rejects transport-owned headers and caps requests/responses | `tests/tauri-security.test.ts`; Rust URL/IP/header tests in both `remote_fetch.rs` copies; the Rust `oauth_url_validation` test; `cargo check` for both shells | Reviewed main-realm shell code remains privileged by design. `remote_fetch` must accept arbitrary public HTTPS origins because user-selected providers and deployments are product features; it prevents local-network/metadata access but is not a trust allowlist for public hosts. |
| **MCP endpoint (server)** | `POST /api/mcp`, OAuth endpoints and the public `GET /tool/<id>.<ext>` render route | HMAC/PKCE/TTL controls remain. `LOLLY_PUBLIC_URL` is the only production origin authority; hostile Host/X-Forwarded headers are ignored unless an exact trusted proxy peer is configured. MCP/OAuth bodies, decoded transform inputs and browser outputs have byte caps. A Redis-compatible HTTPS limiter enforces cross-instance budgets and receives only hashed subjects; browser jobs also use a bounded process queue. Chromium keeps its sandbox unless `LOLLY_BROWSER_NO_SANDBOX=1`. Browser navigation has an exact-origin allowlist and rejects DNS answers in non-public ranges. PDF passwords are passed through a one-shot in-page secret binding and removed from the render URL | `services/mcp/test/oauth.test.ts`, `gateway.test.ts`, `browser-jobs.test.ts`, `egress.test.ts`, `rate-limit.test.ts`, `mcp.test.ts`, `render-get.test.ts` | Authorisation is still per-deployment passphrase rather than per-user identity. DNS validation and request interception reduce SSRF/rebinding exposure but are not a substitute for the deployment egress firewall/proxy because resolution and connection are separate operations. The public render route is intentional and can be disabled with `LOLLY_DISABLE_RENDER_GET=1`. |
| **CA service (server)** | `GET /api/ca/auth/:provider`, `GET /api/ca/callback/:provider`, `POST /api/ca/email/start`, `POST /api/ca/enroll` (`services/ca/handler.mjs:13`–`:16`) | OIDC state is a signed cookie with a 600 s TTL and a domain-separation tag (`STATE_TTL_SECONDS` and `STATE_TYP`, `handler.mjs:27`–`:30`). Bodies are capped at 64 KiB (`BODY_CAP`, `:29`). Origins are allowlisted. Enrolment requires proof-of-possession of the key being certified. Enrolment tokens are HMAC-signed with `TOKEN_TTL_SECONDS = 600` (`services/ca/lib/tokens.mjs:51`). A Redis-compatible HTTPS limiter enforces cross-instance authentication, enrolment, per-IP email and per-address email budgets using hashed subjects; outages fail closed. Forwarded addresses are accepted only from exact trusted direct peers. Warm-instance maps remain as a second belt before email-provider calls | `tests/ca-service.test.ts` (token scheme, proof-of-possession, the full issue path, origin allowlist, provider gate, and durable limiter) | Fixed-window limiting permits boundary bursts and depends on the configured store. The CA intentionally keeps no issuance log, so response and provider telemetry are the only operational abuse signal. See [Content Credentials Identity](/info/content-credentials-identity.html). |

## Residual risk register

Each of these is a known, accepted design choice. They are listed so a reviewer
can confirm we already know, and stop escalating them as findings.

| Risk | Where disclosed today | Why accepted | Planned mitigation |
|---|---|---|---|
| Verified built-in hooks are not sandboxed. `new Function('host', …)` still runs those reviewed hooks in the page realm. | `engine/src/runtime.ts`; `shells/web/src/lib/mount-runtime.ts`; `CLAUDE.md`, "The runtime lifecycle" | Shipping tools use DOM globals and DOM-dependent export hooks. Their privilege is tied to verified catalogue provenance; sideloaded and remote-untrusted tools are never promoted to this path. | Continue migrating compatible built-ins to explicit Worker isolation. A compromise of the release signing authority remains equivalent to a shell-code compromise. |
| A synchronous runaway **verified** hook cannot be preempted. | `engine/src/runtime.ts` and `tests/runtime-hooks.test.ts` | There is no in-realm preemption in JavaScript. Strict sideload/remote Workers are terminated on deadline; the residual is limited to reviewed built-ins and unsigned development. | Move compatible built-ins to Workers and keep the no-growth/runtime-budget tests around the remaining compatibility path. |
| MCP OAuth authorization codes are not single-use. | `services/mcp/src/oauth.ts:6`–`:13` ("an auth code can't be hard one-time without a store") | Vercel functions share no memory or disk, so there is no code store to consume against. The standard mitigation is applied instead: a 60 s TTL (`CODE_TTL`, `:43`) plus mandatory PKCE. | A durable store, or an identity-bound flow, if the endpoint moves off stateless serverless. |
| CA enrolment tokens are stateless HMAC and not single-use. | `services/ca/handler.mjs:350`–`:352`, verbatim: "a short-lived (10-minute) stateless HMAC token - time-bounded, not single-use" | Same statelessness constraint. The token is bound to an OIDC-verified email and redeemable only with proof-of-possession of the enrolling key, and it issues a short-lived leaf certificate, not a durable credential. | A durable store, alongside the same change for the MCP codes. |
| The *Standard* zip lock is PKWARE ZipCrypto, which is weak against known-plaintext attack. | `engine/src/zip-crypto.ts:5`–`:8`; the export UI names the actual cipher; [Security & Verification](/info/security.html) labels the Standard tiers as deterrents | Deliberate compatibility tier: it opens in any unzip tool including Windows Explorer's built-in extract. The *Strong* tier (WinZip AE-2, AES-256) is present and one click away. | None planned. The fix is user-facing honesty, not a cipher change: keep both tiers named in the UI so nobody mistakes Standard for confidentiality. |
| The Imprint pixel watermark is security-through-obscurity. The chip key ships in public source and in the on-device detector, so a motivated adversary can subtract the mark cleanly. | `engine/src/pixel-watermark.ts:20`–`:25`, in those words | It is a complement to C2PA, never a replacement: honest cover against casual re-encoding and screenshotting, for the case where the credential has already been stripped. When a credential is intact, that is what is trusted. | None. A keyed scheme would need a key registry, which contradicts on-device-only verification. |
| LSB steganalysis has stated detection limits: LSB *matching* (±1) and low-rate embedding evade it, and a smooth synthetic gradient can false-positive. | `engine/src/steganalysis.ts:12`–`:18`, stated up front | The chi-square attack catches the naive-but-common case, which is what appears in the wild. Callers gate it to lossless PNG-family formats and surface it as an amber heuristic, never a verdict. | None. The mitigation is the presentation: it must never harden into a pass/fail claim. |
| Catalogue integrity is optional in development and not yet forced through every Tauri packaging entry point. | `scripts/build-release-web.ts`; `shells/web/src/catalog/integrity.ts`; `engine/src/catalog-integrity.ts` | No private signing key can ship in the repository, and local development must work without deployment credentials. The web release/Vercel path now fails without a matching signing key pair. | Route both Tauri release packaging commands through the same signed build wrapper and provision their public keys through release secrets. |

## What is not a boundary

These read like gaps and are not. Escalating them is a false positive.

- **`host.*` is not a sandbox.** It is a *portability* contract: the API that
  lets one tool run unchanged in a browser, in Tauri and in the CLI. It was
  never a confinement perimeter, and the module header says so.
- **URL parameters reaching any input is intended.** URL mode is first-class and
  the CLI is the same mechanism over argv, which is what keeps GUI and CLI from
  drifting. A link that sets a tool's every field is the feature working.
- **The hot-link render route being unauthenticated is intended.** It renders
  public catalogue tools from public catalogue data, emits no Content
  Credentials and can be switched off with one environment variable.
- **`{{{x}}}` emitting raw HTML is intended.** Triple-stache is the documented
  opt-out from escaping, used by the `markdown` helper and by tools that build
  SVG strings in hooks. The escaping default is `{{x}}`.
- **The C2PA signer being self-signed and reported as untrusted is intended.**
  No real credential leaves the device, so what must be correct is the container
  and its byte binding, not the certificate chain. Verified identity is the
  separate, opt-in CA path.
- **`localStorage` holding interface preferences is intended.** Tool state never
  goes there. It goes through `host.state`, which resolves to IndexedDB, the
  filesystem or memory depending on the shell. `localStorage` carries theme,
  language, sizing and similar boot-time preferences only.
- **Biome lint findings are not security findings.** Linting is advisory and not
  a CI gate, and the baseline carries thousands of pre-existing entries. A clean
  lint run is not a precondition for anything.

## Verify these claims yourself

Nothing here needs to be taken on trust. Everything runs from a clone.

```bash
git submodule update --init --recursive   # BEFORE pnpm install; workspaces need every package.json
pnpm install

pnpm test                       # the whole suite: tests/, packages/core/test/, shells/web/src/**, services/mcp/test/
node --test "tests/**/*.test.ts"   # just the repo-root engine/contract suite (quote the glob)

# the boundary tests named above, individually
node --test tests/runtime-hooks.test.ts tests/net-allowlist.test.ts \
            tests/catalog-integrity.test.ts tests/semver-range.test.ts \
            tests/url-pack.test.ts tests/zip-crypto.test.ts tests/pdf-crypto-r6.test.ts

# untrusted-input fuzzing
node --test tests/fuzz-regression.test.ts     # replays tests/fuzz/regressions/ + a seeded sweep, ~seconds
FUZZ_ITERS=50000 node tests/fuzz/run.ts       # the standalone discovery soak
pnpm run check:parser-assurance                # inventory ↔ fuzz target/owned-waiver contract
```

The fuzz harness lives in `tests/fuzz/` (`prng.ts`, `mutate.ts`, `targets.ts`,
saved crashers in `regressions/`) and is shared between the in-suite regression
test and the soak runner, so both exercise the same code path. `FUZZ_ITERS`
sets the length (300 in the suite, 2500 for a bare `run.ts`). `FUZZ_SCRATCH` and
`FUZZ_KEEP` control where in-flight inputs are written and whether they survive.
See `tests/README.md` for the layout and the gated tests.

CI's independent jobs are defined in `.github/workflows/ci.yml`: tests,
typechecks and boundary ratchets, catalogue validation, smoke renders, release
build/budgets, generated API bundles, render-action self-tests, dependency and
licence audits, secret history scanning and SAST. The weekly fuzz discovery
soak is in `.github/workflows/fuzz-soak.yml`. Lint is not among them, by design.

## Reporting

Vulnerability reporting, safe harbour and scope are in
[`SECURITY.md`](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) at
the repository root. Report privately to
[fitzy+security@suse.com](mailto:fitzy+security@suse.com) rather than opening a
public issue.
