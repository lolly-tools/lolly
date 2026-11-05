---
name: lolly-quote
description: "Operate the Lolly Quote tool (quote) using its declared inputs and supported output formats."
---

# Quote

Tool ID: `quote`. Tool version: `1.0.1`. Engine range: `^1.304.0`.

A sales quote from a table of line items: each line's total, the subtotal, a discount, tax and the amount due, worked out as you type. Paste the lines from a spreadsheet or your CRM.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: pdf, png, svg, jpeg, webp, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| lines | table | t |
| heading | text |  |
| customer | text |  |
| number | text |  |
| date | date |  |
| validUntil | date |  |
| currency | select |  |
| discount | number |  |
| tax | number |  |
| taxLabel | text |  |
| highlight | number |  |
| notes | longtext |  |
| orientation | select |  |
| accent | color |  |
| background | color |  |
| ink | color |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
