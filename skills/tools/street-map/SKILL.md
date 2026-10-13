---
name: lolly-street-map
description: "Operate the Lolly Street Map tool (street-map) using its declared inputs and supported output formats."
---

# Street Map

Tool ID: `street-map`. Tool version: `0.5.2`. Engine range: `^1.0.0`.

Clean vector street-block maps of any city. Works offline.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: svg, penpot, emf, dxf, pdf, pdf-cmyk, png, jpg, webp, avif, tiff, eps, svgz, wmf, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| city | select |  |
| theme | select |  |
| minorRoadWeight | number |  |
| majorRoadWeight | number |  |
| showWater | boolean |  |
| waterWeight | number |  |
| roadColor | color |  |
| waterColor | color |  |
| background | color |  |
| route | longtext |  |
| routeColor | color |  |
| routeWidth | number |  |
| view | text |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
