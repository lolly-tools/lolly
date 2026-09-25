# CLI file and media utilities

Process local files, redactions, speech and on-device models.

Part of [CLI](/info/cli.html).

## File inputs & on-device utilities

Some tools take **your own file** as input (a `file`-typed input) and hand back a transformed copy - the on-device "utility" shape (strip EXIF, crop, convert). On the CLI, pass the file as a path; the runner loads its bytes:

```bash
pnpm run cli strip-data --source=./holiday.jpg --output=./holiday-clean.jpg
```

These tools produce their output via the `exportFile` transform path (bytes in → bytes out), not a DOM render, so there is no render format to choose: the output container follows the file you gave it. `--export=` is therefore **refused**, not ignored - it used to be accepted and dropped, which printed a success line for a file whose contents did not match its name:

```
$ lolly strip-data --source=./photo.jpg --export=png --output=./clean.png
Error: "strip-data" is an on-device transform (file in → file out), so --export=png has
nothing to act on: the output container follows the file you gave it, and the reserved
export format never reaches the tool. Drop the flag, or use one of the tool's own inputs
if it offers a conversion.
```

A tool that genuinely converts does it through its **own input**, not the export flag. `convert-image` declares an input literally called `format`, which the reserved export param shadows, so it is set with the explicit namespace:

```bash
pnpm run cli convert-image --source=./photo.heic --input.format=png --output=./photo.png
```

Choosing an `--output` name whose extension disagrees with the bytes a transform produces is a **warning**, not a refusal - the transform cannot change the container to match, and the file is written under the name you asked for with that fact stated on stderr.

The transformed bytes are written to `--output` (or `--filename=`), or streamed to **stdout** if you omit both. Nothing is ever uploaded; the file is read locally and handed straight back.

Most utilities run entirely in the headless DOM. A few **rebuild real pixels** - `redact` repaints an image on a canvas and rasterises PDF pages - which jsdom cannot do on its own, so the CLI puts a real 2D canvas behind it (Skia, via `@napi-rs/canvas`) and rasterises PDF pages with Lolly's own page interpreter. That runs locally with no browser: `lolly redact` on a PDF or an image reports `tier: node`, and the bars it burns cover exactly the pixels the web app's would - the bar geometry is one shared module, called by both. `--verify` re-scans the finished copy here the same way it does anywhere else, so a redaction is still gated before any bytes are written.

One gap in the terminal's page render, stated because a redacted page is a picture of the original: text, vector geometry and embedded rasters all come through, but shadings, tiling patterns and graphics-state soft masks do not - their decoders are web-shell modules. A gradient paints the flat back-stop the engine emits for it. Text and geometry, which is what a redaction covers, are complete.

