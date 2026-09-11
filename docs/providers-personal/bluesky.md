# Bluesky (kind: `bluesky`)

## What you register - nothing

Bluesky sends use an APP PASSWORD, not OAuth: the person makes one in their
own Bluesky settings and enters it in /profile. No app registration, no
client id, no review queue.

## What the person does

1. Bluesky → Settings → Privacy and security → **App passwords** → Add. Name
   it (e.g. "Lolly") and copy the generated password.
2. Lolly /profile → Connected services → Bluesky: service URL (default
   `https://bsky.social`; self-hosted PDS users enter their own), handle, app
   password → **Save & test** shows `Connected as @handle`.

Never the account password - the in-app note says so too. Revoking the app
password in Bluesky settings kills Lolly's access instantly.

## Custody

The credential trio is stored exactly like the WebDAV app password:
device-local, never in backups, wiped by Disconnect. Each send mints a fresh
short-lived session from it; no JWTs are kept.

## Limits

Image posts only (`png`/`jpg`/`webp`/`gif`), and atproto caps an image blob at
about 1 MB - Lolly checks before uploading and says so plainly. The post text
and alt text are the export's name.

## Verify

Export a PNG under 1 MB → Send to Bluesky → the status link opens the post at
`bsky.app/profile/<handle>/post/<key>`. Export something over 1 MB → the
size sentence appears with no network traffic.
