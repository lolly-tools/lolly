# Production checks

Lolly can check a finished artifact against explicit requirements. The
`lolly/production-still-v1` and `lolly/production-motion-v1` profiles measure the delivered bytes. They do not
approve the design, establish factual truth or identify AI authorship.

Ordinary exports keep their existing behaviour. A render that requests this
profile returns its artifact only when every required check passes. Missing
collectors, stale references, incomplete coverage and exhausted budgets prevent
that verified result. The report remains available to explain the refusal.

## In Verify

Production is an advanced check for people who already have agreed output
requirements. For an ordinary file inspection, leave the policy controls hidden.

1. Add the finished file to Verify. Choose the file in the floating toolbar if
   you added several files.
2. Choose **Policy** from **More** in the toolbar to open **Production policy**.
3. Choose a **Requirements** JSON file in the format below. Use the dimensions,
   format and content agreed before production; do not copy measurements from
   the candidate just to obtain a passing result.
4. Add a **Reference** only when the requirements specify a comparison image.
   Its digest must match the reference named in the requirements.
5. Select **Check**. Expand a result to see the expected value, measured value
   and reason. **Passed** means the requirement was measured and met.
   **Mismatch** means the measurement disagreed. **Unchecked** means the
   required fact could not be measured; that is not a pass.
6. Select **Report** inside Production policy for the detailed JSON. The toolbar's
   **Report** exports a signed PDF of the current Verify assessment, including
   completed production checks. When every mandatory check permits review,
   expand **Review**, enter your name and any appearance-exception reason,
   then select **Save** for a separate local review record.

Changing the file, requirements or reference clears the displayed checks.
A local review records a person's decision; it does not turn missing measurements
into passes or establish an organisation's approval. Unsupported checks remain
unchecked. The JSON report binds the measurements to the exact file bytes and
requirements revision.

## Requirements

A contract records its own revision and the expected output. Dimensions are pixels;
PDF page dimensions are converted from points at 96 pixels per inch. All pages
must have the requested size. `alpha` is `any`, `opaque` or `transparent`, where
transparent means that at least one decoded pixel has alpha below full opacity.

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

For SVG, `text` addresses a text element by its exact id, and compares its text
content without rewriting or whitespace normalization. A missing element fails;
a duplicate id is undetermined. `link` compares an element's href. `node`
compares the SHA-256 of the parsed element's serialized XML. That identity is
parser-specific; use the same collector for a reference and its candidate.
None of these checks establishes visibility, clipping, font identity or glyph
coverage. Keep Design's existing text-layout receipts and export checks enabled.

For PDF, text locations are `page:1`, `page:2` and so on. The expected string is
the complete trimmed page text from Poppler's layout extraction, including its
internal whitespace. Extraction does not establish visible placement. Images
and outlined text have no extractable text claim in this profile.

`resource` requirements compare the expected digest with an observed resource
read, using its asset id or worker resource URL. Work supplies those facts from
actual reads. An unobserved font or asset stays undetermined. Multiple different
observed digests under one id do not resolve to whichever value arrived last.
Optional `sourceSha256` and `contextSha256` require the corresponding execution
snapshot. Standalone file inspection cannot reconstruct those facts.

## Reusable Design and Chart requirements

An `input` requirement identifies a declared runtime input in `location`. Its
`expected` value is the SHA-256 of canonical JSON, computed by the engine's
`productionDigest(value)`. Object keys are sorted; array order, JSON types,
whitespace inside strings, numbers and units are preserved. Observations contain
only digests of requested values. Missing, duplicate, non-JSON or over-budget
values remain undetermined. The combined observed JSON budget is 1 MiB.

For example, build a reusable Chart contract from reviewed source values:

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

Protect the fields that determine meaning: Chart's `data`, `hasHeader`,
`delimiter`, `transpose`, `labelColumn`, `seriesColumns`, `yScaleType`, `yZero`,
`yMax`, `numberFormat` and axis titles when those are part of the requirement.
Keep numeric inputs as numbers and boolean inputs as booleans when hashing.
CSV is preserved as its exact input string. Changing data, units or scale to
make a layout check pass is refused, even if a repair plan permits that input.

For reusable Design tools, name their declared copy, number or data inputs.
Keep layout alternatives in the tool's existing Share with rules choices and
in the explicit repair plan. Portable `.lolly` renders retain the tool's trust,
input and format policy checks; optional `sourceSha256` identifies the exact
package bytes. The requirements file can be reused with each approved variant.

