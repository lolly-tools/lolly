---
name: lolly-quote-card
description: "Operate the Lolly Quote tool (quote-card) using its declared inputs and supported output formats."
---

# Quote

Tool ID: `quote-card`. Tool version: `1.1.0`. Engine range: `^1.0.0`.

A quotation in the active design system: a speaker card, a pull quote, a citation with its source, big type, a marker on the key phrase, with optional motion that carries into Design.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, jpg, webp, svg, penpot, pdf, avif, tiff, mp4, webm, gif, apng, webp-anim, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| quote | longtext |  |
| phrase | text |  |
| name | text |  |
| role | text |  |
| headshot | asset |  |
| ground | select |  |
| layout | select |  |
| source | text |  |
| publication | text |  |
| date | text |  |
| url | url |  |
| motion | select |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
