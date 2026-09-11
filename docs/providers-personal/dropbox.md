# Dropbox (kind: `dropbox`)

## What you register on Dropbox's side

1. [Dropbox App Console](https://www.dropbox.com/developers/apps) → Create app.
2. API: **Scoped access**. Access type: **App folder** - the token can only
   ever see `Apps/<your app name>/`, which is the honesty the in-app hint
   promises.
3. Permissions tab → enable `files.content.write`, `files.content.read`
   (the short-lived "Open" link; no public share is ever created) and
   `account_info.read` (the /profile account label). Submit.
4. Settings tab → **Redirect URIs**: add `<origin>/oauth-return.html` for
   every deploy origin (e.g. `http://localhost:5173/oauth-return.html`,
   `https://lolly.tools/oauth-return.html`).
5. Copy the **App key** - that is the client id (there is no secret in play:
   the flow is authorization-code + PKCE for a public client, with
   `token_access_type=offline` for the stay-connected refresh token).

## What the deploy sets

`VITE_DROPBOX_CLIENT_ID=<app key>` - dev: `shells/web/.env.local`; prod: the
deploy env.

## The DESKTOP apps (plans/129 WP4b) - the same app key, nothing to register

The Tauri shells run sign-in in the person's SYSTEM browser and receive the
redirect on a loopback listener, like Google Drive - but unlike Google there is
no second client to create. Dropbox's own OAuth documentation states that
localhost redirect URIs are allowed without pre-registration, over http or
https, so the desktop leg uses `http://localhost:<port>/oauth-return` with an
ephemeral port and the SAME app key as the web. Two details worth keeping
straight:

- The host must read `localhost`. The `127.0.0.1` form is not documented as
  exempt, so it is not used here.
- Nothing goes in the app's Redirect URIs list for the desktop apps. The list
  above is only for the web origins.

`VITE_DROPBOX_CLIENT_ID` in the desktop frontend build is what makes the row
appear there without the person supplying a key - and if the build ships no id,
the bring-your-own path below now works on the desktop too.

## No deploy id? Bring your own

A deploy with no registration still shows the Dropbox row: it asks for an **App
key** instead of hiding. Do the registration above for yourself (on the web the
redirect URI is this deploy's `<origin>/oauth-return.html`; in the desktop apps
there is nothing to add, because Dropbox exempts localhost), paste the App key
into the /profile row, and Connect. The key rides the connection record on this
device - custody follows the same "stay connected" choice as the tokens, and
Disconnect wipes it. This path now works in the Tauri shells as well as the web:
the system-browser leg replaced the popup that used to require a real browser.

## Verify

/profile → Connected services → Dropbox → Connect (tick "Stay connected on
this device" to test custody) → the account email appears. Export any format →
Send to Dropbox → the file lands in `Apps/<app>/` and the status link opens it.
Reload and send again: no popup - the refresh grant (production status of the
Dropbox app can stay "development" for personal use; apply for production
when the user count grows).
