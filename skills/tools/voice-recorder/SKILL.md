---
name: lolly-voice-recorder
description: "Operate the Lolly Voice Recorder tool (voice-recorder) using its declared inputs and supported output formats."
---

# Voice Recorder

Tool ID: `voice-recorder`. Tool version: `1.1.3`. Engine range: `^1.17.0`.

Record a voice note with a live level meter and gentle coaching, then save it as MP3.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, svg, penpot, mp3, wav, m4a, opus, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: microphone.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| title | text |  |
| targetLevel | select |  |
| showTips | boolean |  |
| theme | select |  |
| accent | color |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
