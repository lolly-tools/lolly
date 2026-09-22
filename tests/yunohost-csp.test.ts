// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PKG = fileURLToPath(new URL('../deploy/yunohost/', import.meta.url));
const TEMPLATE = readFileSync(join(PKG, 'conf/security-headers.inc'), 'utf8');
const DEFAULT = TEMPLATE.replace('__LOLLY_CSP_EXTRA_CONNECT_SRC__', '');
const ORIGINS = 'https://cloud.example.org https://storage.example.org:8443';

// Execute the package scripts with filesystem, settings and service helpers
// standing in for a YunoHost host. No system nginx files or services are touched.
const HELPERS = String.raw`
set -e
headers_inc="$LOLLY_TEST_DIR/$domain.headers.inc"
ynh_die() { printf '%s\n' "$*" >&2; exit 1; }
ynh_script_progression() { :; }
ynh_print_info() { :; }
ynh_setup_source() { :; }
ynh_app_setting_set() {
    [[ "$1" == --key=csp_extra_connect_src ]]
    printf '%s' "${'$'}{2#--value=}" > "$LOLLY_TEST_DIR/setting"
    echo save >> "$LOLLY_TEST_DIR/events"
}
ynh_app_setting_set_default() {
    if [[ -z "${'$'}{csp_extra_connect_src:-}" ]]; then
        csp_extra_connect_src=""
        ynh_app_setting_set "$@"
    fi
}
ynh_config_add() {
    [[ "$1" == --template=security-headers.inc ]]
    [[ "$2" == "--destination=$headers_inc" ]]
    sed "s|__LOLLY_CSP_EXTRA_CONNECT_SRC__|$lolly_csp_extra_connect_src|g" \
        ../conf/security-headers.inc > "$headers_inc"
    echo render >> "$LOLLY_TEST_DIR/events"
}
nginx() {
    [[ "$*" == '-t' ]]
    echo check >> "$LOLLY_TEST_DIR/events"
    [[ "${'$'}{LOLLY_TEST_FAIL:-}" != check ]]
}
ynh_systemctl() {
    [[ "$*" == '--service=nginx --action=reload' ]]
    echo reload >> "$LOLLY_TEST_DIR/events"
    [[ "${'$'}{LOLLY_TEST_FAIL:-}" != reload ]]
}
ynh_store_file_checksum() { echo checksum >> "$LOLLY_TEST_DIR/events"; }
ynh_config_add_nginx() { ynh_systemctl --service=nginx --action=reload; }
ynh_config_change_url_nginx() { ynh_config_add_nginx; }
ynh_safe_rm() { :; }
ynh_backup() {
    if [[ "$1" == "$headers_inc" ]]; then cp "$1" "$LOLLY_TEST_DIR/archive/headers"; fi
}
ynh_restore() {
    if [[ "$1" == "$headers_inc" ]]; then cp "$LOLLY_TEST_DIR/archive/headers" "$1"; fi
}
ynh_app_config_run() {
    [[ "$1" == apply ]]
    local errors
    errors=$(validate__csp_extra_connect_src)
    [[ -z "$errors" ]] || ynh_die "$errors"
    set__csp_extra_connect_src
}
`;

function fixture(t: test.TestContext) {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-yunohost-csp-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(PKG, 'scripts'), join(dir, 'scripts'), { recursive: true });
  cpSync(join(PKG, 'conf'), join(dir, 'conf'), { recursive: true });
  cpSync(join(PKG, 'scripts'), join(dir, 'settings/scripts'), { recursive: true });
  mkdirSync(join(dir, 'archive'));
  writeFileSync(join(dir, 'helpers'), HELPERS);
  writeFileSync(join(dir, 'events'), '');
  const saved = () => existsSync(join(dir, 'setting')) ? readFileSync(join(dir, 'setting'), 'utf8') : undefined;
  const run = (script: string, env: NodeJS.ProcessEnv = {}) => {
    const source = readFileSync(join(dir, 'scripts', script), 'utf8')
      .replace('source /usr/share/yunohost/helpers', 'source "$LOLLY_TEST_DIR/helpers"');
    return spawnSync('bash', ['-e', '-c', source, script, 'apply'], {
      cwd: join(dir, 'scripts'), encoding: 'utf8',
      env: { ...process.env, app: 'lolly', domain: 'lolly.example.org', install_dir: join(dir, 'www'),
        LOLLY_TEST_DIR: dir, csp_extra_connect_src: saved(), ...env },
    });
  };
  return {
    dir, run, saved,
    headers: (domain = 'lolly.example.org') => readFileSync(join(dir, `${domain}.headers.inc`), 'utf8'),
    events: () => readFileSync(join(dir, 'events'), 'utf8').trim().split('\n'),
    clearEvents: () => writeFileSync(join(dir, 'events'), ''),
  };
}

