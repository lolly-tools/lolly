---
name: lolly-battlecards
description: "Operate the Lolly Battlecards tool (battlecards) using its declared inputs and supported output formats."
---

# Battlecards

Tool ID: `battlecards`. Tool version: `1.3.2`. Engine range: `^1.82.0`.

Turn any table into a deck of cards - one card per row, ready as a multi-page PDF. Paste straight from your spreadsheet, doc, or chat.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: pdf, svg, penpot, pdf-cmyk, emf, png, webp, avif, jpeg, tiff, cmyk-tiff, svgz, wmf, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| data | table | t |
| title | text |  |
| orientation | select |  |
| accent | color |  |
| bg | color |  |
| ink | color |  |
| footer | text |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
