# Build a raw Work pack from a signed Lolly release

Work mounts a directory containing tools and catalogue data. This raw directory
is different from Lolly's distributable `.lolly` archive. Build it from the exact
signed frontend release when tools, asset addresses or generated renditions have
changed. Rebuilding it from the source resolver can produce different indexes
and tool bytes from those the frontend verifies.

Run the maintained producer from a qualified Work checkout with its vendored
engine and resolver pinned to the reviewed Lolly source. Use clean, isolated
Lolly source at a full commit, an extracted final signed release and a fresh
output directory. The command installs nothing, signs nothing and contacts no
services.

```sh
node scripts/build-instance-pack.ts \
  --lolly /clean/lolly --profile PRIVATE_PROFILE --out /protected/raw-pack \
  --release-root /protected/final-dist \
  --release-custody /protected/release-custody.json \
  --release-custody-sha256 REVIEWED_CUSTODY_SHA256 \
  --node /path/to/node24
```

The separately reviewed custody file has this exact structure:

```json
{
  "version": 1,
  "status": "SIGNED_LOLLY_RELEASE_REVIEWED",
  "lollySource": "FULL_CLEAN_LOLLY_COMMIT",
  "profile": "PRIVATE_PROFILE",
  "manifest": {
    "path": "final-dist.manifest.json",
    "sha256": "REVIEWED_COMPLETE_MANIFEST_SHA256"
  },
  "publicPin": {
    "path": "public.jwk.json",
    "sha256": "REVIEWED_PUBLIC_JWK_FILE_SHA256"
  },
  "verifier": {
    "path": "scripts/verify-release-catalog.ts",
    "sha256": "REVIEWED_COMMITTED_VERIFIER_SHA256"
  }
}
```

Manifest and public-pin paths resolve relative to the custody file. The fixed
verifier path resolves within the clean Lolly source. Hashes cover exact file
bytes. The public pin must contain only `kty`, `crv`, `x` and `y` for P-256;
private signing material is neither accepted nor needed. The child verifier
receives this explicit pin, overriding any ambient public-pin setting.

The complete manifest is `{ "version": 1, "files": [...], "totalBytes": N }`.
Every row has `path`, `size` and full `sha256`; rows are sorted by relative path.
It inventories every file in the final extracted tree, including compression
siblings and retained immutable content. The producer checks every file, rejects
extra or missing entries, links, special files and inputs writable by others,
and rechecks the tree while copying. Review binds this release to its clean
source and profile; the manifest alone does not prove how the build was made.
Keep the original build, CI and qualification evidence with the pack.

The complete manifest may list up to 120,000 files, the same bound Work applies
to a shell release manifest. The catalogue delivery inventory inside the tree
keeps its own bound of 100,000 rows.

Release mode requires a modern signed catalogue with a sequence and tool
directory hashes. It runs the source-pinned Lolly verifier, checks the complete
signed logical tool closure and immutable delivery inventory, and validates
every gzip and Brotli sibling by streaming it to the exact identity size and
SHA-256. Invalid, orphaned, nested or partially consumed compressed files fail.

The raw output copies exact identity files under `tools/` and `catalog/`, plus
every path declared by `catalog/delivery-manifest.json`. This includes addressed
documentation images under `info/shots/` when the inventory identifies them. Current
and retained aliases, generated renditions and catalogue indexes remain byte
for byte the same as the release. Web chunks and serving configuration remain
in the shell.

The producer omits compression siblings and `catalog/tools/index.sig.json`.
Work creates its caller-specific catalogue signature when serving the pack;
the build envelope would not describe that filtered response. Release mode
refuses `--exclude`, `--allow-dirty` and nonempty output directories. Any desired
exclusions must happen before the frontend catalogue is signed. Signed indexes
are never pruned or reserialized by this mode.

`.lolly-pack-source.json` version 2 keeps the clean commit and profile separate
from its `derivation` record. That record binds the reviewed custody, full release
manifest, public-pin file, verifier, tool index and build envelope hashes, plus
the count of omitted coding siblings. It describes a verified release projection;
it does not claim generated or retained bytes came directly from Git. A failed
copy leaves an `incomplete` marker. The final engine inspection must also pass.

For private cohort preparation, provide `rawDerivation` in the reviewed evidence
as `{ "custody": { "path": "release-custody.json", "sha256": "..." } }`.
The preparer independently binds this receipt to the candidate shell's complete
manifest, existing public pin, source, profile and committed verifier, then checks
the exact raw projection. Successful offline preparation remains separate from
staging, live runtime qualification and production promotion.

The existing source-resolver mode remains available for local trials and older
content workflows. It uses version 1 provenance and can prune excluded catalogue
paths. Do not use that mode to reproduce a processed signed release.
