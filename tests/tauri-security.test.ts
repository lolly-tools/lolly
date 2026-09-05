// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const ROOT = new URL('../', import.meta.url);
const shells = ['tauri-desktop', 'tauri-mobile'] as const;

function json(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(new URL(path, ROOT), 'utf8')) as Record<string, unknown>;
}

test('packaged Tauri shells enforce a non-null CSP with IPC and deny-by-default directives', () => {
  for (const shell of shells) {
    const conf = json(`shells/${shell}/src-tauri/tauri.conf.json`);
    const security = (conf.app as { security: { csp: string; devCsp: string } }).security;
    assert.equal(typeof security.csp, 'string', `${shell} has a packaged CSP`);
    for (const source of [
      "default-src 'self'",
      'connect-src',
      'ipc:',
      'http://ipc.localhost',
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
    ]) {
      assert.ok(security.csp.includes(source), `${shell} CSP contains ${source}`);
    }
    assert.doesNotMatch(security.csp, /\shttp:(?:\s|;)/, `${shell} packaged CSP does not allow arbitrary cleartext HTTP`);
    assert.equal(typeof security.devCsp, 'string', `${shell} declares its broader development CSP explicitly`);
  }
});

test('Tauri filesystem ACLs contain only used verbs and exact application-owned roots', () => {
  for (const shell of shells) {
    const caps = json(`shells/${shell}/src-tauri/capabilities/default.json`);
    const permissions = caps.permissions as Array<string | Record<string, unknown>>;
    assert.ok(!permissions.includes('fs:allow-create'), `${shell} drops unused create`);
    assert.ok(!permissions.includes('fs:allow-rename'), `${shell} drops unused rename`);
    assert.ok(!permissions.some(p => typeof p === 'string' && /^fs:scope-.*-recursive$/.test(p)),
      `${shell} has no whole-base-directory recursive scope`);
    const scope = permissions.find(p => typeof p === 'object' && p.identifier === 'fs:scope') as {
      allow: Array<{ path: string }>;
    } | undefined;
    const paths = scope?.allow.map(entry => entry.path) ?? [];
    assert.ok(paths.includes('$APPDATA/saved-state/**'), `${shell} retains saved state only`);
    assert.ok(paths.includes('$APPDATA/pack-store/**'), `${shell} retains installed packs only`);
    assert.ok(paths.includes('$DOWNLOAD/Lolly/**'), `${shell} writes only its Downloads subfolder`);
    assert.ok(paths.every(value => /\/(?:saved-state|pack-store|Lolly)(?:\/\*\*)?$/.test(value)),
      `${shell} scopes contain only known application-owned paths`);
  }
  const mobile = json('shells/tauri-mobile/src-tauri/capabilities/default.json');
  const mobileScope = (mobile.permissions as Array<string | { identifier?: string; allow?: Array<{ path: string }> }>)
    .find(p => typeof p === 'object' && p.identifier === 'fs:scope') as { allow: Array<{ path: string }> };
  assert.ok(mobileScope.allow.some(entry => entry.path === '$DOCUMENT/Lolly/**'), 'mobile retains only its iOS Files subfolder');
});

test('desktop OAuth uses a narrow native command, not generic shell-open permission', () => {
  const caps = json('shells/tauri-desktop/src-tauri/capabilities/default.json');
  assert.ok(!(caps.permissions as string[]).includes('shell:allow-open'));
  const pkg = json('shells/tauri-desktop/package.json');
  assert.ok(!('@tauri-apps/plugin-shell' in (pkg.dependencies as Record<string, string>)));
  const cargo = readFileSync(new URL('shells/tauri-desktop/src-tauri/Cargo.toml', ROOT), 'utf8');
  assert.doesNotMatch(cargo, /^tauri-plugin-shell\s*=/m);
  const auth = readFileSync(new URL('shells/web/src/lib/provider-auth.ts', ROOT), 'utf8');
  assert.match(auth, /invoke\('oauth_open', \{ raw: url \}\)/);
  assert.doesNotMatch(auth, /plugin:shell\|open/);
});

test('Tauri remote fetch is a bounded native command, not a raw HTTP plugin', () => {
  const desktopBoundary = readFileSync(new URL('shells/tauri-desktop/src-tauri/src/remote_fetch.rs', ROOT), 'utf8');
  const mobileBoundary = readFileSync(new URL('shells/tauri-mobile/src-tauri/src/remote_fetch.rs', ROOT), 'utf8');
  assert.equal(mobileBoundary, desktopBoundary, 'desktop and mobile native boundaries stay byte-identical');
  for (const token of [
    'MAX_REQUEST_BYTES',
    'MAX_RESPONSE_BYTES',
    'MAX_REDIRECTS',
    'is_public_ip',
    '.resolve_to_addrs(&host, &addresses)',
    '.no_proxy()',
    'headers.remove(AUTHORIZATION)',
    'headers.remove(COOKIE)',
  ]) {
    assert.ok(desktopBoundary.includes(token), `remote boundary retains ${token}`);
  }

  for (const shell of shells) {
    const caps = json(`shells/${shell}/src-tauri/capabilities/default.json`);
    const permissions = caps.permissions as Array<string | { identifier?: string }>;
    assert.ok(!permissions.some(permission => permission === 'http:default'
      || (typeof permission === 'object' && permission.identifier?.startsWith('http:'))),
    `${shell} exposes no raw HTTP permission`);
    const pkg = json(`shells/${shell}/package.json`);
    assert.ok(!('@tauri-apps/plugin-http' in (pkg.dependencies as Record<string, string>)),
      `${shell} does not ship the HTTP guest binding`);
    const cargo = readFileSync(new URL(`shells/${shell}/src-tauri/Cargo.toml`, ROOT), 'utf8');
    const lib = readFileSync(new URL(`shells/${shell}/src-tauri/src/lib.rs`, ROOT), 'utf8');
    assert.doesNotMatch(cargo, /^tauri-plugin-http\s*=/m);
    assert.doesNotMatch(lib, /tauri_plugin_http::init/);
    assert.match(lib, /remote_fetch::remote_fetch/);
  }

  const adapter = readFileSync(new URL('shells/web/src/lib/instance.ts', ROOT), 'utf8');
  assert.match(adapter, /invoke<TauriRemoteFetchResponse>\('remote_fetch'/);
  assert.doesNotMatch(adapter, /plugin:http\|fetch/);
});
