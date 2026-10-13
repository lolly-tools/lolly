---
name: lolly-record
description: "Operate the Lolly Record tool (record) using its declared inputs and supported output formats."
---

# Record

Tool ID: `record`. Tool version: `1.4.2`. Engine range: `>=1.150.0 <2.0.0`.

Design your own top and tail cards, then record a clip and Lolly wraps them around it automatically.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: mp4, webm, srt, vtt, gif, webp-anim. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: camera, microphone.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| frames | number |  |
| pageW | number |  |
| pageH | number |  |
| brandColor | color |  |
| accent | color |  |
| clip | asset |  |
| clipFit | select |  |
| transcript | longtext |  |
| autoCaption | boolean |  |
| introMs | number |  |
| outroMs | number |  |
| enterMs | number |  |
| boxes | blocks | bx |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
