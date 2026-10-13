---
name: lolly-prompt-card
description: "Operate the Lolly Prompt Card tool (prompt-card) using its declared inputs and supported output formats."
---

# Prompt Card

Tool ID: `prompt-card`. Tool version: `1.0.1`. Engine range: `^1.0.0`.

Typeset a long prompt into one compact, legible image for a multimodal model - image input is often cheaper than the same words as text tokens.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, webp, jpg, avif, svg, penpot, pdf, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

This is an on-device utility. File bytes require a separately permitted file route; a share link does not include local uploads.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| text | longtext |  |
| columns | select |  |
| keepLines | boolean |  |
| lineHeight | number |  |
| paraGap | number |  |
| padding | number |  |
| width | number |  |
| height | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
