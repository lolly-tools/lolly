# Managed AI execution

Managed AI is disabled by default. Enabling it requires both an explicit deployment
approval ceiling and an operator switching **Managed AI** to **On** in the console's
Feature flags page. This service switch is not a personal preference. `policy.edit`
authorizes changes (admin/owner by default, or an explicitly delegated grant), and
the existing `policy.flag.edit` audit event records the previous and new setting.
Policy-as-code export/apply also includes the `ai` flag.

The first internal production profile keeps this configuration:

```json
{ "policy": { "ai": { "enabled": false, "capabilities": [] } } }
```

Build the matching Lolly web shell with `VITE_REQUIRE_AI_POLICY=true`. For the
repository's Dockerfile, pass `--build-arg VITE_REQUIRE_AI_POLICY=true` together
with the reviewed profile and catalog signing secrets. This is a **build setting**;
putting it on a running nginx container cannot change an already-built shell.
The flag protects first boot when Work is absent, inaccessible or misrouted.
Existing public/standalone builds retain their ordinary behaviour. An updated
shell that has detected Work also remembers that its origin is managed, but that
best-effort device marker is not a substitute for the managed build setting.

Deploy the updated shell and Work together. Older shells do not implement this
contract; older Work responses have no AI policy and updated managed shells
therefore keep AI off. Review open tabs, service-worker updates and packaged
clients when promoting or withdrawing a release.

## Contract and execution

`org-config.ai` and authenticated `GET /api/v1/policy/ai` return:

```json
{ "version": 1, "enabled": false, "capabilities": [], "maxAgeSeconds": 60 }
```

The dedicated endpoint returns `Cache-Control: no-store` and resolves live
membership on each request. The shell also bypasses the browser HTTP cache when
loading org-config. AI configuration contributes to the org-config ETag.

The shell renews every 30 seconds, with a five-second request budget. A failed,
oversized, malformed or unsupported response withdraws permission; the maximum
lease is 60 seconds. A persisted org-config never grants an AI lease. Both a
monotonic deadline and wall-clock deadline limit use after device sleep. Expiry
is checked at execution as well as by timer, so a suspended background tab cannot
use a stale lease when it resumes. Logout/session loss prevents renewal.

| Capability | Supported shell paths |
|---|---|
| `speech`, `transcription` | Kokoro synthesis and Whisper speech recognition |
| `upscale`, `matte`, `ocr`, `depth` | Model-based image processing and cached depth results |
| `reword`, `ai-detect` | Local rewriting, its tokenizer-based watermark check, and text detection |
| `embedding` | Ask search embeddings; ordinary lexical search remains available |
| `watermark` | Neural TrustMark/ContentSeal detection and durable watermark encoding |

Checks apply before bridge execution, worker creation/dispatch and model
acquisition, including cached weights and offline pre-downloads. Revocation
terminates model workers, aborts guarded downloads and suppresses late results.
The offline profile reports that AI downloads are disabled and still allows
removing cached model files. Pure image operations and cryptographic Content
Credentials are separate from neural watermarking.

Server browser exports do not have a member AI lease: the render worker always
disables the supported shell AI paths and blocks model asset requests. Keep
`render.allowHooksInFastPath=false` in the first production profile.

The matching Lolly MCP service also omits model-backed APIs from its headless
host, disables AI in browser-render contexts and rejects model asset requests.
Enabling Work's AI flag does not enable MCP AI. Standalone CLI/TUI invocations
retain their existing behaviour and require separate endpoint policy if in scope.

## Operating and reviewing the switch

To withdraw AI, set the `ai` flag to Off (or Inherit), or deploy
`policy.ai.enabled=false`. On never exceeds the configured capability list.
For an approved later release, set `enabled=true` with only reviewed capabilities
and explicitly switch On. Empty enabled lists, unknown capabilities and malformed
configuration are rejected at startup. Visibility and injectable flags cannot
grant execution permission.

Approve the models in the exact release as part of that change. The current
configuration scopes capabilities, not individual model IDs. Withdrawing one
model currently means disabling its whole capability or shipping a reviewed
replacement. Model-specific policy, broader AI execution receipts and approval
of an AI-enabled service remain separate work; the first release can keep AI off.

This is enforcement in the supported application, not a sandbox for arbitrary
JavaScript, a modified client, an independent CLI or a copied model. Endpoint
controls, trusted releases and appropriate network restrictions remain necessary.
An in-flight main-thread ONNX or native call may finish computation; its guarded
result is discarded after revocation. Offline devices cannot receive an instant
remote command; their lease expires instead. Previously exported files are not
recalled. The switch does not delete cached data or satisfy a privacy erasure request.

Policy changes are audited without prompts or media. No inference-content logging
was added by this control. Confirm central audit receipt, organizational review,
model inventory, approved use/data scope and the applicable assessments before
enabling AI in production.
