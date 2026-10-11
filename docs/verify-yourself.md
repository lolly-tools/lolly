# Verify It Yourself

These procedures check standalone Lolly's local processing and public services. Optional **lolly.work** adds organisation sign-in, shared content, configured telemetry and audit records; check those separately against [Server Surface](/info/server-surface.html) and the [organisation privacy section](/info/privacy.html#organisation-services-with-lolly-work). Each procedure below identifies the workflow being checked.

If any check on this page doesn't produce the result shown, that's either a bug or a broken promise. [Report it](#if-a-check-fails) either way, and we'll treat it with the severity a broken promise deserves.

## See it work, in ten seconds

Before the procedures, the payoff. Open [`/verify`](/#/verify) and drop a file on it - no upload, no account, no wait for a server. Here it is checking the [generated Queensland storm](/info/ai-stance.html) from our AI stance page: a Gemini image Lolly opened, resized and exported. Every badge below was computed on the device, from the file's own bytes.

![Verify on a phone-width screen - the storm image, a green Made with Lolly verdict and the credential-intact and bytes-unchanged badges stacked beneath it](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=440&height=1500&dpi=192&waitMs=6000&waitSelector=.valid-steps&walker=1&format=svg&rasterDpi=96&cropSelector=.valid-top&dark=1&filename=cc-verify-mobile)

The verdict is not one badge but a small pile of them, each an independent fact:

- <!--i:lock--> **Made with Lolly** - the credential is intact *and* records a Lolly export.
- <!--i:seal--> **The credential is intact** - the signed C2PA manifest parses and its own claim signature verifies.
- <!--i:hash--> **The bytes have not changed** - the file's hash still matches what was signed. Alter one pixel and this badge flips.
- <!--i:sparkle--> **GEN AI** - a machine made these pixels, and the file says so. Lolly reads that assertion back out rather than hiding it.

And the whole history travels with the file. Nine steps survive here - five Google recorded as it generated and watermarked the image, then four Lolly recorded as it opened, marked and converted the copy on this page - read straight back out of the bytes, on your device, and rendered as a timeline. This is the same image, verified the same way, as the C2PA timeline on the [AI stance page](/info/ai-stance.html).

![The change history Verify reads back out of the storm image - five steps recorded by Google, then four by Lolly, ending in the WebP on this page](/t/url-shot?url=%2F%23%2Fverify%3Fsrc%3D%2Finfo%2Fthe-flood.webp&width=1440&height=1400&dpi=192&waitMs=6000&walker=1&format=svg&cropSelector=.valid-steps&dark=1&filename=ai-stance-change-history)

None of that is the trust claim, though - it is the demo. The rest of this page is the trust claim: every badge above is reproducible, and here is how you reproduce the guarantees underneath them.

## In your browser, no tools required

**1. Watch the network.** Open [lolly.tools](https://lolly.tools), open your browser's DevTools (F12), switch to the **Network** tab and use a tool - type a URL into [QR Code](/t/qr-code), change colours, export a PNG. Every request stays on `lolly.tools`: the app shell, the tool's own files, catalogue assets. No analytics host, no CDN beacon, no font service, no "error reporting" endpoint. What you type into a tool appears in **no request at all** - rendering is local.

Other standalone features are visible in the same Network tab when used: adding a **Google Font** in the brand editor fetches that one family from Google, after a consent dialog that tells you exactly that, once, before the first fetch; clicking an **ICC press-profile preset** fetches that profile from the ICC's public registry at color.org; playing the optional built-in **radio** streams from the station; entering a location in **Meeting Planner** looks that place up at open-meteo's geocoding service for its coordinates and time zone, once per city (answers are saved on your device), and the input carries that disclosure right where you type; and **URL Screenshot** necessarily loads the URL you typed - that's its job, and you watch it happen. A tool that declares a network capability may fetch only from the hosts its manifest allowlists, and that mechanism is fail-closed; no tool currently shipped declares one, so the browser-enforced Content-Security-Policy is the boundary that actually holds the list above to its hosts. The [privacy policy](/info/privacy.html) keeps the canonical table of all of these; it also describes managed-instance traffic, including policy refreshes and enabled reporting during use.

**2. Pull the plug.** Load the app and open a tool or two, then go offline - airplane mode, or DevTools → Network → Offline. Reload. The gallery and every tool you've opened keep working, including rendering and export in the formats you've used - a tool's files and a format's encoder are cached the first time you use them, so exercise a tool once online before testing it offline. This is the strongest single check on this page: software that phones home doesn't survive its cord being cut.

**3. Count the cookies.** DevTools → **Application** (Firefox: **Storage**) → Cookies → `https://lolly.tools`. The list is empty - the app sets no cookies. Or paste `document.cookie` into the console: you get `""`. (The optional CA enrolment flow sets a short-lived `HttpOnly` cookie, `lolly_ca_state`, scoped to `/api/ca`; `document.cookie` cannot show an HttpOnly cookie. A lolly.work instance also uses its own authentication cookies. Inspect them in the Application panel and compare with [Privacy](/info/privacy.html#organisation-services-with-lolly-work).)

**4. Read your own storage.** Same Application panel: everything Lolly keeps is inspectable in front of you - a couple of dozen plain `localStorage` keys (theme, language, sidebar width, sound and view settings, plus a cached copy of the public tool-catalogue index), and your own documents in IndexedDB. Every value is a readable string or JSON - nothing is obfuscated, nothing is encoded to discourage reading it. Clearing site data removes these local records; it does not remove a Sync backup or records held by a lolly.work instance; **Settings → Storage → Clear all my data** does the same from inside the app, and you can watch the stores and caches empty in this panel.

**5. Check the disclosure contact exists.** [`/.well-known/security.txt`](/.well-known/security.txt) answers with an [RFC 9116](https://www.rfc-editor.org/rfc/rfc9116) contact block, not an HTML page.

## From a terminal

**6. The render endpoint answers with public data only.** The one server feature that puts user-typed inputs into a URL - hot-link renders - is live here, and the [privacy policy](/info/privacy.html) says what that means for the inputs you put in a link:

```bash
curl -s -o /dev/null -w '%{http_code}\n' 'https://lolly.tools/tool/qr-code.svg?url=test'
# 200
```

The switch is per-deployment (`LOLLY_DISABLE_RENDER_GET=1`): on an instance that sets it, the same probe returns `404` - that difference is the flag working, not an inconsistency.

**7. Check the services your deployment enables.** [Server Surface](/info/server-surface.html) identifies optional services and links their detailed references. For lolly.work, include its authenticated APIs, collaboration connection, storage and configured providers. A public lolly.tools probe does not test a private organisation instance.

## Verify a delivery release

These checks qualify a specific build and route configuration. The presence of
the code or a passing source test does not establish that a live deployment
passes. Use the [deployment guide](/info/deploy-delivery.html) to prepare the
release and retain a rollback copy.

**Check the signed catalog before its indexes.** In DevTools, watch the catalog
envelope load before `index.<sha16>.json`. The envelope must cover the exact tool,
asset and slim index bytes. Repeat the sync: unchanged responses can return 304,
but the saved bytes must still pass their full hashes. In IndexedDB's profile
store, `catalog-trust-v1:` records hold the accepted snapshot and sequence
together. A changed index, forged higher sequence or older signed envelope must
show a refusal and leave that record unchanged. Run those negative cases against
a test instance, not a shared production catalog.

**Try offline and interrupted downloads.** First accept a verified catalog and
download the models you need. Go offline, reload and use a cached tool and model.
The catalog reports its offline verification state. A plain-HTTP context without
WebCrypto must say that verification is unavailable rather than claiming it has
verified the signature. For models, interrupt and resume a download. Watch
the range request and its validator; the model becomes installed only after its
decoded size and complete SHA-256 match the manifest. A damaged partial or cached
model must be discarded or refused, never marked ready. The short URL suffix is
not the full integrity check.

**Compare identity and compressed bytes.** The release manifest and asset index
provide full hashes. A reviewed sample file can ask the probe to check them:

```json
[
  {
    "origin": "https://your-instance.example",
    "path": "/catalog/assets/example.0123456789abcdef.svg",
    "cls": "public-immutable",
    "sha256": "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    "checkConditional": true,
    "checkRange": true,
    "requireStrongETag": true,
    "compress": true
  }
]
```

Replace the illustrative path and hash with the actual release values. Then run:

```bash
node scripts/edge-probe.ts --samples /path/to/samples.json --out /path/to/private-receipt.json
```

The probe checks cold responses, warm 304s, identity ranges and the decoded hash
of both compressed and identity bodies. It also rejects shared-cache evidence on
private responses and errors. Add samples for two private readers using separate
`credentialEnv` names and `credentialType: "cookie"` or `"bearer"`; keep the
credentials in the environment, never the sample URL. Use resources expected to
differ between those readers, so accidentally sharing a response is detectable.
Check CSP, COOP, COEP, CORP and Referrer-Policy in the browser as well. These must
survive the edge and must not disappear on 304 or error responses.

**Verify display renditions and original exports.** Open a rendition in Verify.
Its own Content Credential must describe resizing or transcoding, retain credits
and show the signed original as parent, or a source hash when the original has no
manifest. Reuse the rendition cache on a second build and compare the exact files
and index bytes. Select that asset in a tool and export: the document must use the
original format, even when the picker downloaded a smaller WebP for display.
Edge image optimisation must be off; serving a signed file cannot strip or
rewrite its credential.

**Check privacy and retention separately.** Every configured delivery hostname
needs a processor and jurisdiction entry in the instance's privacy notice.
Same-origin delivery is the default and introduces no new third-party CDN.
Private refusals and errors must return `private, no-store` and `CDN-Cache-Control:
no-store`. Principal-bound MCP download links are held in this release; their
qualification must demonstrate that another bearer cannot fetch a result and
that the same caller loses access after 300 seconds. Public rendering can remain
stale at an edge for one day plus seven days while revalidating unless the
operator changes the release cache key or purges the affected tags. The
deployment guide states that bound and the release steps; the probe cannot
establish a host's actual log retention.

## In the source

Everything above could still be theatre if the deployed code differed from the public code. So check the code - the deployment builds from [the public repository](https://github.com/lolly-tools/lolly):

```bash
git clone https://github.com/lolly-tools/lolly.git
cd lolly
```

The following source scan checks third-party tracking SDKs. It does not establish the absence of first-party usage reporting: lolly.work supports organisation telemetry and a separate audit log, with their own policy and tests.

**8. No tracker, no analytics SDK, anywhere.** Search the code that ships - the engine, every shell (including the browser extension, the Tauri bridge overrides and the service worker), the server functions and the tool packs - for the usual suspects:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' --include='*.html' \
  -e googletagmanager -e google-analytics -e posthog -e mixpanel -e hotjar \
  -e sentry.io -e segment.com -e '@vercel/analytics' \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output)
```

**9. No third-party DNS resolver.** Verify's SEAL check never routes lookups through a DNS-over-HTTPS provider - the web app simply has no resolver:

```bash
grep -rn --include='*.ts' --include='*.js' --include='*.mjs' \
  -e cloudflare-dns.com -e dns.google -e /dns-query \
  engine/src shells/*/src shells/chrome-extension shells/*/bridge-overrides \
  shells/web/public/sw.js services packages api community brands/*/tools
# (no output: outside this page and its built copies, the only place those
#  hostnames appear in the repo is tests/no-trackers.test.ts, the test that
#  bans them)
```

**10. The certificate service retains nothing.** The identity CA has no issuance log - not your email, not a timestamp, not a webhook. The absence is greppable:

```bash
grep -rn logIssuance services/ca api/ca
# (no output)
```

## Enforced by tests, not promises

The three source checks above aren't a one-time audit - they're pinned in the test suite, so they can't quietly rot. [`tests/no-trackers.test.ts`](https://github.com/lolly-tools/lolly/blob/main/tests/no-trackers.test.ts) fails the build if:

- any analytics or tracking SDK appears anywhere in the shipped source it scans - app, engine, server, extension and tool-pack code alike,
- any third-party DNS-over-HTTPS resolver appears in that source,
- the CA issuance log comes back - in the source **or** the generated server bundle,
- the privacy policy loses its legally required statements (named controller, legal basis, right to complain).

Run them yourself in the clone (Node 22.18+; no `pnpm install` needed for this file):

```bash
node --test tests/no-trackers.test.ts
# ✔ no analytics or tracking SDK appears anywhere in shipped source
# ✔ no third-party DNS-over-HTTPS resolver is contacted
# ✔ the certificate service logs no personal data
# ✔ privacy policy states a controller, a legal basis and a right to complain
```

The full suite (`pnpm install && pnpm test`) runs several thousand more, including the adversarial cryptography tests described in [Security & Verification](/info/security.html).

## What you can't verify from outside - said plainly

A page like this earns trust by naming its own limits:

- **Hosting access logs.** Any server that answers a request can log the request: IP, path and timestamp. An external probe cannot establish retention. The operator controls logging, rotation and any exports, and must disclose those choices. Local rendering keeps ordinary edits on your device; optional server rendering and shared workspace services have the separate data flows described in the privacy policy.
- **That the deployment runs this code.** You can verify the source is clean and that the deployed behaviour matches it (the checks above do both ends), but binary-level attestation of a web deployment isn't a thing the web platform offers. The mitigations are the public repo, the enforced tests and the offline check - a tampered deployment that phones home fails check 1 and 2 immediately.
- **Tool hooks are not sandboxed by default.** A tool's optional logic runs reviewed, in the page's own realm; every tool on lolly.tools is first-party and reviewed before it ships. Worker isolation now ships as a per-tool opt-in - a tool whose manifest sets `isolate: true` runs its hooks off-thread instead - so what you can't verify from outside is narrowing, but the default path is still in-realm and review is still the control. This is stated, not hidden - see the [design boundaries](/info/security.html) section, which has always said so.

## If a check fails

A discrepancy between this page and observed behaviour is a security report, and we'd genuinely rather hear it than not: [fitzy+security@suse.com](mailto:fitzy+security@suse.com), the **Report a vulnerability** button on any [lolly-tools repository](https://github.com/lolly-tools) or the contact in [`/.well-known/security.txt`](/.well-known/security.txt). Coordinated disclosure and reporter credit are the standing policy - [SECURITY.md](https://github.com/lolly-tools/lolly/blob/main/SECURITY.md) has the details.
