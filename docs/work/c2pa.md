# Signing exports with C2PA - the IT setup

When a signing identity is configured, **every server-side export** (renders,
shared/embed/download links, guest links, the Chromium-worker output) carries a
real, cryptographically **signed C2PA Content Credential** - verifiable and
tamper-evident. Without one, exports keep their unsigned provenance metadata;
signing is purely additive and never breaks an export.

A signing identity is two things:

- a **signing certificate chain** (leaf first) - *public*, goes in config;
- a **PKCS#8 private key** - *secret*, goes in `LW_C2PA_SIGNING_KEY`.

There are two ways to get one. Pick whichever fits your org.

---

## Option A - one command, no PKI (fastest)

```bash
lw c2pa init --org "Acme"        # writes into ./c2pa/
```

This mints a self-contained identity (a root + an issued leaf signer) and writes:

| file | what | where it goes |
|---|---|---|
| `c2pa-signing-cert.pem` | the chain (leaf + root), **public** | `render.c2pa.certFile` |
| `c2pa-signing-key.pem` | the private key, **secret** | `LW_C2PA_SIGNING_KEY` |
| `c2pa-root-cert.pem` | the root, **public** | your verifiers' trust list |

Then wire it up (the command prints these exact lines):

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

Exports are now signed. A verifier will report the signature as **valid**;
it will show as **trusted** only after you add `c2pa-root-cert.pem` to that
verifier's C2PA trust list (a self-generated root isn't trusted by anyone until
you distribute it - that's what the root file is for).

Keep `c2pa-signing-key.pem` secret (it's written `0600`); never commit the key.

---

## Option B - your corporate CA (trusted out of the box)

If your organization runs a PKI, issue a **document/email-signing certificate**
(the C2PA profile wants an ECDSA P-256 key and the `emailProtection` EKU) from
your CA, and skip `lw c2pa init` entirely:

- Set `render.c2pa.certFile` to the **leaf + intermediates** chain PEM (leaf
  first), and
- Set `LW_C2PA_SIGNING_KEY` to the leaf's **PKCS#8** private-key PEM.

Because the chain terminates at a root your verifiers already trust, signatures
verify as **trusted** with no trust-list distribution.

> Not PKCS#8 yet? Convert an EC key with
> `openssl pkcs8 -topk8 -nocrypt -in leaf-key.pem -out leaf-key.pkcs8.pem`.

---

## On Kubernetes (Helm)

The chart carries the **key** in its Secret; the **cert** is public, so mount it
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

(Or supply the key through `existingSecret` under the key `LW_C2PA_SIGNING_KEY`.)

---

## Rotation & failure behaviour

- **Rotation** is a config change: swap the cert + key and restart. Exports made
  before and after each verify under whichever cert signed them.
- **Fail-fast on misconfig**: setting one of `certFile` / `LW_C2PA_SIGNING_KEY`
  without the other, or an unreadable/invalid cert or key, errors on the first
  render with a clear message - it won't silently ship unsigned exports you
  expected to be signed.
- **Best-effort at runtime**: if signing itself throws mid-render, the unsigned
  bytes still ship (the render never 500s over a signing hiccup), and the failure
  is logged.

## Detecting credentials on imported assets (not signing, not verifying)

Everything above is about **signing** exports this deploy produces. A separate,
much smaller motion runs on assets that come *in* from a federated DAM: a DAM
asset's bytes may already carry a C2PA manifest that the DAM's own API never
mentions (Brandfolder's v4, for one, surfaces nothing C2PA-shaped). The catalog
can **detect** that.

- `POST /api/v1/catalog/scan/<assetId>` (action `catalog.scan`, admin, audited)
  fetches the asset's primary format once - through the provider driver for an
  `ext/*` id, or off disk for a pack id - and sniffs whether the bytes embed a
  C2PA manifest. It records `{ status: 'embedded' | 'none', container?, sniffedAt,
  sourceUpdatedAt? }`; a feed entry then annotates `credential: 'embedded'` and the
  inspect route (`GET /api/v1/catalog/assets/<id>`) returns the detection row.
- It is a **detector, never a verifier**. It records only *whether* a manifest is
  present and in which container - never a `valid`/`trusted` verdict, never a
  parsed claim. Validate in the console's verify view, against the bytes you
  received. This reuses the vendored engine's container handling (one C2PA implementation
  across both repos), and the engine-pin check asserts those modules stay present.
- On **export**, provenance ingredients upgrade `c2pa: null` → `{ kind: 'embedded' }`
  for any consumed asset that has an embedded detection - so the export can
  distinguish "the source said nothing" from "the source carries a credential".

Detection (this section) and signing (above) are independent: detection reads what
imported bytes already carry; signing is what this deploy stamps onto what it makes.
