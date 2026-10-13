---
name: lolly-contrast-check
description: "Operate the Lolly Contrast tool (contrast-check) using its declared inputs and supported output formats."
---

# Contrast

Tool ID: `contrast-check`. Tool version: `1.2.1`. Engine range: `^1.0.0`.

Check a text and background pair, or every pairing in the design system palette, against WCAG 2.1 and APCA, and see how it reads to colour-blind viewers.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: svg, penpot, png, pdf, csv, json, jpg, webp, avif, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| color | color |  |
| background | color |  |
| mode | select |  |
| metric | select |  |
| textSize | select |  |
| sample | text |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
