# Content Credentials - engineering & operator guide

The engineering companion to [Content Credentials identity](/info/content-credentials-identity.html)
(the user-facing page). This covers the device/CA architecture, the engine
contracts, the CA service, the web-shell wiring, the one-time operator setup, the
threat model and the roadmap.

> **Versioning.** CA-issued signing first shipped at engine 1.11. The capability
> bridge is additive-only, so everything here still holds, but the verifier has
> grown since: it now reads **both C2PA 1.x and 2.x** claims (so credentials from
> Gemini, Adobe and other generators verify), Lolly **writes** 2.x by default and
> the trust list bundles the public C2PA/CAI anchors alongside the Lolly root. Read
> the live `ENGINE_VERSION` in `engine/src/version.ts` and its changelog in `engine/CHANGELOG.md` rather
> than trusting a pinned number here. Source line numbers are omitted
> below - grep the named symbol; offsets drift.

## Architecture

```
┌───────────── device (open source) ─────────────┐   ┌─ CA service ───────────┐
│ WebCrypto P-256 keypair (non-extractable, IDB) │   │ /api/ca/* routes       │
│ shells/web/src/bridge/identity.ts              │──▶│ services/ca/handler    │
│   enroll: popup OIDC → CSR+PoP → cert (cached) │◀──│  - OIDC verify         │
│   signer(): {sign, chain} while cert valid     │   │  - CSR + PoP verify    │
│ export path: embedC2pa(..., {signer})          │   │  - leaf: root or Vault │
│ verify path: verifyC2pa(..., {trustAnchors})   │   │ CA key: env or HSM/KMS │
└────────────────────────────────────────────────┘   └────────────────────────┘
```

**Enrollment is app-level. Signing reached the bridge in a later release.**
No tool can start, observe or inspect enrolment: there is no `host.identity`,
the Settings view owns the flow and the ordinary export path consumes the signer
inside the shell's own export implementation. What *is* on the bridge is
`host.c2pa.sign` (v1.85, widened v1.104) - optional, additive and **not** gated
by a `capabilities` flag, so a tool feature-detects `host.c2pa?.sign`. It exists
for the case where the tool, not the export pipeline, authors the output file: a
redaction that must ship as a new work rather than carry the un-redacted
original as an ingredient, or an authorship claim stamped onto a file the user
brought in. It routes to the shell's `signFreshC2pa`, which asks
`host.identity.signer()` first - so **it signs with the enrolled identity when a
valid certificate is cached**, and falls back to the ephemeral key otherwise.
Everything stays on-device; nothing is uploaded.

One consequence follows: a hook that calls it
can put the user's CA-verified identity onto bytes of its own choosing. That is
the point of the API (the tool *is* the author here), so **tool review is the
control** - the same control that covers a `{{{x}}}` in a template. Four shipping
tools call `host.c2pa.sign`: `community/redact`, `community/claim`, `community/sign`
and `community/rondocode`. Its companion `host.c2pa.readIngredients` (v1.104) reads
every manifest a file already carries and packages each as an ingredient, so a tool
that signs an existing file carries those credentials forward instead of orphaning
them; `claim`, `sign` and `rondocode` use it. The engine
additions remain ordinary options (`opts.signer`, `opts.trustAnchors`) on
existing pure functions.

## Engine contracts

`HostV1` grows only by addition, and `host.c2pa` (above) is its one
identity-adjacent surface. The relevant modules:

### `engine/src/x509.ts` (DER/X.509 authority)

Pure module shared by the ephemeral path, the CA service and tests. No DOM,
`globalThis.crypto` only. It owns the DER writer helpers (`der`, `derSeq`,
`derSet`, `derOctet`, `derUint`, `derOid`, `derTime`, `ecdsaRawToDer`) and
`generateSigner` (c2pa.ts re-imports them - **byte-identical output**, so the
existing c2pa test suite is the regression harness), plus:

```js
export function pemToDer(pem)                      // -> Uint8Array
export function derToPem(der, label)               // 'CERTIFICATE' | 'PRIVATE KEY'
export async function generateCaRoot({ commonName, organization, days })
  // -> { certDer, pkcs8Der }  self-signed CA:TRUE root, ES256 P-256, keyCertSign
export async function issueLeafCert({
  caCertDer, caPrivateKey,                          // issuer (CryptoKey or pkcs8 Uint8Array)
  spkiDer,                                          // subject public key (proven by the enrolment request)
  email, commonName, organization,                  // SAN rfc822Name + CN + O
  days,                                             // default 7
  notBefore, notAfter,                              // override days (the CA service sets these)
})  // -> Uint8Array cert DER
```

