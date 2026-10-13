---
name: lolly-scan-code
description: "Operate the Lolly Scan tool (scan-code) using its declared inputs and supported output formats."
---

# Scan

Tool ID: `scan-code`. Tool version: `0.1.1`. Engine range: `>=1.153.0`.

Read QR codes and barcodes on-device, with nothing sent to any cloud. A reader, not an opener: it decodes, classifies and explains what a code carries - links, Wi-Fi, contacts, product codes - and lets you act deliberately. Copy is always the first action; opening, joining or adding is an explicit, informed tap.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| mode | select |  |
| image | file |  |
| paste | longtext |  |
| keepHistory | boolean |  |
| beep | boolean |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
