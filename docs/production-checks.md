# Production checks

You agreed the output before production: a 1280 by 800 SVG, one page, with the legal line reading exactly "Legal 125". A production check reads the finished file and answers each requirement with **Passed**, **Mismatch** or **Unchecked**. Unchecked means the fact could not be measured, and it is never counted as a pass.

Write the requirements once, as a small JSON file, then check wherever the file is:

- in **Verify** in the app, add the file and choose **More** › **Policy**;
- in the terminal, add `--production=checks.json` to `lolly inspect`, or to a render, which then writes the file only when every required check passes;
- over MCP, pass the same requirements to `lolly_inspect` or `lolly_render`.

The checks measure the delivered bytes. They do not approve the design, confirm that a statement is true or say whether AI made the file. Ordinary exports are unchanged; only a render that asks for a production check is held to the requirements.

## Write the requirements

A requirements file (a contract) states its profile, its own revision and the output you expect:

```json
{
  "profile": "lolly/production-still-v1",
  "id": "campaign-card",
  "revision": "1",
  "format": "svg",
  "width": 200,
  "height": 100,
  "pages": 1,
  "alpha": "any",
  "requirements": [
    { "id": "legal", "kind": "text", "location": "legal", "expected": "Legal 125" }
  ]
}
```

Use the dimensions, format and content agreed before production. Do not copy measurements from the file you are checking just to make it pass.

- **Size.** Dimensions are pixels, and every page must have the requested size. PDF page sizes are converted from points at 96 pixels per inch.
- **Alpha.** `alpha` is `any`, `opaque` or `transparent`; transparent means at least one decoded pixel is less than fully opaque.
- **SVG text, links and nodes.** `text` addresses an element by its exact id and compares its text content as written, with no whitespace changes. A missing element fails; a duplicate id is undetermined. `link` compares an element's href, and `node` compares the SHA-256 of the element's serialised XML. That identity depends on the parser, so use the same collector for a reference and its candidate.
- **PDF text.** Locations are `page:1`, `page:2` and so on, and the expected string is the whole trimmed page text from Poppler's layout extraction, including its internal whitespace. Images and outlined text have no text to compare.
- **Resources.** A `resource` requirement compares an expected digest with an observed read of a font or asset, by its asset id or worker resource URL. Lolly Work supplies those facts from actual reads. An unobserved resource stays undetermined, and several different digests under one id do not resolve to whichever arrived last. Optional `sourceSha256` and `contextSha256` need the matching execution snapshot, which a standalone file inspection cannot rebuild.

None of these checks shows that text is visible, unclipped, in the right font or fully covered by its glyphs. Keep Design's own text-layout receipts and export checks turned on.

## Check in Verify

Production checks are for people who already have agreed requirements. For an ordinary look at a file, leave these controls hidden.

1. Add the finished file to Verify. If you added several, choose the file in the floating toolbar.
2. Choose **Policy** from **More** in the toolbar to open **Production policy**.
3. Choose a **Requirements** JSON file.
4. Add a **Reference** only when the requirements name a comparison image. Its digest must match the one the requirements name.
5. Select **Check**. Expand a result to see the expected value, the measured value and the reason.
6. Select **Report** inside Production policy for the detailed JSON.

The toolbar's own **Report** exports a signed PDF of the whole Verify assessment, including completed production checks. When every mandatory check allows it, expand **Review**, enter your name and any reason for an appearance exception, then select **Save** for a separate local review record.

Changing the file, the requirements or the reference clears the checks shown. The JSON report binds the measurements to the exact file bytes and requirements revision.

## Check from the terminal and MCP

```sh
lolly inspect card.svg --production=checks.json
lolly run my-tool --export=svg --production=checks.json --output=card.svg
lolly run my-tool --export=png --production=checks.json --production-reference=reference.png --output=card.png
```

A render writes its report to `<output>.production.json`, even when a check fails; `--production-report=path` puts it elsewhere, and a render to stdout sends the report to stderr. A render that fails verification writes no file. Portable tools take the same flags with their usual trust requirement:

```sh
lolly run card.lolly --trust-tool --export=svg --production=checks.json --production-repairs=repairs.json --output=card.svg
```

On-device file transforms refuse the render option; inspect their finished files instead.

Over MCP, `lolly_inspect` takes `file`, `production` and an optional base64 `productionReference`, and `lolly_render` takes the same requirements and reference. The shared render code enforces the requirement even for a direct caller, and a failure keeps the report. SVG inspection never runs the document's code or fetches its linked resources.

## Compare with a reference image

An optional `comparison` adds whole-image and region checks against a reference you supply separately, with `referenceSha256` naming its exact bytes:

```json
{
  "referenceSha256": "<64 lowercase hexadecimal characters>",
  "channelTolerance": 2,
  "maxChangedFraction": 0.001,
  "regions": [
    {
      "id": "legal",
      "x": 0, "y": 50, "width": 150, "height": 40,
      "minSsim": 0.99,
      "maxInkDelta": 0.001
    }
  ]
}
```

These tolerances are examples, not universal quality thresholds; choose and review your own against your reference material.

