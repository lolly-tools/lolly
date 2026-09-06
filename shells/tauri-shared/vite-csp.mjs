// SPDX-License-Identifier: MPL-2.0
/**
 * The Tauri shells' Content Security Policy, delivered as a <meta> tag in the
 * built index.html instead of through tauri.conf.json's `app.security.csp`.
 *
 * WHY NOT THE CONFIG KEY. When `app.security.csp` (or `devCsp`) is set, Tauri's
 * codegen parses EVERY `.html` file in frontendDist with html5ever, injects
 * nonce placeholders, and re-serialises it into the embedded asset table
 * (tauri-codegen/src/context.rs, `map_core_assets`). It does that even with
 * `dangerousDisableAssetCspModification` on - that flag only gates the
 * modifications, not the parse-and-reserialise. The tool templates
 * (`tools/<id>/template.html`) are `.html` files too, so the bytes the app
 * served no longer matched the digests `scripts/sign-catalog.ts` signed over
 * the dist, and under the verified-only trust mode of a release build every
 * tool refused to load: "catalog integrity: 'agenda/template.html' does not
 * match its signed digest" (FITZY, 1.0.7 sideload, 2026-09-06). The web shell
 * never saw it because a web server serves files as they are.
 *
 * With the key null, codegen embeds every asset byte-exact and the runtime
 * serves it verbatim, so the signed digests hold. The policy itself moves
 * here, ONE string both shells apply, and `tauriCspMeta()` writes it into the
 * app document at build time - the same document the docs try-it iframe and
 * every tool render live in. Tauri used to send it as a response header on each
 * `.html` asset; a meta tag on the app document covers the same surface, since
 * tool templates are fetched as text and never navigated to.
 *
 * `frame-ancestors` is dropped from the meta form: a browser ignores it when
 * delivered by <meta> and says so in the console on every boot, and inside a
 * WebView there is no ancestor to refuse.
 *
 * Dev (`tauri dev` / `tauri ios dev`) loads the dev server directly, where
 * Tauri never applied a policy either, so the plugin is build-only: dev keeps
 * the unrestricted page it always had. tests/tauri-csp.test.ts pins all of
 * this so the config key cannot quietly come back.
 */

export const TAURI_CSP = [
  "default-src 'self' customprotocol: asset:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "connect-src 'self' ipc: http://ipc.localhost https: data: blob:",
  "img-src 'self' asset: http://asset.localhost https: data: blob:",
  "media-src 'self' asset: http://asset.localhost https: data: blob:",
  "font-src 'self' asset: http://asset.localhost https: data: blob:",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ');

/** The <meta> element the plugin injects, as a Vite HtmlTagDescriptor. */
export function cspMetaTag(policy = TAURI_CSP) {
  return {
    tag: 'meta',
    attrs: { 'http-equiv': 'Content-Security-Policy', content: policy },
    injectTo: 'head-prepend',
  };
}

/**
 * Vite plugin: prepend the policy to <head> of the built index.html. Build-only
 * (see above). `transformIndexHtml` only ever sees the app document, never the
 * tool templates or the /info pages copied through publicDir, so nothing
 * signed is touched.
 */
export function tauriCspMeta(policy = TAURI_CSP) {
  return {
    name: 'tauri-csp-meta',
    apply: 'build',
    transformIndexHtml() {
      return [cspMetaTag(policy)];
    },
  };
}
