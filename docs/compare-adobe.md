# Lolly and Adobe

_Last checked: 28 September 2026._

Lolly handles image editing and conversion, layout, repeatable brand production, print output and Content Credentials. [lolly.work](https://lolly.work) adds organisation identity, shared assets, approvals and automated server production to that creative workflow.

## Where they overlap

Both support work such as resizing images, composing layouts and exporting professional formats. Lolly supports PDF/X, CMYK and high-bit-depth raster output, with [format-specific capabilities](/info/formats.html). Its on-device utilities convert and clean files without uploading them.

Adobe's specialist applications cover extensive creative workflows. [Photoshop](https://www.adobe.com/products/photoshop.html), for example, provides detailed photo editing, selection, masking and compositing tools. Compare the editing operations your work requires with Lolly's tools; a recurring brand asset and a complex retouch can have different requirements.

## Creation and organisation services

Standalone Lolly runs without an Adobe account or a Lolly account, using the same engine in the browser, desktop app and CLI. Templates and design tokens make outputs repeatable, and [Share with rules](/info/create-a-tool.html) turns a design into a tool other people can fill in.

lolly.work is a separate service within the Lolly project, open source under MPL-2.0 like the creative apps. It supplies SSO, SCIM, shared catalogues and projects, approvals, access policies, audit records and server rendering. An organisation can run both parts itself and connect existing asset libraries. Local creation stays on the device; shared work and server jobs use the configured services.

## Content Credentials and identity

Lolly can sign supported exports on the device, with Content Credentials enabled by the user. A device-generated key proves the file's signature integrity; a verifier still needs to trust the signer before presenting a verified identity. An organisation can use its own certificate authority and distribute its root to its verifiers. lolly.work also supports server signing with a configured organisation certificate and key.

That makes both personal signing and organisation signing available within the Lolly solution. See [Content Credentials Identity](/info/content-credentials-identity.html), the [lolly.work signing guide](https://github.com/lolly-tools/lolly-work/blob/main/docs/c2pa.md) and the [combined-solution overview](/info/compare.html). On-device transform utilities do not add Lolly watermarks or provenance metadata.

Adobe, Photoshop and Creative Cloud are trademarks of Adobe. This page describes where the solutions overlap and is not affiliated with Adobe.
