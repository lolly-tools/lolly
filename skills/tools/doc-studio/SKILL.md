---
name: lolly-doc-studio
description: "Operate the Lolly Doc Studio tool (doc-studio) using its declared inputs and supported output formats."
---

# Doc Studio

Tool ID: `doc-studio`. Tool version: `1.2.1`. Engine range: `^1.0.0`.

Write a multi-page document on the canvas - rich text, headings, tables and inserted Lolly renders that flow onto pages and export as a PDF.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: pdf, pptx, svg, penpot, md, docx, odt, html, svgz. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| pageSize | select |  |
| docTitle | text |  |
| sourceAuthor | text |  |
| font | select |  |
| accent | color |  |
| theme | select |  |
| pageNumbers | boolean |  |
| columns | select | col |
| content | longtext |  |
| width | number |  |
| height | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
