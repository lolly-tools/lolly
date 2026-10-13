---
name: lolly-spatial-photo
description: "Operate the Lolly Spatial Photo tool (spatial-photo) using its declared inputs and supported output formats."
---

# Spatial Photo

Tool ID: `spatial-photo`. Tool version: `0.1.4`. Engine range: `^1.152.0`.

Drop in one photo and move a camera through it: depth is read on your device, so a flat picture becomes a scene with real parallax, atmosphere and focus.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, jpg, webp, webm, mp4, gif, avif, tiff, webp-anim, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| photo | asset |  |
| move | select |  |
| amount | number |  |
| duration | number |  |
| focus | vector |  |
| dof | number |  |
| fog | color |  |
| fogAmount | number |  |
| depthContrast | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