These observations come from the runtime at its export boundary after export
hooks. Chromium reports are matched to the exact downloaded bytes; Work signs
and binds them to the worker request and SVG. They establish source identity,
not whether every value is visible or correctly plotted. Add independent text
or reference-region requirements for output conformance. File-only inspection,
older web shells, the desktop renderer and tool-owned export paths that bypass
`host.export.render` cannot supply these observations and stay undetermined.
Use `LOLLY_RENDERER=chromium` when a CLI job requires browser input evidence.
The observers describe the cooperating shell; they are not a sandbox against
hostile tool code.

## Native comparison

An optional `comparison` adds whole-image and declared-region checks. Supply
reference bytes separately; `referenceSha256` must identify those exact bytes.

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

These example tolerances are authored requirements, not universal quality
thresholds. Choose and review tolerances against your reference material.
The comparator never resizes or aligns an image. It checks decoded RGBA channel
differences at native size, then region luminance SSIM and the change in the
fraction of pixels below luminance 250. Whole-image RGBA retains alpha changes;
region luminance is composited on white. Critical regions matter because a
small missing label can fall below a whole-image changed-pixel allowance.

The profile compares decoded 8-bit sRGB pixels, not HDR values, separation
plates, every device's rendering or compressed byte equality. The existing
768-pixel preview comparator remains a separate review feature. This profile
is not the broader draft `still-2d/1` print suite.

## Capability matrix

| Fact | Node CLI/MCP | Browser Verify | Work |
|---|---|---|---|
| SVG namespace, absolute viewport, exact text/id/href | Yes, passive XML | Yes, passive XML | Yes, passive XML |
| PNG/JPEG decode, dimensions, alpha, native comparison | sharp | Browser decoder and canvas | sharp |
| PDF pages, uniform size, extracted page text | Optional Poppler | Undetermined | Optional Poppler |
| Single PDF page pixels at 96 dpi | Optional Poppler and sharp | Undetermined | Optional Poppler and sharp |
| MP4/WebM decoded timing, audio and declared frame samples | Optional FFmpeg and ffprobe | Undetermined | Profile unavailable |
| SVG pixels and linked resources from file inspection | Undetermined | Undetermined | Undetermined |
| Protected runtime input identity | In-process and Chromium renders | Undetermined for uploaded files | In-process and signed Chromium observations |
| Source/context and asset-read identity | Undetermined in file inspection | Undetermined | Observed runtime facts; worker coverage is partial |
| Local appearance exception | Engine decision API | Explicit local review download | Does not grant Work authority |
| Required production checks before returning render bytes | Yes | Verify inspects existing bytes | Yes, repeated at durable publication |

Install `pdfinfo`, `pdftotext` and `pdftoppm` to enable Node PDF readback. Missing
programs remain visible in the report. Input is capped at 32 MiB, SVG at 2 MiB,
decoded images at 16 million pixels and PDF structure at 100 pages. Animated
images and multipage pixel comparison are outside this profile. Parser, pixel,
resource and time budgets never turn a missing measurement into a pass.

## Encoded motion requirements

`lolly/production-motion-v1` checks existing MP4 and WebM deliveries in CLI and
MCP, including their existing video render paths. Work's governed renderer still
accepts only the still profile. Browser Verify can load a motion contract but
reports that independent full-media readback is unavailable.

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

Every decoded video frame contributes to the frame count and timestamp check.
Timestamps must increase and remain within `timestampTolerance` seconds of
`frameIndex / fps`, starting at zero. Duration and measured frame rate have
separate authored tolerances, so quantized container timestamps need not match
an exact rational clock. A wrong frame count, missing frame or discontinuity
cannot be excused as an appearance difference.

`audio` explicitly requires or forbids a track. With `audio: true`, also supply
`audioSecondsTolerance`: it bounds both decoded sample duration against the
requested duration and timestamp error against contiguous samples starting at
zero. Optional `loudness: { min, max }` is integrated LUFS; `truePeakMax` is dBTP.
Absent or unreadable measurements remain undetermined. Intentional silence may
pass when no loudness minimum was authored. Black, frozen and silent spans are
retained as review candidates from the existing inspector, not automatic faults.

Optional `motion.comparison` uses the same reference digest, pixel tolerances
and regions described above, with an additional `times` array. Each time selects
the nearest frame by the authored frame rate; its actual timestamp must be
within the authored tolerance. Supply a reference video with
`--production-reference`. Both files are independently decoded at native size.
Between one and sixteen strictly increasing times are allowed. Appearance
between those samples remains explicitly unmeasured. Text visibility, chart
semantics, transition quality and spatial or fabrication conformance are not
inferred from video pixels.

