---
name: lolly-certificate
description: "Operate the Lolly Certificate tool (certificate) using its declared inputs and supported output formats."
---

# Certificate

Tool ID: `certificate`. Tool version: `1.0.5`. Engine range: `^1.0.0`.

Completion and award certificates from the active design system - one name at a time, or a whole roster from a CSV in Bulk from rows.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: pdf, pdf-cmyk, svg, penpot, png, jpg, webp, tiff, cmyk-tiff, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| certKind | select | k |
| pageSize | select | ps |
| heading | text |  |
| firstname | text |  |
| lastname | text |  |
| awardtopic | text |  |
| awarddate | date |  |
| presenter | text |  |
| presenterTitle | text |  |
| company | text |  |
| brandLogo | boolean |  |
| serial | text |  |
| color | color |  |
| background | color |  |
| accent | color |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
