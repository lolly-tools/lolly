// SPDX-License-Identifier: MPL-2.0
/**
 * Minimal typed view of the Vite-injected `import.meta.env`.
 *
 * We augment only the one flag the shell reads (PROD — it gates service-worker
 * registration in main.ts) rather than pulling in `vite/client`, whose
 * ImportMetaEnv is `Record<string, any>`; that `any` would leak app-wide and
 * violate the strict-TS contract.
 */
interface ImportMetaEnv {
  readonly PROD: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
