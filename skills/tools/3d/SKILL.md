---
name: lolly-3d
description: "Operate the Lolly 3D tool (3d) using its declared inputs and supported output formats."
---

# 3D

Tool ID: `3d`. Tool version: `1.3.0`. Engine range: `^1.0.0`.

Load a 3D model into a lit scene, orbit and pose the camera, and render a still or a turntable animation.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, jpg, webp, webm, mp4, gif, avif, tiff, apng, webp-anim, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| model | select |  |
| modelUpload | file |  |
| scene | select |  |
| envIntensity | number |  |
| envRotation | number |  |
| background | color |  |
| bgColor2 | color |  |
| transparentBg | boolean |  |
| exposure | number |  |
| shadows | boolean |  |
| camera | vector |  |
| modelRotate | vector |  |
| modelTranslate | vector |  |
| modelScale | vector |  |
| cameraMove | select |  |
| duration | number |  |
| loop | boolean |  |
| easing | select |  |
| cameraKeyframes | blocks |  |
| playClip | boolean |  |
| clipIndex | number |  |
| applyTint | boolean |  |
| tint | color |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
