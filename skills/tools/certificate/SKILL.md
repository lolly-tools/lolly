---
name: lolly-certificate
description: "Operate the Lolly Certificate tool (certificate) using its declared inputs and supported output formats."
---

# Certificate

Tool ID: `certificate`. Tool version: `1.2.2`. Engine range: `^1.293.0`.

Completion and award certificates in the active design system and its colourway: four styles, print and social sizes, and motion for sharing - one name at a time, or a whole roster from a CSV in Bulk from rows.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: pdf, pdf-cmyk, svg, penpot, png, jpg, webp, tiff, cmyk-tiff, mp4, webm, gif, apng, webp-anim, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| certKind | select | k |
| firstname | text |  |
| lastname | text |  |
| awardtopic | text |  |
| awarddate | date |  |
| style | select | st |
| pageSize | select | ps |
| motion | select | mo |
| presenter | text |  |
| presenterTitle | text |  |
| company | text |  |
| brandLogo | boolean |  |
| logoStyle | select | lv |
| seal | boolean | se |
| serial | text |  |
| accent | color |  |
| color | color |  |
| background | color |  |
| language | select | ln |
| heading | text |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
