---
name: lolly-pricing-table
description: "Operate the Lolly Pricing tool (pricing-table) using its declared inputs and supported output formats."
---

# Pricing

Tool ID: `pricing-table`. Tool version: `1.1.1`. Engine range: `^1.82.0`.

Plans as columns, features as rows, ticks and crosses, and one plan picked out as the recommended one.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, svg, penpot, pdf, csv, json, jpg, webp, avif, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| data | table | t |
| heading | text |  |
| subheading | text |  |
| cta | text |  |
| highlight | number |  |
| highlightLabel | text |  |
| background | color |  |
| accent | color |  |
| layout | select |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
