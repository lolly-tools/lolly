---
name: lolly-backdrop
description: "Operate the Lolly Backdrop tool (backdrop) using its declared inputs and supported output formats."
---

# Backdrop

Tool ID: `backdrop`. Tool version: `1.1.2`. Engine range: `^1.0.0`.

Living backdrops from your design system's colours: sixteen GPU effects - flowing silk, prismatic blooms, liquid contours, metaballs, god rays and more. Tune, freeze the exact moment you want, and export stills or motion loops for heroes, walls and meeting backgrounds.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, jpg, webp, avif, webm, mp4, gif, tiff, webp-anim, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| effect | select |  |
| count | number |  |
| color1 | color |  |
| color2 | color |  |
| color3 | color |  |
| color4 | color |  |
| color5 | color |  |
| color6 | color |  |
| background | color |  |
| brandInfluence | select |  |
| intensity | number |  |
| density | number |  |
| scale | number |  |
| rotation | number |  |
| speed | number |  |
| phase | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