test('storage origins: default, configure, upgrade, backup/restore, domain change and clear', t => {
  const f = fixture(t);
  const ok = (script: string, env: NodeJS.ProcessEnv = {}) => {
    const r = f.run(script, env);
    assert.equal(r.status, 0, `${script}: ${r.stderr}`);
  };
  ok('install');
  assert.equal(f.saved(), '');
  assert.equal(f.headers(), DEFAULT);
  f.clearEvents();
  ok('config', { csp_extra_connect_src: `  https://cloud.example.org/ ${ORIGINS}  ` });
  assert.equal(f.saved(), ORIGINS);
  const configured = f.headers();
  assert.equal(configured, DEFAULT.replace('; img-src', ` ${ORIGINS}; img-src`));
  assert.deepEqual(f.events(), ['render', 'check', 'reload', 'save']);

  writeFileSync(join(f.dir, 'lolly.example.org.headers.inc'), 'manual edit');
  ok('upgrade');
  assert.equal(f.headers(), configured);
  assert.equal(f.saved(), ORIGINS);

  ok('backup');
  // YunoHost itself archives and restores settings.yml alongside these files.
  cpSync(join(f.dir, 'setting'), join(f.dir, 'archive/setting'));
  ok('config', { csp_extra_connect_src: '' });
  assert.equal(f.headers(), DEFAULT);
  assert.equal(f.saved(), '');
  cpSync(join(f.dir, 'archive/setting'), join(f.dir, 'setting'));
  ok('restore');
  assert.equal(f.headers(), configured);
  ok('upgrade');
  assert.equal(f.headers(), configured);

  ok('change_url', { domain: 'new.example.org', old_domain: 'lolly.example.org' });
  assert.equal(f.headers('new.example.org'), configured);
  assert.equal(f.saved(), ORIGINS);
});

test('upgrade from a package without the setting initializes the default', t => {
  const f = fixture(t);
  assert.equal(f.saved(), undefined);
  const r = f.run('upgrade');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(f.saved(), '');
  assert.equal(f.headers(), DEFAULT);
});

test('invalid origins cannot change headers or saved settings, including during upgrades', t => {
  const f = fixture(t);
  assert.equal(f.run('install').status, 0);
  assert.equal(f.run('config', { csp_extra_connect_src: ORIGINS }).status, 0);
  const before = f.headers();
  const invalid = [
    '*', 'https:', 'http://cloud.example.org', 'https://*.example.org',
    'https://user:secret@cloud.example.org', 'https://cloud.example.org/remote.php/dav',
    'https://cloud.example.org?x=y', 'https://cloud.example.org#fragment',
    'https://cloud.example.org; script-src *', 'https://cloud.example.org";',
    'https://$host', 'https://$(id)', 'https://`id`', 'https://cloud.example.org\\',
    'https://cloud.example.org\nhttps://other.example.org', 'https://cloud.example.org\r',
    'https://cloud.example.org\thttps://other.example.org',
    'https://cloud.example.org:0', 'https://cloud.example.org:65536',
    'https://cloud.example.org:*', 'https://-cloud.example.org', 'https://cloud..example.org',
    `https://${'a'.repeat(64)}.example.org`, `https://${'a'.repeat(4096)}`,
  ];
  for (const value of invalid) {
    for (const script of ['config', 'upgrade']) {
      f.clearEvents();
      const r = f.run(script, { csp_extra_connect_src: value });
      assert.notEqual(r.status, 0, `${script} accepted ${JSON.stringify(value)}`);
      assert.equal(f.headers(), before);
      assert.equal(f.saved(), ORIGINS);
      assert.equal(f.events().includes('render'), false);
    }
  }
});

for (const failure of ['check', 'reload']) {
  test(`nginx ${failure} failure restores headers and leaves the saved setting intact`, t => {
    const f = fixture(t);
    assert.equal(f.run('install').status, 0);
    assert.equal(f.run('config', { csp_extra_connect_src: ORIGINS }).status, 0);
    const before = f.headers();
    f.clearEvents();
    const r = f.run('config', { csp_extra_connect_src: '', LOLLY_TEST_FAIL: failure });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /previous configuration was restored/);
    assert.equal(f.headers(), before);
    assert.equal(f.saved(), ORIGINS);
    assert.equal(f.events().includes('save'), false);
    if (failure === 'check') assert.equal(f.events().includes('reload'), false);
  });
}
