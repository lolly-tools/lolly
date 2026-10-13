---
name: lolly-annotate
description: "Operate the Lolly Annotate tool (annotate) using its declared inputs and supported output formats."
---

# Annotate

Tool ID: `annotate`. Tool version: `1.0.2`. Engine range: `^1.214.0`.

Mark up your own screenshot on your device - arrows, boxes, numbered steps, callouts, highlighter and a spotlight dim.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, jpg, webp, avif, tiff, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

This is an on-device utility. File bytes require a separately permitted file route; a share link does not include local uploads.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| source | file |  |
| annotations | blocks | an |
| accent | color |  |
| strokeWidth | number |  |
| annotStyle | select |  |
| ocr | text |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
