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
const MODELS_HOST = '__LOLLY_CSP_MODELS_HOST__';
const DEFAULT = TEMPLATE.replace('__LOLLY_CSP_EXTRA_CONNECT_SRC__', '').replace(MODELS_HOST, ' https://lolli.li');
// The /any-site twin ("Allow pages from any site", plan 288): rendered from the same
// setting, so extra storage origins reach the wider policy too.
const ANY_SITE_TEMPLATE = readFileSync(join(PKG, 'conf/any-site-headers.inc'), 'utf8');
const ANY_SITE_DEFAULT = ANY_SITE_TEMPLATE.replace('__LOLLY_CSP_EXTRA_CONNECT_SRC__', '').replace(MODELS_HOST, ' https://lolli.li');
const ORIGINS = 'https://cloud.example.org https://storage.example.org:8443';

// Execute the package scripts with filesystem, settings and service helpers
// standing in for a YunoHost host. No system nginx files or services are touched.
const HELPERS = String.raw`
set -e
headers_inc="$LOLLY_TEST_DIR/$domain.headers.inc"
any_site_inc="$LOLLY_TEST_DIR/$domain.any-site.inc"
models_inc="$LOLLY_TEST_DIR/$domain.models.inc"
ynh_die() { printf '%s\n' "$*" >&2; exit 1; }
ynh_script_progression() { :; }
ynh_print_info() { :; }
ynh_setup_source() { :; }
ynh_app_setting_set() {
    local key="${'$'}{1#--key=}"
    printf '%s' "${'$'}{2#--value=}" > "$LOLLY_TEST_DIR/setting.$key"
    echo "save" >> "$LOLLY_TEST_DIR/events"
}
ynh_app_setting_set_default() {
    local key="${'$'}{1#--key=}" current
    current="${'$'}{!key:-}"
    if [[ -z "$current" ]]; then
        printf -v "$key" '%s' "${'$'}{2#--value=}"
        ynh_app_setting_set "$@"
    fi
}
chown() { :; }
if ! stat -c %s / >/dev/null 2>&1; then
    stat() { [[ "$1" == -c && "$2" == %s ]]; wc -c < "$3" | tr -d ' '; }
    df() { printf 'Avail\n999999999999\n'; }
    sha256sum() { shasum -a 256 "$@"; }
fi
ynh_config_add() {
    local template="${'$'}{1#--template=}" destination="${'$'}{2#--destination=}" event
    case "$template" in
        security-headers.inc) [[ "$destination" == "$headers_inc" ]]; event=render ;;
        any-site-headers.inc) [[ "$destination" == "$any_site_inc" ]]; event=render-any-site ;;
        models.hosted.inc|models.local.inc) [[ "$destination" == "$models_inc" ]]; event="render-$template" ;;
        *) return 1 ;;
    esac
    sed -e "s|__LOLLY_CSP_EXTRA_CONNECT_SRC__|$lolly_csp_extra_connect_src|g" -e "s|__LOLLY_CSP_MODELS_HOST__|$lolly_csp_models_host|g" -e "s|__DATA_DIR__|$data_dir|g" \
        "../conf/$template" > "$destination"
    echo "$event" >> "$LOLLY_TEST_DIR/events"
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
    [[ "$1" != "$data_dir"* ]] || { echo 'data dir must not be backed up' >&2; return 1; }
    if [[ "$1" == "$headers_inc" ]]; then cp "$1" "$LOLLY_TEST_DIR/archive/headers"; fi
}
ynh_restore() {
    if [[ "$1" == "$headers_inc" ]]; then cp "$LOLLY_TEST_DIR/archive/headers" "$1"; fi
}
ynh_app_config_run() {
    [[ "$1" == apply ]]
    local errors
    errors=$(validate__csp_extra_connect_src; validate__models_source)
    [[ -z "$errors" ]] || ynh_die "$errors"
    if [[ "${'$'}{LOLLY_TEST_ONLY:-csp}" == models ]]; then set__models_source; else set__csp_extra_connect_src; fi
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
  const saved = () => existsSync(join(dir, 'setting.csp_extra_connect_src')) ? readFileSync(join(dir, 'setting.csp_extra_connect_src'), 'utf8') : undefined;
  const savedModels = () => existsSync(join(dir, 'setting.models_source')) ? readFileSync(join(dir, 'setting.models_source'), 'utf8') : undefined;
  const run = (script: string, env: NodeJS.ProcessEnv = {}) => {
    const source = readFileSync(join(dir, 'scripts', script), 'utf8')
      .replace('source /usr/share/yunohost/helpers', 'source "$LOLLY_TEST_DIR/helpers"');
    return spawnSync('bash', ['-e', '-c', source, script, 'apply'], {
      cwd: join(dir, 'scripts'), encoding: 'utf8',
      env: { ...process.env, app: 'lolly', domain: 'lolly.example.org', install_dir: join(dir, 'www'), data_dir: join(dir, 'data'),
        LOLLY_TEST_DIR: dir, csp_extra_connect_src: saved(), models_source: savedModels(), ...env },
    });
  };
  return {
    dir, run, saved, savedModels,
    models: () => readFileSync(join(dir, 'lolly.example.org.models.inc'), 'utf8'),
    headers: (domain = 'lolly.example.org') => readFileSync(join(dir, `${domain}.headers.inc`), 'utf8'),
    anySite: (domain = 'lolly.example.org') => readFileSync(join(dir, `${domain}.any-site.inc`), 'utf8'),
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
  assert.equal(f.anySite(), ANY_SITE_DEFAULT);
  f.clearEvents();
  ok('config', { csp_extra_connect_src: `  https://cloud.example.org/ ${ORIGINS}  ` });
  assert.equal(f.saved(), ORIGINS);
  const configured = f.headers();
  assert.equal(configured, DEFAULT.replace('; img-src', ` ${ORIGINS}; img-src`));
  const configuredAnySite = f.anySite();
  assert.equal(configuredAnySite, ANY_SITE_DEFAULT.replace('; img-src', ` ${ORIGINS}; img-src`));
  assert.deepEqual(f.events(), ['render', 'render-any-site', 'render-models.hosted.inc', 'check', 'reload', 'save']);

  writeFileSync(join(f.dir, 'lolly.example.org.headers.inc'), 'manual edit');
  ok('upgrade');
  assert.equal(f.headers(), configured);
  assert.equal(f.saved(), ORIGINS);

  ok('backup');
  // YunoHost itself archives and restores settings.yml alongside these files.
  cpSync(join(f.dir, 'setting.csp_extra_connect_src'), join(f.dir, 'archive/setting'));
  ok('config', { csp_extra_connect_src: '' });
  assert.equal(f.headers(), DEFAULT);
  assert.equal(f.saved(), '');
  cpSync(join(f.dir, 'archive/setting'), join(f.dir, 'setting.csp_extra_connect_src'));
  // A backup taken before the twin existed holds no copy of that file: restore renders the file again.
  rmSync(join(f.dir, 'lolly.example.org.any-site.inc'));
  ok('restore');
  assert.equal(f.headers(), configured);
  assert.equal(f.anySite(), configuredAnySite);
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
    const beforeAnySite = f.anySite();
    f.clearEvents();
    const r = f.run('config', { csp_extra_connect_src: '', LOLLY_TEST_FAIL: failure });
    assert.notEqual(r.status, 0);
    assert.match(r.stderr, /previous configuration was restored/);
    assert.equal(f.headers(), before);
    assert.equal(f.anySite(), beforeAnySite, 'the /any-site twin rolls back with the header file');
    assert.equal(f.saved(), ORIGINS);
    assert.equal(f.events().includes('save'), false);
    if (failure === 'check') assert.equal(f.events().includes('reload'), false);
  });
}