**c2pa-rs compatibility is non-negotiable in the leaf profile** (it hard-fails
otherwise): subject MUST carry an `O=` attribute, EKU MUST be
id-kp-emailProtection (`1.3.6.1.5.5.7.3.4` - anyEKU is rejected), keyUsage
digitalSignature critical, SKI + AKI present, plus SAN rfc822Name = the
verified email. Serial: random with the ephemeral path's stable-width trick.

### `engine/src/c2pa.ts`

`embedC2pa(bytes, format, opts)` and `embedC2paInPdf(bytes, opts)` take one
optional `signer`. `buildC2paManifest` already threads it; the embedders use
`opts.signer ?? await generateSigner(dates)`:

```js
opts.signer = {
  privateKey,                        // CryptoKey (P-256, 'sign') - the normal device path
  // OR sign: async (sigStructureBytes) => Uint8Array(64)  // raw r||s, NOT DER
  certDer,                           // leaf DER (back-compat single-cert shape)
  chain,                             // Uint8Array[] leaf-first - wins over certDer in x5chain
}
```

Inside the COSE signing step: the x5chain (label 33) becomes
`signer.chain ?? [signer.certDer]`, and the sign call becomes
`signer.sign ? await signer.sign(sigStructure) : subtle.sign(…, signer.privateKey, sigStructure)`.
Two-pass safety: chain bytes are captured once per embed (byte-identical
across passes), ES256 signatures are fixed 64 bytes, alg stays hardcoded −7 -
**P-256 only** by contract. `sign()` runs several times per embed (probe +
fixed-point rounds + pass 2), fine for a WebCrypto key; a future
user-presence key would need dummy probe signatures.

### `engine/src/c2pa-verify.ts`

```js
verifyC2pa(bytes, { trustAnchors } = {})   // trustAnchors: Uint8Array[] (root cert DER)
```

