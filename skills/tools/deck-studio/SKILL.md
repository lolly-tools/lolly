---
name: lolly-deck-studio
description: "Operate the Lolly Markdown Slides tool (deck-studio) using its declared inputs and supported output formats."
---

# Markdown Slides

Tool ID: `deck-studio`. Tool version: `1.2.3`. Engine range: `^1.56.0`.

Turn Markdown or a JSON spec into a native, editable PowerPoint deck - real text, bullets, tables and the design system theme - in seconds. The fast text-first path to a deck; reach for the Design canvas when you want to lay slides out by hand or animate them. Charts and diagrams come from your other Lolly tools. Exports .pptx (editable), plus PDF and PNG.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: pptx, pdf, png, html, jpg, webp, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| mode | select |  |
| deck | blocks |  |
| size | select |  |
| pageNumbers | boolean |  |
| brandLogo | boolean |  |
| footerText | text |  |
| sourceAuthor | text |  |
| spec | longtext |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
