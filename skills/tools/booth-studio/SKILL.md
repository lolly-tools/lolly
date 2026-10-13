---
name: lolly-booth-studio
description: "Operate the Lolly Booth tool (booth-studio) using its declared inputs and supported output formats."
---

# Booth

Tool ID: `booth-studio`. Tool version: `0.3.1`. Engine range: `^1.0.0`.

Dress a 3D event booth with sponsor artwork. Click any panel to drop an image on it, pick a booth design, and render a still or a turntable for a sponsor pitch.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, jpg, webp, webm, mp4, gif, avif, tiff, webp-anim, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| design | select |  |
| structure | color |  |
| panelBase | color |  |
| backWall | asset |  |
| backWallFit | select |  |
| backWallFraming | vector |  |
| leftWing | asset |  |
| leftWingFit | select |  |
| leftWingFraming | vector |  |
| rightWing | asset |  |
| rightWingFit | select |  |
| rightWingFraming | vector |  |
| header | asset |  |
| headerFit | select |  |
| headerFraming | vector |  |
| counter | asset |  |
| counterFit | select |  |
| counterFraming | vector |  |
| tower | asset |  |
| towerFit | select |  |
| towerFraming | vector |  |
| screen | asset |  |
| screenFit | select |  |
| screenFraming | vector |  |
| floor | asset |  |
| floorFit | select |  |
| floorFraming | vector |  |
| padding | number |  |
| bgImage | asset |  |
| bgImageFit | select |  |
| bgBlur | number |  |
| bgOpacity | number |  |
| bgBlend | select |  |
| bgPosition | vector |  |
| gradientBg | boolean |  |
| bgColor2 | color |  |
| background | color |  |
| transparentBg | boolean |  |
| scene | select |  |
| exposure | number |  |
| shadows | boolean |  |
| people | boolean |  |
| camera | vector |  |
| cameraMove | select |  |
| duration | number |  |
| easing | select |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
