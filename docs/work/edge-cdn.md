# Put a CDN in front of Lolly Work

A CDN can serve Lolly Work's public files from places near your visitors and take load off the
server. This page is for the operator who wants to put Bunny or Cloudflare in front of an
instance. Lolly Work never needs a CDN: an instance with no edge configured keeps working as before,
air-gapped included.

A CDN sees more than it stores. It answers every request on the hostname it fronts, so it decrypts
sign-ins, session cookies, tokens and private files on their way through, even when it caches
none of them. Lolly Work therefore decides which provider may front which hostname before anything else,
and refuses to start when a configuration breaks that rule.

## What a CDN may cache

Lolly Work labels every response with a delivery class. A CDN may store only the public classes, and only
for a request that carried no credential of any kind (no cookie, no `Authorization` header, no
`x-lw-*` header and no install token):

- the app's hashed bundles, which never change under their name;
- the app page, the service worker, the manifest and other files that every visit revalidates;
- brand logos, fonts and theme files, and the connect pack on an open instance;
- share cards for tools that every member may see.

Everything else is private: sessions, projects, the catalog feed, member renders, uploads, errors
and every answer to a signed-in person. Those responses say `Cache-Control: private, no-store`
and `CDN-Cache-Control: no-store`, whatever the CDN's own defaults are.

This release covers public classes only. Edge tokens for private catalog bytes (`/e/`) and
presigned downloads from object storage (`/o/`) are not built, so no CDN setting here makes a
private file cacheable.

## The jurisdiction rule

Jurisdiction is decided per hostname, never per route, because the CDN terminates TLS for every
route on a hostname. `edge.jurisdiction` is `"eu-only"` unless you choose `"any"`.

Under `"eu-only"`, a provider may front a hostname that serves anything private only when its
company, its edge locations and its logs are all in the EU (or self-hosted):

| Provider | Company | Edge locations | Logs | Under `eu-only` |
|---|---|---|---|---|
| Bunny | EU (Slovenia) | EU only with `"regions": ["europe"]`, otherwise global | you state it after reading Bunny's terms | may front the instance hostname once restricted to Europe and logs are stated as EU |
| Cloudflare | US | global | not EU | may front only a separate hostname marked `publicOnly` |

The instance's own hostnames (`instance.baseUrl` and `instance.appUrl`) serve sign-in, sessions
and private files, so they can never be marked `publicOnly`, under any policy. A configuration that
breaks the rule stops the server at boot with a message that gives the provider, the hostname and
what to change.

A `publicOnly` hostname, such as `assets.example.org`, answers public reads and nothing else:

- Lolly Work removes every credential from requests that arrive there, so nobody can act as a person
  through that hostname;
- a route that is never public answers `404 PUBLIC_HOST_ONLY` without running;
- any other answer that turns out not to be public is replaced by the same empty refusal before
  a byte of it leaves the server;
- writes answer `405`.

Lolly Work recognises the hostname from the request's `Host` header. Keep the provider forwarding the
original `Host`, which is Cloudflare's default; an origin rule that rewrites it to the instance
hostname defeats this check, and `lw edge probe` reports that.

## Configure a provider

Providers live in `instance.json` under `edge`. This example puts Bunny in front of the instance
and Cloudflare in front of a public assets hostname:

```json
"edge": {
  "jurisdiction": "eu-only",
  "providers": [
    {
      "id": "eu-cdn",
      "kind": "bunny",
      "hostnames": ["work.example.org"],
      "credentialRef": "LW_EDGE_BUNNY_KEY",
      "options": { "pullZoneId": 123456, "regions": ["europe"] },
      "jurisdiction": { "logs": "eu" }
    },
    {
      "id": "assets",
      "kind": "cloudflare",
      "hostnames": ["assets.example.org"],
      "publicOnly": true,
      "options": { "zoneId": "0123456789abcdef0123456789abcdef", "plan": "pro" }
    }
  ]
}
```

