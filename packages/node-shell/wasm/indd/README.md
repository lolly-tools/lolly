# Portable InDesign converter

Lolly's browser and Node shells use the same committed `indd.wasm` to convert a native InDesign
file (`.indd`, or an `.indt` template) to an IDML package on the device. The IDML then follows the
existing IDML reader, so a native file opens in Design the same way an exported `.idml` does.
This is a preview: the converter does not yet write every attribute InDesign writes, so formatting
can differ from InDesign. The import report says so and lists the converter's own warnings.

The source converter is storytold's `indd-utils` crate at commit
`136f973a9d5f1b3ef34e46e27f4a08af196efde7`, MIT OR Apache-2.0, with no dependencies. Its source,
licence choices, clean-room caveats and notices are under `vendor/indd-utils/`. The Lolly byte
adapter in `src/lib.rs` is MPL-2.0. The command line tool is excluded.

Build with Rust 1.96.0 and the `wasm32-unknown-unknown` target:

```sh
rustup target add wasm32-unknown-unknown
pnpm run build:indd
node scripts/indd-corpus.ts fetch-fixtures
node --test tests/indd.test.ts
```

The build uses `Cargo.lock` and writes intermediates to ignored `plans/` storage. The module
imports no host functions, so a conversion needs no file system, clock or network.

Limits, enforced in the adapter and again by the loaders:

| Limit | Value |
|---|---|
| INDD input | 128 MiB |
| IDML package produced | 128 MiB, written through a capped sink |
| Warnings returned | 500, each cut at 400 characters, 128 KiB of JSON |
| Document name | 256 bytes |
| WASM memory | 1 GiB, linked in with a 1 MiB stack |

Input over a limit is refused before conversion. Output or memory over a limit is a refusal with a
plain message, and a trap retires the instance so the next conversion starts fresh. Files that do
not start with the InDesign signature, InDesign 1.x files, files without an object database and
truncated files are refused with a message. The converter does not panic on malformed input
(upstream denies panics and tests hostile files), and the fuzz target `indd` covers the adapter.

A native `.indd` is read on the calling thread, like the Photoshop adapter. Moving it to a worker
is a follow-up for very large files.

Verification: the upstream crate's own tests run in the vendored copy (`cargo test --release`
with `INDD_FIXTURES` set), `tests/indd.test.ts` checks the six open fixtures against the native
build's output, and `node scripts/indd-corpus.ts` fetches and converts a bounded sample of
openly licensed documents.
