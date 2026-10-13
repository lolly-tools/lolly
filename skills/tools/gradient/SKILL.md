---
name: lolly-gradient
description: "Operate the Lolly Gradient tool (gradient) using its declared inputs and supported output formats."
---

# Gradient

Tool ID: `gradient`. Tool version: `1.2.3`. Engine range: `^1.0.0`.

Five ways to build a gradient from the design system swatches: soft radial Blend, a real Coons-patch mesh as crisp SVG (Subdivide) or a smooth raster (Mesh), freeform Warp points and the animated Flow waves. Drag everything right on the canvas; export stills or join-free video loops.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: svg, penpot, png, jpg, webp, avif, webm, mp4, gif, pdf, tiff, webp-anim, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| count | number |  |
| color1 | color |  |
| color2 | color |  |
| color3 | color |  |
| color4 | color |  |
| color5 | color |  |
| color6 | color |  |
| mode | select |  |
| blend | select |  |
| pos1 | vector |  |
| pos2 | vector |  |
| pos3 | vector |  |
| pos4 | vector |  |
| pos5 | vector |  |
| pos6 | vector |  |
| rows | number |  |
| cols | number |  |
| curvature | number |  |
| detail | number |  |
| meshData | text |  |
| spread | number |  |
| blur | number |  |
| grain | number |  |
| grainBlend | select |  |
| animate | boolean |  |
| distance | number |  |
| speed | number |  |
| flowSpeed | number |  |
| waveScale | number |  |
| waveAmp | number |  |
| angle | number |  |
| seed | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
