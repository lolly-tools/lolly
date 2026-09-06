// SPDX-License-Identifier: MPL-2.0
/**
 * The YunoHost package under deploy/yunohost/ is mirrored verbatim to the
 * `lolly_ynh` app repository, where YunoHost's own CI installs it on a real host.
 * Nothing here can run that install; what it CAN do is hold the package to the
 * shape that install depends on, so a broken package is caught in this repo and
 * not at the first `yunohost app install`:
 *
 *   - the manifest's three release-pinned fields agree with each other, and the
 *     release script's pin/read round-trips (scripts/yunohost-release.ts);
 *   - every script parses as bash and is executable, and uses only helpers-2.1
 *     names (the manifest declares helpers_version = "2.1", so a 2.0 name such as
 *     ynh_add_nginx_config is a hard failure at install time);
 *   - the nginx location file only uses placeholders YunoHost substitutes, and
 *     every location that sets a header of its own re-includes the header file,
 *     so the policy travels with every Cache-Control the way it does in the
 *     Docker config (tests/security-headers.test.ts);
 *   - the CSP in the header include is byte-identical to the hosted policy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { pinManifest, readPin, tarExcludes, tarballName, translatedLocales, parseArgs, RELEASE_HOST } from '../scripts/yunohost-release.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PKG = join(ROOT, 'deploy', 'yunohost');
const read = (p: string): string => readFileSync(join(PKG, p), 'utf8');

const manifest = read('manifest.toml');
const nginx = read('conf/nginx.conf');
const headers = read('conf/security-headers.inc');

test('manifest: packaging format 2, helpers 2.1, whole-domain static app', () => {
  assert.match(manifest, /^packaging_format = 2$/m);
  assert.match(manifest, /^id = "lolly"$/m);
  assert.match(manifest, /^helpers_version = "2\.1"$/m);
  assert.match(manifest, /^\s*full_domain = true$/m, 'the web build only works at a domain root');
  assert.match(manifest, /^\s*main\.url = "\/"$/m);
  assert.match(manifest, /^license = "MPL-2\.0"$/m);
  // No install question the scripts do not consume: there is nothing to configure.
  assert.doesNotMatch(manifest, /\[install\.(admin|password|path)\]/);
});

test('manifest: the release pin is self-consistent', () => {
  const pin = readPin(manifest);
  assert.match(pin.version, /^\d+\.\d+\.\d+$/);
  assert.ok(pin.ynhRev >= 1);
  assert.equal(pin.url, `${RELEASE_HOST}/${tarballName(pin.version)}`, 'url must name the tarball for the pinned version');
  assert.match(pin.sha256, /^[0-9a-f]{64}$/);
  // in_subdir = false: the tarball is `tar -C dist .`, index.html at its root.
  assert.match(manifest, /^\s*in_subdir = false$/m);
});

test('release script: pinning rewrites exactly the three fields and reads back', () => {
  const pin = { version: '9.8.7', ynhRev: 3, url: `${RELEASE_HOST}/${tarballName('9.8.7')}`, sha256: 'ab'.repeat(32) };
  const pinned = pinManifest(manifest, pin);
  assert.deepEqual(readPin(pinned), pin);
  // Everything that is not a pinned line survives byte for byte.
  const strip = (s: string): string => s.replace(/^version = .*$/m, '').replace(/^\s*url = .*$/m, '').replace(/^\s*sha256 = .*$/m, '');
  assert.equal(strip(pinned), strip(manifest));
  assert.throws(() => pinManifest('no pins here', pin), /rewrote 0/);
});

test('release script: the cut mirrors the desktop trim (models out, English docs only)', () => {
  const locales = translatedLocales();
  assert.ok(locales.length >= 20, 'expected the translated locale set');
  assert.ok(!locales.includes('en'));
  const ex = tarExcludes(locales);
  assert.equal(ex[0], './models');
  for (const code of locales) assert.ok(ex.includes(`./info/${code}`));
  assert.ok(!ex.includes('./info/en'));
});

test('release script: argument parsing', () => {
  assert.deepEqual(parseArgs(['--build', '--ynh-rev', '2', '--version', '1.2.3', '--out', '/x']).ynhRev, 2);
  assert.equal(parseArgs(['--version', '1.2.3']).version, '1.2.3');
  assert.throws(() => parseArgs(['--version', 'v1']), /x\.y\.z/);
  assert.throws(() => parseArgs(['--ynh-rev', '0']), /positive/);
  assert.throws(() => parseArgs(['--bogus']), /unknown argument/);
});

const SCRIPTS = ['install', 'upgrade', 'remove', 'backup', 'restore', 'change_url'];

test('scripts: present, executable, valid bash', () => {
  for (const name of [...SCRIPTS, '_common.sh']) {
    const p = join(PKG, 'scripts', name);
    assert.ok(existsSync(p), `scripts/${name} missing`);
    assert.ok(statSync(p).mode & 0o111, `scripts/${name} is not executable`);
    const r = spawnSync('bash', ['-n', p], { encoding: 'utf8' });
    assert.equal(r.status, 0, `scripts/${name} does not parse: ${r.stderr}`);
  }
  // Every lifecycle script sources the helpers; backup/restore reach _common.sh
  // through the settings copy YunoHost keeps, as the packaging docs require.
  for (const name of SCRIPTS) {
    const s = read(`scripts/${name}`);
    assert.match(s, /^source \/usr\/share\/yunohost\/helpers$/m, `${name} must source the helpers`);
    const common = name === 'backup' || name === 'restore' ? 'source ../settings/scripts/_common.sh' : 'source _common.sh';
    assert.ok(s.includes(common), `${name} must source _common.sh as "${common}"`);
  }
});

test('scripts: helpers-2.1 names only', () => {
  // The 2.0 spellings still exist on some hosts as deprecated shims, but the
  // manifest promises 2.1 and package_check lints the mismatch as an error.
  const legacy = [
    'ynh_add_nginx_config', 'ynh_remove_nginx_config', 'ynh_add_config', 'ynh_secure_remove',
    'ynh_systemd_action', 'ynh_exec_warn_less', 'ynh_install_nodejs', 'ynh_use_nodejs',
    'ynh_add_systemd_config', 'ynh_change_url_nginx_config', 'ynh_script_progression --',
    'ynh_backup --src_path', 'ynh_restore_file', 'ynh_clean_setup',
  ];
  for (const name of [...SCRIPTS, '_common.sh']) {
    const s = read(`scripts/${name}`);
    for (const old of legacy) assert.ok(!s.includes(old), `scripts/${name} uses the pre-2.1 helper "${old}"`);
  }
});

test('scripts: the header include is written before nginx is (re)configured, and removed with it', () => {
  for (const name of ['install', 'upgrade']) {
    const s = read(`scripts/${name}`);
    const inc = s.indexOf('lolly_add_headers_inc');
    const ng = s.indexOf('ynh_config_add_nginx');
    assert.ok(inc > 0 && ng > inc, `${name}: lolly_add_headers_inc must run before ynh_config_add_nginx (nginx -t needs the include to exist)`);
  }
  assert.match(read('scripts/remove'), /ynh_safe_rm "\$headers_inc"/);
  assert.match(read('scripts/backup'), /ynh_backup "\$headers_inc"/);
  assert.match(read('scripts/restore'), /ynh_restore "\$headers_inc"/);
  const cu = read('scripts/change_url');
  assert.ok(cu.indexOf('lolly_add_headers_inc') < cu.indexOf('ynh_config_change_url_nginx'));
  assert.match(cu, /if \[ "\$old_domain" != "\$domain" \]/, 'change_url must not delete the include it just wrote when only the path changed');
});

test('nginx: only placeholders YunoHost substitutes, and the .inc suffix that keeps it out of the *.conf glob', () => {
  const placeholders = new Set([...nginx.matchAll(/__([A-Z_]+)__/g)].map((m) => m[1]));
  assert.deepEqual(placeholders, new Set(['INSTALL_DIR', 'DOMAIN', 'APP']));
  assert.match(nginx, /include \/etc\/nginx\/conf\.d\/__DOMAIN__\.d\/__APP__\.headers\.inc;/);
  assert.match(read('scripts/_common.sh'), /headers_inc="\/etc\/nginx\/conf\.d\/\$domain\.d\/\$app\.headers\.inc"/);
  assert.match(nginx, /include conf\.d\/yunohost_panel\.conf\.inc;/, 'the portal overlay include is what puts the YunoHost button on app pages');
  // No sub-path markers: the manifest says full_domain, so a stray
  // `#sub_path_only` line would be dead text pretending to be a feature.
  assert.doesNotMatch(nginx, /#(sub|root)_path_only/);
  // `types` inside a location replaces the inherited table, so mime.types must
  // come back in first or every .css/.js would be served as octet-stream.
  assert.ok(nginx.indexOf('include /etc/nginx/mime.types;') < nginx.indexOf('types {'));
});

test('nginx: every location that sets a header re-includes the header file', () => {
  // Walk the innermost location blocks (nested `location` inside `location /`).
  const inner = [...nginx.matchAll(/location\s+(?:=|\^~)?\s*([^\s{]+)\s*\{([^{}]*)\}/g)]
    .map((m) => ({ path: m[1]!, body: m[2]! }));
  assert.ok(inner.length >= 8, `expected the cache-tier locations, found ${inner.length}`);
  const offenders = inner
    .filter((l) => /more_set_headers|add_header/.test(l.body))
    .filter((l) => !/__APP__\.headers\.inc;/.test(l.body))
    .map((l) => l.path);
  assert.deepEqual(offenders, [], `locations setting headers without re-including the security headers: ${offenders.join(', ')}`);
  // And nobody uses add_header at all: YunoHost's own header set is more_set_headers,
  // and mixing the two modules gives duplicate headers.
  assert.doesNotMatch(nginx, /add_header/);
  assert.doesNotMatch(headers, /add_header/);
});

test('headers: the CSP and the literal headers are the hosted policy, byte for byte', () => {
  const hosted = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8')) as { headers: Array<{ headers: Array<{ key: string; value: string }> }> };
  const want = Object.fromEntries(hosted.headers[0]!.headers.map((h) => [h.key, h.value]));
  const got: Record<string, string> = {};
  for (const m of headers.matchAll(/^more_set_headers "([A-Za-z-]+): ([^\n]*)";$/gm)) got[m[1]!] = m[2]!;
  assert.deepEqual(got, want, 'the YunoHost header set must be exactly the hosted one - YunoHost adds its own baseline (HSTS, X-Frame-Options) at server level, so nothing else belongs here');
});

test('package: the files YunoHost and its catalog expect', () => {
  for (const f of ['LICENSE', 'README.md', 'tests.toml', 'doc/DESCRIPTION.md', 'doc/ADMIN.md', 'doc/PRE_INSTALL.md']) {
    assert.ok(existsSync(join(PKG, f)), `${f} missing`);
  }
  assert.equal(read('LICENSE'), readFileSync(join(ROOT, 'LICENSE'), 'utf8'), 'the package licence is the project licence');
  assert.match(read('tests.toml'), /^test_format = 1\.0$/m);
  assert.match(read('tests.toml'), /install\.subdir/, 'full_domain apps exclude the sub-path install test');
  // Nothing stray in the package root: it is mirrored whole into the app repo.
  const allowed = new Set(['LICENSE', 'README.md', 'conf', 'doc', 'manifest.toml', 'scripts', 'tests.toml']);
  for (const entry of readdirSync(PKG)) assert.ok(allowed.has(entry), `unexpected ${entry} in deploy/yunohost/`);
});
