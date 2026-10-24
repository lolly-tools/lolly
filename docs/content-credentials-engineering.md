# Content Credentials engineering

This page is for engineers and operators who integrate, audit or deploy Lolly's signing path. It covers how a device key becomes a verified signer, the engine contracts behind signing and verifying, the CA service and its protocol and the threat model.

For what a reader sees, start with [Content Credentials](/info/content-credentials-identity.html) and [What Verify checks](/info/what-verify-checks.html). To deploy the CA, the canonical runbook is the [CA README](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md).

::: note Versions and line numbers
CA-issued signing first shipped at engine 1.11, and the capability bridge only grows, so everything here still holds. The verifier reads C2PA 1.x and 2.x claims, Lolly writes 2.x by default, and the trust list bundles the public C2PA and CAI anchors beside the Lolly root. Read the live `ENGINE_VERSION` in `engine/src/version.ts` and `engine/CHANGELOG.md` rather than a number pinned here. Source line numbers are left out because they drift: search for the named symbol.
:::

## Architecture

![From device key to verified signer: the device holds a non-extractable key, the person signs in with a provider that verifies their email, and the CA service checks a CSR and proof of possession. A legacy root or a managed Vault intermediate signs a short-lived certificate kept on the device, which signs each export; a verifier checks the export against pinned trust anchors, and in managed mode against the revocation list.](/info/diagrams/concepts/signing-architecture.svg)

The device generates a WebCrypto P-256 keypair, non-extractable, kept in IndexedDB (`shells/web/src/bridge/identity.ts`). To enrol, it opens the provider's sign-in in a popup, sends a CSR with a proof of possession to the CA, and caches the certificate it gets back. While that certificate is valid, `signer()` returns `{ sign, chain }`, the export path calls `embedC2pa(…, { signer })` and the verify path calls `verifyC2pa(…, { trustAnchors })`. The CA's key lives in the host's environment store, or behind Vault in managed mode.

**Enrolment belongs to the app; signing reached the bridge later.** No tool can start, observe or inspect enrolment. There is no `host.identity`: the Settings view owns the flow, and the ordinary export path uses the signer inside the shell's own export code.

What *is* on the bridge is `host.c2pa.sign` (v1.85, widened in v1.104). It is optional and additive, and **not** gated by a `capabilities` flag, so a tool feature-detects `host.c2pa?.sign`. It exists for the case where the tool, not the export pipeline, authors the output file: a redaction that must ship as a new work rather than carry the unredacted original as an ingredient, or an authorship claim stamped onto a file the person brought in.

It routes to the shell's `signFreshC2pa`, which asks `host.identity.signer()` first. So **it signs with the enrolled identity when a valid certificate is cached**, and falls back to the ephemeral key otherwise. Everything stays on the device.

A hook that calls it can therefore put the person's CA-verified identity onto bytes of its own choosing. That is the point of the API, because the tool *is* the author here, so **tool review is the control**: the same control that covers a `{{{x}}}` in a template. Four shipping tools call `host.c2pa.sign`: `community/redact`, `community/claim`, `community/sign` and `community/rondocode`.

Its companion `host.c2pa.readIngredients` (v1.104) reads every manifest a file already carries and packages each one as an ingredient, so a tool that signs an existing file carries those credentials forward instead of orphaning them. `claim`, `sign` and `rondocode` use the companion too. The engine side stays ordinary options (`opts.signer`, `opts.trustAnchors`) on existing pure functions.

## Why the certificate identifies a person, not the app

Lolly's engine and shells are open source. Once the code is public, "made with Lolly" can never be a *cryptographic* claim: anyone can fork the repository and emit bit-identical manifests. No certificate scheme fixes that, because the thing being attested, the software, is copyable by design.

So the certificate attests **who signed, not which app signed**. Its Subject Alternative Name carries the OIDC-verified email. A fork cannot impersonate a Lolly user. It can only obtain certificates for its own users under this issuance policy, or run its own CA, whose root is not the Lolly root. The "Lolly" generator name in the manifest stays self-asserted, and Verify keeps that distinction: "Made with Lolly" is the maker's claim, while "Verified" is the cryptographic one.

