#
# spec file for package lolly-web
#
# Copyright (c) 2026 Lolly contributors.
#
# All modifications and additions to the file contributed by third parties
# remain the property of their copyright owners, unless otherwise agreed
# upon.
#
# Licensed under MPL-2.0. See LICENSE in the source tree.
#

# ---------------------------------------------------------------------------
# WHY THIS SPEC LOOKS LIKE THIS
#
# lolly-web is the Vite PWA shell built as a self-contained STATIC SITE. Its
# shells/web/dist tree carries everything the app needs at one origin: the app
# bundle, the ORT wasm runtime + models, fonts, the .html multi-page views, AND
# the tool catalog (catalog/, tools/, schemas/ are copied into dist by the vite
# closeBundle plugin). There is no server component - any static file server can
# host it. So this package is `noarch` and its payload is those files.
#
#   1. dist/ is PREBUILT and shipped inside Source0 - it is NOT built here.
#      The release build (scripts/build-release-web.ts) needs the whole umbrella
#      repo (submodules, workspaces, the generated tools/+catalog/ profile views),
#      a network (npm install, the ORT runtime download) AND the catalog signing
#      material (LOLLY_CATALOG_SIGNING_KEY + VITE_CATALOG_PUBLIC_KEY_JWK, which
#      bake a verified-only trust mode into the client). None of that exists in an
#      offline OBS worker, and the signing secret must never reach one. rpm/make-
#      sources.sh builds dist and stages it. This mirrors the lolly-desktop spec,
#      whose frontend is this same dist embedded into the Rust binary.
#
#   2. CROSS-ORIGIN ISOLATION IS MANDATORY. The app uses SharedArrayBuffer-backed
#      wasm (onnxruntime-web, harfbuzz, the codec workers), which the browser only
#      grants under Cross-Origin-Opener-Policy: same-origin AND Cross-Origin-
#      Embedder-Policy: credentialless. A plain static server that omits those two
#      headers serves a page that loads but whose ML / text-to-path / video
#      features silently refuse. The nginx config this package ships (Source1 +
#      Source2) sets them, along with the CSP, the correct .wasm/.avif/.webmanifest
#      MIME types, the immutable-vs-no-cache split, and the .html-twin SPA
#      fallback. It is lifted from deploy/docker/nginx.conf, which a repo test keeps
#      byte-aligned with the production vercel.json - so the headers here are the
#      same ones the hosted app runs behind. See rpm/README.md.
# ---------------------------------------------------------------------------

Name:           lolly-web
Version:        1.0.7
Release:        0%{?dist}
Summary:        On-brand creative asset generator - self-hostable web app (PWA)
License:        MPL-2.0
Group:          Productivity/Graphics/Other
URL:            https://lolly.tools

Source0:        lolly-web-%{version}.tar.zst
Source1:        lolly-web.nginx.conf
Source2:        lolly-web-security-headers.conf

# Static assets only - no compiler, no arch-specific code.
BuildArch:      noarch

# zstd: %%setup unpacks the .tar.zst Source0.
# fdupes: the build emits many byte-identical hashed chunks and duplicated
#   catalog previews; hardlinking them keeps the installed footprint down. Same
#   idiom the lolly-desktop spec uses on its icon set.
BuildRequires:  zstd
BuildRequires:  fdupes

# Static files work behind any web server, so nothing is a hard Requires. nginx is
# Recommended because this package ships a ready nginx server block (Source1) that
# already sets the isolation headers the app needs - see the header note above. An
# Apache/Caddy operator installs the files and replicates those headers by hand
# (README.md lists them); the payload is identical either way.
Recommends:     nginx

# openSUSE and Fedora auto-include nginx server blocks from different directories.
# One spec resolves on both by branching only this path.
%if 0%{?suse_version}
%global nginx_dropin %{_sysconfdir}/nginx/vhosts.d
%else
%global nginx_dropin %{_sysconfdir}/nginx/conf.d
%endif

%description
Lolly is a constraint-first, template-driven tool for generating on-brand
creative assets - QR codes, charts, diagrams, event badges, documents, filters
and more - as PNG, SVG, PDF or video.

This package is the web app: a self-contained Progressive Web App that runs
entirely in the browser. Tools are data, not code, so new tools ship without
updating the application. Everything renders on the visitor's device; nothing is
uploaded.

The app requires cross-origin isolation (Cross-Origin-Opener-Policy: same-origin
and Cross-Origin-Embedder-Policy: credentialless) to enable its WebAssembly
features. The bundled nginx configuration sets these headers along with the
Content-Security-Policy and cache rules the app expects. A server that omits them
will load the page but silently disable the on-device ML, text-to-path and video
features.

%prep
%setup -q

%build
# Nothing to compile: the site is prebuilt and shipped in Source0 (see the header
# note). This section exists only so the standard build machinery is happy.

%install
# The whole static site, verbatim, under an arch-independent data dir. The nginx
# root points here.
mkdir -p %{buildroot}%{_datadir}/lolly-web
cp -a html %{buildroot}%{_datadir}/lolly-web/html

# The nginx server block (auto-included on both distros) and the security-headers
# include it pulls in. The server block references the headers file by the absolute
# path below, and defines the $lolly_csp map, so a single include activates the lot.
# %%config(noreplace): an operator will set server_name, the port and TLS - keep
# their edits across upgrades.
install -Dm0644 %{SOURCE1} %{buildroot}%{nginx_dropin}/lolly-web.conf
install -Dm0644 %{SOURCE2} %{buildroot}%{_sysconfdir}/nginx/lolly-web/security-headers.conf

# Hardlink identical files (hashed chunk dupes, repeated previews) after the copy.
%fdupes %{buildroot}%{_datadir}/lolly-web

%check
# Fail the build if the prebuilt tree is missing the pieces the server config and
# the app itself assume - a half-built or wrong-profile dist otherwise ships and
# only fails in the browser.
test -f html/index.html
test -f html/sw.js
test -f html/manifest.webmanifest
# Same-origin catalog: the gallery is empty without it. Its presence also proves
# the vite closeBundle copy ran, i.e. this is a real release dist and not a bare
# `vite build`.
test -f html/catalog/tools/index.json
test -d html/tools
# The verified-trust release build signs the catalog index; an unsigned dist would
# make every client refuse the catalog. Guard against shipping one.
test -f html/catalog/tools/index.sig.json

%files
%license LICENSE
%doc README.md
%dir %{_datadir}/lolly-web
%{_datadir}/lolly-web/html
# Own our headers dir; the server block lives in nginx's own drop-in dir, which
# nginx owns (and which exists whenever the Recommends is honoured).
%dir %{_sysconfdir}/nginx/lolly-web
%config(noreplace) %{_sysconfdir}/nginx/lolly-web/security-headers.conf
%config(noreplace) %{nginx_dropin}/lolly-web.conf

%changelog
* Tue Sep 09 2026 Andy Fitzsimon <andyfitz@gmail.com> - 1.0.7-0
- First packaged release of the web shell as a self-hostable static PWA.
  Ships the prebuilt, catalog-signed dist and an nginx server block that sets
  the cross-origin isolation headers, CSP, wasm MIME types and cache rules the
  app requires (mirrors deploy/docker/nginx.conf and the production vercel.json).