Zero-options behaviour stays byte-identical (contract tests guard it). With
anchors supplied, it captures the full x5chain and verifies leaf-signed-by-anchor
(issuer-name DER bytes match anchor subject bytes + a signature check over the
leaf's tbsCertificate using the anchor SPKI). `parseCertificate` is extended
**additively** (tbsBytes, rawSignature, issuer/subject bytes, SAN emails,
signature algorithm) - existing fields unchanged. It reads both `c2pa.claim` and
`c2pa.claim.v2` (with `created_assertions`/`gathered_assertions` and
`c2pa.actions.v2`), and multi-algorithm chains (ECDSA P-256/384/521, RSA
PKCS#1 v1.5, RSA-PSS, Ed25519) walk an arbitrary but bounded depth to a pinned
anchor.

Report verdict semantics (surfaced by the `/verify` view):

- Chain verifies + leaf inside validity → `report.trusted = true` and
  `report.signer.identity = { email, issuer }`. When the claim records a Lolly
  export, the headline stays **Made with Lolly** and the view adds a "Signed by
  \<email\> - identity verified by \<issuer\>" line. Otherwise the view resolves
  this to **Verified** (or **Delivered by Lolly** when the active claim is a
  `c2pa.published` rather than `c2pa.created` action).
- On a managed deployment, `verifyC2pa` also takes `enrollmentTrust` (the public
  trust bundle) and `enrollmentCrls`; a managed chain is trusted only when its
  issuer's revocation list is fresh and does not list the leaf
  (`validateManagedCredential` in `engine/src/enrollment.ts`).
- Chain verifies but leaf outside validity → the `expired` verdict; the identity
  is still set (it was CA-verified), but `report.trusted` stays false.
- Intact Lolly claim → `report.madeWithLolly` (**Made with Lolly**); an intact
  claim whose bytes fail only the hard binding → `report.likelyMadeWithLolly`
  (amber **Likely made with Lolly**).
- No anchors / no chain to an anchor → anonymous-but-valid ("Credential intact").

### CLI

`lolly validate <file…> [--json] [--metadata] [--deep] [--rebuild=<session.lolly>] [--require=credential|none] [--trust-anchor=<root.pem>] [--no-default-anchors]` -
same verifier, same report; `--trust-anchor=` loads PEM → DER and appends to
`trustAnchors` (repeatable; value flags reject the bare `--trust-anchor <root.pem>`
form), `--metadata` adds the embedded-metadata and hidden-data report, and `--deep`
adds the neural pixel-watermark scan (browser tier). The default anchor set is the **Lolly CA root plus the vendored C2PA
known-certificate list**, identical to the web `/valid` view and to MCP's `lolly_verify`,
so a Lolly-CA-signed export reads the same on every
surface. `--no-default-anchors` drops both built-in sets for a bare-trust check, and
every report prints which set produced the verdict.

## Beyond C2PA: pixel- and byte-level verify reads

The web `/verify` view runs several checks *around* the credential. Each is a pure,
DOM-free engine (or shell-lib) module fed a decoded RGBA buffer or the raw file
bytes by the shell; none is a bridge capability, and none uploads anything - the
deep-scan model download (opt-in, one-time; same-origin on the web, from the model
host `lolli.li` in the desktop and mobile apps) is the only network touch,
and it never sends the file. The view passes **no SEAL key
resolver** - a DNS-published key reports "no key resolver" instead of being fetched
through a third-party DoH service. The desktop and mobile apps run the same view, and
no other shell calls `verifySeal`, so no Lolly surface resolves SEAL keys in DNS today.

Each read has its own surface in the view, catalogued in the component library
beside the module that defines it - here, the verdict-hero entry: the verdict
states it covers and the `valid.ts` source behind them:

![The component-library entry for the verify hero - the verdict states it covers (Made with Lolly, Verified, broken) beside the valid.ts source that defines them](/t/url-shot?url=%2F%23%2Fcomponents&width=1200&height=1400&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23cl-verify-valid%20.cl-card&dark=1&filename=ce-verify-card)

### `engine/src/pixel-watermark.ts` - the Lolly Imprint

Block-DCT spread-spectrum watermark (Cox/Kilian/Leighton/Shamoon) on the same 8×8
grid JPEG's own DCT uses, so it survives recompression. `embedWatermark(rgba, opts)`
adds a fixed ±1 chip to mid-band luma coefficients scaled by a perceptual mask;
`detectWatermark(rgba, {width, height})` correlates and returns a presence score
(`DetectResult`); `canCarryWatermark(w, h)` gates images too small to hold the mark
(`MIN_IMPRINT_BLOCKS`). Presence-only, no payload. **Security posture is obscurity,
not a hardened defence** - the chip key ships in this public source, so a motivated
adversary who reads it can subtract the mark. It's honest cover against casual
re-encoding/stripping, framed exactly like the self-signed on-device C2PA key.
The shell embeds it two ways: the standalone raster
encoders' `opts.imprint` branch, and `imprintEmbedCanvas` baking the mark into each
Lolly-rendered raster as it's composited into a PDF page / PPTX slide - so a
pure-vector page marks nothing, and the C2PA claim is gated on whether a mark was
actually applied, never over-claimed. On by default; `?imprint=0` opts out.

### `engine/src/steganalysis.ts` - LSB chi-square

`analyzeLsb(rgba, {width, height})` runs a chi-square test on pixel-pair LSB
statistics and returns a likelihood that the image hides LSB-embedded data. It's a
heuristic (amber), never a cryptographic verdict; the view renders it as an
`LSB steganography likely` pip plus an `LSB analysis` metadata row.

### `engine/src/file-metadata.ts` - appended payloads

`extractFileMetadata(bytes)` reads EXIF/XMP/IPTC and, for provenance, detects bytes
appended *after* a container's real end (PNG `IEND`, JPEG `EOI`, GIF trailer, APNG),
returning them as an `appended` field the view renders with view/download of the
extracted bytes (rendered only as escaped hex/text - never parsed or executed). The
legitimate motion-photo append (`kind: 'video (motion photo)'`) is recognised and
shown without a warning. This read is bytes-only, so MCP surfaces it in its metadata
output too (it lacks the interactive extractor, but sees the same `appended` field).

### `engine/src/seal.ts` - SEAL cryptographic signatures

`verifySeal(bytes, resolveKey?)` parses a hackerfactor [SEAL](https://github.com/hackerfactor/SEAL)
record and verifies its signature over the covered byte ranges. The `resolveKey`
resolver is optional and shell-supplied: **the Verify view passes none** (zero
network requests - a DNS-keyed record reports "no key resolver"), and it is the only
caller today: `lolly validate`, the TUI and MCP do not check SEAL. **This is a
byte-signature format - not a pixel watermark, and NOT Meta's Content Seal despite
the shared word.** A key the file itself carries yields an
internally-consistent-but-unattributed result. A key resolved from DNS would yield
domain attribution (`Signed by <domain> (SEAL)`, proving domain control, not a
CA-verified legal identity), but no shell supplies a resolver yet. There is no
network touch, and the file never leaves the device.

### Deep scan: `trustmark.ts` + `contentseal.ts` (web, opt-in)

Two open pixel-watermark decoders behind a one-time consent - a ~90 MB detector
download gated by a single batch-level banner, after which the scan is passive per
file (`shells/web/src/lib/trustmark.ts` and `contentseal.ts`, with
`engine/src/contentseal.ts` for the DOM-free decode math):

- **Adobe TrustMark** - a real, ECC-verified decode; a payload that passes its
  error-correction check is a genuine read (green pip + recovered bytes), not a
  guess.
- **Meta Content Seal** - the *open* Pixel Seal / Video Seal watermark. No ECC gate,
  so a decode that stays consistent across several re-encodings is an amber
  statistical "likely", and the note always carries the caveat that Meta's
  proprietary **Muse** image variant is a different watermark this cannot read (so a
  hit is never "Meta AI", and absence rules nothing out).

Everything is on-device; nothing but the one-time model bytes is fetched.

TrustMark's *write* side is one switch in the export panel, off by default for the
same reason its scan is opt-in: a neural pass plus that one-time model download. It
sits inside the Content protection card shown further down this page.

## Trust anchors

Trusted verification is **live** - the pinned Lolly root ships as a real PEM in
`shells/web/src/ca-root.ts` (`CA_ROOT_PEM`, public by design) and is also served at
`/api/ca/root.pem`. The verifier additionally bundles the public C2PA/CAI trust
anchors (`engine/src/c2pa-trust.ts`) so third-party credentials (camera makers,
Adobe, Google's C2PA root, Truepic-signed OpenAI output, …) resolve to their real
issuer. Presence in a list never trusts on its own - a verdict of trusted requires
the chain to actually verify and no other check to fail.

## CA service (`services/ca/`)

Node (node:http + WebCrypto) with one runtime dependency, `jose`, which verifies
OIDC ID tokens. It imports `engine/src/x509.ts` and `engine/src/enrollment.ts`.
A workspace package. Runs four ways from one `handler.mjs`:

- `node services/ca/server.mjs` - local dev on `:8787` (Vite proxies
  `/api/ca` → `http://localhost:8787`; the string-shorthand proxy preserves
  the path, so the handler always routes on the full `/api/ca/*` prefix).
- A container image built from `deploy/docker/ca.Dockerfile` at the repo root,
  which runs the same `server.mjs` on `$PORT` (default 8787).
- `api/ca/[...path].js` at the **repo root** - a generated function bundle that
  imports the same handler, for hosts that run Node functions. (This bundle is
  generated by `scripts/build-ca-fn.ts`; CI rebuilds it and fails on drift - never
  hand-edit it.) The service worker bypasses `/api/`; the host must route
  `/api/ca/*` to the function ahead of the app's single-page fallback.
- Imported directly by `tests/ca-service.test.ts` (pure logic tested without
  a socket).

The service has two issuer modes. **Legacy root** (`CA_ISSUER_MODE=legacy-root`,
the default when no Vault setting is present) signs leaves itself with the root key
from the environment. **Managed** (`CA_ISSUER_MODE=vault-pki`) delegates issuance to a
Vault PKI intermediate, loads no root key, requires protocol version 2 and adds
CRL-based revocation. The [CA README](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md)
is the operator reference for both.

### Protocol

| Route | Purpose |
|---|---|
| `GET /api/ca/health` | Liveness plus `configured` - which OIDC providers this deployment actually has credentials for - and the issuer mode. The Settings view builds its provider buttons from it, so a deployment with no OIDC app says so instead of offering a button that would 501 |
| `GET /api/ca/root.pem` | The public Lolly root - for `c2patool --trust_anchors` and humans |
| `GET /api/ca/auth/:provider?origin=` | Start OIDC (`suse` \| `github` \| `google`); sets HMAC state cookie, redirects to provider |
| `GET /api/ca/callback/:provider` | Code exchange → verified email → mints a 10-min **enrollment token**; returns a tiny page that `postMessage`s the token to `origin` and closes |
| `POST /api/ca/email/start` `{email, origin, days?}` | Magic link via Resend; the link points at `/#/profile?enrollToken=…`. The current app offers no email enrolment button and does not read that token, so this route has no client today |
| `POST /api/ca/enroll` `{version, token, csr, spki, pop, days?}` | Verify token HMAC+expiry and proof of possession, then issue a leaf. Version 2 (what the app sends): a P-256 PKCS#10 CSR whose key matches `spki`, plus an ECDSA signature over the token and the CSR digest. Version 1 (legacy mode only): a signature over the token bytes. Legacy mode issues for `days` ∈ {7, 30, 90, 365} (anything else → `CA_CERT_DAYS`, capped at `CA_CERT_MAX_DAYS`); managed mode takes `lifetimeSeconds` up to the trust bundle's ceiling and has Vault sign the CSR → `{cert, chain, identity, notAfter}` (PEM) |
| `GET /api/ca/issuer/<id>/crl` | Managed mode: the configured issuer's full CRL, checked for signature, issuer and freshness before it is served |
| `POST /api/ca/revoke/challenge`, then `POST /api/ca/revoke` | Managed mode: device-authorised revocation. The service returns a single-use challenge for the presented certificate, the device signs it with the certificate's key, and the service revokes the certificate through Vault |

Notes:

- **Enrolment protocol v2.** The app sends an empty-subject P-256 PKCS#10 CSR
  and a proof-of-possession signature over the token and the CSR digest
  (`createEnrollmentCsr`, `verifyEnrollmentRequest` in `engine/src/enrollment.ts`).
  A CSR cannot choose its own identity or extensions: those come from the verified
  token and server policy. Legacy mode still accepts the original CSR-less v1
  request (raw SPKI plus a signature over the token) from older clients.
- **Token state.** Enrollment tokens are HMAC-signed values (email, provider,
  exp). In legacy mode there is no session store, and a replay within the
  10-minute window re-issues a cert for the same identity+key, which is harmless.
  Managed mode consumes each token's random identifier atomically in a shared
  admission store before calling Vault, so a token issues at most one certificate;
  a retry needs a fresh sign-in.
- **No issuance log.** The CA keeps no issuance log or identity inventory: no
  stdout line, no webhook, no certificate store. Rate-limit buckets in the shared
  store hold only hashed IP and email keys for their window, and managed mode's admission store
  keeps a keyed identifier and request digest for at most ten minutes. An issued
  cert exists only on the device that requested it. The cost is that misissuance
  can't be traced server-side; the mitigation is that leaves are short-lived and
  expire. Vault's revocation storage in managed mode can retain revoked
  certificate bytes, including the email (see the CA README). A public
  append-only transparency log - which records certificates, not identities -
  remains the Tier-3 upgrade.
- **Dev provider.** With `CA_DEV_FAKE_PROVIDER=1` (never set in prod), a
  `dev` provider authenticates instantly as `dev@example.com` so the full
  enroll→sign→verify loop is testable with zero OAuth secrets.

### Environment variables (set in the host's environment store → also `.env` for local)

| Var | What |
|---|---|
| `CA_ISSUER_MODE` | `legacy-root` (default when no `CA_VAULT_*` setting is present) or `vault-pki` |
| `CA_ROOT_KEY_PEM` | Legacy mode: PKCS8 PEM of the root private key (**the only secret that matters**). Managed mode loads no root key |
| `CA_ROOT_CERT_PEM` | PEM of the root cert (public, also committed) |
| `CA_RATE_LIMIT_REST_URL` / `CA_RATE_LIMIT_REST_TOKEN` | Shared HTTPS rate-limit store (or the `LOLLY_RATE_LIMIT_REST_*` pair). Without it, a hosted deployment answers sign-in and enrolment requests with 503 unless `CA_ALLOW_IN_MEMORY_RATE_LIMIT=1` |
| `CA_SERVICE_SECRET` | Random 32+ bytes; HMAC for state cookies + enrollment tokens |
| `CA_CERT_DAYS` | Default leaf lifetime in days when the client doesn't choose (default `30`) |
| `CA_CERT_MAX_DAYS` | Hard cap on any requested lifetime (default `365`) |
| `CA_ALLOWED_ORIGINS` | Comma list, e.g. `https://lolly.tools,http://localhost:5173` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth app |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client (web) |
| `SUSE_ISSUER` | Issuer URL of the OIDC provider behind the `suse` sign-in button (read through OIDC discovery) |
| `SUSE_CLIENT_ID` / `SUSE_CLIENT_SECRET` | That provider's OIDC client |
| `RESEND_API_KEY` / `EMAIL_FROM` | Email magic links |
| `CA_DEV_FAKE_PROVIDER` | `1` only in local dev |

Managed mode adds its Vault, trust-bundle and revocation settings (`CA_VAULT_*`,
`CA_ENROLLMENT_TRUST_JSON`); the CA README lists them.

## Web shell

Everything below surfaces as one card in the export panel: the C2PA switch (plus
its ephemeral lifetime picker), the pixel Imprint and the opt-in durable mark,
each gated per format by the predicates in `views/tool-actions.ts`.

![The Content protection card as the shell assembles it, with one switch per provenance mechanism rather than a single blanket toggle](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26options%26c2pa%3D90%26imprint%3D1&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-inputs%2C%23sidebar-utils%7Bdisplay%3Anone%7D&cropSelector=.export-protection&dark=1&filename=cc-export-protection)

- `shells/web/src/bridge/identity.ts` - the identity manager:
  `status()`, `enroll(provider)` (popup + postMessage + PoP + cert cache),
  `signer()` (null unless a valid cert is cached), `forget()`. Keypair and
  cert live in a dedicated IndexedDB store; CryptoKey objects structured-clone
  into IDB natively.
- Export path passes `signer` into `embedC2pa*` when available - one line at
  the existing call site; ephemeral fallback is the engine default.
- **Settings** has a **Content Credentials** section (the old `/profile` route
  still opens it): enrollment status ("Signing as andy@… via GitHub - renews
  Jul 10"), a button for each provider the deployment configures, Renew, Forget
  this device and, on a managed deployment, Revoke certificate.
- `/verify` passes the pinned root (plus the bundled public anchors) as
  `trustAnchors` and renders the trusted state: shield goes green-with-identity,
  facts show the verified email + issuer.

The enrolment card is where the certificate lifetime is chosen, before any popup
opens. The provider buttons are built from `/api/ca/health.configured`, so a
deployment that has wired up no OIDC app says so instead of offering a button that
would 501.

![The Content Credentials section of Settings, expanded from the link, on a deployment with no OIDC app wired up: one line says so in place of the lifetime picker and the provider buttons](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=1440&height=1400&dpi=192&waitMs=2600&format=svg&cropSelector=%23identity-section&walker=1&dark=1&filename=ce-identity-enrolment)

## Operator runbook (one-time setup - the parts only you can do)

These steps set up the legacy root mode. A managed (`vault-pki`) deployment holds no
root key in the service; follow the [CA README](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md#managed-intermediate-enrollment)
for it instead.

1. **Generate the root** (anywhere, then guard the key):

   ```bash
   node services/ca/scripts/gen-root.mjs   # writes lolly-root-cert.pem + lolly-root-key.pem
   ```

   Commit/paste `lolly-root-cert.pem` into `shells/web/src/ca-root.ts`.
   **Never commit the key.** Store it in a password manager, then set the
   following secrets in your platform's environment store (production scope):

   ```
   CA_ROOT_KEY_PEM       # paste the key PEM
   CA_ROOT_CERT_PEM
   CA_SERVICE_SECRET     # e.g. `openssl rand -hex 32`
   CA_ALLOWED_ORIGINS    # https://lolly.tools
   ```

2. **Register OIDC apps** (callback URL for all three:
   `https://lolly.tools/api/ca/callback/<provider>`; add the
   `http://localhost:8787/api/ca/callback/<provider>` variant for dev):
   - **GitHub** → Settings → Developer settings → OAuth Apps → New.
     Scope used: `user:email`. Set `GITHUB_CLIENT_ID`/`SECRET`.
   - **Google** → console.cloud.google.com → Credentials → OAuth client
     (Web). Scopes: `openid email`. Set `GOOGLE_CLIENT_ID`/`SECRET`.
   - **The `suse` provider (a Keycloak or other OIDC issuer)** → your issuer's
     admin → create an OIDC client (Web). Scopes: `openid email profile`. Set
     `SUSE_ISSUER` (the issuer from the app's OIDC discovery),
     `SUSE_CLIENT_ID`/`SECRET`.
   - **Email** → resend.com API key + verified sender → `RESEND_API_KEY`,
     `EMAIL_FROM`. The current app offers no email enrolment, so this step is
     optional.

3. **Set the env vars** in your platform's environment store (production
   scope, and add a preview/staging copy so preview deploys can exercise it):

   ```
   CA_ROOT_KEY_PEM       # paste the key PEM
   CA_ROOT_CERT_PEM
   CA_SERVICE_SECRET     # openssl rand -hex 32
   CA_ALLOWED_ORIGINS    # https://lolly.tools
   CA_RATE_LIMIT_REST_URL     # shared HTTPS rate-limit store
   CA_RATE_LIMIT_REST_TOKEN
   # …plus the provider creds from step 2. Do NOT set CA_DEV_FAKE_PROVIDER in prod.
   ```

4. **Deploy.** Choose one artifact: the container image built from
   `deploy/docker/ca.Dockerfile` at the repo root, or the generated function
   bundle `api/ca/[...path].js` (rebuild it with `pnpm run build:ca-fn`). Either
   way, route `/api/ca/*` to the CA ahead of the app's single-page fallback, so
   the fallback never answers those paths.
   Confirm it's live:
   `curl https://lolly.tools/api/ca/health` should return JSON
   (`{"ok":true,…}`), **not** the SPA's HTML. If it returns HTML, the request
   reached the app instead of the CA: check the routing.

5. **Local dev** (no secrets needed thanks to the dev provider):

   ```bash
   CA_DEV_FAKE_PROVIDER=1 CA_SERVICE_SECRET=dev node services/ca/server.mjs &
   pnpm run dev:web        # Vite proxies /api/ca → :8787
   ```

## Threat model (abridged)

- **Repo is public** → contains no secrets; root cert is public by design.
- **Device key theft** → key is non-extractable; even XSS can at worst *use*
  it while the page is open, bounded by the cert lifetime. In legacy mode,
  expiry is the only recall mechanism. Managed mode adds device-authorised
  revocation through the issuer's CRL, which reaches a client that was offline
  once its cached CRL expires.
- **CA key theft** → catastrophic for trust, as with any CA. Legacy mode keeps
  the root key in the host's environment store; managed mode is designed to keep
  the intermediate key in an HSM or KMS behind Vault, with the root offline, and
  the service never holds either key. Short leaf
  lifetimes bound how long any misissued certificate stays usable.
- **Fork abuse** → forks can request certs only through our OIDC-gated,
  origin-allowlisted, rate-limitable endpoint, and only for identities they
  actually control.
- **Token replay** → the enrolment token is a 10-minute HMAC, and
  proof-of-possession binds the *presented* keypair, not the browser that
  completed sign-in - so a token leaked inside its window yields a certificate
  for that identity to whoever holds it. In legacy mode the token is stateless,
  so this is an accepted risk bounded by the short window; flagged for the PKI
  review. Managed mode consumes each token once, so a leaked token is useless
  after the first enrolment.

## Roadmap

1. RFC 3161 timestamp countersignature in the same enroll/export round trip
   → the *expired* verdict becomes provable-time trusted.
2. Public append-only issuance transparency log (Rekor-shaped).
3. C2PA conformance program: audited KMS custody → the official trust list →
   green in Adobe Verify et al.

CLI signer support has **shipped**: `--sign-key=<key.pem> --sign-cert=<chain.pem>`,
with `$LOLLY_SIGN_KEY`/`$LOLLY_SIGN_CERT` (paths),
`$LOLLY_SIGN_KEY_PEM`/`$LOLLY_SIGN_CERT_PEM` (the PEM text itself, for CI secret
stores) and `$LOLLY_SIGN_KEY_PASSWORD` for an encrypted key. No flag ever takes
key material. See [Signing from the terminal](/info/cli-signing.html).

Organisation SSO, SCIM and sign-in for access to an instance belong to Lolly Work,
with a separate client and lifecycle from the CA's signing enrolment. See
[Set up enterprise identity](/info/work-enterprise-identity.html).
