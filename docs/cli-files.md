# CLI file and media utilities

Clean, convert or redact files you already have, or run speech and the on-device models. Your files are read on this machine and written as new files. Nothing is uploaded.

<!--i:eti-refresh-->
## Clean or convert a file

Some tools take **your own file** as input and return a transformed copy: strip hidden data, crop, convert. Pass the file as a path:

```bash
lolly strip-data --source=./holiday.jpg --output=./holiday-clean.jpg
```

These tools transform bytes and render no page, so the output follows the file you gave. `--export=` is **refused**:

```bash
$ lolly strip-data --source=./photo.jpg --export=png --output=./clean.png
Error: "strip-data" is an on-device transform (file in → file out), so --export=png has
nothing to act on: the output container follows the file you gave it, and the reserved
export format never reaches the tool. Drop the flag, or use one of the tool's own inputs
if it offers a conversion.
```

A tool that converts takes the new format through its **own input**. `convert-image` calls that input `target` (`webp`, `jpeg` or `png`):

```bash
lolly convert-image --source=./photo.heic --target=png --output=./photo.png
```

An `--output` extension that disagrees with the bytes gives a **warning**, not a refusal. The transform cannot change the container, so the file is written under your name and stderr says so. Without `--output` or `--filename`, the bytes go to stdout.

