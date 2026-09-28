# CLI verification and configuration

Verify files, inspect metadata, configure completion and find local state.

Part of [CLI](/info/cli.html).

## Verify a file (`lolly validate`)

The read side of [Content Credentials](/info/content-credentials-identity.html) - entirely on-device, nothing uploaded:

```bash
pnpm run cli validate ./poster.pdf
pnpm run cli validate ./poster.pdf --json
pnpm run cli validate ./poster.png --deep
pnpm run cli validate ./poster.pdf --trust-anchor=./corp-root.pem
pnpm run cli validate ./poster.svg --no-default-anchors    # trust only what you pinned
```

### Which anchors produced the verdict

Trust is only meaningful next to "trusted by what", so every report says which anchor set it used. The default set is the **Lolly CA root** plus the **vendored C2PA known-certificate list** (camera makers, the big generators) plus anything you pinned - the same set the web `/valid` view uses, so one word means one thing on every surface:

```
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

Both exit 0 here: this file is signed with an ephemeral on-device key that chains to nothing, which is the designed posture for a terminal render, not damage. `--no-default-anchors` is the bare-trust check - useful when the only trust you accept is a root you pinned yourself.

| Flag | Meaning |
|---|---|
| `--json` | The shared envelope instead of the human summary. `result.files[]` carries one record per file - `verdict` (the stable slug), `resolved` (the engine's semantic verdict), `report` (the full verifier output), `metadata` (the `--metadata` report, or `null` when it did not run) and `anchors` (which trust anchors produced the verdict). A file that could not be read is a record with its own `error`, not a silence, so a list of ten does not lose nine to one typo. |
| `--deep` | Additionally run the neural pixel-watermark scan (TrustMark / Content Seal / the Lolly durable mark). Needs the browser tier, and is **advisory** - it never changes the exit code. |
| `--trust-anchor=<root.pem>` | Trust an additional root certificate. Repeatable, for an organisation's own CA. `$LOLLY_TRUST_ANCHOR` adds more as a `PATH`-style list (`:` on Unix, `;` on Windows); a leading `~` expands. Flag first, then environment. A pinned root that cannot be read stops the run (exit 2) rather than quietly downgrading the verdict. |
| `--no-default-anchors` | Trust **only** what you pinned: drops the Lolly CA root and the vendored C2PA known-certificate list. With nothing pinned the anchor set is empty and every signer reads untrusted by construction - the bare-trust check. |
| `--metadata` | Also report what else is in the file: embedded metadata, PDF structure and text that is present in the file but not visible on the page. |
| `--rebuild=<session.lolly>` | The reproducibility receipt: render the `.lolly`'s session again here and report `IDENTICAL` (exit 0) or `DIFFERENT` (exit 1) with every reason it could check - engine version, tool version, a font that resolves differently, or the offset where the content first diverges. `svg`, `emf`, `eps`, `dxf` and `csv` only; a raster or PDF artifact is refused with exit 2, because those bytes come from a browser engine rather than the engine's own emitters. See [Reproducibility](/info/reproducibility.html#prove-it-yourself). |

The summary headlines whether the file was genuinely made with Lolly and is unchanged since. The exit code follows the table above: **0** the file matches what was signed (including an expired certificate - Lolly signs with short-lived on-device certificates, so any other rule would fail every gate on its own correct output within a month), **4** a credential is present and the bytes no longer match it, **5** no credential at all, **2** the path could not be read. `--strict` promotes expired to 4; `--require=none` turns off verdict-based exit codes entirely ("just tell me what is in this file"). Several files can be given at once - the exit code is the worst one's.

### `--metadata`: what else is in this file

`--metadata` answers the question people actually have before sending a file on. It adds, on top of the credential verdict:

- **Embedded metadata** - EXIF, XMP and IPTC fields, a GPS fix if the file records one, an AI source-type *declaration* if the generator wrote one and any bytes riding after the container's end (the appended-payload pattern). Fields the engine considers personally identifying are marked.
- **PDF structure** - pages, page sizes, fonts, images, annotations, the Info dictionary, whether an XMP packet is present and how much text is extractable. Pages carrying no text layer are called out as scans needing OCR.
- **Text present in the file but not visible on the page** - the classic failed redaction, where a black bar is drawn over words that are still in the content stream. The report says where those words are and quotes them back. It does not say why they are there: a botched redaction and a layering mistake look identical from outside.

```bash
pnpm run cli validate ./contract.pdf --metadata
pnpm run cli validate ./photo.jpg --metadata --require=none    # report only, never a gate
pnpm run cli validate ./contract.pdf --metadata --json
```

Honesty rules this output holds to, because a person decides what to send based on it:

- Every report ends with what it did **not** check. Nothing found is not the same as nothing there.
- **No invisible or neural watermark detection runs here.** SynthID is not detected by Lolly at all. The TrustMark, Content Seal and Lolly durable pixel marks need the browser tier - that is `--deep`, not `--metadata`.
- The hidden-text pass covers one case: text under an opaque shape that covers most of the line. Text hidden by invisible render mode, by a clip path, by white-on-white colouring, or under a bar drawn tightly around the glyphs is not reported.
- PDFs are read to a page cap (25). When a document is longer, the report says how many pages it read and claims nothing about the rest.
- A file too broken to parse produces fewer findings plus an explicit "this report is incomplete" line, never a crash and never a clean bill of health.

With `--strict`, a finding that would matter before sharing - hidden text, a GPS fix, or undeclared bytes appended past the container - exits 4 (REFUSED). Without `--metadata` those passes never run, so `--strict` cannot fire on them.

## Shell completion (`lolly completion`)

`lolly completion bash|zsh|fish` prints a completion script to stdout. It completes verbs, flags, and tool ids read from the active profile's catalog at the moment the script is generated:

```bash
lolly completion bash > /usr/local/etc/bash_completion.d/lolly   # Homebrew bash-completion
lolly completion zsh  > ~/.zsh/completions/_lolly                # then: autoload -U compinit && compinit
lolly completion fish > ~/.config/fish/completions/lolly.fish
```

The tool-id list is a snapshot. Install new tools, then run `lolly completion <shell>` again to pick them up - there is no live catalog read from inside a shell's completion function.

## Point it at another brand pack (`LOLLY_ROOT`)

The CLI reads tools and the asset catalog from the repo root it finds itself in. Set `LOLLY_ROOT` to render from any directory with the same layout - a `tools/` directory of tool folders and a built `catalog/`:

```bash
LOLLY_ROOT=/path/to/brand-pack pnpm run cli qr-code --url=https://example.com --output=qr.svg
```

The override is **marker-validated**: the directory must hold a generated catalog index (`catalog/tools/index.json` or `catalog/assets/index.json`), and a `LOLLY_ROOT` without one is ignored - resolution falls back to walking up from the CLI itself, then the working directory. That makes the CLI a generic brand-pack renderer: build a pack's `tools/` + `catalog/` and every command here - render, batch, smoke, assets - runs against it, with zero code change.

## Where saved sessions live

A `lolly` run is ephemeral: state a tool saves stays in memory for that run and is gone when it exits. What it does read is the saved sessions this machine already has. One directory serves all three local shells - the desktop app, the TUI and the CLI - and they pick it in this order:

1. `$LOLLY_STATE_DIR`, when you name one.
2. `$LOLLY_TUI_DIR`, the old name for the same thing. It still works and prints a one-line note saying which name replaced it.
3. The desktop app's own data directory, when the app is installed here: `~/Library/Application Support/tools.lolly.Desktop` on macOS, `$XDG_DATA_HOME/tools.lolly.Desktop` (or `~/.local/share/...`) on Linux, `%APPDATA%\tools.lolly.Desktop` on Windows.
4. `~/.lolly`.

Sessions sit in `saved-state/<slot>.json` there, in the record the desktop app writes, so a project saved in the app loads in the terminal by its slot and a project saved in the TUI opens in the app.

Writing is the one asymmetry, and it is deliberate: `lolly` only writes state to disk when rungs 1 or 2 name the directory. A headless render should not leave files in your home directory, or in the app's store, that nobody asked for. Name a directory and a state-saving tool becomes scriptable across runs.

[Back to CLI](/info/cli.html).
