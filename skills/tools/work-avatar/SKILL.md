---
name: lolly-work-avatar
description: "Operate the Lolly Work Avatar tool (work-avatar) using its declared inputs and supported output formats."
---

# Work Avatar

Tool ID: `work-avatar`. Tool version: `1.2.3`. Engine range: `^1.214.0`.

A round profile photo with a treatment and a ring of text - the campaign badge for LinkedIn and every other place your face goes, in your design system's colours and type.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, jpg, webp, avif, svg, pdf, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| photo | asset |  |
| imageFraming | vector |  |
| photoSize | number |  |
| photoBackdrop | select |  |
| photoBg | color |  |
| photoBg2 | color |  |
| treatment | select |  |
| treatmentAmount | number |  |
| treatShadow | color |  |
| treatHighlight | color |  |
| tintColor | color |  |
| ringStyle | select |  |
| ringWidth | number |  |
| ringOverlay | boolean |  |
| ringRotate | number |  |
| ringColor | color |  |
| ringGradient | boolean |  |
| ringColor2 | color |  |
| ringSpread | number |  |
| ringFade | number |  |
| text | text |  |
| uppercase | boolean |  |
| textColor | color |  |
| textSize | number |  |
| textFont | select |  |
| textWeight | select |  |
| textItalic | boolean |  |
| textTracking | number |  |
| textSide | select |  |
| textAnchor | select |  |
| textPosition | number |  |
| bgColor | color |  |
| margin | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
