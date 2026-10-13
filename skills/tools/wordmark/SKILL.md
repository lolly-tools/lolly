---
name: lolly-wordmark
description: "Operate the Lolly Wordmark tool (wordmark) using its declared inputs and supported output formats."
---

# Wordmark

Tool ID: `wordmark`. Tool version: `1.0.2`. Engine range: `^1.214.0`.

Type a word, get a pure-path vector wordmark in the design system font - recipients never need the font installed.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: svg, penpot, emf, eps, eps-cmyk, dxf, pdf, pdf-cmyk, cmyk-tiff, tiff, png, jpeg, webp, avif, svgz, wmf, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| text | text |  |
| font | select |  |
| weight | number |  |
| tracking | number |  |
| size | number |  |
| color | color |  |
| features | select |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
