# Motion in Design

Use `design` for an editable composition of text, shapes, media and sound. The
recipes in `../examples/motion/` are complete MCP argument objects: send one to
`lolly_render`, or send its `toolId` and `inputs` to `lolly_validate` first. They
use neutral colours and invented demonstration copy; replace them with the active
design system's tokens, assets and the user's facts before making a deliverable.

## Choose the structure

Start with one `kind: "frame"` artboard and stable ids for its children. Each child
names the artboard in `frame`. Coordinates are global canvas coordinates, not
offsets inside the artboard. The recipes put the artboard at the origin.

Use the sequence lane (`lane: "seq"`) for clips that establish the main edit.
Use the overlay lane (`lane: ""`) for independently timed text and decoration.
Leave `start` and `dur` absent for scenery that stays visible. A timed layer needs
a real duration to establish the sequence length. The examples use one timed
background on the sequence lane and overlay their content on that background.

Write a shot table before a new piece. For example, a six-second title:

| Seconds | Purpose and copy | Picture | Sound |
|---|---|---|---|
| 0-3 | Introduce the message: Make room for ideas | Words rise in order, then hold | Optional supplied accent on arrival |
| 3-6 | Resolve: Start with one idea | Simple entrance; hold the final line | Leave room for the ending, or keep silent |

Match the pace to the brief. A quiet explainer benefits from long stable text.
Choose a focal element per shot and a consistent transition language. Avoid
decorative labels, camera motion or effects that compete with the message.

## Timing and motion fields

| Field | Meaning |
|---|---|
| `start`, `dur`, `clipIn` | Seconds; source trim is separate from timeline start |
| `speed` | Source playback multiplier |
| `enterMs`, `exitMs`, `stagger` | Milliseconds |
| `enter`, `exit` | Preset ids from the generated Design field table |
| `enterEase`, `exitEase` | Geometry curve: `ease-out`, `ease-in`, `smooth`, `snappy`, `overshoot`, `anticipate`, `linear`, `ease-in-out`, or `cubic-bezier(a,b,c,d)` |
| `split` | `word`, `line`, `letter`, or empty for whole text |
| `splitOrder` | Empty for reading order, `reverse`, `center`, or deterministic `random` |
| `hold`, `holdRate` | Optional loop and its cycles per second; empty means still |
| `kf` | Poses at local clip times, in milliseconds |
| `projectFps` | Editing grid and default movie rate, stored as a select string |

Prefer the built-in curve when no custom motion is needed. An entrance can settle
quickly with ease-out; an exit can accelerate with ease-in. These curves control
geometry, not transition opacity. Use keyframes for movement inside the clip.

For N staggered units, allow at least `enterMs + (N - 1) * stagger` before treating
the whole line as readable. Leave a reading hold before the exit. Recheck when
copy or language changes. Letter animation keeps grapheme clusters together and
degrades to word animation for joining scripts; do not split Arabic by hand.
Check the actual font used for each script: a successful render may use a system
fallback that differs on another machine. Review mixed-script punctuation too;
Set `textDirection: "rtl"` or `"ltr"` when paragraph direction must be explicit. Alignment is separate.

A keyframe example is `t0_x0*t1200_eo_x80*t2400_ei_x0`. `t` is local milliseconds,
`*` separates poses and `_` separates channels. Here x is an offset in pixels over
the authored layer position. `eo` and `ei` are keyframe ease tokens, different
from the transition field spellings. Other common channels are `y` (offset), `s`
(scale multiplier), `r` (rotation), `o` (opacity multiplier), `b` (spatial blur),
`z` (absolute depth), `w`/`h` (absolute size), and `v` (volume multiplier).
Use a `camera` layer for a shared camera move; camera poses are absolute. Unknown
tokens can be dropped, so start from a checked recipe and inspect its rendered
motion. Spatial blur does not produce temporal motion blur.

## Checked starting recipes

| File | What it demonstrates | Review |
|---|---|---|
| [kinetic-title.json](../examples/motion/kinetic-title.json) | Six seconds, word staggering, two text beats | Last word lands before the hold; final message stays readable |
| [product-demo.json](../examples/motion/product-demo.json) | Eight seconds, a native mock interface and a moving selection indicator | Indicator and copy agree; the mock interface is clearly example content |
| [quiet-explainer.json](../examples/motion/quiet-explainer.json) | Ten seconds, two stable reading passages, no soundtrack | No accidental motion during holds; longer copy fits at the output size |

The recipes use ordinary layers. Edit by stable id with `layerPatches` or
`layerOperations`; no separate animation script or template-specific renderer is
needed. They contain no audio asset dependencies. Add a supplied audio asset as a
`kind: "audio"` layer with its `image: { "id": "..." }` reference and timing.

## Sound and cues

Choose sound for the message: supplied music, recorded speech, a few effects or
silence. Align visible hits and sound from the same shot table. Audio uses `gain`,
`pan`, `duck`, `mute`, `clipIn`, `speed` and optionally `kf` volume automation.
`duck: 0.2` lowers a bed under other clips' audible passages. Existing music
generation does not imply that every new piece needs a new score.

`sequenceMarks` stores absolute marker milliseconds and optional in/out points:
`v1|m,3000,,888888,Resolve|i,0|o,6000`. Marker types are `m` (marker), `c`
(chapter), `r` (range) and `n` (note); labels are URI-encoded. Markers do not extend duration. Shared cue timing is separate:

