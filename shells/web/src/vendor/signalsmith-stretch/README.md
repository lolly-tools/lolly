# Vendored Signalsmith Stretch (WebAssembly)

`SignalsmithStretch.mjs` is the official npm build of **signalsmith-stretch 1.3.2**
(MIT, published by the library's own author, Geraint Luff), with one patch: the raw
Emscripten factory is exported instead of the AudioWorklet wrapper. It time-stretches
and pitch-shifts PCM (plans/165 WP-7); `shells/web/src/lib/audio-stretch-core.ts`
drives it headlessly (bytes in, bytes out), which is what lets the export mix, the
preview bounce and node:test all run the IDENTICAL stretcher.

**Do not hand-edit `SignalsmithStretch.mjs`.** Regenerate it from the npm tarball:

```
npm pack signalsmith-stretch@1.3.2 && tar xzf signalsmith-stretch-1.3.2.tgz
node -e "const fs=require('fs');const s=fs.readFileSync('package/SignalsmithStretch.mjs','utf8');const c=s.indexOf('SignalsmithStretch = ((Module, audioNodeKey)');fs.writeFileSync('SignalsmithStretch.mjs', s.slice(0,c)+'\nexport default SignalsmithStretch;\n')"
```

## Provenance and checksums

- Source: `signalsmith-stretch@1.3.2` from the public npm registry (2025-06-27).
- Upstream `SignalsmithStretch.mjs` sha256:
  `97530b11d5bc01015af4cde40d6aa55ff10c40aa1294ca4c8c5762027d517a46`
- THE PATCH: the file's tail rebinds `SignalsmithStretch` to an AudioWorklet
  wrapper; everything from the marker `SignalsmithStretch = ((Module, audioNodeKey)`
  onward is dropped and replaced with `export default SignalsmithStretch;`, exposing
  the raw Emscripten factory (`_process(inN, outN)`, `_flush`, `_seek`,
  `_setTransposeSemitones`, `_setTransposeFactor`, formant controls). Nothing else
  changes; the WASM stays base64-embedded and self-contained.
- Patched file sha256 (pinned by tests/audio-stretch.test.ts):
  `c9080c6978538d324ca16fb3e739160e04682106784b740090ba14f8d9d6842a`

## Licensing

MIT (`LICENSE.signalsmith-stretch.txt`; the npm tarball declares MIT in package.json
but ships no LICENSE file, so the text is reproduced there and in
THIRD-PARTY-NOTICES.md). The Emscripten runtime glue inside the file is MIT
(© Emscripten authors).
