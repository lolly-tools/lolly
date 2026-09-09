# Signing from the terminal

By default a file exported by `lolly` carries a Content Credential signed with a **fresh, anonymous, self-signed certificate generated on the spot**. That is a real cryptographic seal - change one byte and the seal breaks - but it says nothing about *who* made the file. Every verifier reports it as an unidentified signer, no matter which roots they pin.

This page takes you from a clean machine to a terminal that signs with a **real identity**, so a recipient who pins your root reads **Verified**, with your address on it.

Every example here that shows output is a command that was run, with its real output. Where an example needs something only a CA can hand you, it says so and gives the self-signed equivalent you can run right now.

> **Read [CLI](/info/cli.html) first if you have not.** It is the reference for the whole command surface - every flag, every exit code, `--json`, `batch`, `smoke`. This page covers only what that page does not: identity.

---

## 1. Install and prerequisites

You need **Node 22.18+ or 24+** (the repo runs TypeScript directly via Node's type-stripping; this page was produced on v24.18.1) and a checkout of the repo. From the repo, the CLI runs as an npm script; the `--` passes arguments through:

```bash
git clone --recurse-submodules https://github.com/lolly-tools/lolly
cd lolly
pnpm install
pnpm --silent run cli --version
```

```
lolly 0.1.0 (engine 1.95.0)
```

Every captured output block on this page reports the engine version it was
produced against; yours will read higher, and that is the only difference you
should see. `engine/src/version.ts` holds the live number.

Use `pnpm --silent run cli` (not plain `pnpm run cli`) whenever you redirect or pipe: npm prints a two-line banner on stdout that would land inside your PNG. An installed `lolly` binary has no such wrapper.

**What works with no browser.** Everything on this page. SVG, PDF, EMF, EPS, DXF and the data formats render browser-free, PNG renders browser-free for SVG-native tools and signing, verification and trust anchors are pure Node.

**What needs the browser tier.** Raster and video output from HTML-layout tools, print bleed and crop marks and `validate --deep`. One-time setup:

```bash
pnpm run build:web            # the web shell the browser tier drives
pnpm --silent run cli install-browser
```

See [CLI → What the CLI can render](/info/cli.html#what-the-cli-can-render) for the full tier split. Signing is applied on this side of that split either way - section 6 explains what that means for a render that escalates to the browser. (The browser-tier case is implemented but has not been exercised against a real browser at the time of writing; the browser-free path in every example below has.)

---

## 2. First run

```bash
pnpm --silent run cli                     # every tool in the active profile
pnpm --silent run cli describe qr-code # that tool's inputs, defaults, formats
```

A command is `lolly <tool-id> --<input>=<value> --export=<fmt> --output=<path>`:

```bash
pnpm --silent run cli qr-code --url=https://lolly.tools --export=svg --output=./qr.svg
```

```
✓ Wrote 18536 bytes to ./qr.svg
```

The CLI is URL mode under another transport: `--url=…` is the same value the web shell reads from `?url=…`. [URL Mode](/info/url-mode.html) is the shared contract.

---

## 3. The user profile

The profile fills `bindToProfile` inputs (your name, role, contact details) and, when you opt in, records you as the author inside the credential. It is a JSON file you pass per run:

```json
{ "firstname": "Ada", "lastname": "Lovelace", "email": "ada@example.org", "useDetails": true }
```

```bash
pnpm --silent run cli qr-code --url=https://lolly.tools --user-profile=./me.json \
  --export=svg --output=./qr.svg
```

`validate` on the result then shows the line `Produced by Ada Lovelace`.

`useDetails: true` is the gate: without it the profile fills inputs but the credential records no author. Full field list in [Profiles](/info/profile.html).

**The profile is not the identity.** It is self-asserted text inside the manifest - anyone can write any name there. The signing identity below is the cryptographic claim. They are independent, and they should agree.

---

## 4. Set up a signing identity

### 4.1 Get a certificate

You need two things: a **P-256 (prime256v1) private key**, and the **certificate chain** for it, leaf first. Content Credentials are signed with ES256, so P-256 is the only curve that works; an RSA or P-384 key is refused by name at setup.

Three ways to get them, in the order most operators will:

1. **Your organisation's CA.** Ask for an S/MIME-style certificate: EC P-256, `keyUsage: digitalSignature`, `extendedKeyUsage: emailProtection` and your address in the subjectAltName. That is the C2PA certificate profile, and it is a shape every enterprise CA already issues.
2. **Lolly's own CA.** Enrolment (`services/ca`) issues short-lived certificates bound to an OIDC-verified email, and it is a **browser flow** - the device key is generated non-extractable in the browser and never leaves it, which is exactly what makes the private key safe there and unavailable here. **There is no CLI enrolment**, and a browser-enrolled key cannot be exported to a file for the CLI to use. See [Content Credentials identity](/info/content-credentials-identity.html).
3. **Self-signed**, for testing the plumbing and for closed loops where you distribute your own root. Runnable right now:

```bash
openssl ecparam -name prime256v1 -genkey -noout -out signing-key.pem
chmod 600 signing-key.pem
openssl req -new -x509 -key signing-key.pem -out signing-cert.pem -days 90 \
  -subj "/O=Example Org/CN=release-bot@example.org" \
  -addext "subjectAltName=email:release-bot@example.org" \
  -addext "keyUsage=critical,digitalSignature" \
  -addext "extendedKeyUsage=emailProtection"
```

**PKCS#12 / `.p12` is not read directly.** Most CAs hand out one password-protected `.p12` bundle, and Node has no built-in PKCS#12 reader - supporting it would mean adding an ASN.1 library to a package that deliberately has none. Convert it once, with the tool your CA assumed you had:

```bash
openssl pkcs12 -in identity.p12 -nocerts -nodes -out signing-key.pem   # the key
openssl pkcs12 -in identity.p12 -clcerts -nokeys -out leaf.pem         # the leaf
openssl pkcs12 -in identity.p12 -cacerts  -nokeys -out issuers.pem     # its issuers
cat leaf.pem issuers.pem > signing-chain.pem
chmod 600 signing-key.pem
```

Accepted key formats: PKCS#8 PEM (`-----BEGIN PRIVATE KEY-----`), encrypted PKCS#8 PEM (`-----BEGIN ENCRYPTED PRIVATE KEY-----`), legacy SEC1 EC PEM (`-----BEGIN EC PRIVATE KEY-----`, what `openssl ecparam` writes) and raw PKCS#8 DER. Accepted chain formats: one or more concatenated `CERTIFICATE` PEM blocks **leaf first**, or a single DER certificate.

### 4.2 Where to put the key

```bash
mkdir -p ~/.config/lolly && chmod 700 ~/.config/lolly
mv signing-key.pem ~/.config/lolly/
chmod 600 ~/.config/lolly/signing-key.pem
```

`600` means only you can read it. `700` on the directory stops anyone else listing what is in there. The certificate chain is public - it is embedded in every file you sign - so it needs no protection at all.

**Never pass a key on the command line.** There is deliberately no flag that takes key material or a passphrase, only paths. Arguments are visible in `ps` output to **every user on the machine**, they are written to your shell history file and CI systems log the command line of every step. A path is not a secret; the file it points at is.

### 4.3 Sign

```bash
pnpm --silent run cli qr-code --url=https://lolly.tools --export=svg --output=./signed.svg \
  --sign-key=~/.config/lolly/signing-key.pem --sign-cert=./signing-chain.pem
```

Run against the self-signed pair from 4.1 (paths shortened here for width):

```
Signing as release-bot@example.org (Example Org) · 1 certificate in the chain · valid until 2026-10-30T11:10:29.000Z
✓ Wrote 18620 bytes to ./out.svg
```

That line prints on every signed run, to stderr, so a CI log records which identity produced which artefact.

### 4.4 An encrypted key

If the key file is passphrase-protected, the passphrase comes from `$LOLLY_SIGN_KEY_PASSWORD`, or from a prompt when you are at a terminal. Nowhere else:

```bash
LOLLY_SIGN_KEY_PASSWORD=… pnpm --silent run cli qr-code --url=https://lolly.tools \
  --export=svg --output=./enc.svg --sign-key=./enc-key.pem --sign-cert=./signing-cert.pem
```

```
Signing as release-bot@example.org (Example Org) · 1 certificate in the chain · valid until 2026-10-30T11:10:29.000Z
✓ Wrote 18620 bytes to ./enc.svg
```

Setting an environment variable inline like that keeps it out of your shell history in most shells, but not all - prefer a secret store (4.5) or an interactive prompt.

### 4.5 In CI

Two variables carry the PEM **text** instead of a path, for runners with no persistent filesystem:

```yaml
env:
  LOLLY_SIGN_KEY_PEM:  ${{ secrets.LOLLY_SIGN_KEY_PEM }}
  LOLLY_SIGN_CERT_PEM: ${{ secrets.LOLLY_SIGN_CERT_PEM }}
```

**A secret store is the right home for a signing key in CI**, and it is the only reason these variables exist. Be honest about what they cost you: an environment variable is inherited by every child process the job spawns, so every dependency's install script, every test and every tool you shell out to can read it. A key file with `600` permissions is inherited by nothing. Where the runner has a filesystem, write the secret to a file, `chmod 600` it, use `--sign-key=` and delete it in a cleanup step.

Never echo them. `set -x` in a shell step will print the whole key.

### 4.6 Prove it worked

The command that proves the file now reads as trusted, against the self-signed certificate as its own root:

```bash
pnpm --silent run cli validate ./out.svg --trust-anchor=./signing-cert.pem
```

```
out.svg  [svg]
✦ Made with Lolly - credential intact, file unchanged since export
  Title       QR Code Generator
  Identity    release-bot@example.org - verified by release-bot@example.org
  Tool        QR Code Generator
  Made with   Lolly 1.95.0
  Signed      2026-08-01T11:10:33Z
  Where       cli · node v24.18.1 · darwin
  Signer      release-bot@example.org
  Issuer      Example Org (self-signed)
  Algorithm   ES256
  Manifest    urn:uuid:b9e6ce01-0d00-4eaf-9f9d-ceed4af868ff
  ✓ assertion.hashedURI.match - hashed uri matched: self#jumbf=c2pa.assertions/c2pa.actions.v2
  ✓ assertion.hashedURI.match - hashed uri matched: self#jumbf=c2pa.assertions/c2pa.hash.data
  ✓ assertion.hashedURI.match - hashed uri matched: self#jumbf=c2pa.assertions/tools.lolly.export
  ✓ claimSignature.validated - claim signature valid
  ✓ claimSignature.insideValidity - signing certificate within its validity window
  ✓ assertion.dataHash.match - data hash valid
  ✓ signingCredential.trusted - signing certificate chains to a pinned CA root - verified identity: release-bot@example.org
  Trust anchors: C2PA known-certificate list (54) · pinned: signing-cert.pem · Lolly CA root
```

`signingCredential.trusted` with your address on it is the whole feature. Without the pin, the same file is honest about the gap - and the reason it gives tells you which situation you are in. All three of these were produced by running `validate` with no `--trust-anchor`:

```
# the self-signed identity from 4.1
  ℹ signingCredential.untrusted - signing certificate untrusted - a self-signed certificate, which vouches only for itself (pin it as a trust anchor to verify the identity)

# an identity issued by a real CA whose root nobody here pinned
  ℹ signingCredential.untrusted - signing certificate untrusted - a CA-issued certificate that chains to no pinned trust anchor (pin its root to verify the identity)

# no identity at all: the default anonymous signer
  ℹ signingCredential.untrusted - signing certificate untrusted - an ephemeral on-device key, not a CA-issued identity
```

Three different problems with three different fixes: distribute your root, ask the recipient to pin the CA, or configure an identity.

### 4.7 The two flags and five variables

| | Meaning |
|---|---|
| `--sign-key=<path>` | The private key file. A path, never key material. |
| `--sign-cert=<path>` | The certificate chain file, leaf first. |
| `$LOLLY_SIGN_KEY` | Same as `--sign-key`. The flag wins. |
| `$LOLLY_SIGN_CERT` | Same as `--sign-cert`. The flag wins. |
| `$LOLLY_SIGN_KEY_PEM` | The key's PEM text itself. For CI secret stores. |
| `$LOLLY_SIGN_CERT_PEM` | The chain's PEM text itself. |
| `$LOLLY_SIGN_KEY_PASSWORD` | Passphrase for an encrypted key. |

A leading `~` in either path is expanded by Lolly, the same way `--trust-anchor` does it - which matters because a shell does **not** expand a tilde written after `=`.

Precedence is the CLI's uniform rule: **flag, then environment**. Configuring a key without a chain (or the reverse) is a refusal, not a quiet fall back to the anonymous signer - see the troubleshooting table.

---

## 5. Trust anchors

**Pinned by default:** the **Lolly CA root** and the **vendored C2PA known-certificate list** (54 roots - Adobe, the camera makers, the big generators). That default is [contract section 12, O1](https://github.com/lolly-tools/lolly/blob/main/plans/73-cli-ga-contract.md), decided so that "Verified" means the same thing in a browser and in a terminal.

**Pin your own root**, repeatably, or through the environment:

```bash
pnpm --silent run cli validate ./out.svg --trust-anchor=./corp-root.pem
LOLLY_TRUST_ANCHOR=/etc/lolly/corp-root.pem:/etc/lolly/partner-root.pem pnpm --silent run cli validate ./out.svg
```

`$LOLLY_TRUST_ANCHOR` is a `PATH`-style list (`:` on Unix, `;` on Windows) and a leading `~` expands.

**The bare-trust check.** `--no-default-anchors` drops both built-in sets, so only your pins count. With nothing pinned the anchor set is empty and *every* signer reads untrusted by construction - which is how you confirm a green verdict came from a root you chose rather than from a list you inherited:

```bash
pnpm --silent run cli validate ./out.svg --no-default-anchors
```

Every verdict prints the anchor set that produced it (`Trust anchors: …`), and `--json` carries the same facts as `result.files[].anchors`. "Verified" without "verified by what" is not an answer.

Note what the default does **not** do: a stranger's CA is not trusted because it is a CA. The pin is what makes an identity verifiable, on purpose.

---

## 6. Provenance defaults

Content Credentials and the Lolly Imprint are **on by default** for `lolly run`, matching the app exactly ([contract section 12, O2](https://github.com/lolly-tools/lolly/blob/main/plans/73-cli-ga-contract.md)). A tool opts out for everyone through its manifest (`render.c2pa: false`, or `privacy: 'on-device'`); a run opts out with `--c2pa=off`, `--imprint=0`, or `--no-provenance` for all of them at once.

What a credential embeds: the tool and its input digest, the output format and dimensions, the surface (`cli`), the Node version and OS, a timestamp, the action history, your author details when `useDetails` is on and - with an identity - your certificate chain.

**Byte-reproducibility.** Both marks embed a fresh timestamp, so two identical runs no longer produce identical bytes. `--no-provenance` is the one word that buys determinism back, and `smoke` and `batch` apply it themselves. `--no-provenance` together with `--sign-key` is a refusal rather than a guess:

```
Error: --no-provenance turns every provenance mark off, but --sign-key/--sign-cert asks for a signed credential. Drop one of them.
```

**One thing changes on the browser tier.** When a render escalates to the browser tier (raster from an HTML-layout tool, print marks), the web shell normally stamps the credential itself with its own on-device key. It cannot sign with your identity: the key is a non-extractable handle in this process and there is no way to hand it to a browser over a URL, nor should there be. So with `--sign-key` the browser is told **not** to stamp, and the credential is applied here, over the finished bytes, with your identity. The only visible difference is that the manifest's environment assertion then records the CLI (`surface: cli`) rather than the web shell. Stated plainly: this path is implemented and typechecked but has not yet been run against a real browser, so treat it as untested until someone reports back.

---

## 7. Automation

Exit codes, the `--json` envelope, `batch` and `smoke` are documented once, in [CLI → Scripting & CI](/info/cli.html#scripting--ci). What signing adds:

| Situation | Exit |
|---|---|
| Signed and written | 0 |
| Identity misconfigured (missing chain, unreadable file, mismatch, expired, bad chain order, wrong algorithm) | 2 |
| Passphrase missing or wrong | 6 |

Exit 6 is deliberately not 2: a pipeline that can fetch a secret should be able to tell "give me the passphrase" from "you configured this wrong".

`--json` on `validate` carries `result.files[].resolved.trusted` and `.identity`, which is the assertion a release gate should make:

```bash
pnpm --silent run cli validate ./out.png --trust-anchor=./signing-cert.pem --json \
  | jq -e '.result.files[0].resolved.trusted and .result.files[0].resolved.identity.email == "release-bot@example.org"'
```

**Deterministic:** the render itself, the input digest, the exit codes, the JSON envelope shape.
**Not deterministic:** anything with a credential or an Imprint in it (fresh timestamps, a fresh manifest UUID and on the ephemeral path a fresh certificate). Signing with a fixed identity removes the fresh certificate but not the timestamps, so a signed export is still not byte-reproducible. If a pipeline needs identical bytes, render with `--no-provenance` and sign a separate copy.

---

## 8. Troubleshooting

Every message below is the exact text the CLI prints, keyed to what to do about it.

| Message | What happened | Fix |
|---|---|---|
| `A signing key was configured but no certificate chain. Add --sign-cert=<chain.pem>…` | Half a configuration. It refuses rather than falling back to the anonymous signer, because you would get an untrusted file believing otherwise. | Supply both. |
| `--sign-key: cannot read "…" (ENOENT: no such file or directory…)` | Wrong path, or the file is not readable by this user. | Check the path and `ls -l` the permissions. |
| `--sign-key needs a value: write --sign-key=<value>…` | A bare `--sign-key` with no `=`. | Write `--sign-key=<path>`. |
| `Cannot read the signing key at …: <openssl reason>. Expected an unencrypted or passphrase-protected PKCS#8 PEM…` | The file is not a private key in a format Node reads. | Check you did not point at the certificate by mistake. Convert with `openssl pkcs8 -topk8`. |
| `--sign-cert: … contains no certificate. Expected one or more "-----BEGIN CERTIFICATE-----" PEM blocks…` | The chain file is not PEM certificates. | Export the chain again, or convert a DER bundle. |
| `The signing key at … is EC secp384r1. Content Credentials are signed with ES256, so the key must be EC P-256 (prime256v1).` | Wrong curve or key type. RSA fails the same way. | Re-issue on P-256. Nothing else can be signed with ES256. |
| `The signing key at … does not match the leaf certificate in …: the key's public half is not the certificate's subject public key.` | **The classic misconfiguration** - a key from one enrolment and a certificate from another. Caught here so it cannot produce a file nobody can verify. | Re-export the pair together, and check the chain file has the leaf first. |
| `The certificate chain in … does not link: certificate 2 (…) did not issue certificate 1 (…). A chain is ordered leaf first…` | The chain is out of order, or an appended certificate belongs to somebody else. | `cat leaf.pem intermediate.pem root.pem > chain.pem`, in that order. |
| `Signing identity: the chain in … stops at …, which is not self-signed…` | A warning, not a refusal. The issuing root is not in the chain. Legitimate if your recipients pin exactly that issuer; otherwise it is the commonest reason a signed file still reads untrusted. | Append the issuing certificates. |
| `The signing certificate in … expired at <date>.` | Everything signed with it would read "Credential expired" from the moment it was written. | Renew or re-enrol. |
| `The signing certificate in … is not valid yet: it starts at <date> and this machine's clock reads <date>.` | Usually a wrong system clock, occasionally a certificate issued for later. | Fix the clock (`timedatectl`, `sntp`), or wait. |
| `The signing key at … is passphrase-protected and no passphrase was available.` (exit 6) | An encrypted key in a non-interactive context. | Set `$LOLLY_SIGN_KEY_PASSWORD`, or run it from a terminal. |
| `The passphrase for the signing key at … is wrong (the key did not decrypt).` (exit 6) | Wrong passphrase. | Check the secret. Note the message never echoes what you supplied. |
| `--no-provenance turns every provenance mark off, but --sign-key/--sign-cert asks for a signed credential.` | Two contradictory instructions. | Drop one. |
| `A signing identity is configured, but Content Credentials are off for this run…` | The identity loaded but the tool or the run has credentials off, so nothing was signed with it. | Drop `--c2pa=off`, or accept that this tool never signs (`privacy: 'on-device'` tools do not). |
| `Warning: format "dxf" has no C2PA container - Content Credentials skipped.` | The format cannot carry a credential at all. Because you asked for one, the skip is reported as a warning instead of staying silent. | Export a format that can: `pdf`, `pdf-cmyk`, `png`, `apng`, `jpg`, `jpeg`, `gif`, `svg`, `tiff`, `cmyk-tiff`, `webp`, `avif`, `mp4`, `m4a`, `webm`, `mp3`, `wav`, `ogg`, `opus`. Two of those are Lolly's own home for the manifest rather than a spec-defined one - `webm` (a Matroska part) and `ogg`/`opus` (a `C2PA=` comment field) - so only Lolly's verifier reads them back; the rest verify in third-party tools. |

---

## Security

**File permissions.** `chmod 600` the key, `chmod 700` the directory. On a shared machine that is the only thing between your identity and every other account on it. The certificate chain needs no protection - it ships inside every file you sign.

**Why not the command line.** `ps aux` shows every argument of every process to every user on the machine. Your shell writes the whole line to its history file. CI systems log the command of every step, and those logs are usually readable by more people than the secret store is. This is why `--sign-key` takes a path and no flag takes a passphrase.

**Secrets in CI.** Use the runner's secret store. Prefer writing the secret to a `600` file over `$LOLLY_SIGN_KEY_PEM`, because an environment variable is inherited by every child process the job spawns - including every dependency's install script. Never `set -x` a step that touches it. Restrict which branches can read the secret, so a pull request from a fork cannot sign as you.

**If a key is compromised, assume everything it signed is suspect** - not just what was signed after the theft, because there is no trusted timestamp yet and therefore no way to prove *when* anything was signed.

**Revocation, honestly: there is none.** The Lolly CA writes no issuance log and publishes no CRL or OCSP responder - a deliberate privacy choice, recorded in `services/ca/lib/enroll.mjs`, that leaves nothing personal at rest on a server. **Expiry is the only revocation**, which is why certificates are short-lived (7/30/90/365 days). If yours is compromised: stop using it, get a new one and if you run your own root, rotate the root and re-issue - because the only lever you have is un-pinning something. Prefer the shortest lifetime your workflow tolerates; a 7-day certificate is a 7-day incident, a 365-day one is a year-long one.

**A signature asserts identity, so a shared key is shared accountability.** A key on a CI runner signs as whoever the certificate names, and every file it produces is attributable to that person. Give a build pipeline its own identity with its own address (`release-bot@…`), not a human's. If several people can trigger that pipeline, the credential proves the pipeline signed it and nothing about which of them pressed the button - the credential is not an audit log, and treating it as one is how the wrong person ends up accountable.

**What a credential does not prove.** It proves these bytes have not changed since this certificate signed them. It does not prove *when* (no timestamp authority yet - which is also why an expired certificate reads "expired" rather than "verified"), it does not prove the content is accurate and "Made with Lolly" remains a self-asserted claim any fork can make. [Content Credentials identity](/info/content-credentials-identity.html) sets out the trust tiers in full; [Threat Model](/info/threat-model.html) sets out the limits.

---

## Related

- [CLI](/info/cli.html) - the full command surface
- [Content Credentials identity](/info/content-credentials-identity.html) - the identity model and the trust tiers
- [Content Credentials - engineering](/info/content-credentials-engineering.html) - the CA service, the manifest internals
- [Security & Verification](/info/security.html) - the cryptography, summarised for a reviewer
- [Trust](/info/trust.html) - what Lolly claims and what enforces each claim
