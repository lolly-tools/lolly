# Reproducibility

Reproducibility in Lolly means the inputs to a render are portable and durable: the entire state of a design lives in its URL, so the link is the artifact and the picture is a thing the link makes. Open it next year, on another device, and it renders again.

This is the neighbour of [determinism](/info/determinism.html) and a different claim. Determinism says the same inputs give the same file. Reproducibility says you still have the inputs - they are a short piece of text you can paste in a ticket, commit to a repository or bookmark, rather than a document trapped in an account.

It is what the landing page means by "[same inputs, same file, every time](/info/index.html)" being worth anything at all a year later.

## Every input is expressible as a URL param

`engine/src/url-mode.ts` owns the round-trip in both directions: `parseUrlState` turns a query string into input values, `serializeUrlState` turns the current state back into a query string. Being expressible as a URL param is a hard requirement on every input type rather than a convenience some tools happen to implement, which is also why the CLI works: it is that same conversion under a different transport.

The names that mean something without being inputs are a closed set, `RESERVED` at `engine/src/url-mode.ts:327`: `format`, `export`, `copy`, `full`, `options`, `slot`, `output`, `filename`, `_v`, `width`/`w`, `height`/`h`, `unit`, `dpi`, `bleed`, `marks`, `cuts`, `c2pa`, `imprint`, `durable`, `hdr`, `depth`, `password`, `profile`, `lang`, `z`, `zx` and a handful more. Everything else in a link is the design.

Tools can opt into compact encoding - `urlKey` aliases, `#`-less colours, tilde-delimited block arrays - so a long design stays a manageable link. Where that is still not enough, `engine/src/url-pack.ts` packs the whole query into one token, and `packEncrypted` does the same under a password that is never in the link.

## Physical intent travels too

A link carries what the render is meant to be, not just what it looked like on the screen that made it. `width` and `height` are values in `unit` (`px`, `mm`, `cm`, `in` or `pt`), `dpi` sets raster resolution for physical units, and `bleed`, `marks` and `profile` carry the print intent. The conversion is the engine's single source of truth in `engine/src/units.ts`, applied per format at export time - PDF to real points, SVG to unit plus a pixel viewBox, raster to pixels at the requested DPI with a `pHYs` chunk.

So `?unit=mm&width=210&height=297&dpi=300&bleed=3mm&marks=crop,reg` is a reproducible A4 print job, not a screenshot someone hopes is big enough.

## Brand references stay references

A colour input can hold a token reference rather than a baked hex value, and the reference is what travels. `tests/tokens-value-path.test.ts` pins exactly that: a token-backed colour survives serialization into a shared link and comes back as a reference, while the template only ever sees the resolved string.

The consequence is the useful one. A link made against `color.brand.primary` re-renders under whatever that token means when it is opened, so a rebrand updates old links instead of breaking them. A link made with a literal colour keeps that colour. You choose which one you wanted at the moment you picked the value.

## A tool-sourced image is a recipe

Paste a Lolly link into an asset picker and the picture it makes becomes an input to another tool. `engine/src/tool-url.ts` recognises every shape the app can hand you - the embed form, the hash share route and the pretty path - and `buildEmbedUrl` canonicalises it into one strict embed URL that becomes the asset's persistent identity.

That identity round-trips through URL mode and saved sessions, and the runtime re-renders it through `host.compose.renderUrl` on every load rather than storing a bitmap. A nested chart inside a poster stays live: change the chart's link and the poster changes with it.

## Sessions, projects and templates carry the same state

The same state serialization backs the app's own storage. A saved session holds the values; **Share link** on any session in Projects produces the URL form of it; a `.lolly` bundle carries one for handing to a colleague, and an operator who wants a starting point to be permanent records those values as a `templates[]` entry on the tool's manifest in the brand pack, deep-linkable as `?template=<id>` ([Deployment](/info/deployment.html)). Each is the same inputs in a different envelope.

## What has to survive for a link to render in ten years

Worth being concrete about the dependency list, because it is short and every item is something you can hold:

1. **The link.** Plain text. Paste it in a ticket, a spreadsheet cell, a commit message or a `README`.
2. **The tool.** A directory: `tool.json`, `template.html`, optional `styles.css`, optional `hooks.js`. Data, not a binary. Keep it in version control if the render matters.
3. **An engine that satisfies the tool's `engineVersion` range.** The manifest declares it and the loader enforces it, so an incompatible pairing is refused rather than rendered wrongly.
4. **The assets the link names.** Catalog assets have permanent ids by design - `suse/logo/primary` is never renamed or reused - so a reference stays valid as long as the pack does.

Nothing on that list is an account, a subscription or a running service. Every item is a file you can copy and keep.

## Check it yourself

```
# a link and the CLI carry the same state; both write the same SVG
lolly qr-code --url=https://suse.com --export=svg --no-provenance --output=./a.svg

# the same inputs, expressed as a URL
https://lolly.tools/#/tool/qr-code?url=https://suse.com&format=svg&export
```

Then change one input in the app, copy the link out of the Share dialog and read it. Every value you set is visible in it, which is the whole claim in one glance.

## Prove it yourself

Reading a link is one kind of proof. Rebuilding the file is the other. Give the CLI a finished artifact and the `.lolly` of the session that made it, and it renders the session again on your machine and compares:

