---
name: lolly-sandbox
description: "Operate the Lolly Sandbox tool (sandbox) using its declared inputs and supported output formats."
---

# Sandbox

Tool ID: `sandbox`. Tool version: `1.7.0`. Engine range: `^1.0.0`.

Paste HTML, CSS, JS - or a JSX/TypeScript component - and watch it run in a private, offline sandbox. Perfect for previewing code from an AI assistant.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, svg, penpot, pdf, jpg, webp, svgz, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| html | longtext |  |
| css | longtext |  |
| js | longtext |  |
| head | longtext |  |
| mode | select |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
