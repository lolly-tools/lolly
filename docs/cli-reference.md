# CLI reference

The facts a script or an agent looks up: exit codes, the `--json` envelope, global flags and environment variables. It also covers verifying a file, the document and picture verbs, where local state lives and shell completion. The [lolly CLI](/info/cli.html) page is the place to start.

## Exit codes

Every command answers with one code per outcome, so a pipeline can branch on the code instead of reading stderr. The meanings were fixed when the CLI reached general availability: a new code can be added, but an existing one does not change meaning without a major version.

| Code | Name | Meaning | What to do |
|---|---|---|---|
| 0 | `OK` | The requested thing was produced. | Carry on. |
| 1 | `FAILED` | It was possible, it ran, and it failed: a hook threw, or the render produced nothing. A gate inside a tool's own hook (`--verify`) fails this way too. | Read the message; fix the input or the tool. |
| 2 | `USAGE` | Wrong invocation: unknown tool, undeclared format, missing argument, unreadable path, or a `learning build` source that only a change to the module can fix (`LEARNING_NO_RENDITION`, `LEARNING_DEVICE_FILE`, `LEARNING_LOCAL_PATH`). | Fix the command line. |
| 3 | `UNAVAILABLE_HERE` | Impossible in **this** installation: no browser, an unmet capability, a paint-tier render that could not produce the file, an on-device model that is not staged (`MODEL_NOT_STAGED`, `MODEL_NOT_INSTALLED`), a runtime this install does not carry (`CAPABILITY_UNAVAILABLE`), `--hdr` with `--durable` (`HDR_DURABLE_UNAVAILABLE`), or a `learning build` source this install cannot render (`LEARNING_FORMAT_UNAVAILABLE`, `MOTION_RENDERER_UNAVAILABLE`). | Retry on a runner that has what is missing. |
| 4 | `REFUSED` | A protective check this shell ran said no. | Read the findings; do not ship the file as it is. |
| 5 | `NOT_FOUND` | A legitimate negative answer: `validate` found no credential, `rebrand compile` has a deck that needs review, `check` has findings to review and no errors. With `--json`, the envelope carries the full result and `ok: false`. | Look at the result; it is an answer, not an error. |
| 6 | `AUTH` | A missing or wrong password or passphrase. | Supply the secret. |
| 70 | `INTERNAL` | An unclassified exception: a bug in Lolly. | Report it; do not retry. |

::: details Everything that exits 4
- the bytes were not the format claimed, or a credential is present but broken;
- `--strict` promoted a gate-class warning, or `--depth=float` was asked of an 8-bit render;
- `lolly check` found an error (or any warning under `--strict`);
- `lolly package` met a Design document whose pictures have no bytes or are not catalog ids, or an output that already exists;
- `lolly compose` refused a spec (with the JSON pointer of the key) or met an output that already exists;
- a Design document's authoring keys could not be lowered (`AUTHORING_INVALID`);
- a render whose sources still need a rights decision; it still writes its file. `learning build` does the same and lists those blocks in `result.rightsDecisionsRequired`.
:::

Messages go to stderr; `--verbose` (or `DEBUG=1`) adds stack traces. An input that fails validation lists each field at fault. Several commands take a list of files, and then the exit code is the worst one's.

## The --json envelope

`--json` puts **one JSON document on stdout and nothing else**; every human line moves to stderr. It works on `list`, `describe`, `assets`, `validate`, `smoke`, `batch`, `preflight`, `models`, `mix`, `speak`, `transcribe`, `ocr`, `detect-ai`, `reword`, `rebrand`, `read`, `check`, `compose`, `look` (with `--output`), `sample`, `trace`, `system`, `start`, `files`, `prepare` and `learning`, and on `measure --text`, `measure --text-layers` and `package` of a Design document.

It is **not** available on a render, because a render's stdout is the file; asking for both is a usage error. `lolly speak --out=- --json` is refused for the same reason.

