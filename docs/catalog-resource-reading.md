# Reading resources from a verified catalog


Verified clients check each signed tool resource before returning its bytes to a
model or library loader. Dynamic tool script and stylesheet elements receive a
verified blob URL before browser loading begins. Cards and still or motion
previews also receive a source only after their bytes verify.

The signed envelope's optional `resources` map covers full SHA-256 digests for
public previews, look bundles, social cards and documentation images. Generate
these resources before signing the extracted build. Publishers upgrading an
older envelope must re-sign to supply those proofs; missing proofs leave a
preview unavailable or cause a look bundle to fall back to the live renderer.

HTML cards keep their script-free sandbox and load verified linked resources.
Active card content is refused visibly. Resource reads have a 32 MiB per-file
limit and a 15 second deadline. The preview blob cache is bounded to 512 entries
and 128 MiB. Save current work before explicitly reloading to clear a full cache.
Unsigned development catalogs and user-provided data or blob assets retain their
existing handling.

## Exact source reads and History

On supported web shells, opening an ordinary catalog file retains its byte
digest and the attributes observed during that read. A selected attachment keeps
its file identity even when another attachment has the same format. Saved work
uses the existing version-pin syntax to request that exact read. Source
replacement, an unchanged upstream change token or a later metadata edit cannot
substitute different bytes. Missing or corrupt held bytes remain unavailable.

Attributes describe the time the file was read, not the time older source bytes
were created. Their origin is the served device-index projection; upstream
metadata freshness is not checked or inferred from the bytes. Current rights,
access, processing and delivery eligibility remain
separate questions. History's asset check verifies the held bytes without asking
the source to renew access. Assets offers Source history with bounded device
observations, saved creation references and matching operation reports. Imported
reports remain imported evidence; missing recipes and complete shared usage stay
unknown. The wider shared dependency index is not implemented by this view.

Continuous brand documents, presentation modifiers and ordinary remote links
keep their existing live behaviour. Legacy cached versions without observations
do not acquire historical attributes from today's catalog. Exact catalog reads
are held on this device; this is not a vendor-native historical resolver or a
promise of permanent upstream retention. Source review in Work currently freezes
directly owned instance originals for one purpose and activation target.

No new portable observation, recipe or review part is emitted. The existing
editable `.lolly` vehicle can carry permitted exact file bytes and their pins;
withheld or unavailable dependencies remain references. A portable backup does
not include the private catalog-observation store or its held catalog bytes.
Keep an editable file containing permitted source bytes when those dependencies
must travel to another device. A reader without the exact dependency must report
unavailable rather than resolve the latest file.
