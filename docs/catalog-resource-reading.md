# Read verified catalog resources

A signed catalog promises that every tool, preview and card a client shows is the file its publisher signed. This page is for operators and security reviewers checking how a client keeps that promise: what the signature covers, how each resource is read and verified before use and how exact source reads stay fixed in History. [Delivery deployment](/info/deploy-delivery.html) covers publishing the catalog itself.

## Verify before use

Verified clients check each signed tool resource before handing its bytes to a model or library loader. Dynamic tool scripts and stylesheets receive a verified blob URL before the browser starts loading them. Cards and still or motion previews also receive a source only after their bytes verify.

The signed envelope's optional `resources` map carries full SHA-256 digests for public previews, look bundles, social cards and documentation images. Generate these resources before signing the extracted build. A publisher upgrading an older envelope must sign again to supply those proofs. Without them, a preview stays unavailable and a look bundle falls back to the live renderer.

HTML cards keep their script-free sandbox and load verified linked resources. Active card content is refused where people can see the refusal.

| Limit | Value |
| --- | --- |
| Size of one resource read | 32 MiB |
| Time allowed for one read | 15 seconds |
| Preview blob cache | 512 entries and 128 MiB |

When the preview cache is full, save current work, then reload the app to empty the cache. Unsigned development catalogs, and data or blob assets people provide themselves, keep their existing handling.

## Exact source reads and History

On supported web shells, opening an ordinary catalog file keeps its byte digest and the attributes seen during that read. A selected attachment keeps its file identity even when another attachment has the same format. Saved work uses the existing version-pin syntax to ask for that exact read. Replacing the source, an unchanged upstream change token or a later metadata edit cannot substitute different bytes, and missing or corrupt held bytes stay unavailable.

Attributes describe the time the file was read, not the time older source bytes were created. They come from the served device-index projection; the freshness of upstream metadata is not checked or inferred from the bytes. Current rights, access, processing and delivery eligibility remain separate questions.

History's asset check verifies the held bytes without asking the source to renew access. Assets offers **Source history**, with bounded device observations, saved creation references and matching operation reports. Imported reports stay imported evidence, and missing recipes and complete shared usage stay unknown. This view does not build the wider shared dependency index.

## What stays the same

Continuous brand documents, presentation modifiers and ordinary remote links keep their live behaviour. Cached versions from before observations were recorded do not gain historical attributes from today's catalog. Exact catalog reads are held on this device; they are not a vendor's historical resolver or a promise that the upstream source keeps the file. Source review in Lolly Work currently freezes instance originals it owns directly, for one purpose and one activation target.

No new portable observation, recipe or review part is written. The existing editable `.lolly` file can carry permitted exact file bytes and their pins, while withheld or unavailable dependencies stay references. A portable backup does not include the private store of catalog observations or its held catalog bytes. When those dependencies must travel to another device, keep an editable file that contains the permitted source bytes. A reader without the exact dependency must report it unavailable instead of resolving the latest file.
