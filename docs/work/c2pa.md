# Configure Work export signing

Give a Lolly Work deployment a signing identity and **every export the server makes**
carries a signed C2PA Content Credential: renders, share, embed and download links,
guest links and the Chromium worker's output. Anyone can check the credential and see if
the file was changed. Without an identity, exports keep their unsigned provenance
metadata. Signing only adds to an export and never breaks one.

A signing identity has two halves:

- a **signing certificate chain**, leaf first, which is *public* and goes in the
  configuration;
- a **PKCS#8 private key**, which is *secret* and goes in `LW_C2PA_SIGNING_KEY`.

There are two ways to get one:

::: cols
## A self-made root

One command, no PKI. Signatures check as **valid** at once, and as **trusted** once you add
your root certificate to each verifier's trust list.

Best when you sign for your own team, or while you wait for a certificate from your
organisation.

## Your organisation's CA

A certificate from the PKI you already run. Signatures check as **trusted** straight away,
because the chain ends at a root your verifiers already trust.

Best when people outside your team check your files.
:::

## Option A: one command, no PKI

```bash
lw c2pa init --org "Acme"        # writes into ./c2pa/
```

This makes a self-contained identity, a root plus an issued leaf signer, and writes three
files:

| File | What it is | Where it goes |
|---|---|---|
| `c2pa-signing-cert.pem` | the chain (leaf and root), **public** | `render.c2pa.certFile` |
| `c2pa-signing-key.pem` | the private key, **secret** | `LW_C2PA_SIGNING_KEY` |
| `c2pa-root-cert.pem` | the root, **public** | your verifiers' trust list |

Then connect them; the command prints these exact lines:

```jsonc
// instance.json
"render": {
  "c2pa": {
    "certFile": "/path/to/c2pa-signing-cert.pem",
    "claimGenerator": "Acme Lolly"
  }
}
```

```bash
export LW_C2PA_SIGNING_KEY="$(cat /path/to/c2pa-signing-key.pem)"
# restart the server
```

Exports are now signed. A verifier reports the signature as **valid**, and as **trusted**
only after you add `c2pa-root-cert.pem` to that verifier's C2PA trust list: nobody trusts
a root you made yourself until you hand it out, which is what the root file is for.
Keep `c2pa-signing-key.pem` secret. It is written with mode `0600`; never commit the key.

## Option B: your organisation's CA

If your organisation runs a PKI, ask it for a **document or email signing certificate**
and skip `lw c2pa init`. The C2PA profile wants an ECDSA P-256 key and the
`emailProtection` extended key usage.

- Set `render.c2pa.certFile` to the chain PEM, **leaf and intermediates**, leaf first.
- Set `LW_C2PA_SIGNING_KEY` to the leaf's **PKCS#8** private key PEM.

Because the chain ends at a root your verifiers already trust, signatures check as
**trusted** with no trust list to hand out. If your key is not PKCS#8 yet, convert an EC
key with `openssl pkcs8 -topk8 -nocrypt -in leaf-key.pem -out leaf-key.pkcs8.pem`.

## On Kubernetes (Helm)

The chart carries the **key** in its Secret. The **certificate** is public, so mount it
yourself and point `certFile` at the mount:

```yaml
# values.yaml
c2pa:
  signingKey: |
    -----BEGIN PRIVATE KEY-----
    …
config:
  render:
    c2pa:
      certFile: /etc/lolly/c2pa/signing-cert.pem
      claimGenerator: "Acme Lolly"
extraVolumes:
  - name: c2pa-cert
    configMap: { name: lolly-c2pa-cert }   # kubectl create configmap lolly-c2pa-cert --from-file=signing-cert.pem=…
extraVolumeMounts:
  - name: c2pa-cert
    mountPath: /etc/lolly/c2pa
    readOnly: true
```

You can supply the key through `existingSecret` instead, under the key
`LW_C2PA_SIGNING_KEY`.

## Rotation and failures

- **Rotation** is a configuration change: swap the certificate and key, then restart.
  Exports made before and after each check against whichever certificate signed them.
- **A wrong setup fails fast.** Setting only one of `certFile` and `LW_C2PA_SIGNING_KEY`,
  or an unreadable or invalid certificate or key, fails the first render with a clear
  message, so the server never quietly ships unsigned exports you expected to be signed.
- **Signing at run time is best effort.** If signing itself fails mid-render, the
  unsigned bytes still ship and the failure is logged; a render never fails over a
  signing problem.

## Detecting credentials on imported assets

Everything above is about **signing** what this deployment makes. A separate, much
smaller job looks at assets that come *in* from a federated DAM. A DAM asset's bytes may
already carry a C2PA manifest that the DAM's own API never mentions; Brandfolder's v4
API, for one, says nothing about C2PA. The catalog can **detect** that.

- `POST /api/v1/catalog/scan/<assetId>` (action `catalog.scan`, admin, audited) fetches
  the asset's main format once, through the source driver for an `ext/*` ID or from disk
  for a pack ID, and checks whether the bytes embed a C2PA manifest. It records
  `{ status: 'embedded' | 'none', container?, sniffedAt, sourceUpdatedAt? }`. A feed entry
  then shows `credential: 'embedded'`, and the inspect route
  (`GET /api/v1/catalog/assets/<id>`) returns the detection record.
- It **detects and never verifies**. It records only *whether* a manifest is present and
  in which container, never a `valid` or `trusted` verdict and never a parsed claim.
  Verify in the console's verify view, against the bytes you received. Detection reuses
  the bundled engine's container handling, so both repositories share one C2PA
  implementation, and the engine-pin check makes sure those modules stay present.
- On **export**, provenance ingredients change from `c2pa: null` to
  `{ kind: 'embedded' }` for any used asset with an embedded detection, so the export can
  tell "the source said nothing" apart from "the source carries a credential".

Detection and signing are independent: detection reads what imported bytes already
carry, and signing is what this deployment stamps on what it makes. For what a verifier
reports and why, see [Content Credentials](/info/trust/content-credentials-identity.html).