```json
{"version":1,"tempo":{"bpm":120,"offset":0,"beatsPerBar":4},"cues":[{"id":"reveal","beat":8}],"bindings":[{"layerId":"title","cueId":"reveal","target":"start"},{"layerId":"sound","cueId":"reveal","target":"start"}]}
```

Send this as top-level MCP `motionTiming` to `lolly_compile` to preview `motion`
changes and resolved inputs, then to `lolly_build_url` or `lolly_render` to apply.
The document persists the returned description in `sequenceTiming`. Retain its
`applied` snapshots on subsequent edits: a manually retimed field detaches from
its binding. Cue ids are stable ASCII letters, digits, underscore or hyphen.
Cues use one of `at` (seconds), `beat` (zero-based beats from offset), or `after`
(another cue id), plus an optional seconds `offset`. BPM may be null; absolute
cues work without music. Bindings also support `enterEnd`, `exitStart`, and
`keyframe` with `keyIndex`. The compiler writes ordinary layer fields, preserving
subframe precision. The editor's **Beat and cue timing** previews affected layers
before applying one edit, and offers beat snapping on the project frame grid.

## Preview, render and handover

Design needs the browser render tier. Use a browser-enabled MCP instance or the
CLI's browser tier for a movie. The public browser-free render route cannot
render Design. MCP accepts top-level `fps`, `seconds`, `wait`, `codec` and `vq`
on `lolly_render` and `lolly_build_url`; put only Design inputs inside `inputs`.
CLI motion flags are `--fps`, `--seconds`, `--wait`, `--codec` and
`--vq`; a frame rate sets sampling, not playback speed. Explicit seconds set the
requested length, so check they include the final hold and audio tail.

In the web shell, the export **Frames** field samples a contact sheet, and
**Markers > Preview mix** renders the selected in/out range with sound at a
reduced size. A single still uses the playhead. Uniform sheets can miss a short
gap: inspect the frame before, at and after each important transition, as well as
the first frame, reading holds and the last exported frame.

For uniform sheets, send `cuts: 6` to MCP or use CLI `--cuts=6`. A PNG/JPG/WebP/SVG
sheet returns a ZIP; a PDF sheet returns one document with N pages. Name the CLI
output accordingly, for example `--export=png --cuts=6 --output=frames.zip`.
Both require the browser tier and a timed composition.

For exact stills, use MCP `sampleTimes: [0, 2.9666666667, 3, 3.0333333333]`, or
CLI/URL `sampletimes=0,2.9666666667,3,3.0333333333`. These are absolute authored seconds,
not times relative to an in/out range. The example checks both sides of a
three-second cut at 30 fps. Use `1 / fps` for another rate. One sample returns one
ordinary still; several return a ZIP or paged PDF. Times must be strictly
increasing, from zero to before the composition end, with at most 64 samples.
Do not combine explicit samples with `cuts > 1`. These settings preserve the
editable document and do not move its saved playhead.

Exact raster sampling drives video, Lottie, 3D and supported animated SVG through
the movie compositor. Vector samples of animated sources, SVG motion paths and
tilted scene captures report capability errors. Uniform contact sheets retain
the existing parked-video poster behavior. **Markers > Review frames** offers
transition samples and editable sample times.

For a movie excerpt, send `sequenceRange: {"from": 2, "to": 5}` or CLI
`--seqrange=2,5`. It uses absolute authored seconds, keeps the complete mix and
leaves saved in/out markers unchanged. Do not combine a range with still samples.

For temporal blur, send `motionBlur: {"samples": 8, "shutterAngle": 180}` or
CLI `--motionblur=8,180`. The document saves the same JSON in
`sequenceMotionBlur`; explicit export options override that default. The editor
has Off, Draft (4), Standard (8), High (16), and a shutter angle from 0 to 360.
More samples increase render time. Off is the default. Blur integrates poses in
linear light during the centred exposure and clips at hard cuts. Audio timing
and movie frame count stay unchanged. Supported paths are SDR flat Sequence
movies and explicit PNG/JPG/WebP/PDF samples. HDR, tilted scenes and structural
vector exports refuse the option. Use an explicit lower sample count for drafts;
keep the final quality in the saved document.

Inspect delivered bytes with `lolly inspect --motion movie.webm`, or MCP
`lolly_inspect` with `motion: true`, `file: {"base64": "<base64>", "name":
"movie.webm", "mime": "video/webm"}` and optional `motionTarget` containing
`width`, `height`, `seconds`, `fps`, `audio`, `loudness` (LUFS), or `truePeakMax`
(dBTP). Node inspection uses optional ffprobe/ffmpeg. The editor's rendered-mix
preview offers **Check rendered file** using available browser decoders;
unsupported measurements are marked not-run. Black, frozen and silent spans
are review candidates. An unchecked requested target gives an indeterminate
report; numerical success does not establish creative quality.

Structural validation checks ids, geometry and input values. A mounted review
checks text bounds, actual fonts and overlap. A draft with sound checks timing
and the mix. The final encoded file needs its own checks when the brief specifies
frame rate, duration, loudness or peak limits. The mix limiter does not establish
the encoded file's decoded peak. Report checks as measured, reviewed or not run.

Deliver the requested movie, a useful cover if requested, and an editable link or
`.lolly` package. Local uploaded assets need a package to travel. State which
files were rendered and checked, and keep the user's original duration, aspect
ratio and soundtrack choices in each derivative.
