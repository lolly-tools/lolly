---
name: lolly-3d-studio
description: "Operate the Lolly 3D Studio tool (3d-studio) using its declared inputs and supported output formats."
---

# 3D Studio

Tool ID: `3d-studio`. Tool version: `0.8.2`. Engine range: `>=1.205.0`.

Turn SVG artwork and 3D models into coordinated images, alone or arranged together in one scene. Shape materials, lighting, focus and transparent shadows with guided or expert controls.

Read the overall Lolly skill first. Describe this exact tool before composing inputs. Use only declared input IDs or URL aliases; validate structured values before rendering.

Declared output formats: png, jpg, webp, avif, tiff, webm, mp4, gif, apng, webp-anim, bmp, jxl, jxl-lossless. The connected surface may support a subset; check its capabilities.

Required host APIs: none. Device capabilities: none.

## Inputs

| ID | Type | URL alias |
| --- | --- | --- |
| primitive | select |  |
| artwork | asset |  |
| modelAsset | asset |  |
| words | longtext |  |
| source | select |  |
| controls | select |  |
| modelFormat | select |  |
| wordFont | select |  |
| wordWeight | number |  |
| wordPose | select |  |
| wordTracking | number |  |
| wordLineHeight | number |  |
| wordAlign | select |  |
| studioRef | text |  |
| studioOverrides | longtext |  |
| collectionName | text |  |
| activeSubject | number |  |
| subjects | blocks |  |
| activeObject | number |  |
| objects | blocks |  |
| studio | select |  |
| materialMode | select |  |
| colorA | color |  |
| colorB | color |  |
| finishA | select |  |
| finishB | select |  |
| glow | number |  |
| surfaceFinishes | boolean |  |
| faceFinishA | select |  |
| bevelFinishA | select |  |
| sideFinishA | select |  |
| faceFinishB | select |  |
| bevelFinishB | select |  |
| sideFinishB | select |  |
| drama | number |  |
| softness | number |  |
| exposure | number |  |
| lightMotion | select |  |
| lightMotionAmount | number |  |
| curveDetail | select |  |
| shape | vector |  |
| rotation | vector |  |
| position | vector |  |
| transform | vector |  |
| projection | select |  |
| camera | vector |  |
| target | vector |  |
| depthOfField | boolean |  |
| aperture | number |  |
| focusDistance | number |  |
| atmosphere | boolean |  |
| atmosphereForms | select |  |
| atmosphereSpread | number |  |
| atmosphereCount | number |  |
| seed | number |  |
| backdrop | select |  |
| background | color |  |
| background2 | color |  |
| backdropImage | asset |  |
| backdropStrength | number |  |
| floor | select |  |
| floorColor | color |  |
| shadowOpacity | number |  |
| pedestal | boolean |  |
| keyColor | color |  |
| fillColor | color |  |
| rimColor | color |  |
| coolColor | color |  |
| warmColor | color |  |
| lightLevels | vector |  |
| keyPosition | vector |  |
| fillPosition | vector |  |
| rimPosition | vector |  |
| environment | select |  |
| environmentImage | asset |  |
| environmentBackground | boolean |  |
| environmentBlur | number |  |
| environmentIntensity | number |  |
| environmentRotation | number |  |
| lights | blocks |  |
| materials | blocks |  |
| materialSlotA | text |  |
| materialSlotB | text |  |
| outputMode | select |  |
| collectionSize | vector |  |
| samples | number |  |
| videoSamples | number |  |
| motion | select |  |
| motionAmount | number |  |
| motionRest | number |  |
| cameraMotion | select |  |
| cameraAmount | number |  |
| cameraKeys | blocks |  |
| cameraEase | select |  |
| cameraLoop | boolean |  |
| duration | number |  |
| turnDegrees | number |  |

Read [the full input definitions](reference/inputs.json) for choices, defaults, limits, nested fields and conditional controls. These definitions come from this tool version.

## Review

Inspect the rendered result for clipping, readability and fidelity to the supplied content. Recheck the affected output after an edit. Return the editable source or link when the person will continue editing. Do not claim that validation proves visual quality.

A skill supplies guidance only. The connection determines available operations and access. Confirm the tool and document identity before acting; preserve the open document's effective design system. Never infer live layer editing from this manifest.
