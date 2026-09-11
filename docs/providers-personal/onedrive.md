# OneDrive / O365 (kind: `o365`)

## What you register on Microsoft's side

1. [Entra admin centre](https://entra.microsoft.com) (or portal.azure.com) →
   App registrations → New registration.
2. Supported account types: **Accounts in any organizational directory and
   personal Microsoft accounts** (consumer OneDrive + work/school in one).
3. Platform: **Single-page application** - this is load-bearing twice over:
   SPA redirect URIs are what make the token endpoint answer CORS from a
   browser, and what allow a public client (no secret) to run
   authorization-code + PKCE. Registering the redirect under "Web" instead
   breaks the exchange.
4. Redirect URIs (under the SPA platform): `<origin>/oauth-return.html` for
   every deploy origin.
5. API permissions → Microsoft Graph → Delegated: `Files.ReadWrite.AppFolder`
   (the app's own folder under `Apps/`, never the whole drive), `User.Read`,
   `offline_access`. No admin consent needed for these.
6. Copy the **Application (client) ID**.

## What the deploy sets

`VITE_MS_CLIENT_ID=<application id>` - dev: `shells/web/.env.local`; prod: the
deploy env. No id → the OneDrive rows and buttons do not exist.

The deploy CSP must allow the Graph upload-session hosts for files over 4 MB
(both copies of the policy - the root `vercel.json` and the `$lolly_csp` map in
`deploy/docker/nginx.conf` - already list `graph.microsoft.com`,
`login.microsoftonline.com`, `api.onedrive.com`, `*.up.1drv.com`,
`*.sharepoint.com`); a deploy that trims them keeps small files working and
large uploads fail with an honest message.

## The DESKTOP apps (plans/129 WP4b) - a second platform on the registration

The Tauri shells sign in through the person's own browser and take the redirect
on a loopback listener, so the SPA registration above does not fit them: a token
exchange from a native client sends no `Origin` header, which means an
SPA-registered redirect URI is refused, and a Web-registered one demands a
client secret this app has nowhere to keep. The public-client shape Microsoft
offers for this is a different platform on the same (or a separate) app:

1. The app registration → Authentication → Add a platform → **Mobile and
   desktop applications**.
2. Custom redirect URI: `http://localhost/oauth-return`. Microsoft allows
   `http` for localhost and **ignores the port** when matching a localhost
   reply URL, so this one entry covers every ephemeral port the listener binds.
   The PATH must match exactly, so keep `/oauth-return` verbatim.
   (`http://127.0.0.1/...` cannot be added through the portal UI at all - a
   manifest edit only - which is why the desktop leg uses the `localhost` form.)
3. Same delegated permissions as above. Still a public client, still
   authorization-code + PKCE, still no secret.
4. Copy the **Application (client) ID** - the same one, if you added the
   platform to the existing registration.

The deploy sets `VITE_MS_DESKTOP_CLIENT_ID` for the desktop frontend build. No
id → no OneDrive UI in the desktop apps (the web `VITE_MS_CLIENT_ID` does
nothing there, and vice versa). An org can also supply its own at runtime with
`setOneDriveDesktopClientId`, e.g. from a brand instance or a `.lolly` pack.

## Verify

/profile → Connected services → OneDrive → Connect → the account appears.
Export a small file (goes straight to Graph) and a video over 4 MB (goes
through an upload session in 3.75 MB chunks - the chunk PUTs carry NO
Authorization header by Graph's contract). Reload and send again: no popup -
Microsoft rotates refresh tokens and Lolly re-saves the new one each time.
