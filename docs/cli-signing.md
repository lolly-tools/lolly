# Signing from the terminal

By default a file exported by `lolly` carries a Content Credential signed with a **fresh, anonymous, self-signed certificate made on the spot**. The seal is real: change one byte and it breaks. But it says nothing about *who* made the file, so every verifier reports an unidentified signer, whichever roots they pin.

This page sets up a terminal that signs with a **real identity**, so a recipient who pins your root reads **Verified**, with your address in the result. Every output shown here is from a command that was run. Where a step needs something only a CA can give you, the page gives a self-signed version you can run now.

::: note Before you start
You need the CLI in a checkout of the Lolly source ([Install](/info/cli.html#install)), with Node 22.18 or later. Signing, verification and trust anchors are plain Node, so every example here works with no browser. The captured output below was produced on engine 1.281.0; yours will report a higher number, and a checkout also prints a `catalog integrity: unsigned catalog` note first, which the captures leave out.
:::

Renders submitted to Lolly Work are signed by the organisation's server instead, so nobody copies a personal key to each caller. Its [Content Credentials guide](/info/work-c2pa.html) covers the server identity and trust roots, and [Organisation jobs](/info/cli-automation.html#organisation-jobs-with-lolly-work) explains that separate render path.

::: timeline
- <!--i:seal--> **Get a certificate.** A P-256 key and its chain, from your organisation's CA or self-signed for testing.
- <!--i:lock--> **Store the key.** A file only you can read, never a command-line argument.
- <!--i:pentool--> **Sign.** Point `--sign-key` and `--sign-cert` at the two files.
- <!--i:check--> **Prove it worked.** `lolly validate` with your root pinned reads Verified.
:::

## Get a certificate

You need two things: a **P-256 (prime256v1) private key**, and the **certificate chain** for it, leaf first. Content Credentials are signed with ES256, so P-256 is the only curve that works; an RSA or P-384 key is refused by name.

There are three ways to get them:

1. **Your organisation's CA.** If your organisation runs one, ask for an S/MIME-style certificate: EC P-256, `keyUsage: digitalSignature`, `extendedKeyUsage: emailProtection` and your address in the subjectAltName. That is the C2PA certificate profile.
2. **Lolly's own CA.** Enrolment (`services/ca`) issues short-lived certificates bound to an OIDC-verified email, through a **browser flow**: the device key is made non-extractable in the browser and never leaves the browser. That is what keeps the key safe there, and why it cannot reach the CLI. **There is no CLI enrolment**, and a browser-enrolled key cannot be exported to a file ([Content Credentials identity](/info/content-credentials-identity.html)).
3. **Self-signed**, for testing the setup and for closed groups where you hand out your own root. You can run this now:

```bash
openssl ecparam -name prime256v1 -genkey -noout -out signing-key.pem
chmod 600 signing-key.pem
openssl req -new -x509 -key signing-key.pem -out signing-cert.pem -days 90 \
  -subj "/O=Example Org/CN=release-bot@example.org" \
  -addext "subjectAltName=email:release-bot@example.org" \
  -addext "keyUsage=critical,digitalSignature" \
  -addext "extendedKeyUsage=emailProtection"
```

**A `.p12` bundle is not read directly.** Most CAs hand out one password-protected PKCS#12 file, and Node has no built-in reader for it; supporting one would mean adding an ASN.1 library to a package that has none. Convert it once with `openssl`:

```bash
openssl pkcs12 -in identity.p12 -nocerts -nodes -out signing-key.pem   # the key
openssl pkcs12 -in identity.p12 -clcerts -nokeys -out leaf.pem         # the leaf
openssl pkcs12 -in identity.p12 -cacerts  -nokeys -out issuers.pem     # its issuers
cat leaf.pem issuers.pem > signing-chain.pem
chmod 600 signing-key.pem
```

Keys are read as PKCS#8 PEM, encrypted PKCS#8 PEM, legacy SEC1 EC PEM (what `openssl ecparam` writes) or raw PKCS#8 DER. Chains are one or more `CERTIFICATE` PEM blocks **leaf first**, or a single DER certificate.

## Store the key

```bash
mkdir -p ~/.config/lolly && chmod 700 ~/.config/lolly
mv signing-key.pem ~/.config/lolly/
chmod 600 ~/.config/lolly/signing-key.pem
```

`600` means only you can read the key, and `700` stops anyone else listing the directory. On a shared machine, that is the only thing between your identity and every other account on the machine. The certificate chain is public, because it is embedded in every file you sign, so it needs no protection.

**Never pass a key on the command line.** No flag takes key material or a passphrase, only paths. Arguments show in `ps` output to **every user on the machine**, your shell writes them to its history file and CI systems log the command line of every step. A path is not a secret; the file it points at is.

## Sign

```bash
lolly qr-code --url=https://lolly.tools --export=svg --output=./out.svg \
  --sign-key=~/.config/lolly/signing-key.pem --sign-cert=./signing-chain.pem
```

Run against the self-signed pair above:

```text
Signing as release-bot@example.org (Example Org) · 1 certificate in the chain · valid until 2027-01-20T13:08:17.000Z
Recorded the design system: Lolly Starter. Pass --no-madewith to leave the record out.
✓ Wrote 20417 bytes to ./out.svg
```

The `Signing as` line prints to stderr on every signed run, so a CI log records which identity made which file.

If the key file is passphrase-protected, the passphrase comes from `$LOLLY_SIGN_KEY_PASSWORD`, or from a prompt when you are at a terminal, and nowhere else:

```bash
LOLLY_SIGN_KEY_PASSWORD=… lolly qr-code --url=https://lolly.tools \
  --export=svg --output=./enc.svg --sign-key=./enc-key.pem --sign-cert=./signing-cert.pem
```

Setting a variable inline like that keeps it out of the history file in most shells, but not all, so prefer a secret store or the prompt.

### What the credential records

A credential records the tool and a digest of its inputs, the output format and size, the surface (`cli`), a timestamp, the action history, the [design system, version and colourway](/info/exporting.html#the-design-system-record) the render drew with and, with an identity, your certificate chain. The CLI prints the design-system words it read back from the finished file, such as `Recorded the design system: Acme · Colourway: Persimmon. Pass --no-madewith to leave the record out.`

To record yourself as the author as well, pass a user-profile file with `useDetails: true`:

```json
{ "firstname": "Ada", "lastname": "Lovelace", "email": "ada@example.org", "useDetails": true }
```

```bash
lolly qr-code --url=https://lolly.tools --user-profile=./me.json --export=svg --output=./qr.svg
```

`validate` then shows `Produced by Ada Lovelace`. Without `useDetails`, the profile only fills `bindToProfile` inputs ([Profiles](/info/profile.html)). **The profile is not the identity**: it is text anyone can write, while the signing identity is the cryptographic claim. They are independent, and they should agree.

Provenance flags work as on any render ([Provenance on every file](/info/cli-rendering.html#provenance-on-every-file)). `--no-provenance` together with `--sign-key` is refused rather than guessed at:

```text
Error: --no-provenance turns every provenance mark off, but --sign-key/--sign-cert asks for a signed credential. Drop one of them.
```

## Prove it worked

Validate the file with the self-signed certificate pinned as its own root:

```bash
lolly validate ./out.svg --trust-anchor=./signing-cert.pem
```

```text
./out.svg  [svg]
✦ Made with Lolly - credential intact, file unchanged since export
  Title       QR Code
  Identity    release-bot@example.org - verified by release-bot@example.org
  Tool        QR Code
  Made with   Lolly 1.281.0
  Signed      2026-10-22T13:08:18Z
  Where       cli
  Signer      release-bot@example.org
  Issuer      Example Org (self-signed)
  Algorithm   ES256
  Manifest    urn:uuid:1c5d0e91-83b5-446c-bd6c-73cd91c4402a
  ✓ assertion.hashedURI.match  - hashed uri matched: self#jumbf=c2pa.assertions/c2pa.actions.v2
  ✓ assertion.hashedURI.match  - hashed uri matched: self#jumbf=c2pa.assertions/c2pa.hash.data
  ✓ assertion.hashedURI.match  - hashed uri matched: self#jumbf=c2pa.assertions/tools.lolly.export
  ✓ claimSignature.validated  - claim signature valid
  ✓ claimSignature.insideValidity  - signing certificate within its validity window
  ✓ assertion.dataHash.match  - data hash valid
  ✓ signingCredential.trusted  - signing certificate chains to a pinned CA root - verified identity: release-bot@example.org
  Trust anchors: C2PA known-certificate list (54) · pinned: signing-cert.pem · Lolly CA root
```

`signingCredential.trusted` with your address on it is the whole feature. Without the pin, the same file reads untrusted, and the reason says why. Each kind of signer has its own verdict and its own fix:

::: figure cli-signing-trust
What a recipient's `lolly validate` says about each kind of signer, and the fix for each.
:::

These are the exact lines `validate` printed, with no `--trust-anchor`:

```text
# the self-signed identity above
  ℹ signingCredential.untrusted  - signing certificate untrusted - a self-signed certificate, which vouches only for itself (pin it as a trust anchor to verify the identity)

# an identity issued by a real CA whose root nobody here pinned
  ℹ signingCredential.untrusted  - signing certificate untrusted - a CA-issued certificate that chains to no pinned trust anchor (pin its root to verify the identity)

# no identity at all: the default anonymous signer
  ℹ signingCredential.untrusted  - signing certificate untrusted - an ephemeral on-device key, not a CA-issued identity
```

## Pin your root

By default `validate` trusts the **Lolly CA root** and the **vendored C2PA known-certificate list** (54 roots: Adobe, the camera makers, the big generators), so "Verified" means the same in the app and in a terminal. A stranger's CA is not trusted because it is a CA; only a pin makes an identity verifiable.

Recipients pin your root with `--trust-anchor`, repeatably, or through the environment:

```bash
lolly validate ./out.svg --trust-anchor=./corp-root.pem
LOLLY_TRUST_ANCHOR=/etc/lolly/corp-root.pem:/etc/lolly/partner-root.pem lolly validate ./out.svg
```

`--no-default-anchors` drops both built-in sets, so only your pins count. That confirms a green verdict came from a root you chose rather than a list you inherited. Every verdict prints the anchor set that produced it, and [Which anchors produced the verdict](/info/cli-reference.html#which-anchors-produced-the-verdict) explains the flags in full.

## Sign in CI

Two variables carry the PEM **text** instead of a path, for runners with no persistent filesystem:

```yaml
env:
  LOLLY_SIGN_KEY_PEM:  ${{ secrets.LOLLY_SIGN_KEY_PEM }}
  LOLLY_SIGN_CERT_PEM: ${{ secrets.LOLLY_SIGN_CERT_PEM }}
```

The runner's secret store is the right home for a signing key, and it is the only reason these variables exist. Choose how the key reaches the command by who else can read it:

| | A key file with `chmod 600` | PEM text in a variable |
|---|---|---|
| Who can read it | Only your account | Every child process the job starts: dependency install scripts, tests and every tool you call |
| Use it when | The runner has a filesystem | The runner has no persistent filesystem |
| How | Write the secret to a file, `chmod 600` it, pass `--sign-key=`, delete it in a cleanup step | `LOLLY_SIGN_KEY_PEM` and `LOLLY_SIGN_CERT_PEM` |

Never echo either: `set -x` in a step prints the whole key. Restrict which branches can read the secret, so a pull request from a fork cannot sign as you. Give the pipeline its own identity (`release-bot@…`) rather than a person's.

A release gate should check the identity, not just the signature. `--json` on `validate` carries `result.files[].resolved.trusted` and `.identity`:

```bash
lolly validate ./out.png --trust-anchor=./signing-cert.pem --json \
  | jq -e '.result.files[0].resolved.trusted and .result.files[0].resolved.identity.email == "release-bot@example.org"'
```

Signing uses two of the [usual exit codes](/info/cli-reference.html#exit-codes): `2` for a misconfigured identity (missing chain, unreadable file, mismatch, expired, bad chain order, wrong algorithm) and `6` for a missing or wrong passphrase. They differ so a pipeline that can fetch a secret can tell "give me the passphrase" from "you configured this wrong".

A signed file is never byte-reproducible: a fixed identity removes the fresh certificate, but every credential still carries a fresh timestamp and manifest id. If a pipeline needs identical bytes, render with `--no-provenance` and sign a separate copy. The render itself, the input digest, the exit codes and the JSON envelope's shape are deterministic.

## The two flags and five variables

| | Meaning |
|---|---|
| `--sign-key=<path>` | The private key file. A path, never key material. |
| `--sign-cert=<path>` | The certificate chain file, leaf first. |
| `$LOLLY_SIGN_KEY` | Same as `--sign-key`. The flag wins. |
| `$LOLLY_SIGN_CERT` | Same as `--sign-cert`. The flag wins. |
| `$LOLLY_SIGN_KEY_PEM` | The key's PEM text itself, for CI secret stores. |
| `$LOLLY_SIGN_CERT_PEM` | The chain's PEM text itself. |
| `$LOLLY_SIGN_KEY_PASSWORD` | Passphrase for an encrypted key. |

Lolly expands a leading `~` in either path, as `--trust-anchor` does, because a shell does **not** expand a tilde written after `=`. The flag always wins over the environment. A key without a chain (or the reverse) is refused rather than quietly falling back to the anonymous signer.

## When a render uses the browser

When a render goes to the paint tier ([what renders where](/info/cli-rendering.html#what-the-cli-can-render)), the web shell normally stamps the credential with its own on-device key. It cannot sign with your identity: the key is a handle that cannot leave this process, and there is no way to hand it to a browser over a URL, nor should there be. So with `--sign-key`, the browser is told **not** to stamp, and the CLI applies the credential over the finished bytes, with your identity. The only visible difference is that the manifest records the CLI (`surface: cli`) rather than the web shell.

This browser path is implemented and type-checked. As of October 2026 it has not been run against a real browser; every example on this page uses the browser-free path, which has.

## Troubleshooting

::: details Every signing message, and what to do
Each message is the exact text the CLI prints.

| Message | What happened | Fix |
|---|---|---|
| `A signing key was configured but no certificate chain. Add --sign-cert=<chain.pem>…` | Half a configuration. It refuses rather than falling back to the anonymous signer, which would leave you with an untrusted file you believed was signed. | Supply both. |
| `--sign-key: cannot read "…" (ENOENT: no such file or directory…)` | Wrong path, or the file is not readable by this user. | Check the path and `ls -l` the permissions. |
| `--sign-key needs a value: write --sign-key=<value>…` | A bare `--sign-key` with no `=`. | Write `--sign-key=<path>`. |
| `Cannot read the signing key at …: <openssl reason>. Expected an unencrypted or passphrase-protected PKCS#8 PEM…` | The file is not a private key in a format Node reads. | Check you did not point at the certificate. Convert with `openssl pkcs8 -topk8`. |
| `--sign-cert: … contains no certificate. Expected one or more "-----BEGIN CERTIFICATE-----" PEM blocks…` | The chain file is not PEM certificates. | Export the chain again, or convert a DER bundle. |
| `The signing key at … is EC secp384r1. Content Credentials are signed with ES256, so the key must be EC P-256 (prime256v1).` | Wrong curve or key type. RSA fails the same way. | Re-issue on P-256. Nothing else can sign with ES256. |
| `The signing key at … does not match the leaf certificate in …: the key's public half is not the certificate's subject public key.` | **The classic misconfiguration**: a key from one enrolment and a certificate from another. Caught here so it cannot produce a file nobody can verify. | Export the pair together, and check the chain file has the leaf first. |
| `The certificate chain in … does not link: certificate 2 (…) did not issue certificate 1 (…). A chain is ordered leaf first…` | The chain is out of order, or a certificate in it belongs to someone else. | `cat leaf.pem intermediate.pem root.pem > chain.pem`, in that order. |
| `Signing identity: the chain in … stops at …, which is not self-signed…` | A warning, not a refusal: the issuing root is not in the chain. Fine if your recipients pin exactly that issuer; otherwise the commonest reason a signed file still reads untrusted. | Append the issuing certificates. |
| `The signing certificate in … expired at <date>.` | Everything signed with it would read "Credential expired" from the moment it was written. | Renew or re-enrol. |
| `The signing certificate in … is not valid yet: it starts at <date> and this machine's clock reads <date>.` | Usually a wrong system clock, sometimes a certificate issued for later. | Fix the clock (`timedatectl`, `sntp`), or wait. |
| `The signing key at … is passphrase-protected and no passphrase was available.` (exit 6) | An encrypted key with no terminal to prompt at. | Set `$LOLLY_SIGN_KEY_PASSWORD`, or run it from a terminal. |
| `The passphrase for the signing key at … is wrong (the key did not decrypt).` (exit 6) | Wrong passphrase. | Check the secret. The message never echoes what you supplied. |
| `--no-provenance turns every provenance mark off, but --sign-key/--sign-cert asks for a signed credential.` | Two contradicting instructions. | Drop one. |
| `A signing identity is configured, but Content Credentials are off for this run…` | The identity loaded, but the tool or the run has credentials off, so nothing was signed. | Drop `--c2pa=off`, or accept that this tool never signs (`privacy: 'on-device'` tools do not). |
| `Warning: format "dxf" has no C2PA container - Content Credentials skipped.` | The format cannot carry a credential. Because you asked for one, the skip is a warning. | Export a format that can: `pdf`, `pdf-cmyk`, `png`, `apng`, `jpg`, `jpeg`, `gif`, `svg`, `tiff`, `cmyk-tiff`, `webp`, `avif`, `mp4`, `m4a`, `webm`, `mp3`, `wav`, `ogg`, `opus`, `flac` or the text formats `html`, `js`, `css` and `md`. `webm` (a Matroska part), `ogg`/`opus` (a `C2PA=` comment field) and `flac` (an application metadata block) are Lolly's own homes for the manifest, so only Lolly's verifier reads those back. The text formats use the C2PA 2.4 text bindings, and the rest verify in third-party tools. |
:::

## What a signature proves

A credential proves these bytes have not changed since this certificate signed them. It does not prove *when*: there is no trusted timestamp yet, which is also why an expired certificate reads "expired" rather than "verified". It does not prove the content is accurate, and "Made with Lolly" is a claim any fork can make. [Content Credentials identity](/info/content-credentials-identity.html) sets out the trust tiers, and the [Threat Model](/info/threat-model.html) the limits.

**A shared key is shared accountability.** A key on a CI runner signs as whoever the certificate names, and every file it makes is attributable to them. If several people can start that pipeline, the credential proves the pipeline signed and nothing about who pressed the button. It is not an audit log.

**If a key is compromised, treat everything it signed as suspect**, not just what was signed after the theft, because with no trusted timestamp there is no way to prove *when* anything was signed. Stop using it and get a new one; if you run your own root, rotate the root and re-issue, because un-pinning is the only lever you have.

**Revocation.** In its default mode the Lolly CA keeps no record of whom it issued to and publishes no CRL or OCSP responder, a privacy choice that leaves nothing personal on a server. There, expiry is the only revocation, which is why certificates are short-lived (7, 30, 90 or 365 days): a 7-day certificate is a 7-day incident, and a 365-day one lasts a year, so choose the shortest lifetime your work allows. A CA deployed in managed mode hands issuance to Vault PKI, which publishes CRL status and can revoke a certificate; see the [CA service guide](https://github.com/lolly-tools/lolly/blob/main/services/ca/README.md#managed-intermediate-enrollment).

[Content Credentials - Engineering](/info/content-credentials-engineering.html) covers the CA service and the manifest internals, and [Security & Verification](/info/security.html) summarises the cryptography for a reviewer.
