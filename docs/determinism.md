# Determinism

Can you hash a Lolly file in CI and trust the hash next week? For the right formats, yes. The same inputs, put through the same tool, produce the same render on every shell: the browser, the desktop, the terminal and the MCP endpoint. For the formats that carry no clock, rendered without provenance, they produce the same bytes too. This page shows where that comes from, how far it reaches into the bytes and what legitimately breaks the promise.

## One render path, two transports

There is a single renderer. `createRuntime(tool, host, initialState)` in `engine/src/runtime.ts` runs one mounted tool through the same steps everywhere: load, build the input model, resolve asset references, run the hooks, fill the template and export. Shells supply a capability bridge, not a renderer.

The command line is the same path under a different transport. The CLI uses the conversion in `engine/src/url-mode.ts`, so `--url=https://example.com` in a terminal and `?url=https://example.com` in the address bar become the same value in the same input model. There is no second parser to drift and no CLI-only path to fall behind.

![URL parameters and CLI arguments become the same typed input model, pass through the shared runtime, then reach the shell's export bridge for the chosen format.](/info/diagrams/concepts/one-render-path.svg)

```
# the same render, two ways in
lolly qr-code --url=https://example.com --export=svg --output=./qr.svg
https://lolly.tools/t/qr-code?url=https://example.com&format=svg&export
```

Tools sync to clients as data, ahead of the app that runs them, so the pairing is checked rather than hoped for. Every manifest declares an `engineVersion` range, and `loadTool` refuses a tool whose range excludes the running engine before it fetches the template. A tool never half-loads against an engine that lacks what it was written for.

Inside one shell, slow work settles on the same result. Hook results are time-boxed rather than awaited forever (`HOOK_BUDGET_MS` in `engine/src/runtime.ts`). A slow `onInit` or `onInput` result still applies when it arrives, unless a newer run has started since, in which case it is dropped. So the final state follows the latest inputs, and a slow network or machine changes how long a render takes to settle, not what it settles on. An export taken before a slow hook has settled can differ, and an export hook that overruns its budget fails that export instead of applying late. [Hooks](/info/tool-hooks.html) gives the budgets.

## Semantic determinism, and what a seed gives you instead

::: cols
## A seed

A generative model with a fixed seed replays an accident. It reproduces one image, on one model at one version, on one stack, with one sampler. To get the same picture with a different headline, the only thing to change is the prompt, which changes everything else too.

## A template

A template carries a decision. The layout, the type ramp, the safe area and the brand colours are fixed by the tool, and the inputs are the parts the author chose to leave free. New values give a family of outputs, every one of them decided once.
:::

That second property is the one automation needs: not "I can get this frame back" but "I can get five hundred frames, each correct, none of them a surprise". It is why the [MCP endpoint](/info/mcp.html) offers renders from parameters rather than image generation. An agent choosing input values inside a tool's declared bounds cannot produce an off-brand file, and the same call next month draws the same design.

## How far byte-identical renders go

Reproducible renders and reproducible bytes are separate promises, and only some formats keep the second.

**A default render is not byte-reproducible.** Content Credentials and the Lolly Imprint are on by default, in the app and the CLI alike, and each credential is signed with a fresh key and a fresh timestamp. `--no-provenance` (or `c2pa=off&imprint=0` in a link) turns a run bare, and the machine paths `smoke` and `batch` do that themselves, because a machine path wants reproducibility by default.

Rendered bare, the vector formats (SVG, EMF, EPS, DXF), the data formats (JSON, CSV, VCF, MD) and PNG from an `<svg>`-based tool come out byte-identical run to run. ICS, PDF and everything the headless browser draws do not, because they carry a clock or the browser's own encode. [CLI batch and automation](/info/cli-automation.html#how-far-byte-identical-output-goes) holds the measured table, format by format, with the commands used.

Two caveats travel with the table. A tool that renders the current time produces different bytes in every format, correctly. And the measurements are one machine, back to back: a different OS, font set or engine version moves the bytes of anything that shapes text.

## Check the claim yourself

```bash
lolly qr-code --url=https://example.com --export=svg --no-provenance --output=a.svg
lolly qr-code --url=https://example.com --export=svg --no-provenance --output=b.svg
shasum -a 256 a.svg b.svg     # identical

lolly qr-code --url=https://example.com --export=svg --output=c.svg
lolly qr-code --url=https://example.com --export=svg --output=d.svg
shasum -a 256 c.svg d.svg     # different: each carries its own fresh credential
```

## What it buys you in a pipeline

A machine can act on determinism only if it can branch on the result. Every CLI command returns one exit code per outcome, frozen at general availability, and `--json` puts one document on stdout and moves every human line to stderr ([Exit codes](/info/cli-automation.html#exit-codes)).

That gives a build step three options: render a vector format bare and compare hashes; render a raster format and compare it visually; or verify the credential and compare provenance. None of them asks you to trust that a hosted service returned the same thing it returned last week. In practice: commit the hash of an SVG rendered with `--no-provenance` if you want a lockfile entry, and compare a PDF, an ICS, a JPEG or anything signed by rendering and inspecting rather than by digest.

## The receipts

| Claim | Enforced by |
|---|---|
| The engine contract itself: URL round trips, the reserved-param set, input model behaviour, template hydration | `tests/engine.test.ts` |
| CLI and URL mode resolve the same values, including asset sub-fields inside repeating blocks | `tests/engine.test.ts` - `runtime: resolves asset sub-fields inside blocks (CLI/URL parity)` |
| The vector and data emitters produce exact, pinned bytes on every clone, with no browser, brand pack or network | `tests/export-emitter-golden.test.ts` (every input pinned, no defaults read from the clock, no randomness) |
| The real CLI path, end to end into svg, emf, eps, eps-cmyk, dxf and csv | `tests/cli-export-golden.test.ts`, with the bytes pinned in `tests/fixtures/cli-export.golden.json` |
| Collaborative convergence never reads the wall clock or unseeded randomness, so two devices order edits identically | `tests/canvas-op-no-wallclock.test.ts` (a byte-level static guard over the merge path) |
| A tool is refused rather than half-loaded when the running engine is outside its declared range | `tests/loader-engine-version.test.ts` |
| The web export bridge does not silently change what it draws | `scripts/characterize-export.ts` |

`scripts/characterize-export.ts` works differently from the tests. It drives the built web app's real export path, renders every tool-and-format pair twice and sorts the results: identical twice means the pair is hashed, while differing or container-shaped output is held to a size band instead. Nondeterminism is found rather than assumed. It is a local check in one session, not a committed CI golden, because raster bytes depend on the local Chromium build and the operating system's fonts, so its hashes do not hold across machines.

## Limits

- **Time-of-render inputs.** A countdown, a date stamp or a calendar file reads the clock because that is its job. ICS is the clearest case: RFC 5545 requires a `DTSTAMP`, so two runs a second apart differ in exactly that line.
- **Live-data lookups.** One shipping tool crosses the network for a value. The Meeting Planner asks `geocoding-api.open-meteo.com` to turn a city name into coordinates and a time zone. The input itself discloses this (the `notice` field in its `tool.json`) and sends only the name. The `geocode()` function in the tool's `template.html` caches the answer on the device for each city. So the first render of a new city depends on an outside service, and every later render of that city is offline and identical. The [privacy policy's network table](/info/privacy.html) lists this crossing with every other one.
- **Fonts.** Vector export turns text into real outlines, so the bytes depend on which font file was resolved. `shells/web/src/bridge/font-registry.ts` pins that with an ordered chain: brand catalog faces first, then your own uploaded fonts, then the faces the app serves, rather than whatever the operating system has. The CLI resolves sfnt faces under the repository root and refuses a browser-only woff2 with a clear error rather than shaping blanks. A machine with a different font set makes a different render, and the chain exists to make that failure visible.
- **Provenance marks are on by default.** A credential carries a fresh signature and timestamp, and the Imprint moves pixels. Both are wanted, and both make a default export differ from run to run.
- **The characterisation check is local.** It proves that a refactor did not change what a build draws on your machine. It is not a cross-machine byte guarantee, and nothing in the repository claims one for the browser-tier formats.

## Related

- [Constraints](/info/constraints.html): why the inputs a render depends on are a closed, declared set.
- [Reproducibility](/info/reproducibility.html): those inputs travelling in a link, so you still have them next year.
- [Sovereign creative production](/info/sovereign-production.html): running the whole path on hardware you control.
- [CLI batch and automation](/info/cli-automation.html#how-far-byte-identical-output-goes): the measured byte table and the `--no-provenance` flag.
