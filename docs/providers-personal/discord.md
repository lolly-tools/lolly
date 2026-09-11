# Discord (kind: `discord`)

## What you register - nothing; the channel issues the credential

A channel WEBHOOK is the whole integration: Server → channel → Edit channel →
Integrations → Webhooks → New webhook → Copy URL. No OAuth, no app, no
review queue.

## What the person does

/profile → Connected services → Discord → paste the webhook URL → **Save &
test** (the test reads the webhook's own name back from Discord). Sends then
post the export as a real file attachment into that channel.

## Custody - the honest warning

A webhook URL is a bearer capability: anyone holding it can post to that
channel (not read it). It is stored like the S3 keys - device-local, never in
backups, wiped by Disconnect - and the in-app note says to treat it like a
key. Rotating the webhook in Discord invalidates the old URL everywhere.

## Limits

Attachment size is the server's own (boost-dependent); an over-size refusal
is reported as that, not a raw status code. Every export format is accepted -
Discord previews images/video inline and offers the rest as downloads.

## Verify

Export any format → Send to Discord → the message appears in the channel and
the status link opens the attachment's CDN URL.