// Model weights on this server (models_source = local). The release host is a local
// directory reached over file://, so the fetch, size and hash checks run for real.
import { createHash } from 'node:crypto';

function modelFixture(t: test.TestContext) {
  const f = fixture(t);
  const origin = join(f.dir, 'origin');
  const files = [
    { family: 'demo', name: 'config.json', body: '{"a":1}' },
    { family: 'demo', name: 'onnx/model.onnx', body: 'x'.repeat(5000) },
  ];
  const sha = (b: string) => createHash('sha256').update(b).digest('hex');
  const dirHash = createHash('sha256').update(files.map(x => `${x.name}\0${x.body.length}\0${sha(x.body)}\n`).join('')).digest('hex');
  const manifest = files.map(x => ({
    url: `/models/${x.family}/${x.name}`, size: x.body.length, sha256: sha(x.body), directorySha256: dirHash,
    immutableUrl: `/models/${x.family}@${dirHash.slice(0, 16)}/${x.name}`,
  }));
  for (const [i, x] of files.entries()) {
    const path = join(origin, manifest[i]!.immutableUrl);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, x.body);
  }
  mkdirSync(join(f.dir, 'www'), { recursive: true });
  writeFileSync(join(f.dir, 'www/models-manifest.json'), JSON.stringify(manifest));
  const env = { LOLLY_MODELS_ORIGIN: `file://${origin}`, LOLLY_TEST_ONLY: 'models' };
  return { f, manifest, origin, env };
}