Every command answers in the same envelope, except `ocr`, `detect-ai` and `reword`, which still emit a smaller `{ "ok": true, "command": …, … }` document with no `schemaVersion` or `warnings`:

```json
{
  "schemaVersion": 1,
  "command": "validate",
  "ok": true,
  "engine": "1.115.0",
  "cli": "0.1.0",
  "result": { },
  "warnings": [{ "code": "UNKNOWN_FLAG", "message": "…", "kind": "usage" }],
  "error": null
}
```

The two version strings are whatever this installation runs; read them from the envelope.

The envelope covers the **failure** path too. A missing file, an unknown tool or a crash still leaves a complete document on stdout, so `lolly … --json > r.json` never leaves an unparseable file. On that path `result` is `null` and `error` is filled in:

```json
"error": { "code": "UNAVAILABLE_HERE", "exit": 3, "kind": "FORMAT_UNAVAILABLE", "message": "…" }
```

Branch on `error.kind` and `error.exit`, never on `error.message`, whose wording can change. `ok` mirrors the exit code, so a real answer can be `ok: false`: `validate` reporting no credential exits `5` with a full `result`.

**Compatibility rules.** Keys may be added inside `result`, `error` and `warnings` at any time, and enum values may be added, so ignore unknown keys and keep a default branch. `schemaVersion` goes up only when a key is removed, retyped or changes meaning.

### Discovery, for an agent

```bash
lolly list --json                 # every tool, and what this installation can do
lolly describe qr-code --json     # one tool's full input schema
```

`list --json` carries a `result.environment` block: the engine and CLI versions, the content root, the host capabilities this shell provides, the browser-free formats and a per-tier report (`domFree`, `raster`, `desktop`, `browser`, `images`) with the reason each missing tier is missing. Each tool carries `capabilities`, `unmetCapabilities`, `nativeFormats` and `runnableHere`, so an agent can tell that `screencap` will exit `3` here **before** it tries.

`describe --json` returns each input's declared spec plus three things the manifest cannot know: `flag` (the command-line spelling), `urlParam` (the compact alias, when the tool declares one) and `syntax` (how to write a non-scalar value). For an input whose id is also a reserved flag (`width`, `height`, `format`), `flag` is `--input.<id>=` and `shadowedByReservedParam` is `true`, because the bare id would set the export size instead.

## Global flags

These work on every command:

