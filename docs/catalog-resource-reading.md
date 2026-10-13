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
