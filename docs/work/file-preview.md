# Asset previews

A member who opens an EPS, EMF or WMF file in the asset viewer can ask Lolly Work for a
disposable PDF preview. The original and its permanent file identity stay intact: **Download**
still returns the original, and **Convert** stays the explicit way to make a derivative file.

A converted preview can substitute missing fonts or change effects the converter does not
support, so the viewer labels it as a preview rather than the original.

## How a conversion runs

The application signs a bounded job for the existing render worker:

- EPS uses Ghostscript with SAFER enabled; EMF and WMF use Inkscape.
- Byte signatures are checked before a decoder is chosen.
- Child processes receive no application credentials, use an isolated temporary directory and
  run without a shell. Each has time, memory and output limits.
- Input is capped at 16 MiB and output at 32 MiB, and one conversion runs per worker.
- Temporary files are removed on success, failure and cancellation.

The member API is `POST /api/v1/catalog/file-preview`. Federated attachment previews use the same
original-byte route with `view=1`, and current exposure, availability and attachment membership
still apply. Streaming providers support this path; providers that only redirect keep their
normal preview and download flows. Conversion responses are private and not cached.

## The worker image

The render worker image includes the distribution's Ghostscript and Inkscape packages. Their
upstream projects publish their source and licence terms at https://ghostscript.com and
https://inkscape.org. These are input converters only; Lolly's own engine EMF and EPS emitters
still produce exports. Deploying the render worker is in [deployment](deployment.md).
