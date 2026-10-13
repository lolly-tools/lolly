---
name: lolly-asset-export
description: "Operate the Lolly Asset Export tool (asset-export) using its declared inputs and supported output formats."
---

# Asset Export

Tool ID: `asset-export`. Tool version: `1.1.0`. Engine range: `^1.0.0`.

Render any catalog asset - or a Lolly tool link - out to any format and size.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: svg, penpot, png, jpg, webp, pdf, pdf-cmyk, cmyk-tiff, ico, zip, avif, tiff, eps, dxf, emf, svgz, wmf, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| src | asset |  |
| fit | select |  |
| width | number |  |
| height | number |  |
| background | color |  |
| transparentBg | boolean |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
