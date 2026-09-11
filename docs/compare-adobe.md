# Lolly and Adobe

_Last checked: August 2026._

Lolly is not a replacement for Adobe's Creative Cloud, though it does what many people need Photoshop or Express for: resizing and converting images, stripping metadata, adding a watermark or Content Credentials, and exporting a print-ready PDF.

## Where they overlap

Both export professional formats (PDF/X, CMYK, high-bit-depth raster) and both can write C2PA Content Credentials. Adobe signs Content Credentials locally in its desktop apps.

## What Adobe does better today

Deep pixel and vector editing, the widest professional toolset, and the largest ecosystem of plugins and integrations. For freeform creative editing, Adobe leads.

## What Lolly does instead

It signs Content Credentials on the device with no Adobe account and no Adobe-provisioned certificate, and it runs the same render path in the browser, on the desktop and in the terminal. Adobe's own web route, the Content Authenticity app, signs in the cloud: uploads are capped at 20 MB of JPG or PNG, a thumbnail of your image is retained and it has stayed in beta sixteen months after launch (August 2026). With Lolly every file stays on your machine. The on-device transform utilities add nothing to your file; rendered raster output carries Lolly's own invisible Imprint mark by default (presence-only, no personal data), and it is one switch to turn off.

One concession rides with the signing claim: a credential signed with an on-device key reads as unverified in a stranger's stock validator today. The structure and the tamper evidence are real; the signer identity is simply not vouched for by an authority. That is the stranger case. An organization can anchor trust in its own certificate authority and pin its own root, so its files verify inside its own trust domain with no external authority in the loop, Adobe included. [lolly.work](https://lolly.work) coordinates that at scale, and [Content Credentials Identity](/info/content-credentials-identity.html) documents the mechanism.

Adobe, Photoshop and Creative Cloud are trademarks of Adobe. This page describes where the tools overlap and is not affiliated with Adobe.
