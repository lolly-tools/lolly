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
> than trusting a pinned number here. Source line numbers are deliberately omitted
> below - grep the named symbol; offsets drift.

## Architecture

```
┌───────────── device (open source) ─────────────┐   ┌─ serverless function ─┐
│ WebCrypto P-256 keypair (non-extractable, IDB) │   │ /api/ca/* function     │
│ shells/web/src/bridge/identity.ts              │──▶│ services/ca/handler    │
│   enroll: popup OIDC → PoP → cert (cached)     │◀──│  - OIDC verify         │
│   signer(): {sign, chain} while cert valid     │   │  - PoP verify          │
│ export path: embedC2pa(..., {signer})          │   │  - X.509 issue (ES256) │
│ verify path: verifyC2pa(..., {trustAnchors})   │   │ CA key: env/KMS only   │
└────────────────────────────────────────────────┘   └────────────────────────┘
```

**Enrollment is app-level. Signing reached the bridge later, deliberately.**
No tool can start, observe or inspect enrolment: there is no `host.identity`,
the profile UI owns the flow and the ordinary export path consumes the signer
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

The consequence is worth stating rather than discovering: a hook that calls it
can put the user's CA-verified identity onto bytes of its own choosing. That is
the point of the API (the tool *is* the author here), so **tool review is the
control** - the same control that covers a `{{{x}}}` in a template. Two shipping
tools use it: `community/redact` and `community/claim`. The engine
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
  spkiDer,                                          // subject public key (CSR-less PoP flow)
  email, commonName, organization,                  // SAN rfc822Name + CN + O
  days,                                             // enrollment default 30
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
  `report.signer.identity = { email, issuer }`. The view resolves this to
  **Verified** (or **Delivered by Lolly** when the active claim is a
  `c2pa.published` rather than `c2pa.created` action).
- Chain verifies but leaf outside validity → the `expired` verdict; the identity
  is still set (it was CA-verified), but `report.trusted` stays false.
- Intact Lolly claim → `report.madeWithLolly` (**Made with Lolly**); an intact
  claim whose bytes fail only the hard binding → `report.likelyMadeWithLolly`
  (amber **Likely made with Lolly**).
- No anchors / no chain to an anchor → anonymous-but-valid ("Credential intact").

### CLI

