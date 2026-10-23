# Darkroom

Darkroom grades photos and video: a warm portrait for a speaker card, a black-and-white treatment for a report cover, the same look across every clip in a reel. It works on your device, and a look can leave as a LUT or travel in a share link.

## Grade a photo

Open **Darkroom** and choose an image. The controls run from broad to fine:

- **Develop**: Temperature, Tint, Exposure, Contrast, Highlights, Shadows, Saturation, Vibrance and Dehaze.
- **Levels & curves**, for the whole image or one channel, with **Auto levels**.
- **Colour mix** for the hue, saturation and lightness of eight colour bands, **Convert to black & white** with per-colour mixing and a tint, and colour balance for shadows, midtones and highlights with **Preserve luminosity**.
- **Film look**, such as Chrome slide, Teal & orange or Bleach bypass, with **Look strength**.
- **LUT**: a built-in preset or your own `.cube` or `.3dl` file, with **LUT intensity**.
- **Treatment**: Colour wash, Duotone, Gradient map or Split tone, in your design system's colours.
- **Texture**: Film grain, Vignette, Bloom, Halation, Colour fringing, Sharpen and Dust & scratches. **Seed** keeps the grain and dust the same on every render.

**Before / after split** and **Histogram** help you judge the result. Darkroom also opens Photoshop and GIMP layers for positioning, blending and export.

To keep HDR or wide-gamut originals at full precision, set **Editing range** to **HDR**; see [Wide colour and HDR editing](/info/hdr-editing.html).

## Bring in an Adobe photo preset

**Import Adobe photo preset** maps an XMP preset's exposure, contrast, highlights, shadows, saturation, vibrance and dehaze onto Darkroom's own controls. The result is approximate: profiles, Kelvin white balance, masks and settings Darkroom has no control for are listed in a report. Settings the preset does not mention keep their current values. Lua `.lrtemplate` files are refused, so export XMP from Adobe first.

The CLI returns the same controls and a Darkroom link:

```sh
lolly adobe preset look.xmp
```

## Reuse a look

- **Download look as .cube** bakes the current grade into a LUT (choose its size under **Baked LUT size**) for use in another app. A built-in LUT preset can be downloaded on its own too.
- **Grade a video** applies the same colour look to every frame of a clip, at its detected rate from 1 to 60 fps; variable-rate input becomes fixed-rate output. Grading keeps a loop's matching seam but cannot repair a cut in the source. Leave moving grain off when the first and last frames must match exactly.
- **Save** the session as a user template, a starting point for the next grade.

The **Motion looks** templates are starting points for looping clips, each with moving grain off: **Warm editorial** (soft highlights and warm colour), **Clean colour** (a small contrast lift for product clips) and **Editorial mono** (black and white with open shadows). Export a still or a LUT, or grade a finished loop.

A Darkroom share link can also go straight into Design: the **Photo title** motion starter there takes your upload or an edited Darkroom link (see [Animating](/info/animating.html#start-from-a-motion-starter)).

## Export

Darkroom exports PNG, JPG, WebP, AVIF, TIFF, PDF, SVG and Penpot for stills, MP4 and WebM for video, and OpenEXR and Radiance for high-dynamic-range masters. [Export a file](/info/exporting.html) covers formats, sizes and what travels with each file.
