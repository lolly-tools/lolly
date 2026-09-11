// SPDX-License-Identifier: MPL-2.0
/**
 * Minimal typed view of the Vite-injected `import.meta.env`.
 *
 * We augment only the one flag the shell reads (PROD - it gates service-worker
 * registration in main) rather than pulling in `vite/client`, whose
 * ImportMetaEnv is `Record<string, any>`; that `any` would leak app-wide and
 * violate the strict-TS contract.
 */
interface ImportMetaEnv {
  readonly PROD: boolean;
  // External base URL for the on-device model files (Vercel Blob); '' / undefined
  // means same-origin /models/. Read only by lib/models-base.ts.
  readonly VITE_MODELS_BASE?: string;
  readonly VITE_REQUIRE_AI_POLICY?: string;
  // Deployment public key (JWK JSON) that vouches for the catalog index and any
  // loadable .lolly instance pack; unset means unsigned/dev. Read only by
  // lib/pack-store.ts (kept in sync with catalog/integrity.ts's PINNED_KEY).
  readonly VITE_CATALOG_PUBLIC_KEY_JWK?: string;
  // `verified` on deployable builds; `unsigned-dev` on local build/preview.
  readonly VITE_CATALOG_TRUST_MODE?: 'verified' | 'unsigned-dev';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/**
 * Vite's `?raw` suffix: the file's text as the default export. Declared for `.css`
 * only, which is the one use in the shell - lib/docs-landing.ts reads
 * styles/parts/docs-landing.css as a string so it can wrap it in `@scope` before
 * injecting it, instead of letting an unscoped sheet loose in the app. A blanket
 * `*?raw` would also swallow typos in ordinary specifiers.
 */
declare module '*.css?raw' {
  const source: string;
  export default source;
}

/**
 * Vite's `?url` suffix: the built asset's URL as the default export. Declared for
 * `.wasm` only, the one use in the shell - bridge/scan.ts loads the zxing-wasm
 * reader binary this way so it is bundled + PWA-precached rather than fetched
 * from a CDN. A blanket `*?url` would swallow typos in ordinary specifiers.
 */
declare module '*.wasm?url' {
  const url: string;
  export default url;
}
