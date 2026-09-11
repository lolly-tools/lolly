// SPDX-License-Identifier: MPL-2.0
// butterchurn ships a webpack UMD bundle and no types, and the docs player is
// its own esbuild project - it cannot see shells/web/src/vendor.d.ts. player.ts
// unwraps the module shape itself (resolveButterchurn walks the default-export
// nesting), so the import is deliberately near-opaque here: just enough for the
// dynamic `import('butterchurn')` to typecheck once a tsconfig includes this
// directory.
declare module 'butterchurn';
