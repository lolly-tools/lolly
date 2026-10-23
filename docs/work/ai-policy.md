# Manage organisation AI policy

This page is for the admin deciding whether members may use Lolly's model-backed features on a
Lolly Work deployment, and how to stop them at once. Managed AI is off by default. It is a
service switch for the whole deployment, not a personal preference, and it covers the features
below.

## What managed AI covers

| Capability | Supported shell paths |
|---|---|
| `speech`, `transcription` | Kokoro synthesis and Whisper speech recognition |
| `upscale`, `matte`, `ocr`, `depth` | model-based image processing and cached depth results |
| `reword`, `ai-detect` | local rewriting, its tokenizer-based watermark check and text detection |
| `embedding` | Ask search embeddings; ordinary keyword search stays available |
| `watermark` | neural TrustMark and ContentSeal detection, and durable watermark encoding |
| `sing` | Rondocode singing voices: their download and the model files handed to a song |

Checks run before bridge execution, before worker creation and dispatch and before any model download, including
cached weights and offline pre-downloads. Revoking a capability ends model workers, stops guarded
downloads and drops late results. The offline profile reports that AI downloads are disabled and
still allows removing cached model files. Pure image operations and cryptographic Content
Credentials are separate from neural watermarking and are not governed here.

## Turn it on: two keys

AI runs only when both of these say yes:

::: figure work-ai-two-keys
The deployment's capability list and the console switch must both allow a feature; the shell then holds a 60-second lease it renews every 30 seconds.
:::

1. **The deployment's approval ceiling**, in the instance configuration: `policy.ai.enabled`
   and the list of reviewed `capabilities`.
2. **The console switch**: an operator sets **Managed AI** to **On** on **This Deploy → Feature
   flags**. `policy.edit` authorizes the change (admin and owner by default, or a delegated
   grant), and the `policy.flag.edit` audit event records the old and new setting.

**On** never exceeds the configured capability list. We recommend starting a production install
with AI off:

```json
{ "policy": { "ai": { "enabled": false, "capabilities": [] } } }
```

For a reviewed later release, set `enabled: true` with only the reviewed capabilities, then switch
**On** explicitly. An empty enabled list, an unknown capability or malformed configuration is
refused at startup, and visibility and injectable flags can never grant execution. Policy-as-code
export and apply include the `ai` flag ([governance](governance.md#policy-as-code)).

Approve the models in the exact release as part of the same change. The configuration scopes
capabilities, not individual model IDs, so withdrawing one model means turning off its whole
capability or shipping a reviewed replacement.

## How the shell holds permission

`org-config.ai` and the authenticated `GET /api/v1/policy/ai` return:

```json
{ "version": 1, "enabled": false, "capabilities": [], "maxAgeSeconds": 60 }
```

- The dedicated endpoint returns `Cache-Control: no-store` and reads live membership on each
  request. The shell also bypasses the browser HTTP cache when it loads org-config, and the AI
  configuration feeds the org-config `ETag`.
- The shell renews every 30 seconds, with a five-second request budget. A failed, oversized,
  malformed or unsupported response withdraws permission, and the longest lease is 60 seconds.
- A stored org-config never grants an AI lease. Both a monotonic deadline and a wall-clock
  deadline limit use after the device sleeps, and expiry is checked when a feature runs as well
  as by a timer, so a suspended background tab cannot use a stale lease when it wakes. Signing
  out, or losing the session, stops renewal.

Rondocode runs its singing models inside its own editor frame. The shell checks `sing` when a song
asks for the model files, and again before it downloads any that are missing. Withdrawing the
capability refuses later requests; a request that already passed those checks can still finish,
and files the frame already holds are not recalled. Approve `sing` only for a Lolly 1.1.1 or later
shell. An older shell refuses a lease that asks for a capability it does not know, so every AI
capability stays off there until the shell is updated.

## Turn it off

Set the `ai` flag to **Off** (or **Inherit**), or deploy `policy.ai.enabled=false`. Connected
shells lose permission within one lease, at most 60 seconds, and offline devices lose it when
their lease expires, because they cannot receive an instant remote command.

## What it does not control

This is enforcement inside the supported application, not a sandbox for arbitrary JavaScript, a
modified client, an independent CLI or a copied model. Endpoint controls, trusted releases and
suitable network restrictions are still needed.

- An in-flight main-thread ONNX or native call may finish computing; its guarded result is
  discarded after revocation.
- Files already exported are not recalled, and the switch does not delete cached data or satisfy
  a privacy erasure request.
- Server browser exports have no member AI lease: the render worker always turns off the
  supported shell AI paths and blocks model asset requests. Keep
  `render.allowHooksInFastPath=false` in the first production profile.
- The matching Lolly MCP service leaves model-backed APIs out of its headless host, turns AI off
  in browser-render contexts and rejects model asset requests. Turning on Work's AI flag does not
  turn on MCP AI.
- Standalone CLI and TUI use keeps its own behaviour and needs a separate endpoint policy if it is
  in scope.

Policy changes are audited without prompts or media, and this control adds no logging of
inference content. Model-specific policy, broader AI execution receipts and approval of an
AI-enabled service are not built, and a first release can keep AI off. Before turning AI on in
production, confirm that these audit events reach your central log, and complete whatever review,
model inventory and assessments your organisation requires.

::: details Build and release notes for operators
Build the matching Lolly web shell with `VITE_REQUIRE_AI_POLICY=true`. For the repository's
Dockerfile, pass `--build-arg VITE_REQUIRE_AI_POLICY=true` together with the reviewed profile and
catalog signing secrets. This is a **build setting**: setting it on a running nginx container
cannot change a shell that is already built. It protects the first boot when Work is absent,
unreachable or misrouted. Public and standalone builds keep their ordinary behaviour. An updated
shell that has detected Work also remembers that its origin is managed, but that best-effort
device marker does not replace the managed build setting.

Deploy the updated shell and Work together. Older shells do not implement this contract, and older
Work responses carry no AI policy, so updated managed shells keep AI off against them. Review open
tabs, service-worker updates and packaged clients when you promote or withdraw a release.
:::
