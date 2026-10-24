# Wide colour and HDR editing

You shot a sunset in HDR, or your brand green only looks right on a wide-gamut screen, and you do not want an 8-bit editing step to flatten either. **Wide colour** means a wider range of colours than ordinary sRGB, such as Display P3 or Rec.2020. **HDR** also allows brightness above ordinary white. Lolly can keep both through editing in Design, Darkroom and Sequence, then write an HDR file or an ordinary SDR copy from the same document.

This is not the export panel's **HDR** card, which brightens ordinary artwork for HDR screens; that card is described in [Export a file](/info/exporting.html#hdr-bright-colours).

## Turn it on

- **Design**: open **Canvas size** or **Artboard size** and set **Colour** to **Wide colour / HDR**.
- **Darkroom**: set **Editing range** to **HDR**.

Standard editing stays the default. The choice is saved with the document, and Sequence follows it for video.

A brand swatch can hold an sRGB face and a Display P3 or Rec.2020 face. A standard document uses the sRGB face and a wide colour document the wider one; new swatch picks keep their token reference, so switching the document's range picks the right face. A compatible display shows the P3 colours, but your display never changes the saved colour or the exported master.

## Bring in originals

Choose an image through the image picker. PNG, JPEG XL, TIFF, OpenEXR and Radiance originals keep their source bytes. TIFF, EXR and Radiance files get a display PNG while the editor decodes the original into linear floating-point pixels. A generic library HDR import can still serve as a 3D environment; choose an image slot to bring an HDR file in as a 2D image.

What each part edits in float:

- **Darkroom** grades exposure, colour, framing, image layers and supported creative treatments.
- **Design** composes flat layers, text, vectors, original images and supported blend modes.
- **Sequence** reads decoded video planes directly, including PQ and HLG sources, and applies clip timing and composition before encoding.

Internal diffuse white is 203 nits, and HLG uses a 1,000-nit display interpretation. The image preview and histogram are tone-mapped SDR views, so they do not prove what an HDR monitor will show.

## Export: HDR or an SDR copy

The editing range and the output range are separate choices:

| | SDR output | HDR output |
|---|---|---|
| **Standard document** | The ordinary export path | The export panel's HDR card brightens the SDR artwork |
| **Wide colour / HDR document** | A display transform at the final encoding step | The formats below, at full precision |

| HDR output | Precision |
| --- | --- |
| HDR PNG | 16-bit PQ Rec.2020 with cICP and ICC |
| HDR JPEG XL | 16-bit PQ Rec.2020; lossy or lossless |
| OpenEXR | Linear half or float RGBA |
| Radiance | Linear RGBE; needs an opaque background |
| TIFF | Linear float32 or 16-bit PQ; needs an opaque background |
| HDR MP4 / WebM | 10-bit PQ through a supported WebCodecs encoder |

A browser without a usable 10-bit video encoder reports that limitation; it never hands back an SDR file for an HDR request. Ordinary metadata and Content Credentials stay on the normal export path where the format supports them. JPEG XL signing and durable pixel credentials on float stills are not available.

::: details Supported source files
Float images and video frames are limited to 8,388,608 pixels, including UHD, with 16,384 pixels per edge and 128 MiB of encoded input. JPEG XL still encoding has its own 8 MP limit, and cached float layers have a 256 MiB budget.

- **PNG**: 8 or 16-bit RGB, gray and alpha, including Adam7 and supported ICC or cICP transforms. Non-trivial EXIF orientation and colour-managed palette PNGs need converting first.
- **TIFF**: classic chunky RGB or gray strips, uncompressed or Deflate, 8 or 16-bit integers or 32-bit float. Tiled, multipage and BigTIFF files need converting.
- **EXR**: single-part scanline RGB(A), HALF, FLOAT or UINT, NONE, ZIPS or ZIP compression, and known sRGB, P3 or Rec.2020 chromaticities.
- **SDR JPEG and SVG** are accepted. JPEG gain maps and other source formats need converting to a supported HDR original.
:::

::: details What the float path refuses
This release supports flat Design artboards and affine Sequence camera moves. Perspective, 3D scene boxes, slide scene capture, blur and filter effects and depth shadows are refused in the float export path. HDR image layers can animate scale but not their box dimensions yet. Export one Design artboard at a time, and remove Design still clip paths first. Darkroom perspective correction, live camera HDR and before and after comparison are not available.

These refusals keep the source intact rather than quietly reducing it to an 8-bit intermediate. HDR display calibration and checks on physical mobile devices are still outstanding.
:::
