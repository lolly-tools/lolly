# Determinism

Determinism in Lolly means the same inputs, put through the same tool, produce the same render on every shell - in the browser, on the desktop, in the terminal and through the MCP endpoint - and, for the formats that carry no clock, the same bytes.

That is the precise version of the landing page's "[identical where you want it](/info/index.html)". This page shows where the property comes from, exactly how far it extends into the bytes and the handful of things that legitimately break it.

## One render path, two transports

There is a single renderer. `createRuntime(tool, host, initialState)` in `engine/src/runtime.ts` orchestrates one mounted tool through the same lifecycle everywhere: load, build the input model, resolve asset references, run the hooks, hydrate the template, export. Shells supply a capability bridge; they do not supply a renderer.

The command line is the same path under a different transport. `engine/src/url-mode.ts` says it at the top of the file: the CLI uses the same conversion, so `--url=https://suse.com` on the terminal and `?url=https://suse.com` in the address bar become the same value in the same input model. There is no second parser to drift and no CLI-only code path to fall behind.

```
# the same render, two ways in
lolly qr-code --url=https://suse.com --export=svg --output=./qr.svg
https://lolly.tools/#/tool/qr-code?url=https://suse.com&format=svg&export
```

Because tools sync to clients as data, ahead of the binary that runs them, the pairing is checked rather than hoped for. Every manifest declares an `engineVersion` range, and `loadTool` refuses a tool whose range excludes the running engine before it even fetches the template. A tool never half-loads against an engine that lacks the capability it was written for.

The same property holds inside one shell over time. Hook results are time-boxed rather than awaited indefinitely (`HOOK_BUDGET_MS` in `engine/src/runtime.ts`), and a late async result is discarded rather than allowed to patch inputs after the fact - so a slow network or a slow machine changes how long a render takes, never what it contains.

## Semantic determinism, and what a seed gives you instead

A generative model with a fixed seed replays an accident. The seed reproduces one image, and only on one model at one version, on one stack, with the same sampler - and if you want the same picture with a different headline, there is nothing to change but the prompt, which changes everything else too.

A template embodies a decision. The layout, the type ramp, the safe area and the brand colours are fixed by the tool; the inputs are the axes the author chose to leave free. Feeding it new values yields a parameterized family of outputs, every member of which was decided once. That is the property automation actually needs: not "I can get this frame back", but "I can get five hundred frames, each correct, none of them a surprise".

This is why the [MCP endpoint](/info/mcp.html) exposes renders from parameters rather than image generation. An agent choosing input values inside a tool's declared bounds cannot produce an off-brand file, and the same call next month returns the same thing.

## The same render, byte for byte: how far it goes

Reproducible renders and reproducible bytes are separate promises, and only some formats keep the second one. The measured table lives in [the CLI guide](/info/cli.html) and this page does not restate it loosely - the summary that matters here is its first line.

**A default render is deliberately not byte-reproducible.** Content Credentials and the Lolly Imprint are on by default, in the app and in the CLI alike, and a credential is signed with a fresh key and a fresh timestamp on every run. `--no-provenance` is the switch that turns a run bare, and the machine paths (`smoke`, `batch`) apply it themselves because a machine path wants reproducibility by default.

With `--no-provenance`, measured back to back on one machine:

- **Byte-identical:** SVG, EMF, EPS and DXF; the data formats JSON, CSV, VCF and MD; PNG rendered through the resvg tier from an `<svg>`-based tool.
- **Not byte-identical:** ICS (RFC 5545 requires a `DTSTAMP`, which is the clock), PDF (every PDF carries `/CreationDate` and `/ModDate`), and the headless-Chromium tier - JPG, WebP and HTML-layout PNG, where the browser's paint and encode move between runs. Video is the same tier plus a frame-timed capture: assume no.

Two caveats travel with that list. Format-level reproducibility is not tool-level reproducibility - a tool that renders the current time produces different bytes in every format, correctly. And the measurements are one machine back to back: a different OS, a different font set or a different engine version moves the bytes of anything that shapes text.

## The receipts

| Claim | Enforced by |
|---|---|
| The engine contract itself: URL round-trips, the reserved-param set, input model behaviour, template hydration | `tests/engine.test.ts` |
| CLI and URL mode resolve the same values, including asset sub-fields inside repeating blocks | `tests/engine.test.ts` - `runtime: resolves asset sub-fields inside blocks (CLI/URL parity)` |
| The vector and data emitters produce exact, pinned bytes on every clone - no browser, no brand pack, no network | `tests/export-emitter-golden.test.ts` (every input pinned, no now-defaults, no randomness) |
| The real CLI mechanism, end to end into svg, emf, eps, eps-cmyk, dxf and csv | `tests/cli-export-golden.test.ts`, with the bytes pinned in `tests/fixtures/cli-export.golden.json` |
| Collaborative convergence never reads the wall clock or unseeded randomness, so two devices order edits identically | `tests/canvas-op-no-wallclock.test.ts` (a byte-level static guard over the merge path) |
| A tool is refused rather than half-loaded when the running engine is outside its declared range | `tests/loader-engine-version.test.ts` |
| The web export bridge does not silently change what it draws | `scripts/characterize-export.ts` |