This follows Kerckhoffs's principle as Sigstore's Fulcio and Let's Encrypt practise it: **the repository holds no secrets, only protocol and public anchors.** The CA certificate is public, committed and served. The CA private key lives only in the host's environment store or a KMS. The device key is generated locally and cannot be exported.

## Engine contracts

`HostV1` grows only by addition, and `host.c2pa` is its one surface near identity. The modules underneath are these.

### `engine/src/x509.ts`: DER and X.509

A pure module shared by the ephemeral path, the CA service and the tests. No DOM, `globalThis.crypto` only. It owns the DER writer helpers (`der`, `derSeq`, `derSet`, `derOctet`, `derUint`, `derOid`, `derTime`, `ecdsaRawToDer`) and `generateSigner`. `c2pa.ts` re-imports them with **byte-identical output**, so the existing C2PA test suite is the regression harness. It also exports:

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

**The leaf profile must stay compatible with c2pa-rs**, which hard-fails otherwise. The subject MUST carry an `O=` attribute. The EKU MUST be id-kp-emailProtection (`1.3.6.1.5.5.7.3.4`); anyEKU is rejected. keyUsage is digitalSignature, critical. SKI and AKI are present, and the SAN rfc822Name is the verified email. The serial is random, with the ephemeral path's stable-width trick.

### `engine/src/c2pa.ts`

`embedC2pa(bytes, format, opts)` and `embedC2paInPdf(bytes, opts)` take one optional `signer`. `buildC2paManifest` already threads it, and the embedders use `opts.signer ?? await generateSigner(dates)`:

```js
opts.signer = {
  privateKey,                        // CryptoKey (P-256, 'sign') - the normal device path
  // OR sign: async (sigStructureBytes) => Uint8Array(64)  // raw r||s, NOT DER
  certDer,                           // leaf DER (back-compat single-cert shape)
  chain,                             // Uint8Array[] leaf-first - wins over certDer in x5chain
}
```

Inside the COSE signing step, the x5chain (label 33) becomes `signer.chain ?? [signer.certDer]`, and the sign call becomes `signer.sign ? await signer.sign(sigStructure) : subtle.sign(…, signer.privateKey, sigStructure)`.

Two passes stay safe: the chain bytes are captured once per embed, so they are byte-identical across passes; ES256 signatures are a fixed 64 bytes; and the algorithm stays hard-coded at −7, **P-256 only** by contract. `sign()` runs several times per embed (a probe, fixed-point rounds and pass 2). That is fine for a WebCrypto key; a future key that needs a person present would need dummy probe signatures.

### `engine/src/c2pa-verify.ts`

```js
verifyC2pa(bytes, { trustAnchors } = {})   // trustAnchors: Uint8Array[] (root cert DER)
```

With no options the behaviour stays byte-identical, and contract tests guard that. With anchors supplied, it captures the full x5chain and verifies that the leaf is signed by an anchor: the issuer name's DER bytes match the anchor's subject bytes, and a signature check over the leaf's tbsCertificate uses the anchor's SPKI.

