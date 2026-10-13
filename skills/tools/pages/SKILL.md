---
name: lolly-pages
description: "Operate the Lolly Pages tool (pages) using its declared inputs and supported output formats."
---

# Pages

Tool ID: `pages`. Tool version: `1.0.1`. Engine range: `^1.0.0`.

Reorder, rotate, extract, delete, merge or split PDF pages on your device.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: pdf, zip. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

This is an on-device utility. File bytes require a separately permitted file route; a share link does not include local uploads.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| source | file |  |
| operation | select |  |
| pages | text |  |
| previewPage | number |  |
| rotation | select |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