| Flag | Meaning |
|---|---|
| `--json` | One JSON envelope on stdout instead of human text ([above](#the-json-envelope)). Not valid on a render. |
| `--quiet` | Suppress non-error stderr: progress notes, warnings, the byte-count line. Errors still print. |
| `--verbose` | Diagnostics and stack traces. `DEBUG=1` is an alias. |
| `--strict` | Promote this run's warnings to a failure after the work is reported: exit `2` for a usage-class warning, `4` for a gate-class one. |
| `-h`, `--help`, `-v`, `--version` | Recognised anywhere in the arguments. |
| `--` | Ends option parsing. Everything after it is positional, which is the only way to pass a `longtext` value that itself starts with `--`. |

A flag that takes a value is refused in its bare form rather than read as `"1"`: `lolly qr-code --output` is an error, not a file called `1`. `NO_COLOR` is honoured alongside the terminal check. Render flags are listed in [Render with the CLI](/info/cli-rendering.html#flags).

## Environment variables

A flag always wins over its environment variable. `lolly list --json` reports which of the CLI's own variables are set, under `result.environment.env`.

| Variable | Effect |
|---|---|
| `LOLLY_ROOT` | The content root to read tools and the catalog from ([A standalone CLI](/info/cli.html#a-standalone-cli-carries-no-tools-and-no-catalog)). |
| `LOLLY_PROFILE` | The content profile: which tool packs and catalog a checkout uses. |
| `LOLLY_STATE_DIR` | Where saved sessions and terminal design systems live ([below](#where-saved-sessions-live)). `LOLLY_TUI_DIR` is the old name. |
| `LOLLY_RENDERER` | `auto` (default), `desktop` or `chromium`: which paint renderer to use. |
| `LOLLY_DESKTOP_BIN`, `LOLLY_RENDER_SERVER` | An app executable in an unusual place, or the app's `render.json` directly. |
| `LOLLY_BROWSER_PATH`, `LOLLY_BROWSER_CHANNEL` | A browser binary to use, or an installed channel such as `chrome`, instead of the downloaded Chromium. |
| `PLAYWRIGHT_BROWSERS_PATH` | Where `lolly install-browser` puts Chromium. |
| `LOLLY_WEB_DIST`, `LOLLY_WEB_BASE` | A built web shell somewhere else, or the address of one you serve. |
| `LOLLY_EXPORT_IDLE_TIMEOUT`, `LOLLY_CLI_TIMEOUT` | Seconds without progress before a Chromium export stops; the desktop renderer's timeout. |
| `LOLLY_TIER_B_DEBUG` | `1` keeps the headless page's logs, like `--tier-b-debug`. |
| `LOLLY_TRUST_ANCHOR` | Extra trust roots for `validate`, as a `PATH`-style list. |
| `LOLLY_SIGN_KEY`, `LOLLY_SIGN_CERT`, `LOLLY_SIGN_KEY_PEM`, `LOLLY_SIGN_CERT_PEM`, `LOLLY_SIGN_KEY_PASSWORD` | A signing identity ([Signing from the terminal](/info/cli-signing.html#the-two-flags-and-five-variables)). |
| `LOLLY_MODELS_DIR`, `LOLLY_MODELS_BASE` | Where on-device models are read from, and the host they are fetched from. |
| `LOLLY_ORT_EP`, `LOLLY_ORT_THREADS` | An accelerated model provider (`coreml`, `cuda`), and a thread cap per model session. |
| `LOLLY_HOOK_WORKER` | `1` runs tool hooks in a worker thread. |
| `SOURCE_DATE_EPOCH` | The time written into `.lolly` zip entries by `lolly package`. |
| `NO_COLOR` | Plain text output. |

## Verify a file (lolly validate)

`lolly validate` is the read side of [Content Credentials](/info/content-credentials-identity.html), entirely on this machine:

```bash
lolly validate ./poster.pdf
lolly validate ./poster.pdf --json
lolly validate ./poster.png --deep
lolly validate ./poster.pdf --trust-anchor=./corp-root.pem
lolly validate ./poster.svg --no-default-anchors    # trust only what you pinned
```

The summary says whether the file was made with Lolly and is unchanged since. The exit code is `0` when the file matches what was signed, including an expired certificate (Lolly signs with short-lived on-device certificates, so any other rule would fail every gate on its own correct output within a month); `4` when a credential is present and the bytes no longer match it; `5` when there is no credential; and `2` when the path could not be read. `--strict` makes an expired certificate exit `4`, and `--require=none` turns off verdict-based exit codes ("just tell me what is in this file").

### Which anchors produced the verdict

Trust only means something next to "trusted by what", so every report says which anchor set it used. The default is the **Lolly CA root**, the **vendored C2PA known-certificate list** (camera makers and the big generators) and anything you pinned. That is the same set the app's Verify view uses, so one word means one thing everywhere:

```text
$ lolly validate ./qr.svg
./qr.svg  [svg]
✦ Made with Lolly - credential intact, file unchanged since export
  …
  ℹ signingCredential.untrusted - signing certificate untrusted - an ephemeral on-device key, not a CA-issued identity
  Trust anchors: C2PA known-certificate list (54) · pinned: none · Lolly CA root

$ lolly validate ./qr.svg --no-default-anchors
  …
  Trust anchors: no built-in anchors · pinned: none · Lolly CA root NOT pinned
```

Both exit `0`: this file is signed with an on-device key that chains to nothing, which is the expected state for a terminal render, not damage. [Signing from the terminal](/info/cli-signing.html) shows how to sign with a name a recipient can verify.

| Flag | Meaning |
|---|---|
| `--json` | The shared envelope. `result.files[]` holds one record per file: `verdict` (the stable slug), `resolved` (the engine's verdict), `report` (the full verifier output), `metadata` (the `--metadata` report, or `null`) and `anchors`. A file that could not be read gets a record with its own `error`, so one typo does not hide nine results. |
| `--deep` | Also run the neural pixel-watermark scan (TrustMark, Content Seal and the Lolly durable mark). Needs the paint tier, and is **advisory**: it never changes the exit code. |
| `--trust-anchor=<root.pem>` | Trust another root certificate, such as your organisation's CA. Repeatable; `$LOLLY_TRUST_ANCHOR` adds more as a `PATH`-style list (`:` on Unix, `;` on Windows), and a leading `~` expands. A pinned root that cannot be read stops the run (exit `2`) rather than quietly weakening the verdict. |
| `--no-default-anchors` | Trust **only** what you pinned. With nothing pinned, every signer reads untrusted: the bare-trust check, which confirms a green verdict came from a root you chose. |
| `--require=credential\|none` | `credential` (the default) gates the exit code on the verdict; `none` reports what is in the file and exits `0` when it could be read. |
| `--metadata` | Also report what else is in the file ([below](#metadata-what-else-is-in-this-file)). |
| `--rebuild=<session.lolly>` | The reproducibility receipt: render the session again here and report `IDENTICAL` (exit `0`) or `DIFFERENT` (exit `1`) with every reason it could check: engine version, tool version, a font that resolves differently, or the offset where the content first differs. `svg`, `emf`, `eps`, `dxf` and `csv` only; a raster or PDF is refused with exit `2`, because those bytes come from a browser engine. See [Reproducibility](/info/reproducibility.html#prove-it-yourself). |

### --metadata: what else is in this file

`--metadata` answers the question people have before sending a file on. On top of the credential verdict it reports:

- **Embedded metadata**: EXIF, XMP and IPTC fields, a GPS fix if the file records one, an AI source-type *declaration* if the generator wrote one, and any bytes after the container's end. Fields the engine considers personally identifying are marked.
- **PDF structure**: pages, page sizes, fonts, images, annotations, the Info dictionary, whether an XMP packet is present and how much text can be extracted. Pages with no text layer are named as scans that need OCR.
- **Text in the file but not visible on the page**: the classic failed redaction, where a black bar covers words that are still in the content stream. The report says where those words are and quotes them back. It cannot say why they are there.

```bash
lolly validate ./contract.pdf --metadata
lolly validate ./photo.jpg --metadata --require=none    # report only, never a gate
```

| | `--metadata` | `--deep` |
|---|---|---|
| Reads | Embedded fields, PDF structure, hidden text | Pixel watermarks: TrustMark, Content Seal, the Lolly durable mark |
| Needs | Nothing extra | The paint tier |
| Changes the exit code | Under `--strict`: hidden text, a GPS fix or bytes after the container exit `4` | Never |

What this report does not check:

- **No invisible or neural watermark detection runs under `--metadata`.** SynthID is not detected by Lolly at all.
- The hidden-text pass covers one case: text under an opaque shape that covers most of the line. Text hidden by an invisible render mode, a clip path, white-on-white colour, or a bar drawn tight around the glyphs is not reported.
- PDFs are read to 25 pages. A longer document's report says how many pages it read and claims nothing about the rest.
- A file too broken to parse gives fewer findings plus an explicit "this report is incomplete" line, never a crash and never a clean bill of health.

Every report ends with what it did **not** check, because nothing found is not the same as nothing there.

## Document verbs

The versioned document API works without rendering a tool to pixels:

```bash
lolly schema qr-code
lolly compile qr-code --inputs=inputs.json > document.json
lolly validate document.json --document
lolly inspect document.json
lolly measure document.json
lolly diff before.json after.json
lolly optimize export.png --format=png --output=clean.png
lolly package document.json --output=session.lolly
```

`compile` emits the hydrated, typed document plus warnings, and `schema` emits its JSON Schema. `inspect`, `measure` and `diff` read meaning, not pixels. `optimize` reports the fixed stages it ran when writing a file, and `package` writes an `application/vnd.lolly+zip` share envelope.

A logical asset input such as `image://brand/logo`, `catalog://lolly/logo/primary` or `library://user/upload/…` resolves through the same host bridge as an ordinary render. A CLI run on a device does not resolve credentialled `cms://` or governed `net://` references; those need Lolly Work.

`measure` and `package` also take a Design document directly, and `inspect --forensic` reports located AI clues and their coverage ([AI evidence in Verify](/info/verify-ai-evidence.html)). [Rebuild a deck from the terminal](/info/cli-decks.html) covers the Design forms.

## Look at a picture in its own coordinates

The MCP server's looking tools are CLI verbs too, over the same code, so a script sees what an agent sees. Each takes an SVG, PNG, JPEG, GIF or WebP file, or `-` for standard input:

```bash
lolly design --z=… --export=svg | lolly look - --output=look.png
lolly look poster.svg --region=0,0,400,300 --grid=20 --output=corner.png
lolly sample poster.svg --points="120,80;640,400" --radius=3
lolly trace photo.jpg --max-lines=20 --design-layers --json
```

- `look` draws the picture, or one region enlarged, with a grid numbered in the picture's own units: the SVG's viewBox (for Design, the artboard pixels a layer's x, y, w and h use) or a raster's pixels. With `--json` it needs `--output`, because the picture and the envelope cannot share stdout.
- `sample` gives the colour at each point, averaged over a small disc, with the nearest colour of the active design system and its distance (ΔE in OKLab).
- `trace` gives the picture's edges as lines in the same units, longest first; `--design-layers` adds each line as a Design path layer.

## Where saved sessions live

A `lolly` run is short-lived: state a tool saves stays in memory for that run. What it does read is the saved sessions this machine already has. One directory serves the desktop app, the TUI and the CLI, picked in this order:

1. `$LOLLY_STATE_DIR`, when you name one.
2. `$LOLLY_TUI_DIR`, the old name for the same thing. It still works and prints a one-line note naming its replacement.
3. The desktop app's data directory, when the app is installed: `~/Library/Application Support/tools.lolly.Desktop` on macOS, `$XDG_DATA_HOME/tools.lolly.Desktop` (or `~/.local/share/...`) on Linux, `%APPDATA%\tools.lolly.Desktop` on Windows.
4. `~/.lolly`.

Sessions sit in `saved-state/<slot>.json` there, in the record the desktop app writes. A project saved in the app loads in the terminal by its slot, and one saved in the TUI opens in the app.

`lolly` writes a tool's saved state to disk only when rung 1 or 2 sets the directory, so a headless render leaves no files that nobody asked for in your home directory or the app's store. Name a directory and a state-saving tool becomes scriptable across runs.

Terminal design systems are kept differently. `lolly system init`, `import`, `add` and `use` store them under `design-systems/`, with the list in `design-systems.json`, in whichever directory the order above picks. A bare `lolly` in a terminal also records there that you have seen its start screen.

## Shell completion (lolly completion)

`lolly completion bash|zsh|fish` prints a completion script for verbs, flags and the tool ids in the active profile's catalog:

```bash
lolly completion bash > /usr/local/etc/bash_completion.d/lolly   # Homebrew bash-completion
lolly completion zsh  > ~/.zsh/completions/_lolly                # then: autoload -U compinit && compinit
lolly completion fish > ~/.config/fish/completions/lolly.fish
```

The tool-id list is a snapshot taken when the script is generated. After installing new tools, run `lolly completion <shell>` again.