test('models: choosing this server fetches, verifies and serves from the data dir; the CSP drops lolli.li', t => {
  const { f, manifest, env } = modelFixture(t);
  assert.equal(f.run('install').status, 0);
  assert.match(f.models(), /return 404;/);
  assert.match(f.headers(), /https:\/\/lolli\.li /);
  const r = f.run('config', { ...env, models_source: 'local' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(f.savedModels(), 'local');
  for (const m of manifest) {
    assert.ok(existsSync(join(f.dir, 'data', m.immutableUrl)), m.immutableUrl);
    assert.ok(existsSync(join(f.dir, 'data', m.url)), m.url);
  }
  assert.match(f.models(), /location \^~ \/models\//);
  assert.match(f.models(), /root .*\/data;/);
  assert.doesNotMatch(f.headers().split('\n').filter(l => l.startsWith('more_set_headers "Content-Security')).join(), /lolli\.li/);
  assert.doesNotMatch(f.anySite().split('\n').filter(l => l.startsWith('more_set_headers')).join(), /lolli\.li/);
  // An upgrade keeps the local mode and, with the marker current, refetches nothing.
  assert.equal(f.run('upgrade', { ...env, models_source: 'local', LOLLY_MODELS_ORIGIN: 'file:///nonexistent' }).status, 0);
  assert.match(f.models(), /location \^~ \/models\//);
  // Back to the default host.
  assert.equal(f.run('config', { ...env, models_source: 'lolli' }).status, 0);
  assert.match(f.models(), /return 404;/);
  assert.match(f.headers(), /https:\/\/lolli\.li /);
});

test('models: a file that fails its checksum stops the change and nothing is served', t => {
  const { f, manifest, origin, env } = modelFixture(t);
  assert.equal(f.run('install').status, 0);
  writeFileSync(join(origin, manifest[1]!.immutableUrl), 'y'.repeat(5000));
  const r = f.run('config', { ...env, models_source: 'local' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /failed its size or sha256 check/);
  assert.equal(f.savedModels(), 'lolli');
  assert.match(f.models(), /return 404;/);
  assert.equal(existsSync(join(f.dir, 'data/models/.complete')), false);
});

test('models: an old release without a manifest cannot choose this server, and an unknown source is refused', t => {
  const { f, env } = modelFixture(t);
  assert.equal(f.run('install').status, 0);
  rmSync(join(f.dir, 'www/models-manifest.json'));
  const r = f.run('config', { ...env, models_source: 'local' });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /no models-manifest\.json/);
  assert.notEqual(f.run('config', { ...env, models_source: 'elsewhere' }).status, 0);
  assert.equal(f.savedModels(), 'lolli');
});

test('models: a backup never carries the model files', t => {
  const { f, env } = modelFixture(t);
  assert.equal(f.run('install').status, 0);
  assert.equal(f.run('config', { ...env, models_source: 'local' }).status, 0);
  const r = f.run('backup', { models_source: 'local' });
  assert.equal(r.status, 0, r.stderr);
});
