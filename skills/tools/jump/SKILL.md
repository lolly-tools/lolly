---
name: lolly-jump
description: "Operate the Lolly Jump tool (jump) using its declared inputs and supported output formats."
---

# Jump

Tool ID: `jump`. Tool version: `1.2.1`. Engine range: `^1.82.0`.

A one-link landing page: your links, heading, portrait and colours on an expressive page - and the whole page lives inside the link you share.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: html. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| style | select | st |
| mood | select | m |
| color | color | ink |
| background | color | pp |
| accent | color | ac |
| footer | boolean | ft |
| links | table | l |
| heading | text | t |
| subheading | text | sub |
| avatar | asset | av |
| backdrop | asset | bg |
| onVisit | select | go |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

Read [the declared examples](reference/examples.json) for reproducible starting inputs from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
