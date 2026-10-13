---
name: lolly-calendar-ics
description: "Operate the Lolly Calendar tool (calendar-ics) using its declared inputs and supported output formats."
---

# Calendar

Tool ID: `calendar-ics`. Tool version: `1.2.3`. Engine range: `^1.0.0`.

Turn event details into a calendar (.ics) file for any calendar app.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: ics, png, svg, penpot, pdf, jpg, webp, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| view | select |  |
| month | text |  |
| weekStart | select |  |
| showWeekNumbers | boolean |  |
| eventName | text |  |
| meetingTime | datetime-local |  |
| meetingEndTime | datetime-local |  |
| allDay | boolean |  |
| city | text |  |
| description | longtext |  |
| url | url |  |
| reminder | select |  |
| events | blocks |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