`lolly validate <file> [--json] [--deep] [--trust-anchor <root.pem>] [--no-default-anchors]` -
same verifier, same report; `--trust-anchor` loads PEM → DER and appends to
`trustAnchors`, and `--deep` adds the neural pixel-watermark scan (browser tier). The default anchor set is the **Lolly CA root plus the vendored C2PA
known-certificate list**, identical to the web `/valid` view and to MCP's `lolly_verify`
([plans/73-cli-ga-contract.md](https://github.com/lolly-tools/lolly/blob/main/plans/73-cli-ga-contract.md), section 12 O1) - so a Lolly-CA-signed export reads the same on every
surface. `--no-default-anchors` drops both built-in sets for a bare-trust check, and
every report prints which set produced the verdict.

## Beyond C2PA: pixel- and byte-level verify reads

The web `/verify` view runs several checks *around* the credential. Each is a pure,
DOM-free engine (or shell-lib) module fed a decoded RGBA buffer or the raw file
bytes by the shell; none is a bridge capability, and none uploads anything - the
deep-scan model download (same-origin, opt-in, one-time) is the only network touch,
and it never sends the file. The web shell deliberately passes **no SEAL key
resolver** - a DNS-published key reports "no key resolver" instead of being fetched
through a third-party DoH service; the Node shells (CLI/TUI/desktop) resolve keys
through the machine's own DNS.

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
re-encoding/stripping, framed exactly like the self-signed on-device C2PA key
(`plans/30-lollys-own-synth.md`). The shell embeds it two ways: the standalone raster
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
resolver is optional and shell-supplied: **the web shell deliberately passes none**
(zero network requests - a DNS-keyed record reports "no key resolver" there), while
the Node shells (CLI/TUI/desktop) can supply one backed by the machine's own system
DNS. **This is a byte-signature format - not a pixel watermark, and NOT Meta's
Content Seal despite the shared word.** A key resolved from DNS yields domain
attribution (`Signed by <domain> (SEAL)`, proving domain control, not a CA-verified
legal identity); a key the file itself carries yields an
internally-consistent-but-unattributed result. In the web app there is no network
touch at all; in the Node shells the only network touch is a system-DNS key lookup -
the file never leaves the device either way.

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

Zero-dependency Node (node:http + WebCrypto), importing `engine/src/x509.ts`.
A workspace package. Runs three ways from one `handler.mjs`:

- `node services/ca/server.mjs` - local dev on `:8787` (Vite proxies
  `/api/ca` → `http://localhost:8787`; the string-shorthand proxy preserves
  the path, so the handler always routes on the full `/api/ca/*` prefix).
- `api/ca/[...path].js` at the **repo root** - a serverless function entry that
  imports the same handler. (This bundle is generated by
  `scripts/build-ca-fn.ts`; CI rebuilds it and fails on drift - never hand-edit
  it.) The service worker bypasses `/api/`, and the platform serves functions
  before rewrites, so the SPA catch-all never swallows it.
- Imported directly by `tests/ca-service.test.ts` (pure logic tested without
  a socket).

### Protocol

| Route | Purpose |
|---|---|
| `GET /api/ca/health` | Liveness plus `configured` - which OIDC providers this deployment actually has credentials for. The profile view builds its provider buttons from it, so a deployment with no OIDC app says so instead of offering a button that would 501 |
| `GET /api/ca/root.pem` | The public Lolly root - for `c2patool --trust_anchors` and humans |
| `GET /api/ca/auth/:provider?origin=` | Start OIDC (`suse` \| `github` \| `google`); sets HMAC state cookie, redirects to provider |
| `GET /api/ca/callback/:provider` | Code exchange → verified email → mints a 10-min **enrollment token**; returns a tiny page that `postMessage`s the token to `origin` and closes |
| `POST /api/ca/email/start` `{email, origin, days?}` | Magic link via Resend; the link returns the user to the app (`/#/profile?enrollToken=…`), which finishes enrollment via the normal `POST /api/ca/enroll` PoP exchange |
| `POST /api/ca/enroll` `{token, spki, pop, days?}` | Verify token HMAC+expiry, verify PoP (ECDSA over the token bytes with the presented SPKI), issue a leaf valid for `days` ∈ {7, 30, 90, 365} (anything else → `CA_CERT_DAYS`, capped at `CA_CERT_MAX_DAYS`) → `{cert, chain, identity, notAfter}` (PEM) |

Notes:

- **CSR-less enrollment.** The client sends its raw SPKI plus a
  proof-of-possession signature over the enrollment token instead of a
  PKCS#10 CSR - same soundness, no ASN.1 CSR parser server-side.
- **Stateless.** Enrollment tokens are HMAC-signed values (email, provider,
  exp) - no session store. Replay within the 10-minute window re-issues a
  cert for the same identity+key, which is harmless.
- **No issuance log.** The CA retains nothing about who enrolled: no stdout
  line, no webhook, no store. An issued cert exists only on the device that
  requested it. The cost is that misissuance can't be traced server-side; the
  mitigation is that leaves are short-lived and expire. A public append-only
  transparency log - which records certificates, not identities - remains the
  Tier-3 upgrade.
- **Dev provider.** With `CA_DEV_FAKE_PROVIDER=1` (never set in prod), a
  `dev` provider authenticates instantly as `dev@example.com` so the full
  enroll→sign→verify loop is testable with zero OAuth secrets.

### Environment variables (set in the host's environment store → also `.env` for local)

| Var | What |
|---|---|
| `CA_ROOT_KEY_PEM` | PKCS8 PEM of the root private key (**the only secret that matters**) |
| `CA_ROOT_CERT_PEM` | PEM of the root cert (public, also committed) |
| `CA_SERVICE_SECRET` | Random 32+ bytes; HMAC for state cookies + enrollment tokens |
| `CA_CERT_DAYS` | Default leaf lifetime in days when the client doesn't choose (default `30`) |
| `CA_CERT_MAX_DAYS` | Hard cap on any requested lifetime (default `365`) |
| `CA_ALLOWED_ORIGINS` | Comma list, e.g. `https://lolly.tools,http://localhost:5173` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth app |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Google OAuth client (web) |
| `SUSE_ISSUER` | `https://id.suse.com` (Keycloak OIDC discovery) |
| `SUSE_CLIENT_ID` / `SUSE_CLIENT_SECRET` | id.suse.com OIDC app |
| `RESEND_API_KEY` / `EMAIL_FROM` | Email magic links |
| `CA_DEV_FAKE_PROVIDER` | `1` only in local dev |

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
- `/profile` gains a **Content Credentials** section: enrollment status
  ("Signing as andy@… via GitHub - renews Jul 10"), four provider buttons,
  and Forget this device.
- `/verify` passes the pinned root (plus the bundled public anchors) as
  `trustAnchors` and renders the trusted state: shield goes green-with-identity,
  facts show the verified email + issuer.

The enrolment card is where the certificate lifetime is chosen, before any popup
opens. The provider buttons are built from `/api/ca/health.configured`, so a
deployment that has wired up no OIDC app says so instead of offering a button that
would 501.

![The Content Credentials section of Profile, expanded from the link, with the 7 / 30 / 90 / 365 day certificate lifetime picker above the provider row, which on a deployment with no OIDC app wired up says so instead of offering a button](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=1440&height=1400&dpi=192&waitMs=2600&format=svg&cropSelector=%23identity-section&walker=1&dark=1&filename=ce-identity-enrolment)

## Operator runbook (one-time setup - the parts only you can do)

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
   - **id.suse.com (Keycloak)** → your Keycloak admin → create an OIDC client
     (Web). Scopes: `openid email profile`. Set `SUSE_ISSUER`
     (the issuer from the app's OIDC discovery), `SUSE_CLIENT_ID`/`SECRET`.
   - **Email** → resend.com API key + verified sender → `RESEND_API_KEY`,
     `EMAIL_FROM`.

3. **Set the env vars** in your platform's environment store (production
   scope, and add a preview/staging copy so preview deploys can exercise it):

   ```
   CA_ROOT_KEY_PEM       # paste the key PEM
   CA_ROOT_CERT_PEM
   CA_SERVICE_SECRET     # openssl rand -hex 32
   CA_ALLOWED_ORIGINS    # https://lolly.tools
   # …plus the provider creds from step 2. Do NOT set CA_DEV_FAKE_PROVIDER in prod.
   ```

4. **Deploy.** The CA lives at repo-root `api/ca/[...path].js` (a serverless
   function) importing `services/ca/` + `engine/src/x509.ts`; both are
   committed, and the platform compiles `api/` independently of the Vite build.
   The app's catch-all rewrite `"/((?!api/).*)" → /index.html` excludes `/api/`
   by pattern (and functions are served before rewrites anyway), so `/api/ca/*`
   resolves to the function first - it is **not** swallowed by the SPA fallback.
   Confirm it's live:
   `curl https://lolly.tools/api/ca/health` should return JSON
   (`{"ok":true,…}`), **not** the SPA's HTML. If it returns HTML, the function
   wasn't compiled - check the project's **root directory** setting is the repo
   root (so repo-root `api/` is in scope), not `shells/web`.

5. **Local dev** (no secrets needed thanks to the dev provider):

   ```bash
   CA_DEV_FAKE_PROVIDER=1 CA_SERVICE_SECRET=dev node services/ca/server.mjs &
   pnpm run dev:web        # Vite proxies /api/ca → :8787
   ```

## Threat model (abridged)

- **Repo is public** → contains no secrets; root cert is public by design.
- **Device key theft** → key is non-extractable; even XSS can at worst *use*
  it while the page is open, bounded by the cert lifetime. Expiry is the only
  recall mechanism - there is no revocation infrastructure, by design.
- **CA key theft** → catastrophic for trust, as with any CA; mitigations:
  env-only storage now, KMS/HSM at Tier 4 and short leaf lifetimes bound how
  long any misissued certificate stays usable (there is no revocation to miss).
- **Fork abuse** → forks can request certs only through our OIDC-gated,
  origin-allowlisted, rate-limitable endpoint, and only for identities they
  actually control.
- **Token replay** → the enrolment token is a stateless 10-minute HMAC, and
  proof-of-possession binds the *presented* keypair, not the browser that
  completed sign-in - so a token leaked inside its window yields a certificate
  for that identity to whoever holds it. Accepted risk, bounded by the short
  window; flagged for the PKI review.

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

### SSO - two distinct jobs, one identity provider

id.suse.com (Keycloak) shows up in **two** places that must not be conflated.
Both reuse the same OIDC client, but they answer different questions. Detailed
implementation plans (local, under `plans/`): **`plans/32-sso-signing.md`** and
**`plans/33-sso-tool-access.md`** - the summaries below are the roadmap view.

4. **Complete SUSE SSO for *signing*** (deepens the identity in this doc -
   "who signed"; full plan → `plans/32-sso-signing.md`). Today SUSE is one
   enrolment provider among several and each enrolment is a fresh popup. Bring
   it to true SSO:
   - **Session reuse / silent renewal.** While the id.suse.com session is
     live, a cert nearing expiry re-issues in the background via OIDC
     `prompt=none` - no weekly popup, no interaction. This is what makes short
     (7-day) certs painless and is the natural companion to Tier 3 timestamps.
   - **Org / domain enforcement.** Optional issuance policy
     (`CA_REQUIRE_ISSUER=suse`, `CA_ALLOWED_EMAIL_DOMAINS=suse.com`) so a SUSE
     deployment mints certs only for SUSE identities, and SUSE becomes the
     default IdP (other providers opt-in).
   - **Richer provenance identity.** Carry the SSO group / role / org-unit into
     the certificate (an OU or SAN otherName) so a credential can attest
     "signed by a SUSE employee," not just an email - gated on the realm
     releasing those claims. Feeds the CreativeWork author assertion.

5. **SSO for *tool access*** (a NEW authorization axis - "who may use the
   app," separate from signing; full plan → `plans/33-sso-tool-access.md`). Gate
   who can open the app, specific tools, or gated features behind SUSE SSO:
   - **Shell-level auth guard, never the engine.** The engine stays
     platform-agnostic; access control is a host/shell concern. The web shell
     gains an auth gate in front of the gallery/tool routes, configurable as
     fully-gated, or per-tool / per-capability (a `tool.json` `access` policy
     the host enforces, mirroring how `capabilities` gate today).
   - **One IdP, two purposes.** Reuse the same id.suse.com/Keycloak OIDC the CA
     uses, so a signed-in user is already enrol-ready for signing; sign-in for
     *access* and identity for *signing* share a session.
   - **Session handling.** A lightweight `/api/auth/*` companion to `/api/ca/*`
     on the same serverless deployment (httpOnly session cookie, PKCE, refresh),
     with role/group-based tool visibility.
   - **OSS-safe by default.** Access-gating is deployment policy: **off** in the
     open-source build so public lolly.tools stays open, enabled only by
     configuration so a SUSE-internal deployment can lock it down. Keep it out
     of `engine/` and behind a shell config flag so the open-sourcing split
     stays clean.
