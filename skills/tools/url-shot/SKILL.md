---
name: lolly-url-shot
description: "Operate the Lolly URL Screenshot tool (url-shot) using its declared inputs and supported output formats."
---

# URL Screenshot

Tool ID: `url-shot`. Tool version: `0.2.3`. Engine range: `^1.0.0`.

Any web page, at any scroll depth, with custom CSS.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, jpg, webp, svg, penpot, pdf, webm, mp4, avif, tiff, gif, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: capture.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| url | url |  |
| scrollDepth | number |  |
| scrollTo | number |  |
| zoom | number |  |
| waitMs | number |  |
| css | longtext |  |
| cropTop | number |  |
| cropRight | number |  |
| cropBottom | number |  |
| cropLeft | number |  |
| recolor | select |  |
| hue | number |  |
| tintColor | color |  |
| compare | select |  |
| mobileWidth | number |  |
| mobileHeight | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
