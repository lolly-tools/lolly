# CLI

`brand-tool` runs any tool from the terminal — same engine, same render path, same output as the web shell. It's **URL mode under a different transport**: `--foo=bar` argv pairs become the exact values the web shell parses from `?foo=bar`, so the CLI can never drift from the GUI. Great for build pipelines, CI, scripting, and batch generation.

From the repo it's wired as an npm script (note the `--` to pass args through):

```bash
npm run cli -- <tool-id> [--input=value ...] [--export=fmt] [--output=file]
# or, if installed as a binary:
brand-tool <tool-id> [--input=value ...] [--export=fmt] [--output=file]
```

## Discovering tools

```bash
npm run cli                      # list every tool (id, status, description)
npm run cli -- qr-code           # show that tool's inputs, defaults, and formats
```

`<tool-id>` with no flags prints the input schema and a usage line — the fastest way to learn what a tool accepts.

## Rendering

```bash
# Write to a file (extension is yours to choose):
npm run cli -- qr-code --url=https://suse.com --output=./qr.svg

# Explicit format, stream to stdout (pipe or redirect):
npm run cli -- qr-code --url=https://suse.com --export=png > qr.png
```

If `--output` is given, the file is written and a byte count is reported on stderr; otherwise the bytes go to **stdout** so you can pipe them.

## Flags

| Flag | Meaning |
|---|---|
| `--output=<path>` | Write to a file. Omit to stream to stdout. |
| `--export=<fmt>` | Output format (`png`, `svg`, `pdf`, `gif`, …). Defaults to the tool's first declared format. Ignored by on-device transform tools (see below). |
| `--width=`, `--height=` | Output size (numbers). |
| `--unit=` | `px` (default), `mm`, `cm`, `in`, `pt`, `pc` — physical sizing. |
| `--dpi=` | Raster DPI for physical units (default 300). |
| `--<inputId>=<value>` | Any tool input (see the tool's schema). |
| `--<flag>` | A bare flag (no `=`) is truthy — handy for boolean inputs. |

Everything that isn't a reserved flag is treated as a tool input and validated against the manifest. Example — an A4 page:

```bash
npm run cli -- some-tool --width=210 --height=297 --unit=mm --export=pdf --output=page.pdf
```

## What the CLI can render

The CLI renders in a headless DOM (jsdom), so **vector and text** formats — **SVG, HTML, MD, TXT** — work natively and reproducibly. Raster (PNG/JPG/WebP/PDF) and **video/GIF** need a real rendering engine; those are produced by the **desktop app's** bundled binary rather than the bare CLI. (Requesting an unsupported format prints a clear error listing what the tool supports.) See the [Build Guide](/info/build-guide.html) for packaging the desktop binary.

## File inputs & on-device utilities

Some tools take **your own file** as input (a `file`-typed input) and hand back a transformed copy — the on-device "utility" shape (strip EXIF, crop, convert). On the CLI, pass the file as a path; the runner loads its bytes:

```bash
npm run cli -- exif-stripper --photo=./holiday.jpg --output=./holiday-clean.jpg
```

These tools produce their output via the `exportFile` transform path (bytes in → bytes out), not a DOM render — so they **ignore `--export`** and there's no render format to choose. The transformed bytes are written to `--output`, or streamed to **stdout** if you omit it. Nothing is ever uploaded; the file is read locally and handed straight back.

## Scripting & CI

Because output is deterministic — same inputs, same bytes — the CLI fits anywhere you generate other build artifacts:

```bash
# Generate an OG image at build time instead of committing a binary:
npm run cli -- quote-card --text="Ship it." --export=svg --output=./public/og.svg

# Fan out over a data file:
while IFS=, read -r name url; do
  npm run cli -- qr-code --url="$url" --output="qr/${name}.svg"
done < links.csv
```

Exit code is non-zero on error; messages go to stderr (set `DEBUG=1` for a stack trace). Input validation failures list each offending field.

## Related

- [URL Mode](/info/url-mode.html) — the parameter model the CLI shares with the web shell (and the reserved params).
- [Exporting & Formats](/info/exporting.html) — what each format is for.
- [AI Agents](/info/ai-agents.html) — driving the same surface from an LLM.