`scripts/characterize-export.ts` deserves its own note, because its honesty is the point. It drives the built web shell's real export path, renders every tool-and-format pair twice and classifies the result automatically: identical twice means it is hashed, differing or container-shaped means it is held to a size band instead. Nondeterminism is discovered rather than assumed. It is also explicitly a same-session local net rather than a committed CI golden, because raster bytes depend on the local Chromium build and the OS font stack, so its hashes are not stable across machines.

## Check it yourself

```bash
lolly qr-code --url=https://suse.com --export=svg --no-provenance --output=a.svg
lolly qr-code --url=https://suse.com --export=svg --no-provenance --output=b.svg
shasum -a 256 a.svg b.svg     # identical

lolly qr-code --url=https://suse.com --export=svg --output=c.svg
lolly qr-code --url=https://suse.com --export=svg --output=d.svg
shasum -a 256 c.svg d.svg     # different: each carries its own fresh credential
```

The second pair differs because every default export is signed afresh, with its own key and timestamp. Drop the provenance and the two runs converge on the same bytes.

## What it buys you in a pipeline

Determinism is only useful if a machine can act on it, so the terminal surface is built to be branched on rather than parsed. Every command returns one code per outcome, frozen at general availability: `0` produced it, `1` ran and failed, `2` wrong invocation, `3` impossible in this installation (worth retrying on another runner), `4` a protective check refused, `5` a legitimate negative answer, `6` wrong password, `70` an internal bug. `--json` puts one document on stdout and moves every human line to stderr. The full table is in [the CLI guide](/info/cli.html).

Combined with the byte table above, that gives a build step three honest options: render a vector format bare and compare hashes, render a raster format and compare it visually, or verify the credential and compare provenance. What it never requires is trusting that a hosted service returned the same thing it returned last week.

## Limits

- **Time-of-render inputs.** A countdown, a date stamp or a calendar file reads the clock because that is its job. ICS is the clearest case: RFC 5545 requires a `DTSTAMP`, so two runs a second apart differ in exactly that line.
- **Live-data lookups.** One shipping tool crosses the network for a value. The Meeting Planner (in the SUSE brand pack) asks `geocoding-api.open-meteo.com` to turn a city name into coordinates and a time zone. It is disclosed on the input itself - the `notice` field in its `tool.json` - it sends only the name, and the answer is cached on the device by the `geocode()` function in that tool's `template.html`, keyed per city. So the first render of a new city depends on an outside service; every later render of that city is offline and identical. The [privacy policy's network table](/info/privacy.html) lists this crossing with every other one.
- **Fonts.** Vector export converts text runs to real outlines, so the bytes depend on which font file was resolved. `shells/web/src/bridge/font-registry.ts` pins that by returning an ordered chain - brand catalog faces first, then your own uploaded fonts, then the shell-served platform faces - rather than trusting whatever the operating system happens to have. The CLI resolves sfnt faces under the repo root and refuses a browser-only woff2 with a clear error rather than shaping blanks. A run on a machine with a different font set is a different render, and that is the failure mode the chain exists to make visible.
- **Provenance marks are on by default.** A credential carries a fresh signature and timestamp, and the Imprint moves pixels. Both are wanted; both make a default export differ run to run. `--no-provenance` (or `c2pa=off&imprint=0` in a URL) is the deliberate opt-out.
- **The characterization harness is local.** It proves that a refactor did not change what a build draws on your machine. It is not a cross-machine byte guarantee, and nothing in the repo claims one for the browser-tier formats.

Practical consequence, stated plainly: commit the hash of an SVG rendered with `--no-provenance` if you want a lockfile entry, and compare a PDF, an ICS, a JPEG or anything signed by rendering and inspecting rather than by digest.

## Related

- [Constraints](/info/constraints.html) - why the inputs a render depends on are a closed, declared set.
- [Reproducibility](/info/reproducibility.html) - those inputs travelling in a link, so you still have them next year.
- [Sovereign creative production](/info/sovereign-production.html) - running the whole path on hardware you control.
- [CLI](/info/cli.html) - the measured byte-reproducibility table and the flags behind it.
