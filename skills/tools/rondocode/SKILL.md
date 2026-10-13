---
name: lolly-rondocode
description: "Operate the Lolly Rondocode tool (rondocode) using its declared inputs and supported output formats."
---

# Rondocode

Tool ID: `rondocode`. Tool version: `1.0.0`. Engine range: `^1.246.0`.

Write music as code and hear it as you type: synths, patterns and a mix in rondocode's live editor. Export the song as audio, stems or MIDI with Content Credentials that record it, or keep its source.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, html, wav, mp3, m4a, opus, json, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

This is an on-device utility. File bytes require a separately permitted file route; a share link does not include local uploads.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| code | longtext |  |
| language | select |  |
| name | text |  |
| length | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
