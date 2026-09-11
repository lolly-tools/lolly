# Mastodon (kind: `mastodon`)

## What you register - nothing, anywhere

There is no central Mastodon and deliberately no central Lolly client id.
Every Mastodon server offers dynamic app registration (`POST /api/v1/apps`),
so the moment a person connects, Lolly registers a per-server, per-device
client on the spot with the scopes it needs and nothing else:
`write:media write:statuses read:accounts`.

Because the desktop sign-in returns on a loopback port that differs per
attempt (and Mastodon matches redirect URIs exactly), each interactive
connect registers a fresh app. Registrations are free; idle ones are inert.

## What the deploy sets

Nothing. The Mastodon row always exists in /profile → Connected services -
it needs nobody's app-review queue.

## Custody

Mastodon access tokens are long-lived and there is no refresh grant, so the
token itself is what "Stay connected on this device" stores - device-local,
never in backups, wiped by Disconnect (with a best-effort server-side revoke).
Session-only keeps it in memory and it is gone on reload.

## Verify

/profile → Connected services → Mastodon → enter your server (e.g.
`mastodon.social`) → Connect → your server's own sign-in page opens (the
system browser on desktop, a popup on the web) → the `@you@server` handle
appears. Export a PNG → Send to Mastodon → the post URL opens your toot with
the image attached and the filename as text + alt text. Media limits are your
server's own; a refusal is reported as such.
