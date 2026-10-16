# Asset conversion previews

Members can request a disposable PDF preview of an EPS, EMF or WMF file. The selected original and its permanent file identity stay intact. Converted previews can substitute missing fonts or change unsupported effects; the viewer labels the representation. Download returns the original and Convert remains the explicit derivative workflow.

The application signs a bounded job for the existing render worker. EPS uses Ghostscript with SAFER enabled; EMF and WMF use Inkscape. Child processes receive no application credentials, use an isolated temporary directory, run without a shell and have time, memory and output limits. Input is capped at 16 MiB, output at 32 MiB, and one conversion runs per worker. Byte signatures are checked before choosing a decoder. Temporary files are removed on success, failure and cancellation.

The worker image includes the distribution's Ghostscript and Inkscape packages. Their upstream projects publish their source and licence terms at https://ghostscript.com and https://inkscape.org. These are input converters; Lolly's engine EMF/EPS emitters continue to handle exports.

The member API is `POST /api/v1/catalog/file-preview`. Federated attachment previews use the same original-byte route with `view=1`; current exposure, availability and attachment membership still apply. Streaming providers support this path. Redirect-only providers retain their normal preview and download flows. Conversion responses are private and not cached.

`GET /api/v1/catalog/sources` reports only enabled connections visible to the caller, with counts derived from the visible catalog. The response includes no credentials, vendor options or raw error strings. Cached listings are marked stale when an upstream refresh fails; file access is checked on every read.