| Field | Meaning |
|---|---|
| `id` | A short id, used in purges, the audit log and `lw edge`. |
| `kind` | `bunny` or `cloudflare`. |
| `hostnames` | The hostnames whose DNS points at this provider. One hostname has one provider. |
| `publicOnly` | `true` makes the hostname answer public reads only (see above). |
| `credentialRef` | The environment variable that holds the API key or token. Leave it out to store a sealed credential instead. |
| `options` | Bunny: `pullZoneId` and optionally `regions: ["europe"]`. Cloudflare: `zoneId` and optionally `plan` (`free`, `pro`, `business` or `enterprise`, default `free`), which sets the purge budget. |
| `jurisdiction` | Facts you state about the provider. A statement may fill in what Lolly Work cannot know (Bunny's log location), never contradict what it does know: Cloudflare cannot be declared an EU company. |

Unknown keys are refused, so a typo cannot leave a setting silently off.

### Credentials

The credential never goes in `instance.json`. Either:

- set the environment variable that `credentialRef` names; Lolly Work reads it once at boot, or
- leave `credentialRef` out and run `lw edge credential <id>`, which prompts for the key and never
  echoes what you type. Lolly Work reads the zone with the key first and refuses a key that cannot, then
  stores the key sealed with `LW_CREDENTIAL_SECRET` (AES-256-GCM, bound to that provider). Set
  `LW_CREDENTIAL_SECRET` before you store one.

Lolly Work shows a stored credential only by its fingerprint, in `lw edge status` and the audit log. Use
a key with the least access the provider offers: for Cloudflare, an API token with Cache Purge and
Zone Settings Read on that zone only. Bunny's account API key reaches the whole account, so keep it
to the server that runs Lolly Work.

## Settings that must stay off

These features rewrite bytes, strip Content Credentials, break the Content Security Policy or serve
files without Lolly Work's checks. `lw edge probe` reads each one through the provider's API and fails
when one is on.

Bunny:

- **Bunny Optimizer** off. It rewrites images and strips their metadata.
- **Smart Cache** off. It caches by file type instead of the origin's headers.
- **Cache expiration time** set to respect the origin's Cache-Control.
- **Cache error responses** off.
- **Cookie vary**, **WebP vary** and **AVIF vary** off.
- **Perma-Cache** off: Bunny does not purge by tag with it on.
- **Regions** limited to Europe for an EU hostname, and the origin shield in Europe if you use one.
- **Log IP anonymisation** on; check where forwarded or stored logs go.

Cloudflare:

- **Polish**, **Mirage** (retired by Cloudflare in 2025), **Rocket Loader**, **Email Address
  Obfuscation**, **Automatic HTTPS Rewrites** and **Always Online** off.
- **Image transformations** off, including "resize from any origin". With them on, anyone can ask
  `/cdn-cgi/image/<options>/<any path>` for a transformed copy of a file without Lolly Work's checks.
- No **cache rule** that overrides the origin's edge cache time. A rule that sets "Ignore cache-control
  header and use this TTL" can store responses Lolly Work marks private.
- Files above 512 MB are not cached on Free, Pro and Business plans; they pass through to Lolly Work.

## Tags and purges

With a provider configured, Lolly Work adds purge tags to public answers: `CDN-Tag` for Bunny and
`Cache-Tag` for Cloudflare, comma separated. Tags are opaque digests, never names:

| Tag | Stands for |
|---|---|
| `b_<revision>` | the brand revision that logos, fonts and theme files belong to |
| `h_<digest>` | exact bytes, such as one connect pack |
| `t_<tool id>` | a tool's share card |
| `x_<class>` | the delivery class |
| `o_<instance>` | everything this instance put on the edge |

A private or signed-in answer never carries a tag, and without a configured provider no answer
does.

Lolly Work queues a purge when public bytes change meaning: a brand change (`b_` of the old revision), a
new or withdrawn connect pack (`h_` of the old pack), and a tool's visibility changing through the
policy editor or a governance apply (`t_` and the card's URL). Purges wait in an outbox, go out in
batches within each provider's documented budget (Cloudflare Free allows 5 tag purges a minute;
Bunny 5 a second after a burst of 120) and retry with backoff, honouring `Retry-After`. A purge never
holds up or reverses the change: a hidden tool is hidden at the origin at once, and a public card an
edge still holds expires within an hour even if every purge fails.

```sh
lw edge status                              # providers, credential fingerprints, recent purges
lw edge purge --tag t_qr-code               # every configured provider
lw edge purge --url https://assets.example.org/catalog/og/qr-code.png
lw edge purge --tag o_<instance>            # everything this instance put on the edge
```

## Check the edge

Run the probe after every change to the provider, its zone or Lolly Work's configuration:

```sh
lw edge probe work.example.org --origin https://origin.example.org
```

It makes read-only requests with no credential (only made-up cookies that sign nobody in) and
checks that:

- private answers and errors are never served from a shared cache, even with different cookies;
- the security headers arrive exactly as the origin sends them, when you pass `--origin`;
- no purge-tag header reaches the client;
- `/cdn-cgi/image/` is refused;
- on a `publicOnly` hostname, private routes are refused.

Signed in as an owner on `--base`, it also reads the zone through the provider's API and reports
each setting above. It exits non-zero on any failure.

Some provider behaviour is not settled by the providers' documentation, so the probe measures it
rather than trusting it: how Bunny separates several tags in `CDN-Tag` and how its tag purge
matches them, whether Bunny honours `private` and `no-store` and reads `CDN-Cache-Control`, and
whether Cloudflare honours `no-transform`. Until a live check has confirmed Bunny's tag matching,
purge important URLs with `--url` as well.
