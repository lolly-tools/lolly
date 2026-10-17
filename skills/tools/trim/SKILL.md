---
name: lolly-trim
description: "Operate the Lolly Trim tool (trim) using its declared inputs and supported output formats."
---

# Trim

Tool ID: `trim`. Tool version: `1.1.0`. Engine range: `^1.0.0`.

Cut, turn or shrink an audio or video clip, take a poster frame or contact sheet, mute it or extract its audio on your device.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: mp4, webm, gif, m4a, opus, wav, jpg, png, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

This is an on-device utility. File bytes require a separately permitted file route; a share link does not include local uploads.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| source | file |  |
| make | select |  |
| start | number |  |
| end | number |  |
| cut | select |  |
| container | select |  |
| mute | boolean |  |
| audioOnly | select |  |
| rotate | select |  |
| shareSize | select |  |
| maxMB | number |  |
| frames | select |  |
| imageFormat | select |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
