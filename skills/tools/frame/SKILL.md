---
name: lolly-frame
description: "Operate the Lolly Frame tool (frame) using its declared inputs and supported output formats."
---

# Frame

Tool ID: `frame`. Tool version: `1.1.2`. Engine range: `^1.0.0`.

Drop in a screenshot and get it framed, padded and shadowed on a design system backdrop.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, jpg, webp, svg, penpot, pdf, avif, tiff, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| image | asset |  |
| imageFraming | vector |  |
| frame | select |  |
| windowStyle | select |  |
| url | url |  |
| title | text |  |
| backdrop | select |  |
| background | color |  |
| color2 | color |  |
| padding | number |  |
| scale | number |  |
| radius | number |  |
| shadow | number |  |
| dark | boolean |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
