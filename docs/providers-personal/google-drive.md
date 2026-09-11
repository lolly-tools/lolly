# Google Drive (kind: `gdrive`)

## What you register on Google's side

1. [Google Cloud console](https://console.cloud.google.com) → a project →
   Google Auth Platform (OAuth consent screen): External; Testing mode with
   test users is enough while the only scope is `drive.file` (non-sensitive -
   no app verification needed); add branding + move to production when the
   deploy is public.
2. **Enable the Google Drive API** (APIs & Services → Library) - uploads 403
   without it.
3. Clients → Create client → **Web application**:
   - Authorised JavaScript origins: every deploy origin
     (`http://localhost:5173`, `https://lolly.tools`, …). Add BOTH dev ports
     if a second Vite instance may run (`:5173` and `:5174` - a mismatch is
     `Error 400: redirect_uri_mismatch`).
   - Authorised redirect URIs: `<origin>/oauth-return.html` for each.
4. Copy the client id.

## What the deploy sets

`VITE_GOOGLE_CLIENT_ID=<client id>` - dev: `shells/web/.env.local`; prod: the
deploy env. No id → no Drive UI anywhere.

## The grant, and why it differs from Dropbox/OneDrive

Google web clients require a secret for authorization-code exchange, so this
driver uses the implicit token grant: the token lives in memory for the
session only and there is no refresh token - which is why the /profile row
says "signs in when you send" instead of offering stay-connected. Re-consent
after the first grant is a fast auto-closing popup.

## The DESKTOP apps (plans/129 WP4) - a second, Desktop-type client

The Tauri shells run sign-in in the person's SYSTEM browser with a loopback
return (Google refuses OAuth inside embedded webviews, and managed-account
SSO already lives in the default browser - for Workspace users the sign-in
collapses to an account-chooser click). That flow needs its own client:

1. Same Cloud project → Clients → Create client → **Desktop app**. No origins
   or redirect URIs to enter - Google's Desktop type accepts loopback
   `http://127.0.0.1:<any port>` redirects by design.
2. Copy the client id AND the client secret. For installed apps Google's own
   docs state the secret is NOT treated as confidential - it ships in every
   native binary using this flow; that is why it may sit in build config.
3. The deploy sets `VITE_GOOGLE_DESKTOP_CLIENT_ID` and
   `VITE_GOOGLE_DESKTOP_CLIENT_SECRET` for the desktop frontend build. No
   pair → no Drive UI in the desktop apps (the web pair does nothing there).

Desktop uses code+PKCE, so unlike the web it CAN mint refresh tokens: the
/profile row offers "Stay connected on this device", with the refresh token
stored under the same custody rules as Dropbox.

An org can also supply its OWN Desktop client at runtime
(`setDriveDesktopClient`, e.g. from a brand instance or `.lolly` pack): a
Workspace-internal client skips the unverified-app interstitial and is
admin-trusted by construction.

## Verify

Export anything → Send to Google Drive → account picker → `drive.file`
consent (first time) → the file lands in Drive. An EMF converts into a native
Google Drawing (the Slides journey); every other format uploads with its real
MIME type via the Drive API - which is the one path that sets the stored type
correctly (Drive re-types plain web uploads from its extension table).
