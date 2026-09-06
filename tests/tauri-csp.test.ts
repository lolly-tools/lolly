// SPDX-License-Identifier: MPL-2.0
/**
 * The Tauri shells' CSP must NOT live in tauri.conf.json.
 *
 * With `app.security.csp` (or `devCsp`) set, Tauri's codegen parses and
 * re-serialises every `.html` file in frontendDist - the signed tool templates
 * included - so the bytes the app serves stop matching the digests in
 * catalog/tools/index.sig.json, and under a release build's verified-only
 * trust mode every tool refuses to load. The policy moved to a <meta> tag
 * written by shells/tauri-shared/vite-csp.mjs; this test keeps it there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { TAURI_CSP, cspMetaTag, tauriCspMeta } from '../shells/tauri-shared/vite-csp.mjs';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const SHELLS = ['tauri-desktop', 'tauri-mobile'] as const;

for (const shell of SHELLS) {
  test(`${shell}: tauri.conf.json carries no CSP (codegen would rewrite every .html asset)`, () => {
    const conf = JSON.parse(readFileSync(resolve(ROOT, `shells/${shell}/src-tauri/tauri.conf.json`), 'utf8')) as {
      app?: { security?: { csp?: unknown; devCsp?: unknown } };
    };
    const security = conf.app?.security ?? {};
    assert.equal(security.csp ?? null, null, `${shell}: app.security.csp must be null - see vite-csp.mjs`);
    assert.equal(security.devCsp ?? null, null, `${shell}: app.security.devCsp must be null - see vite-csp.mjs`);
  });

  test(`${shell}: vite config applies the shared CSP meta plugin`, () => {
    const config = readFileSync(resolve(ROOT, `shells/${shell}/vite.config.js`), 'utf8');
    assert.match(config, /from '\.\.\/tauri-shared\/vite-csp\.mjs'/, `${shell} imports the shared module`);
    assert.match(config, /\btauriCspMeta\(\)/, `${shell} registers the plugin`);
  });
}

test('the shared policy is a real CSP with the directives the shells rely on', () => {
  const directives = new Map(TAURI_CSP.split(';').map((d) => {
    const [name, ...sources] = d.trim().split(/\s+/);
    return [name, sources] as const;
  }));
  for (const name of ['default-src', 'script-src', 'style-src', 'connect-src', 'img-src', 'worker-src', 'object-src', 'base-uri']) {
    assert.ok(directives.has(name), `policy declares ${name}`);
  }
  assert.ok(directives.get('connect-src')?.includes('ipc:'), 'IPC transport stays reachable');
  assert.ok(directives.get('script-src')?.includes("'wasm-unsafe-eval'"), 'WASM engines stay loadable');
  assert.deepEqual(directives.get('object-src'), ["'none'"]);
  // A browser ignores frame-ancestors from a <meta> element and warns about it;
  // inside a WebView there is nothing to refuse, so the meta form leaves it out.
  assert.ok(!directives.has('frame-ancestors'), 'no directive a <meta> policy cannot honour');
});

test('the plugin prepends exactly one CSP meta tag to the app document, build-only', () => {
  const plugin = tauriCspMeta() as { apply: string; transformIndexHtml: () => unknown[] };
  assert.equal(plugin.apply, 'build');
  const tags = plugin.transformIndexHtml();
  assert.deepEqual(tags, [cspMetaTag()]);
  const tag = tags[0] as { tag: string; attrs: Record<string, string>; injectTo: string };
  assert.equal(tag.tag, 'meta');
  assert.equal(tag.injectTo, 'head-prepend');
  assert.equal(tag.attrs['http-equiv'], 'Content-Security-Policy');
  assert.equal(tag.attrs.content, TAURI_CSP);
  assert.ok(!TAURI_CSP.includes('"'), 'policy is safe inside a double-quoted attribute');
});
