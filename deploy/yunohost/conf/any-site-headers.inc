# "Allow pages from any site" (plan 288): the one policy that differs from
# security-headers.inc, for the app shell served at /any-site/ only. nginx.conf's
# /any-site location includes security-headers.inc first and this file after it;
# for a header both set, the later more_set_headers wins, so only the
# Content-Security-Policy changes, and inside it only frame-src. The web app sends a
# visitor back to / unless they turned the setting on, on their own device.
# tests/yunohost-package.test.ts checks the two files differ in frame-src alone.
more_set_headers "Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-eval' 'wasm-unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' blob: data: https://lolli.li https://www.googleapis.com https://fonts.googleapis.com https://fonts.gstatic.com https://api.somafm.com https://registry.color.org https://www.color.org https://geocoding-api.open-meteo.com https://api.dropboxapi.com https://content.dropboxapi.com https://login.microsoftonline.com https://graph.microsoft.com https://api.onedrive.com https://*.up.1drv.com https://*.files.1drv.com https://my.microsoftpersonalcontent.com https://*.sharepoint.com__LOLLY_CSP_EXTRA_CONNECT_SRC__; img-src 'self' data: blob:; media-src 'self' blob: data: https://*.somafm.com; font-src 'self' data: blob:; worker-src 'self' blob:; child-src 'self' blob:; frame-src 'self' blob: https: http://localhost:* http://127.0.0.1:*; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'";
