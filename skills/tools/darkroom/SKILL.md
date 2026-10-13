---
name: lolly-darkroom
description: "Operate the Lolly Darkroom tool (darkroom) using its declared inputs and supported output formats."
---

# Darkroom

Tool ID: `darkroom`. Tool version: `2.5.0`. Engine range: `^1.242.0`.

Grade photos and video with film looks, Adobe XMP presets, .cube LUTs and your design system colours. Reuse a look through LUT export or Grade a video. Opens Photoshop and GIMP layers for positioning, blending and image export.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, jpg, webp, svg, penpot, webm, mp4, exr, hdr, tiff, pdf, avif, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| image | asset |  |
| imageFraming | vector |  |
| imageFit | select |  |
| editingRange | select |  |
| layers | blocks | l |
| temperature | number |  |
| tint | number |  |
| exposure | number |  |
| contrast | number |  |
| highlights | number |  |
| shadows | number |  |
| saturation | number |  |
| vibrance | number |  |
| dehaze | number | dhz |
| levelsChannel | select | lvc |
| levelsInBlack | number | lv0 |
| levelsGamma | number | lv1 |
| levelsInWhite | number | lv2 |
| levelsOutBlack | number | lv3 |
| levelsOutWhite | number | lv4 |
| levelsRedInBlack | number | lv5 |
| levelsRedGamma | number | lv6 |
| levelsRedInWhite | number | lv7 |
| levelsRedOutBlack | number | lv8 |
| levelsRedOutWhite | number | lv9 |
| levelsGreenInBlack | number | lv10 |
| levelsGreenGamma | number | lv11 |
| levelsGreenInWhite | number | lv12 |
| levelsGreenOutBlack | number | lv13 |
| levelsGreenOutWhite | number | lv14 |
| levelsBlueInBlack | number | lv15 |
| levelsBlueGamma | number | lv16 |
| levelsBlueInWhite | number | lv17 |
| levelsBlueOutBlack | number | lv18 |
| levelsBlueOutWhite | number | lv19 |
| levelsAuto | boolean | lva |
| curveChannel | select | cvc |
| curveRgb | text | cv0 |
| curveRed | text | cv1 |
| curveGreen | text | cv2 |
| curveBlue | text | cv3 |
| hslMode | select |  |
| hslHueRed | number | mh0 |
| hslHueOrange | number | mh1 |
| hslHueYellow | number | mh2 |
| hslHueGreen | number | mh3 |
| hslHueAqua | number | mh4 |
| hslHueBlue | number | mh5 |
| hslHuePurple | number | mh6 |
| hslHueMagenta | number | mh7 |
| hslSatRed | number | ms0 |
| hslSatOrange | number | ms1 |
| hslSatYellow | number | ms2 |
| hslSatGreen | number | ms3 |
| hslSatAqua | number | ms4 |
| hslSatBlue | number | ms5 |
| hslSatPurple | number | ms6 |
| hslSatMagenta | number | ms7 |
| hslLumRed | number | ml0 |
| hslLumOrange | number | ml1 |
| hslLumYellow | number | ml2 |
| hslLumGreen | number | ml3 |
| hslLumAqua | number | ml4 |
| hslLumBlue | number | ml5 |
| hslLumPurple | number | ml6 |
| hslLumMagenta | number | ml7 |
| bwMode | boolean | bw |
| bwReds | number | bw0 |
| bwYellows | number | bw1 |
| bwGreens | number | bw2 |
| bwCyans | number | bw3 |
| bwBlues | number | bw4 |
| bwMagentas | number | bw5 |
| bwTint | boolean | bwt |
| bwTintHue | number | bwh |
| bwTintSat | number | bws |
| cbRange | select | cbr |
| cbShadowsCR | number | cb0 |
| cbShadowsMG | number | cb1 |
| cbShadowsYB | number | cb2 |
| cbMidtonesCR | number | cb3 |
| cbMidtonesMG | number | cb4 |
| cbMidtonesYB | number | cb5 |
| cbHighlightsCR | number | cb6 |
| cbHighlightsMG | number | cb7 |
| cbHighlightsYB | number | cb8 |
| cbPreserve | boolean | cbp |
| filmLook | select |  |
| presetStrength | number |  |
| lutSource | select |  |
| lutPreset | select |  |
| lutFile | file |  |
| lutIntensity | number |  |
| downloadPresetLut | boolean |  |
| bakeSize | select |  |
| bakeLut | boolean |  |
| treatment | select |  |
| treatmentAmount | number |  |
| treatShadow | color |  |
| treatMid | color |  |
| treatHighlight | color |  |
| grain | number |  |
| grainSize | number |  |
| vignette | number |  |
| bloom | number |  |
| halation | number |  |
| fringe | number |  |
| sharpen | number |  |
| dust | number |  |
| seed | number |  |
| splitPreview | boolean |  |
| histogram | boolean |  |
| width | number |  |
| height | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
