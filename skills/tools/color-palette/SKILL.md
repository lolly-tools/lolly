---
name: lolly-color-palette
description: "Operate the Lolly Palette Lab tool (color-palette) using its declared inputs and supported output formats."
---

# Palette Lab

Tool ID: `color-palette`. Tool version: `2.3.4`. Engine range: `^1.0.0`.

Grow a palette from one seed colour - harmony accents, perceptual OKLab ramps and WCAG/APCA readability badges, with DTCG tokens and CSV export.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: svg, penpot, png, jpg, webp, csv, json, css, scss, gpl, ase, avif, pdf, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| seed | color |  |
| harmony | select |  |
| steps | number |  |
| neutrals | boolean |  |
| mode | select | m |
| bg | color | b |
| contrastCurve | select | cc |
| lcTargets | text | lc |
| cssStyle | select | cs |
| vision | select | v |
| grid | boolean | g |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
