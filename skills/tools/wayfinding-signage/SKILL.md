---
name: lolly-wayfinding-signage
description: "Operate the Lolly Wayfinding tool (wayfinding-signage) using its declared inputs and supported output formats."
---

# Wayfinding

Tool ID: `wayfinding-signage`. Tool version: `1.2.2`. Engine range: `^1.0.0`.

Directional event signs - destinations, each with an arrow. Print-ready.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: pdf, pdf-cmyk, svg, penpot, dxf, png, jpg, webp, avif, tiff, cmyk-tiff, emf, svgz, wmf, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| textWeight | number |  |
| size | select |  |
| eventLogo | asset |  |
| eventName | text |  |
| heading | text |  |
| directions | blocks |  |
| background | color |  |
| accent | color |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