The comparison never resizes or aligns an image. It checks decoded RGBA differences at native size, then each region's luminance SSIM and the change in the share of pixels darker than luminance 250. The whole-image check keeps alpha changes; region luminance is composited on white. Regions matter because a small missing label can fall below a whole-image allowance for changed pixels.

It compares decoded 8-bit sRGB pixels. It does not compare HDR values, separation plates, every device's rendering or compressed bytes. The 768-pixel preview comparison elsewhere in the app is a separate review feature, and this profile is not the broader draft `still-2d/1` print suite.

## Check a video delivery

`lolly/production-motion-v1` checks finished MP4 and WebM files in the CLI and MCP, including their video render paths. Lolly Work's governed renderer accepts only the still profile. Verify in the app can load a motion contract, and reports that it cannot read the whole video independently.

```json
{
  "profile": "lolly/production-motion-v1",
  "id": "short-explainer",
  "revision": "1",
  "format": "webm",
  "width": 320,
  "height": 320,
  "requirements": [],
  "motion": {
    "seconds": 2,
    "secondsTolerance": 0.05,
    "fps": 24,
    "fpsTolerance": 0.1,
    "frameCount": 48,
    "timestampTolerance": 0.01,
    "audio": false
  }
}
```

```sh
lolly inspect clip.webm --production=motion-checks.json
lolly run design --export=webm --width=320 --height=320 --fps=24 --seconds=2 --production=motion-checks.json --output=clip.webm
```

Every decoded frame counts toward the frame count and the timestamp check. Timestamps must increase and stay within `timestampTolerance` seconds of `frameIndex / fps`, starting at zero. Duration and frame rate have their own tolerances, so rounded container timestamps need not match an exact clock. A wrong frame count, a missing frame or a gap cannot be excused as an appearance difference.

`audio` requires or forbids a track. With `audio: true`, also give `audioSecondsTolerance`, which bounds both the decoded sample duration against the requested one and the timestamp error of contiguous samples from zero. Optional `loudness: { min, max }` is integrated LUFS, and `truePeakMax` is dBTP. Intentional silence can pass when no loudness minimum was set. Black, frozen and silent spans are kept as things to review, not automatic faults.

Optional `motion.comparison` takes the same reference digest, tolerances and regions as a still, plus a `times` array of one to sixteen increasing times. Each picks the nearest frame by the authored frame rate, whose real timestamp must be within tolerance. Supply the reference video with `--production-reference`; both files are decoded independently at native size. Appearance between the sampled times stays unmeasured, and text visibility, chart meaning and transition quality are not inferred from video pixels.

