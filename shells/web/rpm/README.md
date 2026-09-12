# lolly-web RPM

Packages the Lolly web shell (`shells/web`) as a self-hostable static PWA for
RPM distributions (openSUSE Tumbleweed / Leap, Fedora, RHEL and friends).

This is the sibling of `shells/tauri-desktop/rpm/` (the desktop GUI app). This
package is `noarch`: it ships the built static site plus an nginx server config.

## What it installs

| Path | What |
|---|---|
| `/usr/share/lolly-web/html/` | the built PWA (app bundle, ORT wasm + models, fonts, `.html` views, and the same-origin `catalog/`, `tools/`, `schemas/` trees) |
| `/etc/nginx/vhosts.d/lolly-web.conf` (openSUSE) or `/etc/nginx/conf.d/lolly-web.conf` (Fedora) | a ready nginx server block, `%config(noreplace)` |
| `/etc/nginx/lolly-web/security-headers.conf` | the header include the server block pulls in, `%config(noreplace)` |

`nginx` is a **Recommends**, not a Requires - the static files work behind any
server. If you use Apache/Caddy instead, serve `/usr/share/lolly-web/html` and
replicate the headers below by hand.

## Cross-origin isolation is mandatory

The app uses SharedArrayBuffer-backed WebAssembly (onnxruntime-web, harfbuzz, the
codec workers). Browsers only grant that under **both**:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

A server that omits them serves a page that loads but whose on-device ML,
text-to-path and video features silently refuse. The bundled nginx config sets
them, plus the CSP, the `.wasm`/`.avif`/`.webmanifest` MIME types, the
immutable-vs-no-cache split, and the `.html`-twin SPA fallback. It is lifted from
`deploy/docker/nginx.conf`, which `tests/security-headers.test.ts` keeps aligned
with the production `vercel.json` - so these are the same headers the hosted app
runs behind.

## Why the dist is prebuilt (Source0)

The site is **not** compiled inside the RPM build. The release build
(`scripts/build-release-web.ts`) needs the whole repository (its workspaces and its
content packs, out of which `materializeInto()` writes the `tools/` + `catalog/` tree
the built site serves), a network, and the catalog signing material (`LOLLY_CATALOG_SIGNING_KEY` + `VITE_CATALOG_PUBLIC_KEY_JWK`,
which bake a verified-only trust mode into the client). None of that exists in an
offline OBS worker, and the signing secret must never reach one. So `make-sources.sh`
builds `shells/web/dist` here and stages it as `Source0`. This mirrors the
lolly-desktop spec, whose frontend is this same dist.

A **public** package must be built on the neutral `lolly-start` profile
(`LOLLY_PROFILE=lolly-start`) - the SUSE tools and assets must never ship in a public
RPM. `make-sources.sh` warns if the active profile is something else.

## Building

```bash
# 1. Stage the sources (build the signed dist, then tar it).
#    Needs LOLLY_CATALOG_SIGNING_KEY + VITE_CATALOG_PUBLIC_KEY_JWK in the env.
cd shells/web/rpm
./make-sources.sh --build

# ...or reuse an already-built shells/web/dist:
./make-sources.sh

# 2. Build the RPM.
rpmbuild -bb --define "_sourcedir $PWD/out" out/lolly-web.spec

# ...or point an OBS package at the four files in out/.
```

## Putting it into service

The shipped server block listens on `:8080` with `server_name _` so it never
collides with the distro's stock `:80` default server. Edit
`/etc/nginx/{vhosts.d,conf.d}/lolly-web.conf` for your host (real `server_name`,
`:80`/`:443`, TLS certs - the block has a commented TLS example), then:

```bash
nginx -t && systemctl reload nginx
```

Visit `http://<host>:8080/`. `GET /healthz` returns `ok` for uptime probes.

### Headers, if you serve it yourself

```
Content-Security-Policy:        <see lolly-web.nginx.conf $lolly_csp map>
Cross-Origin-Opener-Policy:     same-origin
Cross-Origin-Embedder-Policy:   credentialless
Referrer-Policy:                no-referrer
X-Content-Type-Options:         nosniff
Permissions-Policy:             camera=(self), microphone=(self), display-capture=(self), geolocation=()
```

Plus: `sw.js` and `index.html` no-cache; `/assets/`, `/ort/`, `/fonts/`
immutable; `.wasm` served as `application/wasm`; and the SPA fallback
`try_files $uri $uri.html $uri/index.html /index.html`.
