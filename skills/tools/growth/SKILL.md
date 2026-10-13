---
name: lolly-growth
description: "Operate the Lolly Growth tool (growth) using its declared inputs and supported output formats."
---

# Growth

Tool ID: `growth`. Tool version: `1.1.3`. Engine range: `^1.214.0`.

Differential growth: a line that repels itself until it folds into coral. Seed it from a ring, a burst, headline letterforms or a logo, and export the result as real, plotter-ready SVG paths.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: svg, penpot, pdf, png, jpg, webp, gif, webm, mp4, avif, tiff, emf, eps, dxf, webp-anim, svgz, wmf, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| seedShape | select |  |
| text | text |  |
| logo | asset |  |
| color1 | color |  |
| color2 | color |  |
| color3 | color |  |
| background | color |  |
| density | number |  |
| steps | number |  |
| symmetry | select |  |
| weight | number |  |
| taper | boolean |  |
| seed | number |  |
| grown | boolean |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
