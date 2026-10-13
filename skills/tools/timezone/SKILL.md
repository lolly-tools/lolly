---
name: lolly-timezone
description: "Operate the Lolly Timezone tool (timezone) using its declared inputs and supported output formats."
---

# Timezone

Tool ID: `timezone`. Tool version: `1.1.0`. Engine range: `^1.186.0`.

Turn places and timezones into artwork that follows the design system. Rotate a vector atlas or a detailed WebGL globe, unfold projections, label your people and places, then export artwork, a camera tour or structured schedules.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: svg, png, pdf, webp, jpeg, webm, mp4, gif, json, csv, md, ics, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| locations | blocks |  |
| heading | text |  |
| eyebrow | text |  |
| annotation | longtext |  |
| footer | text |  |
| timeMode | select |  |
| eventTime | datetime-local |  |
| referenceZone | text |  |
| ambiguity | select |  |
| eventMinutes | number |  |
| clockStyle | select |  |
| composition | select |  |
| mapFit | select |  |
| renderer | select |  |
| projection | select |  |
| unfold | number |  |
| view | text |  |
| fov | number |  |
| tilt | number |  |
| showGrid | boolean |  |
| showBorders | boolean |  |
| showNight | boolean |  |
| showLabels | boolean |  |
| showConnections | boolean |  |
| regionOpacity | number |  |
| theme | select |  |
| accent | color |  |
| background | color |  |
| ink | color |  |
| titleSize | number |  |
| titleWeight | number |  |
| labelSize | number |  |
| mapScale | number |  |
| motion | select |  |
| duration | number |  |
| tourHold | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