`parseCertificate` is extended **additively** (tbsBytes, rawSignature, issuer and subject bytes, SAN emails, signature algorithm), and existing fields are unchanged. It reads both `c2pa.claim` and `c2pa.claim.v2` (with `created_assertions`, `gathered_assertions` and `c2pa.actions.v2`). Multi-algorithm chains (ECDSA P-256, P-384 and P-521, RSA PKCS#1 v1.5, RSA-PSS, Ed25519) walk an arbitrary but bounded depth to a pinned anchor.

How the report becomes the verdict the `/verify` view shows:

- **Chain verifies and the leaf is inside its validity.** `report.trusted = true` and `report.signer.identity = { email, issuer }`. When the claim records a Lolly export, the headline stays **Made with Lolly** and the view adds a "Signed by \<email\> - identity verified by \<issuer\>" line. Otherwise the view resolves this to **Verified**, or **Delivered by Lolly** when the active claim is a `c2pa.published` rather than a `c2pa.created` action.
- **Managed deployment.** `verifyC2pa` also takes `enrollmentTrust` (the public trust bundle) and `enrollmentCrls`. A managed chain is trusted only when its issuer's revocation list is fresh and does not list the leaf (`validateManagedCredential` in `engine/src/enrollment.ts`).
- **Chain verifies but the leaf is outside its validity.** The `expired` verdict. The identity is still set, because it was CA-verified, but `report.trusted` stays false.
- **An intact Lolly claim.** `report.madeWithLolly` (**Made with Lolly**). An intact claim whose bytes fail only the hard binding gives `report.likelyMadeWithLolly` (amber **Likely made with Lolly**).
- **No anchors, or no chain to one.** Anonymous but valid: **Credential intact**.

### `engine/src/enrollment.ts`

The enrolment protocol, the managed chain and the revocation list, shared by the app, the CA service and the verifier. `createEnrollmentCsr` builds the app's empty-subject P-256 PKCS#10 CSR, and `enrollmentProofMessage` is the message its proof of possession signs. The CA checks both with `verifyEnrollmentRequest`. For managed mode, `validateEnrollmentChain` checks an issued chain against its enrolment policy (pinned issuer and roots, email, policy OID and maximum lifetime), `validateEnrollmentCrl` checks a revocation list's signature, issuer and age, and `validateManagedCredential` combines them with the parsed trust bundle (`parseEnrollmentTrustBundle`) for the verifier. `revocationProofMessage` is what a device signs to revoke its own certificate.

### `lolly validate`

`lolly validate <file…> [--json] [--metadata] [--deep] [--rebuild=<session.lolly>] [--require=credential|none] [--trust-anchor=<root.pem>] [--no-default-anchors]` runs the same verifier and prints the same report.

- `--trust-anchor=` loads a PEM, converts it to DER and appends it to `trustAnchors`. It can repeat, and like every value flag it rejects the bare `--trust-anchor <root.pem>` form.
- `--metadata` adds the embedded-metadata and hidden-data report.
- `--deep` adds the neural pixel-watermark scan, which needs the browser tier.

The default anchor set is the **Lolly CA root plus the vendored C2PA known-certificate list**, the same as the web Verify view and MCP's `lolly_verify`, so a Lolly-CA-signed export reads the same on every surface. `--no-default-anchors` drops both built-in sets for a bare-trust check, and every report prints which set produced the verdict.

## Beyond C2PA: pixel and byte level Verify reads

The Verify view runs several checks around the credential, described for readers on [What Verify checks](/info/what-verify-checks.html). Each is a pure, DOM-free module in the engine or a shell library, fed a decoded RGBA buffer or the raw file bytes by the shell. None is a bridge capability, and none uploads anything. The opt-in deep scan's one-time model download is the only network touch, from the same origin on the web and from the model host `lolli.li` in the desktop and mobile apps, and it never sends the file.

Each read has its own surface in the view, catalogued in the component library next to the source that defines each surface. Here is the verdict-hero entry, with the verdict states it covers and the `valid.ts` source behind them:

![The component-library entry for the verify hero - the verdict states it covers (Made with Lolly, Verified, broken) beside the valid.ts source that defines them](/t/url-shot?url=%2F%23%2Fcomponents&width=1200&height=1400&dpi=192&waitMs=2400&walker=1&format=svg&cropSelector=%23cl-verify-valid%20.cl-card&dark=1&filename=ce-verify-card)

### `engine/src/pixel-watermark.ts`: the Lolly Imprint

A block-DCT spread-spectrum watermark (Cox, Kilian, Leighton and Shamoon) on the same 8×8 grid JPEG's own DCT uses, so it survives recompression. `embedWatermark(rgba, opts)` adds a fixed ±1 chip to mid-band luma coefficients, scaled by a perceptual mask. `detectWatermark(rgba, {width, height})` correlates and returns a presence score (`DetectResult`). `canCarryWatermark(w, h)` rules out images too small to hold the mark (`MIN_IMPRINT_BLOCKS`). It records presence only, with no payload.

**Its security rests on obscurity, not a hardened defence.** The chip key ships in this public source, so someone who reads it can subtract the mark. It is honest cover against casual re-encoding and stripping, framed exactly like the self-signed on-device C2PA key.

The shell embeds it two ways: through the standalone raster encoders' `opts.imprint` branch, and through `imprintEmbedCanvas`, which bakes the mark into each Lolly-rendered raster as it is composited into a PDF page or PPTX slide. A pure-vector page marks nothing, and the C2PA claim depends on whether a mark was actually applied, so it never over-claims. On by default; `?imprint=0` opts out.

### `engine/src/steganalysis.ts`: LSB chi-square

`analyzeLsb(rgba, {width, height})` runs a chi-square test on pixel-pair LSB statistics and returns a likelihood that the image hides LSB-embedded data. It is a heuristic, shown in amber and never as a cryptographic verdict. The view renders it as an `LSB steganography likely` pip plus an `LSB analysis` metadata row.

### `engine/src/file-metadata.ts`: appended payloads

`extractFileMetadata(bytes)` reads EXIF, XMP and IPTC. For provenance, it also detects bytes appended *after* a container's real end (PNG `IEND`, JPEG `EOI`, GIF trailer, APNG) and returns them as an `appended` field. The view renders that with a view and a download of the extracted bytes, shown only as escaped hex or text and never parsed or executed. A declared append, such as a motion photo's video, is recognised and shown without a warning. The read needs only bytes, so MCP shows the same `appended` field in its metadata output, without the interactive extractor.

### `engine/src/seal.ts`: SEAL signatures

`verifySeal(bytes, resolveKey?)` parses a hackerfactor [SEAL](https://github.com/hackerfactor/SEAL) record and verifies its signature over the covered byte ranges. The `resolveKey` resolver is optional and supplied by the shell. **The Verify view passes none**, so it makes no network request and a DNS-keyed record reports "no key resolver". It is the only caller today: `lolly validate`, the TUI and MCP do not check SEAL.

**SEAL is a byte-signature format, not a pixel watermark and not Meta's Content Seal, despite the shared word.** A key the file itself carries gives an internally consistent but unattributed result. A key resolved from DNS would give domain attribution (`Signed by <domain> (SEAL)`, proving control of the domain, not a CA-verified legal identity), but no shell supplies a resolver yet.

### Deep scan: `trustmark.ts` and `contentseal.ts`

Two open pixel-watermark decoders behind a one-time consent: about 90 MB of detector models, offered by one banner per batch, after which the scan runs on each file without asking again (`shells/web/src/lib/trustmark.ts` and `contentseal.ts`, with `engine/src/contentseal.ts` for the DOM-free decode maths). TrustMark is a real decode checked by error correction. Content Seal has no error-correcting check, so it reports an amber statistical "likely", always with the caveat that Meta's proprietary Muse variant is a different watermark. [What Verify checks](/info/what-verify-checks.html#deep-scan-trustmark-and-content-seal) has the reader's detail.

TrustMark's *write* side is one switch in the export panel, off by default for the same reason its scan is opt-in: a neural pass plus that one-time model download. It sits in the Content protection card shown below.

## Trust anchors

Trusted verification is live. The pinned Lolly root ships as a real PEM in `shells/web/src/ca-root.ts` (`CA_ROOT_PEM`, public by design) and is also served at `/api/ca/root.pem`. The verifier also bundles the public C2PA and CAI trust anchors (`engine/src/c2pa-trust.ts`), so third-party credentials (camera makers, Adobe, Google's C2PA root, Truepic-signed OpenAI output and others) resolve to their real issuer. Presence in a list never trusts on its own: a trusted verdict needs the chain to actually verify and no other check to fail.

## CA service (`services/ca/`)

Node (node:http and WebCrypto), with one runtime dependency, `jose`, which verifies OIDC ID tokens. It imports `engine/src/x509.ts` and `engine/src/enrollment.ts`, and it is a workspace package. One `handler.mjs` runs four ways:

- `node services/ca/server.mjs` for local development on `:8787`. Vite proxies `/api/ca` to `http://localhost:8787`; the string-shorthand proxy keeps the path, so the handler always routes on the full `/api/ca/*` prefix.
- A container image built from `deploy/docker/ca.Dockerfile` at the repository root, running the same `server.mjs` on `$PORT` (default 8787).
- `api/ca/[...path].js` at the repository root: a generated function bundle that imports the same handler, for hosts that run Node functions. `scripts/build-ca-fn.ts` generates it and CI fails on drift, so never edit it by hand. The service worker bypasses `/api/`, so the host must route `/api/ca/*` to the CA ahead of the app's single-page fallback.
- Imported directly by `tests/ca-service.test.ts`, which tests the logic without a socket.

The service has two issuer modes. **Legacy root** (`CA_ISSUER_MODE=legacy-root`, the default when no Vault setting is present) signs leaves itself, with the root key from the environment. **Managed** (`CA_ISSUER_MODE=vault-pki`) hands issuance to a Vault PKI intermediate, loads no root key, requires protocol version 2 and adds revocation through revocation lists.

### Protocol

| Route | Purpose |
|---|---|
| `GET /api/ca/health` | Liveness plus `configured` (which OIDC providers this deployment actually has credentials for) and the issuer mode. The Settings view builds its provider buttons from this, so a deployment with no OIDC app says so instead of offering a button that would return 501 |
| `GET /api/ca/root.pem` | The public Lolly root, for `c2patool --trust_anchors` and for people |
| `GET /api/ca/auth/:provider?origin=` | Starts OIDC (`suse`, `github` or `google`): sets an HMAC state cookie and redirects to the provider |
| `GET /api/ca/callback/:provider` | Code exchange, then the verified email, then a 10-minute **enrolment token**. Returns a tiny page that `postMessage`s the token to `origin` and closes |
| `POST /api/ca/email/start` `{email, origin, days?}` | Magic link through Resend; the link points at `/#/profile?enrollToken=…`. The current app offers no email enrolment button and does not read that token, so this route has no client today |
| `POST /api/ca/enroll` `{version, token, csr, spki, pop, days?}` | Verifies the token's HMAC and expiry and the proof of possession, then issues a leaf. Version 2 (what the app sends): a P-256 PKCS#10 CSR whose key matches `spki`, plus an ECDSA signature over the token and the CSR digest. Version 1 (legacy mode only): a signature over the token bytes. Legacy mode issues for `days` in {7, 30, 90, 365} (anything else gets `CA_CERT_DAYS`, capped at `CA_CERT_MAX_DAYS`). Managed mode takes `lifetimeSeconds` up to the trust bundle's ceiling and has Vault sign the CSR. Returns `{cert, chain, identity, notAfter}` as PEM |
| `GET /api/ca/issuer/<id>/crl` | Managed mode: the configured issuer's full revocation list, checked for signature, issuer and freshness before it is served |
| `POST /api/ca/revoke/challenge`, then `POST /api/ca/revoke` | Managed mode: revocation authorised by the device. The service returns a single-use challenge for the presented certificate, the device signs it with the certificate's key, and the service revokes the certificate through Vault |

- **Enrolment protocol v2.** The app sends an empty-subject P-256 PKCS#10 CSR and a proof-of-possession signature over the token and the CSR digest. A CSR cannot choose its own identity or extensions: those come from the verified token and server policy. Legacy mode still accepts the original v1 request without a CSR (raw SPKI plus a signature over the token) from older clients.
- **Token state.** Enrolment tokens are HMAC-signed values (email, provider, expiry). In legacy mode there is no session store, and a replay within the 10-minute window re-issues a certificate for the same identity and key, which is harmless. Managed mode consumes each token's random identifier atomically in a shared admission store before calling Vault, so a token issues at most one certificate and a retry needs a fresh sign-in.
- **No issuance log.** The CA keeps no issuance log or identity inventory: no stdout line, no webhook, no certificate store. Rate-limit buckets in the shared store hold only hashed IP and email keys for their window, and managed mode's admission store keeps a keyed identifier and request digest for at most ten minutes. An issued certificate exists only on the device that requested the certificate. The cost is that misissuance cannot be traced on the server; the mitigation is that leaves are short-lived. Vault's revocation storage in managed mode can keep revoked certificate bytes, including the email (see the CA README). A public append-only transparency log, which records certificates rather than identities, remains on the roadmap.
- **Development provider.** With `CA_DEV_FAKE_PROVIDER=1`, never set in production, a `dev` provider signs in instantly as `dev@example.com`, so the full enrol, sign and verify loop is testable with no OAuth secrets.

::: details Environment variables
Set these in the host's environment store, and in `.env` for local work.

| Variable | What |
|---|---|
| `CA_ISSUER_MODE` | `legacy-root` (the default when no `CA_VAULT_*` setting is present) or `vault-pki` |
| `CA_ROOT_KEY_PEM` | Legacy mode: the PKCS8 PEM of the root private key, **the only secret that matters**. Managed mode loads no root key |
| `CA_ROOT_CERT_PEM` | The root certificate's PEM (public, also committed) |
| `CA_RATE_LIMIT_REST_URL` / `CA_RATE_LIMIT_REST_TOKEN` | The shared HTTPS rate-limit store (or the `LOLLY_RATE_LIMIT_REST_*` pair). Without it, a hosted deployment answers sign-in and enrolment requests with 503 unless `CA_ALLOW_IN_MEMORY_RATE_LIMIT=1` |
| `CA_SERVICE_SECRET` | Random, 32 bytes or more: the HMAC key for state cookies and enrolment tokens |
| `CA_CERT_DAYS` | The default leaf lifetime in days when the client does not choose (default `30`) |
| `CA_CERT_MAX_DAYS` | The hard cap on any requested lifetime (default `365`) |
| `CA_ALLOWED_ORIGINS` | A comma list, such as `https://lolly.tools,http://localhost:5173` |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | The GitHub OAuth app |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | The Google OAuth client (web) |
| `SUSE_ISSUER` | The issuer URL of the OIDC provider behind the `suse` provider id, read through OIDC discovery |
| `SUSE_CLIENT_ID` / `SUSE_CLIENT_SECRET` | That provider's OIDC client |
| `RESEND_API_KEY` / `EMAIL_FROM` | Email magic links |
| `CA_DEV_FAKE_PROVIDER` | `1` only in local development |

Managed mode adds its Vault, trust-bundle and revocation settings (`CA_VAULT_*`, `CA_ENROLLMENT_TRUST_JSON`), which the CA README lists.
:::

## Web shell

Everything below appears as one card in the export panel: the C2PA switch with its ephemeral lifetime picker, the pixel Imprint and the opt-in durable mark, each enabled per format by the predicates in `views/tool-actions.ts`.

![The Content protection card as the shell assembles it, with one switch per provenance mechanism rather than a single blanket toggle](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Furl%3Dhttps%3A%2F%2Flolly.tools%26format%3Dpng%26options%26c2pa%3D90%26imprint%3D1&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-inputs%2C%23sidebar-utils%7Bdisplay%3Anone%7D&cropSelector=.export-protection&dark=1&filename=cc-export-protection)

- `shells/web/src/bridge/identity.ts` is the identity manager: `status()`, `enroll(provider)` (popup, `postMessage`, proof of possession and the certificate cache), `signer()` (null unless a valid certificate is cached) and `forget()`. The keypair and certificate live in a dedicated IndexedDB store; CryptoKey objects structured-clone into IndexedDB natively.
- The export path passes `signer` into `embedC2pa*` when one is available, one line at the existing call site. The ephemeral fallback is the engine default.
- **Settings** has a **Content Credentials** section (the old `/profile` route still opens the section). It shows the enrolment status ("Signing as andy@… via GitHub - renews Jul 10"), a button for each provider the deployment configures, Renew, Forget this device and, on a managed deployment, Revoke certificate.
- `/verify` passes the pinned root and the bundled public anchors as `trustAnchors` and renders the trusted state: the shield turns green with an identity, and the facts show the verified email and issuer.

The enrolment card is where the certificate lifetime is chosen, before any popup opens. Its provider buttons come from `/api/ca/health.configured`, so a deployment with no OIDC app says so.

![The Content Credentials section of Settings, expanded from the link, on a deployment with no OIDC app wired up: one line says so in place of the lifetime picker and the provider buttons](/t/url-shot?url=%2F%23%2Fprofile%3Ffocus%3Didentity-section&width=1440&height=1400&dpi=192&waitMs=2600&format=svg&cropSelector=%23identity-section&walker=1&dark=1&filename=ce-identity-enrolment)

## Run the CA

The [CA README](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md) is the operator runbook: [hosted identity](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md#deploy-and-maintain-hosted-identity) for provider clients, the verified-email policy, secrets, upgrades and rotation, and [managed intermediate enrolment](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md#managed-intermediate-enrollment) for a Vault deployment, which holds no root key in the service.

To try the whole loop locally, with no secrets thanks to the development provider:

```bash
CA_DEV_FAKE_PROVIDER=1 CA_SERVICE_SECRET=dev node services/ca/server.mjs &
pnpm run dev:web        # Vite proxies /api/ca → :8787
```

::: details Bootstrapping a legacy root deployment
1. **Generate the root** anywhere, then guard the key: `node services/ca/scripts/gen-root.mjs` writes `lolly-root-cert.pem` and `lolly-root-key.pem`. Commit or paste `lolly-root-cert.pem` into `shells/web/src/ca-root.ts`. **Never commit the key.** Keep it in a password manager.
2. **Register a provider client** for each provider you enable, with the callback `https://<your-host>/api/ca/callback/<provider>`, plus the `http://localhost:8787/api/ca/callback/<provider>` variant for development. GitHub needs the `user:email` scope; Google and the `suse` provider id (any OIDC issuer, such as Keycloak, set with `SUSE_ISSUER`) need `openid email`, plus `profile` for the latter. Email enrolment through Resend is optional, because the current app offers no email button.
3. **Set the environment** in your platform's secret store, production and a staging copy: `CA_ROOT_KEY_PEM`, `CA_ROOT_CERT_PEM`, `CA_SERVICE_SECRET` (for example `openssl rand -hex 32`), `CA_ALLOWED_ORIGINS`, `CA_RATE_LIMIT_REST_URL` and `CA_RATE_LIMIT_REST_TOKEN`, plus the provider credentials. Do not set `CA_DEV_FAKE_PROVIDER` in production.
4. **Deploy** one artifact: the container image from `deploy/docker/ca.Dockerfile`, or the generated function bundle `api/ca/[...path].js` (rebuild it with `pnpm run build:ca-fn`). Either way, route `/api/ca/*` to the CA ahead of the app's single-page fallback. Then `curl https://<your-host>/api/ca/health` should return JSON (`{"ok":true,…}`), not the app's HTML. HTML means the request reached the app instead of the CA, so check the routing.
:::

## Threat model, abridged

The full register is the [Threat Model](/info/threat-model.html).

- **The repository is public.** It holds no secrets, and the root certificate is public by design.
- **Device key theft.** The key cannot be exported, so even injected script can at worst *use* it while the page is open, and only within the certificate's lifetime. In legacy mode, expiry is the only recall. Managed mode adds revocation authorised by the device, through the issuer's revocation list, which reaches a client that was offline once its cached list expires.
- **CA key theft.** Catastrophic for trust, as with any CA. Legacy mode keeps the root key in the host's environment store. Managed mode is designed to keep the intermediate key in an HSM or KMS behind Vault, with the root offline, and the service never holds either key. Short leaf lifetimes bound how long a misissued certificate stays usable.
- **Fork abuse.** Forks can request certificates only through this OIDC-gated, origin-allowlisted, rate-limited endpoint, and only for identities they actually control.
- **Token replay.** The enrolment token is a 10-minute HMAC, and the proof of possession binds the *presented* keypair, not the browser that completed sign-in. So a token leaked inside its window gives whoever holds it a certificate for that identity. In legacy mode the token is stateless, so this is an accepted risk bounded by the short window, and flagged for the PKI review. Managed mode consumes each token once, so a leaked token is useless after the first enrolment.

## Roadmap

1. An RFC 3161 timestamp countersignature in the same enrol and export round trip, so the *expired* verdict becomes trusted with a provable time.
2. A public, append-only issuance transparency log, shaped like Rekor.
3. The C2PA conformance programme: audited KMS custody, then the official trust list, then a green result in Adobe's verifier and others.

Signing from the terminal has shipped: `--sign-key=<key.pem> --sign-cert=<chain.pem>`, with environment variables for CI secret stores. See [Signing from the terminal](/info/cli-signing.html).

Organisation SSO, SCIM and sign-in for access to an instance belong to Lolly Work, with a client and lifecycle separate from the CA's signing enrolment. See [Set up enterprise identity](/info/work-enterprise-identity.html).
