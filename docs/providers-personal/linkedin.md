# LinkedIn (kind: `linkedin`) - DESKTOP APPS ONLY

## What you register on LinkedIn's side

1. [LinkedIn developer portal](https://www.linkedin.com/developers/apps) →
   Create app. It must be attached to a LinkedIn **Page** you administer; the
   app is verified by an admin of that Page in one click.
2. Products tab → request both, each self-serve and granted immediately:
   - **Sign In with LinkedIn using OpenID Connect** - the `openid profile`
     scopes and the `/v2/userinfo` call that names the member and gives the
     author URN every post needs.
   - **Share on LinkedIn** - the `w_member_social` scope, which is what allows
     posting to the member's own feed.
3. Auth tab → **Authorized redirect URLs**. LinkedIn matches these EXACTLY -
   host, port and path, with no port wildcard - so add all three the desktop
   app may bind:
   - `http://localhost:47811/oauth-return`
   - `http://localhost:47812/oauth-return`
   - `http://localhost:47813/oauth-return`

   Three because a port can be occupied; the app tries them in order and fails
   with an honest message if all three are taken rather than binding a port your
   registration does not name. The list lives in one place in the code
   (`LINKEDIN_LOOPBACK_PORTS` in `shells/web/src/lib/linkedin-send.ts`) - change
   it there and here together.
4. Copy the **Client ID** and the **Client Secret**.

## What the deploy sets

`VITE_LINKEDIN_CLIENT_ID` and `VITE_LINKEDIN_CLIENT_SECRET`, for the DESKTOP
frontend build only. No pair → no LinkedIn row and no button (the dormant
rule). An org can supply its own at runtime instead, with `setLinkedInClient`
from a brand instance or a `.lolly` pack.

**Be clear-eyed about that secret.** LinkedIn requires a `client_secret` at its
token endpoint - the authorization-code exchange fails without one - and it
treats that secret as confidential. PKCE, which is what lets every other
provider here run as a public client with no secret at all, is enabled per app
for partner applications only; sending PKCE parameters to the ordinary endpoint
breaks the exchange, so the driver deliberately does not send them. A secret
compiled into a desktop binary is therefore extractable by anyone holding the
binary. The honest position: a shipped LinkedIn build should use a registration
an **organisation owns** and accepts as an installed-app credential, with a plan
to rotate it if it leaks. The hosted lolly.tools build ships no LinkedIn pair,
so nothing about this reaches the web app.

## Why there is no web row

Two independent blockers, either one sufficient. The secret above cannot live in
a page every visitor can read. And `api.linkedin.com` answers no CORS for
browsers, so even a secret-free flow could not upload or post from a web origin.
Both disappear in the Tauri shells, where requests go through the CORS-free
Tauri HTTP client and the credential ships inside a distributed binary. So the
target and the /profile row gate on `isTauriShell()`, and the two LinkedIn hosts
are deliberately absent from the web app's Content-Security-Policy - the
consent-ledger row in `docs/privacy.md` says exactly that, and a test holds both
halves of the claim together.

## Custody: a 60-day token and no refresh

LinkedIn access tokens last 60 days, and programmatic refresh tokens are a
partner-only feature, so the access token IS the connection (the Mastodon
shape). Session-only custody keeps it in memory for the session; "stay connected
on this device" writes it into the connection record at rest - device-local,
never in a portable backup, wiped by Disconnect, and revoked best-effort at
LinkedIn's revoke endpoint on the way out. When the 60 days are up, sends stop
with "your LinkedIn session ended - connect again in Profile". There is nothing
to refresh, and the app does not pretend otherwise.

## What a send does

An image (PNG, JPG, GIF) or a document (PDF, PPTX, DOCX; 100 MB and 300 pages
are LinkedIn's caps - the byte cap is checked before the upload starts) is
posted to the member's OWN feed as a PUBLIC post, with the export's name as the
post text. Three calls: `initializeUpload` for a one-shot upload URL and the
asset URN, a `PUT` of the bytes, then the post itself. The bytes are the
exported bytes - Content Credentials and metadata travel intact, though LinkedIn
re-encodes images server-side like every social platform, so treat the copy on
their servers as theirs.

## Verify

Desktop app → /profile → Connected services → LinkedIn → Connect (tick "Stay
connected on this device" to test custody). Your own browser opens, LinkedIn
asks for consent to the two products' scopes, the tab says you can return, and
the row shows your name. Then export a PNG → Send to LinkedIn → the status link
opens the new post on your feed. Try a PDF too: it takes the documents path and
appears as a carousel-style document post.