If that canvas is not installed (a lean install), or a tool needs something only a browser engine can do, the CLI re-runs the same export in the scoped Chromium driving the built web shell (the [Tier B rendering path](/info/cli-rendering.html#what-the-cli-can-render)). It says so on stderr when it switches. If the browser or the built shell is missing it stops and says what to install (`lolly install-browser`, `pnpm run build:web`); it never writes a file that was not actually redacted.

### Redaction instructions: one string, many files

A redaction is fully described by its bars plus its options, and that description is ordinary URL state - so the same string works as a share link, as CLI flags and as an [MCP](/info/mcp.html) call. Bar fields are `page,x,y,w,h`: PDF bars in points from the page's top-left, image bars in pixels.

```bash
# Compact rows (tilde-separated), the form a share link uses:
pnpm run cli redact --source=./contract.pdf --bars='1,40,60,200,24~2,40,100,120,14' \
  --grayscale --output=./contract-redacted.pdf --verify

# The same instructions as JSON, or from a spreadsheet:
pnpm run cli redact --source=./scan.png --bars='[{"page":1,"x":40,"y":60,"w":200,"h":24}]' --output=./scan-redacted.png
pnpm run cli redact --source=./scan.png --bars-data=./bars.csv --output=./scan-redacted.png
```

Because the instructions are just a link, you can mark up one document in the app, hit **Share** and run that link headlessly over every other copy - forms, certificates, invoices and anything else where the same fields sit in the same place on every page:

```bash
for f in ./inbox/*.pdf; do
  pnpm run cli "$SHARE_LINK" --source="$f" --output="./clean/$(basename "$f")" --verify || echo "FAILED: $f"
done
```

`--verify` prints a line per file once the tool's own gate has run: the redacted copy is re-opened and re-scanned (no metadata, one end-of-file marker, no recoverable covered text, bar regions re-sampled as solid fill) before any bytes are written. A failed check is a non-zero exit with the tool's own sentence and **no output file**, so a shell loop can treat failures as failures. What it cannot tell you is whether an invisible whole-image watermark was present: nothing here detects or removes one.

## Speech

Two speech commands, both reaching the same `host.speech` a tool's own `hooks.js` reaches. Nothing is uploaded and nothing is called out to: the models run here, on this machine. Because the bridge carries `host.speech` now, a tool that speaks its own text - a narration tool, a caption track, the audiogram's voiceover - renders headlessly with no extra flags.

```bash
pnpm run cli speak "Constraint first, on device, from the terminal." --out=./clip.wav
pnpm run cli speak "…" --voice=af_heart --speed=0.95 --out=./clip.wav --json
pnpm run cli transcribe ./clip.wav --lang=en --json
```

**`lolly speak`** writes a 24 kHz mono WAV. `--out=<file>` sets the name (`--out=-` streams it to stdout, `speech.wav` is the default name), `--speed=<n>` is a rate multiplier where `1` is the natural pace and `--voice=<id>` picks one of the 28 Kokoro voices - 20 en-US and 8 en-GB, `bf_lily` by default because "lolly" is a British word and Lolly's own voice should sound like one. A voice can be a **blend**: `--voice=af_heart+bf_lily:0.3` mixes two with the weights normalised, the same setting the app's voice controls write. Progress goes to stderr, per sentence.

**`lolly transcribe <clip.wav>`** reads a clip back as text. The text is stdout and nothing else is, so `lolly transcribe take.wav > take.txt` is a whole workflow; `--lang=<code>` sets the spoken language, and `--json` adds the word timings.

**WAV in, and it says so when it cannot.** Node has no MP3, AAC or Opus decoder, and shelling out to whatever `ffmpeg` happens to sit on `PATH` would make a headless run depend on a binary nobody declared. So an `mp3`, `m4a`, `aac`, `ogg`, `oga`, `opus`, `flac`, `weba`, `webm`, `mp4` or `mov` file is refused **by name** rather than read as noise, and a generated ZzFXM song is refused too (it carries no speech to quote back):

```
$ lolly transcribe ./interview.m4a
Error: speech: m4a needs a platform codec this shell does not have - hand it a WAV, or run
it in a browser shell
```

**The WAV is written plain.** `lolly speak` is a subcommand, not a `lolly run`, so the export pipeline never sees its bytes and no Content Credential is stamped on them. If you are shipping generated speech somewhere it has to declare itself, that declaration is yours to add for now.

`--json` on either command puts the result in the [standard envelope](/info/cli-automation.html#machine-interface-json). `speak` reports `output`, `voice`, `speed`, `sampleRate`, `duration`, `granularity`, the sentence `script` and a `words` array of `{ text, start, end }` spans in seconds; the reverse direction reports `text`, `words`, `lang` and `granularity`. Those spans are what a caption or a karaoke highlight keys off, so read `granularity` rather than inferring alignment from span lengths.

### The models, and who decides they download

Nothing here fetches anything on its own. Every family is read from a models directory, and a family that is not in it is a **refusal naming the command that would fetch it**, the bytes that would move and the directory that was searched.

That directory is `$LOLLY_MODELS_DIR` when you set one, then the repo's own `shells/web/public/models` when it exists (so a dev checkout shares one copy with the web shell), then `~/.cache/lolly/models`.

`lolly models ls` lists every family these shells can run - `kokoro` and `whisper` for speech, plus `upscale`, `matte`, `ocr`, `ai-detect`, `reword` and `depth` - with what is present, what is missing and the fetch command for anything incomplete. On a machine that has staged them all:

```
$ lolly models ls
Model files under /Users/andy/Build/lolly/shells/web/public/models
  kokoro     speech synthesis (lolly speak)     complete (102.0 MB)
  whisper    transcription (lolly transcribe)   complete (76.0 MB)
  upscale    AI enlargement (lolly upscale)     complete (410.7 MB)
  matte      background removal (lolly matte)   complete (29.1 MB)
  ocr        text recognition (lolly ocr)       complete (20.5 MB)
  ai-detect  AI-text estimate (lolly detect-ai) complete (33.0 MB)
  reword     on-device rewrite (lolly reword)   complete (372.0 MB)
  depth      depth map (lolly depth)            not published yet
```

`lolly models fetch <family> --yes` stages any of them from `https://lolli.li/models/` (`$LOLLY_MODELS_BASE` overrides the host). `depth` is the one exception, and it is honest about it: no depth model is published yet, so there is nothing to download and the command says so instead of inventing a URL.

The fetch prints the file count, the total size and the biggest files by name **before** a byte moves, then asks - `upscale` is 410.7 MB because 324.5 MB of it is the GFPGAN face model, and a total that says so is not a surprise. `--yes` answers in advance; on a runner with no terminal and no `--yes` it downloads nothing, says how to proceed and exits `0`. Every file is checked against a pinned SHA-256 **before** it is written, and a mismatch writes nothing and exits `4` (`REFUSED`). Each file is written as `.part` and renamed on success, so an interrupted fetch cannot leave a half-file that looks whole.

A missing model is never a silent download:

```
$ lolly speak "hello there"
Error: speech: the kokoro model is not on this machine - missing onnx/model_quantized.onnx,
voices/bf_lily.bin, tokenizer.json, and 2 more under …/models/kokoro. It is a one-time
88.6 MB (92886949 bytes) download: run  lolly models fetch kokoro
```

Exit `3` (`UNAVAILABLE_HERE`) - "may well succeed on another runner" - with `error.kind` of `MODEL_NOT_STAGED`. The missing files are listed biggest first, so the sentence opens with the weights rather than with three config files.

## On-device ML

Six utilities over the same models the app runs. Each is a thin wrapper over the API a tool's hook reaches through `host.*` - there is no second implementation of a model, a tiling scheme or a gate anywhere in the CLI - and each refuses by model name when its weights are absent, exits `3` and downloads nothing. They exist so that a capability nothing surfaces is still findable: `host.upscale`, `host.matte` and `host.ocr` are on the CLI bridge now, so a tool that feature-detects one gets it in a headless `lolly run`, and these six commands are how a person checks it runs on their machine.

```
$ lolly upscale ./small.png --scale=4 --out=./big.png
Error: The Real-ESRGAN general (fast) model is not on this machine. Run `lolly models fetch
upscale` to download it (4.0 MB), or point LOLLY_MODELS_DIR at a directory that already has
it. Looked in /…/models/upscale.
```

- **`lolly upscale <image> [--scale=2|4] [--model=<id>] [--max-edge=N] [--out=<file.png>] [--models]`** - AI enlargement, PNG out, per-tile progress on stderr. `--scale` takes `2` or `4`; the models are natively x4 and `2` trims the result. `--models` prints the roster with sizes and licences: `realesr-general-x4v3` (4.0 MB, fast), `realesrgan-x4plus` (63.9 MB, quality), `realesrgan-x4plus-anime` (17.1 MB) and `gfpgan-v1.4` (340 MB, face restore, flagged "can invent face details"). An image the model cannot be run over is refused with the reason (exit `4`), not attempted and truncated.
- **`lolly matte <image> [--model=u2netp|modnet] [--max-edge=N] [--out=<file.png>] [--models]`** - background removal. `u2netp` (4.4 MB) is the default, `modnet` (24.7 MB) the portrait model. Every RGB pixel out is the input's byte for byte and only the alpha is computed, which is why a matte is disclosed as an edit in the app and an upscale is not.
- **`lolly ocr <image> [--json] [--single-line] [--min-confidence=<n>] [--models]`** - text recognition with `ppocr-v5-mobile` (20.5 MB, ten languages). The recognised text **is** stdout, so `lolly ocr shot.png > shot.txt` works; `--json` adds per-line confidence and a box in source pixels. Nothing read is exit `5` (`NOT_FOUND`), a legitimate negative answer rather than a failure.
- **`lolly detect-ai "<text>" [--json] [--in=<file.txt>]`** (a pipe works too) - prints an **estimate** with its operating point and the model that produced it, never a verdict. Under 50 words, or mostly non-Latin script, it prints "Not checked" with the reason and exits `5`: the detector is trained on English and over-scores non-native-English prose, and an absent check is not an answer.
- **`lolly reword "<sentence>" [--style=plain] [--samples=N] [--json] [--in=<file.txt>]`** - on-device rewrites, shorter and plainer, one per line. Only `--style=plain` is accepted; anything else is a usage error that says why, because the prompt is engine data asking for exactly one thing and a silently ignored style would be the class of quiet failure this shell exists to remove. No candidate passing the gate (longer, off-topic, or a changed fact) is exit `5`, not a crash.
- **`lolly depth <image> [--max-edge=N] [--out=<file.png>]`** - a greyscale depth map, white nearest. It refuses today, by name: no depth model is published, so there is nothing to fetch and nothing to run.

Two things to know about these six. They write **plain files**: they are not a `lolly run`, so the export pipeline's Content Credentials and Imprint do not apply, and an upscaled PNG from the terminal carries no credential naming the model. And the execution provider is **CPU by default**, because that is what the app's WASM kernels match numerically and what every model on the roster is verified against. `LOLLY_ORT_EP=coreml` (or `=cuda`) opts into the accelerated provider, which is faster and can move the numbers on some graphs - an opt-in, never a default. `LOLLY_ORT_THREADS=<n>` caps the threads each model session may use (unset means every core); `1` runs a graph on the calling thread with no pool, which is slower but keeps the cost predictable on a shared machine.

[Back to CLI](/info/cli.html).
