# Wide colour and HDR editing

Design and Darkroom can both edit in wide colour and HDR. In Design, open **Canvas size** or **Artboard size** and set **Colour** to **Wide colour / HDR**. In Darkroom, set **Editing range** to **HDR**. Standard editing stays the default. The choice is saved with the document and works with Sequence video editing too.

A brand swatch can contain an authored sRGB face and a Display P3 or Rec.2020 face. Standard documents use the sRGB face. Wide colour documents use the wider face, and new swatch picks keep their token reference so switching the document range selects the right variant. Compatible displays show P3 colours; a display's gamut does not change the saved colour or exported master. P3 means a wider range of colours. HDR additionally allows brightness above ordinary white.

## Working with originals

Choose an image through the image picker. PNG, JPEG XL, TIFF, OpenEXR and Radiance originals retain their source bytes. TIFF, EXR and Radiance receive a display PNG while the editor decodes the original into linear floating-point pixels. Generic library HDR imports can still represent 3D environments; choose an image slot to import an HDR file as a 2D image.

Darkroom grades exposure, colour, framing, image layers and supported creative treatments in float. Design composes flat layers, text, vectors, original images and supported blend modes in float. Sequence reads decoded video planes directly, including PQ and HLG sources, and applies clip timing and composition before encoding. Internal diffuse white is 203 nits; HLG uses a 1,000-nit display interpretation.

The image preview and histogram are tone-mapped SDR views. They do not prove what an HDR monitor will show. Brand CSS colours can use Display P3 on a compatible display. HDR display calibration and physical mobile validation remain outstanding.

## Export

Editing range and output range are separate choices. Keep the document in wide colour / HDR and export an SDR copy, or enable HDR output to retain its brightness range.

| Output | Precision |
| --- | --- |
| HDR PNG | 16-bit PQ Rec.2020 with cICP and ICC |
| HDR JPEG XL | 16-bit PQ Rec.2020; lossy or lossless |
| OpenEXR | Linear half or float RGBA |
| Radiance | Linear RGBE; opaque background required |
| TIFF | Linear float32 or 16-bit PQ; opaque background required |
| HDR MP4 / WebM | 10-bit PQ through a supported WebCodecs encoder |
| SDR raster / video | A display transform at the final encoding boundary |

A browser without a usable 10-bit video encoder reports that limitation. It does not silently substitute an SDR file for an HDR request. Ordinary metadata and Content Credentials stay on the normal export path where the format supports them. JPEG XL signing and durable pixel credentials on float stills are unavailable.

## Current limits

Float images and video frames are bounded to 8,388,608 pixels, including UHD, with 16,384 pixels per edge and 128 MiB encoded input. JPEG XL still encoding has its own 8 MP limit. Cached float layers have a 256 MiB budget.

PNG supports 8/16-bit RGB, gray and alpha, including Adam7 and supported ICC/cICP transforms. Nontrivial EXIF orientation and colour-managed palette PNGs require conversion first. TIFF supports classic chunky RGB/gray strips with no compression or Deflate, 8/16-bit integers or 32-bit float; tiled, multipage and BigTIFF inputs require conversion. EXR supports single-part scanline RGB(A), HALF/FLOAT/UINT, NONE/ZIPS/ZIP and known sRGB/P3/Rec.2020 chromaticities. SDR JPEG and SVG are accepted; JPEG gain maps and other source formats need conversion to a supported HDR original.

This release supports flat Design artboards and affine Sequence camera moves. Perspective, 3D scene boxes, slide scene capture, blur/filter effects and depth shadows are refused in the float export path. HDR image layers can animate scale but cannot animate their box dimensions yet. Export one Design artboard at a time; Design still clip paths require removal. Darkroom perspective correction, live camera HDR and before/after comparison are unavailable. These refusals preserve the source rather than silently reducing it to an 8-bit intermediate.

The automated browser checks cover original EXR through Darkroom and Design, P3 swatch selection, raw 10-bit planes and an encoded, trimmed, re-exported HDR clip. Pure tests cover PNG16 adjacent codes, TIFF float, EXR compression and alpha, premultiplied interpolation and HDR PNG/JPEG XL brightness round trips.
