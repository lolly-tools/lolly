# Reproducibility

Is a Lolly link a record you can keep? It is. The whole state of a design lives in its link, so the link is the artifact and the picture is something the link makes. Open it next year, on another device, and it renders again. And when you need proof rather than trust, the CLI rebuilds a file from the session that made it and compares the bytes.

This is the neighbour of [determinism](/info/determinism.html), and a different claim. Determinism says the same inputs give the same file. Reproducibility says you still have the inputs: a short piece of text you can paste in a ticket, commit to a repository or bookmark, rather than a document held in someone's account.

## What a link carries

**Every input.** `engine/src/url-mode.ts` owns the round trip both ways: `parseUrlState` turns a query string into input values, and `serializeUrlState` turns the current state back into a query. Every input type except `file`, whose bytes stay on the device, must be expressible as a URL parameter. That is a hard rule, not a convenience some tools happen to follow, and it is also why the CLI works: the same conversion under a different transport. A long design packs into one `z` token, or a password-locked `zx` one ([Long and private links](/info/url-mode.html#long-and-private-links)).

**The render it means.** A link carries what the file is meant to be, not only what it looked like on one screen. `?unit=mm&width=210&height=297&dpi=300&bleed=3mm&marks=crop,reg` is a reproducible A4 print job, not a screenshot someone hopes is big enough ([Set the size](/info/url-export.html#set-the-size)).

**References, not snapshots.** A colour input can hold a token reference rather than a fixed hex, and the reference is what travels. A link made against `color.semantic.primary` renders with whatever that token means when it is opened, so a rebrand updates old links instead of breaking them. A link made with a literal colour keeps that colour; you choose which when you pick the value. `tests/tokens-value-path.test.ts` pins this: a token-backed colour survives a shared link and comes back as a reference, while the template only ever sees the resolved string.

**Theme choices.** A link carries the theme and colourway choices it was made with (`_themes`), so it redraws in the same colourway. A design-system version can be pinned for testing with `designv`, but a generated share link never carries one.

**Other tools' renders.** Paste a Lolly link into an asset picker and the picture it makes becomes an input to another tool. `engine/src/tool-url.ts` recognises every shape the app can hand you, and `buildEmbedUrl` turns it into one strict embed URL that becomes the asset's lasting identity. That identity round-trips through links and saved sessions, and the runtime renders it again through `host.compose.renderUrl` on every load rather than storing a bitmap. A chart inside a poster stays live: change the chart's link and the poster changes too.

**The same state everywhere.** A saved session holds the values; **Share link** on any session in Projects gives its URL form; a `.lolly` file carries one for a colleague. An operator who wants a starting point to be permanent records the values as a `templates[]` entry on the tool's manifest in the brand pack, opened with `?template=<id>` ([Deployment](/info/deployment.html)). Each is the same inputs in a different envelope.

## What has to survive for a link to render in ten years

The list is short, and every item is something you can hold.

![A link, a tool directory, an engine within the tool's range and the assets it points at are all a render needs. No account and no running service is on the list.](/info/diagrams/concepts/link-render-needs.svg)

1. **The link.** Plain text. Paste it in a ticket, a spreadsheet cell, a commit message or a `README`.
2. **The tool.** A directory: `tool.json`, `template.html`, optional `styles.css` and optional `hooks.js`. Data, not a binary. Keep it in version control if the render matters.
3. **An engine that satisfies the tool's `engineVersion` range.** The manifest declares the range and the loader enforces it, so an incompatible pairing is refused rather than rendered wrongly.
4. **The assets the link points at.** Catalog assets have permanent ids: `lolly/logo/primary` is never renamed or reused, so a reference stays valid as long as the pack does.

Nothing on the list is an account, a subscription or a running service.

## Prove it yourself

Reading a link is one kind of proof: change one input, copy the link from the Share dialog and every value you set is there to read. Rebuilding the file is the other kind. Give the CLI a finished file and the `.lolly` of the session that made it, and it renders the session again on your machine and compares:

```
lolly validate ./poster.svg --rebuild ./poster.lolly
```

`IDENTICAL` (exit 0) means the session you kept still produces those exact bytes. `DIFFERENT` (exit 1) lists every reason it could check, and only the ones it could check:

| Reason | What it means |
|---|---|
| `engine-version` | The file's credential records an engine version, and this machine runs a different one. |
| `tool-version` | The tool version recorded in the file, in the `.lolly` and in this catalog do not all agree. |
| `font` | A face the `.lolly` lists is missing here, or resolves to a file with a different sha256. The `.lolly` records each face the render used as family, weight, style and the digest of the whole source font file. No font bytes travel in the file, so this is a name check against your own copy. |
| `design-system` | The file records a design system, version or colourway, and the rebuild drew with a different one. |
| `content` | The bytes differ and none of the above explains why, reported with the offset where they first diverge. |

The scope is narrow on purpose. Only `svg`, `emf`, `eps`, `dxf` and `csv` can be compared, because their output comes from the engine's own emitters and is byte-stable across a double render. Asking to rebuild a `png`, `jpg`, `webp` or `pdf` is refused with exit 2: raster and PDF output is laid out and rasterised by a browser engine whose version is part of the result, which is a [determinism](/info/determinism.html) question with a format-by-format answer.

Content Credentials are switched off for the rebuild and stripped from the delivered SVG before comparing, since a credential is signed with a fresh key at a fresh timestamp and can never equal itself. The rebuild draws in the published version and the colourway that the file's [design-system record](/info/exporting.html#the-design-system-record) gives, wherever the session itself is silent. An SVG with no record was exported with the record off, so its rebuild leaves the record out as well.

One more limit: the rebuild renders through the CLI. A file exported from the browser was written by the web app, whose SVG writer is not byte-identical to the terminal's, so comparing one reports `content`. Compare a CLI export with the CLI, and use the reason list on a web export to see whether the engine, the tool or a font has changed since.

### What a .lolly says it carries

Before any rebuild, a `.lolly` says what it carries. Each file holds `portability.json`, with one row for every dependency the design needs: the tool, each asset, each font face, the design system, the templates and any link. Every row has one of five statuses:

| Status | What it means |
|---|---|
| `embedded` | The bytes are in the file, with the sha256 digest the file's integrity map vouches for. A carried tool records one digest over its whole file list. |
| `available` | Not in the file, and a reader is expected to have it already: a tool the signed catalog lists, a catalog asset sent by its id, a catalog font recorded by its digest, a face that ships with Lolly. |
| `linked` | Not in the file on purpose. The design fetches it from a web address, renders it again from a Lolly tool link, or reads it from an organisation server each time it opens. |
| `withheld` | The sender had the bytes and a rule kept them out: a brand lock, a licence condition, or no licence recorded. `CREDITS.txt` gives the same reason. |
| `missing` | The design needs it and nothing supplies it: an upload no longer on the sending device, catalog bytes the sender's catalog could not supply, a custom tool left out of the file, a temporary address. |

The manifest repeats the five totals, and `lolly.txt` prints them in plain text. The same report drives an offline check: open the file on an empty profile with networking off, and each dependency comes back `ready`, `needs-network`, `held-back`, `unavailable` or `damaged` (the report says a dependency is carried and the bytes disagree). The check reads the file and asks the receiving device what it already has. It never fetches anything.

::: details When a catalog asset counts as available or missing
A catalog asset is `available` when the file was made without asking a catalog for bytes, as the Projects view's batch download and `scripts/pack-project.ts` do: the asset travels by its id on purpose. It is `missing` only when the sender's catalog was asked and could not supply the bytes. A file written before the report existed does not record which happened, so a reader treats the catalog as asked when the file carries or holds back at least one catalog asset.
:::

::: details How the report keeps credentials out
A web address keeps its scheme, host and path and loses its user name, password, query and fragment, which is where signed addresses and most tokens live. Any other address, such as a `mailto:` link or a host and path with no scheme, loses its query and fragment too. A path segment shaped like a key (long and opaque, a three-part token, or letters with digits scattered through them) is replaced with `{redacted}`. Asset ids pass unchanged, because a reader finds an asset by its id.

The rule looks only at the characters of each segment, so a short key written into a path can remain: treat the report as a list of where each dependency comes from, not as a scrubbed copy of every address. The design's own values still hold the full address, because the design needs the address to draw.
:::

## The receipts

| Claim | Enforced by |
|---|---|
| A query string round-trips through parse and serialize without loss | `tests/engine.test.ts` - `url-mode: round-trips` |
| The reserved-param set is exactly the documented one, so an input name can never silently collide with an output setting | `tests/engine.test.ts` - `url-mode: RESERVED set matches the documented reserved-param list` |
| An unknown param is ignored rather than misread, so an old link works with a newer tool | `tests/engine.test.ts` - `url-mode: ignores unknown params (forward-compat)` |
| Packing is lossless for any query string, including the compact block encoding | `tests/url-pack.test.ts` - `decode(encode(x)) === x` |
| A pasted tool link becomes a stable identity that parses again | `tests/tool-url.test.ts` |
| A tool-sourced asset is rendered again on every load rather than cached as pixels | `tests/tool-url-asset.test.ts` |
| A token reference survives a shared link and resolves before the template | `tests/tokens-value-path.test.ts` |
| Compact block encoding round-trips a value containing its own delimiter | `tests/engine.test.ts` - `url-mode: a block value containing a ~ round-trips losslessly via the JSON form` |
| A file and its session rebuild to the same bytes, and a changed input reports why | `tests/reproducibility-rebuild.test.ts` |
| A raster or PDF rebuild is refused rather than answered with a coin flip | `tests/reproducibility-rebuild.test.ts` - `a raster or PDF artifact is refused, not guessed at` |
| A `.lolly` whose parts do not match its integrity map is refused before anything is believed | `tests/reproducibility-rebuild.test.ts` - `the node reader refuses a .lolly whose parts do not match its integrity map` |
| A `.lolly` lists every dependency with its status and checksum, and the credentials in its test document stay out | `shells/web/src/lib/lolly-portability.test.ts` - `a .lolly carries a per-dependency report under the integrity map, with checksums` |
| An address loses its query, fragment and key-shaped segments, and an asset id passes unchanged | `shells/web/src/lib/lolly-portability.test.ts` - `portableLink keeps scheme, host and path, and drops what carries a credential` |
| A catalog asset sent by id reads available, and one the sender's catalog could not supply reads missing | `shells/web/src/lib/lolly-portability.test.ts` - `a catalog asset sent by id is available, and one the catalog could not supply is missing` |
| An empty profile with networking off opens what the file carries, reports the rest and makes no network request | `shells/web/src/lib/lolly-portability.test.ts` - `an empty profile with networking off opens what the file carries and reports the rest` |

## Limits

- **A link reproduces the render it declares.** `format`, `unit`, `dpi`, `bleed`, `marks`, `profile` and `depth` are parameters like any other. Ask the same link for a different format and you have asked for a different render; whether that one comes back byte-identical is a [determinism](/info/determinism.html) question.
- **Files you uploaded do not travel in a bare link.** Images from your device stay on your device ([What a link carries](/info/url-app-links.html#what-a-link-carries)). When the bytes have to move, a file is the vehicle: a `.lolly` hands one design to a colleague, and the backup archive carries your profile, saved sessions, uploaded images and preferences as one zip ([Data Transfer](/info/data-transfer.html)). A link whose asset is missing reports the dropped reference rather than rendering something wrong.
- **A link renders against the tool the deployment holds.** The Share dialog can stamp `_v`, the tool version the link was made against. What keeps the old version available is the tool being data: a manifest, a template and optional hooks in a directory you can keep in version control and serve yourself. If a render has to last a decade, keep the tool beside the link.
- **A password-protected link is only as durable as the password.** `packEncrypted` keeps the password out of the URL, so nothing can recover the state without the password.
- **A link is a snapshot.** Two people opening the same link get the same starting point and then diverge. Editing the same session at the same time is a different feature, described in [Working together](/info/collaborate.html).

## Related

- [Constraints](/info/constraints.html): why what a link can say is a closed, declared vocabulary.
- [Determinism](/info/determinism.html): what happens when the same inputs are rendered twice.
- [Sovereign creative production](/info/sovereign-production.html): holding the tools, the brand and the links yourself.
- [URL Mode](/info/url-mode.html): how links are built, and the guides to every part of one.
