# Security & Verification

A security reviewer's summary of the cryptography behind Lolly's Content Credentials, verification and encryption - the standards it implements, the primitives it uses, how trust is earned and how all of it is tested. This is the public companion to the deeper [Content Credentials - Engineering](/info/content-credentials-engineering.html) guide. The operator narrative lives in [Lolly for Operators](/info/operators.html).

The short version: **verification is entirely on-device, the crypto is standards-based and built on the platform's own WebCrypto engine, and every claim is backed by a test** - known-answer vectors, adversarial forgery/replay tests, fuzzing and conformance against independent tools.

## Verification is on-device

Everything Lolly verifies, it verifies **locally, offline, without uploading the file**. Dropping a file on `/verify` (or `lolly validate <file>`) parses it, walks its Content Credential, re-checks the signature and the byte-hash binding and renders a verdict. It all runs in your browser or on your machine. There is no verification server.

![The Verify screen - nothing but a drop target, no upload button, no account, because the check runs where the file already is](/t/url-shot?url=%2F%23%2Fverify&width=460&height=900&dpi=192&waitMs=1400&walker=1&format=svg&cropSelector=.valid-layout&dark=1&filename=cc-verify-drop-sq)

Here is a real check, start to finish. This is the [generated Queensland storm](/info/ai-stance.html) from our AI stance. It is a Gemini image Lolly opened, resized and exported to WebP. Drop it on `/verify` and the whole story comes back: a green **Made with Lolly** verdict, the two key validations (credential intact, bytes unchanged), the provenance scorecard and an honest **GEN AI** flag because a machine made the pixels. None of it left your device to get there.

![The full Verify verdict for the generated storm image - the image itself, a green Made with Lolly pill, the intact-credential and unchanged-bytes badges and the provenance scorecard](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1240&height=940&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-masthead)

AI declares itself in the same verdict, as a badge nobody has to go looking for. The file was generated, and its credential says so. Lolly reads that assertion back out and surfaces it plainly, alongside the note that a Google model very likely stamped an invisible SynthID watermark into the pixels too.

![The GEN AI flag Verify raises for the storm image - a labelled badge reading that the image was AI-generated, with the SynthID note](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=820&height=900&dpi=192&waitMs=6000&waitSelector=.valid-ai-flag&walker=1&format=svg&cropSelector=.valid-ai-flag&dark=1&filename=cc-verify-genai)

The engine's crypto core is **platform-agnostic and uses only `globalThis.crypto` / WebCrypto**. There is no bespoke crypto library, no Node-only APIs and **no network calls anywhere in the engine**. In the web app, verification makes **no network request to any third party**. The only fetch it can ever make is the opt-in deep scan's one-time detector download, from the app's own origin. Even a **SEAL** record whose signing key lives in DNS is reported as "no key resolver" rather than routed through a third-party DNS-over-HTTPS service (the desktop and command-line shells resolve such keys through your own machine's DNS, with no third party involved).

## Standards implemented

| Area | Standard |
|---|---|
| Content Credentials | **C2PA 2.x** (reads v1 + v2 manifests from any producer) |
| Signing certificates | **RFC 5280** (X.509/PKIX), C2PA cert profile, section 14.5.1 |
| Signature container | **RFC 9052 / 9360** (COSE_Sign1) |
| Serialization | **RFC 8949** (deterministic CBOR) |
| Key fingerprinting | **RFC 7638** (JWK thumbprint) |
| Credential boxing | **ISO 19566-5** (JUMBF) |
| Video binding | **ISO 14496-12** (BMFF) |
| PDF encryption | **ISO 32000-2, section 7.6.4** (PDF 2.0 AES-256, R6) |
| Zip encryption | **PKWARE APPNOTE** + **WinZip AE-2** |
| Byte-level signatures | **SEAL** (verification) |
| Durable soft binding | **Adobe TrustMark** (read + write; write off by default) |
| Supply chain | **CycloneDX 1.5** (SBOM) |

## Cryptographic primitives