The Node collector requires `ffmpeg` and `ffprobe`, records their versions,
and uses their [decoded frame and audio filters](https://ffmpeg.org/ffmpeg-filters.html).
It admits one video track and at most one audio track, 8-bit SDR, square pixels
and no rotation. Limits are 32 MiB, 120 seconds, 120 fps, 14,400 frames, four
million pixels per frame, one billion decoded video pixels and sixteen million
sample pixels combined. Probes have a 30-second timeout and each decode has a
60-second timeout. Missing programs, exhausted budgets, unsupported layouts,
HDR and higher bit depths cannot produce a verified result.

```sh
lolly inspect clip.webm --production=motion-checks.json
lolly run design --export=webm --width=320 --height=320 --fps=24 --seconds=2 --production=motion-checks.json --output=clip.webm
```

SDK callers use `parseProductionSpec` for either profile. The existing
`ProductionContract` type and `parseProductionContract` parser retain their
still-only contract; `ProductionSpec` adds the motion alternative.

## CLI and MCP

```sh
lolly inspect card.svg --production=checks.json
lolly run my-tool --export=svg --production=checks.json --output=card.svg
lolly run my-tool --export=png --production=checks.json --production-reference=reference.png --output=card.png
```

Rendering writes a report to `<output>.production.json`, including on a check
failure. `--production-report=path` overrides that location; stdout renders
send the report to stderr. Failed verification writes no artifact. Portable
tools use the same flags with their existing trust requirement:

```sh
lolly run card.lolly --trust-tool --export=svg --production=checks.json --production-repairs=repairs.json --output=card.svg
```

On-device file transforms refuse this render option; inspect their finished
files explicitly.

MCP `lolly_inspect` accepts `file`, `production` and optional base64
`productionReference`. `lolly_render` accepts the same contract and reference;
its shared render core enforces the requirement even for direct callers. Failure
responses retain the report. The browser's Verify view has a Production checks
panel for a requirements file and optional reference. SVG inspection never
mounts document code or fetches linked resources.

## Permitted repairs

An authored repair plan lists protected inputs, an ordered finite list of
permitted values, triggering failed findings and an attempt limit:

```json
{
  "protected": ["legalCopy"],
  "permitted": { "layout": ["short", "long"] },
  "maxAttempts": 2,
  "when": [{ "findingId": "requirement.legal", "input": "layout" }]
}
```

Use `--production-repairs=repairs.json` in CLI, `productionRepair` in MCP, or
`production.repair` in Work. Only declared tool inputs can change. Every patch
binds the input snapshot, report digest, finding fingerprint and prior value.
The next alternative must be listed in the plan. The loop rerenders and checks
the artifact, stops when any passing check regresses or the number of unresolved
requirements does not fall, and permits at most eight repair attempts. A required
`input` is protected independently of the repair plan. A refused protected edit
retains the failed attempt report. The loop cannot change its contract.
Protected copy, numbers and logos should never be listed as permitted edits.

CLI keeps each report in `<report>.history.json`; MCP and Work retain attempt
reports alongside the final report. An unresolved attempt does not publish a
verified artifact. Work's ordinary policy checks also apply to every candidate.
Cancellation and publication fencing remain the existing durable runner's
responsibility.

## Decisions and reproducibility

A measurement report binds its checks to artifact and contract digests, with
source/context digests where observed. A local review record is separate and
binds the exact report and finding fingerprints. Only failed appearance checks
can carry a reasoned local exception. Unknown coverage and structural or
protected-content failures cannot be excepted. Saving and loading a decision
does not change a failed measurement into a pass.

Work decisions require its authority adapter and existing approval policy;
client-supplied local reviews do not grant governed delivery rights. A C2PA
signature also does not supply design approval.

Exact artifact and reference files plus the contract support offline rechecking.
A Work execution receipt remains partial, even with signed worker network
observations. It is not a complete dependency lock or a promise to reproduce a
render against a changed catalogue. Required old source/resource identities fail
or remain unknown when unavailable. Existing portable tools remain the route
for packaging editable source and dependencies; this feature adds no competing
document or archive format.

The maintained fixtures exercise native comparison, missing critical content,
alpha changes, byte and rule substitution, PDF metadata-only differences,
permitted layout repair, stale patches, local exceptions and browser/Node
parity. They establish this profile's implementation behaviour. They do not
provide a comparative product benchmark or human approval of creative output.
