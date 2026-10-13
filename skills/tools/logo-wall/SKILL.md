---
name: lolly-logo-wall
description: "Operate the Lolly Logo Wall tool (logo-wall) using its declared inputs and supported output formats."
---

# Logo Wall

Tool ID: `logo-wall`. Tool version: `1.4.3`. Engine range: `^1.0.0`.

Arrange a pile of logos into a clean, even sponsor grid - the “NASCAR” wall.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, svg, penpot, pdf, dxf, jpg, webp, avif, tiff, emf, eps, pdf-cmyk, svgz, wmf, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| logos | blocks |  |
| columns | number |  |
| gap | number |  |
| gapY | number |  |
| padding | number |  |
| paddingY | number |  |
| background | color |  |
| balance | boolean |  |
| trim | boolean |  |
| knockout | boolean |  |
| vectorizeAll | boolean |  |
| inkColor | color |  |
| threshold | number |  |
| invert | boolean |  |
| detail | number |  |
| smoothing | number |  |
| repeat | select |  |
| repeatRows | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