- **Signing** (Content Credentials, catalog integrity, issued certificates): **ECDSA P-256 / ES256** with **SHA-256**. There are two signer paths and the difference is worth stating precisely. An **enrolled** identity's device key is generated **non-extractable** and kept in IndexedDB: even Lolly's own code can only ask it to sign, never read it. The **default anonymous** signer is a throwaway keypair minted per export inside the page, used once and dropped with the export. Neither key is ever transmitted.
- **Verifying** (to accept the whole C2PA ecosystem): **ECDSA** P-256/384/521, **RSA** PKCS#1 v1.5, **RSA-PSS** and **Ed25519**.
- **Encryption**: **AES-256** for the *Strong* PDF lock (PDF 2.0 / R6) and *Strong* locked downloads (WinZip AE-2), with **PBKDF2** key derivation and **HMAC** authentication. The *Standard* tiers (40-bit RC4 for PDF, ZipCrypto for zip) are labelled as quick, universal **deterrents**. Reach for *Strong* for anything sensitive.
- **Hashing**: **SHA-256** throughout (SHA-384/512 where a curve or algorithm requires it).

![The export panel's lock card, where Standard and Strong name the actual ciphers rather than hiding them behind a padlock icon](/t/url-shot?url=%2F%23%2Ftool%2Fqr-code%3Fformat%3Dpdf%26options%26password%3Dlolly&width=1440&height=900&dpi=192&waitMs=2200&walker=1&format=svg&css=%23tool-inputs%2C%23sidebar-utils%7Bdisplay%3Anone%7D&cropSelector=.export-pdfpass&dark=1&filename=cc-pdf-lock)

All of the above run on the platform's audited WebCrypto implementation. The two symmetric ciphers use a small in-house block layer only because WebCrypto exposes no raw AES block. This layer is used **encrypt-only, over your own content**, never as a decryption oracle.

## How "trusted" is earned

Lolly reports the trust a file can actually *prove*, in explicit tiers:

- **`valid`** - the credential is intact and the byte-hash binding holds: the file is unaltered since signing. An un-enrolled export is `valid` but signed **anonymously** (`untrusted`). That's the default, and it's honest.
- **`trusted`** - additionally, the signer's certificate chain **cryptographically reaches a pinned trust anchor** *and* the claim signature verifies under that signer's key *and* nothing else failed. Both conditions together are what make a copied ("replayed") signer certificate worthless to an attacker: it can't produce a claim signature that verifies under the real owner's non-extractable key.

Trust anchors are **public certificates only**. They are the C2PA ecosystem roots (Google, Adobe, the CAI trust list, camera makers, AI providers) plus Lolly's own public root. **Presence on the list never confers trust by itself**. Trust always requires the live chain walk and signature check above. Chain walking is bounded (a capped number of intermediates, parsed defensively) so a hostile certificate chain can't exhaust resources.

There is **no timestamp authority yet**, so an authentic-but-*expired* signature surfaces the signer's identity while staying `trusted: false`. It proves *who*, not *when*. An RFC 3161 timestamp countersignature is on the roadmap.

## Complementary provenance signals

Beyond the C2PA credential, Verify surfaces several read-only signals. Each is an honest heuristic that only ever *adds* confidence, never a false alarm:

- **The Lolly Imprint** - an invisible pixel watermark, on by default, that survives a screenshot or re-save (where the credential dies to any container change). Presence-only, no personal data. It is **security-through-obscurity**: casual-stripping cover, not a hardened defence. It complements the credential rather than replacing it.
- **SEAL** byte-level signatures, **AI-generated-content** declarations, third-party **pixel-watermark** deep scans (opt-in, one-time on-device model download) and **hidden-data** detection. All of these run locally.

Lolly's provenance strategy is **read-broad, embed-narrow**: it *reads* many signals but *writes* only three - C2PA, its own Imprint and an opt-in **durable mark** in Adobe's TrustMark format (a neural pass plus a one-time model download, so it is off by default). That keeps the write-side attack surface small, and it is exactly what the export panel shows: three named switches, each a separate mechanism, rather than one blanket "protect this" claim.

![The Content protection group on a PNG export, with the credential, the Imprint and the durable mark as three separate switches](/t/url-shot?url=%2F%23%2Ftool%2Fcolor-palette%3Fformat%3Dpng%26c2pa%3D90%26imprint%3D1%26durable%3D1%26options&width=1440&height=900&dpi=192&waitMs=2400&walker=1&format=svg&css=%23tool-inputs%2C%23sidebar-utils%7Bdisplay%3Anone%7D&cropSelector=.export-protection&dark=1&filename=ce-protection-stack)

## How it's assured

An automated test in the repository (`pnpm test`) backs every cryptographic claim above:

- **Known-answer tests (KATs).** Byte-for-byte fixed vectors: the CBOR encoder, the PDF R6 encryption vector, the zip CRC/AE-2 output and the canonical-JSON signing form are each pinned to an exact expected byte string, so an accidental change is caught immediately.
- **Adversarial tests.** Signer-replay, lifted-signature, forged-intermediate and identity-impersonation attempts are all asserted to resolve to *untrusted*. Tampering any covered byte (inside the manifest, the claim, an assertion or the file body) is asserted to break the correct check.
- **Fuzzing.** Hostile, truncated and deeply-nested inputs run through the C2PA, CBOR and X.509 parsers with a regression corpus. The tests assert the parsers **fail closed**: no crash, no runaway recursion or allocation.
- **Independent conformance.** The reference tools Lolly interoperates with validate its output: **c2patool** (C2PA), **qpdf** (PDF) and Adobe's own reference implementation for TrustMark. Lolly's verifier is also proven against a manifest signed by an entirely independent producer, not just its own round-trip.
- **Supply chain.** A full **CycloneDX SBOM** is generated deterministically and **drift-checked in CI**, and `npm audit` **blocks** any high- or critical-severity dependency advisory from landing.
- **Static analysis.** An **Opengrep** SAST job runs on every push and pull request. Lolly's own rules (`.github/opengrep/`) scan the whole tree - every shell, the tool packs, the engine, the services and the scripts - and **block** on a finding. The upstream community rule packs run alongside them, diff-only against the merge base, and are advisory: they resolve over a third-party registry, so a gate there would go red on someone else's outage.

The cryptography and parsers are additionally undergoing **SUSE's enterprise-scale security hardening**. They are strong by design today. Where a contract calls for certified assurance, deploy Lolly as one layer of defence-in-depth.

## Design boundaries (worth having straight)

- **Content Credentials are tamper-*evident*, not tamper-*proof*.** They detect alteration cryptographically and offline. They don't prevent it. That is exactly what makes fully offline verification possible.
- **The on-device signer is anonymous by design** unless you enrol a verified identity. No real credential ever leaves the device.
- **Tool hooks are not a security sandbox by default.** A tool's optional `hooks.js` runs with the host bridge injected but, in a browser shell, executes in the page's realm. Worker isolation ships as a per-tool opt-in - a manifest declaring `isolate: true` runs its hooks off-thread in a Worker, with the in-realm path as the fallback where no Worker executor exists - so the default remains in-realm. Run only tools you've reviewed. An org running a shared catalog can gate it through Git review.
- **Interoperability:** two containers have no standardised C2PA mapping yet, so Lolly gives each a home of its own - WebM (the manifest as a Matroska part) and Ogg/Opus (the store as a `C2PA=` comment field, its byte range excluded from the binding so the audio still hashes identically). Lolly's own verifier reads both; a third-party tool will not. Every other format Lolly stamps uses its spec-defined place - MP4, M4A, AVIF, MP3 and WAV among them - and verifies in third-party tools by default.

## Reporting a vulnerability

Found something? Report it privately: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), the **Report a vulnerability** button on any [lolly-tools](https://github.com/lolly-tools) repository or the machine-readable [`/.well-known/security.txt`](/.well-known/security.txt). The full policy, scope and safe-harbour statement live in [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md). We practise coordinated disclosure and credit reporters in the fix notes.

## Where to go next

- **[Verify It Yourself](/info/verify-yourself.html)** - every checkable claim on this page and the privacy policy as a runnable procedure: the exact commands and the output you should see.
- **[Server Surface](/info/server-surface.html)** - the complete inventory of what runs server-side (two optional components) versus on-device.
- **[Content Credentials - Engineering](/info/content-credentials-engineering.html)** - the engine contracts, trust anchors, CA service and threat model in full.
- **[Content Credentials Identity](/info/content-credentials-identity.html)** - how verified-identity enrolment and the Lolly CA work.
- **[Lolly for Operators](/info/operators.html)** - provenance, encryption and air-gap deployment in context.
- **[Privacy Policy](/info/privacy.html)** - the formal "collects nothing, uploads nothing" statement.
