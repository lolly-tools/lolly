---
name: lolly-print-sheet
description: "Operate the Lolly Print Sheet tool (print-sheet) using its declared inputs and supported output formats."
---

# Print Sheet

Tool ID: `print-sheet`. Tool version: `2.0.2`. Engine range: `^1.0.0`.

Lay one design - or a whole pile of them - out n-up on A4, Letter or A3, across as many pages as it takes, with crop marks in the margin.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: pdf, pdf-cmyk, svg, penpot, png, cmyk-tiff, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| cells | blocks |  |
| fill | select |  |
| pages | number |  |
| sheet | select |  |
| rows | number |  |
| cols | number |  |
| gap | number |  |
| margin | number |  |
| ticks | boolean |  |
| tickShape | select |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
