---
name: lolly-meeting-planner
description: "Operate the Lolly Meeting Planner tool (meeting-planner) using its declared inputs and supported output formats."
---

# Meeting Planner

Tool ID: `meeting-planner`. Tool version: `1.2.3`. Engine range: `^1.0.0`.

Plan a global meeting and see the time for every teammate's timezone.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, jpeg, svg, penpot, ics, json, pdf, webp, csv, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| eventName | text |  |
| people | blocks |  |
| titleWeight | number |  |
| city | text |  |
| meetingTime | datetime-local |  |
| liveClock | boolean |  |
| theme | select |  |
| layout | select |  |
| projection | select |  |
| showNight | boolean |  |
| showGraticule | boolean |  |
| showBorders | boolean |  |
| landColor | color |  |
| oceanColor | color |  |
| mapZoom | text |  |
| pinColor | color |  |
| pinShape | select |  |
| pinSize | number |  |
| labelSize | number |  |
| showNameInPin | boolean |  |
| hideCity | boolean |  |
| fontSize | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
