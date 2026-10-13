---
name: lolly-flythrough
description: "Operate the Lolly Flythrough tool (flythrough) using its declared inputs and supported output formats."
---

# Flythrough

Tool ID: `flythrough`. Tool version: `0.2.3`. Engine range: `^1.0.0`.

Fly a real 3D camera through a screenshot. The picture lifts into layers at real depth; big shapes extrude into solid objects; a timeline of poses animates the whole move - depth, opacity, perspective, extrusion, tilt, rotate, scale and the camera flight - then loops it home. Add, drag and reorder poses. Export as video.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, jpg, webp, webm, mp4, gif, avif, tiff, webp-anim, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| shot | asset | sh |
| background | color | bg |
| move | select | m |
| iso | boolean | iso |
| duration | number | sec |
| loop | boolean | lp |
| reverse | boolean | rev |
| light | number | lt |
| shadow | number | sd |
| floor | number | fl |
| floorViewport | boolean | flv |
| poses | blocks | ps |
| camera | text | kf |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