```
lolly validate ./poster.svg --rebuild ./poster.lolly
```

`IDENTICAL` (exit 0) means the session you kept still produces those exact bytes. `DIFFERENT` (exit 1) names every reason it could check, and only the ones it could check:

| Reason | What it means |
|---|---|
| `engine-version` | The artifact's credential names an engine version, and this machine runs a different one. |
| `tool-version` | The tool version recorded in the artifact, in the `.lolly` and in this catalog do not all agree. |
| `font` | A face the `.lolly` names is missing here, or resolves to a file with a different sha256. The `.lolly` records each face the render used as family, weight, style and the digest of the whole source font file. No font bytes travel in the file, so this is a name check against your own copy. |
| `content` | The bytes differ and none of the above explains it, reported with the offset where they first diverge. |

The scope is narrow on purpose. Only `svg`, `emf`, `eps`, `dxf` and `csv` can be compared, because those are the formats whose output comes from the engine's own emitters and is byte-stable across a double render. Asking to rebuild a `png`, `jpg`, `webp` or `pdf` is refused with exit 2 rather than answered: raster and PDF output is laid out and rasterised by a browser engine whose version is part of the result, which is a [determinism](/info/determinism.html) question with a format-by-format answer. Content Credentials are switched off for the rebuild and stripped from the delivered SVG before comparing, since a credential is signed with a fresh key at a fresh timestamp and can never be byte-equal to itself.

One more honest limit: the rebuild renders through the CLI. A file exported from the browser was serialised by the web shell, whose SVG writer is not byte-identical to the terminal's, so comparing one of those reports `content`. Compare a CLI export with the CLI, and use the reason list on a web export to see whether the engine, the tool or a font moved under it.

## The receipts

| Claim | Enforced by |
|---|---|
| A query string round-trips through parse and serialize without loss | `tests/engine.test.ts` - `url-mode: round-trips` |
| The reserved-param set is exactly the documented one, so an input name can never silently collide with an output setting | `tests/engine.test.ts` - `url-mode: RESERVED set matches the documented reserved-param list` |
| An unknown param is ignored rather than misread, so an old link survives a newer tool | `tests/engine.test.ts` - `url-mode: ignores unknown params (forward-compat)` |
| Packing is lossless for any query string, including the compact block encoding | `tests/url-pack.test.ts` - `decode(encode(x)) === x` |
| A pasted tool link canonicalises to a stable identity that re-parses | `tests/tool-url.test.ts` |
| A tool-sourced asset is re-rendered on every load rather than cached as pixels | `tests/tool-url-asset.test.ts` |
| A token reference survives a shared link and resolves before the template | `tests/tokens-value-path.test.ts` |
| Compact block encoding round-trips a value containing its own delimiter | `tests/engine.test.ts` - `url-mode: a block value containing a ~ round-trips losslessly via the JSON form` |
| An artifact and its session rebuild to the same bytes, and a changed input reports why | `tests/reproducibility-rebuild.test.ts` |
| A raster or PDF rebuild is refused rather than answered with a coin flip | `tests/reproducibility-rebuild.test.ts` - `a raster or PDF artifact is refused, not guessed at` |
| A `.lolly` whose parts do not match its integrity map is refused before anything is believed | `tests/reproducibility-rebuild.test.ts` - `the node reader refuses a .lolly whose parts do not match its integrity map` |

## Limits

- **Reproducibility is of the declared render.** `format`, `unit`, `dpi`, `bleed`, `marks`, `profile` and `depth` are parameters like any other. A link reproduces the render it declares. Ask the same link for a different format and you have asked for a different render, and whether that one comes back byte-identical is a [determinism](/info/determinism.html) question with a format-by-format answer.
- **Files you uploaded do not travel in a bare link.** Images from your device exist on your device, and a shared URL does not contain them - [Using Lolly](/info/using.html) says so at the Share dialog, which is where you meet the limit. When the bytes have to move, the file is the vehicle: the backup archive carries your profile, every saved session, your uploaded images and your preferences as one zip ([Data Transfer](/info/data-transfer.html) is its format spec), and a `.lolly` file hands a single saved starting point to a colleague. A link whose asset is missing reports the dropped reference rather than rendering something wrong.
- **A link renders against the tool the deployment holds.** The Share dialog can stamp `_v`, the tool version the link was made against, and `_v` is reserved for exactly that. What guarantees the old version is still there is the tool being data: a manifest, a template and optional hooks in a directory you can keep in version control and serve yourself. If a render has to survive a decade, keep the tool alongside the link.
- **A password-protected link is only as durable as the password.** `packEncrypted` keeps the password out of the URL by design, which means nothing can recover the state without it.
- **A link is a snapshot.** Two people opening the same link get the same starting point and then diverge. Editing the same session at the same time is a different feature, described in [Working together](/info/collaborate.html).

## Related

- [Constraints](/info/constraints.html) - why what a link can say is a closed, declared vocabulary.
- [Determinism](/info/determinism.html) - what happens when the same inputs are rendered twice.
- [Sovereign creative production](/info/sovereign-production.html) - holding the tools, the brand and the links yourself.
- [URL Mode](/info/url-mode.html) - the full encoding reference, param by param.
