---
name: lolly-brief
description: "Operate the Lolly Brief tool (brief) using its declared inputs and supported output formats."
---

# Brief

Tool ID: `brief`. Tool version: `1.0.0`. Engine range: `^1.82.0`.

A one-page brief from Markdown: a title line, labelled points and notes, laid out as a page. Paste what an assistant wrote, or write your own.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: pdf, png, svg, jpeg, webp, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| body | longtext |  |
| subheading | text |  |
| orientation | select |  |
| accent | color |  |
| background | color |  |
| ink | color |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