Lolly Clean repairs a WAV recording here with no model: steady noise, mains hum, harsh s sounds, clicks and room echo. Its speech model runs only in the browser. Other containers go to the browser tier or are refused by name ([Lolly Utilities](/info/utilities.html#audio-and-video)):

```bash
lolly clean --source=./take.wav --repairHum=50 --output=./take-clean.wav
```

### Redaction rebuilds real pixels

Most utilities run in the headless DOM. `redact` also repaints an image on a canvas and rasterises PDF pages, which jsdom cannot do alone. So the CLI gives the tool a 2D canvas (Skia, through `@napi-rs/canvas`) and draws PDF pages with Lolly's own page interpreter. This runs with no browser and reports `tier: node`. The bars cover exactly the pixels the app's bars would, because both call one shared bar-geometry module.

A redacted page is a picture of the original. Text, vector shapes and embedded images come through. Shadings, tiling patterns and soft masks do not, because their decoders are in the web shell; a gradient paints as its flat fallback colour. Text and shapes, which a redaction covers, are complete.

A PDF can also be redacted with `--keepText=true`, which removes only what sits under the bars and keeps the rest of each page as text. The CLI checks the result before it writes the file. See [Lolly Utilities](/info/utilities.html#lolly-strip-hidden-data-and-redact).

If that canvas is not installed, or a tool needs something only a browser can do, the CLI runs the same export in the headless Chromium ([the paint tier](/info/cli-rendering.html#what-the-cli-can-render)) and prints a note on stderr. If the browser or the built web shell is missing, the CLI stops and says what to install. The CLI never writes a file that was not redacted.

### Prepare and convert without a tool

Two verbs work on a file directly, with no tool and no catalog:

```bash
lolly prepare report.docx --strip-hidden-data --output=report-clean.docx
lolly files convert photo.png --to=webp --output=photo.webp
```

`lolly prepare` inspects files for private values and hidden data, then writes cleaned copies. With no change flag it prints a report that leaves out the private values. `lolly files inspect`, `files convert` and `files schema` read, convert and describe images, fonts, spreadsheets and PDFs. Neither command overwrites an existing file. For a spreadsheet or delimited text, `files convert` also takes `--sheet=<name|position>` or `--all-sheets` (which writes a `.zip`), `--cells=cached|formulas`, `--delimiter`, `--encoding` and `--header`. [Lolly Utilities](/info/utilities.html#prepare-for-sharing) explains both. They offer the same choices as the app's **Prepare for sharing** and **Convert** views.

<!--i:eti-eye-off-->
## Redact many copies with one link

A redaction is described by its bars and options, which are ordinary URL state. The same instructions work as a share link, as CLI flags and as an [MCP](/info/mcp.html) call. Bars are `page,x,y,w,h`: PDF bars in points from the page's top-left, image bars in pixels.

```bash
# Rows separated by ~, the form a share link uses:
lolly redact --source=./contract.pdf --bars='1,40,60,200,24~2,40,100,120,14' \
  --grayscale --output=./contract-redacted.pdf --verify

# The same instructions as JSON, or from a spreadsheet:
lolly redact --source=./scan.png --bars='[{"page":1,"x":40,"y":60,"w":200,"h":24}]' --output=./scan-redacted.png
lolly redact --source=./scan.png --bars-data=./bars.csv --output=./scan-redacted.png
```

One redaction then works for every copy of a form, certificate or invoice where the same fields sit in the same place:

::: timeline
- <!--i:pentool--> **Mark up one copy in the app.** Draw the bars over the fields to remove.
- <!--i:link--> **Press Share.** The link carries the bars and options, not the document.
- <!--i:folder--> **Run the link over the folder.** Each copy is redacted and checked before it is written.
:::

```bash
for f in ./inbox/*.pdf; do
  lolly "$SHARE_LINK" --source="$f" --output="./clean/$(basename "$f")" --verify || echo "FAILED: $f"
done
```

`--verify` prints a line per file once the tool's own gate has run. The redacted copy is reopened and scanned again before any bytes are written: no metadata, one end-of-file marker, no recoverable covered text and every bar region solid. A failed check exits non-zero with the tool's own error message and writes **no file**, so a shell loop sees the failure.

::: warning Invisible watermarks are not checked
`--verify` cannot tell you whether an invisible whole-image watermark was present: nothing here detects or removes one.
:::

<!--i:eti-speak-->
## Text to speech and back

Two speech commands use the same `host.speech` as a tool's hooks. The models run on this machine. A tool that speaks its own text, such as a narration or caption track, also renders headlessly with no extra flags.

```bash
lolly speak "Constraint first, on device, from the terminal." --out=./clip.wav
lolly speak "…" --voice=af_heart --speed=0.95 --out=./clip.wav --json
lolly transcribe ./clip.wav --lang=en --json
```

**`lolly speak`** writes a 24 kHz mono WAV. `--out=<file>` sets the name (`speech.wav` by default; `--out=-` streams to stdout) and `--speed=<n>` is a rate multiplier where `1` is the natural pace. `--voice=<id>` picks one of the 28 Kokoro voices, 20 en-US and 8 en-GB; the default is `bf_lily`, because "lolly" is a British word. A voice can be a **blend**: `--voice=af_heart+bf_lily:0.3` mixes two voices with normalised weights, the setting the app's voice controls write. Progress goes to stderr, sentence by sentence.

**`lolly transcribe <clip.wav>`** reads a clip back as text. The text is the only output on stdout, so `lolly transcribe take.wav > take.txt` saves a transcript. `--lang=<code>` sets the spoken language, and `--json` adds word timings.

Speech to text reads **WAV only**. Node has no MP3, AAC or Opus decoder, and the command does not call an `ffmpeg` it finds on `PATH`. So an `mp3`, `m4a`, `aac`, `ogg`, `oga`, `opus`, `flac`, `weba`, `webm`, `mp4` or `mov` file is refused **by name** rather than read as noise. So is a generated ZzFXM song, which holds no speech:

```bash
$ lolly transcribe ./interview.m4a
Error: speech: m4a needs a platform codec this shell does not have - hand it a WAV, or run
it in a browser shell
```

With `--json`, both commands answer in the [standard envelope](/info/cli-reference.html#the-json-envelope). `speak` reports `output`, `voice`, `speed`, `sampleRate`, `duration`, `granularity`, the sentence `script` and a `words` array of `{ text, start, end }` spans in seconds. The reverse direction reports `text`, `words`, `lang` and `granularity`. A caption or a karaoke highlight uses those spans, so read `granularity` instead of inferring alignment from span lengths.

<!--i:eti-cpu-->
## Run the on-device models

Six utilities run the app's models. Each wraps the API a tool's hook reaches through `host.*`, so the CLI has no second model, tiling scheme or gate. `host.upscale`, `host.matte` and `host.ocr` are on the CLI bridge, so a tool that uses one works in a headless `lolly run`. Use these commands to check that a model runs on your machine.

| Command | What it does | Model and size | Exit `5` means |
|---|---|---|---|
| `lolly upscale <image>` | AI enlargement, PNG out | Real-ESRGAN models and the GFPGAN face model, 410.7 MB as a family | |
| `lolly matte <image>` | Background removal, PNG with alpha | `u2netp` 4.4 MB, or `modnet` 24.7 MB for portraits | |
| `lolly ocr <image>` | Text recognition; the text is stdout | `ppocr-v5-mobile`, 20.5 MB, ten languages | nothing was read |
| `lolly detect-ai "<text>"` | An **estimate** of AI-written text, never a verdict | 33.0 MB | under 50 words or mostly non-Latin script: "Not checked" |
| `lolly reword "<sentence>"` | Shorter, plainer rewrites, one per line | 372.0 MB | no candidate passed the gate |
| `lolly depth <image>` | Greyscale depth map, white nearest | Depth Anything V2 small, 26.0 MB, Apache-2.0 | |

A missing model is refused. Nothing downloads on its own ([Download the models](#download-the-models)). Exit `5` is a valid negative answer, not a failure.

::: details Flags for each command
- **`lolly upscale <image> [--scale=2|4] [--model=<id>] [--max-edge=N] [--out=<file.png>] [--models]`.** Per-tile progress on stderr. The models are natively x4, and `--scale=2` trims the result. `--models` prints the roster with sizes and licences: `realesr-general-x4v3` (fast), `realesrgan-x4plus` (quality), `realesrgan-x4plus-anime` (illustration) and `gfpgan-v1.4` (face restore, flagged "can invent face details"). An image the model cannot process is refused up front with the reason (exit `4`).
- **`lolly matte <image> [--model=u2netp|modnet] [--max-edge=N] [--edges=refined|as-drawn] [--edge-radius=12] [--edge-shift=0] [--edge-contrast=1] [--clean-edge-colour] [--out=<file.png>] [--models]`.** With `u2netp` the edges follow the photo's own edges by default. This gives a solid subject and brings back hair the coarse model cuts through. `modnet`'s soft matte is kept as drawn unless you pass `--edges=refined`. `--edges=as-drawn` keeps the model's mask, `--edge-shift` moves the edge out or in and `--edge-contrast` hardens the edge. `--clean-edge-colour` replaces the old background's colour in the soft edge with the subject's own, to remove a green or white halo. Without that flag every output RGB pixel is identical to the input's, and only the alpha is computed, which is why the app discloses a matte as an edit and an upscale not.
- **`lolly ocr <image> [--json] [--single-line] [--min-confidence=<n>] [--models]`.** `lolly ocr shot.png > shot.txt` works; `--json` adds per-line confidence and a box in source pixels.
- **`lolly detect-ai "<text>" [--json] [--in=<file.txt>]`** (a pipe works too). Prints the estimate with its operating point and the model used. The detector is trained on English and over-scores prose by people writing English as a second language, so short or non-Latin text is not checked, and an absent check is not an answer.
- **`lolly reword "<sentence>" [--style=plain] [--samples=N] [--json] [--in=<file.txt>]`.** Only `--style=plain` is accepted; anything else is a usage error that says why. A candidate that is longer, off-topic or changes a fact fails the gate.
- **`lolly depth <image> [--max-edge=N] [--out=<file.png>]`.**
:::

::: note These commands write plain files
The two speech commands and the six model commands are not a `lolly run`, so the export pipeline never sees their bytes. No Content Credential or Imprint is added: an upscaled PNG from the terminal carries no credential naming the model, and generated speech does not declare itself. If a file must declare how it was made, you must add that declaration yourself for now.
:::

The models run on the **CPU by default**, because the app's WASM kernels match the CPU numerically and every model is verified on the CPU. `LOLLY_ORT_EP=coreml` (or `=cuda`) opts into an accelerated provider. It is faster but can change the numbers on some graphs. `LOLLY_ORT_THREADS=<n>` caps the threads each model session may use (unset means every core); `1` runs on the calling thread with no pool, which is slower but predictable on a shared machine.

<!--i:eti-download-->
## Download the models

Nothing here fetches anything on its own. Every model is read from a models directory: `$LOLLY_MODELS_DIR` when you set one, then the checkout's own `shells/web/public/models` when it exists (so a checkout shares one copy with the web shell), then `~/.cache/lolly/models`.

`lolly models ls` lists every family with what is present, what is missing and the command to fetch it:

| Family | Used by | Size when complete |
|---|---|---|
| `kokoro` | `lolly speak` | 102.0 MB |
| `whisper` | `lolly transcribe` | 76.0 MB |
| `upscale` | `lolly upscale` | 410.7 MB |
| `matte` | `lolly matte` | 29.1 MB |
| `ocr` | `lolly ocr` | 20.5 MB |
| `ai-detect` | `lolly detect-ai` | 33.0 MB |
| `reword` | `lolly reword` | 372.0 MB |
| `depth` | `lolly depth` | 26.0 MB |

`lolly models fetch <family>` stages one family from `https://lolli.li/models/` (`$LOLLY_MODELS_BASE` overrides the host). Before downloading, it prints the file count, the total size and the biggest files by name, then asks you to confirm. `upscale` is 410.7 MB because the GFPGAN face model is 324.5 MB of that total. Every size `lolly models` prints counts a megabyte as 1,048,576 bytes.

When a family is not staged, the command that needs the family refuses to run and lists the files, the size and the fetch command. The exit code is `3` with `error.kind` `MODEL_NOT_STAGED`: the run may work on another runner. The missing files are listed biggest first:

```bash
$ lolly speak "hello there"
Error: speech: the kokoro model is not on this machine - missing onnx/model_quantized.onnx,
voices/bf_lily.bin, tokenizer.json, and 2 more under …/models/kokoro. It is a one-time
88.6 MB (92886949 bytes) download: run  lolly models fetch kokoro
```

::: details How a fetch protects your disk
- `--yes` answers the question in advance. On a runner with no terminal and no `--yes`, the fetch downloads nothing, says how to proceed and exits `0`.
- Every file is checked against a pinned SHA-256 **before** it is written. A mismatch writes nothing and exits `4`.
- Each file is written as `.part` and renamed on success, so an interrupted fetch cannot leave a half-file that looks whole.
- A model command's own refusal gives the size of the one model it needs. `lolly upscale`, for example, asks for the 4.0 MB fast model, while `lolly models fetch upscale` stages the whole 410.7 MB family and reports that size first.
:::