::: details Limits of the video collector
The Node collector needs `ffmpeg` and `ffprobe`, records their versions and uses their [decoded frame and audio filters](https://ffmpeg.org/ffmpeg-filters.html). It admits one video track and at most one audio track, 8-bit SDR, square pixels and no rotation.

Limits: 32 MiB, 120 seconds, 120 fps, 14,400 frames, four million pixels per frame, one billion decoded video pixels and sixteen million sample pixels combined. Probes time out after 30 seconds and each decode after 60. Missing programs, exhausted budgets, unsupported layouts, HDR and higher bit depths cannot give a verified result.

SDK callers use `parseProductionSpec` for either profile. `ProductionContract` and `parseProductionContract` stay still-only; `ProductionSpec` adds the motion form.
:::

## Let Lolly try permitted fixes

A repair plan lets a render try listed alternatives when a check fails, such as a shorter layout when the legal line does not fit. It lists the protected inputs, an ordered list of permitted values, the failed findings that trigger a change and an attempt limit:

```json
{
  "protected": ["legalCopy"],
  "permitted": { "layout": ["short", "long"] },
  "maxAttempts": 2,
  "when": [{ "findingId": "requirement.legal", "input": "layout" }]
}
```

Pass it as `--production-repairs=repairs.json` on the CLI, `productionRepair` over MCP or `production.repair` in Lolly Work.

::: timeline
- <!--i:document--> **Render and check.** The first attempt is checked against the requirements like any other.
- <!--i:sliders--> **Take the next permitted value.** Only a declared tool input listed in the plan can change, and each change records the inputs, the report, the finding and the value before.
- <!--i:convert--> **Render and check again.** The loop stops when a passing check regresses or the number of unresolved requirements does not fall.
- <!--i:clock--> **Stop at the limit.** The plan's `maxAttempts`, which must be from zero to eight.
:::

A required `input` is protected whatever the plan says, a refused change to a protected input keeps the failed attempt's report, and the loop cannot change its own contract. Never list protected copy, numbers or logos as permitted edits.

The CLI keeps every attempt's report in `<report>.history.json`; MCP and Lolly Work keep them beside the final report. An unresolved attempt never publishes a verified file. In Lolly Work, its ordinary policy checks also apply to every candidate, and cancellation and publication stay with its durable runner.

## What each place can measure

::: details The capability matrix
| Fact | Node CLI and MCP | Verify in the app | Lolly Work |
|---|---|---|---|
| SVG namespace, absolute viewport, exact text, id and href | Yes, passive XML | Yes, passive XML | Yes, passive XML |
| PNG and JPEG decode, dimensions, alpha, native comparison | sharp | Browser decoder and canvas | sharp |
| PDF pages, uniform size, extracted page text | Optional Poppler | Undetermined | Optional Poppler |
| One PDF page's pixels at 96 dpi | Optional Poppler and sharp | Undetermined | Optional Poppler and sharp |
| MP4 and WebM decoded timing, audio and frame samples | Optional FFmpeg and ffprobe | Undetermined | Profile unavailable |
| SVG pixels and linked resources from file inspection | Undetermined | Undetermined | Undetermined |
| Protected runtime input identity | In-process and Chromium renders | Undetermined for uploaded files | In-process and signed Chromium observations |
| Source, context and asset-read identity | Undetermined in file inspection | Undetermined | Observed runtime facts; worker coverage is partial |
| Local appearance exception | Engine decision API | Explicit local review download | Grants no Lolly Work authority |
| Required checks before returning render bytes | Yes | Verify inspects existing bytes | Yes, repeated at durable publication |

Install `pdfinfo`, `pdftotext` and `pdftoppm` for PDF readback in Node; a missing program stays visible in the report. Input is capped at 32 MiB, SVG at 2 MiB, decoded images at 16 million pixels and PDF structure at 100 pages. Animated images and multi-page pixel comparison are outside this profile.
:::

::: details Reusable Design and Chart requirements (SDK)
An `input` requirement points at a declared runtime input in `location`. Its `expected` value is the SHA-256 of canonical JSON, computed by the engine's `productionDigest(value)`: object keys are sorted, and array order, JSON types, whitespace inside strings, numbers and units are kept. Observations hold only digests of the requested values. Missing, duplicate, non-JSON or over-budget values stay undetermined, and the combined observed JSON budget is 1 MiB.

For example, a reusable Chart contract built from reviewed source values:

```ts
import { productionDigest, parseProductionContract } from '@lolly/engine';

const protectedValues = {
  data: 'Category,Revenue (GBP)\nA,125\nB,250',
  yTitle: 'Revenue (GBP)',
  yScaleType: 'linear',
  yZero: true,
};
const requirements = await Promise.all(Object.entries(protectedValues).map(
  async ([id, value]) => ({
    id, kind: 'input', location: id, expected: await productionDigest(value),
  }),
));
const contract = parseProductionContract({
  profile: 'lolly/production-still-v1', id: 'chart-revenue', revision: '1',
  format: 'svg', width: 1280, height: 800, pages: 1, alpha: 'any', requirements,
});
```

Protect the fields that carry meaning: Chart's `data`, `hasHeader`, `delimiter`, `transpose`, `labelColumn`, `seriesColumns`, `yScaleType`, `yZero`, `yMax`, `numberFormat` and the axis titles, when they are part of the requirement. Keep numbers as numbers and booleans as booleans when hashing; CSV is kept as its exact input string. Changing data, units or scale to make a layout check pass is refused, even if a repair plan permits that input.

For reusable Design tools, list their declared copy, number or data inputs, and keep layout alternatives in the tool's **Share with rules** choices and the repair plan. Portable `.lolly` renders keep the tool's trust, input and format checks, and optional `sourceSha256` identifies the exact package bytes. One requirements file then serves every variant you reuse it for that keeps the protected inputs.

These observations come from the runtime at its export boundary, after export hooks. Chromium reports are matched to the exact downloaded bytes, and Lolly Work signs them and binds them to the worker request and SVG. They prove where the values came from, not that every value is visible or correctly plotted, so add text or reference-region requirements for the output itself. File-only inspection, older web shells, the desktop renderer and tool export paths that bypass `host.export.render` cannot supply them and stay undetermined. Use `LOLLY_RENDERER=chromium` when a CLI job needs this evidence. The observers describe a cooperating shell; they are not a sandbox against hostile tool code.
:::

## Decisions and evidence

A measurement report binds its checks to the file and contract digests, with source and context digests where they were observed. A local review record is separate and binds the exact report and finding fingerprints. Only a failed appearance check can carry a reasoned local exception; unknown coverage and structural or protected-content failures cannot be excepted.

A local review records one person's decision. It does not turn a missing measurement into a pass, and it is not an organisation's approval. In Lolly Work, decisions go through its authority adapter and its own approval policy, and a review supplied by a client does not grant governed delivery rights. A C2PA signature is not design approval either.

The exact file, the reference and the contract are enough to check again offline. A Lolly Work execution receipt stays partial, even with signed worker network observations: it is not a complete dependency lock or a promise to reproduce a render against a changed catalogue, and old source or resource identities that are no longer available fail or stay unknown. Portable tools remain the way to package editable source and its dependencies; this feature adds no new document or archive format.

The maintained test fixtures cover native comparison, missing critical content, alpha changes, byte and rule substitution, PDF metadata-only differences, permitted layout repair, stale patches, local exceptions and browser and Node parity. They show how this profile behaves; they are not a product benchmark or a human approval of creative output.

Missing collectors, stale references, incomplete coverage and exhausted budgets all block a verified result, and the report stays available to explain why. However a check is run, a missing measurement never becomes a pass.
