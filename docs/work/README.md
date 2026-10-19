# Lolly Work documentation source

The complete documentation lives at <https://lolly.tools/info>. This directory is the canonical source for Work guides. Edit these files and their entries in [../manifest.json](../manifest.json), then run `node scripts/sync-docs-navigation.ts` in the Lolly repository.

Work installations retain a generated copy in their `docs/` directory for the console and offline use. Existing console slugs, relative links, images and signed screenshot bytes remain compatible. A Work release can pin documentation independently of its engine version; the bundle describes the selected source revision, not a claim that a different server version implements every feature.

To update that bundle:

1. Commit the reviewed canonical changes in a clean Lolly checkout.
2. In the Work repository, run `node scripts/sync-docs-bundle.ts --source=/path/to/lolly --commit=<full-commit-sha>`.
3. Review the generated `docs/` changes and `docs-pin.json`, run `pnpm run verify:docs-pin` and the Work docs tests, then commit the bundle with the Work release.

The sync command verifies the exact source commit and refuses a dirty canonical checkout. The pin records every output hash; normal Work tests detect local bundle edits without needing the Lolly checkout. Add new pages and assets to the canonical manifest so both public and packaged output include them.

Imported Work prose, marks and screenshot credentials retain MPL-2.0 and any third-party notices. [LICENSE](LICENSE) retains the original terms. Screenshot capture and signing remain in Work; use `LW_DOCS_OUTPUT_ROOT` to write new captures into the canonical source's `docs/shots/work` directory, then review and commit them here. Do not rewrite existing signed SVG bytes during migration.
