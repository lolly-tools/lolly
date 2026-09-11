# Masthead bank

Banked, signed masthead art: `<id>.svg` (or `<id>.html`, a markup+script *fragment*), each with a
REQUIRED sibling `<id>.meta.json` - `{ "generator": {"name","version"?}, "model"?: {"name","identifier"?},
"oversight"?: "prompt_guided"|"fully_autonomous"|"human_validated", "source": "trainedAlgorithmicMedia"|
"digitalCreation"|"compositeWithTrainedAlgorithmicMedia", "locale"?: bcp47 }` - because provenance is not
optional: `node scripts/sign-docs-art.ts` refuses an artifact with no meta, lints every file (no network,
no storage, no dynamic code, no external URLs, viewBox required, guarded motion, ≤ 48 KB of source) and
signs only what changed. A masthead id is a permanent contract, versioned in the manifest, never in the name.
