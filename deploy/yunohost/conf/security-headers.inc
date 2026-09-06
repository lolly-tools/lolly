# Security headers for every Lolly response, as `more_set_headers` lines: a
# YunoHost domain sets its own baseline (HSTS, X-Frame-Options, a permissive
# Content-Security-Policy, Referrer-Policy same-origin) at server level with the
# same module, and its directives run first. For a header both set, the later
# one - this file's - wins, so Lolly's policy replaces the permissive defaults
# while the baseline headers Lolly does not set (HSTS, X-Frame-Options) stay.
# Verified against nginx 1.22 + headers-more on Debian 12 (YunoHost 12).
#
# The set is byte-identical to the hosted deployment's vercel.json and
# deploy/docker/security-headers.conf - tests/security-headers.test.ts and
# tests/yunohost-package.test.ts fail the build if the copies disagree.
#
# Every nginx location that sets a header of its own includes this file again.
# That is not strictly required with this module (unlike nginx's own header
# directive, whose inherited entries vanish in such a location), but it keeps
# the policy next to every Cache-Control and costs nothing.
#
# The CSP is not strict on purpose: tool hooks run through `new Function`
# (engine/src/runtime.ts) so script-src carries 'unsafe-eval'. The directive doing
# the work is connect-src - injected script cannot exfiltrate to an arbitrary host.
# The two Google Fonts hosts serve the opt-in brand-editor font picker and
# lolli.li serves the on-device ML models; an instance that wants neither can
# drop those hosts and the features fail closed.
more_set_headers "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' blob: data: https://lolli.li https://www.googleapis.com https://fonts.googleapis.com https://fonts.gstatic.com https://api.somafm.com https://registry.color.org https://www.color.org https://geocoding-api.open-meteo.com https://api.dropboxapi.com https://content.dropboxapi.com https://login.microsoftonline.com https://graph.microsoft.com https://api.onedrive.com https://*.up.1drv.com https://*.sharepoint.com; img-src 'self' data: blob:; media-src 'self' blob: data: https://*.somafm.com; font-src 'self' data: blob:; worker-src 'self' blob:; child-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'";
more_set_headers "Referrer-Policy: no-referrer";
more_set_headers "X-Content-Type-Options: nosniff";
more_set_headers "Cross-Origin-Opener-Policy: same-origin";
more_set_headers "Cross-Origin-Embedder-Policy: credentialless";
more_set_headers "Permissions-Policy: camera=(self), microphone=(self), display-capture=(self), geolocation=()";
