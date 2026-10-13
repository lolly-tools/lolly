---
name: lolly-text-helper
description: "Operate the Lolly Text tool (text-helper) using its declared inputs and supported output formats."
---

# Text

Tool ID: `text-helper`. Tool version: `2.0.0`. Engine range: `^1.242.0`.

Find, edit, understand and transform text. Browse brand characters and emoji, work with code and logs, or create ASCII lettering.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: html. The connected surface may support a subset; check its capabilities.

Required host APIs: textTools. Device capabilities: none.

This is an on-device utility. File bytes require a separately permitted file route; a share link does not include local uploads.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| body | longtext |  |
| operation | text |  |
| settings | longtext |  |
| source | longtext |  |
| language | text |  |
| characterRecents | longtext |  |
| workspaceMode | text |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
